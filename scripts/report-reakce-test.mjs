// Test deterministického bloku čísel a pravidel pro úpravu zadání po týdenním reportu.
//
// Testuje TENTÝŽ soubor, který v produkci importuje edge funkce `admin-api`
// (`akademie/_supabase/functions/admin-api/report-engine.mjs`). Žádná kopie pravidel.
//
// Spuštění:  node scripts/report-reakce-test.mjs
//
// ⛔ Data v testu jsou vymyšlená. Jména ani adresy skutečných klientů tu nikdy nesmí být.
import {
  spocitejBlok, navrhni, pripravFakta, podlaha,
  REZ_PCT, PRIDANI_PCT, DNY_ZAPISU_MIN,
} from "../akademie/_supabase/functions/admin-api/report-engine.mjs";

let chyb = 0, ok = 0;
function tvrd(podminka, popis) {
  if (podminka) { ok++; return; }
  chyb++; console.error("  ✗ " + popis);
}
function scenar(nazev, fn) {
  console.log("\n" + nazev);
  try { fn(); } catch (e) { chyb++; console.error("  ✗ vyhodilo výjimku: " + e.message); }
}

/** Kostra reportu, ať se v testech opakuje jen to, co je pro scénář důležité. */
function rep(datum, vaha, o = {}) {
  return {
    report_date: datum,
    weight: vaha,
    measurements: o.miry || {},
    nutrition: o.nutrition === null ? {} : Object.assign({ dny_zapsano: 7 }, o.nutrition || {}),
    activity: o.activity || {},
    scales: o.scales || {},
  };
}
const CILE = { kcal: 2000, protein: 160, kroky: 10000, sport_min: 180, treninky: 3, fiber: 30 };

// ---------------------------------------------------------------------------
scenar("1) Blok čísel: rozdíly od minule i od startu, odchylky od cíle", () => {
  const b = spocitejBlok({
    posledni: rep("2026-09-01", 94.2, {
      miry: { pas: 107 },
      nutrition: { kcal: 2060, protein: 103, dny_zapsano: 7 },
      activity: { kroky: 6694, fitko: 0 },
    }),
    predchozi: rep("2026-08-25", 94.8, { miry: { pas: 104 } }),
    prvni: rep("2026-06-08", 96.7, { miry: { pas: 109 } }),
    cile: CILE,
  });
  tvrd(b.cisla.zmenaOdMinule === -0.6, "váha od minule je -0,6 (je " + b.cisla.zmenaOdMinule + ")");
  tvrd(b.cisla.zmenaOdStartu === -2.5, "váha od startu je -2,5 (je " + b.cisla.zmenaOdStartu + ")");
  const pas = b.cisla.miry.find((m) => m.klic === "pas");
  tvrd(pas && pas.odMinule === 3, "pas od minule +3 (je " + (pas && pas.odMinule) + ")");
  tvrd(pas && pas.odStartu === -2, "pas od startu -2 (je " + (pas && pas.odStartu) + ")");
  tvrd(b.cisla.proteinRozdil === -57, "bílkoviny -57 g proti cíli (je " + b.cisla.proteinRozdil + ")");
  tvrd(b.cisla.krokyRozdil === -3306, "kroky -3306 proti plánu (je " + b.cisla.krokyRozdil + ")");
  tvrd(b.cisla.kcalOdchylkaPct === 3, "kcal +3 % nad cílem (je " + b.cisla.kcalOdchylkaPct + ")");
  tvrd(b.text.indexOf("Váha 94,2 kg (od minule -0,6 kg)") === 0, "první řádek je váha s deltou");
  tvrd(b.text.indexOf("—") === -1 && b.text.indexOf("–") === -1, "v bloku není dlouhá ani střední pomlčka");
});

// ---------------------------------------------------------------------------
scenar("2) Chybějící hodnota je 'neuvedeno', ne nula; nesmyslné kroky se zahodí", () => {
  const b = spocitejBlok({
    posledni: rep("2026-08-31", 84, {
      nutrition: { kcal: null, protein: "", dny_zapsano: null },
      activity: { kroky: 52, fitko: 2 },
    }),
    predchozi: null, prvni: null, cile: CILE,
  });
  tvrd(b.cisla.kcal === null, "prázdné kcal zůstaly null, ne 0");
  tvrd(b.cisla.protein === null, "prázdné bílkoviny zůstaly null, ne 0");
  tvrd(b.cisla.kroky === null, "52 kroků za den je překlep, číslo se nepoužije");
  tvrd(b.cisla.krokyPodezrele === true, "překlep se ohlásí, netiší se");
  tvrd(b.text.indexOf("Kroky 52") === -1, "nesmyslná hodnota se do mailu nedostane");
  tvrd(b.text.indexOf("Průměr") === -1, "o kaloriích, které nejsou, se nepíše");
});

