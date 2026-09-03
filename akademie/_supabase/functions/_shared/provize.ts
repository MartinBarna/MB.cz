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
  /**
   * Má už kupující v `referrals` řádek na tenhle produkt (jakýkoli stav)?
   * ⛔ `null` znamená NEVÍME, protože DB neodpověděla. Ne `false`.
   */
  maRadekProdukt: boolean | null;
  /**
   * Jen koučink: zaplatil ten člověk koučink přes Stripe už PŘED tímhle nákupem?
   * ⛔ `null` znamená NEVÍME, protože DB neodpověděla. Ne `false`.
   */
  uzPlatilDriv: boolean | null;
};

/** Provize se nezapsala, protože DB neodpověděla. Martin ji musí přiznat ručně. */
export const PRESKOCENO_DB_CHYBA = "db-neodpovedela";

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
  if (kontrolovatRadekProduktu(v)) {
    // ⛔⛔ FAIL-CLOSED (revize 3. 9. 2026). Když DB neodpoví, NEVÍME, jestli ten člověk
    //    už řádek má. Zapsat provizi „pro jistotu" znamená u opakovaného nákupu poslat
    //    ven peníze, které vzniknout neměly, a nikdo se to nedozví. Radši ji nezapíšeme
    //    a Martin dostane alert, ať ji přizná ručně: opomenutá provize je vidět,
    //    vyplacená navíc není.
    if (v.maRadekProdukt === null) return PRESKOCENO_DB_CHYBA;
    if (v.maRadekProdukt) return jenPrvniPlatba ? "koucink-jen-prvni-platba" : "duplicita-produkt";
  }
  // Řádek v `referrals` vznikne jen u nákupu s kódem. Kdo koučink přes Stripe už
  // zaplatil bez kódu, taky není nový klient a provize se z něj podruhé neplatí.
  if (jenPrvniPlatba) {
    if (v.uzPlatilDriv === null) return PRESKOCENO_DB_CHYBA;
    if (v.uzPlatilDriv) return "koucink-jen-prvni-platba";
  }
  return null;
}

/**
 * Věta do alertu Martinovi, když se provize nezapsala kvůli chybě čtení z DB.
 * ⚠️ Musí obsahovat kód i částku, jinak nemá Martin z čeho provizi dopočítat.
 */
export function vetaProvizeRucne(kod: string, castkaKc: number | null): string {
  return "provize nepřiznána, DB neodpověděla, přiznej ručně: kód "
    + (kod || "neznámý")
    + ", částka " + (castkaKc === null ? "neznámá" : String(castkaKc) + " Kč");
}

// --- REFUND RUŠÍ PROVIZI ------------------------------------------------------
// ⭐ ROZHODNUTÍ MARTINA (3. 9. 2026): „Pokud vrátíme peníze, affiliate odměnu nedostane."
//    Platí pro affiliate provizi i pro členský kredit 300 Kč, pro celý i částečný refund.
//
// ⛔ DO 3. 9. 2026 SE TO NEDĚLO A BYLA TO TICHÁ DÍRA: větev `charge.refunded` ve
//    `academy-stripe-webhook` se tabulky `referrals` vůbec nedotkla, refund navíc
//    nastavuje jen `expires_at` a `active` nechává `true`. Auto-confirm
//    `referral_confirm_due()` po 14 dnech potvrdí každý `pending` řádek, jehož kupující
//    má aktivní nárok, takže vrácený koučink za 59 500 Kč se sám překlopil na
//    potvrzenou provizi 5 950 Kč k výplatě. Sesterské cesty (`simpleshop-webhook`,
//    `referral-webhook`) přitom `status='void'` uměly od začátku.
//
// `void` je jeden ze tří stavů v CHECK constraintu (`pending`, `confirmed`, `void`)
// a všechno počítání ho už umí vynechat: `referral_confirm_due()` potvrzuje jen
// `pending`, view `affiliate_prehled` sčítá jen `pending` a `confirmed`, měsíční report
// řádky s `void` do čísel nebere. Stačí tedy stav přepsat, nikde jinde se nesahá.

/** Stav řádku `referrals` po vrácení peněz. */
export const STAV_REFUND = "void";

/**
 * Podle kterých ID se u refundu hledá řádek v `referrals`.
 *
 * Zapisovatelé používají dva tvary `order_id`:
 *  • nákupy zapsané ve `academy-stripe-webhook` (koučink, Academy doživotně,
 *    videokurz, konzultace, balíček) ⇒ `payment_intent`,
 *  • opakovaná provize z předplatného (`zapisRecurringProvizi`) ⇒ ID FAKTURY.
 * Refundovaný Charge nese obojí (`payment_intent`, `invoice`), Dispute jen platbu.
 *
 * ⛔⛔ APPKA SEM NEPATŘÍ A NEJDE JI SEM DOSTAT. Most `app-purchase-bridge` skládá
 *    `order_id` jako `body.order_id || body.payment_intent || event_id`
 *    (`app-purchase-bridge/core.ts:249`), jenže volající, tedy `stripe-webhook`
 *    appky, posílá v těle jen `event_id` (ověřeno 3. 9. 2026 na větvi
 *    `p41-nad-p28`, `supabase/functions/stripe-webhook/index.ts:682` a `:814`).
 *    Řádek za appku má tedy v `order_id` VŽDY `evt_…`, které v refundované události
 *    není. Proto má appka vlastní párování podle e-mailu a okna, viz
 *    `DNI_OKNO_PROVIZE_APPKY`.
 *
 * ⛔ JINAK SCHVÁLNĚ NIC DALŠÍHO. `charge.id` ani `dispute.id` se do `order_id` nikdy
 *    nezapisují, takže by je hledání jen zbytečně rozšířilo o tvary, které nemůžou
 *    sedět. Párování musí být přesné: `order_id` je unikátní a zneplatnit cizí řádek
 *    znamená sebrat partnerovi peníze, na které nárok má.
 */
