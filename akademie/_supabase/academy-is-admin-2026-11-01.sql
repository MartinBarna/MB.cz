-- Academy: správce přes academy_is_admin() + náhodná čísla certifikátů (C-1, 2. kolo revize)
-- STAV: NASAZENO 1. 11. 2026 01:43:04 UTC jako migrace academy_is_admin_c1_hardening
--       (verze 20261101014304), na Martinovo „nasaď migraci správce Academy“ 01:38:43 UTC.
--       Výsledek ověření po nasazení je na konci souboru.
-- Projekt: Barna Academy (uhmrpfsdcujbhbtumqye). Živá DB je zdroj pravdy, tohle je záznam.
--
-- Why
--   Academy admin was hardcoded by e-mail in 6 RLS policies + 2 functions, and the list
--   included martin@martinbarna.cz, which has NO account in this project. With autoconfirm,
--   anyone could register that address and read all 140 coaching reports and 11 client
--   targets (verified 2026-11-01 with a simulated JWT, counts only). Confirm email is ON since
--   2026-11-01 00:15 UTC, which closed it in practice. This removes the grant itself and the
--   drift that caused it: the admin edge functions (admin-api, admin-crm, admin-pulse) already
--   read app_config.admin_emails, which never contained martin@.
--
-- Rules this file establishes
--   * DB admin checks go through public.academy_is_admin() only. Never hardcode an e-mail
--     in a policy or function again.
--   * app_config.admin_emails may contain ONLY addresses of existing, confirmed accounts.
--     A listed address without an account = whoever registers it becomes admin.
--   * Never authorize via profiles.role: clients can write it (profiles_update_own + column
--     UPDATE grant for anon/authenticated). Nothing trusts it as of 2026-11-01.
--   * Certificate IDs are random (BA-YYYY-XXXXXXXX, uppercase, no 0/O/1/I/L), because
--     verify_certificate() is public and a sequence would let anyone list graduates' names.
--     Nothing parses the ID; the verify page only trims and uppercases the input.
--
-- Pre-flight (2026-11-01, read-only): one variant each of admin_issue_certificate(uuid,text,text)
-- and checkin_loyalty(uuid); app_config has RLS, no policies, no anon/authenticated grants
-- (hence SECURITY DEFINER + fixed search_path); checkin_loyalty is only called for the caller's
-- own data (assets/ba-academy.js), so its admin branch changes no visible behaviour.

create or replace function public.academy_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    lower(nullif(btrim(auth.jwt() ->> 'email'), '')) in (
      select lower(m[1])
      from public.app_config c,
           regexp_matches(c.value::text, '([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+)', 'g') as m
      where c.key = 'admin_emails'
    ),
    false
  );
$$;

comment on function public.academy_is_admin() is
  'Academy admin = JWT e-mail is listed in app_config.admin_emails, the same allowlist admin-api, admin-crm and admin-pulse use. List ONLY addresses of existing, confirmed accounts. Never authorize via profiles.role: clients can write it.';

revoke all on function public.academy_is_admin() from public;
grant execute on function public.academy_is_admin() to anon, authenticated, service_role;

alter policy ai_flags_select_admin on public.ai_flags
  using ((select public.academy_is_admin()));
alter policy ai_flags_update_admin on public.ai_flags
  using ((select public.academy_is_admin()))
  with check ((select public.academy_is_admin()));
alter policy checkins_select_admin on public.checkins
  using ((select public.academy_is_admin()));
alter policy client_reports_select_admin on public.client_reports
  using ((select public.academy_is_admin()));
alter policy client_targets_select_admin on public.client_targets
  using ((select public.academy_is_admin()));
alter policy test_attempts_select_admin on public.test_attempts
  using ((select public.academy_is_admin()));

