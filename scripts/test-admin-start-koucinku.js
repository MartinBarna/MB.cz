// Testy dávky 9 (start koučinku, dotazník před konzultací, doposlání uvítacího mailu)
// a oprav po revizi R1 (15. 9. 2026).
//
// ⛔ Leží ve `scripts/`, ne v `akademie/`: složka akademie se NASAZUJE na web, takže test
//    by byl veřejně stažitelný (nález revize 14. 9. 2026). Stejný důvod i stejný vzor jako
//    `scripts/test-admin-graf-dotaznik.js`.
// ⛔ Kód se VYŘEZÁVÁ ze skutečných souborů, neopisuje. Kopie by se tiše rozešla s originálem.
// Data v testu jsou vymyšlená, žádný klient.
//
// Spuštění: node scripts/test-admin-start-koucinku.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const KOREN = path.join(__dirname, "..");
const cti = (p) => fs.readFileSync(path.join(KOREN, p), "utf8").split("\r\n").join("\n");
const HTML = cti("akademie/admin/index.html");
const ADMIN_API = cti("akademie/_supabase/functions/admin-api/index.ts");

let chyb = 0;
function overit(popis, podminka) {
  console.log((podminka ? "  OK   " : "  CHYBA") + " " + popis);
  if (!podminka) chyb++;
}

// ---------------------------------------------------------------------------
// Vyříznutí funkcí z admin/index.html (odsazení 4 mezery, konec je "\n    }")
// ---------------------------------------------------------------------------
function funkce(jmeno) {
  const re = new RegExp("function " + jmeno + "\\([\\s\\S]*?\\n    \\}");
  const m = HTML.match(re);
  if (!m) throw new Error("nenašel funkci " + jmeno + " v admin/index.html");
  return m[0];
}
function radek(zacatek) {
  const i = HTML.indexOf(zacatek);
  if (i < 0) throw new Error("nenašel řádek: " + zacatek);
  const konec = HTML.indexOf("\n", i);
  return HTML.slice(i, konec);
}
function blok(od, po, nazev) {
  const a = HTML.indexOf(od);
  if (a < 0) throw new Error("nenašel začátek bloku " + nazev);
  const b = HTML.indexOf(po, a);
  if (b < 0) throw new Error("nenašel konec bloku " + nazev);
  return HTML.slice(a, b + po.length);
}

const HELPERY = [
  funkce("esc"),
  radek("    function czDatum(s){"),
  radek("    function fmtDay(s){"),
  funkce("konzKdy"),
  funkce("kdStartDuvod"),
  funkce("kdMailSkipDuvod"),
  radek("    var START_PRVNI_VYZVA_PO_DNECH"),
  funkce("kdPrvniVyzva"),
  funkce("kdDniDoStartu"),
  radek("    var START_UPOZORNIT_OD_DNI"),
  funkce("kliStart"),
  funkce("kdStartDusledek"),
  funkce("kdStartStatText"),
  blok("var KONZ_POLE=", "\n    }", "konzDotaznikHtml"),
].join("\n");

const BLOK_KONZ = blok(
  "      if(d.konz_chyba){",
  "konzDotaznikHtml(d.konzultace_intake);\n      }",
  "blok Dotazník před konzultací",
);

function sandbox(zdroj) {
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(zdroj, ctx, { filename: "vyrez-admin.js" });
  return ctx;
}
function vykresliKonz(d) {
  const ctx = sandbox(HELPERY);
  ctx.D = d;
  ctx.h = "";
  vm.runInContext("var d = D;\n" + BLOK_KONZ, ctx, { filename: "blok-konzultace.js" });
  return ctx.h;
}
const API = sandbox(HELPERY);
const volej = (vyraz) => vm.runInContext(vyraz, API);

