#!/usr/bin/env node
/**
 * Převod blogového článku (clanky/<slug>.html) na newsletterový mail.
 *
 * Výstupem NENÍ hotový mail, ale `blocks` pro tabulku `email_templates`
 * v Academy projektu. Mail z nich skládá edge funkce `drip-send`
 * (akademie/_supabase/functions/drip-send/index.ts), která přidá obálku,
 * patičku, odhlašovací odkaz i vokativ. Kdyby renderer vyráběl celé HTML,
 * obešel by to všechno a mail by odešel bez odhlášení.
 *
 * ⛔ PROČ JEN ČTYŘI TYPY BLOKŮ: `drip-send` zná `p`, `ps`, `bullets`, `btn`, `img`
 * a na neznámém typu se render PŘED odesláním rozbije, takže mail tiše neodejde
 * (21. 8. 2026 to zablokovalo 192 leadů). Nadpisy proto jdou dovnitř bloku `p`
 * jako inline `<span>`, ne jako vlastní typ bloku.
 *
 * ⛔ OBRÁZKY: martinbarna.cz vrací Googlově obrázkové proxy 401, takže obrázek
 * z webu se v Gmailu NEZOBRAZÍ (změřeno 31. 7. 2026). Obrázky se proto ve
 * výchozím stavu VYNECHÁVAJÍ. `--obrazky` je zapne, ale skript u každého křikne.
 * ⛔ Přílohy se nepřipojují nikdy, mail je vždy jen text a odkazy.
 *
 * Použití:
 *   node scripts/clanek-do-mailu.mjs <slug|cesta> [prepinace]
 *
 * Přepínače:
 *   --out <dir>       kam zapsat výstupy (výchozí: _newsletter-vystup vedle repa)
 *   --track <nazev>   trať pro email_templates (výchozí: blog-newsletter)
 *   --step <n>        krok tratě (výchozí: 0)
 *   --zkratit <n>     do mailu vzít jen prvních n sekcí (h2) a odkázat na web
 *   --obrazky         nevynechávat obrázky z těla článku
 *   --bez-utm         nepřidávat utm_* do odkazů na martinbarna.cz
 *   --dalsi a,b,c     slugy článků do bloku "další ke čtení" (jinak se doplní z indexu)
 *   --tichy           nevypisovat souhrn, jen cesty k souborům
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const ROOT = path.resolve(SCRIPT_DIR, '..');
const ORIGIN = 'https://martinbarna.cz';
const EM_DASH = '\u2014';
const SQ = String.fromCharCode(39);

/* ---------- argumenty ---------- */

function parseArgs(argv) {
  const a = { pozice: [], out: null, track: 'blog-newsletter', step: 0, zkratit: 0, obrazky: false, utm: true, dalsi: null, tichy: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--out') a.out = argv[++i];
    else if (t === '--track') a.track = argv[++i];
    else if (t === '--step') a.step = Number(argv[++i]);
    else if (t === '--zkratit') a.zkratit = Number(argv[++i]);
    else if (t === '--obrazky') a.obrazky = true;
    else if (t === '--bez-utm') a.utm = false;
    else if (t === '--dalsi') a.dalsi = String(argv[++i]).split(',').map((s) => s.trim()).filter(Boolean);
    else if (t === '--tichy') a.tichy = true;
    else if (t.startsWith('--')) throw new Error('neznamy prepinac: ' + t);
    else a.pozice.push(t);
  }
  return a;
}

/* ---------- drobné pomůcky ---------- */

const esc = (s) => s.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;');
const dec = (s) => s
  .split('&nbsp;').join('\u00a0').split('&ndash;').join('\u2013').split('&mdash;').join(EM_DASH)
  .split('&hellip;').join('\u2026').split('&quot;').join('"').split('&#39;').join(SQ)
  .split('&lt;').join('<').split('&gt;').join('>').split('&amp;').join('&');
const strip = (s) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

/* ---------- čtení článku ---------- */

function najdiSoubor(vstup) {
  const kandidati = [
    vstup,
    path.join(ROOT, vstup),
    path.join(ROOT, 'clanky', vstup),
    path.join(ROOT, 'clanky', vstup + '.html'),
  ];
  for (const c of kandidati) if (fs.existsSync(c) && fs.statSync(c).isFile()) return path.resolve(c);
  throw new Error('clanek nenalezen: ' + vstup);
}

