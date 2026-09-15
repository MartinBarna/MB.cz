// ⭐ START KLIENTA: první výzva k týdennímu reportu smí přijít až po prvním odkoučovaném týdnu.
//
// PROČ: `client-remind` vybírá příjemce výhradně podle aktivního nároku `coaching` a o startu
// klienta neví nic. Klient pozvaný v úterý se startem v neděli tak dostal v den startu mail
// „Týdenní report ✍️ (3 minuty)", tedy pět dní předtím, než měl co reportovat. Selhání je tiché:
// v systému po něm nezbude nic než řádek v `client_remind_sent` a mail v Martinově BCC.
//
// `entitlements.granted_at` je okamžik kliknutí v adminu, ne start koučinku, ale je to jediné
// datum o začátku klienta, které v systému existuje. Sedm dní posune první výzvu vždy na
// DRUHOU neděli po pozvání, takže klient pozvaný kdykoli během týdne ji dostane až po týdnu.
//
// ⛔ Lhůta platí JEN pro klienta, který NIKDY neposlal žádný report. Převáděný klient z Excelu
//    (pozvánka druhu „stavajici") má v `client_reports` řádky se `source='import-sheet'`
//    a ztišit se na týden nesmí, reporty posílá dávno.
// ⛔ A platí JEN pro druh mailu `report`. Upomínka k registraci (`register`) chodí dál beze
//    změny: kdo nemá účet, nemá report kam vyplnit, a odklad by ho jen zdržel.
// ⚠️ Známá hranice: `granted_at` není start. Klient pozvaný osm a víc dní před startem lhůtu
//    mine a výzvu v den startu přesto dostane. A klient, který je klientem dlouho, ale report
//    nikdy neposlal, se po NOVÉ pozvánce (upsert přepíše `granted_at`) na týden ztiší.
//    Obojí je tiché, obojí se samo vyléčí do týdne. Trvalá odpověď je vlastní `start_at`.
//
// PROČ vlastní soubor: `index.ts` volá `Deno.serve()` hned při importu, takže by ho test
// nenačetl, aniž by nastartoval server. Stejný vzor už v repu je: `drip-send/preskoc.ts`.
// Testuje se v `cerstvy-klient.test.ts`, bez sítě, disku i proměnných prostředí.

/** Kolik dní od udělení nároku se výzva k reportu přeskakuje. */
export const START_GRACE_DNI = 7;

/**
 * Je to nový klient, který ještě neměl celý týden na to, aby bylo co reportovat?
 *
 * @param email    adresa malými písmeny (stejná normalizace jako ve zbytku funkce)
 * @param grantOd  e-mail -> čas `entitlements.granted_at` v ms
 * @param nekdyReportoval  e-maily, které mají v `client_reports` JAKÝKOLI řádek, jakýkoli zdroj
 * @param ted      aktuální čas v ms; parametrem, ať je funkce deterministická a testovatelná
 *
 * ⛔ Neznámý `granted_at` (chybí, nečitelný) NENÍ důvod mail zadržet. O takovém klientovi
 *    nevíme nic a mlčet by bylo tiché selhání; vrací se false, tedy mail odejde jako dosud.
 */
export function jeCerstvyKlient(
  email: string,
  grantOd: Map<string, number>,
  nekdyReportoval: Set<string>,
  ted: number,
): boolean {
  if (nekdyReportoval.has(email)) return false;
  const od = grantOd.get(email);
  if (od === undefined) return false;
  // Nárok datovaný do budoucna (překlep v datech) je tím spíš čerstvý, proto prostý rozdíl.
  return ted - od < START_GRACE_DNI * 86400000;
}

// ==========================================================================
// ⭐ DÁVKA 9 (15. 9. 2026): zadaný START koučinku místo náhrady z `granted_at`.
// `entitlements.start_at` (migrace `davka9-start-koucinku-2026-09-15.sql`) je den, kdy
// klient reálně začíná. Martin ho zadává v adminu (pozvánka nebo karta klienta).
// Náhrada `jeCerstvyKlient` výš zůstává beze změny a platí pro každého, kdo start nemá.
// ==========================================================================

