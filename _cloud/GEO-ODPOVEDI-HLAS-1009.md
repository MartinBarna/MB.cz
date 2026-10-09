# GEO odpovědi: kolo hlasu (10. 10. 2026)

Větev `cloud/geo-odpovedi-hlas-1009` = `cloud/geo-odpovedi-1009` + tohle kolo. **Nic není v `main` a nic není nasazené.**
Fakta se neměnila: čísla, jednotky, podmínky, pro koho to platí, míra jistoty, varování (lékař, těhotenství, léky,
Linka 116 123) a odkazy zůstaly. Pole `opory` a `kontrola` jsou beze změny ve všech 154 JSON.
Změnil se jen hlas: `kratka_odpoved`, `hlavni_otazka` a otázky/odpovědi ve `faq`, podle `HLAS-MARTINA.md`.

## Počty

| | |
|---|---|
| JSON celkem | **154** |
| `hlas: upraveno: …` | **137** |
| `hlas: beze změny` | **17** |
| Změněných polí (z 1 632 textových polí: 154 otázek, 154 krátkých odpovědí, 662 FAQ otázek a 662 odpovědí) | **310** |
| Pilotní články přegenerované z nového JSON | **4** (`bilkoviny`, `kardio-nici-svaly-mytus`, `kreatin-pro-zeny`, `cheat-day`; `spanek-a-hubnuti` zněl dobře, beze změny) |

Beze změny zůstaly: `bolave-svaly-doms-mytus`, `e-book-…-analogie-hubnuti-na-auto`, `e-book-…-co-je-vic-cviceni-nebo-strava`,
`e-book-…-maso-versus-proteinovy-prasek`, `e-book-…-spanek`, `e-book-…-stres-sympatikus-a-parasympatikus`,
`inzulinova-rezistence-prediabetes`, `lokalni-hubnuti-cviky-na-bricho`, `omlazeni-hubnutim`, `pitny-rezim`,
`pohyb-a-nalada`, `prerusovany-pust-co-rikaji-studie`, `spanek-a-hubnuti`, `svaly-v-kalorickem-deficitu`,
`vlaknina`, `vyziva-deti`, `vyziva-sportujiciho-ditete`.

## Vzorce, které se opakovaly napříč sérií, a jak jsem je rozbil

Čteno jako celek (pravidlo 6b), ne po článcích. Čísla jsou počty textových polí, ve kterých se vzorec vyskytl.

