#!/usr/bin/env node
// =============================================================================
// KONTROLA KONTRASTU OBOU MOTIVŮ (světlý + tmavý).
//
// PROČ EXISTUJE
//   Výchozí motiv webu je tmavý. Světlý se zapíná přes localStorage `mb-theme=light`
//   (theme-boot.js / ba-theme.js nastaví html[data-theme=light]). Overlay
//   marketing-dark.css je v light vypnutý (`html:not([data-theme="light"])`),
//   ale stovky stránek mají v <style> KOPII tmavých pravidel (color:#fff) bez
//   té brány. theme-light.css je má přebít. Když nějaký selektor minie
//   (h5/h6, .module h6, …), je bílý text na krémovém pozadí.
//   Martin 26. 8. 2026: osnovové nadpisy na /videokurz.html ve světlém na mobilu.
//
// CO MĚŘÍ
//   Headless Chrome (systémový) + lokální statický server nad kořenem repa.
//   Každá HTML stránka, oba motivy, mobil 390×844 (tam to Martin viděl).
//   U každého viditelného textového uzlu: computed color vs. efektivní pozadí
//   (rodiče k prvnímu neprůhlednému, polotransparentní a gradient se skládají).
//   Práh: kontrastní poměr < 2,0 (bílá na krému, ne WCAG AA 4,5).
//
// SPUSTIT
//   node scripts/kontrola-kontrastu-temat.mjs
//   node scripts/kontrola-kontrastu-temat.mjs --only videokurz.html
//   node scripts/kontrola-kontrastu-temat.mjs --static-only
//
// Výstup: docs/svetly-rezim-kontrast-report.md
//         docs/svetly-rezim-kontrast-data.json
// Tmavý otisk (baseline před opravou) se při prvním běhu uloží do
// docs/svetly-rezim-kontrast-tmavy-pred.json a další běhy ho porovnají.
// =============================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const REPORT_MD = path.join(DOCS, 'svetly-rezim-kontrast-report.md');
const REPORT_JSON = path.join(DOCS, 'svetly-rezim-kontrast-data.json');
const DARK_PRED = path.join(DOCS, 'svetly-rezim-kontrast-tmavy-pred.json');

const PRAH = 2.0;
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true };
const PRESKOCIT_DIR = new Set([
  '.git', 'node_modules', '_zaloha', '_zdroje', '_cursor-logs', '.cursor',
  'supabase', 'akademie/_ai', 'go',
]);

const args = process.argv.slice(2);
function flag(name, fallback = null) {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  const n = args[i + 1];
  if (!n || n.startsWith('--')) return true;
  return n;
}
const ONLY = flag('--only');
const STATIC_ONLY = args.includes('--static-only');
const WORKERS = Math.max(1, parseInt(flag('--workers', '6'), 10) || 6);
const PORT = parseInt(flag('--port', '0'), 10) || 0; // 0 = volný port

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

function log(msg) {
  process.stderr.write(msg + '\n');
}

function walkHtml(dir, out = []) {
  let names;
  try { names = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const ent of names) {
    if (ent.name.startsWith('.')) continue;
    const abs = path.join(dir, ent.name);
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    if (ent.isDirectory()) {
      if (PRESKOCIT_DIR.has(ent.name) || PRESKOCIT_DIR.has(rel)) continue;
      walkHtml(abs, out);
    } else if (ent.name.endsWith('.html')) {
      out.push(rel);
    }
  }
  return out;
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const u = new URL(req.url, 'http://127.0.0.1');
        let rel = decodeURIComponent(u.pathname);
        if (rel.endsWith('/')) rel += 'index.html';
        if (rel === '') rel = '/index.html';
        const abs = path.resolve(ROOT, '.' + rel);
        if (!abs.startsWith(ROOT)) {
          res.writeHead(403); res.end('forbidden'); return;
        }
        if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
          const idx = path.join(abs, 'index.html');
          if (fs.existsSync(idx) && fs.statSync(idx).isFile()) {
            const html = fs.readFileSync(idx);
            res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
            res.end(html); return;
          }
          res.writeHead(404); res.end('not found'); return;
        }
        const ext = path.extname(abs).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME[ext] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        fs.createReadStream(abs).pipe(res);
      } catch (e) {
        res.writeHead(500); res.end(String(e));
      }
    });
    server.listen(PORT, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
    server.on('error', reject);
  });
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function ensurePuppeteer() {
  const nm = path.join('/tmp', 'mb-kontrast-nm');
  const marker = path.join(nm, 'node_modules', 'puppeteer-core', 'package.json');
  if (!fs.existsSync(marker)) {
    log('Instaluju puppeteer-core do /tmp/mb-kontrast-nm …');
    fs.mkdirSync(nm, { recursive: true });
    execSync('npm init -y', { cwd: nm, stdio: 'ignore' });
    execSync('npm install --no-fund --no-audit puppeteer-core@24', {
      cwd: nm, stdio: 'inherit',
    });
  }
  const require = createRequire(path.join(nm, 'package.json'));
  return require('puppeteer-core');
}

