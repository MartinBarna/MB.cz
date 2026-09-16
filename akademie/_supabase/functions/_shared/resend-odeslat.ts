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
// ⛔⛔ TYP UDÁLOSTI JE `px_odeslano`, NE `sent`. A NENÍ TO DETAIL:
//    `sent` čte `email_summary`, `daily-digest` i DENNÍ STROP v `drip-send`
//    (`select count(*) ... where type='sent' and created_at >= dnes`, pak
//    `remaining = DAILY_CAP - sentToday`). Kdyby tyhle funkce psaly `sent`,
//    ukusovaly by dennímu dripu z jeho stropu a nikde by to nekřiklo: rozesílka
//    by prostě jednoho dne poslala míň. Stejný důvod, proč `milestones`
//    a `order-rescue` píšou `px_odeslano` už teď (mají to u sebe v komentáři).
//    ⇒ Párování se místo toho rozšířilo na straně `resend-webhook`, který si
//    `px_odeslano` bere do seznamu typů, ve kterých hledá původní odeslání.
//
// ⚠️ CHYBA ZÁPISU SE JEN LOGUJE, nikdy nehází výjimku: mail už odešel a shodit
//    kvůli evidenci běh cronu uprostřed dávky by bylo horší než chybějící řádek.
//    Ale loguje se HLASITĚ (`console.error`), protože tichý `catch {}` u zápisu
//    skipů je přesně důvod, proč se o bráně za celou dobu nedalo nic zjistit.

// deno-lint-ignore no-explicit-any
type Admin = any;

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
  /** Výchozí `px_odeslano`, viz komentář v hlavičce. Měnit jen s dobrým důvodem. */
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
  if (!providerId) {
    console.error(
      `[resend-odeslat] ${stopa.via}: Resend nevratil id, bounce se u ${email} NESPARUJE`,
    );
  }
  if (!stopa.admin || typeof stopa.admin.from !== "function") return false;
  const { error } = await stopa.admin.from("email_events").insert({
    lead_id: stopa.leadId ?? null,
    step: stopa.step ?? 0,
    type: stopa.typ ?? "px_odeslano",
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
    return { ok: false, status: 0, providerId: "", chyba: String(e).slice(0, 200) };
  }
  if (!res.ok) {
    const telo = await res.text().catch(() => "");
    return { ok: false, status: res.status, providerId: "", chyba: telo.slice(0, 200) };
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
