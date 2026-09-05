#!/usr/bin/env node
/**
 * Publikace blogového článku z markdown draftu.
 *
 * Šablona chrome (head assety, inline CSS, navigace, author box, patička)
 * se bere 1:1 z clanky/hubnuti-po-40.html. Doplní se title/meta/OG/canonical
 * z hlavičky draftu, tělo článku, CTA s natvrdo barvami, FAQ + JSON-LD.
 *
 * Použití:
 *   node scripts/blog-publikuj.mjs <cesta-k-draftu.md> [--force] [--dry]
 *
 * Hlavička draftu (povinné): Klíčové slovo, Navržená URL, CTA, Zdroje.
 * Volitelné: Kategorie, Emoji, Filtr, Popis, Meta, Datum, Související, SEO title
 * (kratší text jen pro <title>; h1 i og:title zůstávají z nadpisu). <title> včetně
 * " | Martin Barna" smí mít max 70 znaků, Meta max 170, jinak běh spadne.
 *
 * Idempotentní: druhý běh na týž slug nezdvojí kartu ani sitemap záznam.
 * Bez --force skončí, když clanky/<slug>.html už existuje.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..');

const ORIGIN = 'https://martinbarna.cz';
const TEMPLATE_REL = 'clanky/hubnuti-po-40.html';
const INDEX_REL = 'clanky/index.html';
const SITEMAP_REL = 'sitemap.xml';
const EM_DASH = '\u2014';

const MESICE = [
  'leden', 'únor', 'březen', 'duben', 'květen', 'červen',
  'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec',
];

const FIELD_ALIASES = new Map([
  ['klicove slovo', 'keyword'],
  ['klíčové slovo', 'keyword'],
  ['keyword', 'keyword'],
  ['navrzena url', 'url'],
  ['navržená url', 'url'],
  ['url', 'url'],
  ['slug', 'url'],
  ['cta', 'cta'],
  ['zdroje', 'sources'],
  ['sources', 'sources'],
  ['kategorie', 'category'],
  ['rubrika', 'category'],
  ['tag', 'category'],
  ['emoji', 'emoji'],
  ['iko', 'emoji'],
  ['ico', 'emoji'],
  ['filtr', 'filter'],
  ['data-cat', 'filter'],
  ['cat', 'filter'],
  ['popis', 'og'],
  ['og', 'og'],
  ['og description', 'og'],
  ['meta', 'meta'],
  ['description', 'meta'],
  ['meta description', 'meta'],
  ['datum', 'date'],
  ['date', 'date'],
  ['souvisejici', 'related'],
  ['související', 'related'],
  ['related', 'related'],
  ['nadpis', 'title'],
  ['title', 'title'],
  ['seo title', 'seoTitle'],
  ['seo titulek', 'seoTitle'],
  ['title tag', 'seoTitle'],
]);

// <title> = nadpis + tenhle sufix; Google ho zkracuje kolem 60 až 65 znaků, nad 70 běh spadne.
const TITLE_SUFFIX = ' | Martin Barna';
const TITLE_TAG_MAX = 70;

const MULTILINE_KEYS = new Set(['cta', 'sources', 'related']);

const CTA_PRESETS = {
  'makro-plan': {
    midTitle: '🎁 Nechceš to ladit metodou pokus omyl?',
    endTitle: 'Nechceš to ladit metodou pokus omyl?',
    text: 'Připravil jsem plán, kde máš kalorie i makra spočítané a rozepsané do jídel. Je zdarma.',
    buttons: [
      { href: '/makro-plan/', label: 'Pro ženy → makro plán', variant: 'white' },
      { href: '/forma-zpet/', label: 'Pro muže → forma zpět', variant: 'gold' },
    ],
    endButtons: [
      { href: '/makro-plan/', label: 'Ženy → martinbarna.cz/makro-plan', variant: 'white' },
      { href: '/forma-zpet/', label: 'Muži → martinbarna.cz/forma-zpet', variant: 'gold' },
    ],
  },
  koučink: {
    midTitle: '🎁 Nechceš to ladit metodou pokus omyl?',
    endTitle: 'Nechce se ti řešit všechno sám?',
    text: 'V koučinku ti nastavím jídlo, trénink i návyky na míru. Ozvi se na nezávaznou konzultaci.',
    buttons: [
      { href: '/konzultace/', label: 'Konzultace', variant: 'white' },
      { href: '/koucing/', label: 'Koučink na míru', variant: 'gold' },
    ],
  },
  videokurz: {
    midTitle: '🎁 Chceš to mít krok za krokem v videích?',
    endTitle: 'Chceš to mít krok za krokem v videích?',
    text: 'Videokurz máš jednorázově, bez předplatného. Celý systém jídla a tréninku, ať nemusíš skládat dílky sám.',
    buttons: [
      { href: '/videokurz', label: 'Videokurz', variant: 'white' },
    ],
  },
  academy: {
    midTitle: '🎁 Pro trenéry a poradce',
    endTitle: 'Pro trenéry a poradce',
    text: 'Barna Academy je celý systém, ne jeden článek. Lekce, nástroje a metodika z praxe.',
    buttons: [
      { href: '/akademie/', label: 'Barna Academy', variant: 'white' },
    ],
  },
};
CTA_PRESETS['forma-zpet'] = CTA_PRESETS['makro-plan'];
CTA_PRESETS.lead = CTA_PRESETS['makro-plan'];
CTA_PRESETS.plan = CTA_PRESETS['makro-plan'];
CTA_PRESETS.koucing = CTA_PRESETS.koučink;
CTA_PRESETS.konzultace = CTA_PRESETS.koučink;
CTA_PRESETS.akademie = CTA_PRESETS.academy;

const FILTERS = new Set(['vyziva', 'trenink', 'myty', 'suplementy', 'trenerina', 'top']);

export function stripDiacritics(s) {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function todayIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function czechMonthYear(iso) {
  const [y, m] = iso.split('-').map(Number);
  return `${MESICE[m - 1]} ${y}`;
}

export function countEmDashes(s) {
  let n = 0;
  for (const ch of s) if (ch === EM_DASH) n += 1;
  return n;
}

function fieldKey(raw) {
  const k = raw.trim().replace(/\*+/g, '').replace(/:$/, '').trim().toLowerCase();
  return FIELD_ALIASES.get(k) || FIELD_ALIASES.get(stripDiacritics(k)) || null;
}

function looksLikeFieldLine(line) {
  const m = line.match(/^\s*(?:\*\*)?([^:*]+?)(?:\*\*)?\s*:\s*(.*)$/);
  if (!m) return null;
  const key = fieldKey(m[1]);
  if (!key) return null;
  return { key, value: m[2] };
}

export function parseSlugFromUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) throw new Error('Chybí Navržená URL.');
  let pathPart = s;
  pathPart = pathPart.replace(/^(https?:\/\/)?(www\.)?martinbarna\.cz/i, '');
  pathPart = pathPart.replace(/^\/+/, '');
  pathPart = pathPart.replace(/^clanky\//, '');
  pathPart = pathPart.replace(/\.html$/i, '');
  pathPart = pathPart.replace(/\/+$/, '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathPart)) {
    throw new Error(`Navržená URL nedává čistý slug (a-z, 0-9, pomlčka): ${raw}`);
  }
  return pathPart;
}

function parseRelatedLine(line) {
  const t = line.replace(/^\s*[-*]\s+/, '').trim();
  if (!t) return null;
  const md = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (md) return { title: md[1].trim(), href: normalizeArticleHref(md[2].trim()) };
  const pipe = t.split('|').map((x) => x.trim());
  if (pipe.length >= 2) {
    const href = normalizeArticleHref(pipe[0].includes('.html') || pipe[0].startsWith('/') ? pipe[0] : pipe[1]);
    const title = pipe[0].includes('.html') || pipe[0].startsWith('/') ? pipe[1] : pipe[0];
    return { title, href };
  }
  if (/\.html(\s|$)/.test(t) || t.startsWith('/')) {
    return { title: t.replace(/^.*\//, '').replace(/\.html$/, '').replace(/-/g, ' '), href: normalizeArticleHref(t) };
  }
  return null;
}

export function sanitizeHref(href) {
  const h = String(href || '').trim();
  if (!h) throw new Error('Prázdný odkaz v draftu.');
  if (/^\s*(javascript|data|vbscript):/i.test(h)) {
    throw new Error(`Podezřelý odkaz v draftu: ${h}`);
  }
  if (/^(https?:\/\/|\/|#)/i.test(h)) return h;
  if (/^[a-z0-9][a-z0-9./_-]*\.html(?:#.*)?$/i.test(h)) return h;
  throw new Error(`Odkaz musí být http(s), /cesta nebo soubor.html: ${h}`);
}

export function normalizeArticleHref(href) {
  let h = href.trim();
  h = h.replace(/^https?:\/\/(www\.)?martinbarna\.cz/i, '');
  if (h.startsWith('/clanky/')) h = h.slice('/clanky/'.length);
  return sanitizeHref(h);
}

function parseCta(raw) {
  const text = String(raw || '').trim();
  if (!text) throw new Error('Chybí pole CTA.');
  const first = text.split(/\r?\n/)[0].trim().toLowerCase();
  const presetKey = stripDiacritics(first).replace(/\s+/g, '-');
  if (text.indexOf('\n') === -1 && CTA_PRESETS[first]) return { preset: first, ...CTA_PRESETS[first] };
  if (text.indexOf('\n') === -1 && CTA_PRESETS[presetKey]) return { preset: presetKey, ...CTA_PRESETS[presetKey] };

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = { preset: 'custom', midTitle: '', endTitle: '', text: '', buttons: [] };
  let mode = null;
  for (const line of lines) {
    const m = line.match(/^(nadpis|title|text|tlacitka|tlačítka|zeny|ženy|muzi|muži)\s*:\s*(.*)$/i);
    if (m) {
      const k = stripDiacritics(m[1].toLowerCase());
      if (k === 'nadpis' || k === 'title') {
        out.midTitle = m[2].trim();
        out.endTitle = m[2].trim().replace(/^🎁\s*/, '');
      } else if (k === 'text') {
        out.text = m[2].trim();
      } else if (k === 'tlacitka') {
        mode = 'buttons';
        if (m[2].trim()) out.buttons.push(parseButton(m[2].trim()));
      } else if (k === 'zeny') {
        out.buttons.push({ href: '/makro-plan/', label: m[2].trim() || 'Pro ženy → makro plán', variant: 'white' });
      } else if (k === 'muzi') {
        out.buttons.push({ href: '/forma-zpet/', label: m[2].trim() || 'Pro muže → forma zpět', variant: 'gold' });
      }
      continue;
    }
    const md = line.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (md) {
      out.buttons.push({
        href: md[2].trim(),
        label: md[1].trim(),
        variant: out.buttons.length === 0 ? 'white' : 'gold',
      });
      continue;
    }
    if (mode === 'buttons' || line.startsWith('- ') || line.startsWith('* ')) {
      const btn = parseButton(line.replace(/^[-*]\s+/, ''));
      if (btn) out.buttons.push(btn);
      continue;
    }
    if (!out.midTitle) {
      out.midTitle = line;
      out.endTitle = line.replace(/^🎁\s*/, '');
    } else if (!out.text) {
      out.text = line;
    }
  }
  if (!out.midTitle) throw new Error('CTA: chybí nadpis. Použij preset (makro-plan, koučink, videokurz, academy) nebo `nadpis:`.');
  if (!out.text) out.text = 'Ozvi se, rád s tím pomůžu.';
  if (!out.buttons.length) {
    out.buttons = CTA_PRESETS['makro-plan'].buttons.map((b) => ({ ...b }));
  } else {
    out.buttons = out.buttons.map((b, i) => ({
      ...b,
      variant: b.variant && b.variant !== 'gold' ? b.variant : (i === 0 ? 'white' : 'gold'),
    }));
  }
  if (!out.endTitle) out.endTitle = out.midTitle.replace(/^🎁\s*/, '');
  return out;
}

