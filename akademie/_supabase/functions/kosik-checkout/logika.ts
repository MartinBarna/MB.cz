// Endpoint A: zalozeni Checkout Session. Stripe se vola jen pres deps.zalozSession,
// testy predavaji mock a sit vubec neni. Vypnuty flag, chybejici klic i chyba Stripe
// vraci fallback, nakup se nezablokuje.

import { KOSIK_KATALOG, jeKosikKlic, priceId, type KosikPolozka } from "./katalog.ts";
import {
  LIMIT_EMAIL_10MIN,
  LIMIT_IP_10MIN,
  LIMIT_OKNO_MS,
  type KosikFlagy,
  jeTestRadka,
  platnyCref,
  platnyEmail,
  platnyPromo,
} from "../_shared/kosik-pravidla.ts";

export const SOUHLAS_VERZE = "kosik-v1-2026-11";
export const SOUHLAS_TEXT =
  "Pošli mi e-mail, když objednávku nedokončím, a občas tipy a nabídky od Martina Barny. Souhlas můžu kdykoli odvolat odkazem v každém e-mailu. Zásady ochrany osobních údajů: https://martinbarna.cz/zasady-ochrany-osobnich-udaju/";

export const POVOLENE_ORIGINS = ["https://martinbarna.cz", "https://www.martinbarna.cz"];

