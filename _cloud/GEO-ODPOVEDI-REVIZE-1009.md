# GEO odpovědi: nezávislá revize a sjednocení (10. 10. 2026)

Větev `cloud/geo-odpovedi-1009` = `origin/main` + sloučené dávky `cloud/geo-odpovedi-1-1009`, `-2-1009`, `-3-1009`
(sloučení bez konfliktů). **Nic není v `main` a nic není nasazené.** Ve větvi se změnilo jen: JSON podklady,
pomocné skripty v `_cloud/`, poznámky revize a pět pilotních článků.

## ⛔ Před merge do `main` (bod 6 zadání)

Deploy (`.github/workflows/deploy-wedos.yml`) vylučuje z nahrávání jen `**/*.md` a vyjmenované složky,
**`_cloud/**` mezi nimi není.** Po merge by se na web nahrálo:
`_cloud/geo-odpovedi/*.json` (154 souborů) a skripty `_cloud/*.py`, `_cloud/geo-odpovedi/*.py`
(`martinbarna.cz/_cloud/...`). Tajné nic není, ale na web to nepatří.

Šéf musí **před merge** udělat jedno z toho:
- přidat `_cloud/**` do `exclude:` v `deploy-wedos.yml` **a zároveň** `/^_cloud\//` do `EXCL`
  v `scripts/verify-deploy.js` (jinak ověřovací krok deploye hlásí 404 na nenahraných souborech a shodí deploy), nebo
- přesunout data do `_zdroje/` (ta už vyloučená je na obou místech).

V deploy workflow ani ve `verify-deploy.js` jsem nic neměnil.

## Počty

| | |
|---|---|
| Článků blogu | 152 (`clanky/*.html` bez výpisu `clanky/index.html`) + 2 pilíře (`jak-zhubnout/`, `jak-nabrat-svaly/`) = **154** |
| JSON souborů | **154**, ke každému článku právě jeden, žádný duplicitní ani osiřelý |
| `kontrola: ok` | **71** (beze změny obsahu, přibyl jen klíč `kontrola`) |
| `kontrola: opraveno` | **76** |
| `kontrola: smazano` (smazaná položka FAQ, většinou i s opravami) | **5** |
| nově doplněno (pilíře, dávky 1 až 3 je vynechaly) | **2** (v poli `kontrola` jako „opraveno: nově doplněno…“) |
| Doslovných citací ověřených skriptem | **2 125 z 2 125** |
| Znak U+2014 v JSON i v pilotních článcích | **0** |
| AI fráze (Klíčem je, Ve světě, Pojďme, Není to jen, Nejde jen o, Závěrem, klíčovou roli, zásadní, V dnešní době…) | **0** v textu, který píšeme my (citace článků jsou doslovné) |

### Seznam článků (bod 1)
- Dávky 1 až 3 měly 152 JSON pro 152 článků v `clanky/`, sedí 1:1.
- `jak-zhubnout/` a `jak-nabrat-svaly/` jsou **plnohodnotné články** (schéma Article, přes 2 000 a 1 700 slov
  vlastního textu), ne rozcestníky, jak tvrdily reporty dávek. Doplnil jsem `jak-zhubnout.json`
  a `jak-nabrat-svaly.json` stejným formátem (url = kanonická adresa složky).
- `myty/`, `recepty-a-odpovedi/` jsou rozcestníky, `clanky-fronta/` nevydané koncepty. Do seznamu nepatří.

## Jak revize probíhala

1. **Nový skript `_cloud/geo-odpovedi-revize.py`** (nahrazuje oba předchozí kontrolní skripty, ty o novém klíči
   `kontrola` nevědí a hlásily by ho jako chybu). Kontroluje úplnost seznamu, klíče a jejich pořadí, url = canonical,
   titulek = H1, tvar pole `kontrola`, opory ke každé položce, **doslovnost každé citace dvěma nezávislými
   extrakcemi** (text článku bez CTA boxů a celé HTML bez tagů), čísla v odpovědích proti textu článku,
   U+2014, AI fráze, délky. `--text <slug>` vypíše celý čitelný text článku včetně zdrojů a závěrečného upozornění.
2. **Hlavní nález hned na začátku:** extrakce, se kterou pracovaly dávky 1 až 3, **vynechávala závěrečné
   upozornění** (`p.disclaimer`). 25 článků v něm má konkrétní varování (těhotenství, kojení, ledviny,
   statiny, „léky sám neměň ani nevysazuj“, diabetici na lécích, Linka 116 123…). JSON je proto často
   neměly a `nejiste` u některých tvrdilo opak (např. „článek neřeší těhotenství, kojení ani ledviny“ u kreatinu).
   Zkontrolováno strojově i ručně: **po revizi má všech 25 článků svoje varování v odpovědi, které se týká.**
3. **Faktická kontrola:** každý z 152 JSON četl revizor vedle CELÉHO textu článku (8 souběžných revizorů po 19
   článcích, žádný z nich nepsal původní odpovědi), věta po větě: čísla a jednotky, podmínky a pro koho to
   platí, výjimky a varování, míra jistoty (může / vždy, pozorovací data, zvířecí studie), přisouzení u přeložených
   textů. Každá změna je v `_cloud/geo-revize-poznamky/skupina-1.md` až `skupina-8.md` i s doslovnou citací
   článku, která ji odůvodňuje.
4. **Moje kontrola nad revizory:** strojová kontrola všech 154 JSON, ruční kontrola všech 25 článků se
   specifickým varováním, ruční kontrola `nejiste` (žádné další nepravdivé „článek neřeší…“), namátkové
   přečtení článků označených `ok` (`pohyb-a-nalada`, `jak-rychle-zhubnout`, `co-kdybych…3-suplementy`,
   5 pilotních). Namátková kontrola našla jednu věc, kterou revizor nechal jako `ok` (dávka vitaminu D, viz níže),
   a jednu nekonzistenci mezi skupinami (glykogen), obojí opraveno.

## Nejvážnější opravy (výběr)

