# _cloud/mailing: co je co (9. 10. 2026)

Podklady k návrhu `_cloud/MAILING-NAVRH-1009.md`. **Všechno je NÁVRH.** Nic se nenasadilo, na Supabase, Resend ani appku se nesahalo.

| Soubor | Co to je | Čemu věřit |
|---|---|---|
| `sablony.cjs` | **Jediný zdroj textů** 13 nových mailů (`vip-free`, `vip-kupci`, `vip-leady`) a opravy P0 | Texty jsou návrh pro Martina. Upravuje se tady, ne v SQL ani v náhledech. |
| `generuj.cjs` | Generátor: zkontroluje pravidla a vyrobí náhledy, SQL a sekci 6 v hlavním dokumentu | Spuštění: `node _cloud/mailing/generuj.cjs`. Při porušení pravidla spadne a nic nevyrobí. |
| `nahledy/` | HTML náhledy v obalu 1:1 s `drip-send`, rozcestník `index.html` | Ceny jsou schválně jen jako jména proměnných. Patička je zástupná, živá je v `app_config.footer_html`. |
| `00-kontroly-pred-spustenim.sql` | Dotazy jen pro čtení proti živé DB, včetně výchozího stavu plateb VIP | **Pustit první.** Návrh vznikl jen z repa. |
| `01-sablony-insert.sql` | Insert 13 šablon (vygenerovaný) | Inertní, dokud nevede most ani zápis. |
| `02-vstupy-mosty-backlog.sql` | Mosty v `navazujici_trate`, funkce zápisu stávajících a návratu, cron (zakomentovaný) | Psáno podle repa k 16. 9. Před spuštěním přečíst živé funkce a hodnotu mostů. |
| `03-oprava-basic249-na-vip.sql` | Oprava 4 existujících šablon z Basicu na VIP (vygenerovaná), záloha + zámek na `key` | **UPDATE šablony je rozeslání.** Spustit až po schválení textu. |
| `04-drip-send-vip.patch` | Patch `drip-send`: stop pravidla VIP tratí, brána „jen kdo zapisuje" pro `vip-free`, přeskočení koučinku bývalým klientům, testy | `git apply --check` prochází. Testy zelené (118 + 14 + 21). `deno check` má jen starou chybu TS2589, ta je v repu i bez patche. |

**Co už neplatí nebo na co pozor:**
- Čísla kroků longtailu (`longtail-consumer/11`, `longtail-kupci/5`) jsou převzatá z `odloz-koucink-bali-2026-10.sql`. Ověřit dotazem 4 v `00-*`.
- `/client/subscription?plan=vip` (CTA ve `vip-free`) není ověřené v appce. Když nefunguje, přepnout konstantu `PREDPLATNE_VIP` v `sablony.cjs` a spustit generátor znovu.
