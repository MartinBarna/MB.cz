-- NESPUSŤENO. Martin 29. 10. 2026: viditelný odkaz v mailu nesmí nést kampanové parametry.
-- Soubor se nespouští z repa ani z agenta. Až po schválení, ručně, v projektu Academy.
-- Záloha jen dotčených řádků. Když tabulka zálohy už existuje, skript skončí a nic nepřepíše.
-- Platební odkazy buy.stripe.com a form.simpleshop.cz zůstanou, jen bez kampanových parametrů.
-- Odkaz s e-mailem v query (přihlášení do appky) zůstane, jen bez kampanových parametrů.
-- Závislost: zkratky /go/ musí být na webu dřív, než tenhle UPDATE odjede v ostrém mailu.
-- Pořadí: merge PR #628, potom tenhle PR, nasazení webu, potom edge funkce
-- drip-send, mail-klik, offboard-mail a en-mailing, a teprve potom tenhle SQL.
-- Nasazení webu ty funkce nenasadí. Spouští se zvlášť, ručně, až po webu a před tímhle souborem.
-- Šablony lk-3-koucink (longtail-kupci, krok 5) a upsell-coaching kroky 2 a 4
-- se nepřepisují. Text opravil hotfix PR #637 a tenhle soubor ho nesmí vrátit.

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
           subject = case when subject is null then null
                          else replace(replace(subject, r.stary, r.novy), amp, r.novy) end,
           preheader = case when preheader is null then null
                            else replace(replace(preheader, r.stary, r.novy), amp, r.novy) end,
           updated_at = now()
     where (blocks::text like '%' || r.stary || '%'
        or blocks::text like '%' || amp || '%'
        or coalesce(subject, '') like '%' || r.stary || '%'
        or coalesce(preheader, '') like '%' || r.stary || '%')
       -- preskoc_hotfix_637: text z PR #637 se nesmí vrátit
       and not (
         key in ('lk-3-koucink', 'upsell-co-1', 'upsell-co-2')
         or (track = 'longtail-kupci' and step = 5)
         or (track = 'upsell-coaching' and step in (2, 4))
       );
    get diagnostics n = row_count;
    raise notice 'par % radku: %', n, r.novy;
  end loop;
end
$mig$;

-- Pojistka pro odkaz, který ve výpisu repa nebyl. Kampanový parametr sundá jen
-- uvnitř URL (od https?:// po konec adresy). Ostatní parametry (plan, promo,
-- email, locale) a kotva zůstanou. Otazník nebo ampersand zmizí jen když po něm
-- v té URL nic nezbylo. Předmět a preheader mimo URL se nemění. Prázdný řetězec
-- zůstane prázdný, NULL zůstane NULL. Když parametr v URL zůstane, nebo se
-- předmět či preheader liší od zálohy, transakce se vrátí celá.

create function pg_temp.mb_vycisti_url(url text) returns text
language plpgsql as $url$
declare
  znacka text := 'u' || 'tm_';
  telo text;
  fragment text := '';
  zaklad text;
  dotaz text;
  hash_at int;
  q_at int;
  amp_html boolean;
  kousky text[];
  kus text;
  jmeno text;
  rovnitko int;
  nechane text[] := array[]::text[];
  spojka text;
begin
  if url is null or url = '' then
    return url;
  end if;
  hash_at := position('#' in url);
  if hash_at > 0 then
    fragment := substring(url from hash_at);
    telo := substring(url from 1 for hash_at - 1);
  else
    telo := url;
  end if;
  q_at := position('?' in telo);
  if q_at = 0 then
    return url;
  end if;
  dotaz := substring(telo from q_at + 1);
  if position(znacka in lower(dotaz)) = 0 then
    return url;
  end if;
  zaklad := substring(telo from 1 for q_at - 1);
  amp_html := position('&amp;' in dotaz) > 0;
  kousky := regexp_split_to_array(replace(dotaz, '&amp;', '&'), '&');
  foreach kus in array kousky loop
    if kus is null or kus = '' then
      continue;
    end if;
    rovnitko := position('=' in kus);
    if rovnitko = 0 then
      jmeno := kus;
    else
      jmeno := substring(kus from 1 for rovnitko - 1);
    end if;
    if jmeno ~* ('^' || znacka) then
      continue;
    end if;
    nechane := array_append(nechane, kus);
  end loop;
  if coalesce(array_length(nechane, 1), 0) = 0 then
    return zaklad || fragment;
  end if;
  spojka := case when amp_html then '&amp;' else '&' end;
  return zaklad || '?' || array_to_string(nechane, spojka) || fragment;
end
$url$;

