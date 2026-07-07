// Barna Academy — checkin-capture: přijme týdenní check-in, spočítá věrnostní kredit,
// vybere "doporučení na míru" (coaching_rules) a vrátí ho rovnou frontendu.
// Režimy: POST check-in (z /akademie/check-in/) | POST {mode:'remind'}+x-drip-secret (týdenní cron)
//         | GET ?stop=<reminder_token> (opt-out z připomínek).
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SITE = "https://martinbarna.cz";
const FROM = "Martin Barna <news@martinbarna.cz>";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-drip-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const low = (s: unknown) => String(s ?? "").trim().toLowerCase();
const esc = (s: string) => String(s).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;");
const num = (x: unknown) => (x === "" || x == null || isNaN(Number(x)) ? null : Number(x));

function wrapHtml(preheader: string, body: string, footerHtml: string): string {
  return `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head>` +
    `<body style='margin:0;background:#f4f4f5;padding:16px'>` +
    `<span style='display:none!important;opacity:0;color:transparent'>${esc(preheader)}</span>` +
    `<div style='font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#222;max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:28px'>` +
    body +
    `<hr style='border:none;border-top:1px solid #eee;margin:22px 0 14px'>` +
    `<div style='font-size:12px;line-height:1.5;color:#999'>${footerHtml}</div></div></body></html>`;
}
const btn = (text: string, href: string) =>
  `<p style='margin:6px 0 16px'><a href='${href}' style='display:inline-block;background:#ff7a00;color:#161616;text-decoration:none;padding:13px 24px;border-radius:50px;font-weight:700'>${esc(text)}</a></p>`;

