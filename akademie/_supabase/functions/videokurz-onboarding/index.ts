// synced from deployed v10, 2026-07-16
// [2026-07-16] jedina zmena proti nasazene v10: odstranen ?secret= fallback v auth
// (secret v query stringu konci v lozich) — auth jen pres hlavicku x-drip-secret.
// Barna Academy - videokurz-onboarding. Jednorazovy uvitaci/migracni mail pro zakazniky videokurzu.
// Cili na public.customer_contacts (status='active', onboarding_sent_at IS NULL). Pojistka proti duplicitam:
// po odeslani orazitkuje onboarding_sent_at -> dalsi beh trefi jen nove pridane kontakty, nikdy nikoho 2x.
// Rezimy POST JSON: {dry:true} | {test_email,variant,name} | {live:true,limit} . Auth: x-drip-secret == app_config.drip_invoke_secret.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const NL = String.fromCharCode(10);
const DQ = String.fromCharCode(34);
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = 'Martin Barna <news@martinbarna.cz>';
const REPLY_TO = 'fitness.barna@gmail.com';
const SITE = 'https://martinbarna.cz';
const ACADEMY_URL = SITE + '/akademie/';
const NAVOD_URL = SITE + '/akademie/navod/';

const esc = (s: string) =>
  s.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split(DQ).join('&quot;');

const loginUrl = (email: string) => SITE + '/akademie/prihlaseni/?tab=up&email=' + encodeURIComponent(email);
const unsubUrl = (token: string) => SUPABASE_URL + '/functions/v1/unsubscribe?token=' + encodeURIComponent(token);

// 5. pad (osloveni) — konzervativne: -a->-o + jista muzska jmena; souhlaskova nejista jmena
// (segment neznamy) nechavame v 1. pade, at nerozbijeme zenska (Dagmar, Ester...).
const VOK_EXC: Record<string, string> = { jan: 'Jane', pavel: 'Pavle', karel: 'Karle', zdenek: 'Zdenku', 'zdeněk': 'Zdeňku', josef: 'Josefe' };
const VOK_VW = 'aeiouyáéěíóúůý';
const VOK_FEM_CONS = new Set(["dagmar", "ester", "miriam", "mirjam", "ingrid", "karin", "katrin", "kristin", "kirsten", "nikol", "nicol", "doris", "iris", "ines", "agnes", "ruth", "elen", "ellen", "helen", "karen", "sharon", "megan", "vivien", "evelin", "marlen", "carmen", "dolores", "mercedes", "rachel"]);
function vokativ(fn: string, male = false): string {
  if (!fn) return fn;
  const low = fn.toLowerCase();
  if (low in VOK_EXC) return VOK_EXC[low];
  const last = low.slice(-1);
  if (last === 'a') return fn.slice(0, -1) + 'o';
  if (VOK_VW.includes(last)) return fn;
  // zenska souhlaskova jmena maji vokativ = nominativ; ostatni souhlaskova sklonujeme muzsky
  if (!male && VOK_FEM_CONS.has(low)) return fn;
  if (low.endsWith('ek')) return fn.slice(0, -2) + 'ku';
  if (low.endsWith('ch') || 'kgh'.includes(last)) return fn + 'u';
  if ('szxj'.includes(last) || 'šžč'.includes(last)) return fn + 'i';
  if (low.endsWith('el')) return fn + 'i';
  if (last === 'r') return VOK_VW.includes(low.slice(-2, -1)) ? fn + 'e' : fn.slice(0, -1) + 'ře';
  if ('bdflmnptvw'.includes(last)) return fn + 'e';
  return fn;
}
const firstName = (name: string) => {
  const t = (name || '').trim().split(' ').filter((x) => x.length > 0)[0] || '';
  return vokativ(t ? t.charAt(0).toUpperCase() + t.slice(1) : '');
};

