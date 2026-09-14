-- =============================================================================
-- client-remind: výzva k týdennímu reportu klientům koučinku se posouvá z pondělí
-- na NEDĚLI 03:00 (Martin 14. 9. 2026: reporty zpracovává v pondělí, klient je má
-- mít možnost vyplnit už v neděli). K tomu opakování běhu a idempotence.
--
-- PROČ OPAKOVÁNÍ: 14. 9. 2026 01:00 UTC spadlo ve funkci čtení tajného klíče na 504
-- brány, funkce vrátila 403, cron hlásil succeeded a 14 klientů nedostalo nic.
-- Jednorázový týdenní běh nemá druhou šanci, proto tři běhy po 30 minutách.
-- Funkce od verze 14. 9. NEPOŠLE dvakrát: kdo dostal výzvu v posledních 5 dnech
-- (tabulka client_remind_sent), toho další běh vynechá.
--
-- ⚠️ pg_cron běží v UTC: `0 1` = 03:00 v letním čase, 02:00 v zimním (stejně jako
--    dosavadní pondělní běh). Kdo chce zimní 03:00, přehodí po 25. 10. 2026 na `0 2`.
--
-- Spouští se ručně přes MCP apply_migration / execute_sql v DB Academy
-- (uhmrpfsdcujbhbtumqye) až po Martinově GO, spolu s deployem funkce client-remind.
-- Pořadí: 1) tabulka, 2) deploy funkce (čte tabulku), 3) cron.
-- =============================================================================

-- 1) idempotence: komu a jaká výzva odešla
create table if not exists public.client_remind_sent (
  id bigserial primary key,
  email text not null,
  kind text not null check (kind in ('report', 'register')),
  sent_at timestamptz not null default now()
);
create index if not exists client_remind_sent_email_sent_at
  on public.client_remind_sent (email, sent_at desc);
-- Jen service_role (edge funkce). Žádná policy = RLS nikoho nepustí.
alter table public.client_remind_sent enable row level security;
revoke all on table public.client_remind_sent from public, anon, authenticated;
revoke all on sequence public.client_remind_sent_id_seq from public, anon, authenticated;

-- 3) cron: hlavní běh neděle 01:00 UTC + dva opakovací běhy (funkce je idempotentní)
select cron.alter_job(19, schedule := '0 1 * * 0');

select cron.schedule(
  'client-remind-weekly-2',
  '30 1 * * 0',
  $cmd$
  select net.http_post(
    url := 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/client-remind',
    headers := jsonb_build_object('Content-Type','application/json','x-drip-secret',(select value from public.app_config where key='drip_invoke_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cmd$
);

select cron.schedule(
  'client-remind-weekly-3',
  '0 2 * * 0',
  $cmd$
  select net.http_post(
    url := 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/client-remind',
    headers := jsonb_build_object('Content-Type','application/json','x-drip-secret',(select value from public.app_config where key='drip_invoke_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cmd$
);

-- Kontrola po zásahu:
-- select jobid, jobname, schedule from cron.job where jobname like 'client-remind%';
-- Návrat: select cron.alter_job(19, schedule := '0 1 * * 1');
--         select cron.unschedule('client-remind-weekly-2'); select cron.unschedule('client-remind-weekly-3');
