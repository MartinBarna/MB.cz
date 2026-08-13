-- KVIZOVE TRATE: presun zpatky na obecnou trat `lead-magnet`.
--
-- Kontext (13. 8. 2026): kviz na /kviz/ roztridi cloveka do jednoho ze CTYR profilu
-- (`data`, `vikend`, `vecer`, `pohyb`) a `lead-capture` ho posle do vlastni trate
-- `kviz-<profil>`. Ta ma DVA kroky:
--   krok 0 = "Tady mas svuj plan" + profilovy odstavec z kvizu (wait_days 1)
--   krok 1 = NABIDKA APPKY Tvuj Coach s uhlem podle profilu   (wait_days 2)
-- Zbytek sekvence uz je spolecny, proto se lead po kroku 1 vraci na `lead-magnet`.
--
-- ⛔ MOST (`app_config.navazujici_trate`) SE NA TOHLE POUZIT NEDA. `mostNaDalsiTrat`
--    v `drip-send` nastavuje cilovy krok VZDY na 0, takze by kvizovemu cloveku prislo
--    "Tady mas svuj plan" podruhe. Proto tahle funkce + pg_cron.
--
-- ⛔ CIL JE KROK 2, NE 1. Kvizovy krok 1 zabira misto kroku 1 obecne trate: ma tentyz
--    odstup (2 dny) a tentyz ucel v poradi. Znamena to, ze kvizovy clovek NEDOSTANE
--    `lead-magnet`/1 "Chyba c. 1, na ktere lidi shori" a dostane misto nej nabidku
--    appky na miru. Pocet mailu i tempo zustavaji stejne jako u nekvizovych leadu.
--    Kdyby se to nekdy melo zmenit na "dostane oboji", je to jedno cislo: `step = 1`.
--
-- Historie: 13. 8. dopoledne funkce presouvala uz po kroku 0 na `lead-magnet`/1
-- (kvizova trat tehdy mela jen krok 0). Rozsirenim trate o krok 1 se posunula
-- i podminka (`step >= 2`) i cil (`step = 2`).

CREATE OR REPLACE FUNCTION public.presun_kvizove_na_lead_magnet(p_limit integer DEFAULT 200)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count int := 0;
BEGIN
  -- [13. 8. 2026] Kvizova trat ma nove DVA kroky: 0 = doruceni planu s profilovym
  -- odstavcem, 1 = NABIDKA APPKY na miru profilu. Presun se proto posunul o krok dal.
  -- ⛔ Cil je `lead-magnet` KROK 2, ne 1: kvizovy krok 1 zabira misto kroku 1 obecne
  --    trate (tentyz odstup 2 dnu), takze `lead-magnet`/1 „Chyba c. 1" se preskakuje
  --    zamerne a clovek dostane stejny POCET mailu jako kdokoli jiny.
  -- ⛔ Krok 0 nikdy nepresouvat: clovek by prisel o slibeny plan.
  -- ⭐ Druha podminka je SEBEOPRAVNA POJISTKA: kdyby sablona `kviz-%`/1 zmizela nebo
  --    drip-send z jakehokoli duvodu zhasnul termin (`!tpl` vetev), lezel by clovek
  --    na kroku 1 s `next_send_at IS NULL` navzdy a nikde by to nekriklo. Takoveho
  --    cloveka funkce vytahne a posle dal. Nejhorsi nasledek vypadku je tim ztrata
  --    JEDNOHO mailu, ne ztraceny clovek.
  WITH k AS (
    SELECT id FROM leads
     WHERE track LIKE 'kviz-%'
       AND (step >= 2 OR (step >= 1 AND next_send_at IS NULL))
     ORDER BY updated_at
     LIMIT greatest(1, p_limit)
     FOR UPDATE SKIP LOCKED
  )
  UPDATE leads l
     SET track = 'lead-magnet',
         step  = 2,
         next_send_at = CASE WHEN l.status = 'active'
                             THEN coalesce(l.next_send_at, now())
                             ELSE l.next_send_at END,
         updated_at = now()
    FROM k
   WHERE l.id = k.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $function$;

-- pg_cron, jobid 23. Okno je cely den (wait_days kroku 1 jsou 2 dny), 10 minut ma
-- tedy stovky nasobku rezervy. Funkce ZAMERNE NENI za `followups_gate_open()`:
-- nic neposila, a pri zavrene brane by lide uvizli na neexistujici sablone.
-- select cron.schedule('kviz-presun-10min', '*/10 * * * *',
--   $$select public.presun_kvizove_na_lead_magnet(200);$$);

-- KONTROLA PO NASAZENI (musi platit vsechno):
--   select count(*) from pg_proc where proname='presun_kvizove_na_lead_magnet';  -- 1, ne 2
--   select count(*) from email_templates where track like 'kviz-%';              -- 8 (4 trate x 2 kroky)
--   select track, step, status, count(*) from leads where track like 'kviz-%' group by 1,2,3;
--
-- ROLLBACK na stav z rana 13. 8. (presun uz po kroku 0 na `lead-magnet`/1):
--   1. delete from email_templates where track like 'kviz-%' and step = 1;
--   2. v teto funkci vratit podminku na `step >= 1` a cil na `step = 1`.
--   ⚠️ V tomhle poradi. Obracene by lide na kroku 1 dostali `lead-magnet`/1 driv,
--      nez by sablona nabidky zmizela, tedy dva maily behem jednoho behu.