| Článek | Co bylo špatně | Co je teď |
|---|---|---|
| `tehotne-zeny-…` | FAQ „Jak s těžkým tréninkem v těhotenství začít?“ radilo sumo deadlift 3×8 blízko selhání, studie přitom byla jen na 48 zdravých aktivních těhotných | **smazáno**; ostatní odpovědi s podmínkou „ve zdravém těhotenství“ a „prober s lékařem“ |
| `co-kdybych-…-3-suplementy` | „někomu i 8000 IU vitaminu D denně“ bez zdroje, bez lékaře, nad horní hranicí EFSA 4000 IU | **FAQ s dávkou smazána**, než ji Martin potvrdí; zůstala rada „nejlíp si nech udělat krevní testy“ |
| `protein-a-mortalita-…` | FAQ slibovala zlepšení trávení, libida, kostí a mozku při 1,6–2,2 g/kg „bez rizik“ (jen zkušenost z praxe, bez výjimky pro ledviny) | **smazáno**; krátká odpověď „data to neukazují“ místo kategorického „ne“ |
| `pitny-rezim` | „Ano, káva i alkohol se počítají do pitného režimu“, samostatně citováno zní, jako by alkohol zavodňoval | **smazáno** |
| `kreatin-pro-zeny` | dávka 3–5 g bez varování z článku | doplněno „v těhotenství, při kojení nebo onemocnění ledvin se před užíváním poraď s lékařem“ |
| `prerusovany-pust-…` | JSON vůbec neměl, že půst není pro těhotné, lidi s PPP a diabetiky na lécích | doplněno do dvou FAQ |
| `inzulinova-rezistence-…` | krátká odpověď bez lékaře | „patří do rukou lékaře a léky sám neměň ani nevysazuj“ |
| `kofein-a-jeho-bezpecna-konzumace`, `kolik-kavy-denne` | jen limit 400 mg pro dospělé | doplněn limit 200 mg a lékař pro těhotné a kojící |
| `jak-zhubnout-po-50` | čísla deficitu a bílkovin bez výhrady | lidé na lécích na štítnou žlázu, cukrovku, tlak: nastavení s lékařem |
| `glykemicky-index-mytus` | „GI na hubnutí moc ne“ bez výjimky | „u diabetu má rychlost cukru reálný smysl a tam ať to řeší lékař“ |
| `injekce-na-hubnuti-ozempic` | chyběla porucha příjmu potravy a nemoci mezi situacemi „rozhoduje jen lékař“ | doplněno |
| `funguje-wobenzym` | krátká odpověď „přesvědčivě ne“ říkala opak článku („důkazy nejsou přesvědčivé“) | opraveno, doplněno „neodkládej návštěvu lékaře“ |
| `vyhrez-plotenky` | „výhřez se často sám vstřebá“ | „může, a čím hůř nález zní, tím spíš“ (u vyklenutí jen 13 %) |
| `umela-sladidla-mytus`, `sladidla-a-mikrobiom` | bez výjimek | fenylketonurie; cukrovka a inzulinová rezistence s lékařem |
| překlady (Norton, Henselmans, Phillips) | v 10+ JSON byla tvrzení cizího autora podaná jako Martinova nebo jako fakt | přisouzena autorovi (`maslo-…`, `lide-nesnasi-…`, `nez-se-zacnes-bat-…`, `kolagen-na-slachy-…`, `jsou-umela-sladidla-…`, `je-cola-zero-…`, `je-citlivost-na-lepek-…`, `meli-byste-pocitat-objem-…`, `precetl-jsem-…elektrolytech…`, `stale-si-myslim-…kolagen…`) |
| glykogen (dva e-booky) | „12 g / 33 g glykogenu na 100 g svalu“, jednotka podle všeho chybně (spíš na kg) | čísla vypuštěna v obou, zůstalo „téměř 3x víc“ |

Úplný seznam všech 83 změněných JSON s důvodem je níž v sekci „Všechny změny“.

## Rozpory mezi články (bod 3, NEROZHODNUTO, k rozhodnutí pro Martina)

Citace v uvozovkách jsou doslova z článků (stejné jsou v `opory` daného JSON).

1. **Bílkoviny g/kg u dospělých.**
   - Většina článků (např. `bilkoviny`, `jak-zhubnout`, `jak-rychle-zhubnout`, `svaly-v-kalorickem-deficitu`):
     „Pro většinu aktivních lidí se osvědčuje 1,6–2,2 g bílkovin na kilogram tělesné hmotnosti denně.“
   - `kaloricky-deficit`: „Dost bílkovin, zhruba 1,6 až 2 g na kilo váhy, a silový trénink.“
     `jojo-efekt`: „Dost bílkovin (1,6–2 g na kilo): chrání svaly i sytost.“
   - `bilkoviny-a-ledviny-mytus` má v tabulce „držení formy 1,4–1,8 g“ a v textu pro běžné cíle 1,6–2,2 g.
2. **Bílkoviny po padesátce a v přechodu.**
   - `jak-zhubnout-po-50`: „V praxi cílím u klientů na 1,6 až 2,2 g bílkovin na kilogram tělesné hmotnosti a rozděluju je do všech jídel dne.“
   - `sarkopenie-svaly-po-50`: „Mnoho odborných doporučení míří u starších lidí na zhruba 1,2 až 1,5 g bílkovin na kilogram váhy denně“
   - `menopauza-a-pribyvani-vahy`: „miř zhruba na 1,2–1,6 g bílkovin na kilo tělesné hmotnosti denně, při hubnutí spíš k horní hranici.“
   - Navíc `jak-zhubnout-po-50` uvádí příklad „Člověk s 75 kg se tak dostane na 120 až 140 g za den“, ale 1,6–2,2 g/kg dává 120–165 g (příklad revize z JSON vypustila).
3. **Tempo hubnutí.**
   - `kaloricky-deficit`, `jak-rychle-zhubnout`, `jak-zacit-hubnout`, `jak-zhubnout-bricho`: „Reálně to znamená hubnout zhruba 0,3–0,7 kg týdně.“
   - `jak-zhubnout`: „Klíč je pomalé tempo: zhruba 0,5 až 1 % hmotnosti týdně.“; `kaloricky-deficit-kolik-jist`: 0,5 až 1 % týdně, „při 70 kg tedy 350 až 700 g“.
   - `hubnuti-po-40`: „tempo kolem 0,5 procenta tělesné hmotnosti týdně, tedy zhruba 1,5 až 3 kg za měsíc“.
   - Pro 90 kg dává 0,5–1 % 0,45–0,9 kg týdně, tedy víc než 0,3–0,7 kg. `jak-rychle-zhubnout` uvádí obojí vedle sebe jako „orientačně“ totéž.
   - FAQPage JSON-LD na `jak-zhubnout/` (už nasazené) píše 0,3 až 0,7 kg, viditelný text téže stránky 0,5 až 1 %.
4. **Velikost deficitu.** `kaloricky-deficit`, `jojo-efekt`, `jak-zhubnout-po-50`: „15–20 % pod tvým TDEE“;
   `svaly-v-kalorickem-deficitu`: „Mírný deficit kolem 10 až 20 %, ne agresivní.“; `menopauza-a-pribyvani-vahy`:
   „mírný deficit (řádově 250–750 kcal/den)“. Spíš různá čísla než rozpor, ale AI je může citovat proti sobě.
5. **Vitamin D, dávka u dospělých.**
   - `co-kdybych-…-3-suplementy`: „Začni na 2000 IU, ale nejlíp si nech udělat krevní testy. Spoustě lidí stačí až 4000 IU, někomu i 8000 IU denně“
   - `vitamin-d-na-co-ma-smysl`: guideline 2025 „denní ekvivalent zhruba 600 až 2000 IU“ a dávkování „konzultuj se svým lékařem“.
   - FAQ s dávkou z prvního JSON je zatím smazaná (viz výš). Rozpor ale zůstává v článcích.
