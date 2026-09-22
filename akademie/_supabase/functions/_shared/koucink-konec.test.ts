// Spuštění: npx --yes deno@2 run akademie/_supabase/functions/_shared/koucink-konec.test.ts
// (lokálně bez sítě: "C:/Users/fitne/.supabase/deno.exe" run …)
//
// Čisté funkce automatu „konec koučinku". Databáze ani Stripe se tu nevolají:
// `ukonciPristup` a `vytvorPromoKod` mají vedlejší účinky a testují se během
// nanečisto proti živé funkci (viz BUILD, sekce smoke).
import {
  konecDoPole,
  MAX_DNU_KONEC_DOPREDU,
  MAX_DNU_KONEC_DOZADU,
  overKonecKoucinku,
  PROMO_ABECEDA,
  PROMO_PLATNOST_DNI,
  promoForm,
  promoPlatnostDo,
  vyberKeUkonceni,
  vygenerujPromoKod,
} from "./koucink-konec.ts";

let selhalo = 0;
function check(nazev: string, podminka: boolean, detail = ""): void {
  if (podminka) console.log("  ok   " + nazev);
  else { selhalo++; console.log("  FAIL " + nazev + (detail ? "  [" + detail + "]" : "")); }
}

const DEN = 86400000;
const TED = Date.parse("2026-09-22T10:00:00Z");

// -----------------------------------------------------------------------------
console.log("\n== overKonecKoucinku ==");
check("prázdno je legitimní odpověď, ne chyba",
  JSON.stringify(overKonecKoucinku("", TED)) === JSON.stringify({ ok: true, konec: null }));
check("platné datum se uloží jako KONEC DNE",
  JSON.stringify(overKonecKoucinku("2026-10-15", TED)) ===
    JSON.stringify({ ok: true, konec: "2026-10-15T23:59:59.000Z" }));
// ⛔ KONTRAST: půlnoc na začátku dne by klienta prohlásila za skončeného celý den,
//    který má ještě zaplacený.
check("není to půlnoc na začátku dne",
  !String((overKonecKoucinku("2026-10-15", TED) as { konec: string }).konec).includes("T00:00:00"));
check("31. února neprojde",
  overKonecKoucinku("2026-02-31", TED).ok === false);
check("špatný tvar neprojde",
  overKonecKoucinku("15. 10. 2026", TED).ok === false);
check("rok 2029 je moc daleko",
  overKonecKoucinku("2029-01-01", TED).ok === false);
check("těsně pod stropem dopředu projde",
  overKonecKoucinku(new Date(TED + (MAX_DNU_KONEC_DOPREDU - 2) * DEN).toISOString().slice(0, 10), TED).ok === true);
check("příliš staré neprojde",
  overKonecKoucinku(new Date(TED - (MAX_DNU_KONEC_DOZADU + 5) * DEN).toISOString().slice(0, 10), TED).ok === false);
check("konecDoPole vrátí den z uloženého okamžiku",
  konecDoPole("2026-10-15T23:59:59.000Z") === "2026-10-15");
check("konecDoPole z prázdna vrátí prázdno", konecDoPole(null) === "" && konecDoPole("") === "");

// -----------------------------------------------------------------------------
console.log("\n== vyberKeUkonceni (výběr má KONTRAST, ne jen happy path) ==");
const GRACE = 7;
const radky = [
  { email: "PoKonci@x.cz", active: true, expires_at: new Date(TED - 10 * DEN).toISOString() },
  { email: "vcera@x.cz", active: true, expires_at: new Date(TED - 1 * DEN).toISOString() },
  { email: "bezdata@x.cz", active: true, expires_at: null },
  { email: "neaktivni@x.cz", active: false, expires_at: new Date(TED - 30 * DEN).toISOString() },
  { email: "budoucnost@x.cz", active: true, expires_at: new Date(TED + 30 * DEN).toISOString() },
  { email: "optout@x.cz", active: true, expires_at: new Date(TED - 30 * DEN).toISOString() },
  { email: "uzposlano@x.cz", active: true, expires_at: new Date(TED - 30 * DEN).toISOString() },
  { email: "rozbitedatum@x.cz", active: true, expires_at: "vcera vecer" },
];
const v = vyberKeUkonceni(radky, {
  tedMs: TED, graceDny: GRACE,
  optout: ["OptOut@x.cz"],
  jizOrazitkovane: ["uzposlano@x.cz"],
});
const vybrane = v.kUkonceni.map((r) => r.email);
check("3 dny po konci s grací 7 NEVYBRAT", !vybrane.includes("vcera@x.cz"));
check("10 dní po konci s grací 7 VYBRAT", vybrane.includes("pokonci@x.cz"));
check("e-mail se normalizuje na malá písmena", vybrane.includes("pokonci@x.cz") && !vybrane.includes("PoKonci@x.cz"));
check("neaktivní nárok NEVYBRAT", !vybrane.includes("neaktivni@x.cz"));
check("konec v budoucnu NEVYBRAT", !vybrane.includes("budoucnost@x.cz"));
check("optout NEVYBRAT (a porovnává se bez ohledu na velikost písmen)", !vybrane.includes("optout@x.cz"));
check("už orazítkovaný NEVYBRAT", !vybrane.includes("uzposlano@x.cz"));
// ⛔⛔ TOHLE JE TA PODSTATNÁ: nárok bez data konce se nezavírá NIKDY.
//    Změřeno 22. 9. 2026: takových je dnes 20 z 20.
check("nárok BEZ data konce NEVYBRAT", !vybrane.includes("bezdata@x.cz"));
check("nečitelné datum se bere jako BEZ data", !vybrane.includes("rozbitedatum@x.cz"));
check("vybrán přesně jeden", v.kUkonceni.length === 1, JSON.stringify(vybrane));
check("počítadla hlásí, proč se nikdo další nevybral",
  v.bezData === 2 && v.vGraci === 2 && v.vOptout === 1,
  `bezData=${v.bezData} vGraci=${v.vGraci} vOptout=${v.vOptout}`);

