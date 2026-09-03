drop function if exists public.link_check_souhrn();

create function public.link_check_souhrn()
returns table (posledni_beh timestamptz, celkem int, chyb int, vlastni_neovereno int, prvni_chyby text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with posledni as (
    select max(run_at) as t from public.link_check
  ),
  oznaceno as (
    select l.*,
           (l.url ~* '^https?://(www\.)?martinbarna\.cz(/|$)'
             and (l.http_status = 401 or l.poznamka like 'NELZE OVĚŘIT:%')) as vlastni_blok
    from public.link_check l, posledni p
    where l.run_at = p.t
  )
  select p.t,
         (select count(*)::int from oznaceno),
         (select count(*)::int from oznaceno where not ok and not vlastni_blok),
         (select count(*)::int from oznaceno where not ok and vlastni_blok),
         (select string_agg(o.url || ' (' || coalesce(o.http_status::text, o.poznamka, '?') || ')', E'\n')
            from (select * from oznaceno o2
                   where not o2.ok and not o2.vlastni_blok
                   order by o2.id limit 10) o)
  from posledni p;
$function$;
