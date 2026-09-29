// Testy plánu zápisu týdenních dat z appky do client_reports.
// Spuštění: npx --yes deno@2 test --allow-read akademie/_supabase/functions/admin-api/tc-report-sync.test.ts
//
// ⛔ Neznámá hodnota není nula. ⛔ Žádný e-mail v assert zprávách.
import {
  applySyncPlan,
  canCreateTvujCoach,
  commitSyncPlan,
  cronResultBody,
  duvodyProTlacitko,
  existingDateWindow,
  extractTcReports,
  insertDatumTydne,
  isoWeekStart,
  isEmptyReport,
  isTcActive,
  mapTcReportToRow,
  num,
  reportMatchFilters,
  reportWriter,
  shouldUpsertExisting,
  syncReadError,
  TC_REPORT_SELECT,
  webReportWeek,
  type ClientReportRow,
  type ExistingClientReport,
  type MatchFilter,
  type SyncPlan,
  type SyncUpdate,
  type TcReport,
} from "./tc-report-sync.ts";

const NOW = "2026-09-29T10:00:00.000Z";
const EMAIL = "klient@example.com";

function appReport(date: string, nutrition: Record<string, unknown> | null, extra: Partial<TcReport> = {}): TcReport {
  return {
    report_date: date,
    week_start: date,
    weight: extra.weight ?? null,
    nutrition,
    measurements: extra.measurements ?? {},
    activity: extra.activity ?? {},
    scales: extra.scales ?? {},
    notes: extra.notes ?? {},
  };
}

function webRow(date: string, nutrition: Record<string, unknown> | null, extra: Partial<ExistingClientReport> = {}): ExistingClientReport {
  return {
    report_date: date,
    source: "web",
    weight: extra.weight ?? 80,
    nutrition,
    measurements: extra.measurements ?? { pas: 90 },
    activity: extra.activity ?? { kroky: 8000 },
    scales: extra.scales ?? {},
    notes: extra.notes ?? {},
    targets: extra.targets ?? null,
  };
}

function plan(reports: TcReport[], existing: ExistingClientReport[], opts?: { asOf?: string }) {
  return applySyncPlan(EMAIL, reports, existing, { kcal: 1800, protein: 140 }, {
    syncedAt: NOW,
    // 8. 10. je víc než 4 dny po neděli 27. 9., takže testy založení nejsou v ochranné lhůtě.
    asOf: opts?.asOf ?? "2026-10-08",
  });
}

function tvrd(podminka: boolean, popis: string) {
  if (!podminka) throw new Error("NESEDÍ: " + popis);
}

Deno.test("isoWeekStart: pondělí zůstane pondělím, neděle spadne na to pondělí", () => {
  tvrd(isoWeekStart("2026-09-21") === "2026-09-21", "pondělí 21. 9.");
  tvrd(isoWeekStart("2026-09-27") === "2026-09-21", "neděle 27. 9. → pondělí 21. 9.");
  tvrd(isoWeekStart("2026-09-01") === "2026-08-31", "úterý 1. 9. → pondělí 31. 8.");
  tvrd(isoWeekStart("2026-08-31") === "2026-08-31", "pondělí 31. 8.");
});

Deno.test("webReportWeek: report poslaný ne až st patří týdnu, který v neděli skončil", () => {
  tvrd(webReportWeek("2026-09-27") === "2026-09-21", "ne 27. 9.");
  tvrd(webReportWeek("2026-09-28") === "2026-09-21", "po 28. 9.");
  tvrd(webReportWeek("2026-09-29") === "2026-09-21", "út 29. 9.");
  tvrd(webReportWeek("2026-09-30") === "2026-09-21", "st 30. 9.");
  tvrd(webReportWeek("2026-10-01") === "2026-09-28", "čt 1. 10.");
  tvrd(webReportWeek("2026-10-03") === "2026-09-28", "so 3. 10.");
});

Deno.test("num: prázdno není nula", () => {
  tvrd(num(null) === null, "null");
  tvrd(num("") === null, "prázdný řetězec");
  tvrd(num("1,5") === 1.5, "čárka");
});

Deno.test("prázdný týden z appky se nezapisuje", () => {
  const p = plan([appReport("2026-09-21", null)], []);
  tvrd(p.toInsert.length === 0 && p.toUpdate.length === 0, "nic k zápisu");
  tvrd(p.skipped_empty === 1, "skipped_empty");
});

Deno.test("týden bez webu založí řádek tvuj-coach na pondělí", () => {
  const nutr = { kcal: 1900, protein: 140, carbs: 180, fat: 55, fiber: 28, dny_zapsano: 6 };
  const p = plan([appReport("2026-09-21", nutr, { weight: 79.2 })], []);
  tvrd(p.toInsert.length === 1, "jeden insert");
  tvrd(p.toUpdate.length === 0, "žádný update");
  tvrd(p.created === 1, "created");
  const row = p.toInsert[0];
  tvrd(row.source === "tvuj-coach", "zdroj");
  tvrd(row.report_date === "2026-09-21", "pondělí");
  tvrd(row.weight === 79.2, "váha");
  tvrd((row.nutrition as { kcal: number }).kcal === 1900, "kcal");
  tvrd((row.nutrition as { fiber: number }).fiber === 28, "vláknina");
});

Deno.test("web s prázdnými makry: doplní jen prázdná pole a nic nepřepíše", () => {
  const existing = [webRow("2026-09-28", { kcal: 1750, protein: 130, carbs: null, fat: null, fiber: null, dny_zapsano: 5 })];
  const app = appReport("2026-09-21", { kcal: 2000, protein: 160, carbs: 210, fat: 62, fiber: 30, dny_zapsano: 7 });
  const p = plan([app], existing);
  tvrd(p.toInsert.length === 0, "nezakládá druhý řádek");
  tvrd(p.toUpdate.length === 1, "update webu");
  tvrd(p.filled === 1, "filled");
  const n = p.toUpdate[0].nutrition as Record<string, unknown>;
  tvrd(n.kcal === 1750, "kcal klienta zůstalo");
  tvrd(n.protein === 130, "protein klienta zůstal");
  tvrd(n.carbs === 210, "sacharidy z appky");
  tvrd(n.fat === 62, "tuky z appky");
  tvrd(n.fiber === 30, "vláknina z appky");
  tvrd(n.dny_zapsano === 5, "dny_zapsano klientovo (neprázdné) se nepřepíše");
  const z = n.z_appky as string[];
  tvrd(Array.isArray(z) && z.includes("carbs") && z.includes("fat") && z.includes("fiber"), "z_appky");
  tvrd(!z.includes("kcal") && !z.includes("protein"), "klientova pole nejsou v z_appky");
  const snap = n.appka as Record<string, unknown>;
  tvrd(snap.kcal === 2000 && snap.protein === 160 && snap.carbs === 210, "snímek appky");
  tvrd(snap.synced_at === NOW, "synced_at");
  tvrd(p.toUpdate[0].source === "web", "zdroj zůstane web");
  tvrd(p.toUpdate[0].report_date === "2026-09-28", "datum webu se nemění");
});

