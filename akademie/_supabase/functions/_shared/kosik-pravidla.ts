// Cista pravidla opusteneho kosiku. Zadny Deno.serve, zadna sit, zadny Stripe.
// Okno 8:00 az 20:00 se pocita v Europe/Prague, ne pevnym offsetem (prechod casu).

const PRAHA = "Europe/Prague";

export const MS_HODINA = 3600 * 1000;
export const MS_48H = 48 * MS_HODINA;
export const MS_24H = 24 * MS_HODINA;
export const MS_30D = 30 * 24 * MS_HODINA;
export const LIMIT_EMAIL_10MIN = 5;
export const LIMIT_IP_10MIN = 20;
export const LIMIT_OKNO_MS = 10 * 60 * 1000;
export const MAX_MAILU_NA_BEH = 10;
export const MAX_ALERTU = 3;

const OD_SEKUND = 8 * 3600;
const DO_SEKUND = 20 * 3600;

export type CastiPraha = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function castiPraha(d: Date): CastiPraha {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: PRAHA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function offsetMs(utcMs: number): number {
  const c = castiPraha(new Date(utcMs));
  const jakoUtc = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second);
  return jakoUtc - utcMs;
}

/** 8:00 (nebo jina hodina) v Praze jako okamzik UTC. Kolem prechodu se offset overi dvakrat. */
export function prahaNaUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0,
): Date {
  const odhad = Date.UTC(year, month - 1, day, hour, minute, second);
  let utc = odhad - offsetMs(odhad);
  utc = odhad - offsetMs(utc);
  return new Date(utc);
}

/**
 * Kdy smi odejit mail.
 * Uvnitr 8:00:00 az 20:00:00 vcetne zustava cas.
 * Pred 8:00 ten samy den v 8:00.
 * Po 20:00 dalsi den v 8:00.
 */
export function posunDoOkna(vstup: Date): Date {
  const c = castiPraha(vstup);
  const sekundy = c.hour * 3600 + c.minute * 60 + c.second;
  if (sekundy >= OD_SEKUND && sekundy <= DO_SEKUND) return new Date(vstup.getTime());
  if (sekundy < OD_SEKUND) return prahaNaUtc(c.year, c.month, c.day, 8, 0, 0);
  const dalsi = new Date(Date.UTC(c.year, c.month - 1, c.day) + MS_24H);
  return prahaNaUtc(dalsi.getUTCFullYear(), dalsi.getUTCMonth() + 1, dalsi.getUTCDate(), 8, 0, 0);
}

/** Mail 2: 48 h po odeslani mailu 1, pak znovu do okna. */
export function mail2Po(mail1Odeslan: Date): Date {
  return posunDoOkna(new Date(mail1Odeslan.getTime() + MS_48H));
}

/** 0 = nedele ... 2 = utery, 5 = patek. */
export function denVTydnuPraha(d: Date): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: PRAHA, weekday: "short" }).format(d);
  const mapa: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const n = mapa[wd];
  if (n === undefined) throw new Error("neznamej den: " + wd);
  return n;
}

/**
 * Promo utery a patek: kdyz ten den uz prisel marketingovy mail, posun o 24 h a znovu do okna.
 * Jine dny se neposouvaji. Jedno vyhodnoceni posune jednou; dalsi den to cron zkusi znovu.
 */
export function posunKvuliPromu(due: Date, dostalMarketing: boolean): Date {
  if (!dostalMarketing) return new Date(due.getTime());
  const den = denVTydnuPraha(due);
  if (den !== 2 && den !== 5) return new Date(due.getTime());
  return posunDoOkna(new Date(due.getTime() + MS_24H));
}

/** True = jina serie tohoto e-mailu odesla behem poslednich 30 dnu. */
export function jeVOkne30Dni(posledni: Date | null, ted: Date): boolean {
  if (!posledni) return false;
  return ted.getTime() - posledni.getTime() < MS_30D;
}

export type KosikFlagy = {
  webZapnuto: boolean;
  mailZapnuto: boolean;
  dryRun: boolean;
  garanceK1: boolean;
  produkty: string[];
};

export const FLAGY_VYCHOZI: KosikFlagy = {
  webZapnuto: false,
  mailZapnuto: false,
  dryRun: true,
  garanceK1: false,
  produkty: ["konzultace"],
};

export function flagBool(hodnota: string | null | undefined, vychozi: boolean): boolean {
  if (hodnota == null || String(hodnota).trim() === "") return vychozi;
  return String(hodnota).trim().toLowerCase() === "true";
}

