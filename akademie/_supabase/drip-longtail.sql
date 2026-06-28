-- ============================================================
-- Barna Academy - DRIP: LONG-TAIL rozsireni lead-magnet sekvence
-- Spust PO drip-engine.sql a drip-templates.sql. Upsert podle (track, step).
--
-- CO TO DELA: za prodejni "naval" (kroky 0-5, dny 0-19) navazuje dlouhy ocas
-- HODNOTOVYCH mailu po ~12-14 dnech. Drzi lead v teple mesice, nevali prodej.
-- Mix presne jak chtel Martin: pár dní rozjezd -> pak hodnota 1x za ~2 tydny.
-- Kazdy mail = 1 uziteccna vec + mekka vyzva (clanek / free lekce / kurz / 1:1).
--
-- Krok 6 byl drive 'affiliate' (konec). Tady ho prepisujeme na zacatek
-- long-tailu a affiliate posouvame na uplny konec (krok 14, wait null).
-- Copy v Martinove hlase (Be Effective!, tykani). Tokeny:
--   gender: [[zena||muz]] a [a]   |   merge: {{...}}
-- ============================================================

insert into public.email_templates (track, step, key, subject, preheader, blocks, wait_days) values

-- ===== LONG-TAIL: lead-magnet (hodnotovy ocas, ~1x za 12-14 dni) =====

