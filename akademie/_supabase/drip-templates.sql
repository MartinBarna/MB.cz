-- ============================================================
-- Barna Academy - DRIP: copy mailu (email_templates)
-- POZOR: ZASTARALY dump z 2026-07-07. Zdroj pravdy = zive email_templates v DB.
-- 16. 7. 2026 probehla mailing revize + pomlckova cistka vsech 90 sablon primo v DB;
-- tenhle soubor NEODRAZI aktualni stav. Pri priste praci se sablonami vygenerovat cerstvy dump.
-- DB je ZDROJ PRAVDY - zive texty edituj primo v email_templates;
-- tenhle soubor je verzovany zaznam/backup pro obnovu.
-- Pred pouzitim k obnove si over, ze dump neni starsi nez DB!
-- Upsert podle (track, step) -> re-runnatelne.
-- Tokeny - gender: [[zena||muz]] a [a]  |  merge: {{...}}
-- ============================================================

insert into public.email_templates (track, step, key, subject, preheader, blocks, wait_days) values

('existing-leadmagnet', 0, 'videokurz-ochutnavka',
 $s$Přidal jsem Ti videokurz zdarma 🎁$s$,
 $h$Ochutnávka videokurzu výživy — první lekce na mě.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "před časem sis ode mě stáhl[a] <strong>[[makro plán||plán „forma zpět“]]</strong> — tak koukám, jak se daří 💪 Ať máš od čeho se odrazit dál, <strong>otevřel jsem Ti zdarma ochutnávku videokurzu výživy</strong>."}, {"t": "p", "html": "Je to přesně to, co roky učím klienty — jen sepsané a natočené:"}, {"t": "bullets", "items": ["<strong>Bílkoviny v každém jídle</strong> — zasytí a drží svaly.", "<strong>Nejdřív zelenina a bílkoviny, pak zbytek</strong> — sníš míň, bez hladu.", "<strong>Plánuj dopředu</strong> — míň rozhodování, víc úspěchu."]}, {"t": "p", "html": "<strong>11 lekcí</strong> si pustíš <strong>zdarma a bez karty</strong> — bez registrace, rovnou z odkazu:"}, {"t": "btn", "href": "{{free_lessons_url}}", "text": "Pustit videokurz zdarma"}, {"t": "p", "html": "Mrkni dovnitř, ať víš, do čeho jdeš. Jestli Ti to sedne, o celém kurzu si řekneme za pár dní. <strong>Neprodávám ryby — učím rybařit.</strong>"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Nemáš už plán po ruce? Napiš a pošlu Ti ho znovu."}]$j$::jsonb,
 3),

('existing-leadmagnet', 1, 'kurz-nabidka',
 $s$Chceš to celé, krok za krokem?$s$,
 $h$Videokurz výživy — všechno, co učím klienty, na jednom místě.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "Plán máš, ochutnávku videokurzu taky. Jestli chceš <strong>celý systém</strong> — ne jen pár lekcí — mám pro Tebe celý <strong>Videokurz výživy</strong>."}, {"t": "p", "html": "Je to všechno, co roky učím své klienty za tisíce korun měsíčně, sepsané a natočené tak, aby to pochopil úplný začátečník:"}, {"t": "bullets", "items": ["jak si <strong>[[sama||sám]] sestavíš jídelníček</strong>, který Tě baví a funguje", "jak <strong>nepřibrat zpátky</strong> (konec jojo efektu)", "bílkoviny, kalorie, flexibilní stravování — prakticky, bez vědeckých keců", "doživotní přístup, koukáš kdy chceš"]}, {"t": "btn", "href": "{{course_url}}", "text": "Chci videokurz za {{course_price}} Kč"}, {"t": "p", "html": "Jeden řízek navíc týdně Tě stojí víc. Tohle Ti zůstane napořád."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Máš dotaz, jestli je to pro Tebe? Napiš mi na WhatsApp, však víš :) Řeknu Ti narovinu."}]$j$::jsonb,
 3),

('existing-leadmagnet', 2, 'sleva',
 $s$Mám pro Tebe −{{discount_pct}} % na videokurz{{fn_suffix}}$s$,
 $h$Krátké okno, ať Tě to nakopne.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "Vím, jak to chodí — „udělám to později“. A později nikdy nepřijde :)"}, {"t": "p", "html": "Ať Tě nakopnu: na <strong>Videokurz výživy</strong> Ti dávám <strong>slevu {{discount_pct}} %</strong> s kódem <strong>{{discount_code}}</strong> — z {{course_price}} Kč je <strong>{{discount_price}} Kč</strong>. Kód zadáš v košíku do pole „Slevový kupón“."}, {"t": "btn", "href": "{{course_url}}", "text": "Odemknout kurz se slevou"}, {"t": "p", "html": "Nečekej na „ideální pondělí“. Ideální je teď. Zvládneš to."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 5),

('existing-leadmagnet', 3, 'sleva2',
 $s$Poslední šance{{fn_suffix}} — sleva {{discount2_pct}} % na videokurz$s$,
 $h$Posílám lepší cenu, než zavřu krám :)$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "kód na {{discount_pct}} % jsi nechal[a] ležet — chápu, život je rychlý. Tak přitlačím ještě jednou: na <strong>Videokurz výživy</strong> Ti dávám <strong>slevu {{discount2_pct}} %</strong> s kódem <strong>{{discount2_code}}</strong> — z {{course_price}} Kč je <strong>{{discount2_price}} Kč</strong>."}, {"t": "p", "html": "Líp už to nebude — {{discount2_pct}} % je nejvyšší sleva, kterou na kurz dávám."}, {"t": "btn", "href": "{{course_url}}", "text": "Chci kurz za {{discount2_price}} Kč"}, {"t": "p", "html": "Žádné kázání. Buď do toho jdeš teď, nebo Ti budu fandit z dálky — ale věřím, že to dáš. 💪"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 5),

('existing-leadmagnet', 4, 'affiliate',
 $s$Znáš někoho, kdo to taky řeší?$s$,
 $h$Pošli to dál — vyhrajete oba.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "Ať už ses do toho pustil[a] naplno, nebo zatím jedeš podle plánu — díky, že jsi tady."}, {"t": "p", "html": "Jednu prosbu i nabídku: <strong>znáš někoho</strong>, kdo se trápí se stravou a pořád to vzdává? Pošli mu tenhle odkaz na plán zdarma:"}, {"t": "btn", "href": "{{plan_page_url}}", "text": "[[martinbarna.cz/makro-plan||martinbarna.cz/forma-zpet]]"}, {"t": "p", "html": "A když bude chtít víc než plán zdarma: doporučovací program už <strong>běží</strong>. Dej kamarádovi kód <strong>DOPORUC10</strong> a má na videokurz slevu <strong>10 %</strong>. A jakmile budeš mít kurz i Ty, odemkne se Ti navíc <strong>kredit za každého, koho přivedeš</strong> — tvůj vlastní doporučovací odkaz pak najdeš v členské sekci."}, {"t": "p", "html": "Drž se a jedeme bomby!<br><strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 null),

('lead-magnet', 0, 'doruceni',
 $s$Tady máš svůj plán{{fn_suffix}} 💪$s$,
 $h$Otevři, stáhni a rovnou se do toho dáme.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}}!"}, {"t": "p", "html": "Tak jak jsem slíbil — tady máš svůj <strong>7denní [[makro plán||plán „forma zpět“]]</strong>. Klikni a stáhni si ho:"}, {"t": "btn", "href": "{{lead_magnet_url}}", "text": "Stáhnout plán"}, {"t": "p", "html": "Co s tím:"}, {"t": "bullets", "items": ["Otevři ho ještě dnes a mrkni na <strong>den 1</strong> — žádná věda, jasné porce, běžné potraviny.", "Nemusíš nic počítat — vše máš spočítané. Porce jen odvaž podle plánu, jsou to 2 minuty denně.", "Nejde o dokonalost. Jde o to <strong>začít</strong> a být v tom [[poctivá sama||poctivý sám]] k sobě."]}, {"t": "p", "html": "Příští dny Ti pošlu pár věcí, co dělají u mých klientů největší rozdíl — krátce a k věci, žádné romány."}, {"t": "p", "html": "Drž se, ozvi se klidně kdykoliv. <strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Odpověz mi na tenhle mail jednou větou: co je teď tvoje největší překážka? Čtu si to."}]$j$::jsonb,
 2),

