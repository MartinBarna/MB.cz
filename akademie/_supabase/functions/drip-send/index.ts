

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { maPreskocitKrok, PRESKOC_KROK_KDYZ_VLASTNI } from './preskoc.ts';

import {
  mostBlokujeVlastnictvi,
  odstupDnu,
  shouldStop as pravidlaShouldStop,
  vyberMost,
} from './pravidla.ts';

import {
  KROK_PODLE_ZAPISU,
  ODLOZ_MS,
  cadenceOdIso,
  nactiAktivniZOdpovedi,
  mostBlokujeNeaktivitu,
  OKNO_NEAKTIVITY_DNI,
  oknoUplynulo,
  rozhodniPodleZapisu,
  type StavZapisu,
  trateProAppSignal,
  varsSCadenceOd,
} from './aktivace.ts';

import { ostopkuj } from './stopa.ts';

const NL = String.fromCharCode(10);   
const DQ = String.fromCharCode(34);   

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

const MAIL_TRACK_SECRET = Deno.env.get('MAIL_TRACK_SECRET') ?? '';
const FROM = 'Martin Barna <news@martinbarna.cz>';
const SITE = 'https://martinbarna.cz';

const COURSE_URL = 'https://buy.stripe.com/7sYeVc6356Jc4Ra8hF3ks0h?locale=cs';
const FREE_LESSONS_URL = 'https://martinbarna.cz/videokurz?utm_source=email&utm_medium=drip#zdarma';

const COURSE_PRICE = 1490;
const DISCOUNT_CODE = 'ZACNI15';
const DISCOUNT_PCT = 15;

const DISCOUNT2_CODE = 'JESTE20';
const DISCOUNT2_PCT = 20;

type Seg = 'zeny' | 'muzi' | 'other';
const isFem = (seg: Seg) => seg === 'zeny';

const VOK_EXC: Record<string, string> = {
  'jan': 'Jene', 'pavel': 'Pavle', 'karel': 'Karle', 'havel': 'Havle', 'pavol': 'Pavle',
  'zdenek': 'Zdenku', 'zdeněk': 'Zdeňku', 'zbynek': 'Zbynku', 'zbyněk': 'Zbyňku',
  'josef': 'Josefe', 'luboš': 'Luboši', 'lubos': 'Luboši', 'bartoloměj': 'Bartoloměji',
  'vavřinec': 'Vavřinče', 'vavrinec': 'Vavrinče', 'němec': 'Němče',
};

const MALE_NAMES = new Set<string>([
  'martin','david','tomáš','tomas','lukáš','lukas','petr','jakub','ondřej','ondrej','marek','michal','michael',
  'filip','vojtěch','vojtech','patrik','patrick','radek','roman','adam','matěj','matej','štěpán','stepan','vít','vit',
  'václav','vaclav','jaroslav','miroslav','stanislav','ladislav','bohuslav','bronislav','rostislav','přemysl','premysl',
  'bohumil','kamil','emil','dalibor','otakar','richard','robert','norbert','albert','rudolf','adolf','oldřich','oldrich',
  'bedřich','bedrich','jindřich','jindrich','vladimír','vladimir','dušan','dusan','milan','alois','ivan','igor','marcel',
  'daniel','gabriel','samuel','dominik','erik','viktor','hynek','čeněk','cenek','kristián','kristian','sebastián','sebastian',
  'maxmilián','maximilián','maximilian','kryštof','krystof','tobiáš','tobias','matyáš','matyas','mikuláš','mikulas','šimon','simon',
  'damián','damian','fabián','fabian','julián','julian','benedikt','arnošt','arnost','evžen','evzen','augustin','antonín','antonin',
  'valentýn','valentyn','radim','vilém','vilem','radovan','miloslav','svatopluk','vratislav','zbyšek','zbysek','aleš','ales',
  'denis','dennis','nikolas','kevin','leon','vlastimil','radomír','radomir','lumír','lumir','ctibor','branislav','jáchym','jachym',
  'kašpar','kaspar','melichar','řehoř','rehor','florián','florian','teodor','theodor','nikolaj','boris',
  'radoslav','miloš','milos','bořek','borek','vladan','hubert','herbert','gustav','ferdinand','leopold','konrád','konrad',
  'arnold','zikmund','matouš','matous','kilián','kilian','mojmír','mojmir',
]);

const FEMALE_NAMES = new Set<string>([
  'ester','dagmar','miriam','karin','karyn','nikol','ingrid','rút','rut','judit','edit','ráchel','rachel',
  'dolores','doris','agnes','mercedes','karmen','carmen','sarah','deborah','abigail','gwen','lilian','vivien',
  'kristin','kristýn','katrin','madlen','jennifer','žaneta',
]);
const VOK_VOWELS = 'aeiouyáéěíóúůý';
const isMaleName = (low: string) => (low in VOK_EXC) || MALE_NAMES.has(low);
function vokativ(fn: string, seg: Seg): string {
  if (!fn) return fn;
  const low = fn.toLowerCase();
  const last = low.slice(-1);
  if (last === 'a') return fn.slice(0, -1) + 'o';                        
  if (VOK_VOWELS.includes(last)) return fn;                              
  if (FEMALE_NAMES.has(low)) return fn;                                  
  if (seg === 'zeny' && !isMaleName(low)) return fn;                     
  if (low in VOK_EXC) return VOK_EXC[low];
  if (low.endsWith('ek')) return fn.slice(0, -2) + 'ku';                 
  if (low.endsWith('ch') || 'kgh'.includes(last)) return fn + 'u';       
  if ('szxj'.includes(last) || 'šžčř'.includes(last)) return fn + 'i';   
  if (low.endsWith('el')) return fn + 'i';                               
  if (last === 'r') {
    return VOK_VOWELS.includes(low.slice(-2, -1)) ? fn + 'e' : fn.slice(0, -1) + 'ře';  
  }
  if ('bdflmnptvw'.includes(last)) return fn + 'e';                      
  return fn;                                                             
}

