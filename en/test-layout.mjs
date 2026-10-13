#!/usr/bin/env node
/**
 * Headless Chrome: 375 px bez vodorovného posunu, 1280 px menu bez burgeru.
 * Google, Meta a Supabase jsou zablokované (žádný hit do produkce).
 * Spuštění z kořene worktree: node en/test-layout.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9800 + Math.floor(Math.random() * 150);
const httpPort = 12000 + Math.floor(Math.random() * 1000);
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'en-tools-'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let rel = url === '/' ? '/index.html' : url;
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, rel.replace(/^\/+/, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('missing'); return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

const ch = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
let events = [];
const send = (method, params = {}) => {
  const i = ++id;
  ws.send(JSON.stringify({ id: i, method, params }));
  return new Promise((res) => pending.set(i, res));
};
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) return { __err: (r.exceptionDetails.text || '') + ' ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || '') };
  return r.result && r.result.value;
};
let fails = 0;
const ok = (c, m) => { console.log((c ? '  OK   ' : '  FAIL ') + m); if (!c) fails++; };

function parseColor(rgb) {
  const m = String(rgb || '').match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(',').map((x) => Number(x.trim()));
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}
function composite(fg, bg) {
  const a = fg.a == null ? 1 : fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
  };
}
function lum(c) {
  const chs = [c.r, c.g, c.b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * chs[0] + 0.7152 * chs[1] + 0.0722 * chs[2];
}
const contrast = (fgCss, bgCss, pageCss) => {
  const page = parseColor(pageCss || 'rgb(15,17,19)') || { r: 15, g: 17, b: 19, a: 1 };
  let bg = parseColor(bgCss);
  let fg = parseColor(fgCss);
  if (!fg) return null;
  if (!bg || bg.a === 0) bg = page;
  const bgSolid = composite(bg, page);
  const fgSolid = composite(fg, bgSolid);
  const L1 = lum(fgSolid), L2 = lum(bgSolid);
  const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
};

async function open(urlPath, width) {
  events = [];
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
  await send('Page.navigate', { url: `http://127.0.0.1:${httpPort}${urlPath}` });
  for (let i = 0; i < 80 && !events.some((e) => e.method === 'Page.loadEventFired'); i++) await sleep(100);
  await sleep(400);
}
const jsErrors = () => events.filter((e) => e.method === 'Runtime.exceptionThrown' || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'))
  .map((e) => e.method === 'Runtime.exceptionThrown' ? (e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description || e.params.exceptionDetails.text) : (e.params.args || []).map((a) => a.value || a.description).join(' '))
  .filter((t) => !/ERR_BLOCKED|blocked|Failed to load resource/i.test(t || ''));

const MEASURE = `(() => {
  const de = document.documentElement;
  const burger = document.querySelector('.nav-burger');
  const wrap = document.querySelector('.nav .wrap');
  const input = document.querySelector('input[type="text"], input[type="email"], select');
  const body = getComputedStyle(document.body);
  const ic = input ? getComputedStyle(input) : null;
  const link = document.querySelector('.navlinks a:not(.cta)');
  const lc = link ? getComputedStyle(link) : null;
  const nav = document.querySelector('.nav');
  const navBg = nav ? getComputedStyle(nav).backgroundColor : '';
  return {
    scroll: de.scrollWidth,
    client: de.clientWidth,
    inner: innerWidth,
    burger: burger ? getComputedStyle(burger).display : 'missing',
    navOver: wrap ? wrap.scrollWidth - wrap.clientWidth : -1,
    bodyColor: body.color,
    bodyBg: body.backgroundColor,
    inputColor: ic && ic.color,
    inputBg: ic && ic.backgroundColor,
    linkColor: lc && lc.color,
    navBg: navBg
  };
})()`;

async function checkFit(label, urlPath, width, expectBurger) {
  await open(urlPath, width);
  const m = await evaluate(MEASURE);
  if (!m || m.__err) { ok(false, label + ' měření: ' + (m && m.__err)); return; }
  ok(m.scroll <= m.client + 1, `${label} ${width}px: scrollWidth ${m.scroll} <= client ${m.client}`);
  ok(m.burger === (expectBurger ? 'block' : 'none'), `${label} burger je ${m.burger}, čekám ${expectBurger ? 'block' : 'none'}`);
  if (!expectBurger) ok(m.navOver <= 1, `${label} menu nepřetéká wrap (${m.navOver}px)`);
  const pageBg = !m.bodyBg || m.bodyBg === 'rgba(0, 0, 0, 0)' ? 'rgb(15,17,19)' : m.bodyBg;
  const cBody = contrast(m.bodyColor, pageBg, pageBg);
  const cIn = m.inputColor ? contrast(m.inputColor, m.inputBg, pageBg) : null;
  const navBg = !m.navBg || m.navBg === 'rgba(0, 0, 0, 0)' ? pageBg : m.navBg;
  const cLink = m.linkColor ? contrast(m.linkColor, navBg, pageBg) : null;
  ok(cBody != null && cBody >= 4.5, `${label} text stránky kontrast ${cBody && cBody.toFixed(2)} (${m.bodyColor} na ${pageBg})`);
  if (m.inputColor) ok(cIn != null && cIn >= 4.5, `${label} pole kontrast ${cIn && cIn.toFixed(2)} (${m.inputColor} na ${m.inputBg})`);
  if (m.linkColor) ok(cLink != null && cLink >= 4.5, `${label} odkaz v menu kontrast ${cLink && cLink.toFixed(2)} na ${navBg}`);
  ok(jsErrors().length === 0, `${label} konzole bez chyb: ${JSON.stringify(jsErrors()).slice(0, 240)}`);
}

async function main() {
  await new Promise((resolve) => server.listen(httpPort, '127.0.0.1', resolve));
  let targets;
  for (let i = 0; i < 40; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.length) break; } catch {}
    await sleep(250);
  }
  ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result || d); pending.delete(d.id); }
    else if (d.method) events.push(d);
  });
  await send('Page.enable');
  await send('Network.enable');
  await send('Runtime.enable');
  await send('Network.setBlockedURLs', { urls: ['*googletagmanager.com*', '*google-analytics.com*', '*facebook.net*', '*facebook.com*', '*supabase.co*'] });

  await checkFit('/en/', '/en/', 1280, false);
  await checkFit('/en/', '/en/', 375, true);
  await checkFit('/en/calculator/', '/en/calculator/', 375, true);
  await checkFit('/en/calculator/', '/en/calculator/', 1280, false);
  await checkFit('/en/workout/', '/en/workout/', 375, true);
  await checkFit('/en/workout/', '/en/workout/', 1280, false);
  await checkFit('/en/blog/', '/en/blog/', 1280, false);

  console.log('== kalkulačka vyplněná');
  await open('/en/calculator/', 375);
  const calc = await evaluate(`(async () => {
    const $ = (i) => document.getElementById(i);
    document.querySelector('input[name=units][value=metric]').click();
    $('c-wkg').value = '80'; $('c-hcm').value = '178'; $('c-age').value = '30';
    $('c-sex').value = 'male'; $('c-act').value = 'stredni'; $('c-goal').value = 'udrzeni';
    $('calc-form').querySelector('button[type=submit]').click();
    await new Promise((r) => setTimeout(r, 200));
    const de = document.documentElement;
    return {
      kcal: $('r-kcal').textContent, protein: $('r-protein').textContent, fat: $('r-fat').textContent,
      carbs: $('r-carbs').textContent, fiber: $('r-fiber').textContent,
      lead: !$('lead-box').hidden, consent: $('lead-consent').checked,
      apply: document.querySelector('#lead-box a[href="/en/#apply"]') ? true : false,
      scroll: de.scrollWidth, client: de.clientWidth,
      czech: /[ěščřžýáíéůúťďň]/i.test(($('r-meta').textContent || '') + ($('r-pace').textContent || '') + ($('r-notes').innerText || ''))
    };
  })()`);
  ok(calc && calc.kcal && calc.kcal !== '-' && calc.protein !== '-' && calc.fat !== '-' && calc.carbs !== '-' && calc.fiber !== '-', `výsledek ${calc && calc.kcal} kcal, P ${calc && calc.protein}, F ${calc && calc.fat}, C ${calc && calc.carbs}, Fi ${calc && calc.fiber}`);
  ok(calc && calc.lead && calc.consent === false && calc.apply, 'formulář pod výsledkem, souhlas nezaškrtnutý, odkaz na coaching');
  ok(calc && !calc.czech, 'text výsledku bez české diakritiky');
  ok(calc && calc.scroll <= calc.client + 1, `po výpočtu 375px scroll ${calc && calc.scroll} <= ${calc && calc.client}`);

  console.log('== trénink vygenerovaný');
  await open('/en/workout/', 375);
  const plan = await evaluate(`(async () => {
    const $ = (i) => document.getElementById(i);
    for (let i = 0; i < 30 && !/ready/.test($('dbstate').textContent); i++) await new Promise((r) => setTimeout(r, 100));
    $('gen').click();
    await new Promise((r) => setTimeout(r, 300));
    const de = document.documentElement;
    const text = ($('days').innerText || '') + ' ' + ($('restnote').textContent || '');
    return {
      ready: $('dbstate').textContent,
      hidden: $('result').hidden,
      days: $('days').querySelectorAll('.day').length,
      text: text.slice(0, 180),
      czech: /[ěščřžýáíéůúťďň]/i.test(text),
      lead: !$('lead-box').hidden,
      consent: $('lead-consent').checked,
      scroll: de.scrollWidth, client: de.clientWidth
    };
  })()`);
  ok(plan && !plan.hidden && plan.days >= 2, `plán vidět, dní ${plan && plan.days}, stav ${plan && plan.ready}`);
  ok(plan && !plan.czech, `text plánu bez češtiny: ${(plan && plan.text || '').replace(/\\s+/g, ' ').slice(0, 100)}`);
  ok(plan && plan.lead && plan.consent === false, 'formulář pod plánem, souhlas nezaškrtnutý');
  ok(plan && plan.scroll <= plan.client + 1, `plán 375px scroll ${plan && plan.scroll} <= ${plan && plan.client}`);

  console.log('== odeslání formulářů jen do mocku, ne na Supabase');
  const sent = await evaluate(`(async () => {
    const calls = [];
    window.fetch = (u, o) => {
      if (String(u).includes('/functions/v1/en-lead')) {
        calls.push(JSON.parse(o.body));
        return Promise.resolve(new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    };
    const f = document.getElementById('lead-form');
    f.first_name.value = 'Sam';
    f.email.value = 'sam@example.com';
    f.consent.checked = true;
    f.querySelector('button[type=submit]').click();
    await new Promise((r) => setTimeout(r, 300));
    return { payload: calls[0] || null, okHidden: document.getElementById('lead-ok').hidden };
  })()`);
  const p = sent && sent.payload;
  ok(p && p.kind === 'workout' && p.calc === null && typeof p.plan_summary === 'string' && p.plan_summary.length > 0 && p.plan_summary.length <= 500, `workout payload kind=${p && p.kind}, summary ${p && p.plan_summary && p.plan_summary.length} znaků`);
  ok(p && !/sam@example|Sam/.test(p.plan_summary || ''), `summary bez jména a e-mailu: ${p && p.plan_summary}`);
  ok(sent && sent.okHidden === false, 'potvrzení tréninku se ukázalo');

  await open('/en/calculator/', 375);
  const sentCalc = await evaluate(`(async () => {
    const $ = (i) => document.getElementById(i);
    document.querySelector('input[name=units][value=metric]').click();
    $('c-wkg').value = '80'; $('c-hcm').value = '178'; $('c-age').value = '30';
    $('c-act').value = 'stredni'; $('c-goal').value = 'udrzeni';
    $('calc-form').requestSubmit ? $('calc-form').requestSubmit() : $('calc-form').querySelector('button[type=submit]').click();
    await new Promise((r) => setTimeout(r, 200));
    const calls = [];
    window.fetch = (u, o) => {
      if (String(u).includes('/functions/v1/en-lead')) {
        calls.push(JSON.parse(o.body));
        return Promise.resolve(new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    };
    const f = $('lead-form');
    f.first_name.value = 'Sam';
    f.email.value = 'sam@example.com';
    f.consent.checked = true;
    f.querySelector('button[type=submit]').click();
    await new Promise((r) => setTimeout(r, 300));
    return { payload: calls[0] || null, okHidden: $('lead-ok').hidden, kcal: $('r-kcal').textContent };
  })()`);
  const c = sentCalc && sentCalc.payload;
  const keys = c && c.calc ? Object.keys(c.calc).sort().join(',') : '';
  ok(c && c.kind === 'calculator' && keys === 'activity,goal,kcal,protein_g,tdee,units,v', `calculator payload klíče ${keys}`);
  ok(c && c.consent === true && /Fat Loss Kit/.test(c.consent_text || ''), 'souhlas true a text kitu');
  ok(c && !('age' in (c.calc || {})) && !('weight' in (c.calc || {})), 'calc neobsahuje věk ani váhu');
  ok(sentCalc && sentCalc.okHidden === false, `potvrzení kalkulačky se ukázalo (${sentCalc && sentCalc.kcal})`);

  console.log(fails ? `\n${fails} kontrol selhalo` : '\nVše prošlo');
}

main().catch((e) => { console.error(e); fails++; }).finally(async () => {
  try { ws && ws.close(); } catch {}
  try { ch.kill(); } catch {}
  try { server.close(); } catch {}
  await sleep(300);
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch {}
  process.exit(fails ? 1 : 0);
});
