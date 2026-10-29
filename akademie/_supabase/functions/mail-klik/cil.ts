// Rozhodnuti, KAM se smi presmerovat. Vlastni soubor schvalne: je to jedine misto v celem
// mereni, kde muze vzniknout bezpecnostni diera (otevreny redirect), a takova funkce musi
// jit otestovat bez nastartovani serveru. Testy: `cil.test.ts`.

// ⛔ Pridani hostitele je bezpecnostni rozhodnuti, ne kosmetika.
export const POVOLENI_HOSTE = [
  'martinbarna.cz',
  'www.martinbarna.cz',
  'tvujcoach.cz',
  'www.tvujcoach.cz',
  'buy.stripe.com',
];
// Nase vlastni weby: sem se smi i pri CHYBNEM podpisu (skodit se tim neda) a jen sem se
// dolepuji UTM znacky. Na Stripe se pri chybnem podpisu nejde nikdy: podvrzeny platebni
// odkaz je to jedine, cim by sel tenhle endpoint zneuzit.
export const NASE_WEBY = ['martinbarna.cz', 'www.martinbarna.cz', 'tvujcoach.cz', 'www.tvujcoach.cz'];
// Weby za Wedos CDN: kazda unikatni kombinace query je cache MISS a klik z mailu cekal na
// pomaly origin. Seznam zustava kvuli starsim poznamkam. Kampanove parametry se
// od 29. 10. 2026 sundavaji na kazdem povolenem hostiteli a nikam se nepridavaji.
// Kanal mailu nese kratka cesta /go/<slug>, ne parametry v cilove adrese.
export const WEBY_ZA_CDN = ['martinbarna.cz', 'www.martinbarna.cz'];

function jeKampanovaZnacka(k: string): boolean {
  return k.length > 3 && k.toLowerCase().startsWith('u' + 'tm_');
}
export const NOUZOVY_CIL = 'https://martinbarna.cz/';

/**
 * Vrati bezpecnou cilovou adresu, nebo null (volajici pak pouzije `NOUZOVY_CIL`).
 * `duveryhodny` = HMAC podpis navesti sedel.
 */
export function bezpecnyCil(raw: string, duveryhodny: boolean, track: string, key: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;   // relativni adresa, `//evil.com` ani prazdno se neprojde
  }
  if (u.protocol !== 'https:') return null;   // http, mailto, data ani javascript nikdy
  // `new URL` resi i pasti typu `https://martinbarna.cz@evil.com/` (hostname je evil.com)
  // a `https://martinbarna.cz.evil.com/`. Porovnava se cely hostname, nikdy ne `endsWith`.
  const host = u.hostname.toLowerCase();
  const povoleno = duveryhodny ? POVOLENI_HOSTE : NASE_WEBY;
  if (!povoleno.includes(host)) return null;
  // 29. 10. 2026: cilova adresa po kliku z mailu kampanove parametry nenese.
  // Klik je zapsany jako px_click vcetne puvodni adresy (urlProLog dostava raw).
  // Funkcni parametry (plan, tab, email, locale, promo) zustavaji.
  // `track` a `key` se do adresy uz nepisou, mereni kanalu je /go/<slug>.
  void track;
  void key;
  for (const k of [...u.searchParams.keys()]) {
    if (jeKampanovaZnacka(k)) u.searchParams.delete(k);
  }
  return u.toString();
}

// ⛔ NEZ SE URL ULOZI, VYHOD Z NI OSOBNI UDAJE. Nektere sablony maji v odkazu e-mail
//    prijemce (napr. `/akademie/prihlaseni/?tab=up&email=...`, aby se formular predvyplnil).
//    Do `email_events` patri, NA CO clovek klikl, ne KDO to je; toho nese `lead_id`.
//    Presmerovani samo dostane adresu nedotcenou, jinak by se predvyplneni rozbilo.
export function urlProLog(raw: string): string {
  try {
    const u = new URL(raw);
    for (const [k, v] of [...u.searchParams.entries()]) {
      const nk = k.toLowerCase();
      if (nk === 'email' || nk === 'mail' || v.includes('@')) u.searchParams.set(k, '(skryto)');
    }
    return u.toString().slice(0, 500);
  } catch {
    return raw.slice(0, 200);
  }
}
