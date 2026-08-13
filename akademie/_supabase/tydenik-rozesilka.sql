-- TYDENIK: mechanismus pravidelne pondelni rozesilky (13. 8. 2026)
--
-- PROC VUBEC: cislo 1 (`tydenik`/1) odeslo 4. 8. 2026 na 370 lidi RUCNIM blastem
-- (ulozit stav -> prepnout trat -> invoke -> vratit). Cisla 2 az 4 lezi napsana
-- v `email_templates` a NIKDY neodesla, protoze je nemel co poslat: v `cron.job`
-- nebyl zadny tydenikovy job, v `functions/` zadna funkce, v `.github/workflows/`
-- nic. Nebyla to porucha, byl to CHYBEJICI MECHANISMUS. Tenhle soubor ho doplnuje.
--
-- JAK TO FUNGUJE (a proc zrovna takhle):
-- Trat `tydenik` NENI drip, je to BROADCAST. Vsechny sablony maji `wait_days = null`,
-- tedy "posledni mail trati", takze se sama nikdy neposune. Jedno cislo = jedna vlna,
-- ktera lidem docasne prepise `leads.track` na 'tydenik' a `step` na cislo vydani.
-- Engine `drip-send` to posle jako kterykoli jiny mail a pak jim zhasne `next_send_at`.
-- Vlna se proto MUSI vratit zpatky na domovskou trat, jinak clovek prijde o svuj drip.
--
-- ⛔ CTYRI VECI, KTERE TENHLE NAVRH RIDI (kazda uz jednou nekoho stala praci):
--  1. SNIMEK SE BERE V TETZE JEDNE VETE JAKO PREPNUTI. Kdyby se bral driv, obnova
--     by cloveku vratila uz spotrebovany termin, tedy mail podruhe behem par minut.
--  2. PREPINA SE JEN TOLIK LIDI, KOLIK JEDEN BEH ENGINU STIHNE ODESLAT (~120).
--     `drip-send` ma `drip_run_deadline_ms` (100 s) a `drip_send_gap_ms` (600 ms),
--     takze jedna davka je ~166 mailu. Kdybychom prepnuli vsech 814 najednou, ~650 lidi
--     by hodiny lezelo na cizi trati bez naplanovaneho mailu. Takhle je clovek mimo
--     domovskou trat radove minuty.
--  3. IDEMPOTENCE NENI PRIDANA POJISTKA, JE TO TVAR DOTAZU. `tydenik_prijemci`
--     vylucuje kazdeho, kdo uz ma v `email_events` `sent` pro (step = cislo,
--     detail->>track = 'tydenik'). Druhe spusteni tedy vybere 0 lidi. Navic drzi
--     unikatni index `email_events_lead_step_track_sent_uniq`.
--  4. HODINA 7 UTC JE ZAMERNE VYNECHANA Z ODESILANI. V 7:10 a 7:20 bezi
--     `enroll_into_upsell_academy` a `enroll_into_upsell_coaching`. Obe vylucuji lidi
--     podminkou `next_send_at IS NOT NULL AND track NOT LIKE 'upsell-%'`, takze
--     cloveka, ktery prave ceka na vraceni (a ma `next_send_at = null`), NEVYLOUCI
--     a odsaly by ho do upsell trate natrvalo. Zmereno 13. 8.: dnes by se to tykalo
--     5 lidi. Vlna v 6:05 se proto vraci uz v 7:05, tedy 5 minut pred prvnim enrollem,
--     a v hodine 7 se zadna nova vlna nespousti.
--
-- NASAZENI: aplikovano do `uhmrpfsdcujbhbtumqye` 13. 8. 2026.
-- ⛔ Bez klice `app_config.tydenik_go_<cislo>` = 'ano' se NEODESLE NIC.

-- ---------------------------------------------------------------------------
-- 1) SNIMKOVA TABULKA
-- ---------------------------------------------------------------------------
-- Jedna trvala tabulka pro vsechna cisla (ne tabulka na cislo jako u `blast_mapping_*`),
-- aby funkce nemusela delat DDL za behu a aby sla historie cist jednim dotazem.
create table if not exists public.tydenik_odeslani (
  cislo                 int  not null,
  lead_id               uuid not null,
  email                 text not null,
  puvodni_track         text not null,
  puvodni_step          int  not null,
  puvodni_next_send_at  timestamptz,
  puvodni_status        text not null,
  prepnuto_at           timestamptz not null default now(),
  vraceno_at            timestamptz,
  vraceny_next_send_at  timestamptz,
  vraceno_bez_mailu     boolean not null default false,
  primary key (cislo, lead_id)
);

comment on table public.tydenik_odeslani is
  'Snimek domovske trate pred prepnutim do tydeniku. Radek s vraceno_at IS NULL = clovek je PRAVE mimo svou trat.';