// Grace jako páka: s grací 0 spadne dovnitř i včerejší konec.
const v0 = vyberKeUkonceni(radky, { tedMs: TED, graceDny: 0 });
check("grace 0 vezme i včerejší konec", v0.kUkonceni.map((r) => r.email).includes("vcera@x.cz"));
const v99 = vyberKeUkonceni(radky, { tedMs: TED, graceDny: 99 });
check("grace 99 nevezme nikoho", v99.kUkonceni.length === 0);
check("záporná grace se chová jako nula",
  vyberKeUkonceni(radky, { tedMs: TED, graceDny: -5 }).kUkonceni.length === v0.kUkonceni.length);
check("prázdný seznam nevyhodí výjimku", vyberKeUkonceni([], { tedMs: TED, graceDny: 7 }).kUkonceni.length === 0);

// -----------------------------------------------------------------------------
console.log("\n== promo kód ==");
const kod = vygenerujPromoKod((n) => new Uint8Array(new Array(n).fill(0)));
check("tvar VIP- + 6 znaků", /^VIP-[A-Z0-9]{6}$/.test(kod), kod);
check("deterministický generátor je deterministický",
  vygenerujPromoKod((n) => new Uint8Array(new Array(n).fill(0))) === kod);
check("abeceda nemá znaky, co se pletou",
  !PROMO_ABECEDA.includes("0") && !PROMO_ABECEDA.includes("O") &&
  !PROMO_ABECEDA.includes("1") && !PROMO_ABECEDA.includes("I") && !PROMO_ABECEDA.includes("L"));
check("modulo nikdy nespadne mimo abecedu",
  vygenerujPromoKod((n) => new Uint8Array(new Array(n).fill(255))).length === 4 + 6);
const platnost = promoPlatnostDo(TED);
check("platnost je 14 dní a v sekundách",
  platnost === Math.floor((TED + PROMO_PLATNOST_DNI * DEN) / 1000) && String(platnost).length === 10);

const form = promoForm({ couponId: "coupon_X", kod: "VIP-ABCDEF", expiresAt: platnost, email: "a@b.cz" });
check("form: kupón a kód", form.coupon === "coupon_X" && form.code === "VIP-ABCDEF");
// ⛔ KONTRAST: bez `max_redemptions` by přeposlaný kód platil komukoli.
check("form: jen jedno uplatnění", form.max_redemptions === "1");
check("form: platnost se posílá", form.expires_at === String(platnost));
check("form: stopa proč kód vznikl", form["metadata[duvod]"] === "koucink-konec");
// ⛔ `customer` by odkazoval na zákazníka v PROJEKTU APPKY, Academy jeho id nezná.
check("form: žádné `customer`", !("customer" in form));
// ⛔ Procento slevy je v kupónu, ne tady. Dvě místa s jedním číslem se rozejdou.
check("form: žádné procento slevy",
  !Object.values(form).some((x) => String(x).includes("20")) || form.expires_at.includes("20"));

console.log(selhalo === 0 ? "\nVSE ZELENE\n" : `\n${selhalo} SELHANI\n`);
if (selhalo > 0) throw new Error(String(selhalo) + " selhani");
