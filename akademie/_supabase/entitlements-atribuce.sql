-- ============================================================
-- entitlements.attribution: z které reklamy nákup přišel
-- Barna Academy, 1. 9. 2026
--
-- PROČ:
-- Stripe Payment Link propíše do Checkout Session z adresy JEN `client_reference_id`
-- a `prefilled_email`. UTM parametry v odkazu se do session NEDOSTANOU, takže
-- konzultace za 2 990 Kč prodaná z Meta reklamy dorazila do Stripu bez jediné stopy
-- po kampani a nešlo říct, co ji prodalo. Sto procent živého rozpočtu Mety přitom
-- vede na produkty placené přes Stripe.
-- Od 1. 9. 2026 skládá `assets/analytics.js` atribuci do `client_reference_id`
-- (`src-meta_med-cpc_cmp-koucink-warm_cnt-koucink-warm-portret`), edge funkce
-- `academy-stripe-webhook` ji rozebere (`rozdelClientRef`) a uloží sem.
--
-- PROČ PRÁVĚ `entitlements`:
-- Jiná tabulka nákupů na téhle straně neexistuje. `entitlements` je jediný řádek,
-- který o zaplaceném produktu vzniká (`pending_orders` je nedokončený košík
-- SimpleShopu, `webhook_log` je log SimpleShopu, `referrals` jsou jen provize).
--
-- ⛔ ZAPISUJE SE JEN JEDNOU, do prázdné hodnoty (`is null` ve webhooku). Zajímá nás
--    kampaň, která zákazníka PŘIVEDLA. Obnova předplatného ani opakovaný nákup ji
--    nesmí přepsat na „src-direct".
-- ⛔ Hodnoty pocházejí z URL parametrů, tedy od návštěvníka. Webhook proto bere jen
--    čtyři známé klíče (utm_source, utm_medium, utm_campaign, utm_content) a každý
--    krátí na 60 znaků. Nic z toho se nesmí považovat za důvěryhodný vstup.
--
-- Vratnost: aditivní nullable sloupec, nic nepřepisuje, nikomu nic neposílá.
--           Bez něj webhook jen vrátí `atribuce: "chyba:…"` a nákup jede dál.
-- Rollback: alter table public.entitlements drop column attribution;
-- ============================================================

alter table public.entitlements
  add column if not exists attribution jsonb;

comment on column public.entitlements.attribution is
  'Z ktere reklamy nakup prisel. Plni ho academy-stripe-webhook z client_reference_id
   (jedine pole, ktere Stripe Payment Link propise z adresy do Checkout Session).
   Klice: utm_source, utm_medium, utm_campaign, utm_content. ⛔ Zapisuje se jen do
   prazdne hodnoty: zajima nas kampan, ktera zakaznika PRIVEDLA, ne obnova predplatneho.
   ⛔ Zdroj hodnot je URL, tedy navstevnik. Neni to duveryhodny vstup.';

-- Vyhledávání typu „kolik nákupů udělala kampaň X" jde přes klíč uvnitř JSONB.
-- GIN index na `jsonb_path_ops` je na tenhle druh dotazu ten správný a u prázdného
-- sloupce nic nestojí.
create index if not exists entitlements_attribution_idx
  on public.entitlements using gin (attribution jsonb_path_ops)
  where attribution is not null;