-- ---------------------------------------------------------------------------
-- 2) PUBLIKUM (jediny zdroj pravdy pro dry-run i pro ostrou vlnu)
-- ---------------------------------------------------------------------------
-- ⭐ Zamerne funkce, ne opsany dotaz na dvou mistech: dry-run musi merit PRESNE to,
-- co pak odejde. Dva opisy dotazu se rozejdou a dry-run zacne lhat.
create or replace function public.tydenik_prijemci(p_cislo int)
returns table (lead_id uuid, email text, track text, step int, next_send_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select l.id, l.email, l.track, l.step, l.next_send_at
  from public.leads l
  where l.status = 'active'                       -- fronta enginu bere jen tyhle; unsubscribed/bounced/paused/purchased tim padaji sami
    and l.track not like 'blast%'                 -- rucni blasty maji vlastni restore mechaniku, nezavodit s ni
    and l.track not like 'rozlouceni-%'           -- po refundu se nemarketuje
    and l.track <> 'tydenik'                      -- kdo uz je prepnuty, nesmi se prepnout znovu
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
$fn$;

-- ---------------------------------------------------------------------------
-- 3) VRACENI NA DOMOVSKOU TRAT
-- ---------------------------------------------------------------------------
-- Pravidlo terminu: "dnes splatne +1 den, min. odstup 12 h".
-- Vysledek je z konstrukce bud NULL, nebo >= now() + 12 h, takze mezi tydenikem
-- (odeslanym pred timhle behem) a dalsim dripem nemuze byt mensi odstup nez 12 hodin.
--
-- p_force = vrat i toho, komu se tydenik NEPODARILO poslat. Pouziva se az po skonceni
-- odesilaciho okna: nikdo nesmi zustat lezet na cizi trati pres noc.
create or replace function public.tydenik_vraceni(p_cislo int, p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
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
     -- ⛔ Podminka `l.track = 'tydenik'` je nosna: kdyby cloveka mezitim prevzal jiny
     --    mechanismus (order-rescue, milestones), jeho novy stav je aktualnejsi nez nas
     --    snimek a prepsat ho zpatky by byla skoda. Rozdil se vraci jako `prevzato_jinym`.
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
$fn$;

-- ---------------------------------------------------------------------------
-- 4) ROZESLANI JEDNE VLNY (nebo testu Martinovi)
-- ---------------------------------------------------------------------------
-- ⛔ `p_test` ma default TRUE zamerne: hola `select tydenik_rozeslani(2)` nesmi
--    nikdy poslat mail 800 lidem. Ostra vlna se musi vyzadat vyslovne.
-- ⛔ Kdo bude menit signaturu, musi funkci nejdriv DROPNOUT. `create or replace`
--    s jinym poctem parametru vyrobi DRUHOU funkci vedle a `tydenik_cron` by pak
--    volal nejednoznacne. (Pravidlo 8 v CLAUDE.md, past `create or replace`.)
--    drop function if exists public.tydenik_rozeslani(int, boolean, int, text);
create or replace function public.tydenik_rozeslani(
  p_cislo     int,
  p_test      boolean default true,
  p_limit     int default 120,
  p_jen_email text default null      -- jen pro overeni cele mechaniky na testovacim leadu
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
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

  -- TEST: jde vyhradne na Martinuv mail, zadny lead se nedotkne, engine prilepi [TEST].
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

  -- ⛔ BRANA GO: bez vyslovneho souhlasu se neodesila. Fail-safe je NEPOSLAT.
  select value into v_go from public.app_config where key = 'tydenik_go_' || p_cislo::text;
  if coalesce(v_go, '') <> 'ano' then
    return jsonb_build_object('ok', false, 'duvod', 'chybi_go',
                              'klic', 'tydenik_go_' || p_cislo::text, 'cislo', p_cislo);
  end if;

  -- ⛔ BRANA FOLLOW-UPU: `tydenik` je non-onboarding track, takze pri zavrenem jistici
  --    by ho `drip-send` NEPOSLAL a prepnuti lidi by byla cista skoda.
  if not public.followups_gate_open() then
    return jsonb_build_object('ok', false, 'duvod', 'zavrena_brana_followups', 'cislo', p_cislo);
  end if;

  -- ⭐ SNIMEK A PREPNUTI V JEDNE VETE = jeden snapshot, zadne okno mezi ctenim a zapisem.
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

  -- `limit` schvalne vyssi nez vlna: v teze davce projde i bezny drip, ktery je splatny.
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
$fn$;

-- ---------------------------------------------------------------------------
-- 5) VSTUPNI BOD PRO CRON
-- ---------------------------------------------------------------------------
-- Pondelni beh: kazda hodina nejdriv VRATI hotove z minule vlny, pak posle dalsi vlnu.
-- Hodina 7 UTC vlnu nespousti (viz bod 4 v hlavicce), od hodiny 15 se uz jen uklizi.
-- Kapacita: 8 vln (6, 8 az 14 UTC) po 120 lidech = 960, publikum je dnes 809.
create or replace function public.tydenik_cron()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_cislo     int;
  v_hod       int := extract(hour from (now() at time zone 'UTC'))::int;
  v_limit     int;
  v_force     boolean;
  v_vraceni   jsonb;
  v_rozeslani jsonb := null;
  v_zbyva     int;
  v_go        text;
