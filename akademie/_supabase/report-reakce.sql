-- =============================================================================
-- FRONTA „REPORTY KE ZPRACOVÁNÍ" (2. 9. 2026)
--
-- Proč: koncept odpovědi (`report_drafts`) existuje od 1. 9., ale nikde nebylo vidět,
-- na KTERÝ report se ještě neodpovědělo. Martin odpovídá ze své schránky, takže systém
-- se to jinak nedozví. Odsud ten ruční příznak: Martin po odeslání klikne „Odesláno".
--
-- ⛔ Je to ZÁZNAM O RUČNÍM ÚKONU, ne stav odeslání. Nic ho nenastavuje automaticky
-- a nic podle něj nic neodesílá. Prázdná hodnota tedy neznamená „klient nedostal
-- odpověď", znamená „Martin to tady neodklikl".
--
-- ADITIVNÍ: přidává jeden nullable sloupec. Nic nemaže, nic nepřepisuje, stará data
-- zůstávají s NULL. Aplikuje se ručně v SQL editoru Supabase
-- (projekt Barna Academy `uhmrpfsdcujbhbtumqye`).
-- =============================================================================

alter table public.client_reports
  add column if not exists reakce_odeslana timestamptz;

comment on column public.client_reports.reakce_odeslana is
  'Kdy Martin v adminu odklikl, ze na tenhle report uz odpovedel. Rucni priznak, nic ho nenastavuje samo. NULL = neodkliknuto (ne nutne neodpovezeno).';

-- ⛔⛔ ZPĚTNÉ DOPLNĚNÍ. Bez něj by fronta v den nasazení ukázala 30 nejnovějších reportů,
-- na které Martin dávno odpověděl (změřeno 2. 9. 2026 v živé DB: 73 reportů celkem, z toho
-- jen 9 mladších čtrnácti dnů). Nástroj, který má říkat „na tohle jsi neodpověděl", by tak
-- první obrazovkou lhal a ztratil by důvěru dřív, než by ji získal.
--
-- Hranice je 14 dní: co je starší, bere se za vyřízené; co je mladší, zůstane ve frontě,
-- protože tam Martin opravdu může mít rozdělanou práci. Čas se bere z reportu, ne z `now()`,
-- ať to v datech nevypadá, že Martin odpověděl 64 lidem v jedné vteřině při migraci.
--
-- IDEMPOTENTNÍ: podmínka `reakce_odeslana is null` znamená, že druhé spuštění nic nepřepíše,
-- a ručně odznačený report (Martin si ho vrátí do fronty) se opakovaným během nezruší,
-- dokud je mladší než 14 dní. ⛔ Pouštět PŘED `create index`, jinak se index staví nad daty,
-- která se hned poté celá vyprázdní.
update public.client_reports
   set reakce_odeslana = (report_date + interval '1 day')
 where reakce_odeslana is null
   and report_date < current_date - interval '14 days';

-- Podle tohohle indexu se tahá fronta „co ještě čeká". Bez něj by se s rostoucím počtem
-- reportů skenovala celá tabulka při každém otevření karty Klienti.
create index if not exists client_reports_ceka_idx
  on public.client_reports (report_date desc)
  where reakce_odeslana is null;

-- ⛔ ŽÁDNÉ NOVÉ GRANTY. Sloupec se čte a píše jedině přes edge fn `admin-api`
-- (service_role). Klientská sekce čte `client_reports` přes svoje stávající policy
-- a tenhle sloupec ji nezajímá; kdyby ho někdo chtěl klientovi ukázat, ať si nejdřív
-- rozmyslí, že „neodkliknuto" neznamená „Martin ti neodpověděl".
