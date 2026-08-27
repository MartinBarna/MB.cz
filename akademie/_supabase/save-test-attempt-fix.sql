-- ============================================================================
-- OPRAVA C-W9: zaverecna zkouska Barna Academy se pocita NA SERVERU
-- ============================================================================
-- Datum:  27. 8. 2026
-- Nalez:  security-live-overeni-2026-08-27.md, radek C-W9.
--         Ziva funkce save_test_attempt zapisovala passed = coalesce(p_passed,false),
--         tedy hodnotu, kterou posila prohlizec. Kdokoli prihlaseny mohl zavolat
--         RPC z konzole s p_passed = true a v adminu se objevil jako "slozil".
--         Certifikat Academy tim prestal dokazovat slozeni zkousky.
--
-- Rozhodnuti Martina 27. 8. 2026: "zkouska oprav GO" (vysledek pocita server).
--
-- CO SE MENI
--   - p_passed a p_score se IGNORUJI. Zustavaji jen v signature, viz nize.
--   - Vysledek se pocita z p_answers proti klici v DB.
--   - Ulozene pole answers se prepise serverovou verzi (ok i correct), takze
--     i detail odpovedi v /akademie/moje/testy/ prestane byt klientovo tvrzeni.
--
-- ⛔ SIGNATURU ANI JMENA PARAMETRU NEMENIT
--   save_test_attempt(integer,integer,boolean,jsonb,text) s parametry
--   p_score, p_total, p_passed, p_answers, p_full_name.
--   Dva duvody:
--   1. PostgREST vola RPC POJMENOVANYMI argumenty (assets/ba-academy.js:290),
--      takze prejmenovany parametr = rozbite volani z webu.
--   2. Jina signatura by nenahradila starou funkci, ale tise vyrobila DRUHOU
--      a tahle migrace by byla mrtva paka. Viz pravidlo 8 v CLAUDE.md.
--   Proto tu p_score a p_passed zustavaji jako neuzivane parametry. Je to zamer.
--
-- GRANTY: "create or replace" zachovava stavajici prava, nove se nic negrantuje.
--   Zmereno 27. 8. 2026: postgres, authenticated, service_role (zadny anon,
--   zadny PUBLIC). Obranny REVOKE je na konci souboru, aby to tak i zustalo.
--
-- KDE JE KLIC SPRAVNYCH ODPOVEDI
--   public.lesson_content, radek lesson_id = 'zaverecny-test', sloupec html.
--   Neni to HTML, je to JSON pole 15 otazek ve tvaru:
--     [{"q":"text otazky","o":["A","B","C","D"],"c":1,"w":"vysvetleni"}, ...]
--   "c" je INDEX spravne moznosti v poli "o" (od nuly).
--   Tentyz radek cte i stranka zkousky pres BA.getLessonHtml('zaverecny-test'),
--   takze klic a zkouska nemuzou rozejit.
--
-- HRANICE USPECHU: 80 %, u 15 otazek 12/15. Dolozeno tremi misty v repu:
--   - akademie/test/index.html:107   var PASS = 12;
--   - akademie/test/index.html:71    "Pro splneni potrebujes min. 80 % (12/15)."
--   - akademie/_supabase/schema.sql:112  "test >=80 % + schvaleny prakticky ukol"
--   V app_config ZADNY klic prahu neni (zmereno 27. 8. 2026), proto je 80 %
--   napsanych primo tady jako ceil(pocet_otazek * 0,8).
--   ⚠️ Prah tim pádem zije na DVOU mistech: tady a v akademie/test/index.html.
--   Kdo meni jedno, meni i druhe, jinak stranka rekne jine cislo nez server.
--
-- FORMAT p_answers (co posila akademie/test/index.html:154)
--   [{"q":"text otazky","a":"text zvolene moznosti","correct":"text spravne","ok":true}]
--   Pozor: NENI tam id otazky ani index, jen TEXTY. Parujeme proto podle textu
--   otazky. Pole "correct" a "ok" od klienta se zahazuji, server si je spocita.
--   (Format overen z kodu; v test_attempts je 0 radku, realny vzorek neexistuje.)
--
-- OSETRENE PRIPADY
--   - klic chybi nebo neni platny JSON  -> vyjimka 'test-key-unavailable',
--     nic se nezapise (radeji chyba nez tichy vysledek bez klice)
--   - p_answers je null, '[]' nebo neni pole -> skore 0, passed false, pokus se ULOZI
--   - neuplne odpovedi -> chybejici otazky se pocitaji jako spatne
--   - neznama nebo podvrzena id otazek -> ignoruji se, protoze iterujeme pres KLIC,
--     ne pres to, co poslal klient; pridane polozky tedy nemuzou pridat bod
--   - rozbita polozka klice (chybejici "c", "c" mimo rozsah) -> otazka se pocita
--     jako spatna, funkce nespadne
-- ============================================================================