function parseButton(line) {
  const t = line.trim();
  if (!t) return null;
  const md = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (md) return { href: md[2].trim(), label: md[1].trim(), variant: 'gold' };
  const pipe = t.split('|').map((x) => x.trim());
  if (pipe.length >= 2) {
    const href = pipe.find((x) => x.startsWith('/') || x.startsWith('http') || x.endsWith('.html')) || pipe[1];
    const label = pipe.find((x) => x !== href) || pipe[0];
    return { href, label, variant: 'gold' };
  }
  return { href: t, label: t, variant: 'gold' };
}

function inferCategory(keyword, category) {
  const src = `${category || ''} ${keyword || ''}`.toLowerCase();
  const fold = stripDiacritics(src);
  if (/trener|poradc/.test(fold)) return { category: 'Pro trenéry a poradce', filter: 'trenerina', emoji: '🤝', tag: 'PRO TRENÉRY A PORADCE' };
  if (/mytus|veda|myth/.test(fold)) return { category: 'Věda a mýty', filter: 'myty', emoji: '🔬', tag: 'VĚDA & MÝTY' };
  if (/suplement|kreatin|vitamin|proteinovy prasek/.test(fold)) return { category: 'Suplementy', filter: 'suplementy', emoji: '💊', tag: 'SUPLEMENTY' };
  if (/trenink|cvic|posil|sila/.test(fold)) return { category: 'Trénink', filter: 'trenink', emoji: '💪', tag: 'TRÉNINK' };
  if (/hubnut|dieta|kalor|tuk/.test(fold)) return { category: 'Hubnutí', filter: 'vyziva', emoji: '⏳', tag: 'HUBNUTÍ' };
  if (/spanek|zdrav/.test(fold)) return { category: 'Zdraví', filter: 'vyziva', emoji: '🩺', tag: 'ZDRAVÍ' };
  return { category: 'Výživa', filter: 'vyziva', emoji: '📝', tag: 'VÝŽIVA' };
}

