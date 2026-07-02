// ============================================================
// Barna Academy — SimpleShop webhook -> udeleni pristupu (entitlement)
// + uvitaci e-mail kupujicimu (pres drip-send only_email, instantne)
// + Cesta A referral atribuce: po udeleni pristupu spari buyer_email
//   proti referral_click -> zapise referral (pending). Best-effort, nikdy neshodi grant.
// Supabase Edge Function (Deno). Deploy --no-verify-jwt (vlastni secret auth).
//
// DVA ZDROJE VOLANI (oba podporovane):
//  1) PRODUKTOVY webhook SimpleShopu (produkt -> Ostatni -> Webhook po uhrazeni):
//     vola GET s parametry v URL, ktere si sami sestavime:
//     ?secret=...&status=paid&product=videokurz&email={mail}&order_id={order_number}
//      &amount={total}&firstname={customer_firstname}&lastname={customer_lastname}
//     POZN.: {mail} funguje JEN na urovni produktu (ne v globalnim webhooku).
//  2) GLOBALNI webhook (Nastaveni -> API): POST pri kazdem ulozeni dokladu.
//     NEobsahuje e-mail ani produkt -> grant z nej nejde; slouzi jen jako
//     zachranna sit pro storno (flags bit 8 -> zneplatni referral pres order_id).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("SIMPLESHOP_WEBHOOK_SECRET") ?? "";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const PRODUCT_MAP = safeJson(Deno.env.get("PRODUCT_MAP")) ?? {};
const ALERT_FALLBACK = "fitness.barna@gmail.com";

function safeJson(s: string | undefined): Record<string, string> | null {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

// Z payloadu vytahne prvni neprazdnou hodnotu z kandidatnich nazvu poli.
function pick(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    for (const real of Object.keys(obj)) {
      if (real.toLowerCase() === k.toLowerCase()) {
        const v = obj[real];
        if (v != null && String(v).trim() !== "") return String(v).trim();
      }
    }
  }
  return "";
}

// Mapovani nazvu/ID produktu SimpleShopu -> nas produkt ('academy'|'videokurz').
function resolveProduct(raw: string): "academy" | "videokurz" | null {
  const key = raw.toLowerCase();
  if (key === "academy" || key === "videokurz") return key; // explicitni parametr z produktoveho webhooku
  for (const [k, v] of Object.entries(PRODUCT_MAP)) {
    if (key.includes(k.toLowerCase())) return v as "academy" | "videokurz";
  }
  if (key.includes("academy") || key.includes("akademie")) return "academy";
  if (key.includes("videokurz") || key.includes("video")) return "videokurz";
  return null;
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  if (req.method === "GET") return {};
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) {
    return await req.json().catch(() => ({}));
  }
  const form = await req.formData().catch(() => null);
  if (form) {
    const o: Record<string, unknown> = {};
    for (const [k, v] of form.entries()) o[k] = v;
    return o;
  }
  return {};
}

// Nouzovy alert Martinovi (Resend primo) — kdyz zaplaceny nakup nejde sparovat s produktem/e-mailem.
// Best-effort: kdyz selze, aspon zustane error event v email_events (ukaze ho admin puls).
// deno-lint-ignore no-explicit-any
async function alertAdmin(admin: any, subject: string, detail: Record<string, unknown>) {
  try {
    await admin.from("email_events").insert({
      lead_id: null, step: 0, type: "error",
      detail: { track: "simpleshop-webhook", error: subject + " " + JSON.stringify(detail).slice(0, 300) },
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
        subject: "⚠️ " + subject,
        html: `<p>SimpleShop webhook nedokázal automaticky udělit přístup.</p><ul>${rows}</ul><p>Uděl přístup ručně v adminu (Rychlé udělení), nebo mrkni do logů funkce simpleshop-webhook.</p>`,
      }),
    });
  } catch { /* best-effort */ }
}

