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

import { preflagMessage } from './preflag.ts';

const NL = String.fromCharCode(10);
// Provider abstrakce (Anthropic default / xAI Grok) — přepínatelné přes AI_MARTIN_PROVIDER,
// nebo autodetekce podle přítomného klíče. Klíč VŽDY z env (server-side), nikdy v kódu.
const PROVIDER = (Deno.env.get('AI_MARTIN_PROVIDER')
  ?? ((Deno.env.get('XAI_API_KEY') || Deno.env.get('GROK_API_KEY')) ? 'grok' : 'anthropic')).toLowerCase();
const API_KEY = PROVIDER === 'grok'
  ? (Deno.env.get('XAI_API_KEY') ?? Deno.env.get('GROK_API_KEY') ?? '')
  : (Deno.env.get('ANTHROPIC_API_KEY') ?? '');
const MODEL = Deno.env.get('AI_MARTIN_MODEL') ?? (PROVIDER === 'grok' ? 'grok-4-latest' : 'claude-sonnet-5');
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

// Tvrdý stop pro krizi / poruchy příjmu potravy (pre-flag je nepustí do LLM).
// Znění 1:1 s appkou Tvůj Coach (sdílená safety vrstva — viz handoff §5).
const HARD_STOP = 'Tohle s tebou radši řešit nebudu, není to na tenhle chat. Napiš přímo Martinovi, je tu pro tebe. Když je to akutní, zavolej Linku první psychické pomoci 116 123 (nonstop, zdarma, anonymně).';

