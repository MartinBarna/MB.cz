-- =============================================================================
-- HLÍDKA NEDĚLNÍHO BĚHU `client-remind` (dávka 2, 17. 9. 2026, nález V3)
--
-- PROČ: tři crony (jobid 19, 47, 48) volají `client-remind` v neděli 01:00, 01:30
-- a 02:00 UTC. Jejich odpověď končí v `net._http_response`, kam se nikdo nedívá,
-- a `cron.job_run_details` hlásí `succeeded` i tehdy, když funkce vrátí 500: cron
-- měří, jestli proběhl POŽADAVEK, ne jestli někdo dostal mail. 14. 9. 2026 to takhle
-- tiše spadlo (504 na čtení tajného klíče) a přišlo se na to, až se ozval klient.
--
-- CO HLÍDKA DĚLÁ: v neděli 04:00 UTC, tedy dvě hodiny po posledním běhu, se podívá,
-- jestli po nedělní rozesílce zůstala stopa, a výsledek ZAPÍŠE do `app_config`
-- (klíč `client_remind_hlidka`). Ranní přehled `daily-digest` (cron 4, 05:30 UTC)
-- ten klíč přečte a poplach pošle Martinovi mailem. Hlídka tedy nic neposílá sama.
--
-- ⛔⛔ PROČ NEPOSÍLÁ SAMA: mail z SQL by znamenal uložit Resend klíč do `app_config`
--    (dnes tam NENÍ, změřeno 17. 9. 2026: jsou tam jen secrety pro volání funkcí).
--    Klíč k odesílání mailů v tabulce, na kterou se kouká víc cest, je bezpečnostní
--    rozhodnutí, ne technická drobnost. Vzor `followups_circuit_breaker` (cron 3) je
--    stejný: SQL rozhodne, `daily-digest` a `admin-pulse` to ukážou.
--
-- ⚠️ HLÍDKA SE HLÍDÁ NA ČERSTVOST. Kdyby tenhle cron umřel, klíč přestane stárnout
--    a `daily-digest` na to upozorní sám (viz `daily-digest/hlidky.ts`, práh 8 dní).
--
-- ⚠️ `net._http_response` drží asi 6 hodin (změřeno 17. 9. 2026 v 07:08 UTC: nejstarší
--    záznam 01:12 UTC). Běh v 04:00 UTC vidí všechny tři nedělní odpovědi (01:00 až 02:00).
--    ⛔ Kdo posune hlídku později než na 07:00 UTC, přijde o důkaz, aniž by si toho všiml.
-- ⚠️ `net._http_response` NEUKLÁDÁ URL. Odpověď `client-remind` se pozná podle klíče
--    `kadence_14d`, který v odpovědi žádné jiné funkce není. Kdo přejmenuje pole
--    v odpovědi funkce, oslepí tím tuhle hlídku (proto to má vlastní kontrolu níž).
--
-- Spouští se ručně přes MCP apply_migration v DB Academy (uhmrpfsdcujbhbtumqye).
-- ⛔ Funkce `public.client_remind_hlidka` 17. 9. 2026 v živé DB NEEXISTOVALA
--    (ověřeno dotazem do `pg_proc`), takže `create or replace` nic nepřepisuje.
-- =============================================================================

create or replace function public.client_remind_hlidka(p_vynutit boolean default false)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dnes          date := (now() at time zone 'UTC')::date;
  v_enabled       text;
  v_klientu       int;
  v_radku_dnes    int;
  v_nejistych     int;
  v_odpovedi      int;
  v_posledni      text;
  v_json          jsonb;
  v_stav          text;
  v_text          text;
  v_hodnota       text;
  v_klic          text;
  v_pole          jsonb;
