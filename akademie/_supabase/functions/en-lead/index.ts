// en-lead: příjem leadů z anglické stránky martinbarna.cz/en/ (13. 10. 2026, větev en-x-1013).
//   kind 'kit'         = The Busy Professional's Fat Loss Kit (kalkulačka + Eating Out Playbook)
//   kind 'application' = přihláška do EN Gold koučinku (písemně, bez callů)
//   kind 'calculator'  = plná kalkulačka na /en/calculator/ (stejný calc jako kit)
//   kind 'workout'     = generátor tréninku na /en/workout/ (calc null, plan_summary -> message)
//
// verify_jwt = false (veřejná stránka, žádný uživatel, žádný klíč v prohlížeči).
// Jen POST (jinak 405). CORS a Origin jen https://martinbarna.cz a https://www.martinbarna.cz.
// Odpověď při úspěchu {ok:true}. Honeypot (pole `website`) = tichý úspěch bez zápisu.
//
// ⛔ Zapisuje do public.en_leads, NIKDY do `leads` (na ni jsou navázané české automatické maily).
// ⛔ Nic neposílá mailem. EN maily se spouští zvlášť, až je Martin schválí.
// ⛔ Nasazovat celou složku (rm -rf + cp -r) a s ni i `_shared`: od 27. 10. 2026
//    upozorneni Martinovi jde pres `posliMail`. Samotny index.ts by spadl na importu.
//
// Secrets (Supabase projekt Academy uhmrpfsdcujbhbtumqye):
//   EN_LEAD_IP_SALT            volitelný; bez něj se sůl odvodí ze SUPABASE_SERVICE_ROLE_KEY.
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  dodává platforma sama.
// IP se neukládá: ip_hash = sha256(sůl + '|' + IP). Limit: 5 záznamů za hodinu z jednoho ip_hash.
import { createClient } from "jsr:@supabase/supabase-js@2";
// 27. 10. 2026: odeslani jde pres `_shared/mail-provider.ts`. Deploy musi nahrat i `_shared`.
import { mailKlic, posliMail } from "../_shared/mail-provider.ts";

const ALLOWED_ORIGINS = ["https://martinbarna.cz", "https://www.martinbarna.cz"];
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_BODY = 20_000;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Volby kalkulačky = klíče sdíleného enginu assets/meal-gen.js (viz en/calc-en.js).
const UNITS = ["metric", "imperial"];
const ACTIVITIES = ["sedavy", "lehka", "stredni", "vysoka", "extremni"];
const GOALS = ["hubnuti", "mirne_hubnuti", "udrzeni", "mirny_narust", "narust"];

type Json = Record<string, unknown>;

function cors(origin: string): Record<string, string> {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json" },
  });
}

/** Text z requestu: ořízne mezery, prázdné = null. Nad limit = "too_long" (neořezává potichu). */
function text(v: unknown, max: number): string | null | "too_long" {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > max ? "too_long" : s;
}

/**
 * Odkazující stránka BEZ query stringu a kotvy (stejně jako page-view): v adrese se běžně
 * veze e-mail nebo token a ukládat ho by byla osobní data bez důvodu. Ořez na serveru.
 */
function normReferrer(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return (u.origin + u.pathname).slice(0, 300);
  } catch {
    return null;
  }
}

/** UTM: jen tisknutelné znaky, max 80 (jako page-view). */
function utm(v: unknown): string | null {
  const s = String(v ?? "").trim().replace(/[^\x20-\x7E]/g, "");
  return s ? s.slice(0, 80) : null;
}

/**
 * Výsledek kalkulačky: jen známé klíče v rozumném rozsahu, zbytek se zahodí.
 * ⛔ Záměrně jen VÝSLEDEK a volby, žádný věk, pohlaví, výška ani váha (minimalizace dat;
 * tělesné údaje můžou být zdravotní data a stránka ani /en/privacy/ jejich uložení neslibuje).
 */
