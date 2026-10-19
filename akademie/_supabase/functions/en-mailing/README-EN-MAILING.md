# EN mailing: 5 úvodních mailů pro leady z martinbarna.cz/en/

Stav 13. 10. 2026: **napsáno a otestováno lokálně, NIC NENASAZENO, automat VYPNUTÝ.**
Větev `en-mailing-1013` (repo MB.cz), commit jen lokálně.

## Co to dělá

Lead z `/en/` (formulář kit, `/en/calculator/`, `/en/workout/`) dostane 5 mailů:

| Krok | Den od startu | Předmět |
|---|---|---|
| 1 | 0 (do hodiny) | Your numbers + the Eating Out Playbook (bez čísel: Your Eating Out Playbook + the two numbers that matter) |
| 2 | 2 | Up 1.4 kg this morning. It wasn't fat. |
| 3 | 4 | The minimum version (for the week that falls apart) |
| 4 | 6 | Weekend math: 5 days of work, 2 days that erase it |
| 5 | 8 | Want me to set this up for you? |

Texty: `_Claude-dokumenty/2026-10-13_en-klienti/texty/emails-en-1-5.md`, v kódu `logic.ts`.

Pravidla (vše v `logic.ts`, každé má test v `logic_test.ts`):
- Start série = **nejstarší** lead daného e-mailu s `kind` kit, calculator nebo workout. Jedna série na e-mail.
- `application` sérii nespouští. A když e-mail má přihlášku (i později), série se zastaví (`SKIP_IF_APPLIED`): ten člověk je v osobní konverzaci s Martinem a prodejní mail 5 by mu přišel navíc.
- Podmínka `consent = true` u startovního leadu.
- Odhlášený (`en_unsubscribes`) nedostane nic.
- Další krok = nejvyšší zalogovaný + 1. Krok se **spotřebuje i při selhání** (`failed`, `sending`), nic se neopakuje, nikdy se nejde zpátky.
- Mezi dvěma maily téhož člověka aspoň 20 h (po pauze se dohání po jednom mailu denně).
- Krok 1 nezačne, když je start starší než 14 dní (`MAX_START_AGE_DAYS`).
- Max 50 mailů za běh, nejstarší starty první. Běh se zastaví po 3 selháních Resendu nebo po 100 s.
- Testovací řádky (`first_name` TEST-CLAUDE, e-mail fitness.barna@gmail.com) jen v náhledu.
- Razítko `en_mail_log` (unique `lead_email` + `step`) se zapisuje **před** Resendem. Souběžný běh dostane konflikt a mail nepošle.
- Mail 1 bez výsledku kalkulačky (typicky workout) jde ve variantě bez čísel s odkazem na kalkulačku. Tahle varianta je dopsaná v kódu, v .md doslova není. Hlasem prošlá 19. 10. 2026 (oba mail 1 i maily 2 až 5), schválení Martin.
- `{{price_block}}` je prázdný (ceny nikdy v kódu), v mailu 5 se nezobrazí.
- Odesílatel `Martin Barna <news@martinbarna.cz>`, `reply_to` `martin@martinbarna.cz` (mail 1 a 5 žádají o odpověď).

## Soubory

| Soubor | Co |
|---|---|
| `akademie/_supabase/en-mailing-2026-10-13.sql` | tabulky `en_mailing_config` (enabled false), `en_mail_log`, `en_unsubscribes`; RLS bez politik, revoke |
| `akademie/_supabase/en-mailing-cron-2026-10-13.sql` | cron, **zakomentovaný** |
| `functions/en-mailing/index.ts` + `logic.ts` | odesílání (POST + `x-cron-secret`) |
| `functions/en-unsubscribe/index.ts` + `token.ts` | odhlášení |
| `en/unsubscribe/index.html` | webová stránka s tlačítkem (edge funkce HTML servírovat neumí) |
| `functions/en-mailing/logic_test.ts`, `handler_test.ts` | testy |

