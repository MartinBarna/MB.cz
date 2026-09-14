-- =============================================================================
-- client-remind, KROK 1 ze 2: tabulka idempotence. Spustit PŘED deployem nové funkce
-- client-remind (funkce ji čte vždy; bez tabulky vrací 500 read_failed, i v test režimu).
-- Krok 2 (cron na neděli + opakovací běhy) je v client-remind-nedele-2-cron.sql a spouští
-- se AŽ PO deployi funkce, jinak by tři nedělní běhy staré funkce poslaly až tři maily.
--
-- Martin 14. 9. 2026: výzva k reportu klientům koučinku má chodit v neděli, ne v pondělí.
-- Incident 14. 9. 01:00 UTC: čtení tajného klíče spadlo na 504 brány, funkce vrátila 403, cron
-- hlásil succeeded, nikdo nic nedostal. Proto tři běhy a tabulka „komu už výzva šla".
--
-- Spouští se ručně přes MCP apply_migration v DB Academy (uhmrpfsdcujbhbtumqye) po Martinově GO.
-- =============================================================================
create table if not exists public.client_remind_sent (
  id bigserial primary key,
  email text not null,
  kind text not null check (kind in ('report', 'register')),
  sent_at timestamptz not null default now()
);
create index if not exists client_remind_sent_email_sent_at
  on public.client_remind_sent (email, sent_at desc);

-- Jen service_role (edge funkce). Žádná policy = RLS nikoho jiného nepustí.
alter table public.client_remind_sent enable row level security;
revoke all on table public.client_remind_sent from public, anon, authenticated;
revoke all on sequence public.client_remind_sent_id_seq from public, anon, authenticated;
grant select, insert on table public.client_remind_sent to service_role;
grant usage, select on sequence public.client_remind_sent_id_seq to service_role;

-- Kontrola: select to_regclass('public.client_remind_sent'), relrowsecurity from pg_class where relname='client_remind_sent';
