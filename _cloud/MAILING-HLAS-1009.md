# Mailing: kolo hlasu (9. 10. 2026)

Větev `cloud/mailing-hlas-1009` (z `cloud/mailing-navrh-1009`). **Jen texty: nic není nasazené, na Supabase, Resend ani appku se nesahalo, žádný mail neodešel.**
Zdroj textů je dál jen `_cloud/mailing/sablony.cjs`; náhledy, SQL i kapitola 6 v `MAILING-NAVRH-1009.md` jsou z něj přegenerované (`node _cloud/mailing/generuj.cjs`).

**Co se neměnilo:** fakta a čísla (182 videí, 20 až 50 %, 14 dní, rok 2013), podmínky vstupu a výstupu tratí, `wait_days`, klíče, UTM, adresy tlačítek, proměnné cen, gender tokeny, odborné pozice.
**Co se měnilo:** hlas. Maily jdou ven pod Martinovým jménem, takže každý předmět, náhledový text, tělo i tlačítko prošly testem „řekl by to Martin klientovi, nebo to zní jako landing page?“, a každá trať se četla jako série, ne jako čtyři samostatné maily.

## 1. Shrnutí

| Co | Kolik |
|---|---|
| Mailů prošlo kolem hlasu | 13 nových + 1 společné znění opravy P0 (4 šablony) |
| Mailů s přepsaným tělem | 13 ze 14 (beze změny zůstal jen rytmus úvodu u vf-4, vk-3, vk-4 a P0, kde držel) |
| Předmětů A nebo B přepsaných | 11 (z 28) |
| Předmětů C „z hloubky“ přidaných | 14 (ke každému mailu) |
| Náhledových textů přepsaných | 5 |
| P.S. s druhou prosbou přepsaných na nabídku | 3 (vf-4, vk-4, vl-5), jedno P.S. vypuštěno (vk-2) |
| Dlouhých pomlček (U+2014) ve všech souborech návrhu | **0** (měřeno skriptem, kap. 7) |
| Vykřičníků mimo podpis „Be Effective!“ | 0 (hlídá generátor) |

Předměty A a B jsou **klasika**, C je **z hloubky** (stejné sdělení podané jinak než u všech, ne divně). **Nevybírám za Martina.** Do SQL jde jako výchozí hodnota A, protože tabulka `email_templates` má jeden sloupec `subject`; B a C jsou v `sablony.cjs`, v náhledech i v kapitole 6 návrhu. Výměna je jedno slovo v `sablony.cjs` a nový běh generátoru.

## 2. Podle čeho se četlo

Pravidla z `HLAS-MARTINA.md` a ze zadání kola, v pořadí, v jakém se uplatnila nejčastěji:

1. **Trať jako série (pravidlo 6b):** stejný úvod nebo rytmus dvakrát za sebou se přepsal. Srovnávalo se i s živými šablonami drip-send (`akademie/_supabase/ceny-sablony-2026-09-23.sql`, snímek 55 šablon), protože člověk na vstupu VIP tratě má většinu z nich už ve schránce.
2. **Jedna prosba na mail:** tlačítko. P.S. „odpověz mi jednou větou“ je druhá prosba, přepsáno na nabídku („na tenhle mail jde odepsat, čtu to sám“).
3. **Zákazy:** dlouhá pomlčka, vykřičník, negační kadence („Není X. Je Y.“), slogany ve trojicích, buzzwordy (klíčové, skutečné), absolutna (musí, vždy, nikdy), „Tady je…“, „Pojďme“, polidšťování věcí.
4. **Konkrétno místo abstrakce, pozorování z praxe místo zobecnění**, krátké věty, fragmenty klidně.
5. **Nepřepisovat odborné pozice**: 20 až 50 % podhodnocení příjmu, deficit první, protein, spánek, sladidla. Žádná z nich se v mailech nemění.
6. **Ceny jen proměnnou**, žádný mail navíc, Basic jako jedna věta, videokurz jen k VIP (u kupců kurzu dárek vůbec).

## 3. Co se opakovalo napříč tratí (a co s tím)

### 3.1 Uvnitř jedné trati (dvakrát za sebou = přepsat)

