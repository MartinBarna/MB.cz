#!/usr/bin/env node
// =============================================================================
// CO SE ZTRATILO PŘI PŘEPISU INFOGRAFIK DO NOVÉHO KABÁTU
//
// Porovná text NAŠICH scénářů (_zdroje/infografiky/<slug>.json) proti textu
// PŮVODNÍCH oranžových infografik, vytěženému z OCR Google Disku
// (_Claude-dokumenty/2026-07-31_infografiky-texty/<tema>.md).
//
// Porovnává se na úrovni CELÉHO TÉMATU, ne slide po slidu. Věta, která se jen
// přesunula na jiný slide, není ztráta a nemá dělat falešný poplach.
//
// Spuštění: node scripts/porovnat-infografiky-se-starymi.mjs
//           node scripts/porovnat-infografiky-se-starymi.mjs krevni-testy
// =============================================================================
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.slice(1)), '..');
const NASE = path.join(ROOT, '_zdroje/infografiky');
const STARE = 'C:/Users/fitne/Desktop/_Claude-dokumenty/2026-07-31_infografiky-texty';

// Řádky, které OCR vidí na KAŽDÉM slidu (hlavička, patička, logo) nebo které si
// vymyslelo z vodoznaku. Nejsou to texty infografiky, do porovnání nepatří.
const SUM = [
  /^image labels:/i, /^martinbarna\.cz$/i, /^martin barna$/i, /^online výživa/i,
  /^výživa\s*[.·-]\s*věda/i, /^pohyb\s*[.·-]?\s*data/i, /^výživa\s*[-.]\s*mozek/i,
  /^posuň dál$/i, /^\d+\s*\/\s*\d+$/, /^mb$/i, /^⚫/, /^\s*$/,
  // vodoznaky a nesmysly, které OCR do obrázku přimyslelo
  /^(suplex city|scotiabank|asiamoney|nasdaq|bloomberg|reuters)/i,
];

const bezDiakritiky = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const sjednotit = (s) => bezDiakritiky(String(s))
  .replace(/[„""'']/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ')
  .toLowerCase().trim();

/** Všechny textové hodnoty ze scénáře, zbavené HTML. */
function nasText(scenar) {
  const kusy = [];
  const projit = (v) => {
    if (typeof v === 'string') kusy.push(v);
    else if (Array.isArray(v)) v.forEach(projit);
    else if (v && typeof v === 'object') Object.values(v).forEach(projit);
  };
  projit(scenar);
  return kusy.join(' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"');
}

/** Řádky původní infografiky, bez hlaviček, patiček a OCR šumu. */
function stareRadky(md) {
  return md.split('\n')
    .filter((r) => !r.startsWith('#'))
    .map((r) => r.replace(/\\/g, '').trim())
    .filter((r) => r.length > 2 && !SUM.some((re) => re.test(r)));
}

const slova = (s) => sjednotit(s).split(/[^a-z0-9á-ž]+/).filter((w) => w.length >= 4);

// ⛔ Chybějící řádek ≠ chybějící obsah. Musí se to rozdělit, jinak je to číslo
// k ničemu: „ZDROJ" je popisek rámečku, „DOI: 10.1186/…" je ztracená citace.
// Změřeno 31. 7.: bez tohohle dělení vyšlo 1435 „ztrát", ale velká část byly
// popisky boxů a přeformulované věty, ne zmizelý obsah.
const CASOPIS = /\b(jama|cell|lancet|bmj|nature|obesity|sports medicine|nutrients|sleep|circulation|diabetes|cochrane|position statement|meta-?analyza|journal|physiol|nutrition|psychiatry|network open|jissn|eaaci|csaci|aaaai|efsa|examine)\b/i;

function zatridit(radek) {
  const r = radek.trim();
  if (/10\.\d{4,}\//.test(r)) return 'zdroj';
  if (/et al\.|a kol\./i.test(r) || CASOPIS.test(bezDiakritiky(r))) return 'zdroj';
  // vysvětlivka pod čarou: „IgG = protilátka, kterou…"
  if (/\s=\s/.test(r)) return 'vysvetlivka';
  // samostatné číslo nebo číslo s jednotkou, tedy rozbitý statistický blok
  if (/^\d[\d\s.,%]*$/.test(r) || (/\d/.test(r) && slova(r).length <= 6)) return 'cislo';
  const pismena = r.replace(/[^A-Za-zÁ-Žá-ž]/g, '');
  if (pismena.length && pismena === pismena.toUpperCase() && r.split(/\s+/).length <= 6) return 'popisek';
  return 'preformulovano';
}

/** Kolik procent slov toho řádku najdu kdekoli v našem textu tématu. */
function pokryti(radek, nasSlovnik) {
  const w = slova(radek);
  if (!w.length) return 1;
  return w.filter((x) => nasSlovnik.has(x)).length / w.length;
}

// Mapování našich slugů na názvy vytěžených souborů (jména složek na Disku
// se místy liší). Klíč = náš slug, hodnota = soubor bez .md.
const RUCNE = {
  'ultra-zpracovana-jidla': 'ultra-zpracovana-jidla-jed',
  'vysoky-vo2max': 'vysoky-vo2max-delsi-zivot',
};

const dostupne = readdirSync(STARE).filter((f) => f.endsWith('.md') && !f.startsWith('_'))
  .map((f) => f.replace('.md', ''));

const jen = process.argv[2];
const nase = readdirSync(NASE).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''))
  .filter((s) => !jen || s === jen);

