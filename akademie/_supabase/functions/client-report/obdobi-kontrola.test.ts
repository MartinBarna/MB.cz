// Testy období na straně client-report (5. 10. 2026).
// Spuštění: npx --yes deno@2 test --allow-read akademie/_supabase/functions/client-report/obdobi-kontrola.test.ts
// ⛔ Data jsou vymyšlená.
import { kontrolaObdobi, odpovedObdobi } from "./obdobi-kontrola.ts";

function tvrd(podminka: boolean, popis: string) {
  if (!podminka) throw new Error("NESEDÍ: " + popis);
}
const web = (report_date: string, extra: Record<string, unknown> = {}) => ({ report_date, source: "web", ...extra });

Deno.test("akce obdobi: chyba čtení historie NENÍ první report", () => {
  const r = odpovedObdobi("2026-10-25", { data: null, error: { message: "504 Gateway Timeout" } });
  tvrd(r.status === 503, "503, ne 200");
  tvrd(r.body.ok === false && r.body.error === "obdobi_neznam", "formulář pozná, že období nezná");
  tvrd(!("prvni" in r.body) && !("od" in r.body), "žádné dosazené období");
  // kontrast: tatáž historie přečtená v pořádku dá 21 dní, ne 7
  const ok = odpovedObdobi("2026-10-25", { data: [web("2026-10-04")], error: null });
  tvrd(ok.status === 200 && ok.body.od === "2026-10-05" && ok.body.dni === 21 && ok.body.prvni === false, "21 dní z historie");
  const prvni = odpovedObdobi("2026-10-25", { data: [], error: null });
  tvrd(prvni.body.prvni === true && prvni.body.dni === 7, "prázdná historie bez chyby = první report");
});

Deno.test("uložení: shoda, neshoda, neověřeno", () => {
  const historie = [web("2026-10-04")];
  const shoda = kontrolaObdobi({ dnes: "2026-10-25", odKlienta: { od: "2026-10-05", do: "2026-10-25" }, rozpis: undefined, historie });
  tvrd(shoda.stav === "shoda" && shoda.obdobi?.dni === 21 && shoda.poznamka === null, "shoda");
  // stránka otevřená ve středu, odesláno ve čtvrtek: klient vyplňoval jiné období
  const neshoda = kontrolaObdobi({ dnes: "2026-10-08", odKlienta: { od: "2026-09-28", do: "2026-10-04" }, rozpis: undefined, historie: [web("2026-09-27")] });
  tvrd(neshoda.stav === "neshoda", "neshoda se pozná");
  tvrd(neshoda.obdobi?.od === "2026-09-28" && neshoda.obdobi?.do === "2026-10-04", "ukládá se období klienta (k němu patří čísla)");
  tvrd(!!neshoda.poznamka && neshoda.poznamka.includes("28. 9. až 4. 10. 2026") && neshoda.poznamka.includes("28. 9. až 8. 10. 2026"), "Martin vidí obě období");
  const neovereno = kontrolaObdobi({ dnes: "2026-10-25", odKlienta: { od: "2026-10-05", do: "2026-10-25" }, rozpis: undefined, historie: null });
  tvrd(neovereno.stav === "neovereno" && neovereno.obdobi?.dni === 21, "chyba čtení: uloží se klientovo, ne „první report“");
  tvrd(!!neovereno.poznamka && neovereno.poznamka.includes("nemohl ověřit"), "věta pro Martina");
});

Deno.test("uložení: neplatné období a rozpis mimo období", () => {
  const h = [web("2026-10-04")];
  const obracene = kontrolaObdobi({ dnes: "2026-10-25", odKlienta: { od: "2026-10-25", do: "2026-10-05" }, rozpis: undefined, historie: h });
  tvrd(obracene.stav === "neplatne" && obracene.obdobi === null && !!obracene.poznamka, "obrácené");
  const budoucnost = kontrolaObdobi({ dnes: "2026-10-24", odKlienta: { od: "2026-10-05", do: "2026-10-25" }, rozpis: undefined, historie: h });
  tvrd(budoucnost.stav === "neplatne", "den v budoucnu");
  const mimo = kontrolaObdobi({ dnes: "2026-10-25", odKlienta: { od: "2026-10-05", do: "2026-10-25" }, rozpis: [{ datum: "2026-10-04", kcal: 1 }], historie: h });
  tvrd(mimo.stav === "neplatne" && mimo.obdobi === null, "rozpis mimo období");
  const dobryRozpis = kontrolaObdobi({ dnes: "2026-10-25", odKlienta: { od: "2026-10-05", do: "2026-10-25" }, rozpis: [{ datum: "2026-10-05", den: "Po", kcal: 1800 }], historie: h });
  tvrd(dobryRozpis.stav === "shoda", "rozpis uvnitř období");
});

