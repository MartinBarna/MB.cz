// Kontrola stropu křupavého chleba a zaokrouhlení kusů v assets/meal-gen.js.
// Spuštění z kořene repa: node scripts/test-krupave-kusy.js
// Navazuje na appku: https://github.com/MartinBarna/tvuj-coach/pull/57
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.join(__dirname, '..');
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(REPO, 'assets/meal-gen.js'), 'utf8'), ctx, { filename: 'meal-gen.js' });
const FOODS = JSON.parse(fs.readFileSync(path.join(REPO, 'assets/food-db.json'), 'utf8'));
const MG = ctx.MealGen;

const KUS = {
  knackebrot: 10,
  knackebrod: 10,
  'bezlepkovy-knackebrot': 15,
  'ryzove-chlebicky': 9,
  'detske-ryzove-chlebicky': 10
};

let fails = 0;
function fail(msg) { fails++; console.log('FAIL ' + msg); }
function ok(cond, msg) { if (cond) console.log('OK   ' + msg); else fail(msg); }

function jeCeleKusy(grams, kusG) {
  const ks = grams / kusG;
  return ks <= 4.001 && Math.abs(ks - Math.round(ks)) < 0.02;
}

const priklad = { weight: 90, height: 180, age: 35, sex: 'muz', activity: 'vysoka', goal: 'hubnuti' };
const cil = MG.computeTargets(priklad);
const den = MG.assembleDay(cil, { meals: 3, prefs: { excludeCat: [] }, db: FOODS, seed: 4 });
const knack = [];
den.meals.forEach(function (m) {
  m.items.forEach(function (it) {
    if (it.food.id === 'knackebrot') knack.push({ meal: m.kind, grams: it.grams, name: it.food.name });
  });
});
ok(knack.length === 1 && knack[0].grams === 40, 'příklad seed 4: knäckebrot 40 g (4 ks), ne 120 g');
const maJinouPrilohu = den.meals.some(function (m) {
  return m.items.some(function (it) { return it.food.cat === 'carb' && it.food.id !== 'knackebrot'; });
});
ok(maJinouPrilohu, 'příklad má kromě knäckebrotu i jinou přílohu');
const odchylka = Math.abs(den.totals.kcal - cil.kcal) / cil.kcal;
ok(odchylka <= 0.05, 'příklad trefil kalorie v pásmu 5 % (' + Math.round(den.totals.kcal) + '/' + cil.kcal + ')');
den.meals.forEach(function (m) {
  m.items.forEach(function (it) {
    if (it.food.id === 'vejce') ok(it.grams % 60 === 0, 'vejce ' + it.grams + ' g jsou celé kusy');
    if (it.food.id === 'sunka-veprova-nejvyssi-jakost') ok(it.grams % 15 === 0, 'šunka ' + it.grams + ' g je na plátky');
  });
});
const nakup = MG.shoppingListFromDays([den]);
const nakupK = nakup.filter(function (s) { return s.id === 'knackebrot'; })[0];
ok(nakupK && nakupK.pieces === 4 && nakupK.pieceLabel === 'ks', 'nákupní seznam: knäckebrot 4 ks');

const goals = Object.keys(MG.GOAL);
const acts = Object.keys(MG.ACT);
let n = 0;
let poruseni = 0;
for (const sex of ['muz', 'zena']) {
  for (const goal of goals) {
    for (const w of [72, 90, 115]) {
      for (const mealsN of [3, 4, 5]) {
        for (let seed = 0; seed < 4; seed++) {
          const t = MG.computeTargets({
            weight: w, height: sex === 'muz' ? 180 : 167, age: 35, sex,
            activity: acts[n % acts.length], goal: goal
          });
          const plan = MG.assembleDay(t, { meals: mealsN, prefs: { excludeCat: [] }, db: FOODS, seed: seed });
          n++;
          plan.meals.forEach(function (m) {
            m.items.forEach(function (it) {
              const kusG = KUS[it.food.id];
              if (!kusG) return;
              if (!jeCeleKusy(it.grams, kusG)) {
                poruseni++;
                if (poruseni <= 8) fail(it.food.id + ' ' + it.grams + ' g v ' + m.kind + ' (' + sex + ' ' + goal + ' ' + w + ' kg)');
              }
            });
          });
        }
      }
    }
  }
}
ok(poruseni === 0, 'mřížka ' + n + ' dnů: křupavé plátky nejvýš 4 celé kusy');

const zachrana = new Set(['ryze-natural-varena', 'brambory-varene', 'testoviny-celozrnne-varene', 'bulgur-vareny']);
const db = FOODS.filter(function (f) {
  return f.cat !== 'carb' || KUS[f.id] || zachrana.has(f.id);
});
let tichySchodek = 0;
for (let seed = 0; seed < 8; seed++) {
  const plan = MG.assembleDay(cil, { meals: 3, prefs: { excludeCat: [] }, db: db, seed: seed });
  const dev = Math.abs(plan.totals.kcal - cil.kcal) / cil.kcal;
  const varovani = plan.warnings && plan.warnings.length;
  if (dev > 0.12 && !varovani) tichySchodek++;
  plan.meals.forEach(function (m) {
    m.items.forEach(function (it) {
      if (KUS[it.food.id] && !jeCeleKusy(it.grams, KUS[it.food.id])) {
        fail('zúžená DB: ' + it.food.id + ' ' + it.grams + ' g');
      }
    });
  });
}
ok(tichySchodek === 0, 'zúžená DB (jen křupavé + záchranné přílohy): žádný tichý schodek kalorií');

console.log(fails ? '\nSELHALO ' + fails : '\nVšechno sedí');
process.exit(fails ? 1 : 0);
