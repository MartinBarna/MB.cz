-- EN mailing: 5 úvodních anglických mailů pro leady z martinbarna.cz/en/ (13. 10. 2026, větev en-mailing-1013).
-- Texty: _Claude-dokumenty/2026-10-13_en-klienti/texty/emails-en-1-5.md, v kódu en-mailing/logic.ts.
--
-- ⛔ AUTOMAT JE PO TÉHLE MIGRACI VYPNUTÝ. en_mailing_config.enabled = false a funkce en-mailing
--    pak jen vrací náhled (dry-run), nic neposílá a nic nerazítkuje. Zapnutí je vědomý krok
--    Martina (viz README-EN-MAILING.md v akademie/_supabase/functions/en-mailing/).
-- ⛔ NIKDY MAIL NAVÍC: razítko en_mail_log (unique lead_email + step) se zapisuje PŘED voláním
--    Resendu. Selhání Resendu = status 'failed', žádné opakování.
-- ⛔ Cron se tady NEZAKLÁDÁ. Hotový příkaz (zakomentovaný) je v en-mailing-cron-2026-10-13.sql.
--
-- Pořadí nasazení: tenhle soubor -> deploy en-unsubscribe + en-mailing -> web /en/unsubscribe/ ->
-- dry-run -> (Martin) enabled = true -> cron.
--
-- RLS ZAPNUTÉ a ŽÁDNÉ politiky + revoke od public, anon, authenticated (stejně jako en_leads,
-- paměť feedback-postgres-grant-public-vs-anon). Čte a píše jen service_role (edge funkce, šéf).

-- 1) Vypínač. Jeden řádek (id = true), enabled výchozí false.
create table if not exists public.en_mailing_config (
  id          boolean primary key default true check (id),
  enabled     boolean not null default false,
  updated_at  timestamptz not null default now(),
  note        text
);

insert into public.en_mailing_config (id, enabled, note)
values (true, false, 'Vypnuto při založení 13. 10. 2026. Zapíná jen Martin.')
on conflict (id) do nothing;

comment on table public.en_mailing_config is
  'Vypínač EN mailingu (edge en-mailing). enabled=false = jen náhled, nic se neposílá. Zapíná jen Martin.';

-- 2) Log a razítko proti duplicitě. Řádek vzniká PŘED odesláním se status 'sending'.
--    unique (lead_email, step) = každý krok nejvýš jednou na e-mail, i při dvou souběžných bězích.
--    status: 'sending' (razítko, výsledek ještě nezapsán; starší než hodina = výsledek neznámý),
--            'sent' (Resend vrátil id), 'failed' (Resend odmítl nebo neodpověděl; NEOPAKUJE SE).
create table if not exists public.en_mail_log (
  id           bigint generated always as identity primary key,
  lead_email   text not null check (lead_email = lower(lead_email)),
  lead_id      uuid,
  step         int  not null check (step between 1 and 5),
  sent_at      timestamptz not null default now(),
  status       text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  provider_id  text,
  error        text,
  constraint en_mail_log_email_step_key unique (lead_email, step)
);

comment on table public.en_mail_log is
  'Razítka a log EN mailingu. Insert PŘED Resendem; unique (lead_email, step) brání druhému mailu. failed se neopakuje.';

create index if not exists en_mail_log_sent_at_idx on public.en_mail_log (sent_at desc);
create index if not exists en_mail_log_provider_idx on public.en_mail_log (provider_id) where provider_id is not null;

-- 3) Odhlášení. Odhlášený e-mail už nedostane nic z EN mailingu.
create table if not exists public.en_unsubscribes (
  email       text primary key check (email = lower(email)),
  created_at  timestamptz not null default now(),
  source      text
);

comment on table public.en_unsubscribes is
  'Odhlášené e-maily z EN mailingu (edge en-unsubscribe, ruční zápis šéfa). Kdo tu je, nedostane nic.';

-- RLS a práva
alter table public.en_mailing_config enable row level security;
alter table public.en_mail_log       enable row level security;
alter table public.en_unsubscribes   enable row level security;

revoke all on table public.en_mailing_config from public, anon, authenticated;
revoke all on table public.en_mail_log       from public, anon, authenticated;
revoke all on table public.en_unsubscribes   from public, anon, authenticated;

grant select, insert, update, delete on table public.en_mailing_config to service_role;
grant select, insert, update, delete on table public.en_mail_log       to service_role;
grant select, insert, update, delete on table public.en_unsubscribes   to service_role;

-- ---------------------------------------------------------------------------
-- Ověření po aplikaci (jen čtení):
--   select id, enabled from public.en_mailing_config;                                   -- jeden řádek: true, false
--   select relname, relrowsecurity from pg_class
--    where oid in ('public.en_mailing_config'::regclass, 'public.en_mail_log'::regclass, 'public.en_unsubscribes'::regclass);  -- vše true
--   select tablename, count(*) from pg_policies
--    where schemaname = 'public' and tablename in ('en_mailing_config', 'en_mail_log', 'en_unsubscribes') group by 1;  -- žádný řádek
--   select table_name, grantee, privilege_type from information_schema.role_table_grants
--    where table_schema = 'public' and table_name in ('en_mailing_config', 'en_mail_log', 'en_unsubscribes')
--    order by 1, 2, 3;                                                                    -- jen postgres a service_role
--
-- Rollback JEN dokud je en_mail_log i en_unsubscribes prázdná (jinak by zmizela razítka a lidé by
-- dostali maily znovu, a zmizelo by odhlášení). Vypnutí se dělá vypínačem, ne mazáním tabulek.
--   drop table if exists public.en_mail_log;
--   drop table if exists public.en_unsubscribes;
--   drop table if exists public.en_mailing_config;
