-- ============================================================================
-- Barna Academy: hybridní ceník (990 Kč/měs + 8 900 doživotně)
-- Zavádí expiraci členství. NULL = doživotní, takže se nic stávajícího nemění.
--
-- Kontext a rozhodnutí: paměť `mb-academy-pricing-mise`.
-- Psáno 28. 7. 2026, ověřeno proti živé DB projektu uhmrpfsdcujbhbtumqye.
--
-- ⚠️ POŘADÍ JE ZÁVAZNÉ. Krok 2 musí proběhnout hned po kroku 1, jinak by mezi
--    nimi byla chvíle, kdy sloupec existuje, ale brána ho ignoruje.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) Sloupec expirace
-- ---------------------------------------------------------------------------
-- NULL = doživotní přístup. Všech 449 stávajících řádků zůstane NULL, takže
-- se pro nikoho z nich nemění vůbec nic. Nedestruktivní, jde vrátit dropem.
alter table public.entitlements
  add column if not exists expires_at timestamptz;

comment on column public.entitlements.expires_at is
  'Konec přístupu. NULL = doživotní (SimpleShop 8 900, koučink, ruční grant). '
  'Vyplněné = předplatné (source=stripe-monthly), obnovuje ho academy-stripe-webhook '
  'při každé invoice.paid. Kdo čte entitlements service_rolem, MUSÍ expiraci řešit sám, '
  'RLS ho nechrání.';

-- Index kvůli hlídání a win-back dotazům (kdo vypršel a má dostat nabídku obnovy).
create index if not exists entitlements_expires_at_idx
  on public.entitlements (expires_at)
  where expires_at is not null;

-- ---------------------------------------------------------------------------
-- 2) Brána do studia
-- ---------------------------------------------------------------------------
-- ⛔ TATO FUNKCE JE JEDINÁ BRÁNA. Ověřeno v pg_proc 28. 7.: existuje v JEDINÉ
--    variantě `has_entitlement(text)`, takže `create or replace` se stejnou
--    signaturou ji opravdu nahradí a nevyrobí druhou vedle.
--    Past s přetíženými funkcemi: paměť `feedback-create-or-replace-neni-nahrada`.
--
-- Prochází přes ni všech PĚT RLS politik:
--    lesson_content.lesson_content_member_read      (SELECT)
--    progress.progress_write_own                    (INSERT)
--    videokurz_manifest.videokurz_manifest_read     (SELECT)
--    storage.objects.vk_materials_read              (SELECT, videokurz-materialy)
--    storage.objects.client_docs_read               (SELECT, client-docs)
-- a ŠESTOU cestou je edge funkce `ai-martin`, která ji volá přes RPC
-- s tokenem uživatele. Tím je pokrytá i ona.
--
-- Zachováno beze změny: videokurz je odemčený i držitelům 'academy' a 'coaching'
-- (mají ho v ceně). Důsledek je žádoucí: když vyprší měsíční Academy, zamkne se
-- správně i videokurz.
create or replace function public.has_entitlement(p_product text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.entitlements
    where lower(email) = lower(auth.jwt() ->> 'email')
      and active = true
      and (expires_at is null or expires_at > now())
      and (product = p_product or (p_product = 'videokurz' and product in ('academy','coaching')))
  );
$function$;

-- ---------------------------------------------------------------------------
-- 3) Druh členství (pro kachlici Tvůj Coach ve studiu)
-- ---------------------------------------------------------------------------
-- ⚠️ PROČ TO VŮBEC MUSÍ EXISTOVAT: ve studiu je kachlice, která tvrdí
--    „rok VIP verze appky máš v ceně členství". To platí JEN pro doživotní
--    variantu. Měsíčnímu členovi (990 Kč) by lhala hned po přihlášení a poslala
--    ho do appky, která ho nepustí dál. `has_entitlement` vrací jen ano/ne,
--    takže tyhle dva případy rozlišit neumí.
--
-- Vrací: 'lifetime' = doživotní (bez expirace), 'monthly' = platné předplatné,
--        null = nemá nic (nebo vypršelo).
create or replace function public.academy_membership_kind()
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when exists (
      select 1 from public.entitlements
      where lower(email) = lower(auth.jwt() ->> 'email')
        and product = 'academy' and active = true and expires_at is null
    ) then 'lifetime'
    when exists (
      select 1 from public.entitlements
      where lower(email) = lower(auth.jwt() ->> 'email')
        and product = 'academy' and active = true and expires_at > now()
    ) then 'monthly'
    else null
  end;
$function$;