| Trať | Opakování | Řešení |
|---|---|---|
| vip-free | vf-2 „za třináct let s klienty vidím pořád totéž“ a hned vf-3 „otázky, které mi klienti léta posílají“: dvakrát za sebou stejný otvírák „klienti + léta“. Navíc „za třináct let s klienty vidím pořád totéž“ je doslova v živém `onboarding-nakup-tvujcoach/1` a skoro doslova v `tc-free/8`. | vf-2 otvírá jedním konkrétním pozorováním a výčtem, co zdržuje (databáze, gramáže, deset ťuknutí). vf-3 otvírá rovnou třemi otázkami. |
| vip-free | vf-3 předmět „Zeptej se ve dvě ráno“: Free uživatel dostal v `tc-free/6` předmět „Kouč, který ti odpoví ve dvě ráno“. Stejný hák dvakrát témuž člověku. | Nový předmět A z první otázky v těle („Váha se týden nehýbe. Mám ubrat?“). „Dvě ráno“ v trati nikde. |
| vip-kupci | vk-1 „ve videokurzu jsi viděl…“ a hned vk-2 „z kurzu víš…“: dva úvody za sebou odkazem na kurz. | vk-2 otvírá číslem ze studií a pozorováním, kde vzniká díra v zápisu. Kurz zůstává ve vk-1, vk-3 a vk-4. |
| vip-kupci | vk-1 P.S. „Zápis jídla i tréninku máš v appce zdarma napořád“ a hned vk-2 P.S. „Zápis jídla i tréninku zůstává v appce zdarma i bez VIP“. | vk-2 bez P.S. Připomínka, že Free zůstává, je ve vk-1 a znovu ve vk-4 (u „nic se neděje“). |
| vip-kupci | vk-1 záruka „Zrušíš kdykoli v appce. Když ti to do 14 dnů nesedne…“ a vk-3 „Zrušíš kdykoli. Do 14 dnů od začátku…“ stejným rytmem. | vk-3 záruka přeformulovaná, fakt stejný. |
| vip-leady | „nejčastěji“ v otvíráku vl-1, vl-2 i vl-4 a „u klientů vidím“ ve vl-1 a vl-3. Čtyři z pěti mailů stály na stejném zařízení. | „U klientů vidím“ zůstává jen ve vl-1 (nejsilnější místo). vl-2 „kde se zápis utrhne nejsnáz“, vl-3 vysvětluje bez odkazu na klienty, vl-4 „vrací se mi pořád tři věty“. |
| vip-leady | vl-1 P.S. „Zapisovat jídlo i trénink můžeš v appce zdarma napořád a bez karty“ a vl-5 P.S. „Zapisovat můžeš zdarma i bez předplatného“. | vl-5 P.S. nahrazuje nabídka odpovědi, závěrečná pro celou řadu. |
| vip-leady | vl-2 a vl-4 obě prodávaly foto. | vl-2 = AI kouč a foto, vl-4 u námitky „nebaví mě zapisovat“ = hlas a šablona. Fakta stejná, každý mail jiná zkratka. |

### 3.2 Napříč tratěmi (člověk může projít dvěma, viz riziko 4 v návrhu)

| Opakování | Kde | Řešení |
|---|---|---|
| „X máš. Kdo ti …?“ jako první předmět | vf-1 „Zapisuješ. Teď ať…“, vk-1 „Kurz máš v hlavě. Kdo ti to spočítá v pondělí?“, vl-1 „Plán máš. Kdo ti ho bude upravovat?“; a živě `longtail-kupci/2` „Teorii znáš. Kdo to dělá každý den?“ | vl-1 dostal konkrétní scénu („Kdo ti ho upraví, až se váha zastaví?“). vk-1 zůstal: je to nejsilnější předmět trati a `longtail-kupci/2` se podle kap. 5.4b přepisuje tak či tak. |
| „zápis, který tě nezdrží“ | vf-2 preheader, vk-2 předmět A, vl-2 předmět B | Zůstalo jen jednou (vf-2 tělo). |
| „bez zápisu se nedá nic spočítat“ | vf-4, vk-2, vl-5 | Zůstalo nikde, u vf-4 nahrazeno „z dat, která máš, se dá navázat kdykoli později“. |
| „Čísla počítá engine, AI ti je vysvětlí“ | vf-1 a vl-1 doslova | „Engine“ klientovi nic neříká. vf-1: „Kalorie a makra počítá pořád appka, kouč ti jen vysvětlí, proč vyšly takhle.“ vl-1 bez věty, fakt nese „AI kouč, který tvoje čísla vidí“. |
| „rohlík, tvaroh dvě stě gramů“ | vf-2, vk-2, vl-4 a živě `tc-free/2` | vf-2 nechává (hlasový příklad appky), vk-2 „dvě vejce, krajíc chleba a jablko“, vl-4 „kuřecí prsa dvě stě gramů, rýže a okurka“. |
| „Cena zítra platí stejně. Tady je shrnutí“ | vk-4 a vl-5 preheader („Tady je“ je zakázaný obrat) | vk-4 „Nikde neběží odpočet. Krátké shrnutí a konec téhle řady.“, vl-5 „Shrnutí na jednu obrazovku a roční VIP. Nikde neběží odpočet.“ |
| „Poslední mail o appce z téhle řady“ | vk-4 A, vl-5 A, vf-4 B | vl-5 A „Poslední mail k appce. Cena zítra platí stejně“. Formulace „poslední mail z téhle řady/série“ je Martinova (živě `academy-vk-serie/2`, `trener-kit/4`, `longtail-consumer/12`), proto jednou na trať zůstává. |
| „Když teď není ta chvíle, nic se neděje. Dál ti budu psát/posílat…“ | vk-4 a vl-5 | vl-5 „A když to teď nedává smysl, nic se neděje. Tipy ti budu posílat dál.“ |
| „jestli ubrat, přidat, nebo vydržet“ | vk-1 a vl-1 (živě `academy-vk-serie/0` „Ubrat, počkat, nebo…“) | vl-1 „jestli ubrat, nebo ještě počkat“. |

