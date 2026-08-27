# blog-publikuj: markdown draft → článek, karta, sitemap

Skript `scripts/blog-publikuj.mjs` bere markdown draft (hlavička + tělo) a deterministicky z něj postaví stejný HTML skelet, jaký má živý článek `clanky/hubnuti-po-40.html`: chrome (navigace, CSS, author box, patička) kopíruje 1:1 za běhu z té šablony, title/meta/OG/canonical, hero, tělo, FAQ, CTA, zdroje a JSON-LD doplní z draftu.

Drafty na Martinově disku (`C:\…\blog-drafty`) cloud nevidí. Vzor hlavičky a ověřovací běh jsou proto tady: `docs/blog-publikuj-TESTDRAFT.md`.

## Použití

```bash
node scripts/blog-publikuj.mjs cesta/k/draftu.md
node scripts/blog-publikuj.mjs cesta/k/draftu.md --force   # přepsat existující HTML
node scripts/blog-publikuj.mjs cesta/k/draftu.md --dry     # sestavit a zkontrolovat, nic nezapsat
node --test scripts/blog-publikuj.test.mjs               # unit testy (temp kořen, repo nesahe)
```

Bez `--force` skončí, když `clanky/<slug>.html` už existuje. Druhé spuštění tedy nic nezdvojí. S `--force` soubor přepíše, ale kartu v `clanky/index.html` a `<loc>` v `sitemap.xml` nezdvojí (nejdřív stáhne starý záznam, pak vloží jeden).

## Hlavička draftu

Povinné: **Klíčové slovo**, **Navržená URL**, **CTA**, **Zdroje**. Nadpis je první řádek `# …`. První odstavec za hlavičkou je lead. Sekce `## Časté otázky` musí mít aspoň jednu otázku (`### otázka` + odstavec).

Volitelné: `Kategorie`, `Emoji`, `Filtr` (`vyziva` / `trenink` / `myty` / `suplementy` / `trenerina`), `Popis` (OG + karta), `Meta`, `Datum` (`YYYY-MM-DD`, jinak dnešek), `Související`.

```markdown
# Nadpis článku

Klíčové slovo: hubnutí po 40
Navržená URL: https://martinbarna.cz/clanky/hubnuti-po-40.html
Kategorie: Hubnutí
Emoji: ⏳
Filtr: vyziva
Popis: Krátký text na kartu a do og:description.
Meta: Delší text do <meta name="description">.
Datum: 2026-08-27
CTA: makro-plan
Související:
- [Bílkoviny](bilkoviny.html)
Zdroje:
1) Autor. Název. Časopis. rok. PMID: …

Lead odstavec.

## První H2
…

## Časté otázky

### Otázka jedna?
Odpověď.
```

CTA preset: `makro-plan` (ženy → `/makro-plan/`, muži → `/forma-zpet/`, stejné dva boxy jako u hubnutí po 40), `koučink`, `videokurz`, `academy`. Vlastní CTA:

```markdown
CTA:
nadpis: Nechceš to ladit metodou pokus omyl?
text: Připravil jsem plán…
- [Pro ženy → makro plán](/makro-plan/)
- [Pro muže → forma zpět](/forma-zpet/)
```

Každý CTA box má **natvrdo** `background:#161616;color:#fff` na kontejneru, `color:#fff` na nadpisu a `color:#e8e8e8` na textu. `marketing-dark.css` jinak nechá světlý text na světlém pozadí.

Dlouhá pomlčka (`—`) v draftu i ve výstupu je chyba. Rozsahy `1–2` (krátká pomlčka) jsou v pořádku.

## Co zapíše

1. `clanky/<slug>.html` podle šablony: head, inline nav, hero, článek, FAQ v HTML i jako JSON-LD `FAQPage`, `BlogPosting` + `BreadcrumbList`, dva CTA boxy, zdroje, author box, patička.
2. `clanky/index.html`: karta **nahoru** (nejnovější první) + kompaktní `BlogPosting` na začátek pole `blogPost`.
3. `sitemap.xml`: jeden `<url>` seřazený podle `<loc>`.

Po zápisu kontrola: 0× `—`, každý JSON-LD blok jde přes `JSON.parse`, typy BlogPosting / FAQPage / BreadcrumbList, právě jedna karta a jeden sitemap loc.

## Testovací běh (27. 8. 2026)

Draft: `docs/blog-publikuj-TESTDRAFT.md` (smyšlený, na web nepatří). Výstup se po zdokumentování **smazal**, v repu nezůstane falešný článek. Unit testy totéž dělají v dočasném kořeni.

