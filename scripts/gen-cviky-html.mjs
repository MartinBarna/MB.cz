#!/usr/bin/env node
/**
 * Vloží do nastroje-zdarma/cviky/index.html statický <ul> se 120 cviky
 * (název + partie) z assets/exercise-db.json. Filtry a karty dál staví JS
 * přes fetch: to je progressive enhancement, robot čte tenhle seznam.
 *
 * Použití: node scripts/gen-cviky-html.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PAGE = join(ROOT, 'nastroje-zdarma', 'cviky', 'index.html');
const DB = join(ROOT, 'assets', 'exercise-db.json');

const MUS = {
  nohy: 'Nohy',
  prsa: 'Prsa',
  zada: 'Záda',
  ramena: 'Ramena',
  biceps: 'Biceps',
  triceps: 'Triceps',
  bricho: 'Břicho',
  hyzde: 'Hýždě',
  lytka: 'Lýtka',
  full: 'Celé tělo / kondice',
};

const LIST_START = '<!-- cviky-list:start -->';
const LIST_END = '<!-- cviky-list:end -->';
const JSONLD_START = '<!-- cviky-jsonld:start -->';
const JSONLD_END = '<!-- cviky-jsonld:end -->';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function replaceBlock(html, start, end, inner) {
  const a = html.indexOf(start);
  const b = html.indexOf(end);
  if (a < 0 || b < 0 || b < a) {
    throw new Error('v ' + PAGE + ' chybi znacky ' + start + ' / ' + end);
  }
  return html.slice(0, a) + start + '\n' + inner + (inner.endsWith('\n') ? '' : '\n') + end + html.slice(b + end.length);
}

const items = JSON.parse(readFileSync(DB, 'utf8'));
if (!Array.isArray(items) || items.length === 0) {
  throw new Error('exercise-db.json je prazdny');
}

const lis = items.map((e) => {
  const part = MUS[e.muscle] || e.muscle || '';
  return `<li><b>${esc(e.name)}</b> <span>${esc(part)}</span></li>`;
});

const ul =
  `<ul id="cviky-static" class="cviky-static" aria-label="Databáze cviků">\n`
  + lis.join('\n')
  + '\n</ul>';

const jsonldObj = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Databáze cviků',
  url: 'https://martinbarna.cz/nastroje-zdarma/cviky/',
  numberOfItems: items.length,
  itemListElement: items.map((e, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: e.name,
    description: MUS[e.muscle] || e.muscle || '',
  })),
};

const jsonld =
  '<script type="application/ld+json">\n'
  + JSON.stringify(jsonldObj)
  + '\n</script>';

let html = readFileSync(PAGE, 'utf8');
html = replaceBlock(html, LIST_START, LIST_END, ul);
html = replaceBlock(html, JSONLD_START, JSONLD_END, jsonld);
writeFileSync(PAGE, html, 'utf8');

if (!html.includes('</ul>')) throw new Error('vygenerovane HTML nema uzavrene ul');
const blok = html.slice(html.indexOf(LIST_START), html.indexOf(LIST_END));
const openLi = (blok.match(/<li>/g) || []).length;
const closeLi = (blok.match(/<\/li>/g) || []).length;
if (openLi !== closeLi || openLi !== items.length) {
  throw new Error(`li tagy nesedi (${openLi} vs ${closeLi}, ocekavano ${items.length})`);
}

console.log('cviky: zapsano', PAGE);
console.log('pocet:', items.length);
