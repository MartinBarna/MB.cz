// =============================================================================
// START KOUČINKU: čistá validace data, které Martin zadává v adminu (dávka 9, 15. 9. 2026).
//
// PROČ VLASTNÍ SOUBOR: `index.ts` volá na konci `Deno.serve()`, takže ho test nemůže
// naimportovat, aniž by nastartoval server. Stejný vzor už v repu je (`konzultace.ts`,
// `offboard-mail.ts`). Tady se nečte DB, je to čistá funkce nad řetězcem.
//
// ⛔ TICHÉ IGNOROVÁNÍ JE TU TO NEJHORŠÍ. Kdyby se překlep v datu jen zahodil,
//    Martin by si myslel, že start uložil, a klient by mlčel podle náhrady z `granted_at`.
//    Proto se vrací DŮVOD, který UI vypíše, a zápis se vůbec neprovede.
// ⛔ `Date.UTC` z 31. února tiše vyrobí 3. březen, proto zpětný převod na řetězec.
// =============================================================================

/** Jak daleko dopředu smí start ležet. Dál = skoro jistě překlep v roce (2027 místo 2026). */
export const MAX_DNU_DOPREDU = 90;
/** Jak daleko dozadu. Start starší než rok u nově zadávaného klienta nedává smysl. */
export const MAX_DNU_DOZADU = 365;

export type StartPrevod =
  | { ok: true; start: string | null }
  | { ok: false; duvod: "tvar_RRRR-MM-DD" | "datum_neexistuje" | "prilis_daleko_v_budoucnu" | "prilis_stare" };

/**
 * Ověří datum startu koučinku ve tvaru „RRRR-MM-DD".
 *
 * @param raw   hodnota z těla požadavku (cokoli, typicky řetězec z `<input type="date">`)
 * @param tedMs aktuální čas v ms; parametrem, ať je funkce deterministická a testovatelná
 *
 * @returns `{ ok: true, start: null }` pro PRÁZDNÝ vstup. Prázdno je legitimní odpověď
 *          („start neznám"), ne chyba; volající si sám rozhodne, jestli znamená
 *          „na sloupec nesahej" (pozvánka) nebo „vymaž ho" (karta klienta).
 */
export function overStart(raw: unknown, tedMs: number = Date.now()): StartPrevod {
  const s = String(raw ?? "").trim();
  if (!s) return { ok: true, start: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok: false, duvod: "tvar_RRRR-MM-DD" };
  const t = Date.parse(s + "T00:00:00Z");
  if (!Number.isFinite(t)) return { ok: false, duvod: "datum_neexistuje" };
  // ⛔ Tenhle zpětný převod je celý smysl kontroly: „2026-02-31" se naparsuje bez chyby
  //    a vyjde z něj 3. březen. Bez porovnání by se do DB uložil JINÝ den, než Martin zadal.
  if (new Date(t).toISOString().slice(0, 10) !== s) return { ok: false, duvod: "datum_neexistuje" };
  if (t - tedMs > MAX_DNU_DOPREDU * 86400000) return { ok: false, duvod: "prilis_daleko_v_budoucnu" };
  if (tedMs - t > MAX_DNU_DOZADU * 86400000) return { ok: false, duvod: "prilis_stare" };
  return { ok: true, start: s };
}
