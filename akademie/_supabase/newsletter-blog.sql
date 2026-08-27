-- NEWSLETTER Z BLOGU: pravidelná rozesílka existujících článků (návrh, 27. 8. 2026)
--
-- ⛔⛔ TENHLE SOUBOR NEBYL SPUŠTĚN. Je to návrh k odsouhlasení, ne nasazený stav.
--     Nespouštět po částech; první ostrý mail smí odejít až po Martinově GO na ukázku.
--
-- ZADÁNÍ: kontaktům se souhlasem posílat co 3 až 4 dny jeden existující článek
-- z martinbarna.cz/clanky/. Předmět = titulek článku, tělo = článek včetně CTA boxů
-- a prokliků na další články. Šéfovo rozhodnutí: kdo je v běžící drip trati,
-- newsletter dostane až po dojetí té tratě.
--
-- ⭐ NESTAVÍ SE NIC NOVÉHO NA ODESÍLÁNÍ. Přesně tohle už umí trať `tydenik`
-- (akademie/_supabase/tydenik-rozesilka.sql, nasazeno 13. 8. 2026, prověřeno provozem):
-- vezme si člověka dočasně z domovské tratě, pošle mu broadcast a vrátí ho zpátky
-- i s posunutým termínem. Tenhle soubor jen doplňuje DRUHOU takovou trať
-- (`blog-newsletter`) a nad ní FRONTU ČLÁNKŮ, která říká co a kdy.
--
-- ⛔ ČTYŘI VĚCI PŘEVZATÉ Z TÝDENÍKU, KTERÉ SE NESMÍ ZJEDNODUŠIT (každá už někoho stála práci):
--  1. Snímek domovské tratě se bere v TÉŽE větě jako přepnutí. Dřív = vrátíme
--     člověku už spotřebovaný termín, tedy druhý mail během pár minut.
--  2. Přepíná se jen tolik lidí, kolik jeden běh enginu odešle (~120). `drip-send` má
--     `drip_run_deadline_ms` 100 s a `drip_send_gap_ms` 600 ms.
--  3. Idempotence je TVAR DOTAZU, ne přidaná pojistka: `newsletter_prijemci` vylučuje
--     každého, kdo už má v `email_events` `sent` pro (step, track='blog-newsletter').
--  4. ⛔ HODINA 7 UTC JE ZAKÁZANÁ. V 7:10, 7:20, 7:35 a 7:50 běží enroll joby, které
--     člověka s `next_send_at IS NULL` (tedy toho, kdo čeká na vrácení) NEVYLOUČÍ
--     a natrvalo ho odsají do upsell/longtail tratě. Proto cron 8:40 a vrácení 8:35.
--
-- ⛔ ŠABLONY MAJÍ `wait_days = null`. Bez toho by se trať sama posouvala na další krok
--    a člověk by dostal celý zásobník článků za sebou.
-- ⛔ PŘÍLOHY NIKDY. Mail je vždy jen text a odkazy; obrázky z martinbarna.cz navíc
--    Gmail nezobrazí (Wedos vrací Googlově obrázkové proxy 401, změřeno 31. 7. 2026).

