// ============================================================================
// JEDNO MÍSTO, KTERÉ ODEŠLE MAIL PŘES RESEND A NECHÁ ZA SEBOU STOPU (16. 9. 2026)
// ============================================================================
// PROČ TOHLE EXISTUJE (nález V1 auditu mailových toků):
// `resend-webhook` páruje bounce a stížnost na spam VÝHRADNĚ přes `provider_id`
// původního odeslání. Jenže `provider_id` zapisovaly jen čtyři funkce z pětadvaceti
// odesílacích cest. Zbytek odpověď Resendu vůbec nečetl: `const r = await fetch(...)`
// a `if (r.status === 200) sent++`, ID do koše.
//
// Následky, všechny tiché:
//   1. Hard bounce na takové adrese NIKDY nenastavil `leads.status='bounced'`, takže
//      `mailing-guard.isHardBounce` (čte právě `leads.status`) tu adresu neodstřihl.
//      Ta adresa dostávala všechno dál a kazila reputaci odesílatele.
//   2. Stížnost na spam se nedostala na `odhlaseni_trvale`.
//   3. Nešlo odpovědět na otázku „odešlo 19 připomínek klientům, dorazily?",
//      protože k nim nikdy nepřišlo `delivered`.
// Změřeno 16. 9. 2026: ze 22 událostí `bounce` se 7 nespárovalo vůbec.
//
// ⛔⛔ VÝCHOZÍ TYP UDÁLOSTI JE `odeslano`. ANI `sent`, ANI `px_odeslano`:
//  1. `sent` čte `email_summary`, `daily-digest` i DENNÍ STROP v `drip-send`
//     (`select count(*) ... where type='sent' and created_at >= dnes`, pak
//     `remaining = DAILY_CAP - sentToday`). Kdyby tyhle funkce psaly `sent`,
//     ukusovaly by dennímu dripu z jeho stropu a nikde by to nekřiklo: rozesílka
//     by prostě jednoho dne poslala míň.
//  2. `px_odeslano` znamená „mail S MĚŘICÍM PIXELEM". `admin-api` (akce
//     `mail_mereni`, `.in("type", [... "px_odeslano" ...])`) ho počítá do
//     JMENOVATELE otevřenosti. Maily bez pixelu by ten jmenovatel nafoukly
//     a otevřenost v adminu by klesla, aniž by se cokoli zhoršilo.
//     ⇒ `px_odeslano` předává VÝSLOVNĚ jen volající, jehož mail pixel opravdu má
//     (tedy ten, který prošel `ostopkuj`): dnes `milestones` a `order-rescue`,
//     a ty si svůj řádek píšou samy.
//  3. Párování se místo toho rozšířilo na straně `resend-webhook`, který má
//     `odeslano` v seznamu typů, ve kterých hledá původní odeslání.
//     ⛔ KDO SEM PŘIDÁ DALŠÍ TYP, MUSÍ HO PŘIDAT I TAM. Hlídá to kontrola T1
//     v `resend-odeslat.test.ts`, která typy VYČTE ZE ZDROJÁKŮ, ne porovná řetězec.
//
// ⚠️ CHYBA ZÁPISU SE JEN LOGUJE, nikdy nehází výjimku: mail už odešel a shodit
//    kvůli evidenci běh cronu uprostřed dávky by bylo horší než chybějící řádek.
//    Ale loguje se HLASITĚ (`console.error`), protože tichý `catch {}` u zápisu
//    skipů je přesně důvod, proč se o bráně za celou dobu nedalo nic zjistit.

// deno-lint-ignore no-explicit-any
type Admin = any;