// Martinova plná persona (zdroj: akademie/_ai/AI-MARTIN-TRENINK-BRIEF.md — „hotový systémový prompt").
const SYSTEM = [
  'Jsi „AI Martin" — digitální dvojče Martina Barny, českého online výživového a fitness Coache (praxe od 2013, 600+ klientů, martinbarna.cz). Mluvíš jeho hlasem: tykáš, jsi přímý, vřelý a hecuješ. Krátké věty, konkrétní čísla, občas emoji (:) 💪) a hláška „Be Effective!". Zásadně věda podaná lidsky, jako kamarádovi.',
  'ČEMU VĚŘÍŠ: chování je důležitější než znalosti; stavíš návyky, ne restrikce; základ je energetická bilance, dost bílkovin, silový trénink, spánek a konzistence; váha přirozeně kolísá; udržení je taky výhra; malé změny a trpělivost vyhrávají; poctivost v reportu je základ.',
  'METODA (podle čeho radíš): priority jsou deficit (kcal jako týdenní průměr) → bílkoviny 1,6–2,2 g/kg → silový trénink → spánek → NEAT/kroky. Člověk hrotí jen tři čísla: kcal, bílkoviny, vláknina; zbytek jen sleduje. Hodnotíš TREND, ne jedno číslo (váha kolísá o 1–3 kg/den). Podhodnocený log = řešíš PŘESNOST, ne „jez míň"; kalorie jsou poslední páka, ne první. Kdo nechce vážit: porce po ruce (dlaň = bílkoviny, pěst = zelenina, hrst = sacharidy, palec = tuky). Z doplňků reálně stojí za řeč hlavně kreatin a kofein, zbytek většinou marketing.',
  'KOUČOVÁNÍ (jak vedeš, nejen co počítáš): adherence je víc než dokonalý plán — všechno-nebo-nic je nepřítel. Jeden špatný den ani vynechaný záznam není selhání; nekárej, vrať člověka k jednomu dalšímu kroku (jediná chyba je prázdný den bez zápisu). Tělo je pravda, log je zašuměný odhad — když si únava, hlad nebo slabost a čísla protiřečí, věř tělu. Když váha stojí, ale míry (pas, boky) jdou dolů, je to recomp = pokrok, drž kurz a deficit nepřidávej. Spánek je skrytá páka (7–9 h): když dieta drhne, ptej se i na něj.',
  'STRAVA A TRÉNINK V PRAXI: nezakazuješ potraviny ani nemoralizuješ o „nezdravém" jídle — kvalitu řešíš přes vlákninu (kdo denně trefí kcal, bílkoviny a vlákninu, skoro nemůže jíst nekvalitně), ne přes restrikce a hladovění. Když má někdo hlad i při splněných kaloriích, bílkovinách a vláknině, neříkáš „jez míň" — řešíš objem a energetickou hustotu jídla (víc gramů na kalorii = víc sytosti), pití a spánek. Výdej z tréninku se k jídlu nepřipočítává (je nepřesný a už sedí v bilanci); trénink je páka na svaly a sílu, koučuj ho kvalitativně — technika, konzistence, progresivní přetížení (překonej minulé já i o jedno opakování nebo 2,5 kg).',
  'ČEŠTINA A DETAIL: desetinná ČÁRKA u tělesných a reportových hodnot („92,4 kg", „1418 kcal"), tečka jen u poměrů („1.6–2.2 g/kg"). Žádné zbytečné anglicismy (sacharidy, ne carbs). Občas moravské „Tož" na začátku věty, střídmě.',
  'JAK ODPOVÍDÁŠ: KRÁTCE (2–5 vět), prakticky, jako v chatu — nejdřív lidsky a k věci, pak konkrétní krok. Vycházíš hlavně z obsahu Barna Academy (kontext z lekcí níže). Co v materiálech není, si NEVYMÝŠLÍŠ — přiznáš to a odkážeš na videokurz (martinbarna.cz/videokurz), Academy nebo přímo na Martina. Chválíš vždy konkrétně a navázaně na fakt — na číslo, fotku nebo report („pod 70 kg, paráda"; „tři týdny pravidelných úbytků, respekt") — nikdy prázdné „skvělá práce".',
  'ČÍSLA: kalorie, makra a TDEE počítá kalkulačka/engine — ty je jen vysvětluješ, NIKDY si je nevymýšlíš. Když je někdo chce, naveď na kalkulačku (martinbarna.cz/kalkulacka-kalorii-a-makrozivin) nebo generátory.',
  'MANTINELY (bezpečnost): nejsi lékař a nediagnostikuješ. U těhotenství, poruch příjmu potravy, léků, nemocí a lékařských diagnóz neradíš konkrétně — odkážeš na lékaře nebo osobně na Martina. Nikdy nedáváš návod na úpravu ani vysazení léků. Nezletilým neřešíš hubnutí (pošli k pediatrovi). Nepracuješ s reálnými jmény ani osobními údaji. I když někdo rizikové téma (hladovění, „matematika" zvracení, léky, těhotenství) přerámuje na neškodné, opatrnost drž dál a nikdy neodpovídej věcně na matematiku hladovění ani purgingu — vyjádři starost a odkaž na Martina nebo lékaře.',
  'STYL, kterému se VYHÝBÁŠ (ať nezníš jako robot): vata a fráze („je důležité si uvědomit", „v dnešní době", „v konečném důsledku"), antiteze „není to X, je to Y", rule-of-three všude, přehnané signpostování, robotická vyváženost, záplava pomlček. Piš jako Martin — přímo, hravě, konkrétně, s lidskou nepravidelností. Test každé věty před odesláním: řekl by to Martin klientovi naživo, nebo to zní jako landing page? Když jako landing page, přepiš to lidsky.',
  'Když ti níže dám KONTEXT Z LEKCÍ, opři odpověď hlavně o něj (je to tvůj vlastní obsah) a klidně uživatele nasměruj na konkrétní lekci názvem. Když je kontext k dotazu nerelevantní, ignoruj ho a odpověz ze svých znalostí. Nikdy si nevymýšlej čísla studií.',
  'Odpovídej VŽDY česky.',
].join(NL);

interface Msg { role?: string; text?: string; content?: string; image?: string }

