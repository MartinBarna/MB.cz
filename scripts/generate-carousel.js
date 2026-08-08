#!/usr/bin/env node
// Dark-gold generátor infografických carouselů (10 slidů 1080×1350, 4:5 pro IG/FB).
// Nahrazuje oranžovou éru (~370 plochých PNG na Drive) pro NOVÁ témata — stará se nepředělávají.
// Vstup:  _zdroje/infografiky/<slug>.json  (scénář tématu — viz SLIDE KINDS níže)
// Výstup: _zdroje/infografiky/<slug>/01.png … 10.png
// Spuštění:  node scripts/generate-carousel.js <slug>            (potřebuje sharp — viz OG_SHARP_DIR)
//            OG_SHARP_DIR=<dir s node_modules/sharp> node scripts/generate-carousel.js <slug>
//
// SLIDE KINDS (pole slides[] ve scénáři):
//  cover   {kicker, title, sub}                  — 01: obálka s velkým titulkem
//  point   {kicker, title, body}                 — obecný obsahový slide (odstavec)
//  bullets {kicker, title, items:[..]}           — odrážky (max 5)
//  stat    {kicker, big, unit, body}             — velké číslo (data ze studie)
//  graf    {kicker, title, bars:[{label,value,jednotka,tlumit}], body} — sloupcové srovnání
//  vs      {kicker, title, yes:{h,items}, no:{h,items}} — srovnání dvou sloupců
//  quote   {text, note}                          — výrok Martinovým hlasem
//  cta     {title, lines:[..]}                   — 10: závěr + kam dál (martinbarna.cz)
//
// Společná pole pro point / bullets / stat / vs (viz funkce `patka`):
//  callout {string}                              — zvýrazněný rámeček s poznámkou
//  zdroj   {kdo, kde, doi} nebo {string}         — citace studie (autor, časopis, DOI)
//  pozn    {string}                              — vysvětlivka pod čarou („IgG = protilátka…")
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const sharpDir = process.env.OG_SHARP_DIR;
const sharp = require(sharpDir ? path.join(sharpDir, 'node_modules', 'sharp') : 'sharp');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'carousel-'));

const GOLD = '#EBB12C', GOLD_SOFT = '#F6CD63', INK = '#1A1222';
const W = 1080, H = 1350;

