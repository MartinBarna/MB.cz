# Academy + videokurz: mobil, přístupnost, výkon, chyby (9. 10. 2026)

Větev `claude/academy-videokurz-1009` z `origin/main` (ea7447206). Nic nenasazeno, na Supabase
ani maily se nesahalo, žádné `?v=` se neměnilo, žádný viditelný text, nadpis, cena ani odkaz na Stripe se neměnil.

## Jak se měřilo
- Lokální server `python3 -m http.server 8099` + headless Chromium (Playwright), viewport **360×740**,
  mobilní režim, dotyk. Externí požadavky blokované (Supabase, YouTube, analytika), takže
  přihlášené stavy (obsah za loginem, data klienta) se renderují jen v nepřihlášené podobě.
- Prošlo **470 stránek**: všech 258 lekcí `akademie/studium/*`, 186 stránek `akademie/videokurz/*`,
  zbytek `akademie/*` (bez `admin`) a `videokurz.html`.
- Na každé: chyby JS (`pageerror`, `console.error`), lokální 404, vodorovné přetečení
  (`scrollWidth > 360` + viníci), dotykové cíle < 44 px, písmo < 12 px, `img` bez `alt`,
  pole bez popisku, pořadí nadpisů, obrázky > 1600 px, blokující skripty v hlavičce.
- Kontrast: `getComputedStyle` barvy textu proti skutečnému pozadí (průhlednosti složené),
  práh 4,5 / 3,0 (velký text), **v tmavém i světlém motivu** (`mb-theme`).
- Fokus: skutečný `Tab` z klávesnice, porovnání stylu s fokusem a bez (s čekáním 300 ms,
  protože `transition` jinak měří rozjetý stav).
- Mrtvé odkazy: statická kontrola všech `href`/`src` proti souborům v repu.

**Výsledek před opravou:** 0 chyb JS a 0 lokálních 404 na všech 470 stránkách. Nálezy níže.
**Po opravě:** celý průchod znovu, 0 přetečení, 0 chyb JS, 0 polí bez popisku (kromě úmyslně
skrytého honeypotu `website` na landingu), 0 nálezů kontrastu na 37 klíčových stránkách v obou motivech.

## Co je opraveno

### 1. Přetečení na mobilu
- `akademie/overit/index.html:28` + `:42` (nové `@media`): stránka **Ověření certifikátu**
  byla na 360 px široká **525 px** (pole s ID a tlačítko „Ověřit" vyjely mimo obrazovku,
  šlo se posouvat do strany). Příčina: `input{flex:1}` bez `min-width:0`. Přidáno
  `min-width:0` a pod 480 px pole a tlačítko pod sebou, tlačítko 48 px vysoké. Ověřeno
  screenshotem, `scrollWidth` 360.

