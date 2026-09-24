#!/usr/bin/env node
// Ženský lead magnet „7denní makro plán pro ženy 30+": výpočet porcí a maker + HTML pro PDF.
//
// Spuštění (z kořene repa):
//   node _zdroje/leadmagnet/build-makro-plan-zeny.js
//   → přepíše _zdroje/leadmagnet/makro-plan-zeny.html, _zdroje/leadmagnet/makro-plan-zeny-vypocet.json
//     a blok mezi značkami PLAN-ZENY v makro-plan/index.html (ukázkový den a náhled týdne).
// PDF (stejně jako pánské, Chrome headless, A4 bez okrajů):
//   chrome --headless=new --no-pdf-header-footer --print-to-pdf=download/makro-plan-zeny.pdf
//          file:///<repo>/_zdroje/leadmagnet/makro-plan-zeny.html
//
// ⛔ Žádné číslo o jídle se nepíše rukou. Kcal a makra = MealGen.macrosFor nad assets/food-db.json
// (tatáž funkce a tatáž DB jako webový generátor jídelníčků). Cíl dne = MealGen.computeTargets
// pro referenční ženu (makro-plan-zeny-data.js), jen kcal drží 1 500 slíbených na stránce.
// Gramáže rolí P/C/T se dorovnají na cíl dne (3 rovnice: kcal, bílkoviny, tuk) a zaokrouhlí;
// zobrazená čísla jsou pak spočítaná z těch zaokrouhlených gramáží, ne z cíle.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
global.window = global.window || {};
require(path.join(ROOT, 'assets', 'meal-gen.js'));
const M = global.window.MealGen;
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'food-db.json'), 'utf8'));
const BY_ID = Object.fromEntries(DB.map((f) => [f.id, f]));
const D = require('./makro-plan-zeny-data.js');

// ---- cíl dne ---------------------------------------------------------------
const REF_T = M.computeTargets(D.REF);
const CIL = { kcal: D.KCAL_CIL, p: REF_T.protein, f: REF_T.fat };
// Flex den: volnější večeře má stejný podíl dne jako v pánském plánu (820 z ~2 050 kcal = 40 %).
const FLEX_VOLNA_PODIL = 0.4;

// Kroky zaokrouhlení gramáže podle potraviny (kuchyňská realita).
function krok(id, role) {
  if (/olej/.test(id)) return 5;
  if (role === 'P') return 10;
  if (/chleb|rohlik/.test(id)) return 10;
  if (id === 'avokado' || id === 'eidam-30') return 10;
  return 5;
}

function mac(id, g) {
  const f = BY_ID[id];
  if (!f) throw new Error('Potravina ' + id + ' není v assets/food-db.json');
  return M.macrosFor(f, g);
}
function soucet(items) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, fib: 0 };
  for (const it of items) { const x = mac(it.id, it.g); for (const k in t) t[k] += x[k]; }
  return t;
}

// 3×3 soustava Cramerovým pravidlem.
function det3(m) {
  return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
       - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
       + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
}
function res3(A, b) {
  const d = det3(A);
  if (Math.abs(d) < 1e-9) return null;
  return [0, 1, 2].map((j) => det3(A.map((row, i) => row.map((v, k) => (k === j ? b[i] : v)))) / d);
}

const MEZE = { P: [0.6, 1.6], C: [0.6, 1.6], T: [0.5, 2.5] }; // o kolik smí dorovnání porci změnit proti výchozí (tuky jsou malé gramáže, proto širší)
const varovani = [];

