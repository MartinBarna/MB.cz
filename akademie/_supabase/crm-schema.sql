-- ============================================================
-- CRM vrstva (fáze 1a): tabulky crm_* + RLS + pomocné funkce
-- ------------------------------------------------------------
-- Projekt Barna Academy (uhmrpfsdcujbhbtumqye). ADITIVNÍ: žádný ALTER
-- ani trigger na leads / customer_contacts / entitlements / profiles.
--
-- ⛔ TENTO SOUBOR NEAPLIKUJ na živou DB z agenta. Jen uložený DDL.
--    Spouští se ručně v SQL editoru AŽ PO schválení, viz README-CRM.md.
--
-- Ochrana: RLS ZAPNUTÉ, ŽÁDNÁ politika pro anon/authenticated.
-- Service_role má bypassrls, proto policy nepotřebuje. Grant NENÍ ochrana
-- (Supabase default privileges dávají anon zápis na každou novou tabulku).
-- Prefix crm_ je schválně, ať se to neplete s *_zaloha_* / *_backup_*.
-- ============================================================

create extension if not exists citext;
create extension if not exists pgcrypto;

-- Normalizace e-mailu. Plus-adresa se NESTŘÍHÁ (fitness.barna+test@
-- je jiná identita než fitness.barna@).
create or replace function public.crm_norm_email(p_email text)
returns text
language sql
immutable
parallel safe
as $fn$
  select nullif(lower(trim(p_email)), '');
$fn$;

comment on function public.crm_norm_email(text) is
  'lower(trim(email)); prázdné a null -> null. Plus-část se nemaže.';

create or replace function public.crm_is_test_email(p_email text)
returns boolean
language sql
immutable
parallel safe
as $fn$
  select coalesce(
    public.crm_norm_email(p_email) like '%+%'
    or public.crm_norm_email(p_email) like 'fitness.barna@%',
    false
  );
$fn$;

comment on function public.crm_is_test_email(text) is
  'true u plus-adres a u fitness.barna@... Interní/testovací účty, ne mailing.';

revoke all on function public.crm_norm_email(text) from public, anon, authenticated;
revoke all on function public.crm_is_test_email(text) from public, anon, authenticated;
grant execute on function public.crm_norm_email(text) to postgres, service_role;
grant execute on function public.crm_is_test_email(text) to postgres, service_role;


