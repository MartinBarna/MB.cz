-- ============================================================================
-- VSTUPY DO TRATÍ vip-free, vip-kupci, vip-leady (mosty + zápis stávajících lidí + návrat)
-- ⛔⛔ NÁVRH, NESPOUŠTĚT. Připraveno 9. 10. 2026 na větvi cloud/mailing-navrh-1009.
-- ⛔ Pořadí nasazení (MAILING-NAVRH-1009.md, kap. 7):
--    0) 00-kontroly-pred-spustenim.sql (jen čtení) a porovnat se živou DB
--    1) deploy drip-send s 04-drip-send-vip.patch (stop pravidla + brána zápisu pro vip-free)
--    2) 01-sablony-insert.sql (inertní) → TEST mailů na fitness.barna@gmail.com → Martinovo „pošli ostro"
--    3) TENHLE soubor, část A (mosty) = od té chvíle do tratí padají noví lidé
--    4) část B a C (zápis stávajících + návrat) až po týdnu na mostech, když nic nehoří
-- ⛔ Obráceně (mosty dřív než deploy) by drip-send neznal stop pravidla vip-* a člen Academy
--    nebo klient koučinku by dostal nabídku VIP.
-- ⛔ Živé SQL funkce a `navazujici_trate` se před zásahem čtou ZE ŽIVÉ DB (pg_get_functiondef,
--    select value), nikdy z gitu. Tenhle soubor počítá s jejich stavem z repa k 16. 9. 2026.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A) MOSTY (`app_config.navazujici_trate`): kam člověk spadne na KONCI své tratě
-- ----------------------------------------------------------------------------
-- Pojistky mostu dělá drip-send sám (pravidla.ts): cíl nesmí prodávat, co člověk vlastní
-- (shouldStop s KROK_PRO_MOST), cíl musí mít krok 0 a ⭐ KDO UŽ V CÍLOVÉ TRATI BYL, TOMU SE
-- MOST ZRUŠÍ (email_events, detail.track). To je razítko „trať jen jednou".
-- Výstup z vip-*: ŽÁDNÝ most. Dojetou trať sebere `enroll_into_longtail` (7:50) a pošle
-- člověka tam, kam by šel i bez VIP série (longtail-consumer / longtail-kupci / evergreen-*).
--
-- ⚠️ U tc-* tratí dnes nejspíš vede most do longtail-consumer (mostBlokujeNeaktivitu s tím počítá).
--    Tady se PŘEPISUJE na vip-free. Neaktivní člověk (nezapisuje) pak ve vip-free nedostane
--    nic a po 7 dnech skončí v pauze, stejně jako dnes na mostě do longtailu.
begin;
do $mig$
declare stary text; novy jsonb;
begin
  select value into stary from public.app_config where key = 'navazujici_trate';
  raise notice 'navazujici_trate PŘED: %', coalesce(stary, '(klíč chybí)');
  novy := coalesce(nullif(trim(coalesce(stary, '')), '')::jsonb, '{}'::jsonb) || jsonb_build_object(
    -- Free uživatelé appky (registrace přepíná do tc-zkusebka, starší běhy tc-free)
    'tc-zkusebka', jsonb_build_object('track', 'vip-free', 'po_dnech', 3),
    'tc-free',     jsonb_build_object('track', 'vip-free', 'po_dnech', 3),
    -- majitelé videokurzu po onboardingu (koupený i ručně udělený)
    'onboarding-nakup-videokurz', jsonb_build_object('track', 'vip-kupci', 'po_dnech', 7),
    'onboarding-grant-videokurz', jsonb_build_object('track', 'vip-kupci', 'po_dnech', 7),
    -- leady bez nákupu na konci akvizice (lead-magnet → nurture-videokurz jde cronem, most až z konce nurture)
    'nurture-videokurz', jsonb_build_object('track', 'vip-leady', 'po_dnech', 4),
    'lead-magnet-tool',  jsonb_build_object('track', 'vip-leady', 'po_dnech', 4),
    'nurture-pro-vas',   jsonb_build_object('track', 'vip-leady', 'po_dnech', 4)
  );
  insert into public.app_config (key, value) values ('navazujici_trate', novy::text)
  on conflict (key) do update set value = excluded.value, updated_at = now();
  raise notice 'navazujici_trate PO: %', novy::text;
