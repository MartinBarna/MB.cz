# Runbook: zapnutí košíku a zásad 4b

Košík je vypnutý. `kosik_web_zapnuto=false`, `kosik_mail_zapnuto=false`, `kosik_dry_run=true`, cron připomínky v `akademie/_supabase/kosik-2026-11.sql` je zakomentovaný. Tenhle stav se nemění, dokud Martin nedá ostré zapnutí.

4b zásad a doplnění čl. 3 (Amazon SES) jsou připravené v `docs/kosik/zasady-4b-a-cl3.md` a v `docs/kosik/ZASADY-4B-NAVRH.md`. Na stránce `zasady-ochrany-osobnich-udaju/index.html` nejsou. Deploy je tam sám nedostane: skript bez přepínače nezapisuje a test `kosik-zasady-zamek.test.ts` spadne, když se text objeví na stránce dřív, než je `data-kosik-zapnuto="true"`.

## Co se smí zapnout jen najednou

Ve stejném commitu a stejném deployi webu:

1. `data-kosik-zapnuto="true"` na `/konzultace/` (a na `/koucing/`, až má jít i koučink).
2. Spustit `node scripts/kosik-zasady-aplikuj.mjs --az-pri-zapnuti-kosik-web`. Bez toho přepínače skript končí kódem 2 a nic nezapíše. Když je atribut pořád `false`, končí kódem 3 a taky nezapíše. Sám flag nezapíná.
3. Nasadit web. 4b je mezi „4a. Obchodní sdělení“ a „5. Doba uchování“. Čl. 3 dostane položku Amazon Web Services EMEA SARL (Amazon SES, region Frankfurt eu-central-1) hned za Resend. Resend v čl. 3 už je. SES je ve Frankfurtu, do věty o předání mimo EU se nedává.

Databázový příznak `kosik_web_zapnuto` se přepíná až k tomuto deployi, ne dřív. Samotný atribut na stránce bez serverového příznaku modal otevře a server vrátí fallback. Samotný serverový příznak bez atributu modal neotevře. Právně musí být 4b venku ve chvíli, kdy web košík začne sbírat e-mail.

## Co tenhle deploy sám nedělá

- Nespouští `akademie/_supabase/kosik-2026-11.sql` ani `kosik-retence-2026-11.sql`.
- Nenasazuje edge funkce a nezakládá Stripe webhook. To dělá Martin (README košíku, sekce Stripe).
- Nezapíná `kosik_mail_zapnuto` a nenechává `kosik_dry_run` na false.
- Nepřepisuje texty mailů 1 a 2. K2 konzultace pořád obsahuje větu o koučinku. Než půjde mail naostro, texty čte Claude.

## Retence

Soubor `akademie/_supabase/kosik-retence-2026-11.sql` je připravený a nespouští se. Funkce `kosik_retence_smaz` nejdřív řádky zkopíruje do `kosik_checkouty_zaloha_retence` (RLS zapnuté, anon bez práv) a teprve pak je smaže. `odhlaseni_trvale` nemaže.

Mazání:

- `odhlaseno_at` vyplněné: hned.
- zaplacené: 30 dní po `zaplaceno_at`.
- bez souhlasu a nezaplacené: 30 dní od `created_at`.
- se souhlasem a nezaplacené: 90 dní od posledního `mail*_odeslan_at`, a když mail nešel, od `created_at`.
- TEST řádky (`test=true` i e-mail s `+test`) mají stejná pravidla. Filtr je nevynechává.

Cron `kosik-retence-denne` je v souboru zakomentovaný (`15 3 * * *`). Funkce navíc vrátí 0, dokud `app_config.kosik_retence_zapnuto` není `true`. Odkomentovaný cron bez flagu tedy nic nesmaže.

Zapnutí spolu s košíkem: ve stejném kroku jako mailový cron odkomentovat `cron.schedule` a nastavit `kosik_retence_zapnuto` na `true`. Vypnutí: flag zpět na `false`, nebo `cron.unschedule('kosik-retence-denne')`. Obojí je v down skriptu `kosik-retence-2026-11.down.sql`, který taky vrátí smazané řádky ze zálohy. Záloha se po 7 dnech maže (`zaloha_at`), takže down skript vrátí jen řádky smazané za posledních 7 dní. Down skript se nespouští spolu s migrací.

## Pořadí, až bude GO

1. Právní texty mailů (Claude) a druhé čtení (Heavy / Jev).
2. Martin ve Stripu: restricted klíč, webhook `kosik-webhook`, price ID. Postup je v `akademie/_supabase/KOSIK-README.md`.
3. Nasadit edge funkce (`kosik-checkout`, `kosik-webhook`, `kosik-pripominka`, `academy-stripe-webhook`, `unsubscribe`) dřív, než se na webu zapne atribut.
4. Stejný deploy webu: atribut `true`, skript zásad, 4b a čl. 3 venku.
5. SQL tabulky košíku, potom retence. Crony nechat zakomentované, dokud neběží suchý test.
6. Flagy: nejdřív dry-run a mail jen pro konzultaci, web až když je 4b na živé stránce.
