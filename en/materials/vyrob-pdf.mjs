#!/usr/bin/env node
/**
 * Vyrobí PDF anglických příloh STEJNÝM způsobem, jakým vznikla česká materialy/pdf/*-v2.pdf:
 * tisk hotové HTML stránky v headless Chrome (Skia/PDF, A4; formát a okraje bere stránka
 * z vlastního @page, tmavý papír drží print-color-adjust:exact v CSS stránky).
 * Doloženo: metadata materialy/pdf/*-v2.pdf = Producer "Skia/PDF m152", commit 9622f0281
 * („PDF znovu vyrenderovaná headless Chrome"). Skript, který je vyrobil, v repu není, proto tenhle.
 *
 *   en/materials/<slug>/index.html               -> materialy/pdf/en/<slug>.pdf
 *   en/materials/eating-out-playbook/index.html  -> download/eating-out-playbook.pdf (lead magnet z /en/)
 *
 * Stránky servíruje malý lokální server z kořene repa (127.0.0.1, náhodný port), aby fungovaly
 * absolutní cesty /assets/... (fonty Poppins, CSS). Bez npm, jen vestavěné moduly Node.
 * Na konci přepíše seznam v en/materials/index.html mezi <!-- SEZNAM:START --> a <!-- SEZNAM:END -->.
 *
 * Použití:
 *   node en/materials/vyrob-pdf.mjs                 všechny hotové stránky + seznam
 *   node en/materials/vyrob-pdf.mjs --slug porce-bez-vazeni [--slug ...]
 *   node en/materials/vyrob-pdf.mjs --jen-seznam     jen přepíše seznam, PDF nevyrábí
 *   --chrome <cesta>  (nebo env CHROME_PATH), jinak hledá Chrome/Edge na obvyklých místech
 *
 * Stránka se přeskočí (s varováním), když není hotová: chybí </html>, nemá lang="en",
 * nebo v ní zůstala čeština (víc než 20 znaků ěščřžůťďň). Rozpracovaný překlad tak do PDF nespadne.
 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

// ⛔ Chrome se spouští ASYNCHRONNĚ: synchronní execFileSync by zablokoval smyčku Node a lokální
// server v tomtéž procesu by Chromu nikdy neodpověděl (tisk pak visí až do timeoutu).
const execFileAsync = promisify(execFile);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const MATERIALS = path.join(ROOT, 'en', 'materials');
const INDEX = path.join(MATERIALS, 'index.html');
const PLAYBOOK = 'eating-out-playbook';
// Pořadí v knihovně: playbook, pak pořadí dávek překladu. Neznámé slugy abecedně na konec.
const ORDER = [PLAYBOOK, 'uvitaci-balicek', 'jidlo-v-restauraci', 'porce-bez-vazeni', 'vikendove-prejidani',
  'plato-zastavena-vaha', 'denik-navyku', 'kroky-a-cardio', 'flexibilni-strava', 'spanek-a-regenerace',
  'stres-a-kortizol', 'hydratace-pitny-rezim', 'high-protein-recepty', 'kucharka', 'suplementy-co-funguje',
  'zacni-cvicit', 'treninkovy-plan', 'jak-cist-studie', 'tydenni-checkin', 'vstupni-dotaznik'];

const args = process.argv.slice(2);
const onlySlugs = [];
let chromeArg = process.env.CHROME_PATH || '';
let listOnly = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--slug') onlySlugs.push(args[++i]);
  else if (args[i] === '--chrome') chromeArg = args[++i];
  else if (args[i] === '--jen-seznam') listOnly = true;
  else { console.error('Neznámý parametr: ' + args[i]); process.exit(2); }
}

function pdfPathFor(slug) {
  return slug === PLAYBOOK
    ? path.join(ROOT, 'download', 'eating-out-playbook.pdf')
    : path.join(ROOT, 'materialy', 'pdf', 'en', slug + '.pdf');
}
function pdfUrlFor(slug) {
  return slug === PLAYBOOK ? '/download/eating-out-playbook.pdf' : '/materialy/pdf/en/' + slug + '.pdf';
}

function findChrome() {
  const cands = [
    chromeArg,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  return cands.find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } }) || null;
}

function listSlugs() {
  return fs.readdirSync(MATERIALS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(MATERIALS, d.name, 'index.html')))
    .map((d) => d.name)
    .sort((a, b) => {
      const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.localeCompare(b);
    });
}

/** Je stránka hotová? Vrací null, nebo důvod, proč ji přeskočit. */
function notReady(html) {
  if (!/<\/html>\s*$/i.test(html)) return 'soubor nekončí </html> (rozpracovaný?)';
  if (!/<html[^>]*\blang="en"/i.test(html)) return 'chybí <html lang="en">';
  const cz = (html.replace(/<script[\s\S]*?<\/script>/gi, '').match(/[ěščřžůťďňĚŠČŘŽŮŤĎŇ]/g) || []).length;
  if (cz > 20) return `zůstala čeština (${cz} znaků ěščřžůťďň)`;
  return null;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf',
};

