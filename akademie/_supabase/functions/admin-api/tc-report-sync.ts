// Čistý mapper + plán upsertu týdenních řádků z appky Tvůj Coach do `client_reports`.
// Bez Deno HTTP — testuje se v `tc-report-sync.test.ts`.
//
// Volají ho:
//   • admin-api akce `client_app_sync` (manuál z karty klienta)
//   • edge `tc-client-reports-sync` (týdenní cron)
//
// ⛔ source='web' a 'import-sheet' se NIKDY nepřepisují.
// ⛔ Neznámá hodnota NENÍ nula: prázdné nutrition zůstane null, ne {kcal:0}.
// ⛔ Žádný mail, žádné mazání, žádná jména v logu.

export const TC_REPORT_SOURCE = "tvuj-coach";

const CHRANENE_ZDROJE = new Set(["web", "import-sheet"]);
const PREPISovatelNE = new Set(["tvuj-coach", "app"]);

export type TcReport = {
  report_date?: unknown;
  week_start?: unknown;
  weight?: unknown;
  measurements?: unknown;
  nutrition?: unknown;
  activity?: unknown;
  scales?: unknown;
  notes?: unknown;
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

export type SyncPlan = {
  toUpsert: ClientReportRow[];
  synced: number;
  skipped_web: number;
  skipped_empty: number;
  report_dates: string[];
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

/** Týden bez jídla/váhy/aktivity/měř/škál se do tabulky nezapisuje. */
export function isEmptyReport(report: TcReport): boolean {
  if (num(report.weight) != null) return false;
  if (hasValue(report.measurements)) return false;
  if (hasValue(report.nutrition)) return false;
  if (hasValue(report.activity)) return false;
  if (hasValue(report.scales)) return false;
  return true;
}

function reportDateOf(report: TcReport): string {
  const raw = report.report_date ?? report.week_start;
  const s = String(raw ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

/**
 * Řádek pro `client_reports`. `nutrition` je null, když klient stravu nezapisoval
 * (stejný kontrakt jako web report). Ostatní Academy míry (zadek, L stehno, …)
 * se sem nedoplňují — TC je nemá.
 */
export function mapTcReportToRow(
  email: string,
  report: TcReport,
  targets: ClientTargetsSnapshot,
): ClientReportRow {
  const nutritionRaw = report.nutrition;
  const nutrition = nutritionRaw == null ? null : asObj(nutritionRaw);
  return {
    email: low(email),
    report_date: reportDateOf(report),
    weight: num(report.weight),
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
 * ⛔ `web` (klientská sekce) a `import-sheet` se nesahají.
 */
export function shouldUpsertExisting(existingSource: string | null | undefined): boolean {
  if (existingSource == null || String(existingSource).trim() === "") return true;
  const s = String(existingSource).trim().toLowerCase();
  if (CHRANENE_ZDROJE.has(s)) return false;
  return PREPISovatelNE.has(s);
}

export function applySyncPlan(
  email: string,
  reports: TcReport[],
  existingByDate: Map<string, string | null | undefined> | Record<string, string | null | undefined>,
  targets: ClientTargetsSnapshot,
): SyncPlan {
  const lookup = existingByDate instanceof Map
    ? existingByDate
    : new Map(Object.entries(existingByDate));
  const toUpsert: ClientReportRow[] = [];
  let skipped_web = 0;
  let skipped_empty = 0;

  for (const report of reports ?? []) {
    if (isEmptyReport(report)) {
      skipped_empty++;
      continue;
    }
    const date = reportDateOf(report);
    if (!date) {
      skipped_empty++;
      continue;
    }
    const existing = lookup.has(date) ? lookup.get(date) : undefined;
    // chybějící klíč = řádek není; klíč s null/"" = zdroj neznámý, smíme zapsat
    if (lookup.has(date) && !shouldUpsertExisting(existing ?? null)) {
      skipped_web++;
      continue;
    }
    toUpsert.push(mapTcReportToRow(email, report, targets));
  }

  return {
    toUpsert,
    synced: toUpsert.length,
    skipped_web,
    skipped_empty,
    report_dates: toUpsert.map((r) => r.report_date),
  };
}
