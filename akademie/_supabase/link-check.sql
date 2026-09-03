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
--
-- ⛔ 3. 9. 2026: ochrana webu (WEDOS) blokla naši IP a 106 adres na vlastní doméně
-- dostalo „NELZE OVĚŘIT" (viz hlavička link-check/index.ts). `chyb` je ale počítalo
-- jako skutečné rozbité odkazy a digest hlásil „107 nefunguje" + poplach ROZBITÉ
-- ODKAZY, přestože žádný odkaz rozbitý nebyl. ⇒ Adresy na vlastní doméně
-- (martinbarna.cz, www.martinbarna.cz), které skončí 401 nebo „NELZE OVĚŘIT" kvůli
-- blokaci ochrany webu, se počítají zvlášť do `vlastni_neovereno`, ne do `chyb`.
-- Skutečné 404/5xx na vlastní doméně (jiný http_status, jiná poznámka) dál PADAJÍ
-- do `chyb` beze změny. Detektor blokace je stejný test jako v `jeVyzvaOchrany()`
-- v index.ts (poznámka začíná „NELZE OVĚŘIT:"), plus obrana navíc přes holé HTTP 401
-- na vlastní doméně, kdyby detektor v edge funkci blokaci nerozpoznal.
-- ⛔ NÁVRATOVÝ TYP SE MĚNÍ (přibyl sloupec `vlastni_neovereno`), proto `drop function`
-- před `create`, ne `create or replace` (jiná signatura by tiše vyrobila druhou funkci).
drop function if exists public.link_check_souhrn();

create function public.link_check_souhrn()
returns table (posledni_beh timestamptz, celkem int, chyb int, vlastni_neovereno int, prvni_chyby text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with posledni as (
    select max(run_at) as t from public.link_check
  ),
  oznaceno as (
    select l.*,
           (l.url ~* '^https?://(www\.)?martinbarna\.cz(/|$)'
             and (l.http_status = 401 or l.poznamka like 'NELZE OVĚŘIT:%')) as vlastni_blok
    from public.link_check l, posledni p
    where l.run_at = p.t
  )
  select p.t,
         (select count(*)::int from oznaceno),
         (select count(*)::int from oznaceno where not ok and not vlastni_blok),
         (select count(*)::int from oznaceno where not ok and vlastni_blok),
         (select string_agg(o.url || ' (' || coalesce(o.http_status::text, o.poznamka, '?') || ')', E'\n')
            from (select * from oznaceno o2
                   where not o2.ok and not o2.vlastni_blok
                   order by o2.id limit 10) o)
  from posledni p;
$function$;

-- ============================================================================
-- OVĚŘENÍ PO MIGRACI
--   select * from link_check_souhrn();      -- hned po migraci: posledni_beh NULL
--   -- po prvním běhu funkce link-check:
--   select kde, count(*), count(*) filter (where not ok) from link_check
--    where run_at = (select max(run_at) from link_check) group by kde;
--   -- ověření nové vlastni_neovereno (po běhu, kdy WEDOS blokuje):
--   select celkem, chyb, vlastni_neovereno from link_check_souhrn();
-- ============================================================================
