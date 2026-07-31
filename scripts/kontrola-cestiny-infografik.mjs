#!/usr/bin/env node
// =============================================================================
// JAZYKOVÁ KONTROLA SCÉNÁŘŮ INFOGRAFIK
//
// Autorem současných decků byl jiný model a Martin hlásí překlepy a AI slop.
// Tohle hlídá tři třídy chyb, na které jsem narazil opakovaně při ruční revizi:
//
//  1. PÁD PO ČÍSLOVCE. Po „0" se česky pojí genitiv množného čísla.
//     „0 významný rozdíl" je špatně, správně „0 významných rozdílů".
//  2. OSIŘELÁ VYSVĚTLIVKA. `pozn` vysvětluje pojem, který na tom slidu vůbec
//     není. Vzniklo to automatickým importem, který bral každý řádek s rovnítkem.
//     ⛔ Porovnává se KOŘEN slova (5 znaků), ne celé slovo. Čeština skloňuje,
//     takže „Mendelovskou" a „Mendelovská" se na celé slovo neshodnou.
//  3. DVOJÍ CITACE. Tatáž práce v `callout` i v `zdroj`. Na obrázku pak stojí
//     dvakrát pod sebou a vypadá to jako nedodělek.
//
// Spuštění: node scripts/kontrola-cestiny-infografik.mjs
// =============================================================================
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.slice(1)), '..');
const NASE = path.join(ROOT, '_zdroje/infografiky');
const bezDia = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cistyText = (v) => JSON.stringify(v).replace(/<[^>]+>/g, ' ');
const JE_CITACE = /10\.\d{4,}\/|et al\.|a kol\.|\(\s*(19|20)\d{2}\s*\)/;

let nalezu = 0;
const hlas = (tema, slide, druh, text) => {
  console.log(`🔴 ${tema} #${slide}  [${druh}]  ${text}`);
  nalezu++;
};

for (const f of readdirSync(NASE).filter((x) => x.endsWith('.json'))) {
  const tema = f.replace('.json', '');
  const sc = JSON.parse(readFileSync(path.join(NASE, f), 'utf8'));

  sc.slides.forEach((s, i) => {
    // 1) pád po nule
    if (s.kind === 'stat' && String(s.big).trim() === '0' && s.unit) {
      const u = String(s.unit);
      // 1. pád jednotného čísla: přídavné jméno na -ý/-í následované podstatným
      // ⛔ `\b` v JS je ASCII, takže „ů\b" NIKDY nesedí a kontrola pak hlásí i větu,
      // která genitiv správně má. Proto se hranice testuje na mezeru, tečku nebo konec.
      if (/\b[a-zá-žA-ZÁ-Ž]+[ýí]\s+[a-zá-ž]+/.test(u) && !/ů([\s.,;)]|$)/.test(u)) {
        hlas(tema, i + 1, 'pád po nule', `"0 ${u.slice(0, 55)}" -> po nule je genitiv množného čísla`);
      }
    }

    // 2) osiřelá vysvětlivka
    if (s.pozn) {
      const pojem = String(s.pozn).split(/\s*=\s*/)[0].replace(/<[^>]+>/g, '').trim();
      if (pojem && pojem.length <= 30) {
        const zbytek = bezDia(cistyText({ ...s, pozn: undefined }));
        const slova = pojem.split(/\s+/).map((w) => bezDia(w).replace(/[^a-z0-9]/g, '')).filter((w) => w.length > 2);
        const sedi = slova.some((w) => zbytek.includes(w.slice(0, Math.min(5, w.length))));
        if (slova.length && !sedi) hlas(tema, i + 1, 'osiřelá vysvětlivka', `vysvětluje "${pojem}", ten pojem na slidu není`);
      }
    }

    // 3) dvojí citace
    if (s.callout && s.zdroj) {
      const c = String(s.callout).replace(/<[^>]+>/g, ' ');
      if (JE_CITACE.test(c)) {
        const z = bezDia(typeof s.zdroj === 'string' ? s.zdroj : Object.values(s.zdroj).join(' '));
        // jméno prvního autora ze zdroje hledám v rámečku
        const autor = bezDia(z).match(/^([a-z-]{3,})/);
        if (autor && bezDia(c).includes(autor[1])) {
          hlas(tema, i + 1, 'dvojí citace', `"${autor[1]}" je v rámečku i v boxu se zdrojem`);
        }
      }
    }
  });
}

console.log('');
console.log(nalezu === 0 ? '✅ Nic z hlídaných tří tříd chyb.' : `Nálezů: ${nalezu}`);
