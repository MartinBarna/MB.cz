// ============================================================
// Seznam e-mailů z jednoho textového pole `app_config` (14. 9. 2026, Martin: „podchyťme,
// ať to systém chápe i s uvozovkami").
//
// PROČ: klíče jako `client_remind_optout` a `client_remind_14d` jsou prostý text, který
// do adminu píše člověk. Původní parsování bylo `split(/[\s,;]+/)` + `toLowerCase()`, takže
// `"hana@x.cz"` s uvozovkami, `Hana Nagy <hana@x.cz>` ani `hana@x.cz.` se neshodly s adresou
// z databáze. Tiše, bez chyby: u opt-outu by člověk, který si připomínky vypnul, dostával
// maily dál; u dvoutýdenní kadence by chodily každý týden.
//
// ⛔ Zůstává jedna hranice, kterou tohle neřeší a řešit nemá: adresa napsaná jinak než
//    v databázi (překlep, jiná doména, diakritika v adrese) se neshodne. Text tady se
//    normalizuje, neuhaduje.
// ============================================================

/**
 * Vytáhne z textu množinu e-mailů (malými písmeny).
 * Snese: čárky, středníky, nové řádky, mezery navíc, uvozovky (rovné i české),
 * apostrofy, `<adresa>`, tvar `Jméno Příjmení <adresa>`, tečku nebo čárku na konci.
 * Co nevypadá jako adresa, zahodí.
 */
export function emailySeznam(hodnota: unknown): Set<string> {
  const out = new Set<string>();
  const text = String(hodnota ?? "");
  // Adresa = kus bez bílých znaků a bez oddělovačů, se zavináčem a tečkou v doméně.
  // Hranice schválně vyjmenované: uvozovky a lomené závorky se tak nedostanou dovnitř.
  const re = /[^\s<>"'“”„‘’(),;]+@[^\s<>"'“”„‘’(),;]+/g;
  for (const nalez of text.matchAll(re)) {
    // Koncová interpunkce („napiš mi na a@b.cz.") do adresy nepatří.
    const email = nalez[0].replace(/[.\-_]+$/, "").trim().toLowerCase();
    // Doména musí mít tečku a aspoň dva znaky po ní, jinak to není adresa.
    if (/@[^@\s]+\.[^@\s]{2,}$/.test(email)) out.add(email);
  }
  return out;
}
