#!/usr/bin/env node
/**
 * GEO kontrola: aby AI asistenti (ChatGPT, Perplexity, Claude, Gemini, AI Overviews)
 * četli o Martinovi, appce Tvůj Coach, videokurzu, Academy, koučinku a konzultacích
 * správná data a citovali martinbarna.cz.
 *
 * Použití:  node scripts/geo-kontrola.mjs            (exit 1 = aspoň jedna chyba)
 *           node scripts/geo-kontrola.mjs --vse      (vypíše i všechna místa, ne jen 15 na kód)
 *
 * Bez závislostí. Čte jen repo, nic nezapisuje.
 *
 * CO HLÍDÁ (kód chyby v hranatých závorkách):
 *   [JSONLD_NEVALIDNI]   blok JSON-LD, který neprojde JSON.parse (všechna nasazovaná HTML)
 *   [BEZ_JSONLD]         indexovaná stránka bez JSON-LD
 *   [PERSON_JINE_ID]     Person s @id jiným než https://martinbarna.cz/#martin
 *   [PERSON_KOPIE]       Martin Barna jako Person bez @id (kopie místo odkazu)
 *   [ORG_JINE_ID] [ORG_KOPIE]  totéž pro Organization (https://martinbarna.cz/#org)
 *   [KANON_MIMO_DOMOVA]  plná definice entity s @id „URL#něco" jinde než na stránce URL
 *                        (#martin, #org, #website patří jen do index.html, jinde jen odkaz)
 *   [KANON_CHYBI]        homepage nedefinuje #martin, #org nebo #website
 *   [ODKAZ_NEDEFINOVAN]  odkaz na @id „https://martinbarna.cz/…#…", který na své stránce není definovaný
 *   [CENA_MIMO_TEXT]     cena v JSON-LD, která není ve viditelném textu stránky
 *   [HODNOCENI_MIMO_TEXT]  hodnocení nebo recenze v JSON-LD, které na stránce doslova nejsou
 *   [FAQ_NESEDI]         otázka nebo odpověď FAQPage, která na stránce není slovo od slova
 *   [CLANEK_*]           článek blogu bez BlogPosting, autora, data nebo viditelného autora a data
 *   [DROBECKY]           stránka s drobečkovou navigací bez BreadcrumbList, nebo nesedící poslední položka
 *   [CISLO_V_JSONLD]     počet potravin/receptů napsaný v JSON-LD (sync-cisla-web.mjs ho neopraví)
 *   [DLOUHA_POMLCKA]     znak U+2014 v JSON-LD nebo v llms.txt / llms-full.txt
 *   [SITEMAP_*]          indexovaná stránka chybí v sitemap.xml, nebo je v ní noindex / neexistující soubor
 *   [LLMS_*]             llms.txt odkazuje na neexistující stránku nebo neodkazuje na llms-full.txt
 *   (varování) LLMS_FULL_ZASTARALY  llms-full.txt neodpovídá aktuálnímu HTML (pusť generátor)
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ID,
  O_MNE,
  ORIGIN,
  ROOT,
  canonical,
  jsonLdBloky,
  kazdyUzel,
  maNoindex,
  nactiHtml,
  najdiHtml,
  normalizujMezery,
  souborNaUrl,
  typy,
  urlNaSoubor,
  variantyCeny,
  viditelnyText,
} from './geo-spolecne.mjs';
import { sestavLlmsFull, LLMS_FULL } from './generuj-llms-full.mjs';

/**
 * Zdůvodněné výjimky. Každá musí mít důvod, jinak sem nepatří.
 * Kdo sem něco přidává, napíše proč, a ideálně i do reportu majiteli.
 */
export const VYJIMKY = {
  BEZ_JSONLD: {
    'obchodni-podminky/index.html': 'právní stránka, zadání GEO 9. 10. 2026 zakazuje na ni sahat',
    'odstoupeni/index.html': 'právní stránka, zadání GEO 9. 10. 2026 zakazuje na ni sahat',
    'zasady-ochrany-osobnich-udaju/index.html': 'právní stránka, zadání GEO 9. 10. 2026 zakazuje na ni sahat',
  },
  MIMO_SITEMAP: {
    '404.html': 'chybová stránka, server ji vrací se stavem 404, do sitemapy nepatří',
    'akademie/overit/index.html': 'generuj-sitemap.mjs ji záměrně řadí mezi interní (ověření certifikátu); nemá noindex, k rozhodnutí majitele',
  },
};

