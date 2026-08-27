# Fronta blogu: článek vydá automat sám

Sem se dají hotové drafty a den, kdy mají vyjít. Zbytek udělá GitHub Actions:
každý den v 08:05 UTC (10:05 v ČR, v zimě 09:05) vezme všechno, co má datum na
dnešek nebo dřív, vygeneruje z toho článek, kartu ve výpisu a záznam v sitemapě,
commitne to do `main`, spustí nasazení na Wedos a nakonec si na živém webu ověří,
že článek opravdu odpovídá. **Claude ani Martinovo PC u toho být nemusí.**

Workflow: `.github/workflows/blog-fronta.yml`
Dispečer fronty: `scripts/blog-fronta-vydej.mjs`
Stavbu článku dělá `scripts/blog-publikuj.mjs` (formát draftu: `docs/blog-publikuj-README.md`)

## Jak přidat článek do fronty

1. Napiš draft ve formátu `blog-publikuj` (vzor: `docs/blog-publikuj-TESTDRAFT.md`).
   Povinná pole hlavičky: `Klíčové slovo`, `Navržená URL`, `CTA`, `Zdroje`,
   plus úvodní odstavec a sekce `## Časté otázky`.
2. Ulož ho sem jako `clanky-fronta/muj-clanek.md`.
3. Přidej řádek do `manifest.json`:

```json
{
  "clanky": [
    { "date": "2026-09-24", "draft": "muj-clanek.md", "poznamka": "volitelne" }
  ]
}
```

4. Commitni do `main`. Hotovo, v uvedený den to vyjde samo.

⛔ **Slug ani titulek do manifestu nepatří.** Berou se z draftu (`Navržená URL`,
`# Nadpis`). Dvě místa pravdy by se dřív nebo později rozešla.

⛔ **Pole `Datum:` do draftu ve frontě nepiš.** Doplní se den, kdy článek opravdu
vyjde. Draft napsaný v srpnu a naplánovaný na září by jinak vyšel s datem v srpnu
(hero i JSON-LD `datePublished`). Když tam `Datum` necháš a nesedí s manifestem,
fronta běh schválně shodí a řekne to.

## Co se stane po vydání

- `clanky/<slug>.html` vznikne, karta se vloží na začátek `clanky/index.html`,
  do `sitemap.xml` přibude `<url>`.
- Draft se přesune do `clanky-fronta/vydano/` a zmizí z manifestu.
  Nemaže se, ať je vidět, z čeho článek vznikl.
- Běh se spustí i ve dnech, kdy není co vydat. Skončí zeleně a nic necommitne.

## Pojistky

- **Buď všechno, nebo nic:** nejdřív se všechny splatné drafty zkontrolují
  nanečisto. Jeden vadný draft znamená, že se nevydá ani jeden, a běh spadne.
  Ve výpisu běhu je pak přesně napsáno, který draft a proč.
- **Dlouhá pomlčka (em dash, U+2014) draft zabije** už při kontrole, stejně jako chybějící
  zdroje nebo FAQ. To dělá `blog-publikuj`, ne fronta.
- **Post-check:** po nasazení se článek stáhne z živého webu. Když do 13 minut
  nevrátí HTTP 200 s `<h1>`, běh je červený a je to vidět v Actions.
- Fronta se **nenahrává na web** (vyloučena v `deploy-wedos.yml` i v
  `scripts/verify-deploy.js`, oba seznamy musí sedět).

## Ruční spuštění a zkouška nanečisto

GitHub → Actions → „Blog fronta" → Run workflow. Lokálně:

```bash
node scripts/blog-fronta-vydej.mjs --dry                 # zkontrolovat, nic nezapsat
node scripts/blog-fronta-vydej.mjs --dnes 2026-09-24 --dry  # co by vyšlo k datu
```
