// Test harness pro Academy nástroje: MealGen, WorkoutGen, RecipeGen + validace DB.
// Spuštění: node tools-test.js (z tohoto adresáře; čte soubory z MB.cz repa)
'use strict';
const fs = require('fs');
const path = require('path');
// [2026-09-02] Kořen se dá přebít proměnnou TOOLS_TEST_REPO. Bez toho testoval harness
// VŽDY strom 'Desktop/MB.cz', tedy ne ten, ve kterém se právě pracuje (dnes se pracuje
// ve worktree mb-wt-*), takže hlásil výsledek cizího kódu. Stejný princip jako
// PARITA_WEB v repu appky.
const REPO = process.env.TOOLS_TEST_REPO || 'C:/Users/fitne/Desktop/MB.cz';

global.window = global; // enginy se věší na window
eval(fs.readFileSync(path.join(REPO, 'assets/meal-gen.js'), 'utf8'));
eval(fs.readFileSync(path.join(REPO, 'assets/workout-gen.js'), 'utf8'));
eval(fs.readFileSync(path.join(REPO, 'assets/recipe-gen.js'), 'utf8'));

const FOODS = JSON.parse(fs.readFileSync(path.join(REPO, 'assets/food-db.json'), 'utf8'));
const RECIPES = JSON.parse(fs.readFileSync(path.join(REPO, 'assets/recipe-db.json'), 'utf8'));
const EXDB = JSON.parse(fs.readFileSync(path.join(REPO, 'assets/exercise-db.json'), 'utf8'));
const CURATED = JSON.parse(fs.readFileSync(path.join(REPO, 'assets/curated-foods.json'), 'utf8'));

let fails = 0, checks = 0;
const seen = new Set();
function fail(area, msg) {
  fails++;
  const k = area + '|' + msg.slice(0, 80);
  if (!seen.has(k)) { seen.add(k); console.log(`FAIL [${area}] ${msg}`); }
}
function ok() { checks++; }
function assert(cond, area, msg) { if (cond) ok(); else fail(area, msg); }

// ============ 1) FOOD-DB validace ============
{
  const ids = new Set();
  for (const f of FOODS) {
    assert(f.id && f.name && f.cat && f.per100, 'food-db', `chybí pole u ${f.id || f.name}`);
    assert(!ids.has(f.id), 'food-db', `duplicitní id ${f.id}`);
    ids.add(f.id);
    const { kcal, p, c, f: fat } = f.per100;
    assert(kcal >= 0 && kcal <= 950, 'food-db', `${f.id}: kcal ${kcal} mimo rozsah`);
    assert(p >= 0 && p <= 95 && c >= 0 && c <= 100 && fat >= 0 && fat <= 100, 'food-db', `${f.id}: makra mimo rozsah`);
    const calc = p * 4 + c * 4 + fat * 9;
    if (kcal > 30) assert(Math.abs(calc - kcal) / kcal <= 0.35, 'food-db', `${f.id}: kcal ${kcal} vs makra ${Math.round(calc)} (odchylka >35 %)`);
    assert(f.portion > 0 && f.portion <= 500, 'food-db', `${f.id}: portion ${f.portion}`);
  }
  console.log(`food-db: ${FOODS.length} položek zkontrolováno`);
}

// ============ 2) CURATED-FOODS validace ============
{
  const arr = Array.isArray(CURATED) ? CURATED : (CURATED.items || CURATED.foods || []);
  let bad = 0;
  for (const f of arr) {
    const kcal = f.kcal_100g, p = f.protein_100g, c = f.carb_100g, fat = f.fat_100g;
    if (kcal == null || p == null) { bad++; continue; }
    const calc = p * 4 + c * 4 + fat * 9;
    if (kcal > 30 && Math.abs(calc - kcal) / kcal > 0.4) bad++;
  }
  console.log(`curated-foods: ${arr.length} položek, ${bad} podezřelých (>40% nesoulad kcal/makra nebo chybějící pole)`);
  assert(bad <= Math.max(3, arr.length * 0.02), 'curated', `${bad} podezřelých položek z ${arr.length}`);
}

