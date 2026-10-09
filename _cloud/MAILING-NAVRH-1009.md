# Mailing: návrh pro víc platících (9. 10. 2026)

Větev `cloud/mailing-navrh-1009`. **Jen návrh: nic není nasazené, na Supabase, Resend ani appku se nesahalo, žádný mail neodešel.**
Všechny podklady jsou v `_cloud/mailing/`. Co je co, popisuje `_cloud/mailing/CTI-ME.md`.

## 0. Shrnutí

1. **Maily dnes prodávají Basic a slibují k němu videokurz, který Basic od 30. 9. nedostává.**
   - Web přešel 29. a 30. 9. na „VIP 499 hlavní, videokurz jen k VIP". Kód taky (`app-purchase-bridge`, `PRAVIDLO_BONUSU = 'vip-2026-09-30'`).
   - Šablony v repu (snímek živé DB z 23. 9.) mají prodejní tlačítko appky skoro všude na `plan=basic`. Zhruba v patnácti mailech slibují „videokurz k první platbě appky".
   - Kdo dnes koupí Basic podle mailu, videokurz nedostane. **To je oprava P0, ještě před jakoukoli novou tratí** (kap. 5.4).
2. **Kupci videokurzu VIP nenabízí žádný mail.** Appku dostanou jen jako Basic: `longtail-kupci/2`, milník `vk-30` a týdeník.
3. **Free uživatel appky dostane 4 maily zkušebkové tratě a pak už nic, co by ho vedlo k VIP.** Přitom podle pitvy z 3. 9. (komentář v `app-onboarding-hook`) je aktivace v appce jediné hrdlo, kde se o platbě rozhoduje: 58 registrací, 3 check-iny, 0 platících.
4. **Návrh: tři nové tratě, každá nejvýš 5 mailů, a všude jedno tlačítko na VIP.** Basic zůstává jako jedna věta, Free se nic nebere.

   | Pořadí | Trať | Pro koho | Mailů | Proč tohle pořadí |
   |---|---|---|---|---|
   | 1 | `vip-free` | Free uživatelé appky, kteří zapisují | 4 | nejteplejší lidé, data už v appce mají |
   | 2 | `vip-kupci` | majitelé videokurzu bez appky | 4 | už jednou zaplatili, VIP jim nikdo nenabídl |
   | 3 | `vip-leady` | leady bez nákupu na konci akvizice | 5 | největší skupina, nejsilnější argument (videokurz zdarma k VIP) |

5. **Technicky žádná nová tabulka.** Potřeba je:
   - 13 řádků v `email_templates`;
   - mosty v `app_config.navazujici_trate`;
   - dvě SQL funkce na zápis stávajících lidí a jejich návrat na původní trať;
   - malý patch `drip-send`: stop pravidla, brána „jen kdo zapisuje" a oprava win-backu koučinku. Testy zelené.
6. **Před spuštěním je nutné pustit kontroly proti živé DB** (`00-kontroly-pred-spustenim.sql`, jen čtení). Návrh vznikl jen z repa a repo je u šablon o kus pozadu.
7. **Termín: 26. až 30. 10.** Na ty dny jsou kvůli Bali odložené prodejní maily koučinku. Mezi nimi je nabídka koučinku studeným leadům a bývalým klientům (díry D8 a D9). **Rozhodnout do 25. 10.**

## 1. Z čeho to vychází a čemu věřit

- **Zdroj je jen repo.** Na živou DB se nesahalo. Nejčerstvější přepis živých šablon je `akademie/_supabase/ceny-sablony-2026-09-23.sql`. Je to SELECT z produkce z 23. 9., jenže obsahuje jen 55 šablon s cenou a nemá `wait_days`.
- Starší SQL soubory (`drip-templates.sql`, `longtail-sequences.sql`, `upsell-sequences.sql`) jsou podle vlastních hlaviček **historické a pozadu**. Čísla kroků se od nich živě liší.
- **Co v repu chybí úplně:**
  - živá hodnota `navazujici_trate`;
  - texty `tc-zkusebka`, `upsell-coaching`, `evergreen-kupci` a části `longtail-*`;
  - SQL `tc_kosik_zapis` a přesun do `academy-vk-serie`.
- **Commity po 30. 9. sahaly jen na web a `app-purchase-bridge`, na šablony ne.** Jestli se šablony mezitím upravily přes MCP, ukáže dotaz 2 v `00-kontroly-pred-spustenim.sql`.
- **Ověřeno lokálně:**
  - generátor šablon prošel kontrolami: žádná cena číslem, žádná dlouhá pomlčka, jedno tlačítko s UTM, jen proměnné, které engine zná;
  - všechny SQL soubory proběhly na prázdné maketě v PostgreSQL 16;
  - scénář zápisu a návratu sedí na 11 smyšlených leadech (kap. 7.3);
  - testy patche jsou zelené: `pravidla` 118, `aktivace` 14, `preskoc` 21 kontrol;
  - `deno check` hlásí jen chybu TS2589, která je v repu i bez patche.

## 2. Mapa: co dnes kdo dostane

Den je počítaný od vstupu do tratě podle `wait_days`. Kde je otazník, údaj v repu není. **P** = prodejní mail, **H** = hodnota nebo obsah.

### 2.1 Nový lead z webu (makro-plán, forma zpět, kalkulačka)

| Trať | Krok | Den | Předmět (zkráceně) | Cíl | CTA |
|---|---|---|---|---|---|
| lead-magnet | 0 | 0 | Tady máš svůj plán | doručení PDF | PDF |
| | 1 | 2 | Chyba č. 1… | H | PDF 7 chyb |
| | 2 | 4 | Jak jíst řízek a pizzu… | H, ochutnávka | volné lekce videokurzu |
| | 3 | 6 | Chceš to celé…? | P videokurz | Stripe videokurz |
| | 4 | 9 | sleva 15 % ZACNI15 | P videokurz | Stripe |
| | 5 | 14 | poslední šance 20 % JESTE20 | P videokurz | Stripe |
| | 6–14 | ~19–130 | hodnotový ocas (spánek, kroky…) | H | blog, konzultace |
| | 7 | ? | Academy nabídka (k 16. 7.) | P Academy | /akademie/ |
| | **9** | ? | **Cíle, jídelníček i trénink za {{cena_basic_mesic}} Kč** | **P appka** | **`plan=basic`**, slib videokurzu |
| nurture-videokurz (cron 7:35) | 0–7 | po 7 dnech | bílkovina, vážení, ZACNI15, průměr, snídaně, spánek, JESTE20, close | H a P videokurz | /videokurz, Stripe |
| | **8** | ~56 | **nv-8-basic249** | **P appka** | **`plan=basic`**, slib videokurzu |
| | 9 | ? | balíček receptů | P balíček | /recepty-a-odpovedi |
| longtail-consumer (cron 7:50) | 0–12 | po 14 dnech | víkendy, cheat day, jojo, kroky… | H | blog, kalkulačka |
| | **5** | ~70 | **lc-11-basic249** | **P appka** | **`plan=basic`** |
| | **11** | ~154 | Napíšu ti to narovinu | **P koučink** (odloženo na 26.–30. 10.) | /koucing/ |
| | 12 | ~168 | lt-balicek | P balíček | |
| evergreen-consumer | 0–5 | po 30 dnech | kvíz, kalkulačka, bílkoviny, spánek, check-in, víkendy | H | P.S. videokurz / koučink |

