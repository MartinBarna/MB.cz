#!/usr/bin/env node
/**
 * Přepíše lastmod v kořenovém sitemap.xml podle data posledního git commitu
 * souboru dané URL. Přidá llms.txt, pokud tam chybí. Pořadí a sadu HTML URL
 * nemění (to řeší scripts/generuj-sitemap.mjs).
 *
 * Použití: node scripts/gen-sitemap-lastmod.mjs
 *
 * V CI (deploy-wedos.yml) potřebuje checkout s fetch-depth: 0, jinak git log
 * vidí jen HEAD a lastmod by byl u nezměněných souborů klamný.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ORIGIN = 'https://martinbarna.cz';
const OUT = join(ROOT, 'sitemap.xml');
const LLMS_LOC = ORIGIN + '/llms.txt';

function toPosix(p) {
  return p.split('\\').join('/');
}

function locToRel(loc) {
  if (!loc.startsWith(ORIGIN)) return null;
  let path = loc.slice(ORIGIN.length);
  if (path === '' || path === '/') return 'index.html';
  if (path.startsWith('/')) path = path.slice(1);
  if (path.endsWith('/')) return path + 'index.html';
  if (/\.[a-z0-9]+$/i.test(path)) return path;
  return path + '.html';
}

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseExisting() {
  const xml = readFileSync(OUT, 'utf8');
  const urls = [];
  const re = /<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>\s*<\/url>/g;
  let m;
  while ((m = re.exec(xml))) {
    urls.push({ loc: m[1].trim(), lastmod: m[2].trim() });
  }
  if (urls.length === 0) {
    throw new Error('sitemap.xml: nenasel jsem zadne <url><loc>…');
  }
  return urls;
}

function gitLastmods() {
  const map = new Map();
  const out = execFileSync(
    'git',
    ['-C', ROOT, 'log', '--pretty=format:COMMIT\t%cs', '--name-only'],
    { encoding: 'utf8', maxBuffer: 80 * 1024 * 1024 },
  );
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

function dirtyRels() {
  const set = new Set();
  let out;
  try {
    out = execFileSync(
      'git',
      ['-C', ROOT, 'status', '--porcelain', '-z'],
      { encoding: 'utf8' },
    );
  } catch {
    return set;
  }
  const parts = out.split('\0').filter(Boolean);
  for (const row of parts) {
    const path = row.slice(3).trim();
    if (path) set.add(toPosix(path.split(' -> ').pop()));
  }
  return set;
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function lastmodFor(rel, fallback, gitMap, dirty) {
  if (rel && dirty.has(rel)) return todayYmd();
  if (rel && gitMap.has(rel)) return gitMap.get(rel);
  return fallback || todayYmd();
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
  return null;
}

if (!existsSync(OUT)) {
  throw new Error('chybi ' + OUT);
}

const existing = parseExisting();
const gitMap = gitLastmods();
const dirty = dirtyRels();
const missing = [];
const updated = [];

const urls = existing.map((row) => {
  const rel = locToRel(row.loc);
  if (rel && !existsSync(join(ROOT, rel))) missing.push(row.loc + ' -> ' + rel);
  const lastmod = lastmodFor(rel, row.lastmod, gitMap, dirty);
  if (lastmod !== row.lastmod) updated.push({ loc: row.loc, from: row.lastmod, to: lastmod });
  return { loc: row.loc, lastmod };
});

if (!urls.some((u) => u.loc === LLMS_LOC)) {
  urls.push({
    loc: LLMS_LOC,
    lastmod: lastmodFor('llms.txt', todayYmd(), gitMap, dirty),
  });
  updated.push({ loc: LLMS_LOC, from: '(nove)', to: lastmodFor('llms.txt', todayYmd(), gitMap, dirty) });
}

urls.sort((a, b) => {
  if (a.loc === ORIGIN + '/') return -1;
  if (b.loc === ORIGIN + '/') return 1;
  return a.loc.localeCompare(b.loc, 'cs');
});

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
console.log('sitemap: zapsano', OUT);
console.log('url_count:', urls.length);
console.log('lastmod_zmeneno:', updated.length);
console.log('llms.txt:', urls.some((u) => u.loc === LLMS_LOC) ? 'ANO' : 'NE');
console.log('xml_valid:', xmlErr ? 'NE: ' + xmlErr : 'ANO (well-formed)');
if (missing.length) {
  console.log('chybejici soubory:');
  for (const x of missing) console.log('  ', x);
}
const samples = updated.slice(0, 12);
if (samples.length) {
  console.log('ukazky zmen lastmod:');
  for (const s of samples) console.log('  ', s.from, '->', s.to, s.loc);
}
