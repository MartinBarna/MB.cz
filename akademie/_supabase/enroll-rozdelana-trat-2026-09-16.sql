-- ============================================================================
-- PRODEJNI ENROLL FUNKCE NESMI PREPSAT ROZDELANOU DORUCOVACI TRAT
-- 16. 9. 2026, 73. sef (stavec Academy). IDEMPOTENTNI, spustitelne opakovane.
--
-- CO SE OPRAVUJE (nalez V7 z `ANALYZA-mailove-toky.md`, overeno proti zivemu
-- `pg_get_functiondef` a proti `email_events`):
--   Prodejni enroll funkce se dosud branily podminkou
--   `email NOT IN (select lower(email) from leads where next_send_at is not null
--                    and track not like 'upsell-%')`,
--   tedy "nikoho, komu bezi jina sekvence". Jenze rozesilka (tydenik, blast-*,
--   blog-newsletter) cloveku docasne prepise `track` a `drip-send` mu po odeslani
--   ZHASNE `next_send_at`. V tom okne nema clovek ani cizi track, ani termin,
--   takze ho pojistka nevidi a enroll mu prepise rozdelanou DORUCOVACI trat.
--   Doloženo 15. 9. 2026: jedinemu kupci konzultace (2 990 Kc) odesel krok 0
--   doruci trate `onboarding-nakup-konzultace`, pak si ho vzala rozesilka,
--   a 15. 9. v 08:00 UTC ho `enroll_into_upsell_coaching` prepsalo na prodejni
--   trat. Kroky 1 a 2 doruci trate (mimo jine "Tvuj kredit z konzultace plati
--   14 dni") uz nikdy neodesly. Zaplaceno, slibeno, nedodano.
--
--   Nova pojistka se nedíva na `next_send_at` (ten rozesilka zhasne), ale na
--   ODESLANE KROKY: komu za poslednich 21 dni odesel krok trate `onboarding-%`
--   a ta trat ma v `email_templates` dalsi krok, ten je rozdelany.
--
-- ⛔ DORUCOVACI enroll funkce se NEOMEZUJI. Tahle pojistka patri jen tam, kde se
--    clovek VYBIRA DO PRODEJNI TRATE. Funkce, ktere doruci trat samy zakladaji
--    (`enroll_manual_grant_into_onboarding` a spol.), zustavaji beze zmeny;
--    jinak by si pojistka zablokovala vlastni pokracovani.
--
-- ⛔ TELA FUNKCI JSOU VZATA ZE ZIVEHO ZNENI, ne ze starsich souboru v gitu.
--    Otisk pred zmenou: `zive-enroll-2026-09-16.sql` (vsechny ctyri funkce).
--    `upsell-nevytrhavat.sql`, `upsell-sequences.sql`, `drip-longtail.sql`
--    a `enroll-longtail-fifo.sql` jsou POZADU a spustit se NESMI.
--
-- ⛔ PRAVIDLO 8: kazde jmeno ma v `pg_proc` PRESNE JEDNU variantu signatury
--    (overeno pred psanim migrace), signatury se tady NEMENI, granty zustavaji
--    `{postgres=X/postgres,service_role=X/postgres}`.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) SPOLECNA POMOCNA FUNKCE
-- ---------------------------------------------------------------------------
-- ⭐ Jedna funkce, ne ctyri opsane poddotazy: opisy se rozejdou a pojistka pak
--    drzi jen tam, kde si toho nekdo vsimne.
-- ⛔ SECURITY INVOKER (default) je ZAMERNE: vsichni ctyri volajici jsou uz
--    SECURITY DEFINER, takze uvnitř nich tahle funkce bezi s pravy jejich
--    definera. Druhy SECURITY DEFINER by tu byl zbytecne rozsirene pravo.
-- ⛔ `revoke from public` neni volitelne: EXECUTE se nove funkci implicitne
--    udeluje roli PUBLIC, kterou `anon` i `authenticated` dedi
--    (pamet `feedback-postgres-grant-public-vs-anon`).
create or replace function public.ma_rozdelanou_dorucovaci_trat(p_email text)
returns boolean
language sql
stable
set search_path to 'public'
as $function$
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

comment on function public.ma_rozdelanou_dorucovaci_trat(text) is
  'TRUE = cloveku za poslednich 21 dni odesel krok doruci trate `onboarding-%` a ta trat '
  'ma dalsi krok. Takovy clovek se NESMI vybrat do prodejni trate. Nestoji to na '
  '`leads.next_send_at`, protoze ten rozesilka po odeslani zhasne (V7, 15. 9. 2026).';

