-- ============================================================
-- leads.unsubscribed_at: kdy se člověk odhlásil (do teď se to nedalo zjistit)
-- Barna Academy, 1. 9. 2026
--
-- PROČ:
-- `leads` neměla žádné datum odhlášení. Jediné vodítko byl `updated_at`, jenže ten
-- přepisuje KAŽDÝ hromadný UPDATE nad tabulkou: úklid `next_send_at`, import,
-- přepnutí tratě, most mezi tratěmi. Revize mailingu 1. 9. 2026 z něj vyčetla
-- 14 odhlášení za den, kdy se ve skutečnosti neodhlásil nikdo, a málem to tak
-- i napsala. Druhý zdroj (`crm_consents.withdrawn_at`) končí 19. 8., protože
-- od té doby neběžel CRM synk.
-- Důsledek: nikdo neuměl říct, jestli databázi frekvencí pálíme, nebo ne. Přitom
-- při 10 až 14 mailech měsíčně u 445 lidí je to jediné číslo, které rozhoduje,
-- jestli tu kanál za rok ještě bude.
--
-- CO SLOUPEC ZNAMENÁ (a co ne):
--   * plní ho edge funkce `unsubscribe` při PRVNÍM odhlášení (tlačítko v patičce
--     i One-Click z mailového klienta). Opakovaný klik datum nepřerazítkuje.
--   * plní ho `resend-webhook` u stížnosti na spam (`complaint`): je to taky
--     odhlášení, jen přišlo přes poštovní schránku.
--   * ⛔ NEPLNÍ se u `bounce`. Mrtvá adresa není rozhodnutí člověka a smíchat obojí
--     do jednoho čísla by odhlášení nafouklo.
--   * ⛔ NEPLNÍ ho `admin-api` (ruční odhlášení Martinem z admin panelu) ani větev
--     v `drip-send`, která vrací zpátky mezi odhlášené kupce, co se odhlásili dřív.
--     Doplnit v `admin-api` řádek 498 (`update leads`) o `unsubscribed_at`, jakmile
--     na tu funkci bude sahat někdo jiný; do té doby jsou taková odhlášení bez data
--     a v měřicím dotazu chybí. Ruční odhlášení jich je pár, ale číslo je proto
--     dolní odhad, ne úplný počet.
--
-- Vratnost: aditivní nullable sloupec, nic nepřepisuje, nikomu nic neposílá.
--           Bez nasazené funkce `unsubscribe` zůstane prostě prázdný.
-- Rollback: alter table public.leads drop column unsubscribed_at;
--
-- ⏰ NAVAZUJE (nedělá tenhle soubor): `crm-refresh.sql` řádek 509 bere datum
--    odvolání souhlasu z `coalesce(l.updated_at, now())`, tedy z toho samého
--    kontaminovaného zdroje. Až se CRM synk zase rozjede, má číst `unsubscribed_at`.
-- ============================================================

alter table public.leads add column if not exists unsubscribed_at timestamptz;

comment on column public.leads.unsubscribed_at is
  'Kdy se člověk odhlásil z mailingu. Plní `unsubscribe` (tlačítko i One-Click) a `resend-webhook` u stížnosti na spam. NEplní se u bounce ani u ručního odhlášení z admin panelu. `updated_at` na tohle použít NELZE, přepisuje ho každý hromadný UPDATE.';

-- Odhlášení se hledá podle data, ne podle leada. Částečný index drží velikost dole
-- (odhlášených je zlomek tabulky) a stačí na měsíční číslo i na okno 7 dní.
create index if not exists leads_unsubscribed_at_idx
  on public.leads (unsubscribed_at)
  where unsubscribed_at is not null;
