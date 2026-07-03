// ============================================================
// Barna Academy — withdrawal: online odstoupeni od smlouvy
// (zakonna povinnost od 19. 6. 2026 — odstoupeni musi jit podat online,
//  snadno, srozumitelne a navazane na objednavku; potvrzeni s datem a casem).
// Vola ho formular na martinbarna.cz/odstoupeni/ (POST JSON, bez secretu —
// verejny endpoint; ochrana: honeypot + validace + limity delek).
// Deploy --no-verify-jwt.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = "Martin Barna <news@martinbarna.cz>";
const ALERT_FALLBACK = "fitness.barna@gmail.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

const PRODUCT_LABEL: Record<string, string> = {
  videokurz: "Videokurz výživy",
  academy: "Barna Academy",
  konzultace: "Konzultace / koučink",
  jine: "Jiný produkt",
};

async function resend(to: string, subject: string, html: string, replyTo?: string) {
  if (!RESEND_KEY) throw new Error("missing_RESEND_API_KEY");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, reply_to: replyTo || undefined }),
  });
  if (!res.ok) throw new Error("resend_" + res.status);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method-not-allowed" }, 405);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Honeypot: boti vyplni skryte pole -> tvarime se, ze OK, nic nedelame.
  if (clip(body.website, 10)) return json({ ok: true });

  const email = clip(body.email, 200).toLowerCase();
  if (!email || !email.includes("@") || email.length < 5) return json({ error: "invalid-email" }, 400);
  const orderNumber = clip(body.order_number, 100);
  const productKey = clip(body.product, 30).toLowerCase();
  const product = PRODUCT_LABEL[productKey] ? productKey : "jine";
  const message = clip(body.message, 2000);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: row, error } = await admin.from("withdrawals")
    .insert({ email, order_number: orderNumber || null, product, message: message || null })
    .select("id, created_at").single();
  if (error) return json({ error: "db" }, 500);

  const when = new Date(row.created_at).toLocaleString("cs-CZ", { timeZone: "Europe/Prague", dateStyle: "long", timeStyle: "short" });
  const label = PRODUCT_LABEL[product];
  const summary =
    `<ul style="margin:8px 0 14px;padding-left:20px">` +
    `<li>Produkt: <b>${label}</b></li>` +
    `<li>Číslo objednávky: <b>${orderNumber || "neuvedeno"}</b></li>` +
    `<li>E-mail: <b>${email}</b></li>` +
    `<li>Datum a čas podání: <b>${when}</b></li>` +
    (message ? `<li>Zpráva: ${message.replaceAll("<", "&lt;")}</li>` : "") +
    `</ul>`;

  // Potvrzeni zakaznikovi — zakon vyzaduje potvrzeni o prijeti s obsahem a datem a casem podani.
  try {
    await resend(email, "Potvrzení: přijali jsme tvé odstoupení od smlouvy",
      `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#222;max-width:560px">` +
      `<p>Dobrý den,</p>` +
      `<p>potvrzuji <b>přijetí odstoupení od smlouvy</b> s tímto obsahem:</p>` + summary +
      `<p>Peníze vrátím <b>bez zbytečného odkladu, nejpozději do 14 dnů</b>, stejným způsobem, jakým platba proběhla (nedomluvíme-li se jinak).</p>` +
      `<p>Kdyby cokoliv — stačí odpovědět na tento e-mail.</p>` +
      `<p>Martin Barna<br>martinbarna.cz · IČO 76383032</p></div>`,
      "martin@martinbarna.cz");
  } catch { /* zapis v DB je zdrojem pravdy; admin dostane alert nize */ }

  // Upozorneni Martinovi.
  try {
    let to = ALERT_FALLBACK;
    const { data } = await admin.from("app_config").select("value").eq("key", "admin_emails").maybeSingle();
    if (data?.value) to = String(data.value).split(",")[0].trim() || ALERT_FALLBACK;
    await resend(to, "⚠️ Odstoupení od smlouvy — " + email,
      `<p>Zákazník podal online odstoupení od smlouvy:</p>` + summary +
      `<p><b>Co udělat:</b> vrátit peníze do 14 dnů (SimpleShop → Prodeje → dohledat objednávku → refundace) a případně deaktivovat přístup v adminu.</p>`);
  } catch { /* best-effort */ }

  return json({ ok: true, id: row.id, submitted_at: row.created_at, when });
});
