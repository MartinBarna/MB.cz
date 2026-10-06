// Testy období reportu a dalšího termínu (5. 10. 2026).
// Spuštění: npx --yes deno@2 test akademie/_supabase/functions/_shared/report-obdobi.test.ts
//
// ⛔ Data jsou vymyšlená. „Hana" je jen jméno scénáře z analýzy (report 4. 10., další 25. 10.),
//    žádná adresa ani číslo skutečného klienta tu není.
// ⭐ Vektory z tabulky 3.1 analýzy + Martinovo doplnění 5. 10.: pozdní report nesmí ztratit
//    dny ani se překrýt, přechod pondělí → neděle (6 dní) dá celý týden.
import {
  dalsiReport,
  dalsiReportPodleKadence,
  denTydne,
  dnesPraha,
  jeCeleTydny,
  jeDatum,
  kadenceKlienta,
  nedeleVyzvy,
  obdobiRadku,
  obdobiReportu,
  overObdobiKlienta,
  overRozpisKObdobi,
  popisObdobi,
  posledniPokrytyDen,
  pridejDny,
  rozdilDni,
  slovoDni,
  STROP_DNI,
  tydenReportu,
  tydnyObdobi,
  vyzvaNaRade,
  zacatekPokryti,
  jeUvnitrObdobi,
  opravovanaVerze,
  type RadekReportu,
} from "./report-obdobi.ts";

function tvrd(podminka: boolean, popis: string) {
  if (!podminka) throw new Error("NESEDÍ: " + popis);
}
const web = (report_date: string, extra: Partial<RadekReportu> = {}): RadekReportu => ({ report_date, source: "web", ...extra });
function obd(dnes: string, reporty: RadekReportu[]) {
  return obdobiReportu(dnes, reporty);
}
function je(o: { od: string; do: string; dni: number }, od: string, d: string, dni: number, popis: string) {
  tvrd(o.od === od && o.do === d && o.dni === dni, popis + ": čekal " + od + " až " + d + " (" + dni + "), dostal " + o.od + " až " + o.do + " (" + o.dni + ")");
}

Deno.test("datumové pomůcky: pondělí, −3 dny, přelom roku", () => {
  tvrd(jeDatum("2026-10-25") && !jeDatum("2026-02-31") && !jeDatum("2026-9-5") && !jeDatum(null), "jeDatum");
  tvrd(denTydne("2026-10-05") === 0 && denTydne("2026-10-04") === 6, "po = 0, ne = 6");
  tvrd(tydenReportu("2026-10-04") === "2026-09-28", "ne 4. 10. patří k týdnu 28. 9.");
  tvrd(tydenReportu("2026-10-05") === "2026-09-28", "po 5. 10. taky");
  tvrd(tydenReportu("2026-10-07") === "2026-09-28", "st 7. 10. taky");
  tvrd(tydenReportu("2026-10-08") === "2026-10-05", "čt 8. 10. už k novému týdnu");
  tvrd(tydenReportu("2027-01-04") === "2026-12-28", "po 4. 1. 2027 k týdnu 28. 12. 2026");
  tvrd(pridejDny("2026-12-31", 1) === "2027-01-01", "přelom roku");
  tvrd(rozdilDni("2026-10-05", "2026-10-25") === 20, "rozdíl dní");
  // změna času 25. 10. 2026 (03:00 CEST → 02:00 CET): kalendářní aritmetika se nesmí posunout
  tvrd(pridejDny("2026-10-24", 1) === "2026-10-25" && pridejDny("2026-10-25", 1) === "2026-10-26", "přes změnu času");
  tvrd(rozdilDni("2026-10-19", "2026-10-26") === 7, "týden přes změnu času má 7 dní");
});

