#!/usr/bin/env node
/**
 * Vygeneruje `llms-full.txt`: plný text hlavních stránek a všech článků blogu
 * pro AI asistenty (ChatGPT, Perplexity, Claude, Gemini). Krátký rozcestník je
 * `llms.txt` (píše se ručně), tenhle soubor je jeho dlouhá příloha.
 *
 * Použití:  node scripts/generuj-llms-full.mjs          (zapíše llms-full.txt)
 *           node scripts/generuj-llms-full.mjs --dry    (jen vypíše statistiku)
 *
 * Bez závislostí. Čte HTML z repa, takže pusť ho po každé změně článku nebo
 * prodejní stránky. `scripts/geo-kontrola.mjs` hlásí varování, když je soubor
 * zastaralý.
 *
 * ⚠️ ČÍSLA: deploy přepisuje počty potravin a receptů v HTML až na runneru
 *    (scripts/sync-cisla-web.mjs). Tenhle soubor je ze stavu v gitu, takže
 *    v něm zůstává poslední ručně ověřené číslo: pravdivé, jen může být starší.
 *
 * Co se do souboru NEDÁVÁ a proč:
 *   - menu, patička, formuláře, tlačítka, skryté prvky, prodejní CTA boxy v článcích
 *   - /reference/ (70 recenzí se jmény klientů; AI stačí shrnutí v llms.txt)
 *   - ⛔ RECENZE A PROMĚNY KLIENTŮ NIKDE (revize R1, 9. 10. 2026): v souboru nesmí být
 *     jméno klienta. Bloky se poznají podle třídy (RECENZE_TRIDA) i podle obsahu
 *     (hvězdičky + citace, figure s blockquote), protože každá stránka je má jinak.
 *     Pojistka: scripts/geo-kontrola.mjs hlásí LLMS_JMENO_KLIENTA.
 *   - interaktivní nástroje a kvíz (bez JS v nich není text, jen formulář)
 *   - právní stránky, admin, klientská sekce, placené lekce Academy, noindex
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ORIGIN,
  O_MNE,
  ROOT,
  dekodujEntity,
  jsonLdBloky,
  kazdyUzel,
  maNoindex,
  nactiHtml,
  normalizujMezery,
  souborNaUrl,
  textZTokenu,
  tokenizuj,
  typy,
} from './geo-spolecne.mjs';

export const LLMS_FULL = 'llms-full.txt';

/** Hlavní stránky v pořadí, v jakém je má AI číst. Články se přidají za ně. */
export const HLAVNI = [
  ['index.html', 'O Martinovi a co nabízí'],
  ['tvuj-coach/index.html', 'Produkty'],
  ['videokurz.html', 'Produkty'],
  ['akademie/index.html', 'Produkty'],
  ['koucing/index.html', 'Produkty'],
  ['konzultace/index.html', 'Produkty'],
  ['recepty-a-odpovedi/index.html', 'Produkty'],
  ['pro-vas/index.html', 'Produkty'],
  ['treninky.html', 'Další služby'],
  ['prednasky/index.html', 'Další služby'],
  ['poukaz/index.html', 'Další služby'],
  ['pro-trenery/index.html', 'Zdarma'],
  ['makro-plan/index.html', 'Zdarma'],
  ['forma-zpet/index.html', 'Zdarma'],
  ['nastroje-zdarma/index.html', 'Zdarma'],
  ['kalkulacka-kalorii-a-makrozivin/index.html', 'Zdarma'],
  ['jak-zhubnout/index.html', 'Průvodci'],
  ['jak-nabrat-svaly/index.html', 'Průvodci'],
  ['myty/index.html', 'Průvodci'],
  ['akademie/studium/m1-l1/index.html', 'Ukázkové lekce Barna Academy (zdarma)'],
  ['akademie/studium/m1-l2/index.html', 'Ukázkové lekce Barna Academy (zdarma)'],
  ['akademie/studium/m1-l3/index.html', 'Ukázkové lekce Barna Academy (zdarma)'],
  ['akademie/studium/m2-l1/index.html', 'Ukázkové lekce Barna Academy (zdarma)'],
  ['akademie/studium/m3-l1/index.html', 'Ukázkové lekce Barna Academy (zdarma)'],
  ['akademie/studium/m6-l1/index.html', 'Ukázkové lekce Barna Academy (zdarma)'],
];

