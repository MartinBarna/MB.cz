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
// HTML atributy jsou v tomhle souboru v JEDNODUCHYCH uvozovkach (soubor zamerne neobsahuje znak ").
// esc() apostrof neresi, takze do atributu se musi escapovat navic, jinak by text z nej vyskocil.
const SQ = String.fromCharCode(39);   // single-quote char
const attr = (s: string) => esc(s).split(SQ).join('&#39;');

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
  | { t: 'ps'; html: string }
  | { t: 'img'; src: string; alt: string };

function renderHtml(blocks: Block[], seg: Seg, v: Record<string, string>): string {
  return blocks.map((b) => {
    if (b.t === 'p') return `<p style='margin:0 0 14px'>${fill(b.html, seg, v)}</p>`;
    if (b.t === 'ps') return `<p class='mb-ps' style='margin:16px 0 0;color:#A09AAD;font-style:italic'>${fill(b.html, seg, v)}</p>`;
    if (b.t === 'bullets')
      return `<ul style='margin:0 0 14px;padding-left:20px'>` +
        b.items.map((li) => `<li style='margin:0 0 7px'>${fill(li, seg, v)}</li>`).join('') + `</ul>`;
    // Obrazek: sirka 100 % se stropem, aby na mobilu vyplnil a na desktopu nenafoukl.
    // Vsechny styly inline, mailove klienty externi CSS ignoruji.
    if (b.t === 'img')
      return `<img src='${attr(fill(b.src, seg, v))}' alt='${attr(fill(b.alt, seg, v))}' width='100%' style='max-width:480px;height:auto;display:block;margin:16px auto;border-radius:8px'>`;
    return `<p style='margin:4px 0 18px'><a class='mb-btn' href='${fill(b.href, seg, v)}' style='display:inline-block;background:#EBB12C;color:#1A1222;text-decoration:none;padding:13px 26px;border-radius:0;font-weight:700;text-transform:uppercase;letter-spacing:.05em;font-size:15px'>${esc(fill(b.text, seg, v))}</a></p>`;
  }).join(NL);
}
function renderText(blocks: Block[], seg: Seg, v: Record<string, string>): string {
  return blocks.map((b) => {
    if (b.t === 'bullets') return b.items.map((li) => '- ' + inlineToText(fill(li, seg, v))).join(NL);
    if (b.t === 'btn') return fill(b.text, seg, v) + ': ' + fill(b.href, seg, v);
    if (b.t === 'img') return '[obrázek: ' + inlineToText(fill(b.alt, seg, v)) + ']';
    return inlineToText(fill(b.html, seg, v));
  }).join(NL + NL);
}
function wrapHtml(preheader: string, body: string, footerHtml: string): string {
  // Tabulkovy layout + bgcolor = tmava karta drzi i v Outlooku (div-background Outlook ignoruje).
  // DARK-MODE FIX: color-scheme 'light dark' + <style> override. Gmail app (iOS/Android) v dark rezimu
  // prebarvoval mail (zlata #EBB12C sla do hneda, tmava karta se invertovala na svetlou) — prebarveny
  // strom oznacuje atributy [data-ogsc]/[data-ogsb], pres ktere zlate/kartu/pozadi zamykame zpet.
  // Apple Mail resi @media (prefers-color-scheme: dark). Barvy zamykame pres tridy .mb-* !important.
  // Inline styly zustavaji jako fallback pro klienty bez podpory <style> (Outlook Windows).
  return `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='color-scheme' content='light dark'><meta name='supported-color-schemes' content='light dark'>` +
    `<style>` +
    `:root{color-scheme:light dark;supported-color-schemes:light dark}` +
    `@media (prefers-color-scheme: dark){` +
    `.mb-bg{background:#0C0B10!important}` +
    `.mb-card{background:#181520!important}` +
    `.mb-body{color:#F0EADF!important}` +
    `.mb-brand{color:#EBB12C!important;border-left-color:#EBB12C!important}` +
    `.mb-btn{background:#EBB12C!important;color:#1A1222!important}` +
    `.mb-mut{color:#8F8A99!important}` +
    `.mb-ps{color:#A09AAD!important}` +
    `.mb-link{color:#F6CD63!important}` +
    `}` +
    `[data-ogsc] .mb-bg,[data-ogsb] .mb-bg{background:#0C0B10!important}` +
    `[data-ogsc] .mb-card,[data-ogsb] .mb-card{background:#181520!important}` +
    `[data-ogsc] .mb-body,[data-ogsb] .mb-body{color:#F0EADF!important}` +
    `[data-ogsc] .mb-brand,[data-ogsb] .mb-brand{color:#EBB12C!important;border-left-color:#EBB12C!important}` +
    `[data-ogsc] .mb-btn,[data-ogsb] .mb-btn{background:#EBB12C!important;color:#1A1222!important}` +
    `[data-ogsc] .mb-mut,[data-ogsb] .mb-mut{color:#8F8A99!important}` +
    `[data-ogsc] .mb-ps,[data-ogsb] .mb-ps{color:#A09AAD!important}` +
    `[data-ogsc] .mb-link,[data-ogsb] .mb-link{color:#F6CD63!important}` +
    `</style></head>` +
    `<body class='mb-bg' style='margin:0;padding:0;background:#0C0B10'>` +
    `<span style='display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden'>${esc(preheader)}</span>` +
    `<table role='presentation' class='mb-bg' width='100%' cellpadding='0' cellspacing='0' border='0' bgcolor='#0C0B10' style='background:#0C0B10'><tr><td align='center' style='padding:16px'>` +
    `<table role='presentation' class='mb-card' width='560' cellpadding='0' cellspacing='0' border='0' bgcolor='#181520' style='width:100%;max-width:560px;background:#181520;border-radius:2px;border:1px solid #262232'><tr><td class='mb-body' style='padding:28px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#F0EADF'>` +
    `<div class='mb-brand' style='border-left:3px solid #EBB12C;padding-left:10px;font-weight:800;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#EBB12C;margin:0 0 20px'>Martin Barna</div>` +
    body +
    `<hr style='border:none;border-top:1px solid #262232;margin:22px 0 14px'>` +
    `<div class='mb-mut' style='font-size:12px;line-height:1.5;color:#8F8A99'>${footerHtml}</div>` +
    `</td></tr></table></td></tr></table></body></html>`;
}

