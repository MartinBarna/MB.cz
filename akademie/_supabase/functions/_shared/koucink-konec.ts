// =============================================================================
// KONEC KOUČINKU: jedno místo, které zavře přístup, a čisté funkce kolem toho.
// (22. 9. 2026, GO Martina: „když klient skončí, appka se zavře sama a přijde
//  nabídka VIP na rok se slevou".)
//
// PROČ TENHLE SOUBOR VZNIKL
// Odebrání přístupu žilo JEN uvnitř akce `client_offboard` v `admin-api/index.ts`,
// tedy uvnitř `Deno.serve()`. Cron nad tím nešel postavit jinak než kopií, a dvě
// kopie téhle logiky by znamenaly, že se jednoho dne rozejde POJISTKA na Academy
// (kdo má zaplacenou Academy, o appku přijít nesmí) a někomu se sebere členství
// za 8 900 Kč. Proto je tady a importují si ji OBA volající.
//
// ⛔ ŽÁDNÝ RESEND V TOMHLE SOUBORU. Mail si posílá každý volající sám přes
//    `_shared/resend-odeslat.ts` a AŽ PO `guardSend`. Inventář odesílacích cest
//    (`resend-call-sites.test.ts`) skenuje i `_shared`, takže fetch na Resend
//    tady by obešel kontrolu, která hlídá, že před každým zákaznickým mailem
//    stojí brána.
//
// ⛔ CENY TU NEJSOU A BÝT NESMÍ (spec §9). Sleva se popisuje procentem, částku
//    říká až Stripe podle kupónu a `pricing_plans`.
// =============================================================================

// deno-lint-ignore no-explicit-any
type Admin = any;

// -----------------------------------------------------------------------------
// 1) DATUM KONCE KOUČINKU (validace toho, co Martin zadá v adminu)
// -----------------------------------------------------------------------------
// Vzor `overStart` v `admin-api/start-klienta.ts`, ale JINÉ MEZE a je to záměr:
// start leží skoro vždycky v minulosti nebo pár dní dopředu, konec naopak bývá
// měsíce dopředu (Gold na 6 měsíců) a u doplňování historie i rok zpátky.

/** Jak daleko dopředu smí konec ležet. Dál = skoro jistě překlep v roce. */
export const MAX_DNU_KONEC_DOPREDU = 760;
/** Jak daleko dozadu. Starší konec u živého nároku nedává smysl. */
export const MAX_DNU_KONEC_DOZADU = 400;

export type KonecPrevod =
  | { ok: true; konec: string | null }
  | { ok: false; duvod: "tvar_RRRR-MM-DD" | "datum_neexistuje" | "prilis_daleko_v_budoucnu" | "prilis_stare" };

/**
 * Ověří datum konce koučinku ve tvaru „RRRR-MM-DD" a převede ho na okamžik.
 *
 * ⛔ VRACÍ KONEC DNE, ne půlnoc na jeho začátku. Martin do pole napíše poslední
 *    den spolupráce; kdyby se uložilo `T00:00:00Z`, byl by klient „po konci"
 *    celý ten den, který má ještě zaplacený. Ukládá se proto `T23:59:59Z`.
 * ⛔ Zpětný převod na řetězec je celý smysl kontroly: „2026-02-31" se naparsuje
 *    bez chyby a vyjde z něj 3. březen (táž past jako u `overStart`).
 *
 * Prázdný vstup je legitimní odpověď („konec neznám"), ne chyba. Volající
 * rozhodne, jestli znamená „nesahej" (pozvánka) nebo „vymaž" (karta klienta).
 */
export function overKonecKoucinku(raw: unknown, tedMs: number = Date.now()): KonecPrevod {
  const s = String(raw ?? "").trim();
  if (!s) return { ok: true, konec: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok: false, duvod: "tvar_RRRR-MM-DD" };
  const t = Date.parse(s + "T00:00:00Z");
  if (!Number.isFinite(t)) return { ok: false, duvod: "datum_neexistuje" };
  if (new Date(t).toISOString().slice(0, 10) !== s) return { ok: false, duvod: "datum_neexistuje" };
  if (t - tedMs > MAX_DNU_KONEC_DOPREDU * 86400000) return { ok: false, duvod: "prilis_daleko_v_budoucnu" };
  if (tedMs - t > MAX_DNU_KONEC_DOZADU * 86400000) return { ok: false, duvod: "prilis_stare" };
  return { ok: true, konec: s + "T23:59:59.000Z" };
}

/** Datum ze `expires_at` zpátky do pole `<input type="date">`. Prázdno = konec není. */
export function konecDoPole(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toISOString().slice(0, 10);
}

// -----------------------------------------------------------------------------
// 2) KDO SE MÁ ZAVŘÍT (čistý výběr, aby šel otestovat bez databáze)
// -----------------------------------------------------------------------------

export type KoucinkRadek = {
  email: string;
  active: boolean;
  expires_at: string | null;
};

export type VyberOpts = {
  /** Aktuální čas v ms. Parametrem, ať je funkce deterministická. */
  tedMs: number;
  /** Kolik dní po konci se ještě čeká, než se přístup zavře. */
  graceDny: number;
  /** E-maily, kterých se automat NETÝKÁ (`app_config.koucink_konec_optout`). */
  optout?: string[];
  /** E-maily, které už mají razítko (běžící nebo hotový odchod). */
  jizOrazitkovane?: string[];
};

