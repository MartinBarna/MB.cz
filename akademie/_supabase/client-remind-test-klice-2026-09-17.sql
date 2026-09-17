-- =============================================================================
-- client-remind: TESTOVACÍ REŽIM MÁ VLASTNÍ PAMĚŤ (dávka 2, 17. 9. 2026, nález V2)
--
-- ⛔ SPUSTIT PŘED DEPLOYEM nové verze `client-remind`. Bez tohohle rozšíření skončí
--    zápis testovacího běhu chybou `23514 client_remind_sent_kind_check` (změřeno
--    17. 9. 2026: `CHECK ((kind = ANY (ARRAY['report'::text, 'register'::text])))`).
--
-- CO SE OPRAVUJE
-- Testovací režim (`{"test_email":"…"}`) přeskakoval kontrolu „už dostal nedávno"
-- a nezapisoval NIC. Ochrana „nerozesílat klientům" a ochrana „neposlat totéž dvakrát"
-- se tím slily do jedné podmínky: každé další spuštění poslalo další mail a nikde
-- po tom nezbyla stopa. Přesně tohle vyrobilo „duplicitu" 16. 9. 2026.
--
-- ⛔⛔ KLÍČ MUSÍ BÝT ODDĚLENÝ (`test:report`, `test:register`), NE `report`.
--    Kdyby test psal ostrý druh, umlčel by nedělní mail skutečnému klientovi.
--    To by byla vážnější vada než ta, kterou to opravuje.
-- ⚠️ Testovací klíče schválně NESPADAJÍ pod unikátní index `client_remind_sent_unique_den`
--    (ten je partial, jen `kind in ('report','register')`). Test se smí opakovat,
--    hlídá ho hodinová pojistka v kódu a vědomé přebití `{"test_znovu":true}`.
--
-- Spouští se ručně přes MCP apply_migration v DB Academy (uhmrpfsdcujbhbtumqye).
-- =============================================================================

alter table public.client_remind_sent
  drop constraint if exists client_remind_sent_kind_check;

alter table public.client_remind_sent
  add constraint client_remind_sent_kind_check
  check (kind in ('report', 'register', 'test:report', 'test:register'));

-- Kontrola po zásahu (čekám čtyři hodnoty ve výčtu):
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.client_remind_sent'::regclass and conname = 'client_remind_sent_kind_check';
--
-- Návrat (⛔ spadne, pokud už v tabulce testovací řádky jsou; nejdřív je smazat):
--   delete from public.client_remind_sent where kind like 'test:%';
--   alter table public.client_remind_sent drop constraint client_remind_sent_kind_check;
--   alter table public.client_remind_sent add constraint client_remind_sent_kind_check
--     check (kind in ('report', 'register'));
