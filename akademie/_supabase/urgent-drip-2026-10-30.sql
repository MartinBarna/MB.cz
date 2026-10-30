-- Hotfix drip šablon před pátečním během 30. 10. 2026.
-- Projekt Academy uhmrpfsdcujbhbtumqye. Nic nemazat. Žádné maily odsud neodcházejí.
--
-- NESPOUŠTĚJ SOUBOR CELÝ. Každý blok má vlastní BEGIN a COMMIT.
-- Označ právě jeden blok a spusť ho. Bloky B a C mají pojistku
-- `spustit := false`: dokud ji nepřepneš na true, blok se vrátí a nic nezmění.
-- Náhodné puštění celého souboru proto udělá jen BLOK 0 a BLOK A.
--
-- Pořadí: 0 (záloha) → A (text tří šablon). B je volitelný posun jen upsell-co-2.
-- C je nouze, když A není ověřené do 7:30 v Praze: posune páteční termíny všech tří.
--
-- Proč ne wait_days a proč se šablona nesmí smazat (ověřeno v drip-send/index.ts
-- a pravidla.ts, stav kódu 29. 10. 2026):
--   Due fronta je `status = 'active' AND next_send_at IS NOT NULL AND next_send_at <= now`.
--   `wait_days` se čte až PO odeslání, při posunu na další krok. Null u předchozí
--   šablony (upsell-coaching krok 3, uc-hodnota-checkin) by lidi už sedící na kroku 4
--   nezastavilo. U těch, kdo krok 3 teprve dostanou, by `advance()` vzal konec tratě
--   a most `upsell-coaching → evergreen-kupci` (app_config.navazujici_trate, 30 dní).
--   Chybějící šablona u due leada udělá totéž: most, nebo `next_send_at = null`
--   bez změny kroku. Null termín čte devět enroll funkcí jako „člověk je volný“.
--   Tabule email_templates nemá příznak neaktivní.
--   Bezpečný ekvivalent je posun `leads.next_send_at` dopředu. Krok, trať, status
--   i šablona zůstanou. Jiný mail se nevybere. Přeskočení kroku v kódu není
--   (preskoc.ts tyhle klíče nemá, shouldStop krok 4 u neklienta nechává být).
--
-- Cron: job `drip-send-hourly`, rozvrh `0 * * * *`, pg_cron v UTC.
-- Praha je 30. 10. 2026 v zimním čase, UTC+1 (letní čas skončil 25. 10.).
-- První vlna upsell-co-1 a upsell-co-2 má next_send_at = 2026-10-30 07:00 UTC
-- = 08:00 v Praze. Běh v 06:00 UTC je ještě nevidí (`<= now` nesedí).
-- Chytí je běh, který startuje v 07:00:00 UTC = 08:00:00 v Praze.
-- Nejpozději tedy před 8:00:00 v Praze. Do 7:30 je rezerva na blok C.
-- lk-3 začíná o hodinu později (09:00 v Praze = 08:00 UTC).
-- Termíny nejsou jeden okamžik: odloz_koucink_bali je rozprostřel po hodinách
-- 08:00 až 15:00 v Praze (základ 07:00 UTC + 0 až 7 hodin). Job bali sahá jen na
-- řádky s next_send_at < 2026-10-26 07:00 UTC, listopadový posun nevrátí.
--
-- Textová verze mailu se v drip-send skládá z blocks (tlačítko = text + href).
-- Samostatný textový sloupec šablona nemá. Úprava href platí pro HTML i text.
--
-- Snímky níž jsou stav DB přečtený 29. 10. 2026. Záložní tabulky při BLOKU 0
-- uloží řádky, které v DB budou v okamžiku spuštění. Rollback vrací je, ne tenhle komentář.

-- =============================================================================
-- BLOK 0. Záloha. Nic na frontě nemění. Projeví se hned, jen vzniknou dvě tabulky.
-- Spusť od BEGIN do COMMIT.
-- =============================================================================
begin;

do $blok0$
declare
  n_sablon int;