### Proč odhlášení vede přes webovou stránku
GET na `en-unsubscribe` nic nezapisuje, jen přesměruje na `https://martinbarna.cz/en/unsubscribe/?e=...&t=...`, kde člověk klikne na tlačítko (POST). Důvody: (1) Supabase edge funkce přepisuje `text/html` na `text/plain` (stejná past jako u české `unsubscribe`), (2) firemní mailové skenery otevírají odkazy z mailů a GET se zápisem by tiše odhlašoval. Skutečný one-click zajišťuje hlavička `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058): Gmail a Apple Mail posílají POST přímo na funkci.
⚠️ V odkazu je e-mail (`?e=`), proto stránka nemá analytics a má `referrer no-referrer`.

## Testy (lokálně, bez sítě a bez DB)

```
cd akademie/_supabase/functions/en-mailing
deno test --no-lock --allow-env          # logic_test.ts (27) + handler_test.ts (10)
deno check --no-lock index.ts ../en-unsubscribe/index.ts
```
`handler_test.ts` zachytí `Deno.serve`, Supabase napodobí v paměti a Resend jen počítá.
⚠️ Když deno hlásí „Loading unprepared module ... auth-js", je rozbitá cache: `DENO_DIR=<prázdná složka>`.

## Nasazení (šéf, po revizi; každý krok zvlášť potvrdit)

Projekt Academy `uhmrpfsdcujbhbtumqye`. ⛔ Vždy `--project-ref`. ⛔ Celá složka (wipe + `cp -r`), ne jen `index.ts` (paměť `mb-deploy-kopiruje-jen-index-past`).

1. **Migrace:** obsah `akademie/_supabase/en-mailing-2026-10-13.sql` přes SQL editor / MCP `apply_migration`. Pak ověřovací dotazy z konce souboru (enabled = false, RLS true, 0 politik, granty jen postgres + service_role).
2. **Secrets:**
   ```
   npx supabase secrets set EN_MAILING_SECRET=<náhodných 32+ znaků> --project-ref uhmrpfsdcujbhbtumqye
   npx supabase secrets set EN_UNSUB_SECRET=<náhodných 32+ znaků> --project-ref uhmrpfsdcujbhbtumqye
   ```
   `EN_UNSUB_SECRET` je volitelný, ale **doporučený**: bez něj je klíč tokenu odvozený ze service-role klíče a jeho rotace by zneplatnila odhlašovací odkazy ve všech už odeslaných mailech. ⛔ Nastavit PŘED prvním ostrým mailem a pak už neměnit. `RESEND_API_KEY` už v projektu je (používá ho `en-lead`).
   Stejnou hodnotu `EN_MAILING_SECRET` uložit pro cron:
   ```sql
   insert into public.app_config (key, value) values ('en_mailing_secret', '<stejná hodnota>')
   on conflict (key) do update set value = excluded.value;
   ```
3. **Funkce:**
   ```
   rm -rf supabase/functions/en-mailing supabase/functions/en-unsubscribe
   mkdir -p supabase/functions
   cp -r akademie/_supabase/functions/en-mailing akademie/_supabase/functions/en-unsubscribe supabase/functions/
   npx supabase functions deploy en-unsubscribe --project-ref uhmrpfsdcujbhbtumqye --no-verify-jwt
   npx supabase functions deploy en-mailing     --project-ref uhmrpfsdcujbhbtumqye --no-verify-jwt
   rm -rf supabase
   ```
   Pak stáhnout zpět a porovnat (skill `kontrola-nasazeni`).
4. **Web:** merge větve do `main` a Wedos deploy přes Actions (push sám nenasadí). Ověřit, že `https://martinbarna.cz/en/unsubscribe/` bez parametrů ukáže „This link doesn't work".
5. **Sondy (nic neposílají):**
   ```
   curl -s -X GET  https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/en-mailing                       # 405
   curl -s -X POST https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/en-mailing                       # 401
   curl -s -X POST https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/en-unsubscribe?e=x%40y.cz&t=zz  # 400 {"error":"link"}
   ```
6. **Náhled (dry-run, nic neposílá):**
   ```
   curl -s -X POST https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/en-mailing \
     -H "x-cron-secret: <EN_MAILING_SECRET>" -H "Content-Type: application/json" -d '{}'
   ```
   Čekám `"mode":"dry","enabled":false` a seznam `items` (lead_id, maska e-mailu, krok). Projít, jestli sedí, komu by co šlo.
7. **Testovací maily (jen na fitness.barna@gmail.com, nic se nezapisuje):** `-d '{"test_step":1}'`, `-d '{"test_step":1,"test_no_calc":true}'`, pak 2 až 5. V doručeném mailu: vzhled, odkazy (klik), odpověď jde na martin@, **odhlášení klikem z mailu** (stránka -> tlačítko -> „You're unsubscribed") a v Gmailu tlačítko „Odhlásit odběr". Po testu odhlášení smazat testovací adresu:
   ```sql
   delete from public.en_unsubscribes where email = 'fitness.barna@gmail.com';
   ```
8. **Cron:** odkomentovat a spustit `akademie/_supabase/en-mailing-cron-2026-10-13.sql`. Dokud je vypínač vypnutý, každý běh je jen náhled.

## Zapnutí (jen Martin)

```sql
update public.en_mailing_config set enabled = true, updated_at = now(), note = 'Zapnul Martin <datum>' where id = true;
```
Ověření: `select enabled, updated_at from public.en_mailing_config;` a po nejbližším běhu cronu (minuta 15) `select status_code, content::text from net._http_response order by created desc limit 3;` musí ukázat `"mode":"live"`.

## Vypnutí (kdokoli, okamžitě)

```sql
update public.en_mailing_config set enabled = false, updated_at = now(), note = 'Vypnuto <kdo, proč>' where id = true;
```
Platí od dalšího běhu. Rozjeté série se po zapnutí dokončí podle pravidel (20 h mezera, žádný krok dvakrát). Úplné zastavení i cronu: `select cron.unschedule('en-mailing-hodinove');`.

Ruční odhlášení (někdo napíše „unsubscribe"):
```sql
insert into public.en_unsubscribes (email, source) values (lower('<email>'), 'manual') on conflict (email) do nothing;
```

## Co hlídat

- **Log:** `select status, count(*) from public.en_mail_log group by 1;` `failed` = Resend odmítl (sloupec `error`), krok se neopakuje. `sending` starší než hodina = výsledek neznámý (mail mohl odejít).
- **Kolik a komu:** `select step, count(*) from public.en_mail_log where status = 'sent' group by 1 order by 1;`
- **Odhlášení:** `select count(*), max(created_at) from public.en_unsubscribes;`
- ⚠️ **Bounce a stížnost na spam EN mailů NEZASTAVÍ.** `resend-webhook` páruje jen přes `email_events.provider_id`; EN maily mají `provider_id` v `en_mail_log`, takže webhook pošle Martinovi alert „nespárováno" a série jede dál. Do dořešení: při alertu ručně vložit adresu do `en_unsubscribes` (viz výše). Dořešení = samostatný úkol do `resend-webhook`.
- ⚠️ **Další EN maily** (`mailing-en/`, týdenní) musí `en_unsubscribes` respektovat taky: stránka odhlášení slibuje „no more emails from me in English".
- Časy jsou v UTC. Mail 1 chodí do hodiny po přihlášení, ostatní ve stejnou hodinu dne jako přihlášení (± hodina).
