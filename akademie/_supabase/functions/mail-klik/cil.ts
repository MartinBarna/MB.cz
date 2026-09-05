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
// pomaly origin (pamet mb-wedos-pomaly-origin-a-utm-cache). JEN tady se UTM z cile mazou.
export const WEBY_ZA_CDN = ['martinbarna.cz', 'www.martinbarna.cz'];
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
  // ⚡ ZMENA 27. 8. 2026 (Martin: „musí to jet vše svižně"): na martinbarna.cz se UTM z CILOVE
  // adresy ODSTRANUJI kvuli Wedos CDN (viz WEBY_ZA_CDN). Klik uz je zapsany jako `px_click`
  // VCETNE puvodni URL s UTM (urlProLog dostava `raw`), o atribuci na webu se neprichazi.
  // ⛔ OPRAVA 5. 9. 2026: tvujcoach.cz (Vercel, zadna CDN past) UTM POTREBUJE. Mazani platilo
  // pro vsechny NASE_WEBY, takze 331 mailu blastu „Spocitej si, kolik mas jist" dorazilo na
  // /start bez utm a trychtyr v `page_views` byl slepy (0 z 331), i kdyz lidi prosli az na
  // /sign-up. Funkcni parametry (`plan`, `tab`, `email`...) zustavaji vzdy nedotcene.
  if (WEBY_ZA_CDN.includes(host)) {
    for (const k of [...u.searchParams.keys()]) {
      if (k.toLowerCase().startsWith('utm_')) u.searchParams.delete(k);
    }
  } else if (NASE_WEBY.includes(host) && !u.searchParams.has('utm_source')) {
    // Bez vlastnich znacek v sablone dostane cil aspon zdroj/trat/krok, aby sel klik z mailu
    // v `page_views` odlisit od organiky. Sablona s vlastnim UTM ma prednost (neprepisuje se).
    u.searchParams.set('utm_source', 'email');
    u.searchParams.set('utm_medium', 'drip');
    if (track) u.searchParams.set('utm_campaign', track);
    if (key) u.searchParams.set('utm_content', key);
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