Deno.test("web kompletní: nic se nezmění", () => {
  const existing = [webRow("2026-09-28", { kcal: 1750, protein: 130, carbs: 200, fat: 60, fiber: 25, dny_zapsano: 6 })];
  const app = appReport("2026-09-21", { kcal: 2000, protein: 160, carbs: 210, fat: 62, fiber: 30, dny_zapsano: 7 });
  const p = plan([app], existing);
  tvrd(p.toInsert.length === 0 && p.toUpdate.length === 0, "žádný zápis");
  tvrd(p.skipped_web === 1, "přeskočeno, web je plný");
});

Deno.test("párování týdnů: web v neděli, appka v pondělí téhož týdne", () => {
  const existing = [webRow("2026-09-27", { kcal: 1750, protein: 130, carbs: null, fat: null, fiber: null })];
  const app = appReport("2026-09-21", { kcal: 2000, protein: 160, carbs: 180, fat: 50, fiber: 22, dny_zapsano: 6 });
  const p = plan([app], existing);
  tvrd(p.toInsert.length === 0, "žádný nový řádek");
  tvrd(p.toUpdate.length === 1, "update nedělního webu");
  tvrd(p.toUpdate[0].report_date === "2026-09-27", "zachovat datum webu");
  const n = p.toUpdate[0].nutrition as Record<string, unknown>;
  tvrd(n.kcal === 1750, "kcal webu");
  tvrd(n.carbs === 180, "sacharidy z appky");
});

Deno.test("import-sheet se netkne", () => {
  const existing: ExistingClientReport[] = [{
    report_date: "2026-09-21",
    source: "import-sheet",
    weight: 90,
    nutrition: { kcal: 1 },
  }];
  const p = plan([appReport("2026-09-21", { kcal: 2000, protein: 150, carbs: 180, fat: 50, fiber: 20 })], existing);
  tvrd(p.toInsert.length === 0 && p.toUpdate.length === 0, "žádný zápis");
  tvrd(p.skipped_protected === 1, "skipped_protected");
});

Deno.test("test-kopie se netkne", () => {
  const existing: ExistingClientReport[] = [{
    report_date: "2026-09-21",
    source: "test-kopie",
    weight: 90,
    nutrition: { kcal: 1 },
  }];
  const p = plan([appReport("2026-09-21", { kcal: 2000, protein: 150 })], existing);
  tvrd(p.toInsert.length === 0 && p.toUpdate.length === 0, "žádný zápis");
  tvrd(p.skipped_protected === 1, "skipped_protected");
});

Deno.test("null zůstane null, když appka pole neposílá", () => {
  const existing = [webRow("2026-09-28", { kcal: 1750, protein: 130, carbs: null, fat: null, fiber: null })];
  const app = appReport("2026-09-21", { kcal: 2000, protein: 160, carbs: 180, fat: 50 });
  const p = plan([app], existing);
  const n = p.toUpdate[0].nutrition as Record<string, unknown>;
  tvrd(n.fiber === null, "vláknina pořád null");
  const z = n.z_appky as string[];
  tvrd(!z.includes("fiber"), "fiber není v z_appky");
  tvrd((n.appka as { fiber: unknown }).fiber == null, "snímek má fiber null");
});

Deno.test("opakovaný běh je idempotentní", () => {
  const existing = [webRow("2026-09-28", { kcal: 1750, protein: 130, carbs: null, fat: null, fiber: null })];
  const app = appReport("2026-09-21", { kcal: 2000, protein: 160, carbs: 180, fat: 50, fiber: 22, dny_zapsano: 6 });
  const p1 = plan([app], existing);
  tvrd(p1.toUpdate.length === 1, "první běh zapíše");
  const after: ExistingClientReport[] = [{
    ...existing[0],
    nutrition: p1.toUpdate[0].nutrition,
    weight: p1.toUpdate[0].weight,
  }];
  const p2 = plan([app], after);
  tvrd(p2.toInsert.length === 0 && p2.toUpdate.length === 0, "druhý běh nic");
  tvrd(p2.skipped_unchanged === 1, "skipped_unchanged");
});

Deno.test("dva datumy appky v jednom týdnu dají jeden řádek", () => {
  const a = appReport("2026-08-31", { kcal: 1800, protein: 140, carbs: 170, fat: 50, fiber: 20, dny_zapsano: 5 });
  const b = appReport("2026-09-01", { kcal: 1850, protein: 145, carbs: 175, fat: 52, fiber: 21, dny_zapsano: 6 }, { weight: 81 });
  const p = plan([a, b], []);
  tvrd(p.toInsert.length === 1, "jeden insert");
  tvrd(p.toInsert[0].report_date === "2026-08-31", "kanonické pondělí");
  tvrd(p.toInsert[0].weight === 81, "váha z úterního řádku, pondělí ji nemělo");
});

Deno.test("tvuj-coach se nezaloží pro týden ukončený před méně než 4 dny", () => {
  const nutr = { kcal: 1900, protein: 140, carbs: 180, fat: 55, fiber: 28, dny_zapsano: 6 };
  const app = [appReport("2026-09-21", nutr, { weight: 79.2 })];
  const pondeli = plan(app, [], { asOf: "2026-09-28" });
  tvrd(pondeli.toInsert.length === 0 && pondeli.created === 0, "pondělí, týden skončil včera");
  tvrd(pondeli.skipped_grace === 1, "čeká se");
  tvrd(pondeli.duvody.some((d) => d.duvod === "ceka_na_webovy_report"), "důvod");
  const streda = plan(app, [], { asOf: "2026-09-30" });
  tvrd(streda.toInsert.length === 0 && streda.skipped_grace === 1, "středa je 3 dny po neděli");
  const ctvrtek = plan(app, [], { asOf: "2026-10-01" });
  tvrd(ctvrtek.toInsert.length === 1 && ctvrtek.created === 1, "čtvrtek je 4 dny po neděli");
  tvrd(ctvrtek.toInsert[0].report_date === "2026-09-21", "pondělí týdne");
  tvrd(ctvrtek.toInsert[0].source === "tvuj-coach", "zdroj");
});

