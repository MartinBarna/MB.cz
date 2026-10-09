/**
 * Společné pomůcky pro GEO skripty (optimalizace pro AI vyhledávání).
 *
 * Používají je:
 *   scripts/geo-kontrola.mjs        kontrola JSON-LD, autorů, dat, cen a sitemapy
 *   scripts/generuj-llms-full.mjs   plný text webu pro AI asistenty (llms-full.txt)
 *   scripts/geo-sjednot-jsonld.mjs  sjednocení autora a vydavatele v JSON-LD
 *
 * Bez závislostí, jen Node. Nic tady nezapisuje na disk.
 *
 * ⛔ KANONICKÉ @id: Martin (Person) a značka (Organization) jsou na celém webu
 *    definované JEDNOU, v JSON-LD homepage (`index.html`). Ostatní stránky na ně
 *    jen odkazují přes { "@id": ... }. Kdo přidává JSON-LD, nekopíruje do něj
 *    jméno, telefon ani profily: AI asistent pak vidí dvě osoby s různými údaji.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ORIGIN = 'https://martinbarna.cz';

export const ID = {
  martin: `${ORIGIN}/#martin`,
  org: `${ORIGIN}/#org`,
  web: `${ORIGIN}/#website`,
};
export const REF = {
  martin: { '@id': ID.martin },
  org: { '@id': ID.org },
  web: { '@id': ID.web },
};

/** Stránka „o mně": sekce na homepage. Na ni vede viditelný odkaz autora u článků. */
export const O_MNE = '/#omne';

/**
 * Co se na Wedos NENASAZUJE (viz `exclude` v .github/workflows/deploy-wedos.yml)
 * plus lokální složky. Do těchhle cest kontrola ani generátor nesahají.
 */
export const NENASAZOVANE = [
  '.git', '.github', 'node_modules', 'supabase',
  'clanky-fronta', '_import', '_zaloha', '_zdroje', 'Logo-rebrand', 'scripts',
  'akademie/_ai', 'akademie/_pdf', 'akademie/_supabase', 'akademie/_videokurz',
];

/** Čisté URL bez .html (viz .htaccess a scripts/generuj-sitemap.mjs). */
const CISTE_URL = {
  'videokurz.html': '/videokurz',
  'treninky.html': '/treninky',
};

export function toPosix(p) {
  return p.split(path.sep).join('/');
}

export function jeNenasazovane(rel) {
  return NENASAZOVANE.some((p) => rel === p || rel.startsWith(p + '/'));
}

/** Všechna nasazovaná HTML v repu (relativní POSIX cesty, seřazené). */
export function najdiHtml(koren = ROOT) {
  const out = [];
  const chod = (dir) => {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, d.name);
      const rel = toPosix(path.relative(koren, abs));
      if (jeNenasazovane(rel)) continue;
      if (d.isDirectory()) chod(abs);
      else if (d.isFile() && /\.html?$/i.test(d.name)) out.push(rel);
    }
  };
  chod(koren);
  return out.sort();
}

export function souborNaUrl(rel) {
  if (rel === 'index.html') return `${ORIGIN}/`;
  if (CISTE_URL[rel]) return ORIGIN + CISTE_URL[rel];
  if (rel.endsWith('/index.html')) return `${ORIGIN}/${rel.slice(0, -'index.html'.length)}`;
  return `${ORIGIN}/${rel}`;
}

