-- ============================================================================
-- KONZULTACE: vlastni CRM stopa + pauza prodejnich trati do doby po hovoru
-- 15. 9. 2026, 70. sef. IDEMPOTENTNI, spustitelne opakovane.
-- ⭐ VERZE PO REVIZI R1 (nalezy V1 a S1), viz sekce 3 a 4.
--
-- ROZHODNUTI MARTINA (15. 9. 2026), podle ktereho je tohle postavene:
--   A) "Termin konzultace zadavam ja v adminu, system mi to mailem pripomene.
--      Upsell na koucink ma prijit az PO konzultaci; nekdy je vhodne hned po hovoru."
--      => ZADNA pevna pauza N dni. Branou je TERMIN HOVORU, ne pocet dni od platby.
--   C) "Konzultace musi byt rozlisitelna od koucinku; kdyz pak dany mail pridam
--      do koucinku, zmizi z konzultace a pribude v koucinku."
--
-- ⛔ VSECHNA TELA FUNKCI JSOU VZATA ZE ZIVEHO ZNENI, ne ze starsich souboru v gitu.
--    Otisky pred zmenou: `zive-enroll-2026-09-15.sql` a `zive-newsletter-prijemci-2026-09-15.sql`.
--    `upsell-nevytrhavat.sql`, `upsell-sequences.sql`, `security-fixes-2026-07.sql`
--    a `academy-cenik-expirace.sql` jsou POZADU a spustit se NESMI (maji o tom hlavicku).
--
-- ⛔ CELA MIGRACE JEDE V JEDNE TRANSAKCI. Sekce 3 funkci nejdriv DROPuje (meni se
--    signatura), takze mimo transakci by mezi DROP a CREATE existovalo okno, ve kterem
--    by cron 11 spadl na neexistujici funkci.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) TERMIN HOVORU. Jedina nova tabulka, jeden radek na e-mail.
--    `termin_at` NULL = termin jeste neni zadany (a prave proto se cloveku
--    neprodava koucink: Martin s nim jeste nemluvil).
--    ⛔ Tabulka NEMA zadny grant pro anon ani authenticated a ma zapnute RLS
--    bez jedine policy: sahat na ni smi vyhradne service_role, tedy admin-api
--    a drip-send. Zaloha bez RLS je verejna tabulka (pamet
--    `feedback-zalozni-tabulka-bez-rls-je-verejna`), proto to neni volitelne.
-- ---------------------------------------------------------------------------
create table if not exists public.consultation_calls (
  email      text primary key,
  termin_at  timestamptz,
  note       text,
  updated_at timestamptz not null default now()
);

comment on table public.consultation_calls is
  'Termin konzultacniho hovoru. Zadava Martin v adminu (akce konzultace_termin). '
  'termin_at v budoucnu nebo NULL = hovor jeste nebyl => prodejni trate se odkladaji.';

alter table public.consultation_calls enable row level security;

-- ⛔ REVOKE od anon samo nestaci: prava casto visi na roli PUBLIC, kterou anon dedi
--    (pamet `feedback-postgres-grant-public-vs-anon`). Proto se bere i PUBLIC.
revoke all on table public.consultation_calls from public;
revoke all on table public.consultation_calls from anon;
revoke all on table public.consultation_calls from authenticated;
grant all on table public.consultation_calls to service_role;

-- ---------------------------------------------------------------------------
-- 2) enroll_into_upsell_academy: pridana JEDNA podminka do CTE `elig`.
--    Signatura se NEMENI, `create or replace` je tedy skutecna nahrada
--    a granty zustavaji (`feedback-create-or-replace-neni-nahrada`).
-- ---------------------------------------------------------------------------