-- Anonymní uživatel ji volat nepotřebuje, přihlášený ano.
grant execute on function public.academy_membership_kind() to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Win-back: enroll funkce musí přestat považovat expirovaného za člena
-- ---------------------------------------------------------------------------
-- ⛔ PROČ TO NENÍ VOLITELNÉ. Tyhle funkce vylučují z nabídek každého, kdo má
--    `active = true`. Kdyby se nechaly být, expirovaný měsíční člen by ztratil
--    přístup a ZÁROVEŇ by ho systém dál držel mezi kupci, takže by mu nikdy
--    nepřišla nabídka obnovy. Tiše by nám vypadl.
--    Vzorec „nová cesta, staré pravidlo": [[feedback-nova-cesta-stare-pravidlo]].
--
-- Proti živému znění z 28. 7. se v každé funkci mění POUZE podmínky, které čtou
-- `entitlements`. Zbytek tělesa je zkopírovaný beze změny.

-- 4a) Upsell na Academy: expirovaný měsíční člen se vrací mezi oslovitelné.
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
        AND e2.email NOT IN (SELECT lower(email) FROM leads WHERE track LIKE 'upsell-%')
        AND e2.email NOT IN (SELECT lower(email) FROM leads WHERE status IN ('unsubscribed','bounced','paused'))
        -- OBECNE: nikoho, komu bezi jakakoli jina sekvence nez upsell
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

-- 4b) Longtail: dvě místa, obě čtou entitlements.
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
      -- min(updated_at) = kdy clovek dokoncil svuj track (posledni posunuti kroku).
      -- Driv tu bylo 'select distinct', ktere zadny cas neneslo, a proto neslo radit.
      select lower(l.email) as email,
        case
          when l.track = 'trener-kit' then 'longtail-trener'
          when l.track in ('onboarding-videokurz','onboarding-nakup-videokurz','onboarding-grant-videokurz') then 'longtail-kupci'
          else 'longtail-consumer'
        end as target,
        min(l.updated_at) as dokonceno
      from leads l
      where l.status = 'active'
        and l.next_send_at is null
        and l.track in ('nurture-videokurz','lead-magnet-tool','trener-kit','onboarding-videokurz','onboarding-nakup-videokurz','onboarding-grant-videokurz')
      group by 1, 2
    ),
    elig as (
      select f.email, f.target, f.dokonceno from finished f
      where f.email not in (select email from admins)
        and f.email not in (select lower(email) from leads where track like 'longtail-%')
        and f.email not in (select lower(email) from leads where status in ('unsubscribed','bounced'))
        and not (f.target = 'longtail-consumer' and f.email in
          (select lower(email) from entitlements where active and product in ('videokurz','academy','coaching')
             and (expires_at is null or expires_at > now())))
        and not (f.target in ('longtail-trener','longtail-kupci') and f.email in
          (select lower(email) from entitlements where active and product in ('academy','coaching')
             and (expires_at is null or expires_at > now())))
    )
    select email, target from elig
     order by dokonceno asc, email asc
     limit greatest(1, p_limit)
  loop
    update leads set track = r.target, step = 0, status = 'active', next_send_at = now(), updated_at = now()
     where lower(email) = r.email;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

-- 4c) Nurture videokurz.
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
      -- leady, co DOKONČILY lead-magnet / reaktivační sekvenci (poslední krok = next_send_at null)
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
$function$;

commit;

-- ============================================================================
-- OVĚŘENÍ PO MIGRACI (spustit, nespoléhat na to, že „migrace prošla")
-- ============================================================================
-- a) Změna se dostala do TÉ funkce, kterou kód opravdu volá:
--      select pg_get_functiondef(oid) from pg_proc where proname='has_entitlement';
--    Musí vrátit PRÁVĚ JEDEN řádek a obsahovat 'expires_at'.
--
-- b) Nikomu stávajícímu se nic nezměnilo (čekáme 0):
--      select count(*) from entitlements where expires_at is not null;
--
-- c) Živý test zamčení. ⚠️ Dělat na TESTOVACÍM e-mailu, ne na členovi:
--      insert into entitlements (email, product, active, source, expires_at)
--      values ('fitness.barna+expirace@gmail.com','academy',true,'test', now() - interval '1 day');
--    Přihlásit se tím účtem do studia -> lekce NESMÍ jít otevřít.
--    Pak řádek smazat:
--      delete from entitlements where email='fitness.barna+expirace@gmail.com' and source='test';
--
-- d) Skutečný člen se pořád dostane dovnitř (Martinův Chrome, otevřít lekci).
-- ============================================================================
