-- ============================================================
-- entitlements.stripe_payment_intent: aby šlo spárovat REFUND jednorázové platby
-- Barna Academy, 29. 7. 2026
--
-- PROČ:
-- Refundová větev `academy-stripe-webhook` páruje platbu se zákazníkem podle
-- `stripe_customer_id`. U PŘEDPLATNÉHO to funguje, protože Stripe zákazníka vždycky
-- založí. U JEDNORÁZOVÉ platby (`mode=payment`) ho ale NEZAKLÁDÁ, takže:
--   • entitlement doživotního člena má `stripe_customer_id = NULL`
--   • událost `charge.refunded` taky žádného zákazníka nenese
--   • ⇒ webhook spadne na první pojistce a vrátí `ignored: "bez-zakaznika"`
-- Následek změřený naostro 29. 7. v 05:01: Martin vrátil peníze a přístup i appka
-- zůstaly udělené. TICHO, žádná chyba, žádný alert.
--
-- ⛔ PROČ SE TO NEŘEŠÍ PÁROVÁNÍM PODLE E-MAILU:
-- Academy a appka Tvůj Coach jedou na JEDNOM Stripe účtu. Kdyby se refund pároval
-- podle e-mailu, vrácení peněz za appku by témuž člověku sebralo Academy za 8 900 Kč.
-- `payment_intent` je naopak identifikátor JEDNÉ KONKRÉTNÍ PLATBY, je na obou stranách
-- (checkout session při nákupu, charge při refundu) a zaměnit se nedá.
--
-- Vratnost: aditivní nullable sloupec, nic nepřepisuje, nikomu nic neposílá.
-- Rollback: alter table public.entitlements drop column stripe_payment_intent;
-- ============================================================

alter table public.entitlements
  add column if not exists stripe_payment_intent text;

-- Refund hledá právě podle téhle hodnoty; bez indexu by to při růstu tabulky
-- znamenalo sekvenční průchod u každé vrácené platby.
create index if not exists entitlements_payment_intent_idx
  on public.entitlements (stripe_payment_intent)
  where stripe_payment_intent is not null;

comment on column public.entitlements.stripe_payment_intent is
  'ID jednorazove platby ze Stripu (pi_...). Slouzi k parovani REFUNDU u variant, kde
   Stripe nezaklada zakaznika (mode=payment). U predplatneho zustava NULL, tam se paruje
   pres stripe_customer_id. ⛔ Podle e-mailu se neparuje nikdy: Academy a appka sdili
   jeden Stripe ucet a refund appky by sebral Academy.';
