-- ============================================================================
-- Upsell enroll funkce: nevytrhavat lidi z rozdelane sekvence
-- ============================================================================
-- Cron jobid 14 '10 7 * * *' enroll_into_upsell_academy(25)
-- Cron jobid 11 '20 7 * * *' enroll_into_upsell_coaching(25)
-- (oba obalene v `case when public.followups_gate_open() then ... end`)
--
-- ⛔⛔ TENHLE SOUBOR BYL 13. 8. 2026 POZADU ZA ZIVOU DB. Zmena z 8. 8. 2026
--    (vyloučeni SOUCASNYCH i BYVALYCH klientu koucinku pres `entitlements.product
--    = 'coaching'` bez filtru `active`) se nasadila do DB, ale do gitu se nedostala.
--    Kdyby ji nekdo nasadil z tohohle souboru, ta ochrana by zmizela a ex-klientce
--    by zase odesel mail „Videokurz mas. Chces pomoc i ode me osobne?".
--    ⇒ Soubor je od 13. 8. srovnany se ZIVYM stavem. Kdo sem sahne, nejdriv si
--    porovna `pg_get_functiondef` proti tomuhle souboru, ne naopak.
-- ============================================================================
--
-- HISTORIE ZMEN
--
-- 20. 7. 2026: obe funkce vylucovaly jen tracky 'onboarding-%' a 'longtail-%'
--   s bezicim next_send_at. NEvylucovaly 'lead-magnet', 'existing-leadmagnet',
--   'trener-kit' ani 'nurture-videokurz'. V tabulce leads je 1 clovek = 1 radek,
--   takze `UPDATE leads SET track=...` NENI pridani do dalsi sekvence, ale PREPIS
--   te stavajici; clovek prisel o pozici a uz se do ni nevratil. Nahrazeno jednou
--   obecnou podminkou:
--     AND email NOT IN (SELECT lower(email) FROM leads
--                        WHERE next_send_at IS NOT NULL AND track NOT LIKE 'upsell-%')
--   Dopad pri nasazeni: 0 lidi. Pojistka do budoucna, ne hasici zasah.
--
-- 8. 8. 2026: ven i BYVALI klienti koucinku (`entitlements` s product='coaching'
--   BEZ filtru `active`, protoze offboard entitlement deaktivuje). Duvod: klientce
--   po 13 tydnech koucinku odesel upsell mail. Pamet `mb-koucink-offboard-automat`.
--   Zaroven u academy pribyl filtr expirace u vylouceni majitelu Academy.
--
-- 13. 8. 2026: ⛔⛔ GUARD PROTI KRADEZI LIDI UPROSTRED BLASTU.
--   Blastova rozesilka (trat `tydenik`, `blast-*`) cloveku DOCASNE prepise `track`
--   a po odeslani mu engine zhasne `next_send_at`, protoze jsou to terminalni
--   sablony (`wait_days = null`). Obecna podminka z 20. 7. stoji prave na
--   `next_send_at IS NOT NULL`, takze cloveka v tomhle okne NEVYLOUCI.
--   Enroll bezi v 7:10 a 7:20 UTC a presne do toho okna umi spadnout.
--   Nasledek by byl TICHY a nevratny bez rucniho zasahu: enroll prepise track na
--   'upsell-*', vraceni blastu uz cloveka nenajde (hleda `track = 'tydenik'`)
--   a clovek prijde o svou domovskou trat, aniz by to kdekoli kriklo.
--   Zmereno 13. 8. 2026: bez guardu by se to tykalo 5 lidi, s rustem Academy poroste.
--   Overeno naostro tymz dnem: testovaci lead ve stavu track='tydenik',
--   next_send_at=null byl BEZ guardu zpusobily (1) a S guardem ne (0);
--   ostre zavolani obou funkci vratilo 0 a lead zustal na sve trati.
--   ⚠️ Pouzito `track LIKE 'blast%'` (bez pomlcky) zamerne: je to nadmnozina
--   `blast-%` a drzi to 1:1 s `tydenik_prijemci` v `tydenik-rozesilka.sql`.
-- ============================================================================