// deno-lint-ignore no-explicit-any
export function idPlatebProRefund(obj: any): string[] {
  const out: string[] = [];
  for (const v of [obj?.payment_intent, obj?.invoice]) {
    if (typeof v === "string" && v && !out.includes(v)) out.push(v);
  }
  return out;
}

// --- REFUND APPKY: párování podle e-mailu a okna --------------------------------
// ⛔⛔ PROČ VŮBEC JINAK. Provize za předplatné appky zapisuje most `app-purchase-bridge`
//    z appčího `stripe-webhook`, a ten do těla mostu dává jen `event_id`. V `order_id`
//    tedy stojí `evt_…`, které v refundované události Stripu nikde není, takže párování
//    podle `order_id` u appky NIKDY nesedne. Bez druhé cesty by refund appky provizi
//    nezrušil a auto-confirm by ji po 14 dnech potvrdil (přesně ta mezera, kterou
//    `referral-affiliate.sql` popisuje u větve `r.product = 'appka'`).
//
// ⚠️ Academy tu událost VIDÍ: appka i Academy jedou na jednom Stripe účtu
//    (acct_1TqQ56Bq3rKubW9k) a webhook dostává události celého účtu. Dnes takový refund
//    skončí ve větvi „not-ours", protože se nespáruje na žádný nárok v Academy.
//
// ⛔ ZÁMĚRNĚ ÚZKÉ. Sahá se JEN na řádky s `product = 'appka'` a jen tehdy, když se
//    refund nespároval na žádný nárok Academy. Provize za koučink, Academy ani videokurz
//    se tímhle dotknout nemůže. Je to heuristika, ne jistota: `referrals` si ID
//    předplatného neukládá, takže přesnější klíč v datech neexistuje.

/** Kolik dní zpátky se u refundu appky hledá řádek provize. */
export const DNI_OKNO_PROVIZE_APPKY = 30;

/**
 * Od kdy (ISO) se u refundu appky berou řádky `referrals` v úvahu.
 *
 * ⚠️ Okno je nutné: bez něj by refund pátého měsíce zneplatnil i provizi z první
 *    platby před rokem, kterou partner poctivě dostal a která se refundu netýká.
 *    30 dní pokrývá měsíční i roční předplatné, protože provize vzniká u KAŽDÉ
 *    zaplacené faktury, tedy nejpozději měsíc před jejím vrácením.
 */
export function oknoProvizeAppkyIso(ted: Date = new Date()): string {
  return new Date(ted.getTime() - DNI_OKNO_PROVIZE_APPKY * 24 * 60 * 60 * 1000).toISOString();
}

// --- Co má Martin dělat, když se provize zrušila -------------------------------
// ⛔⛔ VLASTNÍ FUNKCE KVŮLI PRIORITĚ OPERÁTORŮ (oprava po revizi 3. 9. 2026).
//    Věta o sporu byla ve webhooku napsaná jako `a ? x : y + vetaSporu`, jenže `+`
//    váže silněji než `?:`, takže se přilepila JEN k větvi `y`. U sporu nad UŽ
//    POTVRZENOU provizí, tedy přesně tam, kde jde o největší peníze, tak chyběla.
//    Tady je to jedno místo a test si obě varianty vypíše, místo aby to hlídal regex.

/**
 * Text `co_delat` do alertu po zrušení provize.
 *
 * @param potvrzenych kolik ze zrušených řádků bylo ve stavu `confirmed`
 * @param jeSpor      `charge.dispute.created` místo `charge.refunded`
 *
 * ⛔ Věta o sporu patří do OBOU větví: vyhraný spor znamená vrátit provizi ručně
 *    bez ohledu na to, jestli byla teprve `pending`, nebo už `confirmed`.
 */
export function coDelatPoZruseniProvize(potvrzenych: number, jeSpor: boolean): string {
  const zaklad = potvrzenych > 0
    ? "⛔ Provize byla potvrzená, tedy mohla už být VYPLACENÁ. Zkontroluj "
      + "`referral_payouts` a v přehledu výplat si to srovnej s partnerem. "
      + "Automatika ji jen přestala počítat, peníze zpátky nevzala."
    : "✅ Nic dělat nemusíš. Provize čekala na potvrzení a teď se nepotvrdí "
      + "ani nezapočítá do výplaty.";
  return zaklad + vetaOSporu(jeSpor);
}

/** Dovětek o sporu. Prázdný u obyčejného refundu. */
export function vetaOSporu(jeSpor: boolean): string {
  return jeSpor
    ? " ⚠️ Spor lze u banky vyhrát. Při vyhraném sporu vrať provizi ručně na `pending`."
    : "";
}
