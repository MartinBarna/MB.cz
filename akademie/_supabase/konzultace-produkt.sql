-- Konzultace jako samostatný produkt v entitlements (30. 7. 2026)
--
-- PROČ: `entitlements.product` má CHECK, který znal jen 'academy', 'videokurz' a 'coaching'.
-- Webhook `academy-stripe-webhook` po zaplacení konzultace zapisuje product='konzultace',
-- takže mu insert padal na porušení CHECKu, funkce vracela 500 a Stripe událost opakoval.
--
-- ⛔ CO BY TO ZNAMENALO NAOSTRO: zákazník zaplatí 2 990 Kč, přístup nedostane a uvítací mail
-- mu nepřijde. Stripe by událost opakoval, takže by se to samo nespravilo.
-- ✅ Alert BY přišel: zastřešující `catch` posílá „Stripe webhook: neošetřená chyba" a v textu
--    je i jméno porušeného constraintu. Ověřeno, při testu 30. 7. přišel dvakrát (11:22).
--    (V první verzi tohohle komentáře jsem napsal, že alert nepřijde. Byla to chyba.)
--    Ta záchranná síť ale řeší jen to, že se o tom Martin dozví, ne že zákazník dostane, co koupil.
-- Odhaleno přehráním už zaplacené (a refundované) testovací události, ne až na živém nákupu.
--
-- ⚠️ 'coaching' v tom výčtu už je a ZŮSTÁVÁ: konzultace není koučink. Koučink je dlouhodobá
--    spolupráce (Gold/Diamond), konzultace je jedna hodina. Kdyby se slily do jednoho
--    produktu, nešlo by je odlišit ani při refundu, ani v upsell frontách.
alter table public.entitlements drop constraint if exists entitlements_product_check;
alter table public.entitlements add constraint entitlements_product_check
  check (product = any (array['academy'::text, 'videokurz'::text, 'coaching'::text, 'konzultace'::text]));

-- ⬜ ZÁMĚRNĚ NEMĚNÍME další dva výčty produktů, které v téhle DB žijí:
--    `referrals_product_check`  (academy, videokurz) a
--    `progress_product_check`   (academy, videokurz).
-- Do `progress` se konzultace nikdy nezapíše, to je postup v lekcích.
-- Do `referrals` taky ne: sazebník odměn ve webhooku (`ODMENA`) zná jen academy a videokurz,
-- takže se pro konzultaci žádný řádek nezakládá. ⚠️ Kdyby Martin někdy chtěl vyplácet
-- odměnu i za doporučenou konzultaci, MUSÍ se rozšířit `referrals_product_check` ZÁROVEŇ
-- s tím sazebníkem, jinak zápis odměny spadne a webhook vrátí 500 na zaplacené konzultaci.
