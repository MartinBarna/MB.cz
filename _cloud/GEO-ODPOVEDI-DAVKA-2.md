# GEO odpovědi, dávka 2 (9. 10. 2026)

Větev `cloud/geo-odpovedi-2-1009` nad `origin/main`. **Nic není nasazené ani slité do `main`, žádná HTML stránka se neměnila.**
Výstupem jsou jen datové soubory `_cloud/geo-odpovedi/<slug>.json` k pozdější kontrole a dva pomocné skripty.

## Výsledek v číslech

| | |
|---|---|
| Článků v dávce | 50 (pozice 51 až 100) |
| Hotových JSON souborů | **50** |
| Vynechaných | **0** |
| Otázek v FAQ celkem | 228 (3 až 5 na článek) |
| Doslovných citací ověřených proti textu článku | **635 z 635** |
| Chyb kontroly | **0** |
| Znaků U+2014 (dlouhá pomlčka) ve výstupech | **0** |
| Zakázaných AI frází nalezených skriptem | 0 |

## Jak se určila dávka

- Články blogu jsou soubory `clanky/*.html` (153 souborů). Stejnou sadu bere jako články i `scripts/generuj-sitemap.mjs`.
- **`clanky/index.html` není článek, ale výpis blogu, proto do seznamu nepatří.** Zbývá **152 článků**,
  seřazených abecedně podle cesty (bajtové řazení, `LC_ALL=C sort`).
- Dávka 2 = články **51 až 100**, tedy `injekce-na-hubnuti-ozempic` až `nez-se-zacnes-bat-chemikalii-…`.
- ⚠️ Pro navázání dávek: kdyby dávka 3 počítala i `index.html`, začínala by o jedno místo dál a
  `nez-se-zacnes-bat-chemikalii-…` by udělala znovu (dvakrát hotový článek, nic nechybí). Na dávku 1
  (pozice 1 až 50) to vliv nemá, `index.html` je až na 51. místě úplného výpisu.
- Žádný článek v dávce nemá `noindex` ani přesměrování.

## Jak vznikly odpovědi a jak se kontrolovaly

1. `_cloud/geo-odpovedi/extrahuj_text.py` vytáhne z článku čistý text: H1, perex a tělo `<article>`.
   Vynechá CTA boxy, autorský box, sekci „Mohlo by tě zajímat“ (a vše za ní, v dávce je to jen seznam zdrojů
   u `jist-vecer-tloustne`), disclaimer, skripty a komentáře.
2. Každý článek se četl celý. Odpovědi stojí jen na jeho textu, každé tvrzení má v `opory` doslovnou citaci
   a každé číslo v odpovědi je v některé citaci pro tutéž položku.
3. Druhé kolo ručně: každá odpověď vedle svých citací, hledalo se přidané číslo, podmínka, příčina nebo zobecnění.
   Opravy z tohoto kola jsou například: zachovaná podmínka „ženy v redukčním režimu“, „podle článku“ u silných
   tvrzení překládaných příspěvků, u reverzní kauzality jen výklad, který dává článek, u kreatinu a mozku
   obě strany rozporu, který článek sám nerozhoduje.
4. `_cloud/geo-odpovedi/zkontroluj.py` (strojová kontrola, spouští se bez argumentů nad celou složkou) ověří:
   - validní JSON, přesně požadované klíče a typy;
   - `url` = canonical článku, `titulek` = jeho H1;
   - `kratka_odpoved` nejvýš 60 slov a 2 až 3 věty, `faq` 3 až 5 položek, odpověď v FAQ nejvýš 3 věty;
   - každé `pro` míří na existující položku a každá položka má aspoň jednu oporu;
   - **každá citace se doslova vyskytuje v čistém textu článku** (normalizují se jen bílé znaky a nezlomitelné mezery);
   - nikde není znak U+2014, ve výstupu nejsou fráze typu „Ve světě…“, „Klíčem je…“, „Pojďme se podívat“, „Závěrem“.

Spuštění: `python3 _cloud/geo-odpovedi/zkontroluj.py` (návratový kód 0 = vše v pořádku).
Skripty jsou v `_cloud/`, deploy na Wedos tuhle složku nenahrává.

## Výsledek kontroly (výstup skriptu)