function dorovnejDen(day) {
  const items = [];
  day.meals.forEach((m, mi) => m.items.forEach((row) => items.push({
    mi, id: row[0], g0: row[1], role: row[2], txt: row[3], jed: row[4] || 'g', kus: row[5] || null, g: row[1],
  })));
  const cil = day.flex
    ? { kcal: Math.round(CIL.kcal * (1 - FLEX_VOLNA_PODIL)), p: null, f: null }
    : CIL;
  const role = (r) => soucet(items.filter((i) => i.role === r).map((i) => ({ id: i.id, g: i.g0 })));
  const fix = role('F'), P = role('P'), C = role('C'), T = role('T');
  let fak;
  if (day.flex) {
    // Flex den: jen kcal zbytku dne, bílkovina se drží na výchozí porci, dorovnává se příloha.
    fak = { P: 1, C: C.kcal > 0 ? (cil.kcal - fix.kcal - P.kcal - T.kcal) / C.kcal : 1, T: 1 };
  } else {
    const r = res3(
      [[P.kcal, C.kcal, T.kcal], [P.p, C.p, T.p], [P.f, C.f, T.f]],
      [cil.kcal - fix.kcal, cil.p - fix.p, cil.f - fix.f]);
    fak = r ? { P: r[0], C: r[1], T: r[2] } : { P: 1, C: 1, T: 1 };
  }
  for (const k of ['P', 'C', 'T']) {
    const [lo, hi] = MEZE[k];
    if (fak[k] < lo || fak[k] > hi) {
      varovani.push(day.name + ': faktor ' + k + ' = ' + fak[k].toFixed(2) + ' mimo ' + lo + '-' + hi + ', oříznuto');
      fak[k] = Math.min(hi, Math.max(lo, fak[k]));
    }
  }
  for (const it of items) {
    if (it.role === 'F') continue;
    const s = krok(it.id, it.role);
    it.g = Math.max(s, Math.round((it.g0 * fak[it.role]) / s) * s);
  }
  return { items, fak };
}

// ---- výpočet týdne -----------------------------------------------------------
const plan = D.DAYS.map((day) => {
  const { items, fak } = dorovnejDen(day);
  const meals = day.meals.map((m, mi) => {
    const its = items.filter((i) => i.mi === mi);
    const t = soucet(its);
    return { lbl: m.lbl, title: m.title, volna: !!m.volna, items: its.map((i) => ({ id: i.id, g: i.g, role: i.role, txt: i.txt, jed: i.jed, kus: i.kus, g0: i.g0 })), t };
  });
  let tot = soucet(items);
  if (day.flex) {
    const volna = meals.find((m) => m.volna);
    volna.t = { kcal: D.KCAL_CIL - tot.kcal, p: null, c: null, f: null, fib: null };
    tot = { kcal: D.KCAL_CIL, p: tot.p, c: tot.c, f: tot.f, fib: tot.fib, bezVolne: soucet(items) };
  }
  return { name: day.name, tag: day.tag, flex: !!day.flex, fak, meals, tot };
});

// ---- texty -------------------------------------------------------------------
const r0 = (x) => Math.round(x);
const cz = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const NB = '\u00a0'; // nezlomitelná mezera: „80 g“ se nesmí rozdělit na dva řádky
function polozkaText(it) {
  if (it.kus) {
    const [gk, jed1, jed24, jed5] = it.kus;
    const n = it.g / gk;
    if (Math.abs(n - Math.round(n)) < 1e-9) {
      const k = Math.round(n);
      const slovo = k === 1 ? jed1 : (k <= 4 ? jed24 : jed5);
      return k + NB + slovo + (it.id === 'vejce' ? '' : ' (' + it.g + NB + 'g)');
    }
  }
  return it.g + NB + (it.jed === 'ml' ? 'ml' : 'g') + ' ' + it.txt;
}
function jidloText(m) {
  if (m.volna) {
    return 'Volnější večeře podle chuti: pizza, těstoviny, večeře venku nebo sklenka vína. Na celou večeři máš ~'
      + cz(Math.round(m.t.kcal / 10) * 10) + ' kcal. Dej si k ní porci bílkovin (maso, ryba, sýr) a užij si ji bez výčitek.';
  }
  return m.title + ': ' + m.items.map(polozkaText).join(' + ') + '.';
}
function macText(t) {
  if (t.p == null) return 'zbytek dne: ~' + cz(Math.round(t.kcal / 10) * 10) + ' kcal';
  return 'B ' + r0(t.p) + ' · S ' + r0(t.c) + ' · T ' + r0(t.f) + ' · ~' + cz(r0(t.kcal)) + ' kcal';
}
function sumText(d) {
  const tag = d.tag ? d.tag + ' · ' : '';
  if (d.flex) return tag + 'Σ ~' + cz(D.KCAL_CIL) + ' kcal · drž bílkoviny, večeři volněji';
  return tag + 'Σ ~' + cz(r0(d.tot.kcal)) + ' kcal · B ' + r0(d.tot.p) + ' · S ' + r0(d.tot.c) + ' · T ' + r0(d.tot.f);
}

