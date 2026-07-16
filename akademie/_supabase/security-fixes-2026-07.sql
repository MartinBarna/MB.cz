-- ============================================================
-- security-fixes-2026-07.sql — bezpečnostní a mailingové opravy v DB
-- ------------------------------------------------------------
-- POZOR: Tento skript NEBYL spuštěn — jen připraven (revize 2026-07-16
-- byla read-only). Spustit ručně v Supabase SQL editoru (projekt
-- uhmrpfsdcujbhbtumqye) AŽ PO schválení Martinem. Bloky 1–8 jsou
-- idempotentní (REVOKE / CREATE OR REPLACE / IF NOT EXISTS / UPDATE
-- na stejnou hodnotu). Blok 9 je jednorázová datová korekce a je
-- ZAKOMENTOVANÝ — má vlastní podmínky spuštění (viz komentář u něj).
--
-- Všechny definice vychází z aktuálního stavu DB (pg_get_functiondef /
-- pg_policies, načteno 2026-07-16) — měněné řádky jsou označené "-- FIX".
-- ============================================================


-- ============================================================
-- BLOK 1 — enroll_into_longtail: odebrat EXECUTE anonymům
-- ------------------------------------------------------------
-- Proč: funkce je SECURITY DEFINER a jako jediná ze čtveřice enroll_*
-- šla volat veřejným anon klíčem (/rest/v1/rpc/enroll_into_longtail).
-- Kdokoli tak mohl přeřadit až 50 leadů do longtail tracku se
-- next_send_at=now() → okamžité maily, rozbití funnelu, pálení Resend
-- kvóty. Sourozenci (upsell/nurture) už REVOKE mají — tohle je zjevně
-- opomenutý kus. Cron 'longtail-enroll-daily' běží jako superuser,
-- takže se nic nerozbije.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.enroll_into_longtail(integer) FROM PUBLIC, anon, authenticated;
-- (FROM PUBLIC je nutne: funkce mela vychozi =X grant pro PUBLIC, ktery by REVOKE jen pro anon obesel)


-- ============================================================
-- BLOK 2 — referral_confirm_due: potvrzovat jen reálné nákupy
-- ------------------------------------------------------------
-- Proč: původní verze překlápěla pending→confirmed POUZE podle stáří
-- (14 dní). Podvržený pending referral (např. přes referral-webhook)
-- by se tak sám "potvrdil" na store kredit 150–300 Kč bez reálného
-- prodeje. Nově se potvrdí jen referral, jehož buyer_email má AKTIVNÍ
-- entitlement odpovídající produktu referralu (academy/coaching
-- pokrývají i referral na videokurz — vyšší produkt nákup nepopírá).
-- Nepotvrzené referraly zůstávají pending (žádné mazání — kdyby šlo
-- o zpožděný grant, potvrdí se v příštím běhu cronu).
-- ============================================================
CREATE OR REPLACE FUNCTION public.referral_confirm_due()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.referrals r
     set status='confirmed', confirmed_at=now()
   where r.status='pending'
     and r.source='coupon'
     and r.created_at < now() - interval '14 days'
     -- FIX: kredit jen když kupující reálně vlastní produkt (aktivní entitlement)
     and exists (
       select 1 from public.entitlements e
       where lower(e.email) = lower(r.buyer_email)
         and e.active = true
         and (e.product = r.product
              or (r.product = 'videokurz' and e.product in ('academy','coaching')))
     );
$function$;


-- ============================================================
-- BLOK 3 — has_entitlement: koučink implikuje videokurz
-- ------------------------------------------------------------
-- Proč: koučinkoví klienti platí nejvyšší balíček, ale bez explicitního
-- 'videokurz' entitlementu jim has_entitlement('videokurz') vracelo
-- false → neviděli materiály videokurzu (storage policy
-- vk_materials_read) ani členský obsah, který Academy členové mají.
-- Academy→videokurz implikace už existovala; doplňujeme minimálně
-- coaching→videokurz (nic jiného se nemění).
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_entitlement(p_product text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.entitlements
    where lower(email) = lower(auth.jwt() ->> 'email')
      and active = true
      -- FIX: 'academy' NEBO 'coaching' implikují 'videokurz' (dřív jen academy)
      and (product = p_product or (p_product = 'videokurz' and product in ('academy','coaching')))
  );
$function$;


-- ============================================================
-- BLOK 4 — storage policy client_docs_read: zamknout shared/
-- ------------------------------------------------------------
-- Proč: původní policy platila pro roli public (= i anon) a větev
-- name LIKE 'shared/%' neměla ŽÁDNOU další podmínku → kdokoli
-- s veřejným anon klíčem mohl číst/stahovat sdílené soubory koučinku
-- (bucket client-docs). Nově: jen přihlášení (authenticated), a shared/
-- soubory navíc jen s aktivním coaching entitlementem. Vlastní složka
-- (lower(email)/...) zůstává čitelná majiteli beze změny.
-- ============================================================
DROP POLICY IF EXISTS client_docs_read ON storage.objects;
CREATE POLICY client_docs_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-docs'
    AND (
      -- FIX: shared/ jen pro koučinkové klienty (dřív bez podmínky, role public)
      (name LIKE 'shared/%' AND public.has_entitlement('coaching'))
      OR name LIKE lower(COALESCE(auth.jwt() ->> 'email', '')) || '/%'
    )
  );