## 4. Druhá prosba v P.S.

Zadání: každý mail nejvýš jedna prosba. Tlačítko je ta prosba. Výzva „odpověz mi jednou větou“ je druhá, i když je Martinova a živé maily ji mají často. Přepsáno na **nabídku**, ne výzvu:

| Mail | Před | Po |
|---|---|---|
| vf-4 | „Jestli tě od předplatného něco drží, odpověz mi jednou větou na tenhle mail. Čtu to sám.“ | „Na tenhle mail jde odepsat, čtu to sám.“ |
| vk-4 | „Napiš mi jednou větou, co ti z kurzu v praxi nejde. Čtu to sám.“ | „Odpovědi na tenhle mail chodí přímo mně. Čtu je sám.“ |
| vl-5 | (P.S. o zápisu zdarma, viz 3.1) | „Na tenhle mail jde odepsat. Čtu to sám.“ |
| vk-1 | „Registruj se ideálně stejným e-mailem, jaký máš u videokurzu.“ | „Účet si zakládej na stejný e-mail, jaký máš u videokurzu.“ Zůstává: je to praktická poznámka k tlačítku, ne druhá prosba. |
| vl-4 | „napiš mi na martin@martinbarna.cz a vrátím ti celou částku“ | Zůstává: je to postup u záruky, ne prosba. |

Generátor od teď hlídá „odpověz mi“, „odepiš mi“, „napiš mi jednou větou“ a „odepiš na tenhle“ jako chybu.

## 5. Co zůstalo schválně

- **Martinovy obraty z živých mailů:** „napíšu ti to narovinu“, „taky dobře“, „tohle je poslední mail z téhle řady“, „čtu to sám“, „Be Effective!“, 🎁 u dárku. Jsou jeho, jen se nesmí potkat dvakrát za sebou.
- **Odborné pozice:** 20 až 50 % podhodnocení příjmu (teď „podle studií“ místo „studie ukazují“, fakt stejný), deficit a makra z kurzu, „fotka olej a omáčku nepozná“ (revize R1).
- **„Žádný obal, žádný čárový kód.“** ve vl-2: popis scény, ne negační kadence. Nechávám, snadno se škrtne.
- **Zavřené otázky z kap. 8 návrhu se tímto kolem nemění** (termín 25. 10., sleva vs. dárek, pořadí VIP a koučinku u kupců, roční VIP v tlačítku).

## 6. Před a po: každý mail

Předmět (A, B, nově C), náhledový text, první dvě věty těla, tlačítko a P.S. Plné znění je v `MAILING-NAVRH-1009.md`, kap. 6, a v náhledech `_cloud/mailing/nahledy/`. Tabulku generoval skript ze dvou verzí `sablony.cjs` (git `origin/cloud/mailing-navrh-1009` proti této větvi), ne ruční opis.

#### vip-free · krok 0 · `vf-1-zapisujes`

| | Před | Po |
|---|---|---|
| Předmět A (klasika, výchozí do DB) | Zapisuješ. Teď ať s tím appka něco udělá | Zapisuješ. Teď ať s tím appka něco udělá *(beze změny)* |
| Předmět B (klasika) | Co appka udělá s tím, co už zapisuješ | Co appka udělá s tím, co už zapisuješ *(beze změny)* |
| Předmět C (z hloubky) | nebyl | Co VIP udělá v pondělí s tvým zapsaným týdnem |
| Náhledový text | Co se ve VIP stane s daty, která v appce už máš. | Co se ve VIP stane s daty, která v appce už máš. *(beze změny)* |
| První dvě věty | v appce už nějaký čas zapisuješ. Tím máš data, ze kterých se dá počítat. | v appce už nějaký čas zapisuješ. Máš tím data o tom, co doopravdy jíš a jak se hýbe váha. |
| CTA (tlačítko) | Přejít na VIP za {{cena_vip_mesic}} Kč | Přejít na VIP za {{cena_vip_mesic}} Kč *(beze změny)* |
| P.S. | P.S. Free ti zůstává napořád. Nic z toho, co teď v appce používáš, ti nevezmu. | P.S. Free ti zůstává napořád. Nic z toho, co teď v appce používáš, ti nevezmu. *(beze změny)* |

#### vip-free · krok 1 · `vf-2-foto-hlas`

