// en-unsubscribe: odhlášení z anglického mailingu (en-mailing), 13. 10. 2026, větev en-mailing-1013.
// Odkaz nese ?e=<email>&t=<token>, token = HMAC-SHA256 e-mailu (./token.ts, kopie v en-mailing/logic.ts).
//
// ⛔ GET NIC NEMĚNÍ, jen přesměruje (302) na webovou stránku https://martinbarna.cz/en/unsubscribe/,
//    kde člověk klikne na tlačítko (= POST sem). Dva důvody, stejné jako u české funkce `unsubscribe`:
//    1) Supabase edge funkce nesmí servírovat HTML (text/html přepíše na text/plain), stránka proto
//       žije na webu; 2) firemní mailové skenery GET-fetchují odkazy z mailů a GET se zápisem by
//       tiše odhlašoval lidi, kteří nic nechtěli.
// ⛔ POST = skutečné odhlášení: One-Click z mailového klienta (RFC 8058, hlavička List-Unsubscribe-Post)
//    i tlačítko na stránce. Zápis do public.en_unsubscribes (idempotentní), odpověď JSON {ok}.
//
// verify_jwt = false (mailový klient žádný JWT nemá). Nasazení: CELÁ složka (index.ts + token.ts).
// Secrets: EN_UNSUB_SECRET (volitelný, MUSÍ být stejný jako u en-mailing), SUPABASE_URL,
//   SUPABASE_SERVICE_ROLE_KEY (dodává platforma).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { deriveUnsubKey, verifyUnsubToken } from "./token.ts";

const PAGE = "https://martinbarna.cz/en/unsubscribe/";
const ALLOW = ["https://martinbarna.cz", "https://www.martinbarna.cz"];

function cors(req: Request): Record<string, string> {
  const o = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOW.includes(o) ? o : ALLOW[0],
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const json = (b: unknown, c: Record<string, string>, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...c, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  const C = cors(req);
  const u = new URL(req.url);
  const email = (u.searchParams.get("e") ?? "").trim().toLowerCase();
  const token = (u.searchParams.get("t") ?? "").trim();

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: C });

  if (req.method === "GET") {
    const q = email && token ? `?e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}` : "";
    return new Response(null, { status: 302, headers: { Location: PAGE + q } });
  }

  if (req.method !== "POST") return json({ ok: false, error: "method" }, C, 405);

  if (!email || !token || email.length > 254 || token.length > 100) return json({ ok: false, error: "link" }, C, 400);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const unsubKey = await deriveUnsubKey(key, Deno.env.get("EN_UNSUB_SECRET"));
  if (!url || !key || !unsubKey) {
    console.error("en-unsubscribe: chybí konfigurace");
    return json({ ok: false, error: "config" }, C, 500);
  }
  if (!(await verifyUnsubToken(email, token, unsubKey))) return json({ ok: false, error: "link" }, C, 400);

  const supa = createClient(url, key, { auth: { persistSession: false } });
  // Idempotentní: opakovaný klik (nebo skener posílající One-Click POST) nic nezdvojí ani nepřepíše datum.
  const { error } = await supa.from("en_unsubscribes")
    .upsert({ email, source: "link" }, { onConflict: "email", ignoreDuplicates: true });
  if (error) {
    // Do logu nikdy e-mail. 500 = mailový klient One-Click zkusí znovu, stránka ukáže chybu.
    console.error("en-unsubscribe: zápis selhal", error.code ?? "", error.message ?? "");
    return json({ ok: false, error: "db" }, C, 500);
  }
  return json({ ok: true }, C);
});
