-- ============================================================================
-- KONZULTACE: vlastni CRM stopa + pauza prodejnich trati do doby po hovoru
-- 15. 9. 2026, 70. sef. IDEMPOTENTNI, spustitelne opakovane.
--
-- ROZHODNUTI MARTINA (15. 9. 2026), podle ktereho je tohle postavene:
--   A) "Termin konzultace zadavam ja v adminu, system mi to mailem pripomene.
--      Upsell na koucink ma prijit az PO konzultaci; nekdy je vhodne hned po hovoru."
--      => ZADNA pevna pauza N dni. Branou je TERMIN HOVORU, ne pocet dni od platby.
--   C) "Konzultace musi byt rozlisitelna od koucinku; kdyz pak dany mail pridam
--      do koucinku, zmizi z konzultace a pribude v koucinku."
--      => vlastni tag `konzultace` v customer_contacts, ktery pozvanka do koucinku
--         odebira (dela to `_shared/koucink-onboarding.ts`, ne tahle migrace).
--
-- ⛔ OBE ENROLL FUNKCE SE MENI Z ZIVEHO ZNENI, ne ze starsich souboru v gitu.
--    Otisk ziveho stavu pred touhle zmenou: `zive-enroll-2026-09-15.sql`.
--    `upsell-nevytrhavat.sql` i `upsell-sequences.sql` jsou POZADU a nasazeni
--    z nich by ticho smazalo ochrany z 8. 8. a 6. 9. 2026.
--
-- ⛔ SIGNATURA SE NEMENI (obe funkce dal `(p_limit integer)`), takze `create or replace`
--    je skutecna nahrada a NEVYROBI druhou funkci. Granty tim padem zustavaji.
--    Pred spustenim i po nem se musi shodovat:
--      select p.oid::regprocedure::text, p.proacl::text
--        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname='public' and p.proname in
--             ('enroll_into_upsell_coaching','enroll_into_upsell_academy');
--    Ocekavane proacl u obou: {postgres=X/postgres,service_role=X/postgres}
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) TERMIN HOVORU. Jedina nova tabulka, jeden radek na e-mail.
--    `termin_at` NULL = termin jeste neni zadany (a prave proto se cloveku
--    neprodava koucink: Martin s nim jeste nemluvil).
--    ⛔ Tabulka NEMA zadny grant pro anon ani authenticated a ma zapnute RLS
--    bez jedine policy: sahat na ni smi vyhradne service_role, tedy admin-api
--    a drip-send. Zaloha bez RLS je verejna tabulka (pamet
--    `feedback-zalozni-tabulka-bez-rls-je-verejna`), proto to neni volitelne.
-- ---------------------------------------------------------------------------
create table if not exists public.consultation_calls (
  email      text primary key,
  termin_at  timestamptz,
  note       text,
  updated_at timestamptz not null default now()
);

comment on table public.consultation_calls is
  'Termin konzultacniho hovoru. Zadava Martin v adminu (akce konzultace_termin). '
  'termin_at v budoucnu nebo NULL = hovor jeste nebyl => prodejni trate se odkladaji.';

alter table public.consultation_calls enable row level security;

-- ⛔ REVOKE od anon samo nestaci: prava casto visi na roli PUBLIC, kterou anon dedi
--    (pamet `feedback-postgres-grant-public-vs-anon`). Proto se bere i PUBLIC.
revoke all on table public.consultation_calls from public;
revoke all on table public.consultation_calls from anon;
revoke all on table public.consultation_calls from authenticated;
grant all on table public.consultation_calls to service_role;

-- ---------------------------------------------------------------------------
-- 2) ENROLL FUNKCE: pridana JEDNA podminka do CTE `elig`.
--    Blokuje se ten, kdo ma AKTIVNI a nevyprsely narok `konzultace` a zaroven
--    NEMA `consultation_calls.termin_at` v MINULOSTI (tedy bud termin nema vubec,
--    nebo je v budoucnu). Po hovoru podminka sama pusti a cron 7:20 UTC cloveka
--    zaradi nasledujici rano bez dalsiho zasahu.
--    ⚠️ Filtr `active` tu ZUSTAVA schvalne: refundovana konzultace nikoho blokovat nema.
-- ---------------------------------------------------------------------------

-- --- enroll_into_upsell_coaching(integer) ---------------------------------------------
CREATE OR REPLACE FUNCTION public.enroll_into_upsell_coaching(p_limit integer DEFAULT 25)
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
      WHERE r2.email NOT IN (SELECT lower(email) FROM customer_contacts WHERE tags && array['coaching-active'])
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

-- --- enroll_into_upsell_academy(integer) ---------------------------------------------
CREATE OR REPLACE FUNCTION public.enroll_into_upsell_academy(p_limit integer DEFAULT 25)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        -- [15. 9. 2026] ZAPLACENA KONZULTACE PRED HOVOREM: zadna prodejni trat.
        -- Kupec konzultace se prave chysta mluvit s Martinem o tom, co mu tahle trat
        -- prodava. Dokud hovor neprobehl, do trate nepatri. Terminem je jediny zdroj
        -- pravdy `consultation_calls.termin_at`, ktery zadava Martin v adminu:
        -- NULL (nezadano) i budoucnost blokuji, minulost pousti.
        -- ⛔ ZADNA pevna pauza N dni (rozhodnuti Martina 15. 9. 2026).
        AND e2.email NOT IN (
              SELECT lower(e3.email) FROM entitlements e3
               LEFT JOIN consultation_calls cc3 ON lower(cc3.email) = lower(e3.email)
               WHERE e3.product = 'konzultace' AND e3.active
                 AND (e3.expires_at IS NULL OR e3.expires_at > now())
                 AND (cc3.termin_at IS NULL OR cc3.termin_at > now()))
        AND e2.email NOT IN (SELECT lower(email) FROM leads WHERE track LIKE 'upsell-%')
        -- 6. 9. 2026 (51. sef): evergreen trate jsou KONCOVE, z nich se nikdo nevraci do upsellu
        AND e2.email NOT IN (SELECT lower(email) FROM leads WHERE track LIKE 'evergreen-%')
        -- 6. 9. 2026 (51. sef): kdo uz upsell-academy jednou dostal, nedostane ho podruhe
        AND NOT EXISTS (SELECT 1 FROM email_events ev JOIN leads l3 ON l3.id = ev.lead_id
                         WHERE lower(l3.email) = e2.email AND ev.type = 'sent'
                           AND ev.detail->>'track' = 'upsell-academy')
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
END; $function$
;

-- ---------------------------------------------------------------------------
-- 3) KONTROLA PO SPUSTENI (jen cteni, nic nemeni):
--    a) granty se musi rovnat otisku z `zive-enroll-2026-09-15.sql`:
--       select p.oid::regprocedure::text, p.proacl::text from pg_proc p
--         join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname='public' and p.proname like 'enroll_into_upsell_%';
--    b) funkce musi byt kazda JEN JEDNA (jinak `create or replace` vyrobil dvojnika):
--       select proname, count(*) from pg_proc p join pg_namespace n
--         on n.oid = p.pronamespace where n.nspname='public'
--        and proname like 'enroll_into_upsell_%' group by 1;
--    c) nova podminka opravdu v tele je:
--       select proname, position('consultation_calls' in pg_get_functiondef(p.oid)) > 0
--         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname='public' and proname like 'enroll_into_upsell_%';
-- ---------------------------------------------------------------------------
