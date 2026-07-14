-- ============================================================
-- Barna Academy — LONGTAIL sekvence (14. 7. 2026, schváleno Martinem „zelená")
-- Řeší díru: všechny sekvence končily terminálem a lead/kupec pak navždy mlčel.
--
-- 3 větve:
--  • longtail-consumer (12 mailů à 14 dní) — po dojetí nurture-videokurz / lead-magnet-tool
--    (nekoupili). Rytmus hodnota→hodnota→prodej; 2 dárky; prodejní momenty: koučink (m6),
--    Academy+appka (m12). ŽÁDNÁ nová sleva na videokurz (nurture slíbil „víc už slevu nedám").
--  • longtail-trener (6 mailů à 30 dní) — po dojetí trener-kit. Každý mail jiná páka na Academy;
--    finále = reálná urgence zaváděcí ceny (8 900 do 50. člena, pak 12 900).
--  • longtail-kupci (6 mailů à 21 dní) — po dojetí onboarding-videokurz (368 kupců, jinak by
--    zmlkli 18. den!). Aktivace + koučink + Academy upgrade (kupón UPGRADE800).
--
-- Stop na nákup vestavěný v drip-send (entitlement → purchased). Enroll fn + cron dole.
-- Šablony vloženy přes MCP (zdroj pravdy = email_templates), tady dokumentační kopie.
-- ============================================================

INSERT INTO email_templates (track, step, key, subject, preheader, blocks, wait_days) VALUES

-- ================= LONGTAIL-CONSUMER (12× à 14 dní) =================

('longtail-consumer', 0, 'lc-0-vikendy',
 $s$Přes týden svatoušek, o víkendu chaos? Mám pro tebe dárek$s$,
 $h$Systém, který víkend přežije. PDF uvnitř.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "vsadím se, že tenhle scénář znáš: od pondělí do čtvrtka jedeš jak hodinky, pak přijde pátek večer — a v neděli si říkáš, že v pondělí začneš znovu. Není to slabá vůle. Je to špatně postavený systém."}, {"t": "p", "html": "Sepsal jsem k tomu celého průvodce a posílám ti ho jako dárek: <strong>Jak zvládnout víkendové přejídání</strong> — týdenní průměr kalorií místo denní dokonalosti, plánovaný vyšší den místo chaosu a pondělní reset bez trestání."}, {"t": "btn", "href": "https://martinbarna.cz/materialy/pdf/vikendove-prejidani.pdf", "text": "Stáhnout PDF zdarma"}, {"t": "p", "html": "Kratší verzi najdeš i <a href='https://martinbarna.cz/clanky/vikendove-prejidani.html'>na blogu</a> — klidně pošli dál někomu, komu víkendy bourají výsledky."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 14),

('longtail-consumer', 1, 'lc-1-cheatday',
 $s$Cheat day ti škodí. Cheat meal ne. V čem je rozdíl?$s$,
 $h$Jedno jídlo tě nepotopí. Celý den klidně ano.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "„Zasloužím si cheat day“ je jedna z nejdražších vět v hubnutí. Celý den bez pravidel dokáže smazat deficit z celého týdne — matematika je neúprosná."}, {"t": "p", "html": "<strong>Cheat meal</strong> je jiná liga: jedno jídlo, které si vybereš dopředu, započítáš do dne a užiješ bez viny. Rozdíl není v tom, kolik sníš, ale kdo to řídí — ty, nebo impulz."}, {"t": "p", "html": "Jestli nevíš, s jakými čísly vlastně pracuješ, začni tady — za minutu máš svůj denní příjem i makra:"}, {"t": "btn", "href": "https://martinbarna.cz/kalkulacka-kalorii-a-makrozivin/", "text": "Spočítat si kalorie zdarma"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Celý rozbor cheat day vs. cheat meal mám <a href='https://martinbarna.cz/clanky/cheat-day.html'>na blogu</a>."}]$j$::jsonb,
 14),

('longtail-consumer', 2, 'lc-2-jojo',
 $s$Proč se kila vrací (a jak to zastavit)$s$,
 $h$Jojo efekt není tvoje selhání. Je zabudovaný v dietách.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "zhubnout umí skoro každý. Udržet to — tam se láme chleba. A jojo efekt není náhoda: čím drastičtější dieta, tím jistější návrat kil."}, {"t": "p", "html": "Co dělá rozdíl:"}, {"t": "bullets", "items": ["<strong>Mírný deficit</strong> místo hladovky — svaly zůstanou, metabolismus se nezhroutí.", "<strong>Dost bílkovin a silový trénink</strong> — hubneš tuk, ne sebe.", "<strong>Žádný „konec diety“</strong> — jen plynulý přechod na udržování. Kdo se „vrací k normálu“, vrací se i k původní váze."]}, {"t": "p", "html": "Přesně takhle je postavený můj <a href='{{course_url}}'>videokurz</a> — od výpočtu přes úpravy až po udržení formy. Žádné zázraky, systém na celý život."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Víc o jojo efektu <a href='https://martinbarna.cz/clanky/jojo-efekt.html'>na blogu</a>."}]$j$::jsonb,
 14),

('longtail-consumer', 3, 'lc-3-restaurace',
 $s$Restaurace, oslava, dovolená — jak nepřijít o formu$s$,
 $h$Nemusíš sedět doma s krabičkou.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "hodně lidí si myslí, že forma znamená odmítat pozvání a vozit si všude krabičky. Nesmysl. Stačí pár pravidel:"}, {"t": "bullets", "items": ["<strong>Vyber bílkovinu jako základ</strong> — steak, ryba, kuře. Zbytek talíře se poskládá sám.", "<strong>Přílohu klidně vyměň</strong> — místo hranolek zelenina nebo brambory, číšník to slyší denně.", "<strong>Jedno jídlo = jedno jídlo.</strong> Neřeš, nedopočítávej, užij si ho a další jídlo jedeš normálně.", "Na oslavě si dej, co ti chutná — jen ne všechno najednou. Talíř místo švédského stolu."]}, {"t": "p", "html": "Forma se nedělá v restauraci. Dělá se v těch 90 % jídel, které máš pod kontrolou doma."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 14),

('longtail-consumer', 4, 'lc-4-kroky',
 $s$Nejpodceňovanější páka hubnutí? Není v posilovně$s$,
 $h$10 000 kroků spálí víc než hodina kardia.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "když se řekne „spalovat“, většina lidí si představí rozběhaný pás a pot. Přitom největší tichá páka je obyčejná <strong>chůze</strong> — kroky přes den spálí u většiny lidí víc než celý trénink."}, {"t": "p", "html": "A hlavně: chůze tě neunaví, nezvýší hlad ani chuť si to večer vynahradit jídlem — a dá se dělat každý den. Auto o kus dál, schody místo výtahu, telefonát za chůze — a máš +3 000 kroků, ani nevíš jak."}, {"t": "p", "html": "Kolik energie reálně potřebuješ a jak do toho kroky zapadají? Mrkni do kalkulačky:"}, {"t": "btn", "href": "https://martinbarna.cz/kalkulacka-kalorii-a-makrozivin/", "text": "Spočítat si to zdarma"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 14),

('longtail-consumer', 5, 'lc-5-koucink',
 $s$Napíšu ti to narovinu{{fn_suffix}}$s$,
 $h$Tipy jsou fajn. Výsledky dělá systém a vedení.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "posílám ti tipy už pár měsíců. A napíšu ti narovinu, co vidím za 13 let praxe: většina lidí nepotřebuje další tip. Potřebuje, aby jim to někdo <strong>nastavil na míru a vedl je</strong>, když přijde první zaváhání."}, {"t": "p", "html": "Přesně to dělám v koučinku 1:1: nastavím ti jídelníček i trénink na tvůj život (práce, směny, rodina), každé pondělí projdu tvůj report a upravím plán, a když si nevíš rady, píšeš mi na WhatsApp."}, {"t": "btn", "href": "https://martinbarna.cz/koucing/", "text": "Jak koučink funguje"}, {"t": "p", "html": "Ber to jako pozvánku, ne tlak. Jestli se chceš jen zeptat, jestli to pro tebe dává smysl — odepiš na tenhle mail, odpovídám osobně."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 14),

('longtail-consumer', 6, 'lc-6-vecer',
 $s$„Po šesté večer nejez." Vážně?$s$,
 $h$Tělo nemá budík. Rozhoduje celek dne.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "jeden z nejtužších mýtů vůbec: večerní jídlo se prý „ukládá do tuku“. Jenže tělo neřeší hodiny — řeší <strong>celkovou bilanci</strong>. Když jsi za den v deficitu, hubneš, i kdyby ta večeře byla v deset."}, {"t": "p", "html": "Naopak: zákaz večerního jídla často končí prohraným bojem s lednicí. Klidně si nech na večer největší jídlo dne, pokud ti to sedí. Systém má sloužit tobě, ne ty jemu."}, {"t": "p", "html": "Podobných mýtů koluje spousta — na blogu je postupně rozebírám s odkazy na studie:"}, {"t": "btn", "href": "https://martinbarna.cz/clanky/jist-vecer-tloustne.html", "text": "Přečíst rozbor mýtu"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 14),

('longtail-consumer', 7, 'lc-7-plato',
 $s$Váha se zasekla? Tohle zkontroluj, než snížíš kalorie$s$,
 $h$Plató většinou není plató.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "váha stojí dva týdny a první instinkt je „musím jíst míň“. Počkej. Z praxe je „zaseknutá váha“ nejčastěji něco jiného:"}, {"t": "bullets", "items": ["<strong>Povolená přesnost</strong> — porce nenápadně narostly, víkendy se přestaly počítat.", "<strong>Voda</strong> — stres, sůl, cyklus, nový trénink. Tuk jde dolů, váha to maskuje.", "<strong>Míň pohybu</strong> — tělo v deficitu šetří, kroky klesly, aniž o tom víš."]}, {"t": "p", "html": "Proto: nejdřív týden poctivě zapisuj a počítej <strong>týdenní průměr váhy</strong> i příjmu. Teprve když průměr fakt stojí 2–3 týdny, má smysl něco měnit — a to je poslední páka, ne první."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Celý postup krok za krokem: <a href='https://martinbarna.cz/clanky/namitky-proti-kalorickemu-deficitu.html'>na blogu</a>."}]$j$::jsonb,
 14),

('longtail-consumer', 8, 'lc-8-checklist',
 $s$Dárek: pondělní check-in na jednu stránku$s$,
 $h$5 minut týdně, které řídí celý tvůj pokrok.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "s klienty stojí celý můj koučink na jedné věci: <strong>pondělním check-inu</strong>. Pět minut, pár čísel — a přesně víš, jestli plán funguje, nebo je čas na úpravu. Bez emocí, podle dat."}, {"t": "p", "html": "Udělal jsem ti z toho checklist na jednu stránku — vytiskni si ho nebo si ho ulož a každé pondělí projeď:"}, {"t": "btn", "href": "https://martinbarna.cz/download/tydenni-checkin.pdf", "text": "Stáhnout check-in PDF"}, {"t": "p", "html": "Váha (týdenní průměr!), míry, energie, hlad, kroky, spánek. Kdo měří, ten řídí — kdo hádá, ten za měsíc končí."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 14),

('longtail-consumer', 9, 'lc-9-alkohol',
 $s$Zhubneš i s alkoholem? Co na to věda$s$,
 $h$Pivo, víno, panák — a přesto kila dolů.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "častá otázka: „Musím kvůli hubnutí přestat pít?“ Krátká odpověď: nemusíš. Sklenka vína k večeři párkrát týdně, <strong>započítaná do dne</strong>, ti výsledky nerozbije."}, {"t": "p", "html": "Háček je v tom, co se k pití váže: alkohol zvedne chuť a sníží zábrany — a kebab cestou domů nadělá víc škody než ten drink. A šest piv v pátek je jiná liga než sklenka k jídlu."}, {"t": "p", "html": "Celý rozbor i se studiemi (včetně toho, co alkohol dělá se spánkem a svaly) mám na blogu:"}, {"t": "btn", "href": "https://martinbarna.cz/clanky/alkohol-a-hubnuti.html", "text": "Přečíst na blogu"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 14),

('longtail-consumer', 10, 'lc-10-hlava',
 $s$Všechno, nebo nic — nejdražší nastavení hlavy$s$,
 $h$Perfektní týden neexistuje. Dobrý průměr ano.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "za ty roky jsem to viděl stokrát: člověk jede „na 100 %“, pak jedno vybočení — a v hlavě cvakne <strong>„stejně už je to v háji“</strong>. A z jednoho jídla je ztracený víkend, z víkendu týden."}, {"t": "p", "html": "Přitom rozdíl mezi lidmi, co formu mají, a těmi, co ji věčně honí, není v disciplíně. Je v tom, že ti první počítají <strong>průměr, ne dokonalost</strong>. Jeden špatný den v dobrém týdnu nic neznamená. Jediná opravdová chyba je den, který vzdáš celý."}, {"t": "p", "html": "Až se ti to příště stane, zkus jedinou větu: „Bylo to dobré. Teď se vracím k plánu.“ Bez viny, bez trestu, bez restartu v pondělí."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Jestli tenhle kolotoč jedeš dlouho a chceš ho ukončit jednou provždy, mrkni na <a href='https://martinbarna.cz/koucing/'>koučink</a> — přesně tohle s klienty řeším nejčastěji."}]$j$::jsonb,
 14),

('longtail-consumer', 11, 'lc-11-academy',
 $s$Kam dál{{fn_suffix}}? Tři cesty, jedna volba$s$,
 $h$Vlastní cestou, se systémem, nebo se mnou.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "půl roku ti posílám to nejlepší, co za 13 let praxe mám. Dnes to sečtu — na formu vedou tři cesty a je fér ti je ukázat vedle sebe:"}, {"t": "bullets", "items": ["<strong>Videokurz (800 Kč)</strong> — celý systém k samostudiu: výpočty, jídelníček, trénink, udržení. Doživotně. <a href='{{course_url}}'>Detail tady</a>.", "<strong>Koučink 1:1</strong> — nastavím ti všechno na míru a vedu tě týden po týdnu. Nejrychlejší cesta. <a href='https://martinbarna.cz/koucing/'>Jak funguje</a>.", "<strong>Barna Academy</strong> — pro ty, které to chytlo naplno (nebo chtějí pomáhat ostatním): 256 lekcí, generátory jídelníčků a tréninků, AI kouč a appka Tvůj Coach v ceně. <a href='https://martinbarna.cz/akademie/'>Mrkni tady</a>."]}, {"t": "p", "html": "Ať vybereš kteroukoli — principy už znáš. Teď je jen potřeba přestat sbírat tipy a začít jet systém."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Nevíš, která cesta je pro tebe? Odepiš mi jednou větou, co řešíš — poradím ti upřímně, i kdyby to znamenalo „nekupuj nic“."}]$j$::jsonb,
 null),

-- ================= LONGTAIL-TRENER (6× à 30 dní) =================

('longtail-trener', 0, 'lt-0-matematika',
 $s$Kolik si reálně vydělá trenér? Spočítej si strop$s$,
 $h$Žádné vymyšlené statistiky. Tři čísla.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "výdělek trenéra nebo výživového poradce není loterie — je to matematika tří čísel: <strong>kolik klientů × jaká cena × jak dlouho u tebe vydrží</strong>. Nic víc v tom není."}, {"t": "p", "html": "Příklad: 15 online klientů × 2 500 Kč měsíčně = 37 500 Kč. Při dobré retenci (a tu dělá kvalita vedení, ne marketing) je to stabilní byznys z domova. Škálovat pak můžeš cenou, ne počtem hodin."}, {"t": "p", "html": "Rozepsal jsem to celé i s reálnými čísly z praxe:"}, {"t": "btn", "href": "https://martinbarna.cz/clanky/kolik-si-vydela-trener-vyzivovy-poradce.html", "text": "Spočítat si vlastní strop"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 30),

('longtail-trener', 1, 'lt-1-prvniklient',
 $s$Prvních 5 klientů nezískáš reklamou$s$,
 $h$Postup z praxe, který funguje i s nulovým rozpočtem.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "nejčastější chyba začínajících trenérů: ještě nemají jediného klienta a už řeší logo, web a reklamy. Prvních 5 klientů ale nezískáš reklamou — získáš je <strong>ukázkou práce</strong>."}, {"t": "bullets", "items": ["Nabídni konzultaci zdarma 5 lidem z okolí — a odveď ji jako placenou.", "Každému nastav konkrétní první krok a za týden se sám ozvi, jak to jde.", "Z výsledků udělej příběhy (se svolením) — důkazy prodávají líp než sliby."]}, {"t": "p", "html": "Celý postup krok za krokem:"}, {"t": "btn", "href": "https://martinbarna.cz/clanky/jak-ziskat-prvni-klienty-trener-vyzivovy-poradce.html", "text": "Přečíst postup z praxe"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 30),

('longtail-trener', 2, 'lt-2-ai',
 $s$Trenéři, co umí AI, převálcují ty, co ji ignorují$s$,
 $h$Nikdo jiný v ČR tohle trenéry neučí.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "řeknu to bez obalu: AI ti nevezme klienty. Ale trenér, který ji umí použít, obslouží dvakrát víc klientů ve stejném čase — a to už na trhu poznat je."}, {"t": "p", "html": "Co s ní v praxi děláš: přípravu podkladů pro klienty, koncepty odpovědí na dotazy, obsah na sítě, rešerši studií. Rutina zmizí, tobě zůstane to, co AI neumí — vztah s klientem a rozhodování."}, {"t": "p", "html": "V <strong>Barna Academy</strong> je na tohle celý modul (M24 — AI pro trenéry a výživáře): konkrétní postupy, prompty a nástroje, žádné teoretické řeči. Pokud vím, nikdo jiný v ČR tohle trenéry systematicky neučí."}, {"t": "btn", "href": "https://martinbarna.cz/akademie/", "text": "Co všechno Academy obsahuje"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 30),

('longtail-trener', 3, 'lt-3-appka',
 $s$Tvoji klienti chtějí appku. Máš ji mít v ceně$s$,
 $h$Tvůj Coach — trackování, foto jídla, AI kouč.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "klient, který nezapisuje, se nedá vést — a klient, kterého zapisování otravuje, skončí do měsíce. Proto je appka pro tvoje klienty klíčová věc, ne hračka."}, {"t": "p", "html": "Členové Barna Academy mají v ceně appku <strong>Tvůj Coach</strong>: klient vyfotí jídlo a appka odhadne makra, cíle se adaptivně upravují podle reálného vývoje, a ty jako kouč vidíš data místo výmluv. K tomu AI kouč, který mluví mým systémem — žádné vymyšlené kalorie."}, {"t": "btn", "href": "https://martinbarna.cz/akademie/", "text": "Academy + appka v ceně"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 30),

('longtail-trener', 4, 'lt-4-generatory',
 $s$Kolik hodin týdně ti žerou jídelníčky?$s$,
 $h$Generátory v Academy: jídelníček i trénink pod tvou značkou.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "spočítej si to: jeden jídelníček na míru = 2–3 hodiny práce. Pět klientů = celý pracovní den měsíčně jen skládáním jídel do tabulek. A to nemluvím o tréninkových plánech."}, {"t": "p", "html": "V Academy na to máš <strong>generátory</strong>: jídelníček podle maker klienta, tréninkový plán, recepty s makry — všechno počítané z reálných hodnot potravin a exportované do PDF <strong>pod tvým logem a barvami</strong>. Klient dostane profi výstup, ty ušetříš hodiny."}, {"t": "p", "html": "Hodinová sazba trenéra × ušetřené hodiny — Academy se ti vrátí rychleji, než čekáš:"}, {"t": "btn", "href": "https://martinbarna.cz/akademie/", "text": "Prohlédnout nástroje Academy"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 30),

('longtail-trener', 5, 'lt-5-cena',
 $s$Zaváděcí cena Academy končí u 50. člena$s$,
 $h$8 900 Kč platí pro zakládající členy. Pak 12 900.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "poslední mail téhle série, tak narovinu: <strong>Barna Academy stojí 8 900 Kč jen pro prvních 50 zakládajících členů</strong>. Pak jde cena na 12 900 Kč — a to není marketingový trik, je to plán, který dodržím."}, {"t": "p", "html": "Co za to: 256 lekcí napříč 24 moduly (výživa, trénink, práce s klientem, byznys, AI), generátory jídelníčků a tréninků pod tvou značkou, appka Tvůj Coach pro tvoje klienty, certifikace. Doživotně, včetně všeho, co přibude."}, {"t": "p", "html": "Jde to i na splátky 3× 3 000 Kč."}, {"t": "btn", "href": "https://martinbarna.cz/akademie/", "text": "Přidat se za zaváděcí cenu"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Jestli váháš, jestli je Academy pro tebe — odepiš mi, na co konkrétně se chceš zeptat. Odpovídám osobně."}]$j$::jsonb,
 null),

-- ================= LONGTAIL-KUPCI (6× à 21 dní, kupci videokurzu po onboardingu) =================

('longtail-kupci', 0, 'lk-0-navrat',
 $s$Jedna lekce. Víc dnes nechci$s$,
 $h$Kurz nikam neuteče. Tvoje rozjetá forma ano.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "máš doživotní přístup k videokurzu — což je super, ale má to jeden háček: „doživotně“ svádí k „někdy příště“. A forma se dělá teď."}, {"t": "p", "html": "Nemusíš dohánět všechno. Otevři kurz, mrkni, kde máš rozkoukáno, a dej si <strong>jednu lekci</strong>. Trvá to pár minut — kurz si tvůj postup pamatuje:"}, {"t": "btn", "href": "https://martinbarna.cz/akademie/videokurz/", "text": "Pokračovat v kurzu"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 21),

('longtail-kupci', 1, 'lk-1-recepty',
 $s$Novinka v kurzu: generátor receptů$s$,
 $h$Recepty s makry na kliknutí. V ceně, kterou už máš.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "dobrá zpráva — do videokurzu jsem přidal <strong>generátor receptů</strong>: vybereš typ jídla a zaměření (vysoký protein, nízké kalorie…) a dostaneš recept se surovinami, postupem i makry na porci. Počítáno z reálných hodnot potravin, žádné odhady."}, {"t": "p", "html": "Najdeš ho v kurzu v sekci <strong>Přílohy ke stažení</strong> — spolu s kalkulačkou a víc než 20 dalšími materiály (mimochodem, přibyl tam i průvodce víkendovým přejídáním):"}, {"t": "btn", "href": "https://martinbarna.cz/akademie/videokurz/", "text": "Otevřít přílohy kurzu"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 21),

('longtail-kupci', 2, 'lk-2-vikendy',
 $s$Nejčastější důvod, proč to u lidí drhne$s$,
 $h$Není to jídelníček. Jsou to víkendy.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "když se klientů ptám, kde se jim to sype, skoro nikdy to není jídelníček z týdne. Jsou to <strong>víkendy</strong> — přes týden systém, o víkendu chaos, v pondělí výčitky."}, {"t": "p", "html": "Řešení je počítat <strong>týdenní průměr</strong> místo denní dokonalosti a víkend do plánu zabudovat dopředu. Přesný postup máš v kurzu v přílohách — průvodce <strong>Jak zvládnout víkendové přejídání</strong>:"}, {"t": "btn", "href": "https://martinbarna.cz/akademie/videokurz/", "text": "Stáhnout v přílohách kurzu"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 21),

('longtail-kupci', 3, 'lk-3-koucink',
 $s$Kurz ti dal systém. Chceš, ať ti ho nastavím já?$s$,
 $h$Koučink 1:1 — plán na míru + týdenní vedení.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "videokurz tě naučí, JAK to funguje. Co ale za tebe neudělá: nenastaví ti čísla na tvůj konkrétní život a nepodrží tě, když přijde první krize."}, {"t": "p", "html": "Přesně na to mám <strong>koučink 1:1</strong>: jídelníček i trénink na míru (práce, směny, rodina, zranění), pondělní check-iny s úpravou plánu podle dat a WhatsApp, když si nevíš rady. Kurz už máš za sebou, principy znáš — s vedením na míru pojedeš dvakrát rychleji."}, {"t": "btn", "href": "https://martinbarna.cz/koucing/", "text": "Jak koučink funguje"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 21),

('longtail-kupci', 4, 'lk-4-checkin',
 $s$5 minut v pondělí, které rozhodují o všem$s$,
 $h$Dárek: check-in checklist na jednu stránku.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "z kurzu víš, že se plán upravuje podle dat. Ale jaká data vlastně sbírat? Udělal jsem ti na to checklist na jednu stránku — <strong>pondělní check-in</strong>: váha (týdenní průměr!), míry, energie, hlad, kroky, spánek."}, {"t": "btn", "href": "https://martinbarna.cz/download/tydenni-checkin.pdf", "text": "Stáhnout check-in PDF"}, {"t": "p", "html": "Pět minut týdně. Kdo měří, ten řídí — kdo hádá, ten za měsíc skončí u další diety."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 21),

('longtail-kupci', 5, 'lk-5-academy',
 $s$Chytlo tě to? Máš slevu 800 Kč na Academy$s$,
 $h$Upgrade z videokurzu: kupón UPGRADE800.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "poslední mail téhle série. Jestli tě výživa a trénink chytly natolik, že chceš jít do hloubky — nebo dokonce pomáhat ostatním — je tu <strong>Barna Academy</strong>: 256 lekcí napříč 24 moduly, generátory jídelníčků a tréninků, AI kouč a appka Tvůj Coach v ceně."}, {"t": "p", "html": "A protože už máš videokurz, <strong>odečtu ti ho z ceny</strong>: s kupónem <strong>UPGRADE800</strong> máš Academy o 800 Kč levněji. Platí zaváděcí cena pro prvních 50 členů, pak zdražuji."}, {"t": "btn", "href": "https://martinbarna.cz/akademie/", "text": "Upgradovat na Academy"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Nevíš, jestli je Academy pro tebe? Odepiš mi, co tě láká — poradím upřímně."}]$j$::jsonb,
 null)

ON CONFLICT (track, step) DO UPDATE SET
  key = EXCLUDED.key, subject = EXCLUDED.subject, preheader = EXCLUDED.preheader,
  blocks = EXCLUDED.blocks, wait_days = EXCLUDED.wait_days, updated_at = now();

-- ============================================================
-- ENROLLMENT: dojeté leady → longtail větve (vzor enroll_into_nurture_videokurz)
-- ============================================================
create or replace function public.enroll_into_longtail(p_limit int default 50)
returns int language plpgsql security definer set search_path to 'public' as $function$
declare
  v_count int := 0;
  r record;
begin
  for r in
    with admins as (
      select lower(trim(x)) as email
      from unnest(string_to_array(coalesce((select value from app_config where key='admin_emails'),''), ',')) as x
      where trim(x) <> ''
    ),
    finished as (
      select distinct lower(l.email) as email,
        case
          when l.track = 'trener-kit' then 'longtail-trener'
          when l.track = 'onboarding-videokurz' then 'longtail-kupci'
          else 'longtail-consumer'
        end as target
      from leads l
      where l.status = 'active'
        and l.next_send_at is null
        and l.track in ('nurture-videokurz','lead-magnet-tool','trener-kit','onboarding-videokurz')
    ),
    elig as (
      select f.email, f.target from finished f
      where f.email not in (select email from admins)
        and f.email not in (select lower(email) from leads where track like 'longtail-%')
        and f.email not in (select lower(email) from leads where status in ('unsubscribed','bounced'))
        -- consumer větev prodává videokurz/koučink → ne pro majitele placených produktů;
        -- trener/kupci větev prodává Academy → ne pro členy Academy
        and not (f.target = 'longtail-consumer' and f.email in
          (select lower(email) from entitlements where active and product in ('videokurz','academy','coaching')))
        and not (f.target in ('longtail-trener','longtail-kupci') and f.email in
          (select lower(email) from entitlements where active and product in ('academy','coaching')))
    )
    select email, target from elig limit greatest(1, p_limit)
  loop
    update leads set track = r.target, step = 0, status = 'active', next_send_at = now(), updated_at = now()
     where lower(email) = r.email;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

-- CRON: denně 7:50 (po upsell-enroll 7:20 a nurture-enroll 7:35 — pořadí drží prioritu:
-- teplejší větve si leady rozeberou dřív, longtail bere až zbytek)
-- select cron.schedule('longtail-enroll-daily', '50 7 * * *', 'select public.enroll_into_longtail(50);');
