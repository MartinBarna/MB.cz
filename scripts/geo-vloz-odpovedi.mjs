#!/usr/bin/env node
/**
 * Vloží do článků schválenou krátkou odpověď a FAQ z `_cloud/geo-odpovedi/*.json`.
 *
 * Místo rámečku je stejné jako u pěti vzorů (bilkoviny, cheat-day, kardio-nici-svaly-mytus,
 * kreatin-pro-zeny, spanek-a-hubnuti): hned za úvodní odstavec, před zbytek článku.
 * Značka: <div class="pull" data-geo="kratka-odpoved"><strong>Krátká odpověď: …</strong><br>…</div>
 *
 * FAQ (nadpis „Časté otázky“, odstavce .faq-q a FAQPage JSON-LD) se přidá jen tam,
 * kde viditelná sekce FAQ / Časté otázky ještě není. Druhou sekci skript nezakládá.
 * Vzory už obojí mají, takže je pozná jako hotové a nesáhne na ně.
 *
 * Idempotentní: druhý běh soubory nezmění. `--dry` jen vypíše, nic nezapíše.
 * Bez závislostí. Texty z JSON nemění, do HTML je jen escapuje (& < >).
 *
 * Spuštění:  node scripts/geo-vloz-odpovedi.mjs
 *            node scripts/geo-vloz-odpovedi.mjs --dry
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JSON_DIR = path.join(ROOT, '_cloud', 'geo-odpovedi');
const ORIGIN = 'https://martinbarna.cz';
const DRY = process.argv.includes('--dry');

const PULL_CSS = '        .pull { background:var(--green-light); border-left:4px solid var(--green); border-radius:0 14px 14px 0; padding:1.1rem 1.4rem; margin:1.8rem 0; font-weight:600; color:var(--green-dark); }';
const FAQ_CSS = '        .faq-q { font-weight:700; color:var(--green-dark); margin:1.6rem 0 .3rem; }';

function urlNaSoubor(url) {
  if (typeof url !== 'string' || !url.startsWith(ORIGIN)) return null;
  let p = url.slice(ORIGIN.length).replace(/[?#].*$/, '');
  if (p === '' || p === '/') return 'index.html';
  p = p.replace(/^\//, '');
  if (p.endsWith('/')) return p + 'index.html';
  if (/\.[a-z0-9]+$/i.test(p)) return p;
  return p + '/index.html';
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function nlZ(html) {
  return html.includes('\r\n') ? '\r\n' : '\n';
}

function clanek(html) {
  const a0 = html.indexOf('<article>');
  const a1 = a0 < 0 ? -1 : html.indexOf('</article>', a0);
  if (a0 < 0 || a1 < 0) return null;
  return { a0, a1, art: html.slice(a0, a1) };
}

function odsazeni(text, index) {
  const lineStart = text.lastIndexOf('\n', index - 1) + 1;
  return (/^[ \t]*/.exec(text.slice(lineStart, index)) || [''])[0];
}

function maFaqSekci(art) {
  return /<h[1-6]\b[^>]*>\s*(?:<(?:strong|b)>\s*)?(?:Časté otázky|FAQ)\b/i.test(art);
}

/**
 * Kam vložit rámeček. Vzor ho má hned za úvodem a před magnetem (cta-box).
 * 1. Za perex (.lead).
 * 2. Jinak za první odstavec, který stojí ještě PŘED prvním cta-boxem
 *    (starší články bez třídy lead, typicky e-book: nadpis, odstavec, magnet).
 * 3. Když před magnetem žádný odstavec není (článek začíná nadpisem nebo rovnou
 *    magnetem), vloží se těsně před první cta-box. Odpověď je pořád nahoře.
 */
function konecElementuP(art, openIndex) {
  const re = /<(\/?)p\b[^>]*>/gi;
  re.lastIndex = openIndex;
  let depth = 0;
  let m;
  while ((m = re.exec(art))) {
    if (m[1]) {
      depth -= 1;
      if (depth === 0) return m.index + m[0].length;
    } else {
      depth += 1;
    }
  }
  return -1;
}

