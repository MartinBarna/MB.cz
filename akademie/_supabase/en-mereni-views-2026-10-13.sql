-- EN měření pro Elona (13. 10. 2026, Claude). Nasazeno živě migrací en_mereni_views_2026_10_13.
-- Pohledy jen pro čtení: anon/authenticated/public bez práv, select jen service_role a postgres.
-- Elon: select * from public.en_mereni_navstevy order by tyden_od, zobrazeni desc;
--       select * from public.en_mereni_leady order by tyden_od, pocet desc;
-- Detailní dotazy (konverze, top články, X bez UTM): _Claude-dokumenty/2026-10-13_en-klienti/MERENI-EN-SQL.sql
create view public.en_mereni_navstevy with (security_invoker = on) as
select (date_trunc('week', pv.created_at at time zone 'Europe/Prague'))::date as tyden_od,
  coalesce(nullif(lower(trim(pv.utm_source)), ''), '(prazdne)') as utm_source,
  coalesce(nullif(lower(trim(pv.utm_medium)), ''), '(prazdne)') as utm_medium,
  coalesce(nullif(lower(trim(pv.utm_campaign)), ''), '(prazdne)') as utm_campaign,
  case when pv.path in ('/en', '/en/', '/en/index.html') then 'landing'
       when pv.path like '/en/blog/%.html' then 'clanek'
       when pv.path like '/en/blog%' then 'blog_vypis'
       when pv.path like '/en/protein%' then 'protein'
       when pv.path like '/en/calculator%' then 'kalkulacka'
       when pv.path like '/en/workout%' then 'trenink'
       else 'jine' end as typ_stranky,
  count(*) as zobrazeni,
  count(distinct pv.session_hash) as relace
from public.page_views pv
where pv.site = 'martinbarna.cz' and pv.path like '/en/%'
  and pv.created_at >= timestamptz '2026-10-13 00:00:00+02'
group by 1, 2, 3, 4, 5;

create view public.en_mereni_leady with (security_invoker = on) as
select (date_trunc('week', l.created_at at time zone 'Europe/Prague'))::date as tyden_od,
  l.kind,
  coalesce(nullif(lower(trim(l.utm_source)), ''), '(prazdne)') as utm_source,
  coalesce(nullif(lower(trim(l.utm_medium)), ''), '(prazdne)') as utm_medium,
  coalesce(nullif(lower(trim(l.utm_campaign)), ''), '(prazdne)') as utm_campaign,
  count(*) as pocet
from public.en_leads l
where l.created_at >= timestamptz '2026-10-13 00:00:00+02'
  and coalesce(l.first_name, '') not ilike '%test-claude%'
group by 1, 2, 3, 4, 5;

revoke all on public.en_mereni_navstevy, public.en_mereni_leady from public, anon, authenticated;
grant select on public.en_mereni_navstevy, public.en_mereni_leady to service_role;
