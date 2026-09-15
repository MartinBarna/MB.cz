// Čísla z dotazníku před konzultací. Vlastní soubor schválně: jsou to jediná dvě místa
// v `intake-capture`, kde se z textu od člověka stává číslo, podle kterého Martin na
// hovoru počítá výdej. Chyba by tu byla tichá (v mailu prostě nic nebo nesmysl), a takovou
// funkci chci umět otestovat bez startování serveru. Testy: `cisla.test.ts`.
//
// ⛔ Všechna pole chodí z `type="text"`, ne z `type="number"` (důvod je okomentovaný
//    u váhy v `konzultace/dotaznik/index.html`). Přijde sem tedy cokoli: prázdný řetězec,
//    čárka, mezera, text. Nesmysl se zahodí na `null` a v alertu se řádek prostě nevypíše.
//    Radši prázdno než 700 kg nebo 300 let.
// ⛔ Validace patří sem, na server. Prohlížeč je jen návod, ne brána.

// Váha: desetinná čárka i tečka, jedno desetinné místo, rozsah 25 až 350 kg.
export function vahaNaCislo(v: unknown): number | null {
  const n = Number(String(v ?? "").replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 25 || n > 350) return null;
  return Math.round(n * 10) / 10;
}

// Celé číslo v mezích (věk, výška, kroky).
// ⚠️ Mezery se odstraňují schválně, protože „7 000" kroků je běžný zápis. Desetinná čárka
//    se tu naopak NEPŘEVÁDÍ na tečku: „7,000" by se z ní stalo 7 a to je horší než null.
export function celeCislo(v: unknown, min: number, max: number): number | null {
  const s = String(v ?? "").replace(/[\s\u00a0]/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n);
}
