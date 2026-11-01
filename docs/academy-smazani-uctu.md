# Smazání účtu Academy

Stav k 2026-11-01. Funkce `academy-delete-account` je jen ve větvi `academy-smazani-uctu`. Není nasazená, na živou databázi ani na Stripe se nesahalo.

Metoda: projité soubory `akademie/_supabase/**/*.sql` (101 souborů), bez dotazu na živou DB. Pomocný skript našel 27 tabulek, které mají v `CREATE` sloupec `email`, `user_id`, nebo sloupec s `email` v názvu. Vazbu na `auth.users` jsem u `profiles` ověřil čtením `schema.sql`: cizí klíč je na `id`, ne na `email`. Skript tu vazbu přilepil ke špatnému sloupci, dokument se drží `schema.sql`.

Kde v těch SQL není `CREATE`, nebo není `ON DELETE`, je níž napsané **neověřeno**. Funkce takový řádek nemaže. Nevymýšlí se sloupec ani kaskáda.

## Co funkce dělá, v tomhle pořadí

1. Ověří JWT volajícího přes `auth.getUser()`. Vezme `user.id` a e-mail (malá písmena, ořezaný). Tělo požadavku se nečte. Cizí účet smazat nejde.
2. Když e-mail není použitelný (prázdný, bez `@`, s mezerou, čárkou nebo závorkou), vrátí `400` a `chybi_email`. Účet nesmaže. Bez e-mailu nejde najít předplatné ani odhlásit maily, a smazaný účet by dál platil.
3. Zruší běžící měsíční členství ve Stripu. Bere jen řádky `entitlements`, kde `source` je přesně `stripe-monthly` a `stripe_subscription_id` není prázdné. Id musí vypadat jako `sub_...`. Jiná id (doživotní řádek se starým id, videokurz z appky, kde je předplatné Tvůj Coach, referraly) se neruší. Klíč je `STRIPE_RESTRICTED_SUBS_KEY`, stejný jako u `academy-stripe-webhook`. Selhání Stripe účet nesmaže ze hry. Zapíše se alert a mazání pokračuje. Když Stripe odpoví `resource_missing`, předplatné už ve Stripu není a alert se nepíše.
4. Trvalé odhlášení z mailingu, taky best-effort. Pořadí: insert do `odhlaseni_trvale` (`zdroj` = `academy-delete-account`, duplicita se ignoruje), pak `odhlas_a_odstran` pro leady, které ještě nejsou `unsubscribed`, pak zmrazení `customer_contacts` (`status` = `unsubscribed`, `unsubscribed_at` jen tam, kde je prázdné), pak insert do `en_unsubscribes`. Mail ven se neposílá.
5. Smaže osobní řádky podle e-mailu (přesné `ilike`, `_` a `%` jsou escapované). Seznam je ve funkci, tabulka je níž.
6. `admin.auth.admin.deleteUser(user.id)`. Až po úspěšném mazání osobních řádků. Když mazání řádku selže a tabulka v DB je, funkce vrátí `500` a účet v auth nechá, ať se požadavek dá zopakovat. Chybějící tabulka (`42P01` nebo `PGRST205`) výmaz neblokuje.
7. Úspěch je `{ ok: true }`. Chyba je `{ ok: false, error }` se stavem 400, 401, 405 nebo 500. V odpovědi pro prohlížeč e-mail není.

Alert je insert do `email_events`: `lead_id` null, `step` 0, `type` `error`, `detail.track` = `academy-delete-account`. Stejný tvar jako `alertAdmin` v `app-purchase-bridge`, ale bez e-mailu Martinovi. Denní přehled chyby čte. Tabulka `admin_alerts` v tomhle projektu není.

## Tabulky z CREATE v repu

