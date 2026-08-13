-- ============================================================================
-- referrals.product: přidat 'appka' (11. 8. 2026)
--
-- PROČ: nákup předplatného appky Tvůj Coach se dosud partnerům nepřipisoval vůbec.
-- Most `app-purchase-bridge` ho zapisuje do `referrals` jako produkt 'appka', a bez
-- téhle změny by insert spadl na CHECK constraintu.
--
-- ⛔ POZOR NA TICHÉ SELHÁNÍ: atribuce je v mostu (stejně jako v `academy-stripe-webhook`)
--    best-effort v try/catch. Kdyby se tahle migrace nespustila, nákup by proběhl,
--    přístup by se udělil a provize by prostě NEBYLA, jen s alertem v mailu. Přesně ta
--    třída chyby, kvůli které v `mb-affiliate-program-stav` stojí, že CHECK musí znát
--    každý produkt, pro který se atribuce volá.
--
-- Stávající hodnoty jsou opsané ze živého constraintu (ověřeno dotazem do pg_constraint
-- 11. 8. 2026 ve 20:3x), ne z paměti: 'balicek' a 'konzultace' tam přibyly později.
-- ============================================================================

alter table public.referrals drop constraint if exists referrals_product_check;

alter table public.referrals
  add constraint referrals_product_check
  check (product = any (array['academy'::text, 'videokurz'::text, 'balicek'::text, 'konzultace'::text, 'appka'::text]));
