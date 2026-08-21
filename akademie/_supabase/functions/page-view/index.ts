// page-view — cookieless ping návštěvy z martinbarna.cz.
// verify_jwt=false (veřejný web, žádný uživatel). CORS jen martinbarna.cz.
// POST tělo s path → vloží řádek, vrací 204.
// POST {action:'summary', days:7|30} + admin JWT → souhrn pro admin panel.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const ALLOWED = new Set(["https://martinbarna.cz", "https://www.martinbarna.cz"]);
const DEVICES = new Set(["mobile", "desktop", "tablet"]);

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allow = ALLOWED.has(origin) ? origin : "https://martinbarna.cz";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function originOk(req: Request): boolean {
  const origin = req.headers.get("Origin") ?? "";
  if (ALLOWED.has(origin)) return true;
  const ref = req.headers.get("Referer") ?? "";
  return ref.startsWith("https://martinbarna.cz/") ||
    ref.startsWith("https://www.martinbarna.cz/");
}

function clip(v: unknown, max: number): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.slice(0, max);
}

function normPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let p = raw.trim();
  if (!p || p.length >= 300) return null;
  try {
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname || "/";
  } catch {
    return null;
  }
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length >= 300) return null;
  return p;
}

function countryOf(req: Request, body: Record<string, unknown>): string | null {
  const fromBody = String(body.country ?? "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(fromBody)) return fromBody;
  const h = (
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-country") ||
    req.headers.get("x-supabase-country") ||
    ""
  ).trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(h) && h !== "XX" && h !== "T1") return h;
  return null;
}

function empty204(cors: Record<string, string>) {
  return new Response(null, { status: 204, headers: cors });
}

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return empty204(cors);

  let body: Record<string, unknown> = {};
  try {
    const raw = await req.text();
    if (raw) body = JSON.parse(raw);
  } catch {
    return empty204(cors);
  }

  if (String(body.action || "") === "summary") {
    if (!SUPABASE_URL || !SERVICE || !ANON) return json({ ok: false, error: "config" }, 500);
    const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: ures } = await userClient.auth.getUser();
    const me = String(ures?.user?.email ?? "").trim().toLowerCase();
    const cfg = await admin.from("app_config").select("value").eq("key", "admin_emails").maybeSingle();
    const adminList = String(cfg.data?.value || "fitness.barna@gmail.com")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (!me || !adminList.includes(me)) return json({ error: "forbidden" }, 403);
    const days = Number(body.days) === 30 ? 30 : 7;
    const { data, error } = await admin.rpc("admin_page_views_summary", { p_days: days });
    if (error) return json({ ok: false, error: "db" }, 500);
    return json({ ok: true, days, ...(data && typeof data === "object" ? data as Record<string, unknown> : {}) });
  }

  if (!originOk(req)) return empty204(cors);

  const path = normPath(body.path);
  if (!path) return empty204(cors);

  const deviceRaw = String(body.device ?? "").trim().toLowerCase();
  if (deviceRaw && !DEVICES.has(deviceRaw)) return empty204(cors);
  const device = deviceRaw || null;

  if (!SUPABASE_URL || !SERVICE) return empty204(cors);

  try {
    const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
    await admin.from("page_views").insert({
      path,
      referrer: clip(body.referrer, 500),
      utm_source: clip(body.utm_source, 80),
      utm_medium: clip(body.utm_medium, 80),
      utm_campaign: clip(body.utm_campaign, 80),
      device,
      country: countryOf(req, body),
      session_hash: clip(body.session_hash, 64),
    });
  } catch {
    /* ping je best-effort, návštěvníka nic nesmí zdržet */
  }
  return empty204(cors);
});