-- ---------------------------------------------------------------------------
-- 1) FRONTA ČLÁNKŮ (co a kdy). Naplňuje ji scripts/clanek-do-mailu.mjs + ruka.
-- ---------------------------------------------------------------------------
create table if not exists public.newsletter_fronta (
  step          int  primary key,                 -- = email_templates.step tratě blog-newsletter
  slug          text not null unique,             -- clanky/<slug>.html
  titulek       text not null,                    -- pro přehled, pravda je v email_templates.subject
  planovano_na  date,                             -- nejdřív v tenhle den; null = zatím neplánovat
  go            boolean not null default false,   -- ⛔ Martinovo GO na TENHLE mail
  odeslano_at   timestamptz,
  prepnuto      int not null default 0,           -- kolik lidí už vlna vzala
  pozn          text,
  created_at    timestamptz not null default now()
);
alter table public.newsletter_fronta enable row level security;
alter table public.newsletter_fronta force row level security;
revoke all on table public.newsletter_fronta from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) SNÍMKOVÁ TABULKA (kdo je zrovna půjčený z domovské tratě)
-- ---------------------------------------------------------------------------
create table if not exists public.newsletter_odeslani (
  step                 int not null,
  lead_id              uuid not null references public.leads(id) on delete cascade,
  email                text not null,
  puvodni_track        text not null,
  puvodni_step         int not null,
  puvodni_next_send_at timestamptz,
  puvodni_status       text not null,
  prepnuto_at          timestamptz not null default now(),
  vraceno_at           timestamptz,
  vraceny_next_send_at timestamptz,
  vraceno_bez_mailu    boolean not null default false,
  primary key (step, lead_id)
);
alter table public.newsletter_odeslani enable row level security;
alter table public.newsletter_odeslani force row level security;
revoke all on table public.newsletter_odeslani from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) KDO DOSTANE. Rozdíl proti týdeníku jsou ŘÁDKY OZNAČENÉ ⭐.
-- ---------------------------------------------------------------------------
create or replace function public.newsletter_prijemci(p_step integer)
returns table(lead_id uuid, email text, track text, step integer, next_send_at timestamptz)
language sql stable security definer set search_path to 'public' as $fn$
  select l.id, l.email, l.track, l.step, l.next_send_at
  from public.leads l
  where l.status = 'active'
    and l.consent                                        -- ⭐ souhlas výslovně, ne implicitně
    -- ⭐ ŠÉFOVO ROZHODNUTÍ: kdo je v běžící trati, dostane newsletter až po jejím dojetí.
    -- ⚠️ Změřeno 27. 8. 2026: tahle jediná podmínka srazí publikum z 832 na 61 lidí.
    --    Vypnout ji smí jen Martin; varianta bez ní je popsaná v reportu.
    and l.next_send_at is null
    -- ⭐ rodina má trvalý free a do prodejních vln nejde (mb-rodina-trvaly-free-nemailovat)
    and lower(l.email) not in ('ivanabarnova@seznam.cz','barnamaro@gmail.com','barnaxxx@seznam.cz')
    and lower(l.email) not like 'fitness.barna%'          -- ⭐ Martinovy testovací adresy
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
    -- ⭐ nikdo nesmí dostat dva maily v jednom dni (pravidlo z poukazového blastu 25. 8.)
    and not exists (select 1 from public.email_events e
                     where e.lead_id = l.id and e.type in ('sent','oneoff')
                       and (e.created_at at time zone 'Europe/Prague')::date
                         = (now() at time zone 'Europe/Prague')::date)
$fn$;

