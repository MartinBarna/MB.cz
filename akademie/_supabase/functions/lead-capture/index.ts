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
    // Honeypot: pole "website" je skryte, clovek ho nevyplni. Bot ano -> tichy uspech bez zapisu i mailu.
    if (String(body.website || "").trim()) return json({ ok: true });
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim().slice(0, 120);
    const segRaw = String(body.segment || "other");
    const segment = ["zeny", "muzi"].includes(segRaw) ? segRaw : "other";
    // Generatorove leady (lite nastroje) -> vlastni track s vlastni uvitackou.
    // Uvitacka se odklada o 24 h: sablona lead-magnet-tool:0 vznika zvlast; kdyby jeste
    // nebyla, drip-send lead bezpecne zaparkuje (zadny spatny PDF mail jako driv).
    const tool = segRaw === "academy-jidelnicek" ? "jidelnicek" : segRaw === "academy-trenink" ? "trenink" : "";
    const track = tool ? "lead-magnet-tool" : "lead-magnet";
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
      track,
      meta: tool ? { goal, age, tool } : { goal, age },
      next_send_at: new Date(Date.now() + (tool ? 24 * 3600000 : 0)).toISOString(),
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

    // OKAMZITE uvitaci mail: spust drip-send JEN pro tenhle novy lead, ale NIKDY neblokuj odpoved.
    // (Driv bezel 'await' -> nova registrace cekala na drip-send/Resend a formular "zatuhl",
    //  zatimco existujici e-mail tenhle blok preskocil a odpovedel hned. Ted cely drip trigger
    //  vcetne cteni secretu bezi na POZADI pres EdgeRuntime.waitUntil; kdyz neni k dispozici,
    //  fire-and-forget. Fallback: hodinovy cron stejne projede leady s next_send_at=now().)
    if (!duplicate && !tool) {   // tool leady nemaji okamzitou uvitacku (odlozena o 24 h)
      const drip = (async () => {
        try {
          const { data: cfg } = await supa.from("app_config").select("value").eq("key", "drip_invoke_secret").maybeSingle();
          const secret = cfg?.value;
          if (!secret) return;
          await fetch(SUPABASE_URL + "/functions/v1/drip-send", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-drip-secret": secret },
            body: JSON.stringify({ only_email: email }),   // jen tenhle novy lead -> bez duplicit pri navalu
          });
        } catch (e) { console.error("drip trigger error", e); }
      })();
      // @ts-ignore EdgeRuntime background task (dobehne i po odeslani odpovedi, neblokuje klienta)
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(drip);
    }

    return json({ ok: true, duplicate });
  } catch (e) {
    console.error("lead-capture exception", e);
    return json({ ok: false, error: "server" }, 500);
  }
});
