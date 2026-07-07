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

-- 3) PAUZA MAILINGU Z ADMINU (2026-07-07, nasazeno zivé): leads.status umi 'paused'.
--    Admin-api akce lead_update (pause/resume/retrack) — pauza NEni unsubscribe,
--    lead jde kdykoliv obnovit a pokracuje krokem, na kterem skoncil.
--    Vsechny selecty dripu i enroll funkci filtruji status='active', takze
--    'paused' bezpecne vypada z fronty i z auto-enrollu.
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check
  check (status = any (array['active'::text,'unsubscribed'::text,'bounced'::text,'purchased'::text,'paused'::text]));

-- 4) ADMIN v2 (2026-07-07, nasazeno zive): referraly, check-iny, editor sablon.
-- 4a) Evidence vyplat referral odmen (saldo = confirmed - paid, viz view nize)
create table if not exists public.referral_payouts (
  id bigint generated always as identity primary key,
  owner_email text not null,
  amount_czk integer not null check (amount_czk > 0),
  note text,
  created_by text,
  created_at timestamptz not null default now()
);
alter table public.referral_payouts enable row level security; -- zadna policy = jen service_role

-- 4b) Salda partneru z PLNYCH dat (admin-api akce referrals_overview)
create or replace view public.referral_balances with (security_invoker = true) as
select c.owner_email,
  coalesce(sum(r.reward_amount) filter (where r.status='confirmed'), 0)::int as confirmed,
  coalesce(sum(r.reward_amount) filter (where r.status='pending'), 0)::int as pending,
  coalesce((select sum(p.amount_czk) from referral_payouts p where lower(p.owner_email)=lower(c.owner_email)), 0)::int as paid
from referral_codes c
left join referrals r on r.code = c.code
group by c.owner_email;

-- 4c) Souhrn check-inu per klient v SQL (zadny 1000-row strop PostgREST)
--     (telo viz zive DB: admin_checkins_overview() — first/last vaha+pas, avg adherence)
-- 4d) Pocty leadu per track: admin_leads_by_track()
-- 4e) DEDUP INDEX PER-TRACK: email_events_lead_step_sent_uniq NAHRAZEN indexem
--     email_events_lead_step_track_sent_uniq (lead_id, step, detail->>'track') where type='sent'
--     -> po preradeni leadu do jine sekvence se odeslane maily normalne loguji
--     (drive kolize s eventy stareho tracku = neviditelne maily + dira v idempotenci).