Deno.test("stará stránka a náhradní režim: období se neposílá", () => {
  const stara = kontrolaObdobi({ dnes: "2026-10-04", odKlienta: undefined, rozpis: [{ den: "Po", kcal: 1 }, null, null, null, null, null, null], historie: [] });
  tvrd(stara.stav === "bez_obdobi" && stara.obdobi === null && stara.poznamka === null, "starý tvar projde beze slova");
  const divne = kontrolaObdobi({ dnes: "2026-10-04", odKlienta: null, rozpis: [{ datum: "2026-10-01", kcal: 1 }], historie: [] });
  tvrd(divne.stav === "neplatne" && !!divne.poznamka, "rozpis s daty bez období se ohlásí");
});

// Revize R1, nález S1: report bez období (náhradní režim, stará stránka) nesmí být pro Martina tichý.
Deno.test("report bez období: Martin dostane větu, které dny nepokrývá", () => {
  const hana = kontrolaObdobi({ dnes: "2026-10-25", odKlienta: undefined, rozpis: undefined, historie: [web("2026-10-04")] });
  tvrd(hana.stav === "bez_obdobi" && hana.obdobi === null, "uloží se bez období (jako týden)");
  tvrd(!!hana.poznamka && hana.poznamka.includes("Podle historie měl pokrýt 5. 10. až 25. 10. 2026 (21 dní)") &&
    hana.poznamka.includes("uložený je jako 19. 10. až 25. 10. 2026 (7 dní)") &&
    hana.poznamka.includes("Dny 5. 10. až 18. 10. 2026 nepokrývá žádný report."), "věta s obdobím a nepokrytými dny (" + hana.poznamka + ")");
  const tydenni = kontrolaObdobi({ dnes: "2026-10-04", odKlienta: undefined, rozpis: undefined, historie: [web("2026-09-27")] });
  tvrd(tydenni.poznamka === null, "týdenní klient v náhradním režimu: žádná věta navíc");
  const prekryv = kontrolaObdobi({ dnes: "2026-10-11", odKlienta: undefined, rozpis: undefined,
    historie: [web("2026-10-08", { obdobi_od: "2026-09-28", obdobi_do: "2026-10-08" })] });
  tvrd(!!prekryv.poznamka && prekryv.poznamka.includes("Dny 5. 10. až 8. 10. 2026 už pokryl předchozí report"), "překryv s předchozím reportem se řekne");
  const nevim = kontrolaObdobi({ dnes: "2026-10-25", odKlienta: undefined, rozpis: undefined, historie: null });
  tvrd(!!nevim.poznamka && nevim.poznamka.includes("historie reportů se nenačetla"), "bez historie: věta, že nevím");
});

Deno.test("client-report nesahá na sync modul a období bere ze sdíleného modulu", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  tvrd(src.includes('from "../_shared/report-obdobi.ts"'), "index importuje sdílený modul období");
  tvrd(src.includes('from "./obdobi-kontrola.ts"'), "index importuje kontrolu období");
  tvrd(!src.includes("tc-report-sync"), "sync modul se neimportuje (hlídá i tc-report-sync.test.ts)");
  // ⛔ Předmět notifikace Martinovi se nemění: pondělní rutina a Coach Bot hledají notifikaci podle něj.
  tvrd(src.includes("const subj = `📊 Týdenní report: ${name}`;"), "předmět notifikace beze změny");
  // Kopie klientovi: u týdne beze změny, u jiného období bez „týdenní" (revize Groka, nález 3).
  tvrd(src.includes('tydenni ? "Tvůj týdenní report ✓ (kopie)" : "Tvůj report ✓ (kopie)"'), "předmět kopie: týden beze změny, jiné období bez „týdenní“");
  // „Minule" vynechává řádky uvnitř období reportu (revize Groka, nález 1).
  tvrd(src.includes("jeUvnitrObdobi(h as RadekReportu, obdUkladane)"), "předchozí report přeskočí řádky uvnitř období");
});
