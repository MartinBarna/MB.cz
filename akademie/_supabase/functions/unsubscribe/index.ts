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

// MERENI ODHLASENI (1. 9. 2026). Do te doby se datum odhlaseni nedalo zjistit vubec:
// jedine voditko byl `leads.updated_at`, ktery ale prepisuje KAZDY hromadny UPDATE nad
// tabulkou (uklid `next_send_at`, import, prepnuti trate). Revize 1. 9. z nej vycetla
// 14 odhlaseni za den, kdy se ve skutecnosti neodhlasil nikdo. Proto vlastni sloupec
// `leads.unsubscribed_at` (migrace `leads-unsubscribed-at.sql`) a udalost `unsub`
// v `email_events`, ktera navic drzi trat a klic sablony posledniho odeslaneho mailu.
// ⛔ Mereni nesmi shodit odhlaseni: cely zapis udalosti je v try/catch a jeho selhani
//    se jen zaloguje. Odhlasit se je pravni povinnost, statistika je az druha.
async function zapisOdhlaseni(
  a: ReturnType<typeof admin>,
  lead: { id: string; track?: string | null; step?: number | null },
): Promise<void> {
  try {
    // Posledni mail, ktery cloveku odesel. Az z nej se pozna, ktera trat a ktera
    // sablona odhlaseni spustila; bez toho by slo rict jen „nekdo se odhlasil".
    const { data: last } = await a.from('email_events')
      .select('step,detail,created_at').eq('lead_id', lead.id)
      .in('type', ['sent', 'oneoff'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    const d = (last?.detail && typeof last.detail === 'object')
      ? last.detail as Record<string, unknown>
      : {};
    await a.from('email_events').insert({
      lead_id: lead.id,
      step: last?.step ?? lead.step ?? 0,
      type: 'unsub',
      detail: {
        via: 'unsubscribe',
        track: d.track ?? lead.track ?? null,
        key: d.key ?? null,
        po_mailu_z: last?.created_at ?? null,
      },
    });
  } catch (e) {
    console.error('[unsubscribe] mereni selhalo, odhlaseni ale probehlo:', String(e));
  }
}

async function unsubscribe(token: string): Promise<boolean> {
  if (!token || token === 'test-no-op') return false;
  const a = admin();
  const kdy = new Date().toISOString();
  // `select` vraci stav PO updatu, ale `unsubscribed_at` tenhle update nemeni, takze
  // se z nej pozna, jestli uz clovek odhlaseny byl driv.
  const { data, error } = await a.from('leads')
    .update({ status: 'unsubscribed', next_send_at: null, updated_at: kdy })
    .eq('unsubscribe_token', token).select('id,track,step,unsubscribed_at');
  if (error) return false;
  const lead = data?.[0];
  if (!lead) return false;
  // Datum i udalost jen pri PRVNIM odhlaseni. Opakovany klik na tyz odkaz (a mailove
  // skenery, ktere One-Click POST posilaji samy) nesmi prerazitkovat puvodni datum ani
  // nafouknout pocet odhlaseni. Odpoved zustava `ok: true` jako driv.
  if (!lead.unsubscribed_at) {
    await a.from('leads').update({ unsubscribed_at: kdy }).eq('id', lead.id);
    await zapisOdhlaseni(a, lead);

    // ⛔⛔ [6. 9. 2026, Martin] "Kdo se odhlasi, musi ven z databaze, aby se to nemohlo
    // stavat." Do dneska tu koncil `status='unsubscribed'`, coz je zaznam v radku, ktery
    // pri pristim importu ze SimpleShopu, Academy nebo formulare zase prepsal nekdo jiny.
    // `odhlas_a_odstran` zapise adresu na trvaly seznam, zazalohuje cely radek, odpoji
    // (a NESMAZE) historii mailu a teprve pak lead odstrani. Navrat pak zastavi trigger
    // `leads_respektuj_odhlaseni` primo v databazi.
    //
    // ⚠️ Poradi je zamerne: mereni `zapisOdhlaseni` potrebuje lead_id, ktere po smazani
    //    neexistuje, takze bezi PRED tim. Selhani tady odhlaseni neshodi, clovek uz
    //    ma `status='unsubscribed'` a `next_send_at=null`, tedy zadne maily.
    const { error: chybaOdstraneni } = await a.rpc('odhlas_a_odstran', {
      p_lead_id: lead.id,
      p_zdroj: 'unsubscribe-link',
    });
    if (chybaOdstraneni) {
      console.error('[unsubscribe] odstraneni z databaze selhalo, odhlaseni ale plati:', chybaOdstraneni.message);
    }
  }
  return true;
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
