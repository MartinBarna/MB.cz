-- =============================================================================
-- `consultation_intake.obsah_hash`: IDEMPOTENCE DOTAZNÍKU (dávka 2, 17. 9. 2026, D/N14)
--
-- ⛔ SPUSTIT PŘED DEPLOYEM nové verze `intake-capture`. Bez sloupce skončí insert
--    chybou PostgREST („column obsah_hash does not exist") a dotazník by se NEULOŽIL.
--    To je nejdražší možné selhání téhle cesty: člověk platil 2 990 Kč za konzultaci.
--
-- CO SE OPRAVUJE
-- `intake-capture` neměla idempotenci, jen rate limit 5 odeslání na e-mail za 24 h
-- (`index.ts`, EMAIL_DAY_MAX). Pět odeslání = pět mailů Martinovi a on nepozná, který
-- je čerstvější, dokud je neotevře. Změřeno 17. 9. 2026: `consultation_intake` má
-- 2 řádky (12. a 15. 9.), takže se zatím nic dočišťovat nemusí.
--
-- ⛔⛔ KLÍČ JE OBSAH, NE ČAS: stejná adresa + stejné odpovědi do 24 h = žádný druhý
--    mail; stejná adresa + JINÉ odpovědi = mail odejde. Opravený dotazník se k Martinovi
--    dostat MUSÍ, čte si ho před placeným hovorem. Zdůvodnění je v `functions/intake-capture/otisk.ts`.
-- ⚠️ Řádek v DB vzniká VŽDY, i u duplicity. Databáze je zdroj pravdy; ztratit odeslání
--    kvůli tichému mailu by bylo horší než mail navíc.
-- ⚠️ Sloupec je NULLABLE schválně: starší řádky ho nemají a nová verze ho nechá prázdný,
--    když se otisk nepodaří spočítat. Prázdný otisk znamená „neporovnávám", ne „duplicita".
--
-- Spouští se ručně přes MCP apply_migration v DB Academy (uhmrpfsdcujbhbtumqye).
-- =============================================================================

alter table public.consultation_intake
  add column if not exists obsah_hash text;

comment on column public.consultation_intake.obsah_hash is
  'SHA-256 normalizovanych odpovedi. Stejny hash u tehoz e-mailu do 24 h = duplicitni odeslani, Martinovi uz druhy mail nejde (nalez D/N14).';

-- Dotaz, který nová verze dělá: „má tahle adresa za posledních 24 h řádek s týmž otiskem?"
create index if not exists consultation_intake_email_hash
  on public.consultation_intake (email, obsah_hash, created_at desc);

-- Kontrola po zásahu:
--   select column_name from information_schema.columns
--    where table_schema='public' and table_name='consultation_intake' and column_name='obsah_hash';
--   select indexname from pg_indexes where tablename='consultation_intake';
--
-- Měření po nasazení (kolik odeslání bylo duplicitních):
--   select email, obsah_hash, count(*) n, min(created_at), max(created_at)
--     from public.consultation_intake
--    where obsah_hash is not null and created_at > now() - interval '30 days'
--    group by 1,2 having count(*) > 1;
--
-- Návrat: drop index if exists public.consultation_intake_email_hash;
--         alter table public.consultation_intake drop column if exists obsah_hash;
