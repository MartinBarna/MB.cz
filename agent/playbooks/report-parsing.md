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

## Když to nejde
- Příloha je Google Sheet odkaz / PDF / obrázek, který nejde přečíst → vezmi data z těla
  mailu (co klient napsal) a do interní poznámky napiš `>>> OVĚŘ data z přílohy`.
- Data nedávají smysl / chybí klíčové → nehádej, eskaluj (viz `check-in.md` Hranice).

## Pozn.
Nejde o měnění makra od oka — vždy je to **návrh ke schválení** Martinem.