function mistoRamecku(art) {
  const leadOpen = /<p\b[^>]*class=["'][^"']*\blead\b[^"']*["'][^>]*>/.exec(art);
  if (leadOpen) {
    const end = konecElementuP(art, leadOpen.index);
    if (end > 0) return { end, indent: odsazeni(art, leadOpen.index), jak: 'za-lead' };
  }
  const cta = /<div\b[^>]*class=["'][^"']*\bcta-box\b/.exec(art);
  const hranice = cta ? cta.index : art.length;
  let skip = 0;
  const re = /<(\/?)(div|figure|p)\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(art))) {
    if (m.index >= hranice) break;
    const zavrena = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrs = m[3] || '';
    if (tag === 'p') {
      if (!zavrena && skip === 0) {
        const konec = art.indexOf('</p>', m.index);
        if (konec < 0 || (cta && konec > cta.index)) break;
        return { end: konec + 4, indent: odsazeni(art, m.index), jak: 'za-prvni-p' };
      }
      continue;
    }
    if (!zavrena) {
      const cls = (attrs.match(/class=["']([^"']*)["']/) || [])[1] || '';
      const preskoc = tag === 'figure' || /\b(cta-box|tyden-box|author-box|pull|keybox)\b/.test(cls);
      if (skip > 0 || preskoc) skip += 1;
    } else if (skip > 0) {
      skip -= 1;
    }
  }
  if (cta) return { index: cta.index, jak: 'pred-prvni-cta' };
  return { end: null, jak: 'zacatek' };
}

function vlozRamecek(html, otazka, odpoved) {
  if (html.includes('data-geo="kratka-odpoved"')) return { html, stav: 'uz-je', jak: '' };
  const c = clanek(html);
  if (!c) return { html, stav: 'chyba', jak: '', proc: 'článek nemá <article>' };
  const nl = nlZ(html);
  const box = `<div class="pull" data-geo="kratka-odpoved"><strong>Krátká odpověď: ${esc(otazka)}</strong><br>${esc(odpoved)}</div>`;
  const misto = mistoRamecku(c.art);
  if (!misto) return { html, stav: 'chyba', jak: '', proc: 'není kam vložit rámeček' };
  if (misto.jak === 'pred-prvni-cta') {
    const ls = c.art.lastIndexOf('\n', misto.index - 1) + 1;
    const indent = c.art.slice(ls, misto.index);
    const abs = c.a0 + ls;
    let block = indent + box + nl + nl;
    if (!predchoziRadekPrazdny(html, abs, nl)) block = nl + block;
    return { html: html.slice(0, abs) + block + html.slice(abs), stav: 'vlozen', jak: misto.jak };
  }
  if (misto.jak === 'zacatek') {
    let at = c.a0 + '<article>'.length;
    if (html.startsWith(nl, at)) at += nl.length;
    else if (html[at] === '\n') at += 1;
    const dalsiNl = html.indexOf('\n', at);
    const dalsiRadek = dalsiNl < 0 ? '' : html.slice(at, dalsiNl).replace(/\r$/, '');
    const indent = (/^[ \t]*/.exec(dalsiRadek) || [''])[0];
    const block = indent + box + nl + nl;
    return { html: html.slice(0, at) + block + html.slice(at), stav: 'vlozen', jak: 'zacatek' };
  }
  const at = c.a0 + misto.end;
  const block = nl + misto.indent + box;
  return { html: html.slice(0, at) + block + html.slice(at), stav: 'vlozen', jak: misto.jak };
}

