// Barna Academy - unsubscribe (one-click odhlaseni z dripu) + GDPR erase. Deno, deploy --no-verify-jwt.
// Autentizace = neuhadnutelny token (leads.unsubscribe_token, UUID) v URL.
// GET = odhlasi + HTML stranka s odkazem na uplny vymaz dat; GET ?action=erase = nadobro smaze lead (GDPR vymaz), email_events padaji pres ON DELETE CASCADE.
// POST = RFC 8058 One-Click (List-Unsubscribe-Post). Service-role jen z env. Zdrojak bez uvozovek a zpetnych lomitek (kvuli deployi).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE = 'https://martinbarna.cz';

const admin = () => createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const page = (title: string, msg: string, extra = '') =>
  `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>${title}</title></head><body style='font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f4f4f5;margin:0;padding:40px'><div style='max-width:480px;margin:0 auto;background:#fff;border-radius:14px;padding:32px;text-align:center;color:#222'><h1 style='font-size:20px;margin:0 0 12px'>${title}</h1><p style='line-height:1.55;color:#444;margin:0 0 20px'>${msg}</p>${extra}<a href='${SITE}' style='display:inline-block;background:#ff7a00;color:#161616;text-decoration:none;padding:12px 22px;border-radius:50px;font-weight:700'>Zpět na martinbarna.cz</a></div></body></html>`;

const htmlResp = (html: string, status = 200) =>
  new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

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

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  const action = url.searchParams.get('action') || '';
  if (req.method === 'POST') { await unsubscribe(token); return new Response('ok', { status: 200 }); }
  if (req.method === 'GET') {
    if (action === 'erase') {
      const gone = await erase(token);
      return htmlResp(gone
        ? page('Data smazána ✅', 'Tvoje data jsme nadobro vymazali z databáze — e-mail, jméno, telefon i historii e-mailů. U nás je to kompletně pryč.')
        : page('Odkaz nefunguje', 'Tenhle odkaz na výmaz už neplatí, nebo byla data smazána dříve. Kdyžtak nám napiš přímo a vyřešíme to.'));
    }
    const ok = await unsubscribe(token);
    if (!ok) return htmlResp(page('Odkaz nefunguje', 'Tenhle odhlašovací odkaz už neplatí nebo je neúplný. Kdyžtak nám napiš přímo a vyřešíme to.'));
    const eraseLink = `<p style='margin:0 0 18px'><a href='?token=${encodeURIComponent(token)}&action=erase' style='color:#999;font-size:13px'>Chci úplně smazat svoje data z databáze (GDPR)</a></p>`;
    return htmlResp(page('Odhlášeno ✅', 'Hotovo — už Ti žádné marketingové e-maily nepřijdou. Kdyby sis to rozmyslel/a, stačí si plán znovu stáhnout na webu.', eraseLink));
  }
  return new Response('method-not-allowed', { status: 405 });
});