begin
  select nullif(value, '')::int into v_cislo from public.app_config where key = 'tydenik_cislo';
  if v_cislo is null then
    return jsonb_build_object('ok', false, 'duvod', 'chybi_app_config_tydenik_cislo');
  end if;

  v_force := v_hod >= 15;                 -- po skonceni okna uz nikdo nesmi zustat na cizi trati
  v_vraceni := public.tydenik_vraceni(v_cislo, v_force);

  if v_hod in (6, 8, 9, 10, 11, 12, 13, 14) then
    select coalesce(nullif(value, '')::int, 120) into v_limit
      from public.app_config where key = 'tydenik_vlna_limit';
    v_rozeslani := public.tydenik_rozeslani(v_cislo, false, coalesce(v_limit, 120));
  end if;

  -- Skip se loguje JEDNOU za den, ne pri kazdem z deseti behu.
  select value into v_go from public.app_config where key = 'tydenik_go_' || v_cislo::text;
  if coalesce(v_go, '') <> 'ano'
     and not exists (select 1 from public.email_events
                      where type = 'tydenik_skip' and created_at >= date_trunc('day', now())) then
    insert into public.email_events (lead_id, step, type, detail)
    values (null, v_cislo, 'tydenik_skip',
            jsonb_build_object('track', 'tydenik', 'cislo', v_cislo,
                               'duvod', 'chybi klic app_config tydenik_go_' || v_cislo::text));
  end if;

  select count(*) into v_zbyva from public.tydenik_prijemci(v_cislo);
  return jsonb_build_object('cislo', v_cislo, 'hodina_utc', v_hod,
                            'vraceni', v_vraceni, 'rozeslani', v_rozeslani,
                            'zbyva_prijemcu', v_zbyva);
end;
$fn$;

-- Nedelni [TEST] Martinovi: bere cislo z app_config, at se cron nemusi kazdy tyden prepisovat.
create or replace function public.tydenik_cron_test()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare v_cislo int;
begin
  select nullif(value, '')::int into v_cislo from public.app_config where key = 'tydenik_cislo';
  if v_cislo is null then
    return jsonb_build_object('ok', false, 'duvod', 'chybi_app_config_tydenik_cislo');
  end if;
  return public.tydenik_rozeslani(v_cislo, true);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 6) CRONY
-- ---------------------------------------------------------------------------
-- NE 15:00 UTC = 17:00 letniho casu: [TEST] cisla Martinovi.
-- PO 6:05 az 15:05 UTC = 8:05 az 17:05 letniho casu: vlny + vraceni.
-- ⚠️ V zimnim case (od konce rijna) je to o hodinu driv, tedy 16:00 a 7:05 lokalne.
--    pg_cron umi jen UTC; kdyby to Martinovi vadilo, je to zmena jedne hodnoty.
-- NASAZENO 13. 8. 2026 jako jobid 24 a 25:
--   select cron.schedule('tydenik-test-nedele', '0 15 * * 0', $c$select public.tydenik_cron_test();$c$);
--   select cron.schedule('tydenik-pondeli',     '5 6-16 * * 1', $c$select public.tydenik_cron();$c$);
--
-- ⛔ KLICE V app_config (nasazeno 13. 8.): `tydenik_cislo` = '2', `tydenik_vlna_limit` = '120'.
--    `tydenik_go_2` ZAMERNE NEEXISTUJE. Bez nej se v pondeli neodesle nic a zaloguje se
--    jeden radek `tydenik_skip`. Spusteni ostre rozesilky = jeden prikaz:
--      insert into public.app_config (key, value, updated_at) values ('tydenik_go_2','ano',now())
--      on conflict (key) do update set value = excluded.value, updated_at = now();

-- ---------------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------------
-- select cron.unschedule('tydenik-test-nedele');
-- select cron.unschedule('tydenik-pondeli');
-- drop function if exists public.tydenik_cron_test();
-- drop function if exists public.tydenik_cron();
-- drop function if exists public.tydenik_rozeslani(int, boolean, int);
-- drop function if exists public.tydenik_vraceni(int, boolean);
-- drop function if exists public.tydenik_prijemci(int);
-- -- tabulku `tydenik_odeslani` NEMAZAT, je to jedina evidence, komu co odeslo.
-- delete from public.app_config where key in ('tydenik_cislo','tydenik_vlna_limit')
--    or key like 'tydenik_go_%';
