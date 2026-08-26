#!/usr/bin/env node
/* apply-public-theme.js — KROK 1 světlého režimu na veřejný web (mimo akademie/).
 *  1) theme-boot.js hned za <meta charset> (FOUC, sync, bez defer)
 *  2) bump scroll-top.js ?v= → g9
 *  3) bump overlay CSS (marketing-dark r4, override r3, arena a7)
 *  4) na 7 vlajkových stránkách: theme-light.css v <head> a za arena.css
 * Dry: node scripts/apply-public-theme.js --dry
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry');

const SKIP_DIR = new Set([
  'akademie', '_zdroje', 'go', '_zaloha', 'node_modules', '.git',
  '_cursor-logs', 'assets',
]);

const BOOT = '<script src="/assets/theme-boot.js"></script>';
const LIGHT_HREF = '/assets/theme-light.css?v=l1';
const LIGHT_LINK = '<link rel="stylesheet" href="' + LIGHT_HREF + '">';

const FLAGSHIP = new Set([
  'index.html',
  path.join('koucing', 'index.html'),
  path.join('konzultace', 'index.html'),
  path.join('poukaz', 'index.html'),
  path.join('tvuj-coach', 'index.html'),
  'videokurz.html',
  path.join('clanky', 'index.html'),
]);

function walkHtml(dir, out) {
  let names;
  try { names = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) { return out; }
  for (const ent of names) {
    if (ent.name.startsWith('.')) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIR.has(ent.name)) continue;
      walkHtml(p, out);
    } else if (ent.name.endsWith('.html')) {
      out.push(p);
    }
  }
  return out;
}

function relPosix(abs) {
  return path.relative(ROOT, abs).split(path.sep).join('/');
}

function isFlagship(abs) {
  const r = path.relative(ROOT, abs);
  return FLAGSHIP.has(r) || FLAGSHIP.has(r.split(path.sep).join(path.posix.sep));
}

function insertBoot(html) {
  if (html.indexOf('theme-boot.js') !== -1) return { html, inserted: false };
  if (html.indexOf('src="/assets/ba-theme.js"') !== -1) {
    return { html, inserted: false, skipBa: true };
  }
  const re = /<meta\s+charset=["'][^"']+["']\s*\/?>/i;
  if (!re.test(html)) return { html, inserted: false, noCharset: true };
  return { html: html.replace(re, function (m) { return m + '\n    ' + BOOT; }), inserted: true };
}

function bumpScrollTop(html) {
  return html.replace(/\/assets\/scroll-top\.js\?v=g\d+/g, '/assets/scroll-top.js?v=g9');
}

function bumpOverlays(html) {
  let next = html;
  next = next.replace(/\/assets\/marketing-dark\.css\?v=r\d+/g, '/assets/marketing-dark.css?v=r4');
  next = next.replace(/\/assets\/app-brand-override\.css\?v=r\d+/g, '/assets/app-brand-override.css?v=r3');
  next = next.replace(/\/assets\/arena\.css\?v=a\d+/g, '/assets/arena.css?v=a7');
  return next;
}

function ensureLightHead(html) {
  if (html.indexOf('theme-light.css') !== -1) {
    if (/theme-light\.css\?v=l\d+/.test(html) && html.indexOf(LIGHT_HREF) === -1) {
      html = html.replace(/\/assets\/theme-light\.css\?v=l\d+/g, LIGHT_HREF);
    }
    return { html, inserted: false };
  }
  const headClose = html.lastIndexOf('</head>');
  if (headClose === -1) return { html, inserted: false, noHead: true };
  const indent = html[headClose - 1] === '\n' ? '    ' : '';
  const next = html.slice(0, headClose) + indent + LIGHT_LINK + '\n' + html.slice(headClose);
  return { html: next, inserted: true };
}

function ensureLightAfterArena(html) {
  const arenaRe = /<link rel="stylesheet" href="\/assets\/arena\.css\?v=[^"]+">/;
  if (!arenaRe.test(html)) return { html, appended: false };
  if (/arena\.css\?v=[^"]+">\s*<link rel="stylesheet" href="\/assets\/theme-light\.css/.test(html)) {
    return { html, appended: false };
  }
  return { html: html.replace(arenaRe, function (m) { return m + LIGHT_LINK; }), appended: true };
}

const files = walkHtml(ROOT, []);
const stats = {
  scanned: files.length,
  changed: 0,
  boot: 0,
  skipBa: 0,
  noCharset: 0,
  scroll: 0,
  overlays: 0,
  lightHead: 0,
  lightArena: 0,
};

const changed = [];
const noCharset = [];

for (const abs of files) {
  let html = fs.readFileSync(abs, 'utf8');
  const orig = html;
  const flag = isFlagship(abs);

  const boot = insertBoot(html);
  html = boot.html;
  if (boot.inserted) stats.boot++;
  if (boot.skipBa) stats.skipBa++;
  if (boot.noCharset) { stats.noCharset++; noCharset.push(relPosix(abs)); }

  const beforeScroll = html;
  html = bumpScrollTop(html);
  if (html !== beforeScroll) stats.scroll++;

  const beforeOv = html;
  html = bumpOverlays(html);
  if (html !== beforeOv) stats.overlays++;

  if (flag) {
    const head = ensureLightHead(html);
    html = head.html;
    if (head.inserted) stats.lightHead++;
    const arena = ensureLightAfterArena(html);
    html = arena.html;
    if (arena.appended) stats.lightArena++;
  }

  if (html !== orig) {
    stats.changed++;
    changed.push(relPosix(abs));
    if (!DRY) fs.writeFileSync(abs, html, 'utf8');
  }
}

console.log(DRY ? 'DRY RUN' : 'ZAPSANO');
console.log('scanned public html:', stats.scanned);
console.log('changed:', stats.changed);
console.log('theme-boot inserted:', stats.boot);
console.log('skipped (už ba-theme.js):', stats.skipBa);
console.log('scroll-top → g9:', stats.scroll);
console.log('overlay css bump:', stats.overlays);
console.log('theme-light in head (7):', stats.lightHead);
console.log('theme-light za arena (7):', stats.lightArena);
if (noCharset.length) console.log('NO CHARSET:', noCharset.join(', '));
if (DRY) console.log('flagship changed sample:', changed.filter(function (f) {
  return /^(index\.html|videokurz\.html|koucing\/|konzultace\/|poukaz\/|tvuj-coach\/|clanky\/index)/.test(f);
}).join(', '));
