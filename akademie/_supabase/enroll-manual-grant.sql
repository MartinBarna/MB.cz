-- Auto-zařazení ručně přidaných členů (admin panel) do onboarding e-mailové sekvence.
-- Když admin udělí přístup (entitlements, source='admin-panel', active=true) k academy/videokurz,
-- člověk se zařadí do 'onboarding-nakup-<product>' v leads (step 0, next_send_at=now → hodinový cron pošle uvítačku).
--
-- Scope JEN source='admin-panel' → SimpleShop nákupy (source='simpleshop', řeší sendWelcome ve webhooku)
-- se NEdotýkáme, takže nedojde ke zdvojení. Legacy zdroje (manual/wordpress-import/qa-test) se taky netýkají.
-- Pojistky: kdo už koupil (purchased) nebo už v nákupní onboarding sekvenci je → neobtěžujeme podruhé.

create or replace function public.enroll_manual_grant_into_onboarding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_track text;
  v_lead  public.leads%rowtype;
begin
  if not NEW.active then return NEW; end if;
  if NEW.source is distinct from 'admin-panel' then return NEW; end if;
  if NEW.product not in ('academy','videokurz') then return NEW; end if;

  v_track := 'onboarding-nakup-' || NEW.product;

  select * into v_lead from public.leads where lower(email) = lower(NEW.email) limit 1;

  if found then
    -- už koupil, nebo už je v nákupní onboarding sekvenci → nech být
    if v_lead.purchased or v_lead.track like 'onboarding-nakup-%' then
      return NEW;
    end if;
    update public.leads
       set track = v_track, step = 0, status = 'active',
           next_send_at = now(), updated_at = now()
     where id = v_lead.id;
  else
    insert into public.leads (email, track, step, status, next_send_at, source)
    values (lower(NEW.email), v_track, 0, 'active', now(), 'admin-grant');
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enroll_manual_grant on public.entitlements;
create trigger trg_enroll_manual_grant
  after insert or update on public.entitlements
  for each row
  execute function public.enroll_manual_grant_into_onboarding();
