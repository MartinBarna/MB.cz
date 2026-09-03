-- ============================================================
-- KOUČINK PŘES STRIPE (2. 9. 2026, rozhodnutí Martina)
--
-- Do teď se koučink neprodával přes Stripe vůbec: všech 18 nároků `product='coaching'`
-- založil ručně admin a ANI JEDEN neměl expiraci. Od teď jde Gold i Diamond koupit
-- rovnou z `/koucing/` na 1, 3 nebo 6 měsíců, takže nárok musí umět dvě nové věci:
-- vědět, KTERÝ balíček to je, a KDY zaplacené období končí.
--
-- ⛔ PROČ NE NOVÝ `product`: `product='coaching'` je přístupový klíč na pěti nezávislých
--    místech (RPC `has_entitlement` v klientské sekci, `assets/ai-martin.js`, dlaždice
--    v adminu, fail-closed pojistka v `set_access`, offboard automat). Hodnota jako
--    `coaching_gold` by klienta z klientské sekce i od AI Martina vyhodila a pojistky
--    by ho přestaly vidět. Balíček proto žije jako METADATA vedle `coaching`.
--
-- ⚠️ `has_entitlement` už dnes čte `expires_at is null or expires_at > now()`, takže
--    zaplacené období vyprší samo a nic dalšího se kvůli tomu měnit nemusí.
--
-- Spustit v SQL editoru Academy (uhmrpfsdcujbhbtumqye). Idempotentní.
-- ============================================================

alter table public.entitlements
  add column if not exists plan text,
  add column if not exists months smallint,
  -- Diamond NOVÉHO klienta: po 3 zaplacených měsících mu Academy zůstává napořád.
  -- ⛔ Je to POUZE PŘÍZNAK pro Martina, žádný automat nic nepřidělí. Kdo z něj chce
  --    udělat automat, musí nejdřív vyřešit, co znamená „3 zaplacené měsíce" u člověka,
  --    který koupil 1 + 1 + 1 s pauzou mezi tím.
  add column if not exists academy_po_3m boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'entitlements_plan_check'
  ) then
    alter table public.entitlements
      add constraint entitlements_plan_check
      check (plan is null or plan in ('gold', 'diamond'));
  end if;
end$$;

comment on column public.entitlements.plan is
  'Balíček koučinku: gold | diamond. U jiných produktů null.';
comment on column public.entitlements.months is
  'Délka zaplaceného období koučinku v měsících (1, 3, 6). U ručních grantů null.';
comment on column public.entitlements.academy_po_3m is
  'Diamond nového klienta: po 3 zaplacených měsících mu Academy zůstává napořád. Jen příznak, ne automat.';

-- Dnešní klienti jsou Gold. ⛔ Bez tohohle by `plan is null` znamenal zároveň „historický
-- Gold" i „nevíme", a admin by u nich ukazoval prázdno místo balíčku, který si koupili.
-- (Diamond klienty, pokud mezi nimi jsou, přepíše Martin ručně; víme to jen z mailů.)
-- ⚠️ Omezeno datem SCHVÁLNĚ (nález revize): bez něj by opakované spuštění po startu
-- prodeje označilo jako Gold i pozdější ruční nárok, který balíček zatím nemá.
update public.entitlements
   set plan = 'gold'
 where product = 'coaching' and plan is null
   and granted_at < timestamptz '2026-09-03 00:00:00+02';