-- proacl v dobe otisku: {postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.enroll_into_upsell_academy(p_limit integer DEFAULT 25)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count int := 0; v_min int := 73; r record;
BEGIN
  SELECT COALESCE(NULLIF(value,'')::int, 73) INTO v_min FROM app_config WHERE key='upsell_academy_min_lessons';
  IF v_min IS NULL THEN v_min := 73; END IF;
  FOR r IN
    WITH vk AS (
      SELECT DISTINCT lower(e.email) AS email, u.id AS user_id
      FROM entitlements e JOIN auth.users u ON lower(u.email) = lower(e.email)
      WHERE e.active AND e.product = 'videokurz'
        AND lower(e.email) NOT IN (SELECT lower(email) FROM entitlements WHERE product='academy' AND active
                                     AND (expires_at IS NULL OR expires_at > now()))
    ),
    engaged AS (
      SELECT vk.email FROM vk
      JOIN progress p ON p.user_id = vk.user_id AND p.completed AND p.lesson_id LIKE 'vk-%'
      GROUP BY vk.email HAVING count(*) >= v_min
    ),
    elig AS (
      SELECT e2.email FROM engaged e2
      WHERE e2.email NOT IN (SELECT lower(email) FROM customer_contacts WHERE tags && array['coaching-active'])
        -- 8. 8. 2026: soucasni i BYVALI klienti koucinku ven (step 0 = "Videokurz ti jde. Kam dal?")
        AND e2.email NOT IN (SELECT lower(email) FROM entitlements WHERE product = 'coaching')
        -- [15. 9. 2026] ZAPLACENA KONZULTACE PRED HOVOREM: zadna prodejni trat.
        -- Kupec konzultace se prave chysta mluvit s Martinem o tom, co mu tahle trat
        -- prodava. Dokud hovor neprobehl, do trate nepatri. Terminem je jediny zdroj
        -- pravdy `consultation_calls.termin_at`, ktery zadava Martin v adminu:
        -- NULL (nezadano) i budoucnost blokuji, minulost pousti.
        -- ⛔ ZADNA pevna pauza N dni (rozhodnuti Martina 15. 9. 2026).
        AND e2.email NOT IN (
              SELECT lower(e3.email) FROM entitlements e3
               LEFT JOIN consultation_calls cc3 ON lower(cc3.email) = lower(e3.email)
               WHERE e3.product = 'konzultace' AND e3.active
                 AND (e3.expires_at IS NULL OR e3.expires_at > now())
                 AND (cc3.termin_at IS NULL OR cc3.termin_at > now()))
        AND e2.email NOT IN (SELECT lower(email) FROM leads WHERE track LIKE 'upsell-%')
        -- 6. 9. 2026 (51. sef): evergreen trate jsou KONCOVE, z nich se nikdo nevraci do upsellu
        AND e2.email NOT IN (SELECT lower(email) FROM leads WHERE track LIKE 'evergreen-%')
        -- 6. 9. 2026 (51. sef): kdo uz upsell-academy jednou dostal, nedostane ho podruhe
        AND NOT EXISTS (SELECT 1 FROM email_events ev JOIN leads l3 ON l3.id = ev.lead_id
                         WHERE lower(l3.email) = e2.email AND ev.type = 'sent'
                           AND ev.detail->>'track' = 'upsell-academy')
        AND e2.email NOT IN (SELECT lower(email) FROM leads WHERE status IN ('unsubscribed','bounced','paused'))
        -- ⛔⛔ 13. 8. 2026: NEBRAT NIKOHO, KDO JE PRAVE UPROSTRED BLASTU.
        --    Blast (tydenik, blast-*) cloveku docasne prepise `track` a po odeslani mu engine
        --    zhasne `next_send_at`. Podminka o radek niz stoji na `next_send_at IS NOT NULL`,
        --    takze cloveka v tom okne NEVYLOUCI: enroll by ho prepsal na upsell-* natrvalo
        --    a vraceni na domovskou trat by ho uz nenaslo => TICHA ztrata trate.
        --    Zmereno 13. 8.: tykalo by se 5 lidi, s rustem Academy to poroste.
        AND e2.email NOT IN (SELECT lower(email) FROM leads WHERE track = 'tydenik' OR track LIKE 'blast%')
        AND e2.email NOT IN (SELECT lower(email) FROM leads WHERE next_send_at IS NOT NULL AND track NOT LIKE 'upsell-%')
    )
    SELECT email FROM elig LIMIT greatest(1, p_limit)
  LOOP
    IF EXISTS (SELECT 1 FROM leads WHERE lower(email) = r.email) THEN
      UPDATE leads SET track='upsell-academy', step=0, status='active', next_send_at=now(), updated_at=now()
       WHERE lower(email) = r.email;
    ELSE
      INSERT INTO leads (email, track, step, status, next_send_at, source)
      VALUES (r.email, 'upsell-academy', 0, 'active', now(), 'upsell-auto');
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $function$
;

-- ---------------------------------------------------------------------------
-- 3) enroll_into_upsell_coaching: podminka konzultace + NOVY VOLITELNY PARAMETR
--    `p_email` (nalez V1 revize R1, 15. 9. 2026).
--
-- PROC: tlacitko "Spustit upsell ted" v adminu si puvodne ochrany PREPISOVALO
-- v TypeScriptu a tri z nich vynechalo (`evergreen-%`, `status='paused'`, blast
-- a tydenik). Presne pred tim varuje komentar z 13. 8. 2026 o par radku niz:
-- clovek uprostred blastu ma `next_send_at` zhasnute, tlacitko by ho prepsalo
-- na upsell natrvalo a domovska trat by se TISE ztratila. Druha kopie pravidel
-- je proto pryc: rozhoduje TAHLE funkce, admin ji jen vola s jednim e-mailem.
--
-- ⛔ SIGNATURA SE MENI (pribyva druhy parametr), takze `create or replace` NENI
--    nahrada: tise by vyrobil DRUHOU funkci a volani `enroll_into_upsell_coaching(25)`
--    by se stalo nejednoznacnym (`feedback-create-or-replace-neni-nahrada`).
--    Proto DROP stare varianty a CREATE nove, obojí uvnitr transakce.
-- ⚠️ Cron 11 vola `public.enroll_into_upsell_coaching(25)`, tedy jednim pozicnim
--    argumentem. Po zmene se to porad resolvuje, `p_email` ma DEFAULT NULL
--    a NULL znamena "bez zuzeni", tedy presne dnesni chovani davky.
-- ⛔ GRANTY se po DROPu NEDEDI a musi se obnovit rucne (viz konec sekce).
--    Cil je otisk z `zive-enroll-2026-09-15.sql`:
--    {postgres=X/postgres,service_role=X/postgres}
-- ---------------------------------------------------------------------------
drop function if exists public.enroll_into_upsell_coaching(integer);

