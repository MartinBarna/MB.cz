> ⛔ **Poznámka k 9. 8. 2026:** dokument místy počítá se zdražením Academy na 12 900 Kč
> po 50. zakládajícím členovi. **Ten slib Martin 8. 8. 2026 ZRUŠIL, cena zůstává 8 900 Kč**
> (status „zakládající člen" zůstal jako pocta, cenová hrozba ne). Web i mailové šablony
> jsou vyčištěné; tenhle text je ponechán jako historický záznam. Nepoužívej ho jako podklad.

# Mailing revize — červenec 2026 (přehled pro Martina)

Tenhle dokument shrnuje **všechny změny mailingu** z revize 16. 7. 2026. Samotné změny jsou
připravené v souboru `akademie/_supabase/mailing-revize-2026-07.sql` — **nic se zatím nestalo**,
soubor je potřeba ručně spustit v Supabase (SQL editor), ideálně celý najednou (je v transakci).
Žádný mail se tím neodešle — mění se jen texty šablon v databázi; drip engine si je načte
automaticky při dalším běhu, bez redeploye.

Po nasazení doporučuju poslat si testovací verze pár mailů (drip-send umí `test_email` režim)
a vyrobit čerstvý dump do `drip-templates.sql` (ten stávající tímhle zastará).

---

## 1) Tabulka změn (existující šablony)

| Šablona (track/krok) | Co se mění | Proč |
|---|---|---|
| trener-kit/2, trener-kit/3 (i preheader), upsell-academy/0, upsell-academy/2 | „255 lekcí“ → **„256 lekcí“** | Živý web /akademie/ uvádí 256. Tři různá čísla v prodejních mailech = nedůvěryhodné. |
| lead-magnet-tool/1, rescue-academy | „241 lekcí“ → **„256 lekcí“** | dtto |
| nurture-pro-vas/0–2 | Mužské tvary („poskládáš sám“, „kde jsi začal“, „poradíš si sám“, „aby ses vyznal sám“) → **bezrodé formulace** | Track jde na segment `other` (pohlaví neznáme) — ženě chodily maily v mužském rodě. |
| upsell-academy/2 (P.S.) | „nauč se to [[sama\|\|sám]]“ → **„naučit se to“** | Kupci mají segment `other` → token padal vždy mužsky. |
| rescue-academy | „sis objednal[a]“ → **„tvoje objednávka … zůstala kousek před cílem“** | Funkce order-rescue rendruje [a] vždy mužsky; nová formulace je úplně bez rodu (vzor z rescue-videokurz). |
| lead-magnet-tool/1 | „sis otevřel[a]“ → „jsem ti poslal přístup…“; „i kdyby sis nic nekoupil[a]“ → „i bez jakéhokoliv nákupu“ | Tool leady nemají ve formuláři pohlaví → tokeny padaly mužsky. |
| **patička všech drip mailů** (app_config `footer_html` + `footer_text`) | „protože sis … stáhl[a] plán zdarma“ → **„protože máš z martinbarna.cz stažený plán zdarma“** | Úplně bez rodu — patičku dostávají i kupci a trenéři se segmentem `other`. |
| lead-magnet/3 + existing-leadmagnet/1 (P.S.) | „Napiš mi na WhatsApp, však víš :)“ → **„Stačí odepsat na tenhle e-mail — čtu všechno a řeknu ti narovinu.“** | Čerstvý lead žádné tvoje číslo nemá — mrtvá výzva přesně v momentě rozhodování. Reply-to funguje. |
| academy-nabidka ×3 (lead-magnet/7, existing-leadmagnet/5, nurture-videokurz/8) | „Napiš mi na WhatsApp, řeknu narovinu“ → **„Stačí odepsat na tenhle e-mail, čtu všechno — a řeknu narovinu.“** | dtto |
| upsell-coaching/2 (P.S.) | „Napiš mi na WhatsApp, nezávazně…“ → **„Stačí odepsat na tenhle e-mail — nezávazně, bez prodejních keců.“** | dtto (kupec videokurzu tvoje číslo taky nemá). Zmínky WhatsAppu jako **součásti koučinku** (lc-5, lk-3, upsell-co-1) zůstávají — tam je to popis služby, ne výzva. |
| upsell-coaching/0 (předmět) | „…osobně? Tomáši“ → **„…osobně, Tomáši?“** (přes {{fn_suffix}}) | Jméno viselo za otazníkem — vypadalo to jako rozbité vkládání jména přímo v inboxu. |
| nurture-videokurz/1, /5, /7 (tlačítka) | „Prohlédnout/Mrknout na videokurz“ → vede na **prodejní stránku martinbarna.cz/videokurz** místo rovnou na pokladnu; v /7 přibyl sekundární odkaz „tady kurz rovnou koupíš“ na pokladnu | CTA slibovala „prohlédnout“, ale házela studeného leada na platební formulář bez referencí a garance. Slevové CTA („Vzít…“) zůstávají na pokladně. |
| trener-kit/3 | Doplněn podpis **„Be Effective! / Martin“** před P.S. | Jediný mail z celého mailingu bez podpisu — hlavní prodejní mail trenérské sekvence působil useknutě. |
| nurture-videokurz/2 (sleva 15 %) | „ti dávám slevu“ → **„sleva, kterou jsem ti poslal už dřív, pořád platí“** + „800 Kč“ → {{course_price}} | Řeší dvojitou „poslední šanci“: lead-magnet slíbil „víc už slevu nedám“ — nurture teď **připomíná tentýž kód**, nenabízí „novou“ slevu. |
| nurture-videokurz/6 (sleva 20 %) | Předmět „Poslední lepší cena“ → **„Poslední připomínka: −20 % na videokurz“**; preheader „Víc už slevu nedám.“ → „Stejný kód jako dřív — a poslední mail, kde ho připomínám.“; tělo přerámované na poslední připomínku téhož kódu + „800 Kč“ → {{course_price}} | dtto — slib „20 % je nejvyšší sleva“ zůstává pravdivý (longtail už žádnou slevu nedává), urgence přestává být „falešná“. |
| lead-magnet (celý track), existing-leadmagnet (celý track), academy-nabidka v nurture-videokurz/8 | **„Ti/Tě/Tebe“ → „ti/tě/tebe“** (těla, předměty i preheadery) | Sjednocení tykání na malé písmeno — jeden lead dostával v cestě střídavě „Ti“ a „ti“. Ostatní tracky už malé písmeno používaly. |
| onboarding-nakup-academy/0 | `wait_days` null → **2** | Aby navázaly nové kroky 1 a 2 (níž). |
| lead-magnet-tool/1 | `wait_days` null → **3** | Aby navázal nový most na videokurz (níž). |