const esc = (s: string) =>
  s.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split(DQ).join('&quot;');

const SQ = String.fromCharCode(39);   
const attr = (s: string) => esc(s).split(SQ).join('&#39;');

function gender(s: string, seg: Seg): string {
  let out = '', i = 0;
  while (true) {
    const a = s.indexOf('[[', i);
    if (a < 0) { out += s.slice(i); break; }
    out += s.slice(i, a);
    const sep = s.indexOf('||', a + 2);
    const end = s.indexOf(']]', sep + 2);
    out += isFem(seg) ? s.slice(a + 2, sep) : s.slice(sep + 2, end);
    i = end + 2;
  }
  
  return out.split('[a]').join(isFem(seg) ? 'a' : '').split('[á]').join(isFem(seg) ? 'á' : 'ý');
}
function merge(s: string, vars: Record<string, string>): string {
  let out = '', i = 0;
  while (true) {
    const a = s.indexOf('{{', i);
    if (a < 0) { out += s.slice(i); break; }
    out += s.slice(i, a);
    const end = s.indexOf('}}', a + 2);
    const key = s.slice(a + 2, end);
    out += key in vars ? vars[key] : '{{' + key + '}}';
    i = end + 2;
  }
  return out;
}
const fill = (s: string, seg: Seg, v: Record<string, string>) => merge(gender(s, seg), v);

const hasToken = (s: string) => s.includes('{{') || s.includes('[[') || s.includes(']]') || s.includes('[a]') || s.includes('[á]');

function inlineToText(s: string): string {
  s = s.split('<br>').join(NL).split('<br/>').join(NL).split('<br />').join(NL);
  while (true) {
    const a = s.indexOf('<a ');
    if (a < 0) break;
    const h = s.indexOf('href=', a);
    let href = '';
    if (h >= 0) { const q = s[h + 5]; const st = h + 6; href = s.slice(st, s.indexOf(q, st)); }
    const gt = s.indexOf('>', a);
    const endA = s.indexOf('</a>', gt);
    s = s.slice(0, a) + s.slice(gt + 1, endA) + (href ? ' (' + href + ')' : '') + s.slice(endA + 4);
  }
  let out = '', inTag = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '<') inTag = true; else if (ch === '>') inTag = false; else if (!inTag) out += ch;
  }
  return out.split('&amp;').join('&').split('&lt;').join('<').split('&gt;').join('>').split('&quot;').join(DQ);
}

type Block =
  | { t: 'p'; html: string }
  | { t: 'bullets'; items: string[] }
  | { t: 'btn'; text: string; href: string }
  | { t: 'ps'; html: string }
  | { t: 'img'; src: string; alt: string };