create or replace function public.save_test_attempt(
  p_score     integer,   -- IGNOROVANO (klientovo tvrzeni), zustava kvuli signature
  p_total     integer,   -- IGNOROVANO, pocet otazek bere server z klice
  p_passed    boolean,   -- IGNOROVANO (klientovo tvrzeni), zustava kvuli signature
  p_answers   jsonb,     -- vstup: co student vybral
  p_full_name text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid     uuid := auth.uid();
  v_email   text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_id      uuid;
  v_klic    jsonb;                      -- klic spravnych odpovedi z DB
  v_odp     jsonb;                      -- co poslal klient, obranne osetrene
  v_vysl    jsonb := '[]'::jsonb;       -- odpovedi prepocitane serverem
  v_otazka  jsonb;
  v_q       text;
  v_c       integer;
  v_spravne text;
  v_dana    text;
  v_ok      boolean;
  v_score   integer := 0;
  v_total   integer;
  v_prah    integer;
begin
  if v_uid is null then raise exception 'not-authenticated'; end if;

  -- 1) Klic spravnych odpovedi. SECURITY DEFINER, takze student na nej prava nepotrebuje.
  begin
    select l.html::jsonb into v_klic
      from lesson_content l
     where l.lesson_id = 'zaverecny-test'
     limit 1;
  exception when others then
    v_klic := null;   -- html neni platny JSON
  end;

  if v_klic is null
     or jsonb_typeof(v_klic) <> 'array'
     or jsonb_array_length(v_klic) = 0 then
    -- Fail-closed. Bez klice se nesmi zapsat ani uspech, ani neuspech.
    raise exception 'test-key-unavailable';
  end if;

  -- 2) Odpovedi od klienta bereme jen jako VSTUP.
  v_odp := coalesce(p_answers, '[]'::jsonb);
  if jsonb_typeof(v_odp) <> 'array' then v_odp := '[]'::jsonb; end if;

  v_total := jsonb_array_length(v_klic);

  -- 3) Vyhodnoceni. Iterujeme pres KLIC, ne pres podani.
  for v_otazka in select value from jsonb_array_elements(v_klic) loop
    v_q := btrim(coalesce(v_otazka ->> 'q', ''));

    -- spravna moznost podle klice; rozbitou polozku bereme jako "nelze uznat"
    v_c := case when jsonb_typeof(v_otazka -> 'c') = 'number'
                then (v_otazka ->> 'c')::int end;
    if v_c is null
       or jsonb_typeof(v_otazka -> 'o') <> 'array'
       or v_c < 0
       or v_c >= jsonb_array_length(v_otazka -> 'o') then
      v_spravne := null;                         -- ⛔ pozor: zaporny index by u jsonb
    else                                         --    pocital od konce, proto ta kontrola
      v_spravne := v_otazka -> 'o' ->> v_c;
    end if;

    -- co student vybral; parujeme podle textu otazky, prvni shoda vyhrava
    v_dana := null;
    select btrim(coalesce(a.value ->> 'a', '')) into v_dana
      from jsonb_array_elements(v_odp) a
     where btrim(coalesce(a.value ->> 'q', '')) = v_q
     limit 1;

    v_ok := v_spravne is not null
            and v_dana is not null
            and v_dana <> ''
            and v_dana = btrim(v_spravne);

    if v_ok then v_score := v_score + 1; end if;

    -- ulozime SERVEROVOU verzi ve tvaru, ktery uz cte admin (q, a, correct, ok)
    v_vysl := v_vysl || jsonb_build_object(
      'q',       v_otazka ->> 'q',
      'a',       coalesce(nullif(v_dana, ''), '-'),
      'correct', v_spravne,
      'ok',      v_ok
    );
  end loop;

  -- 4) Hranice uspechu: 80 % (15 otazek -> 12). Viz hlavicka souboru.
  v_prah := ceil(v_total * 0.8)::int;

  insert into test_attempts(user_id, email, full_name, score, total, passed, answers)
    values (
      v_uid,
      v_email,
      nullif(btrim(p_full_name), ''),
      v_score,                 -- serverove skore, ne p_score
      v_total,                 -- pocet otazek z klice, ne p_total
      v_score >= v_prah,       -- serverovy verdikt, ne p_passed
      v_vysl                   -- serverove prepocitane odpovedi
    )
    returning id into v_id;

  return v_id;
end $function$;

-- Prava zpet na zmereny stav z 27. 8. 2026 (create or replace je nemeni,
-- tohle je pojistka, aby je nekdo pozdeji nerozsiril). Web vola RPC jako
-- prihlaseny uzivatel, takze staci authenticated.
revoke execute on function public.save_test_attempt(integer,integer,boolean,jsonb,text) from public, anon;
grant  execute on function public.save_test_attempt(integer,integer,boolean,jsonb,text) to authenticated, service_role;