**Nic se nemaže, nic se neposílá.** Všechny UPDATE jsou psané jako „nahraď přesný starý text
novým“ — když se šablona mezitím změnila jinde, změna se prostě nechytne (a nic nerozbije).
Všech 22 cílových textů jsem před zápisem ověřil proti živé DB — sedí 1:1.

---

## 2) Nové maily — plné texty

Pozn. k formě: `[TLAČÍTKO: …]` = zlaté tlačítko, odkazy uvádím v závorce. Všechny maily mají
standardní dark-gold obálku, patičku s odhlášením a oslovení křestním jménem, když ho známe.

### 2a) Onboarding Academy — krok 1 „Prohlídka“ (2 dny po nákupu)

> **Předmět:** Rychlá prohlídka Academy — ať ti nic neuteče, Tomáši
> **Preheader:** Generátory, prompt knihovna, AI Martin a cesta k certifikátu.
>
> Ahoj Tomáši,
>
> pár dní jsi uvnitř, tak ti ukážu, co všechno v Academy máš — členové často objeví půlku věcí až po měsících:
>
> - **Generátory jídelníčků a tréninků** — hotový plán na pár kliknutí, s exportem do PDF pod tvým jménem. Najdeš je v sekci Nástroje *(odkaz /akademie/nastroje/)*.
> - **Prompt knihovna a modul AI** — hotové prompty pro práci s klienty, obsah i byznys. Tohle ti ušetří hodiny týdně.
> - **AI Martin** — chat přímo ve studiu: zeptáš se na cokoliv z výživy a tréninku a odpovídá z lekcí Academy. A když mu vyfotíš jídlo, odhadne kalorie.
> - **Certifikát** — po dokončení testů získáš certifikát s veřejným ověřením online. Jde přidat na LinkedIn i na web, ať ho klienti vidí.
>
> **Praktický tip, kde začít:** otevři si studium, vyber studijní cestu (od nuly / vedení klientů / věda & závodníci) a dej si první modul. Půl hodiny denně bohatě stačí — konzistence poráží dokonalost.
>
> [TLAČÍTKO: Otevřít studium] *(→ /akademie/studium/)*
>
> Kdyby cokoliv nešlo, stačí odpovědět na tenhle e-mail. **Be Effective!**
> Martin
>
> *P.S. Co tě zajímá nejvíc — práce s klienty, vlastní forma, nebo AI? Odepiš jednou větou a nasměruju tě na správný modul.*