| | Před | Po |
|---|---|---|
| Předmět A (klasika, výchozí do DB) | Zapsat oběd za pár vteřin | Zapsat oběd za pár vteřin *(beze změny)* |
| Předmět B (klasika) | Vyfoť talíř, appka odhadne makra | Vyfoť talíř, appka odhadne makra *(beze změny)* |
| Předmět C (z hloubky) | nebyl | Řekni to appce nahlas: rohlík, tvaroh, tři deci vody |
| Náhledový text | Foto a hlas ve VIP: zápis, který tě nezdrží. | Dvě zkratky ve VIP pro dny, kdy se nechce nic ťukat. |
| První dvě věty | za třináct let s klienty vidím pořád totéž: kdo zápis vzdá, vzdá ho většinou proto, že ho zdržuje. Proto jsou ve VIP dvě zkratky: | u klientů vidím jeden důvod, proč zápis skončí, častěji než všechny ostatní dohromady: zdržuje. Hledání v databázi, gramáže, deset ťuknutí na jeden oběd. |
| CTA (tlačítko) | Chci VIP | Chci VIP *(beze změny)* |
| P.S. | P.S. K první platbě VIP dostaneš i videokurz výživy zdarma. | P.S. K první platbě VIP dostaneš i videokurz výživy zdarma. *(beze změny)* |

#### vip-free · krok 2 · `vf-3-ai-kouc`

| | Před | Po |
|---|---|---|
| Předmět A (klasika, výchozí do DB) | Zeptej se ve dvě ráno | Váha se týden nehýbe. Mám ubrat? |
| Předmět B (klasika) | AI kouč, který vidí tvoje čísla | AI kouč, který vidí tvoje čísla *(beze změny)* |
| Předmět C (z hloubky) | nebyl | Co by ti na „mám ubrat?“ řekl kouč, který vidí tvůj týden |
| Náhledový text | AI kouč ve VIP odpovídá podle mojí metodiky a jídlo zapíše za tebe. | AI kouč ve VIP odpovídá podle mojí metodiky a jídlo zapíše za tebe. *(beze změny)* |
| První dvě věty | otázky, které mi klienti léta posílají na WhatsApp, se opakují: „Váha se týden nehýbe. | tyhle tři otázky dostávám nejčastěji: „Váha se týden nehýbe. |
| CTA (tlačítko) | Napsat AI koučovi ve VIP | Napsat AI koučovi ve VIP *(beze změny)* |
| P.S. | P.S. Basic za {{cena_basic_mesic}} Kč umí přepočet cílů a generátory. AI kouče, foto ani hlas nemá, proto ti doporučuju VIP. | P.S. Basic za {{cena_basic_mesic}} Kč umí přepočet cílů a generátory. AI kouče, foto ani hlas nemá, proto ti doporučuju VIP. *(beze změny)* |

#### vip-free · krok 3 · `vf-4-shrnuti`

| | Před | Po |
|---|---|---|
| Předmět A (klasika, výchozí do DB) | Free, Basic, nebo VIP? Shrnutí na jednu obrazovku | Free, Basic, nebo VIP? Shrnutí na jednu obrazovku *(beze změny)* |
| Předmět B (klasika) | Poslední mail o předplatném z téhle řady | Poslední mail o předplatném z téhle řady *(beze změny)* |
| Předmět C (z hloubky) | nebyl | Kdy ti stačí Free a kdy dává smysl VIP |
| Náhledový text | Ať se rozhodneš v klidu. Free ti zůstává tak jako tak. | Ať se rozhodneš v klidu. Free ti zůstává tak jako tak. *(beze změny)* |
| První dvě věty | tohle je poslední mail o předplatném z téhle řady. Shrnu ti to na jednu obrazovku: | tohle je poslední mail o předplatném z téhle řady. Shrnu ti to na jednu obrazovku: *(beze změny)* |
| CTA (tlačítko) | Vybrat VIP | Vybrat VIP *(beze změny)* |
| P.S. | P.S. Jestli tě od předplatného něco drží, odpověz mi jednou větou na tenhle mail. Čtu to sám. | P.S. Na tenhle mail jde odepsat, čtu to sám. |

#### vip-kupci · krok 0 · `vk-1-v-pondeli`

| | Před | Po |
|---|---|---|
| Předmět A (klasika, výchozí do DB) | Kurz máš v hlavě. Kdo ti to spočítá v pondělí? | Kurz máš v hlavě. Kdo ti to spočítá v pondělí? *(beze změny)* |
| Předmět B (klasika) | Z videokurzu do praxe za pár minut týdně | Co z videokurzu dělá appka za tebe každý týden |
| Předmět C (z hloubky) | nebyl | Kurz ti dal proč. Appka ti každé pondělí dá kolik |
| Náhledový text | Appka Tvůj Coach dělá s tvými čísly to, co učím ve videokurzu. | Appka Tvůj Coach dělá s tvými čísly to, co učím ve videokurzu. *(beze změny)* |
| První dvě věty | ve videokurzu jsi viděl, jak funguje kalorický deficit a kolik bílkovin, sacharidů a tuků jíst. V praxi to znamená každý týden sečíst, co jsi snědl, porovnat to s váhou a rozhodnout, jestli ubrat, přidat, nebo vydržet. | ve videokurzu jsi viděl, jak funguje kalorický deficit a kolik bílkovin, sacharidů a tuků jíst. V praxi to znamená každý týden sečíst, co jsi snědl, porovnat to s váhou a rozhodnout, jestli ubrat, přidat, nebo vydržet. *(beze změny)* |
| CTA (tlačítko) | Chci VIP za {{cena_vip_mesic}} Kč měsíčně | Chci VIP za {{cena_vip_mesic}} Kč měsíčně *(beze změny)* |
| P.S. | P.S. Zápis jídla i tréninku máš v appce zdarma napořád. Registruj se ideálně stejným e-mailem, jaký máš u videokurzu. | P.S. Zápis jídla i tréninku máš v appce zdarma napořád. Účet si zakládej na stejný e-mail, jaký máš u videokurzu. |

