# Barna Academy — PDF verze lekcí

Branded PDF každé lekce, **nezávislé na webu** (vlastní tisková šablona: obálka,
„V praxi (Martin)“ boxy, zdroje, patička). Obsah se **automaticky extrahuje**
z webových lekcí v `akademie/studium/mX-lY/index.html`, takže PDF jsou vždy
v souladu s webem — žádné ruční přepisování.

## Jak vygenerovat

```bash
# 1) Vytvoř tiskové HTML ze všech webových lekcí
node akademie/_pdf/generate.js

#    (volitelně jen jednu lekci:  node akademie/_pdf/generate.js akademie/_pdf/build m3-l7)

# 2) Vyrenderuj PDF přes headless Chrome
for f in akademie/_pdf/build/*.html; do
  base="${f%.html}"
  chromium --headless --no-sandbox --no-pdf-header-footer \
    --print-to-pdf="$base.pdf" "file://$PWD/$f"
done
```

Výstup: `akademie/_pdf/build/m1-l1.pdf` … `m9-l8.pdf` (118 lekcí).

## Co je v PDF
- Tmavá brandová obálka s MB znakem + „Barna Academy“ + název a modul/lekce.
- Lead, „Co si z lekce odneseš“, tělo (sekce, boxy „V praxi (Martin)“, karty, rovnice).
- Úkol do praxe + vědecké zdroje + patička `© Barna Academy — Martin Barna`.
- Kvíz a webová tlačítka se do tisku **záměrně nevkládají**.

## Fonty
Self-hosted Poppins z `assets/vendor/fonts/` se do PDF embeduje přes `@font-face`
s `file://` cestou — diakritika (latin-ext) je pokrytá.

> Pozn.: složka `build/` se needituje ručně — je to generovaný výstup.
