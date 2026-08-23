// DOCASNA: zavola xAI s modelem z ?m= a vrati, co REALNE odpovedelo (pole "model"). Po pouziti smazat.
Deno.serve(async (req) => {
  const key = Deno.env.get('XAI_API_KEY') ?? Deno.env.get('GROK_API_KEY') ?? '';
  const want = new URL(req.url).searchParams.get('m') || 'grok-4.5';
  const r = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: want, max_tokens: 20, messages: [{ role: 'user', content: 'Odpovez jen: ok' }] }),
  });
  const j = await r.json().catch(() => ({}));
  return new Response(JSON.stringify({
    poslano: want,
    http: r.status,
    model_ktery_odpovedel: j?.model ?? null,
    text: j?.choices?.[0]?.message?.content ?? null,
    chyba: j?.error ?? null,
    env_AI_MARTIN_MODEL: Deno.env.get('AI_MARTIN_MODEL') ?? '(nenastaveno)',
  }, null, 1), { headers: { 'Content-Type': 'application/json' } });
});