6. **Elektrolyty a sodík při sportu.**
   - `hydratace-deti-sport` (děti): nápoj se sodíkem, když dítě „sportuje déle než hodinu, jede vysokou intenzitou, nebo trénuje ve velkém horku“.
   - `precetl-jsem-vsechny-studie-o-elektrolytech-…` (Henselmans): elektrolyty „Pouze v extrémních případech:“ „Ultra-vytrvalostní závody 4+ hodiny v horku“.
   - Jiná populace (děti vs. dospělí), ale bez kontextu zní jako protiklad.
7. **Omega-3.**
   - `co-kdybych-…-3-suplementy` doporučuje omega-3 a o oxidovaných píše „Tím pádem působí spíš prozánětlivě“.
   - `omega-3-oxidace`: „Jisté je, že zoxidovaný olej má míň účinné EPA a DHA.“ a „A nejisté zůstává, jestli ti přímo škodí.“
   - E-book `…suplementy-se-kterymi-se-muzete-setk` si odporuje sám („Doporučuji 1 g EPA po tréninku…“ vs. „Kupovat ho už proto nedoporučuju.“). Do JSON se omega-3 z e-booku nedostala.
8. **Výdej energie po silovém tréninku.**
   - `e-book-…-pohybove-aktivity`: „dalších 36 – 48 hodin po tréninku má tělo potenciál regenerovat a pokud mu dodáte dostatek bílkovin, tak ta samotná regenerace pálí značné množství energie.“
   - `jak-zhubnout`: silový trénink „Není tu od toho, aby spálil hromadu kalorií (to neumí tak, jak si lidé představují)“.
9. **Spánek, hodiny.** `spanek-a-hubnuti`: „Většině lidí sedne 7–9 hodin kvalitního spánku.“; `e-book-…-spanek`:
   „Doporučuju spát aspoň 7 – 8 hodin denně.“; `kolik-spanku-delka-pravidelnost`: u aktivního člověka „často 8–10 hodin“.
   Spíš různé skupiny než rozpor.
10. **Jídlo večer.** `jist-po-seste-vecer-se-tloustne-mytus`: „Stejných 500 kcal z rýže s kuřetem ti udělá v těle to samé
    v sedm ráno i v devět večer.“; `jist-vecer-tloustne`: „Dřívější večeře může trochu pomoct, hlavně přes chuť a menší
    večerní přejídání“. Slučitelné (mechanismus přes chuť), ale citované vedle sebe působí protichůdně.
11. **Rostlinné vs. živočišné bílkoviny.** `e-book-…-maso-versus-proteinovy-prasek` nejdřív vysvětluje, proč jsou
    rostlinné horší, a pak „od roku 2021“ srovnatelné. `rostlinne-vs-zivocisne-bilkoviny-svaly` radí na rostlinné stravě
    „přidej trochu navrch“. JSON drží obě strany tak, jak stojí v článcích.

## Podezření na chyby přímo v článcích (články jsem NEMĚNIL)

Revizoři je našli při čtení. JSON jsou drženy v mezích článku, případně sporné číslo nepřebírají.
Detail a citace jsou v poznámkách skupin.

- `e-book-…-ketogenni-dieta…` a `e-book-…-proc-telesna-vaha-kolisa…`: glykogen „12 g / 32 až 33 g na 100 g svaloviny“, podle všeho chybná jednotka (na kg).
- `co-kdybych-…-3-suplementy`: 8000 IU vitaminu D bez zdroje (viz výš).
- `jak-zhubnout-po-50`: příklad 75 kg = 120 až 140 g nesedí s 1,6–2,2 g/kg.
- `jak-zhubnout-bricho`: „0,3–0,7 kg tuku týdně. Za dva týdny to je pár kilo.“ Vychází 0,6–1,4 kg.
- `pitny-rezim`: 30–35 ml/kg u 80 kg = 2,4–2,8 l, článek píše 2,5–3 l; alkohol „se počítá do pitného režimu“.
- `vikendove-prejidani`: „týdenní průměr pořád zůstane v deficitu“ početně nesedí, když se naspořený deficit utratí celý.
- `lide-nesnasi-odpovednost-…`: věta o náhradě semenných olejů nasycenými tuky má nejspíš obrácený směr; čísla o úmrtnosti podaná kauzálně.
- `maslo-a-kardiovaskularni-onemocneni`: Martinovo shrnutí „riziko CVD klesá o 19 %“ posouvá výsledek meta-analýzy (CHD události); olivový olej označen jako PUFA (je převážně MUFA).
- `precetl-jsem-…-elektrolytech-…`: věta o hyponatremii je vnitřně rozporná.
- `tehotne-zeny-…`: shrnutí „Těžké cviky jsou bezpečné“ a tip „Začni v klidu: Sumo deadlift 3×8 blízko selhání“ bez podmínky zdravého těhotenství a předchozího tréninku.
- `protein-a-mortalita-…`, `silovy-trenink-zlepsuje-mozkove-funkce-studie`: Martinovy části slibují zdravotní přínosy jako doložené („Bez rizik“, prevence rakoviny, efekt 0,55 „proti obezitě“).
- `e-book-…-nabirani-tuku-na-bunecne-urovni`: MacLeanovy studie jsou podle všeho na potkanech, článek to neuvádí.
- `e-book-…-ovoce-vs-bebe…`: pasáž o inzulinu („jednotka inzulínu přenáší asi 10 – 15 jednotek glukózy“) je odborně nepřesná.
- `e-book-…-suplementy…`: omega-3 a BCAA si v textu protiřečí.
- `toxiny-v-jidle-…`: EPA, FDA a USDA uvedené i pro EU (jsou americké); věta o fluoridu; barviva bez zmínky o povinném varování v EU.
- `korelace-neni-kauzalita`: „WHO potvrzuje bezpečnost sladidel“ je zjednodušené (WHO 2023 nedoporučila sladidla k řízení váhy).
- `sacharidy-pred-treninkem`: studie citované v textu (Lee 2025, Henselmans 2022) nejsou v řádku Zdroje.
- `doporuceni-bisglycinatu-horciku-…`: zdroje [20]–[26] nedokládají tvrzení o 3 g glycinu před spaním.
- `kreatin-nejen-pro-svaly-ale-i-pro-mozek`: vnitřní rozpor v bezpečnosti (RR 4,25 vs. „žádný vyšší výskyt nežádoucích účinků“).
- `kofein-a-jeho-bezpecna-konzumace`: „nekonzumujte ji méně než 2 hodiny před intenzivním cvičením … zátěž na srdce“ jde proti běžnému načasování (a proti `kofein-pred-treninkem`).
- `protein-po-treninku`: titulek slibuje téma (protein hned po tréninku), které text neřeší.
- `spanek-vyziva-a-fitness-u-populace-40`: souhrn „s pomocí Groka“, pozorovací data (OR, RR) podaná jako příčina, zdroje zkrácené a nedohledatelné. Doporučuji ověřit proti zdrojům.
- `funkcni-trenink-vs-poctiva-sila-…`: studie Keiner 2022 bez DOI, ověřit proti originálu.
- `pohyb-a-nalada`: „výrazně snižuje příznaky deprese“ je možná silnější, než hodnotí sám Cochrane (neověřeno proti abstraktu).

