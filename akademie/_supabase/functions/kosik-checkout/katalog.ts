// Whitelist kosiku. Cena a castka jsou jen tady, z klienta se neberou.
// Price ID doplni Martin po GO (PLAN sekce 8.3) do env. Prazdne ID = checkout vrati fallback
// a clovek jde na puvodni platebni odkaz. Zadne price ID se nehada.

import { KOSIK_KLICE as _KLICE } from "./katalog-klice.ts";

export { KOSIK_KLICE } from "./katalog-klice.ts";

export type KosikPolozka = {
  klic: string;
  castkaHalere: number;
  castkaKc: number;
  /** Povolena sleva v procentech (DOPORUC10 = 10). Koučink kupón nemá. */
  slevyProcent: number[];
  priceEnv: string;
  successUrl: string;
  cancelUrl: string;
  /** entitlements.product */
  produkt: string;
  /** Sablona mailu. null = tahle vlna mail neposila (videokurz a Academy tu nejsou). */
  sablona: "kosik-konzultace" | "kosik-koucink" | null;
};

export const KOSIK_KATALOG: Record<string, KosikPolozka> = {
  konzultace: {
    klic: "konzultace",
    castkaHalere: 299_000,
    castkaKc: 2990,
    slevyProcent: [10],
    priceEnv: "STRIPE_PRICE_KONZULTACE",
    successUrl: "https://martinbarna.cz/dekuji-konzultace/",
    cancelUrl: "https://martinbarna.cz/konzultace/",
    produkt: "konzultace",
    sablona: "kosik-konzultace",
  },
  // Skryta varianta pro majitele videokurzu (2 190 Kc). Na webu neni tlacitko.
  // Webhook ji umi, checkout ji pusti az kdyz ji nekdo prida do kosik_produkty.
  "konzultace-vk": {
    klic: "konzultace-vk",
    castkaHalere: 219_000,
    castkaKc: 2190,
    slevyProcent: [10],
    priceEnv: "STRIPE_PRICE_KONZULTACE_VK",
    successUrl: "https://martinbarna.cz/dekuji-konzultace/",
    cancelUrl: "https://martinbarna.cz/konzultace/",
    produkt: "konzultace",
    sablona: "kosik-konzultace",
  },
  "coaching-gold-1": polozkaKoucink("coaching-gold-1", 645_000, 6450, "STRIPE_PRICE_COACHING_GOLD_1"),
  "coaching-gold-3": polozkaKoucink("coaching-gold-3", 1_695_000, 16950, "STRIPE_PRICE_COACHING_GOLD_3"),
  "coaching-gold-6": polozkaKoucink("coaching-gold-6", 3_195_000, 31950, "STRIPE_PRICE_COACHING_GOLD_6"),
  "coaching-diamond-1": polozkaKoucink("coaching-diamond-1", 1_190_000, 11900, "STRIPE_PRICE_COACHING_DIAMOND_1"),
  "coaching-diamond-3": polozkaKoucink("coaching-diamond-3", 3_290_000, 32900, "STRIPE_PRICE_COACHING_DIAMOND_3"),
  "coaching-diamond-6": polozkaKoucink("coaching-diamond-6", 5_950_000, 59500, "STRIPE_PRICE_COACHING_DIAMOND_6"),
};

function polozkaKoucink(klic: string, castkaHalere: number, castkaKc: number, priceEnv: string): KosikPolozka {
  return {
    klic,
    castkaHalere,
    castkaKc,
    slevyProcent: [],
    priceEnv,
    successUrl: "https://martinbarna.cz/koucing/dekuji/",
    cancelUrl: "https://martinbarna.cz/koucing/",
    produkt: "coaching",
    sablona: "kosik-koucink",
  };
}

const KLICE_SET = new Set<string>(_KLICE);

export function jeKosikKlic(klic: string): boolean {
  return KLICE_SET.has(klic) && KOSIK_KATALOG[klic] != null;
}

export function povoleneCastky(polozka: KosikPolozka): number[] {
  const out = [polozka.castkaHalere];
  for (const p of polozka.slevyProcent) {
    out.push(Math.round(polozka.castkaHalere * (100 - p) / 100));
  }
  return out;
}

/** Presna castka, nebo nizsi jen o povoleny promo (konzultace: 10 %). */
export function castkaSedi(klic: string, amountTotal: unknown): boolean {
  const polozka = KOSIK_KATALOG[klic];
  if (!polozka) return false;
  const n = typeof amountTotal === "number" ? amountTotal : Number(amountTotal);
  if (!Number.isInteger(n)) return false;
  return povoleneCastky(polozka).includes(n);
}

/** Price ID jen z env. Prazdny retezec = neznama cena, session se nezaklada. */
export function priceId(klic: string, env: (name: string) => string | undefined): string {
  const polozka = KOSIK_KATALOG[klic];
  if (!polozka) return "";
  const v = (env(polozka.priceEnv) ?? "").trim();
  if (!/^price_[A-Za-z0-9]+$/.test(v)) return "";
  return v;
}