// Dnešek se v testu nefixuje, protože `kdDniDoStartu` čte systémový čas. Datumy se proto
// odvozují ode dneška, ne napevno (jinak by test za pár týdnů začal lhát).
function zaDni(n) {
  const d = new Date();
  const t = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

// ===========================================================================
console.log("\n=== 1. NÁLEZ S1: chyba čtení startu není „start nezadán\" ===");
// ===========================================================================
{
  const chyba = volej("kdStartStatText(" + JSON.stringify({ start_chyba: "timeout 504", start_at: null, reports: [] }) + ")");
  overit("při chybě čtení se napíše, že se start nepodařilo načíst", /nepodařilo načíst/.test(chyba));
  overit("výslovně se popírá, že by start nebyl zadaný", /Neznamená to, že není zadaný/.test(chyba));
  overit("⛔ NETVRDÍ se „prázdné = systém bere datum pozvánky\"", !/bere datum pozvánky/.test(chyba));
  overit("věta říká, že se teď ukládat nedá (tlačítko je zamčené)", /ukládat nedá/.test(chyba));

  // Pole i tlačítko musí být v tom stavu `disabled`, jinak by uložení prázdna start SMAZALO.
  const radekPole = blok('<input type="date" id="kdStart"', "kdStartSave", "pole startu");
  overit("pole startu je disabled, když je start_chyba", /d\.start_chyba\?' disabled':''/.test(radekPole));
  const radekBtn = blok('id="kdStartSave"', "</button>", "tlačítko startu");
  overit("tlačítko Uložit start je disabled, když je start_chyba", /d\.start_chyba\?' disabled':''/.test(radekBtn));

  // Server musí ty tři stavy vůbec poslat.
  overit("client_detail vrací start_chyba", /start_chyba: startChyba/.test(ADMIN_API));
  overit("při chybě se start_at NEvydává jako null bez příznaku",
    /start_at: startChyba \? null : \(ent\.data\?\.start_at \?\? null\)/.test(ADMIN_API));
}

// ===========================================================================
console.log("\n=== 2. NÁLEZ S2: start neodkládá výzvu tomu, kdo už reportuje ===");
// ===========================================================================
{
  const novy = volej("kdStartStatText(" + JSON.stringify({ start_at: "2026-09-21", reports: [] }) + ")");
  overit("klient bez reportu: slíbí se datum první výzvy", /[Pp]rvní výzva k týdennímu reportu/.test(novy));

  const reportujici = volej("kdStartStatText(" + JSON.stringify({ start_at: "2026-09-21", reports: [{ id: 1 }] }) + ")");
  overit("klient s reportem: ⛔ ŽÁDNÝ slib o první výzvě", !/[Pp]rvní výzva/.test(reportujici));
  overit("klient s reportem: napíše se, že start výzvu neodkládá", /výzvu neodkládá/.test(reportujici));

  // Totéž v potvrzení pozvánky: převáděný klient („stavajici") reporty posílá roky.
  const potvrzeni = blok("var startTxt=start?", ":'\\nStart koučinku: nezadán", "potvrzení pozvánky");
  overit("potvrzení pozvánky podmiňuje slib („pokud klient ještě žádný report neposlal\")",
    /pokud klient ještě žádný report neposlal/.test(potvrzeni));
}

// ===========================================================================
console.log("\n=== 2b. NÁLEZ R2-1: potvrzení v KARTĚ slibuje totéž co věta pod polem ===");
// ===========================================================================
{
  // ⛔ Po R1 byla opravená jen stavová věta, dialog u „Uložit start" sliboval odklad každému.
  //    Na jedné obrazovce tak byl rozpor a Martin čte dialog právě ve chvíli rozhodnutí.
  const bezReportu = volej("kdStartDusledek(" + JSON.stringify({ reports: [] }) + ",'2026-09-21')");
  const sReportem = volej("kdStartDusledek(" + JSON.stringify({ reports: [{ id: 1 }] }) + ",'2026-09-21')");
  overit("bez reportu: dialog slíbí datum první výzvy", /První výzva k týdennímu reportu/.test(bezReportu));
  overit("s reportem: ⛔ ŽÁDNÝ slib o první výzvě", !/První výzva/.test(sReportem));
  overit("s reportem: dialog řekne, že start výzvu neodkládá", /start mu výzvu neodkládá/.test(sReportem));

  // Dialog a věta pod polem MUSÍ říkat totéž, tedy stát na jedné funkci.
  const handler = blok("if(kdStartSave) kdStartSave.addEventListener", "b.textContent='Ukládám…';", "handler Uložit start");
  overit("dialog v kartě volá kdStartDusledek", /kdStartDusledek\(KDET\.data,v\)/.test(handler));
  overit("⛔ dialog už nevolá kdPrvniVyzva napřímo (to byl ten bezpodmínečný slib)",
    !/kdPrvniVyzva\(v\)/.test(handler));
  overit("kdStartStatText staví na téže funkci (jedno místo, ne dvě kopie)",
    /return kdStartDusledek\(d,d\.start_at\)/.test(HTML));

  // Mazání startu se dialogem nemění: tam se nic neslibuje.
  overit("prázdný start: důsledek je prázdný (dialog o mazání slib nepotřebuje)",
    volej("kdStartDusledek(" + JSON.stringify({ reports: [] }) + ",'')") === "");
}

// ===========================================================================
console.log("\n=== 2c. NÁLEZ R2-2: neznámý počet reportů se nevydává za nulu ===");
// ===========================================================================
{
  const chyba = { reports: [], reports_chyba: "timeout 504", start_at: "2026-09-21" };
  const dusledek = volej("kdStartDusledek(" + JSON.stringify(chyba) + ",'2026-09-21')");
  overit("⛔ při chybě čtení reportů se NESLIBUJE odklad", !/První výzva/.test(dusledek));
  overit("⛔ ani se netvrdí opak („už reporty posílá\")", !/už reporty posílá/.test(dusledek));
  overit("napíše se, že to nevíme", /nepodařilo načíst/.test(dusledek) && /nevím/.test(dusledek));
  overit("stavová věta pod polem se chová stejně",
    !/První výzva/.test(volej("kdStartStatText(" + JSON.stringify(chyba) + ")")));
  overit("client_detail vrací reports_chyba jako třetí stav", /reports_chyba: reportsChyba,/.test(ADMIN_API));
  overit("reports_chyba se plní z reps.error, ne z prázdna", /const reportsChyba = reps\.error/.test(ADMIN_API));
}

// ===========================================================================
console.log("\n=== 3. NÁLEZ S5: start daleko v budoucnu se zvýrazní ===");
// ===========================================================================
{
  overit("bez startu: „nezadán\", ne prázdná buňka", /nezadán/.test(volej("kliStart(null)")));
  const blizko = volej("kliStart(" + JSON.stringify(zaDni(5)) + ")");
  overit("start za 5 dní: obyčejné datum bez upozornění", !/🔜/.test(blizko));
  const daleko = volej("kliStart(" + JSON.stringify(zaDni(96)) + ")");
  overit("start za 96 dní (překlep v měsíci): zvýrazněno 🔜 i s počtem dní", /🔜/.test(daleko) && /za 96 dní/.test(daleko));
  const hranice = volej("kliStart(" + JSON.stringify(zaDni(15)) + ")");
  overit("hranice: 15 dní už upozorňuje (mez je 14)", /🔜/.test(hranice));
  const podHranici = volej("kliStart(" + JSON.stringify(zaDni(14)) + ")");
  overit("hranice: 14 dní ještě ne", !/🔜/.test(podHranici));
  overit("⛔ mez upozornění NENÍ validační mez (ta zůstává 90 dní)",
    /var START_UPOZORNIT_OD_DNI = 14;/.test(HTML));
  const stary = volej("kliStart(" + JSON.stringify(zaDni(-30)) + ")");
  overit("start v minulosti se nezvýrazňuje", !/🔜/.test(stary));
}

// ===========================================================================
console.log("\n=== 4. NÁLEZ S3: skip mailu se překládá podle skutečného důvodu ===");
// ===========================================================================
{
  const bounce = volej("kdMailSkipDuvod('hard_bounce')");
  const neplatny = volej("kdMailSkipDuvod('invalid_email')");
  const unsub = volej("kdMailSkipDuvod('hard_unsubscribe')");
  overit("hard_bounce: „adresa odmítá poštu\"", /adresa odmítá poštu/.test(bounce));
  overit("invalid_email: „neplatný e-mail\"", /neplatný e-mail/.test(neplatny));
  overit("hard_unsubscribe má vlastní větu", /odhlášený/.test(unsub));
  overit("⛔ u hard_bounce se NETVRDÍ odhlášení (to bylo mylné)", !/odhlás/.test(bounce));
  overit("žádná věta nevrací syrový kód sama o sobě", bounce !== "hard_bounce" && neplatny !== "invalid_email");
  overit("neznámý důvod se aspoň vypíše, ne spolkne", /nevidano/.test(volej("kdMailSkipDuvod('nevidano')")));
}

// ===========================================================================
console.log("\n=== 5. NÁLEZ V1: prázdný seznam klientů nesmí vypadat jako úspěch ===");
// ===========================================================================
{
  // Server: chyba čtení nároků končí 500, a to DŘÍV, než se skládají řádky.
  const iEnts = ADMIN_API.indexOf("if (ents.error) {");
  const iRows = ADMIN_API.indexOf("const rows = (ents.data ?? []).map(");
  overit("clients_list kontroluje ents.error", iEnts > 0);
  overit("kontrola je PŘED skládáním řádků", iEnts > 0 && iRows > 0 && iEnts < iRows);
  overit("vrací se 500, ne ok:true s prázdným seznamem",
    /co: "entitlements\(clients_list\)"[\s\S]{0,200}\}, 500\);/.test(ADMIN_API));

  // UI: neúspěch pojmenuje, co se stalo, a popře, že klienti nejsou.
  const ui = blok("if(!o.j||!o.j.ok){\n          if(gen!==kliGen) return;", "return;\n        }", "hláška V1");
  overit("UI napíše, že se seznam nepodařilo načíst", /nepodařilo načíst/.test(ui));
  overit("UI výslovně popírá, že žádní klienti nejsou", /Neznamená to, že žádní klienti nejsou/.test(ui));
  overit("UI vypíše i detail chyby ze serveru", /o\.j\.detail/.test(ui));
  overit("UI navede na migraci (nejpravděpodobnější příčina)", /migrace/.test(ui));
}

