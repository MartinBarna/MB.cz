-- =============================================================================
-- client-remind, KROK 2 ze 2: cron na NEDĚLI + dva opakovací běhy. ⛔ Spustit AŽ PO deployi
-- nové funkce client-remind (ta je idempotentní přes client_remind_sent z kroku 1). Kdyby se
-- pustil dřív, stará funkce by v neděli poslala až tři maily každému klientovi.
--
-- ⚠️ pg_cron běží v UTC: `0 1` = 03:00 v letním čase, 02:00 v zimním (stejně jako dosavadní
--    pondělní běh). Kdo chce zimní 03:00, přehodí po 25. 10. 2026 na `0 2`, `30 2`, `0 3`.
-- ⚠️ Job se hledá podle JMÉNA, ne podle jobid: číslo v gitu nikde není a špatné číslo by
--    přehodilo cizí job (drip-send, splátky) na neděli. Když jméno neexistuje, alter_job
--    spadne s chybou, nic se nepřepíše.
-- =============================================================================
select cron.alter_job(
  (select jobid from cron.job where jobname = 'client-remind-weekly'),
  schedule := '0 1 * * 0'
);

-- cron.schedule se stejným jménem existující job přepíše (upsert podle jobname), takže je
-- skript bezpečný i při druhém spuštění.
select cron.schedule(
  'client-remind-weekly-2',
  '30 1 * * 0',
  $cmd$
  select net.http_post(
    url := 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/client-remind',
    headers := jsonb_build_object('Content-Type','application/json','x-drip-secret',(select value from public.app_config where key='drip_invoke_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cmd$
);

select cron.schedule(
  'client-remind-weekly-3',
  '0 2 * * 0',
  $cmd$
  select net.http_post(
    url := 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/client-remind',
    headers := jsonb_build_object('Content-Type','application/json','x-drip-secret',(select value from public.app_config where key='drip_invoke_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cmd$
);

-- Kontrola po zásahu (čekám 3 řádky, všechny neděle):
-- select jobid, jobname, schedule from cron.job where jobname like 'client-remind%';
-- Návrat: select cron.alter_job((select jobid from cron.job where jobname='client-remind-weekly'), schedule := '0 1 * * 1');
--         select cron.unschedule('client-remind-weekly-2'); select cron.unschedule('client-remind-weekly-3');
