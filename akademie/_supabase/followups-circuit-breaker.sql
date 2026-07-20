-- ============================================================================
-- JISTIC FOLLOW-UPU (followups_circuit_breaker) — verze 2, 20. 7. 2026
-- ============================================================================
-- Cron: jobid 3, '7 * * * *' (kazdou hodinu v :07), job "followups-circuit-breaker".
-- Brana: app_config.followups_enabled ('true' = follow-upy odchazi).
-- Cte ji drip-send/index.ts:252; pri 'false' se non-onboarding leady VUBEC nenacitaji
-- (index.ts:309), takze se nic neztrati, jen mlci. Absence klice = zavreno (fail-safe).
--
-- ⚠️ PROC TENHLE SOUBOR VUBEC EXISTUJE:
-- Puvodni verze funkce zila POUZE v zive DB. Nebyla v gitu, neprosla code review a pri
-- obnove z migraci by se neobnovila. Odhaleno 20. 7. 2026. Kdyz na jistic saha kdokoli
-- pristi, ZMENU PATRI SEM, ne jen do DB.
--
-- CO RESI VERZE 2 (vsechno overeno na zivych datech 20. 7. 2026):
--
-- 1) JEDNOSMERNOST. v1 se hned na zacatku ukoncila, kdyz brana nebyla 'true'. Po sepnuti
--    se tedy vypnula sama a uz nikdy nic nevyhodnotila. Zpet ji vratil jen clovek rucnim
--    SQL UPDATE. V celem repu i DB neexistoval JEDINY zapis hodnoty 'true'.
--    -> v2 bezi i pri zavrene brane a po V_COOLDOWN_H hodinach BEZ nove chyby ji sama otevre.
--
-- 2) PRILIS CITLIVY PRAH. v1: "v_rl >= 1 or v_errors >= 3", tedy JEDINY rate-limit nebo
--    TRI libovolne chyby (napr. 3x neplatny prijemce) umlcely vsech ~355 lidi na
--    non-onboarding tracich.
--    -> v2: rate-limit >= 3 (jednorazovy vypadek neni porucha), ostatni chyby >= 10.
--
-- 3) NEPRESNY TEST NA 429. v1 hledala '%429%' pres CELY chybovy retezec, ktery obsahuje
--    i JSON telo odpovedi Resendu (drip-send:225 sklada 'resend_<status>:' + JSON.stringify).
--    Jakakoli chyba s cislem 429 kdekoli uvnitr (v ID, v textu) branu sepnula.
--    -> v2 matchuje presne prefix 'resend_429:', ktery vyrabime my sami.
--
-- 4) ZAMENA KVOTY ZA RATE LIMIT. Incident 30. 6. 2026 (307 chyb behem 55 s) NEBYL rate
--    limit, ale 'daily_quota_exceeded' na tehdejsim free tarifu (100 mailu/den). Prvnich
--    99 mailu proslo tempem 4-5/s bez chyby. Od te doby jede Resend PLACENY BEZ DENNIHO
--    LIMITU (potvrdil Martin 20. 7. 2026), takze tahle trida chyby by uz nastat nemela.
--    -> v2 pocita kvotove chyby zvlast, at se pripadne priste nezameni za rate limit.
--
-- 5) TICHE SEPNUTI. Duvod se ukladal do app_config.followups_breaker_reason, ktery
--    NEZOBRAZOVALO zadne UI ani mail (grep pres repo: zadny vyskyt).
--    -> Zobrazeni resi zvlast daily-digest a admin-pulse, viz commit z 20. 7.
-- ============================================================================

create or replace function public.followups_circuit_breaker()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_gate         text;
  v_thr_rl       int := 3;    -- rate-limit chyb dnes -> zavri
  v_thr_err      int := 10;   -- ostatnich non-onboarding chyb dnes -> zavri
  v_cooldown_h   int := 3;    -- hodin bez chyby -> otevri zpet
  v_errors       int;
  v_rl           int;
  v_quota        int;
  v_recent       int;
  v_closed_at    timestamptz;
  v_daystart     timestamptz := date_trunc('day', now());
