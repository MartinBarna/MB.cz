# Schopnost: KALENDÁŘ — booking konzultací + check-in připomínky

Cíl: agent umí k horkému leadu **navrhnout termíny** a po potvrzení **založit událost**, a hlídat,
ať žádný klient nepropadne sítem (týdenní check-in připomínky). Napojený Google Calendar.

> Železné pravidlo (jako u mailů): **agent navrhne, Martin potvrdí.** Událost agent zakládá
> až na Martinovo „jo, založ" (nebo když to Martin explicitně deleguje). Žádné tiché zápisy do kalendáře.

## Kalendáře (zjištěno)
- `fitness.barna@gmail.com` — **primární** (Europe/Prague), tréninky + cally + osobní.
- „Schůzky z Facebooku pro Martin Barna…" — sem padají **rezervace z FB** (lead už si vybral čas).
- „App EFT", „České státní svátky", `martaakuba@gmail.com`.

## A) Booking konzultace (nový lead chce call)
1. **Najdi volno:** `suggest_time` / `list_events` na primárním kalendáři, pracovní okno
   (návrh po–pá ~9–17, mimo tréninky a cally). Vyber **2–3 termíny**.
2. **Draft e-mailu** (přes `create_draft`, viz `playbooks/poptavka.md`): nabídni ty 2–3 sloty,
   krátce + lidsky („Hodí se Ti some z těchto? Klidně navrhni vlastní."). NEODESÍLÁ se.
3. **Po potvrzení** leadem → `create_event` na primár: 30–45 min, název ve stylu Martina
   (např. „📞 Konzultace — Jana N. (koučing)"), popup reminder 30 min, do popisu shrnutí z CRM.
   Telefonát = číslo do popisu; online = přidej Google Meet.
4. **Pre-call brief:** před callem agent z CRM/Gmailu připraví 4–5 vět „kdo to je, co řešil".
   To samé pro rezervace z FB kalendáře (čas už mají, agent jen dodá brief).

## B) Check-in připomínky (ať nikdo nepropadne)
- **Pondělní dávka:** 1 týdenní připomínka „⚡️ Check-iny: projít reporty" + seznam, od koho
  report čekáme (z CRM `posledni_report`). Agent připomínku navrhne, Martin schválí založení.
- **At-risk hlídač:** když klient nereportoval > 10 dní (CRM), agent přidá do připomínky flag
  „ozvi se: [jméno]" → napojení na `playbooks/churn-radar.md`.
- Tréninkové eventy s počítadly („8/20 zaplaceno") needituj — to je Martinův osobní systém.

## Hranice
- Nezakládat/nepřesouvat/nerušit cizí ani existující eventy bez výslovného pokynu.
- Časy vždy v Europe/Prague (pozor na eventy v jiných TZ — Malta/Bangkok jsou cesty).
- Zdravotní/citlivé poznámky z callu do popisu jen stroze, ne diagnózy.
