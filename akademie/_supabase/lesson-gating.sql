-- ============================================================
-- Barna Academy - GATING OBSAHU LEKCI (2026-07-07)
-- Placeny text lekci NENI ve statickem HTML - zije v DB za RLS.
-- Stranky lekci jsou shell (crumb + h1 + done tlacitko); obsah
-- fetchuje BA.getLessonHtml(lessonId) az po requireAccess.
-- Zaznam 'zaverecny-test' nese JSON otazek zaverecneho testu.
-- Free ukazky (m1-l1..3, m2-l1, m3-l1, m6-l1) zustavaji staticke.
--
-- Obsah nahrava/aktualizuje se docasnou SECURITY DEFINER RPC
-- (viz runbook v commit message #405) nebo pres service-role.
-- POZOR: pri uprave lekce edituj HTML zdroj v repu NEJDE - zdroj
-- pravdy obsahu je tahle tabulka; extrahovane zdroje viz git
-- historie pred commitem #405.
-- ============================================================

create table if not exists public.lesson_content (
  lesson_id  text primary key,
  product    text not null default 'academy',
  html       text not null,
  updated_at timestamptz not null default now()
);

alter table public.lesson_content enable row level security;

-- Jen prihlaseny s aktivnim pristupem (per-produkt). ZADNA anon policy
-- => nezalogovany curl/scraper dostane 0 radku.
drop policy if exists lesson_content_member_read on public.lesson_content;
create policy lesson_content_member_read on public.lesson_content
  for select to authenticated
  using (public.has_entitlement(product));
