// Barna Academy - stopa.ts: vlastni mereni otevreni a prokliku mailu.
// Prilepi do hotoveho HTML mailu (a) mericí 1x1 pixel a (b) prepise odkazy pres nasi
// presmerovaci funkci `mail-klik`. Protejsky: edge funkce `mail-pixel` a `mail-klik`.
//
// ⛔⛔ TENHLE SOUBOR EXISTUJE VE TRECH KOPIICH, ve slozkach `drip-send`, `milestones`
//     a `order-rescue`. Nasazeni edge funkce kopiruje CELOU slozku a funkce nesmi
//     importovat mimo ni (funkce s importem zvenci navic tise vypadne z
//     `npm run kontrola:nasazeni`). Kopie MUSI byt bajt na bajt shodne;
//     hlida to test `stopa-kopie.test.ts` v teto slozce.
//
// ⛔ CO SE NIKDY NEPREPISUJE:
//    1. ODHLASOVACI ODKAZ. Je to pravni povinnost a zaroven obsah hlavicky
//       `List-Unsubscribe`. Kdyby prestal fungovat presmerovac, clovek se neodhlasi.
//    2. AUTH ODKAZY (magic link, potvrzeni registrace). Bezpecnostni token nema
//       protekat pres dalsi redirect, ani nas vlastni. Pravidlo z
//       `mb-resend-tracking-domena-400`: "auth maily nikdy".
//    3. Cokoli mimo `POVOLENI_HOSTE` (napr. obrazky ze Supabase Storage, mailto).
//
// ⚠️ TEXTOVA CAST MAILU SE NECHAVA BEZE ZMENY. Duvod: v plain textu je videt cela adresa
//    a prepsana na nesrozumitelny redirect snizuje duveryhodnost mailu. Kliky se meri
//    z HTML casti, kterou cte drtiva vetsina lidi.
//
// ⚠️ FAIL-SAFE JE SMEREM K ODESLANI MAILU: kdyz chybi secret nebo cokoli spadne, vrati se
//    PUVODNI HTML a mail odejde nezmereny. Mereni nikdy nesmi shodit odchozi mail.

export interface StopaIdent {
  track: string;
  step: number;
  key: string;
  lead_id: string | null;
}

// Hostitele, jejichz odkazy se meri. ⛔ Musi byt PODMNOZINOU whitelistu v `mail-klik`,
// jinak by presmerovac odmitl vlastni odkaz a poslal cloveka na uvodni stranku.
export const POVOLENI_HOSTE = [
  'martinbarna.cz',
  'www.martinbarna.cz',
  'tvujcoach.cz',
  'www.tvujcoach.cz',
  'buy.stripe.com',
];

const bytesToB64url = (b: Uint8Array): string => {
  let bin = '';
  for (const x of b) bin += String.fromCharCode(x);
  return btoa(bin).split('+').join('-').split('/').join('_').split('=').join('');
};
const textToB64url = (s: string): string => bytesToB64url(new TextEncoder().encode(s));

// HMAC-SHA256 zkraceny na 27 znaku base64url (~160 bitu).
// ⛔ Delku meni jen ten, kdo ji zmeni ZAROVEN v `mail-pixel` i `mail-klik`.
export async function podpis(text: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return bytesToB64url(new Uint8Array(sig)).slice(0, 27);
}

async function odkazNaFunkci(base: string, fn: string, telo: Record<string, unknown>, secret: string): Promise<string> {
  const p = textToB64url(JSON.stringify(telo));
  const s = await podpis(p, secret);
  // `&amp;` je zamerne: vysledek jde do HTML atributu, kde holy `&` neni platny markup.
  return base + '/functions/v1/' + fn + '?p=' + p + '&amp;s=' + s;
}

// HTML entity zpet na znaky. Sablony pisou odkazy castecne s `&amp;`, castecne bez
// (napr. `free_lessons_url` ma holy `&`), takze bez tohohle by se do podpisu dostala
// jina adresa, nez na kterou clovek klika.
function odentituj(s: string): string {
  return s.split('&amp;').join('&').split('&#38;').join('&').split('&quot;').join(String.fromCharCode(34))
    .split('&#39;').join(String.fromCharCode(39)).split('&lt;').join('<').split('&gt;').join('>');
}

