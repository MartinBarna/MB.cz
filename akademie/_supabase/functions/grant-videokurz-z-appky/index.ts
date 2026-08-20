// =============================================================================
// Barna Academy: Edge Function `grant-videokurz-z-appky`.
//
// Appka Tvůj Coach sem po první platbě VIP pošle
// email, user_id, tier, interval, event_id, subscription_id
// a SHARED SECRET v hlavičce `x-academy-secret`
// (stejný vzor jako opačný most `academy-grant`).
// Idempotence je podle event_id (platba), „už má kurz" je druhá pojistka.
// Odsud se udělí videokurz a pošle uvítací mail s přístupem.
//
// ⛔ NEPOSLOUCHÁ STRIPE. Vstup je náš vlastní server-to-server hovor.
// ⛔ KDO MÁ NÁROK, ROZHODUJE APPKA (`shouldGrantVideokurzOnFirstPayment`), ne tahle
//    funkce. Martin 20. 8. 2026: videokurz je bonus JEN k VIP, Basic ho nemá.
//    Text mailu schválil týž den.
//
// Secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
//   app_config.academy_grant_secret  = tentýž řetězec, který appka už má
//                                      v ACADEMY_GRANT_SECRET (most Academy → VIP)
//
// Deploy (až po schválení): --no-verify-jwt
//   New-Item -ItemType Directory -Force supabase\functions\grant-videokurz-z-appky
//   Copy-Item -Force akademie\_supabase\functions\grant-videokurz-z-appky\* `
//     supabase\functions\grant-videokurz-z-appky\
//   npx --yes supabase functions deploy grant-videokurz-z-appky `
//     --project-ref uhmrpfsdcujbhbtumqye --no-verify-jwt
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  GrantError,
  PRODUKTY_S_KURZEM,
  SOURCE,
  escapeIlikeExact,
  type EntitlementRow,
  type GrantDeps,
  handleGrant,
} from "./core.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = "Martin Barna <news@martinbarna.cz>";
const REPLY_TO = "fitness.barna@gmail.com";
const ALERT_FALLBACK = "fitness.barna@gmail.com";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

/** Časově konstantní porovnání. Vzor `app-purchase-bridge` / `academy-grant`. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function nactiSecret(): Promise<string> {
  const { data } = await admin.from("app_config").select("value").eq("key", "academy_grant_secret").maybeSingle();
  return data?.value ? String(data.value) : "";
}

async function alertAdmin(predmet: string, detail: Record<string, unknown>): Promise<void> {
  try {
    await admin.from("email_events").insert({
      lead_id: null, step: 0, type: "error",
      detail: {
        track: "grant-videokurz-z-appky",
        error: predmet + " " + JSON.stringify(detail).slice(0, 300),
      },
    });
  } catch { /* best-effort */ }

  if (!RESEND_KEY) return;
  try {
    let to = ALERT_FALLBACK;
    const { data } = await admin.from("app_config").select("value").eq("key", "admin_emails").maybeSingle();
    if (data?.value) to = String(data.value).split(",")[0].trim() || ALERT_FALLBACK;
    const rows = Object.entries(detail).map(([k, v]) => `<li><b>${k}</b>: ${String(v)}</li>`).join("");
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Barna Academy <news@martinbarna.cz>", to: [to],
        subject: "⚠️ " + predmet,
        html: `<p>Upozornění z grantu videokurzu (Tvůj Coach VIP → Academy).</p><ul>${rows}</ul>`,
      }),
    });
  } catch { /* best-effort */ }
}

