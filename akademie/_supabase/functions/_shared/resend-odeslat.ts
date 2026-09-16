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
  // ⛔ [R1, S-2] Martinova adresa do `email_events` nepatri, viz komentar u seznamu vys.
  //    Vraci se `false` (nic se nezapsalo), ne chyba: je to spravne chovani, ne selhani.
  if (jeMartinovaAdresa(email)) return false;
  if (!providerId) {
    console.error(
      `[resend-odeslat] ${stopa.via}: Resend nevratil id, bounce se u ${email} NESPARUJE`,
    );
  }
  if (!stopa.admin || typeof stopa.admin.from !== "function") return false;
  const { error } = await stopa.admin.from("email_events").insert({
    lead_id: stopa.leadId ?? null,
    step: stopa.step ?? 0,
    type: stopa.typ ?? "odeslano",
    provider_id: providerId || null,
    detail: { via: stopa.via, email, ...(stopa.detail ?? {}) },
  });
  if (error) {
    console.error(`[resend-odeslat] ${stopa.via}: zapis stopy selhal: ` + error.message);
    return false;
  }
  return true;
}

/**
 * Zapíše NEODESLÁNÍ do `email_events` jako `type='error'` (R1, nález N-5).
 *
 * ⛔ `detail.track` MUSÍ být neprázdné a nesmí začínat na `onboarding`, jinak
 *    `followups_circuit_breaker` řádek úplně ignoruje
 *    (`coalesce(detail->>'track','') <> '' and not ilike 'onboarding%'`).
 *    Bere se proto `via`, tedy jméno odesílající funkce. Kdo předá vlastní `track`
 *    (opakované doručení předává `onboarding-nakup-…`), ten jistič schválně míjí:
 *    doručení zaplaceného zboží nemá zavírat marketingovou bránu.
 * ⚠️ NÁSLEDEK, KTERÝ MUSÍ BÝT VIDĚT: deset neodeslaných mailů z těchto cest za den
 *    (práh `v_thr_err`) zavře bránu follow-upů, tři chyby `resend_429:` taky,
 *    jediná `quota_exceeded` okamžitě. To je záměr, ne vedlejší účinek.
 * ⚠️ Martinova adresa se ani sem nepíše (S-2), ale řádek vzniká: kdyby selhávaly
 *    jen alerty, je to pořád porucha, kterou chceme vidět.
 */
async function zapisChybu(stopa: StopaOdeslani | undefined, status: number, chyba: string): Promise<void> {
  if (!stopa?.admin || typeof stopa.admin.from !== "function") return;
  const email = String(stopa.email ?? "").trim().toLowerCase();
  const jeMartin = jeMartinovaAdresa(email);
  const { error } = await stopa.admin.from("email_events").insert({
    lead_id: stopa.leadId ?? null,
    step: stopa.step ?? 0,
    type: "error",
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
  if (stopa) await zapisOdeslani(stopa, providerId);
  return { ok: true, status: res.status, providerId };
}
