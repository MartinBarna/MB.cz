#!/usr/bin/env node
/* apply-article-theme.js — KROK 2: theme-light.css na všech 149 HTML v clanky/.
 *  1) theme-light.css?v=l2 v <head> (za overlay CSS)
 *  2) znovu ZA arena.css na konci <body>
 *  3) bump l1 → l2 i na 7 vlajkových stránkách z kroku 1
 * Dry: node scripts/apply-article-theme.js --dry
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry');
const LIGHT_HREF = '/assets/theme-light.css?v=l2';
const LIGHT_LINK = '<link rel="stylesheet" href="' + LIGHT_HREF + '">';

function walkHtml(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.')) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkHtml(p, out);
    else if (ent.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function relPosix(abs) {
  return path.relative(ROOT, abs).split(path.sep).join('/');
}

function bumpLightVer(html) {
  return html.replace(/\/assets\/theme-light\.css\?v=l\d+/g, LIGHT_HREF);
}

function ensureLightHead(html) {
  html = bumpLightVer(html);
  if (html.indexOf('theme-light.css') !== -1) return { html, inserted: false };
  const headClose = html.lastIndexOf('</head>');
  if (headClose === -1) return { html, inserted: false, noHead: true };
  const indent = html[headClose - 1] === '\n' ? '    ' : '';
  return {
    html: html.slice(0, headClose) + indent + LIGHT_LINK + '\n' + html.slice(headClose),
    inserted: true,
  };
}

function ensureLightAfterArena(html) {
  html = bumpLightVer(html);
  const arenaRe = /<link rel="stylesheet" href="\/assets\/arena\.css\?v=[^"]+"\s*\/?>/;
  if (!arenaRe.test(html)) return { html, appended: false, noArena: true };
  if (/arena\.css\?v=[^"]+"\s*\/?>\s*<link rel="stylesheet" href="\/assets\/theme-light\.css/.test(html)) {
    return { html, appended: false };
  }
  return {
    html: html.replace(arenaRe, function (m) { return m + LIGHT_LINK; }),
    appended: true,
  };
}

const clankyDir = path.join(ROOT, 'clanky');
const files = walkHtml(clankyDir, []);
const flagship = [
  path.join(ROOT, 'index.html'),
  path.join(ROOT, 'videokurz.html'),
  path.join(ROOT, 'koucing', 'index.html'),
  path.join(ROOT, 'konzultace', 'index.html'),
  path.join(ROOT, 'poukaz', 'index.html'),
  path.join(ROOT, 'tvuj-coach', 'index.html'),
];

const stats = { scanned: 0, changed: 0, lightHead: 0, lightArena: 0, bumped: 0, noArena: [] };
const changed = [];

function apply(abs, isArticle) {
  let html = fs.readFileSync(abs, 'utf8');
  const orig = html;
  stats.scanned++;

  if (isArticle) {
    const head = ensureLightHead(html);
    html = head.html;
    if (head.inserted) stats.lightHead++;
    const arena = ensureLightAfterArena(html);
    html = arena.html;
    if (arena.appended) stats.lightArena++;
    if (arena.noArena) stats.noArena.push(relPosix(abs));
  } else {
    const before = html;
    html = bumpLightVer(html);
    if (html !== before) stats.bumped++;
  }

  if (html !== orig) {
    stats.changed++;
    changed.push(relPosix(abs));
    if (!DRY) fs.writeFileSync(abs, html, 'utf8');
  }
}

for (const abs of files) apply(abs, true);
for (const abs of flagship) apply(abs, false);

const scriptPath = path.join(ROOT, 'scripts', 'apply-public-theme.js');
let script = fs.readFileSync(scriptPath, 'utf8');
const scriptOrig = script;
script = script.replace(/theme-light\.css\?v=l\d+/g, 'theme-light.css?v=l2');
if (script !== scriptOrig && !DRY) fs.writeFileSync(scriptPath, script, 'utf8');

console.log(DRY ? 'DRY RUN' : 'ZAPSANO');
console.log('scanned:', stats.scanned);
console.log('changed:', stats.changed);
console.log('theme-light in head (new):', stats.lightHead);
console.log('theme-light za arena (new):', stats.lightArena);
console.log('flagship bump l2:', stats.bumped);
if (stats.noArena.length) console.log('NO ARENA:', stats.noArena.join(', '));
if (DRY) console.log('sample:', changed.slice(0, 8).join(', '));
