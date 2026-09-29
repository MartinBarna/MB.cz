// Testy plánu zápisu týdenních dat z appky do client_reports.
// Spuštění: npx --yes deno@2 test --allow-read akademie/_supabase/functions/admin-api/tc-report-sync.test.ts
//
// ⛔ Neznámá hodnota není nula. ⛔ Žádný e-mail v assert zprávách.
import {
  applySyncPlan,
  existingDateWindow,
  extractTcReports,
  isoWeekStart,
  isEmptyReport,
  mapTcReportToRow,
  num,
  webReportWeek,
  type ExistingClientReport,
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
