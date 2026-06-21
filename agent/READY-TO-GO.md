# READY TO GO — ostrý provoz agenta

Rychlá příručka pro spuštění naostro. Detaily v `RUNBOOK.md` / `ROUTINES.md` a v playboocích.

## 🌅 Ranní check-in běh (hlavní use case)
1. Otevři **Cowork (claude.ai/code) na tomto repu** → napiš **„jedeme, projdi dnešní check-iny"**
   (nebo „projdi maily" pro celý sweep).
2. Agent: triage (`triage.md`) → u check-inů **přečte report** (`report-parsing.md` + `report-structure.md`)
   → připraví **DRAFT** z `templates/check-in-template.html` → návrh maker `>>> KE SCHVÁLENÍ` → krátký briefing.
3. Ty: otevři **Koncepty** v Gmailu, projeď checklist níže, **odešli**. (Agent nikdy neodesílá.)

## 📥 Čtení reportů — tipy z praxe
Reporty chodí různě — agent zkouší v pořadí: **xlsx příloha → Drive/Sheet odkaz → data v těle → WA**.
- **Co se tahá** (z `report-structure.md`): trend váhy, **pas/pupík** (důležitější než váha), průměr
  **kcal + bílkoviny** vs. cíl, **kroky**, **vláknina**, škály **únava/hlad/síla**.
- **Chráněný soubor („zadejte kód") / nepřístupný Drive** → agent vezme data z těla mailu a označí
  `>>> OVĚŘ data z přílohy`. **Nikdy si nevymýšlí čísla.**
- **Tip pro hladší provoz:** poproś klienty posílat report **jako přílohu xlsx nebo sdílený Google Sheet**
  (ne chráněný „nasdílel vám soubor" odkaz, který chce ověřovací kód) — výrazně to zrychlí čtení.

## ✅ Checklist před odesláním draftu (10 sekund)
- Oslovení sedí (**tykání/vykání** + zdrobnělina jména)?
- Čísla **odpovídají reportu**? Dodržen **floor 1100 ž / 1300 m**? Jen JEDNA páka úpravy?
- Žádný **zdravotní slib/diagnóza**, žádná garance kg/termínu? Citlivé téma → **eskalace**, ne draft?
- Sedí blok maker + kroky + prokliky (databáze příloh, videa)?
- Smazána interní poznámka **`>>> KE SCHVÁLENÍ`** před odesláním?

## 🚀 Další využití naostro (řekni → dostaneš drafty/návrhy)
| Řekni | Co dostaneš |
|---|---|
| „ranní briefing" | přehled dne: kalendář, check-iny, horké leady, at-risk (`briefing.md`) |
| „projdi poptávky" | drafty na nové zájemce, 3stupňová nabídka (`poptavka.md`, `objection-handling.md`) |
| „churn radar / kdo je at-risk" | interní flagy + návrh callu (`churn-radar.md`) |
| „připrav win-back" | comeback maily na ex-klienty (`win-back.md`, `comeback-alumni.md`) |
| „retence / komu končí paušál" | nabídka prodloužení (`retence.md`, `upsell-map.md`) |
| „report z reklam" | FB/IG výkon + návrh škálovat/stop (`integrations/fb-ads-monitoring.md`) |
| „uděláme obsah z [podcast/téma]" | posty/reels/carousel (`content/`, `podcast-repurposing.md`) |
| „kdo si zaslouží recenzi/referral" | drafty žádostí ve správný čas (`recenze.md`, `referral.md`) |
| „spočítej makra pro nového klienta" | startovací makra ke schválení (`macro-calculator.md`) |

## 🔒 Platí vždy
- **Nic se neodesílá** — jen `create_draft`. Odesíláš Ty.
- **Ceny/fakta jen z `KNOWLEDGE_BASE.md`.** Zdraví → **eskalace**. Žádná osobní data klientů do repa.
- Když si agent není jistý daty → **zeptá se / nechá `[doplnit]` + flag**, nehádá.

## 🔧 Trvalé zapnutí
Ranní automatika přes **Routine** (návod `ROUTINES.md`) — běží i bez tebe, drží draft-only režim.