-- ============================================================
-- BLOK 5 — enroll_into_longtail: noví kupci videokurzu do longtail-kupci
-- ------------------------------------------------------------
-- Proč: funkce sourcovala jen legacy track 'onboarding-videokurz'.
-- Noví kupci ale dostávají track 'onboarding-nakup-videokurz' (webhook)
-- a ručně grantovaní 'onboarding-grant-videokurz' (admin) — po
-- doběhnutí onboardingu pro ně nastalo trvalé ticho (žádný
-- longtail-kupci, žádný UPGRADE800). Jediná změna proti aktuální
-- definici = 2 nové tracky v CASE a v IN listu (označeno FIX).
-- ============================================================
CREATE OR REPLACE FUNCTION public.enroll_into_longtail(p_limit integer DEFAULT 50)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count int := 0;
  r record;
begin
  for r in
    with admins as (
      select lower(trim(x)) as email
      from unnest(string_to_array(coalesce((select value from app_config where key='admin_emails'),''), ',')) as x
      where trim(x) <> ''
    ),
    finished as (
      select distinct lower(l.email) as email,
        case
          when l.track = 'trener-kit' then 'longtail-trener'
          -- FIX: i nové onboarding tracky kupců -> longtail-kupci
          when l.track in ('onboarding-videokurz','onboarding-nakup-videokurz','onboarding-grant-videokurz') then 'longtail-kupci'
          else 'longtail-consumer'
        end as target
      from leads l
      where l.status = 'active'
        and l.next_send_at is null
        -- FIX: doplněny 'onboarding-nakup-videokurz' a 'onboarding-grant-videokurz'
        and l.track in ('nurture-videokurz','lead-magnet-tool','trener-kit','onboarding-videokurz','onboarding-nakup-videokurz','onboarding-grant-videokurz')
    ),
    elig as (
      select f.email, f.target from finished f
      where f.email not in (select email from admins)
        and f.email not in (select lower(email) from leads where track like 'longtail-%')
        and f.email not in (select lower(email) from leads where status in ('unsubscribed','bounced'))
        and not (f.target = 'longtail-consumer' and f.email in
          (select lower(email) from entitlements where active and product in ('videokurz','academy','coaching')))
        and not (f.target in ('longtail-trener','longtail-kupci') and f.email in
          (select lower(email) from entitlements where active and product in ('academy','coaching')))
    )
    select email, target from elig limit greatest(1, p_limit)
  loop
    update leads set track = r.target, step = 0, status = 'active', next_send_at = now(), updated_at = now()
     where lower(email) = r.email;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;


-- ============================================================
-- BLOK 6 — enroll_into_upsell_coaching/academy: nekrást leady
--          uprostřed rozjeté longtail série
-- ------------------------------------------------------------
-- Proč: upsell enroll (cron 7:10/7:20) vylučoval jen rozjetý
-- onboarding, ne rozjetý longtail — lead uprostřed longtail-kupci
-- (např. lk-5 s UPGRADE800) byl přetažen do upsellu a zbytek série
-- už nikdy nedostal. Nově se lead s aktivním longtail-% trackem
-- (next_send_at IS NOT NULL) nechá doběhnout. Jediná změna proti
-- aktuálním definicím = 1 podmínka v elig CTE (označeno FIX).
-- ============================================================
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
        AND r2.email NOT IN (SELECT lower(email) FROM leads WHERE track LIKE 'upsell-%')
        AND r2.email NOT IN (SELECT lower(email) FROM leads WHERE status IN ('unsubscribed','bounced','paused'))
        AND r2.email NOT IN (SELECT lower(email) FROM leads WHERE track LIKE 'onboarding-%' AND next_send_at IS NOT NULL)
        -- FIX: rozjetý longtail nechat doběhnout (dřív ho upsell přerušil uprostřed)
        AND r2.email NOT IN (SELECT lower(email) FROM leads WHERE track LIKE 'longtail-%' AND next_send_at IS NOT NULL)
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

