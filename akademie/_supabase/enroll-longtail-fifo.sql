-- ============================================================================
-- enroll_into_longtail: FIFO poradi fronty (20. 7. 2026)
-- ============================================================================
-- Cron jobid 17, '50 7 * * *':
--   select case when public.followups_gate_open() then public.enroll_into_longtail(150) end;
--
-- PROBLEM: puvodni telo koncilo 'select email, target from elig limit greatest(1, p_limit)'
-- BEZ ORDER BY. Postgres vraci radky v libovolnem poradi, takze pri previsu poptavky nad
-- kapacitou se o mista fakticky losovalo a clovek mohl cekat i nekolik dni jen smulou.
--
-- RESENI: FIFO podle min(updated_at), tedy kdy clovek dokoncil svuj track.
-- Kdo dobehl driv, jde driv dal. ZADNE zvyhodnovani segmentu.
-- Puvodni 'select distinct' zadny cas nenesl, proto se v CTE 'finished' zmenil na
-- group by 1,2 s min(l.updated_at).
--
-- PROC SE NIKDO NEUPREDNOSTNUJE (rozhodnuti Martina 20. 7. 2026):
-- Resend Pro nema denni limit, mesicni je 50 000 pri spotrebe ~4 100. Kapacita fronty
-- tedy neni vzacny zdroj a neni co delit. Puvodni otazka "maji mit treneri prednost?"
-- vznikla jen z limitu 50/den, ktery byl dedictvim free tarifu Resendu.
-- Limit zvednut 50 -> 100 -> 150. Pri 150 nikdo neceka ani den:
--   21. 7. dobehne 142 lidi (73 z 20. 7. + 69 z 21. 7.), vejdou se vsichni
--   22. 7. dobehne 7 treneru, 23. 7. 73 lidi, 24. 7. 70 lidi — vzdy pod kapacitou
-- Treneri tedy nikdy necekaji, i bez jakekoli priority. FIFO je tu pro predvidatelnost,
-- ne pro reseni nedostatku.
-- ============================================================================

create or replace function public.enroll_into_longtail(p_limit integer default 50)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
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
          (select lower(email) from entitlements where active and product in ('videokurz','academy','coaching')))
        and not (f.target in ('longtail-trener','longtail-kupci') and f.email in
          (select lower(email) from entitlements where active and product in ('academy','coaching')))
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
