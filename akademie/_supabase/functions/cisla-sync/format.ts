// Formatovani verejnych cisel potravin. Stejne pravidlo jako SQL
// `verejna_cisla()`: zaokrouhlit DOLU na 10 000, oddelovac tisicu = mezera.
//
// PROC REPLACE: Postgres `to_char(..., 'FM999G999')` bere oddelovac z locale.
// Na jednom serveru to muze byt mezera (50 000), na jinem carka (50,000).
// Do mailu a na web patri VZDY mezera. SQL proto dela `replace(..., ',', ' ')`.
// Tahle funkce je ta sama pojistka na strane TypeScriptu (sanity brana + test).

export function zaokrouhliPotraviny(raw: number): number {
  if (!Number.isFinite(raw)) return NaN;
  return Math.floor(raw / 10000) * 10000;
}

/** Stejne jako SQL: to_char + replace carky mezerou. */
export function formatPotravinyZobrazit(raw: number): string {
  const n = zaokrouhliPotraviny(raw);
  if (!Number.isFinite(n) || n < 0) return "";
  return nahradOddelovacToChar(simulujToCharFm999G999(n));
}

/**
 * Simulace Postgres `to_char(n, 'FM999G999')` v locale, ktere dava CARKU.
 * Test doklada, ze bez replace by do mailu slo "50,000".
 */
export function simulujToCharFm999G999(n: number): string {
  return n.toLocaleString("en-US");
}

/** SQL: `replace(to_char(...), ',', ' ')`. NBSP (U+00A0) taky na obycejnou mezeru. */
export function nahradOddelovacToChar(toCharVystup: string): string {
  return toCharVystup.replace(/,/g, " ").replace(/\u00a0/g, " ").trim();
}

export function parseVerejneCislo(s: string): number {
  const t = String(s ?? "").replace(/\s|\u00a0/g, "").replace(/,/g, "");
  if (!t) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

export type RpcCisla = {
  potraviny_raw?: unknown;
  recepty_raw?: unknown;
  potraviny_zobrazit?: unknown;
  recepty_zobrazit?: unknown;
  mereno_v?: unknown;
};

export type SanityVysledek =
  | {
    ok: true;
    potraviny_raw: number;
    recepty_raw: number;
    potraviny_zobrazit: string;
    recepty_zobrazit: string;
    mereno_v: string;
  }
  | { ok: false; duvod: string };

/**
 * Sanity brana PRED zapisem do app_config. Stara hodnota je vzdy pravdiva
 * (jen starsi); zapsat nesmysl je horsi nez nezapsat nic.
 *
 * POROVNAVA SE RAW PROTI RAW. `ulozenePotravinyRaw` musi prijit z
 * app_config.pocet_potravin_raw, NE z pocet_potravin (to je zobrazovana,
 * uz dolu zaokrouhlena hodnota "50 000" a proti surovemu cislu nesedi).
 *
 * `rpc.potraviny_zobrazit` se ZAMERNE neporovnava: oddelovac tisicu v to_char
 * zavisi na locale serveru a cizi locale (napr. tecka) by branu potichu
 * zasekl navzdy. Zobrazovany tvar si pocitame z potraviny_raw sami.
 */
export function overSanitu(rpc: RpcCisla, ulozenePotravinyRaw: number | null): SanityVysledek {
  const potravinyRaw = Number(rpc.potraviny_raw);
  const receptyRaw = Number(rpc.recepty_raw);
  if (!Number.isInteger(potravinyRaw) || potravinyRaw < 10000) {
    return { ok: false, duvod: "potraviny_raw_mimo_rozsah" };
  }
  if (!Number.isInteger(receptyRaw) || receptyRaw < 50) {
    return { ok: false, duvod: "recepty_raw_mimo_rozsah" };
  }

  if (ulozenePotravinyRaw != null && Number.isFinite(ulozenePotravinyRaw) && ulozenePotravinyRaw > 0) {
    if (potravinyRaw < ulozenePotravinyRaw * 0.8) {
      return { ok: false, duvod: "potraviny_raw_kleslo_o_vic_nez_20pct" };
    }
    // Strop proti skoku nahoru: rozbity dotaz (spatny join, zruseny dedup)
    // umi cislo nafouknout stejne tise jako srazit. Prvni beh uloznene raw
    // nema, projde a raw zapise; strop plati az od druheho behu.
    if (potravinyRaw > ulozenePotravinyRaw * 1.5) {
      return { ok: false, duvod: "potraviny_raw_vyskocilo_o_vic_nez_50pct" };
    }
  }

  const mereno = rpc.mereno_v == null ? "" : String(rpc.mereno_v);
  return {
    ok: true,
    potraviny_raw: potravinyRaw,
    recepty_raw: receptyRaw,
    potraviny_zobrazit: formatPotravinyZobrazit(potravinyRaw),
    recepty_zobrazit: String(receptyRaw),
    mereno_v: mereno,
  };
}
