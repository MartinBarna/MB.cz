# Testovací článek blog-publikuj: proč skript nesmí zdvojit kartu

Klíčové slovo: test blog publikuj
Navržená URL: https://martinbarna.cz/clanky/test-blog-publikuj.html
Kategorie: Hubnutí
Emoji: 🧪
Filtr: vyziva
Popis: Smyšlený krátký draft jen pro ověření skriptu blog-publikuj. Na web nepatří.
Meta: Testovací draft skriptu blog-publikuj: hlavička, CTA, FAQ a zdroje. Falešný článek, po běhu se maže.
Datum: 2026-08-27
CTA: makro-plan
Související:
- [Kalorický deficit: kolik jíst, abys hubla a přitom fungovala](kaloricky-deficit-kolik-jist.html)
- [Bílkoviny: kolik jich jíst a proč](bilkoviny.html)
Zdroje:
1) Fiktivní zdroj jen pro test skriptu. Test Journal. 2026;1(1):1–2. PMID: 00000000
2) Druhá smyšlená citace. Example Nutr. 2025;10(3):30–35. DOI: 10.0000/test

Tenhle text není článek na web. Je to krátký draft, na kterém skript `blog-publikuj.mjs` ukáže, že umí z hlavičky postavit HTML, kartu i záznam v sitemapě, a že druhé spuštění nic nezdvojí.

## Co skript musí umět napoprvé

Z draftu vezme slug, nadpis, lead, dvě sekce, FAQ a zdroje. Chrome (navigace, CSS, author box, patička) okopíruje z živého vzoru `hubnuti-po-40.html`. CTA box dostane natvrdo tmavé pozadí i barvu textu, ať `marketing-dark.css` nenechá bílou na bílé.

## Co se nesmí stát napodruhé

Druhé spuštění bez `--force` musí skončit, protože cílový soubor už existuje. S `--force` smí soubor přepsat, ale karta v `clanky/index.html` a loc v `sitemap.xml` zůstanou po jednom kuse. Žádná dlouhá pomlčka, JSON-LD musí jít přes `JSON.parse`.

## Časté otázky

### Je tohle opravdový článek?

Ne. Po testovacím běhu se vygenerované HTML, karta i sitemap záznam maže, ať v repu nezůstane falešný článek.

### Proč má draft CTA makro-plan?

Aby skript vyplnil stejný box jako živý vzor: ženy na makro plán, muži na formu zpět, barvy pozadí i textu napsané natvrdo.