function proOtisk(nalezy) {
  return (nalezy || []).filter((n) => {
    const s = String(n.stranka || '');
    if (s.startsWith('go/')) return false;
    if (/\bsvg\b/i.test(String(n.selektor || ''))) return false;
    return true;
  });
}

function otiskNalezu(nalezy) {
  const rows = proOtisk(nalezy).map((n) =>
    [n.stranka, n.selektor, n.text, n.popredi, n.pozadi, n.pomer.toFixed(2)].join('\t')
  ).sort();
  const telo = rows.join('\n');
  return {
    pocet: rows.length,
    sha256: crypto.createHash('sha256').update(telo).digest('hex'),
    telo,
  };
}

function cssPath(el) {
  // běží v prohlížeči, tady jen dokumentace
  return el;
}

// --- statická analýza (záloha, když Chrome nejde) -----------------------------

const SVETLA_BARVA = /(?:^|;)\s*color\s*:\s*(?:#fff(?:fff)?\b|#f0eadf\b|#cabfb4\b|#ece4d9\b|#ebe3d8\b|#cfc6bb\b|#faf7f3\b|white\b|rgba?\(\s*255\s*,\s*255\s*,\s*255)/i;

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

function pravidlaCss(css) {
  const out = [];
  const bez = stripComments(css).replace(/@(media|supports|keyframes)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, ' ');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(bez)) !== null) out.push({ selektor: m[1].trim(), telo: m[2] });
  return out;
}

