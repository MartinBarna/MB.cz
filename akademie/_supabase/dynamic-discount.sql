-- ============================================================
-- Barna Academy - DYNAMICKE SLEVY (#36): aktivni uzivatel co nekupuje
-- Spust PO drip-engine.sql + drip-templates.sql.
--
-- LOGIKA: kdo se zaregistroval do free tieru (ma ucet), chodi sem (prihlasil
-- se nedavno), ale JESTE NEKOUPIL (zadny aktivni entitlement) -> po case mu
-- automaticky nabidneme slevu, at ho dotlacime pres hranu. Mekce, ne spam.
--
-- POZN. PRO COWORK: enroll funkce nize cte auth.users.last_sign_in_at +
-- profiles + entitlements. Over nazvy sloupcu proti realne DB (mela by sedet
-- na schema.sql). Spis nez automaticky cron muzes poprve spustit rucne a
-- zkontrolovat, koho to nabralo (select * from leads where track='active-no-buy').
-- ============================================================

-- 0) Audience-neutralni paticka (plati pro vsechny tracky)
--    Puvodni text "stahl sis plan zdarma" nesedi pro registrovane cleny ->
--    menime na neutralni a pravdive zneni (legalne staci viditelny odhl. odkaz).
insert into public.app_config (key, value) values
('footer_html', $f$Tento e-mail jsi dostal[a], protože ses přihlásil[a] k odběru nebo registroval[a] na martinbarna.cz.<br>Nechceš už e-maily? <a href="{{unsubscribe_url}}" style="color:#999">Odhlásit se</a> — jedním klikem, bez urážky :)<br>Martin Barna — online výživový Coach · <a href="https://martinbarna.cz" style="color:#999">martinbarna.cz</a>$f$),
('footer_text', $f$Tento e-mail jsi dostal[a], protože ses přihlásil[a] k odběru nebo registroval[a] na martinbarna.cz.
Odhlásit se: {{unsubscribe_url}}
Martin Barna — online výživový Coach · martinbarna.cz$f$)
on conflict (key) do update set value = excluded.value, updated_at = now();

-- 1) TEMPLATES: track 'active-no-buy' (3 maily) -------------------------------
insert into public.email_templates (track, step, key, subject, preheader, blocks, wait_days) values

('active-no-buy', 0, 'and-vidim',
 $s$Vidím, že to bereš vážně 👀$s$,
 $h$A to se mi líbí. Mám pro Tebe nabídku.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Koukám, že si free obsah u mě fakt projíždíš — a to není samozřejmost, většina lidí to po prvním kliknutí vzdá. Klobouk dolů. 🤝"},{"t":"p","html":"Když Ti ochutnávka sedla, mám pro Tebe ten zbytek: <strong>celý systém</strong>, krok za krokem, ať nemusíš lovit informace po internetu a hádat, co platí."},{"t":"bullets","items":["jak si <strong>[[sama||sám]] poskládáš jídelníček</strong>, co Tě baví a funguje","kolik jíst, abys [[hubla||hubl]], ale neztrácel[a] svaly a energii","jak <strong>nepřibrat zpátky</strong> — konec jojo kolečka"]},{"t":"btn","text":"Mrknout na celý videokurz","href":"{{course_url}}"},{"t":"p","html":"Zatím nic neřeš — jen jsem Ti chtěl říct, že na to nemusíš [[sama||sám]]. Za pár dní se ozvu ještě s jednou věcí. 😉<br><strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 5),

('active-no-buy', 1, 'and-sleva',
 $s${{fn_prefix}}za tu snahu máš -{{discount_pct}} %$s$,
 $h$Odměna za to, že to fakt řešíš.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Slíbil jsem ještě jednu věc — tady je. Protože vidím, že to s formou myslíš vážně, dávám Ti na <strong>videokurz</strong> (klidně i Academy) <strong>slevu {{discount_pct}} %</strong> s kódem <strong>{{discount_code}}</strong>. Z {{course_price}} Kč je <strong>{{discount_price}} Kč</strong>."},{"t":"p","html":"Není to plošná akce — kód je jen pro Tebe (1× na e-mail), právě proto, že do toho dáváš víc než ostatní."},{"t":"btn","text":"Odemknout se slevou","href":"{{course_url}}"},{"t":"p","html":"Free obsah Ti dal směr. Tohle Ti dá <strong>celou cestu</strong> — a zůstane Ti to napořád.<br><strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 7),