/** Třídy a id prvků, které nejsou obsah (menu, lišty, modaly, prodejní boxy v článku). */
const PRYC_TRIDA = /\b(nav|navlinks|nav-burger|mb-drawer|fab-wa|wa-modal|modal|cookie\w*|skip-link|cta-bar|ctabar|sticky-cta|author-box|cta-box|crumbs|share|toc-toggle|upsell\w*)\b/i;
const PRYC_ID = /^(ctaBar|waModal|quiz|quizBar|quizResult|quizRestart|formDiky|kontaktForm|cookieBar|cookie\w*)$/;
const PRYC_TAG = new Set(['nav', 'footer', 'form', 'button', 'dialog', 'input', 'label', 'select', 'option', 'h1']);

/** Recenze, reference a proměny klientů (obsahují jména a citace klientů). */
const RECENZE_TRIDA = /\b(rev|revs|review|reviews|ref|testimonials?|recenz\w*|story|stories|story-\w+|promen\w*|pcard|pgrid|proof|quotes?)\b/i;
const KARTA = new Set(['div', 'figure', 'li', 'blockquote', 'article', 'aside']);

/**
 * Vyřadí z tokenů recenzní bloky: podle třídy, `figure` s `blockquote` a nejmenší
 * kartu, která má hvězdičky i citaci („…"). Vrací nové pole tokenů.
 */