-- --- PROVIZE Z KOUČINKU: CHECK v `referrals` o koučinku neví -----------------
-- ⛔⛔ Bez tohohle se provize NIKDY nezapíše. Živý constraint zná jen
--    academy | videokurz | balicek | konzultace | appka, takže insert po zaplaceném
--    koučinku spadne, `atribuujReferral` chybu převede na alert a partner o peníze
--    tiše přijde. Čtyři aktivní partneři mají sazbu 0,20, takže u Diamondu
--    na 6 měsíců jde o 11 900 Kč z jednoho prodeje.
-- ⚠️ Jestli se provize z koučinku vyplácet má a v jaké výši, rozhoduje Martin.
--    Tahle migrace jen umožňuje zápis.
-- ⭐ ROZHODNUTO 3. 9. 2026: z koučinku je provize 10 %, NE sazba partnera z
--    `referral_codes`. Číslo leží v `app_config` pod klíčem `provize_koucink`
--    (migrace `provize-koucink.sql`), webhook ho čte přes `_shared/provize.ts`.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'referrals_product_check') then
    alter table public.referrals drop constraint referrals_product_check;
  end if;
  alter table public.referrals
    add constraint referrals_product_check
    check (product in ('academy', 'videokurz', 'balicek', 'konzultace', 'appka', 'coaching'));
end$$;

-- --- KAPACITA: kolik míst je obsazených a kolik zbývá ------------------------
-- Čte se z prodejní strany `/koucing/`, aby se „Koupit hned" schovalo, když je plno.
-- ⛔ Vrací JEN tři čísla, žádné e-maily. Grant je pro `anon`, takže cokoli navíc
--    v návratové hodnotě by bylo zveřejnění klientských dat.
--
-- ⛔⛔ CO SE POČÍTÁ ZA OBSAZENÉ MÍSTO (oprava po revizi, 2. 9. 2026):
--    První verze počítala každý aktivní nárok `coaching`. Živě jich je 17 a VŠECHNY
--    jsou bez expirace, takže RPC by vrátila „plno" a prodejní stránka by se v den
--    spuštění zavřela místo otevřela. Proto:
--      - `test-claude` se nepočítá NIKDY (testovací řádky),
--      - ruční nároky BEZ expirace se nepočítají: jsou to historické přístupy do sekce,
--        ne obsazené místo. ⚠️ Otázka na Martina: kolik z těch 15 lidí jsou pořád
--        aktivní klienti? Dokud to nevíme, kapacita měří jen placená a časovaná místa.
--      - co má expiraci v budoucnu, se počítá (ať už přišlo ze Stripu, nebo z adminu);
--        propadlé nároky místo uvolňují.
-- ⚠️ Strop NENÍ v kódu: leží v `app_config` pod klíčem `koucink_kapacita`, aby ho
--    Martin změnil bez nasazování. Chybějící nebo nečíselná hodnota = 25.
insert into public.app_config (key, value)
values ('koucink_kapacita', '25')
on conflict (key) do nothing;

create or replace function public.koucink_kapacita()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select jsonb_build_object(
    'kapacita', k.kapacita,
    'obsazeno', c.obsazeno,
    'volno', greatest(0, k.kapacita - c.obsazeno)
  )
  from (
    select coalesce(
      (select nullif(regexp_replace(value, '[^0-9]', '', 'g'), '')::int
         from public.app_config where key = 'koucink_kapacita'),
      25) as kapacita
  ) k,
  (
    select count(*)::int as obsazeno
    from public.entitlements
    where product = 'coaching'
      and active = true
      and coalesce(source, '') <> 'test-claude'
      and (
        expires_at > now()
        or (expires_at is null and source like 'stripe%')
      )
  ) c;
$function$;

comment on function public.koucink_kapacita() is
  'Veřejná čísla o kapacitě koučinku (strop v app_config.koucink_kapacita). Počítá placená a časovaná místa, ne historické ruční přístupy. Bez osobních údajů.';

-- ⛔ Grant patří `public`, ne jen `anon`: revoke od `anon` je mrtvá páka, když právo
--    visí na `public` (incident 27. 8. 2026, `tydenik_rozeslani`). Tady je to naopak
--    žádoucí směr, ale platí totéž pravidlo: pojmenovat to, co skutečně rozhoduje.
revoke all on function public.koucink_kapacita() from public;
grant execute on function public.koucink_kapacita() to anon, authenticated;
