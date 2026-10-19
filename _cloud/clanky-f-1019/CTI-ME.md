# Dávka F (19. 10. 2026): 4 nové články + EN verze + posty

Na web nic nejde, dokud Martin nesloučí PR. Složka `_cloud/` se na Wedos nenahrává.

## Co je kde

| Co | Kde | Stav |
|---|---|---|
| 4 české články | `clanky-fronta/*.md` + řádky v `clanky-fronta/manifest.json` | Po merge do `main` je vydá fronta automaticky v uvedený den |
| 4 EN verze | `_cloud/clanky-f-1019/en/*.md` | Hotové drafty, zatím NEpublikované (viz níž) |
| Posty X Article (EN), LinkedIn (CZ), FB (CZ) | `_cloud/clanky-f-1019/posty/*.md` | Návrhy, nic nenaplánováno |

## Termíny ve frontě

Dávka vyplňuje volné čtvrtky mezi už naplánovanými články, fronta tím jede každý týden:

- 29. 10. 2026: Hubnutí a menstruační cyklus (`menstruacni-cyklus-a-hubnuti`)
- 12. 11. 2026: Oběd v práci a hubnutí (`obed-v-praci-menicko-hubnuti`)
- 26. 11. 2026: Jak vážit jídlo, syrové vs. vařené (`jak-vazit-jidlo-syrove-vs-varene`)
- 10. 12. 2026: Hubneš a doma nikdo jiný (`hubnuti-kdyz-rodina-nehubne`)

Kdo chce jiný rytmus, změní jen `date` v manifestu.

## Proč EN verze zatím nejsou v `en/blog/`

1. Otevřený PR #579 (dávka E) mění `en/blog/index.html` i `_sitemap-zaznamy.xml`. Publikace teď by s ním kolidovala.
2. EN verze odkazují na český originál (`CZ URL`), který vyjde až z fronty. Hreflang na neexistující stránku nechceme.

Postup, až CZ článek vyjde a #579 je v `main`:

```bash
node scripts/blog-publikuj-en.mjs --drafty _cloud/clanky-f-1019/en --dry
```

⚠️ Skript přepíše `en/blog/index.html` a `_sitemap-zaznamy.xml` jen drafty z předané složky. Novou dávku do výpisu, JSON-LD i fragmentu přimerguj, jinak zmizí dřívější články. Záznamy do `sitemap.xml` ručně, hreflang přes `scripts/hreflang-cz-en.mjs`. `Datum` v EN draftech je den vydání české verze, uprav na skutečný den publikace.

## Kontroly (19. 10.)

- `node scripts/blog-publikuj.mjs <draft> --dry`: všechny 4 bez chyb (0 dlouhých pomlček, title do 70, meta do 170, 3 validní JSON-LD).
- `node scripts/blog-fronta-vydej.mjs --dnes <datum> --dry` pro všechna 4 data: projde.
- `node scripts/blog-publikuj-en.mjs --drafty _cloud/clanky-f-1019/en --dry`: 4 články bez chyb.
- Každá citovaná studie ověřena v PubMed (PMID, DOI, čísla v textu sedí s abstraktem). Výjimka: tabulky výtěžnosti USDA (Agriculture Handbook 102) nejsou v PubMed, čísla rýže/těstovin/masa jsou v textu jako orientační rozsahy.

## Na co se podívat při schvalování

- Hlas: projet Martinovým okem, hlavně úvody a FAQ.
- Menstruační cyklus: citlivé téma, odkaz na gynekoložku při vynechání menstruace je záměr.
- Vážení jídla: FAQ odkazuje na Linku první psychické pomoci 116 123 (úzkost kolem jídla).
- Podpis „Be Effective!“ v EN textech není, čeká na rozhodnutí z PR #579.
