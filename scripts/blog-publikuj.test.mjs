// Test parseru a idempotentních zápisů blog-publikuj.
// Spuštění: node --test scripts/blog-publikuj.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseDraft,
  parseSlugFromUrl,
  countEmDashes,
  extractJsonLdBlocks,
  validateJsonLdBlocks,
  buildArticleHtml,
  loadChrome,
  upsertIndex,
  upsertSitemap,
  countIndexMentions,
  countSitemapLoc,
  stripIndexEntries,
  publishDraft,
  sanitizeHref,
} from './blog-publikuj.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRAFT = fs.readFileSync(path.join(ROOT, 'docs/blog-publikuj-TESTDRAFT.md'), 'utf8');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'clanky/hubnuti-po-40.html'), 'utf8');

test('slug z Navržené URL', () => {
  assert.equal(parseSlugFromUrl('https://martinbarna.cz/clanky/hubnuti-po-40.html'), 'hubnuti-po-40');
  assert.equal(parseSlugFromUrl('/clanky/foo-bar.html'), 'foo-bar');
  assert.equal(parseSlugFromUrl('foo-bar'), 'foo-bar');
  assert.throws(() => parseSlugFromUrl('Foo Bar'), /čistý slug/);
});

test('sanitizeHref odmítne javascript:', () => {
  assert.equal(sanitizeHref('/makro-plan/'), '/makro-plan/');
  assert.equal(sanitizeHref('bilkoviny.html'), 'bilkoviny.html');
  assert.throws(() => sanitizeHref('javascript:alert(1)'), /Podezřelý odkaz/);
  assert.throws(() => sanitizeHref('data:text/html,x'), /Podezřelý odkaz/);
});

test('TESTDRAFT jde parse a nemá dlouhou pomlčku', () => {
  assert.equal(countEmDashes(DRAFT), 0);
  const d = parseDraft(DRAFT);
  assert.equal(d.slug, 'test-blog-publikuj');
  assert.equal(d.cta.preset, 'makro-plan');
  assert.equal(d.faq.length, 2);
  assert.equal(d.sources.length, 2);
  assert.equal(d.related.length, 2);
  assert.equal(d.filter, 'vyziva');
  assert.equal(d.tag, 'HUBNUTÍ');
  assert.equal(d.date, '2026-08-27');
  assert.match(d.lead, /není článek na web/);
});

