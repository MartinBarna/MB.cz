-- ============================================================
-- Barna Academy: LETNÍ RESET 2026-08 (sezónní kampaň na videokurz)
-- ⚠️ INERTNÍ SOUBOR. NESPOUŠTĚT při běžném deployi ani "pro jistotu".
--    Spouští se ručně dle runbooku _zdroje/promo-kalendar-h2.md (sekce SRPEN),
--    okno akce 3.–17. 8. 2026.
--
-- 4 maily, track 'letni-reset', odeslání den 0 / 3 / 7 / 10 od enrollu:
--   step 0 (den 0)   lr-0-audit     audit formy v půlce léta + kalkulačka a kvíz zdarma
--   step 1 (den 3)   lr-1-pasti     hodnota: 3 letní pasti + týdenní průměr, článek
--   step 2 (den 7)   lr-2-leto20    nabídka: videokurz se slevou 20 %, kód LETO20, Omnibus P.S.
--   step 3 (den 10)  lr-3-posledni  poslední den akce + P.S. konzultace
--
-- POZOR na sémantiku wait_days v drip-send: wait_days = pauza PO odeslání daného
-- kroku do kroku následujícího. Proto tu je 3/4/3/null, což dává požadovaný rytmus
-- odeslání 0/3/7/10 (rozestupy 3, 4 a 3 dny). Poslední krok null = konec tracku.
--
-- Podmíněnosti (detaily a přesné příkazy řeší runbook, tady jen připomínka):
--   • Kód LETO20 (sleva 20 % na videokurz) se vytváří v SimpleShopu až při spuštění
--     akce. Do té doby šablony jen leží v DB a nikomu nic neslibují (track nemá enroll).
--   • {{course_price}} a {{discount2_price}} plní drip-send (COURSE_PRICE=800,
--     DISCOUNT2_PCT=20, tedy 640 Kč). {{discount2_price}} sedí s LETO20 jen dokud je
--     DISCOUNT2_PCT v drip-send rovno 20. Před spuštěním OVĚŘIT v index.ts.
--   • drip-send shouldStop() nezná 'letni-reset', takže kupec z průběhu akce by dostal
--     i zbylé maily. Před spuštěním doplnit stop-po-nákupu (jednořádkovka, viz runbook).
--
-- Copy: gender-neutrální (cílový pool má smíšené a neznámé segmenty), tykání malým
-- „ti/tě" dle mailing revize 2026-07. INSERT je idempotentní (on conflict do nothing),
-- existující šablony nikdy nepřepíše.
-- ============================================================

insert into public.email_templates (track, step, key, subject, preheader, blocks, wait_days) values

-- ===== step 0 (den 0): audit formy + nástroje zdarma =====
('letni-reset', 0, 'lr-0-audit',
 $s$Léto je v půlce. Jak držíš formu?$s$,
 $h$Rychlý audit na 2 minuty + kalkulačka a kvíz zdarma.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"půlka léta je za námi a právě teď se rozhoduje, v jaké formě přijdeš do září. Nemusíš nic drasticky měnit. Jen si udělej rychlý audit, tři věci, dvě minuty:"},{"t":"bullets","items":["<strong>Váha:</strong> zvaž se tři rána po sobě nalačno a vezmi průměr. Jedno číslo lže, průměr ne.","<strong>Míry:</strong> změř si pas. Metr ukáže pravdu i ve dnech, kdy váhu mate voda po slaném večeru.","<strong>Jídlo:</strong> ruku na srdce, hlídáš přes den bílkoviny, nebo jedeš na tom, co je zrovna po ruce?"]},{"t":"p","html":"Když ti čísla nesedí s tím, co chceš, žádná panika a žádná dieta od pondělí. Většinou stačí přepočítat si příjem podle aktuální váhy a pohybu:"},{"t":"btn","href":"https://martinbarna.cz/kalkulacka-kalorii-a-makrozivin/","text":"Spočítat kalorie a makra zdarma"},{"t":"p","html":"A jestli chceš vědět, kde přesně se ti to sype, mrkni na <a href='https://martinbarna.cz/kviz/'>můj kvíz</a>. 5 otázek, 60 vteřin, řeknu ti to narovinu."},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 3),

