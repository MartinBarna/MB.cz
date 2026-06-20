# Úklid inboxu — Gmail filtry

Cíl: ať inbox sám odděluje **šum** od **práce**, aby agent (i ty) řešil jen podstatné.
Gmail filtry se nedají založit přes API, takže níže je **návod na ručně** (5 minut) —
přesná kritéria k zkopírování. Gmail → ⚙️ → *Zobrazit všechna nastavení* → *Filtry a
blokované adresy* → *Vytvořit filtr*.

## A) Šum → archivovat + označit „Šum" (nebo rovnou archivovat)

Do pole **Obsahuje slova** vlož (uprav dle reality):

```
from:(alza.cz OR zasilkovna.cz OR timestore.cz OR vodafone.cz OR ceskaposta.cz OR
direct.cz OR audiolibrix OR herohero OR no-reply OR noreply) OR
subject:(objednávka OR účtenka OR receipt OR faktura OR "připravena k výdeji")
```

→ *Vytvořit filtr* → zaškrtni **Přeskočit doručenou poštu (archivovat)** +
**Použít štítek: Šum** (volitelně **Označit jako přečtené**). ✅ Inbox se pročistí.

> Tip: nech si pár dní štítek „Šum" jen archivovat (ne mazat), ať ověříš, že tam nepadá
> nic důležitého. Pak klidně přidej automatické mazání starších.

## B) Lead-magnet leady → štítek `MB-Agent/Poptávka`

Formulářové leady mají rozpoznatelný tvar. Do **Obsahuje slova**:

```
"Hlavní cíl" "Email" "Věk"
```

→ **Použít štítek: MB-Agent/Poptávka** (nearchivovat — ať je vidíš).

## C) Newsletter „denní článek" (HeroHero) → archivovat

```
from:herohero OR subject:("Denní článek" OR "is ready")
```
→ **Přeskočit doručenou** + štítek **Šum**.

## Co filtry NEumí (a proč zůstává na agentovi)

Týdenní **check-iny** chodí z osobních adres klientů (seznam.cz, gmail.com) bez pevného
vzoru — filtr je spolehlivě nechytí. Proto reálné rozlišení práce dělá **agent** při
průchodu („projdi maily") podle `../playbooks/triage.md` a štítkuje `MB-Agent/Check-in`.

**Rozdělení rolí:**
- **Filtry** = zbavit se šumu a hrubě roztřídit leady (statické vzory).
- **Agent** = poznat check-in/onboarding/poptávku, zkontrolovat kontext a připravit draft.

## Po nastavení

Inbox = skoro jen reálná práce. Agent pak při „projdi maily" řeší výrazně míň zpráv a
rychleji.
