-- ZACHRANA ZIVEHO ZNENI ENROLL FUNKCI (16. 9. 2026, 73. sef, stavec Academy)
-- Porizeno doslovne z produkcni DB Academy (uhmrpfsdcujbhbtumqye):
--   select p.oid::regprocedure, p.proacl, pg_get_functiondef(p.oid)
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname like 'enroll_into_%';
--
-- ⛔ PRAVIDLO 8 (CLAUDE.md): v `pg_proc` jsou PRESNE ctyri funkce `enroll_into_%`,
--    kazda v jedine variante signatury:
--      enroll_into_longtail(integer)
--      enroll_into_nurture_videokurz(integer)
--      enroll_into_upsell_academy(integer)
--      enroll_into_upsell_coaching(integer,text)
--    Vsechny SECURITY DEFINER, vsechny proacl {postgres=X/postgres,service_role=X/postgres}.
--
-- ⛔ ZIVE ZNENI JE NOVEJSI NEZ GIT (rozdily proti `zive-enroll-2026-09-15.sql`):
--    `enroll_into_upsell_coaching` i `enroll_into_upsell_academy` uz maji nasazenou
--    branu na `consultation_calls.termin_at` z 15. 9. 2026 (migrace
--    `konzultace-crm-2026-09-15.sql`). `enroll_into_longtail`
--    a `enroll_into_nurture_videokurz` jsou proti 15. 9. beze zmeny.
--
-- Nic se odsud nenasazuje automaticky; je to referencni bod pro diff a navrat.
-- Migrace `enroll-rozdelana-trat-2026-09-16.sql` je psana NAD timhle znenim.

-- ==== enroll_into_upsell_coaching(integer,text)
-- proacl: {postgres=X/postgres,service_role=X/postgres}
-- prosecdef: true
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

-- ==== enroll_into_upsell_academy(integer)
-- proacl: {postgres=X/postgres,service_role=X/postgres}
-- prosecdef: true
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

-- ==== enroll_into_nurture_videokurz(integer)
-- proacl: {postgres=X/postgres,service_role=X/postgres}
-- prosecdef: true
CREATE OR REPLACE FUNCTION public.enroll_into_nurture_videokurz(p_limit integer DEFAULT 50)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count int := 0;
  v_email text;
begin
  for v_email in
    with admins as (
      select lower(trim(x)) as email
      from unnest(string_to_array(coalesce((select value from app_config where key='admin_emails'),''), ',')) as x
      where trim(x) <> ''
    ),
    finished as (
      select distinct lower(l.email) as email
      from leads l
      where l.status = 'active'
        and l.next_send_at is null
        and coalesce(l.purchased, false) = false
        and l.track in ('lead-magnet','existing-leadmagnet')
    ),
    elig as (
      select f.email from finished f
      where f.email not in (select email from admins)
        and f.email not in (select lower(email) from entitlements where active and product in ('videokurz','academy')
                              and (expires_at is null or expires_at > now()))
        and f.email not in (select lower(email) from leads where track like 'nurture-%' or track like 'upsell-%')
        and f.email not in (select lower(email) from leads where status in ('unsubscribed','bounced'))
    )
    select email from elig limit greatest(1, p_limit)
  loop
    update leads set track='nurture-videokurz', step=0, status='active', next_send_at=now(), updated_at=now()
     where lower(email) = v_email;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$
;

-- ==== enroll_into_longtail(integer)
-- proacl: {postgres=X/postgres,service_role=X/postgres}
-- prosecdef: true
CREATE OR REPLACE FUNCTION public.enroll_into_longtail(p_limit integer DEFAULT 50)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
-- 6. 9. 2026 (sef 50, Martinovo pravidlo): nikdo z mailing databaze nesmi zustat bez mailu,
-- pokud se neodhlasil. Bere KAZDOU trat, ktera dojela a neni tranzitni, klientska ani koncova.
-- 6. 9. 2026 (sef 51): majitel videokurzu po dojetem longtail-kupci jde do evergreen-kupci.
-- 6. 9. 2026 (sef 53): kdo ma Academy nebo koucink, se driv vyloucil ze vsech cilu a zustal
-- lezet (17 lidi). Nove jde do evergreen-consumer, obsahove trati, kde preskoc.ts vynecha
-- prodejni kroky 1 a 4 podle toho, co uz vlastni.
-- 6. 9. 2026 (sef 53, druha davka): pridan trvaly seznam odhlasenych odhlaseni_trvale.
--    Stara podminka status in (unsubscribed,bounced) cte radek v leads, ktery u odhlaseneho
--    cloveka uz NEEXISTUJE (mazou se). Po novem importu by byl zase active a tahle funkce by
--    ho zapsala do trati. Druha strana pravidla je v newsletter_prijemci a tydenik_prijemci.
declare
  v_count int := 0;
  v_rearm int := 0;
  r record;
