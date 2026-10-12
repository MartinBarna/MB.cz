-- Sjednocení škál týdenního reportu koučinku (rozhodl Martin 12. 10. 2026):
-- všech 5 škál = školní známka, 1 = nejlíp, 5 = nejhůř. Kvalita spánku (spanek_kvalita)
-- a dodržení plánu (dodrzeni) se dosud sbíraly obráceně (5 = nejlíp).
-- Nový formulář (akademie/klient/index.html) ukládá scales.skala_v = 2.
--
-- Spouštět AŽ PO nasazení nového formuláře. Otáčí jen řádky BEZ skala_v (= starý směr),
-- proto je bezpečné ho pustit znovu (např. za týden kvůli reportu odeslanému ze staré
-- stránky v cache): řádek se značkou už nikdy neotočí. Originál zůstává v scales.pred_1012.
-- Hodnoty mimo 1 až 5 a nečíselné hodnoty se neotáčí (jen se označí a zálohují).
update client_reports
set scales = scales
  || jsonb_build_object(
       'skala_v', 2,
       'pred_1012', jsonb_build_object('spanek_kvalita', scales->'spanek_kvalita', 'dodrzeni', scales->'dodrzeni'))
  || case when jsonb_typeof(scales->'spanek_kvalita') = 'number'
           and (scales->>'spanek_kvalita')::numeric between 1 and 5
          then jsonb_build_object('spanek_kvalita', 6 - (scales->>'spanek_kvalita')::numeric)
          else '{}'::jsonb end
  || case when jsonb_typeof(scales->'dodrzeni') = 'number'
           and (scales->>'dodrzeni')::numeric between 1 and 5
          then jsonb_build_object('dodrzeni', 6 - (scales->>'dodrzeni')::numeric)
          else '{}'::jsonb end
where (scales ? 'spanek_kvalita' or scales ? 'dodrzeni')
  and not (scales ? 'skala_v');

-- Návrat (kdyby bylo potřeba):
-- update client_reports set scales = (scales - 'skala_v' - 'pred_1012')
--   || jsonb_strip_nulls(scales->'pred_1012')
-- where scales ? 'pred_1012';
