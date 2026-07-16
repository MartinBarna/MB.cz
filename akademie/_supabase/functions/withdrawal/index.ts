// ============================================================
// Barna Academy — withdrawal: online odstoupeni od smlouvy
// (zakonna povinnost od 19. 6. 2026 — odstoupeni musi jit podat online,
//  snadno, srozumitelne a navazane na objednavku; potvrzeni s datem a casem).
// Vola ho formular na martinbarna.cz/odstoupeni/ (POST JSON).
// Anti-abuse (2026-07-16): server-side Origin allowlist (jen martinbarna.cz),
// honeypot, casova past (pole t jako u contact-send — zatim tolerantni, formular
// /odstoupeni/ pole t jeste NEposila; az ho posle, zprisnit), rate-limit
// per e-mail/24h a per IP/24h (sloupec withdrawals.ip doplni
// security-fixes-2026-07.sql; do te doby se IP check tise preskoci).
// Potvrzovaci mail zakaznikovi odchazi az PO vsech kontrolach.
// Deploy --no-verify-jwt.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = "Martin Barna <news@martinbarna.cz>";
const ALERT_FALLBACK = "fitness.barna@gmail.com";

// Anti-abuse limity: odstoupeni musi zustat snadne (zakon), takze stropy jsou
// velkoryse pro cloveka a tesne pro flood skript.
const EMAIL_DAY_MAX = 3;   // max podani na jeden e-mail za 24 h
const IP_DAY_MAX = 10;     // max podani z jedne IP za 24 h (funguje az po doplneni sloupce ip)

const ALLOWED_ORIGINS = ["https://martinbarna.cz", "https://www.martinbarna.cz"];
const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const json = (b: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });

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
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method-not-allowed" }, 405, origin);

  // Off-site POST (cizi/chybejici Origin) = skript mimo web -> tise zahod (vzor contact-send).
  // Oficialni online kanal je formular na martinbarna.cz/odstoupeni/; e-mailova cesta plati vzdy.
  if (!ALLOWED_ORIGINS.includes(origin)) return json({ ok: true }, 200, origin);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Honeypot: boti vyplni skryte pole -> tvarime se, ze OK, nic nedelame.
  if (clip(body.website, 10)) return json({ ok: true }, 200, origin);

  // Casova past (jako contact-send): submit < 3 s od nacteni = bot. Tolerantni rezim —
  // formular pole t zatim neposila; kontrola se aplikuje, jen kdyz t prijde.
  if (body.t !== undefined && Number(body.t) < 3000) return json({ ok: true }, 200, origin);

  const email = clip(body.email, 200).toLowerCase();
  if (!email || !email.includes("@") || email.length < 5) return json({ error: "invalid-email" }, 400, origin);
  const orderNumber = clip(body.order_number, 100);
  const productKey = clip(body.product, 30).toLowerCase();
  const product = PRODUCT_LABEL[productKey] ? productKey : "jine";
  const message = clip(body.message, 2000);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const since = new Date(Date.now() - 24 * 3600000).toISOString();

  // Rate-limit per e-mail/24h: chrani obet pred spamem "potvrzeni" z nasi domeny
  // i Resend kvotu. Pri prekroceni tichy OK (utocnikovi nedavame zpetnou vazbu).
  const { count: emailCnt } = await admin.from("withdrawals")
    .select("id", { count: "exact", head: true }).eq("email", email).gt("created_at", since);
  if ((emailCnt ?? 0) >= EMAIL_DAY_MAX) return json({ error: "rate-limit" }, 429, origin);

  // Rate-limit per IP/24h (vzor referral-click). Kdyz sloupec ip jeste neexistuje
  // (security-fixes SQL ceka na schvaleni), dotaz selze a check se tise preskoci.
  if (ip) {
    const { count: ipCnt, error: ipErr } = await admin.from("withdrawals")
      .select("id", { count: "exact", head: true }).eq("ip", ip).gt("created_at", since);
    if (!ipErr && (ipCnt ?? 0) >= IP_DAY_MAX) return json({ error: "rate-limit" }, 429, origin);
  }

  // Zapis (zdroj pravdy). Nejdriv s IP; kdyz sloupec jeste neexistuje, fallback bez ni.
  let ins = await admin.from("withdrawals")
    .insert({ email, order_number: orderNumber || null, product, message: message || null, ip: ip || null })
    .select("id, created_at").single();
  if (ins.error) {
    ins = await admin.from("withdrawals")
      .insert({ email, order_number: orderNumber || null, product, message: message || null })
      .select("id, created_at").single();
  }
  if (ins.error || !ins.data) return json({ error: "db" }, 500, origin);
  const row = ins.data;

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

  // Potvrzeni zakaznikovi — zakon vyzaduje potvrzeni o prijeti s obsahem a datem a casem.
  // Posila se az TADY, po vsech anti-abuse kontrolach vyse.
  try {
    await resend(email, "Potvrzení: přijali jsme tvé odstoupení od smlouvy",
      `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#222;max-width:560px">` +
      `<p>Dobrý den,</p>` +
      `<p>potvrzuji <b>přijetí odstoupení od smlouvy</b> s tímto obsahem:</p>` + summary +
      `<p>Peníze vrátím <b>bez zbytečného odkladu, nejpozději do 14 dnů</b>, stejným způsobem, jakým platba proběhla (nedomluvíme-li se jinak).</p>` +
      `<p>Kdyby cokoliv, stačí odpovědět na tento e-mail.</p>` +
      `<p>Martin Barna<br>martinbarna.cz · IČO 76383032</p></div>`,
      "martin@martinbarna.cz");
  } catch { /* zapis v DB je zdrojem pravdy; admin dostane alert nize */ }

  // Upozorneni Martinovi.
  try {
    let to = ALERT_FALLBACK;
    const { data } = await admin.from("app_config").select("value").eq("key", "admin_emails").maybeSingle();
    if (data?.value) to = String(data.value).split(",")[0].trim() || ALERT_FALLBACK;
    await resend(to, "⚠️ Odstoupení od smlouvy: " + email,
      `<p>Zákazník podal online odstoupení od smlouvy:</p>` + summary +
      `<p><b>Co udělat:</b> vrátit peníze do 14 dnů (SimpleShop → Prodeje → dohledat objednávku → refundace) a případně deaktivovat přístup v adminu.</p>`);
  } catch { /* best-effort */ }

  return json({ ok: true, id: row.id, submitted_at: row.created_at, when }, 200, origin);
});
