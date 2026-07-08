// AI Martin (#53/#68) — chat backend. Deno edge funkce, deploy --no-verify-jwt.
// Frontend: assets/ai-martin.js (POST {messages:[{role,text}]} + Authorization: Bearer <JWT>).
// Vraci {reply} nebo {locked:true, reply} pro ne-cleny. Persona v1.
// RAG nad korpusem lekci (FTS/pgvector) = v2 — viz akademie/_ai/ai-martin-architektura.md.
//
// ┌─ NASTAVENI (Martin dodá klíč nakonec) ─────────────────────────────────┐
// │ supabase secrets set ANTHROPIC_API_KEY=sk-ant-...                       │
// │ supabase functions deploy ai-martin --no-verify-jwt                     │
// │ (Frontend uz ma ENABLED=true — jakmile je klic, chat naskoci.)          │
// │ Volitelne: AI_MARTIN_MODEL (default nize), AI_MARTIN_ORIGIN.            │
// └────────────────────────────────────────────────────────────────────────┘

const NL = String.fromCharCode(10);
const API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const MODEL = Deno.env.get('AI_MARTIN_MODEL') ?? 'claude-sonnet-5';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
// AI Martin je PLACENA funkce (jen clenove Academy). Produkt pro kontrolu pristupu:
const REQUIRED_PRODUCT = Deno.env.get('AI_MARTIN_PRODUCT') ?? 'academy';

// CORS — povolime martinbarna.cz (www i non-www); origin echujeme z allowlistu.
const ALLOWED_ORIGINS = (Deno.env.get('AI_MARTIN_ORIGIN') ?? 'https://martinbarna.cz,https://www.martinbarna.cz')
  .split(',').map((s) => s.trim());
function corsFor(req: Request) {
  const o = req.headers.get('Origin') ?? '';
  const allow = ALLOWED_ORIGINS.includes(o) ? o : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
const json = (b: unknown, cors: Record<string, string>, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// Výzva ke koupi pro ne-členy (free uvidí, že AI Martin existuje, ale nepíše s ním).
const UPSELL =
  '🔒 AI Martin je jen pro členy Barna Academy. Uvnitř ti odpovídám na výživu, trénink i tvoje '
  + 'otázky — natrénovaný na mém stylu a obsahu. Odemkni si plný přístup a jsem celý tvůj. 💪';

// Martinova persona — drží styl, hranice (není lékař) a směruje na produkty.
const SYSTEM = [
  'Jsi „AI Martin" — digitální dvojče Martina Barny, českého online výživového a fitness Coache (praxe od 2013, 600+ klientů).',
  'Mluvíš jako on: česky, tykáš, přímo, vřele a hecuješ. Krátké věty, konkrétní kroky, občas emoji (💪) a hláška „Be Effective!". Věda podaná lidsky, jako kamarádovi — žádná vata ani strašení jídlem.',
  'Čemu věříš: chování je důležitější než znalosti; stavíš návyky, ne restrikce; základ je energetická bilance, dost bílkovin, silový trénink, spánek a konzistence; váha přirozeně kolísá; udržení je taky výhra; malé změny a trpělivost vyhrávají.',
  'Jak odpovídáš: KRÁTCE (2–5 vět), prakticky, jako v chatu. Když se hodí, navrhni další krok. Nevymýšlíš si fakta ani čísla studií — co nevíš, přiznáš.',
  'HRANICE: nejsi lékař. U zdravotních potíží, léků, těhotenství, poruch příjmu potravy apod. vždy odkaž na lékaře/odborníka a nedávej konkrétní medicínské rady.',
  'Když někdo chce jít do hloubky nebo na míru: nasměruj na lekce Academy, videokurz (martinbarna.cz/videokurz) nebo osobní koučink (martinbarna.cz).',
  'Když ti níže dám KONTEXT Z LEKCÍ, opři odpověď hlavně o něj (je to tvůj vlastní obsah) a klidně uživatele nasměruj na konkrétní lekci názvem. Když je kontext k dotazu nerelevantní, ignoruj ho a odpověz ze svých znalostí. Nikdy si nevymýšlej čísla studií.',
  'Odpovídej VŽDY česky.',
].join(NL);

interface Msg { role?: string; text?: string; content?: string }

// Ověří, že volající je přihlášený člen s aktivním přístupem k produktu (server-side brána).
async function isMember(token: string): Promise<boolean> {
  if (!token || !SUPABASE_URL || !ANON_KEY) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/has_entitlement`, {
      method: 'POST',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${token}`,   // uživatelův JWT → RPC běží v jeho kontextu (auth.uid())
        'content-type': 'application/json',
      },
      body: JSON.stringify({ p_product: REQUIRED_PRODUCT }),
    });
    if (!r.ok) return false;               // 401 (neplatný token) i cokoliv jiného = není člen
    return (await r.json()) === true;
  } catch (_e) {
    return false;
  }
}