#### vip-kupci · krok 1 · `vk-2-oslava`

| | Před | Po |
|---|---|---|
| Předmět A (klasika, výchozí do DB) | Oslava, oběd venku a zápis, který tě nezdrží | Oslava, oběd venku a den, kdy se nechce ťukat |
| Předmět B (klasika) | Tři situace, kde ti VIP ušetří nejvíc času | Tři situace, kde ti VIP ušetří nejvíc času *(beze změny)* |
| Předmět C (z hloubky) | nebyl | Dort zapíše AI kouč, ty si ho v klidu sněz |
| Náhledový text | AI kouč, foto a hlas: co VIP přidá k tomu, co znáš z kurzu. | AI kouč, foto a hlas: co VIP přidá k tomu, co znáš z kurzu. *(beze změny)* |
| První dvě věty | z kurzu víš, že bez zápisu se nedá nic spočítat. Studie ukazují, že lidi svůj příjem klidně podhodnotí o 20 až 50 %, a u klientů vidím, že nejvíc chybí dny, kdy zápis vynechají. | podle studií lidi svůj příjem podhodnotí o 20 až 50 %. U klientů vidím, kde ta díra vzniká nejčastěji: ve dnech, kdy se zápis vynechá celý. |
| CTA (tlačítko) | Chci VIP | Chci VIP *(beze změny)* |
| P.S. | P.S. Zápis jídla i tréninku zůstává v appce zdarma i bez VIP. | (bez P.S.) |

#### vip-kupci · krok 2 · `vk-3-basic-nebo-vip`

| | Před | Po |
|---|---|---|
| Předmět A (klasika, výchozí do DB) | Basic, nebo VIP? Napíšu ti to narovinu | Basic, nebo VIP? Napíšu ti to narovinu *(beze změny)* |
| Předmět B (klasika) | Proč ti doporučuju dražší plán | Proč ti doporučuju dražší plán *(beze změny)* |
| Předmět C (z hloubky) | nebyl | Dva plány. Rozdíl je v tom, kdo ti v neděli večer odpoví |
| Náhledový text | Rozdíl je v AI koučovi, foto a hlasu. | Rozdíl je v AI koučovi, fotce a hlasu. |
| První dvě věty | v appce jsou dva placené plány a chci, abys věděl, proč ti doporučuju ten dražší. Basic za {{cena_basic_mesic}} Kč měsíčně ti každý týden přepočítá cíle a má generátor jídelníčku i tréninku. | v appce jsou dva placené plány a chci, abys věděl, proč ti doporučuju ten dražší. Basic za {{cena_basic_mesic}} Kč měsíčně ti každý týden přepočítá cíle a má generátor jídelníčku i tréninku. *(beze změny)* |
| CTA (tlačítko) | Chci VIP | Chci VIP *(beze změny)* |
| P.S. | (bez P.S.) | (bez P.S.) *(beze změny)* |

#### vip-kupci · krok 3 · `vk-4-posledni`

| | Před | Po |
|---|---|---|
| Předmět A (klasika, výchozí do DB) | Poslední mail o appce z téhle řady | Poslední mail o appce z téhle řady *(beze změny)* |
| Předmět B (klasika) | Jedno rozhodnutí na tenhle měsíc | Cena zítra platí stejně, tak v klidu |
| Předmět C (z hloubky) | nebyl | Kurz ti dal pravidla. Naposledy k tomu, kdo je bude počítat |
| Náhledový text | Cena zítra platí stejně. Tady je shrnutí. | Nikde neběží odpočet. Krátké shrnutí a konec téhle řady. |
| První dvě věty | tohle je poslední mail o appce z téhle řady. Cena zítra platí stejně, nikde neběží žádný odpočet. | tohle je poslední mail o appce z téhle řady. Cena zítra platí stejně, nikde neběží žádný odpočet. *(beze změny)* |
| CTA (tlačítko) | Vzít VIP za {{cena_vip_mesic}} Kč | Vzít VIP za {{cena_vip_mesic}} Kč *(beze změny)* |
| P.S. | P.S. Napiš mi jednou větou, co ti z kurzu v praxi nejde. Čtu to sám. | P.S. Odpovědi na tenhle mail chodí přímo mně. Čtu je sám. |

#### vip-leady · krok 0 · `vl-1-kdo-upravi`