Deno.test("pondělní web se doplní z předchozího týdne a ne z nového", () => {
  const web = webRow("2026-09-28", { kcal: 1750, protein: 130, carbs: null, fat: null, fiber: null, dny_zapsano: 5 });
  const minuly = appReport("2026-09-21", { kcal: 2000, protein: 160, carbs: 210, fat: 62, fiber: 30, dny_zapsano: 7 });
  const doplneni = plan([minuly], [web], { asOf: "2026-09-29" });
  tvrd(doplneni.toInsert.length === 0, "nevzniká tvuj-coach");
  tvrd(doplneni.toUpdate.length === 1, "doplní se web");
  tvrd(doplneni.toUpdate[0].report_date === "2026-09-28", "datum odeslání zůstává");
  tvrd((doplneni.toUpdate[0].nutrition as { carbs: number }).carbs === 210, "sacharidy z týdne 21. 9.");
  tvrd(doplneni.kolize_tydnu === 0, "bez druhého řádku není kolize");

  const novy = appReport("2026-09-28", { kcal: 2100, protein: 170, carbs: 220, fat: 70, fiber: 32, dny_zapsano: 2 });
  const spatne = plan([novy], [web], { asOf: "2026-09-29" });
  tvrd(spatne.toUpdate.length === 0, "web 28. 9. nepatří týdnu od 28. 9.");
  tvrd(spatne.toInsert.length === 0, "nový týden v úterý ještě nemá tvuj-coach");
  tvrd(spatne.skipped_grace === 1, "týden od 28. 9. končí až 4. 10.");
  tvrd(spatne.kolize_tydnu === 0, "web je jiný týden");
});

Deno.test("kolize webu a tvuj-coach: počítá se, nic se nemaže", () => {
  const coach: ExistingClientReport = {
    report_date: "2026-09-21",
    source: "tvuj-coach",
    weight: 79,
    nutrition: { kcal: 2000, protein: 160, carbs: 210, fat: 62, fiber: 30, dny_zapsano: 7 },
  };
  const web = webRow("2026-09-28", { kcal: 1750, protein: 130, carbs: null, fat: null, fiber: null, dny_zapsano: 5 });
  const existing = [coach, web];
  const pred = JSON.stringify(existing);
  const app = appReport("2026-09-21", { kcal: 2000, protein: 160, carbs: 210, fat: 62, fiber: 30, dny_zapsano: 7 });
  const p = plan([app], existing);
  tvrd(JSON.stringify(existing) === pred, "vstupní řádky se nemění");
  tvrd(p.toInsert.length === 0, "tvuj-coach se nezakládá znovu a nic se nemaže");
  tvrd(!p.toUpdate.some((u) => u.report_date === "2026-09-21"), "datum ani řádek tvuj-coach se nepřepisuje");
  tvrd(p.kolize_tydnu === 1, "jedna kolize");
  tvrd(p.toUpdate.length === 1 && p.toUpdate[0].report_date === "2026-09-28", "doplní se web, datum zůstává");
  tvrd(p.toUpdate[0].source === "web", "zdroj webu zůstane web");
  const n = p.toUpdate[0].nutrition as Record<string, unknown>;
  tvrd(n.kcal === 1750 && n.carbs === 210, "kcal webu zůstane, sacharidy z appky");
  tvrd(!(n.z_appky as string[]).includes("kcal") && (n.z_appky as string[]).includes("carbs"), "značky");
  const po: ExistingClientReport[] = [
    coach,
    { ...web, nutrition: p.toUpdate[0].nutrition, weight: p.toUpdate[0].weight },
  ];
  const p2 = plan([app], po);
  tvrd(p2.kolize_tydnu === 1, "kolize zůstane vidět, i když už není co doplnit");
  tvrd(p2.toInsert.length === 0 && p2.toUpdate.length === 0, "druhý běh nic nezapíše a nic nesmaže");
});

Deno.test("extractTcReports bere reports i tydny", () => {
  const a = extractTcReports({ reports: [{ report_date: "2026-09-21", nutrition: { kcal: 1 } }] });
  tvrd(a.length === 1 && a[0].report_date === "2026-09-21", "reports");
  const b = extractTcReports({
    tydny: [{ tyden: "2026-09-21", kcal: 1900, protein: 140, dny_zapsano: 5, vaha: 80, treninky: 3 }],
  });
  tvrd(b.length === 1, "tydny");
  tvrd(b[0].report_date === "2026-09-21", "datum z tyden");
  tvrd(b[0].weight === 80, "váha");
  tvrd((b[0].nutrition as { kcal: number }).kcal === 1900, "kcal zabalené do nutrition");
  tvrd((b[0].activity as { fitko: number }).fitko === 3, "tréninky → fitko");
});

Deno.test("existingDateWindow pokrývá neděli i pondělí týdne", () => {
  const w = existingDateWindow([appReport("2026-09-21", { kcal: 1 })]);
  tvrd(!!w, "okno existuje");
  tvrd(w!.from === "2026-09-21", "from pondělí");
  tvrd(w!.to === "2026-09-30", "to středa po neděli, ať se načte web poslaný po až st");
  tvrd(w!.to >= "2026-09-27", "neděle týdne je uvnitř");
  const w2 = existingDateWindow([appReport("2026-09-28", { kcal: 1 })]);
  tvrd(!!w2 && w2.from <= "2026-10-04" && w2.to >= "2026-10-04", "neděle 4. 10. je v okně týdne od 28. 9.");
});

Deno.test("mapTcReportToRow: prázdné nutrition je null, ne nuly", () => {
  const row = mapTcReportToRow(EMAIL, appReport("2026-09-21", null, { weight: 80 }), null);
  tvrd(row.nutrition === null, "nutrition null");
  tvrd(row.weight === 80, "váha");
});

Deno.test("isEmptyReport: samotné prázdné objekty jsou prázdný týden", () => {
  tvrd(isEmptyReport(appReport("2026-09-21", null)), "prázdný");
  tvrd(!isEmptyReport(appReport("2026-09-21", { kcal: 1800 })), "má jídlo");
});

Deno.test("cron i admin-api importují tentýž applySyncPlan (zdroj)", async () => {
  const cron = await Deno.readTextFile(new URL("../tc-client-reports-sync/index.ts", import.meta.url));
  const admin = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  tvrd(cron.includes('from "../admin-api/tc-report-sync.ts"'), "cron import");
  tvrd(cron.includes("applySyncPlan("), "cron volá applySyncPlan");
  tvrd(admin.includes("applySyncPlan("), "admin-api volá applySyncPlan");
  tvrd(cron.includes("kolize_tydnu"), "cron vrací kolize_tydnu");
  tvrd(admin.includes("kolize_tydnu"), "admin vrací kolize_tydnu");
  const odeslani = await Deno.readTextFile(new URL("../client-report/index.ts", import.meta.url));
  tvrd(!odeslani.includes("planWebSubmit"), "client-report planWebSubmit nevolá");
  tvrd(!odeslani.includes("tc-report-sync"), "client-report sync modul neimportuje");
});

const WEB_ID = "6f1e2d3c-4b5a-6789-aaaa-bbbbccccdddd";
const JINY_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

type MemRow = {
  id: string;
  email: string;
  report_date: string;
  source: string;
  weight: number | string | null;
  nutrition: Record<string, unknown> | null;
  measurements: Record<string, unknown>;
  activity: Record<string, unknown>;
  scales: Record<string, unknown>;
  notes: Record<string, unknown>;
  targets: Record<string, unknown> | null;
};

