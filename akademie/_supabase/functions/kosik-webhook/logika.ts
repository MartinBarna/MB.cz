// Endpoint B: checkout.session.expired planuje mail, completed ho zastavi.
// Mail se tady neposila. Cizi session (bez kosik_id a bez naseho radku) se ignoruje.

import { maUplnySouhlas, platnyEmail, posunDoOkna } from "../_shared/kosik-pravidla.ts";

export type RadekKosiku = {
  id: string;
  email: string;
  souhlas: boolean;
  souhlas_at: string | null;
  souhlas_text: string | null;
  souhlas_verze: string | null;
  stripe_session_id: string | null;
  expirovano_at: string | null;
  zaplaceno_at: string | null;
};

export type StripeObjekt = {
  id?: unknown;
  metadata?: unknown;
  recovered_from?: unknown;
  payment_status?: unknown;
  after_expiration?: unknown;
};

export type PlanExpirace =
  | { akce: "ignoruj" }
  | { akce: "uz_expirovano" }
  | { akce: "nesedi" }
  | { akce: "zapis"; id: string; patch: Record<string, unknown> };

/**
 * Ulozene stripe_session_id musi sedet na udalost.
 * Expirace a platba puvodni session: obj.id.
 * Obnovena session ma nove id, puvodni je v recovered_from. Bez toho by zaplaceny
 * kosik dal posilal maily. Prazdne session id jeste neni zapsane, udalost ho doplni.
 */
export function sessionSedi(
  radek: { stripe_session_id: string | null },
  obj: StripeObjekt,
): boolean {
  const ulozena = radek.stripe_session_id;
  if (!ulozena) return true;
  const id = typeof obj.id === "string" ? obj.id : "";
  if (ulozena === id) return true;
  const recovered = typeof obj.recovered_from === "string" ? obj.recovered_from : "";
  return recovered !== "" && ulozena === recovered;
}

function metaId(obj: StripeObjekt): string {
  const meta = obj.metadata;
  if (!meta || typeof meta !== "object") return "";
  const id = (meta as { kosik_id?: unknown }).kosik_id;
  return typeof id === "string" ? id : "";
}

function recovery(obj: StripeObjekt): { url: string | null; expiresAt: string | null } {
  const after = obj.after_expiration;
  if (!after || typeof after !== "object") return { url: null, expiresAt: null };
  const rec = (after as { recovery?: unknown }).recovery;
  if (!rec || typeof rec !== "object") return { url: null, expiresAt: null };
  const url = (rec as { url?: unknown }).url;
  const exp = (rec as { expires_at?: unknown }).expires_at;
  const urlOk = typeof url === "string" && url.startsWith("https://") ? url : null;
  const expOk = typeof exp === "number" && Number.isFinite(exp)
    ? new Date(exp * 1000).toISOString()
    : null;
  return { url: urlOk, expiresAt: expOk };
}

export function planExpirace(radek: RadekKosiku | null, obj: StripeObjekt, ted: Date): PlanExpirace {
  if (!radek) return { akce: "ignoruj" };
  if (!sessionSedi(radek, obj)) return { akce: "nesedi" };
  if (radek.expirovano_at) return { akce: "uz_expirovano" };
  const rec = recovery(obj);
  const souhlas = maUplnySouhlas({
    souhlas: radek.souhlas,
    souhlas_at: radek.souhlas_at,
    souhlas_text: radek.souhlas_text,
    souhlas_verze: radek.souhlas_verze,
    stripe_session_id: radek.stripe_session_id ?? (typeof obj.id === "string" ? obj.id : null),
  }) && platnyEmail(radek.email);
  const patch: Record<string, unknown> = {
    expirovano_at: ted.toISOString(),
    recovery_url: rec.url,
    recovery_expires_at: rec.expiresAt,
    stripe_session_id: radek.stripe_session_id ?? (typeof obj.id === "string" ? obj.id : null),
  };
  if (souhlas && rec.url) {
    patch.stav = "propadlo";
    patch.mail1_due_at = posunDoOkna(ted).toISOString();
  } else {
    patch.stav = "propadlo_bez_souhlasu";
    patch.mail1_due_at = null;
  }
  return { akce: "zapis", id: radek.id, patch };
}

export type PlanPlatby =
  | { akce: "ignoruj" }
  | { akce: "nesedi" }
  | { akce: "zapis"; id: string; patch: Record<string, unknown> };

