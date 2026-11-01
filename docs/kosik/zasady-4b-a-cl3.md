# Vkládací HTML pro zásady (aplikuje jen skript při zapnutí košíku)

Soubor se nenasazuje. `scripts/kosik-zasady-aplikuj.mjs` z něj vezme bloky a vloží je do `zasady-ochrany-osobnich-udaju/index.html` jen když dostane `--az-pri-zapnuti-kosik-web` a v tom samém stromu už je `data-kosik-zapnuto="true"`. Jinak skončí a nic nezapíše.

Blok `cl3` patří hned za položku Resend v čl. 3. Blok `4b` patří mezi 4a a nadpis „5. Doba uchování“.

<!-- BLOK:cl3 -->
      <li><b>Amazon Web Services EMEA SARL</b> (Amazon SES, region Frankfurt eu-central-1): odesílání e-mailů.</li>
<!-- /BLOK:cl3 -->

<!-- BLOK:4b -->
    <h2>4b. Připomínka nedokončené objednávky</h2>
    <p>Když na prodejní stránce před platbou zadáte e-mail, použijeme ho k předvyplnění platby ve Stripe. Jde o krok před uzavřením smlouvy na vaši žádost (čl. 6 odst. 1 písm. b) GDPR). Spolu s e-mailem ukládáme vybraný produkt, čas a stránku, ze které jste přišli, a kvůli ochraně před zneužitím zkrácený otisk (hash) vaší IP adresy a typ prohlížeče (oprávněný zájem, čl. 6 odst. 1 písm. f) GDPR).</p>
    <p>Pokud objednávku nedokončíte, pošleme vám na zadaný e-mail nejvýš dva e-maily s připomínkou téže objednávky a odkazem na její dokončení. Jiné nabídky v nich nejsou. Děláme to na základě oprávněného zájmu (čl. 6 odst. 1 písm. f) GDPR), o kterém vás informujeme přímo u pole pro e-mail. Připomínky nechcete? Pokračujte k platbě bez e-mailu, nebo se odhlaste jedním klikem v kterémkoli z nich. Proti zpracování můžete kdykoli vznést námitku, po ní vám už nic nepošleme. Ukládáme znění informace, kterou jste viděli, a čas zadání.</p>
    <p>Údaje smažeme do 90 dnů od posledního e-mailu (když žádný neodešel, od zadání), nebo hned po odhlášení či námitce. Po odhlášení si ponecháme jen e-mailovou adresu na seznamu odhlášených, abychom vám už nic neposlali. E-maily odesíláme přes poskytovatele uvedené v čl. 3.</p>
<!-- /BLOK:4b -->
