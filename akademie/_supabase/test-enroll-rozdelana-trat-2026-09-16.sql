-- ============================================================================
-- TEST S KONTRASTEM k `enroll-rozdelana-trat-2026-09-16.sql` (nalez V7)
-- 16. 9. 2026, 73. sef (stavec Academy).
--
-- ⛔ NIC NEZAPISUJE: cely soubor bezi v transakci, ktera se NEDOKONCUJE.
--    Spousti se pres `npx supabase@latest db query --linked
--      --project-ref uhmrpfsdcujbhbtumqye --output-format json --file <tenhle soubor>`.
--    CLI vypise jen posledni statement a po skonceni sezeni transakci shodí,
--    takze synteticky lead ani jeho udalost v DB nezustanou.
--
-- JAK SE TEST POUZIVA (dva behy, ne jeden):
--   A) STARA VERZE: spust tenhle soubor tak, jak je. Ceka se `vybranych = 1`
--      a `stav_po = 'nurture-videokurz/0'`, tedy TEST PADA: prodejni trat
--      prepsala rozdelanou doruci trat.
--   B) NOVA VERZE: na misto oznacene `-- === MIGRACE SEM ===` vloz telo migrace
--      `enroll-rozdelana-trat-2026-09-16.sql` bez jejiho `begin;` a `commit;`.
--      V bashi (ve slozce `akademie/_supabase`):
--        sed -e '/=== MIGRACE SEM ===/r /dev/stdin' test-enroll-rozdelana-trat-2026-09-16.sql --          < <(grep -v -e '^begin;$' -e '^commit;$' enroll-rozdelana-trat-2026-09-16.sql) > test-b.sql
--      Ceka se `vybranych = 0` a `stav_po = 'lead-magnet/3'`, tedy lead zustal netknuty.
--   NEFUNGUJE tady psql meta-prikaz pro vlozeni souboru: `supabase db query` neni psql
--   a vraci `syntax error`. Overeno 16. 9. 2026.
--
-- NAMERENO 16. 9. 2026 proti produkci Academy:
--   A_PRED: {"vybranych":1,"stav_po":"nurture-videokurz/0"}   <- vada
--   B_PO:   {"vybranych":0,"stav_po":"lead-magnet/3"}          <- opraveno
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) SYNTETICKY PRIPAD: clovek uprostred doruci trate, kteremu rozesilka
--    zhasla `next_send_at`. Presne stav, ve kterem 15. 9. 2026 prisel jediny
--    kupec konzultace o kroky 1 a 2 sve zaplacene trate.
-- ---------------------------------------------------------------------------
insert into public.leads (email, track, step, status, next_send_at, source, consent)
values ('test-v7-rozdelana@example.invalid', 'lead-magnet', 3, 'active', null, 'test-v7', true);

-- Odeslany krok 0 doruci trate `onboarding-nakup-tvujcoach`, ktera ma dalsi kroky.
insert into public.email_events (lead_id, step, type, detail, created_at)
select id, 0, 'sent', jsonb_build_object('track','onboarding-nakup-tvujcoach'), now() - interval '2 days'
  from public.leads where email = 'test-v7-rozdelana@example.invalid';

-- `enroll_into_nurture_videokurz` bere jen leady starsi nez 12 h (respektive
-- bez terminu), tohle je jen aby synteticky radek nevypadal jako cerstvy.
update public.leads set updated_at = now() - interval '30 days'
 where email = 'test-v7-rozdelana@example.invalid';

-- === MIGRACE SEM ===
-- (pro beh B se na tohle misto vlozi telo `enroll-rozdelana-trat-2026-09-16.sql`
--  bez jeho `begin;` a `commit;`, viz hlavicka; pro beh A se sem nevklada nic)

-- ---------------------------------------------------------------------------
-- 3) MERENI. Temp tabulka je tu zamerne: v jednom `select` neni poradi
--    vyhodnoceni volatilni funkce a poddotazu zarucene a `stav_po` by mohl
--    ukazat stav PRED behem funkce (narazil jsem na to pri psani testu).
-- ---------------------------------------------------------------------------
create temp table v as select public.enroll_into_nurture_videokurz(50) as n;

-- ⛔ Pomocna funkce se tu volat NESMI: v behu A jeste neexistuje a cely soubor
--    by spadl na `function does not exist` uz pri PARSOVANI (`case when` to
--    neobejde, rozhodnuti o funkci padne driv nez vyhodnoceni). Jeji vlastni
--    test je nize jako samostatny dotaz pro beh B.
select (select n from v) as vybranych,
       (select track || '/' || step from public.leads
         where email = 'test-v7-rozdelana@example.invalid') as stav_po;

-- TEST SAMOTNE POMOCNE FUNKCE (jen beh B, spust zvlast po nasazeni migrace):
--   select public.ma_rozdelanou_dorucovaci_trat('<mail s rozdelanou trati>') as ma_byt_true,
--          public.ma_rozdelanou_dorucovaci_trat('nikdo-takovy@example.invalid') as ma_byt_false;
--   Namereno 16. 9. 2026 na syntetickem pripadu: true / false.

-- ⛔ ZADNY `commit;`. Transakce se shodí sama a produkce zustane netknuta.
