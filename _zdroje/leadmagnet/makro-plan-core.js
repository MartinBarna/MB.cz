// Společné jádro PDF makro-plánů (ženy: makro-plan-zeny, muži: forma-zpet-muzi).
//
// ⛔ Žádné číslo o jídle se nepíše rukou. Kcal a makra = MealGen.macrosFor nad assets/food-db.json
// (tatáž funkce a tatáž DB jako webový generátor jídelníčků) + pár položek z databáze appky
// v makro-plan-extra-potraviny.js. Cíl dne = MealGen.computeTargets pro referenční postavu
// z datového souboru; kcal drží číslo slíbené na stránce, tuk = TUK_G_NA_KG × referenční váha.
// Gramáže rolí P/C/T se dorovnají na cíl dne (soustava rovnic: kcal, bílkoviny, tuk) a zaokrouhlí;
// zobrazená čísla jsou pak spočítaná z těch zaokrouhlených gramáží, ne z cíle.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
global.window = global.window || {};
require(path.join(ROOT, 'assets', 'meal-gen.js'));
const M = global.window.MealGen;
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'food-db.json'), 'utf8'));
const EXTRA = require('./makro-plan-extra-potraviny.js');
const BY_ID = Object.fromEntries(DB.map((f) => [f.id, f]));
for (const f of EXTRA) {
  if (BY_ID[f.id]) throw new Error('Extra potravina ' + f.id + ' už je v food-db.json, smaž ji z extra seznamu');
  BY_ID[f.id] = f;
}

function mac(id, g) {
  const f = BY_ID[id];
  if (!f) throw new Error('Potravina ' + id + ' není v assets/food-db.json ani v extra seznamu');
  return M.macrosFor(f, g);
}
function soucet(items) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, fib: 0 };
  for (const it of items) { const x = mac(it.id, it.g); for (const k in t) t[k] += x[k]; }
  return t;
}

// Gaussova eliminace pro malou soustavu n×n.
function res(A, b) {
  const n = b.length, m = A.map((r, i) => r.concat([b[i]]));
  for (let i = 0; i < n; i++) {
    let piv = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(m[r][i]) > Math.abs(m[piv][i])) piv = r;
    if (Math.abs(m[piv][i]) < 1e-9) return null;
    [m[i], m[piv]] = [m[piv], m[i]];
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const k = m[r][i] / m[i][i];
      for (let c = i; c <= n; c++) m[r][c] -= k * m[i][c];
    }
  }
  return m.map((r, i) => r[n] / r[i]);
}

// Kroky zaokrouhlení gramáže (kuchyňská realita).
function krok(id, role, g0) {
  if (/olej/.test(id)) return 5;
  if (role === 'P') return 10;
  if (/chleb|rohlik|toast|houska/.test(id)) return 10;
  if (id === 'avokado' || id === 'eidam-30') return 10;
  if (g0 >= 150) return 10;
  return 5;
}
const MASO = /kureci|kruti|hovezi|losos|treska|tunak/;
const MAX_MASO_G = 200;
// O kolik smí dorovnání porci změnit proti výchozí (tuky jsou malé gramáže, proto širší).
const MEZE = { P: [0.6, 1.6], C: [0.6, 1.8], T: [0.5, 2.5] };

const r0 = (x) => Math.round(x);
const cz = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
const NB = ' '; // nezlomitelná mezera: „80 g“ se nesmí rozdělit na dva řádky