| Vzorec | Před | Po | Co jsem s tím udělal |
|---|---|---|---|
| **„X, ne Y“** na konci věty („Rozhoduje deficit, ne nálepka.“, „kardio je doplněk, ne motor“, „ukazuje souvislost, ne příčinu“) | **109** | **3** | Nejčastější AI rytmus celé série. Přepsáno na jednu oznamovací větu („Je to obyčejný deficit.“, „Kardio je jen doplněk.“), nebo tam, kde je kontrast obsahem, na samostatnou větu („Tuk zůstal, kde byl.“). Zbylé 3 jsou věcné výčty nebo doslovné varování z článku („vždy s lékařem, ne od oka“). |
| **„Není X, ale Y“ / „Ne proto, že X, ale Y“** | 12 | 1 | Přepsáno na pozitivní větu: „Jojo efekt dělá špatně nastavený proces: … Slabá vůle za to většinou nemůže.“ (empatická negace samostatně, až po věcné odpovědi). Zbylá 1 je věcné srovnání (kolagen vs. cukr ve studii). |
| **„Podle …“ jako první slovo odpovědi** („Podle meta-analýzy…“, „Podle Layne Nortona…“, „Podle článku…“) | 57 | 17 | Studie je podmět věty („Meta-analýza z roku 2025: …“, „V metaanalýze Yin 2017 přidávala…“). U překladů Nortona a Henselmanse přisouzení zůstává (je to fakt o autorství), ale ne jako čtyři „Podle Layna Nortona“ za sebou: střídám „Norton to počítá tak, že…“, „píše Norton“, „říká Henselmans“. Zbylých 17 je rozprostřených po různých článcích. |
| **„podle článku“, „článek uvádí / radí / doporučuje“, „jehož příspěvek článek překládá“** | 33 | 1 | Text stojí na stránce toho článku a jde pod Martinovým jménem, takže autor je „já“: „Omez příjem na 200 mg denně“, „Vysvětlení jsou tři.“, „jehož příspěvek tady překládám“. Zbylá 1 je „podle článku na internetu“ ve varování u statinů (jiný význam, zůstává). |
| **„Martin“ ve 3. osobě** („Martin doporučuje“, „Kdyby měl Martin vybrat“, „podle Martina“) | 19 | 0 | První osoba: „Doporučuju“, „Kdybych měl vybrat jen tři, sáhnu po…“, „U klientů po čtyřicítce nastavuju…“, „Koučoval jsem ženu s váhou 52 kg“. |
| **„opravdu / skutečně / skutečný“ jako důraz** (hlavně v otázkách: „Co svaly opravdu ujídá?“, „Co na tuk opravdu funguje?“) | 42 | 1 | Vypuštěno. Zbylé 1 je „skutečný příjem“ ve významu „reálně snědené“, ne důraz. |
| **absolutna „vždy / vždycky / nikdy / pokaždé“** | 25 | 14 | Změkčeno, kde to byl jen důraz („vždycky porazí“ → „porazí“, „Výsledek bývá pokaždé stejný“ → „bývá stejný“). Zbylých 14 jsou varování („vždy řeš s lékařem“, „nikdy z internetu“), tvrzení článku s touto mírou jistoty („CRP vždy klesá“, „skoro vždy“) nebo popis („Kdo nikdy necvičil“). Ty se podle zadání nemění. |
| **vata** („Pointa je…“, „Tady je jedna nuance.“) | 3 | 0 | Škrtnuto, odpověď začíná pointou. |
| **anglicismy** (tracking, binge cyklus, reset, benefity, marginální, konzistentní, kompozit, evidence-based, peer-reviewed, versus, low-carb, workout hřiště) | 14 | 0 | Česky: zápis jídla, koloběh, návrat k normálu, výhody rozepsané slovesy, malý, výsledky se rozcházejí / spolehlivě, součet, fitness postavené na důkazech, recenzované, proti, nízkosacharidová, workoutové hřiště. |
| **obecná čeština** | 1 | 0 | „o pár týdnů dýl“ → „déle“ (`kreatin-pro-zeny`, pilotní článek). |
| **„Ano.“ / „Ne.“ jako první slovo** | 98 | 94 | Nechávám: přímá odpověď je Martinův styl („Hodně.“, „Nemusíš.“, „Cheat meal.“). Rozbil jsem jen místa, kde v jednom článku stály tři a víc stejných startů za sebou (`bezlepkova`, `clean-eating`, `dna-testy`, `jist-casteji`, `e-book-keto`, `co-jist-pri-hubnuti`, `zeny-a-posilovani`). |
| **„Většina lidí…“** | 25 | 23 | Skoro všude je u toho číslo z článku („pro většinu lidí 0,3 až 0,7 kg týdně“), to není líné zobecnění. Změněno jen „než si většina lidí myslí“ → „než si myslíš“ a „Většina lidí tak řeší…“ → „Problém Čechů je…“ (u dat SZÚ). |
| **cizí zkratky bez vysvětlení** | | | Doplněno u NEAT („pohyb mimo trénink“), CICO („kalorie dovnitř, kalorie ven“), RIR („opakování v rezervě“), PUFA („vícenenasycené“), „aterogennější“ („horší pro cévy“). TDEE, EPOC, DOMS, HRV, GI, GL už vysvětlené byly. |
| **skloňování** | 9 | 0 | „Podle Layne Nortona“ a „Dr. Laynea Nortona“ sjednoceno na „Layna Nortona“ (jen v našem textu, citace v `opory` beze změny). |

Otázky ve FAQ: 20 otázek přepsáno tak, jak je člověk napíše do ChatGPT. Místo „Co ukázala studie z roku 2025 o citlivosti na lepek?“
je „Existuje citlivost na lepek i bez celiakie?“, místo „Proč článek mluví o placebu?“ je „Jak se pozná, že jde o placebo?“,
místo „Co klouby opravdu drží?“ je „Co kloubům pomáhá víc než kolagen?“. Odpovědi na ně zůstaly, otázka se jen ptá na totéž lidsky.