| tabulka | klíč | co se stane | zdroj |
| --- | --- | --- | --- |
| profiles | `id` odkazuje na `auth.users(id) on delete cascade`. Sloupec `email` na tom klíči neleží. | Smaže se kaskádou při `deleteUser`. Funkce řádek předem nemaže. | `schema.sql` |
| progress | `user_id` odkazuje na `auth.users(id) on delete cascade` | Smaže se kaskádou při `deleteUser`. | `schema.sql` |
| certificates | `user_id` odkazuje na `auth.users(id) on delete set null` | Řádek ZŮSTÁVÁ. `user_id` se vynuluje, `full_name` zůstane. Funkce certifikát nemaže. Jméno na certifikátu je mezera (osobní údaj). | `schema.sql` |
| entitlements | `email` (primární klíč spolu s `product`) | ZŮSTÁVÁ. Důkaz platby a rozhodnutí o vrácení peněz. Kdo se znovu přihlásí stejným e-mailem, zaplacený přístup se vrátí. Funkce do téhle tabulky nezapisuje. | `schema.sql` |
| referrals | `buyer_email` (ne `email`) | ZŮSTÁVÁ. Provize a nákup doporučeného. `CREATE` v repu sloupec `stripe_subscription_id` nemá. Funkce referraly nečte a nic na nich neruší. | `referral-affiliate.sql` |
| referral_codes | `owner_email` | ZŮSTÁVÁ. `referrals.code` odkazuje na `referral_codes(code)` a v `CREATE` není `ON DELETE` (Postgres vezme NO ACTION). Smazání kódu by doporučení zablokovalo, nebo o ně přišlo. | `referral-affiliate.sql` |
| referral_payouts | `owner_email` | ZŮSTÁVÁ. Evidence výplat. | `admin-panel.sql` |
| referral_webhook_log | žádný sloupec `email` ani `user_id`. Tělo je `payload jsonb`. | ZŮSTÁVÁ. Osobní údaj může být uvnitř jsonb. Bezpečně podle e-mailu to spárovat nejde, funkce do jsonb nesahá. | `referral-affiliate.sql` |
| discount_credits | `email` | ZŮSTÁVÁ. Slevový kredit z check-inů. Zadání ho řadí k tomu, co se nemaže. | `checkin-coaching.sql` |
| checkins | `email`. V `CREATE` není `user_id` a není vazba na `auth.users`. | Smaže funkce podle `email`. | `checkin-coaching.sql` |
| client_targets | `email` | Smaže funkce. Cíle klienta (kalorie, bílkoviny, kroky). | `client-targets.sql` |
| consultation_intake | `email` | Smaže funkce. Dotazník před konzultací. | `konzultace-dotaznik.sql` |
| consultation_calls | `email` (primární klíč). Vazba na `auth.users` v `CREATE` není. | Smaže funkce. Termín a poznámka k hovoru. | `konzultace-crm-2026-09-15.sql` |
| contact_messages | `email` | Smaže funkce. Zpráva z kontaktního formuláře. | `contact-log.sql` |
| usage_events | `email` | Smaže funkce. Návštěvy členské sekce. | `admin-panel.sql` |
| ai_lesson_peeks | `email` | Smaže funkce. Které lekce AI Martin odemkl. Text chatu to není. | `ai-lesson-peeks.sql` |
| pruvodce_drafts | `client_email` (ne `email`) | Smaže funkce. Koncept textů průvodce. | `pruvodce-drafts.sql` |
| report_drafts | `client_email`. `report_id` odkazuje na `client_reports(id) on delete cascade`. | Smaže funkce podle `client_email`. Samo od smazání reportu to nespadne, protože reporty funkce nemaže (jejich `CREATE` v repu není). | `report-drafts.sql` |
| crm_enroll_queue | `email`. `person_id` odkazuje na `crm_persons` `on delete cascade` (opačný směr). | Smaže funkce podle `email`. Osobu v CRM to nesmaže. | `crm-schema.sql` |
| en_leads | `email` | Smaže funkce. Anglický formulář. | `en-leads-2026-10-13.sql` |
| mail_skip_log | `email` | Smaže funkce. Záznam, proč brána mail neposlala. Není to razítko, které další mail zastaví. | `mail-skip-log-2026-09-17.sql` |
| kosik_checkouty | `email`, `zaplaceno_at`, `castka_halere`, `stripe_session_id` | Smaže funkce jen řádky, kde `zaplaceno_at` je prázdné (nedokončený košík). Zaplacené řádky ZŮSTÁVAJÍ jako místní stopa platby. Migrace je v souboru označená NESPOUSTET. Když tabulka v DB není, funkce to jen zapíše do alertu a jede dál. | `kosik-2026-11.sql` |
| kosik_checkouty_zaloha_retence | sloupec `email` nemá. Řádek je `radek jsonb`. | ZŮSTÁVÁ. Osobní údaj může být uvnitř jsonb. Funkce jsonb neprohledává. | `kosik-retence-2026-11.sql` |
| koucink_konec_sent | `email`, `promo_code` | ZŮSTÁVÁ. Razítko, že konec koučinku už založil jednorázový promo kód ve Stripu. Smazání může založit druhý kód a stát peníze. | `koucink-konec-2026-09-22.sql` |
| client_remind_sent | `email` | ZŮSTÁVÁ. Razítko nedělní připomínky (zápis před odesláním). Smazání při účtu, který se nepodaří smazat, nebo při reportu, který v DB zůstane, může poslat druhý mail. | `client-remind-nedele-1-tabulka.sql` |
| tydenik_odeslani | `email` | ZŮSTÁVÁ. Snímek tratě před přepnutím do týdeníku. Řádek s prázdným `vraceno_at` znamená, že člověk je mimo svou trať. Smazání může rozhodit návrat, nebo poslat týdeník znovu, když lead v DB zůstane. | `tydenik-rozesilka.sql` |
| en_mail_log | `lead_email` (ne `email`) | ZŮSTÁVÁ. Razítko proti druhému anglickému mailu. Odhlášení jede přes `en_unsubscribes`, log se nemaže. | `en-mailing-2026-10-13.sql` |
| en_unsubscribes | `email` (primární klíč, malá písmena), `source` | ZŮSTÁVÁ a funkce sem při mazání účtu řádek vloží (`source` = `academy-delete-account`). Duplicita se ignoruje. | `en-mailing-2026-10-13.sql` |
| crm_persons | `primary_email`, `academy_user_id`, `app_user_id`. V `CREATE` není `references auth.users`. | ZŮSTÁVÁ. Smazání osoby by kaskádou smazalo `crm_interactions`, včetně `kind` `purchase`, a `crm_identifiers`. `academy_user_id` po `deleteUser` může ukazovat na už neexistující účet. Jestli živá DB později přidala cizí klíč bez kaskády, `deleteUser` spadne a funkce vrátí 500. To je neověřeno. | `crm-schema.sql` |
| crm_identifiers | sloupec se nejmenuje `email`. `kind` může být hodnota `email`, adresa je ve `value_normalized`. `person_id` maže kaskádou osobu, ne naopak. | ZŮSTÁVÁ, protože zůstává osoba. | `crm-schema.sql` |
| crm_interactions | `person_id` `on delete cascade` z osoby. Sloupec `email` v `CREATE` není. `kind` umí hodnotu `purchase`. | ZŮSTÁVÁ spolu s osobou. | `crm-schema.sql` |
| page_views | sloupec `email` ani `user_id` nemá. Je tam `session_hash`. | Funkce na to nesahá. | `page-views.sql` |
| link_check | sloupec `email` ani `user_id` nemá. | Funkce na to nesahá. | `link-check.sql` |

