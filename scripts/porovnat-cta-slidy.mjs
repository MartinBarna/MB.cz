// Porovna NOVY a STARY CTA slide (10.png) pixel po pixelu a spocita, v jake OBLASTI
// se lisi. Cil: dokazat, ze zmena zasahla jen ten jeden textovy radek s cenou a poctem
// videi, a ne treba cely layout kvuli jinemu zalomeni.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(`file:///${(process.env.OG_SHARP_DIR || '.').replace(/\\/g, '/')}/x.js`);
const sharp = require('sharp');

const BASE = '_zdroje/infografiky';
const temata = fs.readdirSync(BASE).filter((f) => fs.statSync(path.join(BASE, f)).isDirectory());

const vysledky = [];
for (const t of temata) {
  const rel = `${BASE}/${t}/10.png`;
  let stary;
  try { stary = execFileSync('git', ['show', `HEAD:${rel}`], { maxBuffer: 1024 * 1024 * 64 }); }
  catch { vysledky.push({ tema: t, stav: 'stary chybi' }); continue; }
  const novy = fs.readFileSync(rel);

  const [a, b] = await Promise.all([
    sharp(stary).raw().toBuffer({ resolveWithObject: true }),
    sharp(novy).raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
    vysledky.push({ tema: t, stav: 'ZMENIL SE ROZMER' }); continue;
  }
  const { width, height, channels } = a.info;
  let minY = Infinity, maxY = -1, minX = Infinity, maxX = -1, lisi = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) {
        lisi++;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
      }
    }
  }
  vysledky.push(lisi === 0
    ? { tema: t, stav: 'beze zmeny' }
    : { tema: t, stav: 'zmena', pruh: `y ${minY}..${maxY} (${maxY - minY + 1} px)`, sirka: `x ${minX}..${maxX}`, pixelu: lisi, vyskaObrazku: height });
}

const zmenene = vysledky.filter((v) => v.stav === 'zmena');
const bezeZmeny = vysledky.filter((v) => v.stav === 'beze zmeny');
const jine = vysledky.filter((v) => v.stav !== 'zmena' && v.stav !== 'beze zmeny');

console.log(`temat: ${vysledky.length}   zmenenych CTA: ${zmenene.length}   beze zmeny: ${bezeZmeny.length}`);
if (jine.length) console.log('POZOR: ' + JSON.stringify(jine));
const vysky = zmenene.map((v) => Number(v.pruh.match(/\((\d+) px\)/)[1]));
console.log(`vyska odlisneho pruhu: min ${Math.min(...vysky)} px, max ${Math.max(...vysky)} px (obrazek je ${zmenene[0].vyskaObrazku} px vysoky)`);
const siroke = zmenene.filter((v) => Number(v.pruh.match(/\((\d+) px\)/)[1]) > 120);
console.log(siroke.length ? `⚠️ temata s pruhem vyssim nez 120 px (podezreni na zmenu layoutu): ${siroke.map((v) => v.tema + ' ' + v.pruh).join(', ')}` : '✅ zadne tema nema odlisny pruh vyssi nez 120 px => zmena je v jednom textovem radku');
console.log('');
console.log('beze zmeny: ' + (bezeZmeny.map((v) => v.tema).join(', ') || '(zadne)'));
fs.writeFileSync('../cta-porovnani.json', JSON.stringify(vysledky, null, 1));
