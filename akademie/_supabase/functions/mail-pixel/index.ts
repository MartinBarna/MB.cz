// Barna Academy - mail-pixel: VLASTNI mereni otevreni mailu (1x1 GIF).
// Deploy: supabase functions deploy mail-pixel --no-verify-jwt (musi byt verejne, tahaji to
// postovni servery prijemcu, zadny Authorization header neposlou).
//
// ⛔⛔ TOHLE NENI RESEND TRACKING. Resend click/open tracking je od 27. 7. 2026 VYPNUTY
//     a Martin 28. 7. rozhodl, ze se NEVRACI (pamet `mb-resend-tracking-domena-400`).
//     Duvod: jejich domena `links.martinbarna.cz` vracela 400 na VSECHNY odkazy pet dni,
//     eventy se pritom logovaly dal, takze to nikde nekriklo. Tady je cely retez nas.
//
// ⛔ PROC NENI PIXEL NA martinbarna.cz: Wedos vraci Googlove obrazkove proxy (GoogleImageProxy)
//    401 a v Gmailu se obrazek nenacte VUBEC (zmereno 31. 7. 2026, pamet
//    `mb-obrazky-v-mailech-hosting-blokuje-gmail`). Pixel na tom hostingu by tise nemeril nic.
//    Supabase domena stejny test u Storage prosla; u teto funkce se to MUSI po nasazeni
//    overit znovu, viz README.md.
//
// ⚠️ CO TOHLE CISLO ZNAMENA A CO NE (cti drive, nez z nej udelas zaver):
//    - Gmail i Apple si pixel casto stahnou SAMY, jeste nez to clovek otevre -> otevreni je
//      NADHODNOCENE. Presne proto vychazel Resendu open rate 95 az 100 %.
//    - Gmail si obrazek zaroven CACHUJE u sebe, takze druhe a dalsi otevreni tehoz mailu uz
//      k nam nedojde -> opakovana otevreni jsou PODHODNOCENA (fakticky se nemeri).
//    ⇒ Pouzitelne je to jako slaby signal o DORUCITELNOSTI, ne jako "lidi to ctou".
//      Verdikt o penezich se stavi na `entitlements`, ne na tomhle.
//
// Zapisuje udalost `px_open` do `email_events`. ⛔ NIKDY ne typ `open`: ten v tabulce uz je
// (1313 radku z 22. az 27. 7. 2026) a jsou to data z rozbiteho Resend okna, ktera se nesmi
// slit s novymi. Nove typy jsou proto `px_odeslano`, `px_open` a `px_click`.
//
// Osobni udaje: NEUKLADA se IP ani cely user-agent (stejne rozhodnuti jako u `resend-webhook`).
// Uklada se jen odvozeny stitek klienta (google-proxy / yahoo / outlook / jiny).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// ⛔ Secret jen z env, nikdy v gitu. Nastavuje se jednou pro cely projekt:
//    supabase secrets set MAIL_TRACK_SECRET=... (viz README.md)
const SECRET = Deno.env.get('MAIL_TRACK_SECRET') ?? '';

// 1x1 pruhledny GIF. Vraci se VZDY, i kdyz je podpis spatne nebo zapis selze:
// prazdny ctverecek v mailu je horsi nez nezmerene otevreni.
const GIF_B64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
// Vraci pokazde CERSTVY buffer: `Response` telo zkonzumuje, sdilena instance by pri
// druhem pozadavku vratila prazdno.
function gifBuffer(): ArrayBuffer {
  const bin = atob(GIF_B64);
  const buf = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return buf;
}
const gifResponse = () =>
  new Response(gifBuffer(), {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      // Cachovani se snazime vypnout, ale Gmail proxy si stejne cachuje po svem.
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    },
  });

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

// HMAC-SHA256 zkraceny na 27 znaku base64url (~160 bitu). Kratsi odkaz, porad daleko
// za hranici uhodnutelnosti. ⛔ Kdo zmeni delku, musi ji zmenit i v odesilacich funkcich.
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
// Porovnani v konstantnim case: delka se lisit smi (pak rovnou false), obsah ne.
function stejnyPodpis(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let rozdil = 0;
  for (let i = 0; i < a.length; i++) rozdil |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return rozdil === 0;
}

// Odvozeny stitek postovniho klienta. ⛔ Sam user-agent se NEUKLADA (osobni udaj, netreba).
// Slouzi k jedine veci: oddelit predstahovani postovnim serverem od skutecneho cloveka.
function stitekKlienta(ua: string): string {
  const u = ua.toLowerCase();
  if (u.includes('googleimageproxy')) return 'google-proxy';
  if (u.includes('yahoomailproxy')) return 'yahoo';
  if (u.includes('outlook') || u.includes('microsoft')) return 'outlook';
  if (u.includes('proxy') || u.includes('bot') || u.includes('crawler')) return 'jiny-stroj';
  return 'jiny';
}

interface Stopa { tr?: string; st?: number; kl?: string; ld?: string | null }

Deno.serve(async (req: Request) => {
  // Metoda: HEAD posilaji nektere proxy driv nez GET. Obojí vraci obrazek, zapisuje se jen GET.
  if (req.method !== 'GET' && req.method !== 'HEAD') return gifResponse();
  try {
    const url = new URL(req.url);
    const p = url.searchParams.get('p') ?? '';
    const s = url.searchParams.get('s') ?? '';
    if (!p || !s || !SECRET) return gifResponse();
    if (!stejnyPodpis(await podpisProText(p), s)) {
      console.warn('[mail-pixel] spatny podpis, nezapisuji');
      return gifResponse();
    }
    if (req.method === 'HEAD') return gifResponse();

    const data = JSON.parse(b64urlToText(p)) as Stopa;
    const track = String(data.tr ?? '');
    const step = Number.isFinite(Number(data.st)) ? Number(data.st) : null;
    const lead = data.ld ? String(data.ld) : null;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    // ⭐ PRVNI OTEVRENI, NE POCET. Unikatni index `email_events_px_open_uniq` (viz
    // mail-mereni.sql) zaridi, ze pro dvojici (lead, krok, trat) vznikne nejvys jeden radek.
    // Delame to indexem a ne dotazem PRED insertem schvalne: select-then-insert v
    // `resend-webhook` byl neatomicky a 23. 7. 2026 propustil ctyri radky za 378 ms.
    // Opakovana otevreni stejne nemerime (Gmail si obrazek cachuje), takze pocet by lhal.
    const { error } = await admin.from('email_events').insert({
      lead_id: lead,
      step,
      type: 'px_open',
      detail: { track, key: String(data.kl ?? ''), klient: stitekKlienta(req.headers.get('user-agent') ?? '') },
    });
    // 23505 = uz otevreno, to je normalni stav, ne chyba.
    if (error && !String(error.code ?? '').includes('23505')) {
      console.error('[mail-pixel] zapis selhal: ' + error.message);
    }
  } catch (e) {
    console.error('[mail-pixel] vyjimka: ' + String(e).slice(0, 200));
  }
  return gifResponse();
});