`lesson_content`, `email_templates`, `app_config` a `coaching_rules` jsou obsah a nastavení, ne řádek jednoho člověka. Funkce je nemaže. Skript je mezi 27 tabulkami nenašel.

Jiný `references auth.users` než tři řádky v `schema.sql` (profiles cascade, progress cascade, certificates set null) v projitých SQL není. Živá DB může mít cizí klíč navíc. Když ho má a nemá kaskádu, `deleteUser` selže, funkce vrátí `{ ok: false, error: "db" }` a úspěch nehlásí. Tohle je neověřeno.

## checkins.user_id

`academy-is-admin-2026-11-01.sql` čte `checkins.user_id`. V `CREATE` tabulky `checkins` ten sloupec není a `ALTER TABLE ... ADD COLUMN user_id` jsem v projitých SQL nenašel. Funkce maže check-in jen podle `email`. Jestli v živé DB jsou řádky s `user_id` a jiným e-mailem, ty zůstanou. **neověřeno**.

## Tabulky, které kód používá, ale CREATE v repu není

Funkce je nemaže, kromě míst, kde je výslovně napsaný insert nebo update. Kaskáda je **neověřeno**.

| tabulka | co o ní v repu je | co funkce dělá |
| --- | --- | --- |
| odhlaseni_trvale | Čte ji `mailing-guard`. Insert dělá `unsubscribe` (`email`, `zdroj`). Trigger `odhlaseni_trvale_uklid` v `odhlaseni-brana-customer-contacts.sql` po insertu volá `odhlas_a_odstran` a mrazí kontakty. `CREATE TABLE` v repu není. | Insert `{ email, zdroj: academy-delete-account }`. Duplicitu ignoruje. Když insert selže (třeba nepovolený `zdroj`), alert a jede dál: leady a kontakty zkusí stejně. |
| odhlas_a_odstran | Volá ji `unsubscribe` a trigger. Tělo funkce v SQL repa není. Komentáře říkají: zapíše trvalý seznam, zálohuje řádek, historii mailů odpojí a nesmaže, pak smaže lead. | Volá se pro leady se stejným e-mailem, které ještě nemají `status` `unsubscribed`. Selhání neblokuje smazání účtu. **Chování funkce je neověřeno.** |
| leads | `CREATE` v repu není. Kód i SQL s `email` a `status` pracují. | Nemazat přímo. Úklid jen přes `odhlas_a_odstran`. |
| customer_contacts | `CREATE` v repu není. Trigger v `odhlaseni-brana-customer-contacts.sql` nastavuje `status`, `unsubscribed_at`, `updated_at` a komentář říká NEMAŽE SE NIC. | Nemazat. Zmrazit `status` na `unsubscribed`. Jméno a další sloupce zůstávají. **Schéma mimo ty tři sloupce je neověřeno.** Osobní údaj (jméno) je mezera. |
| email_events | `CREATE` v repu není. Komentáře u odhlášení: historie mailů se nemá mazat, `odhlas_a_odstran` prý `lead_id` odpojí. | Nemazat. Funkce sem jen vkládá alert (`lead_id` null), ať přežije úklid leadu. |
| client_reports | `CREATE` v repu není. Dotazy a `ALTER` používají `email` (třeba `crm-refresh.sql`, `client-report`). `report_drafts` na `id` odkazuje kaskádou. | Nemazat. Tělo koučinkového reportu (váha, míry, text) může zůstat. Tohle je největší mezera výmazu. Doplnit až po ověření sloupců v živé DB, ne naslepo. |
| client_intake | `CREATE` v repu není. `client-report` vkládá `{ email, data }`. | Nemazat. **neověřeno.** V `data` může být zdravotní dotazník. |
| test_attempts | V SQL je policy, `CREATE` a sloupce v repu nejsou. `ba-academy.js` dělá `select *`. | Nemazat. **neověřeno.** |
| withdrawals | `CREATE` v repu není. `security-fixes-2026-07.sql` přidává `ip` a index `(email, created_at)`. SQL ho používá jako odstoupení od smlouvy (okno 180 dní). | Nemazat. Vypadá to jako právní záznam, ale schéma je **neověřeno**, proto se mazání nevymýšlí. |
| ai_flags | `CREATE` v repu není. `ai-martin` vkládá `user_id`, `user_email`, `note` (úryvek zprávy, max. 300 znaků). Soubor `ai-martin` tahle větev needituje. | Nemazat. **neověřeno.** Úryvek chatu může zůstat. |
| ai_usage | `CREATE` v repu není. `ai-martin` vkládá `user_id` a tokeny, e-mail v insertu není. | Nemazat. **neověřeno.** Na `user_id` kaskáda z `auth.users` v SQL není. |
| faktury a platby | `CREATE` tabulky faktur nebo plateb v projitých SQL není. | Nemazat. Zadání: účetní záznam zůstává. |