### 2b) Onboarding Academy — krok 2 „Maximum“ (7 dní po nákupu)

> **Předmět:** Jak z Academy vytěžit maximum
> **Preheader:** Studijní rytmus, Praxe kit — a proč se ti to vrátí s prvním klientem.
>
> Ahoj Tomáši,
>
> týden v Academy za tebou. Posílám postup, který se členům osvědčil nejvíc — od prvního modulu až k certifikátu:
>
> - **Jeď po modulech popořadě.** Jsou poskládané jako cesta — základy výživy a tréninku ti pak podrží všechno ostatní.
> - **Dej si rytmus, ne nálož.** 2–3 lekce denně stačí. Důležitější než tempo je nevypadnout — pokrok vidíš v Moje studium *(odkaz)*.
> - **Praxe kit používej hned.** Vstupní dotazník, check-in šablonu i tracker vytiskneš pod svým jménem a použiješ s klientem klidně zítra: Praxe kit *(odkaz /akademie/praxe/)*.
> - **Teorii si osahej na sobě.** Pár týdnů si važ a zapisuj jídlo a sleduj týdenní průměr váhy — co si projdeš na vlastní kůži, to klientům vysvětlíš desetkrát líp.
>
> Bereš Academy pro sebe, ne pro klienty? Postup je stejný — jen místo Praxe kitu začni generátory a vlastním jídelníčkem.
>
> A nezapomeň na cíl: po dokončení máš v ruce certifikát s veřejným ověřením, nástroje i klientské materiály pod svým jménem — všechno, s čím jde služby nabízet od prvního dne. Academy se ti vrátí s prvním klientem.
>
> [TLAČÍTKO: Pokračovat ve studiu]
>
> **Be Effective!**
> Martin
>
> *P.S. Zasekneš se kdekoliv — lekce, test, nástroj? Odepiš na tenhle e-mail, vyřešíme to spolu.*

### 2c) Most: generátory → videokurz (lead-magnet-tool krok 2, 3 dny po „tool-follow“)

> **Předmět:** Čísla máš. Teď to hlavní, Tomáši
> **Preheader:** Generátor ti dal plán. Videokurz tě naučí ho uřídit v reálném životě.
>
> Ahoj Tomáši,
>
> generátor ti spočítal kalorie i makra a poskládal plán. To je dobrý start — ale plán na papíře ještě nikoho neproměnil. Rozhoduje, co s ním uděláš v restauraci, o víkendu a v týdnu, kdy se váha zasekne.
>
> Přesně tohle učím ve **videokurzu výživy**: jak si pár týdnů jídlo vážit a zapisovat (jen než si vytrénuješ oko), jak číst týdenní průměr váhy místo denních výkyvů a jak jíst flexibilně — bez zakázaných jídel. 182 lekcí, doživotní přístup za 800 Kč.
>
> [TLAČÍTKO: Prohlédnout videokurz] *(→ prodejní stránka /videokurz)*
>
> A jestli chceš nejdřív nakouknout dovnitř: 11 lekcí si pustíš zdarma *(odkaz)*, bez registrace a bez karty.
>
> **Be Effective!**
> Martin
>
> *P.S. Skládáš plány pro klienty, ne pro sebe? Pak začni jinde — startovacím kitem pro trenéry zdarma (odkaz /pro-trenery/).*

### 2d) Nový track `evergreen-consumer` — 6 mailů à 30 dní

