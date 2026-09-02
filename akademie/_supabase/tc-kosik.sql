-- ============================================================
-- ZACHRANNY MAIL PO NEDOKONCENEM CHECKOUTU APPKY (`tc-kosik`), 2. 9. 2026
-- Barna Academy, projekt uhmrpfsdcujbhbtumqye. Spustit v SQL editoru.
--
-- ⛔⛔ NEZ TOHLE NASADIS, PRECTI SI TENHLE ODSTAVEC. Zmereno v appkove DB 2. 9. 2026
--     v 09:30: tabulka `paywall_events` zije od 1. 9. 23:55 (~32 hodin) a za tu dobu
--     klikli na plan DVA lide. OBA ZAPLATILI do dvou minut po kliku (Basic 1. 9. 23:58,
--     VIP 2. 9. 04:24). NEDOKONCENY CHECKOUT DNES NEEXISTUJE ANI JEDEN, dnesni beh by
--     poslal NULA mailu. Je to pojistka do budoucna, ne oprava dnesni ztraty.
--     ⇒ Kdo bude tenhle mechanismus obhajovat cisly, at si je nejdriv zmeri znovu.
--
-- CO TO DELA (dva crony):
--   9:10 UTC  `tc_kosik_dotaz()`  vezme leady, o kterych vime, ze maji ucet v appce,
--             a posle jejich adresy edge funkci appky `kosik-stav`. Odpoved je
--             ASYNCHRONNI (pg_net), takze se ulozi jen `request_id`.
--   9:25 UTC  `tc_kosik_zapis()`  precte odpoved z `net._http_response`, a komu appka
--             rekla „sahnul na Predplatne a nezaplatil", tomu posle JEDEN mail.
--
-- ⛔⛔ MAIL JDE JAKO JEDNORAZOVKA (`drip-send` rezim `oneoff_email`), NE PRESUNEM NA TRAT.
--     Duvod: 91 % leadu bezi na akvizicni trati a prepnuti by jim utnulo rozjetou
--     prodejni serii Academy za 8 900. Jednorazovka trat, krok ani `next_send_at`
--     nemeni, takze nepotrebujeme ani snimkovou tabulku, ani most zpatky
--     (`app_config.navazujici_trate`), ani vraceci cron. Tentyz vzor uz pouziva
--     aktivacni mail `tc-aktivace` z `app-onboarding-hook`.
--
-- ⛔ IDEMPOTENCE JE NA NAS, NE NA ENGINU. `drip-send` v rezimu `oneoff` posle mail
--    pokazde, kdyz ho zavolame. Razitko `leads.meta.kosik_at` je JEDINA zabrana proti
--    druhemu mailu, a proto se zapisuje I KDYZ odeslani selze: horsi nez ztracena
--    jedna zprava je tataz zprava dvakrat.
--
-- ⛔ ZADNA SLEVA, ZADNA ZKUSEBKA NAVIC. Rozhodnuti Martina (pamet
--    `mb-cil-je-platici-ne-free-uzivatel`): kupujeme si spotrebu, ne zakazniky.
--    Mail se pta „co te zastavilo" a pripomina Basic za bezne penize.
-- ============================================================

-- ---------------------------------------------------------------------------
-- 1) ZAZNAM O DOTAZU (bez adres: PII se tu neduplikuje, staci pocty)
-- ---------------------------------------------------------------------------
create table if not exists public.tc_kosik_dotazy (
  id            bigint generated always as identity primary key,
  request_id    bigint not null,
  adres         int    not null,
  created_at    timestamptz not null default now(),
  zpracovano_at timestamptz,
  vysledek      jsonb
);
create index if not exists tc_kosik_dotazy_ceka_idx
  on public.tc_kosik_dotazy (created_at) where zpracovano_at is null;
alter table public.tc_kosik_dotazy enable row level security;
-- ⛔ REVOKE MUSI BYT `from public, anon, authenticated`. Grant visi na roli `public`,
--    ze ktere `anon` dedi, takze „revoke from anon" je mrtva paka (incident 27. 8. 2026
--    s `tydenik_rozeslani`, ktery byl takhle otevreny mail relay).
revoke all on table public.tc_kosik_dotazy from public, anon, authenticated;

