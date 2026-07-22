// Barna Academy - unsubscribe (odhlaseni z dripu) + GDPR erase. Deno, deploy --no-verify-jwt.
// Autentizace = neuhadnutelny token (leads.unsubscribe_token, UUID) v URL.
//
// POZOR (2026-07-22): Supabase edge fn NESMI servirovat HTML. GET vracejici text/html Supabase
//   prepise na text/plain (viz docs "HTML content is not supported"), takze uzivatel videl misto
//   stranky s tlacitkem syrovy kod. Proto UI odhlaseni bezi na webu: https://martinbarna.cz/odhlasit/
//   - GET  (klik na textovy odkaz v mailu) -> 302 redirect na /odhlasit/?token=... ZADNY side-effect,
//     firemni mailove skenery GET-fetchuji odkazy z tela/hlavicek, redirect nikoho tise neodhlasi.
//   - POST (One-Click z mail klienta dle RFC 8058 List-Unsubscribe-Post, i fetch z /odhlasit/ stranky)
//     -> skutecne odhlaseni. Vraci JSON {ok} + CORS (aby fetch z martinbarna.cz prosel; mail klient
//     telo ignoruje, chce jen 2xx).
//   - POST ?action=erase -> GDPR vymaz (vola jen /odhlasit/ stranka po odhlaseni), email_events
//     padaji pres ON DELETE CASCADE.
// Service-role jen z env.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PAGE = 'https://martinbarna.cz/odhlasit/';   // webove UI odhlaseni (Supabase HTML servirovat neumi)

const admin = () => createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// fetch z /odhlasit/ stranky bezi z prohlizece, potrebuje CORS. Mail-klientovi (One-Click) CORS nevadi.
const ALLOW = ['https://martinbarna.cz', 'https://www.martinbarna.cz'];
function cors(req: Request): Record<string, string> {
  const o = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOW.includes(o) ? o : ALLOW[0],
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
const json = (b: unknown, c: Record<string, string>, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...c, 'Content-Type': 'application/json' } });

async function unsubscribe(token: string): Promise<boolean> {
  if (!token || token === 'test-no-op') return false;
  const { data, error } = await admin().from('leads')
    .update({ status: 'unsubscribed', next_send_at: null, updated_at: new Date().toISOString() })
    .eq('unsubscribe_token', token).select('id');
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

async function erase(token: string): Promise<boolean> {
  if (!token || token === 'test-no-op') return false;
  const { data, error } = await admin().from('leads')
    .delete().eq('unsubscribe_token', token).select('id');
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  const action = url.searchParams.get('action') || '';
  const C = cors(req);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: C });

  // GET = klik na textovy odkaz v mailu. ZADNY side-effect (ochrana pred mail skenery),
  // jen presmerovani na webove UI, kde uzivatel odhlaseni potvrdi tlacitkem (= POST).
  // Presmerovava i starsi odeslane maily, ktere maji v paticce primo tenhle endpoint.
  if (req.method === 'GET') {
    const to = PAGE + (token ? '?token=' + encodeURIComponent(token) : '');
    return new Response(null, { status: 302, headers: { Location: to } });
  }

  // POST = skutecne odhlaseni (One-Click z mail klienta i tlacitko z /odhlasit/ stranky).
  if (req.method === 'POST') {
    if (action === 'erase') {
      const gone = await erase(token);
      return json({ erased: gone }, C);
    }
    const ok = await unsubscribe(token);
    return json({ ok }, C);
  }

  return json({ error: 'method-not-allowed' }, C, 405);
});
