# GEO odpovědi pro články blogu: dávka 3 (9. 10. 2026)

Větev `cloud/geo-odpovedi-3-1009` nad `origin/main`. Nic není nasazené ani slité do `main`, žádná HTML stránka se neměnila.
Výstupem jsou jen datové soubory `_cloud/geo-odpovedi/<slug>.json` k pozdější kontrole.

## Shrnutí

| | |
|---|---|
| Článků blogu celkem | 152 (`clanky/*.html` bez `clanky/index.html`) |
| Dávka 3 | položky 101 až 152 = **52 článků** |
| Hotovo | **52 z 52** |
| Vynechané | 0 |
| FAQ celkem | 230 (27 článků má 5 otázek, 20 má 4, 5 má 3) |
| Doslovných opor celkem | 754 |
| Položek „nejisté" | 146 |
| Krátká odpověď | 31 až 57 slov, 2 až 3 věty |
| Kontrola skriptem | **52 OK, 0 chyb, 0 varování** |
| Znak U+2014 v JSON souborech | **0** |

## Jak se určil seznam článků

- Blog žije ve složce `clanky/`: 152 souborů `*.html` plus rozcestník `clanky/index.html` (ten není článek, vynechán).
- `jak-zhubnout/`, `jak-nabrat-svaly/`, `myty/`, `recepty-a-odpovedi/` jsou rozcestníky (každý jen `index.html`), ne články.
  `clanky-fronta/` jsou nevydané Markdown koncepty mimo deploy, do seznamu nepatří.
- Žádný článek v `clanky/` nemá `noindex` ani přesměrování.
- Řazení: abecedně podle cesty souboru (bajtové řazení `LC_ALL=C` dává stejné pořadí jako běžné `sort`).
  Úplný seznam všech 152 položek s číslem dávky je na konci reportu, ať na sebe dávky 1 až 3 přesně navazují.

## Jak se pracovalo

1. **Čistý text článku**: z HTML se vzal nadpis `h1` a obsah `<article>` bez CTA boxů, boxu autora, právního
   upozornění, galerie obrázků a sekce „Mohlo by tě zajímat". Každý blokový prvek (odstavec, odrážka, buňka tabulky,
   nadpis) je jeden řádek. Z tohohle textu se psaly odpovědi i citace.
2. **Psaní**: každý článek přečtený celý, odpovědi jen z toho, co v něm stojí. Čísla převzatá přesně
   (jediná úprava: desetinná tečka v odpovědích přepsaná na českou čárku, např. `1.6-2.2 g/kg` → `1,6–2,2 g/kg`;
   citace v `opory` zůstávají doslovné včetně tečky).
3. **Strojová kontrola** (skript v příloze), opakovaná až do 0 chyb.
4. **Nezávislá obsahová revize**: dva revizoři prošli všech 52 souborů vedle textu článku a hledali tvrzení,
   která citace nedokládá, ztrátu míry nejistoty, rozšíření na jinou skupinu a špatné přisouzení.
   Našli problém ve 14 souborech, všechny opravené (viz níže). Po opravách znovu strojová kontrola: 52 OK.

### Co opravila obsahová revize

- **Přisouzení u přeložených příspěvků.** Sedm článků je překladem cizího textu, doplněným Martinovým komentářem.
  Odpovědi teď říkají, čí je které tvrzení:
  Layne Norton (`posilovani-je-dobre-pro-vase-svaly-i-mozek`, `rostliny-jsou-plne-jedu`, `stale-si-myslim-ze-kolagen-je-podvod`),
  Stuart Phillips (`protein-a-mortalita-…`), Menno Henselmans (`silovy-trenink-zlepsuje-mozkove-funkce-studie`,
  `precetl-jsem-vsechny-studie-o-elektrolytech-prumysl-lze`), a tam, kde jde o Martinovu praxi, „Martin doporučuje / radí"
  (`omega-3-oxidace`, `protein-a-mortalita-…`, `silovy-trenink-zlepsuje-mozkove-funkce-studie`).
  U `spanek-vyziva-a-fitness-u-populace-40` je krátká odpověď nově podaná jako tipy, které článek ze studií vyvozuje, ne jako závěr studií.