-- proacl v dobe otisku: {postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.enroll_into_upsell_coaching(p_limit integer DEFAULT 25, p_email text DEFAULT NULL)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count int := 0; r record;
BEGIN
  FOR r IN
    WITH reg AS (
      SELECT DISTINCT lower(e.email) AS email
      FROM entitlements e JOIN auth.users u ON lower(u.email) = lower(e.email)
      WHERE e.active AND e.product IN ('videokurz','academy')
    ),
    elig AS (
      SELECT r2.email FROM reg r2
      -- [15. 9. 2026] ZUZENI NA JEDEN E-MAIL. NULL = davkovy beh jako dosud (cron 11).
      -- Neprida ANI NEUBERE zadnou ochranu: jen omezi mnozinu kandidatu, takze
      -- rucni spusteni z adminu projde uplne stejnymi podminkami jako nocni davka.
      WHERE (p_email IS NULL OR r2.email = lower(trim(p_email)))
        AND r2.email NOT IN (SELECT lower(email) FROM customer_contacts WHERE tags && array['coaching-active'])
        -- 8. 8. 2026: soucasni i BYVALI klienti koucinku ven (texty trati stoji na "koupil sis videokurz")
        AND r2.email NOT IN (SELECT lower(email) FROM entitlements WHERE product = 'coaching')
        -- [15. 9. 2026] ZAPLACENA KONZULTACE PRED HOVOREM: zadna prodejni trat.
        -- Kupec konzultace se prave chysta mluvit s Martinem o tom, co mu tahle trat
        -- prodava. Dokud hovor neprobehl, do trate nepatri. Terminem je jediny zdroj
        -- pravdy `consultation_calls.termin_at`, ktery zadava Martin v adminu:
        -- NULL (nezadano) i budoucnost blokuji, minulost pousti.
        -- ⛔ ZADNA pevna pauza N dni (rozhodnuti Martina 15. 9. 2026).
        AND r2.email NOT IN (
              SELECT lower(e3.email) FROM entitlements e3
               LEFT JOIN consultation_calls cc3 ON lower(cc3.email) = lower(e3.email)
               WHERE e3.product = 'konzultace' AND e3.active
                 AND (e3.expires_at IS NULL OR e3.expires_at > now())
                 AND (cc3.termin_at IS NULL OR cc3.termin_at > now()))
        AND r2.email NOT IN (SELECT lower(email) FROM leads WHERE track LIKE 'upsell-%')
        -- 6. 9. 2026 (51. sef): evergreen trate jsou KONCOVE, z nich se nikdo nevraci do upsellu
        AND r2.email NOT IN (SELECT lower(email) FROM leads WHERE track LIKE 'evergreen-%')
        -- 6. 9. 2026 (51. sef): kdo uz upsell-coaching jednou dostal, nedostane ho podruhe
        AND NOT EXISTS (SELECT 1 FROM email_events ev JOIN leads l3 ON l3.id = ev.lead_id
                         WHERE lower(l3.email) = r2.email AND ev.type = 'sent'
                           AND ev.detail->>'track' = 'upsell-coaching')
        AND r2.email NOT IN (SELECT lower(email) FROM leads WHERE status IN ('unsubscribed','bounced','paused'))
        -- ⛔⛔ 13. 8. 2026: NEBRAT NIKOHO, KDO JE PRAVE UPROSTRED BLASTU. Duvod je stejny
        --    jako u `enroll_into_upsell_academy`, viz komentar tam.
        AND r2.email NOT IN (SELECT lower(email) FROM leads WHERE track = 'tydenik' OR track LIKE 'blast%')
        -- OBECNE: nikoho, komu bezi jakakoli jina sekvence nez upsell
        AND r2.email NOT IN (SELECT lower(email) FROM leads WHERE next_send_at IS NOT NULL AND track NOT LIKE 'upsell-%')
    )
    SELECT email FROM elig LIMIT greatest(1, p_limit)
  LOOP
    IF EXISTS (SELECT 1 FROM leads WHERE lower(email) = r.email) THEN
      UPDATE leads SET track='upsell-coaching', step=0, status='active', next_send_at=now(), updated_at=now()
       WHERE lower(email) = r.email;
    ELSE
      INSERT INTO leads (email, track, step, status, next_send_at, source)
      VALUES (r.email, 'upsell-coaching', 0, 'active', now(), 'upsell-auto');
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $function$
;

-- Obnova grantu po DROPu (bez toho by EXECUTE mel PUBLIC, tedy i anon).
revoke all on function public.enroll_into_upsell_coaching(integer, text) from public;
revoke all on function public.enroll_into_upsell_coaching(integer, text) from anon;
revoke all on function public.enroll_into_upsell_coaching(integer, text) from authenticated;
grant execute on function public.enroll_into_upsell_coaching(integer, text) to service_role;

-- ---------------------------------------------------------------------------
-- 4) newsletter_prijemci: JEDEN radek navic (nalez S1 revize R1, 15. 9. 2026).
--
-- PROC: odklad prodejni trati nastavi `next_send_at = ted + 24 h`. Podminka
-- `next_send_at > now() + interval '24 hours'` (pravidlo z 2. 9. 2026 "kdo ma
-- naplanovany mail do 24 h, se nepujcuje") je pro takovy radek VZDY nepravdiva,
-- protoze odklad vznikl DRIV, nez bezi rozesilka. Kupec konzultace by tedy po celou
-- dobu cekani na termin vypadl i z blog-newsletteru, tedy z OBSAHOVE trate,
-- kterou mu nikdo brat nechtel. Pri zapomenutem terminu napořád.
--
-- ⛔ Meni se JEDINA funkce a jen o disjunkci na znacku, kterou nic jineho nenastavuje
--    (`drip-send` ji pise pri odkladu a maze pri prvnim behu, kdy uz clovek neceka).
--    Bez znacky je chovani BIT PO BITU stejne jako dnes.
-- ⚠️ Zvazovana alternativa `next_send_at = NULL` (parkovani) se ZAMITA: retezec
--    `next_send_at is null` cte devet zivych funkci (blast_start_davka,
--    blast_poukazy_davka, c1_navrat_davka, enroll_into_longtail,
--    enroll_into_nurture_videokurz, newsletter_prijemci, newsletter_vraceni,
--    presun_kvizove_na_lead_magnet, tydenik_vraceni) a znamena v nich "tenhle clovek
--    nema naplanovano, je volny". Zaparkovany lead by se tim stal koristi blastu
--    i mostu, coz je presne ta TICHA ztrata trate, pred kterou varuje 13. 8. 2026.
--    Signatura se NEMENI, granty tedy zustavaji.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.newsletter_prijemci(p_step integer)
 RETURNS TABLE(lead_id uuid, email text, track text, step integer, next_send_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select l.id, l.email, l.track, l.step, l.next_send_at
  from public.leads l
  where l.status = 'active'
    and l.consent
    -- SIROKA VARIANTA dle Martinova GO 27. 8. 2026: filtr `next_send_at is null` je ZAMERNE PRYC.
    -- 2. 9. 2026 (23. sef): kdo ma naplanovany mail do 24 h, ten se NEPUJCUJE.
    -- [15. 9. 2026] Tretí vetev: kdo ceka na konzultacni hovor, ma `next_send_at`
    -- posunuty JEN kvuli odkladu prodejni trati, zadny mail mu doopravdy nemiri.
    -- Znacku pise a maze `drip-send` (`_konzultace_ceka` ve `vars`), nic jineho ji nenastavuje.
    and (l.next_send_at is null or l.next_send_at > now() + interval '24 hours'
         or coalesce(l.vars->>'_konzultace_ceka', '') <> '')
    -- ⛔ [6. 9. 2026] Trvalý seznam odhlášených, viz tydenik_prijemci.
    and not exists (select 1 from public.odhlaseni_trvale o where o.email = lower(l.email))
    and lower(l.email) not in ('ivanabarnova@seznam.cz','barnamaro@gmail.com','barnaxxx@seznam.cz')
    and lower(l.email) not like 'fitness.barna%'
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
    and not exists (select 1 from public.email_events e
                     where e.lead_id = l.id and e.type in ('sent','oneoff')
                       and (e.created_at at time zone 'Europe/Prague')::date
                         = (now() at time zone 'Europe/Prague')::date)
$function$
;

commit;

-- ---------------------------------------------------------------------------
-- 5) KONTROLA PO SPUSTENI (jen cteni, nic nemeni):
--    a) granty se musi rovnat otisku:
--       select p.oid::regprocedure::text, p.proacl::text from pg_proc p
--         join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname='public' and p.proname like 'enroll_into_upsell_%';
--       ocekavano u obou: {postgres=X/postgres,service_role=X/postgres}
--    b) kazda funkce JEN JEDNOU (jinak vznikl dvojnik a volani je nejednoznacne):
--       select proname, count(*) from pg_proc p join pg_namespace n
--         on n.oid = p.pronamespace where n.nspname='public'
--        and proname like 'enroll_into_upsell_%' group by 1;   -- ocekavano 1 a 1
--    c) coaching ma dva parametry, academy porad jeden:
--       select p.oid::regprocedure::text from pg_proc p join pg_namespace n
--         on n.oid = p.pronamespace where n.nspname='public'
--        and proname like 'enroll_into_upsell_%';
--    d) nova podminka je v obou telech:
--       select proname, position('consultation_calls' in pg_get_functiondef(p.oid)) > 0
--         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname='public' and proname like 'enroll_into_upsell_%';
--    e) newsletter_prijemci zna znacku:
--       select position('_konzultace_ceka' in pg_get_functiondef(
--                'public.newsletter_prijemci(integer)'::regprocedure)) > 0;
--    f) SUCHY TEST ZUZENI (nic nezapise, jen ukaze, ze funkce s cizim e-mailem
--       nezaradi nikoho):  select public.enroll_into_upsell_coaching(1, 'neexistuje@example.com');
--       ⛔ NEspoustet s existujicim e-mailem, ta funkce ZAPISUJE do `leads`.
-- ---------------------------------------------------------------------------