begin
  if to_regclass('public.email_templates_urgent_20261030') is not null
     or to_regclass('public.leads_urgent_20261030') is not null then
    raise exception 'BLOK 0: zaloha uz existuje. Neprepisuji ji. Nejdřív rollback bloku 0, az budou A/B/C vracene.';
  end if;

  create table public.email_templates_urgent_20261030 as
  select *
  from public.email_templates
  where key in ('upsell-co-1', 'upsell-co-2', 'lk-3-koucink');

  -- Bez e-mailu. lead_id stačí na vrácení termínu.
  create table public.leads_urgent_20261030 as
  select l.id as lead_id,
         l.track,
         l.step,
         t.key as template_key,
         l.status,
         l.next_send_at,
         l.updated_at as leads_updated_at
  from public.leads l
  join public.email_templates t
    on t.track = l.track and t.step = l.step
  where l.status = 'active'
    and l.next_send_at is not null
    and t.key in ('upsell-co-1', 'upsell-co-2', 'lk-3-koucink')
    and (l.next_send_at at time zone 'Europe/Prague')::date = date '2026-10-30';

  alter table public.email_templates_urgent_20261030 enable row level security;
  alter table public.leads_urgent_20261030 enable row level security;
  revoke all on public.email_templates_urgent_20261030 from public, anon, authenticated;
  revoke all on public.leads_urgent_20261030 from public, anon, authenticated;

  select count(*) into n_sablon from public.email_templates_urgent_20261030;
  if n_sablon <> 3 then
    raise exception 'BLOK 0: zaloha sablon ma % radku, cekal jsem 3.', n_sablon;
  end if;
end
$blok0$;

-- Ověření bloku 0. Musí ukázat tři klíče a páteční počty. Žádné e-maily.
select b.key, b.track, b.step, b.wait_days,
       (select count(*) from public.leads_urgent_20261030 l where l.template_key = b.key) as patek_lidi,
       (select to_char(min(l.next_send_at at time zone 'Europe/Prague'), 'YYYY-MM-DD HH24:MI')
          from public.leads_urgent_20261030 l where l.template_key = b.key) as prvni_praha,
       (select to_char(max(l.next_send_at at time zone 'Europe/Prague'), 'YYYY-MM-DD HH24:MI')
          from public.leads_urgent_20261030 l where l.template_key = b.key) as posledni_praha
from public.email_templates_urgent_20261030 b
order by b.track, b.step;

commit;

-- ----- ROLLBACK BLOKU 0 (samostatně, až jsou A/B/C vrácené nebo vůbec neběžely) -----
-- begin;
-- drop table if exists public.leads_urgent_20261030;
-- drop table if exists public.email_templates_urgent_20261030;
-- commit;

-- =============================================================================
-- BLOK A. Hotfix textu tří šablon. Šablonu nemaže, wait_days / subject / preheader
-- nemění, na leady nesahá.
-- Projeví se u nejbližšího drip-send, který daného člověka vezme. U páteční první
-- vlny je to běh v 8:00 v Praze, pokud je UPDATE commitnutý před 8:00:00.
-- Redeploy funkce není potřeba: drip-send čte blocks z DB při odeslání.
-- Spusť od BEGIN do COMMIT. Vyžaduje BLOK 0.
--
-- PŘED (věty a odkazy, zbytek bloku se nemění):
--   lk-3, mezi tlačítkem a podpisem, celý odstavec pryč:
--     „Beru najednou nejvýš 10 lidí a do Diamondu jen 3, ať na každého mám čas.
--      Gold volí lidi častěji, protože v něm nejsou týdenní hovory a stejně jsme
--      v kontaktu na WhatsAppu.“
--     Odkaz: https://martinbarna.cz/koucing/?utm_source=email&utm_medium=drip&utm_campaign=longtail-kupci&utm_content=lk-3-koucink
--     Po:    https://martinbarna.cz/koucing/
--     Věta před tlačítkem („S vedením na míru to půjde rychleji.“) zůstává, podpis navazuje.
--   upsell-co-1, odstavec před tlačítkem pryč:
--     „K té volbě mezi Goldem a Diamondem: Diamond otevírám nejvýš třem lidem,
--      protože týdenní hovory zaberou čas. Gold je bez nich a beru ho jako výchozí
--      volbu; na WhatsAppu mě máš tak jako tak.“
--     Odkaz: https://martinbarna.cz/koucing/?utm_source=email&utm_medium=drip&utm_campaign=upsell-coaching&utm_content=upsell-co-1
--     Po:    https://martinbarna.cz/koucing/#balicky
--     P.S. o Goldu a Diamondu bez čísla zůstává.
--   upsell-co-2, odstavec o kapacitě pryč:
--     „A k tomu „jak to je“ patří i tohle: vedu najednou nejvýš 10 lidí. Neslibuju
--      ti proto, že místo bude pořád, ale ani ti nebudu tvrdit, že zítra dochází.“
--     Navazující úprava jen předchozí věty, ať „jak to je“ nezůstane viset:
--       PŘED: „…poslední mail. Žádný umělý časovač, jen ať víš, jak to je.“
--       PO:   „…poslední mail. Žádný umělý časovač.“
--     Odkaz: https://martinbarna.cz/koucing/?utm_source=email&utm_medium=drip&utm_campaign=upsell-coaching&utm_content=upsell-co-2
--     Po:    https://martinbarna.cz/koucing/
-- =============================================================================
begin;