('active-no-buy', 2, 'and-sleva2',
 $s${{fn_prefix}}poslední šance na tu slevu$s$,
 $h$Pak ji zavírám, ať to není věčná akce.$h$,
 $j$[{"t":"p","html":"Ahoj{{fn_space}},"},{"t":"p","html":"Kód jsi zatím nevyužil[a] — chápu, život jede. Ale nechci, aby Ti utekla cena, kterou normálně nedávám. <strong>Tohle je poslední připomenutí</strong>, pak slevu zavírám."},{"t":"p","html":"Pořád platí <strong>{{discount_pct}} %</strong> s kódem <strong>{{discount_code}}</strong> — videokurz za <strong>{{discount_price}} Kč</strong>."},{"t":"btn","text":"Chci to teď","href":"{{course_url}}"},{"t":"p","html":"Když to není ono, klidně to nech být — budu Ti fandit tak jako tak. Ale věřím, že to v sobě máš. 💪<br><strong>Be Effective!</strong><br>Martin"}]$j$::jsonb,
 null)

on conflict (track, step) do update set
  key = excluded.key, subject = excluded.subject, preheader = excluded.preheader,
  blocks = excluded.blocks, wait_days = excluded.wait_days, updated_at = now();

-- 2) ENROLL ENGINE: najdi aktivni neplatice a zaradi je do tracku ------------
-- Kdo se kvalifikuje:
--   - ma profil (registrovany) starsi nez 14 dni
--   - prihlasil se za poslednich 30 dni (= aktivni, jeste neodpadl)
--   - NEMA aktivni placeny entitlement (videokurz ani academy)
--   - jeho e-mail jeste NENI v leads (neklobrcujeme bezici lead-magnet sekvenci)
-- Vlozi se 1 radek do leads s track='active-no-buy', rovnou "due" (next_send_at=now()).
create or replace function public.enroll_active_no_buy()
returns int language plpgsql security definer set search_path = public, auth as $$
declare n int;
begin
  with cand as (
    select lower(u.email) as email,
           coalesce(p.full_name, '') as name
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.email is not null
      and p.created_at < now() - interval '14 days'
      and u.last_sign_in_at > now() - interval '30 days'
      and not exists (
        select 1 from public.entitlements e
        where lower(e.email) = lower(u.email) and e.active = true
      )
      and not exists (
        select 1 from public.leads l where lower(l.email) = lower(u.email)
      )
  )
  insert into public.leads (email, name, segment, source, track, next_send_at)
  select email, name, 'other', 'active-no-buy', 'active-no-buy', now()
  from cand
  on conflict (email) do nothing;
  get diagnostics n = row_count;
  return n;
end; $$;

-- 3) Denni cron: zaradi nove kvalifikovane. Vlastni rozesilani uz resi
--    stavajici hodinovy 'drip-send-hourly' cron (cte vsechny tracky z leads).
select cron.schedule('enroll-active-no-buy-daily', '30 6 * * *', $cron$
  select public.enroll_active_no_buy();
$cron$);

-- ============================================================
-- MERGE TOKENY pouzite vyse (resi je drip-send funkce, uz existuji):
--   {{fn_space}} {{fn_prefix}} {{course_url}} {{course_price}}
--   {{discount_pct}} {{discount_code}} {{discount_price}} {{unsubscribe_url}}
-- Hodnoty slevy ({{discount_pct}}/code/price) nastav v app_config nebo v
-- drip-send (stejne jako u lead-magnet kroku 4). Kod musi existovat v SimpleShop.
-- NEPOUZIVAT testovaci kod 'hackerman'.
-- ============================================================