## 15 příkladů před / po

1. `alkohol-a-hubnuti`, krátká odpověď
   - **Před:** Ano, na hubnutí rozhoduje kalorický deficit, ne pivo samo o sobě, a lehká až střední konzumace…
   - **Po:** Ano. O hubnutí rozhoduje kalorický deficit a lehká až střední konzumace…
2. `bilkoviny` (pilot), FAQ 1
   - **Před:** V deficitu chrání svalovou hmotu, takže hubneš tuk, ne sval.
   - **Po:** V deficitu chrání svalovou hmotu, takže jde dolů tuk a sval zůstává.
3. `bilkoviny-a-ledviny-mytus`, FAQ 2
   - **Před:** Krátkodobé zvýšení výkonu ledvin po proteinu. Je to normální adaptace, ne poškození, stejně jako když ti při běhu zrychlí srdce.
   - **Po:** Krátkodobé zvýšení výkonu ledvin po proteinu. Ledviny prostě zaberou, stejně jako ti při běhu zrychlí srdce. Normální adaptace, žádné poškození.
4. `co-kdybych-musel-vybrat-jen-3-suplementy…`, krátká odpověď
   - **Před:** Kdyby měl Martin vybrat jen tři, sáhl by po kreatin monohydrátu, vitaminu D a omega-3 (EPA + DHA). U nich podle něj nejlépe sedí poměr cena a účinek pro běžného člověka.
   - **Po:** Kdybych měl vybrat jen tři, sáhnu po kreatin monohydrátu, vitaminu D a omega-3 (EPA + DHA). U nich mi pro běžného člověka nejlíp sedí poměr ceny a účinku.
5. `cukr-je-jed-mytus`, FAQ 5
   - **Před:** Nejsilnější páky nejsou zákaz cukru, ale udržení rozumné hmotnosti, pravidelný pohyb, silový trénink a víc svalů.
   - **Po:** Nejsilnější páky jsou rozumná hmotnost, pravidelný pohyb, silový trénink a víc svalů. Zákaz cukru mezi nimi není.
6. `detox-diety-a-caje-mytus`, krátká odpověď
   - **Před:** Kila shozená na šťávové očistě jsou hlavně voda a zásobní cukr (glykogen), ne tuk, a po návratu k normálnímu jídlu se během pár dní vrátí.
   - **Po:** Kila shozená na šťávové očistě jsou hlavně voda a zásobní cukr (glykogen) a po návratu k normálnímu jídlu se během pár dní vrátí. Tuk zůstal, kde byl.
7. `dna-testy-na-hubnuti`, FAQ 3
   - **Před:** Štítná žláza, vitamin D nebo krevní obraz. Ty ale řeší zdraví, ne hubnutí, a patří k lékaři, ne do laboratoře z reklamy.
   - **Po:** Štítná žláza, vitamin D nebo krevní obraz. Ty ale řeší zdraví a patří k lékaři, laboratoř z reklamy přeskoč.
8. `jak-rychle-zhubnout`, FAQ 5 (empatická negace jako samostatná věta, povolená výjimka)
   - **Před:** Vrátila se voda a glykogen a často i chuť dohnat týdny hladu. Je to důsledek příliš tvrdého režimu, ne slabé vůle.
   - **Po:** Vrátila se voda a glykogen a často i chuť dohnat týdny hladu. Je to důsledek příliš tvrdého režimu. Se slabou vůlí to nesouvisí.
9. `je-cola-zero-horsi-nez-obycejna-cola`, krátká odpověď a FAQ 4
   - **Před:** Podle Layne Nortona, jehož příspěvek článek překládá, Cola Zero horší není… / Martin dodává, že dietní varianta nasazená s hlavou… Žádné riziko v tom podle něj není…
   - **Po:** Layne Norton, jehož příspěvek tady překládám, říká, že Cola Zero horší není… / Já k tomu dodám: dietní varianta nasazená s hlavou… Žádné riziko v tom nevidím…
