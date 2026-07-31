#!/usr/bin/env node
// =============================================================================
// VRÁTÍ DO SCÉNÁŘŮ TO, CO SE PŘI REBRANDU ZTRATILO: citace, DOI a vysvětlivky.
//
// Čte původní oranžové infografiky (OCR z Disku, viz _Claude-dokumenty/
// 2026-07-31_infografiky-texty/) a doplňuje z nich pole `zdroj` a `pozn`
// do našich scénářů v _zdroje/infografiky/<slug>.json.
//
// ⛔ NEPÁRUJE SLIDY PODLE POŘADÍ. Naše decky nejsou 1:1 s původními: u krevních
// testů se dva staré slidy zahodily a dva nové přibyly. Párování podle indexu by
// přilepilo citaci k jinému tvrzení, což je horší než žádná citace. Páruje se
// podle SHODY TEXTU a slabá shoda se nezapisuje, jen nahlásí.
//
//   node scripts/vratit-zdroje-do-infografik.mjs            (jen vypíše, co by udělal)
//   node scripts/vratit-zdroje-do-infografik.mjs --zapsat   (zapíše do scénářů)
// =============================================================================
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.slice(1)), '..');
const NASE = path.join(ROOT, '_zdroje/infografiky');
const STARE = 'C:/Users/fitne/Desktop/_Claude-dokumenty/2026-07-31_infografiky-texty';
const ZAPSAT = process.argv.includes('--zapsat');

// ⛔ Značka se v OCR nelepí vždy na vlastní řádek. Objevuje se i jako
// „⚫ MARTIN BARNA online výživa & fitness" nebo „• MARTIN BARNA" NA KONCI řádku
// s citací. Kotvené `^martin barna$` to nechytí a značka pak skončí uvnitř pole
// „časopis". Proto se hledá kdekoli v řádku, ne jen na začátku.
const SUM = [
  /^image labels:/i, /^martinbarna\.cz$/i, /martin\s*barna/i, /online\s*výživa/i,
  /^výživa\s*[.·-]\s*věda/i, /^pohyb\s*[.·-]?\s*data/i, /^výživa\s*[-.]\s*mozek/i,
  /^posuň dál$/i, /^\d+\s*\/\s*\d+$/, /^mb$/i, /^[⚫•●]/, /^\s*$/,
  /^(suplex city|scotiabank|asiamoney|nasdaq|bloomberg|reuters)/i,
];
const bezDia = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const slova = (s) => bezDia(String(s)).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);

