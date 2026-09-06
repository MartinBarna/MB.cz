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

/* ---------- PRODUKTOVÁ CTA (nahrazují magnety zdarma) ---------- */

// ⛔ ROZHODNUTÍ MARTIN 27. 8. 2026: newsletter jde lidem, kteří kontakt UŽ dali,
// většina právě výměnou za plány zdarma (/makro-plan/, /forma-zpet/). Nabízet jim
// týž magnet podruhé je promarněný mail. CTA boxy z článku se proto NEPŘEBÍRAJÍ
// a nahrazuje je jedna prodejní nabídka v půlce a jedna na konci.
//
// ⛔ CO SE ZAHAZUJE: celý `div.cta-box` (btn i doprovodné "je zdarma" odstavce)
// a navíc KAŽDÝ odstavec nebo odrážka s odkazem na magnet. Šest článků fronty má
// magnet vepsaný přímo do věty ("ženy tady, muži tady"), takže odstranit jen box
// nestačí a pouhé rozbalení odkazu by po sobě nechalo nesmyslnou větu.
const MAGNET = /(makro-plan|forma-zpet|plan-zeny|plan-muzi|plan-zdarma|\/kviz\/)/i;

// ⛔ CENY V TEXTU: jen u videokurzu, a to tokenem {{course_price}} (plní drip-send; 6. 9. 2026),
// tam je to v mailech zavedené. Appka se popisuje jako "Basic, nejlevnější placený
// plán" BEZ čísla: ceník se mění a mailové šablony jsou jediné místo, kde cena
// visí natvrdo (viz tvujcoach-cenik-zmena-checklist). Konzultace ani koučink
// cenu v mailu nemají vůbec.
//
// ⛔ RODNĚ NEUTRÁLNÍ TEXT: `drip-send` sice umí gender segmenty, ale token [a]
// kontroly níž zabíjejí, takže se tu nesmí objevit minulý čas ani rodové koncovky.
const NABIDKY = {
  appka: {
    popis: 'APPKA (Tvůj Coach, Basic)',
    url: 'https://tvujcoach.cz/?plan=basic',
    hlavni: {
      p: 'Tohle za tebe spočítá appka <strong>Tvůj Coach</strong>. Zapíšeš jídlo, ona sečte den a po týdnu ti sama řekne, jestli má cíl zůstat, nebo se posunout. Zápis jídla i tréninku je zdarma a bez karty, týdenní přepočet cílů a oba generátory patří k Basicu, nejlevnějšímu placenému plánu.',
      btn: 'Vyzkoušet Tvůj Coach',
    },
    zaver: {
      p: 'A jestli si tohle chceš hlídat v číslech místo od oka, appka <strong>Tvůj Coach</strong> ti den sečte za pár vteřin. Začít můžeš zdarma a bez zadávání karty.',
      btn: 'Otevřít appku',
    },
  },
  videokurz: {
    popis: 'VIDEOKURZ ({{course_price}} Kč jednorázově)',
    url: 'https://martinbarna.cz/videokurz',
    hlavni: {
      p: 'Jestli tohle chceš pochopit celé, a ne po kouskách, natočil jsem o tom <strong>videokurz výživy</strong>. 182 videí od kalorií a maker až po nákup a vaření. Jednorázově {{course_price}} Kč a zůstane ti napořád.',
      btn: 'Prohlédnout videokurz',
    },
    zaver: {
      p: 'Celý systém, ze kterého tenhle článek vychází, mám natočený ve <strong>videokurzu výživy</strong>. 182 videí, {{course_price}} Kč jednorázově, přístup napořád.',
      btn: 'Mrknout na videokurz',
    },
  },
  koucink: {
    popis: 'KOUČINK 1:1',
    url: 'https://martinbarna.cz/koucing/',
    hlavni: {
      p: 'Tohle se nejlíp ladí s někým, kdo ti na čísla kouká každý týden. Přesně to dělám v <strong>individuálním koučinku</strong>: plán na míru, pravidelné check-iny a úpravy podle toho, jak tělo reaguje.',
      btn: 'Jak koučink funguje',
    },
    zaver: {
      p: 'A jestli to nechceš řešit na vlastní pěst, vedu lidi v <strong>individuálním koučinku</strong> přesně přes tyhle situace.',
      btn: 'Mrknout na koučink',
    },
  },
  konzultace: {
    popis: 'KONZULTACE (jednorázová)',
    url: 'https://martinbarna.cz/konzultace/',
    hlavni: {
      p: 'Jestli tohle chceš probrat na tvoje čísla, a ne obecně, je na to <strong>jednorázová konzultace</strong>. Projdeme spolu jídelníček, trénink i to, co ti vychází z odběrů, a odcházíš s konkrétním plánem.',
      btn: 'Objednat konzultaci',
    },
    zaver: {
      p: 'A když to chceš probrat na tvoje konkrétní čísla, stačí hodina. Na <strong>konzultaci</strong> projdeme, co máš, a odcházíš s plánem, co dělat dál.',
      btn: 'Prohlédnout konzultaci',
    },
  },
  academy: {
    popis: 'BARNA ACADEMY (pro trenéry)',
    url: 'https://martinbarna.cz/akademie/',
    hlavni: {
      p: 'Jestli tohle učíš svoje klienty, mám to celé rozebrané v <strong>Barna Academy</strong>: 256 lekcí ve 24 modulech, generátory jídelníčků a tréninků pod tvou značkou a certifikace.',
      btn: 'Co všechno Academy obsahuje',
    },
    zaver: {
      p: 'Trenérům tohle rozebírám do hloubky v <strong>Barna Academy</strong>.',
      btn: 'Prohlédnout Academy',
    },
  },
};

