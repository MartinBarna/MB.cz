// 🚀 ONBOARDING KLIENTA: deterministický engine variant cílů.
//
// K ČEMU TO JE: klient vyplní vstupní dotazník, tenhle soubor z něj spočítá TŘI varianty
// cílů (kalorie, makra, vláknina, očekávané tempo) a Martin v adminu jen jednu vybere.
// Vybraná varianta se pak uloží do `client_targets` a předvyplní editor průvodce.
//
// ⛔ ŽÁDNÁ AI. Všechna čísla vznikají tady, deterministicky, ze vzorců níž.
//    Pravidlo 3 projektu: „Engine počítá, AI mluví."
//
// ⛔ PRAVIDLA JSOU PŘEVZATÁ Z APPKY (`src/engine/goals.ts`, `src/lib/engine/config.ts`),
//    ať klient koučinku a klient appky nedostanou dvě různá čísla:
//      • Mifflin St Jeor,
//      • referenční hmotnost při BMI >= 30 (ideál při BMI 25 + 25 % nadváhy),
//      • bílkoviny 1,8 až 2,2 g/kg referenční váhy, absolutní minimum 1,2 g/kg,
//      • tuk 25 % kalorií, podlaha 22 % kalorií a zároveň 0,6 g/kg referenční váhy,
//      • sacharidy zbytek, podlaha 100 g (bere se z tuku, teprve pak z bílkovin),
//      • kalorická podlaha 1200 žena / 1500 muž,
//      • strop deficitu 25 % TDEE,
//      • vláknina 14 g na 1000 kcal, minimum 25 g, strop 60 g.
//    ⚠️ Kdo mění čísla TADY, musí je změnit i v appce, nebo napsat, proč se jí to netýká.
//
// ⚠️ V ČEM SE TENHLE ENGINE OD APPKY LIŠÍ A PROČ: appka bere aktivitu jako JEDEN
//    násobič, který si klient vybere z pěti možností. Tady je vstupem dotazník, kde
//    jsou kroky a tréninky jako ČÍSLA, takže výdej skládáme z dílů:
//      TDEE = BMR × násobič běžného dne (práce, chození, ne sport)
//             + kroky nad 3000 × váha × 0,0005 kcal
//             + čistý výdej tréninků (MET podle sportu, minus klidový metabolismus)
//    Kdyby se násobič aktivity z dotazníku bral „jak je" a kroky s tréninky se přičetly,
//    sportující člověk by dostal výdej započítaný dvakrát. Proto je násobič níž jen
//    o BĚŽNÉM dni (1,2 sedavý až 1,5 fyzická práce) a sport se přičítá zvlášť.
//
// Běží v prohlížeči (window.OnboardingCile) i v node (module.exports) kvůli testu
// `scripts/onboarding-cile-test.js`.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.OnboardingCile = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // KONSTANTY (jedno místo, ať se dají doladit bez zásahu do logiky)
  // ---------------------------------------------------------------------------
  var K = {
    KCAL_NA_KG: 7700,
    OBEZITA_BMI: 30,
    ADJ_PODIL_NADVAHY: 0.25,
    BILKOVINY_MIN: 1.8,
    BILKOVINY_MAX: 2.2,
    BILKOVINY_ABS_MIN: 1.2,      // g/kg referenční váhy, pod tohle se nejde nikdy
    // ⭐ TUK A VLÁKNINA JSOU OD 2. 9. 2026 PŘEVZATÉ Z APPKY 1:1 (`src/engine/goals.ts`).
    // Revize změřila, že se dřív rozcházely: tuk až o 25 % (tady 25 % kcal, appka 0,8 g/kg
    // referenční váhy) a vláknina až o 39 % (tady podlaha 25 g, appka žádnou nemá).
    // ⚠️ Následek sjednocení: klient na nízkém příjmu dostane MÍŇ vlákniny než dřív
    // (žena na 1300 kcal 18 g místo 25 g) a VÍC tuku. Je to vědomé, parita s appkou
    // má přednost, aby klient koučinku a klient appky neviděli dvě různá čísla.
    // ⭐ [2. 9. 2026] Podlaha se z části vrací: `VLAKNINA_MIN` = 20 g, stejně jako
    // `FIBER_FLOOR_G` v appce. Ta žena na 1300 kcal dostane 20 g, ne 18.
    TUK_G_PER_KG: 0.8,           // BMI < 30: cílový tuk = referenční váha × tohle (appka FAT_G_PER_KG_DEFAULT)
    TUK_OBEZITA_PCT_KCAL: 25,    // BMI >= 30: cílový tuk = % kalorií (appka FAT_OBESE_PCT_KCAL)
    TUK_MIN_PCT_KCAL: 22,        // podlaha, appka fatFloorG
    SACHARIDY_PODLAHA_G: 100,
    VLAKNINA_NA_1000: 14,
    VLAKNINA_MAX: 60,
    VLAKNINA_MIN: 20,            // podlaha, appka FIBER_FLOOR_G
    STROP_DEFICITU_PCT_TDEE: 25,
    KROKY_ZAPOCTENE_OD: 3000,     // do násobiče běžného dne se vejde ~3000 kroků
    KCAL_NA_KROK_NA_KG: 0.0005,   // 9000 kroků, 64 kg, po odečtení základu = 192 kcal
    KROKY_STROP: 25000,
    TRENINK_MINUT_VYCHOZI: 60,
    TRENINK_MINUT_STROP: 240,
    TRENINK_DNI_STROP: 14,
    TEMPO_VAROVANI_PCT_TYDNE: 1.0 // rychlejší hubnutí než 1 % váhy za týden = varování
  };

  // Násobič aktivity. ⭐ Hodnoty jsou od 2. 9. 2026 TÉŽE ŠKÁLY JAKO APPKA
  // (`ACTIVITY_MULTIPLIERS` v `src/engine/goals.ts`), aby Martin viděl stejná čísla
  // jako klient v appce: sedavý 1,2 · lehce aktivní 1,375 · aktivní 1,55 · velmi aktivní 1,725.
  // ⚠️⚠️ POZOR NA DVOJÍ ZAPOČTENÍ: appka tímhle násobičem pokrývá I sport, tady se kroky
  // a tréninky přičítají ZVLÁŠŤ (dotazník je má jako čísla). Kdo vybere „aktivní" klientovi,
  // který zároveň trénuje, dostane sport dvakrát. Engine to pozná a napíše varování;
  // Martin má v adminu přepínač, takže si může vybrat: buď nižší stupeň, nebo nula tréninků.
  var NASOBIC_DNE = { sedavy: 1.2, lehce: 1.375, aktivni: 1.55, velmi: 1.725 };
  var NASOBIC_POPIS = { 1.2: 'sedavý', 1.375: 'lehce aktivní', 1.55: 'aktivní', 1.725: 'velmi aktivní' };

  // MET podle toho, co klient napsal do „sport". Čísla z běžného compendia aktivit.
  // Bere se PRVNÍ pravidlo, které sedí; když nesedí nic, platí 6 (posilovna).
  var SPORT_MET = [
    [/mma|box|bojov|judo|karate|zapas|zápas|thai|kickbox/, 10],
    [/hiit|crossfit|sprint|tabata|spinning|intervalov/, 10],
    [/beh|běh|bězi|běž|bezi|jogging|triatlon|plavan|plavání|veslov/, 9],
    [/hokej|fotbal|basket|volejbal|tenis|squash|florbal|rugby/, 8],
    [/kolo|cyklist|bike/, 7],
    [/posilov|fitko|fitness|cinky|silov|kettlebell|kruhov|gym/, 6],
    [/joga|jóga|pilates|strecin|streč|chuze|chůze|prochaz|procház|turistik/, 3.5]
  ];
  var SPORT_MET_VYCHOZI = 6;

  // NEPREKROCITELNE PRAVIDLO 2 PROJEKTU: zdravotni brana.
  //
  // PREPSANO 2. 9. 2026 PO REVIZI, ktera pustila starou verzi na PETI skutecnych
  // dotaznicich z zive databaze: nechytila CTYRI z peti.
  //   - Kojici matka po cisari se stitnou zlazou a Euthyroxem: slovo "kojim" bylo
  //     v poli `prace` a "po porodu" v poli `cil`, ale brana cetla jen `zdravi`,
  //     `leky` a `diety`. Zachranila to nahoda, ze v `zdravi` bylo "stitna".
  //   - Klientka s osmi preparaty v poli Leky: brana hledala SLOVO "leky" v OBSAHU
  //     toho pole, jenze tam lide pisou nazvy pripravku. Nespustila se vubec.
  //   - "eutyrox" (bezny preklep bez h) stary regex nechytil.
  //
  // Dnes plati trojí pojistka:
  //   1) ctou se VSECHNA textova pole dotazniku, ne tri vybrana (`CITLIVA_POLE`),
  //   2) slovnik niz hleda diagnozy a stavy, s diakritikou i bez ni (text se zbavuje
  //      diakritiky pres `bezDia`, takze regexy jsou schvalne psane bez ni),
  //   3) jakykoli neprazdny obsah poli `leky`, `zdravi` a `alergie` branu spusti sam
  //      o sobe (`VYPLNENE_JE_SIGNAL`), i kdyz v nem zadne zname slovo neni.
  //      Whitelist prazdnych odpovedi je v `PRAZDNE_ODPOVEDI`.
  //
  // Je to PODLAHA, ne zaruka. Brana Martina zastavi, nerozhoduje za nej.
  var CITLIVA_POLE = ['zdravi', 'leky', 'diety', 'alergie', 'neji', 'poznamka', 'prace', 'cil', 'proc', 'sport', 'termin'];
  var VYPLNENE_JE_SIGNAL = [['leky', 'vyplněné pole Léky'], ['zdravi', 'vyplněné pole Zdraví'], ['alergie', 'vyplněné pole Alergie']];
  // Odpovedi, ktere znamenaji "nic". Porovnava se CELA hodnota bez diakritiky, aby
  // "Zatim zadne" nebo "Zadna omezeni neuvedl" nespoustelo branu zbytecne. Kdyz se brana
  // rozsviti u kazdeho klienta, prestane si ji clovek cist, a to je horsi nez kdyby nebyla.
  var PRAZDNE_ODPOVEDI = /^(zatim |taky |ted |momentalne |uz |asi |snad )?(ne|nic|nemam|neberu|nevim|zadne|zadna|zadny|zadnych|x|0|-{1,2})( omezeni| problemy| nemam| neuvedl| neuvedla| zvlastniho| nic| leky| lieky)?( neuvedl| neuvedla)?[.!]?$/;
  // ⛔ KRATKE KMENY MUSI MIT HRANICI SLOVA (\b). Zmereno 2. 9. 2026 na skutecnem dotazniku:
  // "spokojenost" obsahuje "kojen", takze brana hlasila KOJENI u 45lete zeny, ktera
  // do kolonky "proc" napsala "deti a moje osobni spokojenost". Falesny poplach je
  // levnejsi nez zmeskany nalez, ale ne zadarmo: kdo bere branu jako sum, prestane ji cist.
  var CITLIVA_SLOVA = [
    ['těhotenství', /\btehot|\bgravid|\bcisar|po porodu|sestinedel/],
    // "krmim" je slabsi signal (da se krmit i pes), ale u zeny po porodu to byla jedina
    // stopa v poli `prace` ve skutecnem dotazniku. Falesny poplach stoji jedno kliknuti.
    ['kojení', /\bkoj(en|im|ic)|\blaktac|\bkrmim|\bkrmen[ií]/],
    ['porucha příjmu potravy', /\banorex|\bbulim|poruch\w* prijmu|\bppp\b/],
    // ⛔ [2026-09-05, revize] „o víkendu se často přejídám" spadalo pod PPP a vyhodilo
    // stejně tvrdý štítek jako anorexie/bulimie. Přejídání je samostatný, mírnější
    // signál, ne automaticky porucha příjmu potravy.
    ['přejídání (zkontroluj vztah k jídlu)', /zachvatovit|\bprejida/],
    ['cukrovka', /\bdiabet|\bcukrovk|\binzulin|\bmetformin|\bglukofag|\bsiofor/],
    ['štítná žláza', /\bstitn|hashimoto|thyrox|eutyrox|letrox|levothyrox|hypotyre|hypertyre/],
    ['duševní zdraví', /\bdepres|antidepres|\buzkost|\bpanick|escitalopram|sertralin|bupropion/],
    ['hormonální antikoncepce nebo léčba', /antikonc|hormonaln|\bpcos\b|endometri|menopauz|estrogen/],
    ['léky', /kortiko|prednison|warfarin|beta.?blok|\bstatin|\bopioid/],
    ['srdce a tlak', /\bsrdc|\binfarkt|\barytmi|vysoky tlak|hypertenz|na tlak/],
    ['ledviny a játra', /\bledvin|\bjatr|\bcirhoz|\bdialyz/],
    ['operace', /\boperac|po operaci|rekonvalescen|zlomenin/],
    ['celiakie a střeva', /\bceliaki|\bcrohn|\bcolitid|ulcerozn|\breflux|zaludecn|\bvred/],
    ['astma a alergie', /\bastma|anafyl|\bepipen/]
  ];

  // ---------------------------------------------------------------------------
  // Pomocné
  // ---------------------------------------------------------------------------
  function num(v) {
    if (v == null) return null;
    var s = String(v).trim();
    if (s === '') return null;
    // z „9 000 kroků" nebo „cca 9000" vytáhne 9000
    var m = s.replace(/\s/g, '').replace(',', '.').match(/-?\d+(\.\d+)?/);
    if (!m) return null;
    var n = Number(m[0]);
    return isFinite(n) ? n : null;
  }
  function bezDia(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function r0(n) { return Math.round(Number(n) || 0); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function cz(n) { return String(n).replace('.', ','); }

  // ---------------------------------------------------------------------------
  // Fyziologie
  // ---------------------------------------------------------------------------
  function bmr(pohlavi, vahaKg, vyskaCm, vek) {
    var base = 10 * vahaKg + 6.25 * vyskaCm - 5 * vek;
    return pohlavi === 'z' ? base - 161 : base + 5;
  }
  function bmi(vahaKg, vyskaCm) {
    if (!vahaKg || !vyskaCm) return null;
    var m = vyskaCm / 100;
    return vahaKg / (m * m);
  }
  /** Referenční váha pro makra. BMI < 30 = aktuální váha, jinak ideál při BMI 25 + 25 % nadváhy. */
  function referencniVaha(vahaKg, vyskaCm) {
    var b = bmi(vahaKg, vyskaCm);
    if (b == null || b < K.OBEZITA_BMI) return vahaKg;
    var m = vyskaCm / 100;
    var ideal = 25 * m * m;
    return ideal + K.ADJ_PODIL_NADVAHY * (vahaKg - ideal);
  }
  function podlahaKcal(pohlavi) { return pohlavi === 'z' ? 1200 : 1500; }

  /**
   * Odhad násobiče z textu. ⭐ Je to jen PŘEDVÝBĚR, Martin ho v adminu přepíná.
   * ⛔ POŘADÍ JE ZÁVAZNÉ a opravené 2. 9. 2026 po revizi na skutečných dotaznících:
   *   • „Lehce aktivní" dřív spadlo do větve /aktivn/ a dalo 1,4 místo 1,3. Proto se
   *     nejdřív ptáme na „lehce", teprve pak na „aktivní".
   *   • „50 % práce u pc, 50 % pohyb" + aktivita „Aktivní" dřív spadlo do /u pc/ a dalo
   *     1,2 místo 1,55, tedy TDEE o 11 % níž. Proto se pole ODDĚLUJÍ: rozhoduje pole
   *     `aktivita` (klient si tam vybírá stupeň), a text práce se čte jen tehdy,
   *     když aktivita mlčí.
   */
  function nasobicZTextu(s) {
    if (!s) return null;
    if (/velmi aktivn|extremn/.test(s)) return NASOBIC_DNE.velmi;
    if (/lehce aktivn|lehk|obcas|castecne/.test(s)) return NASOBIC_DNE.lehce;
    if (/stredn|aktivn|casto chodim|hodne chodim/.test(s)) return NASOBIC_DNE.aktivni;
    if (/sedav|kancel|u pocitace|u pc|za stolem|ridic/.test(s)) return NASOBIC_DNE.sedavy;
    if (/fyzick|manual|stavb|sklad|na nohou cely/.test(s)) return NASOBIC_DNE.velmi;
    if (/chodim|prodavac|ucitel/.test(s)) return NASOBIC_DNE.aktivni;
    return null;
  }
  function nasobicDne(aktivita, prace) {
    return nasobicZTextu(bezDia(aktivita)) || nasobicZTextu(bezDia(prace)) || NASOBIC_DNE.sedavy;
  }

  /**
   * Z popisu sportu vytáhne jen to, co klient dělá TEĎ.
   * ⛔ Přidáno 2. 9. 2026 po revizi: pole `sport` je vyprávění, ne výčet. Skutečný
   * dotazník obsahoval „Dřív: fitness aerobic, voltyž, karate, aikido. Teď: nic jen
   * procházky" a engine z něj vytáhl karate (MET 10), tedy 94 kcal denně bojového
   * sportu ženě, která chodí na procházky.
   */
  function aktualniSport(text) {
    var s = String(text == null ? '' : text);
    var m = s.match(/(te[dď]|nyn[ií]|aktu[aá]ln|moment[aá]ln|posledn[ií] dobou)\s*[:,-]?\s*([\s\S]*)$/i);
    if (m && m[2] && m[2].trim()) return m[2];
    // Když se mluví jen o minulosti a žádné „teď" tam není, nemáme co započítat.
    if (/d[rř][ií]v|kdysi|p[rř]estal|nesportuj|nyn[ií] nic/i.test(s) && !m) return '';
    return s;
  }

  /** Délka jednoho tréninku vyčtená z textu („6x týdně 90 minut"). Dotazník pole nemá. */
  function minutyZTextu(text) {
    var m = bezDia(text).match(/(\d{2,3})\s*(min|minut)/);
    if (!m) return null;
    var n = Number(m[1]);
    return isFinite(n) && n >= 10 && n <= K.TRENINK_MINUT_STROP ? n : null;
  }

  function metSportu(text) {
    var s = bezDia(aktualniSport(text));
    if (!s.trim()) return SPORT_MET_VYCHOZI;
    for (var i = 0; i < SPORT_MET.length; i++) if (SPORT_MET[i][0].test(s)) return SPORT_MET[i][1];
    return SPORT_MET_VYCHOZI;
  }

  /** Rozpad denního výdeje. Vrací i jednotlivé díly, ať se dá v adminu ukázat, z čeho to je. */
  function vydej(v) {
    var b = bmr(v.pohlavi, v.vaha, v.vyska, v.vek);
    var nas = v.nasobic != null ? v.nasobic : nasobicDne(v.aktivita, v.prace);
    var zaklad = b * nas;

    var kroky = clamp(v.kroky == null ? 0 : v.kroky, 0, K.KROKY_STROP);
    var krokyKcal = Math.max(0, kroky - K.KROKY_ZAPOCTENE_OD) * v.vaha * K.KCAL_NA_KROK_NA_KG;

    var dni = clamp(v.dny_treninku == null ? 0 : v.dny_treninku, 0, K.TRENINK_DNI_STROP);
    // Délka tréninku: ruční přepis z adminu > číslo vyčtené z popisu sportu > 60 minut.
    var minutZdroj = v.trenink_minut != null ? v.trenink_minut : minutyZTextu(v.sport);
    var minut = clamp(minutZdroj == null ? K.TRENINK_MINUT_VYCHOZI : minutZdroj, 0, K.TRENINK_MINUT_STROP);
    var met = v.met != null ? v.met : metSportu(v.sport);
    // Čistý výdej: od METu se odečítá 1 (klidový metabolismus se v BMR počítá už jednou).
    var kcalZaMinutu = (met - 1) * 3.5 * v.vaha / 200;
    var treninkKcal = dni * minut * kcalZaMinutu / 7;

    return {
      bmr: b, nasobic: nas, nasobic_popis: NASOBIC_POPIS[nas] || String(nas),
      zaklad: zaklad, kroky_kcal: krokyKcal, trenink_kcal: treninkKcal,
      met: met, trenink_minut: minut, trenink_dni: dni,
      minut_z_dotazniku: minutyZTextu(v.sport), sport_ted: aktualniSport(v.sport).trim(),
      tdee: zaklad + krokyKcal + treninkKcal
    };
  }

  // ---------------------------------------------------------------------------
  // Makra
  // ---------------------------------------------------------------------------
  /**
   * Rozdělí kalorie do maker. Pořadí ústupků je závazné (stejné jako v appce):
   *   1) tuk dolů, ale nikdy pod 22 % kalorií,
   *   2) teprve pak bílkoviny dolů, ale nikdy pod 1,2 g/kg referenční váhy,
   *   3) když ani to nestačí, sacharidy zůstanou pod podlahou a je z toho varování.
   */
  function makra(kcal, bilkovinyG, refKg, obezita) {
    // ⭐ 1:1 s appkou: podlaha je JEN 22 % kalorií (`fatFloorG`), ne navíc 0,6 g/kg.
    // V appce je 0,6 minimum vstupního parametru `fatPerKg`, ne podlaha výsledku.
    var tukPodlahaG = Math.round((K.TUK_MIN_PCT_KCAL / 100) * kcal / 9);
    // ⭐ 1:1 s appkou `fatTargetG`: BMI >= 30 → 25 % kalorií, jinak 0,8 g/kg referenční váhy.
    var tukCilG = obezita
      ? Math.round((K.TUK_OBEZITA_PCT_KCAL / 100) * kcal / 9)
      : Math.round(refKg * K.TUK_G_PER_KG);
    var bilk = Math.round(bilkovinyG);
    var maxTuk = Math.floor((kcal - bilk * 4) / 9);
    var tuk = Math.max(tukPodlahaG, Math.min(tukCilG, maxTuk));
    function sach() { return Math.max(0, Math.round((kcal - bilk * 4 - tuk * 9) / 4)); }
    var s = sach();

    if (s < K.SACHARIDY_PODLAHA_G) {
      var mistoVTuku = tuk - tukPodlahaG;
      if (mistoVTuku > 0) {
        tuk -= Math.min(mistoVTuku, Math.ceil((K.SACHARIDY_PODLAHA_G - s) * 4 / 9));
        s = sach();
      }
    }
    if (s < K.SACHARIDY_PODLAHA_G) {
      var bilkPodlaha = Math.round(refKg * K.BILKOVINY_ABS_MIN);
      var mistoVBilk = bilk - bilkPodlaha;
      if (mistoVBilk > 0) {
        bilk -= Math.min(mistoVBilk, Math.ceil((K.SACHARIDY_PODLAHA_G - s) * 4 / 4));
        s = sach();
      }
    }
    return { protein: bilk, fat: tuk, carbs: s, na_podlaze: s < K.SACHARIDY_PODLAHA_G };
  }

  /** ⭐ 1:1 s appkou `fiberTargetG`: 14 g na 1000 kcal, strop 60, podlaha 20. */
  function vlakninaG(kcal) {
    return Math.min(K.VLAKNINA_MAX,
      Math.max(K.VLAKNINA_MIN, Math.round(kcal / 1000 * K.VLAKNINA_NA_1000)));
  }

  // ---------------------------------------------------------------------------
  // Cíl z dotazníku
  // ---------------------------------------------------------------------------
  function odhadCile(text) {
    var s = bezDia(text);
    if (/nabr|nabir|nabír|sval|prib|přib|hmotn|objem|masa/.test(s)) return 'nabirani';
    if (/zhub|hubn|zhod|shodit|tuk dol|zestih|redukc|kila dol/.test(s)) return 'hubnuti';
    if (/postav|zpevn|rekomp|recomp|vyryso|forma/.test(s)) return 'postava';
    return 'udrzeni';
  }

  // Sady variant. `posun` je podíl proti TDEE (kladný = přebytek).
  var SADY = {
    hubnuti: [
      { klic: 'klidne', nazev: 'Klidné hubnutí', posun: -0.12, bilkoviny: 2.0,
        proc: 'Menší deficit, který se dá držet i v týdnu, kdy se nedaří. Váha jde dolů pomaleji, ale síla a energie v tréninku zůstávají.' },
      { klic: 'svizne', nazev: 'Svižné hubnutí', posun: -0.20, bilkoviny: 2.0,
        proc: 'Výraznější deficit na první měsíce, kdy je motivace nejvyšší. Chce to přesnější vážení a víc bílkovin, jinak ubývá i sval.' },
      { klic: 'udrzeni', nazev: 'Udržení', posun: 0, bilkoviny: 2.0,
        proc: 'Bez deficitu. Dává smysl na začátek u někoho, kdo dlouho držel diety, nebo jako pauza uprostřed hubnutí.' }
    ],
    nabirani: [
      { klic: 'udrzeni_sila', nazev: 'Udržení a síla', posun: 0, bilkoviny: 2.0,
        proc: 'Kalorie kolem výdeje, roste hlavně síla. Nejčistší varianta, jen je pomalá.' },
      { klic: 'lehke', nazev: 'Lehké nabírání', posun: 0.08, bilkoviny: 2.0,
        proc: 'Mírný přebytek. Váha roste pomalu a většina přírůstku je sval, ne tuk.' },
      { klic: 'rychlejsi', nazev: 'Rychlejší nabírání', posun: 0.15, bilkoviny: 2.0,
        proc: 'Větší přebytek pro toho, kdo přibírá těžko. Počítej s tím, že část přírůstku bude tuk.' }
    ],
    udrzeni: [
      { klic: 'udrzeni', nazev: 'Udržení', posun: 0, bilkoviny: 2.0,
        proc: 'Kalorie kolem výdeje. Váha se drží, mění se složení stravy a pravidelnost.' },
      { klic: 'recomp', nazev: 'Rekompozice', posun: 0, bilkoviny: 2.2,
        proc: 'Stejné kalorie, ale výrazně víc bílkovin. Váha stojí, mění se poměr svalu a tuku. Trvá to déle a je to vidět spíš na mírách než na váze.' },
      { klic: 'mirny_deficit', nazev: 'Mírný deficit', posun: -0.10, bilkoviny: 2.0,
        proc: 'Malý deficit pro toho, kdo chce shodit posledních pár kilo, ale nechce jít do tvrdé diety.' }
    ]
  };
  SADY.postava = SADY.udrzeni;

  // ---------------------------------------------------------------------------
  // Priority na první týden (do uvítacího mailu). Deterministicky z dotazníku.
  // ---------------------------------------------------------------------------
  function priority(v) {
    var out = [];
    var spanek = num(v.spanek);
    if (spanek != null && spanek < 7) {
      out.push('Spánek. Teď spíš kolem ' + cz(spanek) + ' hodin, chci se dostat na 8 až 9. '
        + 'Je to nejlevnější věc, kterou máme: spravuje hlad, chuť na sladké i výkon v tréninku. '
        + 'Zkus tenhle týden chodit spát o 30 minut dřív a napiš mi v pondělí, jak to šlo.');
    }
    var dni = num(v.dny_treninku);
    if (dni == null || dni <= 0) {
      out.push('Rozhýbat se. Zatím necvičíš, takže první týden neřešíme žádné složité plány. '
        + 'Cíl je dostat do týdne dva pohyby, u kterých víš, že na ně půjdeš. '
        + 'Napiš mi, co je pro Tebe reálné, a plán postavím na tom.');
    }
    var kroky = num(v.kroky);
    if (kroky != null && kroky < 6000) {
      out.push('Kroky. Teď máš kolem ' + r0(kroky) + ' denně, což je málo na to, aby to hnulo s výdejem. '
        + 'Tenhle týden jen měř, kolik jich reálně máš, cíl si nastavíme podle skutečnosti.');
    }
    if (!out.length) {
      var pohyb = String(v.sport || '').trim();
      out.push('Držet pohyb, který už máš' + (pohyb ? ' (' + pohyb + ')' : '') + '. '
        + 'Nic k němu zatím nepřidáváme, chci nejdřív vidět týden v číslech.');
      out.push('Kroky. Měř je celý týden a v pondělí mi pošli průměr. Podle něj nastavíme cíl, '
        + 'ne podle odhadu.');
    }
    return out.slice(0, 3);
  }

  // ---------------------------------------------------------------------------
  // Citlivá pole
  // ---------------------------------------------------------------------------
  /** Je hodnota realna odpoved, nebo jen "nic"? */
  function neprazdne(hodnota) {
    var s = bezDia(hodnota).trim();
    if (!s) return false;
    return !PRAZDNE_ODPOVEDI.test(s);
  }
  /**
   * Vrati seznam nalezu. Prazdne pole = brana se nespusti.
   * Cte VSECHNA pole z `CITLIVA_POLE`, ne tri vybrana. Viz komentar u slovniku.
   */
  function citliva(v) {
    var casti = [];
    for (var i = 0; i < CITLIVA_POLE.length; i++) {
      var h = v[CITLIVA_POLE[i]];
      if (h != null && String(h).trim() !== '') casti.push(String(h));
    }
    var text = bezDia(casti.join(' | '));
    var out = [];
    for (var j = 0; j < CITLIVA_SLOVA.length; j++) {
      if (CITLIVA_SLOVA[j][1].test(text)) out.push(CITLIVA_SLOVA[j][0]);
    }
    for (var k = 0; k < VYPLNENE_JE_SIGNAL.length; k++) {
      if (neprazdne(v[VYPLNENE_JE_SIGNAL[k][0]])) out.push(VYPLNENE_JE_SIGNAL[k][1]);
    }
    return out.filter(function (x, idx) { return out.indexOf(x) === idx; });
  }

  // ---------------------------------------------------------------------------
  // HLAVNÍ FUNKCE
  // ---------------------------------------------------------------------------
  /**
   * @param {object} vstup pole z dotazníku + `pohlavi` ('m'|'z') + volitelně `trenink_minut`
   * @returns {object} { ok, chybi, vydej, bmi, ref_kg, cil, karty, citliva, varovani }
   */
  function varianty(vstup) {
    var v = {
      pohlavi: vstup.pohlavi === 'z' ? 'z' : 'm',
      vek: num(vstup.vek), vyska: num(vstup.vyska), vaha: num(vstup.vaha),
      kroky: num(vstup.kroky), dny_treninku: num(vstup.dny_treninku),
      trenink_minut: num(vstup.trenink_minut),
      // Ruční přepis bílkovin (g/kg referenční váhy) z adminu. Prázdné = hodnota ze sady níž.
      // ⚠️ Existuje schválně: Martin v mailu z 1. 9. dal nabírajícímu klientovi 2,0 g/kg,
      // zatímco pravidlo pro nabírání říká 1,8. Neohýbám kvůli tomu vzorec, ale nechávám
      // páku, aby to nemusel přepisovat ručně v mailu.
      bilkoviny_g_kg: num(vstup.bilkoviny_g_kg),
      // Rucni prepisy z adminu (prazdne = odhad z dotazniku). Martin je vidi a meni.
      nasobic: num(vstup.nasobic), met: num(vstup.met),
      cil_rezim: vstup.cil_rezim || null,
      aktivita: vstup.aktivita || '', prace: vstup.prace || '', sport: vstup.sport || '',
      spanek: vstup.spanek, cil: vstup.cil || '', proc: vstup.proc || '', termin: vstup.termin || '',
      zdravi: vstup.zdravi || '', leky: vstup.leky || '', diety: vstup.diety || '',
      alergie: vstup.alergie || '', neji: vstup.neji || '', poznamka: vstup.poznamka || ''
    };

    var chybi = [];
    if (v.vek == null) chybi.push('věk');
    if (v.vyska == null) chybi.push('výška');
    if (v.vaha == null) chybi.push('váha');
    if (chybi.length) {
      return { ok: false, chybi: chybi, karty: [], citliva: citliva(v), varovani: [], vstup: v };
    }

    var vy = vydej(v);
    var varovani = [];
    if (v.kroky == null) varovani.push('Kroky v dotazníku nejsou, počítám jen běžný pohyb (kroky přidávají 0 kcal). Doplň je, výdej se posune.');
    if (v.dny_treninku == null) varovani.push('Počet tréninků v dotazníku není, počítám s nulou. Doplň ho, výdej se posune.');
    if (v.trenink_minut == null && vy.trenink_dni) {
      varovani.push(vy.minut_z_dotazniku != null
        ? ('Délku tréninku dotazník nemá jako pole, vyčetl jsem ' + vy.minut_z_dotazniku + ' minut z popisu sportu. Zkontroluj to.')
        : ('Délka tréninku nikde není, počítám ' + K.TRENINK_MINUT_VYCHOZI + ' minut. Přepiš ji, když trénuje déle nebo kratší dobu.'));
    }
    // Dvojí započtení sportu: násobič ze škály appky pokrývá i pohyb, tady se tréninky
    // přičítají zvlášť. Radši to řekneme, než abychom klientovi nadsadili výdej.
    if (vy.nasobic > 1.2 && vy.trenink_dni > 0) {
      varovani.push('Násobič je „' + vy.nasobic_popis + '" (' + cz(vy.nasobic) + ') a zároveň počítám '
        + vy.trenink_dni + ' tréninků týdně zvlášť. Škála je z appky, kde jeden násobič pokrývá i sport, '
        + 'takže se tady může pohyb započítat dvakrát. Buď dej „sedavý", nebo tréninky vynuluj.');
    }
    if (vy.sport_ted !== String(v.sport || '').trim()) {
      varovani.push(vy.sport_ted
        ? ('Z popisu sportu beru jen to, co klient dělá teď: „' + vy.sport_ted.slice(0, 80) + '".')
        : 'V popisu sportu je jen minulost, žádný aktuální pohyb. Beru výchozí intenzitu, zkontroluj to.');
    }
    var b = bmi(v.vaha, v.vyska);
    var refKg = referencniVaha(v.vaha, v.vyska);
    if (b != null && b >= K.OBEZITA_BMI) {
      varovani.push('BMI ' + cz(Math.round(b * 10) / 10) + ', tedy 30 a víc. Bílkoviny a tuk počítám z referenční váhy '
        + cz(Math.round(refKg * 10) / 10) + ' kg, ne z aktuální. Jinak by bílkoviny snědly skoro celý denní příjem.');
    }
    // Cil se NEHADA. `odhadCile` je jen PREDVYBER pro prepinac v adminu; kdyz Martin
    // vybere, prijde sem jako `cil_rezim` a text dotazniku se ignoruje.
    // Revize nasla dva skutecne dotazniky, kde text (napr. "Cilova vaha 92 kg") zadnemu
    // regexu nesedl a engine nabidl sadu pro udrzeni cloveku, ktery chce hubnout.
    // Bez prepinace to Martin nemel cim opravit.
    var cilOdhad = odhadCile(v.cil + ' ' + (v.proc || ''));
    var cil = SADY[v.cil_rezim] ? v.cil_rezim : cilOdhad;
    var podlaha = podlahaKcal(v.pohlavi);
    var stropDeficitu = (K.STROP_DEFICITU_PCT_TDEE / 100) * vy.tdee;

    var karty = (SADY[cil] || SADY.udrzeni).map(function (s) {
      var kartaVar = [];
      var pozadovanoKcal = vy.tdee * (1 + s.posun);
      // strop deficitu 25 % TDEE
      if (vy.tdee - pozadovanoKcal > stropDeficitu) {
        pozadovanoKcal = vy.tdee - stropDeficitu;
        kartaVar.push('Deficit jsem srazil na 25 % výdeje, víc engine nepovolí.');
      }
      var kcal = r0(pozadovanoKcal);
      if (kcal < podlaha) {
        kcal = podlaha;
        kartaVar.push('Kalorie jsou na podlaze ' + podlaha + ' kcal (' + (v.pohlavi === 'z' ? 'žena' : 'muž')
          + '). Níž se nejde, i kdyby to vzorec spočítal.');
      }

      var bilkPerKg = clamp(v.bilkoviny_g_kg == null ? s.bilkoviny : v.bilkoviny_g_kg, K.BILKOVINY_MIN, K.BILKOVINY_MAX);
      var m = makra(kcal, refKg * bilkPerKg, refKg, b != null && b >= K.OBEZITA_BMI);
      if (m.na_podlaze) {
        kartaVar.push('Sacharidy zůstaly pod 100 g. Na tomhle příjmu se bílkoviny, tuk i sacharidy nevejdou naráz, hlídej energii v tréninku.');
      }
      var vl = vlakninaG(kcal);

      // Očekávaná změna váhy: (příjem - výdej) × 7 dní / 7700 kcal na kilo.
      var kgTyden = (kcal - vy.tdee) * 7 / K.KCAL_NA_KG;
      var pctTyden = Math.abs(kgTyden) / v.vaha * 100;
      if (kgTyden < 0 && pctTyden > K.TEMPO_VAROVANI_PCT_TYDNE) {
        kartaVar.push('Tempo vychází nad 1 % váhy za týden, což je na horní hranici. Sleduj sílu a hlad.');
      }

      return {
        klic: s.klic, nazev: s.nazev, proc: s.proc,
        posun_pct: Math.round(s.posun * 100),
        kcal: kcal,
        protein: m.protein, protein_kcal: m.protein * 4,
        carbs: m.carbs, carbs_kcal: m.carbs * 4,
        fat: m.fat, fat_kcal: m.fat * 9,
        fiber: vl,
        bilkoviny_g_kg: Math.round(m.protein / refKg * 100) / 100,
        kg_tyden: Math.round(kgTyden * 100) / 100,
        pct_tyden: Math.round(pctTyden * 100) / 100,
        tempo_veta: tempoVeta(kgTyden, pctTyden),
        varovani: kartaVar
      };
    });

    return {
      ok: true, chybi: [], cil: cil, cil_odhad: cilOdhad, cil_potvrzen: !!SADY[v.cil_rezim], vydej: vy, bmi: b == null ? null : Math.round(b * 10) / 10,
      ref_kg: Math.round(refKg * 10) / 10, podlaha_kcal: podlaha,
      karty: karty, citliva: citliva(v), varovani: varovani, vstup: v
    };
  }

  function tempoVeta(kgTyden, pctTyden) {
    var kg = Math.abs(Math.round(kgTyden * 100) / 100);
    if (kg < 0.05) return 'Váha by měla zůstat na místě, měnit se budou hlavně míry a síla';
    var smer = kgTyden < 0 ? 'dolů' : 'nahoru';
    return 'Počítám s tempem kolem ' + cz(kg) + ' kg ' + smer + ' za týden, tedy zhruba '
      + cz(Math.round(pctTyden * 10) / 10) + ' % váhy';
  }

  // ---------------------------------------------------------------------------
  // MAILY (sloty, žádná AI). Text drží Martinův vzor z 1. 9. 2026.
  // ⛔ Žádný nový slib: co tu není, to appka ani koučink neslibuje.
  // ---------------------------------------------------------------------------
  var ODKAZY = {
    balicek: 'https://martinbarna.cz/materialy/pdf/uvitaci-balicek.pdf',
    recepty: 'https://martinbarna.cz/materialy/pdf/high-protein-recepty.pdf',
    flexi: 'https://martinbarna.cz/materialy/pdf/flexibilni-strava.pdf',
    slozka: 'https://drive.google.com/drive/folders/1l_WkVyNKrv06I1IgQO1ZWBQ6CCmzImj6',
    kucharka: 'https://drive.google.com/drive/folders/1bQSa1kVSlAbiHq95EUz_Hpx2R4gNUecf',
    sekce: 'https://www.martinbarna.cz/akademie/klient/',
    whatsapp: '+420 603 229 831'
  };

  /**
   * Uvítací mail. Sloty se plní z dotazníku a z VYBRANÉ varianty, nic se nedomýšlí.
   * @param {object} o { jmeno, osloveni, karta, vstup, priority, appka: 'propsano'|'neni'|'nevim' }
   */
  function mailUvitaci(o) {
    var k = o.karta || {};
    var v = o.vstup || {};
    var pr = (o.priority && o.priority.length ? o.priority : priority(v));
    var pohyb = String(v.sport || '').trim() || 'pohyb, který děláš';
    var cilSlovo = { hubnuti: 'hubnutí', nabirani: 'nabírání', postava: 'změnu postavy', udrzeni: 'udržení' }[o.cil || 'udrzeni'] || 'Tvůj cíl';

    var appkaVeta = o.appka === 'propsano'
      ? 'V appce Tvůj Coach už máš tyhle cíle nastavené, jen se přihlas tímhle mailem.'
      : (o.appka === 'neni'
        ? 'Zaregistruj se do appky Tvůj Coach tímhle mailem a cíle Ti tam nastavím.'
        : '');

    var radky = [];
    radky.push('Good morning, ' + (o.osloveni || o.jmeno || '') + '!');
    radky.push('');
    radky.push('Díky za vyplnění vstupního dotazníku, doufám, že máš skvělý den! :)');
    radky.push('');
    radky.push('Posílám Ti mail s informacemi na první týden. V mailech budu stručný a k věci. Doptej se, kdy potřebuješ, chci, ať rozumíš tomu, proč děláme, co děláme.');
    radky.push('');
    radky.push('- Zaregistruj se do klientské sekce tímhle mailem.');
    radky.push('- Každé pondělí ráno Ti přijde mail, proklikáš report a systém ho uloží a pošle nám oběma shrnutí.');
    radky.push('- WhatsApp máš na mě kdykoliv, některé věci do pondělí nepočkají.');
    radky.push('- Akademie, přílohy, videokurz i appka jsou v klientské sekci, přihlásíš se tímhle mailem.');
    radky.push('');
    radky.push('Dotazy piš na WhatsApp textem.');
    radky.push('');
    radky.push('Teď důležité priority:');
    pr.forEach(function (p, i) { radky.push((i + 1) + ') ' + p); });
    radky.push('');
    radky.push('Jídlo = tohle na start:');
    radky.push(k.kcal + ' kcal');
    radky.push(k.protein + ' g bílkoviny (' + k.protein_kcal + ' kcal)');
    radky.push(k.carbs + ' g sachry (' + k.carbs_kcal + ' kcal)');
    radky.push(k.fat + ' g tuky (' + k.fat_kcal + ' kcal)');
    radky.push('Vláknina ' + k.fiber + ' g a více');
    radky.push('');
    radky.push('Tohle je na ' + cilSlovo + ' u Tebe: ' + (v.vek != null ? v.vek + ' let, ' : '')
      + (v.vyska != null ? v.vyska + ' cm, ' : '') + (v.vaha != null ? cz(v.vaha) + ' kg, ' : '')
      + pohyb + (v.kroky != null ? ', kroky cca ' + r0(v.kroky) : '') + '. '
      + (k.tempo_veta || '') + '. Když v pondělních reportech uvidíme, že je třeba, upravíme to každý týden.');
    radky.push('');
    radky.push('Řešíme pouze kalorie, bílkoviny a vlákninu, zbytek zatím ignoruj. Přesnost vážení a zápisu diktuje, na kolik to funguje.');
    if (appkaVeta) { radky.push(''); radky.push(appkaVeta); }
    radky.push('');
    radky.push('Počítám zde také s:');
    radky.push('1) naměřit reálný průměr kroků za týden');
    radky.push('2) ' + pohyb + ' beru jako hlavní pohyb, změny hlaš v pondělním reportu');
    radky.push('3) zápis jídla nám řekne, jak se daří plnit cíle');
    radky.push('');
    radky.push('Dnešní přílohy:');
    radky.push('Uvítací balíček ' + ODKAZY.balicek);
    radky.push('Bílkoviny a high-protein receptář ' + ODKAZY.recepty);
    radky.push('Flexibilní strava ' + ODKAZY.flexi);
    radky.push('Složka materiálů ' + ODKAZY.slozka);
    radky.push('Kuchařka ' + ODKAZY.kucharka);
    radky.push('');
    radky.push('Kdyby cokoliv nebylo jasné, ozvi se. Jsem i na WA.');
    radky.push('');
    radky.push('Be Effective!');
    radky.push('Tvůj Coach Marťas');
    radky.push('');
    radky.push('Otevřít klientskou sekci ' + ODKAZY.sekce);
    radky.push('WhatsApp ' + ODKAZY.whatsapp);

    return {
      predmet: (o.jmeno || '') + " - Let's Go! :) (start coaching)",
      telo: radky.join('\n')
    };
  }

  /** Druhý mail: průvodce je hotový a leží v klientské sekci. */
  function mailPruvodce(o) {
    var radky = [];
    radky.push('Ahoj ' + (o.osloveni || o.jmeno || '') + ',');
    radky.push('');
    radky.push('posílám Ti průvodce na míru. Máš tam dva vzorové dny, nákupní seznam na týden a záměny, kterými si jídla můžeš prohodit, a nemusíš u toho počítat.');
    radky.push('');
    radky.push('Ber je jako dva příklady dne, který Ti sedne do čísel, přesně podle nich jíst nemusíš. Když si něco prohodíš podle záměn, sedí to dál.');
    radky.push('');
    radky.push('Najdeš ho v klientské sekci: ' + ODKAZY.sekce);
    radky.push('');
    radky.push('Přečti si to a napiš mi na WhatsApp, co Ti tam chybí nebo co bys nejedl. Upravím to.');
    radky.push('');
    radky.push('Be Effective!');
    radky.push('Tvůj Coach Marťas');
    return { predmet: 'Průvodce na míru je hotový', telo: radky.join('\n') };
  }

  return {
    K: K, NASOBIC_DNE: NASOBIC_DNE, NASOBIC_POPIS: NASOBIC_POPIS, SADY: SADY,
    varianty: varianty, priority: priority, citliva: citliva,
    mailUvitaci: mailUvitaci, mailPruvodce: mailPruvodce,
    _vnitrni: { bmr: bmr, bmi: bmi, referencniVaha: referencniVaha, vydej: vydej, makra: makra, vlakninaG: vlakninaG, odhadCile: odhadCile, metSportu: metSportu, nasobicDne: nasobicDne }
  };
});