function splitFaqAndRelated(bodyMd) {
  const lines = bodyMd.replace(/\r\n/g, '\n').split('\n');
  const faqIdx = lines.findIndex((l) => /^##\s+(časté otázky|caste otazky|faq)\s*$/i.test(l));
  const relIdx = lines.findIndex((l) => /^##\s+(mohlo by tě zajímat|mohlo by te zajimat|související|souvisejici)\s*$/i.test(l));
  let faqLines = [];
  let relLines = [];
  let bodyLines = lines.slice();
  const cuts = [];
  if (faqIdx >= 0) cuts.push({ idx: faqIdx, kind: 'faq' });
  if (relIdx >= 0) cuts.push({ idx: relIdx, kind: 'rel' });
  cuts.sort((a, b) => a.idx - b.idx);
  if (cuts.length) {
    bodyLines = lines.slice(0, cuts[0].idx);
    for (let i = 0; i < cuts.length; i++) {
      const end = i + 1 < cuts.length ? cuts[i + 1].idx : lines.length;
      const chunk = lines.slice(cuts[i].idx + 1, end);
      if (cuts[i].kind === 'faq') faqLines = chunk;
      else relLines = chunk;
    }
  }
  return {
    body: bodyLines.join('\n').trim(),
    faq: parseFaq(faqLines.join('\n')),
    related: relLines.map(parseRelatedLine).filter(Boolean),
  };
}

export function parseFaq(md) {
  const text = String(md || '').trim();
  if (!text) return [];
  const lines = text.split('\n');
  const items = [];
  let q = null;
  let a = [];
  const flush = () => {
    if (q && a.join('\n').trim()) {
      items.push({ q: q.trim(), a: a.join('\n').trim() });
    }
    q = null;
    a = [];
  };
  for (const line of lines) {
    const h3 = line.match(/^###\s+(.+)$/);
    const bold = line.match(/^\*\*(.+?)\*\*\s*$/);
    const qpref = line.match(/^otázka:\s*(.+)$/i);
    if (h3 || (bold && line.trim().startsWith('**')) || qpref) {
      flush();
      q = (h3 ? h3[1] : qpref ? qpref[1] : bold[1]).trim();
      continue;
    }
    if (q) a.push(line);
  }
  flush();
  return items;
}

export function parseDraft(raw) {
  if (raw.includes(EM_DASH)) {
    throw new Error('Draft obsahuje dlouhou pomlčku (—). Přepiš ji čárkou, dvojtečkou nebo tečkou.');
  }
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const fields = {};
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i += 1;

  let title = '';
  if (lines[i] && /^#\s+/.test(lines[i]) && !/^##/.test(lines[i])) {
    title = lines[i].replace(/^#\s+/, '').trim();
    i += 1;
    while (i < lines.length && !lines[i].trim()) i += 1;
  }

  let current = null;
  const bodyStartGuess = () => i;
  while (i < lines.length) {
    const line = lines[i];
    if (/^##\s+/.test(line)) break;
    const fl = looksLikeFieldLine(line);
    if (fl) {
      current = fl.key;
      fields[current] = fl.value;
      i += 1;
      continue;
    }
    if (current && MULTILINE_KEYS.has(current)) {
      if (!line.trim()) {
        const peek = lines.slice(i + 1).find((l) => l.trim());
        if (!peek || looksLikeFieldLine(peek) || /^##\s+/.test(peek) || /^#\s+/.test(peek)) {
          i += 1;
          current = null;
          continue;
        }
        // blank inside multiline: keep going if next looks like a list/source
        if (/^\s*(\d+[.)]\s+|[-*]\s+|\[)/.test(peek) || current === 'cta') {
          fields[current] = `${fields[current] || ''}\n`;
          i += 1;
          continue;
        }
        break;
      }
      fields[current] = `${fields[current] || ''}\n${line}`;
      i += 1;
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    break;
  }

  const bodyAndRest = lines.slice(bodyStartGuess()).join('\n').trim();
  if (!title) title = (fields.title || '').trim();
  if (!title) throw new Error('Chybí nadpis (řádek `# …` nebo pole Nadpis).');
  if (!fields.keyword) throw new Error('Chybí pole Klíčové slovo.');
  if (!fields.url) throw new Error('Chybí pole Navržená URL.');
  if (!fields.cta) throw new Error('Chybí pole CTA.');
  if (!fields.sources) throw new Error('Chybí pole Zdroje.');

  const slug = parseSlugFromUrl(fields.url);
  const canonical = `${ORIGIN}/clanky/${slug}.html`;
  const split = splitFaqAndRelated(bodyAndRest);
  const related = [
    ...(String(fields.related || '').split('\n').map(parseRelatedLine).filter(Boolean)),
    ...split.related,
  ];
  const seenRel = new Set();
  const relatedUnique = related.filter((r) => {
    if (seenRel.has(r.href)) return false;
    seenRel.add(r.href);
    return true;
  });

  const paragraphs = split.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  let lead = '';
  let restBody = split.body;
  if (paragraphs.length && !paragraphs[0].startsWith('##')) {
    lead = paragraphs[0].replace(/^>\s*/, '').trim();
    restBody = split.body.slice(split.body.indexOf(paragraphs[0]) + paragraphs[0].length).trim();
  }

  const inferred = inferCategory(fields.keyword, fields.category);
  const category = (fields.category || inferred.category).trim();
  const filter = (fields.filter || inferred.filter).trim();
  if (filter && !FILTERS.has(filter) && filter !== 'all') {
    throw new Error(`Neznámý Filtr "${filter}". Povolené: ${[...FILTERS].join(', ')}.`);
  }
  const emoji = (fields.emoji || inferred.emoji).trim();
  const tag = (fields.category ? fields.category.trim().toUpperCase() : inferred.tag);
  const date = (fields.date || todayIso()).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Datum musí být YYYY-MM-DD, je: ${date}`);
  }

  const og = (fields.og || '').trim() || clipSentence(lead, 160);
  const meta = (fields.meta || '').trim() || clipSentence(lead, 160);
  const seoTitle = (fields.seoTitle || '').trim() || title;
  const titleTag = `${seoTitle}${TITLE_SUFFIX}`;
  if (titleTag.length > TITLE_TAG_MAX) {
    throw new Error(`<title> má ${titleTag.length} znaků (max ${TITLE_TAG_MAX} včetně "${TITLE_SUFFIX.trim()}"). Zkrať nadpis, nebo dej do hlavičky kratší \`SEO title:\`.`);
  }
  if (meta.length > 170) {
    throw new Error(`Meta description má ${meta.length} znaků (max 170). Zkrať pole Meta.`);
  }
  const sources = String(fields.sources).split('\n').map((l) => l.replace(/^\s+/, '')).filter((l) => l.trim());
  const cta = parseCta(fields.cta);

  if (!lead) throw new Error('Chybí úvodní odstavec (lead) za hlavičkou.');
  if (!split.faq.length) throw new Error('Chybí sekce ## Časté otázky s aspoň jednou otázkou.');
  if (!sources.length) throw new Error('Pole Zdroje je prázdné.');

  const wordCount = countWords([lead, restBody, ...split.faq.map((f) => `${f.q} ${f.a}`)].join(' '));
  const minutes = Math.max(1, Math.round(wordCount / 200) || 1);

  return {
    title,
    seoTitle,
    titleTag,
    keyword: fields.keyword.trim(),
    slug,
    canonical,
    lead,
    body: restBody,
    faq: split.faq,
    related: relatedUnique,
    sources,
    cta,
    category,
    filter: filter || 'vyziva',
    emoji,
    tag,
    date,
    og,
    meta,
    minutes,
    wordCount,
  };
}

export function clipSentence(s, max) {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > 40 ? cut.slice(0, sp) : cut).replace(/[.,;:]+$/, '')}.`;
}

export function countWords(s) {
  return (s.replace(/<[^>]+>/g, ' ').match(/[A-Za-zÁ-ž0-9]+/g) || []).length;
}

export function inlineMarkdown(s) {
  let t = escapeHtml(s);
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
    const h = escapeHtml(normalizeArticleHref(href.replace(/&amp;/g, '&')));
    return `<a href="${h}">${text}</a>`;
  });
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  return t;
}

export function markdownToHtml(md) {
  const text = String(md || '').trim();
  if (!text) return '';
  const lines = text.split('\n');
  const out = [];
  let i = 0;
  const flushPara = (buf) => {
    const t = buf.join(' ').trim();
    if (t) out.push(`            <p>${inlineMarkdown(t)}</p>`);
    buf.length = 0;
  };
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (/^##\s+/.test(line)) {
      out.push(`            <h2>${inlineMarkdown(line.replace(/^##\s+/, '').trim())}</h2>`);
      i += 1;
      continue;
    }
    if (/^###\s+/.test(line)) {
      out.push(`            <h3>${inlineMarkdown(line.replace(/^###\s+/, '').trim())}</h3>`);
      i += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`                <li>${inlineMarkdown(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`);
        i += 1;
      }
      out.push(`            <ul>\n${items.join('\n')}\n            </ul>`);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(`                <li>${inlineMarkdown(lines[i].replace(/^\s*\d+[.)]\s+/, ''))}</li>`);
        i += 1;
      }
      out.push(`            <ol>\n${items.join('\n')}\n            </ol>`);
      continue;
    }
    const buf = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^#{2,3}\s+/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i])) {
      buf.push(lines[i]);
      i += 1;
    }
    flushPara(buf);
  }
  return out.join('\n');
}

