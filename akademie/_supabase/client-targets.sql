-- =============================================================================
-- Klientská sekce: CÍLE (zadání od Martina) — 25. 7. 2026
--
-- Proč: v systému dosud neexistoval cíl. `client_reports` drží jen naměřené
-- hodnoty, takže věta klienta „kolik bílkovin jsem ten týden vyšvihl navíc"
-- nebyla spočitatelná, nebylo proti čemu měřit. Tahle tabulka je ta chybějící
-- druhá strana rovnice.
--
-- Kdo co smí:
--   • klient  = čte JEN svůj řádek (stejný vzor jako client_reports_own_read)
--   • Martin  = čte vše (admin policy) a ZAPISUJE přes edge fn `admin-api`
--               pod service_role, takže z prohlížeče nejde zápis vůbec.
-- Cíl je Martinovo odborné rozhodnutí, NIKDY se nedopočítává z TDEE ani z reportů.
--
-- ⛔ CO TU TABULKU SKUTEČNĚ CHRÁNÍ PŘED ZÁPISEM (revize 25. 7. 2026):
-- Je to zapnuté RLS BEZ jakékoli policy pro INSERT/UPDATE/DELETE, nic jiného.
-- NENÍ to `grant select ... to authenticated` níž. Supabase totiž rozdává roli `anon`
-- práva INSERT/UPDATE/DELETE/TRUNCATE na každou novou tabulku ve schématu `public`
-- automaticky (default privileges), takže `anon` je má i tady a grant nic neomezuje.
-- ⚠️ DŮSLEDEK PRO BUDOUCÍHO: kdo sem někdy přidá policy pro zápis (třeba aby šlo něco
-- uložit rovnou z prohlížeče), otevře tabulku dokořán a bude si přitom myslet, že ho
-- grant chrání. Nechrání. Obecné pravidlo: `feedback-supabase-grant-neni-ochrana`.
--
-- ADITIVNÍ: nic nemaže, nic nepřepisuje.
-- =============================================================================

create table if not exists public.client_targets (
  email      text primary key,
  kcal       integer,
  protein    integer,
  kroky      integer,
  sport_min  integer,
  treninky   integer,
  note       text,
  updated_at timestamptz not null default now(),

  -- Meze proti překlepu v adminu (o řád vedle). NULL = cíl nenastaven, to je
  -- legitimní stav a všechna zobrazovací místa ho musí umět (nezobrazit nic).
  constraint client_targets_kcal_rozsah      check (kcal      is null or kcal      between 500 and 8000),
  constraint client_targets_protein_rozsah   check (protein   is null or protein   between 20  and 500),
  constraint client_targets_kroky_rozsah     check (kroky     is null or kroky     between 0   and 60000),
  constraint client_targets_sport_rozsah     check (sport_min is null or sport_min between 0   and 3000),
  constraint client_targets_treninky_rozsah  check (treninky  is null or treninky  between 0   and 14)
);

comment on table public.client_targets is
  'Týdenní zadání od Martina pro koučinkového klienta. Vyplňuje Martin v adminu, klient jen čte. Nepočítat automaticky.';

alter table public.client_targets enable row level security;

-- Klient vidí jen svůj řádek (e-mail z JWT, case-insensitive — shodné s client_reports).
drop policy if exists client_targets_own_read on public.client_targets;
create policy client_targets_own_read on public.client_targets
  for select
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Martin vidí všechny (na přehled kouče). Zápis tudy NEJDE, jen přes service_role.
drop policy if exists client_targets_select_admin on public.client_targets;
create policy client_targets_select_admin on public.client_targets
  for select
  to authenticated
  using ((select auth.jwt()) ->> 'email' = any (array['martin@martinbarna.cz', 'fitness.barna@gmail.com']));

grant select on public.client_targets to authenticated;

-- =============================================================================
-- SNÍMEK CÍLE V REPORTU (revize 25. 7. 2026, druhá tichá vada)
--
-- Problém: `client_targets` je JEDEN řádek na klienta, ne záznam po týdnech. Kdyby se
-- odchylka v historii počítala proti aktuálnímu cíli, pak by zvýšení kalorií z 1800 na
-- 2200 zpětně obarvilo celé měsíce historie na „−400", přestože klient tehdy plnil přesně.
-- Featura má klienta posílit, tohle by dělalo pravý opak.
--
-- Řešení: při odeslání reportu se do něj uloží SNÍMEK cíle, který zrovna platil.
-- Historie se pak porovnává proti tomu, co v tu chvíli platilo, a měnit cíl je bezpečné.
-- Reporty starší než tahle featura mají `targets` = NULL a odchylka se u nich nezobrazí
-- (poctivé: tehdy žádný cíl zadaný nebyl).
-- =============================================================================
alter table public.client_reports
  add column if not exists targets jsonb;

comment on column public.client_reports.targets is
  'Snímek cíle (client_targets) platného v okamžiku odeslání reportu. NULL = tehdy cíl nebyl zadán. Nikdy nepřepisovat zpětně.';
