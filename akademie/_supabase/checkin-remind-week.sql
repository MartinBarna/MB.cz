-- =============================================================================
-- Pondělní připomínka check-inu: paměť týdne na discount_credits.
--
-- NESPOUŠTĚT, dokud Martin nedá GO přes DEPLOY-ZAMEK.
-- Pořadí nasazení: nejdřív tenhle SQL, potom edge funkce checkin-capture.
-- Bez sloupce remind režim vrátí 500 a neodešle nic (žádná tichá duplicita).
--
-- Co sloupec dělá: ISO týden poslední rezervace, třeba 2026-W44.
-- Stejný týden = člověk už připomínku dostal, nebo rezervace po nejistém
-- odeslání drží a další běh ho přeskočí. Prázdné = ještě nedostal, jde první.
-- Žádný backfill. Existující kupci z tohohle souboru mail nedostanou.
-- =============================================================================

alter table public.discount_credits
  add column if not exists reminded_week text;

comment on column public.discount_credits.reminded_week is
  'ISO tyden posledni rezervace pondelni pripominky check-inu (2026-W44). Prazdne = jeste nebyla. Stejny tyden = preskocit.';
