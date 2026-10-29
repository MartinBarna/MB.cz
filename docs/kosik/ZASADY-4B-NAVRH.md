# Návrh sekce 4b zásad ochrany osobních údajů

Vloží se do `zasady-ochrany-osobnich-udaju/index.html` až po právní kontrole, a to spolu se zapnutím košíku. Dřív ne. Příznaky košíku jsou vypnuté, ale stránka zásad se nasazuje vždy, proto návrh na veřejné stránce neleží.

Kam ve stránce: mezi nadpis „4a. Obchodní sdělení (newsletter a e-mailové tipy)“ a nadpis „5. Doba uchování“.

## Proč tenhle soubor není na webu

`deploy-wedos.yml` nahrává složku `docs/` (není v `exclude`; SQL a JSON v ní na FTP jedou). Markdown ale glob `**/*.md` z nahrání vynechává, takže `docs/kosik/ZASADY-4B-NAVRH.md` se na WEDOS nenahraje. Server navíc `/docs/` nevydává (adresář 403, soubory 401). Stejné vyloučení má `scripts/verify-deploy.js` (`/\.md$/` a `/^docs\//`).

## Text k vložení (přesně tak, jak byl v PR)

```html
<h2>4b. Připomínka nedokončené objednávky (návrh, čeká na právní kontrolu)</h2>
<p><b>Návrh pro právní kontrolu, není to ještě platné znění.</b> Když na prodejní stránce zadáš e-mail kvůli předvyplnění platby ve Stripe a zaškrtneš souhlas, můžu ti poslat až dva e-maily s připomínkou nedokončené objednávky a občas tipy a nabídky. Bez zaškrtnutí připomínku neposílám a nákup jde dokončit i tak. Souhlas ukládám s přesným zněním, časem a stránkou, ze které přišel. Odvolat ho můžeš odkazem v každém e-mailu. Řádek bez souhlasu navrhuji smazat do 30 dní, řádek se souhlasem do 90 dní od posledního e-mailu.</p>
```