**Další vstupy:**
- **Kvíz:** `kviz-<profil>/0` doručí plán, zmíní appku a slíbí „k první platbě za Basic videokurz". Den 1 přijde `kviz-<profil>/1` s nabídkou **Basic**. Od kroku 2 pokračuje `lead-magnet`.
- **`lead-magnet-tool`** (generátory): 3 maily, pak longtail.
- **`nurture-pro-vas`**: 3 maily (Academy), pak longtail.
- **`trener-kit`**: kit, pak Academy. V kroku 0 slibuje „check-in v Basicu, videokurz k první platbě appky".
- **`tc-magnet`** (jídelníček z reklamy): kroky 2 a 4 vedou na Basic. Krok 4 navíc píše o VIP „s ním nezačínej".

### 2.2 Kupec videokurzu

| Trať | Krok | Den | Předmět | Cíl | CTA |
|---|---|---|---|---|---|
| onboarding-nakup-videokurz | 0 | 0 | Tvůj videokurz je připravený | doručení | registrace |
| | 1 | 5 | tipy | H | |
| | 2 | 19 | Hodina se mnou za zvýhodněnou cenu | P konzultace | Stripe konzultace |
| milníky (mimo frontu) | vk-30 / 50 / 100 | podle lekcí | 55 lekcí / půlka / hotovo | H | **vk-30: odkaz `plan=basic`** |
| upsell-academy (≥73 lekcí, cron 7:10) | 1, 4 | ? | Kam dál? / Videokurz neplatíš podruhé | P Academy | Stripe upgrade |
| upsell-coaching (cron 7:20) | 0–4 | ? | koučink | P koučink (část odložena na 26.–30. 10.) | |
| longtail-kupci (cron 7:50) | **2** | ~45 | **Teorii znáš. Kdo to dělá každý den?** | **P appka** | **`plan=basic`** |
| | 5 | ~108 | koučink | P koučink (odloženo) | |
| evergreen-kupci | ? | | připomínky kurzu | H, P.S. appka | text v repu není |
| academy-vk-serie (dočasná) | 0–2 | | Academy | P Academy | |

**VIP se kupci videokurzu nenabízí nikde.** VIP zmiňují jen Academy maily, a to jako „rok VIP v ceně doživotní Academy".

### 2.3 Člen Academy

| Trať | Krok | Den | Předmět | Cíl |
|---|---|---|---|---|
| onboarding-nakup-academy | 0, 1, 2 | 0, 2, 7 | Vítej, prohlídka, maximum | doručení (appka VIP na rok v ceně) |
| onboarding-nakup-academy-mesicni | 0, 1 | 0, 75 | Vítej / Tři měsíce máš zaplacené, odečtu je | doručení, P doživotní Academy |
| upsell-coaching, evergreen-consumer | | | | P koučink, H |
| **milník vk-30, týdeník/2** | | | **nabídka Basicu** | **člověk, který má VIP, dostane nabídku Basicu** |

### 2.4 Free uživatel appky