// Smi se tenhle odkaz merit? Odpoved musi byt konzervativni: pri sebemensi pochybnosti NE.
export function smiSeMerit(href: string): boolean {
  const h = href.trim();
  if (!h || h.startsWith('#') || h.startsWith('mailto:') || h.startsWith('tel:')) return false;
  if (!h.startsWith('https://')) return false;             // http ani relativni odkazy ne
  if (h.includes('/functions/v1/unsubscribe')) return false;  // ⛔ odhlaseni NIKDY
  if (h.includes('/functions/v1/mail-klik')) return false;     // uz zmereno (dvoji pruchod)
  if (h.includes('/auth/v1/')) return false;                   // ⛔ auth token NIKDY
  let u: URL;
  try {
    u = new URL(h);
  } catch {
    return false;
  }
  return POVOLENI_HOSTE.includes(u.hostname.toLowerCase());
}

// Najde v HTML vsechny `<a ... href=...>` a povolene odkazy prepise na `mail-klik`.
// Zamerne bez regularnich vyrazu: `drip-send/index.ts` je psany bez zpetnych lomitek,
// aby sel snadno nasadit, a tenhle soubor drzi stejnou konvenci.
async function prepisOdkazy(html: string, id: StopaIdent, secret: string, base: string): Promise<string> {
  let out = '';
  let i = 0;
  while (true) {
    const a = html.indexOf('<a ', i);
    if (a < 0) { out += html.slice(i); break; }
    const gt = html.indexOf('>', a);
    if (gt < 0) { out += html.slice(i); break; }
    const tag = html.slice(a, gt);
    const h = tag.indexOf('href=');
    if (h < 0) { out += html.slice(i, gt + 1); i = gt + 1; continue; }
    const q = tag.charAt(h + 5);
    const start = h + 6;
    const konec = tag.indexOf(q, start);
    if ((q !== String.fromCharCode(34) && q !== String.fromCharCode(39)) || konec < 0) {
      out += html.slice(i, gt + 1); i = gt + 1; continue;
    }
    const puvodni = tag.slice(start, konec);
    const cil = odentituj(puvodni);
    if (!smiSeMerit(cil)) { out += html.slice(i, gt + 1); i = gt + 1; continue; }
    const novy = await odkazNaFunkci(base, 'mail-klik', {
      tr: id.track, st: id.step, kl: id.key, ld: id.lead_id, url: cil,
    }, secret);
    out += html.slice(i, a) + tag.slice(0, start) + novy + tag.slice(konec) + '>';
    i = gt + 1;
  }
  return out;
}

async function pixel(id: StopaIdent, secret: string, base: string): Promise<string> {
  const src = await odkazNaFunkci(base, 'mail-pixel', {
    tr: id.track, st: id.step, kl: id.key, ld: id.lead_id,
  }, secret);
  // Zadny `display:none`: skryty obrazek si nektere klienty vubec nestahnou a nekterym
  // filtrum to pridava spamove skore. 1x1 s nulovou pruhlednosti je bezny a nenapadny.
  return `<img src='${src}' width='1' height='1' alt='' style='width:1px;height:1px;border:0;opacity:0;overflow:hidden'>`;
}

/**
 * Prilepi mereni do hotoveho HTML mailu.
 * `secret` prazdny (chybejici `MAIL_TRACK_SECRET`) = vrati vstup beze zmeny.
 * Jakakoli vyjimka = vrati vstup beze zmeny; mail odejde nezmereny, ale odejde.
 *
 * ⛔⛔ `sPixelem = false` SE MUSI POUZIT VZDY, KDYZ MA MAIL ARCHIVNI KOPII (BCC).
 *    Resend posle BCC kopii s BAJT NA BAJT stejnym telem, takze nese TENTYZ mericí pixel.
 *    Martinova posta (Gmail) si obrazek predstahne uz pri DORUCENI, tedy do par vterin po
 *    odeslani, a otevreni by se zapsalo prijemci. Kazdy mail by mel "otevreno" 100 %,
 *    coz je presne ta mrtva metrika, kvuli ktere se opoustel Resend tracking
 *    (`mb-mereni-otevreni-mailu-nefunguje`). U prokliku to nevadi: predstahovani obrazku
 *    odkazy neotevira, a kdyby na ne nekdo v archivu klikl, pozna se to pri cteni.
 */
export async function ostopkuj(
  html: string,
  id: StopaIdent,
  secret: string,
  base: string,
  sPixelem = true,
): Promise<string> {
  if (!secret || !html) return html;
  try {
    const sOdkazy = await prepisOdkazy(html, id, secret, base);
    if (!sPixelem) return sOdkazy;
    const px = await pixel(id, secret, base);
    const konec = sOdkazy.lastIndexOf('</body>');
    return konec < 0 ? sOdkazy + px : sOdkazy.slice(0, konec) + px + sOdkazy.slice(konec);
  } catch (e) {
    console.error('[stopa] mereni preskoceno: ' + String(e).slice(0, 200));
    return html;
  }
}
