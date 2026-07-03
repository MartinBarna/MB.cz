// referral-webhook (#39) — SimpleShop platba → zapise referral (pending) podle pouziteho kuponu.
// verify_jwt=false (externi webhook). Idempotence pres order_id, anti-self-referral.
// Surovy payload loguje do referral_webhook_log (Martin tam najde presny nazev pole s kuponem).
// Secret: pokud app_config.referral_webhook_secret existuje, vyzaduje header x-ref-secret.
//
// Deploy: supabase functions deploy referral-webhook --no-verify-jwt
// SimpleShop nastav tak, aby po platbe poslal webhook na URL teto funkce.

const URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// odmeny dle produktu (Kc, store kredit) — Martin muze potvrdit/zmenit
const REWARD: Record<string, number> = { videokurz: 150, academy: 300 };
const BLOCK = new Set(['fitness.barna@gmail.com']);

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(URL + '/rest/v1/' + path, {
    ...init,
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

function pick(o: Record<string, unknown>, keys: string[]): string {
  for (const k of Object.keys(o)) {
    if (keys.includes(k.toLowerCase())) {
      const v = o[k];
      if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim();
    }
  }
  return '';
}

function detectProduct(text: string, amount: number): string {
  const t = text.toLowerCase();
  if (t.includes('academy') || t.includes('akademie')) return 'academy';
  if (t.includes('videokurz') || t.includes('kurz')) return 'videokurz';
  if (amount && amount <= 1200) return 'videokurz';
  return 'videokurz';
}

async function logRaw(payload: unknown, matched: boolean, note: string) {
  try {
    await rest('referral_webhook_log', { method: 'POST', body: JSON.stringify({ payload, matched, note }) });
  } catch { /* log best-effort */ }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  // secret (pokud nastaveny)
  try {
    const cr = await rest('app_config?select=value&key=eq.referral_webhook_secret&limit=1');
    const cd = await cr.json().catch(() => []);
    const secret = Array.isArray(cd) && cd.length ? String(cd[0].value ?? '') : '';
    if (secret && req.headers.get('x-ref-secret') !== secret) return json({ error: 'forbidden' }, 401);
  } catch { /* pokud check selze, pokracuj (MVP) */ }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { await logRaw({ _raw: 'unparseable' }, false, 'bad_json'); return json({ ok: true }); }

  const buyer = pick(body, ['email', 'customer_email', 'buyer_email', 'mail', 'e-mail']).toLowerCase();
  const couponRaw = pick(body, ['coupon', 'coupon_code', 'voucher', 'discount_code', 'sleva', 'slevovy_kod', 'kupon', 'code']);
  const coupon = couponRaw.toUpperCase().trim();
  const orderId = pick(body, ['order_id', 'order', 'order_number', 'cislo_objednavky', 'variable_symbol', 'vs', 'id']);
  const amount = Number(pick(body, ['amount', 'price', 'total', 'cena', 'sum', 'castka']).replace(',', '.')) || 0;
  const prodText = pick(body, ['product', 'product_name', 'item', 'nazev', 'name', 'produkt']);
  const product = detectProduct(prodText + ' ' + couponRaw, amount);

  // refund event?
  const evt = pick(body, ['event', 'type', 'status', 'state']).toLowerCase();
  if (orderId && (evt.includes('refund') || evt.includes('storno') || evt.includes('vraceni'))) {
    try { await rest('referrals?order_id=eq.' + encodeURIComponent(orderId), { method: 'PATCH', body: JSON.stringify({ status: 'void' }) }); } catch {}
    await logRaw(body, false, 'refund_void');
    return json({ ok: true });
  }

  if (!coupon || !buyer) { await logRaw(body, false, 'no_coupon_or_buyer'); return json({ ok: true }); }
  if (BLOCK.has(buyer)) { await logRaw(body, false, 'blocked_buyer'); return json({ ok: true }); }

  // najdi kod
  try {
    const kr = await rest('referral_codes?select=code,owner_email&code=eq.' + encodeURIComponent(coupon) + '&limit=1');
    const kd = await kr.json().catch(() => []);
    if (!Array.isArray(kd) || !kd.length) { await logRaw(body, false, 'coupon_not_referral'); return json({ ok: true }); }
    const owner = String(kd[0].owner_email ?? '').toLowerCase();
    if (owner === buyer) { await logRaw(body, false, 'self_referral'); return json({ ok: true }); }

    // idempotence pres order_id
    if (orderId) {
      const ex = await rest('referrals?select=id&order_id=eq.' + encodeURIComponent(orderId) + '&limit=1');
      const exd = await ex.json().catch(() => []);
      if (Array.isArray(exd) && exd.length) { await logRaw(body, true, 'duplicate_order'); return json({ ok: true }); }
    }

    const reward = REWARD[product] ?? 150;
    const ins = await rest('referrals', {
      method: 'POST',
      body: JSON.stringify({
        code: coupon, buyer_email: buyer, product, amount: amount || null,
        order_id: orderId || null, source: 'coupon', status: 'pending',
        reward_type: 'credit', reward_amount: reward,
      }),
    });
    if (ins.status === 201) { await logRaw(body, true, 'recorded_' + product); return json({ ok: true, recorded: true }); }
    // 409 = buyer+product uz existuje
    await logRaw(body, false, 'insert_' + ins.status);
    return json({ ok: true });
  } catch (e) {
    await logRaw(body, false, 'exception_' + String(e).slice(0, 80));
    return json({ ok: true });
  }
});
