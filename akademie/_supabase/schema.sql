-- ============================================================
-- BARNA ACADEMY + VIDEOKURZ — Supabase schéma
-- (auth + per-produkt přístup + postup + certifikáty)
-- Spusť v Supabase: Dashboard → SQL Editor → New query → vlož → Run.
--
-- Členská sekce nese VÍC produktů:
--   'academy'   = Barna Academy (textové lekce)
--   'videokurz' = Videokurz (YouTube videa vložená u nás + textové materiály)
-- Přístup je PER-PRODUKT přes tabulku entitlements (někdo koupí jen jeden).
-- RLS je zapnuté = data vidí jen jejich vlastník; přístup k obsahu řídí
-- entitlements (nastavuje SimpleShop webhook server-side).
-- ============================================================

-- 1) PROFILY UŽIVATELŮ ---------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        text    not null default 'student',
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-vytvoření profilu při registraci.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) ENTITLEMENTS (per-produkt přístup, klíčem E-MAIL) -------
-- Jeden řádek = e-mail má zaplacený přístup k danému produktu.
-- product ∈ ('academy','videokurz'). Nastavuje SimpleShop webhook (server).
-- Klíčem je e-mail (ne user_id) ZÁMĚRNĚ: zákazník typicky nejdřív zaplatí
-- (webhook udělí přístup e-mailu) a teprve potom si založí účet se stejným
-- e-mailem → přístup funguje hned po přihlášení, bez ručního párování.
create table if not exists public.entitlements (
  email       text not null,
  product     text not null check (product in ('academy','videokurz')),
  active      boolean not null default true,
  source      text,                              -- např. 'simpleshop'
  granted_at  timestamptz not null default now(),
  primary key (email, product)
);

alter table public.entitlements enable row level security;

-- Uživatel VIDÍ entitlements svého e-mailu. Měnit je může jen server
-- (service_role obchází RLS) — žádná insert/update policy pro klienty.
drop policy if exists "entitlements_select_own" on public.entitlements;
create policy "entitlements_select_own" on public.entitlements
  for select using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Pomocná funkce pro gating (volá frontend i RLS jiných tabulek).
-- POZN.: 'academy' automaticky uděluje i přístup k 'videokurz' (videokurz je v ceně Academy).
create or replace function public.has_entitlement(p_product text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.entitlements
    where lower(email) = lower(auth.jwt() ->> 'email')
      and active = true
      and (product = p_product or (p_product = 'videokurz' and product = 'academy'))
  );
$$;
grant execute on function public.has_entitlement(text) to authenticated;

-- 3) POSTUP V LEKCÍCH/VIDEÍCH --------------------------------
-- Nahrazuje localStorage 'ba_progress_v1'. lesson_id namespacuje produkt:
--   Academy: 'm1-l1' … ; Videokurz: 'vk-01' …
create table if not exists public.progress (
  user_id      uuid not null references auth.users(id) on delete cascade,
  product      text not null check (product in ('academy','videokurz')),
  lesson_id    text not null,
  completed    boolean not null default true,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.progress enable row level security;

-- Zápis postupu jen pro vlastníka A jen pokud má přístup k produktu.
drop policy if exists "progress_select_own" on public.progress;
create policy "progress_select_own" on public.progress
  for select using (auth.uid() = user_id);

drop policy if exists "progress_write_own" on public.progress;
create policy "progress_write_own" on public.progress
  for insert with check (auth.uid() = user_id and public.has_entitlement(product));

drop policy if exists "progress_update_own" on public.progress;
create policy "progress_update_own" on public.progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4) CERTIFIKÁTY (jen Academy) -------------------------------
-- Vydává server po splnění zkoušky (test ≥80 % + schválený praktický úkol).
create table if not exists public.certificates (
  cert_id    text primary key,                 -- BA-2026-0007
  user_id    uuid references auth.users(id) on delete set null,
  full_name  text not null,
  program    text not null default 'Barna Academy',
  issued_at  date not null default current_date,
  valid      boolean not null default true
);

alter table public.certificates enable row level security;

drop policy if exists "certificates_select_own" on public.certificates;
create policy "certificates_select_own" on public.certificates
  for select using (auth.uid() = user_id);

-- Veřejné ověření pravosti (jen nezbytná pole), volá se RPC funkcí.
create or replace function public.verify_certificate(p_cert_id text)
returns table(cert_id text, full_name text, program text, issued_at date, valid boolean)
language sql security definer set search_path = public as $$
  select cert_id, full_name, program, issued_at, valid
  from public.certificates
  where cert_id = p_cert_id and valid = true;
$$;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- ============================================================
-- POZNÁMKY:
-- • PŘÍSTUP (entitlements) nastavuje SERVER-SIDE SimpleShop webhook (Edge
--   Function / Worker se service_role klíčem) — podle zaplaceného produktu
--   (academy / videokurz) najde/uloží uživatele dle e-mailu a vloží řádek.
-- • Service-role klíč drž JEN na serveru. Do frontendu patří jen anon klíč.
-- • Obsah (textové lekce, vložená YouTube videa) leží staticky na webu a
--   gatuje se přihlášením + has_entitlement(produkt). Videa hostuje YouTube
--   (unlisted), přehrávají se vložená v naší stránce — Supabase řeší jen
--   kdo má přístup, ne hosting videa.
-- ============================================================
