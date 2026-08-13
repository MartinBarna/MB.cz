-- ============================================================================
-- referrals.stripe_subscription_id: provize se váže na PŘEDPLATNÉ, ne na e-mail
-- (13. 8. 2026, oprava vady V2 z revize P48)
--
-- PROČ: u opakované platby appky se partner dohledává z ledgeru `referrals`, protože
-- `?ref=` kód z odkazu ani promo kód z pokladny u dvanácté faktury nikde nefigurují.
-- Dokud se hledalo podle E-MAILU, platilo tohle: kdo přišel přes partnera, předplatné
-- zrušil a po půl roce se upsal ZNOVU A PŘÍMO bez kódu, měl první fakturu správně bez
-- provize, ale od druhé bral zase starý partner, a to napořád. Reprodukováno při revizi;
-- u jednoho vráceného VIP klienta je to ~1 800 Kč ročně z cizí kapsy.
--
-- ⛔⛔ POŘADÍ NASAZENÍ: tahle migrace musí být APLIKOVANÁ DŘÍV, než se nasadí nová verze
--     edge funkce `app-purchase-bridge`. Ta nová verze do sloupce zapisuje a filtruje
--     podle něj; bez sloupce by insert i dotaz spadly na neznámé pole a provize by se
--     nezapsala vůbec (jen s alertem). Opačně to nikdy.
--
-- ⚠️ Sloupec je ZÁMĚRNĚ jen `text` bez NOT NULL a bez unikátního indexu:
--     - prázdný zůstane u řádků z Academy (tam předplatné appky nedává smysl) a u řádků
--       appky zapsaných před tímhle datem; ty se u obnovy dohledávají dál podle e-mailu,
--       protože jinak se dohledat nedají,
--     - unikátní být nesmí, jedno předplatné má za rok dvanáct řádků (dvanáct faktur).
--       Idempotenci drží `referrals_order_uidx` na `order_id`, ta se nemění.
--
-- Živý stav ověřen dotazem do information_schema a pg_indexes 13. 8. 2026 ve 21:0x
-- (projekt uhmrpfsdcujbhbtumqye): sloupec neexistuje, `referrals` má 0 řádků, takže
-- není co dopisovat zpětně a migrace nemůže nic přepsat.
-- ⚠️ Pozn. k repu: `akademie/_supabase/referral-affiliate.sql` je proti živé DB POZADU
--     (obsahuje index `referrals_buyer_product_uidx`, který v produkci NEEXISTUJE
--     a který by opakované provize rovnou zablokoval). Neber ho jako popis stavu.
-- ============================================================================

alter table public.referrals
  add column if not exists stripe_subscription_id text;

comment on column public.referrals.stripe_subscription_id is
  'Stripe předplatné, ze kterého provize vznikla (produkt appka). Podle něj se u obnovy dohledá partner; e-mail slouží jen u řádků zapsaných před 13. 8. 2026, které sloupec nemají.';

-- Vyhledávací index, ne unikátní: čte se jím každá obnova (jeden dotaz na fakturu).
create index if not exists referrals_app_subscription_idx
  on public.referrals (stripe_subscription_id)
  where stripe_subscription_id is not null;