## Historie s AI Martinem

Věta v potvrzení je daná zadáním a zůstává doslova: smaže se i „historie s AI Martinem“.

V `assets/ai-martin.js` je přepis rozhovoru jen v paměti stránky (`msgs`) a na server jde posledních 12 zpráv v jednom požadavku. Samostatná tabulka přepisu v SQL není. Po úspěchu stránka zavolá odhlášení a jde na `/akademie/`, paměť stránky tím končí.

Co z AI může zůstat, je v tabulce neověřeno výš: `ai_flags.note` a `ai_usage`. `ai_lesson_peeks` funkce maže.

`localStorage` klíče `ba_progress_v1` a `ba_activity_v1` jsou jen demo režim bez přihlášení. Živý postup je v `progress` a spadne kaskádou. Prohlížeč je funkce nečistí, zadání to nechtělo.

## Stripe, ať se nezruší cizí předplatné

Měsíční grant v `academy-stripe-webhook` píše `entitlements` s `product` academy, `source` `stripe-monthly` a `stripe_subscription_id`.

Upgrade na doživotní staré id v řádku nechá a `source` změní. To id už webhook při upgrade rušil. Funkce ho znovu neruší, protože `source` už není `stripe-monthly`.

`grant-videokurz-z-appky` umí zapsat `stripe_subscription_id` na entitlement videokurzu. To id je předplatné appky Tvůj Coach, ne Academy. Funkce ho neruší.

