// Barna Academy admin-pulse — denni provozni prehled pro admin panel.
// Auth stejne jako admin-api: user JWT + allowlist admin_emails z app_config.
// Vraci: maily dnes (vs stropy), fronta dripu, leadi 7 dni, prodeje, affiliate.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const low = (s: unknown) => String(s ?? "").trim().toLowerCase();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: ures } = await userClient.auth.getUser();
  const me = low(ures?.user?.email);
  const cfg = await admin.from("app_config").select("value").eq("key", "admin_emails").maybeSingle();
  const adminList = String(cfg.data?.value || "fitness.barna@gmail.com").split(",").map((s) => low(s)).filter(Boolean);
  if (!me || !adminList.includes(me)) return json({ error: "forbidden" }, 403);

  try {
    const now = new Date();
    const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
    const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
    const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
    const nowI = now.toISOString();

    const [evToday, gate, due, leads7, ents, refs, credit, wdr] = await Promise.all([
      admin.from("email_events").select("type,detail,created_at").gte("created_at", dayStart.toISOString()),
      admin.from("app_config").select("value").eq("key", "followups_enabled").maybeSingle(),
      admin.from("leads").select("track").eq("status", "active").not("next_send_at", "is", null).lte("next_send_at", nowI),
      admin.from("leads").select("source,created_at").gte("created_at", d7),
      admin.from("entitlements").select("product,active,granted_at,source").eq("active", true),
      admin.from("referrals").select("status"),
      admin.from("referral_credit").select("credit_confirmed,credit_pending"),
      admin.from("withdrawals").select("status"),
    ]);

    const em = { sent: 0, test: 0, error: 0, resend429: 0, last_error: "" };
    for (const e of evToday.data ?? []) {
      if (e.type === "sent") em.sent++;
      else if (e.type === "test") em.test++;
      else if (e.type === "error") {
        em.error++;
        const det = (e.detail && typeof e.detail === "object") ? (e.detail as Record<string, unknown>) : {};
        const msg = String(det.error ?? "");
        if (msg.includes("resend_429")) em.resend429++;
        em.last_error = msg.slice(0, 140);
      }
    }

    const queueByTrack: Record<string, number> = {};
    for (const l of due.data ?? []) queueByTrack[String(l.track)] = (queueByTrack[String(l.track)] ?? 0) + 1;

    const days: Record<string, number> = {};
    const todayBySource: Record<string, number> = {};
    const todayKey = dayStart.toISOString().slice(0, 10);
    for (const l of leads7.data ?? []) {
      const d = String(l.created_at).slice(0, 10);
      days[d] = (days[d] ?? 0) + 1;
      if (d === todayKey) {
        const src = String(l.source ?? "?");
        todayBySource[src] = (todayBySource[src] ?? 0) + 1;
      }
    }

    // 7d/30d pocitame JEN source='simpleshop' (realne prodeje) — wordpress-import ma
    // granted_at = datum importu (29. 6.) a cisla by nesmyslne nafoukl.
    const sales = { videokurz_7d: 0, videokurz_30d: 0, academy_30d: 0, academy_total: 0, videokurz_total: 0 };
    for (const e of ents.data ?? []) {
      const g = String(e.granted_at ?? "");
      const real = e.source === "simpleshop";
      if (e.product === "videokurz") {
        sales.videokurz_total++;
        if (real && g >= d7) sales.videokurz_7d++;
        if (real && g >= d30) sales.videokurz_30d++;
      } else if (e.product === "academy") {
        sales.academy_total++;
        if (real && g >= d30) sales.academy_30d++;
      }
    }

    const withdrawals = { pending: 0, total: (wdr.data ?? []).length };
    for (const w of wdr.data ?? []) if (w.status === "pending") withdrawals.pending++;

    const referral = { confirmed: 0, pending: 0, credit_confirmed: 0, credit_pending: 0 };
    for (const r of refs.data ?? []) {
      if (r.status === "confirmed") referral.confirmed++;
      else if (r.status === "pending") referral.pending++;
    }
    for (const c of credit.data ?? []) {
      referral.credit_confirmed += Number(c.credit_confirmed ?? 0);
      referral.credit_pending += Number(c.credit_pending ?? 0);
    }

    return json({
      ok: true,
      emails_today: { ...em, daily_cap: 50, resend_limit: 100 },
      queue: { due_now: (due.data ?? []).length, by_track: queueByTrack, followups_enabled: (gate.data?.value ?? "") === "true" },
      leads: { days, today_by_source: todayBySource },
      sales,
      referral,
      withdrawals,
    });
  } catch (e) {
    return json({ error: "server", detail: String(e).slice(0, 300) }, 500);
  }
});