export function urlNaSoubor(url) {
  if (!url.startsWith(ORIGIN)) return null;
  let p = url.slice(ORIGIN.length).replace(/[?#].*$/, '');
  if (p === '' || p === '/') return 'index.html';
  p = p.replace(/^\//, '');
  for (const [rel, cista] of Object.entries(CISTE_URL)) if ('/' + p === cista) return rel;
  if (p.endsWith('/')) return p + 'index.html';
  if (/\.[a-z0-9]+$/i.test(p)) return p;
  return p + '/index.html';
}

export function nactiHtml(rel, koren = ROOT) {
  return fs.readFileSync(path.join(koren, rel), 'utf8');
}

export function maNoindex(html) {
  const head = html.slice(0, 20000);
  for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
    if (!/\bname\s*=\s*["']robots["']/i.test(tag)) continue;
    const c = (tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
    if (/noindex|none/i.test(c)) return true;
  }
  return false;
}

export function canonical(html) {
  const tag = (html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i) || [])[0];
  return tag ? (tag.match(/href=["']([^"']+)["']/i) || [])[1] || null : null;
}

/* ------------------------------------------------------------------ JSON-LD */

const LD_RE = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

/** Vrátí bloky JSON-LD: { raw, start, end, data | null, chyba | null }. */
export function jsonLdBloky(html) {
  const out = [];
  for (const m of html.matchAll(LD_RE)) {
    const raw = m[1];
    let data = null;
    let chyba = null;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      chyba = String(e.message || e);
    }
    out.push({ raw, start: m.index, end: m.index + m[0].length, data, chyba });
  }
  return out;
}

/** Projde všechny objekty v JSON-LD (včetně @graph a vnořených). */
export function kazdyUzel(data, fn, cesta = '$') {
  if (Array.isArray(data)) {
    data.forEach((x, i) => kazdyUzel(x, fn, `${cesta}[${i}]`));
    return;
  }
  if (!data || typeof data !== 'object') return;
  fn(data, cesta);
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object') kazdyUzel(v, fn, `${cesta}.${k}`);
  }
}

export function typy(uzel) {
  const t = uzel && uzel['@type'];
  return t == null ? [] : [].concat(t);
}

/* ------------------------------------------------------------ viditelný text */

const ENT = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', hellip: '…', laquo: '«', raquo: '»', bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', times: '×', middot: '·', copy: '©' };

export function dekodujEntity(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, k) => {
    if (k[0] === '#') {
      const n = k[1] === 'x' || k[1] === 'X' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[k.toLowerCase()] ?? m;
  });
}

