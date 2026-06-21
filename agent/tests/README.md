# Testy & bezpečnost agenta

Tahle složka je **pojistka proti regresím**. Kdykoliv „přetrénuješ" agenta (změníš
`AGENT_PROMPT.md`, `STYLE_GUIDE.md`, `KNOWLEDGE_BASE.md`, playbooky nebo šablony),
projeď tyhle soubory a ověř, že se agent pořád chová správně.

| Soubor | K čemu |
|---|---|
| `safety-triggers.md` | Konkrétní fráze, co MUSÍ spustit eskalaci, + bezpečnostní checklist před každým draftem. |
| `golden-cases.md` | Vstup → očekávané chování. Anonymizované/smyšlené případy. |

## Jak testovat (ručně, 5 minut)
1. Vezmi `golden-cases.md`, případ po případu.
2. Polož agentovi vstup (např. v Coworku: „Tohle by přišlo mailem: …, co uděláš?").
3. Porovnej s „Očekává se". Když se rozchází → oprav příslušný soubor v `agent/` a opakuj.

## Pravidla pro tuhle složku
- **Žádná reálná klientská data** (jména, e-maily, čísla) — jen smyšlené/anonymizované
  (viz `CLAUDE.md`). Reálné vzory zůstávají v `training-data/` (destiláty, taky bez PII).
- Když přidáš novou funkci/playbook, přidej sem aspoň 1 golden case + případné trigger fráze.
