-- NESPUSŤENO. Martin 29. 10. 2026: viditelný odkaz v mailu nesmí nést kampanové parametry.
-- Soubor se nespouští z repa ani z agenta. Až po schválení, ručně, v projektu Academy.
-- Záloha jen dotčených řádků. Když tabulka zálohy už existuje, skript skončí a nic nepřepíše.
-- Platební odkazy buy.stripe.com a form.simpleshop.cz zůstanou, jen bez kampanových parametrů.
-- Odkaz s e-mailem v query (přihlášení do appky) zůstane, jen bez kampanových parametrů.
-- Závislost: zkratky /go/ musí být na webu dřív, než tenhle UPDATE odjede v ostřem mailu.
-- Pořadí: nejdřív merge PR #628 (čisté /go/ bez dopisování parametrů), potom tenhle PR, potom nasazení webu, teprve potom tenhle SQL.

begin;

do $hlidka$
begin
  if to_regclass('public.email_templates_zaloha_kratke_odkazy_20261029') is not null then
    raise exception 'zaloha email_templates_zaloha_kratke_odkazy_20261029 uz existuje, soubor se nespousti podruhe';
  end if;
end
$hlidka$;

create table public.email_templates_zaloha_kratke_odkazy_20261029 as
select *
from public.email_templates
where blocks::text ~ ('u' || 'tm_')
   or coalesce(subject, '') ~ ('u' || 'tm_')
   or coalesce(preheader, '') ~ ('u' || 'tm_');

alter table public.email_templates_zaloha_kratke_odkazy_20261029 enable row level security;
revoke all on public.email_templates_zaloha_kratke_odkazy_20261029 from anon, authenticated;