('lead-magnet', 1, 'chyba',
 $s$Chyba č. 1, na které lidi shoří$s$,
 $h$A není to „málo silné vůle“.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "Za roky praxe a 600+ proměn vidím pořád dokola jednu věc: lidi to vzdají <strong>po prvním malém úspěchu</strong>. Zhubnou dvě kila, uchlácholí se — a vrátí se do starých kolejí."}, {"t": "p", "html": "Hubnutí není sprint, je to <strong>maraton</strong>. A váha bude kolísat, i když děláš všechno správně (tohle musím klientům opakovat pořád :-D). Den nahoru neznamená, že nefunguješ."}, {"t": "p", "html": "Co s tím dneska:"}, {"t": "bullets", "items": ["Neřeš jeden den. Řeš <strong>týdenní průměr</strong>.", "Někdy je <strong>udržení místo přibrání taky výhra</strong>.", "Buď k sobě [[poctivá||poctivý]] — když si „nemažeš med kolem huby“ a vidíš, žes snědl[a] víc, jsi o krok dál než většina."]}, {"t": "p", "html": "🎁 <strong>Bonus k plánu:</strong> sepsal jsem všech <a href=\"https://martinbarna.cz/download/7-chyb-pri-hubnuti.pdf\">7 nejčastějších chyb, na kterých hubnutí shoří (PDF)</a> — projdi si je, ať se jim vyhneš všem."}, {"t": "p", "html": "Za dva dny Ti ukážu, jak jíst flexibilně, aby ses nemusel[a] vzdávat oblíbených jídel."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 2),

('lead-magnet', 2, 'flexibilne',
 $s$Jak jíst řízek a pizzu a stejně zhubnout$s$,
 $h$Žádné zakázané jídlo. Vážně.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "Nejčastější mýtus: „abych zhubl[a], musím vyřadit X“. Nemusíš."}, {"t": "p", "html": "Funguje to jednoduše — <strong>neprodávám ryby, učím rybařit</strong>. Místo striktního jídelníčku Tě naučím, jak si jídlo poskládáš [[sama||sám]] z toho, co Ti chutná a na co máš „rozpočet“ (kalorií a bílkovin). Pak si dáš i pizzu a pořád jedeš dolů."}, {"t": "p", "html": "3 věci, co fungují hned:"}, {"t": "bullets", "items": ["<strong>Bílkoviny v každém jídle</strong> — zasytí a drží svaly.", "<strong>Nejdřív zelenina a bílkoviny, pak zbytek</strong> — automaticky sníš míň, bez hladu.", "<strong>Plánuj dopředu</strong> — méně rozhodování = víc úspěchu."]}, {"t": "p", "html": "🎁 <strong>Bonus:</strong> ať máš z čeho vybírat, přikládám <a href=\"https://martinbarna.cz/download/rychla-kucharka.pdf\">rychlou kuchařku — 5 jídel do 15 minut (PDF)</a>. Každé jídlo má pořádnou porci bílkovin a spočítaná makra."}, {"t": "p", "html": "Tohle všechno (a mnohem víc) Tě krok za krokem provedu ve videokurzu — a <strong>11 lekcí si můžeš pustit zdarma</strong> — bez registrace, rovnou z odkazu, žádná karta:"}, {"t": "btn", "href": "{{free_lessons_url}}", "text": "Pustit 11 lekcí zdarma"}, {"t": "p", "html": "Mrkni, jak to vypadá uvnitř. Dneska ale hlavně zkus ten bod 1 ✅ — a jestli Ti ochutnávka sedne, o celém kurzu si řekneme příště."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 2),

('lead-magnet', 3, 'kurz-nabidka',
 $s$Chceš to celé, krok za krokem?$s$,
 $h$Videokurz výživy — všechno, co učím klienty, na jednom místě.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "Plán máš, pár principů taky a třeba sis pustil[a] i první lekce videokurzu zdarma. Jestli chceš <strong>celý systém</strong> — ne jen ochutnávku — mám pro Tebe celý <strong>Videokurz výživy</strong>."}, {"t": "p", "html": "Je to všechno, co roky učím své klienty za tisíce korun měsíčně, sepsané a natočené tak, aby to pochopil úplný začátečník:"}, {"t": "bullets", "items": ["jak si <strong>[[sama||sám]] sestavíš jídelníček</strong>, který Tě baví a funguje", "jak <strong>nepřibrat zpátky</strong> (konec jojo efektu)", "bílkoviny, kalorie, flexibilní stravování — prakticky, bez vědeckých keců", "doživotní přístup, koukáš kdy chceš"]}, {"t": "btn", "href": "{{course_url}}", "text": "Chci videokurz za {{course_price}} Kč"}, {"t": "p", "html": "Jeden řízek navíc týdně Tě stojí víc. Tohle Ti zůstane napořád."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Máš dotaz, jestli je to pro Tebe? Napiš mi na WhatsApp, však víš :) Řeknu Ti narovinu."}]$j$::jsonb,
 3),

('lead-magnet', 4, 'sleva',
 $s$Mám pro Tebe −{{discount_pct}} % na videokurz{{fn_suffix}}$s$,
 $h$Krátké okno, ať Tě to nakopne.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "Vím, jak to chodí — „udělám to později“. A později nikdy nepřijde :)"}, {"t": "p", "html": "Ať Tě nakopnu: na <strong>Videokurz výživy</strong> Ti dávám <strong>slevu {{discount_pct}} %</strong> s kódem <strong>{{discount_code}}</strong> — z {{course_price}} Kč je <strong>{{discount_price}} Kč</strong>. Kód zadáš v košíku do pole „Slevový kupón“."}, {"t": "btn", "href": "{{course_url}}", "text": "Odemknout kurz se slevou"}, {"t": "p", "html": "Nečekej na „ideální pondělí“. Ideální je teď. Zvládneš to."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 5),

('lead-magnet', 5, 'sleva2',
 $s$Poslední šance{{fn_suffix}} — sleva {{discount2_pct}} % na videokurz$s$,
 $h$Posílám lepší cenu, než zavřu krám :)$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "kód na {{discount_pct}} % jsi nechal[a] ležet — chápu, život je rychlý. Tak přitlačím ještě jednou: na <strong>Videokurz výživy</strong> Ti dávám <strong>slevu {{discount2_pct}} %</strong> s kódem <strong>{{discount2_code}}</strong> — z {{course_price}} Kč je <strong>{{discount2_price}} Kč</strong>."}, {"t": "p", "html": "Líp už to nebude — {{discount2_pct}} % je nejvyšší sleva, kterou na kurz dávám."}, {"t": "btn", "href": "{{course_url}}", "text": "Chci kurz za {{discount2_price}} Kč"}, {"t": "p", "html": "Žádné kázání. Buď do toho jdeš teď, nebo Ti budu fandit z dálky — ale věřím, že to dáš. 💪"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 5),

