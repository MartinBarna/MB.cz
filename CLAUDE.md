# CLAUDE.md — orientace pro Claude

Tenhle repozitář má dvě části:

1. **`index.html`** + **`clanky/`** — on-brand landing page online koučinku Martina Barny
   (grafit + oranžová, balíčky Gold/Diamond, lead magnet, FAQ, kontakty) a SEO blog
   články. Fakta čerpá z `agent/KNOWLEDGE_BASE.md`; při změně cen aktualizuj obojí.
2. **`agent/`** — „mozek" AI asistenta, který za Martina **připravuje koncepty
   odpovědí (drafty)** na e-maily. Tohle je hlavní aktivní práce v repu.

## O kom to je

**Martin Barna** — online **výživový Coach** (NIKDY ne „trenér"), značka
**„Be Effective!" / Team Barna**, web martinbarna.cz. Prodává koučing (Gold,
Diamond), videokurz flexibilního stravování a lead magnety. Komunikuje neformálně,
povzbudivě; klientům tyká a oslovuje je zdrobnělinou („Nazdar Kubo!").

## Účel agenta

Šetřit Martinovi čas přípravou draftů odpovědí na:
- **Poptávky** (noví zájemci o koučing/videokurz),
- **Check-iny** (týdenní reporty stávajících klientů → úprava maker/kroků),
- **WhatsApp dotazy** (zatím ruční režim — kanál není napojený).

## Železná pravidla (platí vždy)

- **Agent NIKDY nic neodesílá** — jen `create_draft` v Gmailu. Odesílá Martin po kontrole.
- **Fakta (ceny, odkazy, balíčky) jen z `agent/KNOWLEDGE_BASE.md`.** Ceny pochází
  z martinbarna.cz/koucing. Nevymýšlet.
- **Žádná lékařská/dietní diagnóza, žádné sliby konkrétních kg/termínů.** Zdravotní
  témata → eskalovat.
- **Interní info (provize, že klienta vede coach, sales taktiky) se klientovi NIKDY
  nesděluje** — viz `KNOWLEDGE_BASE.md` §6.
- Píše se **česky** (slovenským klientům taky česky).

## Kde co je

| Soubor | K čemu |
|---|---|
| `agent/README.md` | Přehled + roadmapa |
| `agent/RUNBOOK.md` | **Jak agenta reálně spustit** (Gmail dotazy, štítky, denní smyčka) |
| `agent/AGENT_PROMPT.md` | Pravidla a bezpečnost, kdy eskalovat |
| `agent/STYLE_GUIDE.md` | Tón, oslovení, fráze, podpisy, HTML patička |
| `agent/KNOWLEDGE_BASE.md` | Produkty, ceny, proces, FAQ, filozofie, interní info |
| `agent/playbooks/` | Triage + postupy: poptávka, onboarding (+ makro-kalkulačka), check-in, briefing, churn-radar, win-back, retence, recenze, referral, touchpointy, WhatsApp, měsíční audit |
| `agent/tests/` | Pojistka proti regresím: golden cases + bezpečnostní spouštěče/checklist (anonymizované) |
| `agent/templates/` | Přesné HTML kostry mailů (formát + prokliky) — **kostru neměnit, měnit jen obsah** |
| `agent/training-data/` | Destiláty ze 4 let Gmailu + Drive (logika úprav, vzory odpovědí, agregát byznysu) |
| `agent/content/` | Content engine — strategie, scénáře postů/reels, podcast→obsah, sezónní kampaně, success stories, měsíční recap klienta |
| `agent/assets/` | Přílohy k mailům (lead-magnet PDF ženy/muži) k přikládání |
| `agent/crm/` | Klientská paměť (mini-CRM) — schéma + šablona; živá data v Sheetu/Notionu |
| `agent/integrations/` | Plány napojení: WhatsApp, Gmail filtry, Shopify, Blotato, FB ads, vidIQ |

## Konvence pro práci v tomhle repu

- Vývoj na větvi `claude/email-whatsapp-response-agent-h678qg`. Po dokončení commit + push + draft PR.
- Velké výstupy z Gmailu/Drive **nech zpracovat podagenty** a zapiš do `training-data/`
  (ať se nezahltí kontext). Osobní data klientů (jména, částky) do repa **nedávat** — jen agregát.
- Když měníš tón nebo znalosti agenta, edituješ soubory v `agent/` — to je celé „přetrénování".