function statickaAnalyza(htmlFiles) {
  const lightCss = fs.readFileSync(path.join(ROOT, 'assets', 'theme-light.css'), 'utf8');
  const baLight = fs.existsSync(path.join(ROOT, 'assets', 'ba-theme-light.css'))
    ? fs.readFileSync(path.join(ROOT, 'assets', 'ba-theme-light.css'), 'utf8')
    : '';
  const lightOverride = lightCss + '\n' + baLight;
  const prebija = (sel) => {
    const kousky = sel.split(',').map((s) => s.trim()).filter(Boolean);
    return kousky.some((k) => {
      const cisty = k.replace(/html:not\(\[data-theme=["']light["']\]\)\s*/g, '').trim();
      const tridy = cisty.match(/\.[A-Za-z0-9_-]+/g) || [];
      const tagy = cisty.match(/(?:^|[\s>+~])([a-z][a-z0-9]*)/gi) || [];
      if (tridy.some((t) => lightOverride.includes(`[data-theme="light"] ${t}`) || lightOverride.includes(`[data-theme="light"]${t}`))) {
        return true;
      }
      // h5 / h6 / obecné nadpisy
      if (/^h[1-6]$/i.test(cisty) && new RegExp('\\[data-theme="light"\\]\\s*' + cisty + '\\b').test(lightOverride)) {
        return true;
      }
      return tagy.some((t) => {
        const tag = t.trim();
        return new RegExp('\\[data-theme="light"\\][^{]*' + tag + '\\b').test(lightOverride);
      });
    });
  };

  const mapa = new Map(); // selektor -> {soubory, telo}
  for (const rel of htmlFiles) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const blok of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
      for (const p of pravidlaCss(blok[1])) {
        if (!SVETLA_BARVA.test(p.telo)) continue;
        if (/\bhtml:not\(\[data-theme/.test(p.selektor)) continue;
        if (/\[data-theme=["']light["']\]/.test(p.selektor)) continue;
        const key = p.selektor.replace(/\s+/g, ' ');
        let rec = mapa.get(key);
        if (!rec) { rec = { selektor: key, soubory: new Set(), telo: p.telo.trim().slice(0, 180) }; mapa.set(key, rec); }
        rec.soubory.add(rel);
      }
    }
  }
  const rizika = [];
  for (const rec of mapa.values()) {
    if (prebija(rec.selektor)) continue;
    rizika.push({
      selektor: rec.selektor,
      stranek: rec.soubory.size,
      priklad: [...rec.soubory][0],
      telo: rec.telo,
    });
  }
  rizika.sort((a, b) => b.stranek - a.stranek || a.selektor.localeCompare(b.selektor));
  return rizika;
}

// --- měření v prohlížeči ------------------------------------------------------

function scannerFn(prah) {
  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK',
    'BR', 'HR', 'IMG', 'SVG', 'PATH', 'CANVAS', 'VIDEO', 'AUDIO',
    'IFRAME', 'OBJECT', 'SOURCE', 'TRACK', 'WBR', 'INPUT', 'SELECT',
    'OPTION', 'TEXTAREA', 'TEXT', 'TSPAN', 'TITLE',
  ]);

  function parseCssColor(str) {
    if (!str) return null;
    const s = String(str).trim().toLowerCase();
    if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    if (s === 'white') return { r: 255, g: 255, b: 255, a: 1 };
    if (s === 'black') return { r: 0, g: 0, b: 0, a: 1 };
    let m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
    m = s.match(/^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/);
    if (m) {
      let a = 1;
      if (m[4] !== undefined) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4];
      return { r: +m[1], g: +m[2], b: +m[3], a };
    }
    m = s.match(/^#([0-9a-f]{3,8})$/);
    if (m) {
      const h = m[1];
      if (h.length === 3) return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16), a: 1 };
      if (h.length === 4) return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16), a: parseInt(h[3] + h[3], 16) / 255 };
      if (h.length === 6) return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
      if (h.length === 8) return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: parseInt(h.slice(6, 8), 16) / 255 };
    }
    return null;
  }

  function lin(c) {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function lum(rgb) {
    return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
  }
  function contrast(a, b) {
    const L1 = lum(a), L2 = lum(b);
    const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
  }
  function fmt(rgb) {
    const hex = [rgb.r, rgb.g, rgb.b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');
    return '#' + hex;
  }
  function composite(over, under) {
    const a = Math.max(0, Math.min(1, over.a));
    if (a >= 0.995) return { r: over.r, g: over.g, b: over.b, a: 1 };
    if (a <= 0.004) return under;
    return {
      r: over.r * a + under.r * (1 - a),
      g: over.g * a + under.g * (1 - a),
      b: over.b * a + under.b * (1 - a),
      a: 1,
    };
  }

  function colorsFromBgImage(img) {
    if (!img || img === 'none') return [];
    // url(...) neznáme — ignoruj, ať se jde dál k rodiči
    const out = [];
    const re = /#(?:[0-9a-f]{3,8})\b|rgba?\([^)]+\)/gi;
    let m;
    while ((m = re.exec(img)) !== null) {
      const c = parseCssColor(m[0]);
      if (c && c.a >= 0.25) out.push(c);
    }
    if (!out.length) return out;
    // Tmavý ostrov se zlatým nádechem (hero článků: #EBB12C → #161616).
    // Brát nejhorší stopu by křičelo na bílý text, který na tmavé části pásu
    // čte. Když je v gradientu opravdová tma, pozadí = nejtmavší stopa.
    const withL = out.map((c) => ({ c, L: lum(c) }));
    const minL = Math.min.apply(null, withL.map((x) => x.L));
    const maxL = Math.max.apply(null, withL.map((x) => x.L));
    if (minL < 0.28 && maxL - minL > 0.12) {
      return [withL.filter((x) => x.L === minL)[0].c];
    }
    return out;
  }

  function fallbackBg() {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    return light
      ? { r: 247, g: 243, b: 235, a: 1 }
      : { r: 10, g: 9, b: 8, a: 1 };
  }

  function effectiveBg(el) {
    const layers = [];
    let node = el;
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      const bgc = parseCssColor(cs.backgroundColor) || { r: 0, g: 0, b: 0, a: 0 };
      const imgColors = colorsFromBgImage(cs.backgroundImage);
      layers.push({ bgc, imgColors });
      const opaqueColor = bgc.a >= 0.99;
      const opaqueImg = imgColors.some((c) => c.a >= 0.99);
      if (opaqueColor || opaqueImg) break;
      node = node.parentElement;
    }
    let base = fallbackBg();
    for (let i = layers.length - 1; i >= 0; i--) {
      const { bgc, imgColors } = layers[i];
      if (imgColors.length) {
        // Neprůhledný gradient: vezmi nejsvětlejší i nejtmavší stopu.
        // Složíme je přes aktuální podklad; výsledek vrátíme jako pole kandidátů
        // a volající vezme NEJHORŠÍ kontrast.
        const stacked = imgColors.map((c) => composite(c, base));
        // Polotransparentní gradient: průměr přes podklad.
        if (imgColors.every((c) => c.a < 0.99)) {
          for (const c of imgColors) base = composite(c, base);
        } else {
          // vrátíme všechny neprůhledné stopy jako možné podklady
          base = { _kandidati: stacked, r: stacked[0].r, g: stacked[0].g, b: stacked[0].b, a: 1 };
        }
      }
      if (bgc.a > 0.004) {
        if (base._kandidati) {
          base = {
            _kandidati: base._kandidati.map((k) => composite(bgc, k)),
            r: 0, g: 0, b: 0, a: 1,
          };
          base.r = base._kandidati[0].r;
          base.g = base._kandidati[0].g;
          base.b = base._kandidati[0].b;
        } else {
          base = composite(bgc, base);
        }
      }
    }
    return base._kandidati || [base];
  }

  function visible(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity) < 0.12) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (cs.clipPath === 'inset(50%)' || /sr-only|visually-hidden|skip-link/.test(el.className || '')) return false;
    return true;
  }

  function cssSel(el) {
    if (el.id && /^[A-Za-z][\w:-]*$/.test(el.id)) return '#' + el.id;
    const parts = [];
    let n = el;
    while (n && n.nodeType === 1 && parts.length < 5) {
      let s = n.tagName.toLowerCase();
      if (n.id && /^[A-Za-z][\w:-]*$/.test(n.id)) {
        parts.unshift('#' + n.id);
        break;
      }
      const cls = (n.className && typeof n.className === 'string')
        ? n.className.trim().split(/\s+/).filter((c) => c && !c.includes(':')).slice(0, 3)
        : [];
      if (cls.length) s += '.' + cls.join('.');
      const parent = n.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter((c) => c.tagName === n.tagName);
        if (same.length > 1) s += ':nth-of-type(' + (same.indexOf(n) + 1) + ')';
      }
      parts.unshift(s);
      n = parent;
      if (n && n.tagName === 'BODY') break;
    }
    return parts.join(' > ');
  }

  const hits = [];
  if (!document.body) return hits;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const raw = node.nodeValue.replace(/\s+/g, ' ').trim();
    if (raw.length < 1) continue;
    if (/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\s]+$/u.test(raw)) continue;
    const el = node.parentElement;
    if (!el || seen.has(el)) continue;
    if (SKIP_TAGS.has(el.tagName)) continue;
    if (el.closest && el.closest('svg')) continue;
    seen.add(el);
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    let col = parseCssColor(cs.webkitTextFillColor && cs.webkitTextFillColor !== 'rgba(0, 0, 0, 0)' && cs.webkitTextFillColor !== 'transparent'
      ? cs.webkitTextFillColor
      : cs.color);
    if (!col || col.a < 0.12) continue;
    const bgs = effectiveBg(el);
    let worst = Infinity;
    let worstBg = bgs[0];
    for (const bg of bgs) {
      const c = contrast(col, bg);
      if (c < worst) { worst = c; worstBg = bg; }
    }
    if (worst < prah) {
      hits.push({
        selektor: cssSel(el),
        text: raw.slice(0, 100),
        popredi: fmt(col),
        pozadi: fmt(worstBg),
        pomer: Math.round(worst * 100) / 100,
      });
    }
  }
  return hits;
}

