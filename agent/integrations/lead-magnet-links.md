# Lead-magnety jako odkazy + sledování prokliků

Dnes se PDF **přikládají** (`assets/lead-magnety/`). Funguje to, ale má to dvě slabiny:
1. **Gmail konektor přílohu k draftu nepřipne automaticky** (musí se ručně přetáhnout).
2. **Nevidíš, kdo si materiál reálně otevřel** → nepoznáš teplý lead.

Řešení: doručovat lead-magnety jako **sledovatelný odkaz** (Drive / krátká URL) místo přílohy.
*(Pozn.: u win-backu kuchařku klidně dál přikládej jako osobní gesto — tohle je hlavně pro
studené leady a nurture funnel.)*

## A) Hostování PDF
- Nahraj PDF z `assets/lead-magnety/` na **Google Drive** do veřejné složky „Lead-magnety"
  a nastav **„Kdokoliv s odkazem → Čtenář"**.
- Při aktualizaci obsahu používej **„Spravovat verze"** (zachová stejné ID/odkaz → funnel
  i staré maily fungují dál). Tohle je důležité, ať se nerozbijí běžící sekvence.
- Stabilní odkazy si veď v Sheetu „Lead-magnety" (název → Drive odkaz → krátká URL).

## B) Sledování prokliků (UTM)
Na **každý odkaz v těle mailu i v PDF** přidej UTM, ať v Google Analytics / přehledu vidíš zdroj:

```
?utm_source=email&utm_medium={{kanál}}&utm_campaign={{co}}
```
- `utm_medium`: `nurture`, `winback`, `poptavka`, `broadcast`
- `utm_campaign`: `7denni-plan`, `kucharka`, `videokurz`, `koucing`

Příklady:
- Videokurz CTA: `martinbarna.cz/videokurz?utm_source=email&utm_medium=nurture&utm_campaign=kucharka`
- Koučing CTA: `martinbarna.cz/koucing?utm_source=email&utm_medium=winback&utm_campaign=restart`

> Krátké URL (Bitly apod.) dávají proklik i bez Analytics — užitečné u PDF, kde UTM nevidíš.
> Tip: jedna krátká URL na lead-magnet → uvidíš počet stažení = signál teplého leadu.

## C) Co s tím dělá agent
- **Teplý lead** = klikl na materiál a/nebo na CTA. Pokud to v datech/Sheetu vidíš, agent
  takový lead **upřednostní** a navrhne osobní follow-up (`retence-doprodej.md` re-engagement).
- V `nurture-series/*` a `poptavka-template.html` měj hlavní CTA jako **odkaz v těle mailu**
  (ne schované jen v PDF), s UTM. Kostru šablon neměň — měň jen URL/obsah.

## D) Stav / TODO
- [ ] Nahrát aktuální PDF na Drive (veřejná složka, „kdokoliv s odkazem").
- [ ] Vyrobit krátké URL na 4 lead-magnety + kuchařky.
- [x] UTM doplněno do CTA: `nurture-series/vlna-2..4`, `doprodej-videokurz`, `retence-prodlouzeni`
  (videokurz/koučing odkazy; `utm_source=email`, medium dle kanálu). Zbývá: až budou Drive odkazy
  na PDF, přidat UTM i k nim a vyměnit přílohy za odkazy.
- [ ] Sheet „Lead-magnety" s mapou název → odkaz.

Souvislosti: `lead-engine.md` (funnel vlna 1–4), `assets/README.md` (zdroje PDF),
`inbox-cleanup-gmail-filters.md` (štítkování leadů).
