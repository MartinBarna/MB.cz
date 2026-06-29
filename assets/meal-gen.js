/* Barna Academy — engine generátoru jídelníčků.
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
    var protein = Math.round(w * g.protein);          // g
    var fat = Math.round((kcal * g.fatPct) / 9);      // g
    var carbsKcal = kcal - (protein * 4 + fat * 9);
    var carbs = Math.max(40, Math.round(carbsKcal / 4)); // g, pojistka
    // dorovnej kcal po zaokrouhlení
    kcal = protein * 4 + carbs * 4 + fat * 9;
    return { kcal: kcal, protein: protein, carbs: carbs, fat: fat,
             bmr: Math.round(bmr), tdee: Math.round(tdee), goalLabel: g.label };
  }

  // ---- pomocné: makra porce dané potraviny při X gramech ----
  function macrosFor(food, grams) {
    var k = grams / 100;
    return {
      kcal: food.per100.kcal * k, p: food.per100.p * k,
      c: food.per100.c * k, f: food.per100.f * k
    };
  }

  // filtr DB podle preferencí (vyloučení kategorií/ id)
  function filterDb(db, prefs) {
    prefs = prefs || {};
    var exclCat = prefs.excludeCat || [];     // např. ['dairy']
    var exclId = prefs.excludeId || [];
    return db.filter(function (f) {
      if (exclCat.indexOf(f.cat) !== -1) return false;
      if (exclId.indexOf(f.id) !== -1) return false;
      if (prefs.vegetarian && /kure|krut|hovez|veprov|losos|tunak|treska|sunka|sardin|stehno|mlete/.test(f.id)) return false;
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
      var prot = pick(db, 'protein', seed + i, protPrefer) || pick(db, 'dairy', seed + i, protPrefer);
      if (prot) {
        var pg = round((mProt / (prot.per100.p || 1)) * 100, 10);
        pg = Math.min(pg, prot.cat === 'protein' ? 260 : 300);
        items.push({ food: prot, grams: Math.max(30, pg) });
      }
      // 2) sacharidová příloha (ne u poslední menší svačiny)
      if (!isSnack || i === 0) {
        var carb = (i === 0) ? (pick(db, 'carb', seed + i + 7, BREAKFAST_CARB)) : pick(db, 'carb', seed + i + 3, MAIN_CARB);
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
    // pořadí: bílkoviny → sacharidy → tuky (každý dorovná svůj makro-cíl)
    scaleCat('protein', 'p', targets.protein, 0.45, 2.2);
    scaleCat('carb', 'c', targets.carbs, 0.4, 2.6);
    scaleCat('fat', 'f', targets.fat, 0.3, 3.0);
    // hezké zaokrouhlení gramů (5 g, drobné zdroje tuku na 1 g)
    all.forEach(function (it) {
      var step = (it.food.cat === 'fat' && it.grams < 40) ? 1 : 5;
      it.grams = Math.max(step, Math.round(it.grams / step) * step);
    });

    // přepočítej totály po normalizaci
    out.forEach(function (m) {
      m.totals = m.items.reduce(function (s, it) {
        var mm = macrosFor(it.food, it.grams);
        s.kcal += mm.kcal; s.p += mm.p; s.c += mm.c; s.f += mm.f; return s;
      }, { kcal:0, p:0, c:0, f:0 });
    });
    var dayTot = out.reduce(function (s, m) {
      s.kcal += m.totals.kcal; s.p += m.totals.p; s.c += m.totals.c; s.f += m.totals.f; return s;
    }, { kcal:0, p:0, c:0, f:0 });

    return { meals: out, totals: dayTot, targets: targets };
  }

  global.MealGen = { computeTargets: computeTargets, assembleDay: assembleDay, macrosFor: macrosFor, GOAL: GOAL, ACT: ACT };
})(window);