function dayHtml(d, i) {
  const rows = d.meals.map((m) => '            <tr><td class="lbl">' + esc(m.lbl) + '</td><td>' + esc(jidloText(m))
    + '<span class="mac">' + esc(macText(m.t)) + '</span></td></tr>').join('\n');
  return '    <div class="day">\n'
    + '        <div class="dh"><div class="dnum">' + (i + 1) + '</div><div class="dt">' + esc(d.name) + ' <small>' + esc(sumText(d)) + '</small></div></div>\n'
    + '        <table>\n' + rows + '\n        </table>\n    </div>\n';
}

// ---- nákupní seznam: součet gramáží z plánu --------------------------------------
const NAKUP_SKUPINY = [
  ['Bílkoviny', ['kureci-prsa', 'kruti-prsa', 'hovezi-steak-libovy', 'hovezi-mlete-5', 'losos', 'tunak-vlastni-stava', 'vejce', 'syrovatkovy-protein']],
  ['Mléčné', ['recky-jogurt-0', 'skyr', 'proteinovy-jogurt', 'cottage-syr', 'tvaroh-mekky-nizkotucny', 'mleko-polotucne', 'eidam-30', 'proteinovy-pudink']],
  ['Sacharidy', ['ovesne-vlocky', 'ovesna-mouka', 'granola-bez-pridaneho-cukru', 'ryze-bila', 'quinoa', 'testoviny-celozrnne', 'testoviny', 'brambory', 'bataty', 'chleb-celozrnny', 'grahamovy-rohlik', 'tortilla-psenicna']],
  ['Tuky · zelenina · ovoce', ['mandle', 'avokado', 'hummus', 'repkovy-olej', 'olivovy-olej', 'med', 'mrazena-zeleninova-smes', 'brokolice', 'spenat', 'ledovy-salat', 'okurka', 'cherry-rajcata', 'paprika-cervena', 'mrkev', 'passata', 'boruvky', 'maliny', 'jahody', 'banan', 'jablko']],
];
const NAKUP_NAZEV = {
  'kureci-prsa': 'Kuřecí prsa', 'kruti-prsa': 'Krůtí prsa', 'hovezi-steak-libovy': 'Libové hovězí', 'hovezi-mlete-5': 'Mleté hovězí (5 % tuku)',
  losos: 'Losos', 'tunak-vlastni-stava': 'Tuňák ve vlastní šťávě', vejce: 'Vejce', 'syrovatkovy-protein': 'Syrovátkový protein',
  'recky-jogurt-0': 'Řecký jogurt 0 %', skyr: 'Skyr bílý', 'proteinovy-jogurt': 'Proteinový jogurt', 'cottage-syr': 'Cottage',
  'tvaroh-mekky-nizkotucny': 'Tvaroh nízkotučný', 'mleko-polotucne': 'Polotučné mléko', 'eidam-30': 'Eidam 30 %', 'proteinovy-pudink': 'Proteinový pudink',
  'ovesne-vlocky': 'Ovesné vločky', 'ovesna-mouka': 'Ovesná mouka', 'granola-bez-pridaneho-cukru': 'Granola bez přidaného cukru', 'ryze-bila': 'Rýže',
  quinoa: 'Quinoa', 'testoviny-celozrnne': 'Celozrnné těstoviny', testoviny: 'Polévkové nudle', brambory: 'Brambory', bataty: 'Batáty',
  'chleb-celozrnny': 'Celozrnný chléb', 'grahamovy-rohlik': 'Grahamový rohlík', 'tortilla-psenicna': 'Tortilla',
  mandle: 'Mandle', avokado: 'Avokádo', hummus: 'Hummus', 'repkovy-olej': 'Řepkový olej', 'olivovy-olej': 'Olivový olej', med: 'Med',
  'mrazena-zeleninova-smes': 'Mražená zeleninová směs', brokolice: 'Brokolice', spenat: 'Špenát', 'ledovy-salat': 'Ledový salát',
  okurka: 'Okurka', 'cherry-rajcata': 'Cherry rajčata', 'paprika-cervena': 'Paprika červená', mrkev: 'Mrkev', passata: 'Passata',
  boruvky: 'Borůvky', maliny: 'Maliny', jahody: 'Jahody', banan: 'Banán', jablko: 'Jablko',
};
const NAKUP_KUS = { vejce: [60, 'ks'], banan: [120, 'ks'], jablko: [150, 'ks'], 'grahamovy-rohlik': [60, 'ks'], 'tortilla-psenicna': [60, 'ks'], avokado: [140, 'ks'] };
const nakup = {};
plan.forEach((d) => d.meals.forEach((m) => m.items.forEach((it) => { nakup[it.id] = (nakup[it.id] || 0) + it.g; })));
function nakupMnozstvi(id) {
  const g = nakup[id];
  if (NAKUP_KUS[id]) {
    const [gk, u] = NAKUP_KUS[id];
    const ks = g / gk;
    const txt = Number.isInteger(ks) ? String(ks) : String(Math.ceil(ks * 2) / 2).replace('.', ',');
    return txt + ' ' + u;
  }
  if (g >= 1000) return (Math.round(g / 50) * 50 / 1000).toString().replace('.', ',') + ' kg';
  return g + (id === 'mleko-polotucne' ? ' ml' : ' g');
}
const nepouzite = Object.keys(nakup).filter((id) => !NAKUP_SKUPINY.some(([, ids]) => ids.includes(id)));
if (nepouzite.length) throw new Error('Nákupní seznam nezná: ' + nepouzite.join(', '));
const nakupHtml = NAKUP_SKUPINY.map(([nazev, ids]) => {
  const radky = ids.filter((id) => nakup[id]).map((id) => '            <div>' + esc(NAKUP_NAZEV[id]) + ' <b>' + esc(nakupMnozstvi(id)) + '</b></div>').join('\n');
  return '        <div class="cat">' + esc(nazev) + '</div>\n        <div class="grid2">\n' + radky + '\n        </div>';
}).join('\n');

