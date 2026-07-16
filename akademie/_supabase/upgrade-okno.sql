-- ============================================================
-- Barna Academy: UPGRADE OKNO (mise-revize-2026-07-16, bod 8)
-- Časované upgrade okno po nákupu videokurzu: kód UPGRADE800 (plných 800 Kč
-- z videokurzu do Academy) garantujeme 7 dní od nákupu, pak už jen část.
-- Férová garance, žádný fake countdown. Stejná věta přibyla i na webu
-- v /dekuji-videokurz/.
--
-- ⚠️ NESPOUŠTĚT AUTOMATICKY. Spustit ručně (Supabase SQL editor) po schválení Martinem.
--
-- Část A (živá): doplní odstavec o UPGRADE800 + 7denní garanci do uvítacího
--   mailu onboarding-nakup-videokurz step 0 (ten dnes o Academy nemluví vůbec).
--   Re-runnatelné: guard na "UPGRADE800 už v šabloně je" + kotva na závěrečný blok.
-- Část B (zakomentovaný NÁVRH): nový krok "zítra ti okno zavírám" den 6.
--   Martin rozhodne; před spuštěním číst varování u části B.
-- ============================================================

begin;

-- ─────────────────────────────────────────────────────────────
-- A) onboarding-nakup-videokurz step 0 (nakup-vk):
--    nový odstavec před závěrečný blok ("Kdyby cokoliv nešlo...").
--    Ověřeno SELECTem 2026-07-16: bloky 0-7, index 6 = závěr, UPGRADE800 nikde.
-- ─────────────────────────────────────────────────────────────
update email_templates
   set blocks = jsonb_insert(
         blocks,
         '{6}',
         $blk${"t": "p", "html": "💡 Jedna věc navíc: tenhle videokurz je celý součástí <strong>Barna Academy</strong>, kompletního systému s 24 moduly, certifikací, generátory a appkou Tvůj Coach. Když budeš chtít jít dál, cenu kurzu ti do ní připočtu: v objednávce použij kód <strong>UPGRADE800</strong> a ušetříš 800 Kč. ⏰ Kód ti garantuju <strong>7 dní od nákupu</strong>. Pak už jen část. <a href='https://martinbarna.cz/akademie/'>Mrkni na Academy</a>."}$blk$::jsonb
       ),
       updated_at = now()
 where track = 'onboarding-nakup-videokurz' and step = 0
   and blocks::text not ilike '%UPGRADE800%'            -- re-run ochrana
   and blocks->6->>'html' like 'Kdyby cokoliv nešlo%';  -- kotva: vkládáme před závěr

-- Kontrola po běhu: nový blok má být na indexu 6, závěr se posunul na 7, P.S. na 8.
select step, jsonb_array_length(blocks) as bloku, blocks->6->>'html' as novy_blok
  from email_templates
 where track = 'onboarding-nakup-videokurz' and step = 0;

commit;

-- ─────────────────────────────────────────────────────────────
-- B) NÁVRH (ZAKOMENTOVANÝ, Martin rozhodne): nový krok "zítra okno zavírám"
--
--    Časování dnes:  step 0 hned po nákupu (wait 5) → step 1 tipy den 5 (wait 14)
--                    → step 2 doporučení den 19 (konec).
--    Návrh:          step 0 (wait 6) → NOVÝ step 1 "zítra zavírám" den 6 (wait 8)
--                    → step 2 tipy den 14 (wait 14) → step 3 doporučení den 28.
--    Den 6 proto, že okno UPGRADE800 zavírá den 7, "zítra" tak sedí doslova.
--
--    ⚠️ VAROVÁNÍ před spuštěním (proto je to jen návrh):
--    1) Přečíslování šablon musí jít od nejvyššího kroku (PK track+step).
--    2) Rozjeté leady v tracku je NUTNÉ posunout taky (update leads níž),
--       jinak lead čekající na "tipy" (step 1) dostane připomínku okna pozdě
--       a lead na step 2 dostane tipy podruhé (dedupe v drip-send je per step).
--       Celé spustit v JEDNÉ transakci.
--    3) Track je členský, drip-send ho po nákupu Academy nestopuje. Kdo koupí
--       Academy do 6 dnů, připomínku dostane taky. Vzácné a neškodné, ale ať se ví.
-- ─────────────────────────────────────────────────────────────

-- begin;
--
-- update email_templates set step = 3, updated_at = now()
--  where track = 'onboarding-nakup-videokurz' and step = 2;
--
-- update email_templates set step = 2, updated_at = now()
--  where track = 'onboarding-nakup-videokurz' and step = 1;
--
-- update leads set step = step + 1, updated_at = now()
--  where track = 'onboarding-nakup-videokurz' and step >= 1;
--
-- insert into email_templates (track, step, key, subject, preheader, blocks, wait_days)
-- values (
--   'onboarding-nakup-videokurz',
--   1,
--   'onb-vk-upgrade-okno',
--   'Zítra končí plných 800 Kč z videokurzu{{fn_suffix}}',
--   'Plných 800 Kč z videokurzu ti do Academy připočtu už jen zítra. Pak jen část.',
--   $blk$[
--     {"t": "p", "html": "Ahoj{{fn_space}},"},
--     {"t": "p", "html": "jen krátká připomínka, ať ti nic neuteče. K videokurzu jsem ti slíbil, že jeho cenu ti připočtu do <strong>Barna Academy</strong>. Kód <strong>UPGRADE800</strong> (sleva 800 Kč) ti garantuju 7 dní od nákupu a zítra to okno zavírám. Pak už připočtu jen část."},
--     {"t": "p", "html": "Žádné odpočítávadlo, žádný trik. Jen férové pravidlo: plnou cenu kurzu odečtu jen těm, kdo se rozhodnou rychle."},
--     {"t": "p", "html": "Academy je kompletní systém: 24 modulů, certifikace, generátory jídelníčků i tréninků, rebrandovatelné materiály a appka Tvůj Coach. Videokurz, který už máš, je její součástí, takže nic neplatíš dvakrát."},
--     {"t": "btn", "href": "https://martinbarna.cz/akademie/", "text": "Mrknout na Academy"},
--     {"t": "p", "html": "Jestli Academy není tvoje parketa, v pohodě, tenhle mail ber jen jako férové upozornění. <strong>Be Effective!</strong><br>Martin"},
--     {"t": "ps", "html": "P.S. Kód UPGRADE800 zadáš v objednávce. Kdyby nešel načíst, odpověz na tenhle mail a vyřešíme to."}
--   ]$blk$::jsonb,
--   8
-- )
-- on conflict (track, step) do nothing;
--
-- update email_templates set wait_days = 6, updated_at = now()
--  where track = 'onboarding-nakup-videokurz' and step = 0;
--
-- commit;
