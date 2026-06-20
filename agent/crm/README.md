# Klientská paměť (mini-CRM)

Aby agent psal osobně a navazoval („minulý týden jsme zvedli kroky na 10k…"), potřebuje
si u každého klienta pamatovat kontext. Tohle je návrh struktury + jak s ní agent pracuje.

> **Kde data žijí:** v **Google Sheetu** nebo **Notionu** (ne v repu!). Repo obsahuje jen
> SCHÉMA a šablonu. Osobní data klientů do gitu nepatří. Doporučení: Google Sheet
> (rychlé, agent ho umí číst i zapisovat přes Drive/Sheets).

## Schéma (sloupce) — viz `clients-schema.csv`

| Sloupec | Příklad | K čemu |
|---|---|---|
| jmeno | Kuba (Jakub Novák) | oslovení (5. pád), identifikace |
| email | … | párování s vláknem |
| balicek | Gold / Diamond | tón, co klient má k dispozici |
| start | 2026-05-28 | od kdy běží |
| konec_pausalu | 2026-06-28 | spustí nabídku prodloužení (retence) |
| cil | zhubnout ~8 kg | kontext odpovědí |
| aktualni_kcal | 2100 | navázání u check-inu |
| aktualni_makra | B140/S255/T58, vláknina 29+ | navázání |
| kroky_cil | 10 000 | navázání |
| posledni_report | 2026-06-15 | spouští auto-nudge (viz nudge-reporty.md) |
| stav | aktivní / pauza / ukončeno | filtr |
| poznamka | „má rád jednoduchá jídla, busy s dětmi" | personalizace |

## Jak agent pracuje s pamětí

1. **Před draftem check-inu/odpovědi** si klienta najde v CRM (podle e-mailu/jména) a
   použije kontext (cíl, minulá makra, poznámky) — navazuje, neopakuje se.
2. **Po odeslání** (Martin schválí) agent navrhne update řádku: nové makra, datum reportu,
   poznámka. Martin potvrdí zápis.
3. **Anonymizace:** do repa, contentu ani veřejných výstupů NIKDY nedávej jména/čísla
   klientů. CRM je soukromé (Sheet/Notion s omezeným přístupem).

## Spuštění (až řekneš)
- Vyber **Google Sheet** (doporučeno) nebo Notion.
- Agent založí list s hlavičkami z `clients-schema.csv` (prázdný, bez dat).
- Postupně se plní z onboardingů a check-inů. Není potřeba migrovat 4 roky najednou —
  CRM roste s aktivními klienty.

## Per-klient profil (alternativa/rozšíření)
Pro hlubší poznámky lze u klienta vést i textový profil — šablona `client-template.md`.
