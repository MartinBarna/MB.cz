// Resend webhook → email_events (open / bounce / complaint) + stav leadu.
// Zapoji se v Resend dashboardu: Webhooks → Add endpoint →
//   https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/resend-webhook
//   eventy: email.opened, email.bounced, email.complained
// Podpisovy secret (whsec_...) MUSI byt v app_config klici 'resend_webhook_secret' —
// dokud tam neni, funkce vraci 503 a NIC nezapisuje (fail closed: podvrzeny bounce
// by jinak umel vypnout mailing celym leadum).
// Funkce musi byt nasazena s verify_jwt = false (externi webhook nema Supabase JWT).
//
// Pozn. k open rate: drip-send posila archivni BCC kopii se STEJNYM Resend id —
// kdyz Martin otevre archiv, zapocita se open leadovi. Metriku ber orientacne,
// dokud se archivace nepreveda na samostatny send.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

// Svix podpis: HMAC-SHA256(base64-dekodovany secret za 'whsec_', `${id}.${ts}.${payload}`) → base64.
// Hlavicka svix-signature = mezerami oddelene varianty "v1,<base64sig>".
async function verifySvix(secret: string, id: string, ts: string, payload: string, sigHeader: string): Promise<boolean> {
  try {
    if (!id || !ts || !sigHeader) return false;
    const age = Math.abs(Date.now() / 1000 - Number(ts));
    if (!Number.isFinite(age) || age > 600) return false; // replay okno 10 min
    const key = secret.startsWith("whsec_") ? secret.slice(6) : secret;
    const raw = Uint8Array.from(atob(key), (c) => c.charCodeAt(0));
    const ck = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", ck, new TextEncoder().encode(id + "." + ts + "." + payload)));
    let b = ""; for (const x of mac) b += String.fromCharCode(x);
    const expected = btoa(b);
    return sigHeader.split(" ").some((s) => {
      const p = s.split(",");
      return p.length === 2 && p[0] === "v1" && p[1] === expected;
    });
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const payload = await req.text();
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // FAIL CLOSED: bez secretu nic neprijimame (jinak by podvrzeny bounce vypinal mailing)
  const { data: cfg } = await admin.from("app_config").select("value").eq("key", "resend_webhook_secret").maybeSingle();
  const secret = String(cfg?.value || "");
  if (!secret) return json({ error: "not_configured" }, 503);
  const ok = await verifySvix(
    secret,
    req.headers.get("svix-id") || "",
    req.headers.get("svix-timestamp") || "",
    payload,
    req.headers.get("svix-signature") || "",
  );
  if (!ok) return json({ error: "bad_signature" }, 401);

  let ev: { type?: string; data?: { email_id?: string; to?: string | string[] } };
  try { ev = JSON.parse(payload); } catch { return json({ error: "bad_json" }, 400); }

  const map: Record<string, string> = { "email.opened": "open", "email.bounced": "bounce", "email.complained": "complaint" };
  const t = map[String(ev?.type || "")];
  if (!t) return json({ ok: true, ignored: String(ev?.type || "") });

  const emailId = String(ev?.data?.email_id || "");
  if (!emailId) return json({ ok: true, ignored: "no_email_id" });

  // dohledej puvodni event pres Resend id — 'sent' (ostry mail leadovi) i 'test'
  const { data: orig } = await admin.from("email_events")
    .select("lead_id,step,type,detail").eq("provider_id", emailId).in("type", ["sent", "test"]).limit(1).maybeSingle();

  const isTest = orig?.type === "test";
  const lead_id = (!isTest && orig?.lead_id) ? (orig.lead_id as string) : null;
  const step = orig?.step == null ? null : Number(orig.step);
  const baseDetail = (orig?.detail && typeof orig.detail === "object") ? (orig.detail as Record<string, unknown>) : {};
  const track = String(baseDetail.track ?? "");
  const detail = { ...baseDetail, via: "resend-webhook", of: isTest ? "test" : "sent" };

  // dedup: open staci jednou za mail — pres (lead, step, track) u leadu, pres provider_id jinak
  if (t === "open") {
    let dq = admin.from("email_events").select("id").eq("type", "open").limit(1);
    if (lead_id && step != null) dq = dq.eq("lead_id", lead_id).eq("step", step).eq("detail->>track", track);
    else dq = dq.eq("provider_id", emailId);
    const { data: dup } = await dq;
    if (dup && dup.length) return json({ ok: true, dedup: true });
  }

  await admin.from("email_events").insert({ lead_id, step: step ?? 0, type: t, provider_id: emailId, detail });

  // bounce = nedorucitelna adresa, complaint = spam → stop mailingu.
  // Status menime JEN pri overenem sparovani na ostry 'sent' event (test/nesparovane nikdy).
  if ((t === "bounce" || t === "complaint") && lead_id) {
    await admin.from("leads").update({
      status: t === "bounce" ? "bounced" : "unsubscribed",
      next_send_at: null,
      updated_at: new Date().toISOString(),
    }).eq("id", lead_id);
  }
  return json({ ok: true, type: t });
});
