# Playbook: KALENDÁŘ (domluva konzultace)

Cíl: když zájemce/klient chce hovor (úvodní konzultace, video call), agent **navrhne
termíny** podle volných oken v Google Kalendáři a po potvrzení **založí událost**.
Princip jako všude: agent připraví, Martin (nebo klient potvrzením) odsouhlasí.

## Nástroje (Google Calendar, už napojené)

- `list_calendars` — zjisti kalendáře.
- `list_events` / `suggest_time` — najdi volná okna.
- `create_event` — založ událost (až po potvrzení).
- `update_event` / `delete_event` — přesun/zrušení.

## Postup

1. **Zjisti záměr:** chce klient hovor? (úvodní konzultace u poptávky, nebo týdenní call
   u Diamondu). Zjisti délku (úvodní konzultace ~15–20 min) a preferenci (den/čas, telefon/Skype).
2. **Najdi volno:** přes `suggest_time` / `list_events` v Martinově kalendáři. Respektuj
   pracovní okno (uprav dle reality, např. po–pá; rána bývají na obsah/ČT).
3. **Navrhni v draftu 2–3 termíny** (ne 1) — v mailu/WhatsApp draftu Martinovým stylem:
   „Hodí se Ti některý z těchto? Út 14:00, St 9:30, nebo Čt 17:00? Klidně napiš vlastní."
4. **Po potvrzení** (klient vybral / Martin odsouhlasil) → `create_event`:
   - název: „Konzultace — {{jméno}}", popis: cíl klienta + kontakt,
   - délka dle bodu 1, připomínka 1 den + 30 min předem,
   - pozvi e-mail klienta, případně přidej odkaz (Skype/telefon).
5. **Potvrzovací zpráva** klientovi (draft): termín + co si připravit + jak se spojíme.

## Hranice

- **Událost zakládej až po jasném potvrzení** (od klienta nebo Martina), ne spekulativně.
- Nepřebookuj — vždy zkontroluj kolize přes `list_events`.
- Citlivé/nejasné (zdravotní, platba) → eskalace, ne automatické bookování.
- Termíny nabízej realisticky; když nevíš pracovní okno Martina, zeptej se / nech `>>> DOPLNIT`.
