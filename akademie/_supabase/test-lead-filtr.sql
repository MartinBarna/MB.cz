-- Testovací lead z formuláře (28. 10. 2026).
--
-- ⛔ TENTO SOUBOR NEAPLIKUJ na živou DB z agenta a nenasazuj ho sám.
--    Až s DEPLOY-ZAMEK a POVOLENO od Clauda.
--
-- Podmínka, kterou mají používat počty, exporty, crony a rutiny MIMO repo
-- („Ranní přehled“ a „Pilot odpovědi“ jsou rutiny botů, AUDIT-FUNNEL je Google Doc):
--
--   not public.lead_je_test(email, meta)
--
-- To je meta.test = true (i text 'true'/'t'/'1') NEBO e-mail
-- fitness.barna+tester*@gmail.com (case-insensitive, cokoliv mezi „tester“ a @).
--
-- V TypeScriptu je totéž: akademie/_supabase/functions/_shared/test-lead.ts
-- (jeTestLead / jeTestovaciEmail).

create or replace function public.lead_je_test(p_email text, p_meta jsonb)
returns boolean
language sql
immutable
parallel safe
as $fn$
  select coalesce(
    coalesce(p_meta->>'test', '') in ('true', 't', '1')
    or lower(btrim(coalesce(p_email, ''))) ~ '^fitness\.barna\+tester[^@]*@gmail\.com$',
    false
  );
$fn$;

comment on function public.lead_je_test(text, jsonb) is
  'Testovací lead formuláře: meta.test nebo fitness.barna+tester*@gmail.com. Vyřadit z počtů, exportů a publika. Nezahrnuje všechny plus-adresy.';

revoke all on function public.lead_je_test(text, jsonb) from public, anon, authenticated;
grant execute on function public.lead_je_test(text, jsonb) to postgres, service_role;

-- Pohled pro ruční dotazy a reporty. security_invoker: platí RLS tabulky leads.
create or replace view public.leads_bez_testu
with (security_invoker = true) as
select l.*
  from public.leads l
 where not public.lead_je_test(l.email, l.meta);

comment on view public.leads_bez_testu is
  'leads bez testovacích řádků formuláře (lead_je_test). Pro počty a exporty.';

revoke all on public.leads_bez_testu from public, anon, authenticated;
grant select on public.leads_bez_testu to postgres, service_role;

-- ------------------------------------------------------------
-- Kde podmínku přidat, až se SQL v produkci přepisuje
-- (teď je ve zdrojích tratí už širší `lower(email) not like 'fitness.barna%'`,
--  které +tester chytí; meta.test na jiné adrese ne):
--
--   newsletter_prijemci, tydenik_prijemci:
--     and not public.lead_je_test(l.email, l.meta)
--
--   admin_leads_by_track(): tělo v repu není. Počty v adminu
--   (templates_list) se filtrují v admin-api. Až se funkce bude měnit:
--     where not public.lead_je_test(email, meta)
--
--   crm_refresh_from_academy: součty ve zdroji už funkci volají.
--     Nejdřív tenhle soubor, pak refresh.
--
--   en_mereni_leady (jiná tabulka en_leads, ne české `leads`):
--     and not public.lead_je_test(l.email, null)
--     Níže je celý CREATE OR REPLACE, pořád neaplikovat z agenta.
-- ------------------------------------------------------------

create or replace view public.en_mereni_leady with (security_invoker = true) as
select (date_trunc('week', l.created_at at time zone 'Europe/Prague'))::date as tyden_od,
  l.kind,
  coalesce(nullif(lower(trim(l.utm_source)), ''), '(prazdne)') as utm_source,
  coalesce(nullif(lower(trim(l.utm_medium)), ''), '(prazdne)') as utm_medium,
  coalesce(nullif(lower(trim(l.utm_campaign)), ''), '(prazdne)') as utm_campaign,
  count(*) as pocet
from public.en_leads l
where l.created_at >= timestamptz '2026-10-13 00:00:00+02'
  and coalesce(l.first_name, '') not ilike '%test-claude%'
  and not public.lead_je_test(l.email, null)
group by 1, 2, 3, 4, 5;

revoke all on public.en_mereni_leady from public, anon, authenticated;
grant select on public.en_mereni_leady to service_role;
