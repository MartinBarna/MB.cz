-- NÁVRH. Nespouštět. Žádnou migraci neaplikovat.
--
-- CHECK na public.poukazy.vzhled, ať sloupec drží jen kanonické hodnoty,
-- které zapisuje poukaz-vydat (normalizeVzhledForStorage):
--   tmava | svetla | slavnostni
-- Syrové Stripe tvary (tmavzlat, svtlnatisk, slavnostn) sem nepatří —
-- funkce je před insertem překládá. Prázdný řetězec taky ne.
--
-- Před ostrým během ověř existující řádky:
--   SELECT vzhled, count(*) FROM public.poukazy GROUP BY 1;
-- Kdyby tam bylo '' nebo syrový Stripe tvar, ALTER by spadl na starých
-- řádcích; insert nových by dál prošel, funkce defaultuje na tmava.

ALTER TABLE public.poukazy
  ADD CONSTRAINT poukazy_vzhled_check
  CHECK (vzhled = ANY (ARRAY['tmava'::text, 'svetla'::text, 'slavnostni'::text]));