Deno.test("dnesPraha: datum podle Prahy, i v noci změny času 25. 10.", () => {
  tvrd(dnesPraha(new Date("2026-10-24T21:59:00Z")) === "2026-10-24", "23:59 SELČ je pořád 24. 10.");
  tvrd(dnesPraha(new Date("2026-10-24T22:30:00Z")) === "2026-10-25", "00:30 SELČ je už 25. 10.");
  tvrd(dnesPraha(new Date("2026-10-25T00:30:00Z")) === "2026-10-25", "běh cronu 01:00 UTC v den změny");
  tvrd(dnesPraha(new Date("2026-10-25T22:59:00Z")) === "2026-10-25", "23:59 SEČ je pořád 25. 10.");
  tvrd(dnesPraha(new Date("2026-10-25T23:30:00Z")) === "2026-10-26", "po změně času je půlnoc v 23:00 UTC");
  tvrd(dnesPraha(new Date("2026-10-04T22:10:00Z")) === "2026-10-05", "neděle 4. 10. po půlnoci SELČ je pondělí");
});

Deno.test("analýza 3.1: týdenní klienti, neděle i pondělí, přechod na neděli (6 dní)", () => {
  je(obd("2026-10-04", [web("2026-09-27")]), "2026-09-28", "2026-10-04", 7, "neděle → neděle");
  je(obd("2026-10-05", [web("2026-09-28")]), "2026-09-28", "2026-10-04", 7, "pondělí → pondělí");
  je(obd("2026-10-05", [web("2026-09-27")]), "2026-09-28", "2026-10-04", 7, "neděle → pondělí (8 dní)");
  // Martin 5. 10.: někdo poslal tenhle týden po 6 dnech kvůli přechodu z pondělí na neděli
  je(obd("2026-10-04", [web("2026-09-28")]), "2026-09-28", "2026-10-04", 7, "pondělí → neděle (6 dní) dá celý týden");
  // a týden potom zase normálně, bez díry a bez překryvu
  const poPrechodu = obd("2026-10-11", [web("2026-09-28"), web("2026-10-04", { obdobi_od: "2026-09-28", obdobi_do: "2026-10-04" })]);
  je(poPrechodu, "2026-10-05", "2026-10-11", 7, "týden po přechodu");
});

Deno.test("první report: týden, i když v appce leží starší řádek", () => {
  const o = obd("2026-10-04", []);
  je(o, "2026-09-28", "2026-10-04", 7, "první report v neděli");
  tvrd(o.prvni && !o.oprava && !o.zkraceno, "příznaky prvního reportu");
  je(obd("2026-10-04", [{ report_date: "2026-08-03", source: "tvuj-coach" }]), "2026-09-28", "2026-10-04", 7, "řádek z appky nedělá předchozí report");
  je(obd("2026-10-05", []), "2026-09-28", "2026-10-04", 7, "první report v pondělí");
  je(obd("2026-10-08", []), "2026-10-05", "2026-10-08", 4, "první report ve čtvrtek končí dneškem");
});

Deno.test("Hana z analýzy: report 4. 10., kadence 2 týdny, posun na 25. 10.", () => {
  const h = [{ report_date: "2026-08-03", source: "tvuj-coach" }, web("2026-10-04")];
  je(obd("2026-10-25", h), "2026-10-05", "2026-10-25", 21, "plán: neděle 25. 10.");
  je(obd("2026-10-18", h), "2026-10-05", "2026-10-18", 14, "kdyby poslala dřív");
  je(obd("2026-10-26", h), "2026-10-05", "2026-10-25", 21, "pošle až v pondělí");
  je(obd("2026-10-28", h), "2026-10-05", "2026-10-25", 21, "pošle až ve středu (10 dní po termínu)");
  // po reportu za 21 dní jede další období od 26. 10., ať poslala kdykoli
  const po = h.concat([web("2026-10-25", { obdobi_od: "2026-10-05", obdobi_do: "2026-10-25" })]);
  je(obd("2026-11-08", po), "2026-10-26", "2026-11-08", 14, "další období za dva týdny");
});