function cleanCalc(v: unknown): Json | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Json;
  const out: Json = {};
  const n = (k: string, lo: number, hi: number, dec = 0) => {
    const x = Number(o[k]);
    if (o[k] === null || o[k] === "" || !Number.isFinite(x) || x < lo || x > hi) return;
    const f = 10 ** dec;
    out[k] = Math.round(x * f) / f;
  };
  const pick = (k: string, allowed: string[]) => {
    const s = String(o[k] ?? "");
    if (allowed.includes(s)) out[k] = s;
  };
  pick("units", UNITS);
  pick("activity", ACTIVITIES);
  pick("goal", GOALS);
  n("kcal", 800, 8000);
  n("protein_g", 20, 500);
  n("tdee", 800, 9000);
  if (!("kcal" in out)) return null; // bez výsledku nemá smysl nic ukládat
  out.v = 1;
  return out;
}

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const first = xff.split(",")[0]?.trim();
  const ip = first || req.headers.get("cf-connecting-ip")?.trim() || req.headers.get("x-real-ip")?.trim() || "";
  return ip ? ip.slice(0, 64) : null;
}

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405, origin);
  // Prohlížeč posílá Origin u každého cross-origin POST. Cizí nebo chybějící = ne z našeho webu.
  if (!ALLOWED_ORIGINS.includes(origin)) return json({ ok: false, error: "origin" }, 403, origin);

  let b: Json;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return json({ ok: false, error: "too_large" }, 413, origin);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not object");
    b = parsed as Json;
  } catch {
    return json({ ok: false, error: "bad_json" }, 400, origin);
  }

  // Honeypot: skryté pole `website` člověk nevyplní. Bot ano -> tichý úspěch bez zápisu.
  if (String(b.website ?? "").trim()) return json({ ok: true }, 200, origin);

  const kind = String(b.kind ?? "");
  if (kind !== "kit" && kind !== "application" && kind !== "calculator" && kind !== "workout") {
    return json({ ok: false, error: "invalid_kind" }, 400, origin);
  }

  const email = String(b.email ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return json({ ok: false, error: "invalid_email" }, 400, origin);

  const firstName = text(b.first_name, 80);
  if (firstName === null || firstName === "too_long") {
    return json({ ok: false, error: "invalid_first_name" }, 400, origin);
  }

  // Souhlas musí být výslovně true (nezaškrtnutý checkbox na stránce).
  if (b.consent !== true) return json({ ok: false, error: "consent_required" }, 400, origin);
  const consentText = text(b.consent_text, 1000);
  if (consentText === "too_long") return json({ ok: false, error: "too_long", field: "consent_text" }, 400, origin);

  let goal: string | null = null;
  let message: string | null = null;
  // workout: calc se neukládá (žádné tělesné údaje). Krátký popis voleb jde do existujícího
  // sloupce message, žádný nový sloupec. kit a calculator ukládají jen cleanCalc.
  let calc: Json | null = null;
  if (kind === "application") {
    const g = text(b.goal, 200);
    if (g === null) return json({ ok: false, error: "goal_required" }, 400, origin);
    if (g === "too_long") return json({ ok: false, error: "too_long", field: "goal" }, 400, origin);
    goal = g;
    const m = text(b.message, 2000);
    if (m === "too_long") return json({ ok: false, error: "too_long", field: "message" }, 400, origin);
    message = m;
    calc = cleanCalc(b.calc);
  } else if (kind === "workout") {
    const m = text(b.plan_summary, 500);
    if (m === "too_long") return json({ ok: false, error: "too_long", field: "plan_summary" }, 400, origin);
    message = m;
    calc = null;
  } else {
    calc = cleanCalc(b.calc);
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  // Sůl na hash IP: vlastní secret, jinak odvozená ze service-role klíče (je jen na serveru),
  // ať nasazení nepotřebuje ruční zadání nového secretu (13. 10. 2026).
  const salt = Deno.env.get("EN_LEAD_IP_SALT") || (key ? await sha256hex("en-lead-ip|" + key) : "");
  if (salt.length < 16 || !url || !key) {
    console.error("en-lead: chybí konfigurace (EN_LEAD_IP_SALT nebo SUPABASE_*)");
    return json({ ok: false, error: "config" }, 500, origin);
  }

  const ip = clientIp(req);
  const ipHash = ip ? await sha256hex(salt + "|" + ip) : null;
  const supa = createClient(url, key, { auth: { persistSession: false } });

  // Limit 5 záznamů za hodinu z jedné adresy. ⛔ Chyba dotazu není odpověď "pod limitem":
  // když počet nezjistíme, nezapisujeme naslepo a vrátíme 500 (stránka jednou zopakuje).
  if (ipHash) {
    const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
    const { count, error } = await supa
      .from("en_leads")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    if (error || typeof count !== "number") {
      console.error("en-lead: rate limit dotaz selhal", error?.code ?? "", error?.message ?? "count missing");
      return json({ ok: false, error: "db" }, 500, origin);
    }
    if (count >= RATE_LIMIT) return json({ ok: false, error: "rate_limited" }, 429, origin);
  } else {
    console.warn("en-lead: požadavek bez IP hlavičky, limit nelze uplatnit");
  }

  const { error } = await supa.from("en_leads").insert({
    kind,
    first_name: firstName,
    email,
    consent: true,
    consent_text: consentText,
    consent_at: new Date().toISOString(),
    goal,
    message,
    calc,
    utm_source: utm(b.utm_source),
    utm_medium: utm(b.utm_medium),
    utm_campaign: utm(b.utm_campaign),
    referrer: normReferrer(b.referrer),
    ip_hash: ipHash,
  });
  if (error) {
    // Do logu jen kód a hlášku, nikdy e-mail ani jméno.
    console.error("en-lead: insert selhal", error.code ?? "", error.message ?? "");
    return json({ ok: false, error: "db" }, 500, origin);
  }
  // Přihláška = upozornění Martinovi hned (Elon 13. 10.: rychlost na lead je nejvíc peněz).
  // Jen Martinovi, nikdy klientovi. Jeden pokus; selhání mailu nesmí shodit uložený lead.
  if (kind === "application") await upozorniMartina({ firstName, email, goal, message, utm_source: utm(b.utm_source), utm_campaign: utm(b.utm_campaign) });
  return json({ ok: true }, 200, origin);
});

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