// Uvitaci e-mail kupujicimu: zaradi/preradi lead na onboarding-nakup-<product> step 0
// a hned vyvola drip-send only_email (instantni cesta mimo denni cap).
// Kdyz invoke selze, lead zustane due -> posle ho hodinovy cron (onboarding ma prioritu).
// deno-lint-ignore no-explicit-any
async function sendWelcome(admin: any, email: string, product: "academy" | "videokurz", name: string) {
  const track = product === "academy" ? "onboarding-nakup-academy" : "onboarding-nakup-videokurz";
  const nowIso = new Date().toISOString();
  const { data: existing } = await admin.from("leads").select("id,name").eq("email", email).limit(1);
  if (existing && existing.length) {
    await admin.from("leads").update({
      track, step: 0, status: "active", next_send_at: nowIso, purchased: true,
      name: existing[0].name || name || null, updated_at: nowIso,
    }).eq("id", existing[0].id);
  } else {
    await admin.from("leads").insert({
      email, name: name || null, track, step: 0, status: "active",
      next_send_at: nowIso, purchased: true, source: "simpleshop",
    });
  }
  const { data: cfg } = await admin.from("app_config").select("value").eq("key", "drip_invoke_secret").maybeSingle();
  const dripSecret = cfg?.value ? String(cfg.value) : "";
  if (!dripSecret) return;
  await fetch(SUPABASE_URL + "/functions/v1/drip-send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-drip-secret": dripSecret },
    body: JSON.stringify({ only_email: email }),
  }).catch(() => null);
}