## Pilot: 5 článků (bod 5, jen ve větvi, nenasazuje se)

| Článek | Téma | Rámeček | FAQ | FAQPage JSON-LD | Doplněné CSS v inline `<style>` |
|---|---|---|---|---|---|
| `clanky/bilkoviny.html` | výživa | ano | 3 otázky | ano | `.pull`, `.faq-q` |
| `clanky/kardio-nici-svaly-mytus.html` | trénink | ano | 5 otázek | ano | `.faq-q` (`.pull` už měl) |
| `clanky/kreatin-pro-zeny.html` | suplementy (s varováním pro těhotné, kojící a ledviny) | ano | 5 otázek | ano | `.pull`, `.faq-q` |
| `clanky/spanek-a-hubnuti.html` | spánek | ano | 3 otázky | ano | `.pull`, `.faq-q` |
| `clanky/cheat-day.html` | strategie hubnutí | ano | 3 otázky | ano | `.pull`, `.faq-q` |

Výběr: různá témata, žádný z článků dosud neměl FAQ ani FAQPage, JSON prošly revizí bez sporu a žádný není v seznamu rozporů.

Co přesně přibylo (skript `_cloud/geo-pilot.py vloz <slug> "<h2>Mohlo by tě zajímat</h2>"`):
- **(a) rámeček pod perexem** (`<p class="lead">`): `<div class="pull" data-geo="kratka-odpoved"><strong>Krátká odpověď: <hlavní otázka></strong><br><kratka_odpoved></div>`.
  Otázka je v nadpisu rámečku schválně: krátké odpovědi začínají „Hodně.“ nebo „Cheat meal.“ a bez otázky by pod perexem nedávaly smysl.
  Použitá je existující třída `.pull` (rámeček citace v 32 článcích), která má ošetřený tmavý motiv v `marketing-dark.css` i světlý v `theme-light.css`.
- **(b) sekce „Časté otázky“** na konci obsahu, před závěrečným CTA boxem a „Mohlo by tě zajímat“: `<h2>` + `<p class="faq-q">` + `<p>`, stejný vzor jako 9 článků, které FAQ už mají (např. `ultra-zpracovana-jidla`).
- **(c) FAQPage JSON-LD** hned za existujícím JSON-LD článku. Vzniká ze stejného řetězce jako viditelný text.
  `_cloud/geo-pilot.py over <slugy>` ověřuje, že rámeček = JSON, viditelné FAQ = JSON a JSON-LD = viditelné FAQ slovo od slova: **5 / 5 OK**.
- Na `assets/*`, čísla `?v=`, ceny ani Stripe se nesahalo. Jediná změna CSS je jedno až dvě pravidla v inline `<style>` článku (stejná jako v ostatních článcích).

### Render (headless Chromium, lokální server :8099, stylopisy čerstvě bez cache)
Měřeno `getComputedStyle` na renderu, průhledné pozadí rámečku (`rgba(235,177,44,.08)`) přepočtené přes skutečné pozadí stránky.

| Prvek | Tmavý motiv (výchozí) | Světlý motiv | Práh WCAG AA |
|---|---|---|---|
| text rámečku | 14,68 : 1 | 17,06 : 1 | 4,5 |
| nadpis rámečku (zlatý `strong`) | 11,58 : 1 | 17,06 : 1 | 4,5 |
| `h2` Časté otázky | 19,61 : 1 | 16,72 : 1 | 3,0 |
| otázka `.faq-q` | 15,42 : 1 | 16,72 : 1 | 4,5 |
| odpověď | 15,42 : 1 | 16,72 : 1 | 4,5 |

- Stejné hodnoty ve všech 5 článcích, na desktopu 1280 px i na **mobilu 390 px**.
- **Vodorovné přetečení: 0** (20 kombinací článek × motiv × šířka). **Chyby JS: 0** (analytika, referral, lead-popup a AI chat byly při měření vypnuté, nepatří k pilotu).
- Screenshoty ve tmavém i světlém motivu jsem prošel vizuálně. Rámeček i FAQ sedí v obou.
- Mimochodem: na šířce 1280 px je vidět tmavý burger `.mb-burger` i na neupraveném článku (`vlaknina`), pilot to nezpůsobil.
  CLAUDE.md přitom říká „nad 1260 px nula burgerů“. Stojí za kontrolu někým, kdo spravuje `scroll-top.js`.

⚠️ Pro rozhodnutí o plošném nasazení: FAQPage dnes Google ve výsledcích zobrazuje jen vybraným (vládním a zdravotnickým) webům.
Pro AI vyhledávače a strukturu stránky má ale smysl dál a viditelný text odpovídá schématu.
Stránky `jak-zhubnout/` a `jak-nabrat-svaly/` už FAQPage JSON-LD mají, ale **bez viditelného FAQ** a s tvrzeními, která ve viditelném textu nejsou.
Při plošném nasazení by se to mělo sjednotit.

## Výsledky kontrol

```
python3 -I _cloud/geo-odpovedi-revize.py
Clanku: 154 | citaci overeno: 2125 | kontrola: {'ok': 71, 'opraveno': 82, 'smazano': 5} | chyb: 0
```
(počítadlo skriptu započítá kombinované „opraveno: …; smazano: …“ do obou kategorií, proto 82 + 5; bez překryvu je to 71 ok / 76 opraveno / 5 smazáno / 2 nově)

```
python3 -I _cloud/geo-pilot.py over bilkoviny kardio-nici-svaly-mytus kreatin-pro-zeny spanek-a-hubnuti cheat-day
OK  bilkoviny  FAQ 3
OK  kardio-nici-svaly-mytus  FAQ 5
OK  kreatin-pro-zeny  FAQ 5
OK  spanek-a-hubnuti  FAQ 3
OK  cheat-day  FAQ 3
```

- U+2014: 0 ve všech JSON, v pilotních článcích i v tomto reportu.
- Formát JSON: přibyl klíč `kontrola` jako poslední. Staré skripty `_cloud/geo-odpovedi-kontrola.py` a `_cloud/geo-odpovedi/zkontroluj.py`
  ho neznají a hlásí ho jako chybu. Platná kontrola je `_cloud/geo-odpovedi-revize.py`.

## Soubory

