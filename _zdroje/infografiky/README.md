# Dark-gold carousel generátor infografik — návod (i pro jiný chat/Clauda)

Generuje 10slidové carousely pro IG/FB (1080×1350, 4:5) v novém dark-gold kabátě
(#15171a→#0f1113, zlatá #EBB12C, Barlow Condensed titulky + Poppins text, brand MB,
progress tečky, stránkování X/10). Nahrazuje oranžovou éru pro NOVÁ témata.

## Použití (z kořene repa `C:\Users\fitne\Desktop\MB.cz`)

```
OG_SHARP_DIR="C:/Users/fitne/Desktop/AI Martin" node scripts/generate-carousel.js <slug>
```

- Vstup: `_zdroje/infografiky/<slug>.json` (scénář, viz níže)
- Výstup: `_zdroje/infografiky/<slug>/01.png … NN.png`
- Potřebuje: headless Chrome (`C:/Program Files/Google/Chrome/Application/chrome.exe`)
  a balíček `sharp` — je nainstalovaný v repu appky, proto ten `OG_SHARP_DIR`.
- Hotový vzor: `alkohol-a-hubnuti.json` + složka `alkohol-a-hubnuti/` (schválený pilot).

## Formát scénáře (JSON)

```json
{ "slug": "nazev-tematu", "slides": [ { "kind": "...", ... }, ... ] }
```

7 typů slidů (`kind`), texty smí obsahovat `<b>`, `<br>`, `<span class="hl">` (zlaté zvýraznění v titulku):

| kind | pole | použití |
|------|------|---------|
| `cover` | kicker, title, sub | 01 — obálka (velký titulek, „Posuň dál →") |
| `point` | kicker, title, body, callout? | obsahový slide; callout = zlatý rámeček dole |
| `bullets` | kicker, title, items[max 5] | číslované odrážky |
| `stat` | kicker, big, unit, body | velké zlaté číslo (data ze studie) |
| `vs` | kicker, title, yes:{h,items}, no:{h,items} | srovnání (zlatý vs. červený sloupec) |
| `quote` | text, note | výrok Martinovým hlasem (podpis automaticky) |
| `cta` | title, lines[] | 10 — závěr: kam dál (martinbarna.cz, videokurz, koučink) |

Struktura osvědčené série: cover → kontext → jádro → data (stat) → mechanismus →
další důkazy → nuance → prakticky (vs) → quote → cta.

## ⚠️ Pasti

- JSON musí mít české uvozovky „ " uvnitř textů — ASCII `"` ukončí string.
- Čísla a tvrzení VŽDY z ověřeného zdroje (blog článek se zdroji / lekce), nevymýšlet.
- Hlas: tykání, krátké věty, žádný AI-slop; viz `clanky/*.html` jako referenci tónu.

## Dávka: předělání starých infografik (úkol pro příští chat)

Zdroj: Drive složka `1QzoWFGRYcnGxa_ZXAMCcfep9pbVuacjs` — ~37 témat, každé má
10 plochých PNG (`01_cover`…`10_cta`, oranžová éra) + scénář v Google Docu.
Postup na téma: přečíst Doc scénář → přepsat do JSON (formát výše, čísla ověřit
proti blog článku, pokud k tématu existuje) → vygenerovat → vizuální kontrola
2–3 slidů → schválení Martinem → delivery (domluvit: Drive upload / lokální složka).
Začni 1 tématem na schválení stylu, pak dávkuj.
