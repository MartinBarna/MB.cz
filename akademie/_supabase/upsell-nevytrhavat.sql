-- ============================================================================
-- Upsell funkce: nevytrhavat lidi z rozdelane sekvence (20. 7. 2026)
-- ============================================================================
-- Cron jobid 14 '10 7 * * *' enroll_into_upsell_academy(25)
-- Cron jobid 11 '20 7 * * *' enroll_into_upsell_coaching(25)
-- (oba obalene v `case when public.followups_gate_open() then ... end`)
--
-- PROBLEM: obe funkce vylucovaly jen tracky 'onboarding-%' a 'longtail-%' s bezicim
-- next_send_at. NEvylucovaly 'lead-magnet', 'existing-leadmagnet', 'trener-kit'
-- ani 'nurture-videokurz'.
-- V tabulce leads je 1 clovek = 1 radek (664 radku / 664 unikatnich e-mailu), takze
-- `UPDATE leads SET track=...` NENI pridani do dalsi sekvence, ale PREPIS te stavajici.
-- Clovek tedy prisel o pozici v rozdelane sekvenci a uz se do ni nevratil.
--
-- RESENI: misto vyjmenovavani dalsich tracku jedna OBECNA podminka:
--   AND email NOT IN (SELECT lower(email) FROM leads
--                      WHERE next_send_at IS NOT NULL AND track NOT LIKE 'upsell-%')
-- Pokryje i tracky, ktere teprve vzniknou. Nahradila puvodni dve specificke podminky
-- (onboarding-%, longtail-%), ktere jsou jejı podmnozinou.
--
-- DOPAD PRI NASAZENI: 0 lidi. Overeno spustenim obou variant elig CTE vedle sebe,
-- stara i nova vratily 0. Je to pojistka do budoucna, ne hasici zasah.
-- Zbytkove riziko, ktere to zavira: 53 lidi prave bezi na 'trener-kit' a stacilo by,
-- aby jeden z nich koupil videokurz. Upsell by ho z kitu vytrhl a on by uz nedostal
-- zbytek trenerskeho obsahu, za ktery se prihlasil.
--
-- POZN.: drip-send diru castecne neutralizoval uz driv (index.ts:341 zastavuje
-- lead-magnet / existing-leadmagnet / nurture- pro majitele produktu), ale
-- 'trener-kit' kontroluje jen owns.academy (:344), takze majitel videokurzu
-- uprostred trener-kitu chraneny nebyl.
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
        AND r2.email NOT IN (SELECT lower(email) FROM leads WHERE track LIKE 'upsell-%')
        AND r2.email NOT IN (SELECT lower(email) FROM leads WHERE status IN ('unsubscribed','bounced','paused'))
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
