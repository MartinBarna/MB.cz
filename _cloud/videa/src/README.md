# Jak videa přegenerovat

Všechno je v textu, žádný střihový program. Video = HTML scéna (`stage.html` + `engine.js`),
kterou Playwright snímá snímek po snímku a ffmpeg skládá do MP4.

| Soubor | Co dělá |
|---|---|
| `videos.js` | **Scénáře všech 10 videí**: texty, časy scén, obrázky, zdroje tvrzení. Nahoře objekt `CENY`. |
| `engine.js` | Vykreslení scény jako čistá funkce času (typy scén: hook, text, card, rows, stats, quote, bars, photo, cta, cover). Hlídá bezpečné zóny. |
| `stage.html` | Styly (brand: tmavá `#0f1113` + zlatá `#EBB12C`, Barlow Condensed + Poppins z `assets/vendor/fonts`). |
| `music.py` | Syntetizovaný podkres (numpy, vlastní tvorba, žádná licence). Pět presetů podle produktu. |
| `render.js` | Render: kontrola zón → cover → hudba → snímky → MP4 + verze bez hudby. |
| `texty.js` | Vygeneruje `../TEXTY.md` a `../ZDROJE.md` ze scénářů. |
| `grab-pages.js` | Nafotí surové výřezy prodejních stránek (mobil 390 px, DPR 2,5): `node grab-pages.js <slozka>`. Ořez do `img/` viz report. |
| `img/` | Výřezy stránek: ceníkové karty, moduly a bonusy videokurzu, kroky koučinku. |

## Postup

```bash
cd <koren repa>
python3 -m http.server 8099 &                       # statický server, stage.html bere fonty a obrázky z /assets
export NODE_PATH=$(npm root -g)                     # globální playwright
node _cloud/videa/src/render.js --check             # jen kontrola bezpečných zón a přetečení, nic nerenderuje
node _cloud/videa/src/render.js academy-15 --preview=auto   # náhledové PNG ze středu každé scény (.tmp/)
node _cloud/videa/src/render.js                     # všech 10 videí (cca 1 min na 15 s videa)
node _cloud/videa/src/render.js videokurz-30        # jen jedno
node _cloud/videa/src/texty.js                      # po změně textů vždy, ať TEXTY.md sedí
```

## Změna ceny

Ceny jsou ve videu napsané natvrdo (jinak to u videa nejde). Jsou ale na jednom místě:
objekt `CENY` nahoře ve `videos.js`. Po změně ceníku: upravit `CENY`, přerenderovat dotčená
videa, `texty.js`. Výřezy ceníkových karet v `img/` se obnoví přes `grab-pages.js`
(pak je potřeba znovu oříznout, viz report).

## Bezpečné zóny

Text musí být v pásu **y 250–1570 px** a **x 60–1020 px** (nahoře 250 px a dole 350 px volné
pro UI Reels/TikToku). `engine.js` to u každé scény měří (`__check`) a `render.js` hlásí každé
porušení. Nadpis, který by se zalomil do víc řádků, než má explicitních, se sám zmenší.