const ORG_TYPY = new Set(['Organization', 'ProfessionalService', 'LocalBusiness', 'OnlineBusiness', 'Corporation', 'EducationalOrganization']);
const CLANEK_TYPY = new Set(['Article', 'BlogPosting', 'NewsArticle']);
/** Mimo domovskou stránku smí uzel s @id nést jen tyhle klíče (doplnění, ne kopie údajů). */
const POVOLENE_MIMO_DOMOVA = new Set(['@context', '@id', '@type', 'review', 'aggregateRating']);
const jeDefinice = (u) => Object.keys(u).some((k) => !POVOLENE_MIMO_DOMOVA.has(k));
/** Stránka, na které je entita s @id „URL#fragment" doma (= soubor té URL). */
const domov = (id) => urlNaSoubor(id.split('#')[0]);
const DNES = new Date().toISOString().slice(0, 10);

const chyby = [];
const varovani = [];
const chyba = (kod, kde, co) => chyby.push({ kod, kde, co });
const varuj = (kod, kde, co) => varovani.push({ kod, kde, co });

function obsahujeCislo(text, hodnota) {
  const esc = hodnota.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![0-9])(?<![0-9] )${esc}(?! ?[0-9])`).test(text);
}

function jeClanekBlogu(rel) {
  return /^clanky\/[^/]+\.html$/.test(rel) && rel !== 'clanky/index.html';
}

const ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/;

/* ------------------------------------------------------------- 1. stránky */

const vsechna = najdiHtml();
const stranky = vsechna.map((rel) => {
  const html = nactiHtml(rel);
  return { rel, html, noindex: maNoindex(html), bloky: jsonLdBloky(html) };
});
const indexovane = stranky.filter((s) => !s.noindex && !VYJIMKY.MIMO_SITEMAP[s.rel]);

// Kde je která entita s @id definovaná (id → množina stránek).
const definice = new Map();
for (const s of stranky) {
  for (const b of s.bloky) {
    kazdyUzel(b.data, (u) => {
      if (typeof u['@id'] !== 'string' || !jeDefinice(u)) return;
      if (!definice.has(u['@id'])) definice.set(u['@id'], new Set());
      definice.get(u['@id']).add(s.rel);
    });
  }
}
for (const [klic, id] of Object.entries(ID)) {
  if (!definice.get(id)?.has('index.html')) chyba('KANON_CHYBI', 'index.html', `chybí definice ${klic} (${id})`);
}

for (const s of stranky) {
  const { rel, html, bloky } = s;
  const jeIndexovana = indexovane.includes(s);
  let text = null;
  const vid = () => (text ??= viditelnyText(html));

  for (const b of bloky) {
    if (b.chyba) chyba('JSONLD_NEVALIDNI', rel, b.chyba);
    if (b.raw.includes('\u2014')) chyba('DLOUHA_POMLCKA', rel, 'JSON-LD obsahuje znak U+2014');
  }
  if (jeIndexovana && bloky.length === 0 && !VYJIMKY.BEZ_JSONLD[rel]) {
    chyba('BEZ_JSONLD', rel, 'indexovaná stránka nemá žádné JSON-LD');
  }

  const data = bloky.filter((b) => b.data).map((b) => b.data);
  const odkazy = [];
  const clanky = [];
  const drobecky = [];
  const faq = [];

  for (const d of data) {
    kazdyUzel(d, (u, cesta) => {
      const t = typy(u);
      const id = u['@id'];
      const fragment = typeof id === 'string' && id.startsWith(ORIGIN) && id.includes('#');
      if (fragment) odkazy.push(id);
      if (fragment && jeDefinice(u) && domov(id) !== rel) {
        chyba('KANON_MIMO_DOMOVA', rel, `${cesta}: ${id} s vlastními údaji (${Object.keys(u).filter((k) => !POVOLENE_MIMO_DOMOVA.has(k)).join(', ')}); definice patří jen do ${domov(id)}, jinde jen odkaz`);
      }

      if (t.includes('Person')) {
        if (id && id !== ID.martin) chyba('PERSON_JINE_ID', rel, `${cesta}: Person s @id ${id}`);
        if (!id && /Martin Barna/i.test(u.name || '')) chyba('PERSON_KOPIE', rel, `${cesta}: Martin jako kopie bez @id`);
      }
      if (t.some((x) => ORG_TYPY.has(x))) {
        if (id && id.startsWith(ORIGIN) && id !== ID.org) chyba('ORG_JINE_ID', rel, `${cesta}: organizace s @id ${id}`);
        if (!id && /Martin Barna/i.test(u.name || '')) chyba('ORG_KOPIE', rel, `${cesta}: organizace jako kopie bez @id`);
      }

      if (t.some((x) => ['Offer', 'AggregateOffer', 'PriceSpecification', 'UnitPriceSpecification'].includes(x))) {
        for (const k of ['price', 'lowPrice', 'highPrice']) {
          if (u[k] == null) continue;
          const v = String(u[k]);
          const ok = Number(v) === 0
            ? /zdarma|\b0 Kč/i.test(vid())
            : variantyCeny(v).some((x) => obsahujeCislo(vid(), x));
          if (!ok) chyba('CENA_MIMO_TEXT', rel, `${cesta}.${k} = ${v} (${u.name || u['@type']}) není ve viditelném textu`);
        }
      }
      if (t.includes('AggregateRating')) {
        const pocet = u.reviewCount ?? u.ratingCount;
        if (pocet != null && !obsahujeCislo(vid(), String(pocet))) {
          chyba('HODNOCENI_MIMO_TEXT', rel, `${cesta}: počet ${pocet} není ve viditelném textu`);
        }
        const hodnota = String(u.ratingValue ?? '');
        if (hodnota && ![hodnota, hodnota.replace('.', ','), String(Number(hodnota))].some((x) => vid().includes(x))) {
          chyba('HODNOCENI_MIMO_TEXT', rel, `${cesta}: hodnota ${hodnota} není ve viditelném textu`);
        }
      }
      if (t.includes('Review')) {
        const telo = normalizujMezery(String(u.reviewBody || ''));
        if (telo && !vid().includes(telo)) chyba('HODNOCENI_MIMO_TEXT', rel, `${cesta}: text recenze není na stránce doslova`);
        const autor = u.author && u.author.name;
        if (autor && !vid().includes(autor)) chyba('HODNOCENI_MIMO_TEXT', rel, `${cesta}: autor recenze „${autor}" není na stránce`);
      }

      if (t.some((x) => CLANEK_TYPY.has(x)) && /^\$(\[\d+\])?(\.@graph\[\d+\])?$/.test(cesta)) clanky.push(u);
      if (t.includes('BreadcrumbList')) drobecky.push(u);
      if (t.includes('FAQPage')) faq.push(u);
    });
  }

  for (const id of odkazy) {
    if (!definice.get(id)?.has(domov(id))) {
      chyba('ODKAZ_NEDEFINOVAN', rel, `odkaz na ${id}, ale ${domov(id)} ho nedefinuje`);
    }
  }

  if (/<!--\s*cislo:/.test(html)) {
    for (const d of data) {
      const m = JSON.stringify(d).match(/\d[\d  ]*\s*(potravin|recept)/i);
      if (m) chyba('CISLO_V_JSONLD', rel, `„${m[0]}" v JSON-LD: deploy přepisuje číslo jen v HTML, tady by zůstalo staré`);
    }
  }

  // FAQ: otázka i odpověď musí na stránce stát slovo od slova.
  for (const f of faq) {
    for (const q of [].concat(f.mainEntity || [])) {
      const otazka = normalizujMezery(String(q.name || ''));
      const odpoved = normalizujMezery(String(q.acceptedAnswer?.text || ''));
      if (!otazka || !vid().includes(otazka)) chyba('FAQ_NESEDI', rel, `otázka „${otazka.slice(0, 70)}" není na stránce doslova`);
      if (!odpoved || !vid().includes(odpoved)) chyba('FAQ_NESEDI', rel, `odpověď na „${otazka.slice(0, 50)}" není na stránce doslova`);
    }
  }

  // Drobečková navigace.
  const maViditelneDrobecky = /<nav\b[^>]*(class=["'][^"']*\bcrumbs?\b|aria-label=["'][^"']*drobe)/i.test(html);
  const kanon = canonical(html);
  if (jeIndexovana && maViditelneDrobecky && drobecky.length === 0) chyba('DROBECKY', rel, 'má drobečkovou navigaci, ale chybí BreadcrumbList');
  for (const d of drobecky) {
    const polozky = [].concat(d.itemListElement || []);
    polozky.forEach((p, i) => {
      if (p.position !== i + 1) chyba('DROBECKY', rel, `položka ${i + 1} má position ${p.position}`);
      const url = typeof p.item === 'string' ? p.item : p.item?.['@id'];
      if (!p.name || !url) chyba('DROBECKY', rel, `položka ${i + 1} bez name nebo item`);
      else if (url.startsWith(ORIGIN) && !fs.existsSync(path.join(ROOT, urlNaSoubor(url) || '-'))) {
        chyba('DROBECKY', rel, `položka ${i + 1} vede na neexistující ${url}`);
      }
    });
    const posledni = polozky.at(-1);
    const urlPosl = typeof posledni?.item === 'string' ? posledni.item : posledni?.item?.['@id'];
    if (kanon && urlPosl && urlPosl !== kanon) chyba('DROBECKY', rel, `poslední položka ${urlPosl} ≠ canonical ${kanon}`);
  }

  // Články blogu: BlogPosting, autor, data, viditelný autor s odkazem a viditelné datum.
  if (jeClanekBlogu(rel) && jeIndexovana && !clanky.length) chyba('CLANEK_BEZ_TYPU', rel, 'článek bez BlogPosting');
  for (const c of clanky) {
    const autor = [].concat(c.author || [])[0];
    if (!autor || autor['@id'] !== ID.martin) chyba('CLANEK_AUTOR', rel, 'author není odkaz na #martin');
    if (!c.publisher || c.publisher['@id'] !== ID.org) chyba('CLANEK_VYDAVATEL', rel, 'publisher není odkaz na #org');
    if (c.inLanguage !== 'cs') chyba('CLANEK_JAZYK', rel, `inLanguage je ${c.inLanguage}, čekám cs`);
    const meo = c.mainEntityOfPage && (c.mainEntityOfPage['@id'] || c.mainEntityOfPage);
    if (kanon && meo !== kanon) chyba('CLANEK_URL', rel, `mainEntityOfPage ${meo} ≠ canonical ${kanon}`);
    if (!c.headline) chyba('CLANEK_HEADLINE', rel, 'chybí headline');
    if (!c.image) varuj('CLANEK_OBRAZEK', rel, 'chybí image');
    for (const k of ['datePublished', 'dateModified']) {
      if (c[k] == null) continue;
      if (!ISO_DATUM.test(c[k])) chyba('CLANEK_DATUM', rel, `${k} „${c[k]}" není ve tvaru RRRR-MM-DD`);
      else if (c[k] > DNES) chyba('CLANEK_DATUM', rel, `${k} ${c[k]} je v budoucnu`);
    }
    if (c.datePublished && c.dateModified && c.dateModified < c.datePublished) chyba('CLANEK_DATUM', rel, 'dateModified je před datePublished');
    if (jeClanekBlogu(rel)) {
      if (!c.datePublished || !c.dateModified) chyba('CLANEK_DATUM', rel, 'článek blogu bez datePublished nebo dateModified');
      // Viditelný autor s odkazem na stránku o Martinovi.
      const odkazAutora = new RegExp(`<a\\b[^>]*href=["'][^"']*${O_MNE.replace('/', '\\/').replace('#', '#')}["'][^>]*>\\s*Martin Barna\\s*</a>`, 'i');
      if (!odkazAutora.test(html)) chyba('CLANEK_VIDITELNY_AUTOR', rel, `chybí viditelný odkaz „Martin Barna" na ${O_MNE}`);
      if (c.dateModified && !new RegExp(`<time\\b[^>]*datetime=["']${c.dateModified}["']`).test(html)) {
        chyba('CLANEK_VIDITELNE_DATUM', rel, `chybí viditelné <time datetime="${c.dateModified}">`);
      }
    }
  }
}

/* -------------------------------------------------------------- 2. sitemap */

const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const zaznamy = [...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]*)<\/lastmod>)?/g)]
  .map((m) => ({ loc: m[1].trim(), lastmod: (m[2] || '').trim() }));
