# Parita hledání potravin (Academy nástroj vs appka), 25. 8. 2026

Úkol: nástroj „Databáze potravin" (`akademie/nastroje/potraviny/`, engine
`assets/food-search.js`, data `assets/curated-foods.min.json`) měl horší řazení
než appka: dotaz „kuře" vracel Kuře kůže a Kuře tučné vysoko a tři sloty
zabíraly gramatické aliasy (Kuře dušená/dušený/pečená…).

## Co bylo v Cursorově verzi a co jsem převzal / zahodil

Cursorova davka (`hledani-parita-tuk`) commit **nikdy neudělala**, Shell v té
session spadl na `aws-core` hooku ještě před `git worktree add`, takže žádný
repo se nezměnil. V `C:\Users\fitne\Desktop\_Claude-dokumenty\cursor-davky-2026-08-25\`
ležel jen NÁVRH dvou souborů (`food-search.js`, `export-curated-foods-min.mjs`),
netestovaný (vlastní přiznání: „Nebeželo. Shell blokovan.").

**Převzal jsem:**
- Název sloupce `hledaci` (0/1) v `min.json` místo mého původního `alias`, shoduje
  se napříč export skriptem a klientem, žádný důvod mít jiné jméno.
- `jeHledaciTvar(it)` s fallbackem na plný `note` (kdyby položka `hledaci` neměla,
  ale `note` ano), robustnější než jen čtení flagu.
- Myšlenku vypínacích slov `chceTuk`/`chceKuze` počítaných jednou mimo `.map()`.

**Zahodil jsem a opravil:**
- Cursorova verze měla obrácené pořadí priority: řadila primárně podle `rank`
  (do kterého už byla vpletená PŮVODNÍ demotice hotových jídel, +10), a teprve
  DRUHOŘADĚ, jako tie-break, podle `hledaci` a `tukKuze`.
- Zahodil jsem Cursorovu poznámku o „škvarky" v regexu tuku, appčin skutečný
  `jeDemotovanyTukNeboKuze` (přečetl jsem celý `src/lib/food-query.ts`) používá
  `/(tuk|olej|sadlo|maslo|ghi)/`, škvarky tam NEJSOU (byla to nepřesná parafráze
  v zadání týhle úlohy, ne v appce). Regex nechávám přesně podle appky.

## Oprava po revizi (commit 3f5d263 neschválen, druhé kolo)

Můj první pokus (commit `3f5d263`) měl JINOU vadu, kterou revize odhalila
srovnáním s appkovým testem: sčítal jsem demotice jako `rank += alias*100 +
tukKuze*20 + jidlo*10` k základní přihrádce (0-5). To sice opravilo pořadí síly
MEZI flagy (alias > tuk/kůže > jídlo), ale flagy tím dostaly větší váhu než
SAMOTNÁ PŘIHRÁDKA (100 > 5), takže demotovaná položka s lepší shodou jména
mohla propadnout za nedemotovanou položku s horší shodou. Appka to dělá jinak:
přihrádka je násobena 16, a součet všech nižších stupňů (8+4+2=14) je vždy
menší, takže přihrádka VŽDY vyhraje.

Opraveno na přesně appčino schéma (`rankCuratedHit`, `src/lib/food-query.ts`):
```
rank = přihrádka*16 + alias*8 + tukKuze*4 + jídlo*2
```
kde přihrádka je pořád 0-5 (web má navíc stupeň 5, appka jen 0-4, viz starší
poznámka v hlavičce souboru o „all words in any order"). Přesná shoda (0) a
netrefeno (9) zůstávají mimo tenhle výpočet.

## Soubory a změny

1. `scripts/export-curated-foods-min.mjs`: přidán sloupec `hledaci` (0/1) do
   `SLOUPCE`, odvozený z `note` funkcí `jeHledaciTvar(note)` (bez diakritiky,
   `includes('tvar hledani')` nebo `includes('alias hledani')`). `note` sám se
   pořád nenese. Starý formát (bez sloupce) čte `fromMin()` beze změny, chybějící
   klíč je `undefined`, v `food-search.js` se bere jako 0.
2. `assets/food-search.js`: `fromMin` beze změny. Přidána funkce `jeHledaciTvar(it)`
   (čte `it.hledaci`, fallback na `it.note`). V `searchCurated`: mimo smyčku
   dopočet `chceTuk`/`chceKuze` z dotazu; uvnitř smyčky po výpočtu základní
   přihrádky (0-5/9) přepočet `rank = rank*16 + alias*8 + tukKuze*4 + jidlo*2`.
   Přihrádka shody je nejsilnější signál, alias/tuk-kůže/jídlo jsou uvnitř ní
   tie-break ve stejném pořadí síly jako appka.
3. `akademie/nastroje/potraviny/index.html`: `food-search.js?v=8` na `?v=9`.
   `curated-foods.min.json?v=2` **NEZVEDNUTO** (data přegeneruje šéf zvlášť).

## Ověření

**Živě staženo** `https://martinbarna.cz/assets/curated-foods.min.json?v=2`
(holý `fetch`/`curl` dostal z Wedosu 401/SSL chybu, stáhlo se přes PowerShell
`Invoke-WebRequest` s hlavičkou prohlížeče, 43 130 položek, 2,96 MB).

