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
