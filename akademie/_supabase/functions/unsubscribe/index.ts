// Barna Academy - unsubscribe + erase (odhlaseni z dripu + plne smazani dat ze zakona). Deno, deploy --no-verify-jwt.
// Autentizace = neuhadnutelny token (leads.unsubscribe_token, UUID) v URL.
// GET = odhlasi + pratelska HTML stranka s nabidkou uplneho smazani;
// GET ?action=erase = nadobro smaze cely zaznam leadu (pravo na vymaz, GDPR cl. 17);
// POST = RFC 8058 One-Click (List-Unsubscribe-Post).
// Service-role jen z env. Zdrojak bez znaku dvojitych uvozovek a zpetnych lomitek (kvuli deployi).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE = 'https://martinbarna.cz';

function admin() { return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } }); }

const page = (title: string, msg: string, extra = '') =>
  `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>${title}</title></head><body style='font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f4f4f5;margin:0;padding:40px'><div style='max-width:480px;margin:0 auto;background:#fff;border-radius:14px;padding:32px;text-align:center;color:#222'><h1 style='font-size:20px;margin:0 0 12px'>${title}</h1><p style='line-height:1.55;color:#444;margin:0 0 18px'>${msg}</p>${extra}<a href='${SITE}' style='display:inline-block;background:#ff7a00;color:#161616;text-decoration:none;padding:12px 22px;border-radius:50px;font-weight:700'>Zpět na martinbarna.cz</a></div></body></html>`;

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

// Pravo na vymaz: nadobro smaze radek leadu (e-mail, jmeno, vse). Souvisejici radky
// (drip_log apod.) je nutne mit s ON DELETE CASCADE, jinak doplnit mazani i tam.
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

  // RFC 8058 One-Click (tlacitko v Gmailu/Apple Mail)
  if (req.method === 'POST') { await unsubscribe(token); return new Response('ok', { status: 200 }); }

  if (req.method === 'GET') {
    // Pravo na vymaz vsech dat
    if (action === 'erase') {
      const ok = await erase(token);
      return htmlResp(ok
        ? page('Smazáno ✅', 'Hotovo — všechna tvoje data (e-mail i jméno) jsme z databáze nadobro smazali. Už Ti nic nepřijde.')
        : page('Odkaz nefunguje', 'Tenhle odkaz už neplatí nebo byla data smazána dřív. Kdyžtak nám napiš a vyřešíme to.'));
    }
    // Bezne odhlaseni z marketingu + nabidka uplneho smazani
    const ok = await unsubscribe(token);
    const eraseLink = ok
      ? `<p style='margin:0 0 18px'><a href='${url.origin}${url.pathname}?token=${encodeURIComponent(token)}&amp;action=erase' style='color:#888;font-size:13px;text-decoration:underline'>Chceš navíc úplně smazat svoje data z databáze? Klikni sem</a></p>`
      : '';
    return htmlResp(ok
      ? page('Odhlášeno ✅', 'Hotovo — už Ti žádné marketingové e-maily nepřijdou. Kdyby sis to rozmyslel/a, stačí si plán znovu stáhnout na webu.', eraseLink)
      : page('Odkaz nefunguje', 'Tenhle odhlašovací odkaz už neplatí nebo je neúplný. Když budeš chtít, napiš nám přímo a vyřešíme to.'));
  }
  return new Response('method-not-allowed', { status: 405 });
});