| | Před | Po |
|---|---|---|
| Předmět A (klasika, výchozí do DB) | Plán máš. Kdo ti ho bude upravovat? | Plán máš. Kdo ti ho upraví, až se váha zastaví? |
| Předmět B (klasika) | Co dělat, když se váha tři týdny nehne{{fn_suffix}} | Co dělat, když se váha tři týdny nehne{{fn_suffix}} *(beze změny)* |
| Předmět C (z hloubky) | nebyl | Co u klientů dělám každé pondělí, umí appka i pro tebe |
| Náhledový text | Appka, která z tvých zápisů každý týden přepočítá cíl. K první platbě VIP videokurz zdarma. | Appka, která z tvých zápisů každý týden přepočítá cíl. K první platbě VIP videokurz zdarma. *(beze změny)* |
| První dvě věty | jednou přijde týden, kdy se váha nehne, a nikdo vedle tebe neřekne, jestli ubrat, přidat, nebo vydržet. U klientů vidím, že tady to lidi vzdávají nejčastěji. | jednou přijde týden, kdy se váha nehne. A vedle tebe nikdo, kdo by řekl, jestli ubrat, nebo ještě počkat. |
| CTA (tlačítko) | Chci VIP za {{cena_vip_mesic}} Kč měsíčně | Chci VIP za {{cena_vip_mesic}} Kč měsíčně *(beze změny)* |
| P.S. | P.S. Zapisovat jídlo i trénink můžeš v appce zdarma napořád a bez karty. Ve VIP platíš za to, že s těmi čísly appka pracuje za tebe. | P.S. Zapisovat jídlo i trénink můžeš v appce zdarma napořád a bez karty. Ve VIP platíš za to, že s těmi čísly appka pracuje za tebe. *(beze změny)* |

#### vip-leady · krok 1 · `vl-2-oslava`

| | Před | Po |
|---|---|---|
| Předmět A (klasika, výchozí do DB) | Oslava v sobotu. Jak ji zapsat? | Oslava v sobotu. Jak ji zapsat? *(beze změny)* |
| Předmět B (klasika) | Oběd venku a zápis, který tě nezdrží | Oběd bez obalu a čárového kódu. Jak ho zapsat |
| Předmět C (z hloubky) | nebyl | Dort, chlebíčky, víno. A pak „to už nemá cenu zapisovat“ |
| Náhledový text | Dvě funkce z VIP, kvůli kterým lidi u zápisu vydrží. | Dvě funkce z VIP, kvůli kterým lidi u zápisu vydrží. *(beze změny)* |
| První dvě věty | dvě situace, které znám od klientů nazpaměť. Oslava. | dvě situace, kde se zápis utrhne nejsnáz. Oslava. |
| CTA (tlačítko) | Chci VIP | Chci VIP *(beze změny)* |
| P.S. | P.S. K první platbě VIP pořád platí videokurz výživy zdarma. | P.S. K první platbě VIP pořád platí videokurz výživy zdarma. *(beze změny)* |

#### vip-leady · krok 2 · `vl-3-videokurz`

| | Před | Po |
|---|---|---|
| Předmět A (klasika, výchozí do DB) | Proč k VIP přidávám celý videokurz | Proč k VIP přidávám celý videokurz *(beze změny)* |
| Předmět B (klasika) | 182 videí, která k VIP dostaneš zdarma | 182 videí, která k VIP dostaneš zdarma *(beze změny)* |
| Předmět C (z hloubky) | nebyl | Číslo bez vysvětlení vydrží do první oslavy |
| Náhledový text | Ať víš, proč appka počítá zrovna takhle. | Ať víš, proč appka počítá zrovna takhle. *(beze změny)* |
| První dvě věty | appka ti každý den řekne, kolik jíst. U klientů vidím, že kdo neví, proč zrovna tolik, často to pustí při první oslavě nebo dovolené. | appka ti každý den řekne, kolik jíst. Jenže číslo bez vysvětlení drží jen do první oslavy nebo dovolené. |
| CTA (tlačítko) | Chci VIP i s videokurzem | Chci VIP i s videokurzem *(beze změny)* |
| P.S. | P.S. Cíl je, abys za pár měsíců věděl, co dělat, i bez appky a beze mě. Na to je ten kurz. | P.S. Cíl je, abys za pár měsíců věděl, co dělat, i bez appky a beze mě. Na to je ten kurz. *(beze změny)* |

#### vip-leady · krok 3 · `vl-4-namitky`

| | Před | Po |
|---|---|---|
| Předmět A (klasika, výchozí do DB) | Tři důvody, proč appku nechceš, a co na ně říkám | Tři věci, které mi lidi k appce říkají nejčastěji |
| Předmět B (klasika) | Nechce se ti platit za appku? Rozumím | Nechce se ti platit za appku? Rozumím *(beze změny)* |
| Předmět C (z hloubky) | nebyl | Co odpovídám na „nebaví mě zapisovat“ |
| Náhledový text | Zapisování, cena a co když to nevydržím. | Zapisování, cena a co když to nevydržím. *(beze změny)* |
| První dvě věty | když lidem nabídnu appku, slyším nejčastěji tři věci. Odpovím ti rovnou. | když lidem nabídnu appku, vrací se mi pořád tři věty. Odpovím na ně rovnou. |
| CTA (tlačítko) | Vzít VIP za {{cena_vip_mesic}} Kč | Vzít VIP za {{cena_vip_mesic}} Kč *(beze změny)* |
| P.S. | (bez P.S.) | (bez P.S.) *(beze změny)* |