10. `jist-casteji-mytus`, FAQ 4
    - **Před:** Tady je jedna nuance. Pro budování a udržení svalů se zdá rozumné rozložit bílkoviny do tří až čtyř dávek přes den… Je to věc bílkovin, ne počtu jídel obecně a ne „nakopnutí metabolismu“.
    - **Po:** Trochu ano. Pro budování a udržení svalů se zdá rozumné rozložit bílkoviny do tří až čtyř dávek přes den… S „nakopnutím metabolismu“ to ale nesouvisí.
11. `jojo-efekt`, krátká odpověď
    - **Před:** Jojo efekt většinou nezpůsobuje slabá vůle, ale špatně nastavený proces: příliš velký deficit, ztráta svalů a dieta s jasným koncem.
    - **Po:** Jojo efekt dělá špatně nastavený proces: příliš velký deficit, ztráta svalů a dieta s jasným koncem. Slabá vůle za to většinou nemůže.
12. `kolik-si-vydela-trener-vyzivovy-poradce`, FAQ 2
    - **Před:** Cenu ti nikdo nezaplatí za certifikát, ale za výsledky, které umíš doložit, a za servis jako plán na míru, týdenní check-iny a úpravy podle dat.
    - **Po:** Lidi ti zaplatí za doložené výsledky a za servis: plán na míru, týdenní check-iny a úpravy podle dat.
13. `menopauza-a-pribyvani-vahy`, krátká odpověď
    - **Před:** …takže stejné jídlo najednou přebývá. Není to o vůli, ale o fyziologii.
    - **Po:** …takže stejné jídlo najednou přebývá. Je to fyziologie, se slabou vůlí to nesouvisí.
14. `tuky-a-light-potraviny-mytus`, krátká odpověď
    - **Před:** Netloustneš z toho, že na talíři byl tuk, ale z toho, že přijmeš víc kalorií, než spálíš.
    - **Po:** Tloustneš z kalorií navíc, ať přijdou odkudkoli.
15. `kreatin-pro-zeny` (pilot), FAQ 3 a `sacharidy-pred-treninkem`, otázky
    - **Před:** jen to trvá o pár týdnů dýl, než se zásoby naplní. / Co ukázala studie se sladkým nápojem? / Proč článek mluví o placebu?
    - **Po:** jen to trvá o pár týdnů déle, než se zásoby naplní. / Je efekt banánu před tréninkem jen v hlavě? / Jak se pozná, že jde o placebo?
16. `kvetnova-motivace`, FAQ 2
    - **Před:** Martin začal v devatenácti kvůli egu a touze vypadat dobře, ale zůstal kvůli hlavě. Kamarádi, co toho nechali, podle něj stárli rychleji…
    - **Po:** Začal jsem v devatenácti kvůli egu a touze vypadat dobře, ale zůstal jsem kvůli hlavě. Kamarádi, co toho nechali, stárli rychleji…
17. `testosteron-4-paky`, krátká odpověď a FAQ 2
    - **Před:** Podle článku ne jako první krok: … / Článek proti TRT není, ale je to rozhodnutí, které patří doktorovi po vyšetření, ne na první místo.
    - **Po:** Ne jako první krok: … / Proti TRT nic nemám, je to ale rozhodnutí, které patří doktorovi po vyšetření, a na první místo nepatří.

Úplný seznam všech 310 změn vznikne příkazem `git diff cloud/geo-odpovedi-1009..cloud/geo-odpovedi-hlas-1009 -- _cloud/geo-odpovedi/`;
u každého JSON je v poli `hlas` shrnutí, co a proč.

## Co jsem schválně nechal

- **Varování a míru jistoty** beze změny, i kde je absolutno: „vždy řeš s lékařem“, „nikdy z internetu“, „CRP vždy klesá“, „skoro vždy se vrací kila“.
- **Přisouzení překladů** (Norton, Henselmans, Phillips) zůstává u každého tvrzení, které revize fakt přisoudila jim. Změnila se jen konstrukce věty.
- **„Většina lidí“ u čísel** z článků (tempo hubnutí, g/kg bílkovin) zůstává, je to tvrzení článku s daty.
- **Přímé „Ano.“ / „Ne.“** na začátku odpovědi zůstává, viz výš.
- **Rozpory mezi články** z `GEO-ODPOVEDI-REVIZE-1009.md` (bílkoviny g/kg, tempo hubnutí, vitamin D…) jsem neřešil, to je rozhodnutí o faktech, ne o hlasu.