```
OK     injekce-na-hubnuti-ozempic.json (25 citaci)
OK     inzulinova-rezistence-prediabetes.json (21 citaci)
OK     jak-rychle-zhubnout.json (19 citaci)
OK     jak-zacit-hubnout.json (17 citaci)
OK     jak-zhubnout-bez-cviceni.json (19 citaci)
OK     jak-zhubnout-bricho.json (11 citaci)
OK     jak-zhubnout-po-50.json (17 citaci)
OK     jak-zhubnout-v-obliceji.json (14 citaci)
OK     jak-ziskat-prvni-klienty-trener-vyzivovy-poradce.json (16 citaci)
OK     je-citlivost-na-lepek-realna-nebo-jen-v-hlave.json (12 citaci)
OK     je-cola-zero-horsi-nez-obycejna-cola.json (10 citaci)
OK     jeden-z-vas-mi-poslal-tohle-video-s-dotazem-zda-je-to-pravda-a-mozna-i.json (10 citaci)
OK     jist-casteji-mytus.json (16 citaci)
OK     jist-po-seste-vecer-se-tloustne-mytus.json (11 citaci)
OK     jist-vecer-tloustne.json (14 citaci)
OK     jojo-efekt.json (16 citaci)
OK     jsou-umela-sladidla-zlo-pro-tvoje-streva.json (9 citaci)
OK     kaloricky-deficit-kolik-jist.json (12 citaci)
OK     kaloricky-deficit.json (12 citaci)
OK     kardio-na-lacno-mytus.json (13 citaci)
OK     kardio-nici-svaly-mytus.json (16 citaci)
OK     kardio-spaluje-mene.json (9 citaci)
OK     kdy-ma-mozek-vrchol.json (8 citaci)
OK     kofein-a-jeho-bezpecna-konzumace.json (13 citaci)
OK     kofein-pred-treninkem.json (10 citaci)
OK     kolagen-na-slachy-a-klouby.json (13 citaci)
OK     kolagen-vs-bilkoviny.json (7 citaci)
OK     kolik-kavy-denne.json (16 citaci)
OK     kolik-kroku-denne-chuze-na-hubnuti.json (15 citaci)
OK     kolik-let-pridava-zdravy-zivot.json (14 citaci)
OK     kolik-si-vydela-trener-vyzivovy-poradce.json (10 citaci)
OK     kolik-spanku-delka-pravidelnost.json (16 citaci)
OK     kolik-vajec-denne-cholesterol-mytus.json (16 citaci)
OK     korelace-neni-kauzalita.json (9 citaci)
OK     kreatin-nejen-pro-svaly-ale-i-pro-mozek.json (15 citaci)
OK     kreatin-pro-zeny.json (15 citaci)
OK     kroky-vs-presnost-jidla.json (9 citaci)
OK     kvetnova-motivace.json (6 citaci)
OK     lide-nesnasi-odpovednost-a-vzdy-se-snazi-najit-obetniho-beranka.json (9 citaci)
OK     lokalni-hubnuti-cviky-na-bricho.json (14 citaci)
OK     makroziviny-a-hubnuti.json (8 citaci)
OK     malo-spanku-a-hubnuti.json (7 citaci)
OK     maslo-a-kardiovaskularni-onemocneni.json (13 citaci)
OK     melatonin-na-spanek.json (10 citaci)
OK     meli-byste-pocitat-objem-treninku-jako-sety-nebo-reps-oboje-dalsi-dil.json (7 citaci)
OK     menopauza-a-pribyvani-vahy.json (14 citaci)
OK     mleko-a-mlecne-mytus.json (11 citaci)
OK     musis-snidat-abys-zhubl-mytus.json (13 citaci)
OK     namitky-proti-kalorickemu-deficitu.json (6 citaci)
OK     nez-se-zacnes-bat-chemikalii-ujisti-se-ze-jsi-absolvoval-zakladni-kurz.json (12 citaci)

Souboru: 50, s chybou: 0, citaci overeno: 635
```

## Dávka 2: soubory

Každý soubor má pole `nejiste` (2 až 7 položek): co článek neříká, říká vágně nebo co se záměrně nepoužilo a proč.

