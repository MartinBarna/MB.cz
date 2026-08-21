-- page_views: cookieless měření návštěv martinbarna.cz
-- Zápis jen přes edge funkci page-view (service_role). Žádná IP, cookie, e-mail, jméno.
-- Spustit v SQL editoru projektu uhmrpfsdcujbhbtumqye (nebo supabase db push).
-- Stejný obsah jako supabase/migrations/20260821120000_page_views.sql
-- (ta složka je v gitu ignorovaná, proto je kopie tady).

create table if not exists public.page_views (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  path         text not null,
  referrer     text,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  device       text,
  country      text,
  session_hash text,
  constraint page_views_device_chk
    check (device is null or device in ('mobile', 'desktop', 'tablet'))
);

create index if not exists page_views_created_at_idx on public.page_views (created_at);
create index if not exists page_views_path_idx on public.page_views (path);

alter table public.page_views enable row level security;
-- žádná policy pro anon/authenticated → čte/píše jen service_role uvnitř edge funkce

-- Souhrn pro admin (agregace v SQL, ať se nepřeleze 1000řádkový strop PostgREST).
-- EXECUTE jen service_role: volá ji page-view po ověření admin JWT.
create or replace function public.admin_page_views_summary(p_days integer)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select greatest(1, least(coalesce(p_days, 7), 90)) as days
  ),
  filtered as (
    select
      pv.path,
      pv.utm_source,
      pv.device,
      pv.session_hash,
      (pv.created_at at time zone 'Europe/Prague')::date as day
    from public.page_views pv, bounds b
    where pv.created_at >= ((now() at time zone 'Europe/Prague')::date - (b.days - 1))
                         ::timestamp at time zone 'Europe/Prague'
  ),
  days_range as (
    select generate_series(
      (select (now() at time zone 'Europe/Prague')::date - (days - 1) from bounds),
      (select (now() at time zone 'Europe/Prague')::date from bounds),
      interval '1 day'
    )::date as day
  )
  select jsonb_build_object(
    'visits', (select count(*)::int from filtered),
    'sessions', (
      select count(distinct session_hash)::int
      from filtered
      where session_hash is not null and session_hash <> ''
    ),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object('path', path, 'n', n) order by n desc)
      from (
        select path, count(*)::int as n
        from filtered
        group by path
        order by count(*) desc
        limit 10
      ) t
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
      from (
        select coalesce(nullif(utm_source, ''), '(přímá)') as k, count(*)::int as n
        from filtered
        group by 1
        order by count(*) desc
        limit 12
      ) t
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
      from (
        select coalesce(device, 'neznámé') as k, count(*)::int as n
        from filtered
        group by 1
        order by count(*) desc
      ) t
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'n', coalesce(c.n, 0)) order by d.day)
      from days_range d
      left join (
        select day, count(*)::int as n from filtered group by day
      ) c on c.day = d.day
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.admin_page_views_summary(integer) from public, anon, authenticated;
grant execute on function public.admin_page_views_summary(integer) to service_role;

-- ============================================================================
-- RETENCE: starší než 180 dní se maže samo.
--
-- ⛔ PROČ TO TU MUSÍ BÝT. Endpoint `page-view` je ZÁMĚRNĚ veřejný (`verify_jwt=false`),
--    protože ho volá web nepřihlášeného návštěvníka. Kontrola `Origin`/`Referer` odfiltruje
--    omyly, ale **nikoli útok**: obě hlavičky si skript nastaví, jak chce. Kdo tu adresu
--    najde, může do tabulky sypat řádky. Škoda není únik (nic osobního tam není), ale
--    nafouknutá databáze a znehodnocená čísla.
-- ⇒ Retence je STROP, ne ochrana. Kdyby čísla začala vypadat nesmyslně, první podezřelý
--    je tohle, ne chyba měření. Kontrola: `select count(*) from page_views where created_at > now() - interval '1 day'`.
-- ⚠️ 180 dní stačí na meziměsíční srovnání. Srovnání proti loňsku možné NENÍ a je to
--    vědomý kompromis; delší okno ať je rozhodnutí, ne tichý růst tabulky.
-- ============================================================================
create or replace function public.page_views_uklid()
returns integer
language sql
security definer
set search_path = public
as $$
  with smazane as (
    delete from public.page_views where created_at < now() - interval '180 days' returning 1
  )
  select count(*)::int from smazane;
$$;

revoke all on function public.page_views_uklid() from public, anon, authenticated;
grant execute on function public.page_views_uklid() to service_role;

-- Úklid jednou denně ve 3:40 UTC. `unschedule` napřed, ať opakované spuštění
-- tohohle souboru nevyrobí druhou úlohu se stejným jménem.
do $$
begin
  perform cron.unschedule('page-views-uklid');
exception when others then
  null; -- úloha ještě neexistuje, to je v pořádku
end $$;

select cron.schedule('page-views-uklid', '40 3 * * *', $$select public.page_views_uklid();$$);
