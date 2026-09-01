-- ============================================================
-- BEZPECNOST 1. 9. 2026: storage politiky bucketu client-docs
-- prestavaji skladat LIKE vzor z e-mailu
-- ------------------------------------------------------------
-- Proc: v LIKE je `_` zastupny znak pro jeden libovolny znak a `%`
-- pro libovolny retezec. Puvodni vzor
--     name LIKE lower(auth.jwt() ->> 'email') || '/%'
-- tedy u klienta `jan_novak@seznam.cz` vyhovi i ceste
-- `janXnovak@seznam.cz/fotky/...`. V bucketu client-docs lezi fotky
-- promeny, tedy to nejcitlivejsi, co v systemu je.
--
-- Stav pri psani migrace (zmereno 1. 9. 2026): ze 73 uctu v auth.users
-- nema podtrzitko ani jeden, takze to je SPICI vada, ne zivy unik.
-- Otevre ji prvni klient s podtrzitkem v adrese a nikdo si toho
-- nevsimne, protoze se nic nerozbije.
--
-- Oprava: porovnavat rovnosti na prvni segment cesty
-- (`split_part(name, '/', 1)`), coz zadny zastupny znak nezna.
-- Zamer politik se NEMENI:
--   * client_docs_read           = klient cte svou slozku, koucinkovy
--                                  klient navic shared/
--   * client_docs_upload_own_photos = klient nahrava jen do
--                                  <svuj e-mail>/fotky/<neco>
-- Navic pribyla pojistka na prazdny e-mail v JWT: puvodni vzor
-- `'' || '/%'` = `'/%'` propoustel cesty zacinajici lomitkem.
--
-- Idempotentni (drop policy if exists + create policy), nic nemaze
-- data ani objekty.
--
-- Overeni PO aplikaci (pod KLIENTSKYM uctem, ne pod adminem, past
-- feedback-rls-branu-netestuj-na-adminovi):
--   1) klient otevre /akademie/klient/ a vidi svoje fotky,
--   2) select policyname, qual, with_check from pg_policies
--      where schemaname='storage' and policyname like 'client_docs%';
-- ============================================================

-- ---------- ctecí politika ----------
DROP POLICY IF EXISTS client_docs_read ON storage.objects;
CREATE POLICY client_docs_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-docs'
    AND (
      -- shared/ jen pro koucinkove klienty (beze zmeny proti 7/2026)
      (name LIKE 'shared/%' AND public.has_entitlement('coaching'))
      OR (
        COALESCE(auth.jwt() ->> 'email', '') <> ''
        AND split_part(name, '/', 1) = lower(auth.jwt() ->> 'email')
      )
    )
  );

-- ---------- zapisova politika ----------
DROP POLICY IF EXISTS client_docs_upload_own_photos ON storage.objects;
CREATE POLICY client_docs_upload_own_photos ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-docs'
    AND COALESCE(auth.jwt() ->> 'email', '') <> ''
    AND split_part(name, '/', 1) = lower(auth.jwt() ->> 'email')
    AND split_part(name, '/', 2) = 'fotky'
    -- puvodni vzor `.../fotky/%` vyzadoval aspon jeden znak za lomitkem
    AND split_part(name, '/', 3) <> ''
  );
