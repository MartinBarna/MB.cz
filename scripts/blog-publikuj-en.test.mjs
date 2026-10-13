// Testy anglické publikace článků.
// Spuštění: node --test scripts/blog-publikuj-en.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseSlugFromUrlEn,
  parseEnDraft,
  peelEnFields,
  englishDate,
  buildArticleHtmlEn,
  buildIndexHtml,
  publishAllEn,
  forbiddenCzechHits,
  hasPrice,
  FORBIDDEN_CZECH,
  INDEX_INTRO,
  xScheduleDates,
  formatXSlot,
  orderDraftsForX,
} from './blog-publikuj-en.mjs';
import {
  loadChrome,
  extractJsonLdBlocks,
  countEmDashes,
} from './blog-publikuj.mjs';
import { applyHreflang, bodyAfterHead, runHreflang } from './hreflang-cz-en.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'en/blog/_sablona.html'), 'utf8');

export const EN_TEST_DRAFT = `# Fat loss after 40: what actually changes

Klíčové slovo: fat loss after 40
Navržená URL: /en/blog/fat-loss-after-40
SEO title: Fat loss after 40
Kategorie: Fat loss
Emoji: ⏳
Filtr: vyziva
Popis: What actually changes after 40, and what to do about muscle and steps.
Meta: Fat loss after 40 is not a broken metabolism. Muscle, steps, protein and a small deficit.
Datum: 2026-10-13
CZ URL: /clanky/hubnuti-po-40
X teaser: After 40 your metabolism did not fall off a cliff. Muscle and steps did.
CTA: koučink
Zdroje:
1) Pontzer H, et al. Daily energy expenditure through the human life course. Science. 2021;373(6556):808-812. PMID: 34385400

After 40, fat loss feels harder. The usual story is a broken metabolism. The data say something else: muscle and daily movement change first.

## What actually changes

Muscle mass and steps drop. Energy burn per kilo of lean mass stays fairly stable from 20 to 60. Lift, walk, eat enough protein.

## FAQ

### Do I have to eat much less than at 30?

Usually no. Fix steps and lifting first, then trim the plate a little.

### Does lifting still work if I am new?

Yes. Beginners after 40 often progress fast in the first months, because they start from zero.
`;

test('slug z /en/blog/<slug>', () => {
  assert.equal(parseSlugFromUrlEn('/en/blog/fat-loss-after-40'), 'fat-loss-after-40');
  assert.equal(parseSlugFromUrlEn('https://martinbarna.cz/en/blog/foo-bar.html'), 'foo-bar');
  assert.equal(parseSlugFromUrlEn('foo-bar'), 'foo-bar');
  assert.throws(() => parseSlugFromUrlEn('Foo Bar'), /čistý slug/);
});

test('peel CZ URL a X teaser, parseEnDraft', () => {
  const peeled = peelEnFields(EN_TEST_DRAFT);
  assert.equal(peeled.czUrl, '/clanky/hubnuti-po-40');
  assert.match(peeled.xTeaser, /metabolism/);
  assert.equal(countEmDashes(EN_TEST_DRAFT), 0);
  const d = parseEnDraft(EN_TEST_DRAFT);
  assert.equal(d.slug, 'fat-loss-after-40');
  assert.equal(d.canonical, 'https://martinbarna.cz/en/blog/fat-loss-after-40.html');
  assert.equal(d.czUrl, 'https://martinbarna.cz/clanky/hubnuti-po-40.html');
  assert.equal(d.czHref, '/clanky/hubnuti-po-40.html');
  assert.equal(d.faq.length, 2);
  assert.equal(d.cta.endTitle, 'Want me to coach you?');
  assert.equal(d.date, '2026-10-13');
});

test('## Časté otázky i ## FAQ dají na stránce Frequently asked questions', () => {
  const withCz = EN_TEST_DRAFT.replace('## FAQ', '## Časté otázky');
  const d = parseEnDraft(withCz);
  assert.equal(d.faq.length, 2);
  const html = buildArticleHtmlEn(d, loadChrome(TEMPLATE));
  assert.match(html, /<h2>Frequently asked questions<\/h2>/);
  assert.doesNotMatch(html, /<h2>Časté otázky<\/h2>/);
});