export function parsujProdukty(hodnota: string | null | undefined): string[] {
  if (hodnota == null || String(hodnota).trim() === "") return [...FLAGY_VYCHOZI.produkty];
  return String(hodnota).split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Chybejici radky = vychozi (web off, mail off, dry-run on, garance off, jen konzultace).
 * Env KOSIK_DRY_RUN=1 dry-run zapne. Vypnout ho env neumi, at testovaci nasazeni neposle ostro.
 */
export function slozFlagy(
  radky: { key: string; value: string | null }[],
  envDry: string | undefined,
): KosikFlagy {
  const map = new Map(radky.map((r) => [r.key, r.value]));
  const dry = flagBool(map.get("kosik_dry_run"), true);
  return {
    webZapnuto: flagBool(map.get("kosik_web_zapnuto"), false),
    mailZapnuto: flagBool(map.get("kosik_mail_zapnuto"), false),
    dryRun: envDry === "1" ? true : dry,
    garanceK1: flagBool(map.get("kosik_garance_k1"), false),
    produkty: parsujProdukty(map.get("kosik_produkty")),
  };
}

export function jeNeprazdny(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/** Uplny ulozeny souhlas. Bez nej se mail nesmi ani naplanovat jako k odeslani. */
export function maUplnySouhlas(r: {
  souhlas: boolean;
  souhlas_at: string | null;
  souhlas_text: string | null;
  souhlas_verze: string | null;
  stripe_session_id: string | null;
}): boolean {
  return r.souhlas === true
    && jeNeprazdny(r.souhlas_at)
    && jeNeprazdny(r.souhlas_text)
    && jeNeprazdny(r.souhlas_verze)
    && jeNeprazdny(r.stripe_session_id);
}

/** SQL ilike %+test% a sloupec test. */
export function jeTestRadka(r: { test: boolean; email: string }): boolean {
  return r.test === true || r.email.toLowerCase().includes("+test");
}

export type RadekStop = {
  produkt_klic: string;
  email: string;
  test: boolean;
  zaplaceno_at: string | null;
  odpoved_at: string | null;
  odhlaseno_at: string | null;
  recovery_expires_at: string | null;
  recovery_url: string | null;
};

export type StopKontext = {
  ted: Date;
  aktivniEntitlement: boolean;
  aktivniKoucink: boolean;
  guardAkce: "send" | "skip";
  guardDuvod: string;
  dryRun: boolean;
  jinaSerieDo30Dni: boolean;
};

/**
 * Stop serie. Souhlas se hlida zvlast a driv (maUplnySouhlas), sem uz nepatri.
 * Vraci duvod, nebo null kdyz se smi pokracovat k odeslani (nebo k dry-run zapisu).
 */
export function duvodStopu(r: RadekStop, ctx: StopKontext): string | null {
  if (jeNeprazdny(r.zaplaceno_at)) return "zaplaceno";
  if (ctx.aktivniEntitlement) return "ma_pristup";
  if ((r.produkt_klic === "konzultace" || r.produkt_klic === "konzultace-vk") && ctx.aktivniKoucink) {
    return "aktivni_koucink";
  }
  if (jeNeprazdny(r.odpoved_at)) return "odpoved";
  if (jeNeprazdny(r.odhlaseno_at)) return "odhlaseno";
  if (ctx.guardAkce === "skip") return "brana_" + (ctx.guardDuvod || "skip");
  if (jeTestRadka(r) && !ctx.dryRun) return "test";
  if (!jeNeprazdny(r.recovery_url)) return "bez_recovery";
  if (jeNeprazdny(r.recovery_expires_at) && new Date(r.recovery_expires_at as string).getTime() < ctx.ted.getTime()) {
    return "recovery_expirovalo";
  }
  if (ctx.jinaSerieDo30Dni) return "strop_30_dni";
  return null;
}

export type RadekCastky = {
  id: string;
  email: string;
  castka_halere: number;
  created_at: string;
};

/** Vic kosiku stejneho e-mailu: posila se vyssi castka, ostatni dostanou stav sloucen. Remiza: starsi radek. */
export function rozdelPodleCastky<T extends RadekCastky>(radky: T[]): { vitez: T; sloucit: T[] }[] {
  const skupiny = new Map<string, T[]>();
  for (const r of radky) {
    const k = r.email.trim().toLowerCase();
    const arr = skupiny.get(k) ?? [];
    arr.push(r);
    skupiny.set(k, arr);
  }
  const out: { vitez: T; sloucit: T[] }[] = [];
  for (const arr of skupiny.values()) {
    const serazene = [...arr].sort((a, b) => {
      if (b.castka_halere !== a.castka_halere) return b.castka_halere - a.castka_halere;
      if (a.created_at < b.created_at) return -1;
      if (a.created_at > b.created_at) return 1;
      return a.id < b.id ? -1 : 1;
    });
    out.push({ vitez: serazene[0], sloucit: serazene.slice(1) });
  }
  return out;
}

/** Klic sablony. Videokurz a Academy v teto vlne nemaji odesilani, i kdyz texty v JSON jsou. */
export function sablonaProKlic(klic: string): "kosik-konzultace" | "kosik-koucink" | null {
  if (klic === "konzultace" || klic === "konzultace-vk") return "kosik-konzultace";
  if (klic.startsWith("coaching-")) return "kosik-koucink";
  return null;
}

export function produktEntitlement(klic: string): string | null {
  if (klic === "konzultace" || klic === "konzultace-vk") return "konzultace";
  if (klic.startsWith("coaching-")) return "coaching";
  return null;
}

export function platnyEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
}

export function platnyCref(s: string): boolean {
  return /^[A-Za-z0-9_-]{1,200}$/.test(s);
}

export function platnyPromo(s: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(s);
}

/** Filtr, ktery musi mit SQL dotaz odesilace. Test ho pousti pres zapisovac volani. */
export const SLOUPCE_SOUHLASU = ["souhlas_at", "souhlas_text", "souhlas_verze", "stripe_session_id"] as const;

export function aplikujFiltrSouhlasu<Q extends {
  eq: (col: string, val: unknown) => Q;
  not: (col: string, op: string, val: unknown) => Q;
}>(q: Q): Q {
  let out = q.eq("souhlas", true);
  for (const col of SLOUPCE_SOUHLASU) out = out.not(col, "is", null);
  return out;
}