export function renderCtaBox(cta, which) {
  const title = which === 'end' ? (cta.endTitle || cta.midTitle.replace(/^🎁\s*/, '')) : cta.midTitle;
  const buttons = which === 'end' && cta.endButtons ? cta.endButtons : cta.buttons;
  const btns = buttons.map((b, idx) => {
    const variant = b.variant || (idx === 0 ? 'white' : 'gold');
    const href = escapeHtml(sanitizeHref(b.href));
    if (variant === 'white') {
      return `                <a class="btn" href="${href}" style="background:#fff;color:#161616;">${escapeHtml(b.label)}</a>`;
    }
    return `                <a class="btn gold" href="${href}">${escapeHtml(b.label)}</a>`;
  }).join('\n');
  return [
    '            <div class="cta-box" style="background:#161616;color:#fff;">',
    `                <h3 style="color:#fff;">${escapeHtml(title)}</h3>`,
    `                <p style="color:#e8e8e8;">${escapeHtml(cta.text)}</p>`,
    btns,
    '            </div>',
  ].join('\n');
}

function splitBodySections(bodyHtml) {
  if (!bodyHtml.trim()) return [];
  const parts = bodyHtml.split(/(?=            <h2>)/);
  return parts.map((p) => p.replace(/^\n+/, '').replace(/\n+$/, '')).filter(Boolean);
}

