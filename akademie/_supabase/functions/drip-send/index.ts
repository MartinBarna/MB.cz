// Barna Academy - drip-send (email nurture / DRIP engine). Deno, deploy --no-verify-jwt.
// Copy zije v DB (email_templates + app_config footer_*), aby sla menit bez redeploye.
// Gender tokeny v copy: [[zena||muz]] a [a]. Merge: dvojite-slozene-zavorky key. Viz README.md.
// Rezimy POST JSON: dry:true | test_email+track+step+segment+name | prazdne (ostry beh).
// Auth: x-drip-secret (nebo ?secret=) == app_config drip_invoke_secret. Klice jen z env.
// Pozn.: zdrojak je zamerne bez znaku uvozovek a zpetnych lomitek (kvuli snadnemu deployi).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const NL = String.fromCharCode(10);   // newline
const DQ = String.fromCharCode(34);   // double-quote char

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = 'Martin Barna <news@martinbarna.cz>';
const SITE = 'https://martinbarna.cz';
const COURSE_URL = 'https://form.simpleshop.cz/3Vbl/buy/';
const FREE_LESSONS_URL = 'https://www.martinbarna.cz/videokurz#zdarma';
const COURSE_PRICE = 800;
const DISCOUNT_CODE = 'ZACNI15';
const DISCOUNT_PCT = 15;

type Seg = 'zeny' | 'muzi' | 'other';
const isFem = (seg: Seg) => seg === 'zeny';

const esc = (s: string) =>
  s.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split(DQ).join('&quot;');

// gender expanze: [[zena||muz]] a [a] (bez regexu)
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
  return out.split('[a]').join(isFem(seg) ? 'a' : '');
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
const hasToken = (s: string) => s.includes('{{') || s.includes('[[') || s.includes(']]') || s.includes('[a]');

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
  | { t: 'ps'; html: string };

function renderHtml(blocks: Block[], seg: Seg, v: Record<string, string>): string {
  return blocks.map((b) => {
    if (b.t === 'p') return `<p style='margin:0 0 14px'>${fill(b.html, seg, v)}</p>`;
    if (b.t === 'ps') return `<p style='margin:16px 0 0;color:#666;font-style:italic'>${fill(b.html, seg, v)}</p>`;
    if (b.t === 'bullets')
      return `<ul style='margin:0 0 14px;padding-left:20px'>` +
        b.items.map((li) => `<li style='margin:0 0 7px'>${fill(li, seg, v)}</li>`).join('') + `</ul>`;
    return `<p style='margin:4px 0 18px'><a href='${fill(b.href, seg, v)}' style='display:inline-block;background:#ff7a00;color:#161616;text-decoration:none;padding:13px 24px;border-radius:50px;font-weight:700'>${esc(fill(b.text, seg, v))}</a></p>`;
  }).join(NL);
}
function renderText(blocks: Block[], seg: Seg, v: Record<string, string>): string {
  return blocks.map((b) => {
    if (b.t === 'bullets') return b.items.map((li) => '- ' + inlineToText(fill(li, seg, v))).join(NL);
    if (b.t === 'btn') return fill(b.text, seg, v) + ': ' + fill(b.href, seg, v);
    return inlineToText(fill(b.html, seg, v));
  }).join(NL + NL);
}
function wrapHtml(preheader: string, body: string, footerHtml: string): string {
  return `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head>` +
    `<body style='margin:0;background:#f4f4f5;padding:16px'>` +
    `<span style='display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden'>${esc(preheader)}</span>` +
    `<div style='font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#222;max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:28px'>` +
    body +
    `<hr style='border:none;border-top:1px solid #eee;margin:22px 0 14px'>` +
    `<div style='font-size:12px;line-height:1.5;color:#999'>${footerHtml}</div></div></body></html>`;
}