export type VyberVysledek = {
  kUkonceni: KoucinkRadek[];
  /** Aktivní nároky BEZ data konce. Automat se jich netýká a je to vidět. */
  bezData: number;
  /**
   * Konec UŽ MINUL, ale ještě běží ochranná lhůta.
   * ⛔ Nepočítá se sem konec v budoucnu (revize R1, nález N12): dřív obě skupiny
   *    padaly do jednoho čísla a běh nanečisto hlásil „v ochranné lhůtě" i o lidech,
   *    kterým koučink v klidu běží. Číslo, které měří něco jiného, než tvrdí jeho
   *    popisek, je horší než žádné.
   */
  vGraci: number;
  /** Konec je teprve před nimi. Běžný stav živého klienta. */
  predKoncem: number;
  /** Vyňatí Martinem. */
  vOptout: number;
};

/**
 * Vybere nároky, kterým zaplacené období uplynulo a mají se zavřít.
 *
 * ⛔⛔ `expires_at = null` ZNAMENÁ „konec neznám", NE „skončil". Nárok bez data se
 *    nezavírá nikdy. Změřeno 22. 9. 2026 na živé DB: všech 20 aktivních
 *    koučinkových nároků má `expires_at` prázdné, takže bez doplnění data tenhle
 *    automat nezavře NIKOHO. Je to vlastnost, ne chyba: zavřít člověka, u kterého
 *    nevím, do kdy má zaplaceno, je horší než nezavřít nikoho. Že se nemá na čem
 *    spustit, hlásí funkce zvlášť (`bezData`), ať se nula nepřečte jako
 *    „nikdo neskončil". Volající na to upozorní Martina.
 * ⛔ Neaktivní nárok se přeskakuje: ten už někdo zavřel (ručně nebo minulý běh).
 */
export function vyberKeUkonceni(radky: KoucinkRadek[], opts: VyberOpts): VyberVysledek {
  const optout = new Set((opts.optout ?? []).map((e) => String(e ?? "").trim().toLowerCase()).filter(Boolean));
  const orazitkovane = new Set(
    (opts.jizOrazitkovane ?? []).map((e) => String(e ?? "").trim().toLowerCase()).filter(Boolean),
  );
  const mez = opts.tedMs - Math.max(0, opts.graceDny) * 86400000;
  const kUkonceni: KoucinkRadek[] = [];
  let bezData = 0, vGraci = 0, predKoncem = 0, vOptout = 0;
  for (const r of radky) {
    if (!r || r.active !== true) continue;
    const email = String(r.email ?? "").trim().toLowerCase();
    if (!email) continue;
    if (!r.expires_at) { bezData++; continue; }
    const konec = Date.parse(String(r.expires_at));
    if (!Number.isFinite(konec)) { bezData++; continue; }
    if (konec > mez) {
      // Dvě různé situace, dvě různá čísla: „období běží" a „skončilo, ale čekáme".
      if (konec > opts.tedMs) predKoncem++;
      else vGraci++;
      continue;
    }
    if (optout.has(email)) { vOptout++; continue; }
    if (orazitkovane.has(email)) continue;
    kUkonceni.push({ ...r, email });
  }
  return { kUkonceni, bezData, vGraci, predKoncem, vOptout };
}

// -----------------------------------------------------------------------------
// 3) PROMO KÓD PRO BÝVALÉHO KLIENTA (Stripe)
// -----------------------------------------------------------------------------

/**
 * Abeceda bez znaků, které si lidé pletou (0/O, 1/I/L). Kód se přepisuje z mailu
 * do pokladny rukou, takže záměna znamená nepoužitou slevu a naštvaného člověka.
 */
export const PROMO_ABECEDA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const PROMO_PREFIX = "VIP-";
export const PROMO_DELKA = 6;
/** Jak dlouho kód platí. Martin 22. 9. 2026: čtrnáct dní. */
export const PROMO_PLATNOST_DNI = 14;

// ⛔ TIMEOUTY NA VOLÁNÍ VEN (revize R1, nález V2). Cron utne HTTP po 120 s a
//    Supabase Free dává funkci 150 s; jedno visící volání jinak sežere celý běh,
//    funkci zabijí uprostřed člověka a razítko zůstane v `rezervovano` navždy.
//    Čísla jsou úmyslně nízká: Stripe i most do appky běžně odpovídají do vteřiny,
//    takže patnáct a dvacet vteřin je už jasná porucha, ne pomalá síť.
export const VYCHOZI_TIMEOUT_STRIPE_MS = 15_000;

/**
 * Jak dlouho se čeká, než se rezervace razítka bere jako opuštěná.
 * ⛔ Když edge funkci zabije timeout cronu, `catch` v kódu se neprovede a řádek
 *    zůstane v `rezervovano` navždy. Třicet minut je pohodlně nad stropem jednoho
 *    běhu a pohodlně pod denní periodou cronu.
 * ⛔⛔ JE TO ZÁROVEŇ PODMÍNKA ZÁMKU (revize R3, nález V1): přechod
 *    `rezervovano` → `rezervovano` splní svou vlastní podmínku pořád, takže ho
 *    vylučovacím dělá až stáří. Proto je konstanta tady a ne ve dvou kopiích:
 *    kdyby se rozešla, zámek tlačítka a zámek cronu by prošly naráz.
 */
