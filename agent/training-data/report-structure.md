# Struktura souboru „Report pro Coache" (xlsx)

> Destilát z Google Drive (vzorek souborů „Report pro coache …", 2021–2026, prázdné
> šablony i vyplněné klientské kopie). Slouží agentovi k vědomí, **co a kde z přílohy tahat**
> u check-inů. Navazuje na `playbooks/report-parsing.md`.
> Žádná osobní data — jen rozložení listů, sloupců a metrik.

## K čemu soubor je
Týdenní/12týdenní tracker, který klient vyplňuje a posílá Martinovi (coachovi) jako příloha
check-in mailu. Klient vyplňuje jen **denní hodnoty**; týdenní průměry a souhrn se počítají
samy (vzorce). Standardně **12 týdnů** (jedna „série" = jeden balíček ~3 měsíce).

## Listy (záložky) v sešitu
1. **`Týdenní_souhrn_pro_coache`** — přehledový (souhrnný) list. **Tady číst jako první.**
2. **`1_týden` … `12_týden`** — 12 detailních týdenních listů (denní rozpad). Stejná kostra.

## List „Týdenní_souhrn_pro_coache" — co kde je

### Blok A — Tělesné míry (nahoře)
Řádky = body měření v čase, sloupce = míry. Sloupce (pořadí se mezi verzemi mírně liší,
čti podle hlavičky, ne podle indexu):
`Týden | Váha | Krk | Prsa | Pupík | Pas | Boky | Zadek | P paže | L paže | P stehno | L stehno | P lýtko | L lýtko`
- Řádky: **`Počáteční údaje`** (baseline) + **`1.` až `12.`** (týdny).
- Klient vyplňuje ručně. Klíčové pro trend: **Váha, Pas, Pupík/Břicho, Boky** (hubnutí);
  paže/stehna (objemy/nárůst).

### Blok B — Týdenní průměry (propisují se samy ze záložek)
Pod poznámkou „Týdenní průměry se do tabulek pod tímto řádkem propisují samy.
Vyplňujte pouze tabulku s mírami a dále týdenní listy." — tři vedle sebe ležící mini-tabulky
po řádcích `1.`–`12.`:
- **Výživa:** `Kcal | Bílkoviny | Sacharidy | Tuky | Vláknina`
- **Pohyb:** `Kroky | Fitko | Kardio | Další sporty` (Fitko/Kardio/Další = minuty)
- **Pocit (škály 1–5):** `ÚNAVA | HLAD | SÍLA`

## Detailní listy „N_týden" — co kde je
Každý týdenní list má dvě tabulky vedle sebe + škály:

### Tabulka „Kalorie a makroživiny" (denní)
Řádky `1.`–`7.` (Po–Ne) + `Průměr` (+ u některých verzí řádek **`Cíl`** = cílová makra).
Sloupce: `Den | Kcal | Bílkoviny | Sacharidy | Tuky | Vláknina` a vpravo poznámkový kód
**`U… H… S…`** (denní subjektivní Únava/Hlad/Síla, např. `U2 H4 S3`).

### Tabulka „Aktivity" (denní)
Řádky `1.`–`7.` + `Průměr / Suma`. Sloupce: `Den | Kroky | Fitko | Kardio | Další aktivity`
(Fitko/Kardio/Další = minuty; „Další aktivity" může nést i text typu „box", „hokej", „zahrada").

### Škály týdne (1–5) — slovní kotvy
- **ÚNAVA:** 1 = nejsem vůbec unavený … 5 = unavený, jako bych měl pořád spát.
- **HLAD:** 1 = pořád plný, nemám hlad … 5 = i když se najím, mám hlad.
- **SÍLA:** 1 = nadopovaný (max síla ve fitku) … 5 = nezvednu ani tkaničku.
  (Pozn.: u SÍLY je nižší číslo = lepší výkon — pozor na směr škály.)

## Co z reportu agent tahá pro check-in (priorita)
1. **Trend váhy** = `Počáteční údaje` → poslední vyplněný týden (Blok A). Klíčový vstup pro úpravu maker.
2. **Obvod pasu/pupíku** (důležitější než váha při kolísání vody).
3. **Týdenní průměr Kcal + Bílkoviny** (Blok B / list týdne řádek `Průměr`) vs. `Cíl` (pokud je).
4. **Kroky** (průměr/den) a **minuty pohybu** (Fitko/Kardio).
5. **Vláknina** (časté „pod cílem").
6. **Pocitové škály ÚNAVA/HLAD/SÍLA** — kontext pro to, zda makra ubírat/přidávat
   (vysoký hlad + únava + stagnace → spíš nepřitvrzovat).

## Úskalí při čtení
- **`#DIV/0!`** v průměrech = týden ještě nevyplněný / chybí dny. Neber jako data, ignoruj.
- Vyplněné bývají **jen první 1–3 týdny** (zbytek šablona) — čti poslední NEprázdný týden.
- Pořadí sloupců měr se mezi verzemi liší (např. Krk první vs. poslední) → **vždy podle hlavičky**.
- Některé verze nemají `Cíl` řádek (čistě klientské vyplnění bez cílů od coache).
- Hodnoty mohou být textové s čárkou/mezerou jako oddělovačem tisíců („2,187") — normalizuj.
- Když přílohu nelze přečíst → fallback na tělo mailu + `>>> OVĚŘ data z přílohy` (viz report-parsing.md).