export function jsonLdString(obj) {
  return JSON.stringify(obj, null, 2);
}

export function extractJsonLdBlocks(html) {
  const blocks = [];
  const re = /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g;
  let m;
  while ((m = re.exec(html))) blocks.push(m[1]);
  return blocks;
}

export function validateJsonLdBlocks(blocks) {
  const types = [];
  const errors = [];
  for (let i = 0; i < blocks.length; i++) {
    let data;
    try {
      data = JSON.parse(blocks[i]);
    } catch (e) {
      errors.push(`blok ${i + 1}: nevalidní JSON (${e.message})`);
      continue;
    }
    if (!data || typeof data !== 'object') {
      errors.push(`blok ${i + 1}: JSON není objekt`);
      continue;
    }
    const t = data['@type'];
    types.push(t);
    if (t === 'BlogPosting') {
      for (const k of ['headline', 'description', 'datePublished', 'mainEntityOfPage']) {
        if (!data[k]) errors.push(`BlogPosting: chybí ${k}`);
      }
    } else if (t === 'FAQPage') {
      if (!Array.isArray(data.mainEntity) || data.mainEntity.length === 0) {
        errors.push('FAQPage: prázdné mainEntity');
      } else {
        for (const q of data.mainEntity) {
          if (q['@type'] !== 'Question' || !q.name || !q.acceptedAnswer?.text) {
            errors.push('FAQPage: otázka bez name/acceptedAnswer.text');
          }
        }
      }
    } else if (t === 'BreadcrumbList') {
      if (!Array.isArray(data.itemListElement) || data.itemListElement.length < 3) {
        errors.push('BreadcrumbList: očekávám 3 položky (Domů, Blog, článek)');
      }
    }
  }
  return { types, errors };
}

export function loadChrome(templateHtml) {
  const styleStart = templateHtml.indexOf('    <style>');
  const styleEnd = templateHtml.indexOf('    </style>') + '    </style>'.length;
  if (styleStart < 0 || styleEnd < styleStart) throw new Error('Šablona: nenašel jsem <style>.');
  const faviconStart = templateHtml.indexOf('    <link rel="icon"');
  if (faviconStart < 0) throw new Error('Šablona: nenašel jsem favicon.');
  const assetsStart = templateHtml.indexOf('    <script defer src="/assets/analytics.js');
  const headEnd = templateHtml.indexOf('</head>');
  if (assetsStart < 0 || headEnd < 0) throw new Error('Šablona: nenašel jsem analytics / </head>.');
  const bodyStart = templateHtml.indexOf('<body>');
  const crumbsStart = templateHtml.indexOf('    <nav class="crumbs"');
  if (bodyStart < 0 || crumbsStart < 0) throw new Error('Šablona: nenašel jsem nav/crumbs.');
  const authorStart = templateHtml.indexOf('            <div class="author-box">');
  const articleClose = templateHtml.indexOf('        </article>');
  if (authorStart < 0 || articleClose < 0) throw new Error('Šablona: nenašel jsem author-box.');
  const footerStart = templateHtml.indexOf('    <footer>');
  if (footerStart < 0) throw new Error('Šablona: nenašel jsem footer.');
  const ogImg = (templateHtml.match(/property="og:image" content="([^"]+)"/) || [])[1]
    || `${ORIGIN}/assets/og-default.jpg?v=g7`;
  const twImg = (templateHtml.match(/name="twitter:image" content="([^"]+)"/) || [])[1] || ogImg;
  return {
    headPrefix: templateHtml.slice(0, templateHtml.indexOf('    <title>')),
    staticAfterTwitter: templateHtml.slice(faviconStart, styleStart),
    style: templateHtml.slice(styleStart, styleEnd),
    headAssets: templateHtml.slice(assetsStart, headEnd),
    bodyOpenNav: templateHtml.slice(bodyStart, crumbsStart),
    authorAndDisclaimer: templateHtml.slice(authorStart, articleClose),
    footerToEnd: templateHtml.slice(footerStart),
    ogImg,
    twImg,
  };
}

