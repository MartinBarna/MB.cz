// Barna Academy — daily-digest: ranni prehled Martinovi e-mailem.
// Vola pg_cron (07:30 Prahy) pres net.http_post s hlavickou x-drip-secret
// (stejne tajemstvi jako drip-send: app_config drip_invoke_secret).
// Shrnuje VCEREJSEK + aktualni stav: leadi, maily, prodeje (simpleshop),
// fronta, odstoupeni, affiliate, chyby. Cisla pocita kod, zadne odhady.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: cfg } = await admin.from("app_config").select("key,value").in("key", ["drip_invoke_secret", "admin_emails", "followups_enabled", "followups_breaker_reason", "drip_daily_cap", "academy_founders_offset"]);
  const cmap = Object.fromEntries((cfg ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  const provided = req.headers.get("x-drip-secret") || "";
  if (!cmap.drip_invoke_secret || provided !== cmap.drip_invoke_secret) return json({ error: "unauthorized" }, 401);
  const to = String(cmap.admin_emails || "fitness.barna@gmail.com").split(",")[0].trim();
  // strop fronty z app_config (autotune cron ho zvedne po dojeti backlogu).
  // POZOR: driv tu stalo "Resend limit 100/den je pevny" — to platilo pro free tarif.
  // Od prechodu na placeny Resend denni limit NENI (potvrdil Martin 20. 7. 2026).
  const cap = Math.max(1, Number(cmap.drip_daily_cap ?? "") || 60);

  const now = new Date();
  const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
  const yStart = new Date(dayStart.getTime() - 86400000);
  const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();

  const [leadsY, leads7, evY, due, entsY, wdr, refs, acadSold] = await Promise.all([
    admin.from("leads").select("source").gte("created_at", yStart.toISOString()).lt("created_at", dayStart.toISOString()),
    admin.from("leads").select("created_at").gte("created_at", d7),
    admin.from("email_events").select("type,detail").gte("created_at", yStart.toISOString()).lt("created_at", dayStart.toISOString()),
    admin.from("leads").select("id").eq("status", "active").not("next_send_at", "is", null).lte("next_send_at", now.toISOString()),
    admin.from("entitlements").select("product").eq("active", true).eq("source", "simpleshop").gte("granted_at", yStart.toISOString()),
    admin.from("withdrawals").select("status"),
    admin.from("referrals").select("status"),
    admin.from("entitlements").select("id", { count: "exact", head: true }).eq("product", "academy").eq("active", true).eq("source", "simpleshop"),
  ]);

  // zakladajici clenove: realne prodeje pres SimpleShop + rucni offset (app_config
  // academy_founders_offset — prodeje grantnute rucne, testovaci ucty se nepocitaji);
  // verejny slib: cena 8 900 plati pro prvnich 50, pak zdrazit
  const founders = (acadSold.count ?? 0) + (Number(cmap.academy_founders_offset ?? "") || 0);
  const foundersLeft = Math.max(0, 50 - founders);

  const bySrc: Record<string, number> = {};
  for (const l of leadsY.data ?? []) bySrc[String(l.source ?? "?")] = (bySrc[String(l.source ?? "?")] ?? 0) + 1;
  const leadsYc = (leadsY.data ?? []).length;

  let sent = 0, errs = 0, lastErr = "";
  for (const e of evY.data ?? []) {
    if (e.type === "sent") sent++;
    else if (e.type === "error") { errs++; lastErr = String((e.detail as Record<string, unknown>)?.error ?? "").slice(0, 120); }
  }

  const salesY: Record<string, number> = {};
  for (const s of entsY.data ?? []) salesY[String(s.product)] = (salesY[String(s.product)] ?? 0) + 1;
  const salesYc = (entsY.data ?? []).length;

  let wdrPending = 0;
  for (const w of wdr.data ?? []) if (w.status === "pending") wdrPending++;
  let refPending = 0;
  for (const r of refs.data ?? []) if (r.status === "pending") refPending++;

  const trend: Record<string, number> = {};
  for (const l of leads7.data ?? []) { const d = String(l.created_at).slice(5, 10); trend[d] = (trend[d] ?? 0) + 1; }
  const trendStr = Object.keys(trend).sort().map((k) => k.split("-").reverse().join(".") + ". <b>" + trend[k] + "</b>").join(" &nbsp;·&nbsp; ");

  const dY = yStart.toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "long" });
  const row = (label: string, val: string) => `<tr><td style="padding:7px 12px;color:#666">${label}</td><td style="padding:7px 12px;font-weight:700;text-align:right">${val}</td></tr>`;
  const warn = (t: string) => `<p style="margin:10px 0;padding:10px 14px;background:#fdecea;border-radius:10px;color:#a3352b"><b>⚠️ ${t}</b></p>`;

  let alerts = "";
  if (wdrPending > 0) alerts += warn(wdrPending + "× odstoupení od smlouvy čeká na vyřízení (refundace do 14 dnů!)");
  if (errs > 0) alerts += warn(errs + "× chyba odesílání e-mailů včera" + (lastErr ? ": " + lastErr : ""));
  // Sepnuty jistic byl driv jen radek v tabulce nize, ktery vypada kazdy den stejne a lisi se
  // jedinym slovem. Pri zavrene brane mlci vsechny follow-up sekvence (cca 355 lidi) a nic
  // to nehlasi. Proto to od 20. 7. 2026 patri mezi alerty, ne do tabulky.
  if (cmap.followups_enabled !== "true") {
    alerts += warn("FOLLOW-UPY JSOU VYPNUTÉ. Jistič sepnul a všechny navazující sekvence mlčí. " +
      "Důvod: " + (cmap.followups_breaker_reason || "neuveden") + ". " +
      "Brána se otevře sama po 3 hodinách bez další chyby. Když spěcháš, jde přepnout ručně v app_config.");
  }
  if (founders >= 45) alerts += warn("Blíží se 50. zakládající člen Academy (" + founders + "/50). Podle slibu na webu pak cena roste na 12 900 Kč. Připrav zdražení (objednávka + akademie + JSON-LD).");

  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:560px;margin:0 auto">` +
    `<h2 style="margin:0 0 4px">🌅 Ranní přehled</h2>` +
    `<p style="margin:0 0 14px;color:#888">za ${dY}</p>` + alerts +
    `<table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:12px;overflow:hidden">` +
    row("Nové leady", String(leadsYc) + (leadsYc ? " (" + Object.entries(bySrc).map(([k, v]) => k + " " + v).join(", ") + ")" : "")) +
    row("Prodeje (SimpleShop)", String(salesYc) + (salesYc ? " (" + Object.entries(salesY).map(([k, v]) => k + " " + v).join(", ") + ")" : "")) +
    // "Resend max 100/den" bylo z free tarifu a od prechodu na placeny uz to neplatilo.
    // Zavadejici udaj: 30. 6. 2026 prave tenhle denni limit vyrobil 307 chyb.
    row("Odeslané e-maily", String(sent) + " · strop fronty " + cap + " · Resend bez denního limitu") +
    row("Fronta e-mailů teď", String((due.data ?? []).length)) +
    row("Follow-upy", cmap.followups_enabled === "true" ? "zapnuté" : "vypnuté") +
    row("Affiliate čeká na potvrzení", String(refPending)) +
    row("Zakládající členové Academy", founders + " / 50 · zbývá " + foundersLeft) +
    `</table>` +
    `<p style="margin:14px 0 4px;color:#666;font-size:13px">Leadi 7 dní: ${trendStr || "—"}</p>` +
    `<p style="margin:14px 0 0;font-size:13px"><a href="https://martinbarna.cz/akademie/admin/" style="color:#c45e00">Otevřít admin →</a></p></div>`;

  if (!RESEND_KEY) return json({ error: "missing_resend" }, 500);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Barna Academy <news@martinbarna.cz>", to: [to],
      subject: `🌅 Ranní přehled: ${leadsYc} leadů, ${salesYc} prodejů` + (wdrPending ? `, ⚠️ ${wdrPending} odstoupení` : ""),
      html,
    }),
  });
  if (!res.ok) return json({ error: "resend_" + res.status }, 500);
  return json({ ok: true, to, leads: leadsYc, sales: salesYc, sent, errors: errs, withdrawals_pending: wdrPending });
});