function neznamyBlok(b: never): never {
  const typ = (b as { t?: unknown } | null)?.t;
  throw new Error('drip-send: neznamy typ bloku v sablone: ' + JSON.stringify(typ ?? null));
}
function renderHtml(blocks: Block[], seg: Seg, v: Record<string, string>): string {
  return blocks.map((b) => {
    if (b.t === 'p') return `<p style='margin:0 0 15px'>${fill(b.html, seg, v)}</p>`;
    if (b.t === 'ps') return `<p class='mb-ps' style='margin:18px 0 0;color:#A09AAD;font-style:italic'>${fill(b.html, seg, v)}</p>`;
    if (b.t === 'bullets')
      return `<ul style='margin:0 0 15px;padding-left:20px'>` +
        b.items.map((li) => `<li style='margin:0 0 8px'>${fill(li, seg, v)}</li>`).join('') + `</ul>`;
    
    
    if (b.t === 'img')
      return `<img src='${attr(fill(b.src, seg, v))}' alt='${attr(fill(b.alt, seg, v))}' width='100%' style='max-width:480px;height:auto;display:block;margin:16px auto;border-radius:8px'>`;
    
    
    
    if (b.t === 'btn')
      return `<table role='presentation' cellpadding='0' cellspacing='0' border='0' style='margin:6px 0 20px'><tr>` +
        `<td class='mb-btn' bgcolor='#EBB12C' style='background-color:#EBB12C;border-radius:50px'>` +
        `<a class='mb-btna' href='${fill(b.href, seg, v)}' style='display:inline-block;padding:14px 30px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;font-weight:700;line-height:1.25;color:#1A1222;text-decoration:none'>${esc(fill(b.text, seg, v))}</a>` +
        `</td></tr></table>`;
    return neznamyBlok(b);
  }).join(NL);
}
function renderText(blocks: Block[], seg: Seg, v: Record<string, string>): string {
  return blocks.map((b) => {
    if (b.t === 'bullets') return b.items.map((li) => '- ' + inlineToText(fill(li, seg, v))).join(NL);
    if (b.t === 'btn') return fill(b.text, seg, v) + ': ' + fill(b.href, seg, v);
    if (b.t === 'img') return '[obrázek: ' + inlineToText(fill(b.alt, seg, v)) + ']';
    if (b.t === 'p' || b.t === 'ps') return inlineToText(fill(b.html, seg, v));
    return neznamyBlok(b);
  }).join(NL + NL);
}
function wrapHtml(preheader: string, body: string, footerHtml: string): string {
  const ZAMKY = `.mb-bg{background-color:#0C0B10!important}` +
    `.mb-card{background-color:#16131D!important}` +
    `.mb-rule{background-color:#EBB12C!important}` +
    `.mb-body{color:#F0EADF!important}` +
    `.mb-brand{color:#F6CD63!important;border-left-color:#EBB12C!important}` +
    `.mb-btn{background-color:#EBB12C!important}` +
    `.mb-btna{color:#1A1222!important}` +
    `.mb-foot{background-color:#100E16!important}` +
    `.mb-mut{color:#A09AAD!important}` +
    `.mb-ps{color:#A09AAD!important}` +
    `.mb-link{color:#F6CD63!important}`;
  return `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='color-scheme' content='dark light'><meta name='supported-color-schemes' content='dark light'>` +
    `<style>` +
    `:root{color-scheme:dark light;supported-color-schemes:dark light}` +
    `body,table,td,p,li,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}` +
    `.mb-body a{color:#F6CD63}.mb-body a.mb-btna{color:#1A1222}` +
    `@media (prefers-color-scheme: dark){${ZAMKY}.mb-body a{color:#F6CD63!important}.mb-body a.mb-btna{color:#1A1222!important}}` +
    `[data-ogsc] .mb-bg,[data-ogsb] .mb-bg{background-color:#0C0B10!important}` +
    `[data-ogsc] .mb-card,[data-ogsb] .mb-card{background-color:#16131D!important}` +
    `[data-ogsc] .mb-rule,[data-ogsb] .mb-rule{background-color:#EBB12C!important}` +
    `[data-ogsc] .mb-body,[data-ogsb] .mb-body{color:#F0EADF!important}` +
    `[data-ogsc] .mb-brand,[data-ogsb] .mb-brand{color:#F6CD63!important;border-left-color:#EBB12C!important}` +
    `[data-ogsc] .mb-btn,[data-ogsb] .mb-btn{background-color:#EBB12C!important}` +
    `[data-ogsc] .mb-btna,[data-ogsb] .mb-btna,[data-ogsc] .mb-body a.mb-btna,[data-ogsb] .mb-body a.mb-btna{color:#1A1222!important}` +
    `[data-ogsc] .mb-foot,[data-ogsb] .mb-foot{background-color:#100E16!important}` +
    `[data-ogsc] .mb-mut,[data-ogsb] .mb-mut{color:#A09AAD!important}` +
    `[data-ogsc] .mb-ps,[data-ogsb] .mb-ps{color:#A09AAD!important}` +
    `[data-ogsc] .mb-link,[data-ogsb] .mb-link{color:#F6CD63!important}` +
    `@media only screen and (max-width:620px){.mb-pad{padding:26px 20px 22px!important}.mb-fpad{padding:16px 20px 20px!important}}` +
    `</style></head>` +
    `<body class='mb-bg' style='margin:0;padding:0;background-color:#0C0B10;background-image:linear-gradient(180deg,#17131F 0%,#0C0B10 46%,#0A0910 100%)'>` +
    `<span style='display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden'>${esc(preheader)}</span>` +
    `<table role='presentation' class='mb-bg' width='100%' cellpadding='0' cellspacing='0' border='0' bgcolor='#0C0B10' style='background-color:#0C0B10;background-image:linear-gradient(180deg,#17131F 0%,#0C0B10 46%,#0A0910 100%)'><tr><td align='center' style='padding:24px 12px 30px'>` +
    `<table role='presentation' class='mb-card' width='600' cellpadding='0' cellspacing='0' border='0' bgcolor='#16131D' style='width:100%;max-width:600px;background-color:#16131D;border-radius:2px;border:1px solid #262231'>` +
    `<tr><td class='mb-rule' bgcolor='#EBB12C' height='3' style='height:3px;line-height:3px;font-size:2px;background-color:#EBB12C'>&nbsp;</td></tr>` +
    `<tr><td class='mb-body mb-pad' style='padding:30px 32px 26px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.6;color:#F0EADF'>` +
    `<div class='mb-brand' style='border-left:3px solid #EBB12C;padding-left:12px;font-weight:800;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#F6CD63;margin:0 0 22px'>Martin Barna</div>` +
    body +
    `</td></tr>` +
    `<tr><td class='mb-foot mb-fpad' bgcolor='#100E16' style='padding:18px 32px 22px;background-color:#100E16;border-top:1px solid #262231'>` +
    `<div class='mb-mut' style='font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:12px;line-height:1.55;color:#A09AAD'>${footerHtml}</div>` +
    `</td></tr></table></td></tr></table></body></html>`;
}

function buildVars(name: string, seg: Seg, unsub: string, email: string, extra: Record<string, unknown> | null, cisla: Record<string, string>): Record<string, string> {
  const BADCH = '{}[]<>&' + DQ + String.fromCharCode(39);
  let clean = '';
  for (const ch of (name || '')) clean += BADCH.includes(ch) ? ' ' : ch;
  const parts = clean.trim().split(' ').filter((x) => x.length > 0);
  const t = parts[0] || '';
  const fn = vokativ(t ? t.charAt(0).toUpperCase() + t.slice(1) : '', seg);
  const dprice = Math.round(COURSE_PRICE * (1 - DISCOUNT_PCT / 100));
  const d2price = Math.round(COURSE_PRICE * (1 - DISCOUNT2_PCT / 100));
  const vestavene: Record<string, string> = {
    first_name: fn, fn_space: fn ? ' ' + fn : '', fn_suffix: fn ? ', ' + fn : '', fn_prefix: fn ? fn + ', ' : '',
    lead_magnet_url: seg === 'muzi' ? SITE + '/download/forma-zpet-muzi.pdf' : SITE + '/download/makro-plan-zeny.pdf',
    plan_page_url: seg === 'muzi' ? SITE + '/forma-zpet' : SITE + '/makro-plan',
    course_url: COURSE_URL, free_lessons_url: FREE_LESSONS_URL,
    course_price: String(COURSE_PRICE), discount_pct: String(DISCOUNT_PCT),
    discount_price: String(dprice), discount_code: DISCOUNT_CODE,
    discount2_pct: String(DISCOUNT2_PCT), discount2_price: String(d2price), discount2_code: DISCOUNT2_CODE,
    email: email, email_url: encodeURIComponent(email), unsubscribe_url: unsub,
    ...cisla,
  };
  if (!extra || typeof extra !== 'object') return vestavene;
  const pridane: Record<string, string> = {};
  for (const [k, val] of Object.entries(extra)) {
    if (Object.prototype.hasOwnProperty.call(vestavene, k)) {
      console.warn('[drip-send] vars: klic "' + k + '" je vestaveny, hodnota z invoku ZAHOZENA');
      continue;
    }
    if (val === null || val === undefined) continue;
    pridane[k] = String(val);
  }
  return { ...pridane, ...vestavene };
}