## Výsledky kontrol

```
python3 -I _cloud/geo-odpovedi-revize.py
Clanku: 154 | citaci overeno: 2125 | kontrola: {'ok': 71, 'opraveno': 82, 'smazano': 5} | chyb: 0
```
- Skript hlídá přesné pořadí klíčů, proto jsem do něj přidal nový klíč **`hlas`** (jako poslední, tvar „beze změny“ nebo „upraveno: …“)
  a jeho text zařadil mezi autorský text, ve kterém se hledají AI fráze. Doslovnost citací hlídá jen v `opory`, ty se neměnily,
  takže nic nebylo potřeba vracet. Kontrola čísel (každé číslo v otázce nebo odpovědi musí být v článku) prošla, žádné nové číslo jsem nepřidal.

```
python3 -I _cloud/geo-pilot.py over bilkoviny kardio-nici-svaly-mytus kreatin-pro-zeny spanek-a-hubnuti cheat-day
OK  bilkoviny  FAQ 3 | OK  kardio-nici-svaly-mytus  FAQ 5 | OK  kreatin-pro-zeny  FAQ 5 | OK  spanek-a-hubnuti  FAQ 3 | OK  cheat-day  FAQ 3
```
- Pilotní články jsem přegeneroval z nového JSON stejným skriptem jako pilot (článek vrácen na stav před pilotem, pak `geo-pilot.py vloz`),
  takže rámeček „Krátká odpověď“, viditelné FAQ i FAQPage JSON-LD jsou slovo od slova z JSON. V HTML se změnily jen textové řádky
  (`git diff`: 4 soubory, 14 řádků). U+2014: 0 v JSON, v článcích i v tomto reportu.
- **`node scripts/geo-kontrola.mjs`** na této větvi spustit nejde, skript existuje až v novějším `main` (větev `cloud/geo-odpovedi-1009`
  je za `main`, stejně jako byla při pilotu). Ověřil jsem to jinak: v dočasném pracovním stromě `origin/main` jsem vložil pilot
  stejným skriptem do **verzí článků z `main`** a kontrola hlásí **0 chyb**. Verze pilotních článků z této větve by na `main`
  hlásily 35 chyb, ale všechny jsou z GEO sjednocení, které `main` udělal po odbočení větve (`author`/`publisher` bez `@id`,
  `inLanguage: cs-CZ`, chybí viditelný odkaz na `/#omne` a `<time>`), ne z pilotu ani z hlasu. ⚠️ **Před merge do `main` je potřeba
  větev na `main` rebasovat nebo merge vyřešit tak, aby u těch 5 článků zůstala verze z `main` a pilot se do ní vložil znovu**
  (`python3 -I _cloud/geo-pilot.py vloz <slug> "<h2>Mohlo by tě zajímat</h2>"`), a pak `node scripts/geo-kontrola.mjs` musí hlásit 0 chyb.
- Platí dál body „Před merge“ z `GEO-ODPOVEDI-REVIZE-1009.md`: `_cloud/**` do `exclude:` v deploy workflow a do `EXCL` ve `verify-deploy.js`,
  jinak se JSON a skripty nahrají na web. Při nasazení pilotu navíc zvednout `dateModified` a pustit `generuj-llms-full.mjs`, jak chce CLAUDE.md.

## Soubory

- `_cloud/geo-odpovedi/*.json`: 154 podkladů, nové pole `hlas` ve všech, text změněn ve 137
- `_cloud/geo-odpovedi-revize.py`: zná klíč `hlas`
- `clanky/{bilkoviny,kardio-nici-svaly-mytus,kreatin-pro-zeny,cheat-day}.html`: pilot přegenerovaný z nového JSON
- `_cloud/GEO-ODPOVEDI-HLAS-1009.md`: tento report