comment on table public.tc_kosik_dotazy is
  'Zaznam dotazu do appky na nedokoncene checkouty. Radek se zpracovano_at IS NULL ceka na odpoved pg_net.';

-- ---------------------------------------------------------------------------
-- 2) PUBLIKUM (jediny zdroj pravdy; dry-run i ostry beh ctou tuhle funkci)
-- ---------------------------------------------------------------------------
-- ⭐ Zamerne funkce, ne opsany dotaz na dvou mistech: dva opisy se rozejdou a dry-run
--    zacne lhat. Tentyz duvod ma `tydenik_prijemci`.
--
-- ⛔ PTAME SE JEN NA LIDI, U KTERYCH VIME, ZE UCET V APPCE MAJI. Adresy ostatnich
--    do druhe databaze neodchazeji. Dve mnoziny:
--      * lead na nektere trati appky (`tc-%`),
--      * lead ponechany v akvizicni trati s razitkem `tc-direct-registrace`
--        (to razitko pise `app-onboarding-hook` prave tem, ktere neprepnul).
--    Zmereno 2. 9. 2026: 38 lidi dohromady (28 + 10).
-- ⚠️ CO TO NEPOKRYVA: kdo se registroval v appce a v Academy nema lead vubec,
--    tenhle mail nedostane. `drip-send` v rezimu `oneoff` bez leada vrati
--    `lead_neexistuje` a nic neposle. Zalozit mu lead tady zamerne NEJDE:
--    o souhlasu s mailingem rozhoduje registracni cesta, ne tenhle skript.
create or replace function public.tc_kosik_kandidati()
returns table (lead_id uuid, email text)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select l.id, lower(l.email)
  from public.leads l
  where l.status = 'active'                       -- unsubscribed/bounced/paused/purchased padaji sami
    and (l.track like 'tc-%' or l.meta ? 'tc-direct-registrace')
    and not (l.meta ? 'kosik_at')                 -- ⛔ nikdy dvakrat
    and coalesce(l.purchased, false) = false
    and not exists (select 1 from public.email_events e
                     where e.lead_id = l.id and e.type in ('bounce','complaint'))
    -- ⛔ Kdo uz od Martina neco ma, tomu se predplatne appky takhle nenabizi:
    --    Academy dava appku VIP na rok, koucink je nejvyssi ticket, jaky prodavame.
    and not exists (select 1 from public.entitlements en
                     where lower(en.email) = lower(l.email) and en.active = true
                       and en.product in ('academy','coaching')
                       and (en.expires_at is null or en.expires_at > now()))
    and not exists (select 1 from public.withdrawals w      -- odstoupeni od smlouvy za 180 dni
                     where lower(w.email) = lower(l.email)
                       and w.created_at > now() - interval '180 days')
$fn$;

-- ---------------------------------------------------------------------------
-- 3) KROK 1: DOTAZ DO APPKY (nic neposila, jen se pta)
-- ---------------------------------------------------------------------------
-- ⛔ PROC PRES EDGE FUNKCI A NE PRIMO DO DB APPKY: primy dotaz by znamenal mit v Academy
--    service-role klic appky, tedy plnou moc nad druhou databazi kvuli jednomu seznamu.
--    Funkce appky si sahne do sve DB sama a vrati JEN podmnozinu adres, ktere jsme poslali.
-- ⛔ PROC NE NOVY SECRET: pouziva se TENTYZ sdileny secret, kterym uz appka vola nas
--    `app-onboarding-hook` (`app_config.app_onboarding_secret`, v appce env
--    `ACADEMY_ONBOARDING_SECRET`). Nova hodnota by musela projit clovekem.
create or replace function public.tc_kosik_dotaz(p_limit int default 200, p_od_hodin int default 48)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_secret text;
  v_emaily text[];
  v_req    bigint;
