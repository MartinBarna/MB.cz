// Testy guardu tajného klíče. Bez sítě, bez Deno permissions.
// Spuštění: npx --yes deno@2 run akademie/_supabase/functions/_shared/secret-guard.test.ts
import { chybaCteni, ctiSOpakovanim, overSecret, type KonfigKlient } from "./secret-guard.ts";

let selhalo = 0;
function check(nazev: string, podminka: boolean, detail = ""): void {
  if (podminka) {
    console.log("  ok   " + nazev);
  } else {
    selhalo++;
    console.log("  FAIL " + nazev + (detail ? "  [" + detail + "]" : ""));
  }
}

/** Falešný klient: `odpovedi` se vydávají v pořadí, každé volání spotřebuje jednu. */
function klient(odpovedi: Array<{ data: { value?: unknown } | null; error: unknown } | Error>): KonfigKlient & { volani: number } {
  let i = 0;
  const k = {
    volani: 0,
    from(_t: string) {
      return {
        select(_c: string) {
          return {
            eq(_col: string, _val: string) {
              return {
                maybeSingle() {
                  k.volani++;
                  const o = odpovedi[Math.min(i, odpovedi.length - 1)];
                  i++;
                  if (o instanceof Error) return Promise.reject(o);
                  return Promise.resolve(o);
                },
              };
            },
          };
        },
      };
    },
  };
  return k;
}

const req = (secret: string | null) => ({ headers: { get: (_n: string) => secret } });
const RYCHLE = { pokusy: 3, pauzaMs: 1 };

async function main() {
  console.log("ctiSOpakovanim");
  {
    let n = 0;
    const r = await ctiSOpakovanim(() => { n++; return Promise.resolve({ data: [1], error: null }); }, 3, 1);
    check("uspech hned: jedno volani", n === 1 && r.data?.[0] === 1);
  }
  {
    let n = 0;
    const r = await ctiSOpakovanim(() => {
      n++;
      return Promise.resolve(n < 3 ? { data: null, error: { message: "504" } } : { data: [7], error: null });
    }, 3, 1);
    check("dve chyby, treti pokus projde", n === 3 && !r.error && r.data?.[0] === 7, JSON.stringify(r));
  }
  {
    let n = 0;
    const r = await ctiSOpakovanim(() => { n++; return Promise.resolve({ data: null, error: { message: "504" } }); }, 3, 1);
    check("trvala chyba: 3 pokusy a error zustava (zadne prazdno)", n === 3 && !!r.error && r.data === null);
  }
  {
    const r = await ctiSOpakovanim(() => Promise.reject(new Error("fetch failed")) as Promise<{ data: number[] | null; error: unknown }>, 2, 1);
    check("vyjimka se bere jako error", !!r.error && String((r.error as Error).message) === "fetch failed");
  }
  {
    const r = await ctiSOpakovanim(() => Promise.resolve({ data: [], error: null }), 3, 1);
    check("prazdny seznam bez chyby je platna odpoved", !r.error && Array.isArray(r.data) && r.data.length === 0);
  }
  check("chybaCteni nese kde a detail", (() => {
    const c = chybaCteni("entitlements", { message: "gateway timeout" });
    return c.error === "read_failed" && c.kde === "entitlements" && c.detail === "gateway timeout";
  })());

  console.log("overSecret");
  {
    const k = klient([{ data: { value: "tajne" }, error: null }]);
    const r = await overSecret(k, req("tajne"), { header: "x-drip-secret", ...RYCHLE });
    check("sedi: ok + secret", r.ok && r.secret === "tajne" && k.volani === 1);
  }
  {
    const k = klient([{ data: { value: "tajne" }, error: null }]);
    const r = await overSecret(k, req("jine"), { header: "x-drip-secret", ...RYCHLE });
    check("nesedi: 401 unauthorized (vychozi)", !r.ok && r.status === 401 && r.body.error === "unauthorized");
  }
  {
    const k = klient([{ data: { value: "tajne" }, error: null }]);
    const r = await overSecret(k, req(null), { header: "x-drip-secret", statusOdmitnuti: 403, ...RYCHLE });
    check("chybi hlavicka + statusOdmitnuti 403: forbidden", !r.ok && r.status === 403 && r.body.error === "forbidden");
  }
  {
    const k = klient([{ data: null, error: { message: "504 gateway" } }]);
    const r = await overSecret(k, req("tajne"), { header: "x-drip-secret", ...RYCHLE });
    check("DB nepřečtena po 3 pokusech: 500 secret_unreadable, NE 401", !r.ok && r.status === 500 && r.body.error === "secret_unreadable" && k.volani === 3, JSON.stringify(r));
  }
  {
    const k = klient([{ data: null, error: { message: "504" } }, { data: { value: "tajne" }, error: null }]);
    const r = await overSecret(k, req("tajne"), { header: "x-drip-secret", ...RYCHLE });
    check("prvni pokus 504, druhy projde: ok", r.ok && k.volani === 2);
  }
  {
    const k = klient([{ data: null, error: null }]);
    const r = await overSecret(k, req("tajne"), { header: "x-drip-secret", ...RYCHLE });
    check("radek chybi (bez chyby): 500 secret_missing, NE 401", !r.ok && r.status === 500 && r.body.error === "secret_missing" && k.volani === 1);
  }
  {
    const k = klient([{ data: { value: "" }, error: null }]);
    const r = await overSecret(k, req(""), { header: "x-drip-secret", ...RYCHLE });
    check("prazdny secret v DB: 500 secret_missing (prazdna hlavicka NEPROJDE)", !r.ok && r.status === 500 && r.body.error === "secret_missing");
  }
  {
    const k = klient([new Error("network")]);
    const r = await overSecret(k, req("tajne"), { header: "x-drip-secret", ...RYCHLE });
    check("vyjimka klienta: 500 secret_unreadable", !r.ok && r.status === 500 && r.body.error === "secret_unreadable");
  }
  {
    const k = klient([{ data: { value: "abc" }, error: null }]);
    const r = await overSecret(k, req("abc"), { header: "x-ingest-secret", key: "drip_invoke_secret", ...RYCHLE });
    check("jina hlavicka, tyz klic: ok", r.ok);
  }

  console.log(selhalo === 0 ? "\nVSE ZELENE\n" : `\n${selhalo} SELHANI\n`);
  if (selhalo > 0) throw new Error(String(selhalo) + " selhani");
}

await main();