('lead-magnet', 6, 'lt-spanek',
 $s$Tajná zbraň hubnutí, na kterou všichni serou$s$,
 $h$Spánek. Vážně. A za chvíli pochopíš proč.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Můžeš mít perfektní jídelníček i trénink — a stejně Ti to nepůjde, když spíš 5 hodin. Málo spánku zvedá chuť na sladké, sahá Ti na vůli a tělo si víc drží tuk. To není teorie, to vidím u klientů pořád."},{"t":"p","html":"Tři věci, co zaberou hned dnes večer:"},{"t":"bullets","items":["<strong>Pevný čas spánku</strong> — i o víkendu. Tělo miluje rytmus.","<strong>Hodinu před spaním pryč od telefonu</strong> (aspoň ho ztlum a uber jas).","<strong>Poslední kafe do 14:00</strong> — kofein v těle straší klidně 8 hodin."]},{"t":"p","html":"Rozepsal jsem to do detailu tady — pět minut čtení, co Ti může změnit ráno:"},{"t":"btn","text":"Přečíst: Málo spánku a hubnutí","href":"https://martinbarna.cz/clanky/malo-spanku-a-hubnuti.html"},{"t":"p","html":"Zkus dnes aspoň jeden bod. Drobnost, co dělá velký rozdíl.<br><strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 12),

('lead-magnet', 7, 'lt-kroky',
 $s$Nemusíš běhat. Vážně.$s$,
 $h$Nejvíc kalorií spálíš úplně mimo posilovnu.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Lidi si myslí, že hubnutí = dřít se do němoty v posilce. Pravda je nuda: nejvíc energie za den spálíš <strong>obyčejným pohybem</strong> — chůzí, schody, úklidem. Odborně se tomu říká NEAT a u většiny lidí to rozhodne víc než hodina kardia."},{"t":"p","html":"Co s tím prakticky:"},{"t":"bullets","items":["Dej si cíl <strong>kroků</strong>, ne hodin v posilce. Klidně začni tam, kde jsi teď, a přidej 1500 denně.","Telefonuješ? Choď u toho.","Auto/MHD o zastávku dál. Schody místo výtahu. Nuda, ale funguje."]},{"t":"p","html":"Kolik kroků vlastně dává smysl (a proč ne vždycky 10 000) jsem rozebral tady:"},{"t":"btn","text":"Přečíst: Kolik kroků denně na hubnutí","href":"https://martinbarna.cz/clanky/kolik-kroku-denne-chuze-na-hubnuti.html"},{"t":"p","html":"Žádná dřina, jen pohyb navíc. Zvládneš.<br><strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 12),

('lead-magnet', 8, 'lt-bilkoviny',
 $s$Kdybys měl[a] řešit jen jednu věc v jídle$s$,
 $h$Tohle je ta jedna věc. Bílkovina.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Kdyby sis z celé výživy měl[a] zapamatovat <strong>jedinou věc</strong>, je to tahle: dostatek bílkovin. Zasytí Tě na hodiny, drží svaly (i když hubneš) a sama o sobě Ti pomůže sníst míň, aniž bys [[trpěla||trpěl]] hlady."},{"t":"p","html":"Jednoduché vodítko bez vážení:"},{"t":"bullets","items":["<strong>Bílkovina v každém jídle</strong> — maso, ryba, vejce, tvaroh, luštěniny.","Velikost porce zhruba jako <strong>tvoje dlaň</strong>.","Snídaně bývá nejslabší — přidej tam vejce nebo skyr a uvidíš rozdíl v chuti k jídlu přes den."]},{"t":"p","html":"Kolik přesně a z čeho (a proč to není jen pro „kulturisty“) tady:"},{"t":"btn","text":"Přečíst: Bílkoviny — kolik a proč","href":"https://martinbarna.cz/clanky/bilkoviny.html"},{"t":"p","html":"Jedna změna, velký dopad. <strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 14),

('lead-magnet', 9, 'lt-kurz-mekce',
 $s$Co je vlastně uvnitř videokurzu (bez keců)$s$,
 $h$Žádný prodej. Jen Ti ukážu, co bys dostal[a].$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Pár mých tipů už máš za sebou. Možná Tě napadlo: <em>„a co je teda v tom kurzu?“</em> Tak narovinu, bez tlaku — tohle se uvnitř naučíš:"},{"t":"bullets","items":["jak si <strong>[[sama||sám]] poskládáš jídelníček</strong> z jídel, co Ti chutnají (ne striktní rozpis, co po týdnu vzdáš)","kolik jíst, abys hubnul[a], ale neztrácel[a] svaly a energii","jak <strong>nepřibrat zpátky</strong> — konec jojo kolečka","flexibilní stravování: pizza i řízek se do toho vejdou"],"":""},{"t":"p","html":"Pořád platí — <strong>první lekce si pustíš zdarma a bez karty</strong>. Mrkni dovnitř, ať víš, do čeho bys šel/šla:"},{"t":"btn","text":"Prohlédnout videokurz zdarma","href":"{{free_lessons_url}}"},{"t":"p","html":"Klidně si jen koukni. Nikam nespěcháme.<br><strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 14),

('lead-magnet', 10, 'lt-jojo',
 $s$Proč většina diet selže (a není to tvoje vina)$s$,
 $h$Jde o systém, ne o sílu vůle.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Když Ti někdy dieta nevyšla, nejspíš sis řekl[a], že seš [[slabá||slabý]]. Nejsi. Většina diet je postavená tak, že <strong>musí</strong> selhat — moc tvrdé, moc zákazů, žádný plán, co dělat pak. Tělo se brání a ono kilo se vrátí i s kamarády."},{"t":"p","html":"Co dělat jinak:"},{"t":"bullets","items":["Nejdi do extrému. <strong>Mírný deficit</strong>, který vydržíš, vyhraje nad hladovkou.","Měj plán i na „potom“ — návrat k normálu se dá udělat chytře (ne nárazem).","Neřeš dokonalost. Řeš, abys to <strong>ustál[a] dlouhodobě</strong>."]},{"t":"p","html":"Celý mechanismus jojo efektu (a jak z něj ven) jsem rozebral tady:"},{"t":"btn","text":"Přečíst: Jojo efekt — proč a jak ven","href":"https://martinbarna.cz/clanky/jojo-efekt.html"},{"t":"p","html":"Není to o vůli. Je to o systému. A ten se dá naučit.<br><strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 14),

('lead-magnet', 11, 'lt-konzultace',
 $s$Chceš to vzít za pevný konec se mnou?$s$,
 $h$Pro ty, co nechtějí tápat sami.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Někomu sednou tipy a kurz a rozjede to [[sama||sám]] — a to je super. Ale občas je rychlejší, když Ti někdo řekne narovinu, co konkrétně Ty máš změnit, a hlídá Tě, abys u toho [[zůstala||zůstal]]."},{"t":"p","html":"Když chceš tohle, mám dvě cesty:"},{"t":"bullets","items":["<strong>Konzultace</strong> — sedneme si nad Tvojí situací, odejdeš s jasným plánem na míru.","<strong>Koučink</strong> — vedu Tě dlouhodobě: jídlo, trénink i návyky, a hlavně nezůstaneš na to [[sama||sám]]."]},{"t":"btn","text":"Mrknout na konzultaci","href":"https://martinbarna.cz/konzultace/"},{"t":"p","html":"Nehodí se to každému a to je v pohodě — ale jestli cítíš, že [[sama||sám]] se v tom motáš, tohle je nejrychlejší zkratka. Napiš mi klidně na WhatsApp, řekneme si, jestli to dává smysl.<br><strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 14),

('lead-magnet', 12, 'lt-alkohol',
 $s$Svatba, oslava, pátek… a co teď s tím?$s$,
 $h$Hubnout a mít život jde dohromady.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Nejčastější strašák: <em>„mám akci, je to v háji“</em>. Není. Jeden večer Ti formu nezničí — stejně jako jeden zdravý oběd nikoho neudělá [[hubenou||hubeným]]. Rozhoduje, co děláš <strong>většinu času</strong>, ne ta výjimka."},{"t":"p","html":"Jak akci ustát bez výčitek:"},{"t":"bullets","items":["Přes den jez normálně, hlavně <strong>bílkovinu</strong> — nechoď na akci [[vyhladovělá||vyhladovělý]].","Vyber si, co Ti za to stojí (pití NEBO dezert, ne všechno).","Druhý den se prostě vrať k plánu. Žádné „od pondělí znovu“."]},{"t":"p","html":"Konkrétně o alkoholu a hubnutí (kolik to vlastně stojí) tady:"},{"t":"btn","text":"Přečíst: Alkohol a hubnutí","href":"https://martinbarna.cz/clanky/alkohol-a-hubnuti.html"},{"t":"p","html":"Žít a držet formu jde dohromady. O tom to celé je.<br><strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 14),

('lead-magnet', 13, 'lt-hlava',
 $s$Když se nechce. Co s tím.$s$,
 $h$Motivace přijde a odejde. Systém zůstává.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Pravda, kterou Ti nikdo neřekne: <strong>motivaci mít nebudeš pořád</strong>. A je to jedno. Lidi, co drží formu roky, nejsou víc [[motivovaná||motivovaný]] — mají jen pár návyků, co jedou i ve dnech, kdy se jim nechce."},{"t":"p","html":"Co pomáhá, když to nejde:"},{"t":"bullets","items":["Zmenši krok. Nechce se Ti do posilky? Dej si <strong>10 minut procházku</strong>. Skoro vždycky pak uděláš víc.","Pohyb zvedá náladu líp než ležení (a není to fráze — funguje to i na hlavu).","Neřeš celý měsíc. Řeš <strong>dnešek</strong>."]},{"t":"p","html":"Proč pohyb dělá dobře i hlavě jsem psal tady:"},{"t":"btn","text":"Přečíst: Pohyb a nálada","href":"https://martinbarna.cz/clanky/pohyb-a-nalada.html"},{"t":"p","html":"Nemusíš to dát [[sama||sám]] a nemusíš to dát dokonale. Stačí to dát dnes.<br><strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 14),

('lead-magnet', 14, 'lt-affiliate',
 $s$Díky, že tu jsi 🙏 (a malá prosba)$s$,
 $h$Teď budu psát míň — ale jsem tu pořád.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Posílal jsem Ti pár týdnů tipy a snad Ti aspoň něco z toho pomohlo. Teď ubrnkám plyn — psát budu míň, ať Tě nezahltím. Ale <strong>jsem tu</strong>: kdykoliv něco potřebuješ, stačí odpovědět na tenhle mail nebo napsat na WhatsApp."},{"t":"p","html":"A jedna prosba: <strong>znáš někoho</strong>, kdo se trápí se stravou a pořád to vzdává? Pošli mu plán zdarma, ať má od čeho se odrazit:"},{"t":"btn","text":"Poslat plán zdarma dál","href":"{{plan_page_url}}"},{"t":"p","html":"Až spustíme <strong>doporučovací program</strong>, dostaneš za každého, koho přivedeš, odměnu (sleva pro kamaráda + bonus pro Tebe). Dám Ti vědět mezi prvními."},{"t":"p","html":"Drž se a jedeme bomby!<br><strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 null)

on conflict (track, step) do update set
  key = excluded.key, subject = excluded.subject, preheader = excluded.preheader,
  blocks = excluded.blocks, wait_days = excluded.wait_days, updated_at = now();
