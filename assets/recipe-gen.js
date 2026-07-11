/* Barna Academy — generátor receptů. Čistě klientský, deterministický.
   Recepty odkazují potraviny z food-db.json (id + gramy) → makra se počítají z reálných hodnot,
   ne vymyšlené. Vstupy: typ jídla, zaměření (protein/nízké kcal/vyvážené), vegetariánské, bez mléčných.
   recipe = {id,name,meal,tags[],veg,nodairy,servings,ing:[{id,g}],extra[],steps[],tip}. */
(function (global) {
  'use strict';

  // makra porce dané potraviny při X gramech (shodné s meal-gen)
  function macrosFor(food, grams) {
    var k = grams / 100;
    return { kcal: food.per100.kcal * k, p: food.per100.p * k, c: food.per100.c * k, f: food.per100.f * k, fib: (food.per100.fib || 0) * k };
  }

  // makra receptu NA PORCI (součet ingrediencí / počet porcí), zaokrouhleno
  function recipeMacros(recipe, foodById) {
    var t = { kcal: 0, p: 0, c: 0, f: 0, fib: 0 };
    recipe.ing.forEach(function (i) {
      var food = foodById[i.id]; if (!food) return;
      var m = macrosFor(food, i.g);
      t.kcal += m.kcal; t.p += m.p; t.c += m.c; t.f += m.f; t.fib += m.fib;
    });
    var s = recipe.servings || 1;
    return { kcal: Math.round(t.kcal / s), p: Math.round(t.p / s), c: Math.round(t.c / s), f: Math.round(t.f / s), fib: Math.round(t.fib / s) };
  }

  function indexFoods(foods) { var by = {}; foods.forEach(function (f) { by[f.id] = f; }); return by; }

  function filterRecipes(recipes, opts) {
    opts = opts || {};
    return recipes.filter(function (r) {
      if (opts.meal && opts.meal !== 'vse' && r.meal !== opts.meal) return false;
      if (opts.veg && !r.veg) return false;
      if (opts.nodairy && !r.nodairy) return false;
      if (opts.tag && opts.tag !== 'vse' && (r.tags || []).indexOf(opts.tag) === -1) return false;
      return true;
    });
  }

  // vybere recept dle filtrů; seed = pestrost (přegenerovat). Vrací null když nic nesedí.
  function pick(recipes, foods, opts) {
    opts = opts || {};
    var foodById = indexFoods(foods);
    var cand = filterRecipes(recipes, opts);
    if (!cand.length) return null;
    var seed = opts.seed || 0;
    var r = cand[((seed % cand.length) + cand.length) % cand.length];
    var ing = r.ing.map(function (i) { var food = foodById[i.id]; return { name: food ? food.name : i.id, g: i.g, ok: !!food }; });
    return { recipe: r, macros: recipeMacros(r, foodById), ing: ing, matchCount: cand.length };
  }

  global.RecipeGen = { pick: pick, recipeMacros: recipeMacros, filterRecipes: filterRecipes, macrosFor: macrosFor, indexFoods: indexFoods };
})(window);
