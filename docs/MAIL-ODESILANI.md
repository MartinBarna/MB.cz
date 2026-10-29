# Inventura odesílání mailů (posliMail a odesliPresResend)

Stav kódu: větev se stopou `provider_id` na všech cestách Academy, 29. 10. 2026.
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
| `simpleshop-webhook/index.ts` | `alertAdmin` | `Barna Academy <news@martinbarna.cz>` | alert Martinovi | ano po úspěchu, `via=simpleshop-webhook`. Řádek `type=error` před odesláním zůstává a `provider_id` nemá |
| `withdrawal/index.ts` | `resend` (potvrzení zákazníkovi i alert Martinovi) | `Martin Barna <news@martinbarna.cz>` | právní potvrzení odstoupení + alert, mimo `PATH_CLASS` | ano. Zákazník `via=withdrawal.potvrzeni`. Alert `via=withdrawal.alert` (Martin, adresa ve stopě není) |
| `poukaz-vydat/lib/mail.ts:82` | `sendVoucherMail` | `Martin Barna <news@martinbarna.cz>` (`MAIL_FROM` v `index.ts`) | `purchase_delivery` | ano, `zapisOdeslani` v `poukaz-vydat/index.ts` (`type` výchozí `odeslano`) |
| `grant-videokurz-z-appky/index.ts` | `alertAdmin` | `Barna Academy <news@martinbarna.cz>` | alert Martinovi | ano po úspěchu, `via=grant-videokurz-z-appky.alert`. Řádek `type=error` je dál bez `provider_id` |
| `grant-videokurz-z-appky/index.ts:177` | `deps.posliMail` (volá `core.ts:523`) | `Martin Barna <news@martinbarna.cz>` | `entitlement_delivery` | ano, `zalogujOdeslani`, `type=sent` |
| `intake-capture/index.ts` | `resend` (alert s odpověďmi dotazníku) | `Martin Barna <news@martinbarna.cz>` | alert Martinovi | ano, `via=intake-capture`. Do `detail` nejdou odpovědi ani e-mail klienta |
| `link-check/index.ts` | `alertAdmin` | `Barna Academy <news@martinbarna.cz>` | alert Martinovi | ano po úspěchu, `via=link-check`. Řádek `type=error` je dál bez `provider_id` |
| `daily-digest/index.ts` | handler ranního přehledu | `Barna Academy <news@martinbarna.cz>` | provozní přehled Martinovi | ano, `via=daily-digest` |
| `drip-send/index.ts` | `sendViaResend` (ostrý běh, test, oneoff) | `Martin Barna <news@martinbarna.cz>` | marketing (drip) | ano. Ostrý běh `type=sent`, test `type=test`, oneoff `type=oneoff`. `oneoff` je v `TYPY_ODESLANI` |
| `en-lead/index.ts` | `upozorniMartina` | `Web MB.cz <news@martinbarna.cz>` | alert Martinovi | ano, `via=en-lead`. Do stopy nejde jméno ani text přihlášky |
| `en-mailing/index.ts` | `sendResend` (test i ostrý krok) | `Martin Barna <news@martinbarna.cz>` | marketing EN, mimo `PATH_CLASS` | ano v `email_events` (`odeslano`, test `type=test`) i v `en_mail_log`. `lead_id` z `en_leads` se do `email_events` nepíše |
| `affiliate-mesicni-report/index.ts` | callback `sendIfAllowed` | `Martin Barna <news@martinbarna.cz>` | `partner_report` | ano. Idempotence dál stojí na `affiliate_report` / `affiliate_report-test`, řádek teď má `provider_id`. Oba typy jsou v `TYPY_ODESLANI`. Test má `detail.test` |
| `ai-flags-notify/index.ts` | handler | `NOTIFY_FROM`, jinak `Martin Barna <news@martinbarna.cz>` | alert Martinovi | ano, `via=ai-flags-notify` |
| `ai-martin/cap-notify.ts` | `notifyCap` | `opts.notifyFrom`, jinak `Martin Barna <news@martinbarna.cz>` | alert Martinovi (strop AI) | ano, `via=ai-martin.cap-notify`. Značka v `ai_usage` zůstává. Do stopy nejde e-mail člověka, který strop vyčerpal |
| `app-purchase-bridge/index.ts` | `alertAdmin` | `Barna Academy <news@martinbarna.cz>` | alert Martinovi | ano, `via=app-purchase-bridge` |
| `checkin-capture/index.ts` | `sendResend` (jen `mode=remind`) | `Martin Barna <news@martinbarna.cz>` | `optional_reminder` (`checkin-capture.remind`) | ano, `via=checkin-capture.remind`, typ `odeslano` |
| `contact-send/index.ts` | handler poptávky | `Web MB.cz <news@martinbarna.cz>` | poptávka Martinovi | ano, `via=contact-send`. Do stopy nejde jméno ani text poptávky |
| `academy-stripe-webhook/index.ts` | `alertAdmin` | `Barna Academy <news@martinbarna.cz>` | alert Martinovi | ano, `via=academy-stripe-webhook.alert` |
| `_shared/koucink-onboarding.ts` | `posliUvitaciMail` | `Martin Barna <news@martinbarna.cz>` | `client_operational` | ano, `via=koucink-onboarding`, `detail.bcc` (kopie Martinovi) |

## odesliPresResend