// ===========================================================================
console.log("\n=== 6. NÁLEZ N3: start se neukládá ukončenému klientovi ===");
// ===========================================================================
{
  const i = ADMIN_API.indexOf('if (action === "client_start_save")');
  const konec = ADMIN_API.indexOf('if (action === "client_remind_toggle")', i);
  const akce = ADMIN_API.slice(i, konec);
  overit("client_start_save čte nárok před zápisem", /select\("active"\)/.test(akce));
  overit("chyba čtení = 500, ne „není klient\"", /error: "db"[\s\S]{0,120}500\)/.test(akce));
  overit("prázdno = 404 neni_klient", /error: "neni_klient" \}, 404\)/.test(akce));
  overit("ukončený klient = 409 ukonceny_klient", /error: "ukonceny_klient" \}, 409\)/.test(akce));
  // Symetrie s druhou novou akcí téhož diffu.
  const j = ADMIN_API.indexOf('if (action === "client_welcome_resend")');
  const akce2 = ADMIN_API.slice(j, ADMIN_API.indexOf("\n    }\n", j));
  overit("client_welcome_resend má tytéž tři stavy (symetrie)",
    /error: "db"/.test(akce2) && /neni_klient" \}, 404/.test(akce2) && /ukonceny_klient" \}, 409/.test(akce2));
  overit("UI umí hlášku pro ukončeného klienta u startu",
    /error==='ukonceny_klient'\) toast\('Klient je ukončený, start se mu neukládá/.test(HTML));
}

