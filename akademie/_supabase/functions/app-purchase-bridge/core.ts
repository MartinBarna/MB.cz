// =============================================================================
// Testovatelné JÁDRO funkce `app-purchase-bridge` (DI, bez Deno a bez sítě).
//
// CO TO JE: appka Tvůj Coach (jiný Supabase projekt, vlastní Stripe webhook) sem po
// PRVNÍ aktivaci předplatného pošle fakta o nákupu. Tady se z nich udělají dvě věci,
// které jdou udělat JEN na téhle straně, protože tady žijí data:
//   1. AFFILIATE PROVIZE: katalog `referral_codes` a tabulka `referrals` jsou v Academy.
//   2. BONUS K ROČNÍMU VIP: entitlement `videokurz` je taky v Academy.
//
// ⛔ PROČ NOVÁ FUNKCE, A NE ROZŠÍŘENÍ `academy-stripe-webhook`: oba projekty jedou na
//    TÉMŽE Stripe účtu a její katalog je klíčovaný PLATEBNÍMI ODKAZY. Nákup appky žádný
//    payment link nemá (jde dynamickou session), takže by spadl do neznámého klíče.
//    Navíc by to znamenalo pustit do Stripe webhooku ne-Stripe vstup ověřený jiným
//    tajemstvím. Vzor je `academy-grant` v appce, jen opačným směrem.
//
// ⛔ BALÍČEK SE TADY NEGRANTUJE, a je to rozhodnutí, ne opomenutí. U balíčku není
//    přístup ten produkt: doručení JE uvítací mail s podepsanými odkazy na dvě PDF,
//    a podepisování žije uvnitř `academy-stripe-webhook` už na dvou místech. Třetí
//    opis té logiky by byl přesně ta past „čtyři kopie rendereru". První fáze se
//    doručuje ručně; `daily-digest` na to upozorní dotazem (kdo má bonusový videokurz
//    a nemá `balicek`), takže se na ten krok nedá zapomenout.
// =============================================================================

export class BridgeError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Fakta o nákupu, jak je posílá `stripe-webhook` appky. */
export type PurchasePayload = {
  buyer_email?: unknown;
  user_id?: unknown;
  tier?: unknown;
  interval?: unknown;
  /** V HALÉŘÍCH (Stripe jednotka). Přepočet na koruny dělá tenhle soubor, jednou. */
  amount?: unknown;
  /** 'session' = skutečně zaplaceno (po slevě), 'plan' = ceníková cena, 'invoice' = z faktury. */
  amount_source?: unknown;
  currency?: unknown;
  event_id?: unknown;
  payment_intent?: unknown;
  /**
   * ⭐ Klíč idempotence, když ho volající umí určit přesněji než my. U OPAKOVANÉ platby
   * je to ID FAKTURY (`in_…`): jedna faktura = jedna provize, ať Stripe událost doručí
   * kolikrát chce a ať přijde jako `invoice.paid` i `invoice.payment_succeeded`.
   * ⛔ Schválně se neposílá v poli `payment_intent`: ID faktury není payment intent
   * a pole, které měří něco jiného, než tvrdí jeho jméno, je past pro dalšího čtenáře.
   */
  order_id?: unknown;
  subscription_id?: unknown;
  affiliate_code?: unknown;
  promotion_code_id?: unknown;
  /** 'first' (první aktivace, výchozí) nebo 'renewal' (další zaplacená faktura). */
  kind?: unknown;
  /** `invoice.billing_reason` ze Stripu. Jen do logu, rozhodnutí padlo už v appce. */
  billing_reason?: unknown;
};

/** Opakovaná platba předplatného (další faktura), ne první aktivace. */
export const KIND_RENEWAL = 'renewal';

export type ReferralCodeRow = {
  owner_email: string;
  partner_type: string;
  rate_monthly: number | null;
  rate_oneoff: number | null;
};

export type EntitlementRow = {
  active: boolean;
  expires_at: string | null;
  source: string | null;
};

