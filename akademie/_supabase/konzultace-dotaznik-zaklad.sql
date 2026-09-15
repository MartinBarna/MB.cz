-- Dotazník před konzultací: základní čísla pro odhad výdeje (15. 9. 2026).
-- Navazuje na `konzultace-dotaznik.sql`, tabulka i edge funkce `intake-capture` už existují.
--
-- PROČ: dotazník sbíral váhu, cíl a volný text, ale ne věk, výšku ani pohlaví. Martin tedy
-- šel na placený hovor bez čísel, ze kterých se výdej počítá, a pohlaví si admin dodnes
-- hádá z příjmení (`onboarding.js`); špatný odhad posune Mifflina o 166 kcal.
-- Kroky za den jsou tu ze stejného důvodu: bez nich nejde výdej odhadnout ani hrubě.
--
-- ⛔⛔ ŽÁDNÉ ZDRAVOTNÍ POLE. Platí beze změny to, co je napsané v `konzultace-dotaznik.sql`:
-- údaje o zdraví jsou podle GDPR zvláštní kategorie a řeší se NA HOVORU, ne v tabulce.
-- Věk, výška, pohlaví a kroky zvláštní kategorie nejsou, proto je sem doplnit lze.
--
-- ⚠️ Všechny čtyři sloupce jsou NULLABLE schválně: pole jsou v dotazníku nepovinná a server
-- (`celeCislo` v `cisla.ts`) zahodí nesmysl na null. Povinnost by znamenala, že člověk
-- dotazník neodešle vůbec, a Martin by neměl ani to, co vyplnil.
--
-- Idempotentní, pouští se opakovaně bez škody.
alter table public.consultation_intake
  add column if not exists age            smallint,   -- 15-90, validuje server
  add column if not exists height_cm      smallint,   -- 120-230 cm, validuje server
  add column if not exists sex            text,       -- 'm' / 'z' / null (nevybráno)
  add column if not exists steps_per_day  integer;    -- 0-60000, validuje server

-- Podmínka je záchranná síť pro případ, že by se sem někdy psalo mimo `intake-capture`.
-- `not valid` schválně: existující řádky mají všude null a kontrolovat se nemusí.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.consultation_intake'::regclass and conname = 'consultation_intake_sex_chk'
  ) then
    alter table public.consultation_intake
      add constraint consultation_intake_sex_chk check (sex in ('m','z') or sex is null) not valid;
  end if;
end $$;

-- ⛔ RLS zůstává beze změny: tabulka nemá žádnou politiku, čte a píše do ní jen service_role.
