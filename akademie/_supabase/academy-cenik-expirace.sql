-- ============================================================================
-- Barna Academy: hybridní ceník (990 Kč/měs + 8 900 doživotně)
-- Zavádí expiraci členství. NULL = doživotní, takže se nic stávajícího nemění.
--
-- Kontext a rozhodnutí: paměť `mb-academy-pricing-mise`.
-- Psáno 28. 7. 2026, ověřeno proti živé DB projektu uhmrpfsdcujbhbtumqye.
--
-- ⚠️ POŘADÍ JE ZÁVAZNÉ. Krok 2 musí proběhnout hned po kroku 1, jinak by mezi
--    nimi byla chvíle, kdy sloupec existuje, ale brána ho ignoruje.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) Sloupec expirace
-- ---------------------------------------------------------------------------
-- NULL = doživotní přístup. Všech 449 stávajících řádků zůstane NULL, takže
-- se pro nikoho z nich nemění vůbec nic. Nedestruktivní, jde vrátit dropem.
alter table public.entitlements
  add column if not exists expires_at timestamptz;

comment on column public.entitlements.expires_at is
  'Konec přístupu. NULL = doživotní (SimpleShop 8 900, koučink, ruční grant). '
  'Vyplněné = předplatné (source=stripe-monthly), obnovuje ho academy-stripe-webhook '
  'při každé invoice.paid. Kdo čte entitlements service_rolem, MUSÍ expiraci řešit sám, '
  'RLS ho nechrání.';

-- Index kvůli hlídání a win-back dotazům (kdo vypršel a má dostat nabídku obnovy).
create index if not exists entitlements_expires_at_idx
  on public.entitlements (expires_at)
  where expires_at is not null;

-- ---------------------------------------------------------------------------
-- 2) Brána do studia
-- ---------------------------------------------------------------------------
-- ⛔ TATO FUNKCE JE JEDINÁ BRÁNA. Ověřeno v pg_proc 28. 7.: existuje v JEDINÉ
--    variantě `has_entitlement(text)`, takže `create or replace` se stejnou
--    signaturou ji opravdu nahradí a nevyrobí druhou vedle.
--    Past s přetíženými funkcemi: paměť `feedback-create-or-replace-neni-nahrada`.
--
-- Prochází přes ni všech PĚT RLS politik:
--    lesson_content.lesson_content_member_read      (SELECT)
--    progress.progress_write_own                    (INSERT)
--    videokurz_manifest.videokurz_manifest_read     (SELECT)
--    storage.objects.vk_materials_read              (SELECT, videokurz-materialy)
--    storage.objects.client_docs_read               (SELECT, client-docs)
-- a ŠESTOU cestou je edge funkce `ai-martin`, která ji volá přes RPC
-- s tokenem uživatele. Tím je pokrytá i ona.
--
-- Zachováno beze změny: videokurz je odemčený i držitelům 'academy' a 'coaching'
-- (mají ho v ceně). Důsledek je žádoucí: když vyprší měsíční Academy, zamkne se
-- správně i videokurz.
create or replace function public.has_entitlement(p_product text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.entitlements
    where lower(email) = lower(auth.jwt() ->> 'email')
      and active = true
      and (expires_at is null or expires_at > now())
      and (product = p_product or (p_product = 'videokurz' and product in ('academy','coaching')))
  );
$function$;

commit;

-- ============================================================================
-- OVĚŘENÍ PO MIGRACI (spustit, nespoléhat na to, že „migrace prošla")
-- ============================================================================
-- a) Změna se dostala do TÉ funkce, kterou kód opravdu volá:
--      select pg_get_functiondef(oid) from pg_proc where proname='has_entitlement';
--    Musí vrátit PRÁVĚ JEDEN řádek a obsahovat 'expires_at'.
--
-- b) Nikomu stávajícímu se nic nezměnilo (čekáme 0):
--      select count(*) from entitlements where expires_at is not null;
--
-- c) Živý test zamčení. ⚠️ Dělat na TESTOVACÍM e-mailu, ne na členovi:
--      insert into entitlements (email, product, active, source, expires_at)
--      values ('fitness.barna+expirace@gmail.com','academy',true,'test', now() - interval '1 day');
--    Přihlásit se tím účtem do studia -> lekce NESMÍ jít otevřít.
--    Pak řádek smazat:
--      delete from entitlements where email='fitness.barna+expirace@gmail.com' and source='test';
--
-- d) Skutečný člen se pořád dostane dovnitř (Martinův Chrome, otevřít lekci).
-- ============================================================================