Deno.test("pozdní report: delší období, žádná ztráta dnů ani překryv", () => {
  const ne4 = web("2026-10-04");
  // po 9 dnech (úterý): týden do neděle, zbytek patří dalšímu reportu
  const ut = obd("2026-10-13", [ne4]);
  je(ut, "2026-10-05", "2026-10-11", 7, "úterý 13. 10.");
  je(obd("2026-10-18", [ne4, web("2026-10-13", { obdobi_od: ut.od, obdobi_do: ut.do })]), "2026-10-12", "2026-10-18", 7, "další neděle navazuje");
  // po 10 dnech (středa)
  je(obd("2026-10-14", [ne4]), "2026-10-05", "2026-10-11", 7, "středa 14. 10.");
  // po 11 dnech (čtvrtek): období končí dneškem a je delší
  const ct = obd("2026-10-15", [ne4]);
  je(ct, "2026-10-05", "2026-10-15", 11, "čtvrtek 15. 10. = delší období");
  const dalsi = obd("2026-10-18", [ne4, web("2026-10-15", { obdobi_od: ct.od, obdobi_do: ct.do })]);
  je(dalsi, "2026-10-16", "2026-10-18", 3, "neděle potom začne den po čtvrtku, nic se nepřekryje");
  tvrd(!dalsi.oprava, "není to oprava");
  // pátek po nedělním reportu (analýza: odjezd na víkend)
  je(obd("2026-10-09", [ne4]), "2026-10-05", "2026-10-09", 5, "pátek 9. 10.");
  // dva týdny bez reportu, pak pondělí
  je(obd("2026-10-19", [ne4]), "2026-10-05", "2026-10-18", 14, "pondělí po dvou týdnech");
});

Deno.test("oprava téhož týdne a druhé odeslání v tentýž den", () => {
  const ne27 = web("2026-09-27"), ne4 = web("2026-10-04", { obdobi_od: "2026-09-28", obdobi_do: "2026-10-04" });
  const st = obd("2026-10-07", [ne27, ne4]);
  je(st, "2026-09-28", "2026-10-04", 7, "oprava ve středu po nedělním reportu");
  tvrd(st.oprava, "je to oprava");
  const po = obd("2026-10-05", [ne27, ne4]);
  je(po, "2026-09-28", "2026-10-04", 7, "pondělí po nedělním reportu = totéž období");
  tvrd(po.oprava, "pondělí je taky oprava");
  // starý řádek bez uloženého období (dnes v DB všechny)
  const stary = obd("2026-10-07", [ne27, web("2026-10-04")]);
  je(stary, "2026-09-28", "2026-10-04", 7, "oprava nad starým řádkem bez období");
  // druhé odeslání v tentýž den: dnešní řádek se přepisuje, období se počítá bez něj
  const dnes = obd("2026-10-04", [ne27, web("2026-10-04", { obdobi_od: "2026-09-28", obdobi_do: "2026-10-04" })]);
  je(dnes, "2026-09-28", "2026-10-04", 7, "znovu odesláno v neděli");
  tvrd(!dnes.oprava, "dnešní řádek se nepočítá jako předchozí");
});

Deno.test("strop 4 týdny a návrat po pauze", () => {
  const o = obd("2026-07-20", [web("2026-06-15")]);
  je(o, "2026-06-22", "2026-07-19", 28, "návrat po pauze, strop");
  tvrd(o.zkraceno, "zkráceno se hlásí");
  tvrd(STROP_DNI === 28, "strop je 28 dní");
  // testovací účet z analýzy: poslední testovací kopie 20. 7., dnes 5. 10.
  const t = obd("2026-10-05", [{ report_date: "2026-07-20", source: "test-kopie" }, { report_date: "2026-08-31", source: "tvuj-coach" }]);
  je(t, "2026-09-07", "2026-10-04", 28, "testovací účet dostane 28 dní");
  // přesně 4 týdny ještě strop nejsou
  const ctyri = obd("2026-11-01", [web("2026-10-04")]);
  je(ctyri, "2026-10-05", "2026-11-01", 28, "4 týdny bez zkrácení");
  tvrd(!ctyri.zkraceno, "4 týdny nejsou zkrácené");
});

