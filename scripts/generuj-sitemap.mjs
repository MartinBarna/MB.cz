#!/usr/bin/env node
/**
 * Vygeneruje kořenový sitemap.xml z veřejných HTML stránek v repu.
 * Použití: node scripts/generuj-sitemap.mjs
 *
 * Bez závislostí. lastmod = git datum posledního commitu souboru, jinak mtime.
 * URL: https://www.martinbarna.cz/… (zadání), u adresářů s koncovým lomítkem.
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ORIGIN = 'https://martinbarna.cz';
const OUT = join(ROOT, 'sitemap.xml');

const SKIP_DIR_NAMES = new Set([
  '.git',
  'node_modules',
]);

/** Čisté URL bez .html (viz .htaccess 2b): /videokurz a /treninky, bez lomítka. */
const CLEAN_FILE_URL = {
  'videokurz.html': '/videokurz',
  'treninky.html': '/treninky',
};

const excluded = {
  admin: 0,
  klient: 0,
  go: 0,
  odhlasit: 0,
  intern: 0,
  noindex: 0,
  assets: 0,
};

function toPosix(p) {
  return p.split('\\').join('/');
}

function startsWithPath(rel, prefix) {
  return rel === prefix || rel.startsWith(prefix + '/');
}

function pathCategory(rel) {
  if (startsWithPath(rel, 'assets')) return 'assets';
  if (rel.includes('/admin/') || startsWithPath(rel, 'akademie/admin') || rel.includes('\\admin\\')) {
    return 'admin';
  }
  if (startsWithPath(rel, 'akademie/klient') || startsWithPath(rel, 'akademie/moje')) {
    return 'klient';
  }
  if (startsWithPath(rel, 'go')) return 'go';
  if (startsWithPath(rel, 'odhlasit')) return 'odhlasit';
  if (
    rel === '404.html'
    || startsWithPath(rel, 'scripts')
    || startsWithPath(rel, 'supabase')
    || startsWithPath(rel, '.github')
    || startsWithPath(rel, 'ads')
    || startsWithPath(rel, 'Logo-rebrand')
    || startsWithPath(rel, 'download')
    || startsWithPath(rel, '_import')
    || startsWithPath(rel, '_zaloha')
    || startsWithPath(rel, '_zdroje')
    || startsWithPath(rel, 'akademie/test')
    || startsWithPath(rel, 'akademie/overit')
    || startsWithPath(rel, 'akademie/check-in')
    || startsWithPath(rel, 'akademie/studium')
    || /^akademie\/videokurz\/v\d+/.test(rel)
    || /(^|\/)_[^/]+\//.test(rel)
  ) {
    return 'intern';
  }
  return null;
}

function isPublicPageType(rel) {
  if (rel === 'index.html') return true;
  if (rel === 'videokurz.html' || rel === 'treninky.html') return true;
  if (rel.startsWith('clanky/') && rel.endsWith('.html')) return true;
  return rel.endsWith('/index.html');
}

function hasNoindex(abs) {
  let head;
  try {
    const buf = readFileSync(abs);
    head = buf.subarray(0, 16384).toString('utf8');
  } catch {
    return false;
  }
  const metas = head.match(/<meta\s+[^>]*>/gi) || [];
  for (const tag of metas) {
    if (!/\bname\s*=\s*["']robots["']/i.test(tag)) continue;
    const m = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
    if (!m) continue;
    const content = m[1].toLowerCase();
    if (content.includes('noindex') || content.includes('none')) return true;
  }
  return false;
}

function walkHtml(dir, acc) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.isDirectory()) {
      if (SKIP_DIR_NAMES.has(ent.name)) continue;
      walkHtml(join(dir, ent.name), acc);
      continue;
    }
    if (!ent.isFile() || !ent.name.toLowerCase().endsWith('.html')) continue;
    acc.push(join(dir, ent.name));
  }
}

