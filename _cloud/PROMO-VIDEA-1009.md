# Promo videa, 9. 10. 2026

Větev `cloud/promo-videa-1009` nad `origin/main`. **Nemergovat do `main`**, videa na web nepatří.
Nic není nasazené ani publikované na sítích. Deploy (`deploy-wedos.yml`) jde jen ručně, takže
push téhle větve nic nespustí.

Všechny texty ve videích jsou **návrh**. Šéf je ještě projede hlasem Martina: soupis s časy je
v `_cloud/videa/TEXTY.md`.

## Co je hotové

- **10 svislých videí 1080×1920**, 30 fps, H.264 (High 4.1) + AAC 160 kb/s, `faststart`.
  Bez mluveného slova, s titulky. Ke každému produktu varianta 15 s a 30 s.
- **Cover PNG 1080×1920** ke každému videu (`<video>-cover.png`).
- **Verze bez hudby** ke každému videu (`bez-hudby/`), třeba pro TikTok, kde se zvuk přidává až v appce.
- `_cloud/videa/TEXTY.md`: všechny texty na obrazovce (video, čas, text).
- `_cloud/videa/ZDROJE.md`: totéž jako sekce „Odkud je každé tvrzení" níže.
- `_cloud/videa/src/`: z čeho se videa skládají. Přegenerování jedním příkazem, viz `src/README.md`.

## Seznam videí

| Soubor | Délka | Velikost | Háček (první 1–3 s) | Výzva k akci |
|---|---|---|---|---|
| `tvuj-coach-vip-15.mp4` | 15 s | 3,90 MB | Otázka k jídlu ve dvě ráno? + bublina „Kolik mi dnes zbývá?" | 499 Kč / měsíc, videokurz zdarma k první platbě, tvujcoach.cz |
| `tvuj-coach-vip-30.mp4` | 30 s | 7,54 MB | totéž | 499 Kč / měsíc, videokurz (182 videí), zrušíš kdykoliv, 14 dní vrácení peněz |
| `tvuj-coach-basic-15.mp4` | 15 s | 3,51 MB | Zbývá ti 400 kcal a 30 g bílkovin. Co si ještě dnes dát? | 249 Kč / měsíc, bez AI, tvujcoach.cz |
| `tvuj-coach-basic-30.mp4` | 30 s | 6,96 MB | Kolik sérií týdně padlo na záda? | 249 Kč / měsíc nebo 2 490 Kč na rok |
| `videokurz-15.mp4` | 15 s | 2,87 MB | Dá se jíst pizza a pořád mít výsledky? | 1 490 Kč jednorázově, nebo zdarma k VIP, martinbarna.cz/videokurz |
| `videokurz-30.mp4` | 30 s | 7,39 MB | Kalorie, bílkoviny, sacharidy, tuky. Kde začít? | totéž + 14denní záruka |
| `academy-15.mp4` | 15 s | 4,16 MB | Klient chce jídelníček. Máš ho za pár vteřin? | 990 Kč / měsíc nebo 8 900 Kč doživotně, martinbarna.cz/akademie |
| `academy-30.mp4` | 30 s | 8,62 MB | Studuješ v deset večer a nemáš se koho zeptat? | totéž + appka VIP v ceně obou variant, 14denní záruka |
| `koucing-15.mp4` | 15 s | 3,07 MB | Kdo ti každý týden projde čísla? | Gold 6 450 Kč / měsíc, martinbarna.cz/koucing |
| `koucing-30.mp4` | 30 s | 6,79 MB | Týdenní report za 3 minuty z mobilu. | Gold 6 450 Kč / měsíc, konzultace 2 990 Kč se odečte |

Všechna videa jsou hluboko pod limitem 20 MB (největší 8,6 MB). Hlasitost −15 LUFS (true peak −1,5 dB).

## Jak jsem videa kontroloval

- **Bezpečné zóny měřené, ne odhadnuté.** Engine u každého textového prvku měří jeho obdélník
  v prohlížeči: text musí být v pásu y 250–1570 px (nahoře 250 px a dole 350 px volné)
  a x 60–1020 px. Kontrola běží uprostřed a na konci každé scény a na coveru.
  Výsledek: **0 porušení, 0 přetečení, 0 JS chyb** ve všech 10 videích.
  Checker během práce dvakrát zabral (dlouhá adresa v tlačítku přetékala okraj), teď se písmo
  tlačítka i nadpisu zmenšuje samo.