Deno.test("přelom roku a změna času 25. 10. v období", () => {
  je(obd("2027-01-04", [web("2026-12-28")]), "2026-12-28", "2027-01-03", 7, "přelom roku");
  tvrd(popisObdobi("2026-12-28", "2027-01-03") === "28. 12. 2026 až 3. 1. 2027", "popis přes rok");
  // týden se změnou času má pořád 7 dní a končí v neděli 25. 10.
  je(obd("2026-10-25", [web("2026-10-18")]), "2026-10-19", "2026-10-25", 7, "týden se změnou času");
});

Deno.test("řádky z appky období neposouvají (vektor z rizik analýzy)", () => {
  const rows = [web("2026-09-27"), { report_date: "2026-09-28", source: "tvuj-coach" }, { report_date: "2026-10-04", source: "app" }];
  je(obd("2026-10-11", rows), "2026-09-28", "2026-10-11", 14, "tvuj-coach mezi dvěma weby nic nemění");
  // import ze sheetu a testovací kopie jsou skutečné reporty
  je(obd("2026-10-11", [{ report_date: "2026-10-04", source: "import-sheet" }]), "2026-10-05", "2026-10-11", 7, "import-sheet je report");
});

Deno.test("obdobiRadku: uložené, odvozené, nečitelné", () => {
  const u = obdobiRadku(web("2026-10-25", { obdobi_od: "2026-10-05", obdobi_do: "2026-10-25" }));
  tvrd(!!u && u.dni === 21, "uložené 21 dní");
  const s = obdobiRadku(web("2026-10-05"));
  tvrd(!!s && s.od === "2026-09-28" && s.do === "2026-10-04", "starý řádek = týden podle −3 dní");
  const vadne = obdobiRadku(web("2026-10-05", { obdobi_od: "2026-10-05", obdobi_do: "2026-09-01" }));
  tvrd(!!vadne && vadne.dni === 7, "obrácené uložené období se nebere");
  tvrd(obdobiRadku({ report_date: "nic" }) === null, "nečitelné datum");
  // Revize R1, nález N1: řádek bez období ze čtvrtka až soboty končí dnem odeslání, ne nedělí.
  const ctvrtek = obdobiRadku(web("2026-10-08"));
  tvrd(!!ctvrtek && ctvrtek.od === "2026-10-05" && ctvrtek.do === "2026-10-08" && ctvrtek.dni === 4, "čtvrtek bez období: 5. až 8. 10.");
  const dalsi = obdobiReportu("2026-10-11", [web("2026-10-04", { obdobi_od: "2026-09-28", obdobi_do: "2026-10-04" }), web("2026-10-08")]);
  tvrd(!dalsi.oprava && dalsi.od === "2026-10-09" && dalsi.do === "2026-10-11", "neděle po čtvrtku bez období: 9. až 11. 10., žádná oprava (je " + dalsi.od + " až " + dalsi.do + ")");
});

Deno.test("tydnyObdobi a celé týdny", () => {
  const t = tydnyObdobi("2026-10-05", "2026-10-25");
  tvrd(t.join(",") === "2026-10-05,2026-10-12,2026-10-19", "tři týdny");
  tvrd(tydnyObdobi("2026-10-16", "2026-10-18").join(",") === "2026-10-12", "kousek týdne");
  tvrd(tydnyObdobi("2026-10-25", "2026-10-05").length === 0, "obrácené");
  tvrd(jeCeleTydny({ od: "2026-10-05", do: "2026-10-25" }), "celé týdny");
  tvrd(!jeCeleTydny({ od: "2026-10-05", do: "2026-10-09" }), "pátek není konec týdne");
  tvrd(!jeCeleTydny({ od: "2026-10-16", do: "2026-10-18" }), "pátek není začátek týdne");
});