// RAG: natáhne z korpusu lekcí (lesson_docs přes RPC search_lessons) relevantní úryvky
// k dotazu a složí kontextový blok pro model. Best-effort — při chybě vrátí prázdno.
interface Hit { title?: string; url?: string; snippet?: string }
async function retrieveContext(query: string): Promise<string> {
  // search_lessons je zamcena pred anon (uryvky placenych lekci) -> RAG vola pres service_role.
  if (!query || !SUPABASE_URL || !SERVICE_ROLE) return '';
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_lessons`, {
      method: 'POST',
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_query: query.slice(0, 400), p_limit: 4 }),
    });
    if (!r.ok) return '';
    const hits = (await r.json()) as Hit[];
    if (!Array.isArray(hits) || !hits.length) return '';
    const blocks = hits.map((h) =>
      `--- Lekce: ${h.title ?? ''} (martinbarna.cz${h.url ?? ''})${NL}${(h.snippet ?? '').trim()}`).join(NL + NL);
    return NL + NL + 'KONTEXT Z LEKCÍ BARNA ACADEMY (tvůj vlastní obsah; použij, jen pokud je k dotazu relevantní):'
      + NL + blocks;
  } catch (_e) {
    return '';
  }
}

Deno.serve(async (req: Request) => {
  const CORS = corsFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, CORS, 405);

  // 1) ČLENSKÁ BRÁNA — jen platící člen Academy. Ne-člen dostane výzvu ke koupi.
  const authz = req.headers.get('Authorization') ?? '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
  if (!(await isMember(token))) return json({ locked: true, reply: UPSELL }, CORS, 200);

  // 2) Klíč se přidá nakonec — do té doby graceful hláška (jen pro členy).
  if (!API_KEY) return json({ reply: 'Za chvíli! AI Martin se právě dokončuje. Mrkni sem brzy. 💪' }, CORS, 200);

  let body: { messages?: Msg[] };
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, CORS, 400); }
  const raw = Array.isArray(body.messages) ? body.messages : [];
  // sanitizace: jen role user/assistant, max 12 zpráv, každá max 2000 znaků
  const msgs = raw.slice(-12).map((m) => {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const text = String(m.text ?? m.content ?? '').slice(0, 2000);
    return { role, content: text };
  }).filter((m) => m.content.trim().length > 0);
  if (!msgs.length) return json({ error: 'empty' }, CORS, 400);
  if (msgs[msgs.length - 1].role !== 'user') return json({ error: 'last_must_be_user' }, CORS, 400);

  // RAG: k poslední uživatelské zprávě dohledej relevantní lekce a přidej je do system promptu.
  const lastUser = msgs[msgs.length - 1].content;
  const ragContext = await retrieveContext(lastUser);
  const system = SYSTEM + ragContext;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 600, system, messages: msgs }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('anthropic_error', res.status, JSON.stringify(data).slice(0, 300));
      return json({ reply: 'Promiň, teď se mi nepodařilo odpovědět. Zkus to za chvíli, nebo mi napiš na WhatsApp.' }, CORS, 200);
    }
    const parts = (data as { content?: { type: string; text?: string }[] }).content ?? [];
    const reply = parts.filter((p) => p.type === 'text').map((p) => p.text ?? '').join(NL).trim()
      || 'Promiň, nemám na to dobrou odpověď. Zkus se zeptat jinak.';
    return json({ reply }, CORS);
  } catch (e) {
    console.error('ai-martin exception', String(e).slice(0, 300));
    return json({ reply: 'Spojení selhalo, zkus to prosím znovu.' }, CORS, 200);
  }
});