export type BridgeDeps = {
  /** Aktivní řádek z `referral_codes` podle kódu, nebo null. */
  najdiAktivniKod: (kod: string) => Promise<ReferralCodeRow | null>;
  /** Rozklad ID promo kódu (`promo_…`) na text kódu přes Stripe. Bez klíče vrací důvod. */
  rozlozPromoId: (promoId: string) => Promise<{ kod: string; jak: string }>;
  /** Je tenhle order_id už v `referrals`? (přehrání události Stripem) */
  jeOrderZapsany: (orderId: string) => Promise<boolean>;
  /**
   * Kód partnera z NEJNOVĚJŠÍHO nezrušeného řádku `referrals` pro tenhle e-mail
   * a produkt `appka`, nebo null. Používá se JEN u opakované platby: u dvanácté
   * faktury už nikde nefiguruje ani `?ref=` z odkazu, ani promo kód z pokladny,
   * takže jediné trvalé místo, kde vazba „kupující → partner" žije, je tenhle
   * ledger. ⛔ Zrušené (`void`) řádky se ignorují: když Martin provizi shodil,
   * nesmí se sama vrátit další fakturou.
   */
  najdiPredchoziKodProAppku: (email: string) => Promise<string | null>;
  zapisReferral: (row: Record<string, unknown>) => Promise<void>;
  /** Sleva byla, ale kód se nepodařilo přečíst, ulož tvar, ať se to příště pozná. */
  zalogujNerozpoznanouSlevu: (promoId: string, jak: string) => Promise<void>;
  najdiEntitlement: (email: string, produkt: string) => Promise<EntitlementRow | null>;
  udelEntitlement: (row: Record<string, unknown>) => Promise<void>;
  alert: (predmet: string, detail: Record<string, unknown>) => Promise<void>;
};

export type BridgeResult = {
  ok: true;
  /** Co se stalo s atribucí. Krátký kód, ať se dá hledat v logu. */
  referral: string;
  /** Co se stalo s bonusem k ročnímu VIP. */
  bonus: string;
};

/** Produkt v `referrals`. ⛔ CHECK constraint ho musí znát, jinak insert spadne. */
export const PRODUKT_APPKA = 'appka';
/** Zdroj bonusového videokurzu. Odlišuje ho od koupeného (`stripe-videokurz`) i od ručního. */
export const BONUS_SOURCE = 'rocni-vip-bonus';
/** Tier appky, ke kterému bonus patří. `ai_basic` = VIP (Basic je `basic`). */
const VIP_TIER = 'ai_basic';

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Sazba, kterou se násobí cena nákupu. Nákup appky je vždycky PŘEDPLATNÉ (měsíční
 * i roční), takže platí `rate_monthly`; `rate_oneoff` je pro jednorázovky Academy.
 * ⚠️ Roční předplatné je pořád předplatné: kdyby se u něj sáhlo po `rate_oneoff`,
 * dostal by partner za rok jinou sazbu než za dvanáct měsíců téhož.
 */
export function sazbaProAppku(kod: ReferralCodeRow): number {
  const r = Number(kod.rate_monthly ?? 0);
  return Number.isFinite(r) && r > 0 ? r : 0;
}

/**
 * Má tenhle nákup dostat bonusový videokurz? JEN roční VIP.
 * ⚠️ Basic ho nedostává ani v ročním: bonusy k ročnímu Basicu jsou jiné a videokurz
 * mezi ně nepatří (viz srovnávací blok na `/tvuj-coach/`).
 */
export function maNarokNaBonus(tier: string, interval: string): boolean {
  return interval === 'year' && tier === VIP_TIER;
}

export async function handleAppPurchase(
  body: PurchasePayload,
  deps: BridgeDeps,
): Promise<BridgeResult> {
  const email = text(body.buyer_email).toLowerCase();
  if (!email || !email.includes('@') || email.length > 320) {
    throw new BridgeError('Chybí platný buyer_email.', 400);
  }
  const eventId = text(body.event_id);
  if (!eventId) throw new BridgeError('Chybí event_id.', 400);

  const tier = text(body.tier);
  const interval = text(body.interval);
  const jeObnova = text(body.kind) === KIND_RENEWAL;

  // ⛔ IDEMPOTENCE PODLE PLATBY, NE PODLE STAVU PŘÍSTUPU. `order_id` (u obnovy ID faktury)
  //    je nejpřesnější, `payment_intent` je druhá volba, `event_id` je záloha pro první
  //    aktivaci, kde ani jedno na session není. Všechno tři je STÁLÉ i při přehrání
  //    události, kdežto „už to má" odpovídá na jinou otázku a u opakované platby buď
  //    zapíše provizi dvakrát, nebo podruhé vůbec.
  //    Poslední pojistka je unique index `referrals_order_uidx` na `order_id` v DB.
  const orderId = text(body.order_id) || text(body.payment_intent) || eventId;

  const referral = await atribuuj(email, orderId, jeObnova, body, deps);
  // ⛔ BONUS JEN U PRVNÍ AKTIVACE, a je to výslovná podmínka, ne náhoda. Bez ní by
  //    o něm rozhodoval jen `maNarokNaBonus` + „už to má", což je idempotence podle
  //    STAVU PŘÍSTUPU: kdyby si člověk videokurz mezitím sám smazal nebo mu vypršel,
  //    dostal by ho jako dárek znovu při každé roční faktuře.
  const bonus = jeObnova ? 'netyka-se-obnova' : await udelBonus(email, tier, interval, body, deps);
  return { ok: true, referral, bonus };
}