#### vip-leady · krok 4 · `vl-5-posledni`

| | Před | Po |
|---|---|---|
| Předmět A (klasika, výchozí do DB) | Poslední mail o appce z téhle řady | Poslední mail k appce. Cena zítra platí stejně |
| Předmět B (klasika) | Rok VIP za cenu deseti měsíců | Rok VIP za cenu deseti měsíců *(beze změny)* |
| Předmět C (z hloubky) | nebyl | Dál už jen tipy. Tohle je naposledy o VIP |
| Náhledový text | Cena zítra platí stejně. Tady je shrnutí, ať se rozhodneš v klidu. | Shrnutí na jednu obrazovku a roční VIP. Nikde neběží odpočet. |
| První dvě věty | tohle je poslední mail o appce z téhle řady. Cena zítra platí stejně, takže se rozhoduj v klidu. | tohle je poslední mail o appce z téhle řady. Cena zítra platí stejně, takže se rozhoduj v klidu. *(beze změny)* |
| CTA (tlačítko) | Vybrat VIP | Vybrat VIP *(beze změny)* |
| P.S. | P.S. Zapisovat můžeš zdarma i bez předplatného. Bez zápisu se nedá nic spočítat, takže kdo zapisuje, má náskok. | P.S. Na tenhle mail jde odepsat. Čtu to sám. |

#### Oprava P0 (lead-magnet/9, longtail-consumer/5, nurture-videokurz/8, tc-start/2) · `lm-9-vip499` a sourozenci

| | Před | Po |
|---|---|---|
| Předmět A (klasika, výchozí do DB) | Cíle, jídelníček, trénink a AI kouč za {{cena_vip_mesic}} Kč měsíčně | Cíle, jídelníček, trénink a AI kouč za {{cena_vip_mesic}} Kč měsíčně *(beze změny)* |
| Předmět B (klasika) | Appka, která za tebe přepočítá cíle. Videokurz dostaneš k ní | Appka, která za tebe přepočítá cíle. Videokurz dostaneš k ní *(beze změny)* |
| Předmět C (z hloubky) | nebyl | Kdo ti bude každý týden upravovat kalorie a makra |
| Náhledový text | Co jsem s klienty dělal ručně v tabulkách, dělá appka sama. K VIP videokurz zdarma. | Co jsem s klienty dělal ručně v tabulkách, dělá appka sama. K VIP videokurz zdarma. *(beze změny)* |
| První dvě věty | pár týdnů ti posílám tipy. Dnes ti ukážu, kam s nimi jít, aby se z nich stala čísla na váze. | pár týdnů ti posílám tipy. Dnes ti ukážu, kam s nimi jít, aby se z nich stala čísla na váze. *(beze změny)* |
| CTA (tlačítko) | Chci VIP za {{cena_vip_mesic}} Kč | Chci VIP za {{cena_vip_mesic}} Kč *(beze změny)* |
| P.S. | P.S. Když AI kouče nepotřebuješ, je v appce i Basic za {{cena_basic_mesic}} Kč. Umí přepočet cílů a generátory, jen bez kouče a bez videokurzu. | P.S. Když AI kouče nepotřebuješ, je v appce i Basic za {{cena_basic_mesic}} Kč. Umí přepočet cílů a generátory, jen bez kouče a bez videokurzu. *(beze změny)* |

## 7. Měření

**Dlouhé pomlčky (U+2014):** skript `pomlcky.cjs` (jen pro tohle kolo, mimo repo) spočítal znaky ve zdroji textů, generátoru, obou SQL, všech 18 HTML náhledech, `CTI-ME.md`, `MAILING-NAVRH-1009.md` i v této zprávě:

```
_cloud/mailing/sablony.cjs                      U+2014: 0
_cloud/mailing/generuj.cjs                      U+2014: 0
_cloud/mailing/01-sablony-insert.sql            U+2014: 0
_cloud/mailing/03-oprava-basic249-na-vip.sql    U+2014: 0
_cloud/mailing/CTI-ME.md                        U+2014: 0
_cloud/mailing/nahledy/*.html (18 souborů)      U+2014: 0
_cloud/MAILING-NAVRH-1009.md                    U+2014: 0   (U+2013: 12, jen rozsahy čísel typu „lead-magnet 3–5“, ty jsou povolené)
_cloud/MAILING-HLAS-1009.md                     U+2014: 0
CELKEM dlouhých pomlček (U+2014): 0
```

