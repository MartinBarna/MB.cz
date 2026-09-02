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
    TUK_PCT_KCAL: 25,
    TUK_MIN_PCT_KCAL: 22,
    TUK_MIN_G_PER_KG: 0.6,
    SACHARIDY_PODLAHA_G: 100,
    VLAKNINA_NA_1000: 14,
    VLAKNINA_MIN: 25,
    VLAKNINA_MAX: 60,
    STROP_DEFICITU_PCT_TDEE: 25,
    KROKY_ZAPOCTENE_OD: 3000,     // do násobiče běžného dne se vejde ~3000 kroků
    KCAL_NA_KROK_NA_KG: 0.0005,   // 9000 kroků, 64 kg, po odečtení základu = 192 kcal
    KROKY_STROP: 25000,
    TRENINK_MINUT_VYCHOZI: 60,
    TRENINK_MINUT_STROP: 240,
    TRENINK_DNI_STROP: 14,
    TEMPO_VAROVANI_PCT_TYDNE: 1.0 // rychlejší hubnutí než 1 % váhy za týden = varování
  };

  // Násobič BĚŽNÉHO dne (bez sportu). Sport a kroky se přičítají zvlášť, viz hlavička.
  var NASOBIC_DNE = { sedavy: 1.2, lehka: 1.3, stredni: 1.4, vysoka: 1.5 };

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

  // Citlivá slova ve `zdravi`, `leky`, `diety`. Nález = červený proužek nad kartami
  // a Martin musí odškrtnout, že to zkontroloval. Je to podlaha, ne záruka.
  var CITLIVA_SLOVA = [
    ['těhotenství', /tehot|těhot|gravid/],
    ['kojení', /kojen|kojím|kojim/],
    ['porucha příjmu potravy', /anorex|bulim|porucha prijmu|porucha příjmu|ppp\b|zachvat|záchvat|prejida|přejídá/],
    ['cukrovka', /diabet|cukrovk|inzulin|inzulín|metformin/],
    ['štítná žláza', /stitn|štítn|hashimoto|thyrox|euthyrox|letrox/],
    ['léky', /lek |lék |leky|léky|antidepres|kortiko|prednison|warfarin|beta.?blok|antikonc/],
    ['srdce a tlak', /srdc|infarkt|arytmi|vysoky tlak|vysoký tlak|hypertenz/],
    ['ledviny a játra', /ledvin|jatr|játr|cirhoz|dialyz/],
    ['operace', /operac|po operaci|rekonvalescen/],
    ['celiakie', /celiaki|celiakl/]
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

  function nasobicDne(text) {
    var s = bezDia(text);
    if (/sedav|kancel|u pocitace|u pc|za stolem|ridic|řidič/.test(s)) return NASOBIC_DNE.sedavy;
    if (/velmi aktivn|fyzick|manual|stavb|sklad|zdravotn sestr|cisnic|číšnic|servirk|na nohou cely/.test(s)) return NASOBIC_DNE.vysoka;
    if (/stredn|aktivn|casto chodim|hodne chodim|chodim|prodavac|ucitel/.test(s)) return NASOBIC_DNE.stredni;
    if (/lehk|obcas|castecne/.test(s)) return NASOBIC_DNE.lehka;
    return NASOBIC_DNE.sedavy;
  }
  function metSportu(text) {
    var s = bezDia(text);
    for (var i = 0; i < SPORT_MET.length; i++) if (SPORT_MET[i][0].test(s)) return SPORT_MET[i][1];
    return SPORT_MET_VYCHOZI;
  }

  /** Rozpad denního výdeje. Vrací i jednotlivé díly, ať se dá v adminu ukázat, z čeho to je. */
  function vydej(v) {
    var b = bmr(v.pohlavi, v.vaha, v.vyska, v.vek);
    var nas = nasobicDne((v.prace || '') + ' ' + (v.aktivita || ''));
    var zaklad = b * nas;

    var kroky = clamp(v.kroky == null ? 0 : v.kroky, 0, K.KROKY_STROP);
    var krokyKcal = Math.max(0, kroky - K.KROKY_ZAPOCTENE_OD) * v.vaha * K.KCAL_NA_KROK_NA_KG;

    var dni = clamp(v.dny_treninku == null ? 0 : v.dny_treninku, 0, K.TRENINK_DNI_STROP);
    var minut = clamp(v.trenink_minut == null ? K.TRENINK_MINUT_VYCHOZI : v.trenink_minut, 0, K.TRENINK_MINUT_STROP);
    var met = metSportu(v.sport);
    // Čistý výdej: od METu se odečítá 1 (klidový metabolismus se v BMR počítá už jednou).
    var kcalZaMinutu = (met - 1) * 3.5 * v.vaha / 200;
    var treninkKcal = dni * minut * kcalZaMinutu / 7;

    return {
      bmr: b, nasobic: nas, zaklad: zaklad, kroky_kcal: krokyKcal, trenink_kcal: treninkKcal,
      met: met, trenink_minut: minut, trenink_dni: dni,
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
  function makra(kcal, bilkovinyG, refKg) {
    var tukPodlahaG = Math.max(
      Math.round((K.TUK_MIN_PCT_KCAL / 100) * kcal / 9),
      Math.round(refKg * K.TUK_MIN_G_PER_KG)
    );
    var tukCilG = Math.round((K.TUK_PCT_KCAL / 100) * kcal / 9);
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

  function vlakninaG(kcal) {
    return clamp(Math.round(kcal / 1000 * K.VLAKNINA_NA_1000), K.VLAKNINA_MIN, K.VLAKNINA_MAX);
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
      { klic: 'udrzeni_sila', nazev: 'Udržení a síla', posun: 0, bilkoviny: 1.8,
        proc: 'Kalorie kolem výdeje, roste hlavně síla. Nejčistší varianta, jen je pomalá.' },
      { klic: 'lehke', nazev: 'Lehké nabírání', posun: 0.08, bilkoviny: 1.8,
        proc: 'Mírný přebytek. Váha roste pomalu a většina přírůstku je sval, ne tuk.' },
      { klic: 'rychlejsi', nazev: 'Rychlejší nabírání', posun: 0.15, bilkoviny: 1.8,
        proc: 'Větší přebytek pro toho, kdo přibírá těžko. Počítej s tím, že část přírůstku bude tuk.' }
    ],
    udrzeni: [
      { klic: 'udrzeni', nazev: 'Udržení', posun: 0, bilkoviny: 1.8,
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
  function citliva(v) {
    var text = bezDia([v.zdravi, v.leky, v.diety].filter(Boolean).join(' | '));
    var out = [];
    for (var i = 0; i < CITLIVA_SLOVA.length; i++) {
      if (CITLIVA_SLOVA[i][1].test(text)) out.push(CITLIVA_SLOVA[i][0]);
    }
    return out;
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
      aktivita: vstup.aktivita || '', prace: vstup.prace || '', sport: vstup.sport || '',
      spanek: vstup.spanek, cil: vstup.cil || '',
      zdravi: vstup.zdravi || '', leky: vstup.leky || '', diety: vstup.diety || ''
    };

    var chybi = [];
    if (v.vek == null) chybi.push('věk');
    if (v.vyska == null) chybi.push('výška');
    if (v.vaha == null) chybi.push('váha');
    if (chybi.length) {
      return { ok: false, chybi: chybi, karty: [], citliva: citliva(v), varovani: [], vstup: v };
    }

    var varovani = [];
    if (v.kroky == null) varovani.push('Kroky v dotazníku nejsou, počítám s ' + K.KROKY_ZAPOCTENE_OD + ' za den (jen běžný pohyb). Doplň je, výdej se posune.');
    if (v.dny_treninku == null) varovani.push('Počet tréninků v dotazníku není, počítám s nulou. Doplň ho, výdej se posune.');
    if (v.trenink_minut == null && v.dny_treninku) varovani.push('Délka tréninku v dotazníku není, počítám ' + K.TRENINK_MINUT_VYCHOZI + ' minut. Přepiš ji, když trénuje déle.');

    var vy = vydej(v);
    var b = bmi(v.vaha, v.vyska);
    var refKg = referencniVaha(v.vaha, v.vyska);
    if (b != null && b >= K.OBEZITA_BMI) {
      varovani.push('BMI ' + cz(Math.round(b * 10) / 10) + ', tedy 30 a víc. Bílkoviny a tuk počítám z referenční váhy '
        + cz(Math.round(refKg * 10) / 10) + ' kg, ne z aktuální. Jinak by bílkoviny snědly skoro celý denní příjem.');
    }
    var cil = odhadCile(v.cil);
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
      var m = makra(kcal, refKg * bilkPerKg, refKg);
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
      ok: true, chybi: [], cil: cil, vydej: vy, bmi: b == null ? null : Math.round(b * 10) / 10,
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
    radky.push('posílám Ti průvodce na míru. Máš tam dva vzorové dny, nákupní seznam na týden a záměny, kterými si jídla můžeš prohodit, aniž bys musel počítat.');
    radky.push('');
    radky.push('Nejsou to dny, které musíš jíst přesně. Jsou to dva příklady toho, jak vypadá den, který Ti sedne do čísel. Když si něco prohodíš podle záměn, sedí to dál.');
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
    K: K, varianty: varianty, priority: priority, citliva: citliva,
    mailUvitaci: mailUvitaci, mailPruvodce: mailPruvodce,
    _vnitrni: { bmr: bmr, bmi: bmi, referencniVaha: referencniVaha, vydej: vydej, makra: makra, vlakninaG: vlakninaG, odhadCile: odhadCile, metSportu: metSportu, nasobicDne: nasobicDne }
  };
});