// ---- čísla do textů varianty / zvětšit-zmenšit (spočítaná, ne opsaná) ---------------
const porceP = [], porceC = {};
plan.forEach((d) => d.meals.forEach((m) => m.items.forEach((it) => {
  if (it.role === 'P' && ['kureci-prsa', 'kruti-prsa', 'losos', 'hovezi-steak-libovy', 'hovezi-mlete-5'].includes(it.id) && m.lbl !== 'Snídaně') porceP.push(it.g);
  if (it.role === 'C') (porceC[it.id] = porceC[it.id] || []).push(it.g);
})));
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const P_TYP = median(porceP);
const RYZE_TYP = porceC['ryze-bila'] ? median(porceC['ryze-bila']) : null;
// „Potřebuješ víc/míň": +40 g rýže nebo vloček a 1 jablko. Kolik to je, spočítá DB.
const PLUS_RYZE = mac('ryze-bila', 40).kcal, PLUS_VLOCKY = mac('ovesne-vlocky', 40).kcal, PLUS_JABLKO = mac('jablko', 150).kcal;
const plusMin = Math.round((Math.min(PLUS_RYZE, PLUS_VLOCKY) + PLUS_JABLKO) / 10) * 10;
const plusMax = Math.round((Math.max(PLUS_RYZE, PLUS_VLOCKY) + PLUS_JABLKO) / 10) * 10;
// „Potřebuješ míň": polovina přílohy u oběda i večeře + bez přidaného tuku (olej, ořechy). Rozpětí přes dny.
const minusDny = plan.filter((d) => !d.flex).map((d) => {
  let k = 0;
  d.meals.forEach((m) => m.items.forEach((it) => {
    if (it.role === 'C' && (m.lbl === 'Oběd' || m.lbl === 'Večeře')) k += mac(it.id, it.g).kcal / 2;
    if (/olej|mandle/.test(it.id)) k += mac(it.id, it.g).kcal;
  }));
  return k;
});
const minusMin = Math.round(Math.min(...minusDny) / 10) * 10, minusMax = Math.round(Math.max(...minusDny) / 10) * 10;
// Varianty: stejné kcal jako typická porce rýže / 15 g mandlí, v jiné potravině (zaokrouhleno na 10 g / 5 g).
const kcal100 = (id) => mac(id, 100).kcal;
const ekv = (zId, zG, naId, s) => Math.round((mac(zId, zG).kcal / kcal100(naId) * 100) / s) * s;
const EKV = {
  BRAMBORY: ekv('ryze-bila', RYZE_TYP, 'brambory', 10), BATATY: ekv('ryze-bila', RYZE_TYP, 'bataty', 10),
  CHLEB: ekv('ryze-bila', RYZE_TYP, 'chleb-celozrnny', 10), KUSKUS: ekv('ryze-bila', RYZE_TYP, 'kuskus', 5),
  OLEJ: ekv('mandle', 15, 'olivovy-olej', 5), AVOKADO: ekv('mandle', 15, 'avokado', 10), ARASID: ekv('mandle', 15, 'araside-maslo', 5),
};

