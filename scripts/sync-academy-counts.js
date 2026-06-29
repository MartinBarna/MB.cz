#!/usr/bin/env node
/* sync-academy-counts.js — jediný zdroj pravdy pro počty na prodejních stránkách.
 *
 * Spočítá kanonické počty z filesystému (Academy lekce/moduly, videokurz videa) a
 * přepíše zastaralé počty v landing/prodejních stránkách tak, aby vždy seděly.
 * Bezpečné: nahrazuje PŘESNĚ předchozí zaznamenané číslo (ze scripts/.academy-counts.json),
 * takže nehrozí kolize mezi 212 lekcemi Academy a 182 videi videokurzu.
 *
 * Pusť po každém přidání/odebrání lekce, modulu nebo videa:  node scripts/sync-academy-counts.js
 * (Viz CLAUDE.md — dělá se to automaticky, bez připomenutí.)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STATE = path.join(__dirname, '.academy-counts.json');

function dirs(glob) {
  // glob = adresář + prefix, vrátí počet podadresářů začínajících prefixem
  const [base, prefix] = glob;
  try {
    return fs.readdirSync(path.join(ROOT, base), { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name.startsWith(prefix)).map(d => d.name);
  } catch (e) { return []; }
}

// ---- kanonické počty z filesystému ----
const lessonDirs = dirs(['akademie/studium', 'm']).filter(n => /^m\d+-l\d+$/.test(n));
const academyLessons = lessonDirs.length;
const academyModules = new Set(lessonDirs.map(n => n.match(/^m\d+/)[0])).size;
const videokurzLessons = dirs(['akademie/videokurz', 'v']).filter(n => /^v\d+$/.test(n)).length;

const canonical = { academyLessons, academyModules, videokurzLessons };

// ---- soubory prodejních / landing stránek, kde počty žijí ----
const FILES = [
  'akademie/index.html',
  'akademie/objednavka/index.html',
  'akademie/videokurz/index.html',
  'akademie/prihlaseni/index.html',
  'akademie/moje/index.html',
  'akademie/studium/index.html',
  'akademie/_videokurz/build.js',
  'assets/academy-upsell.js',
  'videokurz.html',
];

// metrika -> jednotkový "suffix", na který kotvíme (přepisujeme '<num> <suffix>')
const UNITS = {
  academyLessons: 'lekc',   // 212 lekcí / lekcím / lekcích
  academyModules: 'modul',  // 20 modulů / moduly / modul
  videokurzLessons: 'vide', // 182 videí / 182 video lekcí
};

let prev = {};
try { prev = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) { prev = {}; }

let totalEdits = 0;
const report = [];

for (const key of Object.keys(canonical)) {
  const oldN = prev[key];
  const newN = canonical[key];
  if (oldN == null) { report.push(`  ${key}: baseline ${newN}`); continue; }
  if (oldN === newN) { report.push(`  ${key}: ${newN} (beze změny)`); continue; }
  const unit = UNITS[key];
  let fileHits = 0;
  for (const rel of FILES) {
    const fp = path.join(ROOT, rel);
    let txt;
    try { txt = fs.readFileSync(fp, 'utf8'); } catch (e) { continue; }
    const re = new RegExp('\\b' + oldN + '(?=\\s*' + unit + ')', 'g');
    const updated = txt.replace(re, String(newN));
    if (updated !== txt) { fs.writeFileSync(fp, updated); const c = (txt.match(re) || []).length; fileHits += c; totalEdits += c; }
  }
  report.push(`  ${key}: ${oldN} -> ${newN}  (${fileHits} výskytů opraveno)`);
}

fs.writeFileSync(STATE, JSON.stringify(canonical, null, 2) + '\n');

console.log('Kanonické počty:');
console.log(report.join('\n'));
console.log(`\nCelkem opraveno výskytů: ${totalEdits}`);
console.log('Stav uložen do scripts/.academy-counts.json');
