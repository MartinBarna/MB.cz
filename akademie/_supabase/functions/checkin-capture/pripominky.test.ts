// Testy dávkování pondělních připomínek. Bez sítě, bez DB, bez Deno permissions.
// Spuštění: npx --yes deno@2 run akademie/_supabase/functions/checkin-capture/pripominky.test.ts
import {
  RESEND_PREDPOKLAD,
  drzetRezervaci,
  isoTyden,
  jeVOkneCheckinu,
  naplnDavku,
  pripravFrontu,
  stropTohotoBehu,
  type Osoba,
} from "./pripominky.ts";

let selhalo = 0;
function check(nazev: string, podminka: boolean, detail = ""): void {
  if (podminka) console.log("  ok   " + nazev);
  else {
    selhalo++;
    console.log("  FAIL " + nazev + (detail ? "  [" + detail + "]" : ""));
  }
}

const TED = Date.parse("2026-10-26T07:00:00Z"); // pondělí
const DEN = 86400000;

function pred(dny: number): string {
  return new Date(TED - dny * DEN).toISOString();
}

function osoba(email: string, x: Partial<Osoba> = {}): Osoba {
  return {
    email,
    emailRaw: email,
    token: "t-" + email,
    coaching: false,
    remindersOff: false,
    lastRemindedWeek: null,
    ...x,
  };
}