/**
 * Kolik dní od STARTU koučinku se výzva k reportu přeskakuje.
 *
 * Martinovo zadání zní „první výzva až po prvním týdnu od startu". Týden reportu je
 * pondělí až neděle a report se vyplňuje v neděli ráno, takže práh rozhoduje takhle:
 *   - 6 dní: klient, který startuje v PONDĚLÍ, reportuje hned tuhle neděli (den 6,
 *     týden se právě uzavírá). Nedělní start posune výzvu o celý týden.
 *   - 7 dní: pondělní start by čekal až na DRUHOU neděli, tedy 13. den, a u nedělního
 *     startu by hranice padla na jedinou hodinu mezi půlnocí a během cronu v 01:00 UTC.
 * Proto 6: dává celý den rezervy a nikoho nevyzve dřív, než má za sebou skoro celý týden.
 *
 * ⚠️ Hodnota je návrh stavěče, ne Martinovo rozhodnutí (15. 9. 2026). Až ji potvrdí,
 *    mění se JEN tady a v hraničním testu; nikde jinde v kódu číslo není.
 */
export const PRVNI_VYZVA_PO_DNECH = 6;

/**
 * Start dál v budoucnu než tohle = skoro jistě překlep v roce (2027 místo 2026).
 * Kdyby se bral vážně, klient by zmlkl na měsíce a nikdo by si toho nevšiml, protože
 * mlčení se nikde nehlásí. Takový start se ignoruje a padá se na náhradu.
 * ⛔ Pojistka je tady, ne jen ve validaci v adminu: do sloupce se dá zapsat i mimo admin
 *    (ruční SQL) a past se nesmí zavřít jen na jednom konci.
 */
export const START_MAX_DNU_DOPREDU = 90;

/**
 * Smí klientovi přijít výzva k týdennímu reportu?
 *
 * Pořadí podmínek je schválně:
 *   1) kdo někdy reportoval, tomu se nesahá (převáděný klient z Excelu posílá reporty roky),
 *   2) zadaný a důvěryhodný `start_at` rozhoduje,
 *   3) jinak se padá na starou náhradu z `granted_at` (`jeCerstvyKlient`).
 *
 * ⛔ Nečitelný ani chybějící start NENÍ důvod mail zadržet: vrací se stará cesta, ne ticho.
 *
 * @param email    adresa malými písmeny
 * @param startOd  e-mail -> `entitlements.start_at` v ms (půlnoc UTC daného dne)
 * @param grantOd  e-mail -> `entitlements.granted_at` v ms
 * @param nekdyReportoval  e-maily s JAKÝMKOLI řádkem v `client_reports`
 * @param ted      aktuální čas v ms; parametrem, ať je funkce deterministická
 *
 * @returns `preskocit` a DŮVOD: "start" (rozhodl zadaný start), "narok" (rozhodla náhrada),
 *          "" (nepřeskakuje se, protože klient už někdy reportoval). Důvod jde do logu
 *          i do čítačů v odpovědi, ať se přeskočený klient dá dohledat.
 */
export function preskocitVyzvuKReportu(
  email: string,
  startOd: Map<string, number>,
  grantOd: Map<string, number>,
  nekdyReportoval: Set<string>,
  ted: number,
): { preskocit: boolean; duvod: "start" | "narok" | "" } {
  if (nekdyReportoval.has(email)) return { preskocit: false, duvod: "" };
  const start = startOd.get(email);
  if (start !== undefined && start - ted <= START_MAX_DNU_DOPREDU * 86400000) {
    return { preskocit: ted < start + PRVNI_VYZVA_PO_DNECH * 86400000, duvod: "start" };
  }
  return { preskocit: jeCerstvyKlient(email, grantOd, nekdyReportoval, ted), duvod: "narok" };
}
