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
    // Cílová vláknina: 14 g / 1000 kcal (US Dietary Guidelines), min. 25 g pro dospělého.
    // ⛔ [2026-09-02] Strop 60 g doplněn: generátor níž vlákninu nad `FIBER_CAP_G` nepustí,
    // takže bez tohohle clampu by kalkulačka u velmi vysokých cílů (nad 4 300 kcal) slíbila
    // číslo, které jídelníček vědomě nesplní. ⚠️ Podlaha 25 g je dál JEN na webu, appka ji
    // nemá (`goals.ts` počítá `min(60, kcal/1000*14)` bez podlahy). Sjednotit ji je
    // odborné rozhodnutí pro Martina, ne úklid, tak se tu nemění.
    var fiber = Math.min(FIBER_CAP_G, Math.max(25, Math.round(kcal / 1000 * 14)));
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
  var NENI_ZAKLAD_JIDLA = /syrovatkovy-protein|sojovy-protein-izolat|^bilek$/;
  // [fix 2026-08-06] Šunka a spol. NEJSOU hlavní bílkovina oběda/večeře: uzenina je na
  // chleba a do svačiny, na hlavní jídlo lidi vaří maso/rybu. U hlavních jídel se masné
  // výrobky řadí AŽ ZA vařené zdroje (měkce, s fallbackem). Uzené RYBY zůstávají.
  // Snídaně/svačiny mají šunku dál v preferencích. ⛔ Táž logika v appce, hlídá parita.
  var UZENINA_RE = /sunka|salam|klobas|parky|slanina|debrecin|kabanos|mortadela/;
  // [fix 2026-08-06 kolo 3] Uzenina má strop 80 g NA TALÍŘI. 160 g šunky jako jediný
  // základ snídaně nikdo nejí; snídaňová uzenina se ořeže na 80 g a zbytek bílkovin
  // doplní DRUHÝ zdroj (vejce/tvaroh/skyr/cottage). ⛔ Táž logika v appce, hlídá parita.
  var UZENINA_MAX_G = 80;
  var SNIDANE_DOPLNEK_PROT = /vejce|tvaroh|skyr|cottage/;
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
  // Kolik smí být vlákniny nad cílem, než se to začne řešit (cíl je podlaha, mírný
  // přebytek je v pořádku a nemá cenu kvůli němu měnit potraviny).
  var FIBER_PASMO_NAD_CILEM = 1.1;
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
    function nebylNedavno(list) {
      if (!nedavnoPocet) return list;
      var cerstve = list.filter(function (f) { return !nedavno[f.id]; });
      return cerstve.length ? cerstve : list;
    }
    function jesteNebyl(list) {
      var cerstve = list.filter(function (f) { return !pouziteProt[f.id]; });
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
      // U hlavních jídel (bez snídaňové/svačinové preference) vyřaď prášky a bílek
      // ze základu jídla; fallback na plnou nabídku drží průchodnost úzkých filtrů.
      function bezPrasku(list) {
        if (prefer) return list;
        var poctive = list.filter(function (f) { return !NENI_ZAKLAD_JIDLA.test(f.id); });
        return poctive.length ? poctive : list;
      }
      // Uzeniny až za vařené zdroje (viz UZENINA_RE výš); měkké pravidlo s fallbackem.
      function uzeninaAzNakonec(list) {
        if (prefer) return list;
        var varene = list.filter(function (f) { return !UZENINA_RE.test(f.id); });
        return varene.length ? varene : list;
      }
      if (leanOnly) {
        var leanDb = sedneNaPorci(uzeninaAzNakonec(bezPrasku(nebylNedavno(jesteNebyl(db.filter(function (f) { return (f.cat !== 'protein' && f.cat !== 'dairy') || isLean(f); }))))));
        var p = pick(leanDb, 'protein', s, prefer) || pick(leanDb, 'dairy', s, prefer);
        if (p) return p;
      }
      var cely = sedneNaPorci(uzeninaAzNakonec(bezPrasku(nebylNedavno(jesteNebyl(db)))));
      return pick(cely, 'protein', s, prefer) || pick(cely, 'dairy', s, prefer);
    }
    var gramyDnes = {};
    var DENNI_STROP_G = 400;
    // [fix 2026-07-22] totéž pro přílohy: velká DB má i tučné sacharidové zdroje (opékané
    // brambory, plněné těstoviny, saláty s majonézou). Při napjatém tukovém rozpočtu ber
    // přílohy do 4 g tuku/100 g (rýže, brambory, těstoviny…); jinak by skrytý tuk přetekl.
    function pickCarb(s, prefer) {
      if (leanOnly) {
        var leanDb = db.filter(function (f) { return f.cat !== 'carb' || f.per100.f <= 4; });
        var c = pick(leanDb, 'carb', s, prefer);
        if (c) return c;
      }
      return pick(db, 'carb', s, prefer);
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
            var druhy = pickProt(seed + i + 11, SNIDANE_DOPLNEK_PROT);
            if (druhy && !UZENINA_RE.test(druhy.id)) {
              var dg = round((chybiP / (druhy.per100.p || 1)) * 100, 10);
              dg = Math.min(Math.max(dg, 30), druhy.cat === 'protein' ? 260 : 300);
              gramyDnes[druhy.id] = (gramyDnes[druhy.id] || 0) + dg;
              pouziteProt[druhy.id] = true;
              items.push({ food: druhy, grams: dg });
            }
          }
        }
      }
      // 2) sacharidová příloha (ne u svačin)
      // Snídaně nikdy není svačina, takže stará podmínka `!isSnack || i === 0`
      // je po zavedení typů jídel prostě `!isSnack`. Chování se nemění.
      if (!isSnack) {
        var carb = (kind === 'breakfast') ? (pickCarb(seed + i + 7, BREAKFAST_CARB)) : pickCarb(seed + i + 3, MAIN_CARB);
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
          if (!lowCarb) cg = Math.max(cg, podlahaPrilohy(carb));
          if (cg > 10) items.push({ food: carb, grams: Math.min(cg, 320) });
        }
      }
      // 3) zelenina pro objem (u hlavních jídel)
      // [fix 2026-07-22] aromatická zelenina (cibule, česnek, chilli, bylinky…) není samostatná
      // příloha — 150 g cibule k večeři je nesmysl. Do dochucení patří, na talíř jako zelenina ne.
      // ⛔ [oprava po revizi 2026-09-02] Podmínka je TYP jídla, ne podíl kalorií (viz výš).
      if (!isSnack) {
        // [fix 2026-08-06 kolo 3] V keto režimu jen nízkosacharidová zelenina. Táž logika v appce.
        var sideVegDb = db.filter(function (f) {
          return f.cat !== 'veg' || (!/cibul|cesnek|chilli|zazvor|kren|bylink|petrzel|koriandr|kopr|pazitk|medvedi/.test(f.id) && (!lowCarb || f.per100.c <= 5));
        });
        // [fix 2026-08-05 večer] Snídaňová zelenina bez špenátu: 150 g syrových listů
        // k toustu nikdo nejí. K vaječné snídani patří rajče, okurka, paprika.
        var veg = pick(sideVegDb, 'veg', seed + i + 5, (kind === 'breakfast') ? /rajce|okurka|paprika/ : null);
        if (veg) items.push({ food: veg, grams: vg(150) });
      }
      // 4) ovoce u snídaně/svačin
      if (kind === 'breakfast' || isSnack) {
        // V keto režimu z ovoce jen bobule a menší porce; jiné ovoce nese moc sacharidů.
        var fruit = pick(db, 'fruit', seed + i + 2, lowCarb ? /malin|boruvk|jahod|ostruzin|rybiz/ : null);
        if (fruit) {
          var fg0 = vg(lowCarb ? 80 : (fruit.portion || 120));
          // [fix 2026-08-06 kolo 4] Ve svačině se porce ovoce dopočítá na kalorie svačiny
          // (pevná porce nechávala svačinu na mediánu 72 % jejího cíle). Jen ZVĚTŠUJEME.
          if (isSnack && !lowCarb && fruit.per100.kcal > 0) {
            var uzKcal = items.reduce(function (s, it) { return s + macrosFor(it.food, it.grams).kcal; }, 0);
            var zbyva = (targets.kcal * dist[i]) - uzKcal - (mFat * 9 * 0.3);
            if (zbyva > 0) fg0 = Math.min(Math.max(fg0, (zbyva / fruit.per100.kcal) * 100), fg0 * 2, 250);
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
          fg = Math.min(Math.max(fg, 5), 30);
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
    function capPass() {
      all.forEach(function (it) {
        var cap = FOOD_CAP[it.food.id] || CAP[it.food.cat]; if (cap && it.grams > cap) it.grams = cap;
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
      if (!swapCand.length) break;
      swapCand.sort(function (a, b) { return fatRatio(a) - fatRatio(b) || (a.id < b.id ? -1 : 1); });
      var lean = swapCand[(seed + sw) % Math.min(3, swapCand.length)]; // rotace mezi 3 nejlibovějšími = pestrost
      var keepP = macrosFor(worst.food, worst.grams).p;
      worst.food = lean;
      worst.grams = Math.max(30, (keepP / (lean.per100.p || 1)) * 100);
      runScale();
    }

    // [fix 2026-07-14] Velké cíle (např. 230 g bílkovin / 3 000+ kcal ve 3 jídlech) se přes
    // stropy porcí nevejdou → den podstřeloval i o 20 %. Doplníme reálné doplňky (shake
    // k hlavnímu jídlu, vločky a banán k snídani, hrst mandlí) a znormalizujeme znovu —
    // přesně tohle by velkému klientovi poradil kouč.
    function byId(id) { return db.filter(function (f) { return f.id === id; })[0] || null; }
    function addExtra(food, grams, mealIdx) {
      if (!food) return false;
      if (all.some(function (it) { return it.food.id === food.id; })) return false;
      var it = { food: food, grams: grams };
      out[Math.min(mealIdx, out.length - 1)].items.push(it);
      all.push(it);
      return true;
    }
    if (totalKey('kcal') < targets.kcal * 0.94) {
      var mainIdx = out.length >= 3 ? Math.floor(out.length / 2) : 0; // oběd / prostřední jídlo
      // Gramáže doplňků úměrně velikosti dne (velikostDne/vg deklarované u MIN_PRILOHA_G).
      addExtra(byId('syrovatkovy-protein'), vg(30), mainIdx);
      addExtra(byId('ovesne-vlocky'), vg(50), 0);
      runScale();
      if (totalKey('kcal') < targets.kcal * 0.94 || totalKey('p') < targets.protein * 0.88) {
        // druhý zdroj bílkovin k večeři (bez shaku: tvaroh; bez mléčných: tuňák; vege: tofu/tempeh)
        var protPool = ['tvaroh-mekky', 'tunak-vlastni-stava', 'tofu', 'tempeh', 'vejce'];
        for (var pi = 0; pi < protPool.length; pi++) {
          if (addExtra(byId(protPool[pi]), vg(150), out.length - 1)) break;
        }
        addExtra(byId('mandle'), vg(25), out.length - 1);
        addExtra(byId('banan'), vg(100), 0);
        runScale();
        if (totalKey('kcal') < targets.kcal * 0.94) {
          var carbPool = ['ryze-natural-varena', 'brambory-varene', 'testoviny-celozrnne-varene', 'bulgur-vareny'];
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
      var cap = FOOD_CAP[it.food.id] || CAP[it.food.cat]; if (cap && it.grams > cap) it.grams = cap;
    });
    // Součet tří ifFits zdvihů umí přelézt +5 % o zaokrouhlení. Mikro-ořez jen
    // sacharidů, nejdřív k 15 g (viditelná porce), pak k 10 g. Velký den sem
    // nespadne: po trimu je pod +5 % a větev se nespustí.
    if (!lowCarb && totalKey('kcal') > targets.kcal * 1.05) {
      var orezK = function (minG) {
        for (var oi = 0; oi < all.length; oi++) {
          var it = all[oi];
          if (it.food.cat !== 'carb' || it.grams <= minG) continue;
          var over = totalKey('kcal') - targets.kcal * 1.05;
          if (over <= 0) break;
          var kcalPerG = (it.food.per100.kcal || 0) / 100;
          if (kcalPerG <= 0) continue;
          it.grams -= Math.min(it.grams - minG, over / kcalPerG);
        }
      };
      orezK(15);
      if (totalKey('kcal') > targets.kcal * 1.05) orezK(10);
    }
    // [fix 2026-07-14] minigramáže („přidej 1 g oleje") v klientském plánu nemají co dělat —
    // nebílkovinné položky pod 8 g vyhodíme (pár kalorií totály poctivě ukážou);
    // bílkovinné zdroje drží podlahu 30 g z runScale, ty nemažeme.
    out.forEach(function (m) {
      m.items = m.items.filter(function (it) { return it.food.cat === 'protein' || it.grams >= 8; });
    });

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
          var cap = FOOD_CAP[it.food.id] != null ? FOOD_CAP[it.food.id] : CAP[it.food.cat];
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
      if (chybiKcal() > targets.kcal * 0.05 && !maPrilohu) {
        for (var pi = 0; pi < PRILOHY.length; pi++) {
          var f = byId(PRILOHY[pi]);
          if (!f) continue;
          if (all.some(function (it) { return it.food.id === f.id; })) continue;
          var naGramP = f.per100.kcal / 100;
          if (naGramP <= 0) continue;
          var capP = FOOD_CAP[f.id] != null ? FOOD_CAP[f.id] : CAP[f.cat];
          var g = Math.min(capP != null ? capP : Infinity, Math.ceil(chybiKcal() / naGramP / 5) * 5);
          if (g >= 8) {
            var novaPolozka = { food: f, grams: g };
            out[out.length - 1].items.push(novaPolozka);
            all.push(novaPolozka);
          }
          break;
        }
      }
      // 3) Teprve zbytek dolaď na ovoci, a jen MÍRNĚ (nejvýš o polovinu původní porce),
      //    ať nevznikne miska ovoce místo jídla.
      out.forEach(function (m) {
        m.items.forEach(function (it) {
          if (it.food.cat !== 'fruit') return;
          var chybi = chybiKcal();
          if (chybi <= targets.kcal * 0.05) return;
          var cap = FOOD_CAP[it.food.id] != null ? FOOD_CAP[it.food.id] : CAP[it.food.cat];
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
      var hornihranice = Math.min(cilVlakniny * FIBER_PASMO_NAD_CILEM, FIBER_CAP_G);
      /** Jak daleko je den od povoleného pásma. Nula = v pásmu, jinak vzdálenost v gramech. */
      var mimoPasmo = function (fib) {
        if (fib < cilVlakniny) return cilVlakniny - fib;
        if (fib > hornihranice) return fib - hornihranice;
        return 0;
      };
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
      var bilkovinaPodlahaVl = Math.min(bilkovinaPredVl, targets.protein);
      var bilkovinaOkVl = function () { return den('p') >= bilkovinaPodlahaVl - 0.5; };
      // ⛔ Hlídat se musí i TUK, protože průchod nově sahá i na kategorii `fat`. Výměna
      // „chia semínka za olivový olej" drží kalorie, ale přesouvá je do čistého tuku.
      var tukPredVl = den('f');
      var tukPasmoVl = Math.max(targets.fat * 0.15, Math.abs(tukPredVl - targets.fat));
      var tukOkVl = function () { return Math.abs(den('f') - targets.fat) <= tukPasmoVl + 0.5; };
      // Gramů vlákniny na 1 kcal: chceme víc vlákniny za tytéž kalorie, ne víc jídla.
      var hustotaVl = function (f) { return (f.per100.fib || 0) / Math.max(1, f.per100.kcal || 0); };
      var stropPolozky = function (f) {
        var c = FOOD_CAP[f.id] != null ? FOOD_CAP[f.id] : CAP[f.cat];
        return c != null ? c : 400;
      };

      // M1: záměna za vlákninatější položku téže kategorie při stejných kaloriích.
      // ⚠️ Zamítnutá záměna NESMÍ ukončit celý průchod. Nejvlákninatější kandidát bývá
      // zároveň ten, který nejvíc rozhodí kalorie nebo bílkovinu; když se po jeho vrácení
      // skončí, průchod na spoustě dnů neudělá vůbec nic (změřeno: 15 dnů ze 400 mělo
      // vlákninu beze změny, přestože v nabídce lepší položky byly). Proto se zamítnutá
      // potravina jen odloží a zkusí se další v pořadí.
      var zamitnute = {};
      // ⚠️ 60 kol, ne 12: jedno kolo spotřebuje i tah, který se VRÁTÍ (typicky výměna
      // celozrnných těstovin za rýži, která by ubrala bílkovinu). Změřeno: při 24 kolech
      // zůstalo 9 dnů z 1440 nad stropem, při 60 ani jeden.
      for (var kolo1 = 0; kolo1 < 60; kolo1++) {
        var fibTed = den('fib');
        var chybaTed = mimoPasmo(fibTed);
        if (chybaTed <= 0.01) break;
        var pouziteVl = {};
        polozky().forEach(function (it) { pouziteVl[it.food.id] = 1; });
        var nej = null;
        for (var mi = 0; mi < out.length; mi++) {
          var mm1 = out[mi];
          for (var ii = 0; ii < mm1.items.length; ii++) {
            var it1 = mm1.items[ii];
            if (VLAK_KAT.indexOf(it1.food.cat) === -1) continue;
            var kcalIt = macrosFor(it1.food, it1.grams).kcal;
            if (kcalIt <= 0) continue;
            var fibIt = macrosFor(it1.food, it1.grams).fib;
            // Příloha musí zůstat vhodná k typu jídla, jinak by k snídani přistála rýže.
            // Tuk se páruje k charakteru jídla stejným pravidlem jako při skládání, jinak
            // by výměna kvůli vláknině přinesla chia do slaného oběda.
            var maOvoceJ = mm1.items.some(function (x) { return x.food.cat === 'fruit'; });
            var maZeleninuJ = mm1.items.some(function (x) { return x.food.cat === 'veg'; });
            var vhodnost = it1.food.cat === 'carb'
              ? preferForMeal('carb', mm1.kind)
              : (it1.food.cat === 'fat'
                ? (maOvoceJ && !maZeleninuJ ? SLADKY_TUK : (maZeleninuJ ? SLANY_TUK : null))
                : null);
            for (var di = 0; di < db.length; di++) {
              var f1 = db[di];
              if (f1.cat !== it1.food.cat || !f1.bezny || pouziteVl[f1.id] || zamitnute[f1.id]) continue;
              if (!(f1.per100.kcal > 0)) continue;
              if (vhodnost && !vhodnost.test(f1.id)) continue;
              var g1 = Math.round((kcalIt / f1.per100.kcal) * 100 / 5) * 5;
              g1 = Math.min(g1, stropPolozky(f1));
              if (g1 < 8) continue;
              // ⛔ Rozhoduje VÝSLEDNÁ vzdálenost dne od pásma, ne zisk vlákniny. Tah, který
              // by cíl přeskočil (nebo den ještě víc přetáhl), tím vypadne sám.
              var novaFib = fibTed - fibIt + macrosFor(f1, g1).fib;
              var chyba = mimoPasmo(novaFib);
              if (chyba >= chybaTed - 0.2) continue;
              if (!nej || chyba < nej.chyba - 1e-9 || (Math.abs(chyba - nej.chyba) <= 1e-9 && f1.id < nej.f.id)) {
                nej = { it: it1, f: f1, g: g1, chyba: chyba };
              }
            }
          }
        }
        if (!nej) break;
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
              kandidati.push({ it: it2, mi: mi2, ii: ii2 });
            }
          });
        });
        if (kandidati.length < 2) break;
        var podleHustoty = kandidati.slice().sort(function (a, b) {
          return (hustotaVl(b.it.food) - hustotaVl(a.it.food)) || (a.mi - b.mi) || (a.ii - b.ii);
        });
        var nejbohatsi = podleHustoty[0].it;
        var nejchudsi = podleHustoty[podleHustoty.length - 1].it;
        if (nejbohatsi === nejchudsi || hustotaVl(nejbohatsi.food) - hustotaVl(nejchudsi.food) < 0.001) break;
        var rust = nahoru ? nejbohatsi : nejchudsi;
        var ubytek = nahoru ? nejchudsi : nejbohatsi;
        var prostor = stropPolozky(rust.food) - rust.grams;
        // Ubírat jde jen do viditelné porce; pod 15 g už to na talíři není porce, ale drobek.
        var lzeUbrat = ubytek.grams - 15;
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

    return { meals: out, totals: dayTot, targets: targets };
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
  function preferForMeal(cat, kind) {
    var isB = kind === 'breakfast';
    var isS = (kind === 'snack' || kind === 'late');
    if (cat === 'protein') return isB ? BREAKFAST_PROT : (isS ? SNACK_PROT : null);
    if (cat === 'carb') return isB ? BREAKFAST_CARB : MAIN_CARB;
    return null;
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
    var prefer = preferForMeal(cat, meal.kind || typZNazvu(meal.name));
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
    KCAL_PODLAHA_NEZNAME: KCAL_PODLAHA_NEZNAME, GOAL: GOAL, ACT: ACT };
})(window);
