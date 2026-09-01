-- page_views: sloupec `site` (ze kterého webu ping přišel)
-- Navazuje na page-views.sql, spouští se AŽ PO něm. Idempotentní, jde pustit opakovaně.
-- Spustit v SQL editoru projektu uhmrpfsdcujbhbtumqye.
--
-- PROČ: do teď měřila tabulka jen martinbarna.cz. Landing appky tvujcoach.cz se neměřil
-- vůbec, takže o návštěvnosti hlavní prodejní stránky nevíme nic. Místo druhé tabulky
-- a druhé funkce se do stejné tabulky přidá sloupec, kdo ping poslal.
--
-- ⛔ DEFAULT 'martinbarna.cz' JE ZÁMĚR, NE LENOST: všechny existující řádky pocházejí
--    z martinbarna.cz (edge funkce jiný web dosud nepustila přes kontrolu Origin),
--    takže dosazení téhle hodnoty je pravdivé a historie zůstane v číslech webu.
--    Kdyby byl default prázdný nebo NULL, souhrn níž by staré řádky ztratil a čísla
--    v admin panelu by ze dne na den spadla.
--
-- ⛔ Hodnotu plní SERVER (edge funkce page-view z hlaviček Origin/Referer), ne prohlížeč.

alter table public.page_views
  add column if not exists site text not null default 'martinbarna.cz';

-- ============================================================================
-- SOUHRN PRO ADMIN PANEL MB.cz: filtruje `site = 'martinbarna.cz'`.
--
-- ⛔ PROČ FILTR A NE NOVÝ PARAMETR: `create or replace function` s JINOU signaturou
--    v Postgresu nic nenahradí, vyrobí DRUHOU funkci. Kdyby tu vznikla varianta
--    admin_page_views_summary(integer, text), volání s jedním pojmenovaným argumentem
--    z edge funkce by se stalo nejednoznačným a souhrn by v admin panelu spadl.
--    Proto zůstává jediná signatura (p_days integer) a web se filtruje natvrdo.
--    Až bude potřeba souhrn i pro tvujcoach.cz, přidá se funkce s VLASTNÍM jménem.
--
-- ⚠️ Zbytek těla je shodný s page-views.sql, mění se jediný řádek ve `filtered`.
--    Čísla webu tedy musí po migraci vyjít stejně jako před ní.
-- ============================================================================
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
      and pv.site = 'martinbarna.cz'
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

-- Kontrola po spuštění (musí vrátit jedinou variantu funkce):
--   select oid::regprocedure from pg_proc where proname = 'admin_page_views_summary';
-- Kolik pingů kterého webu za poslední den:
--   select site, count(*) from public.page_views
--    where created_at > now() - interval '1 day' group by site;