function scenarioWeb(): MemRow {
  return {
    id: WEB_ID,
    email: EMAIL,
    report_date: "2026-09-28",
    source: "web",
    weight: 80,
    nutrition: {
      kcal: 1750,
      protein: 130,
      carbs: null,
      fat: null,
      fiber: null,
      dny_zapsano: 5,
      dny: [{ den: "Po", kcal: 1700 }],
    },
    measurements: { pas: 90 },
    activity: { kroky: 8000, plan_next: "pokracovat" },
    scales: { unava: 3 },
    notes: { povedlo: "chodil" },
    targets: { kcal: 1700 },
  };
}

function tyden21(): TcReport {
  return appReport("2026-09-21", {
    kcal: 2000, protein: 160, carbs: 210, fat: 62, fiber: 30, dny_zapsano: 7,
  }, { weight: 79 });
}

function tyden28(): TcReport {
  return appReport("2026-09-28", {
    kcal: 2100, protein: 170, carbs: 220, fat: 70, fiber: 32, dny_zapsano: 2,
  }, { weight: 78.4 });
}

function rowMatches(row: MemRow, f: MatchFilter): boolean {
  let v: unknown;
  if (f.column.startsWith("nutrition->>")) {
    const k = f.column.slice("nutrition->>".length);
    v = row.nutrition == null ? null : row.nutrition[k];
    if (v === undefined) v = null;
  } else {
    v = (row as unknown as Record<string, unknown>)[f.column];
  }
  if (f.op === "is") return v == null;
  return v != null && String(v) === f.value;
}

function fakeAdmin(table: MemRow[]) {
  const api = {
    inserts: 0,
    updates: 0,
    from(tableName: string) {
      tvrd(tableName === "client_reports", "zápis jen do client_reports");
      return {
        insert(rows: ClientReportRow[]) {
          api.inserts++;
          for (const r of rows) {
            if (table.some((x) => x.email === r.email && x.report_date === r.report_date)) {
              return Promise.resolve({ error: { message: "duplicate" }, data: null });
            }
            table.push({
              id: "new-" + r.report_date,
              email: r.email,
              report_date: r.report_date,
              source: r.source,
              weight: r.weight,
              nutrition: r.nutrition,
              measurements: r.measurements,
              activity: r.activity,
              scales: r.scales,
              notes: r.notes,
              targets: r.targets,
            });
          }
          return Promise.resolve({ error: null, data: null });
        },
        update(values: { weight: number | null; nutrition: Record<string, unknown> | null }) {
          api.updates++;
          const keys = Object.keys(values).sort().join(",");
          tvrd(keys === "nutrition,weight", "update nese jen váhu a nutrition");
          const filters: MatchFilter[] = [];
          const q = {
            eq(c: string, v: string) {
              filters.push({ column: c, op: "eq" as const, value: v });
              return q;
            },
            is(c: string, v: null) {
              filters.push({ column: c, op: "is" as const, value: v });
              return q;
            },
            select(_cols: string) {
              const hit = table.filter((row) => filters.every((f) => rowMatches(row, f)));
              for (const row of hit) {
                row.weight = values.weight;
                row.nutrition = values.nutrition;
              }
              return Promise.resolve({ data: hit.map((r) => ({ id: r.id })), error: null });
            },
          };
          return q;
        },
      };
    },
  };
  return api;
}

function prazdnyPlan(over: Partial<SyncPlan> = {}): SyncPlan {
  return {
    toInsert: [],
    toUpdate: [],
    toUpsert: [],
    synced: 0,
    created: 0,
    filled: 0,
    skipped_web: 0,
    skipped_protected: 0,
    skipped_empty: 0,
    skipped_unchanged: 0,
    skipped_grace: 0,
    kolize_tydnu: 0,
    obsazene_datum: 0,
    report_dates: [],
    duvody: [],
    ...over,
  };
}

