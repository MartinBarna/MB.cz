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
  PASMO_KCAL_POD_PCT, NEVEROHODNY_KCAL_STROP, UNAVA_HLAD_STOP, MIRA_POKLES_CM,
  RYCHLE_MAX_KG_TYDEN, PODLAHA,
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
// SCÉNÁŘE 6 AŽ 11 PŘIBYLY PO ADVERSÁRNÍ REVIZI 2. 9. 2026. Každý z nich byl PŘED
// opravou vidět naživo: engine v něm doporučil řez kalorií, který by appka nikdy
// nevydala. Test drží paritu s `proposeAdjustment` v appce (`src/lib/engine/engine.ts`).

scenar("6) Nevěrohodně nízký zápis: NIKDY se neřeže (appka: plaus.implausiblyLow)", () => {
  // Jí prý o 27 % míň, než má, a přesto stojí. Před opravou: kcal_dolu na 1870.
  const b = spocitejBlok({
    posledni: rep("2026-09-01", 92.0, { nutrition: { kcal: 1450, protein: 150, dny_zapsano: 7 }, activity: { kroky: 10500 } }),
    predchozi: rep("2026-08-25", 92.0),
    cile: { kcal: 1990, protein: 160, kroky: 10000 },
  });
  const n = navrhni({ cisla: b.cisla, predchoziCisla: { tempoPct: 0 }, smer: "hubnuti", pohlavi: "m" });
  tvrd(n.paka === "zadna", "hluboko pod cílem se NEŘEŽE (je " + n.paka + ")");
  tvrd(n.novyKcal === null, "a nenavrhuje se žádné nové číslo");
  tvrd(n.jistota === "neverohodny_zapis", "důvod je nevěrohodný zápis (je " + n.jistota + ")");
  tvrd(n.duvod.indexOf("sedí na cíli") === -1, "a nikde netvrdí, že příjem sedí na cíli");
  tvrd(PASMO_KCAL_POD_PCT === 15, "práh 'hluboko pod cílem' je 15 %");

  // Druhá půlka téhož pravidla, převzatá z appky 1:1: zápis na tvrdé podlaze 1200.
  const naPodlaze = spocitejBlok({
    posledni: rep("2026-09-01", 92.0, { nutrition: { kcal: 1180, protein: 150, dny_zapsano: 7 }, activity: { kroky: 10500 } }),
    predchozi: rep("2026-08-25", 92.0),
    cile: { kcal: 1250, protein: 160, kroky: 10000 },
  });
  const n2 = navrhni({ cisla: naPodlaze.cisla, predchoziCisla: { tempoPct: 0 }, smer: "hubnuti", pohlavi: "z" });
  tvrd(n2.jistota === "neverohodny_zapis", "zápis na podlaze 1200 při stojícím těle je taky nevěrohodný");
  tvrd(NEVEROHODNY_KCAL_STROP === 1200, "strop je 1200, shodně s HARD_KCAL_FLOOR_DEFAULT appky");

  // ⛔ Ale když tělo KLESÁ, nízký zápis nevěrohodný není a pravidlo se neuplatní.
  const klesa = spocitejBlok({
    posledni: rep("2026-09-01", 91.2, { nutrition: { kcal: 1450, protein: 150, dny_zapsano: 7 }, activity: { kroky: 10500 } }),
    predchozi: rep("2026-08-25", 92.0),
    cile: { kcal: 1990, protein: 160, kroky: 10000 },
  });
  const n3 = navrhni({ cisla: klesa.cisla, predchoziCisla: { tempoPct: -0.9 }, smer: "hubnuti", pohlavi: "m" });
  tvrd(n3.jistota !== "neverohodny_zapis", "u klesajícího těla se zápis za nevěrohodný neoznačuje");
});