create or replace function public.enroll_into_upsell_academy(p_limit integer default 25)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE v_count int := 0; v_min int := 73; r record;
BEGIN
  SELECT COALESCE(NULLIF(value,'')::int, 73) INTO v_min FROM app_config WHERE key='upsell_academy_min_lessons';
  IF v_min IS NULL THEN v_min := 73; END IF;
  FOR r IN
    WITH vk AS (
      SELECT DISTINCT lower(e.email) AS email, u.id AS user_id
      FROM entitlements e JOIN auth.users u ON lower(u.email) = lower(e.email)
      WHERE e.active AND e.product = 'videokurz'
        AND lower(e.email) NOT IN (SELECT lower(email) FROM entitlements WHERE product='academy' AND active
                                     AND (expires_at IS NULL OR expires_at > now()))
    ),
    engaged AS (
      SELECT vk.email FROM vk
      JOIN progress p ON p.user_id = vk.user_id AND p.completed AND p.lesson_id LIKE 'vk-%'
      GROUP BY vk.email HAVING count(*) >= v_min
    ),
    elig AS (
      SELECT e2.email FROM engaged e2
      WHERE e2.email NOT IN (SELECT lower(email) FROM customer_contacts WHERE tags && array['coaching-active'])
        -- 8. 8. 2026: soucasni i BYVALI klienti koucinku ven (step 0 = "Videokurz ti jde. Kam dal?")
        AND e2.email NOT IN (SELECT lower(email) FROM entitlements WHERE product = 'coaching')
        AND e2.email NOT IN (SELECT lower(email) FROM leads WHERE track LIKE 'upsell-%')
        AND e2.email NOT IN (SELECT lower(email) FROM leads WHERE status IN ('unsubscribed','bounced','paused'))
        -- ⛔⛔ 13. 8. 2026: NEBRAT NIKOHO, KDO JE PRAVE UPROSTRED BLASTU.
        --    Blast (tydenik, blast-*) cloveku docasne prepise `track` a po odeslani mu engine
        --    zhasne `next_send_at`. Podminka o radek niz stoji na `next_send_at IS NOT NULL`,
        --    takze cloveka v tom okne NEVYLOUCI: enroll by ho prepsal na upsell-* natrvalo
        --    a vraceni na domovskou trat by ho uz nenaslo => TICHA ztrata trate.
        --    Zmereno 13. 8.: tykalo by se 5 lidi, s rustem Academy to poroste.
        AND e2.email NOT IN (SELECT lower(email) FROM leads WHERE track = 'tydenik' OR track LIKE 'blast%')
        AND e2.email NOT IN (SELECT lower(email) FROM leads WHERE next_send_at IS NOT NULL AND track NOT LIKE 'upsell-%')
    )
    SELECT email FROM elig LIMIT greatest(1, p_limit)
  LOOP
    IF EXISTS (SELECT 1 FROM leads WHERE lower(email) = r.email) THEN
      UPDATE leads SET track='upsell-academy', step=0, status='active', next_send_at=now(), updated_at=now()
       WHERE lower(email) = r.email;
    ELSE
      INSERT INTO leads (email, track, step, status, next_send_at, source)
      VALUES (r.email, 'upsell-academy', 0, 'active', now(), 'upsell-auto');
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $function$;

create or replace function public.enroll_into_upsell_coaching(p_limit integer default 25)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
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
      WHERE r2.email NOT IN (SELECT lower(email) FROM customer_contacts WHERE tags && array['coaching-active'])
        -- 8. 8. 2026: soucasni i BYVALI klienti koucinku ven (texty trati stoji na "koupil sis videokurz")
        AND r2.email NOT IN (SELECT lower(email) FROM entitlements WHERE product = 'coaching')
        AND r2.email NOT IN (SELECT lower(email) FROM leads WHERE track LIKE 'upsell-%')
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
END; $function$;