('lead-magnet', 6, 'affiliate',
 $s$Znáš někoho, kdo to taky řeší?$s$,
 $h$Pošli to dál — vyhrajete oba.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "Ať už ses do toho pustil[a] naplno, nebo zatím jedeš podle plánu — díky, že jsi tady."}, {"t": "p", "html": "Jednu prosbu i nabídku: <strong>znáš někoho</strong>, kdo se trápí se stravou a pořád to vzdává? Pošli mu tenhle odkaz na plán zdarma:"}, {"t": "btn", "href": "{{plan_page_url}}", "text": "[[martinbarna.cz/makro-plan||martinbarna.cz/forma-zpet]]"}, {"t": "p", "html": "A když bude chtít víc než plán zdarma: doporučovací program už <strong>běží</strong>. Dej kamarádovi kód <strong>DOPORUC10</strong> a má na videokurz slevu <strong>10 %</strong>. A jakmile budeš mít kurz i Ty, odemkne se Ti navíc <strong>kredit za každého, koho přivedeš</strong> — tvůj vlastní doporučovací odkaz pak najdeš v členské sekci."}, {"t": "p", "html": "Drž se a jedeme bomby!<br><strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 null),

('lead-magnet-tool', 0, 'doruceni-tool',
 $s$Tady máš svoje generátory{{fn_suffix}} — plán na pár kliknutí 🍽️$s$,
 $h$Jídelníček i trénink zdarma. Otevři a vygeneruj si plán na míru.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}}!"}, {"t": "p", "html": "Tak jak jsem slíbil — tady máš přístup ke svému plánu. Generátor ti ho složí na míru za pár vteřin a můžeš se k němu kdykoliv vrátit, bez registrace:"}, {"t": "btn", "href": "https://martinbarna.cz/nastroje-zdarma/jidelnicek/", "text": "🍽️ Otevřít generátor jídelníčku"}, {"t": "btn", "href": "https://martinbarna.cz/nastroje-zdarma/trenink/", "text": "🏋️ Otevřít generátor tréninku"}, {"t": "bullets", "items": ["Nastav si cíl a preference — plán se přepočítá hned.", "Generovat můžeš, kolikrát chceš. Ulož si stránku do záložek.", "K tomu máš zdarma i <a href='https://martinbarna.cz/nastroje-zdarma/cviky/'>databázi 120 cviků</a> s technikou provedení."]}, {"t": "p", "html": "A jestli chceš plnou verzi — celotýdenní jídelníčky s nákupním seznamem, export do PDF pod tvým jménem a kompletní vzdělání výživy i tréninku — mrkni na <a href='https://martinbarna.cz/akademie/'>Barna Academy</a>."}, {"t": "p", "html": "Drž se, ozvi se klidně kdykoliv. <strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Odpověz mi jednou větou: skládáš plán pro sebe, nebo pro klienty? Podle toho ti pošlu další tipy."}]$j$::jsonb,
 2),

('lead-magnet-tool', 1, 'tool-follow',
 $s$Sedí ti generátory{{fn_suffix}}? Tohle z nich vymáčkne víc$s$,
 $h$Rychlý tip k plánům — a co dál, když chceš víc než ukázku.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "před pár dny sis otevřel[a] moje <strong>generátory jídelníčku a tréninku</strong> — tak se jen ptám: sedí ti výstupy? Kdyby něco nedávalo smysl, klidně odepiš, mrknu na to."}, {"t": "p", "html": "<strong>Rychlý tip:</strong> vygeneruj si plán na 2–3 různé cíle (např. udržení vs. hubnutí) a porovnej porce. Krásně uvidíš, jak málo stačí změnit — a přesně tohle je princip, který učím."}, {"t": "p", "html": "A když budeš chtít víc než ukázku:"}, {"t": "bullets", "items": ["<strong>Skládáš plány pro sebe?</strong> Ve <a href='https://martinbarna.cz/videokurz?utm_source=email&utm_medium=drip&utm_campaign=tool-follow'>videokurzu výživy</a> (182 lekcí, {{course_price}} Kč) se naučíš jíst flexibilně — a věčné skákání z diety na dietu skončí.", "<strong>Skládáš plány pro klienty?</strong> <a href='https://martinbarna.cz/akademie/?utm_source=email&utm_medium=drip&utm_campaign=tool-follow'>Barna Academy</a> je kompletní vzdělání pro trenéry — 241 lekcí, nástroje s exportem PDF pod tvým jménem a certifikace."]}, {"t": "p", "html": "Ať se daří! <strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Generátory zůstávají zdarma, i kdyby sis nic nekoupil[a]. Používej je, kolik chceš."}]$j$::jsonb,
 null),

('milestone-videokurz', 50, 'vk-half',
 $s$Půlka kurzu za tebou{{fn_suffix}}! 🎉 Tady je dárek$s$,
 $h$Přes 90 zhlédnutých lekcí. Klobouk dolů — a malá odměna k tomu.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "právě máš za sebou <strong>polovinu videokurzu</strong> — přes 90 lekcí! 🎉 Tohle už dávno není zvědavost, tohle je poctivá práce. A ta se odměňuje."}, {"t": "p", "html": "<strong>Dárek pro pokročilé nadšence:</strong>"}, {"t": "bullets", "items": ["🍳 <a href='https://martinbarna.cz/materialy/pdf/high-protein-recepty.pdf'>High-protein receptář</a> — 12 receptů s makry, ať máš z čeho skládat.", "🍕 <a href='https://martinbarna.cz/materialy/pdf/flexibilni-strava.pdf'>Flexibilní stravování v praxi</a> — průvodce, jak jíst normálně a držet formu."]}, {"t": "p", "html": "Druhá půlka kurzu je praktičtější než ta první — strategie, suplementy, udržení formy. Jeď dál stejným tempem:"}, {"t": "btn", "href": "https://martinbarna.cz/akademie/videokurz/", "text": "Pokračovat v kurzu"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Jak ti kurz zatím sedí? Odepiš mi klidně jednou větou — čtu všechno."}]$j$::jsonb,
 null),

('milestone-videokurz', 100, 'vk-complete',
 $s$Celý videokurz je za tebou! 🏆$s$,
 $h$Všech 182 lekcí. Patříš mezi pár procent nejvytrvalejších.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "<strong>všech 182 lekcí. Hotovo. 🏆</strong> Víš, kolik lidí dokončí online kurz celý? Jednotky procent. Právě se ti povedlo něco, co většina nikdy nedokáže — a teď máš v hlavě systém, který ti vydrží celý život."}, {"t": "p", "html": "Tři věci, které ti chci říct:"}, {"t": "bullets", "items": ["<strong>Napiš mi svůj výsledek.</strong> Odpověz na tenhle e-mail — kolik kilo, jaká změna, co bylo nejtěžší. Čtu každou zprávu a nejlepší příběhy (se svolením) sdílím, ať motivují další.", "<strong>Znáš někoho, komu by kurz pomohl?</strong> Ve svém <a href='https://martinbarna.cz/akademie/moje/'>členském účtu</a> najdeš doporučovací kód — za každého nového člena ti připíšu kredit.", "<strong>Chceš jít hloub?</strong> Pokud tě výživa chytla natolik, že s ní chceš pomáhat i ostatním, mrkni na <a href='https://martinbarna.cz/akademie/'>Barna Academy</a> — kompletní vzdělání pro trenéry a výživové poradce."]}, {"t": "p", "html": "Dotáhnout kurz až do konce je výkon — a ty ho máš za sebou. Vážím si toho. <strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Kurz máš doživotně — vracej se k lekcím, kdykoliv budeš potřebovat osvěžit."}]$j$::jsonb,
 null),

('nurture-videokurz', 0, 'nv-0-bilkovina',
 $s$1 věc, co u mých klientů dělá největší rozdíl$s$,
 $h$Není to dřina navíc. Je to tohle.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "za 13 let praxe a přes 600 lidí, co jsem provedl proměnou, ti řeknu jednu věc, která dělá největší rozdíl a skoro nikoho nestojí úsilí navíc: <strong>bílkoviny v každém jídle</strong>."}, {"t": "p", "html": "Proč zrovna bílkoviny:"}, {"t": "bullets", "items": ["<strong>Nejvíc zasytí</strong> — po jídle s bílkovinami nemáš za dvě hodiny hlad a míň uzobáváš.", "<strong>Drží svaly</strong>, když hubneš — jde dolů tuk, ne sval.", "Tělo s nimi hospodaří jinak než se sacharidy a tuky, hůř se ukládají."]}, {"t": "p", "html": "Na tento týden jeden úkol: <strong>do každého hlavního jídla dej zdroj bílkovin</strong> — maso, ryba, vejce, tvaroh, luštěniny. Nic víc zatím neřeš."}, {"t": "p", "html": "Tohle je jen střípek. Jak si poskládat celý jídelníček, který funguje a baví tě, tě krok za krokem naučím ve videokurzu. První lekce si pustíš zdarma:"}, {"t": "btn", "href": "{{free_lessons_url}}", "text": "Pustit první lekce zdarma"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 7),

