-- ============================================================================
-- TYDENIK: stejne vyluky jako newsletter + zakaz snimkovat PUJCENY stav
-- 16. 9. 2026, 73. sef (stavec Academy). IDEMPOTENTNI, spustitelne opakovane.
--
-- CO SE OPRAVUJE (nalezy B/N2, B/N3 a B/N13 z `ANALYZA-mailove-toky.md`, vse
-- overeno proti zivemu `pg_get_functiondef` a proti `email_events`):
--   1) `tydenik_prijemci` nemela ani jednu z peti vyluk, ktere `newsletter_prijemci`
--      ma. Dusledek: 149 lidi za 30 dni dostalo dva maily v jeden den (ve VSECH
--      149 pripadech byl tydenik druhy) a tydenik chodil rodine i na Martinovy
--      testovaci adresy `fitness.barna+*`.
--   2) Obe rozesilky snimkovaly stav leada i tehdy, kdyz uz byl PUJCENY te druhe.
--      Snimek pak ulozil lez a vraceni cloveka zaparkovalo na cizi trati natrvalo
--      (14. 9. 2026 se to stalo leadovi 7d4762b5-3100-4f21-9da9-6377a51ce938:
--      prisel o `lead-magnet` step 5 s terminem 15. 9.). Ze peti takovych pripadu
--      se ctyri zachranily jen poradim cronu, coz neni pojistka.
--
-- ⛔ TELA FUNKCI JSOU VZATA ZE ZIVEHO ZNENI, ne z `tydenik-rozesilka.sql` v gitu.
--    Otisk pred zmenou: `zive-tydenik-2026-09-16.sql` (vsech sest funkci obou
--    rozesilek). Git je pozadu: zive `tydenik_prijemci` ma navic kontrolu
--    `odhlaseni_trvale` z 6. 9. 2026, v gitu ta podminka chybi.
--
-- ⛔ PRAVIDLO 8: kazde jmeno ma v `pg_proc` PRESNE JEDNU variantu signatury
--    (overeno pred psanim migrace), signatury se tady NEMENI, `create or replace`
--    je tedy skutecna nahrada a granty (`{postgres=X/postgres,service_role=X/postgres}`)
--    zustavaji beze zmeny.
--
-- ⚠️ NASLEDEK, KTERY MUSI VEDET SEF: okruh tydeniku se zuzi. Merenu 16. 9. 2026
--    odpoledne (tedy uz PO denni vlne newsletteru) vraci `tydenik_prijemci(4)`
--    pred zmenou 72 lidi, po zmene 7. Rozhodujici je podminka "zadny mail dnes"
--    (64 z tech 72 uz dnes mail dostalo). V pondeli rano, kdy tydenik doopravdy
--    jede (`5 6-16 * * 1`) a newsletter jeste nebezel (`40 8-14 * * *`), bude
--    odriznutych vyrazne min. Cislo 7 tedy NENI pondelni odhad.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) PUBLIKUM TYDENIKU: pet vyluk navic, sjednoceno s `newsletter_prijemci`
-- ---------------------------------------------------------------------------
-- proacl v dobe otisku: {postgres=X/postgres,service_role=X/postgres}
create or replace function public.tydenik_prijemci(p_cislo integer)
returns table (lead_id uuid, email text, track text, step integer, next_send_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select l.id, l.email, l.track, l.step, l.next_send_at
  from public.leads l
  where l.status = 'active'
    -- ⭐ [16. 9. 2026] Souhlas. Tydenik je obchodni sdeleni stejne jako newsletter,
    --    takze musi stat na tomtez souhlasu.
    and l.consent
    -- ⭐ [16. 9. 2026] Kdo ma naplanovany mail do 24 h, se NEPUJCUJE (pravidlo
    --    z 2. 9. 2026). Treti vetev na znacku `_konzultace_ceka`: tem je
    --    `next_send_at` posunuty jen kvuli odkladu prodejni trate, zadny mail
    --    jim doopravdy nemiri. Znacku pise a maze `drip-send`.
    and (l.next_send_at is null or l.next_send_at > now() + interval '24 hours'
         or coalesce(l.vars->>'_konzultace_ceka', '') <> '')
    -- ⛔ [6. 9. 2026] Kdo se sám odhlásil, je v `odhlaseni_trvale` a nesmí se vrátit
    --    ani novým importem. Řádek v `leads` už nemusí existovat.
    and not exists (select 1 from public.odhlaseni_trvale o where o.email = lower(l.email))
    -- ⛔ [16. 9. 2026] Rodina ma trvaly free a NEMAILUJE se ji; Martinovy testovaci
    --    adresy `fitness.barna+*` nafukovaly cisla tydeniku. Newsletter je vylucuje
    --    od zacatku, tydenik ne: rodina dostala 8 tydeniku (posledni 24. 8.).
    and lower(l.email) not in ('ivanabarnova@seznam.cz','barnamaro@gmail.com','barnaxxx@seznam.cz')
    and lower(l.email) not like 'fitness.barna%'
    and l.track not like 'blast%'
    and l.track not like 'rozlouceni-%'
    and l.track <> 'tydenik'
    -- ⛔ [16. 9. 2026] Kdo je PRAVE pujceny newsletteru, se nesmi pujcit podruhe:
    --    snimek tydeniku by ulozil `blog-newsletter` jako "domovskou" trat a vraceni
    --    by ho tam zaparkovalo natrvalo (14. 9. 2026, lead 7d4762b5-…).
    and l.track <> 'blog-newsletter'
    and not exists (select 1 from public.email_events e
                     where e.lead_id = l.id and e.type in ('bounce','complaint'))
    and not exists (select 1 from public.email_events e          -- IDEMPOTENCE
                     where e.lead_id = l.id and e.type = 'sent'
                       and e.step = p_cislo and e.detail->>'track' = 'tydenik')
    and not exists (select 1 from public.withdrawals w           -- odstoupeni od smlouvy za 180 dni
                     where lower(w.email) = lower(l.email)
                       and w.created_at > now() - interval '180 days')
    and not exists (select 1 from public.tydenik_odeslani m      -- uz je ve vlne a ceka na vraceni
                     where m.cislo = p_cislo and m.lead_id = l.id and m.vraceno_at is null)
    -- ⭐ [16. 9. 2026] Jeden mail na cloveka a den (Europe/Prague). Bez teho pravidla
    --    poslal tydenik 149 lidem za 30 dni druhy mail tyz den, z toho 133 najednou.
    and not exists (select 1 from public.email_events e
                     where e.lead_id = l.id and e.type in ('sent','oneoff')
                       and (e.created_at at time zone 'Europe/Prague')::date
                         = (now() at time zone 'Europe/Prague')::date)
$function$;

-- ---------------------------------------------------------------------------
-- 2) SNIMEK SE NESMI UDELAT NAD PUJCENYM STAVEM (obe rozesilky)
-- ---------------------------------------------------------------------------
-- ⛔ Filtr v `*_prijemci` sam nestaci. `*_prijemci` se diva na `leads.track`, ale
--    okno, ve kterem je clovek pujceny, je sirsi: drip-send po odeslani zhasne
--    `next_send_at` a lead uz vypada normalne, prestoze jeho nevraceny radek
--    v druhem `*_odeslani` porad drzi jedinou kopii jeho domovske trate.
--    Jediny bezpecny test je "existuje v te druhe tabulce radek s `vraceno_at is null`".
--    Je to pojistka NA MISTE ZAPISU, tedy tam, kde vznika skoda.