Pro leady, kterým **dojel longtail-consumer** (dnes po posledním mailu navždy zmlknou).
Čistá hodnota z webu, žádný prodejní tlak — cíl je zůstat v inboxu. **Pozor: šablony jsou
zatím inertní — enroll neexistuje, viz „K rozhodnutí“.**

**Mail 1 (den 0) — Kvíz**

> **Předmět:** 2 minuty: co ti reálně brání zhubnout?
> **Preheader:** Krátký kvíz zdarma — a doporučení přesně pro tvoji situaci.
>
> Ahoj Tomáši,
>
> chvíli jsem se neozval, tak jen v klidu — nic dnes neprodávám. Jen se chci zeptat, jak se daří. A jestli se to někde zaseklo, mám na to nástroj: krátký kvíz, který ti za 2 minuty ukáže, kde to nejspíš vázne.
>
> [TLAČÍTKO: Spustit kvíz zdarma] *(→ /kviz/)*
>
> Pár otázek a na konci konkrétní doporučení podle tvé situace. Většinou totiž nevázne jídlo samotné — bývá to spánek, víkendy, nebo moc přísný plán, který se nedá vydržet.
>
> **Be Effective!**
> Martin
>
> *P.S. Výsledek mi klidně pošli v odpovědi na tenhle e-mail — mrknu na to a poradím, co s tím.*

**Mail 2 (den 30) — Kalkulačka**

> **Předmět:** Hubneš podle starých čísel?
> **Preheader:** Lehčí tělo potřebuje míň. Přepočítej si příjem za 2 minuty.
>
> Ahoj Tomáši,
>
> častá chyba, kterou vídám: člověk zhubne pár kilo, ale jede dál na čísla spočítaná na starou váhu. Lehčí tělo potřebuje míň energie — a hubnutí se zastaví, i když děláš všechno „správně“.
>
> Když se váha pár týdnů nehne, většinou nepotřebuješ víc disciplíny. Potřebuješ aktuální čísla:
>
> [TLAČÍTKO: Přepočítat kalorie a makra zdarma] *(→ /kalkulacka-kalorii-a-makrozivin/)*
>
> Pravidlo k tomu: přepočítávej zhruba po každých 5 kg dole, ne každý týden. Mezitím drž kurz a řiď se týdenním průměrem váhy, ne jedním ranním číslem.
>
> **Be Effective!**
> Martin
>
> *P.S. Nová čísla, a nevíš, jak z nich poskládat talíř? Přesně tohle krok za krokem učím ve videokurzu výživy (odkaz).*

**Mail 3 (den 60) — Bílkoviny**

> **Předmět:** Jedna páka, co změní nejvíc: bílkoviny
> **Preheader:** Kolik jich reálně potřebuješ a z čeho je poskládat.
>
> Ahoj Tomáši,
>
> kdybych měl z výživy vybrat jedinou věc, kterou vyladit jako první, jsou to **bílkoviny**. Zasytí nejvíc ze všech živin, drží svaly při hubnutí — a skoro každý jich jí míň, než si myslí.
>
> Sepsal jsem k nim praktický článek: kolik jich denně potřebuješ, z čeho je reálně poskládat a jak to vypadá na talíři:
>
> [TLAČÍTKO: Přečíst: bílkoviny prakticky] *(→ /clanky/bilkoviny.html)*
>
> Rychlý test na dnešek: projdi si v hlavě dnešní jídla — kolik z nich mělo pořádný zdroj bílkovin (maso, ryba, vejce, tvaroh, skyr, luštěniny)? Míň než tři? Máš svůj první krok.
>
> **Be Effective!**
> Martin

**Mail 4 (den 90) — Spánek**

> **Předmět:** Děláš všechno dobře, a stejně to drhne?
> **Preheader:** Podceňovaný spojenec hubnutí: spánek.
>
> Ahoj Tomáši,
>
> můžeš mít jídelníček i trénink srovnané — a stejně to drhne, když spíš 5–6 hodin. Nevyspané tělo má druhý den větší hlad a chutě, hlavně na sladké a tučné, a hůř se mu odolává.
>
> Napsal jsem o tom článek: co spánek reálně dělá s hubnutím a čím začít, když ho chceš zlepšit:
>
> [TLAČÍTKO: Přečíst: spánek a hubnutí] *(→ /clanky/spanek-a-hubnuti.html)*
>
> Jeden krok na tento týden: pevný čas, kdy jdeš spát, a hodinu předtím pryč od telefonu. Menší chutě poznáš dřív, než čekáš.
>
> **Be Effective!**
> Martin