Rychlá kontrola kdykoli znovu: `LC_ALL=C.UTF-8 grep -rlP '\x{2014}' _cloud/` nesmí nic vypsat (znak je zapsaný kódem, aby ho tahle věta sama nezanesla; bez UTF-8 locale grep ten kód odmítne).

**Kontroly v generátoru** (`node _cloud/mailing/generuj.cjs`, při chybě spadne a nic nevyrobí). Původní: cena číslem, dlouhá pomlčka, přesně jedno tlačítko s UTM, jen známé proměnné, sedm zakázaných frází, délka předmětu. Nově od kola hlasu:

- vykřičník kdekoli mimo podpis „Be Effective!“;
- AI obraty a buzzwordy: „Tady je“, „Ať už jsi“, „Doufám, že“, „tiše hlídá“, „elegantně“, „robustní“, „bezešvý“, „game-changer“, „Většina lidí“, „klíčové“, „skutečné“, „opravdové“, „v konečném důsledku“, „je důležité si uvědomit“;
- absolutna: „musíš“, „musí“, „vždy“, „vždycky“, „nikdy“, „zaručeně“, „100 %“ (hranice slova přes výčet českých písmen, protože `\b` v JS české znaky nezná);
- druhá prosba: „odpověz mi“, „odepiš mi“, „napiš mi jednou větou“, „odepiš na tenhle“;
- `subject_c` musí existovat a všechny tři předměty mají nejvýš 70 znaků.

**Negativní test kontrol:** do kopie `sablony.cjs` mimo repo jsem podstrčil devět prohřešků (vykřičník v předmětu, „musíš“ a „Tady je proč“ v těle, P.S. „Odpověz mi jednou větou“, „nikdy“ a „skutečně“ v předmětu C, předmět C přes 70 znaků, chybějící `subject_c`). Generátor spadl a vypsal všech devět, nic nevygeneroval. Na čistém zdroji prošel: 13 šablon, 4 opravy, 18 náhledů.

Negační kadenci („Není X. Je Y.“), slogany ve trojicích a „zní to jako landing page“ skript neumí, to je čtení. Prošlo ručně, mail po mailu, výsledky v kap. 3 a 6.

## 8. Co zbývá na Martinovi

1. **Vybrat předmět u každého z 14 mailů:** A nebo B (klasika), nebo C (z hloubky). Do DB jde zatím výchozí A. Výměna = jeden řádek v `sablony.cjs` a `node _cloud/mailing/generuj.cjs`.
2. **Tón „Basic, nebo VIP? Napíšu ti to narovinu“ a tří námitek** (otázka 4 v návrhu) zůstává k rozhodnutí. V kole hlasu jsem je nechal přímé: „narovinu“ je jeho obrat (živě `longtail-consumer/11`, `longtail-trener/2`, `academy-vk-serie/1`).
3. **„Zeptej se ve dvě ráno“** je z vf-3 pryč kvůli kolizi s `tc-free/6`. Kdyby ho Martin chtěl zpátky (třeba jako C), je to jedno slovo.
4. **P.S. bez výzvy k odpovědi** je podle zadání „jedna prosba na mail“. Kdyby Martin chtěl „odpověz mi jednou větou“ zpět (živé maily to mají často), stačí v generátoru zrušit kontrolu „druhá prosba“ a vrátit tři P.S. z kap. 4.
5. Ostatní otázky z kap. 8 návrhu (termín 25. 10., sleva vs. dárek, pořadí VIP a koučinku u kupců, roční VIP v tlačítku) se tímto kolem nemění.
6. Pořád platí: před ostrým během **TEST všech mailů na fitness.barna@gmail.com** (ženská i mužská varianta) a výslovné „pošli ostro“. UPDATE šablony je rozeslání.

## 9. Co se v repu změnilo

| Soubor | Změna |
|---|---|
| `_cloud/mailing/sablony.cjs` | Přepsané texty, `subject_c` u všech 14 mailů, poznámky k hlasu v hlavičce. |
| `_cloud/mailing/generuj.cjs` | Kontroly hlasu (kap. 7), tři předměty v náhledu i v kapitole 6 návrhu. |
| `_cloud/mailing/nahledy/*.html`, `index.html` | Přegenerované z nového zdroje, 1:1 obal `drip-send`. |
| `_cloud/mailing/01-sablony-insert.sql`, `03-oprava-basic249-na-vip.sql` | Přegenerované (jen `subject` = A, tabulka má jeden sloupec). |
| `_cloud/MAILING-NAVRH-1009.md` | Kapitola 6 přegenerovaná, úvod kap. 6 a otázka 4 v kap. 8 odkazují na toto kolo. |
| `_cloud/mailing/CTI-ME.md` | Řádek o kole hlasu a o nových kontrolách. |
| `_cloud/MAILING-HLAS-1009.md` | Tato zpráva. |

Nic z toho není součást webu ani deploye: upozornění z kap. 8 návrhu (riziko 8, `_cloud/**` není v `exclude` deploy workflow) platí dál a před mergem do `main` je potřeba ho vyřešit.
