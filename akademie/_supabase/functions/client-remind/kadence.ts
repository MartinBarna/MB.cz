// =============================================================================
// KADENCE REPORTŮ V PŘIPOMÍNKÁCH (5. 10. 2026, Martin, rozhodnutí 2: „report každý
// 1/2/3 týden" + „další report dne", připomínka chodí k tomu datu).
//
// Kdy poslat výzvu se počítá ze dvou věcí, obě ze sdíleného modulu `_shared/report-obdobi.ts`:
//   - další report = neděle týdne posledního pokrytého dne + kadence v týdnech,
//     ručně zadané datum ho jen posouvá dál („nejdřív", dovolená),
//   - nedělní běh pošle výzvu, když do termínu zbývají nejvýš 3 dny (report za týden
//     do neděle se posílá neděle až středa).
// Okno „už dostal nedávno" zůstává pojistkou proti dvěma mailům (tři běhy jedné noci,
// a u řidší kadence ani výzva každý týden po propásnutém termínu).
//
// PROČ vlastní soubor: `index.ts` volá `Deno.serve()` hned při importu, takže by ho test
// nenačetl (stejný vzor jako `cerstvy-klient.ts`). Testy: `kadence.test.ts`.
// =============================================================================
import {
  dalsiReport,
  kadenceKlienta,
  obdobiReportu,
  posledniPokrytyDen,
  vyzvaNaRade,
  type Kadence,
  type RadekReportu,
} from "../_shared/report-obdobi.ts";

/**
 * Okno „už dostal nedávno" ve dnech. Týdenní klient 5 dní na každý druh mailu zvlášť
 * (tři běhy jedné noci), řidší kadence 7 × k − 2 dní přes oba druhy dohromady.
 * Dvoutýdenní vychází 12, tedy přesně dnešní hodnota pro seznam `client_remind_14d`:
 * o 2 dny kratší, ať se termín nepřeskočí, když nedělní běh spadne a mail odejde až v pondělí.
 */
export function oknoOpakovaniDni(k: Kadence): number {
  return k === 1 ? 5 : 7 * k - 2;
}

/** Nejdelší okno (3 týdny): odsud se čte historie odeslaných výzev. */
export const NEJDELSI_OKNO_DNI = oknoOpakovaniDni(3);

/**
 * Dostal klient výzvu „nedávno"? Týdenní: tenhle druh mailu v posledních 5 dnech.
 * Řidší kadence: JAKÝKOLI ostrý mail (pozvánka i výzva) v okně kadence, jinak by klient
 * dostal v neděli pozvánku, do týdne se zaregistroval a hned další neděli by přišla výzva.
 * @param casDruhu     poslední odeslání téhož druhu (ms), nebo undefined
 * @param casKomukoli  poslední ostré odeslání jakéhokoli druhu (ms, bez testovacích), nebo undefined
 */
export function uzDostalNedavno(k: Kadence, casDruhu: number | undefined, casKomukoli: number | undefined, ted: number): boolean {
  if (k >= 2) return casKomukoli !== undefined && ted - casKomukoli < oknoOpakovaniDni(k) * 86400000;
  return casDruhu !== undefined && ted - casDruhu < oknoOpakovaniDni(1) * 86400000;
}

export type PlanVyzvy = {
  kadence: Kadence;
  /** Kdy má přijít další report (neděle), nebo null, když klient ještě nereportoval a nic není zadané. */
  dalsi: string | null;
  posunuto: boolean;
  /** Patří výzva k reportu na tenhle nedělní běh? */
  naRade: boolean;
  /** Kolik týdnů by report pokryl, kdyby ho klient poslal dnes (1 až 4), pro slova v mailu. */
  tydnu: number;
  /** Období, které by report pokryl, kdyby ho klient poslal dnes. */
  obdobi: { od: string; do: string; dni: number };
};

/**
 * @param dnes        datum běhu v Europe/Prague
 * @param reporty     všechny řádky klienta v `client_reports` (appka se uvnitř přeskočí)
 * @param kadSloupec  `entitlements.report_kadence` (null = nezadáno)
 * @param vSeznamu14d klient je ve starém seznamu `app_config.client_remind_14d`
 * @param rucne       `entitlements.dalsi_report` (null = nezadáno)
 */
export function planVyzvy(
  dnes: string,
  reporty: RadekReportu[],
  kadSloupec: unknown,
  vSeznamu14d: boolean,
  rucne: unknown,
): PlanVyzvy {
  const kadence = kadenceKlienta(kadSloupec, vSeznamu14d);
  const dr = dalsiReport(posledniPokrytyDen(reporty, dnes), kadence, rucne);
  const o = obdobiReportu(dnes, reporty);
  return {
    kadence,
    dalsi: dr.datum,
    posunuto: dr.posunuto,
    naRade: vyzvaNaRade(dnes, dr.datum),
    tydnu: Math.max(1, Math.min(4, Math.round(o.dni / 7))),
    obdobi: { od: o.od, do: o.do, dni: o.dni },
  };
}

/**
 * Období do znění výzvy „za víc týdnů", nebo null = týdenní znění slovo od slova.
 * Revize R1, nález N4 (5. 10. 2026): týdenní klient, který report vynechal SÁM, dostane dál
 * týdenní text a období mu ukáže až formulář. Vícetýdenní znění má kadence 2 a 3 týdny
 * a od 13. 10. 2026 i týdenní klient s RUČNĚ posunutým termínem (Martin: report 18. 10.
 * se za offline týden vynechává a 25. 10. se posílá za dva týdny; „týden je za tebou" by lhalo).
 * ⛔ Jen pro `tydnu` 2 až 3 (období do 24 dní). `tydnu` 4 znamená 25 a víc dní (strop období
 *    je 28 dní, `obdobiReportu`): klient na webu skoro měsíc nereportoval. Web je dobrovolný,
 *    část klientů posílá report Excelem mailem nebo na WA (Martin 13. 10.), takže dostane týdenní
 *    znění jako dřív. Změřeno 13. 10. na živých datech: bez stropu by 25. 10. dostali „čtyři
 *    týdny jsou za tebou" čtyři klienti s posledním webovým reportem v červenci až září.
 *    Vědomá cena (revize Groka 13. 10.): webový klient s ručním posunem o 25 až 28 dní dostane
 *    týdenní znění, tedy stav před 13. 10.; datum období mu ukáže formulář.
 */
export function obdobiDoMailu(pl: PlanVyzvy | undefined): { tydnu: number; od: string; do: string } | null {
  if (!pl) return null;
  if (pl.kadence >= 2 || (pl.posunuto && pl.tydnu >= 2 && pl.tydnu <= 3)) return { tydnu: pl.tydnu, od: pl.obdobi.od, do: pl.obdobi.do };
  return null;
}

/** „dva týdny", „tři týdny", „čtyři týdny" (do mailu, víc než týden). */
export function tydnySlovy(n: number): string {
  return n === 2 ? "dva týdny" : n === 3 ? "tři týdny" : n === 4 ? "čtyři týdny" : n + " týdnů";
}
