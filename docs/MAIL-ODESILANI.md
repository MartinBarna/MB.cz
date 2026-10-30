# Inventura odesílání mailů (posliMail a odesliPresResend)

Stav kódu: větev s `ses-test`, 29. 10. 2026.
Rozsah: `akademie/_supabase/functions/`, bez testů a bez definicí v `_shared/mail-provider.ts`.

Každý řádek je jedno volání. `odesliPresResend` sám volá `posliMail` na
`akademie/_supabase/functions/_shared/resend-odeslat.ts:220`. Ten řádek je společný
transport, ne samostatná obchodní cesta. Výchozí `MAIL_PROVIDER` (prázdné) je Resend.
Přepínač se nemění.

Sloupec stopa znamená: po úspěchu vznikne řádek v `email_events` a má `provider_id`
z odpovědi poskytovatele (Resend `id` nebo SES `MessageId`). Bez toho `ses-events`
bounce nespáruje (`sparovano_podle = nesparovano`) a lead se sám nezmrazí.

Třída je hodnota z `_shared/mailing-guard.ts` (`PATH_CLASS`), když ji volající nastaví.
Jinak je tu slovní popis. Alert Martinovi bránou neprochází schválně.

## posliMail

| Soubor:řádek | Funkce | From | Třída | Stopa s provider_id |
|---|---|---|---|---|
| `ses-test/core.ts:102` | `posliVzdySes` (handler `handleSesTest`) | `Martin Barna <news@martinbarna.cz>` | test (mimo bránu, jen allowlist) | ano, `type=test`, `detail.test=true` |
| `simpleshop-webhook/index.ts:89` | `alertAdmin` | `Barna Academy <news@martinbarna.cz>` | alert Martinovi | ne (při chybě se píše `type=error` bez `provider_id`) |
| `withdrawal/index.ts:65` | `resend` (volá ji handler: potvrzení zákazníkovi i alert Martinovi) | `Martin Barna <news@martinbarna.cz>` | právní potvrzení odstoupení + alert, mimo `PATH_CLASS` | ne |
| `poukaz-vydat/lib/mail.ts:82` | `sendVoucherMail` | `Martin Barna <news@martinbarna.cz>` (`MAIL_FROM` v `index.ts`) | `purchase_delivery` | ano, `zapisOdeslani` v `poukaz-vydat/index.ts` (`type` výchozí `odeslano`) |
| `grant-videokurz-z-appky/index.ts:85` | `alertAdmin` | `Barna Academy <news@martinbarna.cz>` | alert Martinovi | ne (`type=error` bez `provider_id`) |
| `grant-videokurz-z-appky/index.ts:177` | `deps.posliMail` (volá `core.ts:523`) | `Martin Barna <news@martinbarna.cz>` | `entitlement_delivery` | ano, `zalogujOdeslani`, `type=sent` |
| `intake-capture/index.ts:73` | `resend` (alert s odpověďmi dotazníku) | `Martin Barna <news@martinbarna.cz>` | alert Martinovi | ne |
| `link-check/index.ts:189` | `alertAdmin` | `Barna Academy <news@martinbarna.cz>` | alert Martinovi | ne (`type=error` bez `provider_id`) |
| `daily-digest/index.ts:781` | handler ranního přehledu | `Barna Academy <news@martinbarna.cz>` | provozní přehled Martinovi | ne |
| `drip-send/index.ts:301` | `sendViaResend` (ostrý běh, test, oneoff) | `Martin Barna <news@martinbarna.cz>` | marketing (drip) | ano. Ostrý běh `type=sent`, test `type=test`. Oneoff `type=oneoff` má `provider_id`, ale ten typ není v `TYPY_ODESLANI`, takže bounce se nespáruje |
| `en-lead/index.ts:262` | `upozorniMartina` | `Web MB.cz <news@martinbarna.cz>` | alert Martinovi | ne |
| `en-mailing/index.ts:66` | `sendResend` (test i ostrý krok) | `Martin Barna <news@martinbarna.cz>` | marketing EN, mimo `PATH_CLASS` | ne v `email_events`. `provider_id` je v `en_mail_log`, `ses-events` ho nevidí |
| `affiliate-mesicni-report/index.ts:189` | callback `sendIfAllowed` | `Martin Barna <news@martinbarna.cz>` | `partner_report` | ne. Řádek `email_events` vznikne, ale bez `provider_id` |
| `ai-flags-notify/index.ts:184` | handler | `NOTIFY_FROM`, jinak `Martin Barna <news@martinbarna.cz>` | alert Martinovi | ne |
| `ai-martin/cap-notify.ts:218` | `notifyCap` | `opts.notifyFrom`, jinak `Martin Barna <news@martinbarna.cz>` | alert Martinovi (strop AI) | ne (značka je v `ai_usage`, ne v `email_events`) |
| `app-purchase-bridge/index.ts:75` | `alertAdmin` | `Barna Academy <news@martinbarna.cz>` | alert Martinovi | ne |
| `checkin-capture/index.ts:58` | `sendResend` (jen `mode=remind`) | `Martin Barna <news@martinbarna.cz>` | `optional_reminder` (`checkin-capture.remind`) | ne |
| `contact-send/index.ts:102` | handler poptávky | `Web MB.cz <news@martinbarna.cz>` | poptávka Martinovi | ne |
| `academy-stripe-webhook/index.ts:758` | `alertAdmin` | `Barna Academy <news@martinbarna.cz>` | alert Martinovi | ne |
| `_shared/koucink-onboarding.ts:409` | `posliUvitaciMail` | `Martin Barna <news@martinbarna.cz>` | `client_operational` | ne |