```
$ node scripts/blog-publikuj.mjs docs/blog-publikuj-TESTDRAFT.md
=== blog-publikuj ===
draft:     …/docs/blog-publikuj-TESTDRAFT.md
slug:      test-blog-publikuj
title:     Testovací článek blog-publikuj: proč skript nesmí zdvojit kartu
datum:     2026-08-27
cta:       makro-plan
zapsano:
  clanky/test-blog-publikuj.html  (nový)
  clanky/index.html               (karta nahoru + JSON-LD)
  sitemap.xml                     (url, bez duplicity)
kontrola:
  dlouhe pomlcky:  0
  JSON-LD bloky:   3 validni (BlogPosting, FAQPage, BreadcrumbList)
  FAQ otazek:      2
  zdroje:          2
  cteni:           1 min (177 slov)
  karet v indexu:  1
  sitemap loc:     1

$ node scripts/blog-publikuj.mjs docs/blog-publikuj-TESTDRAFT.md
⛔ Cílový soubor už existuje: clanky/test-blog-publikuj.html (spusť s --force pro přepis).
# exit 2

$ node scripts/blog-publikuj.mjs docs/blog-publikuj-TESTDRAFT.md --force
# karet v indexu: 1, sitemap loc: 1  (nic se nezdvojilo)
```

`git diff --stat` testovacího běhu: `clanky/index.html | 2 ++`, `sitemap.xml | 4 ++++`, plus nový `clanky/test-blog-publikuj.html`.

### Diff `clanky/index.html`

```diff
   "blogPost": [
+        { "@type": "BlogPosting", "headline": "Testovací článek blog-publikuj: proč skript nesmí zdvojit kartu", "url": "https://martinbarna.cz/clanky/test-blog-publikuj.html", "datePublished": "2026-08-27" },
         { "@type": "BlogPosting", "headline": "Hubnutí po 40: co se mění doopravdy a co si jen říkáme", "url": "https://martinbarna.cz/clanky/hubnuti-po-40.html", "datePublished": "2026-08-26" },
```

```diff
             <div class="row g-4">
+                <div class="col-md-6 col-lg-4 blog-card" data-cat="vyziva" data-top="0"><a href="test-blog-publikuj.html" class="text-decoration-none"><div class="card p-4"><div class="ico">🧪</div><div class="tagp">HUBNUTÍ</div><h5 class="card-title mt-1">Testovací článek blog-publikuj: proč skript nesmí zdvojit kartu</h5><p class="text-muted mb-0">Smyšlený krátký draft jen pro ověření skriptu blog-publikuj. Na web nepatří.</p></div></a></div>
                 <div class="col-md-6 col-lg-4 blog-card" data-cat="vyziva" data-top="0"><a href="hubnuti-po-40.html" …
```

### Diff `sitemap.xml`

Vložené abecedně mezi `tehotne-zeny-…` a `testosteron-4-paky.html`:

```diff
   </url>
+  <url>
+    <loc>https://martinbarna.cz/clanky/test-blog-publikuj.html</loc>
+    <lastmod>2026-08-27</lastmod>
+  </url>
   <url>
     <loc>https://martinbarna.cz/clanky/testosteron-4-paky.html</loc>
```

### Výřez `clanky/test-blog-publikuj.html` (po běhu smazán)

Head z draftu, chrome ze šablony:

```html
<title>Testovací článek blog-publikuj: proč skript nesmí zdvojit kartu | Martin Barna</title>
<link rel="canonical" href="https://martinbarna.cz/clanky/test-blog-publikuj.html">
```

CTA s natvrdo barvami (stejný box jako hubnutí po 40):

```html
<div class="cta-box" style="background:#161616;color:#fff;">
    <h3 style="color:#fff;">🎁 Nechceš to ladit metodou pokus omyl?</h3>
    <p style="color:#e8e8e8;">Připravil jsem plán, kde máš kalorie i makra spočítané a rozepsané do jídel. Je zdarma.</p>
    <a class="btn" href="/makro-plan/" style="background:#fff;color:#161616;">Pro ženy → makro plán</a>
    <a class="btn gold" href="/forma-zpet/">Pro muže → forma zpět</a>
</div>
```

JSON-LD typy v head: `BlogPosting`, `FAQPage` (2 otázky), `BreadcrumbList` (Domů → Blog → článek). Inline nav, author box a patička bajtově ze šablony `hubnuti-po-40.html`.