// JSON-LD BlogPosting nese headline i description, tedy přesně předmět a preheader.
function ctiJsonLd(html) {
  const out = {};
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data;
    try { data = JSON.parse(m[1]); } catch { continue; }
    const uzly = Array.isArray(data) ? data : [data];
    for (const u of uzly) {
      if (u && u['@type'] === 'BlogPosting') {
        if (u.headline) out.headline = String(u.headline);
        if (u.description) out.description = String(u.description);
        if (u.datePublished) out.datePublished = String(u.datePublished);
      }
    }
  }
  return out;
}

// Tělo článku bereme od <article> a končíme u author-boxu: podpis a portrét
// do mailu nepatří (odesílatel JE Martin) a portrét je obrázek z martinbarna.cz.
function telo(html) {
  const a = html.indexOf('<article');
  if (a < 0) throw new Error('v souboru neni <article>');
  const zacatek = html.indexOf('>', a) + 1;
  let konec = html.indexOf('<div class="author-box"', zacatek);
  if (konec < 0) konec = html.lastIndexOf('</article>');
  if (konec < 0) throw new Error('nenasel jsem konec clanku');
  return html.slice(zacatek, konec);
}

/* ---------- odkazy ---------- */

function absolutni(href, slug) {
  let h = dec(href).trim();
  if (h.startsWith('http://') || h.startsWith('https://')) return h;
  if (h.startsWith('mailto:') || h.startsWith('tel:')) return h;
  if (h.startsWith('#')) return ORIGIN + '/clanky/' + slug + '.html' + h;
  if (h.startsWith('/')) return ORIGIN + h;
  if (h.startsWith('../')) return ORIGIN + '/' + h.slice(3);
  return ORIGIN + '/clanky/' + h;              // sousední článek
}

function sUtm(url, slug, utm) {
  if (!utm) return url;
  if (!url.startsWith(ORIGIN)) return url;      // cizí doménu (PubMed, Stripe) nešaháme
  if (url.includes('utm_source=')) return url;
  const [zaklad, kotva] = url.split('#');
  const spoj = zaklad.includes('?') ? '&' : '?';
  const q = 'utm_source=newsletter&utm_medium=email&utm_campaign=clanek-' + slug;
  return zaklad + spoj + q + (kotva ? '#' + kotva : '');
}

// Inline obsah odstavce: <a> se přepíše na absolutní odkaz s UTM, zbytek značek
// se zahodí. `drip-send` vkládá html bloku `p` BEZ escapování, takže sem nesmí
// projít nic, co jsme sami nepostavili.
function inline(frag, slug, utm) {
  let s = frag;
  s = s.replace(/<br\s*\/?>/gi, '<br>');
  s = s.replace(/<\/?(strong|b)>/gi, (m) => (m[1] === '/' ? '</strong>' : '<strong>'));
  s = s.replace(/<\/?(em|i)>/gi, (m) => (m[1] === '/' ? '</em>' : '<em>'));
  s = s.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, text) => {
    const url = sUtm(absolutni(href, slug), slug, utm);
    const popisek = strip(text);
    if (!popisek) return '';
    // & v atributu musí být &amp;, jinak je to nevalidní HTML; drip-send si to
    // v textové verzi mailu vrátí zpět (inlineToText nakonec dělá &amp; -> &).
    const bezpecna = url.split(SQ).join('%27').split('&').join('&amp;');
    return `<a href='${bezpecna}' style='color:#F6CD63'>${esc(dec(popisek))}</a>`;
  });
  // co zbylo ze značek, pryč; text se pak escapuje po částech mimo naše vlastní tagy
  s = s.replace(/<(?!\/?(a|strong|em|br)\b)[^>]*>/gi, '');
  return dodrzUvozovky(s).replace(/\s+/g, ' ').trim();
}

// Escapování textu MIMO značky, které jsme sami postavili.
function dodrzUvozovky(s) {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const a = s.indexOf('<', i);
    if (a < 0) { out += esc(dec(s.slice(i))); break; }
    out += esc(dec(s.slice(i, a)));
    const b = s.indexOf('>', a);
    if (b < 0) { out += esc(dec(s.slice(a))); break; }
    out += s.slice(a, b + 1);
    i = b + 1;
  }
  return out;
}