// MAPOVÁNÍ TÉMA → NABÍDKA pro 25 článků fronty (`newsletter_fronta`, step 0 až 24).
// Klíč je slug, hodnota [hlavní CTA v půlce, CTA na konci]. Druhá nabídka smí být
// jiná, ale TŘETÍ se nepřidává: víc než dvě nabídky v jednom mailu si konkurují.
//
// Pravidla, podle kterých je to poskládané (a podle kterých se doplňuje nový článek):
//   kalorie, deficit, jídelníček, zapisování, potraviny  → appka
//   mýty, "co říká věda", komplexní pochopení výživy      → videokurz
//   hubnutí po 40/50, přechod, dlouhodobá změna, příběhy  → koučink (alternativa konzultace)
//   zdravotní téma, kde je potřeba individuální posouzení → konzultace
//   téma mířené na trenéry                                → academy
const MAPOVANI = {
  'hubnuti-po-40':                         ['koucink', 'konzultace'],
  'jak-zacit-hubnout':                     ['appka', 'videokurz'],
  'jak-zhubnout-v-obliceji':               ['videokurz', 'appka'],
  'kaloricky-deficit-kolik-jist':          ['appka', 'videokurz'],
  'vyhrez-plotenky':                       ['koucink', 'konzultace'],
  'elonga-hrv-veda-nebo-marketing':        ['videokurz', 'appka'],
  'vikendove-prejidani':                   ['appka', 'videokurz'],
  'hubnuti-a-vek-mozku':                   ['videokurz', 'koucink'],
  'kolik-spanku-delka-pravidelnost':       ['videokurz', 'koucink'],
  'cholesterol-co-snizuje-ldl':            ['videokurz', 'konzultace'],
  'inzulinova-rezistence-prediabetes':     ['konzultace', 'videokurz'],
  'menopauza-a-pribyvani-vahy':            ['koucink', 'konzultace'],
  'sarkopenie-svaly-po-50':                ['koucink', 'appka'],
  'vitamin-d-na-co-ma-smysl':              ['videokurz', 'appka'],
  'kreatin-pro-zeny':                      ['videokurz', 'appka'],
  'prerusovany-pust-co-rikaji-studie':     ['videokurz', 'appka'],
  'rostlinne-vs-zivocisne-bilkoviny-svaly': ['appka', 'videokurz'],
  'co-jist-pri-hubnuti':                   ['appka', 'videokurz'],
  'injekce-na-hubnuti-ozempic':            ['konzultace', 'videokurz'],
  'jak-rychle-zhubnout':                   ['koucink', 'appka'],
  'jak-zhubnout-bricho':                   ['appka', 'videokurz'],
  'silovy-trenink-pro-zeny':               ['appka', 'koucink'],
  'vzorovy-jidelnicek-na-hubnuti':         ['appka', 'videokurz'],
  'jist-vecer-tloustne':                   ['videokurz', 'appka'],
  'silovy-trenink-zlepsuje-mobilitu':      ['appka', 'videokurz'],
};

