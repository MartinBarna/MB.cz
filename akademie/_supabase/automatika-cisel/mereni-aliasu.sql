-- ============================================================
-- APPKA Tvuj Coach (projekt kfkmghvhqwqtsalqjmrp)
-- MERENI HLEDACICH ALIASU v curated_foods
--
-- ⛔ CTECI DOTAZ. Zadny insert, update ani delete. Presto se NESPOUSTI jen tak:
--    je to plny sken obou tabulek potravin (dnes ~68 tisic radku) a je urceny
--    k jednorazovemu rozhodnuti, ne do rutiny nebo do hlidky.
--
-- KDY HO SPUSTIT
--   Az `potraviny_raw` z RPC `verejna_cisla()` zacne lezt k 60 000, tedy tesne
--   PREDTIM, nez by se verejny slib posunul z „pres 50 000" na „pres 60 000".
--   Aktualni hodnotu ukaze `node scripts/kontrola-cisla-stari.mjs` (pole
--   pocet_potravin_raw), 25. 8. 2026 to bylo 59 024. A dal pokazde, kdyz do
--   `curated_foods` spadne nova hromadna davka.
--
-- PROC VUBEC
--   `verejna_cisla()` pocita `count(distinct lower(btrim(name)))` pres
--   curated_foods + foods_cache. V tom cisle jsou ale HLEDACI TVARY: import
--   z 25. 8. 2026 vlozil vedle skutecnych potravin i varianty typu
--   „Brokolice cerstve uvarena bez tuku" / „...uvarene bez tuku", aby cesky
--   vyhledavac nasel oba tvary. Pro hledani jsou uzitecne, ale jako pocet
--   POLOZEK V DATABAZI nadhodnocuji. Tenhle dotaz rekne, o kolik.
--
-- JAK SE ALIAS POZNA
--   Sloupec pro to NENI (struktura curated_foods overena 25. 8. 2026: id, name,
--   category, kcal_100g, protein_100g, carb_100g, fat_100g, fiber_100g, note,
--   ean, created_at, updated_at, package_g, serving_g). Jedina stopa je text
--   v `note`, kde generator davky nechaval prefix „Alias hledani." (s diakritikou).
--
-- ⛔⛔ ZNACKA JE DOLNI ODHAD, NE PRAVDA. Overeno 25. 8. 2026:
--       note like 'Alias hledání.%'  ->  11 611 radku
--       note ilike 'alias%'          ->  11 648 radku
--       celkem curated_foods         ->  43 130 radku
--    Paměť projektu ([[tvujcoach-potraviny-import-2026-08-25]]) pritom mluvi
--    o 13 446 hledacich tvarech v teze davce. Rozdil ~1 800 jsou aliasy z vln,
--    ktere prefix do `note` nepsaly (vlna 12 z knihovny receptu a vlna 14
--    cilenych aliasu).
--    ⇒ „hledaci_aliasy" z tohoto dotazu je DOLNI odhad
--    ⇒ „bez_aliasu" je tedy HORNI odhad poctu skutecnych potravin
--    ⇒ do verejneho textu se z nej NIKDY nebere cislo primo. Zaokrouhli se dolu
--       na 10 000 a jeste se overi, ze rozdil proti pameti neni vetsi nez ten
--       jeden schod. Na webu nesmi stat vic, nez kolik jich je.
--
-- ⛔ Do `verejna_cisla()` se tenhle vypocet NEDAVA. RPC ma byt levne a stabilni;
--    odecitani aliasu je uvaha pro cloveka pred zmenou prodejniho textu, ne
--    neco, co se ma prepocitavat kazdych sest hodin.
-- ============================================================


-- 1) HLAVNI DOTAZ: kolik z unikatnich nazvu jsou hledaci aliasy
--
-- Pocita se nad TOUZ mnozinou jako `verejna_cisla()`, tedy unikatni
-- `lower(btrim(name))` pres obe tabulky. Nazev se pocita jako alias jen tehdy,
-- kdyz VSECHNY jeho radky jsou aliasove (`bool_and`) a zaroven se neobjevuje
-- ve `foods_cache`. Kdyby se pocitaly radky misto nazvu, alias sdileny s
-- normalni polozkou by se odecetl dvakrat.
with radky as (
  select lower(btrim(name)) as jmeno,
         (note like 'Alias hledání.%') as alias
    from public.curated_foods
   where name is not null and btrim(name) <> ''
  union all
  -- foods_cache jsou etikety a znackove produkty, aliasy se do ni negenerovaly
  select lower(btrim(name)) as jmeno,
         false as alias
    from public.foods_cache
   where name is not null and btrim(name) <> ''
),
podle_jmena as (
  select jmeno, bool_and(alias) as jen_alias
    from radky
   group by jmeno
)
select
  count(*)                                          as distinct_nazvu_celkem,
  count(*) filter (where jen_alias)                 as hledaci_aliasy_dolni_odhad,
  count(*) filter (where not jen_alias)             as bez_aliasu_horni_odhad,
  round(100.0 * count(*) filter (where jen_alias)
        / nullif(count(*), 0), 1)                   as procento_aliasu,
  -- Co by se smelo napsat za slovo „pres", kdyby se aliasy odecetly.
  -- ⚠️ Porad je to HORNI odhad, viz hlavicka.
  (count(*) filter (where not jen_alias) / 10000) * 10000 as navrh_verejneho_cisla
  from podle_jmena;


-- 2) KONTROLA POKRYTI ZNACKY (levna, jen curated_foods)
--
-- Pust ji spolu s dotazem 1. Kdyby `alias_presne` skoklo na skoro nulu, znamena
-- to, ze nova davka prefix do `note` uz nepise, a dotaz 1 pak mlci o necem, co
-- v datech je. Rozdil mezi `alias_presne` a `alias_ilike` ukazuje polozky
-- s jinym tvarem prefixu.
select
  count(*)                                                as celkem,
  count(*) filter (where note like 'Alias hledání.%')     as alias_presne,
  count(*) filter (where note ilike 'alias%')             as alias_ilike,
  count(*) filter (where note is null)                    as bez_note
  from public.curated_foods;


-- 3) NAMATKA K OCICKU (30 radku, at je videt, co se odecita)
--
-- ⚠️ Nikdy nemazat radky jen proto, ze je tenhle dotaz oznaci za alias.
--    Aliasy jsou ve vyhledavani UZITECNE, jde jen o to, aby se nepocitaly
--    do prodejniho cisla. Hromadne mazani podle vystupu AI zakazuje
--    CLAUDE.md, pravidlo 7b.
select name, category, kcal_100g, note
  from public.curated_foods
 where note like 'Alias hledání.%'
 order by name
 limit 30;
