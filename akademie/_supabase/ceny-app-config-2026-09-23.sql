-- ============================================================================
-- CENY PRODUKTŮ ACADEMY PRO MAILY: app_config klíče cena_* (23. 9. 2026)
-- Projekt: Academy uhmrpfsdcujbhbtumqye. Větev fix/ceny-v-mailech-0923.
-- ============================================================================
-- ⛔ KROK 1 ZE TŘÍ (BUILD-ceny-v-mailech.md). Musí běžet PŘED deployem funkcí:
--    nové `drip-send` bere cenu videokurzu (`{{course_price}}`, 147 šablon) odsud,
--    a kdyby tu klíč chyběl, všechny ty maily by čekaly a chodily by alerty.
--    Dokud funkce nejsou nasazené, tyhle klíče nikdo nečte, takže zápis je neškodný.
-- Hodnota = celé číslo v Kč bez mezer. Zdroj pravdy je cena za platebním odkazem
-- ve Stripu (ověřeno v komentářích `academy-stripe-webhook` a na webu 23. 9. 2026).
-- ⛔ Kdo mění cenu ve Stripu, mění i tenhle řádek (checklist tvujcoach-cenik-zmena-checklist).
-- Ceny APPKY (Basic, VIP) sem NEPATŘÍ: maily je čtou živě z `pricing_plans` appky.
-- Idempotentní: existující klíč se NEPŘEPÍŠE; když má jinou hodnotu, skript spadne.
-- ============================================================================
begin;
do $ceny$
declare
  r record;
  hodnota text;
begin
  for r in select * from (values
    ('cena_videokurz', '1490'),            -- videokurz výživy (odkaz ...ks0h)
    ('cena_academy', '8900'),              -- Barna Academy doživotně
    ('cena_academy_mesic', '990'),         -- Barna Academy měsíčně (price_1TyBXT...)
    ('cena_academy_upgrade', '7410'),      -- doživotní Academy pro majitele videokurzu (price_1UGeO7...)
    ('cena_academy_po_odectu', '5930'),    -- doživotní Academy pro měsíčního člena po 3 platbách
    ('cena_konzultace', '2990'),           -- konzultace, videokurz v ceně (plink_1Tyrn5...)
    ('cena_konzultace_sleva', '2190'),     -- konzultace pro majitele videokurzu (plink_1Typhu...)
    ('cena_balicek', '349'),               -- balíček 40 receptů a 48 odpovědí
    ('cena_doplatek_videokurz', '1140')    -- doplatek z balíčku na videokurz (plink_1UAyAO...)
  ) as v(k, h) loop
    insert into public.app_config(key, value) values (r.k, r.h) on conflict (key) do nothing;
    select value into hodnota from public.app_config where key = r.k;
    if hodnota is distinct from r.h then
      raise exception 'app_config.% uz existuje s hodnotou % (ocekavano %). Rozhodni rucne, nic se nezapsalo.', r.k, hodnota, r.h;
    end if;
  end loop;
  raise notice 'HOTOVO: 9 klicu cena_* v app_config';
end
$ceny$;
commit;
