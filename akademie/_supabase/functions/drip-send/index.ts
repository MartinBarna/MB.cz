// Barna Academy - drip-send (email nurture / DRIP engine). Deno, deploy --no-verify-jwt.
// Copy zije v DB (email_templates + app_config footer_*), aby sla menit bez redeploye.
// Gender tokeny v copy: [[zena||muz]], [a] a [á]. Merge: dvojite-slozene-zavorky key. Viz README.md.
// Rezimy POST JSON: dry:true | test_email+track+step+segment+name | prazdne (ostry beh).
// Auth: hlavicka x-drip-secret == app_config drip_invoke_secret. Klice jen z env.
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
const FREE_LESSONS_URL = 'https://martinbarna.cz/videokurz?utm_source=email&utm_medium=drip#zdarma';
const COURSE_PRICE = 800;
const DISCOUNT_CODE = 'ZACNI15';
const DISCOUNT_PCT = 15;
// druha (posledni) sleva - drzet v sablonach pres {{discount2_*}}, ne natvrdo
const DISCOUNT2_CODE = 'JESTE20';
const DISCOUNT2_PCT = 20;

type Seg = 'zeny' | 'muzi' | 'other';
const isFem = (seg: Seg) => seg === 'zeny';

// 5. pad (osloveni): jen spolehliva pravidla ceske deklinace. Kdyz si nejsme jisti,
// jmeno nechavame v 1. padu (= dosavadni chovani, nikdy nezhorsime). Zenska a
// segmentove nejista jmena koncici souhlaskou se NEmeni (Dagmar, Ester, Miriam...).
const VOK_EXC: Record<string, string> = {
  'jan': 'Jene', 'pavel': 'Pavle', 'karel': 'Karle', 'havel': 'Havle', 'pavol': 'Pavle',
  'zdenek': 'Zdenku', 'zdeněk': 'Zdeňku', 'zbynek': 'Zbynku', 'zbyněk': 'Zbyňku',
  'josef': 'Josefe', 'luboš': 'Luboši', 'lubos': 'Luboši', 'bartoloměj': 'Bartoloměji',
  'vavřinec': 'Vavřinče', 'vavrinec': 'Vavrinče', 'němec': 'Němče',
};
// bezna ceska/slovenska muzska jmena na SOUHLASKU -> sklonuj i bez segmentu 'muzi'
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
// zenska jmena na SOUHLASKU, ktera se nemeni -> NIKDY nesklonovat (i kdyby na 'muzi' seznamu)
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
  if (last === 'a') return fn.slice(0, -1) + 'o';                        // Jana->Jano, Honza->Honzo (oba rody)
  if (VOK_VOWELS.includes(last)) return fn;                              // Lucie, Marie, Ivo, Jiri
  if (FEMALE_NAMES.has(low)) return fn;                                  // pojistka: zenske jmeno na souhlasku
  if (seg === 'zeny' && !isMaleName(low)) return fn;                     // zensky seznam + nezname jmeno -> nechat; jinak sklonuj mužsky (kryje i nezname muzske jmeno)
  if (low in VOK_EXC) return VOK_EXC[low];
  if (low.endsWith('ek')) return fn.slice(0, -2) + 'ku';                 // Marek->Marku, Radek->Radku
  if (low.endsWith('ch') || 'kgh'.includes(last)) return fn + 'u';       // Vojtech->Vojtechu, Patrik->Patriku
  if ('szxj'.includes(last) || 'šžčř'.includes(last)) return fn + 'i';   // Tomas->Tomasi, Ondrej->Ondreji, Řehoř->Řehoři
  if (low.endsWith('el')) return fn + 'i';                               // Daniel->Danieli, Marcel->Marceli
  if (last === 'r') {
    return VOK_VOWELS.includes(low.slice(-2, -1)) ? fn + 'e' : fn.slice(0, -1) + 'ře';  // Otakar->Otakare, Petr->Petře
  }
  if ('bdflmnptvw'.includes(last)) return fn + 'e';                      // Martin->Martine, David->Davide
  return fn;                                                             // cokoliv jineho radsi nechat
}

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
  // [á] = rad[á]/rád ap. (dlouhe pripony) — order-rescue ho uz podporuje, drz v synci
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
// pojistka: zadny nerozreseny token (vc. [á]) nesmi nikdy odejit v tele mailu
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
  | { t: 'ps'; html: string };