export function bezRecenzi(tokeny) {
  // Párování otevíracích a zavíracích tagů (tolerantně jako textZTokenu).
  const konec = new Array(tokeny.length).fill(-1);
  const zas = [];
  tokeny.forEach((t, i) => {
    if (t.typ === 'otevreni' && !t.samo) zas.push(i);
    else if (t.typ === 'zavreni') {
      let k = zas.length - 1;
      while (k >= 0 && tokeny[zas[k]].jmeno !== t.jmeno) k -= 1;
      if (k < 0) return;
      while (zas.length > k) konec[zas.pop()] = i;
    }
  });
  for (const i of zas) konec[i] = tokeny.length - 1;
  const text = (a, b) => {
    let o = '';
    for (let i = a; i <= b; i++) if (tokeny[i].typ === 'text') o += tokeny[i].text;
    return o;
  };
  const jeKarta = (i) => {
    const t = tokeny[i];
    if (!KARTA.has(t.jmeno)) return false;
    const x = text(i, konec[i]);
    // Citace + hvězdičky, nebo citace + zdroj recenze (karta „doporučení na Facebooku").
    return /[„"“]/.test(x) && (x.includes('★★★★★') || /\b(Google|Facebook)/.test(x))
      && x.replace(/\s+/g, ' ').length <= 1500;
  };
  const ven = new Array(tokeny.length).fill(false);
  const kandidati = [];
  tokeny.forEach((t, i) => {
    if (t.typ !== 'otevreni' || t.samo || konec[i] < 0) return;
    const podleTridy = t.attrs.class && RECENZE_TRIDA.test(t.attrs.class);
    const figura = t.jmeno === 'figure' && tokeny.slice(i, konec[i]).some((x) => x.typ === 'otevreni' && x.jmeno === 'blockquote');
    if (podleTridy || figura) kandidati.push(i);
    else if (jeKarta(i)) kandidati.push(i);
  });
  // U karet podle obsahu ber jen nejmenší (bez vnořené kandidátky), ať nezmizí celá sekce.
  for (const i of kandidati) {
    const vnorena = kandidati.some((j) => j > i && j < konec[i] && jeKarta(j));
    const podleTridy = tokeny[i].attrs.class && RECENZE_TRIDA.test(tokeny[i].attrs.class);
    if (!podleTridy && tokeny[i].jmeno !== 'figure' && vnorena) continue;
    for (let k = i; k <= konec[i]; k++) ven[k] = true;
  }
  return tokeny.filter((_, i) => !ven[i]);
}

function vynechej(jmeno, attrs) {
  if (PRYC_TAG.has(jmeno)) return true;
  if (attrs.class && PRYC_TRIDA.test(attrs.class)) return true;
  if (attrs.id && PRYC_ID.test(attrs.id)) return true;
  if (attrs['data-upsell']) return true;
  return false;
}

/** Vyřízne z tokenů obsah prvního prvku, který splní podmínku (včetně vnořených). */
function vyrizni(tokeny, podminka) {
  const start = tokeny.findIndex((t) => t.typ === 'otevreni' && podminka(t));
  if (start < 0) return null;
  const jmeno = tokeny[start].jmeno;
  let hloubka = 0;
  for (let i = start; i < tokeny.length; i++) {
    const t = tokeny[i];
    if (t.typ === 'otevreni' && t.jmeno === jmeno && !t.samo) hloubka += 1;
    if (t.typ === 'zavreni' && t.jmeno === jmeno) {
      hloubka -= 1;
      if (hloubka === 0) return tokeny.slice(start + 1, i);
    }
  }
  return tokeny.slice(start + 1);
}

function textPrvku(tokeny, podminka) {
  const t = vyrizni(tokeny, podminka);
  return t ? normalizujMezery(dekodujEntity(textZTokenu(t, null, false))) : '';
}

/** Uklidí text: mezery, prázdné řádky, dlouhé pomlčky (na webu zakázané). */
function uklid(text) {
  return dekodujEntity(text)
    .replace(/\s*\u2014\s*/g, ', ')
    .split('\n')
    .map((r) => r.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/^(#+|-)\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function clanekBlogu(html) {
  for (const b of jsonLdBloky(html)) {
    let nalez = null;
    kazdyUzel(b.data, (u) => {
      if (!nalez && typy(u).some((t) => t === 'BlogPosting' || t === 'Article')) nalez = u;
    });
    if (nalez) return nalez;
  }
  return null;
}

/** Jedna sekce souboru: { nadpis, url, meta, text }. */
export function sekceStranky(rel) {
  const html = nactiHtml(rel);
  const tokeny = tokenizuj(html);
  const body = vyrizni(tokeny, (t) => t.jmeno === 'body') || tokeny;
  const nadpis = textPrvku(body, (t) => t.jmeno === 'h1')
    || normalizujMezery(dekodujEntity((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || rel));
  const ld = clanekBlogu(html);
  const meta = [];
  if (ld && ld.author) meta.push('Autor: Martin Barna');
  if (ld?.datePublished) meta.push(`Vydáno: ${ld.datePublished}`);
  if (ld?.dateModified && ld.dateModified !== ld.datePublished) meta.push(`Aktualizováno: ${ld.dateModified}`);
  const clanek = /^clanky\//.test(rel) ? vyrizni(body, (t) => t.jmeno === 'article') : null;
  const text = uklid(textZTokenu(bezRecenzi(clanek || body), vynechej, true));
  return { rel, nadpis, url: souborNaUrl(rel), meta: meta.join(' · '), text };
}

export function seznamClanku(koren = ROOT) {
  const dir = path.join(koren, 'clanky');
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.html') && f !== 'index.html')
    .map((f) => `clanky/${f}`)
    .filter((rel) => !maNoindex(nactiHtml(rel)))
    .map((rel) => ({ rel, ld: clanekBlogu(nactiHtml(rel)) }))
    .sort((a, b) => (b.ld?.datePublished || '').localeCompare(a.ld?.datePublished || '') || a.rel.localeCompare(b.rel))
    .map((x) => x.rel);
}

export function sestavLlmsFull() {
  const casti = [
    '# Martin Barna: plný text webu martinbarna.cz',
    '',
    `> Plné znění hlavních stránek a všech článků blogu z ${ORIGIN}/, bez menu, patičky a formulářů. ` +
      `Krátký rozcestník s fakty a cenami je v ${ORIGIN}/llms.txt. Autorem všech textů je Martin Barna, ` +
      `online výživový a fitness kouč (${ORIGIN}${O_MNE}).`,
    '',
    'Při citaci uváděj URL konkrétní stránky, je u každé sekce. Ceny a čísla platí tak, jak stojí na stránkách webu.',
  ];
  const stranky = [];
  let skupina = null;
  for (const [rel, sk] of HLAVNI) {
    if (!fs.existsSync(path.join(ROOT, rel)) || maNoindex(nactiHtml(rel))) continue;
    stranky.push({ ...sekceStranky(rel), skupina: sk });
  }
  for (const rel of seznamClanku()) stranky.push({ ...sekceStranky(rel), skupina: 'Články blogu' });

  for (const s of stranky) {
    if (s.skupina !== skupina) {
      skupina = s.skupina;
      casti.push('', '', `# ${skupina}`);
    }
    casti.push('', '---', '', `## ${s.nadpis}`, `URL: ${s.url}`);
    if (s.meta) casti.push(s.meta);
    casti.push('', s.text);
  }
  const text = uklid(casti.join('\n')).replace(/\n# /g, '\n\n# ') + '\n';
  return { text, stranky };
}

function main() {
  const dry = process.argv.includes('--dry');
  const { text, stranky } = sestavLlmsFull();
  const clanku = stranky.filter((s) => s.skupina === 'Články blogu').length;
  console.log(`${LLMS_FULL}: ${stranky.length} stránek (z toho ${clanku} článků), ${text.length} znaků, ${Buffer.byteLength(text)} B`);
  const prazdne = stranky.filter((s) => s.text.length < 400);
  for (const s of prazdne) console.log(`  ⚠️ málo textu (${s.text.length} znaků): ${s.rel}`);
  if (!dry) fs.writeFileSync(path.join(ROOT, LLMS_FULL), text);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