const report = [];
const bezOriginalu = [];
let temat = 0, ztracenychRadku = 0, doiPryc = 0;

for (const slug of nase) {
  const soubor = RUCNE[slug] || (dostupne.includes(slug) ? slug : null);
  if (!soubor) { bezOriginalu.push(slug); continue; }
  temat++;

  const scenar = JSON.parse(readFileSync(path.join(NASE, slug + '.json'), 'utf8'));
  const nasCely = nasText(scenar);
  const nasSlovnik = new Set(slova(nasCely));
  const nasNorm = sjednotit(nasCely);

  const radky = stareRadky(readFileSync(path.join(STARE, soubor + '.md'), 'utf8'));

  const chybi = [];
  for (const r of radky) {
    const p = pokryti(r, nasSlovnik);
    if (p < 0.5) chybi.push({ radek: r, p, druh: zatridit(r) });
  }

  // DOI se hledá zvlášť. Je to nejtvrdší důkaz zdroje a nejsnáz se ztratí.
  const doi = [...readFileSync(path.join(STARE, soubor + '.md'), 'utf8')
    .matchAll(/10\.\d{4,}\/[^\s)\]]+/g)].map((m) => m[0]);
  const doiChybi = doi.filter((d) => !nasNorm.includes(sjednotit(d)));

  ztracenychRadku += chybi.length;
  doiPryc += doiChybi.length;
  report.push({ slug, soubor, radku: radky.length, chybi, doi, doiChybi });
}

// ---- výpis ----
const DRUHY = ['zdroj', 'vysvetlivka', 'cislo', 'popisek', 'preformulovano'];
const NAZVY = {
  zdroj: 'Citace a zdroje (DOI, časopis, autor a rok)',
  vysvetlivka: 'Vysvětlivky pod čarou („IgG = …")',
  cislo: 'Čísla a statistické bloky',
  popisek: 'Popisky rámečků a čísla kapitol',
  preformulovano: 'Přeformulované věty (obsah nejspíš zůstal, změnil se hlas)',
};
const soucet = (d) => report.reduce((n, t) => n + t.chybi.filter((c) => c.druh === d).length, 0);
const tvrde = (t) => t.chybi.filter((c) => c.druh === 'zdroj' || c.druh === 'vysvetlivka' || c.druh === 'cislo').length;

const out = [];
out.push('# Co se ztratilo při přepisu infografik');
out.push('');
out.push(`Porovnáno **${temat} témat**. Vlevo původní oranžová verze (OCR z Disku), vpravo náš scénář.`);
out.push('Porovnává se celé téma, ne slide po slidu, takže přesunutá věta se jako ztráta nehlásí.');
out.push('');
out.push('| Druh | Kolik |');
out.push('|---|---|');
for (const d of DRUHY) out.push(`| ${NAZVY[d]} | ${soucet(d)} |`);
out.push(`| **Z toho tvrdá ztráta obsahu** | **${soucet('zdroj') + soucet('vysvetlivka') + soucet('cislo')}** |`);
out.push('');
out.push(`Chybějících DOI: **${doiPryc}**.`);
if (bezOriginalu.length) out.push(`Bez staré verze (nová témata): ${bezOriginalu.join(', ')}.`);
out.push('');

for (const t of report.sort((a, b) => tvrde(b) - tvrde(a))) {
  const n = tvrde(t);
  const znak = n === 0 ? '✅' : n <= 5 ? '🟡' : '🔴';
  out.push(`## ${znak} ${t.slug}  (tvrdá ztráta: ${n})`);
  if (t.doiChybi.length) out.push(`\n**Chybí DOI:** ${t.doiChybi.join(', ')}`);
  for (const d of DRUHY) {
    const v = t.chybi.filter((c) => c.druh === d);
    if (!v.length) continue;
    out.push(`\n**${NAZVY[d]}**`);
    for (const c of v) out.push(`- ${Math.round(c.p * 100)}% · ${c.radek}`);
  }
  out.push('');
}

const cil = path.join(STARE, '_ZTRATY.md');
writeFileSync(cil, out.join('\n'), 'utf8');
console.log(`Témat: ${temat} · řádků bez obdoby: ${ztracenychRadku} · chybějících DOI: ${doiPryc}`);
for (const d of DRUHY) console.log('  ' + String(soucet(d)).padStart(4) + '  ' + NAZVY[d]);
console.log('  ---- tvrdá ztráta obsahu: ' + (soucet('zdroj') + soucet('vysvetlivka') + soucet('cislo')));
if (bezOriginalu.length) console.log(`Bez staré verze: ${bezOriginalu.join(', ')}`);
console.log('Report: ' + cil);
console.log('');
for (const t of report.sort((a, b) => tvrde(b) - tvrde(a))) {
  console.log(String(tvrde(t)).padStart(3) + '  ' + t.slug);
}