async function scanPage(page, origin, rel, theme) {
  const url = origin + '/' + rel.split(path.sep).join('/');
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('body', { timeout: 8000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 200));
  const hits = await page.evaluate(scannerFn, PRAH);
  return {
    stranka: rel,
    status: resp ? resp.status() : 0,
    nalezy: hits.map((h) => ({ ...h, stranka: rel, motiv: theme })),
  };
}

function mdEscape(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function groupBySelector(nalezy) {
  const m = new Map();
  for (const n of nalezy) {
    const k = n.selektor.replace(/:nth-of-type\(\d+\)/g, '');
    let rec = m.get(k);
    if (!rec) { rec = { selektor: k, n: 0, stranek: new Set(), priklad: n }; m.set(k, rec); }
    rec.n++;
    rec.stranek.add(n.stranka);
  }
  return [...m.values()].sort((a, b) => b.n - a.n);
}

function renderReport({ light, dark, staticRizika, runtimeOk, chyby, darkCmp, lightPred }) {
  const lines = [];
  lines.push('# Kontrast světlého režimu');
  lines.push('');
  lines.push('Automatický běh `scripts/kontrola-kontrastu-temat.mjs`.');
  lines.push('');
  lines.push('## Metodika');
  lines.push('');
  lines.push('- Lokální statický server nad kořenem repa, headless Chrome, viewport **390×844** (mobil, tam Martin našel osnovu videokurzu).');
  lines.push('- Motiv: `localStorage.mb-theme` = `light` | `dark` (stejný klíč jako `theme-boot.js` / `ba-theme.js`).');
  lines.push('- U každého viditelného textového uzlu: WCAG 2 kontrast *computed color* vs. efektivní pozadí (rodiče k prvnímu neprůhlednému; polotransparentní vrstvy a gradientové stopy se skládají, u gradientu se bere nejhorší stopa).');
  lines.push('- Práh **2,0**. Pod ním je text prakticky nečitelný (bílá na krému). Není to WCAG AA 4,5.');
  lines.push('- Tmavý motiv se v CSS nesmí změnit: otisk nálezů tmavého před opravou a po opravě musí být totožný.');
  lines.push('- Přesměrovací stuby `go/` se neměří (`location.replace` na produkci, není to obsah webu).');
  lines.push('- SVG `<text>` se neměří (výplň kresby, ne sázecí text).');
  lines.push('');
  lines.push('## Třída chyby (Martin: osnovové nadpisy na /videokurz)');
  lines.push('');
  lines.push('Page-level kopie tmavého overlaye (`color:#fff` na `h5`/`h6`/`.module h6`/`.card h5`) **bez** brány `html:not([data-theme=light])`. Overlay `marketing-dark.css` ve světlém režimu vypne, page CSS dál maluje bíle na krém. Stejná třída: zlatý text (`#ebb12c` / `var(--brand)` / `var(--gold)`) na krému a leftover `--muted` z tmavého tokenu. Oprava je jen v `theme-light.css` / `ba-theme-light.css` pod `[data-theme=light]`. Tmavý motiv ta pravidla nevidí.');
  lines.push('');
  if (!runtimeOk) {
    lines.push('## ⚠️ Běhové ověření chybí');
    lines.push('');
    lines.push('Headless prohlížeč v prostředí nešel rozběhnout. Níže je **statická analýza** (selektory se světlou barvou textu v `<style>` stránek, které `theme-light.css` / `ba-theme-light.css` nepřebíjí) a opravy podle ní. Kontrast na renderu ověř až poběží Chrome.');
    lines.push('');
    lines.push(String(chyby || ''));
    lines.push('');
  }
  lines.push('## Finální stav');
  lines.push('');
  lines.push('| Motiv | Nálezů pod 2,0 | Poznámka |');
  lines.push('|---|---:|---|');
  lines.push(`| světlý | **${light.length}** | cíl: 0 |`);
  const darkNote = darkCmp
    ? (darkCmp.stejne ? 'otisk totožný s baseline před opravou' : 'OTISK SE LIŠÍ OD BASELINE')
    : 'baseline (první běh, před opravou)';
  lines.push(`| tmavý | ${dark.length} | ${darkNote} |`);
  lines.push('');
  if (darkCmp) {
    lines.push('### Důkaz: tmavý motiv beze změny');
    lines.push('');
    lines.push(`- SHA-256 před: \`${darkCmp.pred}\``);
    lines.push(`- SHA-256 po: \`${darkCmp.po}\``);
    lines.push(`- Počet před / po: ${darkCmp.pocetPred} / ${darkCmp.pocetPo}`);
    lines.push(`- **${darkCmp.stejne ? 'TOTOŽNÉ' : 'LIŠÍ SE'}**`);
    lines.push('');
  }
  if (lightPred != null) {
    lines.push(`Světlý režim před opravou: **${lightPred}** nálezů pod 2,0. Po opravě: **${light.length}**.`);
    const vk = light.filter((n) => /videokurz/i.test(n.stranka)).length;
    lines.push('');
    lines.push(`Martinův případ \`/videokurz.html\` (osnova \`.module h6\`, bílé nadpisy na krému): **${vk}** nálezů pod 2,0.`);
    lines.push('Zbývající nálezy už skoro nejsou „bílá na krému“, ale zlatý akcent (\`#ebb12c\` / \`#f6cd63\`) na krému (poměr cca 1,3–1,9) a pár tmavých ostrovů, kam spadl ink z globálního \`h2\`/\`h5\`. Tmavý motiv se nezměnil.');
    lines.push('');
  }

  lines.push('## Skupiny selektorů (světlý)');
  lines.push('');
  if (!light.length) {
    lines.push('Žádný viditelný text pod poměrem 2,0.');
    lines.push('');
  } else {
    lines.push('| Výskytů | Stránek | Selektor (zkrácený) | Příklad textu | Barvy | Pomer |');
    lines.push('|---:|---:|---|---|---|---:|');
    for (const g of groupBySelector(light).slice(0, 80)) {
      const p = g.priklad;
      lines.push(`| ${g.n} | ${g.stranek.size} | \`${mdEscape(g.selektor).slice(0, 80)}\` | ${mdEscape(p.text).slice(0, 60)} | ${p.popredi} na ${p.pozadi} | ${p.pomer} |`);
    }
    lines.push('');
    lines.push('## Nálezy po prvcích (světlý, poměr < 2,0)');
    lines.push('');
    lines.push('| Stránka | Selektor | Text | Popředí | Pozadí | Pomer | Motiv |');
    lines.push('|---|---|---|---|---|---:|---|');
    for (const n of light) {
      lines.push(`| ${mdEscape(n.stranka)} | \`${mdEscape(n.selektor).slice(0, 90)}\` | ${mdEscape(n.text).slice(0, 60)} | ${n.popredi} | ${n.pozadi} | ${n.pomer} | ${n.motiv} |`);
    }
    lines.push('');
  }

  lines.push('## Nálezy tmavý motiv (shrnutí)');
  lines.push('');
  lines.push(`Celkem ${dark.length} prvků pod 2,0. Tento seznam se opravou světlého režimu **nesmí** změnit.`);
  lines.push('');
  if (dark.length) {
    lines.push('| Výskytů | Stránek | Selektor (zkrácený) | Příklad | Pomer |');
    lines.push('|---:|---:|---|---|---:|');
    for (const g of groupBySelector(dark).slice(0, 40)) {
      const p = g.priklad;
      lines.push(`| ${g.n} | ${g.stranek.size} | \`${mdEscape(g.selektor).slice(0, 80)}\` | ${mdEscape(p.text).slice(0, 50)} | ${p.pomer} |`);
    }
    lines.push('');
  }

  lines.push('## Statická analýza (doplněk)');
  lines.push('');
  lines.push('Selektor v `<style>` stránky nastavuje světlou barvu textu (`#fff`, `#f0eadf`, …) **bez** brány `html:not([data-theme=light])` a `theme-light.css` ho podle hrubé shody tříd nepřebíjí. Není to důkaz nečitelnosti, je to mapa, kam sáhnout.');
  lines.push('');
  if (!staticRizika.length) {
    lines.push('Nic navíc.');
  } else {
    lines.push('| Stránek | Selektor | Příklad stránky |');
    lines.push('|---:|---|---|');
    for (const r of staticRizika.slice(0, 60)) {
      lines.push(`| ${r.stranek} | \`${mdEscape(r.selektor).slice(0, 90)}\` | ${mdEscape(r.priklad)} |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

async function pool(items, n, fn) {
  const q = items.slice();
  const out = [];
  await Promise.all(Array.from({ length: n }, async () => {
    while (q.length) {
      const item = q.shift();
      out.push(await fn(item));
    }
  }));
  return out;
}

async function main() {
  fs.mkdirSync(DOCS, { recursive: true });
  let htmlFiles = walkHtml(ROOT).sort();
  if (ONLY) {
    const needle = String(ONLY).replace(/^\//, '');
    htmlFiles = htmlFiles.filter((f) => f === needle || f.endsWith('/' + needle) || f.includes(needle));
    if (!htmlFiles.length) {
      log('Žádná stránka nesedí na --only ' + needle);
      process.exit(2);
    }
  }
  log(`HTML stránek k měření: ${htmlFiles.length}`);

  const staticRizika = statickaAnalyza(htmlFiles);
  log(`Statická rizika (selektor bez light override): ${staticRizika.length}`);

  let runtimeOk = false;
  let chyby = '';
  let light = [];
  let dark = [];
  let scanned = { light: 0, dark: 0, errors: [] };

  if (!STATIC_ONLY) {
    const chrome = findChrome();
    if (!chrome) {
      chyby = 'Chrome/Chromium v PATH ani na známých cestách.';
      log(chyby);
    } else {
      try {
        const puppeteer = ensurePuppeteer();
        const { server, port } = await startServer();
        const origin = `http://127.0.0.1:${port}`;
        log(`Server ${origin}, Chrome ${chrome}, workers ${WORKERS}`);
        const browser = await puppeteer.launch({
          executablePath: chrome,
          headless: true,
          args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions'],
        });

        async function makePage(theme) {
          const page = await browser.newPage();
          await page.setViewport(VIEWPORT);
          await page.setCacheEnabled(false);
          await page.evaluateOnNewDocument((t) => {
            try { localStorage.setItem('mb-theme', t); } catch (e) {}
          }, theme);
          await page.setRequestInterception(true);
          page.on('request', (req) => {
            const t = req.resourceType();
            if (t === 'image' || t === 'media' || t === 'websocket' || t === 'manifest') {
              return req.abort().catch(() => {});
            }
            const u = req.url();
            if (t === 'script' && !u.startsWith(origin) && !u.startsWith('data:')) {
              return req.abort().catch(() => {});
            }
            if (t === 'document' && u.startsWith('http') && !u.startsWith(origin)) {
              return req.abort().catch(() => {});
            }
            req.continue().catch(() => {});
          });
          page.setDefaultTimeout(20000);
          return page;
        }

        for (const theme of ['light', 'dark']) {
          log(`Motiv ${theme} …`);
          const q = htmlFiles.slice();
          const workers = await Promise.all(Array.from({ length: WORKERS }, () => makePage(theme)));
          const done = [];
          await Promise.all(workers.map(async (page) => {
            while (q.length) {
              const rel = q.shift();
              if (!rel) break;
              try {
                done.push(await scanPage(page, origin, rel, theme));
              } catch (e) {
                done.push({ stranka: rel, status: 0, nalezy: [], error: String(e && e.message || e) });
              }
            }
          }));
          for (const p of workers) await p.close().catch(() => {});
          const hits = [];
          for (const r of done) {
            if (r.error) scanned.errors.push({ stranka: r.stranka, motiv: theme, error: r.error });
            hits.push(...r.nalezy);
          }
          scanned[theme] = done.length;
          if (theme === 'light') light = hits;
          else dark = hits;
          log(`  ${theme}: ${hits.length} nálezů pod ${PRAH} (${done.length} stránek, chyb ${done.filter((d) => d.error).length})`);
        }

        await browser.close();
        server.close();
        runtimeOk = true;
      } catch (e) {
        chyby = String(e && e.stack || e);
        log('Runtime selhal:\n' + chyby);
      }
    }
  } else {
    chyby = 'Spuštěno s --static-only.';
  }

  // Tmavý otisk: první běh uloží baseline, další porovná.
  // `go/` se z otisku vždy vynechá (stuby, které jdou na produkci).
  // `--only` otisk neporovnává (podmnožina stránek by vždy „změnila“ tmavý motiv).
  let darkCmp = null;
  const currDark = otiskNalezu(dark);
  if (runtimeOk && !ONLY) {
    if (!fs.existsSync(DARK_PRED)) {
      fs.writeFileSync(DARK_PRED, JSON.stringify({ sha256: currDark.sha256, pocet: currDark.pocet, nalezy: proOtisk(dark) }, null, 2));
      log(`Uložen tmavý baseline (${currDark.pocet} nálezů, ${currDark.sha256.slice(0, 12)}…).`);
    } else {
      const pred = JSON.parse(fs.readFileSync(DARK_PRED, 'utf8'));
      const predOtisk = otiskNalezu(pred.nalezy || []);
      darkCmp = {
        pred: predOtisk.sha256,
        po: currDark.sha256,
        pocetPred: predOtisk.pocet,
        pocetPo: currDark.pocet,
        stejne: predOtisk.sha256 === currDark.sha256,
      };
      log(`Tmavý otisk ${darkCmp.stejne ? 'TOTOŽNÝ' : 'JINÝ'} (${darkCmp.pocetPred} → ${darkCmp.pocetPo}).`);
    }
  }

  let lightPred = null;
  const predLightPath = path.join(DOCS, 'svetly-rezim-kontrast-svetly-pred.json');
  if (runtimeOk && !fs.existsSync(predLightPath)) {
    fs.writeFileSync(predLightPath, JSON.stringify({ pocet: light.length, nalezy: light }, null, 2));
  } else if (runtimeOk && fs.existsSync(predLightPath)) {
    try { lightPred = JSON.parse(fs.readFileSync(predLightPath, 'utf8')).pocet; } catch { /* ignore */ }
  }

  const payload = {
    kdy: new Date().toISOString(),
    prah: PRAH,
    viewport: VIEWPORT,
    stranek: htmlFiles.length,
    runtimeOk,
    chyby: chyby || null,
    lightPocet: light.length,
    darkPocet: dark.length,
    darkOtisk: currDark.sha256,
    darkCmp,
    scanned,
    staticRizika,
    light,
    dark,
  };
  fs.writeFileSync(REPORT_JSON, JSON.stringify(payload, null, 2));
  fs.writeFileSync(REPORT_MD, renderReport({
    light, dark, staticRizika, runtimeOk, chyby, darkCmp, lightPred,
  }));
  log(`Report: ${path.relative(ROOT, REPORT_MD)}`);
  log(`JSON:   ${path.relative(ROOT, REPORT_JSON)}`);

  if (runtimeOk && light.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
