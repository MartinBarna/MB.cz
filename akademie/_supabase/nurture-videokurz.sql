-- ============================================================
-- Barna Academy — NURTURE-VIDEOKURZ (long-nurture, fáze 2 lead-magnet trychtýře)
-- Naváže PO dokončení lead-magnet / existing-leadmagnet sekvence pro ty, co NEKOUPILI.
-- Cíl: držet vztah teplý hodnotou (tipy/ochutnávka), ne rozdat placenou knihovnu.
-- 8 týdenních mailů: 5× hodnota/dárek, 2× sleva (15 % ZACNI15, 20 % JESTE20), 1× social-proof close.
-- Stop na nákup je vestavěný v drip-send (status→'purchased' při entitlementu).
--
-- Šablony jsou v tabulce email_templates (track='nurture-videokurz', step 0..7) — vloženo přes MCP.
-- Tady je jen ENROLLMENT funkce + cron (zdroj pravdy je Supabase migrace enroll_into_nurture_videokurz_fn).
-- ============================================================

-- ENROLLMENT: najdi leady, co DOKONČILY lead-magnet/reaktivační sekvenci (next_send_at null,
-- status active, nekoupili) a přesuň je do nurture-videokurz. Vylučuje adminy, majitele
-- videokurzu/academy, odhlášené a ty, co už jsou v nějaké nurture-/upsell- větvi.
create or replace function public.enroll_into_nurture_videokurz(p_limit int default 50)
returns int language plpgsql security definer set search_path to 'public' as $function$
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
        and f.email not in (select lower(email) from entitlements where active and product in ('videokurz','academy'))
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

-- CRON: denně 7:35 (po upsell-enroll v 7:20)
-- select cron.schedule('nurture-videokurz-enroll-daily', '35 7 * * *', 'select public.enroll_into_nurture_videokurz(50);');

-- POZN.: Auto-throttle 'drip-cap-autotune' byl VYPNUT (2026-07-06) — vracel drip_daily_cap na 60/80,
-- což byl workaround na starý Resend FREE limit (100/den). Na Resend PRO (bez denního limitu) nechceme,
-- Martin chce „nic nečeká". Pokud se Resend vrátí na free → znovu zapnout throttle + snížit cap na 60.