create or replace function public.admin_issue_certificate(p_user_id uuid, p_email text, p_full_name text)
 returns table(cert_id text, full_name text, issued_at timestamp with time zone, program text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_name  text := nullif(btrim(p_full_name), '');
  v_row certificates%rowtype;
  v_code text;
  v_prog text := 'Barna Academy — trenér a výživový poradce';
  -- No 0/O/1/I/L: people read and type the ID. Uppercase only: the public verify page
  -- uppercases the input before the lookup.
  v_abc constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_rnd bytea;
  v_try int := 0;
  i int;
begin
  if not public.academy_is_admin() then raise exception 'not-admin'; end if;
  if p_user_id is null then raise exception 'user-required'; end if;
  if v_name is null then raise exception 'name-required'; end if;
  if not exists (select 1 from entitlements e where lower(e.email) = lower(p_email) and e.product = 'academy' and e.active) then
    raise exception 'target-no-access';
  end if;
  select * into v_row from certificates c where c.user_id = p_user_id limit 1;
  if found then return query select v_row.cert_id, v_row.full_name, v_row.issued_at, v_row.program; return; end if;
  -- Random ID instead of cert_seq: verify_certificate is public, so sequential numbers
  -- would let anyone list every graduate's full name.
  loop
    v_try := v_try + 1;
    v_rnd := uuid_send(gen_random_uuid());
    v_code := 'BA-' || to_char(now(), 'YYYY') || '-';
    foreach i in array array[0, 1, 2, 3, 4, 5, 9, 10] loop  -- skips uuid v4 version/variant bytes
      v_code := v_code || substr(v_abc, 1 + get_byte(v_rnd, i) % length(v_abc), 1);
    end loop;
    exit when not exists (select 1 from certificates c where c.cert_id = v_code);
    if v_try >= 5 then raise exception 'cert-id-collision'; end if;
  end loop;
  insert into certificates(cert_id, user_id, full_name, program, issued_at, valid)
    values (v_code, p_user_id, v_name, v_prog, now(), true);
  return query select v_code, v_name, now()::timestamptz, v_prog;
end $function$;

create or replace function public.checkin_loyalty(p_user uuid default null::uuid)
 returns table(streak integer, loyalty_pct integer, weeks_total integer)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  r record;
  cur_streak int := 0;
  pct int := 0;
  prev_week date;
  this_week date;
begin
  if p_user is null then p_user := auth.uid(); end if;
  if p_user is distinct from auth.uid() and not public.academy_is_admin() then
    raise exception 'forbidden';
  end if;
  for r in
    select distinct date_trunc('week', created_at)::date as wk
    from public.checkins where user_id = p_user order by wk
  loop
    this_week := r.wk;
    if prev_week is null then
      cur_streak := 1; pct := 2;
    elsif this_week = prev_week + interval '7 day' then
      cur_streak := cur_streak + 1;
      pct := least(pct + 2, 20);
    else
      cur_streak := 1;
      pct := greatest(pct - 6, 0);
      pct := least(pct + 2, 20);
    end if;
    prev_week := this_week;
  end loop;
  if prev_week is not null and prev_week < (date_trunc('week', now())::date - interval '7 day') then
    pct := greatest(pct - 6, 0);
  end if;
  return query select cur_streak, pct,
    (select count(distinct date_trunc('week', created_at))::int from public.checkins where user_id = p_user);
end $function$;

-- =====================================================================================
-- Verification after apply (execute_sql as postgres; counts only, no personal data)
-- =====================================================================================
-- 1) Exactly one variant of each function (CLAUDE.md rule 8):
--      select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public'
--        and p.proname in ('academy_is_admin','admin_issue_certificate','checkin_loyalty');
-- 2) Nothing still hardcodes the address:
--      select tablename, policyname from pg_policies
--      where coalesce(qual,'') || coalesce(with_check,'') ~* 'martin@';
-- 3) Simulated attacker sees nothing (expect 0 / 0):
--      select set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid()::text,
--        'email', 'martin@martinbarna.cz', 'role', 'authenticated')::text, true);
--      set local role authenticated;
--      select (select count(*) from public.client_reports), (select count(*) from public.client_targets);
-- 4) Same with fitness.barna@gmail.com and its real uid: expect the full table counts.
-- 5) admin_issue_certificate: as attacker raises 'not-admin'; as admin with a target that has
--    no Academy raises 'target-no-access'. Nothing is inserted in either case.
--
-- Rollback (only if the admin view breaks): put back literal checks WITHOUT martin@, e.g.
--      alter policy client_reports_select_admin on public.client_reports
--        using (((select auth.jwt()) ->> 'email') = any (array['fitness.barna@gmail.com']));
--    (same for the other 5 policies; in both functions replace public.academy_is_admin()
--    with lower(coalesce(auth.jwt() ->> 'email', '')) = 'fitness.barna@gmail.com').
--
-- =====================================================================================
-- Verified 2026-11-01 right after apply (counts only, simulated JWTs, nothing written)
-- =====================================================================================
--   1) One variant each of academy_is_admin(), admin_issue_certificate(uuid,text,text) and
--      checkin_loyalty(uuid). The two existing functions kept their ACL (postgres,
--      authenticated, service_role); academy_is_admin: postgres, anon, authenticated, service_role.
--   2) 0 policies and 0 public functions still mention martin@; all 6 admin policies call
--      academy_is_admin() (ai_flags_update_admin in USING and WITH CHECK).
--   3) Fake martin@ JWT: is_admin false, 0 rows in client_reports, client_targets, checkins,
--      test_attempts and ai_flags.
--   4) fitness.barna@gmail.com with its real uid: is_admin true, full table counts,
--      checkin_loyalty for another user works.
--   +) A real client (matched by e-mail): sees exactly their own reports, not the others.
--      anon: 0 rows and no permission error (needs EXECUTE because ai_flags policies are TO public).
--   5) admin_issue_certificate: attacker gets 'not-admin'; admin with a target that has no
--      Academy gets 'target-no-access'; checkin_loyalty for someone else as non-admin gets
--      'forbidden'. Still 0 certificates. Generated IDs: format ok, 6 of 6 distinct.
--   Supabase advisor lists academy_is_admin under anon_ and
--   authenticated_security_definer_function_executable. Intended: RLS evaluates it as the
--   calling role, so both roles need EXECUTE, and it only tells callers whether they
--   themselves are admin.
--   Exact pre-migration definitions (with martin@, never restore 1:1) are kept outside git in
--   the project files: bezpecnost/zaloha-pred-academy-is-admin-20261101.sql.