// ---------------------------------------------------------------------------
scenar("7) Rekompozice: váha stojí, míry dolů, engine NEŘEŽE (appka: detectRecomp)", () => {
  const stav = {
    posledni: rep("2026-09-01", 92.0, {
      miry: { pas: 101 },
      nutrition: { kcal: 1990, protein: 160, dny_zapsano: 7 }, activity: { kroky: 10500 },
    }),
    predchozi: rep("2026-08-25", 92.0, { miry: { pas: 104 } }),
    predpredchozi: rep("2026-08-18", 92.0, { miry: { pas: 105 } }),
    prvni: rep("2026-06-08", 103.0, { miry: { pas: 112 } }),
    cile: { kcal: 1990, protein: 160, kroky: 10000 },
    smer: "hubnuti", pohlavi: "m",
  };
  const f = pripravFakta(stav);
  tvrd(f.navrh.paka === "zadna", "při rekompozici se nic nemění (je " + f.navrh.paka + ")");
  tvrd(f.navrh.jistota === "recomp", "a je to pojmenované jako rekompozice (je " + f.navrh.jistota + ")");
  tvrd(f.navrh.duvod.indexOf("rekompozice") !== -1, "důvod to říká Martinovi nahlas");
  tvrd(MIRA_POKLES_CM === 0.5, "práh poklesu míry je 0,5 cm, shodně s appkou");

  // Kontrola opačným směrem: stojící váha BEZ poklesu míry rekompozice není.
  const bez = pripravFakta({
    posledni: rep("2026-09-01", 92.0, { miry: { pas: 104 }, nutrition: { kcal: 1990, protein: 160, dny_zapsano: 7 }, activity: { kroky: 10500 } }),
    predchozi: rep("2026-08-25", 92.0, { miry: { pas: 104 } }),
    predpredchozi: rep("2026-08-18", 92.0, { miry: { pas: 104 } }),
    cile: { kcal: 1990, protein: 160, kroky: 10000 }, smer: "hubnuti", pohlavi: "m",
  });
  tvrd(bez.navrh.jistota !== "recomp", "beze změny měr to rekompozice není");
});

// ---------------------------------------------------------------------------
scenar("8) Únava a hlad 5/5: deficit se NEPROHLUBUJE (appka: subjectiveGuardrail)", () => {
  const stav = {
    posledni: rep("2026-09-01", 92.0, {
      nutrition: { kcal: 1990, protein: 160, dny_zapsano: 7 }, activity: { kroky: 10500 },
      scales: { unava: 5, hlad: 5 },
    }),
    predchozi: rep("2026-08-25", 92.0, { scales: { unava: 5, hlad: 5 } }),
    predpredchozi: rep("2026-08-18", 92.0, { scales: { unava: 5, hlad: 5 } }),
    cile: { kcal: 1990, protein: 160, kroky: 10000 }, smer: "hubnuti", pohlavi: "m",
  };
  const f = pripravFakta(stav);
  tvrd(f.navrh.paka === "zadna", "s únavou a hladem 5/5 se neřeže (je " + f.navrh.paka + ")");
  tvrd(f.navrh.novyKcal === null, "a nepadá žádné nové číslo");
  tvrd(f.navrh.jistota === "diet_break", "dva týdny v řadě eskalují na diet break (je " + f.navrh.jistota + ")");
  tvrd(f.navrh.duvod.indexOf("diet break") !== -1, "diet break je ve větě důvodu pojmenovaný");
  tvrd(UNAVA_HLAD_STOP === 4, "práh je 4 z 5, shodně s FATIGUE_HIGH a HUNGER_HIGH appky");

  // Jen jeden týden: brzda platí, ale diet break se ještě nenabízí.
  const jeden = pripravFakta(Object.assign({}, stav, { predchozi: rep("2026-08-25", 92.0, { scales: { unava: 2, hlad: 2 } }) }));
  tvrd(jeden.navrh.paka === "zadna", "i po jednom týdnu se deficit neprohlubuje");
  tvrd(jeden.navrh.jistota === "guardrail", "ale je to jen brzda, ne diet break (je " + jeden.navrh.jistota + ")");

  // Přesně na prahu 4 to platí taky, pod ním ne.
  const ctyri = navrhni({ cisla: Object.assign({}, f.cisla, { unava: 4, hlad: 1 }), predchoziCisla: null, smer: "hubnuti", pohlavi: "m" });
  tvrd(ctyri.jistota === "guardrail", "únava 4 z 5 brzdu spouští");
  const tri = navrhni({ cisla: Object.assign({}, f.cisla, { unava: 3, hlad: 3 }), predchoziCisla: { tempoPct: 0 }, smer: "hubnuti", pohlavi: "m" });
  tvrd(tri.jistota !== "guardrail" && tri.jistota !== "diet_break", "únava 3 z 5 brzdu nespouští");
});

// ---------------------------------------------------------------------------
scenar("9) Podlaha kcal se nikdy neodhaduje, drží paritu s appkou (1200 ž / 1500 m)", () => {
  tvrd(PODLAHA.z === 1200 && PODLAHA.m === 1500, "podlahy jsou 1200 žena a 1500 muž");
  tvrd(podlaha("") === 1500 && podlaha(undefined) === 1500, "neznámé pohlaví bere PŘÍSNĚJŠÍ 1500");
  tvrd(podlaha("z") === 1200 && podlaha("m") === 1500, "vybrané pohlaví se respektuje");
});

