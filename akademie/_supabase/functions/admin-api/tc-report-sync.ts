// Čistý mapper + plán upsertu týdenních řádků z appky Tvůj Coach do `client_reports`.
// Bez Deno HTTP, testuje se v `tc-report-sync.test.ts`.
//
// Volají ho:
//   • admin-api akce `client_app_sync` (manuál z karty klienta)
//   • edge `tc-client-reports-sync` (týdenní cron)
//
// ⛔ Co klient napsal do webového reportu se nepřepisuje. Z appky se doplní
//    jen prázdná pole. `import-sheet` a `test-kopie` se nesahají.
// ⛔ Neznámá hodnota NENÍ nula: prázdné nutrition zůstane null, ne {kcal:0}.
// ⛔ Žádný mail, žádné mazání, žádná jména v logu. Datum reportu se nepřepisuje.
// ⛔ Web patří k ISO týdnu dne (report_date - 3 dny): ne až st předchozí týden,
//    čt až ne tentýž. Formulář období (od, do) neposílá.
// ⛔ Řádek tvuj-coach se nezakládá, dokud od neděle toho týdne neuplynuly 4 dny.

export const TC_REPORT_SOURCE = "tvuj-coach";

const CHRANENE_ZDROJE = new Set(["import-sheet", "test-kopie"]);
const APP_ZDROJE = new Set(["tvuj-coach", "app"]);
const NUTRITION_KEYS = ["kcal", "protein", "carbs", "fat", "fiber", "dny_zapsano"] as const;

export type TcReport = {
  report_date?: unknown;
  week_start?: unknown;
  tyden?: unknown;
  weight?: unknown;
  vaha?: unknown;
  measurements?: unknown;
  nutrition?: unknown;
  activity?: unknown;
  scales?: unknown;
  notes?: unknown;
  kcal?: unknown;
  protein?: unknown;
  carbs?: unknown;
  fat?: unknown;
  fiber?: unknown;
  dny_zapsano?: unknown;
  treninky?: unknown;
};

export type ClientTargetsSnapshot = Record<string, unknown> | null;

export type ClientReportRow = {
  email: string;
  report_date: string;
  weight: number | null;
  measurements: Record<string, unknown>;
  nutrition: Record<string, unknown> | null;
  activity: Record<string, unknown>;
  scales: Record<string, unknown>;
  notes: Record<string, unknown>;
  targets: ClientTargetsSnapshot;
  source: typeof TC_REPORT_SOURCE;
};

export type ExistingClientReport = {
  report_date: string;
  source?: string | null;
  weight?: number | null;
  nutrition?: Record<string, unknown> | null;
  measurements?: Record<string, unknown> | null;
  activity?: Record<string, unknown> | null;
  scales?: Record<string, unknown> | null;
  notes?: Record<string, unknown> | null;
  targets?: Record<string, unknown> | null;
  photos?: unknown;
  id?: string;
};

export type SyncUpdate = {
  report_date: string;
  source: string;
  weight: number | null;
  nutrition: Record<string, unknown> | null;
};

export type SyncDuvod = { tyden: string; akce: string; duvod: string };

export type SyncPlan = {
  toInsert: ClientReportRow[];
  toUpdate: SyncUpdate[];
  /** Zpětná kompatibilita: totéž co toInsert (nové a přepsané řádky tvuj-coach). */
  toUpsert: ClientReportRow[];
  synced: number;
  created: number;
  filled: number;
  skipped_web: number;
  skipped_protected: number;
  skipped_empty: number;
  skipped_unchanged: number;
  /** Týden appky ještě nemá web a od neděle neuplynuly 4 dny. Řádek se nezaložil. */
  skipped_grace: number;
  /** Týden, kde už leží webový report i řádek tvuj-coach. Nic se nemaže. */
  kolize_tydnu: number;
  report_dates: string[];
  duvody: SyncDuvod[];
};

function low(s: unknown): string {
  return String(s ?? "").trim().toLowerCase();
}

/** Číslo nebo null. Prázdno není nula. */
export function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {};
}

function hasValue(v: unknown): boolean {
  if (v == null || v === "") return false;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") {
    for (const x of Object.values(v as Record<string, unknown>)) {
      if (hasValue(x)) return true;
    }
  }
  return false;
}

