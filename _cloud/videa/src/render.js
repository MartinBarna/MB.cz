/* Render promo videí: Playwright (Chromium) snímá stage.html snímek po snímku, ffmpeg skládá MP4.
   Spuštění (z kořene repa běží statický server na :8099, např. `python3 -m http.server 8099`):
     NODE_PATH=$(npm root -g) node _cloud/videa/src/render.js [id ...] [--check] [--preview=t1,t2] [--cover]
   Bez přepínačů vyrenderuje video + cover + verzi bez hudby pro všechna (nebo vyjmenovaná) videa. */
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');           // _cloud/videa
const BASE = process.env.BASE || 'http://localhost:8099/_cloud/videa/src/stage.html';
const FPS = 30;
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
let ids = args.filter(a => !a.startsWith('--'));

function run(cmd, a, opts = {}) { return execFileSync(cmd, a, { stdio: ['ignore', 'pipe', 'pipe'], ...opts }).toString(); }

(async () => {
  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  if (!ids.length) {
    await page.goto(BASE + '?v=tvuj-coach-vip-15');
    ids = await page.evaluate(() => Object.keys(window.VIDEOS));
  }
  const tmp = process.env.TMPDIR_VIDEA || path.join(ROOT, '.tmp');
  fs.mkdirSync(tmp, { recursive: true });
  const report = [];

  for (const id of ids) {
    errors.length = 0;
    await page.goto(`${BASE}?v=${id}`, { waitUntil: 'networkidle' });
    const meta = await page.evaluate(() => window.__ready);
    const scenes = await page.evaluate(() => window.VIDEOS[new URLSearchParams(location.search).get('v')].scenes.map(s => s.t));

    // Kontrola bezpečných zón a přetečení: uprostřed a těsně před koncem každé scény
    const issues = [];
    for (const [a, b] of scenes) {
      for (const t of [a + Math.min(1.1, (b - a) * .5), b - .26]) {
        await page.evaluate(t => window.__render(t), t);
        issues.push(...await page.evaluate(l => window.__check(l), `${id} t=${t.toFixed(2)}`));
      }
    }
    await page.evaluate(() => window.__cover());
    issues.push(...await page.evaluate(l => window.__check(l), `${id} cover`));
    if (issues.length) console.log(issues.join('\n'));
    if (errors.length) console.log('JS chyby:', errors);

    if (flags.preview) {
      const times = flags.preview === 'auto' ? scenes.map(([a, b]) => +(a + Math.min(1.3, (b - a) * .6)).toFixed(2)) : String(flags.preview).split(',').map(Number);
      console.log('TIMES', times.join(','));
      for (const t of times) {
        await page.evaluate(t => window.__render(t), t);
        await page.screenshot({ path: path.join(tmp, `${id}-t${t}.png`) });
      }
      continue;
    }
    if (flags.check) { report.push({ id, issues: issues.length, js: errors.length }); continue; }

    // Cover
    await page.evaluate(() => window.__cover());
    await page.screenshot({ path: path.join(ROOT, `${id}-cover.png`) });
    if (flags.cover) continue;

    // Hudba
    const preset = await page.evaluate(id => window.VIDEOS[id].music, id);
    const wav = path.join(tmp, `${id}.wav`);
    run('python3', [path.join(__dirname, 'music.py'), String(meta.dur), preset, wav]);

    // Snímky → ffmpeg
    const silent = path.join(tmp, `${id}-video.mp4`);
    const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p',
      '-profile:v', 'high', '-level', '4.1', '-r', String(FPS), silent], { stdio: ['pipe', 'inherit', 'inherit'] });
    const total = Math.round(meta.dur * FPS);
    const t0 = Date.now();
    for (let f = 0; f < total; f++) {
      await page.evaluate(t => window.__render(t), f / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 150 === 0) process.stdout.write(`${id} ${f}/${total} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
    }
    ff.stdin.end();
    await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));

    // Mux s hudbou (loudness pro sociální sítě ~ -14 LUFS) + verze bez hudby
    const out = path.join(ROOT, `${id}.mp4`);
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', silent, '-i', wav,
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', 'loudnorm=I=-15:TP=-1.5:LRA=7', '-ar', '48000',
      '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out]);
    const outSilent = path.join(ROOT, 'bez-hudby', `${id}-bez-hudby.mp4`);
    fs.mkdirSync(path.dirname(outSilent), { recursive: true });
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', silent, '-c:v', 'copy', '-movflags', '+faststart', outSilent]);
    const mb = fs.statSync(out).size / 1e6;
    console.log(`${id}: ${mb.toFixed(2)} MB, ${((Date.now() - t0) / 1000).toFixed(0)} s render`);
    report.push({ id, mb: +mb.toFixed(2), dur: meta.dur, issues: issues.length, js: errors.length });
  }
  console.log(JSON.stringify(report));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
