// Kosik checkout: verejny endpoint, autentizace neni JWT (deploy --no-verify-jwt).
// Stripe se vola jen kdyz je kosik_web_zapnuto a je nastaveny STRIPE_RESTRICTED_CHECKOUT_KEY.
// Jinak vrati fallback a nakup jede pres puvodni platebni odkaz.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { nactiKosikFlagy } from "../_shared/kosik-flagy-db.ts";
import { corsHlavicky, vytvorCheckout, type CheckoutBody } from "./logika.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const admin = () => createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function najdiPromo(kod: string): Promise<string | null> {
  const key = (Deno.env.get("STRIPE_RESTRICTED_PROMO_KEY") ?? "").trim();
  if (!key) return null;
  const url = "https://api.stripe.com/v1/promotion_codes?active=true&limit=1&code=" + encodeURIComponent(kod);
  const res = await fetch(url, { headers: { Authorization: "Bearer " + key } });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null) as { data?: { id?: string }[] } | null;
  const id = data?.data?.[0]?.id;
  return typeof id === "string" ? id : null;
}

async function zalozSession(form: URLSearchParams) {
  const key = (Deno.env.get("STRIPE_RESTRICTED_CHECKOUT_KEY") ?? "").trim();
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const data = await res.json().catch(() => ({})) as { url?: string; id?: string };
  if (!res.ok || !data.url || !data.id) return { ok: false as const, chyba: "stripe_" + res.status };
  return { ok: true as const, url: data.url, sessionId: data.id };
}

Deno.serve(async (req) => {
  const cors = corsHlavicky(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ fallback: true, duvod: "method" }, 405, cors);
  let body: CheckoutBody = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const a = admin();
  const flagy = await nactiKosikFlagy(a, Deno.env.get("KOSIK_DRY_RUN"));
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const odpoved = await vytvorCheckout(body, {
    flagy,
    ted: new Date(),
    ip,
    userAgent: req.headers.get("user-agent") ?? "",
    env: (name) => Deno.env.get(name),
    pocetZaOkno: async (dotaz) => {
      let q = a.from("kosik_checkouty").select("id", { count: "exact", head: true }).gte("created_at", dotaz.odIso);
      if (dotaz.email) q = q.eq("email", dotaz.email);
      if (dotaz.ipHash) q = q.eq("ip_hash", dotaz.ipHash);
      const { count, error } = await q;
      if (error) return 999;
      return count ?? 0;
    },
    vloz: async (radek) => {
      const { data, error } = await a.from("kosik_checkouty").insert(radek).select("id").single();
      if (error || !data?.id) return { chyba: error?.message ?? "insert" };
      return { id: String(data.id) };
    },
    aktualizuj: async (id, patch) => {
      const { error } = await a.from("kosik_checkouty").update(patch).eq("id", id);
      return { ok: !error };
    },
    najdiPromo,
    zalozSession,
  });
  return json(odpoved.body, odpoved.status, cors);
});
