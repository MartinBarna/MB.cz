-- ZACHRANA ZIVEHO ZNENI `newsletter_prijemci` (15. 9. 2026, 70. sef)
-- Poriseno doslovne z produkcni DB Academy (uhmrpfsdcujbhbtumqye) pres
--   select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n
--     on n.oid = p.pronamespace where n.nspname='public' and p.proname='newsletter_prijemci';
--
-- DUVOD: `konzultace-crm-2026-09-15.sql` tuhle funkci meni o jeden radek (nalez S1
-- revize R1). Tohle je otisk stavu PRED tou zmenou, referencni bod pro diff a navrat.
-- Nic se z nej nenasazuje automaticky.
--
-- Signatura se zmenou NEMENI, granty tedy zustavaji beze zmeny.

CREATE OR REPLACE FUNCTION public.newsletter_prijemci(p_step integer)
 RETURNS TABLE(lead_id uuid, email text, track text, step integer, next_send_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select l.id, l.email, l.track, l.step, l.next_send_at
  from public.leads l
  where l.status = 'active'
    and l.consent
    -- SIROKA VARIANTA dle Martinova GO 27. 8. 2026: filtr `next_send_at is null` je ZAMERNE PRYC.
    -- 2. 9. 2026 (23. sef): kdo ma naplanovany mail do 24 h, ten se NEPUJCUJE.
    and (l.next_send_at is null or l.next_send_at > now() + interval '24 hours')
    -- ⛔ [6. 9. 2026] Trvalý seznam odhlášených, viz tydenik_prijemci.
    and not exists (select 1 from public.odhlaseni_trvale o where o.email = lower(l.email))
    and lower(l.email) not in ('ivanabarnova@seznam.cz','barnamaro@gmail.com','barnaxxx@seznam.cz')
    and lower(l.email) not like 'fitness.barna%'
    and l.track not like 'blast%'
    and l.track not like 'rozlouceni-%'
    and l.track <> 'tydenik'
    and l.track <> 'blog-newsletter'
    and not exists (select 1 from public.email_events e
                     where e.lead_id = l.id and e.type in ('bounce','complaint'))
    and not exists (select 1 from public.email_events e
                     where e.lead_id = l.id and e.type = 'sent'
                       and e.step = p_step and e.detail->>'track' = 'blog-newsletter')
    and not exists (select 1 from public.withdrawals w
                     where lower(w.email) = lower(l.email)
                       and w.created_at > now() - interval '180 days')
    and not exists (select 1 from public.newsletter_odeslani m
                     where m.step = p_step and m.lead_id = l.id and m.vraceno_at is null)
    and not exists (select 1 from public.email_events e
                     where e.lead_id = l.id and e.type in ('sent','oneoff')
                       and (e.created_at at time zone 'Europe/Prague')::date
                         = (now() at time zone 'Europe/Prague')::date)
$function$
;
