// Sazba affiliate provize podle produktu.
//
// ⭐ ROZHODNUTÍ MARTINA (3. 9. 2026): z KOUČINKU je provize 10 %, ne sazba partnera.
//    Do té doby se i u koučinku brala `referral_codes.rate_oneoff` (aktivní partneři
//    mají 0,20 nebo 0,30). U Diamondu na 6 měsíců za 59 500 Kč by to znamenalo
//    provizi 11 900 Kč z jednoho prodeje, tedy jinou ekonomiku, než Martin chce.
//
// ⚠️ Sazba pro koučink NENÍ v kódu: leží v `app_config` pod klíčem `provize_koucink`,
//    stejně jako strop kapacity (`koucink_kapacita`), aby ji Martin změnil bez
//    nasazování funkce. Jediné natvrdo zapsané číslo je FALLBACK pro případ,
//    že klíč v tabulce chybí nebo v něm není číslo.
//
// ⛔ ČLENSKÝ KREDIT (BARNA kódy, `partner_type='member'`) se tímhle NEŘÍDÍ. Ten je
//    pevná částka z `ODMENA` ve webhooku a zůstává na 300 Kč. Tady jde jen o procento,
//    kterým se násobí reálně zaplacená částka u affiliate partnera.

/** Fallback, když `app_config.provize_koucink` chybí nebo není číslo. */
export const PROVIZE_KOUCINK_FALLBACK = 0.10;

export type SazbaVstup = {
  /** Produkt řádku v `referrals`: 'coaching', 'academy', 'videokurz', ... */
  product: string;
  /** Sazba partnera z `referral_codes` (rate_oneoff nebo rate_monthly). */
  partnerRate: number | null | undefined;
  /** Hodnota z `app_config.provize_koucink`, když se ji povedlo přečíst. */
  configRate: number | null | undefined;
};

/**
 * Vrátí procento provize (0,10 = 10 %) pro jeden řádek `referrals`.
 *
 * - `coaching`: sazba z `app_config`, jinak 10 %. Sazba partnera se ignoruje.
 * - ostatní produkty: sazba partnera beze změny (0, když chybí).
 *
 * Záporná ani nečíselná hodnota se nikdy nevrátí: záporná provize by z výplaty
 * partnera udělala dluh a `NaN` by se do DB zapsal jako prázdno.
 */
export function sazbaProvize(vstup: SazbaVstup): number {
  // ⛔ `Number(null)` je NULA, ne NaN. Bez téhle explicitní kontroly by chybějící klíč
  //    v `app_config` znamenal provizi 0 Kč místo fallbacku 10 % (chyceno testem RH2).
  if (vstup.product === "coaching") {
    const z = cislo(vstup.configRate);
    return z === null ? PROVIZE_KOUCINK_FALLBACK : z;
  }
  return cislo(vstup.partnerRate) ?? 0;
}

/** Nezáporné konečné číslo, nebo `null`. Prázdno, `null` a nesmysl dopadnou stejně. */
function cislo(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Přečte `app_config.provize_koucink`. Vrací `null`, když klíč chybí, není číslo
 * nebo se dotaz nepovedl; volající pak spadne na `PROVIZE_KOUCINK_FALLBACK`.
 *
 * ⛔ Best-effort jako všechno kolem provizí: čtení konfigurace nikdy nesmí shodit
 *    nákup. Když DB neodpoví, zapíše se provize z fallbacku, ne nula.
 */
// deno-lint-ignore no-explicit-any
export async function nactiSazbuKoucinku(admin: any): Promise<number | null> {
  try {
    const { data } = await admin
      .from("app_config").select("value").eq("key", "provize_koucink").maybeSingle();
    if (data?.value === null || data?.value === undefined || data?.value === "") return null;
    const n = Number(String(data.value).trim().replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}
