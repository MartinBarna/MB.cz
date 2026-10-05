// Testy kadence reportů v připomínkách (5. 10. 2026, fáze 2).
// Spuštění: npx --yes deno@2 test --allow-read akademie/_supabase/functions/client-remind/kadence.test.ts
// ⛔ Data jsou vymyšlená. „Hana" je jen jméno scénáře z analýzy (report 4. 10., kadence 2, posun na 25. 10.).
import { NEJDELSI_OKNO_DNI, oknoOpakovaniDni, planVyzvy, tydnySlovy, uzDostalNedavno } from "./kadence.ts";

function tvrd(podminka: boolean, popis: string) {
  if (!podminka) throw new Error("NESEDÍ: " + popis);
}
const web = (report_date: string, extra: Record<string, unknown> = {}) => ({ report_date, source: "web", ...extra });
const DEN = 86400000;
const nedele = (iso: string) => Date.parse(iso + "T01:00:00Z"); // běh cronu 01:00 UTC

Deno.test("týdenní klient: výzva každou neděli jako dřív", () => {
  const p = planVyzvy("2026-10-11", [web("2026-10-04")], null, false, null);
  tvrd(p.kadence === 1 && p.dalsi === "2026-10-11" && p.naRade, "report v neděli ⇒ výzva další neděli");
  tvrd(p.tydnu === 1 && p.obdobi.od === "2026-10-05" && p.obdobi.do === "2026-10-11", "období týden");
  const po = planVyzvy("2026-10-11", [web("2026-10-05")], null, false, null);
  tvrd(po.naRade && po.dalsi === "2026-10-11", "report v pondělí ⇒ výzva v neděli");
  // vynechal týden: další neděli připomínat dál, období dva týdny
  const vynechal = planVyzvy("2026-10-18", [web("2026-10-04")], null, false, null);
  tvrd(vynechal.naRade && vynechal.tydnu === 2, "po vynechaném týdnu výzva a slova o dvou týdnech");
  // nový klient bez reportu: rozhodují stará pravidla (start, nárok)
  const novy = planVyzvy("2026-10-11", [], null, false, null);
  tvrd(novy.naRade && novy.dalsi === null && novy.tydnu === 1, "bez reportu bez termínu");
  // report ve čtvrtek: do neděle žádná výzva
  const ct = planVyzvy("2026-10-18", [web("2026-10-15", { obdobi_od: "2026-10-05", obdobi_do: "2026-10-15" })], null, false, null);
  tvrd(!ct.naRade && ct.dalsi === "2026-10-25", "čtvrteční report ⇒ výzva až 25. 10.");
});

Deno.test("Hana: kadence 2 týdny, posun na 25. 10.", () => {
  const h = [{ report_date: "2026-08-03", source: "tvuj-coach" }, web("2026-10-04")];
  for (const [den, ceka] of [["2026-10-11", false], ["2026-10-18", false], ["2026-10-25", true]] as const) {
    const p = planVyzvy(den, h, 2, true, "2026-10-25");
    tvrd(p.naRade === ceka, den + ": " + (ceka ? "poslat" : "nechat"));
  }
  const v25 = planVyzvy("2026-10-25", h, 2, true, "2026-10-25");
  tvrd(v25.dalsi === "2026-10-25" && v25.posunuto && v25.tydnu === 3, "25. 10.: tři týdny 5. 10. až 25. 10.");
  tvrd(v25.obdobi.od === "2026-10-05" && v25.obdobi.do === "2026-10-25", "období v mailu");
  // bez posunu (jen kadence ze starého seznamu): výzva 18. 10.
  const bez = planVyzvy("2026-10-18", h, null, true, null);
  tvrd(bez.kadence === 2 && bez.dalsi === "2026-10-18" && bez.naRade && bez.tydnu === 2, "kadence ze seznamu ⇒ 18. 10.");
  tvrd(!planVyzvy("2026-10-11", h, null, true, null).naRade, "11. 10. ještě ne");
  // poslala 25. 10. ⇒ další výzva 8. 11., 1. 11. ne
  const po = h.concat([web("2026-10-25", { obdobi_od: "2026-10-05", obdobi_do: "2026-10-25" })]);
  tvrd(!planVyzvy("2026-11-01", po, 2, true, "2026-10-25").naRade, "1. 11. ne");
  tvrd(planVyzvy("2026-11-08", po, 2, true, "2026-10-25").naRade, "8. 11. ano");
  // poslala dřív (18. 10.) ⇒ 25. 10. žádná výzva (žádný mail navíc), další 1. 11.
  const driv = h.concat([web("2026-10-18", { obdobi_od: "2026-10-05", obdobi_do: "2026-10-18" })]);
  tvrd(!planVyzvy("2026-10-25", driv, 2, true, "2026-10-25").naRade, "po dřívějším reportu 25. 10. nic");
  tvrd(planVyzvy("2026-11-01", driv, 2, true, "2026-10-25").naRade, "1. 11. ano");
});

