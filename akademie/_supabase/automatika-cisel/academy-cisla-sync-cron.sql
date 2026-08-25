-- ============================================================
-- ACADEMY (projekt uhmrpfsdcujbhbtumqye)
-- pg_cron -> edge cisla-sync -> RPC appky -> upsert app_config
--
-- ⛔ TENHLE SOUBOR SE NEAPLIKUJE Z WORKTREE. Je to podklad pro sefa.
--    Pred spustenim MUSI existovat:
--      1) nasazena edge `cisla-sync` (--no-verify-jwt)
--      2) klic app_config.cisla_sync_secret (vygeneruje sef, do gitu NE)
--    Cursor / agent NESMI spoustet tenhle SQL proti zive DB.
--
-- VZOR: drip-send-hourly v drip-engine.sql. Secret je v poddotazu,
--    nikdy v textu jobu. Hlavicka x-cisla-secret, nikdy ?secret=.
--
-- PLAN: minuta 23, aby nekolidovala s hodinovym drip-send (minuta 0).
--    Hodina 7 UTC je v tomhle projektu vynechavana ZAMERNE (tydenik).
--    `*/6` by davalo 1, 7, 13, 19 UTC. Drzime zvyk: 2, 8, 14, 20 UTC.
-- ============================================================

select cron.schedule(
  'cisla-sync-6h',
  '23 2,8,14,20 * * *',
  $$ select net.http_post(
       url     := 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/cisla-sync',
       headers := jsonb_build_object(
                    'Content-Type','application/json',
                    'x-cisla-secret',(select value from public.app_config where key='cisla_sync_secret')),
       body    := '{}'::jsonb
     ) $$
);

-- ROLLBACK (az kdyz sef rika):
--   select cron.unschedule('cisla-sync-6h');
