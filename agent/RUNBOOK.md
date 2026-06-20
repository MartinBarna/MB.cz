# RUNBOOK — jak agenta reálně spustit

Praktický návod, jak s asistentem pracovat den po dni. Vše běží v režimu
**„agent připraví draft → Martin zkontroluje → odešle"**.

## Denní smyčka (nejjednodušší použití)

Martin napíše Claudovi např. **„projdi maily"** a agent:

1. Najde v Gmailu **nezodpovězené** poptávky a check-iny (dotazy níže).
2. Každou zprávu **zařadí** podle [`playbooks/triage.md`](playbooks/triage.md)
   (šum vs. práce + kontrola kontextu, ať nevznikne duplicita).
3. Podle playbooku připraví **draft odpovědi** + interní poznámku.
4. Vlákno **oštítkuje** (viz štítky níže), ať je vidět, co je vyřízené.
5. Na konci dá Martinovi krátký souhrn: co připraveno, co čeká na ruční vyřízení.

Martin pak otevře **Koncepty**, projede drafty, doladí a odešle.

## Gmail dotazy (cheat sheet)

Agent používá `mcp__Gmail__search_threads`. Užitečné dotazy:

- **Nezodpovězené v inboxu (poslední zpráva ne ode mě):**
  `in:inbox -in:sent newer_than:14d` → u každého vlákna ověř, že poslední zpráva je od klienta.
- **Check-iny (týdenní reporty):**
  `in:inbox (report OR "týdenní" OR "přehled o minulém týdnu" OR filename:xlsx) newer_than:14d`
- **Poptávky / leady:**
  `in:inbox ("mám zájem" OR koučink OR spolupráce OR "kolik stojí" OR cena OR konzultace) newer_than:30d`
- **Onboarding nového klienta (vzor Martinovy odpovědi):**
  `in:sent "posílám Ti ten makro plán"`
- **Kontrola, že už je odpovězeno:** otevři vlákno přes `get_thread` a zjisti, zda
  poslední zpráva má label `SENT` (= Martin už odpověděl → přeskoč).

> Pozor: `get_thread` vrací velký výstup. Když přesáhne limit, uloží se do souboru —
> vytáhni jen text přes `jq '.messages[] | .plaintextBody'` (viz zkušenost z minula).

## Štítky pro třídění (Gmail labels)

Doporučená sada (agent je umí přiřazovat přes `label_thread`):

- `MB-Agent/Poptávka` — nový zájemce, draft připraven
- `MB-Agent/Check-in` — týdenní report, draft připraven
- `MB-Agent/Eskalace` — k ručnímu vyřízení (zdravotní, stížnost, vrácení peněz, médiá)
- `MB-Agent/Hotovo` — Martin odeslal (volitelně po odeslání)

Logika: agent po vytvoření draftu přidá `Poptávka`/`Check-in`; u citlivého případu
přidá `Eskalace` a draft **nedělá**.

## Workflow kontroly (Martin)

1. Otevři **Koncepty** v Gmailu (drafty mají na konci interní poznámku `>>> …`).
2. U check-inu zkontroluj hlavně **navržená makra/kroky** (`>>> KE SCHVÁLENÍ`).
3. Smaž interní poznámku, doluď text, **odešli**.
4. Volitelně přehoď štítek na `MB-Agent/Hotovo`.

## Jak agenta „doučit"

Vše je v `agent/`. Nejčastější úpravy:

- **Změna ceny / balíčku** → `KNOWLEDGE_BASE.md` §2 (drž podle martinbarna.cz/koucing).
- **Jiný tón / nová oblíbená fráze** → `STYLE_GUIDE.md`.
- **Nové FAQ** → `KNOWLEDGE_BASE.md` §4.
- **Lepší logika úprav maker** → přidej příklad do `training-data/check-in-examples.md`.
- **Nová HTML šablona** (onboarding, poptávka) → označ Martinovi mail v Gmailu, agent
  z něj vytáhne kostru do `templates/` (jako u check-inu).

## Bezpečnostní brzdy (připomenutí)

- Agent **neodesílá** — jen drafty.
- Citlivé/zdravotní/sporné → **Eskalace**, žádný draft.
- Ceny a fakta **jen z KNOWLEDGE_BASE**; když chybí, do draftu `>>> DOPLNIT:` a upozornit.
- Interní info (provize, role coache, sales taktiky) klientovi **nikdy**.