Deno.test("overObdobiKlienta: tvar období z formuláře", () => {
  const ok = overObdobiKlienta({ od: "2026-10-05", do: "2026-10-25" }, "2026-10-25");
  tvrd(!!ok && ok.dni === 21, "platné");
  tvrd(overObdobiKlienta({ od: "2026-10-25", do: "2026-10-05" }, "2026-10-25") === null, "obrácené");
  tvrd(overObdobiKlienta({ od: "2026-09-01", do: "2026-10-25" }, "2026-10-25") === null, "víc než 28 dní");
  tvrd(overObdobiKlienta({ od: "2026-10-05", do: "2026-10-26" }, "2026-10-25") === null, "budoucí den");
  tvrd(overObdobiKlienta({ od: "5. 10.", do: "2026-10-25" }, "2026-10-25") === null, "nečitelné");
  tvrd(overObdobiKlienta(null, "2026-10-25") === null && overObdobiKlienta([1], "2026-10-25") === null, "jiný tvar");
});

Deno.test("overRozpisKObdobi: nový tvar s datem, starý se sedmi sloty", () => {
  const o = { od: "2026-10-05", do: "2026-10-25", dni: 21 };
  tvrd(overRozpisKObdobi([{ datum: "2026-10-05", den: "Po", kcal: 1800 }, { datum: "2026-10-25", den: "Ne", kcal: 2000 }], o), "nový tvar");
  tvrd(!overRozpisKObdobi([{ datum: "2026-10-04", kcal: 1 }], o), "den mimo období");
  tvrd(!overRozpisKObdobi([{ datum: "2026-10-05" }, { datum: "2026-10-05" }], o), "dvakrát týž den");
  tvrd(!overRozpisKObdobi([null, { datum: "2026-10-05" }], o), "mezery mají jen staré sloty");
  tvrd(overRozpisKObdobi([{ den: "Po", kcal: 1 }, null, null, null, null, null, null], null), "starý tvar bez období");
  tvrd(!overRozpisKObdobi([{ datum: "2026-10-05" }], null), "datum bez období");
  tvrd(overRozpisKObdobi(undefined, o) && overRozpisKObdobi(null, null), "bez rozpisu");
  tvrd(!overRozpisKObdobi(new Array(29).fill(null).map((_, i) => ({ datum: pridejDny("2026-09-27", i) })), o), "víc než 28 položek");
});

Deno.test("česky: popis období a dny", () => {
  tvrd(popisObdobi("2026-10-05", "2026-10-25") === "5. 10. až 25. 10. 2026", "běžné období");
  tvrd(popisObdobi("2026-10-09", "2026-10-09") === "9. 10. 2026", "jeden den");
  tvrd(slovoDni(1) === "1 den" && slovoDni(3) === "3 dny" && slovoDni(21) === "21 dní", "skloňování");
});

Deno.test("kadence: sloupec, starý seznam, výchozí", () => {
  tvrd(kadenceKlienta(2) === 2 && kadenceKlienta("3") === 3, "sloupec");
  tvrd(kadenceKlienta(null, true) === 2, "starý seznam client_remind_14d");
  tvrd(kadenceKlienta(1, true) === 1, "sloupec má přednost před seznamem");
  tvrd(kadenceKlienta(null) === 1 && kadenceKlienta("") === 1 && kadenceKlienta(4) === 1 && kadenceKlienta(0) === 1, "výchozí 1");
});

