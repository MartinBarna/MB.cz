// ============================================================
// SEF-PROBE-UA: DOČASNÁ diagnostická funkce (13. 8. 2026).
//
// Otázka, kterou má rozhodnout: link-check má v kódu browser User-Agent (v14,
// nasazeno 11. 8.), a přesto od 11. 8. hlásí 401 na VŠECH 69 odkazech
// martinbarna.cz (ostatní domény 200). Z Česka přitom WEDOS vrací 401 jen
// requestům BEZ User-Agenta; s jakýmkoli UA vrací 200.
// ⇒ Buď runtime edge funkce hlavičku neposílá, nebo WEDOS blokuje celou ASN.
// Tohle se nedá zjistit z Česka, musí se změřit Z EDGE PROSTŘEDÍ.
//
// Po odměření se tenhle soubor nahradí 410 stubem. Nenechávat aktivní kód.
// Deploy: --no-verify-jwt, brána = tajný query parametr, jinak 404.
// ============================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const KLIC = "eVx7BOn9uqpG7GBTItqJnRXb";
const CIL = "https://martinbarna.cz/";

// Přesně ten řetězec, který má link-check v14 v kódu.
const LC_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 LinkCheck-MartinBarna";
// Čistý Chrome bez našeho markeru: rozliší „vadí UA jako takový" od „vadí marker".
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

type Pokus = {
  nazev: string;
  status: number | null;
  ok: boolean;
  telo_delka: number | null;
  telo_uryvek: string | null;
  hlavicky: Record<string, string | null>;
  chyba: string | null;
};

async function pokus(nazev: string, url: string, headers?: Record<string, string>): Promise<Pokus> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const init: RequestInit = { method: "GET", redirect: "follow", signal: ctrl.signal };
    if (headers) init.headers = headers;
    const r = await fetch(url, init);
    const telo = await r.text().catch(() => "");
    return {
      nazev,
      status: r.status,
      ok: r.ok,
      telo_delka: telo.length,
      telo_uryvek: telo.slice(0, 300),
      hlavicky: {
        server: r.headers.get("server"),
        "x-protected-by": r.headers.get("x-protected-by"),
        "www-authenticate": r.headers.get("www-authenticate"),
        "content-type": r.headers.get("content-type"),
        "cf-ray": r.headers.get("cf-ray"),
      },
      chyba: null,
    };
  } catch (e) {
    return { nazev, status: null, ok: false, telo_delka: null, telo_uryvek: null, hlavicky: {}, chyba: String(e).slice(0, 200) };
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  if (u.searchParams.get("s") !== KLIC) return new Response("not found", { status: 404 });

  // Echo režim: funkce vypíše hlavičky, které jí DOŠLY. Používá se v pokusu (e),
  // kde si funkce zavolá sama sebe. Odpoví na otázku, jestli User-Agent nastavený
  // v fetch() vůbec opustí runtime, nebo ho runtime přepíše/zahodí.
  if (u.searchParams.get("echo") === "1") {
    const prijato: Record<string, string> = {};
    for (const [k, v] of req.headers) prijato[k] = v;
    return new Response(JSON.stringify({ echo: true, prijate_hlavicky: prijato }), {
      headers: { "content-type": "application/json" },
    });
  }

  const bezne = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "cs-CZ,cs;q=0.9",
  };

  const a = await pokus("a-bez-hlavicek", CIL);
  const b = await pokus("b-ua-presne-jako-linkcheck", CIL, { "User-Agent": LC_UA, ...bezne });
  const c = await pokus("c-cisty-chrome-ua", CIL, { "User-Agent": CHROME_UA, ...bezne });
  const d = await pokus("d-plna-sada-browser-hlavicek", CIL, {
    "User-Agent": CHROME_UA,
    ...bezne,
    "Accept-Encoding": "gzip, deflate, br",
    "sec-ch-ua": '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  });

  // (e) Co z runtime SKUTEČNĚ odejde: funkce zavolá sama sebe s UA link-checku
  //     a echo větev vypíše, co dorazilo.
  const e = await pokus(
    "e-echo-na-sebe-s-ua-linkchecku",
    `${SUPABASE_URL}/functions/v1/sef-probe-ua?echo=1&s=${KLIC}`,
    { "User-Agent": LC_UA, ...bezne },
  );

  return new Response(
    JSON.stringify({ probe: "sef-probe-ua", kdy: new Date().toISOString(), cil: CIL, vysledky: [a, b, c, d, e] }, null, 1),
    { headers: { "content-type": "application/json" } },
  );
});
