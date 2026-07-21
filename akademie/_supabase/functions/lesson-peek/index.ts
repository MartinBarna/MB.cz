// lesson-peek — otevře JEDNU lekci Academy klientovi koučinku bez koupené Academy,
// pokud přijde s podepsaným klíčem z AI Martina (?ak=exp.podpis v URL lekce).
// POST { lesson_id, ak } + Authorization: Bearer <JWT přihlášeného klienta>.
// Klíč: HMAC-SHA256(secret, `${lesson_id}|${email}|${exp}`), secret = app_config.lesson_peek_secret.
// Je vázaný na konkrétní lekci, konkrétní e-mail a čas — přeposlaný odkaz cizímu člověku nefunguje.
// Brána navíc: volající musí mít aktivní entitlement 'coaching' (Academy člen klíč nepotřebuje,
// čte lekce normálně přes RLS; nikdo jiný nemá co nakukovat).
// Zadal Martin 21. 7. 2026: „když lekci odkáže přímo AI Martin na dotaz, zobraz ji i bez Academy."
// Deploy: supabase functions deploy lesson-peek --no-verify-jwt
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED = ["https://martinbarna.cz", "https://www.martinbarna.cz"];
function cors(req: Request) {
  const o = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(o) ? o : ALLOWED[0],
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const json = (b: unknown, c: Record<string, string>, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...c, "Content-Type": "application/json" } });

const LESSON_ID_RE = /^m[0-9]{1,3}-l[0-9]{1,3}$/;

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const C = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: C });
  if (req.method !== "POST") return json({ error: "method" }, C, 405);

  // 1) identita: platný JWT přihlášeného člověka (auth.getUser, ne jen dekódování payloadu)
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  if (!token) return json({ error: "auth" }, C, 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: udata } = await userClient.auth.getUser(token);
  const email = (udata?.user?.email ?? "").toLowerCase();
  if (!email) return json({ error: "auth" }, C, 401);

  // 2) vstup
  let body: { lesson_id?: string; ak?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, C, 400); }
  const lessonId = String(body.lesson_id ?? "").trim();
  const ak = String(body.ak ?? "").trim();
  if (!LESSON_ID_RE.test(lessonId)) return json({ error: "bad_lesson" }, C, 400);
  const m = ak.match(/^(\d{1,12})\.([0-9a-f]{64})$/);
  if (!m) return json({ error: "bad_key" }, C, 400);
  const exp = Number(m[1]);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return json({ error: "expired" }, C, 403);

  // 3) podpis: klíč musel podepsat AI Martin právě pro tuhle lekci a tenhle e-mail
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: secretRow } = await admin.from("app_config").select("value").eq("key", "lesson_peek_secret").maybeSingle();
  const secret = secretRow?.value ? String(secretRow.value) : "";
  if (!secret) return json({ error: "no_secret" }, C, 500);
  const expected = await hmacHex(secret, `${lessonId}|${email}|${exp}`);
  if (expected !== m[2]) return json({ error: "bad_key" }, C, 403);

  // 4) peek je jen pro klienty koučinku (RPC běží pod JWT volajícího)
  const { data: ent } = await userClient.rpc("has_entitlement", { p_product: "coaching" });
  if (ent !== true) return json({ error: "no_coaching" }, C, 403);

  // 5) obsah lekce (service role — RLS by volajícího bez Academy nepustila, přesně proto jsme tady)
  const { data: lc } = await admin.from("lesson_content").select("html").eq("lesson_id", lessonId).maybeSingle();
  if (!lc?.html) return json({ error: "not_found" }, C, 404);
  return json({ html: lc.html }, C);
});
