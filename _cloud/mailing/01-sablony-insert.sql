-- ============================================================================
-- NOVÉ TRATĚ vip-free, vip-kupci, vip-leady: šablony (13 řádků)
-- ⛔⛔ NÁVRH, NESPOUŠTĚT. Vygenerováno z _cloud/mailing/sablony.cjs (generuj.cjs), 9. 10. 2026.
-- Vložení šablon je INERTNÍ: do nových tratí nikdo nevede, dokud se nespustí 02-*.sql.
-- ⛔ Texty schvaluje Martin. Před ostrým během TEST na fitness.barna@gmail.com
--    (drip-send {test_email, track, step}) a výslovné „pošli ostro".
-- ============================================================================

begin;
do $mig$
declare n int;
begin
  -- Pojistka: tratě ještě nesmí existovat (jinak by insert spadl na PK uprostřed).
  select count(*) into n from public.email_templates where track in ('vip-free','vip-kupci','vip-leady');
  if n > 0 then raise exception 'Tratě vip-* už v email_templates jsou (% řádků). Nic jsem nevložil.', n; end if;

  insert into public.email_templates (track, step, key, subject, preheader, blocks, wait_days) values
  ($q$vip-free$q$, 0, $q$vf-1-zapisujes$q$,
   $q$Zapisuješ. Teď ať s tím appka něco udělá$q$,
   $q$Co se ve VIP stane s daty, která v appce už máš.$q$,
   $q$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"v appce už nějaký čas zapisuješ. Máš tím data o tom, co doopravdy jíš a jak se hýbe váha. S nimi se dá počítat."},{"t":"p","html":"Ve Free si vyplníš check-in a uvidíš rozbor týdne. Od Basicu výš s ním appka dál pracuje: podle toho, co jsi snědl[a] a jak se hnula váha, ti přepočítá kalorie a makra na další týden a poskládá k nim jídelníček i trénink."},{"t":"p","html":"Ve <strong>VIP</strong> máš k tomu AI kouče, který tvoje zápisy vidí. Napíšeš mu „proč mi appka zvedla sacharidy?“ a odpoví podle tvých čísel. Kalorie a makra počítá pořád appka, kouč ti jen vysvětlí, proč vyšly takhle."},{"t":"p","html":"🎁 K první platbě VIP ti přidám svůj videokurz výživy: 182 videí, hodnota {{course_price}} Kč. Zůstane ti, i když předplatné zrušíš."},{"t":"btn","text":"Přejít na VIP za {{cena_vip_mesic}} Kč","href":"https://tvujcoach.cz/client/subscription?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-free&utm_content=vf-1"},{"t":"p","html":"Zrušíš kdykoli v Profilu. Když ti to do 14 dnů nesedne, vrátím ti peníze."},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"},{"t":"ps","html":"P.S. Free ti zůstává napořád. Nic z toho, co teď v appce používáš, ti nevezmu."}]$q$::jsonb,
   3),
  ($q$vip-free$q$, 1, $q$vf-2-foto-hlas$q$,
   $q$Zapsat oběd za pár vteřin$q$,
   $q$Dvě zkratky ve VIP pro dny, kdy se nechce nic ťukat.$q$,
   $q$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"u klientů vidím jeden důvod, proč zápis skončí, častěji než všechny ostatní dohromady: zdržuje. Hledání v databázi, gramáže, deset ťuknutí na jeden oběd."},{"t":"p","html":"Proto jsou ve VIP dvě zkratky:"},{"t":"bullets","items":["<strong>Foto jídla.</strong> Vyfotíš talíř, klidně domácí kuchyni bez obalu. AI pozná i víc jídel na jedné fotce a odhadne kalorie a makra. Odhad vidíš a před zápisem opravíš. Olej a omáčku na fotce nepozná, ty doplň.","<strong>Zápis hlasem.</strong> Řekneš „rohlík, tvaroh dvě stě gramů a tři deci vody“ a appka větu rozebere. Potvrdíš, nebo opravíš."]},{"t":"p","html":"Snídani, kterou máš pětkrát týdně, zapíšeš i ve Free jedním ťuknutím ze šablony. Foto a hlas ti ušetří čas u všeho ostatního."},{"t":"btn","text":"Chci VIP","href":"https://tvujcoach.cz/client/subscription?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-free&utm_content=vf-2"},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"},{"t":"ps","html":"P.S. K první platbě VIP dostaneš i videokurz výživy zdarma."}]$q$::jsonb,
   4),
  ($q$vip-free$q$, 2, $q$vf-3-ai-kouc$q$,
   $q$Váha se týden nehýbe. Mám ubrat?$q$,
   $q$AI kouč ve VIP odpovídá podle mojí metodiky a jídlo zapíše za tebe.$q$,
   $q$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"tyhle tři otázky dostávám nejčastěji:"},{"t":"bullets","items":["„Váha se týden nehýbe. Mám ubrat?“","„Proč mi appka zvedla sacharidy?“","„Jsem na oslavě. Jak to zapsat, ať si nezkazím týden?“"]},{"t":"p","html":"Ve VIP je zodpoví AI kouč. Vidí tvoje zápisy i vývoj váhy a drží se metodiky, se kterou pracuju s klienty od roku 2013. Když mu napíšeš, co jsi snědl[a], rovnou to zapíše."},{"t":"btn","text":"Napsat AI koučovi ve VIP","href":"https://tvujcoach.cz/client/subscription?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-free&utm_content=vf-3"},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"},{"t":"ps","html":"P.S. Basic za {{cena_basic_mesic}} Kč umí přepočet cílů a generátory. AI kouče, foto ani hlas nemá, proto ti doporučuju VIP."}]$q$::jsonb,
   4),
  ($q$vip-free$q$, 3, $q$vf-4-shrnuti$q$,
   $q$Free, Basic, nebo VIP? Shrnutí na jednu obrazovku$q$,
   $q$Ať se rozhodneš v klidu. Free ti zůstává tak jako tak.$q$,
   $q$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"tohle je poslední mail o předplatném z téhle řady. Shrnu ti to na jednu obrazovku:"},{"t":"bullets","items":["<strong>Free (zdarma, napořád):</strong> zápis jídla i tréninku, skener čárových kódů, přes {{pocet_potravin}} potravin, šablony a 14 dní historie.","<strong>Basic ({{cena_basic_mesic}} Kč měsíčně):</strong> navíc týdenní přepočet kalorií a maker, generátor jídelníčku i tréninku, „Co si můžu ještě dnes dát“ a celá historie.","<strong>VIP ({{cena_vip_mesic}} Kč měsíčně):</strong> všechno z Basicu, k tomu AI kouč, foto jídla a zápis hlasem. A k první platbě videokurz výživy zdarma."]},{"t":"p","html":"Když víš, že do toho jdeš na delší dobu, roční VIP vyjde na {{cena_vip_rok}} Kč, tedy dva měsíce zdarma. K ročnímu VIP navíc přidávám měsíc Barna Academy na zkoušku."},{"t":"btn","text":"Vybrat VIP","href":"https://tvujcoach.cz/client/subscription?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-free&utm_content=vf-4"},{"t":"p","html":"Zrušíš kdykoli v Profilu, zaplacené období doběhne a dál se nic nestrhne. Do 14 dnů od začátku ti vrátím celou částku, když ti to nesedne."},{"t":"p","html":"A když zůstaneš ve Free, taky dobře. Zapisuj dál. Z dat, která máš, se dá navázat kdykoli později."},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"},{"t":"ps","html":"P.S. Na tenhle mail jde odepsat, čtu to sám."}]$q$::jsonb,
   null),
  ($q$vip-kupci$q$, 0, $q$vk-1-v-pondeli$q$,
   $q$Kurz máš v hlavě. Kdo ti to spočítá v pondělí?$q$,
   $q$Appka Tvůj Coach dělá s tvými čísly to, co učím ve videokurzu.$q$,
   $q$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"ve videokurzu jsi viděl[a], jak funguje kalorický deficit a kolik bílkovin, sacharidů a tuků jíst."},{"t":"p","html":"V praxi to znamená každý týden sečíst, co jsi snědl[a], porovnat to s váhou a rozhodnout, jestli ubrat, přidat, nebo vydržet. Tohle za tebe dělá appka <strong>Tvůj Coach</strong>."},{"t":"p","html":"Ve <strong>VIP</strong> ti každý týden z tvých zápisů přepočítá kalorie a makra, poskládá jídelníček z běžných potravin a trénink podle toho, kde cvičíš. A na otázky ti odpoví AI kouč, podle stejné metodiky, jakou znáš z kurzu."},{"t":"btn","text":"Chci VIP za {{cena_vip_mesic}} Kč měsíčně","href":"https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-kupci&utm_content=vk-1"},{"t":"p","html":"Zrušíš kdykoli v appce. Když ti to do 14 dnů nesedne, vrátím ti peníze."},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"},{"t":"ps","html":"P.S. Zápis jídla i tréninku máš v appce zdarma napořád. Účet si zakládej na stejný e-mail, jaký máš u videokurzu."}]$q$::jsonb,
   4),
  ($q$vip-kupci$q$, 1, $q$vk-2-oslava$q$,
   $q$Oslava, oběd venku a den, kdy se nechce ťukat$q$,
   $q$AI kouč, foto a hlas: co VIP přidá k tomu, co znáš z kurzu.$q$,
   $q$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"podle studií lidi svůj příjem podhodnotí o 20 až 50 %. U klientů vidím, kde ta díra vzniká nejčastěji: ve dnech, kdy se zápis vynechá celý. Oslava, oběd venku, večer bez chuti cokoli ťukat."},{"t":"p","html":"Ve VIP máš přesně na tyhle dny tři zkratky:"},{"t":"bullets","items":["<strong>Oslava.</strong> Napíšeš AI koučovi, co jsi snědl[a], a on to za tebe zapíše. Když nevíš, jak s tím naložit zbytek týdne, zeptáš se rovnou jeho.","<strong>Oběd venku bez obalu.</strong> Vyfotíš talíř, AI odhadne jídla i makra. Odhad před zápisem zkontroluješ a olej s omáčkou doplníš, ty fotka nepozná.","<strong>Nechce se ti ťukat.</strong> Řekneš „dvě vejce, krajíc chleba a jablko“ a appka to rozebere sama."]},{"t":"btn","text":"Chci VIP","href":"https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-kupci&utm_content=vk-2"},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"}]$q$::jsonb,
   4),
  ($q$vip-kupci$q$, 2, $q$vk-3-basic-nebo-vip$q$,
   $q$Basic, nebo VIP? Napíšu ti to narovinu$q$,
   $q$Rozdíl je v AI koučovi, fotce a hlasu.$q$,
   $q$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"v appce jsou dva placené plány a chci, abys věděl[a], proč ti doporučuju ten dražší."},{"t":"p","html":"<strong>Basic</strong> za {{cena_basic_mesic}} Kč měsíčně ti každý týden přepočítá cíle a má generátor jídelníčku i tréninku."},{"t":"p","html":"<strong>VIP</strong> za {{cena_vip_mesic}} Kč měsíčně umí všechno z Basicu a k tomu AI kouče, foto jídla a zápis hlasem. Teorii znáš z kurzu. Horší je neděle večer, kdy váha po týdnu stojí a ty nevíš, jestli ubrat. Tam ti AI kouč odpoví hned, podle tvých zápisů."},{"t":"p","html":"Když víš, že u toho vydržíš, vezmi rovnou rok. Vyjde na {{cena_vip_rok}} Kč, tedy dva měsíce zdarma, a k ročnímu VIP přidávám měsíc Barna Academy na zkoušku, pokud v ní ještě nejsi."},{"t":"btn","text":"Chci VIP","href":"https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-kupci&utm_content=vk-3"},{"t":"p","html":"Zrušit jde kdykoli. A když ti to do 14 dnů od začátku nesedne, vrátím celou částku."},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"}]$q$::jsonb,
   5),
  ($q$vip-kupci$q$, 3, $q$vk-4-posledni$q$,
   $q$Poslední mail o appce z téhle řady$q$,
   $q$Nikde neběží odpočet. Krátké shrnutí a konec téhle řady.$q$,
   $q$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"tohle je poslední mail o appce z téhle řady. Cena zítra platí stejně, nikde neběží žádný odpočet."},{"t":"p","html":"Videokurz ti dal pravidla. Ve VIP podle nich appka každý týden přepočítá tvoje kalorie a makra a AI kouč ti je vysvětlí, kdykoli se zeptáš."},{"t":"btn","text":"Vzít VIP za {{cena_vip_mesic}} Kč","href":"https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-kupci&utm_content=vk-4"},{"t":"p","html":"Když teď není ta chvíle, nic se neděje. Zápis máš v appce zdarma dál a já ti budu psát o výživě jako dosud."},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"},{"t":"ps","html":"P.S. Odpovědi na tenhle mail chodí přímo mně. Čtu je sám."}]$q$::jsonb,
   null),
  ($q$vip-leady$q$, 0, $q$vl-1-kdo-upravi$q$,
   $q$Plán máš. Kdo ti ho upraví, až se váha zastaví?$q$,
   $q$Appka, která z tvých zápisů každý týden přepočítá cíl. K první platbě VIP videokurz zdarma.$q$,
   $q$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"jednou přijde týden, kdy se váha nehne. A vedle tebe nikdo, kdo by řekl, jestli ubrat, nebo ještě počkat. U klientů vidím, že přesně tady to lidi vzdávají nejčastěji."},{"t":"p","html":"Na tohle jsem postavil appku <strong>Tvůj Coach</strong>. Ve <strong>VIP</strong> ti každý týden z tvých zápisů a vážení přepočítá kalorie i makra, k nim sestaví jídelníček z běžných potravin a trénink podle toho, kde cvičíš. A k tomu AI kouč, který tvoje čísla vidí a odpoví ti k nim, i v neděli večer."},{"t":"p","html":"🎁 K první platbě VIP ti přidám svůj videokurz výživy: 182 videí, hodnota {{course_price}} Kč. Zůstane ti, i když předplatné zrušíš."},{"t":"btn","text":"Chci VIP za {{cena_vip_mesic}} Kč měsíčně","href":"https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-leady&utm_content=vl-1"},{"t":"p","html":"Zrušíš kdykoli v appce. Když ti to do 14 dnů nesedne, vrátím ti peníze."},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"},{"t":"ps","html":"P.S. Zapisovat jídlo i trénink můžeš v appce zdarma napořád a bez karty. Ve VIP platíš za to, že s těmi čísly appka pracuje za tebe."}]$q$::jsonb,
   3),
  ($q$vip-leady$q$, 1, $q$vl-2-oslava$q$,
   $q$Oslava v sobotu. Jak ji zapsat?$q$,
   $q$Dvě funkce z VIP, kvůli kterým lidi u zápisu vydrží.$q$,
   $q$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"dvě situace, kde se zápis utrhne nejsnáz."},{"t":"p","html":"<strong>Oslava.</strong> Dort, chlebíčky, víno, a v hlavě „to už nemá cenu zapisovat“. Ve VIP napíšeš AI koučovi, co jsi snědl[a], on to zapíše a řekne ti, jak s tím naložit zbytek týdne."},{"t":"p","html":"<strong>Oběd venku.</strong> Žádný obal, žádný čárový kód. Vyfotíš talíř, AI odhadne jídla i makra. Odhad před zápisem zkontroluješ a olej s omáčkou doplníš, ty fotka nepozná."},{"t":"p","html":"Podle studií lidi svůj příjem podhodnotí o 20 až 50 %. Velký kus z toho jsou právě dny, kdy se zápis vynechá celý. Proto chci, aby ti zápis zabral co nejméně času i v sobotu večer."},{"t":"btn","text":"Chci VIP","href":"https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-leady&utm_content=vl-2"},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"},{"t":"ps","html":"P.S. K první platbě VIP pořád platí videokurz výživy zdarma."}]$q$::jsonb,
   3),
  ($q$vip-leady$q$, 2, $q$vl-3-videokurz$q$,
   $q$Proč k VIP přidávám celý videokurz$q$,
   $q$Ať víš, proč appka počítá zrovna takhle.$q$,
   $q$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"appka ti každý den řekne, kolik jíst. Jenže číslo bez vysvětlení drží jen do první oslavy nebo dovolené. Pak přijde „a proč vlastně zrovna tolik?“ a bez odpovědi se to pustí."},{"t":"p","html":"Proto k první platbě VIP přidávám videokurz výživy. 182 videí o tom, jak funguje kalorický deficit, kolik bílkovin, sacharidů a tuků jíst a jak jíst flexibilně bez zakázaných jídel."},{"t":"p","html":"Samostatně stojí {{course_price}} Kč. K VIP ho máš zdarma a zůstane ti, i když předplatné po měsíci zrušíš."},{"t":"btn","text":"Chci VIP i s videokurzem","href":"https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-leady&utm_content=vl-3"},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"},{"t":"ps","html":"P.S. Cíl je, abys za pár měsíců věděl[a], co dělat, i bez appky a beze mě. Na to je ten kurz."}]$q$::jsonb,
   4),
  ($q$vip-leady$q$, 3, $q$vl-4-namitky$q$,
   $q$Tři věci, které mi lidi k appce říkají nejčastěji$q$,
   $q$Zapisování, cena a co když to nevydržím.$q$,
   $q$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"když lidem nabídnu appku, vrací se mi pořád tři věty. Odpovím na ně rovnou."},{"t":"p","html":"<strong>„Nebaví mě zapisovat.“</strong> Proto je ve VIP zápis hlasem a z fotky. Řekneš „kuřecí prsa dvě stě gramů, rýže a okurka“ a appka to rozebere. Talíř v restauraci vyfotíš. A snídani, kterou máš pětkrát týdně, zapíšeš jedním ťuknutím ze šablony."},{"t":"p","html":"<strong>„Nechci další předplatné.“</strong> Zápis jídla i tréninku, skener a databáze potravin jsou zdarma napořád. VIP má navíc týdenní přepočet cílů, generátory a AI kouče. Když AI nepotřebuješ, v appce je i Basic za {{cena_basic_mesic}} Kč s přepočtem a generátory, jen bez kouče a bez videokurzu."},{"t":"p","html":"<strong>„Co když to nevydržím?“</strong> Zrušíš kdykoli v appce a zaplacené období doběhne. Když ti to do 14 dnů od začátku nesedne, napiš mi na martin@martinbarna.cz a vrátím ti celou částku. Videokurz při vrácení peněz odchází s nimi."},{"t":"btn","text":"Vzít VIP za {{cena_vip_mesic}} Kč","href":"https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-leady&utm_content=vl-4"},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"}]$q$::jsonb,
   4),
  ($q$vip-leady$q$, 4, $q$vl-5-posledni$q$,
   $q$Poslední mail k appce. Cena zítra platí stejně$q$,
   $q$Shrnutí na jednu obrazovku a roční VIP. Nikde neběží odpočet.$q$,
   $q$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"tohle je poslední mail o appce z téhle řady. Cena zítra platí stejně, takže se rozhoduj v klidu."},{"t":"p","html":"VIP je celá appka: týdenní přepočet kalorií a maker podle tvých zápisů, jídelníček i trénink, AI kouč, foto a hlas. K první platbě videokurz výživy zdarma."},{"t":"p","html":"Když víš, že to chceš dělat dlouhodobě, vezmi rovnou rok. Vyjde na {{cena_vip_rok}} Kč, tedy dva měsíce zdarma, a k ročnímu VIP přidávám měsíc Barna Academy na zkoušku. Roční variantu najdeš v ceníku appky."},{"t":"btn","text":"Vybrat VIP","href":"https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-leady&utm_content=vl-5"},{"t":"p","html":"A když to teď nedává smysl, nic se neděje. Tipy ti budu posílat dál."},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"},{"t":"ps","html":"P.S. Na tenhle mail jde odepsat. Čtu to sám."}]$q$::jsonb,
   null);

  get diagnostics n = row_count;
  if n <> 13 then raise exception 'Čekal jsem 13 řádků, vloženo %', n; end if;
end
$mig$;
commit;

-- Kontrola po vložení (jen čtení):
-- select track, step, key, wait_days, subject from public.email_templates
--  where track like 'vip-%' order by track, step;