begin
  -- Mimo neděli se nic nezapisuje: přepsat nedělní verdikt pondělním „nic se nedělo"
  -- by hlídku umlčelo přesně v okamžiku, kdy má křičet.
  if not p_vynutit and extract(dow from (now() at time zone 'UTC')) <> 0 then
    return 'preskoceno: neni nedele';
  end if;

  select value into v_enabled from public.app_config where key = 'client_remind_enabled';

  -- Táž podmínka, jakou má funkce (`entitlements` coaching, aktivní, neexpirovaný).
  select count(*) into v_klientu
    from public.entitlements
   where product = 'coaching' and active = true
     and (expires_at is null or expires_at > now());

  select count(*), count(*) filter (where sent_ok = false)
    into v_radku_dnes, v_nejistych
    from public.client_remind_sent
   where kind in ('report', 'register') and den = v_dnes;

  -- Odpovědi funkce z dnešního dne. `content` je JSON tělo odpovědi edge funkce.
  select count(*) into v_odpovedi
    from net._http_response
   where created >= date_trunc('day', now())
     and content like '%"kadence_14d"%';

  select content into v_posledni
    from net._http_response
   where created >= date_trunc('day', now())
     and content like '%"kadence_14d"%'
   order by created desc
   limit 1;

  begin
    v_json := v_posledni::jsonb;
  exception when others then
    v_json := null;  -- nečitelné tělo není důvod hlídku shodit
  end;

  -- ---------------------------------------------------------------------
  -- VERDIKT. Pořadí je schválně: nejdřív stavy, kdy je ticho SPRÁVNĚ.
  -- ---------------------------------------------------------------------
  if coalesce(v_enabled, '') = 'false' then
    v_stav := 'OK';
    v_text := 'pripominky jsou vypnute (app_config.client_remind_enabled = false)';
  elsif v_klientu = 0 then
    v_stav := 'OK';
    v_text := 'zadny aktivni klient koucinku, nebylo komu psat';
  elsif v_nejistych > 0 then
    -- ⛔ Tohle je ta drahá varianta: rezervace drží, ale nevíme, jestli mail odešel.
    --    Funkce už o tom poslala alert; hlídka ho zopakuje, ať to nezapadne.
    v_stav := 'POPLACH';
    v_text := v_nejistych || ' z ' || v_radku_dnes || ' mailu skoncilo v NEJISTOTE (sent_ok=false). '
      || 'Ten mail se uz sam neopakuje. Podivej se do client_remind_sent, kind a email, a rozhodni.';
  elsif v_radku_dnes > 0 then
    v_stav := 'OK';
    -- ⚠️ [R1, nález N2] Radek je REZERVACE, ne doklad o odeslani. `sent_ok=true` je to
    --    nejlepsi, co o nem vim; skutecne cervene stavy prebiji seznamy z tela odpovedi niz.
    v_text := v_radku_dnes || ' radku v client_remind_sent, vsechny se sent_ok=true ('
      || v_klientu || ' aktivnich klientu)';
  elsif v_odpovedi > 0 then
    -- Funkce běžela a vědomě neposlala nikomu (všichni už reportovali, čerství klienti,
    -- optout). To je legitimní stav, ne porucha, ale patří k němu číslo z odpovědi.
    v_stav := 'OK';
    -- ⚠️ [R1, nález N4] Když tělo odpovědi nejde přečíst, VÍME jen to, že funkce doběhla.
    --    Tvrzení „nikomu neměla co poslat" pak není z čeho odvodit, a tak se to napíše.
    v_text := case when v_json is null
      then 'funkce bezela ' || v_odpovedi || 'x, ale TELO ODPOVEDI NESLO PRECIST (nevim, komu co slo)'
      else 'funkce bezela ' || v_odpovedi || 'x a nikomu nemela co poslat'
        || coalesce(' (targets=' || (v_json->>'targets') || ', sent=' || (v_json->>'sent')
                    || ', uz_dostali=' || (v_json->>'uz_dostali') || ')', '')
    end;
  else
    v_stav := 'POPLACH';
    v_text := 'NEDELNI PRIPOMINKA NEPROBEHLA: ' || v_klientu || ' aktivnich klientu, '
      || 'nula radku v client_remind_sent a ani jedna odpoved funkce v net._http_response. '
      || 'Zkontroluj crony 19, 47 a 48 a zavolej funkci rucne.';
  end if;

  -- ---------------------------------------------------------------------
  -- ČERVENÁ POLE Z TĚLA ODPOVĚDI (R1, nálezy N2 a N3)
  --
  -- ⛔⛔ Řádek v `client_remind_sent` je od dávky 2 REZERVACE, ne doklad o odeslání.
  --    Funkce zná tři stavy, ve kterých rezervace drží a mail neodešel, a `sent_ok`
  --    u nich nemusí stihnout klesnout na false (zápis `sent_ok=false` může sám selhat
  --    na 504, což je přesně ten výpadek, kvůli kterému celá dávka vznikla).
  --    ⇒ Tyhle seznamy z odpovědi jsou DRUHÝ, nezávislý zdroj a přebíjejí `OK`.
  -- ⛔ [N3] `jsonb_typeof` PŘED `jsonb_array_length`: nad skalárem skončí funkce chybou
  --    22023 a NEZAPÍŠE do `app_config` nic, takže by hlídku shodil její vlastní vstup
  --    a poplach by přišel až po osmi dnech z kontroly čerstvosti.
  foreach v_klic in array array['rezervace_selhala', 'odeslani_nejiste', 'alerty_selhaly'] loop
    v_pole := v_json -> v_klic;
    if jsonb_typeof(v_pole) = 'array' and jsonb_array_length(v_pole) > 0 then
      v_stav := 'POPLACH';
      v_text := v_text || ' | POZOR: posledni beh hlasi ' || v_klic || '=' || (v_pole::text) || ' ('
        || case v_klic
             when 'rezervace_selhala' then 'tem lidem mail NEODESEL, dalsi beh to zkusi znovu'
             when 'odeslani_nejiste'  then 'rezervace drzi a NEVIME, jestli mail odesel; sam se uz neopakuje'
             else 'Martinovi se nepodarilo poslat ani alert, takze o tom jinak nevi'
           end || ').';
    end if;
  end loop;
  if jsonb_typeof(v_json -> 'errors') = 'array' and jsonb_array_length(v_json -> 'errors') > 0 then
    v_text := v_text || ' | chyby odeslani: ' || ((v_json -> 'errors')::text);
  end if;
  -- Potlačené alerty nejsou poplach samy o sobě, ale patří k němu: Martin uvidí jen tři.
  if jsonb_typeof(v_json -> 'alerty_potlaceno') = 'number' and (v_json->>'alerty_potlaceno')::int > 0 then
    v_text := v_text || ' | alertu potlaceno stropem: ' || (v_json->>'alerty_potlaceno') || '.';
  end if;

  -- Formát hodnoty čte `daily-digest/hlidky.ts` (`hlidkaClientRemind`).
  -- ⛔ Kdo ho změní, musí sáhnout i tam; jinak se poplach tiše přestane ukazovat.
  v_hodnota := v_stav || ' ' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    || ' :: ' || v_text;

  insert into public.app_config(key, value, updated_at)
    values ('client_remind_hlidka', v_hodnota, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();

  return v_hodnota;
end;
$function$;

revoke all on function public.client_remind_hlidka(boolean) from public, anon, authenticated;
grant execute on function public.client_remind_hlidka(boolean) to service_role;

-- =============================================================================
-- ⛔ CRON SE TADY NESPOUŠTÍ (POSTUP-NASAZENI.md §7: nejdřív ruční běh, pak cron).
--
-- KROK 1 (ručně, po nasazení funkce i migrací dávky 2):
--   select public.client_remind_hlidka(true);
--   -- čekám text začínající 'OK ' nebo 'POPLACH ' a řádek v app_config:
--   select value, updated_at from public.app_config where key = 'client_remind_hlidka';
--
-- KROK 2 (teprve až krok 1 vrátil rozumný text) odkomentovat a spustit:
--
-- select cron.schedule(
--   'client-remind-hlidka',
--   '0 4 * * 0',
--   $cmd$ select public.client_remind_hlidka() $cmd$
-- );
--
-- Kontrola:  select jobid, jobname, schedule from cron.job where jobname = 'client-remind-hlidka';
-- Odpojení:  select cron.unschedule('client-remind-hlidka');
-- Návrat:    drop function if exists public.client_remind_hlidka(boolean);
--            delete from public.app_config where key = 'client_remind_hlidka';
-- =============================================================================
