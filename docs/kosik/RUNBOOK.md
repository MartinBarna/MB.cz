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

## Právní kontrola 1. 11. 2026 (Claude)

Výrok: **GO pro konzultaci po splnění bodů níže.** Koučink zatím ne. Jde o můj posudek, ne o advokátní stanovisko.

Opraveno v tomto PR:

- Pokladna z kódu dostává u tlačítka Zaplatit předsmluvní text (`custom_text[submit][message]`, `TEXT_PRED_PLATBOU` v `kosik-checkout/logika.ts`): odkaz na VOP, odstoupení do 14 dnů s formulářem, poměrná úhrada u služby, která na žádost začne dřív (VOP čl. 7.3), odkaz na zásady. Platební odkaz to má z Dashboardu, session z API by to jinak neukázala.
- Faktura: VOP čl. 5 slibují fakturu e-mailem. Session ji vytvoří jen s env `KOSIK_FAKTURA=1`. Martin ho nastaví, když má platební odkaz konzultace ve Stripu zapnuté „Vytvořit fakturu“, aby se nákup choval stejně jako dnes (a webhooky na `invoice.paid` dostaly totéž, co už znají).
- K2 bez věty o koučinku. Mail k nedokončené objednávce smí nabízet jen dokončení téže objednávky (rozhodnutí 31. 10.).
- Patička mailů říká pravdu o souhlasu („souhlas s připomínkou nedokončené objednávky“, ne „se zasíláním e-mailů“) a nese identifikaci odesílatele (IČO a adresa jako ve VOP, § 7 odst. 4 zákona 480/2004 Sb.).

Zkontrolováno a v pořádku: okno s e-mailem (políčko nezaškrtnuté, souhlas není podmínkou, „Pokračovat bez e-mailu“), znění souhlasu v2, 4b a čl. 3 zásad, retence 30/90 dní, strop 2 maily, okno 8 až 20 h, odhlášení jedním klikem a List-Unsubscribe, K1 bez garance (flag `kosik_garance_k1` zůstává false, VOP 7.3 garanci nemá).

Živý stav 1. 11. 2026 3:20 Praha (jen čtení):

- Edge funkce `kosik-checkout`, `kosik-webhook`, `kosik-pripominka` jsou nasazené ve **verzi 1 z 30. 10. se starým souhlasem v1** („…a občas tipy a nabídky“). Před zapnutím se musí přenasadit z main, jinak by se ukládal vázaný souhlas.
- Tabulka `kosik_checkouty` existuje, 0 řádků. Retence (`kosik-retence-2026-11.sql`) v DB není.
- V `app_config` žádný `kosik_*` řádek, platí výchozí: web vypnuto, mail vypnuto, dry-run zapnuto.

Před zapnutím ještě:

1. Martin ve Stripu (postup v `akademie/_supabase/KOSIK-README.md`): restricted klíč, webhook `kosik-webhook`, `STRIPE_PRICE_KONZULTACE`, případně `KOSIK_FAKTURA=1`.
2. Přenasadit edge funkce z main (souhlas v2, text u Zaplatit) a spustit retenci, test na TEST řádcích.
3. Test T7 v testovacím režimu: zkontrolovat v pokladně, že se text u Zaplatit ukáže a odkazy v Markdownu jsou klikací (když ne, přepsat na holé adresy), a když je zapnutá faktura, že přijde.
4. Druhé čtení 4b a souhlasu (Heavy nebo Jev, podmínka f z 31. 10.).
5. Až potom deploy webu s atributem a 4b (body výše) a flagy postupně.

Koučink (KC1, KC2) zatím nezapínat: KC2 nabízí místo koučinku konzultaci, tedy jinou nabídku, než jakou člověk nedokončil. Přepsat před vlnou koučinku.
