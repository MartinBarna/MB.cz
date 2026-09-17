-- ============================================================================
-- PRIPOMINKA TERMINU KONZULTACE: dva sloupce s razitkem (nalez D/N4)
-- 17. 9. 2026, 73. sef, davka 2b. IDEMPOTENTNI, spustitelne opakovane.
--
-- PROC: `_supabase/konzultace-crm-2026-09-15.sql` cituje Martina: "Termin konzultace
-- zadavam ja v adminu, SYSTEM MI TO MAILEM PRIPOMENE." Postavena byla jen zpetna
-- kontrola v `daily-digest` (bez terminu, po hovoru bez upsellu) a NADCHAZEJICI termin
-- digest vyslovne preskakuje (radek ~644). Pripominku tedy nedostal ani Martin, ani kupec,
-- ktery za hovor zaplatil. Edge funkce `konzultace-pripominka` to zaviraji z obou stran.
--
-- ⛔⛔ RAZITKO NENI CAS ODESLANI, JE TO TERMIN, KE KTEREMU SE POSLALO.
--    Kdyby se ukladal cas odeslani (`pripominka_sent_at`), PRESUNUTY termin by se uz
--    nepripomnel: razitko by tam porad bylo a clovek by o novem case nevedel. Martin
--    terminy v adminu prepisuje bezne (jeden radek na e-mail, akce `konzultace_termin`),
--    takze by to nebyl okrajovy pripad, ale ticha vada u ZAPLACENE sluzby.
--    ⇒ Sloupec drzi hodnotu `termin_at`, pro kterou mail odesel. Jiny termin = jina
--    hodnota = pripominka se posle znovu. KDY to odeslo, je v `email_events`
--    (stopa z `_shared/resend-odeslat.ts`, `detail.via='konzultace-pripominka'`).
--
-- ⚠️ RLS a granty se nemeni: `consultation_calls` uz ma zapnute RLS bez jedine policy
--    a `grant all` jen pro `service_role` (viz `konzultace-crm-2026-09-15.sql`, sekce 1).
--    Nove sloupce zadne vlastni pravo nemaji, dedi prava tabulky.
--    ⛔ Presto se to na konci OVERUJE: zalozni ani rozsirena tabulka bez RLS je verejna
--    tabulka (`feedback-zalozni-tabulka-bez-rls-je-verejna`).
-- ============================================================================

begin;

alter table public.consultation_calls
  add column if not exists pripominka_den_pred_pro timestamptz,
  add column if not exists pripominka_rano_pro     timestamptz;

comment on column public.consultation_calls.pripominka_den_pred_pro is
  'Hodnota termin_at, pro kterou UZ odesla pripominka den predem. NENI to cas odeslani: '
  'po presunu terminu se hodnoty rozejdou a pripominka se posle znovu (edge konzultace-pripominka).';

comment on column public.consultation_calls.pripominka_rano_pro is
  'Hodnota termin_at, pro kterou UZ odesla pripominka rano v den hovoru. Stejna logika '
  'jako u pripominka_den_pred_pro.';

commit;

-- ---------------------------------------------------------------------------
-- KROK PRO SEFA (⛔ NEPROVEDENO, nespousti se samo): CRON.
--
-- ⛔⛔ CRON AZ PO RUCNIM BEHU (pravidlo z 69. sefa). Nejdriv:
--     1) suchy beh, nic neodesila a nic nezapisuje:
--        curl -s -X POST "https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/konzultace-pripominka" \
--          -H "x-drip-secret: <app_config.drip_invoke_secret>" -H "Content-Type: application/json" \
--          -d '{"dry":true}'
--     2) suchy beh s posunutym casem, at je videt i vetev "den predem":
--        -d '{"dry":true,"now":"2026-09-18T05:40:00Z"}'
--     3) teprve pak ostry beh bez `dry` a kontrola v `email_events`
--        (`detail->>'via' = 'konzultace-pripominka'`).
--
-- ⚠️ CAS: 5:40 UTC = 7:40 Prahy (letni cas), tedy PRED `daily-digest` (cron 4, 5:30 UTC)
--    nesedi, ale na tom nezalezi: funkce na digestu nezavisi. Zvoleno tak, aby rano
--    v den hovoru dosla pripominka drive nez vetsina hovoru zacina.
-- ⚠️ V zimnim case to bude 6:40 Prahy. Kdyby to Martinovi vadilo, meni se schedule, ne kod.
--
-- select cron.schedule(
--   'konzultace-pripominka-denne',
--   '40 5 * * *',
--   $$
--   select net.http_post(
--     url := 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/konzultace-pripominka',
--     headers := jsonb_build_object('Content-Type','application/json','x-drip-secret',
--                  (select value from public.app_config where key='drip_invoke_secret')),
--     body := '{}'::jsonb
--   );
--   $$
-- );
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- KONTROLA PO SPUSTENI (jen cteni, nic nemeni):
--   a) sloupce existuji a jsou timestamptz:
--      select column_name, data_type from information_schema.columns
--       where table_schema='public' and table_name='consultation_calls'
--         and column_name like 'pripominka%';
--   b) RLS je porad zapnute a policy zadna:
--      select relrowsecurity, (select count(*) from pg_policies
--        where schemaname='public' and tablename='consultation_calls') as policies
--        from pg_class where oid='public.consultation_calls'::regclass;   -- ocekavano: t, 0
--   c) na tabulku nema prava nikdo krome service_role (a postgres):
--      select grantee, privilege_type from information_schema.role_table_grants
--       where table_schema='public' and table_name='consultation_calls';
--   d) zadne razitko jeste neexistuje (pred prvnim behem):
--      select count(*) filter (where pripominka_den_pred_pro is not null) as den_pred,
--             count(*) filter (where pripominka_rano_pro is not null)     as rano
--        from public.consultation_calls;
-- ---------------------------------------------------------------------------