const vSitemape = new Map();
for (const z of zaznamy) {
  if (vSitemape.has(z.loc)) chyba('SITEMAP_DUPLICITA', 'sitemap.xml', z.loc);
  vSitemape.set(z.loc, z);
  if (!/^\d{4}-\d{2}-\d{2}/.test(z.lastmod)) chyba('SITEMAP_LASTMOD', 'sitemap.xml', `${z.loc}: lastmod „${z.lastmod}"`);
  else if (z.lastmod.slice(0, 10) > DNES) chyba('SITEMAP_LASTMOD', 'sitemap.xml', `${z.loc}: lastmod ${z.lastmod} v budoucnu`);
  const rel = urlNaSoubor(z.loc);
  if (!rel || !fs.existsSync(path.join(ROOT, rel))) {
    chyba('SITEMAP_NEEXISTUJE', 'sitemap.xml', z.loc);
    continue;
  }
  if (/\.html?$/.test(rel)) {
    const s = stranky.find((x) => x.rel === rel);
    if (!s) chyba('SITEMAP_NENASAZUJE_SE', 'sitemap.xml', `${z.loc} vede na soubor, který se nenasazuje`);
    else if (s.noindex) chyba('SITEMAP_NOINDEX', 'sitemap.xml', `${z.loc} má noindex`);
    const kanon = s && canonical(s.html);
    if (kanon && kanon !== z.loc) chyba('SITEMAP_CANONICAL', 'sitemap.xml', `${z.loc} má canonical ${kanon}`);
  }
}
for (const s of indexovane) {
  const url = souborNaUrl(s.rel);
  if (!vSitemape.has(url)) chyba('SITEMAP_CHYBI', s.rel, `${url} není v sitemap.xml`);
}