-- ------------------------------------------------------------
-- 1. crm_persons
-- ------------------------------------------------------------
create table if not exists public.crm_persons (
  id               uuid primary key default gen_random_uuid(),
  display_name     text,
  primary_email    citext,
  primary_phone    text,
  academy_user_id  uuid,
  app_user_id      uuid,
  lifecycle        text not null default 'unknown',
  is_test          boolean not null default false,
  status           text not null default 'active'
                     check (status in ('active', 'merged', 'suppressed', 'erased')),
  merged_into_id   uuid references public.crm_persons(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint crm_persons_merged_needs_target check (
    (status = 'merged' and merged_into_id is not null)
    or (status <> 'merged')
  ),
  constraint crm_persons_not_merged_into_self check (
    merged_into_id is null or merged_into_id <> id
  )
);

comment on table public.crm_persons is
  'CRM osoba. primary_email/phone můžou být null (WA jen telefon, Gmail jen adresa). lifecycle je denormalizace, pravda o nákupu žije v entitlements.';
comment on column public.crm_persons.app_user_id is
  'profiles.id appky Tvůj Coach. Žádný FK, jiný projekt.';
comment on column public.crm_persons.lifecycle is
  'Odvozený filtr, ne zdroj pravdy. Přepočítá crm_refresh_from_academy().';
comment on column public.crm_persons.is_test is
  'Plus-adresa nebo fitness.barna@. Do mailingového publika nepatří.';

create unique index if not exists crm_persons_primary_email_active_uidx
  on public.crm_persons (primary_email)
  where primary_email is not null and status = 'active';

create unique index if not exists crm_persons_primary_phone_active_uidx
  on public.crm_persons (primary_phone)
  where primary_phone is not null and status = 'active';

create unique index if not exists crm_persons_academy_user_id_uidx
  on public.crm_persons (academy_user_id)
  where academy_user_id is not null and status = 'active';

create index if not exists crm_persons_status_idx
  on public.crm_persons (status);

create index if not exists crm_persons_lifecycle_idx
  on public.crm_persons (lifecycle)
  where status = 'active';

create index if not exists crm_persons_is_test_idx
  on public.crm_persons (is_test)
  where status = 'active';


-- ------------------------------------------------------------
-- 2. crm_identifiers
-- Unikát (kind, value_normalized) pro všechny řádky: po merge se
-- identifikátory přesunou na vítěze, neoznačují se jako neaktivní.
-- ------------------------------------------------------------
create table if not exists public.crm_identifiers (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid not null references public.crm_persons(id) on delete cascade,
  kind               text not null
                       check (kind in (
                         'email', 'phone', 'academy_user_id',
                         'app_user_id', 'whatsapp_jid', 'gmail_address'
                       )),
  value_normalized   text not null,
  value_raw          text,
  source             text not null,
  first_seen_at      timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  confidence         text not null default 'hard'
                       check (confidence in ('hard', 'soft')),
  constraint crm_identifiers_value_nonempty check (length(trim(value_normalized)) > 0)
);

comment on table public.crm_identifiers is
  'Všechny identity osoby. Auto-merge jen přes kind=email. Plus-adresa != holá schránka.';

create unique index if not exists crm_identifiers_kind_value_uidx
  on public.crm_identifiers (kind, value_normalized);

create index if not exists crm_identifiers_person_idx
  on public.crm_identifiers (person_id);


-- ------------------------------------------------------------
-- 3. crm_attributes
-- Každý fakt je řádek. Prázdná hodnota se nevkládá (synk ji nesmí
-- použít k přepsání plného jména).
-- ------------------------------------------------------------
create table if not exists public.crm_attributes (
  id             uuid primary key default gen_random_uuid(),
  person_id      uuid not null references public.crm_persons(id) on delete cascade,
  key            text not null,
  value          jsonb not null,
  source         text not null,
  source_pk      text,
  observed_at    timestamptz not null default now(),
  confidence     text not null default 'medium'
                   check (confidence in ('high', 'medium', 'low')),
  superseded_at  timestamptz,
  constraint crm_attributes_key_nonempty check (length(trim(key)) > 0)
);

comment on table public.crm_attributes is
  'Údaj + odkud + kdy. superseded_at null = stále platný z daného zdroje. Karta vybírá vítěze podle priority zdroje.';

create index if not exists crm_attributes_person_key_idx
  on public.crm_attributes (person_id, key)
  where superseded_at is null;

create index if not exists crm_attributes_source_pk_idx
  on public.crm_attributes (source, source_pk)
  where source_pk is not null;


-- ------------------------------------------------------------
-- 4. crm_tags
-- ------------------------------------------------------------
create table if not exists public.crm_tags (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references public.crm_persons(id) on delete cascade,
  tag           text not null,
  source        text not null,
  attached_at   timestamptz not null default now(),
  detached_at   timestamptz,
  constraint crm_tags_tag_nonempty check (length(trim(tag)) > 0)
);

comment on table public.crm_tags is
  'Štítky z customer_contacts (snapshot) plus CRM štítky (ss-import-do-not-mail, has-videokurz). detached_at null = visí.';

create unique index if not exists crm_tags_person_tag_active_uidx
  on public.crm_tags (person_id, tag)
  where detached_at is null;

create index if not exists crm_tags_tag_idx
  on public.crm_tags (tag)
  where detached_at is null;


-- ------------------------------------------------------------
-- 5. crm_consents
-- Souhlas k mailu != souhlas k WhatsApp. Neslučovat do jednoho boolu.
-- ------------------------------------------------------------
create table if not exists public.crm_consents (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references public.crm_persons(id) on delete cascade,
  channel       text not null check (channel in ('email', 'whatsapp', 'sms')),
  purpose       text not null check (purpose in ('marketing', 'transactional', 'coaching')),
  legal_basis   text not null check (legal_basis in (
                  'consent', 'legitimate_interest', 'contract'
                )),
  state         text not null check (state in ('granted', 'withdrawn', 'unknown')),
  source        text not null,
  text_version  text,
  granted_at    timestamptz,
  withdrawn_at  timestamptz,
  evidence      jsonb,
  constraint crm_consents_withdrawn_state check (
    (state = 'withdrawn' and withdrawn_at is not null)
    or (state <> 'withdrawn')
  )
);

comment on table public.crm_consents is
  'Právní titul per kanál a účel. Odhlášení v leads vyhrává nad starým consent=true.';

create unique index if not exists crm_consents_person_channel_purpose_source_uidx
  on public.crm_consents (person_id, channel, purpose, source);


-- ------------------------------------------------------------
-- 6. crm_imports (prázdné ve fázi 1, dveře pro fázi 3)
-- ------------------------------------------------------------
create table if not exists public.crm_imports (
  id               uuid primary key default gen_random_uuid(),
  channel          text not null check (channel in ('gmail', 'whatsapp', 'other')),
  source_file      text,
  sha256           text,
  row_count        integer,
  accepted_count   integer,
  rejected_count   integer,
  status           text not null default 'received'
                     check (status in ('received', 'done', 'rejected', 'duplicate')),
  note             text,
  created_at       timestamptz not null default now(),
  finished_at      timestamptz
);

comment on table public.crm_imports is
  'Dávka ručního importu (Gmail/WhatsApp JSONL). Stejný sha256 podruhé = no-op. Fáze 1 jen schéma.';

create unique index if not exists crm_imports_sha256_uidx
  on public.crm_imports (sha256)
  where sha256 is not null;


-- ------------------------------------------------------------
-- 7. crm_interactions
-- external_id je v návrhu u importu; tady i u synku z email_events,
-- ať je unikát (channel, external_id) použitelný hned.
-- ------------------------------------------------------------
create table if not exists public.crm_interactions (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references public.crm_persons(id) on delete cascade,
  channel       text not null check (channel in (
                  'email', 'coaching', 'app', 'gmail', 'whatsapp', 'form', 'admin'
                )),
  kind          text not null check (kind in (
                  'sent', 'unsubscribed', 'bounced', 'report',
                  'purchase', 'thread_summary', 'checkin', 'grant'
                )),
  occurred_at   timestamptz not null,
  source        text not null,
  source_pk     text,
  payload       jsonb,
  import_id     uuid references public.crm_imports(id) on delete set null,
  external_id   text
);

comment on table public.crm_interactions is
  'Historie. Z email_events jen type=sent. Koučink: datum reportu, ne fotky ani measurements. Insert-only při stejném external_id.';

create unique index if not exists crm_interactions_channel_external_uidx
  on public.crm_interactions (channel, external_id)
  where external_id is not null;

create index if not exists crm_interactions_person_occurred_idx
  on public.crm_interactions (person_id, occurred_at desc);

create index if not exists crm_interactions_source_pk_idx
  on public.crm_interactions (source, source_pk)
  where source_pk is not null;


-- ------------------------------------------------------------
-- 8. crm_source_links
-- Most na existující tabulky. CRM NENÍ kopií pravdy o nákupu.
-- ------------------------------------------------------------
create table if not exists public.crm_source_links (
  id              uuid primary key default gen_random_uuid(),
  person_id       uuid not null references public.crm_persons(id) on delete cascade,
  source_system   text not null,
  source_pk       text not null,
  last_synced_at  timestamptz not null default now(),
  constraint crm_source_links_pk_nonempty check (length(trim(source_pk)) > 0)
);

comment on table public.crm_source_links is
  'Idempotence synku: (source_system, source_pk) je unikát. Znovuspuštění nepřidá druhou osobu.';

create unique index if not exists crm_source_links_system_pk_uidx
  on public.crm_source_links (source_system, source_pk);

create index if not exists crm_source_links_person_idx
  on public.crm_source_links (person_id);

create index if not exists crm_source_links_system_idx
  on public.crm_source_links (source_system);


-- ------------------------------------------------------------
-- 9. crm_merge_log
-- ------------------------------------------------------------
create table if not exists public.crm_merge_log (
  id                  uuid primary key default gen_random_uuid(),
  winner_id           uuid not null references public.crm_persons(id),
  loser_id            uuid not null references public.crm_persons(id),
  merged_at           timestamptz not null default now(),
  rules               text not null,
  conflict_snapshot   jsonb,
  constraint crm_merge_log_not_self check (winner_id <> loser_id)
);

comment on table public.crm_merge_log is
  'Kdo s kým, které pravidlo, snapshot konfliktů. Poražený se nemaže (status=merged), ať jde sloučení vrátit.';

create index if not exists crm_merge_log_winner_idx on public.crm_merge_log (winner_id);
create index if not exists crm_merge_log_loser_idx on public.crm_merge_log (loser_id);


-- ------------------------------------------------------------
-- 10. crm_enroll_queue (prázdné ve fázi 1, worker ve fázi 6)
-- CRM sem jen zapisuje. Track/step v leads se tudy přímo NEMĚNÍ.
-- ------------------------------------------------------------
create table if not exists public.crm_enroll_queue (
  id              uuid primary key default gen_random_uuid(),
  person_id       uuid not null references public.crm_persons(id) on delete cascade,
  email           text not null,
  desired_track   text not null,
  reason          text,
  requested_at    timestamptz not null default now(),
  state           text not null default 'requested'
                    check (state in (
                      'requested',
                      'done',
                      'blocked_other_track',
                      'blocked_no_lead',
                      'blocked_gate'
                    )),
  detail          jsonb,
  processed_at    timestamptz
);

comment on table public.crm_enroll_queue is
  'Chtěná trať, ještě nezapsaná do leads. Worker umí jen blokovat nebo volat existující enroll. Fáze 1 jen schéma.';

create index if not exists crm_enroll_queue_state_idx
  on public.crm_enroll_queue (state, requested_at)
  where state = 'requested';


-- ------------------------------------------------------------
-- RLS: zapnout, žádná politika.
-- ------------------------------------------------------------
alter table public.crm_persons      enable row level security;
alter table public.crm_identifiers  enable row level security;
alter table public.crm_attributes   enable row level security;
alter table public.crm_tags         enable row level security;
alter table public.crm_consents     enable row level security;
alter table public.crm_interactions enable row level security;
alter table public.crm_source_links enable row level security;
alter table public.crm_merge_log    enable row level security;
alter table public.crm_imports      enable row level security;
alter table public.crm_enroll_queue enable row level security;

-- Extra tvrz nad RLS: sebrat default privileges, které Supabase dává
-- anon/authenticated. Kdyby někdo později přidal politiku, pořád nemá
-- GRANT. Pravý zámek zápisu bez politiky je ale pořád RLS.
do $priv$
declare
  t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename like 'crm_%'
  loop
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to postgres, service_role', t);
  end loop;
end
$priv$;
