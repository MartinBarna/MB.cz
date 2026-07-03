# RUNBOOK: onboarding maily (videokurz kupci + coaching) — pro Code (Supabase MCP)

Cíl: TEST teď na Martina → po jeho OK OSTRO zítra ráno (~8:30). Posílat JEN těm, kdo mají přístup.
Texty mailů: `akademie/_email/onboarding-videokurz-coaching.md` (genderově neutrální, odkaz `?tab=register`).
Engine je už onboarding-aware (nepřeskakuje zákazníky) + umí `archive_bcc` (kopie na Martina).

## 0) Zapnout kopie na Martina (jednorázově)
```sql
insert into public.app_config (key,value) values ('archive_bcc','fitness.barna@gmail.com')
on conflict (key) do update set value=excluded.value, updated_at=now();
```

## 1) Vložit šablony (blocks zkopíruj z onboarding-videokurz-coaching.md)
```sql
insert into public.email_templates (track, step, key, subject, preheader, blocks, wait_days) values
('onboarding-videokurz', 0, 'onb-vk-v1',
 'Tvůj videokurz je teď celý na jednom místě',
 'Všech 182 videí + materiály na jednom místě. Přístup si vytvoříš za minutu.',
 $json$[...VLOŽ blocks z md (sekce A)...]$json$::jsonb, null),
('onboarding-coaching', 0, 'onb-co-v1',
 'Předělal jsem členskou sekci a něco v ní na tebe čeká',
 'Videokurz výživy v ceně. Přístup si vytvoříš za minutu.',
 $json$[...VLOŽ blocks z md (sekce B)...]$json$::jsonb, null)
on conflict (track, step) do update set subject=excluded.subject, preheader=excluded.preheader, blocks=excluded.blocks, wait_days=excluded.wait_days, key=excluded.key;
```

## 2) TEST teď na Martina (obě verze) — POST drip-send (header x-drip-secret = app_config.drip_invoke_secret)
```
body: {"test_email":"fitness.barna@gmail.com","track":"onboarding-videokurz","step":0,"name":"Martin"}
body: {"test_email":"fitness.barna@gmail.com","track":"onboarding-coaching","step":0,"name":"Martin"}
```
→ Martin zkontroluje. Teprve po jeho „pošli ostro" pokračuj.

## 3) Ověřit přístupy (kdo se NEdostane) — uprav tagy dle reality
```sql
-- A) videokurz kupci bez přístupu (ideálně 0)
select count(*) from customer_contacts cc
left join entitlements e on lower(e.email)=lower(cc.email) and e.product='videokurz' and e.active
where cc.tags && array['early-customer'] and e.email is null;
-- B) coaching klienti bez přístupu (mají mít videokurz v ceně → případně doplnit entitlement)
select count(*) from customer_contacts cc
left join entitlements e on lower(e.email)=lower(cc.email) and e.product='videokurz' and e.active
where cc.tags && array['coaching-active','coaching-ex'] and e.email is null;
```
Když A/B > 0 → těm chybí přístup: buď doplnit `entitlements(email, product='videokurz', active=true)`, nebo je z vlny vynechat (bezpečný seznam v kroku 4 je stejně jen s přístupem).

## 4) Naplánovat OSTRO na zítra ~8:30 (jen příjemci S PŘÍSTUPEM)
Vlož onboarding příjemce jako leady s `next_send_at = zítra 08:30`; hodinový cron je v 9:00 odešle (s BCC na Martina, odhlašovací patičkou, idempotentně). Pošli jen těm s aktivním videokurz přístupem:
```sql
-- videokurz kupci
insert into public.leads (email, name, segment, source, track, step, status, next_send_at)
select distinct lower(cc.email), cc.name, 'other', 'onboarding', 'onboarding-videokurz', 0, 'active',
       (date_trunc('day', now() + interval '1 day') + interval '8 hours 30 minutes')
from customer_contacts cc
join entitlements e on lower(e.email)=lower(cc.email) and e.product='videokurz' and e.active
where cc.tags && array['early-customer']
on conflict (email) do nothing;   -- ať nevznikne duplicita s existujícím leadem
-- coaching klienti (track onboarding-coaching) — obdobně, tag coaching-active/coaching-ex
```
POZN.: `on conflict (email)` — pokud onboarding příjemce už je v `leads` (např. stáhl lead-magnet), tenhle insert ho přeskočí; takový člověk dostane onboarding až přes svůj existující záznam jinak NE → pro jistotu ho zařaď ručně, nebo onboarding pošli zvlášť. (Pro první vlnu obvykle žádný překryv.)

## 5) Po odeslání
- Zkontroluj `email_events` (type='sent', track onboarding-*) a Resend Logs.
- Martin dostane BCC kopii každého → ověří dojezd.