-- ===== step 1 (den 3): hodnota, 3 letní pasti + týdenní průměr =====
('letni-reset', 1, 'lr-1-pasti',
 $s$3 letní pasti, co ti potichu bourají formu$s$,
 $h$Zmrzlina, grilovačky, dovolená. Takhle je přežiješ.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"v létě nepotkávám lidi, co přestali makat. Potkávám lidi, které potopily tři nenápadné věci:"},{"t":"bullets","items":["<strong>Zmrzlina.</strong> Jedna tě nepotopí. Past je „každý den dvě, protože je vedro“. Klidně si ji dej, ale ber ji jako jídlo, ne jako vzduch: započítej ji do dne.","<strong>Grilovačky.</strong> Klobásy, majonézové saláty a pár piv udělají za večer víc než celý den poctivého jídla. Na akci si dej hlavně maso a zeleninu, pití si ohlídej a den okolo drž lehčí.","<strong>Dovolená.</strong> Týden „bez pravidel“ umí smazat měsíc práce. Stačí dvě kotvy: bílkoviny v každém jídle a denně dost kroků. Zbytek si užij bez výčitek."]},{"t":"p","html":"A hlavní trik na celé léto: nehodnoť jednotlivé dny, hodnoť <strong>týdenní průměr</strong>. Jeden bujarý večer se v něm ztratí, když ho zbytek týdne vyrovná. Jak na to v praxi, krok za krokem:"},{"t":"btn","href":"https://martinbarna.cz/clanky/vikendove-prejidani.html","text":"Přečíst: jak si užít víkend a nezbourat týden"},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 4),

-- ===== step 2 (den 7): nabídka videokurz −20 %, kód LETO20 =====
-- Omnibus věta v P.S. (běžná cena posledních 30 dní) je povinná, nemazat.
('letni-reset', 2, 'lr-2-leto20',
 $s$Letní reset: −20 % na videokurz (kód LETO20)$s$,
 $h$Celý systém pohromadě. Sleva platí jen pár dní.$h$,
 $j$[{"t":"p","html":"Čus{{fn_space}},"},{"t":"p","html":"poslední maily byly střípky: audit, letní pasti, týdenní průměr. Jestli chceš celý systém pohromadě, od výpočtu příjmu přes stavbu jídelníčku po udržení formy, mám pro tebe letní nabídku:"},{"t":"p","html":"<strong>Videokurz výživy se slevou 20 %.</strong> V košíku zadáš kód <strong>LETO20</strong> a z {{course_price}} Kč je <strong>{{discount2_price}} Kč</strong>. Doživotní přístup, žádné měsíční platby."},{"t":"bullets","items":["naučíš se, kolik reálně jíst, ať jde váha dolů bez hladovek","poskládáš si jídelníček z jídel, co ti chutnají, žádné krabičky podle cizího vkusu","zmrzlina i grilovačka se do něj vejdou, přesně jak jsem psal minule"]},{"t":"btn","href":"{{course_url}}","text":"Vzít videokurz s kódem LETO20"},{"t":"p","html":"Kód platí jen po dobu letní akce, pak ho vypínám. Žádný věčný odpočet.<br><strong>Be Effective!</strong><br>Martin"},{"t":"ps","html":"P.S. Běžná cena videokurzu je {{course_price}} Kč a stejná byla i posledních 30 dní, žádné umělé zdražení před slevou."}]$j$::jsonb,
 3),

-- ===== step 3 (den 10): poslední den akce + P.S. konzultace =====
('letni-reset', 3, 'lr-3-posledni',
 $s$Dnes večer končí LETO20$s$,
 $h$Poslední den letní slevy 20 % na videokurz.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"jen krátká připomínka: dnes je poslední den letní akce. Večer kód <strong>LETO20</strong> vypínám a videokurz se vrací na běžných {{course_price}} Kč (stejná cena platila i posledních 30 dní, žádné triky před slevou)."},{"t":"p","html":"Jestli si celé léto říkáš „až bude klid“, tohle je ta chvíle. Klidnější už to nebude. Jednodušší ano: systém, co ti řekne, co a kolik jíst, a zůstane ti napořád."},{"t":"btn","href":"{{course_url}}","text":"Dokončit s kódem LETO20 ({{discount2_price}} Kč)"},{"t":"p","html":"Ať se rozhodneš jakkoliv, měj skvělý zbytek léta.<br><strong>Be Effective!</strong><br>Martin"},{"t":"ps","html":"P.S. Slevy nejsou tvoje téma? Jestli chceš spíš probrat svoji situaci jeden na jednoho, mrkni na <a href='https://martinbarna.cz/konzultace/'>konzultaci</a>. Odejdeš s jasným plánem na míru."}]$j$::jsonb,
 null)

on conflict (track, step) do nothing;
