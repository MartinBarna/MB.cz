# Asistent Martina Barny — příprava odpovědí (Gmail)

Tohle je „mozek" AI asistenta, který za Martina **připravuje koncepty odpovědí**
(drafty) na tři typy zpráv:

1. **Poptávky** na koučing / videokurz (nový zájemce)
2. **Check-iny** od stávajících klientů (týdenní report)
3. **WhatsApp dotazy** klientů (zatím manuálně, viz roadmapa)

> **Důležité:** Asistent **nikdy nic neodesílá sám.** Vždy vytvoří draft v Gmailu,
> Martin ho zkontroluje a teprve pak odešle. Plná autonomie se zapne až po
> dostatečném ověření, postupně.

## Jak to funguje (dnešní prototyp)

Asistent (Claude s přístupem ke Gmailu a Google Drive) při zpracování zprávy:

1. Načte příchozí e-mail / report.
2. Pravidla a tón si vezme z těchto souborů (to je to „natrénování"):
   - [`AGENT_PROMPT.md`](AGENT_PROMPT.md) — co smí, co nesmí, kdy eskalovat
   - [`STYLE_GUIDE.md`](STYLE_GUIDE.md) — tón, fráze, oslovení, podpis
   - [`KNOWLEDGE_BASE.md`](KNOWLEDGE_BASE.md) — produkty, ceny, odkazy, FAQ
   - [`playbooks/`](playbooks) — postup pro každý typ zprávy
3. Připraví draft v Gmailu (`mcp__Gmail__create_draft`).
4. Martin draft zkontroluje → upraví → odešle.

Praktický postup („projdi maily", Gmail dotazy, štítky, kontrola draftů) je v
[`RUNBOOK.md`](RUNBOOK.md). Rychlý start: Martin napíše Claudovi **„projdi maily"**.

## „Natrénování" = úprava těchto souborů

Nejde o klasické dotrénování modelu. Tón a znalosti se ladí editací souborů
výše — je to okamžité, levné a plně pod kontrolou. Když chceš něco změnit
(nová cena, jiná formulace, nové FAQ), upravíš příslušný soubor a hotovo.

## Struktura

```
agent/
├── README.md            ← tento soubor
├── RUNBOOK.md           ← jak agenta reálně spustit (Gmail dotazy, štítky, denní smyčka)
├── AGENT_PROMPT.md      ← hlavní instrukce agenta (pravidla + bezpečnost)
├── STYLE_GUIDE.md       ← styl psaní Martina
├── KNOWLEDGE_BASE.md    ← produkty, ceny, odkazy, časté dotazy
├── playbooks/
│   ├── triage.md        ← třídění pošty: šum vs. práce + kontrola kontextu
│   ├── poptavka.md      ← jak odpovídat na poptávky
│   ├── check-in.md      ← jak reagovat na týdenní reporty
│   ├── whatsapp.md      ← jak odpovídat na WhatsApp dotazy
│   └── kalendar.md      ← domluva konzultace (Google Kalendář)
├── templates/           ← HTML kostry mailů (formát + prokliky)
│   ├── README.md        ← pravidlo: kostru neměnit, měnit jen obsah
│   ├── check-in-template.html   ← přesná kostra z Gmailu (check-in)
│   ├── onboarding-template.html ← čistá verze (uvítací mail)
│   └── poptavka-template.html   ← čistá verze (odpověď na poptávku)
├── training-data/       ← „tréninková" data vytěžená z Gmailu + Drive
│   ├── check-in-examples.md      ← reálné dvojice data klienta → úprava maker
│   ├── poptavka-examples.md      ← reálné odpovědi na poptávky + onboarding
│   └── business-insights.md      ← mix balíčků, retence/LTV, lead magnety (agreg.)
├── content/             ← content engine (z praxe dělej posty/reels)
│   ├── README.md        ← strategie, pilíře, workflow (vidIQ/Blotato/Canva)
│   └── starter-posts.md ← 12 hotových scénářů k použití
└── integrations/        ← plány napojení dalších kanálů
    ├── whatsapp-setup.md            ← WhatsApp Business API (fáze 4)
    └── inbox-cleanup-gmail-filters.md ← Gmail filtry na úklid inboxu
```

## Tréninková data (to „natrénování" mými maily/materiály)

Ve `training-data/` jsou destiláty z **~4 let e-mailů** a z Drive (materiály pro
klienty i Team Barna). Z nich agent čerpá tvou skutečnou logiku — hlavně u
check-inů páruje *data klienta z reportu → jak jsi upravil makra/kroky → jak jsi
to napsal*. Čím víc příkladů sem přidáme, tím přesněji agent trefí tvůj styl
i rozhodování. Osobní údaje klientů (jména, částky) sem **nedáváme** — platby
jsou jen agregovaně.

## Roadmapa k plné autonomii

| Fáze | Co | Stav |
|---|---|---|
| 1 | Asistent připravuje **drafty** v Gmailu, Martin schvaluje | ✅ teď |
| 2 | Štítkování příchozích (`MB-Agent/*`) + auto-draft — viz `RUNBOOK.md` | další krok |
| 3 | Auto-odeslání u **jednoznačných rutinních** případů | až po ověření |
| 4 | **WhatsApp** přes WhatsApp Business API + n8n/Make (24/7) — plán: [`integrations/whatsapp-setup.md`](integrations/whatsapp-setup.md) | vyžaduje účty |
| 5 | **Content engine** (posty/reels) + **Kalendář** (booking konzultací) | připraveno |

Detaily: WhatsApp [`playbooks/whatsapp.md`](playbooks/whatsapp.md) · úklid inboxu
[`integrations/inbox-cleanup-gmail-filters.md`](integrations/inbox-cleanup-gmail-filters.md)
· obsah [`content/README.md`](content/README.md) · kalendář [`playbooks/kalendar.md`](playbooks/kalendar.md).
