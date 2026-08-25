-- ============================================================
-- APPKA Tvuj Coach (projekt kfkmghvhqwqtsalqjmrp)
-- RPC public.zapsali_jidlo(text[]) -> podmnozina adres, ktere UZ zapsaly jidlo
--
-- ⛔⛔ TENHLE SOUBOR SE NEAPLIKUJE Z WORKTREE. Je to podklad pro sefa.
--     Cislo migrace v repu appky si sef vezme az po `martin-souhra`.
--     Cursor / agent NESMI spoustet tenhle SQL proti zive DB.
--
-- K CEMU TO JE: mailovy engine `drip-send` bezi v projektu Academy a potrebuje vedet,
--     jestli uz clovek v appce zapsal jidlo. Zapisy jsou v JINEM projektu, takze se na
--     ne neda dotazat SQL dotazem. Cesta je: drip-send -> edge fn appky `aktivace-stav`
--     (sdileny secret) -> tahle RPC. Duvody vyberu teto cesty: README.md vedle.
--
-- ⛔ ZADNY GRANT PRO `anon` ANI `authenticated`. Funkce odpovida na otazku
--    „pouziva tahle konkretni adresa appku?". S verejnym grantem by to byl orakulum pro
--    kohokoli na internetu: staci hadat adresu. Volat ji smi vyhradne `service_role`,
--    tedy edge funkce appky, ktera si nejdriv overi sdileny secret.
--    (Tim se lisi od `verejna_cisla()`, ktera vraci soucty a `anon` mit smi.)
--
-- ⛔ „ZAPSAL" ZNAMENA SNEDL, NE NAPLANOVAL. `food_log.planned = true` je radek
--    z generatoru jidelnicku, ktery clovek nikdy nepotvrdil. Kdyby se pocital,
--    tvrdili bychom v mailu „par dni zapisu za tebou" cloveku, ktery si jen nechal
--    vygenerovat plan. Predikat `coalesce(planned, false) = false` je TENTYZ, jaky
--    pouziva klient (`jenSnedene` v src/data/food-log.ts), funkce `food_variety`
--    (migrace 0087) i gamifikace po oprave (migrace 0116). Ctvrta kopie te sémantiky,
--    takze kdo ji nekdy zmeni, musi projit vsechna ctyri mista.
--
-- ⚠️ TRENINK SE NEPOCITA. Aktivacni maily mluvi o zapisu JIDLA. Kdyby se sem pridal
--    `training_log`, „zapsal" by zacalo znamenat neco jineho, nez co ty maily rikaji.
--
-- Vykon: pouziva se index `food_log_user_planned_idx (user_id, logged_date, planned)`,
--    novy index netreba. Dotaz bezi nad max. 500 adresami na jedno volani.
-- ============================================================

create or replace function public.zapsali_jidlo(p_emaily text[])
returns table(email text)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  -- Strop davky. Bez nej by jedno volani mohlo protahnout cely seznam uzivatelu.
  -- Volajici (drip-send) posila nejvys tolik adres, kolik ma leadu ve fronte (limit 200).
  if p_emaily is null or array_length(p_emaily, 1) is null then
    return;
  end if;
  if array_length(p_emaily, 1) > 500 then
    raise exception 'zapsali_jidlo: prilis mnoho adres najednou (%), strop je 500', array_length(p_emaily, 1);
  end if;

  return query
    select lower(u.email)::text
    from auth.users u
    where lower(u.email) = any (select lower(x) from unnest(p_emaily) as x)
      and exists (
        select 1 from public.food_log fl
        where fl.user_id = u.id
          and coalesce(fl.planned, false) = false
      );
end $$;

revoke all on function public.zapsali_jidlo(text[]) from public;
revoke all on function public.zapsali_jidlo(text[]) from anon, authenticated;
grant execute on function public.zapsali_jidlo(text[]) to service_role;

comment on function public.zapsali_jidlo(text[]) is
  'Pro dane adresy vraci ty, ktere maji aspon jeden NEnaplanovany radek ve food_log. '
  'Cte to edge fn aktivace-stav pro mailovy engine Academy. Jen service_role.';

-- ============================================================
-- OVERENI PO APLIKACI (nic nemeni, jen cte):
--   select * from public.zapsali_jidlo(array['fitness.barna@gmail.com']);
--   -- musi vratit prazdno pro adresu, ktera v appce ucet nema:
--   select * from public.zapsali_jidlo(array['neexistuje@example.com']);
--   -- a musi selhat pro anon:
--   set role anon; select * from public.zapsali_jidlo(array['x@y.cz']); reset role;
-- ============================================================