export function buildArticleHtml(draft, chrome) {
  const sections = splitBodySections(markdownToHtml(draft.body));
  const midAt = sections.length >= 3 ? 2 : Math.max(0, sections.length - 1);
  const before = sections.slice(0, midAt + 1);
  const after = sections.slice(midAt + 1);
  const faqHtml = [
    '            <h2>Časté otázky</h2>',
    ...draft.faq.flatMap((f) => [
      `            <p class="faq-q">${escapeHtml(f.q)}</p>`,
      `            <p>${inlineMarkdown(f.a)}</p>`,
    ]),
  ].join('\n');
  const sourcesHtml = [
    '            <p style="margin-top:2.5rem;">📚 Zdroje, ať si to můžeš ověřit:</p>',
    ...draft.sources.map((s, n) => {
      const t = s.trim();
      const numbered = /^\d+[.)]/.test(t) ? t : `${n + 1}) ${t}`;
      return `            <p>${escapeHtml(numbered)}</p>`;
    }),
  ].join('\n');
  const relatedHtml = draft.related.length
    ? [
      '            <h2>Mohlo by tě zajímat</h2>',
      '            <ul>',
      ...draft.related.map((r) => `                <li><a href="${escapeHtml(sanitizeHref(r.href))}">${escapeHtml(r.title)}</a></li>`),
      '            </ul>',
    ].join('\n')
    : '';

  const blogPosting = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: draft.title,
    description: draft.og,
    image: chrome.ogImg,
    datePublished: draft.date,
    dateModified: draft.date,
    author: { '@type': 'Person', name: 'Martin Barna', url: `${ORIGIN}/` },
    publisher: { '@type': 'Person', name: 'Martin Barna', url: `${ORIGIN}/` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': draft.canonical },
    articleSection: draft.category,
    inLanguage: 'cs-CZ',
  };
  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: draft.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a.replace(/\s+/g, ' ').trim() },
    })),
  };
  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Domů', item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${ORIGIN}/clanky/` },
      { '@type': 'ListItem', position: 3, name: draft.title, item: draft.canonical },
    ],
  };

  const articleInner = [
    `            <p class="lead">${inlineMarkdown(draft.lead)}</p>`,
    '',
    before.join('\n\n'),
    '',
    renderCtaBox(draft.cta, 'mid'),
    after.length ? `\n${after.join('\n\n')}\n` : '',
    faqHtml,
    '',
    renderCtaBox(draft.cta, 'end'),
    '',
    sourcesHtml,
    relatedHtml ? `\n${relatedHtml}\n` : '',
    chrome.authorAndDisclaimer,
  ].filter((x) => x !== '').join('\n');

  return `${chrome.headPrefix}    <title>${escapeHtml(draft.seoTitle || draft.title)}${TITLE_SUFFIX}</title>
    <meta name="description" content="${escapeHtml(draft.meta)}">
    <meta name="theme-color" content="#EBB12C">
    <link rel="canonical" href="${escapeHtml(draft.canonical)}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${escapeHtml(draft.canonical)}">
    <meta property="og:title" content="${escapeHtml(draft.title)}">
    <meta property="og:description" content="${escapeHtml(draft.og)}">
    <meta property="og:image" content="${escapeHtml(chrome.ogImg)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Martin Barna - online výživa a fitness koučink">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${escapeHtml(chrome.twImg)}">
${chrome.staticAfterTwitter}${chrome.style}
    <script type="application/ld+json">
${jsonLdString(blogPosting)}
    </script>
    <script type="application/ld+json">
${jsonLdString(faqPage)}
    </script>
    <script type="application/ld+json">
${jsonLdString(crumbs)}
    </script>
${chrome.headAssets}</head>
${chrome.bodyOpenNav}    <nav class="crumbs" aria-label="Drobečková navigace"><a href="../index.html">Domů</a> › <a href="index.html">Blog</a> › <span>${escapeHtml(draft.title)}</span></nav>
    <header class="hero" id="obsah">
        <span class="tag">${escapeHtml(draft.tag)}</span>
        <h1>${escapeHtml(draft.title)}</h1>
    <p class="hero-meta">📅 ${czechMonthYear(draft.date)} · ⏱️ ${draft.minutes} min čtení</p></header>

    <div class="wrapc">
        <article>
${articleInner}        </article>
    </div>

${chrome.footerToEnd}`;
}

export function renderCard(draft) {
  const tagp = escapeHtml(draft.tag).replace(/&amp;amp;/g, '&amp;');
  return `                <div class="col-md-6 col-lg-4 blog-card" data-cat="${escapeHtml(draft.filter)}" data-top="0"><a href="${escapeHtml(draft.slug)}.html" class="text-decoration-none"><div class="card p-4"><div class="ico">${draft.emoji}</div><div class="tagp">${tagp}</div><h5 class="card-title mt-1">${escapeHtml(draft.title)}</h5><p class="text-muted mb-0">${escapeHtml(draft.og)}</p></div></a></div>`;
}