**Mail 5 (den 120) — Pondělní check-in**

> **Předmět:** 5 minut v pondělí, co řídí celý tvůj pokrok
> **Preheader:** Týdenní check-in na jednu stránku — PDF zdarma.
>
> Ahoj Tomáši,
>
> jestli ti před časem zapadl, posílám znovu nejužitečnější materiál, který mám: **pondělní check-in na jednu stránku**. Přesně tohle chci každé pondělí od klientů — a přesně tohle odděluje ty, kdo pokrok řídí, od těch, kdo v něj jen doufají.
>
> [TLAČÍTKO: Stáhnout check-in PDF] *(→ /download/tydenni-checkin.pdf)*
>
> Váha (týdenní průměr!), míry, energie, hlad, kroky, spánek. Pět minut — a víš, jestli plán funguje, nebo je čas ho upravit. Podle dat, ne podle nálady.
>
> **Be Effective!**
> Martin
>
> *P.S. Chceš, ať ta pondělní čísla se mnou řešíš napřímo? Přesně takhle funguje můj koučink (odkaz /koucing/).*

**Mail 6 (den 150) — Víkendy + rozloučení**

> **Předmět:** Klasika, co bourá výsledky: víkend
> **Preheader:** Přes týden podle plánu, o víkendu chaos? Jde to i jinak.
>
> Ahoj Tomáši,
>
> jestli za 13 let praxe vídám jeden vzorec pořád dokola, je to tenhle: pondělí až čtvrtek na jedničku, v pátek večer to povolí — a neděle končí ve stylu „od pondělí znovu“. Není to slabá vůle. Je to systém, který s víkendem nepočítá.
>
> Jak si nastavit týdenní průměr kalorií a plánovaný volnější den, ať si víkend užiješ a nezboříš celý týden:
>
> [TLAČÍTKO: Přečíst: víkendové přejídání] *(→ /clanky/vikendove-prejidani.html)*
>
> Tímhle mailem moje občasné tipy končí — nechci ti plnit schránku. Ozvu se, jen když budu mít něco, co za to fakt stojí. A ty se ozvi kdykoliv: stačí odepsat na tenhle e-mail, čtu všechno.
>
> **Be Effective!**
> Martin

Check-in PDF a článek o víkendech dostali už v longtailu — ale mezi tím uplyne 4–6 měsíců
a jsou to dva nejsilnější materiály, takže připomenutí („jestli ti zapadl“) je záměr, ne omyl.

---

## 3) K rozhodnutí (potřebuje tvoje ANO, případně další krok mimo tenhle balík)

1. **Zapnout enroll pro evergreen-consumer.** Šablony jsou v DB, ale nikdo do tracku leady
   nepřesouvá. Potřebuje malou DB funkci (vzít leady s dojeteým `longtail-consumer`, bez nákupu,
   neodhlášené → přesunout do `evergreen-consumer`) + denní cron, případně rozšířit
   `enroll_into_longtail` (pozor, ta teď vylučuje všechny `longtail-%` leady, takže jednoduché
   přidání do seznamu nestačí). **Zároveň s tím** doporučuju přidat `evergreen-consumer` do
   stop-po-nákupu pravidel v `drip-send` (aby kupec nedostával ani hodnotové maily s pitchi
   videokurzu v P.S.). Obojí je změna kódu/DB funkcí — vědomě mimo tenhle SQL balík.
2. **Přeřazení tool-leadů do nurture-videokurz.** Most (mail 2c) je hotový, ale konzumní
   tool-leady po něm dál padají rovnou do longtail-consumer (à 14 dní, bez slev). Jestli chceš,
   aby prošli celým prodejním obloukem nurture-videokurz (hodnota + 2 slevy) jako makro-plan
   leady, je to úprava enroll logiky (`enroll_into_nurture_videokurz` + pořadí s longtail
   enrollem) — zase změna DB funkce, ne šablon. Pozn.: leady, které tool track dojely **před**
   nasazením, most už nedostanou (jsou/budou v longtailu).