function buildEmail(variant: string, email: string, name: string, token: string) {
  const fn = firstName(name);
  const hi = 'Ahoj' + (fn ? ', ' + esc(fn) : '') + ',';
  const intro = variant === 'manual'
    ? 'máš u mě <strong>videokurz výživy</strong> — vítej! Celý kurz teď najdeš v nové <strong>členské sekci</strong> a tvůj přístup je už aktivní.'
    : 'máš u mě <strong>videokurz výživy</strong> — a patříš mezi <strong>původní klienty</strong>, co si ho koupili ještě na starém webu. O to víc mi záleží, aby ses k němu dostal v plné kráse. 🙏';
  const subject = variant === 'manual'
    ? 'Vítej ve videokurzu výživy 🎬 (přístup máš aktivní)'
    : 'Tvůj videokurz má nový domov 🎬 (přístup už máš aktivní)';
  const preheader = 'Stačí se jednou přihlásit — návod uvnitř. Přístup je už aktivní, nic neplatíš znovu.';
  const btn = loginUrl(email);
  const unsub = unsubUrl(token);

  const body =
    `<p style='margin:0 0 14px'>${hi}</p>` +
    `<p style='margin:0 0 14px'>${intro}</p>` +
    `<p style='margin:0 0 10px'>Celý kurz jsem přestavěl do nové <strong>členské sekce</strong>:</p>` +
    `<ul style='margin:0 0 14px;padding-left:20px'>` +
      `<li style='margin:0 0 7px'>všech <strong>182 lekcí</strong> pohromadě, podle modulů</li>` +
      `<li style='margin:0 0 7px'>přílohy, jídelníčky a e-booky ke stažení</li>` +
      `<li style='margin:0 0 7px'>postup, vyhledávání, funguje i na mobilu — celé v novém designu</li>` +
    `</ul>` +
    `<p style='margin:0 0 10px'><strong>Tvůj přístup je už aktivní — nic neplatíš znovu.</strong> Přihlášení zabere dvě minuty:</p>` +
    `<ol style='margin:0 0 18px;padding-left:20px'>` +
      `<li style='margin:0 0 7px'>Klikni na tlačítko níže.</li>` +
      `<li style='margin:0 0 7px'>Dej <strong>„Vytvořit účet“</strong> a vymysli si heslo (tvůj e-mail je v odkazu už správně předvyplněný).</li>` +
      `<li style='margin:0 0 7px'>Pak se přihlas stejným e-mailem a heslem — a jsi uvnitř. 🎉</li>` +
    `</ol>` +
    `<p style='margin:4px 0 18px'><a href='${esc(btn)}' style='display:inline-block;background:#EBB12C;color:#1A1222;text-decoration:none;padding:14px 26px;border-radius:0;font-weight:700;text-transform:uppercase;letter-spacing:.05em'>Vstoupit do videokurzu →</a></p>` +
    `<p style='margin:0 0 14px;font-size:14px;color:#A09AAD'>Nevíš si rady? Připravil jsem <a href='${esc(NAVOD_URL)}' style='color:#F6CD63'>návod krok za krokem</a>. A kdyby cokoliv zlobilo, stačí odepsat na tenhle e-mail — spravím to.</p>` +
    `<p style='margin:16px 0 0;color:#A09AAD;font-style:italic'>P.S. Pokud tě výživa fakt chytla a chceš jít do hloubky — celou vědu, certifikaci a 19 modulů máš v <a href='${esc(ACADEMY_URL)}' style='color:#F6CD63'>Barna Academy</a>. Ale to počká, teď si hlavně užij videokurz. 😉</p>`;

  const footerHtml =
    `Tento e-mail ti přišel, protože máš u Martina Barny zakoupený videokurz výživy.<br>` +
    `Nechceš už e-maily? <a href='${esc(unsub)}' style='color:#8F8A99'>Odhlásit se</a> — jedním klikem.<br>` +
    `Martin Barna — online výživový Coach · <a href='https://martinbarna.cz' style='color:#8F8A99'>martinbarna.cz</a>`;

  const html =
    `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='color-scheme' content='dark'></head>` +
    `<body style='margin:0;padding:0;background:#0C0B10'>` +
    `<span style='display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden'>${esc(preheader)}</span>` +
    `<table role='presentation' width='100%' cellpadding='0' cellspacing='0' bgcolor='#0C0B10' style='background:#0C0B10'><tr><td align='center' style='padding:16px'>` +
    `<table role='presentation' width='560' cellpadding='0' cellspacing='0' bgcolor='#181520' style='width:100%;max-width:560px;background:#181520;border-radius:2px;border:1px solid #262232'><tr><td style='font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#F0EADF;padding:28px'>` +
    body +
    `<hr style='border:none;border-top:1px solid #262232;margin:22px 0 14px'>` +
    `<div style='font-size:12px;line-height:1.5;color:#8F8A99'>${footerHtml}</div>` +
    `</td></tr></table></td></tr></table></body></html>`;

  const text =
    hi + NL + NL +
    (variant === 'manual'
      ? 'mas u me videokurz vyzivy - vitej! Cely kurz najdes v nove clenske sekci a tvuj pristup je uz aktivni.'
      : 'mas u me videokurz vyzivy - a patris mezi puvodni klienty ze stareho webu. Cely kurz jsem prestavel do nove clenske sekce.') + NL + NL +
    '- vsech 182 lekci podle modulu' + NL + '- prilohy, jidelnicky a e-booky ke stazeni' + NL + '- postup, vyhledavani, mobil, novy design' + NL + NL +
    'Tvuj pristup je uz aktivni - nic neplatis znovu. Prihlaseni:' + NL +
    '1) Otevri: ' + btn + NL +
    '2) Dej Vytvorit ucet a vymysli si heslo (e-mail je predvyplneny).' + NL +
    '3) Prihlas se stejnym e-mailem a heslem - a jsi uvnitr.' + NL + NL +
    'Navod krok za krokem: ' + NAVOD_URL + NL + NL +
    'P.S. Chces jit do hloubky? Barna Academy: ' + ACADEMY_URL + NL + NL +
    '----------------------------------------' + NL +
    'Tento e-mail ti prisel, protoze mas zakoupeny videokurz vyzivy.' + NL +
    'Odhlasit se: ' + unsub + NL + 'Martin Barna · martinbarna.cz';

  return { subject, html, text, unsub };
}

