# Playbook: MĚSÍČNÍ AUDIT (údržba mozku agenta)

Cíl: jak systém roste (~40+ souborů), jednou měsíčně zkontrolovat, že je **konzistentní a
nic se nerozbilo**. Drobná údržba teď = žádné trapasy v draftech později (špatná cena, mrtvý odkaz).

## Checklist (1× měsíčně, agent připraví report)
1. **Ceny & balíčky sedí napříč:** porovnej čísla v `index.html`, `clanky/`, `templates/`,
   `content/` proti **jedinému zdroji pravdy** `KNOWLEDGE_BASE.md`. Rozdíl → nahlas, oprav po OK.
2. **Odkazy:** prokliky v `templates/` a `assets/` (web, podcast, sítě, lead magnet) — žádný mrtvý/překlep.
3. **Golden testy:** projdi `tests/golden-cases.md` + `tests/safety-triggers.md` — pořád dávají smysl?
   Přibyl nový typ mailu bez test casu? Doplň.
4. **Šablony vs. realita:** kostry v `templates/` odpovídají tomu, co Martin reálně posílá? (Změnil podpis, odkazy?)
5. **CRM hygiena:** sedí stavy (🟢/🟡/🔴), nejsou „viset" leady bez akce, duplicitní záznamy?
6. **Konzistence pravidel:** neodporují si playbooky (např. mantinely maker v `check-in.md` × `macro-calculator.md`)?
7. **Odkazy mezi soubory:** `CLAUDE.md` tabulka + cross-refs ukazují na existující soubory (nic přejmenovaného).

## Výstup
```
🔍 Měsíční audit — {{datum}}
• Ceny/balíčky: OK / {{nesoulad: kde}}
• Mrtvé odkazy: {{N}} — {{kde}}
• Testy: OK / {{co doplnit}}
• CRM: {{co uklidit}}
• Nesoulad pravidel: {{popis}}
→ Návrhy oprav ke schválení: {{N}}
```

## Zásady
- Audit **jen reportuje a navrhuje** — opravy až po schválení (stejně jako u draftů).
- Když najdeš nesoulad cen, je to priorita 1 (ovlivní reálné maily klientům).
- Drž to stručné — checklist, ne esej.
