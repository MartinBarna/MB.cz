# GEO martinbarna.cz: technika pro AI vyhledávání, 9. 10. 2026

Větev `cloud/geo-technika-1009` nad `origin/main` (`3f1a5a99a`). **Nic není nasazené ani slité do `main`**,
workflow deploy jsem nespouštěl, Supabase ani maily jsem neotevřel.

Cíl: aby ChatGPT, Perplexity, Claude, Gemini a Google AI Overviews o Martinovi, appce Tvůj Coach,
videokurzu, Barna Academy, koučinku a konzultacích odpovídaly podle webu a citovaly martinbarna.cz.

## Výsledek v číslech

| | Před | Po |
|---|---|---|
| Chyby podle `scripts/geo-kontrola.mjs` | 1 144 | **0** |
| Indexované stránky bez JSON-LD | 11 | 3 (právní stránky, zákaz úprav) |
| Martin v JSON-LD jako kopie bez `@id` | 318 míst | 0 (jedna definice na homepage, jinde odkaz) |
| Odpovědi FAQPage, které na stránce doslova nestály | 37 (11 stránek) | 0 |
| Hodnocení v JSON-LD, které na stránce nestojí | 2 (66 a 114 recenzí) | 0 |
| Ceny v JSON-LD mimo viditelný text | 2 | 0 |
| Články s viditelným autorem s odkazem a přesným datem | 0 ze 152 | 152 ze 152 (+ 2 průvodci) |
| `llms-full.txt` | neexistoval | 177 stránek, z toho 152 článků, 978 kB |

## 1. Strukturovaná data (JSON-LD)

### Kanonické entity (jen v `index.html`)
Jeden blok `@graph` na homepage definuje:
- `WebSite` `https://martinbarna.cz/#website` (publisher `#org`, about `#martin`, `inLanguage: cs`)
- `Person` `https://martinbarna.cz/#martin`: jméno, portrét (`assets/foto/martin/portret.webp`),
  `jobTitle` a popis z viditelného textu, `knowsAbout`, `worksFor` → `#org`, `sameAs`
- `Organization` `https://martinbarna.cz/#org`: název, logo, e-mail, telefon, `founder` → `#martin`,
  IČO a adresa (obojí stojí v patičce), `areaServed`, `sameAs`

Nahradilo to dvě kopie (`ProfessionalService` a `Person`) s rozdílnými údaji. Na všech ostatních
stránkách jsou Martin a značka jen `{"@id": ...}`.

`sameAs` obsahuje **jen profily, na které web sám odkazuje**: Instagram, TikTok, YouTube
(`youtube.com/MartinBarna`), Facebook (`facebook.com/martinbarnaonlinevyzivaafitness`), u Martina
navíc HeroHero, u značky odkaz na hodnocení na Googlu. LinkedIn web nikde neodkazuje, proto chybí.

### Inventura podle šablon (typy na nejvyšší úrovni)

| Šablona | Před | Po |
|---|---|---|
| homepage | ProfessionalService, Person, FAQPage, Service | **@graph: WebSite, Person, Organization**, FAQPage, Service |
| článek blogu (152) | BlogPosting, BreadcrumbList (+ FAQPage u 25) | totéž, ale author `#martin`, publisher `#org`, `inLanguage: cs` |
| výpis blogu | Blog, BreadcrumbList | Blog `#blog` (author, publisher jako odkazy), BreadcrumbList |
| videokurz | FAQPage, Course, BreadcrumbList | Course `#course` (provider `#org`, creator a instructor `#martin`, obrázek) |
| Academy | FAQPage, Course | Course `#course` (totéž; vyhozen `courseWorkload: PT40H`, viz rozpory) |
| koučink | Service, BreadcrumbList, FAQPage | Service `#service`, provider `#org`, **+ ceny 3 a 6 měsíců** (stojí na stránce) |
| konzultace | Service, BreadcrumbList, FAQPage | Service `#service`, provider `#org` |
| Tvůj Coach | SoftwareApplication, BreadcrumbList | SoftwareApplication `#app`, author `#martin`, publisher `#org`, bez 2 skrytých tarifů |
| 40 receptů a 48 odpovědí | Product | Product `#product`, brand a seller `#org`, obrázek |
| reference | ProfessionalService (114 recenzí) | odkaz na `#org` + 70 recenzí (všechny doslova na stránce) |
| volné lekce Academy (6) | nic | **Article + LearningResource** (author, publisher, `isPartOf` → Academy) + BreadcrumbList |
| `/pro-trenery/`, `/pro-vas/` | nic | WebPage + BreadcrumbList |
| průvodci jak zhubnout / nabrat svaly | Article, BreadcrumbList, FAQPage | Article, BreadcrumbList (FAQPage pryč, viz níže) |
| kvíz | Quiz, FAQPage | Quiz (FAQPage pryč) |
| kalkulačka, nástroje, přednášky, tréninky, mýty | různé | autor/poskytovatel jako odkaz, `inLanguage: cs` |
| právní stránky (3) | nic | nic: zadání zakazuje na ně sahat |