// ===========================================================================
console.log("\n=== 7. Dotazník před konzultací (bod 2, beze změny po R1) ===");
// ===========================================================================
{
  const sKonz = vykresliKonz({
    konz_chyba: null,
    konzultace_intake: [{ created_at: "2026-09-15T08:00:00Z", goal: "zhubnout 8 kg", age: 41, sex: "muz", steps_per_day: 6500 }],
  });
  overit("klient s konzultací: blok se vykreslí", /Dotazník před konzultací/.test(sKonz));
  overit("vypíšou se i nová pole (cíl, věk)", /zhubnout 8 kg/.test(sKonz) && /41/.test(sKonz));
  overit("u odpovědí je datum vyplnění (past na záměnu dvou dotazníků)", /vyplněno/.test(sKonz));

  overit("klient bez konzultace: nevykreslí se NIC", vykresliKonz({ konz_chyba: null, konzultace_intake: [] }) === "");

  const chybaKonz = vykresliKonz({ konz_chyba: "column goalX does not exist", konzultace_intake: [] });
  overit("chyba čtení: varování i s důvodem", /⚠️/.test(chybaKonz) && /goalX/.test(chybaKonz));
  overit("⛔ chyba čtení výslovně popírá „nevyplnil\"", /neznamená to, že dotazník nevyplnil/.test(chybaKonz));

  const xss = vykresliKonz({ konz_chyba: null, konzultace_intake: [{ created_at: "2026-09-15T08:00:00Z", goal: "<img src=x onerror=alert(1)>" }] });
  overit("odpověď klienta se escapuje", !/<img src=x/.test(xss) && /&lt;img/.test(xss));
}

