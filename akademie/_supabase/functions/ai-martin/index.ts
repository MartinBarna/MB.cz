// AI Martin (#53/#68) — chat backend. Deno edge funkce, deploy --no-verify-jwt.
// Frontend: assets/ai-martin.js (POST {messages:[{role:'user'|'assistant', text}]}).
// Vraci {reply}. Persona-based v1 (hned nasaditelne po vlozeni API klice).
// RAG nad korpusem (pgvector) = v2 — viz akademie/_ai/ai-martin-architektura.md.
//
// ┌─ NASTAVENI (Code) ────────────────────────────────────────────────────┐
// │ supabase secrets set ANTHROPIC_API_KEY=sk-ant-...                       │
// │ supabase functions deploy ai-martin --no-verify-jwt                     │
// │ Pak v assets/ai-martin.js: CFG.ENDPOINT = URL funkce, CFG.ENABLED=true. │
// │ Volitelne: AI_MARTIN_MODEL (default nize), AI_MARTIN_ORIGIN (CORS).     │
// └────────────────────────────────────────────────────────────────────────┘

const NL = String.fromCharCode(10);
const API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const MODEL = Deno.env.get('AI_MARTIN_MODEL') ?? 'claude-sonnet-4-6';
const ALLOW_ORIGIN = Deno.env.get('AI_MARTIN_ORIGIN') ?? 'https://martinbarna.cz';

const CORS = {
  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Martinova persona. Drzi styl, hranice (neni lekar) a smeruje na produkty.
const SYSTEM = [
  'Jsi AI Martin — digitalni asistent Martina Barny, ceskeho online vyzivoveho a fitness kouce.',
  'Mluvis jako on: cesky, tykas, prima a vrele, strucne a k veci, bez balastu. Obcas "Be Effective!".',
  'Filozofie: "neprodavam ryby, ucim rybarit", "neni to sprint, ale maraton", veda lidsky a bez myto.',
  'Stavis na zakladech: energeticka bilance, dost bilkovin, silovy trenink, spanek, konzistence. Zadne zazracne diety ani straseni jidlem.',
  'Odpovidej KRATCE (2-5 vet), prakticky, jako v chatu. Kdyz se hodi, navrhni dalsi krok.',
  'HRANICE: Nejsi lekar. U zdravotnich potizi, leku, tehotenstvi, poruch prijmu potravy a podobne vzdy odkaz na lekare/odbornika a nedavej konkretni medicinske rady.',
  'Kdyz nekdo chce jit do hloubky nebo na miru: navrhni videokurz vyzivy (martinbarna.cz/videokurz), generatory zdarma (martinbarna.cz/nastroje-zdarma), nebo osobni koucink (martinbarna.cz).',
  'Nevymyslej si fakta ani konkretni cisla studii. Kdyz necos nevis, priznej to.',
  'Odpovidej VZDY cesky.',
].join(NL);

interface Msg { role?: string; text?: string; content?: string }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!API_KEY) return json({ reply: 'Promin, AI Martin zatim neni zapnuty (chybi API klic). Zkus to za chvili.' }, 200);

  let body: { messages?: Msg[] };
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const raw = Array.isArray(body.messages) ? body.messages : [];
  // sanitizace: jen role user/assistant, max 12 zprav, kazda max 2000 znaku
  const msgs = raw.slice(-12).map((m) => {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const text = String(m.text ?? m.content ?? '').slice(0, 2000);
    return { role, content: text };
  }).filter((m) => m.content.trim().length > 0);
  if (!msgs.length) return json({ error: 'empty' }, 400);
  if (msgs[msgs.length - 1].role !== 'user') return json({ error: 'last_must_be_user' }, 400);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 600, system: SYSTEM, messages: msgs }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('anthropic_error', res.status, JSON.stringify(data).slice(0, 300));
      return json({ reply: 'Promin, ted se mi nepodarilo odpovedet. Zkus to za chvili, nebo mi napis na WhatsApp.' }, 200);
    }
    const parts = (data as { content?: { type: string; text?: string }[] }).content ?? [];
    const reply = parts.filter((p) => p.type === 'text').map((p) => p.text ?? '').join(NL).trim()
      || 'Promin, nemam na to dobrou odpoved. Zkus se zeptat jinak.';
    return json({ reply });
  } catch (e) {
    console.error('ai-martin exception', String(e).slice(0, 300));
    return json({ reply: 'Spojeni selhalo, zkus to prosim znovu.' }, 200);
  }
});
