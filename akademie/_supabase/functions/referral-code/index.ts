// referral-code (#39) — get-or-create referral kod pro prihlaseneho zakaznika + stav kreditu.
// verify_jwt=true → Supabase gateway overi user JWT. Z JWT vezmeme email, overime entitlement,
// vratime kod (BARNA-XXXX), share_url a stav (referral_credit view). Zapis pres service role.
//
// Deploy: supabase functions deploy referral-code  (verify_jwt=true)
// Volitelne env: REF_ORIGIN (CORS), REF_SITE (zaklad share linku).

const URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ORIGIN = Deno.env.get('REF_ORIGIN') ?? 'https://martinbarna.cz';
const SITE = Deno.env.get('REF_SITE') ?? 'https://martinbarna.cz';

const CORS = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

function emailFromJwt(auth: string): string {
  try {
    const t = auth.replace(/^Bearer\s+/i, '');
    const p = t.split('.')[1];
    if (!p) return '';
    const dec = atob(p.replace(/-/g, '+').replace(/_/g, '/'));
    const o = JSON.parse(dec);
    return String(o.email ?? '').toLowerCase();
  } catch { return ''; }
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(URL + '/rest/v1/' + path, {
    ...init,
    headers: {
      apikey: SERVICE,
      Authorization: 'Bearer ' + SERVICE,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

function genCode(): string {
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bez 0/O/1/I
  const a = new Uint8Array(4);
  crypto.getRandomValues(a);
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPH[a[i] % ALPH.length];
  return 'BARNA-' + s;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const email = emailFromJwt(req.headers.get('Authorization') ?? '');
  if (!email) return json({ error: 'unauthorized' }, 401);

  // entitlement check (aktivni academy nebo videokurz)
  try {
    const er = await rest('entitlements?select=product&active=eq.true&email=ilike.' + encodeURIComponent(email) + '&limit=1');
    const ents = await er.json().catch(() => []);
    if (!Array.isArray(ents) || ents.length === 0) return json({ error: 'no_entitlement' }, 403);
  } catch { return json({ error: 'check_failed' }, 500); }

  // get-or-create kod
  let code = '';
  try {
    const gr = await rest('referral_codes?select=code&owner_email=ilike.' + encodeURIComponent(email) + '&limit=1');
    const rows = await gr.json().catch(() => []);
    if (Array.isArray(rows) && rows.length) code = rows[0].code;
    if (!code) {
      for (let attempt = 0; attempt < 5 && !code; attempt++) {
        const cand = genCode();
        const ir = await rest('referral_codes', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ code: cand, owner_email: email }),
        });
        if (ir.status === 201) { code = cand; break; }
        // 409 owner uidx → kod uz existuje pro tento email, nacti ho
        const re = await rest('referral_codes?select=code&owner_email=ilike.' + encodeURIComponent(email) + '&limit=1');
        const rr = await re.json().catch(() => []);
        if (Array.isArray(rr) && rr.length) { code = rr[0].code; break; }
        // jinak 409 kvuli kolizi code → zkus jiny
      }
    }
  } catch { return json({ error: 'code_failed' }, 500); }
  if (!code) return json({ error: 'code_failed' }, 500);

  // stav kreditu
  let status = { credit_confirmed: 0, credit_pending: 0, referrals_confirmed: 0, referrals_pending: 0 };
  try {
    const sr = await rest('referral_credit?owner_email=ilike.' + encodeURIComponent(email) + '&limit=1');
    const sd = await sr.json().catch(() => []);
    if (Array.isArray(sd) && sd.length) {
      status = {
        credit_confirmed: Number(sd[0].credit_confirmed ?? 0),
        credit_pending: Number(sd[0].credit_pending ?? 0),
        referrals_confirmed: Number(sd[0].referrals_confirmed ?? 0),
        referrals_pending: Number(sd[0].referrals_pending ?? 0),
      };
    }
  } catch { /* stav je best-effort */ }

  return json({ code, share_url: SITE + '/?ref=' + code, status });
});
