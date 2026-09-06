-- ============================================================================
-- BRÁNA ODHLAŠOVÁNÍ: VÝJIMKA PRO DORUČENÍ ZAPLACENÉHO ZBOŽÍ
-- 6. 9. 2026 pozdě večer, 54. šéf chat
-- ============================================================================
--
-- CO SE OPRAVUJE
-- Brána z 6. 9. odpoledne mrazí každý UPDATE `leads` u člověka na `odhlaseni_trvale`.
-- Mrazí i ten UPDATE, kterým se po NÁKUPU zakládá doručení zaplaceného zboží.
--
-- ⛔ Cesta, na které to selže (změřeno, ne odvozeno):
--   1. člověk se odhlásí z newsletteru, jde na `odhlaseni_trvale`,
--   2. později KOUPÍ (videokurz, Academy, balíček, konzultaci, předplatné appky),
--   3. `academy-stripe-webhook` (posliUvitani), `simpleshop-webhook` (sendWelcome)
--      nebo `app-onboarding-hook` postaví lead na `track='onboarding-nakup-…'`,
--      `step=0`, `status='active'`, `next_send_at=now()`,
--   4. trigger to přepíše na `status='unsubscribed'`, `next_send_at=null`,
--   5. `drip-send` bere jen `status='active' and next_send_at is not null`,
--      takže uvítací a PŘÍSTUPOVÝ mail neodejde.
-- Doklad o zaplacení přitom dorazí, ten jde přímým Resendem mimo tratě.
-- ⇒ Zaplaceno, účtenka doručena, zboží ne. Týká se 67 lidí na seznamu,
--    z toho 13 už jednou kupovalo (mají aktivní entitlement `videokurz`).
--
-- Soubor `2026-09-06_odhlaseni/brana-v-databazi.sql` tvrdil, že zmrazení místo mazání
-- tuhle díru zavírá („pojistky dál fungují"). Nezavřelo. Jen ji přesunulo z INSERT
-- na UPDATE, protože řádek teď existuje, ale je zmrazený.
--
-- ⭐ PRÁVNÍ STRÁNKA: doručení zaplaceného je plnění smlouvy, ne marketing. Odhlášení
--    z obchodních sdělení ho zastavit nesmí. Naopak nedoručit ho je vada plnění.
--
-- ⛔ VÝJIMKA JE ÚZKÁ SCHVÁLNĚ: jen KROK 0 tratí `onboarding-nakup-%`.
--    Krok 0 je u všech pěti tratí doručovací mail:
--      onboarding-nakup-academy          „Vítej v Barna Academy"
--      onboarding-nakup-academy-mesicni  „Vítej v Barna Academy"
--      onboarding-nakup-balicek          „Tady máš recepty i odpovědi"
--      onboarding-nakup-videokurz        „Tvůj videokurz je připravený"
--      onboarding-nakup-konzultace       „Konzultace je tvoje. Co bude dál"
--      onboarding-nakup-tvujcoach        „První tři dny rozhodnou"
--    Kroky 1 a výše jsou navazující prodejní maily. Jakmile na ně `drip-send`
--    lead posune, UPDATE už výjimce neodpovídá a řádek se zmrazí zpátky.
--    Odhlášený kupec tedy dostane PŘESNĚ JEDEN mail: ten s přístupem.
--
-- ⛔ REGISTRACE ZDARMA sem NEPATŘÍ a taky nespadá: `app-onboarding-hook` ji posílá
--    do tratě `tc-zkusebka`, která prefix `onboarding-nakup-` nemá (viz `TRACKY`).
--    Ověřeno čtením funkce, ne odhadem.
--
-- STOPA: propuštění se zapisuje do `email_events` (type='info'), ne do
-- `odhlaseni_blokovano`. Ta tabulka znamená „zablokovaný pokus" a slévat do ní dva
-- významy je přesně ta chyba, na kterou projekt už jednou doplatil u
-- `moderation_status='pending'`.
--
-- OVĚŘENO NA ŽIVÉ DB sondou v transakci, kterou jsem shodil:
--   doručení (krok 0) prošlo, propuštění zapsáno 1×
--   navazující prodejní mail (krok 1) zablokován
--   běžný marketing zablokován
--   výsledný stav 'unsubscribed', next_send_at NULL, 2 záznamy v odhlaseni_blokovano
--   po rollbacku 67 odhlášených a 1013 leadů beze změny, funkce má pořád jednu variantu
-- ============================================================================

create or replace function public.leads_respektuj_odhlaseni()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.odhlaseni_trvale o where o.email = lower(new.email)) then
    return new;
  end if;

  -- VÝJIMKA: doručení zaplaceného zboží. Podrobné zdůvodnění v hlavičce souboru.
  if new.track like 'onboarding-nakup-%' and coalesce(new.step, 0) = 0 then
    insert into public.email_events (lead_id, step, type, detail)
    values (new.id, 0, 'info',
            jsonb_build_object('duvod', 'odhlaseny kupec: propusteno doruceni zaplaceneho',
                               'track', new.track, 'operace', tg_op));
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Radek se vubec nezalozi. Vyjimku schvalne NEvyhazujeme: `lead-capture` a webhooky
    -- by na ni spadly celym pozadavkem a clovek by videl chybu formulare.
    insert into public.odhlaseni_blokovano (email, operace, trat, krok)
    values (lower(new.email), 'INSERT', new.track, new.step);
    return null;
  end if;

  -- UPDATE: radek nechame byt, ale nesmi se probudit. Termin pryc, stav zpatky na
  -- odhlaseny. `drip-send` bere jen `status='active' and next_send_at is not null`.
  if new.next_send_at is not null or new.status is distinct from 'unsubscribed' then
    insert into public.odhlaseni_blokovano (email, operace, trat, krok)
    values (lower(new.email), 'UPDATE', new.track, new.step);
  end if;
  new.next_send_at := null;
  new.status := 'unsubscribed';
  return new;
end;
$function$;

-- ============================================================================
-- CO TÍMHLE NENÍ VYŘEŠENO (patří do předávky, ne do kódu)
-- ============================================================================
-- a) `push-reengagement` v projektu APPKY (`kfkmghvhqwqtsalqjmrp`) posílá mail přes
--    Resend a o `odhlaseni_trvale` neví: ta tabulka je v Academy, tedy v jiné databázi.
--    Respektuje jen appkové `profiles.pripominky_zapnute`. 6. 9. večer jsem těm třem
--    lidem, kteří byli zároveň odhlášení a měli připomínky zapnuté, přepínač vypnul,
--    ale je to oprava DAT, ne brány. Systémově to chce buď přenos seznamu do appkové
--    databáze, nebo dotaz přes službu. Rozhodnutí, jestli odhlášení z newsletteru má
--    umlčet i appkové připomínky, patří Martinovi.
-- b) GDPR výmaz a cesta zpátky (kdo se chce znovu přihlásit) zůstávají otevřené,
--    viz `2026-09-06_kontroly/REVIZE-odhlaseni.md`, nálezy N3, N4 a N7.
-- ============================================================================