export const ZASEKNUTO_PO_MS = 30 * 60 * 1000;
export const VYCHOZI_TIMEOUT_APPKA_MS = 20_000;

/**
 * Vyrobí kód tvaru `VIP-XXXXXX`.
 *
 * ⛔ Náhoda jde z `crypto.getRandomValues`, ne z `Math.random`. Kód je jednorázová
 *    sleva vázaná na jednoho člověka; předvídatelný generátor by z ní udělal
 *    slevu pro kohokoli, kdo si tipne tvar.
 * `nahodne` je parametrem kvůli testu (deterministický běh), ne kvůli volajícímu.
 */
export function vygenerujPromoKod(nahodne?: (n: number) => Uint8Array): string {
  const zdroj = nahodne ?? ((n: number) => crypto.getRandomValues(new Uint8Array(n)));
  const bajty = zdroj(PROMO_DELKA);
  let out = "";
  for (let i = 0; i < PROMO_DELKA; i++) out += PROMO_ABECEDA[bajty[i] % PROMO_ABECEDA.length];
  return PROMO_PREFIX + out;
}

/** Platnost kódu v sekundách od epochy (Stripe chce `expires_at` v sekundách). */
export function promoPlatnostDo(tedMs: number = Date.now()): number {
  return Math.floor((tedMs + PROMO_PLATNOST_DNI * 86400000) / 1000);
}

/**
 * Tělo požadavku na Stripe `POST /v1/promotion_codes`. Čistá funkce, ať jde
 * otestovat bez sítě (a ať je v testu vidět, co přesně se do Stripu posílá).
 *
 * ⛔ `max_redemptions=1`: kód je pro JEDNOHO člověka. Bez toho by stačilo, aby ho
 *    jeden bývalý klient poslal dál, a sleva by platila komukoli.
 * ⛔ `customer` se schválně NEPOSÍLÁ. Stripe zákazník appky (`cus_…`) vzniká až
 *    v pokladně appky a Academy jeho id nezná; vázat kód na neexistující id by
 *    skončilo chybou 400 a mail by neodešel. Omezení na jednoho drží
 *    `max_redemptions` a 14denní platnost.
 * ⚠️ Sleva samotná (20 %) je v KUPÓNU, který zakládá Martin ve Stripu ručně.
 *    Tady se procento nikde neopakuje: dvě místa s jedním číslem se rozejdou.
 */
export function promoForm(
  opts: { couponId: string; kod: string; expiresAt: number; email: string },
): Record<string, string> {
  return {
    coupon: opts.couponId,
    code: opts.kod,
    max_redemptions: "1",
    expires_at: String(opts.expiresAt),
    "metadata[duvod]": "koucink-konec",
    "metadata[email]": opts.email,
  };
}

/**
 * Kód s tímhle textem ve Stripu je, ale je archivovaný (typicky proto, že
 * přestal platit jeho kupón). Volající si má vylosovat NOVÝ text.
 * ⛔ Je to vlastní kód, ne obecná chyba: obecnou chybu by opakování nespravilo,
 *    tuhle ano, a jen jednou.
 */
export const CHYBA_KOD_NEAKTIVNI = "kod_neaktivni";

export type PromoVysledek =
  | { ok: true; kod: string; id: string }
  | { ok: false; chyba: string };

/**
 * Najde kód ve Stripu podle jeho textu.
 * `null` = takový kód není, `undefined` = nepodařilo se zjistit.
 *
 * ⛔⛔ ČTE SE `active` (revize R3, nález S6). Do R3 stačilo, že list vrátil
 *    JAKÝKOLI objekt, a kód se bral jako použitelný. Jenže Stripe archivuje
 *    promo kódy, jakmile přestane platit jejich kupón („if the underlying coupon
 *    for a promotion code becomes invalid, all of its promotion codes become
 *    permanently inactive"), a takový kód v pokladně slevu nedá. Mail by slíbil
 *    slevu a člověk by v pokladně viděl, že kód neplatí.
 * ⚠️ Filtr `active=true` se POSÍLÁ (revize R4). Prázdný seznam tím znamená
 *    „aktivní kód s tímhle textem není", a to je celá otázka. Rozdíl „není vůbec"
 *    versus „je, ale archivovaný" se pozná až z odpovědi na POST (`already
 *    exists`), takže se kvůli němu nemusí filtrovat ručně v kódu.
 */
