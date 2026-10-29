// Pondělní připomínky check-inu: výběr dávky, rotace a strop.
// Čistá logika, bez Deno, bez sítě, bez zápisu. Volá ji checkin-capture (mode remind).
//
// Proč: smyčka měla `MAX = 40` a brala řádky v pořadí z databáze, bez paměti,
// kdo už mail tenhle týden dostal. Opakovaný běh proto posílal pořád prvním čtyřiceti.
//
// Předpoklad kvóty (kód repa + dokumentace Resend, ne živý účet):
//   - Tarif Resend Pro. Denní limit API není (Martin 20. 7. 2026,
//     followups-circuit-breaker.sql, enroll-longtail-fifo.sql).
//   - Měsíční strop Pro je 50 000. K 20. 7. 2026 spotřeba kolem 4 100.
//   - Rychlost: výchozí limit Resendu je 2 požadavky za sekundu
//     (stejné číslo má client-remind: pauza 550 ms, drip-send: drip_send_gap_ms 600).
//   - Vlastní pojistka projektu, ne limit Resendu: app_config.drip_daily_cap,
//     v security-fixes-2026-07.sql nastaveno na 500. Z tohohle stropu necháme
//     dripu rezervu a jeden běh check-inu si vezme nanejvýš STROP_BEHU.
//
// Rezerva: jeden běh pošle nejvýš 80 mailů a mezi nimi čeká 600 ms (pod 2/s).
// Když už dnes odešlo tolik `sent`, že by dávka sežrala rezervu 100 pro drip,
// běh pošle míň nebo nic. Další běh téhož týdne vezme další lidi, kteří ještě
// nemají reminded_week = aktuální ISO týden. Nikdo nedostane dva maily v jednom týdnu.

export const RESEND_PREDPOKLAD = {
  plan: "pro" as const,
  denniLimitApi: null as null,
  mesicniLimit: 50_000,
  pozadavkuZaSekundu: 2,
  mezeraMs: 600,
  dripDailyCapVychozi: 500,
  stropBehu: 80,
  rezervaProDrip: 100,
};

export type Osoba = {
  /** Normalizovaný e-mail (trim + lowercase). Podle něj se deduplikuje. */
  email: string;
  /** E-mail tak, jak leží v discount_credits. Update musí trefit tenhle řetězec. */
  emailRaw: string;
  token: string;
  coaching: boolean;
  remindersOff: boolean;
  /** ISO týden poslední rezervace, třeba 2026-W44. null = ještě nikdy. */
  lastRemindedWeek: string | null;
};

export type NactenyCheckin = { at: string | null; chyba: boolean };

/** ISO týden v UTC, formát RRRR-WTT (týden na dvě číslice, ať se dá řadit jako text). */
export function isoTyden(ms: number): string {
  const d = new Date(ms);
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const den = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - den);
  const rok = utc.getUTCFullYear();
  const zacatek = new Date(Date.UTC(rok, 0, 1));
  const tyden = Math.ceil(((utc.getTime() - zacatek.getTime()) / 86400000 + 1) / 7);
  return rok + "-W" + String(tyden).padStart(2, "0");
}

export function dnyOd(iso: string | null, ted: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return (ted - t) / 86400000;
}

/** Stejné okno jako původní smyčka: poslední check-in 6 až 45 dní zpět, včetně hranic. */
export function jeVOkneCheckinu(at: string | null, ted: number): boolean {
  const dny = dnyOd(at, ted);
  if (dny == null) return false;
  return dny >= 6 && dny <= 45;
}

/**
 * Kolik mailů si tenhle běh smí dovolit.
 * Strop běhu (80) a zároveň to, co zbývá z denního stropu dripu po rezervě.
 * Neznámý nebo nesmyslný cap spadne na výchozích 500. Záporný počet odeslaných se bere jako 0.
 */
export function stropTohotoBehu(vstup: {
  dripDailyCap: number;
  odeslanoDnes: number;
  stropBehu?: number;
  rezervaProDrip?: number;
}): number {
  const strop = vstup.stropBehu ?? RESEND_PREDPOKLAD.stropBehu;
  const rezerva = vstup.rezervaProDrip ?? RESEND_PREDPOKLAD.rezervaProDrip;
  const cap = Number.isFinite(vstup.dripDailyCap) && vstup.dripDailyCap > 0
    ? vstup.dripDailyCap
    : RESEND_PREDPOKLAD.dripDailyCapVychozi;
  const odeslano = Number.isFinite(vstup.odeslanoDnes) && vstup.odeslanoDnes > 0
    ? vstup.odeslanoDnes
    : 0;
  const volno = cap - odeslano - rezerva;
  return Math.max(0, Math.min(strop, Math.floor(volno)));
}

/**
 * Lidi, které má smysl vůbec ptát na poslední check-in.
 * Pryč: koučink, vypnuté připomínky, neplatný e-mail, už rezervovaní v tomhle týdnu, duplicitní adresa.
 * Pořadí: kdo nedostal připomínku nikdy, pak nejstarší týden, pak e-mail. Stabilní, ne pořadí z tabulky.
 */
export function pripravFrontu(lide: Osoba[], tyden: string): Osoba[] {
  const videne = new Set<string>();
  const fronta: Osoba[] = [];
  for (const raw of lide) {
    const email = String(raw.email ?? "").trim().toLowerCase();
    if (!email.includes("@") || videne.has(email)) continue;
    videne.add(email);
    if (raw.coaching || raw.remindersOff) continue;
    if (raw.lastRemindedWeek === tyden) continue;
    fronta.push({ ...raw, email });
  }
  fronta.sort((a, b) => {
    const aw = a.lastRemindedWeek ?? "";
    const bw = b.lastRemindedWeek ?? "";
    if (aw !== bw) return aw < bw ? -1 : 1;
    return a.email < b.email ? -1 : a.email > b.email ? 1 : 0;
  });
  return fronta;
}

/**
 * Z fronty vezme nanejvýš `limit` lidí, jejichž poslední check-in je v okně 6 až 45 dní.
 * Na další ve frontě už se neptá, jakmile je dávka plná (kvůli času běhu).
 */
export async function naplnDavku(
  fronta: Osoba[],
  limit: number,
  ted: number,
  nactiPosledni: (email: string) => Promise<NactenyCheckin>,
): Promise<{ davka: Osoba[]; neprecteno: number; mimoOkno: number; dotazu: number }> {
  const davka: Osoba[] = [];
  let neprecteno = 0;
  let mimoOkno = 0;
  let dotazu = 0;
  const n = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;
  if (n === 0) return { davka, neprecteno, mimoOkno, dotazu };
  for (const osoba of fronta) {
    if (davka.length >= n) break;
    dotazu++;
    const posledni = await nactiPosledni(osoba.email);
    if (posledni.chyba) {
      neprecteno++;
      continue;
    }
    if (!jeVOkneCheckinu(posledni.at, ted)) {
      mimoOkno++;
      continue;
    }
    davka.push(osoba);
  }
  return { davka, neprecteno, mimoOkno, dotazu };
}

/**
 * Nechat rezervaci týdne, i když nevíme, jestli Resend mail vzal?
 * Nejistota (5xx nebo pád sítě `sit:`) = nechat, ať se mail nepošle podruhé.
 * Jisté neodeslání (4xx, 429, chybějící klíč) = rezervaci pustit, další běh to zkusí znovu.
 * Stejné pravidlo jako client-remind (komentář u uvolnění rezervace).
 */
export function drzetRezervaci(status: number, chyba: string): boolean {
  if (status >= 500) return true;
  if (String(chyba ?? "").startsWith("sit:")) return true;
  return false;
}
