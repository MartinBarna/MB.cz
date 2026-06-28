-- ============================================================
-- Barna Academy - DRIP e-mailovy engine: schema + infra (idempotentni)
-- Spust v Supabase SQL editoru. Copy mailu je v public.email_templates
-- (viz drip-templates.sql) - tenhle soubor resi jen schema a infrastrukturu.
--
-- BEZPECNOST: zadny Resend/service-role klic tady NENI a NIKDY nesmi byt
-- (repo je verejne). drip_invoke_secret se generuje primo v DB (gen_random_uuid)
-- a necommituje se. Edge funkce ctou klice jen z env (Functions -> Secrets).
-- ============================================================

-- 1) leads.track = ktera sekvence. 'lead-magnet' (default, novy lead z webu),
--    'existing-leadmagnet' = bridge pro leady, co uz lead-magnet PDF dostali.
alter table public.leads add column if not exists track text not null default 'lead-magnet';
comment on column public.leads.track is
  'Drip sequence id: lead-magnet (default) | existing-leadmagnet | (future: owner-upsell ...)';

-- 2) index pro vyber "due" leadu workerem
create index if not exists leads_due_idx on public.leads (next_send_at)
  where status = 'active' and next_send_at is not null;

-- 3) idempotence: max 1 'sent' event na (lead, step)
create unique index if not exists email_events_lead_step_sent_uniq
  on public.email_events (lead_id, step) where type = 'sent';

-- 4) server-only config. RLS zapnute, ZADNA policy -> ctou/pisou jen
--    funkce/cron se service_role (klient sem nevidi).
create table if not exists public.app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;

-- invoke secret pro drip-send (sdili ho funkce i cron). Generuje se v DB,
-- do gitu se nikdy nedostane (jen poddotaz na app_config, ne hodnota).
insert into public.app_config (key, value)
values ('drip_invoke_secret', gen_random_uuid()::text)
on conflict (key) do nothing;

-- 5) email_templates = copy mailu v DB (editovatelne bez redeploye funkce)
create table if not exists public.email_templates (
  track      text not null,
  step       int  not null,
  key        text not null,
  subject    text not null,
  preheader  text not null default '',
  blocks     jsonb not null,
  wait_days  int,            -- pauza PO tomto kroku (dny); null = konec sekvence
  updated_at timestamptz not null default now(),
  primary key (track, step)
);
alter table public.email_templates enable row level security;

-- 6) paticka kazdeho mailu (tokeny [a] = zenska koncovka, {{unsubscribe_url}})
insert into public.app_config (key, value) values
('footer_html', $f$Tento e-mail jsi dostal[a], protože sis stáhl[a] plán zdarma na martinbarna.cz.<br>Nechceš už e-maily? <a href="{{unsubscribe_url}}" style="color:#999">Odhlásit se</a> — jedním klikem, bez urážky :)<br>Martin Barna — online výživový Coach · <a href="https://martinbarna.cz" style="color:#999">martinbarna.cz</a>$f$),
('footer_text', $f$Tento e-mail jsi dostal[a], protože sis stáhl[a] plán zdarma na martinbarna.cz.
Odhlásit se: {{unsubscribe_url}}
Martin Barna — online výživový Coach · martinbarna.cz$f$)
on conflict (key) do update set value = excluded.value, updated_at = now();

-- 7) rozsireni + hodinovy cron. Cron vola drip-send pres pg_net; v textu jobu
--    je jen poddotaz na secret (ne hodnota). drip-send dal resi rozeslani.
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule('drip-send-hourly', '0 * * * *', $cron$
  select net.http_post(
    url := 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/drip-send',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-drip-secret', (select value from public.app_config where key='drip_invoke_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$cron$);