Deno.test("další report: podle kadence, ručně jen posouvá, sám se spotřebuje", () => {
  const h = [web("2026-10-04")];
  const posl = posledniPokrytyDen(h, "2026-10-05");
  tvrd(posl === "2026-10-04", "poslední pokrytý den");
  tvrd(dalsiReportPodleKadence(posl, 1) === "2026-10-11", "týdenní");
  tvrd(dalsiReportPodleKadence(posl, 2) === "2026-10-18", "dvoutýdenní");
  tvrd(dalsiReportPodleKadence(null, 2) === null, "bez reportu nic");
  const hana = dalsiReport(posl, 2, "2026-10-25");
  tvrd(hana.datum === "2026-10-25" && hana.posunuto && hana.podleKadence === "2026-10-18", "Hana: posun na 25. 10.");
  tvrd(!dalsiReport(posl, 2, "2026-10-11").posunuto && dalsiReport(posl, 2, "2026-10-11").datum === "2026-10-18", "ruční datum termín nestáhne dřív");
  // poslala 25. 10. ⇒ ruční datum se spotřebovalo
  const po = dalsiReport(posledniPokrytyDen(h.concat([web("2026-10-25", { obdobi_od: "2026-10-05", obdobi_do: "2026-10-25" })]), "2026-10-26"), 2, "2026-10-25");
  tvrd(po.datum === "2026-11-08" && !po.posunuto, "po reportu 25. 10. další 8. 11.");
  // poslala dřív (18. 10.) ⇒ další za dva týdny, ne výzva za týden
  const driv = dalsiReport(posledniPokrytyDen(h.concat([web("2026-10-18", { obdobi_od: "2026-10-05", obdobi_do: "2026-10-18" })]), "2026-10-19"), 2, "2026-10-25");
  tvrd(driv.datum === "2026-11-01", "poslala dřív, další 1. 11. (je " + driv.datum + ")");
  // pondělní report patří k neděli předtím
  tvrd(dalsiReportPodleKadence(posledniPokrytyDen([web("2026-10-05")], "2026-10-05"), 1) === "2026-10-11", "pondělní report: další v neděli");
  // čtvrteční report: další až neděle po víkendu, ne za tři dny
  tvrd(dalsiReportPodleKadence(posledniPokrytyDen([web("2026-10-15", { obdobi_od: "2026-10-05", obdobi_do: "2026-10-15" })], "2026-10-15"), 1) === "2026-10-25", "čtvrteční report");
  // nový klient bez reportu s ručním datem
  tvrd(dalsiReport(null, 1, "2026-10-25").datum === "2026-10-25", "bez reportu platí ruční datum");
  tvrd(dalsiReport(null, 1, "nesmysl").datum === null, "nečitelné ruční datum se ignoruje");
});

Deno.test("výzva na řadě: nedělní běh a termín", () => {
  tvrd(vyzvaNaRade("2026-10-25", "2026-10-25"), "termín v neděli");
  tvrd(vyzvaNaRade("2026-10-25", "2026-10-26"), "termín v pondělí");
  tvrd(vyzvaNaRade("2026-10-25", "2026-10-28"), "termín ve středu");
  tvrd(!vyzvaNaRade("2026-10-25", "2026-10-29"), "termín ve čtvrtek ⇒ až příští neděli");
  tvrd(!vyzvaNaRade("2026-10-18", "2026-10-25"), "týden před termínem ne");
  tvrd(vyzvaNaRade("2026-11-01", "2026-10-25"), "termín propásl ⇒ připomínat dál");
  tvrd(vyzvaNaRade("2026-10-25", null), "bez termínu rozhodují stará pravidla");
});

Deno.test("neděle výzvy pro kartu klienta sedí s vyzvaNaRade", () => {
  tvrd(nedeleVyzvy("2026-10-25") === "2026-10-25", "termín v neděli ⇒ výzva tu neděli");
  tvrd(nedeleVyzvy("2026-10-28") === "2026-10-25", "termín ve středu ⇒ neděle předtím");
  tvrd(nedeleVyzvy("2026-10-29") === "2026-11-01", "termín ve čtvrtek ⇒ neděle potom");
  tvrd(nedeleVyzvy(null) === null, "bez termínu nic");
  // shoda s rozhodnutím běhu: v neděli výzvy platí, neděli předtím ne
  for (const t of ["2026-10-25", "2026-10-26", "2026-10-28", "2026-10-29", "2026-10-31"]) {
    const n = nedeleVyzvy(t)!;
    tvrd(vyzvaNaRade(n, t) && !vyzvaNaRade(pridejDny(n, -7), t), "termín " + t + ": výzva právě " + n);
  }
});

