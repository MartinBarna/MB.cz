# Playbook: ČTENÍ REPORTU (Excel příloha „Report pro Coache")

Cíl: u check-inu vytáhnout data přímo z přílohy, ne jen z toho, co klient napíše do těla.
Přesnější makra a komentář.

## Postup
1. U check-in vlákna zjisti přílohy (`get_thread` → `attachments` / `attachmentIds`).
2. Hledej soubor typu **xlsx** s názvem ve stylu „Report pro Coache" / „report".
3. Stáhni obsah přílohy (Gmail get-attachment) a přečti **první stránku/list** — tam je to
   podstatné: váha, míry (pas/boky/břicho/zadek/ruce), průměr kcal, bílkoviny, kroky,
   minuty pohybu, případně subjektivní pocit (hlad/únava/síla).
4. Hodnoty použij ve check-in draftu dle `check-in.md` a v `>>> KE SCHVÁLENÍ` poznámce.
5. Aktualizuj CRM (poslední report, aktuální makra).

## Jak reálně reporty chodí (typy doručení — ověřeno z Gmailu)
Report nedorazí vždy jako čitelná příloha. Pořadí, jak to zkoušet:
1. **xlsx příloha** přímo v mailu → ideál, čti dle struktury výše (`report-structure.md`).
2. **Google Sheet / Drive odkaz** v těle (`docs.google.com/spreadsheets/...`) → otevři přes Drive
   nástroje (`read_file_content`/`download_file_content`). Pokud nemáš přístup → fallback na tělo.
3. **„Klient vám nasdílel soubor"** (Drive share notifikace) → soubor je na Drive; zkus otevřít.
4. **Chráněný xlsx** („For security purposes, you must enter the code…" / „zadejte kód") →
   **nelze otevřít programově** → fallback na tělo + `>>> OVĚŘ data z přílohy (chráněný soubor)`.
5. **Data v těle mailu** — klient často napíše klíčové změny rovnou do textu („- 1 cm pas, 1751 kcal").
   Ber je jako primární, když příloha nejde.
6. **„Zbytek na WA" / „více v hlasovkách"** — část reportu je na WhatsApp (mimo Gmail, nepřístupné)
   → v draftu nech prostor, do interní poznámky `>>> ČÁST REPORTU NA WA — ověř před odesláním`.

## Když to nejde
- Příloha je PDF / obrázek / chráněný soubor, který nejde přečíst → vezmi data z těla
  mailu a do interní poznámky napiš `>>> OVĚŘ data z přílohy`.
- Data nedávají smysl / chybí klíčové → nehádej, eskaluj (viz `check-in.md` Hranice).
- Nikdy si čísla nevymýšlej — když chybí, radši se v draftu zeptej / nech `[doplnit]` + flag Martinovi.

## Pozn.
Nejde o měnění makra od oka — vždy je to **návrh ke schválení** Martinem.