### 2. Dotykové cíle v hlavičce (466 stránek)
- Odkazy v hlavičce (`.topr a`: „← Zpět na Academy", „Odhlásit", „Nápověda", „Moje studium",
  „Napsat Martinovi") měly **19 až 21 px** na výšku. Na všech stránkách s touto hlavičkou je
  před `</head>` nový blok `<style id="a11y-fix">` s `.topr a{display:inline-block;padding:13px 0;margin:-13px 0}`.
  Výsledek: plocha pro prst **45 až 47 px**, vzhled hlavičky beze změny (výška `.top` změřena
  před i po: 112,6 px / 143,9 px / 68,6 px, totožné).
- Proč inline a ne `assets/ba-ui.css`: změna sdíleného CSS bez bumpu `?v=` by se k lidem
  dostala až po vypršení cache (30 dní) a bump je v zadání zakázaný.

### 3. Kontrast (WCAG AA), změřeno na renderu
- **`akademie/navod/index.html:24`**: tlačítko **„Otevřít přihlášení →"** mělo kontrast
  **1,73:1** (světlý text na zlaté). Inline `.cta{color:#1A1222}` přebíjelo `.ba a{color:inherit}`
  z `ba-ui.css` (vyšší specificita). Selektor rozšířen na `.cta,.ba .cta`. Teď tmavý text na zlaté.
- **Patička `.foot`** v tmavém motivu: `#6f665d` na `#0c0b0a` = **3,50:1** (moje, studium,
  videa, test, cviky, check-in...). V bloku `a11y-fix` přepsány proměnné jen pro tmavý motiv:
  `--foot:#8a8078` (5,09:1), `--foot-link:#a89e94`. Světlý motiv nedotčen (tam bylo v pořádku).
- `akademie/praxe/index.html:35`: nápověda v tisknutelných listech `.doc .hint` `#8a8276` na bílé
  = 3,79:1 → `#6b645c`.
- `akademie/videokurz/kalkulacka/index.html:22` `.crumb` `#a89c8c` na `#f6f1ea` = **2,40:1** →
  `#6f655a` (5,07:1); `:45` odkaz „modulech videokurzu" `#c45e00` = 3,78:1 → `#a34e00` (5,12:1).

### 4. Popisky formulářů (čtečka obrazovky, klik na popisek zaměří pole)
Vizuální texty beze změny, jen napojení `<label for>` nebo `aria-label`:
- `akademie/check-in/index.html:64-119`: váha, pás, boky, vzkaz (`id` + `for`).
- `akademie/moje/check-in/index.html`: váha, dodržení plánu, co se povedlo, kde to drhne (`for`),
  tréninky „z" (`aria-label`).
- `akademie/klient/index.html:1058,1061`: pole průvodce reportem (`fNum`, `fText`) teď mají
  `<label for>`; `:199` textarea reference `aria-label`.
- `akademie/cviky/index.html:82-85`: hledání a tři filtry.
- `akademie/nastroje/{jidelnicek,kalkulacka,trenink,recepty,infografika,potraviny}/index.html`,
  `akademie/videokurz/recepty/index.html`: všechna pole generátorů (pohlaví, věk, váha, výška,
  aktivita, cíl, branding, logo, barva...). V `infografika` i dynamicky generovaná pole (`:156`, `:162`).
- `videokurz.html:596`: e-mail v bráně „volné lekce" (`aria-label`).

### 5. Viditelný fokus z klávesnice
- Do `a11y-fix` přidáno `a,button,summary,select,input,textarea,[role=button]:focus-visible{outline:2px solid #EBB12C}`.
  Platí jen pro ovládání klávesnicí, myš ani dotyk ho neukážou.
- Bez fokusu byly: pole formuláře „trenérský kit" na `akademie/index.html` (`.ac-kit input:focus{outline:none}`),
  `ghost` tlačítka na `videokurz.html` (Bootstrap `.btn:focus-visible{outline:0}`), pole přihlášení,
  hledání lekcí. Pro ty dva první případy je v jejich `a11y-fix` přesnější selektor. Po opravě
  `Tab` průchod 18 stránek: 0 prvků bez viditelného fokusu (kromě YouTube iframe).

### 6. iOS zoom při kliknutí do pole
- Pole měla **15,2 až 15,5 px**, iOS Safari při fokusu pod 16 px přiblíží celou stránku a uživatel
  musí zpět roztahovat. Na `prihlaseni`, `nove-heslo`, `cviky`, `studium` (hledání lekcí),
  všech generátorech `nastroje/*` a `videokurz/{kalkulacka,recepty}` je pod 768 px `font-size:16px`.
  Ověřeno: na těch stránkách není žádné pole větší než 16 px, které by se tím zmenšilo; přetečení 0.

### 7. Výkon (bezpečně)
- `videokurz.html:461` a dál, `akademie/index.html:512-514`: šest fotek proměn dostalo `width`/`height`
  (skutečné rozměry souborů). Byly už `loading="lazy"` a webp, ale bez rozměrů skákal layout při
  načtení (CLS). Styl `width:100%;height:auto` zůstává, rozměry dávají jen poměr stran.

### 8. Generátory stránek drží krok
- `akademie/_videokurz/build.js` (obě šablony) a `scripts/build-m20.js`: vložen stejný `a11y-fix`
  blok, aby ho přegenerování neodmazalo. Dry-run builderu ověřen proti `akademie/videokurz`.

## Návrhy pro majitele (neopraveno, mimo pravidla zadání)
1. **Cookie lišta** (`assets/analytics.js:244-277`): na mobilu tlačítka „Přijmout"/„Odmítnout"
   31 px, „Povolit jen statistiku" **18 px** na výšku. Oprava vyžaduje bump `?v=` u `analytics.js`.
2. **Přepínač motivu** (`assets/scroll-top.js:174,218`, `ba-ui.css:181`): 36×36 px, doporučeno 44.
   Opět jen s bumpem `?v=`.
3. **Barvu patičky opravit u zdroje** (`assets/ba-ui.css:13` `--foot`) při nejbližším bumpu `ba-ui.css`,
   pak lze inline `--foot` přepis z `a11y-fix` odebrat.
4. **Past `.ba a{color:inherit}`** (`assets/ba-ui.css:58`): každý odkaz-tlačítko stylovaný jen jednou
   třídou přijde o barvu textu (přesně tak vznikl nález v `navod`). Zvážit `:where(.ba) a`.
5. **„Vědecké zdroje (N)"** pod každou lekcí: rozbalovací `summary` má 20 px na výšku. Zvětšení
   paddingu změní vzhled patičky lekce, nechávám na rozhodnutí.
6. **Drobné písmo:** štítky „Nové" na landingu Academy 9,3 px, `NOVÉ` na `videokurz.html` 9,9 px,
   štítek „Koučink" v klientské sekci 9,6 px, odznaky v databázi cviků 10,6 px. Doporučeno min. 11 až 12 px.
7. **Pořadí nadpisů** (texty jsem neměnil): `videokurz.html` skáče h1→h5 a h2→h6, landing
   `akademie/` h2→h5, `akademie/studium/` h1→h3. Pro čtečky a SEO by stálo za to srovnat úrovně
   (vzhled lze zachovat třídou).
8. **Rozjetý builder videokurzu:** `akademie/_videokurz/build.js` generuje `academy-upsell.js?v=g3`,
   `scroll-top.js?v=g11`, `arena.css?v=a6`, živé stránky mají `g4`, `g13`, `a8`. Kdo builder
   pustí naostro, vrátí lidem staré verze. Sladit šablonu s živými stránkami (zakázané to bylo jen pro mě).
9. **Video:** YouTube iframe je `loading="lazy"`, ale na stránce videa je nad ohybem, takže se
   načte hned (~1 MB JS YouTube). Fasáda „náhled + play" by zrychlila první vykreslení na mobilu.
10. **`videokurz.html`** načítá celý `bootstrap.min.css` blokujícím způsobem. Do budoucna kandidát
    na odlehčení, teď by šlo o riskantní zásah.
11. **Admin** (`akademie/admin/`, mimo rozsah): na 360 px přetéká panel `#det` (698 px) a desítky
    polí nemají popisek. Martinův nástroj, ne zákaznický.

## Co je ověřené jen staticky nebo částečně
- **Přihlášené stavy** (obsah lekcí za paywallem, klientská sekce s daty, `moje/` s nároky,
  certifikát se jménem): Supabase byl v testu blokovaný, takže se renderovaly prázdné/nepřihlášené
  varianty. Fokus, popisky a kontrast v dynamicky vykreslených částech (průvodce reportem klienta,
  výsledky generátorů) jsou opravené v kódu, ale nebyly proklikané s daty.
- **YouTube přehrávač**: iframe se vejde (314 px na 360 px), samotné přehrávání neověřeno (blokované).
- **Mrtvé odkazy**: statická kontrola `href`/`src` proti souborům; jediný „nález" `/assets/cviky/`
  je dynamicky skládaná cesta (`id.jpg`), složka existuje. Externí odkazy (Stripe, YouTube) se nekontrolovaly.
- Blokující skripty v hlavičce: jen `ba-theme.js` / `theme-boot.js`, které musí být synchronní
  (jinak problikne opačný motiv). Ponecháno záměrně.
- Skutečný iPhone/Safari ani Android nebyl k dispozici; vše na Chromiu s mobilní emulací.

## Opravy po R1

### 0. Merge `origin/main`
- `git merge origin/main` (GEO větev: JSON-LD před `</head>` v lekcích). Konflikty v 6 volných lekcích
  `akademie/studium/{m1-l1,m1-l2,m1-l3,m2-l1,m3-l1,m6-l1}` vyřešené tak, že zůstal **oba bloky**:
  `<style id="a11y-fix">` i `<script type="application/ld+json">` z main. Kontrola: v každé právě
  jeden a11y blok, JSON-LD přítomen, žádné značky konfliktu v repu.
- `node scripts/geo-kontrola.mjs` → **VÝSLEDEK: 0 chyb** (0 varování), po merge i po všech opravách níže.

### 1. (S) Rozšířená plocha odkazů v hlavičce překrývala značku
- Potvrzeno měřením: na 360 px v `akademie/klient/` (jediná stránka, kde se hlavička zalomí na víc řádků)
  překrýval „Moje studium" značku o 421 px², „Napsat Martinovi" o 388 px², navíc o 41 px² logo `MB`
  a o 36 px² přepínač motivu (ten se zalomí pod odkazy do vlastní řady `.topr`).
- Oprava v bloku `a11y-fix` (všech 468 stránek + šablony obou generátorů):
  `@media(max-width:480px){.ba .top .in{row-gap:14px}.ba .topr{row-gap:14px}}`.
  Odkaz přesahuje svůj 19px řádek o 13 px nahoru i dolů, takže mezera mezi řadami musí být ≥ 13 px
  (dřív 8 px v `ba-ui.css:80` a 12 px v `.topr`). Dotyková plocha zůstává 45 až 47 px.
  `row-gap` působí jen na zalomené řady, takže stránky s hlavičkou v jedné řadě se nemění.
- Cena: zalomená hlavička na mobilu je o 6 px vyšší (`moje`: 112,6 → 118,6 px), v `klient`
  o 8 px (144 → 152 px, mezera k přepínači motivu). Na desktopu beze změny.
- Měřeno: průnik obdélníku každého `.topr a` se všemi odkazy, tlačítky, `.brand` a `.mark` v `.top`
  (mimo předky a potomky), plus výška < 44 px. **Všech 470 stránek** `akademie/*` (bez adminu),
  šířky **360 a 1366 px**, motiv **tmavý i světlý**: 0 průniků, 0 cílů pod 44 px.
  Navíc vzorek 24 typů stránek na 320 a 412 px: 0 průniků.

### 2. (S) `scripts/build-m20.js` přepisoval živé lekce modulu 20
- Ověřeno: výstup šablony se s živými lekcemi neshoduje (0 z 11). Živé lekce prošly později
  `apply-ba-theme` (odkaz Zpět v `.topr`, přepínač světlého motivu) a dalšími úpravami.
- Zvolena pojistka místo srovnávání šablony (srovnání by byl samostatný úkol s rizikem rozdílu v obsahu):
  - bez přepínače zapíše **jen lekce, které ještě neexistují**, existující vypíše jako přeskočené,
  - `--out <složka>` = suchý běh mimo živé soubory,
  - `--force` = vědomý přepis (v hlavičce skriptu je napsané, proč a kdy).
- Ověřeno nasucho: `node scripts/build-m20.js` → 0 zapsáno, 11 přeskočeno, `git status` lekcí m20 beze změny;
  `node scripts/build-m20.js --out <tmp>` → 11 souborů v tmp, porovnání s živými 0 z 11 (známý stav).
- Návrh pro majitele: kdo bude chtít modul 20 generovat dál, srovná nejdřív šablonu s živými lekcemi
  (porovnání `--out` výstupu proti `akademie/studium/m20-*`), teprve pak `--force`.

### Kontrola po opravách
- Celý průchod 470 stránek na 360 px: 0 chyb JS, 0 lokálních 404, 0 přetečení, 0 polí bez popisku
  (kromě úmyslně skrytého honeypotu `website`).