/** Rozseká vytěžený .md na slidy a z každého vytáhne zdroj, vysvětlivku a titulek. */
function rozebrat(md) {
  const slidy = [];
  for (const blok of md.split(/^## /m).slice(1)) {
    const [hlavicka, ...zbytek] = blok.split('\n');
    const radky = zbytek.map((r) => r.replace(/\\/g, '').trim())
      .filter((r) => r.length > 1 && !SUM.some((re) => re.test(r)));

    // ZDROJ: popisek, pod ním autor, časopis a DOI (občas na jednom řádku).
    // ⚠️ Popisek tam ale NEMUSÍ být. `protein-post` a `spanek` mají citaci volně
    // v patě slidu bez něj. Proto se sekundárně hledá podle tvaru citace.
    let zdroj = null;
    // Popisek stojí buď na vlastním řádku, nebo rovnou před citací („Zdroje: King…").
    let iz = radky.findIndex((r) => /^zdroje?\s*:?$/i.test(r));
    let blokZ = null;
    if (iz < 0) {
      const ip = radky.findIndex((r) => /^zdroje?\s*:\s*\S/i.test(r));
      if (ip >= 0) { radky[ip] = radky[ip].replace(/^zdroje?\s*:\s*/i, ''); iz = ip - 1; }
    }
    if (iz >= 0) {
      blokZ = radky.slice(iz + 1, iz + 4).filter((r) => !/^[A-ZĚŠČŘŽÝÁÍÉÚŮ ,]{6,}$/.test(r));
    } else {
      const ic = radky.findIndex((r) => /10\.\d{4,}\//.test(r)
        || /(et al\.|a kol\.)[^.]{0,40}\(?\d{4}\)?/i.test(r));
      if (ic >= 0) { iz = ic; blokZ = radky.slice(ic, ic + 2).filter((r) => !/^[A-ZĚŠČŘŽÝÁÍÉÚŮ ,]{6,}$/.test(r)); }
    }
    if (blokZ && blokZ.length) {
      const doi = (blokZ.join(' ').match(/10\.\d{4,}\/\S+/) || [])[0] || null;
      // Osamocené „DOI" na konci řádku zůstane, když je samotné číslo až na dalším.
      const bezDoi = blokZ.map((r) => r.replace(/DOI:\s*/i, '').replace(/10\.\d{4,}\/\S+/, '').trim())
        .map((r) => r.replace(/[,;\s]*\bDOI\b[.,;:\s]*$/i, '').replace(/[.,;\s]+$/, '')).filter(Boolean);
      if (bezDoi.length || doi) zdroj = { kdo: bezDoi[0] || null, kde: bezDoi.slice(1).join(' ') || null, doi };
    }

    // Vysvětlivka pod čarou: „IgG = protilátka…", „CICO = příjem vs. výdej…"
    // ⛔ Rovnítko samo o sobě nestačí. Citace „Waziry et al. (2023), 2-letý RCT, n = 220"
    // ho obsahuje taky a propašuje se pak do vysvětlivky jako duplikát zdroje.
    // Proto se vyhazuje všechno, co vypadá jako citace nebo nese DOI.
    const jeCitace = (r) => /10\.\d{4,}\//.test(r) || /(et al\.|a kol\.)/i.test(r)
      || /\(\s*(19|20)\d{2}\s*\)/.test(r);
    const pozn = radky.find((r, i) => i !== iz && /\s=\s/.test(r) && r.length > 20
      && !jeCitace(r) && !/^[A-ZĚŠČŘŽÝÁÍÉÚŮ ,]{6,}$/.test(r)) || null;

    // Titulek stojí na začátku slidu, hned za popiskem kapitoly nebo za hlavičkou.
    // ⛔ Hledat ho kdekoli na slidu NEFUNGUJE: vrací útržky z těla („není náhrada
    // za péči.") nebo slepence z grafiky („flavonoidy⚫antokyany"). Ověřeno na vzorku
    // 31. 7. 2026, zhruba polovina nálezů byla mimo. Proto jen první tři řádky.
    const titulek = radky.slice(0, 3).find((r) => r.length >= 12 && r.length <= 72
      && /[a-zěščřžýáíé]/.test(r) && !/^\d/.test(r) && !/\s=\s/.test(r)
      && !/[⚫•●]/.test(r) && r !== pozn) || null;

    slidy.push({ hlavicka: hlavicka.trim(), radky, zdroj, pozn, titulek });
  }
  return slidy;
}

/** Míra shody starého slidu s naším: kolik našich slov je i v tom starém. */
function shodaSlidu(stary, nasSlide) {
  const w = new Set(slova(stary.radky.join(' ')));
  const t = slova(JSON.stringify(nasSlide).replace(/<[^>]+>/g, ' '));
  return t.length ? t.filter((x) => w.has(x)).length / t.length : 0;
}

/** Spáruje staré slidy s našimi. Nejdřív ty NEJSILNĚJŠÍ dvojice, ne v pořadí výskytu.
 *  ⛔ Naivní „ber první, co sedne" umí zabrat slot slabou shodou a tu silnou pak
 *  zahodit, takže citace skončí u jiného tvrzení. */
function sparovat(stare, naseSlidy) {
  const dvojice = [];
  stare.forEach((st, a) => naseSlidy.forEach((ns, b) =>
    dvojice.push({ a, b, shoda: shodaSlidu(st, ns) })));
  dvojice.sort((x, y) => y.shoda - x.shoda);
  const braneA = new Set(), braneB = new Set(), vysledek = new Map();
  for (const d of dvojice) {
    if (braneA.has(d.a) || braneB.has(d.b)) continue;
    braneA.add(d.a); braneB.add(d.b);
    vysledek.set(d.a, { i: d.b, shoda: d.shoda });
  }
  return vysledek;
}

/** Zapíše scénář ve STÁVAJÍCÍM formátu: jeden slide na řádek.
 *  ⛔ `JSON.stringify(x, null, 2)` je tady past. Rozbalí každý slide na dvacet řádků
 *  a z doplnění 77 polí udělá diff o 2329 řádcích, ve kterém se skutečná změna
 *  nedá zkontrolovat. Naběhl jsem na to 31. 7. 2026 a musel to vracet. */
function zapsatScenar(scenar) {
  // Mezery uvnitř objektů kopírují dosavadní styl souborů. Bez toho se v diffu
  // změní i slidy, na které se vůbec nesáhlo, a skutečná úprava se v tom ztratí.
  const inline = (v) => Array.isArray(v) ? '[' + v.map(inline).join(', ') + ']'
    : (v && typeof v === 'object')
      ? '{ ' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + inline(x)).join(', ') + ' }'
      : JSON.stringify(v);
  return `{\n  "slug": ${JSON.stringify(scenar.slug)},\n  "slides": [\n`
    + scenar.slides.map((s) => '    ' + inline(s)).join(',\n') + '\n  ]\n}\n';
}

const RUCNE = { 'ultra-zpracovana-jidla': 'ultra-zpracovana-jidla-jed', 'vysoky-vo2max': 'vysoky-vo2max-delsi-zivot' };
const dostupne = readdirSync(STARE).filter((f) => f.endsWith('.md') && !f.startsWith('_')).map((f) => f.replace('.md', ''));

// Práh shody. Pod ním se nezapisuje: radši chybějící citace než citace u cizího tvrzení.
const PRAH = 0.18;

/** Které typy slidů vůbec umí zdroj a vysvětlivku vykreslit.
 *  ⛔ `quote`, `cover` a `cta` volají v generátoru vlastní šablonu bez `patka()`, takže
 *  cokoli se jim sem zapíše, TIŠE ZMIZÍ. Vypadá to jako doplněná citace, ale na obrázku
 *  není. Stalo se 31. 7. 2026 dvakrát, než jsem si všiml. */
