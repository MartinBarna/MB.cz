// Čistý mapper + plán upsertu týdenních řádků z appky Tvůj Coach do `client_reports`.
// Bez Deno HTTP, testuje se v `tc-report-sync.test.ts`.
//
// Volají ho:
//   • admin-api akce `client_app_sync` (manuál z karty klienta)
//   • edge `tc-client-reports-sync` (týdenní cron)
//
// ⛔ Co klient napsal do webového reportu se nepřepisuje. Z appky se doplní
//    jen prázdná pole nutrition a váha, když je null. Jiný source než web se
//    tímhle doplněním nesahá.
// ⛔ Nový řádek tvuj-coach vzniká jen insertem, a jen když pro email + report_date
//    ještě žádný řádek není. Upsert, který by existující řádek přepsal, tu není.
// ⛔ Existující tvuj-coach / app: update jen weight a nutrition.
// ⛔ Source mimo web, tvuj-coach a app týden přeskočí. Druhý řádek se nezaloží.
// ⛔ Neznámá hodnota NENÍ nula: prázdné nutrition zůstane null, ne {kcal:0}.
// ⛔ Žádný mail, žádné mazání, žádná jména v logu. Datum reportu se nepřepisuje.
// ⛔ Web patří k ISO týdnu dne (report_date - 3 dny): ne až st předchozí týden,
//    čt až ne tentýž. Platí pro web BEZ uloženého období (všechny staré řádky).
// ⭐ [5. 10. 2026] Web s uloženým obdobím (`obdobi_od`, `obdobi_do`, 7 až 28 dní) pokrývá
//    VŠECHNY týdny období. Žádný z nich nedostane vlastní řádek tvuj-coach. Prázdná pole
//    vícetýdenního reportu se doplní ze součtu týdnů appky váženého zapsanými dny.
//    Období, které není z celých týdnů Po až Ne (report ve čtvrtek až sobotu), se nedoplňuje:
//    týdenní data appky se na kus týdne rozdělit nedají. Pravidlo období je jediné,
//    v `_shared/report-obdobi.ts`.
// ⛔ Řádek tvuj-coach se nezakládá, dokud od neděle toho týdne neuplynuly 4 dny
//    (u řidší kadence reportů víc, viz `graceDniProKadenci`).
// ⛔ Když pondělí drží cizí řádek, insert jde na neděli téhož týdne, je-li volná.
//    Obsazené pondělí i neděle: žádný insert, počítá se obsazene_datum.

import { jeCeleTydny, obdobiRadku, tydenReportu, tydnyObdobi } from "../_shared/report-obdobi.ts";

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
  /** Číslo z DB, nebo řetězec, když JSON/driver vrátí text. Porovnání je v `sameScalar`. */
  weight?: number | string | null;
  nutrition?: Record<string, unknown> | null;
  measurements?: Record<string, unknown> | null;
  activity?: Record<string, unknown> | null;
  scales?: Record<string, unknown> | null;
  notes?: Record<string, unknown> | null;
  targets?: Record<string, unknown> | null;
  photos?: unknown;
  id?: string;
  /** [5. 10. 2026] Období webového reportu. Chybí u všech starých řádků (pak 1 týden podle −3 dní). */
  obdobi_od?: string | null;
  obdobi_do?: string | null;
};

export type SyncUpdate = {
  /** Klíč řádku. Bez něj se update neodešle. */
  id: string | null;
  email: string;
  report_date: string;
  source: string;
  weight: number | null;
  nutrition: Record<string, unknown> | null;
  /** Hodnoty, ze kterých plán vyšel. Writer je dá do filtru. */
  match: {
    weight: number | string | null;
    nutrition: Record<string, unknown> | null;
  };
};

/** Select existujících řádků. `id` je podmínka update, `source` rozhoduje, jestli se vůbec smí zapisovat.
 *  `obdobi_od/do` říká, které týdny webový report pokrývá. ⛔ Sloupce musí v DB existovat dřív,
 *  než se nasadí tahle verze (migrace `report-obdobi-2026-10-05.sql`), jinak čtení spadne. */
