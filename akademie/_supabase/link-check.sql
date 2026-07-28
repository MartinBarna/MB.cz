-- ============================================================================
-- POJISTKA „UŽ NIKDY MRTVÉ ODKAZY"
--
-- Proč vůbec existuje: od 22. do 27. 7. 2026 vracela tracking doména Resendu 400
-- na VŠECHNY odkazy ve VŠECH mailech. Pět dní. Nikdo se to nedozvěděl, protože
-- se měřilo DORUČENÍ mailu, ne PRŮCHOD odkazu, a klikací události se dál logovaly.
-- Stálo to měsíc mailingu a důvěru stovek lidí.
-- ⇒ Tahle tabulka drží výsledky denní kontroly, která měří průchod odkazu.
-- Kanárkový princip: [[feedback-overuj-linky-kliknutim]].
--
-- Psáno 28. 7. 2026. Souvisí: [[mb-resend-tracking-domena-400]], [[mb-academy-pricing-mise]].
-- ============================================================================

create table if not exists public.link_check (
  id          bigserial primary key,
  run_at      timestamptz not null default now(),
  url         text        not null,
  kde         text        not null,   -- 'sablona' | 'stranka'
  http_status int,                    -- NULL = spojení vůbec neproběhlo
  ok          boolean     not null,
  poznamka    text                    -- důvod, proč to není OK
);

create index if not exists link_check_run_at_idx on public.link_check (run_at desc);
create index if not exists link_check_problemy_idx on public.link_check (run_at desc) where not ok;

comment on table public.link_check is
  'Denní kontrola průchodnosti odkazů z email_templates a klíčových stránek. '
  'Plní ji edge funkce link-check (pg_cron). Čte ji daily-digest. '
  'Vznikla po incidentu, kdy 5 dní nefungovaly odkazy ve všech mailech.';

-- Úklid historie: držíme 90 dní, ať tabulka neroste donekonečna.
-- (72 odkazů denně = ~6 500 řádků za 90 dní, zanedbatelné.)
create or replace function public.link_check_uklid()
returns integer
language sql
security definer
set search_path to 'public'
as $function$
  with smazane as (
    delete from public.link_check where run_at < now() - interval '90 days' returning 1
  )
  select count(*)::int from smazane;
$function$;

-- Shrnutí posledního běhu pro daily-digest. Vrací jeden řádek.
-- ⚠️ Když ještě žádný běh neproběhl, vrátí nuly a `posledni_beh` NULL. Digest si
-- toho musí všimnout: „žádný běh" NENÍ totéž co „všechno v pořádku".
create or replace function public.link_check_souhrn()
returns table (posledni_beh timestamptz, celkem int, chyb int, prvni_chyby text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with posledni as (
    select max(run_at) as t from public.link_check
  )
  select p.t,
         (select count(*)::int from public.link_check l where l.run_at = p.t),
         (select count(*)::int from public.link_check l where l.run_at = p.t and not l.ok),
         (select string_agg(l.url || ' (' || coalesce(l.http_status::text, l.poznamka, '?') || ')', E'\n')
            from (select * from public.link_check l2
                   where l2.run_at = p.t and not l2.ok
                   order by l2.id limit 10) l)
  from posledni p;
$function$;

-- ============================================================================
-- OVĚŘENÍ PO MIGRACI
--   select * from link_check_souhrn();      -- hned po migraci: posledni_beh NULL
--   -- po prvním běhu funkce link-check:
--   select kde, count(*), count(*) filter (where not ok) from link_check
--    where run_at = (select max(run_at) from link_check) group by kde;
-- ============================================================================