async function main(): Promise<void> {
  console.log("\n== ISO týden ==");
  check("1. 1. 2026 (čtvrtek) je 2026-W01", isoTyden(Date.parse("2026-01-01T12:00:00Z")) === "2026-W01");
  check("pondělí 29. 12. 2025 patří do 2026-W01", isoTyden(Date.parse("2025-12-29T12:00:00Z")) === "2026-W01");
  check("neděle 28. 12. 2025 je ještě 2025-W52", isoTyden(Date.parse("2025-12-28T12:00:00Z")) === "2025-W52");
  check("běh 26. 10. 2026 je 2026-W44", isoTyden(TED) === "2026-W44");

  console.log("\n== okno check-inu ==");
  check("6 dní je v okně", jeVOkneCheckinu(pred(6), TED));
  check("45 dní je v okně", jeVOkneCheckinu(pred(45), TED));
  check("KONTRAST: 5,9 dne je brzo", !jeVOkneCheckinu(pred(5.9), TED));
  check("KONTRAST: 46 dní je pozdě", !jeVOkneCheckinu(pred(46), TED));
  check("KONTRAST: žádný check-in není v okně", !jeVOkneCheckinu(null, TED));

  console.log("\n== strop a rezerva ==");
  check("volný den: strop běhu 80", stropTohotoBehu({ dripDailyCap: 500, odeslanoDnes: 0 }) === 80);
  check("týž strop i když cap je obří (rezerva rychlosti, ne měsíční kvóty)",
    stropTohotoBehu({ dripDailyCap: 50000, odeslanoDnes: 0 }) === RESEND_PREDPOKLAD.stropBehu);
  check("drip už sežral den: zbývá míň než 80",
    stropTohotoBehu({ dripDailyCap: 500, odeslanoDnes: 350 }) === 50);
  check("rezerva 100 se nenechá sežrat",
    stropTohotoBehu({ dripDailyCap: 500, odeslanoDnes: 400 }) === 0);
  check("KONTRAST: přesně na hraně rezervy je 0",
    stropTohotoBehu({ dripDailyCap: 500, odeslanoDnes: 400 }) === 0);
  check("ještě 1 místo nad rezervou",
    stropTohotoBehu({ dripDailyCap: 500, odeslanoDnes: 399 }) === 1);
  check("nesmyslný cap spadne na 500 a pořád drží strop 80",
    stropTohotoBehu({ dripDailyCap: 0, odeslanoDnes: 0 }) === 80);

  const tyden = isoTyden(TED);
  const mix: Osoba[] = [
    osoba("kouc@example.com", { coaching: true }),
    osoba("vypnuto@example.com", { remindersOff: true }),
    osoba("uz-dnes@example.com", { lastRemindedWeek: tyden }),
    osoba("stary@example.com", { lastRemindedWeek: "2026-W40" }),
    osoba("nikdy-b@example.com"),
    osoba("nikdy-a@example.com"),
    osoba("nikdy-a@example.com", { emailRaw: "Nikdy-A@example.com" }),
    osoba("minuly@example.com", { lastRemindedWeek: "2026-W43" }),
    osoba("bez-zavinace"),
  ];

  console.log("\n== fronta: mix a rotace ==");
  const fronta = pripravFrontu(mix, tyden);
  const maily = fronta.map((o) => o.email);
  check("koučink, vypnuté, už tenhle týden a neplatný e-mail ve frontě nejsou",
    !maily.some((e) => ["kouc@example.com", "vypnuto@example.com", "uz-dnes@example.com", "bez-zavinace"].includes(e)),
    maily.join(","));
  check("duplicitní adresa je ve frontě jednou", maily.filter((e) => e === "nikdy-a@example.com").length === 1);
  check("nikdy-nejsou první, seřazení podle e-mailu, pak starší týdny",
    maily.join(",") === "nikdy-a@example.com,nikdy-b@example.com,stary@example.com,minuly@example.com",
    maily.join(","));

  console.log("\n== dávka: kvóta, okno, žádná duplicita, další běh ==");
  const casy: Record<string, string | null> = {
    "nikdy-a@example.com": pred(10),
    "nikdy-b@example.com": pred(3),
    "stary@example.com": pred(20),
    "minuly@example.com": pred(12),
  };
  let dotazuMimo = 0;
  const beh1 = await naplnDavku(fronta, 2, TED, async (email) => {
    dotazuMimo++;
    return { at: casy[email] ?? null, chyba: false };
  });
  check("limit 2 vezme dva v okně", beh1.davka.map((o) => o.email).join(",") === "nikdy-a@example.com,stary@example.com",
    beh1.davka.map((o) => o.email).join(","));
  check("příliš čerstvý se přeskočí a nepočítá se do dávky", beh1.mimoOkno === 1);
  check("na zbytek fronty se po naplnění neptáme", beh1.dotazu === 3, String(beh1.dotazu));
  check("v dávce není duplicita", new Set(beh1.davka.map((o) => o.email)).size === beh1.davka.length);

  const poPrvnim = mix.map((o) =>
    beh1.davka.some((d) => d.email === o.email) ? { ...o, lastRemindedWeek: tyden } : o
  );
  const fronta2 = pripravFrontu(poPrvnim, tyden);
  const beh2 = await naplnDavku(fronta2, 2, TED, async (email) => ({ at: casy[email] ?? null, chyba: false }));
  check("druhý běh téhož týdne vezme další, ne tytéž",
    beh2.davka.map((o) => o.email).join(",") === "minuly@example.com",
    beh2.davka.map((o) => o.email).join(","));
  const prunik = beh1.davka.filter((a) => beh2.davka.some((b) => b.email === a.email));
  check("průnik dvou běhů je prázdný", prunik.length === 0);
  const beh3 = await naplnDavku(pripravFrontu(
    poPrvnim.map((o) => beh2.davka.some((d) => d.email === o.email) ? { ...o, lastRemindedWeek: tyden } : o),
    tyden,
  ), 80, TED, async (email) => ({ at: casy[email] ?? null, chyba: false }));
  check("třetí běh už nikoho v okně nemá", beh3.davka.length === 0 && beh3.mimoOkno === 1);

  console.log("\n== chyba čtení a nulový limit ==");
  let volano = 0;
  const prazdny = await naplnDavku(fronta, 0, TED, async () => {
    volano++;
    return { at: pred(10), chyba: false };
  });
  check("limit 0 nikoho nečte a nikoho nevrátí", prazdny.davka.length === 0 && volano === 0);
  const sChybou = await naplnDavku(
    [osoba("a@example.com"), osoba("b@example.com")],
    2,
    TED,
    async (email) => email === "a@example.com"
      ? { at: null, chyba: true }
      : { at: pred(10), chyba: false },
  );
  check("nepřečtený se přeskočí a dávka pokračuje dalším",
    sChybou.neprecteno === 1 && sChybou.davka.map((o) => o.email).join(",") === "b@example.com");

  console.log("\n== rezervace při chybě odeslání ==");
  check("500 drží rezervaci", drzetRezervaci(500, "resend_500"));
  check("pád sítě drží rezervaci", drzetRezervaci(0, "sit:reset"));
  check("KONTRAST: 429 rezervaci pouští", !drzetRezervaci(429, "resend_429"));
  check("KONTRAST: chybějící klíč rezervaci pouští", !drzetRezervaci(0, "missing_RESEND_API_KEY"));
  check("KONTRAST: 422 rezervaci pouští", !drzetRezervaci(422, "resend_422"));

  console.log(selhalo === 0 ? "\nVSE ZELENE\n" : "\n" + selhalo + " SELHANI\n");
  if (selhalo) Deno.exit(1);
}

await main();
