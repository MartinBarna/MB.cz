// ============================================================================
// OTISK ODPOVĚDÍ DOTAZNÍKU (17. 9. 2026, nález D/N14)
//
// PROČ: `intake-capture` neměla idempotenci, jen rate limit „5 odeslání na e-mail
// za 24 h". Kdo dotazník omylem odeslal dvakrát (dvojklik, návrat v prohlížeči,
// „raději to pošlu znovu"), poslal Martinovi dva maily a Martin nevěděl, který
// je čerstvější, dokud je oba neotevřel.
//
// ⛔⛔ KLÍČ JE OBSAH, NE ČAS. Zvažoval jsem prosté „jeden mail na adresu za 24 h",
//    ale to by zahodilo OPRAVENÝ dotazník: kdo si vzpomene na důležitou věc a
//    pošle formulář znovu, má se to k Martinovi dostat, protože si to čte před
//    placeným hovorem. Proto:
//      - stejná adresa + STEJNÝ obsah do 24 h  => jen zápis do DB, žádný druhý mail,
//      - stejná adresa + JINÝ obsah            => mail odejde (je to nová informace).
//    Zápis do `consultation_intake` vzniká VŽDY, i u duplicity: databáze je zdroj
//    pravdy a ztratit odeslání kvůli tichému mailu by bylo horší.
//
// ⚠️ Otisk se počítá z odpovědí, NE z e-mailu, IP nebo atribuce. Kdyby v něm byla
//    atribuce (utm z URL), stačilo by otevřít formulář z jiného odkazu a duplicita
//    by se neshodla. Adresa je v dotazu zvlášť (`eq("email", …)`).
// ⚠️ Prázdné a nevyplněné hodnoty se normalizují stejně, takže „nevyplnil" podruhé
//    je pořád táž duplicita.
//
// PROČ VLASTNÍ SOUBOR: `index.ts` volá `Deno.serve()` hned při importu, takže by ho
// test nenačetl bez nastartování serveru. Stejný vzor jako `client-remind/cerstvy-klient.ts`.
// ⛔ Složka má TŘI soubory (`index.ts`, `cisla.ts`, `otisk.ts`). Deploy musí nahrát
//    všechny, jinak funkce spadne na chybějícím importu (mb-deploy-kopiruje-jen-index-past).
// ============================================================================

/** Pole, ze kterých se otisk počítá. ⛔ Pořadí je součást otisku, neměnit ho bezdůvodně. */
export const OTISK_POLE = [
  "goal",
  "tried_before",
  "typical_day",
  "work_shifts",
  "sleep_hours",
  "activity",
  "measurements",
  "note",
  "weight_kg",
  "age",
  "height_cm",
  "sex",
  "steps_per_day",
] as const;

/** Jedna hodnota na jeden řádek, aby se „ab" + „c" nerovnalo „a" + „bc". */
export function otiskVstup(odpovedi: Record<string, unknown>): string {
  return OTISK_POLE
    .map((k) => {
      const v = odpovedi[k];
      const s = v === null || v === undefined ? "" : String(v);
      // Sjednocení mezer a velikosti písmen: „Chci zhubnout " a „chci zhubnout"
      // je tentýž dotazník poslaný dvakrát, ne nová informace.
      return k + "=" + s.trim().toLowerCase().replace(/\s+/g, " ");
    })
    .join("\n");
}

/**
 * SHA-256 otisku v hexu. Vrací prázdný řetězec, když kryptografie není k dispozici:
 * ⛔ chybějící otisk NESMÍ zablokovat příjem dotazníku, jen vypne rozpoznání duplicity.
 */
export async function otiskOdpovedi(odpovedi: Record<string, unknown>): Promise<string> {
  try {
    const data = new TextEncoder().encode(otiskVstup(odpovedi));
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}
