#!/usr/bin/env node
/**
 * Přesměrování /go/ nesmí obsahovat utm_.
 *
 * Čte:
 *   go/<zkratka>/index.html   meta refresh, location.replace/assign/href, záložní <a href>
 *   .htaccess, _redirects, netlify.toml, vercel.json, firebase.json
 *                          jen pravidla, jejichž zdrojová cesta je /go/
 *   .github workflow (yml)  řádek, který zároveň nese /go/ a utm_
 *
 * Spuštění: node scripts/kontrola-go-utm.mjs
 * Exit 1, jakmile některé přesměrování utm_ obsahuje.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const nalezy = [];

function pridej(soubor, radek, text) {
  nalezy.push(`${soubor}:${radek}: ${text.trim()}`);
}

function radkySouboru(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8').split(/\r?\n/);
}

function projdiStrom(dir, pripona, fn) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) projdiStrom(p, pripona, fn);
    else if (pripona.test(name)) fn(path.relative(ROOT, p));
  }
}

function cileHtml(html) {
  const out = [];
  for (const m of html.matchAll(/url=([^"'>\s]+)/gi)) {
    out.push(m[1].replace(/&amp;/g, '&'));
  }
  for (const m of html.matchAll(/location\.(?:replace|assign|href)\(\s*(['"])([\s\S]*?)\1/g)) {
    out.push(m[2]);
  }
  for (const m of html.matchAll(/<a\s[^>]*href="([^"]+)"/gi)) {
    out.push(m[1].replace(/&amp;/g, '&'));
  }
  return out;
}

function maUtm(url) {
  return /utm_/i.test(url);
}

const goSoubory = [];
projdiStrom(path.join(ROOT, 'go'), /\.html$/i, (rel) => goSoubory.push(rel));
goSoubory.sort();

console.log(`go/*.html: ${goSoubory.length}`);
for (const rel of goSoubory) {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const radky = text.split(/\r?\n/);
  radky.forEach((line, i) => {
    if (/utm_/i.test(line)) pridej(rel, i + 1, line);
  });
  const cile = cileHtml(text);
  const unikatni = [...new Set(cile)];
  const jinak = unikatni.filter((u) => u !== unikatni[0]);
  if (cile.length === 0) pridej(rel, 1, 'chybi cil presmerovani');
  if (jinak.length) pridej(rel, 1, `cile se rozchazi: ${unikatni.join(' | ')}`);
  for (const u of unikatni) {
    let ostatni = '';
    try {
      const q = [...new URL(u).searchParams.keys()].filter((k) => !/^utm_/i.test(k));
      if (q.length) ostatni = ` (query mimo utm: ${q.join(', ')})`;
    } catch {
      ostatni = ' (cil neni absolutni URL)';
    }
    console.log(`  /${rel.replace(/\/index\.html$/, '/')} -> ${u}${ostatni}`);
  }
}

const server = ['.htaccess', '_redirects', 'netlify.toml', 'vercel.json', 'firebase.json'];
for (const rel of server) {
  const radky = radkySouboru(rel);
  if (!radky) {
    console.log(`${rel}: soubor neni`);
    continue;
  }
  let goPravidla = 0;
  radky.forEach((line, i) => {
    const jeGo = /(?:^|[\s"'`])\/go\/|\^\/?go\/|\^go\//.test(line);
    if (!jeGo) return;
    goPravidla++;
    if (/utm_/i.test(line)) pridej(rel, i + 1, line);
  });
  console.log(`${rel}: pravidel pro /go/: ${goPravidla}`);
}

let workflowRadku = 0;
projdiStrom(path.join(ROOT, '.github'), /\.(yml|yaml)$/i, (rel) => {
  const radky = radkySouboru(rel);
  radky.forEach((line, i) => {
    if (/\/go\//.test(line) && /utm_/i.test(line)) {
      workflowRadku++;
      pridej(rel, i + 1, line);
    }
  });
});
console.log(`.github: radku s /go/ a utm_: ${workflowRadku}`);

if (nalezy.length) {
  console.log(`\nSPADLO: ${nalezy.length}`);
  for (const n of nalezy) console.log(n);
  process.exit(1);
}
console.log('\nVYSLEDEK: OK (zadne /go/ presmerovani neobsahuje utm_)');
