// =============================================================================
// KONZULTACE: cista logika kolem terminu hovoru (15. 9. 2026, 70. sef).
//
// PROC VLASTNI SOUBOR: `index.ts` vola na konci `Deno.serve()`, takze ho test
// nemuze naimportovat, aniz by nastartoval server. Stejny vzor uz v repu je
// (`drip-send/pravidla.ts`, `admin-api/offboard-mail.ts`). Tady nic necte DB,
// vsechno jsou cisté funkce nad retezci a cislem.
//
// ⛔ MARTIN ZADAVA CAS V CESKEM CASE (Europe/Prague), databaze uklada timestamptz.
//    Rozdil je v lete 2 hodiny a v zime 1, takze "prictu hodinu" je spatne pul roku
//    v roce. Prevod proto pocita skutecny posun pro DANY okamzik pres Intl a jeste
//    ho jednou overi (posun se meni prave v noci, kdy se cas prehazuje).
// =============================================================================

/**
 * Skutecny posun prazskeho casu proti UTC pro dany okamzik, v minutach (60 nebo 120).
 * Pocita se z toho, jak tentyz okamzik vypada v Praze; zadna tabulka letnich casu
 * v kodu neni a byt nema (zastarala by).
 */
export function prazskyPosunMinut(utcMs: number): number {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Prague", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(new Date(utcMs))) p[x.type] = x.value;
  const jakoUtc = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour) % 24, Number(p.minute), Number(p.second),
  );
  return Math.round((jakoUtc - utcMs) / 60000);
}

export type Prevod = { ok: true; iso: string } | { ok: false; duvod: string };

/** Kolik let dopredu i dozadu se termin jeste bere jako smysluplny. */
export const ROZUMNE_OKNO_LET = 2;

/**
 * "2026-09-18" + "14:30" (cesky cas) -> ISO v UTC.
 *
 * ⛔ Vraci DUVOD, ne `null`. Prazdne pole a preklep jsou dve ruzne veci a Martin
 *    musi v adminu videt, kterou z nich udelal; tiche "neulozilo se" je nejhorsi
 *    mozna odpoved na formular, do ktereho nekdo neco napsal.
 * ⚠️ Nesmyslne datum (31. 2.) se pozna ZPETNYM prevodem, ne rozsahem cisel:
 *    `Date.UTC(2026, 1, 31)` tise vyrobi 3. brezna.
 */
export function terminNaIso(datum: unknown, cas: unknown, tedMs: number = Date.now()): Prevod {
  const d = String(datum ?? "").trim();
  const c = String(cas ?? "").trim();
  if (!d && !c) return { ok: false, duvod: "prazdne" };
  if (!d) return { ok: false, duvod: "chybi_datum" };
  if (!c) return { ok: false, duvod: "chybi_cas" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { ok: false, duvod: "datum_nema_tvar_RRRR-MM-DD" };
  if (!/^\d{2}:\d{2}$/.test(c)) return { ok: false, duvod: "cas_nema_tvar_HH:MM" };
  const rok = Number(d.slice(0, 4)), mesic = Number(d.slice(5, 7)), den = Number(d.slice(8, 10));
  const hod = Number(c.slice(0, 2)), min = Number(c.slice(3, 5));
  if (hod > 23 || min > 59) return { ok: false, duvod: "cas_mimo_rozsah" };
  if (mesic < 1 || mesic > 12 || den < 1 || den > 31) return { ok: false, duvod: "datum_mimo_rozsah" };
  const naive = Date.UTC(rok, mesic - 1, den, hod, min, 0);
  const zpet = new Date(naive);
  if (zpet.getUTCFullYear() !== rok || zpet.getUTCMonth() !== mesic - 1 || zpet.getUTCDate() !== den) {
    return { ok: false, duvod: "datum_neexistuje" };
  }
  // Posun se bere pro odhadnuty okamzik a jednou se preveri: kolem prechodu na letni
  // cas by prvni odhad mohl byt o hodinu vedle.
  let posun = prazskyPosunMinut(naive);
  let ms = naive - posun * 60000;
  const posun2 = prazskyPosunMinut(ms);
  if (posun2 !== posun) { posun = posun2; ms = naive - posun * 60000; }
  const okno = ROZUMNE_OKNO_LET * 365.25 * 86400000;
  if (Math.abs(ms - tedMs) > okno) return { ok: false, duvod: "datum_mimo_rozumne_okno" };
  return { ok: true, iso: new Date(ms).toISOString() };
}

export type StavHovoru = "bez_terminu" | "naplanovano" | "probehlo";

/**
 * Stav konzultace podle terminu. Jediny zdroj pravdy je `consultation_calls.termin_at`;
 * tatáž hranice, jakou pouziva SQL enroll i drip-send, at admin neukazuje jiny svet
 * nez to, co maily doopravdy delaji.
 */
export function stavHovoru(terminAt: unknown, tedMs: number = Date.now()): StavHovoru {
  const t = Date.parse(String(terminAt ?? ""));
  if (!Number.isFinite(t)) return "bez_terminu";
  return t <= tedMs ? "probehlo" : "naplanovano";
}

/** Termin zpatky do poli formulare (cesky cas), at Martin vidi, co je ulozene. */
export function isoNaPoleFormulare(iso: unknown): { datum: string; cas: string } {
  const t = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(t)) return { datum: "", cas: "" };
  const posun = prazskyPosunMinut(t);
  const d = new Date(t + posun * 60000);
  const dva = (n: number) => String(n).padStart(2, "0");
  return {
    datum: d.getUTCFullYear() + "-" + dva(d.getUTCMonth() + 1) + "-" + dva(d.getUTCDate()),
    cas: dva(d.getUTCHours()) + ":" + dva(d.getUTCMinutes()),
  };
}
