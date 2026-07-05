-- ============================================================================
-- Auto-zařazení ručně přidaných členů (admin panel) do onboarding e-mailu.
-- ============================================================================
-- Když admin udělí přístup (entitlements, source='admin-panel', active=true) k
-- academy/videokurz, člověk se zařadí do 'onboarding-GRANT-<product>' v leads
-- (step 0, next_send_at=now → hodinový cron pošle uvítačku).
--
-- „grant" tracky = neutrální uvítačky pro COMPNUTÉ (ručně přidané) — BEZ „díky za
-- nákup" a BEZ garance vrácení peněz (ta platí jen u reálné koupě). „nakup" tracky
-- zůstávají jen pro reálné kupující (řeší sendWelcome v simpleshop-webhook).
--
-- Scope JEN source='admin-panel' → SimpleShop (source='simpleshop') se netýká → žádné zdvojení.
-- Idempotentní: kdo purchased / už na onboarding-nakup-% / onboarding-grant-% → přeskočí.

-- ---- 1) Grant uvítací šablony ----------------------------------------------
insert into email_templates(track,step,key,subject,preheader,blocks,wait_days) values
('onboarding-grant-academy',0,'grant-academy',
 'Otevřel jsem ti přístup do Barna Academy{{fn_suffix}} 🎓',
 'Přístup je aktivní. Vytvoř si účet a otevři si všechny lekce i nástroje.',
 $j$[
   {"t":"p","html":"Ahoj{{fn_space}},"},
   {"t":"p","html":"právě jsem ti <strong>otevřel přístup do Barna Academy</strong>! 🎓 Máš odemčené všechny lekce, nástroje i cestu k certifikaci — a je v tom i celý <strong>videokurz výživy (182 lekcí)</strong>."},
   {"t":"p","html":"<strong>Jak se dostaneš dovnitř</strong> (zabere minutu):"},
   {"t":"bullets","items":["Klikni na tlačítko níž — otevře se registrace s předvyplněným e-mailem.","Dej <strong>„Vytvořit účet“</strong> a zvol si heslo. Registruj se přesně e-mailem <strong>{{email}}</strong> — podle něj tě systém pozná a všechno ti odemkne.","Hotovo. Studuješ na mobilu i počítači, vlastním tempem."]},
   {"t":"btn","href":"https://martinbarna.cz/akademie/prihlaseni/?tab=up&email={{email_url}}&next=/akademie/moje/","text":"Vytvořit účet a otevřít Academy"},
   {"t":"p","html":"Kdyby cokoliv nešlo, stačí odpovědět na tenhle e-mail — vyřešíme to. <strong>Be Effective!</strong><br>Martin"},
   {"t":"ps","html":"P.S. Registruj se přesně e-mailem <strong>{{email}}</strong> — podle něj tě systém pozná a přístup odemkne."}
 ]$j$::jsonb, null),
('onboarding-grant-videokurz',0,'grant-vk',
 'Otevřel jsem ti přístup k videokurzu{{fn_suffix}} 🎉',
 'Přístup je aktivní. Vytvoř si účet a můžeš začít — zabere to minutu.',
 $j$[
   {"t":"p","html":"Ahoj{{fn_space}},"},
   {"t":"p","html":"právě jsem ti <strong>otevřel přístup k videokurzu výživy</strong>! 🎉 Čeká na tebe všech <strong>182 video lekcí</strong> a bonusové materiály ke stažení."},
   {"t":"p","html":"<strong>Jak se dostaneš dovnitř</strong> (zabere minutu):"},
   {"t":"bullets","items":["Klikni na tlačítko níž — otevře se registrace s předvyplněným e-mailem.","Dej <strong>„Vytvořit účet“</strong> a zvol si heslo. Registruj se přesně e-mailem <strong>{{email}}</strong> — podle něj tě systém pozná a kurz ti odemkne.","Hotovo. Koukáš na mobilu i počítači, kdy chceš a kolikrát chceš."]},
   {"t":"btn","href":"https://martinbarna.cz/akademie/prihlaseni/?tab=up&email={{email_url}}&next=/akademie/videokurz/","text":"Vytvořit účet a začít"},
   {"t":"p","html":"Kdyby cokoliv nešlo, stačí odpovědět na tenhle e-mail — vyřešíme to. <strong>Be Effective!</strong><br>Martin"},
   {"t":"ps","html":"P.S. Registruj se přesně e-mailem <strong>{{email}}</strong> — podle něj tě systém pozná a kurz odemkne."}
 ]$j$::jsonb, 5)
on conflict (track,step) do update
  set key=excluded.key, subject=excluded.subject, preheader=excluded.preheader,
      blocks=excluded.blocks, wait_days=excluded.wait_days, updated_at=now();

-- kroky 1 a 2 videokurzu = kopie z „nákup" verze (neobsahují nákupní jazyk: „3 tipy", „doporuč")
insert into email_templates(track,step,key,subject,preheader,blocks,wait_days)
select 'onboarding-grant-videokurz', step, key||'-grant', subject, preheader, blocks, wait_days
from email_templates where track='onboarding-nakup-videokurz' and step in (1,2)
on conflict (track,step) do nothing;

-- ---- 2) Trigger ------------------------------------------------------------
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

  v_track := 'onboarding-grant-' || NEW.product;

  select * into v_lead from public.leads where lower(email) = lower(NEW.email) limit 1;

  if found then
    if v_lead.purchased
       or v_lead.track like 'onboarding-nakup-%'
       or v_lead.track like 'onboarding-grant-%' then
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
