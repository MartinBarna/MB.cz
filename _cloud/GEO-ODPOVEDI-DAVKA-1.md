# GEO odpovědi, dávka 1 (články 1 až 50)

Větev `cloud/geo-odpovedi-1-1009` nad `origin/main` (`3f1a5a99a`), 9. 10. 2026.
Nic není nasazené ani slité do `main`. **Žádná HTML stránka se neměnila**, výstupem jsou jen
datové soubory k pozdější kontrole.

## Shrnutí

| | |
|---|---|
| Článků blogu celkem | 152 (`clanky/*.html` bez výpisu `clanky/index.html`) |
| Článků v dávce 1 | 50 (položky 1 až 50) |
| Hotovo | **50 z 50** |
| Vynecháno | 0 |
| Otázek ve FAQ celkem | 198 (3 až 5 na článek) |
| Opor (doslovných citací) celkem | 630 |
| Poznámek „nejiste“ celkem | 143 |
| Výsledek kontroly | **0 chyb** (viz níže) |

Výstup: `_cloud/geo-odpovedi/<slug>.json`, jeden soubor na článek, slug = název souboru článku bez `.html`.

### Co do seznamu článků nepatří
- `clanky/index.html` je výpis blogu, ne článek.
- `clanky-fronta/*.md` jsou nevydané koncepty v Markdownu, ne publikované články.
- `myty/`, `jak-zhubnout/`, `recepty-a-odpovedi/` a podobné jsou rozcestníky a landing stránky,
  ne články blogu. Kdyby se měly zpracovat taky, je to samostatná dávka.

## Jak jsem postupoval

1. Text každého článku jsem vytáhl skriptem z `<article>` (bez CTA boxů, boxu o autorovi,
   galerie infografik a bloku „Mohlo by tě zajímat“) a přečetl celý.
2. Hlavní otázku, krátkou odpověď a FAQ jsem psal jen z toho textu. Každé tvrzení má v `opory`
   doslovnou citaci. Když článek na otázku jasně neodpovídal, otázku jsem nedal a napsal to do `nejiste`.
3. Odborná čísla jsem přebíral přesně (g/kg, %, kcal, IU, mg/dl), bez zaokrouhlování a bez dopočtů.
   Kde by šlo něco dopočítat (třeba 10 % energie na gramy cukru), nedopočítával jsem a zapsal to do `nejiste`.
4. Text v infografikách (obrázcích) jsem nepoužil, jen viditelný text článku. U článků, kde je
   většina obsahu v obrázcích, je to v `nejiste` zmíněné.
5. Druhá osoba (tykání) jako v článcích. Kde článek mluví v první osobě Martina a v odpovědi
   by to znělo divně, píšu „Martin doporučuje“.

## Kontrola (skript `_cloud/geo-odpovedi-kontrola.py`)

Spuštění: `python3 -I _cloud/geo-odpovedi-kontrola.py 1 50` (dávka 2: `51 100`, dávka 3: `101 152`).
Skript je samostatný, bez závislostí, dá se použít i na další dávky.

| Kontrola | Výsledek |
|---|---|
| Všechny JSON validní, přesně požadované klíče | 50 / 50 |
| `url` odpovídá článku, `titulek` = H1 článku | 50 / 50 |
| `kratka_odpoved` nejvýš 60 slov a 2 až 3 věty | 50 / 50 |
| FAQ 3 až 5 položek, každá odpověď 1 až 3 věty | 50 / 50 |
| Každá položka (`kratka_odpoved`, `faq[i]`) má aspoň jednu oporu | 50 / 50 |
| Citace se doslova vyskytuje v textu článku, **dvě nezávislé extrakce** (obsah `<article>` bez CTA, a celé HTML se smazanými tagy) | **630 / 630** |
| Každé číslo v otázkách a odpovědích je i v textu článku | 0 nálezů |
| Znak U+2014 (dlouhá pomlčka) | **0** ve všech 50 souborech |
| AI fráze ze zadání („Ve světě…“, „Klíčem je…“, „Pojďme se podívat“, „Není to jen…“, „Závěrem“) | 0 |