export function renderBlogPostLine(draft) {
  return `        { "@type": "BlogPosting", "headline": ${JSON.stringify(draft.title)}, "url": ${JSON.stringify(draft.canonical)}, "datePublished": ${JSON.stringify(draft.date)} },`;
}

export function upsertIndex(indexHtml, draft) {
  if (!indexHtml.includes('"blogPost": [')) {
    throw new Error('clanky/index.html: nenašel jsem JSON-LD pole blogPost.');
  }
  if (!indexHtml.includes('<div class="row g-4">')) {
    throw new Error('clanky/index.html: nenašel jsem mřížku karet (.row.g-4).');
  }
  let html = stripIndexEntries(indexHtml, draft.slug, draft.canonical);
  const line = renderBlogPostLine(draft);
  const bp = html.indexOf('"blogPost": [');
  const bpInsert = bp + '"blogPost": ['.length;
  html = html.slice(0, bpInsert) + `\n${line}` + html.slice(bpInsert);
  const card = renderCard(draft);
  const row = html.indexOf('<div class="row g-4">');
  const rowInsert = row + '<div class="row g-4">'.length;
  html = html.slice(0, rowInsert) + `\n${card}` + html.slice(rowInsert);
  return html;
}

export function stripIndexEntries(html, slug, canonical) {
  // Jen jeden řádek: nesahej na sousední BlogPosting záznamy.
  const compact = new RegExp(
    `\\n[ \\t]*\\{ "@type": "BlogPosting",[^\\n]*"url": "${escapeRegex(canonical)}"[^\\n]*\\},`,
  );
  html = html.replace(compact, '');
  const multi = new RegExp(
    `\\n[ \\t]*\\{\\s*\\n\\s*"@type":\\s*"BlogPosting",[\\s\\S]{0,400}?"url":\\s*"${escapeRegex(canonical)}"[\\s\\S]{0,200}?\\n\\s*\\},`,
  );
  html = html.replace(multi, '');
  const cardRe = new RegExp(
    `\\n\\s*<div class="col-md-6 col-lg-4 blog-card"[^>]*>\\s*<a href="${escapeRegex(slug)}\\.html"[\\s\\S]*?</div></a></div>`,
  );
  html = html.replace(cardRe, '');
  return html;
}

export function countIndexMentions(html, slug, canonical) {
  const cards = (html.match(new RegExp(`href="${escapeRegex(slug)}\\.html"`, 'g')) || []).length;
  const posts = (html.match(new RegExp(escapeRegex(canonical), 'g')) || []).length;
  return { cards, posts };
}

export function upsertSitemap(xml, loc, lastmod) {
  const block = `  <url>\n    <loc>${escapeHtml(loc).replace(/&quot;/g, '"')}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>\n`;
  const locXml = loc.replace(/&/g, '&amp;');
  const re = new RegExp(
    `  <url>\\s*<loc>${escapeRegex(locXml)}</loc>\\s*<lastmod>[^<]*</lastmod>\\s*</url>\\n?`,
  );
  let next = xml.replace(re, '');
  const urlRe = /  <url>\s*<loc>([^<]+)<\/loc>/g;
  let insertPos = next.lastIndexOf('</urlset>');
  if (insertPos < 0) throw new Error('sitemap.xml: chybí </urlset>.');
  let m;
  while ((m = urlRe.exec(next))) {
    if (m[1] > locXml) {
      insertPos = m.index;
      break;
    }
  }
  next = next.slice(0, insertPos) + block + next.slice(insertPos);
  return next;
}

export function countSitemapLoc(xml, loc) {
  const locXml = loc.replace(/&/g, '&amp;');
  return (xml.match(new RegExp(`<loc>${escapeRegex(locXml)}</loc>`, 'g')) || []).length;
}

function parseArgs(argv) {
  const args = { force: false, dry: false, root: DEFAULT_ROOT, draft: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') args.force = true;
    else if (a === '--dry') args.dry = true;
    else if (a === '--root') args.root = path.resolve(argv[++i]);
    else if (a.startsWith('--root=')) args.root = path.resolve(a.slice('--root='.length));
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a.startsWith('-')) throw new Error(`Neznámý přepínač: ${a}`);
    else rest.push(a);
  }
  args.draft = rest[0] || null;
  return args;
}

function usage() {
  return `Použití: node scripts/blog-publikuj.mjs <draft.md> [--force] [--dry]

  draft.md   Markdown s hlavičkou Klíčové slovo, Navržená URL, CTA, Zdroje.
  --force    Přepsat existující clanky/<slug>.html (karta a sitemap se nezdvojí).
  --dry      Sestavit a zkontrolovat, nic nezapsat.

Šablona chrome: clanky/hubnuti-po-40.html
Výstupy: clanky/<slug>.html, karta + JSON-LD v clanky/index.html, záznam v sitemap.xml`;
}

