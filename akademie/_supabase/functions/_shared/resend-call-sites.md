# Statický inventář `api.resend.com/emails` (9 unsubscribe-bypass cest)

Datum: 2026-09-07
Větev: `fix/unsub-send-policy`
Politika: `_shared/mailing-guard.ts` (Martin LOCK 7. 9. 2026)

Žádný z těchto call site se nenasazuje v tomhle commitu. Inventář je kontrola,
že customer send má před Resendem `mailing-guard`.

## Cesty v rozsahu (9 pojmenovaných, 10 send větví)

| # | Funkce / větev | Soubor s fetch | Třída | Guard |
|---|---|---|---|---|
| 1 | study-reminder | `study-reminder/index.ts` `send()` | optional_reminder | `sendIfAllowed` před `send()` (live i TEST) |
| 2 | client-remind | `client-remind/index.ts` | client_operational | `guardSend` v smyčce před fetch |
| 3 | order-rescue | `order-rescue/index.ts` `send()` | optional_reminder | `sendIfAllowed` (live i TEST) |
| 4 | checkin-capture remind | `checkin-capture/index.ts` `sendResend()` | optional_reminder | `sendIfAllowed` jen v `mode=remind` |
| 5 | splatky-guard | `splatky-guard/index.ts` `sendMail()` | billing_transactional | `sendMailGuarded` → `sendIfAllowed` |
| 6 | affiliate-mesicni-report | `affiliate-mesicni-report/index.ts` | partner_report | `sendIfAllowed` před fetch; dry=1 fetch nevolá |
| 7 | poukaz-vydat | `poukaz-vydat/lib/mail.ts` `sendVoucherMail()` | purchase_delivery | `guardMail` v `core.ts` / `index.ts` před `sendMail` |
| 8 | grant-videokurz-z-appky (zákazník) | `grant-videokurz-z-appky/index.ts` `posliMail` | entitlement_delivery | `decideSend` v `core.ts` před `posliMail` |
| 9a | admin-api client_invite | `_shared/koucink-onboarding.ts` | client_operational | `guardSend` před fetch |
| 9b | admin-api client_offboard | `admin-api/index.ts` | confirm = client_operational, sales = marketing | confirm skip = žádný mail; sales skip = mail bez prodejního bloku |

## Call sites mimo customer send (v týchž složkách, bez marketing guardu)

| Soubor | Řádek (orientačně) | Proč není v politice |
|---|---|---|
| `grant-videokurz-z-appky/index.ts` `alertAdmin` | fetch na `api.resend.com/emails` | alert Martinovi (`admin_emails` / `fitness.barna@gmail.com`), ne zákazník |

## LOCK 7. 9. 2026 (co guard dělá)

- Hard bounce (`leads.status=bounced`): skip u všech tříd.
- Hard unsub (`odhlaseni_trvale` nebo `leads.status=unsubscribed`): skip `marketing` a `optional_reminder`. KEEP `client_operational`, `partner_report`, `billing_transactional`, `purchase_delivery`, `entitlement_delivery`.
- `grant-videokurz-z-appky`: i po unsub udělí přístup a pošle doručovací mail; aktivní marketingový lead se nezakládá.
- `client_offboard`: `tiche=true` pořád bez mailu.

## Ověření

```
npx --yes deno@2 run akademie/_supabase/functions/_shared/mailing-guard.test.ts
npx --yes deno@2 run akademie/_supabase/functions/admin-api/offboard-mail.test.ts
npx --yes deno@2 run akademie/_supabase/functions/grant-videokurz-z-appky/core.test.ts
npx --yes deno@2 test --no-lock akademie/_supabase/functions/poukaz-vydat/__tests__/core.test.ts
npx --yes deno@2 run --allow-read akademie/_supabase/functions/_shared/resend-call-sites.test.ts
```