| Soubor:řádek | Funkce | From | Třída | Stopa s provider_id |
|---|---|---|---|---|
| `splatky-guard/index.ts` | `sendMail` | `Martin Barna <news@martinbarna.cz>` | zákazník: `billing_transactional`. Alert Martinovi jde stejnou funkcí | ano. Zákazník má svou stopu. Alert `via=splatky-guard.alert` (adresa Martina ve stopě není) |
| `study-reminder/index.ts:136` | `send` | `Martin Barna <news@martinbarna.cz>` | `optional_reminder` | ano (`via=study-reminder`) |
| `resend-webhook/index.ts` | alert nespárovaného bounce | `Martin Barna <news@martinbarna.cz>` | alert Martinovi | ano, `via=resend-webhook.alert` |
| `ses-events/core.ts` | `alertNesparovano` | `Martin Barna <news@martinbarna.cz>` | alert Martinovi | ano, `via=ses-events.alert` |
| `konzultace-pripominka/index.ts` | `souhrnMartinovi` | `Martin Barna <news@martinbarna.cz>` | alert Martinovi | ano, `via=konzultace-pripominka.souhrn` |
| `konzultace-pripominka/index.ts:237` | mail klientovi | `Martin Barna <news@martinbarna.cz>` | `client_operational` | ano |
| `koucink-konec/index.ts` | `alert` | `Martin Barna <news@martinbarna.cz>` | alert Martinovi | ano, `via=koucink-konec.alert` |
| `koucink-konec/index.ts:332` | `deps.posliMail` | `Martin Barna <news@martinbarna.cz>` | `client_operational` (potvrzení) a `marketing` (prodejní blok) | ano (`via=koucink-konec`) |
| `milestones/index.ts:203` | `send` | `Martin Barna <news@martinbarna.cz>` | členský milník, mimo `PATH_CLASS` | ano po úspěchu, volající zapíše `type=px_odeslano`. Samotný helper stopu nedostane |
| `order-rescue/index.ts` | `send` | `Martin Barna <news@martinbarna.cz>` | zákazník: `optional_reminder`. `alertMartinovi` volá totéž `send` | ano. Zákazník `px_odeslano`. Alert `via=order-rescue.alert` (druhý řádek, typ `odeslano`) |
| `client-remind/index.ts` | `alertMartinovi` | `Martin Barna <news@martinbarna.cz>` | alert Martinovi | ano, `via=client-remind.alert`. Adresa Martina ve stopě není |
| `client-remind/index.ts:665` | smyčka připomínek | `Martin Barna <news@martinbarna.cz>` | `client_operational` | ano (`detail.test` u testovacího režimu) |
| `client-report/index.ts:330` | `send` (kopie Martinovi i klientovi) | `Martin Barna <news@martinbarna.cz>` | provozní report, mimo `PATH_CLASS` | ano. U Martina helper adresu do `detail.email` nedá, `provider_id` v řádku je |
| `academy-stripe-webhook/index.ts:1664` | `posliDoklad` | `Martin Barna <news@martinbarna.cz>` | doklad o zaplacení, mimo `PATH_CLASS` | ano (`via=academy-stripe-webhook.doklad`) |
| `academy-stripe-webhook/index.ts:2301` | opakovaná konzultace | `Martin Barna <news@martinbarna.cz>` | doručení nákupu | ano, typ `konzultace_znovu_doruceno` |
| `academy-stripe-webhook/index.ts:2390` | opakovaný balíček | `Martin Barna <news@martinbarna.cz>` | `purchase_delivery` (soubory znovu) | ano, typ `balicek_znovu_doruceno` |
| `admin-api/index.ts:4449` | `client_offboard` přes `odesliSRazitkem` | `Martin Barna <news@martinbarna.cz>` | `client_operational` a případně `marketing` | ano (`via=admin-api.client_offboard`) |
| `_shared/ceny.ts` | `alertCeny` | `Martin Barna <news@martinbarna.cz>` | alert Martinovi (nenačtená cena) | ano po úspěchu, `via=alert-ceny`, typ `odeslano`. Značka `type=alert_ceny` (odstup 6 h) je dál bez `provider_id` a v párování není |

Uvítací mail koučinku z `admin-api` (`client_invite`) nejde přes `admin-api/index.ts`, ale přes `_shared/koucink-onboarding.ts:409` v tabulce výš.

## Párování SES bounce a complaint

`ses-events` hledá původní odeslání v `email_events` podle `provider_id` v typech
`sent`, `test`, `px_odeslano`, `odeslano`, `konzultace_znovu_doruceno`, `balicek_znovu_doruceno`,
`oneoff`, `affiliate_report`, `affiliate_report-test`.
Stejný seznam má `resend-webhook`.

Každá cesta v tabulkách výš po úspěšném `posliMail` (nebo přes `stopa` u `odesliPresResend`)
zapíše řádek s `provider_id`. Typ je `odeslano`, pokud už cesta nemá vlastní typ z toho seznamu.
`lead_id` se vyplní, jen když ho volající zná. `detail` nese `via` a u zákazníka e-mail
(podle něj se dohledá lead). Jméno, text zprávy, odpovědi dotazníku ani tělo poptávky tam nejsou.
Martinova adresa se do `detail.email` nepíše, helper ji nahradí `null` a `komu=martin`.
Selhání zápisu se zaloguje a hlavní akci neshodí.

Když `provider_id` řádek nenajde a dotaz se povedl, `ses-events` zkusí zálohu:
nejnovější odeslání na adresu z payloadu za posledních 14 dní (`OKNO_PRIJEMCE_MS`).
Martinovy adresy se v záloze nehledají. Shoda dostane `sparovano_podle=prijemce`.
Chyba té četby u bounce nebo complaint vrátí 500, ať to SNS zopakuje.
Pořád `nesparovano` znamená, že ani `provider_id`, ani záloha řádek nenašly
(nebo našly, ale lead k němu není a adresa v `leads` chybí).

Značky, které párování schválně nevidí, protože to nejsou odeslání:
`type=error` u alertů (píše se i když mail neodešel), `type=alert_ceny` (odstup 6 h)
a `type=info` u `link-check`. Vedle nich už leží řádek s `provider_id`.