do $blokA$
declare
  n int;
begin
  if to_regclass('public.email_templates_urgent_20261030') is null
     or to_regclass('public.leads_urgent_20261030') is null then
    raise exception 'BLOK A: chybi zaloha. Nejdriv samostatne spust BLOK 0.';
  end if;

  update public.email_templates
  set blocks = $lk3new$[
    {"t":"p","html":"Ahoj{{fn_space}},"},
    {"t":"p","html":"videokurz tě naučí, jak to funguje. Co ale za tebe neudělá: nenastaví ti čísla na tvůj konkrétní život a nepodrží tě, když přijde první krize."},
    {"t":"p","html":"Přesně na to mám <strong>koučink 1:1</strong>: jídelníček i trénink na míru (práce, směny, rodina, zranění), pondělní check-iny s úpravou plánu podle dat a WhatsApp, když si nevíš rady. Kurz už máš, principy znáš. S vedením na míru to půjde rychleji."},
    {"t":"btn","href":"https://martinbarna.cz/koucing/","text":"Jak koučink funguje"},
    {"t":"p","html":"<strong>Be Effective!</strong><br>Martin"}
  ]$lk3new$::jsonb,
      updated_at = now()
  where track = 'longtail-kupci' and step = 5 and key = 'lk-3-koucink'
    and (blocks::text like '%utm_%' or blocks::text like '%nejvýš%');
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'BLOK A lk-3: cekal jsem 1 radek, aktualizovano %. Nic nemeni, transakce se vrati.', n;
  end if;

  update public.email_templates
  set blocks = $co1new$[
    {"t":"p","html":"Ahoj{{fn_space}},"},
    {"t":"p","html":"videokurz ti dal <strong>znalosti</strong>. Ale ruku na srdce: vědět, co dělat, a dělat to týden co týden i když se nechce, jsou dvě různé věci. Ta druhá půlka rozhoduje. A přesně tam přijdu já."},
    {"t":"p","html":"Co v koučinku dostaneš navíc oproti samostudiu:"},
    {"t":"bullets","items":[
      "<strong>Plán na míru tobě</strong>: čísla a tréninky na tvoje tělo, život a cíl.",
      "<strong>Týdenní úpravy podle reálných dat</strong>: když se váha zasekne, hýbeme s tím hned.",
      "<strong>Kontrola</strong>: víš, že se mi v neděli hlásíš. To drží lidi u věci líp než sebevětší motivace.",
      "<strong>Já na drátě</strong>: WhatsApp i mail, když něco nevíš nebo přijde krize."
    ]},
    {"t":"p","html":"A na čem mi záleží nejvíc: <strong>nedělám z lidí závisláky.</strong> Vedu tě tak, ať tomu rozumíš a jednou to <strong>zvládneš úplně bez mé pomoci</strong>, jako Tomáš s Katkou, co si to 2 roky po spolupráci drží bez mého plánu."},
    {"t":"btn","href":"https://martinbarna.cz/koucing/#balicky","text":"Vybrat balíček"},
    {"t":"p","html":"<strong>Be Effective!</strong><br>Martin"},
    {"t":"ps","html":"P.S. Gold, nebo Diamond? Napiš mi cíl a časový horizont, poradím ti, co se ti vyplatí."}
  ]$co1new$::jsonb,
      updated_at = now()
  where track = 'upsell-coaching' and step = 2 and key = 'upsell-co-1'
    and (blocks::text like '%utm_%' or blocks::text like '%nejvýš%');
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'BLOK A upsell-co-1: cekal jsem 1 radek, aktualizovano %. Nic nemeni, transakce se vrati.', n;
  end if;

  update public.email_templates
  set blocks = $co2new$[
    {"t":"p","html":"Ahoj{{fn_space}},"},
    {"t":"p","html":"nebudu tě otravovat donekonečna, tohle je ke koučinku poslední mail. Žádný umělý časovač."},
    {"t":"p","html":"Většina mých klientů má společné jedno: <strong>rok dva to zkoušeli sami</strong>, četli, střídali diety. A pak si řekli dost a vzali to se mnou."},
    {"t":"p","html":"Nejlepší reklamu mi přitom nedělám já, dělají ji oni. <strong>Spokojený klient mi pošle dalšího</strong>, protože výsledek je vidět a drží. To o kvalitě řekne víc než jakýkoliv můj text."},
    {"t":"p","html":"Jestli chceš, abych tě vedl já, jsem tady:"},
    {"t":"btn","href":"https://martinbarna.cz/koucing/","text":"Mrknout na balíčky"},
    {"t":"p","html":"A jestli teď není ta chvíle, nevadí. Videokurz máš doživotně, jeď podle něj a klidně se ozvi za měsíc. Budu tady.<br><strong>Be Effective!</strong><br>Martin"},
    {"t":"ps","html":"P.S. Máš jen otázku, ne rozhodnutí? Stačí odepsat na tenhle e-mail. Nezávazně, bez prodejních keců."}
  ]$co2new$::jsonb,
      updated_at = now()
  where track = 'upsell-coaching' and step = 4 and key = 'upsell-co-2'
    and (blocks::text like '%utm_%' or blocks::text like '%nejvýš%');
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'BLOK A upsell-co-2: cekal jsem 1 radek, aktualizovano %. Nic nemeni, transakce se vrati.', n;
  end if;

  if exists (
    select 1 from public.email_templates
    where key in ('upsell-co-1', 'upsell-co-2', 'lk-3-koucink')
      and (blocks::text like '%utm_%' or blocks::text like '%nejvýš%' or blocks::text ilike '%nejvys%')
  ) then
    raise exception 'BLOK A: v sablone zustalo utm_ nebo kapacitni cislo.';
  end if;

  if not exists (
    select 1 from public.email_templates
    where key = 'upsell-co-1'
      and blocks @> '[{"t":"btn","href":"https://martinbarna.cz/koucing/#balicky"}]'::jsonb
  ) then
    raise exception 'BLOK A: upsell-co-1 nema tlacitko https://martinbarna.cz/koucing/#balicky';
  end if;

  if (
    select count(*) from public.email_templates
    where key in ('upsell-co-2', 'lk-3-koucink')
      and blocks @> '[{"t":"btn","href":"https://martinbarna.cz/koucing/"}]'::jsonb
  ) <> 2 then
    raise exception 'BLOK A: upsell-co-2 nebo lk-3 nema ciste https://martinbarna.cz/koucing/';
  end if;

  if exists (
    select 1
    from public.email_templates t
    join public.email_templates_urgent_20261030 b
      on b.track = t.track and b.step = t.step
    where t.key in ('upsell-co-1', 'upsell-co-2', 'lk-3-koucink')
      and (t.subject is distinct from b.subject
        or t.preheader is distinct from b.preheader
        or t.wait_days is distinct from b.wait_days
        or t.key is distinct from b.key)
  ) then
    raise exception 'BLOK A zmenil subject, preheader, wait_days nebo key.';
  end if;

  if exists (
    select 1
    from public.leads_urgent_20261030 b
    join public.leads l on l.id = b.lead_id
    where l.next_send_at is distinct from b.next_send_at
       or l.step is distinct from b.step
       or l.track is distinct from b.track
       or l.status is distinct from b.status
  ) then
    raise exception 'BLOK A nesmi sahat na leady.';
  end if;
