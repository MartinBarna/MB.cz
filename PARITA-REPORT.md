# Parita hledání potravin (Academy nástroj vs appka), 25. 8. 2026

Úkol: nástroj „Databáze potravin" (`akademie/nastroje/potraviny/`, engine
`assets/food-search.js`, data `assets/curated-foods.min.json`) měl horší řazení
než appka — dotaz „kuře" vracel Kuře kůže a Kuře tučné vysoko a tři sloty
zabíraly gramatické aliasy (Kuře dušená/dušený/pečená…).

## Co bylo v Cursorově verzi a co jsem převzal / zahodil

Cursorova davka (`hledani-parita-tuk`) commit **nikdy neudělala** — Shell v té
session spadl na `aws-core` hooku ještě před `git worktree add`, takže žádný
repo se nezměnil. V `C:\Users\fitne\Desktop\_Claude-dokumenty\cursor-davky-2026-08-25\`
ležel jen NÁVRH dvou souborů (`food-search.js`, `export-curated-foods-min.mjs`),
netestovaný (vlastní přiznání: „Nebeželo. Shell blokovan.").

**Převzal jsem:**
- Název sloupce `hledaci` (0/1) v `min.json` místo mého původního `alias` — shoduje
  se napříč export skriptem a klientem, žádný důvod mít jiné jméno.
- `jeHledaciTvar(it)` s fallbackem na plný `note` (kdyby položka `hledaci` neměla,
  ale `note` ano) — robustnější než jen čtení flagu.
- Myšlenku vypínacích slov `chceTuk`/`chceKuze` počítaných jednou mimo `.map()`.

**Zahodil jsem a opravil:**
- ⛔ **Cursorova verze měla obrácené pořadí priority.** Řadila primárně podle
  `rank` (do kterého už byla vpletená PŮVODNÍ demotice hotových jídel, +10),
  a teprve DRUHOŘADĚ (jako tie-break) podle `hledaci` a `tukKuze`. To znamená,
  že hotové jídlo bez aliasu by v jejím kódu vyhrálo nad surovinou-aliasem ve
  stejné přihrádce — přesně OPAČNĚ, než dává appka (`rankCuratedHit` v
  `src/lib/food-query.ts`, váhy 16/8/4/2: alias=8 > tuk/kůže=4 > jídlo=2, tedy
  alias/tuk/kůže MUSÍ přebít demotici jídla, ne naopak). Opravil jsem to tak, že
  všechny čtyři demotice (přihrádka je už daná, pak alias, tuk/kůže, jídlo) se
  sčítají do jednoho `rank` čísla s váhami 100/20/10, které jsou od sebe dost
  daleko, že slabší stupně nikdy nepřebijí silnější (20+10=30 < 100; 10 < 20) —
  a zapsal jsem to jako jeden blok, ne rozdělené na `rank +=` (existující jídlo)
  a samostatný pozdější tie-break (Cursor).
- Zahodil jsem Cursorovu poznámku o „škvarky" v regexu tuku — appčin skutečný
  `jeDemotovanyTukNeboKuze` (přečetl jsem celý `src/lib/food-query.ts`) používá
  `/(tuk|olej|sadlo|maslo|ghi)/`, škvarky tam NEJSOU (byla to jen nepřesná
  parafráze v zadání týhle úlohy, ne v appce). Regex nechávám přesně podle appky.

## Soubory a změny

1. `scripts/export-curated-foods-min.mjs` — přidán sloupec `hledaci` (0/1) do
   `SLOUPCE`, odvozený z `note` funkcí `jeHledaciTvar(note)` (bez diakritiky,
   `includes('tvar hledani')` nebo `includes('alias hledani')`). `note` sám se
   pořád nenese. Starý formát (bez sloupce) čte `fromMin()` beze změny — chybějící
   klíč = `undefined` = v `food-search.js` se bere jako 0.
2. `assets/food-search.js` — `fromMin` beze změny. Přidána funkce `jeHledaciTvar(it)`
   (čte `it.hledaci`, fallback na `it.note`). V `searchCurated`: mimo smyčku
   dopočet `chceTuk`/`chceKuze` z dotazu; uvnitř smyčky po výpočtu základní
   přihrádky (0-5/9) JEDEN blok, který k `rank` přičte `alias*100 + tukKuze*20 +
   jidlo*10` (nahradil původní osamocený řádek pro jídlo). Pořadí síly: alias >
   čistý tuk NEBO kůže > hotové jídlo — zrcadlí appku, viz komentář v kódu.
3. `akademie/nastroje/potraviny/index.html` — `food-search.js?v=8` → `?v=9`.
   `curated-foods.min.json?v=2` **NEZVEDNUTO** (data přegeneruje šéf zvlášť).

## Ověření

**Živě staženo** `https://martinbarna.cz/assets/curated-foods.min.json?v=2`
(holý `fetch`/`curl` dostal z Wedosu 401/SSL chybu, stáhlo se přes PowerShell
`Invoke-WebRequest` s hlavičkou prohlížeče — 43 130 položek, 2,96 MB).

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
úkolu už nejsou ani v top 10 — signály (b)/(c) fungují hned, bez regenerace dat.)
Gramatické aliasy (dušená/dušené/dušený…) v top 10 pořád jsou — to je (a),
alias flag, a je to OČEKÁVANÉ: živý `min.json` sloupec `hledaci` ještě nemá,
dokud ho šéf nepřegeneruje. Jakmile přibude, aliasy se odsunou automaticky
(unit test níž to dokazuje na syntetických datech).

**Unit testy** (`node`, syntetická data, script v scratchpadu, nezanechán v repu):
- alias flag (`hledaci=1`) ve stejné přihrádce jde za `hledaci=0` → OK.
- čistý tuk / kůže jdou dozadu ve stejné přihrádce → OK.
- vypínací slovo v dotazu (`sádlo`, `kůže`) demotici vypne → OK.
- starý `min.json` bez sloupce `hledaci` → `fromMin()` vrátí `hledaci: undefined`,
  `jeHledaciTvar` to bere jako 0 (fallback na `note`, který taky chybí) → OK,
  zpětně kompatibilní.

**NEOVĚŘENO:**
- Chování v reálném prohlížeči (Chrome, nástroj na `martinbarna.cz`) — jen
  node simulace stejného `food-search.js` nad živými daty.
- Přesná shoda výsledků appky pro STEJNÝ dotaz (appka má navíc řazení podle
  délky názvu uvnitř přihrádky, viz starší poznámka v hlavičce souboru — to je
  záměrný, dřív změřený a neutrální rozdíl, netýká se téhle úlohy).
- Chování PO regeneraci `curated-foods.min.json` se sloupcem `hledaci` (DB se
  právě mění, viz zadání) — jen unit test na syntetických datech.
- `npm run parita:vse` / `kontrola:citelnosti` a další repo skripty se
  nespouštěly (mimo rozsah úkolu, žádné závislé změny v appce).