// ---- průměr týdne (bez flex dne, ten má volnou večeři) ---------------------------
const bezFlex = plan.filter((d) => !d.flex);
const prumer = (k) => bezFlex.reduce((s, d) => s + d.tot[k], 0) / bezFlex.length;

// ---- HTML ------------------------------------------------------------------------
const TPL = fs.readFileSync(path.join(__dirname, 'makro-plan-zeny.sablona.html'), 'utf8');
const nahrady = {
  '{{DNY_1_3}}': plan.slice(0, 3).map((d, i) => dayHtml(d, i)).join('\n'),
  '{{DNY_4_6}}': plan.slice(3, 6).map((d, i) => dayHtml(d, i + 3)).join('\n'),
  '{{DEN_7}}': dayHtml(plan[6], 6),
  '{{NAKUP}}': nakupHtml,
  '{{KCAL}}': cz(D.KCAL_CIL),
  '{{REF_KCAL}}': cz(REF_T.kcal),
  '{{REF_VAHA}}': String(D.REF.weight),
  '{{REF_VYSKA}}': String(D.REF.height),
  '{{REF_VEK}}': String(D.REF.age),
  '{{P_TYP}}': String(P_TYP),
  '{{RYZE_TYP}}': String(RYZE_TYP),
  '{{PLUS_MIN}}': String(plusMin),
  '{{PLUS_MAX}}': String(plusMax),
  '{{B_PRUMER}}': String(r0(prumer('p'))),
  '{{MINUS_MIN}}': String(minusMin),
  '{{MINUS_MAX}}': String(minusMax),
  '{{EKV_BRAMBORY}}': String(EKV.BRAMBORY), '{{EKV_BATATY}}': String(EKV.BATATY),
  '{{EKV_CHLEB}}': String(EKV.CHLEB), '{{EKV_KUSKUS}}': String(EKV.KUSKUS),
  '{{EKV_OLEJ}}': String(EKV.OLEJ), '{{EKV_AVOKADO}}': String(EKV.AVOKADO), '{{EKV_ARASID}}': String(EKV.ARASID),
  '{{LOSOS_KCAL}}': String(r0(kcal100('losos'))), '{{KURE_KCAL}}': String(r0(kcal100('kureci-prsa'))),
};
let html = TPL;
for (const [k, v] of Object.entries(nahrady)) html = html.split(k).join(v);
const zbyle = html.match(/\{\{[A-Z_0-9]+\}\}/g);
if (zbyle) throw new Error('Nenahrazené značky v šabloně: ' + zbyle.join(', '));
fs.writeFileSync(path.join(__dirname, 'makro-plan-zeny.html'), html);

