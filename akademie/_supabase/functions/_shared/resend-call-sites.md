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
| 10 | koucink-konec (automat) | `koucink-konec/index.ts` | confirm = client_operational, sales = marketing | `guardSend` před stavbou mailu, rozhodování v `koucink-konec/core.ts` |

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
npx --yes deno@2 run akademie/_supabase/functions/_shared/offboard-mail.test.ts
npx --yes deno@2 run akademie/_supabase/functions/grant-videokurz-z-appky/core.test.ts
npx --yes deno@2 test --no-lock akademie/_supabase/functions/poukaz-vydat/__tests__/core.test.ts
npx --yes deno@2 run --allow-read akademie/_supabase/functions/_shared/resend-call-sites.test.ts
```

---

## Doplněk 22. 9. 2026: rozloučení po konci koučinku

Šablona rozlučkového mailu se přestěhovala z `admin-api/offboard-mail.ts` do
`_shared/offboard-mail.ts`, protože ji staví DVĚ funkce: ruční odchod z admina
a automat `koucink-konec`. Obě jdou přes `guardSend` a obě odesílají přes
`_shared/resend-odeslat.ts`, takže `admin-api` už na Resend nevolá přímo.

⛔ Počet přímých `fetch` na Resend v rozsahu proto KLESL z devíti na osm a je to
posun k lepšímu, ne ztráta cesty. Kdo to číslo zvyšuje, přidává cestu mimo
helper a musí napsat proč.

## Doplněk 16. 9. 2026: `provider_id` a párování bouncu (nález V1)

Tenhle inventář hlídá bránu (kdo smí dostat mail). K 16. 9. 2026 k němu přibyla
druhá otázka: **kdo za sebou nechá stopu, podle které jde odmítnutý mail spárovat**.
`resend-webhook` hledá původní odeslání podle `provider_id`, takže cesta, která
odpověď Resendu nečte, nikdy nezastaví mrtvou adresu. Změřeno: ze 22 událostí
`bounce` se 7 nespárovalo vůbec.

Odesílání se proto sjednotilo do `_shared/resend-odeslat.ts`
(`odesliPresResend` / `zapisOdeslani`).

⛔ **Typ události je `px_odeslano`, ne `sent`.** `sent` čte `email_summary`,
`daily-digest` i denní strop v `drip-send`; kdyby tyhle cesty psaly `sent`,
ukusovaly by dripu z jeho stropu a nikde by to nekřiklo. Párování se místo toho
rozšířilo v `resend-webhook`, který `px_odeslano` bere do seznamu typů.

### Cesty, které stopu s `provider_id` mají (k 16. 9. 2026)

`drip-send`, `admin-api`, `grant-videokurz-z-appky`, `videokurz-onboarding`
(ty čtyři odjakživa) a nově `client-remind`, `client-report`, `poukaz-vydat`,
`study-reminder`, `milestones`, `splatky-guard`, `order-rescue`
a `academy-stripe-webhook` (doklad, opakované doručení balíčku, opakovaná konzultace).

### Cesty, které stopu POŘÁD NEMAJÍ

| Cesta | Komu píše | Proč zbyla |
|---|---|---|
| `_shared/koucink-onboarding.ts` | klientovi koučinku | sdílí ji `admin-api` i webhook, patří k ní vlastní revize |
| `checkin-capture` (mode=remind) | klientovi | nebyla v zadání dávky 1 |
| `simpleshop-webhook` | kupujícímu | nebyla v zadání dávky 1 |
| `intake-capture`, `withdrawal` | odesílateli formuláře | nebyla v zadání dávky 1 |
| `affiliate-mesicni-report` | partnerovi | nebyla v zadání dávky 1 |
| `contact-send`, `ai-flags-notify`, `link-check`, `daily-digest`, `app-purchase-bridge` a všechny `alertAdmin` | Martinovi | ⛔ stopu mít NEMAJÍ: jeho adresa do `email_events` nepatří a jen by zašuměla čísla |