/**
 * ⛔⛔ MARTINOVY ADRESY SE DO `email_events` NEZAPISUJI (R1, nalez S-2).
 *
 * PROC: `resend-webhook` nove dohledava leada podle `detail.email`. Kdyz by se stopa
 * napsala pro Martinovu adresu (alert z `poukaz-vydat` pri zavrene brane, kopie reportu
 * na `martin@martinbarna.cz`, testovaci beh `client-remind` na `fitness.barna+…`),
 * stacil by jeden bounce nebo jedno kliknuti na "spam" a zmrazil by se MARTINUV VLASTNI
 * lead. `fitness.barna@gmail.com` v `leads` JE a ma `status='active'` (zmereno 16. 9.),
 * u `complaint` by navic slo o trvaly seznam, ze ktereho ho vrati jen rucni zasah.
 *
 * ⚠️ Seznam je tady jako konstanta, protoze zadny spolecny seznam Martinovych adres
 *    v `_shared` neexistuje (`mailing-guard.ts` resi tridy mailu, ne adresy) a jedina
 *    jeho obdoba zije v SQL uvnitr `newsletter_prijemci`. Az takovy seznam vznikne,
 *    tohle se na nej navaze.
 * ⚠️ `fitness.barna` se testuje PREFIXEM, aby sedely i vsechny `+znacka` varianty,
 *    stejne jako `lower(l.email) not like 'fitness.barna%'` v SQL.
 */
const MARTINOVY_ADRESY_PREFIX = ["fitness.barna"];
const MARTINOVY_ADRESY_PRESNE = ["martin@martinbarna.cz"];

/** TRUE = adresa patri Martinovi a stopa se pro ni nepise. */
export function jeMartinovaAdresa(email: string): boolean {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e) return false;
  if (MARTINOVY_ADRESY_PRESNE.includes(e)) return true;
  return MARTINOVY_ADRESY_PREFIX.some((p) => e.startsWith(p));
}

export type ResendOdpoved = {
  /** true = Resend zásilku přijal */
  ok: boolean;
  /** HTTP status Resendu, 0 = fetch vůbec neproběhl (síť, DNS, timeout) */
  status: number;
  /** ID zásilky u Resendu. Prázdné = nešlo přečíst, bounce se nespáruje. */
  providerId: string;
  chyba?: string;
};

export type StopaOdeslani = {
  admin: Admin;
  /** Jméno funkce, ze které mail odešel. Jde do `detail.via`. */
  via: string;
  /** Adresa příjemce. Podle ní dohledá `resend-webhook` leada, když chybí `lead_id`. */
  email: string;
  /** Když ho volající zná. Jinak null a webhook si ho najde podle adresy. */
  leadId?: string | null;
  step?: number;
  /**
   * Výchozí `odeslano`, viz komentář v hlavičce.
   * ⛔ `px_odeslano` sem patří JEN u mailu, který doopravdy nese měřicí pixel.
   * ⛔ Každá nová hodnota musí přibýt i do `.in("type", [...])` v `resend-webhook`.
   */
  typ?: string;
  /** Doplňkové klíče do `detail` (track, key, kind...). */
  detail?: Record<string, unknown>;
};

/**
 * Zapíše stopu o odeslání do `email_events`. Vrací false, když zápis selhal.
 *
 * ⛔ ŘÁDEK VZNIKNE I BEZ `provider_id`. Ta stopa totiž neslouží jen k párování
 *    bounců: u opakovaného nákupu na ní stojí IDEMPOTENCE (dedup podle
 *    `detail->>payment_intent`). Kdyby se při nečitelné odpovědi Resendu řádek
 *    nezapsal, přehraná událost Stripu by poslala mail znovu. Chybějící ID se
 *    proto jen zakřičí do logu.
 */
