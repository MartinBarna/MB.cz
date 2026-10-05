// Barna Academy: týdenní sync reportů z appky Tvůj Coach do `client_reports`.
//
// Auth: hlavička x-drip-secret == app_config.drip_invoke_secret (vzor splatky-guard).
// Most do appky: academy-grant + academy_grant_secret. ŽÁDNÁ druhá auth cesta.
//
// Koho: aktivní koučinkové entitlements (product=coaching, active, neexpirované).
// Co: poslední 4 týdny z TC. Nový řádek je insert (source=tvuj-coach), nikdy upsert.
// ⛔ source=web se nepřepisuje celý: do prázdných polí se doplní appka.
// ⛔ Existující tvuj-coach / app: update jen váha a nutrition.
// ⛔ Jiný source se nesahá a týden se nezaloží. Žádný mail. Žádné mazání.
// ⛔ Odpověď jen agregované counts, žádné e-maily v logu ani v JSON.
// ⛔ Když nějaký klient selže, status je 500, ať pg_cron běh nebere jako úspěch.
// ⭐ [5. 10. 2026] Web s obdobím přes víc týdnů pokrývá všechny své týdny (žádný tvuj-coach),
//    doplní se ze součtu týdnů; lhůta před založením tvuj-coach podle kadence klienta.
//
// Deploy: importuje `../admin-api/tc-report-sync.ts` a ten `../_shared/report-obdobi.ts`,
// takže do staging složky patří i ty (celé složky, paměť `mb-deploy-kopiruje-jen-index-past`).
// ⛔ Až PO migraci `akademie/_supabase/report-obdobi-2026-10-05.sql`.
// supabase functions deploy tc-client-reports-sync --no-verify-jwt
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  applySyncPlan,
  commitSyncPlan,
  cronResultBody,
  existingDateWindow,
  extractTcReports,
  graceDniProKadenci,
  isTcActive,
  OKNO_OBDOBI_DNI,
  reportWriter,
  syncReadError,
  TC_REPORT_SELECT,
  toExistingReport,
  type ExistingClientReport,
} from "../admin-api/tc-report-sync.ts";
// 14. 9. 2026: chyba čtení není odpověď (guard secretu i čtení s opakováním, při trvalé chybě 500).
import { chybaCteni, ctiSOpakovanim, overSecret } from "../_shared/secret-guard.ts";

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

  // Sedí / nesedí 401 / NEPŘEČTENO 500 (ne 401): cron to uvidí a opakovací běh to zkusí znovu.
  const brana = await overSecret(admin, req, { header: "x-drip-secret" });
  if (!brana.ok) return json(brana.body, brana.status);

  const gs = await ctiSOpakovanim<{ data: { value?: unknown } | null; error: unknown }>(() =>
    admin.from("app_config").select("value").eq("key", "academy_grant_secret").maybeSingle());
  if (gs.error) return json({ ok: false, ...chybaCteni("app_config.academy_grant_secret", gs.error) }, 500);
  const gsec = gs.data?.value ? String(gs.data.value) : "";
  if (!gsec) return json({ ok: false, duvod: "chybi_secret" }, 500);

  const nyni = new Date().toISOString();
  type Ent = { email?: string; report_kadence?: unknown; dalsi_report?: unknown };
  let ents: Ent[] = [];
  try {
    // [5. 10. 2026] I kadence reportů a ručně posunutý další report (fáze 2): podle nich se
    // čeká déle, než se pro týden bez webového reportu založí řádek tvuj-coach.
    // ⛔ Sloupce musí existovat dřív než tahle verze (migrace `report-obdobi-2026-10-05.sql`).
    ents = await fetchAllRows((f, t) =>
      admin.from("entitlements").select("email,report_kadence,dalsi_report")
        .eq("product", "coaching").eq("active", true)
        .or("expires_at.is.null,expires_at.gt." + nyni)
        .order("email").range(f, t)
    ) as Ent[];
  } catch (e) {
    return json({ ok: false, duvod: "entitlements", detail: String((e as Error).message ?? e).slice(0, 120) }, 500);
  }

  const clients = [...new Set(ents.map((e) => low(e.email)).filter((e) => e.includes("@")))];
  const planBy = new Map<string, { kadence: number; dalsi: string | null }>();
  for (const e of ents) {
    const k = low(e.email);
    if (!k || planBy.has(k)) continue;
    const kad = Number(e.report_kadence);
    planBy.set(k, {
      kadence: kad === 2 || kad === 3 ? kad : 1,
      dalsi: typeof e.dalsi_report === "string" ? e.dalsi_report.slice(0, 10) : null,
    });
  }

  let synced = 0;
  let created = 0;
  let filled = 0;
  let skipped_web = 0;
  let skipped_protected = 0;
  let skipped_empty = 0;
  let skipped_unchanged = 0;
  let skipped_grace = 0;
  let kolize_tydnu = 0;
  let obsazene_datum = 0;
  let zmeneno_mezitim = 0;
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
      if (!isTcActive(jj.active)) {
        skipped_clients++;
        continue;
      }
      const reports = extractTcReports(jj);
      if (!reports.length) {
        skipped_clients++;
        continue;
      }

      const win = existingDateWindow(reports, OKNO_OBDOBI_DNI);
      const existing: ExistingClientReport[] = [];
      if (win) {
        // ⛔ Nepřečtené existující řádky NEJSOU „žádné řádky": prázdný seznam by pustil
        //    insert i přes chráněný zdroj. Okno sahá 37 dní za pondělí posledního týdne:
        //    report za víc týdnů přijde až po konci svého období (`OKNO_OBDOBI_DNI`).
        const exist = await ctiSOpakovanim<{
          data: { id?: unknown; report_date?: unknown; source?: unknown; weight?: unknown; nutrition?: unknown }[] | null;
          error: unknown;
        }>(() =>
          admin.from("client_reports").select(TC_REPORT_SELECT)
            .eq("email", email).gte("report_date", win.from).lte("report_date", win.to));
        if (exist.error) {
          clients_failed++;
          continue;
        }
        for (const row of exist.data ?? []) existing.push(toExistingReport(row));
      }
      const tg = await ctiSOpakovanim<{ data: Record<string, unknown> | null; error: unknown }>(() =>
        admin.from("client_targets").select("kcal,protein,carbs,fat,fiber,kroky,sport_min,treninky").eq("email", email).maybeSingle());
      // Chyba čtení targets není „klient zadání nemá“. Null by se zapsal do nového řádku.
      if (syncReadError(null, tg.error)) {
        clients_failed++;
        continue;
      }

      const kp = planBy.get(email) ?? { kadence: 1, dalsi: null };
      const plan = applySyncPlan(email, reports, existing, tg.data ?? null, {
        tydnuMax: TYDNU,
        graceDni: graceDniProKadenci(kp.kadence),
        nejdrive: kp.dalsi,
      });
      const committed = await commitSyncPlan(plan, reportWriter(admin));
      if (committed.error) {
        clients_failed++;
        continue;
      }
      zmeneno_mezitim += committed.zmeneno_mezitim;
      if (committed.inserted || committed.updated) clients_touched++;
      else skipped_clients++;
      synced += committed.inserted + committed.updated;
      created += committed.inserted;
      filled += committed.filled;
      skipped_web += plan.skipped_web;
      skipped_protected += plan.skipped_protected;
      skipped_empty += plan.skipped_empty;
      skipped_unchanged += plan.skipped_unchanged;
      skipped_grace += plan.skipped_grace;
      kolize_tydnu += plan.kolize_tydnu;
      obsazene_datum += plan.obsazene_datum;
    } catch {
      clients_failed++;
    }
  }

  const result = cronResultBody({
    clients: clients.length,
    clients_touched,
    clients_skipped: skipped_clients,
    clients_failed,
    synced,
    created,
    filled,
    skipped_web,
    skipped_protected,
    skipped_empty,
    skipped_unchanged,
    skipped_grace,
    kolize_tydnu,
    obsazene_datum,
    zmeneno_mezitim,
  });
  return json(result.body, result.status);
});
