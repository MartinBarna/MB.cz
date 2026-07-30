-- Dotazník před konzultací (30. 7. 2026). Formulář na /konzultace/dotaznik/ → edge fn
-- `intake-capture` → tahle tabulka + alert Martinovi s vypsanými odpověďmi.
-- Vzor je `withdrawals` + `checkins`, žádná nová mechanika.
--
-- ⛔⛔ ŽÁDNÉ ZDRAVOTNÍ POLE. Rozhodnuto vědomě: údaje o zdraví jsou podle GDPR zvláštní
-- kategorie, a ukládat je do tabulky je jiná liga než probrat je na hovoru (potřebovalo by
-- vlastní právní základ, výslovný souhlas, zmínku v zásadách, retenci a šifrované doručení).
-- Zdraví se řeší NA HOVORU. Martinův ruční dotazník tohle pole měl, tady záměrně není.
-- Kdo ho sem bude chtít doplnit, musí nejdřív otevřít zásady ochrany osobních údajů, ne kód.
create table if not exists public.consultation_intake (
  id            bigint generated always as identity primary key,
  email         text not null,
  created_at    timestamptz not null default now(),
  goal          text,          -- Čeho chceš dosáhnout?
  tried_before  text,          -- Co už jsi zkoušel(a)?
  typical_day   text,          -- Jak vypadá tvůj běžný den (jídlo, práce, rodina)
  work_shifts   text,          -- Práce a směny
  sleep_hours   text,          -- Kolik hodin průměrně spíš (text, ať jde napsat „6 až 7")
  activity      text,          -- Jaký pohyb teď děláš a kolikrát týdně
  weight_kg     numeric,       -- ranní váha
  measurements  text,          -- pas a boky, volitelné
  note          text,          -- Co bych měl vědět předem
  ip            text           -- kvůli rate limitu, stejně jako u withdrawals
);

-- Martin si odpovědi čte v mailu; dotaz do DB je záloha a případný podklad pro admin sekci.
create index if not exists consultation_intake_email_idx
  on public.consultation_intake (email, created_at desc);

-- ⛔ Jen server (service_role). Žádná politika = přes anon klíč se sem nikdo nedostane,
-- ani čtením. Formulář zapisuje výhradně přes edge funkci se service-role klíčem.
alter table public.consultation_intake enable row level security;