Deno.test("nález 1: pondělní web po lhůtě zůstane web a na 28. 9. se nezaloží", async () => {
  tvrd(canCreateTvujCoach("2026-09-28", "2026-10-12") === true, "lhůta už prošla, grace to nesmí schovat");
  tvrd(webReportWeek("2026-09-28") === "2026-09-21", "pondělní web patří týdnu od 21. 9.");
  const okno = existingDateWindow([tyden21(), tyden28()]);
  tvrd(!!okno && okno.from === "2026-09-21" && okno.to === "2026-10-07", "okno od prvního pondělí plus 9 dní");
  tvrd(!!okno && okno.from <= "2026-09-28" && okno.to >= "2026-09-28", "pondělí 28. 9. je v okně");
  tvrd(!!okno && okno.from <= "2026-10-04" && okno.to >= "2026-10-04", "neděle 4. 10. je v okně");
  tvrd(TC_REPORT_SELECT.includes("id") && TC_REPORT_SELECT.includes("source"), "select čte id a source");

  const web = scenarioWeb();
  const p = plan([tyden21(), tyden28()], [web], { asOf: "2026-10-12" });
  tvrd(p.toInsert.length === 1 && p.toInsert[0].report_date === "2026-10-04", "týden 28. 9. jde na neděli, ne na 28. 9.");
  tvrd(p.toInsert[0].source === "tvuj-coach", "nový řádek je tvuj-coach");
  tvrd(!p.toInsert.some((r) => r.report_date === "2026-09-28" || r.report_date === "2026-09-21"), "na pondělí webu ani na 21. 9. se nezakládá");
  tvrd(p.created === 1, "created 1");
  tvrd(p.obsazene_datum === 0, "neděle byla volná");
  tvrd(p.toUpdate.length === 1 && p.toUpdate[0].report_date === "2026-09-28", "druhý zápis je doplnění webu");
  tvrd(p.toUpdate[0].source === "web", "source ve filtru zůstane web");
  for (const k of ["measurements", "activity", "scales", "notes", "targets"]) {
    tvrd(!(k in p.toUpdate[0]), "update nemá " + k);
  }
  const n = p.toUpdate[0].nutrition as Record<string, unknown>;
  tvrd(n.kcal === 1750, "kcal klienta");
  tvrd(n.protein === 130, "protein klienta");
  tvrd(n.dny_zapsano === 5, "dny_zapsano klienta");
  tvrd(n.carbs === 210 && n.fat === 62 && n.fiber === 30, "prázdná makra z týdne 21. 9., ne z 28. 9.");
  tvrd((n.appka as { kcal: number }).kcal === 2000, "snímek je týden 21. 9.");
  const dny = n.dny as { den: string; kcal: number }[];
  tvrd(dny.length === 1 && dny[0].den === "Po" && dny[0].kcal === 1700, "denní rozpis zůstal");
  tvrd(p.toUpdate[0].weight === 80, "váha klienta");

  const filtry = reportMatchFilters(p.toUpdate[0]);
  tvrd(!!filtry, "filtr se postaví, řádek má id");
  const filtr = (c: string) => filtry!.find((f) => f.column === c);
  tvrd(filtr("id")?.op === "eq" && filtr("id")?.value === WEB_ID, "filtr id");
  tvrd(filtr("source")?.value === "web", "filtr source");
  tvrd(filtr("nutrition->>kcal")?.op === "eq" && filtr("nutrition->>kcal")?.value === "1750", "filtr kcal");
  tvrd(filtr("nutrition->>protein")?.value === "130", "filtr protein");
  tvrd(filtr("nutrition->>carbs")?.op === "is", "carbs bylo null");
  tvrd(filtr("nutrition->>fat")?.op === "is" && filtr("nutrition->>fiber")?.op === "is", "fat a fiber null");
  tvrd(filtr("nutrition->>dny_zapsano")?.value === "5", "filtr dny_zapsano");
  tvrd(filtr("weight")?.op === "eq" && filtr("weight")?.value === "80", "filtr váhy");

  const decoy: MemRow = {
    ...web,
    id: JINY_ID,
    measurements: { pas: 1 },
    nutrition: { ...web.nutrition },
    activity: { ...web.activity },
    notes: { ...web.notes },
    scales: { ...web.scales },
    targets: { kcal: 1700 },
  };
  const table = [web, decoy];
  const admin = fakeAdmin(table);
  const committed = await commitSyncPlan(p, reportWriter(admin));
  tvrd(committed.error === null, "zápis prošel");
  tvrd(admin.inserts === 1, "insert jen na volnou neděli");
  tvrd(committed.filled === 1 && committed.zmeneno_mezitim === 0, "doplnění trefilo jeden řádek");
  tvrd(committed.inserted === 1, "vznikl jeden řádek");
  tvrd(table.length === 3, "přibyl jen řádek na neděli");
  tvrd(table.filter((r) => r.report_date === "2026-09-28").length === 2, "na 28. 9. nepřibyl třetí řádek");
  const novy = table.find((r) => r.report_date === "2026-10-04");
  tvrd(!!novy && novy.source === "tvuj-coach", "nedělní řádek je tvuj-coach");
  tvrd(web.source === "web", "source webu");
  tvrd(web.weight === 80, "váha po zápisu");
  tvrd((web.nutrition as { kcal: number }).kcal === 1750, "kcal po zápisu");
  tvrd((web.nutrition as { carbs: number }).carbs === 210, "carbs po zápisu");
  tvrd(web.measurements.pas === 90, "míry");
  tvrd(web.activity.plan_next === "pokracovat", "aktivita");
  tvrd(web.scales.unava === 3, "škály");
  tvrd(web.notes.povedlo === "chodil", "poznámky");
  tvrd(web.targets?.kcal === 1700, "targets snímku");
  tvrd((decoy.nutrition as { carbs: unknown }).carbs == null, "druhý řádek se stejným datem se nepsal");
  tvrd(decoy.measurements.pas === 1, "druhý řádek má svoje míry");

  const ulozeno = scenarioWeb();
  ulozeno.nutrition = { ...(web.nutrition as Record<string, unknown>) };
  ulozeno.nutrition.carbs = String(ulozeno.nutrition.carbs);
  ulozeno.nutrition.fat = String(ulozeno.nutrition.fat);
  ulozeno.nutrition.fiber = String(ulozeno.nutrition.fiber);
  ulozeno.weight = "80";
  const coachPoPrvnim: ExistingClientReport = {
    id: "new-2026-10-04",
    report_date: p.toInsert[0].report_date,
    source: p.toInsert[0].source,
    weight: p.toInsert[0].weight,
    nutrition: p.toInsert[0].nutrition,
  };
  const druhe = plan([tyden21(), tyden28()], [ulozeno, coachPoPrvnim], { asOf: "2026-10-19" });
  tvrd(druhe.toInsert.length === 0, "druhý běh nezaloží další řádek");
  tvrd(druhe.toUpdate.length === 0, "řetězec 210 je totéž co 210 a nedělní řádek sedí");
  tvrd(druhe.skipped_unchanged === 2, "oba týdny beze změny");
  tvrd(druhe.obsazene_datum === 0, "nedělní řádek se našel");
  tvrd(ulozeno.source === "web", "source je pořád web");
});

Deno.test("nález 1: jen novější týden po lhůtě web na pondělí nepřepíše", () => {
  tvrd(canCreateTvujCoach("2026-09-28", "2026-10-12") === true, "lhůta prošla");
  const web = scenarioWeb();
  const p = plan([tyden28()], [web], { asOf: "2026-10-12" });
  tvrd(p.toInsert.length === 1 && p.toInsert[0].report_date === "2026-10-04", "insert na neděli");
  tvrd(p.toInsert[0].source === "tvuj-coach", "zdroj");
  tvrd(p.toUpdate.length === 0, "pondělní web se nepřepisuje");
  tvrd(p.obsazene_datum === 0, "neděle byla volná");
  tvrd(p.skipped_grace === 0, "není to ochranná lhůta");
  tvrd(web.source === "web" && web.report_date === "2026-09-28", "řádek webu zůstal");
});