end
$mig$;
commit;
-- Vypnutí mostů do VIP: odebrat klíče, např.
--   update app_config set value = (value::jsonb - 'tc-zkusebka' - 'tc-free' - 'onboarding-nakup-videokurz'
--     - 'onboarding-grant-videokurz' - 'nurture-videokurz' - 'lead-magnet-tool' - 'nurture-pro-vas')::text,
--     updated_at = now() where key = 'navazujici_trate';
--   (a pak vrátit původní hodnotu z notice „PŘED", pokud tam něco bylo)

-- ----------------------------------------------------------------------------
-- B) ZÁPIS STÁVAJÍCÍCH LIDÍ (backlog), dávkově, max p_limit denně na trať
-- ----------------------------------------------------------------------------
-- Bere jen dva bezpečné stavy, aby se nikomu nezahodila rozjetá série (CLAUDE.md 25. 7.):
--   (1) dojetá trať: next_send_at je null a krok už nemá šablonu (čeká na enroll_into_longtail),
--   (2) longtail-* / evergreen-*, kde další mail přijde nejdřív za 7 dní. Ti si původní trať,
--       krok i termín uloží do meta.vip_vrat a po VIP sérii se vrátí (funkce C).
-- Nebere: odhlášené, bounce/complaint, trvale odhlášené, adminy, kdo kdy platil appku
-- (bonusový videokurz z appky nebo trať onboarding-nakup-tvujcoach), kdo tuhle trať už měl,
-- kdo dostal JAKOUKOLI vip-* trať (zápis stávajících dá člověku nejvýš jednu VIP sérii),
-- a kdo dostal mail v posledních 3 dnech (žádné dva maily po sobě).
create or replace function public.vip_zapis_backlog(p_track text, p_limit integer default 25)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_count int := 0;
  r record;