test('vygenerované HTML: JSON-LD + 0 pomlček + natvrdo CTA barvy', () => {
  const d = parseDraft(DRAFT);
  const html = buildArticleHtml(d, loadChrome(TEMPLATE));
  assert.equal(countEmDashes(html), 0);
  const blocks = extractJsonLdBlocks(html);
  const v = validateJsonLdBlocks(blocks);
  assert.deepEqual(v.errors, []);
  assert.deepEqual(v.types, ['BlogPosting', 'FAQPage', 'BreadcrumbList']);
  assert.match(html, /style="background:#161616;color:#fff;"/);
  assert.match(html, /<h3 style="color:#fff;">/);
  assert.match(html, /<p style="color:#e8e8e8;">/);
  assert.match(html, /canonical" href="https:\/\/martinbarna\.cz\/clanky\/test-blog-publikuj\.html"/);
  assert.match(html, /<span class="tag">HUBNUTÍ<\/span>/);
  assert.match(html, /class="faq-q">Je tohle opravdový článek\?<\/p>/);
  assert.match(html, /href="\/makro-plan\/"/);
  assert.match(html, /class="author-box"/);
  assert.match(html, /class="navlinks"/);
  assert.match(html, /<footer>/);
});

test('upsertIndex nezdvojí kartu ani JSON-LD a nesahe na cizí záznam', () => {
  const d = parseDraft(DRAFT);
  const index = fs.readFileSync(path.join(ROOT, 'clanky/index.html'), 'utf8');
  const hubUrl = 'https://martinbarna.cz/clanky/hubnuti-po-40.html';
  const hubBefore = countIndexMentions(index, 'hubnuti-po-40', hubUrl);
  const once = upsertIndex(index, d);
  const twice = upsertIndex(once, d);
  const m = countIndexMentions(twice, d.slug, d.canonical);
  assert.equal(m.cards, 1);
  assert.ok(m.posts >= 1);
  const hubAfter = countIndexMentions(twice, 'hubnuti-po-40', hubUrl);
  assert.equal(hubAfter.cards, hubBefore.cards);
  assert.equal(hubAfter.posts, hubBefore.posts);
  assert.match(twice, /test-blog-publikuj\.html/);
  assert.ok(twice.indexOf('test-blog-publikuj.html') < twice.indexOf('hubnuti-po-40.html'));
});

test('stripIndexEntries neni chamtivy pres sousedni BlogPosting', () => {
  const snippet = `  "blogPost": [
        { "@type": "BlogPosting", "headline": "A", "url": "https://martinbarna.cz/clanky/a.html", "datePublished": "2026-01-01" },
        { "@type": "BlogPosting", "headline": "B", "url": "https://martinbarna.cz/clanky/b.html", "datePublished": "2026-01-02" },
        { "@type": "BlogPosting", "headline": "C", "url": "https://martinbarna.cz/clanky/c.html", "datePublished": "2026-01-03" },
`;
  const stripped = stripIndexEntries(snippet, 'b', 'https://martinbarna.cz/clanky/b.html');
  assert.match(stripped, /clanky\/a\.html/);
  assert.match(stripped, /clanky\/c\.html/);
  assert.doesNotMatch(stripped, /clanky\/b\.html/);
});

test('upsertSitemap nezdvojí loc a řadí abecedně', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://martinbarna.cz/clanky/aaa.html</loc>
    <lastmod>2026-08-01</lastmod>
  </url>
  <url>
    <loc>https://martinbarna.cz/clanky/zzz.html</loc>
    <lastmod>2026-08-01</lastmod>
  </url>
</urlset>
`;
  const loc = 'https://martinbarna.cz/clanky/test-blog-publikuj.html';
  const once = upsertSitemap(xml, loc, '2026-08-27');
  const twice = upsertSitemap(once, loc, '2026-08-27');
  assert.equal(countSitemapLoc(twice, loc), 1);
  const a = twice.indexOf('aaa.html');
  const t = twice.indexOf('test-blog-publikuj.html');
  const z = twice.indexOf('zzz.html');
  assert.ok(a < t && t < z);
});

test('publishDraft --dry proti kopii kořene a --force je idempotentní', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-publikuj-'));
  fs.cpSync(path.join(ROOT, 'clanky'), path.join(tmp, 'clanky'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'sitemap.xml'), path.join(tmp, 'sitemap.xml'));
  const draftPath = path.join(tmp, 'draft.md');
  fs.copyFileSync(path.join(ROOT, 'docs/blog-publikuj-TESTDRAFT.md'), draftPath);

  const first = publishDraft({ draftPath, root: tmp, force: false, dry: false });
  assert.equal(first.checks.emDashes, 0);
  assert.equal(first.checks.indexCards, 1);
  assert.equal(first.checks.sitemap, 1);
  assert.ok(fs.existsSync(path.join(tmp, 'clanky/test-blog-publikuj.html')));

  assert.throws(
    () => publishDraft({ draftPath, root: tmp, force: false, dry: false }),
    (e) => e.code === 'EXISTS',
  );

  const second = publishDraft({ draftPath, root: tmp, force: true, dry: false });
  assert.equal(second.checks.indexCards, 1);
  assert.equal(second.checks.sitemap, 1);
  const index = fs.readFileSync(path.join(tmp, 'clanky/index.html'), 'utf8');
  const sm = fs.readFileSync(path.join(tmp, 'sitemap.xml'), 'utf8');
  assert.equal(countIndexMentions(index, 'test-blog-publikuj', 'https://martinbarna.cz/clanky/test-blog-publikuj.html').cards, 1);
  assert.equal(countSitemapLoc(sm, 'https://martinbarna.cz/clanky/test-blog-publikuj.html'), 1);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('SEO title přepíše jen <title>, h1 zůstává; dlouhý title tag běh shodí', () => {
  const kratky = DRAFT.replace(/^# .*$/m, '# Testovací nadpis').replace(/^SEO title:.*$/m, 'SEO title: Kratší titulek');
  const d = parseDraft(kratky);
  assert.equal(d.title, 'Testovací nadpis');
  assert.equal(d.seoTitle, 'Kratší titulek');
  assert.equal(d.titleTag, 'Kratší titulek | Martin Barna');
  const html = buildArticleHtml(d, loadChrome(TEMPLATE));
  assert.ok(html.includes('<title>Kratší titulek | Martin Barna</title>'));
  assert.ok(html.includes('<h1>Testovací nadpis</h1>'));
  const dlouhy = DRAFT.replace(/^SEO title:.*\n/m, '').replace(/^# .*$/m, '# ' + 'Nadpis dlouhý jako týden bez kávy a bez spánku, opravdu hodně dlouhý');
  assert.throws(() => parseDraft(dlouhy), /<title> má \d+ znaků/);
  const bezSeo = parseDraft(DRAFT.replace(/^SEO title:.*\n/m, '').replace(/^# .*$/m, '# Krátký nadpis'));
  assert.equal(bezSeo.seoTitle, bezSeo.title);
  assert.ok(bezSeo.meta.length <= 170);
});

test('Zdroje s odrážkou "- " se číslují bez pomlčky', () => {
  const raw = DRAFT.replace(/^(Zdroje:\r?\n)/m, '$1- Bullet A. Autor. 2020. PMID 1\n- Bullet B. Autor. 2021. PMID 2\n');
  const d = parseDraft(raw);
  assert.equal(d.sources[0], 'Bullet A. Autor. 2020. PMID 1');
  assert.ok(d.sources.every((x) => !x.startsWith('-')));
  const html = buildArticleHtml(d, loadChrome(TEMPLATE));
  assert.ok(html.includes('1) Bullet A. Autor. 2020. PMID 1'));
  assert.ok(!html.includes('1) - Bullet'));
});