async function sendViaResend(to: string, subject: string, html: string, text: string, unsub: string): Promise<string> {
  if (!RESEND_KEY) throw new Error('missing_RESEND_API_KEY');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM, to: [to], subject, html, text, reply_to: REPLY_TO,
      headers: { 'List-Unsubscribe': '<' + unsub + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    }),
  });
  const b = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('resend_' + res.status + ':' + JSON.stringify(b));
  return (b as { id?: string }).id ?? '';
}

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

const variantOf = (tags: string[] | null) => (tags || []).indexOf('early-customer') >= 0 ? 'early' : 'manual';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: cfg } = await admin.from('app_config').select('value').eq('key', 'drip_invoke_secret').maybeSingle();
  const expected = cfg?.value ?? '';
  const provided = req.headers.get('x-drip-secret') || '';   // jen hlavicka; ?secret= by koncil v lozich
  if (!expected || provided !== expected) return json({ error: 'unauthorized' }, 401);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nowIso = new Date().toISOString();

  if (typeof body.test_email === 'string' && body.test_email.includes('@')) {
    const variant = body.variant === 'manual' ? 'manual' : 'early';
    const m = buildEmail(variant, String(body.test_email), String(body.name ?? ''), 'test-no-op');
    try {
      const id = await sendViaResend(String(body.test_email), '[TEST] ' + m.subject, m.html, m.text, m.unsub);
      return json({ ok: true, mode: 'test', variant, provider_id: id });
    } catch (e) {
      return json({ ok: false, mode: 'test', error: String(e) }, 500);
    }
  }

  const { data: pend } = await admin.from('customer_contacts')
    .select('email,tags').eq('status', 'active').is('onboarding_sent_at', null);
  if (body.dry === true) {
    const rows = pend ?? [];
    let early = 0, manual = 0;
    for (const r of rows) (variantOf(r.tags as string[]) === 'early' ? early++ : manual++);
    return json({ ok: true, mode: 'dry', pending_total: rows.length, early, manual });
  }

  if (body.live !== true) return json({ error: 'set live:true to send, or use dry/test_email' }, 400);
  const limit = Number(body.limit ?? 500);
  const { data: rows } = await admin.from('customer_contacts')
    .select('email,name,tags,unsubscribe_token').eq('status', 'active').is('onboarding_sent_at', null).limit(limit);
  const list = rows ?? [];
  let sent = 0, errors = 0;
  const errSample: string[] = [];
  for (const r of list) {
    const variant = variantOf(r.tags as string[]);
    const m = buildEmail(variant, String(r.email), String(r.name ?? ''), String(r.unsubscribe_token));
    try {
      const id = await sendViaResend(String(r.email), m.subject, m.html, m.text, m.unsub);
      await admin.from('customer_contacts').update({ onboarding_sent_at: nowIso, last_emailed_at: nowIso, updated_at: nowIso }).eq('email', r.email);
      await admin.from('email_events').insert({ lead_id: null, step: 0, type: 'onboarding', provider_id: id, detail: { variant, table: 'customer_contacts' } });
      sent++;
    } catch (e) {
      errors++;
      if (errSample.length < 5) errSample.push(String(e).slice(0, 200));
      await admin.from('email_events').insert({ lead_id: null, step: 0, type: 'onboarding_error', detail: { variant, error: String(e).slice(0, 300) } });
    }
  }
  return json({ ok: true, mode: 'live', attempted: list.length, sent, errors, error_sample: errSample });
});