function novyToken(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  a[6] = (a[6] & 0x0f) | 0x40;
  a[8] = (a[8] & 0x3f) | 0x80;
  const hex = [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" +
    hex.slice(16, 20) + "-" + hex.slice(20);
}

const deps: GrantDeps = {
  async najdiEntitlementy(email) {
    const { data, error } = await admin
      .from("entitlements")
      .select("email,product,active,expires_at,source")
      .ilike("email", escapeIlikeExact(email))
      .in("product", PRODUKTY_S_KURZEM);
    if (error) throw new Error("db: " + error.message);
    return (data ?? []) as EntitlementRow[];
  },
  async udelEntitlement(row) {
    const { error } = await admin.from("entitlements").upsert(row, { onConflict: "email,product" });
    if (error) throw new Error("db: " + error.message);
  },
  async najdiLeada(email) {
    const { data, error } = await admin
      .from("leads")
      .select("id,name,unsubscribe_token")
      .ilike("email", escapeIlikeExact(email))
      .limit(1);
    if (error) throw new Error("db: " + error.message);
    const r = data?.[0];
    return r
      ? { id: String(r.id), name: r.name ? String(r.name) : null, unsubscribe_token: String(r.unsubscribe_token) }
      : null;
  },
  async zalozLeada(email, name) {
    // ⛔ Trať existujícího leada SE NESAHÁ. Tady zakládáme jen když žádný není,
    //    a next_send_at=null záměrně: jednorázový mail už jde odsud, drip nemá
    //    co posílat. Ticho po tomhle mailu je správně (přístup už má).
    const token = novyToken();
    const { data, error } = await admin.from("leads").insert({
      email,
      name: name || null,
      track: "appka-vip-videokurz",
      step: 0,
      status: "active",
      next_send_at: null,
      purchased: true,
      source: SOURCE,
      unsubscribe_token: token,
    }).select("id,name,unsubscribe_token").limit(1);
    if (error || !data?.[0]) throw new Error("db: " + (error?.message ?? "lead insert"));
    const r = data[0];
    return { id: String(r.id), name: r.name ? String(r.name) : null, unsubscribe_token: String(r.unsubscribe_token) };
  },
  async uzVideliEvent(eventId) {
    const { data, error } = await admin
      .from("email_events")
      .select("id")
      .contains("detail", { track: "grant-videokurz-z-appky", event_id: eventId })
      .limit(1);
    if (error) throw new Error("db: " + error.message);
    return Boolean(data && data.length);
  },
  async uzOdeslanMail(email) {
    const { data: lead, error: leadErr } = await admin
      .from("leads").select("id").ilike("email", escapeIlikeExact(email)).limit(1);
    if (leadErr) throw new Error("db: " + leadErr.message);
    const leadId = lead?.[0]?.id;
    if (!leadId) return false;
    const { data, error } = await admin
      .from("email_events")
      .select("id")
      .eq("lead_id", leadId)
      .eq("type", "sent")
      .contains("detail", { track: "grant-videokurz-z-appky" })
      .limit(1);
    if (error) throw new Error("db: " + error.message);
    return Boolean(data && data.length);
  },
  async posliMail({ to, subject, html, text, unsub }) {
    if (!RESEND_KEY) throw new Error("missing_RESEND_API_KEY");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM, to: [to], subject, html, text, reply_to: REPLY_TO,
        headers: { "List-Unsubscribe": "<" + unsub + ">", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      }),
    });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error("resend_" + res.status + ":" + JSON.stringify(b));
    return (b as { id?: string }).id ?? "";
  },
  async zalogujOdeslani({ leadId, providerId, email, userId, eventId, subscriptionId }) {
    const { error } = await admin.from("email_events").insert({
      lead_id: leadId, step: 0, type: "sent", provider_id: providerId,
      detail: {
        track: "grant-videokurz-z-appky",
        email,
        user_id: userId || null,
        event_id: eventId || null,
        subscription_id: subscriptionId || null,
      },
    });
    if (error && !String(error.code ?? "").includes("23505")) {
      throw new Error("log:" + error.message);
    }
  },
  async zaznamPreskoceni({ eventId, grant }) {
    const { error } = await admin.from("email_events").insert({
      lead_id: null, step: 0, type: "info",
      detail: {
        track: "grant-videokurz-z-appky",
        event_id: eventId || null,
        grant,
        skipped: true,
      },
    });
    if (error) throw new Error("log:" + error.message);
  },
  alert: alertAdmin,
  now: () => new Date(),
  unsubUrl: (token) => SUPABASE_URL + "/functions/v1/unsubscribe?token=" + encodeURIComponent(token),
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const expected = await nactiSecret();
  if (!expected) return json({ error: "grant secret not configured" }, 500);

  const provided = req.headers.get("x-academy-secret") ?? "";
  if (!safeEqual(provided, expected)) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  try {
    const result = await handleGrant(body, deps);
    console.log(
      `[grant-videokurz-z-appky] email=${String(body.email ?? body.buyer_email ?? "-")} ` +
      `user=${String(body.user_id ?? "-")} tier=${String(body.tier ?? "-")} ` +
      `interval=${String(body.interval ?? "-")} event=${String(body.event_id ?? "-")} ` +
      `grant=${result.grant} mail=${result.mail}` +
      (result.duplicate ? " duplicate=true" : ""),
    );
    return json(result);
  } catch (e) {
    if (e instanceof GrantError) return json({ error: e.message }, e.status);
    console.error("[grant-videokurz-z-appky] selhalo:", e);
    await alertAdmin("Most VIP→videokurz: zpracování selhalo", {
      email: String(body.email ?? body.buyer_email ?? "-"),
      chyba: String(e).slice(0, 200),
    });
    return json({ error: "grant failed" }, 500);
  }
});