Deno.test("R2 nález 3: obsazené pondělí založí týden na neděli a druhý běh ho najde", () => {
  tvrd(isoWeekStart("2026-10-04") === "2026-09-28", "neděle 4. 10. patří k pondělí 28. 9.");
  tvrd(webReportWeek("2026-10-04") === "2026-09-28", "web v neděli patří stejnému týdnu");
  tvrd(insertDatumTydne("2026-09-28", []) === "2026-09-28", "volné pondělí");
  const monday = webRow("2026-09-28", { kcal: 1750, protein: 130, carbs: 200, fat: 60, fiber: 25, dny_zapsano: 6 });
  tvrd(insertDatumTydne("2026-09-28", [monday]) === "2026-10-04", "neděle, když je pondělí obsazené");
  tvrd(webReportWeek(monday.report_date) === "2026-09-21", "pondělní web patří týdnu od 21. 9.");

  const brzy = plan([tyden28()], [monday], { asOf: "2026-10-07" });
  tvrd(brzy.toInsert.length === 0 && brzy.skipped_grace === 1, "7. 10. je pořád ve lhůtě");

  const prvni = plan([tyden28()], [monday], { asOf: "2026-10-12" });
  tvrd(prvni.toInsert.length === 1, "jeden insert");
  tvrd(prvni.toInsert[0].report_date === "2026-10-04", "datum je neděle 4. 10.");
  tvrd(prvni.toInsert[0].source === "tvuj-coach", "zdroj");
  tvrd(prvni.toInsert[0].weight === 78.4, "váha týdne 28. 9.");
  tvrd((prvni.toInsert[0].nutrition as { kcal: number }).kcal === 2100, "kcal týdne 28. 9.");
  tvrd(prvni.toUpdate.length === 0, "pondělní web se nepřepisuje");
  tvrd(prvni.obsazene_datum === 0 && prvni.created === 1, "neděle byla volná");
  tvrd(prvni.duvody.some((d) => d.duvod === "tyden_bez_webu:2026-10-04"), "důvod nese datum neděle");
  const okno = existingDateWindow([tyden28()]);
  tvrd(!!okno && okno.from <= "2026-10-04" && okno.to >= "2026-10-04", "načtení neděli pokryje");

  const coach: ExistingClientReport = {
    id: "coach-nedele",
    report_date: "2026-10-04",
    source: "tvuj-coach",
    weight: prvni.toInsert[0].weight,
    nutrition: prvni.toInsert[0].nutrition,
  };
  const stejne = plan([tyden28()], [monday, coach], { asOf: "2026-10-19" });
  tvrd(stejne.toInsert.length === 0 && stejne.toUpdate.length === 0, "druhý běh se stejnými čísly nezakládá ani nezapisuje");

  const starsi: ExistingClientReport = {
    id: "coach-nedele",
    report_date: "2026-10-04",
    source: "tvuj-coach",
    weight: 70,
    nutrition: { kcal: 1, protein: 1, carbs: 1, fat: 1, fiber: 1, dny_zapsano: 1 },
  };
  const jine = plan([tyden28()], [monday, starsi], { asOf: "2026-10-19" });
  tvrd(jine.toInsert.length === 0, "druhý běh nezaloží další řádek");
  tvrd(jine.toUpdate.length === 1 && jine.toUpdate[0].report_date === "2026-10-04", "update řádku 4. 10.");
  tvrd(jine.toUpdate[0].source === "tvuj-coach", "source zůstane tvuj-coach");
  tvrd(jine.toUpdate[0].weight === 78.4, "nová váha");

  const appRadek: ExistingClientReport = { ...starsi, id: "app-nedele", source: "app" };
  const appPlan = plan([tyden28()], [monday, appRadek], { asOf: "2026-10-19" });
  tvrd(appPlan.toInsert.length === 0 && appPlan.toUpdate.length === 1, "app na neděli se aktualizuje");
  tvrd(appPlan.toUpdate[0].report_date === "2026-10-04" && appPlan.toUpdate[0].source === "app", "datum i source app");
});

Deno.test("R2 nález 3: pondělí i neděle obsazené, nic a obsazene_datum", () => {
  const monday = webRow("2026-09-28", { kcal: 1750, protein: 130, carbs: 200, fat: 60, fiber: 25, dny_zapsano: 6 });
  const sunday: ExistingClientReport = {
    report_date: "2026-10-04",
    source: "import-sheet",
    weight: 90,
    nutrition: { kcal: 1 },
  };
  tvrd(insertDatumTydne("2026-09-28", [monday, sunday]) === null, "obě data drží řádek");
  const p = plan([tyden28()], [monday, sunday], { asOf: "2026-10-12" });
  tvrd(p.toInsert.length === 0 && p.toUpdate.length === 0, "nic se nezapíše");
  tvrd(p.obsazene_datum === 1, "obsazene_datum");
  tvrd(p.skipped_protected === 0, "není to přeskočení chráněného týdne");
  tvrd(p.duvody.some((d) => d.duvod === "obsazene_datum:web"), "důvod nese source pondělního řádku");
  tvrd(monday.source === "web" && sunday.source === "import-sheet", "vstupní řádky se nemění");

  const veLhu = plan([tyden28()], [monday, sunday], { asOf: "2026-10-07" });
  tvrd(veLhu.toInsert.length === 0 && veLhu.skipped_grace === 1, "před lhůtou se nezakládá");
  tvrd(veLhu.obsazene_datum === 0, "ve lhůtě ještě není obsazene_datum");

  const jenNedele = plan([tyden28()], [sunday], { asOf: "2026-10-12" });
  tvrd(jenNedele.toInsert.length === 0 && jenNedele.skipped_protected === 1, "chráněná neděle bez cizího pondělí týden přeskočí");
  tvrd(jenNedele.obsazene_datum === 0, "volné pondělí není obsazene_datum");
});

Deno.test("R2 nález 3: web v neděli 4. 10. se doplní a insert nevznikne", () => {
  const monday = webRow("2026-09-28", { kcal: 1750, protein: 130, carbs: 200, fat: 60, fiber: 25, dny_zapsano: 6 });
  const sunday = webRow("2026-10-04", { kcal: 1750, protein: 130, carbs: null, fat: null, fiber: null, dny_zapsano: 4 });
  sunday.id = "nedelni-web";
  const p = plan([tyden28()], [monday, sunday], { asOf: "2026-10-12" });
  tvrd(p.toInsert.length === 0, "žádný insert");
  tvrd(p.obsazene_datum === 0 && p.created === 0, "web má přednost");
  tvrd(p.toUpdate.length === 1 && p.toUpdate[0].report_date === "2026-10-04", "doplní se nedělní web");
  tvrd(p.toUpdate[0].source === "web", "source zůstane web");
  const n = p.toUpdate[0].nutrition as Record<string, unknown>;
  tvrd(n.kcal === 1750 && n.carbs === 220, "kcal webu, sacharidy z týdne 28. 9.");
  tvrd(p.duvody.some((d) => d.akce === "doplneno" && d.report_date === "2026-10-04"), "důvod nese datum webu");

  const plny = webRow("2026-10-04", { kcal: 1750, protein: 130, carbs: 200, fat: 60, fiber: 25, dny_zapsano: 4 });
  const hotovo = plan([tyden28()], [monday, plny], { asOf: "2026-10-12" });
  tvrd(hotovo.toInsert.length === 0 && hotovo.toUpdate.length === 0, "plný nedělní web se nezakládá znovu");
});

Deno.test("R2 nález 4: doplneno v seznamu jen když update řádek zapsal", async () => {
  const a = scenarioWeb();
  const b = scenarioWeb();
  b.id = JINY_ID;
  b.report_date = "2026-10-04";
  const p = plan([tyden21(), tyden28()], [a, b], { asOf: "2026-10-12" });
  const doplneno = p.duvody.filter((d) => d.akce === "doplneno");
  tvrd(doplneno.length === 2, "plán má dvě doplnění");
  tvrd(p.toInsert.length === 0, "vedle webů se nezakládá");
  const predZap = duvodyProTlacitko(p.duvody, []);
  tvrd(predZap.filter((d) => d.akce === "doplneno").length === 2, "když se nic neminulo, obě doplnění zůstanou");
  tvrd(predZap.every((d) => !("report_date" in d)), "seznam report_date nevrací");

  a.nutrition = { ...(a.nutrition as Record<string, unknown>), kcal: 1800 };
  const table = [a, b];
  const committed = await commitSyncPlan(p, reportWriter(fakeAdmin(table)));
  tvrd(committed.filled === 1 && committed.zmeneno_mezitim === 1, "jedno zapsané, jedno minutí");
  tvrd(committed.zmeneno_datum[0] === "2026-09-28", "minuté datum je pondělní web, ne týden");
  const seznam = duvodyProTlacitko(p.duvody, committed.zmeneno_datum);
  tvrd(seznam.filter((d) => d.akce === "doplneno").length === 1, "doplneno jen u zapsaného");
  tvrd(seznam.some((d) => d.akce === "doplneno" && d.tyden === "2026-09-28"), "zůstane týden nedělního webu");
  const miss = seznam.filter((d) => d.duvod === "zmeneno_mezitim");
  tvrd(miss.length === 1 && miss[0].akce === "preskoceno" && miss[0].tyden === "2026-09-21", "minutý týden je 21. 9.");
  tvrd(seznam.every((d) => !("report_date" in d)), "ani po minutí se report_date nevrací");
  tvrd((b.nutrition as { carbs: number }).carbs === 220, "nedělní web se zapsal");
  tvrd((a.nutrition as { kcal: number }).kcal === 1800, "minutý pondělní web zůstal");
});