Top 10 „kuře" nad ŽIVÝM (dosud NEpřegenerovaným, bez sloupce `hledaci`) souborem:
```
1. Kuře mleté     | maso | 201 kcal | 27.1 g B
2. Kuře dušená    | maso | 156 kcal | 26 g B
3. Kuře dušené    | maso | 156 kcal | 26 g B
4. Kuře dušený    | maso | 156 kcal | 26 g B
5. Kuře pečená    | maso | 165 kcal | 31 g B
6. Kuře pečené    | maso | 165 kcal | 31 g B
7. Kuře pečený    | maso | 165 kcal | 31 g B
8. Kuře stehno    | maso | 226 kcal | 22.5 g B
9. Kuře syrová    | maso | 120 kcal | 22.5 g B
10. Kuře vařená   | maso | 151 kcal | 29 g B
```
Kůže v top 10: NE. Čistý tuk v top 5: NE. (Kuře kůže i Kuře tučné z popisu
úkolu už nejsou ani v top 10, signály tuk/kůže fungují hned, bez regenerace
dat.) Gramatické aliasy (dušená/dušené/dušený…) v top 10 pořád jsou, to je
alias flag a je to OČEKÁVANÉ: živý `min.json` sloupec `hledaci` ještě nemá,
dokud ho šéf nepřegeneruje. Jakmile přibude, aliasy se odsunou automaticky
(unit test níž to dokazuje na syntetických datech).

**Unit testy** (`node`, syntetická data, script v scratchpadu, nezanechán v repu):
- alias flag (`hledaci=1`) ve stejné přihrádce jde za `hledaci=0`: OK.
- čistý tuk / kůže jdou dozadu ve stejné přihrádce: OK.
- vypínací slovo v dotazu (`sádlo`, `kůže`) demotici vypne: OK.
- appkový testovací případ `search.test.ts` ř. 455-458 (Kuře tučné, přihrádka 1,
  demotováno tukem, vs Kuřecí prsa, přihrádka 3, nedemotováno): Kuře tučné
  vyhrává, přihrádka porazí demotici. OK.
- appkový testovací případ `search.test.ts` ř. 461-484 (Kuře kung-pao, hotové
  jídlo, stejná přihrádka jako Kuře kůže, surovina s kůží): Kuře kung-pao
  vyhrává. OK.
- starý `min.json` bez sloupce `hledaci`: `fromMin()` vrátí `hledaci: undefined`,
  `jeHledaciTvar` to bere jako 0 (fallback na `note`, který taky chybí). OK,
  zpětně kompatibilní.

**NEOVĚŘENO:**
- Chování v reálném prohlížeči (Chrome, nástroj na `martinbarna.cz`), jen
  node simulace stejného `food-search.js` nad živými daty.
- Přesná shoda výsledků appky pro STEJNÝ dotaz (appka má navíc řazení podle
  délky názvu uvnitř přihrádky, viz starší poznámka v hlavičce souboru, to je
  záměrný, dřív změřený a neutrální rozdíl, netýká se téhle úlohy).
- Chování PO regeneraci `curated-foods.min.json` se sloupcem `hledaci` (DB se
  právě mění, viz zadání), jen unit test na syntetických datech.
- `npm run parita:vse` / `kontrola:citelnosti` a další repo skripty se
  nespouštěly (mimo rozsah úkolu, žádné závislé změny v appce).