/* ------------------------------------------------------------ 3. llms.txt */

const llms = fs.readFileSync(path.join(ROOT, 'llms.txt'), 'utf8');
if (llms.includes('\u2014')) chyba('DLOUHA_POMLCKA', 'llms.txt', 'obsahuje znak U+2014');
if (!llms.includes(`${ORIGIN}/${LLMS_FULL}`)) chyba('LLMS_BEZ_FULL', 'llms.txt', `neodkazuje na ${ORIGIN}/${LLMS_FULL}`);
for (const m of llms.matchAll(/\]\((https:\/\/martinbarna\.cz[^)\s]*)\)/g)) {
  const rel = urlNaSoubor(m[1]);
  if (!rel || !fs.existsSync(path.join(ROOT, rel))) chyba('LLMS_ODKAZ', 'llms.txt', `${m[1]} neexistuje`);
  else if (/\.html?$/.test(rel) && stranky.find((x) => x.rel === rel)?.noindex) chyba('LLMS_ODKAZ', 'llms.txt', `${m[1]} má noindex`);
}
const fullCesta = path.join(ROOT, LLMS_FULL);
if (!fs.existsSync(fullCesta)) chyba('LLMS_FULL_CHYBI', LLMS_FULL, 'soubor neexistuje, pusť node scripts/generuj-llms-full.mjs');
else {
  const full = fs.readFileSync(fullCesta, 'utf8');
  if (full.includes('\u2014')) chyba('DLOUHA_POMLCKA', LLMS_FULL, 'obsahuje znak U+2014');
  if (full !== sestavLlmsFull().text) varuj('LLMS_FULL_ZASTARALY', LLMS_FULL, 'neodpovídá aktuálnímu HTML, pusť node scripts/generuj-llms-full.mjs');
}