end
$blokA$;

select key, track, step, wait_days,
       blocks::text like '%utm_%' as ma_utm,
       blocks::text like '%nejvýš%' as ma_kapacitu,
       (select e.value->>'href'
          from jsonb_array_elements(blocks) e
         where e.value->>'t' = 'btn'
         limit 1) as tlacitko
from public.email_templates
where key in ('upsell-co-1', 'upsell-co-2', 'lk-3-koucink')
order by track, step;

commit;

-- ----- ROLLBACK BLOKU A (samostatně; vrátí blocks ze zálohy, leady nechá) -----
-- begin;
-- update public.email_templates t
-- set blocks = b.blocks,
--     subject = b.subject,
--     preheader = b.preheader,
--     wait_days = b.wait_days,
--     updated_at = now()
-- from public.email_templates_urgent_20261030 b
-- where t.track = b.track and t.step = b.step and t.key = b.key
--   and t.key in ('upsell-co-1', 'upsell-co-2', 'lk-3-koucink');
-- -- ověření: tlacitka zase obsahují utm_
-- select key, (select e.value->>'href' from jsonb_array_elements(blocks) e where e.value->>'t' = 'btn' limit 1) as tlacitko
-- from public.email_templates where key in ('upsell-co-1', 'upsell-co-2', 'lk-3-koucink');
-- commit;