// Revize Groka 5. 10. 2026, nález 1: týden z appky založený dřív, než přišel report za víc týdnů,
// není „minulý report". Skutečný předchozí report (i poslaný v pondělí) zůstává.
Deno.test("řádky uvnitř období nejsou minulý report", () => {
  const obdobi = { od: "2026-09-28", do: "2026-10-11" };
  const appka = (d: string): RadekReportu => ({ report_date: d, source: "tvuj-coach" });
  tvrd(zacatekPokryti(appka("2026-09-28")) === "2026-09-28" && zacatekPokryti(appka("2026-10-04")) === "2026-09-28", "appka: pondělí týdne (i vložená na neděli)");
  tvrd(zacatekPokryti(web("2026-10-05")) === "2026-09-28", "web bez období: týden podle −3 dnů");
  tvrd(zacatekPokryti(web("2026-10-11", { obdobi_od: "2026-09-28", obdobi_do: "2026-10-11" })) === "2026-09-28", "web s obdobím");
  tvrd(jeUvnitrObdobi(appka("2026-09-28"), obdobi), "týden appky 28. 9. leží v období 28. 9. až 11. 10.");
  tvrd(jeUvnitrObdobi(appka("2026-10-05"), obdobi), "i druhý týden appky");
  tvrd(!jeUvnitrObdobi(appka("2026-09-21"), obdobi), "týden před obdobím zůstává");
  tvrd(!jeUvnitrObdobi(web("2026-09-27"), obdobi), "nedělní report za předchozí týden zůstává");
  tvrd(!jeUvnitrObdobi(web("2026-10-05"), { od: "2026-10-05", do: "2026-10-11" }), "pondělní report za minulý týden zůstává, i když jeho datum v období leží");
  tvrd(jeUvnitrObdobi(web("2026-10-04", { obdobi_od: "2026-09-28", obdobi_do: "2026-10-04" }), { od: "2026-09-28", do: "2026-10-04" }), "opravovaná verze téhož období se vynechá");
  tvrd(!jeUvnitrObdobi(appka("2026-09-28"), null), "report bez období nevylučuje nic (jako dřív)");
  tvrd(!jeUvnitrObdobi({ report_date: "nesmysl", source: "web" }, obdobi), "nečitelný řádek se nevylučuje");
});

// Revize Groka R2, nález 1: oprava téhož období. Tempo se počítá od data původní verze.
Deno.test("opravovaná verze: nejstarší web uvnitř období, appka a starší řádky ne", () => {
  const obdobi = { od: "2026-09-28", do: "2026-10-04" };
  const radky: RadekReportu[] = [   // jak je vrací dotaz: od nejnovějšího
    { report_date: "2026-10-06", source: "web", obdobi_od: "2026-09-28", obdobi_do: "2026-10-04" },
    { report_date: "2026-10-04", source: "web", obdobi_od: "2026-09-28", obdobi_do: "2026-10-04" },
    { report_date: "2026-09-28", source: "tvuj-coach" },
    { report_date: "2026-09-27", source: "web" },
  ];
  tvrd(opravovanaVerze(radky, obdobi)?.report_date === "2026-10-04", "původní verze je nedělní 4. 10., ne druhá oprava 6. 10.");
  tvrd(opravovanaVerze(radky.slice(2), obdobi) === null, "bez webu uvnitř období žádná oprava (appka se nepočítá)");
  tvrd(opravovanaVerze(radky, null) === null, "report bez období nic neopravuje");
});
