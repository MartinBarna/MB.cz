#!/usr/bin/env node
// =============================================================================
// HLÍDÁ PŘETEČENÍ SLIDŮ V INFOGRAFIKÁCH.
//
// ⛔ PROČ TO MUSÍ EXISTOVAT: `body` má `overflow:hidden`, takže text, který se
// nevejde, se TIŠE OŘÍZNE. Na výsledném PNG prostě chybí konec věty a nikdo si
// toho nevšimne, dokud to nevisí na Instagramu. Velikosti titulků jsou navíc
// napevno na každý typ slidu, žádné automatické zmenšování tu není.
//
// Spouštět po KAŽDÉ změně písma, velikostí nebo delších textech ve scénářích.
//
// Jak to měří: postaví TOTOŽNÉ HTML jako generátor (importuje z něj `page` a
// `KINDS`, aby nemohla vzniknout druhá kopie šablony, která se časem rozejde),
// pustí headless Chrome s `--dump-dom` a přečte, co si stránka sama naměřila.
// Nerenderuje PNG, takže je to podstatně rychlejší než generování.
//
// Spuštění:  node scripts/kontrola-preteceni-infografik.mjs           (všechna témata)
//            node scripts/kontrola-preteceni-infografik.mjs krevni-testy
// =============================================================================
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
process.env.OG_SHARP_DIR ||= 'C:/Users/fitne/Desktop/AI Martin';
const gen = require('./generate-carousel.js');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.slice(1)), '..');
const SCENARE = path.join(ROOT, '_zdroje/infografiky');
const TMP = mkdtempSync(path.join(tmpdir(), 'preteceni-'));

// Skript se vloží do stránky, změří obsah proti plátnu a výsledek zapíše do <title>.
//
// ⛔ NEMĚŘIT PŘES scrollHeight. `overflow:hidden` scrollování vypne, takže
// `scrollHeight - clientHeight` vyjde VŽDY NULA a kontrola mlčí, i když je půlka
// titulku pryč. Ověřeno 27. 7.: umělý nadpis na tři řádky navíc takhle prošel jako
// „v pořádku". Detektor, který nic nenajde, je horší než žádný, protože uklidní.
//
// ⛔ ANI přes getBoundingClientRect obalu. `.wrap` je flex sloupec s pevnou výškou,
// takže při dlouhém titulku se DĚTI SMRSKNOU a obal má pořád přesně 1350 px. Přetečení
// se schová UVNITŘ prvku. Změřeno 27. 7.: h1 mělo `client 304`, ale `scroll 314`,
// tedy 10 px textu bylo uříznutých, a obal přitom hlásil 1350/1350.
//
// Správně: u KAŽDÉHO prvku zvlášť porovnat, o kolik je jeho obsah větší než jeho
// rámeček. K tomu ještě kontrola, jestli něco nepřeteklo pod spodní hranu plátna
// (to nastane, když se flex smrsknout nemůže).
// ⛔ ANI přes `scrollHeight - clientHeight` po jednotlivých prvcích. U textu s
// `line-height` pod 1 vychází ten rozdíl 9 až 16 px POŘÁD, i když je slide v pohodě.
// Změřeno 27. 7.: takhle nastavená kontrola označila za vadných všech 10 slidů,
// které vypadají správně. Detektor, který křičí vždycky, se stejně začne ignorovat.
//
// Správně: pustit obsah z pevné výšky (`height:auto`, `overflow:visible`), nechat ho
// narůst do přirozené velikosti a teprve tu porovnat s plátnem. Co se nevejde tam,
// to se v ostrém renderu ořízne.
// ⛔ DRUHÁ VĚC, KTEROU MUSÍ MĚŘIT: kolizi s patičkou.
// Patička je absolutně pozicovaná, takže do výšky obsahu nepatří a kontrola si ji
// odstraňuje. Jenže tím se stane slepou vůči tomu, že na ní obsah LEŽÍ. Přesně to
// se stalo 31. 7. 2026: vysvětlivka pod čarou se vykreslila přes „martinbarna.cz",
// bylo to nečitelné a tahle kontrola to pustila jako „v pořádku".
// Proto se kolize měří PRVNÍ, v původním rozvržení, a teprve pak se patička odstraní.
// ⛔ MĚŘIT AŽ PO NAČTENÍ PÍSEM. Událost `load` může přijít dřív, než se použije
// Poppins, a pak se měří náhradní Arial, který má jinou šířku. Projevilo se to
// 31. 7. 2026 tím, že týž slide vyšel samostatně na 3 px a v dávce 380 slidů na
// 59 px. Hlídač, který dává pokaždé jiné číslo, se přestane brát vážně.
const MERIC = `<script>
  window.addEventListener('load', function () {
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
    var w = document.querySelector('.wrap');
    var f = document.querySelector('.foot');
    var kolize = 0;
    if (f && w) {
      var hraniceP = f.getBoundingClientRect().top;
      w.querySelectorAll(':scope > *').forEach(function (el) {
        if (getComputedStyle(el).position === 'absolute') return;   // tečky nahoře
        var d = el.getBoundingClientRect().bottom - hraniceP;
        if (d > kolize) kolize = d;
      });
    }
    if (f) f.remove();                     // zápatí je absolutní, do výšky obsahu nepatří
    document.body.style.height = 'auto';
    document.body.style.overflow = 'visible';
    if (w) { w.style.height = 'auto'; w.style.minHeight = '0'; }
    // Vynutit přepočet layoutu a teprve pak měřit.
    void document.body.offsetHeight;
    var prirozena = w ? w.scrollHeight : document.body.scrollHeight;
    var siroko = 0;
    document.querySelectorAll('.wrap *').forEach(function (el) {
      var s = el.scrollWidth - el.clientWidth;
      if (s > siroko) siroko = s;
    });
    var vysledek = Math.max(prirozena - ${gen.H}, siroko, kolize);
    var kde = kolize >= Math.max(prirozena - ${gen.H}, siroko)
      ? 'obsah lezi na paticce' : 'vyska ' + Math.round(prirozena) + ' z ' + ${gen.H};
    document.title = 'MERENI:' + Math.round(vysledek) + ';KDE:' + kde;
    });
  });
</script>`;