async function najdiPromoKod(
  stripeKey: string,
  kod: string,
  timeoutMs: number,
): Promise<{ id: string; active: boolean } | null | undefined> {
  let res: Response;
  try {
    res = await fetch(
      // ⛔ FILTR `active=true` (revize R4). Prázdný seznam pak znamená „aktivní
      //    kód s tímhle textem neexistuje", což je přesně otázka, na kterou se
      //    ptáme. Rozdíl „není vůbec" versus „je, ale archivovaný" rozhodne až
      //    POST: `already exists` znamená, že text je obsazený neaktivním kódem.
      "https://api.stripe.com/v1/promotion_codes?limit=1&active=true&code=" + encodeURIComponent(kod),
      { headers: { Authorization: "Bearer " + stripeKey }, signal: AbortSignal.timeout(timeoutMs) },
    );
  } catch {
    return undefined;
  }
  if (!res.ok) return undefined;
  try {
    const j = await res.json() as { data?: { id?: unknown; active?: unknown }[] };
    const prvni = Array.isArray(j.data) ? j.data[0] : undefined;
    // ⛔ `active` se čte i přes filtr: kdyby Stripe filtr někdy ignoroval, pořád
    //    se nesmí použít archivovaný kód.
    return prvni ? { id: String(prvni.id ?? ""), active: prvni.active === true } : null;
  } catch {
    return undefined;
  }
}

/**
 * Zajistí, že ve Stripu existuje promo kód S PŘESNĚ TÍMHLE TEXTEM, a vrátí ho.
 *
 * ⛔⛔ KÓD SI URČUJE VOLAJÍCÍ, NE TAHLE FUNKCE (revize R2, nález V2). Do R2 se kód
 *    losoval až tady, takže pád sítě mezi `POST /v1/promotion_codes` a uložením
 *    řádku znamenal, že kód ve Stripu VZNIKL, my jsme o něm nevěděli a další běh
 *    založil DALŠÍ. Pět pokusů = až pět nepoužitých slev viset ve Stripu.
 *    ⇒ Volající kód vylosuje, ULOŽÍ SI HO a teprve pak volá sem. Opakování se
 *      stejným textem je tím pádem idempotentní: buď ho tu najdeme, nebo založíme.
 *
 * ⛔⛔ SELHÁNÍ SE NEPOLYKÁ A MAIL BEZ KÓDU NEJDE. Mail slibuje slevu; kdyby odešel
 *    s kódem, který ve Stripu není, člověk ho zadá v pokladně, uvidí „neplatný
 *    kód" a nekoupí nic. Volající proto při `ok: false` neodesílá a alertuje.
 *
 * ⚠️ `already exists` po prázdném GET znamená, že text je obsazený NEAKTIVNÍM
 *    kódem. Nebere se jako úspěch (to byla vada do R3): ověří se druhým GETem
 *    a když aktivní kód pořád není, vrací se `kod_neaktivni` a volající si
 *    vylosuje nový text.
 */
