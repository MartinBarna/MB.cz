-- ============================================================================
-- BRÁNA ODHLAŠOVÁNÍ: DRUHÁ POLOVINA, `customer_contacts`
-- 6. 9. 2026 pozdě večer, 54. šéf chat
-- ============================================================================
--
-- CO SE OPRAVUJE
-- Brána z 6. 9. odpoledne hlídá `leads` a `customer_contacts` TRIGGEREM, ale úklid
-- po odhlášení dělá jen na `leads`. Funkce `odhlaseni_trvale_uklid()` projde leady
-- a zmrazí je; `customer_contacts` nechá být.
--
-- ⛔ PROČ TO VADÍ. Když se člověk odhlásí:
--   1. `odhlas_a_odstran` ho zapíše na `odhlaseni_trvale` a zmrazí jeho lead,
--   2. jeho řádek v `customer_contacts` ale zůstane `status = 'active'`.
-- A `videokurz-onboarding` vybírá přesně takhle:
--   select email,name,tags,unsubscribe_token from customer_contacts
--    where status = 'active' and onboarding_sent_at is null
-- Odhlášený člověk tím pádem uvítací mail DOSTANE. Teprve razítko `last_emailed_at`
-- po odeslání spustí trigger `customer_contacts_respektuj_odhlaseni`, který řádek
-- zmrazí. Únik je tedy „jen" jeden mail na člověka, ale je to mail poslaný někomu,
-- kdo si ho výslovně zakázal, a to je právní i reputační problém, ne kosmetika.
--
-- ⚠️ DNES TO NIKOHO NEPOTKALO, ověřeno dotazem: všech 13 lidí, kteří jsou zároveň
--    na `odhlaseni_trvale` i v `customer_contacts`, má status 'unsubscribed'.
--    Není to ale vlastnost brány, jen shoda: ti lidé se odhlásili dřív, než brána
--    vznikla, jinou cestou. Další odhlášený už by dírou prošel.
--
-- ⭐ PROČ SE TO ŘEŠÍ TADY A NE V ODESÍLACÍCH FUNKCÍCH
-- `customer_contacts` čte šest funkcí (`admin-api`, `ai-martin/cap-notify`,
-- `client-remind`, `daily-digest`, `videokurz-onboarding`, `_shared/koucink-onboarding`).
-- Dopsat podmínku do každé znamená šest deployů a sedmou funkci, která na to zapomene.
-- Poučení z 6. 9.: „pojistka do tří funkcí není pojistka, když s tabulkou pracuje třináct."
-- Všechny čtou `status`, takže stačí, aby stav v tabulce byl pravdivý.
--
-- ⛔ NEMAŽE SE NIC. Řádek v `customer_contacts` zůstává, jen se mrazí. Stejné rozhodnutí
--    jako u `leads` z 6. 9. odpoledne: mazání se ten den zkoušelo a rozbilo tři věci.
--
-- SIGNATURA se nemění (trigger funkce bez argumentů, oid 31814), takže
-- `create or replace` je opravdu náhrada a ne druhá funkce vedle. Ověřeno v `pg_proc`
-- před i po (viz kontrolní dotaz na konci souboru).
-- ============================================================================

begin;

create or replace function public.odhlaseni_trvale_uklid()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_id uuid;
begin
  -- 1) LEADY: beze změny proti verzi z 6. 9. odpoledne.
  for v_id in select id from public.leads
               where lower(email) = lower(new.email) and status is distinct from 'unsubscribed' loop
    perform public.odhlas_a_odstran(v_id, coalesce(new.zdroj, 'odhlaseni_trvale'));
  end loop;

  -- 2) ZÁKAZNICKÉ KONTAKTY: nová část. Bez ní odhlášený člověk s řádkem
  --    v `customer_contacts` dostane ještě jeden mail (viz hlavička souboru).
  -- ⚠️ `status` se nastavuje výslovně na 'unsubscribed', ne na něco jiného:
  --    trigger `customer_contacts_respektuj_odhlaseni` by jinou hodnotu stejně přepsal,
  --    ale zapsal by přitom řádek do `odhlaseni_blokovano`, tedy hlášku o zablokovaném
  --    pokusu. Tohle žádný pokus není, je to úklid, a v logu blokovaných nemá co dělat.
  update public.customer_contacts
     set status = 'unsubscribed',
         unsubscribed_at = coalesce(unsubscribed_at, now()),
         updated_at = now()
   where lower(email) = lower(new.email)
     and status is distinct from 'unsubscribed';

  return new;
end;
$function$;

commit;

-- ============================================================================
-- KONTROLA PO MIGRACI (spustit ručně, výsledek patří do hlášení)
-- ============================================================================
-- a) Existuje funkce pořád jen JEDNA a trigger ukazuje na ni?
--    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid)
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public' and p.proname = 'odhlaseni_trvale_uklid';
--    -- musí vrátit právě jeden řádek, oid 31814, prázdné argumenty
--
--    select tgname, tgfoid::regproc from pg_trigger
--     where tgrelid = 'public.odhlaseni_trvale'::regclass and not tgisinternal;
--    -- odhlaseni_trvale_uklid -> odhlaseni_trvale_uklid
--
-- b) Zůstal někdo aktivní v `customer_contacts`, přestože je odhlášený?
--    select count(*) from public.odhlaseni_trvale o
--      join public.customer_contacts c on lower(c.email) = lower(o.email)
--     where c.status is distinct from 'unsubscribed';
--    -- musí být 0
--
-- c) ⛔ TRANSAKČNÍ MAILY TÍMHLE NEJSOU DOTČENÉ a nesmí být: doklad o zaplacení,
--    přihlašovací odkaz, dárkový poukaz a GDPR výmaz chodí i odhlášenému člověku.
--    Ty funkce nečtou `customer_contacts.status`, adresu berou z platby nebo z tokenu.
-- ============================================================================