export const TC_REPORT_SELECT = "id,report_date,source,weight,nutrition,obdobi_od,obdobi_do";

export type MatchFilter = {
  column: string;
  op: "eq" | "is";
  value: string | null;
};

export type SyncDuvod = { tyden: string; akce: string; duvod: string; report_date?: string };

export type SyncPlan = {
  toInsert: ClientReportRow[];
  toUpdate: SyncUpdate[];
  /** Alias `toInsert`. Není to povel k upsertu: zápis nových řádků je insert. */
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
  /** Pondělí i neděle, kam by se zakládalo, už drží řádek. Insert se neudělá. */
  obsazene_datum: number;
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

/** Číslo bez zaokrouhlení. Řetězec „210“ i „210,0“ je 210. Neprázdný nečíselný text je null. */
function asNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Stejné číslo i když jedno přišlo jako řetězec. 0 není prázdné. Prázdno je prázdno. */
function sameScalar(a: unknown, b: unknown): boolean {
  const aEmpty = fieldEmpty(a);
  const bEmpty = fieldEmpty(b);
  if (aEmpty && bEmpty) return true;
  if (aEmpty || bEmpty) return false;
  const na = asNum(a);
  const nb = asNum(b);
  if (na !== null && nb !== null) return na === nb;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Váha, kterou smíme zapsat zpátky. Číslo z DB se nezaokrouhlí. Prázdno je null, ne 0. */
function weightKept(v: unknown): number | null {
  if (fieldEmpty(v)) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return num(v);
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
 * Týden, za který je webový report BEZ uloženého období (všechny řádky do 5. 10. 2026
 * a reporty ze staré stránky nebo z náhradního režimu formuláře).
 * Pravidlo: ISO týden dne o 3 dny dřív (ne až st → předchozí týden, čt až ne → tentýž).
 * ⭐ Jediná implementace je `tydenReportu` ve sdíleném modulu období; tady jen obal.
 */
export function webReportWeek(reportDate: string): string {
  const s = String(reportDate ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return tydenReportu(s);
}

/**
 * Týdny (pondělí), které webový řádek pokrývá: s uloženým obdobím všechny týdny, kterých se
 * dotýká, bez něj jeden týden podle −3 dní. Jiné zdroje: ISO týden data řádku.
 */
export function tydnyRadku(row: ExistingClientReport): string[] {
  if (low(row.source) !== "web") {
    const w = isoWeekStart(row.report_date);
    return w ? [w] : [];
  }
  const ulozene = jeObdobiUlozene(row);
  if (ulozene) return tydnyObdobi(ulozene.od, ulozene.do);
  const w = webReportWeek(row.report_date);
  return w ? [w] : [];
}

/** Uložené platné období řádku, nebo null (starý řádek). */
function jeObdobiUlozene(row: ExistingClientReport): { od: string; do: string } | null {
  if (!row.obdobi_od || !row.obdobi_do) return null;
  const o = obdobiRadku(row);
  return o && o.od === String(row.obdobi_od).slice(0, 10) && o.do === String(row.obdobi_do).slice(0, 10) ? o : null;
}

/** Dá se k webovému řádku přičíst celý týden appky? Starý řádek (1 týden podle −3 dní) ano. */
function webJeZCelychTydnu(row: ExistingClientReport): boolean {
  const o = jeObdobiUlozene(row);
  return !o || jeCeleTydny(o);
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

/**
 * Datum nového řádku tvuj-coach. Pondělí, nebo neděle téhož týdne, když pondělí
 * už drží řádek a neděle ne. null: obě data drží řádek, insert se nedělá.
 * Na source nesahá. Jestli řádek patří do týdne, řeší tydnyRadku.
 */
export function insertDatumTydne(
  weekMonday: string,
  existing: { report_date: string }[],
): string | null {
  const monday = isoDate(weekMonday);
  if (!monday) return null;
  const taken = (day: string) => existing.some((r) => isoDate(r.report_date) === day);
  if (!taken(monday)) return monday;
  const sunday = addDays(monday, 6);
  if (!taken(sunday)) return sunday;
  return null;
}

/**
 * Nový řádek tvuj-coach až když od neděle týdne uplynuly aspoň 4 kalendářní dny.
 * [5. 10. 2026, fáze 2] Klient s řidší kadencí reportů pošle report za víc týdnů naráz,
 * takže se čeká déle (`graceDni`, viz `graceDniProKadenci`), a týdny do ručně posunutého
 * dalšího reportu (`nejdrive`, dovolená) čekají až 4 dny po něm. Jinak by appka založila
 * řádek pro týden, který vzápětí pokryje klientův report, a týden by byl v historii dvakrát.
 */
export function canCreateTvujCoach(
  weekMonday: string,
  asOf: string,
  opts?: { graceDni?: number; nejdrive?: string | null },
): boolean {
  const monday = isoDate(weekMonday);
  const day = isoDate(asOf);
  if (!monday || !day) return false;
  const sunday = addDays(monday, 6);
  const grace = typeof opts?.graceDni === "number" && Number.isFinite(opts.graceDni) && opts.graceDni > 4 ? opts.graceDni : 4;
  const diff = calendarDaysBetween(sunday, day);
  if (diff == null || diff < grace) return false;
  const nejdrive = isoDate(opts?.nejdrive ?? "");
  if (nejdrive && sunday <= nejdrive) {
    const poTerminu = calendarDaysBetween(nejdrive, day);
    if (poTerminu == null || poTerminu < 4) return false;
  }
  return true;
}

/** Lhůta před založením řádku tvuj-coach podle kadence reportů: týden 4 dny, 2 týdny 11, 3 týdny 18. */
export function graceDniProKadenci(kadence: number): number {
  const k = kadence === 2 || kadence === 3 ? kadence : 1;
  return 4 + 7 * (k - 1);
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
    if (!sameScalar(a[k], b[k])) return true;
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
    if (sameScalar(next[k], appVal)) continue;
    filledKeys.push(k);
    next[k] = appVal;
  }
  const zAppky = NUTRITION_KEYS.filter((k) => !clientKeys.has(k) && !fieldEmpty(next[k]));
  const nutrition = { ...next, z_appky: zAppky, appka: snapshotAppka(app, syncedAt) };
  const changed = filledKeys.length > 0 || nutritionChanged(prev, nutrition);
  return { nutrition, changed, filledKeys };
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
 * Přepis existujícího řádku upsertem je zakázaný, ať je source jakýkoli.
 * Nový řádek je insert, jen když datum není obsazené. Funkce vrací false vždy:
 * dřív pouštěla upsert pro tvuj-coach a pro prázdný source.
 */
export function shouldUpsertExisting(_existingSource?: string | null): boolean {
  return false;
}

/**
 * Řádek ze selectu. `nutrition: null` zůstane null (klient stravu nezapisoval),
 * nesmí se z toho stát prázdný objekt. Váha se tady nezaokrouhluje.
 */
export function toExistingReport(row: {
  id?: unknown;
  report_date?: unknown;
  source?: unknown;
  weight?: unknown;
  nutrition?: unknown;
  obdobi_od?: unknown;
  obdobi_do?: unknown;
}): ExistingClientReport {
  const id = row.id == null ? "" : String(row.id).trim();
  return {
    id: id || undefined,
    report_date: String(row.report_date ?? "").slice(0, 10),
    source: row.source == null ? null : String(row.source),
    weight: fieldEmpty(row.weight) ? null : row.weight as number | string,
    nutrition: row.nutrition == null ? null : asObj(row.nutrition),
    obdobi_od: row.obdobi_od == null ? null : String(row.obdobi_od).slice(0, 10),
    obdobi_do: row.obdobi_do == null ? null : String(row.obdobi_do).slice(0, 10),
  };
}

/**
 * Filtr update. Klíč řádku je `id` (uuid):
 * `report-drafts.sql` má `report_id uuid references public.client_reports(id)`,
 * admin čte a mění report přes `.eq("id", reportId)`.
 * Unique (email, report_date) v SQL repa není. Update jen podle emailu a data
 * by mohl trefit víc řádků, proto se bez `id` filtr nepostaví a zápis nejde ven.
 *
 * `nutrition->>klíč` je text. `eq` dostane přesný text hodnoty, `is` jen null.
 * 0 je `eq` „0“, ne null. Klíč `dny` se nefiltruje: je to pole a text JSON z `->>`
 * nemusí sednout na to, co bychom složili, a doplnění u reportu s rozpisem by
 * pak nikdy neprošlo. Když se změní jen `dny` a makra zůstanou, update projde
 * a denní rozpis se vrátí na snímek z čtení.
 */
export function reportMatchFilters(update: SyncUpdate): MatchFilter[] | null {
  if (!update.id) return null;
  const filters: MatchFilter[] = [
    { column: "id", op: "eq", value: update.id },
    { column: "email", op: "eq", value: update.email },
    { column: "report_date", op: "eq", value: update.report_date },
    { column: "source", op: "eq", value: update.source },
    fieldEmpty(update.match.weight)
      ? { column: "weight", op: "is", value: null }
      : { column: "weight", op: "eq", value: String(update.match.weight) },
  ];
  const nutr = update.match.nutrition;
  for (const k of NUTRITION_KEYS) {
    const value = nutr == null ? null : nutr[k];
    filters.push(value == null
      ? { column: "nutrition->>" + k, op: "is", value: null }
      : { column: "nutrition->>" + k, op: "eq", value: String(value) });
  }
  return filters;
}

// deno-lint-ignore no-explicit-any
export function applyMatchFilters(query: any, filters: MatchFilter[]): any {
  let q = query;
  for (const f of filters) {
    q = f.op === "is" ? q.is(f.column, null) : q.eq(f.column, f.value);
  }
  return q;
}

export type ReportWriter = {
  insert(rows: ClientReportRow[]): Promise<{ error: { message?: string } | null }>;
  update(
    values: { weight: number | null; nutrition: Record<string, unknown> | null },
    filters: MatchFilter[],
  ): Promise<{ error: { message?: string } | null; rows: { id?: string }[] | null }>;
};

export type CommitResult = {
  inserted: number;
  updated: number;
  filled: number;
  zmeneno_mezitim: number;
  zmeneno_datum: string[];
  error: null | "insert" | "update" | "bez_id" | "zakazany_zdroj";
};

function commitFail(
  error: NonNullable<CommitResult["error"]>,
  partial: Pick<CommitResult, "inserted" | "updated" | "filled" | "zmeneno_mezitim" | "zmeneno_datum">,
): CommitResult {
  return { ...partial, error };
}

/** Insert nových řádků a podmíněný update. Žádný upsert. Update posílá jen váhu a nutrition. */
export async function commitSyncPlan(plan: SyncPlan, writer: ReportWriter): Promise<CommitResult> {
  const partial = {
    inserted: 0,
    updated: 0,
    filled: 0,
    zmeneno_mezitim: 0,
    zmeneno_datum: [] as string[],
  };
  if (plan.toInsert.length) {
    for (const row of plan.toInsert) {
      if (row.source !== TC_REPORT_SOURCE) return commitFail("zakazany_zdroj", partial);
    }
    const ins = await writer.insert(plan.toInsert);
    if (ins.error) return commitFail("insert", partial);
    partial.inserted = plan.toInsert.length;
  }
  for (const u of plan.toUpdate) {
    if (low(u.source) !== "web" && !isAppSource(u.source)) return commitFail("zakazany_zdroj", partial);
    const filters = reportMatchFilters(u);
    if (!filters) return commitFail("bez_id", partial);
    const res = await writer.update(
      { weight: u.weight, nutrition: u.nutrition },
      filters,
    );
    if (res.error) return commitFail("update", partial);
    if (!res.rows || res.rows.length === 0) {
      partial.zmeneno_mezitim++;
      partial.zmeneno_datum.push(u.report_date);
      continue;
    }
    partial.updated++;
    if (low(u.source) === "web") partial.filled++;
  }
  return { ...partial, error: null };
}

/**
 * Seznam pro tlačítko. `doplneno` v plánu vznikne dřív, než update doběhne.
 * V seznamu zůstane jen u data, které update opravdu zapsal. Minuté je
 * `zmeneno_mezitim` a druhá řádka se za to nepřiplácne.
 */
export function duvodyProTlacitko(duvody: SyncDuvod[], zmenenoDatum: string[]): SyncDuvod[] {
  const missed = new Set(zmenenoDatum);
  const seen = new Set<string>();
  const out: SyncDuvod[] = [];
  for (const d of duvody) {
    const datum = d.report_date ?? "";
    if (d.akce === "doplneno" && datum && missed.has(datum)) {
      seen.add(datum);
      out.push({ tyden: d.tyden, akce: "preskoceno", duvod: "zmeneno_mezitim" });
      continue;
    }
    out.push({ tyden: d.tyden, akce: d.akce, duvod: d.duvod });
  }
  for (const datum of zmenenoDatum) {
    if (!seen.has(datum)) out.push({ tyden: datum, akce: "preskoceno", duvod: "zmeneno_mezitim" });
  }
  return out;
}

// deno-lint-ignore no-explicit-any
export function reportWriter(admin: any): ReportWriter {
  return {
    async insert(rows) {
      const r = await admin.from("client_reports").insert(rows);
      return { error: r.error ?? null };
    },
    async update(values, filters) {
      let q = admin.from("client_reports").update({
        weight: values.weight,
        nutrition: values.nutrition,
      });
      q = applyMatchFilters(q, filters);
      const r = await q.select("id");
      return { error: r.error ?? null, rows: r.data ?? null };
    },
  };
}

/** Stejná podmínka jako cron: jen boolean true. Řetězec „true“ účet neotevře. */
export function isTcActive(active: unknown): boolean {
  return active === true;
}

/** Chyba čtení není prázdný seznam. `null` a `undefined` jsou úspěch bez řádku. */
export function syncReadError(reportsError: unknown, targetsError: unknown): "reporty" | "targets" | null {
  if (reportsError != null) return "reporty";
  if (targetsError != null) return "targets";
  return null;
}

export function cronResultBody(counts: {
  clients: number;
  clients_touched: number;
  clients_skipped: number;
  clients_failed: number;
  synced: number;
  created: number;
  filled: number;
  skipped_web: number;
  skipped_protected: number;
  skipped_empty: number;
  skipped_unchanged: number;
  skipped_grace: number;
  kolize_tydnu: number;
  obsazene_datum: number;
  zmeneno_mezitim: number;
}): { status: number; body: Record<string, unknown> } {
  const status = counts.clients_failed > 0 ? 500 : 200;
  return { status, body: { ok: status === 200, ...counts } };
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

/**
 * [5. 10. 2026] Kolik dní za pondělím posledního týdne appky se čtou existující řádky, když
 * reporty mají období: týden appky může být PRVNÍ týden čtyřtýdenního období, které končí
 * o 27 dní později a report přijde až ve středu po něm (+30). Bez delšího okna by se takový
 * report nenašel a pro jeho první týden by vznikl řádek tvuj-coach. ⛔ Oba produkční
 * volající (cron i tlačítko v adminu) předávají TUHLE hodnotu (hlídá to test).
 */
export const OKNO_OBDOBI_DNI = 37;

export function existingDateWindow(reports: TcReport[], dniZaPoslednim = 9): { from: string; to: string } | null {
  const weeks = reports.map((r) => isoWeekStart(reportDateOf(r))).filter(Boolean).sort();
  if (!weeks.length) return null;
  // Od pondělí: +6 je neděle (sem může spadnout insert) a +9 je středa po ní
  // (web poslaný v pondělí až ve středu patří předchozímu týdnu). Reporty s obdobím
  // potřebují `OKNO_OBDOBI_DNI` (výš).
  return { from: weeks[0], to: addDays(weeks[weeks.length - 1], dniZaPoslednim) };
}

/**
 * Týdny appky sečtené za období jednoho reportu: průměry vážené zapsanými dny
 * (Σ průměr × dny / Σ dny), `dny_zapsano` = součet. Týden bez zapsaných dní se do průměru
 * nepočítá (nevíme, jakou váhu mu dát). Váha z posledního týdne, který ji má.
 */
export function agregujTydnyAppky(tydny: TcReport[]): { nutrition: Record<string, unknown> | null; weight: number | null } {
  const serazene = [...tydny].sort((a, b) => reportDateOf(a).localeCompare(reportDateOf(b)));
  const KLICE = ["kcal", "protein", "carbs", "fat", "fiber"] as const;
  const soucet: Record<string, number> = {}, vaha: Record<string, number> = {};
  let dnySoucet = 0;
  for (const r of serazene) {
    const n = nutritionFromReport(r) ?? {};
    const d = num(n.dny_zapsano);
    if (d == null || d <= 0) continue;
    dnySoucet += d;
    for (const k of KLICE) {
      const v = num(n[k]);
      if (v == null) continue;
      soucet[k] = (soucet[k] ?? 0) + v * d;
      vaha[k] = (vaha[k] ?? 0) + d;
    }
  }
  const out: Record<string, unknown> = {};
  for (const k of KLICE) if (vaha[k]) out[k] = Math.round(soucet[k] / vaha[k]);
  if (dnySoucet > 0) out.dny_zapsano = dnySoucet;
  let weight: number | null = null;
  for (const r of serazene) {
    const w = num(r.weight) ?? num(r.vaha);
    if (w != null) weight = w;
  }
  return { nutrition: Object.keys(out).length ? out : null, weight };
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
  opts?: {
    syncedAt?: string;
    asOf?: string;
    /** Kolik týdnů se appky ptal volající (cron 4, tlačítko 12). Pojistka useknuté odpovědi. */
    tydnuMax?: number;
    /** Lhůta před založením řádku tvuj-coach podle kadence klienta (`graceDniProKadenci`). */
    graceDni?: number;
    /** Ručně posunutý další report klienta (`entitlements.dalsi_report`). */
    nejdrive?: string | null;
  },
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
  let obsazene_datum = 0;
  let created = 0;
  let filled = 0;
  const duvody: SyncDuvod[] = [];
  const emailLow = low(email);

  const queueUpdate = (
    hit: ExistingClientReport,
    weight: number | null,
    nutrition: Record<string, unknown> | null,
  ) => {
    toUpdate.push({
      id: hit.id ?? null,
      email: emailLow,
      report_date: hit.report_date,
      source: String(hit.source ?? ""),
      weight,
      nutrition,
      match: {
        weight: hit.weight ?? null,
        nutrition: hit.nutrition == null ? null : { ...hit.nutrition },
      },
    });
  };

  // Doplnění jednoho webového řádku z dat appky (jeden týden, nebo součet týdnů období).
  // ⛔ Klientova pole se nepřepisují (`mergeNutritionFromApp`), `dny` se nesahá, strava
  //    `null` („nezapisoval") zůstane null, váha jen když chybí.
  const doplnWeb = (
    hit: ExistingClientReport,
    appNutr: Record<string, unknown> | null,
    appVaha: number | null,
    tyden: string,
    popis: string,
    tydnyAppky?: string[],
  ) => {
    const merged = mergeNutritionFromApp(hit.nutrition, appNutr, syncedAt);
    let weight = weightKept(hit.weight);
    let vahaZAppky = false;
    if (weight == null && appVaha != null) {
      weight = appVaha;
      vahaZAppky = true;
    }
    let nutrition = merged.nutrition;
    if (nutrition && vahaZAppky) {
      const z = zAppkyOf(nutrition);
      if (!z.includes("vaha")) nutrition = { ...nutrition, z_appky: [...z, "vaha"] };
    }
    // U období se do snímku appky zapíše i to, ze kterých týdnů součet je.
    if (nutrition && tydnyAppky) nutrition = { ...nutrition, appka: { ...asObj(nutrition.appka), tydny: tydnyAppky } };
    const weightChanged = !sameScalar(hit.weight ?? null, weight);
    if (hit.nutrition === null && !weightChanged) {
      skipped_web++;
      duvody.push({ tyden, akce: "preskoceno", duvod: "web_strava_preskocena" });
      return;
    }
    if (!merged.changed && !weightChanged) {
      if (zAppkyOf(hit.nutrition ?? {}).length) {
        skipped_unchanged++;
        duvody.push({ tyden, akce: "preskoceno", duvod: "beze_zmeny" });
      } else {
        skipped_web++;
        duvody.push({ tyden, akce: "preskoceno", duvod: "web_kompletni" });
      }
      return;
    }
    queueUpdate(hit, weight, nutrition);
    filled++;
    duvody.push({
      tyden,
      akce: "doplneno",
      duvod: popis + (merged.filledKeys.concat(vahaZAppky ? ["vaha"] : []).join(",") || "update"),
      report_date: hit.report_date,
    });
  };

  const collapsed = collapseAppReports(reports ?? []);

  // ⭐ [5. 10. 2026] WEBOVÉ REPORTY ZA VÍC TÝDNŮ (uložené období): doplní se JEDNOU, ze součtu
  //    týdnů appky v období vážených zapsanými dny. V hlavní smyčce níž pak tyhle týdny jen
  //    „pokrývají" (žádný řádek tvuj-coach, žádné doplnění z jednoho týdne).
  const vsechnyTydnyAppky = [...new Set((reports ?? []).map((r) => isoWeekStart(reportDateOf(r))).filter(Boolean))].sort();
  for (const hit of existing) {
    if (low(hit.source) !== "web") continue;
    const tydny = tydnyRadku(hit);
    if (tydny.length < 2) continue;
    const tydnyObd = collapsed.filter((r) => !isEmptyReport(r) && tydny.includes(isoWeekStart(reportDateOf(r))));
    if (!tydnyObd.length) continue;   // appka za tohle období nic nemá
    // Kus týdne (report ve čtvrtek až sobotu) z týdenních dat appky poctivě spočítat nejde.
    if (!webJeZCelychTydnu(hit)) {
      skipped_web++;
      duvody.push({ tyden: tydny[0], akce: "preskoceno", duvod: "obdobi_neni_cele_tydny" });
      continue;
    }
    // ⛔ POJISTKA USEKNUTÍ: appka vrací posledních N týdnů S JAKÝMIKOLI DATY. Když jich přišlo
    //    plných N a nejstarší je novější než první týden období, začátek období v odpovědi
    //    chybí a součet by byl z neúplného období. Radši nedoplnit nic.
    if (opts?.tydnuMax && vsechnyTydnyAppky.length >= opts.tydnuMax && vsechnyTydnyAppky[0] > tydny[0]) {
      skipped_web++;
      duvody.push({ tyden: tydny[0], akce: "preskoceno", duvod: "obdobi_mimo_dosah_appky" });
      continue;
    }
    const agg = agregujTydnyAppky(tydnyObd);
    doplnWeb(hit, agg.nutrition, agg.weight, tydny[0], "prazdna_pole_z_appky_za_" + tydny.length + "_tydny:",
      tydnyObd.map((r) => isoWeekStart(reportDateOf(r))).sort());
  }

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
    const inWeek = existing.filter((r) => tydnyRadku(r).includes(week));
    const webHits = inWeek.filter((r) => low(r.source) === "web");
    const appHits = inWeek.filter((r) => isAppSource(r.source));
    if (webHits.length && appHits.length) kolize_tydnu++;

    if (webHits.length) {
      for (const hit of webHits) {
        // Report za víc týdnů se doplnil výš ze součtu, tady týden jen pokrývá.
        if (tydnyRadku(hit).length > 1) continue;
        if (!webJeZCelychTydnu(hit)) {
          skipped_web++;
          duvody.push({ tyden: week, akce: "preskoceno", duvod: "obdobi_neni_cele_tydny" });
          continue;
        }
        doplnWeb(hit, nutritionFromReport(report), num(report.weight) ?? num(report.vaha), week, "prazdna_pole_z_appky:");
      }
      continue;
    }

    if (appHits.length) {
      const hit = appHits[0];
      const row = mapTcReportToRow(email, report, targets);
      row.report_date = hit.report_date;
      const sameWeight = sameScalar(hit.weight ?? null, row.weight);
      const sameNut = !nutritionChanged(hit.nutrition ?? null, row.nutrition);
      if (sameWeight && sameNut) {
        skipped_unchanged++;
        duvody.push({ tyden: week, akce: "preskoceno", duvod: "tvuj-coach_beze_zmeny" });
        continue;
      }
      queueUpdate(hit, row.weight, row.nutrition);
      duvody.push({ tyden: week, akce: "aktualizovano", duvod: "radek_" + (low(hit.source) || "app") });
      continue;
    }

    // Web a appka už jsou vyřešené. Cokoli jiného ve týdnu (import-sheet, test-kopie,
    // neznámý source, prázdný source) založení zastaví. Do toho řádku se nezapisuje.
    // Výjimka: pondělí drží cizí řádek (do tohohle týdne nepatří) a neděle drží
    // ten jiný source. Pak se nezakládá a po lhůtě se počítá obsazene_datum.
    const sunday = addDays(week, 6);
    const mondayRows = existing.filter((r) => isoDate(r.report_date) === week);
    const sundayRows = existing.filter((r) => isoDate(r.report_date) === sunday);
    const otherHits = inWeek.filter((r) => low(r.source) !== "web" && !isAppSource(r.source));
    if (otherHits.length) {
      const mondayForeign = mondayRows.some((r) => !tydnyRadku(r).includes(week));
      const otherOnlyOnSunday = otherHits.every((r) => isoDate(r.report_date) === sunday);
      const bothDatesTaken = mondayForeign && sundayRows.length > 0 && otherOnlyOnSunday;
      if (!bothDatesTaken) {
        skipped_protected++;
        const src = low(otherHits[0].source) || "prazdny";
        const duvod = isProtectedSource(otherHits[0].source)
          ? "chraneny_zdroj_" + src
          : "neznamy_zdroj_" + src;
        duvody.push({ tyden: week, akce: "preskoceno", duvod });
        continue;
      }
    }

    // Do lhůty se nezakládá. Důvod je čekání na web, i když pondělí už drží cizí řádek.
    // Lhůta je delší u řidší kadence a do ručně posunutého dalšího reportu (fáze 2).
    if (!canCreateTvujCoach(week, asOf, { graceDni: opts?.graceDni, nejdrive: opts?.nejdrive })) {
      skipped_grace++;
      duvody.push({ tyden: week, akce: "preskoceno", duvod: "ceka_na_webovy_report" });
      continue;
    }

    // Insert jde na pondělí. Když to datum drží cizí řádek (web minulého týdne
    // `inWeek` nevidí), zkusí se neděle. Obsazené je kalendářní report_date.
    const insertDate = insertDatumTydne(week, existing);
    if (!insertDate) {
      obsazene_datum++;
      const blocker = mondayRows[0] ?? sundayRows[0];
      duvody.push({
        tyden: week,
        akce: "preskoceno",
        duvod: "obsazene_datum:" + (low(blocker?.source) || "prazdny"),
      });
      continue;
    }

    const row = mapTcReportToRow(email, report, targets);
    row.report_date = insertDate;
    toInsert.push(row);
    created++;
    duvody.push({
      tyden: week,
      akce: "zalozeno",
      duvod: insertDate === week ? "tyden_bez_webu" : "tyden_bez_webu:" + insertDate,
    });
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
    obsazene_datum,
    report_dates,
    duvody,
  };
}