function buildVars(name: string, seg: Seg, unsub: string): Record<string, string> {
  const parts = (name || '').trim().split(' ').filter((x) => x.length > 0);
  const t = parts[0] || '';
  const fn = t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  const dprice = Math.round(COURSE_PRICE * (1 - DISCOUNT_PCT / 100));
  return {
    first_name: fn, fn_space: fn ? ' ' + fn : '', fn_suffix: fn ? ', ' + fn : '', fn_prefix: fn ? fn + ', ' : '',
    lead_magnet_url: seg === 'muzi' ? SITE + '/download/forma-zpet-muzi.pdf' : SITE + '/download/makro-plan-zeny.pdf',
    plan_page_url: seg === 'muzi' ? SITE + '/forma-zpet' : SITE + '/makro-plan',
    course_url: COURSE_URL, free_lessons_url: FREE_LESSONS_URL,
    course_price: String(COURSE_PRICE), discount_pct: String(DISCOUNT_PCT),
    discount_price: String(dprice), discount_code: DISCOUNT_CODE, unsubscribe_url: unsub,
  };
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
  // archiveBcc = skryta kopie na Martinuv mail (app_config archive_bcc), at vidi vse co odejde.
  // Nikdy neBCCujeme prijemce sameho na sebe (kdyby si Martin stahl vlastni lead-magnet).
  const bcc = archiveBcc && archiveBcc.toLowerCase() !== to.toLowerCase() ? [archiveBcc] : undefined;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM, to: [to], subject, html, text,
      reply_to: replyTo || undefined,
      bcc,
      headers: { 'List-Unsubscribe': '<' + unsub + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('resend_' + res.status + ':' + JSON.stringify(body));
  return (body as { id?: string }).id ?? '';
}

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
const normSeg = (s: unknown): Seg => (s === 'zeny' || s === 'muzi' ? s : 'other');

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: cfg } = await admin.from('app_config').select('value').eq('key', 'drip_invoke_secret').maybeSingle();
  const expected = cfg?.value ?? '';
  const provided = req.headers.get('x-drip-secret') || new URL(req.url).searchParams.get('secret') || '';
  if (!expected || provided !== expected) return json({ error: 'unauthorized' }, 401);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nowIso = new Date().toISOString();

  const { data: fRows } = await admin.from('app_config').select('key,value').in('key', ['footer_html', 'footer_text', 'reply_to_email', 'archive_bcc']);
  const fMap = Object.fromEntries((fRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  const footer = { html: fMap.footer_html ?? '', text: fMap.footer_text ?? '' };
  const replyTo = fMap.reply_to_email ?? '';   // kam chodi odpovedi (ulozeno v app_config, ne v gitu)
  const archiveBcc = fMap.archive_bcc ?? '';   // skryta kopie vsech ostrych sendu na Martinuv mail (prazdne = vypnuto)

  const tplCache = new Map<string, Tpl | null>();
  const getTpl = async (track: string, step: number): Promise<Tpl | null> => {
    const k = track + ':' + step;
    if (!tplCache.has(k)) {
      const { data } = await admin.from('email_templates')
        .select('subject,preheader,blocks,wait_days,key').eq('track', track).eq('step', step).maybeSingle();
      tplCache.set(k, data ? { subject: data.subject, preheader: data.preheader, blocks: data.blocks as Block[], wait_days: data.wait_days, key: data.key } : null);
    }
    return tplCache.get(k)!;
  };

  // TEST
  if (typeof body.test_email === 'string' && body.test_email.includes('@')) {
    const track = String(body.track ?? 'existing-leadmagnet');
    const step = Number(body.step ?? 0);
    const seg = normSeg(body.segment);
    const tpl = await getTpl(track, step);
    if (!tpl) return json({ ok: false, mode: 'test', error: 'no_template:' + track + ':' + step }, 400);
    try {
      const v = buildVars(String(body.name ?? ''), seg, SUPABASE_URL + '/functions/v1/unsubscribe?token=test-no-op');
      const m = renderEmail(tpl, seg, v, footer);
      const id = await sendViaResend(String(body.test_email), '[TEST] ' + m.subject, m.html, m.text, v.unsubscribe_url, replyTo, '');
      await admin.from('email_events').insert({ lead_id: null, step, type: 'test', provider_id: id, detail: { track, seg } });
      return json({ ok: true, mode: 'test', provider_id: id, track, step });
    } catch (e) {
      return json({ ok: false, mode: 'test', error: String(e) }, 500);
    }
  }

  // due leady (only_email = zpracuj jen jeden konkretni lead -> bezpecny instant-send bez zavodu)
  const limit = Number(body.limit ?? 200);
  const onlyEmail = typeof body.only_email === 'string' ? String(body.only_email).toLowerCase() : '';
  let dueQ = admin.from('leads')
    .select('id,email,name,segment,track,step,unsubscribe_token')
    .eq('status', 'active').not('next_send_at', 'is', null).lte('next_send_at', nowIso);
  if (onlyEmail) dueQ = dueQ.eq('email', onlyEmail);
  const { data: due, error: dueErr } = await dueQ.order('next_send_at', { ascending: true }).limit(limit);
  if (dueErr) return json({ error: 'db_due', detail: dueErr.message }, 500);
  const leads = due ?? [];

  const { data: buyersRows } = await admin.from('entitlements').select('email').eq('product', 'videokurz').eq('active', true);
  const buyers = new Set((buyersRows ?? []).map((b: { email: string }) => b.email.toLowerCase()));

  // DRY
  if (body.dry === true) {
    const byStep: Record<string, number> = {};
    let would = 0, bought = 0, invalid = 0;
    for (const l of leads) {
      if (buyers.has(String(l.email).toLowerCase())) { bought++; continue; }
      const tpl = await getTpl(l.track, l.step);
      if (!tpl) { invalid++; continue; }
      const key = l.track + '/step' + l.step + ':' + tpl.key;
      byStep[key] = (byStep[key] ?? 0) + 1; would++;
    }
    return json({ ok: true, mode: 'dry', due: leads.length, would_send: would, skip_bought: bought, invalid_track_step: invalid, by_step: byStep });
  }

  // LIVE
  let sent = 0, skippedAlready = 0, errors = 0, finished = 0, stopped = 0;
  const byStep: Record<string, number> = {};
  for (const l of leads) {
    const seg = normSeg(l.segment);
    const tpl = await getTpl(l.track, l.step);
    if (!tpl) { await admin.from('leads').update({ next_send_at: null, updated_at: nowIso }).eq('id', l.id); finished++; continue; }
    if (buyers.has(String(l.email).toLowerCase())) {
      await admin.from('leads').update({ status: 'purchased', next_send_at: null, updated_at: nowIso }).eq('id', l.id);
      await admin.from('email_events').insert({ lead_id: l.id, step: l.step, type: 'skip_purchased', detail: { track: l.track } });
      stopped++; continue;
    }
    const { data: already } = await admin.from('email_events')
      .select('id').eq('lead_id', l.id).eq('step', l.step).eq('type', 'sent').maybeSingle();
    const advance = async () => {
      const ns = l.step + 1;
      if (tpl.wait_days == null) {
        await admin.from('leads').update({ step: ns, next_send_at: null, updated_at: nowIso }).eq('id', l.id); finished++;
      } else {
        const next = new Date(Date.now() + tpl.wait_days * 86400000).toISOString();
        await admin.from('leads').update({ step: ns, next_send_at: next, updated_at: nowIso }).eq('id', l.id);
      }
    };
    if (already) { await advance(); skippedAlready++; continue; }
    try {
      const v = buildVars(String(l.name ?? ''), seg, SUPABASE_URL + '/functions/v1/unsubscribe?token=' + l.unsubscribe_token);
      const m = renderEmail(tpl, seg, v, footer);
      const id = await sendViaResend(l.email, m.subject, m.html, m.text, v.unsubscribe_url, replyTo, archiveBcc);
      const { error: logErr } = await admin.from('email_events')
        .insert({ lead_id: l.id, step: l.step, type: 'sent', provider_id: id, detail: { track: l.track, key: tpl.key } });
      if (logErr && !String(logErr.code).includes('23505')) throw new Error('log:' + logErr.message);
      await advance(); sent++;
      const k = l.track + '/step' + l.step + ':' + tpl.key; byStep[k] = (byStep[k] ?? 0) + 1;
    } catch (e) {
      errors++;
      await admin.from('email_events').insert({ lead_id: l.id, step: l.step, type: 'error', detail: { track: l.track, error: String(e).slice(0, 400) } });
      const retry = new Date(Date.now() + 6 * 3600000).toISOString();
      await admin.from('leads').update({ next_send_at: retry, updated_at: nowIso }).eq('id', l.id);
    }
  }
  return json({ ok: true, mode: 'live', due: leads.length, sent, skipped_already: skippedAlready, stopped_bought: stopped, finished, errors, by_step: byStep });
});
