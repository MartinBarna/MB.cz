// synced from deployed v4, 2026-07-16
// referral-click (#39, Cesta A) — most pro atribuci referrera pres e-mail.
// SimpleShop nedostane vlastni parametr do webhooku, tak si {ref, email} ulozime tady
// PRED odchodem na checkout; pri platbe simpleshop-webhook spari buyer_email -> ref.
// verify_jwt=false (verejny endpoint z martinbarna.cz), CORS jen na martinbarna.cz.
// Anti-spam: honeypot (website), ref musi byt realny referral_code, light rate-limit per IP.

const URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const ALLOWED = new Set(['https://martinbarna.cz', 'https://www.martinbarna.cz']);

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allow = ALLOWED.has(origin) ? origin : 'https://martinbarna.cz';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(URL + '/rest/v1/' + path, {
    ...init,
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: true }, 200);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ ok: true, stored: false }); }

  // honeypot — skryte pole 'website' ma zustat prazdne; kdyz je vyplnene, je to bot
  const hp = String(body.website ?? body.hp ?? '').trim();
  if (hp) return json({ ok: true, stored: false });

  const ref = String(body.ref ?? '').toUpperCase().trim();
  const email = String(body.email ?? '').toLowerCase().trim();
  if (!ref || !email || !email.includes('@')) return json({ ok: true, stored: false });
  if (ref.length > 32 || email.length > 200) return json({ ok: true, stored: false });

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;
  const ua = (req.headers.get('user-agent') ?? '').slice(0, 200) || null;

  try {
    // ref musi byt realny aktivni referral kod (jinak neukladame — zadny junk)
    const kr = await rest('referral_codes?select=code&code=eq.' + encodeURIComponent(ref) + '&active=eq.true&limit=1');
    const kd = await kr.json().catch(() => []);
    if (!Array.isArray(kd) || !kd.length) return json({ ok: true, stored: false });

    // light rate-limit: max 20 zapisu z jedne IP za 10 minut
    if (ip) {
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const rr = await rest(
        'referral_click?select=id&ip=eq.' + encodeURIComponent(ip) + '&created_at=gt.' + encodeURIComponent(since),
        { headers: { Prefer: 'count=exact', Range: '0-0' } },
      );
      const cnt = Number((rr.headers.get('content-range') ?? '*/0').split('/')[1] || 0);
      if (cnt >= 20) return json({ ok: true, stored: false });
    }

    await rest('referral_click', { method: 'POST', body: JSON.stringify({ ref, email, ip, user_agent: ua }) });
    return json({ ok: true, stored: true });
  } catch {
    return json({ ok: true, stored: false });
  }
});
