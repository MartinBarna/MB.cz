// Barna Academy - unsubscribe (odhlaseni z dripu) + GDPR erase. Deno, deploy --no-verify-jwt.
// Autentizace = neuhadnutelny token (leads.unsubscribe_token, UUID) v URL.
// POST = RFC 8058 One-Click (List-Unsubscribe-Post) -> okamzite odhlaseni; stejny POST
//   pouziva i potvrzovaci tlacitko na strance (browser dostane HTML, mailovy klient 'ok').
// GET = JEN potvrzovaci stranka s tlacitkem, ZADNY side-effect — firemni mailove skenery
//   GET-fetchuji odkazy z hlavicek/tel mailu a drive tise odhlasovaly zive leady.
// GET ?action=erase = nadobro smaze lead (GDPR vymaz; odkaz je az na strance po odhlaseni,
//   ne v mailu), email_events padaji pres ON DELETE CASCADE.
// Service-role jen z env. Zdrojak bez uvozovek a zpetnych lomitek (kvuli deployi).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE = 'https://martinbarna.cz';

const admin = () => createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// dark+gold sladene s drip maily (#0C0B10 pozadi, #181520 karta, #EBB12C akcent) — retired oranzova pryc
const page = (title: string, msg: string, extra = '') =>
  `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='color-scheme' content='dark'><title>${title}</title></head><body style='font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#0C0B10;margin:0;padding:40px 16px'><div style='max-width:480px;margin:0 auto;background:#181520;border:1px solid #262232;border-radius:2px;padding:32px;text-align:center;color:#F0EADF'><div style='border-left:3px solid #EBB12C;padding-left:10px;font-weight:800;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#EBB12C;margin:0 0 20px;text-align:left'>Martin Barna</div><h1 style='font-size:20px;margin:0 0 12px'>${title}</h1><p style='line-height:1.55;color:#A09AAD;margin:0 0 20px'>${msg}</p>${extra}<p style='margin:18px 0 0'><a href='${SITE}' style='color:#8F8A99;font-size:13px'>Zpět na martinbarna.cz</a></p></div></body></html>`;

const htmlResp = (html: string, status = 200) =>
  new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

async function tokenValid(token: string): Promise<boolean> {
  if (!token || token === 'test-no-op') return false;
  const { data, error } = await admin().from('leads')
    .select('id').eq('unsubscribe_token', token).limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

async function unsubscribe(token: string): Promise<boolean> {
  if (!token || token === 'test-no-op') return false;
  const { data, error } = await admin().from('leads')
    .update({ status: 'unsubscribed', updated_at: new Date().toISOString() })
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

const brokenPage = () =>
  page('Odkaz nefunguje', 'Tenhle odhlašovací odkaz už neplatí nebo je neúplný. Kdyžtak nám napiš přímo a vyřešíme to.');

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  const action = url.searchParams.get('action') || '';

  // POST = skutecne odhlaseni (One-Click z mailoveho klienta i tlacitko ze stranky).
  if (req.method === 'POST') {
    const ok = await unsubscribe(token);
    // mailovy klient (RFC 8058) chce jen 200; browseru z formulare vratime stranku
    const accept = req.headers.get('accept') ?? '';
    if (!accept.includes('text/html')) return new Response('ok', { status: 200 });
    if (!ok) return htmlResp(brokenPage());
    const eraseLink = `<p style='margin:0 0 18px'><a href='?token=${encodeURIComponent(token)}&action=erase' style='color:#8F8A99;font-size:13px'>Chci úplně smazat svoje data z databáze (GDPR)</a></p>`;
    return htmlResp(page('Odhlášeno ✅', 'Hotovo — už Ti žádné marketingové e-maily nepřijdou. Kdyby sis to rozmyslel/a, stačí si plán znovu stáhnout na webu.', eraseLink));
  }

  if (req.method === 'GET') {
    if (action === 'erase') {
      const gone = await erase(token);
      return htmlResp(gone
        ? page('Data smazána ✅', 'Tvoje data jsme nadobro vymazali z databáze — e-mail, jméno, telefon i historii e-mailů. U nás je to kompletně pryč.')
        : page('Odkaz nefunguje', 'Tenhle odkaz na výmaz už neplatí, nebo byla data smazána dříve. Kdyžtak nám napiš přímo a vyřešíme to.'));
    }
    // GET bez akce = jen potvrzovaci stranka (zadny side-effect — ochrana pred mail skenery)
    const valid = await tokenValid(token);
    if (!valid) return htmlResp(brokenPage());
    const confirmBtn = `<form method='post' action='?token=${encodeURIComponent(token)}' style='margin:0'><button type='submit' style='display:inline-block;background:#EBB12C;color:#1A1222;border:none;cursor:pointer;padding:13px 26px;border-radius:0;font-weight:700;text-transform:uppercase;letter-spacing:.05em;font-size:15px;font-family:inherit'>Potvrdit odhlášení</button></form>`;
    return htmlResp(page('Odhlásit odběr e-mailů?', 'Klikni na tlačítko níže a už Ti žádné marketingové e-maily nepřijdou. Kdyby sis to rozmyslel/a, stačí si plán znovu stáhnout na webu.', confirmBtn));
  }

  return new Response('method-not-allowed', { status: 405 });
});
