-- ============================================================
-- Barna Academy - DRIP: copy mailu (email_templates) - finalni stav
-- Spust PO drip-engine.sql. Upsert podle (track, step) -> re-runnatelne.
-- Copy v Martinove hlase (Be Effective!, tykani). Tokeny:
--   gender: [[zena||muz]] a [a]   |   merge: {{...}}
-- POZN.: zive texty edituj primo v DB (email_templates) - DB je zdroj pravdy;
--        tenhle soubor je verzovany zaznam/backup.
-- ============================================================

insert into public.email_templates (track, step, key, subject, preheader, blocks, wait_days) values

-- ===== TRACK: lead-magnet (novy lead z webu) =====
('lead-magnet', 0, 'doruceni',
 $s$Tady máš svůj plán{{fn_suffix}} 💪$s$,
 $h$Otevři, stáhni a rovnou se do toho dáme.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}}!"},{"t":"p","html":"Tak jak jsem slíbil — přece sis nemyslel[a], že Ti nepošlu aspoň přílohu :) Tady je tvůj <strong>7denní [[makro plán||plán „forma zpět“]]</strong>:"},{"t":"btn","text":"Stáhnout plán","href":"{{lead_magnet_url}}"},{"t":"p","html":"Co s tím:"},{"t":"bullets","items":["Otevři ho ještě dnes a mrkni na <strong>den 1</strong> — žádná věda, jasné porce, běžné potraviny.","Nemusíš nic vážit ani počítat. Stačí jet podle plánu.","Nejde o dokonalost. Jde o to <strong>začít</strong> a být v tom [[poctivá sama||poctivý sám]] k sobě."]},{"t":"p","html":"Příští dny Ti pošlu pár věcí, co dělají u mých klientů největší rozdíl — krátce a k věci, žádné romány."},{"t":"p","html":"Drž se, ozvi se klidně kdykoliv. <strong>Be Effective!</strong><br>Martin"},{"t":"ps","html":"P.S. Odpověz mi na tenhle mail jednou větou: co je teď tvoje největší překážka? Čtu si to."}]$j$::jsonb,
 2),
('lead-magnet', 1, 'chyba',
 $s$Chyba č. 1, na které lidi shoří$s$,
 $h$A není to „málo silné vůle“.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Za roky praxe a 600+ proměn vidím pořád dokola jednu věc: lidi to vzdají <strong>po prvním malém úspěchu</strong>. Zhubnou dvě kila, uchlácholí se — a vrátí se do starých kolejí."},{"t":"p","html":"Hubnutí není sprint, je to <strong>maraton</strong>. A váha bude kolísat, i když děláš všechno správně (tohle musím klientům opakovat pořád :-D). Den nahoru neznamená, že nefunguješ."},{"t":"p","html":"Co s tím dneska:"},{"t":"bullets","items":["Neřeš jeden den. Řeš <strong>týdenní průměr</strong>.","Někdy je <strong>udržení místo přibrání taky výhra</strong>.","Buď k sobě [[poctivá||poctivý]] — když si „nemažeš med kolem huby“ a vidíš, žes snědl[a] víc, jsi o krok dál než většina."]},{"t":"p","html":"Za dva dny Ti ukážu, jak jíst flexibilně, aby ses nemusel[a] vzdávat oblíbených jídel."},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 2),
('lead-magnet', 2, 'flexibilne',
 $s$Jak jíst řízek a pizzu a stejně zhubnout$s$,
 $h$Žádné zakázané jídlo. Vážně.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Nejčastější mýtus: „abych zhubl[a], musím vyřadit X“. Nemusíš."},{"t":"p","html":"Funguje to jednoduše — <strong>neprodávám ryby, učím rybařit</strong>. Místo striktního jídelníčku Tě naučím, jak si jídlo poskládáš [[sama||sám]] z toho, co Ti chutná a na co máš „rozpočet“ (kalorií a bílkovin). Pak si dáš i pizzu a pořád jedeš dolů."},{"t":"p","html":"3 věci, co fungují hned:"},{"t":"bullets","items":["<strong>Bílkovina v každém jídle</strong> — zasytí a drží svaly.","<strong>Nejdřív zelenina a bílkovina, pak zbytek</strong> — automaticky sníš míň, bez hladu.","<strong>Plánuj dopředu</strong> — méně rozhodování = víc úspěchu."]},{"t":"p","html":"Tohle všechno (a mnohem víc) Tě krok za krokem provedu ve videokurzu — a <strong>první lekce si můžeš pustit zdarma</strong>. Stačí se zaregistrovat, žádná karta:"},{"t":"btn","text":"Pustit první lekce videokurzu zdarma","href":"{{free_lessons_url}}"},{"t":"p","html":"Mrkni, jak to vypadá uvnitř. Dneska ale hlavně zkus ten bod 1 ✅ — a jestli Ti ochutnávka sedne, o celém kurzu si řekneme příště."},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 2),
('lead-magnet', 3, 'kurz-nabidka',
 $s$Chceš to celé, krok za krokem?$s$,
 $h$Videokurz výživy — všechno, co učím klienty, na jednom místě.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Plán máš, pár principů taky a třeba sis pustil[a] i první lekce videokurzu zdarma. Jestli chceš <strong>celý systém</strong> — ne jen ochutnávku — mám pro Tebe celý <strong>Videokurz výživy</strong>."},{"t":"p","html":"Je to všechno, co roky učím své klienty za tisíce korun měsíčně, sepsané a natočené tak, aby to pochopil úplný začátečník:"},{"t":"bullets","items":["jak si <strong>[[sama||sám]] sestavíš jídelníček</strong>, který Tě baví a funguje","jak <strong>nepřibrat zpátky</strong> (konec jojo efektu)","bílkoviny, kalorie, flexibilní stravování — prakticky, bez vědeckých keců","doživotní přístup, koukáš kdy chceš"]},{"t":"btn","text":"Chci videokurz za {{course_price}} Kč","href":"{{course_url}}"},{"t":"p","html":"Jeden řízek navíc týdně Tě stojí víc. Tohle Ti zůstane napořád."},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"},{"t":"ps","html":"P.S. Máš dotaz, jestli je to pro Tebe? Napiš mi na WhatsApp, však víš :) Řeknu Ti narovinu."}]$j$::jsonb,
 3),