('nurture-videokurz', 1, 'nv-1-vazeni',
 $s$Proč většina lidí nezhubne (a není to dietou)$s$,
 $h$Skoro každý dělá tuhle jednu chybu.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "za 13 let a přes 600 proměn ti řeknu, kde to vázne skoro každému. Není to dietou ani genetikou — je to tímhle: <strong>lidi podceňují, kolik toho reálně snědí</strong>. I ti, co „jedí zdravě“."}, {"t": "p", "html": "Máme to černé na bílém i ve studiích: odhad porcí se běžně sekne o desítky procent. Lžíce oleje navíc, větší pečivo, „jen kousek“ — a je z toho stovka kalorií, o které nevíš."}, {"t": "p", "html": "Řešení není další dieta. Je to naučit se <strong>pár týdnů si jídlo vážit a zapisovat</strong> — ne navždy, jen dokud si nevytrénuješ oko. Pak porce odhadneš i bez váhy a máš to v sobě napořád. Tahle jedna dovednost mění výsledky ze všeho nejvíc."}, {"t": "p", "html": "Jak si to nastavit, aby tě to neotravovalo a fungovalo, tě krok za krokem provedu ve videokurzu:"}, {"t": "btn", "href": "{{course_url}}", "text": "Prohlédnout videokurz"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 7),

('nurture-videokurz', 2, 'nv-2-sleva15',
 $s$Nakopnu tě: −{{discount_pct}} % na videokurz$s$,
 $h$Ať to konečně rozjedeš.$h$,
 $j$[{"t": "p", "html": "Čus{{fn_space}},"}, {"t": "p", "html": "posílám ti tipy, ale ruku na srdce — nejrychleji tě posune <strong>celý systém pohromadě</strong>, ne jednotlivé střípky. A ať tě k tomu nakopnu:"}, {"t": "p", "html": "Na <strong>Videokurz výživy</strong> ti dávám slevu <strong>{{discount_pct}} %</strong> kódem <strong>{{discount_code}}</strong> — z 800 Kč je <strong>{{discount_price}} Kč</strong>. Doživotní přístup, koukáš, kdy chceš."}, {"t": "btn", "href": "{{course_url}}", "text": "Vzít videokurz se slevou"}, {"t": "p", "html": "Za cenu jedné večeře v restauraci máš systém, který ti zůstane napořád.<br><strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Kód {{discount_code}} zadáš v košíku."}]$j$::jsonb,
 7),

('nurture-videokurz', 3, 'nv-3-prumer',
 $s$Váha ti skáče? Nereaguj na jedno číslo$s$,
 $h$Není to o vůli.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "znáš to — celý týden makáš, ráno na váze o kilo víc a chuť to vzdát. Přitom je to skoro vždycky jen voda (sůl, hormony, trávení), ne tuk."}, {"t": "p", "html": "Většina lidí to nevzdá kvůli slabé vůli, ale proto, že <strong>reaguje na jedno číslo</strong> místo na trend. Co s tím:"}, {"t": "bullets", "items": ["Važ se ráno nalačno, ale sleduj <strong>týdenní průměr</strong>, ne jeden den.", "Klidně se nevaž vůbec a jeď podle <strong>měr (pas, boky, stehna)</strong>, zrcadla a oblečení.", "Jeden den nahoru neznamená, že nefunguješ. Drž kurz."]}, {"t": "p", "html": "Tenhle klid a systém za tím je přesně to, co tě videokurz naučí — ať nejedeš od jedné diety ke druhé.<br><strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 7),

('nurture-videokurz', 4, 'nv-4-snidane',
 $s$3 snídaně, co tě zasytí a nezdrží$s$,
 $h$Rychlé, levné, s bílkovinou.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "malý dárek — tři snídaně, co splňují „rychlé + hodně bílkovin + zasytí“:"}, {"t": "bullets", "items": ["<strong>Tvaroh + ovoce + ovesné vločky</strong> — dvě minuty práce a spousta bílkovin.", "<strong>Míchaná vejce (3) + celozrnný toast</strong> — klasika, co tě udrží až do oběda.", "<strong>Skyr + lžíce arašídového másla + banán</strong> — když spěcháš, sníš to cestou."]}, {"t": "p", "html": "Vyzkoušej, která ti sedne nejvíc. A jestli chceš takhle poskládaný celý den — oběd, večeři i svačiny — najdeš to ve videokurzu:"}, {"t": "btn", "href": "{{course_url}}", "text": "Chci celý systém"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 7),

('nurture-videokurz', 5, 'nv-5-spanek',
 $s$Skrytá brzda hubnutí, kterou nikdo neřeší$s$,
 $h$A není to jídlo ani trénink.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "můžeš mít perfektní jídelníček i trénink, a stejně to nejde — když spíš mizerně. <strong>Málo spánku zvyšuje apetit</strong>: druhý den máš <strong>větší chutě</strong>, hlavně na sladké a tučné, a hůř se ovládáš."}, {"t": "p", "html": "Na tento týden jedna věc: <strong>pevný čas, kdy jdeš spát</strong>, a hodinu předtím pryč od telefonu. Menší chutě druhý den poznáš dřív, než čekáš."}, {"t": "p", "html": "Spánek, stres, návyky — takových věcí, co u hubnutí rozhodují a lidi je přehlížejí, je ve videokurzu spousta:"}, {"t": "btn", "href": "{{course_url}}", "text": "Prohlédnout videokurz"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 7),

('nurture-videokurz', 6, 'nv-6-sleva20',
 $s$Poslední lepší cena: −{{discount2_pct}} % na videokurz$s$,
 $h$Víc už slevu nedám.$h$,
 $j$[{"t": "p", "html": "Čus{{fn_space}},"}, {"t": "p", "html": "týdny ti posílám tipy zdarma. Teď ti naposledy nabídnu i celý systém — a rovnou za nejlepší cenu, jakou dám:"}, {"t": "p", "html": "Videokurz výživy se slevou <strong>{{discount2_pct}} %</strong> kódem <strong>{{discount2_code}}</strong> — z 800 Kč je <strong>{{discount2_price}} Kč</strong>. Doživotně, koukáš, kdy chceš."}, {"t": "btn", "href": "{{course_url}}", "text": "Vzít videokurz za nejlepší cenu"}, {"t": "p", "html": "Nečekej na „ideální pondělí“ — to nikdy nepřijde. Ideální je začít teď.<br><strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Kód {{discount2_code}} zadáš v košíku. Víc už slevu nedám."}]$j$::jsonb,
 7),

('nurture-videokurz', 7, 'nv-7-close',
 $s$Než se rozloučíme s tipy…$s$,
 $h$Kurz je pořád tady, doživotně.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "tímhle týdenní tipy zvolním — nechci ti přeplňovat schránku. Ale než skončím, jedna věc:"}, {"t": "p", "html": "Většina lidí, co u mě zhubla a hlavně si to <strong>udržela</strong>, měla společné jedno — přestali zkoušet metodu pokus-omyl a začali jet podle <strong>vědecky podloženého systému</strong>. Klientka (64 let) shodila −20 kg za 12 týdnů jen chůzí a jídlem. Tomáš s Katkou si formu drží <strong>dva roky</strong> po spolupráci sami."}, {"t": "p", "html": "Ten systém máš ve videokurzu — doživotně, kdykoliv se rozhodneš. Bude tam, až budeš chtít:"}, {"t": "btn", "href": "{{course_url}}", "text": "Mrknout na videokurz"}, {"t": "p", "html": "Díky, že čteš až sem. Drž se a klidně se kdykoliv ozvi.<br><strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 null),

('onboarding-coaching', 0, 'onb-co-v1',
 $s$Máš u mě videokurz výživy v ceně$s$,
 $h$Videokurz výživy máš v ceně. Přihlásíš se za minutu.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "odvedl jsem teď na webu pořádný kus práce — všechno jsem dal na jedno místo, do Barna Academy. Ke tvému coachingu ti přidávám <strong>videokurz výživy v ceně</strong>."}, {"t": "p", "html": "Je to všech <strong>182 lekcí</strong> o tom, jak jíst, počítat makra a držet si formu. Kdykoliv se k tomu budeš chtít vrátit, máš to po ruce."}, {"t": "p", "html": "<strong>Jak dovnitř</strong> (minuta): klikni níž, dej <strong>„Vytvořit účet\"</strong> a zaregistruj se <strong>stejným e-mailem, na který ti přišel tenhle mail</strong>. Vytvoříš si heslo a jsi uvnitř."}, {"t": "btn", "href": "https://www.martinbarna.cz/akademie/prihlaseni/?tab=register", "text": "Vytvořit přístup"}, {"t": "p", "html": "Díky, že buduješ nejlepší verzi sebe sama. Kdyby cokoliv, víš kde mě najdeš. <strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Registruj se e-mailem, na který ti chodí tahle zpráva — podle něj tě systém pustí dovnitř."}]$j$::jsonb,
 null),