3. **Korekční mail 24 trenérům z /pro-trenery (12.–15. 7.).** Kvůli regresi v lead-capture
   spadli do konzumního tracku a startovací kit mailem nikdy nedostali (oprava mapování je
   samostatný fix mimo tenhle balík). Po opravě doporučuju: přeřadit je do `trener-kit` step 0
   a poslat jednorázovou omluvenku s kitem. Návrh textu ke schválení:
   > **Předmět:** Tady je tvůj startovací kit (a omluva)
   > Ahoj, malý rest z mojí strany: před pár dny sis na martinbarna.cz vyžádal(a) startovací
   > kit pro trenéry, ale mailem ti odešel jiný materiál. Tak to napravuju — tady je kit ke
   > stažení: [TLAČÍTKO: Stáhnout startovací kit] (→ /download/startovaci-kit-trener.pdf).
   > Omlouvám se za zmatek. A jestli ti mezitím přistálo pár mailů, co pro trenéry nedávaly
   > smysl, klidně je ignoruj — od teď už ti budu posílat věci k trenérské praxi. Be Effective! Martin
   >
   > *(Pozn.: „vyžádal(a)“ v závorce je tu schválně — jednorázový mail by šel ručně/skriptem,
   > ne přes drip engine, takže tokeny [a] nejsou k dispozici. Kdyby šel přes drip-send,
   > přepíšu bez rodu.)*
4. **Doposlat nové onboarding maily nedávným kupcům Academy?** Kupci, kteří uvítačku dostali
   před nasazením, mají track „dojetý“ a kroky 1+2 automaticky nedostanou. Jde je jednorázově
   „doarmovat“ (SQL: nastavit jim step 1 a `next_send_at`), dává smysl třeba pro kupce za
   posledních 30 dní. Řekni, jestli chceš — připravím.
5. **Ceny natvrdo zůstávají** (8 900 / 12 900 Kč v academy šablonách, `COURSE_PRICE = 800`
   v kódu drip-send). V nurture-videokurz jsem „800 Kč“ převedl na {{course_price}}, zbytek
   je větší zásah (merge proměnné z app_config) — nechávám na samostatné rozhodnutí,
   souvisí se zdražením po 50. prodeji.

---

## 4) Poznámky k provedení (pro klid duše)

- **Gender tokeny [a] jsem neodstraňoval plošně.** V DB není jediná šablona s nepodporovaným
  tokenem `[á]` (ověřeno SQL). Token `[a]` drip-send umí a v tracích, kde pohlaví **známe**
  z formuláře (lead-magnet, existing-leadmagnet, nurture-videokurz), funguje správně — tam
  zůstává. Odstranil jsem ho jen tam, kde segment neznáme a padal vždy mužsky (rescue-academy,
  lead-magnet-tool, patička). Nové maily jsou psané rovnou bez rodu.
- **Tykání:** po nasazení jsou lead-magnet, existing-leadmagnet i academy-nabidka sjednocené
  na malé „ti/tě/tebe“. Velké „T“ zůstává jen na začátcích vět („Tvoje objednávka…“) — to je
  správně česky, žádná šablona nezůstala nekonzistentní. Ostatní tracky už malé písmeno měly.
- **Náhrady jsou chirurgické:** každý UPDATE nahrazuje přesný stávající text (ověřeno proti
  živé DB 1:1, včetně počtu zásahů — např. WhatsApp P.S. přesně 2+3+1 šablony). INSERTy mají
  `ON CONFLICT DO NOTHING`, takže nic existujícího nepřepíšou a soubor jde pustit i opakovaně.
- **Timing nových onboarding mailů:** nákup Academy → den 0 uvítačka (beze změny) → den 2
  prohlídka → den 7 maximum. Tool track: den 0 doručení → den 2 follow → den 5 most.
- **Evergreen kadence:** 6 mailů à 30 dní = lead zůstává v inboxu dalších ~5 měsíců po konci
  longtailu, bez prodejního tlaku (soft zmínka videokurz/koučink jen v P.S. dvou mailů).
- Soubor `akademie/_supabase/drip-templates.sql` je dump z 7. 7. — po nasazení téhle revize
  zastará; doporučuju vygenerovat nový (DB je zdroj pravdy).
