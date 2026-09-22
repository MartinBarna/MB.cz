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
  /** Po konci, ale ještě v ochranné lhůtě. */
  vGraci: number;
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
  let bezData = 0, vGraci = 0, vOptout = 0;
  for (const r of radky) {
    if (!r || r.active !== true) continue;
    const email = String(r.email ?? "").trim().toLowerCase();
    if (!email) continue;
    if (!r.expires_at) { bezData++; continue; }
    const konec = Date.parse(String(r.expires_at));
    if (!Number.isFinite(konec)) { bezData++; continue; }
    if (konec > mez) { vGraci++; continue; }
    if (optout.has(email)) { vOptout++; continue; }
    if (orazitkovane.has(email)) continue;
    kUkonceni.push({ ...r, email });
  }
  return { kUkonceni, bezData, vGraci, vOptout };
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

export type PromoVysledek =
  | { ok: true; kod: string; id: string }
  | { ok: false; chyba: string };

/**
 * Založí ve Stripu jednorázový promo kód pro jednoho bývalého klienta.
 *
 * ⛔⛔ SELHÁNÍ SE NEPOLYKÁ A MAIL BEZ KÓDU NEJDE. Mail slibuje slevu; kdyby odešel
 *    s kódem, který ve Stripu není, člověk ho zadá v pokladně, uvidí „neplatný
 *    kód" a nekoupí nic. Volající proto při `ok: false` neodesílá a alertuje.
 * ⚠️ Kolize kódu (`code` už existuje) vrací Stripe jako 400 se slovy „already
 *    exists". Jeden pokus navíc s novým kódem je levný; cokoli jiného (špatný
 *    kupón, chybějící právo na zápis) se opakováním nespraví.
 * ⚠️ Pád sítě se NEOPAKUJE: kód mohl ve Stripu vzniknout a druhý pokus by založil
 *    druhý. Vrací se chyba a rozhodne další běh.
 */
export async function vytvorPromoKod(
  stripeKey: string,
  opts: { couponId: string; email: string; tedMs?: number; pokusy?: number },
): Promise<PromoVysledek> {
  if (!stripeKey) return { ok: false, chyba: "chybi_stripe_klic" };
  if (!opts.couponId) return { ok: false, chyba: "chybi_coupon_id" };
  const pokusy = Math.max(1, opts.pokusy ?? 2);
  let posledni = "";
  for (let i = 0; i < pokusy; i++) {
    const kod = vygenerujPromoKod();
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
      });
    } catch (e) {
      return { ok: false, chyba: "sit:" + String(e).slice(0, 160) };
    }
    const telo = await res.text().catch(() => "");
    if (res.ok) {
      let id = "";
      try { id = String((JSON.parse(telo) as { id?: unknown }).id ?? ""); } catch { /* id je bonus */ }
      return { ok: true, kod, id };
    }
    posledni = "stripe_" + res.status + ":" + telo.slice(0, 160);
    if (!(res.status === 400 && telo.includes("already exists"))) break;
  }
  return { ok: false, chyba: posledni || "stripe_neznama_chyba" };
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
): Promise<{ ok: boolean; result: string }> {
  if (!grantSecret) return { ok: false, result: "no-secret" };
  let r: Response;
  try {
    r = await fetch("https://kfkmghvhqwqtsalqjmrp.functions.supabase.co/academy-grant", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-academy-secret": grantSecret },
      body: JSON.stringify(payload),
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
  opts: { email: string; grantSecret: string; tedMs?: number },
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
  const app = await zavolejAppku(opts.grantSecret, payload);
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