function fieldEmpty(v: unknown): boolean {
  return v == null || v === "";
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

/** Pondělí ISO týdne, do kterého datum spadá. Vstup YYYY-MM-DD. */
export function isoWeekStart(iso: string): string {
  const s = String(iso ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dow = dt.getUTCDay();
  const shift = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + shift);
  return dt.toISOString().slice(0, 10);
}

/**
 * Týden, za který webový report je. Formulář (`akademie/klient/index.html`)
 * neposílá od/do, `client-report` ukládá jen dnešní datum v Europe/Prague.
 * Pravidlo: ISO týden dne o 3 dny dřív (ne až st → předchozí týden, čt až ne → tentýž).
 */
export function webReportWeek(reportDate: string): string {
  const s = String(reportDate ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return isoWeekStart(addDays(s, -3));
}

function isoDate(iso: string): string {
  const s = String(iso ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

/** Kalendářní dny od `fromIso` do `toIso`. Záporné, když `toIso` je dřív. */
function calendarDaysBetween(fromIso: string, toIso: string): number | null {
  if (!isoDate(fromIso) || !isoDate(toIso)) return null;
  const [y1, m1, d1] = fromIso.split("-").map(Number);
  const [y2, m2, d2] = toIso.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/** Nový řádek tvuj-coach až když od neděle týdne uplynuly aspoň 4 kalendářní dny. */
export function canCreateTvujCoach(weekMonday: string, asOf: string): boolean {
  const monday = isoDate(weekMonday);
  const day = isoDate(asOf);
  if (!monday || !day) return false;
  const sunday = addDays(monday, 6);
  const diff = calendarDaysBetween(sunday, day);
  return diff != null && diff >= 4;
}

function pragueToday(now: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(now);
}

export function isProtectedSource(source: string | null | undefined): boolean {
  return CHRANENE_ZDROJE.has(String(source ?? "").trim().toLowerCase());
}

export function isAppSource(source: string | null | undefined): boolean {
  return APP_ZDROJE.has(String(source ?? "").trim().toLowerCase());
}

/** Týden bez jídla/váhy/aktivity/měř/škál se do tabulky nezapisuje. */
export function isEmptyReport(report: TcReport): boolean {
  if (num(report.weight) != null || num(report.vaha) != null) return false;
  if (hasValue(report.measurements)) return false;
  if (hasValue(report.nutrition)) return false;
  if (hasValue(report.activity)) return false;
  if (hasValue(report.scales)) return false;
  if (num(report.kcal) != null || num(report.protein) != null) return false;
  return true;
}

function reportDateOf(report: TcReport): string {
  const raw = report.report_date ?? report.week_start ?? report.tyden;
  const s = String(raw ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function nutritionFromReport(report: TcReport): Record<string, unknown> | null {
  if (report.nutrition == null) {
    const lifted: Record<string, unknown> = {};
    for (const k of NUTRITION_KEYS) {
      if (report[k] != null && report[k] !== "") lifted[k] = report[k];
    }
    return Object.keys(lifted).length ? lifted : null;
  }
  const n = asObj(report.nutrition);
  return hasValue(n) ? n : null;
}

function zAppkyOf(n: Record<string, unknown> | null | undefined): string[] {
  return Array.isArray(n?.z_appky) ? (n!.z_appky as unknown[]).map((x) => String(x)) : [];
}

function snapshotAppka(n: Record<string, unknown> | null, syncedAt: string): Record<string, unknown> {
  const src = n ?? {};
  const out: Record<string, unknown> = { synced_at: syncedAt };
  for (const k of NUTRITION_KEYS) out[k] = fieldEmpty(src[k]) ? null : src[k];
  return out;
}

function nutritionChanged(a: Record<string, unknown> | null, b: Record<string, unknown> | null): boolean {
  if (a == null && b == null) return false;
  if (a == null || b == null) return true;
  for (const k of NUTRITION_KEYS) {
    if (JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null)) return true;
  }
  const za = zAppkyOf(a).slice().sort().join(",");
  const zb = zAppkyOf(b).slice().sort().join(",");
  return za !== zb;
}

/**
 * Doplní do webového nutrition jen prázdná pole z appky. Klientova pole nechá.
 * `existingNutrition === null` znamená „stravu jsem nezapisoval": nesaháme.
 */
export function mergeNutritionFromApp(
  existingNutrition: Record<string, unknown> | null | undefined,
  appNutrition: Record<string, unknown> | null,
  syncedAt: string,
): { nutrition: Record<string, unknown> | null; changed: boolean; filledKeys: string[] } {
  if (existingNutrition === null) {
    return { nutrition: null, changed: false, filledKeys: [] };
  }
  const prev = existingNutrition ?? {};
  const app = appNutrition ?? {};
  const clientKeys = new Set(
    NUTRITION_KEYS.filter((k) => !zAppkyOf(prev).includes(k) && !fieldEmpty(prev[k])),
  );
  const next: Record<string, unknown> = { ...prev };
  const filledKeys: string[] = [];
  for (const k of NUTRITION_KEYS) {
    if (clientKeys.has(k)) continue;
    const appVal = fieldEmpty(app[k]) ? null : app[k];
    if (appVal == null) continue;
    if (JSON.stringify(next[k] ?? null) !== JSON.stringify(appVal)) filledKeys.push(k);
    next[k] = appVal;
  }
  const zAppky = NUTRITION_KEYS.filter((k) => !clientKeys.has(k) && !fieldEmpty(next[k]));
  const nutrition = { ...next, z_appky: zAppky, appka: snapshotAppka(app, syncedAt) };
  const changed = filledKeys.length > 0 || nutritionChanged(prev, nutrition);
  return { nutrition, changed, filledKeys };
}

/** Web podle pravidla -3 dny. Ostatní zdroje podle ISO týdne svého data (appka je na pondělí). */
function weekKeyOfExisting(row: ExistingClientReport): string {
  if (low(row.source) === "web") return webReportWeek(row.report_date);
  return isoWeekStart(row.report_date);
}

function collapseAppReports(reports: TcReport[]): TcReport[] {
  const byWeek = new Map<string, TcReport>();
  const sorted = [...reports].sort((a, b) => reportDateOf(a).localeCompare(reportDateOf(b)));
  for (const r of sorted) {
    const date = reportDateOf(r);
    if (!date) continue;
    const week = isoWeekStart(date);
    const prev = byWeek.get(week);
    if (!prev) {
      byWeek.set(week, { ...r, report_date: week, week_start: week });
      continue;
    }
    const merged: TcReport = { ...prev };
    if (num(r.weight) != null) merged.weight = r.weight;
    if (num(r.vaha) != null) merged.vaha = r.vaha;
    if (hasValue(r.measurements)) merged.measurements = { ...asObj(prev.measurements), ...asObj(r.measurements) };
    if (hasValue(r.activity)) merged.activity = { ...asObj(prev.activity), ...asObj(r.activity) };
    if (hasValue(r.scales)) merged.scales = { ...asObj(prev.scales), ...asObj(r.scales) };
    if (hasValue(r.notes)) merged.notes = { ...asObj(prev.notes), ...asObj(r.notes) };
    const pn = nutritionFromReport(prev) ?? {};
    const rn = nutritionFromReport(r) ?? {};
    const nutr: Record<string, unknown> = { ...pn };
    for (const k of NUTRITION_KEYS) {
      if (!fieldEmpty(rn[k])) nutr[k] = rn[k];
    }
    merged.nutrition = hasValue(nutr) ? nutr : null;
    merged.report_date = week;
    merged.week_start = week;
    byWeek.set(week, merged);
  }
  return [...byWeek.values()];
}

/**
 * Řádek pro `client_reports`. `nutrition` je null, když klient stravu nezapisoval
 * (stejný kontrakt jako web report). Ostatní Academy míry (zadek, L stehno, …)
 * se sem nedoplňují, TC je nemá.
 */
export function mapTcReportToRow(
  email: string,
  report: TcReport,
  targets: ClientTargetsSnapshot,
): ClientReportRow {
  const nutrition = nutritionFromReport(report);
  const date = reportDateOf(report);
  const week = isoWeekStart(date) || date;
  return {
    email: low(email),
    report_date: week || date,
    weight: num(report.weight) ?? num(report.vaha),
    measurements: asObj(report.measurements),
    nutrition: nutrition && hasValue(nutrition) ? nutrition : null,
    activity: asObj(report.activity),
    scales: asObj(report.scales),
    notes: asObj(report.notes),
    targets: targets && typeof targets === "object" ? targets : null,
    source: TC_REPORT_SOURCE,
  };
}

/**
 * Upsert jen když řádek chybí, nebo už patří appce (`tvuj-coach` / starší `app`).
 * ⛔ `import-sheet` a `test-kopie` se nesahají. `web` se nesmí přepsat celý,
 *    jen se do něj doplní prázdná pole (viz applySyncPlan). Nový tvuj-coach
 *    navíc čeká 4 dny po neděli.
 */
export function shouldUpsertExisting(existingSource: string | null | undefined): boolean {
  if (existingSource == null || String(existingSource).trim() === "") return true;
  const s = String(existingSource).trim().toLowerCase();
  if (isProtectedSource(s)) return false;
  if (s === "web") return false;
  return APP_ZDROJE.has(s);
}

export function extractTcReports(payload: unknown): TcReport[] {
  const p = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  if (Array.isArray(p.reports)) return p.reports as TcReport[];
  if (Array.isArray(p.tydny)) {
    return (p.tydny as Record<string, unknown>[]).map((t) => {
      const tyden = String(t.tyden ?? t.report_date ?? t.week_start ?? "").slice(0, 10);
      const nutr: Record<string, unknown> = {};
      for (const k of NUTRITION_KEYS) {
        if (t[k] != null && t[k] !== "") nutr[k] = t[k];
      }
      const act: Record<string, unknown> = {};
      if (t.treninky != null && t.treninky !== "") act.fitko = t.treninky;
      return {
        report_date: tyden,
        week_start: tyden,
        tyden,
        weight: t.vaha ?? t.weight ?? null,
        vaha: t.vaha ?? null,
        nutrition: Object.keys(nutr).length ? nutr : null,
        activity: Object.keys(act).length ? act : {},
      } as TcReport;
    });
  }
  return [];
}

export function existingDateWindow(reports: TcReport[]): { from: string; to: string } | null {
  const weeks = reports.map((r) => isoWeekStart(reportDateOf(r))).filter(Boolean).sort();
  if (!weeks.length) return null;
  // Web poslaný v pondělí až ve středu leží až 3 dny po neděli týdne, který popisuje.
  // Od pondělí appky je to +9 dní (neděle + 3).
  return { from: weeks[0], to: addDays(weeks[weeks.length - 1], 9) };
}

function asExistingList(
  existing: ExistingClientReport[] | Map<string, string | null | undefined> | Record<string, string | null | undefined>,
): ExistingClientReport[] {
  if (Array.isArray(existing)) return existing;
  const entries = existing instanceof Map ? [...existing.entries()] : Object.entries(existing);
  return entries.map(([report_date, source]) => ({ report_date, source: source ?? null }));
}

export function applySyncPlan(
  email: string,
  reports: TcReport[],
  existingByDate: ExistingClientReport[] | Map<string, string | null | undefined> | Record<string, string | null | undefined>,
  targets: ClientTargetsSnapshot,
  opts?: { syncedAt?: string; asOf?: string },
): SyncPlan {
  const existing = asExistingList(existingByDate);
  const syncedAt = opts?.syncedAt ?? new Date().toISOString();
  const asOf = isoDate(opts?.asOf ?? "") || pragueToday(new Date());
  const toInsert: ClientReportRow[] = [];
  const toUpdate: SyncUpdate[] = [];
  let skipped_web = 0;
  let skipped_protected = 0;
  let skipped_empty = 0;
  let skipped_unchanged = 0;
  let skipped_grace = 0;
  let kolize_tydnu = 0;
  let created = 0;
  let filled = 0;
  const duvody: SyncDuvod[] = [];

  const collapsed = collapseAppReports(reports ?? []);

  for (const report of collapsed) {
    if (isEmptyReport(report)) {
      skipped_empty++;
      duvody.push({ tyden: reportDateOf(report) || "?", akce: "preskoceno", duvod: "prazdny_tyden" });
      continue;
    }
    const date = reportDateOf(report);
    if (!date) {
      skipped_empty++;
      duvody.push({ tyden: "?", akce: "preskoceno", duvod: "bez_data" });
      continue;
    }
    const week = isoWeekStart(date);
    const inWeek = existing.filter((r) => weekKeyOfExisting(r) === week);
    const webHits = inWeek.filter((r) => low(r.source) === "web");
    const appHits = inWeek.filter((r) => isAppSource(r.source));
    const protectedHits = inWeek.filter((r) => isProtectedSource(r.source));
    if (webHits.length && appHits.length) kolize_tydnu++;

    if (webHits.length) {
      for (const hit of webHits) {
        const appNutr = nutritionFromReport(report);
        const merged = mergeNutritionFromApp(hit.nutrition, appNutr, syncedAt);
        let weight = hit.weight ?? null;
        let vahaZAppky = false;
        if (fieldEmpty(weight)) {
          const w = num(report.weight) ?? num(report.vaha);
          if (w != null) {
            weight = w;
            vahaZAppky = true;
          }
        }
        let nutrition = merged.nutrition;
        if (nutrition && vahaZAppky) {
          const z = zAppkyOf(nutrition);
          if (!z.includes("vaha")) nutrition = { ...nutrition, z_appky: [...z, "vaha"] };
        }
        const weightChanged = (hit.weight ?? null) !== weight;
        if (!merged.changed && !weightChanged) {
          if (zAppkyOf(hit.nutrition ?? {}).length) {
            skipped_unchanged++;
            duvody.push({ tyden: week, akce: "preskoceno", duvod: "beze_zmeny" });
          } else {
            skipped_web++;
            duvody.push({ tyden: week, akce: "preskoceno", duvod: "web_kompletni" });
          }
          continue;
        }
        if (hit.nutrition === null && !weightChanged) {
          skipped_web++;
          duvody.push({ tyden: week, akce: "preskoceno", duvod: "web_strava_preskocena" });
          continue;
        }
        toUpdate.push({
          report_date: hit.report_date,
          source: "web",
          weight,
          nutrition,
        });
        filled++;
        duvody.push({
          tyden: week,
          akce: "doplneno",
          duvod: "prazdna_pole_z_appky:" + (merged.filledKeys.concat(vahaZAppky ? ["vaha"] : []).join(",") || "update"),
        });
      }
      continue;
    }

    if (appHits.length) {
      const hit = appHits[0];
      const row = mapTcReportToRow(email, report, targets);
      row.report_date = hit.report_date;
      const sameWeight = (hit.weight ?? null) === row.weight;
      const sameNut = !nutritionChanged(hit.nutrition ?? null, row.nutrition);
      if (sameWeight && sameNut) {
        skipped_unchanged++;
        duvody.push({ tyden: week, akce: "preskoceno", duvod: "tvuj-coach_beze_zmeny" });
        continue;
      }
      toInsert.push(row);
      duvody.push({ tyden: week, akce: "aktualizovano", duvod: "radek_tvuj-coach" });
      continue;
    }

    if (protectedHits.length) {
      skipped_protected++;
      duvody.push({ tyden: week, akce: "preskoceno", duvod: "chraneny_zdroj_" + String(protectedHits[0].source) });
      continue;
    }

    if (!canCreateTvujCoach(week, asOf)) {
      skipped_grace++;
      duvody.push({ tyden: week, akce: "preskoceno", duvod: "ceka_na_webovy_report" });
      continue;
    }

    const row = mapTcReportToRow(email, report, targets);
    toInsert.push(row);
    created++;
    duvody.push({ tyden: week, akce: "zalozeno", duvod: "tyden_bez_webu" });
  }

  const report_dates = [
    ...toInsert.map((r) => r.report_date),
    ...toUpdate.map((r) => r.report_date),
  ];
  return {
    toInsert,
    toUpdate,
    toUpsert: toInsert,
    synced: toInsert.length + toUpdate.length,
    created,
    filled,
    skipped_web,
    skipped_protected,
    skipped_empty,
    skipped_unchanged,
    skipped_grace,
    kolize_tydnu,
    report_dates,
    duvody,
  };
}
