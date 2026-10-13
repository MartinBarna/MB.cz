#!/usr/bin/env node
/**
 * Parita anglických nástrojů s českými (13. 10. 2026).
 * Kalkulačka: en/calc-en.js proti inline spocitej() české stránky, 8 vstupů,
 * tolerance 1 kcal a 1 g (bílkoviny, tuky, sacharidy, vláknina).
 * Trénink: WorkoutGen.buildPlan proti MBWorkoutEN.present (stejné id, série,
 * opakování, jen přeložené názvy). Chybějící překlad musí shodit assertComplete.
 * Spuštění: node en/test-nastroje.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const LONG = '\u2014';
const CZ = /[ěščřžýáíéůúťďňĚŠČŘŽÝÁÍÉŮÚŤĎŇ]/;

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  OK   ' + msg);
  else { failed++; console.log('  FAIL ' + msg); }
};

function enCalc() {
  const ctx = { console };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('assets/meal-gen.js'), ctx, { filename: 'meal-gen.js' });
  vm.runInContext(read('en/calc-en.js'), ctx, { filename: 'calc-en.js' });
  return ctx;
}
function czScript() {
  const html = read('kalkulacka-kalorii-a-makrozivin/index.html');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const s = blocks.find((b) => b.includes('function spocitej'));
  if (!s) throw new Error('česká kalkulačka: chybí spocitej()');
  return s;
}
function czEnv() {
  const els = {};
  const el = (id) => {
    if (!els[id]) {
      els[id] = {
        id, value: '', textContent: '', href: '', style: {}, attrs: {},
        classList: { add() {}, remove() {} },
        setAttribute(k, v) { this.attrs[k] = v; },
        getAttribute(k) { return this.attrs[k]; },
        querySelector() { return null; },
      };
    }
    return els[id];
  };
  const ctx = { console, document: { getElementById: el }, alert(m) { throw new Error('alert: ' + m); } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('assets/meal-gen.js'), ctx, { filename: 'meal-gen.js' });
  vm.runInContext(czScript(), ctx, { filename: 'kalkulacka-inline.js' });
  return { ctx, el };
}
function workoutEnv() {
  const ctx = { console };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('assets/workout-gen.js'), ctx, { filename: 'workout-gen.js' });
  vm.runInContext(read('en/workout-en.js'), ctx, { filename: 'workout-en.js' });
  return ctx;
}
function asNum(s) {
  const t = String(s).replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const LB = 0.45359237;
const IN = 2.54;
const SEX = { male: 'muz', female: 'zena' };
const CASES = [
  { name: 'muž metrika, výchozí CZ', en: { units: 'metric', sex: 'male', age: '30', heightCm: '178', weightKg: '80', activity: 'stredni', goal: 'udrzeni' } },
  { name: 'muž 45, 5 ft 10 in, 220 lb, mírné hubnutí', en: { units: 'imperial', sex: 'male', age: '45', heightFt: '5', heightIn: '10', weightLb: '220', activity: 'lehka', goal: 'mirne_hubnuti' } },
  { name: 'žena 38, 5 ft 5 in, 165 lb, hubnutí', en: { units: 'imperial', sex: 'female', age: '38', heightFt: '5', heightIn: '5', weightLb: '165', activity: 'sedavy', goal: 'hubnuti' } },
  { name: 'žena 52, 163 cm, 74.5 kg, vysoká aktivita', en: { units: 'metric', sex: 'female', age: '52', heightCm: '163', weightKg: '74.5', activity: 'vysoka', goal: 'mirne_hubnuti' } },
  { name: 'muž 68, 5 ft 6 in, 150 lb, podlaha', en: { units: 'imperial', sex: 'male', age: '68', heightFt: '5', heightIn: '6', weightLb: '150', activity: 'sedavy', goal: 'hubnuti' } },
  { name: 'muž 41, 6 ft 0 in, 282 lb, nabírání', en: { units: 'imperial', sex: 'male', age: '41', heightFt: '6', heightIn: '0', weightLb: '282', activity: 'extremni', goal: 'narust' } },
  { name: 'žena 29, 170 cm, 62 kg, udržení', en: { units: 'metric', sex: 'female', age: '29', heightCm: '170', weightKg: '62', activity: 'vysoka', goal: 'udrzeni' } },
  { name: 'muž 33, 5 ft 11 in, 198 lb, mírný nárůst', en: { units: 'imperial', sex: 'male', age: '33', heightFt: '5', heightIn: '11', weightLb: '198', activity: 'stredni', goal: 'mirny_narust' } },
];
function czInput(en) {
  let h, w;
  if (en.units === 'imperial') {
    h = (Number(en.heightFt) * 12 + Number(en.heightIn || 0)) * IN;
    w = Number(en.weightLb) * LB;
  } else {
    h = Number(en.heightCm);
    w = Number(en.weightKg);
  }
  return { pohlavi: SEX[en.sex], vek: String(en.age), vyska: String(h), vaha: String(w), aktivita: en.activity, cil: en.goal };
}

console.log('Kalkulačka: 8 vstupů proti české stránce');
const calc = enCalc();
ok(!/6\.25|161|1\.375|1\.55|7700/.test(read('en/calc-en.js')), 'calc-en.js nemá konstanty vzorce');
const notes = [];
for (const c of CASES) {
  const e = calc.MBCalcEN.calculate(calc.MealGen, c.en);
  const { ctx, el } = czEnv();
  for (const [id, v] of Object.entries(czInput(c.en))) el(id).value = v;
  ctx.spocitej();
  const cz = {
    kcal: asNum(el('r-kcal').textContent),
    protein: asNum(el('r-bil').textContent),
    fat: asNum(el('r-tuk').textContent),
    carbs: asNum(el('r-sach').textContent),
    fiber: asNum(el('r-vlak').textContent),
  };
  const close = (a, b) => a != null && b != null && Math.abs(a - b) <= 1;
  const pass = e.ok && close(e.kcal, cz.kcal) && close(e.protein, cz.protein) && close(e.fat, cz.fat) && close(e.carbs, cz.carbs) && close(e.fiber, cz.fiber);
  ok(pass, `${c.name}: EN ${e.ok ? e.kcal + ' kcal, P ' + e.protein + ' F ' + e.fat + ' C ' + e.carbs + ' Fi ' + e.fiber : e.code} | CZ ${cz.kcal}/${cz.protein}/${cz.fat}/${cz.carbs}/${cz.fiber}`);
  if (e.ok) {
    const t = calc.MealGen.computeTargets({
      sex: SEX[c.en.sex], age: Number(c.en.age),
      height: c.en.units === 'imperial' ? (Number(c.en.heightFt) * 12 + Number(c.en.heightIn || 0)) * IN : Number(c.en.heightCm),
      weight: c.en.units === 'imperial' ? Number(c.en.weightLb) * LB : Number(c.en.weightKg),
      activity: c.en.activity, goal: c.en.goal,
    });
    ok(Math.abs(e.tempoKgTyden - t.tempoKgTyden) < 1e-9, `${c.name}: tempo ${e.tempoKgTyden} = engine ${t.tempoKgTyden}`);
    notes.push(...(e.notes || []));
    const keys = Object.keys(e.calc).sort().join(',');
    ok(keys === 'activity,goal,kcal,protein_g,tdee,units,v', `${c.name}: calc klíče ${keys}`);
  }
}
ok(notes.every((m) => !CZ.test(m) && !m.includes(LONG)), 'poznámky kalkulačky bez češtiny a bez dlouhé pomlčky');

console.log('\nTrénink: stejné vstupy, přeložené názvy');
const w = workoutEnv();
const db = JSON.parse(read('assets/exercise-db.json'));
const byId = Object.fromEntries(db.map((e) => [e.id, e]));
let dictOk = true;
try { w.MBWorkoutEN.assertComplete(db); } catch (e) { dictOk = false; ok(false, String(e.message)); }
ok(dictOk, `slovník pokrývá všech ${db.length} cviků`);
const sampleId = db[0].id;
const saved = w.MBWorkoutEN.EX[sampleId];
delete w.MBWorkoutEN.EX[sampleId];
let threw = false;
try { w.MBWorkoutEN.assertComplete(db); } catch (e) { threw = /missing translation/.test(e.message); }
w.MBWorkoutEN.EX[sampleId] = saved;
ok(threw, 'chybějící překlad shodí assertComplete');
w.MBWorkoutEN.assertComplete(db);

const PLANS = [
  { location: 'fitko', equip: 'vse', level: 'pokrocily', goal: 'svaly', days: 4, seed: 0, struktura: 'standard', opakovani: 'standard', orezStyl: 'velke' },
  { location: 'doma', equip: 'telo', level: 'zacatecnik', goal: 'kondice', days: 3, seed: 1, struktura: 'standard', opakovani: 'standard', orezStyl: 'velke' },
  { location: 'hriste', equip: 'cinky', level: 'zkuseny', goal: 'sila', days: 5, seed: 2, struktura: 'standard', opakovani: 'standard', orezStyl: 'velke' },
  { location: 'doma', equip: 'cinky', level: 'pokrocily', goal: 'vydrz', days: 2, seed: 3, struktura: 'vic_cviku', opakovani: 'lehci', orezStyl: 'pestrost' },
  { location: 'fitko', equip: 'telo', level: 'zacatecnik', goal: 'svaly', days: 4, seed: 4, struktura: 'min_cviku', opakovani: 'tezsi', orezStyl: 'auto' },
  { location: 'hriste', equip: 'telo', level: 'zkuseny', goal: 'kondice', days: 3, seed: 5, struktura: 'standard', opakovani: 'standard', orezStyl: 'velke' },
];
const shown = [];
for (const opts of PLANS) {
  const plan = w.WorkoutGen.buildPlan(db, opts);
  const view = w.MBWorkoutEN.present(plan, opts);
  let same = plan.days.length === view.days.length && plan.poolSize > 0;
  plan.days.forEach((d, i) => {
    const day = view.days[i];
    if (!day || day.exercises.length !== d.exercises.length) same = false;
    shown.push(day && day.name, view.goalLabel);
    d.exercises.forEach((it, j) => {
      const en = day && day.exercises[j];
      if (!en || en.id !== it.ex.id || en.sets !== it.sets || en.reps !== it.reps) same = false;
      if (en) {
        shown.push(en.name, en.tip, en.reps);
        const czName = byId[it.ex.id] && byId[it.ex.id].name;
        if (czName && CZ.test(czName) && en.name === czName) same = false;
      }
    });
  });
  const label = `${opts.location}/${opts.equip}/${opts.level}/${opts.goal}/${opts.days}d`;
  ok(same, `${label}: ${plan.days.length} dní, pool ${plan.poolSize}`);
  const sum = w.MBWorkoutEN.summary(opts, plan);
  ok(sum.length > 0 && sum.length <= 500 && !/@/.test(sum) && !CZ.test(sum), `${label}: summary ${sum.length} znaků`);
  shown.push(sum, view.rest);
}
const blob = shown.filter(Boolean).join('\n');
ok(!CZ.test(blob), 'výstup plánů bez české diakritiky');
ok(!blob.includes(LONG), 'výstup plánů bez dlouhé pomlčky');

console.log('\nTexty stránek a funkce');
const files = [
  'en/calculator/index.html', 'en/calculator/page.js',
  'en/workout/index.html', 'en/workout/page.js', 'en/workout-en.js',
  'en/calc-en.js', 'akademie/_supabase/functions/en-lead/index.ts',
  'akademie/_supabase/en-leads-kind-2026-10-13.sql',
];
for (const f of files) ok(!read(f).includes(LONG), `${f} bez dlouhé pomlčky`);
const calcHtml = read('en/calculator/index.html');
const workHtml = read('en/workout/index.html');
const CONSENT = 'Yes, send me the Fat Loss Kit, a short email series after it, and then about one email a week with tips and coaching offers. I can unsubscribe anytime.';
ok(calcHtml.includes(CONSENT) && workHtml.includes(CONSENT), 'souhlas je stejný text jako kit a v HTML není předzaškrtnutý');
ok(!/id="lead-consent"[^>]*checked/.test(calcHtml) && !/id="lead-consent"[^>]*checked/.test(workHtml), 'checkbox souhlasu není checked');
ok(calcHtml.includes('kind: \'calculator\'') === false && read('en/calculator/page.js').includes("kind: 'calculator'"), 'calculator page.js posílá kind calculator');
ok(read('en/workout/page.js').includes("kind: 'workout'") && read('en/workout/page.js').includes('plan_summary') && read('en/workout/page.js').includes('calc: null'), 'workout page.js: kind workout, plan_summary, calc null');
function visible(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*\slang=["']cs["'][^>]*>[\s\S]*?<\/[a-z0-9]+>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}
ok(!CZ.test(visible(calcHtml)), 'viditelný text kalkulačky bez češtiny (mimo lang=cs)');
ok(!CZ.test(visible(workHtml)), 'viditelný text tréninku bez češtiny (mimo lang=cs)');
const lead = read('akademie/_supabase/functions/en-lead/index.ts');
ok(lead.includes('"calculator"') && lead.includes('"workout"'), 'en-lead povoluje kind calculator a workout');
ok(/kind === "workout"[\s\S]{0,500}calc = null/.test(lead) && lead.includes('b.plan_summary'), 'workout ukládá plan_summary a calc je null');
const sql = read('akademie/_supabase/en-leads-kind-2026-10-13.sql');
ok(sql.includes('en_leads_kind_check') && sql.includes("'calculator'") && sql.includes("'workout'") && !/add column/i.test(sql), 'migrace jen CHECK, bez nového sloupce');
let engines = '';
try { engines = execSync('git diff -- assets/meal-gen.js assets/workout-gen.js', { cwd: ROOT, encoding: 'utf8' }); } catch (e) { engines = e.stdout || 'diff failed'; }
ok(engines.trim() === '', 'assets/meal-gen.js a assets/workout-gen.js beze změny');

console.log(failed ? `\nVÝSLEDEK: ${failed} kontrol selhalo` : '\nVÝSLEDEK: vše prošlo');
process.exit(failed ? 1 : 0);