- **Ze 6 snímků každého hotového MP4** (8, 22, 38, 55, 72 a 93 % délky) jsem kontroloval
  čitelnost, přetékání, ceny a cizí loga. Našel jsem tím jednu chybu: animované odpočítávání
  čísel ukázalo v mezisnímku „247 lekcí". Odpočítávání jsem zrušil, v žádném snímku teď není
  jiné číslo než pravdivé (důležité pro náhled, který si Meta vybírá sama, i pro pauzu).
- **Ceny strojově proti textu stránek**: každá cena a počet ve videu (499, 249, 2 490, 1 490,
  990, 8 900, 6 450, 2 990, 182 videí, 256 lekcí, 24 modulů, 50 000 potravin, 128 cviků,
  26 bonusů, 11 lekcí zdarma, 48 hodin, 3 minuty) je doslova ve viditelném textu stránky.
- **Texty**: žádná dlouhá pomlčka (U+2014), žádné „Odemkni / Revoluční / Klíčem je / Pojďme /
  Cesta k / Transformace / Není to jen", žádný vykřičník, žádné VERZÁLKY s diakritikou
  (pravidla z `HLAS-MARTINA.md`).
- **Bez slibů a před/po**: žádná kila, žádné proměny, žádné recenze se jmény, žádné zdravotní
  tvrzení. Výřezy stránek jsou vybrané tak, aby v nich nebyly fotky před/po ani recenze.
- **Cizí loga**: žádná. Výřezy stránek se vyhýbají Stripe / Apple Pay / Google Pay a logu ČT.
  Z karty doživotní Academy jsem odřízl srovnání s britskou ACA (cizí značka).
- **Osobní údaje**: screenshot `assets/app/dnes.webp` má v hlavičce oslovení „ahoj, Petra"
  (demo účet). Ve videích je hlavička oříznutá.

## Háčky a pravidla Meta

Háček je vždy otázka nebo konkrétní situace z appky či praxe a nic netvrdí o divákovi
(o jeho těle, váze, zdraví). „Zbývá ti 400 kcal" a „Kolik sérií padlo na záda" popisují funkci,
ne člověka.

⚠️ K posouzení šéfem:
- **„Dá se jíst pizza a pořád mít výsledky?"** (`videokurz-15`) je doslova z bonusu na stránce
  videokurzu, ale „výsledky" může působit jako slib. Opatrnější varianta: „Patří pizza do jídelníčku?"
