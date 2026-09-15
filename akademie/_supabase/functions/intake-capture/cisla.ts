// Čísla z dotazníku před konzultací. Vlastní soubor schválně: jsou to jediná místa
// v `intake-capture`, kde se z textu od člověka stává číslo, podle kterého Martin na
// hovoru počítá výdej. Chyba by tu byla tichá, a takovou funkci chci umět otestovat
// bez startování serveru. Testy: `cisla.test.ts`.
//
// ⛔ Všechna pole chodí z `type="text"`, ne z `type="number"` (důvod je okomentovaný
//    u váhy v `konzultace/dotaznik/index.html`). Přijde sem tedy cokoli: prázdný řetězec,
//    čárka, tečka, mezera, jednotka, text.
// ⛔ Validace patří sem, na server. Prohlížeč je jen návod, ne brána.

// Váha: desetinná čárka i tečka, jedno desetinné místo, rozsah 25 až 350 kg.
// ⚠️ Tečka je tu desetinná správně („82.5" je 82,5 kg). Oddělovač tisíců u váhy nehrozí,
//    protože čtyřciferná váha v kilech neexistuje a „1.000" spadne na dolní mezi 25 kg.
export function vahaNaCislo(v: unknown): number | null {
  const n = Number(String(v ?? "").replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 25 || n > 350) return null;
  return Math.round(n * 10) / 10;
}

// Celé číslo v mezích (věk, výška, kroky).
// ⚠️ Mezery se odstraňují schválně, protože „7 000" kroků je běžný zápis.
// ⛔ Bere se JEN prostý tvar čísla: volitelné znaménko, číslice, volitelná desetinná tečka.
//    Čárka tím padá („7,000" by jinak dalo 7 kroků) a s ní i zápisy jako „1e4", „0x10"
//    nebo „cca 8000", které `Number()` samo o sobě spolkne nebo přeloží na nesmysl.
// ⛔ Tečka jako oddělovač tisíců („7.000", „10.500") se zahazuje taky. Tři číslice za
//    tečkou nikdo nepíše jako desetinné místo věku, výšky ani kroků, takže je to tisícovka.
//    Nález revize 15. 9. 2026: bez tohohle kroku se „7.000" uložilo jako 7.
export function celeCislo(v: unknown, min: number, max: number): number | null {
  const s = String(v ?? "").replace(/[\s\u00a0]/g, "");
  if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return null;
  if (/\.\d{3}$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n);
}

// Co se o čísle napíše do alert mailu.
// ⛔ Zahozená hodnota NESMÍ vypadat jako nevyplněná. Kdo napíše do výšky „1,82", dostane
//    null, formulář mu nic neřekne a Martinovi v mailu prostě chybí řádek: nepozná rozdíl
//    mezi „nevyplnil" a „vyplnil, ale my mu to zahodili", a jde na placený hovor zase bez
//    čísla. Proto se nečitelný vstup vypíše i s tím, co člověk napsal, ať se Martin doptá.
// ⚠️ Do DB jde dál null, tohle je JEN text do mailu.
// ⚠️ Escapování tu není schválně, dělá ho `esc` uvnitř `R()` v `index.ts`. Kdyby se
//    escapovalo dvakrát, Martin by v mailu viděl `&amp;lt;`.
export function proAlert(raw: unknown, cislo: number | null, jednotka = ""): string {
  if (cislo !== null) return jednotka ? cislo + " " + jednotka : String(cislo);
  const puvodni = String(raw ?? "").trim();
  if (!puvodni) return "";
  return "nečitelné („" + puvodni.slice(0, 40) + "“)";
}
