#!/usr/bin/env node
// Vygeneruje brandove OG sdileci obrazky (1200x630) v dark+gold palete webu.
// Nahrazuje puvodni generate-og.py (Python/PIL, oranzova era).
// Spusteni:  node scripts/generate-og.js            (potrebuje `sharp` v node_modules — viz OG_SHARP_DIR)
//            OG_SHARP_DIR=<dir s node_modules/sharp> node scripts/generate-og.js [jen-slug]
// Vystup:    assets/og-default.jpg, og-makro-plan.jpg, og-forma-zpet.jpg, assets/og/clanky/*.jpg
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const sharpDir = process.env.OG_SHARP_DIR;
const sharp = require(sharpDir ? path.join(sharpDir, 'node_modules', 'sharp') : 'sharp');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'og-'));

const GOLD = '#EBB12C', GOLD_SOFT = '#F6CD63', INK = '#1A1222';

// Poppins jako base64 data URI (file:// CORS blokuje externi woff2 -> vlozime primo)
const FDIR = path.join(ROOT, 'assets/vendor/fonts');
const FONTCSS = [400, 600, 700, 800].map((w) => ['', '-ext'].map((v) => {
  const b64 = fs.readFileSync(path.join(FDIR, `poppins-latin${v}-${w}.woff2`)).toString('base64');
  return `@font-face{font-family:'Poppins';font-weight:${w};src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
}).join('')).join('\n');

// Barlow Condensed pro ARENA display titulky (stejny podklad jako web)
const BFDIR = path.join(ROOT, 'assets/vendor/fonts');
let BARLOWCSS = '';
try {
  BARLOWCSS = [600, 700, 800].map((w) => {
    const file = path.join(BFDIR, `barlow-condensed-latin-ext-${w}.woff2`);
    if (!fs.existsSync(file)) return '';
    const b64 = fs.readFileSync(file).toString('base64');
    return `@font-face{font-family:'Barlow Condensed';font-weight:${w};src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  }).join('');
  // latin zaklad (bez -ext) pro jistotu
  BARLOWCSS += [600, 700, 800].map((w) => {
    const file = path.join(BFDIR, `barlow-condensed-latin-${w}.woff2`);
    if (!fs.existsSync(file)) return '';
    const b64 = fs.readFileSync(file).toString('base64');
    return `@font-face{font-family:'Barlow Condensed';font-weight:${w};src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:U+0000-00FF;}`;
  }).join('');
} catch (e) { /* bez Barlow spadneme na Arial Narrow */ }

// Martinova fotka (puvodni barvy) — na malych nahledech FB/WhatsApp nese identitu lip nez text
const HERO_URI = 'file:///' + path.join(ROOT, 'assets/foto/martin/hero.jpg').replace(/\\/g, '/');

function page(body) {
  return `<!DOCTYPE html><html lang="cs"><head><meta charset="UTF-8">
<style>${FONTCSS}${BARLOWCSS}</style>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;font-family:'Poppins',Arial,sans-serif;color:#f0eadf;
 background:#0C0B10;position:relative;}
.stripe{position:absolute;left:0;top:0;width:14px;height:630px;background:linear-gradient(180deg,${GOLD_SOFT},${GOLD});z-index:5;}
.mark{width:66px;height:66px;border-radius:12px;background:linear-gradient(145deg,${GOLD_SOFT},${GOLD});color:#161616;
 font-weight:800;font-size:34px;display:flex;align-items:center;justify-content:center;font-family:'Poppins',Arial,sans-serif;}
.kick{font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;color:${GOLD_SOFT};letter-spacing:.22em;
 font-weight:600;font-size:27px;text-transform:uppercase;padding-left:52px;position:relative;white-space:nowrap;}
.kick::before{content:"";position:absolute;left:0;top:52%;width:36px;height:4px;background:${GOLD};}
.disp{font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-weight:800;text-transform:uppercase;line-height:.9;color:#fff;}
.tag{display:inline-block;background:rgba(235,177,44,.16);border:2px solid rgba(235,177,44,.45);color:${GOLD_SOFT};
 font-weight:700;font-size:28px;letter-spacing:2px;padding:8px 26px;border-radius:4px;text-transform:uppercase;}
</style></head><body>${body}</body></html>`;
}

// Martinova fotka vpravo (PUVODNI barvy, jeho pravidlo) — na malych FB/WhatsApp/LinkedIn
// nahledech nese identitu znacky i kdyz text zmizi (obliceje se poznaji). Meke prolnuti
// do tmave vlevo, aby text vlevo zustal citelny, + tenka zlata hrana vpravo.
function photoRight(w) {
  return `<div style="position:absolute;top:0;right:0;width:${w}px;height:630px;overflow:hidden;z-index:1">
    <img src="${HERO_URI}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:57% 15%">
    <div style="position:absolute;inset:0;background:linear-gradient(90deg,#0C0B10 0%,rgba(12,11,16,.62) 20%,rgba(12,11,16,0) 66%)"></div>
    <div style="position:absolute;top:0;right:0;width:8px;height:630px;background:${GOLD}"></div>
  </div>`;
}

function brandDefault() {
  return page(`<div class="stripe"></div>
  ${photoRight(478)}
  <div style="position:relative;z-index:3;height:100%;padding:74px 0 62px 82px;display:flex;flex-direction:column">
    <div class="kick">Online výživa &amp; fitness koučink</div>
    <div class="disp" style="font-size:132px;margin-top:30px">Martin<br>Barna</div>
    <div style="font-size:45px;font-weight:600;color:#f0eadf;margin-top:34px;line-height:1.1">Forma podle vědy.<br><span style="color:${GOLD_SOFT}">Ne podle pocitů.</span></div>
    <div style="margin-top:auto;display:flex;align-items:center;gap:24px">
      <span style="font-weight:800;font-size:33px;color:#fff">martinbarna.cz</span>
      <span style="width:7px;height:7px;border-radius:50%;background:${GOLD};display:inline-block"></span>
      <span style="font-size:26px;color:#b9ada0">od 2013 · 600+ klientů</span>
    </div>
  </div>`);
}

function planCard(sub, kcal, rows) {
  const rowHtml = rows.map(([d, meals]) => `
    <div style="display:flex;align-items:center;gap:22px;padding:15px 0;border-bottom:1px solid rgba(255,255,255,.09)">
      <div style="width:58px;height:52px;border-radius:12px;background:linear-gradient(145deg,${GOLD_SOFT},${GOLD});color:#161616;font-weight:800;font-size:26px;display:flex;align-items:center;justify-content:center">${d}</div>
      <div style="font-size:28px;color:#e7e0d5;flex:1">${meals}</div>
      <div style="font-size:28px;color:${GOLD};font-weight:700;white-space:nowrap">${kcal}</div>
    </div>`).join('');
  return page(`<div class="stripe"></div>
  <div style="margin:44px 48px 0;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.12);border-radius:26px;padding:36px 44px 26px;position:relative">
    <div style="position:absolute;top:36px;right:44px;background:linear-gradient(145deg,${GOLD_SOFT},${GOLD});color:${INK};font-weight:800;font-size:30px;padding:12px 34px;border-radius:50px">ZDARMA</div>
    <div style="font-weight:800;font-size:58px;color:#fff">7denní makro plán</div>
    <div style="font-size:32px;color:#b9ada0;margin:4px 0 16px">${sub}</div>
    ${rowHtml}
    <div style="display:flex;gap:16px;margin-top:20px">
      ${['Bílkoviny ✓', 'Nákupní seznam ✓', 'Varianty ✓'].map((b) => `<span style="background:rgba(235,177,44,.13);border:1px solid rgba(235,177,44,.35);color:${GOLD_SOFT};font-weight:700;font-size:25px;padding:9px 24px;border-radius:50px">${b}</span>`).join('')}
    </div>
  </div>
  <div style="display:flex;justify-content:space-between;margin:22px 52px 0">
    <span style="font-weight:800;font-size:30px;color:#fff">martinbarna.cz</span>
    <span style="font-weight:800;font-size:30px;color:${GOLD}">Be Effective.</span>
  </div>`);
}

function cleanTitle(t) {
  // em-dash uprostred titulku -> tecka (po ?/!) nebo dvojtecka; na sdileci karte nechceme AI tic
  return t.replace(/([^ ]) — (.)/g, (m, a, b) =>
    /[?!.]/.test(a) ? `${a} ${b.toUpperCase()}` : `${a}: ${b}`);
}

function articleCard(tag, title) {
  title = cleanTitle(title);
  const L = title.length;
  const fs1 = L > 78 ? 50 : L > 54 ? 58 : L > 34 ? 68 : 78;
  return page(`<div class="stripe"></div>
  ${photoRight(392)}
  <div style="position:relative;z-index:3;height:100%;padding:58px 0 54px 82px;display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;gap:20px">
      <div class="mark">MB</div>
      <div>
        <div style="font-weight:800;font-size:30px;color:#fff;letter-spacing:.5px;line-height:1.05">MARTIN BARNA</div>
        <div style="font-weight:600;font-size:20px;color:${GOLD};letter-spacing:2.5px">ONLINE VÝŽIVA &amp; FITNESS</div>
      </div>
    </div>
    <div style="margin-top:38px"><span class="tag">${tag}</span></div>
    <div style="font-weight:800;font-size:${fs1}px;line-height:1.15;color:#fff;margin-top:26px;max-width:720px">${title}</div>
    <div style="margin-top:auto;font-weight:700;font-size:28px;color:#b9ada0">martinbarna.cz</div>
  </div>`);
}

function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

async function render(html, outJpg) {
  const tmpHtml = path.join(TMP, path.basename(outJpg) + '.html');
  const tmpPng = path.join(TMP, path.basename(outJpg) + '.png');
  fs.writeFileSync(tmpHtml, html, 'utf8');
  execFileSync(CHROME, ['--headless=old', '--disable-gpu', '--allow-file-access-from-files',
    '--window-size=1200,630', '--hide-scrollbars', '--virtual-time-budget=3000',
    `--screenshot=${tmpPng}`, `file:///${tmpHtml.replace(/\\/g, '/')}`],
    { stdio: 'ignore' });
  if (outJpg.endsWith('.png')) await sharp(tmpPng).png().toFile(outJpg);
  else await sharp(tmpPng).jpeg({ quality: 88 }).toFile(outJpg);
}

(async () => {
  const only = process.argv[2] || null;
  const jobs = [];

  if (!only || only === 'og-default') jobs.push(['assets/og-default.jpg', brandDefault()]);
  if (!only || only === 'og-makro-plan') jobs.push(['assets/og-makro-plan.jpg', planCard('pro ženy 30+', '1 500 kcal', [
    ['Po', 'Tvarohová kaše · kuřecí s rýží · omeleta'], ['Út', 'Vajíčka · losos s bramborem · skyr'],
    ['St', 'Ovesná · těstoviny s masem · tvaroh'], ['Čt', 'Jogurt · hovězí s rýží · zelenina'],
    ['Pá', 'Toast s vejci · kuřecí wrap · tvaroh'],
  ])]);
  if (!only || only === 'og-forma-zpet') jobs.push(['assets/og-forma-zpet.jpg', planCard('pro muže 35+', '2 000 kcal', [
    ['Po', 'Vejce s avokádem · kuřecí s rýží · losos'], ['Út', 'Ovesná · hovězí s bramborem · tvaroh'],
    ['St', 'Skyr · krabička z práce · krůtí'], ['Čt', 'Omeleta · těstoviny s masem · ryba'],
    ['Pá', 'Toast s vejci · fit burger · kuře'],
  ])]);

  // strankove OG karty v assets/og/ (title z og:title dane stranky)
  const PAGES = [
    ['akademie.png', 'akademie/index.html', 'BARNA ACADEMY'],
    ['kalkulacka.jpg', 'kalkulacka-kalorii-a-makrozivin/index.html', 'NÁSTROJ ZDARMA'],
    ['nastroje-zdarma.jpg', 'nastroje-zdarma/index.html', 'NÁSTROJE ZDARMA'],
    ['konzultace.jpg', 'koucing/index.html', 'KOUČINK'],
    ['koucing.jpg', 'koucing/index.html', 'KOUČINK'],
    ['prednasky.jpg', 'prednasky/index.html', 'PŘEDNÁŠKY'],
    ['pro-trenery.jpg', 'pro-trenery/index.html', 'PRO TRENÉRY A PORADCE'],
    ['reference.jpg', 'reference/index.html', 'REFERENCE'],
    ['treninky.jpg', 'treninky.html', 'TRÉNINKY'],
    ['videokurz.jpg', 'videokurz.html', 'VIDEOKURZ'],
  ];
  for (const [img, src, tag] of PAGES) {
    if (only && only !== img.replace(/\.(png|jpg)$/, '')) continue;
    const p = path.join(ROOT, src);
    if (!fs.existsSync(p) || !fs.existsSync(path.join(ROOT, 'assets/og', img))) continue;
    const s = fs.readFileSync(p, 'utf8');
    let title = decode((s.match(/property="og:title" content="([^"]+)"/) || [])[1] || '');
    title = title.replace(/\s*[—|·-]\s*Martin Barna.*$/, '');
    jobs.push([`assets/og/${img}`, articleCard(tag, title)]);
  }

  // clankove OG: jen pro existujici assets/og/clanky/<slug>.jpg (stejne nazvy)
  const ogDir = path.join(ROOT, 'assets/og/clanky');
  if (fs.existsSync(ogDir)) {
    for (const f of fs.readdirSync(ogDir).filter((x) => x.endsWith('.jpg'))) {
      const slug = f.replace(/\.jpg$/, '');
      if (only && only !== slug) continue;
      const art = path.join(ROOT, 'clanky', slug + '.html');
      if (!fs.existsSync(art)) { console.log('SKIP (clanek chybi):', slug); continue; }
      const s = fs.readFileSync(art, 'utf8');
      const title = decode((s.match(/property="og:title" content="([^"]+)"/) || [])[1] || slug);
      const tag = decode((s.match(/<span class="tag">([^<]+)<\/span>/) || [])[1] || 'ČLÁNEK');
      jobs.push([`assets/og/clanky/${f}`, articleCard(tag, title)]);
    }
  }

  let n = 0;
  for (const [rel, html] of jobs) {
    await render(html, path.join(ROOT, rel));
    n++;
    if (n % 20 === 0) console.log(`${n}/${jobs.length}...`);
  }
  console.log(`OK -> ${n} OG obrazku (dark+gold)`);
})();
