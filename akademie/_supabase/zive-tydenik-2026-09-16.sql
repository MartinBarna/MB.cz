-- ZACHRANA ZIVEHO ZNENI ROZESILKOVYCH FUNKCI (16. 9. 2026, 73. sef, stavec Academy)
-- Porizeno doslovne z produkcni DB Academy (uhmrpfsdcujbhbtumqye):
--   select p.oid::regprocedure, p.proacl, pg_get_functiondef(p.oid)
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('tydenik_prijemci','tydenik_rozeslani','tydenik_vraceni',
--                        'newsletter_prijemci','newsletter_rozeslani','newsletter_vraceni');
--
-- ⛔ PRAVIDLO 8 (CLAUDE.md): kazde jmeno ma v `pg_proc` PRESNE JEDNU variantu signatury
--    (overeno tymtez dotazem), takze `create or replace` neni v migraci tiche zdvojeni.
--
-- ⛔ ZIVE ZNENI JE NOVEJSI NEZ GIT. Rozdily proti `tydenik-rozesilka.sql` v gitu:
--    - `tydenik_prijemci`: ZIVE ma navic `not exists (... odhlaseni_trvale ...)` (6. 9. 2026),
--      v gitu chybi.
--    - `tydenik_rozeslani`: ZIVE ma navic komentar u `net.http_post` o `only_email`.
--    Migrace `tydenik-vyluky-2026-09-16.sql` je psana NAD timhle znenim, ne nad gitem.
--
-- Nic se odsud nenasazuje automaticky; je to referencni bod pro diff a navrat.
-- Granty (proacl) jsou u vsech sesti `{postgres=X/postgres,service_role=X/postgres}`,
-- signatury se migraci NEMENI, takze granty zustavaji.

