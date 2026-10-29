# Runbook: přepnutí pošty na Amazon SES a návrat na Resend

Platí pro oba projekty se stejným přepínačem `_shared/mail-provider.ts`:

- Barna Academy, `uhmrpfsdcujbhbtumqye` (web, drip, admin).
- Tvůj Coach, `kfkmghvhqwqtsalqjmrp` (appka).

Příkazy níž nastavují jen jméno poskytovatele. Žádné klíče, hesla ani SMTP se sem nepíšou a při běhu se nevypisují.

## Kdy se to smí udělat

Ostré přepnutí (`MAIL_PROVIDER=ses`) až po třech věcech naráz:

1. SES pustí účet ze sandboxu (dokud je v sandboxu, reálné adresy zákazníků SES odmítne).
2. Finální kontrola Clauda.
3. GO Martina.

Do té doby zůstává `MAIL_PROVIDER` prázdné. Prázdné znamená Resend, stejně jako dnes. Tahle větev nic nepřepíná, nic nenasazuje a žádný mail neposílá.

`ses-test` v `akademie/_supabase/functions/ses-test/` se tímhle PR nenasazuje. Nasazení té funkce a každé její volání schvaluje Claude (Tým 2). Funkce posílá jen na čtyři adresy a jen přes větev SES, i když je projekt ještě na Resendu.

## Okno 20:20 až 20:55 Praha

`pg_cron` běží v UTC. Posun Prahy je o celé hodiny (SEČ +1, SELČ +2), takže minuta v crontabu je stejná minuta v Praze.

Hlavní rozesílka `drip-send-hourly` je `0 * * * *`: minuta 0 každé hodiny. Běh má strop kolem 100 s (`drip_run_deadline_ms`). V 20:20 už hodinový tik doběhl a další je až v 21:00.

Mimo tohle okno jsou i další mailové joby z repa:

- `client-remind` v neděli, `0 1`, `30 1` a `0 2` UTC (brzy ráno Praha).
- `koucink-konec-denne`, `0 7 * * *` UTC (ráno).
- `en-mailing-hodinove` (`15 * * * *`) je v repu zakomentovaný, nespouštět ho kvůli testu.

V okně může tisknout `odloz-koucink-bali` (`25 * * * *`). To je SQL odklad tratě, ne odeslání mailu. `ai-flags-notify` je v komentáři funkce každých 15 minut a píše jen Martinovi.

Před přepnutím si na Academy přečti živý rozvrh. Když v 20:20 až 20:55 Praha visí zákaznická rozesílka, okno neber.

```sql
select jobid, jobname, schedule, active
from cron.job
order by schedule, jobname;
```

Na appce `kfkmghvhqwqtsalqjmrp` pg_cron podle `akademie/_supabase/kontrola-rozbory-cron.sql` není. `MAIL_PROVIDER` se tam stejně přepíná, protože appka posílá vlastní maily stejným přepínačem.

## 1. Testovací mail (ještě před ostrým přepnutím)

Až je `ses-test` nasazený a Claude volání schválil. JWT je přihlášený admin z `app_config.admin_emails`. Do příkazu nepatří hodnota tokenu, sem se neopisuje.

```bash
curl -sS -X POST \
  'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/ses-test' \
  -H 'Authorization: Bearer <admin JWT>' \
  -H 'Content-Type: application/json' \
  -d '{"to":"success@simulator.amazonses.com","subject":"SES simulator"}'
```

Předmět funkce vždy začne na `TEST`. Povolené adresy, jinak 403:

- `success@simulator.amazonses.com`
- `bounce@simulator.amazonses.com`
- `complaint@simulator.amazonses.com`
- `fitness.barna+tester@gmail.com`

Odpověď má `ok: true` a `provider_id` (SES `MessageId`). Pak:

```sql
select id, created_at, type, provider_id, lead_id,
       detail->>'test' as test,
       detail->>'via' as via,
       detail->>'email' as email
from email_events
where type = 'test'
  and detail->>'via' = 'ses-test'
  and created_at > now() - interval '30 minutes'
order by created_at desc;
```

Čekáš řádek s neprázdným `provider_id`, `detail.test = true`, `lead_id` null.

Bounce nebo complaint simulatoru dorazí do `ses-events`. Spárovaná stopa nemá `sparovano_podle = nesparovano` a `leads` se nezmění:

```sql
select created_at, type, provider_id, lead_id,
       detail->>'sparovano_podle' as sparovano_podle,
       detail->>'of' as of
from email_events
where created_at > now() - interval '40 minutes'
  and (
    provider_id = '<MessageId z ses-test>'
    or detail->>'provider_id' = '<MessageId z ses-test>'
  )
order by created_at;
```

```sql
select id, email, status, updated_at
from leads
where updated_at > now() - interval '40 minutes'
order by updated_at desc
limit 50;
```

U testu a u bounce bez leadu ten druhý select nemá nový `bounced` ani `unsubscribed` způsobený tímhle mailem. Když `sparovano_podle` je `nesparovano`, na SES se nepřepíná: stopa se nenašla.

## 2. Přepnutí

Nejdřív Academy, ověř jeden další testovací mail a selecty výš, pak appka.

```bash
supabase secrets set MAIL_PROVIDER=ses --project-ref uhmrpfsdcujbhbtumqye
supabase secrets set MAIL_PROVIDER=ses --project-ref kfkmghvhqwqtsalqjmrp
```

Edge funkce si env načtou na dalším cold startu. Po příkazu počkej, až nová instance opravdu vidí `ses` (další běh, ne rozjetý drip z minuty 0).

Kontrola, že ostré odeslání (když v okně nějaké je) nese SES id a že se leadi nemění omylem:

```sql
select created_at, type, provider_id, lead_id, detail->>'via' as via
from email_events
where created_at > now() - interval '40 minutes'
  and type in ('sent', 'test', 'odeslano', 'px_odeslano', 'oneoff', 'affiliate_report', 'affiliate_report-test', 'bounce', 'complaint', 'alert_nesparovano')
order by created_at desc
limit 100;
```

Inventura stop je v `docs/MAIL-ODESILANI.md`. Nové odeslání má `provider_id`. Když id řádek nenajde, `ses-events` zkusí adresu příjemce v okně 14 dní a zapíše `sparovano_podle=prijemce`. `nesparovano` u mailu odeslaného až po tomhle nasazení je důvod nepokračovat: stopa se nezapsala, nebo záloha nic nenašla. Důvod k rollbacku je chyba odeslání, nebo zmrazení leadu, které select výš nečekal. Bounce simulátoru a bounce jen Martinovy adresy lead nemění.

## 3. Rollback

Okamžitě, na obou projektech, zpět na Resend:

```bash
supabase secrets set MAIL_PROVIDER=resend --project-ref uhmrpfsdcujbhbtumqye
supabase secrets set MAIL_PROVIDER=resend --project-ref kfkmghvhqwqtsalqjmrp
```

Prázdný `MAIL_PROVIDER` se chová stejně jako `resend`. Rollback se dělá explicitním `resend`, ať je v seznamu secretů vidět záměr. Hodnoty ostatních secretů se nemění.

Po rollbacku stejné selecty: nové `sent` / `odeslano` zase chodí, `leads.status` se nehýbe kvůli testu.
