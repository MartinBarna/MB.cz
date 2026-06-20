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
│   ├── briefing.md      ← ranní souhrn inboxu
│   ├── poptavka.md      ← jak odpovídat na poptávky
│   ├── namitky.md       ← práce s námitkami (cena, „zvládnu sám"…)
│   ├── check-in.md      ← jak reagovat na týdenní reporty
│   ├── report-parsing.md ← čtení Excel reportu z přílohy
│   ├── nudge-reporty.md ← nudge na chybějící report (retence)
│   ├── recenze.md       ← sběr recenzí/referencí
│   ├── lead-pipeline.md ← přehled prodeje (fáze leadů)
│   ├── win-back.md      ← oslovení bývalých klientů (návrat)
│   ├── whatsapp.md      ← jak odpovídat na WhatsApp dotazy
│   ├── kalendar.md      ← domluva konzultace (Google Kalendář)
│   └── retence-doprodej.md ← prodloužení, re-engagement, doprodej
├── templates/           ← HTML kostry mailů (formát + prokliky)
│   ├── README.md        ← pravidlo: kostru neměnit, měnit jen obsah
│   ├── check-in-template.html   ← přesná kostra z Gmailu (check-in)
│   ├── onboarding-template.html ← uvítací mail (dle reálného znění)
│   ├── poptavka-template.html   ← odpověď na poptávku
│   ├── retence-prodlouzeni.html ← prodloužení spolupráce
│   ├── reengagement-poptavka.html ← follow-up zájemce
│   ├── doprodej-videokurz.html  ← doprodej videokurzu (akce)
│   ├── nudge-report.html        ← nudge na chybějící report
│   ├── recenze-prubeh.html      ← žádost o recenzi (po výsledku)
│   ├── recenze-konec.html       ← reference na konci spolupráce
│   ├── win-back-1.html / -2 / -3 ← návrat bývalých klientů (sekvence)
│   └── nurture-series/   ← lead-magnet funnel: vlna 1–4
├── training-data/       ← „tréninková" data vytěžená z Gmailu + Drive
│   ├── check-in-examples.md      ← reálné dvojice data klienta → úprava maker
│   ├── poptavka-examples.md      ← reálné odpovědi na poptávky + onboarding
│   ├── business-insights.md      ← mix balíčků, retence/LTV, lead magnety (agreg.)
│   ├── faq-full.md               ← rozšířené FAQ z e-booku (pokročilá témata)
│   └── quick-answers.md          ← rychlé odpovědi na časté dotazy (WhatsApp/mail)
├── content/             ← content engine (z praxe dělej posty/reels)
│   ├── README.md        ← strategie, pilíře, workflow (vidIQ/Blotato/Canva)
│   ├── starter-posts.md ← 12 hotových scénářů k použití
│   ├── carousels.md     ← hotové texty slidů pro carousely
│   ├── content-calendar.md ← 30denní plán (kdy co postovat)
│   └── canva-designs.md ← log vygenerovaných grafik (odkazy do Canvy)
├── crm/                 ← klientská paměť (schéma + šablona; data v Sheetu/Notionu)
│   ├── README.md        ← jak agent pracuje s pamětí + anonymizace
│   ├── clients-schema.csv ← hlavičky pro Google Sheet
│   └── client-template.md ← profil klienta (prázdná šablona)
└── integrations/        ← plány napojení dalších kanálů/služeb
    ├── whatsapp-setup.md            ← WhatsApp Business API (fáze 4)
    ├── whatsapp-n8n-build.md        ← konkrétní build v n8n (ready k zapnutí)
    ├── inbox-cleanup-gmail-filters.md ← Gmail filtry na úklid inboxu
    ├── shopify-onboarding.md        ← nová objednávka → onboarding/dodání
    ├── blotato-publishing.md        ← publikace obsahu (se schválením)
    ├── fb-ads-monitoring.md         ← sledování výkonu reklam
    └── vidiq-content-ideas.md       ← YouTube/IG témata, tituly, thumbnaily
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