// ---------------------------------------------------------------------------
scenar("10) Bezpečnostní páka platí i bez vybraného směru a má strop v kg", () => {
  // 2 kg za týden u 95 kg, ale směr Martin nevybral. Dřív engine mlčel.
  const b = spocitejBlok({
    posledni: rep("2026-09-01", 93.0, { nutrition: { kcal: 1950, protein: 160, dny_zapsano: 7 }, activity: { kroky: 10500 } }),
    predchozi: rep("2026-08-25", 95.0),
    cile: { kcal: 2000, protein: 160, kroky: 10000 },
  });
  const n = navrhni({ cisla: b.cisla, predchoziCisla: null, smer: "", pohlavi: "m" });
  tvrd(n.paka === "prilis_rychle", "rychlý úbytek se pojmenuje i bez směru (je " + n.paka + ")");
  tvrd(n.novyKcal === null, "ale konkrétní číslo se bez směru nevymýšlí");

  // Strop je MENŠÍ z 1 % váhy a 1 kg (appka: maxCutRateKgPerWeek). U 120 kg tedy 1 kg.
  const tezky = spocitejBlok({
    posledni: rep("2026-09-01", 118.9, { nutrition: { kcal: 2400, protein: 160, dny_zapsano: 7 }, activity: { kroky: 10500 } }),
    predchozi: rep("2026-08-25", 120.0),
    cile: { kcal: 2400, protein: 160, kroky: 10000 },
  });
  const n2 = navrhni({ cisla: tezky.cisla, predchoziCisla: null, smer: "hubnuti", pohlavi: "m" });
  tvrd(n2.paka === "kcal_nahoru", "1,1 kg u 120 kg je nad stropem 1 kg, i když je to jen 0,9 % (je " + n2.paka + ")");
  tvrd(RYCHLE_MAX_KG_TYDEN === 1.0, "absolutní strop je 1 kg za týden, shodně s MAX_RATE_KG_PER_WEEK");
});

// ---------------------------------------------------------------------------
scenar("11) První report: žádná díra ve větě ani řádek 'od startu 0 kg'", () => {
  const prvniRep = rep("2026-09-01", 92.0, { nutrition: { kcal: 1990, protein: 160, dny_zapsano: 7 }, activity: { kroky: 10500 } });
  const f = pripravFakta({ posledni: prvniRep, predchozi: null, prvni: prvniRep, cile: { kcal: 1990, protein: 160, kroky: 10000 }, smer: "hubnuti", pohlavi: "m" });
  tvrd(f.text.indexOf("Od startu") === -1, "u prvního reportu se řádek 'od startu' nepíše");
  tvrd(f.navrh.duvod.indexOf("( ") === -1 && f.navrh.duvod.indexOf("()") === -1, "ve větě není prázdná závorka");
  tvrd(f.navrh.duvod.indexOf("  ") === -1, "ani dvojitá mezera");
  tvrd(f.text.indexOf("\u2014") === -1, "a nikde dlouhá pomlčka");

  // Tempo z jednoho vážení se přizná, tempo z průměru tří ne.
  const jedno = pripravFakta({
    posledni: rep("2026-09-01", 92.0, { nutrition: { kcal: 1990, protein: 160, dny_zapsano: 7 }, activity: { kroky: 10500 } }),
    predchozi: rep("2026-08-25", 92.0),
    predpredchozi: rep("2026-08-18", 92.0),
    cile: { kcal: 1990, protein: 160, kroky: 10000 }, smer: "hubnuti", pohlavi: "m",
  });
  tvrd(jedno.cisla.tempoZdroj === "jedno_vazeni", "se dvěma váženími je zdroj 'jedno_vazeni' (je " + jedno.cisla.tempoZdroj + ")");
  const prumer = pripravFakta({
    posledni: rep("2026-09-01", 92.0, { nutrition: { kcal: 1990, protein: 160, dny_zapsano: 7 }, activity: { kroky: 10500 } }),
    predchozi: rep("2026-08-25", 92.0),
    drive: [rep("2026-08-25", 92.0), rep("2026-08-18", 92.2), rep("2026-08-11", 92.4), rep("2026-08-04", 92.6)],
    cile: { kcal: 1990, protein: 160, kroky: 10000 }, smer: "hubnuti", pohlavi: "m",
  });
  tvrd(prumer.cisla.tempoZdroj === "prumer3", "se čtyřmi váženími se počítá klouzavý průměr (je " + prumer.cisla.tempoZdroj + ")");
});

// ---------------------------------------------------------------------------
console.log("\n" + (chyb ? "❌ " + chyb + " nesedí, " + ok + " OK" : "✅ všech " + ok + " kontrol sedí"));
process.exit(chyb ? 1 : 0);