| Trať | Krok | Den | Předmět | Cíl | CTA |
|---|---|---|---|---|---|
| tc-zkusebka (každá registrace) | 0–3 | ? | texty v repu nejsou | aktivace podle zápisu | ? |
| (most, pravděpodobně) | | | | longtail-consumer, neaktivní do pauzy | |
| tc-free (jen starší běhy, noví od 20. 8. nepadají) | 2, 4, 5, 7, **8** | | rychlost zápisu, generátory, check-in, závěr, **winback** | P | **Basic**; jen krok 6 (AI kouč) je VIP |
| tc-start (dotazník /start) | 0, 1, **2** | 0, 2, ? | Tvoje čísla / Co umí Basic / **basic249** | P | **Basic** („Začni ale Basicem") |
| tc-kosik (opuštěná pokladna) | 0 | | Zastavilo tě něco u předplatného? | P | **Basic** |
| onboarding-nakup-tvujcoach (zaplatil) | 0–3 | | | doručení, P konzultace | krok 1 zdůvodňuje slevu „máš k první platbě videokurz", u Basicu už neplatí |

## 3. Díry

| # | Závažnost | Díra | Kde | Dopad |
|---|---|---|---|---|
| D1 | **P0** | Slib videokurzu „k první platbě appky" nebo k Basicu, který od 30. 9. neplatí | kviz-*/0 a /1, lm-9, nv-8, longtail-consumer/5, tc-start/2, tc-free/2, /4, /6, /7, /8, tc-magnet/2 a /4, tc-kosik/0, trener-kit/0, tydenik/3, onboarding-nakup-tvujcoach/1 (zdůvodnění slevy) | Kupec Basicu kurz nedostane: reklamace a důvěra. Chyba na naší straně, ne u zákazníka. |
| D2 | **P0** | CTA vede na Basic místo VIP | lm-9, nv-8, longtail-consumer/5, tc-start/1 a /2, tc-free/4, /5, /8, tc-magnet/2 a /4, tc-foods/2, tc-kosik/0, kviz-*/1, longtail-kupci/2, milestone vk-30, tydenik/2, blast-tc-kviz, newsletter (`scripts/clanek-do-mailu.mjs`, `NABIDKY.appka.url`) | Hlavní nabídka (A) se v mailech skoro neukazuje. |
| D3 | P1 | tc-magnet/4 přímo zrazuje od VIP („s ním nezačínej"). VIP tam navíc popisuje jako písemný rozbor co 14 dní, což je tarif Kontrola, ne VIP. | tc-magnet/4 | Nepravdivý popis produktu a odrazování od hlavní nabídky. |
| D4 | P1 | Kupci videokurzu se VIP nenabízí nikde, jen Basic | longtail-kupci/2, vk-30, týdeník | Nejteplejší neplatící skupina appky nezná hlavní nabídku. |
| D5 | P1 | Free uživatel po `tc-zkusebka` nedostane žádný upgrade mail na VIP | konec tc-zkusebka | Hrdlo „registrace → platba" je bez mailu. |
| D6 | P2 | Člen Academy (má VIP v ceně) dostává nabídku Basicu | milestone vk-30 (posílá i Academy), tydenik/2 | Matoucí, působí to nedbale. |
| D7 | P2, **rozhodnutí** | Nabídky se perou: akvizice prodává videokurz se slevou 15 a 20 % a o pár týdnů později nabídne VIP s týmž kurzem zdarma | lead-magnet 3–5, nurture-videokurz 2 a 6, pak VIP | Kdo kurz koupil se slevou, se dočte, že ho mohl mít „zdarma". Racionální čtenář s nákupem počká. |
| D8 | **P1, termín** | Bývalí klienti koučinku dostávají v longtailu nabídku koučinku (win-back), pravidlo hlídá jen `upsell-coaching` | longtail-kupci/5, longtail-consumer/11, P.S. v evergreen-consumer/4 | Porušení pravidla „bývalým klientům žádný win-back". Kroky jsou odložené na **26. až 30. 10.** |
| D9 | **P1, termín** | Koučink se nabízí studeným lidem: longtail-consumer je z definice trať pro lidi bez nákupu | longtail-consumer/11 (odloženo na 26. až 30. 10.) | Proti zadání „koučink jen teplým lidem". |
| D10 | P2 | Odhlášený nebo neaktivní Free uživatel na konci tc-* skončí v `paused`, a tím vypadne i z newsletteru | `mostBlokujeNeaktivitu` | Tichý únik lidí z listu. Dnešní chování, zmiňuju ho kvůli `vip-free`. |
| D11 | P2, ověřit | `preskoc.ts` přeskakuje `onboarding-nakup-balicek/2`, ve snímku je ale `balicek-2-videokurz` na **kroku 1** | preskoc.ts:23 vs ceny-sablony | Majitel videokurzu, který koupí balíček, dostane nabídku videokurzu. |
| D12 | P3 | `kviz-*` nemá stop pravidlo, krok 1 (nabídka) dostane i kupec | pravidla.ts | Drobnost, krok 1 jde den po vstupu. |
| D13 | P3 | `grant-videokurz-z-appky` zná tier jen `basic` a `ai_basic`, u `ai_kontrola` napíše obecné „máš předplatné" | grant-videokurz-z-appky/core.ts | Kosmetika. |
| D14 | P3 | `utm_content` v tc-free nesedí na čísla kroků (krok 5 má `a4-checkin`, krok 6 `a4`) | tc-free | Zkresluje čtení kliků (ty ale stejně nejsou severka). |

## 4. Strategie (jak se nabídky nepřou)

- **Jedna hlavní nabídka: VIP** (`tvujcoach.cz/koupit?plan=vip`).
  - Basic je jedna věta v textu (B), nikdy tlačítko.
  - Free se nikde nebere ani neomezuje. Naopak se opakuje, že zůstává.
- **Videokurz jako dárek jen u VIP**, a jen tam, kde ho člověk nemá. `vip-kupci` dárek vůbec nezmiňuje.
- **Koučink jen teplým:** v nových tratích není vůbec. Zůstává v `upsell-coaching` (kupci a členové) a v onboardingu videokurzu (konzultace). Bývalí klienti nedostanou nabídku koučinku nikde (patch, kap. 7.2).
- **Pořadí po nákupu videokurzu:** onboarding (konzultace) → `vip-kupci` → upsell crony (Academy pro studenty s ≥73 lekcemi, koučink) → longtail.
  - Tím se VIP a Academy časově nepotkají: `upsell-*` crony berou jen lidi bez běžící trati.
  - **Rozhodnutí pro Martina:** jestli má VIP jít až po upsellu koučinku (kap. 8, otázka 3).
- **Trať jen jednou:**
  - most se sám zruší, když člověk v cílové trati už byl (`email_events.detail.track`);
  - zápis stávajících lidí navíc dává každému nejvýš **jednu** VIP sérii.
- **Žádné dva maily po sobě:**
  - most čeká 3 až 7 dní;
  - zápis stávajících bere jen lidi bez mailu v posledních 3 dnech;
  - longtail se po VIP sérii vrátí s odstupem aspoň 3 dny.
- **Měří se na penězích** (CLAUDE.md, 25. 7.): první platba VIP do 30 dní od vstupu do tratě. Proklik ani otevření se nevyhodnocují (kap. 9).

## 5. Návrh tratí

Společné pro všechny tři:
- Tratě patří mezi follow-upy, takže jedou jen při `followups_enabled = 'true'`.
- Patička s odhlášením jedním klikem a hlavička `List-Unsubscribe` se přidávají ke každému mailu automaticky (`app_config.footer_html`, `drip-send`).
- **Kdo zaplatí v appce (VIP i Basic), toho `app-onboarding-hook` okamžitě přepne do `onboarding-nakup-tvujcoach`, a tím z VIP tratě vypadne.**
- **Výstup:** poslední krok má `wait_days null`. Dojetého člověka sebere `enroll_into_longtail` (7:50) a pošle ho tam, kam by šel i bez VIP série. Kdo přišel z longtailu, vrátí se na svůj krok (funkce `vip_vrat_na_puvodni_trat`). Na otázku „a co potom?" je tedy odpověď u všech tří.

### 5.1 Trať 1: `vip-free` (Free uživatelé appky, kteří zapisují)

- **Vstup:**
  - most z konce `tc-zkusebka` a `tc-free`, 3 dny po posledním mailu;
  - stávající lidé přes `vip_zapis_backlog('vip-free')`: kdo prošel `tc-zkusebka` nebo `tc-free`.
- **Brána:** každý krok jen tomu, kdo v appce zapisuje (`jen_kdyz_zapsal`, signál `aktivace-stav` z appky). Kdo nezapisuje, čeká až 7 dní. Když nezačne, trať se pozastaví bez mailu.
- **Nesmí dostat:**
  - člen Academy (VIP má v ceně);
  - aktivní klient koučinku;
  - kdo kdy v appce platil;
  - kdo už `vip-free` měl;
  - odhlášení a bounce.
- **Načasování:** den 0, 3, 7, 11.
- **CTA:** `tvujcoach.cz/client/subscription?plan=vip` (přihlášený uživatel). ⚠️ `plan=vip` na téhle adrese je potřeba ověřit v appce (kap. 8).

| Krok | Den | Téma | CTA |
|---|---|---|---|
| 0 | 0 | Zapisuješ, ať s tím appka něco udělá (přepočet + AI kouč + dárek) | Přejít na VIP |
| 1 | 3 | Foto a hlas: zápis za pět vteřin | Vyzkoušet VIP |
| 2 | 7 | AI kouč ve dvě ráno | Napsat AI koučovi ve VIP |
| 3 | 11 | Free, Basic, nebo VIP? Shrnutí, roční VIP | Vybrat VIP |

### 5.2 Trať 2: `vip-kupci` (majitelé videokurzu bez appky)

- **Vstup:**
  - most z konce `onboarding-nakup-videokurz` a `onboarding-grant-videokurz`, 7 dní po posledním mailu (konzultace);
  - stávající kupci přes `vip_zapis_backlog('vip-kupci')`: dojetí nebo lidé v `longtail-kupci` a `evergreen-kupci` s dalším mailem nejdřív za 7 dní.
- **Nesmí dostat:**
  - člen Academy;
  - aktivní klient koučinku (bývalý klient smí, appka není win-back);
  - kdo kdy platil appku;
  - kdo trať už měl;
  - kdo dostal jinou VIP sérii (u zápisu stávajících);
  - odhlášení a bounce.
- **Načasování:** den 0, 4, 8, 13. **CTA:** `tvujcoach.cz/koupit?plan=vip`.
- **Dárek se tu nezmiňuje.** Kurz už mají a slib „zdarma k VIP" by u nich zbytečně otevíral otázku „proč jsem za něj platil".

| Krok | Den | Téma | CTA |
|---|---|---|---|
| 0 | 0 | Kurz máš v hlavě, kdo ti to spočítá v pondělí | Chci VIP |
| 1 | 4 | Kolik ti zbývá: 400 kcal, oběd venku, hlas | Vyzkoušet VIP |
| 2 | 8 | Basic, nebo VIP narovinu + roční VIP s měsícem Academy | Chci VIP |
| 3 | 13 | Poslední mail o appce z téhle řady | Vzít VIP |

### 5.3 Trať 3: `vip-leady` (leady bez nákupu na konci akvizice)

- **Vstup:**
  - most z konce `nurture-videokurz` (tam končí lead-magnet i existing-leadmagnet), `lead-magnet-tool` a `nurture-pro-vas`, 4 dny po posledním mailu;
  - stávající lidé přes `vip_zapis_backlog('vip-leady')`: dojetí nebo lidé v `longtail-consumer` a `evergreen-consumer` s dalším mailem nejdřív za 7 dní.
- **Nesmí dostat:**
  - kdo vlastní videokurz (patří do `vip-kupci`), Academy nebo koučink;
  - uživatel appky (patří do `vip-free`);
  - kdo trať už měl;
  - kdo kdy platil appku;
  - odhlášení a bounce.
- **Načasování:** den 0, 3, 6, 10, 14. **CTA:** `tvujcoach.cz/koupit?plan=vip`.
- **Pozor na souběh s opravou P0:** kdo projde `lead-magnet/9` a `nurture-videokurz/8` po opravě, dostane VIP nabídku i tam. Doporučení je v kap. 5.4.

| Krok | Den | Téma | CTA |
|---|---|---|---|
| 0 | 0 | Plán máš, kdo ti ho bude upravovat (+ dárek) | Chci VIP |
| 1 | 3 | Zbývá ti 400 kcal / oběd venku | Vyzkoušet VIP |
| 2 | 6 | Proč k VIP přidávám celý videokurz | Chci VIP i s videokurzem |
| 3 | 10 | Tři námitky (zápis, předplatné, „co když to nevydržím") | Vzít VIP |
| 4 | 14 | Poslední mail z téhle řady, roční VIP | Vybrat VIP |

### 5.4 Oprava P0 (existující šablony)

**a) Rodina „basic249" (4 kroky se stejným tělem): hotové SQL `03-oprava-basic249-na-vip.sql`.**
- Týká se kroků `lead-magnet/9`, `longtail-consumer/5`, `nurture-videokurz/8` a `tc-start/2`.
- Tlačítko vede na VIP, dárek se váže k VIP, Basic zůstává jen v P.S.
- `wait_days` se nemění. Zámek na původní `key` zajistí, že když šablonu mezitím někdo upravil, SQL nic nezmění.
- ⚠️ **UPDATE šablony je rozeslání** (drip běží každou hodinu), proto až po Martinově schválení textu.
- Po spuštění `vip-leady` doporučuju `lead-magnet/9` a `nurture-videokurz/8` převést na obsahový mail bez nabídky. Celou VIP nabídku pak nese `vip-leady` a člověk ji nedostane dvakrát.

**b) Ostatní (texty v repu jsou jen u části). Ruční úprava po přečtení živého znění:**

| Šablona | Co změnit |
|---|---|
| tc-free/2, /4, /6, /7, tc-magnet/2, kviz-*/0, trener-kit/0, tydenik/3 | věta „k první platbě appky / Tvůj Coach / za Basic videokurz" → „k první platbě **VIP** videokurz". tydenik/3 „klidně k měsíci za Basic" smazat. |
| tc-free/8 (winback), tc-kosik/0, kviz-*/1, tc-foods/2, tc-start/1 | tlačítko `plan=basic` → `plan=vip`, text tlačítka „Vzít VIP za {{cena_vip_mesic}} Kč", odstavec o Basicu přepsat na VIP (AI kouč, foto, hlas + dárek). Basic jen jednou větou. tc-kosik: „Basic je nejlevnější placený plán" → začít VIP. |
| tc-magnet/4 | smazat „Je tam ještě jeden stupeň… s ním nezačínej", odrážku VIP nechat (je správně), tlačítko `?plan=basic` → `koupit?plan=vip`. |
| longtail-kupci/2, milestone vk-30 | `plan=basic` → `koupit?plan=vip`, text podle `vip-kupci/0` (bez dárku, kurz už mají). U vk-30 přidat výjimku pro členy Academy, nebo odkaz smazat (VIP mají). |
| tydenik/2 | už odešlo, opravit jen kvůli archivu a admin náhledu. |
| tc-trial-nabidka/0, blast-tc-kviz | jednorázovky, které už odešly. Neopravovat, jen archivovat. |
| onboarding-nakup-tvujcoach/1 | zdůvodnění slevy na konzultaci „máš k první platbě videokurz" platí jen u VIP. U Basicu větu vynechat (rozvětvit podle tieru, nebo přeformulovat obecně). |
| `scripts/clanek-do-mailu.mjs` (`NABIDKY.appka`) | `url` `?plan=basic` → `https://tvujcoach.cz/koupit?plan=vip`, popis „Basic, nejlevnější placený plán" → VIP. Pak přegenerovat frontu newsletteru. |

## 6. Texty

Všech 13 nových mailů a jednotné znění opravy P0. Každý mail má dva předměty (A jde do DB, B je pro ruční A/B), náhledový text, tělo a jedno tlačítko s UTM.
- **Náhledy** v tmavém obalu přesně podle `drip-send`: `_cloud/mailing/nahledy/index.html`.
- **Ceny jsou jen proměnné:** `{{cena_vip_mesic}}`, `{{cena_vip_rok}}`, `{{cena_basic_mesic}}`, `{{course_price}}`.
- **Gender tokeny:** `[a]` je ženská koncovka, engine ji dosadí podle segmentu.
- **Texty jsou návrh.** Šéf je projede hlasem Martina (`HLAS-MARTINA.md`) a finální znění schvaluje Martin.
- **A/B předmětů:** engine A/B neumí. Při dnešních objemech (desítky lidí týdně na trať) by rozdíl v platbách stejně nebyl měřitelný. Doporučuju vybrat předmět hlasem a variantu B držet jako zálohu na výměnu po měsíci, když trať neprodá.

<!-- TEXTY:START (generuje _cloud/mailing/generuj.cjs ze sablony.cjs, ručně neupravovat) -->
### 6.1 vip-free

#### vip-free · krok 0 · den 0 · `vf-1-zapisujes`

- **Předmět A:** Zapisuješ. Teď ať s tím appka něco udělá
- **Předmět B:** Tvoje zápisy umí víc, než ti teď ukazují
- **Náhledový text:** Co se ve VIP stane s daty, která v appce už máš.
- **CTA:** „Přejít na VIP za {{cena_vip_mesic}} Kč" → `https://tvujcoach.cz/client/subscription?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-free&utm_content=vf-1`
- **Čeká po odeslání:** 3 dny

> Ahoj{{fn_space}},
>
> v appce už nějaký čas zapisuješ. To je ta těžší půlka a máš ji za sebou.
>
> Druhá půlka je vědět, co s čísly udělat. Check-in si ve Free vyplníš a rozbor uvidíš. Ve **VIP** podle něj appka přepočítá kalorie a makra na další týden, podle toho, co jsi opravdu snědl, a podle toho, jak se hnula váha.
>
> K tomu AI kouč, který tvoje zápisy vidí. Napíšeš mu „proč mi appka zvedla sacharidy?“ a odpoví nad tvými čísly. Čísla počítá engine, AI ti je vysvětlí.
>
> 🎁 K první platbě VIP ti přidám svůj videokurz výživy: 182 videí, hodnota {{course_price}} Kč. Zůstane ti, i když předplatné zrušíš.
>
> **[ Přejít na VIP za {{cena_vip_mesic}} Kč ]**
>
> Zrušíš kdykoli v Profilu. Když ti to do 14 dnů nesedne, vrátím ti peníze.
>
> **Be Effective!** Martin
>
> P.S. Free ti zůstává napořád. Nic z toho, co teď v appce používáš, ti nevezmu.

#### vip-free · krok 1 · den 3 · `vf-2-foto-hlas`

- **Předmět A:** Zapsat oběd za pět vteřin
- **Předmět B:** Vyfoť talíř. Makra spočítá appka
- **Náhledový text:** Foto a hlas ve VIP: zápis, který tě nezdrží.
- **CTA:** „Vyzkoušet VIP" → `https://tvujcoach.cz/client/subscription?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-free&utm_content=vf-2`
- **Čeká po odeslání:** 4 dny

> Ahoj{{fn_space}},
>
> za třináct let s klienty vidím pořád totéž: kdo zápis vzdá, vzdá ho většinou proto, že ho zdržuje.
>
> Proto jsou ve VIP dvě zkratky:
>
> - **Foto jídla.** Vyfotíš talíř, klidně domácí kuchyni bez obalu. AI pozná i víc jídel na jedné fotce a odhadne kalorie a makra. Odhad vidíš a opravíš, než se zapíše.
> - **Zápis hlasem.** Řekneš „rohlík, tvaroh dvě stě gramů a tři deci vody“ a appka větu rozebere. Potvrdíš, nebo opravíš.
>
> Snídani, kterou máš pětkrát týdně, zapíšeš i ve Free jedním ťuknutím ze šablony. Foto a hlas ti ušetří čas u všeho ostatního.
>
> **[ Vyzkoušet VIP ]**
>
> **Be Effective!** Martin
>
> P.S. K první platbě VIP dostaneš i videokurz výživy zdarma.

#### vip-free · krok 2 · den 7 · `vf-3-ai-kouc`

- **Předmět A:** Zeptej se ve dvě ráno
- **Předmět B:** Kouč, který vidí tvoje čísla
- **Náhledový text:** AI kouč ve VIP odpovídá podle mojí metodiky a jídlo zapíše za tebe.
- **CTA:** „Napsat AI koučovi ve VIP" → `https://tvujcoach.cz/client/subscription?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-free&utm_content=vf-3`
- **Čeká po odeslání:** 4 dny

> Ahoj{{fn_space}},
>
> otázky, které mi klienti léta posílají na WhatsApp, se opakují:
>
> - „Váha se týden nehýbe. Mám ubrat?“
> - „Po tréninku mi zbývá 300 kcal. Co si dám?“
> - „Jsem na oslavě. Jak to zapsat, ať si nezkazím týden?“
>
> Ve VIP na ně odpovídá AI kouč. Vidí tvoje zápisy i vývoj váhy a odpovídá podle metodiky, se kterou pracuju s klienty od roku 2013. Když mu napíšeš, co jsi snědl, rovnou to zapíše.
>
> Kalorie a makra počítá engine. AI ti je vysvětlí a pomůže s rozhodnutím na dnešek.
>
> **[ Napsat AI koučovi ve VIP ]**
>
> **Be Effective!** Martin
>
> P.S. Basic za {{cena_basic_mesic}} Kč umí přepočet cílů a generátory, AI kouče, foto ani hlas ale nemá. Proto ti doporučuju VIP.

#### vip-free · krok 3 · den 11 · `vf-4-shrnuti`

- **Předmět A:** Free, Basic, nebo VIP? Shrnutí na jednu obrazovku
- **Předmět B:** Poslední mail o předplatném z téhle řady
- **Náhledový text:** Ať se rozhodneš v klidu. Free ti zůstává tak jako tak.
- **CTA:** „Vybrat VIP" → `https://tvujcoach.cz/client/subscription?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-free&utm_content=vf-4`
- **Čeká po odeslání:** nic, konec trati

> Ahoj{{fn_space}},
>
> tohle je poslední mail o předplatném z téhle řady. Shrnu ti to na jednu obrazovku:
>
> - **Free (zdarma, napořád):** zápis jídla i tréninku, skener čárových kódů, přes {{pocet_potravin}} potravin, šablony a 14 dní historie.
> - **Basic ({{cena_basic_mesic}} Kč měsíčně):** navíc týdenní přepočet kalorií a maker, generátor jídelníčku i tréninku a celá historie.
> - **VIP ({{cena_vip_mesic}} Kč měsíčně):** všechno z Basicu, k tomu AI kouč, foto jídla a zápis hlasem. A k první platbě videokurz výživy zdarma.
>
> Když víš, že do toho jdeš na delší dobu, roční VIP vyjde na {{cena_vip_rok}} Kč, tedy dva měsíce zdarma. K ročnímu VIP navíc přidávám měsíc Barna Academy na zkoušku.
>
> **[ Vybrat VIP ]**
>
> Zrušíš kdykoli v Profilu, zaplacené období doběhne a dál se nic nestrhne. Do 14 dnů od začátku ti vrátím celou částku, když ti to nesedne.
>
> A když zůstaneš ve Free, taky dobře. Zapisuj dál, to je půlka práce.
>
> **Be Effective!** Martin
>
> P.S. Jestli tě od předplatného něco drží, odpověz mi jednou větou na tenhle mail. Čtu to sám.

### 6.2 vip-kupci

#### vip-kupci · krok 0 · den 0 · `vk-1-v-pondeli`

- **Předmět A:** Kurz máš v hlavě. Kdo ti to spočítá v pondělí?
- **Předmět B:** Z videokurzu do praxe za minutu denně
- **Náhledový text:** Appka Tvůj Coach dělá s tvými čísly to, co učím ve videokurzu.
- **CTA:** „Chci VIP za {{cena_vip_mesic}} Kč měsíčně" → `https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-kupci&utm_content=vk-1`
- **Čeká po odeslání:** 4 dny

> Ahoj{{fn_space}},
>
> ve videokurzu jsi viděl, jak počítám kalorie a makra a proč mě zajímá vývoj váhy za týdny víc než jedno ranní vážení.
>
> V praxi to znamená každý týden sečíst, co jsi snědl, porovnat to s váhou a rozhodnout, jestli ubrat, přidat, nebo vydržet. Tohle za tebe dělá appka **Tvůj Coach**.
>
> Ve **VIP** ti z tvých zápisů každý týden přepočítá kalorie a makra a poskládá jídelníček z běžných potravin i trénink podle toho, kde cvičíš. AI kouč ti odpoví na otázky podle stejné metodiky, jakou znáš z kurzu.
>
> **[ Chci VIP za {{cena_vip_mesic}} Kč měsíčně ]**
>
> Zrušíš kdykoli v appce. Když ti to do 14 dnů nesedne, vrátím ti peníze.
>
> **Be Effective!** Martin
>
> P.S. Zápis jídla i tréninku máš v appce zdarma napořád. Registruj se ideálně stejným e-mailem, jaký máš u videokurzu.

#### vip-kupci · krok 1 · den 4 · `vk-2-zbyva`

- **Předmět A:** Kolik ti dneska ještě zbývá{{fn_suffix}}?
- **Předmět B:** Vyfoť oběd. Zbytek spočítá appka
- **Náhledový text:** Tři situace, kde ti VIP ušetří nejvíc času.
- **CTA:** „Vyzkoušet VIP" → `https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-kupci&utm_content=vk-2`
- **Čeká po odeslání:** 4 dny

> Ahoj{{fn_space}},
>
> z praxe vím, že přesnost zápisu rozhoduje víc než dokonale vyladěná makra. Lidi svůj příjem běžně podceňují o 20 až 50 %. Ve VIP na to máš tři zkratky:
>
> - **Večer ti zbývá 400 kcal.** Zeptáš se AI kouče, co si dát, a on ti to rovnou zapíše.
> - **Oběd venku bez obalu.** Vyfotíš talíř, AI odhadne jídla i makra a ty odhad před zápisem zkontroluješ.
> - **Nechce se ti ťukat.** Řekneš „rohlík, tvaroh dvě stě gramů“ a appka to rozebere sama.
>
> **[ Vyzkoušet VIP ]**
>
> **Be Effective!** Martin
>
> P.S. Teorii z kurzu máš. Appka ti pomůže udělat z ní zvyk.

#### vip-kupci · krok 2 · den 8 · `vk-3-basic-nebo-vip`

- **Předmět A:** Basic, nebo VIP? Napíšu ti to narovinu
- **Předmět B:** Proč ti doporučuju dražší plán
- **Náhledový text:** Rozdíl je v tom, kdo ti odpoví, když nevíš.
- **CTA:** „Chci VIP" → `https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-kupci&utm_content=vk-3`
- **Čeká po odeslání:** 5 dní

> Ahoj{{fn_space}},
>
> v appce jsou dva placené plány a chci, abys věděl, proč ti doporučuju ten dražší.
>
> **Basic** za {{cena_basic_mesic}} Kč měsíčně ti každý týden přepočítá cíle a má generátor jídelníčku i tréninku. To je počítání.
>
> **VIP** za {{cena_vip_mesic}} Kč měsíčně umí totéž a k tomu AI kouče, foto jídla a zápis hlasem. Teorii znáš z kurzu, takže ti nejvíc pomůže mít po ruce někoho, kdo ti ve chvíli zaváhání řekne, co s dnešním číslem.
>
> Když víš, že u toho vydržíš, vezmi rovnou rok. Vyjde na {{cena_vip_rok}} Kč, tedy dva měsíce zdarma, a k ročnímu VIP přidávám měsíc Barna Academy na zkoušku.
>
> **[ Chci VIP ]**
>
> Zrušíš kdykoli. Do 14 dnů od začátku předplatného ti vrátím celou částku, když ti to nesedne.
>
> **Be Effective!** Martin

#### vip-kupci · krok 3 · den 13 · `vk-4-posledni`

- **Předmět A:** Poslední mail o appce z téhle řady
- **Předmět B:** Jedno rozhodnutí na tenhle měsíc
- **Náhledový text:** Žádný odpočet. Jen shrnutí.
- **CTA:** „Vzít VIP za {{cena_vip_mesic}} Kč" → `https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-kupci&utm_content=vk-4`
- **Čeká po odeslání:** nic, konec trati

> Ahoj{{fn_space}},
>
> tohle je poslední mail o appce z téhle řady. Cena zítra platí stejně, nikde neběží žádný odpočet.
>
> Shrnu to jednou větou: videokurz ti dal pravidla a VIP ti je každý týden přepočítá na tvoje čísla, s AI koučem po ruce.
>
> U klientů vidím, že teorie bez denní praxe vydrží pár týdnů. S týdenním přepočtem z ní je návyk.
>
> **[ Vzít VIP za {{cena_vip_mesic}} Kč ]**
>
> Když teď není ta chvíle, nic se neděje. Dál ti budu psát o výživě jako dosud.
>
> **Be Effective!** Martin
>
> P.S. Napiš mi jednou větou, co ti z kurzu v praxi nejde. Čtu to sám.

### 6.3 vip-leady

#### vip-leady · krok 0 · den 0 · `vl-1-kdo-upravi`

- **Předmět A:** Plán máš. Kdo ti ho bude upravovat?
- **Předmět B:** Co dělat, když se váha tři týdny nehne{{fn_suffix}}
- **Náhledový text:** Appka, která z tvých zápisů každý týden přepočítá cíl. K první platbě VIP videokurz zdarma.
- **CTA:** „Chci VIP za {{cena_vip_mesic}} Kč měsíčně" → `https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-leady&utm_content=vl-1`
- **Čeká po odeslání:** 3 dny

> Ahoj{{fn_space}},
>
> pár týdnů ti posílám tipy. Jestli sis podle nich spočítal kalorie, máš za sebou první krok.
>
> Pak přijde týden, kdy se váha nehne, a nikdo vedle tebe neřekne, jestli ubrat, přidat, nebo vydržet. U klientů vidím, že tady to lidi vzdávají nejčastěji.
>
> Na tohle jsem postavil appku **Tvůj Coach**. Ve **VIP** ti každý týden z tvých zápisů a vážení přepočítá kalorie i makra, sestaví jídelníček z běžných potravin a trénink podle toho, kde cvičíš. K tomu AI kouč, který tvoje čísla vidí. Čísla počítá engine, AI ti je vysvětlí.
>
> 🎁 K první platbě VIP ti přidám svůj videokurz výživy: 182 videí, hodnota {{course_price}} Kč. Zůstane ti, i když předplatné zrušíš.
>
> **[ Chci VIP za {{cena_vip_mesic}} Kč měsíčně ]**
>
> Zrušíš kdykoli v appce. Když ti to do 14 dnů nesedne, vrátím ti peníze.
>
> **Be Effective!** Martin
>
> P.S. Zapisovat jídlo i trénink můžeš v appce zdarma napořád a bez karty. VIP platíš za to, že s těmi čísly appka pracuje za tebe.

#### vip-leady · krok 1 · den 3 · `vl-2-zbyva-400`

- **Předmět A:** Zbývá ti 400 kcal. Co si dáš?
- **Předmět B:** Oběd venku a appka, která ví, kolik ti zbývá
- **Náhledový text:** Dvě funkce z VIP, kvůli kterým lidi u zápisu vydrží.
- **CTA:** „Vyzkoušet VIP" → `https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-leady&utm_content=vl-2`
- **Čeká po odeslání:** 3 dny

> Ahoj{{fn_space}},
>
> dvě situace, které znám od klientů nazpaměť.
>
> **Večer.** Zbývá ti 400 kcal a 30 g bílkovin a v lednici je toho moc i málo zároveň. Ve VIP se zeptáš AI kouče, co si dát, a on ti to rovnou zapíše.
>
> **Oběd venku.** Žádný obal, žádný čárový kód. Vyfotíš talíř, AI odhadne jídla i makra a ty odhad před zápisem zkontroluješ.
>
> Proč na tom trvám: lidi svůj příjem běžně podceňují o 20 až 50 %. Čím míň tě zápis zdržuje, tím déle u něj vydržíš a tím víc ti čísla řeknou.
>
> **[ Vyzkoušet VIP ]**
>
> **Be Effective!** Martin
>
> P.S. K první platbě VIP pořád platí videokurz výživy zdarma.

#### vip-leady · krok 2 · den 6 · `vl-3-videokurz`

- **Předmět A:** Proč k VIP přidávám celý videokurz
- **Předmět B:** 182 videí k tomu, co v appce zapisuješ
- **Náhledový text:** Appka počítá. Videokurz vysvětluje, proč počítá zrovna takhle.
- **CTA:** „Chci VIP i s videokurzem" → `https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-leady&utm_content=vl-3`
- **Čeká po odeslání:** 4 dny

> Ahoj{{fn_space}},
>
> appka ti každý den řekne, kolik jíst. Kdo ale neví, proč zrovna tolik, při první oslavě nebo dovolené to pustí.
>
> Proto k první platbě VIP přidávám videokurz výživy. 182 videí o tom, jak funguje kalorický deficit, kolik bílkovin, sacharidů a tuků jíst a jak jíst flexibilně bez zakázaných jídel.
>
> Samostatně stojí {{course_price}} Kč. K VIP ho máš zdarma a zůstane ti, i když předplatné po měsíci zrušíš.
>
> **[ Chci VIP i s videokurzem ]**
>
> **Be Effective!** Martin
>
> P.S. Cíl je, abys za pár měsíců věděl, co dělat, i bez appky a beze mě. Na to je ten kurz.

#### vip-leady · krok 3 · den 10 · `vl-4-namitky`

- **Předmět A:** Tři důvody, proč appku nechceš, a co na ně říkám
- **Předmět B:** Nechce se ti platit za appku? Rozumím
- **Náhledový text:** Zapisování, cena a co když to nevydržím.
- **CTA:** „Vzít VIP za {{cena_vip_mesic}} Kč" → `https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-leady&utm_content=vl-4`
- **Čeká po odeslání:** 4 dny

> Ahoj{{fn_space}},
>
> když lidem nabídnu appku, slyším nejčastěji tři věci. Odpovím ti rovnou.
>
> **„Nebaví mě zapisovat.“** Proto je ve VIP zápis z fotky a hlasem. Řekneš „rohlík, tvaroh dvě stě gramů“ a appka to rozebere. Snídani, kterou máš pětkrát týdně, zapíšeš jedním ťuknutím.
>
> **„Nechci další předplatné.“** Zápis jídla i tréninku, skener a databáze potravin jsou zdarma napořád. Za VIP platíš týdenní přepočet cílů, generátory a AI kouče. Když AI nepotřebuješ, v appce je i Basic za {{cena_basic_mesic}} Kč, jen bez kouče a bez videokurzu.
>
> **„Co když to nevydržím?“** Zrušíš kdykoli v appce a zaplacené období doběhne. Když ti to do 14 dnů od začátku nesedne, napiš mi na martin@martinbarna.cz a vrátím ti celou částku. Videokurz při vrácení peněz odchází s nimi.
>
> **[ Vzít VIP za {{cena_vip_mesic}} Kč ]**
>
> **Be Effective!** Martin

#### vip-leady · krok 4 · den 14 · `vl-5-posledni`

- **Předmět A:** Poslední mail o appce z téhle řady
- **Předmět B:** Rok VIP za cenu deseti měsíců
- **Náhledový text:** Žádný odpočet. Jen shrnutí, ať se rozhodneš v klidu.
- **CTA:** „Vybrat VIP" → `https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-leady&utm_content=vl-5`
- **Čeká po odeslání:** nic, konec trati

> Ahoj{{fn_space}},
>
> tohle je poslední mail o appce z téhle řady. Cena zítra platí stejně, takže se rozhoduj v klidu.
>
> Shrnu to do jednoho odstavce. VIP je celá appka: týdenní přepočet kalorií a maker podle tvých zápisů, jídelníček i trénink, AI kouč, foto a hlas. K první platbě videokurz výživy zdarma.
>
> Když víš, že to chceš dělat dlouhodobě, vezmi rovnou rok. Vyjde na {{cena_vip_rok}} Kč, tedy dva měsíce zdarma, a k ročnímu VIP přidávám měsíc Barna Academy na zkoušku. Měsíční i roční variantu máš v pokladně vedle sebe.
>
> **[ Vybrat VIP ]**
>
> Když teď není ta chvíle, nic se neděje. Dál ti budu posílat tipy jako dosud.
>
> **Be Effective!** Martin
>
> P.S. Zapisovat můžeš zdarma i bez předplatného. Kdo zapisuje, má půlku práce za sebou.

### 6.4 Oprava P0: jednotné znění pro lead-magnet/9, longtail-consumer/5, nurture-videokurz/8, tc-start/2

Stejné tělo, liší se jen `utm_campaign` (= trať) a klíč (`lm-9-vip499`, `lc-11-vip499`, `nv-8-vip499`, `tcs-2-vip499`). Ženské tvary dosadí engine přes `[a]`.

#### lead-magnet · krok 9 · `lm-9-vip499`

- **Předmět A:** Cíle, jídelníček, trénink a AI kouč za {{cena_vip_mesic}} Kč měsíčně
- **Předmět B:** Appka, která za tebe přepočítá cíle. Videokurz dostaneš k ní
- **Náhledový text:** Co jsem s klienty dělal ručně v tabulkách, dělá appka sama. K VIP videokurz zdarma.
- **CTA:** „Chci VIP za {{cena_vip_mesic}} Kč" → `https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=lead-magnet&utm_content=vip-499`
- **Čeká po odeslání:** beze změny (jako dnes)

> Ahoj{{fn_space}},
>
> pár týdnů ti posílám tipy. Dnes ti ukážu, kam s nimi jít, aby se z nich staly čísla na váze.
>
> Postavil jsem appku **Tvůj Coach**. Dělá to, co jsem s klienty roky dělal ručně v tabulkách: spočítá ti kalorie a makra, každý týden je upraví podle toho, co jsi skutečně jedl a jak se hnula váha, a sestaví ti jídelníček z běžných potravin i trénink podle toho, kde cvičíš.
>
> Ve **VIP za {{cena_vip_mesic}} Kč měsíčně** máš:
>
> - týdenní check-in a automatickou úpravu cílů (když zapíšeš málo dnů, appka cíli nehne, radši než hádat)
> - generátor jídelníčku z běžných potravin a generátor tréninku
> - AI kouče, který vidí tvoje čísla a odpoví mým stylem, a zápis jídla z fotky i hlasem
> - 🎁 k první platbě můj videokurz výživy zdarma (182 videí, hodnota {{course_price}} Kč). Zůstane ti, i když předplatné zrušíš. Při vrácení peněz odchází s ním.
>
> Zápis jídla i tréninku, hledání v databázi přes {{pocet_potravin}} potravin i skener čárových kódů zůstávají zdarma napořád. Platíš za to, že appka z tvých čísel dělá rozhodnutí za tebe.
>
> **[ Chci VIP za {{cena_vip_mesic}} Kč ]**
>
> Platíš kartou a zrušíš kdykoli přímo v appce. Když ti to do 14 dnů nesedne, vrátím peníze.
>
> **Be Effective!** Martin
>
> P.S. Když AI kouče nepotřebuješ, je v appce i Basic za {{cena_basic_mesic}} Kč. Umí přepočet cílů a generátory, jen bez kouče a bez videokurzu.

<!-- TEXTY:END -->

## 7. Technika

### 7.1 DB (nic nového kromě řádků a funkcí)

| Co | Soubor | Poznámka |
|---|---|---|
| 13 šablon `vip-free`, `vip-kupci`, `vip-leady` | `01-sablony-insert.sql` | Inertní: dokud nevede most ani zápis, nikdo je nedostane. Pojistka: když tratě už existují, nic nevloží. |
| Mosty do VIP tratí | `02-vstupy-mosty-backlog.sql`, část A | Slučuje JSON do `app_config.navazujici_trate`, původní hodnotu vypíše přes NOTICE. Přepisuje mosty z `tc-zkusebka` a `tc-free` (dnes asi do longtailu). |
| Zápis stávajících lidí | část B, `vip_zapis_backlog(trať, limit)` | Bere jen dojeté nebo longtail/evergreen s dalším mailem za 7 a víc dní. Původní trať, krok a termín ukládá do `leads.meta.vip_vrat`. Podmíněný update, loguje `bridged`. |
| Návrat na původní trať | část C, `vip_vrat_na_puvodni_trat()` | Běží 7:40, před `enroll_into_longtail` (7:50). Další mail nejdřív za 3 dny. |
| Cron | část D (zakomentováno) | `vip-backlog-denne` 7:30 (25 lidí na trať a den), `vip-vrat-denne` 7:40. |
| Oprava P0 | `03-oprava-basic249-na-vip.sql` | Záloha tabulky ve stejné transakci, zámek na `key`, čeká přesně 4 řádky. |
| Kontroly | `00-kontroly-pred-spustenim.sql` | Jen čtení, včetně výchozího stavu plateb VIP. |

Nová tabulka, sloupec ani CHECK constraint potřeba nejsou. `email_events.type` je volný text a `bridged` už engine používá.

### 7.2 Kód `drip-send` (`04-drip-send-vip.patch`, `git apply --check` prochází)

1. **`pravidla.ts` / `shouldStop`:**
   - `vip-leady` se zastaví při jakémkoli nákupu (videokurz, Academy, koučink);
   - `vip-kupci` a `vip-free` se zastaví při Academy nebo aktivním koučinku.
   - Pravidla zároveň chrání mosty (`mostBlokujeVlastnictvi`).
2. **`aktivace.ts` / `KROK_PODLE_ZAPISU`:**
   - `vip-free/0` až `/3` mají `jen_kdyz_zapsal`, nikdy `jen_kdyz_aktivni`;
   - u `jen_kdyz_aktivni` by člověk, který nezapisuje, dostal po 7 dnech „rescue", tedy mail začínající „v appce už zapisuješ".
3. **`preskoc.ts` + `index.ts` (díra D8):**
   - kroky `longtail-consumer/11` a `longtail-kupci/5` (koučink) se přeskočí bývalým i aktivním klientům koučinku;
   - `maPreskocitKrok` k tomu dostane množinu `exCoaching`, kterou `index.ts` už má;
   - ⚠️ čísla kroků ověřit proti živé DB (`00-kontroly`, dotaz 4).
4. **Testy:** nové případy v `pravidla.test.ts`, `aktivace.test.ts` a `preskoc.test.ts`. Pojistky „živá mapa" jsou rozšířené vědomě.
5. **Deploy funkce** musí nahrát i `_shared/` (CLAUDE.md). Po deployi číst **nasazený** zdroj přes `get_edge_function`.

### 7.3 Co jsem ověřil na maketě (PostgreSQL 16, prázdná DB, žádná živá data)

- `01`, `02` a `03` proběhly bez chyby, `00` taky.
- **Zápis stávajících na 11 smyšlených leadech vzal správných 5:**
  - dojetý lead → `vip-leady`;
  - longtail s mailem za 10 dní → `vip-leady` s uloženým návratem;
  - kupec videokurzu → `vip-kupci`;
  - uživatel po zkušebce → `vip-free`.
- **Vynechal správných 6:**
  - člen Academy;
  - kdo už VIP sérii měl;
  - longtail s mailem za 3 dny;
  - plátce appky;
  - admin;
  - trvale odhlášený.
- Kdo dostal mail včera, vynechán taky.
- Návrat vrátil člověka na `longtail-consumer/6` s původním termínem.

### 7.4 Co se musí ověřit nebo dodělat mimo tenhle repozitář

- **Appka:** jestli `/client/subscription?plan=vip` otevře VIP. Živé maily používají jen `plan=basic`, web jen `/koupit?plan=vip`. Když ne, `vip-free` přepnout na `/koupit?plan=vip`. Je to jedna konstanta `PREDPLATNE_VIP` v `sablony.cjs` a nový běh `generuj.cjs`.
- **Appka:** jestli `/koupit?plan=vip` u člověka, který už má účet (kupec videokurzu s Free účtem), přiřadí předplatné k jeho účtu podle e-mailu.
- **Volitelně:** `aktivace-stav` by mohl vracet i seznam platících. Pak by šla zastavit VIP trať i u člověka, který zaplatil dřív, než existoval hook, nebo jiným e-mailem.
- **Volitelně:** `app-onboarding-hook` doplnit `vip-` do `AKVIZICNI`, ať `meta.puvodni_trat` zaznamená, ze které VIP trati člověk odešel do appky.
- **Admin:** doplnit tři tratě do přehledu vstupů (`akademie/admin/index.html`, `ENTRY_DESC`).

## 8. Rizika a otázky pro Martina

**Rizika:**

1. **Repo není živá DB.** Šablony se mohly po 23. 9. změnit přes MCP. Proto je první krok `00-kontroly`, jinak hrozí oprava neexistující věci nebo přepsání novějšího textu (zámek v `03` tomu brání).
2. **Signál z appky může vypadnout** (`aktivace-stav`). Engine je fail-open, takže by `vip-free` mail odešel i člověku, který nezapisuje. Jeho první věta pak nesedí. Když to Martinovi vadí, dá se pro `vip-free` přepnout na fail-closed (malá změna v `rozhodniPodleZapisu`).
3. **Pauza místo longtailu.** Free uživatel, který nezapisuje, skončí po `vip-free` v `paused`, takže nedostane ani newsletter. Dnes se mu děje totéž na mostě do longtailu (D10), nic se tím nezhoršuje. Rozhodnutí je ale pořád otevřené.
4. **Jeden člověk může projít dvěma VIP tratěmi.** Lead dostane `vip-leady`, pak se zaregistruje ve Free a po zkušebce dostane `vip-free`. To je až 9 VIP mailů za zhruba 5 týdnů. Mezi nimi je ovšem silný signál (registrace). Zápis stávajících dává jen jednu sérii.
5. **Denní strop a Resend kvóta.** Zápis stávajících dělá nejvýš 75 lidí denně, rozložených do dvou týdnů. Ověřit `drip_daily_cap` a tarif Resendu (auth maily sdílí kvótu).
6. **Proměnné ceny musí sedět.**
   - `{{course_price}}` musí odpovídat ceně videokurzu na webu (dnes 1 490);
   - věty „dva měsíce zdarma" a „měsíc Academy k ročnímu VIP" jsou dopočet slovy, při změně ceníku je zkontrolovat ručně (CLAUDE.md);
   - most dnes měsíc Academy k ročnímu VIP opravdu uděluje (`ACADEMY_BONUS_SOURCE`).
7. **Měření má slepá místa.** Platby Basicu a VIP platby lidí, kteří videokurz měli už předtím, Academy DB nevidí. Úplné číslo je jen v appce.

**Otázky pro Martina (jeho rozhodnutí):**

1. **Do 25. 10.:** longtail-consumer/11 (koučink studeným leadům) a nabídky koučinku bývalým klientům v longtailu jsou odložené na 26. až 30. 10. Mají ten den odejít? Doporučení: bývalým klientům přeskočit (patch), studeným leadům krok 11 nahradit obsahovým mailem nebo P.S. na VIP.
2. **Videokurz se slevou vs. zdarma k VIP (D7):** nechat slevové kroky ZACNI15 a JESTE20 v akvizici, nebo je pro nové leady nahradit VIP nabídkou s dárkem? Návrh s tím počítá v obou variantách. Data o tom, co víc prodává, v repu nejsou, rozhodnou čísla z `entitlements` za září a říjen.
3. **Kupec videokurzu:** jako první VIP (`vip-kupci`), nebo nejdřív koučink (`upsell-coaching`)? Návrh dává VIP první, protože je to menší krok a koučink si najde teplejšího člověka později. Opačné pořadí je jen jiný most.
4. **Tón:** všechny texty jsou návrh. Hlavně „Basic, nebo VIP? Napíšu ti to narovinu" a tři námitky jsou psané hodně přímo. Sedí to Martinovi?
5. **Roční VIP v tlačítku:** všechna tlačítka vedou na měsíční VIP, roční je jen v textu. Má poslední mail každé trati vést rovnou na `plan=vip-rok`?

## 9. Pořadí nasazení a měření

1. `00-kontroly-pred-spustenim.sql` (jen čtení), výsledky porovnat s kap. 2 a 3. Uložit výchozí stav plateb VIP (dotaz 7).
2. Martin schválí texty: oprava P0 a 13 nových mailů.
3. **P0:** `03-oprava-basic249-na-vip.sql`, ruční úpravy z kap. 5.4b a `clanek-do-mailu.mjs`. Před tím TEST na `fitness.barna@gmail.com` a výslovné „pošli ostro".
4. Deploy `drip-send` s `04-drip-send-vip.patch` (včetně `_shared/`), testy, přečíst nasazený zdroj.
5. `01-sablony-insert.sql`, pak TEST všech 13 mailů na `fitness.barna@gmail.com`: `drip-send {test_email, track, step}`, ženská i mužská varianta.
6. Po „pošli ostro": `02` část A (mosty). Týden pozorovat `drip-send {dry:true}` (`by_bridge`) a `email_events` typu `bridged`, `paused_neaktivita` a `error`.
7. `02` části B až D (zápis stávajících a cron).
8. **Měření po 30 dnech:**
   - `00-kontroly`, dotaz 8: první platby VIP do 30 dní od vstupu, podle trati;
   - dotaz 7: celkový trend proti výchozímu stavu.
   - Proklik a otevření se nevyhodnocují.
   - Trať, která za 30 dní při alespoň 50 vstupech neprodá ani jednou, se přepíše, ne rozšíří.
