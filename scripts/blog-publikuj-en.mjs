#!/usr/bin/env node
/**
 * Publikace anglických článků z markdown draftů.
 *
 * Šablona chrome (head assety, inline CSS, EN navigace, author box, patička)
 * se bere z en/blog/_sablona.html. Draft má stejná pole jako český blog-publikuj
 * (včetně českých názvů). Navíc volitelně `CZ URL:` a `X teaser:`.
 *
 * Použití:
 *   node scripts/blog-publikuj-en.mjs [--drafty <slozka>] [--dry]
 *
 * Default složka draftů:
 *   C:/Users/fitne/Desktop/_Claude-dokumenty/2026-10-13_en-klienti/clanky-en/
 *
 * Idempotentní: přepíše en/blog/<slug>.html, výpis, sitemap fragment a X podklady.
 * Nesahe na sitemap.xml. Původní scripts/blog-publikuj.mjs nemění.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  parseDraft,
  loadChrome,
  renderCtaBox,
  markdownToHtml,
  inlineMarkdown,
  escapeHtml,
  sanitizeHref,
  jsonLdString,
  extractJsonLdBlocks,
  countEmDashes,
  plainText,
  countWords,
} from './blog-publikuj.mjs';
import { REF } from './geo-spolecne.mjs';

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..');
const ORIGIN = 'https://martinbarna.cz';
const EM_DASH = '\u2014';
const TITLE_SUFFIX = ' | Martin Barna';

export const DEFAULT_DRAFTY = 'C:/Users/fitne/Desktop/_Claude-dokumenty/2026-10-13_en-klienti/clanky-en';
export const DEFAULT_X_ARTICLES = 'C:/Users/fitne/Desktop/_Claude-dokumenty/2026-10-13_en-klienti/x-articles';
export const TEMPLATE_REL = 'en/blog/_sablona.html';
export const INDEX_REL = 'en/blog/index.html';
export const SITEMAP_FRAG_REL = 'en/blog/_sitemap-zaznamy.xml';

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const FORBIDDEN_CZECH = [
  'Články',
  'Kontakt',
  'Koučink',
  'Přihlásit',
  'Kč',
  'Tvůj Coach',
  'Časté otázky',
];

export const EN_CTA = {
  midTitle: 'Want me to coach you?',
  endTitle: 'Want me to coach you?',
  text: 'Gold coaching in English, fully written. A weekly report from your phone (3 minutes), my written answer with your plan, WhatsApp support Monday to Friday, calories and macros adjusted every week, a plan for eating out and travel. No video calls needed.',
  buttons: [
    { href: '/en/#apply', label: 'Apply for coaching', variant: 'white' },
    { href: '/en/#kit', label: 'Get the free Fat Loss Kit', variant: 'gold' },
  ],
};

export const INDEX_INTRO = 'Practical fat loss for busy people. No meal prep, no magic.';

const X_START = '2026-10-15'; // Thursday 15 October 2026

export function parseSlugFromUrlEn(raw) {
  const s = String(raw || '').trim();
  if (!s) throw new Error('Chybí Navržená URL.');
  let pathPart = s;
  pathPart = pathPart.replace(/^(https?:\/\/)?(www\.)?martinbarna\.cz/i, '');
  pathPart = pathPart.replace(/^\/+/, '');
  pathPart = pathPart.replace(/^en\/blog\//, '');
  pathPart = pathPart.replace(/^clanky\//, '');
  pathPart = pathPart.replace(/\.html$/i, '');
  pathPart = pathPart.replace(/\/+$/, '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathPart)) {
    throw new Error(`Navržená URL nedává čistý slug (a-z, 0-9, pomlčka): ${raw}`);
  }
  return pathPart;
}

export function englishDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) throw new Error(`Datum musí být YYYY-MM-DD, je: ${iso}`);
  const day = Number(m[3]);
  const month = Number(m[2]);
  return `${day} ${MONTHS_EN[month - 1]} ${m[1]}`;
}

export function weekdayName(iso) {
  const [y, mo, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return WEEKDAYS_EN[dt.getUTCDay()];
}

export function authorLineEn(iso) {
  return `<p class="hero-meta hero-byline" style="margin-top:.35rem;opacity:1">Author: <a href="/en/" style="color:inherit;text-decoration:underline;text-underline-offset:3px">Martin Barna</a> · Published <time datetime="${iso}">${englishDate(iso)}</time></p>`;
}

export function peelEnFields(raw) {
  const lines = String(raw || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n');
  let czUrl = '';
  let xTeaser = '';
  const kept = [];
  for (const line of lines) {
    const m = line.match(/^\s*(?:\*\*)?(CZ URL|X teaser)(?:\*\*)?\s*:\s*(.*)$/i);
    if (m) {
      if (/^cz url$/i.test(m[1])) czUrl = m[2].trim();
      else xTeaser = m[2].trim();
      continue;
    }
    kept.push(line);
  }
  return { text: kept.join('\n'), czUrl, xTeaser };
}

export function rewriteUrlFieldForCzParser(text) {
  return text.replace(
    /^(\s*(?:\*\*)?(?:Navržená URL|Navrzena URL|URL|slug)(?:\*\*)?\s*:\s*)(.+)$/im,
    (_, prefix, url) => `${prefix}/clanky/${parseSlugFromUrlEn(url)}.html`,
  );
}

export function normalizeCzUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  let p = s.replace(/^(https?:\/\/)?(www\.)?martinbarna\.cz/i, '');
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/+$/, '');
  if (!p.endsWith('.html')) p = `${p}.html`;
  return `${ORIGIN}${p}`;
}

export function czSwitcherHref(raw) {
  const abs = normalizeCzUrl(raw);
  if (!abs) return '/clanky/';
  return abs.replace(/^https:\/\/martinbarna\.cz/, '') || '/clanky/';
}

export function czFileFromUrl(czAbsOrPath) {
  const abs = normalizeCzUrl(czAbsOrPath);
  if (!abs) return '';
  return abs.replace(/^https:\/\/martinbarna\.cz\//, '');
}

export function parseEnDraft(raw) {
  if (String(raw).includes(EM_DASH)) {
    throw new Error('Draft obsahuje dlouhou pomlčku (—). Přepiš ji čárkou, dvojtečkou nebo tečkou.');
  }
  const peeled = peelEnFields(raw);
  const rewritten = rewriteUrlFieldForCzParser(peeled.text);
  const draft = parseDraft(rewritten);
  const canonical = `${ORIGIN}/en/blog/${draft.slug}.html`;
  return {
    ...draft,
    canonical,
    czUrl: normalizeCzUrl(peeled.czUrl),
    czHref: czSwitcherHref(peeled.czUrl),
    xTeaser: peeled.xTeaser,
    cta: { ...EN_CTA, buttons: EN_CTA.buttons.map((b) => ({ ...b })) },
  };
}

export function setLangSwitchHref(html, href) {
  const safe = escapeHtml(href || '/clanky/');
  const re = /(<a class="[^"]*lang-switch[^"]*" href=")[^"]*(")/;
  if (!re.test(html)) {
    throw new Error('Šablona: nenašel jsem přepínač jazyka .lang-switch.');
  }
  return html.replace(re, `$1${safe}$2`);
}

export function validateJsonLdEn(blocks) {
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
    if (t === 'Article' || t === 'BlogPosting') {
      for (const k of ['headline', 'description', 'datePublished', 'mainEntityOfPage']) {
        if (!data[k]) errors.push(`${t}: chybí ${k}`);
      }
      if (data.inLanguage !== 'en') errors.push(`${t}: inLanguage není en`);
      if (data.author?.['@id'] !== REF.martin['@id']) errors.push(`${t}: author není odkaz na #martin`);
      if (data.publisher?.['@id'] !== REF.org['@id']) errors.push(`${t}: publisher není odkaz na #org`);
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
      const items = data.itemListElement;
      if (!Array.isArray(items) || items.length < 2) {
        errors.push('BreadcrumbList: očekávám aspoň Home a Articles');
      } else {
        const names = items.map((x) => x.name);
        if (names[0] !== 'Home' || names[1] !== 'Articles') {
          errors.push('BreadcrumbList: první dvě položky mají být Home, Articles');
        }
        if (items.length === 2) {
          const url = typeof items[1].item === 'string' ? items[1].item : items[1].item?.['@id'];
          if (url !== `${ORIGIN}/en/blog/`) {
            errors.push('BreadcrumbList: dvoupoložkový seznam smí být jen výpis článků');
          }
        }
      }
    } else if (t === 'Blog') {
      if (data.inLanguage !== 'en') errors.push('Blog: inLanguage není en');
      if (!Array.isArray(data.blogPost)) errors.push('Blog: chybí pole blogPost');
    }
  }
  return { types, errors };
}

export function chromeTextForCzechCheck(html) {
  const nav = (html.match(/<div class="nav">[\s\S]*?<\/nav>/) || [''])[0];
  const footer = (html.match(/<footer>[\s\S]*?<\/footer>/) || [''])[0];
  const ctas = [...html.matchAll(/<div class="cta-box"[^>]*>[\s\S]*?<\/div>/g)].map((m) => m[0]);
  return [nav, footer, ...ctas].join('\n');
}

export function forbiddenCzechHits(html) {
  const text = chromeTextForCzechCheck(html);
  return FORBIDDEN_CZECH.filter((w) => text.includes(w));
}

export function hasPrice(html) {
  return /Kč|\bCZK\b|\$\d|\d[\d\s]*EUR\b|\bEUR\s*\d/i.test(html);
}

export function buildArticleHtmlEn(draft, chrome) {
  const bodyHtml = markdownToHtml(draft.body);
  const faqHtml = [
    '            <h2>Frequently asked questions</h2>',
    ...draft.faq.flatMap((f) => [
      `            <p class="faq-q">${escapeHtml(f.q)}</p>`,
      `            <p>${inlineMarkdown(f.a)}</p>`,
    ]),
  ].join('\n');
  const sourcesHtml = [
    '            <p style="margin-top:2.5rem;">Sources, so you can check:</p>',
    ...draft.sources.map((s, n) => {
      const t = s.trim();
      const numbered = /^\d+[.)]/.test(t) ? t : `${n + 1}) ${t}`;
      return `            <p>${escapeHtml(numbered)}</p>`;
    }),
  ].join('\n');

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: draft.title,
    description: draft.og,
    image: chrome.ogImg,
    datePublished: draft.date,
    dateModified: draft.date,
    author: { ...REF.martin },
    publisher: { ...REF.org },
    mainEntityOfPage: { '@type': 'WebPage', '@id': draft.canonical },
    articleSection: draft.category,
    inLanguage: 'en',
  };
  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: draft.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: plainText(inlineMarkdown(f.a)) },
    })),
  };
  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/en/` },
      { '@type': 'ListItem', position: 2, name: 'Articles', item: `${ORIGIN}/en/blog/` },
      { '@type': 'ListItem', position: 3, name: draft.title, item: draft.canonical },
    ],
  };

  const hreflang = [
    `    <link rel="alternate" hreflang="en" href="${escapeHtml(draft.canonical)}">`,
  ];
  if (draft.czUrl) {
    hreflang.push(`    <link rel="alternate" hreflang="cs" href="${escapeHtml(draft.czUrl)}">`);
    hreflang.push(`    <link rel="alternate" hreflang="x-default" href="${escapeHtml(draft.czUrl)}">`);
  }

  const articleInner = [
    `            <p class="lead">${inlineMarkdown(draft.lead)}</p>`,
    '',
    bodyHtml,
    '',
    faqHtml,
    '',
    renderCtaBox(draft.cta, 'end'),
    '',
    sourcesHtml,
    chrome.authorAndDisclaimer,
  ].filter((x) => x !== '').join('\n');

  const nav = setLangSwitchHref(chrome.bodyOpenNav, draft.czHref);

  return `${chrome.headPrefix}    <title>${escapeHtml(draft.seoTitle || draft.title)}${TITLE_SUFFIX}</title>
    <meta name="description" content="${escapeHtml(draft.meta)}">
    <meta name="theme-color" content="#EBB12C">
    <link rel="canonical" href="${escapeHtml(draft.canonical)}">
${hreflang.join('\n')}
    <meta property="og:type" content="article">
    <meta property="og:url" content="${escapeHtml(draft.canonical)}">
    <meta property="og:title" content="${escapeHtml(draft.title)}">
    <meta property="og:description" content="${escapeHtml(draft.og)}">
    <meta property="og:image" content="${escapeHtml(chrome.ogImg)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Martin Barna - online nutrition and fitness coach">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${escapeHtml(chrome.twImg)}">
${chrome.staticAfterTwitter}${chrome.style}
    <script type="application/ld+json">
${jsonLdString(articleLd)}
    </script>
    <script type="application/ld+json">
${jsonLdString(faqPage)}
    </script>
    <script type="application/ld+json">
${jsonLdString(crumbs)}
    </script>
${chrome.headAssets}</head>
${nav}    <nav class="crumbs" aria-label="Breadcrumb"><a href="/en/">Home</a> › <a href="/en/blog/">Articles</a> › <span>${escapeHtml(draft.title)}</span></nav>
    <header class="hero" id="obsah">
        <span class="tag">${escapeHtml(draft.tag)}</span>
        <h1>${escapeHtml(draft.title)}</h1>
    <p class="hero-meta">📅 ${englishDate(draft.date)} · ⏱️ ${draft.minutes} min read</p>${authorLineEn(draft.date)}</header>

    <div class="wrapc">
        <article>
${articleInner}        </article>
    </div>

${chrome.footerToEnd}`;
}

export function renderCardEn(draft) {
  return `                <a class="blog-card" href="/en/blog/${escapeHtml(draft.slug)}.html"><h2>${escapeHtml(draft.title)}</h2><p>${escapeHtml(draft.og)}</p></a>`;
}

export function buildIndexHtml(drafts, chrome) {
  const canonical = `${ORIGIN}/en/blog/`;
  const sorted = [...drafts].sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  const cards = sorted.length
    ? sorted.map(renderCardEn).join('\n')
    : '                <p class="empty-list">New articles will land here.</p>';
  const blogLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Articles - Martin Barna',
    description: INDEX_INTRO,
    url: canonical,
    inLanguage: 'en',
    author: { ...REF.martin },
    publisher: { ...REF.org },
    blogPost: sorted.map((d) => ({
      '@type': 'BlogPosting',
      headline: d.title,
      url: d.canonical,
      datePublished: d.date,
    })),
  };
  const crumbsLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/en/` },
      { '@type': 'ListItem', position: 2, name: 'Articles', item: canonical },
    ],
  };
  const nav = setLangSwitchHref(chrome.bodyOpenNav, '/clanky/');
  const cta = { ...EN_CTA, buttons: EN_CTA.buttons.map((b) => ({ ...b })) };

  return `${chrome.headPrefix}    <title>Articles | Martin Barna</title>
    <meta name="description" content="${escapeHtml(INDEX_INTRO)}">
    <meta name="theme-color" content="#EBB12C">
    <link rel="canonical" href="${escapeHtml(canonical)}">
    <link rel="alternate" hreflang="en" href="${escapeHtml(canonical)}">
    <link rel="alternate" hreflang="cs" href="${ORIGIN}/clanky/">
    <link rel="alternate" hreflang="x-default" href="${ORIGIN}/clanky/">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    <meta property="og:title" content="Articles | Martin Barna">
    <meta property="og:description" content="${escapeHtml(INDEX_INTRO)}">
    <meta property="og:image" content="${escapeHtml(chrome.ogImg)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Martin Barna - online nutrition and fitness coach">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${escapeHtml(chrome.twImg)}">
${chrome.staticAfterTwitter}${chrome.style}
    <script type="application/ld+json">
${jsonLdString(blogLd)}
    </script>
    <script type="application/ld+json">
${jsonLdString(crumbsLd)}
    </script>
${chrome.headAssets}</head>
${nav}    <nav class="crumbs" aria-label="Breadcrumb"><a href="/en/">Home</a> › <span>Articles</span></nav>
    <header class="hero" id="obsah">
        <h1>Articles</h1>
        <p class="index-intro">${escapeHtml(INDEX_INTRO)}</p>
    </header>

    <div class="wrap-index">
${renderCtaBox(cta, 'end')}
            <div class="cards">
${cards}
            </div>
    </div>

${chrome.footerToEnd}`;
}

export function buildSitemapFragment(drafts) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- EN article <url> records for sitemap.xml. Generated by scripts/blog-publikuj-en.mjs. Do not edit by hand. -->',
  ];
  const sorted = [...drafts].sort((a, b) => a.canonical.localeCompare(b.canonical));
  for (const d of sorted) {
    lines.push('  <url>');
    lines.push(`    <loc>${escapeHtml(d.canonical).replace(/&quot;/g, '"')}</loc>`);
    lines.push(`    <lastmod>${d.date}</lastmod>`);
    lines.push('  </url>');
  }
  return `${lines.join('\n')}\n`;
}

function absolutizeMdLinks(md, slug) {
  return String(md || '').replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
    let h = href.trim();
    if (/^https?:\/\//i.test(h) || /^(mailto|tel):/i.test(h)) {
      return `[${text}](${h})`;
    }
    if (h.startsWith('#')) {
      return `[${text}](${ORIGIN}/en/blog/${slug}.html${h})`;
    }
    if (h.startsWith('/')) {
      return `[${text}](${ORIGIN}${h})`;
    }
    h = h.replace(/^\.\//, '');
    return `[${text}](${ORIGIN}/en/blog/${h})`;
  });
}

export function renderXArticle(draft) {
  const bodyParts = [];
  bodyParts.push(`# ${draft.title}`, '', draft.canonical, '', absolutizeMdLinks(draft.lead, draft.slug));
  if (draft.body) {
    bodyParts.push('', absolutizeMdLinks(draft.body, draft.slug));
  }
  bodyParts.push('', '## Frequently asked questions');
  for (const f of draft.faq) {
    bodyParts.push('', `### ${f.q}`, '', absolutizeMdLinks(f.a, draft.slug));
  }
  bodyParts.push(
    '',
    '## Want me to coach you?',
    '',
    EN_CTA.text,
    '',
    '[Apply for coaching](https://martinbarna.cz/en/#apply)',
    '',
    '[Get the free Fat Loss Kit](https://martinbarna.cz/en/#kit)',
    '',
    `X teaser: ${draft.xTeaser || ''}`,
    `First reply: Full article: ${draft.canonical}`,
    '',
  );
  return bodyParts.join('\n');
}

export function readPoradi(draftDir) {
  const p = path.join(draftDir, 'PORADI.txt');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter(Boolean)
    .map((l) => l.replace(/\.md$/i, '').replace(/^.*[\\/]/, ''));
}

export function orderDraftsForX(drafts, poradiSlugs) {
  const bySlug = new Map(drafts.map((d) => [d.slug, d]));
  const seen = new Set();
  const out = [];
  for (const s of poradiSlugs) {
    if (bySlug.has(s) && !seen.has(s)) {
      out.push(bySlug.get(s));
      seen.add(s);
    }
  }
  const rest = drafts
    .filter((d) => !seen.has(d.slug))
    .sort((a, b) => String(a.file || a.slug).localeCompare(String(b.file || b.slug)));
  return [...out, ...rest];
}

export function xScheduleDates(n, startIso = X_START) {
  const out = [];
  let [y, mo, d] = startIso.split('-').map(Number);
  let dt = new Date(Date.UTC(y, mo - 1, d));
  for (let i = 0; i < n; i++) {
    out.push(dt.toISOString().slice(0, 10));
    const day = dt.getUTCDay(); // 4 = Thu, 2 = Tue
    const add = day === 4 ? 5 : 2;
    dt = new Date(dt.getTime() + add * 86400000);
  }
  return out;
}

export function formatXSlot(iso) {
  return `${weekdayName(iso)} ${englishDate(iso)}, 15:00 SELČ`;
}

export function renderPrehled(draftsInXOrder) {
  const dates = xScheduleDates(draftsInXOrder.length);
  const rows = draftsInXOrder.map((d, i) => `| ${d.slug} | ${d.title.replace(/\|/g, '/')} | ${formatXSlot(dates[i])} |`);
  return [
    '# EN articles for X',
    '',
    'Two articles a week, Tuesday and Thursday 15:00 SELČ, starting Thursday 15 October 2026.',
    'Order: `clanky-en/PORADI.txt` when it exists, otherwise the draft filename alphabetically.',
    '',
    '| slug | title | proposed X date |',
    '| --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

const DRAFT_HEADER_RE = /(?:Klíčové slovo|Klicove slovo|Navržená URL|Navrzena URL)\s*:/i;

export function looksLikeDraft(raw) {
  return DRAFT_HEADER_RE.test(String(raw || ''));
}

export function listDraftFiles(draftDir) {
  if (!fs.existsSync(draftDir)) return [];
  return fs.readdirSync(draftDir)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => !f.startsWith('_'))
    .filter((f) => !/^readme\.md$/i.test(f))
    .filter((f) => !/^prehled\.md$/i.test(f))
    .filter((f) => !/^cti-me\.md$/i.test(f))
    .sort()
    .filter((f) => looksLikeDraft(fs.readFileSync(path.join(draftDir, f), 'utf8')));
}

function collectIssues(html, draft, { expectFaq = true } = {}) {
  const issues = [];
  const em = countEmDashes(html);
  if (em) issues.push(`má ${em} dlouhých pomlček`);
  const czech = forbiddenCzechHits(html);
  if (czech.length) issues.push(`česká slova v hlavičce/patičce/CTA: ${czech.join(', ')}`);
  if (hasPrice(html)) issues.push('stránka obsahuje cenu');
  const blocks = extractJsonLdBlocks(html);
  const ld = validateJsonLdEn(blocks);
  if (ld.errors.length) issues.push(...ld.errors);
  if (expectFaq && !ld.types.includes('FAQPage')) issues.push('chybí JSON-LD FAQPage');
  if (expectFaq && draft && !html.includes('Frequently asked questions')) {
    issues.push('chybí nadpis Frequently asked questions');
  }
  if (html.includes('Časté otázky')) issues.push('stránka má české Časté otázky');
  if (draft && !html.includes(`rel="canonical" href="${draft.canonical}"`)) {
    issues.push('chybí canonical');
  }
  if (draft && !html.includes(`hreflang="en" href="${draft.canonical}"`)) {
    issues.push('chybí hreflang en');
  }
  if (!html.includes('style="background:#161616;color:#fff;"')) {
    issues.push('CTA box nemá natvrdo barvy pozadí i textu');
  }
  return { issues, ld, em };
}

export function publishAllEn(opts = {}) {
  const root = opts.root || DEFAULT_ROOT;
  const draftDir = opts.drafty || DEFAULT_DRAFTY;
  const xDir = opts.xArticles || DEFAULT_X_ARTICLES;
  const dry = !!opts.dry;
  const templatePath = path.join(root, TEMPLATE_REL);
  const indexPath = path.join(root, INDEX_REL);
  const sitemapPath = path.join(root, SITEMAP_FRAG_REL);
  const blogDir = path.join(root, 'en', 'blog');

  if (!fs.existsSync(templatePath)) throw new Error(`Chybí šablona: ${templatePath}`);
  const chrome = loadChrome(fs.readFileSync(templatePath, 'utf8'));

  const files = listDraftFiles(draftDir);
  const drafts = files.map((file) => {
    const raw = fs.readFileSync(path.join(draftDir, file), 'utf8');
    const d = parseEnDraft(raw);
    d.file = file;
    d.wordCount = d.wordCount || countWords([d.lead, d.body, ...d.faq.map((f) => `${f.q} ${f.a}`)].join(' '));
    return d;
  });

  const articles = drafts.map((d) => {
    const html = buildArticleHtmlEn(d, chrome);
    const { issues, ld, em } = collectIssues(html, d, { expectFaq: true });
    if (!ld.types.includes('Article')) issues.push('chybí JSON-LD Article');
    if (!ld.types.includes('BreadcrumbList')) issues.push('chybí JSON-LD BreadcrumbList');
    return { draft: d, html, issues, ld, em };
  });

  const indexHtml = buildIndexHtml(drafts, chrome);
  const indexCheck = collectIssues(indexHtml, null, { expectFaq: false });
  if (!indexHtml.includes(INDEX_INTRO)) indexCheck.issues.push('výpis nemá úvodní větu');
  if (!indexHtml.includes('/en/#apply') || !indexHtml.includes('/en/#kit')) {
    indexCheck.issues.push('výpis nemá CTA na koučink a kit');
  }

  const allIssues = [];
  for (const a of articles) {
    for (const i of a.issues) allIssues.push(`${a.draft.slug}: ${i}`);
  }
  for (const i of indexCheck.issues) allIssues.push(`index: ${i}`);
  if (allIssues.length) {
    const err = new Error(`Kontrola selhala:\n  - ${allIssues.join('\n  - ')}`);
    err.code = 'CHECK';
    err.issues = allIssues;
    throw err;
  }

  const sitemap = buildSitemapFragment(drafts);
  const xOrder = orderDraftsForX(drafts, readPoradi(draftDir));
  const prehled = renderPrehled(xOrder);
  const xFiles = Object.fromEntries(drafts.map((d) => [d.slug, renderXArticle(d)]));

  if (!dry) {
    fs.mkdirSync(blogDir, { recursive: true });
    for (const a of articles) {
      fs.writeFileSync(path.join(blogDir, `${a.draft.slug}.html`), a.html);
    }
    fs.writeFileSync(indexPath, indexHtml);
    fs.writeFileSync(sitemapPath, sitemap);
    fs.mkdirSync(xDir, { recursive: true });
    for (const [slug, md] of Object.entries(xFiles)) {
      fs.writeFileSync(path.join(xDir, `${slug}.md`), md);
    }
    fs.writeFileSync(path.join(xDir, 'PREHLED.md'), prehled);
  }

  return {
    dry,
    draftDir,
    root,
    count: drafts.length,
    slugs: drafts.map((d) => d.slug),
    files: {
      articles: drafts.map((d) => `en/blog/${d.slug}.html`),
      index: INDEX_REL,
      sitemap: SITEMAP_FRAG_REL,
      xArticles: drafts.map((d) => `${d.slug}.md`),
      prehled: 'PREHLED.md',
    },
    drafts,
    articles,
    indexHtml,
    sitemap,
    prehled,
    xFiles,
    checks: {
      emDashes: articles.reduce((n, a) => n + a.em, 0) + indexCheck.em,
      articles: drafts.length,
    },
  };
}

function parseArgs(argv) {
  const args = { dry: false, root: DEFAULT_ROOT, drafty: DEFAULT_DRAFTY, xArticles: DEFAULT_X_ARTICLES };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') args.dry = true;
    else if (a === '--drafty') args.drafty = path.resolve(argv[++i]);
    else if (a.startsWith('--drafty=')) args.drafty = path.resolve(a.slice('--drafty='.length));
    else if (a === '--root') args.root = path.resolve(argv[++i]);
    else if (a.startsWith('--root=')) args.root = path.resolve(a.slice('--root='.length));
    else if (a === '--x-articles') args.xArticles = path.resolve(argv[++i]);
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a.startsWith('-')) throw new Error(`Neznámý přepínač: ${a}`);
    else throw new Error(`Neočekávaný argument: ${a}`);
  }
  return args;
}

function usage() {
  return `Použití: node scripts/blog-publikuj-en.mjs [--drafty <slozka>] [--dry]

  --drafty   Složka s *.md (default: ${DEFAULT_DRAFTY})
  --dry      Sestavit a zkontrolovat, nic nezapsat.

Šablona: en/blog/_sablona.html
Výstupy: en/blog/<slug>.html, en/blog/index.html, en/blog/_sitemap-zaznamy.xml,
         x-articles/<slug>.md a x-articles/PREHLED.md`;
}

function printSummary(result) {
  console.log('=== blog-publikuj-en ===');
  console.log(`drafty:    ${result.draftDir}`);
  console.log(`clanku:    ${result.count}`);
  console.log(result.dry ? 'zapsano:   NIC (--dry)' : 'zapsano:');
  if (!result.dry) {
    for (const f of result.files.articles) console.log(`  ${f}`);
    console.log(`  ${result.files.index}`);
    console.log(`  ${result.files.sitemap}`);
    console.log(`  x-articles/ (${result.files.xArticles.length} md + PREHLED.md)`);
  }
  console.log('kontrola:');
  console.log(`  dlouhe pomlcky:  ${result.checks.emDashes}`);
  console.log(`  clanku:          ${result.checks.articles}`);
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }
  try {
    const result = publishAllEn({
      drafty: args.drafty,
      root: args.root,
      dry: args.dry,
      xArticles: args.xArticles,
    });
    printSummary(result);
  } catch (e) {
    console.error(`⛔ ${e.message}`);
    process.exit(1);
  }
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) main();