function mistoFaq(art) {
  const author = art.search(/<div\b[^>]*class=["'][^"']*\bauthor-box\b/);
  const scopeEnd = author >= 0 ? author : art.length;
  const scope = art.slice(0, scopeEnd);
  const mohlo = /<h2\b[^>]*>\s*Mohlo by tě zajímat\s*<\/h2>/.exec(scope);
  const ctaRe = /<div\b[^>]*class=["'][^"']*\bcta-box\b[^>]*>/g;
  if (mohlo) {
    const pred = scope.slice(0, mohlo.index);
    const ctas = [...pred.matchAll(ctaRe)];
    if (ctas.length) {
      const last = ctas[ctas.length - 1].index;
      if (/<h2\b/i.test(pred.slice(last))) return { index: mohlo.index, jak: 'pred-mohlo' };
      return { index: last, jak: 'pred-cta' };
    }
    return { index: mohlo.index, jak: 'pred-mohlo' };
  }
  const ctas = [...scope.matchAll(ctaRe)];
  if (ctas.length) return { index: ctas[ctas.length - 1].index, jak: 'pred-cta' };
  if (author >= 0) return { index: author, jak: 'pred-author' };
  const disc = art.search(/<p\b[^>]*class=["'][^"']*\bdisclaimer\b/);
  if (disc >= 0) return { index: disc, jak: 'pred-disclaimer' };
  return null;
}

function predchoziRadekPrazdny(html, lineStart, nl) {
  if (lineStart < nl.length) return false;
  const konec = lineStart - nl.length;
  const zac = html.lastIndexOf(nl, konec - 1);
  const radek = html.slice(zac < 0 ? 0 : zac + nl.length, konec);
  return radek.trim() === '';
}

function vlozFaq(html, faq) {
  const c = clanek(html);
  if (!c) return { html, stav: 'chyba', proc: 'článek nemá <article>' };
  if (maFaqSekci(c.art)) return { html, stav: 'preskoceno', proc: 'už má viditelnou sekci Časté otázky' };
  const misto = mistoFaq(c.art);
  if (!misto) return { html, stav: 'chyba', proc: 'není kam vložit FAQ' };
  const nl = nlZ(html);
  const ls = c.art.lastIndexOf('\n', misto.index - 1) + 1;
  const indent = c.art.slice(ls, misto.index);
  const radky = [indent + '<h2>Časté otázky</h2>'];
  for (const q of faq) {
    radky.push(indent + `<p class="faq-q">${esc(q.otazka)}</p>`);
    radky.push(indent + `<p>${esc(q.odpoved)}</p>`);
  }
  let block = radky.join(nl) + nl + nl;
  const abs = c.a0 + ls;
  if (!predchoziRadekPrazdny(html, abs, nl)) block = nl + block;
  return {
    html: html.slice(0, abs) + block + html.slice(abs),
    stav: 'vlozeno',
    jak: misto.jak,
    pocet: faq.length,
  };
}

function jsonLd(faq) {
  const obj = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((q) => ({
      '@type': 'Question',
      name: q.otazka,
      acceptedAnswer: { '@type': 'Answer', text: q.odpoved },
    })),
  };
  return JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');
}

function vlozJsonLd(html, faq) {
  if (/"@type"\s*:\s*"FAQPage"/.test(html)) {
    return { html, stav: 'uz-je', proc: 'FAQPage už v článku je, druhý blok nepřidávám' };
  }
  const headEnd = html.indexOf('</head>');
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi;
  let last = null;
  let m;
  while ((m = re.exec(html))) {
    if (headEnd >= 0 && m.index > headEnd) break;
    last = m;
  }
  if (!last) return { html, stav: 'chyba', proc: 'v <head> není žádné JSON-LD, kam FAQPage navázat' };
  const nl = nlZ(html);
  const blok = nl + '    <script type="application/ld+json">' + nl + jsonLd(faq).replace(/\n/g, nl) + nl + '    </script>';
  const at = last.index + last[0].length;
  return { html: html.slice(0, at) + blok + html.slice(at), stav: 'vlozeno' };
}

function doplnCss(html, potrebaPull, potrebaFaq) {
  let out = html;
  const nl = nlZ(out);
  const maPull = () => /\.pull\s*\{/.test(out);
  const maFaq = () => /\.faq-q\s*\{/.test(out);
  if (potrebaFaq && !maFaq() && maPull()) {
    const m = /\.pull\s*\{[^}]*\}/.exec(out);
    if (m) {
      const indent = odsazeni(out, m.index) || '        ';
      const at = m.index + m[0].length;
      out = out.slice(0, at) + nl + indent + FAQ_CSS.trim() + out.slice(at);
    }
  }
  const pridat = [];
  if (potrebaPull && !maPull()) pridat.push(PULL_CSS);
  if (potrebaFaq && !maFaq()) pridat.push(FAQ_CSS);
  if (!pridat.length) return { html: out, css: [] };
  const end = out.indexOf('</style>');
  if (end < 0) return { html: out, css: [], chyba: 'soubor nemá <style>, pravidla .pull / .faq-q nepřidána' };
  const lineStart = out.lastIndexOf('\n', end - 1) + 1;
  out = out.slice(0, lineStart) + pridat.join(nl) + nl + out.slice(lineStart);
  return { html: out, css: pridat.map((r) => (r.includes('.faq-q') ? '.faq-q' : '.pull')) };
}

function nactiZadani() {
  const soubory = fs.readdirSync(JSON_DIR).filter((f) => f.endsWith('.json')).sort();
  return soubory.map((f) => {
    const raw = fs.readFileSync(path.join(JSON_DIR, f), 'utf8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return { soubor: f, chyba: `JSON nejde přečíst: ${e.message}` };
    }
    if (typeof data.hlavni_otazka !== 'string' || typeof data.kratka_odpoved !== 'string' || !Array.isArray(data.faq)) {
      return { soubor: f, chyba: 'chybí hlavni_otazka, kratka_odpoved nebo faq' };
    }
    for (const q of data.faq) {
      if (!q || typeof q.otazka !== 'string' || typeof q.odpoved !== 'string') {
        return { soubor: f, chyba: 'položka faq nemá otazka a odpoved' };
      }
    }
    const texty = [data.hlavni_otazka, data.kratka_odpoved, ...data.faq.flatMap((q) => [q.otazka, q.odpoved])];
    if (texty.some((t) => t.includes('\u2014'))) {
      return { soubor: f, chyba: 'text obsahuje U+2014, nevkládám' };
    }
    return { soubor: f, data };
  });
}

const vysledky = [];
for (const zad of nactiZadani()) {
  if (zad.chyba) {
    vysledky.push({ json: zad.soubor, chyba: zad.chyba });
    continue;
  }
  const rel = urlNaSoubor(zad.data.url);
  const povoleno = rel && (rel.startsWith('clanky/') || rel === 'jak-zhubnout/index.html' || rel === 'jak-nabrat-svaly/index.html');
  if (!rel || !povoleno) {
    vysledky.push({ json: zad.soubor, rel, chyba: `URL mimo články a průvodce: ${zad.data.url}` });
    continue;
  }
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    vysledky.push({ json: zad.soubor, rel, chyba: 'HTML soubor neexistuje' });
    continue;
  }
  const puvodni = fs.readFileSync(abs, 'utf8');
  let html = puvodni;
  const poznamky = [];

  const ramecek = vlozRamecek(html, zad.data.hlavni_otazka, zad.data.kratka_odpoved);
  html = ramecek.html;
  if (ramecek.stav === 'chyba') poznamky.push('rámeček: ' + ramecek.proc);

  const faq = vlozFaq(html, zad.data.faq);
  html = faq.html;
  if (faq.stav === 'chyba') poznamky.push('FAQ: ' + faq.proc);
  if (faq.stav === 'preskoceno') poznamky.push('FAQ přeskočeno: ' + faq.proc);

  let jsonld = { stav: 'netreba' };
  if (faq.stav === 'vlozeno') {
    jsonld = vlozJsonLd(html, zad.data.faq);
    html = jsonld.html;
    if (jsonld.stav === 'chyba' || jsonld.stav === 'uz-je') poznamky.push('JSON-LD: ' + (jsonld.proc || jsonld.stav));
  }

  const css = doplnCss(html, ramecek.stav === 'vlozen', faq.stav === 'vlozeno');
  html = css.html;
  if (css.chyba) poznamky.push(css.chyba);

  const zmena = html !== puvodni;
  if (zmena && !DRY) fs.writeFileSync(abs, html);

  vysledky.push({
    json: zad.soubor,
    rel,
    ramecek: ramecek.stav,
    ramecekJak: ramecek.jak || '',
    faq: faq.stav,
    faqJak: faq.jak || '',
    faqPocet: faq.pocet || 0,
    jsonld: jsonld.stav,
    css: css.css || [],
    zmena,
    poznamky,
  });
}

const pocet = (k, v) => vysledky.filter((x) => x[k] === v).length;
console.log(`geo-vloz-odpovedi ${DRY ? '(dry) ' : ''}JSON: ${vysledky.length}`);
for (const x of vysledky) {
  if (x.chyba) {
    console.log(`CHYBA  ${x.json}: ${x.chyba}`);
    continue;
  }
  const casti = [
    `rámeček ${x.ramecek}${x.ramecekJak ? ' (' + x.ramecekJak + ')' : ''}`,
    `FAQ ${x.faq}${x.faqJak ? ' (' + x.faqJak + ', ' + x.faqPocet + ')' : ''}`,
  ];
  if (x.jsonld !== 'netreba') casti.push('JSON-LD ' + x.jsonld);
  if (x.css.length) casti.push('CSS ' + x.css.join('+'));
  if (x.poznamky.length) casti.push(x.poznamky.join('; '));
  const znacka = x.zmena ? (DRY ? 'DRY' : 'ZMENA') : 'BEZE ZMENY';
  console.log(`${znacka}  ${x.rel}: ${casti.join('; ')}`);
}
console.log('SOUHRN');
console.log(`  rámeček vložen: ${pocet('ramecek', 'vlozen')}`);
console.log(`  rámeček už byl: ${pocet('ramecek', 'uz-je')}`);
console.log(`  FAQ vloženo: ${pocet('faq', 'vlozeno')}`);
console.log(`  FAQ přeskočeno: ${pocet('faq', 'preskoceno')}`);
console.log(`  beze změny: ${vysledky.filter((x) => x.rel && !x.zmena).length}`);
console.log(`  zapsáno: ${DRY ? 0 : vysledky.filter((x) => x.zmena).length}`);
console.log(`  chyb: ${vysledky.filter((x) => x.chyba || x.ramecek === 'chyba' || x.faq === 'chyba').length}`);
const chyb = vysledky.some((x) => x.chyba || x.ramecek === 'chyba' || x.faq === 'chyba' || x.jsonld === 'chyba');
process.exit(chyb ? 1 : 0);
