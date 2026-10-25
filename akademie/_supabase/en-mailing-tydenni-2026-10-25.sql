-- EN mailing: týdenní kroky 6 až 41 (25. 10. 2026).
--
-- en-mailing-2026-10-13.sql založil en_mail_log.step s nepojmenovaným CHECK
--   step int not null check (step between 1 and 5)
-- PostgreSQL mu dá výchozí jméno en_mail_log_step_check. Bez výměny insert kroku 6
-- spadne na 23514, razítko se nezapíše a mail neodejde (razítko je před Resendem).
--
-- Tahle migrace jen ten CHECK vymění. Žádná nová tabulka, žádný cron, vypínač se nemění.
-- Když CHECK v živé DB dostal jiné automatické jméno, blok níž ho najde podle definice
-- (contype = 'c' a pg_get_constraintdef obsahuje 'step') a zahodí ho.
-- Nový constraint se jmenuje en_mail_log_step_check (between 1 and 41).
--
-- Idempotentní: opakované spuštění ten samý check najde, zahodí a založí znovu.
-- Pořadí: nejdřív en-mailing-2026-10-13.sql (tabulka), pak tenhle soubor, pak deploy funkce.
-- Samo od sebe se nespouští.

do $$
declare cname text;
begin
  for cname in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.en_mail_log'::regclass
      and c.contype = 'c'
      and position('step' in pg_get_constraintdef(c.oid)) > 0
  loop
    execute format('alter table public.en_mail_log drop constraint %I', cname);
  end loop;
end $$;

alter table public.en_mail_log
  add constraint en_mail_log_step_check
  check (step between 1 and 41);

-- Ověření po aplikaci (jen čtení):
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.en_mail_log'::regclass and contype = 'c'
--      and position('step' in pg_get_constraintdef(oid)) > 0;
--   čekám jeden řádek: en_mail_log_step_check, CHECK ((step >= 1) AND (step <= 41))