-- ---------------------------------------------------------------------------
-- 4) VRÁCENÍ NA DOMOVSKOU TRAŤ (kopie tydenik_vraceni, jen jiná trať a tabulka)
-- ---------------------------------------------------------------------------
create or replace function public.newsletter_vraceni(p_step integer, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare v_out jsonb;
begin
  with kandidati as (
    select m.lead_id, m.puvodni_track, m.puvodni_step, m.puvodni_next_send_at,
           exists (select 1 from public.email_events e
                    where e.lead_id = m.lead_id and e.type = 'sent'
                      and e.step = p_step and e.detail->>'track' = 'blog-newsletter') as dostal
    from public.newsletter_odeslani m
    where m.step = p_step and m.vraceno_at is null
  ),
  vybrani as (
    select k.*,
           case
             when k.puvodni_next_send_at is null then null
             when k.puvodni_next_send_at < now() + interval '12 hours'
               then greatest(k.puvodni_next_send_at + interval '1 day', now() + interval '12 hours')
             else k.puvodni_next_send_at
           end as novy_termin
    from kandidati k
    where k.dostal or p_force
  ),
  upd_leads as (
    update public.leads l
       set track = v.puvodni_track, step = v.puvodni_step,
           next_send_at = v.novy_termin, updated_at = now()
      from vybrani v
     where l.id = v.lead_id and l.track = 'blog-newsletter'
    returning l.id
  ),
  upd_mapa as (
    update public.newsletter_odeslani m
       set vraceno_at = now(), vraceny_next_send_at = v.novy_termin,
           vraceno_bez_mailu = not v.dostal
      from vybrani v
     where m.step = p_step and m.lead_id = v.lead_id
    returning m.lead_id
  )
  select jsonb_build_object(
    'step', p_step, 'force', p_force,
    'vraceno', (select count(*) from upd_leads),
    'uzavreno_v_mape', (select count(*) from upd_mapa),
    'bez_mailu', (select count(*) from vybrani where not dostal),
    'prevzato_jinym', (select count(*) from upd_mapa) - (select count(*) from upd_leads)
  ) into v_out;
  return v_out;
end $fn$;

-- ---------------------------------------------------------------------------
-- 5) JEDNA VLNA (kopie tydenik_rozeslani; GO se čte z fronty, ne z app_config)
-- ---------------------------------------------------------------------------
create or replace function public.newsletter_rozeslani(
  p_step integer, p_test boolean default true, p_limit integer default 120,
  p_jen_email text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_url    text := 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/drip-send';
  v_secret text; v_go boolean; v_pocet int := 0; v_req bigint;
begin
  if not exists (select 1 from public.email_templates where track = 'blog-newsletter' and step = p_step) then
    return jsonb_build_object('ok', false, 'duvod', 'sablona_neexistuje', 'step', p_step);
  end if;

  select value into v_secret from public.app_config where key = 'drip_invoke_secret';
  if coalesce(v_secret, '') = '' then
    return jsonb_build_object('ok', false, 'duvod', 'chybi_drip_invoke_secret');
  end if;

  -- ⛔ Test posílá jen na Martinovu adresu a NIKAM jinam; parametr slouží k tomu,
  --    aby se nedal omylem podstrčit cizí příjemce (past z tydenik_rozeslani,
  --    kde větev p_test obcházela brány a byla otevřený mail relay).
  if p_test then
    select net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type','application/json','x-drip-secret', v_secret),
      body := jsonb_build_object('test_email', 'fitness.barna@gmail.com',
                                 'track','blog-newsletter','step', p_step,
                                 'segment','other','name',''),
      timeout_milliseconds := 60000) into v_req;
    return jsonb_build_object('ok', true, 'mode', 'test', 'step', p_step, 'request_id', v_req);
  end if;

  select f.go into v_go from public.newsletter_fronta f where f.step = p_step;
  if coalesce(v_go, false) is not true then
    return jsonb_build_object('ok', false, 'duvod', 'chybi_go_ve_fronte', 'step', p_step);
  end if;
  if not public.followups_gate_open() then
    return jsonb_build_object('ok', false, 'duvod', 'zavrena_brana_followups', 'step', p_step);
  end if;

  with vyber as (
    select p.lead_id from public.newsletter_prijemci(p_step) p
    where p_jen_email is null or lower(p.email) = lower(p_jen_email)
    order by p.lead_id limit greatest(1, p_limit)
  ),
  snimek as (
    insert into public.newsletter_odeslani
      (step, lead_id, email, puvodni_track, puvodni_step, puvodni_next_send_at, puvodni_status)
    select p_step, l.id, l.email, l.track, l.step, l.next_send_at, l.status
    from public.leads l join vyber v on v.lead_id = l.id
    on conflict (step, lead_id) do update
      set puvodni_track = excluded.puvodni_track, puvodni_step = excluded.puvodni_step,
          puvodni_next_send_at = excluded.puvodni_next_send_at,
          puvodni_status = excluded.puvodni_status,
          prepnuto_at = now(), vraceno_at = null,
          vraceny_next_send_at = null, vraceno_bez_mailu = false
    returning lead_id
  )
  update public.leads l
     set track = 'blog-newsletter', step = p_step, next_send_at = now(), updated_at = now()
    from snimek s where l.id = s.lead_id;
  get diagnostics v_pocet = row_count;

  if v_pocet = 0 then
    return jsonb_build_object('ok', true, 'mode','live','step', p_step, 'prepnuto', 0, 'duvod','nikdo_nezbyva');
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type','application/json','x-drip-secret', v_secret),
    body := case when p_jen_email is null then jsonb_build_object('limit', v_pocet + 80)
                 else jsonb_build_object('only_email', lower(p_jen_email)) end,
    timeout_milliseconds := 60000) into v_req;

  insert into public.email_events (lead_id, step, type, detail)
  values (null, p_step, 'newsletter_vlna',
          jsonb_build_object('track','blog-newsletter','step', p_step,
                             'prepnuto', v_pocet, 'request_id', v_req, 'jen_email', p_jen_email));

  update public.newsletter_fronta f
     set prepnuto = f.prepnuto + v_pocet, odeslano_at = coalesce(f.odeslano_at, now())
   where f.step = p_step;

  return jsonb_build_object('ok', true, 'mode','live','step', p_step, 'prepnuto', v_pocet, 'request_id', v_req);
end $fn$;