## odesliPresResend

| Soubor:řádek | Funkce | From | Třída | Stopa s provider_id |
|---|---|---|---|---|
| `splatky-guard/index.ts:136` | `sendMail` | `Martin Barna <news@martinbarna.cz>` | zákazník: `billing_transactional`. Alert Martinovi jde stejnou funkcí bez stopy | ano jen když volající předá `stopa` (zákaznický mail). Alert ne |
| `study-reminder/index.ts:136` | `send` | `Martin Barna <news@martinbarna.cz>` | `optional_reminder` | ano (`via=study-reminder`) |
| `resend-webhook/index.ts:361` | alert nespárovaného bounce | `Martin Barna <news@martinbarna.cz>` | alert Martinovi | ne |
| `ses-events/core.ts:262` | `alertNesparovano` | `Martin Barna <news@martinbarna.cz>` | alert Martinovi | ne |
| `konzultace-pripominka/index.ts:113` | `souhrnMartinovi` | `Martin Barna <news@martinbarna.cz>` | alert Martinovi | ne |
| `konzultace-pripominka/index.ts:237` | mail klientovi | `Martin Barna <news@martinbarna.cz>` | `client_operational` | ano |
| `koucink-konec/index.ts:230` | `alert` | `Martin Barna <news@martinbarna.cz>` | alert Martinovi | ne |
| `koucink-konec/index.ts:332` | `deps.posliMail` | `Martin Barna <news@martinbarna.cz>` | `client_operational` (potvrzení) a `marketing` (prodejní blok) | ano (`via=koucink-konec`) |
| `milestones/index.ts:203` | `send` | `Martin Barna <news@martinbarna.cz>` | členský milník, mimo `PATH_CLASS` | ano po úspěchu, volající zapíše `type=px_odeslano`. Samotný helper stopu nedostane |
| `order-rescue/index.ts:191` | `send` | `Martin Barna <news@martinbarna.cz>` | zákazník: `optional_reminder`. `alertMartinovi` volá totéž `send` | ano jen u zákaznického úspěchu (`px_odeslano`). Alert stopu s `provider_id` nezapíše |
| `client-remind/index.ts:206` | `alertMartinovi` | `Martin Barna <news@martinbarna.cz>` | alert Martinovi | ne |
| `client-remind/index.ts:665` | smyčka připomínek | `Martin Barna <news@martinbarna.cz>` | `client_operational` | ano (`detail.test` u testovacího režimu) |
| `client-report/index.ts:330` | `send` (kopie Martinovi i klientovi) | `Martin Barna <news@martinbarna.cz>` | provozní report, mimo `PATH_CLASS` | ano. U Martina helper adresu do `detail.email` nedá, `provider_id` v řádku je |
| `academy-stripe-webhook/index.ts:1664` | `posliDoklad` | `Martin Barna <news@martinbarna.cz>` | doklad o zaplacení, mimo `PATH_CLASS` | ano (`via=academy-stripe-webhook.doklad`) |
| `academy-stripe-webhook/index.ts:2301` | opakovaná konzultace | `Martin Barna <news@martinbarna.cz>` | doručení nákupu | ano, typ `konzultace_znovu_doruceno` |
| `academy-stripe-webhook/index.ts:2390` | opakovaný balíček | `Martin Barna <news@martinbarna.cz>` | `purchase_delivery` (soubory znovu) | ano, typ `balicek_znovu_doruceno` |
| `admin-api/index.ts:4449` | `client_offboard` přes `odesliSRazitkem` | `Martin Barna <news@martinbarna.cz>` | `client_operational` a případně `marketing` | ano (`via=admin-api.client_offboard`) |
| `_shared/ceny.ts:257` | `alertCeny` | `Martin Barna <news@martinbarna.cz>` | alert Martinovi (nenačtená cena) | ne. Značka `type=alert_ceny` je bez `provider_id` |