/* --------------------------------------------------------------- 4. výpis */

const vse = process.argv.includes('--vse');
function vypis(seznam, nadpis) {
  const podle = new Map();
  for (const x of seznam) {
    if (!podle.has(x.kod)) podle.set(x.kod, []);
    podle.get(x.kod).push(x);
  }
  console.log(`\n${nadpis}: ${seznam.length}`);
  for (const [kod, xs] of [...podle].sort()) {
    console.log(`  [${kod}] ${xs.length}`);
    for (const x of vse ? xs : xs.slice(0, 15)) console.log(`     ${x.kde}: ${x.co}`);
    if (!vse && xs.length > 15) console.log(`     … a dalších ${xs.length - 15} (--vse ukáže všechny)`);
  }
}

const bloku = stranky.reduce((n, s) => n + s.bloky.length, 0);
console.log('GEO kontrola martinbarna.cz');
console.log(`  nasazovaných HTML: ${stranky.length}, z toho indexovaných: ${indexovane.length}`);
console.log(`  bloků JSON-LD: ${bloku}, URL v sitemap.xml: ${zaznamy.length}`);
console.log('  zdůvodněné výjimky:');
for (const [kod, v] of Object.entries(VYJIMKY)) for (const [rel, proc] of Object.entries(v)) console.log(`     [${kod}] ${rel}: ${proc}`);
vypis(varovani, 'VAROVÁNÍ');
vypis(chyby, 'CHYBY');
console.log(chyby.length ? `\nVÝSLEDEK: ${chyby.length} chyb` : '\nVÝSLEDEK: 0 chyb');
process.exit(chyby.length ? 1 : 0);