interface Tpl { subject: string; preheader: string; blocks: Block[]; wait_days: number | null; key: string }
function renderEmail(tpl: Tpl, seg: Seg, v: Record<string, string>, footer: { html: string; text: string }) {
  const subject = fill(tpl.subject, seg, v);
  const html = wrapHtml(fill(tpl.preheader, seg, v), renderHtml(tpl.blocks, seg, v), fill(footer.html, seg, v));
  const sep = NL + NL + '----------------------------------------' + NL;
  const text = renderText(tpl.blocks, seg, v) + sep + fill(footer.text, seg, v);
  if (hasToken(subject) || hasToken(html) || hasToken(text)) throw new Error('unresolved_token');
  return { subject, html, text };
}

async function sendViaResend(to: string, subject: string, html: string, text: string, unsub: string, replyTo: string, archiveBcc: string): Promise<string> {
  if (!RESEND_KEY) throw new Error('missing_RESEND_API_KEY');
  const bcc = archiveBcc && archiveBcc.toLowerCase() !== to.toLowerCase() ? [archiveBcc] : undefined;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text, reply_to: replyTo || undefined, bcc, headers: { 'List-Unsubscribe': '<' + unsub + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('resend_' + res.status + ':' + JSON.stringify(body));
  return (body as { id?: string }).id ?? '';
}

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
const normSeg = (s: unknown): Seg => (s === 'zeny' || s === 'muzi' ? s : 'other');

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: cfg } = await admin.from('app_config').select('value').eq('key', 'drip_invoke_secret').maybeSingle();
  const expected = cfg?.value ?? '';
  const provided = req.headers.get('x-drip-secret') || '';
  if (!expected || provided !== expected) return json({ error: 'unauthorized' }, 401);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nowIso = new Date().toISOString();
  const { data: fRows } = await admin.from('app_config').select('key,value').in('key', ['footer_html', 'footer_text', 'reply_to_email', 'archive_bcc', 'followups_enabled', 'drip_daily_cap', 'drip_send_gap_ms', 'drip_max_tries', 'drip_run_deadline_ms', 'clenske_track_prefixy', 'navazujici_trate', 'pocet_potravin', 'pocet_receptu']);
  const fMap = Object.fromEntries((fRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  const footer = { html: fMap.footer_html ?? '', text: fMap.footer_text ?? '' };
  const replyTo = fMap.reply_to_email ?? '';
  const archiveBcc = fMap.archive_bcc ?? '';
  const CISLA = { pocet_potravin: (fMap.pocet_potravin ?? '').trim() || '50 000', pocet_receptu: (fMap.pocet_receptu ?? '').trim() || '140' };
  const stopaStav = !MAIL_TRACK_SECRET ? 'vypnuto_chybi_secret' : (archiveBcc ? 'jen_odkazy_archive_bcc_zapnuty' : 'odkazy_i_pixel');
  if (MAIL_TRACK_SECRET && archiveBcc) console.warn('[drip-send] archive_bcc je zapnuty -> mericí pixel se neprilepuje, meri se jen prokliky');
  const followupsEnabled = (fMap.followups_enabled ?? '') === 'true';
  const DAILY_CAP = Math.max(1, Number(fMap.drip_daily_cap ?? '') || 500);
  const SEND_GAP_MS = Math.max(0, Number(fMap.drip_send_gap_ms ?? '') || 600);
  const MAX_TRIES = Math.max(1, Number(fMap.drip_max_tries ?? '') || 5);
  const CLENSKE_PREFIXY = String(fMap.clenske_track_prefixy ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (CLENSKE_PREFIXY.length === 0) CLENSKE_PREFIXY.push('onboarding', 'milestone', 'reactivation', 'rescue');
  let MOSTY: Record<string, { track: string; po_dnech?: number }> = {};
  try { const raw = String(fMap.navazujici_trate ?? '').trim(); if (raw) { const parsed = JSON.parse(raw); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) MOSTY = parsed; } } catch (e) { console.warn('[drip-send] navazujici_trate: nevalidni JSON, mosty VYPNUTE: ' + String(e)); MOSTY = {}; }
  let lastSendAt = 0;
  const pace = async () => { const wait = lastSendAt + SEND_GAP_MS - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait)); lastSendAt = Date.now(); };
  const RUN_DEADLINE_MS = Math.max(10000, Number(fMap.drip_run_deadline_ms ?? '') || 100000);
  const runStart = Date.now();
  const tplCache = new Map<string, Tpl | null>();
  const getTpl = async (track: string, step: number): Promise<Tpl | null> => {
    const k = track + ':' + step;
    if (!tplCache.has(k)) { const { data } = await admin.from('email_templates').select('subject,preheader,blocks,wait_days,key').eq('track', track).eq('step', step).maybeSingle(); tplCache.set(k, data ? { subject: data.subject, preheader: data.preheader, blocks: data.blocks as Block[], wait_days: data.wait_days, key: data.key } : null); }
    return tplCache.get(k)!;
  };
  const jeJedenPrijemce = (typeof body.test_email === 'string' && body.test_email.includes('@')) || (typeof body.only_email === 'string' && body.only_email.includes('@'));
  let extraVars: Record<string, unknown> | null = null;
  if (body.vars && typeof body.vars === 'object') { if (jeJedenPrijemce) extraVars = body.vars as Record<string, unknown>; else console.warn('[drip-send] vars: ZAHOZENY, davkovy beh nesmi dosazovat stejne hodnoty vsem'); }
  if (typeof body.test_email === 'string' && body.test_email.includes('@')) {
    const track = String(body.track ?? 'existing-leadmagnet'); const step = Number(body.step ?? 0); const seg = normSeg(body.segment); const tpl = await getTpl(track, step);
    if (!tpl) return json({ ok: false, mode: 'test', error: 'no_template:' + track + ':' + step }, 400);
    try { const v = buildVars(String(body.name ?? ''), seg, SUPABASE_URL + '/functions/v1/unsubscribe?token=test-no-op', String(body.test_email), extraVars, CISLA); const m = renderEmail(tpl, seg, v, footer); const id = await sendViaResend(String(body.test_email), '[TEST] ' + m.subject, m.html, m.text, v.unsubscribe_url, replyTo, ''); await admin.from('email_events').insert({ lead_id: null, step, type: 'test', provider_id: id, detail: { track, seg } }); return json({ ok: true, mode: 'test', provider_id: id, track, step }); } catch (e) { return json({ ok: false, mode: 'test', error: String(e) }, 500); }
  }
  if (typeof body.oneoff_email === 'string' && body.oneoff_email.includes('@')) {
    const to = String(body.oneoff_email).trim().toLowerCase(); const track = String(body.track ?? ''); const step = Number(body.step ?? 0);
    if (!track) return json({ ok: false, mode: 'oneoff', error: 'missing_track' }, 400); const tpl = await getTpl(track, step); if (!tpl) return json({ ok: false, mode: 'oneoff', error: 'no_template:' + track + ':' + step }, 404);
    const { data: l } = await admin.from('leads').select('id,name,segment,status,unsubscribe_token,vars').eq('email', to).maybeSingle(); if (!l) return json({ ok: false, mode: 'oneoff', error: 'lead_neexistuje' }, 404); if (l.status !== 'active') return json({ ok: true, mode: 'oneoff', status: 'preskoceno', duvod: l.status });
    try { const seg = normSeg(body.segment ?? l.segment); const oneoffVars = (l.vars && typeof l.vars === 'object' && !Array.isArray(l.vars)) ? (l.vars as Record<string, unknown>)[track] as Record<string, unknown> | undefined : undefined; const v = buildVars(String(l.name ?? ''), seg, SUPABASE_URL + '/functions/v1/unsubscribe?token=' + l.unsubscribe_token, to, oneoffVars ?? null, CISLA); const m = renderEmail(tpl, seg, v, footer); const htmlOneoff = await ostopkuj(m.html, { track, step, key: tpl.key, lead_id: String(l.id) }, MAIL_TRACK_SECRET, SUPABASE_URL); const id = await sendViaResend(to, m.subject, htmlOneoff, m.text, v.unsubscribe_url, replyTo, ''); await admin.from('email_events').insert({ lead_id: l.id, step, type: 'oneoff', provider_id: id, detail: { track, key: tpl.key } }); return json({ ok: true, mode: 'oneoff', provider_id: id, track, step }); } catch (e) { return json({ ok: false, mode: 'oneoff', error: String(e) }, 500); }
  }
  const limit = Number(body.limit ?? 200); const onlyEmail = typeof body.only_email === 'string' ? String(body.only_email).toLowerCase() : ''; const FIELDS = 'id,email,name,segment,track,step,unsubscribe_token,next_send_at,vars,created_at'; const dueBase = () => admin.from('leads').select(FIELDS).eq('status', 'active').not('next_send_at', 'is', null).lte('next_send_at', nowIso).order('next_send_at', { ascending: true }).limit(limit);
  let leads: any[] = []; let poolInfo: Record<string, number> = {};
  if (onlyEmail) { const { data: due, error: dueErr } = await dueBase().eq('email', onlyEmail); if (dueErr) return json({ error: 'db_due', detail: dueErr.message }, 500); leads = due ?? []; } else { const { data: onb, error: e1 } = await dueBase().ilike('track', 'onboarding%'); if (e1) return json({ error: 'db_due', detail: e1.message }, 500); let nonOnb: any[] = []; if (followupsEnabled) { const { data: no, error: e2 } = await dueBase().not('track', 'ilike', 'onboarding%'); if (e2) return json({ error: 'db_due', detail: e2.message }, 500); nonOnb = no ?? []; } const freshCut = Date.now() - 2 * 86400000; const onbAll = onb ?? []; const freshOnb = onbAll.filter((l: { next_send_at: string }) => new Date(String(l.next_send_at)).getTime() >= freshCut); const staleOnb = onbAll.filter((l: { next_send_at: string }) => new Date(String(l.next_send_at)).getTime() < freshCut); poolInfo = { followups: nonOnb.length, fresh_onboarding: freshOnb.length, backlog_onboarding: staleOnb.length }; leads = [...nonOnb, ...freshOnb, ...staleOnb]; }
  const { data: exCoachRows } = await admin.from('entitlements').select('email').eq('product', 'coaching'); const exCoaching = new Set<string>((exCoachRows ?? []).map((r: { email: string }) => String(r.email ?? '').toLowerCase()).filter(Boolean));
  const { data: buyersRows } = await admin.from('entitlements').select('email,product').eq('active', true).or('expires_at.is.null,expires_at.gt.' + new Date().toISOString()).in('product', ['videokurz', 'academy', 'coaching', 'balicek']); const owns: Record<string, Set<string>> = { videokurz: new Set(), academy: new Set(), coaching: new Set(), balicek: new Set() }; for (const b of (buyersRows ?? []) as { email: string; product: string }[]) owns[b.product]?.add(b.email.toLowerCase());
  const shouldStop = (track: string, step: number, em: string): boolean => pravidlaShouldStop(track, step, em, owns, exCoaching);
  const APP_AKTIVACE_URL = 'https://kfkmghvhqwqtsalqjmrp.supabase.co/functions/v1/aktivace-stav'; const TRATE_SE_SIGNALEM = trateProAppSignal(KROK_PODLE_ZAPISU); let zapsaliAktivitu: Set<string> | null = null; let aktivaceStav = 'vypnuto';
  if (TRATE_SE_SIGNALEM.size > 0) { const ptameSeNa = [...new Set(leads.filter((l: { track?: string }) => TRATE_SE_SIGNALEM.has(String(l.track || ''))).map((l: { email: string }) => String(l.email ?? '').toLowerCase()).filter((e: string) => e.includes('@')))]; if (ptameSeNa.length === 0) aktivaceStav = 'nikdo_na_vetvene_trati'; else { try { const { data: hs } = await admin.from('app_config').select('value').eq('key', 'app_onboarding_secret').maybeSingle(); if (!hs?.value) aktivaceStav = 'chybi_secret'; else { const r = await fetch(APP_AKTIVACE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-app-secret': String(hs.value) }, body: JSON.stringify({ emaily: ptameSeNa }) }); const telo = await r.json().catch(() => ({})); if (r.ok) { const aktivni = nactiAktivniZOdpovedi(telo); if (aktivni) { zapsaliAktivitu = aktivni; aktivaceStav = 'ok'; } else aktivaceStav = 'odpoved_' + r.status; } else aktivaceStav = 'odpoved_' + r.status; } } catch (e) { aktivaceStav = 'vyjimka_' + String(e).slice(0, 60); } } }
  const stavZapisu = (em: string): StavZapisu => zapsaliAktivitu === null ? 'nevime' : (zapsaliAktivitu.has(em.toLowerCase()) ? 'zapsal' : 'nezapsal'); const akcePodleZapisu = (l: { track?: string; step: number; email: string; vars?: unknown; created_at?: unknown }) => { const od = cadenceOdIso(l.vars, l.created_at, nowIso); return rozhodniPodleZapisu(String(l.track || ''), l.step, stavZapisu(String(l.email)), KROK_PODLE_ZAPISU, { oknoUplynulo: oknoUplynulo(od, Date.parse(nowIso)) }); };
  const kamDal = async (l: any): Promise<string | null> => { const cil = vyberMost(MOSTY, String(l.track || '')); if (!cil) return null; const em = String(l.email).toLowerCase(); if (mostBlokujeVlastnictvi(cil.track, em, owns, exCoaching)) return null; if (mostBlokujeNeaktivitu(String(l.track || ''), cil.track, stavZapisu(em))) return null; if (!(await getTpl(cil.track, 0))) return null; const { data: uzTamByl } = await admin.from('email_events').select('id').eq('lead_id', l.id).eq('type', 'sent').eq('detail->>track', cil.track).limit(1); if ((uzTamByl ?? []).length > 0) return null; return cil.track; };
  const mostNaDalsiTrat = async (l: any): Promise<string | null> => { const cilTrack = await kamDal(l); if (!cilTrack) return null; const poDnech = odstupDnu(MOSTY[String(l.track || '')]?.po_dnech); await admin.from('leads').update({ track: cilTrack, step: 0, next_send_at: new Date(Date.now() + poDnech * 86400000).toISOString(), updated_at: nowIso }).eq('id', l.id); await admin.from('email_events').insert({ lead_id: l.id, step: l.step, type: 'bridged', detail: { track: l.track, z: l.track, na: cilTrack, po_dnech: poDnech } }); return cilTrack; };
  if (body.dry === true) { const byStep: Record<string, number> = {}; const byBridge: Record<string, number> = {}; let would = 0, bought = 0, invalid = 0, wouldBridge = 0, wouldSkipOwns = 0, wouldSkipZapis = 0; let wouldDelayZapis = 0, wouldPauseNeaktivita = 0, wouldRescueNeaktivita = 0, wouldSkipBridgeNeaktivita = 0; const byZapis: Record<string, number> = {}; for (const l of leads) { if (shouldStop(String(l.track || ''), l.step, String(l.email).toLowerCase())) { bought++; continue; } if (maPreskocitKrok(String(l.track || ''), l.step, String(l.email), owns)) { wouldSkipOwns++; continue; } const akce = akcePodleZapisu(l); const kCad = l.track + '/step' + l.step + ':' + akce.typ; if (akce.typ === 'preskoc') { wouldSkipZapis++; byZapis[kCad] = (byZapis[kCad] ?? 0) + 1; continue; } if (akce.typ === 'odloz') { wouldDelayZapis++; byZapis[kCad] = (byZapis[kCad] ?? 0) + 1; continue; } if (akce.typ === 'pauza') { wouldPauseNeaktivita++; byZapis[kCad] = (byZapis[kCad] ?? 0) + 1; continue; } const tpl = await getTpl(l.track, akce.typ === 'rescue_krok' ? akce.step : l.step); if (akce.typ === 'rescue_pauza' || akce.typ === 'rescue_krok') { wouldRescueNeaktivita++; byZapis[kCad] = (byZapis[kCad] ?? 0) + 1; if (!tpl) { wouldPauseNeaktivita++; continue; } const key = l.track + '/step' + (akce.typ === 'rescue_krok' ? akce.step : l.step) + ':' + tpl.key + ':rescue'; byStep[key] = (byStep[key] ?? 0) + 1; would++; continue; } if (!tpl) { const cil = vyberMost(MOSTY, String(l.track || '')); if (cil && mostBlokujeNeaktivitu(String(l.track || ''), cil.track, stavZapisu(String(l.email).toLowerCase()))) wouldSkipBridgeNeaktivita++; const na = await kamDal(l); if (na) { wouldBridge++; byBridge[l.track + '->' + na] = (byBridge[l.track + '->' + na] ?? 0) + 1; } else invalid++; continue; } if (tpl.wait_days == null) { const cil = vyberMost(MOSTY, String(l.track || '')); if (cil && mostBlokujeNeaktivitu(String(l.track || ''), cil.track, stavZapisu(String(l.email).toLowerCase()))) { wouldSkipBridgeNeaktivita++; wouldPauseNeaktivita++; } const na = await kamDal(l); if (na) { wouldBridge++; byBridge[l.track + '->' + na] = (byBridge[l.track + '->' + na] ?? 0) + 1; } } const key = l.track + '/step' + l.step + ':' + tpl.key; byStep[key] = (byStep[key] ?? 0) + 1; would++; } return json({ ok: true, mode: 'dry', stopa: stopaStav, followups_enabled: followupsEnabled, daily_cap: DAILY_CAP, pools: poolInfo, due: leads.length, would_send: would, skip_bought: bought, would_skip_owns: wouldSkipOwns, invalid_track_step: invalid, would_bridge: wouldBridge, by_bridge: byBridge, mosty: Object.keys(MOSTY), preskoc_kroky: Object.keys(PRESKOC_KROK_KDYZ_VLASTNI), zapis_kroky: Object.keys(KROK_PODLE_ZAPISU), zapis_signal: aktivaceStav, would_skip_zapis: wouldSkipZapis, would_delay_zapis: wouldDelayZapis, would_pause_neaktivita: wouldPauseNeaktivita, would_rescue_neaktivita: wouldRescueNeaktivita, would_skip_bridge_neaktivita: wouldSkipBridgeNeaktivita, by_zapis: byZapis, by_step: byStep, okno_neaktivity_dni: OKNO_NEAKTIVITY_DNI }); }
  const dayStart = new Date(nowIso); dayStart.setUTCHours(0, 0, 0, 0); const { count: sentToday } = await admin.from('email_events').select('id', { count: 'exact', head: true }).eq('type', 'sent').gte('created_at', dayStart.toISOString()); const remaining = onlyEmail ? Number.MAX_SAFE_INTEGER : Math.max(0, DAILY_CAP - (sentToday ?? 0));
  let sent = 0, skippedAlready = 0, errors = 0, finished = 0, stopped = 0, gaveUp = 0, bridged = 0, skippedOwns = 0, skippedZapis = 0, delayedZapis = 0, pausedNeaktivita = 0, rescuedNeaktivita = 0, capped = false, timeUp = false; const byStep: Record<string, number> = {}; const byBridge: Record<string, number> = {};
  for (const l of leads) {
    if (sent >= remaining) { capped = true; break; } if (Date.now() - runStart > RUN_DEADLINE_MS) { timeUp = true; break; } const seg = normSeg(l.segment); const dueTpl = await getTpl(l.track, l.step);
    if (!dueTpl) { const na = await mostNaDalsiTrat(l); if (na) { bridged++; byBridge[l.track + '->' + na] = (byBridge[l.track + '->' + na] ?? 0) + 1; continue; } await admin.from('leads').update({ next_send_at: null, updated_at: nowIso }).eq('id', l.id); finished++; continue; }
    let tpl = dueTpl;
    if (shouldStop(String(l.track || ''), l.step, String(l.email).toLowerCase())) { await admin.from('leads').update({ status: 'purchased', next_send_at: null, updated_at: nowIso }).eq('id', l.id); await admin.from('email_events').insert({ lead_id: l.id, step: l.step, type: 'skip_purchased', detail: { track: l.track } }); stopped++; continue; }
    const { data: already } = await admin.from('email_events').select('id').eq('lead_id', l.id).eq('step', l.step).eq('type', 'sent').eq('detail->>track', l.track).maybeSingle(); const advance = async () => { const ns = l.step + 1; const bylOdhlaseny = !!(l.vars && typeof l.vars === 'object' && !Array.isArray(l.vars) && (l.vars as Record<string, unknown>)._byl_odhlaseny); if (bylOdhlaseny && l.step === 0 && String(l.track || '').startsWith('onboarding-nakup-')) { await admin.from('leads').update({ status: 'unsubscribed', next_send_at: null, step: ns, updated_at: nowIso }).eq('id', l.id); await admin.from('email_events').insert({ lead_id: l.id, step: l.step, type: 'stop_odhlaseny_kupec', detail: { track: l.track, duvod: 'koupil po odhlášení, doručení odesláno, marketing ne' } }); finished++; return; } if (tpl.wait_days == null) { const na = await mostNaDalsiTrat(l); if (na) { bridged++; byBridge[l.track + '->' + na] = (byBridge[l.track + '->' + na] ?? 0) + 1; return; } const cilMostu = vyberMost(MOSTY, String(l.track || '')); if (cilMostu && mostBlokujeNeaktivitu(String(l.track || ''), cilMostu.track, stavZapisu(String(l.email)))) { await admin.from('leads').update({ status: 'paused', next_send_at: null, step: ns, updated_at: nowIso }).eq('id', l.id); await admin.from('email_events').insert({ lead_id: l.id, step: l.step, type: 'paused_neaktivita', detail: { track: l.track, key: tpl.key, podminka: 'most_neaktivita', stav: stavZapisu(String(l.email)) } }); pausedNeaktivita++; return; } await admin.from('leads').update({ step: ns, next_send_at: null, updated_at: nowIso }).eq('id', l.id); finished++; } else { const next = new Date(Date.now() + tpl.wait_days * 86400000).toISOString(); await admin.from('leads').update({ step: ns, next_send_at: next, updated_at: nowIso }).eq('id', l.id); } };
    const preskocProdukt = maPreskocitKrok(String(l.track || ''), l.step, String(l.email), owns); if (preskocProdukt) { await admin.from('email_events').insert({ lead_id: l.id, step: l.step, type: 'skip_owns_product', detail: { track: l.track, key: tpl.key, produkt: preskocProdukt } }); await advance(); skippedOwns++; continue; }
    if (already) { await advance(); skippedAlready++; continue; }
    const akce = akcePodleZapisu(l); let rescueThenPause = false; let krokSend = l.step; const pauzniNeaktivitu = async (krok: number, key: string, podminka: string) => { await admin.from('leads').update({ status: 'paused', next_send_at: null, step: krok, updated_at: nowIso }).eq('id', l.id); await admin.from('email_events').insert({ lead_id: l.id, step: krok, type: 'paused_neaktivita', detail: { track: l.track, key, podminka, stav: stavZapisu(String(l.email)) } }); };
    if (akce.typ === 'preskoc') { await admin.from('email_events').insert({ lead_id: l.id, step: l.step, type: 'skip_podle_zapisu', detail: { track: l.track, key: tpl.key, podminka: akce.podminka, stav: stavZapisu(String(l.email)) } }); await advance(); skippedZapis++; continue; }
    if (akce.typ === 'odloz') { const od = cadenceOdIso(l.vars, l.created_at, nowIso); const noveVars = varsSCadenceOd(l.vars, od); const next = new Date(Date.now() + ODLOZ_MS).toISOString(); await admin.from('leads').update({ next_send_at: next, vars: noveVars, updated_at: nowIso }).eq('id', l.id); await admin.from('email_events').insert({ lead_id: l.id, step: l.step, type: 'odklad_neaktivita', detail: { track: l.track, key: tpl.key, podminka: akce.podminka, stav: stavZapisu(String(l.email)), od } }); delayedZapis++; continue; }
    if (akce.typ === 'pauza') { await pauzniNeaktivitu(l.step, tpl.key, akce.podminka); pausedNeaktivita++; continue; }
    if (akce.typ === 'rescue_krok') { const rtpl = await getTpl(l.track, akce.step); if (!rtpl) { await pauzniNeaktivitu(l.step, tpl.key, akce.podminka); pausedNeaktivita++; continue; } const { data: alreadyRescue } = await admin.from('email_events').select('id').eq('lead_id', l.id).eq('step', akce.step).eq('type', 'sent').eq('detail->>track', l.track).maybeSingle(); if (alreadyRescue) { await pauzniNeaktivitu(akce.step, rtpl.key, akce.podminka); pausedNeaktivita++; continue; } tpl = rtpl; krokSend = akce.step; rescueThenPause = true; } else if (akce.typ === 'rescue_pauza') rescueThenPause = true;
    try { const varsZLeada = (l.vars && typeof l.vars === 'object' && !Array.isArray(l.vars)) ? (l.vars as Record<string, unknown>)[String(l.track)] as Record<string, unknown> | undefined : undefined; const v = buildVars(String(l.name ?? ''), seg, SUPABASE_URL + '/functions/v1/unsubscribe?token=' + l.unsubscribe_token, String(l.email), extraVars ?? varsZLeada ?? null, CISLA); const m = renderEmail(tpl, seg, v, footer); const htmlSeStopou = await ostopkuj(m.html, { track: String(l.track), step: krokSend, key: tpl.key, lead_id: String(l.id) }, MAIL_TRACK_SECRET, SUPABASE_URL, !archiveBcc); await pace(); const id = await sendViaResend(l.email, m.subject, htmlSeStopou, m.text, v.unsubscribe_url, replyTo, archiveBcc); const sentDetail = rescueThenPause ? { track: l.track, key: tpl.key, cadence: 'rescue' } : { track: l.track, key: tpl.key }; const { error: logErr } = await admin.from('email_events').insert({ lead_id: l.id, step: krokSend, type: 'sent', provider_id: id, detail: sentDetail }); if (logErr && !String(logErr.code).includes('23505')) throw new Error('log:' + logErr.message); if (rescueThenPause) { const podminkaPauzy = akce.typ === 'rescue_krok' || akce.typ === 'rescue_pauza' ? akce.podminka : 'jen_kdyz_aktivni'; await pauzniNeaktivitu(krokSend, tpl.key, podminkaPauzy); rescuedNeaktivita++; } else await advance(); sent++; const k = l.track + '/step' + krokSend + ':' + tpl.key; byStep[k] = (byStep[k] ?? 0) + 1; } catch (e) { errors++; await admin.from('email_events').insert({ lead_id: l.id, step: l.step, type: 'error', detail: { track: l.track, error: String(e).slice(0, 400) } }); const { count: failCount } = await admin.from('email_events').select('id', { count: 'exact', head: true }).eq('lead_id', l.id).eq('step', l.step).eq('type', 'error').eq('detail->>track', l.track); const jeClensky = CLENSKE_PREFIXY.some((p) => String(l.track || '').startsWith(p)); if (jeClensky && (failCount ?? 0) >= MAX_TRIES) { if ((failCount ?? 0) === MAX_TRIES) await admin.from('email_events').insert({ lead_id: l.id, step: l.step, type: 'gave_up_warn', detail: { track: l.track, tries: failCount ?? 0 } }); const retry = new Date(Date.now() + 6 * 3600000).toISOString(); await admin.from('leads').update({ next_send_at: retry, updated_at: nowIso }).eq('id', l.id); } else if ((failCount ?? 0) >= MAX_TRIES) { await admin.from('leads').update({ status: 'paused', next_send_at: null, updated_at: nowIso }).eq('id', l.id); await admin.from('email_events').insert({ lead_id: l.id, step: l.step, type: 'gave_up', detail: { track: l.track, tries: failCount ?? 0 } }); gaveUp++; } else { const retry = new Date(Date.now() + 6 * 3600000).toISOString(); await admin.from('leads').update({ next_send_at: retry, updated_at: nowIso }).eq('id', l.id); } }
  }
  return json({ ok: true, mode: 'live', stopa: stopaStav, followups_enabled: followupsEnabled, due: leads.length, sent, daily_cap: DAILY_CAP, send_gap_ms: SEND_GAP_MS, max_tries: MAX_TRIES, pools: poolInfo, sent_today_before: sentToday ?? 0, remaining_today: remaining, capped, time_up: timeUp, skipped_already: skippedAlready, stopped_bought: stopped, skipped_owns: skippedOwns, skipped_zapis: skippedZapis, delayed_zapis: delayedZapis, paused_neaktivita: pausedNeaktivita, rescued_neaktivita: rescuedNeaktivita, zapis_signal: aktivaceStav, finished, errors, gave_up: gaveUp, bridged, by_bridge: byBridge, mosty: Object.keys(MOSTY), zapis_kroky: Object.keys(KROK_PODLE_ZAPISU), okno_neaktivity_dni: OKNO_NEAKTIVITY_DNI, by_step: byStep });
});