test('vygenerované HTML: EN chrome, canonical, hreflang, FAQ, 0 pomlček, bez ceny', () => {
  const d = parseEnDraft(EN_TEST_DRAFT);
  const html = buildArticleHtmlEn(d, loadChrome(TEMPLATE));
  assert.equal(countEmDashes(html), 0);
  assert.deepEqual(forbiddenCzechHits(html), []);
  for (const w of FORBIDDEN_CZECH) {
    if (w === 'Časté otázky') {
      assert.equal(html.includes(w), false);
    }
  }
  assert.equal(hasPrice(html), false);
  assert.match(html, /lang="en"/);
  assert.match(html, /canonical" href="https:\/\/martinbarna\.cz\/en\/blog\/fat-loss-after-40\.html"/);
  assert.match(html, /hreflang="en" href="https:\/\/martinbarna\.cz\/en\/blog\/fat-loss-after-40\.html"/);
  assert.match(html, /hreflang="cs" href="https:\/\/martinbarna\.cz\/clanky\/hubnuti-po-40\.html"/);
  assert.match(html, /hreflang="x-default" href="https:\/\/martinbarna\.cz\/clanky\/hubnuti-po-40\.html"/);
  assert.match(html, /<h2>Frequently asked questions<\/h2>/);
  assert.match(html, /Want me to coach you\?/);
  assert.match(html, /href="\/en\/#apply"/);
  assert.match(html, /href="\/en\/#kit"/);
  assert.match(html, /13 October 2026/);
  assert.match(html, /min read/);
  assert.match(html, /href="\/en\/">Home/);
  assert.match(html, /href="\/en\/blog\/">Articles/);
  assert.match(html, /href="\/en\/privacy\/">Privacy/);
  assert.doesNotMatch(html, /lead-popup\.js/);
  assert.doesNotMatch(html, /ai-martin\.js/);
  assert.doesNotMatch(html, /referral\.js/);
  assert.doesNotMatch(html, /\/tvuj-coach\//);
  const blocks = extractJsonLdBlocks(html);
  const types = blocks.map((b) => JSON.parse(b)['@type']);
  assert.deepEqual(types, ['Article', 'FAQPage', 'BreadcrumbList']);
  const article = JSON.parse(blocks[0]);
  assert.equal(article.inLanguage, 'en');
  assert.equal(article.author['@id'], 'https://martinbarna.cz/#martin');
  const faq = JSON.parse(blocks[1]);
  assert.equal(faq.mainEntity.length, 2);
  const crumbs = JSON.parse(blocks[2]);
  assert.equal(crumbs.itemListElement[0].name, 'Home');
  assert.equal(crumbs.itemListElement[1].name, 'Articles');
});

test('englishDate formát 13 October 2026', () => {
  assert.equal(englishDate('2026-10-13'), '13 October 2026');
});

test('výpis s nulou článků nespadne a má úvod + CTA', () => {
  const html = buildIndexHtml([], loadChrome(TEMPLATE));
  assert.match(html, new RegExp(INDEX_INTRO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, /Want me to coach you\?/);
  assert.match(html, /class="cards"/);
  assert.equal(countEmDashes(html), 0);
  assert.deepEqual(forbiddenCzechHits(html), []);
  const blog = JSON.parse(extractJsonLdBlocks(html)[0]);
  assert.equal(blog['@type'], 'Blog');
  assert.deepEqual(blog.blogPost, []);
});

test('publishAllEn je idempotentní a řadí karty podle data', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-en-'));
  fs.mkdirSync(path.join(tmp, 'en', 'blog'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'en/blog/_sablona.html'), path.join(tmp, 'en/blog/_sablona.html'));
  const drafts = path.join(tmp, 'drafts');
  const xDir = path.join(tmp, 'x');
  fs.mkdirSync(drafts);
  fs.writeFileSync(path.join(drafts, 'b-older.md'), EN_TEST_DRAFT.replace('fat-loss-after-40', 'older-article').replace('Datum: 2026-10-13', 'Datum: 2026-10-01').replace('Fat loss after 40: what actually changes', 'Older article').replace('SEO title: Fat loss after 40', 'SEO title: Older article'));
  fs.writeFileSync(path.join(drafts, 'a-newer.md'), EN_TEST_DRAFT);

  const first = publishAllEn({ root: tmp, drafty: drafts, xArticles: xDir, dry: false });
  assert.equal(first.count, 2);
  assert.ok(fs.existsSync(path.join(tmp, 'en/blog/fat-loss-after-40.html')));
  assert.ok(fs.existsSync(path.join(tmp, 'en/blog/older-article.html')));
  const index1 = fs.readFileSync(path.join(tmp, 'en/blog/index.html'), 'utf8');
  const newerAt = index1.indexOf('fat-loss-after-40.html');
  const olderAt = index1.indexOf('older-article.html');
  assert.ok(newerAt >= 0 && olderAt >= 0 && newerAt < olderAt);

  const second = publishAllEn({ root: tmp, drafty: drafts, xArticles: xDir, dry: false });
  assert.equal(second.count, 2);
  const index2 = fs.readFileSync(path.join(tmp, 'en/blog/index.html'), 'utf8');
  assert.equal(
    (index2.match(/fat-loss-after-40\.html/g) || []).length,
    (index1.match(/fat-loss-after-40\.html/g) || []).length,
  );
  const sm = fs.readFileSync(path.join(tmp, 'en/blog/_sitemap-zaznamy.xml'), 'utf8');
  assert.equal((sm.match(/<loc>/g) || []).length, 2);
  assert.ok(fs.existsSync(path.join(xDir, 'fat-loss-after-40.md')));
  const xMd = fs.readFileSync(path.join(xDir, 'fat-loss-after-40.md'), 'utf8');
  assert.match(xMd, /Want me to coach you\?/);
  assert.match(xMd, /X teaser:/);
  assert.match(xMd, /First reply: Full article: https:\/\/martinbarna\.cz\/en\/blog\/fat-loss-after-40\.html/);
  const prehled = fs.readFileSync(path.join(xDir, 'PREHLED.md'), 'utf8');
  assert.match(prehled, /fat-loss-after-40/);
  assert.match(prehled, /15:00 SELČ/);

  const empty = path.join(tmp, 'empty');
  fs.mkdirSync(empty);
  const zero = publishAllEn({ root: tmp, drafty: empty, xArticles: path.join(tmp, 'x0'), dry: false });
  assert.equal(zero.count, 0);
  const emptyIndex = fs.readFileSync(path.join(tmp, 'en/blog/index.html'), 'utf8');
  assert.match(emptyIndex, /class="cards"/);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('X rozvrh od čtvrtka 15. 10. 2026, úterý a čtvrtek', () => {
  const dates = xScheduleDates(4);
  assert.deepEqual(dates, ['2026-10-15', '2026-10-20', '2026-10-22', '2026-10-27']);
  assert.equal(formatXSlot('2026-10-15'), 'Thursday 15 October 2026, 15:00 SELČ');
  const ordered = orderDraftsForX(
    [{ slug: 'b', file: 'b.md' }, { slug: 'a', file: 'a.md' }],
    ['b'],
  );
  assert.deepEqual(ordered.map((d) => d.slug), ['b', 'a']);
});

test('hreflang-cz-en mění jen <head>, idempotentně', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hreflang-en-'));
  const clanky = path.join(tmp, 'clanky');
  fs.mkdirSync(clanky);
  // Od #565 má živý článek hreflang už v <head>; test potřebuje stav PŘED během skriptu.
  const src = fs.readFileSync(path.join(ROOT, 'clanky/hubnuti-po-40.html'), 'utf8')
    .replace(/\s*<link rel="alternate" hreflang="(?:en|cs)"[^>]*>/g, '');
  fs.writeFileSync(path.join(clanky, 'hubnuti-po-40.html'), src);
  const drafts = path.join(tmp, 'drafts');
  fs.mkdirSync(drafts);
  fs.writeFileSync(path.join(drafts, 'fat-loss-after-40.md'), EN_TEST_DRAFT);

  const once = runHreflang({ root: tmp, drafty: drafts, dry: false });
  assert.equal(once.length, 1);
  assert.equal(once[0].changed, true);
  const after = fs.readFileSync(path.join(clanky, 'hubnuti-po-40.html'), 'utf8');
  assert.equal(bodyAfterHead(src), bodyAfterHead(after));
  assert.match(after, /hreflang="en" href="https:\/\/martinbarna\.cz\/en\/blog\/fat-loss-after-40\.html"/);
  assert.match(after, /hreflang="cs" href="https:\/\/martinbarna\.cz\/clanky\/hubnuti-po-40\.html"/);

  const twice = runHreflang({ root: tmp, drafty: drafts, dry: false });
  assert.equal(twice[0].changed, false);
  const after2 = fs.readFileSync(path.join(clanky, 'hubnuti-po-40.html'), 'utf8');
  assert.equal(after, after2);
  // Jen v <head>: od #565 má tělo i odkaz „English version“ s hreflang="en".
  const head2 = after2.split('</head>')[0];
  assert.equal((head2.match(/hreflang="en"/g) || []).length, 1);
  assert.equal((head2.match(/hreflang="cs"/g) || []).length, 1);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('applyHreflang na řetězci nesahe na body', () => {
  const html = `<!DOCTYPE html><html><head>\n    <title>X</title>\n</head>\n<body>keep me</body></html>\n`;
  const out = applyHreflang(html, {
    enUrl: 'https://martinbarna.cz/en/blog/foo.html',
    csUrl: 'https://martinbarna.cz/clanky/foo.html',
  });
  assert.equal(bodyAfterHead(html), bodyAfterHead(out));
  assert.match(out, /hreflang="en"/);
});
