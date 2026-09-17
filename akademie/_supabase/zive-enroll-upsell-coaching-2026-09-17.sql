-- ZACHRANA ZIVEHO ZNENI (17. 9. 2026, 73. sef, stavec MB.cz, davka 2b)
-- Porizeno doslovne z produkcni DB Academy (uhmrpfsdcujbhbtumqye) pred psanim migrace
-- `upsell-coaching-ex-2026-09-17.sql`:
--   select p.oid::regprocedure, p.proacl, pg_get_functiondef(p.oid) from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname='public' and p.proname in ('enroll_into_upsell_coaching','koucink_kapacita');
--
-- ⛔ ZIVE SQL FUNKCE BYVAJI NAPRED PRED GITEM (`feedback-zive-sql-funkce-napred-pred-gitem`),
--    proto se stahuje ZNOVU, i kdyz `zive-enroll-2026-09-16.sql` existuje.
-- ⭐ ZMERENO 17. 9. 2026: `enroll_into_upsell_coaching` je BAJT PO BAJTU SHODNA
--    se snimkem z 16. 9. (`diff` bez rozdilu). Zadna zmena "dnes rano" tedy v TEHLE
--    funkci neprobehla; kdo cekal jinou vychozi verzi, hledal jinde.
-- ⚠️ `koucink_kapacita()` je tu jako DRUHE MISTO, ktere cte `app_config.koucink_kapacita`
--    (prvni je `_shared/koucink-onboarding.ts`). Obe pocitaji obsazenost STEJNE,
--    takze zmena stropu je JEDEN update, ne dva. Viz BUILD, nalez D/N5.
--
-- Nic se odsud nenasazuje automaticky; je to referencni bod pro diff a navrat.

-- ==== enroll_into_upsell_coaching(integer,text)
-- proacl: {postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.enroll_into_upsell_coaching(p_limit integer DEFAULT 25, p_email text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count int := 0; r record;
BEGIN
  FOR r IN
    WITH reg AS (
      SELECT DISTINCT lower(e.email) AS email
      FROM entitlements e JOIN auth.users u ON lower(u.email) = lower(e.email)
      WHERE e.active AND e.product IN ('videokurz','academy')
    ),
    elig AS (
      SELECT r2.email FROM reg r2
      -- [15. 9. 2026] ZUZENI NA JEDEN E-MAIL. NULL = davkovy beh jako dosud (cron 11).
      -- Neprida ANI NEUBERE zadnou ochranu: jen omezi mnozinu kandidatu, takze
      -- rucni spusteni z adminu projde uplne stejnymi podminkami jako nocni davka.
      WHERE (p_email IS NULL OR r2.email = lower(trim(p_email)))
        AND r2.email NOT IN (SELECT lower(email) FROM customer_contacts WHERE tags && array['coaching-active'])
        -- 8. 8. 2026: soucasni i BYVALI klienti koucinku ven (texty trati stoji na "koupil sis videokurz")
        AND r2.email NOT IN (SELECT lower(email) FROM entitlements WHERE product = 'coaching')
        -- [15. 9. 2026] ZAPLACENA KONZULTACE PRED HOVOREM: zadna prodejni trat.
        -- Kupec konzultace se prave chysta mluvit s Martinem o tom, co mu tahle trat
        -- prodava. Dokud hovor neprobehl, do trate nepatri. Terminem je jediny zdroj
        -- pravdy `consultation_calls.termin_at`, ktery zadava Martin v adminu:
        -- NULL (nezadano) i budoucnost blokuji, minulost pousti.
        -- ⛔ ZADNA pevna pauza N dni (rozhodnuti Martina 15. 9. 2026).
        AND r2.email NOT IN (
              SELECT lower(e3.email) FROM entitlements e3
               LEFT JOIN consultation_calls cc3 ON lower(cc3.email) = lower(e3.email)
               WHERE e3.product = 'konzultace' AND e3.active
                 AND (e3.expires_at IS NULL OR e3.expires_at > now())
                 AND (cc3.termin_at IS NULL OR cc3.termin_at > now()))
        AND r2.email NOT IN (SELECT lower(email) FROM leads WHERE track LIKE 'upsell-%')
        -- 6. 9. 2026 (51. sef): evergreen trate jsou KONCOVE, z nich se nikdo nevraci do upsellu
        AND r2.email NOT IN (SELECT lower(email) FROM leads WHERE track LIKE 'evergreen-%')
        -- 6. 9. 2026 (51. sef): kdo uz upsell-coaching jednou dostal, nedostane ho podruhe
        AND NOT EXISTS (SELECT 1 FROM email_events ev JOIN leads l3 ON l3.id = ev.lead_id
                         WHERE lower(l3.email) = r2.email AND ev.type = 'sent'
                           AND ev.detail->>'track' = 'upsell-coaching')
        AND r2.email NOT IN (SELECT lower(email) FROM leads WHERE status IN ('unsubscribed','bounced','paused'))
        -- ⛔⛔ 13. 8. 2026: NEBRAT NIKOHO, KDO JE PRAVE UPROSTRED BLASTU. Duvod je stejny
        --    jako u `enroll_into_upsell_academy`, viz komentar tam.
        AND r2.email NOT IN (SELECT lower(email) FROM leads WHERE track = 'tydenik' OR track LIKE 'blast%')
        -- OBECNE: nikoho, komu bezi jakakoli jina sekvence nez upsell
        AND r2.email NOT IN (SELECT lower(email) FROM leads WHERE next_send_at IS NOT NULL AND track NOT LIKE 'upsell-%')
    )
    SELECT email FROM elig LIMIT greatest(1, p_limit)
  LOOP
    IF EXISTS (SELECT 1 FROM leads WHERE lower(email) = r.email) THEN
      UPDATE leads SET track='upsell-coaching', step=0, status='active', next_send_at=now(), updated_at=now()
       WHERE lower(email) = r.email;
    ELSE
      INSERT INTO leads (email, track, step, status, next_send_at, source)
      VALUES (r.email, 'upsell-coaching', 0, 'active', now(), 'upsell-auto');
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $function$
;

-- ==== koucink_kapacita()
-- proacl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.koucink_kapacita()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select jsonb_build_object(
    'kapacita', k.kapacita,
    'obsazeno', c.obsazeno,
    'volno', greatest(0, k.kapacita - c.obsazeno)
  )
  from (
    select coalesce(
      (select nullif(regexp_replace(value, '[^0-9]', '', 'g'), '')::int
         from public.app_config where key = 'koucink_kapacita'),
      25) as kapacita
  ) k,
  (
    select count(*)::int as obsazeno
    from public.entitlements
    where product = 'coaching'
      and active = true
      and coalesce(source, '') <> 'test-claude'
      and (
        expires_at > now()
        or (expires_at is null and source like 'stripe%')
      )
  ) c;
$function$

;