-- ============================================================================
-- KONTROLA PO NASAZENI (jen cteni, nic nezapisuje)
-- ============================================================================
-- Musi vratit prave JEDEN radek. Dva radky = vznikla druha funkce a oprava
-- je mrtva paka.
--
-- select p.oid::regprocedure as signatura,
--        position('p_passed' in pg_get_functiondef(p.oid)) > 0 as ma_parametr,
--        position('coalesce(p_passed' in pg_get_functiondef(p.oid)) > 0 as jeste_veri_klientovi
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--  where p.proname = 'save_test_attempt';
--
-- Ocekavano: jeden radek, ma_parametr = true, jeste_veri_klientovi = false.
--
-- ============================================================================
-- TESTOVACI PLAN (spustit AZ PO nasazeni funkce vyse)
-- ============================================================================
-- Cely blok bezi v jedne transakci a konci ROLLBACKem, takze v test_attempts
-- nic nezustane a zadnych ostrych dat se to nedotkne. Identita se predstira
-- pres request.jwt.claims, presne z toho cte auth.uid() i auth.jwt().
-- UUID nize je smyslene; test_attempts nema cizi klic na auth.users (zmereno
-- 27. 8. 2026), takze zadny ucet zakladat netreba.
--
-- ⚠️ Spustit jako JEDEN skript. Kdyby to nekdo pustil po castech a zapomnel
--    na ROLLBACK, zustanou v test_attempts tri testovaci pokusy. Nic se tim
--    nerozbije, ale objevi se Martinovi v /akademie/moje/testy/.
--
-- begin;
-- select set_config('request.jwt.claims',
--   '{"sub":"00000000-0000-0000-0000-00000000dead","email":"zkouska-test@example.invalid"}',
--   true);
--
-- -- SCENAR 1: same spravne odpovedi -> ocekavame 15/15, passed = true
-- select public.save_test_attempt(0, 0, false,
--   (select jsonb_agg(jsonb_build_object(
--             'q', t.o->>'q',
--             'a', t.o->'o'->>((t.o->>'c')::int),
--             'correct', 'podvrzeno', 'ok', false))
--      from lesson_content l, jsonb_array_elements(l.html::jsonb) as t(o)
--     where l.lesson_id = 'zaverecny-test'),
--   'Test Spravne') as id_1;
--
-- -- SCENAR 2: same spatne odpovedi -> ocekavame 0/15, passed = false
-- select public.save_test_attempt(0, 0, false,
--   (select jsonb_agg(jsonb_build_object(
--             'q', t.o->>'q',
--             'a', t.o->'o'->>(case when (t.o->>'c')::int = 0 then 1 else 0 end),
--             'correct', 'podvrzeno', 'ok', true))
--      from lesson_content l, jsonb_array_elements(l.html::jsonb) as t(o)
--     where l.lesson_id = 'zaverecny-test'),
--   'Test Spatne') as id_2;
--
-- -- SCENAR 3: TOHLE JE TA OPRAVA. Spatne odpovedi, ale klient lze:
-- --           p_score = 15 a p_passed = true. Ocekavame presto 0/15, passed = false.
-- select public.save_test_attempt(15, 15, true,
--   (select jsonb_agg(jsonb_build_object(
--             'q', t.o->>'q',
--             'a', t.o->'o'->>(case when (t.o->>'c')::int = 0 then 1 else 0 end),
--             'correct', 'podvrzeno', 'ok', true))
--      from lesson_content l, jsonb_array_elements(l.html::jsonb) as t(o)
--     where l.lesson_id = 'zaverecny-test'),
--   'Test Podvodnik') as id_3;
--
-- -- VYSLEDEK. Ocekavany vypis (poradi podle full_name):
-- --   Test Podvodnik   0  15  false   <- podvrzeny p_passed neprosel
-- --   Test Spatne      0  15  false
-- --   Test Spravne    15  15  true
-- -- a sloupec klient_lhal_v_detailu musi byt u vsech FALSE: server prepsal
-- -- i pole "ok" v ulozenych odpovedich, takze admin detail uz neni klientovo tvrzeni.
-- select full_name, score, total, passed,
--        exists (select 1 from jsonb_array_elements(answers) a
--                 where (a.value->>'correct') = 'podvrzeno')
--          as klient_lhal_v_detailu,
--        (select count(*) from jsonb_array_elements(answers) a
--          where (a.value->>'ok')::boolean) as uznano_serverem,
--        jsonb_array_length(answers) as ulozeno_odpovedi
--   from test_attempts
--  where user_id = '00000000-0000-0000-0000-00000000dead'
--  order by full_name;
--
-- rollback;   -- ⛔ POVINNE. Bez nej testovaci pokusy zustanou v tabulce.
--
-- -- Kontrola po rollbacku (musi vratit 0):
-- -- select count(*) from test_attempts
-- --  where user_id = '00000000-0000-0000-0000-00000000dead';
-- ============================================================================