('lead-magnet', 4, 'sleva',
 $s${{fn_prefix}}mám pro Tebe -{{discount_pct}} %$s$,
 $h$Krátké okno, ať Tě to nakopne.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Vím, jak to chodí — „udělám to později“. A později nikdy nepřijde :)"},{"t":"p","html":"Ať Tě nakopnu: na <strong>Videokurz výživy</strong> Ti dávám <strong>slevu {{discount_pct}} %</strong> s kódem <strong>{{discount_code}}</strong> — z {{course_price}} Kč je <strong>{{discount_price}} Kč</strong>. Kód je jen pro Tebe (1× na e-mail)."},{"t":"btn","text":"Odemknout kurz se slevou","href":"{{course_url}}"},{"t":"p","html":"Nečekej na „ideální pondělí“. Ideální je teď. Zvládneš to."},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 5),
('lead-magnet', 5, 'sleva2',
 $s${{fn_prefix}}poslední šance — sleva 20 % na videokurz$s$,
 $h$Posílám lepší cenu, než zavřu krám :)$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"kód na 15 % jsi nechal[a] ležet — chápu, život je rychlý. Tak přitlačím naposledy: na <strong>Videokurz výživy</strong> Ti dávám <strong>slevu 20 %</strong> s kódem <strong>JESTE20</strong> — z 800 Kč je <strong>640 Kč</strong>."},{"t":"p","html":"Líp už to nebude — tohle je nejnižší cena, za kterou kurz pustím. Kód je jen pro Tebe a platí jen chvíli."},{"t":"btn","text":"Chci kurz za 640 Kč","href":"{{course_url}}"},{"t":"p","html":"Žádné kázání. Buď do toho jdeš teď, nebo Ti budu fandit z dálky — ale věřím, že to dáš. 💪"},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 5),
('lead-magnet', 6, 'affiliate',
 $s$Znáš někoho, kdo to taky řeší?$s$,
 $h$Pošli to dál — vyhrajete oba.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Ať už ses do toho pustil[a] naplno, nebo zatím jedeš podle plánu — díky, že jsi tady."},{"t":"p","html":"Jednu prosbu i nabídku: <strong>znáš někoho</strong>, kdo se trápí se stravou a pořád to vzdává? Pošli mu tenhle odkaz na plán zdarma:"},{"t":"btn","text":"[[martinbarna.cz/makro-plan||martinbarna.cz/forma-zpet]]","href":"{{plan_page_url}}"},{"t":"p","html":"A až spustíme <strong>doporučovací program</strong>, dostaneš za každého, koho přivedeš, <strong>odměnu</strong> (sleva pro kamaráda + bonus pro Tebe — cash, nebo ještě výhodnější kredit do našeho ekosystému). Dám Ti vědět mezi prvními."},{"t":"p","html":"Drž se a jedeme bomby!<br><strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 null),

-- ===== TRACK: existing-leadmagnet (bridge - uz maji PDF) =====
('existing-leadmagnet', 0, 'videokurz-ochutnavka',
 $s$Přidal jsem Ti videokurz zdarma 🎁$s$,
 $h$Ochutnávka videokurzu výživy — první lekce na mě.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"před časem sis ode mě stáhl[a] <strong>[[makro plán||plán „forma zpět“]]</strong> — tak koukám, jak se daří 💪 Ať máš od čeho se odrazit dál, <strong>otevřel jsem Ti zdarma ochutnávku videokurzu výživy</strong>."},{"t":"p","html":"Je to přesně to, co roky učím klienty — jen sepsané a natočené:"},{"t":"bullets","items":["<strong>Bílkovina v každém jídle</strong> — zasytí a drží svaly.","<strong>Nejdřív zelenina a bílkovina, pak zbytek</strong> — sníš míň, bez hladu.","<strong>Plánuj dopředu</strong> — míň rozhodování, víc úspěchu."]},{"t":"p","html":"První lekce si pustíš <strong>zdarma a bez karty</strong>, stačí se zaregistrovat:"},{"t":"btn","text":"Pustit videokurz zdarma","href":"{{free_lessons_url}}"},{"t":"p","html":"Mrkni dovnitř, ať víš, do čeho jdeš. Jestli Ti to sedne, o celém kurzu si řekneme za pár dní. <strong>Neprodávám ryby — učím rybařit.</strong>"},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"},{"t":"ps","html":"P.S. Nemáš už plán po ruce? Napiš a pošlu Ti ho znovu."}]$j$::jsonb,
 3),
