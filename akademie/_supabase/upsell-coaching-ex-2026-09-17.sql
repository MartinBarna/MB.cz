-- ============================================================================
-- UPSELL KOUCINKU: byvaly klient (`coaching-ex`) do prodejni trati NEPATRI
-- 17. 9. 2026, 73. sef, davka 2b. Nalez D/N11 auditu mailovych toku.
--
-- ROZHODNUTI MARTINA (17. 9. 2026, otazka 12b): u byvaleho klienta koucinku
-- "bezny marketing dal ANO, prodejni trat na koucink NE".
--
-- ⛔ MIGRACE JE PSANA NAD ZIVYM ZNENIM, ne nad souborem v gitu.
--    Otisk: `zive-enroll-upsell-coaching-2026-09-17.sql` (stazeno tesne pred psanim,
--    `pg_get_functiondef`). Zmereno: zive telo je BAJT PO BAJTU shodne se snimkem
--    z 16. 9., takze se nad nim da stavet bez prekvapeni.
--    (`feedback-zive-sql-funkce-napred-pred-gitem`)
--
-- ⛔ SIGNATURA SE NEMENI (`integer, text`), takze `create or replace` JE skutecna
--    nahrada a granty zustavaji (`feedback-create-or-replace-neni-nahrada`).
--    Cil proacl: {postgres=X/postgres,service_role=X/postgres}
--    ⚠️ Kdyby nekdo mezitim funkci DROPnul a vytvoril znovu s jinym poctem parametru,
--       tahle migrace by vyrobila DRUHOU variantu. Proto kontrola (b) na konci.
--
-- ⚠️ CO SE NEMENI: nic neubira z bezneho marketingu. `newsletter_prijemci`,
--    `tydenik_prijemci`, `enroll_into_longtail` ani `enroll_into_nurture_videokurz`
--    znacku `coaching-ex` neznaji a znat nemaji. Meni se JEDINA funkce.
-- ============================================================================

begin;

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
        -- [17. 9. 2026, nalez D/N11] BYVALY KLIENT KOUCINKU (`coaching-ex`) TAKY VEN.
        -- Rozhodnuti Martina 17. 9. 2026 (otazka 12b auditu mailu): bezny marketing
        -- (newsletter, tydenik, longtail) byvalemu klientovi chodi DAL, ale PRODEJNI
        -- TRAT NA KOUCINK uz ne. Znacku `coaching-ex` nastavuje jedine misto
        -- (`admin-api`, akce `client_offboard`, radky ~3790) a do dneska ji NECETL NIKDO:
        -- byla to jen popiska v adminu.
        -- ⚠️ Radek nize (`entitlements ... product='coaching'`) vetsinu z nich uz chytal,
        --    ale NE VSECHNY: offboard narok casem ODEBERE (expires_at do minulosti),
        --    a `NOT IN (select ... where product='coaching')` se diva na existenci radku
        --    bez ohledu na aktivitu, takze kdo by mel narok smazany, propadl by sem.
        --    Zmereno 17. 9. 2026: 20 kontaktu ma `coaching-ex`, z toho 2 maji radek
        --    v `entitlements(product='coaching')` a 5 je v mnozine kandidatu `reg`.
        --    Tahle brana tedy dnes vylucuje 5 lidi, kteri by jinak dostali nabidku
        --    koucinku, ktery uz meli.
        -- ⛔ `enroll_into_upsell_academy` se SCHVALNE NEMENI: ta prodava Academy, ne
        --    koucink, a Martinovo rozhodnuti mluvi o prodejni trati na koucink.
        AND r2.email NOT IN (SELECT lower(email) FROM customer_contacts
                              WHERE tags && array['coaching-active','coaching-ex'])
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

-- Granty se pri `create or replace` nemeni, kontroluje se to nize.
commit;

-- ---------------------------------------------------------------------------
-- KONTROLA PO SPUSTENI (jen cteni, nic nemeni):
--   a) brana je v tele:
--      select position('coaching-ex' in pg_get_functiondef(p.oid)) > 0
--        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname='public' and p.proname='enroll_into_upsell_coaching';
--   b) funkce je porad JEN JEDNA a jen jedna signatura:
--      select p.oid::regprocedure::text, p.proacl::text from pg_proc p
--        join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname='public' and p.proname='enroll_into_upsell_coaching';
--      -- ocekavano prave jeden radek:
--      --   enroll_into_upsell_coaching(integer,text)
--      --   {postgres=X/postgres,service_role=X/postgres}
--   c) `enroll_into_upsell_academy` znacku `coaching-ex` ZNAT NEMA (zamerne):
--      select position('coaching-ex' in pg_get_functiondef(p.oid)) = 0
--        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname='public' and p.proname='enroll_into_upsell_academy';   -- ocekavano t
--   d) SUCHY TEST: funkce s cizim e-mailem nezaradi nikoho.
--      select public.enroll_into_upsell_coaching(1, 'neexistuje@example.com');   -- ocekavano 0
--      ⛔ NEspoustet s existujicim e-mailem, funkce ZAPISUJE do `leads`.
--   e) kolik lidi brana vylucuje (melo by sedet s cislem v hlavicce):
--      select count(*) from customer_contacts cc
--       where cc.tags && array['coaching-ex']
--         and lower(cc.email) in (
--               select distinct lower(e.email) from entitlements e
--                join auth.users u on lower(u.email) = lower(e.email)
--               where e.active and e.product in ('videokurz','academy'));
-- ---------------------------------------------------------------------------