// Poppins + Barlow Condensed jako base64 (file:// CORS blokuje externí woff2)
const FDIR = path.join(ROOT, 'assets/vendor/fonts');
const FONTCSS = [400, 600, 700, 800].map((w) => ['', '-ext'].map((v) => {
  const b64 = fs.readFileSync(path.join(FDIR, `poppins-latin${v}-${w}.woff2`)).toString('base64');
  return `@font-face{font-family:'Poppins';font-weight:${w};src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
}).join('')).join('\n');
let BARLOWCSS = '';
try {
  BARLOWCSS = [600, 700, 800].map((w) => ['-ext', ''].map((v) => {
    const file = path.join(FDIR, `barlow-condensed-latin${v}-${w}.woff2`);
    if (!fs.existsSync(file)) return '';
    const b64 = fs.readFileSync(file).toString('base64');
    return `@font-face{font-family:'Barlow Condensed';font-weight:${w};src:url(data:font/woff2;base64,${b64}) format('woff2');${v ? '' : 'unicode-range:U+0000-00FF;'}}`;
  }).join('')).join('');
} catch (e) { /* fallback Arial Narrow */ }

function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])); }

/** Velikost hlavní hodnoty na slidu `stat`.
 *  ⛔ Dřív tu bylo natvrdo 210px. To sedí na čísla („609", „0"), ale slide se dá naplnit
 *  i SLOVEM, a to se do šířky nevejde. Odhalila to kontrola přetečení 27. 7. 2026:
 *  `hubnuti-a-zdravi-mozku` slide 4 má big „Klidnější" a vytékal o 71 px doprava.
 *  Byla to starší vada, se změnou písma titulků nesouvisí (tenhle prvek není h1).
 *  Použitelná šířka je 1080 minus 2× 84 px odsazení, tedy 912 px. */
function bigPx(hodnota) {
  const n = String(hodnota == null ? '' : hodnota).length;
  if (n <= 4) return 210;
  if (n <= 6) return 150;
  if (n <= 8) return 120;
  return 96;
}

function page(body, pageNo, total) {
  const foot = pageNo === 1 ? '' :
    `<div class="foot"><span>martinbarna.cz</span><span>${pageNo} / ${total}</span></div>`;
  return `<!DOCTYPE html><html lang="cs"><head><meta charset="UTF-8">
<style>${FONTCSS}${BARLOWCSS}</style>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;font-family:'Poppins',Arial,sans-serif;color:#F0EADF;
 background:linear-gradient(165deg,#15171a 0%,#0f1113 100%);position:relative;}
.stripe{position:absolute;left:0;top:0;width:12px;height:${H}px;background:linear-gradient(180deg,${GOLD_SOFT},${GOLD});z-index:5;}
/* Spodní odsazení MUSÍ uhlídat patičku. Ta je absolutní: sedí 44 px ode dna a je
   57 px vysoká, takže zabírá spodních 101 px plátna. Dokud tu bylo 96 px, sahal
   obsah 5 px POD její horní hranu a text se překrýval. U rámečku s pozadím to jen
   ošklivě splývalo, u vysvětlivky pod čarou byl výsledek nečitelný.
   Změřeno 31. 7. 2026: pozn 1220..1254, foot 1249..1306. 124 = 101 + odstup. */
.wrap{position:relative;z-index:2;height:100%;display:flex;flex-direction:column;padding:84px 84px 124px;}
.brandrow{display:flex;align-items:center;gap:18px;margin-bottom:56px;}
.mark{width:64px;height:64px;border-radius:16px;background:linear-gradient(145deg,${GOLD_SOFT},${GOLD});color:${INK};
 font-weight:800;font-size:30px;display:flex;align-items:center;justify-content:center;}
.brand{font-weight:800;font-size:26px;line-height:1.15;color:#fff;}
.brand span{display:block;color:${GOLD_SOFT};font-weight:600;font-size:17px;letter-spacing:3px;text-transform:uppercase;}
.kick{font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;color:${GOLD_SOFT};letter-spacing:.2em;
 font-weight:600;font-size:30px;text-transform:uppercase;padding-left:52px;position:relative;margin-bottom:26px;white-space:nowrap;}
.kick::before{content:"";position:absolute;left:0;top:50%;width:36px;height:4px;background:${GOLD};}
/* [zmena 27. 7. 2026] Titulky zpatky na Poppins normalnim pismem, jako maji PUVODNI
   oranzove infografiky. Barlow Condensed s vynucenymi verzalkami dava jiny charakter:
   sevrenejsi a lacinejsi. Martin: „chci to uplne stejne, jen v novem kabate barev",
   takze se meni jen paleta, ne rez pisma.
   ⚠️ Poppins je vyrazne SIRSI nez Barlow Condensed, proto se u vsech typu slidu
   zmensily velikosti titulku (zhruba na 0,73). Bez toho by delsi titulek pretekl
   a pravidlo overflow:hidden na body by ho TISE OREZALO.
   ⛔ Pozor: tenhle komentar je UVNITR sablonoveho retezce, takze v nem NESMI byt
   zpetny apostrof. Poprve to tu spadlo prave na nem. */
h1{font-family:'Poppins',Arial,sans-serif;font-weight:800;line-height:1.05;color:#fff;letter-spacing:-.01em;}
h1 .hl{color:${GOLD};}
.body{font-size:37px;line-height:1.5;color:#d9d5df;}
.body b{color:#F0EADF;}
.foot{position:absolute;left:84px;right:84px;bottom:44px;display:flex;justify-content:space-between;
 border-top:2px solid rgba(255,255,255,.12);padding-top:20px;font-size:24px;color:#8F8A99;z-index:3;}
.callout{background:rgba(235,177,44,.09);border-left:8px solid ${GOLD};border-radius:0 18px 18px 0;padding:34px 38px;font-size:34px;line-height:1.45;color:#F0EADF;}
.zdroj{background:rgba(255,255,255,.045);border-left:6px solid ${GOLD};border-radius:0 14px 14px 0;
 padding:18px 26px;margin-top:18px;}
.zdroj em{display:block;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;color:${GOLD_SOFT};
 letter-spacing:.18em;font-weight:700;font-size:21px;text-transform:uppercase;font-style:normal;margin-bottom:6px;}
.zdroj b{display:block;font-weight:700;font-size:28px;color:#F0EADF;line-height:1.3;}
.zdroj span{display:block;font-size:25px;color:#a9a3b3;line-height:1.35;}
.zdroj i{display:block;font-size:22px;color:#8F8A99;line-height:1.35;margin-top:4px;}
.pozn{font-size:24px;line-height:1.4;color:#8F8A99;font-style:italic;margin-top:16px;}
/* Kompaktni zdroj pro slidy, kde na box neni misto (typicky srovnavaci slide se
   dvema sloupci). Nese totez co box, jen bez ramecku a popisku, usetri asi 50 px.
   Zadny zpetny apostrof, jsme uvnitr sablonoveho retezce. */
.zdrojmini{font-size:23px;line-height:1.35;color:#8F8A99;margin-top:18px;}
.zdrojmini b{color:#a9a3b3;font-weight:700;}
.dots{position:absolute;right:84px;top:96px;display:flex;gap:10px;z-index:3;}
.dots i{width:12px;height:12px;border-radius:50%;background:rgba(255,255,255,.16);}
.dots i.on{background:${GOLD};}
</style></head><body><div class="stripe"></div>${body}${foot}</body></html>`;
}

function dots(i, total) {
  let s = '<div class="dots">';
  for (let k = 1; k <= total; k++) s += `<i${k === i ? ' class="on"' : ''}></i>`;
  return s + '</div>';
}
const BRAND = `<div class="brandrow"><div class="mark">MB</div><div class="brand">Martin Barna<span>online výživa &amp; fitness</span></div></div>`;

/** Spodní blok slidu: rámeček s poznámkou, box se zdrojem a vysvětlivka pod čarou.
 *
 *  ⛔ PROČ TU JSOU VŠECHNY TŘI: původní oranžové infografiky měly tři oddělené bloky,
 *  ale tahle šablona měla dlouho jen `callout`. Text se proto při rebrandu neměl kam
 *  vrátit a tiše se zahodil. Změřeno 31. 7. 2026 přes všech 35 přepsaných témat
 *  (`scripts/porovnat-infografiky-se-starymi.mjs`): ztratilo se 397 kusů obsahu,
 *  z toho 53 DOI, 36 vysvětlivek a 273 čísel. Nebyla to nedbalost pisatele, byla to
 *  chybějící kolonka. Kdo tuhle šablonu zjednodušuje, ať ví, co tím rozbije.
 *
 *  `zdroj` bere buď hotový řetězec, nebo {kdo, kde, doi}. Rozdělené je lepší, protože
 *  DOI se pak sází jinak než jméno autora a nedá se přehlédnout. */
function patka(s, auto = true, kompakt = false) {
  // Dva rámečky pod sebou se na plátno nevejdou a jsou i opticky těžké. Když už
  // slide nese zvýrazněný callout, sází se zdroj jen jako nenápadný řádek. Ušetří
  // to zhruba 50 px a je to jediný důvod, proč se 5 slidů vešlo (změřeno 31. 7.).
  if (s.callout && s.zdroj) kompakt = true;
  const z = s.zdroj;
  const casti = typeof z === 'string' ? [z] : z ? [z.kdo, z.kde, z.doi && 'DOI: ' + z.doi].filter(Boolean) : [];
  const zdroj = !z ? ''
    : kompakt ? `<div class="zdrojmini"><b>Zdroj:</b> ${casti.map(esc).join(', ')}</div>`
    // Řetězcový zdroj se musí zabalit do <span>, jinak zdědí výchozí velikost písma
    // prohlížeče a vysází se drobně. Strukturovaný zdroj má styl na <b>/<span>/<i>.
    : `<div class="zdroj"><em>Zdroj</em>${typeof z === 'string' ? `<span>${z}</span>`
      : `${z.kdo ? `<b>${z.kdo}</b>` : ''}${z.kde ? `<span>${z.kde}</span>` : ''}${z.doi ? `<i>DOI: ${esc(z.doi)}</i>` : ''}`}</div>`;
  const callout = s.callout ? `<div class="callout">${s.callout}</div>` : '';
  const pozn = s.pozn ? `<div class="pozn">${s.pozn}</div>` : '';
  if (!callout && !zdroj && !pozn) return '';
  return `<div${auto ? ' style="margin-top:auto"' : ''}>${callout}${zdroj}${pozn}</div>`;
}

const KINDS = {
  cover(s) {
    return `<div class="wrap">${BRAND}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-bottom:120px">
        ${s.kicker ? `<div class="kick">${esc(s.kicker)}</div>` : ''}
        <h1 style="font-size:92px">${s.title}</h1>
        ${s.sub ? `<div class="body" style="margin-top:44px;font-size:40px;color:#ece8f0">${s.sub}</div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:16px;font-weight:700;font-size:30px;color:${GOLD_SOFT}">Posuň dál <span style="font-size:40px">→</span></div>
    </div>`;
  },
  point(s, i, n) {
    return `<div class="wrap">${BRAND}${dots(i, n)}
      ${s.kicker ? `<div class="kick">${esc(s.kicker)}</div>` : ''}
      <h1 style="font-size:58px;margin-bottom:44px">${s.title}</h1>
      <div class="body">${s.body || ''}</div>
      ${patka(s)}
    </div>`;
  },
  bullets(s, i, n) {
    const items = (s.items || []).slice(0, 5).map((it, k) =>
      `<div style="display:flex;gap:26px;margin-bottom:34px;align-items:flex-start">
        <div style="flex:none;width:58px;height:58px;border-radius:50%;background:${GOLD};color:${INK};font-weight:800;font-size:30px;display:flex;align-items:center;justify-content:center">${k + 1}</div>
        <div class="body" style="padding-top:6px">${it}</div>
      </div>`).join('');
    return `<div class="wrap">${BRAND}${dots(i, n)}
      ${s.kicker ? `<div class="kick">${esc(s.kicker)}</div>` : ''}
      <h1 style="font-size:54px;margin-bottom:48px">${s.title}</h1>${items}
      ${patka(s, true, (s.items || []).length >= 5)}
    </div>`;
  },
  stat(s, i, n) {
    // Na `stat` už prostor rozdělil `flex:1`, takže se patka NEodsazuje `margin-top:auto`.
    // Když je pod číslem ještě zdroj, sníží se spodní odsazení, jinak by to přeteklo.
    const p = patka(s, false);
    return `<div class="wrap">${BRAND}${dots(i, n)}
      ${s.kicker ? `<div class="kick">${esc(s.kicker)}</div>` : ''}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-bottom:${p ? 24 : 80}px">
        <div style="font-weight:800;font-size:${bigPx(s.big)}px;line-height:1;color:${GOLD}">${esc(s.big)}</div>
        ${s.unit ? `<div style="font-weight:700;font-size:${String(s.unit).length > 60 ? 34 : 40}px;color:${GOLD_SOFT};margin:6px 0 ${String(s.unit).length > 60 ? 30 : 40}px">${esc(s.unit)}</div>` : ''}
        <div class="body" style="font-size:${String(s.body || '').length > 200 ? 36 : 40}px">${s.body || ''}</div>
      </div>${p}
    </div>`;
  },
  /** Sloupcové srovnání dvou nebo tří hodnot.
   *  Vzniklo 31. 7. 2026 podle infografiky „Ploténky", kterou Martin označil za vzor:
   *  má tam skutečnou datovou vizualizaci, ne jen velké číslo. Velké číslo (`stat`)
   *  je dobré na JEDEN údaj. Jakmile jsou hodnoty dvě a mají se porovnat, čtenář
   *  potřebuje vidět rozdíl, ne ho počítat z textu.
   *  bars: [{ label, value, jednotka, tlumit }] */
  graf(s, i, n) {
    const b = (s.bars || []).slice(0, 4);
    const max = Math.max(...b.map((x) => Number(String(x.value).replace(',', '.')) || 0), 0.0001);
    // Označení statistické významnosti si vezme kus výšky, tak sloupce o kus zkrátíme.
    const VYSKA = s.rozdil ? 268 : 300;
    const sloupec = (x) => {
      const v = Number(String(x.value).replace(',', '.')) || 0;
      const h = Math.max(10, Math.round((v / max) * VYSKA));
      const zlaty = !x.tlumit;
      const vypln = zlaty
        ? `linear-gradient(180deg,${GOLD} 0%,rgba(235,177,44,.14) 100%)`
        : 'linear-gradient(180deg,#57525f 0%,rgba(87,82,95,.12) 100%)';
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end">
        <div style="font-weight:800;font-size:62px;line-height:1;color:${zlaty ? GOLD : '#9a94a4'};margin-bottom:16px;white-space:nowrap">${esc(x.value)}${x.jednotka ? `<span style="font-size:34px;font-weight:700"> ${esc(x.jednotka)}</span>` : ''}</div>
        <div style="width:70%;height:${h}px;border-radius:20px 20px 0 0;background:${vypln}"></div>
      </div>`;
    };
    // Popisek se NEescapuje, aby v něm šlo zalomit řádek přes <br>. Ostatní pole
    // v grafu escapovaná jsou; sem se píšou jen naše texty, ne vstup od uživatele.
    const popisky = b.map((x) => `<div style="flex:1;text-align:center;font-weight:700;font-size:27px;line-height:1.3;color:#a9a3b3;padding:0 8px">${x.label}</div>`).join('');
    return `<div class="wrap">${BRAND}${dots(i, n)}
      ${s.kicker ? `<div class="kick">${esc(s.kicker)}</div>` : ''}
      <h1 style="font-size:54px;margin-bottom:40px">${s.title}</h1>
      <div style="display:flex;align-items:flex-end;gap:32px;height:${VYSKA + 90}px">${b.map(sloupec).join('')}</div>
      <div style="display:flex;gap:32px;border-top:2px solid rgba(255,255,255,.14);padding-top:16px">${popisky}</div>
      ${s.rozdil ? `<div style="text-align:center;margin-top:18px"><span style="display:inline-block;border:2px dashed rgba(235,177,44,.45);border-radius:999px;padding:10px 26px;font-weight:700;font-size:25px;color:${GOLD_SOFT}">${esc(s.rozdil)}</span></div>` : ''}
      ${s.body ? `<div class="body" style="margin-top:${s.rozdil ? 26 : 34}px;font-size:33px">${s.body}</div>` : ''}
      ${patka(s, true, true)}
    </div>`;
  },
  vs(s, i, n) {
    // Dva sloupce plné odrážek zaberou skoro celé plátno, takže zdroj se sem vejde
    // jen jako kompaktní řádek a sloupce se zároveň o kus stáhnou. Bez toho slide
    // přeteče o zhruba 100 px (změřeno na `kloubni-vyziva` a `sacharidy-pred-treninkem`).
    const husto = !!(s.zdroj || s.pozn);
    const col = (c, color) => `<div style="flex:1;background:rgba(255,255,255,.03);border:2px solid ${color};border-radius:24px;padding:${husto ? '26px 30px' : '36px 34px'}">
      <div style="font-weight:800;font-size:34px;color:${color};margin-bottom:${husto ? 16 : 22}px">${esc(c.h)}</div>
      ${(c.items || []).map((it) => `<div style="font-size:30px;line-height:1.4;color:#d9d5df;margin-bottom:${husto ? 13 : 18}px;padding-left:30px;position:relative"><span style="position:absolute;left:0;color:${color};font-weight:800">•</span>${it}</div>`).join('')}
    </div>`;
    return `<div class="wrap">${BRAND}${dots(i, n)}
      ${s.kicker ? `<div class="kick">${esc(s.kicker)}</div>` : ''}
      <h1 style="font-size:52px;margin-bottom:${husto ? 32 : 44}px">${s.title}</h1>
      <div style="display:flex;flex-direction:column;gap:${husto ? 20 : 26}px">${col(s.yes, GOLD)}${col(s.no, '#e07a7a')}</div>
      ${patka(s, true, true)}
    </div>`;
  },
  quote(s, i, n) {
    return `<div class="wrap">${BRAND}${dots(i, n)}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-bottom:100px">
        <div style="font-family:Georgia,serif;font-size:190px;line-height:.5;color:${GOLD};opacity:.5;margin-bottom:30px">“</div>
        <div style="font-weight:800;font-size:64px;line-height:1.25;color:#fff">${s.text}</div>
        ${s.note ? `<div class="body" style="margin-top:40px;font-size:34px">${s.note}</div>` : ''}
        <div style="margin-top:52px;display:flex;align-items:center;gap:22px">
          <span style="width:54px;height:6px;background:${GOLD};border-radius:3px"></span>
          <span style="font-weight:700;font-size:32px;color:${GOLD_SOFT}">Martin Barna</span>
        </div>
      </div>
    </div>`;
  },
  cta(s, i, n) {
    const lines = (s.lines || []).map((l) =>
      `<div style="font-size:34px;line-height:1.45;color:#ded9e4;margin-bottom:20px;padding-left:44px;position:relative"><span style="position:absolute;left:0;color:${GOLD};font-weight:800">→</span>${l}</div>`).join('');
    return `<div class="wrap">${BRAND}${dots(i, n)}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-bottom:60px">
        <h1 style="font-size:64px;margin-bottom:48px">${s.title}</h1>
        <div style="background:linear-gradient(160deg,#211b26 0%,#17131c 100%);border:2px solid rgba(235,177,44,.35);border-radius:28px;padding:48px 46px">${lines}</div>
        <div style="margin-top:48px;display:flex;justify-content:space-between;align-items:baseline">
          <span style="font-weight:800;font-size:38px;color:#fff">martinbarna.cz</span>
          <span style="font-weight:800;font-size:34px;color:${GOLD}">Be Effective!</span>
        </div>
      </div>
    </div>`;
  },
};

async function render(html, outPng) {
  const tmpHtml = path.join(TMP, path.basename(outPng) + '.html');
  const tmpPng = path.join(TMP, path.basename(outPng) + '.raw.png');
  fs.writeFileSync(tmpHtml, html, 'utf8');
  execFileSync(CHROME, ['--headless=old', '--disable-gpu', '--allow-file-access-from-files',
    `--window-size=${W},${H}`, '--hide-scrollbars', '--virtual-time-budget=3000',
    `--screenshot=${tmpPng}`, `file:///${tmpHtml.replace(/\\/g, '/')}`], { stdio: 'ignore' });
  await sharp(tmpPng).png().toFile(outPng);
}

// Vystaveno pro `scripts/kontrola-preteceni-infografik.mjs`, aby kontrola stavela
// HTML TOUTEZ funkci jako generator. Druha kopie sablony by se casem rozesla a
// kontrola by hlidala neco jineho, nez se doopravdy vyrenderuje.
module.exports = { page, KINDS, W, H, CHROME, TMP };

if (require.main !== module) return;

(async () => {
  const slug = process.argv[2];
  if (!slug) { console.error('Použití: node scripts/generate-carousel.js <slug>  (čte _zdroje/infografiky/<slug>.json)'); process.exit(1); }
  const src = path.join(ROOT, '_zdroje/infografiky', slug + '.json');
  if (!fs.existsSync(src)) { console.error('Scénář nenalezen:', src); process.exit(1); }
  const scenario = JSON.parse(fs.readFileSync(src, 'utf8'));
  const outDir = path.join(ROOT, '_zdroje/infografiky', slug);
  fs.mkdirSync(outDir, { recursive: true });
  const total = scenario.slides.length;
  for (let i = 0; i < total; i++) {
    const s = scenario.slides[i];
    const kind = KINDS[s.kind] || KINDS.point;
    const html = page(kind(s, i + 1, total), i + 1, total);
    const out = path.join(outDir, String(i + 1).padStart(2, '0') + '.png');
    await render(html, out);
    console.log('OK', path.relative(ROOT, out));
  }
  console.log(`Hotovo -> ${total} slidů (dark+gold, ${W}×${H})`);
})();
