// =============================================================================
// ENGINE POČÍTÁ, AI MLUVÍ: deterministický blok čísel + doporučení k týdennímu reportu.
//
// Proc vlastni soubor a proc `.mjs`, ne `.ts`:
//   • edge funkce `admin-api` (Deno) tenhle modul importuje,
//   • test `scripts/report-reakce-test.mjs` (Node) importuje TENTÝŽ soubor.
//   Jedno místo pravdy. Kdyby to bylo `.ts`, Node by to bez build kroku nespustil; `.js` by zas Node bez
//   package.json cetl jako CommonJS a `export` by byla syntakticka chyba, proto `.mjs`
//   a vznikla by druhá kopie pravidel, což je přesně past, které se tu vyhýbáme.
//
// ⛔ TENHLE SOUBOR NESMÍ POUŽÍT ŽÁDNÉ Deno.* ANI process.* API. Je to čistá matematika
//    nad hodnotami, které mu někdo podá. Jinak přestane běžet na jedné ze dvou stran.
//
// ⛔ ČÍSLA ODSUD SE MODELU PŘEDÁVAJÍ JAKO HOTOVÁ FAKTA. Model je smí jen okomentovat.
//    Nikdy nesmí dopočítávat, přepočítávat ani měnit cíle.
//
// Pravidla úprav jsou zjednodušený, ale POŘADÍM SHODNÝ výtah z enginu appky Tvůj Coach
// (`src/lib/engine/engine.ts`, funkce `proposeAdjustment`): bezpečnost → přesnost →
// aktivita → kalorie. Kdo mění pořadí tady, ať se nejdřív podívá tam, jinak bude Academy
// radit něco jiného než appka témuž člověku.
// =============================================================================

/** Tvrdá kalorická podlaha. Shodná s appkou: `kcalFloorForSex` v `src/engine/goals.ts`
 *  (větev `p41-nad-p28`, tedy produkce appky) vrací 1200 pro ženu a 1500 pro muže i „other".
 *  ⚠️ V `master` appky ta funkce NENÍ, přibyla 2. 9. 2026 (nález E19). Kdo si ji grepne
 *  ve špatné větvi, dojde k závěru, že tenhle komentář lže. Nelže, jen se musí hledat
 *  v té větvi, ze které se appka nasazuje.
 *  ⛔ Neznámé pohlaví bere PŘÍSNĚJŠÍ hodnotu (1500), pod ni se pak nesmí. Pohlaví se
 *  nikdy neodhaduje z jména, vybírá ho Martin v adminu. */
export const PODLAHA = { z: 1200, m: 1500, neznamo: 1500 };

/** Kolik procent od cíle je „drží to". Nad tím se to už komentuje. */
export const PASMO_KCAL_PCT = 5;
/** Pod kolik procent cíle musí kroky spadnout, aby to byla páka „aktivita". */
export const KROKY_PROPAD_PCT = 20;
/** Kolik dní ze sedmi musí být zapsáno, aby se čísla o jídle daly brát vážně. */
export const DNY_ZAPISU_MIN = 6;
/** Změna váhy pod tímhle tempem (% váhy za týden) je stagnace, ne pohyb. */
export const STAGNACE_PCT_TYDEN = 0.3;
/** Nad tímhle tempem (% váhy za týden) se hubne moc rychle a příjem se ZVEDÁ.
 *  Shodné s appkou: `CUT_RATE_MAX_PCT = 1.0` v `src/engine/goals.ts`. */
export const RYCHLE_PCT_TYDEN = 1.0;
/** ⛔ A zároveň absolutní strop v kg za týden. Appka bere MENŠÍ z obou
 *  (`maxCutRateKgPerWeek` = min(`MAX_RATE_KG_PER_WEEK` 1,0 kg; 1 % váhy)). Bez tohohle
 *  čísla by Academy u klienta se 120 kg spustila pojistku až na 1,2 kg za týden, kdežto
 *  appka už na 1,0 kg, a dva systémy by témuž člověku řekly dvě různé věci. */