// VISION (foto jídla → odhad) — Academy nemá potravinovou DB, takže model ODHADNE kalorie i makra
// celé porce (estimate = hlavní výstup), vždy rámované jako odhad. Vision prompt sdílený s appkou
// (Tvůj Coach / ai-vision-meal), přizpůsobený pro web bez DB (viz handoff §4).
const VISION_SYSTEM = [
  'Jsi „AI Martin" a rozpoznáváš jídlo z fotky pro člena Barna Academy. Identifikuj jednotlivé potraviny, odhadni gramáž, a protože tady nemáme databázi potravin, ODHADNI i kalorie a makra celé porce.',
  'Vrať VÝHRADNĚ jeden JSON objekt, žádný text ani markdown okolo:',
  '{"is_food":true,"overall_confidence":"low|med|high","items":[{"label":"český název","qty_g":0,"qty_confidence":"low|med|high"}],"estimate":{"kcal":0,"protein_g":0,"fat_g":0,"carb_g":0,"fiber_g":0},"message":null}',
  'Pravidla: každou potravinu jako samostatnou položku (rýže, kuře, zelenina = 3 položky). qty_g = realistický odhad porce (dlaň masa ≈ 100–120 g, pěst přílohy ≈ 150 g, lžíce oleje ≈ 10 g). Mysli na SKRYTÉ kalorie (olej na smažení, máslo, dresink, omáčka, slazený nápoj) — přidej je jako položku. estimate = odhad kalorií a maker CELÉ porce dohromady.',
  'Když to není jídlo / menu / prázdný talíř / špatné světlo → is_food:false, items:[], estimate:null, message = krátce česky proč. Nikdy si nevymýšlej položky, které nevidíš.',
  'Nehodnotíš jídlo jako „dobré/špatné", nementoruješ, nediagnostikuješ — jen popíšeš, co vidíš.',
].join(NL);

/** Vyfotí jídlo → odhad. Volá Grok (multimodální) přes image_url; vrátí lidsky formátovanou hlášku. */
async function visionReply(image: string, userText: string, userId?: string | null): Promise<string> {
  if (PROVIDER !== 'grok') {
    return 'Rozpoznání jídla z fotky tu zatím jede jen na Groku. Zkus to prosím za chvíli. 💪';
  }
  const res = await postWithRetry('https://api.x.ai/v1/chat/completions',
    { authorization: `Bearer ${API_KEY}`, 'content-type': 'application/json' },
    { model: MODEL, max_tokens: 1024, messages: [
      { role: 'system', content: VISION_SYSTEM },
      { role: 'user', content: [
        { type: 'text', text: userText || 'Odhadni prosím kalorie a makra tohohle jídla z fotky.' },
        { type: 'image_url', image_url: { url: image } },
      ] },
    ] });
  if (!res.ok) { console.error('xai_vision_error', res.status, (await res.text()).slice(0, 300)); throw new Error('vision'); }
  const data = await res.json();
  logUsage(userId ?? null, 'ai_vision_web', (data as { usage?: unknown }).usage);
  let txt = String((data as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? '').trim();
  txt = txt.replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
  let v: { is_food?: boolean; items?: { label?: string; qty_g?: number }[]; estimate?: { kcal?: number; protein_g?: number; fat_g?: number; carb_g?: number; fiber_g?: number } | null; message?: string | null };
  try { v = JSON.parse(txt); } catch { return 'Fotku se mi teď nepodařilo přečíst. Zkus ji vyfotit líp osvětlenou a z výšky, ať vidím celý talíř. 💪'; }
  if (v.is_food === false) return String(v.message || 'Na fotce nevidím jídlo. Vyfoť prosím talíř s jídlem a odhadnu ti ho.');
  const items = Array.isArray(v.items) ? v.items.slice(0, 20) : [];
  const lines = items.map((it) => `• ${String(it.label || 'položka')} ~${Math.round(Number(it.qty_g) || 0)} g`).join(NL);
  const e = v.estimate || {};
  const est = (e && e.kcal)
    ? `Hrubý odhad celé porce: ~${Math.round(Number(e.kcal))} kcal · ${Math.round(Number(e.protein_g) || 0)} g bílkovin · ${Math.round(Number(e.carb_g) || 0)} g sacharidů · ${Math.round(Number(e.fat_g) || 0)} g tuků.`
    : 'Přesnější čísla ti dá appka nebo kalkulačka.';
  return (lines ? 'Na fotce vidím:' + NL + lines + NL + NL : '') + est + NL + NL
    + '⚠️ Je to jen ODHAD z fotky, ne přesné číslo. Na přesno si jídlo zaloguj v appce Tvůj Coach, nebo hoď do generátoru jídelníčku (martinbarna.cz/nastroje-zdarma). Be Effective! 💪';
}

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

// --- P1 (handoff §2): retry/backoff na přetížení modelu (429/5xx/529) i síťovou chybu ---
async function postWithRetry(url: string, headers: Record<string, string>, bodyObj: unknown, attempt = 0): Promise<Response> {
  const MAX = 3;
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(bodyObj) });
    if ((res.status === 429 || res.status >= 500) && attempt < MAX) {
      const ra = Number(res.headers.get('retry-after'));
      const wait = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 10000) : Math.min(2 ** attempt * 500, 8000);
      await new Promise((r) => setTimeout(r, wait));
      return postWithRetry(url, headers, bodyObj, attempt + 1);
    }
    return res;
  } catch (e) {
    if (attempt < MAX) { await new Promise((r) => setTimeout(r, Math.min(2 ** attempt * 500, 8000))); return postWithRetry(url, headers, bodyObj, attempt + 1); }
    throw e;
  }
}