async function upozorniMartina(l: { firstName: string; email: string; goal: string | null; message: string | null; utm_source: string | null; utm_campaign: string | null }): Promise<void> {
  const key = mailKlic();
  if (!key) {
    console.error("en-lead: RESEND_API_KEY chybí, upozornění na přihlášku neodešlo");
    return;
  }
  const html = `<p><b>Nová EN přihláška do koučinku</b> (martinbarna.cz/en/)</p>
<p>Jméno: ${esc(l.firstName)}<br>E-mail: ${esc(l.email)}<br>Cíl: ${esc(l.goal)}<br>Zpráva: ${esc(l.message)}<br>Zdroj: ${esc(l.utm_source ?? "-")} / ${esc(l.utm_campaign ?? "-")}</p>
<p>Celý záznam: Academy tabulka en_leads. Odpověď: koncept od Coache, odesílá Martin.</p>`;
  try {
    const r = await posliMail({
      from: "Web MB.cz <news@martinbarna.cz>",
      to: ["martin@martinbarna.cz"],
      bcc: ["fitness.barna@gmail.com"],
      subject: `🇬🇧 EN přihláška: ${l.firstName}`.slice(0, 120),
      html,
    }, { resendKey: key });
    if (r.status !== 200) console.error("en-lead: upozornění Resend status", r.status);
  } catch (e) {
    console.error("en-lead: upozornění selhalo", e instanceof Error ? e.message : String(e));
  }
}
