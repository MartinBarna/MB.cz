-- =============================================================================
-- TEXTY K NUTRIČNÍMU PRŮVODCI NA MÍRU (editor v kartě klienta, 2. 9. 2026)
--
-- Proč: psaní jídelníčku pro nového klienta dělal dosud Claude ručně. Editor v adminu
-- to skládá sám: čísla a dny počítá generátor (`assets/meal-gen.js`), texty píše AI
-- a Martin je přepíše. Tahle tabulka drží AI koncepty textů.
--
-- ⛔ Nic z téhle tabulky NIKDY neodchází klientovi. Hotový dokument nahrává Martin
-- klikem do bucketu `client-docs` a odkaz posílá sám. Admin sám neposílá nic.
--
-- Kdo co smí:
--   • klient        = nic, tabulku vůbec nevidí (žádná policy = RLS ji zavře)
--   • Martin        = přes edge fn `admin-api` (service_role), akce `pruvodce_text`
--   • anon / authenticated = nic, granty odebrány (viz níž, není to jen RLS)
--
-- ⛔ POZOR na past z 27. 8. 2026: `revoke ... from anon` sám o sobě nestačí, když grant
-- visí na roli PUBLIC. Revokuje se proto z `public, anon, authenticated` naráz.
-- Obecné pravidlo: `feedback-postgres-grant-public-vs-anon`.
--
-- ADITIVNÍ: nic nemaže, nic nepřepisuje. Aplikuje se ručně v SQL editoru Supabase
-- (projekt Barna Academy `uhmrpfsdcujbhbtumqye`).
-- =============================================================================

create table if not exists public.pruvodce_drafts (
  id           uuid primary key default gen_random_uuid(),
  client_email text not null,
  -- {uvod, proc_tyhle_tri, zadani_navic, na_zaver}
  texty        jsonb not null default '{}'::jsonb,
  -- ⛔ NÁVRH, ne filtr. Výrazy z volného textu dotazníku („ořech", „jogurt"), které admin
  -- rozbalí na konkrétní potraviny a Martin je odklikne. Do generátoru jde jen odkliknuté.
  vylouceni_navrh jsonb not null default '[]'::jsonb,
  -- meta: {model, provider, upozorneni[], fakta{}}, otisk toho, z čeho koncept vznikl
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

comment on table public.pruvodce_drafts is
  'AI koncepty textů do nutričního průvodce na míru (Martin je přepíše a dokument uloží sám). Nikdy se z ní nic neposílá.';

-- Ochrana nákladu: podle tohohle indexu se hledá poslední koncept klienta (limit 1 za 10 min).
create index if not exists pruvodce_drafts_email_idx
  on public.pruvodce_drafts (client_email, created_at desc);

alter table public.pruvodce_drafts enable row level security;

-- ⛔ ŽÁDNÁ policy schválně: RLS bez policy = čte a píše jen service_role (edge funkce).
-- Kdo sem někdy policy přidá, ať si nejdřív přečte hlavičku téhle migrace.
revoke all on public.pruvodce_drafts from public, anon, authenticated;