// ===========================================================================
console.log("\n=== 8. Důvody validace startu a shoda prahů ===");
// ===========================================================================
{
  const duvody = ["tvar_RRRR-MM-DD", "datum_neexistuje", "prilis_daleko_v_budoucnu", "prilis_stare", "necekany"];
  const vety = duvody.map((x) => volej("kdStartDuvod(" + JSON.stringify(x) + ")"));
  overit("každý důvod má vlastní větu", new Set(vety).size === duvody.length);
  overit("ve větách nezůstal syrový kód důvodu", !vety.some((v) => /_/.test(v)));

  // ⛔ Práh v UI se počítá zvlášť od serveru, takže se musí hlídat, že se nerozejdou.
  const cerstvy = cti("akademie/_supabase/functions/client-remind/cerstvy-klient.ts");
  const server = /export const PRVNI_VYZVA_PO_DNECH = (\d+);/.exec(cerstvy);
  const ui = /var START_PRVNI_VYZVA_PO_DNECH = (\d+);/.exec(HTML);
  overit("práh v UI sedí s prahem v client-remind", !!server && !!ui && server[1] === ui[1]);
  // Kontrolní příklady z analýzy: pondělní start +6, nedělní +7, středeční +11.
  overit("pondělní start 21. 9. → první výzva 27. 9.", volej("kdPrvniVyzva('2026-09-21')") === "27. 9. 2026");
  overit("nedělní start 20. 9. → první výzva 27. 9.", volej("kdPrvniVyzva('2026-09-20')") === "27. 9. 2026");
  overit("středeční start 23. 9. → první výzva 4. 10.", volej("kdPrvniVyzva('2026-09-23')") === "4. 10. 2026");
}

console.log(chyb === 0 ? "\nHOTOVO: vše prošlo.\n" : "\nSELHALO: " + chyb + " kontrol\n");
process.exit(chyb ? 1 : 0);
