#!/usr/bin/env node
// Fix og:image / twitter:image mismatches in clanky/*.html.
// An article must point to its OWN OG image (assets/og/clanky/<slug>.jpg).
// If it points to another article's image: rewrite to own image when it exists,
// otherwise fall back to the site-wide default OG image.
// Usage: node scripts/fix-og-images.js [--dry]

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CLANKY = path.join(ROOT, 'clanky');
const OG_DIR = path.join(ROOT, 'assets', 'og', 'clanky');
const DEFAULT_OG = 'https://martinbarna.cz/assets/og-default.jpg?v=g7';
const DRY = process.argv.includes('--dry');

const ogRe = /https:\/\/martinbarna\.cz\/assets\/og\/clanky\/([a-z0-9-]+)\.jpg(\?v=[a-z0-9]+)?/g;

let fixedOwn = 0, fixedDefault = 0, ok = 0, skipped = 0;
const changedFiles = [];

for (const file of fs.readdirSync(CLANKY).filter(f => f.endsWith('.html'))) {
  if (file === 'index.html') { skipped++; continue; }
  const slug = file.replace(/\.html$/, '');
  const fp = path.join(CLANKY, file);
  let html = fs.readFileSync(fp, 'utf8');

  const matches = [...html.matchAll(ogRe)];
  if (matches.length === 0) { skipped++; continue; } // uses og-default etc.

  const wrong = matches.filter(m => m[1] !== slug);
  if (wrong.length === 0) { ok++; continue; }

  const ownExists = fs.existsSync(path.join(OG_DIR, slug + '.jpg'));
  const replacement = ownExists
    ? `https://martinbarna.cz/assets/og/clanky/${slug}.jpg?v=g8`
    : DEFAULT_OG;

  html = html.replace(ogRe, (full, s) => (s === slug ? full : replacement));
  if (!DRY) fs.writeFileSync(fp, html);
  changedFiles.push(`${file} -> ${ownExists ? slug + '.jpg' : 'og-default.jpg'}`);
  if (ownExists) fixedOwn++; else fixedDefault++;
}

console.log(`OK (own image already): ${ok}`);
console.log(`Fixed -> own image:     ${fixedOwn}`);
console.log(`Fixed -> default image: ${fixedDefault}`);
console.log(`Skipped (no per-article OG): ${skipped}`);
console.log('');
changedFiles.forEach(l => console.log('  ' + l));
