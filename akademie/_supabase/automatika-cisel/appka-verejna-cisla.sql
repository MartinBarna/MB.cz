-- ============================================================
-- APPKA Tvuj Coach (projekt kfkmghvhqwqtsalqjmrp)
-- RPC public.verejna_cisla() + cache 6 h
--
-- ⛔ TENHLE SOUBOR SE NEAPLIKUJE Z WORKTREE. Je to podklad pro sefa.
--    Cislo migrace v repu appky si sef vezme az po martin-souhra.
--    Cursor / agent NESMI spoustet tenhle SQL proti zive DB.
--
-- PROC security definer: curated_foods, foods_cache i recipes maji RLS.
--    Anonymni count pres PostgREST by vratil cislo podle politik, ne skutecnost.
--    Funkce nevraci ZADNA data radku, jen sescitana cisla.
--
-- PROC cache + advisory lock: sken ~68 tisic radku se nedele pri kazdem
--    volani landingu. Kdo lock nedostane, vrati starou (stale pravdivou) hodnotu.
--
-- ZAOKROUHLENI je UVNITR, ne u konzumentu:
--    potraviny_zobrazit = dolu na 10 000, vzdy za slovem "pres"
--    recepty_zobrazit   = presne cislo (maily, SPA)
--    recepty_dolu       = dolu na 10 (staticke HTML MB.cz, tydenni prepis)
--
-- to_char FM999G999: oddelovac tisicu zavisi na locale serveru (mezera NEBO
--    carka). Proto replace carky mezerou. Do verejneho textu patri "50 000".
--    Format overit jednorazove: select to_char(50000,'FM999G999');
--    pred naplanovanim cronu. (Zadny test v repu chovani Postgresu nedoklada,
--    format.test.ts meri jen JS pojistku na strane cisla-sync.)
--    Konzument (cisla-sync) proto porovnava PRIMARNE potraviny_raw a zobrazovany
--    tvar si dopocita sam, aby cizi locale nemohlo branu potichu zaseknout.
-- ============================================================

create table if not exists public.verejna_cisla_cache (
  id             boolean primary key default true check (id),
  potraviny_raw  integer not null,
  recepty_raw    integer not null,
  mereno_v       timestamptz not null default now()
);

-- RLS zapnute, ZADNA policy -> primo do tabulky nevidi nikdo krome service_role.
-- Cteni jde vyhradne pres verejna_cisla() (security definer, ta RLS obchazi).
alter table public.verejna_cisla_cache enable row level security;
revoke all on table public.verejna_cisla_cache from anon, authenticated;

comment on table public.verejna_cisla_cache is
  'Jediny radek: namerene pocty potravin a verejnych receptu. Cache 6 h, plni verejna_cisla().';

create or replace function public.verejna_cisla()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
begin
  select * into c from public.verejna_cisla_cache where id;

  -- Prepocitat jen kdyz je zaznam starsi nez 6 h. Advisory lock brani tomu, aby
  -- dva soubezni volajici pustili sken 68 tisic radku najednou; kdo lock nedostane,
  -- vrati starou hodnotu (ta je vzdy pravdiva, jen o par hodin starsi).
  if c is null or c.mereno_v < now() - interval '6 hours' then
    if pg_try_advisory_xact_lock(hashtext('verejna_cisla')) then
      insert into public.verejna_cisla_cache (id, potraviny_raw, recepty_raw, mereno_v)
      values (
        true,
        (select count(distinct lower(btrim(name)))
           from (select name from public.curated_foods
                 union all
                 select name from public.foods_cache) t
          where name is not null and btrim(name) <> ''),
        (select count(*) from public.recipes where is_public),
        now()
      )
      on conflict (id) do update
        set potraviny_raw = excluded.potraviny_raw,
            recepty_raw   = excluded.recepty_raw,
            mereno_v      = excluded.mereno_v;
      select * into c from public.verejna_cisla_cache where id;
    end if;
  end if;

  -- Kdyby cache jeste nebyla a lock jsme nedostali, nevracet null (konsument
  -- by to mohl vylozit jako nulu a zapsat nesmysl). Prazdny objekt = sanity
  -- brana v cisla-sync zapis odmitne a necha starou hodnotu v app_config.
  if c is null then
    return jsonb_build_object('ok', false, 'duvod', 'cache_prazdna');
  end if;

  return jsonb_build_object(
    'potraviny_raw',      c.potraviny_raw,
    -- FM999G999 + replace: viz komentar v hlavicce. Je to pohodli pro konzumenty,
    -- ne zdroj pravdy; cisla-sync si zobrazovany tvar pocita z potraviny_raw sam.
    'potraviny_zobrazit', replace(to_char((c.potraviny_raw / 10000) * 10000, 'FM999G999'), ',', ' '),
    'recepty_raw',        c.recepty_raw,
    'recepty_zobrazit',   c.recepty_raw::text,
    'recepty_dolu',       ((c.recepty_raw / 10) * 10)::text,
    'mereno_v',           c.mereno_v
  );
end $$;

revoke all on function public.verejna_cisla() from public;
grant execute on function public.verejna_cisla() to anon, authenticated, service_role;