-- =============================================================================
-- BLOK B. Volitelně. Pozdrží jen upsell-co-2 (upsell-coaching, krok 4).
-- Vyřazeno ve v5, 29. 10. Šablona zůstává, krok zůstává, nikdo nedostane jiný mail
-- a nikdo se neposune na další krok (další krok neexistuje; konec tratě by až při
-- skutečném odeslání udělal most do evergreen-kupci, a tenhle blok mail neodešle).
--
-- Co změní: pátečním aktivním leadům na tom kroku přičte 30 dní k next_send_at.
-- Hodina v Praze zůstane (mezi 30. 10. a 29. 11. se nemění posun UTC).
-- 30. 10. 08:00 v Praze tedy vyjde na 29. 11. 08:00 v Praze, a stejně ostatní hodiny.
-- Projeví se u nejbližšího cronu: 8:00 v Praze je už neuvidí, pokud je COMMIT
-- před 8:00:00. odloz_koucink_bali je nevrátí (sahá jen před 26. 10. 07:00 UTC).
--
-- Když už běžel BLOK C, páteční co-2 ve frontě není a tenhle blok se sám vrátí.
-- Nejdřív B, pak případně C. Pojistku `spustit` přepni na true.
-- =============================================================================
begin;

do $blokB$
declare
  spustit boolean := false;
  n int;
begin
  if not spustit then
    raise exception 'BLOK B neni zapnuty. Nastav spustit := true a spust jen BEGIN..COMMIT tohoto bloku.';
  end if;
  if to_regclass('public.leads_urgent_20261030') is null then
    raise exception 'BLOK B: chybi zaloha. Nejdriv BLOK 0.';
  end if;

  update public.leads l
  set next_send_at = l.next_send_at + interval '30 days',
      updated_at = now()
  from public.email_templates t
  where t.track = l.track
    and t.step = l.step
    and t.key = 'upsell-co-2'
    and l.status = 'active'
    and l.next_send_at is not null
    and (l.next_send_at at time zone 'Europe/Prague')::date = date '2026-10-30';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'BLOK B: na 30. 10. neni aktivni upsell-co-2 (uz posunuty blokem C, nebo uz odesel). Nic jsem nezmenil.';
  end if;

  if exists (
    select 1
    from public.leads l
    join public.leads_urgent_20261030 b on b.lead_id = l.id
    where l.step is distinct from b.step
       or l.track is distinct from b.track
  ) then
    raise exception 'BLOK B zmenil krok nebo trat.';
  end if;

  -- Kdo je porad aktivni na kroku 4, nesmi zustat na patku. Kdo mezitim
  -- vypadl (status, krok), se neposouva a blok kvuli nemu nepadá.
  if exists (
    select 1
    from public.leads l
    join public.leads_urgent_20261030 b on b.lead_id = l.id
    where b.template_key = 'upsell-co-2'
      and l.status = 'active'
      and l.step = b.step
      and l.track = b.track
      and (l.next_send_at at time zone 'Europe/Prague')::date = date '2026-10-30'
  ) then
    raise exception 'BLOK B: aktivni upsell-co-2 zustal na 30. 10.';
  end if;

  if exists (
    select 1
    from public.leads l
    join public.leads_urgent_20261030 b on b.lead_id = l.id
    where b.template_key <> 'upsell-co-2'
      and l.next_send_at is distinct from b.next_send_at
  ) then
    raise exception 'BLOK B sahnul na upsell-co-1 nebo lk-3.';
  end if;