function pretekaO(html) {
  const f = path.join(TMP, 'x.html');
  writeFileSync(f, html.replace('</body>', MERIC + '</body>'), 'utf8');
  const dom = execFileSync(gen.CHROME, ['--headless=old', '--disable-gpu',
    '--allow-file-access-from-files', `--window-size=${gen.W},${gen.H}`, '--hide-scrollbars',
    '--virtual-time-budget=3000', '--dump-dom', `file:///${f.replace(/\\/g, '/')}`],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 * 200, stdio: ['ignore', 'pipe', 'ignore'] });
  const m = dom.match(/MERENI:(-?\d+);KDE:([^<"]*)/);
  return m ? { pretek: Number(m[1]), kde: m[2].trim() } : null;
}

const jen = process.argv[2];
const temata = readdirSync(SCENARE).filter((f) => f.endsWith('.json'))
  .map((f) => f.replace('.json', '')).filter((t) => !jen || t === jen);

let vadnych = 0, slidu = 0, nezmereno = 0;
for (const tema of temata) {
  const scenar = JSON.parse(readFileSync(path.join(SCENARE, tema + '.json'), 'utf8'));
  const n = scenar.slides.length;
  const spatne = [];
  for (let i = 0; i < n; i++) {
    const s = scenar.slides[i];
    const kind = gen.KINDS[s.kind] || gen.KINDS.point;
    const html = gen.page(kind(s, i + 1, n), i + 1, n);
    const v = pretekaO(html);
    slidu++;
    if (v === null) { nezmereno++; spatne.push((i + 1) + ' (nezměřeno)'); continue; }
    // Pár pixelů je zaokrouhlení, ne přetečení. Nad 2 px už mizí text.
    if (v.pretek > 2) { vadnych++; spatne.push('slide ' + (i + 1) + ' o ' + v.pretek + ' px v ' + v.kde); }
  }
  console.log((spatne.length ? '🔴 ' : '✅ ') + tema.padEnd(38)
    + (spatne.length ? spatne.join(', ') : n + ' slidů v pořádku'));
}

console.log('');
console.log('Témat: ' + temata.length + ' · slidů: ' + slidu
  + ' · přetéká: ' + vadnych + (nezmereno ? ' · nezměřeno: ' + nezmereno : ''));
if (vadnych || nezmereno) {
  console.log('⛔ Nepřegenerovávej, dokud tohle nebude nula. Oříznutý text na PNG nepoznáš.');
  process.exit(1);
}
console.log('✅ Nic nepřetéká, obrázky se dají vyrobit.');
