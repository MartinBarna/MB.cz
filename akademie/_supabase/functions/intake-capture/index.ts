// ============================================================
// Barna Academy — intake-capture: dotazník před konzultací.
// Volá ho formulář na martinbarna.cz/konzultace/dotaznik/ (POST JSON).
//
// Skelet je 1:1 podle `withdrawal`: Origin allowlist, honeypot, časová past,
// rate limit per e-mail i per IP, zápis do DB jako zdroj pravdy, teprve potom maily.
// Nevymýšlím tu nic nového, protože ta funkce je odzkoušená v provozu.
//
// ⛔ ŽÁDNÉ ZDRAVOTNÍ POLE (GDPR, zvláštní kategorie). Zdraví se probírá na hovoru.
//    Viz komentář v `konzultace-dotaznik.sql`.
//
// ⚠️ PÁRUJEME, ALE NEBLOKUJEME. Když k e-mailu nenajdeme zaplacenou konzultaci, dotazník
//    stejně přijmeme a jen to napíšeme do alertu. Blokovat by znamenalo, že člověk, který
//    platil z jiné adresy (nebo mu ji Stripe zapsal jinak), nemá jak dotazník odeslat,
//    a Martin by o tom nevěděl. Stejná logika, jakou jsme zvolili u nákupu za 2 190 Kč
//    bez videokurzu: upozornit, ne zavřít dveře.
//
// Deploy --no-verify-jwt.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = "Martin Barna <news@martinbarna.cz>";
const ALERT_FALLBACK = "fitness.barna@gmail.com";

// Dotazník se má vyplnit jednou, ráno v den konzultace. Strop je velkorysý pro člověka
// (překlep, druhý pokus, druhá konzultace za měsíc) a těsný pro flood skript.
const EMAIL_DAY_MAX = 5;
const IP_DAY_MAX = 15;

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
const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

// Váha přijde z type="number", ale i tak se může přijít cokoli. Nesmyslné číslo radši
// zahodíme než abychom uložili 700 kg a Martin podle toho počítal.
function vahaNaCislo(v: unknown): number | null {
  const n = Number(String(v ?? "").replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 25 || n > 350) return null;
  return Math.round(n * 10) / 10;
}

// Z čeho poptávka přišla (mb_attr_v1 z webu). ⛔ Hodnoty pocházejí z URL parametrů,
// tedy od návštěvníka. Bereme proto JEN známé klíče a tvrdě je zkracujeme, ať se do DB
// ani do alertu nedostane balast nebo pokus o vložení cizího obsahu.
const ATTR_KLICE = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"];
function atribuce(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const zdroj = v as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of ATTR_KLICE) {
    const h = clip(zdroj[k], 200);
    if (h) out[k] = h;
  }
  return Object.keys(out).length ? out : null;
}

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
  if (!ALLOWED_ORIGINS.includes(origin)) return json({ ok: true }, 200, origin);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (clip(body.website, 10)) return json({ ok: true }, 200, origin);
  if (body.t !== undefined && Number(body.t) < 3000) return json({ ok: true }, 200, origin);

  const email = clip(body.email, 200).toLowerCase();
  if (!email || !email.includes("@") || email.length < 5) return json({ error: "invalid-email" }, 400, origin);

  const odpovedi = {
    goal: clip(body.goal, 1500),
    tried_before: clip(body.tried_before, 1500),
    typical_day: clip(body.typical_day, 2000),
    work_shifts: clip(body.work_shifts, 500),
    sleep_hours: clip(body.sleep_hours, 100),
    activity: clip(body.activity, 800),
    measurements: clip(body.measurements, 200),
    note: clip(body.note, 2000),
  };
  const weight = vahaNaCislo(body.weight_kg);
  const attribution = atribuce(body.attribution);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const since = new Date(Date.now() - 24 * 3600000).toISOString();

  const { count: emailCnt } = await admin.from("consultation_intake")
    .select("id", { count: "exact", head: true }).eq("email", email).gt("created_at", since);
  if ((emailCnt ?? 0) >= EMAIL_DAY_MAX) return json({ error: "rate-limit" }, 429, origin);

  if (ip) {
    const { count: ipCnt, error: ipErr } = await admin.from("consultation_intake")
      .select("id", { count: "exact", head: true }).eq("ip", ip).gt("created_at", since);
    if (!ipErr && (ipCnt ?? 0) >= IP_DAY_MAX) return json({ error: "rate-limit" }, 429, origin);
  }

  const ins = await admin.from("consultation_intake")
    .insert({ email, ...odpovedi, weight_kg: weight, ip: ip || null, attribution })
    .select("id, created_at").single();
  if (ins.error || !ins.data) return json({ error: "db" }, 500, origin);

  // Párování na zaplacenou konzultaci: jen pro informaci do alertu.
  // ⚠️ `expires_at` se kontroluje schválně: po refundu už to zaplacená konzultace není.
  let parovani = "⚠️ k téhle adrese NENÍ zaplacená konzultace";
  try {
    const { data } = await admin.from("entitlements")
      .select("source, expires_at, active").eq("email", email).eq("product", "konzultace").maybeSingle();
    if (data && data.active && (data.expires_at === null || new Date(data.expires_at) > new Date())) {
      parovani = "✅ zaplacená konzultace (" + (data.source ?? "?") + ")";
    } else if (data) {
      parovani = "⚠️ konzultaci měl, ale už neplatí (refund nebo expirace)";
    }
  } catch { parovani = "párování se nepodařilo ověřit"; }

  const R = (label: string, val: string) =>
    val ? `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;color:#666">${label}</td>` +
          `<td style="padding:6px 0"><b>${esc(val)}</b></td></tr>` : "";
  const kdy = new Date(ins.data.created_at)
    .toLocaleString("cs-CZ", { timeZone: "Europe/Prague", dateStyle: "long", timeStyle: "short" });

  // Alert Martinovi S VYPSANÝMI ODPOVĚĎMI. Tohle je hlavní výstup celé funkce: Martin si to
  // přečte před hovorem. Odkaz do DB by mu nepomohl, tam se dívat nebude.
  try {
    let to = ALERT_FALLBACK;
    const { data } = await admin.from("app_config").select("value").eq("key", "admin_emails").maybeSingle();
    if (data?.value) to = String(data.value).split(",")[0].trim() || ALERT_FALLBACK;
    await resend(to, "📋 Dotazník před konzultací: " + email,
      `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:640px">` +
      `<p><b>${esc(email)}</b> vyplnil dotazník před konzultací.<br>` +
      `<span style="color:#666">Odesláno ${kdy} · ${parovani}</span></p>` +
      `<table style="border-collapse:collapse">` +
      R("Čeho chce dosáhnout", odpovedi.goal) +
      R("Co už zkoušel", odpovedi.tried_before) +
      R("Běžný den", odpovedi.typical_day) +
      R("Práce a směny", odpovedi.work_shifts) +
      R("Spánek", odpovedi.sleep_hours) +
      R("Pohyb", odpovedi.activity) +
      R("Ranní váha", weight === null ? "" : weight + " kg") +
      R("Míry (pas, boky)", odpovedi.measurements) +
      R("Co mám vědět předem", odpovedi.note) +
      R("Odkud přišel", attribution ? Object.keys(attribution).map((k) => k + "=" + attribution[k]).join(" · ") : "") +
      `</table>` +
      `<p style="color:#666;font-size:13px">Zdraví v dotazníku není schválně, patří na hovor.</p></div>`,
      email);
  } catch { /* zápis v DB je zdroj pravdy */ }

  return json({ ok: true, id: ins.data.id }, 200, origin);
});