/** Affiliate atribuce nákupu appky. Best-effort: nikdy nesmí shodit odpověď mostu. */
async function atribuuj(
  email: string,
  orderId: string,
  jeObnova: boolean,
  body: PurchasePayload,
  deps: BridgeDeps,
): Promise<string> {
  try {
    // PRIORITA 1: kód z odkazu (`?ref=…` → metadata checkoutu). Je to naše vlastní pole,
    // takže nejspolehlivější signál. ⚠️ Opačně než v `academy-stripe-webhook`, kde má
    // přednost promo kód: tam se kódy roznášejí platebními odkazy, tady odkazem partnera.
    let kod = text(body.affiliate_code).toUpperCase();
    let zdroj = kod ? 'metadata' : '';

    // PRIORITA 2: promo kód zadaný v pokladně. Přijde jako ID (`promo_…`), text kódu
    // se dolupuje u Stripu.
    if (!kod) {
      const promoId = text(body.promotion_code_id);
      if (promoId) {
        const r = await deps.rozlozPromoId(promoId);
        if (r.kod) {
          kod = r.kod.toUpperCase();
          zdroj = 'promo';
        } else {
          // Sleva byla, kód se nepřečetl. Zaloguj tvar, ať se z prvního reálného
          // případu pozná, co Stripe posílá; jinak by se to hádalo znovu.
          await deps.zalogujNerozpoznanouSlevu(promoId, r.jak);
          return 'promo-neprecten:' + r.jak;
        }
      }
    }

    // PRIORITA 3 (JEN U OPAKOVANÉ PLATBY): partner z historie v `referrals`.
    // ⛔ Tohle je celý důvod, proč provize u appky dřív skončila po první platbě.
    //    Kód z odkazu i promo kód z pokladny existují JEN v okamžiku nákupu; dvanáctá
    //    faktura o nich neví nic. Trvalá vazba „kupující → partner" žije jedině tady,
    //    v ledgeru, který stejně rozhoduje o výplatách.
    // ⛔ U PRVNÍHO nákupu se historie NEPOUŽÍVÁ: nový nákup bez kódu patří Martinovi,
    //    ne partnerovi, po kterém ten člověk přišel před rokem.
    if (!kod && jeObnova) {
      const zHistorie = await deps.najdiPredchoziKodProAppku(email);
      if (zHistorie) {
        kod = zHistorie.toUpperCase().trim();
        zdroj = 'historie';
      }
    }
    if (!kod) return 'bez-kodu';

    if (await deps.jeOrderZapsany(orderId)) return 'duplicita-order';

    const row = await deps.najdiAktivniKod(kod);
    if (!row) return 'neznamy-kod';
    // Anti-self: partner si nesmí vydělat na vlastním nákupu.
    if (String(row.owner_email).toLowerCase().trim() === email) return 'self-referral';

    // Měna. ⛔ Provize se počítá v korunách, takže cizí měna by dala číslo, které
    // vypadá jako koruny a není. Radši nezapsat a hlasitě upozornit.
    const mena = text(body.currency).toLowerCase() || 'czk';
    if (mena !== 'czk') {
      await deps.alert('Nákup appky v cizí měně: provize NEZAPSÁNA', { email, mena, kod });
      return 'cizi-mena:' + mena;
    }

    const halere = Number(body.amount);
    const castkaKc = Number.isFinite(halere) && halere > 0 ? Math.round(halere) / 100 : null;
    const sazba = sazbaProAppku(row);
    const partnerType = row.partner_type === 'affiliate' ? 'affiliate' : 'member';

    // ⛔ CHYBĚJÍCÍ SAZBA NESMÍ ZNAMENAT „NIC SE NESTALO". Řádek se zapíše s nulovou
    //    odměnou (takže je vidět, že ten kód prodal) a přijde hlasitý alert, ať Martin
    //    sazbu doplní a částku dorovnal ručně. Kdybychom nezapsali nic, prodej by po
    //    partnerovi zmizel a nikdo by se to nedozvěděl.
    //    ⚠️ U `member` kódů to platí dvojnásob: pevná odměna za doporučení appky
    //    (obdoba 300 Kč za Academy) NENÍ nikde určená a vymyslet ji tady by znamenalo
    //    rozhodnout o Martinových penězích za něj.
    const odmena = sazba > 0 && castkaKc !== null ? Math.round(castkaKc * sazba * 100) / 100 : 0;
    if (odmena === 0) {
      await deps.alert('Nákup appky s kódem, ale BEZ SAZBY: odměna zapsána jako 0', {
        email, kod, partner_type: partnerType, castka_kc: String(castkaKc ?? '?'),
        co_delat: 'Doplň rate_monthly u kódu v referral_codes a dorovnej tenhle řádek ručně.',
      });
    }

    await deps.zapisReferral({
      code: kod,
      buyer_email: email,
      product: PRODUKT_APPKA,
      amount: castkaKc,
      order_id: orderId,
      source: 'coupon',
      status: 'pending',
      reward_type: partnerType === 'affiliate' ? 'cash' : 'credit',
      reward_amount: odmena,
      partner_type: partnerType,
    });
    return 'zapsano-' + zdroj;
  } catch (e) {
    // Atribuce NIKDY nesmí shodit nákup ani odpověď mostu. Selhání jde do alertu.
    await deps.alert('Most appky: affiliate atribuce selhala', {
      email, order_id: orderId, chyba: String(e).slice(0, 200),
    });
    return 'chyba';
  }
}