Uvítací mail koučinku z `admin-api` (`client_invite`) nejde přes `admin-api/index.ts`, ale přes `_shared/koucink-onboarding.ts:409` v tabulce výš.

## Cesty bez stopy: SES bounce zůstane nespárovaný

`ses-events` hledá původní odeslání v `email_events` podle `provider_id` a jen v typech
`sent`, `test`, `px_odeslano`, `odeslano`, `konzultace_znovu_doruceno`, `balicek_znovu_doruceno`.
Když řádek chybí, nebo v něm není `provider_id`, výsledek je `sparovano_podle = nesparovano`.
Lead se nezmrazí. U trvalého bounce nebo complaint, který není test, odejde alert Martinovi.

Tyhle zákaznické a partnerské cesty stopu s `provider_id` nemají. Po přepnutí na SES
jejich bounce sám nikoho neodhlásí:

- `koucink-onboarding` (`posliUvitaciMail`): uvítání klienta koučinku.
- `checkin-capture` remind: týdenní check-in člena.
- `intake-capture`: mail Martinovi s vyplněným dotazníkem (příjemce je admin, ne klient, ale `MessageId` se nikam nezapíše).
- `withdrawal`: potvrzení odstoupení zákazníkovi i alert Martinovi.
- `affiliate-mesicni-report`: partner. Řádek v `email_events` je, `provider_id` v něm není.

Stejně nespárované, protože `email_events.provider_id` nevznikne:

- alerty Martinovi: `simpleshop-webhook`, `grant-videokurz` alert, `link-check`, `daily-digest`, `en-lead`, `ai-flags-notify`, `cap-notify`, `app-purchase-bridge`, `contact-send`, `academy-stripe-webhook` alert, `resend-webhook` alert, `ses-events` alert, souhrn `konzultace-pripominka`, alert `koucink-konec`, alert `client-remind`, alert `order-rescue`, `alertCeny`.
- `en-mailing`: `provider_id` leží v `en_mail_log`, ne v `email_events`.
- `drip-send` oneoff: `provider_id` v `email_events` je, typ `oneoff` v seznamu párování není.

Cesty, které stopu mají a bounce spárovat umí: drip (ostrý `sent` a test `type=test`), `study-reminder`, `client-remind` (zákazník), `client-report`, `milestones`, `order-rescue` (zákazník), `splatky-guard` (zákazník), `poukaz-vydat`, `grant-videokurz` (zákazník), `konzultace-pripominka` (klient), `koucink-konec` (rozloučení), `admin-api` offboard, doklad a opakované doručení ve Stripe webhooku, a `ses-test`.
