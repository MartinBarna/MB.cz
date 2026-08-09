-- ⛔⛔ HISTORICKÝ SNÍMEK, NENÍ ZDROJ PRAVDY (ověřeno 9. 8. 2026).
-- Živé texty mailů žijí v tabulce `email_templates`, tenhle soubor je za nimi pozadu
-- (např. předmět upsell mailu tu zněl „8 900 místo 12 900", v DB stálo „8 900, později
-- 12 900"). ⇒ NESPOUŠTĚT proti živé DB, přepsalo by to novější texty.
-- ⛔ A obsahuje ZRUŠENÝ slib zdražení Academy na 12 900 Kč (Martin ho zrušil 8. 8. 2026,
-- cena zůstává 8 900). Web i DB jsou od zmínek vyčištěné, tenhle soubor NE.
-- Srovnání se skutečností = regenerace z DB, samostatný úkol.

-- ============================================================================
-- UPSELL MOSTY: videokurz/Academy → Coaching (vlajková loď) + → Academy
-- ============================================================================
-- Šablony jsou v email_templates (tracky 'upsell-coaching' a 'upsell-academy').
-- Plný copy je v DB; níže je operační logika (enrollment) a go-live kroky.
--
-- SEKVENCE:
--   upsell-coaching (3 kroky, wait 5/6/-)  ← DEFAULT po videokurz onboardingu + pro Academy členy
--     0 „Videokurz máš — chceš to teď vzít se mnou?"  = FORK (nauč se sám=Academy / dovedu tě=Coaching)
--         + 3 reálné proměny (klientka 64 −20 kg; −12 kg 97→85; Tomáš&Katka drží 2 roky sami) + konzultace 1 990
--     1 „Proč to se mnou půjde…"  = plán na míru, accountability, „nedělám závisláky"
--         + UPGRADE KREDIT: cena videokurzu se odečte u 3/6měs balíčku (Gold 6 450 / Diamond 8 950)
--     2 „Poslední věc k tomu coachingu" = bez tlaku + word-of-mouth
--   upsell-academy (3 kroky, wait 4/4/-)  ← segment „chci se to naučit / závodit / pomáhat druhým"
--     0 kam dál po videokurzu · 1 řízení plánu · 2 zaváděcí cena 8 900 vs 12 900 (videokurz v ceně)
--
-- Obě jsou NON-onboarding tracky → posílají se jen když app_config.followups_enabled='true' (master brána).

-- ---- Enrollment: eligibilní členy dávkově do upsell-coaching -----------------
-- Filtr: aktivní přístup (videokurz/academy) A reálně registrovaný účet (auth.users);
-- vynech coaching klienty (tag coaching-active), už-v-upsellu, odhlášené/bounced,
-- a lidi uprostřed onboardingu (onboarding-% s next_send_at). Idempotentní (po zařazení track upsell-% → příště vynechán).
create or replace function public.enroll_into_upsell_coaching(p_limit int default 25)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  r record;
begin
  for r in
    with reg as (
      select distinct lower(e.email) as email
      from entitlements e
      join auth.users u on lower(u.email) = lower(e.email)
      where e.active and e.product in ('videokurz','academy')
    ),
    elig as (
      select r.email from reg r
      where r.email not in (select lower(email) from customer_contacts where tags && array['coaching-active'])
        and r.email not in (select lower(email) from leads where track like 'upsell-%')
        and r.email not in (select lower(email) from leads where status in ('unsubscribed','bounced'))
        and r.email not in (select lower(email) from leads where track like 'onboarding-%' and next_send_at is not null)
    )
    select email from elig limit greatest(1, p_limit)
  loop
    if exists (select 1 from leads where lower(email) = r.email) then
      update leads set track='upsell-coaching', step=0, status='active',
             next_send_at=now(), updated_at=now()
       where lower(email) = r.email;
    else
      insert into leads (email, track, step, status, next_send_at, source)
      values (r.email, 'upsell-coaching', 0, 'active', now(), 'upsell-auto');
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---- GO-LIVE: ŽIVÉ od 2026-07-05 (Martin schválil) --------------------------
-- Denní cron zařazuje max 25 eligibilních/den; hodinový drip-send je rozešle (followups_enabled='true').
-- NASAZENO:
--   select cron.schedule('upsell-enroll-daily', '20 7 * * *', $cmd$
--     select public.enroll_into_upsell_coaching(25);
--   $cmd$);
-- Vypnutí: select cron.unschedule('upsell-enroll-daily');

-- ---- UPSELL-ACADEMY ENROLL (2026-07-07, ZIVE) --------------------------------
-- Martinuv insight: skoro nikdo nedokonci videokurz na 100 % — upsell na Academy
-- se spousti pri ~40 % dokonceni (73 z 182 vk-* lekci). Prah ladi app_config klic
-- 'upsell_academy_min_lessons' (bez zasahu do kodu). Bezi denne v 7:10 — PRED
-- coaching enrollem (7:20), takze zabrany student dostane prednostne Academy lane;
-- kdo uz je na upsell-% tracku, druhy upsell nedostane (1 lead = 1 sekvence).
-- Obe enroll funkce nove vylucuji i status 'paused' (admin pauza se respektuje).
-- Zdroj pravdy tel funkci = ziva DB (create or replace nasazeno 7.7. vecer).
-- Vypnuti: select cron.unschedule('upsell-academy-enroll-daily');
