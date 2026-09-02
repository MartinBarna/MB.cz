-- ============================================================================
-- ODEČET MĚSÍČNÍHO ČLENSTVÍ ACADEMY: doživotní přístup za 5 930 Kč
-- Připraveno 2. 9. 2026. ⛔ TENHLE SOUBOR NEBYL SPUŠTĚN. Aplikuje ho šéf.
-- ============================================================================
-- CO TO DĚLÁ
--   Kdo platí Academy měsíčně (990 Kč), dostane v 75. dni od uvítacího mailu
--   nabídku přejít na doživotní přístup za 5 930 Kč místo 8 900 Kč.
--   3 × 990 + 5 930 = 8 900, tedy přesně cena doživotního. Odečet je finančně
--   neutrální, žádný ušlý zisk.
--
-- ⛔ POŘADÍ NASAZENÍ (nedodržet ho znamená vzít peníze a nedodat zboží):
--   1) TENHLE SOUBOR (šablona mailu, guard, cron).
--   2) TEPRVE PAK edge funkce `academy-stripe-webhook` s namapovaným odkazem
--      `plink_1UBA1iBq3rKubW9kAcC0eIlq=academy-lifetime`.
--   ⚠️ Krok 1 trati se pošle nejdřív za 75 dní od PRVNÍHO měsíčního nákupu, takže
--      mezi 1) a 2) je dlouhá rezerva. I tak se webhook nasazuje týž den: kdyby
--      odkaz někdo dostal dřív, větev „neznámý odkaz" tiše vrátí 200 a zaplacený
--      člověk by nedostal nic.
--   3) AŽ NAKONEC web (`akademie/index.html`, FAQ). Slib na webu bez funkčního
--      odkazu znamená, že lidi píší a nikdo neví proč.
--
-- PROČ 75 DNÍ A NE 60
--   Platby padají ve dnech 0, 30, 60. Den 75 leží za třetí platbou i za jejími
--   Smart Retries, takže v okamžiku odeslání je 2 970 Kč skutečně zaplaceno.
--   ⚠️ Je to odhad, ne měření. Počet zaplacených měsíců v DB není: `udelPristup`
--   při každé faktuře přepisuje `granted_at` na now(). Jediný zdroj pravdy je Stripe.
--
-- KOHO TO DNES ZASÁHNE: nikoho. Na trati je jediný lead (Martinův test) s dojetou
--   tratí (`next_send_at = null`), a `drip-send` bere jen leady s neprázdným
--   `next_send_at`. Kontrola v části 5 to má ověřit číslem, ne vírou.
-- ============================================================================

begin;

-- ═══ 1) ZÁLOHA (běží PRVNÍ, jinak není kam se vrátit) ══════════════════════
create table public.zaloha_email_templates_20260902_acmes as
select * from public.email_templates
where track = 'onboarding-nakup-academy-mesicni';

-- Záloha je provozní data, nepatří nikomu zvenčí. RLS zapnutá BEZ jediné policy
-- znamená, že přes PostgREST nikdo nepřečte nic; service_role RLS obchází.
-- ⛔ `revoke from public` je nosný řádek: grant běžně visí na roli `public` a
--    revoke jen od `anon` je mrtvá páka (incident 27. 8. u `tydenik_rozeslani`).
alter table public.zaloha_email_templates_20260902_acmes enable row level security;
revoke all on table public.zaloha_email_templates_20260902_acmes from public;
revoke all on table public.zaloha_email_templates_20260902_acmes from anon;
revoke all on table public.zaloha_email_templates_20260902_acmes from authenticated;

-- ═══ 2) GUARD: krok 1 nesmí existovat dvakrát ══════════════════════════════
-- Kdyby soubor někdo pustil podruhé, `insert` níž by spadl na primárním klíči
-- nebo (kdyby PK nebyl) založil druhou šablonu téhož kroku. Radši hlasitě tady.
do $guard$
begin
  if exists (
    select 1 from public.email_templates
    where track = 'onboarding-nakup-academy-mesicni' and step = 1
  ) then
    raise exception 'Krok 1 trati onboarding-nakup-academy-mesicni uz existuje. Nic se nemeni, zkontroluj rucne.';
  end if;