export function normalizujMezery(s) {
  return s.replace(/[\s   ]+/g, ' ').trim();
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const SUROVE = new Set(['script', 'style', 'textarea', 'title']);

/**
 * Minimalistický tokenizer HTML: vrací pole { typ: 'text'|'otevreni'|'zavreni', ... }.
 * Na statický web s ručně psaným HTML stačí, plný parser nepotřebujeme.
 */
export function tokenizuj(html) {
  const out = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) {
      out.push({ typ: 'text', text: html.slice(i) });
      break;
    }
    if (lt > i) out.push({ typ: 'text', text: html.slice(i, lt) });
    if (html.startsWith('<!--', lt)) {
      const e = html.indexOf('-->', lt + 4);
      i = e < 0 ? html.length : e + 3;
      continue;
    }
    if (html[lt + 1] === '!' || html[lt + 1] === '?') {
      const e = html.indexOf('>', lt);
      i = e < 0 ? html.length : e + 1;
      continue;
    }
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/.exec(html.slice(lt, lt + 20000));
    if (!m) {
      out.push({ typ: 'text', text: '<' });
      i = lt + 1;
      continue;
    }
    const jmeno = m[2].toLowerCase();
    i = lt + m[0].length;
    if (m[1]) {
      out.push({ typ: 'zavreni', jmeno });
      continue;
    }
    const attrs = {};
    for (const a of m[3].matchAll(/([^\s=/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g)) {
      let v = a[2] ?? '';
      if (/^["']/.test(v)) v = v.slice(1, -1);
      attrs[a[1].toLowerCase()] = dekodujEntity(v);
    }
    out.push({ typ: 'otevreni', jmeno, attrs, samo: VOID.has(jmeno) || /\/\s*$/.test(m[3]) });
    if (SUROVE.has(jmeno)) {
      const konec = html.toLowerCase().indexOf(`</${jmeno}`, i);
      const obsah = html.slice(i, konec < 0 ? html.length : konec);
      out.push({ typ: 'surove', jmeno, text: obsah });
      i = konec < 0 ? html.length : konec;
    }
  }
  return out;
}

/** Elementy, které nejsou viditelný obsah stránky v žádném případě. */
const VZDY_PRYC = new Set(['script', 'style', 'noscript', 'template', 'svg', 'head', 'title', 'iframe', 'canvas', 'textarea', 'select']);

function jeSkryty(attrs) {
  if ('hidden' in attrs) return true;
  if (attrs['aria-hidden'] === 'true') return true;
  return /display\s*:\s*none/i.test(attrs.style || '');
}

/**
 * Viditelný text stránky (bez skriptů, stylů, skrytých prvků a hlavičky <head>).
 * Text je normalizovaný na jednoduché mezery. Slouží ke kontrole, že cena nebo
 * odpověď v JSON-LD na stránce opravdu stojí.
 *
 * `vynechej(jmeno, attrs)` může odfiltrovat další prvky (menu, patička).
 */
export function viditelnyText(html, vynechej = null) {
  return normalizujMezery(dekodujEntity(textZTokenu(tokenizuj(html), vynechej, false)));
}

/** Blokové prvky: kolem nich se v čistém textu dělá konec řádku. */
const BLOK = new Set(['p', 'div', 'section', 'article', 'header', 'main', 'aside', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'figure', 'figcaption', 'details', 'summary', 'dl', 'dt', 'dd', 'br', 'hr', 'nav', 'footer', 'form', 'label']);

/**
 * Jádro převodu na text. S `strukturou=true` vrací text s konci řádků,
 * nadpisy jako „## " a položky seznamu jako „- " (pro llms-full.txt).
 */
const INLINE = new Set(['span', 'a', 'strong', 'b', 'em', 'i', 'small', 'time', 'code', 'sup', 'sub', 'mark']);

export function textZTokenu(tokeny, vynechej, struktura) {
  let out = '';
  const zasobnik = [];
  let pryc = 0; // hloubka uvnitř vynechaného prvku
  let predchozi = null; // předchozí token (kvůli mezeře mezi sousedními štítky)
  const odstavec = () => {
    if (!struktura) out += ' ';
    else if (!/\n\n$/.test(out)) out = out.replace(/[ \t]+$/, '') + (out.endsWith('\n') ? '\n' : '\n\n');
  };
  for (const t of tokeny) {
    if (t.typ === 'surove') continue;
    const minuly = predchozi;
    predchozi = t;
    if (minuly && t.typ === 'text' && !t.text.trim()) predchozi = minuly; // prázdný text mezi štítky nevadí
    if (t.typ === 'otevreni') {
      const ven = VZDY_PRYC.has(t.jmeno) || jeSkryty(t.attrs) || (vynechej && vynechej(t.jmeno, t.attrs));
      if (t.samo) {
        if (pryc) continue;
        if (t.jmeno === 'br') out += struktura ? '\n' : ' ';
        else if (t.jmeno === 'img' && struktura && t.attrs.alt && /\binfografik/i.test(t.attrs.class || '')) {
          out += t.attrs.alt;
        }
        continue;
      }
      zasobnik.push({ jmeno: t.jmeno, ven });
      if (pryc || ven) {
        pryc += 1;
        continue;
      }
      if (BLOK.has(t.jmeno)) odstavec();
      if (struktura) {
        // „nahlas<span class=vip-tag>VIP" nebo „</span><span>" by se slepilo do jednoho slova.
        const stitek = INLINE.has(t.jmeno) && /\b(tag|badge|pill|chip|label|vip-tag)\b|-tag\b/i.test(t.attrs.class || '');
        const soused = INLINE.has(t.jmeno) && minuly?.typ === 'zavreni' && INLINE.has(minuly.jmeno);
        if ((stitek || soused) && /\S$/.test(out)) out += ' ';
        const h = /^h([1-6])$/.exec(t.jmeno);
        if (h) out += '#'.repeat(Math.min(6, Math.max(3, Number(h[1]) + 1))) + ' ';
        else if (t.jmeno === 'li') out += '- ';
      }
      continue;
    }
    if (t.typ === 'zavreni') {
      // Najdi odpovídající otevírací tag (tolerance k neuzavřeným <p>, <li>).
      let k = zasobnik.length - 1;
      while (k >= 0 && zasobnik[k].jmeno !== t.jmeno) k -= 1;
      if (k < 0) continue;
      while (zasobnik.length > k) {
        const z = zasobnik.pop();
        if (pryc) {
          pryc -= 1;
          continue;
        }
        if (BLOK.has(z.jmeno)) odstavec();
      }
      continue;
    }
    if (!pryc) out += struktura ? t.text.replace(/[\s ]+/g, ' ') : t.text;
  }
  return out;
}

/** Datum ve tvaru 2026-08-26 → „26. 8. 2026" (jak se píše na webu). */
export function ceskeDatum(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return null;
  return `${Number(m[3])}. ${Number(m[2])}. ${m[1]}`;
}

/** Cena „6450" → varianty, jak může stát ve viditelném textu („6 450", „6450"). */
export function variantyCeny(cena) {
  const n = Number(String(cena).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return [];
  const cele = Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
  const sMezerou = cele.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return [...new Set([sMezerou, cele])];
}