Poslední běh: `Souboru: 50 | citaci: 630/630 nalezeno | U+2014: 0 | chyb celkem: 0`, návratový kód 0.

Pozn. k počítání vět: skript dělí podle tečky, otazníku a vykřičníku před velkým písmenem. Je to
hrubý odhad, ale při prvním běhu našel 16 krátkých odpovědí se 4 větami, ty jsem přepsal na 3.

## Na co se podívat před použitím (výběr z `nejiste`)

Tady jsou místa, kde **článek sám sobě protiřečí, opírá se o jedinou nejmenovanou studii nebo dává
konkrétní dávkování bez zdroje**. Odpovědi jsem v nich držel opatrně, ale stojí za Martinovu kontrolu:

- **Omega-3 si odporuje napříč články.** `co-kdybych-musel-vybrat-jen-3-suplementy…` ji doporučuje,
  e-book `…suplementy-se-kterymi-se-muzete-setk` nejdřív doporučuje 1 g EPA dvakrát denně a pak píše,
  že od roku 2021 ji kupovat nedoporučuje. V e-booku jsem proto k omega-3 otázku nedal.
- **BCAA v e-booku o suplementech:** nejdřív „přisypu si BCAA“, pak „kupovat nedoporučuju“. Bral jsem jen závěr.
- **Vitamin D 2000 / 4000 / 8000 IU** (`co-kdybych-musel-vybrat…`): Martinovo doporučení bez zdroje.
  Je to konkrétní dávkování, doporučuji potvrdit.
- **Rostlinné vs. živočišné bílkoviny** (`…maso-versus-proteinovy-prasek`): článek nejdřív vysvětluje,
  proč jsou rostlinné horší, a na konci píše, že od roku 2021 se ukazuje srovnatelný účinek.
- **Nabírání tuků na buněčné úrovni:** studie MacLeana bez citace (zřejmě převážně zvířecí výzkum),
  číselný příklad s buňkami je nejasný. Doporučuji ověřit, než se z toho stane citovaná odpověď.
- **Ovoce vs. Bebe:** pasáž o inzulinu („jednotka inzulinu přenáší asi 10–15 jednotek glukózy“) je
  zjednodušená až nepřesná, do odpovědí jsem z ní nic nebral.
- **Funkční trénink vs. síla:** celý článek stojí na jedné studii (Keiner et al. 2022). Údaje o ní
  doporučuji ověřit proti originálu.
- **Elonga:** článek jmenuje konkrétní firmu a osobu. Odpovědi nepřesahují článek, ale jde o
  tvrzení o cizím produktu, tak ať je Martin vidí.
- **Wobenzym, hořčík, hydratace dětí:** léky, doplňky a děti. Odpovědi drží upozornění z článků
  (lékař, není to lékařské doporučení) a nepřidávají dávkování navíc.
- **Dvě čísla glykogenu:** e-book o keto píše 32 g / 100 g svalu u atleta, e-book o kolísání váhy 33 g.
  Každý JSON drží číslo ze svého článku.

## Seznam všech článků blogu (abecedně podle cesty)

Zdroj: `clanky/*.html` bez `clanky/index.html` (výpis blogu), celkem **152 článků**.
Dávka 1 = 1 až 50, dávka 2 = 51 až 100, dávka 3 = 101 až 152.

| # | Soubor | Dávka |
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

## Dávka 1: výsledek po článcích

