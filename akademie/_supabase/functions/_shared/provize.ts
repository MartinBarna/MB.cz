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
 * Vrácená hodnota je vždy podíl mezi 0 a 1. Záporná, nečíselná ani větší než 1 se
 * nikdy nevrátí: záporná provize by z výplaty partnera udělala dluh, `NaN` by se do DB
 * zapsal jako prázdno a `10` místo `0.10` by vyplatilo desetinásobek ceny.
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

/**
 * Sazba jako PODÍL, nebo `null`. Prázdno, `null` i nesmysl dopadnou stejně.
 *
 * ⛔⛔ MEZE JSOU 0 AŽ 1 (tedy 0 % až 100 %), protože v DB je sazba podíl, ne procento.
 *    Kdyby někdo napsal do `app_config` hodnotu `10` v dobré víře, že zapisuje deset
 *    procent, provize by vyšla DESETINÁSOBEK ceny: z Diamondu na 6 měsíců (59 500 Kč)
 *    by partnerovi vzniklo 595 000 Kč k výplatě. Hodnota mimo meze se proto zahazuje
 *    přesně jako nesmysl a volající spadne na fallback, ne na to číslo.
 */
function cislo(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
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
    // Tytéž meze jako v `cislo()`: `10` místo `0.10` je překlep, ne desetinásobná provize.
    return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
  } catch {
    return null;
  }
}

// --- Jen z první platby: kdy se provize NEZAPÍŠE -----------------------------
// ⭐ ROZHODNUTÍ MARTINA (3. 9. 2026 ráno): z koučinku je provize JEN Z PRVNÍ PLATBY
//    klienta, 10 % jednorázově. Prodloužení ani další nákup koučinku provizi nedává.
//    U ostatních produktů se nic nemění: affiliate s `order_id` bere provizi z každé
//    platby (rozhodnutí z 11. 8. 2026), member kredit je jednorázový.

export type PreskoceniVstup = {
  /** Produkt řádku v `referrals`. */
  product: string;
  /** 'affiliate' nebo 'member'. */
  partnerType: string;
  /** ID platby. Bez něj se i affiliate chová konzervativně (jedna odměna). */
  orderId: string | null;
  /** Má už kupující v `referrals` řádek na tenhle produkt (jakýkoli stav)? */
  maRadekProdukt: boolean;
  /** Jen koučink: zaplatil ten člověk koučink přes Stripe už PŘED tímhle nákupem? */
  uzPlatilDriv: boolean;
};

/** Kdy se má kontrolovat, jestli kupující už řádek na tenhle produkt má. */
export function kontrolovatRadekProduktu(v: Pick<PreskoceniVstup, "product" | "partnerType" | "orderId">): boolean {
  return v.product === "coaching" || v.partnerType !== "affiliate" || !v.orderId;
}

/**
 * Důvod, proč se provize NEZAPÍŠE, nebo `null`, když se zapsat má.
 *
 * ⚠️ `maRadekProdukt` se plní jen tehdy, když `kontrolovatRadekProduktu` řekne ano;
 *    jinak zůstává `false` a dotaz do DB se vůbec nedělá.
 */
export function duvodPreskoceniProvize(v: PreskoceniVstup): string | null {
  const jenPrvniPlatba = v.product === "coaching";
  if (v.maRadekProdukt && kontrolovatRadekProduktu(v)) {
    return jenPrvniPlatba ? "koucink-jen-prvni-platba" : "duplicita-produkt";
  }
  // Řádek v `referrals` vznikne jen u nákupu s kódem. Kdo koučink přes Stripe už
  // zaplatil bez kódu, taky není nový klient a provize se z něj podruhé neplatí.
  if (jenPrvniPlatba && v.uzPlatilDriv) return "koucink-jen-prvni-platba";
  return null;
}