async function sendResend(to: string, subject: string, html: string, text: string, replyTo: string): Promise<void> {
  if (!RESEND_API_KEY) throw new Error("no_resend_key");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text, reply_to: replyTo || undefined }),
  });
  if (!res.ok) throw new Error("resend_" + res.status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: cfgRows } = await admin.from("app_config").select("key,value")
    .in("key", ["footer_html", "reply_to_email", "drip_invoke_secret", "coach_credit_per_checkin", "coach_milestone_2cm_bonus", "coach_credit_cap_czk"]);
  const cfg = Object.fromEntries((cfgRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  const perCheckin = Number(cfg.coach_credit_per_checkin ?? 30) || 30;
  const milestoneBonus = Number(cfg.coach_milestone_2cm_bonus ?? 100) || 100;
  const cap = Number(cfg.coach_credit_cap_czk ?? 400) || 400;
  const replyTo = cfg.reply_to_email ?? "";
  const footerHtml = cfg.footer_html ?? "Barna Academy — Martin Barna · martinbarna.cz";

  // ---- OPT-OUT (GET ?stop=<reminder_token>) ----
  if (req.method === "GET") {
    const token = new URL(req.url).searchParams.get("stop") ?? "";
    if (token) {
      await admin.from("discount_credits").update({ reminders_off: true, updated_at: new Date().toISOString() }).eq("reminder_token", token);
    }
    return new Response(
      `<!doctype html><meta charset='utf-8'><body style='font-family:sans-serif;background:#161616;color:#eee;text-align:center;padding:60px 20px'>` +
      `<h2 style='color:#ff9d3c'>Hotovo ✓</h2><p>Týdenní připomínky check-inu jsou vypnuté. Vyplnit ho můžeš dál kdykoliv.</p>` +
      `<p><a href='${SITE}/akademie/moje/' style='color:#ff9d3c'>← Zpět do Academy</a></p></body>`,
      { headers: { "Content-Type": "text/html; charset=utf-8", ...CORS } },
    );
  }

  if (req.method !== "POST") return json({ error: "method" }, 405);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // ---- REMINDER MODE (týdenní cron) ----
  if (body.mode === "remind") {
    const secret = req.headers.get("x-drip-secret") ?? "";
    if (!cfg.drip_invoke_secret || secret !== cfg.drip_invoke_secret) return json({ error: "unauthorized" }, 401);
    const now = Date.now();
    // kdo je v loopu: má aspoň 1 check-in, reminders zapnuté; připomeň, když poslední check-in 6–45 dní zpět
    const { data: creds } = await admin.from("discount_credits").select("email,reminder_token").eq("reminders_off", false);
    let sent = 0; const MAX = 40;
    for (const c of (creds ?? [])) {
      if (sent >= MAX) break;
      const email = low(c.email);
      const { data: last } = await admin.from("member_checkins").select("created_at").eq("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!last) continue;
      const days = (now - Date.parse(String(last.created_at))) / 86400000;
      if (days < 6 || days > 45) continue;
      const stop = SUPABASE_URL + "/functions/v1/checkin-capture?stop=" + encodeURIComponent(String(c.reminder_token));
      const foot = footerHtml + ` · <a href='${stop}' style='color:#999'>Vypnout připomínky</a>`;
      const html = wrapHtml(
        "30 vteřin a máš doporučení na míru.",
        `<p style='margin:0 0 14px'>Ahoj,</p>` +
        `<p style='margin:0 0 14px'>jak se ti vedl týden? Naklikej si <strong>30vteřinový check-in</strong> — hned dostaneš <strong>doporučení na míru</strong> na další týden a načítá se ti sleva. 💪</p>` +
        btn("Vyplnit check-in", SITE + "/akademie/check-in/") +
        `<p style='margin:14px 0 0'>Drž se!<br><strong>Be Effective!</strong><br>Martin</p>`,
        foot,
      );
      const text = "Ahoj, čas na týdenní check-in: " + SITE + "/akademie/check-in/  — Be Effective! Martin";
      try { await sendResend(email, "Čas na týdenní check-in 💪", html, text, replyTo); sent++; } catch { /* skip */ }
    }
    return json({ ok: true, mode: "remind", sent });
  }

  // ---- SUBMIT MODE (z /akademie/check-in/) ----
  // E-mail bereme z OVERENEHO JWT prihlaseneho uzivatele — body.email nelze verit
  // (jinak by kdokoliv umel farmit kredit na cizi/vlastni adresu bez prihlaseni).
  let email = "";
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (bearer) {
    try { const { data: ures } = await admin.auth.getUser(bearer); email = low(ures?.user?.email || ""); } catch { /* neplatny token */ }
  }
  if (!email || !email.includes("@")) return json({ error: "unauthorized" }, 401);

  const ci = {
    email, weight: num(body.weight), waist: num(body.waist), hips: num(body.hips),
    steps: (body.steps as string) || null, workouts: num(body.workouts),
    adherence: num(body.adherence), sleep: num(body.sleep), feeling: num(body.feeling),
    note: String(body.note ?? "").slice(0, 200) || null,
  };
  const { data: prev } = await admin.from("member_checkins").select("weight,created_at").eq("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
  await admin.from("member_checkins").insert(ci);

  // věrnostní kredit — pripisuje se max 1x za ~tyden (6 dni), dalsi check-iny
  // v tomtez tydnu se ulozi, ale kredit nefarmi
  const tooSoon = !!(prev?.created_at && (Date.now() - new Date(prev.created_at as string).getTime()) < 6 * 24 * 3600 * 1000);
  const { data: dc } = await admin.from("discount_credits").select("*").eq("email", email).maybeSingle();
  let credit = dc ? Number(dc.credit_czk) : 0;
  const n = (dc ? Number(dc.checkins_n) : 0) + (tooSoon ? 0 : 1);
  let baseline = dc ? dc.baseline_waist : null;
  let milestone = dc ? dc.milestone_2cm : false;
  let awarded = 0;
  if (!tooSoon) {
    credit += perCheckin; awarded = perCheckin;
    if (baseline == null && ci.waist != null) baseline = ci.waist;
    if (!milestone && baseline != null && ci.waist != null && (Number(baseline) - ci.waist) >= 2) { credit += milestoneBonus; awarded += milestoneBonus; milestone = true; }
    credit = Math.min(credit, cap);
    await admin.from("discount_credits").upsert(
      { email, credit_czk: credit, checkins_n: n, baseline_waist: baseline, milestone_2cm: milestone, updated_at: new Date().toISOString() },
      { onConflict: "email" },
    );
  }

  // doporučení na míru: decision tree → prio → message
  const wDir = (prev && prev.weight != null && ci.weight != null)
    ? (ci.weight < Number(prev.weight) ? "down" : ci.weight > Number(prev.weight) ? "up" : "same") : "unknown";
  const stepsLow = ci.steps === "do5k" || ci.steps === "5-8k";
  let prio = 99;
  if (ci.sleep != null && ci.sleep <= 2) prio = 10;
  else if (ci.feeling != null && ci.feeling <= 2) prio = 20;
  else if (wDir === "down" && ci.adherence != null && ci.adherence >= 4) prio = 30;
  else if (wDir === "same" && stepsLow) prio = 40;
  else if (wDir === "same" && ci.adherence != null && ci.adherence <= 3) prio = 50;
  else if (wDir === "up" && ci.adherence != null && ci.adherence >= 4) prio = 60;
  else if (ci.workouts === 0) prio = 70;
  const { data: rule } = await admin.from("coaching_rules").select("message").eq("prio", prio).maybeSingle();
  const reco = rule?.message ?? "Díky za check-in! Drž to, co ti funguje, a přidej o kousek víc pohybu nebo jedno poctivé jídlo navíc.";

  return json({ ok: true, credit: awarded, credit_total: credit, checkins_n: n, reco });
});
