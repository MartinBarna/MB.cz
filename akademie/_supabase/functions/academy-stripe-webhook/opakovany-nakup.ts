// ============================================================
// OPAKOVANÝ NÁKUP JEDNORÁZOVÉHO PRODUKTU (16. 9. 2026)
// ============================================================
// Čisté funkce, žádné IO. Vlastní modul schválně: `index.ts` volá `Deno.serve()`
// hned při importu, takže cokoli, co se má dát otestovat, musí ležet vedle
// (stejný důvod jako u `refund-bonus.ts`).
//
// PROČ TOHLE EXISTUJE: do 16. 9. 2026 viselo celé doručení uvnitř
// `if (novyDozivotni)` a ven z něj se vytáhl jen balíček. Kdo si koupil DRUHOU
// konzultaci, zaplatil, dostal HTTP 200 a nic jiného: žádný mail, žádný doklad,
// žádný záznam v CRM a hlavně žádný alert „domluv termín", takže na něj nikdo
// nezavolal. Navíc mu `udelDozivotni` poslala Martinovi radu „zvaž vrácení té
// druhé platby", což je u konzultace věcně špatně: druhá hodina je normální
// opakovaný prodej.
//
// ⛔ DVA SEZNAMY, PROTOŽE SE PTÁME NA DVĚ RŮZNÉ VĚCI:
//    `OPAKOVATELNE_KLICE` jsou klíče `KATALOG` (rozhoduje o doručení; `konzultace`
//    a `konzultace-vk` jsou dva různé nákupy téhož produktu za jinou cenu),
//    `OPAKOVATELNE_PRODUKTY` jsou hodnoty `entitlements.product` (rozhoduje
//    o alertu „zvaž vrácení", který má k dispozici jen `def.produkt`).
//    Že si odpovídají, hlídá `opakovany-nakup.test.ts` proti živému `KATALOG`.

/** Klíče `KATALOG`, u kterých je druhý nákup legitimní. */
export const OPAKOVATELNE_KLICE: readonly string[] = [
  // Odkazy ke stažení platí 14 dní; kdo je nechá vypršet, koupí balíček znovu.
  "balicek",
  // Další hodina s Martinem. Ne omyl, ale opakovaný prodej.
  "konzultace",
  "konzultace-vk",
];

/** Hodnoty `entitlements.product`, u kterých je druhý nákup legitimní. */
export const OPAKOVATELNE_PRODUKTY: readonly string[] = ["balicek", "konzultace"];

/**
 * Typ události v `email_events`, podle které se pozná, že opakované doručení
 * pro TUHLE platbu už proběhlo.
 * ⛔ `balicek_znovu_doruceno` se NESMÍ přejmenovat: podle toho řetězce se
 *    dohledávají historické řádky (7. 8. a 11. 8. 2026) a přejmenování by
 *    u balíčku rozbilo idempotenci.
 */
export function typUdalostiZnovu(klic: string): string {
  if (klic === "balicek") return "balicek_znovu_doruceno";
  if (klic === "konzultace" || klic === "konzultace-vk") return "konzultace_znovu_doruceno";
  return "";
}

export function jeOpakovatelnyKlic(klic: string): boolean {
  return OPAKOVATELNE_KLICE.includes(klic);
}

export function jeOpakovatelnyProdukt(produkt: string): boolean {
  return OPAKOVATELNE_PRODUKTY.includes(produkt);
}

/**
 * Má se Martinovi u druhého nákupu poslat rada „zvaž vrácení té druhé platby"?
 * U opakovatelných produktů NE: peníze si nechává a něco za ně dodá.
 */
export function maHlasitZvazVraceni(produkt: string): boolean {
  return !jeOpakovatelnyProdukt(produkt);
}

/** Výchozí hodnota pole `opakovany_nakup` v odpovědi webhooku. */
export function stavOpakovanehoNakupu(klic: string, novyDozivotni: boolean): string {
  return jeOpakovatelnyKlic(klic) && !novyDozivotni ? "neznamo" : "netyka-se";
}