Deno.test("nález 3: update po změně kcal neprojde a započte se zmeneno_mezitim", async () => {
  const web = scenarioWeb();
  const p = plan([tyden21()], [web], { asOf: "2026-10-12" });
  tvrd(p.toUpdate.length === 1, "plán doplnění");
  web.nutrition = {
    ...(web.nutrition as Record<string, unknown>),
    kcal: 1800,
    dny: [{ den: "Ut", kcal: 1 }],
  };
  web.measurements = { pas: 77 };
  const table = [web];
  const committed = await commitSyncPlan(p, reportWriter(fakeAdmin(table)));
  tvrd(committed.error === null, "není to chyba databáze");
  tvrd(committed.zmeneno_mezitim === 1 && committed.filled === 0, "0 řádků");
  tvrd(committed.zmeneno_datum[0] === "2026-09-28", "datum, které se netrefilo");
  tvrd((web.nutrition as { kcal: number }).kcal === 1800, "nová kcal zůstala");
  tvrd(((web.nutrition as { dny: { den: string }[] }).dny)[0].den === "Ut", "nový rozpis zůstal");
  tvrd(web.measurements.pas === 77, "nové míry zůstaly");
  tvrd(web.source === "web" && web.targets?.kcal === 1700, "source a targets");
});

Deno.test("nález 3: bez id se update neodešle", async () => {
  const p = plan([tyden21()], [scenarioWeb()], { asOf: "2026-10-12" });
  p.toUpdate[0].id = null;
  let volano = 0;
  const r = await commitSyncPlan(p, {
    insert: async () => ({ error: null }),
    update: async () => {
      volano++;
      return { error: null, rows: [{ id: WEB_ID }] };
    },
  });
  tvrd(r.error === "bez_id", "bez id je chyba, ne zápis");
  tvrd(volano === 0, "update se nevolal");
  tvrd(reportMatchFilters(p.toUpdate[0]) === null, "filtr bez id není");
});

Deno.test("nález 4: existující tvuj-coach i app se updatují jen ve váze a nutrition", async () => {
  const hit: MemRow = {
    id: WEB_ID,
    email: EMAIL,
    report_date: "2026-09-21",
    source: "tvuj-coach",
    weight: 79,
    nutrition: { kcal: 1900, protein: 150, carbs: 200, fat: 60, fiber: 25, dny_zapsano: 6 },
    measurements: { pas: 88 },
    activity: { fitko: 3 },
    scales: { sila: 4 },
    notes: { povedlo: "chodil" },
    targets: { kcal: 1700 },
  };
  const stejne = appReport("2026-09-21", {
    kcal: "1900", protein: "150", carbs: "200", fat: "60", fiber: "25", dny_zapsano: "6",
  }, { weight: 79 });
  const bezeZmeny = applySyncPlan(EMAIL, [stejne], [hit], { kcal: 1800 }, { syncedAt: NOW, asOf: "2026-10-08" });
  tvrd(bezeZmeny.toInsert.length === 0 && bezeZmeny.toUpdate.length === 0, "řetězec 1900 = 1900, nic se nezapíše");

  const jine = appReport("2026-09-21", {
    kcal: 2000, protein: 160, carbs: 210, fat: 62, fiber: 30, dny_zapsano: 7,
  }, { weight: 78 });
  const p = applySyncPlan(EMAIL, [jine], [hit], { kcal: 1800 }, { syncedAt: NOW, asOf: "2026-10-08" });
  tvrd(p.toInsert.length === 0, "žádný upsert celého řádku");
  tvrd(p.toUpdate.length === 1, "update");
  tvrd(!JSON.stringify(p.toUpdate).includes("1800"), "dnešní targets v payloadu nejsou");
  for (const k of ["measurements", "activity", "scales", "notes", "targets"]) {
    tvrd(!(k in p.toUpdate[0]), k);
  }
  const table = [hit];
  const committed = await commitSyncPlan(p, reportWriter(fakeAdmin(table)));
  tvrd(committed.error === null && committed.updated === 1 && committed.filled === 0, "app řádek není webové doplnění");
  tvrd(hit.measurements.pas === 88, "míry");
  tvrd(hit.notes.povedlo === "chodil", "poznámky");
  tvrd(hit.activity.fitko === 3, "aktivita");
  tvrd(hit.scales.sila === 4, "škály");
  tvrd(hit.targets?.kcal === 1700, "starý snímek targets");
  tvrd(hit.weight === 78, "nová váha");
  tvrd((hit.nutrition as { kcal: number }).kcal === 2000, "nová výživa");
  tvrd(hit.source === "tvuj-coach", "source");

  const appHit: MemRow = { ...hit, id: JINY_ID, source: "app", nutrition: { kcal: 1 }, weight: 70, targets: { kcal: 1700 } };
  const pApp = applySyncPlan(EMAIL, [jine], [appHit], { kcal: 1800 }, { syncedAt: NOW, asOf: "2026-10-08" });
  tvrd(pApp.toInsert.length === 0 && pApp.toUpdate.length === 1 && pApp.toUpdate[0].source === "app", "source app je update");
});

Deno.test("nález 6: neznámý source týden přeskočí a nic nezaloží", () => {
  for (const source of ["neznamy", "intake-baseline"]) {
    const existing: ExistingClientReport[] = [{
      report_date: "2026-09-27",
      source,
      weight: 90,
      nutrition: { kcal: 1 },
    }];
    const p = plan([tyden21()], existing);
    tvrd(p.toInsert.length === 0 && p.toUpdate.length === 0, source + " žádný zápis");
    tvrd(p.skipped_protected === 1, source + " se počítá jako přeskočený týden");
    tvrd(p.duvody.some((d) => d.duvod.startsWith("neznamy_zdroj_")), source + " má důvod");
  }
});