// ---------------------------------------------------------------------------
scenar("3) Málo zapsaných dní: cíle se NEMĚNÍ, úkolem je přesnost", () => {
  const b = spocitejBlok({
    posledni: rep("2026-09-01", 94.0, { nutrition: { kcal: 1900, protein: 150, dny_zapsano: 4 }, activity: { kroky: 11000 } }),
    predchozi: rep("2026-08-25", 94.0),
    cile: CILE,
  });
  const n = navrhni({ cisla: b.cisla, predchoziCisla: { tempoPct: 0 }, smer: "hubnuti", pohlavi: "m" });
  tvrd(n.paka === "zadna", "žádná páka, cíl zůstává (je " + n.paka + ")");
  tvrd(n.novyKcal === null, "nenavrhuje se nové číslo");
  tvrd(n.duvod.indexOf("4") !== -1, "důvod pojmenuje počet zapsaných dní");
  tvrd(DNY_ZAPISU_MIN === 6, "hranice zápisu je 6 ze 7 dní");
});

// ---------------------------------------------------------------------------
scenar("4) Stagnace druhý týden při čistém zápisu: řez kalorií, ale nikdy pod podlahu", () => {
  const stagnace = {
    posledni: rep("2026-09-01", 94.0, { nutrition: { kcal: 1990, protein: 160, dny_zapsano: 7 }, activity: { kroky: 10500 } }),
    predchozi: rep("2026-08-25", 94.0),
    predpredchozi: rep("2026-08-18", 94.0),
    prvni: rep("2026-06-08", 96.7),
    cile: CILE, smer: "hubnuti", pohlavi: "m",
  };
  const f = pripravFakta(stagnace);
  tvrd(f.navrh.paka === "kcal_dolu", "sáhne se na kalorie (je " + f.navrh.paka + ")");
  tvrd(f.navrh.novyKcal === 1880, "2000 -" + REZ_PCT + " % je 1880 (je " + f.navrh.novyKcal + ")");
  tvrd(f.navrh.novyKcal >= podlaha("m"), "návrh je nad mužskou podlahou 1500");

  // Jen jeden stagnující týden = počkat, ne řezat.
  const jeden = pripravFakta(Object.assign({}, stagnace, { predpredchozi: rep("2026-08-18", 95.2) }));
  tvrd(jeden.navrh.paka === "zadna", "po jednom stagnujícím týdnu se nic nemění (je " + jeden.navrh.paka + ")");
  tvrd(jeden.navrh.jistota === "malo_dat", "a je to označené jako málo dat");

  // Podlaha: cíl u ženy tak nízko, že řez by šel pod 1200.
  const uPodlahy = navrhni({
    cisla: Object.assign({}, f.cisla, { kcalCil: 1250, kcal: 1250, kcalOdchylkaPct: 0 }),
    predchoziCisla: { tempoPct: 0 }, smer: "hubnuti", pohlavi: "z",
  });
  tvrd(uPodlahy.paka === "zadna", "pod podlahu se neřeže (je " + uPodlahy.paka + ")");
  tvrd(uPodlahy.jistota === "podlaha", "a důvodem je podlaha");
  tvrd(uPodlahy.duvod.indexOf("1200") !== -1, "podlaha je v důvodu pojmenovaná číslem");
});

// ---------------------------------------------------------------------------
scenar("5) Bezpečnost a nabírání: rychlý úbytek zvedá příjem, stojící bulk taky", () => {
  const rychle = spocitejBlok({
    posledni: rep("2026-09-01", 93.0, { nutrition: { kcal: 1950, protein: 160, dny_zapsano: 7 }, activity: { kroky: 10500 } }),
    predchozi: rep("2026-08-25", 95.0),
    cile: CILE,
  });
  const n1 = navrhni({ cisla: rychle.cisla, predchoziCisla: null, smer: "hubnuti", pohlavi: "m" });
  tvrd(n1.paka === "kcal_nahoru", "2 kg za týden je moc, příjem jde nahoru (je " + n1.paka + ")");
  tvrd(n1.novyKcal === 2100, "2000 +" + PRIDANI_PCT + " % je 2100 (je " + n1.novyKcal + ")");

  const bulk = spocitejBlok({
    posledni: rep("2026-09-01", 80.0, { nutrition: { kcal: 2000, protein: 160, dny_zapsano: 7 }, activity: { kroky: 10500 } }),
    predchozi: rep("2026-08-25", 80.0),
    cile: CILE,
  });
  const n2 = navrhni({ cisla: bulk.cisla, predchoziCisla: null, smer: "nabirani", pohlavi: "m" });
  tvrd(n2.paka === "kcal_nahoru", "stojící nabírání přidává kalorie (je " + n2.paka + ")");

  // Neznámý směr: nikdy si nic nedomýšlet.
  const n3 = navrhni({ cisla: bulk.cisla, predchoziCisla: null, smer: "", pohlavi: "m" });
  tvrd(n3.paka === "zadna" && n3.jistota === "chybi_data", "bez směru se o kaloriích nerozhoduje");

  // Bez cíle není co upravovat.
  const n4 = navrhni({ cisla: Object.assign({}, bulk.cisla, { kcalCil: null }), smer: "hubnuti", pohlavi: "m" });
  tvrd(n4.paka === "zadna" && n4.jistota === "chybi_data", "bez zadání se nové číslo nevymýšlí");
});

// ---------------------------------------------------------------------------
console.log("\n" + (chyb ? "❌ " + chyb + " nesedí, " + ok + " OK" : "✅ všech " + ok + " kontrol sedí"));
process.exit(chyb ? 1 : 0);