function fileToUrl(rel) {
  if (rel === 'index.html') return ORIGIN + '/';
  if (CLEAN_FILE_URL[rel]) return ORIGIN + CLEAN_FILE_URL[rel];
  if (rel.endsWith('/index.html')) {
    return ORIGIN + '/' + rel.slice(0, -'index.html'.length);
  }
  return ORIGIN + '/' + rel;
}

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function gitLastmods() {
  const map = new Map();
  let out;
  try {
    out = execFileSync(
      'git',
      ['-C', ROOT, 'log', '--pretty=format:COMMIT\t%cI', '--name-only', '--', ':(glob)**/*.html'],
      { encoding: 'utf8', maxBuffer: 80 * 1024 * 1024 },
    );
  } catch {
    return map;
  }
  let date = null;
  for (const line of out.split(/\r?\n/)) {
    if (line.startsWith('COMMIT\t')) {
      date = line.slice(7).trim();
      continue;
    }
    if (!line || !date) continue;
    const key = toPosix(line.trim());
    if (!map.has(key)) map.set(key, date);
  }
  return map;
}

function lastmodFor(rel, abs, gitMap) {
  const git = gitMap.get(rel);
  if (git) return git.slice(0, 10);
  try {
    return statSync(abs).mtime.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function isWellFormedXml(xml) {
  if (!xml.startsWith('<?xml')) return 'chybi XML prolog';
  if (!xml.includes('<urlset') || !xml.includes('</urlset>')) return 'chybi urlset';
  const openUrl = (xml.match(/<url>/g) || []).length;
  const closeUrl = (xml.match(/<\/url>/g) || []).length;
  if (openUrl !== closeUrl) return `url tagy nesedi (${openUrl} vs ${closeUrl})`;
  const openLoc = (xml.match(/<loc>/g) || []).length;
  const closeLoc = (xml.match(/<\/loc>/g) || []).length;
  if (openLoc !== closeLoc || openLoc !== openUrl) return 'loc tagy nesedi';
  if (/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD]/.test(xml)) return 'neplatny XML znak';
  return null;
}

const absFiles = [];
walkHtml(ROOT, absFiles);

const included = [];
for (const abs of absFiles) {
  const rel = toPosix(relative(ROOT, abs));
  const cat = pathCategory(rel);
  if (cat) {
    excluded[cat] += 1;
    continue;
  }
  if (hasNoindex(abs)) {
    excluded.noindex += 1;
    continue;
  }
  if (!isPublicPageType(rel)) {
    excluded.intern += 1;
    continue;
  }
  included.push({ rel, abs, loc: fileToUrl(rel) });
}

included.sort((a, b) => {
  if (a.loc === ORIGIN + '/') return -1;
  if (b.loc === ORIGIN + '/') return 1;
  return a.loc.localeCompare(b.loc, 'cs');
});

const gitMap = gitLastmods();
const urls = included.map((row) => ({
  loc: row.loc,
  lastmod: lastmodFor(row.rel, row.abs, gitMap),
}));

const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + urls
    .map(
      (u) =>
        '  <url>\n'
        + `    <loc>${escapeXml(u.loc)}</loc>\n`
        + `    <lastmod>${u.lastmod}</lastmod>\n`
        + '  </url>\n',
    )
    .join('')
  + '</urlset>\n';

writeFileSync(OUT, xml, 'utf8');

const xmlErr = isWellFormedXml(xml);
const samples = urls.slice(0, 10).map((u) => u.loc);

console.log('sitemap: zapsano', OUT);
console.log('url_count:', urls.length);
console.log('samples:');
for (const s of samples) console.log('  ', s);
console.log('excluded:');
for (const [k, n] of Object.entries(excluded)) console.log(`  ${k}: ${n}`);
console.log('xml_valid:', xmlErr ? `NE — ${xmlErr}` : 'ANO (well-formed)');
if (existsSync(join(ROOT, '.htaccess'))) {
  console.log(
    'poznamka: zive .htaccess sjednocuje na apex martinbarna.cz (www → 301). Zadani chtelo www v loc.',
  );
}
