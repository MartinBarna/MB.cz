#!/usr/bin/env node
/**
 * Sjednotí JSON-LD napříč webem a doplní článkům viditelného autora a datum.
 *
 * Použití:  node scripts/geo-sjednot.mjs          (zapíše)
 *           node scripts/geo-sjednot.mjs --dry    (jen vypíše, co by změnil)
 *
 * Idempotentní: druhé spuštění nezmění nic. Bez závislostí.
 *
 * CO DĚLÁ
 * 1. Kopie Martina v JSON-LD ({"@type":"Person","name":"Martin Barna",...} bez @id)
 *    nahradí odkazem. Podle role:
 *      publisher, seller, brand, provider  → { "@id": "https://martinbarna.cz/#org" }
 *      author, creator a ostatní           → { "@id": "https://martinbarna.cz/#martin" }
 *    Kopie organizace „Martin Barna - Online výživa a fitness" uvnitř jiného uzlu
 *    → odkaz na #org. WebSite s url homepage → odkaz na #website.
 *    Plné definice (jméno, profily, kontakt) jsou jen v JSON-LD homepage.
 * 2. inLanguage "cs-CZ" → "cs" (stránky mají <html lang="cs">).
 * 3. Článkům blogu (clanky/*.html) a průvodcům s datem vloží do hero pod řádek
 *    s měsícem viditelný řádek „Autor: Martin Barna · Vydáno / Aktualizováno <datum>".
 *    Jméno vede na sekci o Martinovi (/#omne), datum je <time datetime> = dateModified.
 *    Text řádku se bere jen z JSON-LD stránky, nic se nedomýšlí.
 *
 * Nesahá na: právní stránky, nenasazované složky, assets/*, čísla ?v=.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  O_MNE,
  ORIGIN,
  REF,
  ROOT,
  ceskeDatum,
  jsonLdBloky,
  kazdyUzel,
  nactiHtml,
  najdiHtml,
  typy,
} from './geo-spolecne.mjs';

const PRAVNI = new Set([
  'obchodni-podminky/index.html',
  'odstoupeni/index.html',
  'zasady-ochrany-osobnich-udaju/index.html',
]);
const ROLE_ORG = new Set(['publisher', 'seller', 'brand', 'provider', 'sourceOrganization']);
const ORG_TYPY = new Set(['Organization', 'ProfessionalService', 'LocalBusiness', 'Brand']);

const jeMartin = (u) => typy(u).includes('Person') && !u['@id'] && /^\s*Martin Barna\s*$/.test(u.name || '');
const jeKopieOrg = (u) => typy(u).some((t) => ORG_TYPY.has(t)) && !u['@id'] && /Martin Barna/.test(u.name || '');
const jeWeb = (u) => typy(u).includes('WebSite') && !u['@id'] && [ORIGIN, `${ORIGIN}/`].includes(u.url);

/** Vrátí upravenou kopii dat. `klic` = jméno vlastnosti, pod kterou uzel visí. */
export function sjednotUzel(data, klic = null) {
  if (Array.isArray(data)) return data.map((x) => sjednotUzel(x, klic));
  if (!data || typeof data !== 'object') return data;
  if (klic !== null) {
    if (jeMartin(data)) return ROLE_ORG.has(klic) ? { ...REF.org } : { ...REF.martin };
    if (jeKopieOrg(data)) return { ...REF.org };
    if (jeWeb(data)) return { ...REF.web };
  }
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === 'inLanguage' && v === 'cs-CZ') out[k] = 'cs';
    else out[k] = v && typeof v === 'object' ? sjednotUzel(v, k) : v;
  }
  return out;
}

/** Zapíše JSON zpátky ve stejném stylu, v jakém byl (víceřádkový / jednořádkový). */
function serializuj(raw, data) {
  const lead = raw.match(/^\s*/)[0];
  const trail = raw.match(/\s*$/)[0];
  const viceradkovy = raw.trim().includes('\n');
  if (!viceradkovy) return lead + JSON.stringify(data) + trail;
  // Odsazení zachovat: druhý a další řádek dostanou stejný okraj jako první „{".
  const okraj = lead.slice(lead.lastIndexOf('\n') + 1);
  return lead + JSON.stringify(data, null, 2).split('\n').join('\n' + okraj) + trail;
}