/* ---------- převod na bloky ---------- */

const NADPIS = (t) => `<span style='font-size:19px;font-weight:800;color:#EBB12C'>${t}</span>`;
const PODNADPIS = (t) => `<span style='font-size:16px;font-weight:800;color:#F0EADF'>${t}</span>`;

function naBloky(telolHtml, slug, opts) {
  const bloky = [];
  const obrazky = [];
  let sekci = 0;
  let utnuto = false;

  // Zpracováváme značka po značce na nejvyšší úrovni článku.
  const re = /<(p|h2|h3|h4|ul|ol|div|table|figure|blockquote)\b([^>]*)>/gi;
  let m;
  let pozice = 0;
  const uzly = [];
  while ((m = re.exec(telolHtml))) {
    if (m.index < pozice) continue;
    const tag = m[1].toLowerCase();
    const konec = konecZnacky(telolHtml, m.index, tag);
    if (konec < 0) continue;
    uzly.push({ tag, atr: m[2], html: telolHtml.slice(telolHtml.indexOf('>', m.index) + 1, konec) });
    pozice = konec;
    re.lastIndex = konec;
  }

  for (const u of uzly) {
    if (opts.zkratit && sekci > opts.zkratit) { utnuto = true; break; }
    const trida = (u.atr.match(/class="([^"]*)"/) || [, ''])[1];

    if (u.tag === 'h2') { sekci++; if (opts.zkratit && sekci > opts.zkratit) { utnuto = true; break; }
      bloky.push({ t: 'p', html: NADPIS(inline(u.html, slug, opts.utm)) }); continue; }
    if (u.tag === 'h3' || u.tag === 'h4') { bloky.push({ t: 'p', html: PODNADPIS(inline(u.html, slug, opts.utm)) }); continue; }

    if (u.tag === 'p') {
      if (trida.includes('faq-q')) { bloky.push({ t: 'p', html: PODNADPIS(inline(u.html, slug, opts.utm)) }); continue; }
      const h = inline(u.html, slug, opts.utm);
      if (h) bloky.push({ t: 'p', html: h });
      continue;
    }

    if (u.tag === 'ul' || u.tag === 'ol') {
      const items = [...u.html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((x) => inline(x[1], slug, opts.utm)).filter(Boolean);
      if (items.length) bloky.push({ t: 'bullets', items });
      continue;
    }

    if (u.tag === 'table') {
      // Tabulka v mailu se rozpadá; převádíme na odrážky "sloupec1: zbytek".
      for (const r of u.html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const bunky = [...r[1].matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((c) => strip(dec(c[2])));
        if (!bunky.length) continue;
        const radek = bunky[0] + (bunky.length > 1 ? ': ' + bunky.slice(1).join(', ') : '');
        bloky.push({ t: 'p', html: esc(radek) });
      }
      continue;
    }

    if (u.tag === 'figure' || u.tag === 'blockquote') {
      const t = inline(u.html.replace(/<figcaption[\s\S]*?<\/figcaption>/gi, ''), slug, opts.utm);
      if (t) bloky.push({ t: 'p', html: t });
      continue;
    }

    if (u.tag === 'div' && trida.includes('cta-box')) {
      const nadpis = (u.html.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i) || [])[1];
      if (nadpis) bloky.push({ t: 'p', html: PODNADPIS(esc(dec(strip(nadpis)))) });
      for (const p of u.html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
        const h = inline(p[1], slug, opts.utm);
        if (h) bloky.push({ t: 'p', html: h });
      }
      for (const a of u.html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)) {
        const href = (a[0].match(/href="([^"]*)"/) || [])[1];
        if (!href) continue;
        bloky.push({ t: 'btn', text: strip(dec(a[0])), href: sUtm(absolutni(href, slug), slug, opts.utm) });
      }
      continue;
    }
  }

  // obrázky sbíráme zvlášť, ať je vidět, co jsme vynechali
  for (const im of telolHtml.matchAll(/<img\b[^>]*>/gi)) {
    const src = (im[0].match(/src="([^"]*)"/) || [])[1];
    const alt = (im[0].match(/alt="([^"]*)"/) || [, ''])[1];
    if (!src) continue;
    if (src.includes('/foto/martin/')) continue;          // portrét z author-boxu, do mailu nepatří
    obrazky.push({ src: absolutni(src, slug), alt: dec(alt) });
  }
  if (opts.obrazky) {
    for (const o of obrazky) bloky.push({ t: 'img', src: o.src, alt: o.alt || 'Ilustrace k článku' });
  }

  return { bloky, obrazky, utnuto };
}

