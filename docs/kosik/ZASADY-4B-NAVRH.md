# Sekce 4b zásad ochrany osobních údajů (finální znění, na webu není)

Tohle je finální znění po posudku z 31. 10. 2026. Na stránce `zasady-ochrany-osobnich-udaju/index.html` neleží a tenhle PR ho tam nevkládá.

4b smí jít živě až ve stejném deployi, který zapne `kosik_web_zapnuto` a `data-kosik-zapnuto="true"`. Dřív ne. Postup, zámek a čl. 3 (Amazon SES) jsou v `docs/kosik/RUNBOOK.md`. Vkládací HTML je v `docs/kosik/zasady-4b-a-cl3.md`. Skript `scripts/kosik-zasady-aplikuj.mjs` bez přepínače a při vypnutém košíku odmítne zapisovat.

Umístění ve stránce: mezi nadpis „4a. Obchodní sdělení (newsletter a e-mailové tipy)“ a nadpis „5. Doba uchování“.

## Proč tenhle soubor není na webu

`deploy-wedos.yml` nahrává složku `docs/` (není v `exclude`; SQL a JSON v ní na FTP jedou). Markdown ale glob `**/*.md` z nahrání vynechává, takže soubory v `docs/kosik/*.md` se na WEDOS nenahrají. Server navíc `/docs/` nevydává (adresář 403, soubory 401). Stejné vyloučení má `scripts/verify-deploy.js` (`/\.md$/` a `/^docs\//`).

## Finální znění 4b (vyká, vkládat doslova)

### 4b. Připomínka nedokončené objednávky

Když na prodejní stránce před platbou zadáte e-mail, použijeme ho k předvyplnění platby ve Stripe. Jde o krok před uzavřením smlouvy na vaši žádost (čl. 6 odst. 1 písm. b) GDPR). Spolu s e-mailem ukládáme vybraný produkt, čas a stránku, ze které jste přišli, a kvůli ochraně před zneužitím zkrácený otisk (hash) vaší IP adresy a typ prohlížeče (oprávněný zájem, čl. 6 odst. 1 písm. f) GDPR).

Pokud objednávku nedokončíte, pošleme vám na zadaný e-mail nejvýš dva e-maily s připomínkou téže objednávky a odkazem na její dokončení. Jiné nabídky v nich nejsou. Děláme to na základě oprávněného zájmu (čl. 6 odst. 1 písm. f) GDPR), o kterém vás informujeme přímo u pole pro e-mail. Připomínky nechcete? Pokračujte k platbě bez e-mailu, nebo se odhlaste jedním klikem v kterémkoli z nich. Proti zpracování můžete kdykoli vznést námitku, po ní vám už nic nepošleme. Ukládáme znění informace, kterou jste viděli, a čas zadání.

Údaje smažeme do 90 dnů od posledního e-mailu (když žádný neodešel, od zadání), nebo hned po odhlášení či námitce. Po odhlášení si ponecháme jen e-mailovou adresu na seznamu odhlášených, abychom vám už nic neposlali. E-maily odesíláme přes poskytovatele uvedené v čl. 3.

## Čl. 3, připravené doplnění (na webu taky není)

Do seznamu zpracovatelů, ve stylu stávajících položek, až při zapnutí:

Amazon Web Services EMEA SARL (Amazon SES, region Frankfurt eu-central-1): odesílání e-mailů.

Resend v čl. 3 živé stránky už je (Plus Five Five, Inc., transakční a informační e-maily). SES ve Frankfurtu je v EU, do věty o předání mimo EU se nepřidává. I kdyby čl. 3 šel zveřejnit samostatně, v tomhle PR zůstává jen připravený. Rozhodne Claude.