create function pg_temp.mb_sundej_kampan(vstup text) returns text
language plpgsql as $fn$
declare
  zbytek text := vstup;
  vystup text := '';
  m text[];
  url text;
  cista text;
  kde int;
  kolo int := 0;
begin
  if vstup is null or vstup = '' then
    return vstup;
  end if;
  loop
    kolo := kolo + 1;
    if kolo > 4000 then
      raise exception 'prilis mnoho odkazu v jedne sablone';
    end if;
    -- Zpětné lomítko končí adresu: blocks::text ho dává před uvozovku v JSON.
    m := regexp_match(zbytek, $re$https?://[^[:space:]'"<>\\]+$re$, 'i');
    if m is null then
      return vystup || zbytek;
    end if;
    url := m[1];
    kde := position(url in zbytek);
    if kde = 0 then
      raise exception 'odkaz se v textu nenasel';
    end if;
    cista := pg_temp.mb_vycisti_url(url);
    vystup := vystup || substring(zbytek from 1 for kde - 1) || cista;
    zbytek := substring(zbytek from kde + length(url));
  end loop;
  return vystup;
end
$fn$;

do $zamet$
declare
  r record;
  b text;
  s text;
  p text;
  znacka text := 'u' || 'tm_';
  vzor text := 'https?://[^[:space:]''"<>]*\?[^[:space:]''"<>#]*' || znacka;
  kampani int;
  zmena int;
begin
  for r in
    select track, step, blocks::text as b, subject, preheader
    from public.email_templates
    where (
      blocks::text ~* znacka
      or coalesce(subject, '') ~* znacka
      or coalesce(preheader, '') ~* znacka
    )
    -- preskoc_hotfix_637: text z PR #637 se nesmí vrátit
    and not (
      key in ('lk-3-koucink', 'upsell-co-1', 'upsell-co-2')
      or (track = 'longtail-kupci' and step = 5)
      or (track = 'upsell-coaching' and step in (2, 4))
    )
  loop
    b := pg_temp.mb_sundej_kampan(r.b);
    s := pg_temp.mb_sundej_kampan(r.subject);
    p := pg_temp.mb_sundej_kampan(r.preheader);
    if b is not distinct from r.b
       and s is not distinct from r.subject
       and p is not distinct from r.preheader then
      continue;
    end if;
    update public.email_templates
       set blocks = b::jsonb,
           subject = s,
           preheader = p,
           updated_at = now()
     where track = r.track and step = r.step;
  end loop;

  select count(*) into kampani
  from public.email_templates
  where blocks::text ~* vzor
     or coalesce(subject, '') ~* vzor
     or coalesce(preheader, '') ~* vzor;
  if kampani <> 0 then
    raise exception 'po nahrade zustal kampanovy parametr v URL, radku %', kampani;
  end if;

  select count(*) into zmena
  from public.email_templates t
  join public.email_templates_zaloha_kratke_odkazy_20261029 z
    on z.track = t.track and z.step = t.step
  where t.subject is distinct from z.subject
     or t.preheader is distinct from z.preheader;
  if zmena <> 0 then
    raise exception 'subject nebo preheader se lisil od zalohy, radku %', zmena;
  end if;
end
$zamet$;

-- Ověření. Obě čísla musí být 0. Když nejsou, blok výš transakci vrátí dřív, než sem dojde.
select count(*) as sablon_s_kampani_v_url
from public.email_templates
where blocks::text ~* ('https?://[^[:space:]''"<>]*\?[^[:space:]''"<>#]*' || 'u' || 'tm_')
   or coalesce(subject, '') ~* ('https?://[^[:space:]''"<>]*\?[^[:space:]''"<>#]*' || 'u' || 'tm_')
   or coalesce(preheader, '') ~* ('https?://[^[:space:]''"<>]*\?[^[:space:]''"<>#]*' || 'u' || 'tm_');

select count(*) as zmeneny_subject_nebo_preheader
from public.email_templates t
join public.email_templates_zaloha_kratke_odkazy_20261029 z
  on z.track = t.track and z.step = t.step
where t.subject is distinct from z.subject
   or t.preheader is distinct from z.preheader;

commit;

-- Návrat ze zálohy. Nespouštět spolu s migrací výš. Samostatně, jen když se má
-- vrátit stav uložený na začátku. Klíč je track, step (tabulka sloupec id nemá).
-- begin;
-- update public.email_templates t
--    set key = z.key,
--        subject = z.subject,
--        preheader = z.preheader,
--        blocks = z.blocks,
--        wait_days = z.wait_days,
--        updated_at = z.updated_at
--   from public.email_templates_zaloha_kratke_odkazy_20261029 z
--  where t.track = z.track
--    and t.step = z.step;
-- commit;
