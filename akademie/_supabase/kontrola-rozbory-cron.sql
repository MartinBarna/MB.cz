-- =============================================================================
-- CRON: denní výroba konceptů rozborů pro tier appky `ai_kontrola`
-- („VIP + Kontrola od Martina", 2. 9. 2026)
--
-- ⛔⛔ SPOUŠTÍ SE NA ACADEMY (`uhmrpfsdcujbhbtumqye`), NE NA PROJEKTU APPKY.
--    Na projektu appky (`kfkmghvhqwqtsalqjmrp`) pg_cron nainstalovaný NENÍ
--    (k dispozici je, zapnutý ne). Academy už takhle volá edge funkce appky:
--    vzor je živá úloha `ai-flags-notify-app`.
--
-- ⛔ PROČ NE GITHUB ACTIONS: `schedule` na GitHubu není cron, hodinový rozvrh
--    reálně běží 5 až 6krát denně a běh se může o desítky minut opozdit nebo
--    vynechat ([[feedback-github-schedule-neni-cron]]). U rozboru, který se
--    slibuje „jednou za 14 dní", je vynechaný den tichá vada. Ze stejného
--    důvodu se 2. 9. stěhoval `push-reengagement`.
--
-- ⚠️ SECRET SE DO GITU NEPÍŠE. Před spuštěním nahraď `<KONTROLA_ROZBORY_SECRET>`
--    skutečnou hodnotou. Je to VLASTNÍ secret téhle funkce, který se zakládá nový
--    v Supabase → projekt APPKY → Edge Functions → Secrets. ⛔ Nepoužívej sdílený
--    `ACCESS_EXPIRY_SECRET`: Supabase jeho hodnotu neukazuje (jen otisk), takže
--    ji sem stejně nikdo neopíše. Funkce sdílený secret bere jen jako záložní,
--    dokud vlastní neexistuje.
--    Hodnota zůstává natvrdo v příkazu (ne v `app_config`), stejně jako u živé
--    úlohy `ai-flags-notify-app`, a je pak vidět v `cron.job.command`. Vědomý
--    kompromis: kdo má read na Academy DB, má i tenhle secret.
--
-- ⚠️ Idempotence: funkce si drží unikátní index `(user_id, obdobi_do)` a dělá
--    `upsert`, takže druhý běh téhož dne nevyrobí druhý koncept. Fronta je STAV,
--    ne kalendář: koho běh mine, toho vezme ten zítřejší.
--
-- Kontrola:  select jobname, schedule from cron.job where jobname = 'kontrola-rozbory-denne';
-- Odpojení:  select cron.unschedule('kontrola-rozbory-denne');
-- =============================================================================

-- 05:10 UTC = 07:10 Praha v létě. Slot je volný (5:20 má `academy-odecet-guard`,
-- 6:30 `enroll-active-no-buy-daily`) a leží před tím, než Martin ráno otevře admin.
select cron.schedule('kontrola-rozbory-denne', '10 5 * * *', $cron$
  select net.http_post(
    url := 'https://kfkmghvhqwqtsalqjmrp.supabase.co/functions/v1/kontrola-rozbory',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-expiry-secret', '<KONTROLA_ROZBORY_SECRET>'),
    body := '{"akce":"generovat"}'::jsonb)
$cron$);