// Konec značky se stejným jménem, s ohledem na vnoření.
function konecZnacky(s, od, tag) {
  const otv = new RegExp('<' + tag + '\\b', 'gi');
  const zav = new RegExp('</' + tag + '\\s*>', 'gi');
  let hloubka = 0;
  let i = od;
  while (i < s.length) {
    otv.lastIndex = i; zav.lastIndex = i;
    const a = otv.exec(s); const b = zav.exec(s);
    if (!b) return -1;
    if (a && a.index < b.index) { hloubka++; i = a.index + 1; continue; }
    hloubka--;
    if (hloubka === 0) return b.index;
    i = b.index + 1;
  }
  return -1;
}

/* ---------- ocas mailu ---------- */

function ocas(slug, meta, dalsi, opts) {
  const b = [];
  const url = sUtm(ORIGIN + '/clanky/' + slug + '.html', slug, opts.utm);
  if (meta.utnuto) b.push({ t: 'p', html: 'Zbytek článku, včetně zdrojů a odkazů na studie, je na webu.' });
  b.push({ t: 'btn', text: meta.utnuto ? 'Dočíst celý článek' : 'Otevřít článek na webu', href: url });
  // Když článek sám končí rozcestníkem ("Mohlo by tě zajímat"), druhý seznam
  // odkazů hned pod ním je jen šum; vlastní blok pak vynecháme.
  if (dalsi.length && !meta.maRozcestnik) {
    b.push({ t: 'p', html: PODNADPIS('Další ke čtení') });
    b.push({ t: 'bullets', items: dalsi.map((d) => `<a href='${sUtm(ORIGIN + '/clanky/' + d.slug + '.html', slug, opts.utm)}' style='color:#F6CD63'>${esc(d.titulek)}</a>`) });
  }
  b.push({ t: 'ps', html: 'Odepsat na tenhle mail můžeš, čtu to já.' });
  return b;
}

