// Barna Academy — order-rescue: JEDNA pripominka nedokoncene objednavky.
// Zdroj: pending_orders (plni simpleshop-webhook ?event=order; platba oznaci completed).
// Okno: objednavka starsi nez 3 h (dost casu na zaplaceni) a mladsi nez 72 h (pak uz nespamovat).
// Pojistky: 1 pripominka na objednavku (reminded_at), zadny mail kdyz uz ma entitlement,
// max 10 mailu na beh. Auth: x-drip-secret. TEST: {test_email, product, name}.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = "Martin Barna <news@martinbarna.cz>";
const MAX_PER_RUN = 10;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const low = (s: unknown) => String(s ?? "").trim().toLowerCase();

// --- mini render (kompatibilni s email_templates blocks; gender = muzsky default) ---
type Block = { t: "p"; html: string } | { t: "bullets"; items: string[] } | { t: "btn"; text: string; href: string } | { t: "ps"; html: string };
function gender(s: string): string {
  let out = "", i = 0;
  while (true) {
    const a = s.indexOf("[[", i);
    if (a < 0) { out += s.slice(i); break; }
    out += s.slice(i, a);
    const sep = s.indexOf("||", a + 2);
    const end = s.indexOf("]]", sep + 2);
    out += s.slice(sep + 2, end);
    i = end + 2;
  }
  return out.split("[a]").join("").split("[á]").join("ý");
}
function merge(s: string, v: Record<string, string>): string {
  let out = "", i = 0;
  while (true) {
    const a = s.indexOf("{{", i);
    if (a < 0) { out += s.slice(i); break; }
    out += s.slice(i, a);
    const end = s.indexOf("}}", a + 2);
    const key = s.slice(a + 2, end);
    out += key in v ? v[key] : "{{" + key + "}}";
    i = end + 2;
  }
  return out;
}
const fill = (s: string, v: Record<string, string>) => merge(gender(s), v);
function renderBlocks(blocks: Block[], v: Record<string, string>): string {
  return blocks.map((b) => {
    if (b.t === "p") return `<p style='margin:0 0 14px'>${fill(b.html, v)}</p>`;
    if (b.t === "ps") return `<p style='margin:16px 0 0;color:#666;font-style:italic'>${fill(b.html, v)}</p>`;
    if (b.t === "bullets")
      return `<ul style='margin:0 0 14px;padding-left:20px'>` + b.items.map((li) => `<li style='margin:0 0 9px'>${fill(li, v)}</li>`).join("") + `</ul>`;
    return `<p style='margin:4px 0 18px'><a href='${fill(b.href, v)}' style='display:inline-block;background:#ff7a00;color:#161616;text-decoration:none;padding:13px 24px;border-radius:50px;font-weight:700'>${fill(b.text, v)}</a></p>`;
  }).join("\n");
}
function wrap(preheader: string, body: string): string {
  const foot = "Martin Barna — online výživový kouč · IČO 76383032 · <a href='https://martinbarna.cz' style='color:#999'>martinbarna.cz</a><br>Tento e-mail ti přišel jako jednorázová připomínka objednávky, kterou jsi rozpracoval na martinbarna.cz. Žádné další maily k ní nedostaneš.";
  return `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head>` +
    `<body style='margin:0;background:#f4f4f5;padding:16px'>` +
    `<span style='display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden'>${preheader}</span>` +
    `<div style='font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#222;max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:28px'>` +
    body + `<hr style='border:none;border-top:1px solid #eee;margin:22px 0 14px'><div style='font-size:12px;line-height:1.5;color:#999'>${foot}</div></div></body></html>`;
}
function vars(name: string): Record<string, string> {
  const t = (name || "").trim().split(" ")[0] || "";
  const fn = t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
  return { first_name: fn, fn_space: fn ? " " + fn : "", fn_suffix: fn ? ", " + fn : "", fn_prefix: fn ? fn + ", " : "" };
}
async function send(to: string, subject: string, html: string) {
  if (!RESEND_KEY) throw new Error("missing_RESEND_API_KEY");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, reply_to: "martin@martinbarna.cz" }),
  });
  if (!r.ok) throw new Error("resend_" + r.status);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: sec } = await admin.from("app_config").select("value").eq("key", "drip_invoke_secret").maybeSingle();
  if (!sec?.value || (req.headers.get("x-drip-secret") || "") !== sec.value) return json({ error: "unauthorized" }, 401);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const getTpl = async (product: string) => {
    const track = product === "academy" ? "rescue-academy" : "rescue-videokurz";
    const { data } = await admin.from("email_templates").select("subject,preheader,blocks").eq("track", track).eq("step", 0).maybeSingle();
    return data as { subject: string; preheader: string; blocks: Block[] } | null;
  };

  // TEST: nahled Martinovi, nic nezapisovat
  if (typeof body.test_email === "string" && body.test_email.includes("@")) {
    const tpl = await getTpl(String(body.product || "videokurz"));
    if (!tpl) return json({ error: "no_template" }, 400);
    const v = vars(String(body.name ?? ""));
    await send(String(body.test_email), "[TEST] " + fill(tpl.subject, v), wrap(fill(tpl.preheader, v), renderBlocks(tpl.blocks, v)));
    return json({ ok: true, mode: "test" });
  }

  // LIVE: objednavky 3-72 h stare, nedokoncene, bez pripominky
  const now = Date.now();
  const from72 = new Date(now - 72 * 3600000).toISOString();
  const to3 = new Date(now - 3 * 3600000).toISOString();
  const { data: pend } = await admin.from("pending_orders")
    .select("order_id,email,product,name,created_at")
    .eq("completed", false).is("reminded_at", null)
    .gte("created_at", from72).lte("created_at", to3)
    .order("created_at", { ascending: true }).limit(MAX_PER_RUN);

  let sent = 0, skipped = 0;
  const results: Record<string, unknown>[] = [];
  for (const p of pend ?? []) {
    const email = low(p.email);
    // pojistka: uz ma pristup (koupil pod jinou objednavkou)? -> oznac a preskoc
    const { data: ent } = await admin.from("entitlements").select("email")
      .eq("email", email).eq("product", p.product).eq("active", true).limit(1);
    if (ent && ent.length) {
      await admin.from("pending_orders").update({ completed: true }).eq("order_id", p.order_id);
      skipped++; continue;
    }
    const tpl = await getTpl(String(p.product));
    if (!tpl) { skipped++; continue; }
    try {
      const v = vars(String(p.name ?? ""));
      await send(email, fill(tpl.subject, v), wrap(fill(tpl.preheader, v), renderBlocks(tpl.blocks, v)));
      await admin.from("pending_orders").update({ reminded_at: new Date().toISOString() }).eq("order_id", p.order_id);
      sent++; results.push({ order: p.order_id, product: p.product });
    } catch (e) {
      results.push({ order: p.order_id, error: String(e).slice(0, 100) });
    }
  }
  return json({ ok: true, due: (pend ?? []).length, sent, skipped, results });
});
