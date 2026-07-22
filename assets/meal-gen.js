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
    var kcal = Math.round(tdee * g.kcal);
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
    var fiber = Math.max(25, Math.round(kcal / 1000 * 14));
    return { kcal: kcal, protein: protein, carbs: carbs, fat: fat, fiber: fiber,
             bmr: Math.round(bmr), tdee: Math.round(tdee), goalLabel: g.label };
  }

  // ---- pomocné: makra porce dané potraviny při X gramech ----
  function macrosFor(food, grams) {
    var k = grams / 100;
    return {
      kcal: food.per100.kcal * k, p: food.per100.p * k,
      c: food.per100.c * k, f: food.per100.f * k,
      fib: (food.per100.fib || 0) * k
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

  // filtr DB podle preferencí (vyloučení kategorií/ id)
  function filterDb(db, prefs) {
    prefs = prefs || {};
    var exclCat = prefs.excludeCat || [];     // např. ['dairy']
    var exclId = prefs.excludeId || [];
    return db.filter(function (f) {
      if (exclCat.indexOf(f.cat) !== -1) return false;
      if (exclId.indexOf(f.id) !== -1) return false;
      // [fix 2026-07-22] vegetariána řídí flag nonveg PŘÍMO v DB (klasifikace všech 1182
      // položek vč. světové kuchyně; rostlinné náhražky s masovým názvem flag nemají).
      // Starý id regex zůstává jako záchranná síť pro případné neoflagované budoucí přírůstky.
      if (prefs.vegetarian && (f.nonveg ||
          /kure|krut|hovez|veprov|losos|tunak|treska|sunka|sardin|stehno|mlete|krevet/.test(f.id))) return false;
      if (exclCat.indexOf('dairy') !== -1 && isDairyExtra(f.id)) return false;
      return true;
    });
  }

  // vhodnost potravin do snídaně / svačiny (ať nevyjde kuřecí prsa k snídani)
  var BREAKFAST_PROT = /vejce|bilek|tvaroh|skyr|cottage|syrovatkovy-protein|sunka/;
  var SNACK_PROT     = /tvaroh|skyr|cottage|syrovatkovy-protein|recky-jogurt|bily-jogurt|sunka/;
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
    return list[(seed % list.length + list.length) % list.length];
  }

  // ---- 2) Sestav den ----
  // opts: { meals: 3..5, prefs, seed }
  function assembleDay(targets, opts) {
    opts = opts || {};
    var meals = Math.min(5, Math.max(3, opts.meals || 4));
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
    function pickProt(s, prefer) {
      if (leanOnly) {
        var leanDb = db.filter(function (f) { return (f.cat !== 'protein' && f.cat !== 'dairy') || isLean(f); });
        var p = pick(leanDb, 'protein', s, prefer) || pick(leanDb, 'dairy', s, prefer);
        if (p) return p;
      }
      return pick(db, 'protein', s, prefer) || pick(db, 'dairy', s, prefer);
    }
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

    // rozložení kalorií do jídel
    var dist;
    if (meals === 3) dist = [0.30, 0.40, 0.30];
    else if (meals === 4) dist = [0.28, 0.34, 0.13, 0.25]; // svačina = malá (snack), ne druhý oběd
    else dist = [0.22, 0.10, 0.30, 0.10, 0.28];
    var names = meals === 3 ? ['Snídaně','Oběd','Večeře']
            : meals === 4 ? ['Snídaně','Oběd','Svačina','Večeře']
            : ['Snídaně','Dopolední svačina','Oběd','Odpolední svačina','Večeře'];

    var out = [];
    for (var i = 0; i < meals; i++) {
      var mKcal = targets.kcal * dist[i];
      var mProt = targets.protein * dist[i];
      var mFat = targets.fat * dist[i];
      var isSnack = dist[i] < 0.18;
      var items = [];

      // 1) bílkovinný základ — dávkuj na bílkovinný cíl jídla
      // snídaně/svačina dostanou vhodnější zdroj (vejce, tvaroh, skyr…), ne kuřecí prsa
      var protPrefer = (i === 0) ? BREAKFAST_PROT : (isSnack ? SNACK_PROT : null);
      var prot = pickProt(seed + i, protPrefer);
      if (prot) {
        var pg = round((mProt / (prot.per100.p || 1)) * 100, 10);
        pg = Math.min(pg, prot.cat === 'protein' ? 260 : 300);
        items.push({ food: prot, grams: Math.max(30, pg) });
      }
      // 2) sacharidová příloha (ne u poslední menší svačiny)
      if (!isSnack || i === 0) {
        var carb = (i === 0) ? (pickCarb(seed + i + 7, BREAKFAST_CARB)) : pickCarb(seed + i + 3, MAIN_CARB);
        if (carb) {
          // dopočítej gramy sacharidů zbývající po proteinu
          var usedC = items.reduce(function (s, it) { return s + macrosFor(it.food, it.grams).c; }, 0);
          var needC = (targets.carbs * dist[i]) - usedC;
          var cg = round((needC / (carb.per100.c || 1)) * 100, 10);
          if (cg > 10) items.push({ food: carb, grams: Math.min(cg, 320) });
        }
      }
      // 3) zelenina pro objem (u hlavních jídel)
      if (dist[i] >= 0.2) {
        var veg = pick(db, 'veg', seed + i + 5, (i === 0) ? /rajce|okurka|paprika|spenat/ : null);
        if (veg) items.push({ food: veg, grams: 150 });
      }
      // 4) ovoce u snídaně/svačin
      if (i === 0 || isSnack) {
        var fruit = pick(db, 'fruit', seed + i + 2);
        if (fruit) items.push({ food: fruit, grams: fruit.portion || 120 });
      }
      // 5) dorovnání tuků zdrojem tuku
      var usedF = items.reduce(function (s, it) { return s + macrosFor(it.food, it.grams).f; }, 0);
      var needF = mFat - usedF;
      if (needF > 4) {
        var fat = pick(db, 'fat', seed + i + 1);
        if (fat && fat.per100.f) {
          var fg = round((needF / fat.per100.f) * 100, 1);
          fg = Math.min(Math.max(fg, 5), 30);
          items.push({ food: fat, grams: fg });
        }
      }

      out.push({ name: names[i], targetKcal: Math.round(mKcal), items: items });
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
    function capPass() {
      all.forEach(function (it) {
        var cap = CAP[it.food.cat]; if (cap && it.grams > cap) it.grams = cap;
      });
    }
    function runScale() {
      for (var np = 0; np < 3; np++) {
        scaleCat('carb', 'c', targets.carbs, 0.4, 2.6);
        scaleCat('fat', 'f', targets.fat, 0.3, 3.0);
        scaleCat('protein', 'p', targets.protein, 0.35, 2.4);
      }
      capPass(); // [fix 2026-07-14] stropy hned po škálování — jinak kontrola sytosti dne
                 // viděla nadstropové porce a den po ořezu tiše podstřelil i o 20 %
      // bílkovinný základ jídla nesmí zdegenerovat na ozdobu (křížové škálování ho umí
      // stlačit) — drž aspoň 30 g; je to páteř každého jídla v Martinově metodě
      all.forEach(function (it) {
        if (it.food.cat === 'protein' && it.grams < 30) it.grams = 30;
      });
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
      addExtra(byId('syrovatkovy-protein'), 30, mainIdx);
      addExtra(byId('ovesne-vlocky'), 50, 0);
      runScale();
      if (totalKey('kcal') < targets.kcal * 0.94 || totalKey('p') < targets.protein * 0.88) {
        // druhý zdroj bílkovin k večeři (bez shaku: tvaroh; bez mléčných: tuňák; vege: tofu/tempeh)
        var protPool = ['tvaroh-mekky', 'tunak-vlastni-stava', 'tofu', 'tempeh', 'vejce'];
        for (var pi = 0; pi < protPool.length; pi++) {
          if (addExtra(byId(protPool[pi]), 150, out.length - 1)) break;
        }
        addExtra(byId('mandle'), 25, out.length - 1);
        addExtra(byId('banan'), 100, 0);
        runScale();
        if (totalKey('kcal') < targets.kcal * 0.94) {
          var carbPool = ['ryze-natural-varena', 'brambory-varene', 'testoviny-celozrnne-varene', 'bulgur-vareny'];
          for (var ci = 0; ci < carbPool.length; ci++) {
            if (addExtra(byId(carbPool[ci]), 150, out.length - 1)) break;
          }
          var fatPool = ['olivovy-olej', 'repkovy-olej', 'avokado', 'araside-maslo'];
          if (totalKey('f') < targets.fat * 0.85) {
            for (var fi = 0; fi < fatPool.length; fi++) {
              if (addExtra(byId(fatPool[fi]), 12, mainIdx)) break;
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
    var overKcal = totalKey('kcal') - targets.kcal;
    if (overKcal > targets.kcal * 0.06) {
      var carbK = sumP('carb', 'kcal');
      if (carbK > 0) {
        var cf2 = Math.max(0.35, (carbK - overKcal) / carbK);
        all.forEach(function (it) { if (it.food.cat === 'carb') it.grams *= cf2; });
      }
      overKcal = totalKey('kcal') - targets.kcal;
      if (overKcal > targets.kcal * 0.06) {
        var fatK = sumP('fat', 'kcal');
        if (fatK > 0) {
          var ff2 = Math.max(0.25, (fatK - overKcal) / fatK);
          all.forEach(function (it) { if (it.food.cat === 'fat') it.grams *= ff2; });
        }
      }
    }

    // hezké zaokrouhlení gramů (5 g, drobné zdroje tuku na 1 g); stropy už drží capPass()
    all.forEach(function (it) {
      var step = (it.food.cat === 'fat' && it.grams < 40) ? 1 : 5;
      it.grams = Math.max(step, Math.round(it.grams / step) * step);
      var cap = CAP[it.food.cat]; if (cap && it.grams > cap) it.grams = cap;
    });
    // [fix 2026-07-14] minigramáže („přidej 1 g oleje") v klientském plánu nemají co dělat —
    // nebílkovinné položky pod 8 g vyhodíme (pár kalorií totály poctivě ukážou);
    // bílkovinné zdroje drží podlahu 30 g z runScale, ty nemažeme.
    out.forEach(function (m) {
      m.items = m.items.filter(function (it) { return it.food.cat === 'protein' || it.grams >= 8; });
    });

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
  function assembleWeek(targets, opts, days) {
    opts = opts || {}; days = days || 7;
    var base = opts.seed || 0, out = [];
    for (var i = 0; i < days; i++) {
      out.push(assembleDay(targets, { meals: opts.meals, prefs: opts.prefs, db: opts.db, seed: base + i * 7 }));
    }
    return out;
  }

  var CAT_ORDER = { protein: 0, dairy: 1, carb: 2, legume: 3, veg: 4, fruit: 5, fat: 6, snack: 7 };

  // Kusové jednotky pro nákupní seznam: hmotnost jednoho kusu/balení (vychází z porcí v DB).
  // Jen položky, kde kus dává v obchodě smysl; ostatní zůstávají v gramech.
  var PIECES = {
    vejce: [60, 'ks'], bilek: [33, 'ks'],
    rohlik: [43, 'ks'], 'grahamovy-rohlik': [60, 'ks'], houska: [43, 'ks'], 'houska-celozrnna': [60, 'ks'],
    tortilla: [60, 'ks'], 'tortilla-kukuricna': [30, 'ks'], 'bezlepkova-tortilla': [30, 'ks'], 'low-carb-tortilla-wrap': [45, 'ks'],
    knackebrot: [10, 'ks'], 'bezlepkovy-knackebrot': [15, 'ks'],
    'tousty-celozrnne': [28, 'ks'], 'chleb-toustovy-celozrnny-tmavy': [25, 'ks'], 'bezlepkovy-chleb-toustovy': [30, 'ks'],
    'ryzove-chlebicky': [9, 'ks'],
    banan: [120, 'ks'], jablko: [150, 'ks'], hruska: [150, 'ks'], 'nashi-hruska': [120, 'ks'],
    pomeranc: [150, 'ks'], kiwi: [75, 'ks'], broskev: [120, 'ks'], nektarinka: [130, 'ks'], avokado: [140, 'ks'],
    mozzarella: [125, 'bal.'],
    'tunak-vlastni-stava': [120, 'konz.'], 'tunak-v-oleji-konzerva': [80, 'konz.'], 'tunak-v-oleji-odkapany': [80, 'konz.'],
    sardinky: [90, 'konz.'], 'sardinky-v-oleji': [90, 'konz.'], 'sardinky-v-tomate': [120, 'konz.']
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
  function preferForMeal(cat, mealName) {
    var n = String(mealName || '').toLowerCase();
    var isB = n.indexOf('sníd') !== -1 || n.indexOf('snid') !== -1;
    var isS = n.indexOf('svačin') !== -1 || n.indexOf('svacin') !== -1;
    if (cat === 'protein') return isB ? BREAKFAST_PROT : (isS ? SNACK_PROT : null);
    if (cat === 'carb') return isB ? BREAKFAST_CARB : MAIN_CARB;
    return null;
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
    var prefer = preferForMeal(cat, meal.name);
    if (prefer) {
      var sub = catAll.filter(function (f) { return prefer.test(f.id); });
      if (sub.filter(function (f) { return f.id !== item.food.id; }).length) list = sub;
    }
    var seed = opts.seed || 0;
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

  global.MealGen = { computeTargets: computeTargets, assembleDay: assembleDay, assembleWeek: assembleWeek,
    shoppingListFromDays: shoppingListFromDays, swapItem: swapItem, macrosFor: macrosFor, GOAL: GOAL, ACT: ACT };
})(window);