begin
  select value into v_secret from public.app_config where key = 'app_onboarding_secret';
  if coalesce(v_secret, '') = '' then
    return jsonb_build_object('ok', false, 'duvod', 'chybi_app_onboarding_secret');
  end if;

  select array_agg(k.email) into v_emaily
  from (select email from public.tc_kosik_kandidati()
         order by email limit greatest(1, least(p_limit, 500))) k;

  if v_emaily is null or array_length(v_emaily, 1) is null then
    return jsonb_build_object('ok', true, 'adres', 0, 'duvod', 'zadni_kandidati');
  end if;

  select net.http_post(
    url := 'https://kfkmghvhqwqtsalqjmrp.supabase.co/functions/v1/kosik-stav',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-app-secret', v_secret),
    body := jsonb_build_object('emaily', to_jsonb(v_emaily), 'od_hodin', p_od_hodin),
    timeout_milliseconds := 30000
  ) into v_req;

  insert into public.tc_kosik_dotazy (request_id, adres)
  values (v_req, array_length(v_emaily, 1));

  return jsonb_build_object('ok', true, 'adres', array_length(v_emaily, 1), 'request_id', v_req);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 4) KROK 2: PRECTI ODPOVED A POSLI MAILY
-- ---------------------------------------------------------------------------
-- ⚠️ `net._http_response` drzi odpovedi zhruba 6 hodin, takze mezi krokem 1 a 2 nesmi
--    byt vic nez par hodin. Nase okno je 15 minut.
-- ⛔ FAIL-SAFE JE NEPOSLAT: cokoli nesedi (chybi odpoved, jiny stav nez 200, rozbite
--    JSON, zavrena brana follow-upu) -> neposle se nic a radek se zkusi znovu, nebo se
--    po 3 hodinach uzavre jako promlceny. Zadrzeny mail nikde nekrici, zbytecny ano.
create or replace function public.tc_kosik_zapis()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  r          record;
  k          jsonb;
  v_drip     text;
  v_lead     record;
  v_odeslano int := 0;
  v_preskoc  int := 0;
  v_davek    int := 0;
  -- Pocty ZA JEDNU DAVKU. Bez nich by se do `vysledek` kazdeho radku zapsal bezici
  -- soucet od zacatku behu a druhy radek by hlasil i to, co poslal prvni.
  v_d_ode    int;
  v_d_pre    int;
  v_plan     text;
