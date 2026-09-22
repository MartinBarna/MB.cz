-- =============================================================================
-- KONEC KOUČINKU: razítko proti duplicitě (22. 9. 2026)
--
-- ⛔ SPUSTIT PŘED DEPLOYEM funkce `koucink-konec`. Funkce si řádek REZERVUJE
--    ještě před tím, než cokoli zavře nebo odešle, a bez unikátního indexu by ta
--    rezervace nic neznamenala: dva běhy by vložily dva řádky a oba by poslaly
--    rozloučení. Martin 17. 9. 2026: „raději nikdy mail navíc."
--
-- PROČ RAZÍTKO NEMŮŽE STÁT NA `entitlements`
-- Nabízelo by se poznat „už jsem ho zavřel" podle `active = false`. Nejde to ze
-- dvou stran zároveň:
--   1. `active = false` nastaví i RUČNÍ odchod z admina, který mail poslal sám;
--      automat by neměl jak poznat, že se rozloučení už stalo.
--   2. Jakmile nárok zhasne, VYPADNE z výběru automatu. Kdyby po tom selhalo
--      odeslání, člověk by zůstal zavřený bez rozloučení a nikdo by se to nedozvěděl.
-- ⇒ Frontu práce řídí TAHLE tabulka, ne nárok. Stav `opakovat` je jediné místo,
--   podle kterého se běh vrací k rozdělané práci.
--
-- ⛔ KLÍČ JE E-MAIL, NE DATUM. `entitlements` nemá vlastní `id` (klíč je dvojice
--    email + product), takže e-mail JE identita té události. Klíč odvozený z času
--    („jednou za den stačí") by vyrobil tichou chybu oběma směry
--    [[feedback-klic-idempotence-nesmi-byt-z-casu]].
--    Důsledek, který je třeba znát: kdo se po roce vrátí jako klient a znovu
--    skončí, MUSÍ mít starý řádek smazaný, jinak ho automat podruhé nezavře.
--    Dělá to `client_invite` (viz `admin-api`), ať na to nikdo nemusí myslet.
--
-- STAVY (sloupec `stav`)
--   rezervovano   právě se zpracovává; nikdo jiný na něj nesmí
--   hotovo        doběhlo (mail odešel, nebo se vědomě neposílal)
--   opakovat      nic nedokončeného nezůstalo viset, další běh to zkusí znovu
--   chyba_nejiste mail MOHL odejít; automat to NEOPAKUJE, rozhodne člověk
--
-- Spouští se ručně přes MCP apply_migration v DB Academy (uhmrpfsdcujbhbtumqye).
-- =============================================================================

create table if not exists public.koucink_konec_sent (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  stav text not null default 'rezervovano',
  -- Jednorázový promo kód na roční VIP. Ukládá se HNED po založení ve Stripu,
  -- ať se po opakování nezakládá druhý a první tam nezůstane viset nepoužitý.
  promo_code text,
  -- Měl v okamžiku zavírání zaplacenou Academy? Podle toho se lišil i text mailu,
  -- takže bez tohohle sloupce nejde zpětně říct, co přesně klient dostal.
  ma_academy boolean,
  duvod text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  -- false = řádek existuje, ale odeslání se neprokázalo (přeskočeno bránou,
  -- nebo skončilo v nejistotě). Stejná sémantika jako `client_remind_sent.sent_ok`.
  sent_ok boolean
);

-- ⛔ ÚPLNÝ unikátní index NAD SLOUPCEM, ne partial a ne nad výrazem. Dva důvody:
--    1. `client_remind_sent` má partial index a stálo to tam za komentář:
--       `on conflict` ho Postgres bez zopakované podmínky nedovodí (42P10)
--       a PostgREST podmínku poslat neumí. Tady žádná výjimka není.
--    2. NAD `lower(email)` BY TO TAKY NEŠLO: `admin-api` dělá
--       `upsert(..., { onConflict: "email" })`, a to se na funkcionální index
--       nenaváže. Adresy se do téhle tabulky zapisují už malými písmeny (`low()`
--       ve `admin-api`, `low()` v `koucink-konec`), takže prostý sloupec stačí.
create unique index if not exists koucink_konec_sent_email_unique
  on public.koucink_konec_sent (email);

create index if not exists koucink_konec_sent_stav_idx
  on public.koucink_konec_sent (stav);

comment on table public.koucink_konec_sent is
  'Razitko automatu konec koucinku. Radek vznika PRED prvnim nevratnym krokem; stav opakovat = fronta na dalsi beh.';
comment on column public.koucink_konec_sent.stav is
  'rezervovano | hotovo | opakovat | chyba_nejiste';
comment on column public.koucink_konec_sent.sent_ok is
  'false = odeslani se neprokazalo (brana skip, nebo nejistota). Mail se NEOPAKUJE, resi to Martin.';

-- Automat běží service-rolí a musí umět razítko i MAZAT (návrat klienta).
grant select, insert, update, delete on table public.koucink_konec_sent to service_role;

-- ⛔ Tabulka drží e-maily zákazníků. Bez RLS by ji přečetl kdokoli s veřejným
--    klíčem [[feedback-zalozni-tabulka-bez-rls-je-verejna]]. Žádná politika se
--    schválně nezakládá: z prohlížeče se k ní nikdo dostat nemá, jedinou cestou
--    je service-role (automat a admin-api).
alter table public.koucink_konec_sent enable row level security;

-- -----------------------------------------------------------------------------
-- Konfigurace. ⛔ VŠECHNO VYPNUTÉ A PRÁZDNÉ. Nasazení nesmí samo o sobě začít
--    lidem zavírat přístup; zapnutí je vlastní, viditelný krok Martina.
-- ⛔ `koucink_vip_coupon_id` doplní Martin AŽ POTÉ, co kupón založí ve Stripu.
--    Prázdná hodnota znamená, že promo kód nevznikne, mail neodejde a přijde
--    alert. To je záměr: mail, který slíbí slevu bez funkčního kódu, je horší
--    než mail, který nedorazil.
-- -----------------------------------------------------------------------------
insert into public.app_config (key, value)
values
  ('koucink_konec_enabled', 'false'),
  ('koucink_konec_grace_dny', '7'),
  ('koucink_konec_optout', ''),
  ('koucink_vip_coupon_id', '')
on conflict (key) do nothing;

-- Kontrola po zásahu (čekám tabulku, unikátní index, RLS a 4 řádky konfigurace):
--   select indexname, indexdef from pg_indexes where tablename = 'koucink_konec_sent';
--   select relrowsecurity from pg_class where relname = 'koucink_konec_sent';
--   select key, value from public.app_config where key like 'koucink_%' order by key;
--
-- Návrat:
--   drop table if exists public.koucink_konec_sent;
--   delete from public.app_config
--    where key in ('koucink_konec_enabled','koucink_konec_grace_dny','koucink_konec_optout','koucink_vip_coupon_id');
