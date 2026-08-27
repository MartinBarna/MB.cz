// Barna Academy - mail-klik: VLASTNI mereni prokliku z mailu + presmerovani na cil.
// Deploy: supabase functions deploy mail-klik --no-verify-jwt (musi byt verejne, klika na to
// clovek z posty, zadny Authorization header neposle).
//
// ⛔⛔ TOHLE NENI RESEND TRACKING. Ten je od 27. 7. 2026 vypnuty a Martin 28. 7. rozhodl,
//     ze se nevraci (`mb-resend-tracking-domena-400`). Nejhorsi vlastnost te poruchy byla,
//     ze eventy chodily dal, ale lidi koncili na 400 -> vypadalo to jako zajem, a pritom
//     se nikdo na cil nedostal. Cely tenhle soubor je proto postaveny tak, aby
//     ⭐ CLOVEK SKONCIL VZDYCKY NA NEJAKE ROZUMNE STRANCE, i kdyz mereni selze. ⭐
//
// ⛔ OTEVRENY REDIRECT TU VZNIKNOUT NESMI. Dve nezavisle vrstvy:
//    1. cil je soucasti PODEPSANE (HMAC) navesti, takze ho nikdo cizi nepodvrhne,
//    2. i s platnym podpisem se presmerovava jen na POVOLENE hostitele (nize).
//    Kdyz podpis nesedi, presmerovava se jen na nase vlastni dva weby, nikdy na Stripe:
//    podvrzeny platebni odkaz je to jedine, cim by se tenhle endpoint dal zneuzit.
//
// Zapisuje udalost `px_click` do `email_events`. ⛔ NIKDY typ `click`: ten uz v tabulce je
// (73 radku z 22. az 27. 7. 2026) a jsou to data z rozbiteho okna.
//
// ⚠️ DEDUP SE TU SCHVALNE NEDELA. Salva prokliku ve zlomku vteriny je hlavni znak
//    bezpecnostniho skeneru (24. 7. 2026: jeden "lead" trefil objednavku i odhlaseni behem
//    deseti vterin, jiny dvakrat tutez adresu 13 ms po sobe). Kdyby se to slucovalo uz pri
//    zapisu, ten obrazec z dat zmizi a skener uz nepoznas. Filtruje se az pri CTENI,
//    viz akce `mail_mereni` v `admin-api`.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET = Deno.env.get('MAIL_TRACK_SECRET') ?? '';

// Kam se vubec smi presmerovat. ⛔ Pridani hostitele je bezpecnostni rozhodnuti, ne kosmetika.
const POVOLENI_HOSTE = ['martinbarna.cz', 'www.martinbarna.cz', 'tvujcoach.cz', 'www.tvujcoach.cz', 'buy.stripe.com'];
// Nase vlastni weby: sem se smi i pri chybnem podpisu (skodit se tim neda) a jen sem se
// dolepuji UTM znacky. Na Stripe UTM nepatri, ten si query hlida sam.
const NASE_WEBY = ['martinbarna.cz', 'www.martinbarna.cz', 'tvujcoach.cz', 'www.tvujcoach.cz'];
const NOUZOVY_CIL = 'https://martinbarna.cz/';

