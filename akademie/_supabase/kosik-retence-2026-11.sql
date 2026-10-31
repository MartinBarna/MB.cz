-- akademie/_supabase/kosik-retence-2026-11.sql
-- NESPOUSTET. Soubor je pripravena migrace. Tento PR ji na databazi nepousti.
-- Smaze stare radky kosik_checkouty. Pred smazanim je zalohuje.
-- Cron je ZAKOMENTOVANY. Funkce pri chybejicim nebo false flagu kosik_retence_zapnuto
-- nic nesmaze, takze ani odkomentovany cron sam od sebe nemaze.
-- Zapnuti planovani patri do stejneho kroku jako zapnuti kosiku. Postup: docs/kosik/RUNBOOK.md.
-- Navrat: kosik-retence-2026-11.down.sql
--
-- Pravidla (TEST radky i ostre, sloupec test se nefiltruje):
-- 1. odhlaseno_at je vyplnene: smazat hned. E-mail v odhlaseni_trvale se NEDOTYKA.
-- 2. zaplaceno_at starsi nez 30 dni: smazat.
-- 3. souhlas false, nezaplaceno: smazat 30 dni od created_at.
-- 4. souhlas true, nezaplaceno: smazat 90 dni od posledniho odeslaneho mailu
--    (mail1_odeslan_at / mail2_odeslan_at). Kdyz mail nesel, od created_at.
--    Sucha razitka mail*_dry_at se nepocitaji.
-- Presne na hranici radek zustava (porovnani < now() - interval).

create table if not exists public.kosik_checkouty_zaloha_retence (
  zaloha_id bigint generated always as identity primary key,
  zaloha_at timestamptz not null default now(),
  id uuid not null,
  radek jsonb not null
);

alter table public.kosik_checkouty_zaloha_retence enable row level security;
revoke all on public.kosik_checkouty_zaloha_retence from public, anon, authenticated;

create or replace function public.kosik_retence_smaz()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  zapnuto text;
  n integer := 0;
begin
  select value into zapnuto from public.app_config where key = 'kosik_retence_zapnuto';
  if coalesce(zapnuto, 'false') <> 'true' then
    return 0;
  end if;

  drop table if exists _kosik_retence_kandidati;
  create temp table _kosik_retence_kandidati on commit drop as
  select k.*
  from public.kosik_checkouty k
  where
    k.odhlaseno_at is not null
    or (
      k.zaplaceno_at is not null
      and k.odhlaseno_at is null
      and k.zaplaceno_at < now() - interval '30 days'
    )
    or (
      k.souhlas = false
      and k.zaplaceno_at is null
      and k.odhlaseno_at is null
      and k.created_at < now() - interval '30 days'
    )
    or (
      k.souhlas = true
      and k.zaplaceno_at is null
      and k.odhlaseno_at is null
      and coalesce(greatest(k.mail1_odeslan_at, k.mail2_odeslan_at), k.created_at) < now() - interval '90 days'
    );

  insert into public.kosik_checkouty_zaloha_retence (id, radek)
  select k.id, to_jsonb(k)
  from _kosik_retence_kandidati k;

  delete from public.kosik_checkouty d
  using _kosik_retence_kandidati k
  where d.id = k.id;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.kosik_retence_smaz() from public, anon, authenticated;
grant execute on function public.kosik_retence_smaz() to service_role;

-- insert into public.app_config(key, value) values
--   ('kosik_retence_zapnuto', 'false')
-- on conflict (key) do nothing;

-- Denni uloha, 03:15 UTC. Nechat zakomentovane, dokud se kosik nezapina.
-- Vypnuti: bud flag kosik_retence_zapnuto zpet na false, nebo cron.unschedule.
-- select cron.schedule(
--   'kosik-retence-denne',
--   '15 3 * * *',
--   $$select public.kosik_retence_smaz();$$
-- );