// ---- výpočet pro kontrolu a pro stránku ------------------------------------------
const vypocet = {
  zdroj: 'assets/food-db.json + assets/meal-gen.js (MealGen.macrosFor, MealGen.computeTargets)',
  ref: D.REF, refTargets: REF_T, cil: CIL, flexVolnaPodil: FLEX_VOLNA_PODIL,
  plan: plan.map((d) => ({
    name: d.name, tag: d.tag, flex: d.flex, faktory: d.fak,
    tot: { kcal: +d.tot.kcal.toFixed(1), p: +d.tot.p.toFixed(1), c: +d.tot.c.toFixed(1), f: +d.tot.f.toFixed(1), fib: +d.tot.fib.toFixed(1) },
    meals: d.meals.map((m) => ({
      lbl: m.lbl, title: m.title, text: jidloText(m), mac: macText(m.t),
      t: m.t.p == null ? { kcal: +m.t.kcal.toFixed(1) } : { kcal: +m.t.kcal.toFixed(1), p: +m.t.p.toFixed(1), c: +m.t.c.toFixed(1), f: +m.t.f.toFixed(1) },
      items: m.items.map((it) => ({ id: it.id, g: it.g, vychozi: it.g0, role: it.role })),
    })),
  })),
  nakup,
  varovani,
};
fs.writeFileSync(path.join(__dirname, 'makro-plan-zeny-vypocet.json'), JSON.stringify(vypocet, null, 2) + '\n');

// ---- stránka makro-plan: ukázkový den + náhled týdne -----------------------------
const STRANKA = path.join(ROOT, 'makro-plan', 'index.html');
let st = fs.readFileSync(STRANKA, 'utf8');
function nahradBlok(src, znacka, obsah) {
  const a = '<!-- ' + znacka + ':START (generuje _zdroje/leadmagnet/build-makro-plan-zeny.js, rukou nepsat) -->';
  const b = '<!-- ' + znacka + ':KONEC -->';
  const i = src.indexOf(a), j = src.indexOf(b);
  if (i < 0 || j < 0) throw new Error('V makro-plan/index.html chybí značky ' + znacka);
  return src.slice(0, i + a.length) + '\n' + obsah + src.slice(j);
}
const ukazka = plan[0];
const kartyDne = ukazka.meals.map((m) => '            <div class="meal"><div class="lab">' + esc(m.lbl.toUpperCase()) + '</div><div class="name">'
  + esc(m.title) + '</div><div class="kc">~' + cz(r0(m.t.kcal)) + ' kcal · ' + r0(m.t.p) + ' g B</div></div>').join('\n');
st = nahradBlok(st, 'PLAN-ZENY-DEN', kartyDne + '\n            ');
const zkr = { 'Pondělí': 'Po', 'Úterý': 'Út', 'Středa': 'St', 'Čtvrtek': 'Čt', 'Pátek': 'Pá', 'Sobota': 'So', 'Neděle': 'Ne' };
const nahled = plan.slice(0, 5).map((d) => {
  const hlavni = d.meals.filter((m) => m.lbl === 'Oběd' || m.lbl === 'Večeře').map((m) => m.title.split(/ s | a /)[0]);
  return '                    <div class="day"><span class="meal-txt"><b>' + zkr[d.name] + '</b> ' + esc(hlavni.join(' · ')) + '</span><span class="kc">'
    + cz(r0(d.tot.kcal)) + ' kcal</span></div>'; // jen kcal: s bílkovinami se řádek v kartě na mobilu láme k okraji
}).join('\n');
st = nahradBlok(st, 'PLAN-ZENY-NAHLED', nahled + '\n                    ');
// Soubor má konce řádků CRLF: vložené řádky sjednotit, ať diff neukazuje smíšené konce.
if (st.includes('\r\n')) st = st.replace(/\r?\n/g, '\r\n');
fs.writeFileSync(STRANKA, st);

// ---- výpis ------------------------------------------------------------------------
for (const d of plan) {
  console.log(d.name.padEnd(8), 'kcal', r0(d.tot.kcal), 'B', r0(d.tot.p), 'S', r0(d.tot.c), 'T', r0(d.tot.f),
    '| faktory P', d.fak.P.toFixed(2), 'C', d.fak.C.toFixed(2), 'T', d.fak.T.toFixed(2));
  for (const m of d.meals) console.log('   ', m.lbl.padEnd(8), macText(m.t).padEnd(34), '|', jidloText(m));
}
console.log('cíl', JSON.stringify(CIL), 'ref engine', REF_T.kcal, 'kcal');
console.log('P_TYP', P_TYP, 'RYZE_TYP', RYZE_TYP, 'plus', plusMin, '-', plusMax, 'minus', minusMin, '-', minusMax, 'B průměr', r0(prumer('p')), 'EKV', JSON.stringify(EKV));
if (varovani.length) console.log('VAROVÁNÍ:\n' + varovani.join('\n'));
