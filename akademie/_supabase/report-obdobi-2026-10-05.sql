-- =============================================================================
-- OBDOBÍ REPORTU A KADENCE REPORTŮ (5. 10. 2026, Martin: „od reportu po report,
-- ať to bere samo" + rozhodnutí 2: „report každý 1/2/3 týden" a „další report dne")
--
-- CO PŘIBÝVÁ (jen nullable sloupce, nic se nepřepisuje ani nemaže):
--   client_reports.obdobi_od, obdobi_do (date)
--     Za jaké dny report je (7 až 28 dní). Ukládá `client-report` podle formuláře.
--     NULL = starý report nebo report ze staré stránky / náhradního režimu: bere se
--     jako jeden týden Po až Ne podle pravidla „datum reportu − 3 dny"
--     (`_shared/report-obdobi.ts`, funkce `obdobiRadku`).
--     PROČ sloupec a ne `nutrition.obdobi`: při „stravu jsem nezapisoval" je `nutrition`
--     NULL, a období se týká i aktivity a měr.
--   entitlements.report_kadence (smallint 1 až 3) a dalsi_report (date)
--     Kadence reportů klienta a ručně posunutý další report („nejdřív", dovolená).
--     Řídí JEN připomínky a hlídání (`client-remind`, `daily-digest`, sync z appky),
--     období reportu se počítá samo. NULL = týden (nebo starý seznam client_remind_14d).
--     PROČ v `entitlements`: `client-remind` tenhle řádek UŽ čte (týmž dotazem jako
--     `start_at`), takže nepřibude žádné čtení navíc (Free plán, 504 brány).
--
-- ⛔ BEZPEČNOST ZMĚNY (ověřeno v živé DB 5. 10. 2026 dopoledne):
--   - `client_reports` nemá žádný trigger ani CHECK; má PK (id), unikátní index
--     (email, report_date) a RLS (vlastní čtení + admin čtení). Nové sloupce dědí RLS:
--     klient si přečte období SVÝCH reportů, což klientská sekce potřebuje.
--   - `entitlements` má trigger `trg_enroll_manual_grant` (AFTER INSERT OR UPDATE),
--     ALTER TABLE ho nespouští a zápis kadence do KOUČINKOVÉHO řádku ho propustí hned
--     (funkce bere jen produkty academy a videokurz). RLS `entitlements_select_own`:
--     klient si přečte svou kadenci a termín, není to citlivý údaj (stejně jako start_at).
--   - CHECK na kadenci se zakládá BEZ `NOT VALID` a nad sloupcem, který je v každém
--     řádku NULL: validace projde a žádný pozdější UPDATE jiného sloupce ho nemůže
--     shodit (past `feedback-check-not-valid-shodi-hromadny-update`: tam šlo o CHECK
--     nad starými daty, tady staré hodnoty neexistují).
--   - Bez defaultů: přidání sloupců je jen změna katalogu, tabulka se nepřepisuje.
--
-- IDEMPOTENTNÍ: `add column if not exists`, CHECK jen když ještě neexistuje. Bez vlastního
-- begin/commit, stejně jako `davka9-start-koucinku-2026-09-15.sql`. Každý příkaz je sám
-- idempotentní, takže kdyby spuštění spadlo v půlce, jde soubor bezpečně pustit znovu.
-- Spouští se ručně v Academy (uhmrpfsdcujbhbtumqye): MCP `apply_migration`
-- s project_id uhmrpfsdcujbhbtumqye, nebo
-- `npx supabase@latest db query --linked --project-ref uhmrpfsdcujbhbtumqye --file …`
-- (⛔ nikdy `db push`, ⛔ nikdy bez --project-ref).
--
-- ⛔ POŘADÍ: TAHLE MIGRACE JDE PRVNÍ. Až po ní edge funkce `client-report`, `client-remind`,
--    `admin-api`, `tc-client-reports-sync`, `daily-digest` a nakonec web. Funkce i stránka
--    nové sloupce čtou; bez nich by čtení spadlo (u `client-remind` = nikdo nedostane výzvu).
-- =============================================================================

alter table public.client_reports
  add column if not exists obdobi_od date,
  add column if not exists obdobi_do date;

comment on column public.client_reports.obdobi_od is
  'První den období, za které report je (od 5. 10. 2026). NULL = starý report: jeden týden Po až Ne podle pravidla datum reportu − 3 dny. Pravidlo: _shared/report-obdobi.ts.';
comment on column public.client_reports.obdobi_do is
  'Poslední den období reportu (nejdál den odeslání). NULL = starý report, viz obdobi_od.';

alter table public.entitlements
  add column if not exists report_kadence smallint,
  add column if not exists dalsi_report date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'entitlements_report_kadence_check'
       and conrelid = 'public.entitlements'::regclass
  ) then
    alter table public.entitlements
      add constraint entitlements_report_kadence_check
      check (report_kadence is null or report_kadence between 1 and 3);
  end if;
end
$$;

comment on column public.entitlements.report_kadence is
  'Kadence reportů klienta koučinku v týdnech (1, 2, 3), nastavuje admin (client_report_plan_save). NULL = týden, nebo 2 týdny, je-li e-mail v app_config.client_remind_14d. Řídí jen připomínky a hlídání.';
comment on column public.entitlements.dalsi_report is
  'Ručně posunutý další report („nejdřív", typicky dovolená). Termín jen posouvá dál, po dalším reportu přestane platit sám. NULL = podle kadence.';

-- PostgREST si drží schéma v cache. Bez tohohle vrací nové sloupce chybu ještě pár minut
-- po migraci a funkce by spadly i nad hotovou databází.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- KONTROLA PO MIGRACI (jen čtení, spustit zvlášť):
--   select table_name, column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public'
--      and ((table_name = 'client_reports' and column_name in ('obdobi_od','obdobi_do'))
--        or (table_name = 'entitlements' and column_name in ('report_kadence','dalsi_report')));
--   -- čeká se 4 řádky, všechny is_nullable = YES
--   select conname, pg_get_constraintdef(oid), convalidated
--     from pg_constraint where conname = 'entitlements_report_kadence_check';
--   -- čeká se 1 řádek, convalidated = true
-- ---------------------------------------------------------------------------
