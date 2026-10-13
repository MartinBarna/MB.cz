-- en_leads.kind: přidat 'calculator' a 'workout' (13. 10. 2026, větev en-nastroje-1013).
--
-- Původní definice v en-leads-2026-10-13.sql je nepojmenovaný CHECK na sloupci kind:
--   kind text not null check (kind in ('kit', 'application'))
-- PostgreSQL mu dá výchozí jméno en_leads_kind_check (tabulka_sloupec_check).
-- Tahle migrace jen ten CHECK vymění. Žádný nový sloupec. plan_summary z /en/workout/
-- se ukládá do existujícího sloupce message (viz en-lead/index.ts).
--
-- Pořadí: nejdřív en-leads-2026-10-13.sql (tabulka), pak tenhle soubor, pak funkce en-lead.
-- Když CHECK v živé DB dostal jiné automatické jméno, blok níž ho najde podle definice
-- a zahodí ho, a nový constraint se jmenuje en_leads_kind_check.

do $$
declare cname text;
begin
  select c.conname into cname
  from pg_constraint c
  where c.conrelid = 'public.en_leads'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%kind%'
  limit 1;
  if cname is not null then
    execute format('alter table public.en_leads drop constraint %I', cname);
  end if;
end $$;

alter table public.en_leads
  add constraint en_leads_kind_check
  check (kind in ('kit', 'application', 'calculator', 'workout'));
