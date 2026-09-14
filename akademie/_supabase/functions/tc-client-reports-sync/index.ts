// Barna Academy — týdenní sync reportů z appky Tvůj Coach do `client_reports`.
//
// Auth: hlavička x-drip-secret == app_config.drip_invoke_secret (vzor splatky-guard).
// Most do appky: academy-grant + academy_grant_secret. ŽÁDNÁ druhá auth cesta.
//
// Koho: aktivní koučinkové entitlements (product=coaching, active, neexpirované).
// Co: poslední 4 týdny z TC, upsert email+report_date, source=tvuj-coach.
// ⛔ Nepřepisuje source=web / import-sheet. Žádný mail. Žádné mazání.
// ⛔ Odpověď jen agregované counts — žádné e-maily v logu ani v JSON.
//
// Deploy: supabase functions deploy tc-client-reports-sync --no-verify-jwt
import { createClient } from "jsr:@supabase/supabase-js@2";
import { applySyncPlan, type TcReport } from "../admin-api/tc-report-sync.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TC_GRANT_URL = "https://kfkmghvhqwqtsalqjmrp.functions.supabase.co/academy-grant";
const TYDNU = 4;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

const low = (s: unknown) => String(s ?? "").trim().toLowerCase();

// deno-lint-ignore no-explicit-any
async function fetchAllRows(pageQuery: (from: number, to: number) => any): Promise<any[]> {
  // deno-lint-ignore no-explicit-any
  const out: any[] = [];
  const STEP = 1000;
  for (let from = 0; ; from += STEP) {
    const { data, error } = await pageQuery(from, from + STEP - 1);
    if (error) throw new Error(String(error.message ?? error));
    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < STEP) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: sec } = await admin.from("app_config").select("value").eq("key", "drip_invoke_secret").maybeSingle();
  const secret = sec?.value ? String(sec.value) : "";
  const provided = req.headers.get("x-drip-secret") || "";
  if (!secret || provided !== secret) return json({ error: "unauthorized" }, 401);

  const { data: gs } = await admin.from("app_config").select("value").eq("key", "academy_grant_secret").maybeSingle();
  const gsec = gs?.value ? String(gs.value) : "";
  if (!gsec) return json({ ok: false, duvod: "chybi_secret" }, 500);

  const nyni = new Date().toISOString();
  let ents: { email?: string }[] = [];
  try {
    ents = await fetchAllRows((f, t) =>
      admin.from("entitlements").select("email")
        .eq("product", "coaching").eq("active", true)
        .or("expires_at.is.null,expires_at.gt." + nyni)
        .order("email").range(f, t)
    ) as { email?: string }[];
  } catch (e) {
    return json({ ok: false, duvod: "entitlements", detail: String((e as Error).message ?? e).slice(0, 120) }, 500);
  }

  const clients = [...new Set(ents.map((e) => low(e.email)).filter((e) => e.includes("@")))];

  let synced = 0;
  let skipped_web = 0;
  let skipped_empty = 0;
  let skipped_clients = 0;
  let clients_touched = 0;
  let clients_failed = 0;

  for (const email of clients) {
    try {
      const r = await fetch(TC_GRANT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-academy-secret": gsec },
        body: JSON.stringify({ email, action: "report-sync", tydnu: TYDNU }),
        signal: AbortSignal.timeout(20_000),
      }).catch(() => null);
      if (!r || !r.ok) {
        clients_failed++;
        continue;
      }
      const jj = await r.json().catch(() => null) as Record<string, unknown> | null;
      if (!jj || jj.ok === false || jj.found === false || jj.registered === false) {
        skipped_clients++;
        continue;
      }
      // Prefer jen aktivní TC. Registrovaný bez přístupu se nenačítá automaticky.
      if (jj.active !== true) {
        skipped_clients++;
        continue;
      }
      const reports = Array.isArray(jj.reports) ? jj.reports as TcReport[] : [];
      if (!reports.length) {
        skipped_clients++;
        continue;
      }

      const dates = reports.map((x) => String(x.report_date ?? x.week_start ?? "").slice(0, 10)).filter(Boolean);
      const existingByDate = new Map<string, string | null>();
      if (dates.length) {
        const { data: exist } = await admin.from("client_reports")
          .select("report_date,source").eq("email", email).in("report_date", dates);
        for (const row of exist ?? []) {
          existingByDate.set(String(row.report_date), row.source == null ? null : String(row.source));
        }
      }
      const { data: tgRow } = await admin.from("client_targets")
        .select("kcal,protein,carbs,fat,fiber,kroky,sport_min,treninky").eq("email", email).maybeSingle();

      const plan = applySyncPlan(email, reports, existingByDate, tgRow ?? null);
      if (plan.toUpsert.length) {
        const { error } = await admin.from("client_reports").upsert(plan.toUpsert, { onConflict: "email,report_date" });
        if (error) {
          clients_failed++;
          continue;
        }
        clients_touched++;
      } else {
        skipped_clients++;
      }
      synced += plan.synced;
      skipped_web += plan.skipped_web;
      skipped_empty += plan.skipped_empty;
    } catch {
      clients_failed++;
    }
  }

  return json({
    ok: true,
    clients: clients.length,
    clients_touched,
    clients_skipped: skipped_clients,
    clients_failed,
    synced,
    skipped_web,
    skipped_empty,
  });
});
