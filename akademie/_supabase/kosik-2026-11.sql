-- akademie/_supabase/kosik-2026-11.sql
-- NESPOUSTET bez GO Clauda pres DEPLOY-ZAMEK.
-- Soubor je jen navrzena migrace. Tento PR ji na databazi nepousti.
-- Cron a insert flagu jsou ZAKOMENTOVANE. Vychozi stav flagu je vypnuto, dry-run zapnuto.

create table if not exists public.kosik_checkouty (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  produkt_klic text not null,
  castka_halere integer not null,
  souhlas boolean not null default false,
  souhlas_text text,
  souhlas_verze text,
  souhlas_at timestamptz,
  zdroj_url text,
  cref text,
  ip_hash text,
  user_agent text,
  stripe_session_id text unique,
  stav text not null default 'zalozeno',
  expirovano_at timestamptz,
  recovery_url text,
  recovery_expires_at timestamptz,
  mail1_due_at timestamptz,
  mail1_odeslan_at timestamptz,
  mail1_provider_id text,
  mail1_dry_at timestamptz,
  mail2_due_at timestamptz,
  mail2_odeslan_at timestamptz,
  mail2_provider_id text,
  mail2_dry_at timestamptz,
  zaplaceno_at timestamptz,
  obnoveno boolean not null default false,
  recovered_session_id text,
  odpoved_at timestamptz,
  odhlaseno_at timestamptz,
  odhlaseni_token uuid not null default gen_random_uuid(),
  test boolean not null default false,
  stop_duvod text,
  constraint souhlas_uplny check (
    not souhlas or (souhlas_at is not null and souhlas_text is not null and souhlas_verze is not null)
  )
);

create index if not exists kosik_checkouty_email_idx
  on public.kosik_checkouty (lower(email), created_at desc);
create index if not exists kosik_checkouty_mail1_idx
  on public.kosik_checkouty (mail1_due_at) where mail1_odeslan_at is null;
create index if not exists kosik_checkouty_mail2_idx
  on public.kosik_checkouty (mail2_due_at) where mail2_odeslan_at is null;

alter table public.kosik_checkouty enable row level security;
-- zadna policy: cte a pise jen service role

-- select cron.schedule(
--   'kosik-pripominka-15min',
--   '*/15 * * * *',
--   $$
--   select net.http_post(
--     url := 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/kosik-pripominka',
--     headers := jsonb_build_object(
--       'Content-Type','application/json',
--       'x-drip-secret', (select value from public.app_config where key = 'drip_invoke_secret')
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );

-- insert into public.app_config(key, value) values
--   ('kosik_web_zapnuto','false'),
--   ('kosik_mail_zapnuto','false'),
--   ('kosik_dry_run','true'),
--   ('kosik_garance_k1','false'),
--   ('kosik_produkty','konzultace')
-- on conflict (key) do nothing;
