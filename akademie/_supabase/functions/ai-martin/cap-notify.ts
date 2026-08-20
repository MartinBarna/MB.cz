// Upozornění Martinovi, když člen na webu narazí na strop AI.
//
// ⛔⛔ POŘADÍ JE SOUČÁSTÍ FUNKCE, NE VOLAJÍCÍHO:
//      1. kontrola, jestli tomu člověku dnes už značka v `ai_usage` nevznikla,
//      2. `zapisZnacku()` (await),
//      3. teprve odeslání mailu.
//
// Proč zrovna takhle: v edge runtime izolát po odeslání odpovědi končí.
// Kdyby se mail posílal první a značka až po něm (nebo v odpojené promise),
// značka se nemusí zapsat a Martin dostane deset mailů za večer.
// Přesně tohle se 20. 8. 2026 muselo opravovat na straně appky.
//
// ⚠️ Cena za tohle pořadí: když selže odeslání, značka už leží a další pokus
// týž den mail nepošle. Vědomě: jedno zmeškané upozornění je menší škoda
// než zaplavená schránka. Když selže zápis značky, mail se NEPOŠLE (stejný důvod).
//
// Značka = řádek v `ai_usage` s `feature` obsahujícím `capped`
// (`ai_chat_web_capped_daily` / `ai_chat_web_capped` a vision varianty).
// Dotaz „komu už dnes odešel mail o stropu":
//   select user_id, feature, created_at from ai_usage
//    where feature like '%capped%'
//      and created_at >= date_trunc('day', timezone('utc', now()));
//
// NÁVRH TEXTU, přepíše Claude.

export const CAP_NOTIFY_TIMEOUT_MS = 5_000;
export const NAME_LOOKUP_TIMEOUT_MS = 2_000;

export type CapKind = 'daily' | 'monthly';
export type CapNotifyResult = 'sent' | 'duplicate' | 'no_key' | 'failed';
export type MemberVia = 'academy' | 'coaching' | null;