end
$guard$;

-- ═══ 3) KROK 0 UŽ NENÍ POSLEDNÍ ════════════════════════════════════════════
-- `wait_days = null` znamená v `drip-send` „poslední mail trati". Dokud tam
-- null zůstane, krok 1 se nikdy nenaplánuje. Po změně nastaví `drip-send`
-- odesílateli kroku 0 `next_send_at = now + 75 dní`.
update public.email_templates
set wait_days = 75, updated_at = now()
where track = 'onboarding-nakup-academy-mesicni' and step = 0;

-- ═══ 4) NOVÝ KROK 1: nabídka odečtu ════════════════════════════════════════
-- ⛔ Odkaz je OSTRÝ platební odkaz na 5 930 Kč (`plink_1UBA1iBq3rKubW9kAcC0eIlq`).
--    `?locale=cs` je jediný parametr schválně: Stripe UTM parametry nepředává dál,
--    takže by v adrese jen dělaly nepořádek. Atribuci nese `client_reference_id`.
-- ⚠️ Cena 5 930 je v šabloně natvrdo. Kdo mění ceník Academy, MUSÍ projít i tuhle
--    šablonu a FAQ na /akademie/ (viz tvujcoach-cenik-zmena-checklist).
insert into public.email_templates (track, step, key, subject, preheader, blocks, wait_days, updated_at)
values (
  'onboarding-nakup-academy-mesicni', 1, 'onb-ac-mes-1-odecet',
  'Tři měsíce máš zaplacené. Odečtu ti je',
  'Doživotní přístup ti vyjde na 5 930 Kč místo 8 900 Kč.',
  $json$[
  { "t": "p", "html": "Ahoj{{fn_space}}," },
  { "t": "p", "html": "Academy ti běží třetí měsíc. Za tu dobu jsi zaplatil <strong>2 970 Kč</strong> a přijde mi férové ti je započítat." },
  { "t": "p", "html": "Když teď přejdeš na doživotní přístup, ty tři měsíce ti z ceny odečtu. Místo 8 900 Kč zaplatíš <strong>5 930 Kč</strong>, jednou a naposled. Měsíční platby ti zruším sám ve chvíli, kdy platba projde, nemusíš nic hlídat ani nikam klikat." },
  { "t": "p", "html": "Co se ti tím změní:" },
  { "t": "bullets", "items": [
    "<strong>Zaplatíš jednou a Academy máš napořád</strong>, včetně všeho, co do ní ještě přibude",
    "<strong>Rok appky Tvůj Coach ve VIP verzi</strong> (hodnota 4 990 Kč) místo dneška, kdy ti běží jen po dobu členství",
    "Studium, kvízy i postup zůstávají přesně tam, kde je máš teď"
  ] },
  { "t": "p", "html": "Jestli ti měsíční platba vyhovuje, klidně to nech být. Členství běží dál a odečet ti nikam neuteče, ozvi se třeba za půl roku." },
  { "t": "btn", "href": "https://buy.stripe.com/fZu5kCgHJaZs97q7dB3ks0k?locale=cs", "text": "Vzít doživotní přístup za 5 930 Kč" },
  { "t": "p", "html": "<strong>Be Effective!</strong><br>Martin" },
  { "t": "ps", "html": "P.S. Nejsi si jistý, jestli se ti to vyplatí? Napiš mi jednou větou, kolik toho reálně stíháš, a řeknu ti narovinu." }
]$json$::jsonb,
  null, now()
);

commit;