revoke all on function public.ma_rozdelanou_dorucovaci_trat(text) from public;
revoke all on function public.ma_rozdelanou_dorucovaci_trat(text) from anon;
revoke all on function public.ma_rozdelanou_dorucovaci_trat(text) from authenticated;
grant execute on function public.ma_rozdelanou_dorucovaci_trat(text) to service_role;

-- ---------------------------------------------------------------------------
-- 2) enroll_into_upsell_coaching: jedna podminka navic v CTE `elig`
-- ---------------------------------------------------------------------------
-- proacl v dobe otisku: {postgres=X/postgres,service_role=X/postgres}
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
        --    o kroky 1 a 2 sve zaplacene doruci trate.
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

-- ---------------------------------------------------------------------------
-- 3) enroll_into_upsell_academy: tataz podminka
-- ---------------------------------------------------------------------------
-- proacl v dobe otisku: {postgres=X/postgres,service_role=X/postgres}
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
        -- ⛔⛔ [16. 9. 2026] ROZDELANA DORUCOVACI TRAT (nalez V7). Doplnuje dva radky nad
        --    sebou: ty chyti jen cloveka, ktery JE na blastu prave ted, tahle i toho,
        --    komu blast uz probehl a zhasl mu `next_send_at`.
        AND NOT public.ma_rozdelanou_dorucovaci_trat(e2.email)
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

-- ---------------------------------------------------------------------------
-- 4) enroll_into_nurture_videokurz: tataz podminka
-- ---------------------------------------------------------------------------
-- Prodava videokurz, takze do stejne kategorie patri. Rearm blok tu neni,
-- clovek se rovnou prepisuje na `nurture-videokurz`.
-- proacl v dobe otisku: {postgres=X/postgres,service_role=X/postgres}
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
        -- ⛔⛔ [16. 9. 2026] ROZDELANA DORUCOVACI TRAT (nalez V7). `next_send_at is null`
        --    ve `finished` neznamena "dojel": rozesilka ho zhasina i lidem uprostred
        --    doruci trate.
        and not public.ma_rozdelanou_dorucovaci_trat(f.email)
    )
    select email from elig limit greatest(1, p_limit)
  loop
    update leads set track='nurture-videokurz', step=0, status='active', next_send_at=now(), updated_at=now()
     where lower(email) = v_email;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5) enroll_into_longtail: tataz podminka, ale JEN v CTE `elig`
-- ---------------------------------------------------------------------------
-- ⛔ Rearm blok (prvni `update`) se ZAMERNE nemeni. Ten cloveku zadnou trat
--    neprepisuje, jen mu zapali termin na te, kterou uz ma. To je presne to,
--    co u rozdelane trate CHCEME, aby se dokoncila.
--    Meni se jen vyber do NOVE trate (`longtail-*` / `evergreen-*`).
-- proacl v dobe otisku: {postgres=X/postgres,service_role=X/postgres}
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
        -- ⛔⛔ [16. 9. 2026] ROZDELANA DORUCOVACI TRAT (nalez V7). `next_send_at is null`
        --    ve `finished` znamena "dojel" jen tehdy, kdyz ho nezhasla rozesilka.
        --    Rearm blok vys uz vetsinu takovych lidi zachytí (ma-li jejich krok sablonu),
        --    ale spolehat na poradí dvou bloku uvnitr jedne funkce neni pojistka.
        and not public.ma_rozdelanou_dorucovaci_trat(p.email)
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
$function$;

commit;

-- ---------------------------------------------------------------------------
-- OVERENI PO NASAZENI (jen cteni)
-- ---------------------------------------------------------------------------
-- 1) Pomocna funkce nema EXECUTE pro anon ani authenticated:
--      select p.oid::regprocedure, p.proacl from pg_proc p join pg_namespace n
--        on n.oid = p.pronamespace
--       where n.nspname='public' and p.proname='ma_rozdelanou_dorucovaci_trat';
--      -- ceka se {=X/postgres,postgres=X/postgres,service_role=X/postgres} MINUS radek `=X`
--      -- tedy zadny holy `=X/postgres` (to je PUBLIC).
-- 2) Granty ctyr enroll funkci se nezmenily:
--      select p.oid::regprocedure, p.proacl from pg_proc p join pg_namespace n
--        on n.oid = p.pronamespace where n.nspname='public' and p.proname like 'enroll_into_%';
--      -- ceka se 4 radky, vsechny {postgres=X/postgres,service_role=X/postgres}
-- 3) Kolik lidi ma dnes rozdelanou doruci trat (tedy koho pojistka chrani):
--      select count(*) from public.leads l where public.ma_rozdelanou_dorucovaci_trat(l.email);