| # | Soubor | FAQ | Opory | Slov v krátké odpovědi | Poznámka |
|---|---|---|---|---|---|
| 51 | `injekce-na-hubnuti-ozempic.json` | 5 | 25 | 50 | Zdravotní téma, všude zachovaný odkaz na lékaře. Přínosy pro srdce a údaje o kostech záměrně vynechané (vytržené by zněly jako doporučení léku). |
| 52 | `inzulinova-rezistence-prediabetes.json` | 5 | 21 | 50 | Rozpor v článku: prediabetes jde „u velké části lidí“ otočit, ale ve studii PREVIEW byl trvalý ústup „spíš vzácnost“. |
| 53 | `jak-rychle-zhubnout.json` | 5 | 19 | 55 | Velikost deficitu článek nevyčísluje. |
| 54 | `jak-zacit-hubnout.json` | 5 | 17 | 44 | Tempo 0,3–0,7 kg týdně je autorova zkušenost s klienty, bez zdroje. |
| 55 | `jak-zhubnout-bez-cviceni.json` | 5 | 19 | 51 | Čísla ze studie o NEAT nepoužitá, článek sám říká, že šlo o přejídání. |
| 56 | `jak-zhubnout-bricho.json` | 5 | 11 | 42 | Většina čísel v článku je bez zdroje. |
| 57 | `jak-zhubnout-po-50.json` | 5 | 17 | 49 | Chyba v článku: 75 kg × 1,6–2,2 g = 120–165 g, článek píše 120–140 g. |
| 58 | `jak-zhubnout-v-obliceji.json` | 5 | 14 | 37 | Míra jistoty zachovaná: studii o cvicích na tvář autor „nenašel“, nikde netvrdíme, že je vyvrácená. |
| 59 | `jak-ziskat-prvni-klienty-trener-vyzivovy-poradce.json` | 5 | 16 | 47 | Byznysový návod, závěrečná nabídka kitu vynechaná (reklama). |
| 60 | `je-citlivost-na-lepek-realna-nebo-jen-v-hlave.json` | 4 | 12 | 51 | Překlad příspěvku, studie není pojmenovaná. `titulek` obsahuje emoji, protože ho má i H1. |
| 61 | `je-cola-zero-horsi-nez-obycejna-cola.json` | 4 | 10 | 37 | Martinova tvrzení o inzulinu a trávení nejsou ve studiích, jen v `nejiste`. |
| 62 | `jeden-z-vas-mi-poslal-tohle-video-s-dotazem-zda-je-to-pravda-a-mozna-i.json` | 3 | 10 | 48 | Instagramový příspěvek o rýži z lednice, hodnoty GN v tabulce jsou přibližné a bez zdroje. |
| 63 | `jist-casteji-mytus.json` | 5 | 16 | 36 | Opatrná formulace u bílkovin („se zdá rozumné“) zachovaná. |
| 64 | `jist-po-seste-vecer-se-tloustne-mytus.json` | 4 | 11 | 44 | Výzkum časování jídla shrnutý jen obecně. Téma se kryje s `jist-vecer-tloustne`. |
| 65 | `jist-vecer-tloustne.json` | 4 | 14 | 31 | Studie s 82 ženami podaná i s podmínkou „v redukčním režimu“. |
| 66 | `jojo-efekt.json` | 5 | 16 | 47 | Vzorový soubor. Údaj o 700 kcal (Fothergill) nepoužitý, článek ho sám označuje za extrémní případ. |
| 67 | `jsou-umela-sladidla-zlo-pro-tvoje-streva.json` | 4 | 9 | 47 | Překlad příspěvku, obě studie bez autorů a PMID, sladidla nejmenovaná. |
| 68 | `kaloricky-deficit-kolik-jist.json` | 5 | 12 | 48 | Výhrada „studie na elitních sportovcích“ zachovaná. Mortonův strop bílkovin vynechaný, podle článku pro hubnutí přímo neplatí. |
| 69 | `kaloricky-deficit.json` | 4 | 12 | 33 | Krátký přehled bez studií. |
| 70 | `kardio-na-lacno-mytus.json` | 5 | 13 | 38 | Přímá srovnání nalačno vs. po jídle bez konkrétních studií. |
| 71 | `kardio-nici-svaly-mytus.json` | 5 | 16 | 42 | Shrnutí z praxe, „obrovský objem“ kardia článek neurčuje číslem. |
| 72 | `kardio-spaluje-mene.json` | 5 | 9 | 40 | Příklad 600/180 kcal podaný opatrně („často“, „třeba“). |
| 73 | `kdy-ma-mozek-vrchol.json` | 4 | 8 | 41 | Velmi krátký text (asi 140 slov), studie bez velikosti vzorku. |
| 74 | `kofein-a-jeho-bezpecna-konzumace.json` | 5 | 13 | 39 | Nejasná věta o „2 hodinách před intenzivním cvičením kvůli srdci“ záměrně vynechaná. Těhotenství s odkazem na lékaře. |
| 75 | `kofein-pred-treninkem.json` | 4 | 10 | 35 | Návod na dávkování je jen v obrázcích, v textu jen rozsah 3–6 mg/kg. |
| 76 | `kolagen-na-slachy-a-klouby.json` | 5 | 13 | 37 | Údaje bez citovaného zdroje (pokles syntézy 1–1,5 % ročně apod.) nepoužité. |
| 77 | `kolagen-vs-bilkoviny.json` | 5 | 7 | 39 | Výzva jít s bolavým kloubem na vyšetření zachovaná. |
| 78 | `kolik-kavy-denne.json` | 5 | 16 | 47 | Nejbohatší na data. Výsledek pro 5 šálků vynechaný (článek říká, že tam efekt prokázaný není). |
| 79 | `kolik-kroku-denne-chuze-na-hubnuti.json` | 5 | 15 | 51 | Údaj 7 000–8 000 kroků je v článku bez studie. |
| 80 | `kolik-let-pridava-zdravy-zivot.json` | 5 | 14 | 45 | Výhrady (pozorovací studie, modelové odhady) zachované. |
| 81 | `kolik-si-vydela-trener-vyzivovy-poradce.json` | 4 | 10 | 54 | Bez reálných dat o výdělcích, jen vzorec a modelový příklad 2 000 Kč za klienta. |
| 82 | `kolik-spanku-delka-pravidelnost.json` | 5 | 16 | 50 | Pásmo mezi 6 a 7 hodinami článek neřeší. |
| 83 | `kolik-vajec-denne-cholesterol-mytus.json` | 5 | 16 | 51 | Žádný horní počet vajec, lidé s diagnózou odkázaní na lékaře. |
| 84 | `korelace-neni-kauzalita.json` | 5 | 9 | 51 | Tvrzení „sladidla jsou podle WHO bezpečná“ nepoužité (chybí množství i zdroj). |
| 85 | `kreatin-nejen-pro-svaly-ale-i-pro-mozek.json` | 5 | 15 | 56 | Dva vnitřní rozpory v článku (vedlejší účinky, paměť u zdravých). Alzheimer vynechaný, u deprese odkaz na lékaře. |
| 86 | `kreatin-pro-zeny.json` | 5 | 15 | 46 | Bezpečnost jater a ledvin podaná i s podmínkou „studie u lidí 57–70 let“. |
| 87 | `kroky-vs-presnost-jidla.json` | 4 | 9 | 47 | Krátký post k infografice. |
| 88 | `kvetnova-motivace.json` | 3 | 6 | 53 | Motivační úvaha bez čísel, proto jen 3 FAQ. |
| 89 | `lide-nesnasi-odpovednost-a-vzdy-se-snazi-najit-obetniho-beranka.json` | 4 | 9 | 44 | Pravděpodobná chyba překladu ve směru náhrady olejů (viz níže), odpovědi směr neuvádějí. |
| 90 | `lokalni-hubnuti-cviky-na-bricho.json` | 4 | 14 | 45 | Studie popsané bez autorů a čísel, v odpovědích proto žádná čísla ze studií. |
| 91 | `makroziviny-a-hubnuti.json` | 4 | 8 | 38 | Chybí cíl bílkovin v g/kg i dávky ze studie Leidy. |
| 92 | `malo-spanku-a-hubnuti.json` | 4 | 7 | 46 | Stojí na jedné malé studii (10 lidí, 14 dní). |
| 93 | `maslo-a-kardiovaskularni-onemocneni.json` | 5 | 13 | 43 | Česká čísla z dovětku (40 % s vysokým LDL, 60 % nadváha) bez zdroje, nepoužitá. |
| 94 | `melatonin-na-spanek.json` | 5 | 10 | 41 | Odkaz na pediatra a varování před kombinací s léky zachované. V textu zůstal zástupný „[link]“ (viz níže). |
| 95 | `meli-byste-pocitat-objem-treninku-jako-sety-nebo-reps-oboje-dalsi-dil.json` | 4 | 7 | 36 | Model „plocha pod křivkou“ je autorův pohled, podaný jako „zhruba“. |
| 96 | `menopauza-a-pribyvani-vahy.json` | 5 | 14 | 43 | HRT nechaná výhradně na lékařce nebo gynekologovi, jak to dělá článek. |
| 97 | `mleko-a-mlecne-mytus.json` | 5 | 11 | 40 | Článek bez čísel a studií, odpovědi taky. |
| 98 | `musis-snidat-abys-zhubl-mytus.json` | 5 | 13 | 30 | Část opor z vlastní sekce „Časté otázky“ článku. |
| 99 | `namitky-proti-kalorickemu-deficitu.json` | 3 | 6 | 41 | Podrobně rozebírá jen dvě z pěti námitek, proto 3 FAQ. V textu zůstal zástupný „[link]“. |
| 100 | `nez-se-zacnes-bat-chemikalii-ujisti-se-ze-jsi-absolvoval-zakladni-kurz.json` | 4 | 12 | 38 | Čísla (10× u vody, 1000–10 000× u sladidel) jsou v článku bez zdroje. |