-- ============================================================================
-- 5) KONTROLY PO ZÁSAHU (spustit ručně, mimo transakci)
-- ============================================================================
-- select count(*) from public.zaloha_email_templates_20260902_acmes;
--   Očekávám 1 řádek (jediný dnešní krok 0 trati).
--
-- select step, key, subject, wait_days
-- from public.email_templates
-- where track = 'onboarding-nakup-academy-mesicni' order by step;
--   Očekávám: step 0 wait_days 75, step 1 wait_days null.
--
-- select count(*) as leadu_ktere_to_zasahne
-- from public.leads
-- where track = 'onboarding-nakup-academy-mesicni' and next_send_at is not null;
--   Očekávám 0.
--
-- select 'https://buy.stripe.com/fZu5kCgHJaZs97q7dB3ks0k?locale=cs' as odkaz;
--   ⛔ Ověřit KLIKNUTÍM z doručeného testovacího mailu, ne fetchem: Stripe checkout
--      se holým `fetch` ověřit nedá. Musí ukázat 5 930 Kč a název
--      „Barna Academy doživotní přístup", ne „Měsíční členství".

-- ============================================================================
-- NÁVRAT, kdyby se to pokazilo
-- ============================================================================
-- begin;
-- delete from public.email_templates
--   where track = 'onboarding-nakup-academy-mesicni' and step = 1;
-- update public.email_templates t
--   set wait_days = z.wait_days, updated_at = now()
--   from public.zaloha_email_templates_20260902_acmes z
--   where t.track = z.track and t.step = z.step;
-- commit;

-- ============================================================================
-- 6) POJISTKA: mail nesmí dojít tomu, kdo mezitím zrušil
-- ============================================================================
-- ⛔ PROČ TO MUSÍ BÝT: `shouldStop` v `drip-send/pravidla.ts` členské trati NIKDY
--    nezastavuje, a je to schválně (krok 0 členské trati je doručení zaplaceného
--    zboží). Bez téhle funkce dostane za 75 dní mail „zaplatil jsi 2 970 Kč"
--    i člověk, který zaplatil jediný měsíc a zrušil. To je lež.
--
-- ⛔ `step >= 1` je NOSNÁ PODMÍNKA, nesmazat. Bez ní by funkce mohla zhasnout
--    i leada, který ještě čeká na uvítací mail (krok 0), tedy na doručení
--    zaplaceného zboží. Lead čekající na krok 1 má po odeslání kroku 0 `step = 1`
--    (drip-send/index.ts nastavuje `step = ns` = číslo PŘÍŠTÍHO kroku).
--
-- ⚠️ Trvalé řešení je řádek v `shouldStop`, který zastavuje na „NEMÁ aktivní
--    měsíční členství". ⛔ Nikdy ne na `owns.academy`: majitel Academy je přesně
--    cílová skupina a opačná podmínka by mail zabila úplně. Ta úprava `drip-send`
--    tady záměrně NENÍ, tohle je pojistka, která funguje bez deploye.
create or replace function public.academy_mesicni_odecet_guard()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_zhasnuto integer;
begin
  update public.leads l
  set next_send_at = null, updated_at = now()
  where l.track = 'onboarding-nakup-academy-mesicni'
    and l.next_send_at is not null
    and l.step >= 1
    and not exists (
      select 1 from public.entitlements e
      where lower(e.email) = lower(l.email)
        and e.product = 'academy'
        and e.active
        and e.source = 'stripe-monthly'
        and e.expires_at > now()
    );

  get diagnostics v_zhasnuto = row_count;
  return v_zhasnuto;
end
$function$;

revoke all on function public.academy_mesicni_odecet_guard() from public;
revoke all on function public.academy_mesicni_odecet_guard() from anon;
revoke all on function public.academy_mesicni_odecet_guard() from authenticated;

-- Denně v 5:20 UTC. Slot je volný a leží PŘED nejbližším během `drip-send`
-- (ten jede v celou hodinu), takže zhasnutí stihne předběhnout odeslání.
-- ⚠️ Kdyby job téhož jména už existoval, `cron.schedule` ho přepíše, ne zdvojí.
select cron.schedule(
  'academy-odecet-guard',
  '20 5 * * *',
  'select public.academy_mesicni_odecet_guard()'
);

-- Kontrola: select jobname, schedule, command from cron.job where jobname = 'academy-odecet-guard';
-- Odpojení: select cron.unschedule('academy-odecet-guard');