begin
  if p_track not in ('vip-free', 'vip-kupci', 'vip-leady') then
    raise exception 'vip_zapis_backlog: neznámá trať %', p_track;
  end if;
  -- Bez kroku 0 by drip-send člověka jen „dokončil" a ten by ztratil místo v longtailu.
  if not exists (select 1 from email_templates t where t.track = p_track and t.step = 0) then
    raise exception 'vip_zapis_backlog: trať % nemá krok 0, nic nezapisuju', p_track;
  end if;

  for r in
    with admins as (
      select lower(trim(x)) as email
        from unnest(string_to_array(coalesce((select value from app_config where key = 'admin_emails'), ''), ',')) as x
       where trim(x) <> ''
    ),
    aktivni as (
      select lower(email) as email, product from entitlements
       where active and (expires_at is null or expires_at > now())
    ),
    appka_platil as (
      select lower(email) as email from entitlements
       where source in ('rocni-vip-bonus', 'rocni-vip-bonus-academy')
      union
      select lower(l.email) from leads l
        join email_events e on e.lead_id = l.id
       where e.type = 'sent' and e.detail->>'track' = 'onboarding-nakup-tvujcoach'
    ),
    kandidati as (
      select l.id, lower(l.email) as email, l.track, l.step, l.next_send_at
        from leads l
       where l.status = 'active'
         and (
           (l.next_send_at is null
             and l.updated_at < now() - interval '12 hours'
             and l.track not in ('blog-newsletter', 'tydenik', 'onboarding-coaching')
             and l.track not like 'blast%' and l.track not like 'rozlouceni-%' and l.track not like 'vip-%'
             and not exists (select 1 from email_templates t where t.track = l.track and t.step = l.step))
           or
           ((l.track like 'longtail-%' or l.track like 'evergreen-%')
             and l.next_send_at > now() + interval '7 days')
         )
    )
    select k.* from kandidati k
     where k.email not in (select email from admins)
       and k.email not in (select email from appka_platil)
       and not exists (select 1 from odhlaseni_trvale o where o.email = k.email)
       and not exists (select 1 from email_events e where e.lead_id = k.id and e.type in ('bounce', 'complaint'))
       and not exists (select 1 from email_events e where e.lead_id = k.id and e.type = 'sent' and e.detail->>'track' like 'vip-%')
       and not exists (select 1 from email_events e where e.lead_id = k.id and e.type = 'sent' and e.created_at > now() - interval '3 days')
       and case p_track
             -- leady bez nákupu; uživatelé appky (tc-*) patří do vip-free
             when 'vip-leady' then
               k.email not in (select email from aktivni where product in ('videokurz', 'academy', 'coaching'))
               and not exists (select 1 from email_events e where e.lead_id = k.id and e.type = 'sent' and e.detail->>'track' like 'tc-%')
             -- majitel videokurzu bez Academy a bez AKTIVNÍHO koučinku (ex-klient smí: appka není win-back)
             when 'vip-kupci' then
               k.email in (select email from aktivni where product = 'videokurz')
               and k.email not in (select email from aktivni where product in ('academy', 'coaching'))
             -- má účet v appce (prošel zkušebkovou nebo free tratí) a nemá Academy ani koučink
             when 'vip-free' then
               k.email not in (select email from aktivni where product in ('academy', 'coaching'))
               and exists (select 1 from email_events e where e.lead_id = k.id and e.type = 'sent'
                            and e.detail->>'track' in ('tc-zkusebka', 'tc-free'))
           end
     order by k.next_send_at nulls first
     limit greatest(1, p_limit)
  loop
    -- Podmíněný update: kdyby člověka mezitím přesunul cron nebo hook, nic se nepřepíše.
    update leads
       set meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object(
                    'vip_zapis', now(),
                    'vip_vrat', case when r.next_send_at is null then null
                                     else jsonb_build_object('track', r.track, 'step', r.step, 'next_send_at', r.next_send_at) end),
           track = p_track, step = 0, next_send_at = now(), updated_at = now()
     where id = r.id and status = 'active' and track = r.track and step = r.step
       and next_send_at is not distinct from r.next_send_at;
    if found then
      insert into email_events (lead_id, step, type, detail)
      values (r.id, r.step, 'bridged', jsonb_build_object('track', r.track, 'z', r.track, 'na', p_track, 'pojistka', 'vip_zapis_backlog'));
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$function$;
revoke all on function public.vip_zapis_backlog(text, integer) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- C) NÁVRAT NA PŮVODNÍ TRAŤ po dojetí VIP série (jen ti, kdo přišli z longtailu/evergreenu)
-- ----------------------------------------------------------------------------
-- ⚠️ Musí běžet PŘED enroll_into_longtail (7:50), jinak by je ten poslal do longtailu od kroku 0.
--    Enroll navíc čeká 12 h od dojetí, takže denní běh v 7:40 má vždycky přednost.
-- Další mail původní trati přijde nejdřív za 3 dny (žádné dva maily po sobě).
create or replace function public.vip_vrat_na_puvodni_trat(p_limit integer default 200)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_count int := 0;
begin
  with k as (
    select l.id, l.track as z, l.step as krok, l.meta->'vip_vrat' as v
      from leads l
     where l.track like 'vip-%'
       and l.status = 'active'
       and l.next_send_at is null
       and jsonb_typeof(l.meta->'vip_vrat') = 'object'
       and not exists (select 1 from email_templates t where t.track = l.track and t.step = l.step)
     limit greatest(1, p_limit)
     for update skip locked
  ), u as (
    update leads l
       set track = k.v->>'track',
           step = (k.v->>'step')::int,
           next_send_at = greatest((k.v->>'next_send_at')::timestamptz, now() + interval '3 days'),
           meta = l.meta - 'vip_vrat',
           updated_at = now()
      from k
     where l.id = k.id
    returning l.id, k.z, k.krok, k.v->>'track' as na
  )
  insert into email_events (lead_id, step, type, detail)
  select u.id, u.krok, 'bridged', jsonb_build_object('track', u.z, 'z', u.z, 'na', u.na, 'pojistka', 'vip_vrat_na_puvodni_trat')
    from u;
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;
revoke all on function public.vip_vrat_na_puvodni_trat(integer) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- D) CRON (až po týdnu na mostech a po kontrole 00-kontroly, dotaz 6)
-- ----------------------------------------------------------------------------
-- Pořadí v čase je schválně: zápis 7:30 → návrat 7:40 → enroll_into_longtail 7:50.
-- vip-free první: kdo zapisuje v appce, je nejblíž platbě.
--   select cron.schedule('vip-backlog-denne', '30 7 * * *', $cmd$
--     select public.vip_zapis_backlog('vip-free', 25);
--     select public.vip_zapis_backlog('vip-kupci', 25);
--     select public.vip_zapis_backlog('vip-leady', 25);
--   $cmd$);
--   select cron.schedule('vip-vrat-denne', '40 7 * * *', $cmd$
--     select public.vip_vrat_na_puvodni_trat(200);
--   $cmd$);
-- Vypnutí: select cron.unschedule('vip-backlog-denne'); (návrat NECHAT běžet, dokud někdo
-- s meta.vip_vrat sedí ve vip-* trati, jinak by mu propadlo místo v longtailu.)