create or replace function public.tydenik_rozeslani(p_cislo integer, p_test boolean default true, p_limit integer default 120, p_jen_email text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_url    text := 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/drip-send';
  v_secret text;
  v_go     text;
  v_pocet  int := 0;
  v_req    bigint;
begin
  if not exists (select 1 from public.email_templates where track = 'tydenik' and step = p_cislo) then
    return jsonb_build_object('ok', false, 'duvod', 'sablona_neexistuje', 'cislo', p_cislo);
  end if;

  select value into v_secret from public.app_config where key = 'drip_invoke_secret';
  if coalesce(v_secret, '') = '' then
    return jsonb_build_object('ok', false, 'duvod', 'chybi_drip_invoke_secret');
  end if;

  if p_test then
    select net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-drip-secret', v_secret),
      body := jsonb_build_object('test_email', coalesce(p_jen_email, 'fitness.barna@gmail.com'),
                                 'track', 'tydenik', 'step', p_cislo,
                                 'segment', 'other', 'name', ''),
      timeout_milliseconds := 60000
    ) into v_req;
    return jsonb_build_object('ok', true, 'mode', 'test', 'cislo', p_cislo, 'request_id', v_req);
  end if;

  select value into v_go from public.app_config where key = 'tydenik_go_' || p_cislo::text;
  if coalesce(v_go, '') <> 'ano' then
    return jsonb_build_object('ok', false, 'duvod', 'chybi_go',
                              'klic', 'tydenik_go_' || p_cislo::text, 'cislo', p_cislo);
  end if;

  if not public.followups_gate_open() then
    return jsonb_build_object('ok', false, 'duvod', 'zavrena_brana_followups', 'cislo', p_cislo);
  end if;

  with vyber as (
    select p.lead_id from public.tydenik_prijemci(p_cislo) p
    where (p_jen_email is null or lower(p.email) = lower(p_jen_email))
      -- ⛔ [16. 9. 2026] Nesnimkovat pujceny stav: kdo ma v `newsletter_odeslani`
      --    nevraceny radek, je prave na cizi trati a jeho domovska trat existuje
      --    UZ JEN v tom snimku. Prepsat ho tady znamena smazat ji natrvalo.
      and not exists (select 1 from public.newsletter_odeslani m
                       where m.lead_id = p.lead_id and m.vraceno_at is null)
    order by p.lead_id
    limit greatest(1, p_limit)
  ),
  snimek as (
    insert into public.tydenik_odeslani
      (cislo, lead_id, email, puvodni_track, puvodni_step, puvodni_next_send_at, puvodni_status)
    select p_cislo, l.id, l.email, l.track, l.step, l.next_send_at, l.status
    from public.leads l join vyber v on v.lead_id = l.id
    on conflict (cislo, lead_id) do update
      set puvodni_track = excluded.puvodni_track,
          puvodni_step = excluded.puvodni_step,
          puvodni_next_send_at = excluded.puvodni_next_send_at,
          puvodni_status = excluded.puvodni_status,
          prepnuto_at = now(), vraceno_at = null,
          vraceny_next_send_at = null, vraceno_bez_mailu = false
    returning lead_id
  )
  update public.leads l
     set track = 'tydenik', step = p_cislo, next_send_at = now(), updated_at = now()
    from snimek s
   where l.id = s.lead_id;
  get diagnostics v_pocet = row_count;

  if v_pocet = 0 then
    return jsonb_build_object('ok', true, 'mode', 'live', 'cislo', p_cislo,
                              'prepnuto', 0, 'duvod', 'nikdo_nezbyva');
  end if;

  -- ⛔ Pri testu na jednom leadu se posila pres `only_email`, takze davka fyzicky nemuze
  --    sahnout na nikoho jineho, i kdyby byl ve fronte splatny.
  select net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-drip-secret', v_secret),
    body := case when p_jen_email is null
                 then jsonb_build_object('limit', v_pocet + 80)
                 else jsonb_build_object('only_email', lower(p_jen_email)) end,
    timeout_milliseconds := 60000
  ) into v_req;

  insert into public.email_events (lead_id, step, type, detail)
  values (null, p_cislo, 'tydenik_vlna',
          jsonb_build_object('track', 'tydenik', 'cislo', p_cislo,
                             'prepnuto', v_pocet, 'request_id', v_req,
                             'jen_email', p_jen_email));

  return jsonb_build_object('ok', true, 'mode', 'live', 'cislo', p_cislo,
                            'prepnuto', v_pocet, 'request_id', v_req);
