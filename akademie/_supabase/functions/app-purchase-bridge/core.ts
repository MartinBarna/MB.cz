// =============================================================================
// Testovatelné JÁDRO funkce `app-purchase-bridge` (DI, bez Deno a bez sítě).
//
// CO TO JE: appka Tvůj Coach (jiný Supabase projekt, vlastní Stripe webhook) sem po
// PRVNÍ aktivaci předplatného pošle fakta o nákupu. Tady se z nich udělají tři věci,
// které jdou udělat JEN na téhle straně, protože tady žijí data:
//   1. AFFILIATE PROVIZE: katalog `referral_codes` a tabulka `referrals` jsou v Academy.
//   2. BONUS VIDEOKURZ: entitlement `videokurz` je taky v Academy.
//   3. MĚSÍC ACADEMY NA ZKOUŠKU u ročního VIP: entitlement `academy`, dtto.
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
  /**
   * ⭐ Stripe zákazník (`cus_…`) z appky. Ukládá se k bonusovému videokurzu, aby
   * ho refundová větev `academy-stripe-webhook` uměla spárovat s platbou, ze
   * které vznikl. ⛔ Do 2. 9. 2026 se neposílal a bonusový řádek měl NULL
   * v `stripe_customer_id` i `stripe_payment_intent`; refund appky proto kurz
   * nenašel a přístup zůstal.
   */
  customer_id?: unknown;
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
   * Kód partnera z NEJNOVĚJŠÍHO nezrušeného řádku `referrals` pro TOHLE PŘEDPLATNÉ
   * (produkt `appka`), nebo null. Používá se JEN u opakované platby: u dvanácté
   * faktury už nikde nefiguruje ani `?ref=` z odkazu, ani promo kód z pokladny,
   * takže jediné trvalé místo, kde vazba „nákup → partner" žije, je tenhle ledger.
   *
   * ⛔⛔ KLÍČEM JE PŘEDPLATNÉ, NE E-MAIL, a je to celá oprava vady V2 z revize
   * 13. 8. 2026. Podle e-mailu to fungovalo, dokud se člověk nevrátil: kdo přišel přes
   * partnera, předplatné zrušil a po půl roce se upsal PŘÍMO bez kódu, měl první fakturu
   * správně bez provize, ale od druhé bral zase starý partner, a to napořád. Reprodukováno,
   * u jednoho vráceného VIP klienta ~1 800 Kč ročně z cizí kapsy.
   *
   * ⛔ Zrušené (`void`) řádky se ignorují: když Martin provizi shodil, nesmí se sama
   * vrátit další fakturou.
   */
  najdiPredchoziKodProAppku: (email: string, subscriptionId: string | null) => Promise<string | null>;
  /**
   * Zapíše řádek do `referrals`. Vrací `'duplicita'`, když ho odmítl unikátní index
   * `referrals_order_uidx` (tuhle platbu už někdo zapsal), jinak `'ok'`. Ostatní chyby
   * hází dál. ⛔ Duplicita NENÍ selhání: je to správný výsledek souběhu dvou webhooků
   * k téže faktuře a nesmí z ní být alert (viz `atribuuj`).
   */
  zapisReferral: (row: Record<string, unknown>) => Promise<'ok' | 'duplicita'>;
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
  /** Co se stalo s bonusovým videokurzem. */
  bonus: string;
  /** Co se stalo s měsícem Academy na zkoušku (jen roční VIP). */
  academy: string;
};

/** Produkt v `referrals`. ⛔ CHECK constraint ho musí znát, jinak insert spadne. */
export const PRODUKT_APPKA = 'appka';
/**
 * Zdroj bonusového videokurzu u ROČNÍHO VIP. Odlišuje ho od koupeného
 * (`stripe-videokurz`) i od ručního.
 * ⛔⛔ TENHLE ŘETĚZEC SE ČTE JINDE A NESMÍ SE PŘEJMENOVAT: `daily-digest` (Academy)
 *    se jím ptá, kdo dostal roční VIP a čeká na ruční doručení balíčku
 *    „40 receptů a 48 odpovědí". Kdyby roční VIP dostal nový zdroj, hlídač balíčku
 *    by TIŠE přestal vidět kohokoli a lidem by balíček nikdo neposlal.
 */
export const BONUS_SOURCE = 'rocni-vip-bonus';
/**
 * Zdroj bonusového videokurzu u VŠECH OSTATNÍCH prvních plateb (od 18. 8. 2026).
 * ⚠️ Schválně jiný než `BONUS_SOURCE`: k těmhle nákupům balíček NEPATŘÍ, takže se
 *    nesmí objevit ve frontě `daily-digest`.
 */