- **Míra nejistoty**: `protein-po-treninku` (přepočet Refalovy hranice platí „zhruba" a jen u běžného cvičence s 18 až 28 % tuku),
  `vitamin-d-na-co-ma-smysl` (autoři sami píšou, že klinický význam změny kostního metabolismu je nejistý),
  `ultra-zpracovana-jidla` (tempo 48 vs. 31 kcal/min je z Fordeovy analýzy, kalorie byly srovnané „nabízené").
- **Upozornění, která nesměla zmizet**: `probiotika-co-funguje` (u těžkého zánětu slinivky zvýšila úmrtnost),
  `vyziva-deti` (kravské mléko ne jako hlavní nápoj před prvním rokem, u batolat pod zhruba 500 ml),
  `tehotne-zeny-…` (studie se týkala jen zdravých aktivních těhotných žen).
- **Neúplná čísla**: `vyhrez-plotenky` a `omega-3-oxidace` teď uvádějí všechna procenta z článku
  (předtím chyběla, protože jsou v článku na krátkých samostatných řádcích).

## Čeho si při kontrole všimnout

- **`testosteron-4-paky`**: ty čtyři páky jsou jen v infografice (obrázcích). Text je nevyjmenovává, takže je JSON neuvádí
  a hlavní otázka stojí na tom, co text říká (doplňky nejsou první krok, nízký testosteron ukáže jen krevní test).
  Má jen 3 FAQ. Aby AI vyhledávače mohly citovat hlavní radu článku, musely by se páky dostat do textu.
- **Infografiky obecně**: 15 článků v dávce má galerii obrázků (`nocni-smeny-a-hubnuti`, `objem-treninku-v-diete`,
  `omega-3-oxidace`, `omlazeni-hubnutim`, `pohyb-a-nalada`, `probiotika-co-funguje`, `protein-po-treninku`,
  `sacharidy-pred-treninkem`, `sladidla-a-mikrobiom`, `spankova-apnoe-a-hubnuti`, `svaly-v-kalorickem-deficitu`,
  `testosteron-4-paky`, `trenujes-tak-tvrde`, `umela-sladidla-mytus`, `vo2max-a-delsi-zivot`).
  Text v obrázcích se nepoužil, protože ho nejde doslova ocitovat.
- **`protein-po-treninku`**: navzdory titulku článek neřeší načasování proteinu po tréninku, jen denní množství.
  Hlavní otázka je proto „Kolik bílkovin denně potřebuju, když posiluju?" a nesoulad je v `nejiste`.
- **`vetsina-lidi-ma-za-to-ze-po-30-letech-…`**: článek má jen pár odstavců, proto jen 3 FAQ.
- **Sporné věty v článcích, které se do odpovědí záměrně nepřebíraly**: české statistiky bez zdroje
  (MZ ČR, ČSÚ, NÚDZ) v `tehotne-zeny-…` a `silovy-trenink-zlepsuje-mozkove-funkce-studie`, rada „hlídej si FHR"
  v `tehotne-zeny-…` (uvedena v `nejiste`). Stálo by za to je v samotných článcích zkontrolovat.
- **Lékařská témata** (deprese, těhotenství, děti, apnoe, ploténka, štítná žláza, vitamin D, probiotika): odpovědi drží
  jen to, co článek říká, včetně jeho odkazů na lékaře. U `pohyb-a-nalada` zůstalo varování nevysazovat léky
  a Linka první psychické pomoci 116 123 (obojí je v článku).
- **Bez reklamy**: odpovědi neodkazují na koučink, videokurz ani Academy, i když je články zmiňují.
- ⚠️ **Deploy**: `_cloud/**` není ve výjimkách `deploy-wedos.yml` (výjimky má jen `**/*.md`). Kdyby se tahle větev slila
  do `main` tak, jak je, JSON soubory by se nahrály na web jako `martinbarna.cz/_cloud/geo-odpovedi/*.json`.
  Nic tajného v nich není, ale před sloučením je dobré buď přidat `_cloud/**` do `exclude` (a do `EXCL`
  v `scripts/verify-deploy.js`), nebo je přesunout do `_zdroje/`. Tady se na to záměrně nesahalo.

## Výsledek kontroly

Skript ověřuje u každého souboru:

- JSON je validní a má přesně klíče `url, titulek, hlavni_otazka, kratka_odpoved, faq, opory, nejiste`.
- `url` = canonical článku, `titulek` = jeho `h1`.
- Krátká odpověď má nejvýš 60 slov a 2 až 3 věty. FAQ má 3 až 5 položek, každá odpověď 1 až 3 věty.
- **Každá citace v `opory` se doslova vyskytuje v textu článku po odstranění HTML.** Ověřuje se dvěma nezávislými cestami:
  v rámci jednoho bloku textu (odstavec, odrážka) z HTML parseru a v celém `<article>` očištěném regexem.
  Citace kratší než 15 znaků projde, jen když tvoří celý blok (např. odrážka „Protruze: 41 %").
- Krátká odpověď i každá položka FAQ mají aspoň jednu oporu.
- 0 znaků U+2014. Bez AI frází („Ve světě", „Klíčem je", „Pojďme se", „Není to jen", „Nejde jen o", „Závěrem", „V dnešní době").

Kontrola neověří, že citace tvrzení opravdu dokládá. To pokryla obsahová revize výše.

```
OK    nocni-smeny-a-hubnuti
OK    objem-treninku-v-diete
OK    omega-3-oxidace
OK    omlazeni-hubnutim
OK    ovoce-a-cukr-mytus
OK    pitny-rezim
OK    planovani-jidel-pro-vytvoreni-kalorickeho-deficitu-klic-k-uspesnemu-hu
OK    poceni-a-spalovani-tuku-mytus
OK    pohyb-a-nalada
OK    pomaly-metabolismus-mytus
OK    posilovani-je-dobre-pro-vase-svaly-i-mozek
OK    precetl-jsem-vsechny-studie-o-elektrolytech-prumysl-lze
OK    prerusovany-pust-co-rikaji-studie
OK    probiotika-co-funguje
OK    protahovani-pred-treninkem-mytus
OK    protein-a-mortalita-mytus-vyvracen-dalsi-dil-serie-veda-vs-myty-ve-vyz
OK    protein-po-treninku
OK    rostlinne-vs-zivocisne-bilkoviny-svaly
OK    rostliny-jsou-plne-jedu
OK    sacharidy-pred-treninkem
OK    sarkopenie-svaly-po-50
OK    silovy-trenink-dlouhovekost
OK    silovy-trenink-pro-zeny
OK    silovy-trenink-zlepsuje-mobilitu
OK    silovy-trenink-zlepsuje-mozkove-funkce-studie
OK    sladidla-a-mikrobiom
OK    soja-a-hormony-mytus
OK    spalovace-tuku-co-funguje-a-co-je-mytus
OK    spanek-a-hubnuti
OK    spanek-vyziva-a-fitness-u-populace-40
OK    spankova-apnoe-a-hubnuti
OK    stale-si-myslim-ze-kolagen-je-podvod
OK    superpotraviny-mytus
OK    svaly-v-kalorickem-deficitu
OK    tehotne-zeny-netrapte-se-strachem-z-tezkych-cviku-dalsi-dil-serie-veda
OK    testosteron-4-paky
OK    toxiny-v-jidle-strach-versus-realita-aneb-8-nejcastejsich-toxinovych-o
OK    trenujes-tak-tvrde
OK    tuk-a-sval-premena-mytus
OK    tuky-a-light-potraviny-mytus
OK    ultra-zpracovana-jidla
OK    umela-sladidla-mytus
OK    vetsina-lidi-ma-za-to-ze-po-30-letech-jde-mozek-z-kopce-realita-je-jin
OK    vikendove-prejidani
OK    vitamin-d-na-co-ma-smysl
OK    vlaknina
OK    vo2max-a-delsi-zivot
OK    vyhrez-plotenky
OK    vyziva-deti
OK    vyziva-sportujiciho-ditete
OK    vzorovy-jidelnicek-na-hubnuti
OK    zeny-a-posilovani-zmohutni
souboru: 52, s chybou: 0
```

Dodatečně: `grep -c $'\u2014' _cloud/geo-odpovedi/*.json` = 0 u všech 52 souborů, všechny soubory projdou `json.load`.

## Dávka 3 po článcích (všech 52 hotových)

| # | Soubor JSON | Hlavní otázka | FAQ | Opor | Nejisté |
|---|---|---|---|---|---|
| 101 | `nocni-smeny-a-hubnuti.json` | Proč se mi na nočních směnách hůř hubne a co s tím dělat? | 5 | 17 | 2 |
| 102 | `objem-treninku-v-diete.json` | Mám v dietě ubrat počet sérií v tréninku, abych nepřišel o svaly? | 4 | 12 | 3 |
| 103 | `omega-3-oxidace.json` | Je rybí olej z lékárny zoxidovaný a má smysl ho brát? | 5 | 20 | 3 |
| 104 | `omlazeni-hubnutim.json` | Může hubnutí omladit tělo na úrovni buněk? | 4 | 14 | 3 |
| 105 | `ovoce-a-cukr-mytus.json` | Můžu jíst ovoce, když hubnu, nebo má moc cukru? | 5 | 16 | 2 |
| 106 | `pitny-rezim.json` | Kolik vody denně pít, když hubnu? | 5 | 9 | 3 |
| 107 | `planovani-jidel-pro-vytvoreni-kalorickeho-deficitu-klic-k-uspesnemu-hu.json` | Jak si naplánovat jídla, abych byl v kalorickém deficitu a hubnul? | 4 | 12 | 3 |
| 108 | `poceni-a-spalovani-tuku-mytus.json` | Spaluje pocení v sauně nebo pod neoprenovým pásem tuk? | 5 | 16 | 3 |
| 109 | `pohyb-a-nalada.json` | Pomáhá cvičení proti depresi? | 4 | 10 | 3 |
| 110 | `pomaly-metabolismus-mytus.json` | Může za to, že nehubnu, pomalý metabolismus? | 4 | 22 | 2 |
| 111 | `posilovani-je-dobre-pro-vase-svaly-i-mozek.json` | Prospívá posilování i mozku, nebo je pravda, že svalovci jsou hloupí? | 4 | 11 | 3 |
| 112 | `precetl-jsem-vsechny-studie-o-elektrolytech-prumysl-lze.json` | Mají elektrolytové doplňky smysl, nebo jsou zbytečné? | 4 | 12 | 4 |
| 113 | `prerusovany-pust-co-rikaji-studie.json` | Funguje přerušovaný půst na hubnutí líp než klasické počítání kalorií? | 5 | 10 | 3 |
| 114 | `probiotika-co-funguje.json` | Fungují probiotika v kapslích pro zdravé střevo? | 5 | 11 | 3 |
| 115 | `protahovani-pred-treninkem-mytus.json` | Chrání protahování před tréninkem před zraněním? | 4 | 13 | 3 |
| 116 | `protein-a-mortalita-mytus-vyvracen-dalsi-dil-serie-veda-vs-myty-ve-vyz.json` | Zvyšuje vysoký příjem bílkovin riziko úmrtí? | 4 | 12 | 3 |
| 117 | `protein-po-treninku.json` | Kolik bílkovin denně potřebuju, když posiluju? | 5 | 15 | 3 |
| 118 | `rostlinne-vs-zivocisne-bilkoviny-svaly.json` | Dají se postavit svaly na rostlinných bílkovinách stejně jako na mase? | 4 | 11 | 3 |
| 119 | `rostliny-jsou-plne-jedu.json` | Jsou rostliny opravdu plné jedů a mám se bát zeleniny? | 4 | 13 | 2 |
| 120 | `sacharidy-pred-treninkem.json` | Potřebuju před silovým tréninkem sníst sacharidy, třeba banán? | 4 | 10 | 3 |
| 121 | `sarkopenie-svaly-po-50.json` | Jak po padesátce nepřijít o svaly a sílu? | 5 | 18 | 3 |
| 122 | `silovy-trenink-dlouhovekost.json` | Kolik silového tréninku týdně stačí, aby to mělo vliv na délku života? | 5 | 20 | 3 |
| 123 | `silovy-trenink-pro-zeny.json` | Zmohutní žena z posilování? | 5 | 18 | 2 |
| 124 | `silovy-trenink-zlepsuje-mobilitu.json` | Zlepší posilování pohyblivost stejně jako strečink? | 5 | 19 | 3 |
| 125 | `silovy-trenink-zlepsuje-mozkove-funkce-studie.json` | Zlepšuje silový trénink fungování mozku? | 4 | 10 | 3 |
| 126 | `sladidla-a-mikrobiom.json` | Ničí umělá sladidla střevní mikrobiom? | 4 | 9 | 2 |
| 127 | `soja-a-hormony-mytus.json` | Zvyšuje sója estrogen a snižuje mužům testosteron? | 4 | 17 | 2 |
| 128 | `spalovace-tuku-co-funguje-a-co-je-mytus.json` | Fungují spalovače tuků na hubnutí? | 5 | 22 | 3 |
| 129 | `spanek-a-hubnuti.json` | Jak spánek ovlivňuje hubnutí? | 3 | 10 | 2 |
| 130 | `spanek-vyziva-a-fitness-u-populace-40.json` | Co pomáhá lidem po čtyřicítce se stravou, pohybem a spánkem? | 5 | 16 | 4 |
| 131 | `spankova-apnoe-a-hubnuti.json` | Může za to, že mi stojí váha, spánková apnoe? | 4 | 9 | 3 |
| 132 | `stale-si-myslim-ze-kolagen-je-podvod.json` | Má smysl brát kolagen jako doplněk stravy? | 3 | 10 | 2 |
| 133 | `superpotraviny-mytus.json` | Vyplatí se jíst superpotraviny jako chia, spirulina nebo goji? | 4 | 17 | 2 |
| 134 | `svaly-v-kalorickem-deficitu.json` | Dá se nabírat svaly a zároveň hubnout v kalorickém deficitu? | 5 | 9 | 2 |
| 135 | `tehotne-zeny-netrapte-se-strachem-z-tezkych-cviku-dalsi-dil-serie-veda.json` | Je bezpečné v těhotenství zvedat těžké činky? | 4 | 14 | 4 |
| 136 | `testosteron-4-paky.json` | Mám po čtyřicítce řešit testosteron doplňky? | 3 | 9 | 3 |
| 137 | `toxiny-v-jidle-strach-versus-realita-aneb-8-nejcastejsich-toxinovych-o.json` | Jsou pesticidy, sladidla, GMO a další „toxiny“ v jídle opravdu nebezpečné? | 5 | 18 | 3 |
| 138 | `trenujes-tak-tvrde.json` | Trénuju v posilovně opravdu tak tvrdě, jak si myslím? | 5 | 15 | 2 |
| 139 | `tuk-a-sval-premena-mytus.json` | Může se tuk přeměnit ve sval? | 5 | 12 | 3 |
| 140 | `tuky-a-light-potraviny-mytus.json` | Tloustne se z tuku v jídle a pomáhají light potraviny zhubnout? | 5 | 10 | 2 |
| 141 | `ultra-zpracovana-jidla.json` | Proč se z ultra-zpracovaných potravin přejím, i když to nepoznám? | 5 | 20 | 3 |
| 142 | `umela-sladidla-mytus.json` | Jsou umělá sladidla škodlivá a kolik je moc? | 4 | 12 | 3 |
| 143 | `vetsina-lidi-ma-za-to-ze-po-30-letech-jde-mozek-z-kopce-realita-je-jin.json` | Opravdu jde po třicítce mozek z kopce? | 3 | 5 | 3 |
| 144 | `vikendove-prejidani.json` | Jak si užít víkend a přitom si nezbořit hubnutí? | 5 | 10 | 3 |
| 145 | `vitamin-d-na-co-ma-smysl.json` | Má smysl brát po čtyřicítce vitamin D? | 5 | 26 | 3 |
| 146 | `vlaknina.json` | Kolik vlákniny denně jíst a proč pomáhá při hubnutí? | 4 | 12 | 2 |
| 147 | `vo2max-a-delsi-zivot.json` | Prodlouží mi vysoký VO2max život? | 3 | 7 | 3 |
| 148 | `vyhrez-plotenky.json` | Musím jít s výhřezem ploténky na operaci? | 5 | 24 | 3 |
| 149 | `vyziva-deti.json` | Jak nastavit výživu dítěte, aby jedlo zdravě a u stolu nebyly války? | 5 | 27 | 3 |
| 150 | `vyziva-sportujiciho-ditete.json` | Co a kolik má jíst dítě, které sportuje skoro každý den? | 5 | 29 | 4 |
| 151 | `vzorovy-jidelnicek-na-hubnuti.json` | Jak může vypadat jídelníček na hubnutí kolem 1500 kcal na jeden den? | 5 | 20 | 3 |
| 152 | `zeny-a-posilovani-zmohutni.json` | Zmohutním jako žena, když budu zvedat těžké činky? | 5 | 14 | 3 |

## Úplný seznam článků blogu (abecedně podle cesty)

| # | Cesta | Dávka |
|---|---|---|
| 1 | `clanky/alkohol-a-hubnuti.html` | 1 |
| 2 | `clanky/bcaa-aminokyseliny-mytus.html` | 1 |
| 3 | `clanky/bezlepkova-dieta-mytus.html` | 1 |
| 4 | `clanky/bilkoviny-a-ledviny-mytus.html` | 1 |
| 5 | `clanky/bilkoviny.html` | 1 |
| 6 | `clanky/bolave-svaly-doms-mytus.html` | 1 |
| 7 | `clanky/certifikace-trener-vyzivovy-poradce.html` | 1 |
| 8 | `clanky/cheat-day.html` | 1 |
| 9 | `clanky/cholesterol-co-snizuje-ldl.html` | 1 |
| 10 | `clanky/clean-eating-mytus.html` | 1 |
| 11 | `clanky/co-dela-stravu-zdravou.html` | 1 |
| 12 | `clanky/co-jist-pri-hubnuti.html` | 1 |
| 13 | `clanky/co-kdybych-musel-vybrat-jen-3-suplementy-ktere-se-opravdu-vyplati-vets.html` | 1 |
| 14 | `clanky/cukr-je-jed-mytus.html` | 1 |
| 15 | `clanky/cviceni-pro-mozek-po-sedesatce.html` | 1 |
| 16 | `clanky/detox-diety-a-caje-mytus.html` | 1 |
| 17 | `clanky/dna-testy-na-hubnuti.html` | 1 |
| 18 | `clanky/doporuceni-bisglycinatu-horciku-pro-vas-aktivni-zivotni-styl.html` | 1 |
| 19 | `clanky/e-book-nejcastejsi-dotazy-klientu-alkohol-hubnuti-a-spolecenske-udalos.html` | 1 |
| 20 | `clanky/e-book-nejcastejsi-dotazy-klientu-analogie-hubnuti-na-auto-nakup-v-obc.html` | 1 |
| 21 | `clanky/e-book-nejcastejsi-dotazy-klientu-chute-a-hlad.html` | 1 |
| 22 | `clanky/e-book-nejcastejsi-dotazy-klientu-co-je-vic-cviceni-nebo-strava.html` | 1 |
| 23 | `clanky/e-book-nejcastejsi-dotazy-klientu-ketogenni-dieta-a-sacharidy.html` | 1 |
| 24 | `clanky/e-book-nejcastejsi-dotazy-klientu-maso-versus-proteinovy-prasek.html` | 1 |
| 25 | `clanky/e-book-nejcastejsi-dotazy-klientu-nabirani-tuku-na-bunecne-urovni.html` | 1 |
| 26 | `clanky/e-book-nejcastejsi-dotazy-klientu-ovoce-vs-bebe-susenka-z-hlediska-cuk.html` | 1 |
| 27 | `clanky/e-book-nejcastejsi-dotazy-klientu-pohybove-aktivity.html` | 1 |
| 28 | `clanky/e-book-nejcastejsi-dotazy-klientu-prakticke-tipy-z-praxe.html` | 1 |
| 29 | `clanky/e-book-nejcastejsi-dotazy-klientu-pravo-volby.html` | 1 |
| 30 | `clanky/e-book-nejcastejsi-dotazy-klientu-proc-hubnu-v-ruznych-fazich-zivota-n.html` | 1 |
| 31 | `clanky/e-book-nejcastejsi-dotazy-klientu-proc-telesna-vaha-kolisa-i-kdyz-hubn.html` | 1 |
| 32 | `clanky/e-book-nejcastejsi-dotazy-klientu-proc-vice-kcal-nemusi-vzdy-znamenat.html` | 1 |
| 33 | `clanky/e-book-nejcastejsi-dotazy-klientu-spanek.html` | 1 |
| 34 | `clanky/e-book-nejcastejsi-dotazy-klientu-stres-sympatikus-a-parasympatikus.html` | 1 |
| 35 | `clanky/e-book-nejcastejsi-dotazy-klientu-studie-na-tema-diet-breaks-tedy-pauz.html` | 1 |
| 36 | `clanky/e-book-nejcastejsi-dotazy-klientu-suplementy-se-kterymi-se-muzete-setk.html` | 1 |
| 37 | `clanky/e-book-nejcastejsi-dotazy-klientu-telo-jako-stroj.html` | 1 |
| 38 | `clanky/e-book-nejcastejsi-dotazy-klientu-zanety-a-stravovani-studie.html` | 1 |
| 39 | `clanky/ektomorf-mezomorf-endomorf.html` | 1 |
| 40 | `clanky/elonga-hrv-veda-nebo-marketing.html` | 1 |
| 41 | `clanky/fat-burning-zona-mytus.html` | 1 |
| 42 | `clanky/flexibilni-stravovani.html` | 1 |
| 43 | `clanky/funguje-wobenzym.html` | 1 |
| 44 | `clanky/funkcni-trenink-vs-poctiva-sila-co-skutecne-funguje.html` | 1 |
| 45 | `clanky/glykemicky-index-mytus.html` | 1 |
| 46 | `clanky/hnedy-cukr-med-mytus.html` | 1 |
| 47 | `clanky/hubnuti-a-vek-mozku.html` | 1 |
| 48 | `clanky/hubnuti-a-zdravi-mozku.html` | 1 |
| 49 | `clanky/hubnuti-po-40.html` | 1 |
| 50 | `clanky/hydratace-deti-sport.html` | 1 |
| 51 | `clanky/injekce-na-hubnuti-ozempic.html` | 2 |
| 52 | `clanky/inzulinova-rezistence-prediabetes.html` | 2 |
| 53 | `clanky/jak-rychle-zhubnout.html` | 2 |
| 54 | `clanky/jak-zacit-hubnout.html` | 2 |
| 55 | `clanky/jak-zhubnout-bez-cviceni.html` | 2 |
| 56 | `clanky/jak-zhubnout-bricho.html` | 2 |
| 57 | `clanky/jak-zhubnout-po-50.html` | 2 |
| 58 | `clanky/jak-zhubnout-v-obliceji.html` | 2 |
| 59 | `clanky/jak-ziskat-prvni-klienty-trener-vyzivovy-poradce.html` | 2 |
| 60 | `clanky/je-citlivost-na-lepek-realna-nebo-jen-v-hlave.html` | 2 |
| 61 | `clanky/je-cola-zero-horsi-nez-obycejna-cola.html` | 2 |
| 62 | `clanky/jeden-z-vas-mi-poslal-tohle-video-s-dotazem-zda-je-to-pravda-a-mozna-i.html` | 2 |
| 63 | `clanky/jist-casteji-mytus.html` | 2 |
| 64 | `clanky/jist-po-seste-vecer-se-tloustne-mytus.html` | 2 |
| 65 | `clanky/jist-vecer-tloustne.html` | 2 |
| 66 | `clanky/jojo-efekt.html` | 2 |
| 67 | `clanky/jsou-umela-sladidla-zlo-pro-tvoje-streva.html` | 2 |
| 68 | `clanky/kaloricky-deficit-kolik-jist.html` | 2 |
| 69 | `clanky/kaloricky-deficit.html` | 2 |
| 70 | `clanky/kardio-na-lacno-mytus.html` | 2 |
| 71 | `clanky/kardio-nici-svaly-mytus.html` | 2 |
| 72 | `clanky/kardio-spaluje-mene.html` | 2 |
| 73 | `clanky/kdy-ma-mozek-vrchol.html` | 2 |
| 74 | `clanky/kofein-a-jeho-bezpecna-konzumace.html` | 2 |
| 75 | `clanky/kofein-pred-treninkem.html` | 2 |
| 76 | `clanky/kolagen-na-slachy-a-klouby.html` | 2 |
| 77 | `clanky/kolagen-vs-bilkoviny.html` | 2 |
| 78 | `clanky/kolik-kavy-denne.html` | 2 |
| 79 | `clanky/kolik-kroku-denne-chuze-na-hubnuti.html` | 2 |
| 80 | `clanky/kolik-let-pridava-zdravy-zivot.html` | 2 |
| 81 | `clanky/kolik-si-vydela-trener-vyzivovy-poradce.html` | 2 |
| 82 | `clanky/kolik-spanku-delka-pravidelnost.html` | 2 |
| 83 | `clanky/kolik-vajec-denne-cholesterol-mytus.html` | 2 |
| 84 | `clanky/korelace-neni-kauzalita.html` | 2 |
| 85 | `clanky/kreatin-nejen-pro-svaly-ale-i-pro-mozek.html` | 2 |
| 86 | `clanky/kreatin-pro-zeny.html` | 2 |
| 87 | `clanky/kroky-vs-presnost-jidla.html` | 2 |
| 88 | `clanky/kvetnova-motivace.html` | 2 |
| 89 | `clanky/lide-nesnasi-odpovednost-a-vzdy-se-snazi-najit-obetniho-beranka.html` | 2 |
| 90 | `clanky/lokalni-hubnuti-cviky-na-bricho.html` | 2 |
| 91 | `clanky/makroziviny-a-hubnuti.html` | 2 |
| 92 | `clanky/malo-spanku-a-hubnuti.html` | 2 |
| 93 | `clanky/maslo-a-kardiovaskularni-onemocneni.html` | 2 |
| 94 | `clanky/melatonin-na-spanek.html` | 2 |
| 95 | `clanky/meli-byste-pocitat-objem-treninku-jako-sety-nebo-reps-oboje-dalsi-dil.html` | 2 |
| 96 | `clanky/menopauza-a-pribyvani-vahy.html` | 2 |
| 97 | `clanky/mleko-a-mlecne-mytus.html` | 2 |
| 98 | `clanky/musis-snidat-abys-zhubl-mytus.html` | 2 |
| 99 | `clanky/namitky-proti-kalorickemu-deficitu.html` | 2 |
| 100 | `clanky/nez-se-zacnes-bat-chemikalii-ujisti-se-ze-jsi-absolvoval-zakladni-kurz.html` | 2 |
| 101 | `clanky/nocni-smeny-a-hubnuti.html` | 3 |
| 102 | `clanky/objem-treninku-v-diete.html` | 3 |
| 103 | `clanky/omega-3-oxidace.html` | 3 |
| 104 | `clanky/omlazeni-hubnutim.html` | 3 |
| 105 | `clanky/ovoce-a-cukr-mytus.html` | 3 |
| 106 | `clanky/pitny-rezim.html` | 3 |
| 107 | `clanky/planovani-jidel-pro-vytvoreni-kalorickeho-deficitu-klic-k-uspesnemu-hu.html` | 3 |
| 108 | `clanky/poceni-a-spalovani-tuku-mytus.html` | 3 |
| 109 | `clanky/pohyb-a-nalada.html` | 3 |
| 110 | `clanky/pomaly-metabolismus-mytus.html` | 3 |
| 111 | `clanky/posilovani-je-dobre-pro-vase-svaly-i-mozek.html` | 3 |
| 112 | `clanky/precetl-jsem-vsechny-studie-o-elektrolytech-prumysl-lze.html` | 3 |
| 113 | `clanky/prerusovany-pust-co-rikaji-studie.html` | 3 |
| 114 | `clanky/probiotika-co-funguje.html` | 3 |
| 115 | `clanky/protahovani-pred-treninkem-mytus.html` | 3 |
| 116 | `clanky/protein-a-mortalita-mytus-vyvracen-dalsi-dil-serie-veda-vs-myty-ve-vyz.html` | 3 |
| 117 | `clanky/protein-po-treninku.html` | 3 |
| 118 | `clanky/rostlinne-vs-zivocisne-bilkoviny-svaly.html` | 3 |
| 119 | `clanky/rostliny-jsou-plne-jedu.html` | 3 |
| 120 | `clanky/sacharidy-pred-treninkem.html` | 3 |
| 121 | `clanky/sarkopenie-svaly-po-50.html` | 3 |
| 122 | `clanky/silovy-trenink-dlouhovekost.html` | 3 |
| 123 | `clanky/silovy-trenink-pro-zeny.html` | 3 |
| 124 | `clanky/silovy-trenink-zlepsuje-mobilitu.html` | 3 |
| 125 | `clanky/silovy-trenink-zlepsuje-mozkove-funkce-studie.html` | 3 |
| 126 | `clanky/sladidla-a-mikrobiom.html` | 3 |
| 127 | `clanky/soja-a-hormony-mytus.html` | 3 |
| 128 | `clanky/spalovace-tuku-co-funguje-a-co-je-mytus.html` | 3 |
| 129 | `clanky/spanek-a-hubnuti.html` | 3 |
| 130 | `clanky/spanek-vyziva-a-fitness-u-populace-40.html` | 3 |
| 131 | `clanky/spankova-apnoe-a-hubnuti.html` | 3 |
| 132 | `clanky/stale-si-myslim-ze-kolagen-je-podvod.html` | 3 |
| 133 | `clanky/superpotraviny-mytus.html` | 3 |
| 134 | `clanky/svaly-v-kalorickem-deficitu.html` | 3 |
| 135 | `clanky/tehotne-zeny-netrapte-se-strachem-z-tezkych-cviku-dalsi-dil-serie-veda.html` | 3 |
| 136 | `clanky/testosteron-4-paky.html` | 3 |
| 137 | `clanky/toxiny-v-jidle-strach-versus-realita-aneb-8-nejcastejsich-toxinovych-o.html` | 3 |
| 138 | `clanky/trenujes-tak-tvrde.html` | 3 |
| 139 | `clanky/tuk-a-sval-premena-mytus.html` | 3 |
| 140 | `clanky/tuky-a-light-potraviny-mytus.html` | 3 |
| 141 | `clanky/ultra-zpracovana-jidla.html` | 3 |
| 142 | `clanky/umela-sladidla-mytus.html` | 3 |
| 143 | `clanky/vetsina-lidi-ma-za-to-ze-po-30-letech-jde-mozek-z-kopce-realita-je-jin.html` | 3 |
| 144 | `clanky/vikendove-prejidani.html` | 3 |
| 145 | `clanky/vitamin-d-na-co-ma-smysl.html` | 3 |
| 146 | `clanky/vlaknina.html` | 3 |
| 147 | `clanky/vo2max-a-delsi-zivot.html` | 3 |
| 148 | `clanky/vyhrez-plotenky.html` | 3 |
| 149 | `clanky/vyziva-deti.html` | 3 |
| 150 | `clanky/vyziva-sportujiciho-ditete.html` | 3 |
| 151 | `clanky/vzorovy-jidelnicek-na-hubnuti.html` | 3 |
| 152 | `clanky/zeny-a-posilovani-zmohutni.html` | 3 |


## Příloha: kontrolní skripty

Skripty nejsou v repu jako samostatné soubory, protože `_cloud/` jde při deployi na web (viz výše) a `.md` ne.
Spuštění: oba soubory do jedné složky, pak `python3 check.py <cesta k repu> <soubor se slugy, jeden na řádek>`.

### extract.py

```python
"""Extrahuje čistý text článku z clanky/<slug>.html.
Obsah: h1 + <article> bez cta-box, author-box, disclaimer, sekce 'Mohlo by tě zajímat'.
Každý blokový prvek = samostatný řádek."""
import sys, re, html, json, os
from html.parser import HTMLParser

BLOCK = {'p','li','h1','h2','h3','h4','h5','td','th','blockquote','figcaption','div','tr','br','dt','dd','summary'}
SKIP_CLASSES = {'cta-box','author-box','disclaimer','info-gallery'}

class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_h1=False; self.in_article=0; self.skip=[]; self.stack=[]
        self.lines=[]; self.buf=[]; self.title=''; self.canon=''; self.h1=''
        self.in_title=False; self.mohlo=False; self.cur_h2=None
    def flush(self):
        t=re.sub(r'\s+',' ',''.join(self.buf).replace('\xa0',' ')).strip()
        if t: self.lines.append(t)
        self.buf=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='title': self.in_title=True
        if tag=='link' and a.get('rel')=='canonical': self.canon=a.get('href','')
        if tag=='h1': self.in_h1=True
        if tag in ('script','style'): self.skip.append(tag); return
        if tag=='article': self.in_article+=1
        cls=set((a.get('class') or '').split())
        if self.in_article and tag not in ('br','img','input','meta','link','hr'):
            self.stack.append((tag, bool(cls & SKIP_CLASSES)))
        if tag in BLOCK: self.flush()
        if tag=='h2' and self.in_article: self.cur_h2=[]
    def handle_endtag(self,tag):
        if tag=='title': self.in_title=False
        if self.skip and tag==self.skip[-1]: self.skip.pop(); return
        if tag in BLOCK: self.flush()
        if tag=='h1': self.in_h1=False
        if self.in_article and self.stack:
            # pop to matching tag
            for i in range(len(self.stack)-1,-1,-1):
                if self.stack[i][0]==tag:
                    del self.stack[i:]; break
        if tag=='h2' and self.cur_h2 is not None:
            txt=''.join(self.cur_h2).strip()
            self.mohlo = txt.startswith('Mohlo by tě zajímat')
            if self.mohlo and self.lines and self.lines[-1].startswith('Mohlo by tě zajímat'):
                self.lines.pop()
            self.cur_h2=None
        if tag=='article': self.in_article-=1
    def handle_data(self,d):
        if self.skip: return
        if self.in_title: self.title+=d
        if self.in_h1:
            self.h1+=d; self.buf.append(d); return
        if not self.in_article: return
        if any(s for _,s in self.stack): return
        if self.cur_h2 is not None: self.cur_h2.append(d)
        if self.mohlo and self.cur_h2 is None: return
        self.buf.append(d)

def extract(path):
    p=P(); p.feed(open(path,encoding='utf-8').read()); p.flush()
    return p

if __name__=='__main__':
    out=sys.argv[1]; meta={}
    for path in sys.argv[2:]:
        p=extract(path); slug=os.path.basename(path)[:-5]
        open(os.path.join(out,slug+'.txt'),'w',encoding='utf-8').write('\n'.join(p.lines)+'\n')
        meta[slug]={'url':p.canon,'titulek':re.sub(r'\s+',' ',p.h1).strip(),'title':p.title.strip(),'radku':len(p.lines)}
    json.dump(meta,open(os.path.join(out,'_meta.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=1)
```

### check.py

```python
"""Kontrola _cloud/geo-odpovedi/<slug>.json proti textu článku.
Použití: python3 check.py <repo> <seznam_slugu.txt> [--quiet]"""
import sys, os, re, json, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract import extract

FRAZE = ['ve světě', 'klíčem je', 'klíčem k', 'pojďme se', 'není to jen', 'nejde jen o', 'závěrem', 'v dnešní době', 'je důležité si uvědomit']
OK_PRO = re.compile(r'^(kratka_odpoved|faq\[(\d+)\])$')

def norm(s): return re.sub(r'\s+', ' ', s.replace('\xa0', ' ')).strip()

def raw_strip(path):
    """Nezávislá druhá cesta: celý <article> + h1, regexem bez HTML."""
    t = open(path, encoding='utf-8').read()
    h1 = re.search(r'<h1[^>]*>(.*?)</h1>', t, re.S).group(1)
    art = re.search(r'<article[^>]*>(.*?)</article>', t, re.S).group(1)
    s = h1 + '\n' + art
    s = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', s, flags=re.S)
    s = re.sub(r'<!--.*?-->', ' ', s, flags=re.S)
    s = re.sub(r'</?(strong|em|b|i|a|span|sup|sub|code|abbr|mark|small|u)(\s[^>]*)?>', '', s)
    s = re.sub(r'<[^>]+>', ' ', s)
    return norm(html.unescape(s))

def words(s): return len(re.findall(r'\S+', s))
def sentences(s): return len([x for x in re.split(r'(?<=[.!?])\s+', s.strip()) if x])

def check(repo, slug):
    errs, warns = [], []
    path = os.path.join(repo, 'clanky', slug + '.html')
    jp = os.path.join(repo, '_cloud', 'geo-odpovedi', slug + '.json')
    if not os.path.exists(jp): return ['CHYBI JSON'], [], None
    raw = open(jp, encoding='utf-8').read()
    if '\u2014' in raw: errs.append('obsahuje U+2014 (%d×)' % raw.count('\u2014'))
    try: d = json.loads(raw)
    except Exception as e: return ['nevalidni JSON: %s' % e], [], None
    p = extract(path)
    lines = [norm(l) for l in p.lines]
    whole = raw_strip(path)
    keys = ['url', 'titulek', 'hlavni_otazka', 'kratka_odpoved', 'faq', 'opory', 'nejiste']
    for k in keys:
        if k not in d: errs.append('chybi klic ' + k)
    extra = set(d) - set(keys)
    if extra: errs.append('klice navic: %s' % extra)
    if errs: return errs, warns, d
    if d['url'] != p.canon: errs.append('url %r != canonical %r' % (d['url'], p.canon))
    if norm(d['titulek']) != norm(p.h1): errs.append('titulek != h1 (%r)' % norm(p.h1))
    ko = d['kratka_odpoved']
    if words(ko) > 60: errs.append('kratka_odpoved %d slov > 60' % words(ko))
    if not 2 <= sentences(ko) <= 3: warns.append('kratka_odpoved ma %d vet' % sentences(ko))
    faq = d['faq']
    if not 3 <= len(faq) <= 5: errs.append('faq ma %d polozek' % len(faq))
    for i, f in enumerate(faq):
        if set(f) != {'otazka', 'odpoved'}: errs.append('faq[%d] spatne klice' % i)
        elif not 1 <= sentences(f['odpoved']) <= 3: warns.append('faq[%d] ma %d vet' % (i, sentences(f['odpoved'])))
    kryto = set()
    for j, o in enumerate(d['opory']):
        if set(o) != {'pro', 'citace'}: errs.append('opory[%d] spatne klice' % j); continue
        m = OK_PRO.match(o['pro'])
        if not m: errs.append('opory[%d].pro %r' % (j, o['pro']))
        elif m.group(2) is not None and int(m.group(2)) >= len(faq): errs.append('opory[%d] miri na neexistujici %s' % (j, o['pro']))
        else: kryto.add(o['pro'])
        c = norm(o['citace'])
        if len(c) < 15 and c not in lines: errs.append('opory[%d] citace prilis kratka (a neni celym radkem)' % j)
        if not any(c in l for l in lines): errs.append('opory[%d] citace NENI doslova v jednom bloku: %r' % (j, c[:90]))
        elif c not in whole: errs.append('opory[%d] citace neni v regex-textu: %r' % (j, c[:90]))
    for need in ['kratka_odpoved'] + ['faq[%d]' % i for i in range(len(faq))]:
        if need not in kryto: errs.append('bez opory: ' + need)
    if not isinstance(d['nejiste'], list): errs.append('nejiste neni seznam')
    gen = ' '.join([d['hlavni_otazka'], ko] + [f.get('otazka', '') + ' ' + f.get('odpoved', '') for f in faq]).lower()
    for fr in FRAZE:
        if fr in gen: warns.append('AI fraze: ' + fr)
    return errs, warns, d

if __name__ == '__main__':
    repo, lst = sys.argv[1], sys.argv[2]
    slugs = [l.strip() for l in open(lst) if l.strip()]
    bad = 0
    for s in slugs:
        e, w, d = check(repo, s)
        if e: bad += 1
        if e or w or '--quiet' not in sys.argv:
            print(('CHYBA ' if e else 'OK    ') + s)
            for x in e: print('   E', x)
            for x in w: print('   W', x)
    print('souboru: %d, s chybou: %d' % (len(slugs), bad))
```
