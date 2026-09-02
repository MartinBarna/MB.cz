// Test výpočtu zaplaceného období koučinku (2. 9. 2026).
// Spuštění:
//   npx --yes deno@2 run --allow-read akademie/_supabase/functions/academy-stripe-webhook/koucink-obdobi.test.ts
//
// PROČ ZROVNA TOHLE: `expires_at` je jediné číslo, které u koučinku rozhoduje o tom,
// jak dlouho člověk dostává službu za 6 450 až 59 500 Kč. Chyba se pozná až ve chvíli,
// kdy klientovi předčasně zmizí klientská sekce, tedy pozdě a u platícího.
import {
  KOUCINK_KAPACITA,
  koucinkExpirace,
  koucinkNazev,
} from "../_shared/koucink-onboarding.ts";

type Kontrola = { name: string; pass: boolean; detail: string };
const cases: Kontrola[] = [];
const check = (name: string, pass: boolean, detail = "") => cases.push({ name, pass, detail });

const den = (iso: string) => iso.slice(0, 10);

// --- 1) Základní délky ---
const od = new Date("2026-09-02T10:00:00.000Z");
check("E1 jeden mesic", den(koucinkExpirace(1, od)) === "2026-10-02", koucinkExpirace(1, od));
check("E2 tri mesice", den(koucinkExpirace(3, od)) === "2026-12-02", koucinkExpirace(3, od));
check("E3 sest mesicu", den(koucinkExpirace(6, od)) === "2027-03-02", koucinkExpirace(6, od));

// --- 2) Přelom roku ---
const listopad = new Date("2026-11-15T08:00:00.000Z");
check("E4 sest mesicu pres novy rok", den(koucinkExpirace(6, listopad)) === "2027-05-15",
  koucinkExpirace(6, listopad));

// --- 3) KRÁTKÝ MĚSÍC. JS by z 31. 1. + 1 měsíc udělal 3. 3.; klient by dostal dva dny
// navíc a datum by nešlo vysvětlit. Musí vyjít poslední den února.
const ledna31 = new Date("2027-01-31T09:00:00.000Z");
check("E5 31. 1. + 1 mesic je 28. 2. (ne 3. 3.)", den(koucinkExpirace(1, ledna31)) === "2027-02-28",
  koucinkExpirace(1, ledna31));
const prestupny = new Date("2028-01-31T09:00:00.000Z");
check("E6 v prestupnem roce 31. 1. + 1 mesic je 29. 2.", den(koucinkExpirace(1, prestupny)) === "2028-02-29",
  koucinkExpirace(1, prestupny));

// --- 4) Období se NIKDY nesmí zkrátit ---
for (const m of [1, 3, 6]) {
  check(`E7 obdobi ${m} mes. je vzdy v budoucnu`, new Date(koucinkExpirace(m, od)).getTime() > od.getTime(), "");
}

// --- 5) PRODLOUŽENÍ. Kdo si měsíc před koncem dokoupí další období, nesmí o zbytek
// přijít: základ je konec stávajícího období, ne dnešek. Tuhle volbu dělá volající
// (`zpracujKoucink`), tady se ověřuje, že se z daného základu počítá správně.
const konecStavajiciho = new Date("2026-10-02T10:00:00.000Z");
check("E8 prodlouzeni o 3 mesice od konce stavajiciho obdobi",
  den(koucinkExpirace(3, konecStavajiciho)) === "2027-01-02", koucinkExpirace(3, konecStavajiciho));

// --- 6) Nesmysl na vstupu nesmí vyrobit období v minulosti ---
check("E9 nula mesicu spadne na jeden, ne na minulost",
  new Date(koucinkExpirace(0, od)).getTime() > od.getTime(), koucinkExpirace(0, od));

// --- 7) Názvy pro doklad, alert a admin ---
check("N1 gold 1", koucinkNazev("gold", 1) === "Online koučink Gold (1 měsíc)", koucinkNazev("gold", 1));
check("N2 gold 3", koucinkNazev("gold", 3) === "Online koučink Gold (3 měsíce)", koucinkNazev("gold", 3));
check("N3 diamond 6", koucinkNazev("diamond", 6) === "Online koučink Diamond (6 měsíců)", koucinkNazev("diamond", 6));

// --- 8) Kapacita je 10 míst (Martinovo obchodní rozhodnutí) ---
check("K1 kapacita je 10", KOUCINK_KAPACITA === 10, String(KOUCINK_KAPACITA));

const failures = cases.filter((c) => !c.pass).length;
for (const c of cases) console.log(`${c.pass ? "  ok" : "FAIL"}  ${c.name}${c.pass ? "" : "  -> " + c.detail}`);
console.log(`\n${cases.length - failures}/${cases.length} proslo`);
if (failures > 0) Deno.exit(1);