function build(D) {
  const varovani = [];
  const REF_T = M.computeTargets(D.REF);
  const CIL = { kcal: D.KCAL_CIL, p: REF_T.protein, f: Math.round(D.TUK_G_NA_KG * D.REF.weight) };

  function dorovnejDen(day) {
    const items = [];
    day.meals.forEach((m, mi) => m.items.forEach((row) => items.push({
      mi, id: row[0], g0: row[1], role: row[2], txt: row[3], jed: row[4] || 'g', kus: row[5] || null, g: row[1],
    })));
    // Strop porce: maso a ryba nad ~200 g syrové váhy nejsou praktická porce. Když ho dorovnání
    // přeleze, porce zůstane na stropu a bílkoviny dorovnají ostatní položky role P.
    for (const it of items) it.strop = MASO.test(it.id) ? MAX_MASO_G : Infinity;
    // Ořechy pod 10 g vypadají jako překlep (dvě půlky vlašáku), proto spodní mez.
    for (const it of items) it.min = /mandle|orech/.test(it.id) ? 10 : 0;
    const role = (r) => soucet(items.filter((i) => i.role === r && !i.fix).map((i) => ({ id: i.id, g: i.g0 })));
    let R = { P: role('P'), C: role('C'), T: role('T') };
    // Neznámé: role, které den má. Tuk se dorovnává jen tam, kde den má přidaný tuk (role T)
    // a tuk nemá volný (flex den s pizzou). Jinak se řeší jen kcal a bílkoviny.
    // Den s `jenKcal: 'C'` (nebo 'P') dorovnává jen kcal touhle rolí (flex den s pevnou pizzou).
    const nezname = day.jenKcal ? [day.jenKcal] : ['P', 'C', 'T'].filter((k) => R[k].kcal > 0 && !(k === 'T' && day.volnyTuk));
    const rovnice = day.jenKcal ? ['kcal'] : nezname.includes('T') ? ['kcal', 'p', 'f'] : ['kcal', 'p'];
    if (nezname.length !== rovnice.length) throw new Error(day.name + ': role ' + nezname.join(',') + ' nesedí na rovnice ' + rovnice.join(','));
    // Když faktor vyjde mimo meze, ořízne se, role se bere jako pevná a zbytek se řeší znovu
    // bez její rovnice (P ↔ bílkoviny, C ↔ kcal, T ↔ tuk). Den pak drží aspoň kcal.
    const fak = { P: 1, C: 1, T: 1 };
    const EQ = { P: 'p', C: 'kcal', T: 'f' };
    const gramy = (i) => (i.fix ? i.strop : i.g0 * (fak[i.role] || 1));
    let volne = nezname.slice(), rov = rovnice.slice();
    const vyrad = (k) => {
      volne = volne.filter((x) => x !== k);
      const q = rov.includes(EQ[k]) && EQ[k] !== 'kcal' ? EQ[k] : rov.filter((x) => x !== 'kcal').pop() || 'kcal';
      rov = rov.filter((x) => x !== q);
    };
    while (volne.length) {
      R = { P: role('P'), C: role('C'), T: role('T') };
      const pevneR = soucet(items.filter((i) => !volne.includes(i.role) || i.fix).map((i) => ({ id: i.id, g: gramy(i) })));
      const r = res(rov.map((q) => volne.map((k) => R[k][q])), rov.map((q) => CIL[q] - pevneR[q]));
      if (!r) { varovani.push(day.name + ': soustava nemá řešení, porce beze změny'); break; }
      volne.forEach((k, i) => { fak[k] = r[i]; });
      const mimo = volne.find((k) => fak[k] < MEZE[k][0] || fak[k] > MEZE[k][1]);
      if (mimo) {
        const [lo, hi] = MEZE[mimo];
        varovani.push(day.name + ': faktor ' + mimo + ' = ' + fak[mimo].toFixed(2) + ' mimo ' + lo + '-' + hi + ', oříznuto');
        fak[mimo] = Math.min(hi, Math.max(lo, fak[mimo]));
        vyrad(mimo);
        continue;
      }
      const nadStrop = items.find((i) => volne.includes(i.role) && !i.fix && i.g0 * fak[i.role] > i.strop + 1e-9);
      if (!nadStrop) break;
      nadStrop.fix = true;
      varovani.push(day.name + ': ' + nadStrop.id + ' na stropu ' + nadStrop.strop + ' g');
      if (!items.some((i) => i.role === nadStrop.role && !i.fix)) vyrad(nadStrop.role);
    }
    for (const it of items) {
      if (!nezname.includes(it.role)) continue;
      const s = krok(it.id, it.role, it.g0);
      it.g = it.fix ? it.strop : Math.max(s, it.min, Math.round((it.g0 * fak[it.role]) / s) * s);
      it.gr = it.g;
    }
    // Zaokrouhlení na kuchyňské kroky den posune (malé porce o 5 g jsou i 5 %). Doladění: každá
    // dorovnávaná položka smí o jeden krok nahoru nebo dolů (ne přes strop), dokud se tím zmenšuje
    // odchylka od cíle.
    const chyba = () => {
      const t = soucet(items);
      return rovnice.reduce((e, q) => e + ((t[q] - CIL[q]) / (q === 'kcal' ? 15 : 3)) ** 2, 0);
    };
    for (let kolo = 0; kolo < 20; kolo++) {
      let nej = chyba(), tah = null;
      for (const it of items) {
        if (!nezname.includes(it.role) || it.kus) continue;
        const s = krok(it.id, it.role, it.g0);
        for (const d of [s, -s]) {
          const g = it.g + d;
          if (g < s || g < it.min || g > it.strop || Math.abs(g - it.gr) > s) continue;
          it.g = g; const e = chyba(); it.g -= d;
          if (e < nej - 1e-9) { nej = e; tah = [it, d]; }
        }
      }
      if (!tah) break;
      tah[0].g += tah[1];
    }
    return { items, fak };
  }

  // ---- výpočet týdne -------------------------------------------------------------------
  const plan = D.DAYS.map((day) => {
    const { items, fak } = dorovnejDen(day);
    const meals = day.meals.map((m, mi) => {
      const its = items.filter((i) => i.mi === mi);
      return { lbl: m.lbl, title: m.title, og: m.og || null, pozn: m.pozn || '',
        items: its.map((i) => ({ id: i.id, g: i.g, role: i.role, txt: i.txt, jed: i.jed, kus: i.kus, g0: i.g0 })), t: soucet(its) };
    });
    return { name: day.name, tag: day.tag, flex: !!day.flex, fak, meals, tot: soucet(items) };
  });

  // ---- texty -------------------------------------------------------------------------------
  function polozkaText(it) {
    if (it.kus) {
      const [gk, jed1, jed24, jed5, ukazGramy] = it.kus;
      const n = it.g / gk;
      if (Math.abs(n - Math.round(n)) < 1e-9) {
        const k = Math.round(n);
        const slovo = k === 1 ? jed1 : (k <= 4 ? jed24 : jed5);
        return k + NB + slovo + (ukazGramy === false ? '' : ' (' + it.g + NB + (it.jed === 'ml' ? 'ml' : 'g') + ')');
      }
    }
    return it.g + NB + (it.jed === 'ml' ? 'ml' : 'g') + ' ' + it.txt;
  }
  const jidloText = (m) => m.title + ': ' + m.items.map(polozkaText).join(' + ') + '.' + (m.pozn ? ' ' + m.pozn : '');
  const macText = (t) => 'B ' + r0(t.p) + ' · S ' + r0(t.c) + ' · T ' + r0(t.f) + ' · ~' + cz(r0(t.kcal)) + ' kcal';
  function sumText(d) {
    const tag = d.tag ? d.tag + ' · ' : '';
    return tag + 'celkem ~' + cz(r0(d.tot.kcal)) + ' kcal · B ' + r0(d.tot.p) + ' · S ' + r0(d.tot.c) + ' · T ' + r0(d.tot.f);
  }
  function dayHtml(d, i) {
    const rows = d.meals.map((m) => '            <tr><td class="lbl">' + esc(m.lbl) + '</td><td>' + esc(jidloText(m))
      + '<span class="mac">' + esc(macText(m.t)) + '</span></td></tr>').join('\n');
    return '    <div class="day">\n'
      + '        <div class="dh"><div class="dnum">' + (i + 1) + '</div><div class="dt">' + esc(d.name) + ' <small>' + esc(sumText(d)) + '</small></div></div>\n'
      + '        <table>\n' + rows + '\n        </table>\n    </div>\n';
  }

  // ---- nákupní seznam: součet gramáží z plánu ------------------------------------------------
  const nakup = {};
  plan.forEach((d) => d.meals.forEach((m) => m.items.forEach((it) => { nakup[it.id] = (nakup[it.id] || 0) + it.g; })));
  const nepouzite = Object.keys(nakup).filter((id) => !D.NAKUP_SKUPINY.some(([, ids]) => ids.includes(id)));
  if (nepouzite.length) throw new Error('Nákupní seznam nezná: ' + nepouzite.join(', '));
  function nakupMnozstvi(id) {
    const g = nakup[id];
    if (D.NAKUP_KUS[id]) {
      const [gk, u] = D.NAKUP_KUS[id];
      const ks = g / gk;
      // Kus se kupuje celý: půl avokáda nebo 250 g pizzy v obchodě nekoupíš.
      return Number.isInteger(ks) ? ks + ' ' + u : Math.ceil(ks) + ' ' + u + ' (v plánu ' + g + ' g)';
    }
    // Vařená příloha se kupuje syrová: přepočet podle kcal syrové a vařené verze v DB.
    if (D.NAKUP_SYROVE && D.NAKUP_SYROVE[id]) {
      const syr = Math.round((g * mac(id, 100).kcal / mac(D.NAKUP_SYROVE[id], 100).kcal) / 5) * 5;
      return syr + ' g syrové (' + g + ' g vařené)';
    }
    const ml = D.NAKUP_ML && D.NAKUP_ML.includes(id);
    if (g >= 1000) return (Math.round(g / 50) * 50 / 1000).toString().replace('.', ',') + (ml ? ' l' : ' kg');
    return g + (ml ? ' ml' : ' g');
  }
  const nakupHtml = D.NAKUP_SKUPINY.map(([nazev, ids]) => {
    const radky = ids.filter((id) => nakup[id]).map((id) => {
      if (!D.NAKUP_NAZEV[id]) throw new Error('Chybí název v nákupním seznamu: ' + id);
      return '            <div>' + esc(D.NAKUP_NAZEV[id]) + ' <b>' + esc(nakupMnozstvi(id)) + '</b></div>';
    }).join('\n');
    return '        <div class="cat">' + esc(nazev) + '</div>\n        <div class="grid2">\n' + radky + '\n        </div>';
  }).join('\n');

  // ---- čísla do textů varianty / zvětšit-zmenšit (spočítaná, ne opsaná) -------------------------
  const porceP = [], porceC = {};
  plan.forEach((d) => d.meals.forEach((m) => m.items.forEach((it) => {
    if (it.role === 'P' && /kureci|kruti|losos|hovezi|treska/.test(it.id) && m.lbl !== 'Snídaně') porceP.push(it.g);
    if (it.role === 'C') (porceC[it.id] = porceC[it.id] || []).push(it.g);
  })));
  const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const kcal100 = (id) => mac(id, 100).kcal;
  const ekv = (zId, zG, naId, s) => Math.round((mac(zId, zG).kcal / kcal100(naId) * 100) / s) * s;
  const minusDny = plan.filter((d) => !d.flex).map((d) => {
    let k = 0;
    d.meals.forEach((m) => m.items.forEach((it) => {
      if (it.role === 'C' && (m.lbl === 'Oběd' || m.lbl === 'Večeře')) k += mac(it.id, it.g).kcal / 2;
      if (D.MINUS_TUK.test(it.id)) k += mac(it.id, it.g).kcal;
    }));
    return k;
  });
  const prumer = (k) => plan.reduce((s, d) => s + d.tot[k], 0) / plan.length;
  // Tuk v plánu pro větu o tucích: průměr dní bez flex dne, g na 5, podíl z kcal na celé procento.
  const bezFlex = plan.filter((d) => !d.flex);
  const tukG = bezFlex.reduce((s, d) => s + d.tot.f, 0) / bezFlex.length;

  const ctx = { D, REF_T, CIL, plan, mac, kcal100, ekv, median, porceP, porceC, minusDny, prumer, cz, r0, esc };
  const nahrady = Object.assign({
    '{{NAKUP}}': nakupHtml,
    '{{KCAL}}': cz(D.KCAL_CIL),
    '{{REF_KCAL}}': cz(REF_T.kcal),
    '{{REF_VAHA}}': String(D.REF.weight),
    '{{REF_VYSKA}}': String(D.REF.height),
    '{{REF_VEK}}': String(D.REF.age),
    '{{P_TYP}}': String(median(porceP)),
    '{{B_PRUMER}}': String(r0(prumer('p'))),
    '{{T_PRUMER}}': String(Math.round(tukG / 5) * 5),
    // Procento ze ZAOKROUHLENÝCH gramů a kcal z cíle, ať si to čtenář přepočítá (50 × 9 / 1 500 = 30 %).
    '{{T_PROCENT}}': String(r0((Math.round(tukG / 5) * 5 * 9) / D.KCAL_CIL * 100)),
    '{{MINUS_MIN}}': String(Math.round(Math.min(...minusDny) / 10) * 10),
    '{{MINUS_MAX}}': String(Math.round(Math.max(...minusDny) / 10) * 10),
    '{{LOSOS_KCAL}}': String(r0(kcal100('losos'))), '{{KURE_KCAL}}': String(r0(kcal100('kureci-prsa'))),
  }, D.DNY_BLOKY(plan, dayHtml), D.NAHRADY(ctx));

  let html = fs.readFileSync(path.join(__dirname, D.SABLONA), 'utf8');
  for (const [k, v] of Object.entries(nahrady)) html = html.split(k).join(v);
  const zbyle = html.match(/\{\{[A-Z_0-9]+\}\}/g);
  if (zbyle) throw new Error('Nenahrazené značky v šabloně: ' + zbyle.join(', '));
  if (html.includes(String.fromCharCode(0x2014))) throw new Error('Dlouhá pomlčka ve výstupním HTML');
  fs.writeFileSync(path.join(__dirname, D.VYSTUP + '.html'), html);

  // ---- výpočet pro kontrolu, pro stránku a pro OG obrázek -------------------------------------
  const zkr = { 'Pondělí': 'Po', 'Úterý': 'Út', 'Středa': 'St', 'Čtvrtek': 'Čt', 'Pátek': 'Pá', 'Sobota': 'So', 'Neděle': 'Ne' };
  const vypocet = {
    zdroj: 'assets/food-db.json + makro-plan-extra-potraviny.js + assets/meal-gen.js (MealGen.macrosFor, MealGen.computeTargets)',
    ref: D.REF, refTargets: REF_T, cil: CIL,
    extra: EXTRA.filter((f) => nakup[f.id]).map((f) => ({ id: f.id, per100: f.per100, zdroj: f.zdroj })),
    plan: plan.map((d) => ({
      name: d.name, zkratka: zkr[d.name], tag: d.tag, flex: d.flex, faktory: d.fak,
      tot: { kcal: +d.tot.kcal.toFixed(1), p: +d.tot.p.toFixed(1), c: +d.tot.c.toFixed(1), f: +d.tot.f.toFixed(1), fib: +d.tot.fib.toFixed(1) },
      meals: d.meals.map((m) => ({
        lbl: m.lbl, title: m.title, og: m.og, text: jidloText(m), mac: macText(m.t),
        t: { kcal: +m.t.kcal.toFixed(1), p: +m.t.p.toFixed(1), c: +m.t.c.toFixed(1), f: +m.t.f.toFixed(1) },
        items: m.items.map((it) => ({ id: it.id, g: it.g, vychozi: it.g0, role: it.role })),
      })),
    })),
    nakup,
    varovani,
  };
  fs.writeFileSync(path.join(__dirname, D.VYSTUP + '-vypocet.json'), JSON.stringify(vypocet, null, 2) + '\n');

  // ---- landing stránka: ukázkový den + náhled týdne -------------------------------------------
  const STRANKA = path.join(ROOT, D.STRANKA);
  let st = fs.readFileSync(STRANKA, 'utf8');
  function nahradBlok(src, znacka, obsah) {
    const a = '<!-- ' + znacka + ':START (generuje _zdroje/leadmagnet/' + D.SKRIPT + ', rukou nepsat) -->';
    const b = '<!-- ' + znacka + ':KONEC -->';
    const i = src.indexOf(a), j = src.indexOf(b);
    if (i < 0 || j < 0) throw new Error('V ' + D.STRANKA + ' chybí značky ' + znacka);
    return src.slice(0, i + a.length) + '\n' + obsah + src.slice(j);
  }
  const ukazka = plan[0];
  const kartyDne = ukazka.meals.map((m) => '            <div class="meal"><div class="lab">' + esc(m.lbl.toUpperCase()) + '</div><div class="name">'
    + esc(m.title) + '</div><div class="kc">~' + cz(r0(m.t.kcal)) + ' kcal · ' + r0(m.t.p) + ' g B</div></div>').join('\n');
  st = nahradBlok(st, D.ZNACKA + '-DEN', kartyDne + '\n            ');
  const nahled = plan.slice(0, 5).map((d) => {
    const hlavni = d.meals.filter((m) => m.lbl === 'Oběd' || m.lbl === 'Večeře').map((m) => m.og);
    return '                    <div class="day"><span class="meal-txt"><b>' + zkr[d.name] + '</b> ' + esc(hlavni.join(' · ')) + '</span><span class="kc">'
      + '~' + cz(Math.round(d.tot.kcal / 50) * 50) + ' kcal</span></div>'; // jen kcal, zaokrouhleno; přesná čísla jsou v PDF
  }).join('\n');
  st = nahradBlok(st, D.ZNACKA + '-NAHLED', nahled + '\n                    ');
  if (D.ZNACKA_POZNAMKA) st = nahradBlok(st, D.ZNACKA + '-POZNAMKA', D.ZNACKA_POZNAMKA(ctx) + '\n        ');
  // Soubor má konce řádků CRLF: vložené řádky sjednotit, ať diff neukazuje smíšené konce.
  if (st.includes('\r\n')) st = st.replace(/\r?\n/g, '\r\n');
  fs.writeFileSync(STRANKA, st);

  // ---- výpis ------------------------------------------------------------------------------------
  for (const d of plan) {
    console.log(d.name.padEnd(8), 'kcal', r0(d.tot.kcal), 'B', r0(d.tot.p), 'S', r0(d.tot.c), 'T', r0(d.tot.f),
      '| faktory P', d.fak.P.toFixed(2), 'C', d.fak.C.toFixed(2), 'T', d.fak.T.toFixed(2));
    for (const m of d.meals) console.log('   ', m.lbl.padEnd(8), macText(m.t).padEnd(34), '|', jidloText(m));
  }
  console.log('cíl', JSON.stringify(CIL), 'ref engine', REF_T.kcal, 'kcal, B', REF_T.protein, 'T', REF_T.fat);
  const nahradyVypis = {};
  for (const [k, v] of Object.entries(nahrady)) if (!/DNY|DEN_|NAKUP/.test(k)) nahradyVypis[k] = v;
  console.log(JSON.stringify(nahradyVypis));
  if (varovani.length) console.log('VAROVÁNÍ:\n' + varovani.join('\n'));
  return { plan, varovani };
}

module.exports = { build, mac, kcal100: (id) => mac(id, 100).kcal };
