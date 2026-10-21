/* Render promo videí v2.
   Z kořene repa: python3 -m http.server 8099 &   pak   NODE_PATH=$(npm root -g) node _cloud/videa-v2/src/render.js [id ...] [--check] [--preview=t1,t2|auto]
   Výstup: _cloud/videa-v2/<id>.mp4 (UI zvuky), bez-zvuku/<id>-bez-zvuku.mp4, <id>-cover.png (snímek 0 s), archy/<id>.jpg (snímek každých 0,5 s). */
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.BASE || 'http://localhost:8099/_cloud/videa-v2/src/stage.html';
const FPS = 30;
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
let ids = args.filter(a => !a.startsWith('--'));
const run = (c, a) => execFileSync(c, a, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();

(async () => {
  const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  if (!ids.length) { await page.goto(BASE + '?v=x'); ids = await page.evaluate(() => Object.keys(window.VIDEOS)); }
  const tmp = process.env.TMPDIR_VIDEA || path.join(ROOT, '.tmp'); fs.mkdirSync(tmp, { recursive: true });
  const report = [];
  // samostatný cover (schválený titulek coveru); stránku pak načte znovu další video
  async function cover(id) { const ok = await page.evaluate(() => window.__cover()); if (ok) await page.screenshot({ path: path.join(ROOT, `${id}-cover.png`) }); }
  for (const id of ids) {
    errors.length = 0;
    await page.goto(`${BASE}?v=${id}`, { waitUntil: 'networkidle' });
    const meta = await page.evaluate(() => window.__ready);
    const shots = await page.evaluate(id => window.VIDEOS[id].shots.map(s => s.t), id);
    // kontrola každých 0,1 s: zóna, přetečení, počet slov
    const issues = new Set();
    for (let t = 0; t < meta.dur; t += .1) {
      await page.evaluate(t => window.__render(t), t);
      (await page.evaluate(l => window.__check(l), `${id} t=${t.toFixed(1)}`)).forEach(x => issues.add(x.replace(/t=[\d.]+/, 't')));
    }
    if (issues.size) console.log([...issues].join('\n'));
    if (errors.length) console.log('JS chyby:', errors);
    if (flags.preview) {
      const times = flags.preview === 'auto' ? shots.map(([a, b]) => +(a + Math.min(.9, (b - a) * .7)).toFixed(2)) : String(flags.preview).split(',').map(Number);
      for (const t of times) { await page.evaluate(t => window.__render(t), t); await page.screenshot({ path: path.join(tmp, `${id}-t${t}.png`) }); }
      console.log('PREVIEW', times.join(','));
      continue;
    }
    if (flags.check) { report.push({ id, issues: issues.size, js: errors.length }); continue; }
    if (flags.covers) { await cover(id); continue; }
    // snímky → ffmpeg
    const silent = path.join(ROOT, 'bez-zvuku', `${id}-bez-zvuku.mp4`); fs.mkdirSync(path.dirname(silent), { recursive: true });
    const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1', '-r', String(FPS), '-movflags', '+faststart', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
    const total = Math.round(meta.dur * FPS); const t0 = Date.now(); const sheet = [];
    for (let f = 0; f < total; f++) {
      await page.evaluate(t => window.__render(t), f / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
      if (f % 15 === 0) { const p = path.join(tmp, `${id}-f${String(f).padStart(4, '0')}.jpg`); fs.writeFileSync(p, buf); sheet.push(p); }
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
    // UI zvuky z událostí (ťuknutí, psaní)
    const evs = await page.evaluate(() => window.__events);
    const evf = path.join(tmp, `${id}-events.json`); fs.writeFileSync(evf, JSON.stringify(evs));
    const wav = path.join(tmp, `${id}-sfx.wav`); run('python3', [path.join(__dirname, 'sfx.py'), evf, String(meta.dur), wav]);
    const out = path.join(ROOT, `${id}.mp4`);
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', silent, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out]);
    // kontaktní arch: snímek každých 0,5 s
    fs.mkdirSync(path.join(ROOT, 'archy'), { recursive: true });
    const list = path.join(tmp, `${id}-sheet.txt`); fs.writeFileSync(list, sheet.map(p => `file '${p}'`).join('\n'));
    const cols = 10, rows = Math.ceil(sheet.length / cols);
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list,
      '-vf', `scale=216:384,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='%{eif\\:n/2\\:d}.%{eif\\:mod(n\\,2)*5\\:d}s':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6,tile=${cols}x${rows}:padding=4:color=white`,
      '-frames:v', '1', '-q:v', '3', path.join(ROOT, 'archy', `${id}.jpg`)]);
    await cover(id);
    const mb = fs.statSync(out).size / 1e6;
    console.log(`${id}: ${mb.toFixed(2)} MB, ${((Date.now() - t0) / 1000).toFixed(0)} s, ${evs.length} zvukových událostí`);
    report.push({ id, mb: +mb.toFixed(2), dur: meta.dur, issues: issues.size, js: errors.length });
  }
  console.log(JSON.stringify(report));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
