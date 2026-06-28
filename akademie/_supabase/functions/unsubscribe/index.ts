// Barna Academy - unsubscribe (one-click odhlaseni z dripu). Deno, deploy --no-verify-jwt.
// Autentizace = neuhadnutelny token (leads.unsubscribe_token, UUID) v URL.
// GET = odhlasi + pratelska HTML stranka; POST = RFC 8058 One-Click (List-Unsubscribe-Post).
// Service-role jen z env. Zdrojak bez znaku uvozovek a zpetnych lomitek (kvuli deployi).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE = 'https://martinbarna.cz';

const page = (title: string, msg: string) =>
  `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>${title}</title></head><body style='font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f4f4f5;margin:0;padding:40px'><div style='max-width:480px;margin:0 auto;background:#fff;border-radius:14px;padding:32px;text-align:center;color:#222'><h1 style='font-size:20px;margin:0 0 12px'>${title}</h1><p style='line-height:1.55;color:#444;margin:0 0 20px'>${msg}</p><a href='${SITE}' style='display:inline-block;background:#ff7a00;color:#161616;text-decoration:none;padding:12px 22px;border-radius:50px;font-weight:700'>Zpět na martinbarna.cz</a></div></body></html>`;

const htmlResp = (html: string, status = 200) =>
  new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

async function unsubscribe(token: string): Promise<boolean> {
  if (!token || token === 'test-no-op') return false;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data, error } = await admin.from('leads')
    .update({ status: 'unsubscribed', updated_at: new Date().toISOString() })
    .eq('unsubscribe_token', token).select('id');
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

Deno.serve(async (req: Request) => {
  const token = new URL(req.url).searchParams.get('token') || '';
  if (req.method === 'POST') { await unsubscribe(token); return new Response('ok', { status: 200 }); }
  if (req.method === 'GET') {
    const ok = await unsubscribe(token);
    return htmlResp(ok
      ? page('Odhlášeno ✅', 'Hotovo — už Ti žádné marketingové e-maily nepřijdou. Kdyby sis to rozmyslel/a, stačí si plán znovu stáhnout na webu.')
      : page('Odkaz nefunguje', 'Tenhle odhlašovací odkaz už neplatí nebo je neúplný. Když budeš chtít, napiš nám přímo a vyřešíme to.'));
  }
  return new Response('method-not-allowed', { status: 405 });
});
