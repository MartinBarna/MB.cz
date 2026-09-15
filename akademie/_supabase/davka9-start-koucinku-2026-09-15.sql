-- Dávka 9 (15. 9. 2026): START KOUČINKU jako vlastní sloupec.
--
-- PROČ: `client-remind` dosud o startu klienta nevěděl nic a první výzvu k týdennímu reportu
-- odkládal podle NÁHRADY „nárok mladší než 7 dní" (`client-remind/cerstvy-klient.ts`).
-- `entitlements.granted_at` je ale okamžik kliknutí v adminu, ne den, kdy klient reálně začíná.
-- Klient pozvaný v úterý se startem v neděli tak dostal výzvu k reportu v den startu.
--
-- PROČ TADY a ne do vlastní tabulky: `client-remind` `entitlements` v tomtéž dotazu UŽ ČTE,
-- takže nepřibude žádné další čtení do DB (na Free plánu shazuje brána asi 1,35 % požadavků
-- a každý dotaz navíc je další příležitost k 504). Klíč (email, product) je jednoznačný
-- a řádek existuje pro každého klienta vždy.
--
-- ⛔ Sloupec je `date`, ne `timestamptz`: start je DEN, ne okamžik. Práh se počítá ve dnech,
--    takže se neřeší, v kolik hodin klient „začal", a přechod na zimní čas na tom nic nemění.
-- ⛔ NULL znamená „nezadáno" a náhrada z `granted_at` pro takového klienta platí dál.
--    Prázdný sloupec tedy nikoho neumlčí; chování beze změny je výchozí stav.
--
-- RLS se NEMĚNÍ a měnit se nesmí. `entitlements` má `rowsecurity = true` a jedinou politiku
-- `entitlements_select_own` (SELECT vlastního řádku podle e-mailu z JWT). Nový sloupec dědí
-- práva tabulky. Vědomý důsledek: přihlášený klient si ve svém řádku přečte i svoje `start_at`.
-- Není to citlivý údaj (je to datum, které mu Martin sám řekl) a dnes `entitlements`
-- z prohlížeče nečte žádná stránka klientské sekce.
--
-- Spouští se ručně přes `npx supabase@latest db query --linked --project-ref uhmrpfsdcujbhbtumqye
-- --output-format json --file akademie/_supabase/davka9-start-koucinku-2026-09-15.sql`
-- (nikdy `db push`). MUSÍ proběhnout PŘED deployem `client-remind` a `admin-api`: obě funkce
-- nový sloupec vybírají a bez něj by `select` skončil chybou a mail by nedostal nikdo.

alter table public.entitlements
  add column if not exists start_at date;

comment on column public.entitlements.start_at is
  'Start koučinku (den, kdy klient reálně začíná). Vyplňuje admin: akce client_invite nebo client_start_save. NULL = nezadáno, client-remind padá na náhradu z granted_at.';

-- PostgREST si drží schéma v cache. Bez tohohle vrací nový sloupec chybu
-- „column entitlements.start_at does not exist" ještě pár minut po migraci,
-- takže by funkce spadla i nad hotovou databází.
notify pgrst, 'reload schema';