('onboarding-grant-academy', 0, 'grant-academy',
 $s$Otevřel jsem ti přístup do Barna Academy{{fn_suffix}} 🎓$s$,
 $h$Přístup je aktivní. Vytvoř si účet a otevři si všechny lekce i nástroje.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "právě jsem ti <strong>otevřel přístup do Barna Academy</strong>! 🎓 Máš odemčené všechny lekce, nástroje i cestu k certifikaci — a je v tom i celý <strong>videokurz výživy (182 lekcí)</strong>."}, {"t": "p", "html": "<strong>Jak se dostaneš dovnitř</strong> (zabere minutu):"}, {"t": "bullets", "items": ["Klikni na tlačítko níž — otevře se registrace s předvyplněným e-mailem.", "Dej <strong>„Vytvořit účet“</strong> a zvol si heslo. Registruj se přesně e-mailem <strong>{{email}}</strong> — podle něj tě systém pozná a všechno ti odemkne.", "Hotovo. Studuješ na mobilu i počítači, vlastním tempem."]}, {"t": "btn", "href": "https://martinbarna.cz/akademie/prihlaseni/?tab=up&email={{email_url}}&next=/akademie/moje/", "text": "Vytvořit účet a otevřít Academy"}, {"t": "p", "html": "Kdyby cokoliv nešlo, stačí odpovědět na tenhle e-mail — vyřešíme to. <strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Registruj se přesně e-mailem <strong>{{email}}</strong> — podle něj tě systém pozná a přístup odemkne."}]$j$::jsonb,
 null),

('onboarding-grant-videokurz', 0, 'grant-vk',
 $s$Otevřel jsem ti přístup k videokurzu{{fn_suffix}} 🎉$s$,
 $h$Přístup je aktivní. Vytvoř si účet a můžeš začít — zabere to minutu.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "právě jsem ti <strong>otevřel přístup k videokurzu výživy</strong>! 🎉 Čeká na tebe všech <strong>182 video lekcí</strong> a bonusové materiály ke stažení."}, {"t": "p", "html": "<strong>Jak se dostaneš dovnitř</strong> (zabere minutu):"}, {"t": "bullets", "items": ["Klikni na tlačítko níž — otevře se registrace s předvyplněným e-mailem.", "Dej <strong>„Vytvořit účet“</strong> a zvol si heslo. Registruj se přesně e-mailem <strong>{{email}}</strong> — podle něj tě systém pozná a kurz ti odemkne.", "Hotovo. Koukáš na mobilu i počítači, kdy chceš a kolikrát chceš."]}, {"t": "btn", "href": "https://martinbarna.cz/akademie/prihlaseni/?tab=up&email={{email_url}}&next=/akademie/videokurz/", "text": "Vytvořit účet a začít"}, {"t": "p", "html": "Kdyby cokoliv nešlo, stačí odpovědět na tenhle e-mail — vyřešíme to. <strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Registruj se přesně e-mailem <strong>{{email}}</strong> — podle něj tě systém pozná a kurz odemkne."}]$j$::jsonb,
 5),

('onboarding-grant-videokurz', 1, 'onb-vk-tipy-nakup-grant',
 $s$3 tipy, ať z videokurzu dostaneš maximum{{fn_suffix}}$s$,
 $h$Kalkulačka, materiály a pořadí lekcí — takhle kurz funguje nejlíp.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "už máš pár dní přístup k videokurzu na novém webu. Posílám 3 věci, které podle mých klientů dělají největší rozdíl:"}, {"t": "bullets", "items": ["<strong>Začni kalkulačkou maker</strong> — spočítej si vlastní čísla a teprve pak se pusť do lekcí. Všechno ti bude dávat větší smysl.", "<strong>Stáhni si materiály</strong> — 24 příloh (kuchařka 40+ receptů, průvodci, deník návyků) máš v kurzu připravených ke stažení.", "<strong>Jeď po modulech popořadě</strong> — kurz je poskládaný jako cesta a moduly na sebe navazují."]}, {"t": "btn", "href": "https://martinbarna.cz/akademie/videokurz/?utm_source=email&utm_medium=drip&utm_campaign=onboarding", "text": "Otevřít videokurz"}, {"t": "p", "html": "Kdyby tě to nepustilo dovnitř (heslo, e-mail), stačí odpovědět na tenhle mail a vyřešíme to."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Co teď řešíš — hubnutí, nabírání, nebo se v tom chceš prostě vyznat? Odpověz jednou větou, poradím ti, kterými lekcemi začít."}]$j$::jsonb,
 14),

('onboarding-grant-videokurz', 2, 'onb-vk-doporuc-nakup-grant',
 $s$Znáš někoho, komu by kurz pomohl?$s$,
 $h$Kamarád dostane slevu 10 %, ty kredit na další nákup.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "jestli ti videokurz něco dal, mám prosbu i nabídku v jednom: <strong>doporuč ho někomu</strong>, kdo se pořád točí v dietách a restech."}, {"t": "bullets", "items": ["Kamarádovi dej kód <strong>DOPORUC10</strong> — má slevu 10 % na videokurz i Barna Academy.", "Tobě za každé doporučení připíšu <strong>kredit</strong> — svůj osobní kód a stav kreditu najdeš na stránce Doporuč a vydělej."]}, {"t": "btn", "href": "https://martinbarna.cz/akademie/moje/doporuc/?utm_source=email&utm_medium=drip&utm_campaign=onboarding", "text": "Můj doporučovací kód"}, {"t": "p", "html": "A jestli chceš místo samostudia vedení na míru — jídelníček, týdenní kontroly a moje oko na tvém progresu — mrkni na <a href=\"https://martinbarna.cz/#balicky\">koučink</a>."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 null),

('onboarding-nakup-academy', 0, 'nakup-academy',
 $s$Vítej v Barna Academy{{fn_suffix}} 🎓$s$,
 $h$Přístup je aktivní. Vytvoř si účet a otevři si všechny lekce i nástroje.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "díky za důvěru a vítej v <strong>Barna Academy</strong>! 🎓 Máš odemčené všechny lekce, nástroje i cestu k certifikaci — a v ceně máš i celý <strong>videokurz výživy (182 lekcí)</strong>."}, {"t": "p", "html": "<strong>Jak se dostaneš dovnitř</strong> (zabere minutu):"}, {"t": "bullets", "items": ["Klikni na tlačítko níž — otevře se registrace s předvyplněným e-mailem.", "Dej <strong>„Vytvořit účet“</strong> a zvol si heslo. Registruj se přesně e-mailem <strong>{{email}}</strong> — podle něj tě systém pozná a všechno ti odemkne.", "Hotovo. Studuješ na mobilu i počítači, vlastním tempem."]}, {"t": "btn", "href": "https://martinbarna.cz/akademie/prihlaseni/?tab=up&email={{email_url}}&next=/akademie/moje/", "text": "Vytvořit účet a otevřít Academy"}, {"t": "p", "html": "A žádný risk: máš <strong>14denní garanci vrácení peněz</strong>. Kdyby ti Academy nesedla, můžeš <a href='https://martinbarna.cz/odstoupeni/?product=academy&email={{email_url}}'>odstoupit od smlouvy online</a> a peníze ti vrátím."}, {"t": "p", "html": "Kdyby cokoliv nešlo, stačí odpovědět na tenhle e-mail — vyřešíme to. <strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Registrace jiným e-mailem tě s nákupem nespáruje. Použij {{email}}."}]$j$::jsonb,
 null),