// `extra` = volitelné proměnné z těla invoku (`vars`). Slouží mailům, které nesou
// hodnoty známé až za běhu (částka refundu, název produktu…). Před tím uměl engine
// jen pevný seznam a jakákoli neznámá {{proměnná}} shodila render výjimkou
// `unresolved_token`, takže šablona vypadala hotově a mail nikdy neodešel.
//
// ⛔ BEZPEČNOSTNÍ PRAVIDLO: `extra` smí jen PŘIDÁVAT nové klíče. Vestavěné NIKDY
// nepřepíše, při kolizi vyhrává vestavěná hodnota a zaloguje se varování.
// Bez toho by chybný nebo kompromitovaný volající mohl podvrhnout `unsubscribe_url`
// a odhlašovací odkaz je právní povinnost, ne kosmetika.
function buildVars(
  name: string,
  seg: Seg,
  unsub: string,
  email: string,
  extra?: Record<string, unknown> | null,
): Record<string, string> {
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
  const vestavene: Record<string, string> = {
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

  if (!extra || typeof extra !== 'object') return vestavene;

  // Pridavame POUZE klice, ktere vestavena mapa nema. Kolize se zahazuje a loguje.
  const pridane: Record<string, string> = {};
  for (const [k, val] of Object.entries(extra)) {
    if (Object.prototype.hasOwnProperty.call(vestavene, k)) {
      console.warn('[drip-send] vars: klic "' + k + '" je vestaveny, hodnota z invoku ZAHOZENA');
      continue;
    }
    if (val === null || val === undefined) continue;
    pridane[k] = String(val);
  }
  // Poradi je zamerne: vestavene se rozbaluji POSLEDNI, takze pri jakemkoli prehlednuti
  // nahore stejne vyhraji ony. Dve pojistky na tutez vec, protoze jde o unsubscribe_url.
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

  const { data: fRows } = await admin.from('app_config').select('key,value').in('key', ['footer_html', 'footer_text', 'reply_to_email', 'archive_bcc', 'followups_enabled', 'drip_daily_cap', 'drip_send_gap_ms', 'drip_max_tries', 'drip_run_deadline_ms', 'clenske_track_prefixy', 'navazujici_trate']);
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
  // DAILY_CAP je BACKSTOP PROTI SPLASENE SMYCCE, NE SKRTIC PROPUSTNOSTI.
  // Porovnava se proti sentToday (soucet od pulnoci PRES VSECHNY BEHY, viz r. ~407),
  // takze je to DENNI strop. Nemá nic spolecneho s RUN_DEADLINE_MS, ktery reze jednu davku
  // (~166 mailu pri gap 600 ms). Jsou to DVE NEZAVISLE pojistky a nesmi se slevat dohromady:
  // 20. 7. 2026 z jejich zameny vznikl zaver "cap se stejne nikdy neprojevi", coz by vedlo
  // k jeho zruseni. Pri 24 bezich za den se denni strop projevi uz zhruba po sesti plnych davkach.
  // Hodnota: 1000 (zvednuto z 500 dne 20. 7. kvuli fronte 291 lidi a longtail enrollu 150/den).
  // Resend Pro nema denni limit, mesicni je 50 000 pri spotrebe ~4 100, spicka provozu 230/den.
  const DAILY_CAP = Math.max(1, Number(fMap.drip_daily_cap ?? '') || 500);
  // PACING: Resend dokumentuje rate limit ~2 req/s. Smycka nize posilala bez rozestupu.
  // 600 ms = ~1.7 req/s (rezerva pod limitem). Zmena = 1 SQL update app_config, bez redeploye.
  // ⚠️ POZOR NA PRICINU, at se nesiri dal: incident 30. 6. 2026 (307 chyb) NEBYL rate limit,
  // ale 'daily_quota_exceeded' na tehdejsim free tarifu. Prvnich 99 mailu proslo tempem
  // 4-5/s BEZ chyby. Rate-limit chyba se za celou historii email_events nevyskytla ani
  // jednou a engine jede 4-5/s od 1. 7. Tohle je tedy levna POJISTKA, ne oprava vady.
  // Resend je dnes Pro: denni limit zadny, mesicni 50 000 (spotreba ~4 100 k 20. 7.).
  const SEND_GAP_MS = Math.max(0, Number(fMap.drip_send_gap_ms ?? '') || 600);
  // POKUSY: kolikrat smi jeden krok jednoho leada selhat, nez ho odstavime. Bez stropu
  // se lead s trvale nedorucitelnou adresou toci po 6 h donekonecna a kazdy beh z nej
  // vyrabi error. Jistic ma od 20. 7. 2026 prah 10 chyb za den (driv 3) a po 3 h bez
  // chyby se otevira sam, takze uz jedna mrtva adresa branu neshodi. Strop pokusu ale
  // dava smysl dal: bez nej ten lead vyrabi chyby donekonecna.
  const MAX_TRIES = Math.max(1, Number(fMap.drip_max_tries ?? '') || 5);
  // CLENSKE TRACKY = cili na ZAKAZNIKY, ne na leady. Seznam drzi 1:1 s komentarem nad
  // shouldStop nize ("Clenske tracky (onboarding, milestone, reactivation, rescue) cili
  // na zakazniky -> nikdy nestopovat"). Plati pro ne stejna ochrana i u stropu pokusu:
  // nikoho z nich neodstavujeme, protoze to jsou lide, kteri zaplatili nebo prave plati.
  // rescue-* je zachrana nedokoncene objednavky, tam je tiche vzdani se nejhorsi ze vsech.
  // ⚠️ ZDROJ PRAVDY JE app_config.clenske_track_prefixy, NE tenhle soubor.
  // Driv byl seznam natvrdo tady A JESTE jednou v daily-digest, spojeny jen komentarem
  // "drz to shodne". To je prani, ne mechanismus: staci pridat track na jednom miste
  // a seznamy se tise rozejdou. Ted ho obe funkce ctou z jednoho radku v DB, takze
  // novy clensky track = jeden SQL update, bez redeploye a bez rizika rozjeti.
  // Natvrdo psany seznam nize je uz jen zachrana pro pripad, ze klic z DB zmizi.
  const CLENSKE_PREFIXY = String(fMap.clenske_track_prefixy ?? '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (CLENSKE_PREFIXY.length === 0) CLENSKE_PREFIXY.push('onboarding', 'milestone', 'reactivation', 'rescue');
  // MOSTY MEZI TRATEMI (Martin schvalil 6. 8. 2026: "pocitejme s tim obecne u mailingu").
  // PROC: kdyz trat dojede posledni mail, engine jen zhasnul next_send_at a lead tam
  // zustal lezet. Nikde to nekriklo. 6. 8. tak sedelo 53 lidi na poslednim kroku
  // lead-magnetu, zatimco longtail-consumer mel 12 hotovych mailu a DVA lidi uvnitr.
  // Zapis do longtailu se do te doby delal rucne SQL, tedy jen kdyz si nekdo vzpomnel.
  // ⛔ TOHLE JE ODCHOZI MAIL. Fail-safe je NEPRESUNOUT: kdyz klic v app_config chybi
  // nebo je rozbity, most se nepostavi a chova se to jako driv. Nikdy naopak.
  // Format: {"zdrojova-trat":{"track":"cilova-trat","po_dnech":7}}
  // Zmena = jeden SQL update app_config, bez redeploye (stejne jako clenske_track_prefixy).
  let MOSTY: Record<string, { track: string; po_dnech?: number }> = {};
  try {
    const raw = String(fMap.navazujici_trate ?? '').trim();
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) MOSTY = parsed;
    }
  } catch (e) {
    console.warn('[drip-send] navazujici_trate: nevalidni JSON, mosty VYPNUTE: ' + String(e));
    MOSTY = {};
  }
  let lastSendAt = 0;
  const pace = async () => {
    const wait = lastSendAt + SEND_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastSendAt = Date.now();
  };
  // CASOVY STROP BEHU: s pacingem trva 200 mailu pres 2 minuty a beh by mohl spadnout
  // na timeout edge funkce UPROSTRED odesilani. Radeji skoncime drive a zbytek dobere
  // dalsi hodinovy beh (leady zustavaji splatne, nic se neztrati).
  const RUN_DEADLINE_MS = Math.max(10000, Number(fMap.drip_run_deadline_ms ?? '') || 100000);
  const runStart = Date.now();

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

  // Volitelne promenne z tela invoku (`vars`). Pouzivaji je maily, ktere nesou hodnoty
  // zname az za behu (castka refundu, nazev produktu). Detail a bezpecnostni pravidlo
  // viz `buildVars`: vestavene klice se NIKDY neprepisuji.
  //
  // ⛔ POVOLENO JEN U JEDNOHO PRIJEMCE (`test_email` nebo `only_email`).
  // Pri davkovem behu by se tataz castka dosadila VSEM lidem ve fronte, coz je presne
  // ten druh tiche skody, kterou nikdo nezpozoruje, dokud nekomu neprijde cizi cislo.
  const jeJedenPrijemce = (typeof body.test_email === 'string' && body.test_email.includes('@'))
    || (typeof body.only_email === 'string' && body.only_email.includes('@'));
  let extraVars: Record<string, unknown> | null = null;
  if (body.vars && typeof body.vars === 'object') {
    if (jeJedenPrijemce) extraVars = body.vars as Record<string, unknown>;
    else console.warn('[drip-send] vars: ZAHOZENY, davkovy beh nesmi dosazovat stejne hodnoty vsem');
  }

  // TEST
  if (typeof body.test_email === 'string' && body.test_email.includes('@')) {
    const track = String(body.track ?? 'existing-leadmagnet');
    const step = Number(body.step ?? 0);
    const seg = normSeg(body.segment);
    const tpl = await getTpl(track, step);
    if (!tpl) return json({ ok: false, mode: 'test', error: 'no_template:' + track + ':' + step }, 400);
    try {
      const v = buildVars(String(body.name ?? ''), seg, SUPABASE_URL + '/functions/v1/unsubscribe?token=test-no-op', String(body.test_email), extraVars);
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
  const FIELDS = 'id,email,name,segment,track,step,unsubscribe_token,next_send_at,vars';
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
  //  - longtail-trener, trener-kit a upsell-academy prodavaji Academy -> stop pri academy
  //    (trener-kit krok 0 = slibeny kit zdarma -> posli vzdy, stop az od kroku 1)
  //  - upsell-coaching prodava koucink -> stop pri coaching
  //  - longtail-kupci = pece o kupce videokurzu + upgrade na Academy -> stop pri academy
  // Clenske tracky (onboarding, milestone, reactivation, rescue) cili na zakazniky -> nikdy nestopovat.
  // ⚠️ Expirace (28. 7. 2026, mesicni clenstvi Academy): za kupce se pocita jen ten,
  // komu clenstvi PLATI. Bez teto podminky by expirovany mesicni clen zustal navzdy
  // mezi kupci, prisel by o pristup a ZAROVEN by mu nikdy neprisla nabidka obnovy.
  // NULL = dozivotni, tedy plati porad. Detail: pamet `mb-academy-pricing-mise`.
  const { data: buyersRows } = await admin.from('entitlements').select('email,product').eq('active', true)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .in('product', ['videokurz', 'academy', 'coaching']);
  const owns: Record<string, Set<string>> = { videokurz: new Set(), academy: new Set(), coaching: new Set() };
  for (const b of (buyersRows ?? []) as { email: string; product: string }[]) owns[b.product]?.add(b.email.toLowerCase());
  const ownsAny = (em: string) => owns.videokurz.has(em) || owns.academy.has(em) || owns.coaching.has(em);
  const shouldStop = (track: string, step: number, em: string): boolean => {
    const t = String(track || '');
    if (['lead-magnet', 'existing-leadmagnet', 'nurture-'].some((p) => t.indexOf(p) === 0)) return step > 0 && ownsAny(em);
    if (t === 'longtail-consumer') return ownsAny(em);
    if (t === 'longtail-trener' || t === 'upsell-academy' || t === 'longtail-kupci') return owns.academy.has(em);
    if (t === 'trener-kit') return step > 0 && owns.academy.has(em);
    if (t === 'upsell-coaching') return owns.coaching.has(em);
    // [2026-08-06] TRATE APPKY (tc-free = registrace v appce, tc-magnet = jidelnickovy magnet).
    // Prodavaji predplatne Tvuj Coach. Kdo si koupi predplatne PRIMO v appce, prepne se pryc
    // sam (app-onboarding-hook ho hodi do onboarding-nakup-tvujcoach), takze na nej tohle
    // pravidlo neni. Diru maji ale dva pripady, ktere hook nikdy neuvidi:
    //   - kdo koupil ACADEMY, ma appku VIP na rok (pamet tvujcoach-academy-vip-na-rok),
    //   - kdo ma KOUCINK, plati Martinovi nejvyssi ticket, jaky prodavame.
    // Obema by od kroku 5 chodilo "zkusebka ti skonci / doběhla, odemkni si appku za 249",
    // coz je u prvniho lez a u druheho trapne. Kroky 0 az 4 jsou obsahove (vazeni, prumery,
    // generatory, AI kouc) a davaji smysl i jim, proto se stopuje az od kroku 5.
    if (t === 'tc-free' || t === 'tc-magnet') return step >= 5 && (owns.academy.has(em) || owns.coaching.has(em));
    return false;
  };

  // MOST NA DALSI TRAT: vola se v jedinou chvili, kdy trat pro leada skoncila.
  // Vraci nazev cilove trati (= lead byl prepsan), nebo null (= necha se dobehnout).
  // ⛔ Ctyri pojistky, kazda umi most sama zrusit. Poradi je zamerne od nejlevnejsi:
  //   1. neni definovany most -> nic (vychozi stav pro vsechny trate)
  //   2. clovek uz vlastni to, co cilova trat prodava -> nic (tataz pravidla jako shouldStop)
  //   3. cilova trat nema krok 0 -> nic (jinak bychom ho poslali do prazdna a on by ztichl
  //      uplne stejne, jen o trat vedle a hur dohledatelne)
  //   4. tuhle trat uz jednou dostal -> nic (bez toho by se dva mosty daly zacyklit
  //      a clovek by dostaval tytez maily dokola)
  // Odhlaseni a bounce resit nemusime: due fronta bere jen status='active'.
  // Rozhodovaci cast je ODDELENA od zapisu schvalne: `dry` beh ji smi zavolat taky
  // a ukazat, kam by kdo sel, aniz by cokoli prepsal. Bez toho by se most dal
  // vyzkouset jedine naostro na zivych lidech.
  // deno-lint-ignore no-explicit-any
  const kamDal = async (l: any): Promise<string | null> => {
    const cil = MOSTY[String(l.track || '')];
    if (!cil || typeof cil.track !== 'string' || !cil.track || cil.track === l.track) return null;
    const em = String(l.email).toLowerCase();
    // ⛔ ZAMERNE KROK 1, NE 0. shouldStop ma pro akvizicni trate (lead-magnet*,
    // existing-leadmagnet, nurture-*) tvar `step > 0 && ownsAny`, protoze KROK 0 je
    // slibeny freebie a ten se posila i tomu, kdo uz koupil. Pri volani s nulou by
    // ochrana kupujiciho pro tyhle trate NIKDY nesepnula (mrtva paka) a most by
    // platiciho zakaznika prehodil do akvizicni trate s nabidkou na to, co uz ma.
    // Toho, koho prehazujeme mostem, se freebie netyka: on si o nej neposlal.
    // Nasel to druhy chat pri revizi 6. 8. 2026, viz pamet feedback-nova-cesta-stare-pravidlo.
    if (shouldStop(cil.track, 1, em)) return null;
    if (!(await getTpl(cil.track, 0))) return null;
    const { data: uzTamByl } = await admin.from('email_events')
      .select('id').eq('lead_id', l.id).eq('type', 'sent').eq('detail->>track', cil.track).limit(1);
    if ((uzTamByl ?? []).length > 0) return null;
    return cil.track;
  };
  // deno-lint-ignore no-explicit-any
  const mostNaDalsiTrat = async (l: any): Promise<string | null> => {
    const cilTrack = await kamDal(l);
    if (!cilTrack) return null;
    // Odstup po poslednim mailu puvodni trate, at cloveku neprijdou dva maily po sobe.
    // ⛔ FAIL-SAFE SMEREM K CEKANI, NE K ODESLANI. `?? 7` kryje jen CHYBEJICI klic;
    // preklep (`"sedm"` misto 7) dava NaN a driv z nej `|| 0` udelalo nulu, tedy mail
    // z nove trate HNED a dva po sobe — presne to, cemu ma tenhle parametr branit.
    // Proto se nevalidni hodnota chova stejne jako chybejici: 7 dni.
    const poDnechRaw = Number(MOSTY[String(l.track || '')]?.po_dnech ?? 7);
    const poDnech = Number.isFinite(poDnechRaw) && poDnechRaw >= 0 ? poDnechRaw : 7;
    await admin.from('leads').update({
      track: cilTrack, step: 0,
      next_send_at: new Date(Date.now() + poDnech * 86400000).toISOString(),
      updated_at: nowIso,
    }).eq('id', l.id);
    // Stopa v logu: bez ni by prechod byl neviditelny a nikdo by nedohledal, proc
    // clovek dostava maily z jine trate, nez do ktere se prihlasil.
    // ⚠️ `track` v detailu je POVINNE, i kdyz je duplicitni k `z`: adminsky log sklada
    // sloupec trate i predmet z `detail->>track` a bez nej se radek zobrazi prazdny.
    await admin.from('email_events').insert({
      lead_id: l.id, step: l.step, type: 'bridged',
      detail: { track: l.track, z: l.track, na: cilTrack, po_dnech: poDnech },
    });
    return cilTrack;
  };

  // DRY
  if (body.dry === true) {
    const byStep: Record<string, number> = {};
    const byBridge: Record<string, number> = {};
    let would = 0, bought = 0, invalid = 0, wouldBridge = 0;
    for (const l of leads) {
      // STOP po nakupu = per-track pravidla (viz shouldStop vyse)
      if (shouldStop(String(l.track || ''), l.step, String(l.email).toLowerCase())) { bought++; continue; }
      const tpl = await getTpl(l.track, l.step);
      if (!tpl) {
        const na = await kamDal(l);
        if (na) { wouldBridge++; byBridge[l.track + '->' + na] = (byBridge[l.track + '->' + na] ?? 0) + 1; }
        else invalid++;
        continue;
      }
      // Posledni mail trate (wait_days = null): po jeho odeslani se rozhoduje o mostu.
      if (tpl.wait_days == null) {
        const na = await kamDal(l);
        if (na) { wouldBridge++; byBridge[l.track + '->' + na] = (byBridge[l.track + '->' + na] ?? 0) + 1; }
      }
      const key = l.track + '/step' + l.step + ':' + tpl.key;
      byStep[key] = (byStep[key] ?? 0) + 1; would++;
    }
    return json({ ok: true, mode: 'dry', followups_enabled: followupsEnabled, daily_cap: DAILY_CAP, pools: poolInfo, due: leads.length, would_send: would, skip_bought: bought, invalid_track_step: invalid, would_bridge: wouldBridge, by_bridge: byBridge, mosty: Object.keys(MOSTY), by_step: byStep });
  }

  const dayStart = new Date(nowIso); dayStart.setUTCHours(0, 0, 0, 0);
  const { count: sentToday } = await admin.from('email_events')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'sent').gte('created_at', dayStart.toISOString());
  const remaining = onlyEmail ? Number.MAX_SAFE_INTEGER : Math.max(0, DAILY_CAP - (sentToday ?? 0));

  // LIVE
  let sent = 0, skippedAlready = 0, errors = 0, finished = 0, stopped = 0, gaveUp = 0, bridged = 0, capped = false, timeUp = false;
  const byStep: Record<string, number> = {};
  const byBridge: Record<string, number> = {};
  for (const l of leads) {
    if (sent >= remaining) { capped = true; break; }
    if (Date.now() - runStart > RUN_DEADLINE_MS) { timeUp = true; break; }
    const seg = normSeg(l.segment);
    const tpl = await getTpl(l.track, l.step);
    // Krok bez sablony = trat skoncila (nebo ji nekdo zkratil). Driv se tu jen zhasl termin.
    if (!tpl) {
      const na = await mostNaDalsiTrat(l);
      if (na) { bridged++; byBridge[l.track + '->' + na] = (byBridge[l.track + '->' + na] ?? 0) + 1; continue; }
      await admin.from('leads').update({ next_send_at: null, updated_at: nowIso }).eq('id', l.id); finished++; continue;
    }
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
        // wait_days = null znamena POSLEDNI mail trate. Tady se rozhoduje, jestli
        // clovek pokracuje jinam, nebo definitivne ztichne. Viz MOSTY vyse.
        // ⛔ TEN `return` JE NOSNY, NESMAZAT. Most uz leada prepsal na cilovou trat
        // a krok 0. Kdyby se pokracovalo dal, update nize by mu nastavil step = 8
        // (dalsi krok PUVODNI trate) nad uz prepsanym leadem a clovek by v nove trati
        // preskocil osm mailu z dvanacti. Track by se neprepsal, ale krok ano.
        const na = await mostNaDalsiTrat(l);
        if (na) { bridged++; byBridge[l.track + '->' + na] = (byBridge[l.track + '->' + na] ?? 0) + 1; return; }
        await admin.from('leads').update({ step: ns, next_send_at: null, updated_at: nowIso }).eq('id', l.id); finished++;
      } else {
        const next = new Date(Date.now() + tpl.wait_days * 86400000).toISOString();
        await admin.from('leads').update({ step: ns, next_send_at: next, updated_at: nowIso }).eq('id', l.id);
      }
    };
    if (already) { await advance(); skippedAlready++; continue; }
    try {
      // ZALOHA PRO OPAKOVANY POKUS: `vars` z tela invoku existuji jen jednou. Kdyz odeslani
      // selze, dalsi pokus jede z hodinove davky, ktera zadne telo nema — a mail by spadl
      // na `unresolved_token` uz navzdy (viz leads-vars.sql). Proto se ctou i z leada.
      // ⛔ Vyhradne `l.vars[l.track]`, nikdy plosne: zaznam patrici jine trati nesmi
      // prosaknout do mailu, ktery si nahodou pojmenoval promennou stejne.
      const varsZLeada = (l.vars && typeof l.vars === 'object' && !Array.isArray(l.vars))
        ? (l.vars as Record<string, unknown>)[String(l.track)] as Record<string, unknown> | undefined
        : undefined;
      const v = buildVars(String(l.name ?? ''), seg, SUPABASE_URL + '/functions/v1/unsubscribe?token=' + l.unsubscribe_token, String(l.email), extraVars ?? varsZLeada ?? null);
      const m = renderEmail(tpl, seg, v, footer);
      await pace();   // rozestup mezi volanimi Resendu, viz SEND_GAP_MS vyse
      const id = await sendViaResend(l.email, m.subject, m.html, m.text, v.unsubscribe_url, replyTo, archiveBcc);
      const { error: logErr } = await admin.from('email_events')
        .insert({ lead_id: l.id, step: l.step, type: 'sent', provider_id: id, detail: { track: l.track, key: tpl.key } });
      if (logErr && !String(logErr.code).includes('23505')) throw new Error('log:' + logErr.message);
      await advance(); sent++;
      const k = l.track + '/step' + l.step + ':' + tpl.key; byStep[k] = (byStep[k] ?? 0) + 1;
    } catch (e) {
      errors++;
      await admin.from('email_events').insert({ lead_id: l.id, step: l.step, type: 'error', detail: { track: l.track, error: String(e).slice(0, 400) } });
      // STROP POKUSU: kolikrat uz tenhle lead na tomhle kroku a tracku selhal (vc. teto chyby).
      // Po MAX_TRIES ho odstavime na status='paused' + next_send_at=null. 'paused' je v CHECK
      // constraintu leads_status_check povoleny a enroll_* funkce ho spravne neseberou
      // (hledaji status='active'). Bez tohohle se lead s mrtvou adresou toci navzdy
      // a trvale vyrabi errory, ktere shodi jistic vsem ostatnim.
      const { count: failCount } = await admin.from('email_events')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', l.id).eq('step', l.step).eq('type', 'error').eq('detail->>track', l.track);
      // ⚠️ CLENSKE TRACKY SE NEVZDAVAJI NIKDY (viz CLENSKE_PREFIXY vyse). U follow-upu je
      // odstaveni spravne, ale tyhle maily dostava clovek, ktery PRAVE ZAPLATIL nebo se
      // o to prave pokousi. Tise ho odstavit znamena, ze nikdy nedostane pristup, za ktery
      // zaplatil, a nikdo se to nedozvi. Radeji zkousime dal po 6 h donekonecna.
      // Bezpecne to je proto, ze jistic onboarding ignoruje (filtr not ilike 'onboarding%'),
      // takze tyhle opakovane chyby nikomu jinemu branu neshodi.
      // Aby to nebylo tiche, po MAX_TRIES se JEDNOU zaloguje 'gave_up_warn' a denni digest
      // z toho udela alert. Retry ale bezi dal.
      const jeClensky = CLENSKE_PREFIXY.some((p) => String(l.track || '').startsWith(p));
      if (jeClensky && (failCount ?? 0) >= MAX_TRIES) {
        if ((failCount ?? 0) === MAX_TRIES) {
          await admin.from('email_events').insert({ lead_id: l.id, step: l.step, type: 'gave_up_warn', detail: { track: l.track, tries: failCount ?? 0 } });
        }
        const retry = new Date(Date.now() + 6 * 3600000).toISOString();
        await admin.from('leads').update({ next_send_at: retry, updated_at: nowIso }).eq('id', l.id);
      } else if ((failCount ?? 0) >= MAX_TRIES) {
        await admin.from('leads').update({ status: 'paused', next_send_at: null, updated_at: nowIso }).eq('id', l.id);
        await admin.from('email_events').insert({ lead_id: l.id, step: l.step, type: 'gave_up', detail: { track: l.track, tries: failCount ?? 0 } });
        gaveUp++;
      } else {
        const retry = new Date(Date.now() + 6 * 3600000).toISOString();
        await admin.from('leads').update({ next_send_at: retry, updated_at: nowIso }).eq('id', l.id);
      }
    }
  }
  return json({ ok: true, mode: 'live', followups_enabled: followupsEnabled, due: leads.length, sent, daily_cap: DAILY_CAP, send_gap_ms: SEND_GAP_MS, max_tries: MAX_TRIES, pools: poolInfo, sent_today_before: sentToday ?? 0, remaining_today: remaining, capped, time_up: timeUp, skipped_already: skippedAlready, stopped_bought: stopped, finished, errors, gave_up: gaveUp, bridged, by_bridge: byBridge, mosty: Object.keys(MOSTY), by_step: byStep });
});
