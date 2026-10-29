// Ciste funkce formulare kosiku. Stejne zneni souhlasu jako na serveru
// (akademie/_supabase/functions/kosik-checkout/logika.ts, SOUHLAS_TEXT).
// Pripona je .js schvalne: WEDOS posila .mjs bez Content-Type a s nosniff,
// prohlizec takovy import odmitne.

export const SOUHLAS_VERZE = "kosik-v1-2026-11";
export const SOUHLAS_TEXT =
  "Pošli mi e-mail, když objednávku nedokončím, a občas tipy a nabídky od Martina Barny. Souhlas můžu kdykoli odvolat odkazem v každém e-mailu. Zásady ochrany osobních údajů: https://martinbarna.cz/zasady-ochrany-osobnich-udaju/";

export const SOUHLAS_LABEL =
  "Pošli mi e-mail, když objednávku nedokončím, a občas tipy a nabídky od Martina Barny. Souhlas můžu kdykoli odvolat odkazem v každém e-mailu.";

export const DROBNY_TEXT =
  "E-mail použijeme k předvyplnění platby ve Stripe. Bez zaškrtnutí ti připomínku neposíláme.";

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
 * Telo pro endpoint A. Souhlas je true jen kdyz je zaskrtnuto.
 * utm se do tela nedava, i kdyz jsou na puvodnim odkazu.
 */
export function sestavTelo(vstup) {
  const telo = {
    klic: vstup.klic,
    email: String(vstup.email || "").trim().toLowerCase(),
    souhlas: vstup.souhlas === true,
    souhlas_verze: vstup.souhlas === true ? SOUHLAS_VERZE : "",
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