-- ---------------------------------------------------------------------------
-- 6) HODINOVÝ ŘIDIČ. Kadence 3 až 4 dny drží podmínka na posledním odeslání.
-- ---------------------------------------------------------------------------
create or replace function public.newsletter_cron()
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_hod  int := extract(hour from (now() at time zone 'UTC'))::int;
  v_step int; v_limit int; v_odstup int;
  v_vraceni jsonb; v_rozeslani jsonb := null;
begin
  -- ⛔ hodina 7 UTC je zakázaná (enroll joby by si odsály lidi čekající na vrácení)
  if v_hod = 7 then return jsonb_build_object('ok', true, 'duvod', 'hodina_7_utc_vynechana'); end if;

  -- 1) nejdřív vrátit všechny otevřené vlny domů
  v_vraceni := coalesce((
    select jsonb_agg(public.newsletter_vraceni(m.step, v_hod >= 15))
    from (select distinct step from public.newsletter_odeslani where vraceno_at is null) m), '[]'::jsonb);

  -- 2) teprve pak nová vlna, a jen v odesílacím okně
  if v_hod between 8 and 14 then
    select coalesce(nullif(value,'')::int, 3) into v_odstup from app_config where key = 'newsletter_odstup_dnu';
    select coalesce(nullif(value,'')::int, 120) into v_limit from app_config where key = 'newsletter_vlna_limit';
    select f.step into v_step from public.newsletter_fronta f
     where f.go
       and coalesce(f.planovano_na, current_date) <= current_date
       and (f.odeslano_at is null or exists (select 1 from public.newsletter_prijemci(f.step)))
       and not exists (
         select 1 from public.newsletter_fronta g
          where g.odeslano_at is not null
            and g.odeslano_at > now() - make_interval(days => coalesce(v_odstup, 3))
            and g.step <> f.step)
     order by f.step limit 1;
    if v_step is not null then
      v_rozeslani := public.newsletter_rozeslani(v_step, false, coalesce(v_limit, 120));
    end if;
  end if;

  return jsonb_build_object('hodina_utc', v_hod, 'vraceni', v_vraceni, 'rozeslani', v_rozeslani);
end $fn$;

-- ---------------------------------------------------------------------------
-- 7) PRÁVA. ⛔ REVOKE OD `anon` JE MRTVÁ PÁKA, grant visí na roli PUBLIC.
--    (incident 27. 8. 2026: tydenik_rozeslani byl otevřený mail relay)
-- ---------------------------------------------------------------------------
revoke execute on function public.newsletter_prijemci(integer)                       from public, anon, authenticated;
revoke execute on function public.newsletter_vraceni(integer, boolean)               from public, anon, authenticated;
revoke execute on function public.newsletter_rozeslani(integer, boolean, integer, text) from public, anon, authenticated;
revoke execute on function public.newsletter_cron()                                  from public, anon, authenticated;
-- ověření po nasazení (očekávám jen postgres a service_role):
--   select proname, proacl from pg_proc where proname like 'newsletter%';

-- ---------------------------------------------------------------------------
-- 8) CRON. ⛔ ZAKLÁDAT AŽ PO MARTINOVĚ GO NA UKÁZKU, jinak newsletter odejde sám.
-- ---------------------------------------------------------------------------
-- select cron.schedule('newsletter-blog-hodinove', '40 8-14 * * *', $$select public.newsletter_cron()$$);
-- vypnutí:  select cron.alter_job((select jobid from cron.job where jobname='newsletter-blog-hodinove'), active := false);

-- ---------------------------------------------------------------------------
-- 9) KONTROLA PRŮBĚHU
-- ---------------------------------------------------------------------------
-- select step, slug, planovano_na, go, odeslano_at, prepnuto from newsletter_fronta order by step;
-- select step, count(*) filter (where vraceno_at is null) as venku,
--        count(*) filter (where vraceno_at is not null) as vraceno,
--        count(*) filter (where vraceno_bez_mailu) as bez_mailu
--   from newsletter_odeslani group by 1 order by 1;
-- select count(*) from newsletter_prijemci(0);

