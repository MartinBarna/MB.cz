-- =============================================================================
-- KONEC KOUČINKU, KROK 3 ze 3: denní cron.
--
-- ⛔ POŘADÍ NASAZENÍ (přeskočit krok = tichá škoda):
--    1. `koucink-konec-2026-09-22.sql`  (tabulka razítek + konfigurace)
--    2. deploy edge funkcí `koucink-konec` a `admin-api`
--    3. tenhle skript
--    Kdyby se cron pustil dřív než migrace, funkce by na každém člověku spadla
--    na neexistující tabulce; kdyby se pustil dřív než deploy, volal by 404.
--
-- ⛔ AUTOMAT SE TÍMHLE SKRIPTEM JEŠTĚ NEZAPNE. Funkce bez
--    `app_config.koucink_konec_enabled = 'true'` vrátí `{"vypnuto": true}` a
--    nic neudělá. Zapnutí je vlastní, vědomý krok:
--       update public.app_config set value = 'true' where key = 'koucink_konec_enabled';
--    Než ho Martin udělá, ať si pustí běh nanečisto (viz konec souboru).
--
-- ⚠️ JEDEN BĚH DENNĚ, ŽÁDNÉ OPAKOVACÍ BĚHY. `client-remind` je má, protože nedělní
--    připomínka poslaná o den později ztrácí smysl. Tady je to naopak: rozloučení
--    o den později nikomu nevadí, zatímco tři běhy za noc znamenají tři příležitosti,
--    jak poslat mail navíc. Frontu na opakování si automat drží sám
--    (`koucink_konec_sent.stav = 'opakovat'`) a vezme ji další den.
--
-- ⚠️ pg_cron běží v UTC: `0 7` = 09:00 v letním čase, 08:00 v zimním. Ráno schválně:
--    kdyby se něco pokazilo, Martin je vzhůru a alert vidí hned.
-- ⚠️ Job se hledá a zakládá podle JMÉNA. `cron.schedule` se stejným jménem
--    existující job přepíše (upsert podle jobname), takže je skript bezpečný
--    i při druhém spuštění.
-- =============================================================================

select cron.schedule(
  'koucink-konec-denne',
  '0 7 * * *',
  $cmd$
  select net.http_post(
    url := 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/koucink-konec',
    headers := jsonb_build_object('Content-Type','application/json','x-drip-secret',(select value from public.app_config where key='drip_invoke_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $cmd$
);

-- Kontrola po zásahu (čekám jeden řádek, schedule '0 7 * * *'):
--   select jobid, jobname, schedule, active from cron.job where jobname = 'koucink-konec-denne';
--
-- Odpověď posledního běhu (tam se pozná i `{"vypnuto": true}`):
--   select status, content::text
--     from net._http_response order by created desc limit 5;
--
-- BĚH NANEČISTO (nic nezavře, nic nepošle, jen vypíše, koho by vzal):
--   select net.http_post(
--     url := 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/koucink-konec',
--     headers := jsonb_build_object('Content-Type','application/json','x-drip-secret',(select value from public.app_config where key='drip_invoke_secret')),
--     body := '{"dry":true}'::jsonb,
--     timeout_milliseconds := 60000
--   );
--
-- Návrat: select cron.unschedule('koucink-konec-denne');