('onboarding-nakup-videokurz', 0, 'nakup-vk',
 $s$Tvůj videokurz je připravený{{fn_suffix}} 🎉$s$,
 $h$Přístup je aktivní. Vytvoř si účet a můžeš začít — zabere to minutu.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "díky za nákup a vítej! 🎉 Tvůj <strong>videokurz výživy</strong> je odemčený — čeká na tebe všech <strong>182 video lekcí</strong> a bonusové materiály ke stažení."}, {"t": "p", "html": "<strong>Jak se dostaneš dovnitř</strong> (zabere minutu):"}, {"t": "bullets", "items": ["Klikni na tlačítko níž — otevře se registrace s předvyplněným e-mailem.", "Dej <strong>„Vytvořit účet“</strong> a zvol si heslo. Registruj se přesně e-mailem <strong>{{email}}</strong> — podle něj tě systém pozná a kurz ti odemkne.", "Hotovo. Koukáš na mobilu i počítači, kdy chceš a kolikrát chceš."]}, {"t": "btn", "href": "https://martinbarna.cz/akademie/prihlaseni/?tab=up&email={{email_url}}&next=/akademie/videokurz/", "text": "Vytvořit účet a začít"}, {"t": "p", "html": "A žádný risk: máš <strong>14denní garanci vrácení peněz</strong>. Kdyby ti kurz nesedl, můžeš <a href='https://martinbarna.cz/odstoupeni/?product=videokurz&email={{email_url}}'>odstoupit od smlouvy online</a> a peníze ti vrátím."}, {"t": "p", "html": "Kdyby cokoliv nešlo, stačí odpovědět na tenhle e-mail — vyřešíme to. <strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Registrace jiným e-mailem tě s nákupem nespáruje. Použij {{email}}."}]$j$::jsonb,
 5),

('onboarding-nakup-videokurz', 1, 'onb-vk-tipy-nakup',
 $s$3 tipy, ať z videokurzu dostaneš maximum{{fn_suffix}}$s$,
 $h$Kalkulačka, materiály a pořadí lekcí — takhle kurz funguje nejlíp.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "už máš pár dní přístup k videokurzu na novém webu. Posílám 3 věci, které podle mých klientů dělají největší rozdíl:"}, {"t": "bullets", "items": ["<strong>Začni kalkulačkou maker</strong> — spočítej si vlastní čísla a teprve pak se pusť do lekcí. Všechno ti bude dávat větší smysl.", "<strong>Stáhni si materiály</strong> — 24 příloh (kuchařka 40+ receptů, průvodci, deník návyků) máš v kurzu připravených ke stažení.", "<strong>Jeď po modulech popořadě</strong> — kurz je poskládaný jako cesta a moduly na sebe navazují."]}, {"t": "btn", "href": "https://martinbarna.cz/akademie/videokurz/?utm_source=email&utm_medium=drip&utm_campaign=onboarding", "text": "Otevřít videokurz"}, {"t": "p", "html": "Kdyby tě to nepustilo dovnitř (heslo, e-mail), stačí odpovědět na tenhle mail a vyřešíme to."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Co teď řešíš — hubnutí, nabírání, nebo se v tom chceš prostě vyznat? Odpověz jednou větou, poradím ti, kterými lekcemi začít."}]$j$::jsonb,
 14),

('onboarding-nakup-videokurz', 2, 'onb-vk-doporuc-nakup',
 $s$Znáš někoho, komu by kurz pomohl?$s$,
 $h$Kamarád dostane slevu 10 %, ty kredit na další nákup.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "jestli ti videokurz něco dal, mám prosbu i nabídku v jednom: <strong>doporuč ho někomu</strong>, kdo se pořád točí v dietách a restech."}, {"t": "bullets", "items": ["Kamarádovi dej kód <strong>DOPORUC10</strong> — má slevu 10 % na videokurz i Barna Academy.", "Tobě za každé doporučení připíšu <strong>kredit</strong> — svůj osobní kód a stav kreditu najdeš na stránce Doporuč a vydělej."]}, {"t": "btn", "href": "https://martinbarna.cz/akademie/moje/doporuc/?utm_source=email&utm_medium=drip&utm_campaign=onboarding", "text": "Můj doporučovací kód"}, {"t": "p", "html": "A jestli chceš místo samostudia vedení na míru — jídelníček, týdenní kontroly a moje oko na tvém progresu — mrkni na <a href=\"https://martinbarna.cz/#balicky\">koučink</a>."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 null),

('onboarding-videokurz', 0, 'onb-vk-v1',
 $s$Tvůj videokurz je teď na novém místě$s$,
 $h$Všech 182 lekcí i materiály pohromadě. Přihlásíš se za minutu.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "přesunul jsem tvůj <strong>videokurz výživy</strong> na nový web — do Barna Academy. Je to rychlejší, přehlednější a máš všechno na jednom místě. Nic znovu neplatíš, máš ho dál v ceně."}, {"t": "p", "html": "Uvnitř najdeš:"}, {"t": "bullets", "items": ["všech <strong>182 video lekcí</strong> (hubnutí, nabírání, fitness)", "všechny <strong>přílohy a materiály</strong> ke stažení", "funguje na mobilu i počítači, koukáš kdy chceš"]}, {"t": "p", "html": "<strong>Jak se přihlásíš</strong> (minuta): klikni níž, dej <strong>„Vytvořit účet\"</strong> a zaregistruj se <strong>stejným e-mailem, na který ti přišel tenhle mail</strong> — podle něj tě systém pozná. Vytvoříš si heslo a jsi uvnitř."}, {"t": "btn", "href": "https://www.martinbarna.cz/akademie/prihlaseni/?tab=register", "text": "Vytvořit přístup do videokurzu"}, {"t": "p", "html": "Kdyby něco nefungovalo, napiš mi, vyřešíme to. <strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Přihlas se stejným e-mailem jako u koupě kurzu, jinak tě systém nespáruje."}]$j$::jsonb,
 4),

('onboarding-videokurz', 1, 'onb-vk-tipy',
 $s$3 tipy, ať z videokurzu dostaneš maximum{{fn_suffix}}$s$,
 $h$Kalkulačka, materiály a pořadí lekcí — takhle kurz funguje nejlíp.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "už máš pár dní přístup k videokurzu na novém webu. Posílám 3 věci, které podle mých klientů dělají největší rozdíl:"}, {"t": "bullets", "items": ["<strong>Začni kalkulačkou maker</strong> — spočítej si vlastní čísla a teprve pak se pusť do lekcí. Všechno ti bude dávat větší smysl.", "<strong>Stáhni si materiály</strong> — 24 příloh (kuchařka 40+ receptů, průvodci, deník návyků) máš v kurzu připravených ke stažení.", "<strong>Jeď po modulech popořadě</strong> — kurz je poskládaný jako cesta a moduly na sebe navazují."]}, {"t": "btn", "href": "https://martinbarna.cz/akademie/videokurz/?utm_source=email&utm_medium=drip&utm_campaign=onboarding", "text": "Otevřít videokurz"}, {"t": "p", "html": "Kdyby tě to nepustilo dovnitř (heslo, e-mail), stačí odpovědět na tenhle mail a vyřešíme to."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Co teď řešíš — hubnutí, nabírání, nebo se v tom chceš prostě vyznat? Odpověz jednou větou, poradím ti, kterými lekcemi začít."}]$j$::jsonb,
 14),