export const BONUS_SOURCE_PRVNI_PLATBA = 'prvni-platba-bonus';
/** Zdroj měsíce Academy na zkoušku k ročnímu VIP (od 18. 8. 2026). */
export const ACADEMY_BONUS_SOURCE = 'rocni-vip-bonus-academy';
/** Tier appky, ke kterému patří ty největší bonusy. `ai_basic` = VIP (Basic je `basic`). */
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

/** Roční VIP appky (4 990 Kč). Rozhoduje o zdroji bonusu i o měsíci Academy. */
export function jeRocniVip(tier: string, interval: string): boolean {
  return interval === 'year' && tier === VIP_TIER;
}

/**
 * Má tenhle nákup dostat bonusový videokurz (hodnota 800 Kč)?
 *
 * ⭐ OD 18. 8. 2026 ANO U KAŽDÉ PRVNÍ PLATBY, tedy Basic i VIP, měsíční i roční.
 *    Do té doby ho dostával jen roční VIP. Rozhodl Martin 18. 8. 2026 a důvod je
 *    prodejní, ne technický: cílem je dostat lidi ze 14denní zkušebky rovnou do
 *    placení. I „koupím měsíc za 249 a zruším" je prodej za 249, což je pořád víc
 *    než zkušebka zadarmo.
 *
 * ⛔ „PRVNÍ PLATBA" NEHLÍDÁ TAHLE FUNKCE, ale `handleAppPurchase` podmínkou
 *    `kind !== 'renewal'`. Bez ní by videokurz chodil ke každé faktuře znovu.
 *
 * ⚠️ Funkce vrací true vždycky a je to schválně: je to jediné místo, kde je pravidlo
 *    zapsané, a kdyby se rozsah zase zúžil, mění se tady (a v testech, které na ní visí).
 *    Neznámý tier ani prázdný interval nárok neruší: sem se volá jen z aktivace
 *    PLACENÉHO předplatného, takže peníze přišly, i když se plán nepodařilo pojmenovat.
 */
export function maNarokNaBonus(_tier: string, _interval: string): boolean {
  return true;
}

/**
 * Který `source` dostane bonusový videokurz. ⛔ NENÍ to kosmetika: roční VIP musí
 * zůstat u `rocni-vip-bonus`, protože se tím jménem hlásí fronta balíčku
 * v `daily-digest`. Zbytek dostává vlastní zdroj, jinak by hlídač balíčku začal
 * hlásit i lidi, kterým balíček nepatří.
 */
export function zdrojBonusu(tier: string, interval: string): string {
  return jeRocniVip(tier, interval) ? BONUS_SOURCE : BONUS_SOURCE_PRVNI_PLATBA;
}

/**
 * Má nákup dostat MĚSÍC ACADEMY NA ZKOUŠKU? Jen roční VIP.
 * ⛔ Trvalé Academy zdarma NE (Martin 18. 8. 2026): Academy stojí 990 Kč měsíčně
 *    a rozdávat ji natrvalo by z ní udělala přílohu k appce.
 */
export function maNarokNaAcademyMesic(tier: string, interval: string): boolean {
  return jeRocniVip(tier, interval);
}

/**
 * Konec zkušebního měsíce Academy.
 * ⚠️ Kalendářní měsíc, ne 30 dní. U 31. dne v měsíci JS přeteče do dalšího měsíce
 *    (31. 1. + 1 měsíc = 3. 3.), takže člověk dostane o dva až tři dny VÍC. Nikdy míň,
 *    takže se z toho nemůže stát zkrácený přístup, za který někdo zaplatil.
 */
export function konecZkusebnihoMesice(od: Date = new Date()): string {
  const d = new Date(od.getTime());
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
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
  // ⭐ Vazba na PŘEDPLATNÉ. Zapisuje se do každého řádku a u obnovy se podle ní hledá
  //    partner. Prázdné být může (starší verze appky, jednorázová platba); pak se
  //    historie dohledá jen mezi starými řádky, viz `najdiPredchoziKodProAppku`.
  const subscriptionId = text(body.subscription_id) || null;

  const referral = await atribuuj(email, orderId, subscriptionId, jeObnova, body, deps);
  // ⛔ BONUSY JEN U PRVNÍ AKTIVACE, a je to výslovná podmínka, ne náhoda. Bez ní by
  //    o nich rozhodovalo jen „už to má", což je idempotence podle STAVU PŘÍSTUPU:
  //    kdyby si člověk videokurz mezitím sám smazal nebo mu vypršel, dostal by ho
  //    jako dárek znovu při každé faktuře. Od 18. 8. 2026 to platí dvojnásob: bonus
  //    dostává KAŽDÝ tier, takže bez téhle podmínky by ho měsíční Basic bral měsíčně.
  const bonus = jeObnova ? 'netyka-se-obnova' : await udelBonus(email, tier, interval, body, deps);
  const academy = jeObnova ? 'netyka-se-obnova' : await udelAcademyMesic(email, tier, interval, body, deps);
  return { ok: true, referral, bonus, academy };
}