// --- Cesta A: referral atribuce pres e-mail (SimpleShop neprotahne ref do webhooku). ---
// Best-effort: kdykoli hodi vyjimku, volajici ji spolkne a entitlement grant zustane netknuty.
// deno-lint-ignore no-explicit-any
async function attributeReferral(admin: any, body: Record<string, unknown>, buyerEmail: string, product: "academy" | "videokurz") {
  // 1) nejnovejsi ref pro tento e-mail, max 60 dni zpet
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: clicks } = await admin
    .from("referral_click").select("ref").eq("email", buyerEmail).gt("created_at", cutoff)
    .order("created_at", { ascending: false }).limit(1);
  const ref = clicks?.[0]?.ref ? String(clicks[0].ref).toUpperCase().trim() : "";
  if (!ref) return;

  // 2) ref musi byt realny aktivni referral_code
  const { data: codes } = await admin
    .from("referral_codes").select("owner_email").eq("code", ref).eq("active", true).limit(1);
  const owner = codes?.[0]?.owner_email ? String(codes[0].owner_email).toLowerCase() : "";
  if (!owner) return;

  // 3) anti-self-referral
  if (owner === buyerEmail) return;

  // 4) idempotence pres order_id
  const orderId = pick(body, ["order_id", "order", "order_number", "cislo_objednavky", "variable_symbol", "vs", "id"]);
  if (orderId) {
    const { data: existing } = await admin.from("referrals").select("id").eq("order_id", orderId).limit(1);
    if (existing && existing.length) return;
  }

  // 4b) dedup i bez order_id: max 1 referral na (buyer, product) — chrani pred vicenasobnym firem SimpleShop webhooku
  const { data: dup } = await admin.from("referrals").select("id").eq("buyer_email", buyerEmail).eq("product", product).limit(1);
  if (dup && dup.length) return;

  // 5) zapis referral (pending); odmena dle produktu
  const amount = Number(pick(body, ["amount", "price", "total", "cena", "sum", "castka"]).replace(",", ".")) || null;
  const reward = product === "academy" ? 300 : 150;
  await admin.from("referrals").insert({
    code: ref, buyer_email: buyerEmail, product, amount,
    order_id: orderId || null, source: "coupon", status: "pending",
    reward_type: "credit", reward_amount: reward,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST" && req.method !== "GET") return json({ error: "method-not-allowed" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Secret: prednostne z app_config, fallback na env SIMPLESHOP_WEBHOOK_SECRET.
  let secret = WEBHOOK_SECRET;
  try {
    const { data } = await admin.from("app_config").select("value").eq("key", "simpleshop_webhook_secret").maybeSingle();
    if (data?.value) secret = String(data.value);
  } catch { /* fallback na env */ }

  // Overeni tajemstvi (z query ?secret= nebo hlavicky X-Webhook-Secret).
  const url = new URL(req.url);
  const provided = url.searchParams.get("secret") || req.headers.get("x-webhook-secret") || "";
  if (!secret || provided !== secret) {
    return json({ error: "unauthorized" }, 401);
  }

  // Parametry: query z URL (produktovy webhook GET) + telo (globalni POST). Query ma prednost
  // — jeji strukturu jsme si sestavili sami, telo je nedokumentovane.
  const bodyRaw = await parseBody(req);
  const body: Record<string, unknown> = { ...bodyRaw };
  for (const [k, v] of url.searchParams.entries()) {
    if (k !== "secret" && String(v).trim() !== "") body[k] = v;
  }

  // Stav platby.
  const status = pick(body, ["status", "stav", "payment_status", "state"]).toLowerCase();
  const flags = Number(pick(body, ["flags"])) || 0;

  // Refund/storno -> zneplatni pripadny referral (best-effort). Take flags bit 8 = doklad stornovan.
  // Entitlement nechavame beze zmeny (jako dosud).
  const stornoWord = ["refund", "storno", "vracen", "zrus", "cancel"].some((s) => status.includes(s));
  if (stornoWord || (flags & 8) !== 0) {
    try {
      const oid = pick(body, ["order_id", "order", "order_number", "cislo_objednavky", "variable_symbol", "vs", "id"]);
      if (oid) await admin.from("referrals").update({ status: "void" }).eq("order_id", oid);
    } catch { /* best-effort */ }
    return json({ ok: true, refund: true }, 200);
  }

  // Prijmeme jen zaplacene. Globalni POST posila flags: bez bitu 2 (Uhrazeno) neni co delat.
  const paidLike = status === "" || ["paid", "zaplaceno", "completed", "ok", "success", "true", "1"].includes(status);
  if (!paidLike) return json({ ok: true, ignored: `status=${status}` }, 200);
  if (status === "" && flags > 0 && (flags & 2) === 0) return json({ ok: true, ignored: "not-paid-flags" }, 200);

  // E-mail zakaznika. Globalni webhook ho neposila -> tise ignoruj (grant jde jen z produktoveho).
  const email = pick(body, ["email", "customer_email", "buyer_email", "e-mail", "mail"]).toLowerCase();
  if (!email || !email.includes("@")) return json({ ok: true, ignored: "no-email" }, 200);

  // Produkt. Explicitni ?product= z produktoveho webhooku ma prednost (pick poradi).
  const rawProduct = pick(body, ["product", "produkt", "product_name", "nazev_produktu", "item", "sku", "product_id", "nazev", "name"]);
  const product = resolveProduct(rawProduct);
  if (!product) {
    await alertAdmin(admin, "SimpleShop: neznámý produkt — přístup NEUDĚLEN", {
      produkt: rawProduct || "(prázdné)", email,
      objednavka: pick(body, ["order_id", "order_number", "number", "id"]) || "?",
      castka: pick(body, ["amount", "total"]) || "?",
    });
    return json({ error: "unknown-product", rawProduct }, 422);
  }

  // Novy nakup vs. opakovane volani (SimpleShop umi webhook vystrelit vickrat) — podle nej
  // se rozhoduje o uvitacim e-mailu, at nechodi duplicitne.
  const { data: prior } = await admin.from("entitlements")
    .select("email").eq("email", email).eq("product", product).eq("active", true).limit(1);
  const isNew = !(prior && prior.length);

  // Zapis entitlementu (service_role obchazi RLS).
  const { error } = await admin.from("entitlements").upsert(
    { email, product, active: true, source: "simpleshop", granted_at: new Date().toISOString() },
    { onConflict: "email,product" },
  );
  if (error) return json({ error: "db", detail: error.message }, 500);

  // Uvitaci e-mail (jen pri prvnim udeleni) — best-effort, nikdy neshodi grant.
  const name = (pick(body, ["firstname", "customer_firstname", "jmeno"]) + " " + pick(body, ["lastname", "customer_lastname", "prijmeni"])).trim();
  if (isNew) {
    try { await sendWelcome(admin, email, product, name); }
    catch (e) { await alertAdmin(admin, "SimpleShop: přístup udělen, ale uvítací e-mail selhal", { email, product, chyba: String(e).slice(0, 200) }); }
  }

  // Referral atribuce (Cesta A) — best-effort, NIKDY nesmi shodit entitlement grant vyse.
  try { await attributeReferral(admin, body, email, product); } catch { /* referral je best-effort */ }

  // CAPI retez: pole Webhook po zaplaceni v SimpleShopu driv volalo primo ss-capi worker
  // (Meta Purchase, dedup event_id = cislo objednavky). Ted vola nas a my preposilame dal,
  // se stejnym mapovanim parametru (order={number}, order_number={id/doc_id}, value={total}).
  try {
    const capiNumber = pick(body, ["number"]);
    if (capiNumber) {
      const capiDocId = pick(body, ["doc_id", "id"]);
      const capiVal = pick(body, ["amount", "total"]);
      await fetch("https://ss-capi.fitness-barna.workers.dev/?order=" + encodeURIComponent(capiNumber)
        + "&order_number=" + encodeURIComponent(capiDocId) + "&value=" + encodeURIComponent(capiVal)).catch(() => null);
    }
  } catch { /* CAPI je best-effort */ }

  return json({ ok: true, email, product, welcome: isNew }, 200);
});

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