### Co se změnilo kvůli pravdivosti
- **FAQPage slovo od slova.** U 21 odpovědí na 8 stránkách se viditelný text někdy dřív přepsal
  (hlavně pomlčky na tečky), JSON-LD ne. Opravil jsem JSON-LD podle stránky, stránku ne:
  `akademie/`, `koucing/`, `videokurz.html`, `clanky/co-jist-pri-hubnuti.html`,
  `jak-rychle-zhubnout.html`, `jak-zhubnout-bez-cviceni.html`, `jak-zhubnout-bricho.html`,
  `silovy-trenink-pro-zeny.html`.
- **FAQPage odstraněno** tam, kde otázky na stránce vůbec nejsou: `jak-zhubnout/` (5 otázek),
  `jak-nabrat-svaly/` (5 otázek) a `kviz/` (otázka byl nadpis kvízu, odpověď úvodní odstavec).
- **Hodnocení:** z homepage pryč `aggregateRating` s 66 recenzemi (na stránce stojí „100+").
  Na `/reference/` změněno ze 114 (součet 47 Google + 67 Facebook doporučení, takové číslo
  na stránce není) na 70 = „všech 70 recenzí v textu", hodnota 5 = „všechny 5★". Všech 70 textů
  recenzí jsem ověřil, že na stránce stojí doslova i se jménem.
- **Tvůj Coach:** z JSON-LD pryč tarif „VIP + Kontrola od Martina" (1 990 a 5 490 Kč). Blok je
  v HTML skrytý (`display:none`) a zobrazí se, jen když je tarif v ceníku aktivní; cena se
  dotahuje z DB. Ve statickém textu tedy není a mohl by neplatit.
- **Academy:** pryč `courseWorkload: PT40H`. Číslo 40 hodin na stránce nikde není.

### Soubory
- `index.html`: nový `@graph`; Service a FAQ zůstaly.
- `reference/index.html`, `tvuj-coach/index.html`, `videokurz.html`, `akademie/index.html`,
  `koucing/index.html`, `konzultace/index.html`, `recepty-a-odpovedi/index.html`,
  `clanky/index.html`, `kalkulacka-kalorii-a-makrozivin/index.html`, `nastroje-zdarma/index.html`:
  ručně, viz tabulka.
- `akademie/studium/m1-l1, m1-l2, m1-l3, m2-l1, m3-l1, m6-l1`, `pro-trenery/`, `pro-vas/`: nové bloky.
- 152 článků + `jak-zhubnout/`, `jak-nabrat-svaly/`, `prednasky/`, `treninky.html`, `myty/`:
  skriptem `scripts/geo-sjednot.mjs` (autor/vydavatel/poskytovatel na odkaz, `cs-CZ` → `cs`).
  Bloky se přeformátovaly (`JSON.stringify` s odsazením 2), obsah kromě těch polí je stejný.

## 2. llms.txt a llms-full.txt

- **`llms-full.txt` (nový, nasadí se jako statický soubor):** generuje ho
  `node scripts/generuj-llms-full.mjs`. Hlavní stránky (homepage, Tvůj Coach, videokurz, Academy,
  koučink, konzultace, 40 receptů, `/pro-vas/`, tréninky, přednášky, poukaz, lead magnety,
  nástroje, kalkulačka, průvodci, mýty, 6 volných lekcí) a pak **všech 152 článků** od nejnovějšího.
  U každé sekce nadpis, URL, u článků autor a data, pak čistý text s nadpisy a odrážkami.
  Bez menu, patičky, formulářů, tlačítek, skrytých prvků a prodejních CTA boxů v článcích.
  Záměrně bez `/reference/` (70 recenzí se jmény klientů, AI stačí shrnutí v `llms.txt`)
  a bez interaktivních nástrojů a kvízu (bez JS v nich není text).
- **`llms.txt`** zůstal krátkým rozcestníkem, odkazuje na `llms-full.txt`. Každé tvrzení jsem
  dohledal ve viditelném textu stránky, na kterou odkazuje. Co tam nestálo, je pryč nebo
  přeformulované (seznam v části Rozpory). Nově jsou v něm ceny koučinku na 3 a 6 měsíců,
  videokurz zdarma k první platbě VIP, odkazy na 6 volných lekcí, tréninky, přednášky, poukaz,
  kvíz a kit pro trenéry.
- ⚠️ Věty „Databáze přes 50 000 potravin" a „Knihovna přes 410 fit receptů" jsem nechal přesně
  takhle: jsou to kotvy, podle kterých `sync-cisla-web.mjs` při deployi přepisuje čísla. Ověřeno
  nasucho se smyšlenými hodnotami (60 000 a 428): obě kotvy se našly a přepsaly.

## 3. Citovatelnost článků

Do hero každého článku (a obou průvodců) přibyl pod řádek s měsícem jeden řádek, nic jiného
se na stránce nezměnilo:

> Autor: [Martin Barna](/#omne) · Vydáno 26. 8. 2026

U 9 článků, kde se `dateModified` liší od `datePublished`, stojí „Aktualizováno <datum>".
Datum je `<time datetime>` = `dateModified` z JSON-LD stránky, nic se nedomýšlelo (git historie
v tomhle klonu je mělká a hromadné commity by stejně dávaly falešná data). Jméno vede na sekci
„Kdo tě povede" na homepage (`/#omne`), protože samostatná stránka o Martinovi neexistuje.
Žádné tituly ani certifikáty jsem nepřidával.

`scripts/blog-publikuj.mjs` vkládá stejný řádek a JSON-LD s `@id` i do nově vydaných článků
(sdílí funkci `radekAutora` z `geo-sjednot.mjs`). Zároveň teď píše odpověď FAQ do JSON-LD jako
čistý text bez markdownu, aby seděla s viditelnou odpovědí. Testy: `node --test
scripts/blog-publikuj.test.mjs` 11/11 OK (přibyl test na autora, vydavatele a řádek s autorem).

**Barva ověřená na renderu** (Chromium, lokální server, oba motivy, 1366 a 390 px):
154 stránek × tmavý a světlý motiv × 2 šířky = 616 načtení, **0 chyb JavaScriptu**, řádek je
vidět všude. Kontrast se měří proti skutečnému pozadí pod textem (text se schová inline
`!important`, vyfotí se pozadí, spočítá se WCAG poměr s efektivní barvou textu), 10. percentil:

| Motiv / šířka | Text řádku | Odkaz „Martin Barna" | Datum |
|---|---|---|---|
| tmavý 1366 px | 14,93 | 15,26 | 15,42 |
| tmavý 390 px | 15,26 | 15,36 | 15,42 |
| světlý 1366 px | 6,56 | 5,14 | 6,56 |
| světlý 390 px | 6,17 | **4,87** | 6,22 |

Práh AA je 4,5. ⚠️ První verze neprošla: světlý motiv (`theme-light.css`) přebarví každý odkaz
v hero na `#866008` přes `!important` a třída `hero-meta` k tomu přidává průhlednost 0,92.
Výsledek byl 4,39:1. Řádek má proto `opacity:1` a vyšlo 5,14 (desktop) a 4,87 (mobil).
`scripts/kontrola-citelnosti.mjs` před i po: 0 nálezů ve 152 článcích.

## 4. Sitemap

`sitemap.xml` obsahuje přesně 186 indexovaných stránek + `llms.txt`, žádnou s `noindex`,
žádnou neexistující, canonical každé stránky sedí s `<loc>` (hlídá `geo-kontrola.mjs`).
Mimo sitemapu jsou jen dvě stránky bez `noindex`: `404.html` (správně) a `akademie/overit/`
(ověření certifikátu, viz návrhy).

`lastmod` v repu je zastaralý, ale to je dané postupem: deploy ho před nahráním přegeneruje
z git historie (`scripts/gen-sitemap-lastmod.mjs`, checkout s `fetch-depth: 0`), takže na webu
odpovídá datu posledního commitu souboru. Ručně jsem ho neměnil. ⚠️ Commit v téhle větvi sahá
na 181 stránek, po nasazení dostanou všechny `lastmod` z data merge. U článků je to pravda
(přibyl viditelný řádek), u ostatních se změnilo jen JSON-LD.

`llms-full.txt` jsem do sitemapy nepřidal: sitemapa je pro stránky a celý text všech článků
v jednom souboru by Google mohl brát jako duplicitu.

## 5. Kontrolní skript

`node scripts/geo-kontrola.mjs` (Node, bez závislostí, `--vse` vypíše všechna místa). Projde
všech 710 nasazovaných HTML a hlídá: nevalidní JSON-LD, indexované stránky bez JSON-LD, Person
s jiným `@id` nebo jako kopii, totéž pro organizaci, definici entity mimo její domovskou stránku,
odkaz na nedefinované `@id`, ceny mimo viditelný text, hodnocení a recenze mimo viditelný text,
FAQ, které nesedí slovo od slova, články bez BlogPosting, autora, vydavatele, data, viditelného
autora s odkazem a viditelného data, drobečkovou navigaci bez BreadcrumbList, počty
potravin/receptů v JSON-LD, dlouhou pomlčku, sitemapu (chybějící stránky, noindex, neexistující
soubory, canonical, lastmod) a `llms.txt` (mrtvé odkazy, odkaz na `llms-full.txt`).
`llms-full.txt` neodpovídající HTML hlásí jako varování.

Ověřeno i naopak: v dočasné kopii repa jsem úmyslně rozbil cenu, autora, `@id`, odpověď FAQ,
datum, odkaz autora a vložil dlouhou pomlčku. Skript našel všech 10 chyb.

Výstup na konci práce:

```
GEO kontrola martinbarna.cz
  nasazovaných HTML: 710, z toho indexovaných: 186
  bloků JSON-LD: 384, URL v sitemap.xml: 187
  zdůvodněné výjimky:
     [BEZ_JSONLD] obchodni-podminky/index.html: právní stránka, zadání GEO 9. 10. 2026 zakazuje na ni sahat
     [BEZ_JSONLD] odstoupeni/index.html: právní stránka, zadání GEO 9. 10. 2026 zakazuje na ni sahat
     [BEZ_JSONLD] zasady-ochrany-osobnich-udaju/index.html: právní stránka, zadání GEO 9. 10. 2026 zakazuje na ni sahat
     [MIMO_SITEMAP] 404.html: chybová stránka, server ji vrací se stavem 404, do sitemapy nepatří
     [MIMO_SITEMAP] akademie/overit/index.html: generuj-sitemap.mjs ji záměrně řadí mezi interní (ověření certifikátu); nemá noindex, k rozhodnutí majitele

VAROVÁNÍ: 0

CHYBY: 0

VÝSLEDEK: 0 chyb
```

Zdůvodněné výjimky (jsou v kódu i ve výstupu): tři právní stránky bez JSON-LD (zákaz úprav),
`404.html` a `akademie/overit/` mimo sitemapu.

## Rozpory ve faktech (nevybíral jsem, k rozhodnutí majitele)

1. **Kolik materiálů je ve videokurzu.** `videokurz.html`: „26 bonusových materiálů: 24 ke
   stažení plus kalkulačku a generátor receptů online", o kus níž na téže stránce „Kuchařka 40+
   receptů, 2 e-booky a **22** dalších průvodců" (1 + 2 + 22 = 25). `recepty-a-odpovedi/`: „tahle
   kuchařka, oba e-booky a dalších **24** materiálů" (= 27). Starý `llms.txt` psal 23 (= 26).
   V `llms.txt` teď stojí jen věta shodná s první citací, bez dělení.
2. **Zvýhodněná konzultace 2 190 Kč.** Starý `llms.txt` ji veřejně nabízel každému, kdo má
   videokurz. Na `/konzultace/` je od 13. 9. komentář, že tam „byla veřejně a klikl by na ni
   kdokoli. Sleva patří jen majitelům kurzu". Teď je jen na `/dekuji-videokurz/` (noindex).
   Z `llms.txt` jsem ji vyndal.
3. **Komunita na HeroHero:** cena 6 €/60 €, zkušební 2 týdny a popis obsahu z `llms.txt` nestojí
   nikde na webu (jen odkaz „Členská komunita" v patičce). Nechal jsem jen odkaz. Když to platí,
   stačí to dát na web a vrátit do `llms.txt`.
4. **Tvůj Coach v `llms.txt` sliboval víc, než je na stránce:** „14 svalových partií v pásmech
   MEV/MAV/MRV", „deload", „hledání i celou větou", u „Co si ještě dát" i „vlákninu",
   „auto-regulace zátěže". Na `/tvuj-coach/` je jen „objem po svalových partiích", „mezocyklus",
   doporučení zátěže na další sérii a dorovnání kalorií a bílkovin. Přepsáno podle stránky.
5. **Počet článků:** `llms.txt` psal 146, článků je 152, blog píše „desítky článků". Teď
   „přes 150", platí i po dalších vydáních.
6. **Profily:** `llms.txt` měl YouTube `youtube.com/@MartinBarna` a Facebook
   `facebook.com/share/1CZuTf2wvb/`; web odkazuje na `youtube.com/MartinBarna` a
   `facebook.com/martinbarnaonlinevyzivaafitness` (share odkaz je už jen v `_zaloha/`).
   Sjednoceno na odkazy z webu. Živě jsem je ověřit nemohl (bez přístupu na internet).
7. **Appka v Academy:** starý `llms.txt` psal VIP jen u doživotního přístupu, stránka Academy
   i `/tvuj-coach/` píšou i měsíční členství (po celou dobu členství). Opraveno podle stránek.
8. **Konzultace:** „písemné shrnutí" z `llms.txt` na `/konzultace/` není. Vyndáno.
9. **Nástroje zdarma:** „databáze 128 cviků s video ukázkami"; stránka píše „s provedením krok
   za krokem a nejčastějšími chybami", o videu nic. Přepsáno.
10. **„ČR a Slovensko"** v `llms.txt`: Slovensko na webu nikde. Teď „v Česku".
11. **Hodnocení v JSON-LD:** homepage 66 recenzí, reference 114; web všude „100+", Google
    47 + Facebook 67 doporučení, 70 v textu. Opraveno, viz bod 1 výše.
12. **Dvě různé databáze potravin** (nejde o chybu, jen ať to AI nezmate): Tvůj Coach „přes
    50 000", Academy „přes 30 000". Podle `sync-cisla-web.mjs` je to záměr (Academy čte
    statický export). V `llms.txt` je jen číslo appky.

## Návrhy pro majitele (nic z toho jsem neměnil)

1. **Viditelné FAQ na `/jak-zhubnout/` a `/jak-nabrat-svaly/`.** Otázky a odpovědi tam
   v JSON-LD byly (10 kusů, texty mám v historii gitu), na stránce ne. Když je dáš na stránku,
   vrátím FAQPage zpátky slovo od slova. AI asistenti FAQ čtou rádi.
2. **Sekce „Zdroje" u 90 starších článků** (hlavně série e-book, mýty a první vlna z roku
   2024 až 2025). Nové články zdroje mají; pro citace v AI je to silný signál důvěryhodnosti.
3. **Samostatná stránka „O mně"** (`/o-mne/`) s fotkou, praxí od 2013, vzděláním a odkazy na
   profily. Dnes vede autor u článků na sekci homepage. Certifikace jsou na webu jen obecně
   („mezinárodní trenérská certifikace, certifikace výživového poradce"): konkrétní název
   a instituce by AI mohla citovat, ale doplnit je může jen Martin.
4. **`akademie/overit/`** nemá `noindex`, ale generátor sitemapy ji řadí mezi interní. Buď
   `noindex`, nebo do sitemapy (stránka „Ověření certifikátu Barna Academy" může pomáhat
   důvěryhodnosti certifikátu).
5. **Generovat `llms-full.txt` při deployi**: přidat `node scripts/generuj-llms-full.mjs`
   do `deploy-wedos.yml` hned za krok s čísly. Pak bude vždy čerstvý a s aktuálními počty
   potravin a receptů. Workflow jsem neměnil (zadání: nic nenasazovat).
6. **Volitelně `X-Robots-Tag: noindex` pro `llms-full.txt`** v `.htaccess`, kdyby ho Google
   začal ukazovat ve výsledcích místo článků. AI roboti ho dál stáhnou. Zatím bych počkal.
7. **Zkrátit titulky a popisky** podle reportu `_cloud/SEO-1009.md` (7 title nad 65 znaků,
   13 description nad 160): AI Overviews i ChatGPT berou do citace hlavně title a začátek textu.
8. **Recenze s datem a zdrojem:** u 70 recenzí na `/reference/` chybí datum. Kdyby šlo
   doplnit (Google/Facebook ho mají), dá se přidat `datePublished` k recenzím.

## Ověřené jen staticky

- Všechno je ověřené nad repem a lokálním renderem. Živý web jsem neviděl (prostředí nemá
  přístup na internet), změny nejsou nasazené.
- Validitu schématu jsem kontroloval vlastním skriptem a `JSON.parse`, ne Google Rich Results
  Testem ani validator.schema.org (vyžadují síť). Po nasazení doporučuju projít homepage,
  jeden článek, `/videokurz`, `/akademie/`, `/koucing/` a `/tvuj-coach/` v
  https://search.google.com/test/rich-results.
- Ceny na `/tvuj-coach/` se v prohlížeči přepisují z ceníku appky (`pricing_plans`). JSON-LD
  odpovídá statickému textu v HTML; když se ceník změní, musí se změnit obojí (checklist
  `tvujcoach-cenik-zmena-checklist`).
- Jak AI asistenti web opravdu citují, se pozná až za týdny po nasazení a přecrawlování.
- Společná paměť v `C:\Users\fitne\...\memory\` v cloudovém prostředí není, četl jsem jen
  repo a `CLAUDE.md`. Do `CLAUDE.md` jsem přidal krátké stálé pravidlo „JSON-LD a AI
  vyhledávání", ať další session nerozbije `@id` kopiemi.

## Nové soubory

- `scripts/geo-spolecne.mjs`: společné pomůcky (viditelný text, JSON-LD, mapování URL).
- `scripts/geo-kontrola.mjs`: kontrola, viz část 5.
- `scripts/geo-sjednot.mjs`: idempotentní sjednocení JSON-LD a řádek s autorem a datem u článků.
- `scripts/generuj-llms-full.mjs`: generátor `llms-full.txt`.
- `llms-full.txt`: vygenerovaný plný text (nasadí se).
- `_cloud/GEO-TECHNIKA-1009.md`: tenhle report (`*.md` se nenasazuje).