// Fallback pro článek, který v tabulce ještě není. Pořadí ROZHODUJE, bere se
// první shoda; proto jdou úzká témata (trenéři, přechod) před širokými (kalorie).
const FALLBACK = [
  [/trener|trenér|klient|akademi|certifikac|podnika/i, ['academy', 'videokurz']],
  [/po-40|po-50|menopauz|prechod|přechod|sarkopeni|hormon/i, ['koucink', 'konzultace']],
  [/lek|lék|ozempic|injekc|diabet|inzulin|cholesterol|stitna|štítná|krevni|krevní/i, ['konzultace', 'videokurz']],
  [/mytus|mýtus|veda|věda|studie|pust|půst|detox|zazrac|zázrač/i, ['videokurz', 'appka']],
  [/kalori|deficit|makra|jidelnicek|jídelníček|potravin|zapisov|hubnut|trenink|trénink/i, ['appka', 'videokurz']],
];

// Basic je hlavní prodávaný plán, takže když nic nesedí, jde se na appku.
const VYCHOZI = ['appka', 'videokurz'];

function vyberNabidky(slug, subject) {
  if (MAPOVANI[slug]) return { volba: MAPOVANI[slug], zdroj: 'tabulka' };
  const text = slug + ' ' + (subject || '');
  for (const [re, volba] of FALLBACK) if (re.test(text)) return { volba, zdroj: 'fallback' };
  return { volba: VYCHOZI, zdroj: 'vychozi' };
}

// UTM si u CTA lepíme sami: `sUtm` cizí doménu záměrně nešahá, a appka běží
// na tvujcoach.cz. Bez toho by proklik z newsletteru spadl do organiky.
// ⛔ NEPOUŽÍVAT https://martinbarna.cz/go/tc/: ten přesměrovač si utm_source
// PŘEPÍŠE na youtube/pin-tc (viz go/tc/index.html), takže by newsletter měřil cizí kanál.
function ctaBloky(klic, kde, slug, utm) {
  const n = NABIDKY[klic];
  if (!n) throw new Error('neznama nabidka: ' + klic);
  const t = n[kde];
  let url = n.url;
  if (utm) {
    const spoj = url.includes('?') ? '&' : '?';
    url += spoj + 'utm_source=newsletter&utm_medium=email&utm_campaign=clanek-' + slug;
  }
  return [{ t: 'p', html: t.p }, { t: 'btn', text: t.btn, href: url }];
}

// Hlavní CTA patří do půlky článku, ale ne doprostřed myšlenky: hledáme nadpis
// (h2) nejblíž středu a vkládáme těsně před něj. Bez nadpisu padne přesně doprostřed.
function vlozHlavniCta(bloky, cta) {
  if (!bloky.length) return [...cta];
  const stred = Math.floor(bloky.length / 2);
  let kam = -1;
  let nejlepsi = Infinity;
  for (let i = 1; i < bloky.length; i++) {
    const b = bloky[i];
    if (b.t !== 'p' || typeof b.html !== 'string') continue;
    if (!b.html.startsWith("<span style='font-size:19px")) continue;
    const d = Math.abs(i - stred);
    if (d < nejlepsi) { nejlepsi = d; kam = i; }
  }
  if (kam < 0) kam = stred;
  return [...bloky.slice(0, kam), ...cta, ...bloky.slice(kam)];
}

