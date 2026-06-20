# Playbook: AUTO-NUDGE na chybějící report

Cíl: klienti, co dlouho neposlali check-in, „vypadnou z procesu". Agent je najde a připraví
přátelské popostrčení. Drží lidi v procesu = lepší výsledky i delší spolupráce (retence).

## Jak najít „mlčící" klienty

- **Z CRM** (nejlepší): vyber `stav = aktivní` a `posledni_report` starší než 7 dní.
- **Bez CRM** (než ho rozjedeme): v Gmailu najdi aktivní klienty (ti, kterým jsi posílal
  check-in „Přeju bomba den") a zkontroluj, jestli od nich přišel report za poslední ~9 dní.
  `in:sent "Přeju bomba den" newer_than:60d` → u každého ověř datum posledního příchozího reportu.

## Pravidla

- Nudge posílej, když uplynulo **~8–9 dní** bez reportu (report bývá týdně ne/po).
- **Max 1 nudge** za vlnu. Když pak nereaguje 2. týden → eskalace (může chtít pauzu/končit).
- **Eskalace, ne nudge**, když je v CRM `stav = pauza/ukončeno`, nebo když poslední
  komunikace naznačuje nespokojenost/zdravotní téma.
- Tón: lehký, starostlivý, žádné výčitky. Krátké (klidně i jako WhatsApp).

## Šablona
`../templates/nudge-report.html` (krátký mail) — placeholder `{{JMENO}}`.

## Po akci
Zapiš do CRM poznámku „nudge odeslán {{datum}}", ať neposíláš dvakrát.