const umiPatku = (kind) => ['point', 'bullets', 'stat', 'vs'].includes(kind);

let zapsanoZdroju = 0, zapsanoPozn = 0, slabych = 0;
const prirazeni = [];
const titulky = [];
const slabe = [];

for (const f of readdirSync(NASE).filter((x) => x.endsWith('.json'))) {
  const slug = f.replace('.json', '');
  if (slug === 'krevni-testy') continue;            // pilot, dodělaný ručně
  const soubor = RUCNE[slug] || (dostupne.includes(slug) ? slug : null);
  if (!soubor) continue;

  const cesta = path.join(NASE, f);
  const scenar = JSON.parse(readFileSync(cesta, 'utf8'));
  const stare = rozebrat(readFileSync(path.join(STARE, soubor + '.md'), 'utf8'));
  const pary = sparovat(stare, scenar.slides);
  let zmena = false;

  for (let a = 0; a < stare.length; a++) {
    const st = stare[a];
    if (!st.zdroj && !st.pozn && !st.titulek) continue;
    const par = pary.get(a);
    if (!par) continue;
    const { i, shoda } = par;
    if (shoda < PRAH) {
      if (st.zdroj?.doi) { slabych++; slabe.push(`${slug} · ${st.hlavicka} · ${st.zdroj.doi} · shoda ${Math.round(shoda * 100)} %`); }
      continue;
    }
    const nas = scenar.slides[i];
    if (st.zdroj && !nas.zdroj && umiPatku(nas.kind)) {
      nas.zdroj = Object.fromEntries(Object.entries(st.zdroj).filter(([, v]) => v));
      zapsanoZdroju++; zmena = true;
      prirazeni.push({ slug, slide: i + 1, shoda, zdroj: nas.zdroj,
        stary: st.hlavicka.replace(/\s*\(id:.*/, ''),
        nasTitulek: String(nas.title || nas.big || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() });
    }
    if (st.pozn && !nas.pozn && umiPatku(nas.kind)) {
      nas.pozn = st.pozn; zapsanoPozn++; zmena = true;
    }
    // Titulky se NEPŘEPISUJÍ automaticky, jen se sepíšou k ručnímu posouzení.
    if (st.titulek && nas.title) {
      const nasCisty = String(nas.title).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const p = slova(st.titulek).filter((x) => new Set(slova(nasCisty)).has(x)).length
        / Math.max(1, slova(st.titulek).length);
      if (p < 0.6) titulky.push({ slug, slide: i + 1, stary: st.titulek, nas: nasCisty });
    }
  }
  if (zmena && ZAPSAT) writeFileSync(cesta, zapsatScenar(scenar), 'utf8');
}

console.log((ZAPSAT ? 'ZAPSÁNO' : 'NÁHLED (nic se nezapsalo)') + ':');
console.log('  zdrojů doplněno:      ' + zapsanoZdroju);
console.log('  vysvětlivek doplněno: ' + zapsanoPozn);
console.log('  přeskočeno pro slabou shodu (s DOI): ' + slabych);
if (slabe.length) { console.log('\nK ručnímu dohledání:'); slabe.forEach((s) => console.log('  ' + s)); }

// Kontrolní výpis. Počet doplněných citací nic neříká o tom, jestli sedí ke správnému
// tvrzení. Řadí se od NEJSLABŠÍ shody, protože právě tam se pár láme.
writeFileSync(path.join(STARE, '_ZDROJE-PRIRAZENI.md'),
  '# Kam se která citace vrátila\n\nSeřazeno od nejslabší shody. Citace u cizího tvrzení\n'
  + 'je horší než žádná, takže se to nekontroluje počtem, ale tímhle seznamem.\n\n'
  + prirazeni.sort((a, b) => a.shoda - b.shoda).map((z) =>
    `- **${z.slug}** slide ${z.slide} (shoda ${Math.round(z.shoda * 100)} %)\n`
    + `  - původní slide: ${z.stary}\n  - náš text: ${z.nasTitulek}\n`
    + `  - zdroj: ${[z.zdroj.kdo, z.zdroj.kde, z.zdroj.doi].filter(Boolean).join(' · ')}`).join('\n'),
  'utf8');
console.log('\nPřiřazení k překontrolování: ' + path.join(STARE, '_ZDROJE-PRIRAZENI.md'));

writeFileSync(path.join(STARE, '_TITULKY-K-POSOUZENI.md'),
  '# Titulky, které se při rebrandu přepsaly\n\nVlevo původní (Martinův), vpravo současný.\n'
  + 'Nic se nepřepsalo automaticky, je to podklad k ručnímu rozhodnutí.\n\n'
  + titulky.map((t) => `## ${t.slug} · slide ${t.slide}\n- **původní:** ${t.stary}\n- současný: ${t.nas}\n`).join('\n'),
  'utf8');
console.log('\nTitulků k posouzení: ' + titulky.length + '  ->  ' + path.join(STARE, '_TITULKY-K-POSOUZENI.md'));
