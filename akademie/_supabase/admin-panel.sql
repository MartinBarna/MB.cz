-- ============================================================
-- Barna Academy — admin panel: allowlist + usage tracking
-- Spustit v Supabase SQL editoru. Bezpečné/idempotentní.
-- ============================================================

-- 1) ADMIN ALLOWLIST (kdo smí do /akademie/admin/). Čárkou oddělené e-maily.
insert into public.app_config (key, value)
values ('admin_emails', 'fitness.barna@gmail.com')
on conflict (key) do nothing;   -- existuje-li, nech (uprav ručně přidáním dalších adminů)

-- 2) USAGE EVENTS (fáze 2: jak často a jak dlouho členové chodí do sekce)
--    Zapisuje lehký beacon z členských stránek (ba-usage.js) přes admin-api/track.
create table if not exists public.usage_events (
  id          bigint generated always as identity primary key,
  email       text not null,
  path        text not null,
  dwell_ms    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists usage_events_email_idx on public.usage_events (email, created_at desc);

-- RLS: tabulka je přístupná jen přes service_role (admin-api). Žádný anon přístup.
alter table public.usage_events enable row level security;
-- (žádná policy pro anon/authenticated → čte/píše jen service_role uvnitř edge funkcí)

-- POZN.: otevření e-mailů ('open' eventy v email_events) doplní Resend webhook
--        (fáze 2) — viz handoff. Tabulka email_events už 'open' typ unese.