// ============ 3) EXERCISE-DB validace + kompatibilita s WorkoutGen ============
{
  const ids = new Set();
  const patterns = new Set(), muscles = new Set();
  for (const e of EXDB) {
    assert(e.id && e.name && e.muscle && e.pattern, 'exercise-db', `chybí pole u ${e.id || e.name}`);
    assert(!ids.has(e.id), 'exercise-db', `duplicitní id ${e.id}`);
    ids.add(e.id);
    assert(Array.isArray(e.equip) && e.equip.length, 'exercise-db', `${e.id}: equip`);
    assert(Array.isArray(e.location) && e.location.length, 'exercise-db', `${e.id}: location`);
    patterns.add(e.pattern); muscles.add(e.muscle);
  }
  console.log(`exercise-db: ${EXDB.length} cviků, patterny: ${[...patterns].sort().join(', ')}`);
}

// ============ 4) RecipeGen fuzz ============
{
  const meals = ['vse', 'snidane', 'obed', 'vecere', 'svacina', 'dezert'];
  const tags = ['vse', 'highprotein', 'lowcal', 'balanced'];
  const usable = new Set();
  let combosEmpty = [];
  for (const meal of meals) for (const tag of tags) for (const veg of [false, true]) for (const nd of [false, true]) {
    let found = 0;
    for (let seed = 0; seed < 8; seed++) {
      const res = window.RecipeGen.pick(RECIPES, FOODS, { meal, tag, veg, nodairy: nd, seed });
      if (!res) continue;
      found++;
      usable.add(res.recipe.name);
      const m = res.macros;
      assert([m.kcal, m.p, m.c, m.f, m.fib].every(x => Number.isFinite(x) && x >= 0), 'recipe', `${res.recipe.name}: NaN v makrech`);
      assert(m.kcal >= 80 && m.kcal <= 1600, 'recipe', `${res.recipe.name}: kcal/porce ${m.kcal}`);
      assert(res.ing.length >= 2, 'recipe', `${res.recipe.name}: <2 suroviny`);
      for (const ing of res.ing) assert(ing.g > 0 && ing.g <= 1000, 'recipe', `${res.recipe.name}: gramáž ${ing.name}=${ing.g}`);
      assert((res.recipe.steps || []).length >= 2, 'recipe', `${res.recipe.name}: chybí postup`);
    }
    if (found === 0 && meal !== 'vse') combosEmpty.push(`${meal}/${tag}${veg ? '/veg' : ''}${nd ? '/nodairy' : ''}`);
  }
  // každý recept dosažitelný?
  const unreachable = RECIPES.filter(r => !usable.has(r.name));
  console.log(`recipe-gen: ${RECIPES.length} receptů, dosažitelných ${usable.size}, nedosažitelné: ${unreachable.map(r => r.name).join(', ') || 'žádné'}`);
  console.log(`recipe-gen: prázdné kombinace filtrů (${combosEmpty.length}): ${combosEmpty.slice(0, 8).join(', ')}${combosEmpty.length > 8 ? '…' : ''}`);
  // suroviny receptů existují ve food-db?
  const fids = new Set(FOODS.map(f => f.id));
  for (const r of RECIPES) for (const ing of (r.ing || [])) {
    if (ing.id) assert(fids.has(ing.id), 'recipe-db', `${r.name}: surovina ${ing.id} není ve food-db`);
  }
}

