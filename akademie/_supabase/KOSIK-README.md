# Opuštěný košík, vlna 1 (konzultace)

Draft. Nic z tohoto se nenasazuje, dokud neprojde právní kontrola a Claude nedá GO přes DEPLOY-ZAMEK.

## Co je v téhle vlně

- Konzultace (`konzultace`, 2 990 Kč) je připravená v katalogu i na `/konzultace/`.
- Koučink (6 klíčů) je v tom samém katalogu a tlačítka na `/koucing/` mají `data-kosik`. Odesílání mailu koučinku je zavřené flagem `kosik_produkty` (výchozí je jen `konzultace`).
- Videokurz a Academy v checkoutu ani v odesílači nejsou. Texty všech 10 mailů v JSON jsou, protože zdroj FINÁL v2 je jeden soubor a test hlídá 1:1.

## Flagy v `app_config` (výchozí, když řádek chybí)

| Klíč | Výchozí | Význam |
| :-- | :-- | :-- |
| `kosik_web_zapnuto` | `false` | Endpoint A vrací fallback, prohlížeč jde na původní `buy.stripe.com`. |
| `kosik_mail_zapnuto` | `false` | Cron nic neposílá. |
| `kosik_dry_run` | `true` | Místo Resendu se zapíše `email_events` typu `kosik_dry_run`. |
| `kosik_garance_k1` | `false` | Věta o vrácení částky v mailu K1 se vypustí celá. |
| `kosik_produkty` | `konzultace` | Které klíče smí checkout a odesílač. |

Na webu je navíc `data-kosik-zapnuto="false"` na skriptu. Bez toho se modal neotevře, i kdyby byl server zapnutý. Env `KOSIK_DRY_RUN=1` umí dry-run jen zapnout, ne vypnout.

Souhlas není podmínka nákupu. Verze souhlasu je jen `kosik-v2-2026-11`. Starší znění se neukládá a není fallback. Mail se pošle jen když je v řádku `souhlas`, `souhlas_at`, `souhlas_text`, `souhlas_verze` a `stripe_session_id`. Kontrola je v SQL dotazu a znovu v kódu těsně před odesláním. Řádek bez souhlasu do události s e-mailem nepatří.

Sekce 4b zásad a položka Amazon SES v čl. 3 na webu nejsou. Vloží je až skript při zapnutí, ve stejném deployi jako `data-kosik-zapnuto`. Postup: `docs/kosik/RUNBOOK.md`. Retence (`kosik-retence-2026-11.sql`) se v tomhle stavu nespouští, cron je zakomentovaný a funkce maže jen při `kosik_retence_zapnuto=true`.

## Pořadí nasazení (až po GO)

1. Spustit `akademie/_supabase/kosik-2026-11.sql` (v PR se nespouští). Cron v souboru je zakomentovaný.
2. Nasadit `kosik-checkout`, `kosik-webhook`, `kosik-pripominka`, změněný `academy-stripe-webhook` a `unsubscribe`.
3. Web až potom. Změna webhooku musí být venku dřív, než se na `/konzultace/` zapne flag. Jinak zaplacená session nedostane nárok.
4. Flagy postupně: nejdřív dry-run, mail jen pro konzultaci, web až po testu T7.

Platební odkazy, `order-rescue` a `pending_orders` se nemažou.

## Co udělá Martin ve Stripe (PLAN sekce 8)

Bot ve Stripe nic nezakládá.

1. Restricted klíč `STRIPE_RESTRICTED_CHECKOUT_KEY`: Checkout Sessions write, Prices read, Promotion codes read. Nic jiného.
2. Webhook `https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/kosik-webhook` na `checkout.session.expired` a `checkout.session.completed`. Secret `KOSIK_STRIPE_WEBHOOK_SECRET`. V sandboxu totéž jako `KOSIK_STRIPE_WEBHOOK_SECRET_TEST` a test T7.
3. Doplnit price ID do env (`STRIPE_PRICE_KONZULTACE` a šest cen koučinku, případně `STRIPE_PRICE_KONZULTACE_VK`). Dokud chybí, checkout vrací fallback.
4. Nadiktovat nastavení platebního odkazu (telefon, faktura, VOP, DPH). O3 je otevřené, session to zatím nekopíruje.
5. T7 v test mode: session s recovery, ruční expirace, zaplacení testovací kartou, ověřit `recovered_from` a jestli se kopírují metadata.
6. Platební odkazy nevypínat a nemazat.
7. Žádný nový kupón.

## Odchylky od plánu, ať je Claude vidí

- Dry-run razítko je ve sloupcích `mail1_dry_at` a `mail2_dry_at`, ostré `mail*_odeslan_at` nechává prázdné. Až se dry-run vypne, mail ještě může odejít. Bez sloupce by cron každé čtvrt hodiny psal další dry řádek.
- Událost odeslání je `odeslano`, ne `px_odeslano`. Pixel se nezapíná (O9) a `px_odeslano` bez pixelu kazí jmenovatel otevřenosti.
- `odesliPresResend` od 27. 10. jde přes `posliMail`. Přímý fetch na Resend by rozbil kontrolu, že je fetch jen v `mail-provider.ts`. Když je `MAIL_PROVIDER=ses`, kosik by šel taky přes SES. Do GO je dry-run a mail vypnutý.
- Price ID v kódu nejsou. V repu jsou jen oříznuté prefixy a hádat celé ID by mohlo účtovat špatnou cenu.
- Anglické zásady se neměnily. Tahle vlna nemá anglickou prodejní stránku konzultace.
- Session zatím nekopíruje telefon, fakturu a zaškrtnutí VOP (O3).
