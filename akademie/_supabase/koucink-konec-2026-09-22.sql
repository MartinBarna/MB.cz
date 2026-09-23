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
-- ⛔⛔ DVA NEZÁVISLÉ SLOUPCE, NE JEDEN PŘETÍŽENÝ (revize R4).
--    `stav` odpovídá na otázku „co má automat dělat dál",
--    `mail_stav` na otázku „co se stalo s rozloučením".
--    Do R4 to nesl jeden boolean `sent_ok` plus dva zvláštní stavy práce
--    (`opakovat_mail`, `chyba_nejiste`), takže tatáž hodnota `false` znamenala
--    jednou „jistě neodešlo, pošli znovu" a podruhé „mohl odejít, neposílej".
--    Rozlišoval je stav práce, a jakmile ten z jakéhokoli důvodu zmizel
--    (pád běhu, selhaný zápis), význam `false` se tiše převrátil: buď se
--    ztratilo rozloučení, které jistě nedošlo, nebo naopak odešel druhý mail.
--
-- STAVY PRÁCE (sloupec `stav`)
--   rezervovano  právě se zpracovává; nikdo jiný na něj nesmí
--   opakovat     další běh to zkusí znovu
--   hotovo       automat s tímhle člověkem skončil
--   vzdano       vyčerpaný strop pokusů; automat se o to už nepokouší
--
-- STAVY MAILU (sloupec `mail_stav`)
--   neposlano  nikdy se nezkoušelo
--   posilam    razítko PŘED voláním Resendu. ⛔ Když se TENHLE zápis nepovede,
--              Resend se NEVOLÁ. A když se nepovede zápis VÝSLEDKU, řádek v něm
--              zůstane; po 30 minutách se čte jako `nejiste`, takže druhý mail
--              z toho nevznikne nikdy.
--   odmitnuto  Resend zásilku VÝSLOVNĚ odmítl (4xx, chybějící klíč). Mail jistě
--              neodešel, takže se smí poslat znovu.
--   nejiste    5xx, `sit:`, nebo `posilam` starší než 30 minut bez výsledku.
--              Mail MOHL odejít. ⛔ Automat NEPOSÍLÁ, rozhoduje člověk
--              (Martin 17. 9. 2026: „raději nikdy mail navíc").
--   odeslano   Resend zásilku přijal a máme `provider_id`. ⛔ Bez id se tenhle
--              stav NEZAPISUJE: odeslání, které nejde doložit, je `nejiste`.
--
-- ⛔ `pokusy` a `vzdano` (nález S4): fronta `opakovat` neměla strop. Trvale špatný
--    kupón nebo mrtvý Resend by znamenal donekonečna opakovaný pokus a u promo kódu
--    i nové a nové kódy ve Stripu.
--
-- ⛔ `updated_at` (nález V2): podle něj se pozná ZASEKNUTÁ rezervace. Když edge funkci
--    zabije timeout cronu (120 s) nebo strop běhu, `catch` v kódu se neprovede a řádek
--    zůstane v `rezervovano` NAVŽDY. Další běh takového člověka jen přeskočil jako
--    „má ho někdo jiný". Rezervace starší než 30 minut se proto bere jako opuštěná.
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
  -- Kolikrát se automat o tohohle člověka pokusil. Strop drží kód (`MAX_POKUSU`),
  -- po něm stav `vzdano` a alert. Bez počítadla nemá fronta `opakovat` konec.
  pokusy integer not null default 0,
  created_at timestamptz not null default now(),
  -- ⛔ ZAPISUJE HO KÓD PŘI KAŽDÉ ZMĚNĚ STAVU, žádný trigger. Podle něj se pozná
  --    zaseknutá rezervace; kdyby ho aktualizoval jen `created_at`, opuštěný řádek
  --    by se po první změně stavu tvářil jako čerstvý.
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  -- ⛔ ODVOZENINA z `mail_stav`, ne zdroj pravdy (revize R4). Zůstává jen proto,
  -- aby se v SQL dalo rychle filtrovat „komu rozloučení prokazatelně odešlo",
  -- a rovná se `mail_stav = 'odeslano'`. NIC se podle ní nerozhoduje.
  sent_ok boolean,
  -- Co se stalo s rozloučením. Zdroj pravdy, viz hlavička souboru.
  mail_stav text not null default 'neposlano',
  -- ID zásilky u Resendu. ⛔ Bez něj se `mail_stav = 'odeslano'` nezapisuje
  -- (revize R5, N6): odeslání, které nejde doložit ani spárovat s bouncem,
  -- je nejistota, ne úspěch.
  provider_id text
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

-- ⛔ Dohledání lidí, kterým rozloučení chybí nebo skončilo v nejistotě. Je to
--    první dotaz, který Martin potřebuje, když se něco pokazí.
create index if not exists koucink_konec_sent_mail_stav_idx
  on public.koucink_konec_sent (mail_stav);

-- ⛔⛔ SLOUPCE SE DOPLŇUJÍ I ZVLÁŠŤ (revize R2, nález N8). `create table if not
--    exists` na existující tabulce NIC nepřidá, takže kdyby v DB už ležela verze
--    z dřívějšího spuštění (bez `pokusy` a `updated_at`), migrace by prošla,
--    `comment on column` níž by spadl na chybějícím sloupci a automat by se
--    o zaseknuté rezervace ani o strop pokusů neopřel.
--    ⚠️ `add column if not exists` je levný no-op, když sloupce existují.
alter table public.koucink_konec_sent
  add column if not exists pokusy integer not null default 0;
alter table public.koucink_konec_sent
  add column if not exists updated_at timestamptz not null default now();
alter table public.koucink_konec_sent
  add column if not exists promo_code text;
alter table public.koucink_konec_sent
  add column if not exists ma_academy boolean;
alter table public.koucink_konec_sent
  add column if not exists duvod text;
alter table public.koucink_konec_sent
  add column if not exists sent_at timestamptz;
alter table public.koucink_konec_sent
  add column if not exists sent_ok boolean;
alter table public.koucink_konec_sent
  add column if not exists mail_stav text not null default 'neposlano';
alter table public.koucink_konec_sent
  add column if not exists provider_id text;

comment on table public.koucink_konec_sent is
  'Razitko automatu konec koucinku. Radek vznika PRED prvnim nevratnym krokem; stav opakovat = fronta na dalsi beh.';
comment on column public.koucink_konec_sent.stav is
  'CO MA AUTOMAT DELAT: rezervovano | opakovat | hotovo | vzdano. O mailu nerika nic, ten ma vlastni sloupec.';
comment on column public.koucink_konec_sent.mail_stav is
  'CO SE STALO S ROZLOUCENIM: neposlano | posilam | odmitnuto (jiste neodeslo, smi se poslat znovu) | nejiste (mohl odejit, automat NEPOSILA) | odeslano. Radek, ktery uvizne v posilam, se po 30 minutach cte jako nejiste.';
comment on column public.koucink_konec_sent.pokusy is
  'Kolikrat se automat pokusil. Po MAX_POKUSU stav vzdano a alert Martinovi.';
comment on column public.koucink_konec_sent.updated_at is
  'Posledni zmena stavu. Rezervace starsi nez 30 minut se bere jako opustena.';
comment on column public.koucink_konec_sent.sent_ok is
  'ODVOZENINA z mail_stav (= mail_stav to odeslano). Nic se podle ni nerozhoduje, je jen na rychle filtrovani v SQL.';

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

-- ⛔ DOČIŠTĚNÍ PO STARŠÍ VERZI (kdyby tabulka z doby před R4 už v DB ležela).
--    Převede starý přetížený zápis na nové sloupce. Na čerstvé tabulce je to no-op.
--    ⚠️ `opakovat_mail` a `chyba_nejiste` jako hodnoty `stav` od R4 neexistují.
-- ⛔⛔ PŘEVOD JE ÚZKÝ A DRUHÉ SPUŠTĚNÍ JE NO-OP (revize R5, nález S5).
--    Předchozí verze měla větev `sent_ok is false then 'nejiste'`. Jenže
--    `sent_ok: false` psal starý kód i u vědomého neposlání (tichý odchod,
--    brána, `zavren_jinde`, `znovu_klient`), a z těch by se stala NEJISTOTA,
--    tedy stav, který admin chce potvrzovat a na kterém tlačítko jde „jen
--    doposlat". Nový kód navíc píše `hotovo` + `neposlano` + `sent_ok: false`
--    sám, takže druhé spuštění by překlopilo i čerstvé řádky.
--    ⇒ Převádí se JEN to, co nese starý význam JEDNOZNAČNĚ:
--      `sent_ok is true`      → `odeslano` (prokázané odeslání),
--      `stav = opakovat_mail` → `odmitnuto` (jisté neodeslání),
--      `stav = chyba_nejiste` → `nejiste` (mohl odejít).
--    Všechno ostatní zůstává `neposlano`. Po převodu už žádný řádek nesplní
--    WHERE (buď má jiný `mail_stav`, nebo už nemá starý `stav`), takže druhý
--    běh nezmění nic.
update public.koucink_konec_sent
   set mail_stav = case
         when sent_ok is true then 'odeslano'
         when stav = 'opakovat_mail' then 'odmitnuto'
         when stav = 'chyba_nejiste' then 'nejiste'
         else mail_stav
       end
 where mail_stav = 'neposlano'
   and (sent_ok is true or stav in ('opakovat_mail', 'chyba_nejiste'));

update public.koucink_konec_sent
   set stav = case when stav = 'opakovat_mail' then 'opakovat' else 'hotovo' end
 where stav in ('opakovat_mail', 'chyba_nejiste');

-- ⛔ CHECK NA HODNOTY `mail_stav` (revize R6, nález N1). Bez něj by překlep
--    nebo ruční zásah v DB prošel a kód by ho musel hádat. Kód neznámou
--    hodnotu čte jako `nejiste` (neposílá), ale DB ji rovnou nepustí.
--    Jde AŽ PO převodu výš, aby staré řádky měly platné hodnoty.
--    Idempotentní: druhé spuštění constraint najde a nic nedělá.
--    ⛔ Bez `not valid`: když v tabulce leží neplatná hodnota, migrace MÁ
--    spadnout nahlas, ne constraint tiše přeskočit starý obsah.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'koucink_konec_sent_mail_stav_hodnoty'
       and conrelid = 'public.koucink_konec_sent'::regclass
  ) then
    alter table public.koucink_konec_sent
      add constraint koucink_konec_sent_mail_stav_hodnoty
      check (mail_stav in ('neposlano', 'posilam', 'odmitnuto', 'nejiste', 'odeslano'));
  end if;
end
$$;

-- Kontrola po zásahu (čekám tabulku, unikátní index, RLS a 4 řádky konfigurace):
--   select indexname, indexdef from pg_indexes where tablename = 'koucink_konec_sent';
--   select relrowsecurity from pg_class where relname = 'koucink_konec_sent';
--   select key, value from public.app_config where key like 'koucink_%' order by key;
--   select column_name from information_schema.columns
--    where table_schema='public' and table_name='koucink_konec_sent' order by ordinal_position;
--   (cekam mimo jine `pokusy` a `updated_at`)
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.koucink_konec_sent'::regclass and contype = 'c';
--   (cekam `koucink_konec_sent_mail_stav_hodnoty` s peti hodnotami)
--
-- Návrat:
--   drop table if exists public.koucink_konec_sent;
--   delete from public.app_config
--    where key in ('koucink_konec_enabled','koucink_konec_grace_dny','koucink_konec_optout','koucink_vip_coupon_id');