('onboarding-videokurz', 2, 'onb-vk-doporuc',
 $s$Znáš někoho, komu by kurz pomohl?$s$,
 $h$Kamarád dostane slevu 10 %, ty kredit na další nákup.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "jestli ti videokurz něco dal, mám prosbu i nabídku v jednom: <strong>doporuč ho někomu</strong>, kdo se pořád točí v dietách a restech."}, {"t": "bullets", "items": ["Kamarádovi dej kód <strong>DOPORUC10</strong> — má slevu 10 % na videokurz i Barna Academy.", "Tobě za každé doporučení připíšu <strong>kredit</strong> — svůj osobní kód a stav kreditu najdeš na stránce Doporuč a vydělej."]}, {"t": "btn", "href": "https://martinbarna.cz/akademie/moje/doporuc/?utm_source=email&utm_medium=drip&utm_campaign=onboarding", "text": "Můj doporučovací kód"}, {"t": "p", "html": "A jestli chceš místo samostudia vedení na míru — jídelníček, týdenní kontroly a moje oko na tvém progresu — mrkni na <a href=\"https://martinbarna.cz/#balicky\">koučink</a>."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 null),

('reactivation-member', 0, 'react-v1',
 $s$Dlouho jsme se neviděli{{fn_suffix}} — mrkni, co je nového$s$,
 $h$Tvoje členství na tebe čeká. A přibylo pár věcí, co ti usnadní návrat.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "všiml jsem si, že tvoje členství chvíli odpočívalo. Žádné výčitky — život se děje. Jen ti chci připomenout, že tam na tebe pořád čeká všechno, co k němu patří. A mezitím přibylo pár novinek, které ti návrat usnadní:"}, {"t": "bullets", "items": ["<strong>Poslech lekcí jedním klikem</strong> — každá lekce Academy se ti umí přečíst nahlas. V autě, na procházce, v posilce.", "<strong>Automatické přehrávání videokurzu</strong> — lekce jedou samy za sebou jako podcast.", "<strong>Postup se ukládá</strong> — pokračuješ přesně tam, kde naposledy. Žádné hledání."]}, {"t": "btn", "href": "https://martinbarna.cz/akademie/moje/", "text": "Pokračovat tam, kde naposledy →"}, {"t": "p", "html": "A jestli tě něco konkrétního zaseklo, odepiš mi na tenhle e-mail — pomůžu ti to rozlousknout."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 null),

('rescue-academy', 0, 'rescue-academy',
 $s$Tvoje objednávka Barna Academy čeká{{fn_suffix}}$s$,
 $h$Stačí ji dokončit — všechny lekce a nástroje se odemknou do minuty.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "všiml jsem si, že sis objednal[a] <strong>Barna Academy</strong>, ale platba nedoběhla. Objednávka je pořád připravená — stačí ji dokončit."}, {"t": "p", "html": "Připomenu, co tím získáš: <strong>241 lekcí</strong> pro trenéry a poradce, nástroje s PDF exporty pod tvým jménem, certifikaci — a celý videokurz výživy (182 lekcí) v ceně. Jednorázově, doživotně."}, {"t": "btn", "href": "https://form.simpleshop.cz/Xgl8g/buy/?utm_source=email&utm_medium=rescue", "text": "Dokončit objednávku"}, {"t": "p", "html": "Jestli ještě váháš nebo máš otázku (jestli je Academy pro tebe, jak probíhá certifikace…), odepiš mi — odpovídám osobně a rád to s tebou proberu."}, {"t": "ps", "html": "P.S. Tohle je jednorázová připomínka — žádné další maily k téhle objednávce. A máš 14denní garanci vrácení peněz."}]$j$::jsonb,
 null),

('rescue-videokurz', 0, 'rescue-vk',
 $s$Tvoje objednávka videokurzu čeká{{fn_suffix}} 🛒$s$,
 $h$Stačí ji dokončit — přístup máš pak do minuty.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "všiml jsem si, že tvoje objednávka <strong>videokurzu výživy</strong> zůstala kousek před cílem — platba nedoběhla. To se stává — karta zazlobí, něco vyruší. Objednávku máš pořád připravenou."}, {"t": "p", "html": "Jen připomenu, co v kurzu čeká: <strong>182 video lekcí</strong> (výživa, trénink, udržení formy), kalkulačka, kuchařka a další bonusy. Platíš jednou, přístup máš doživotně — a odemkne se ti do minuty po zaplacení."}, {"t": "btn", "href": "https://form.simpleshop.cz/3Vbl/buy/?utm_source=email&utm_medium=rescue", "text": "Dokončit objednávku"}, {"t": "p", "html": "Kdyby něco nefungovalo, nebo váháš, jestli je kurz pro tebe — klidně odepiš, odpovídám osobně. A kdyby rozhodovala cena: s kódem <strong>ZACNI15</strong> máš 15 % slevu."}, {"t": "ps", "html": "P.S. Tohle je jednorázová připomínka — žádné další maily k téhle objednávce ti chodit nebudou. Máš i 14denní garanci vrácení peněz."}]$j$::jsonb,
 null),

('upsell-academy', 0, 'upsell-ac-0',
 $s$Videokurz máš zvládnutý — kam dál?{{fn_suffix}}$s$,
 $h$Jestli tě to chytlo, tohle je level výš.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "videokurz máš za sebou — takže výživě rozumíš líp než většina lidí. Otázka je, jestli tě to <strong>chytlo natolik</strong>, že to chceš umět úplně do hloubky: pro sebe napořád, pro klienty, nebo na vlastní soutěžní přípravu."}, {"t": "p", "html": "Jestli ano, tvoje další zastávka je <strong>Barna Academy</strong> — celý můj systém, mnohem dál než videokurz:"}, {"t": "bullets", "items": ["<strong>241 lekcí ve 23 modulech</strong> — výživa, trénink, práce s klientkami, soutěžní příprava, byznys.", "<strong>Generátory v plné verzi</strong> — jídelníčky i tréninky bez omezení.", "<strong>Klientské materiály k přebrandování</strong> — vědecky podložená PDF pod tvým jménem a logem.", "<strong>Audio lekce + certifikace</strong> na konci.", "<strong>Videokurz je součástí</strong> — stavíš na tom, co už máš, neplatíš dvakrát."]}, {"t": "btn", "href": "https://martinbarna.cz/akademie/", "text": "Prohlédnout Academy"}, {"t": "p", "html": "Neprodávám ryby — <strong>učím rybařit.</strong> Nedostaneš jeden jídelníček, dostaneš schopnost sestavit jakýkoliv, sobě i komukoliv dalšímu.<br><strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Děláš to spíš pro sebe, nebo i pro klienty? Odepiš — a jestli spíš než učení chceš jistý výsledek na míru, řeknu ti o coachingu se mnou."}]$j$::jsonb,
 4),

('upsell-academy', 1, 'upsell-ac-1',
 $s$Proč ti makra po pár týdnech přestanou sedět$s$,
 $h$Nejčastější chyba, na které lidi i trenéři shoří.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "videokurz ti dal základ. Ale tady je věc, kterou vidím pořád dokola — u lidí, co makají pro sebe, i u trenérů:"}, {"t": "p", "html": "<strong>Makra nastavíš jednou a pak je půl roku neměníš.</strong> Tělo se ale adaptuje. Co fungovalo na startu, za pár týdnů přestane. Není to o vůli, prostě fyziologie."}, {"t": "p", "html": "Co s tím prakticky:"}, {"t": "bullets", "items": ["Drž <strong>bílkovinu vysoko a stabilně</strong> (zhruba 1,6–2 g na kg) — to je páka, na kterou se nešahá.", "Hýbej hlavně <strong>sacharidy a tuky</strong> podle toho, jak reaguje váha a zrcadlo — podle <strong>týdenního průměru</strong>, ne jednoho dne.", "U tréninku stejně: <strong>progresivní přetížení</strong>. Když týdny zvedáš pořád stejně, tělo nemá důvod se měnit."]}, {"t": "p", "html": "Tohle je rozdíl mezi „mám plán“ a „umím plán řídit“. To druhé je dovednost — a přesně tu tě v <strong>Barna Academy</strong> učím krok za krokem, do hloubky, kam videokurz nešel."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 4),