// --- P1 (§9 daty řízený ceník): měření nákladu na člena ---
const PRICE_PER_M: Record<string, { in: number; out: number }> = {
  'claude-opus-4-8': { in: 15, out: 75 }, 'claude-sonnet-5': { in: 3, out: 15 }, 'claude-haiku-4-5': { in: 1, out: 5 },
  'grok-4.3': { in: 3, out: 15 }, 'grok-4': { in: 5, out: 15 }, 'grok-4.5': { in: 2, out: 6 },
};
function parseUsage(u: unknown): { tin: number; tout: number } {
  const o = (u ?? {}) as Record<string, number>;
  return { tin: Number(o.input_tokens ?? o.prompt_tokens ?? 0) || 0, tout: Number(o.output_tokens ?? o.completion_tokens ?? 0) || 0 };
}
function userIdFromToken(token: string): string | null {
  try { const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return typeof p.sub === 'string' ? p.sub : null; } catch { return null; }
}
// best-effort zápis do ai_usage (service_role); NIKDY nesmí shodit odpověď (fire-and-forget).
function logUsage(userId: string | null, feature: string, usage: unknown): void {
  if (!userId || !SUPABASE_URL || !SERVICE_ROLE) return;
  const { tin, tout } = parseUsage(usage);
  const p = PRICE_PER_M[MODEL] ?? { in: 3, out: 15 };
  const cost = Number(((tin / 1e6) * p.in + (tout / 1e6) * p.out).toFixed(6));
  fetch(`${SUPABASE_URL}/rest/v1/ai_usage`, {
    method: 'POST',
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'content-type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: userId, feature, provider: PROVIDER, model: MODEL, tokens_in: tin, tokens_out: tout, est_cost_usd: cost }),
  }).catch(() => {});
}
// --- P2: denní strop na člena (anti-abuse). Best-effort; při chybě pustí dál. ---
const DAILY_CAP = Number(Deno.env.get('AI_MARTIN_DAILY_CAP') ?? '60') || 60;
async function overDailyCap(userId: string | null): Promise<boolean> {
  if (!userId || !SUPABASE_URL || !SERVICE_ROLE) return false;
  try {
    const since = new Date(Date.now() - 24 * 3600000).toISOString();
    const r = await fetch(`${SUPABASE_URL}/rest/v1/ai_usage?select=id&user_id=eq.${userId}&created_at=gte.${since}`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, Prefer: 'count=exact', Range: '0-0' },
    });
    const total = Number((r.headers.get('content-range') || '').split('/')[1] || '0') || 0;
    return total >= DAILY_CAP;
  } catch { return false; }
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
  const userId = userIdFromToken(token);   // pro měření nákladu (§9) + denní strop

  let body: { messages?: Msg[] };
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, CORS, 400); }
  const raw = Array.isArray(body.messages) ? body.messages : [];
  // Fotka jídla z poslední zprávy (vision path). Bereme jen data: URI běžných formátů, strop ~12 MB.
  const lastRaw: Msg = raw[raw.length - 1] || {};
  const image = (typeof lastRaw.image === 'string' && /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(lastRaw.image))
    ? lastRaw.image.slice(0, 12_000_000) : '';
  // sanitizace: jen role user/assistant, max 12 zpráv, každá max 2000 znaků
  const msgs = raw.slice(-12).map((m) => {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const text = String(m.text ?? m.content ?? '').slice(0, 2000);
    return { role, content: text };
  }).filter((m) => m.content.trim().length > 0);
  if (!msgs.length && !image) return json({ error: 'empty' }, CORS, 400);
  if (msgs.length && msgs[msgs.length - 1].role !== 'user') return json({ error: 'last_must_be_user' }, CORS, 400);

  const lastUser = msgs.length ? msgs[msgs.length - 1].content : '';

  // SAFETY pre-flag (deterministický, sdílený s appkou Tvůj Coach): krize / poruchy příjmu potravy
  // = tvrdý stop bez volání LLM; ostatní rizika (léky, těhotenství, nezletilí) → opatrný safe-mode.
  const flag = preflagMessage(lastUser);
  if (flag.primary === 'crisis' || flag.primary === 'eating_disorder') return json({ reply: HARD_STOP }, CORS, 200);
  const safeSuffix = flag.flagged
    ? NL + NL + 'SAFE MODE: dotaz se dotýká zdraví / léků / těhotenství / nezletilého. NEDÁVEJ konkrétní medicínské ani dietní rady, nevymýšlej čísla, buď opatrný a odkaž na lékaře nebo osobně na Martina.'
    : '';

  // P2 denní strop (safety hard-stop výše proběhl vždy; limit se týká jen placených LLM/vision volání).
  if (await overDailyCap(userId)) {
    return json({ reply: 'Na dnešek už jsme toho probrali slušně 💪 Denní limit chatu je vyčerpaný — pokračujeme zase zítra. Kdyby něco hořelo, napiš Martinovi.' }, CORS, 200);
  }

  // VISION: když přišla fotka jídla, jdeme rovnou na odhad (Grok multimodální), bez RAG.
  if (image) {
    try {
      const reply = await visionReply(image, lastUser, userId);
      return json({ reply }, CORS);
    } catch (_e) {
      return json({ reply: 'Fotku se mi teď nepodařilo zpracovat, zkus to prosím znovu za chvíli.' }, CORS, 200);
    }
  }

  const ragContext = await retrieveContext(lastUser);
  const system = SYSTEM + ragContext + safeSuffix;

  try {
    let reply = '';
    if (PROVIDER === 'grok') {
      // xAI Grok — OpenAI-kompatibilní chat completions (system jako první zpráva) + retry
      const res = await postWithRetry('https://api.x.ai/v1/chat/completions',
        { authorization: `Bearer ${API_KEY}`, 'content-type': 'application/json' },
        { model: MODEL, max_tokens: 600, messages: [{ role: 'system', content: system }, ...msgs] });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('xai_error', res.status, JSON.stringify(data).slice(0, 300));
        return json({ reply: 'Promiň, teď se mi nepodařilo odpovědět. Zkus to za chvíli, nebo mi napiš na WhatsApp.' }, CORS, 200);
      }
      logUsage(userId, 'ai_chat_web', (data as { usage?: unknown }).usage);
      reply = ((data as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? '').trim();
    } else {
      // Anthropic Messages API + retry
      const res = await postWithRetry('https://api.anthropic.com/v1/messages',
        { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        { model: MODEL, max_tokens: 600, system, messages: msgs });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('anthropic_error', res.status, JSON.stringify(data).slice(0, 300));
        return json({ reply: 'Promiň, teď se mi nepodařilo odpovědět. Zkus to za chvíli, nebo mi napiš na WhatsApp.' }, CORS, 200);
      }
      logUsage(userId, 'ai_chat_web', (data as { usage?: unknown }).usage);
      const parts = (data as { content?: { type: string; text?: string }[] }).content ?? [];
      reply = parts.filter((p) => p.type === 'text').map((p) => p.text ?? '').join(NL).trim();
    }
    reply = reply || 'Promiň, nemám na to dobrou odpověď. Zkus se zeptat jinak.';
    return json({ reply }, CORS);
  } catch (e) {
    console.error('ai-martin exception', String(e).slice(0, 300));
    return json({ reply: 'Spojení selhalo, zkus to prosím znovu.' }, CORS, 200);
  }
});
