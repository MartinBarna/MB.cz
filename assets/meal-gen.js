// ⛔⛔ TENHLE GENERÁTOR EXISTUJE DVAKRÁT. KAŽDÁ ZMĚNA SE DĚLÁ DO OBOU.
// Protějšek: appka Tvůj Coach → src/engine/meal-gen.ts
// Web navíc obsluhuje Academy, obě kalkulačky I lite verzi zdarma, takže jeden soubor
// pokrývá čtyři místa. Když se sáhne jen na jednu stranu, uživatelé dostanou různé
// výsledky podle toho, kudy přišli, a nikde to nekřikne.
// Hlídá to pre-commit hook přes `node scripts/hlidac-dvou-verzi.mjs` v repu appky.
// Commit, který obě strany rozejde, NEPROJDE. Detail: paměť `tvujcoach-jeden-generator-cil`.
/* Barna Academy — engine generátoru jídelníčků. (v 2026-07-22b)
   Čistě klientský, deterministický. Žádný backend.
   1) computeTargets() — kalorie + makra z údajů klienta (Mifflin–St Jeor).
   2) assembleDay()   — poskládá den z potravinové DB tak, aby seděla makra.
   DB se načítá z /assets/food-db.json (pole položek {id,name,cat,per100:{kcal,p,c,f},portion,portionLabel}).
*/
(function (global) {
  'use strict';

  var ACT = { sedavy:1.2, lehka:1.375, stredni:1.55, vysoka:1.725, extremni:1.9 };
  var GOAL = {
    hubnuti:       { kcal:0.80, protein:2.0, fatPct:0.27, label:'Hubnutí' },
    mirne_hubnuti: { kcal:0.88, protein:1.9, fatPct:0.28, label:'Mírné hubnutí' },
    udrzeni:       { kcal:1.00, protein:1.8, fatPct:0.30, label:'Udržení' },
    mirny_narust:  { kcal:1.10, protein:1.8, fatPct:0.28, label:'Mírný nárůst svalů' },
    narust:        { kcal:1.15, protein:1.8, fatPct:0.27, label:'Nabírání svalů' }
  };

  function round(n, step) { step = step || 1; return Math.round(n / step) * step; }

  // ---- 1) Cílové kalorie a makra ----
  function computeTargets(inp) {
    var w = +inp.weight, h = +inp.height, age = +inp.age;
    var bmr = 10 * w + 6.25 * h - 5 * age + (inp.sex === 'zena' ? -161 : 5);
    var tdee = bmr * (ACT[inp.activity] || 1.375);
    var g = GOAL[inp.goal] || GOAL.udrzeni;
    // ⛔ [2026-09-02, Martin, nález E19] Bezpečnostní kalorická podlaha: 1200 žena,
    // 1500 muž. Cíl je zatím jen procento z TDEE, takže drobná žena nebo muž se
    // sedavým režimem mohl dostat pod hranici, pod kterou hubnutí patří pod dohled.
    // ⛔ Táž podlaha je v appce (`kcalFloorForSex` v src/engine/goals.ts) a platí tam
    // pro startovací cíl, ruční cíl I týdenní adaptaci. Kdo ji mění, mění obě strany.
    var kcalFloor = inp.sex === 'zena' ? 1200 : 1500;
    var kcalBezPodlahy = Math.round(tdee * g.kcal);
    var kcal = Math.max(kcalFloor, kcalBezPodlahy);
    // [revize R5] Podlaha nesmí být tichá. Když zvedne cíl, uživatel se to dozví,
    // a když ho zvedne až NAD denní výdej (drobný nebo starší muž se sedavým režimem),
    // není to plán na hubnutí a nesmí se tak tvářit. Appka na to má
    // `rate_capped_kg_per_week`, web to dosud neměl vůbec.
    var podlahaZvedla = kcal > kcalBezPodlahy;
    var nadVydejem = podlahaZvedla && kcal >= Math.round(tdee);
    var poznamkaPodlahy = null;
    if (nadVydejem) {
      poznamkaPodlahy = 'Bezpečnostní podlaha ' + kcalFloor + ' kcal je u tebe výš než tvůj '
        + 'denní výdej (' + Math.round(tdee) + ' kcal). Tenhle plán proto není deficit. '
        + 'Ubírat jídlo pod tuhle hranici nemá smysl, tempo se řeší pohybem.';
    } else if (podlahaZvedla) {
      poznamkaPodlahy = 'Cíl drží bezpečnostní podlaha ' + kcalFloor + ' kcal. '
        + 'Spočítané číslo bylo nižší (' + kcalBezPodlahy + ' kcal) a níž nejdeme.';
    }
    // [fix 2026-07-14] u výrazné nadváhy počítej bílkoviny z upravené hmotnosti (výška−100,
    // min. 75 % váhy) — 2 g × 115 kg = 230 g bílkovin v deficitu je nesmysl, který se nedá
    // ani poskládat z jídla; pro běžné váhy se nic nemění.
    var refW = Math.min(w, Math.max(h - 100, w * 0.75));
    var protein = Math.round(refW * g.protein);       // g
    var fat = Math.round((kcal * g.fatPct) / 9);      // g
    var carbsKcal = kcal - (protein * 4 + fat * 9);
    var carbs = Math.max(40, Math.round(carbsKcal / 4)); // g, pojistka
    // dorovnej kcal po zaokrouhlení
    kcal = protein * 4 + carbs * 4 + fat * 9;
    // Cílová vláknina: 14 g / 1000 kcal (US Dietary Guidelines), podlaha `FIBER_FLOOR_G`.
    // ⛔ [2026-09-02] Strop 60 g doplněn: generátor níž vlákninu nad `FIBER_CAP_G` nepustí,
    // takže bez tohohle clampu by kalkulačka u velmi vysokých cílů (nad 4 300 kcal) slíbila
    // číslo, které jídelníček vědomě nesplní. Podlaha je od téhož dne 20 g, stejně jako
    // v appce; dřív tu bylo 25 a ta dvě čísla si na 1300 kcal odporovala.
    var fiber = Math.min(FIBER_CAP_G, Math.max(FIBER_FLOOR_G, Math.round(kcal / 1000 * 14)));
    return { kcal: kcal, protein: protein, carbs: carbs, fat: fat, fiber: fiber,
             bmr: Math.round(bmr), tdee: Math.round(tdee), goalLabel: g.label,
             // [revize R5] příznaky podlahy pro UI; obdoba `rate_capped_kg_per_week` v appce
             kcalFloor: kcalFloor, rateCapped: podlahaZvedla,
             floorAboveTdee: nadVydejem, floorNote: poznamkaPodlahy };
  }

  /**
   * Sacharidy v EVROPSKÉ konvenci, tedy BEZ vlákniny, jak je čte člověk na etiketě
   * v českém obchodě. Vláknina se sleduje zvlášť.
   * ⚠️ Databáze míchá dvě konvence: část přišla z USDA, kde jsou sacharidy VČETNĚ vlákniny
   * („carbohydrate by difference"), část z evropských etiket, kde jsou bez ní. Uživatel to
   * nepoznal: u ovesných otrub viděl 66 g, u mraženého hrášku 10 g, a nevěděl, že každé
   * číslo znamená něco jiného. Konvenci nese pole `per100.carbBasis`, doložil ji Grok
   * proti USDA FoodData Central a nutridatabaze.cz, položku po položce, s odkazem.
   * ⛔ **Co pole nemá, se nechává být.** Nedopočítáváme nic, co nevíme.
   * ⛔ Táž logika je v appce (`src/engine/meal-gen.ts`).
   */
  function sacharidyAvailable(food) {
    var c = isFinite(food.per100.c) ? food.per100.c : 0;
    if (food.per100.carbBasis !== 'total') return c;
    var fib = isFinite(food.per100.fib) ? food.per100.fib : 0;
    return Math.max(0, c - fib);
  }

  // ---- pomocné: makra porce dané potraviny při X gramech ----
  function macrosFor(food, grams) {
    var k = grams / 100;
    // [fix 2026-07-26] Chybějící makro se bere jako nula, ne jako NaN.
    // ⚠️ PROČ: `kureci-prsa` neměla v databázi pole `c` ani `fib`. Jedna položka z 1191.
    // `undefined * k` je NaN, ten propadl do součtu kategorie, z něj do škálovacího
    // faktoru a odtud do gramáže VŠECH bílkovinných položek dne. V appce klient viděl
    // „NaN g · NaN kcal" u masa a v nákupním seznamu „Kuřecí prsa · NaN g".
    // Zelenina vycházela správně, protože se neškáluje, což tu vadu maskovalo.
    // Konzole přitom mlčela, NaN se nikde nevyhodí jako chyba.
    // ⛔ Táž pojistka je v appce (`src/engine/meal-gen.ts`).
    var cislo = function (x) { return isFinite(x) ? x : 0; };
    return {
      kcal: cislo(food.per100.kcal) * k, p: cislo(food.per100.p) * k,
      c: sacharidyAvailable(food) * k, f: cislo(food.per100.f) * k,
      fib: cislo(food.per100.fib) * k
    };
  }

  // [fix 2026-07-22] nodairy: kategorii 'dairy' řeší excludeCat; tohle chytá mléčné položky
  // schované v jiných kategoriích (tvaroh/skyr/whey v protein, máslo a ghí ve fat). Ořechová
  // „másla" (arašídové, mandlové…) ani máslová ryba mléčné nejsou.
  function isDairyExtra(id) {
    if (/tvaroh|skyr|cottage|syrovatk|prepusten/.test(id)) return true;
    if (/maslo/.test(id)) return !/(mandl|kesu|arasid|liskooris|kokos|burak|slunecnic|sezam|rostlinn|maslov)/.test(id);
    return false;
  }

  // [2026-08-09] Smí tahle potravina do jídelníčku, který má být bez dané věci?
  //
  // ⛔⛔ POLARITA JE OPAČNÁ NEŽ U `nonveg` A JE TO ZÁMĚR.
  // Projde jen položka, u které osa NENÍ ani v `obsahuje`, ani v `nejiste`, a která
  // vůbec MÁ pole `obsahuje`. Neprotříděná potravina tedy neprojde nikdy. `nonveg` má
  // polaritu opačnou (co není označené, projde jako bezmasé) a přesně tudy v červenci
  // 2026 proteklo vegetariánům 89 druhů masa. Nová potravina smí propadnout leda směrem
  // k přísnosti, nikdy k tvrzení.
  //
  // ⛔ `nejiste` je plnohodnotná odpověď, ne nedodělek. U salámu nebo rostlinného burgeru
  // rozhoduje o lepku výrobce, ne druh potraviny, takže se nic netvrdí. U lepku je chyba
  // zdravotní: celiak, který uvěří našemu „bez lepku", onemocní.
  // ⛔ Stejná funkce je v appce (`src/engine/meal-gen-core.ts`), hlídá parita-jidelnicku.mjs.
  function neobsahuje(f, osa) {
    if (!Array.isArray(f.obsahuje)) return false; // neprotříděno = neručíme za nic
    if (f.obsahuje.indexOf(osa) !== -1) return false;
    return !(Array.isArray(f.nejiste) && f.nejiste.indexOf(osa) !== -1);
  }

  // filtr DB podle preferencí (vyloučení kategorií/ id)
  function filterDb(db, prefs) {
    prefs = prefs || {};
    var exclCat = prefs.excludeCat || [];     // např. ['dairy']
    var exclId = prefs.excludeId || [];
    // ⛔⛔ POJISTKA PROTI NASAZENÍ VE ŠPATNÉM POŘADÍ. Změřeno 9. 8. 2026: nad databází BEZ
    // dietních tagů vrátí generátor se zapnutým dietním filtrem den se čtyřmi jídly a NULOU
    // položek, 0 kcal, bez chybové hlášky. Tichý prázdný jídelníček je horší než pád.
    // Nastane jedině tehdy, když se kód a data rozejdou (edge funkce si food-db stahuje
    // z martinbarna.cz za běhu). ⛔ Stejná pojistka je v appce (meal-gen-core.ts).
    if ((prefs.vegan || prefs.bezLaktozy || prefs.bezLepku) &&
        !db.some(function (f) { return Array.isArray(f.obsahuje); })) {
      throw new Error('meal-gen: databáze potravin nemá dietní tagy (pole `obsahuje`), ale je ' +
        'zapnutý dietní filtr. Nejdřív musí být venku nová food-db.json, teprve pak to, co ji filtruje.');
    }
    return db.filter(function (f) {
      if (exclCat.indexOf(f.cat) !== -1) return false;
      if (exclId.indexOf(f.id) !== -1) return false;
      // [fix 2026-07-22] vegetariána řídí flag nonveg PŘÍMO v DB (klasifikace všech 1182
      // položek vč. světové kuchyně; rostlinné náhražky s masovým názvem flag nemají).
      // Starý id regex zůstává jako záchranná síť pro případné neoflagované budoucí přírůstky.
      if (prefs.vegetarian && (f.nonveg ||
          /kure|krut|hovez|veprov|losos|tunak|treska|sunka|sardin|stehno|mlete|krevet/.test(f.id))) return false;
      if (exclCat.indexOf('dairy') !== -1 && isDairyExtra(f.id)) return false;
      // Vegan je přísnější než vegetarián: mimo maso vylučuje i vejce, mléčné a med.
      if (prefs.vegan && !neobsahuje(f, 'zivocisne')) return false;
      if (prefs.bezLaktozy && !neobsahuje(f, 'laktoza')) return false;
      if (prefs.bezLepku && !neobsahuje(f, 'lepek')) return false;
      return true;
    });
  }

  // vhodnost potravin do snídaně / svačiny (ať nevyjde kuřecí prsa k snídani)
  // [fix 2026-08-05 večer] Ze snídaňových bílkovin pryč `bilek` a prášek: 150 g čistého
  // bílku není snídaně, normální člověk jí VEJCE. Bílek i prášek zůstávají v záměnách
  // a v doplňkovém bloku. Táž změna v appce, hlídá parita.
  var BREAKFAST_PROT = /vejce|tvaroh|skyr|cottage|sunka/;
  var SNACK_PROT     = /tvaroh|skyr|cottage|syrovatkovy-protein|recky-jogurt|bily-jogurt|sunka/;
  // [fix 2026-08-05 večer] Proteinový prášek a čistý bílek NEJSOU základ hlavního jídla
  // („syrovátkový protein 55 g + těstoviny + rajče" jako oběd nikdo jíst nebude).
  // [R3 2026-09-03] Vnitřnosti jsou surovina pro kuchaře, ne základ vygenerovaného jídla.
  // Změřeno na 48 dnech: hovězí a kuřecí játra padla jako oběd ve 14 dnech ze 48, protože
  // jsou extrémně libová a `leanOnly` po nich v deficitu sáhne první. Zůstávají v záměnách
  // a v zápisu deníku, jen se nevybírají do výchozího dne; v food-db.json obou stran jim
  // navíc zmizel flag `bezny`. ⚠️ `jazyk` NEJDE jako podřetězec: `morsky-jazyk` je ryba.
  // ⛔ Táž logika je v appce (src/engine/meal-gen-core.ts), hlídá parita.
  var NENI_ZAKLAD_JIDLA = /syrovatkovy-protein|sojovy-protein-izolat|^bilek$|^tvaroh-tvrdy$|jatra|ledvin|^srdce|(hovezi|veprovy|kruti|telaci)-jazyk|drstk/;
  // [fix 2026-08-06] Šunka a spol. NEJSOU hlavní bílkovina oběda/večeře: uzenina je na
  // chleba a do svačiny, na hlavní jídlo lidi vaří maso/rybu. U hlavních jídel se masné
  // výrobky řadí AŽ ZA vařené zdroje (měkce, s fallbackem). Uzené RYBY zůstávají.
  // Snídaně/svačiny mají šunku dál v preferencích. ⛔ Táž logika v appce, hlídá parita.
  var UZENINA_RE = /sunka|salam|klobas|parky|slanina|debrecin|kabanos|mortadela/;
  // [fix 2026-08-06 kolo 3] Uzenina má strop 80 g NA TALÍŘI. 160 g šunky jako jediný
  // základ snídaně nikdo nejí; snídaňová uzenina se ořeže na 80 g a zbytek bílkovin
  // doplní DRUHÝ zdroj (vejce/tvaroh/skyr/cottage). ⛔ Táž logika v appce, hlídá parita.
  var UZENINA_MAX_G = 80;
  // [R1 2026-09-03] Druhý snídaňový zdroj smí být JEN vejce nebo sýr, ne tvaroh/skyr/cottage.
  // Slaná snídaně se sladkým mlékárenským zdrojem je nejčastější vada výstupu (šunka 70 g
  // + tvaroh měkký 125 g + toust + paprika + jahody, profil a, seed 0). Vejce a sýr se
  // k šunce na chleba hodí, tvaroh a skyr patří ke sladké snídani s ovocem.
  // ⚠️ KOTVENÉ `^(...)`: podřetězec `syr` chytá i `syrovatkovy-protein`.
  // ⛔ Táž logika je v appce, hlídá parita.
  var SNIDANE_DOPLNEK_PROT = /^(vejce|eidam|gouda|mozzarella|cedar|emental|feta|brie|hermelin|niva|parmazan|balkansky-syr|kozi-syr|uzeny-syr|taveny-syr|halloumi|bryndza|olomoucke-tvaruzky)/;
  // [R2 2026-09-03] SLANÝ A SLADKÝ ZÁKLAD SE NA JEDNOM TALÍŘI NEPOTKAJÍ.
  // Změřeno na 48 dnech: 36 jídel míchalo uzeninu se sladkým základem a 12 dní dávalo
  // 150 g syrové papriky ke sladké snídani. Ke slanému základu (uzenina, vejce, sýr) patří
  // pečivo a zelenina, ke sladkému (tvaroh, skyr, cottage, jogurt) vločky, müsli nebo
  // pečivo a ovoce. Co není sladké, bere se jako slané (maso, ryba, tofu → pečivo a zelenina).
  // ⛔ Táž logika je v appce, hlídá parita.
  // [oprava po revizi 2026-09-03] Kotva `^mleko` mijela `kysane-mleko` (bezna potravina),
  // `ryzove-mleko`, `sojove-mleko-cokoladove`, `ovesne-mleko-barista` i `mandlove-mleko-slazene`.
  // Ty pak spadly do SLANE vetve a dostaly pecivo a zeleninu; revize namerila zive
  // Sojove mleko cokoladove 300 g + pohanka + polnicek jako veceri.
  // Kotva je pryc: v cele DB neni jedina SLANA polozka, ktera by mela `mleko` v id.
  // ⛔ Stejny regex je v appce, hlida parita-jidelnicku.mjs.
  // [vlna 2, 2026-09-03] Doplneny sladke mlecne polozky BEZ klicoveho slova z vyctu vys:
  // `termix-vanilkovy`, `mlecna-kase-*` (krupicova vanilkova, ovesna jablko-skorice,
  // ryzova cokoladova, i detske varianty) a `ryzova-kase-mlecna`. Vsechny maji v DB
  // `cat='dairy'`, takze bez tohohle spadly do SLANE vetve a dostaly pecivo a zeleninu.
  // Regex `mlecna-kase` NECHYTA `nemlecna-pohankova-kase-hruska`, overeno pres celou DB.
  var SLADKY_ZAKLAD = /tvaroh|skyr|cottage|jogurt|syrovatkovy-protein|proteinovy-pudink|kefir|podmasli|acidofilni|mleko|termix|mlecna-kase|ryzova-kase-mlecna/;
  // [R7 2026-09-03, rozhodnuti sefa] SLADKY MLECNY ZAKLAD NENI ZAKLAD OBEDA ANI VECERE.
  // Hlavni jidlo stoji na mase, rybe, vejcich, lusteninach nebo tofu/tempehu; syr je
  // doplnek, ne zaklad. Tvaroh, skyr, jogurt, mleko a mlecne dezerty patri do snidane
  // a svacin. Zmereno na mrizce 1152 dnu: 713 obedu a veceri stalo na skyru nebo tvarohu.
  // ⚠️ KOTVENE `^(...)`: nekotvene `syr` chyta i `syrovatkovy-protein`.
  // ⛔ Taz logika je v appce, hlida parita.
  var SYR_RE = /^(eidam|gouda|mozzarella|cedar|emental|feta|brie|hermelin|niva|parmazan|balkansky-syr|kozi-syr|uzeny-syr|taveny-syr|halloumi|bryndza|olomoucke-tvaruzky|ricotta|lucina|zerve)/;
  // Pečivo jako příloha ke slanému základu. Vločky a müsli tu schválně NEJSOU.
  var PECIVO_RE = /chleb|rohlik|houska|knackebrot|toustovy|pita|bageta|dalamanek|kaiserka|grahamovy/;
  // [R6 2026-09-03] Strop na JEDNO jídlo u pečiva, vloček a müsli. Bez něj vyšel
  // toustový chléb celozrnný 350 g a müsli 320 g jako jedna položka snídaně
  // (profil d, seedy 6 a 7); to je třetina kila. Vařené přílohy si strop 320/500 g drží.
  var PECIVO_VLOCKY_RE = /chleb|rohlik|houska|knackebrot|toustovy|pita|bageta|dalamanek|kaiserka|grahamovy|ovesne-vlocky|musli|granola|krekry|lupinky|otruby|tortilla/;
  var STROP_PECIVO_G = 120;
  // [R6 2026-09-03] Ovoce v jednom jídle. 250 g pomeranče k obědu je miska, ne ozdoba.
  var STROP_OVOCE_G = 200;
  // [R5 2026-09-03] MINIMÁLNÍ PORCE. Cokoli mimo kategorii `fat` musí být aspoň 20 g.
  // Změřeno na 48 dnech: 63 položek pod 20 g (rozinky 15 g, slunečnicová semínka 11 g)
  // jako plnohodnotná součást jídla. Klient to neodváží a v plánu to působí jako chyba.
  // TUKY zůstávají jak jsou: 8 g oleje je normální gramáž na lžičku.
  // ⛔ Táž hodnota je v appce, hlídá parita.
  var MIN_PORCE_G = 20;
  // [R8 2026-09-03, rozhodnuti sefa] STROPY TUKU NA JEDNO JIDLO.
  // Zmereno na mrizce 1152 dnu: 449 jidel s pridanym tukem nad 15 g (rekord 50 g ghi),
  // 666 jidel s orechy nebo seminky nad 30 g a 413 jidel s chia nebo lnenym seminkem
  // nad 20 g (rekord 50 g chia). Chybejici tuk se ma dorovnat tucnejsim zdrojem
  // bilkoviny nebo avokadem, ne litrem oleje.
  // ⚠️ PORADI TESTU JE ZAMERNE: `kokosovy-olej` chytne PRIDANY_TUK_RE driv, nez by ho
  // vzal ORECHY_SEMINKA_RE pres „kokos"; `mandlove-maslo` a `araside-maslo` maji projit
  // jako orechove maslo (strop 30 g), proto je maslo KOTVENE `^maslo$`. Avokado v zadnem
  // z nich neni a drzi si strop kategorie. ⛔ Tytez hodnoty i poradi jsou v appce.
  var PRIDANY_TUK_RE = /olej|^maslo$|^ghi$|^sadlo|prepustene-maslo|majone|smetana/;
  var CHIA_LEN_RE = /chia|lnene/;
  var ORECHY_SEMINKA_RE = /orech|mandle|kesu|arasid|pistacie|liskove|makadam|seminka|seminko|slunecnice|^mak$|kokos/;
  var STROP_PRIDANY_TUK_G = 15;
  var STROP_CHIA_G = 20;
  var STROP_ORECHY_G = 30;
  /** [R8] Strop porce tuku na JEDNO jidlo. `null` = kategorie si strop resi sama. */
  function stropTuku(f) {
    if (f.cat !== 'fat') return null;
    if (PRIDANY_TUK_RE.test(f.id)) return STROP_PRIDANY_TUK_G;
    if (CHIA_LEN_RE.test(f.id)) return STROP_CHIA_G;
    if (ORECHY_SEMINKA_RE.test(f.id)) return STROP_ORECHY_G;
    return null;
  }
  // [R9 2026-09-03, rozhodnuti sefa] HLAVNI JIDLO MA ZELENINU A ROZUMNOU PRILOHU.
  // Zelenina aspon 100 g (na malem dni ji `velikostDne` srazel na 95 g, a u jidel,
  // ktera zeleninu ztratila prerozdelenim pretizeneho taliře, na nulu).
  // Priloha nejvys 300 g VARENE hmotnosti. DB ma oboje: varene polozky (ryze varena
  // 123 kcal/100 g, brambory 86, testoviny 150) i suche (ryze 360, quinoa 368, bulgur
  // 342). Sucha se uvarenim zhruba ztrojnasobi, takze 300 g varene je asi 100 g suche.
  // Hranice 200 kcal/100 g je v DB cista mezera: nejvyssi varena polozka ma 160 kcal,
  // nejnizsi sucha 218 (a ta je pecivo, osetrene stropem 120 g).
  // ⛔ Tytez hodnoty jsou v appce, hlida parita.
  var MIN_ZELENINA_HLAVNI_G = 100;
  var STROP_PRILOHA_VARENA_G = 300;
  var STROP_PRILOHA_SUCHA_G = 100;
  var SUCHA_PRILOHA_KCAL = 200;
  // [R10 2026-09-03, rozhodnuti sefa] ZELENINA K HLAVNIMU JIDLU JE ZE „SLANEHO" OKRUHU.
  // Sladka kukurice, pastinak a cervena repa se k rybe ani k veprovemu nedavaji; SuperGrok
  // je nasel na 48 dnech devetkrat (Pangasius + sladka kukurice + pastinak, Tunak +
  // jasminova ryze + cervena repa, Veprova kyta + kukurice + repa).
  // ⛔ Pravidlo stoji na SEZNAMU z DB, ne na hadani. Sladke OVOCE se k hlavnimu jidlu
  // nedostane uz pres R2 (ovoce jde jen ke sladkemu zakladu, a ten u obeda a vecere
  // podle R7 byt nesmi). ⛔ Tytez seznamy jsou v appce, hlida parita.
  var SLANA_ZELENINA_RE = /^(brokolice|spenat|paprika|rajce|cherry-rajcata|okurka|kysela-okurka|ledovy-salat|salat|rukola|polnicek|cuketa|zeli|kysane-zeli|fazolky|mrkev|kvetak|kapusta|ruzickova-kapusta|kedluben|chrest|lilek|zampiony|hliva|redkvicka|celer|porek|cinske-zeli|kaderavek|dyne-hokaido|zeleny-hrasek)/;
  var SLADKA_ZELENINA_RE = /kukurice|pastinak|cervena-repa|nakladana-repa/;
  /** [R10] Sladka PRILOHA (kukurice jako `cat='carb'`) se nepáruje s rybou ani s veprovym. */
  var SLADKA_PRILOHA_RE = /kukurice/;
  var RYBA_VEPROVE_RE = /^(treska|losos|tunak|pangasius|makrela|sardink|platys|pstruh|kapr|candat|sled|zavinac|krevety|veprov|debrecin)/;
  // [R11 2026-09-03, rozhodnuti sefa] KETO/LOW-CARB NEDOSTANE OBILOVINY.
  // Do teto vlny `lowCarb` jen vypinal PODLAHU prilohy, takze se do keto dne porad
  // dostal zitny chleb 20 g, bulgur vareny 90 g nebo testoviny 35 g (zmereno 170 polozek
  // na 1152 dnech). Drobek obiloviny keto cil nesplni a na taliři vypada jako chyba.
  // Nove se v keto rezimu priloha NESKLADA vubec, ovoce se tvrde zuzuje na bobule a kdyz
  // se cil nesejde, den to REKNE (pole `warnings`), misto aby zamichal obiloviny.
  // ⛔ Taz logika je v appce, hlida parita.
  var BOBULE_RE = /malin|boruvk|jahod|ostruzin|rybiz|brusink|lesni-ovoce/;
  // [R2] Je základ jídla sladký (mlékárenský), nebo slaný? Co není sladké, je slané.
  function jeSladkyZaklad(f) { return !!f && SLADKY_ZAKLAD.test(f.id); }
  // [fix 2026-08-06 kolo 4] Párování tuku k charakteru jídla (detail u použití níž).
  // ⚠️ KOTVENÉ `^(...)$`: nekotvené `maslo` chytá i `mandlove-maslo`. ⛔ Táž logika v appce.
  var SLADKY_TUK = /^(mandle|vlasske-orechy|liskove-orechy|kesu|araside|arasidy|mandlove-maslo|araside-maslo|chia-seminka|lnene-seminko|pistacie)$/;
  var SLANY_TUK = /^(olivovy-olej|repkovy-olej|slunecnicovy-olej|maslo|ghi|avokado|dynova-seminka|slunecnicova-seminka)$/;

  // ⛔⛔ HYGIENICKÝ STROP VLÁKNINY (g/den). V appce žije v `src/engine/meal-gen-core.ts`
  // jako exportovaná `FIBER_CAP_G` a `goals.ts` si ho odtud importuje, aby nikde nebyla
  // druhá kopie čísla. Tady je jeho zrcadlo pro web, hlídá parita-jidelnicku.mjs.
  // ⚠️ Cíl vlákniny je PODLAHA, tohle je STROP. Nad 60 g denně je vláknina trávicí
  // problém (nadýmání, průjem, horší vstřebávání minerálů), ne bonus. Audit 2. 9. 2026
  // naměřil 18 % dnů nad stropem a rekord 96 g vlákniny za den.
  var FIBER_CAP_G = 60;
  // ⛔⛔ PODLAHA VLÁKNINY (g/den). Rozhodnutí Martina 2. 9. 2026: JEDNO ČÍSLO VŠUDE.
  // Do té doby měla tahle kalkulačka 25 g, appka a onboarding 20, takže klient na
  // 1300 kcal viděl na webu 25 a v appce 20. Teď je to 20 na obou stranách.
  // Zrcadlo appkové `FIBER_FLOOR_G` (`src/engine/goals.ts`) a `K.VLAKNINA_MIN`
  // v `assets/onboarding-cile.js`. Exportuje se na `window.MealGen`, aby si ho
  // `akademie/admin/pruvodce.js` nemusel psát podruhé.
  var FIBER_FLOOR_G = 20;
  // ⛔ STROP HMOTNOSTI JEDNOHO JÍDLA (gramy všeho na talíři dohromady). Audit našel jedno
  // jídlo o 1 257 g: každá položka byla pod svým stropem (`CAP`), ale součet jídla nikdo
  // nehlídal. ⚠️ ROZHODNUTÍ, ne doložené číslo (viz komentář v appkovém jádru).
  var STROP_HLAVNI_JIDLO_G = 700;
  var STROP_SVACINA_G = 400;

  // [2026-08-06 kolo 3] Keto varianta cílů: sacharidy na ~8 % kalorií, bílkoviny drží,
  // zbytek kalorií dorovná tuk. Jediná keto matematika pro web, appku i AI kouče.
  // ⛔ Táž funkce v appce (meal-gen-core.ts), hlídá parita.
  function ketoTargets(t) {
    var carbs = Math.round((t.kcal * 0.08) / 4);
    var fat = Math.max(20, Math.round((t.kcal - t.protein * 4 - carbs * 4) / 9));
    // Kopie vstupu drží doprovodná pole (fiber, popisek cíle z computeTargets), jen
    // přepíše carbs+fat. Bez toho UI v keto ukazovalo „cíl: undefined" a vlákninu undefined.
    var out = {};
    for (var k in t) out[k] = t[k];
    out.carbs = carbs; out.fat = fat;
    return out;
  }
  var BREAKFAST_CARB = /ovesne-vlocky|chleb|musli|knackebrot|tousty|rohlik|houska/;
  var MAIN_CARB      = /ryze|brambory|bataty|testoviny|kuskus|bulgur|quinoa|pohanka|jahly|kukurice|tortilla|ryzove-nudle/;

  // vyber položku z kategorie, rotuj podle seedu (variabilita mezi generacemi).
  // prefer = volitelný regex na id: nejdřív zkus vhodnou podmnožinu, jinak celá kategorie.
  function pick(db, cat, seed, prefer) {
    var list = db.filter(function (f) { return f.cat === cat; });
    if (!list.length) return null;
    if (prefer) {
      var sub = list.filter(function (f) { return prefer.test(f.id); });
      if (sub.length) list = sub;
    }
    // [fix 2026-08-05] Výchozí den se skládá JEN z běžných potravin (flag `bezny` v DB,
    // 283 z 1192; přiděluje `scripts/oznac-bezne-potraviny.mjs` v repu appky). Bez toho
    // vybíral generátor rovnoměrně z celé DB plné světové kuchyně a dětských příkrmů:
    // změřeno na 240 dnech, 100 % dní mělo exotickou položku a exotická byla každá druhá
    // (51 %). Grok na Academy potřeboval 15+ generování, než padlo běžné české menu.
    // Exotika NEmizí: v záměnách (⇄) se řadí až za běžné. Fallback na celou nabídku
    // drží průchodnost úzkých filtrů (vegetarián + bez mléčných + libové).
    // ⛔ Stejná logika je v appce (`src/engine/meal-gen.ts`), hlídá parita-jidelnicku.mjs.
    var bezne = list.filter(function (f) { return f.bezny; });
    if (bezne.length) list = bezne;
    // [fix 2026-07-26] Seed se před výběrem rozptýlí. Databáze je řazená abecedně a seedy
    // chodí malé (1, 2, 3…), takže prosté `seed % délka` sahalo pořád na začátek abecedy.
    // Grok při testu vypsal: „silný sklon k potravinám na začátku abecedy: Angrešt,
    // Ančovička, Aronie, Arašídy, Anglická slanina, Bambusové výhonky."
    // Knuthův multiplikativní hash rozprostře i sousední seedy po celé nabídce. Výběr
    // zůstává deterministický. ⛔ Stejná oprava je v appce, hlídá `parita:jidelnicek`.
    return list[((seed * 2654435761) >>> 0) % list.length];
  }

  /**
   * [2026-09-02] Rozložení kalorií do jídel. Svačina se pozná podle TYPU jídla, ne podle
   * podílu kalorií, takže rozdělení není svázané hranicí 20 % jako dřív.
   *
   * ⛔ [oprava po revizi 2026-09-02] Šestijídlový den měl původně
   * `[0.20, 0.10, 0.28, 0.10, 0.25, 0.07]` a bylo to měřitelně špatně: revize naměřila,
   * že při 1800 kcal skončila večerní svačina pod 150 kcal ve 125 dnech ze 150
   * (nejmenší mělo 77 kcal a 1,3 g bílkovin, tedy jedno jablko), a obě denní svačiny
   * v 71 a 72 případech. Sedm procent z 1800 kcal prostě není porce, na kterou se dá
   * pověsit bílkovina.
   *
   * Nové rozdělení zvedá všechny tři svačiny na 15 % na úkor hlavních jídel. Změřeno
   * na 900 jídlech pro každý cíl: jídel pod 150 kcal kleslo z 268 na 2 při 1800 kcal,
   * z 85 na 1 při 2500 a z 27 na 0 při 3300. ⚠️ NENÍ to nula: zbylé případy jsou svačiny,
   * kterým pod úzkým filtrem (vegan a zároveň bez lepku) vypadne bílkovinný zdroj,
   * a to rozdělením kalorií spravit nejde.
   * ⛔ Táž tabulka je v appce (`src/engine/meal-gen-core.ts`), hlídá parita-jidelnicku.mjs.
   */
  function distProJidla(meals) {
    if (meals === 3) return [0.30, 0.40, 0.30];
    if (meals === 4) return [0.28, 0.34, 0.13, 0.25]; // svačina = malá (snack), ne druhý oběd
    if (meals === 5) return [0.22, 0.10, 0.30, 0.10, 0.28];
    return [0.19, 0.15, 0.20, 0.15, 0.16, 0.15];
  }

  /** Výchozí popisky jídel. Vlastní si volající předá přes `opts.mealNames`. */
  function vychoziNazvyJidel(meals) {
    if (meals === 3) return ['Snídaně','Oběd','Večeře'];
    if (meals === 4) return ['Snídaně','Oběd','Svačina','Večeře'];
    if (meals === 5) return ['Snídaně','Dopolední svačina','Oběd','Odpolední svačina','Večeře'];
    return ['Snídaně','Dopolední svačina','Oběd','Odpolední svačina','Večeře','Večerní svačina'];
  }

  /**
   * [2026-09-02] TYP JÍDLA: 'breakfast' | 'snack' | 'lunch' | 'dinner' | 'late'.
   * ⛔ NAHRAZUJE hádání z názvu jídla (dřív se hledaly podřetězce „sníd" a „svačin").
   * Jakmile si někdo jídla přejmenuje na „Snídaně před prací" nebo „Večeře po tréninku",
   * stringový parsing buď náhodou vyjde, nebo TIŠE vybere špatné potraviny.
   * `late` = večerní svačina u šestijídlového dne, chová se jako svačina.
   * ⛔ Táž funkce je v appce, hlídá parita-jidelnicku.mjs.
   */
  function typyJidel(meals) {
    if (meals === 3) return ['breakfast','lunch','dinner'];
    if (meals === 4) return ['breakfast','lunch','snack','dinner'];
    if (meals === 5) return ['breakfast','snack','lunch','snack','dinner'];
    return ['breakfast','snack','lunch','snack','dinner','late'];
  }

  // ---- 2) Sestav den ----
  // opts: { meals: 3..6, prefs, seed, db, mealNames }
  function assembleDay(targets, opts) {
    opts = opts || {};
    var meals = Math.min(6, Math.max(3, opts.meals || 4));
    var seed = opts.seed || 0;
    var db = filterDb(opts.db, opts.prefs);

    // [fix 2026-07-22] Těsný tukový rozpočet (typicky deficit: ~0,3 g tuku na 1 g bílkovin):
    // tučné bílkovinné zdroje (vejce, mleté 20 %, losos) nesou tolik skrytého tuku, že se den
    // nedá doškálovat — normalizace umí hýbat jen kategorií 'fat', a tuk pak přestřelil až 2×
    // a kalorie o 20–35 % s ním. Když je poměr tuk/bílkoviny cíle pod 0,5, vybírej bílkovinné
    // zdroje libové (f/p ≤ 0,4, např. kuřecí, treska, tvaroh, bílek); plnotučné zůstávají pro
    // volnější cíle. Když libový kandidát není (úzké filtry), spadne to zpět na celou nabídku.
    var leanOnly = targets.fat / Math.max(1, targets.protein) < 0.5;
    function isLean(f) { return f.per100.f <= Math.max(3, (f.per100.p || 0) * 0.4); }
    // [fix 2026-08-05 večer] PŘÍLOHA JE STRUKTURÁLNÍ SOUČÁST HLAVNÍHO JÍDLA, ne položka,
    // která smí vypadnout kvůli makrům. Martin z reálného výstupu (1200 kcal / 48 g sach.):
    // „kuřecí + brokolice + máslo" bez přílohy nikdo jíst nebude. Pokud cíle nejsou
    // fakticky keto (pod 12 % kalorií ze sacharidů), má každé hlavní jídlo přílohu
    // s podlahou 40 g; zmenšuje se, neruší. ⛔ Táž logika v appce, hlídá parita.
    var lowCarb = (targets.carbs * 4) / Math.max(1, targets.kcal) < 0.12;
    var MIN_PRILOHA_G = 40;
    // [fix 2026-08-06 kolo 3] Velikost dne škáluje PEVNÉ porce (zelenina 150 g, porce
    // ovoce, doplňky). Malému dni se podlahy sečtou přes cíl a finální ořez (jen carb+fat)
    // to nevrátí. ⛔ Táž logika v appce, hlídá parita.
    var velikostDne = Math.max(0.6, Math.min(1, targets.kcal / 2200));
    function vg(g) { return Math.round(g * velikostDne); }
    // [fix 2026-08-11] PODLAHA JE V GRAMECH, ROZPOČET DNE JE V KALORIÍCH. Změřeno na
    // cíli 1000 kcal / 135 g bílkovin: den přestřelil o 21 % průměrně a o 35 % nejhůř,
    // 12 dnů z 12 mimo 10 %. Vinu nese TAHLE podlaha, ne podlaha bílkoviny (ta neváže
    // ani jednou) a ani „malý den" jako takový: týž den se 90 g bílkovin vyjde přesně.
    // Rozhoduje POMĚR bílkovin ke kaloriím: po bílkovině zbylo ~290 kcal a tři přílohy
    // na podlaze samy daly 286 kcal.
    // ⛔ Jádro věci: 40 g suché jasmínové rýže je 142 kcal, 40 g pečených brambor 37 kcal.
    // Táž „minimální rozumná porce" stojí čtyřnásobek podle toho, co na talíř padne.
    // Proto se podlaha nově omezuje i energeticky: příloha nesmí sama sníst víc než
    // MIN_PRILOHA_KCAL, zmenšené velikostí dne (menší den = menší miska, jako u pevných
    // porcí výš). Na běžném dni (2200 kcal) je strop 150 kcal, do kterého se 40 g rýže
    // vejde, takže se pro běžné dny NEMĚNÍ NIC.
    // ⛔ Stejná logika je v appce (`src/engine/meal-gen-core.ts`), hlídá parita-jidelnicku.mjs.
    var MIN_PRILOHA_KCAL = 150;
    function podlahaPrilohy(f) {
      var kcalNaGram = (f.per100.kcal || 0) / 100;
      if (!(kcalNaGram > 0)) return MIN_PRILOHA_G; // bez energie nemá co omezovat
      // Spodní hranice 15 g: pod ní už to není porce, ale drobek, a příloha má na talíři
      // být vidět. Radši mírný přestřel kalorií než „rýže 6 g".
      return Math.min(MIN_PRILOHA_G, Math.max(15, Math.round((MIN_PRILOHA_KCAL * velikostDne) / kcalNaGram)));
    }
    // [fix 2026-07-26] ROTACE bilkovinnych zdroju pres den + denni strop na jednu potravinu.
    // Nalez z testu appky: vegetarian v deficitu dostal 780 g vajecneho bilku za den (asi
    // 24 kusu) a v tydennim nakupu 200 ks. Cisla pritom sedela na gram.
    // Priciny: `leanOnly` (deficit) zuzi nabidku na libove zdroje a bez masa a ryb v ni
    // zbyde prakticky jen bilek. Strop 260 g platil na JIDLO, ne na den, takze pet jidel
    // znamenalo az 1300 g teze potraviny.
    // ⛔ Stejna oprava je v appce (src/engine/meal-gen.ts), oba generatory se musi chovat
    // stejne. Hlida to `npm run parita:generatory` v repu appky.
    var pouziteProt = {};
    // [R4 2026-09-03] Totéž pro zeleninu a ovoce: táž položka nejvýš jednou za den.
    // Bílkoviny to umí od 26. 7., zelenina a ovoce ne, a bylo to vidět: paprika červená
    // nebo mandlové máslo dvakrát v jednom dni, ve 12 dnech ze 48. ⛔ Táž logika je v appce.
    var pouziteVeg = {};
    var pouziteFruit = {};
    // Bílkoviny z předchozích dnů týdne (plní `assembleWeek`, viz opts.nedavnoPouzite).
    var nedavno = {};
    var nedavnoPocet = 0;
    (opts.nedavnoPouzite || []).forEach(function (id) {
      if (!nedavno[id]) { nedavno[id] = 1; nedavnoPocet++; }
    });
    // [oprava po auditu 2026-09-02] Co bylo v posledních dvou dnech, jde stranou.
    // Audit naměřil veganský týden, kde seitan a rostlinné kousky padly 7 dnů ze 7,
    // protože `assembleWeek` mezi dny žádnou paměť neměla. Fallback na plnou nabídku
    // drží průchodnost úzkých diet (vegan má běžné bílkoviny jen tři).
    // ⛔⛔ [oprava po revizi 2026-09-02] TENHLE FILTR SE NESMÍ VOLAT UVNITŘ SEZNAMU,
    // ze kterého se teprve vybírá kategorie. Vegan má v kategorii `protein` tři běžné
    // položky (seitan, tempeh, tofu). Když jsou všechny tři v paměti posledních dvou dnů,
    // seznam po odečtení prázdný NENÍ (zůstala zelenina, přílohy, rostlinné `dairy`),
    // takže se fallback nespustí, `pick(…, 'protein')` vrátí null a výběr TIŠE spadne
    // na `dairy`: den za 2 798 kcal proti cíli 2 000, 32 g bílkovin proti 110 a 181 g tuku.
    // ⇒ Penalizace se uplatní, JEN KDYŽ nezhorší KATEGORII vybraného zdroje.
    function nebylNedavno(list) {
      if (!nedavnoPocet) return list;
      var cerstve = list.filter(function (f) { return !nedavno[f.id]; });
      return cerstve.length ? cerstve : list;
    }
    function jesteNebyl(list) {
      var cerstve = list.filter(function (f) { return !pouziteProt[f.id]; });
      // ⛔⛔ [oprava po revizi 2026-09-03] TAZ PAST JAKO U `nebylNedavno` VYS, jen o den
      // kratsi: filtr bezi nad CELOU nabidkou, ne nad kategorii, ze ktere se teprve
      // vybira. `cerstve.length` je skoro vzdy nenulove (zustala zelenina a prilohy),
      // takze se fallback nespustil, a kdyz byly vsechny bilkoviny z `protein` uz dnes
      // pouzite, `pick(…, 'protein')` vratil null a vyber TISE spadl na `dairy`.
      // Zmereno: vegan bez lepku (v `protein` mu zbydou jen tofu a tempeh) dostal
      // pri peti jidlech obed i veceri postavene na sojovem jogurtu, coz porusuje R7.
      // ⇒ Penalizace se uplatni, JEN KDYZ nevyprazdni kategorii `protein`.
      var melProtein = list.some(function (f) { return f.cat === 'protein'; });
      var maProtein = cerstve.some(function (f) { return f.cat === 'protein'; });
      if (melProtein && !maProtein) return list;
      return cerstve.length ? cerstve : list;
    }
    function pickProt(s, prefer, protCilJidla) {
      // [fix 2026-08-06 kolo 4] Zdroj, který se do porce nevejde, do SVAČINY nevybírej:
      // koncentrovaný zdroj vyjde pod podlahu 30 g a položka se zahodí, takže ze svačiny
      // zbude samotné ovoce („Švestky 35 g" = 16 kcal). Schválně JEN u svačin, na hlavních
      // jídlech to zhoršovalo trefu bílkovin. ⛔ Táž logika v appce, hlídá parita.
      function sedneNaPorci(list) {
        if (!protCilJidla) return list;
        var sedne = list.filter(function (f) { return (protCilJidla / (f.per100.p || 1)) * 100 >= 30; });
        return sedne.length ? sedne : list;
      }
      // Prasky, cisty bilek, vnitrnosti a strouhaci tvaroh ven ze ZAKLADU jidla.
      // ⛔ [oprava po revizi 2026-09-03] Driv tu stalo `if (prefer) return list;`, a protoze
      // `prefer` je neprazdne pro snidani i svacinu, platil zamek fakticky jen pro obed
      // a veceri. Vegetarian tak porad dostaval „tvaroh tvrdy (na strouhani)" jako zaklad
      // svaciny. Guard ted plati VZDY; fallback na plnou nabidku drzi pruchodnost uzkych
      // filtru. ⚠️ SNACK_PROT jmenuje `syrovatkovy-protein`, ten tim ze svacin vypadava,
      // a je to zamer: prasek je doplnek, ne zaklad jidla.
      function bezPrasku(list) {
        var poctive = list.filter(function (f) { return !NENI_ZAKLAD_JIDLA.test(f.id); });
        return poctive.length ? poctive : list;
      }
      // [R7 2026-09-03] Sladky mlecny zaklad (tvaroh, skyr, jogurt, mleko, mlecny dezert)
      // nepatri na obed ani na veceri. Mekke pravidlo s fallbackem, at se uzke filtry
      // nezaseknou; v praxi tam zbydou tofu, tempeh, seitan a lusteniny.
      function bezMlecnehoZakladu(list) {
        if (prefer) return list;
        var slane = list.filter(function (f) { return !SLADKY_ZAKLAD.test(f.id); });
        return slane.length ? slane : list;
      }
      // Uzeniny a syry az za varene zdroje; mekke pravidlo s fallbackem.
      // [R7] Syr pribyl: k hlavnimu jidlu patri jako doplnek, ne jako zaklad.
      function uzeninaAzNakonec(list) {
        if (prefer) return list;
        var varene = list.filter(function (f) { return !UZENINA_RE.test(f.id) && !SYR_RE.test(f.id); });
        return varene.length ? varene : list;
      }
      // Bílkovina se bere z `protein`, a teprve když tam nic není, z `dairy`.
      var vyber = function (list) {
        return pick(list, 'protein', s, prefer) || pick(list, 'dairy', s, prefer);
      };
      // Výběr s pamětí týdne. Když by penalizace srazila zdroj z `protein` do `dairy`,
      // penalizace se zahodí: pestrost nikdy nesmí přebít složení dne.
      var sPenalizaci = function (list) {
        var bez = vyber(list);
        if (!nedavnoPocet) return bez;
        var sP = vyber(nebylNedavno(list));
        if (!sP) return bez;
        if (!bez) return sP;
        // 1) Penalizace nesmí srazit základ jídla z `protein` do `dairy` (viz výš).
        if (sP.cat !== bez.cat && bez.cat === 'protein') return bez;
        // 2) A nesmí sáhnout po výrazně slabším zdroji. Bez toho dostal vegetarián
        //    na 3 300 kcal a třech jídlech den o 15,6 % pod cílem bílkovin, protože
        //    všechny silné zdroje byly v paměti a zbyly jogurty s 1 g bílkovin na 100 g.
        if ((sP.per100.p || 0) < (bez.per100.p || 0) * 0.85) return bez;
        return sP;
      };
      if (leanOnly) {
        var leanDb = sedneNaPorci(uzeninaAzNakonec(bezMlecnehoZakladu(bezPrasku(jesteNebyl(db.filter(function (f) { return (f.cat !== 'protein' && f.cat !== 'dairy') || isLean(f); }))))));
        var p = sPenalizaci(leanDb);
        if (p) return p;
      }
      var cely = sedneNaPorci(uzeninaAzNakonec(bezMlecnehoZakladu(bezPrasku(jesteNebyl(db)))));
      return sPenalizaci(cely);
    }
    var gramyDnes = {};
    var DENNI_STROP_G = 400;
    // [fix 2026-07-22] totéž pro přílohy: velká DB má i tučné sacharidové zdroje (opékané
    // brambory, plněné těstoviny, saláty s majonézou). Při napjatém tukovém rozpočtu ber
    // přílohy do 4 g tuku/100 g (rýže, brambory, těstoviny…); jinak by skrytý tuk přetekl.
    // [R10 2026-09-03] `zakaz` vyradi prilohy, ktere se k zakladu jidla nehodi (dnes
    // sladka kukurice k rybe a k veprovemu). Je to FILTR NABIDKY, ne preference: `pick`
    // by u preference sahl po zakazane polozce, kdyby podseznam vysel prazdny.
    function pickCarb(s, prefer, zakaz) {
      var zaklDb = zakaz ? db.filter(function (f) { return f.cat !== 'carb' || !zakaz.test(f.id); }) : db;
      if (leanOnly) {
        var leanDb = zaklDb.filter(function (f) { return f.cat !== 'carb' || f.per100.f <= 4; });
        var c = pick(leanDb, 'carb', s, prefer);
        if (c) return c;
      }
      return pick(zaklDb, 'carb', s, prefer);
    }

    // rozložení kalorií do jídel + typy a popisky (viz distProJidla / typyJidel výš)
    var dist = distProJidla(meals);
    var kinds = typyJidel(meals);
    var vychozi = vychoziNazvyJidel(meals);
    var vlastniNazvy = opts.mealNames || [];
    // Popisek je JEN text; o výběru potravin rozhoduje `kinds[i]`, ne název jídla.
    var names = vychozi.map(function (n, ix) {
      return vlastniNazvy[ix] != null ? vlastniNazvy[ix] : n;
    });

    var out = [];
    for (var i = 0; i < meals; i++) {
      var mKcal = targets.kcal * dist[i];
      var mProt = targets.protein * dist[i];
      var mFat = targets.fat * dist[i];
      var kind = kinds[i];
      var isSnack = (kind === 'snack' || kind === 'late');
      var items = [];

      // 1) bílkovinný základ — dávkuj na bílkovinný cíl jídla
      // snídaně/svačina dostanou vhodnější zdroj (vejce, tvaroh, skyr…), ne kuřecí prsa
      var protPrefer = (kind === 'breakfast') ? BREAKFAST_PROT : (isSnack ? SNACK_PROT : null);
      var prot = pickProt(seed + i, protPrefer, isSnack ? mProt : undefined);
      if (prot) {
        var pg = round((mProt / (prot.per100.p || 1)) * 100, 10);
        pg = Math.min(pg, prot.cat === 'protein' ? 260 : 300);
        if (UZENINA_RE.test(prot.id)) pg = Math.min(pg, UZENINA_MAX_G);
        // Denni strop: co uz dnes z teto potraviny padlo, se odecte. Bez toho jde strop
        // na jidlo obejit tim, ze se taz potravina da do vsech peti jidel.
        var zbyva = Math.max(0, DENNI_STROP_G - (gramyDnes[prot.id] || 0));
        pg = Math.min(pg, zbyva);
        if (pg >= 30) {
          gramyDnes[prot.id] = (gramyDnes[prot.id] || 0) + pg;
          pouziteProt[prot.id] = true;
          items.push({ food: prot, grams: pg });
        }
        // Kombinovaná snídaně: uzenina ořezaná na 80 g nese málo bílkovin, zbytek doplní
        // vejce/tvaroh/skyr (viz [fix 2026-08-06 kolo 3] výš).
        if (kind === 'breakfast' && UZENINA_RE.test(prot.id)) {
          var chybiP = mProt - macrosFor(prot, Math.min(pg, UZENINA_MAX_G)).p;
          if (chybiP >= 8) {
            // ⛔ [oprava po revizi 2026-09-03] Druhý zdroj se vybírá PŘÍMO z povolené množiny
            // (vejce, sýr), ne přes `pickProt`. Ten totiž nejdřív odečte potraviny, které dnes
            // už padly (`jesteNebyl`), a když tím povolený podseznam vyprázdní, spadne na CELOU
            // nabídku a vrátí třeba kuřecí prsa. Ta pak neprojdou kontrolou R1 o řádek níž
            // a snídaně zůstane na 80 g šunky, tedy asi 12 g bílkovin proti cíli jídla.
            // Změřeno: tahle díra stála 4 z 36 deficitních plánů v `training.test.ts`.
            // Pestrost nesmí přebít složení jídla, týž princip jako u `sPenalizaci` výš.
            var doplnkoveDb = db.filter(function (f) { return SNIDANE_DOPLNEK_PROT.test(f.id); });
            var druhy = pick(doplnkoveDb, 'protein', seed + i + 11, null)
              || pick(doplnkoveDb, 'dairy', seed + i + 11, null);
            // [R1 2026-09-03] Musí to BÝT vejce nebo sýr, ne jen něco, co není uzenina.
            // `pickProt` má fallback na celou nabídku, takže sem uměla přijít kuřecí prsa
            // nebo tvaroh; obojí je na snídani s šunkou druhý plnohodnotný základ.
            if (druhy && !UZENINA_RE.test(druhy.id) && SNIDANE_DOPLNEK_PROT.test(druhy.id)) {
              var dg = round((chybiP / (druhy.per100.p || 1)) * 100, 10);
              dg = Math.min(Math.max(dg, 30), druhy.cat === 'protein' ? 260 : 300);
              gramyDnes[druhy.id] = (gramyDnes[druhy.id] || 0) + dg;
              pouziteProt[druhy.id] = true;
              items.push({ food: druhy, grams: dg });
            }
          }
        }
      }
      // ⛔ [R2 2026-09-03] CHARAKTER JÍDLA SE URČÍ ZE ZÁKLADU, a ten pak rozhoduje
      // o příloze, zelenině i ovoci. Slaný základ (uzenina, vejce, sýr, maso, ryba, tofu)
      // dostane pečivo a zeleninu, sladký (tvaroh, skyr, cottage, jogurt) vločky/müsli/pečivo
      // a ovoce. Míchání obojího je nejčastější vada výstupu: 36 jídel ze 48 dnů.
      // Jídlo bez bílkovinného základu (úzký filtr) se u snídaně a svačin bere jako sladké,
      // ať nezmizí i ta poslední položka a svačina nezůstane prázdná.
      // ⛔ Táž logika je v appce, hlídá parita.
      var zakladJidla = items.length ? items[0].food : null;
      var sladkeJidlo = zakladJidla ? jeSladkyZaklad(zakladJidla) : (kind === 'breakfast' || isSnack);
      // Slaná svačina (šunka, sýr, vejce) dostane pečivo, ne ovoce: šunka + mango je
      // přesně ten pár, který R2 zakazuje, a bez přílohy by zbyla samotná šunka.
      var slanaSvacina = isSnack && !sladkeJidlo;

      // 2) sacharidová příloha (ne u svačin)
      // Snídaně nikdy není svačina, takže stará podmínka `!isSnack || i === 0`
      // je po zavedení typů jídel prostě `!isSnack`. Chování se nemění.
      // ⛔ [R11 2026-09-03] V KETO REZIMU SE PRILOHA NESKLADA VUBEC. Driv `lowCarb` jen
      // vypnul podlahu a brana `cg > 10` pustila do keto dne „zitny chleb 20 g" nebo
      // „bulgur vareny 90 g": obiloviny, ktere keto cil nesplni a na taliři jsou drobek.
      // Chybejici kalorie dozenou bilkovina, zelenina a tuk; kdyz ani to nestaci, den
      // to zahlasi v `warnings` (viz konec funkce), misto aby zamichal obiloviny.
      if ((!isSnack || slanaSvacina) && !lowCarb) {
        var pecivove = (kind === 'breakfast') || slanaSvacina;
        // [R10] Sladka kukurice neni priloha k rybe ani k veprovemu.
        var zakladJeRybaVeprove = items.length > 0 && RYBA_VEPROVE_RE.test(items[0].food.id);
        var carb = pecivove
          ? pickCarb(seed + i + 7, sladkeJidlo ? BREAKFAST_CARB : PECIVO_RE)
          : pickCarb(seed + i + 3, MAIN_CARB, zakladJeRybaVeprove ? SLADKA_PRILOHA_RE : null);
        if (carb) {
          // dopočítej gramy sacharidů zbývající po proteinu
          var usedC = items.reduce(function (s, it) { return s + macrosFor(it.food, it.grams).c; }, 0);
          var needC = (targets.carbs * dist[i]) - usedC;
          var cg = round((needC / (carb.per100.c || 1)) * 100, 10);
          // Hlavní jídlo bez keto cílů: příloha se zmenšuje, ale neruší (podlaha 40 g).
          // ⛔ [oprava po revizi 2026-09-02] Hlavní jídlo se pozná podle TYPU, ne podle
          // podílu kalorií. Dřív tu stálo `kind === 'breakfast' || dist[i] >= 0.2`, což je
          // pro 3, 4 i 5 jídel totéž (ověřeno paritou), ale svazovalo to rozdělení kalorií:
          // jakmile by šestijídlový den dal večeři míň než 20 %, tiše by přišla o podlahu
          // přílohy i o zeleninu. Blok navíc už běží uvnitř `if (!isSnack)`.
          if (!lowCarb && !slanaSvacina) cg = Math.max(cg, podlahaPrilohy(carb));
          // [R2] Pečivo ve slané svačině se dopočítá na kalorie svačiny stejně, jako se to
          // od kola 4 dělá s porcí ovoce ve sladké (viz níž). Jen ZVĚTŠUJEME.
          if (slanaSvacina && !lowCarb && carb.per100.kcal > 0) {
            var uzKcalS = items.reduce(function (s, it) { return s + macrosFor(it.food, it.grams).kcal; }, 0);
            var zbyvaS = (targets.kcal * dist[i]) - uzKcalS - (mFat * 9 * 0.3); // rezerva na dorovnání tuku
            if (zbyvaS > 0) cg = Math.max(cg, (zbyvaS / carb.per100.kcal) * 100);
          }
          if (cg > 10) items.push({ food: carb, grams: Math.min(cg, slanaSvacina ? STROP_PECIVO_G : 320) });
        }
      }
      // 3) zelenina pro objem (u hlavních jídel)
      // [fix 2026-07-22] aromatická zelenina (cibule, česnek, chilli, bylinky…) není samostatná
      // příloha — 150 g cibule k večeři je nesmysl. Do dochucení patří, na talíř jako zelenina ne.
      // ⛔ [oprava po revizi 2026-09-02] Podmínka je TYP jídla, ne podíl kalorií (viz výš).
      // ⛔ [R2, rozšířeno po revizi 2026-09-03] Zeleninu nedostane ŽÁDNÉ sladké jídlo,
      // ne jen sladká snídaně. Původní podmínka si odporovala se dvěma dalšími místy
      // (`kamSDoplnkem` a přerozdělení přetíženého jídla), která zeleninu blokují
      // u sladkého jídla jakéhokoli typu. Revize to změřila na 1152 dnech: 559 zbylých
      // případů, typicky skyr 250 g + hlíva ústřičná jako oběd. Jedno pravidlo pro tři místa.
      if (!isSnack && !sladkeJidlo) {
        // [fix 2026-08-06 kolo 3] V keto režimu jen nízkosacharidová zelenina. Táž logika v appce.
        var sideVegDb = db.filter(function (f) {
          return f.cat !== 'veg' || (!/cibul|cesnek|chilli|zazvor|kren|bylink|petrzel|koriandr|kopr|pazitk|medvedi/.test(f.id) && (!lowCarb || f.per100.c <= 5));
        });
        // [R4 2026-09-03] Táž zelenina nejvýš jednou za den (jako u bílkovin přes
        // `pouziteProt`). Změřeno: paprika červená dvakrát v jednom dni ve 12 dnech ze 48.
        // Fallback na plnou nabídku drží průchodnost úzkých filtrů a keto režimu.
        var cerstvaVeg = sideVegDb.filter(function (f) { return f.cat !== 'veg' || !pouziteVeg[f.id]; });
        var vegDb = cerstvaVeg.some(function (f) { return f.cat === 'veg'; }) ? cerstvaVeg : sideVegDb;
        // [R10 2026-09-03] Z HLAVNIHO JIDLA VEN sladka zelenina (kukurice, pastinak,
        // cervena repa). Je to FILTR NABIDKY, ne preference: kdyby to byla jen preference
        // v `pick`, prazdny podseznam by ji vratil zpatky. Fallback je pojistka proti
        // prazdne nabidce u extremne uzkeho filtru.
        var hlavniJidlo = (kind === 'lunch' || kind === 'dinner');
        if (hlavniJidlo) {
          var slanaVegDb = vegDb.filter(function (f) { return f.cat !== 'veg' || !SLADKA_ZELENINA_RE.test(f.id); });
          if (slanaVegDb.some(function (f) { return f.cat === 'veg'; })) vegDb = slanaVegDb;
        }
        // [fix 2026-08-05 večer] Snídaňová zelenina bez špenátu: 150 g syrových listů
        // k toustu nikdo nejí. K vaječné snídani patří rajče, okurka, paprika.
        // [R10] U obeda a vecere se prednostne saha do „slaneho" okruhu zeleniny.
        var vegPrefer = (kind === 'breakfast') ? /rajce|okurka|paprika/ : (hlavniJidlo ? SLANA_ZELENINA_RE : null);
        var veg = pick(vegDb, 'veg', seed + i + 5, vegPrefer);
        if (veg) {
          pouziteVeg[veg.id] = true;
          // [R9 2026-09-03] Hlavni jidlo ma zeleniny aspon 100 g. `velikostDne` ji na malem
          // dni srazel na 95 g, coz pod slibem „aspon 100 g" byt nema.
          var vegG = hlavniJidlo ? Math.max(MIN_ZELENINA_HLAVNI_G, vg(150)) : vg(150);
          items.push({ food: veg, grams: vegG });
        }
      }
      // 4) ovoce u snídaně/svačin
      // [R2 2026-09-03] Jen ke SLADKÉMU základu. Uzenina, vejce nebo sýr plus ovoce
      // je ten zakázaný pár (36 jídel ze 48 dnů).
      if ((kind === 'breakfast' || isSnack) && sladkeJidlo) {
        // V keto režimu z ovoce jen bobule a menší porce; jiné ovoce nese moc sacharidů.
        // [R4] Táž logika bez opakování v jednom dni jako u zeleniny výš.
        var cerstveFruit = db.filter(function (f) { return f.cat !== 'fruit' || !pouziteFruit[f.id]; });
        var fruitDb = cerstveFruit.some(function (f) { return f.cat === 'fruit'; }) ? cerstveFruit : db;
        // ⛔ [R11 2026-09-03] V keto rezimu jsou bobule FILTR, ne preference. Jako preference
        // je `pick` obchazel, kdykoli podseznam vysel prazdny: na 1152 dnech se tudy do keto
        // dne dostal banan, kiwi i mango (20 nalezu).
        if (lowCarb) {
          var bobuleDb = fruitDb.filter(function (f) { return f.cat !== 'fruit' || BOBULE_RE.test(f.id); });
          fruitDb = bobuleDb.some(function (f) { return f.cat === 'fruit'; })
            ? bobuleDb
            : fruitDb.filter(function (f) { return f.cat !== 'fruit'; });
        }
        var fruit = pick(fruitDb, 'fruit', seed + i + 2, lowCarb ? BOBULE_RE : null);
        if (fruit) {
          pouziteFruit[fruit.id] = true;
          var fg0 = vg(lowCarb ? 80 : (fruit.portion || 120));
          // [fix 2026-08-06 kolo 4] Ve svačině se porce ovoce dopočítá na kalorie svačiny
          // (pevná porce nechávala svačinu na mediánu 72 % jejího cíle). Jen ZVĚTŠUJEME.
          if (isSnack && !lowCarb && fruit.per100.kcal > 0) {
            var uzKcal = items.reduce(function (s, it) { return s + macrosFor(it.food, it.grams).kcal; }, 0);
            var zbyva = (targets.kcal * dist[i]) - uzKcal - (mFat * 9 * 0.3);
            // [R6 2026-09-03] Strop porce ovoce v jednom jídle je 200 g, ne 250.
            if (zbyva > 0) fg0 = Math.min(Math.max(fg0, (zbyva / fruit.per100.kcal) * 100), fg0 * 2, STROP_OVOCE_G);
          }
          items.push({ food: fruit, grams: round(fg0, 5) });
        }
      }
      // 5) dorovnání tuků zdrojem tuku
      var usedF = items.reduce(function (s, it) { return s + macrosFor(it.food, it.grams).f; }, 0);
      var needF = mFat - usedF;
      if (needF > 4) {
        // [fix 2026-08-06 kolo 4] Tuk se páruje k CHARAKTERU jídla: sladké (ovoce bez
        // zeleniny) dostane ořechy, slané oleje/máslo/avokádo. ⛔ Táž logika v appce.
        var maOvoce = items.some(function (it) { return it.food.cat === 'fruit'; });
        var maZeleninu = items.some(function (it) { return it.food.cat === 'veg'; });
        var fat = pick(db, 'fat', seed + i + 1, maOvoce && !maZeleninu ? SLADKY_TUK : (maZeleninu ? SLANY_TUK : null));
        if (fat && fat.per100.f) {
          var fg = round((needF / fat.per100.f) * 100, 1);
          // [R8 2026-09-03] Strop na tuk uz tady, ne az v `capPass`: pridany tuk (olej,
          // maslo, ghi, sadlo) 15 g, chia a lnene seminko 20 g, ostatni orechy a seminka 30 g.
          var stropF = stropTuku(fat);
          fg = Math.min(Math.max(fg, 5), stropF != null ? stropF : 30);
          items.push({ food: fat, grams: fg });
        }
      }

      out.push({ name: names[i], kind: kind, targetKcal: Math.round(mKcal), items: items });
    }

    // ---- normalizační pass: doraz makra na denní cíl škálováním hlavních zdrojů ----
    var all = [];
    out.forEach(function (m) { m.items.forEach(function (it) { all.push(it); }); });
    function sumP(cat, key) {
      return all.reduce(function (s, it) {
        if (it.food.cat === cat) s += macrosFor(it.food, it.grams)[key];
        return s;
      }, 0);
    }
    function totalKey(key) { return all.reduce(function (s, it) { return s + macrosFor(it.food, it.grams)[key]; }, 0); }
    function scaleCat(cat, key, target, lo, hi) {
      var fromCat = sumP(cat, key);
      if (fromCat <= 0) return;
      var incidental = totalKey(key) - fromCat;
      var factor = (target - incidental) / fromCat;
      factor = Math.max(lo, Math.min(hi, factor));
      all.forEach(function (it) { if (it.food.cat === cat) it.grams = it.grams * factor; });
    }
    // Normalizace maker je provázaná — potraviny každé kategorie nesou i ostatní makra
    // (sacharidové zdroje mají protein, proteinové zdroje mají tuk atd.). Škálování jedné
    // kategorie proto rozhodí ostatní. Iterujeme sacharidy → tuky → protein několikrát,
    // ať se to ustálí; protein necháváme jako poslední (nejčistší makro), aby trefil cíl
    // co nejpřesněji. Dřív běžel jediný průchod v pořadí protein-první → systematický přestřel
    // bílkovin (u nabírání/vysokého příjmu i o 30–45 %).
    // realistické stropy porcí — bez nich škálování vyrobí nesmysly (675 g bulguru na zátah)
    var CAP = { protein:300, carb:500, legume:350, dairy:350, veg:250, fruit:250, fat:50, snack:120 };
    // stropy pro konkrétní potraviny (přebijí kategorii): 240 g syrových bílků na talíři
    // je „tabulkové" jídlo, ne snídaně — víc než ~5 bílků na jedno jídlo nedává smysl
    var FOOD_CAP = { bilek: 150 };
    // [R6 2026-09-03] Strop porce na JEDNO jídlo. Pečivo, vločky a müsli 120 g, ovoce
    // 200 g, jinak strop potraviny nebo kategorie. Jedno místo pro všechny ořezy níž,
    // ať se strop nedá obejít tím, že se na kategorii sáhne jinou cestou.
    // ⛔ Táž funkce je v appce (`src/engine/meal-gen-core.ts`), hlídá parita.
    // Nouzový režim bílkovin, viz STROP_PROT_NOUZE níž.
    var nouzeBilkovin = false;
    var STROP_PROT_NOUZE = 350;
    var stropG = function (f) {
      if (FOOD_CAP[f.id] != null) return FOOD_CAP[f.id];
      if (PECIVO_VLOCKY_RE.test(f.id)) return STROP_PECIVO_G;
      if (f.cat === 'fruit') return STROP_OVOCE_G;
      // [R8 2026-09-03] Pridany tuk 15 g, chia a lnene 20 g, ostatni orechy a seminka 30 g.
      var tuk = stropTuku(f);
      if (tuk != null) return tuk;
      // [R9 2026-09-03] Varena priloha nejvys 300 g varene hmotnosti; u suche polozky
      // (nad 200 kcal/100 g) je to zhruba 100 g suche vahy. Pecivo, vlocky a musli maji
      // vlastni strop vys, tudy neprojdou.
      if (jeVarenaPriloha(f)) {
        return (f.per100.kcal || 0) > SUCHA_PRILOHA_KCAL ? STROP_PRILOHA_SUCHA_G : STROP_PRILOHA_VARENA_G;
      }
      if (nouzeBilkovin && (f.cat === 'protein' || f.cat === 'dairy')) return STROP_PROT_NOUZE;
      return CAP[f.cat];
    };
    function capPass() {
      all.forEach(function (it) {
        var cap = stropG(it.food); if (cap && it.grams > cap) it.grams = cap;
        // Uzenina nikdy přes 80 g na talíři (drží i proti zpětnému škálování).
        if (UZENINA_RE.test(it.food.id) && it.grams > UZENINA_MAX_G) it.grams = UZENINA_MAX_G;
      });
    }
    function runScale() {
      // [fix 2026-07-26] 5 průchodů místo 3, sjednoceno s appkou. Se stropy porcí konverguje
      // škálování pomaleji: co se u položky na stropu ořízne, musí se rozpustit do ostatních,
      // a na to tři průchody nestačily. Naměřeno na 180 zadáních: se třemi průchody web
      // podstřeloval a spouštěl o úroveň víc doplňků než appka.
      for (var np = 0; np < 5; np++) {
        scaleCat('carb', 'c', targets.carbs, 0.4, 2.6);
        scaleCat('fat', 'f', targets.fat, 0.3, 3.0);
        // [fix 2026-07-26] Rozsah 0,45 až 2,2 místo 0,35 až 2,4, sjednoceno s appkou.
        // Naměřeno na 324 dnech: appka s užším rozsahem trefuje bílkoviny na 1,2 %,
        // web se širším na 2,6 %. Širší rozsah svádí škálování k velkým skokům, které
        // pak musí dorovnávat ostatní kategorie.
        scaleCat('protein', 'p', targets.protein, 0.45, 2.2);
        // [fix 2026-07-26] Ořez i podlaha jsou nově UVNITŘ cyklu, sjednoceno s appkou.
        // Dřív běžely až za ním a den o ten ořez tiše podstřelil. Uvnitř se chybějící makro
        // rozpustí do položek, které na stropu nejsou. Naměřeno v appce: odchylka sacharidů
        // z 6,7 zpět na 4,5 %, právě tímhle přesunem.
        // [fix 2026-07-14] stropy hned po škálování, jinak kontrola sytosti dne viděla
        // nadstropové porce a den po ořezu tiše podstřelil i o 20 %
        capPass();
        // bílkovinný základ jídla nesmí zdegenerovat na ozdobu (křížové škálování ho umí
        // stlačit), drž aspoň 30 g; je to páteř každého jídla v Martinově metodě
        all.forEach(function (it) {
          if (it.food.cat === 'protein' && it.grams < 30) it.grams = 30;
          // podlaha přílohy drží i proti křížovému škálování (viz [fix 2026-08-05 večer])
          if (!lowCarb && it.food.cat === 'carb' && it.grams < podlahaPrilohy(it.food)) it.grams = podlahaPrilohy(it.food);
        });
      }
    }
    runScale();

    // [fix 2026-07-22] Pojistka na skrytý tuk: když po normalizaci tuk přesahuje cíl o >15 %
    // (rotace vybrala tučné zdroje, např. vejce k snídani v deficitu), vyměň nejtučnější
    // bílkovinný zdroj za výrazně libovější nepoužitý (se zachováním vhodnosti pro snídani
    // a svačinu) a přeškáluj. Bílkoviny položky zůstávají, mění se jen zdroj. Musí běžet PŘED
    // doplňkovým blokem níže — ten pak případný úbytek kalorií/tuku sám dorovná (mandle, olej).
    function fatRatio(f) { return f.per100.f / Math.max(1, f.per100.p || 0); }
    for (var sw = 0; sw < 3 && totalKey('f') > targets.fat * 1.15; sw++) {
      var protItems = all.filter(function (it) { return it.food.cat === 'protein' || it.food.cat === 'dairy'; });
      if (!protItems.length) break;
      protItems.sort(function (a, b) { return fatRatio(b.food) - fatRatio(a.food); });
      var worst = protItems[0];
      if (fatRatio(worst.food) <= 0.42) break; // všechny zdroje už jsou libové, víc nesvedu
      var mIdx = -1;
      out.forEach(function (m, ix) { if (m.items.indexOf(worst) !== -1) mIdx = ix; });
      var swapPref = (mIdx === 0) ? BREAKFAST_PROT
        : (mIdx > 0 && out[mIdx] && out[mIdx].targetKcal < targets.kcal * 0.18 ? SNACK_PROT : null);
      var usedIds = {};
      all.forEach(function (it) { usedIds[it.food.id] = 1; });
      var swapCand = db.filter(function (f) {
        return (f.cat === 'protein' || f.cat === 'dairy') && !usedIds[f.id] &&
          (!swapPref || swapPref.test(f.id)) && fatRatio(f) < fatRatio(worst.food) - 0.1;
      });
      // [fix 2026-08-05] I záchranná výměna preferuje běžné potraviny (flag `bezny`) —
      // jinak deficit vyměnil vejce za „bacalhau" a exotika se vracela zadními vrátky.
      var bezneCand = swapCand.filter(function (f) { return f.bezny; });
      if (bezneCand.length) swapCand = bezneCand;
      // k hlavnímu jídlu patří maso/ryba/tofu, ne miska čistých bílků — bílek jen když nezbývá nic jiného
      if (!swapPref && swapCand.length > 1) {
        var noBilek = swapCand.filter(function (f) { return f.id !== 'bilek'; });
        if (noBilek.length) swapCand = noBilek;
      }
      // ⛔ [R7 2026-09-03] TAHLE VYMENA OBCHAZELA R7. Je to nejlibovejsi zdroj, co se najde,
      // takze u keto vegana bez lepku vymenila tofu za „sojovy jogurt bily" a vecere stala
      // na jogurtu (zmereno: 8 dnu z 1152). Sladky mlecny zdroj se do hlavniho jidla nesmi
      // dostat ani zachrannou vymenou; prasky a vnitrnosti tudy taky ne.
      if (!swapPref) {
        var poctiveCand = swapCand.filter(function (f) {
          return !SLADKY_ZAKLAD.test(f.id) && !NENI_ZAKLAD_JIDLA.test(f.id);
        });
        if (poctiveCand.length) swapCand = poctiveCand;
      }
      if (!swapCand.length) break;
      swapCand.sort(function (a, b) { return fatRatio(a) - fatRatio(b) || (a.id < b.id ? -1 : 1); });
      var lean = swapCand[(seed + sw) % Math.min(3, swapCand.length)]; // rotace mezi 3 nejlibovějšími = pestrost
      var keepP = macrosFor(worst.food, worst.grams).p;
      worst.food = lean;
      worst.grams = Math.max(30, (keepP / (lean.per100.p || 1)) * 100);
      runScale();
    }

    // [KETO-OPRAVA 2026-09-03, port appky] Zrcadlo pojistky výš, pro opačný problém. Keto
    // den, který i po normalizaci pořád citelně NEDOSAHUJE tukový cíl, vyměň nejlibovější
    // bílkovinný zdroj dne za nejtučnější dostupný (opak pojistky na skrytý tuk). Bez tohohle
    // se cíl tuku z porcí přidaného tuku (strop R8 15 g) a ořechů (strop 30 g) neposkládá
    // a den systematicky podstřeluje kalorie (mřížka 1152 dnů, nejhorší keto den 18,8 %
    // pod cílem před opravou, po ní 16,3 %). Práh `< 0,9 × cíl` je záměrně měkčí než
    // pojistka výš (`> 1,15 × cíl`): tady nejde o obejití stropu, ale o to, aby den vůbec
    // dosáhl svých kalorií. Stejná logika je v appce (`meal-gen-core.ts`), 1:1.
    function fatniProt(f) { return f.per100.f / Math.max(1, f.per100.p || 0); }
    for (var sw2 = 0; sw2 < 3 && lowCarb && totalKey('f') < targets.fat * 0.9; sw2++) {
      // ⛔ SWAP SMÍ SÁHNOUT JEN NA JÍDLO S JEDNÍM SLANÝM ZÁKLADEM. Měněná položka drží svůj
      // gramáž podle bílkoviny, ale MĚNÍ CHARAKTER jídla (sladký mléčný základ → slaný
      // zdroj). Když jídlo mělo sladký doplněk (ovoce, vločky, R2 to povoluje ke sladkému
      // základu) nebo dva bílkovinné základy (výjimka „šunka + vejce" z R1), výměna základu
      // tu vlastnost rozbije a vyrobí přesně ty vady, které R1 a R2 zakazují.
      var protItems2 = all.filter(function (it) {
        if (it.food.cat !== 'protein' && it.food.cat !== 'dairy') return false;
        var meal = null;
        out.forEach(function (m) { if (m.items.indexOf(it) !== -1) meal = m; });
        if (!meal) return false;
        if (jeSladkeJidlo(meal)) return false;
        var protCount = meal.items.filter(function (x) { return x.food.cat === 'protein' || x.food.cat === 'dairy'; }).length;
        if (protCount >= 2) return false;
        return true;
      });
      if (!protItems2.length) break;
      protItems2.sort(function (a, b) { return fatniProt(a.food) - fatniProt(b.food); }); // nejlibovější první
      var worst2 = protItems2[0];
      if (fatniProt(worst2.food) >= 0.6) break; // všechny zdroje dne už jsou tučné
      var usedIds2 = {};
      all.forEach(function (it) { usedIds2[it.food.id] = 1; });
      var swapCand2 = db.filter(function (f) {
        return (f.cat === 'protein' || f.cat === 'dairy') && !usedIds2[f.id] &&
          (f.per100.p || 0) >= 10 && fatniProt(f) > fatniProt(worst2.food) + 0.1;
      });
      // ⛔ NA ROZDÍL OD POJISTKY VÝŠ (libovější zdroj) tady fallback na NEBĚZNÉ položky
      // NESMÍ nastat: neběžné tučné zdroje bývají garnýrovací porce (`rostlinny-parmezan`
      // má typickou porci 10 g), a naškálované na plnou porci vyrobí nerealistický talíř.
      // Když bezný tučný zdroj není, výměna se raději nekoná.
      swapCand2 = swapCand2.filter(function (f) { return f.bezny; });
      // ⛔ [R7] Sladký mléčný základ a prášky/vnitřnosti sem nesmí, stejně jako u pojistky
      // výš — jinak tahle výměna vyrobí přesně tu vadu, kterou R7 zakazuje.
      var poctiveCand2 = swapCand2.filter(function (f) {
        return !SLADKY_ZAKLAD.test(f.id) && !NENI_ZAKLAD_JIDLA.test(f.id);
      });
      if (poctiveCand2.length) swapCand2 = poctiveCand2;
      // Stejné pořadí jako R7: sýr a uzenina až za maso, rybu a vejce, měkce s fallbackem.
      var vareneCand2 = swapCand2.filter(function (f) { return !UZENINA_RE.test(f.id) && !SYR_RE.test(f.id); });
      if (vareneCand2.length) swapCand2 = vareneCand2;
      if (!swapCand2.length) break;
      swapCand2.sort(function (a, b) { return fatniProt(b) - fatniProt(a) || (a.id < b.id ? -1 : 1); });
      // ⛔ TUČNĚJŠÍ ZDROJ MÁ ČASTO NIŽŠÍ BÍLKOVINU NA 100 g. Vzorec, který drží protein
      // POLOŽKY (`keepP / tucny.p * 100`), tak umí vyrobit nerealistickou porci (vegan den
      // vyměnil 210 g rostlinného burgeru za 300 g rostlinného parmazánu, p jen 15 g, den
      // 36,6 % NAD cílem). Zdroj se proto smí vyměnit, jen když výsledná porce zůstane
      // rozumná (≤ 250 g); první kandidát v pořadí od nejtučnějšího, který se do 250 g
      // vejde, vyhrává.
      var keepP2 = macrosFor(worst2.food, worst2.grams).p;
      var tucny2 = null;
      for (var ci2 = 0; ci2 < swapCand2.length; ci2++) {
        if ((keepP2 / (swapCand2[ci2].per100.p || 1)) * 100 <= 250) { tucny2 = swapCand2[ci2]; break; }
      }
      if (!tucny2) break; // žádný tučnější zdroj nedá rozumnou porci, nemá smysl zkoušet dál
      worst2.food = tucny2;
      worst2.grams = Math.max(30, (keepP2 / (tucny2.per100.p || 1)) * 100);
      runScale();
    }

    // [fix 2026-07-14] Velké cíle (např. 230 g bílkovin / 3 000+ kcal ve 3 jídlech) se přes
    // stropy porcí nevejdou → den podstřeloval i o 20 %. Doplníme reálné doplňky (shake
    // k hlavnímu jídlu, vločky a banán k snídani, hrst mandlí) a znormalizujeme znovu —
    // přesně tohle by velkému klientovi poradil kouč.
    function byId(id) { return db.filter(function (f) { return f.id === id; })[0] || null; }
    // Má jídlo bílkovinný základ?
    var maBilkovinu = function (m) {
      return m.items.some(function (it) { return it.food.cat === 'protein' || it.food.cat === 'dairy'; });
    };
    var VLOCKY_MUSLI_RE = /ovesne-vlocky|musli|granola|ovesna-kase|ovesne-otruby/;
    // [R2] Doplněk, který patří jen na sladký talíř (ovoce, vločky, müsli).
    // ⛔ [oprava po revizi 2026-09-03] Sladký doplněk NENÍ jen ovoce a vločky. Musí sem
    // patřit i sladké mlékárenské základy (tvaroh, skyr, jogurt, syrovátkový protein),
    // jinak je `addExtra` i přerozdělení přetíženého jídla položí na slaný talíř.
    // Přesně tudy vznikla snídaně šunka 80 g + syrovátkový protein 145 g.
    var sladkyDoplnek = function (f) {
      return f.cat === 'fruit' || VLOCKY_MUSLI_RE.test(f.id) || SLADKY_ZAKLAD.test(f.id);
    };
    // Slaný doplněk: zelenina a bílkovinné zdroje, které nejsou sladké mlékárenské.
    var slanyDoplnek = function (f) {
      return f.cat === 'veg' || ((f.cat === 'protein' || f.cat === 'dairy') && !SLADKY_ZAKLAD.test(f.id));
    };
    // ⛔ [R1 + R2 2026-09-03] DOPLŇKOVÝ BLOK VYRÁBĚL PŘESNĚ TY VADY, které R1 a R2 zakazují:
    // `syrovatkovy-protein` míří do prostředního jídla a `tvaroh-mekky` do posledního,
    // a při pěti a šesti jídlech je to SVAČINA, která bílkovinu už dostala (druhý základ);
    // `ovesne-vlocky` a `banan` míří do snídaně, i když stojí na šunce (sladké ke slanému).
    // Doplněk se proto ukládá do jídla, které ho snese; když žádné takové není, vynechá se.
    // Radši den o kousek pod cílem než talíř, který nikdo nesní; ostatní dorovnání
    // (přílohy, ovoce, finální trim) mají prostor to dohnat.
    // ⛔ Táž logika je v appce, hlídá parita.
    /** ⛔⛔ [R1, ROZHODNUTO PO REVIZI 2026-09-03] BRÁNA JE TVRDÁ, výjimka neexistuje.
     *  Mezikrok tu měl měkkou bránu: když den klesl pod 88 % cíle bílkovin, doplněk
     *  se položil i do jídla, které bílkovinu už mělo. Revize to změřila na 2880 dnech
     *  a je to špatně: s výjimkou 292 porušení R1 a 110 porušení R2, bez ní 130 a 0.
     *  Těch 130 zbylých jsou legitimní snídaně šunka + vejce. Výjimka tedy stála
     *  162 talířů se dvěma plnými základy (mimo jiné šunka 80 g + syrovátkový protein
     *  145 g, tedy pět odměrek prášku k šunce) a kupovala za to 3,6 procentního bodu
     *  přesnosti bílkovin. Vyrábělo to přesně tu vadu, kvůli které R1 vzniklo.
     *  ⇒ Doplněk jde JEN do jídla, které bílkovinu nemá a charakterem sedí; jinak se
     *  vynechá. Den s extrémním cílem bílkovin (250+ g z 2 800 kcal) zůstane pod cílem;
     *  je to známé a měřené, ne přehlédnuté.
     *  ⛔ Nezavádět zpátky. Stejná brána je v appce, hlídá parita. */
    var kamSDoplnkem = function (food, mealIdx) {
      var jeProt = food.cat === 'protein' || food.cat === 'dairy';
      var jeSladky = sladkyDoplnek(food);
      var jeSlany = slanyDoplnek(food);
      var sedne = function (i5) {
        if (jeProt && maBilkovinu(out[i5])) return false;
        if (jeSladky && !jeSladkeJidlo(out[i5])) return false;
        if (jeSlany && jeSladkeJidlo(out[i5])) return false;
        // ⛔ [oprava po revizi 2026-09-03] VAŘENÁ PŘÍLOHA DO SVAČINY NEPATŘÍ.
        // Svačina má pečivo (chléb, rohlík, houska, knäckebrot, toust), nebo zeleninu.
        // Rýže, brambory, těstoviny, bulgur, kuskus a spol. jsou k obědu a večeři.
        // Vzniklo to třemi cestami: optimalizací vlákniny (ta brala pro svačinu
        // `MAIN_CARB`), doplňkovým blokem (přílohy míří do posledního jídla, což
        // u šesti jídel je večerní svačina) a přerozdělením přetíženého jídla.
        if (jeVarenaPriloha(food) && (out[i5].kind === 'snack' || out[i5].kind === 'late')) return false;
        // ⛔ [R7 2026-09-03] Bilkovinny doplnek se poklada jen do jidla BEZ bilkoviny,
        // takze se v nem stane zakladem. Sladky mlecny zdroj tedy do obeda ani do vecere
        // nesmi ani touhle cestou (`kamSDoplnkem` saha po `tvaroh-mekky`).
        if (jeProt && jeSladky && (out[i5].kind === 'lunch' || out[i5].kind === 'dinner')) return false;
        // ⛔ [R11 2026-09-03] Do keto dne se priloha nedoplnuje ani doplnkovym blokem.
        if (lowCarb && food.cat === 'carb') return false;
        return true;
      };
      var chtene = Math.min(mealIdx, out.length - 1);
      if (sedne(chtene)) return chtene;
      for (var k5 = 0; k5 < out.length; k5++) if (sedne(k5)) return k5;
      return -1;
    };
    function addExtra(food, grams, mealIdx) {
      if (!food) return false;
      if (all.some(function (it) { return it.food.id === food.id; })) return false;
      // ⛔ [oprava po revizi 2026-09-03] GUARD `NENI_ZAKLAD_JIDLA` SE TU DRIV NEVOLAL VUBEC.
      // Doplnek miri JEN do jidla bez bilkoviny (viz `kamSDoplnkem`), takze se v nem stane
      // zakladem, a seznam niz jmenoval napevno `syrovatkovy-protein`, tedy polozku, kterou
      // `NENI_ZAKLAD_JIDLA` vyslovne zakazuje. Zamek stal jen na datech, ne na kodu.
      if ((food.cat === 'protein' || food.cat === 'dairy') && NENI_ZAKLAD_JIDLA.test(food.id)) return false;
      var cil = kamSDoplnkem(food, mealIdx);
      if (cil < 0) return false;
      var it = { food: food, grams: grams };
      out[cil].items.push(it);
      all.push(it);
      return true;
    }
    if (totalKey('kcal') < targets.kcal * 0.94) {
      var mainIdx = out.length >= 3 ? Math.floor(out.length / 2) : 0; // oběd / prostřední jídlo
      // Gramáže doplňků úměrně velikosti dne (velikostDne/vg deklarované u MIN_PRILOHA_G).
      // ⛔ [oprava po revizi 2026-09-03] `syrovatkovy-protein` z tohohle seznamu ZMIZEL.
      // Doplnek jde jen do jidla bez bilkoviny, tedy by se v nem stal ZAKLADEM, a prasek
      // zaklad jidla neni (`NENI_ZAKLAD_JIDLA`). Novy guard v `addExtra` by ho stejne
      // odmitl; nechavat tu mrtvy radek by matlo.
      if (!lowCarb) addExtra(byId('ovesne-vlocky'), vg(50), 0);
      runScale();
      if (totalKey('kcal') < targets.kcal * 0.94 || totalKey('p') < targets.protein * 0.88) {
        // druhý zdroj bílkovin k večeři (bez shaku: tvaroh; bez mléčných: tuňák; vege: tofu/tempeh)
        var protPool = ['tvaroh-mekky', 'tunak-vlastni-stava', 'tofu', 'tempeh', 'vejce'];
        for (var pi = 0; pi < protPool.length; pi++) {
          if (addExtra(byId(protPool[pi]), vg(150), out.length - 1)) break;
        }
        addExtra(byId('mandle'), vg(25), out.length - 1);
        // [R11] Banan je v keto rezimu sladke ovoce mimo bobule, do keto dne nepatri.
        if (!lowCarb) addExtra(byId('banan'), vg(100), 0);
        runScale();
        if (totalKey('kcal') < targets.kcal * 0.94) {
          var carbPool = lowCarb ? [] : ['ryze-natural-varena', 'brambory-varene', 'testoviny-celozrnne-varene', 'bulgur-vareny'];
          for (var ci = 0; ci < carbPool.length; ci++) {
            if (addExtra(byId(carbPool[ci]), vg(150), out.length - 1)) break;
          }
          var fatPool = ['olivovy-olej', 'repkovy-olej', 'avokado', 'araside-maslo'];
          if (totalKey('f') < targets.fat * 0.85) {
            for (var fi = 0; fi < fatPool.length; fi++) {
              if (addExtra(byId(fatPool[fi]), vg(12), mainIdx)) break;
            }
          }
          runScale();
        }
      }
    }

    // ⛔ [oprava po revizi 2026-09-03] JEDNA VĚTŠÍ PORCE MÍSTO DRUHÉHO ZÁKLADU.
    // Když je den výrazně pod cílem bílkovin a doplněk nemá kam jít (R1 drží tvrdě),
    // zvedne se STROP PORCE hlavního zdroje z 300 na 350 g a den se přeškáluje.
    // Jeden talíř s 350 g masa je pořád jedno jídlo; 300 g masa plus shake jsou dva
    // základy, a přesně to R1 zakazuje. Spustí se jen pod 88 % cíle, tedy na dni,
    // který cíl vážně nesplní: na mřížce 1152 dnů se to týká 11 dnů.
    // ⛔ Uzenina si strop 80 g drží dál (`capPass`), tahle úleva je pro maso, ryby
    // a mléčné zdroje, ne pro šunku.
    if (totalKey('p') < targets.protein * 0.88) {
      nouzeBilkovin = true;
      runScale();
    }

    // [fix 2026-07-22] Finální dorovnání KALORIÍ při velké DB (stejný mechanismus, jaký má
    // appka Tvůj Coach): skrytý tuk a cukr v přílohách se nedá doškálovat po makrech. Když
    // kcal po všem přesahují cíl o >6 %, uber sacharidovou kategorii, pak tukovou; bílkoviny
    // jsou floor a nesahá se na ně.
    // [fix 2026-07-26] Dorovnání je nově OBOUSMĚRNÉ a s prahem 5 %, stejně jako v appce.
    // Dřív uměl web jen ubírat, takže podstřelený den zůstal podstřelený a musel se zachraňovat
    // doplňkovým blokem výš. Naměřeno na 324 dnech: web měl odchylku kalorií 4,0 %, appka
    // s obousměrným dorovnáním 2,2 %, a u malých cílů (1400 kcal) byl rozdíl 6,0 vs 1,4 %.
    // Bílkovinou se neškáluje ani teď, je to floor (filozofie enginu).
    var overKcal = totalKey('kcal') - targets.kcal;
    if (Math.abs(overKcal) > targets.kcal * 0.05) {
      var carbK = sumP('carb', 'kcal');
      if (carbK > 0) {
        var cf2 = Math.max(0.3, Math.min(2.4, (carbK - overKcal) / carbK));
        all.forEach(function (it) { if (it.food.cat === 'carb') it.grams *= cf2; });
      } else if (overKcal > 0) {
        // ⛔ [oprava 2026-09-03] DEN BEZ JEDINE POLOZKY `carb` SE NEDAL SNIZIT. Sacharidovy
        // cil mu pokrylo ovoce a rostlinne mlecne vyrobky, takze tenhle krok byl prazdna
        // operace a prestrel zustal (zmereno: vegan bez lepku, 1400 kcal, 6 jidel, +9,8 %).
        // Nosic sacharidu je pak OVOCE, a to se smi zmensit; nikdy ne pod polovinu porce.
        var fruitK = sumP('fruit', 'kcal');
        if (fruitK > 0) {
          var ffr = Math.max(0.5, Math.min(1, (fruitK - overKcal) / fruitK));
          all.forEach(function (it) { if (it.food.cat === 'fruit') it.grams *= ffr; });
        }
      }
      // Zbývající PŘESTŘEL dorovnej ubráním tuku. Nahoru se tuk nepřidává, má floor.
      overKcal = totalKey('kcal') - targets.kcal;
      if (overKcal > targets.kcal * 0.05) {
        var fatK = sumP('fat', 'kcal');
        if (fatK > 0) {
          var ff2 = Math.max(0.2, Math.min(1, (fatK - overKcal) / fatK));
          all.forEach(function (it) { if (it.food.cat === 'fat') it.grams *= ff2; });
        }
      }
      capPass();
    }

    // hezké zaokrouhlení gramů (5 g, drobné zdroje tuku na 1 g); stropy už drží capPass()
    all.forEach(function (it) {
      var step = (it.food.cat === 'fat' && it.grams < 40) ? 1 : 5;
      it.grams = Math.max(step, Math.round(it.grams / step) * step);
      // [fix 2026-08-19] Po finálním kcal trimu podlahu přílohy NEOBNOVIT natvrdo.
      // Trim už trefil cíl (+1,9 %); 10 g → 25-40 g vracelo přestřel (+13 %).
      // Zvedni přílohu jen dokud se den vejde do +5 %, a na viditelných 15 g
      // jen když se to ještě vejde (drobky na talíři). runScale podlahu dál
      // drží proti křížovému škálování na běžném dni.
      // ⛔ Stejná změna je v appce (`src/engine/meal-gen-core.ts`), hlídá parita.
      if (!lowCarb && it.food.cat === 'carb' && it.grams < podlahaPrilohy(it.food)) {
        var want = podlahaPrilohy(it.food);
        var kcalPerG = (it.food.per100.kcal || 0) / 100;
        var room = targets.kcal * 1.05 - totalKey('kcal');
        if (kcalPerG > 0 && room > 0) {
          it.grams += Math.min(want - it.grams, room / kcalPerG);
        }
        if (it.grams < 15 && kcalPerG > 0) {
          var need = (15 - it.grams) * kcalPerG;
          if (need <= Math.max(0, targets.kcal * 1.05 - totalKey('kcal'))) {
            it.grams = 15;
          }
        }
      }
      var cap = stropG(it.food); if (cap && it.grams > cap) it.grams = cap;
    });
    // Součet tří ifFits zdvihů umí přelézt +5 % o zaokrouhlení. Mikro-ořez jen
    // sacharidů, nejdřív k 15 g (viditelná porce), pak k 10 g. Velký den sem
    // nespadne: po trimu je pod +5 % a větev se nespustí.
    if (!lowCarb && totalKey('kcal') > targets.kcal * 1.05) {
      var orezK = function (minG, kat) {
        var katOrez = kat || 'carb';
        for (var oi = 0; oi < all.length; oi++) {
          var it = all[oi];
          if (it.food.cat !== katOrez || it.grams <= minG) continue;
          var over = totalKey('kcal') - targets.kcal * 1.05;
          if (over <= 0) break;
          var kcalPerG = (it.food.per100.kcal || 0) / 100;
          if (kcalPerG <= 0) continue;
          it.grams -= Math.min(it.grams - minG, over / kcalPerG);
        }
      };
      // [R5 2026-09-03] Orez smi jit pod minimalni porci schvalne: pruchod minimalnich
      // porci niz ten drobek stejne vyhodi, a pro den NAD cilem je vyhozeni to spravne
      // reseni (posune ho k cili). Zvednout orez az na MIN_PORCE_G bylo meritelne horsi:
      // median odchylky kcal na 48 dnech 1,26 % proti 1,16 %.
      orezK(15);
      if (totalKey('kcal') > targets.kcal * 1.05) orezK(10);
      // ⛔ [oprava 2026-09-03] DEN BEZ POLOZKY `carb` NEMEL NA CEM UBRAT. Vegan bez lepku
      // na 1 400 kcal a sesti jidlech stoji na rostlinnych jogurtech (kategorie `dairy`,
      // kterou normalizace zamerne neskaluje) a nema ani prilohu, ani tuk; orez tak byl
      // prazdna operace a den prestrelil o 9,8 %. Nosicem sacharidu je tam OVOCE.
      var maCarb = all.some(function (it) { return it.food.cat === 'carb'; });
      if (totalKey('kcal') > targets.kcal * 1.05 && !maCarb) orezK(MIN_PORCE_G, 'fruit');
    }
    // [fix 2026-07-14] minigramáže („přidej 1 g oleje") v klientském plánu nemají co dělat —
    // nebílkovinné položky pod 8 g vyhodíme (pár kalorií totály poctivě ukážou);
    // bílkovinné zdroje drží podlahu 30 g z runScale, ty nemažeme.
    out.forEach(function (m) {
      m.items = m.items.filter(function (it) { return it.food.cat === 'protein' || it.grams >= 8; });
    });
    // (Průchod minimálních porcí podle R5 běží až za vlákninou, viz níž: optimalizace
    //  vlákniny umí gramáž ještě snížit, tak nemá smysl řešit ji dvakrát.)

    // [fix 2026-07-27] POSLEDNÍ ZÁCHRANA proti podstřelení. Den, který i po zaokrouhlení
    // a stropech zůstal víc než 5 % POD cílem, dorovnej na položkách, které mají do stropu
    // porce ještě rezervu.
    // ⛔ PROČ TO TU MUSÍ BÝT: finální dorovnání kalorií výš selhává ve DVOU případech:
    //  1. den nemá ANI JEDNU položku kategorie `carb` (sacharidový cíl pokryje ovoce
    //     a zelenina) → podmínka `carbKcal > 0` neplatí a dorovnání je prázdná operace
    //  2. dorovnání sacharidy zvětší, jenže strop hned za ním je ořeže zpátky
    //     a kalorie se už nikdy nepřepočítají
    // Naměřeno 27. 7. 2026 po přidání chudé zeleniny (paprika zelená 20 kcal): 6 dnů
    // z 324 skončilo 10 až 13 % POD cílem. Obě vady jsou v enginu dávno.
    // Roste se jen na NOSIČÍCH SACHARIDŮ (carb, pak fruit) — zelenina se schválně
    // nezvětšuje, 250 g špenátu navíc přidá pár kalorií a klientovi to nedává smysl.
    // ⛔ Stejná oprava je v appce (`src/engine/meal-gen.ts`), hlídá parita.
    // ⛔⛔ [oprava 2026-09-02] SČÍTAT SE MUSÍ PO JÍDLECH, ne položku po položce do jedné
    // proměnné. Appka sčítá vnořeně (`out.reduce` → `m.items.reduce`) a web plochým
    // `mel +=`; je to táž matematika, ale JINÉ pořadí sčítání, takže se výsledky liší
    // v posledním bitu. Naměřeno: chybějící kalorie vyšly 159,6 v appce a
    // 159,60000000000002 na webu, `Math.ceil(chybi / naGram / 5)` z toho udělal 14 a 15,
    // a klient dostal na webu o 5 g pečiva víc. Základní paritní mřížka to nechytila
    // (360/360 shoda), našlo se to až na týdnu přes assembleWeek.
    var chybiKcal = function () {
      var mel = out.reduce(function (s, m) {
        return s + m.items.reduce(function (q, it) { return q + macrosFor(it.food, it.grams).kcal; }, 0);
      }, 0);
      return targets.kcal - mel;
    };
    // ⚠️ POŘADÍ JE ZÁMĚRNÉ. První verze (27. 7.) nafukovala rovnou ovoce do stropu a kalorie
    // tím trefila, jenže vyrobila snídani s 250 g moruší a 190 g banánu a sacharidy přestřelila
    // o 27 %. Metrika se zlepšila a talíř zhoršil. Proto se nejdřív sahá na přílohu.
    var PRILOHY = ['ryze-natural-varena', 'brambory-varene', 'testoviny-celozrnne-varene', 'bulgur-vareny'];
    if (chybiKcal() > targets.kcal * 0.05) {
      // 1) Zvětši přílohy, které mají do stropu rezervu. Víc rýže je normální rada.
      out.forEach(function (m) {
        m.items.forEach(function (it) {
          if (it.food.cat !== 'carb') return;
          var chybi = chybiKcal();
          if (chybi <= targets.kcal * 0.05) return;
          var cap = stropG(it.food);
          var rezerva = Math.max(0, (cap != null ? cap : Infinity) - it.grams);
          var naGram = it.food.per100.kcal / 100;
          if (rezerva < 5 || naGram <= 0) return;
          it.grams += Math.min(rezerva, Math.ceil(chybi / naGram / 5) * 5);
        });
      });
      // 2) Den nemá ŽÁDNOU přílohu? Přidej ji. Tohle je ta vada „kategorie carb zmizela":
      //    sacharidový cíl pokryly ovoce a zelenina, takže nebylo co škálovat.
      var maPrilohu = out.some(function (m) {
        return m.items.some(function (it) { return it.food.cat === 'carb'; });
      });
      // [R11 2026-09-03] V keto rezimu se priloha NEPRIDAVA ani jako posledni zachrana.
      // Den, ktery cil nesplni, to radsi zahlasi (viz `warnings` niz).
      if (chybiKcal() > targets.kcal * 0.05 && !maPrilohu && !lowCarb) {
        for (var pi = 0; pi < PRILOHY.length; pi++) {
          var f = byId(PRILOHY[pi]);
          if (!f) continue;
          if (all.some(function (it) { return it.food.id === f.id; })) continue;
          var naGramP = f.per100.kcal / 100;
          if (naGramP <= 0) continue;
          var capP = stropG(f);
          var g = Math.min(capP != null ? capP : Infinity, Math.ceil(chybiKcal() / naGramP / 5) * 5);
          if (g >= MIN_PORCE_G) {
            var novaPolozka = { food: f, grams: g };
            out[out.length - 1].items.push(novaPolozka);
            all.push(novaPolozka);
          }
          break;
        }
      }
      // 2b) ⛔ [R9 2026-09-03] DRUHA PRILOHA DO DRUHEHO HLAVNIHO JIDLA.
      // Strop prilohy (300 g varene, 100 g suche) je nova podminka a na velkem dni
      // s malo jidly ji den nedokaze obejit zvetsenim: 3 000 kcal ve trech jidlech
      // skoncilo 6 az 10 % pod cilem (zmereno 12 dnu z 768). Kucharsky spravna odpoved
      // neni hora ryze na jednom taliři, ale priloha i ke druhemu hlavnimu jidlu.
      // ⛔ Jen do OBEDA nebo VECERE, ktere prilohu jeste nemaji, a jen mimo keto.
      if (chybiKcal() > targets.kcal * 0.05 && !lowCarb) {
        for (var p2 = 0; p2 < PRILOHY.length; p2++) {
          if (chybiKcal() <= targets.kcal * 0.05) break;
          var f2 = byId(PRILOHY[p2]);
          if (!f2) continue;
          var uz2 = all.some(function (it) { return it.food.id === f2.id; });
          if (uz2) continue;
          var naGram2 = f2.per100.kcal / 100;
          if (naGram2 <= 0) continue;
          // Nejdriv hlavni jidlo BEZ prilohy. Kdyz takove neni a den je porad vic nez 5 %
          // pod cilem, smi dostat druhou prilohu i talir, ktery uz jednu ma.
          // ⚠️ VEDOMY ustupek: dve skrobove prilohy na jednom taliři jsou kucharsky sporne,
          // ale jeste horsi je den, ktery o 20 az 40 % mine cil u objemoveho profilu
          // (115 kg, narust, 3 jidla = 4 598 kcal). Jen jako posledni zachrana, nikdy pri
          // beznem skladani dne, a nejvys dve prilohy na jedno hlavni jidlo.
          var cil2 = -1;
          for (var m2 = 0; m2 < out.length; m2++) {
            if (out[m2].kind !== 'lunch' && out[m2].kind !== 'dinner') continue;
            var maC2 = out[m2].items.some(function (it) { return it.food.cat === 'carb'; });
            if (!maC2) { cil2 = m2; break; }
          }
          if (cil2 < 0) {
            for (var m2b = 0; m2b < out.length; m2b++) {
              if (out[m2b].kind !== 'lunch' && out[m2b].kind !== 'dinner') continue;
              var pocetC = out[m2b].items.filter(function (it) { return it.food.cat === 'carb'; }).length;
              if (pocetC < 2) { cil2 = m2b; break; }
            }
          }
          if (cil2 < 0) break;
          var cap2 = stropG(f2);
          var g2 = Math.min(cap2 != null ? cap2 : Infinity, Math.ceil(chybiKcal() / naGram2 / 5) * 5);
          if (g2 < MIN_PORCE_G) continue;
          var it2 = { food: f2, grams: g2 };
          out[cil2].items.push(it2);
          all.push(it2);
        }
      }
      // 2c) ⛔ [R8 2026-09-03] CHYBEJICI KALORIE DOROVNA TUK, NE HORA PRILOHY.
      // Presne to rika rozhodnuti sefa u R8: „chybejici tuk se dorovnava tucnejsim zdrojem
      // bilkoviny nebo avokadem, ne litrem oleje". Kdyz je den i po prilohach pod cilem
      // (typicky 3 000 kcal ve trech jidlech, kde priloha narazila na strop 300 g a zakladem
      // je extremne libove maso), prida se do hlavniho jidla hrst semínek, avokado, nebo
      // lzice oleje, kazde do sveho stropu z R8.
      if (chybiKcal() > targets.kcal * 0.05) {
        // ⚠️ Jen tuky ze `SLANY_TUK`: hlavni jidlo je slane a hrst mandli k masu se
        // zeleninou je presne ten neparujici tuk, ktery engine resil v srpnu.
        var TUKY_ZACHRANA = ['dynova-seminka', 'slunecnicova-seminka', 'avokado', 'olivovy-olej'];
        for (var t2 = 0; t2 < TUKY_ZACHRANA.length; t2++) {
          if (chybiKcal() <= targets.kcal * 0.05) break;
          // ⛔ Tuk je tu ZAPLATA NA KALORIE, ne cesta, jak prestrelit tukovy cil. Den, ktery
          // uz na tuku je (tucne maso nese svuj vlastni), tuhle vypomoc nedostane. Bez
          // teto brany vysel tydenni den 3 300 kcal s tukem +31,5 % nad cilem. Prah 1,15
          // je tyz jako u pojistky na skryty tuk vys.
          if (totalKey('f') > targets.fat * 1.15) break;
          var f3 = byId(TUKY_ZACHRANA[t2]);
          if (!f3) continue;
          var uz3 = all.some(function (it) { return it.food.id === f3.id; });
          if (uz3) continue;
          var naGram3 = f3.per100.kcal / 100;
          if (naGram3 <= 0) continue;
          // ⚠️ Bere se hlavni jidlo s NEJVETSIM schodkem, a kdyz je nad cilem kazde, tak to
          // nejmene preplnene. Kdyby se braly jen podstrelene, den, jehoz schodek sedi ve
          // svacinach, by vypomoc nedostal vubec (zmereno na tydennim dni 3 300 kcal / 6 jidel).
          var cil3 = -1;
          var nejhorsi3 = -Infinity;
          for (var m3 = 0; m3 < out.length; m3++) {
            if (out[m3].kind !== 'lunch' && out[m3].kind !== 'dinner') continue;
            var kcalM3 = out[m3].items.reduce(function (q, it) { return q + macrosFor(it.food, it.grams).kcal; }, 0);
            var chybiM3 = out[m3].targetKcal - kcalM3;
            if (chybiM3 > nejhorsi3) { nejhorsi3 = chybiM3; cil3 = m3; }
          }
          if (cil3 < 0) break;
          var stropT3 = stropTuku(f3);
          var strop3 = stropT3 != null ? stropT3 : CAP[f3.cat];
          var g3 = Math.min(strop3, Math.ceil(chybiKcal() / naGram3 / 5) * 5);
          if (g3 < 8) continue;
          var it3 = { food: f3, grams: g3 };
          out[cil3].items.push(it3);
          all.push(it3);
        }
      }
      // 3) Teprve zbytek dolaď na ovoci, a jen MÍRNĚ (nejvýš o polovinu původní porce),
      //    ať nevznikne miska ovoce místo jídla.
      out.forEach(function (m) {
        m.items.forEach(function (it) {
          if (it.food.cat !== 'fruit') return;
          var chybi = chybiKcal();
          if (chybi <= targets.kcal * 0.05) return;
          var cap = stropG(it.food);
          var rezerva = Math.min(Math.max(0, (cap != null ? cap : Infinity) - it.grams), it.grams * 0.5);
          var naGram = it.food.per100.kcal / 100;
          if (rezerva < 5 || naGram <= 0) return;
          it.grams += Math.min(rezerva, Math.ceil(chybi / naGram / 5) * 5);
        });
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // [2026-09-02] VLÁKNINA JAKO CÍL. Jeden optimalizační průchod nad hotovým dnem.
    //
    // ⛔ Spustí se JEN když cíl přijde (`targets.fiber > 0`). Bez něj se nezmění ani gram,
    // takže stávající chování, parita 360/360 i naměřená přesnost zůstávají netknuté.
    // ⚠️ POZOR: `computeTargets` výš vlákninu VRACÍ, takže kalkulačka, která pošle celý
    // výsledek do assembleDay, tenhle průchod nově zapne. Je to záměr, ne nedopatření.
    //
    // Filozofie: kalorie a bílkovina už sedí, tak se na ně nesahá. Vláknina se doplňuje
    // dvěma tahy, které jsou z principu kaloricky neutrální:
    //   M1 ZÁMĚNA: položka za vlákninatější ze STEJNÉ kategorie při stejných kaloriích
    //              (bílá rýže → natural, houska → celozrnný chleba, hrášek → čočka).
    //   M2 PŘESUN: pár gramů z nejchudší položky na vlákninu do té nejbohatší
    //              (míň rýže, víc luštěnin nebo zeleniny) při stejných kaloriích.
    // Obojí se po každém kroku ověří proti kalorickému pásmu i bílkovině; když by tah
    // pásmo porušil, VRÁTÍ SE a průchod končí. Radši nižší vláknina než rozbitý den.
    //
    // ⚠️ Není to záruka, že se cíl trefí. Vláknina je vedlejší produkt výběru potravin,
    // a když v povolené nabídce nic vlákninatějšího není, den prostě skončí níž.
    // ⛔ Táž logika je v appce (`src/engine/meal-gen-core.ts`), hlídá parita-jidelnicku.mjs.
    // ─────────────────────────────────────────────────────────────────────────
    if (typeof targets.fiber === 'number' && targets.fiber > 0) {
      // ⛔⛔ [oprava po auditu 2026-09-02] PRŮCHOD MÍŘÍ NA PÁSMO, NE „NAHORU, DOKUD NEPŘETEČE".
      // Dřív byla podmínka smyček jen `fib < cíl`, takže průchod skončil AŽ V OKAMŽIKU,
      // KDY cíl překročil, a vybíral se tah s NEJVĚTŠÍM ziskem vlákniny, tedy ten, který
      // přestřelí nejvíc. Naměřeno na 1440 dnech: medián přestřelení 44 %, 18 % dnů nad
      // stropem 60 g, rekord 96 g. Nově má den pásmo ⟨cíl; cíl+10 %⟩, shora tvrdě omezené
      // `FIBER_CAP_G`, a engine se do něj trefuje z OBOU stran (dřív uměl jen přidávat).
      var cilVlakniny = Math.min(targets.fiber, FIBER_CAP_G);
      // ⛔⛔ [rozhodnutí šéfa po revizi 2026-09-02] HORNÍ HRANICE JE STROP 60 g, NE „cíl + 10 %".
      // Mezikrok s pásmem cíl+10 % sice vlákninu srazil, ale platil za to KVALITOU jídla:
      // celozrnné přílohy −48 % (203 → 105 g na den), bílé těstoviny +150 %, rohlík z nuly
      // na 30 g, chia −90 %. Zelenina se skoro nehnula, luštěniny v generátoru nikdy nebyly.
      // ⇒ Vlákninu engine DOPLŇUJE k cíli a zastaví se na něm (kritérium „nejblíž cíli" níž),
      // ale UBÍRÁ ji jen tehdy, když den přeleze `FIBER_CAP_G`.
      var mimoPasmo = function (fib) {
        if (fib < cilVlakniny) return cilVlakniny - fib;
        if (fib > FIBER_CAP_G) return fib - FIBER_CAP_G;
        return 0;
      };
      // Druhé kritérium výběru: ze dvou tahů, které pásmo poruší stejně (typicky oba nula),
      // ber ten, který skončí BLÍŽ CÍLI. Bez toho by dorovnání skočilo z 20 rovnou na 58 g.
      var odCile = function (fib) { return Math.abs(fib - cilVlakniny); };
      // ⛔ `fat` v seznamu PŘIBYLO a je to podstatné: chia semínka, lněné a slunečnicové
      // semínko jsou kategorie `fat` a nesou 10 až 17 g vlákniny na porci. Bez nich neměl
      // průchod na nejhorších dnech na čem ubrat.
      var VLAK_KAT = ['carb', 'legume', 'veg', 'fruit', 'snack', 'fat'];
      var polozky = function () {
        var a = [];
        out.forEach(function (m) { m.items.forEach(function (it) { a.push(it); }); });
        return a;
      };
      var den = function (key) {
        return polozky().reduce(function (s2, it) { return s2 + macrosFor(it.food, it.grams)[key]; }, 0);
      };
      // Pásmo je ±3 % cíle, ale nikdy přísnější, než jak den dopadl PŘED průchodem.
      // Jinak by průchod na dni, který už mimo pásmo je, neudělal vůbec nic.
      var kcalPredVl = den('kcal');
      var pasmoVl = Math.max(targets.kcal * 0.03, Math.abs(kcalPredVl - targets.kcal));
      var kcalOkVl = function () { return Math.abs(den('kcal') - targets.kcal) <= pasmoVl + 0.5; };
      // Bílkovina je PODLAHA, ne cíl k dorovnání. Ubrat se z ní smí jen to, co je nad
      // cílem: den, který je pod cílem bílkovin, se kvůli vláknině nesmí zhoršit ani o gram.
      // (První verze pouštěla pokles na 98 % dosažené hodnoty; tady na webu, kde kalkulačka
      // posílá cíl vlákniny z computeTargets rovnou do assembleDay, tím v tools-test vyrostla
      // nejhorší odchylka bílkovin z 19 na 25 g.)
      var bilkovinaPredVl = den('p');
      // ⛔ [oprava po revizi 2026-09-03] Podlaha je i RELATIVNÍ, ne jen cíl. Sama hodnota
      // cíle nestačí: den, který na bílkovinu vyšel nad cíl (195 g proti 190), směl přijít
      // o celý ten přebytek, a `training.test.ts` na to má vlastní kontrolu (bílkovina
      // neklesne pod 98 % původní), kterou to porušovalo. Vláknina je vedlejší cíl,
      // bílkovina hlavní: ubrat se z ní smí nejvýš 2 %.
      var bilkovinaPodlahaVl = Math.min(bilkovinaPredVl, targets.protein);
      // ⛔ DVE podlahy, kazda s vlastni toleranci. Absolutni (cil, nebo startovni hodnota
      // pod cilem) smi mit 0,5 g vuli na zaokrouhleni. RELATIVNI ji mit NESMI: den, ktery
      // na bilkovinu vysel nad cil (195 g proti 190), smel driv prijit o cely ten prebytek
      // a `training.test.ts` na to ma kontrolu (bilkovina neklesne pod 98 % puvodni).
      var bilkovinaOkVl = function () {
        return den('p') >= bilkovinaPodlahaVl - 0.5 && den('p') >= bilkovinaPredVl * 0.98;
      };
      // ⛔ Hlídat se musí i TUK, protože průchod nově sahá i na kategorii `fat`. Výměna
      // „chia semínka za olivový olej" drží kalorie, ale přesouvá je do čistého tuku.
      var tukPredVl = den('f');
      var tukPasmoVl = Math.max(targets.fat * 0.15, Math.abs(tukPredVl - targets.fat));
      var tukOkVl = function () { return Math.abs(den('f') - targets.fat) <= tukPasmoVl + 0.5; };
      // Gramů vlákniny na 1 kcal: chceme víc vlákniny za tytéž kalorie, ne víc jídla.
      var hustotaVl = function (f) { return (f.per100.fib || 0) / Math.max(1, f.per100.kcal || 0); };
      var stropPolozky = function (f) {
        var c = stropG(f);
        return c != null ? c : 400;
      };

      // M1: záměna za vlákninatější položku téže kategorie při stejných kaloriích.
      // ⚠️ Zamítnutá záměna NESMÍ ukončit celý průchod. Nejvlákninatější kandidát bývá
      // zároveň ten, který nejvíc rozhodí kalorie nebo bílkovinu; když se po jeho vrácení
      // skončí, průchod na spoustě dnů neudělá vůbec nic (změřeno: 15 dnů ze 400 mělo
      // vlákninu beze změny, přestože v nabídce lepší položky byly). Proto se zamítnutá
      // potravina jen odloží a zkusí se další v pořadí.
      var zamitnute = {};
      // ⛔ [rozhodnutí šéfa po revizi] Když se vláknina SNIŽUJE, přílohy jsou na řadě
      // POSLEDNÍ. Celozrnná příloha je to jediné, co se vyměnit nemá; semínka, ovoce
      // a zelenina jsou lepší páka. Teprve když bez příloh není co udělat, pustí se i ony.
      var prilohyPovoleny = false;
      // ⚠️ 60 kol, ne 12: jedno kolo spotřebuje i tah, který se VRÁTÍ (typicky výměna
      // celozrnných těstovin za rýži, která by ubrala bílkovinu). Změřeno: při 24 kolech
      // zůstalo 9 dnů z 1440 nad stropem, při 60 ani jeden.
      for (var kolo1 = 0; kolo1 < 60; kolo1++) {
        var fibTed = den('fib');
        var chybaTed = mimoPasmo(fibTed);
        var snizujeme = fibTed > FIBER_CAP_G;
        // Nad stropem se netoleruje NIC (strop je slib, ne přání), pod cílem má smysl
        // přestat u desetiny gramu.
        if (chybaTed <= (snizujeme ? 0 : 0.01)) break;
        var pouziteVl = {};
        polozky().forEach(function (it) { pouziteVl[it.food.id] = 1; });
        var nej = null;
        for (var mi = 0; mi < out.length; mi++) {
          var mm1 = out[mi];
          for (var ii = 0; ii < mm1.items.length; ii++) {
            var it1 = mm1.items[ii];
            if (VLAK_KAT.indexOf(it1.food.cat) === -1) continue;
            if (snizujeme && !prilohyPovoleny && it1.food.cat === 'carb') continue;
            var kcalIt = macrosFor(it1.food, it1.grams).kcal;
            if (kcalIt <= 0) continue;
            var fibIt = macrosFor(it1.food, it1.grams).fib;
            // Příloha musí zůstat vhodná k typu jídla, jinak by k snídani přistála rýže.
            // Tuk se páruje k charakteru jídla stejným pravidlem jako při skládání, jinak
            // by výměna kvůli vláknině přinesla chia do slaného oběda.
            var maOvoceJ = mm1.items.some(function (x) { return x.food.cat === 'fruit'; });
            var maZeleninuJ = mm1.items.some(function (x) { return x.food.cat === 'veg'; });
            var vhodnost = it1.food.cat === 'carb'
              ? preferForMeal('carb', mm1.kind, jeSladkeJidlo(mm1))
              : (it1.food.cat === 'fat'
                ? (maOvoceJ && !maZeleninuJ ? SLADKY_TUK : (maZeleninuJ ? SLANY_TUK : null))
                : null);
            for (var di = 0; di < db.length; di++) {
              var f1 = db[di];
              if (f1.cat !== it1.food.cat || !f1.bezny || pouziteVl[f1.id] || zamitnute[f1.id]) continue;
              if (!(f1.per100.kcal > 0)) continue;
              if (vhodnost && !vhodnost.test(f1.id)) continue;
              // [R11 2026-09-03] Optimalizace vlakniny nesmi do keto dne vratit obilovinu
              // ani sladke ovoce zadnimi vratky (zamena „maliny → hruska" kvuli vlaknine).
              if (lowCarb && f1.cat === 'carb') continue;
              if (lowCarb && f1.cat === 'fruit' && !BOBULE_RE.test(f1.id)) continue;
              // [R10 2026-09-03] A do hlavniho jidla nesmi vratit sladkou zeleninu.
              if (f1.cat === 'veg' && SLADKA_ZELENINA_RE.test(f1.id)
                && (mm1.kind === 'lunch' || mm1.kind === 'dinner')) continue;
              var g1 = Math.round((kcalIt / f1.per100.kcal) * 100 / 5) * 5;
              g1 = Math.min(g1, stropPolozky(f1));
              if (g1 < (f1.cat === 'fat' ? 8 : MIN_PORCE_G)) continue; // [R5] drobek na talíři ne
              // [R9 2026-09-03] Zamena kvuli vlaknine nesmi srazit zeleninu hlavniho jidla
              // pod 100 g (hustsi zelenina za stejne kalorie = mensi porce).
              if (f1.cat === 'veg' && (mm1.kind === 'lunch' || mm1.kind === 'dinner')
                && g1 < MIN_ZELENINA_HLAVNI_G) continue;
              // ⛔ Rozhoduje VÝSLEDNÁ vzdálenost dne od pásma, ne zisk vlákniny. Tah, který
              // by cíl přeskočil (nebo den ještě víc přetáhl), tím vypadne sám.
              var novaFib = fibTed - fibIt + macrosFor(f1, g1).fib;
              var chyba = mimoPasmo(novaFib);
              // Musí to den prokazatelně zlepšit. Práh je ale ÚMĚRNÝ chybě: když je den nad
              // stropem jen o setiny gramu, pevných 0,2 g by znamenalo, že se to nikdy neopraví.
              if (chyba > chybaTed - Math.min(0.2, chybaTed) + 1e-9) continue;
              var blizkost = odCile(novaFib);
              var lepsi = !nej
                || chyba < nej.chyba - 1e-9
                || (Math.abs(chyba - nej.chyba) <= 1e-9 && blizkost < nej.blizkost - 1e-9)
                || (Math.abs(chyba - nej.chyba) <= 1e-9 && Math.abs(blizkost - nej.blizkost) <= 1e-9 && f1.id < nej.f.id);
              if (lepsi) nej = { it: it1, f: f1, g: g1, chyba: chyba, blizkost: blizkost };
            }
          }
        }
        if (!nej) {
          if (snizujeme && !prilohyPovoleny) { prilohyPovoleny = true; continue; }
          break;
        }
        var puvodF = nej.it.food, puvodG = nej.it.grams;
        nej.it.food = nej.f; nej.it.grams = nej.g;
        if (!kcalOkVl() || !bilkovinaOkVl() || !tukOkVl()) {
          nej.it.food = puvodF; nej.it.grams = puvodG;
          zamitnute[nej.f.id] = 1;
        }
      }

      // M2: přesun gramů mezi nejchudší a nejbohatší položkou na vlákninu, při stejných
      // kaloriích. ⛔ [oprava po auditu 2026-09-02] Přesun jde OBĚMA SMĚRY: když je vlákniny
      // málo, roste položka bohatá na úkor chudé, když je jí moc, přesně naopak.
      for (var kolo2 = 0; kolo2 < 8; kolo2++) {
        var fibPredKolem = den('fib');
        var chybaPredKolem = mimoPasmo(fibPredKolem);
        if (chybaPredKolem <= 0.01) break;
        var nahoru = fibPredKolem < cilVlakniny;
        // ⛔ [oprava po revizi 2026-09-02] Tie-break MUSÍ být na POZICI (index jídla a index
        // položky), ne na id potraviny. Táž potravina se ve dni vyskytne dvakrát v 9 % dnů
        // a `(a.id < b.id ? -1 : 1)` pro dvě shodná id vrátí 1 v obou směrech. Takový
        // komparátor porušuje antisymetrii a pořadí pak závisí na implementaci `sort`,
        // takže „která porce naroste" by se lišilo mezi V8 a Safari. Parita by to nechytila:
        // harness pouští webový engine v Node, tedy taky pod V8. Pozice je jednoznačná vždy.
        var kandidati = [];
        out.forEach(function (m2, mi2) {
          m2.items.forEach(function (it2, ii2) {
            if (VLAK_KAT.indexOf(it2.food.cat) !== -1 && it2.food.per100.kcal > 0) {
              kandidati.push({ it: it2, mi: mi2, ii: ii2, hlavni: (m2.kind === 'lunch' || m2.kind === 'dinner') });
            }
          });
        });
        if (kandidati.length < 2) break;
        var podleHustoty = kandidati.slice().sort(function (a, b) {
          return (hustotaVl(b.it.food) - hustotaVl(a.it.food)) || (a.mi - b.mi) || (a.ii - b.ii);
        });
        var nejbohatsiK = podleHustoty[0];
        var nejchudsiK = podleHustoty[podleHustoty.length - 1];
        var nejbohatsi = nejbohatsiK.it;
        var nejchudsi = nejchudsiK.it;
        if (nejbohatsi === nejchudsi || hustotaVl(nejbohatsi.food) - hustotaVl(nejchudsi.food) < 0.001) break;
        var rust = nahoru ? nejbohatsi : nejchudsi;
        var ubytekK = nahoru ? nejchudsiK : nejbohatsiK;
        var ubytek = ubytekK.it;
        var prostor = stropPolozky(rust.food) - rust.grams;
        // Ubírat jde jen do viditelné porce; pod minimální porci už to není porce, ale
        // drobek. [R5 2026-09-03] Podlaha zvednutá z 15 g na MIN_PORCE_G (u tuků 8 g,
        // tam jsou malé gramáže normální).
        // [R9 2026-09-03] Zelenina hlavniho jidla ma podlahu 100 g, ne 20: presun gramu
        // kvuli vlaknine z ni jinak udelal 40 g prilohy k obedu (zmereno 125 pripadu).
        var podlahaUbytku = ubytek.food.cat === 'fat'
          ? 8
          : ((ubytek.food.cat === 'veg' && ubytekK.hlavni) ? MIN_ZELENINA_HLAVNI_G : MIN_PORCE_G);
        var lzeUbrat = ubytek.grams - podlahaUbytku;
        if (prostor < 5 || lzeUbrat < 5) break;
        var kcalGr = rust.food.per100.kcal / 100;
        var kcalGu = ubytek.food.per100.kcal / 100;
        var pridej = Math.min(prostor, 20);
        var uber = (pridej * kcalGr) / kcalGu;
        if (uber > lzeUbrat) {
          uber = lzeUbrat;
          pridej = (uber * kcalGu) / kcalGr;
        }
        pridej = Math.round(pridej / 5) * 5;
        uber = Math.round(uber / 5) * 5;
        if (pridej < 5 || uber < 5) break;
        rust.grams += pridej;
        ubytek.grams -= uber;
        if (mimoPasmo(den('fib')) >= chybaPredKolem || !kcalOkVl() || !bilkovinaOkVl() || !tukOkVl()) {
          rust.grams -= pridej;
          ubytek.grams += uber;
          break;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // [R5 2026-09-03] MINIMÁLNÍ PORCE 20 g u všeho kromě tuků.
    //
    // Běží až TADY, protože gramáže hýbe i finální trim kalorií a optimalizace vlákniny;
    // dřív by se rozhodovalo nad čísly, která se ještě změní.
    //
    // Volba zvednout na 20 g, nebo vypustit se dělá podle toho, co MÍŇ rozhodí kalorie
    // dne, protože přesnost dne je to, co engine slibuje. Prakticky to znamená: položka
    // pod ~10 g je energeticky blíž nule a vypadne, položka nad ~10 g se dorovná na porci.
    // Bílkovinný zdroj se NIKDY nevypouští (základ jídla), jen se případně zvedne.
    // ⛔ Táž logika je v appce (`src/engine/meal-gen-core.ts`), hlídá parita.
    // ─────────────────────────────────────────────────────────────────────────
    var kcalDne = function () {
      return out.reduce(function (s6, m6) {
        return s6 + m6.items.reduce(function (q6, it) { return q6 + macrosFor(it.food, it.grams).kcal; }, 0);
      }, 0);
    };
    out.forEach(function (m) {
      m.items = m.items.filter(function (it) {
        if (it.food.cat === 'fat' || it.grams >= MIN_PORCE_G) return true;
        var kcalNaGram = (it.food.per100.kcal || 0) / 100;
        var ted = kcalDne();
        var poZvednuti = Math.abs(ted + (MIN_PORCE_G - it.grams) * kcalNaGram - targets.kcal);
        var poVypusteni = Math.abs(ted - it.grams * kcalNaGram - targets.kcal);
        // Bilkovinny zdroj se nevypousti NIKDY, ani mlecny: bez nej by z jidla zbyla
        // priloha se zeleninou. Merene: bez `dairy` v teto podmince spadl u jednoho dne
        // z 80 test `vlaknina: bilkovina neklesne pod 98 % puvodni`.
        if (it.food.cat === 'protein' || it.food.cat === 'dairy' || poZvednuti <= poVypusteni) {
          it.grams = MIN_PORCE_G;
          return true;
        }
        return false;
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // [oprava po auditu 2026-09-02] PŘETÍŽENÉ JÍDLO SE PŘEROZDĚLÍ, NIC SE NEMAŽE.
    // Součet gramů jednoho jídla nikdo nehlídal (detail u STROP_HLAVNI_JIDLO_G výš).
    // Řeší se PŘESUNEM celé položky do jiného jídla, ne zmenšením porce: přesun nemění
    // ani gram denních maker, takže všechna dorovnání a stropy výš zůstávají platné.
    // Když se položka nemá kam přesunout (málo jídel, vysoký cíl), zůstane, kde je.
    // ⛔ Táž logika je v appce (`src/engine/meal-gen-core.ts`), hlídá parita-jidelnicku.mjs.
    // ─────────────────────────────────────────────────────────────────────────
    var stropJidla = function (k) {
      return (k === 'snack' || k === 'late') ? STROP_SVACINA_G : STROP_HLAVNI_JIDLO_G;
    };
    var hmotnostJidla = function (m) {
      return m.items.reduce(function (s3, it) { return s3 + it.grams; }, 0);
    };
    var neresitelne = {};
    for (var koloH = 0; koloH < 12; koloH++) {
      var zdroj = -1, nejvic = 0;
      out.forEach(function (m3, i3) {
        if (neresitelne[i3]) return;
        var nad = hmotnostJidla(m3) - stropJidla(m3.kind);
        if (nad > nejvic) { nejvic = nad; zdroj = i3; }
      });
      if (zdroj < 0) break;
      var jidlo = out[zdroj];
      // Základ jídla se nestěhuje: první bílkovinný zdroj a první příloha. Bez nich by
      // z oběda zbyla zelenina a klient by dostal talíř bez masa a bez přílohy.
      var drzet = [];
      var zaklad = jidlo.items.filter(function (it) { return it.food.cat === 'protein' || it.food.cat === 'dairy'; })[0];
      if (zaklad) drzet.push(zaklad);
      var prilohaH = jidlo.items.filter(function (it) { return it.food.cat === 'carb'; })[0];
      if (prilohaH) drzet.push(prilohaH);
      // ⛔ [R9 2026-09-03] U OBEDA A VECERE SE NESTEHUJE ANI ZELENINA. Presne tudy vznikl
      // obed „Tempeh 75 g + 495 g varenych testovin" bez jedine zeleniny: talir prelezl
      // strop 700 g a jedina stehovatelna polozka byla zelenina, takze odesla ona.
      if (jidlo.kind === 'lunch' || jidlo.kind === 'dinner') {
        var zeleninaH = jidlo.items.filter(function (it) { return it.food.cat === 'veg'; })[0];
        if (zeleninaH) drzet.push(zeleninaH);
      }
      var stehovatelne = jidlo.items.filter(function (it) { return drzet.indexOf(it) === -1; })
        .slice()
        .sort(function (a, b) { return (b.grams - a.grams) || (a.food.id < b.food.id ? -1 : 1); });
      var presunuto = false;
      // ⛔ Přesun nesmí vyrobit jídlo, které už není jídlo. Prahem je 150 kcal, týž práh,
      // na kterém stojí rozdělení kalorií do jídel (viz `distProJidla`): pod ním je to
      // jedno jablko, ne svačina.
      var kcalJidla = function (m) {
        return m.items.reduce(function (s4, it) { return s4 + macrosFor(it.food, it.grams).kcal; }, 0);
      };
      var kcalZdroje = kcalJidla(jidlo);
      for (var si = 0; si < stehovatelne.length; si++) {
        var itH = stehovatelne[si];
        if (kcalZdroje - macrosFor(itH.food, itH.grams).kcal < 150) continue;
        var cilIdx = -1, nejRezerva = -1;
        /* eslint-disable no-loop-func */
        out.forEach(function (c3, i4) {
          if (i4 === zdroj) return;
          // ⛔ [R2 2026-09-03] Přesun nesmí smíchat slané a sladké. Přesně tudy vzniklo
          // hovězí mleté + těstoviny + rajče + POMERANČ 250 g jako oběd: přetížená
          // svačina odložila ovoce do hlavního jídla a nikdo se neptal, jestli tam patří.
          if (sladkyDoplnek(itH.food) && !jeSladkeJidlo(c3)) return;
          if (slanyDoplnek(itH.food) && jeSladkeJidlo(c3)) return;
          // Vařená příloha se nestěhuje do svačiny (viz jeVarenaPriloha).
          if (jeVarenaPriloha(itH.food) && (c3.kind === 'snack' || c3.kind === 'late')) return;
          // Táž potravina dvakrát v jednom jídle nedává smysl na talíři.
          if (c3.items.some(function (x) { return x.food.id === itH.food.id; })) return;
          var rezerva = stropJidla(c3.kind) - hmotnostJidla(c3) - itH.grams;
          if (rezerva >= 0 && rezerva > nejRezerva) { cilIdx = i4; nejRezerva = rezerva; }
        });
        /* eslint-enable no-loop-func */
        if (cilIdx < 0) continue;
        jidlo.items = jidlo.items.filter(function (x) { return x !== itH; });
        out[cilIdx].items.push(itH);
        presunuto = true;
        break;
      }
      if (!presunuto) neresitelne[zdroj] = 1;
    }

    // přepočítej totály po normalizaci
    out.forEach(function (m) {
      m.totals = m.items.reduce(function (s, it) {
        var mm = macrosFor(it.food, it.grams);
        s.kcal += mm.kcal; s.p += mm.p; s.c += mm.c; s.f += mm.f; s.fib += mm.fib; return s;
      }, { kcal:0, p:0, c:0, f:0, fib:0 });
    });
    var dayTot = out.reduce(function (s, m) {
      s.kcal += m.totals.kcal; s.p += m.totals.p; s.c += m.totals.c; s.f += m.totals.f; s.fib += m.totals.fib; return s;
    }, { kcal:0, p:0, c:0, f:0, fib:0 });

    // ⛔⛔ [2026-09-03] KAZDY DEN, KTERY MINE KALORICKY CIL O VIC NEZ 5 %, TO REKNE.
    // Do vlny 2 umel engine cil dohnat i tim, ze do jidla nasypal 50 g oleje (440 kcal
    // z jedne polozky). R8 to zakazuje, takze cast dnu ted cil minout MUZE, a jedine
    // spravne chovani je priznat to, ne tise vratit den, ktery vypada hotove.
    // ⛔ Kontrolni pruh tohle pole ZOBRAZUJE. Taz kontrola i totez zneni vety jsou v appce.
    var varovaniDne = [];
    var rozdilKcalD = dayTot.kcal - targets.kcal;
    if (targets.kcal > 0 && Math.abs(rozdilKcalD) > targets.kcal * 0.05) {
      varovaniDne.push(
        'Den mine kalorický cíl o ' + Math.round(rozdilKcalD) + ' kcal '
        + '(' + Math.round(dayTot.kcal) + ' místo ' + Math.round(targets.kcal) + '). '
        + 'Z povolených porcí se přesnější den poskládat nedal.'
      );
    }
    // [R11 2026-09-03] Keto den navic rekne, PROC: obiloviny do nej engine schvalne nedava.
    if (lowCarb) {
      if (dayTot.kcal < targets.kcal * 0.94) {
        varovaniDne.push(
          'Je to nízkosacharidový cíl: obiloviny, pečivo, brambory, rýži ani těstoviny do něj engine '
          + 'schválně nepřidává (R11). Zvyš porci tuku nebo bílkoviny, nebo povol víc sacharidů.'
        );
      }
      if (dayTot.p < targets.protein * 0.88) {
        varovaniDne.push(
          'Bílkovina zůstala na ' + Math.round(dayTot.p) + ' g proti cíli ' + Math.round(targets.protein) + ' g. '
          + 'V nízkosacharidovém režimu je nabídka užší; přidej si zdroj bílkoviny navíc.'
        );
      }
    }

    return { meals: out, totals: dayTot, targets: targets, warnings: varovaniDne.length ? varovaniDne : undefined };
  }

  // ---- 3) Týden + nákupní seznam (stejné chování jako appka Tvůj Coach, src/engine/meal-gen.ts) ----
  // Seed se mezi dny posouvá o 7, ať se dny opakují co nejméně.
  // ⛔ [oprava po auditu 2026-09-02] Týden má PAMĚŤ. Do téhle opravy se každý den skládal
  // úplně samostatně a lišil se jen seedem, takže nic nebránilo tomu, aby stejná bílkovina
  // padla do všech sedmi dnů (audit to naměřil na veganovi: seitan a rostlinné kousky 7/7).
  // Předává se seznam bílkovinných zdrojů z POSLEDNÍCH DVOU dnů; není to zákaz, jen
  // penalizace, jinak by se u úzkých diet den nesložil vůbec.
  // ⛔ Táž logika je v appce (`src/engine/meal-gen-core.ts`), hlídá parita-jidelnicku.mjs.
  function assembleWeek(targets, opts, days) {
    opts = opts || {}; days = days || 7;
    var base = opts.seed || 0, out = [];
    var historie = [];
    for (var i = 0; i < days; i++) {
      var nedavnoT = [];
      historie.slice(Math.max(0, historie.length - 2)).forEach(function (denniDen) {
        denniDen.forEach(function (id) { if (nedavnoT.indexOf(id) === -1) nedavnoT.push(id); });
      });
      var denT = assembleDay(targets, { meals: opts.meals, prefs: opts.prefs, db: opts.db,
        mealNames: opts.mealNames, seed: base + i * 7, nedavnoPouzite: nedavnoT });
      out.push(denT);
      var dnesni = [];
      denT.meals.forEach(function (m4) {
        m4.items.forEach(function (it) {
          if ((it.food.cat === 'protein' || it.food.cat === 'dairy') && dnesni.indexOf(it.food.id) === -1) {
            dnesni.push(it.food.id);
          }
        });
      });
      historie.push(dnesni);
    }
    return out;
  }

  var CAT_ORDER = { protein: 0, dairy: 1, carb: 2, legume: 3, veg: 4, fruit: 5, fat: 6, snack: 7 };

  // Kusové jednotky pro nákupní seznam: hmotnost jednoho kusu/balení (vychází z porcí v DB).
  // Jen položky, kde kus dává v obchodě smysl; ostatní zůstávají v gramech.
  var PIECES = {
    vejce: [60, 'ks'], bilek: [33, 'ks'],
    rohlik: [43, 'ks'], 'grahamovy-rohlik': [60, 'ks'], houska: [50, 'ks'], 'houska-celozrnna': [60, 'ks'],
    tortilla: [60, 'ks'], 'tortilla-kukuricna': [30, 'ks'], 'bezlepkova-tortilla': [30, 'ks'], 'low-carb-tortilla-wrap': [45, 'ks'],
    knackebrot: [10, 'ks'], 'bezlepkovy-knackebrot': [15, 'ks'],
    'toustovy-chleb-celozrnny': [28, 'ks'], 'chleb-toustovy-celozrnny-tmavy': [25, 'ks'], 'bezlepkovy-chleb-toustovy': [30, 'ks'],
    'ryzove-chlebicky': [9, 'ks'],
    banan: [120, 'ks'], jablko: [150, 'ks'], hruska: [150, 'ks'], 'nashi-hruska': [120, 'ks'],
    pomeranc: [150, 'ks'], kiwi: [75, 'ks'], broskev: [120, 'ks'], nektarinka: [130, 'ks'], avokado: [140, 'ks'],
    mozzarella: [125, 'bal.'],
    'tunak-vlastni-stava': [120, 'konz.'], 'tunak-v-oleji-konzerva': [80, 'konz.'], 'tunak-v-oleji-odkapany': [80, 'konz.'],
    sardinky: [90, 'konz.'], 'sardinky-v-oleji': [90, 'konz.'], 'sardinky-v-tomate': [120, 'konz.'],

    // [rozšíření 2026-07-22 · větev pieces-rozsireni-web] Další kusové jednotky z tabulky CZ retail
    // (mb-kusove-hmotnosti-grok). Párováno na web food-db id; existující hodnoty výše nedotčené.
    // Aromatická zelenina (cibule) vynechána: generátor ji nepouští na talíř, přepočet by byl mrtvý.
    kaiserka: [60, 'ks'], 'pita-chleb': [60, 'ks'], bageta: [250, 'ks'], croissant: [55, 'ks'],
    'chleb-zitny-tmavy': [40, 'ks'], 'chleb-celozrnny': [40, 'ks'], 'chleb-kvaskovy': [45, 'ks'], 'toustovy-chleb': [25, 'ks'],
    cottage: [150, 'bal.'], skyr: [150, 'bal.'], 'bily-jogurt-3': [150, 'bal.'], 'recky-jogurt-bily': [140, 'bal.'], 'ochuceny-jogurt-jahodovy': [150, 'bal.'],
    'eidam-30': [20, 'ks'], 'kureci-prsa': [180, 'ks'], 'sunka-veprova-nejvyssi-jakost': [15, 'ks'], 'anglicka-slanina': [15, 'ks'],
    mandarinka: [80, 'ks'], rajce: [100, 'ks'], paprika: [150, 'ks'], okurka: [300, 'ks'], mrkev: [80, 'ks'], brambory: [150, 'ks']
  };

  // Sloučí položky z více dní na nákupní seznam (stejná potravina = součet gramáže),
  // seřazeno po odděleních (maso/mléčné/přílohy/zelenina/…), v oddělení od největší porce.
  // U kusových položek doplní přepočet na kusy/balení (pieces + pieceLabel).
  function shoppingListFromDays(days) {
    var map = {}, list = [];
    days.forEach(function (d) { d.meals.forEach(function (m) { m.items.forEach(function (it) {
      var cur = map[it.food.id];
      if (cur) { cur.grams += it.grams; }
      else { cur = { id: it.food.id, name: it.food.name, cat: it.food.cat, grams: it.grams }; map[it.food.id] = cur; list.push(cur); }
    }); }); });
    list.forEach(function (s) {
      s.grams = Math.round(s.grams);
      var pc = PIECES[s.id];
      if (pc && s.grams >= pc[0] * 0.75) {
        s.pieces = Math.max(1, Math.round(s.grams / pc[0]));
        s.pieceLabel = pc[1];
      }
    });
    list.sort(function (a, b) {
      var ca = (CAT_ORDER[a.cat] != null ? CAT_ORDER[a.cat] : 9), cb = (CAT_ORDER[b.cat] != null ? CAT_ORDER[b.cat] : 9);
      return (ca - cb) || (b.grams - a.grams);
    });
    return list;
  }

  // ---- 4) Výměna jedné položky za jinou ze stejné kategorie (~stejné kcal) ----
  // Vhodnost pro snídani/svačinu se drží podle názvu jídla; seed cykluje nabídku,
  // takže opakované kliknutí projde postupně všechny kandidáty. Mutuje plán a vrací ho.
  /**
   * Vhodnostní regex pro danou kategorii podle TYPU jídla.
   * ⛔ Bere `kind`, ne název. Do 2. 9. 2026 se typ hádal z názvu (podřetězce „sníd"
   * a „svačin"), takže „Snídaně před prací" vyšla náhodou a „Večeře po tréninku" se
   * chovala jako hlavní jídlo jen shodou okolností. ⛔ Táž funkce je v appce.
   */
  function preferForMeal(cat, kind, sladke) {
    if (sladke === undefined) sladke = true;
    var isB = kind === 'breakfast';
    var isS = (kind === 'snack' || kind === 'late');
    if (cat === 'protein') return isB ? BREAKFAST_PROT : (isS ? SNACK_PROT : null);
    // ⛔ [oprava po revizi 2026-09-03] SVAČINA MÁ PEČIVO, NE VAŘENOU PŘÍLOHU, a slané
    // jídlo nesmí dostat vločky ani müsli. Dřív tu pro svačinu stálo MAIN_CARB, takže
    // optimalizace vlákniny vyměnila kaiserku ve svačině (šunka od kosti + kaiserka)
    // za bulgur; změřeno na 1152 dnech s cílem vlákniny 38 takových svačin.
    if (cat === 'carb') return (isB || isS) ? (sladke ? BREAKFAST_CARB : PECIVO_RE) : MAIN_CARB;
    return null;
  }

  // [R2] Sladké, nebo slané jídlo? Bere se z PRVNÍHO bílkovinného zdroje v jídle.
  // ⛔ Jediná definice pro všechna místa (skládání dne, doplňky, přerozdělení, záměny).
  function jeSladkeJidlo(meal) {
    var z = meal.items.filter(function (it) { return it.food.cat === 'protein' || it.food.cat === 'dairy'; })[0];
    if (z) return jeSladkyZaklad(z.food);
    var k = meal.kind || typZNazvu(meal.name || '');
    return k === 'breakfast' || k === 'snack' || k === 'late';
  }

  // Vařená příloha: sacharidový zdroj, který není pečivo, vločky ani müsli.
  function jeVarenaPriloha(f) {
    return f.cat === 'carb' && !PECIVO_VLOCKY_RE.test(f.id);
  }
  /**
   * Záchranná síť pro dny sestavené STARŠÍ verzí enginu (uložený plán), které pole
   * `kind` ještě nemají. Nová cesta ho má vždy z assembleDay.
   * ⛔ Nepoužívat pro nová jídla: přesně tohle hádání se nahrazuje.
   */
  function typZNazvu(mealName) {
    var n = String(mealName || '').toLowerCase();
    if (n.indexOf('sníd') !== -1 || n.indexOf('snid') !== -1) return 'breakfast';
    if (n.indexOf('svačin') !== -1 || n.indexOf('svacin') !== -1) return 'snack';
    return 'lunch';
  }
  function swapItem(day, mealIndex, itemIndex, opts) {
    opts = opts || {};
    var meal = day.meals[mealIndex]; if (!meal) return day;
    var item = meal.items[itemIndex]; if (!item) return day;
    var db = filterDb(opts.db, opts.prefs);
    var cat = item.food.cat;
    var catAll = db.filter(function (f) { return f.cat === cat; });
    if (!catAll.filter(function (f) { return f.id !== item.food.id; }).length) return day;
    var list = catAll;
    var prefer = preferForMeal(cat, meal.kind || typZNazvu(meal.name), jeSladkeJidlo(meal));
    if (prefer) {
      var sub = catAll.filter(function (f) { return prefer.test(f.id); });
      if (sub.filter(function (f) { return f.id !== item.food.id; }).length) list = sub;
    }
    var seed = opts.seed || 0;
    // [fix 2026-08-05] Běžné potraviny (flag `bezny`) jdou v nabídce záměn PRVNÍ, exotika
    // až za nimi. Klikání ⇄ tak nejdřív projde tvaroh/kuřecí/rýži a teprve pak durian —
    // dřív záměny exotiku naopak přilévaly (změřil Grok na Academy 5. 8. 2026).
    // Pořadí je deterministické, každá potravina zůstává dosažitelná.
    list = list.filter(function (f) { return f.bezny; }).concat(list.filter(function (f) { return !f.bezny; }));
    var idx = ((seed % list.length) + list.length) % list.length;
    var next = list[idx];
    if (next.id === item.food.id) next = list[(idx + 1) % list.length];
    var curKcal = macrosFor(item.food, item.grams).kcal;
    var grams = next.per100.kcal ? (curKcal / next.per100.kcal) * 100 : item.grams;
    var step = (next.cat === 'fat' && grams < 40) ? 1 : 5;
    grams = Math.max(step, Math.round(grams / step) * step);
    item.food = next; item.grams = grams;
    // přepočet totálů jídla i dne
    day.meals.forEach(function (m) {
      m.totals = m.items.reduce(function (s, it) {
        var mm = macrosFor(it.food, it.grams);
        s.kcal += mm.kcal; s.p += mm.p; s.c += mm.c; s.f += mm.f; s.fib += mm.fib; return s;
      }, { kcal:0, p:0, c:0, f:0, fib:0 });
    });
    day.totals = day.meals.reduce(function (s, m) {
      s.kcal += m.totals.kcal; s.p += m.totals.p; s.c += m.totals.c; s.f += m.totals.f; s.fib += m.totals.fib; return s;
    }, { kcal:0, p:0, c:0, f:0, fib:0 });
    return day;
  }

  // ---- 5) Tréninkový vs netréninkový den ----
  /**
   * Kalorická podlaha pro NEZNÁMÉ pohlaví, tedy výchozí hodnota pro `cileTreninkVolno`.
   * ⛔⛔ ZDROJ PRAVDY je `kcalFloorForSex` v appce (`src/engine/goals.ts`): žena 1200,
   * muž i „other" 1500, bez pohlaví 1200. Sem se neimportuje (tenhle soubor je čistá
   * IIFE bez závislostí), takže se podlaha PŘEDÁVÁ třetím parametrem. Kdo zná pohlaví
   * klienta, musí ho poslat, jinak platí opatrných 1200.
   * ⚠️ `computeTargets` výš vlastní kalorickou podlahu NEMÁ, takže tohle je jediné místo,
   * kde na webu podlaha vzniká.
   * ⛔ Táž konstanta i tentýž default jsou v appce, hlídá parita.
   */
  var KCAL_PODLAHA_NEZNAME = 1200;
  /**
   * [2026-09-02] Z jednoho denního cíle a počtu tréninků v týdnu udělá DVA cíle.
   * Týdenní součet kalorií zůstává stejný, přesouvají se jen mezi dny.
   *
   * Proč takhle a ne přes `assembleDay(opts.dayType)`: engine nemá vědět, jestli dnes
   * klient cvičí. Když to udělá čistá funkce nad cíli, dá se výsledek ukázat člověku
   * PŘED skládáním dne (v adminu i v appce), zkontrolovat a případně ručně přepsat.
   * Generátor se nemění vůbec, jen dostane jiný cíl.
   *
   * ⭐ Přesouvají se SACHARIDY. Bílkovina je podlaha (drží svalovou hmotu bez ohledu
   * na trénink) a tuk drží hormonální funkci, takže obojí zůstává na obou dnech stejné.
   * ⛔ Přesun je omezený z OBOU stran: tréninkový den nejvýš +10 %, volný nejvýš −10 %.
   * Při šesti trénincích týdně vyjde bonus malý (volných dnů je málo, na kolika se dá
   * ušetřit), a to je správně: víc by znamenalo hladovět ve volnu.
   * Vláknina i další doprovodná pole cíle se přenášejí beze změny.
   * `treninkuTydne` mimo 1 až 6 vrací dvakrát původní cíl.
   * ⛔ Táž funkce je v appce (`src/engine/meal-gen-core.ts`), hlídá parita-jidelnicku.mjs.
   */
  function cileTreninkVolno(t, treninkuTydne, kcalPodlaha) {
    var d = Math.round(treninkuTydne);
    if (kcalPodlaha == null) kcalPodlaha = KCAL_PODLAHA_NEZNAME;
    var kopie = function () {
      var o = {};
      for (var k in t) o[k] = t[k];
      return o;
    };
    // Rozdíl jde do SACHARIDŮ. Když narazí na podlahu 40 g, zbytek jde do tuku,
    // a co se nevejde ani tam, se z kalorií prostě neodečte.
    // ⛔ [oprava po revizi 2026-09-02] Bez tohohle dopočtu vracela funkce vnitřně
    // nekonzistentní cíl: `carbs` se zastavily na 40 g, ale `kcal` klesaly dál
    // (naměřeno na 1400 kcal / 45 g sach.: carbs 40 a kcal 1295 vs. 1260). Engine pak
    // skládá den na kalorie, které z maker nevycházejí. Kalorie se proto dopočítají
    // ze SKUTEČNĚ provedeného posunu.
    var sPosunem = function (rozdilKcal) {
      var carbs = Math.max(40, Math.round(t.carbs + rozdilKcal / 4));
      var zbytek = rozdilKcal - (carbs - t.carbs) * 4;
      var fat = Math.abs(zbytek) < 1 ? t.fat : Math.max(20, Math.round(t.fat + zbytek / 9));
      var aplikovano = (carbs - t.carbs) * 4 + (fat - t.fat) * 9;
      var o = kopie();
      o.kcal = Math.round(t.kcal + aplikovano);
      o.carbs = carbs;
      o.fat = fat;
      return o;
    };
    // ⛔ [oprava po revizi 2026-09-02] Posun kalorií nesmí protlačit volný den pod
    // kalorickou podlahu. Omezení bylo jen relativní (±10 %), takže cíl 1200 kcal
    // se 6 tréninky dal volný den 1080 kcal a cíl 1300 dal 1170. Podlaha se řeší
    // ZMENŠENÍM PŘESUNU, ne dodatečným zvednutím volného dne: kdyby se volný den
    // zvedl až potom, přestal by týdenní součet sedět a klient by týdně jedl víc,
    // než mu engine spočítal.
    var posunMax = Math.max(0, (t.kcal - kcalPodlaha) * (7 - d));
    if (!(d >= 1 && d <= 6) || posunMax <= 0) return { training: kopie(), rest: kopie() };
    // X = kolik kalorií se za týden přesune z volných dnů do tréninkových.
    var x = Math.min(t.kcal * 0.1 * d, t.kcal * 0.1 * (7 - d), posunMax);
    var naTrenink = Math.round(x / d);
    var zVolna = Math.round(x / (7 - d));
    return { training: sPosunem(naTrenink), rest: sPosunem(-zVolna) };
  }

  // ---- 6) Nouzový den na cesty (bez vaření) ----
  /**
   * ⛔⛔ DATABÁZE NEMÁ TAG „hotovka / bez vaření". Osy jsou dnes jen `zivocisne`,
   * `laktoza` a `lepek`, a tagy si tu nikdo nevymýšlí (data se nemění podle odhadu).
   * Než tag vznikne, stojí nouzový den na TOMHLE VÝČTU ID, který je ručně sepsaný
   * a dá se přečíst očima. Je to podlaha, ne záruka:
   *  - výčet je záměrně krátký (běžné věci z pultu a z regálu, ne úplnost),
   *  - co v databázi není, se tiše přeskočí,
   *  - `assembleDay` dostane tenhle výčet jako svou databázi, takže do dne nemůže
   *    padnout nic mimo něj.
   * ⇒ Až tag v databázi bude, seznam se nahradí filtrem a nic dalšího se nemění.
   * ⛔ Stejný výčet je v appce (`src/engine/meal-gen-core.ts`), hlídá parita.
   */
  var BEZ_VARENI_ID = [
    // bílkovina z pultu a z konzervy
    'sunka-veprova-nejvyssi-jakost', 'sunka-od-kosti', 'sunka-kureci-libova', 'kruti-sunka',
    'dusena-sunka-vyberova', 'tunak-vlastni-stava', 'tunak-v-oleji-konzerva', 'sardinky',
    'sardinky-v-tomate', 'losos-uzeny', 'makrela-uzena', 'pstruh-uzeny', 'zavinac',
    'tvaroh-mekky', 'tvaroh-tvrdy', 'skyr', 'syrovatkovy-protein',
    // ⛔ [oprava po revizi 2026-09-02] ROSTLINNÁ BÍLKOVINA. Bez ní dostal vegan den
    // s 55 až 70 g bílkovin proti cíli 150 (revize naměřila −80 až −96 g), a kalorie
    // přitom seděly, takže kontrolní pruh postavený na kaloriích by ukázal zelenou.
    // Příčina: `assembleDay` bere bílkovinu jen z kategorií `protein` a `dairy`, takže
    // hummus a luštěniny z konzervy (kategorie `legume`) na základ jídla nikdy nesáhly.
    // Tyhle tři v kategorii `protein` jsou, jsou vegan a v obchodě se prodávají hotové.
    'tofu', 'tempeh', 'seitan',
    'sojovy-jogurt-bily',
    // mléčné
    'cottage-syr', 'cottage-syr-light', 'eidam-30', 'gouda', 'mozzarella', 'mozzarella-light',
    'recky-jogurt-bily', 'recky-jogurt-0', 'bily-jogurt', 'bily-jogurt-nizkotucny',
    'kefir', 'proteinovy-jogurt', 'tvaroh-mekky-nizkotucny',
    // pečivo a suché přílohy
    'knackebrot', 'celozrnne-krekry', 'chleb-zitny-tmavy', 'chleb-celozrnny', 'chleb-kvaskovy',
    'toustovy-chleb-celozrnny', 'rohlik', 'houska-celozrnna', 'kaiserka', 'pita-chleb',
    'tortilla-psenicna', 'musli-bez-cukru', 'granola-bez-pridaneho-cukru', 'ovesne-vlocky',
    // ⛔ [oprava po revizi 2026-09-02] BEZLEPKOVÁ PŘÍLOHA. Ze čtrnácti příloh výše obsahuje
    // lepek třináct a u ovesných vloček za něj neručíme, takže celiakovi po filtru nezbyla
    // v kategorii `carb` ANI JEDNA položka: revize naměřila den až 27 % mimo kalorie
    // (chybělo 540 kcal z 2000) a pod cílem vlákniny, a engine mlčel.
    // Kukuřice z konzervy je jediná bezlepková příloha, která je zároveň `bezny`, takže
    // ji `pick` vybere; bezlepkové pečivo `bezny` není a slouží jako záložní nabídka
    // (a jako kandidát záměn), ⛔ `bezny` se kvůli tomu v datech nepřepisuje.
    'kukurice', 'bezlepkovy-chleb-2', 'bezlepkovy-chleb-toustovy', 'bezlepkovy-knackebrot',
    'bezlepkova-tortilla',
    // luštěniny z konzervy a tofu (kategorie `legume`)
    // ⚠️ `assembleDay` kategorii `legume` sám nevybírá, tyhle položky se tedy do dne
    // dostanou jen záměnou. V seznamu jsou proto, že bez vaření prokazatelně jsou,
    // a aby seznam dával smysl člověku, který ho čte.
    'cizrna-v-konzerve', 'fazole-bila-v-konzerve', 'hrasek-zeleny-konzerva', 'hummus',
    'tofu-uzene', 'tofu-marinovane',
    // zelenina, kterou stačí opláchnout
    'rajce', 'cherry-rajcata', 'okurka', 'mrkev', 'paprika-cervena', 'paprika-zelena',
    'ledovy-salat', 'rukola', 'redkvicka', 'kysela-okurka-nakladana', 'polnicek',
    // ovoce
    'banan', 'jablko', 'hruska', 'mandarinka', 'pomeranc', 'kiwi', 'hroznove-vino',
    'boruvky', 'jahody', 'maliny', 'broskev', 'nektarinka', 'svestky',
    'rozinky', 'susene-merunky', 'susene-svestky', 'datle-susene',
    // tuky a svačiny
    'mandle', 'vlasske-orechy', 'kesu', 'arasidy', 'liskove-orechy', 'araside-maslo',
    'mandlove-maslo', 'avokado', 'olivovy-olej', 'dynova-seminka', 'slunecnicova-seminka',
    'ryzove-chlebicky', 'horka-cokolada-70'
  ];

  /**
   * Nouzový den ze tří jídel, u kterých se nevaří (cesty, nemoc, den bez kuchyně).
   * Skládá ho běžný `assembleDay`, jen s databází zúženou na `BEZ_VARENI_ID`, takže
   * platí všechna pravidla enginu včetně dietních filtrů a cíle vlákniny.
   * ⚠️ Zúžená nabídka trefuje makra hůř než plná; kontrolní pruh musí čísla ukázat.
   */
  function nouzovyDen(targets, opts) {
    opts = opts || {};
    var plna = opts.db || [];
    var povolene = {};
    BEZ_VARENI_ID.forEach(function (id) { povolene[id] = 1; });
    var uzka = plna.filter(function (f) { return povolene[f.id]; });
    if (!uzka.length) {
      throw new Error('meal-gen: nouzový den nemá z čeho skládat, v databázi není ani jedna položka ze seznamu BEZ_VARENI_ID.');
    }
    var den = assembleDay(targets, { meals: 3, prefs: opts.prefs, seed: opts.seed,
      mealNames: opts.mealNames, db: uzka });
    den.warnings = nouzoveVarovani(den, targets, uzka, opts.prefs);
    return den;
  }

  /**
   * ⛔⛔ [oprava po revizi 2026-09-02] NOUZOVÝ DEN MUSÍ UMĚT ŘÍCT, ŽE SE NEPOVEDL.
   *
   * Zúžená nabídka se s dietním filtrem umí složit tak, že den mine cíl o stovky kalorií
   * nebo o desítky gramů bílkovin, a engine přitom nespadne: `assembleDay` vždycky nějaký
   * den vrátí. Naměřeno revizí před opravou seznamu: celiak −27 % kalorií, vegan −96 g
   * bílkovin (a u vegana kalorie SEDĚLY, takže kontrola postavená na kaloriích mlčela).
   *
   * ⛔ Kontrolní pruh v adminu tohle pole MUSÍ zobrazit; kdo nouzový den někam pustí bez
   * zobrazení varování, vyrobí přesně ten tichý druh chyby, kvůli kterému funkce vznikla.
   * ⛔ Táž kontrola i táž znění vět jsou v appce, hlídá parita-jidelnicku.mjs.
   */
  function nouzoveVarovani(den, targets, uzka, prefs) {
    var varovani = [];
    // 1) Zbyla po dietním filtru vůbec příloha a zdroj bílkovin? Tohle je příčina,
    //    zbytek jsou její následky, a člověk potřebuje slyšet příčinu.
    var poFiltru = filterDb(uzka, prefs);
    var maPrilohu = poFiltru.some(function (f) { return f.cat === 'carb'; });
    var maBilkovinu = poFiltru.some(function (f) { return f.cat === 'protein' || f.cat === 'dairy'; });
    if (!maPrilohu) {
      varovani.push('Nouzový den nemá k dispozici žádnou přílohu bez vaření, která by prošla dietním filtrem. Doplň ji ručně.');
    }
    if (!maBilkovinu) {
      varovani.push('Nouzový den nemá k dispozici žádný zdroj bílkovin bez vaření, který by prošel dietním filtrem. Doplň ho ručně.');
    }
    // 2) Kalorie: pásmo ±10 %. Širší než u běžného dne schválně, protože nabídka je zúžená.
    var rozdilKcal = den.totals.kcal - targets.kcal;
    if (Math.abs(rozdilKcal) > targets.kcal * 0.1) {
      varovani.push('Nouzový den mine kalorický cíl o ' + Math.round(rozdilKcal) + ' kcal ('
        + Math.round(den.totals.kcal) + ' místo ' + Math.round(targets.kcal)
        + '). Nabídka bez vaření na tenhle cíl nestačí.');
    }
    // 3) Bílkovina: podlaha 80 % cíle. Jen dolů; víc bílkovin problém není.
    if (targets.protein > 0 && den.totals.p < targets.protein * 0.8) {
      varovani.push('Nouzový den má jen ' + Math.round(den.totals.p) + ' g bílkovin proti cíli '
        + Math.round(targets.protein) + ' g. Přidej bílkovinu ručně, tenhle den se na cíl nesloží.');
    }
    return varovani.length ? varovani : undefined;
  }

  global.MealGen = { computeTargets: computeTargets, ketoTargets: ketoTargets, assembleDay: assembleDay,
    assembleWeek: assembleWeek, shoppingListFromDays: shoppingListFromDays, swapItem: swapItem,
    macrosFor: macrosFor, cileTreninkVolno: cileTreninkVolno, nouzovyDen: nouzovyDen,
    typyJidel: typyJidel, BEZ_VARENI_ID: BEZ_VARENI_ID,
    KCAL_PODLAHA_NEZNAME: KCAL_PODLAHA_NEZNAME, GOAL: GOAL, ACT: ACT,
    FIBER_FLOOR_G: FIBER_FLOOR_G, FIBER_CAP_G: FIBER_CAP_G };
})(window);