CREATE OR REPLACE FUNCTION public.enroll_into_upsell_academy(p_limit integer DEFAULT 25)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count int := 0; v_min int := 73; r record;
BEGIN
  -- prah = pocet dokoncenych vk-* lekci (73 = ~40 % z 182); ladi se v app_config bez zasahu do kodu
  SELECT COALESCE(NULLIF(value,'')::int, 73) INTO v_min FROM app_config WHERE key='upsell_academy_min_lessons';
  IF v_min IS NULL THEN v_min := 73; END IF;
  FOR r IN
    WITH vk AS (
      SELECT DISTINCT lower(e.email) AS email, u.id AS user_id
      FROM entitlements e JOIN auth.users u ON lower(u.email) = lower(e.email)
      WHERE e.active AND e.product = 'videokurz'
        AND lower(e.email) NOT IN (SELECT lower(email) FROM entitlements WHERE product='academy' AND active)
    ),
    engaged AS (
      SELECT vk.email FROM vk
      JOIN progress p ON p.user_id = vk.user_id AND p.completed AND p.lesson_id LIKE 'vk-%'
      GROUP BY vk.email HAVING count(*) >= v_min
    ),
    elig AS (
      SELECT e2.email FROM engaged e2
      WHERE e2.email NOT IN (SELECT lower(email) FROM customer_contacts WHERE tags && array['coaching-active'])
        AND e2.email NOT IN (SELECT lower(email) FROM leads WHERE track LIKE 'upsell-%')
        AND e2.email NOT IN (SELECT lower(email) FROM leads WHERE status IN ('unsubscribed','bounced','paused'))
        AND e2.email NOT IN (SELECT lower(email) FROM leads WHERE track LIKE 'onboarding-%' AND next_send_at IS NOT NULL)
        -- FIX: rozjetý longtail nechat doběhnout (dřív ho upsell přerušil uprostřed)
        AND e2.email NOT IN (SELECT lower(email) FROM leads WHERE track LIKE 'longtail-%' AND next_send_at IS NOT NULL)
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


-- ============================================================
-- BLOK 7 — withdrawals: sloupec ip pro rate-limit
-- ------------------------------------------------------------
-- Proč: edge funkce withdrawal dostala anti-abuse rate-limit per IP/24h
-- (spamování cizích adres "potvrzením odstoupení" + pálení Resend
-- kvóty). Dokud sloupec neexistuje, funkce IP check tiše přeskakuje
-- a insert padá na fallback bez IP — tenhle blok díru dozavírá.
-- Indexy kryjí oba rate-limit dotazy (per e-mail a per IP za 24 h).
-- ============================================================
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS ip text;
CREATE INDEX IF NOT EXISTS withdrawals_email_created_idx ON public.withdrawals (email, created_at);
CREATE INDEX IF NOT EXISTS withdrawals_ip_created_idx ON public.withdrawals (ip, created_at);


-- ============================================================
-- BLOK 8 — drip_daily_cap: 2000 → 500 (reálná pojistka)
-- ------------------------------------------------------------
-- Proč: cap 2000/den = fakticky vypnutá pojistka (reálný provoz je
-- 24–134 mailů/den). Cap NEchrání Resend Free limit (jedeme na Pro,
-- 50k/měs.), ale runaway scénář (bug/flood v enroll logice) — 500/den
-- nechá rezervu pro transakční maily (rescue/milníky/digest) i Auth
-- SMTP a přitom nikdy neomezí normální provoz. Komentář v drip-send
-- už s hodnotou 500 počítá (fallback v kódu = 500).
-- ============================================================
UPDATE public.app_config SET value = '500' WHERE key = 'drip_daily_cap';


-- ============================================================
-- BLOK 9 — DATOVÁ KOREKCE (ZAKOMENTOVÁNO): zasažené trenérské leady
-- ------------------------------------------------------------
-- ⚠️ Spustit AŽ PO schválení Martinem + zvážit korekční mail.
--
-- Kontext: regrese v lead-capture posílala trenéry z /pro-trenery do
-- konzumního tracku 'lead-magnet' (žena/other makro-plán + prodej
-- videokurzu) místo 'trener-kit' (startovací kit + Academy). K 16. 7.
-- je zasaženo 26 leadů (12.–15. 7., číslo den ode dne roste, dokud
-- není nasazena opravená lead-capture — proto UPDATE cílí podmínkou,
-- ne výčtem). Fix funkce je v repu; tenhle blok přeřadí zasažené leady
-- na začátek správné sekvence (step 0 = doručení kitu, který mailem
-- nikdy nedostali).
--
-- Poznámky PŘED spuštěním:
--  * status='active' v podmínce úmyslně — kdo se mezitím odhlásil,
--    toho nereaktivovat.
--  * Zasažení už dostali 1–2 maily z lead-magnet ('Tady máš svůj
--    plán') — zvážit krátký korekční mail ("posílám správný startovací
--    kit pro trenéry, předchozí mail patřil jinému programu")
--    NEBO nechat jen tiše naběhnout kit-0; rozhodne Martin.
--  * Spustit ideálně těsně PO deployi opravené lead-capture, ať
--    nepřibývají další zasažení.
--
-- UPDATE public.leads
--    SET track = 'trener-kit',
--        step = 0,
--        next_send_at = now(),
--        updated_at = now()
--  WHERE source = 'pro-trenery'
--    AND track = 'lead-magnet'
--    AND status = 'active';