end;
$function$;

create or replace function public.newsletter_rozeslani(p_step integer, p_test boolean default true, p_limit integer default 120, p_jen_email text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_url    text := 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/drip-send';
  v_secret text; v_go boolean; v_pocet int := 0; v_req bigint;
begin
  if not exists (select 1 from public.email_templates where track = 'blog-newsletter' and step = p_step) then
    return jsonb_build_object('ok', false, 'duvod', 'sablona_neexistuje', 'step', p_step);
  end if;

  select value into v_secret from public.app_config where key = 'drip_invoke_secret';
  if coalesce(v_secret, '') = '' then
    return jsonb_build_object('ok', false, 'duvod', 'chybi_drip_invoke_secret');
  end if;

  -- Test posila jen na Martinovu adresu a NIKAM jinam; parametr slouzi k tomu,
  -- aby se nedal omylem podstrcit cizi prijemce (past z tydenik_rozeslani,
  -- kde vetev p_test obchazela brany a byla otevreny mail relay).
  if p_test then
    select net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type','application/json','x-drip-secret', v_secret),
      body := jsonb_build_object('test_email', 'fitness.barna@gmail.com',
                                 'track','blog-newsletter','step', p_step,
                                 'segment','other','name',''),
      timeout_milliseconds := 60000) into v_req;
    return jsonb_build_object('ok', true, 'mode', 'test', 'step', p_step, 'request_id', v_req);
  end if;

  select f.go into v_go from public.newsletter_fronta f where f.step = p_step;
  if coalesce(v_go, false) is not true then
    return jsonb_build_object('ok', false, 'duvod', 'chybi_go_ve_fronte', 'step', p_step);
  end if;
  if not public.followups_gate_open() then
    return jsonb_build_object('ok', false, 'duvod', 'zavrena_brana_followups', 'step', p_step);
  end if;

  with vyber as (
    select p.lead_id from public.newsletter_prijemci(p_step) p
    where (p_jen_email is null or lower(p.email) = lower(p_jen_email))
      -- ⛔ [16. 9. 2026] Druha strana teze pojistky jako v `tydenik_rozeslani`.
      --    Dnes to `newsletter_prijemci` chyti filtrem `track <> 'tydenik'`, ale
      --    jen kdyz je clovek na tydeniku PRAVE TED; po odeslani mu drip zhasne
      --    `next_send_at` a track uz nic nerika. Nevraceny radek ano.
      and not exists (select 1 from public.tydenik_odeslani m
                       where m.lead_id = p.lead_id and m.vraceno_at is null)
    order by p.lead_id limit greatest(1, p_limit)
  ),
  snimek as (
    insert into public.newsletter_odeslani
      (step, lead_id, email, puvodni_track, puvodni_step, puvodni_next_send_at, puvodni_status)
    select p_step, l.id, l.email, l.track, l.step, l.next_send_at, l.status
    from public.leads l join vyber v on v.lead_id = l.id
    on conflict (step, lead_id) do update
      set puvodni_track = excluded.puvodni_track, puvodni_step = excluded.puvodni_step,
          puvodni_next_send_at = excluded.puvodni_next_send_at,
          puvodni_status = excluded.puvodni_status,
          prepnuto_at = now(), vraceno_at = null,
          vraceny_next_send_at = null, vraceno_bez_mailu = false
    returning lead_id
  )
  update public.leads l
     set track = 'blog-newsletter', step = p_step, next_send_at = now(), updated_at = now()
    from snimek s where l.id = s.lead_id;
  get diagnostics v_pocet = row_count;

  if v_pocet = 0 then
    return jsonb_build_object('ok', true, 'mode','live','step', p_step, 'prepnuto', 0, 'duvod','nikdo_nezbyva');
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type','application/json','x-drip-secret', v_secret),
    body := case when p_jen_email is null then jsonb_build_object('limit', v_pocet + 80)
                 else jsonb_build_object('only_email', lower(p_jen_email)) end,
    timeout_milliseconds := 60000) into v_req;

  insert into public.email_events (lead_id, step, type, detail)
  values (null, p_step, 'newsletter_vlna',
          jsonb_build_object('track','blog-newsletter','step', p_step,
                             'prepnuto', v_pocet, 'request_id', v_req, 'jen_email', p_jen_email));

  update public.newsletter_fronta f
     set prepnuto = f.prepnuto + v_pocet, odeslano_at = coalesce(f.odeslano_at, now())
   where f.step = p_step;

  return jsonb_build_object('ok', true, 'mode','live','step', p_step, 'prepnuto', v_pocet, 'request_id', v_req);
end $function$;

commit;

-- ---------------------------------------------------------------------------
-- OVERENI PO NASAZENI (jen cteni)
-- ---------------------------------------------------------------------------
-- 1) Publikum se zuzilo a nikdo z nej nema dnes mail:
--      select count(*) from public.tydenik_prijemci(4);
-- 2) Rodina a Martinovy testy jsou venku:
--      select count(*) from public.tydenik_prijemci(4)
--       where lower(email) like 'fitness.barna%'
--          or lower(email) in ('ivanabarnova@seznam.cz','barnamaro@gmail.com','barnaxxx@seznam.cz');
--      -- ceka se 0
-- 3) Signatury se nezdvojily:
--      select p.oid::regprocedure, p.proacl from pg_proc p join pg_namespace n
--        on n.oid = p.pronamespace where n.nspname='public'
--       and p.proname in ('tydenik_prijemci','tydenik_rozeslani','newsletter_rozeslani');
--      -- ceka se 3 radky, proacl {postgres=X/postgres,service_role=X/postgres}
