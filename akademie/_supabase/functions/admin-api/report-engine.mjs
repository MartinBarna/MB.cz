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

/** Tvrdá kalorická podlaha. Shodná s appkou (`kcalFloorForSex`): 1200 žena, 1500 muž.
 *  Neznámé pohlaví bere přísnější hodnotu, protože se pod ni pak nesmí. */
export const PODLAHA = { z: 1200, m: 1500, neznamo: 1500 };

/** Kolik procent od cíle je „drží to". Nad tím se to už komentuje. */
export const PASMO_KCAL_PCT = 5;
/** Pod kolik procent cíle musí kroky spadnout, aby to byla páka „aktivita". */
export const KROKY_PROPAD_PCT = 20;
/** Kolik dní ze sedmi musí být zapsáno, aby se čísla o jídle daly brát vážně. */
export const DNY_ZAPISU_MIN = 6;
/** Změna váhy pod tímhle tempem (% váhy za týden) je stagnace, ne pohyb. */
export const STAGNACE_PCT_TYDEN = 0.3;
/** Nad tímhle tempem (% váhy za týden) se hubne moc rychle a příjem se ZVEDÁ. */
export const RYCHLE_PCT_TYDEN = 1.0;
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
  const tempoPct = (zmenaOdMinule !== null && vahaPrev) ? (zmenaOdMinule / vahaPrev) * 100 / tydnu : null;

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
    vaha, vahaPrev, vahaPrvni, zmenaOdMinule, zmenaOdStartu, tempoPct, tydnuOdMinule: tydnu,
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
  if (zmenaOdStartu !== null) radky.push("Od startu " + delta(zmenaOdStartu, "kg") + " (start " + fmt(vahaPrvni, "kg") + ")");
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

  // --- 0. BEZPEČNOST: hubne rychleji než 1 % váhy za týden. Platí bez ohledu na zápis,
  // protože rychlost úbytku měří váha, ne tabulka. Zvedá se vždy, i když je jinak vše špatně.
  if (smer === "hubnuti" && c.tempoPct !== null && c.tempoPct < -RYCHLE_PCT_TYDEN) {
    const novy = Math.round((cil * (1 + PRIDANI_PCT / 100)) / 10) * 10;
    return {
      paka: "kcal_nahoru", novyKcal: novy, jistota: "jista",
      duvod: "Ubývá " + fmt(Math.abs(c.tempoPct)) + " % váhy za týden, to je nad naší hranicí 1 %. " +
        "Navrhuju zvednout příjem z " + fmt(cil, "kcal") + " na " + fmt(novy, "kcal") + " (+" + PRIDANI_PCT + " %), " +
        "ať o to netratíme na svalech a na síle.",
    };
  }

  // --- 1. PŘESNOST. Sem patří i „zapsal málo dní": z pěti dnů se týdenní průměr nedá poskládat.
  if (!zapisOk) {
    return nic("Zapsáno " + (c.dnyZapsano === null ? "nic" : fmt(c.dnyZapsano) + " ze 7 dní") +
      ", takže týdenní průměr není z čeho počítat. Cíle nechávám a úkol na tenhle týden je zápis, ne jiná čísla.");
  }
  if (nadCil) {
    return nic("Průměr je o " + fmt(c.kcalOdchylkaPct) + " % nad cílem (" + fmt(c.kcal, "kcal") + " proti " + fmt(cil, "kcal") + "). " +
      "Cíl nechávám, není co snižovat, dokud se nedodrží tenhle. Úkol je přesnost, ne nové číslo.");
  }

  // --- 2. AKTIVITA. Kroky pod plánem jsou levnější páka než řez kalorií.
  if (krokyPropad && (stagnuje || c.tempoPct === null)) {
    return nic("Kroky jsou " + fmt(c.kroky) + " proti plánu " + fmt(c.krokyCil) + ", to je propad o víc než " +
      KROKY_PROPAD_PCT + " %. Než sáhnu na jídlo, chci zpátky kroky. Cíle nechávám.");
  }

  // --- 3. KALORIE.
  if (smer === "hubnuti" && stagnuje) {
    if (!stagnovalMinule && pc) {
      return nic("Váha stojí (" + delta(c.zmenaOdMinule, "kg") + "), ale jen tenhle týden. " +
        "Zápis i příjem sedí, takže bych ještě týden počkal a pak řezal. Kdyby to stálo i příště, jdeme dolů.", "malo_dat");
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
      duvod: "Váha stojí druhý týden v řadě a přitom je zapsáno " + fmt(c.dnyZapsano) + " ze 7 dní a příjem sedí na cíli. " +
        "Tady už se to nesvede na přesnost, takže navrhuju " + fmt(cil, "kcal") + " → " + fmt(novy, "kcal") +
        " (-" + REZ_PCT + " %). Podlaha " + fmt(dno, "kcal") + " je pořád nad námi.",
    };
  }
  if (smer === "nabirani" && stagnuje) {
    const novy = Math.round((cil * (1 + PRIDANI_PCT / 100)) / 10) * 10;
    return {
      paka: "kcal_nahoru", novyKcal: novy, jistota: "jista",
      duvod: "Nabíráme a váha stojí (" + delta(c.zmenaOdMinule, "kg") + ") při zápisu " + fmt(c.dnyZapsano) +
        " ze 7 dní. Navrhuju " + fmt(cil, "kcal") + " → " + fmt(novy, "kcal") + " (+" + PRIDANI_PCT + " %).",
    };
  }
  if (!smer) {
    return nic("Nevím, jestli klient hubne, udržuje, nebo nabírá, takže o kaloriích nic nenavrhuju. " +
      "Přepni směr nad tlačítkem a spočítám to.", "chybi_data");
  }

  return nic("Čísla jdou tam, kam mají (" + delta(c.zmenaOdMinule, "kg") + " od minule), zápis i příjem sedí. " +
    "Nic bych neměnil, tohle je týden na potvrzení kurzu.");
}

/** Obojí naráz. Vrací i hotový text bloku k vložení do mailu. */
export function pripravFakta(v) {
  const blok = spocitejBlok(v);
  const predchoziCisla = v.predchozi
    ? spocitejBlok({ posledni: v.predchozi, predchozi: v.predpredchozi || null, prvni: v.prvni || null, cile: v.cile, pohlavi: v.pohlavi }).cisla
    : null;
  const navrh = navrhni({ cisla: blok.cisla, predchoziCisla, smer: v.smer, pohlavi: v.pohlavi });
  return { ...blok, predchoziCisla, navrh };
}