export type CapNotifyContext = {
  email: string | null;
  jmeno: string | null;
  via: MemberVia;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<{
  ok?: boolean;
  status: number;
  json?: () => Promise<unknown>;
}>;

export type CapNotifyOpts = {
  userId: string;
  email: string | null;
  via: MemberVia;
  feature: string;
  kind: CapKind;
  supabaseUrl: string;
  serviceRole: string;
  resendKey: string;
  notifyFrom?: string;
  now?: Date;
  fetchImpl?: FetchLike;
  /** Zápis značky do `ai_usage`. Volá se AŽ PO kontrole a PŘED odesláním mailu. */
  zapisZnacku: () => Promise<void>;
};

/** Začátek DNEŠNÍHO dne v UTC. Jeden mail na člověka za kalendářní den, ne za rolling 24 h. */
export function dayStartIso(now: Date): string {
  const d = new Date(now.getTime());
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export function capFeatureLabel(feature: string): string {
  if (feature.includes('vision')) return 'odhad jídla z fotky na webu';
  if (feature.includes('chat')) return 'chat AI Martina na webu';
  return feature;
}

export function capNotifySubject(email: string | null): string {
  return `Klient vyčerpal limit AI na webu: ${email ?? 'neznámý e-mail'}`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function clenstviVeta(via: MemberVia): string | null {
  if (via === 'academy') return 'Je člen Barna Academy.';
  if (via === 'coaching') return 'Je klient osobního koučinku (webový chat má v ceně).';
  return null;
}

/** NÁVRH TEXTU, přepíše Claude. */
export function capNotifyHtml(opts: {
  ctx: CapNotifyContext;
  feature: string;
  kind: CapKind;
}): string {
  const { ctx } = opts;
  // ⛔ Číslo stropu se sem NEPÍŠE. `AI_MARTIN_DAILY_CAP` se mění bez deploye, takže
  // natvrdo napsaná šedesátka by v mailu jednou lhala. Táž past jako ceny v šablonách.
  const strop = opts.kind === 'daily' ? 'denní limit chatu' : 'měsíční nákladový strop';
  const kdo = ctx.jmeno
    ? `${esc(ctx.jmeno)} (${esc(ctx.email ?? 'e-mail neznámý')})`
    : esc(ctx.email ?? 'neznámý člověk');
  const clen = clenstviVeta(ctx.via);
  const mailto = ctx.email
    ? `<p style='margin:18px 0 0'><a href='mailto:${esc(ctx.email)}'>Napsat rovnou: ${esc(ctx.email)}</a></p>`
    : '';
  return `<!doctype html><html lang='cs'><head><meta charset='utf-8'></head><body style='font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.55'>` +
    `<p style='margin:0 0 12px'><strong>${kdo}</strong> vyčerpal ${strop} u funkce ${esc(capFeatureLabel(opts.feature))}.</p>` +
    (clen ? `<p style='margin:0 0 12px'>${clen}</p>` : '') +
    `<p style='margin:0 0 12px'>Tohle je člověk, který AI na webu opravdu používá. Stojí za to napsat.</p>` +
    `${mailto}</body></html>`;
}

function restHeaders(serviceRole: string): Record<string, string> {
  return {
    apikey: serviceRole,
    Authorization: `Bearer ${serviceRole}`,
    'content-type': 'application/json',
  };
}

function withTimeout(ms: number): { signal: AbortSignal; stop: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, stop: () => clearTimeout(t) };
}

/** Poslal už tomuhle člověku dnes strop mail? Poznáme to podle značky v `ai_usage`. */
async function jizDnesCapped(
  opts: { supabaseUrl: string; serviceRole: string; userId: string; now: Date; fetchImpl: FetchLike },
): Promise<boolean | null> {
  if (!opts.supabaseUrl || !opts.serviceRole) return null;
  try {
    const since = encodeURIComponent(dayStartIso(opts.now));
    const uid = encodeURIComponent(opts.userId);
    const url = `${opts.supabaseUrl}/rest/v1/ai_usage?select=id&user_id=eq.${uid}&feature=like.*capped*&created_at=gte.${since}&limit=1`;
    const r = await opts.fetchImpl(url, { headers: restHeaders(opts.serviceRole) });
    if (!r || r.status >= 400) return null;
    const rows = await r.json?.().catch(() => []);
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return null;
  }
}

async function nactiJmeno(
  opts: { supabaseUrl: string; serviceRole: string; email: string | null; fetchImpl: FetchLike },
): Promise<string | null> {
  if (!opts.email || !opts.supabaseUrl || !opts.serviceRole) return null;
  const t = withTimeout(NAME_LOOKUP_TIMEOUT_MS);
  try {
    const url = `${opts.supabaseUrl}/rest/v1/customer_contacts?select=name&email=eq.${encodeURIComponent(opts.email)}&limit=1`;
    const r = await opts.fetchImpl(url, { headers: restHeaders(opts.serviceRole), signal: t.signal });
    if (!r || r.status >= 400) return null;
    const rows = await r.json?.().catch(() => []);
    const name = Array.isArray(rows) ? (rows[0] as { name?: unknown } | undefined)?.name : null;
    return typeof name === 'string' && name.trim() ? name.trim() : null;
  } catch {
    return null;
  } finally {
    t.stop();
  }
}

/**
 * Upozorní Martina, že někdo vyčerpal strop AI na webu. Nejvýš JEDNOU DENNĚ na člověka.
 * ⛔ NIKDY NEVYHAZUJE. Selhání mailu se jen loguje, odpověď uživateli pokračuje.
 */
export async function notifyCapReached(opts: CapNotifyOpts): Promise<CapNotifyResult> {
  try {
    const now = opts.now ?? new Date();
    const doFetch: FetchLike = opts.fetchImpl ?? ((globalThis as { fetch?: FetchLike }).fetch as FetchLike);
    if (typeof doFetch !== 'function') return 'failed';

    const rest = {
      supabaseUrl: opts.supabaseUrl,
      serviceRole: opts.serviceRole,
      userId: opts.userId,
      now,
      fetchImpl: doFetch,
    };

    if (!opts.resendKey) {
      console.error('[cap-notify] RESEND_API_KEY chybí, upozornění na strop se neposílá');
      await opts.zapisZnacku().catch(() => {});
      return 'no_key';
    }

    // 1) KONTROLA. null = dotaz selhal. Radši mail neposlat, než při výpadku zaplavit schránku.
    const uz = await jizDnesCapped(rest);
    if (uz !== false) {
      if (uz === null) console.error('[cap-notify] kontrola dnešních značek selhala, mail neposílám');
      await opts.zapisZnacku().catch(() => {});
      return 'duplicate';
    }

    // 2) ZNAČKA PŘED MAILEM. Když zápis spadne, mail nejde: bez stopy by další náraz poslal znovu.
    try {
      await opts.zapisZnacku();
    } catch (e) {
      console.error('[cap-notify] zápis značky selhal, mail neposílám:', e);
      return 'failed';
    }

    // 3) MAIL. Jméno je bonus, ne podmínka. Co nevíme, vynecháme.
    const jmeno = await nactiJmeno({
      supabaseUrl: opts.supabaseUrl,
      serviceRole: opts.serviceRole,
      email: opts.email,
      fetchImpl: doFetch,
    });
    const ctx: CapNotifyContext = { email: opts.email, jmeno, via: opts.via };
    const from = (opts.notifyFrom && opts.notifyFrom.trim()) || 'Martin Barna <news@martinbarna.cz>';
    const t = withTimeout(CAP_NOTIFY_TIMEOUT_MS);
    try {
      const r = await doFetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${opts.resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          // ⛔ Jen adresa, kterou Martin zadal. Dávka sem přidala i bcc na jeho gmail;
          // druhý příjemce nebyl v zadání, tak jsem ho vzal pryč. Až ho bude chtít, doplní se.
          to: ['martin@martinbarna.cz'],
          subject: capNotifySubject(ctx.email),
          html: capNotifyHtml({ ctx, feature: opts.feature, kind: opts.kind }),
        }),
        signal: t.signal,
      });
      if (!r || r.status !== 200) {
        console.error('[cap-notify] Resend odmítl upozornění, status:', r?.status);
        return 'failed';
      }
      return 'sent';
    } finally {
      t.stop();
    }
  } catch (e) {
    console.error('[cap-notify] upozornění na strop selhalo, pokračuju dál:', e);
    return 'failed';
  }
}