## Co stojí za opravu přímo v článcích (zjištěno při čtení, HTML se neměnilo)

1. **`lide-nesnasi-odpovednost-a-vzdy-se-snazi-najit-obetniho-beranka.html`:** věta „Když semenné oleje
   izokaloricky … nahradíš nasycenými tuky, vidíme neutrální nebo pozitivní účinky …“ má nejspíš obrácený směr
   (z kontextu i z věty hned za ní plyne náhrada nasycených tuků semennými oleji). Pravděpodobně chyba překladu.
2. **`jak-zhubnout-po-50.html`:** „Člověk s 75 kg se tak dostane na 120 až 140 g“, ale 1,6 až 2,2 g/kg dává
   při 75 kg 120 až 165 g.
3. **`melatonin-na-spanek.html` a `namitky-proti-kalorickemu-deficitu.html`:** v textu zůstal nevyplněný
   zástupný odkaz „na IG: [link]“.
4. **`kreatin-nejen-pro-svaly-ale-i-pro-mozek.html`:** dvě místa si odporují. U vedlejších účinků jeden zdroj
   uvádí relativní riziko 4,25, druhý žádný vyšší výskyt než u placeba. U paměti zdravých lidí starší přehled
   naznačuje zlepšení, novější souhrn efekt nevidí. Článek rozpor nevysvětluje.
