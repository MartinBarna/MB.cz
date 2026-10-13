#!/usr/bin/env node
/**
 * Test parity: anglická kalkulačka (/en/) musí počítat STEJNĚ jako česká
 * (/kalkulacka-kalorii-a-makrozivin/). Tolerance 1 kcal a 1 g bílkovin.
 *
 * EN strana: en/calc-en.js nad assets/meal-gen.js (přesně to, co načítá en/index.html).
 * CZ strana: inline skript české stránky (funkce spocitej()) puštěný nad falešným DOM,
 *            tedy skutečný kód české kalkulačky, ne přepis vzorce.
 * Imperiální vstupy se do české strany zadávají přesně převedené (lb * 0.45359237,
 * in * 2.54), takže test hlídá převod jednotek, mapování voleb i hlášky kontroly vstupů.
 *
 * Spuštění: node en/test-kalkulacka.mjs   (exit 1 při jakékoli neshodě)
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const MEAL_GEN = read('assets/meal-gen.js');
const CALC_EN = read('en/calc-en.js');
const CZ_HTML = read('kalkulacka-kalorii-a-makrozivin/index.html');
const EN_HTML = read('en/index.html');

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  OK   ' + msg);
  else { failed++; console.log('  FAIL ' + msg); }
};

// ---- Statické pojistky: EN stránka používá sdílený engine a nemá vlastní vzorec ----
console.log('Statické kontroly');
ok(/<script[^>]+src="\/assets\/meal-gen\.js[^"]*"|['"]\/assets\/meal-gen\.js(\?[^'"]*)?['"]/.test(EN_HTML),
  'en/index.html načítá /assets/meal-gen.js (sdílený engine)');
ok(/src="\/en\/calc-en\.js[^"]*"/.test(EN_HTML), 'en/index.html načítá /en/calc-en.js');
ok(!/6\.25|161|1\.375|1\.55|7700/.test(CALC_EN), 'en/calc-en.js neobsahuje konstanty vzorce (Mifflin, aktivita, 7700)');
ok(/spocitej\(\)/.test(CZ_HTML) && /MealGen\.computeTargets/.test(CZ_HTML), 'česká stránka pořád počítá přes MealGen.computeTargets');

// ---- EN prostředí ----
function enEnv() {
  const ctx = { console };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(MEAL_GEN, ctx, { filename: 'meal-gen.js' });
  vm.runInContext(CALC_EN, ctx, { filename: 'calc-en.js' });
  return ctx;
}

// ---- CZ prostředí: inline skript české stránky nad falešným DOM ----
function czScript() {
  const blocks = [...CZ_HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const s = blocks.find((b) => b.includes('function spocitej'));
  if (!s) throw new Error('V české kalkulačce jsem nenašel inline skript se spocitej().');
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
  const ctx = {
    console,
    document: { getElementById: el },
    alert: (m) => { throw new Error('česká stránka hlásí alert: ' + m); },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(MEAL_GEN, ctx, { filename: 'meal-gen.js' });
  vm.runInContext(czScript(), ctx, { filename: 'kalkulacka-inline.js' });
  return { ctx, el };
}

const digits = (s) => {
  const t = String(s).replace(/[^0-9]/g, '');
  return t === '' ? null : Number(t);
};

const LB = 0.45359237;
const IN = 2.54;
const SEX_CZ = { male: 'muz', female: 'zena' };

// 6 vstupů: metrické i imperiální, obě pohlaví, všech 5 cílů, podlaha kalorií, BMI nad 30.
const CASES = [
  { name: 'muž, metrika, výchozí hodnoty CZ stránky', en: { units: 'metric', sex: 'male', age: '30', heightCm: '178', weightKg: '80', activity: 'stredni', goal: 'udrzeni' } },
  { name: 'muž 45, 5 ft 10 in, 220 lb, mírné hubnutí', en: { units: 'imperial', sex: 'male', age: '45', heightFt: '5', heightIn: '10', weightLb: '220', activity: 'lehka', goal: 'mirne_hubnuti' } },
  { name: 'žena 38, 5 ft 5 in, 165 lb, rychlejší hubnutí', en: { units: 'imperial', sex: 'female', age: '38', heightFt: '5', heightIn: '5', weightLb: '165', activity: 'sedavy', goal: 'hubnuti' } },
  { name: 'žena 52, 163 cm, 74.5 kg, vysoká aktivita, mírné hubnutí', en: { units: 'metric', sex: 'female', age: '52', heightCm: '163', weightKg: '74.5', activity: 'vysoka', goal: 'mirne_hubnuti' } },
  { name: 'muž 68, 5 ft 6 in, 150 lb, sedavý, hubnutí (bezpečnostní podlaha)', en: { units: 'imperial', sex: 'male', age: '68', heightFt: '5', heightIn: '6', weightLb: '150', activity: 'sedavy', goal: 'hubnuti' } },
  { name: 'muž 41, 6 ft 0 in, 282 lb (BMI nad 30), nabírání', en: { units: 'imperial', sex: 'male', age: '41', heightFt: '6', heightIn: '0', weightLb: '282', activity: 'extremni', goal: 'narust' } },
];

function czInputFor(en) {
  let h, w;
  if (en.units === 'imperial') {
    h = (Number(en.heightFt) * 12 + Number(en.heightIn || 0)) * IN;
    w = Number(en.weightLb) * LB;
  } else {
    h = Number(en.heightCm);
    w = Number(en.weightKg);
  }
  return { pohlavi: SEX_CZ[en.sex], vek: String(en.age), vyska: String(h), vaha: String(w), aktivita: en.activity, cil: en.goal };
}

console.log('\nParita EN a CZ (6 vstupů)');
const enCtx = enEnv();
const rows = [];
for (const c of CASES) {
  const e = enCtx.MBCalcEN.calculate(enCtx.MealGen, c.en);
  const { ctx, el } = czEnv();
  const cz = czInputFor(c.en);
  for (const [id, v] of Object.entries(cz)) el(id).value = v;
  ctx.spocitej();
  const czKcal = digits(el('r-kcal').textContent);
  const czProt = digits(el('r-bil').textContent);
  const pass = e.ok && czKcal != null && czProt != null && Math.abs(e.kcal - czKcal) <= 1 && Math.abs(e.protein - czProt) <= 1;
  rows.push({ c, e, czKcal, czProt });
  ok(pass, `${c.name}: EN ${e.ok ? e.kcal + ' kcal / ' + e.protein + ' g' : 'CHYBA ' + e.code} | CZ ${czKcal} kcal / ${czProt} g`);
}

// Poznámky k výsledku musí vzniknout za stejných podmínek jako na české stránce.
console.log('\nPoznámky k výsledku (podlaha a tempo)');
for (const { c, e } of rows) {
  const { ctx, el } = czEnv();
  for (const [id, v] of Object.entries(czInputFor(c.en))) el(id).value = v;
  ctx.spocitej();
  const czHasFloor = el('r-podlaha').style.display !== 'none' && el('r-podlaha').textContent.trim() !== '';
  const czHasTempo = el('r-tempo').style.display !== 'none' && el('r-tempo').textContent.trim() !== '';
  const enHasFloor = e.notes.some((n) => /safety floor|underweight/i.test(n));
  const enHasTempo = e.notes.some((n) => /adjusted your pace/i.test(n));
  ok(czHasFloor === enHasFloor && czHasTempo === enHasTempo,
    `${c.name}: podlaha/varování CZ ${czHasFloor} EN ${enHasFloor}, tempo CZ ${czHasTempo} EN ${enHasTempo}`);
}

// Kontrola vstupů: obě strany musí výpočet ZASTAVIT u stejných případů.
console.log('\nKontrola vstupů (obě strany musí zastavit)');
const STOP = [
  { name: 'věk 17', en: { units: 'metric', sex: 'female', age: '17', heightCm: '165', weightKg: '60', activity: 'lehka', goal: 'udrzeni' }, code: 'nezletily' },
  { name: 'podváha a hubnutí (BMI 17)', en: { units: 'metric', sex: 'female', age: '30', heightCm: '170', weightKg: '49', activity: 'lehka', goal: 'hubnuti' }, code: 'podvaha_hubnuti' },
  { name: 'prázdná váha', en: { units: 'imperial', sex: 'male', age: '40', heightFt: '5', heightIn: '9', weightLb: '', activity: 'lehka', goal: 'udrzeni' }, code: 'chybi' },
  { name: 'výška 2 ft (mimo rozsah)', en: { units: 'imperial', sex: 'male', age: '40', heightFt: '2', heightIn: '0', weightLb: '180', activity: 'lehka', goal: 'udrzeni' }, code: 'vyska_mimo' },
];
for (const s of STOP) {
  const e = enCtx.MBCalcEN.calculate(enCtx.MealGen, s.en);
  const { ctx, el } = czEnv();
  for (const [id, v] of Object.entries(czInputFor(s.en))) el(id).value = (s.en.weightLb === '' && id === 'vaha') ? '' : v;
  ctx.spocitej();
  const czStopped = el('r-kcal').textContent === '-' || el('r-kcal').textContent === '';
  ok(!e.ok && e.code === s.code && czStopped, `${s.name}: EN ${e.ok ? 'spočítal' : 'zastavil (' + e.code + ')'} | CZ ${czStopped ? 'zastavil' : 'spočítal'}`);
}

// EN hlášky nesmí obsahovat češtinu ani dlouhou pomlčku.
console.log('\nTexty EN hlášek');
const allMsgs = [...rows.flatMap((r) => r.e.notes), ...STOP.map((s) => enCtx.MBCalcEN.calculate(enCtx.MealGen, s.en).message)];
ok(allMsgs.every((m) => !/[ěščřžýáíéůúťďňĚŠČŘŽÝÁÍÉŮÚŤĎŇ]/.test(m)), 'žádná čeština v hláškách');
const LONG_DASH = String.fromCharCode(0x2014); // znak se do zdroje nepíše, ať ho hlídací grep nenajde tady
ok(allMsgs.every((m) => !m.includes(LONG_DASH)), 'žádná dlouhá pomlčka v hláškách');

console.log(failed ? `\nVÝSLEDEK: ${failed} kontrol selhalo` : '\nVÝSLEDEK: vše prošlo');
process.exit(failed ? 1 : 0);