| # | JSON | Hlavní otázka | FAQ | Opory | Kontrola |
|---|---|---|---|---|---|
| 1 | `alkohol-a-hubnuti.json` | Můžu hubnout, když piju alkohol? | 4 | 8 | OK |
| 2 | `bcaa-aminokyseliny-mytus.json` | Mám brát BCAA, abych nepřišel o svaly? | 5 | 13 | OK |
| 3 | `bezlepkova-dieta-mytus.json` | Zhubnu, když vyřadím lepek? | 4 | 12 | OK |
| 4 | `bilkoviny-a-ledviny-mytus.json` | Ničí vysoký příjem bílkovin ledviny? | 5 | 13 | OK |
| 5 | `bilkoviny.json` | Kolik bílkovin denně bych měl jíst? | 3 | 9 | OK |
| 6 | `bolave-svaly-doms-mytus.json` | Znamená svalovka po tréninku, že svaly rostou? | 5 | 18 | OK |
| 7 | `certifikace-trener-vyzivovy-poradce.json` | Co potřebuju, abych mohl pracovat jako trenér nebo výživový poradce? | 3 | 10 | OK |
| 8 | `cheat-day.json` | Je lepší cheat day, nebo cheat meal, když hubnu? | 3 | 10 | OK |
| 9 | `cholesterol-co-snizuje-ldl.json` | Jak snížit LDL cholesterol stravou a pohybem? | 5 | 13 | OK |
| 10 | `clean-eating-mytus.json` | Musím jíst čistě, abych zhubl? | 4 | 12 | OK |
| 11 | `co-dela-stravu-zdravou.json` | Co dělá stravu opravdu zdravou? | 4 | 12 | OK |
| 12 | `co-jist-pri-hubnuti.json` | Co jíst, když chci zhubnout? | 5 | 13 | OK |
| 13 | `co-kdybych-musel-vybrat-jen-3-suplementy-ktere-se-opravdu-vyplati-vets.json` | Které doplňky stravy se opravdu vyplatí běžnému člověku? | 4 | 11 | OK |
| 14 | `cukr-je-jed-mytus.json` | Je cukr opravdu jed a tloustne se z něj? | 5 | 15 | OK |
| 15 | `cviceni-pro-mozek-po-sedesatce.json` | Jaké cvičení je nejlepší pro mozek po šedesátce? | 3 | 8 | OK |
| 16 | `detox-diety-a-caje-mytus.json` | Fungují detox diety a detoxikační čaje? | 4 | 15 | OK |
| 17 | `dna-testy-na-hubnuti.json` | Vyplatí se DNA test na hubnutí? | 4 | 9 | OK |
| 18 | `doporuceni-bisglycinatu-horciku-pro-vas-aktivni-zivotni-styl.json` | Jaký hořčík brát, když hodně sportuju? | 4 | 11 | OK |
| 19 | `e-book-nejcastejsi-dotazy-klientu-alkohol-hubnuti-a-spolecenske-udalos.json` | Jak pít alkohol na oslavě a přitom dál hubnout? | 4 | 16 | OK |
| 20 | `e-book-nejcastejsi-dotazy-klientu-analogie-hubnuti-na-auto-nakup-v-obc.json` | Jak si jednoduše představit, jak funguje hubnutí a kalorie? | 4 | 12 | OK |
| 21 | `e-book-nejcastejsi-dotazy-klientu-chute-a-hlad.json` | Proč mám při hubnutí chutě na sladké? | 3 | 13 | OK |
| 22 | `e-book-nejcastejsi-dotazy-klientu-co-je-vic-cviceni-nebo-strava.json` | Co je důležitější pro výsledky, cvičení, nebo strava? | 3 | 11 | OK |
| 23 | `e-book-nejcastejsi-dotazy-klientu-ketogenni-dieta-a-sacharidy.json` | Hubne se na ketogenní dietě líp než na jiných dietách? | 5 | 16 | OK |
| 24 | `e-book-nejcastejsi-dotazy-klientu-maso-versus-proteinovy-prasek.json` | Je lepší bílkovina z masa, nebo z proteinového prášku? | 4 | 11 | OK |
| 25 | `e-book-nejcastejsi-dotazy-klientu-nabirani-tuku-na-bunecne-urovni.json` | Proč po dietě naberu víc tuku, než jsem měl předtím? | 3 | 12 | OK |
| 26 | `e-book-nejcastejsi-dotazy-klientu-ovoce-vs-bebe-susenka-z-hlediska-cuk.json` | Je ovoce lepší než sušenka, když obojí obsahuje cukr? | 4 | 12 | OK |
| 27 | `e-book-nejcastejsi-dotazy-klientu-pohybove-aktivity.json` | Jaký pohyb je nejlepší, když chci hubnout a mám nadváhu? | 4 | 16 | OK |
| 28 | `e-book-nejcastejsi-dotazy-klientu-prakticke-tipy-z-praxe.json` | Proč nehubnu, i když podle výpočtu jím málo kalorií? | 3 | 8 | OK |
| 29 | `e-book-nejcastejsi-dotazy-klientu-pravo-volby.json` | Má mi trenér určovat, jak mám vypadat? | 4 | 7 | OK |
| 30 | `e-book-nejcastejsi-dotazy-klientu-proc-hubnu-v-ruznych-fazich-zivota-n.json` | Proč hubnu v různých obdobích na jiném množství kalorií? | 3 | 11 | OK |
| 31 | `e-book-nejcastejsi-dotazy-klientu-proc-telesna-vaha-kolisa-i-kdyz-hubn.json` | Proč mi kolísá váha, i když hubnu? | 4 | 12 | OK |
| 32 | `e-book-nejcastejsi-dotazy-klientu-proc-vice-kcal-nemusi-vzdy-znamenat.json` | Přiberu tuk, když si zvýším kalorie? | 4 | 11 | OK |
| 33 | `e-book-nejcastejsi-dotazy-klientu-spanek.json` | Kolik hodin spánku potřebuju a jak spát líp? | 5 | 12 | OK |
| 34 | `e-book-nejcastejsi-dotazy-klientu-stres-sympatikus-a-parasympatikus.json` | Jak stres ovlivňuje chuť k jídlu a nabírání svalů? | 4 | 19 | OK |
| 35 | `e-book-nejcastejsi-dotazy-klientu-studie-na-tema-diet-breaks-tedy-pauz.json` | Pomáhají pauzy od diety (diet breaks) zhubnout víc? | 3 | 10 | OK |
| 36 | `e-book-nejcastejsi-dotazy-klientu-suplementy-se-kterymi-se-muzete-setk.json` | Které doplňky stravy mají smysl a které jsou zbytečné? | 5 | 26 | OK |
| 37 | `e-book-nejcastejsi-dotazy-klientu-telo-jako-stroj.json` | Funguje tělo jako stroj, kde stejný vstup dá vždy stejný výsledek? | 3 | 10 | OK |
| 38 | `e-book-nejcastejsi-dotazy-klientu-zanety-a-stravovani-studie.json` | Existuje protizánětlivá dieta? | 4 | 15 | OK |
| 39 | `ektomorf-mezomorf-endomorf.json` | Jsou somatotypy ektomorf, mezomorf a endomorf pravda? | 4 | 17 | OK |
| 40 | `elonga-hrv-veda-nebo-marketing.json` | Vyplatí se HRV náramek Elonga a dá se věřit jeho skóre stresu a regenerace? | 5 | 20 | OK |
| 41 | `fat-burning-zona-mytus.json` | Zhubnu víc, když budu cvičit ve spalovací tepové zóně? | 3 | 15 | OK |
| 42 | `flexibilni-stravovani.json` | Co je flexibilní stravování a dá se při něm hubnout? | 4 | 11 | OK |
| 43 | `funguje-wobenzym.json` | Funguje Wobenzym na záněty a bolest kloubů? | 4 | 10 | OK |
| 44 | `funkcni-trenink-vs-poctiva-sila-co-skutecne-funguje.json` | Je lepší funkční trénink, nebo klasický silový trénink s činkami? | 3 | 16 | OK |
| 45 | `glykemicky-index-mytus.json` | Pomáhá při hubnutí jíst potraviny s nízkým glykemickým indexem? | 4 | 15 | OK |
| 46 | `hnedy-cukr-med-mytus.json` | Je med nebo hnědý cukr zdravější než bílý cukr? | 4 | 10 | OK |
| 47 | `hubnuti-a-vek-mozku.json` | Omládne mi mozek, když zhubnu? | 4 | 10 | OK |
| 48 | `hubnuti-a-zdravi-mozku.json` | Souvisí nižší váha se zdravějším mozkem ve stáří? | 3 | 7 | OK |
| 49 | `hubnuti-po-40.json` | Proč se po čtyřicítce hůř hubne, zpomalí se metabolismus? | 5 | 12 | OK |
| 50 | `hydratace-deti-sport.json` | Stačí dítěti při sportu voda, nebo potřebuje iontový nápoj? | 5 | 15 | OK |
