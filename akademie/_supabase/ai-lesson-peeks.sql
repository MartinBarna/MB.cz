-- =============================================================================
-- Strop nakouknutí lekcí pro klienty koučinku (25. 7. 2026, zadal Martin)
--
-- Proč: AI Martin otevírá klientovi koučinku lekce, na které sám odkáže (peek odkazy,
-- viz `ai-martin/index.ts` + edge fn `lesson-peek`). Bez stropu ale platilo
-- „nepustíme ho do celé Academy" jen společensky: 3 lekce na odpověď × 60 zpráv denně
-- = 180 odkazů za den, přičemž Academy má 256 lekcí. U devíti klientů, kteří znají
-- Martina osobně, to nevadilo; s reklamami a růstem by to byla díra.
--
-- Co to dělá: eviduje RŮZNÉ lekce odemčené danému klientovi. Strop (PEEK_BUDGET
-- v edge funkci, dnes 25) omezuje ŠÍŘKU, ne opakované čtení: už odemčená lekce se
-- do stropu podruhé nepočítá, klient se k ní smí vracet.
--
-- ⛔ OCHRANA: RLS zapnuté BEZ JEDINÉ POLICY = fail closed. Tohle je to, co tabulku
-- chrání, NE granty. Supabase rozdává roli `anon` INSERT/UPDATE/DELETE na každou novou
-- tabulku ve schématu `public` automaticky. Čte a píše sem výhradně service_role
-- (edge funkce). Kdo sem přidá policy, otevře to i anonymům.
-- Obecné pravidlo: `feedback-supabase-grant-neni-ochrana` ve společné paměti.
--
-- ADITIVNÍ: nic nemaže, nic nepřepisuje.
-- =============================================================================

create table if not exists public.ai_lesson_peeks (
  email     text        not null,
  lesson_id text        not null,
  first_at  timestamptz not null default now(),
  primary key (email, lesson_id)
);

comment on table public.ai_lesson_peeks is
  'Ktere lekce uz AI Martin odemkl klientovi koucinku (peek). Strop je v edge fn ai-martin (PEEK_BUDGET). Pise a cte jen service_role.';

alter table public.ai_lesson_peeks enable row level security;

-- Rychlé počítání stropu na jednoho klienta.
create index if not exists ai_lesson_peeks_email_idx on public.ai_lesson_peeks (email);