function naBloky(telolHtml, slug, opts) {
  const bloky = [];
  const obrazky = [];
  const zahozeno = [];        // co jsme vyhodili, ať je to v souhrnu vidět
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
      // Odstavec, který láká na magnet zdarma, jde celý pryč. Rozbalit jen odkaz
      // nejde: zbyla by věta typu "ženy tady, muži tady".
      if (MAGNET.test(u.html)) { zahozeno.push('odstavec s magnetem: ' + strip(dec(u.html)).slice(0, 70)); continue; }
      if (trida.includes('faq-q')) { bloky.push({ t: 'p', html: PODNADPIS(inline(u.html, slug, opts.utm)) }); continue; }
      const h = inline(u.html, slug, opts.utm);
      if (h) bloky.push({ t: 'p', html: h });
      continue;
    }

    if (u.tag === 'ul' || u.tag === 'ol') {
      const items = [];
      for (const x of u.html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
        if (MAGNET.test(x[1])) { zahozeno.push('odrážka s magnetem: ' + strip(dec(x[1])).slice(0, 70)); continue; }
        const h = inline(x[1], slug, opts.utm);
        if (h) items.push(h);
      }
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

    // ⛔ CTA box z článku se do mailu NEPŘEBÍRÁ, ani když nevede na magnet.
    // Články jich mají dva až šest a mířily na webového návštěvníka, který kontakt
    // teprve dává. Čtenář newsletteru ho už dal, takže dostane místo nich jednu
    // prodejní nabídku v půlce a jednu na konci (viz NABIDKY a MAPOVANI nahoře).
    if (u.tag === 'div' && trida.includes('cta-box')) {
      const nadpis = strip(dec((u.html.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i) || [, ''])[1]));
      const cile = [...u.html.matchAll(/href="([^"]*)"/gi)].map((x) => x[1]).join(' ');
      zahozeno.push('cta-box: ' + (nadpis || '(bez nadpisu)').slice(0, 50) + ' → ' + cile.slice(0, 90));
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

  return { bloky, obrazky, utnuto, zahozeno };
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
  // Závěrečná nabídka jde AŽ ZA odkazy na další články, ať mail končí nabídkou
  // a ne rozcestníkem. Tlačítko "Otevřít článek" se jako nabídka nepočítá,
  // vede na týž text, který člověk zrovna čte.
  b.push(...ctaBloky(meta.zaver, 'zaver', slug, opts.utm));
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
    // Výjimka: {{course_price}} je jediný povolený token, drip-send ho plní z konstanty COURSE_PRICE
    // (stejně jako 53 dalších šablon); cena se do textu nepíše natvrdo (6. 9. 2026).
    for (const tok of ['{{', '[[', ']]', '[a]', '[\u00e1]']) {
      if (s.replaceAll('{{course_price}}', '').includes(tok)) chyby.push('token ' + tok + ' v textu: ' + s.slice(0, 90));
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

  // ⛔ MAGNET ZDARMA V NEWSLETTERU = VADA, ne varování. Adresát kontakt už dal,
  // druhá nabídka téhož plánu je promarněný mail (Martin 27. 8. 2026).
  const cely = JSON.stringify(bloky);
  if (MAGNET.test(cely)) {
    const kde = (cely.match(MAGNET) || [])[0];
    chyby.push('odkaz na magnet zdarma zustal v mailu: ' + kde);
  }
  // Nabídky se počítají podle tlačítek mimo odkaz na samotný článek.
  const nabidkovych = bloky.filter((b) => b.t === 'btn' && !b.href.includes('/clanky/')).length;
  if (nabidkovych > 2) chyby.push('mail ma ' + nabidkovych + ' prodejnich tlacitek, povolene jsou nejvyse 2');
  if (nabidkovych < 2) varovani.push('mail ma jen ' + nabidkovych + ' prodejni tlacitko');

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
  const { bloky, obrazky, utnuto, zahozeno } = naBloky(telo(html), slug, opts);
  const dalsi = a.dalsi
    ? a.dalsi.map((s) => ({ slug: s, titulek: s.split('-').join(' ') }))
    : dalsiZIndexu(slug, 3);
  const maRozcestnik = bloky.some((b) => b.t === 'p' && typeof b.html === 'string'
    && /Mohlo by tě zajímat|Související články|Další ke čtení/.test(b.html));

  const { volba, zdroj } = vyberNabidky(slug, subject);
  const [hlavni, zaver] = volba;
  const sCtou = vlozHlavniCta(bloky, ctaBloky(hlavni, 'hlavni', slug, opts.utm));
  const vse = [...sCtou, ...ocas(slug, { utnuto, maRozcestnik, zaver }, dalsi, opts)];

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
    nabidka: { hlavni, zaver, zdroj },
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
  console.log('nabídky:  půlka = ' + NABIDKY[hlavni].popis + '   konec = ' + NABIDKY[zaver].popis
    + '  (' + zdroj + ')');
  console.log('zahozeno: ' + zahozeno.length + ' bloků z článku');
  for (const z of zahozeno) console.log('          - ' + z);
  console.log('bloků:    ' + vse.length + '  (' + ['p', 'ps', 'bullets', 'btn', 'img'].map((t) => t + '=' + vse.filter((b) => b.t === t).length).join(' ') + ')');
  console.log('text:     ' + znaku + ' znaků' + (utnuto ? '  ⚠️ UTNUTO na ' + a.zkratit + ' sekcích' : ''));
  console.log('obrázků v článku: ' + obrazky.length + (a.obrazky ? ' (VLOŽENY)' : ' (vynechány)'));
  for (const v of varovani) console.log('⚠️  ' + v);
  for (const f of [fBlocks, fNahled, fText, fSql]) console.log('→ ' + f);
}

main();