const b64urlToText = (s: string): string => {
  const b64 = s.split('-').join('+').split('_').join('/');
  const pad = b64 + '==='.slice((b64.length + 3) % 4);
  const bin = atob(pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
};
const bytesToB64url = (b: Uint8Array): string => {
  let bin = '';
  for (const x of b) bin += String.fromCharCode(x);
  return btoa(bin).split('+').join('-').split('/').join('_').split('=').join('');
};
async function podpisProText(text: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return bytesToB64url(new Uint8Array(sig)).slice(0, 27);
}
function stejnyPodpis(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let rozdil = 0;
  for (let i = 0; i < a.length; i++) rozdil |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return rozdil === 0;
}
function stitekKlienta(ua: string): string {
  const u = ua.toLowerCase();
  if (u.includes('googleimageproxy')) return 'google-proxy';
  if (u.includes('yahoomailproxy')) return 'yahoo';
  if (u.includes('outlook') || u.includes('microsoft')) return 'outlook';
  if (u.includes('proxy') || u.includes('bot') || u.includes('crawler') || u.includes('spider')) return 'jiny-stroj';
  return 'jiny';
}

const presmeruj = (kam: string) =>
  new Response(null, { status: 302, headers: { Location: kam, 'Cache-Control': 'no-store' } });

// Vrati bezpecny cil, nebo null. `duveryhodny` = podpis sedel.
function bezpecnyCil(raw: string, duveryhodny: boolean, track: string, key: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;   // http ani mailto/javascript nikdy
  const host = u.hostname.toLowerCase();
  const povoleno = duveryhodny ? POVOLENI_HOSTE : NASE_WEBY;
  if (!povoleno.includes(host)) return null;
  // UTM jen na nase weby a jen kdyz uz tam neni: sablony si nekdy nesou vlastni znacky
  // a prepsat je by znamenalo rozbit dosavadni mereni na cilove strane (`analytics.js`).
  if (NASE_WEBY.includes(host) && !u.searchParams.has('utm_source')) {
    u.searchParams.set('utm_source', 'email');
    u.searchParams.set('utm_medium', 'drip');
    if (track) u.searchParams.set('utm_campaign', track);
    if (key) u.searchParams.set('utm_content', key);
  }
  return u.toString();
}

// ⛔ NEZ SE URL ULOZI, VYHOD Z NI OSOBNI UDAJE. Nektere sablony maji v odkazu e-mail
//    prijemce (napr. `/akademie/prihlaseni/?tab=up&email=...`, aby se formular predvyplnil).
//    Do `email_events` patri, NA CO clovek klikl, ne KDO to je; toho nese `lead_id`.
//    Presmerovani samo dostane adresu nedotcenou, jinak by se predvyplneni rozbilo.
function urlProLog(raw: string): string {
  try {
    const u = new URL(raw);
    for (const [k, v] of [...u.searchParams.entries()]) {
      if (k.toLowerCase() === 'email' || k.toLowerCase() === 'mail' || v.includes('@')) {
        u.searchParams.set(k, '(skryto)');
      }
    }
    return u.toString().slice(0, 500);
  } catch {
    return raw.slice(0, 200);
  }
}

interface Stopa { tr?: string; st?: number; kl?: string; ld?: string | null; url?: string }

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return presmeruj(NOUZOVY_CIL);
  let cil = NOUZOVY_CIL;
  try {
    const url = new URL(req.url);
    const p = url.searchParams.get('p') ?? '';
    const s = url.searchParams.get('s') ?? '';
    if (!p) return presmeruj(NOUZOVY_CIL);

    const data = JSON.parse(b64urlToText(p)) as Stopa;
    const track = String(data.tr ?? '');
    const key = String(data.kl ?? '');
    const step = Number.isFinite(Number(data.st)) ? Number(data.st) : null;
    const lead = data.ld ? String(data.ld) : null;

    const podpisOk = !!SECRET && !!s && stejnyPodpis(await podpisProText(p), s);
    cil = bezpecnyCil(String(data.url ?? ''), podpisOk, track, key) ?? NOUZOVY_CIL;

    // HEAD si posilaji nektere brany pred otevrenim odkazu; presmeruj, ale nezapisuj.
    if (req.method === 'HEAD') return presmeruj(cil);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    // ⚠️ `url` se uklada ZAMERNE: bez ni nesel odlisit klik na nabidku od kliku na odhlaseni
    //    a prave tim se 25. 7. 2026 poznal skener. IP ani user-agent se neukladaji.
    const { error } = await admin.from('email_events').insert({
      lead_id: lead,
      step,
      type: 'px_click',
      detail: {
        track,
        key,
        url: urlProLog(String(data.url ?? '')),
        klient: stitekKlienta(req.headers.get('user-agent') ?? ''),
        podpis: podpisOk ? 'ok' : 'chybny',
      },
    });
    if (error) console.error('[mail-klik] zapis selhal: ' + error.message);
  } catch (e) {
    // ⛔ Jakakoli vyjimka NESMI skoncit chybovou strankou. Radeji nezmereny proklik
    //    nez clovek, ktery narazi do zdi (to uz se jednou stalo, pet dni, a nikde to nekriklo).
    console.error('[mail-klik] vyjimka: ' + String(e).slice(0, 200));
  }
  return presmeruj(cil);
});
