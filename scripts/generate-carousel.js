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
//  vs      {kicker, title, yes:{h,items}, no:{h,items}} — srovnání dvou sloupců
//  quote   {text, note}                          — výrok Martinovým hlasem
//  cta     {title, lines:[..]}                   — 10: závěr + kam dál (martinbarna.cz)
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
.wrap{position:relative;z-index:2;height:100%;display:flex;flex-direction:column;padding:84px 84px 96px;}
.brandrow{display:flex;align-items:center;gap:18px;margin-bottom:56px;}
.mark{width:64px;height:64px;border-radius:16px;background:linear-gradient(145deg,${GOLD_SOFT},${GOLD});color:${INK};
 font-weight:800;font-size:30px;display:flex;align-items:center;justify-content:center;}
.brand{font-weight:800;font-size:26px;line-height:1.15;color:#fff;}
.brand span{display:block;color:${GOLD_SOFT};font-weight:600;font-size:17px;letter-spacing:3px;text-transform:uppercase;}
.kick{font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;color:${GOLD_SOFT};letter-spacing:.2em;
 font-weight:600;font-size:30px;text-transform:uppercase;padding-left:52px;position:relative;margin-bottom:26px;white-space:nowrap;}
.kick::before{content:"";position:absolute;left:0;top:50%;width:36px;height:4px;background:${GOLD};}
h1{font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-weight:800;text-transform:uppercase;line-height:.95;color:#fff;}
h1 .hl{color:${GOLD};}
.body{font-size:37px;line-height:1.5;color:#d9d5df;}
.body b{color:#F0EADF;}
.foot{position:absolute;left:84px;right:84px;bottom:44px;display:flex;justify-content:space-between;
 border-top:2px solid rgba(255,255,255,.12);padding-top:20px;font-size:24px;color:#8F8A99;z-index:3;}
.callout{background:rgba(235,177,44,.09);border-left:8px solid ${GOLD};border-radius:0 18px 18px 0;padding:34px 38px;font-size:34px;line-height:1.45;color:#F0EADF;}
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

const KINDS = {
  cover(s) {
    return `<div class="wrap">${BRAND}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-bottom:120px">
        ${s.kicker ? `<div class="kick">${esc(s.kicker)}</div>` : ''}
        <h1 style="font-size:126px">${s.title}</h1>
        ${s.sub ? `<div class="body" style="margin-top:44px;font-size:40px;color:#ece8f0">${s.sub}</div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:16px;font-weight:700;font-size:30px;color:${GOLD_SOFT}">Posuň dál <span style="font-size:40px">→</span></div>
    </div>`;
  },
  point(s, i, n) {
    return `<div class="wrap">${BRAND}${dots(i, n)}
      ${s.kicker ? `<div class="kick">${esc(s.kicker)}</div>` : ''}
      <h1 style="font-size:78px;margin-bottom:44px">${s.title}</h1>
      <div class="body">${s.body || ''}</div>
      ${s.callout ? `<div class="callout" style="margin-top:auto">${s.callout}</div>` : ''}
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
      <h1 style="font-size:72px;margin-bottom:48px">${s.title}</h1>${items}
    </div>`;
  },
  stat(s, i, n) {
    return `<div class="wrap">${BRAND}${dots(i, n)}
      ${s.kicker ? `<div class="kick">${esc(s.kicker)}</div>` : ''}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-bottom:80px">
        <div style="font-weight:800;font-size:210px;line-height:1;color:${GOLD}">${esc(s.big)}</div>
        ${s.unit ? `<div style="font-weight:700;font-size:40px;color:${GOLD_SOFT};margin:6px 0 40px">${esc(s.unit)}</div>` : ''}
        <div class="body" style="font-size:40px">${s.body || ''}</div>
      </div>
    </div>`;
  },
  vs(s, i, n) {
    const col = (c, color) => `<div style="flex:1;background:rgba(255,255,255,.03);border:2px solid ${color};border-radius:24px;padding:36px 34px">
      <div style="font-weight:800;font-size:34px;color:${color};margin-bottom:22px">${esc(c.h)}</div>
      ${(c.items || []).map((it) => `<div style="font-size:30px;line-height:1.4;color:#d9d5df;margin-bottom:18px;padding-left:30px;position:relative"><span style="position:absolute;left:0;color:${color};font-weight:800">•</span>${it}</div>`).join('')}
    </div>`;
    return `<div class="wrap">${BRAND}${dots(i, n)}
      ${s.kicker ? `<div class="kick">${esc(s.kicker)}</div>` : ''}
      <h1 style="font-size:70px;margin-bottom:44px">${s.title}</h1>
      <div style="display:flex;flex-direction:column;gap:26px">${col(s.yes, GOLD)}${col(s.no, '#e07a7a')}</div>
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
        <h1 style="font-size:88px;margin-bottom:48px">${s.title}</h1>
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