5. **`inzulinova-rezistence-prediabetes.html`:** „u velké části lidí se to dá otočit zpět“ proti „trvalý
   ústup … spíš vzácnost“ (PREVIEW).
6. **`kofein-a-jeho-bezpecna-konzumace.html`:** rada nebrat dávku „méně než 2 hodiny před intenzivním cvičením
   kvůli srdci“ je bez zdroje a ve stejné větě se kofein před tréninkem doporučuje.
7. **`injekce-na-hubnuti-ozempic.html`:** u SURMOUNT-4 „nabral za rok 14 % váhy zpět“ není jasné, jestli jde
   o procenta původní váhy, nebo o procentní body (u STEP 1 článek procentní body výslovně píše).

## Co s tím dál (návrh, nic z toho se neudělalo)

- Data jsou připravená pro pozdější vložení do stránek (např. FAQPage JSON-LD nebo blok „Krátká odpověď“).
  14 článků z dávky už nějaký `FAQPage` má, ty by se měly sloučit, ne zdvojit.
- Před vložením je potřeba Martinova kontrola textů, jdou ven pod jeho jménem. Zdravotní články
  (`injekce-na-hubnuti-ozempic`, `inzulinova-rezistence-prediabetes`, `melatonin-na-spanek`,
  `menopauza-a-pribyvani-vahy`, `kreatin-nejen-pro-svaly-ale-i-pro-mozek`) projít přednostně.

## Seznam všech článků blogu (152, abecedně podle cesty)

`clanky/index.html` (výpis blogu) se nepočítá.

