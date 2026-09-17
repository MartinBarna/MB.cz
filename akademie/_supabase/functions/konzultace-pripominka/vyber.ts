// ============================================================================
// ČISTÁ LOGIKA VÝBĚRU: komu a kterou připomínku konzultace poslat (17. 9. 2026)
// ============================================================================
// Oddělené od `index.ts` schválně: tohle je jediné místo, kde se rozhoduje,
// a dá se otestovat bez sítě, bez Deno permissions a bez DB (`vyber.test.ts`).

import { jeMartinovaAdresa } from "../_shared/resend-odeslat.ts";

export type Radek = {
  email: string;
  termin_at: string | null;
  /**
   * ⛔⛔ RAZÍTKO NENÍ ČAS ODESLÁNÍ, JE TO TERMÍN, KE KTERÉMU SE POSLALO.
   * Kdyby se ukládal čas odeslání (`pripominka_sent_at`), PŘESUNUTÝ termín by se
   * připomenout nemohl: razítko by tam pořád bylo a člověk by o novém čase nevěděl.
   * Martin termíny v adminu přepisuje běžně (jeden řádek na e-mail, `konzultace_termin`),
   * takže by to nebyl okrajový případ, ale tichá vada u zaplacené konzultace.
   * ⇒ Razítko drží hodnotu `termin_at`, pro kterou mail odešel. Jiný termín = jiná
   *   hodnota = připomínka se pošle znovu. Kdy to odešlo, je v `email_events`
   *   (stopa z `resend-odeslat.ts`), takže se ta informace nikde neztrácí.
   */
  pripominka_den_pred_pro: string | null;
  pripominka_rano_pro: string | null;
};

export type Druh = "den_pred" | "rano";

/** Datum v pražském pásmu jako `YYYY-MM-DD`. Edge běží v UTC, večerní termín by jinak ujel o den. */
export function prazskeDatum(ms: number): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(new Date(ms));
}

/**
 * Následující kalendářní den.
 * ⚠️ SCHVÁLNĚ NE `now + 86 400 000`: v noci na přechod na letní/zimní čas má den
 * 23 nebo 25 hodin, takže by se u ranního běhu mohl posun o „24 hodin" trefit do
 * téhož nebo přeskočit dál. Přičítá se DEN, ne 24 hodin.
 */
export function denPo(datum: string): string {
  const d = new Date(datum + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Vrátí, kterou připomínku poslat, nebo null.
 *
 * Pravidla (cron běží jednou denně ráno):
 *  - hovor už proběhl nebo právě probíhá  → nic (připomínat zpětně je horší než mlčet),
 *  - hovor je DNES                        → „rano",
 *  - hovor je ZÍTRA                       → „den_pred",
 *  - cokoli dál                           → nic.
 * ⚠️ Když Martin zadá termín až v den hovoru, „den_pred" se přeskočí a pošle se jen
 *    ranní. To je správně: mail o „zítřku", který je dnes, by lhal.
 */
export function coPoslat(r: Radek, nowMs: number): Druh | null {
  if (!r.termin_at) return null;
  const t = Date.parse(r.termin_at);
  if (!Number.isFinite(t)) return null;
  if (t <= nowMs) return null;

  // Razítko platí jen pro TENTÝŽ termín. Porovnává se čas, ne řetězec: PostgREST
  // může tentýž okamžik vrátit v jiném zápisu (`+00:00` vs `Z`) a řetězcová shoda
  // by pak tiše selhala a poslala připomínku podruhé.
  const razitkoSedi = (v: string | null) => v != null && Date.parse(v) === t;

  const denT = prazskeDatum(t);
  const dnes = prazskeDatum(nowMs);
  if (denT === dnes) return razitkoSedi(r.pripominka_rano_pro) ? null : "rano";
  if (denT === denPo(dnes)) return razitkoSedi(r.pripominka_den_pred_pro) ? null : "den_pred";
  return null;
}

/** Sloupec, do kterého se po odeslání zapíše razítko. */
export function sloupecRazitka(druh: Druh): "pripominka_den_pred_pro" | "pripominka_rano_pro" {
  return druh === "den_pred" ? "pripominka_den_pred_pro" : "pripominka_rano_pro";
}

/**
 * Adresy, na které klientská připomínka NESMÍ odejít, i kdyby v `consultation_calls` byly.
 *
 * ⛔ [17. 9. 2026, nález R1/N3] V první verzi tohle nebylo a tvrzení „Martinovi to nechodí"
 *    platilo jen NÁHODOU: v tabulce je dneska jediný řádek s cizí adresou. Jakmile si
 *    Martin založí testovací termín na svoji adresu (a přesně tak se tahle funkce bude
 *    zkoušet), dostane mail psaný pro klienta.
 * ⭐ Martinovy adresy se poznávají JEDINÝM společným seznamem `jeMartinovaAdresa`
 *    ze `_shared/resend-odeslat.ts` (pokrývá `martin@martinbarna.cz` i všechny
 *    `fitness.barna+znacka@…`). ⛔ Nekopírovat ho sem: druhá kopie se rozejde.
 * ⚠️ Vyhrazené domény z RFC 2606 (`example.com/net/org`, TLD `.test`, `.example`,
 *    `.invalid`, `.localhost`): za nimi NIKDY nestojí skutečný zákazník a doručit se
 *    tam stejně nedá. ⭐ Seznam doplnila revize R2: předtím tu byly jen `example.com`
 *    a `example.org`, takže testovací adresa v `example.net` by prošla.
 * ⚠️ Rodinné adresy z `newsletter_prijemci` (trvalý free, nemailovat) tu SCHVÁLNĚ nejsou:
 *    tohle je provozní mail o zaplacené konzultaci, ne marketing. Kdyby si konzultaci
 *    koupil někdo z rodiny, termín se mu připomenout MÁ.
 *
 * Vrací důvod (jde do souhrnu Martinovi), nebo null.
 */
export function neposilatKlientovi(email: string): string | null {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e) return "prazdna_adresa";
  if (jeMartinovaAdresa(e)) return "martinova_adresa";
  if (/@(?:[^@]*\.)?example\.(?:com|net|org)$/.test(e)) return "testovaci_domena";
  if (/\.(?:test|example|invalid|localhost)$/.test(e)) return "testovaci_domena";
  return null;
}