/** Bonusový videokurz k ročnímu VIP. Best-effort jako atribuce. */
async function udelBonus(
  email: string,
  tier: string,
  interval: string,
  body: PurchasePayload,
  deps: BridgeDeps,
): Promise<string> {
  if (!maNarokNaBonus(tier, interval)) return 'netyka-se';
  try {
    const stavajici = await deps.najdiEntitlement(email, 'videokurz');

    // ⛔ KDO UŽ VIDEOKURZ MÁ, TOMU SE ŘÁDEK NEPŘEPISUJE. Upsert by mu přepsal `source`
    //    (a vazbu na jeho vlastní platbu), takže by se pak nedal spárovat refund toho
    //    NÁKUPU. Přístup by nezmizel a nic by nespadlo. Přesně ta tichá škoda, která
    //    se pozná až u reklamace. Bonus je v tomhle případě no-op a je to správně:
    //    člověk už tu věc má.
    if (stavajici && stavajici.active && stavajici.expires_at === null) return 'uz-mel';

    await deps.udelEntitlement({
      email,
      product: 'videokurz',
      active: true,
      source: BONUS_SOURCE,
      granted_at: new Date().toISOString(),
      // ⛔ Výslovně null, ne vynechat: kdo měl dočasný přístup, musí ho tímhle dostat
      //    natrvalo. Upsert, který pole neuvede, tam nechá staré datum a bonus by
      //    za pár týdnů vypršel.
      expires_at: null,
      // Vazba na předplatné, ze kterého bonus vznikl. Zatím se nikde nečte; je to
      // podklad pro budoucí rozhodnutí, co s bonusem při refundu ročního VIP.
      ...(text(body.subscription_id) ? { stripe_subscription_id: text(body.subscription_id) } : {}),
    });
    return 'udelen';
  } catch (e) {
    // ⚠️ Alert je tu POVINNÝ, ne zdvořilost: člověk zaplatil 4 990 Kč za rok a bonus
    // je součást toho, co si koupil. Když se neudělí, musí to někdo udělat ručně.
    await deps.alert('🔴 Roční VIP: bonusový videokurz se NEUDĚLIL', {
      email, tier, interval, chyba: String(e).slice(0, 200),
      co_delat: 'Uděl videokurz ručně v adminu (source rocni-vip-bonus).',
    });
    return 'chyba';
  }
}