export async function zapisOdeslani(stopa: StopaOdeslani, providerId: string): Promise<boolean> {
  const email = String(stopa.email ?? "").trim().toLowerCase();
  // ⛔⛔ [R2, nalez R2-1] MARTINOVA ADRESA SE VYNECHAVA, ALE RADEK VZNIKA.
  //    Prvni verze (R1) pro Martinovu adresu NEZAPSALA NIC, a to bylo spatne: tentyz
  //    radek nese u opakovaneho nakupu IDEMPOTENCI (dedup podle `detail->>payment_intent`
  //    v `academy-stripe-webhook`). Martin je pritom jediny, kdo tuhle cestu zkousi
  //    penezi, takze se pojistka ztracela presne na uctu, kde se testuje, a smoke
  //    dotaz po jeho testu nic nevratil.
  //    ⭐ Staci vynechat ADRESU: `resend-webhook` paruje vyhradne podle `detail.email`,
  //    takze bez ni se nema zmrazeni ceho chytit, a stopa i idempotence zustanou.
  //    Stejne to uz delal `zapisChybu`; helper si tim prestava odporovat.
  const jeMartin = jeMartinovaAdresa(email);
  if (!providerId) {
    console.error(
      `[resend-odeslat] ${stopa.via}: Resend nevratil id, bounce se u ${jeMartin ? "(martin)" : email} NESPARUJE`,
    );
  }
  if (!stopa.admin || typeof stopa.admin.from !== "function") return false;
  const { error } = await stopa.admin.from("email_events").insert({
    lead_id: jeMartin ? null : (stopa.leadId ?? null),
    step: stopa.step ?? 0,
    type: stopa.typ ?? "odeslano",
    provider_id: providerId || null,
    detail: {
      via: stopa.via,
      // ⛔ U Martina `null`, ne jeho adresa: podle tohohle pole se dohledava lead
      //    a `fitness.barna@gmail.com` v `leads` JE a je `active`.
      email: jeMartin ? null : email,
      komu: jeMartin ? "martin" : "zakaznik",
      ...(stopa.detail ?? {}),
    },
  });
  if (error) {
    console.error(`[resend-odeslat] ${stopa.via}: zapis stopy selhal: ` + error.message);
    return false;
  }
  return true;
}

/**
 * Zapíše NEODESLÁNÍ do `email_events` jako `type='odeslani_chyba'`.
 *
 * ⛔⛔ TYP NENÍ `error` A JE TO ROZHODNUTÍ, NE PŘEKLEP (R2, nález R2-2).
 *    Živý jistič `followups_circuit_breaker` (cron 3) čte `type='error'` a zavírá
 *    `followups_enabled` při třech chybách `resend_429:`, jedné `quota_exceeded`
 *    nebo deseti jiných chybách za den. Do téhle dávky psal `resend_429:` jedině
 *    `drip-send`, který má pacing 600 ms. Z nových zapisovatelů má pacing jen
 *    `client-remind` (550 ms); `study-reminder`, `splatky-guard` ani `client-report`
 *    ho NEMAJÍ, a `study-reminder` jede ve středu v těsné smyčce přes celý seznam
 *    studentů proti výchozímu limitu Resendu 2 požadavky za sekundu.
 *    ⇒ Jedna dávka bez pacingu by si vyrobila tři 429 a zastavila prodejní i pečující
 *    maily celé Academy. Tuhle možnost systém předtím neměl a nesmí vzniknout jako
 *    vedlejší účinek měření. Vlastní typ ji zavírá.
 *    ⚠️ CENA: jistič tyhle cesty dál NEVIDÍ, stejně jako před touhle dávkou.
 *       Nález N-5 z R1 tím zůstává vědomě NEŘEŠENÝ, viz BUILD, sekce „Po R2".
 *       Správná cesta je doplnit pacing a teprve pak typ sjednotit.
 * ⚠️ Řádek je přesto k něčemu: vidí ho `daily-digest` a `admin-pulse` jen tehdy,
 *    když se na něj někdo podívá dotazem, ale hlavně jde dohledat
 *    (`select detail->>'via', count(*) from email_events where type='odeslani_chyba' …`).
 * ⚠️ `detail.track` se plní z `via` a zůstává, aby se typ dal někdy sjednotit
 *    s `error` bez dalšího zásahu.
 * ⚠️ Martinova adresa se ani sem nepíše, ale řádek vzniká: kdyby selhávaly jen
 *    alerty, je to pořád porucha, kterou chceme vidět.
 */
