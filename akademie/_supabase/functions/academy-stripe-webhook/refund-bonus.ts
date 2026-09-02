// =============================================================================
// Testovatelné JÁDRO: který BONUSOVÝ VIDEOKURZ Z APPKY smí sebrat refund.
//
// Proč vlastní soubor: `index.ts` má `Deno.serve` hned při importu, takže se
// z něj nedá nic zavolat v testu. Tady je jen rozhodování, dotazy do DB dodává
// volající (`BonusDeps`).
//
// ⛔⛔ CO SE TÍMHLE SMÍ ODEBRAT: VÝHRADNĚ `product = 'videokurz'` se `source`
//    ze `ZDROJE_BONUS_APPKA`, tedy kurz, který appka rozdala ZDARMA k předplatnému
//    Tvůj Coach. Zaplacený videokurz (`stripe-videokurz`, `simpleshop`), starý
//    import (`wordpress-import`), ruční dárek (`admin-panel`), bonus ke konzultaci
//    (`konzultace-bonus`), Academy ani koučink se odsud NESAHAJÍ NIKDY.
// =============================================================================

/**
 * ⛔⛔ ZDROJE VIDEOKURZU, KTERÝ ROZDALA APPKA ZDARMA k předplatnému Tvůj Coach
 * (`app-purchase-bridge` a `grant-videokurz-z-appky` v tomhle repu). Nikdo za
 * tenhle kurz neplatil zvlášť, takže když se vrátí peníze za předplatné appky,
 * bonus jde s ním.
 *
 * ⚠️ Ruční kopie toho, co umí vyrobit `zdrojBonusu()` v mostu a `sourceEntitlementu()`
 *    v grant funkci. Kdo tam přidá čtvrtý zdroj a sem ho nedopíše, vyrobí přesně
 *    tu chybu z 2. 9. 2026 znovu (bonus po refundu zůstane).
 */
export const ZDROJE_BONUS_APPKA = ["prvni-platba-bonus", "rocni-vip-bonus", "appka-vip"];

export type BonusKandidat = {
  email: string;
  product: string;
  source: string | null;
  stripe_customer_id: string | null;
};

/** Řádek, jak ho vidí hlavní párovací větev (placené produkty). */
export type ParovanyRadek = { product: string; source: string | null };

export type BonusDeps = {
  /** AKTIVNÍ `videokurz` řádky daného Stripe zákazníka. Filtr produktu a `active` dělá SQL. */
  podleZakaznika: (customerId: string) => Promise<BonusKandidat[]>;
  /** AKTIVNÍ `videokurz` řádky daného e-mailu. Filtr produktu a `active` dělá SQL. */
  podleMailu: (email: string) => Promise<BonusKandidat[]>;
};

export function jeBonusAppky(r: ParovanyRadek): boolean {
  return r.product === "videokurz" && ZDROJE_BONUS_APPKA.includes(String(r.source ?? ""));
}

/**
 * ⛔ R1: bonus z appky NESMÍ propadnout do hlavní párovací větve.
 *
 * Ta počítá s PLACENÝM produktem: pošle rozlučkový mail podle katalogu (bonus
 * v katalogu není, takže by člověku, který si koupil appku za 249, odešel mail
 * o zrušení „Barna Academy, měsíční členství") a zkusí přes Academy klíč zrušit
 * appčí předplatné. Od chvíle, kdy bonusový řádek nese `stripe_customer_id`,
 * by ho párování podle zákazníka našlo jako jediný řádek. Proto se odsud vyhazuje.
 */
export function bezBonusuAppky<T extends ParovanyRadek>(rows: T[]): T[] {
  return rows.filter((r) => !jeBonusAppky(r));
}

export type BonusNalez = {
  bonusy: BonusKandidat[];
  /** Podle čeho se spárovalo. Jde do alertu, ať je poznat, jak jistý ten závěr je. */
  podle: string;
};

/**
 * Které bonusové řádky sebrat refundu, který se NESPÁROVAL na žádný placený produkt.
 *
 * Pořadí: Stripe zákazník (bonus se váže na jedno předplatné, tohle je jistota),
 * pak e-mail z platby, a ten JEN pro řádky BEZ párovacího klíče.
 *
 * ⛔ R2: e-mail sám o sobě neříká, že refund patří appce (Academy i appka jedou na
 *    jednom Stripe účtu). Kdo `stripe_customer_id` má a nesedí, patří k JINÉ platbě
 *    a refund cizího produktu mu bonus brát nesmí, i když je zadarmo: člověk appku
 *    dál platí. E-mailová větev proto existuje jen kvůli řádkům z doby před
 *    2. 9. 2026, kdy se klíč neukládal vůbec.
 *
 * ⛔ `payment_intent` se tu SCHVÁLNĚ nehledá: bonusový řádek ho nemá dostat (viz
 *    komentář u `stripe_payment_intent` v `app-purchase-bridge`). Hlavní párovací
 *    dotaz nad tím sloupcem jede přes `maybeSingle()`, takže druhý řádek s toutéž
 *    platbou by z celého webhooku udělal 500 a Stripe by refund opakoval pořád dokola.
 *
 * ⛔ Částečný refund neodebírá nic, stejně jako hlavní větev.
 */
export async function najdiBonusyAppky(
  opts: { castecny: boolean; zakaznik: string; emailZPlatby: string },
  deps: BonusDeps,
): Promise<BonusNalez> {
  if (opts.castecny) return { bonusy: [], podle: "" };

  if (opts.zakaznik) {
    const bonusy = (await deps.podleZakaznika(opts.zakaznik)).filter(jeBonusAppky);
    if (bonusy.length) return { bonusy, podle: "stripe_customer_id" };
  }

  if (opts.emailZPlatby) {
    const bonusy = (await deps.podleMailu(opts.emailZPlatby))
      .filter((r) => jeBonusAppky(r) && r.stripe_customer_id === null);
    if (bonusy.length) return { bonusy, podle: "e-mail z platby (řádek bez klíče)" };
  }

  return { bonusy: [], podle: "" };
}
