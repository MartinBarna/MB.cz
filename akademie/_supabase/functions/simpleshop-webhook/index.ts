// ============================================================
// Barna Academy — SimpleShop webhook → udělení přístupu (entitlement)
// Supabase Edge Function (Deno). NASazuje Martin přes svůj účet:
//   supabase functions deploy simpleshop-webhook --no-verify-jwt
//
// Co dělá: po zaplacení přes SimpleShop přijde notifikace (IPN) na URL této
// funkce. Funkce ověří tajemství, zjistí e-mail zákazníka a zakoupený produkt
// a zapíše řádek do tabulky `entitlements` (email, product) se service_role
// klíčem → zákazník má přístup hned, jak se přihlásí stejným e-mailem.
//
// TAJEMSTVÍ A KLÍČE (Supabase → Functions → Secrets):
//   SUPABASE_URL                 (automaticky dostupné)
//   SUPABASE_SERVICE_ROLE_KEY    (automaticky dostupné)
//   SIMPLESHOP_WEBHOOK_SECRET    = libovolný silný řetězec; vlož ho i do
//                                  notifikační URL v SimpleShopu jako ?secret=...
//   PRODUCT_MAP (volitelné)      = JSON, mapuje ID/název produktu SimpleShopu
//                                  na 'academy' / 'videokurz', např.:
//                                  {"barna-academy":"academy","videokurz":"videokurz"}
//
// POZN.: Přesná pole payloadu SimpleShopu doplň podle jejich dokumentace
//        (níže je defenzivní parsování běžných názvů polí).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("SIMPLESHOP_WEBHOOK_SECRET") ?? "";
const PRODUCT_MAP = safeJson(Deno.env.get("PRODUCT_MAP")) ?? {};

function safeJson(s: string | undefined): Record<string, string> | null {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

// Z payloadu vytáhne první neprázdnou hodnotu z kandidátních názvů polí.
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

// Mapování názvu/ID produktu SimpleShopu → náš produkt ('academy'|'videokurz').
function resolveProduct(raw: string): "academy" | "videokurz" | null {
  const key = raw.toLowerCase();
  for (const [k, v] of Object.entries(PRODUCT_MAP)) {
    if (key.includes(k.toLowerCase())) return v as "academy" | "videokurz";
  }
  // Fallback heuristika podle názvu.
  if (key.includes("academy") || key.includes("akademie")) return "academy";
  if (key.includes("videokurz") || key.includes("video")) return "videokurz";
  return null;
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) {
    return await req.json().catch(() => ({}));
  }
  // form-urlencoded nebo multipart
  const form = await req.formData().catch(() => null);
  if (form) {
    const o: Record<string, unknown> = {};
    for (const [k, v] of form.entries()) o[k] = v;
    return o;
  }
  return {};
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method-not-allowed" }, 405);

  // Ověření tajemství (z query ?secret= nebo hlavičky X-Webhook-Secret).
  const url = new URL(req.url);
  const provided = url.searchParams.get("secret") || req.headers.get("x-webhook-secret") || "";
  if (!WEBHOOK_SECRET || provided !== WEBHOOK_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  const body = await parseBody(req);

  // Stav platby — přijmeme jen zaplacené (uprav názvy dle SimpleShopu).
  const status = pick(body, ["status", "stav", "payment_status", "state"]).toLowerCase();
  const paidLike = status === "" || ["paid", "zaplaceno", "completed", "ok", "success", "true", "1"].includes(status);
  if (!paidLike) return json({ ok: true, ignored: `status=${status}` }, 200);

  // E-mail zákazníka.
  const email = pick(body, ["email", "customer_email", "buyer_email", "e-mail", "mail"]).toLowerCase();
  if (!email || !email.includes("@")) return json({ error: "missing-email", body }, 400);

  // Produkt.
  const rawProduct = pick(body, ["product", "produkt", "item", "name", "nazev", "variant", "sku", "product_id"]);
  const product = resolveProduct(rawProduct);
  if (!product) return json({ error: "unknown-product", rawProduct }, 422);

  // Zápis entitlementu (service_role obchází RLS).
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { error } = await admin.from("entitlements").upsert(
    { email, product, active: true, source: "simpleshop", granted_at: new Date().toISOString() },
    { onConflict: "email,product" },
  );
  if (error) return json({ error: "db", detail: error.message }, 500);

  return json({ ok: true, email, product }, 200);
});

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