1. `clanky/alkohol-a-hubnuti.html`
2. `clanky/bcaa-aminokyseliny-mytus.html`
3. `clanky/bezlepkova-dieta-mytus.html`
4. `clanky/bilkoviny-a-ledviny-mytus.html`
5. `clanky/bilkoviny.html`
6. `clanky/bolave-svaly-doms-mytus.html`
7. `clanky/certifikace-trener-vyzivovy-poradce.html`
8. `clanky/cheat-day.html`
9. `clanky/cholesterol-co-snizuje-ldl.html`
10. `clanky/clean-eating-mytus.html`
11. `clanky/co-dela-stravu-zdravou.html`
12. `clanky/co-jist-pri-hubnuti.html`
13. `clanky/co-kdybych-musel-vybrat-jen-3-suplementy-ktere-se-opravdu-vyplati-vets.html`
14. `clanky/cukr-je-jed-mytus.html`
15. `clanky/cviceni-pro-mozek-po-sedesatce.html`
16. `clanky/detox-diety-a-caje-mytus.html`
17. `clanky/dna-testy-na-hubnuti.html`
18. `clanky/doporuceni-bisglycinatu-horciku-pro-vas-aktivni-zivotni-styl.html`
19. `clanky/e-book-nejcastejsi-dotazy-klientu-alkohol-hubnuti-a-spolecenske-udalos.html`
20. `clanky/e-book-nejcastejsi-dotazy-klientu-analogie-hubnuti-na-auto-nakup-v-obc.html`
21. `clanky/e-book-nejcastejsi-dotazy-klientu-chute-a-hlad.html`
22. `clanky/e-book-nejcastejsi-dotazy-klientu-co-je-vic-cviceni-nebo-strava.html`
23. `clanky/e-book-nejcastejsi-dotazy-klientu-ketogenni-dieta-a-sacharidy.html`
24. `clanky/e-book-nejcastejsi-dotazy-klientu-maso-versus-proteinovy-prasek.html`
25. `clanky/e-book-nejcastejsi-dotazy-klientu-nabirani-tuku-na-bunecne-urovni.html`
26. `clanky/e-book-nejcastejsi-dotazy-klientu-ovoce-vs-bebe-susenka-z-hlediska-cuk.html`
27. `clanky/e-book-nejcastejsi-dotazy-klientu-pohybove-aktivity.html`
28. `clanky/e-book-nejcastejsi-dotazy-klientu-prakticke-tipy-z-praxe.html`
29. `clanky/e-book-nejcastejsi-dotazy-klientu-pravo-volby.html`
30. `clanky/e-book-nejcastejsi-dotazy-klientu-proc-hubnu-v-ruznych-fazich-zivota-n.html`
31. `clanky/e-book-nejcastejsi-dotazy-klientu-proc-telesna-vaha-kolisa-i-kdyz-hubn.html`
32. `clanky/e-book-nejcastejsi-dotazy-klientu-proc-vice-kcal-nemusi-vzdy-znamenat.html`
33. `clanky/e-book-nejcastejsi-dotazy-klientu-spanek.html`
34. `clanky/e-book-nejcastejsi-dotazy-klientu-stres-sympatikus-a-parasympatikus.html`
35. `clanky/e-book-nejcastejsi-dotazy-klientu-studie-na-tema-diet-breaks-tedy-pauz.html`
36. `clanky/e-book-nejcastejsi-dotazy-klientu-suplementy-se-kterymi-se-muzete-setk.html`
37. `clanky/e-book-nejcastejsi-dotazy-klientu-telo-jako-stroj.html`
38. `clanky/e-book-nejcastejsi-dotazy-klientu-zanety-a-stravovani-studie.html`
39. `clanky/ektomorf-mezomorf-endomorf.html`
40. `clanky/elonga-hrv-veda-nebo-marketing.html`
41. `clanky/fat-burning-zona-mytus.html`
42. `clanky/flexibilni-stravovani.html`
43. `clanky/funguje-wobenzym.html`
44. `clanky/funkcni-trenink-vs-poctiva-sila-co-skutecne-funguje.html`
45. `clanky/glykemicky-index-mytus.html`
46. `clanky/hnedy-cukr-med-mytus.html`
47. `clanky/hubnuti-a-vek-mozku.html`
48. `clanky/hubnuti-a-zdravi-mozku.html`
49. `clanky/hubnuti-po-40.html`
50. `clanky/hydratace-deti-sport.html`
51. `clanky/injekce-na-hubnuti-ozempic.html` **(dávka 2)**
52. `clanky/inzulinova-rezistence-prediabetes.html` **(dávka 2)**
53. `clanky/jak-rychle-zhubnout.html` **(dávka 2)**
54. `clanky/jak-zacit-hubnout.html` **(dávka 2)**
55. `clanky/jak-zhubnout-bez-cviceni.html` **(dávka 2)**
56. `clanky/jak-zhubnout-bricho.html` **(dávka 2)**
57. `clanky/jak-zhubnout-po-50.html` **(dávka 2)**
58. `clanky/jak-zhubnout-v-obliceji.html` **(dávka 2)**
59. `clanky/jak-ziskat-prvni-klienty-trener-vyzivovy-poradce.html` **(dávka 2)**
60. `clanky/je-citlivost-na-lepek-realna-nebo-jen-v-hlave.html` **(dávka 2)**
61. `clanky/je-cola-zero-horsi-nez-obycejna-cola.html` **(dávka 2)**
62. `clanky/jeden-z-vas-mi-poslal-tohle-video-s-dotazem-zda-je-to-pravda-a-mozna-i.html` **(dávka 2)**
63. `clanky/jist-casteji-mytus.html` **(dávka 2)**
64. `clanky/jist-po-seste-vecer-se-tloustne-mytus.html` **(dávka 2)**
65. `clanky/jist-vecer-tloustne.html` **(dávka 2)**
66. `clanky/jojo-efekt.html` **(dávka 2)**
67. `clanky/jsou-umela-sladidla-zlo-pro-tvoje-streva.html` **(dávka 2)**
68. `clanky/kaloricky-deficit-kolik-jist.html` **(dávka 2)**
69. `clanky/kaloricky-deficit.html` **(dávka 2)**
70. `clanky/kardio-na-lacno-mytus.html` **(dávka 2)**
71. `clanky/kardio-nici-svaly-mytus.html` **(dávka 2)**
72. `clanky/kardio-spaluje-mene.html` **(dávka 2)**
73. `clanky/kdy-ma-mozek-vrchol.html` **(dávka 2)**
74. `clanky/kofein-a-jeho-bezpecna-konzumace.html` **(dávka 2)**
75. `clanky/kofein-pred-treninkem.html` **(dávka 2)**
76. `clanky/kolagen-na-slachy-a-klouby.html` **(dávka 2)**
77. `clanky/kolagen-vs-bilkoviny.html` **(dávka 2)**
78. `clanky/kolik-kavy-denne.html` **(dávka 2)**
79. `clanky/kolik-kroku-denne-chuze-na-hubnuti.html` **(dávka 2)**
80. `clanky/kolik-let-pridava-zdravy-zivot.html` **(dávka 2)**
81. `clanky/kolik-si-vydela-trener-vyzivovy-poradce.html` **(dávka 2)**
82. `clanky/kolik-spanku-delka-pravidelnost.html` **(dávka 2)**
83. `clanky/kolik-vajec-denne-cholesterol-mytus.html` **(dávka 2)**
84. `clanky/korelace-neni-kauzalita.html` **(dávka 2)**
85. `clanky/kreatin-nejen-pro-svaly-ale-i-pro-mozek.html` **(dávka 2)**
86. `clanky/kreatin-pro-zeny.html` **(dávka 2)**
87. `clanky/kroky-vs-presnost-jidla.html` **(dávka 2)**
88. `clanky/kvetnova-motivace.html` **(dávka 2)**
89. `clanky/lide-nesnasi-odpovednost-a-vzdy-se-snazi-najit-obetniho-beranka.html` **(dávka 2)**
90. `clanky/lokalni-hubnuti-cviky-na-bricho.html` **(dávka 2)**
91. `clanky/makroziviny-a-hubnuti.html` **(dávka 2)**
92. `clanky/malo-spanku-a-hubnuti.html` **(dávka 2)**
93. `clanky/maslo-a-kardiovaskularni-onemocneni.html` **(dávka 2)**
94. `clanky/melatonin-na-spanek.html` **(dávka 2)**
95. `clanky/meli-byste-pocitat-objem-treninku-jako-sety-nebo-reps-oboje-dalsi-dil.html` **(dávka 2)**
96. `clanky/menopauza-a-pribyvani-vahy.html` **(dávka 2)**
97. `clanky/mleko-a-mlecne-mytus.html` **(dávka 2)**
98. `clanky/musis-snidat-abys-zhubl-mytus.html` **(dávka 2)**
99. `clanky/namitky-proti-kalorickemu-deficitu.html` **(dávka 2)**
100. `clanky/nez-se-zacnes-bat-chemikalii-ujisti-se-ze-jsi-absolvoval-zakladni-kurz.html` **(dávka 2)**
101. `clanky/nocni-smeny-a-hubnuti.html`
102. `clanky/objem-treninku-v-diete.html`
103. `clanky/omega-3-oxidace.html`
104. `clanky/omlazeni-hubnutim.html`
105. `clanky/ovoce-a-cukr-mytus.html`
106. `clanky/pitny-rezim.html`
107. `clanky/planovani-jidel-pro-vytvoreni-kalorickeho-deficitu-klic-k-uspesnemu-hu.html`
108. `clanky/poceni-a-spalovani-tuku-mytus.html`
109. `clanky/pohyb-a-nalada.html`
110. `clanky/pomaly-metabolismus-mytus.html`
111. `clanky/posilovani-je-dobre-pro-vase-svaly-i-mozek.html`
112. `clanky/precetl-jsem-vsechny-studie-o-elektrolytech-prumysl-lze.html`
113. `clanky/prerusovany-pust-co-rikaji-studie.html`
114. `clanky/probiotika-co-funguje.html`
115. `clanky/protahovani-pred-treninkem-mytus.html`
116. `clanky/protein-a-mortalita-mytus-vyvracen-dalsi-dil-serie-veda-vs-myty-ve-vyz.html`
117. `clanky/protein-po-treninku.html`
118. `clanky/rostlinne-vs-zivocisne-bilkoviny-svaly.html`
119. `clanky/rostliny-jsou-plne-jedu.html`
120. `clanky/sacharidy-pred-treninkem.html`
121. `clanky/sarkopenie-svaly-po-50.html`
122. `clanky/silovy-trenink-dlouhovekost.html`
123. `clanky/silovy-trenink-pro-zeny.html`
124. `clanky/silovy-trenink-zlepsuje-mobilitu.html`
125. `clanky/silovy-trenink-zlepsuje-mozkove-funkce-studie.html`
126. `clanky/sladidla-a-mikrobiom.html`
127. `clanky/soja-a-hormony-mytus.html`
128. `clanky/spalovace-tuku-co-funguje-a-co-je-mytus.html`
129. `clanky/spanek-a-hubnuti.html`
130. `clanky/spanek-vyziva-a-fitness-u-populace-40.html`
131. `clanky/spankova-apnoe-a-hubnuti.html`
132. `clanky/stale-si-myslim-ze-kolagen-je-podvod.html`
133. `clanky/superpotraviny-mytus.html`
134. `clanky/svaly-v-kalorickem-deficitu.html`
135. `clanky/tehotne-zeny-netrapte-se-strachem-z-tezkych-cviku-dalsi-dil-serie-veda.html`
136. `clanky/testosteron-4-paky.html`
137. `clanky/toxiny-v-jidle-strach-versus-realita-aneb-8-nejcastejsich-toxinovych-o.html`
138. `clanky/trenujes-tak-tvrde.html`
139. `clanky/tuk-a-sval-premena-mytus.html`
140. `clanky/tuky-a-light-potraviny-mytus.html`
141. `clanky/ultra-zpracovana-jidla.html`
142. `clanky/umela-sladidla-mytus.html`
143. `clanky/vetsina-lidi-ma-za-to-ze-po-30-letech-jde-mozek-z-kopce-realita-je-jin.html`
144. `clanky/vikendove-prejidani.html`
145. `clanky/vitamin-d-na-co-ma-smysl.html`
146. `clanky/vlaknina.html`
147. `clanky/vo2max-a-delsi-zivot.html`
148. `clanky/vyhrez-plotenky.html`
149. `clanky/vyziva-deti.html`
150. `clanky/vyziva-sportujiciho-ditete.html`
151. `clanky/vzorovy-jidelnicek-na-hubnuti.html`
152. `clanky/zeny-a-posilovani-zmohutni.html`
