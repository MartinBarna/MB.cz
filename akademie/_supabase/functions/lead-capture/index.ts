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
    const phone = String(body.phone || "").trim().slice(0, 40);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "invalid_email" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supa = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { error } = await supa.from("leads").insert({
      email, name, segment, source, phone,   // phone -> vlastni sloupec (Cowork migrace add_phone_to_leads)
      meta: { goal, age },
      next_send_at: new Date().toISOString(),
    });
    // 23505 = unique violation (e-mail uz je v seznamu) -> bereme jako uspech (idempotentni)
    const duplicate = !!(error && error.code === "23505");
    if (error && !duplicate) {
      console.error("lead-capture insert error", error);
      return json({ ok: false, error: "db" }, 500);
    }
    // u duplicitniho e-mailu doplnime telefon, jen kdyz v existujicim leadu chybi (neprepisujeme)
    if (duplicate && phone) {
      await supa.from("leads").update({ phone }).eq("email", email).is("phone", null);
    }

    // OKAMZITE odeslani uvitaciho mailu: spust drip-send rovnou (nove leady maji
    // next_send_at=now() -> jsou hned 'due'). drip-send resi render, skip-purchased,
    // idempotenci i posun kroku. Nova registrace tak dostane mail hned, ne az za hodinu.
    // Fire-and-forget; pripadna chyba neovlivni odpoved (lead je ulozeny).
    if (!duplicate) {
      try {
        const { data: cfg } = await supa.from("app_config").select("value").eq("key", "drip_invoke_secret").maybeSingle();
        const secret = cfg?.value;
        if (secret) {
          const p = fetch(SUPABASE_URL + "/functions/v1/drip-send", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-drip-secret": secret },
            body: JSON.stringify({ limit: 50 }),
          }).catch((e) => console.error("drip trigger fetch failed", e));
          // @ts-ignore EdgeRuntime background task (dorucit i po odeslani odpovedi)
          if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(p);
          else await p;
        }
      } catch (e) { console.error("drip trigger error", e); }
    }

    return json({ ok: true, duplicate });
  } catch (e) {
    console.error("lead-capture exception", e);
    return json({ ok: false, error: "server" }, 500);
  }
});