export function corsHlavicky(origin: string | null): Record<string, string> {
  const o = origin && POVOLENE_ORIGINS.includes(origin) ? origin : POVOLENE_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export type SouhlasZaznam = {
  souhlas: boolean;
  souhlas_text: string | null;
  souhlas_verze: string | null;
  souhlas_at: string | null;
};

/** Souhlas je true jen kdyz verze sedi na kanonicke zneni. Text z klienta se neuklada. */
export function souhlasZVstupu(souhlas: unknown, verze: unknown, ted: Date): SouhlasZaznam {
  if (souhlas === true && verze === SOUHLAS_VERZE) {
    return {
      souhlas: true,
      souhlas_text: SOUHLAS_TEXT,
      souhlas_verze: SOUHLAS_VERZE,
      souhlas_at: ted.toISOString(),
    };
  }
  return { souhlas: false, souhlas_text: null, souhlas_verze: null, souhlas_at: null };
}

export function omezZdroj(s: unknown): string | null {
  const raw = String(s ?? "").trim();
  if (!raw.startsWith("https://martinbarna.cz/") && raw !== "https://martinbarna.cz") return null;
  const bezDotazu = raw.split("?")[0].slice(0, 300);
  return bezDotazu;
}

export async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode("kosik-ip-v1:" + ip);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type TeloSession = {
  klic: string;
  email: string;
  kosikId: string;
  cref: string | null;
  promoId: string | null;
  polozka: KosikPolozka;
  price: string;
};

/** Formular pro Stripe POST /v1/checkout/sessions. Zadne utm. */
export function parametrySession(t: TeloSession): URLSearchParams {
  const p = new URLSearchParams();
  p.set("mode", "payment");
  p.set("line_items[0][price]", t.price);
  p.set("line_items[0][quantity]", "1");
  p.set("customer_email", t.email);
  if (t.cref) p.set("client_reference_id", t.cref);
  p.set("metadata[kosik_id]", t.kosikId);
  p.set("metadata[kosik_klic]", t.klic);
  p.set("metadata[zdroj]", "web");
  p.set("after_expiration[recovery][enabled]", "true");
  p.set("after_expiration[recovery][allow_promotion_codes]", "false");
  p.set("success_url", t.polozka.successUrl);
  p.set("cancel_url", t.polozka.cancelUrl);
  p.set("locale", "cs");
  if (t.promoId) p.set("discounts[0][promotion_code]", t.promoId);
  return p;
}

export type CheckoutBody = {
  klic?: unknown;
  email?: unknown;
  souhlas?: unknown;
  souhlas_verze?: unknown;
  zdroj_url?: unknown;
  cref?: unknown;
  promo?: unknown;
  website?: unknown;
};

export type CheckoutOdpoved =
  | { status: number; body: { ok: true } }
  | { status: number; body: { url: string } }
  | { status: number; body: { fallback: true; duvod: string } };

export type CheckoutDeps = {
  flagy: KosikFlagy;
  ted: Date;
  ip: string;
  userAgent: string;
  env: (name: string) => string | undefined;
  pocetZaOkno: (dotaz: { email?: string; ipHash?: string; odIso: string }) => Promise<number>;
  vloz: (radek: Record<string, unknown>) => Promise<{ id: string } | { chyba: string }>;
  aktualizuj: (id: string, patch: Record<string, unknown>) => Promise<{ ok: boolean }>;
  najdiPromo: (kod: string) => Promise<string | null>;
  zalozSession: (form: URLSearchParams) => Promise<
    { ok: true; url: string; sessionId: string } | { ok: false; chyba: string }
  >;
};

export async function vytvorCheckout(body: CheckoutBody, deps: CheckoutDeps): Promise<CheckoutOdpoved> {
  if (String(body.website ?? "").trim()) return { status: 200, body: { ok: true } };

  if (!deps.flagy.webZapnuto) return { status: 200, body: { fallback: true, duvod: "web_vypnuto" } };

  const klic = String(body.klic ?? "");
  if (!jeKosikKlic(klic) || !deps.flagy.produkty.includes(klic)) {
    return { status: 200, body: { fallback: true, duvod: "klic" } };
  }
  const polozka = KOSIK_KATALOG[klic];
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!platnyEmail(email)) return { status: 200, body: { fallback: true, duvod: "email" } };

  const price = priceId(klic, deps.env);
  const stripeKlic = (deps.env("STRIPE_RESTRICTED_CHECKOUT_KEY") ?? "").trim();
  if (!price || !stripeKlic) return { status: 200, body: { fallback: true, duvod: "nenastaveno" } };

  const ipHash = await hashIp(deps.ip || "neuvedeno");
  const odIso = new Date(deps.ted.getTime() - LIMIT_OKNO_MS).toISOString();
  const [naEmail, naIp] = await Promise.all([
    deps.pocetZaOkno({ email, odIso }),
    deps.pocetZaOkno({ ipHash, odIso }),
  ]);
  if (naEmail >= LIMIT_EMAIL_10MIN || naIp >= LIMIT_IP_10MIN) {
    return { status: 200, body: { fallback: true, duvod: "limit" } };
  }

  const souhlas = souhlasZVstupu(body.souhlas, body.souhlas_verze, deps.ted);
  const crefRaw = String(body.cref ?? "");
  const cref = platnyCref(crefRaw) ? crefRaw : null;
  const promoRaw = String(body.promo ?? "");
  const promo = polozka.slevyProcent.length > 0 && platnyPromo(promoRaw) ? promoRaw : null;

  const vlozeno = await deps.vloz({
    email,
    produkt_klic: klic,
    castka_halere: polozka.castkaHalere,
    ...souhlas,
    zdroj_url: omezZdroj(body.zdroj_url),
    cref,
    ip_hash: ipHash,
    user_agent: deps.userAgent.slice(0, 300),
    stav: "zalozeno",
    test: jeTestRadka({ test: false, email }),
  });
  if ("chyba" in vlozeno) return { status: 200, body: { fallback: true, duvod: "zapis" } };

  let promoId: string | null = null;
  if (promo) {
    try {
      promoId = await deps.najdiPromo(promo);
    } catch {
      promoId = null;
    }
  }

  const form = parametrySession({
    klic,
    email,
    kosikId: vlozeno.id,
    cref,
    promoId,
    polozka,
    price,
  });
  const session = await deps.zalozSession(form);
  if (!session.ok || !session.url) {
    await deps.aktualizuj(vlozeno.id, { stav: "fallback_stripe" });
    return { status: 200, body: { fallback: true, duvod: "stripe" } };
  }
  await deps.aktualizuj(vlozeno.id, { stripe_session_id: session.sessionId, stav: "otevreno" });
  return { status: 200, body: { url: session.url } };
}
