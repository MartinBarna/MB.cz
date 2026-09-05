-- 5. 9. 2026: klientská sekce zdravila „Ahoj!" bez jména a report měl v předmětu e-mail.
-- Jméno klienta žije v customer_contacts (zadává admin), do user_metadata se při magic linku
-- nedostane. RPC vrátí jméno JEN přihlášenému pro jeho vlastní e-mail (security definer,
-- customer_contacts nemají RLS pro klienty a nesmí mít).
create or replace function public.my_client_name() returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif((select full_name from public.profiles where id = auth.uid()), ''),
    nullif((select name from public.customer_contacts where lower(email) = lower(coalesce(auth.email(), '')) limit 1), ''),
    '');
$$;
revoke all on function public.my_client_name() from public, anon;
grant execute on function public.my_client_name() to authenticated;