// ============ 5) MealGen fuzz ============
{
  const goals = Object.keys(window.MealGen.GOAL);
  const acts = Object.keys(window.MealGen.ACT);
  let worstKcal = 0, worstP = 0, worstCase = '';
  let n = 0;
  for (const sex of ['muz', 'zena'])
    for (const goal of goals)
      for (const w of [55, 72, 90, 115])
        for (const mealsN of [3, 4, 5])
          for (const pref of [{}, { excludeCat: ['dairy'] }, { vegetarian: true }, { vegetarian: true, excludeCat: ['dairy'] }]) {
            const t = window.MealGen.computeTargets({ weight: w, height: sex === 'muz' ? 180 : 167, age: 35, sex, activity: acts[n % acts.length], goal });
            assert(t.kcal >= 1000 && t.kcal <= 4800, 'meal-targets', `kcal ${t.kcal} (${sex},${goal},${w}kg)`);
            const refW = Math.min(w, Math.max((sex === 'muz' ? 180 : 167) - 100, w * 0.75));
            assert(t.protein >= refW * 1.7 && t.protein <= refW * 2.1, 'meal-targets', `protein ${t.protein} pro ${w}kg/${goal} (refW ${refW})`);
            assert(t.carbs >= 0, 'meal-targets', `záporné sacharidy ${t.carbs} (${sex},${goal},${w}kg)`);
            const prefs = Object.assign({ excludeCat: [] }, pref);
            const plan = window.MealGen.assembleDay(t, { meals: mealsN, prefs, db: FOODS, seed: n });
            const dev = Math.abs(plan.totals.kcal - t.kcal) / t.kcal;
            const pdev = plan.totals.p - t.protein;
            if (dev > worstKcal) { worstKcal = dev; worstCase = `kcal ${Math.round(plan.totals.kcal)}/${t.kcal} (${sex},${goal},${w}kg,${mealsN}j,${JSON.stringify(pref)})`; }
            if (Math.abs(pdev) > Math.abs(worstP)) worstP = pdev;
            assert(dev <= 0.12, 'meal-assemble', `kcal odchylka ${(dev * 100).toFixed(1)} % — ${sex},${goal},${w}kg,${mealsN} jídel,${JSON.stringify(pref)}`);
            assert(pdev >= -18 && pdev <= 40, 'meal-assemble', `protein ${Math.round(plan.totals.p)} vs cíl ${t.protein} — ${sex},${goal},${w}kg,${mealsN}j`);
            for (const meal of plan.meals) for (const it of meal.items) {
              assert(it.grams >= 5 && it.grams <= 700, 'meal-assemble', `gramáž ${it.food.name}=${it.grams}`);
              if (prefs.vegetarian) assert(!['meat', 'fish'].includes(it.food.cat), 'meal-prefs', `vegetarián dostal ${it.food.name} (${it.food.cat})`);
              if ((prefs.excludeCat || []).includes('dairy')) assert(it.food.cat !== 'dairy', 'meal-prefs', `nodairy dostal ${it.food.name}`);
            }
            n++;
          }
  console.log(`meal-gen: ${n} plánů; nejhorší kcal odchylka ${(worstKcal * 100).toFixed(1)} % (${worstCase}); nejhorší protein odchylka ${Math.round(worstP)} g`);
}

// ============ 6) WorkoutGen fuzz ============
{
  let n = 0, minEx = 99, emptyPlans = [];
  for (const location of ['fitko', 'doma', 'hriste'])
    for (const equip of ['vse', 'cinky', 'telo'])
      for (const level of ['zacatecnik', 'pokrocily', 'zkuseny'])
        for (const goal of ['svaly', 'sila', 'kondice', 'vydrz'])
          for (const days of [2, 3, 4, 5]) {
            const plan = window.WorkoutGen.buildPlan(EXDB, { location, equip, level, goal, days, seed: n });
            n++;
            assert(plan && plan.days && plan.days.length === days, 'workout', `${location}/${equip}/${level}/${goal}/${days}: špatný počet dní`);
            for (const d of plan.days) {
              if (d.exercises.length < 3) emptyPlans.push(`${location}/${equip}/${level}/${goal}/${days}d den${d.day}: jen ${d.exercises.length} cviků`);
              minEx = Math.min(minEx, d.exercises.length);
              const dayIds = new Set();
              for (const it of d.exercises) {
                assert(!dayIds.has(it.ex.id), 'workout', `${location}/${equip}/${goal}: duplicitní cvik ${it.ex.id} v jednom dni`);
                dayIds.add(it.ex.id);
                assert(it.ex.location.includes(location), 'workout', `${it.ex.id} nepatří do ${location}`);
                assert(it.sets >= (String(it.reps).includes('min') ? 1 : 2) && it.sets <= 6, 'workout', `${it.ex.id}: sets ${it.sets}`);
                assert(typeof it.reps === 'string' && it.reps.length, 'workout', `${it.ex.id}: reps`);
              }
            }
          }
  console.log(`workout-gen: ${n} plánů, min cviků/den = ${minEx}; slabé dny (${emptyPlans.length}): ${emptyPlans.slice(0, 6).join(' | ')}${emptyPlans.length > 6 ? '…' : ''}`);
}

console.log(`\n===== VÝSLEDEK: ${checks} kontrol OK, ${fails} selhání =====`);
process.exit(fails ? 1 : 0);
