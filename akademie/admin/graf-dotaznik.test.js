// Test oprav admin grafu na scenarich, ktere nasla revize.
const fs = require('fs');
const CESTA = 'C:/Users/fitne/mb-wt-sef66-0914/akademie/admin/index.html';
const html = fs.readFileSync(CESTA, 'utf8');

function vytahni(jmeno) {
  const re = new RegExp('function ' + jmeno + '[\\s\\S]*?\\n    \\}');
  const m = html.match(re);
  if (!m) throw new Error('nenasel funkci ' + jmeno);
  return m[0];
}

const kod = ['kliNum', 'fmtDay', 'kdIntakeBod', 'kdSlouceno', 'kdBody', 'kdDlazdice'].map(vytahni).join('\n');
const tovarna = new Function('KD_METRIKY', 'KDV', 'esc',
  kod + '; return {kdSlouceno:kdSlouceno, kdBody:kdBody, kdDlazdice:kdDlazdice, kdIntakeBod:kdIntakeBod};');

const M = [
  { id: 'weight', nazev: 'Váha', jed: 'kg', dolu: true, cil: null, get: function (r) { const v = r.weight; return (v == null || v === '') ? null : Number(v); } },
  { id: 'pas', nazev: 'Pas', jed: 'cm', dolu: true, cil: null, get: function (r) { const v = (r.measurements || {}).pas; return (v == null || v === '') ? null : Number(v); } },
];
const f = tovarna(M, { okno: 90, metrika: 'weight' }, (s) => String(s));
const text = (h) => h.replace(/<[^>]+>/g, ' | ').replace(/\s*\|\s*(\|\s*)+/g, ' | ').trim();

let chyb = 0;
function overit(popis, podminka) {
  console.log((podminka ? '  OK   ' : '  CHYBA') + ' ' + popis);
  if (!podminka) chyb++;
}

console.log('=== 1. NALEZ REVIZE: dotaznik novejsi nez posledni report ===');
const reps1 = [
  { report_date: '2026-08-24', weight: 72.0, measurements: { pas: 80 } },
  { report_date: '2026-08-31', weight: 71.4, measurements: { pas: 79 } },
];
const int1 = { created_at: '2026-09-01T09:00:00Z', data: { vaha: '73', mira_pas: '81' } };
const rada1 = f.kdSlouceno(reps1, int1);
const dl1 = text(f.kdDlazdice(rada1, M[0], 90, {}));
console.log('  rada:', rada1.map((x) => x.report_date + (x.source ? '(dotaznik)' : '')).join(' | '));
console.log('  dlazdice vaha:', dl1);
overit('ukazuje 71,4 z reportu, ne 73 z dotazniku', dl1.indexOf('71,4') >= 0 && dl1.indexOf('73') < 0);
overit('zmena je zaporna (klient hubne)', dl1.indexOf('−0,6') >= 0 || dl1.indexOf('-0,6') >= 0);

console.log('=== 2. JAKUB: dotaznik i report ze stejneho dne, report bez mer ===');
const reps2 = [
  { report_date: '2026-09-01', weight: 64.5, measurements: { pas: null, boky: null } },
  { report_date: '2026-09-14', weight: 64.0, measurements: { pas: 74 } },
];
const int2 = { created_at: '2026-09-01T09:00:00Z', data: { vaha: '64', mira_pas: '75', mira_boky: '89' } };
const rada2 = f.kdSlouceno(reps2, int2);
const bodyPas = f.kdBody(rada2, M[1], 90);
console.log('  body pasu:', bodyPas.map((p) => p.datum + '=' + p.v).join(', '));
overit('pas z dotazniku se doplnil do reportu stejneho dne (2 body)', bodyPas.length === 2 && bodyPas[0].v === 75);
overit('vaha z reportu zustala (64,5, ne 64 z dotazniku)', f.kdBody(rada2, M[0], 90)[0].v === 64.5);
overit('puvodni data se NEZMENILA (zadna mutace)', reps2[0].measurements.pas === null);

console.log('=== 3. Klient jen s dotaznikem, zadny report ===');
const rada3 = f.kdSlouceno([], { created_at: '2026-09-01T09:00:00Z', data: { vaha: '70' } });
const dl3 = text(f.kdDlazdice(rada3, M[0], 90, {}));
console.log('  dlazdice:', dl3);
overit('ukaze 70 kg a oznaci, ze je z dotazniku', dl3.indexOf('70') >= 0 && dl3.indexOf('dotazník') >= 0);

console.log('=== 4. Bezny pripad: dotaznik PRED prvnim reportem ===');
const reps4 = [
  { report_date: '2026-09-07', weight: 69.1, measurements: { pas: 88 } },
  { report_date: '2026-09-14', weight: 68.6, measurements: { pas: 87 } },
];
const int4 = { created_at: '2026-08-31T10:00:00Z', data: { vaha: '69.6', mira_pas: '89' } };
const rada4 = f.kdSlouceno(reps4, int4);
const dl4 = text(f.kdDlazdice(rada4, M[0], 90, {}));
console.log('  body vahy:', f.kdBody(rada4, M[0], 90).map((p) => p.datum + '=' + p.v).join(', '));
console.log('  dlazdice:', dl4);
overit('graf zacina dotaznikem 31. 8.', f.kdBody(rada4, M[0], 90)[0].datum === '2026-08-31');
overit('dlazdice ukazuje posledni REPORT 68,6', dl4.indexOf('68,6') >= 0);
overit('zmena se pocita od dotazniku (-1 kg)', dl4.indexOf('1 kg') >= 0);

console.log('=== 5. Zadny dotaznik / prazdny / nesmyslne datum ===');
overit('bez dotazniku vrati puvodni reporty', f.kdSlouceno(reps4, null).length === 2);
overit('prazdna data nespadnou', f.kdSlouceno(reps4, { created_at: '2026-08-31', data: {} }).length === 2);
overit('nesmyslne datum nespadne', f.kdSlouceno(reps4, { created_at: 'nesmysl', data: { vaha: '70' } }).length === 2);

console.log(chyb ? '\nNEPROSLO: ' + chyb + ' kontrol' : '\nVSECHNY KONTROLY PROSLY');
process.exit(chyb ? 1 : 0);