export async function zajistiPromoKod(
  stripeKey: string,
  opts: { couponId: string; email: string; kod: string; tedMs?: number; timeoutMs?: number },
): Promise<PromoVysledek> {
  if (!stripeKey) return { ok: false, chyba: "chybi_stripe_klic" };
  if (!opts.couponId) return { ok: false, chyba: "chybi_coupon_id" };
  const kod = String(opts.kod ?? "").trim();
  if (!kod) return { ok: false, chyba: "chybi_kod" };
  const timeoutMs = opts.timeoutMs ?? VYCHOZI_TIMEOUT_STRIPE_MS;

  // 1) Nemáme ho ve Stripu už z minula? (Opakovaný pokus po pádu sítě.)
  const nalez = await najdiPromoKod(stripeKey, kod, timeoutMs);
  if (nalez && nalez.active) return { ok: true, kod, id: nalez.id };
  // ⛔ Kód existuje, ale je archivovaný. Stripe nedovolí založit aktivní kód
  //    s týmž textem, takže tenhle se musí zahodit a volající si má vylosovat
  //    nový. Vlastní chybový kód, ať to jde odlišit od poruchy Stripu.
  if (nalez && !nalez.active) return { ok: false, chyba: CHYBA_KOD_NEAKTIVNI };
  // `undefined` = nevíme. Pokračujeme na POST; při kolizi se to pozná z odpovědi.

  const form = promoForm({
    couponId: opts.couponId,
    kod,
    expiresAt: promoPlatnostDo(opts.tedMs ?? Date.now()),
    email: opts.email,
  });
  let res: Response;
  try {
    res = await fetch("https://api.stripe.com/v1/promotion_codes", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + stripeKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(form).toString(),
      // ⛔ TVRDÝ TIMEOUT (revize R1, nález V2). Bez něj visící Stripe sežere celý
      //    rozpočet běhu cronu, ten HTTP utne po 120 s, `catch` se neprovede
      //    a razítko zůstane v `rezervovano` navždy.
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    // ⛔ Neopakuje se: kód mohl vzniknout. Příští běh ho najde GETem výš.
    return { ok: false, chyba: "sit:" + String(e).slice(0, 160) };
  }
  const telo = await res.text().catch(() => "");
  if (res.ok) {
    let id = "";
    try { id = String((JSON.parse(telo) as { id?: unknown }).id ?? ""); } catch { /* id je bonus */ }
    return { ok: true, kod, id };
  }
  if (res.status === 400 && telo.includes("already exists")) {
    // Kód s tímhle textem existuje, ale GET ho neviděl (síť, nebo ho vidí jinak).
    // ⛔ NEBERE SE ROVNOU JAKO ÚSPĚCH (revize R3, nález S6): může být archivovaný,
    //    a to by znamenalo mail se slevou, kterou pokladna neuzná. Jeden dotaz
    //    navíc rozhodne.
    const znovu = await najdiPromoKod(stripeKey, kod, timeoutMs);
    if (znovu && znovu.active) return { ok: true, kod, id: znovu.id };
    // ⛔⛔ PRÁZDNÝ DRUHÝ GET JE TAKY „NEAKTIVNÍ" (revize R5, nález S4). GET má
    //    filtr `active=true`, takže archivovaný kód v něm NIKDY nebude: prázdný
    //    seznam po `already exists` znamená přesně „text je obsazený kódem, který
    //    není aktivní". Do R5 se z toho stala obecná chyba, na kterou jádro nový
    //    text NELOSUJE, a nový člověk se kvůli tomu zasekl na `opakovat` navždy.
    // ⚠️ Jen `undefined` (GET se nepodařil) zůstává obecnou chybou: tam nevíme nic.
    if (znovu === undefined) return { ok: false, chyba: "stripe_kod_existuje_ale_neprecten" };
    return { ok: false, chyba: CHYBA_KOD_NEAKTIVNI };
  }
  return { ok: false, chyba: "stripe_" + res.status + ":" + telo.slice(0, 160) };
}

// -----------------------------------------------------------------------------
// 4) ZAVŘENÍ PŘÍSTUPU (jediná kopie, kterou volá admin i cron)
// -----------------------------------------------------------------------------

export type UkonceniStav = "neni_klient" | "uz_ukoncen" | "appka_selhala" | "narok_selhal" | "ok";

export type UkonceniVysledek = {
  stav: UkonceniStav;
  /** Měl v okamžiku zavírání zaplacenou Academy? Rozhoduje o appce i o textu mailu. */
  maAcademy: boolean;
  /** Co odpověděl most do appky (`revoked`, `expiry_set`, `http-500`, …). */
  tvujcoach: string;
  detail?: string;
};

/**
 * Má člověk zaplacenou Academy? Rozhoduje o appce (revoke vs set-expiry) I o textu
 * mailu, takže je to JEDNA funkce a ne dvě podobné podmínky na dvou místech.
 *
 * ⛔ FAIL-CLOSED: když se `entitlements` nepodaří přečíst, vrací se `true`, tedy
 *    „chovej se, jako by ji měl". Vzít appku člověku, který si Academy koupil za
 *    8 900 Kč, je horší než nechat rok navíc tomu, kdo ji nemá.
 * ⛔ Čte se i `expires_at`: refund Academy nastavuje JEN `expires_at` a `active`
 *    nechá `true` (adversární revize 1. 9. 2026, nález 1). Bez téhle podmínky by
 *    člověk s refundovanou Academy dostal offboardem rok appky zdarma.
 */
export async function maZaplacenouAcademy(admin: Admin, email: string, tedMs: number = Date.now()): Promise<boolean> {
  const { data, error } = await admin.from("entitlements").select("active, expires_at")
    .eq("email", String(email ?? "").trim().toLowerCase()).eq("product", "academy").limit(1).maybeSingle();
  if (error) return true;
  return !!data?.active && (!data.expires_at || Date.parse(String(data.expires_at)) > tedMs);
}

/** Volání mostu `academy-grant` v appce. Vlastní funkce, ať je vidět jediný fetch ven. */
async function zavolejAppku(
  grantSecret: string,
  payload: Record<string, unknown>,
  timeoutMs = VYCHOZI_TIMEOUT_APPKA_MS,
): Promise<{ ok: boolean; result: string }> {
  if (!grantSecret) return { ok: false, result: "no-secret" };
  let r: Response;
  try {
    r = await fetch("https://kfkmghvhqwqtsalqjmrp.functions.supabase.co/academy-grant", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-academy-secret": grantSecret },
      body: JSON.stringify(payload),
      // ⛔ TVRDÝ TIMEOUT (revize R1, nález V2). Neodpovídající most do appky dřív
      //    dokázal viset až do zabití celé funkce. Vypršení se čte jako
      //    „appka neodpověděla", tedy nárok se NEMĚNÍ a jde alert.
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    return { ok: false, result: "fetch-fail:" + String(e).slice(0, 80) };
  }
  if (!r.ok) return { ok: false, result: "http-" + r.status };
  // deno-lint-ignore no-explicit-any
  const jj: any = await r.json().catch(() => ({}));
  return { ok: true, result: String(jj.result || "ok") };
}

/**
 * Zavře koučink jednomu člověku: appka, nárok, značka v CRM. MAIL NEPOSÍLÁ.
 *
 * ⛔⛔ POŘADÍ JE ZÁVAZNÉ: NEJDŘÍV APPKA, PAK NÁROK. Do 22. 9. 2026 to bylo obráceně
 *    a volání do appky viselo v `try { } catch { }`, takže když `academy-grant`
 *    neodpověděl, koučink byl vypnutý, appka klientovi zůstala a NIKDE to nekřiklo
 *    (nález revize 22. 9. 2026). Teď se při selhání appky nárok nevypne vůbec:
 *    stav zůstane přesně takový, jaký byl, a volající to zkusí znovu nebo alertuje.
 *    Rozdíl proti dřívějšku: dřív to skončilo „zavřeno napůl a ticho", teď
 *    „nezavřeno a hlasitě".
 * ⛔ FAIL-CLOSED U ACADEMY: když se `entitlements` pro Academy nepodaří přečíst,
 *    chováme se, jako by ji měl (set-expiry místo revoke). Vzít appku člověku,
 *    který si Academy koupil za 8 900 Kč, je horší než nechat rok navíc tomu,
 *    kdo ji nemá. (Převzato z `client_offboard`, beze změny.)
 * ⛔ Čte se i `expires_at` Academy: refund nastavuje JEN `expires_at` a `active`
 *    nechá `true`. Bez té podmínky by člověk s refundovanou Academy dostal rok
 *    appky zdarma.
 */
export async function ukonciPristup(
  admin: Admin,
  opts: { email: string; grantSecret: string; tedMs?: number; timeoutMs?: number },
): Promise<UkonceniVysledek> {
  const email = String(opts.email ?? "").trim().toLowerCase();
  const ted = opts.tedMs ?? Date.now();

  // ⛔ Tři stavy zvlášť (CLAUDE.md 13): chyba čtení NENÍ „není klient".
  const { data: ent, error: entErr } = await admin.from("entitlements").select("active")
    .eq("email", email).eq("product", "coaching").limit(1).maybeSingle();
  if (entErr) {
    return {
      stav: "narok_selhal",
      maAcademy: false,
      tvujcoach: "nespusteno",
      detail: String((entErr as { message?: unknown }).message ?? entErr).slice(0, 160),
    };
  }
  if (!ent) return { stav: "neni_klient", maAcademy: false, tvujcoach: "nespusteno" };
  if (ent.active !== true) return { stav: "uz_ukoncen", maAcademy: false, tvujcoach: "nespusteno" };

  const maAcademy = await maZaplacenouAcademy(admin, email, ted);

  // ⭐ Kdo má zaplacenou Academy, appku neztrácí: přepne se na roční Academy grant
  //    (rok od konce koučinku) přes `set-expiry`. Pojistka v `grant_app_access`
  //    degradaci neomezeného grantu schválně blokuje, proto vlastní SQL funkce.
  const payload = maAcademy
    ? { email, action: "set-expiry", expires_at: new Date(ted + 365 * 864e5).toISOString(), source: "academy" }
    : { email, action: "revoke", source: "koucink-konec" };
  const app = await zavolejAppku(opts.grantSecret, payload, opts.timeoutMs);
  try {
    await admin.from("tvujcoach_grants").insert({
      email, action: maAcademy ? "set-expiry" : "revoke", result: app.result, source: "koucink-konec",
    });
  } catch { /* log je bonus, odpověď mostu se vrací volajícímu tak jako tak */ }
  if (!app.ok) {
    return { stav: "appka_selhala", maAcademy, tvujcoach: app.result, detail: "narok zustava AKTIVNI, nic se nezmenilo" };
  }

  const { error: updErr } = await admin.from("entitlements").update({ active: false })
    .eq("email", email).eq("product", "coaching");
  if (updErr) {
    return {
      stav: "narok_selhal",
      maAcademy,
      tvujcoach: app.result,
      detail: String((updErr as { message?: unknown }).message ?? updErr).slice(0, 160),
    };
  }

  // Značka v marketingových kontaktech: coaching-active -> coaching-ex.
  // Kontakt se NEMAŽE a nic jiného se nemění, jen se vymění jeden tag za druhý.
  try {
    const { data: cc } = await admin.from("customer_contacts").select("tags").eq("email", email).maybeSingle();
    if (cc) {
      const tags = Array.isArray(cc.tags) ? (cc.tags as string[]) : [];
      const nove = tags.filter((t) => t !== "coaching-active");
      if (!nove.includes("coaching-ex")) nove.push("coaching-ex");
      await admin.from("customer_contacts").update({ tags: nove }).eq("email", email);
    }
  } catch { /* značka je bonus, odchod z koučinku to neshodí */ }

  return { stav: "ok", maAcademy, tvujcoach: app.result };
}

// -----------------------------------------------------------------------------
// 5) ODESLÁNÍ ROZLOUČENÍ S RAZÍTKEM (jediná kopie, kterou volá cron i admin)
// -----------------------------------------------------------------------------

/**
 * Stav MAILU: co se stalo s rozloučením. Jediný zdroj pravdy o odeslání.
 * Popis a důvody jsou v `koucink-konec-2026-09-22.sql`.
 *
 * ⛔ `odmitnuto` a `nejiste` se NESMÍ slít. `odmitnuto` znamená, že Resend
 *    zásilku výslovně odmítl (4xx, chybějící klíč), takže se smí poslat znovu.
 *    `nejiste` znamená, že mail MOHL odejít, a tam automat nesahá.
 * ⛔ `posilam` je razítko PŘED voláním Resendu. Když se nepovede zápis VÝSLEDKU,
 *    řádek v něm zůstane a po 30 minutách se čte jako `nejiste`. Druhý mail
 *    z toho nevznikne nikdy, a to je celý smysl toho stavu.
 */
export type MailStav = "neposlano" | "posilam" | "odmitnuto" | "nejiste" | "odeslano";

/** Text ze sloupce na stav mailu. Neznámé i prázdné se čte jako `neposlano`. */
export function mailStavZRadku(raw: unknown): MailStav {
  const v = String(raw ?? "").trim();
  return (["neposlano", "posilam", "odmitnuto", "nejiste", "odeslano"] as string[]).includes(v)
    ? (v as MailStav)
    : "neposlano";
}

/**
 * Mohlo tělo mailu dojít na Resend? `true` = NEJISTOTA, opakovat se nesmí.
 * ⛔ 5xx i pád sítě (`sit:…`) znamenají, že Resend zásilku MOHL přijmout.
 *    Jen výslovné odmítnutí (4xx) a chybějící klíč jsou jisté neodeslání.
 */
export function jeNejisteOdeslani(r: { status: number; chyba?: string }): boolean {
  return r.status >= 500 || String(r.chyba ?? "").startsWith("sit:");
}

export type VysledekRozlouceni =
  /** Zápis `posilam` selhal, Resend se NEVOLAL. Nic neodešlo. */
  | "posilam_neulozeno"
  /** Odešlo a máme `provider_id`. */
  | "odeslano"
  /** Resend vrátil 200 bez id: nejspíš odešlo, ale nejde to doložit. */
  | "bez_id"
  /** 5xx nebo síť: mohlo odejít. */
  | "nejiste"
  /** 4xx nebo chybějící klíč: jistě neodešlo, smí se znovu. */
  | "odmitnuto";

/**
 * Pošle rozloučení a ZAPÍŠE, co se stalo, v jediném pořadí pro obě cesty.
 *
 * ⛔⛔ PROČ JE TO JEDNA FUNKCE (revize R5, nález V2). Cron zapisoval `posilam`
 *    PŘED Resendem a výsledek četl; ruční odchod z admina ne. Po přijatém mailu
 *    a selhaném zápisu tak v řádku zůstal starý stav (`odmitnuto`, `neposlano`)
 *    a cron o půl hodiny později poslal rozloučení ZNOVU. Dvě kopie téhož pořadí
 *    se rozejdou vždycky; tahle jedna se rozejít nemůže.
 *
 * Pořadí:
 *   1. zapsat `posilam`   ⛔ selže => Resend se NEVOLÁ
 *   2. zavolat Resend
 *   3. zapsat výsledek    ⛔ návrat se čte VŽDY, i u 4xx a u chybějícího klíče
 *
 * Když selže krok 3, řádek zůstane v `posilam` a po ochranné lhůtě se přečte
 * jako `nejiste`. Druhý mail z toho nevznikne. Volající se to dozví z
 * `vysledekUlozen: false` a řekne to člověku (alert, `varovani`).
 *
 * ⚠️ Alerty a texty pro člověka tu NEJSOU: cron píše Martinovi mail, admin vrací
 *    `varovani` v odpovědi. Funkce jen dělá a hlásí, co se stalo.
 */
export async function odesliSRazitkem(opts: {
  /** Zapíše pole razítka. `false` = zápis se nepovedl. */
  zapis: (pole: Record<string, unknown>) => Promise<boolean>;
  /** Pošle mail. Nesmí házet výjimku kvůli síti (`odesliPresResend` nehází). */
  posli: () => Promise<{ ok: boolean; status: number; chyba?: string; providerId?: string }>;
  tedIso: () => string;
  /** Pole navíc do každého zápisu (`ma_academy`, `promo_code`…). */
  spolecne?: Record<string, unknown>;
  /** Důvod, pod kterým se zapisuje (`odeslano`, `rucne_z_adminu`…). */
  duvod: string;
}): Promise<{
  vysledek: VysledekRozlouceni;
  status: number;
  chyba?: string;
  providerId: string;
  /** Uložil se zápis VÝSLEDKU? `false` = řádek zůstal v `posilam`. */
  vysledekUlozen: boolean;
}> {
  const spol = opts.spolecne ?? {};
  const zacatek = await opts.zapis({
    ...spol,
    mail_stav: "posilam",
    sent_ok: false,
    // ⚠️ Id z minulého pokusu (nebo z minulého konce) se maže HNED: jinak by po
    //    nejistém výsledku v řádku zůstalo cizí id a vypadalo by jako doklad.
    provider_id: null,
    updated_at: opts.tedIso(),
  });
  if (!zacatek) {
    return { vysledek: "posilam_neulozeno", status: 0, providerId: "", vysledekUlozen: false };
  }

  const r = await opts.posli();
  const providerId = String(r.providerId ?? "").trim();

  let vysledek: VysledekRozlouceni;
  let pole: Record<string, unknown>;
  if (r.ok && providerId) {
    vysledek = "odeslano";
    pole = { stav: "hotovo", mail_stav: "odeslano", sent_ok: true, provider_id: providerId, duvod: opts.duvod };
  } else if (r.ok) {
    // ⛔ 200 bez id: odeslání nejde doložit ani spárovat s bouncem (N6 z R5).
    vysledek = "bez_id";
    pole = { stav: "hotovo", mail_stav: "nejiste", sent_ok: false, duvod: opts.duvod + ":resend_200_bez_id" };
  } else if (jeNejisteOdeslani(r)) {
    vysledek = "nejiste";
    pole = { stav: "hotovo", mail_stav: "nejiste", sent_ok: false, duvod: opts.duvod + ":resend:" + (r.chyba ?? r.status) };
  } else {
    vysledek = "odmitnuto";
    pole = { stav: "opakovat", mail_stav: "odmitnuto", sent_ok: false, duvod: opts.duvod + ":resend:" + (r.chyba ?? r.status) };
  }
  const vysledekUlozen = await opts.zapis({ ...spol, ...pole, sent_at: opts.tedIso(), updated_at: opts.tedIso() });
  return { vysledek, status: r.status, chyba: r.chyba, providerId, vysledekUlozen };
}

// -----------------------------------------------------------------------------
// 6) ROZHODNUTÍ RUČNÍHO ODCHODU Z ADMINA (čistá funkce, aby šla otestovat)
// -----------------------------------------------------------------------------

export type RucniRozhodnuti =
  /** Klient v DB vůbec není. */
  | { akce: "neni_klient" }
  /** Čerstvou rezervaci drží automat. */
  | { akce: "automat_pracuje" }
  /** Mail mohl odejít a chybí výslovné potvrzení v požadavku. */
  | { akce: "potrebuje_potvrzeni" }
  /** Není co dělat: přístup je zavřený a rozloučení buď odešlo, nebo vědomě nešlo. */
  | { akce: "uz_ukoncen" }
  /** Zavřít přístup a poslat rozloučení. `zahodMail` = starý stav mailu se zahodí. */
  | { akce: "plny_pruchod"; zahodMail: boolean }
  /** Přístup je zavřený, rozloučení chybí. Poslat POUZE mail. */
  | { akce: "jen_mail" };

/**
 * Co má tlačítko „Ukončit koučink" udělat.
 *
 * ⛔⛔ NEJDŘÍV SE PTÁ, JESTLI PŘÍSTUP BĚŽÍ (revize R5, nález V1). Do R5 stačil stav
 *    mailu `odmitnuto`, `nejiste` nebo `posilam`, aby tlačítko přeskočilo zavření
 *    přístupu a poslalo „jen mail". U člověka, který se mezitím vrátil (nebo
 *    kterému se přístup nikdy nezavřel), to znamenalo rozloučení AKTIVNÍMU
 *    klientovi a přístup, který mu dál běží. A toast přitom hlásil „koučink
 *    ukončen".
 *    ⇒ Běžící nárok = vždycky plná cesta. Starý stav mailu patří k jinému
 *      konci a zahodí se (`zahodMail`).
 *
 * Tabulka pro ZAVŘENÝ přístup:
 *   stav mailu            stav práce         akce
 *   odeslano              cokoli             uz_ukoncen
 *   neposlano             hotovo / vzdano    uz_ukoncen   (vědomě bez mailu)
 *   neposlano             opakovat / rez.    jen_mail     (zavřeno, mail chybí)
 *   odmitnuto             cokoli             jen_mail
 *   nejiste / posilam     cokoli             jen_mail + potvrzeno, jinak 409
 */
export function rozhodniRucniOdchod(v: {
  /** Existuje koučinkový nárok vůbec? */
  narokExistuje: boolean;
  narokAktivni: boolean;
  /** Stav práce z razítka; prázdno = razítko není. */
  stav: string;
  mailStav: MailStav;
  /** Je rezervace čerstvá (mladší než ochranná lhůta)? */
  rezervaceCerstva: boolean;
  tiche: boolean;
  potvrzeno: boolean;
}): RucniRozhodnuti {
  if (!v.narokExistuje) return { akce: "neni_klient" };
  if (v.stav === "rezervovano" && v.rezervaceCerstva) return { akce: "automat_pracuje" };

  if (v.narokAktivni) {
    // ⛔ Přístup běží: plná cesta. Stav mailu je z jiného konce.
    return { akce: "plny_pruchod", zahodMail: v.mailStav !== "neposlano" };
  }

  // Přístup je zavřený. Rozhoduje stav mailu.
  if (v.mailStav === "odeslano") return { akce: "uz_ukoncen" };
  if (v.mailStav === "nejiste" || v.mailStav === "posilam") {
    // ⛔ Tichý odchod mail neposílá, takže potvrzení nepotřebuje; ale taky nic
    //    nedoposílá a stav mailu nechá, jak je (`uz_ukoncen`).
    if (v.tiche) return { akce: "uz_ukoncen" };
    return v.potvrzeno ? { akce: "jen_mail" } : { akce: "potrebuje_potvrzeni" };
  }
  if (v.mailStav === "odmitnuto") return v.tiche ? { akce: "uz_ukoncen" } : { akce: "jen_mail" };
  // `neposlano`: rozhoduje, jestli je práce uzavřená.
  if (v.stav === "hotovo" || v.stav === "vzdano" || v.stav === "") return { akce: "uz_ukoncen" };
  // `opakovat` nebo opuštěné `rezervovano`: přístup zavřený, mail nikdy neodešel.
  return v.tiche ? { akce: "uz_ukoncen" } : { akce: "jen_mail" };
}
