#!/usr/bin/env node
/* apply-krok4-theme.js — KROK 4: bump JS cache + ba-theme na materialy
 * + nastroje-zdarma, theme-light.css na zbytek veřejného webu.
 * Dry: node scripts/apply-krok4-theme.js --dry
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry');

const SKIP_DIR = new Set([
  'akademie', '_zdroje', 'go', '_zaloha', 'node_modules', '.git',
  '_cursor-logs', 'assets', 'scripts',
]);

const LIGHT_HREF = '/assets/theme-light.css?v=l3';
const LIGHT_LINK = '<link rel="stylesheet" href="' + LIGHT_HREF + '">';
const BA_JS = '<script src="/assets/ba-theme.js"></script>';
const BA_LIGHT = '<link rel="stylesheet" href="/assets/ba-theme-light.css?v=l3">';
const PRINT_LIGHT =
  '\nhtml[data-theme="light"]{\n' +
  '  --ink:#161310; --muted:#5C564C; --soft:#F3EEE4; --line:rgba(22,19,16,.12); --paper:#ffffff;\n' +
  '  color-scheme:light;\n' +
  '}\n' +
  'html[data-theme="light"] body{background:#F7F3EB;color-scheme:light;}\n' +
  'html[data-theme="light"] .sheet{border-color:rgba(22,19,16,.12);box-shadow:0 24px 64px rgba(22,19,16,.12);}\n';

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

function isMaterialy(rel) { return rel.indexOf('materialy/') === 0; }
function isNastroje(rel) { return rel.indexOf('nastroje-zdarma/') === 0; }
function isBaFamily(rel) { return isMaterialy(rel) || isNastroje(rel); }
function isPrintSheet(rel) {
  return isMaterialy(rel) && rel !== 'materialy/index.html' && rel !== 'materialy/rebrand/index.html';
}

function bumpVersions(html) {
  let next = html;
  next = next.replace(/\/assets\/analytics\.js\?v=g\d+/g, '/assets/analytics.js?v=g13');
  next = next.replace(/\/assets\/scroll-top\.js\?v=g\d+/g, '/assets/scroll-top.js?v=g10');
  next = next.replace(/\/assets\/lead-popup\.js\?v=r\d+/g, '/assets/lead-popup.js?v=r3');
  next = next.replace(/\/assets\/ai-martin\.js\?v=g\d+/g, '/assets/ai-martin.js?v=g7');
  next = next.replace(/\/assets\/theme-light\.css\?v=l\d+/g, LIGHT_HREF);
  next = next.replace(/\/assets\/ba-theme-light\.css\?v=l\d+/g, '/assets/ba-theme-light.css?v=l3');
  return next;
}

function insertAfterCharset(html, snippet) {
  if (html.indexOf(snippet) !== -1) return { html, inserted: false };
  const re = /<meta\s+charset=["'][^"']+["']\s*\/?>/i;
  if (!re.test(html)) return { html, inserted: false, noCharset: true };
  return { html: html.replace(re, function (m) { return m + '\n    ' + snippet; }), inserted: true };
}

function ensureHeadLink(html, href, tag) {
  if (html.indexOf(href.replace(/\?v=l\d+/, '')) !== -1 && html.indexOf(href) !== -1) {
    return { html, inserted: false };
  }
  if (html.indexOf(href) !== -1) return { html, inserted: false };
  const headClose = html.lastIndexOf('</head>');
  if (headClose === -1) return { html, inserted: false, noHead: true };
  const indent = html[headClose - 1] === '\n' ? '    ' : '';
  return {
    html: html.slice(0, headClose) + indent + tag + '\n' + html.slice(headClose),
    inserted: true,
  };
}

function ensureAfterArena(html, tag, needle) {
  const arenaRe = /<link rel="stylesheet" href="\/assets\/arena\.css\?v=[^"]+"\s*\/?>/;
  if (!arenaRe.test(html)) return { html, appended: false, noArena: true };
  if (html.indexOf('arena.css') !== -1 && html.indexOf(needle) !== -1 &&
      /arena\.css\?v=[^"]+"\s*\/?>\s*<link rel="stylesheet" href="[^"]*(theme-light|ba-theme-light)/.test(html)) {
    return { html, appended: false };
  }
  return { html: html.replace(arenaRe, function (m) { return m + tag; }), appended: true };
}

function ensurePrintLight(html) {
  if (html.indexOf('html[data-theme="light"]') !== -1) return { html, inserted: false };
  const re = /:root\s*\{[^}]*--paper:[^}]*\}/;
  if (!re.test(html)) return { html, inserted: false, noRoot: true };
  return { html: html.replace(re, function (m) { return m + PRINT_LIGHT; }), inserted: true };
}

function ensureScrollTop(html) {
  if (/\/assets\/scroll-top\.js/.test(html)) return { html, inserted: false };
  const bodyClose = html.lastIndexOf('</body>');
  if (bodyClose === -1) return { html, inserted: false, noBody: true };
  const tag = '<script src="/assets/scroll-top.js?v=g10" defer></script>\n';
  return { html: html.slice(0, bodyClose) + tag + html.slice(bodyClose), inserted: true };
}

const files = walkHtml(ROOT, []);
const stats = {
  scanned: files.length,
  changed: 0,
  bump: 0,
  baJs: 0,
  baLight: 0,
  baArena: 0,
  lightHead: 0,
  lightArena: 0,
  printLight: 0,
  scroll: 0,
};

const changed = [];

for (const abs of files) {
  let html = fs.readFileSync(abs, 'utf8');
  const orig = html;
  const rel = relPosix(abs);

  const beforeBump = html;
  html = bumpVersions(html);
  if (html !== beforeBump) stats.bump++;

  if (isBaFamily(rel)) {
    const js = insertAfterCharset(html, BA_JS);
    html = js.html;
    if (js.inserted) stats.baJs++;
    const light = ensureHeadLink(html, '/assets/ba-theme-light.css?v=l3', BA_LIGHT);
    html = light.html;
    if (light.inserted) stats.baLight++;
    const arena = ensureAfterArena(html, BA_LIGHT, 'ba-theme-light');
    html = arena.html;
    if (arena.appended) stats.baArena++;
    if (isPrintSheet(rel)) {
      const pl = ensurePrintLight(html);
      html = pl.html;
      if (pl.inserted) stats.printLight++;
    }
  } else if (html.indexOf('theme-light.css') === -1 && html.indexOf('ba-theme.js') === -1) {
    const head = ensureHeadLink(html, LIGHT_HREF, LIGHT_LINK);
    html = head.html;
    if (head.inserted) stats.lightHead++;
    const arena = ensureAfterArena(html, LIGHT_LINK, 'theme-light');
    html = arena.html;
    if (arena.appended) stats.lightArena++;
  }

  if (
    rel === 'odhlasit/index.html' ||
    rel === 'pripominky-vypnuto/index.html' ||
    rel === 'spoluprace/index.html'
  ) {
    const st = ensureScrollTop(html);
    html = st.html;
    if (st.inserted) stats.scroll++;
  }

  if (html !== orig) {
    stats.changed++;
    changed.push(rel);
    if (!DRY) fs.writeFileSync(abs, html, 'utf8');
  }
}

console.log(DRY ? 'DRY RUN' : 'ZAPSANO');
console.log(JSON.stringify(stats, null, 2));
console.log('changed sample:', changed.slice(0, 40).join(', '));
if (changed.length > 40) console.log('... +' + (changed.length - 40) + ' further');