('existing-leadmagnet', 1, 'kurz-nabidka',
 $s$Chceš to celé, krok za krokem?$s$,
 $h$Videokurz výživy — všechno, co učím klienty, na jednom místě.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Plán máš, ochutnávku videokurzu taky. Jestli chceš <strong>celý systém</strong> — ne jen pár lekcí — mám pro Tebe celý <strong>Videokurz výživy</strong>."},{"t":"p","html":"Je to všechno, co roky učím své klienty za tisíce korun měsíčně, sepsané a natočené tak, aby to pochopil úplný začátečník:"},{"t":"bullets","items":["jak si <strong>[[sama||sám]] sestavíš jídelníček</strong>, který Tě baví a funguje","jak <strong>nepřibrat zpátky</strong> (konec jojo efektu)","bílkoviny, kalorie, flexibilní stravování — prakticky, bez vědeckých keců","doživotní přístup, koukáš kdy chceš"]},{"t":"btn","text":"Chci videokurz za {{course_price}} Kč","href":"{{course_url}}"},{"t":"p","html":"Jeden řízek navíc týdně Tě stojí víc. Tohle Ti zůstane napořád."},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"},{"t":"ps","html":"P.S. Máš dotaz, jestli je to pro Tebe? Napiš mi na WhatsApp, však víš :) Řeknu Ti narovinu."}]$j$::jsonb,
 3),
('existing-leadmagnet', 2, 'sleva',
 $s${{fn_prefix}}mám pro Tebe -{{discount_pct}} %$s$,
 $h$Krátké okno, ať Tě to nakopne.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Vím, jak to chodí — „udělám to později“. A později nikdy nepřijde :)"},{"t":"p","html":"Ať Tě nakopnu: na <strong>Videokurz výživy</strong> Ti dávám <strong>slevu {{discount_pct}} %</strong> s kódem <strong>{{discount_code}}</strong> — z {{course_price}} Kč je <strong>{{discount_price}} Kč</strong>. Kód je jen pro Tebe (1× na e-mail)."},{"t":"btn","text":"Odemknout kurz se slevou","href":"{{course_url}}"},{"t":"p","html":"Nečekej na „ideální pondělí“. Ideální je teď. Zvládneš to."},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 5),
('existing-leadmagnet', 3, 'sleva2',
 $s${{fn_prefix}}poslední šance — sleva 20 % na videokurz$s$,
 $h$Posílám lepší cenu, než zavřu krám :)$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"kód na 15 % jsi nechal[a] ležet — chápu, život je rychlý. Tak přitlačím naposledy: na <strong>Videokurz výživy</strong> Ti dávám <strong>slevu 20 %</strong> s kódem <strong>JESTE20</strong> — z 800 Kč je <strong>640 Kč</strong>."},{"t":"p","html":"Líp už to nebude — tohle je nejnižší cena, za kterou kurz pustím. Kód je jen pro Tebe a platí jen chvíli."},{"t":"btn","text":"Chci kurz za 640 Kč","href":"{{course_url}}"},{"t":"p","html":"Žádné kázání. Buď do toho jdeš teď, nebo Ti budu fandit z dálky — ale věřím, že to dáš. 💪"},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 5),
('existing-leadmagnet', 4, 'affiliate',
 $s$Znáš někoho, kdo to taky řeší?$s$,
 $h$Pošli to dál — vyhrajete oba.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Ať už ses do toho pustil[a] naplno, nebo zatím jedeš podle plánu — díky, že jsi tady."},{"t":"p","html":"Jednu prosbu i nabídku: <strong>znáš někoho</strong>, kdo se trápí se stravou a pořád to vzdává? Pošli mu tenhle odkaz na plán zdarma:"},{"t":"btn","text":"[[martinbarna.cz/makro-plan||martinbarna.cz/forma-zpet]]","href":"{{plan_page_url}}"},{"t":"p","html":"A až spustíme <strong>doporučovací program</strong>, dostaneš za každého, koho přivedeš, <strong>odměnu</strong> (sleva pro kamaráda + bonus pro Tebe — cash, nebo ještě výhodnější kredit do našeho ekosystému). Dám Ti vědět mezi prvními."},{"t":"p","html":"Drž se a jedeme bomby!<br><strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 null)

on conflict (track, step) do update set
  key = excluded.key, subject = excluded.subject, preheader = excluded.preheader,
  blocks = excluded.blocks, wait_days = excluded.wait_days, updated_at = now();