begin
  -- ⛔ BRANA FOLLOW-UPU: `tc-kosik` je obchodni mail. Kdyz je jistic zavreny (chyby
  --    doruceni), neposila se nic; dotazy pockaji na dalsi beh.
  if not public.followups_gate_open() then
    return jsonb_build_object('ok', false, 'duvod', 'zavrena_brana_followups');
  end if;

  select value into v_drip from public.app_config where key = 'drip_invoke_secret';
  if coalesce(v_drip, '') = '' then
    return jsonb_build_object('ok', false, 'duvod', 'chybi_drip_invoke_secret');
  end if;

  for r in
    select d.id, d.request_id, d.created_at,
           resp.status_code, resp.content, resp.error_msg
    from public.tc_kosik_dotazy d
    left join net._http_response resp on resp.id = d.request_id
    where d.zpracovano_at is null
    order by d.created_at
    limit 20
  loop
    -- Odpoved jeste nedorazila: nechat lezet, dalsi beh ji dozene.
    -- ⛔ Po 3 hodinach uz nedorazi (pg_net odpovedi mizi), radek se uzavre, at fronta
    --    nezustane viset navzdy.
    if r.status_code is null then
      if r.created_at < now() - interval '3 hours' then
        update public.tc_kosik_dotazy
           set zpracovano_at = now(),
               vysledek = jsonb_build_object('ok', false, 'duvod', 'bez_odpovedi')
         where id = r.id;
      end if;
      continue;
    end if;

    if r.status_code <> 200 or r.content is null then
      update public.tc_kosik_dotazy
         set zpracovano_at = now(),
             vysledek = jsonb_build_object('ok', false, 'duvod', 'http_' || r.status_code,
                                           'chyba', left(coalesce(r.error_msg, ''), 200))
       where id = r.id;
      continue;
    end if;

    v_davek := v_davek + 1;
    v_d_ode := 0;
    v_d_pre := 0;

    for k in
      select jsonb_array_elements(coalesce((r.content::jsonb) -> 'kosiky', '[]'::jsonb))
    loop
      -- ⛔ STAV LEADA SE CTE ZNOVU, ne z dotazu pred 15 minutami. Mezitim se mohl
      --    odhlasit, koupit, nebo ho mohl vzit jiny mechanismus.
      select l.id as id, l.email as email, l.status as status, l.meta as meta
        into v_lead
      from public.leads l
      where lower(l.email) = lower(k ->> 'email')
      limit 1;

      -- ⛔ `not found`, ne `v_lead.id is null`: kdyz SELECT INTO nic nenajde, sahat na
      --    pole zaznamu je zbytecne riskantni. `found` je na to zavedeny zpusob.
      if not found or v_lead.status <> 'active' or (v_lead.meta ? 'kosik_at') then
        v_preskoc := v_preskoc + 1;
        v_d_pre := v_d_pre + 1;
        continue;
      end if;

      v_plan := coalesce(k ->> 'plan', 'basic');

      -- ⛔ RAZITKO SE PISE PRED ODESLANIM, NE PO NEM. Odpoved `drip-send` je asynchronni
      --    (pg_net), takze uspech tady stejne nezjistime. Kdyby razitko chybelo a beh
      --    spadl mezi odeslanim a zapisem, prisel by mail podruhe. Horsi z obou skod
      --    je opakovany mail, proto se razitkuje driv.
      update public.leads
         set meta = coalesce(meta, '{}'::jsonb)
                    || jsonb_build_object('kosik_at', now(), 'kosik_plan', v_plan),
             updated_at = now()
       where id = v_lead.id;

      perform net.http_post(
        url := 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/drip-send',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-drip-secret', v_drip),
        body := jsonb_build_object('oneoff_email', lower(v_lead.email),
                                   'track', 'tc-kosik', 'step', 0),
        timeout_milliseconds := 30000
      );
      v_odeslano := v_odeslano + 1;
      v_d_ode := v_d_ode + 1;
    end loop;

    update public.tc_kosik_dotazy
       set zpracovano_at = now(),
           vysledek = jsonb_build_object('ok', true, 'odeslano', v_d_ode, 'preskoceno', v_d_pre)
     where id = r.id;
  end loop;

  return jsonb_build_object('ok', true, 'davek', v_davek,
                            'odeslano', v_odeslano, 'preskoceno', v_preskoc);
end;
$fn$;

revoke all on function public.tc_kosik_kandidati() from public, anon, authenticated;
revoke all on function public.tc_kosik_dotaz(int, int) from public, anon, authenticated;
revoke all on function public.tc_kosik_zapis() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) SABLONA MAILU (copy zije v DB, aby sla menit bez redeploye)
-- ---------------------------------------------------------------------------
-- ⛔ `wait_days = null` = posledni krok trate. `tc-kosik` NENI drip, chodi jen
--    jako jednorazovka, takze se sama nikdy neposune a nikdo v ni neuvizne.
-- ⛔ CENA JE V TEXTU NATVRDO (249 Kc). Je to vedomy kompromis mailovych sablon;
--    kdo meni cenik appky, jde pres checklist `tvujcoach-cenik-zmena-checklist`
--    a MUSI projit i tenhle radek.
insert into public.email_templates (track, step, key, subject, preheader, blocks, wait_days)
values (
  'tc-kosik', 0, 'tck-0-kosik',
  'Zastavilo tě něco u předplatného?',
  'Napiš mi jednou větou, co ti chybělo. Čtu si to sám.',
  $blocks$[
    {"t":"p","html":"Ahoj{{fn_space}},"},
    {"t":"p","html":"vidím, že ses v appce díval na předplatné a nakonec jsi ho nedokončil. Zajímá mě jedna věc: co tě zastavilo?"},
    {"t":"p","html":"Odpověz rovnou na tenhle mail, stačí jedna věta. Jestli to byla cena, napiš cenu. Jestli ti chyběla nějaká funkce, napiš která. Čtu si to sám a podle toho appku upravuju."},
    {"t":"p","html":"Kdyby ses chtěl podívat znovu: <strong>Basic stojí 249 Kč měsíčně</strong> a odemyká přepočet kalorií a maker po každém check-inu, generátor jídelníčku i tréninku a funkci „Co si můžu ještě dnes dát“. Počítá to engine, ne AI."},
    {"t":"p","html":"A ať se rozhoduješ na jistotu: zrušíš to kdykoliv v profilu, zaplacené období doběhne a dál se nic nestrhne. Když ti to do 14 dnů od začátku předplatného nesedne, napiš na martin@martinbarna.cz a vrátím ti celou částku bez udání důvodu. Videokurz, který k první platbě dostaneš, ti zůstane napořád."},
    {"t":"btn","href":"https://tvujcoach.cz/client/subscription?plan=basic&utm_source=email&utm_medium=drip&utm_campaign=tc-kosik&utm_content=k0","text":"Podívat se na Basic"},
    {"t":"p","html":"A když ti appka zatím nesedla, taky dobře. Free verze ti zůstává napořád a zápis jídla i tréninku v ní máš bez omezení."},
    {"t":"p","html":"<strong>Be Effective!</strong><br>Martin"}
  ]$blocks$::jsonb,
  null
)
on conflict (track, step) do update
  set key = excluded.key, subject = excluded.subject, preheader = excluded.preheader,
      blocks = excluded.blocks, wait_days = excluded.wait_days, updated_at = now();