('upsell-academy', 2, 'upsell-ac-2',
 $s$Zaváděcí cena Academy: 8 900 místo 12 900{{fn_suffix}}$s$,
 $h$Doživotní přístup. Videokurz je v ceně, neplatíš dvakrát.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "narovinu, ať nezdržuju. <strong>Barna Academy</strong> teď běží za <strong>zaváděcí cenu 8 900 Kč</strong> místo plných <strong>12 900 Kč</strong>."}, {"t": "p", "html": "Není to umělá sleva na 14 dní — je to <strong>zaváděcí cena</strong> pro lidi, co naskočí teď, na začátku. Až bude obsahu a referencí víc, cena půjde nahoru a zpátky se nevrátí."}, {"t": "p", "html": "Co za to máš:"}, {"t": "bullets", "items": ["<strong>241 lekcí ve 23 modulech</strong> + generátory v plné verzi", "<strong>Přebrandovatelné klientské materiály</strong> — okamžitě použitelné", "<strong>Audio lekce, certifikace, celý videokurz</strong> v ceně (neplatíš ho podruhé)", "<strong>Doživotní přístup</strong> — zaplatíš jednou, máš napořád, včetně aktualizací"]}, {"t": "p", "html": "Spočítej si to: jestli to děláš pro klienty, vrátí se ti to na jednom dvou. Jestli pro sebe, je to zlomek toho, co stojí roky tápání a vyhozených peněz za nefunkční rady."}, {"t": "btn", "href": "https://martinbarna.cz/akademie/", "text": "Vzít Academy za 8 900 Kč"}, {"t": "p", "html": "Žádné „ideální pondělí“ nebude. <strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Váháš, jestli je pro tebe spíš Academy (nauč se to sám), nebo coaching (dovedu tě já)? Napiš mi jednou větou, co řešíš, a poradím ti narovinu."}]$j$::jsonb,
 null),

('upsell-coaching', 0, 'upsell-co-0',
 $s$Videokurz máš — chceš to teď vzít se mnou?{{fn_suffix}}$s$,
 $h$Dvě cesty dál. A jedna z nich znamená jistý výsledek.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "videokurz ti dal systém — víš, jak na to. Teď jsou před tebou <strong>dvě cesty</strong>, jak to posunout dál:"}, {"t": "bullets", "items": ["<strong>Naučit se to do hloubky</strong> — klidně i pro klienty nebo na pódium → to je <a href='https://martinbarna.cz/akademie/'>Barna Academy</a>.", "<strong>Nechat mě, ať tě k cíli dovedu já</strong> — plán na míru, týdenní úpravy, moje oko na tvém progresu → to je <strong>Online Coaching</strong>."]}, {"t": "p", "html": "Většina lidí, co chce hlavně <strong>jistý výsledek</strong> a ne to zas půl roku zkoušet sám, volí to druhé. Tak ti o něm řeknu narovinu."}, {"t": "p", "html": "Za 13 let jsem provedl přes 600 lidí. Namátkou:"}, {"t": "bullets", "items": ["<strong>Klientka (64 let): −20 kg za 12 týdnů</strong> — jen chůzí a kvalitní stravou, bez suplementů a bez zákazů.", "<strong>−12 kg (97 → 85)</strong> — postupně a udržitelně, žádné drastické diety.", "<strong>Tomáš a Katka</strong> — zhubli jako pár a <strong>2 roky si formu drží sami</strong>. O tom to celé je."]}, {"t": "p", "html": "To není náhoda ani genetika. Je to <strong>plán na míru + někdo, kdo tě u toho drží</strong>, když polevíš. A hlavně — <strong>naučíš se to</strong>, takže ti to zůstane napořád."}, {"t": "btn", "href": "https://martinbarna.cz/#balicky", "text": "Chci to vzít s Martinem"}, {"t": "p", "html": "Nechceš rovnou balíček? Dej si <strong>konzultaci za 1 990 Kč</strong> — a když do 14 dní začneš, <strong>odečtu ti ji z ceny</strong> (fakticky zdarma)."}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Ozvi se klidně jednou větou — co teď nejvíc řešíš? Podle toho ti řeknu, jestli je pro tebe spíš Gold, nebo Diamond."}]$j$::jsonb,
 5),

('upsell-coaching', 1, 'upsell-co-1',
 $s$Proč to se mnou půjde, když to samotný kurz nezlomil$s$,
 $h$Know-how máš. Chybí ti druhá půlka rovnice.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "videokurz ti dal <strong>know-how</strong>. Ale ruku na srdce — vědět, co dělat, a dělat to týden co týden i když se nechce, jsou dvě různé věci. Ta druhá půlka rozhoduje. A přesně tam přijdu já."}, {"t": "p", "html": "Co v coachingu dostaneš navíc oproti samostudiu:"}, {"t": "bullets", "items": ["<strong>Plán na míru tobě</strong> — ne obecná šablona, ale čísla a tréninky na tvoje tělo, život a cíl.", "<strong>Týdenní úpravy podle reálných dat</strong> — když se váha zasekne, hýbeme s tím hned, ne za měsíc.", "<strong>Accountability</strong> — víš, že se mi v neděli hlásíš. To drží lidi u věci líp než sebevětší motivace.", "<strong>Já na drátě</strong> — WhatsApp i mail, když něco nevíš nebo přijde krize."]}, {"t": "p", "html": "A na čem mi záleží nejvíc: <strong>nedělám z lidí závisláky.</strong> Vedu tě tak, ať tomu rozumíš a jednou to <strong>zvládneš úplně bez mé pomoci</strong> — jako Tomáš s Katkou, co si to 2 roky po spolupráci drží bez mého plánu."}, {"t": "p", "html": "A ať to není draze dvakrát: <strong>cenu videokurzu ti odečtu z ceny coachingu</strong> — u <strong>3měsíčního a 6měsíčního</strong> balíčku. Vstupní investice do videokurzu se ti tak vrátí."}, {"t": "btn", "href": "https://martinbarna.cz/#balicky", "text": "Vybrat balíček"}, {"t": "p", "html": "<strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Gold, nebo Diamond? Napiš mi cíl a časový horizont, poradím ti, co se ti vyplatí."}]$j$::jsonb,
 6),

('upsell-coaching', 2, 'upsell-co-2',
 $s$Poslední věc k tomu coachingu{{fn_suffix}}$s$,
 $h$Bez tlaku. Jen ať víš, že dveře jsou otevřené.$h$,
 $j$[{"t": "p", "html": "Ahoj{{fn_space}},"}, {"t": "p", "html": "nebudu tě otravovat donekonečna — tohle je k coachingu poslední. Žádný umělý časovač, jen ať víš, jak to je."}, {"t": "p", "html": "Většina mých klientů má společné jedno: <strong>rok dva to zkoušeli sami</strong>, četli, střídali diety — a pak si řekli dost a vzali to se mnou. A skoro každý lituje jediného: <strong>že to neudělal dřív.</strong>"}, {"t": "p", "html": "Nejlepší reklamu mi přitom nedělám já — dělají ji oni. <strong>Spokojený klient mi pošle dalšího</strong>, protože výsledek je vidět a drží. To o kvalitě řekne víc než jakýkoliv můj text."}, {"t": "p", "html": "Jestli chceš mít konečně jistotu, že tě to někam dovede — jsem tady:"}, {"t": "btn", "href": "https://martinbarna.cz/#balicky", "text": "Mrknout na balíčky"}, {"t": "p", "html": "A jestli teď není ta chvíle, nevadí. Videokurz máš doživotně, jeď podle něj a klidně se ozvi za měsíc. Budu tady.<br><strong>Be Effective!</strong><br>Martin"}, {"t": "ps", "html": "P.S. Máš jen otázku, ne rozhodnutí? Napiš mi na WhatsApp — nezávazně, bez prodejních keců."}]$j$::jsonb,
 null)

on conflict (track, step) do update set
  key = excluded.key, subject = excluded.subject, preheader = excluded.preheader,
  blocks = excluded.blocks, wait_days = excluded.wait_days, updated_at = now();