/** Affiliate atribuce nákupu appky. Best-effort: nikdy nesmí shodit odpověď mostu. */
async function atribuuj(
  email: string,
  orderId: string,
  subscriptionId: string | null,
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
    // ⛔ A od 13. 8. 2026 se ani u obnovy nehledá podle e-mailu, ale podle PŘEDPLATNÉHO:
    //    jinak by „přišel přes partnera, odešel, vrátil se přímo" znamenalo, že provizi
    //    z nového vlastního nákupu bere starý partner navždycky (V2 z revize P48).
    if (!kod && jeObnova) {
      const zHistorie = await deps.najdiPredchoziKodProAppku(email, subscriptionId);
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

    const zapis = await deps.zapisReferral({
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
      // ⭐ Vazba na předplatné. Bez ní se u obnovy hledal partner podle e-mailu a provize
      //    z nového přímého nákupu tekla starému partnerovi (V2). ⛔ Sloupec musí v DB
      //    existovat DŘÍV, než se tahle verze nasadí, jinak insert spadne na neznámém poli.
      stripe_subscription_id: subscriptionId,
    });
    // ⛔ SOUBĚH NENÍ SELHÁNÍ. `jeOrderZapsany` a insert nejsou atomické, takže dva
    //    webhooky k téže faktuře můžou projít kontrolou oba a druhého zastaví až
    //    unikátní index. Výsledek je SPRÁVNÝ (jeden řádek). Kdyby to spadlo do obecného
    //    catch níž, přišel by Martinovi alert „affiliate atribuce selhala" pokaždé, když
    //    se nic nestalo, a na kanálu, který hlídá peníze, by příště zakryl skutečnou chybu.
    if (zapis === 'duplicita') return 'duplicita-order';
    return 'zapsano-' + zdroj;
  } catch (e) {
    // Atribuce NIKDY nesmí shodit nákup ani odpověď mostu. Selhání jde do alertu.
    await deps.alert('Most appky: affiliate atribuce selhala', {
      email, order_id: orderId, chyba: String(e).slice(0, 200),
    });
    return 'chyba';
  }
}

/** Bonusový videokurz ke každé první platbě appky. Best-effort jako atribuce. */
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
      source: zdrojBonusu(tier, interval),
      granted_at: new Date().toISOString(),
      // ⛔ Výslovně null, ne vynechat: kdo měl dočasný přístup, musí ho tímhle dostat
      //    natrvalo. Upsert, který pole neuvede, tam nechá staré datum a bonus by
      //    za pár týdnů vypršel.
      expires_at: null,
      // Vazba na předplatné, ze kterého bonus vznikl. Zatím se nikde nečte; je to
      // podklad pro budoucí rozhodnutí, co s bonusem při refundu ročního VIP.
      ...(text(body.subscription_id) ? { stripe_subscription_id: text(body.subscription_id) } : {}),
      // ⛔ TOHLE JE PÁROVACÍ KLÍČ REFUNDU, ne evidence. `academy-stripe-webhook`
      //    hledá řádek podle `stripe_payment_intent` a `stripe_customer_id`; když
      //    jsou oba NULL, refund appky bonusový kurz nenajde a přístup zůstane
      //    (stalo se 2. 9. 2026, odebíralo se ručně).
      // ⚠️ Jen když hodnota přišla: prázdný string by přepsal existující vazbu na NULL.
      ...(text(body.customer_id) ? { stripe_customer_id: text(body.customer_id) } : {}),
      // ⛔⛔ `stripe_payment_intent` SE K BONUSU NEZAPISUJE, A JE TO ZÁMĚR (R3, 2. 9. 2026).
      //    `academy-stripe-webhook` páruje placené produkty dotazem
      //    `.eq("stripe_payment_intent", platba).maybeSingle()` BEZ filtru na produkt.
      //    Druhý řádek s toutéž platbou by z něj udělal chybu, webhook by vrátil 500
      //    a Stripe by refund opakoval pořád dokola. Refund bonusu proto páruje
      //    `stripe_customer_id` (a u starých řádků e-mail), viz `refund-bonus.ts`.
      //    Kdo tohle pole bude chtít zapnout, musí NEJDŘÍV omezit ten dotaz na
      //    placené produkty.
    });
    return 'udelen';
  } catch (e) {
    // ⚠️ Alert je tu POVINNÝ, ne zdvořilost: člověk zaplatil a bonus je součást toho,
    // co si koupil (od 18. 8. 2026 u každého tieru, ne jen u ročního VIP za 4 990 Kč).
    // Když se neudělí, musí to někdo udělat ručně.
    await deps.alert('🔴 Nákup appky: bonusový videokurz se NEUDĚLIL', {
      email, tier, interval, chyba: String(e).slice(0, 200),
      co_delat: 'Uděl videokurz ručně v adminu (source ' + zdrojBonusu(tier, interval) + ').',
    });
    return 'chyba';
  }
}