export const RYCHLE_MAX_KG_TYDEN = 1.0;
/** Kolik procent POD cílem už znamená nevěrohodný zápis. ⛔ NENÍ převzaté z appky:
 *  appka pozná nevěrohodný zápis přes implikované TDEE pod BMR (`assessLogPlausibility`),
 *  a BMR ani výdej tady k dispozici nejsou. Je to tedy náhradní míra téhož a Martin ji
 *  má vidět. Smysl je shodný s appkou: na nevěrohodně nízký zápis se NIKDY neřeže. */
export const PASMO_KCAL_POD_PCT = 15;
/** Druhá, tvrdá půlka téhož pravidla, tahle UŽ převzatá z appky 1:1:
 *  `HARD_KCAL_FLOOR_DEFAULT = 1200` (`src/lib/engine/config.ts`). Zapsaný průměr na téhle
 *  hodnotě nebo pod ní, a tělo se přitom nehýbe, je podle appky nevěrohodný zápis.
 *  ⛔ Schválně 1200 pro obě pohlaví, ne podlaha podle pohlaví: appka to má okomentované
 *  na témže místě. Jinak by poctivý muž s 1400 kcal a stojící váhou dostal poučení
 *  o přesnosti místo řešení výdeje. */
export const NEVEROHODNY_KCAL_STROP = 1200;
/** Únava nebo hlad na tolik a víc z 5 = deficit se neprohlubuje. Appka 1:1:
 *  `FATIGUE_HIGH` a `HUNGER_HIGH` = 4 (`src/lib/engine/config.ts`).
 *  ⛔ Škála v Academy je „1 = nejlíp, 5 = nejhůř" (`akademie/klient/index.html`), stejně
 *  jako u appky pro únavu a hlad. U SÍLY je to naopak (appka `STRENGTH_LOW: 2` = málo),
 *  proto se síla tady záměrně nepoužívá. */
export const UNAVA_HLAD_STOP = 4;
/** Kolik týdnů v řadě musí subjektivní brzda držet, aby se nabídl diet break.
 *  Appka 1:1: `GUARDRAIL_ESCALATE_WEEKS = 2`. */
export const GUARDRAIL_ESKALACE_TYDNU = 2;
/** Pokles míry o tolik cm za týden a víc je validní signál „jde to dolů".
 *  Appka 1:1: `MEASURE_DROP_CM_PER_WEEK = 0.5`. */
export const MIRA_POKLES_CM = 0.5;
/** O kolik se sahá na kalorie. Zadání: 5 až 8 % dolů, 5 % nahoru. */
export const REZ_PCT = 6;
export const PRIDANI_PCT = 5;
/** Pod tolik kroků za den je to skoro jistě překlep, ne život. (Změřeno: jeden report
 *  má v kolonce průměrných denních kroků hodnotu 52.) S takovým číslem se nepočítá. */
export const KROKY_NESMYSL = 500;

// ---------- malé pomůcky ----------