function startServer() {
  const server = http.createServer((req, res) => {
    try {
      const u = new URL(req.url, 'http://localhost');
      let p = path.normalize(path.join(ROOT, decodeURIComponent(u.pathname)));
      if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
      if (!fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    } catch {
      res.writeHead(500); res.end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function pdfInfo(file) {
  const b = fs.readFileSync(file);
  const head = b.subarray(0, 5).toString('latin1');
  const txt = b.toString('latin1');
  const pages = (txt.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
  const box = txt.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
  return { ok: head === '%PDF-' && b.length > 10_000 && pages > 0, bytes: b.length, pages, size: box ? `${Math.round(box[1])}x${Math.round(box[2])} pt` : '?' };
}

async function renderPdf(chrome, url, outFile, profile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const tmp = outFile.replace(/\.pdf$/, '.tmp.pdf');
  try { fs.unlinkSync(tmp); } catch { /* nic */ }
  await execFileAsync(chrome, [
    '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--hide-scrollbars', `--user-data-dir=${profile}`,
    '--no-pdf-header-footer', '--virtual-time-budget=10000', `--print-to-pdf=${tmp}`, url,
  ], { timeout: 120_000, windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
  const info = pdfInfo(tmp);
  if (!info.ok) { try { fs.unlinkSync(tmp); } catch { /* nic */ } throw new Error(`PDF nevzniklo správně (${info.bytes} B, ${info.pages} stran)`); }
  fs.renameSync(tmp, outFile); // zápis přes .tmp, ať případná chyba nepřepíše dobré starší PDF
  return info;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = (s) => String(s).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function cardFor(slug) {
  const html = fs.readFileSync(path.join(MATERIALS, slug, 'index.html'), 'utf8');
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
  const title = strip(h1 || (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || slug);
  let desc = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1];
  if (!desc) desc = strip((html.match(/<p class="lead">([\s\S]*?)<\/p>/i) || [])[1] || '');
  desc = strip(desc);
  if (desc.length > 170) desc = desc.slice(0, desc.lastIndexOf(' ', 167)) + '...';
  const pdf = fs.existsSync(pdfPathFor(slug));
  return `      <div class="card"><h2>${esc(title)}</h2><p>${esc(desc)}</p><div class="links">`
    + `<a class="btn ghost" href="/en/materials/${esc(slug)}/">Read</a>`
    + (pdf ? `<a class="btn" href="${pdfUrlFor(slug)}" download>PDF</a>` : '')
    + `</div></div>`;
}

function writeIndex(slugs) {
  const html = fs.readFileSync(INDEX, 'utf8');
  const start = '<!-- SEZNAM:START -->', end = '<!-- SEZNAM:END -->';
  const a = html.indexOf(start), b = html.indexOf(end);
  if (a < 0 || b < a) throw new Error('V en/materials/index.html chybí značky SEZNAM:START / SEZNAM:END.');
  const cards = slugs.length ? slugs.map(cardFor).join('\n') : '      <p class="empty">The guides are being prepared.</p>';
  const out = html.slice(0, a + start.length) + '\n' + cards + '\n' + html.slice(b);
  const tmp = INDEX + '.tmp';
  fs.writeFileSync(tmp, out, 'utf8');
  fs.renameSync(tmp, INDEX);
}

async function main() {
  const all = listSlugs();
  const ready = [], skipped = [];
  for (const slug of all) {
    const why = notReady(fs.readFileSync(path.join(MATERIALS, slug, 'index.html'), 'utf8'));
    if (why) skipped.push({ slug, why }); else ready.push(slug);
  }
  const todo = onlySlugs.length ? ready.filter((s) => onlySlugs.includes(s)) : ready;
  const results = [];

  if (!listOnly && todo.length) {
    const chrome = findChrome();
    if (!chrome) { console.error('Nenašel jsem Chrome ani Edge. Zadej --chrome <cesta> nebo CHROME_PATH.'); process.exit(1); }
    const server = await startServer();
    const port = server.address().port;
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-pdf-'));
    console.log(`Chrome: ${chrome}\nServer: http://127.0.0.1:${port}/ (kořen ${ROOT})\n`);
    try {
      for (const slug of todo) {
        const url = `http://127.0.0.1:${port}/en/materials/${slug}/`;
        const out = pdfPathFor(slug);
        try {
          const info = await renderPdf(chrome, url, out, profile);
          results.push({ slug, ok: true, out: path.relative(ROOT, out), ...info });
        } catch (e) {
          results.push({ slug, ok: false, err: e.message.split('\n')[0] });
        }
      }
    } finally {
      server.close();
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* profil Chrome může chvíli držet zámek */ }
    }
  }

  writeIndex(ready);

  for (const r of results) {
    console.log(r.ok
      ? `  OK    ${r.slug.padEnd(24)} -> ${r.out.split(path.sep).join('/')} (${r.pages} str., ${Math.round(r.bytes / 1024)} kB, ${r.size})`
      : `  CHYBA ${r.slug.padEnd(24)} ${r.err}`);
  }
  for (const s of skipped) console.log(`  SKIP  ${s.slug.padEnd(24)} ${s.why}`);
  console.log(`\nSeznam v en/materials/index.html: ${ready.length} příloh.`);
  if (results.some((r) => !r.ok)) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