`referrals.stripe_subscription_id` v `CREATE` není. Most nákupů appky ho do referralu zapisuje jako předplatné appky. Funkce referraly nečte.

Když klíč Stripe chybí a měsíční id se našlo, je alert a účet se maže dál. Předplatné je pak potřeba zrušit ručně. Id je v `email_events`.

## Tlačítko

`akademie/moje/index.html`, v horní liště vedle Odhlásit: „Smazat účet“.

Potvrzení, doslova: „Opravdu smazat účet? Smaže se tvůj postup ve studiu, profil a historie s AI Martinem. Zaplacený přístup zůstává evidovaný u tvého e-mailu. Běžící měsíční členství se zruší. Tohle nejde vrátit.“

Po úspěchu odhlášení a přesměrování na `/akademie/`, i když odhlášení samo selže. Po chybě hláška a tlačítko se znovu odemkne. Druhé kliknutí během běhu se ignoruje (`aria-busy`).

V demo režimu (není `BA_CONFIG`, `BA.mode` není `live`) je tlačítko schované a na síť se nesahá.

`deleteAccount()` je v `assets/ba-academy.js` hned za `getToken`. Fetch je přesně `POST` na `cfg.url + "/functions/v1/academy-delete-account"` s hlavičkami `Authorization: Bearer` a `apikey`.

`?v=` u `ba-academy.js` je zvednuté jen v `akademie/moje/index.html` na `20261101a`. Ostatní stránky starý soubor dál používají, novou funkci nevolají. Celoplošné zvednutí by sahalo do stovek studijních stránek a tlouklo by se s větví `academy-pwa`. Nový `?v=` se nemá stahovat dřív, než doběhne deploy: CDN by si na 30 dní uložila staré tělo pod novým klíčem. Tahle větev se nenasazuje.

Počty na kartě v `moje/index.html` zůstávají: 256 lekcí, 24 modulů, 182 videí.

## Deploy, nespouštět z téhle větve

Příkaz je v hlavičce `akademie/_supabase/functions/academy-delete-account/index.ts`. `verify_jwt` nechat false, stejně jako `lesson-peek` a `client-report`. Bránu drží `auth.getUser()` v kódu. Živá funkce ještě neexistuje, není tedy co stáhnout a porovnat.

Na `ai-martin` se nesahalo.