- Reklamy na hubnutí Meta povoluje jen s cílením 18+. Platí pro všechny produkty kromě Academy.
- Ve `koucing-15` mluví Martin v první osobě („Já. Projdu váhu, míry…"), stejně jako na stránce.

## Doporučení: co na reklamu a co na organic

**Reklama (Meta, konverze):**
1. `tvuj-coach-vip-15`: hlavní kreativa. Háček je funkce, kterou jinde nemáš (kouč, který vidí
   čísla), cena a bonus jsou na konci jasně. A/B proti `tvuj-coach-vip-30` (30 s víc vysvětlí,
   ale u studeného publika méně lidí dokouká).
2. `videokurz-15`: nejlevnější vstup (jednorázově), nejnižší bariéra pro studené publikum.
   Hodí se i jako retargeting na lidi, kteří viděli VIP a nekoupili.
3. `academy-15`: jen na trenéry a výživové poradce (zájmy, lookalike z kupců Academy).
   Kicker „Pro trenéry a výživové poradce" sám odfiltruje špatné publikum.

Měřit podle prodejů a zaplacených předplatných, ne podle prokliku (pravidlo z CLAUDE.md:
proklik je kontaminovaný skenery a o prodeji nic neřekne).

**Organic (Reels, TikTok, Shorts):**
- 30s verze: víc obsahu, lépe drží pozornost lidí, kteří Martina už sledují:
  `tvuj-coach-basic-30` (objem po partiích je dobrý háček pro lidi z posilovny),
  `videokurz-30`, `academy-30`, `koucing-30`.
- `koucing-15` a `koucing-30` spíš organic a retargeting než studená reklama: koučink za
  6 450 Kč měsíčně se z 15sekundového videa u cizího člověka neprodá a kapacita je omezená.
  Video má hlavně přivést poptávku („Nebo mi nejdřív nezávazně napiš").
- `tvuj-coach-basic-15` jako levnější alternativa v sérii po VIP videu, ne samostatně
  (jinak kanibalizuje VIP).

**Pozor u TikToku:** hudba ve videích je vlastní syntéza, ale TikTok reklamy chtějí hudbu
z Commercial Music Library. Pro TikTok je proto `bez-hudby/` a zvuk se přidá v appce.

## Varianty háčků „z hloubky" (jen text, nerenderováno)

Podle `HLAS-MARTINA.md` kreativa nemá jít sama. Stejné sdělení, podané jinak (nevybírám za Martina):
- VIP, klasika: „Otázka k jídlu ve dvě ráno?" (je ve videu)
- VIP, z hloubky: „Rohlík, tvaroh dvě stě gramů a tři deci vody." řečené nahlas jako první věta,
  a teprve pak vysvětlení, že tohle stačí appce říct (TC, hlasový zápis).
- Videokurz, klasika: „Dá se jíst pizza a pořád mít výsledky?" (je ve videu)
- Videokurz, z hloubky: „182 videí. Kolik z nich je o zakázaných jídlech? Žádné." Pozor,
  potřebuje Martinovo potvrzení, na stránce stojí jen „Nevěřím na zázračné diety ani zakázaná jídla."
- Academy, z hloubky: „Kolik stojí jeden měsíc Diamond koučinku? 11 900 Kč. Celá Academy 8 900 Kč."
  (AK: „1 měsíc mého Diamond koučinku stojí 11 900 Kč. Celou Academy tu máš navždy, a levněji.")

Každá se dá vyrenderovat úpravou háčku ve `src/videos.js` (cca minuta na video).

## Co nešlo a proč

- **Skutečný záznam obrazovky appky nebyl k dispozici.** Stránka `/tvuj-coach/` má 10 krátkých
  demo videí appky, ale ta leží na `tvujcoach.cz/demo-videa/` a ten je z cloudového prostředí
  nedostupný (proxy 403). Použil jsem proto statické screenshoty appky z `assets/app/`
  a Academy z `assets/screeny/academy/` (s pomalým posunem a přiblížením) a výřezy prodejních
  stránek z lokálního serveru (Chromium, mobilní šířka 390 px).
  **Tip:** až budou demo videa po ruce, nahradí screenshoty ve scénách 1:1 (typ scény `card`).
- **Hlasový zápis a focení talíře nemají screenshot**, takže je ve `tvuj-coach-vip-30` ukazuje
  stylizovaná grafika (vlna zvuku, rámeček fotoaparátu nad talířem), ne vymyšlené UI appky.
  Graf objemu po partiích v `tvuj-coach-basic-30` je taky ilustrační, bez konkrétních čísel.
- **Dva screenshoty appky jsou jen 390 px široké** (`ai-kouc.png`, `generator-treninku.png`),
  ve videu jsou proto trochu měkčí. Ostřejší verze (780 px, jako `dnes.webp`) by pomohla.
- **Fotka `koucink.jpg` má jen 1400×933 px**, na výšku 1920 px se zvětšuje zhruba 2×.
  Ve videu je to pozadí s titulkem, ale ostřejší portrétní fotka od stolu by byla lepší.
- **Hudbu jsem neslyšel.** Je syntetizovaná v numpy (vlastní tvorba, žádná licence třetích stran):
  120 BPM, akordy, basa, kick, hi-hat, arpeggio, pět variant podle produktu. Zkontroloval jsem jen
  spektrum, průběh a hlasitost. **Před použitím si ji pusťte.** Když nesedne, je tu `bez-hudby/`
  a do reklamy se dá vložit skladba z Meta Sound Collection.
- **`tvujcoach.cz` jsem neověřil naživo** (stejný důvod, proxy). Podle mailů v repu je to vstup
  „Vyzkoušet appku zdarma". Kanonická prodejní stránka je `martinbarna.cz/tvuj-coach/`:
  v reklamě bych jako cílový odkaz dal tu, na obrazovce nechal krátké `tvujcoach.cz`.
- **Ceny jsou ve videu natvrdo** (`HLAS-MARTINA.md` jinak říká, že ceny žijí v ceníku). U videa
  to jinak nejde, proto jsou v jednom objektu `CENY` ve `src/videos.js`. Při změně ceníku stačí
  upravit a přerenderovat (asi 15 minut všech 10).
- Uživatelské preference v profilu ještě uvádějí videokurz za 800 Kč se 153 videi. Stránka dnes
  říká **1 490 Kč a 182 videí**, a to je ve videích (zadání to taky potvrzuje).

## Jak přegenerovat

Viz `_cloud/videa/src/README.md`. Zkráceně: z kořene repa `python3 -m http.server 8099`,
pak `NODE_PATH=$(npm root -g) node _cloud/videa/src/render.js [video]`
a `node _cloud/videa/src/texty.js`.

## Oprava 9. 10.: odznak „Ověřeno Martinem“

Odznak „Ověřeno Martinem“ majitel z appky 22. 8. zrušil a nesmí se nikde objevit (ani hvězdička
„Od Martina“, ani fajfka „Martin“ u surovin).

**Kontrola očima v plném rozlišení** (ne OCR): všech 8 souborů v `assets/app/` (4 soubory
`generator-jidelnicku*.png` jsou bajtově stejné) a všechny screenshoty Academy, které videa
používají (`assets/screeny/academy/02-lekce-mobil`, `03-generator-cz-mobil`, `04-ai-martin-mobil`).
Výsledek: odznak je **jen v `assets/app/zapis-jidla.webp`**, u dvou položek („Kuřecí prsa“ a „Kuřecí
prsa grilovaná“, text „Ověřeno Martinem · 120 / 165 kcal/100 g · + zapíše 100 g“). Hvězdička „Od Martina“ ani
fajfka „Martin“ se v žádném obrázku nevyskytuje. (Žlutá hvězdička ☆ vedle „+“ je tlačítko oblíbených,
je u všech položek a odznak to není.) V textech webu fráze „Ověřeno Martinem“ ani „Od Martina“ jako
odznak není.

**Jak je obrázek opravený** (`_cloud/videa/src/oprava-odznaku.py`): nic se nepíše fontem, řádek je
poskládaný z pixelů originálu. Číslo kcal je vzaté z prvního řádku, „kcal/100 g · + zapíše 100 g“
z druhého, mezera změřená na řádku „106 kcal/100 g“, který už je v aktuálním tvaru. Písmo, barva
i vyhlazení jsou tak přesně původní. Položka má teď jeden řádek popisu jako v aktuální appce, takže
se zkrátila o 40 px a hvězdička s „+“ se posunuly o 20 px nahoru na střed. Ušetřených 80 px je
dorovnaných prázdným pozadím nad nadpisem „Logování“, takže spodek obrazovky (AI Coach tlačítko,
navigace) se nehnul. Kontrola: přiblížení řádků, porovnání s řádkem „Kuřecí prsa syrové“ a měření
skoků mezi sousedními řádky pixelů na všech švech (žádný). Uloženo jako webp q90 (52 kB, originál
48 kB).

**Videa**: obrázek používá jen `tvuj-coach-vip-30` (scéna 14,5–18 s). Přerenderováno s hudbou
i bez, cover přegenerovaný (sám obrázek nepoužívá). Kontrola snímků v 15,5 / 16,5 / 17,5 s
a 6 kontrolních snímků: odznak nikde. Ostatní videa a covery tenhle obrázek nepoužívají, a proto se
nemění.

**Web**: opravený obrázek je zvlášť ve větvi `cloud/screenshot-bez-odznaku-1009` (z `origin/main`)
jako `assets/app/zapis-jidla-v2.webp` (nový název kvůli 30denní cache CDN). Ukazuje ho **jediná
stránka webu: `/tvuj-coach/`** (martinbarna.cz/tvuj-coach/, sekce „Co appka umí“, karta „Zapsat
jídlo trvá vteřiny“). Žádná jiná stránka, mail ani skript na `zapis-jidla.webp` neodkazuje.
Draft PR [MartinBarna/MB.cz#560](https://github.com/MartinBarna/MB.cz/pull/560), commit `eb1dfd339`: nový soubor
+ přepnutý `<img>` (a komentář nad ním), ceny, texty ani Stripe beze změny. Původní `zapis-jidla.webp`
zůstává, ať HTML ještě držené v cache nemá rozbitý obrázek. Lokální render `/tvuj-coach/`: obrázek se
načte (780×1688), 0 JS chyb. **Nenasazeno**, po merge je potřeba spustit `deploy-wedos.yml`.

## Odkud je každé tvrzení

TC = `tvuj-coach/index.html`, VK = `videokurz.html`, AK = `akademie/index.html`,
KO = `koucing/index.html`. Citace jsou z viditelného textu stránek (Chromium, lokální server,
9. 10. 2026). Totéž je v `_cloud/videa/ZDROJE.md`.

### tvuj-coach-vip-15

- **0,0–3,0 s** (háček): TC: „Zeptáš se ve dvě ráno a dostaneš odpověď.“ · Bublina = dotaz ze screenshotu assets/app/ai-kouc.png
- **3,0–6,5 s** (záběr): TC: „AI kouč odpovídá podle tvých čísel v appce.“ · Screenshot assets/app/ai-kouc.png (z /tvuj-coach/)
- **6,5–10,0 s** (výčet): TC: „Zapíšeš jídlo i trénink za pár vteřin“ · TC: „Namíříš na čárový kód“, „Nebo to řekneš nahlas“, „Vyfotíš talíř“
- **10,0–12,5 s** (záběr): TC: „každý týden se podívá na tvoji váhu a na tvoje zápisy a podle toho ti pohne kaloriemi a makry“ · Screenshot assets/app/dnes.webp (oříznutá hlavička s demo jménem)
- **12,5–15,0 s** (výzva k akci): TC: „VIP · 499 Kč / měsíc“ · TC: „K první platbě VIP dostaneš videokurz výživy za 1 490 Kč zdarma“ · URL: tvujcoach.cz (patička TC + odkazy v mailech „Vyzkoušet appku zdarma“)

### tvuj-coach-vip-30

- **0,0–3,0 s** (háček): TC: „Zeptáš se ve dvě ráno a dostaneš odpověď.“
- **3,0–7,0 s** (záběr): TC: „AI kouč mým hlasem … umí appku ovládat za tebe: zapíše jídlo, upraví ho“ · TC (demo video): „kouč odpoví a jídlo za tebe rovnou zapíše“
- **7,0–11,0 s** (citace): TC: „Nebo to řekneš nahlas VIP: „Rohlík, tvaroh dvě stě gramů a tři deci vody.“ … ukáže ti, co chce zapsat. Potvrdíš, nebo opravíš.“
- **11,0–14,5 s** (citace): TC: „Vyfotíš talíř VIP … AI odhadne, co na talíři leží, a spočítá makra … Odhad vidíš a upravíš, než se zapíše.“
- **14,5–18,0 s** (záběr): TC: „Přes 50 000 potravin včetně zboží z Lidlu, Tesca, Alberta či Globusu.“ · Screenshot assets/app/zapis-jidla.webp, opravený bez odznaku „Ověřeno Martinem“ (src/img/zapis-jidla-v2.webp)
- **18,0–21,5 s** (záběr): TC: „appka přepočítá kalorie a makra na další týden, podle tvé váhy a tvých zápisů z celého týdne“
- **21,5–25,0 s** (záběr): TC: „Plán ti appka napíše podle toho, kde cvičíš a kolik dní v týdnu máš.“ · TC: „K tomu ti poskládá jídelníček i trénink na míru.“
- **25,0–30,0 s** (výzva k akci): TC: „499 Kč / měsíc“ · TC: „Videokurz výživy zdarma k první platbě (182 videí …)“ · TC: „Zrušíš kdykoliv, do 14 dnů vrácení peněz“

### tvuj-coach-basic-15

- **0,0–3,5 s** (háček): TC: „„Co si můžu ještě dnes dát?“ BASIC · Zbývá ti 400 kcal a 30 g bílkovin.“
- **3,5–6,0 s** (titulek): TC: „Appka projde databázi a nabídne, čím to dorovnáš, aniž den přestřelíš.“
- **6,0–9,5 s** (záběr): TC: „Generátor ti poskládá celý den z běžných potravin i s gramážemi a přidá nákupní seznam“
- **9,5–12,5 s** (záběr): TC: „Plán podle toho, kde cvičíš BASIC“
- **12,5–15,0 s** (výzva k akci): TC: „Basic · Levnější volba bez AI · 249 Kč / měsíc“ · TC: „Všechno tohle počítá engine appky sám, bez AI“

### tvuj-coach-basic-30

- **0,0–3,0 s** (háček): TC: „Objem po svalových partiích BASIC · Kolik sérií týdně padlo na záda a kolik na nohy.“
- **3,0–7,0 s** (grafika): TC: „Barevně uvidíš, jestli je to málo, akorát, nebo už moc.“ · Grafika je ilustrační (bez konkrétních čísel), ne screenshot appky
- **7,0–11,0 s** (citace): TC: „Pamatuje si, kolik zvedáš BASIC … S Basicem ti navíc u příští série poradí: „Zkus 60 kg × 10, minule ti zbývala rezerva.““
- **11,0–15,0 s** (záběr): TC: „Cvičíš ve fitku, doma nebo na hřišti … Zadáš cíl a kolik dní v týdnu máš, a plán je hotový.“
- **15,0–19,0 s** (záběr): TC: „Generátor ti poskládá celý den z běžných potravin i s gramážemi a přidá nákupní seznam, i na celý týden.“
- **19,0–22,5 s** (háček): TC: „Zbývá ti 400 kcal a 30 g bílkovin. Appka projde databázi a nabídne, čím to dorovnáš, aniž den přestřelíš.“
- **22,5–26,0 s** (záběr): Výřez ceníkové karty Basic z /tvuj-coach/ (mobil, lokální server)
- **26,0–30,0 s** (výzva k akci): TC: „249 Kč / měsíc nebo 2 490 Kč na rok“ · TC: „Basic je totéž bez AI“, „Zrušíš kdykoliv“

### videokurz-15

- **0,0–3,0 s** (háček): VK (bonus Flexibilní stravování): „Jak si dát i pizzu a pořád mít výsledky.“
- **3,0–6,0 s** (titulek): VK: „Kompletní videokurz, ve kterém ti krok za krokem ukážu, jak jíst“ · VK moduly: Základy výživy a energie, Makroživiny, Flexibilní stravování
- **6,0–10,0 s** (čísla): VK: „182 VIDEÍ · 20+ HODIN OBSAHU · ∞ DOŽIVOTNÍ PŘÍSTUP“
- **10,0–12,5 s** (výčet): VK: „Kalkulačka makroživin“, „Kuchařka 40+ receptů“, „Generátor receptů“
- **12,5–15,0 s** (výzva k akci): VK: „Jednorázově 1 490 Kč, doživotní přístup“ · VK: „Nebo ho dostaneš zdarma k první platbě appky Tvůj Coach VIP.“ · URL: canonical videokurz.html = https://martinbarna.cz/videokurz

### videokurz-30

- **0,0–3,0 s** (háček): VK: „první 4 základy (kalorie, bílkoviny, tuky, sacharidy)“
- **3,0–8,0 s** (záběr): VK: „Šest modulů, od základů po pokročilé strategie.“ · Výřez sekce „Co se naučíš“ z videokurz.html (mobil)
- **8,0–12,0 s** (čísla): VK: „182 VIDEÍ · 20+ HODIN OBSAHU · ∞ DOŽIVOTNÍ PŘÍSTUP“
- **12,0–16,5 s** (záběr): VK: „Ke kurzu dostaneš 26 bonusových materiálů“ · VK: „Kalkulačka, generátor receptů, kuchařka 40+, e-booky, výpočty, tréninkový plán a další.“
- **16,5–20,5 s** (foto): VK: „stejný systém, který učím klienty v osobním koučinku, jen vlastním tempem“ · VK: „Na mobilu, tabletu i počítači.“
- **20,5–24,0 s** (titulek): VK: „Pusť si 11 lekcí zdarma … stačí nechat e-mail.“
- **24,0–30,0 s** (výzva k akci): VK: „1 490 Kč · Doživotní přístup, bez měsíčních poplatků“ · VK: „Nebo ho dostaneš zdarma k první platbě appky Tvůj Coach VIP.“ · VK: „14denní záruka vrácení peněz.“

### academy-15

- **0,0–3,0 s** (háček): AK: „Jídelníček na míru za pár vteřin.“ · AK: „VZDĚLÁVACÍ PROGRAM PRO TRENÉRY“
- **3,0–6,5 s** (záběr): AK: „Zadáš údaje klienta a systém spočítá makra i poskládá hotový denní jídelníček z běžných potravin. Dáš ho klientovi pod svým jménem.“
- **6,5–10,0 s** (záběr): AK: „AI Martina. Zná všech 256 lekcí, mluví jako já a odpoví ti hned.“ · AK: „Odpoví a rovnou ukáže, kde to je“
- **10,0–12,5 s** (čísla): AK: „24 modulů · 256 lekcí“
- **12,5–15,0 s** (výzva k akci): AK: „Měsíční členství 990 Kč / měsíc“ · AK: „Doživotní přístup 8 900 Kč jednorázově“ · URL: canonical akademie/index.html = https://martinbarna.cz/akademie/

### academy-30

- **0,0–3,0 s** (háček): AK: „Studuješ v deset večer, narazíš na něco, čemu nerozumíš, a nemáš se koho zeptat.“
- **3,0–7,0 s** (záběr): AK: „Zná všech 256 lekcí, mluví jako já a odpoví ti hned. Je u každé lekce, ve dne v noci“
- **7,0–11,0 s** (záběr): AK: „Každá lekce prakticky: co uděláš s klientem v pondělí.“
- **11,0–15,0 s** (záběr): AK: „Jídelníček na míru za pár vteřin.“ · AK: „Dáš ho klientovi pod svým jménem.“
- **15,0–19,0 s** (výčet): AK: „Generátor tréninků … Fitko, doma i venku“ · AK: „Databáze cviků · 128 cviků s provedením krok za krokem a nejčastějšími chybami“ · AK: „Rebrandovatelné science-based materiály · Profi přílohy, kuchařky, plány a průvodce, přebrandované na tvoje jméno“
- **19,0–22,5 s** (foto): AK: „Certifikát Barna Academy po testu a případovce, kterou čtu osobně.“
- **22,5–25,5 s** (čísla): AK: „256 lekcí ve 24 modulech“ · AK: „Videokurz výživy (182 videí) v ceně“
- **25,5–30,0 s** (výzva k akci): AK: „990 Kč / měsíc“, „8 900 Kč jednorázově“ · AK: „Appka Tvůj Coach je v ceně u obou variant.“ · AK: „14denní záruka vrácení peněz“

### koucing-15

- **0,0–3,0 s** (háček): KO: „každý týden projdu tvoje čísla a upravím plán“
- **3,0–6,5 s** (foto): KO: „Každý týden projdu tvoji váhu, míry a to, jak šel týden, a upravím cíle i aktivity.“
- **6,5–10,0 s** (výčet): KO: „Jídlo, které tě baví … Vejde se i pizza.“ · KO: „Podpora po ruce · E-mail a WhatsApp (po–pá).“ · KO (Gold): „Appka Tvůj Coach v ceně po celou dobu koučinku“
- **10,0–12,5 s** (titulek): KO: „Koučink beru jen v omezeném počtu, aby měl každý klient mou plnou pozornost“
- **12,5–15,0 s** (výzva k akci): KO: „Gold · 6 450 Kč / měsíc“ · KO: „NEZÁVAZNĚ MI NAPSAT“ · URL: canonical koucing/index.html = https://martinbarna.cz/koucing/

### koucing-30

- **0,0–3,0 s** (háček): KO: „Týdenní report naklikáš za 3 minuty z mobilu.“ · KO: „Pošleš report … já ho projdu, napíšu ti analýzu a upravím čísla.“
- **3,0–7,5 s** (záběr): KO: „Jak spolupráce probíhá · 1 Napíšeš mi · 2 Dostaneš plán na míru · 3 Týdenní kontroly“ · Výřez sekce z koucing/index.html (mobil)
- **7,5–11,0 s** (titulek): KO: „Do 48 hodin od tebe máš spočítané kalorie a makra, jídelníček a trénink.“ (po vyplnění vstupního dotazníku)
- **11,0–15,0 s** (foto): KO: „každý týden projdu tvoje čísla a upravím plán“ · KO: „Já ho vyhodnotím, napíšu ti analýzu a upravím čísla.“
- **15,0–19,5 s** (výčet): KO: „Ke koučinku dostaneš vlastní digitální zázemí, v ceně každého balíčku.“ · KO: „Moderní klientská sekce … Grafy váhy, měr a pokroku“, „Appka Tvůj Coach“, „AI Martin: kouč 24/7“, „Videokurz v ceně · 182 videí“
- **19,5–23,0 s** (záběr): KO: „Gold · Vedení na dálku, tohle si vybírá většina“ · Výřez karty Gold z koucing/index.html (mobil)
- **23,0–26,0 s** (titulek): KO: „Koučink beru jen v omezeném počtu, aby měl každý klient mou plnou pozornost a výsledky.“
- **26,0–30,0 s** (výzva k akci): KO: „Gold · 6 450 Kč / měsíc“ · KO: „Když si do 14 dní po konzultaci objednáš online koučink, cenu konzultace (2 990 Kč) ti odečtu z ceny balíčku.“
