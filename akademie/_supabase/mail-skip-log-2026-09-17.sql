-- =============================================================================
-- `mail_skip_log`: BRÁNA MUSÍ NECHAT ČITELNOU STOPU (dávka 2, 17. 9. 2026, nález A/N1)
--
-- ⛔ SPUSTIT PŘED DEPLOYEM funkcí, které importují `_shared/mailing-guard.ts`.
--    Bez tabulky zápis skipu selže. Je to ošetřené (jen `console.error`, odeslání
--    se nezastaví), ale log by se zbytečně plnil chybou.
--
-- CO SE OPRAVUJE
-- Brána (`mailing-guard.ts`) logovala skipy do `email_events` s `detail.track='mailing-guard'`.
-- Změřeno 17. 9. 2026 na živé DB:
--     select count(*) from email_events where detail->>'track'='mailing-guard';  -- 0
--     select to_regclass('public.mail_skip_log');                                -- null
-- Za celou dobu od nasazení brány (7. 9. 2026) tam NENÍ ANI JEDEN řádek. Z dat nešlo
-- odlišit dvě vysvětlení: buď brána nikoho nezastavila, nebo se zápis nikdy nepovedl.
-- Zápis totiž byl v `try { } catch { /* best-effort */ }`, takže selhání nezanechalo
-- ani stopu v logu funkce. ⇒ Hlídka, kterou nejde přečíst, není hlídka.
--
-- CO SE MĚNÍ
--  1. Vlastní tabulka `mail_skip_log` (dosud NEEXISTOVALA, přestože se o ní mluvilo).
--  2. `logMailSkip` píše do obou míst a chybu zápisu hlasitě loguje (`console.error`).
--     ⛔ Odeslání se kvůli zápisu skipu NIKDY nezastaví: evidence nesmí shodit dávku.
--
-- ⚠️ `email` v téhle tabulce je osobní údaj. Proto RLS bez jediné policy a revoke
--    pro `anon` i `authenticated`: čte a píše výhradně `service_role` (edge funkce).
--    Stejný vzor jako `client_remind_sent`.
--    Paměť: feedback-zalozni-tabulka-bez-rls-je-verejna.
--
-- Spouští se ručně přes MCP apply_migration v DB Academy (uhmrpfsdcujbhbtumqye).
-- =============================================================================

create table if not exists public.mail_skip_log (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  email       text,
  lead_id     uuid,
  fn          text not null,
  path        text,
  mail_class  text not null,
  reason      text not null
);

comment on table public.mail_skip_log is
  'Kazdy skip mailing-guard. Bez teto tabulky se nedalo zvenci zmerit, jestli brana vubec funguje (nalez A/N1, 17. 9. 2026).';

-- Hlavní dotaz je „co brána zastavila za posledních N dní", proto index na čase.
create index if not exists mail_skip_log_created_at
  on public.mail_skip_log (created_at desc);
-- Druhý dotaz je „proč a odkud", ať jde rozlišit trvalý důvod od dočasného výpadku.
create index if not exists mail_skip_log_fn_reason
  on public.mail_skip_log (fn, reason, created_at desc);

alter table public.mail_skip_log enable row level security;
revoke all on table public.mail_skip_log from public, anon, authenticated;
revoke all on sequence public.mail_skip_log_id_seq from public, anon, authenticated;
grant select, insert on table public.mail_skip_log to service_role;
grant usage, select on sequence public.mail_skip_log_id_seq to service_role;

-- Kontrola po zásahu:
--   select to_regclass('public.mail_skip_log');
--   select relrowsecurity from pg_class where relname = 'mail_skip_log';
--   select has_table_privilege('anon', 'public.mail_skip_log', 'SELECT');   -- čekám false
--   select has_table_privilege('service_role', 'public.mail_skip_log', 'INSERT'); -- čekám true
--
-- SONDA, ŽE BRÁNA OPRAVDU PÍŠE (po deployi funkcí, nález A/N1 to výslovně žádá):
--   zavolej `order-rescue` s {"test_email":"<adresa z odhlaseni_trvale>"} a zkontroluj:
--   select created_at, fn, path, mail_class, reason from public.mail_skip_log
--    order by created_at desc limit 5;
--   ⚠️ `order-rescue` je třída `optional_reminder`, takže trvale odhlášeného opravdu
--      zastaví. U třídy `purchase_delivery` by odhlášení skip nezpůsobilo (LOCK 7. 9.).
--
-- Návrat: drop table if exists public.mail_skip_log;
