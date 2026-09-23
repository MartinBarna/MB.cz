-- Trychtýř návštěvnosti tvujcoach.cz pro admin panel MB.cz (sekce „👀 Návštěvnost", přepínač webu).
-- Navazuje na page-views.sql a page-views-site.sql. Idempotentní, jde pustit opakovaně.
-- Spustit v SQL editoru projektu uhmrpfsdcujbhbtumqye. Jen čte `page_views`, nic nezapisuje.
--
-- ⛔ PROČ VLASTNÍ FUNKCE A NE PARAMETR `site` U admin_page_views_summary:
--    `create or replace function` s JINOU signaturou v Postgresu nic nenahradí, vyrobí
--    DRUHOU funkci a volání z edge funkce s jedním pojmenovaným argumentem by se stalo
--    nejednoznačným (viz page-views-site.sql). Proto nové jméno a web natvrdo.
--
-- ⛔ CO TA ČÍSLA ZNAMENAJÍ (a co ne):
--  * Appka NEPOSÍLÁ session_hash (vědomě, ping jede bez souhlasu s cookies, viz
--    scripts/inject-head.mjs v repu appky). Unikátní návštěvníky tedy spočítat NEJDE.
--    Všechno níž jsou ZOBRAZENÍ, ne lidé.
--  * „Vstup na web" = ping, jehož referrer NENÍ tvujcoach.cz (první načtení dokumentu)
--    a který není krokem dotazníku `/start/<krok>` ani přihlášením stávajícího uživatele
--    (`/sign-in`, `/forgot-password`, `/reset-password`, `/onboarding`). Přechody uvnitř SPA posílají jako
--    referrer předchozí cestu appky, takže do vstupů nespadnou. Zdroje, zařízení a denní graf se počítají ze vstupů, jinak by jeden
--    člověk, který proklikal dotazník, vypadal jako deset příchodů z reklamy.
--  * Krok trychtýře = počet zobrazení té obrazovky. Procento mezi kroky NENÍ konverze
--    stejných lidí: na /start a /koupit se dá přijít i napřímo (odkaz z reklamy nebo
--    z martinbarna.cz), takže krok může mít víc zobrazení než ten před ním.
--  * /koupeno vidí jen nákup BEZ účtu. Přihlášený kupec se po Stripu vrací na
--    /client/subscription a ta cesta se neměří vůbec. Počet plateb je ve Stripu.
--  * Testovací zobrazení se vylučují podle značek, které jdou poznat bezpečně
--    (`je_test` níž). Headless prohlížeče, hlídky bez UTM a Martinovy vlastní
--    návštěvy poznat nejdou: v tabulce není IP, user agent ani identifikátor.
-- ============================================================================
create or replace function public.admin_tc_trychtyr(p_days integer)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select greatest(1, least(coalesce(p_days, 7), 90)) as days
  ),
  okno as (
    select
      pv.path,
      pv.utm_source,
      pv.utm_campaign,
      pv.device,
      pv.referrer,
      (pv.created_at at time zone 'Europe/Prague')::date as day,
      -- ⛔ Jen značky, které si člověk sám nevymyslí: smoke/test/sonda v UTM, utm_source
      --    šéfovských kontrol (sef50) a vymyšlené cesty 404 testů. `tc-kontrola` NENÍ test,
      --    je to skutečná kampaň na tarif „Kontrola od Martina".
      (
        coalesce(pv.utm_source, '') || ' ' || coalesce(pv.utm_medium, '') || ' ' || coalesce(pv.utm_campaign, '')
          ~* '(test|smoke|sonda)'
        or coalesce(pv.utm_source, '') ~* '^sef[0-9]+$'
        or pv.path ~* '(sonda|neexist|test)'
      ) as je_test,
      -- Vstup na web: referrer chybí nebo je z jiného webu než tvujcoach.cz.
      -- ⛔ Kroky dotazníku `/start/<krok>` vstupem NEJSOU nikdy: hlásí je React přes
      --    `window.__tcPing`, které posílá referrer PRVNÍHO načtení (třeba facebook.com)
      --    a UTM z adresy. Bez téhle výjimky by každý krok dotazníku vypadal jako nový
      --    příchod z reklamy (změřeno 23. 9. 2026 za 30 dní: 3 008 vstupů místo 1 540).
      -- ⛔ A přihlašovací cesty taky ne: `/sign-in` (241 vstupů za 30 dní, skoro všechny
      --    bez zdroje) otevírají STÁVAJÍCÍ uživatelé z plochy telefonu nebo z mailu.
      --    Do „kolik lidí přišlo a odkud" nepatří, jinak nafouknou „(přímá)".
      (
        (pv.referrer is null or pv.referrer !~* '^https?://(www\.)?tvujcoach\.cz(/|$)')
        and pv.path not like '/start/%'
        and pv.path !~ '^/(sign-in|forgot-password|reset-password|onboarding)(/|$)'
      ) as je_vstup
    from public.page_views pv, bounds b
    where pv.site = 'tvujcoach.cz'
      and pv.created_at >= ((now() at time zone 'Europe/Prague')::date - (b.days - 1))
                           ::timestamp at time zone 'Europe/Prague'
  ),
  ciste as (
    select * from okno where not je_test
  ),
  vstupy as (
    select
      *,
      coalesce(
        nullif(utm_source, ''),
        nullif(regexp_replace(substring(referrer from '^https?://([^/]+)'), '^(www|m|l|lm)\.', ''), ''),
        '(přímá)'
      ) as zdroj
    from ciste
    where je_vstup
  ),
  kroky as (
    select * from (values
      (1, 'landing',    'Úvodní stránka',        '/'),
      (2, 'kalkulacka', 'Kalkulačka (start)',     '/start'),
      (3, 'vysledek',   'Výsledek kalkulačky',   '/start/summary'),
      (4, 'pokladna',   'Pokladna',              '/koupit'),
      (5, 'zaplaceno',  'Zaplaceno (bez účtu)',  '/koupeno')
    ) as k(poradi, klic, nazev, cesta)
  ),
  vedlejsi as (
    select * from (values
      (1, 'registrace', 'Registrace zdarma',      '/sign-up'),
      (2, 'cisla_mail', 'Čísla z kalkulačky na e-mail', '/start/email')
    ) as k(poradi, klic, nazev, cesta)
  ),
  days_range as (
    select generate_series(
      (select (now() at time zone 'Europe/Prague')::date - (days - 1) from bounds),
      (select (now() at time zone 'Europe/Prague')::date from bounds),
      interval '1 day'
    )::date as day
  )
  select jsonb_build_object(
    'views', (select count(*)::int from ciste),
    'entries', (select count(*)::int from vstupy),
    'tests_excluded', (select count(*)::int from okno where je_test),
    'measured_since', (
      select min((created_at at time zone 'Europe/Prague')::date)
      from public.page_views where site = 'tvujcoach.cz'
    ),
    'funnel', (
      select jsonb_agg(jsonb_build_object('key', k.klic, 'label', k.nazev, 'path', k.cesta, 'n',
        (select count(*)::int from ciste c
          where c.path = k.cesta or (k.cesta = '/koupit' and c.path like '/koupit/%')))
        order by k.poradi)
      from kroky k
    ),
    'side', (
      select jsonb_agg(jsonb_build_object('key', v.klic, 'label', v.nazev, 'path', v.cesta, 'n',
        (select count(*)::int from ciste c where c.path = v.cesta))
        order by v.poradi)
      from vedlejsi v
    ),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object('path', path, 'n', n) order by n desc)
      from (
        select path, count(*)::int as n from ciste group by path order by count(*) desc limit 10
      ) t
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
      from (
        select zdroj as k, count(*)::int as n from vstupy group by 1 order by count(*) desc limit 12
      ) t
    ), '[]'::jsonb),
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
      from (
        select utm_campaign as k, count(*)::int as n from vstupy
        where coalesce(utm_campaign, '') <> ''
        group by 1 order by count(*) desc limit 10
      ) t
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
      from (
        select coalesce(device, 'neznámé') as k, count(*)::int as n from vstupy group by 1 order by count(*) desc
      ) t
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'n', coalesce(c.n, 0)) order by d.day)
      from days_range d
      left join (select day, count(*)::int as n from vstupy group by day) c on c.day = d.day
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.admin_tc_trychtyr(integer) from public, anon, authenticated;
grant execute on function public.admin_tc_trychtyr(integer) to service_role;

-- Kontrola po spuštění (musí vrátit jedinou variantu a JSON s klíčem funnel):
--   select oid::regprocedure from pg_proc where proname = 'admin_tc_trychtyr';
--   select public.admin_tc_trychtyr(30) -> 'funnel';
