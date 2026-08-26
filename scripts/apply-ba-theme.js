#!/usr/bin/env node
/* apply-ba-theme.js — mechanicky zapojí světlý režim na členské stránky akademie/.
 *
 * Vzor (stejný jako u moje/klient/check-in):
 *   1) Po ba-ui.css: synchronní ba-theme.js + ba-theme-light.css
 *   2) Pravá strana lišty .ba > .top .in zabalená do .topr (přepínač vstřikuje JS)
 *   3) Za arena.css znovu light CSS (arena má !important)
 *   4) Bump ba-ui.css?v=r3 → r4, light CSS ?v=l1 → l2
 *
 * Vynechá: akademie/admin/, stránky bez body.ba + .ba > .top,
 *          akademie/index.html (landing, už hotový), certifikat/, overit/,
 *          videokurz/kalkulacka/ (bez ba-ui, posouzené zvlášť).
 *
 * Pusť:  node scripts/apply-ba-theme.js
 * Dry:   node scripts/apply-ba-theme.js --dry
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AKA = path.join(ROOT, 'akademie');
const DRY = process.argv.includes('--dry');

const THEME_JS = '<script src="/assets/ba-theme.js"></script>';
const LIGHT_HREF = '/assets/ba-theme-light.css?v=l2';
const LIGHT_LINK = '<link rel="stylesheet" href="' + LIGHT_HREF + '">';

const SKIP_REL = new Set([
  path.join('akademie', 'index.html'),
  path.join('akademie', 'certifikat', 'index.html'),
  path.join('akademie', 'overit', 'index.html'),
  path.join('akademie', 'videokurz', 'kalkulacka', 'index.html'),
]);

function walkHtml(dir, out) {
  let names;
  try { names = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) { return out; }
  for (const ent of names) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'admin') continue;
      walkHtml(p, out);
    } else if (ent.name.endsWith('.html')) {
      out.push(p);
    }
  }
  return out;
}

function rel(abs) {
  return path.relative(ROOT, abs);
}

function hasMemberChrome(html) {
  if (!/\bclass="ba"/.test(html) && !/\bclass='ba'/.test(html)) return false;
  return html.indexOf('<div class="top"><div class="in">') !== -1;
}

function bumpBaUi(html) {
  return html.replace(/\/assets\/ba-ui\.css(\?v=r\d+)?/g, '/assets/ba-ui.css?v=r4');
}

function bumpLightVer(html) {
  return html.replace(/\/assets\/ba-theme-light\.css\?v=l\d+/g, LIGHT_HREF);
}

function insertHead(html) {
  if (html.indexOf('src="/assets/ba-theme.js"') !== -1) {
    return { html, inserted: false };
  }
  const re = /<link rel="stylesheet" href="\/assets\/ba-ui\.css(?:\?v=[^"]*)?">/;
  const m = html.match(re);
  if (!m) return { html, inserted: false, noBaUi: true };
  const block = m[0] + '\n' + THEME_JS + '\n' + LIGHT_LINK;
  return { html: html.replace(re, block), inserted: true };
}

function appendAfterArena(html) {
  const arenaRe = /<link rel="stylesheet" href="\/assets\/arena\.css\?v=[^"]+">/;
  if (!arenaRe.test(html)) return { html, appended: false };
  // už je light CSS hned za arena (stejný řádek nebo další)
  if (/arena\.css\?v=[^"]+">\s*<link rel="stylesheet" href="\/assets\/ba-theme-light\.css/.test(html)) {
    return { html, appended: false };
  }
  const next = html.replace(arenaRe, (m) => m + LIGHT_LINK);
  return { html: next, appended: next !== html };
}

function ensureTopr(html) {
  const marker = '<div class="top"><div class="in">';
  const idx = html.indexOf(marker);
  if (idx === -1) return { html, wrapped: false };
  const start = idx + marker.length;
  const after = html.slice(start);
  const closeRel = after.indexOf('</div></div>');
  if (closeRel === -1) return { html, wrapped: false };
  const inner = after.slice(0, closeRel);
  if (/\bclass="topr"/.test(inner)) return { html, wrapped: false };

  const bm = inner.match(/^\s*(<a class="brand"[\s\S]*?<\/a>)\s*([\s\S]*?)\s*$/);
  if (!bm) return { html, wrapped: false };
  const brand = bm[1];
  const rest = bm[2].trim();
  const newInner = rest
    ? '\n    ' + brand + '\n    <div class="topr">' + rest + '</div>\n  '
    : '\n    ' + brand + '\n    <div class="topr"></div>\n  ';
  const next = html.slice(0, start) + newInner + html.slice(start + closeRel);
  return { html: next, wrapped: true };
}

const files = walkHtml(AKA, []);
const stats = {
  scanned: files.length,
  skipped_admin: 0,
  skipped_special: 0,
  skipped_no_chrome: 0,
  changed: 0,
  head_inserted: 0,
  topr_wrapped: 0,
  arena_appended: 0,
  already_had_theme: 0,
  bau_bumped: 0,
};

const changedFiles = [];
const skippedNoChrome = [];
const skippedSpecial = [];
const noBaUi = [];

for (const abs of files) {
  const r = rel(abs);
  const norm = r.split(/[/\\]/).join(path.sep);
  if (norm.split(path.sep).includes('admin')) {
    stats.skipped_admin++;
    continue;
  }
  if (SKIP_REL.has(norm) || SKIP_REL.has(r) || [...SKIP_REL].some((s) => r.replace(/\//g, path.sep) === s)) {
    stats.skipped_special++;
    skippedSpecial.push(r);
    continue;
  }

  let html = fs.readFileSync(abs, 'utf8');
  if (!hasMemberChrome(html)) {
    stats.skipped_no_chrome++;
    skippedNoChrome.push(r);
    continue;
  }

  const orig = html;
  const hadTheme = html.indexOf('src="/assets/ba-theme.js"') !== -1;
  if (hadTheme) stats.already_had_theme++;

  const beforeBau = html;
  html = bumpBaUi(html);
  if (html !== beforeBau) stats.bau_bumped++;

  const head = insertHead(html);
  html = head.html;
  if (head.inserted) stats.head_inserted++;
  if (head.noBaUi) noBaUi.push(r);

  html = bumpLightVer(html);

  const arena = appendAfterArena(html);
  html = arena.html;
  if (arena.appended) stats.arena_appended++;

  const topr = ensureTopr(html);
  html = topr.html;
  if (topr.wrapped) stats.topr_wrapped++;

  if (html !== orig) {
    stats.changed++;
    changedFiles.push(r);
    if (!DRY) fs.writeFileSync(abs, html, 'utf8');
  }
}

// landing už má theme: jen bump cache parametru light CSS
const landing = path.join(AKA, 'index.html');
if (fs.existsSync(landing)) {
  let h = fs.readFileSync(landing, 'utf8');
  const n = bumpLightVer(h);
  if (n !== h) {
    stats.changed++;
    changedFiles.push(rel(landing) + ' (jen bump l2)');
    if (!DRY) fs.writeFileSync(landing, n, 'utf8');
  }
}

console.log(DRY ? 'DRY RUN (nic zapsano)' : 'ZAPSANO');
console.log('scanned html (mimo admin walk):', stats.scanned);
console.log('changed files:', stats.changed);
console.log('head inserted (nove ba-theme.js):', stats.head_inserted);
console.log('already had ba-theme.js:', stats.already_had_theme);
console.log('topr wrapped:', stats.topr_wrapped);
console.log('arena + light CSS:', stats.arena_appended);
console.log('ba-ui bumped to r4:', stats.bau_bumped);
console.log('skipped special (landing/cert/overit/kalk):', stats.skipped_special, skippedSpecial.join(', '));
console.log('skipped no chrome (body.ba + .top .in):', stats.skipped_no_chrome);
if (skippedNoChrome.length) {
  console.log('  no-chrome files:', skippedNoChrome.join(', '));
}
if (noBaUi.length) {
  console.log('WARNING no ba-ui.css among chrome pages:', noBaUi.join(', '));
}