create temp table mb_kratke_pary (stary text primary key, novy text not null);
insert into mb_kratke_pary (stary, novy) values
  ($o$https://tvujcoach.cz/sign-in?email={{email_url}}&from=academy&utm_source=email&utm_medium=drip&utm_campaign=onb-academy-mesicni&utm_content=step0-app$o$, $n$https://tvujcoach.cz/sign-in?email={{email_url}}&from=academy$n$),
  ($o$https://buy.stripe.com/7sY14m4Z19Vo2J2eG33ks0r?locale=cs&utm_source=email&utm_medium=drip&utm_campaign=academy-vk-serie&utm_content=avk-3-rozhodnuti$o$, $n$https://buy.stripe.com/7sY14m4Z19Vo2J2eG33ks0r?locale=cs$n$),
  ($o$https://buy.stripe.com/6oU8wO3UX3x00AU55t3ks07?utm_source=email&utm_medium=drip&utm_campaign=konzultace-po-basicu&utm_content=onb-tc-48h&locale=cs$o$, $n$https://buy.stripe.com/6oU8wO3UX3x00AU55t3ks07?locale=cs$n$),
  ($o$https://buy.stripe.com/7sY14m4Z19Vo2J2eG33ks0r?locale=cs&utm_source=email&utm_medium=drip&utm_campaign=academy-vk-serie&utm_content=avk-2-namitky$o$, $n$https://buy.stripe.com/7sY14m4Z19Vo2J2eG33ks0r?locale=cs$n$),
  ($o$https://buy.stripe.com/bJe9AS3UXgjMcjC8hF3ks00?locale=cs&utm_source=email&utm_medium=drip&utm_campaign=academy-vk-serie&utm_content=avk-2-mesicne$o$, $n$https://buy.stripe.com/bJe9AS3UXgjMcjC8hF3ks00?locale=cs$n$),
  ($o$https://buy.stripe.com/7sY14m4Z19Vo2J2eG33ks0r?locale=cs&utm_source=email&utm_medium=drip&utm_campaign=academy-vk-serie&utm_content=avk-1-lekce$o$, $n$https://buy.stripe.com/7sY14m4Z19Vo2J2eG33ks0r?locale=cs$n$),
  ($o$https://buy.stripe.com/6oU8wO3UX3x00AU55t3ks07?utm_source=email&utm_medium=drip&utm_campaign=konzultace-vk&utm_content=onb-vk-2&locale=cs$o$, $n$https://buy.stripe.com/6oU8wO3UX3x00AU55t3ks07?locale=cs$n$),
  ($o$https://martinbarna.cz/akademie/studium/m1-l1/?utm_source=email&utm_medium=drip&utm_campaign=academy-vk-serie&utm_content=avk-1-lekce$o$, $n$https://martinbarna.cz/go/lekce-m/$n$),
  ($o$https://tvujcoach.cz/client/subscription?plan=basic&utm_source=email&utm_medium=drip&utm_campaign=tc-trial-nabidka&utm_content=t0$o$, $n$https://martinbarna.cz/go/tc-predplatne-m/$n$),
  ($o$https://martinbarna.cz/akademie/overit/?utm_source=email&utm_medium=drip&utm_campaign=academy-vk-serie&utm_content=avk-3-overit$o$, $n$https://martinbarna.cz/go/overit-m/$n$),
  ($o$https://buy.stripe.com/4gM00ibnpgjMerK7dB3ks04?utm_source=email&utm_medium=email&utm_campaign=longtail-trener-final&locale=cs$o$, $n$https://buy.stripe.com/4gM00ibnpgjMerK7dB3ks04?locale=cs$n$),
  ($o$https://martinbarna.cz/akademie/studium/?utm_source=email&utm_medium=drip&utm_campaign=onb-academy-mesicni&utm_content=step0$o$, $n$https://martinbarna.cz/go/studium-m/$n$),
  ($o$https://martinbarna.cz/?utm_source=email&utm_medium=drip&utm_campaign=upsell-po-konzultaci&utm_content=onb-konz-48h#balicky$o$, $n$https://martinbarna.cz/go/balicky-m/$n$),
  ($o$https://martinbarna.cz/akademie/?utm_source=email&utm_medium=drip&utm_campaign=longtail-trener&utm_content=lt-4-generatory$o$, $n$https://martinbarna.cz/go/akademie-m/$n$),
  ($o$https://tvujcoach.cz/client/subscription?plan=basic&utm_source=email&utm_medium=drip&utm_campaign=tc-foods&utm_content=f2$o$, $n$https://martinbarna.cz/go/tc-predplatne-m/$n$),
  ($o$https://tvujcoach.cz/client/subscription?plan=basic&utm_source=email&utm_medium=drip&utm_campaign=tc-kosik&utm_content=k0$o$, $n$https://martinbarna.cz/go/tc-predplatne-m/$n$),
  ($o$https://tvujcoach.cz/client/subscription?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-free&utm_content=vf-1$o$, $n$https://martinbarna.cz/go/tc-vip-m/$n$),
  ($o$https://tvujcoach.cz/client/subscription?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-free&utm_content=vf-2$o$, $n$https://martinbarna.cz/go/tc-vip-m/$n$),
  ($o$https://tvujcoach.cz/client/subscription?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-free&utm_content=vf-3$o$, $n$https://martinbarna.cz/go/tc-vip-m/$n$),
  ($o$https://tvujcoach.cz/client/subscription?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-free&utm_content=vf-4$o$, $n$https://martinbarna.cz/go/tc-vip-m/$n$),
  ($o$https://martinbarna.cz/koucing/?utm_source=email&utm_medium=drip&utm_campaign=longtail-consumer&utm_content=lc-5-koucink$o$, $n$https://martinbarna.cz/go/koucing-m/$n$),
  ($o$https://tvujcoach.cz/client/subscription?plan=basic&utm_source=email&utm_medium=drip&utm_campaign=tc-free&utm_content=a6$o$, $n$https://martinbarna.cz/go/tc-predplatne-m/$n$),
  ($o$https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=longtail-consumer&utm_content=vip-499$o$, $n$https://martinbarna.cz/go/tc-koupit-m/$n$),
  ($o$https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=nurture-videokurz&utm_content=vip-499$o$, $n$https://martinbarna.cz/go/tc-koupit-m/$n$),
  ($o$https://martinbarna.cz/akademie/?utm_source=email&utm_medium=drip&utm_campaign=academy-mesicni&utm_content=blast-omluva$o$, $n$https://martinbarna.cz/go/akademie-m/$n$),
  ($o$https://tvujcoach.cz/?plan=basic&utm_source=email&utm_medium=drip&utm_campaign=longtail-consumer&utm_content=basic-249$o$, $n$https://martinbarna.cz/go/tc-basic-m/$n$),
  ($o$https://tvujcoach.cz/?plan=basic&utm_source=email&utm_medium=drip&utm_campaign=nurture-videokurz&utm_content=basic-249$o$, $n$https://martinbarna.cz/go/tc-basic-m/$n$),
  ($o$https://martinbarna.cz/akademie/objednavka/?utm_source=email&utm_medium=drip&utm_campaign=trener-kit&utm_content=step3$o$, $n$https://martinbarna.cz/go/objednavka-m/$n$),
  ($o$https://martinbarna.cz/akademie/objednavka/?utm_source=email&utm_medium=drip&utm_campaign=trener-kit&utm_content=step4$o$, $n$https://martinbarna.cz/go/objednavka-m/$n$),
  ($o$https://tvujcoach.cz/?utm_source=email&utm_medium=drip&utm_campaign=kviz-vikend-nabidka&utm_content=kviz-1&plan=basic$o$, $n$https://martinbarna.cz/go/tc-basic-m/$n$),
  ($o$https://tvujcoach.cz/?utm_source=email&utm_medium=drip&utm_campaign=kviz-pohyb-nabidka&utm_content=kviz-1&plan=basic$o$, $n$https://martinbarna.cz/go/tc-basic-m/$n$),
  ($o$https://tvujcoach.cz/?utm_source=email&utm_medium=drip&utm_campaign=kviz-vecer-nabidka&utm_content=kviz-1&plan=basic$o$, $n$https://martinbarna.cz/go/tc-basic-m/$n$),
  ($o$https://tvujcoach.cz/?plan=basic&utm_source=email&utm_medium=drip&utm_campaign=longtail-kupci&utm_content=lk-2-appka$o$, $n$https://martinbarna.cz/go/tc-basic-m/$n$),
  ($o$https://tvujcoach.cz/?utm_source=email&utm_medium=drip&utm_campaign=kviz-data-nabidka&utm_content=kviz-1&plan=basic$o$, $n$https://martinbarna.cz/go/tc-basic-m/$n$),
  ($o$https://martinbarna.cz/akademie/?utm_source=email&utm_medium=drip&utm_campaign=academy-mesicni&utm_content=blast-0$o$, $n$https://martinbarna.cz/go/akademie-m/$n$),
  ($o$https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=lead-magnet&utm_content=vip-499$o$, $n$https://martinbarna.cz/go/tc-koupit-m/$n$),
  ($o$https://martinbarna.cz/recepty-a-odpovedi/?utm_source=email&utm_medium=drip&utm_campaign=balicek&utm_content=nv-9$o$, $n$https://martinbarna.cz/go/recepty-m/$n$),
  ($o$https://tvujcoach.cz/?plan=basic&utm_source=email&utm_medium=drip&utm_campaign=lead-magnet&utm_content=basic-249$o$, $n$https://martinbarna.cz/go/tc-basic-m/$n$),
  ($o$https://tvujcoach.cz/client/checkin?utm_source=email&utm_medium=drip&utm_campaign=tc-free&utm_content=a4-checkin$o$, $n$https://martinbarna.cz/go/tc-checkin-m/$n$),
  ($o$https://tvujcoach.cz/?utm_source=email&utm_medium=drip&utm_campaign=longtail-trener&utm_content=lt-4-generatory$o$, $n$https://martinbarna.cz/go/tc-m/$n$),
  ($o$https://tvujcoach.cz/?plan=basic&utm_source=email&utm_medium=drip&utm_campaign=tc-start&utm_content=s2-basic249$o$, $n$https://martinbarna.cz/go/tc-basic-m/$n$),
  ($o$https://martinbarna.cz/kalkulacka-kalorii-a-makrozivin/?utm_source=email&utm_medium=drip&utm_campaign=evergreen$o$, $n$https://martinbarna.cz/go/kalkulacka-m/$n$),
  ($o$https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=tc-start&utm_content=vip-499$o$, $n$https://martinbarna.cz/go/tc-koupit-m/$n$),
  ($o$https://martinbarna.cz/clanky/vikendove-prejidani.html?utm_source=email&utm_medium=drip&utm_campaign=evergreen$o$, $n$https://martinbarna.cz/go/vikend-m/$n$),
  ($o$https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-kupci&utm_content=vk-1$o$, $n$https://martinbarna.cz/go/tc-koupit-m/$n$),
  ($o$https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-kupci&utm_content=vk-2$o$, $n$https://martinbarna.cz/go/tc-koupit-m/$n$),
  ($o$https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-kupci&utm_content=vk-3$o$, $n$https://martinbarna.cz/go/tc-koupit-m/$n$),
  ($o$https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-kupci&utm_content=vk-4$o$, $n$https://martinbarna.cz/go/tc-koupit-m/$n$),
  ($o$https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-leady&utm_content=vl-1$o$, $n$https://martinbarna.cz/go/tc-koupit-m/$n$),
  ($o$https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-leady&utm_content=vl-2$o$, $n$https://martinbarna.cz/go/tc-koupit-m/$n$),
  ($o$https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-leady&utm_content=vl-3$o$, $n$https://martinbarna.cz/go/tc-koupit-m/$n$),
  ($o$https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-leady&utm_content=vl-4$o$, $n$https://martinbarna.cz/go/tc-koupit-m/$n$),
  ($o$https://tvujcoach.cz/koupit?plan=vip&utm_source=email&utm_medium=drip&utm_campaign=vip-leady&utm_content=vl-5$o$, $n$https://martinbarna.cz/go/tc-koupit-m/$n$),
  ($o$https://tvujcoach.cz/sign-up?plan=free&utm_source=email&utm_medium=drip&utm_campaign=tc-start&utm_content=s0$o$, $n$https://martinbarna.cz/go/tc-free-m/$n$),
  ($o$https://martinbarna.cz/clanky/spanek-a-hubnuti.html?utm_source=email&utm_medium=drip&utm_campaign=evergreen$o$, $n$https://martinbarna.cz/go/spanek-m/$n$),
  ($o$https://martinbarna.cz/akademie/studium/?utm_source=email&utm_medium=drip&utm_campaign=onboarding-academy$o$, $n$https://martinbarna.cz/go/studium-m/$n$),
  ($o$https://martinbarna.cz/koucing/?utm_source=email&utm_medium=drip&utm_campaign=konzultace-zaloha#balicky$o$, $n$https://martinbarna.cz/go/koucing-balicky-m/$n$),
  ($o$https://tvujcoach.cz/?plan=basic&utm_source=email&utm_medium=drip&utm_campaign=tc-magnet&utm_content=b4$o$, $n$https://martinbarna.cz/go/tc-basic-m/$n$),
  ($o$https://martinbarna.cz/akademie/moje/doporuc/?utm_source=email&utm_medium=drip&utm_campaign=onboarding$o$, $n$https://martinbarna.cz/go/doporuc-m/$n$),
  ($o$https://martinbarna.cz/akademie/?utm_source=email&utm_medium=email&utm_campaign=longtail-trener-final$o$, $n$https://martinbarna.cz/go/akademie-m/$n$),
  ($o$https://tvujcoach.cz/client/chat?utm_source=email&utm_medium=drip&utm_campaign=tc-free&utm_content=a4$o$, $n$https://martinbarna.cz/go/tc-chat-m/$n$),
  ($o$https://tvujcoach.cz/client/log?utm_source=email&utm_medium=drip&utm_campaign=tc-free&utm_content=a2$o$, $n$https://martinbarna.cz/go/tc-log-m/$n$),
  ($o$https://martinbarna.cz/clanky/bilkoviny.html?utm_source=email&utm_medium=drip&utm_campaign=evergreen$o$, $n$https://martinbarna.cz/go/bilkoviny-m/$n$),
  ($o$https://martinbarna.cz/recepty-a-odpovedi/?utm_source=email&utm_medium=drip&utm_campaign=lt-balicek$o$, $n$https://martinbarna.cz/go/recepty-m/$n$),
  ($o$https://martinbarna.cz/akademie/videokurz/?utm_source=email&utm_medium=milestone&utm_campaign=vk-30$o$, $n$https://martinbarna.cz/go/akademie-kurz-m/$n$),
  ($o$https://martinbarna.cz/akademie/videokurz/?utm_source=email&utm_medium=drip&utm_campaign=onboarding$o$, $n$https://martinbarna.cz/go/akademie-kurz-m/$n$),
  ($o$https://tvujcoach.cz/start?utm_source=email&utm_medium=drip&utm_campaign=tc-magnet&utm_content=b2$o$, $n$https://martinbarna.cz/go/tc-start-m/$n$),
  ($o$https://tvujcoach.cz/client?utm_source=email&utm_medium=drip&utm_campaign=tc-free&utm_content=a3$o$, $n$https://martinbarna.cz/go/tc-ucet-m/$n$),
  ($o$https://tvujcoach.cz/client?utm_source=email&utm_medium=drip&utm_campaign=tc-free&utm_content=a5$o$, $n$https://martinbarna.cz/go/tc-ucet-m/$n$),
  ($o$https://martinbarna.cz/recepty-a-odpovedi/?utm_source=email&utm_medium=drip&utm_campaign=lc5-ps$o$, $n$https://martinbarna.cz/go/recepty-m/$n$),
  ($o$https://tvujcoach.cz/?utm_source=email&utm_medium=drip&utm_campaign=tydenik-2-appka&plan=basic$o$, $n$https://martinbarna.cz/go/tc-basic-m/$n$),
  ($o$https://martinbarna.cz/tvuj-coach/?utm_source=email&utm_medium=tydenik&utm_campaign=tydenik-03$o$, $n$https://martinbarna.cz/go/appka-web-m/$n$),
  ($o$https://martinbarna.cz/poukaz/?utm_source=email&utm_medium=blast&utm_campaign=poukazy-2026-08$o$, $n$https://martinbarna.cz/go/poukaz-m/$n$),
  ($o$https://tvujcoach.cz/?utm_source=email&utm_medium=drip&utm_campaign=tc-blok1&utm_content=lm-0$o$, $n$https://martinbarna.cz/go/tc-m/$n$),
  ($o$https://tvujcoach.cz/?utm_source=email&utm_medium=drip&utm_campaign=tc-blok1&utm_content=tk-0$o$, $n$https://martinbarna.cz/go/tc-m/$n$),
  ($o$https://tvujcoach.cz/?plan=basic&utm_source=email&utm_medium=drip&utm_campaign=tc-kviz-blast$o$, $n$https://martinbarna.cz/go/tc-basic-m/$n$),
  ($o$https://martinbarna.cz/akademie/?utm_source=email&utm_medium=tydenik&utm_campaign=tydenik-02$o$, $n$https://martinbarna.cz/go/akademie-m/$n$),
  ($o$https://tvujcoach.cz/?utm_source=email&utm_medium=drip&utm_campaign=tc-start&utm_content=s1$o$, $n$https://martinbarna.cz/go/tc-m/$n$),
  ($o$https://martinbarna.cz/videokurz?utm_source=email&utm_medium=drip&utm_campaign=tool-follow$o$, $n$https://martinbarna.cz/go/kurz-m/$n$),
  ($o$https://martinbarna.cz/akademie/?utm_source=email&utm_medium=drip&utm_campaign=tool-follow$o$, $n$https://martinbarna.cz/go/akademie-m/$n$),
  ($o$https://martinbarna.cz/videokurz?utm_source=email&utm_medium=drip&utm_campaign=tool-bridge$o$, $n$https://martinbarna.cz/go/kurz-m/$n$),
  ($o$https://tvujcoach.cz/?plan=basic&utm_source=email&utm_medium=milestone&utm_campaign=vk-30$o$, $n$https://martinbarna.cz/go/tc-basic-m/$n$),
  ($o$https://martinbarna.cz/videokurz?utm_source=email&utm_medium=drip&utm_campaign=evergreen$o$, $n$https://martinbarna.cz/go/kurz-m/$n$),
  ($o$https://martinbarna.cz/koucing/?utm_source=email&utm_medium=drip&utm_campaign=evergreen$o$, $n$https://martinbarna.cz/go/koucing-m/$n$),
  ($o$https://martinbarna.cz/videokurz?utm_source=email&utm_medium=drip&utm_campaign=nurture$o$, $n$https://martinbarna.cz/go/kurz-m/$n$),
  ($o$https://martinbarna.cz/kviz/?utm_source=email&utm_medium=drip&utm_campaign=evergreen$o$, $n$https://martinbarna.cz/go/kviz-m/$n$),
  ($o$https://form.simpleshop.cz/Xgl8g/buy/?utm_source=email&utm_medium=rescue$o$, $n$https://form.simpleshop.cz/Xgl8g/buy/$n$),
  ($o$https://form.simpleshop.cz/3Vbl/buy/?utm_source=email&utm_medium=rescue$o$, $n$https://form.simpleshop.cz/3Vbl/buy/$n$);

do $mig$
declare
  r record;
  amp text;
  n int;
begin
  for r in select stary, novy from mb_kratke_pary order by length(stary) desc loop
    amp := replace(r.stary, '&', '&amp;');
    update public.email_templates
       set blocks = replace(replace(blocks::text, r.stary, r.novy), amp, r.novy)::jsonb,
           subject = replace(replace(coalesce(subject, ''), r.stary, r.novy), amp, r.novy),
           preheader = replace(replace(coalesce(preheader, ''), r.stary, r.novy), amp, r.novy),
           updated_at = now()
     where blocks::text like '%' || r.stary || '%'
        or blocks::text like '%' || amp || '%'
        or coalesce(subject, '') like '%' || r.stary || '%'
        or coalesce(preheader, '') like '%' || r.stary || '%';
    get diagnostics n = row_count;
    raise notice 'par % radku: %', n, r.novy;
  end loop;
end
$mig$;

-- Pojistka pro odkaz, který ve výpisu repa nebyl. Sundá zbylé kampanové parametry
-- a funkční (plan, promo, email, locale, kotvu) nechá. Když parametr zůstane,
-- transakce se vrátí celá.

create function pg_temp.mb_sundej_kampan(vstup text) returns text
language plpgsql as $fn$
declare
  t text := vstup;
  nova text;
  kolo int := 0;
  znacka text := 'u' || 'tm_';
begin
  if t is null or t = '' then
    return t;
  end if;
  loop
    kolo := kolo + 1;
    if kolo > 12 then
      raise exception 'kampanovy parametr nesel sundat';
    end if;
    nova := regexp_replace(t, '&amp;' || znacka || '[A-Za-z0-9_]+=[^&#''"<>[:space:]]*', '', 'gi');
    nova := regexp_replace(nova, '&' || znacka || '[A-Za-z0-9_]+=[^&#''"<>[:space:]]*', '', 'gi');
    nova := regexp_replace(nova, '\?' || znacka || '[A-Za-z0-9_]+=[^&#''"<>[:space:]]*', '?', 'gi');
    nova := replace(nova, '?&amp;', '?');
    nova := replace(nova, '?&', '?');
    nova := regexp_replace(nova, $re$\?(["']|$)$re$, $re$\1$re$, 'g');
    exit when nova = t;
    t := nova;
  end loop;
  return t;
end
$fn$;

do $zamet$
declare
  r record;
  b text;
  s text;
  p text;
begin
  for r in
    select id, blocks::text as b, subject, preheader
    from public.email_templates
    where blocks::text ~ ('u' || 'tm_')
       or coalesce(subject, '') ~ ('u' || 'tm_')
       or coalesce(preheader, '') ~ ('u' || 'tm_')
  loop
    b := pg_temp.mb_sundej_kampan(r.b);
    s := pg_temp.mb_sundej_kampan(r.subject);
    p := pg_temp.mb_sundej_kampan(r.preheader);
    update public.email_templates
       set blocks = b::jsonb,
           subject = s,
           preheader = p,
           updated_at = now()
     where id = r.id;
  end loop;

  if exists (
    select 1 from public.email_templates
    where blocks::text ~ ('u' || 'tm_')
       or coalesce(subject, '') ~ ('u' || 'tm_')
       or coalesce(preheader, '') ~ ('u' || 'tm_')
  ) then
    raise exception 'po nahrade v email_templates kampanovy parametr zustal';
  end if;
end
$zamet$;

commit;