export function sjednotJsonLd(html) {
  let out = '';
  let pos = 0;
  let zmen = 0;
  for (const b of jsonLdBloky(html)) {
    if (!b.data) continue;
    const nova = sjednotUzel(b.data);
    if (JSON.stringify(nova) === JSON.stringify(b.data)) continue;
    const blok = html.slice(b.start, b.end);
    const rawStart = b.start + blok.indexOf(b.raw);
    out += html.slice(pos, rawStart) + serializuj(b.raw, nova);
    pos = rawStart + b.raw.length;
    zmen += 1;
  }
  return { html: out + html.slice(pos), zmen };
}

/* ----------------------------------------------- viditelný autor a datum */

function clanekLd(html) {
  for (const b of jsonLdBloky(html)) {
    let nalez = null;
    kazdyUzel(b.data, (u, cesta) => {
      if (!nalez && /^\$(\[\d+\])?$/.test(cesta) && typy(u).some((t) => t === 'BlogPosting' || t === 'Article')) nalez = u;
    });
    if (nalez) return nalez;
  }
  return null;
}

/** HTML řádku s autorem a datem. Sdílí ho i scripts/blog-publikuj.mjs. */
export function radekAutora(datePublished, dateModified) {
  const datum = dateModified || datePublished;
  const slovo = dateModified && datePublished && dateModified > datePublished ? 'Aktualizováno' : 'Vydáno';
  return `<p class="hero-meta hero-byline" style="margin-top:.35rem;opacity:1">Autor: <a href="${O_MNE}" style="color:inherit;text-decoration:underline;text-underline-offset:3px">Martin Barna</a> · ${slovo} <time datetime="${datum}">${ceskeDatum(datum)}</time></p>`;
}

const BYLINE_RE = /<p class="hero-meta hero-byline"[^>]*>[\s\S]*?<\/p>/;
const HERO_META_RE = /(<p class="hero-meta">[^<]*<\/p>)/;

export function doplnRadekAutora(html) {
  const ld = clanekLd(html);
  if (!ld || !ld.datePublished) return { html, zmena: false, duvod: 'bez data v JSON-LD' };
  const radek = radekAutora(ld.datePublished, ld.dateModified);
  if (BYLINE_RE.test(html)) {
    const nove = html.replace(BYLINE_RE, () => radek);
    return { html: nove, zmena: nove !== html };
  }
  const m = HERO_META_RE.exec(html);
  if (!m) return { html, zmena: false, duvod: 'nenašel jsem <p class="hero-meta">' };
  const i = m.index + m[0].length;
  return { html: html.slice(0, i) + radek + html.slice(i), zmena: true };
}

/* ------------------------------------------------------------------ main */

function main() {
  const dry = process.argv.includes('--dry');
  let souboru = 0;
  let bloku = 0;
  let radku = 0;
  const preskoceno = [];
  for (const rel of najdiHtml()) {
    if (PRAVNI.has(rel)) continue;
    const puvodni = nactiHtml(rel);
    let { html, zmen } = sjednotJsonLd(puvodni);
    bloku += zmen;
    const jeClanek = (/^clanky\/[^/]+\.html$/.test(rel) && rel !== 'clanky/index.html')
      || ['jak-zhubnout/index.html', 'jak-nabrat-svaly/index.html'].includes(rel);
    if (jeClanek) {
      const r = doplnRadekAutora(html);
      if (r.zmena) radku += 1;
      if (r.duvod) preskoceno.push(`${rel}: ${r.duvod}`);
      html = r.html;
    }
    if (html !== puvodni) {
      souboru += 1;
      if (!dry) fs.writeFileSync(path.join(ROOT, rel), html);
    }
  }
  console.log(`${dry ? 'NASUCHO: ' : ''}změněno souborů: ${souboru}, bloků JSON-LD: ${bloku}, řádků s autorem: ${radku}`);
  for (const p of preskoceno) console.log(`  přeskočeno: ${p}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) main();