async function zapisChybu(stopa: StopaOdeslani | undefined, status: number, chyba: string): Promise<void> {
  if (!stopa?.admin || typeof stopa.admin.from !== "function") return;
  const email = String(stopa.email ?? "").trim().toLowerCase();
  const jeMartin = jeMartinovaAdresa(email);
  const { error } = await stopa.admin.from("email_events").insert({
    lead_id: stopa.leadId ?? null,
    step: stopa.step ?? 0,
    type: "odeslani_chyba",
    detail: {
      via: stopa.via,
      track: String((stopa.detail ?? {}).track ?? stopa.via),
      email: jeMartin ? null : email,
      komu: jeMartin ? "martin" : "zakaznik",
      status,
      error: chyba,
    },
  });
  if (error) console.error(`[resend-odeslat] ${stopa.via}: zapis chyby selhal: ` + error.message);
}

/**
 * Pošle mail přes Resend a (když dostane `stopa`) zapíše stopu s `provider_id`.
 *
 * `payload` je tělo pro Resend přesně tak, jak si ho volající staví (from, to,
 * subject, html, reply_to, bcc, attachments, headers...). Tahle funkce do něj
 * schválně nesahá: každá cesta má svoje hlavičky a jeden „chytrý" společný
 * builder by je dřív nebo později tiše sjednotil.
 *
 * ⛔ Nikdy nehází výjimku kvůli síti: pád `fetch` shodil 13. 9. celý běh cronu
 *    `splatky-guard` uprostřed dávky. Vrací se `{ ok: false, status: 0 }`
 *    a volající se rozhodne sám.
 */
export async function odesliPresResend(
  resendKey: string,
  payload: Record<string, unknown>,
  stopa?: StopaOdeslani,
): Promise<ResendOdpoved> {
  if (!resendKey) return { ok: false, status: 0, providerId: "", chyba: "missing_RESEND_API_KEY" };
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    const chyba = "sit:" + String(e).slice(0, 180);
    await zapisChybu(stopa, 0, chyba);
    return { ok: false, status: 0, providerId: "", chyba };
  }
  if (!res.ok) {
    const telo = await res.text().catch(() => "");
    // ⛔ [R1, N-5] TVAR RETEZCE NENI KOSMETIKA. Zivy jistic `followups_circuit_breaker`
    //    (cron 3) hleda PRESNE prefix `resend_429:` a podretezec `quota_exceeded`
    //    v `detail->>'error'`. Jiny tvar znamena, ze rate limit ani vycerpana kvota
    //    z techhle cest branu follow-upu nezavrou. Stejny tvar sklada `drip-send`.
    const chyba = "resend_" + res.status + ":" + telo.slice(0, 180);
    await zapisChybu(stopa, res.status, chyba);
    return { ok: false, status: res.status, providerId: "", chyba };
  }
  // ⚠️ Tělo odpovědi jde přečíst JEN JEDNOU. Když se to nepovede, mail stejně
  //    odešel: vrací se `ok: true` s prázdným `providerId` a stopa to zakřičí.
  let providerId = "";
  try {
    const j = await res.json();
    providerId = String((j as { id?: unknown })?.id ?? "");
  } catch { /* viz komentář výš */ }
  if (stopa) {
    // ⛔⛔ [R2, nalez R2-3] ZASILKA S BCC SE MUSI POZNAT ZE STOPY.
    //    `resend-webhook` porovnava adresu ze stopy s `ev.data.to` z payloadu, jenze
    //    `to` je obrazem HLAVICKY To a skrytou kopii neobsahuje. U zasilky
    //    `to: [klient]` + `bcc: [Martin]` proto obe adresy SEDNOU a bounce Martinovy
    //    kopie zmrazi klienta uplne stejne jako pred opravou. Vetev `adresa_nesedi`
    //    se dnesnim kodem nema jak spustit.
    //    ⭐ Tohle je zatim jen SIGNAL, ne oprava: `detail.bcc` rekne, ze zasilka
    //    skrytou kopii mela, takze u prvniho realneho bouncu pujde z dat rozhodnout,
    //    jestli se odrazil prijemce, nebo kopie. Nalez S-1 tim NENI uzavreny.
    const maBcc = Array.isArray(payload.bcc)
      ? payload.bcc.length > 0
      : !!payload.bcc;
    await zapisOdeslani(
      maBcc ? { ...stopa, detail: { ...(stopa.detail ?? {}), bcc: true } } : stopa,
      providerId,
    );
  }
  return { ok: true, status: res.status, providerId };
}
