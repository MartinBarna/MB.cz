-- en_leads: leady z anglické stránky martinbarna.cz/en/ (13. 10. 2026, větev en-x-1013).
-- kind = 'kit'         -> formulář "The Busy Professional's Fat Loss Kit" (kalkulačka + Eating Out Playbook)
-- kind = 'application' -> přihláška do EN Gold koučinku (písemně, bez callů)
--
-- ⛔ Schválně NE tabulka `leads`: na ni jsou navázané české automatické maily (drip-send,
--    triggery, mosty tratí). EN lead tam nesmí spadnout, dostal by české maily.
-- ⛔ Nic odsud se neposílá automaticky. EN maily se spouští zvlášť, až je Martin schválí.
-- Zapisuje JEN edge funkce `en-lead` přes service_role (zdroj akademie/_supabase/functions/en-lead/index.ts).
-- Čte šéf / admin přes service_role (SQL editor, MCP execute_sql).
-- RLS ZAPNUTÉ a ŽÁDNÉ politiky = anon ani authenticated nepřečtou ani nezapíšou nic.
-- Navíc revoke tabulkových práv od public, anon, authenticated (paměť feedback-postgres-grant-public-vs-anon:
-- výchozí granty Supabase dávají nové tabulce ALL i těmto rolím; RLS chrání řádky, revoke i TRUNCATE).
--
-- IP adresa se NEUKLÁDÁ. ip_hash = sha256(sůl + '|' + IP), sůl je secret EN_LEAD_IP_SALT, jinak odvozená ze service-role klíče (index.ts).
-- Slouží jen k limitu 5 záznamů za hodinu z jedné adresy.
-- Doba uložení podle /en/privacy/: do odvolání souhlasu, nejdéle 3 roky.

create table if not exists public.en_leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  kind          text not null check (kind in ('kit', 'application')),
  first_name    text,
  email         text not null,
  consent       boolean not null,
  consent_text  text,
  consent_at    timestamptz,
  goal          text,
  message       text,
  calc          jsonb,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  referrer      text,
  ip_hash       text
);

comment on table public.en_leads is
  'Leady z martinbarna.cz/en/ (kit = kalkulačka + Eating Out Playbook, application = přihláška do EN Gold koučinku). '
  'Zapisuje jen edge funkce en-lead (service_role). NE tabulka leads (české automatické maily). '
  'IP se neukládá, jen ip_hash pro limit 5/h. Uchování do odvolání souhlasu, max 3 roky (viz /en/privacy/).';

alter table public.en_leads enable row level security;

revoke all on table public.en_leads from public, anon, authenticated;
grant select, insert, update, delete on table public.en_leads to service_role;

-- Limit podle ip_hash za poslední hodinu (edge funkce počítá count před insertem).
create index if not exists en_leads_ip_hash_created_idx on public.en_leads (ip_hash, created_at desc);
-- Přehled pro šéfa / Elona: nejnovější leady a dohledání podle e-mailu.
create index if not exists en_leads_created_idx on public.en_leads (created_at desc);
create index if not exists en_leads_email_idx on public.en_leads (lower(email));

-- ---------------------------------------------------------------------------
-- Ověření po aplikaci (jen čtení):
--   select relrowsecurity from pg_class where oid = 'public.en_leads'::regclass;            -- true
--   select count(*) from pg_policies where schemaname = 'public' and tablename = 'en_leads'; -- 0
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_schema = 'public' and table_name = 'en_leads' order by 1, 2;               -- jen postgres a service_role
-- Anonymní REST zvenčí musí vrátit chybu nebo prázdno, nikdy řádky:
--   curl -s "https://uhmrpfsdcujbhbtumqye.supabase.co/rest/v1/en_leads?select=id" -H "apikey: <anon>"
--
-- Rollback (jen dokud v tabulce nejsou skutečné leady):
--   drop table if exists public.en_leads;
