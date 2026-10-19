-- ============================================================================
-- KONTROLY PŘED SPUŠTĚNÍM (JEN ČTENÍ, nic nemění). Academy DB uhmrpfsdcujbhbtumqye.
-- Připraveno 9. 10. 2026 (cloud/mailing-navrh-1009). Návrh vznikl JEN z repa, živou DB
-- nikdo neviděl. Tyhle dotazy rozhodnou, jestli návrh sedí na realitu.
-- ⛔ Výsledky do chatu jen jako POČTY, nikdy seznam adres (CLAUDE.md, GDPR).
-- ============================================================================

-- 1) Mosty dnes. Návrh 02-*.sql přepisuje klíče tc-zkusebka, tc-free, onboarding-*-videokurz,
--    nurture-videokurz, lead-magnet-tool, nurture-pro-vas. Co tam je teď, se musí vědět předem.
select value from app_config where key = 'navazujici_trate';

-- 2) Kde ještě dnes stojí Basic nebo slib videokurzu bez VIP (snímek repa je z 23. 9.,
--    po 30. 9. se šablony mohly měnit přes MCP). Očekávání podle repa: ~20 řádků.
select track, step, key, subject,
       blocks::text ilike '%plan=basic%'                                  as cta_basic,
       blocks::text ~* 'první platb[^"]{0,40}(appky|Tvůj Coach)'           as darek_bez_vip,
       blocks::text ilike '%nezačínej%'                                    as zrazuje_od_vip
  from email_templates
 where blocks::text ilike '%plan=basic%'
    or blocks::text ~* 'první platb[^"]{0,40}(appky|Tvůj Coach)'
    or blocks::text ilike '%nezačínej%'
 order by track, step;

-- 3) Rodina „basic249" (03-*.sql ji přepisuje se zámkem na key). Musí vrátit 4 řádky
--    s těmito klíči, jinak se 03-*.sql sám vrátí a nic nezmění.
select track, step, key, wait_days from email_templates
 where (track, step) in (('lead-magnet',9),('longtail-consumer',5),('nurture-videokurz',8),('tc-start',2));

-- 4) Čísla kroků s koučinkem v longtailu (patch 04 je přeskakuje bývalým klientům).
--    Očekávání: longtail-consumer/11 a longtail-kupci/5 nabízejí koučink.
select track, step, key, subject from email_templates
 where track in ('longtail-consumer','longtail-kupci') and blocks::text ilike '%/koucing%'
 order by track, step;

-- 5) Brány enginu: follow-upy musí být zapnuté, jinak vip-* nepůjdou vůbec.
select key, value from app_config
 where key in ('followups_enabled','drip_daily_cap','clenske_track_prefixy');

-- 6) Velikost backlogu (kolik lidí by vip_zapis_backlog vzal, kdyby nebyl limit).
--    Stejné podmínky jako funkce, jen count. Pustit až po 02-*.sql část B (funkce musí existovat),
--    nebo si podmínky opsat. Jednodušší odhad bez funkce:
with aktivni as (
  select lower(email) email, product from entitlements where active and (expires_at is null or expires_at > now())
), appka as (
  select lower(email) email from entitlements where source in ('rocni-vip-bonus','rocni-vip-bonus-academy')
)
select
  count(*) filter (where lower(l.email) in (select email from aktivni where product='videokurz')
                     and lower(l.email) not in (select email from aktivni where product in ('academy','coaching'))) as odhad_vip_kupci,
  count(*) filter (where lower(l.email) not in (select email from aktivni)
                     and exists (select 1 from email_events e where e.lead_id=l.id and e.type='sent' and e.detail->>'track' in ('tc-zkusebka','tc-free'))) as odhad_vip_free,
  count(*) filter (where lower(l.email) not in (select email from aktivni)
                     and not exists (select 1 from email_events e where e.lead_id=l.id and e.type='sent' and e.detail->>'track' like 'tc-%')) as odhad_vip_leady
  from leads l
 where l.status = 'active'
   and lower(l.email) not in (select email from appka)
   and not exists (select 1 from odhlaseni_trvale o where o.email = lower(l.email));

-- 7) VÝCHOZÍ STAV PENĚZ (severka, CLAUDE.md 25. 7.: měří se na prodeji, ne na prokliku).
--    První platba VIP v appce = bonusový videokurz se source 'rocni-vip-bonus' (od 30. 9. jen VIP).
--    Spočítat za posledních 30 dní PŘED spuštěním, pak po spuštění stejný dotaz.
select date_trunc('week', granted_at) tyden, count(distinct lower(email)) prvni_platby_vip
  from entitlements
 where source = 'rocni-vip-bonus' and granted_at >= '2026-09-30'
 group by 1 order by 1;
-- ⚠️ Sloupec je `granted_at` (schema.sql). Dvě slepá místa: Basic platby tu nejsou vidět vůbec
--    (Basic videokurz nedostává) a kdo videokurz UŽ MĚL, tomu most řádek nepřepíše (PK email+product),
--    takže jeho VIP platba tu taky není. Úplné číslo je jen v appce (předplatná podle tieru).

-- 8) Atribuce na trať (po spuštění): první platba VIP do 30 dní od vstupu do vip-* trati.
select x.na as trat, count(distinct x.lead_id) vstoupilo,
       count(distinct x.lead_id) filter (where exists (
         select 1 from entitlements en join leads l on lower(l.email) = lower(en.email)
          where l.id = x.lead_id and en.source = 'rocni-vip-bonus'
            and en.granted_at between x.created_at and x.created_at + interval '30 days')) as zaplatilo_vip
  from (select lead_id, created_at, detail->>'na' na from email_events
         where type = 'bridged' and detail->>'na' like 'vip-%') x
 group by 1 order by 1;
-- ⚠️ Most z drip-sendu zapisuje `bridged` s detail.na, backlog taky (pojistka vip_zapis_backlog).