/**
 * MĚSÍC ACADEMY NA ZKOUŠKU k ročnímu VIP (Martin 18. 8. 2026). Best-effort jako zbytek.
 *
 * ⛔⛔ EXISTUJÍCÍMU ŘÁDKU `academy` SE NESAHÁ, AŤ JE V JAKÉMKOLI STAVU. Je to celý
 *    rozdíl mezi „bonus" a „tichá škoda":
 *    · `active=true` bez expirace = DOŽIVOTNÍ členství za 8 900 Kč. Upsert by ho
 *      zkrátil na měsíc a člověk by o zaplacený přístup přišel, aniž by cokoli spadlo.
 *    · `active=true` s expirací = platí měsíčně 990 Kč. Přepis by mu přepsal `source`
 *      na bonusový, takže by se rozpadla vazba na jeho předplatné (a s ní refund).
 *    · ⚠️ `active=true` s expirací V MINULOSTI = vrácené peníze. Refund tady expiraci
 *      posune do minulosti, ale `active` NECHÁVÁ na true (viz `daily-digest`), takže
 *      „expirovaný" člověk má pořád `active=true` a spadne do větve „už má". Je to
 *      záměr: radši nedat bonus, než přepsat historii vráceného nákupu.
 *    · `active=false` = přístup někdo VĚDOMĚ ODEBRAL (admin, storno SimpleShopu,
 *      `splatky-guard` u nesplácených splátek). Grant by ho tiše vrátil a navíc
 *      přepsáním `source` zahodil stav, podle kterého ho hlídače odebraly.
 *    ⇒ Uděluje se JEN tomu, kdo řádek `academy` nemá vůbec. Kdo Academy má nebo měl,
 *      ten dostane appku bez ní; je to viditelné v logu a Martin to vidí v adminu.
 */
async function udelAcademyMesic(
  email: string,
  tier: string,
  interval: string,
  body: PurchasePayload,
  deps: BridgeDeps,
): Promise<string> {
  if (!maNarokNaAcademyMesic(tier, interval)) return 'netyka-se';
  try {
    const stavajici = await deps.najdiEntitlement(email, 'academy');
    if (stavajici) return stavajici.active ? 'uz-ma' : 'odebrana-nesahat';

    await deps.udelEntitlement({
      email,
      product: 'academy',
      active: true,
      source: ACADEMY_BONUS_SOURCE,
      granted_at: new Date().toISOString(),
      // ⛔ Výslovně datum, ne null: null je v `entitlements` DOŽIVOTNÍ přístup, a ten
      //    je za 8 900 Kč. Tohle je zkouška na měsíc.
      expires_at: konecZkusebnihoMesice(),
      // Vazba na předplatné appky, ze kterého zkouška vznikla. Zatím se nikde nečte;
      // je to podklad pro rozhodnutí, co s ní při refundu ročního VIP.
      ...(text(body.subscription_id) ? { stripe_subscription_id: text(body.subscription_id) } : {}),
    });
    return 'udelen';
  } catch (e) {
    // ⚠️ Hlasitě: je to součást toho, co si člověk za 4 990 Kč koupil.
    await deps.alert('🔴 Roční VIP: měsíc Academy na zkoušku se NEUDĚLIL', {
      email, tier, interval, chyba: String(e).slice(0, 200),
      co_delat: 'Uděl academy ručně v adminu na měsíc (source ' + ACADEMY_BONUS_SOURCE + ').',
    });
    return 'chyba';
  }
}