- `_cloud/geo-odpovedi/*.json`: 154 podkladů po revizi
- `_cloud/geo-revize-poznamky/skupina-1.md` až `skupina-8.md`: každá změna s citací, podezření na chyby v článcích, tabulky témat (511 řádků) pro hledání rozporů
- `_cloud/geo-odpovedi-revize.py`: kontrolní skript
- `_cloud/geo-pilot.py`: vložení pilotu a kontrola shody
- `clanky/{bilkoviny,kardio-nici-svaly-mytus,kreatin-pro-zeny,spanek-a-hubnuti,cheat-day}.html`: pilot

## Všechny změny (83 JSON)

| JSON | kontrola |
|---|---|
| `alkohol-a-hubnuti` | opraveno: kratka_odpoved doplněno ‚podle velkých přehledů studií‘, na nich tvrzení o lehké až střední konzumaci stojí; faq[3] doplněna opora pro větu o pravidelném popíjení |
| `bezlepkova-dieta-mytus` | opraveno: faq[3] doplněno upozornění z článku, že neceliakální citlivost na lepek reálně existuje a potíže je třeba nechat prověřit u lékaře (bez něj studie zněla jako popření citlivosti) |
| `bilkoviny-a-ledviny-mytus` | opraveno: faq[2] (g/kg) doplněno upozornění na onemocnění ledvin a konzultaci s lékařem ze závěrečného upozornění |
| `bolave-svaly-doms-mytus` | opraveno: kratka_odpoved „růst skoro bez svalovky je normální“ přepsáno blíž článku („můžeš skvěle růst skoro bez svalovky“); faq[2] doplněna vynechaná podmínka „cítíš se odpočatý a silný“ |
| `cholesterol-co-snizuje-ldl` | opraveno: kratka_odpoved doplněno „u průměrného člověka“ (článek číslo omezuje na průměrného člověka, u dědičné formy neplatí) |
| `co-dela-stravu-zdravou` | opraveno: faq[2] „Ne.“ nahrazeno „Nečekej to od nich.“, článek netvrdí, že polyfenoly s hubnutím nepomáhají vůbec, jen že nepřebijí kalorie |
| `co-jist-pri-hubnuti` | opraveno: kratka_odpoved „kvalitní příloha“ → „kvalitní sacharid“ (šablona v článku řadí do čtvrtiny i ovoce, ne jen přílohu) |
| `co-kdybych-musel-vybrat-jen-3-suplementy-ktere-se-opravdu-vyplati-vets` | smazano: faq[1] o dávce vitaminu D (až 8000 IU denně bez zdroje a bez odkazu na lékaře, nad horní hranicí 4000 IU; rozpor s článkem vitamin-d-na-co-ma-smysl), dokud Martin dávky nepotvrdí; opraveno: faq[1] doplněno „nejlíp si nech udělat krevní testy“ z článku |
| `cukr-je-jed-mytus` | opraveno: faq[4] doplněno „pokud už máš diagnostikovanou cukrovku, poraď se s lékařem“ ze závěrečného upozornění; faq[1] otázka bez srovnání se sladkým jídlem, které článek nedělá |
| `dna-testy-na-hubnuti` | opraveno: faq[2] doplněno „když dlouho nehubneš a děláš věci správně, nebo cítíš únavu, zajdi na vyšetření k lékaři“ z poznámky pod zdroji |
| `doporuceni-bisglycinatu-horciku-pro-vas-aktivni-zivotni-styl` | opraveno: kratka_odpoved doplněna o radu poradit se s lékařem před začátkem užívání doplňku (článek: „než začneš brát jakýkoliv doplněk, probereš to s lékařem“), protože uvádí dávkování |
| `e-book-nejcastejsi-dotazy-klientu-alkohol-hubnuti-a-spolecenske-udalos` | opraveno: faq[1] otázka zúžena z „alkohol po tréninku“ na opití (článek mluví o opití) a tvrzení o „trochu piva“ přisouzeno Dr. Laynu Nortonovi; nejiste[2] opraveno (článek zátěž jater zmiňuje) |
| `e-book-nejcastejsi-dotazy-klientu-ketogenni-dieta-a-sacharidy` | opraveno: faq[2] otázka „Potřebuju sacharidy“ změněna na „Jsou sacharidy užitečné“ (článek říká „hodně užitečné“, ne nutné); faq[3] vypuštěna čísla 12 g a 32 g glykogenu na 100 g svaloviny (podezření na chybu jednotek v článku), ponecháno „skoro 3x tolik“ |
| `e-book-nejcastejsi-dotazy-klientu-maso-versus-proteinovy-prasek` | opraveno: faq[2] doplněna výhrada z článku, že od roku 2021 se ukazuje srovnatelný účinek rostlinných a živočišných bílkovin na růst svalů (bez ní odpověď zněla jistěji než článek); nejiste[0] upraveno |
| `e-book-nejcastejsi-dotazy-klientu-nabirani-tuku-na-bunecne-urovni` | opraveno: faq[2] doplněna podmínka ‚po drastické dietě‘ (nové tukové buňky článek váže na drastickou dietu a rychlé nabrání, ne na jakékoli přibrání) a chybějící opora |
| `e-book-nejcastejsi-dotazy-klientu-ovoce-vs-bebe-susenka-z-hlediska-cuk` | opraveno: kratka_odpoved z „Pro většinu lidí ano, ale ne kvůli cukru samotnému“ na „může být vhodnější“, článek to formuluje opatrně („může být ovoce všeobecně vhodnější“) a rozdíl v cukrech sám uvádí |
| `e-book-nejcastejsi-dotazy-klientu-pohybove-aktivity` | opraveno: otázka faq[1] ‚Proč je silový trénink lepší než kardio?‘ změněna na ‚Jakou výhodu má…‘, článek mluví o výhodě, ne o tom, že je silový trénink obecně lepší |
| `e-book-nejcastejsi-dotazy-klientu-prakticke-tipy-z-praxe` | opraveno: kratka_odpoved, poslední věta zněla kategoričtěji než článek (‚ne tvoje osobní potřeby‘ → ‚nemusí sedět na tvoje osobní potřeby‘) |
| `e-book-nejcastejsi-dotazy-klientu-proc-hubnu-v-ruznych-fazich-zivota-n` | smazano: faq[2] (víkend s víc kaloriemi) odkazovalo na kouče a z vedlejší poznámky v přirovnání dělalo obecnou radu; nahrazeno otázkou o jednorázovém seknutí kalorií z pointy článku |
| `e-book-nejcastejsi-dotazy-klientu-proc-telesna-vaha-kolisa-i-kdyz-hubn` | opraveno: kratka_odpoved „Hlavně kvůli glykogenu“ → „Jedním z důvodů je glykogen“, článek glykogen neoznačuje za hlavní příčinu a zmiňuje i další procesy s tekutinami; opraveno: faq[0] vypuštěna čísla 12 g a 33 g glykogenu na 100 g svalu (podezření na chybu jednotek v článku, sjednoceno s keto e-bookem), ponecháno „téměř 3x víc“ |
| `e-book-nejcastejsi-dotazy-klientu-stres-sympatikus-a-parasympatikus` | opraveno: kratka_odpoved doplněna podmínka „když ho parasympatikus dost často nevyvažuje“ (článek rozklad tkání nespojuje s horší stavbou svalu bezpodmínečně); faq[3] „udrží“ → „udrží snáz“ podle článku |
| `e-book-nejcastejsi-dotazy-klientu-studie-na-tema-diet-breaks-tedy-pauz` | opraveno: kratka_odpoved doplněno „za dané období“ (dieta s pauzami trvala 30 místo 16 týdnů); faq[0] doplněno, že průměrný úbytek tuku na týden byl ve skupině s pauzami nižší (článek to výslovně uvádí), aby odpověď nevyzněla, že pauzy hubnutí zrychlují |
| `e-book-nejcastejsi-dotazy-klientu-suplementy-se-kterymi-se-muzete-setk` | opraveno: kratka_odpoved „Spalovače fungují hlavně díky kofeinu“ → „Hlavní funkční složkou většiny spalovačů je kofein“, článek uvádí, že spalovače žádný statisticky významný vliv na spalování neprokázaly |
| `e-book-nejcastejsi-dotazy-klientu-zanety-a-stravovani-studie` | opraveno: kratka_odpoved doplněno „při stejných kaloriích“ (srovnání keto vs. sacharidy a živočišné vs. rostlinné bílkoviny platí v článku jen při stejných kcal) |
| `ektomorf-mezomorf-endomorf` | opraveno: faq[2] zakázané slovo z výčtu AI frází nahrazeno „úplně jinak“ (význam beze změny) |
| `elonga-hrv-veda-nebo-marketing` | opraveno: faq[2] doplněny vynechané „duševní potíže“ mezi důvody jít k lékaři a Linka první psychické pomoci 116 123 ze závěrečného upozornění |
| `funguje-wobenzym` | opraveno: kratka_odpoved ‚Podle článku přesvědčivě ne‘ → ‚Důkazy přesvědčivé nejsou‘ (článek říká, že důkazy nejsou přesvědčivé, ne že přesvědčivě nefunguje); faq[3] o bezpečnosti doplněno, že nemá čekat efekt léku a neodkládat návštěvu lékaře |
| `funkcni-trenink-vs-poctiva-sila-co-skutecne-funguje` | opraveno: kratka_odpoved už nezačíná obecným ‚Klasický silový trénink.‘, výsledek je vázaný na studii s mladými fotbalisty (zobecnění nad rámec jedné studie); faq[2] české údaje připsány expertům z FAČR místo ‚podle článku‘ |
| `glykemicky-index-mytus` | opraveno: kratka_odpoved doplněna o výjimku pro diabetes („tam ať to řeší lékař“) z článku a závěrečného upozornění, věta o nízkém GI v přebytku vypuštěna kvůli délce |
| `hnedy-cukr-med-mytus` | opraveno: faq[1] kategorické ‚Ne.‘ na otázku, zda je agáve vhodné na hubnutí, nahrazeno slovy článku ‚Dietní zkratka to není.‘ (článek sladidla pro chuť připouští) |
| `hubnuti-a-vek-mozku` | opraveno: faq[2] (nadváha a stárnutí mozku) doplněno, že data jsou z velké části pozorovací (souvislost, ne prokázaná příčina), ze závěrečného upozornění |
| `hubnuti-a-zdravi-mozku` | opraveno: faq[0] ‚díky nižšímu příjmu kalorií‘ (příčinnost) → ‚s nižším příjmem kalorií‘ podle článku; faq[2] otázka ‚jak rychle zhubnu‘ → ‚jak tvrdě hubnu‘, článek mluví o tvrdosti hubnutí, ne o rychlosti |
| `hubnuti-po-40` | opraveno: faq[3] otázka přeformulována (článek netvrdí, že váha v přechodu neklesá, ale že může stát, zatímco se mění poměr tuku a svalu) a doplněno „o hormonální terapii se bav s lékařem“ |
| `injekce-na-hubnuti-ozempic` | opraveno: kratka_odpoved doplněno, pro koho platí čísla STEP 1 (lidé s obezitou, nebo s nadváhou a nemocí); faq[2] doplněno ‚kdo má vysoký tlak nebo nemocné srdce, ptá se nejdřív lékaře‘ a že 1,2–1,6 g/kg se u velké nadváhy počítá z cílové váhy; faq[4] doplněna chybějící porucha příjmu potravy a jakákoli nemoc mezi situace, kdy rozhoduje výhradně lékař |
| `inzulinova-rezistence-prediabetes` | opraveno: kratka_odpoved doplněno ‚Prediabetes ale patří do rukou lékaře a léky sám neměň ani nevysazuj‘ z textu a závěrečného upozornění (zdravotní odpověď bez lékaře); věty sloučeny, aby zůstaly 3 |
| `jak-nabrat-svaly` | opraveno: nově doplněno při revizi 10. 10. 2026 (dávky 1 až 3 pilíř vynechaly) |
| `jak-zhubnout-po-50` | opraveno: kratka_odpoved a faq[1] doplněny o upozornění na léky na štítnou žlázu, cukrovku nebo tlak a lékaře (článek ho vztahuje na všechna čísla), faq[2] doplněno „nebo řešíš čerstvou diagnózu“; z faq[1] vypuštěn příklad 75 kg = 120 až 140 g, který s 1,6 až 2,2 g/kg nesedí; nejiste upraveno |
| `jak-zhubnout` | opraveno: nově doplněno při revizi 10. 10. 2026 (dávky 1 až 3 pilíř vynechaly) |
| `je-citlivost-na-lepek-realna-nebo-jen-v-hlave` | opraveno: kratka_odpoved přisouzena Mennu Henselmansovi (článek je překlad jeho příspěvku) a sjednocena česká uvozovka; v nejiste opraveny uvozovky |
| `je-cola-zero-horsi-nez-obycejna-cola` | opraveno: kratka_odpoved přisouzena Layne Nortonovi (článek je překlad jeho příspěvku); první opora kratka_odpoved přecházela přes CTA box, zkrácena na větu z jednoho řádku |
| `jeden-z-vas-mi-poslal-tohle-video-s-dotazem-zda-je-to-pravda-a-mozna-i` | opraveno: kratka_odpoved upřesněna, čísla 25 → 21 jsou glykemická nálož, ne GI; faq[2] „GI a GN jsou okrajové téma“ zúženo na snížení nálože lednicí, o kterém článek jako o okrajovém tématu mluví |
| `jist-vecer-tloustne` | opraveno: faq[1] doplněno „v redukčním režimu“ ke studii s 82 ženami (podmínka studie chyběla, ačkoli nejiste tvrdilo, že je zachovaná) |
| `jojo-efekt` | opraveno: faq[0] otázka „Proč se mi po dietě zpomalí metabolismus?“ zpřesněna na agresivní hubnutí (článek to váže na hubnutí agresivně a bez bílkovin a silového tréninku, ne na každou dietu) |
| `jsou-umela-sladidla-zlo-pro-tvoje-streva` | opraveno: kratka_odpoved doplněno přisouzení Mennu Henselmansovi (článek je překlad jeho příspěvku) |
| `kaloricky-deficit-kolik-jist` | opraveno: faq[0] doplněna podmínka studie „obě skupiny trénovaly silově čtyřikrát týdně“ (nárůst beztukové hmoty platí při silovém tréninku) |
| `kdy-ma-mozek-vrchol` | opraveno: kratka_odpoved a faq[0] upřesněno, že vrchol 55–60 let platí pro souhrnný ukazatel (CPFI), ne pro mentální výkon obecně; otázky faq[2] a faq[3] zúženy na to, co článek říká (vrchol podle studie, pokles fluidní inteligence) |
| `kofein-a-jeho-bezpecna-konzumace` | opraveno: kratka_odpoved doplněna o limit 200 mg denně a konzultaci s lékařem pro těhotné a kojící ženy, protože krátká odpověď uvádí bezpečný denní limit |
| `kolagen-na-slachy-a-klouby` | opraveno: kratka_odpoved přisouzena Mennu Henselmansovi (studie i věta „většina lidí kolagen nepotřebuje“ jsou z překladu jeho příspěvku, ne Martinovy); faq[2] doplněno „v jedné nedávné studii“ |
| `kolik-kavy-denne` | opraveno: kratka_odpoved doplněna o upozornění, že v těhotenství je káva otázka na lékaře nebo gynekologa (článek: těhotenství je jedna ze dvou oblastí, kde přehled v BMJ našel rizika), protože krátká odpověď uvádí pásmo 3 až 4 šálků denně |
| `kolik-spanku-delka-pravidelnost` | opraveno: faq[2] doplněno ze závěrečného upozornění, že trvale krátký nebo nekvalitní spánek může mít zdravotní příčinu (spánková apnoe) a při potížích se poradit s lékařem; kratka_odpoved doplněno ‚podle velkých přehledů‘; faq[0] ‚ve studiích‘ → ‚podle metaanalýzy Yin 2017‘ (čísla jsou z jedné metaanalýzy) |
| `kreatin-nejen-pro-svaly-ale-i-pro-mozek` | opraveno: kratka_odpoved doplněna o radu poradit se před užíváním s lékařem (článek ji má v závěru i v části o bezpečnosti), protože uvádí dávkování; věta o nevyspání vypuštěna kvůli délce (zůstává ve faq[0]) a s ní její opora |
| `kreatin-pro-zeny` | opraveno: kratka_odpoved a faq[4] doplněny o „v těhotenství, při kojení nebo onemocnění ledvin se před užíváním poraď s lékařem“ ze závěrečného upozornění; z krátké odpovědi kvůli délce vypuštěna věta o nižších zásobách kreatinu u žen i s oporou; nejiste[1] opraveno (tvrdilo, že článek těhotenství, kojení a ledviny neřeší) |
| `kvetnova-motivace` | opraveno: otázka faq[0] ‚Jaký pohyb je nejlepší, abych u toho vydržel?‘ → ‚Záleží na tom, jaký pohyb si vyberu?‘, článek o vydržení u konkrétního pohybu nemluví, jen říká, že na volbě nezáleží; opora kratka_odpoved rozdělena na tři citace, protože původní přecházela přes CTA box (perex a tělo článku) |
| `lide-nesnasi-odpovednost-a-vzdy-se-snazi-najit-obetniho-beranka` | opraveno: kratka_odpoved a všechny faq přisouzeny Layne Nortonovi (článek je překlad jeho textu, odpovědi to podávaly jako fakta bez autora); nejiste[0] upraveno |
| `maslo-a-kardiovaskularni-onemocneni` | opraveno: článek je (kromě závěrečného shrnutí) překlad příspěvku Layne Nortona, tvrzení z překladu v kratka_odpoved, faq[0], faq[1], faq[3] a faq[4] jsou nově přisouzena jemu; faq[1] přesněji ‚události ischemického srdečního onemocnění‘ místo ‚klesají ischemická srdeční onemocnění‘ |
| `melatonin-na-spanek` | opraveno: kratka_odpoved, která odpovídá i na ‚kolik ho brát‘, doplněna o upozornění z článku ‚u dětí jen po domluvě s pediatrem‘ |
| `meli-byste-pocitat-objem-treninku-jako-sety-nebo-reps-oboje-dalsi-dil` | opraveno: článek je překlad příspěvku Menna Henselmanse, tvrzení v kratka_odpoved, faq[1] (model plochy pod křivkou), faq[2] a faq[3] přisouzena jemu |
| `menopauza-a-pribyvani-vahy` | opraveno: faq[4] (HRT) doplněno „léky si sama neupravuj“ ze závěrečného upozornění a „podle tvého zdraví, historie a rizik“ z textu článku |
| `namitky-proti-kalorickemu-deficitu` | opraveno: kratka_odpoved ‚u lidí, kterým hubnutí nešlo‘ → ‚u lidí, kteří o sobě tvrdili, že jim hubnutí nejde‘, studie Lichtman sledovala lidi podle jejich vlastního tvrzení |
| `nez-se-zacnes-bat-chemikalii-ujisti-se-ze-jsi-absolvoval-zakladni-kurz` | opraveno: kratka_odpoved a faq[0] až faq[3] přisouzeny Layne Nortonovi (článek je překlad jeho threadu, odpovědi to podávaly bez autora nebo jako „podle článku“); nejiste[1] upraveno |
| `nocni-smeny-a-hubnuti` | opraveno: otázka faq[0] rozšířena o metabolický syndrom, protože odpověď uvádí i jeho riziko a článek neříká, ke kterému riziku patří „zhruba dvojnásobné“ u nočních směn přes 20 let (pod otázkou jen na obezitu by to četlo jako dvojnásobné riziko obezity) |
| `objem-treninku-v-diete` | opraveno: faq[3] (praktický závěr) doplněno upozornění, že jde o preprint před recenzí a zajímavý signál, ne hotovou věc, aby závěr z jedné nerecenzované studie nezněl jako jistota |
| `pitny-rezim` | opraveno: nejiste upraveno k vymazané položce; smazano: faq[4] o kávě a alkoholu v pitném režimu (odpověď „Ano … proto je hlídej“ domýšlela příčinnou vazbu, kterou článek nemá, a věta, že se alkohol počítá do pitného režimu, by citovaná samostatně mohla mást) |
| `posilovani-je-dobre-pro-vase-svaly-i-mozek` | opraveno: faq[1] (zlepšení myšlení u zdravých, s kognitivním postižením a u dětí) přisouzeno Laynu Nortonovi, jehož text článek překládá |
| `precetl-jsem-vsechny-studie-o-elektrolytech-prumysl-lze` | opraveno: článek je shrnutí videa Menno Henselmanse, tvrzení ve faq[0], faq[2] a faq[3] nově přisouzena jemu (faq[3] místo vágního ‚podle shrnutí‘); z faq[3] vypuštěn nejasný dovětek ‚ne z jeho nedostatku‘, který odpovědi protiřečil |
| `prerusovany-pust-co-rikaji-studie` | opraveno: faq[2] a faq[3] doplněno upozornění ze závěrečného disclaimeru (půst není vhodný pro těhotné, lidi s poruchou příjmu potravy a diabetiky na lécích, poraď se s lékařem); nejiste[1] opraveno, článek autory analýzy ve zdroji uvádí |
| `protein-a-mortalita-mytus-vyvracen-dalsi-dil-serie-veda-vs-myty-ve-vyz` | opraveno: kratka_odpoved místo kategorického „ne“ formulace „data to neukazují“ (pozorovací analýza ukazuje jen nepřítomnost souvislosti); nejiste upraveno; smazano: faq[2] o zlepšení trávení, libida, kostní hustoty a mozku při 1,6–2,2 g/kg „bez rizik“ (jen Martinova zkušenost z praxe, zdravotní tvrzení bez dat a bez výjimky pro nemoci ledvin), faq[3] přečíslováno na faq[2] |
| `rostlinne-vs-zivocisne-bilkoviny-svaly` | opraveno: faq[2] doplněno ze závěrečného upozornění ‚při zdravotních potížích nebo speciální dietě se poraď s lékařem či nutričním specialistou‘; nejiste[0] opraveno, článek studii ve Zdroji uvádí (Askow a kol., Med Sci Sports Exerc 2025) |
| `sacharidy-pred-treninkem` | opraveno: kratka_odpoved doplněn chybějící podmět („sacharidy před cvičením“), bez něj věta nedávala jasný smysl |
| `sarkopenie-svaly-po-50` | opraveno: kratka_odpoved doplněno upozornění ze závěru článku (cukrovka, srdce, klouby, ledviny, léky → poraď se s lékařem) a kvůli limitu slov zkrácena o detail meta-analýzy; faq[4] doplněno „podle přehledu o sarkopenii a pádech“; nejiste[1] opraveno (článek autory a názvy zdrojů uvádí) |
| `silovy-trenink-dlouhovekost` | opraveno: faq[1] (tréninkový plán) doplněno o upozornění, že po operaci, se srdečními potížemi nebo omezujícími bolestmi zad si začátek nech odsouhlasit u lékaře nebo fyzioterapeuta; článek ho má hned pod plánem, JSON ho měl jen u otázky na věk |
| `silovy-trenink-zlepsuje-mobilitu` | opraveno: faq[4] doplněno „při omezené pohyblivosti nebo zdravotních potížích se poraď s lékařem nebo fyzioterapeutem“ ze závěrečného upozornění; faq[2] vrácena podmínka „jak ti dovolí kyčel a technika“ u dřepu; nejiste opraveno (článek lékaře a fyzioterapeuta zmiňuje) |
| `sladidla-a-mikrobiom` | opraveno: faq[0] (cukr v krvi) doplněna výjimka z článku pro cukrovku a inzulinovou rezistenci (prober s lékařem); faq[1] stylisticky odstraněno „Podle článku“ |
| `spalovace-tuku-co-funguje-a-co-je-mytus` | opraveno: faq[0] (kofein) doplněna konzultace s lékařem při zdravotních potížích nebo lécích ze závěrečného upozornění o stimulantech; faq[3] doplněno „s kardiovaskulárním problémem vyloženě nebezpečné“; stylisticky odstraněno „podle článku“ v kratka_odpoved, faq[2] a faq[4] |
| `stale-si-myslim-ze-kolagen-je-podvod` | opraveno: kratka_odpoved doplněno „zdravým dospělým“ (populace studie); faq[1] „Podle článku“ → „Podle Layne Nortona“ a faq[0] výklad o zkreslení přisouzen Nortonovi (článek je překlad jeho příspěvku), doplněna opora |
| `svaly-v-kalorickem-deficitu` | opraveno: faq[0] stylisticky odstraněno „Podle článku“ (text visí přímo u článku), fakta beze změny |
| `tehotne-zeny-netrapte-se-strachem-z-tezkych-cviku-dalsi-dil-serie-veda` | opraveno: faq[0] doplněno, že šlo o 48 zdravých aktivních těhotných žen; faq[2] doplněna podmínka ‚ve zdravém těhotenství‘ a ‚prober i se svým lékařem‘; nejiste doplněno o přisouzení; smazano: faq[3] (‚Jak s těžkým tréninkem v těhotenství začít?‘ s radou sumo deadlift 3×8 blízko selhání), otázka zve i těhotné, které dosud necvičily, na které se studie nevztahuje, a jako tréninkový předpis v těhotenství by mohla uškodit |
| `umela-sladidla-mytus` | opraveno: kratka_odpoved (začíná „Panikařit nemusíš“) doplněna výjimka z článku pro lidi s fenylketonurií, kteří se aspartamu vyhýbají |
| `vitamin-d-na-co-ma-smysl` | opraveno: faq[0] (dávka) doplněno „zvlášť pokud bereš léky, jsi těhotná nebo máš jakoukoli zdravotní diagnózu“ a faq[4] (užívání) „nezačínej na vlastní pěst, konzultuj s lékařem“ ze závěrečného upozornění; faq[0] pásmo 20–40 ng/ml zmírněno na „naznačuje“ jako v článku; nejiste[0] opraveno, autoři jsou v seznamu zdrojů |
| `vyhrez-plotenky` | opraveno: kratka_odpoved ‚výhřez se často sám vstřebá‘ → ‚může sám vstřebat, a čím hůř nález zní, tím spíš‘ (u vyklenutí jen 13 %); faq[2] doplněn zdroj Oosterhuis 2014 a srovnání ‚oproti tomu nedělat nic‘; faq[3] doplněna podmínka článku ‚když odhlédneš od malé části vážných případů‘ |
| `vyziva-deti` | opraveno: faq[3] doplněna chybějící opora pro ‚nižší riziko nadváhy‘; texty odpovědí beze změny |
| `vyziva-sportujiciho-ditete` | opraveno: kratka_odpoved doplněno, že i dávku vitaminu D řeš s lékařem (článek: „Vždy s lékařem, ne od oka.“); faq[3] doplněno „s ohledem na věk“ u dávkování vitaminu D; opory doplněny |
| `zeny-a-posilovani-zmohutni` | opraveno: faq[3] zakázané slovo ze seznamu AI frází (z citace článku) nahrazeno „obzvlášť důležité“, význam podle článku zachován |