function renderHtml(blocks: Block[], seg: Seg, v: Record<string, string>): string {
  return blocks.map((b) => {
    if (b.t === 'p') return `<p style='margin:0 0 14px'>${fill(b.html, seg, v)}</p>`;
    if (b.t === 'ps') return `<p style='margin:16px 0 0;color:#A09AAD;font-style:italic'>${fill(b.html, seg, v)}</p>`;
    if (b.t === 'bullets')
      return `<ul style='margin:0 0 14px;padding-left:20px'>` +
        b.items.map((li) => `<li style='margin:0 0 7px'>${fill(li, seg, v)}</li>`).join('') + `</ul>`;
    return `<p style='margin:4px 0 18px'><a href='${fill(b.href, seg, v)}' style='display:inline-block;background:#EBB12C;color:#1A1222;text-decoration:none;padding:13px 26px;border-radius:0;font-weight:700;text-transform:uppercase;letter-spacing:.05em;font-size:15px'>${esc(fill(b.text, seg, v))}</a></p>`;
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
  // Tabulkovy layout + bgcolor = tmava karta drzi i v Outlooku (div-background Outlook ignoruje).
  return `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='color-scheme' content='dark'><meta name='supported-color-schemes' content='dark'></head>` +
    `<body style='margin:0;padding:0;background:#0C0B10'>` +
    `<span style='display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden'>${esc(preheader)}</span>` +
    `<table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0' bgcolor='#0C0B10' style='background:#0C0B10'><tr><td align='center' style='padding:16px'>` +
    `<table role='presentation' width='560' cellpadding='0' cellspacing='0' border='0' bgcolor='#181520' style='width:100%;max-width:560px;background:#181520;border-radius:2px;border:1px solid #262232'><tr><td style='padding:28px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#F0EADF'>` +
    `<div style='border-left:3px solid #EBB12C;padding-left:10px;font-weight:800;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#EBB12C;margin:0 0 20px'>Martin Barna</div>` +
    body +
    `<hr style='border:none;border-top:1px solid #262232;margin:22px 0 14px'>` +
    `<div style='font-size:12px;line-height:1.5;color:#8F8A99'>${footerHtml}</div>` +
    `</td></tr></table></td></tr></table></body></html>`;
}

function buildVars(name: string, seg: Seg, unsub: string, email: string): Record<string, string> {
  // jmeno leada je user input: pryc s HTML a tokenovymi znaky, at nerozbije render ani markup
  const BADCH = '{}[]<>&' + DQ + String.fromCharCode(39);
  let clean = '';
  for (const ch of (name || '')) clean += BADCH.includes(ch) ? ' ' : ch;
  const parts = clean.trim().split(' ').filter((x) => x.length > 0);
  const t = parts[0] || '';
  // osloveni v 5. padu (vokativ) — konzervativne, nejista jmena zustavaji v 1. padu
  const fn = vokativ(t ? t.charAt(0).toUpperCase() + t.slice(1) : '', seg);
  const dprice = Math.round(COURSE_PRICE * (1 - DISCOUNT_PCT / 100));
  const d2price = Math.round(COURSE_PRICE * (1 - DISCOUNT2_PCT / 100));
  return {
    first_name: fn, fn_space: fn ? ' ' + fn : '', fn_suffix: fn ? ', ' + fn : '', fn_prefix: fn ? fn + ', ' : '',
    lead_magnet_url: seg === 'muzi' ? SITE + '/download/forma-zpet-muzi.pdf' : SITE + '/download/makro-plan-zeny.pdf',
    plan_page_url: seg === 'muzi' ? SITE + '/forma-zpet' : SITE + '/makro-plan',
    course_url: COURSE_URL, free_lessons_url: FREE_LESSONS_URL,
    course_price: String(COURSE_PRICE), discount_pct: String(DISCOUNT_PCT),
    discount_price: String(dprice), discount_code: DISCOUNT_CODE,
    discount2_pct: String(DISCOUNT2_PCT), discount2_price: String(d2price), discount2_code: DISCOUNT2_CODE,
    email: email, email_url: encodeURIComponent(email),
    unsubscribe_url: unsub,
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
  const provided = req.headers.get('x-drip-secret') || '';   // jen hlavicka; ?secret= by koncil v lozich
  if (!expected || provided !== expected) return json({ error: 'unauthorized' }, 401);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nowIso = new Date().toISOString();

  const { data: fRows } = await admin.from('app_config').select('key,value').in('key', ['footer_html', 'footer_text', 'reply_to_email', 'archive_bcc', 'followups_enabled', 'drip_daily_cap']);
  const fMap = Object.fromEntries((fRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  const footer = { html: fMap.footer_html ?? '', text: fMap.footer_text ?? '' };
  const replyTo = fMap.reply_to_email ?? '';   // kam chodi odpovedi (ulozeno v app_config, ne v gitu)
  const archiveBcc = fMap.archive_bcc ?? '';   // skryta kopie vsech ostrych sendu na Martinuv mail (prazdne = vypnuto)
  // BRANA: follow-up/transakcni tracky (non-onboarding) se posilaji jen kdyz je followups_enabled='true'.
  // Absence/jina hodnota = drzet (test-first). Prepnuti ostro = 1 SQL update, bez redeploye.
  const followupsEnabled = (fMap.followups_enabled ?? '') === 'true';
  // DENNI STROP: pojistka proti runaway odesilani (bug/flood), ne Resend Free limit —
  // provoz jede na Resend Pro (50k/mes). 500/den necha rezervu pro transakcni maily
  // (rescue/milniky/digest) a Auth SMTP. Cti z app_config drip_daily_cap (zmena = 1 SQL
  // update bez redeploye); fallback 500. POZN: app_config drzi 2000 = fakticky vypnuto,
  // snizeni na 500 je v security-fixes-2026-07.sql (ceka na schvaleni Martinem).
  const DAILY_CAP = Math.max(1, Number(fMap.drip_daily_cap ?? '') || 500);

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
      const v = buildVars(String(body.name ?? ''), seg, SUPABASE_URL + '/functions/v1/unsubscribe?token=test-no-op', String(body.test_email));
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
  const FIELDS = 'id,email,name,segment,track,step,unsubscribe_token,next_send_at';
  const dueBase = () => admin.from('leads').select(FIELDS)
    .eq('status', 'active').not('next_send_at', 'is', null).lte('next_send_at', nowIso)
    .order('next_send_at', { ascending: true }).limit(limit);
  // deno-lint-ignore no-explicit-any
  let leads: any[] = [];
  let poolInfo: Record<string, number> = {};
  if (onlyEmail) {
    const { data: due, error: dueErr } = await dueBase().eq('email', onlyEmail);
    if (dueErr) return json({ error: 'db_due', detail: dueErr.message }, 500);
    leads = due ?? [];
  } else {
    // PRIORITA: follow-up/transakcni tracky (non-onboarding) PRED onboarding bulkem, aby je bulk
    // nehladovel pod dennim stropem. Follow-upy jdou jen kdyz je otevrena BRANA (followupsEnabled).
    const { data: onb, error: e1 } = await dueBase().ilike('track', 'onboarding%');
    if (e1) return json({ error: 'db_due', detail: e1.message }, 500);
    let nonOnb: any[] = [];   // deno-lint-ignore no-explicit-any
    if (followupsEnabled) {
      const { data: no, error: e2 } = await dueBase().not('track', 'ilike', 'onboarding%');
      if (e2) return json({ error: 'db_due', detail: e2.message }, 500);
      nonOnb = no ?? [];
    }
    // CERSTVE splatne onboarding kroky (48 h) pred starym backlogem: follow-upy novych leadu
    // (z kampani) odchazeji vcas i behem doposilani fronty; zbytek denniho stropu dobira
    // backlog od nejstarsiho. Bez toho by novy krok cekal za celou frontou.
    const freshCut = Date.now() - 2 * 86400000;
    const onbAll = onb ?? [];
    const freshOnb = onbAll.filter((l: { next_send_at: string }) => new Date(String(l.next_send_at)).getTime() >= freshCut);
    const staleOnb = onbAll.filter((l: { next_send_at: string }) => new Date(String(l.next_send_at)).getTime() < freshCut);
    poolInfo = { followups: nonOnb.length, fresh_onboarding: freshOnb.length, backlog_onboarding: staleOnb.length };
    leads = [...nonOnb, ...freshOnb, ...staleOnb];
  }

  // STOP-PO-NAKUPU (per track): prodejni track se stopne, kdyz prijemce UZ vlastni produkt,
  // ktery mu track prodava (entitlements, active):
  //  - akvizicni (lead-magnet*, existing-leadmagnet, nurture-*) a longtail-consumer prodavaji
  //    vstup ne-majitelum -> stop pri JAKEMKOLI nakupu (videokurz/academy/coaching);
  //    u akvizicnich je krok 0 slibeny freebie (PDF plan) -> posli vzdy, stop az od kroku 1
  //  - longtail-trener a upsell-academy prodavaji Academy -> stop pri academy
  //  - upsell-coaching prodava koucink -> stop pri coaching
  //  - longtail-kupci = pece o kupce videokurzu + upgrade na Academy -> stop pri academy
  // Clenske tracky (onboarding, milestone, reactivation, rescue) cili na zakazniky -> nikdy nestopovat.
  const { data: buyersRows } = await admin.from('entitlements').select('email,product').eq('active', true).in('product', ['videokurz', 'academy', 'coaching']);
  const owns: Record<string, Set<string>> = { videokurz: new Set(), academy: new Set(), coaching: new Set() };
  for (const b of (buyersRows ?? []) as { email: string; product: string }[]) owns[b.product]?.add(b.email.toLowerCase());
  const ownsAny = (em: string) => owns.videokurz.has(em) || owns.academy.has(em) || owns.coaching.has(em);
  const shouldStop = (track: string, step: number, em: string): boolean => {
    const t = String(track || '');
    if (['lead-magnet', 'existing-leadmagnet', 'nurture-'].some((p) => t.indexOf(p) === 0)) return step > 0 && ownsAny(em);
    if (t === 'longtail-consumer') return ownsAny(em);
    if (t === 'longtail-trener' || t === 'upsell-academy' || t === 'longtail-kupci') return owns.academy.has(em);
    if (t === 'upsell-coaching') return owns.coaching.has(em);
    return false;
  };

  // DRY
  if (body.dry === true) {
    const byStep: Record<string, number> = {};
    let would = 0, bought = 0, invalid = 0;
    for (const l of leads) {
      // STOP po nakupu = per-track pravidla (viz shouldStop vyse)
      if (shouldStop(String(l.track || ''), l.step, String(l.email).toLowerCase())) { bought++; continue; }
      const tpl = await getTpl(l.track, l.step);
      if (!tpl) { invalid++; continue; }
      const key = l.track + '/step' + l.step + ':' + tpl.key;
      byStep[key] = (byStep[key] ?? 0) + 1; would++;
    }
    return json({ ok: true, mode: 'dry', followups_enabled: followupsEnabled, daily_cap: DAILY_CAP, pools: poolInfo, due: leads.length, would_send: would, skip_bought: bought, invalid_track_step: invalid, by_step: byStep });
  }

  const dayStart = new Date(nowIso); dayStart.setUTCHours(0, 0, 0, 0);
  const { count: sentToday } = await admin.from('email_events')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'sent').gte('created_at', dayStart.toISOString());
  const remaining = onlyEmail ? Number.MAX_SAFE_INTEGER : Math.max(0, DAILY_CAP - (sentToday ?? 0));

  // LIVE
  let sent = 0, skippedAlready = 0, errors = 0, finished = 0, stopped = 0, capped = false;
  const byStep: Record<string, number> = {};
  for (const l of leads) {
    if (sent >= remaining) { capped = true; break; }
    const seg = normSeg(l.segment);
    const tpl = await getTpl(l.track, l.step);
    if (!tpl) { await admin.from('leads').update({ next_send_at: null, updated_at: nowIso }).eq('id', l.id); finished++; continue; }
    // STOP po nakupu = per-track pravidla (viz shouldStop vyse)
    if (shouldStop(String(l.track || ''), l.step, String(l.email).toLowerCase())) {
      await admin.from('leads').update({ status: 'purchased', next_send_at: null, updated_at: nowIso }).eq('id', l.id);
      await admin.from('email_events').insert({ lead_id: l.id, step: l.step, type: 'skip_purchased', detail: { track: l.track } });
      stopped++; continue;
    }
    const { data: already } = await admin.from('email_events')
      .select('id').eq('lead_id', l.id).eq('step', l.step).eq('type', 'sent')
      .eq('detail->>track', l.track).maybeSingle();   // dedupe per track (pri prerazeni leadu jinam se kroky nepreskakuji)
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
      const v = buildVars(String(l.name ?? ''), seg, SUPABASE_URL + '/functions/v1/unsubscribe?token=' + l.unsubscribe_token, String(l.email));
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
  return json({ ok: true, mode: 'live', followups_enabled: followupsEnabled, due: leads.length, sent, daily_cap: DAILY_CAP, pools: poolInfo, sent_today_before: sentToday ?? 0, remaining_today: remaining, capped, skipped_already: skippedAlready, stopped_bought: stopped, finished, errors, by_step: byStep });
});
