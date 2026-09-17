-- ZACHRANA ZIVEHO ZNENI (17. 9. 2026, 73. sef, stavec MB.cz, davka 2b)
-- ⛔⛔ TENHLE SOUBOR BYL 17. 9. PREPSAN PO REVIZI R1. PRVNI VERZE BYLA ZASTARALA
--    UZ V OKAMZIKU, KDY VZNIKLA, A MIGRACE NAD NI BY SMAZALA ZIVOU BRANU.
--    Co se stalo: prvni otisk jsem poridil v 07:23 UTC (09:23 prazskeho casu)
--    a v tu chvili `enroll_into_upsell_coaching` branu V7
--    (`ma_rozdelanou_dorucovaci_trat`) opravdu NEMELA. Migrace V7
--    (`enroll-rozdelana-trat-2026-09-16.sql`) sla naostro BEHEM me prace, kolem 09:3x
--    prazskeho casu, tedy MEZI otiskem a napsanim migrace. `create or replace` je uplna
--    nahrada tela, takze moje migrace by tu branu tise odstranila a vratila stav,
--    kvuli kteremu 15. 9. prisel jediny kupec konzultace o kroky 1 a 2 SVE ZAPLACENE
--    dorucovaci trate. Nasel to az nezavisly revizor (nalez R1/N1).
--    ⭐ POUCENI: otisk zivyho zneni plati JEN v tom tahu, ve kterem vznikl. Kdyz mezi
--    otiskem a migraci uplyne hodina prace, stahuje se ZNOVU a diff se dela proti
--    cerstvemu. `feedback-zive-sql-funkce-napred-pred-gitem` mluvi o gitu, tohle je
--    jeho horsi varianta: zastaraly otisk vypada jako dukaz.
--
-- Porizeno doslovne z produkcni DB Academy (uhmrpfsdcujbhbtumqye) v 2026-09-17 08:01:25 UTC (10:01 prazskeho casu):
--   select p.oid::regprocedure, p.proacl, pg_get_functiondef(p.oid) from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname='public' and p.proname in ('enroll_into_upsell_coaching',
--          'koucink_kapacita','ma_rozdelanou_dorucovaci_trat');
--
-- ⛔ PRAVIDLO 8 (CLAUDE.md): `enroll_into_upsell_coaching` ma JEDINOU variantu signatury
--    (integer,text), proacl {postgres=X/postgres,service_role=X/postgres}.
-- ⭐ ZMERENO v temze tahu: branu V7 maji VSECHNY CTYRI `enroll_into_*`
--    (longtail, nurture_videokurz, upsell_academy, upsell_coaching) a `coaching-ex`
--    zatim ani jedna. `select count(*) from leads l where
--    public.ma_rozdelanou_dorucovaci_trat(l.email)` = 4 lide, to je dnesni velikost obeti.
-- ⚠️ `koucink_kapacita()` je tu jako DRUHE MISTO, ktere cte `app_config.koucink_kapacita`
--    (prvni je `_shared/koucink-onboarding.ts`). Obe pocitaji obsazenost STEJNE,
--    takze zmena stropu je JEDEN update, ne dva. Viz BUILD, nalez D/N5.
-- ⚠️ `ma_rozdelanou_dorucovaci_trat(text)` je tu proto, aby bylo videt, CO ta brana dela:
--    je STABLE a jen cte. Migrace davky 2b se ji nedotyka, jen ji musi zachovat.
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
        -- ⛔⛔ [16. 9. 2026] ROZDELANA DORUCOVACI TRAT (nalez V7). Radek nad timhle
        --    stoji na `next_send_at IS NOT NULL`, ktery rozesilka po odeslani zhasne;
        --    v tom okne je clovek pro nej neviditelny. Tohle se diva na odeslane kroky,
        --    takze okno nema. Bez teho pravidla prisel 15. 9. jediny kupec konzultace
        --    o kroky 1 a 2 sve zaplacene dorucovaci trate.
        AND NOT public.ma_rozdelanou_dorucovaci_trat(r2.email)
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

-- ==== ma_rozdelanou_dorucovaci_trat(text)
-- proacl: {postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.ma_rozdelanou_dorucovaci_trat(p_email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
      from public.email_events ev
      join public.leads l on l.id = ev.lead_id
     where lower(l.email) = lower(p_email)
       and ev.type = 'sent'
       and ev.detail->>'track' like 'onboarding-%'
       and ev.created_at > now() - interval '21 days'
       and exists (select 1 from public.email_templates t
                    where t.track = ev.detail->>'track'
                      and t.step > ev.step)
  )
$function$;

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
$function$;
