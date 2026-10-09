-- ============================================================================
-- OPRAVA P0: 4 existující kroky „basic249" → VIP 499 (videokurz jen k VIP)
-- ⛔⛔ NÁVRH, NESPOUŠTĚT. Vygenerováno z _cloud/mailing/sablony.cjs (generuj.cjs), 9. 10. 2026.
-- Od 30. 9. 2026 dostává videokurz jen VIP (app-purchase-bridge, PRAVIDLO_BONUSU vip-2026-09-30),
-- ale tyhle 4 šablony (snímek živé DB 23. 9.) prodávají Basic a slibují k němu videokurz.
-- ⛔ UPDATE ŠABLONY JE ROZESLÁNÍ (CLAUDE.md 25. 7.): drip běží každou hodinu. Spouštět až po schválení textu.
-- ⛔ ZÁMEK: řádek se změní JEN když má pořád původní key (= nikdo ho mezitím nepřepsal přes MCP).
--    Když počet nesedí, celé se to vrátí. wait_days se NEMĚNÍ.
-- ⛔ Texty schvaluje Martin. Před ostrým během TEST na fitness.barna@gmail.com
--    (drip-send {test_email, track, step}) a výslovné „pošli ostro".
-- ============================================================================

begin;
do $mig$
declare n int;
begin
  create table public.zaloha_email_templates_vip_20261009 as
    select * from public.email_templates
     where (track, step) in (($q$lead-magnet$q$, 9), ($q$longtail-consumer$q$, 5), ($q$nurture-videokurz$q$, 8), ($q$tc-start$q$, 2));
  alter table public.zaloha_email_templates_vip_20261009 enable row level security;
  revoke all on public.zaloha_email_templates_vip_20261009 from anon, authenticated;

  update public.email_templates t
     set key = z.novy_key, subject = z.subject, preheader = z.preheader, blocks = z.blocks, updated_at = now()
    from (values
    ($q$lead-magnet$q$, 9, $q$lm-9-basic249$q$, $q$lm-9-vip499$q$,
     $q$Cíle, jídelníček, trénink a AI kouč za {{cena_vip_mesic}} Kč měsíčně$q$,
     $q$Co jsem s klienty dělal ručně v tabulkách, dělá appka sama. K VIP videokurz zdarma.$q$,
     $q$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"pár týdnů ti posílám tipy. Dnes ti ukážu, kam s nimi jít, aby se z nich staly čísla na váze."},{"t":"p","html":"Postavil jsem appku <strong>Tvůj Coach</strong>. Dělá to, co jsem s klienty roky dělal ručně v tabulkách: spočítá ti kalorie a makra, každý týden je upraví podle toho, co jsi skutečně jedl[a] a jak se hnula váha, a sestaví ti jídelníček z běžných potravin i trénink podle toho, kde cvičíš."},{"t":"p","html":"Ve <strong>VIP za {{cena_vip_mesic}} Kč měsíčně</strong> máš:"},{"t":"bullets","items":["týdenní check-in a automatickou úpravu cílů (když zapíšeš málo dnů, appka cíli nehne, radši než hádat)","generátor jídelníčku z běžných potravin a generátor tréninku","AI kouče, který vidí tvoje čísla a odpoví mým stylem, a zápis jídla z fotky i hlasem","🎁 k první platbě můj videokurz výživy zdarma (182 videí, hodnota {{course_price}} Kč). Zůstane ti, i když předplatné zrušíš. Při vrácení peněz odchází s ním."]},{"t":"p","html":"Zápis jídla i tréninku, hledání v databázi přes {{pocet_potravin}} potravin i skener čárových kódů zůstávají zdarma napořád. Platíš za to, že appka z tvých čísel dělá rozhodnutí za tebe."},{"t":"btn","text":"Chci VIP za {{cena_vip_mesic}} Kč","href":"https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=lead-magnet&utm_content=vip-499"},{"t":"p","html":"Platíš kartou a zrušíš kdykoli přímo v appce. Když ti to do 14 dnů nesedne, vrátím peníze."},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"},{"t":"ps","html":"P.S. Když AI kouče nepotřebuješ, je v appce i Basic za {{cena_basic_mesic}} Kč. Umí přepočet cílů a generátory, jen bez kouče a bez videokurzu."}]$q$::jsonb),
    ($q$longtail-consumer$q$, 5, $q$lc-11-basic249$q$, $q$lc-11-vip499$q$,
     $q$Cíle, jídelníček, trénink a AI kouč za {{cena_vip_mesic}} Kč měsíčně$q$,
     $q$Co jsem s klienty dělal ručně v tabulkách, dělá appka sama. K VIP videokurz zdarma.$q$,
     $q$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"pár týdnů ti posílám tipy. Dnes ti ukážu, kam s nimi jít, aby se z nich staly čísla na váze."},{"t":"p","html":"Postavil jsem appku <strong>Tvůj Coach</strong>. Dělá to, co jsem s klienty roky dělal ručně v tabulkách: spočítá ti kalorie a makra, každý týden je upraví podle toho, co jsi skutečně jedl[a] a jak se hnula váha, a sestaví ti jídelníček z běžných potravin i trénink podle toho, kde cvičíš."},{"t":"p","html":"Ve <strong>VIP za {{cena_vip_mesic}} Kč měsíčně</strong> máš:"},{"t":"bullets","items":["týdenní check-in a automatickou úpravu cílů (když zapíšeš málo dnů, appka cíli nehne, radši než hádat)","generátor jídelníčku z běžných potravin a generátor tréninku","AI kouče, který vidí tvoje čísla a odpoví mým stylem, a zápis jídla z fotky i hlasem","🎁 k první platbě můj videokurz výživy zdarma (182 videí, hodnota {{course_price}} Kč). Zůstane ti, i když předplatné zrušíš. Při vrácení peněz odchází s ním."]},{"t":"p","html":"Zápis jídla i tréninku, hledání v databázi přes {{pocet_potravin}} potravin i skener čárových kódů zůstávají zdarma napořád. Platíš za to, že appka z tvých čísel dělá rozhodnutí za tebe."},{"t":"btn","text":"Chci VIP za {{cena_vip_mesic}} Kč","href":"https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=longtail-consumer&utm_content=vip-499"},{"t":"p","html":"Platíš kartou a zrušíš kdykoli přímo v appce. Když ti to do 14 dnů nesedne, vrátím peníze."},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"},{"t":"ps","html":"P.S. Když AI kouče nepotřebuješ, je v appce i Basic za {{cena_basic_mesic}} Kč. Umí přepočet cílů a generátory, jen bez kouče a bez videokurzu."}]$q$::jsonb),
    ($q$nurture-videokurz$q$, 8, $q$nv-8-basic249$q$, $q$nv-8-vip499$q$,
     $q$Cíle, jídelníček, trénink a AI kouč za {{cena_vip_mesic}} Kč měsíčně$q$,
     $q$Co jsem s klienty dělal ručně v tabulkách, dělá appka sama. K VIP videokurz zdarma.$q$,
     $q$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"pár týdnů ti posílám tipy. Dnes ti ukážu, kam s nimi jít, aby se z nich staly čísla na váze."},{"t":"p","html":"Postavil jsem appku <strong>Tvůj Coach</strong>. Dělá to, co jsem s klienty roky dělal ručně v tabulkách: spočítá ti kalorie a makra, každý týden je upraví podle toho, co jsi skutečně jedl[a] a jak se hnula váha, a sestaví ti jídelníček z běžných potravin i trénink podle toho, kde cvičíš."},{"t":"p","html":"Ve <strong>VIP za {{cena_vip_mesic}} Kč měsíčně</strong> máš:"},{"t":"bullets","items":["týdenní check-in a automatickou úpravu cílů (když zapíšeš málo dnů, appka cíli nehne, radši než hádat)","generátor jídelníčku z běžných potravin a generátor tréninku","AI kouče, který vidí tvoje čísla a odpoví mým stylem, a zápis jídla z fotky i hlasem","🎁 k první platbě můj videokurz výživy zdarma (182 videí, hodnota {{course_price}} Kč). Zůstane ti, i když předplatné zrušíš. Při vrácení peněz odchází s ním."]},{"t":"p","html":"Zápis jídla i tréninku, hledání v databázi přes {{pocet_potravin}} potravin i skener čárových kódů zůstávají zdarma napořád. Platíš za to, že appka z tvých čísel dělá rozhodnutí za tebe."},{"t":"btn","text":"Chci VIP za {{cena_vip_mesic}} Kč","href":"https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=nurture-videokurz&utm_content=vip-499"},{"t":"p","html":"Platíš kartou a zrušíš kdykoli přímo v appce. Když ti to do 14 dnů nesedne, vrátím peníze."},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"},{"t":"ps","html":"P.S. Když AI kouče nepotřebuješ, je v appce i Basic za {{cena_basic_mesic}} Kč. Umí přepočet cílů a generátory, jen bez kouče a bez videokurzu."}]$q$::jsonb),
    ($q$tc-start$q$, 2, $q$tcs-2-basic249$q$, $q$tcs-2-vip499$q$,
     $q$Cíle, jídelníček, trénink a AI kouč za {{cena_vip_mesic}} Kč měsíčně$q$,
     $q$Co jsem s klienty dělal ručně v tabulkách, dělá appka sama. K VIP videokurz zdarma.$q$,
     $q$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"pár týdnů ti posílám tipy. Dnes ti ukážu, kam s nimi jít, aby se z nich staly čísla na váze."},{"t":"p","html":"Postavil jsem appku <strong>Tvůj Coach</strong>. Dělá to, co jsem s klienty roky dělal ručně v tabulkách: spočítá ti kalorie a makra, každý týden je upraví podle toho, co jsi skutečně jedl[a] a jak se hnula váha, a sestaví ti jídelníček z běžných potravin i trénink podle toho, kde cvičíš."},{"t":"p","html":"Ve <strong>VIP za {{cena_vip_mesic}} Kč měsíčně</strong> máš:"},{"t":"bullets","items":["týdenní check-in a automatickou úpravu cílů (když zapíšeš málo dnů, appka cíli nehne, radši než hádat)","generátor jídelníčku z běžných potravin a generátor tréninku","AI kouče, který vidí tvoje čísla a odpoví mým stylem, a zápis jídla z fotky i hlasem","🎁 k první platbě můj videokurz výživy zdarma (182 videí, hodnota {{course_price}} Kč). Zůstane ti, i když předplatné zrušíš. Při vrácení peněz odchází s ním."]},{"t":"p","html":"Zápis jídla i tréninku, hledání v databázi přes {{pocet_potravin}} potravin i skener čárových kódů zůstávají zdarma napořád. Platíš za to, že appka z tvých čísel dělá rozhodnutí za tebe."},{"t":"btn","text":"Chci VIP za {{cena_vip_mesic}} Kč","href":"https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=tc-start&utm_content=vip-499"},{"t":"p","html":"Platíš kartou a zrušíš kdykoli přímo v appce. Když ti to do 14 dnů nesedne, vrátím peníze."},{"t":"p","html":"<strong>Be Effective!</strong><br>Martin"},{"t":"ps","html":"P.S. Když AI kouče nepotřebuješ, je v appce i Basic za {{cena_basic_mesic}} Kč. Umí přepočet cílů a generátory, jen bez kouče a bez videokurzu."}]$q$::jsonb)
    ) as z(track, step, puvodni_key, novy_key, subject, preheader, blocks)
   where t.track = z.track and t.step = z.step and t.key = z.puvodni_key;

  get diagnostics n = row_count;
  if n <> 4 then raise exception 'Čekal jsem 4 řádky, změněno %. Někdo šablonu mezitím upravil, nic se neměnilo.', n; end if;
end
$mig$;
commit;

-- Návrat: update public.email_templates t set key=z.key, subject=z.subject, preheader=z.preheader,
--   blocks=z.blocks, updated_at=now() from public.zaloha_email_templates_vip_20261009 z
--   where t.track=z.track and t.step=z.step;