/** Číslo z JSONu. Prázdno a null zůstávají null, NIKDY ne nula. Desetinná čárka projde. */
export function cislo(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
/** Česky psané číslo. `null` je „neuvedeno", ne 0. */
export function fmt(v, jed) {
  if (v === null || v === undefined) return "neuvedeno";
  const s = (Math.round(v * 10) / 10).toString().replace(".", ",");
  return jed ? s + " " + jed : s;
}
/** Rozdíl se znaménkem: „-0,6", „+1,2", „0". Krátký minus, dlouhá pomlčka nikde. */
export function delta(v, jed) {
  if (v === null || v === undefined) return "";
  const z = Math.round(v * 10) / 10;
  return (z > 0 ? "+" : z < 0 ? "-" : "") + fmt(Math.abs(z), jed);
}
const j = (r, k) => (r && r[k] ? r[k] : {});
/** Kolik týdnů uplynulo mezi dvěma reporty. Nikdy nevrací 0 (dělilo by se nulou). */
export function tydnuMezi(dA, dB) {
  const a = Date.parse(String(dA) + "T12:00:00Z"), b = Date.parse(String(dB) + "T12:00:00Z");
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  return Math.max(0.5, Math.abs(a - b) / (7 * 86400000));
}
/** Kroky, které dávají smysl. Překlep vrací null, ne nulu. */
export function krokyRozumne(v) {
  const n = cislo(v);
  if (n === null) return null;
  return n < KROKY_NESMYSL ? null : n;
}

// ---------- 1) blok čísel ----------

/**
 * Deterministický blok FAKTA. Nic tu není odhad, všechno je rozdíl dvou uložených hodnot.
 * @param {{posledni:object, predchozi?:object|null, predpredchozi?:object|null,
 *          prvni?:object|null, cile?:object|null, pohlavi?:string}} v
 */
export function spocitejBlok(v) {
  const r = v.posledni || {};
  const prev = v.predchozi || null;
  const prvni = v.prvni || null;
  const cile = v.cile || null;
  const c = (k) => (cile ? cislo(cile[k]) : null);

  const m = j(r, "measurements"), n = j(r, "nutrition"), a = j(r, "activity"), s = j(r, "scales");
  const mPrev = prev ? j(prev, "measurements") : {};
  const mPrvni = prvni ? j(prvni, "measurements") : {};

  const vaha = cislo(r.weight);
  const vahaPrev = prev ? cislo(prev.weight) : null;
  const vahaPrvni = prvni ? cislo(prvni.weight) : null;
  const zmenaOdMinule = vaha !== null && vahaPrev !== null ? Math.round((vaha - vahaPrev) * 10) / 10 : null;
  const zmenaOdStartu = vaha !== null && vahaPrvni !== null ? Math.round((vaha - vahaPrvni) * 10) / 10 : null;
  const tydnu = prev ? tydnuMezi(r.report_date, prev.report_date) : 1;

  // Tempo v procentech váhy za týden. Bez něj se stejná ztráta 0,8 kg čte u 60 kg jinak než u 110 kg.
  //
  // ⭐ POČÍTÁ SE Z KLOUZAVÉHO PRŮMĚRU TŘÍ VÁŽENÍ, když jsou k dispozici. Appka to dělá
  // stejně (`TRAILING_WEEKS_DEFAULT = 3`), a má to důvod: dvě po sobě jdoucí vážení
  // „po sobotě" umí trend zamaskovat i vyrobit. Když tři vážení nejsou, spadne se na
  // rozdíl dvou a `tempoZdroj` je „jedno_vazeni"; tuhle nejistotu pak pravidla nahlas
  // pojmenují, místo aby se tvářila jako měření.
  const rada = [vaha, vahaPrev].concat(
    (Array.isArray(v.drive) ? v.drive : []).slice(1).map((x) => cislo(x && x.weight)),
  );
  const prum = (pole) => {
    const y = pole.filter((x) => x !== null && x !== undefined);
    return y.length ? y.reduce((a, b) => a + b, 0) / y.length : null;
  };
  const oknoTeď = rada.slice(0, 3), oknoMinule = rada.slice(1, 4);
  let tempoPct = null, tempoZdroj = "zadne";
  if (oknoTeď.length === 3 && oknoMinule.length === 3 &&
      oknoTeď.every((x) => x !== null) && oknoMinule.every((x) => x !== null)) {
    const a = prum(oknoTeď), b = prum(oknoMinule);
    tempoPct = b ? ((a - b) / b) * 100 / tydnu : null;
    tempoZdroj = tempoPct === null ? "zadne" : "prumer3";
  } else if (zmenaOdMinule !== null && vahaPrev) {
    tempoPct = (zmenaOdMinule / vahaPrev) * 100 / tydnu;
    tempoZdroj = "jedno_vazeni";
  }

  const MIRY = [["prsa", "hruď"], ["pas", "pas"], ["boky", "boky"], ["zadek", "zadek"],
    ["p_stehno", "pravé stehno"], ["l_stehno", "levé stehno"], ["pupik", "pupík"]];
  const miry = [];
  for (const [k, jm] of MIRY) {
    const teď = cislo(m[k]);
    if (teď === null) continue;
    const p = cislo(mPrev[k]), st = cislo(mPrvni[k]);
    miry.push({
      klic: k, nazev: jm, hodnota: teď,
      odMinule: p !== null ? Math.round((teď - p) * 10) / 10 : null,
      odStartu: st !== null ? Math.round((teď - st) * 10) / 10 : null,
    });
  }

  const dny = cislo(n.dny_zapsano);
  const kcal = cislo(n.kcal), protein = cislo(n.protein), fiber = cislo(n.fiber);
  // Starý import z Excelu nemá `sport_min`, ale má `fitko_min` + `kardio_min` (táž jednotka).
  let sportMin = cislo(a.sport_min);
  if (sportMin === null && (cislo(a.fitko_min) !== null || cislo(a.kardio_min) !== null)) {
    sportMin = (cislo(a.fitko_min) || 0) + (cislo(a.kardio_min) || 0);
  }
  const kroky = krokyRozumne(a.kroky);
  const krokyPodezrele = kroky === null && cislo(a.kroky) !== null;

  const cisla = {
    datum: String(r.report_date || ""),
    vaha, vahaPrev, vahaPrvni, zmenaOdMinule, zmenaOdStartu, tempoPct, tempoZdroj,
    tydnuOdMinule: tydnu,
    miry,
    dnyZapsano: dny, kcal, protein, fiber,
    kcalCil: c("kcal"), proteinCil: c("protein"), fiberCil: c("fiber"),
    kroky, krokyCil: c("kroky"), krokyPodezrele,
    sportMin, sportCil: c("sport_min"),
    treninky: cislo(a.fitko), treninkyCil: c("treninky"),
    spanekH: cislo(s.spanek_h), spanekKvalita: cislo(s.spanek_kvalita),
    unava: cislo(s.unava), hlad: cislo(s.hlad), dodrzeni: cislo(s.dodrzeni),
    // Odchylky v procentech. `null` znamená „nemám cíl", ne „sedí to".
    kcalOdchylkaPct: (kcal !== null && c("kcal")) ? Math.round(((kcal - c("kcal")) / c("kcal")) * 1000) / 10 : null,
    proteinRozdil: (protein !== null && c("protein") !== null) ? Math.round((protein - c("protein")) * 10) / 10 : null,
    krokyRozdil: (kroky !== null && c("kroky") !== null) ? Math.round(kroky - c("kroky")) : null,
  };

  // Řádky ve tvaru, v jakém je Martin píše do mailu. Tenhle text jde 1:1 do konceptu,
  // takže se čísla nikdy nemusí projít modelem.
  const radky = [];
  if (vaha !== null) {
    let t = "Váha " + fmt(vaha, "kg");
    if (zmenaOdMinule !== null) t += " (od minule " + delta(zmenaOdMinule, "kg") + ")";
    radky.push(t);
  }
  // ⛔ U ÚPLNĚ PRVNÍHO reportu je „první" tentýž řádek jako „poslední", takže by tu svítilo
  // „Od startu 0 kg (start 92 kg)". To není informace, to je šum, a jde i modelu do promptu.
  const prvniJeTenhle = !!(prvni && String(prvni.report_date || "") === String(r.report_date || ""));
  if (zmenaOdStartu !== null && !(prvniJeTenhle && zmenaOdStartu === 0)) {
    radky.push("Od startu " + delta(zmenaOdStartu, "kg") + " (start " + fmt(vahaPrvni, "kg") + ")");
  }
  for (const x of miry) {
    let t = x.nazev.charAt(0).toUpperCase() + x.nazev.slice(1) + " " + fmt(x.hodnota, "cm");
    const cast = [];
    if (x.odMinule !== null) cast.push("minule " + fmt(x.hodnota - x.odMinule, "") + ", " + delta(x.odMinule, "cm"));
    if (x.odStartu !== null) cast.push("od startu " + delta(x.odStartu, "cm"));
    if (cast.length) t += " (" + cast.join("; ") + ")";
    radky.push(t);
  }
  if (dny !== null) radky.push("Zápis " + fmt(dny) + " ze 7 dní");
  if (kcal !== null) {
    radky.push("Průměr " + fmt(kcal, "kcal") +
      (cisla.kcalCil ? " (cíl " + fmt(cisla.kcalCil, "kcal") + ", " + delta(kcal - cisla.kcalCil, "kcal") + ")" : ""));
  }
  if (protein !== null) {
    radky.push("Bílkoviny " + fmt(protein, "g") +
      (cisla.proteinCil !== null ? " (cíl " + fmt(cisla.proteinCil, "g") + ", " + delta(cisla.proteinRozdil, "g") + ")" : ""));
  }
  if (kroky !== null) {
    radky.push("Kroky " + fmt(kroky) +
      (cisla.krokyCil !== null ? " (plán " + fmt(cisla.krokyCil) + ", " + delta(cisla.krokyRozdil) + ")" : ""));
  } else if (krokyPodezrele) {
    radky.push("Kroky: v reportu je " + fmt(cislo(a.kroky)) + ", což na denní průměr nesedí. Neberu to jako číslo, zeptej se ho.");
  }
  if (cisla.treninky !== null) {
    radky.push("Tréninky " + fmt(cisla.treninky, "x") +
      (cisla.treninkyCil !== null ? " (plán " + fmt(cisla.treninkyCil, "x") + ")" : ""));
  }
  if (sportMin !== null) radky.push("Sport " + fmt(sportMin, "min za týden"));
  if (cisla.spanekH !== null || cisla.spanekKvalita !== null) {
    radky.push("Spánek " + (cisla.spanekH !== null ? fmt(cisla.spanekH, "h") : "hodiny neuvedeny") +
      (cisla.spanekKvalita !== null ? ", kvalita " + fmt(cisla.spanekKvalita) + "/5" : ""));
  }

  return { cisla, radky, text: radky.join("\n") };
}

// ---------- 2) doporučení pravidlem ----------

/** Podlaha podle pohlaví. Neznámé pohlaví bere přísnější číslo. */
export function podlaha(pohlavi) {
  return pohlavi === "z" ? PODLAHA.z : pohlavi === "m" ? PODLAHA.m : PODLAHA.neznamo;
}

/**
 * Návrh úpravy zadání. ⛔ NIC NEUKLÁDÁ a nic neodesílá, jen vrací návrh pro Martina.
 *
 * Pořadí pák je shodné s enginem appky:
 *   0. bezpečnost (hubne moc rychle) → PŘIDAT kalorie
 *   1. přesnost (málo zapsaných dní nebo příjem nad cíl) → cíle nechat, řešit zápis
 *   2. aktivita (kroky hluboko pod plánem) → cíle nechat, řešit kroky
 *   3. kalorie (všechno ostatní sedí a tělo se nehýbe) → sáhnout na cíl
 *
 * @param {{cisla:object, predchoziCisla?:object|null, smer?:string, pohlavi?:string}} v
 *        `smer` je 'hubnuti' | 'udrzeni' | 'nabirani' | '' (neznámo).
 * @returns {{paka:string, novyKcal:number|null, duvod:string, jistota:string}}
 */
export function navrhni(v) {
  const c = v.cisla || {};
  const pc = v.predchoziCisla || null;
  const smer = v.smer || "";
  const cil = c.kcalCil;
  const dno = podlaha(v.pohlavi);

  const nic = (duvod, jistota) => ({ paka: "zadna", novyKcal: null, duvod, jistota: jistota || "jista" });

  // ⛔ Bez cíle není co upravovat. Návrh nového čísla by byl vymyšlený.
  if (!cil) {
    return nic("Klient nemá v zadání kalorie, takže není co upravit. Nastav mu zadání, pak to půjde počítat.", "chybi_data");
  }

  const stagnuje = c.tempoPct !== null && c.tempoPct !== undefined && Math.abs(c.tempoPct) < STAGNACE_PCT_TYDEN;
  const stagnovalMinule = pc && pc.tempoPct !== null && pc.tempoPct !== undefined && Math.abs(pc.tempoPct) < STAGNACE_PCT_TYDEN;
  const zapisOk = c.dnyZapsano !== null && c.dnyZapsano >= DNY_ZAPISU_MIN;
  const nadCil = c.kcalOdchylkaPct !== null && c.kcalOdchylkaPct > PASMO_KCAL_PCT;
  const krokyPropad = c.krokyRozdil !== null && c.krokyCil
    ? (-c.krokyRozdil / c.krokyCil) * 100 > KROKY_PROPAD_PCT
    : false;
  // Klesající míra podle prahu appky. Tělo se hýbe i tehdy, když váha stojí.
  const miraKlesa = Array.isArray(c.miry) &&
    c.miry.some((x) => x.odMinule !== null && x.odMinule !== undefined && x.odMinule <= -MIRA_POKLES_CM);
  const vahaKlesa = c.tempoPct !== null && c.tempoPct !== undefined && c.tempoPct <= -STAGNACE_PCT_TYDEN;
  const teloKlesa = vahaKlesa || miraKlesa;
  // „Tempo z jednoho vážení" se nesmí tvářit jako měřený trend, viz `tempoZdroj`.
  const jenJednoVazeni = c.tempoZdroj === "jedno_vazeni";
  const dovetekVazeni = jenJednoVazeni
    ? " (Počítám to zatím z jednoho rozdílu vážení, ne z průměru tří, takže to ber s rezervou.)"
    : "";
  // Absolutní strop tempa v kg, sjednocený s appkou (`maxCutRateKgPerWeek`).
  const rychlyStropPct = (c.vahaPrev || c.vaha)
    ? Math.min(RYCHLE_PCT_TYDEN, (RYCHLE_MAX_KG_TYDEN / (c.vahaPrev || c.vaha)) * 100)
    : RYCHLE_PCT_TYDEN;
  const hubneRychle = c.tempoPct !== null && c.tempoPct !== undefined && c.tempoPct < -rychlyStropPct;

  // ⛔⛔ POŘADÍ PÁK JE SHODNÉ S APPKOU (`proposeAdjustment`, `src/lib/engine/engine.ts`):
  // rekompozice → nevěrohodný zápis → bezpečnost → subjektivní brzda → přesnost →
  // aktivita → kalorie. Kdo tady pořadí prohodí, ať se nejdřív podívá tam.

  // --- 1. REKOMPOZICE. Váha stojí, ale míra jde dolů: to není stagnace, to je výsledek.
  // Appka: `detectRecomp` (váha stojí A klesá aspoň jedna míra) → páka `none`,
  // důvod `recomp_success_no_deficit`.
  if (stagnuje && miraKlesa) {
    return nic("Váha stojí (" + (c.zmenaOdMinule === null ? "beze změny" : delta(c.zmenaOdMinule, "kg")) +
      "), ale míry jdou dolů. To není stagnace, to je rekompozice a přesně to chceme. " +
      "Zadání nechávám, tohle si řezem nemá cenu rozbíjet.", "recomp");
  }

  // --- 2. NEVĚROHODNĚ NÍZKÝ ZÁPIS. Kdo „jí" hluboko pod cílem a přesto stojí, nemá problém
  // v cíli, ale v zápisu. Řez by jen zvětšil rozdíl mezi papírem a talířem.
  // Appka: `plaus.implausiblyLow` → páka `accuracy`, NIKDY se neřeže.
  if (c.kcal !== null && !teloKlesa) {
    const hlubokoPod = c.kcalOdchylkaPct !== null && c.kcalOdchylkaPct < -PASMO_KCAL_POD_PCT;
    const naPodlaze = c.kcal <= NEVEROHODNY_KCAL_STROP;
    if (hlubokoPod || naPodlaze) {
      return nic("Zapsaný průměr je " + fmt(c.kcal, "kcal") +
        (c.kcalOdchylkaPct !== null ? " (o " + fmt(Math.abs(c.kcalOdchylkaPct)) + " % pod cílem " + fmt(cil, "kcal") + ")" : "") +
        " a tělo se přitom nehýbe. Takový zápis neberu jako přesný, takže cíl NEŘEŽU: " +
        "snížené číslo by rozdíl mezi papírem a talířem jen zvětšilo. Úkol na tenhle týden " +
        "je vážit porce a dopsat i to, co do zápisu obvykle nespadne." + dovetekVazeni,
        "neverohodny_zapis");
    }
  }

  // --- 3. BEZPEČNOST: hubne rychleji, než dovolíme. Platí bez ohledu na zápis, protože
  // rychlost úbytku měří váha, ne tabulka. Appka to má jako `tooFastLoss` nad guardrailem.
  // ⛔ Uplatní se I BEZ VYBRANÉHO SMĚRU: rychlý úbytek je fyzikálně tentýž problém bez
  // ohledu na to, co má klient v plánu. Bez směru se jen nenavrhne konkrétní nové číslo.
  if (hubneRychle && smer !== "nabirani") {
    const veta = "Ubývá " + fmt(Math.abs(c.tempoPct)) + " % váhy za týden, to je nad naší hranicí " +
      fmt(rychlyStropPct) + " % (strop je menší z 1 % váhy a 1 kg za týden, stejně jako v appce). ";
    if (smer !== "hubnuti") {
      return {
        paka: "prilis_rychle", novyKcal: null, jistota: "chybi_data",
        duvod: veta + "Nevím ale, jestli klient hubne, udržuje, nebo nabírá, takže konkrétní " +
          "číslo nenavrhuju. Vyber směr nad tlačítkem a spočítám ho." + dovetekVazeni,
      };
    }
    const novy = Math.round((cil * (1 + PRIDANI_PCT / 100)) / 10) * 10;
    return {
      paka: "kcal_nahoru", novyKcal: novy, jistota: "jista",
      duvod: veta + "Navrhuju zvednout příjem z " + fmt(cil, "kcal") + " na " + fmt(novy, "kcal") +
        " (+" + PRIDANI_PCT + " %), ať o to netratíme na svalech a na síle." + dovetekVazeni,
    };
  }

  // --- 4. SUBJEKTIVNÍ BRZDA. Vyřízený a hladový člověk další řez neudrží, ať čísla říkají
  // cokoli. Appka: `subjectiveGuardrail` (FATIGUE_HIGH / HUNGER_HIGH = 4) stojí NAD
  // aktivitou i kaloriemi a po GUARDRAIL_ESCALATE_WEEKS týdnech eskaluje na diet break.
  // ⛔ Síla se tu záměrně nepoužívá, má v Academy opačnou škálu než v appce.
  if (smer !== "nabirani" && smer !== "udrzeni") {
    const brzda = (x) => (x.unava !== null && x.unava !== undefined && x.unava >= UNAVA_HLAD_STOP) ||
      (x.hlad !== null && x.hlad !== undefined && x.hlad >= UNAVA_HLAD_STOP);
    if (brzda(c)) {
      const drziDruhyTyden = !!(pc && brzda(pc));
      const zaklad = "Únava " + fmt(c.unava) + " a hlad " + fmt(c.hlad) + " z 5. Deficit teď " +
        "neprohlubuju a zadání nechávám, takhle to nikdo dlouho neutáhne. ";
      return nic(
        drziDruhyTyden
          ? zaklad + "Drží to " + GUARDRAIL_ESKALACE_TYDNU + " týdny v řadě, takže bych rovnou " +
            "nabídl diet break: zhruba dva týdny na udržovačce a pak zpátky do deficitu. " +
            "(Appka to po " + GUARDRAIL_ESKALACE_TYDNU + " týdnech navrhuje sama.)"
          : zaklad + "Nejdřív probereme spánek, zátěž a rozložení jídel. Kdyby to drželo " +
            "i příští týden, na řadě je diet break, ne hlubší řez.",
        drziDruhyTyden ? "diet_break" : "guardrail");
    }
  }

  // --- 5. PŘESNOST. Sem patří i „zapsal málo dní": z pěti dnů se týdenní průměr nedá poskládat.
  if (!zapisOk) {
    return nic("Zapsáno " + (c.dnyZapsano === null ? "nic" : fmt(c.dnyZapsano) + " ze 7 dní") +
      ", takže týdenní průměr není z čeho počítat. Cíle nechávám a úkol na tenhle týden je zápis, ne jiná čísla.");
  }
  if (nadCil) {
    return nic("Průměr je o " + fmt(c.kcalOdchylkaPct) + " % nad cílem (" + fmt(c.kcal, "kcal") + " proti " + fmt(cil, "kcal") + "). " +
      "Cíl nechávám, není co snižovat, dokud se nedodrží tenhle. Úkol je přesnost, ne nové číslo.");
  }

  // --- 6. AKTIVITA. Kroky pod plánem jsou levnější páka než řez kalorií.
  if (krokyPropad && (stagnuje || c.tempoPct === null)) {
    return nic("Kroky jsou " + fmt(c.kroky) + " proti plánu " + fmt(c.krokyCil) + ", to je propad o víc než " +
      KROKY_PROPAD_PCT + " %. Než sáhnu na jídlo, chci zpátky kroky. Cíle nechávám.");
  }

  // --- 7. KALORIE.
  if (smer === "hubnuti" && stagnuje) {
    if (!stagnovalMinule && pc) {
      return nic("Váha stojí (" + delta(c.zmenaOdMinule, "kg") + "), ale jen tenhle týden. " +
        "Zápis i příjem sedí, takže bych ještě týden počkal a pak řezal. Kdyby to stálo i příště, jdeme dolů." +
        dovetekVazeni, "malo_dat");
    }
    if (!pc) {
      return nic("Váha stojí (" + delta(c.zmenaOdMinule, "kg") + "), ale nemám předchozí týden na porovnání. " +
        "Nechávám a potvrdíme to příštím reportem.", "malo_dat");
    }
    let novy = Math.round((cil * (1 - REZ_PCT / 100)) / 10) * 10;
    if (novy < dno) {
      return nic("Váha stojí druhý týden a příjem i zápis sedí, ale řez o " + REZ_PCT + " % by šel na " +
        fmt(novy, "kcal") + ", tedy pod podlahu " + fmt(dno, "kcal") + ". Kalorie neřežu. " +
        "Zbývá zvednout výdej (kroky, tréninky) nebo si sednout a probrat cíl.", "podlaha");
    }
    return {
      paka: "kcal_dolu", novyKcal: novy, jistota: "jista",
      duvod: "Váha stojí druhý týden v řadě a přitom je zapsáno " + fmt(c.dnyZapsano) + " ze 7 dní a příjem je " +
        "v pásmu " + PASMO_KCAL_PCT + " % kolem cíle. Tady už se to nesvede na přesnost, takže navrhuju " +
        fmt(cil, "kcal") + " na " + fmt(novy, "kcal") + " (-" + REZ_PCT + " %). Podlaha " + fmt(dno, "kcal") +
        " je pořád nad námi." + dovetekVazeni,
    };
  }
  if (smer === "nabirani" && stagnuje) {
    const novy = Math.round((cil * (1 + PRIDANI_PCT / 100)) / 10) * 10;
    return {
      paka: "kcal_nahoru", novyKcal: novy, jistota: "jista",
      duvod: "Nabíráme a váha stojí (" + delta(c.zmenaOdMinule, "kg") + ") při zápisu " + fmt(c.dnyZapsano) +
        " ze 7 dní. Navrhuju " + fmt(cil, "kcal") + " na " + fmt(novy, "kcal") + " (+" + PRIDANI_PCT + " %)." +
        dovetekVazeni,
    };
  }
  if (!smer) {
    return nic("Nevím, jestli klient hubne, udržuje, nebo nabírá, takže o kaloriích nic nenavrhuju. " +
      "Přepni směr nad tlačítkem a spočítám to.", "chybi_data");
  }

  // ⛔ Bez závorky, když předchozí report není: `delta(null)` je prázdný řetězec a vyšlo by
  // „Čísla jdou tam, kam mají ( od minule)" s dírou uprostřed. Vidí to Martin i model.
  return nic("Čísla jdou tam, kam mají" +
    (c.zmenaOdMinule === null ? "" : " (" + delta(c.zmenaOdMinule, "kg") + " od minule)") +
    ", zápis i příjem sedí. Nic bych neměnil, tohle je týden na potvrzení kurzu." + dovetekVazeni);
}

/** Obojí naráz. Vrací i hotový text bloku k vložení do mailu. */
export function pripravFakta(v) {
  // `drive` = starší reporty od nejnovějšího (drive[0] je `predchozi`). Slouží ke
  // klouzavému průměru váhy; když chybí, engine spadne na rozdíl dvou vážení a řekne to.
  const drive = Array.isArray(v.drive) ? v.drive : [v.predchozi, v.predpredchozi].filter(Boolean);
  const blok = spocitejBlok({ ...v, drive });
  const predchoziCisla = v.predchozi
    ? spocitejBlok({
        posledni: v.predchozi, predchozi: drive[1] || null, prvni: v.prvni || null,
        cile: v.cile, pohlavi: v.pohlavi, drive: drive.slice(1),
      }).cisla
    : null;
  const navrh = navrhni({ cisla: blok.cisla, predchoziCisla, smer: v.smer, pohlavi: v.pohlavi });
  return { ...blok, predchoziCisla, navrh };
}