// "Další ke čtení" bereme z indexu blogu, ať odkazujeme jen na to, co je živě venku.
function dalsiZIndexu(slug, kolik) {
  const idx = path.join(ROOT, 'clanky', 'index.html');
  if (!fs.existsSync(idx)) return [];
  const html = fs.readFileSync(idx, 'utf8');
  const vse = [...html.matchAll(/"headline": "(.*?)", "url": "(.*?)", "datePublished": "(.*?)"/g)]
    .map((m) => ({ titulek: dec(m[1]), slug: m[2].replace(/^.*\/clanky\//, '').replace(/\.html$/, ''), datum: m[3] }))
    .filter((x) => x.slug !== slug);
  vse.sort((a, b) => b.datum.localeCompare(a.datum));
  return vse.slice(0, kolik);
}

/* ---------- kontroly, které smí zabít běh ---------- */

function kontroly(subject, preheader, bloky) {
  const chyby = [];
  const varovani = [];
  const vsechno = [subject, preheader, ...bloky.flatMap((b) => (b.t === 'bullets' ? b.items : [b.html, b.text, b.href, b.alt]))]
    .filter((x) => typeof x === 'string');

  for (const s of vsechno) {
    if (s.includes(EM_DASH)) chyby.push('dlouha pomlcka v textu: ' + s.slice(0, 90));
    // tyhle znaky si drip-send vykládá jako gender/proměnnou a mail by se rozbil
    for (const tok of ['{{', '[[', ']]', '[a]', '[\u00e1]']) {
      if (s.includes(tok)) chyby.push('token ' + tok + ' v textu: ' + s.slice(0, 90));
    }
  }
  for (const b of bloky) {
    if (!['p', 'ps', 'bullets', 'btn', 'img'].includes(b.t)) chyby.push('neznamy typ bloku: ' + b.t);
    if (b.t === 'btn' && !b.href.startsWith('https://')) chyby.push('tlacitko bez https odkazu: ' + b.href);
    if (b.t === 'img') varovani.push('OBRAZEK ' + b.src + ': Gmail obrazky z martinbarna.cz NEZOBRAZI (proxy dostane 401)');
  }
  for (const m of JSON.stringify(bloky).matchAll(/href=\\?'([^']*)'/g)) {
    if (!m[1].startsWith('https://')) chyby.push('relativni odkaz v tele: ' + m[1]);
  }
  if (subject.length > 78) varovani.push('predmet ma ' + subject.length + ' znaku, v seznamu posty se urizne');
  if (!bloky.some((b) => b.t === 'btn')) varovani.push('mail nema zadne tlacitko');
  return { chyby, varovani };
}

/* ---------- náhled (kopie obálky z drip-send, jen pro oči) ---------- */

function nahled(subject, preheader, bloky) {
  const telo = bloky.map((b) => {
    if (b.t === 'p') return `<p style="margin:0 0 14px">${b.html}</p>`;
    if (b.t === 'ps') return `<p style="margin:16px 0 0;color:#A09AAD;font-style:italic">${b.html}</p>`;
    if (b.t === 'bullets') return `<ul style="margin:0 0 14px;padding-left:20px">${b.items.map((li) => `<li style="margin:0 0 7px">${li}</li>`).join('')}</ul>`;
    if (b.t === 'img') return `<img src="${b.src}" alt="${b.alt}" width="100%" style="max-width:480px;height:auto;display:block;margin:16px auto;border-radius:8px">`;
    return `<p style="margin:4px 0 18px"><a href="${b.href}" style="display:inline-block;background:#EBB12C;color:#1A1222;text-decoration:none;padding:13px 26px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;font-size:15px">${b.text}</a></p>`;
  }).join('\n');
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#0C0B10">
<div style="max-width:560px;margin:0 auto;padding:16px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#8F8A99;font-size:12px">
NÁHLED. Ostrý mail skládá drip-send, tenhle soubor je jen na dívání.<br>Předmět: <b style="color:#F0EADF">${subject}</b><br>Preheader: ${preheader}
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0C0B10" style="background:#0C0B10"><tr><td align="center" style="padding:16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" bgcolor="#181520" style="width:100%;max-width:560px;background:#181520;border:1px solid #262232"><tr><td style="padding:28px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#F0EADF">
<div style="border-left:3px solid #EBB12C;padding-left:10px;font-weight:800;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#EBB12C;margin:0 0 20px">Martin Barna</div>
${telo}
<hr style="border:none;border-top:1px solid #262232;margin:22px 0 14px">
<div style="font-size:12px;line-height:1.5;color:#8F8A99">Sem drip-send doplní patičku a odhlašovací odkaz z app_config.</div>
</td></tr></table></td></tr></table></body></html>`;
}

/* ---------- SQL pro email_templates ---------- */

// ⛔ Apostrof v textu rozbije jsonb literál v jednoduchých uvozovkách (stalo se to
// při vkládání kroků 26. 8.), proto dolarové uvozování. Delimiter kontrolujeme,
// ať se nestane, že ho text obsahuje taky.
function naSql(z) {
  const json = JSON.stringify(z.blocks);
  let d = 'blocks';
  while (json.includes('$' + d + '$') || z.subject.includes('$' + d + '$')) d += 'x';
  const q = (s) => s.split(SQ).join(SQ + SQ);
  return `-- ${z.slug}  (článek vydán ${z.datePublished || '?'})
-- Zdroj: ${z.zdroj}
-- Vygeneroval scripts/clanek-do-mailu.mjs. Projekt Academy uhmrpfsdcujbhbtumqye.
-- ⛔ wait_days = null: krok se nesmí sám posouvat dál, newsletter řídí fronta, ne trať.
insert into public.email_templates (track, step, key, subject, preheader, blocks, wait_days)
values (
  '${q(z.track)}', ${z.step}, '${q(z.track + '-' + z.slug)}',
  '${q(z.subject)}',
  '${q(z.preheader)}',
  $${d}$${json}$${d}$::jsonb,
  null
)
on conflict (track, step) do update
  set key = excluded.key, subject = excluded.subject, preheader = excluded.preheader,
      blocks = excluded.blocks, wait_days = excluded.wait_days, updated_at = now();
`;
}

function naText(bloky) {
  const naProsty = (s) => dec(s.replace(/<a\b[^>]*href='([^']*)'[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)').replace(/<[^>]*>/g, ''));
  return bloky.map((b) => {
    if (b.t === 'bullets') return b.items.map((li) => '- ' + naProsty(li)).join('\n');
    if (b.t === 'btn') return b.text + ': ' + b.href;
    if (b.t === 'img') return '[obrázek: ' + b.alt + ']';
    return naProsty(b.html);
  }).join('\n\n');
}

/* ---------- běh ---------- */

function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a.pozice.length) {
    console.error('pouziti: node scripts/clanek-do-mailu.mjs <slug|cesta> [--out dir] [--zkratit n] [--obrazky] [--bez-utm]');
    process.exit(2);
  }
  const soubor = najdiSoubor(a.pozice[0]);
  const slug = path.basename(soubor).replace(/\.html$/, '');
  const html = fs.readFileSync(soubor, 'utf8');
  const ld = ctiJsonLd(html);

  const h1 = (html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
  const subject = dec(strip(ld.headline || h1 || slug));
  const popis = (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1];
  const preheader = dec(strip(ld.description || popis || '')).slice(0, 140);

  const opts = { zkratit: a.zkratit, obrazky: a.obrazky, utm: a.utm };
  const { bloky, obrazky, utnuto } = naBloky(telo(html), slug, opts);
  const dalsi = a.dalsi
    ? a.dalsi.map((s) => ({ slug: s, titulek: s.split('-').join(' ') }))
    : dalsiZIndexu(slug, 3);
  const maRozcestnik = bloky.some((b) => b.t === 'p' && typeof b.html === 'string'
    && /Mohlo by tě zajímat|Související články|Další ke čtení/.test(b.html));
  const vse = [...bloky, ...ocas(slug, { utnuto, maRozcestnik }, dalsi, opts)];

  const { chyby, varovani } = kontroly(subject, preheader, vse);
  if (chyby.length) {
    console.error('⛔ NEPROSLO, mail by se rozbil nebo by nesel ven:');
    for (const c of chyby) console.error('   ' + c);
    process.exit(1);
  }

  const out = path.resolve(a.out || path.join(ROOT, '..', '_newsletter-vystup'));
  fs.mkdirSync(out, { recursive: true });
  const zaznam = {
    track: a.track,
    step: a.step,
    slug,
    zdroj: ORIGIN + '/clanky/' + slug + '.html',
    datePublished: ld.datePublished || null,
    subject,
    preheader,
    blocks: vse,
  };
  const fBlocks = path.join(out, slug + '.blocks.json');
  const fNahled = path.join(out, slug + '.nahled.html');
  const fText = path.join(out, slug + '.txt');
  const fSql = path.join(out, slug + '.sql');
  fs.writeFileSync(fBlocks, JSON.stringify(zaznam, null, 2) + '\n', 'utf8');
  fs.writeFileSync(fNahled, nahled(subject, preheader, vse), 'utf8');
  fs.writeFileSync(fText, naText(vse) + '\n', 'utf8');
  fs.writeFileSync(fSql, naSql(zaznam), 'utf8');

  if (a.tichy) { console.log(fBlocks); console.log(fNahled); console.log(fText); console.log(fSql); return; }
  const znaku = naText(vse).length;
  console.log('článek:   ' + slug + (ld.datePublished ? '  (vydáno ' + ld.datePublished + ')' : ''));
  console.log('předmět:  ' + subject + '  [' + subject.length + ' znaků]');
  console.log('preheader:' + preheader);
  console.log('bloků:    ' + vse.length + '  (' + ['p', 'ps', 'bullets', 'btn', 'img'].map((t) => t + '=' + vse.filter((b) => b.t === t).length).join(' ') + ')');
  console.log('text:     ' + znaku + ' znaků' + (utnuto ? '  ⚠️ UTNUTO na ' + a.zkratit + ' sekcích' : ''));
  console.log('obrázků v článku: ' + obrazky.length + (a.obrazky ? ' (VLOŽENY)' : ' (vynechány)'));
  for (const v of varovani) console.log('⚠️  ' + v);
  for (const f of [fBlocks, fNahled, fText, fSql]) console.log('→ ' + f);
}

main();