end
$blokB$;

select b.template_key,
       count(*) as lidi,
       to_char(min(l.next_send_at at time zone 'Europe/Prague'), 'YYYY-MM-DD HH24:MI') as prvni_praha,
       to_char(max(l.next_send_at at time zone 'Europe/Prague'), 'YYYY-MM-DD HH24:MI') as posledni_praha,
       count(*) filter (where l.step is distinct from b.step or l.status is distinct from b.status) as zmeneny_krok_nebo_status
from public.leads_urgent_20261030 b
join public.leads l on l.id = b.lead_id
group by b.template_key
order by b.template_key;

commit;

-- ----- ROLLBACK BLOKU B (jen řádky, které jsou přesně o 30 dní dál než záloha) -----
-- begin;
-- update public.leads l
-- set next_send_at = b.next_send_at,
--     updated_at = now()
-- from public.leads_urgent_20261030 b
-- where l.id = b.lead_id
--   and b.template_key = 'upsell-co-2'
--   and l.next_send_at = b.next_send_at + interval '30 days';
-- select template_key,
--        to_char(min(l.next_send_at at time zone 'Europe/Prague'), 'YYYY-MM-DD HH24:MI') as prvni_praha
-- from public.leads_urgent_20261030 b
-- join public.leads l on l.id = b.lead_id
-- where b.template_key = 'upsell-co-2'
-- group by template_key;
-- commit;

-- =============================================================================
-- BLOK C. Nouzové pozastavení všech tří kroků, když BLOK A není do 7:30 v Praze
-- ověřený. Nic nemaže. wait_days nemění (viz hlavička: na už naplánované lidi
-- by to nefungovalo).
--
-- Co změní: aktivním leadům šablon upsell-co-1, upsell-co-2 a lk-3, jejichž
-- next_send_at padá na 30. 10. 2026 v Praze, přičte 7 dní. Hodina zůstane.
-- První vlna 30. 10. 08:00 vyjde na 6. 11. 08:00 v Praze. Krok, trať i status
-- zůstanou, takže nepřijde jiný mail a krok se nepřeskočí.
-- Projeví se před během v 8:00, pokud je COMMIT před 8:00:00 v Praze.
-- Kdo už není na pátku (typicky co-2 po bloku B, +30 dní), se nesáhne.
-- Pojistku `spustit` přepni na true. Když je páteční fronta prázdná, blok se vrátí.
-- =============================================================================
begin;

do $blokC$
declare
  spustit boolean := false;
  n int;