-- ---------------------------------------------------------------------------
-- 6) CRON (spustit AZ po overeni, viz kontrola niz)
-- ---------------------------------------------------------------------------
-- ⚠️ Hodina 9 UTC je zamerna: v 7 UTC bezi enroll funkce upsellu a longtailu
--    (`upsell-*`, `nurture-videokurz`, `longtail`), v 6 UTC digest a milestones.
--    V 9 UTC dnes nebezi nic (overeno v `cron.job` 2. 9. 2026).
-- select cron.schedule('tc-kosik-dotaz-denne', '10 9 * * *',
--   $$select public.tc_kosik_dotaz(200, 48);$$);
-- select cron.schedule('tc-kosik-zapis-denne', '25 9 * * *',
--   $$select public.tc_kosik_zapis();$$);

-- ---------------------------------------------------------------------------
-- KONTROLA PO NASAZENI (musi platit vsechno)
-- ---------------------------------------------------------------------------
--   select count(*) from pg_proc where proname = 'tc_kosik_dotaz';   -- 1, ne 2
--   select count(*) from pg_proc where proname = 'tc_kosik_zapis';   -- 1, ne 2
--   select count(*) from public.tc_kosik_kandidati();                -- 2. 9. 2026: 38
--   select * from public.email_templates where track = 'tc-kosik';   -- 1 radek
--   -- SUCHY BEH (posle dotaz do appky, ale zadny mail):
--   select public.tc_kosik_dotaz(200, 48);
--   -- po ~20 s odpoved appky (musi byt status 200 a pole `kosiky`):
--   select status_code, left(content, 400) from net._http_response
--    where id = (select request_id from public.tc_kosik_dotazy order by id desc limit 1);
--   -- TEPRVE PAK ostry krok 2:
--   select public.tc_kosik_zapis();
--   select id, adres, zpracovano_at, vysledek from public.tc_kosik_dotazy order by id desc limit 5;
--
-- TEST SABLONY NA MARTINA (nikoho jineho se nedotkne, engine prilepi [TEST]):
--   select net.http_post(
--     url := 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/drip-send',
--     headers := jsonb_build_object('Content-Type','application/json',
--       'x-drip-secret', (select value from public.app_config where key='drip_invoke_secret')),
--     body := jsonb_build_object('test_email','fitness.barna@gmail.com',
--                                'track','tc-kosik','step',0,'segment','muzi','name','Martin'));
--
-- ROLLBACK (nic z toho neni destruktivni pro leady):
--   select cron.unschedule('tc-kosik-dotaz-denne');
--   select cron.unschedule('tc-kosik-zapis-denne');
--   -- razitka zamerne ZUSTAVAJI, at se nikomu neposle mail podruhe:
--   -- update public.leads set meta = meta - 'kosik_at' - 'kosik_plan' where meta ? 'kosik_at';
-- ============================================================