begin
  select value into v_gate from public.app_config where key = 'followups_enabled';

  -- ---------------------------------------------------------------------
  -- BRANA ZAVRENA: zkusit ji sama otevrit (tohle v1 neumela vubec)
  -- ---------------------------------------------------------------------
  if coalesce(v_gate,'') <> 'true' then
    -- Kdy se zaviralo? Bez toho by se brana mohla otevrit driv, nez cooldown ubehne.
    select updated_at into v_closed_at
      from public.app_config where key = 'followups_enabled';

    if v_closed_at is null or v_closed_at > now() - make_interval(hours => v_cooldown_h) then
      return;  -- jeste je brzy, nech zavreno
    end if;

    -- Byla za cooldown okno nejaka kvalifikujici chyba? Kdyz ano, nechavame zavreno.
    select count(*) into v_recent
      from public.email_events
     where type = 'error'
       and created_at >= now() - make_interval(hours => v_cooldown_h)
       and coalesce(detail->>'track','') not ilike 'onboarding%'
       and coalesce(detail->>'track','') <> '';

    if v_recent > 0 then
      return;
    end if;

    update public.app_config set value='true', updated_at=now()
     where key='followups_enabled';
    insert into public.app_config(key, value, updated_at)
      values ('followups_breaker_reason',
        'AUTO-REOPENED ' || to_char(now(),'YYYY-MM-DD HH24:MI')
          || 'Z: ' || v_cooldown_h || ' h bez chyby na follow-up tracich',
        now())
      on conflict (key) do update set value=excluded.value, updated_at=now();
    return;
  end if;

  -- ---------------------------------------------------------------------
  -- BRANA OTEVRENA: vyhodnotit, jestli zavrit
  -- ---------------------------------------------------------------------
  select
    count(*) filter (where type='error'),
    count(*) filter (where type='error' and coalesce(detail->>'error','') like '%resend_429:%'
                       and coalesce(detail->>'error','') not like '%daily_quota_exceeded%'),
    count(*) filter (where type='error' and coalesce(detail->>'error','') like '%daily_quota_exceeded%')
  into v_errors, v_rl, v_quota
  from public.email_events
  where created_at >= v_daystart
    and coalesce(detail->>'track','') not ilike 'onboarding%'
    and coalesce(detail->>'track','') <> '';

  if v_rl >= v_thr_rl or v_quota >= 1 or v_errors >= v_thr_err then
    update public.app_config set value='false', updated_at=now() where key='followups_enabled';
    insert into public.app_config(key, value, updated_at)
      values ('followups_breaker_reason',
        'AUTO-CLOSED ' || to_char(now(),'YYYY-MM-DD HH24:MI') || 'Z: chyby=' || v_errors
          || ', rate_limit=' || v_rl || ', kvota=' || v_quota
          || ' (prahy: rl>=' || v_thr_rl || ', kvota>=1, chyby>=' || v_thr_err
          || '; otevre se sama po ' || v_cooldown_h || ' h bez chyby)',
        now())
      on conflict (key) do update set value=excluded.value, updated_at=now();
  end if;
end;
$function$;

-- ============================================================================
-- GUARD DO ENROLL FUNKCI
-- ============================================================================
-- Enroll funkce jsou ciste SQL a branu NEKONTROLOVALY vubec. Pri zavrene brane se
-- clovek normalne prelil do navazujici sekvence, dostal next_send_at, vse vypadalo
-- funkcne a maily tise nechodily. Pritezujici okolnost: jistic bezi v 7:07, ale enrolly
-- az v 7:10 / 7:20 / 7:35 / 7:50, takze rano po sepnuti se do zavrene brany nalilo
-- jeste az 150 dalsich lidi.
--
-- Guard se pridava jako SAMOSTATNA funkce, aby se nemusela prepisovat tela vsech ctyr
-- enroll funkci (a riskovat preklep v jejich SQL). Volani se doplni na jejich zacatek.
create or replace function public.followups_gate_open()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select value from public.app_config where key = 'followups_enabled'), '') = 'true';
$$;

comment on function public.followups_gate_open() is
  'TRUE kdyz je brana follow-upu otevrena. Enroll funkce se tim maji ridit, jinak nalevaji lidi do zavrene brany.';