export function publishDraft(opts) {
  const root = opts.root || DEFAULT_ROOT;
  const force = !!opts.force;
  const dry = !!opts.dry;
  const draftPath = path.resolve(opts.draftPath);
  if (!fs.existsSync(draftPath)) throw new Error(`Draft neexistuje: ${draftPath}`);
  const raw = fs.readFileSync(draftPath, 'utf8');
  const draft = parseDraft(raw);

  const templatePath = path.join(root, TEMPLATE_REL);
  const indexPath = path.join(root, INDEX_REL);
  const sitemapPath = path.join(root, SITEMAP_REL);
  const articlePath = path.join(root, 'clanky', `${draft.slug}.html`);

  for (const p of [templatePath, indexPath, sitemapPath]) {
    if (!fs.existsSync(p)) throw new Error(`Chybí soubor: ${p}`);
  }

  const existed = fs.existsSync(articlePath);
  if (existed && !force) {
    const err = new Error(`Cílový soubor už existuje: clanky/${draft.slug}.html (spusť s --force pro přepis).`);
    err.code = 'EXISTS';
    throw err;
  }

  const chrome = loadChrome(fs.readFileSync(templatePath, 'utf8'));
  const html = buildArticleHtml(draft, chrome);
  const jsonLd = extractJsonLdBlocks(html);
  const ld = validateJsonLdBlocks(jsonLd);
  const emArticle = countEmDashes(html);
  const issues = [];
  if (emArticle) issues.push(`článek má ${emArticle} dlouhých pomlček`);
  if (ld.errors.length) issues.push(...ld.errors);
  if (!ld.types.includes('BlogPosting')) issues.push('chybí JSON-LD BlogPosting');
  if (!ld.types.includes('FAQPage')) issues.push('chybí JSON-LD FAQPage');
  if (!ld.types.includes('BreadcrumbList')) issues.push('chybí JSON-LD BreadcrumbList');
  if (!html.includes('style="background:#161616;color:#fff;"')) {
    issues.push('CTA box nemá natvrdo barvy pozadí i textu');
  }

  const indexHtml = upsertIndex(fs.readFileSync(indexPath, 'utf8'), draft);
  const mentions = countIndexMentions(indexHtml, draft.slug, draft.canonical);
  if (mentions.cards !== 1) issues.push(`index karta: očekávám 1 výskyt href, je ${mentions.cards}`);
  if (mentions.posts < 1) issues.push('index JSON-LD: chybí BlogPosting url');
  const emIndex = countEmDashes(indexHtml) - countEmDashes(fs.readFileSync(indexPath, 'utf8'));
  if (emIndex > 0) issues.push(`index.html: nový obsah přidal ${emIndex} dlouhých pomlček`);

  const sitemap = upsertSitemap(fs.readFileSync(sitemapPath, 'utf8'), draft.canonical, draft.date);
  const smCount = countSitemapLoc(sitemap, draft.canonical);
  if (smCount !== 1) issues.push(`sitemap: očekávám 1 loc, je ${smCount}`);

  if (issues.length) {
    const err = new Error(`Kontrola selhala:\n  - ${issues.join('\n  - ')}`);
    err.code = 'CHECK';
    err.issues = issues;
    throw err;
  }

  if (!dry) {
    fs.writeFileSync(articlePath, html);
    fs.writeFileSync(indexPath, indexHtml);
    fs.writeFileSync(sitemapPath, sitemap);
  }

  return {
    draftPath,
    slug: draft.slug,
    title: draft.title,
    date: draft.date,
    cta: draft.cta.preset,
    existed,
    dry,
    force,
    files: {
      article: `clanky/${draft.slug}.html`,
      index: INDEX_REL,
      sitemap: SITEMAP_REL,
    },
    checks: {
      titleTag: draft.titleTag ? draft.titleTag.length : (draft.title + TITLE_SUFFIX).length,
      metaLength: draft.meta.length,
      emDashes: emArticle,
      jsonLd: ld.types,
      faq: draft.faq.length,
      sources: draft.sources.length,
      minutes: draft.minutes,
      words: draft.wordCount,
      indexCards: mentions.cards,
      sitemap: smCount,
    },
    html,
    indexHtml,
    sitemap,
  };
}

function printSummary(result) {
  const a = result.existed ? (result.force ? 'přepsáno (--force)' : 'existovalo') : 'nový';
  console.log('=== blog-publikuj ===');
  console.log(`draft:     ${result.draftPath}`);
  console.log(`slug:      ${result.slug}`);
  console.log(`title:     ${result.title}`);
  console.log(`datum:     ${result.date}`);
  console.log(`cta:       ${result.cta}`);
  console.log(result.dry ? 'zapsano:   NIC (--dry)' : 'zapsano:');
  if (!result.dry) {
    console.log(`  ${result.files.article}  (${a})`);
    console.log(`  ${result.files.index}               (karta nahoru + JSON-LD)`);
    console.log(`  ${result.files.sitemap}                     (url, bez duplicity)`);
  }
  console.log('kontrola:');
  console.log(`  dlouhe pomlcky:  ${result.checks.emDashes}`);
  console.log(`  title tag:       ${result.checks.titleTag} znaku (max ${TITLE_TAG_MAX})`);
  console.log(`  meta desc:       ${result.checks.metaLength} znaku (cil 120 az 160)`);
  console.log(`  JSON-LD bloky:   ${result.checks.jsonLd.length} validni (${result.checks.jsonLd.join(', ')})`);
  console.log(`  FAQ otazek:      ${result.checks.faq}`);
  console.log(`  zdroje:          ${result.checks.sources}`);
  console.log(`  cteni:           ${result.checks.minutes} min (${result.checks.words} slov)`);
  console.log(`  karet v indexu:  ${result.checks.indexCards}`);
  console.log(`  sitemap loc:     ${result.checks.sitemap}`);
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help || !args.draft) {
    console.log(usage());
    process.exit(args.help ? 0 : 1);
  }
  try {
    const result = publishDraft({
      draftPath: args.draft,
      root: args.root,
      force: args.force,
      dry: args.dry,
    });
    printSummary(result);
  } catch (e) {
    if (e.code === 'EXISTS') {
      console.error(`⛔ ${e.message}`);
      process.exit(2);
    }
    console.error(`⛔ ${e.message}`);
    process.exit(1);
  }
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) main();
