// Ciste funkce formulare kosiku. Stejne zneni informace jako na serveru
// (akademie/_supabase/functions/kosik-checkout/logika.ts, SOUHLAS_TEXT).
// Od v3 (1. 11. 2026, Martin: "policko nikdo nezaklikne") neni zaskrtavaci policko.
// Pravni zaklad pripominky je opravneny zajem (cl. 6/1 f GDPR) s informaci u e-mailu,
// nazvy SOUHLAS_* a sloupce souhlas* zustaly kvuli DB a odesilaci: souhlas=true
// znamena "clovek dostal tuhle informaci a e-mail vyplnil".
// Pripona je .js schvalne: WEDOS posila .mjs bez Content-Type a s nosniff,
// prohlizec takovy import odmitne.

export const SOUHLAS_VERZE = "kosik-oz-v3-2026-11";
export const SOUHLAS_LABEL =
  "Když objednávku nedokončíš, pošlu ti na tenhle e-mail nejvýš 2 připomínky k téhle objednávce. Odhlásíš se jedním klikem v e-mailu.";
export const SOUHLAS_TEXT =
  SOUHLAS_LABEL + " Zásady ochrany osobních údajů: https://martinbarna.cz/zasady-ochrany-osobnich-udaju/";

export const DROBNY_TEXT =
  "E-mail použijeme k předvyplnění platby ve Stripe. Nechceš připomínky? Pokračuj bez e-mailu.";

export function platnyEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
}

export function vytahniParam(href, jmeno) {
  try {
    return new URL(href, "https://martinbarna.cz").searchParams.get(jmeno) || "";
  } catch {
    return "";
  }
}

export function omezCref(href) {
  const v = vytahniParam(href, "client_reference_id");
  return /^[A-Za-z0-9_-]{1,200}$/.test(v) ? v : "";
}

export function omezPromo(href) {
  const v = vytahniParam(href, "prefilled_promo_code");
  return /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : "";
}

export function maSePrepnout(zapnuto) {
  return zapnuto === true;
}

/**
 * Do odkazu (checkout i fallback na puvodni platebni odkaz) doplni
 * client_reference_id a promo z MBReferral.info. Bez platneho cref necha href byt.
 * Stare parametry odkazu (vcetne utm na fallbacku) nemaze a nove utm nepridava.
 */
export function obohatOdkaz(href, info) {
  if (!info || typeof info.cref !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(info.cref)) return href;
  let u;
  try {
    u = new URL(href, "https://martinbarna.cz");
  } catch {
    return href;
  }
  u.searchParams.set("client_reference_id", info.cref);
  if (typeof info.promo === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(info.promo)) {
    u.searchParams.set("prefilled_promo_code", info.promo);
  }
  return u.toString();
}

/**
 * Telo pro endpoint A. Informace je u e-mailu vzdy videt, takze s e-mailem jde souhlas true
 * a verze v3. Bez e-mailu se telo neposila vubec (tlacitko Pokracovat bez e-mailu).
 * utm se do tela nedava, i kdyz jsou na puvodnim odkazu.
 */
export function sestavTelo(vstup) {
  const telo = {
    klic: vstup.klic,
    email: String(vstup.email || "").trim().toLowerCase(),
    souhlas: true,
    souhlas_verze: SOUHLAS_VERZE,
    zdroj_url: "https://martinbarna.cz" + (vstup.cesta || "/"),
    website: vstup.website || "",
  };
  const cref = omezCref(vstup.href || "");
  const promo = omezPromo(vstup.href || "");
  if (cref) telo.cref = cref;
  if (promo) telo.promo = promo;
  return telo;
}

/** Kam jit po odpovedi. Bez url nebo pri chybe zustava puvodni odkaz. */
export function kamDal(odpoved, puvodniHref) {
  if (odpoved && typeof odpoved.url === "string" && odpoved.url.startsWith("https://")) {
    return { href: odpoved.url, fallback: false };
  }
  return { href: puvodniHref, fallback: true };
}
