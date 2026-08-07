// referral-code (#39) — get-or-create referral kod pro prihlaseneho zakaznika + stav kreditu.
// verify_jwt=FALSE → token overujeme SAMI pres auth/v1/user (gateway s verify_jwt=true odmitala
// legacy JWT chybou UNAUTHORIZED_LEGACY_JWT a funkce se vubec nespustila). Z overeneho tokenu
// vezmeme email, overime entitlement,
// vratime kod (BARNA-XXXX), share_url a stav (views referral_credit + referral_balances).
// Zapis pres service role. Od 7. 8. 2026 stav nese i `credit_paid` a `credit_available`
// (= confirmed minus vyplacene), protoze samotny referral_credit o vyplatach nevi.
//
// Deploy: supabase functions deploy referral-code --no-verify-jwt
// (POZOR: pri --no-verify-jwt MUSI zustat overeni tokenu nize; jinak by stacilo poslat
//  vymysleny token s cizim e-mailem a precist cizi kod i vydelky.)
// Volitelne env: REF_ORIGIN (CORS), REF_SITE (zaklad share linku).

const URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ORIGIN = Deno.env.get('REF_ORIGIN') ?? 'https://martinbarna.cz';
const SITE = Deno.env.get('REF_SITE') ?? 'https://martinbarna.cz';

const CORS = {
  'Access-Control-Allow-Origin': ORIGIN,
  // 'apikey' MUSI byt povolena: supabase-js ji u functions.invoke posila vzdy a prohlizec
  // jinak zablokuje uz preflight (projevi se jako 'Failed to send a request to the Edge Function').
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Overi user token proti Supabase auth API a vrati e-mail. Na rozdil od pouheho dekodovani
// payloadu tohle NELZE podvrhnout: neplatny podpis = auth API vrati chybu.
async function emailFromToken(auth: string): Promise<string> {
  try {
    const t = auth.replace(/^Bearer\s+/i, '').trim();
    if (!t) return '';
    const r = await fetch(URL + '/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + t, apikey: SERVICE },
    });
    if (!r.ok) return '';
    const u = await r.json();
    return String(u?.email ?? '').toLowerCase();
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
  const email = await emailFromToken(req.headers.get('Authorization') ?? '');
  if (!email) return json({ error: 'unauthorized' }, 401);

  // entitlement check (aktivni academy nebo videokurz)
  try {
    // Expirace: referral kod smi generovat jen clen s PLATNYM pristupem (NULL = dozivotni).
    // Bez toho by expirovany mesicni clen dal vydelaval na provizich. Viz `mb-academy-pricing-mise`.
    const er = await rest('entitlements?select=product&active=eq.true&email=ilike.' + encodeURIComponent(email)
      + '&or=(expires_at.is.null,expires_at.gt.' + encodeURIComponent(new Date().toISOString()) + ')&limit=1');
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
  // ⛔ NÁLEZ 7. 8. 2026: tady se četl JEN view `referral_credit`, který o tabulce
  // `referral_payouts` vůbec neví. Vyplacený kredit proto členovi svítil napořád
  // a mohl ho chtít podruhé. Proto se sem přidal `referral_balances` se sloupcem `paid`
  // a dopočítává se `credit_available = confirmed - paid`.
  //
  // ⚠️ TOHLE MUSÍ ZŮSTAT NA SERVERU. `referral_payouts` má zapnuté RLS a NULA politik,
  // takže z něj přihlášený člen nepřečte nic, a `referral_balances` je `security_invoker`.
  // Kdyby si stránka to view sáhla přímo z prohlížeče, `paid` by vyšlo VŽDY 0
  // a chyba by se jen schovala. Service role, kterou `rest()` používá, RLS obchází.
  //
  // ⚠️ Dva views počítají mírně jinak: `referral_credit.credit_confirmed` filtruje
  // `reward_type='credit'`, `referral_balances.confirmed` bere všechny typy odměn.
  // Dnes je to totožné (webhook zapisuje výhradně `reward_type:'credit'`), ale kdyby
  // někdy přibyla odměna typu `cash`, rozejdou se. Peníze proto beru z `referral_balances`,
  // ať sedí se stejným základem, ze kterého se odečítá `paid`.
  let status = {
    credit_confirmed: 0, credit_pending: 0,
    credit_paid: 0, credit_available: 0,
    referrals_confirmed: 0, referrals_pending: 0,
  };
  try {
    const sr = await rest('referral_credit?owner_email=ilike.' + encodeURIComponent(email) + '&limit=1');
    const sd = await sr.json().catch(() => []);
    if (Array.isArray(sd) && sd.length) {
      // ⚠️ Baseline schvalne i pro `credit_confirmed`, i kdyz ho nize prepise
      // `referral_balances`. Kdyby ten druhy dotaz selhal, stranka ukaze presne to,
      // co ukazovala dosud, misto aby clenovi tvrdila 0 Kc. Nizsi kvalita cisla
      // je porad lepsi nez cislo, ktere lze.
      status.credit_confirmed = Number(sd[0].credit_confirmed ?? 0);
      status.credit_available = status.credit_confirmed;
      status.credit_pending = Number(sd[0].credit_pending ?? 0);
      status.referrals_confirmed = Number(sd[0].referrals_confirmed ?? 0);
      status.referrals_pending = Number(sd[0].referrals_pending ?? 0);
    }
  } catch { /* stav je best-effort */ }
  try {
    const br = await rest('referral_balances?owner_email=ilike.' + encodeURIComponent(email) + '&limit=1');
    const bd = await br.json().catch(() => []);
    if (Array.isArray(bd) && bd.length) {
      status.credit_confirmed = Number(bd[0].confirmed ?? 0);
      status.credit_paid = Number(bd[0].paid ?? 0);
      // Nikdy záporné číslo: kdyby Martin vyplatil víc, než je potvrzeno, ukáže se 0,
      // ne „-150 Kč". Rozdíl si vyřeší s členem, stránka ho strašit nemá.
      status.credit_available = Math.max(0, status.credit_confirmed - status.credit_paid);
    }
  } catch { /* stav je best-effort */ }

  return json({ code, share_url: SITE + '/?ref=' + code, status });
});
