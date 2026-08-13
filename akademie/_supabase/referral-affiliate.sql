-- =========================================================
-- Affiliate / Referral systém (#39) — Barna Academy & Videokurz
-- Aplikováno na projekt uhmrpfsdcujbhbtumqye přes Supabase MCP (apply_migration).
-- Návrh: akademie/_ai/affiliate-system-design.md
-- Edge funkce: functions/referral-code, functions/referral-webhook
-- =========================================================

-- 1) Kódy referrerů --------------------------------------------------
create table if not exists public.referral_codes (
  code         text primary key,                  -- napr. 'BARNA-A7K2'
  owner_email  text not null,                      -- vlastnik kodu (lowercase)
  created_at   timestamptz not null default now(),
  active       boolean not null default true
);
create unique index if not exists referral_codes_owner_uidx
  on public.referral_codes (lower(owner_email));   -- 1 kod na osobu

-- 2) Jednotlivé doporučené nákupy ------------------------------------
create table if not exists public.referrals (
  id            bigint generated always as identity primary key,
  code          text not null references public.referral_codes(code),
  buyer_email   text not null,
  product       text not null check (product in ('academy','videokurz')),
  amount        numeric(10,2),
  order_id      text,
  source        text not null default 'coupon' check (source in ('coupon','self_report','manual')),
  status        text not null default 'pending' check (status in ('pending','confirmed','void')),
  reward_type   text not null default 'credit' check (reward_type in ('credit','free_month','cash')),
  reward_amount numeric(10,2) not null default 0,
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz
);
create unique index if not exists referrals_order_uidx
  on public.referrals (order_id) where order_id is not null;       -- idempotence webhooku
create unique index if not exists referrals_buyer_product_uidx
  on public.referrals (lower(buyer_email), product);               -- 1x na kupujiciho a produkt
create index if not exists referrals_code_idx on public.referrals (code);

-- 3) Saldo kreditu (agregace) — view, nic se nesynchronizuje ---------
create or replace view public.referral_credit
with (security_invoker = on) as
select
  rc.owner_email,
  coalesce(sum(r.reward_amount) filter (where r.status='confirmed' and r.reward_type='credit'),0) as credit_confirmed,
  coalesce(sum(r.reward_amount) filter (where r.status='pending' and r.reward_type='credit'),0)   as credit_pending,
  count(r.id) filter (where r.status='confirmed') as referrals_confirmed,
  count(r.id) filter (where r.status='pending')   as referrals_pending
from public.referral_codes rc
left join public.referrals r on r.code = rc.code
group by rc.owner_email;

-- 4) RLS — referrer vidí jen SVOJE přes e-mail z JWT -----------------
alter table public.referral_codes enable row level security;
alter table public.referrals      enable row level security;

drop policy if exists referral_codes_owner_select on public.referral_codes;
create policy referral_codes_owner_select on public.referral_codes
  for select to authenticated
  using (lower(owner_email) = lower(auth.jwt() ->> 'email'));

drop policy if exists referrals_owner_select on public.referrals;
create policy referrals_owner_select on public.referrals
  for select to authenticated
  using (code in (select code from public.referral_codes
                  where lower(owner_email) = lower(auth.jwt() ->> 'email')));
-- ZÁPIS jen přes service_role (edge funkce). Web čte jen agregace.

-- 5) Surový log webhook payloadů (zjištění názvu pole s kupónem) ------
create table if not exists public.referral_webhook_log (
  id          bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  matched     boolean not null default false,
  note        text,
  payload     jsonb
);
alter table public.referral_webhook_log enable row level security;
-- bez policy: čitelné jen service rolí (Martin přes SQL / dashboard)

-- 6) Auto-confirm po 14denní nevratné lhůtě (pg_cron) ----------------
-- Self-report zůstává 'pending' do ručního schválení (anti-abuse).
-- ⛔ POZOR: tenhle soubor byl do 13. 8. 2026 POZADU za živou DB (chyběla mu celá
--    podmínka na `entitlements`, kterou někdo doplnil přímo v DB). Kdo ho nasadí
--    z repa bez porovnání proti `pg_get_functiondef`, tu ochranu SMAŽE.
--    Viz [[feedback-sql-soubor-v-repu-muze-byt-pozadu]]. Níž je stav shodný s produkcí
--    k 13. 8. 2026 19:5x.
create or replace function public.referral_confirm_due() returns void
language sql security definer set search_path = public as $$
  -- Auto-confirm po 14denní nevratné lhůtě. Self-report zůstává 'pending' (anti-abuse).
  update public.referrals r
     set status='confirmed', confirmed_at=now()
   where r.status='pending'
     and r.source='coupon'
     and r.created_at < now() - interval '14 days'
     and (
       -- APPKA (předplatné Tvůj Coach) nemá a nikdy nebude mít řádek v `entitlements`:
       -- žije v JINÉM Supabase projektu (kfkmghvhqwqtsalqjmrp) a mezi projekty tu není
       -- žádná cesta (v Academy není dblink ani postgres_fdw). Bez téhle větve zůstala
       -- provize za appku 'pending' NAVŽDY a partnerovi se nikdy nevyplatila.
       -- Dokladem o nákupu je sám řádek: zapsal ho most `app-purchase-bridge` až POTÉ,
       -- co Stripe potvrdil zaplacení. 14denní lhůta platí stejně jako u ostatních.
       -- ⚠️ ZNÁMÁ MEZERA: refund appky se do Academy nepropisuje, takže vrácený nákup
       -- se po 14 dnech potvrdí taky. Rozhodnutí Martina 13. 8. 2026.
       r.product = 'appka'
       or exists (
         select 1 from public.entitlements e
         where lower(e.email) = lower(r.buyer_email)
           and e.active = true
           and (e.product = r.product
                or (r.product = 'videokurz' and e.product in ('academy','coaching')))
       )
     );
$$;
select cron.unschedule(jobid) from cron.job where jobname='referral_confirm_daily';
select cron.schedule('referral_confirm_daily', '17 3 * * *', $$select public.referral_confirm_due();$$);