Deno.test("nález 8: druhý běh s řetězcem 210 nezapíše znovu", () => {
  const web = webRow("2026-09-28", { kcal: 1750, protein: 130, carbs: null, fat: null, fiber: null, dny_zapsano: 5 });
  const app = tyden21();
  const p1 = plan([app], [web]);
  tvrd(p1.toUpdate.length === 1, "první běh doplní");
  const nutr = { ...(p1.toUpdate[0].nutrition as Record<string, unknown>) };
  nutr.carbs = "210";
  nutr.fat = "62";
  nutr.fiber = "30";
  const p2 = plan([app], [{ ...web, nutrition: nutr, weight: "80" }]);
  tvrd(p2.toInsert.length === 0 && p2.toUpdate.length === 0, "druhý běh je idempotentní");
  tvrd(p2.skipped_unchanged === 1, "beze změny");
});

Deno.test("nula není prázdná a null nutrition se z appky nedoplní", () => {
  const existing = [webRow("2026-09-27", { kcal: 0, protein: 130, carbs: "", fat: null, fiber: null, dny_zapsano: 5 }, { weight: 0 })];
  const app = appReport("2026-09-21", { kcal: 2000, protein: 160, carbs: 180, fat: 50, fiber: 22, dny_zapsano: 6 }, { weight: 70 });
  const p = plan([app], existing);
  tvrd(p.toUpdate.length === 1, "doplní se prázdné sacharidy");
  tvrd(p.toUpdate[0].weight === 0, "váha 0");
  const n = p.toUpdate[0].nutrition as Record<string, unknown>;
  tvrd(n.kcal === 0, "kcal 0");
  tvrd(n.carbs === 180, "prázdný řetězec se doplnil");

  const row = webRow("2026-09-27", { kcal: 1 });
  row.nutrition = null;
  row.weight = null;
  const p2 = plan([app], [row]);
  tvrd(p2.toUpdate.length === 1, "váha se doplní");
  tvrd(p2.toUpdate[0].weight === 70, "váha z appky");
  tvrd(p2.toUpdate[0].nutrition === null, "nutrition zůstane null");
});

Deno.test("upsert existujícího řádku je zakázaný a chyba insertu zastaví update", async () => {
  tvrd(shouldUpsertExisting("web") === false, "web");
  tvrd(shouldUpsertExisting("tvuj-coach") === false, "tvuj-coach");
  tvrd(shouldUpsertExisting("neznamy") === false, "neznámý");
  tvrd(shouldUpsertExisting(null) === false, "prázdný source");
  tvrd(shouldUpsertExisting(undefined) === false, "chybějící source");

  const novy = plan([tyden21()], []);
  tvrd(novy.toInsert.length === 1 && novy.toInsert[0].source === "tvuj-coach", "volný týden se založí");
  let updaty = 0;
  const pad = await commitSyncPlan(novy, {
    insert: async () => ({ error: { message: "duplicate" } }),
    update: async () => {
      updaty++;
      return { error: null, rows: [] };
    },
  });
  tvrd(pad.error === "insert" && updaty === 0, "po chybě insertu se neupdatuje");

  const zakaz: SyncUpdate = {
    id: WEB_ID,
    email: EMAIL,
    report_date: "2026-09-21",
    source: "import-sheet",
    weight: 1,
    nutrition: { kcal: 1 },
    match: { weight: 1, nutrition: { kcal: 1 } },
  };
  let sahlo = 0;
  const ne = await commitSyncPlan(prazdnyPlan({ toUpdate: [zakaz] }), {
    insert: async () => ({ error: null }),
    update: async () => {
      sahlo++;
      return { error: null, rows: [{ id: WEB_ID }] };
    },
  });
  tvrd(ne.error === "zakazany_zdroj" && sahlo === 0, "import-sheet se neupdatuje");
});

Deno.test("nález 2, 5 a 7: čtení, active a status cronu", async () => {
  tvrd(syncReadError(null, null) === null, "obě čtení v pořádku");
  tvrd(syncReadError(undefined, undefined) === null, "undefined není chyba");
  tvrd(syncReadError({ message: "timeout" }, null) === "reporty", "reporty");
  tvrd(syncReadError(null, { message: "timeout" }) === "targets", "targets");
  tvrd(syncReadError({ message: "a" }, { message: "b" }) === "reporty", "reporty mají přednost");

  tvrd(isTcActive(true) === true, "true");
  tvrd(isTcActive(false) === false, "false");
  tvrd(isTcActive("true") === false, "řetězec true");
  tvrd(isTcActive(1) === false, "jednička");
  tvrd(isTcActive(undefined) === false, "chybí");

  const pocty = {
    clients: 3, clients_touched: 1, clients_skipped: 2, clients_failed: 0,
    synced: 1, created: 0, filled: 1,
    skipped_web: 0, skipped_protected: 0, skipped_empty: 0, skipped_unchanged: 0,
    skipped_grace: 0, kolize_tydnu: 0, obsazene_datum: 0, zmeneno_mezitim: 0,
  };
  const ok = cronResultBody(pocty);
  tvrd(ok.status === 200 && ok.body.ok === true, "bez selhání 200");
  const fail = cronResultBody({ ...pocty, clients_failed: 2 });
  tvrd(fail.status === 500 && fail.body.ok === false && fail.body.clients_failed === 2, "clients_failed je 500");
  tvrd(!("email" in fail.body), "v těle není email");
  tvrd(!JSON.stringify(fail.body).includes("@"), "v těle není adresa");

  const cron = await Deno.readTextFile(new URL("../tc-client-reports-sync/index.ts", import.meta.url));
  const admin = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  tvrd(cron.includes("cronResultBody("), "cron vrací status z cronResultBody");
  tvrd(cron.includes("isTcActive("), "cron kontroluje active");
  tvrd(cron.includes("syncReadError("), "cron řeší chybu čtení targets");
  tvrd(cron.includes("TC_REPORT_SELECT"), "cron čte id a source");
  tvrd(!cron.includes(".upsert("), "cron upsert nevolá");
  tvrd(!cron.includes("onConflict"), "cron nemá onConflict");

  const start = admin.indexOf('action === "client_app_sync"');
  const end = admin.indexOf('action === "tc_goals_push"');
  const block = admin.slice(start, end);
  const activePos = block.indexOf("isTcActive(");
  const selectPos = block.indexOf("TC_REPORT_SELECT");
  const readPos = block.indexOf("syncReadError(");
  const writePos = block.indexOf("commitSyncPlan(");
  tvrd(activePos >= 0 && selectPos > activePos, "active dřív než čtení reportů");
  tvrd(readPos >= 0 && writePos > readPos, "chyba čtení dřív než zápis");
  tvrd(!block.includes(".upsert("), "tlačítko upsert nevolá");
  tvrd(!block.includes("onConflict"), "tlačítko nemá onConflict");
  tvrd(block.includes('duvod: readErr === "targets" ? "targets" : "db"'), "chyba targets není tichý null");
  tvrd(block.includes("duvodyProTlacitko("), "tlačítko skládá důvody až po zápisu");
  tvrd(!block.includes("plan.duvody.concat"), "plánové doplneno se neslepuje naslepo");
});
