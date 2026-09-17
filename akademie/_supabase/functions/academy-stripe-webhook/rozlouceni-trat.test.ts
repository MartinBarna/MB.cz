// =============================================================================
// Rozlučkový mail po refundu: kdy se pošle, kdy se NEPOŠLE a co místo toho udělá.
// Spuštění: npx --yes deno@2 run --allow-read rozlouceni-trat.test.ts
//
// ⭐ ROZHODNUTÍ ŠÉFA 17. 9. 2026 (nález A/N9, po revizi R2): když pro dojezdovou
//    variantu chybí šablona, NEPOSÍLÁ SE NIC. Verze „hned" tvrdí „Přístup se tím
//    uzavřel", což je u dojezdu nepravda, a nepravda v mailu o vrácení peněz je horší
//    než žádný mail. Místo mailu jde Martinovi alert se vším pro ruční odpověď.
//
// ⛔⛔ CO TENHLE TEST JE A CO NENÍ:
//    Část A je ČISTÁ LOGIKA (`rozlouceniTrack`, kopie těla, viz níž) a testuje se
//    s kontrastem. Část B je STATICKÁ KONTROLA ZDROJÁKU, protože `vyberRozlouceniTrack`
//    sahá na `admin` a `alertAdmin` z modulu a bez sítě se zavolat nedá.
//    ⚠️ Statická kontrola NEDOKAZUJE, že se kód takhle chová. Dokazuje jen, že v něm
//       ta věta je. Proto má každá kontrola i KONTRAST: hlídá se i to, že tam
//       stará (zamítnutá) varianta UŽ NENÍ. `feedback-zeleny-test-neni-dukaz-spravnosti`.
// =============================================================================

let selhalo = 0;
function check(nazev: string, podminka: boolean, detail = ""): void {
  if (podminka) console.log("  ok   " + nazev);
  else { selhalo++; console.log("  FAIL " + nazev + (detail ? "  [" + detail + "]" : "")); }
}

const ROZLOUCENI_HNED = "rozlouceni-refund-hned";
const ROZLOUCENI_DOJEZD = "rozlouceni-refund-dojezd";

/**
 * Kopie čisté funkce z `index.ts`. ⛔ Když se tam změní, musí se změnit i tady;
 * část B proto hlídá, že originál pořád vypadá stejně (kontrola „telo se nezmenilo").
 */
function rozlouceniTrack(expiraceIso: string | null, ted: number): string {
  if (!expiraceIso) return ROZLOUCENI_HNED;
  return new Date(expiraceIso).getTime() > ted + 60_000 ? ROZLOUCENI_DOJEZD : ROZLOUCENI_HNED;
}

async function main(): Promise<void> {
  const TED = Date.parse("2026-09-17T10:00:00Z");

  console.log("\n== A. Ktera varianta se PREFERUJE (cista logika, s kontrastem) ==");
  check("bez expirace -> hned", rozlouceniTrack(null, TED) === ROZLOUCENI_HNED);
  check("expirace ted -> hned", rozlouceniTrack("2026-09-17T10:00:00Z", TED) === ROZLOUCENI_HNED);
  check("expirace pred minutou -> hned", rozlouceniTrack("2026-09-17T09:59:00Z", TED) === ROZLOUCENI_HNED);
  check("30 s dopredu je porad hned (tolerance 60 s)",
    rozlouceniTrack("2026-09-17T10:00:30Z", TED) === ROZLOUCENI_HNED);
  check("KONTRAST: za dva dny -> dojezd",
    rozlouceniTrack("2026-09-19T10:00:00Z", TED) === ROZLOUCENI_DOJEZD);
  check("KONTRAST: za dve minuty uz taky dojezd",
    rozlouceniTrack("2026-09-17T10:02:00Z", TED) === ROZLOUCENI_DOJEZD);

  console.log("\n== B. Co se stane, kdyz sablona pro dojezd chybi (staticka kontrola) ==");
  const zdroj = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const od = zdroj.indexOf("async function vyberRozlouceniTrack");
  const telo = zdroj.slice(od, zdroj.indexOf("\n}", od));
  check("funkce `vyberRozlouceniTrack` v `index.ts` existuje", od > 0);

  check("pri chybejici sablone vraci PRAZDNY retezec (ticho)",
    (telo.match(/return "";/g) ?? []).length === 2, "ocekavany dve vetve ticha");
  check("KONTRAST: uz NEVRACI `ROZLOUCENI_HNED` jako nahradu",
    !telo.includes("return ROZLOUCENI_HNED"),
    "zamitnuta varianta: posilat nepresnou vetu misto ticha");
  check("dojezdovou trat vrati jen kdyz sablona opravdu je",
    /if \(data\) return ROZLOUCENI_DOJEZD;/.test(telo));

  check("alert nese adresu, castku, produkt i datum konce pristupu",
    /email: info\.email/.test(telo) && /castka: info\.castka/.test(telo) &&
      /produkt: info\.produkt/.test(telo) && /pristup_do: info\.pristupDo/.test(telo));
  check("chyba cteni a chybejici sablona maji RUZNY predmet (nesmi se slit)",
    telo.includes("nešlo ověřit šablonu") && telo.includes("chybí šablona"));
  check("oba alerty rikaji, ze zakaznikovi NIC neodeslo",
    (telo.match(/NIC NEODEŠLO/g) ?? []).length === 2);
  check("KONTRAST: zadny alert uz netvrdi, ze mail odesel",
    !telo.includes("ODEŠEL"), "stara verze psala `Mail o vraceni penez ODESEL`");

  console.log("\n== C. Volajici prazdnou trat OSETRUJE (jinak treti matouci alert) ==");
  check("pred `posliUvitani` je podminka na neprazdnou trat",
    /if \(rozlouceniTrat\) await posliUvitani\(ent\.email, rozlouceniTrat, rozlouceniVars\);/.test(zdroj));
  check("KONTRAST: `posliUvitani` se uz NEVOLA s vysledkem primo v argumentu",
    !/posliUvitani\(ent\.email, await vyberRozlouceniTrack/.test(zdroj));
  check("`vyberRozlouceniTrack` se vola PRAVE JEDNOU",
    (zdroj.match(/await vyberRozlouceniTrack\(/g) ?? []).length === 1);
  check("cista `rozlouceniTrack` se vola PRAVE JEDNOU, a to zevnitr brany",
    (zdroj.match(/= rozlouceniTrack\(expiraceIso\);/g) ?? []).length === 1);

  console.log("\n== D. Telo ciste funkce v `index.ts` sedi s kopii v tomhle testu ==");
  check("telo se nezmenilo (jinak prepis i kopii vys)",
    /function rozlouceniTrack\(expiraceIso: string \| null\): string \{\s*\n\s*if \(!expiraceIso\) return ROZLOUCENI_HNED;\s*\n\s*return new Date\(expiraceIso\)\.getTime\(\) > Date\.now\(\) \+ 60_000/.test(zdroj));

  console.log(selhalo === 0 ? "\nVSE ZELENE\n" : `\n${selhalo} SELHANI\n`);
  if (selhalo > 0) throw new Error(String(selhalo) + " selhani");
}

await main();