Deno.test("kadence 3 týdny a karta přebíjí starý seznam", () => {
  const h = [web("2026-10-04")];
  tvrd(!planVyzvy("2026-10-18", h, 3, false, null).naRade, "3 týdny: 18. 10. ne");
  tvrd(planVyzvy("2026-10-25", h, 3, false, null).naRade, "3 týdny: 25. 10. ano");
  tvrd(planVyzvy("2026-10-11", h, 1, true, null).naRade, "karta 1 týden přebije seznam 14 dní");
});

Deno.test("okno „už dostal nedávno“ podle kadence", () => {
  tvrd(oknoOpakovaniDni(1) === 5 && oknoOpakovaniDni(2) === 12 && oknoOpakovaniDni(3) === 19, "5, 12, 19 dní");
  tvrd(NEJDELSI_OKNO_DNI === 19, "historie výzev se čte 19 dní zpátky");
  const ted = nedele("2026-10-25");
  // týdenní: druh mailu zvlášť, 5 dní
  tvrd(uzDostalNedavno(1, ted - 30 * 60000, undefined, ted), "druhý běh téže noci nic");
  tvrd(!uzDostalNedavno(1, nedele("2026-10-18"), nedele("2026-10-18"), ted), "týdenní: další neděle ano");
  tvrd(!uzDostalNedavno(1, undefined, ted - DEN, ted), "týdenní: jiný druh mailu neblokuje");
  // dvoutýdenní: přes oba druhy, 12 dní
  tvrd(uzDostalNedavno(2, undefined, nedele("2026-10-18"), ted), "dvoutýdenní: týden po pozvánce ne");
  tvrd(!uzDostalNedavno(2, undefined, nedele("2026-10-11"), ted), "dvoutýdenní: po 14 dnech ano");
  tvrd(!uzDostalNedavno(2, undefined, nedele("2026-10-11") + 23 * 3600000, ted), "výzva odešla až v pondělí, termín se nepřeskočí");
  // tří týdenní: 19 dní
  tvrd(uzDostalNedavno(3, undefined, nedele("2026-10-11"), ted), "3 týdny: po 14 dnech ne");
  tvrd(!uzDostalNedavno(3, undefined, nedele("2026-10-04"), ted), "3 týdny: po 21 dnech ano");
});

Deno.test("slova do mailu", () => {
  tvrd(tydnySlovy(2) === "dva týdny" && tydnySlovy(3) === "tři týdny" && tydnySlovy(4) === "čtyři týdny", "týdny slovy");
});

Deno.test("index.ts: kadence se čte týmž dotazem a klíč pro hlídku zůstává", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  tvrd(src.includes('select("email,granted_at,start_at,report_kadence,dalsi_report")'), "kadence v témže dotazu na nároky");
  tvrd(src.includes('select("email,report_date,source,obdobi_od,obdobi_do").in("email", clients)'), "historie reportů s obdobím, filtr na klienty");
  // ⛔ Hlídka `client_remind_hlidka()` hledá odpověď funkce podle klíče "kadence_14d".
  tvrd(src.includes("kadence_14d: kazdych14.size"), "klíč kadence_14d v odpovědi zůstává");
  tvrd(src.includes("planVyzvy(") && src.includes("uzDostalNedavno("), "rozhoduje sdílená logika");
  tvrd(!src.includes("UZ_DOSTAL_DNI_14D"), "stará konstanta 14d je pryč (nahradilo ji okno podle kadence)");
  // předmět týdenní výzvy beze změny
  tvrd(src.includes('"Týdenní report ✍️ (3 minuty)"'), "předmět týdenní výzvy beze změny");
});