-- ==== tydenik_prijemci(integer)
-- proacl: {postgres=X/postgres,service_role=X/postgres}
-- prosecdef: true
CREATE OR REPLACE FUNCTION public.tydenik_prijemci(p_cislo integer)
 RETURNS TABLE(lead_id uuid, email text, track text, step integer, next_send_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select l.id, l.email, l.track, l.step, l.next_send_at
  from public.leads l
  where l.status = 'active'
    and l.track not like 'blast%'
    and l.track not like 'rozlouceni-%'
    and l.track <> 'tydenik'
    -- ⛔ [6. 9. 2026] Kdo se sám odhlásil, je v `odhlaseni_trvale` a nesmí se vrátit
    --    ani novým importem. Řádek v `leads` už nemusí existovat.
    and not exists (select 1 from public.odhlaseni_trvale o where o.email = lower(l.email))
    and not exists (select 1 from public.email_events e
                     where e.lead_id = l.id and e.type in ('bounce','complaint'))
    and not exists (select 1 from public.email_events e
                     where e.lead_id = l.id and e.type = 'sent'
                       and e.step = p_cislo and e.detail->>'track' = 'tydenik')
    and not exists (select 1 from public.withdrawals w
                     where lower(w.email) = lower(l.email)
                       and w.created_at > now() - interval '180 days')
    and not exists (select 1 from public.tydenik_odeslani m
                     where m.cislo = p_cislo and m.lead_id = l.id and m.vraceno_at is null)
$function$
;

-- ==== tydenik_rozeslani(integer,boolean,integer,text)
-- proacl: {postgres=X/postgres,service_role=X/postgres}
-- prosecdef: true
CREATE OR REPLACE FUNCTION public.tydenik_rozeslani(p_cislo integer, p_test boolean DEFAULT true, p_limit integer DEFAULT 120, p_jen_email text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    where p_jen_email is null or lower(p.email) = lower(p_jen_email)
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
$function$
;

-- ==== newsletter_prijemci(integer)
-- proacl: {postgres=X/postgres,service_role=X/postgres}
-- prosecdef: true
CREATE OR REPLACE FUNCTION public.newsletter_prijemci(p_step integer)
 RETURNS TABLE(lead_id uuid, email text, track text, step integer, next_send_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select l.id, l.email, l.track, l.step, l.next_send_at
  from public.leads l
  where l.status = 'active'
    and l.consent
    -- SIROKA VARIANTA dle Martinova GO 27. 8. 2026: filtr `next_send_at is null` je ZAMERNE PRYC.
    -- 2. 9. 2026 (23. sef): kdo ma naplanovany mail do 24 h, ten se NEPUJCUJE.
    -- [15. 9. 2026] Tretí vetev: kdo ceka na konzultacni hovor, ma `next_send_at`
    -- posunuty JEN kvuli odkladu prodejni trati, zadny mail mu doopravdy nemiri.
    -- Znacku pise a maze `drip-send` (`_konzultace_ceka` ve `vars`), nic jineho ji nenastavuje.
    and (l.next_send_at is null or l.next_send_at > now() + interval '24 hours'
         or coalesce(l.vars->>'_konzultace_ceka', '') <> '')
    -- ⛔ [6. 9. 2026] Trvalý seznam odhlášených, viz tydenik_prijemci.
    and not exists (select 1 from public.odhlaseni_trvale o where o.email = lower(l.email))
    and lower(l.email) not in ('ivanabarnova@seznam.cz','barnamaro@gmail.com','barnaxxx@seznam.cz')
    and lower(l.email) not like 'fitness.barna%'
    and l.track not like 'blast%'
    and l.track not like 'rozlouceni-%'
    and l.track <> 'tydenik'
    and l.track <> 'blog-newsletter'
    and not exists (select 1 from public.email_events e
                     where e.lead_id = l.id and e.type in ('bounce','complaint'))
    and not exists (select 1 from public.email_events e
                     where e.lead_id = l.id and e.type = 'sent'
                       and e.step = p_step and e.detail->>'track' = 'blog-newsletter')
    and not exists (select 1 from public.withdrawals w
                     where lower(w.email) = lower(l.email)
                       and w.created_at > now() - interval '180 days')
    and not exists (select 1 from public.newsletter_odeslani m
                     where m.step = p_step and m.lead_id = l.id and m.vraceno_at is null)
    and not exists (select 1 from public.email_events e
                     where e.lead_id = l.id and e.type in ('sent','oneoff')
                       and (e.created_at at time zone 'Europe/Prague')::date
                         = (now() at time zone 'Europe/Prague')::date)
$function$
;

-- ==== newsletter_rozeslani(integer,boolean,integer,text)
-- proacl: {postgres=X/postgres,service_role=X/postgres}
-- prosecdef: true
CREATE OR REPLACE FUNCTION public.newsletter_rozeslani(p_step integer, p_test boolean DEFAULT true, p_limit integer DEFAULT 120, p_jen_email text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    where p_jen_email is null or lower(p.email) = lower(p_jen_email)
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
end $function$
;

-- ==== tydenik_vraceni(integer,boolean)
-- proacl: {postgres=X/postgres,service_role=X/postgres}
-- prosecdef: true
CREATE OR REPLACE FUNCTION public.tydenik_vraceni(p_cislo integer, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_out jsonb;
begin
  with kandidati as (
    select m.lead_id, m.puvodni_track, m.puvodni_step, m.puvodni_next_send_at,
           exists (select 1 from public.email_events e
                    where e.lead_id = m.lead_id and e.type = 'sent'
                      and e.step = p_cislo and e.detail->>'track' = 'tydenik') as dostal
    from public.tydenik_odeslani m
    where m.cislo = p_cislo and m.vraceno_at is null
  ),
  vybrani as (
    select k.*,
           case
             when k.puvodni_next_send_at is null then null
             when k.puvodni_next_send_at < now() + interval '12 hours'
               then greatest(k.puvodni_next_send_at + interval '1 day', now() + interval '12 hours')
             else k.puvodni_next_send_at
           end as novy_termin
    from kandidati k
    where k.dostal or p_force
  ),
  upd_leads as (
    update public.leads l
       set track = v.puvodni_track, step = v.puvodni_step,
           next_send_at = v.novy_termin, updated_at = now()
      from vybrani v
     where l.id = v.lead_id and l.track = 'tydenik'
    returning l.id
  ),
  upd_mapa as (
    update public.tydenik_odeslani m
       set vraceno_at = now(), vraceny_next_send_at = v.novy_termin,
           vraceno_bez_mailu = not v.dostal
      from vybrani v
     where m.cislo = p_cislo and m.lead_id = v.lead_id
    returning m.lead_id
  )
  select jsonb_build_object(
    'cislo', p_cislo,
    'force', p_force,
    'vraceno', (select count(*) from upd_leads),
    'uzavreno_v_mape', (select count(*) from upd_mapa),
    'bez_mailu', (select count(*) from vybrani where not dostal),
    'prevzato_jinym', (select count(*) from upd_mapa) - (select count(*) from upd_leads)
  ) into v_out;
  return v_out;
end;
$function$
;

-- ==== newsletter_vraceni(integer,boolean)
-- proacl: {postgres=X/postgres,service_role=X/postgres}
-- prosecdef: true
CREATE OR REPLACE FUNCTION public.newsletter_vraceni(p_step integer, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_out jsonb;
begin
  with kandidati as (
    select m.lead_id, m.puvodni_track, m.puvodni_step, m.puvodni_next_send_at,
           exists (select 1 from public.email_events e
                    where e.lead_id = m.lead_id and e.type = 'sent'
                      and e.step = p_step and e.detail->>'track' = 'blog-newsletter') as dostal
    from public.newsletter_odeslani m
    where m.step = p_step and m.vraceno_at is null
  ),
  vybrani as (
    select k.*,
           case
             when k.puvodni_next_send_at is null then null
             when k.puvodni_next_send_at < now() + interval '12 hours'
               then greatest(k.puvodni_next_send_at + interval '1 day', now() + interval '12 hours')
             else k.puvodni_next_send_at
           end as novy_termin
    from kandidati k
    where k.dostal or p_force
  ),
  upd_leads as (
    update public.leads l
       set track = v.puvodni_track, step = v.puvodni_step,
           next_send_at = v.novy_termin, updated_at = now()
      from vybrani v
     where l.id = v.lead_id and l.track = 'blog-newsletter'
    returning l.id
  ),
  upd_mapa as (
    update public.newsletter_odeslani m
       set vraceno_at = now(), vraceny_next_send_at = v.novy_termin,
           vraceno_bez_mailu = not v.dostal
      from vybrani v
     where m.step = p_step and m.lead_id = v.lead_id
    returning m.lead_id
  )
  select jsonb_build_object(
    'step', p_step, 'force', p_force,
    'vraceno', (select count(*) from upd_leads),
    'uzavreno_v_mape', (select count(*) from upd_mapa),
    'bez_mailu', (select count(*) from vybrani where not dostal),
    'prevzato_jinym', (select count(*) from upd_mapa) - (select count(*) from upd_leads)
  ) into v_out;
  return v_out;
end $function$
;
