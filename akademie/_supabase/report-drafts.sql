-- =============================================================================
-- KONCEPT ODPOVĚDI NA TÝDENNÍ REPORT (bod E1 revize z 1. 9. 2026)
--
-- Proč: odpověď na report je Martinova největší opakovaná časová položka u koučinku.
-- AI připraví KONCEPT, Martin ho v adminu přečte, upraví a odešle sám ze své schránky.
-- ⛔ Nic z téhle tabulky NIKDY neodchází klientovi. Odesílá výhradně člověk, ručně.
--
-- Kdo co smí:
--   • klient        = nic, tabulku vůbec nevidí (žádná policy = RLS ji zavře)
--   • Martin        = přes edge fn `admin-api` (service_role), akce `report_draft`
--   • anon / authenticated = nic, granty odebrány (viz níž, není to jen RLS)
--
-- ⛔ POZOR na past z 27. 8. 2026: `revoke ... from anon` sám o sobě nestačí, když grant
-- visí na roli PUBLIC. Revokuje se proto z `public, anon, authenticated` naráz.
-- Obecné pravidlo: `feedback-postgres-grant-public-vs-anon`.
--
-- ADITIVNÍ: nic nemaže, nic nepřepisuje. Aplikuje se ručně v SQL editoru Supabase
-- (projekt Barna Academy `uhmrpfsdcujbhbtumqye`).
-- =============================================================================

create table if not exists public.report_drafts (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references public.client_reports(id) on delete cascade,
  client_email text not null,
  draft        text not null,
  -- meta: {model, provider, tema, upozorneni[], navrh_zmen, fakta{}} — na dohledání,
  -- podle čeho koncept vznikl. Není to zdroj pravdy o klientovi, jen otisk vstupu.
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

comment on table public.report_drafts is
  'Koncepty odpovědí na klientské reporty (AI připraví, Martin upraví a ODESÍLÁ SÁM). Nikdy se z ní nic neposílá automaticky.';

-- Ochrana nákladu: podle tohohle indexu se hledá poslední koncept k reportu (limit 1 za 10 min).
create index if not exists report_drafts_report_idx
  on public.report_drafts (report_id, created_at desc);

alter table public.report_drafts enable row level security;

-- ⛔ ŽÁDNÁ policy schválně: RLS bez policy = čte a píše jen service_role (edge funkce).
-- Kdo sem někdy policy přidá, ať si nejdřív přečte hlavičku téhle migrace.
revoke all on public.report_drafts from public, anon, authenticated;