-- ---------------------------------------------------------------------------
-- 10) SEED FRONTY (25 dilu, poradi od nejnovejsiho clanku; datumy = navrh, kadence 3,5 dne)
--     ⛔ vsechny `go` zamerne false: bez GO na konkretni krok neodejde nic.
-- ---------------------------------------------------------------------------
-- insert into public.newsletter_fronta (step, slug, titulek, planovano_na, go) values
--   (0, 'hubnuti-po-40', 'Hubnutí po 40: co se mění doopravdy a co si jen říkáme', date '2026-09-01', false),
--   (1, 'jak-zacit-hubnout', 'Jak začít hubnout: první 4 týdny bez drastické diety', date '2026-09-04', false),
--   (2, 'jak-zhubnout-v-obliceji', 'Jak zhubnout v obličeji: co funguje a co je mýtus', date '2026-09-08', false),
--   (3, 'kaloricky-deficit-kolik-jist', 'Kalorický deficit: kolik jíst, abys hubla a přitom fungovala', date '2026-09-11', false),
--   (4, 'vyhrez-plotenky', 'Výhřez ploténky není doživotní: co data říkají o operaci a cvičení', date '2026-09-15', false),
--   (5, 'elonga-hrv-veda-nebo-marketing', 'Elonga a HRV náramek: co je věda a co marketing', date '2026-09-18', false),
--   (6, 'vikendove-prejidani', 'Víkendové přejídání: jak si užít víkend a nezbourat celý týden', date '2026-09-22', false),
--   (7, 'hubnuti-a-vek-mozku', 'Omládne mozek, když zhubneš? Co říká studie o „věku mozku“', date '2026-09-25', false),
--   (8, 'kolik-spanku-delka-pravidelnost', 'Kolik hodin spát? Délka vs. pravidelnost (co říkají studie)', date '2026-09-29', false),
--   (9, 'cholesterol-co-snizuje-ldl', 'Cholesterol a LDL: co strava a pohyb reálně sníží (a co je marketing)', date '2026-10-02', false),
--   (10, 'inzulinova-rezistence-prediabetes', 'Inzulinová rezistence a prediabetes: co to je a co s tím udělá životní styl', date '2026-10-06', false),
--   (11, 'menopauza-a-pribyvani-vahy', 'Menopauza a přibývání na váze: proč se mění tělo a co s tím reálně funguje', date '2026-10-09', false),
--   (12, 'sarkopenie-svaly-po-50', 'Sarkopenie: jak po padesátce nepřijít o svaly a sílu', date '2026-10-13', false),
--   (13, 'vitamin-d-na-co-ma-smysl', 'Vitamin D po 40: na co reálně má a nemá smysl', date '2026-10-16', false),
--   (14, 'kreatin-pro-zeny', 'Kreatin pro ženy: nejen na svaly (co říká věda 2025)', date '2026-10-20', false),
--   (15, 'prerusovany-pust-co-rikaji-studie', 'Přerušovaný půst: funguje, ale ne kouzelně (99 studií)', date '2026-10-23', false),
--   (16, 'rostlinne-vs-zivocisne-bilkoviny-svaly', 'Rostlinné vs živočišné bílkoviny na svaly: nová studie', date '2026-10-27', false),
--   (17, 'co-jist-pri-hubnuti', 'Co jíst při hubnutí: talíř, který funguje (bez zázračných potravin)', date '2026-10-30', false),
--   (18, 'injekce-na-hubnuti-ozempic', 'Injekce na hubnutí (Ozempic, Wegovy): co o nich vědět', date '2026-11-03', false),
--   (19, 'jak-rychle-zhubnout', 'Jak rychle zhubnout (a proč to většinou nevydrží)', date '2026-11-06', false),
--   (20, 'jak-zhubnout-bricho', 'Jak zhubnout břicho: co reálně funguje (a co je jen mýtus)', date '2026-11-10', false),
--   (21, 'silovy-trenink-pro-zeny', 'Silový trénink pro ženy: jak začít (bez strachu ze zmohutnění)', date '2026-11-13', false),
--   (22, 'vzorovy-jidelnicek-na-hubnuti', 'Vzorový jídelníček na hubnutí: ukázkový den kolem 1500–1700 kcal', date '2026-11-17', false),
--   (23, 'jist-vecer-tloustne', 'Jíst večer tloustne? Mýtus jídla po 18. hodině: co říká věda', date '2026-11-20', false),
--   (24, 'silovy-trenink-zlepsuje-mobilitu', 'Chceš pohyblivost? Posiluj v plném rozsahu, funguje jako strečink (a přidá sílu)', date '2026-11-24', false)
-- on conflict (step) do nothing;