begin
  update leads l set next_send_at = now(), updated_at = now()
   where l.status = 'active' and l.next_send_at is null
     and l.updated_at < now() - interval '12 hours'
     and l.track not in ('blog-newsletter','tydenik','onboarding-coaching')
     and l.track not like 'blast%' and l.track not like 'rozlouceni-%'
     and exists (select 1 from email_templates t where t.track = l.track and t.step = l.step)
     and not exists (select 1 from email_events e where e.lead_id = l.id and e.type in ('bounce','complaint'))
     and not exists (select 1 from odhlaseni_trvale o where o.email = lower(l.email));
  get diagnostics v_rearm = row_count;

  for r in
    with admins as (
      select lower(trim(x)) as email
      from unnest(string_to_array(coalesce((select value from app_config where key='admin_emails'),''), ',')) as x
      where trim(x) <> ''
    ),
    vk as (
      select lower(email) as email from entitlements
       where active and product = 'videokurz' and (expires_at is null or expires_at > now())
    ),
    ac as (
      select lower(email) as email from entitlements
       where active and product in ('academy','coaching') and (expires_at is null or expires_at > now())
    ),
    finished as (
      select lower(l.email) as email,
        case
          when l.track = 'trener-kit' then 'longtail-trener'
          when lower(l.email) in (select email from vk) then
            case when exists (select 1 from email_events e
                               where e.lead_id = l.id and e.type = 'sent'
                                 and e.detail->>'track' = 'longtail-kupci')
                 then 'evergreen-kupci' else 'longtail-kupci' end
          else 'longtail-consumer'
        end as target,
        min(l.updated_at) as dokonceno
      from leads l
      where l.status = 'active'
        and l.next_send_at is null
        and l.updated_at < now() - interval '12 hours'
        and l.track not in ('blog-newsletter','tydenik','onboarding-coaching')
        and l.track not like 'evergreen-%'
        and l.track not like 'blast%' and l.track not like 'rozlouceni-%' and l.track not like 'longtail-%'
      group by 1, 2
    ),
    prepnute as (
      select f.email,
        case
          when f.target = 'longtail-consumer'
               and f.email in (select lower(email) from entitlements
                                where active and product in ('videokurz','academy','coaching')
                                  and (expires_at is null or expires_at > now()))
            then 'evergreen-consumer'
          when f.target in ('longtail-trener','longtail-kupci','evergreen-kupci')
               and f.email in (select email from ac)
            then 'evergreen-consumer'
          else f.target
        end as target,
        f.dokonceno
      from finished f
    ),
    elig as (
      select p.email, p.target, p.dokonceno from prepnute p
      where p.email not in (select email from admins)
        and p.email not in (select lower(email) from leads where track like 'longtail-%')
        and p.email not in (select lower(email) from leads where status in ('unsubscribed','bounced'))
        and p.email not in (select email from odhlaseni_trvale)
        and p.email not in (select lower(email) from withdrawals where created_at > now() - interval '180 days')
        and not exists (select 1 from email_events e join leads l2 on l2.id = e.lead_id
                         where lower(l2.email) = p.email and e.type = 'sent' and e.detail->>'track' = p.target)
    )
    select email, target from elig
     order by dokonceno asc, email asc
     limit greatest(1, p_limit)
  loop
    update leads set track = r.target, step = 0, status = 'active', next_send_at = now() + interval '3 days', updated_at = now()
     where lower(email) = r.email;
    insert into email_events (lead_id, step, type, detail)
    select id, 0, 'bridged', jsonb_build_object('track', r.target, 'z', track, 'na', r.target, 'po_dnech', 3, 'pojistka', 'enroll_into_longtail')
      from leads where lower(email) = r.email;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$
;