begin
  if not spustit then
    raise exception 'BLOK C neni zapnuty. Nastav spustit := true a spust jen BEGIN..COMMIT tohoto bloku.';
  end if;
  if to_regclass('public.leads_urgent_20261030') is null then
    raise exception 'BLOK C: chybi zaloha. Nejdriv BLOK 0.';
  end if;

  update public.leads l
  set next_send_at = l.next_send_at + interval '7 days',
      updated_at = now()
  from public.email_templates t
  where t.track = l.track
    and t.step = l.step
    and t.key in ('upsell-co-1', 'upsell-co-2', 'lk-3-koucink')
    and l.status = 'active'
    and l.next_send_at is not null
    and (l.next_send_at at time zone 'Europe/Prague')::date = date '2026-10-30';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'BLOK C: na 30. 10. uz nikdo z tech tri sablon neni. Nic jsem nezmenil.';
  end if;

  if exists (
    select 1
    from public.leads l
    join public.leads_urgent_20261030 b on b.lead_id = l.id
    where l.step is distinct from b.step
       or l.track is distinct from b.track
  ) then
    raise exception 'BLOK C zmenil krok nebo trat.';
  end if;

  if exists (
    select 1
    from public.leads l
    join public.leads_urgent_20261030 b on b.lead_id = l.id
    where l.status = 'active'
      and l.step = b.step
      and l.track = b.track
      and b.template_key in ('upsell-co-1', 'lk-3-koucink')
      and l.next_send_at is distinct from b.next_send_at + interval '7 days'
  ) then
    raise exception 'BLOK C: aktivni upsell-co-1 nebo lk-3 nema termin +7 dni.';
  end if;

  if exists (
    select 1
    from public.leads l
    join public.leads_urgent_20261030 b on b.lead_id = l.id
    where l.status = 'active'
      and l.step = b.step
      and l.track = b.track
      and b.template_key = 'upsell-co-2'
      and l.next_send_at is distinct from b.next_send_at + interval '7 days'
      and l.next_send_at is distinct from b.next_send_at + interval '30 days'
  ) then
    raise exception 'BLOK C: aktivni upsell-co-2 nema termin +7 dni ani +30 dni z bloku B.';
  end if;
end
$blokC$;

select b.template_key,
       count(*) as lidi,
       to_char(min(l.next_send_at at time zone 'Europe/Prague'), 'YYYY-MM-DD HH24:MI') as prvni_praha,
       to_char(max(l.next_send_at at time zone 'Europe/Prague'), 'YYYY-MM-DD HH24:MI') as posledni_praha,
       count(*) filter (where l.step is distinct from b.step or l.status is distinct from b.status) as zmeneny_krok_nebo_status
from public.leads_urgent_20261030 b
join public.leads l on l.id = b.lead_id
group by b.template_key
order by b.template_key;

commit;

-- ----- ROLLBACK BLOKU C (jen řádky přesně +7 dní proti záloze; +30 dní z bloku B nevrací) -----
-- begin;
-- update public.leads l
-- set next_send_at = b.next_send_at,
--     updated_at = now()
-- from public.leads_urgent_20261030 b
-- where l.id = b.lead_id
--   and b.template_key in ('upsell-co-1', 'upsell-co-2', 'lk-3-koucink')
--   and l.next_send_at = b.next_send_at + interval '7 days';
-- select b.template_key,
--        to_char(min(l.next_send_at at time zone 'Europe/Prague'), 'YYYY-MM-DD HH24:MI') as prvni_praha,
--        count(*) as lidi
-- from public.leads_urgent_20261030 b
-- join public.leads l on l.id = b.lead_id
-- group by b.template_key
-- order by b.template_key;
-- commit;

-- =============================================================================
-- OVĚŘENÍ kdykoli, nic nemění. Spusť samotný SELECT.
-- ma_utm a ma_kapacitu mají být false. tlacitko upsell-co-1 je
-- https://martinbarna.cz/koucing/#balicky, u zbylých dvou https://martinbarna.cz/koucing/
-- =============================================================================
-- select key, track, step, wait_days,
--        blocks::text like '%utm_%' as ma_utm,
--        (blocks::text like '%nejvýš%' or blocks::text ilike '%nejvys%') as ma_kapacitu,
--        (select e.value->>'href' from jsonb_array_elements(blocks) e where e.value->>'t' = 'btn' limit 1) as tlacitko
-- from public.email_templates
-- where key in ('upsell-co-1', 'upsell-co-2', 'lk-3-koucink')
-- order by track, step;
--
-- select t.key,
--        (l.next_send_at at time zone 'Europe/Prague')::date as den_praha,
--        to_char(l.next_send_at at time zone 'Europe/Prague', 'HH24:MI') as cas_praha,
--        count(*) as lidi
-- from public.leads l
-- join public.email_templates t on t.track = l.track and t.step = l.step
-- where l.status = 'active'
--   and l.next_send_at is not null
--   and t.key in ('upsell-co-1', 'upsell-co-2', 'lk-3-koucink')
--   and l.next_send_at < timestamptz '2026-12-01 00:00+00'
-- group by 1, 2, 3
-- order by 1, 2, 3;