export function planPlatby(radek: RadekKosiku | null, obj: StripeObjekt, ted: Date): PlanPlatby {
  if (!radek) return { akce: "ignoruj" };
  if (!sessionSedi(radek, obj)) return { akce: "nesedi" };
  const stavPlatby = typeof obj.payment_status === "string" ? obj.payment_status : "paid";
  if (stavPlatby !== "paid") return { akce: "ignoruj" };
  const recovered = typeof obj.recovered_from === "string" && obj.recovered_from ? obj.recovered_from : null;
  return {
    akce: "zapis",
    id: radek.id,
    patch: {
      zaplaceno_at: radek.zaplaceno_at ?? ted.toISOString(),
      obnoveno: recovered != null,
      recovered_session_id: recovered,
      stav: "zaplaceno",
    },
  };
}

export type WebhookOdpoved = { status: number; body: Record<string, unknown> };

export type WebhookDeps = {
  ted: Date;
  overPodpis: (raw: string, hlavicka: string) => Promise<boolean>;
  najdi: (dotaz: { id?: string; session?: string }) => Promise<RadekKosiku | null>;
  zapisExpiraci: (id: string, patch: Record<string, unknown>) => Promise<"ok" | "uz_bylo">;
  zapisPlatbu: (id: string, patch: Record<string, unknown>) => Promise<void>;
};

async function najdiRadek(obj: StripeObjekt, deps: WebhookDeps): Promise<RadekKosiku | null> {
  const id = metaId(obj);
  if (id) {
    const r = await deps.najdi({ id });
    if (r) return r;
  }
  const session = typeof obj.id === "string" ? obj.id : "";
  if (session) {
    const r = await deps.najdi({ session });
    if (r) return r;
  }
  const recovered = typeof obj.recovered_from === "string" ? obj.recovered_from : "";
  if (recovered) return deps.najdi({ session: recovered });
  return null;
}

export async function zpracujWebhook(raw: string, hlavicka: string, deps: WebhookDeps): Promise<WebhookOdpoved> {
  if (!(await deps.overPodpis(raw, hlavicka))) return { status: 400, body: { error: "bad-signature" } };
  let ev: { type?: unknown; data?: { object?: StripeObjekt } };
  try {
    ev = JSON.parse(raw);
  } catch {
    return { status: 400, body: { error: "bad-json" } };
  }
  const typ = String(ev?.type ?? "");
  const obj = ev?.data?.object ?? {};
  if (typ !== "checkout.session.expired" && typ !== "checkout.session.completed") {
    return { status: 200, body: { ok: true, ignored: "typ" } };
  }
  const radek = await najdiRadek(obj, deps);
  if (!radek && !metaId(obj)) return { status: 200, body: { ok: true, ignored: "cizi" } };

  if (typ === "checkout.session.expired") {
    const plan = planExpirace(radek, obj, deps.ted);
    if (plan.akce === "ignoruj") return { status: 200, body: { ok: true, ignored: "cizi" } };
    if (plan.akce === "nesedi") return { status: 200, body: { ok: true, ignored: "session" } };
    if (plan.akce === "uz_expirovano") return { status: 200, body: { ok: true, ignored: "duplicita" } };
    const vysledek = await deps.zapisExpiraci(plan.id, plan.patch);
    if (vysledek === "uz_bylo") return { status: 200, body: { ok: true, ignored: "duplicita" } };
    return { status: 200, body: { ok: true, stav: plan.patch.stav, mail: plan.patch.mail1_due_at != null } };
  }

  const plan = planPlatby(radek, obj, deps.ted);
  if (plan.akce === "ignoruj") return { status: 200, body: { ok: true, ignored: "cizi" } };
  if (plan.akce === "nesedi") return { status: 200, body: { ok: true, ignored: "session" } };
  await deps.zapisPlatbu(plan.id, plan.patch);
  return { status: 200, body: { ok: true, stav: "zaplaceno", obnoveno: plan.patch.obnoveno } };
}

/** Chyba DB (vyjimka z najdi nebo zapisu) vrati 500, at Stripe udalost zopakuje. */
export async function obalWebhook(
  raw: string,
  hlavicka: string,
  deps: WebhookDeps,
): Promise<WebhookOdpoved> {
  try {
    return await zpracujWebhook(raw, hlavicka, deps);
  } catch {
    return { status: 500, body: { error: "db" } };
  }
}
