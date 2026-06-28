import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim().slice(0, 120);
    const segRaw = String(body.segment || "other");
    const segment = ["zeny", "muzi"].includes(segRaw) ? segRaw : "other";
    const source = String(body.source || "lead_magnet").slice(0, 60);
    const goal = String(body.goal || "").slice(0, 200);
    const age = String(body.age || "").slice(0, 30);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "invalid_email" }, 400);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { error } = await supa.from("leads").insert({
      email, name, segment, source,
      meta: { goal, age },
      next_send_at: new Date().toISOString(),
    });
    // 23505 = unique violation (e-mail uz je v seznamu) -> bereme jako uspech (idempotentni)
    if (error && error.code !== "23505") {
      console.error("lead-capture insert error", error);
      return json({ ok: false, error: "db" }, 500);
    }
    return json({ ok: true, duplicate: !!(error && error.code === "23505") });
  } catch (e) {
    console.error("lead-capture exception", e);
    return json({ ok: false, error: "server" }, 500);
  }
});
