# Playbook: RANNÍ BRIEFING inboxu

Cíl: jeden krátký souhrn, ať Martin ráno ví, co ho čeká, a jen schvaluje. Spustí se na
„projdi maily" / „ranní briefing".

## Postup
1. Projdi inbox dle `triage.md` (šum vs. práce + kontrola kontextu).
2. **Kalendář na dnešek** (`list_events`, Europe/Prague): vypiš cally / konzultace / tréninky.
   Ke každému **callu/konzultaci** přidej mini **pre-call brief** z CRM/Gmailu (kdo to je, co
   naposledy řešil, cíl) — viz `../integrations/calendar-booking.md`. Tréninky jen vyjmenuj.
3. Zkontroluj CRM + spouštěče: report 8+ dní (→ nudge), konec paušálu do 7 dní (→ retence),
   **at-risk** u aktivních (`churn-radar.md`), **milník u 🟢 klienta** (→ recenze, `recenze.md`),
   ukončení 2–6 měs zpět (→ win-back).
4. **Pipeline:** vypíchni 🔥 horké leady a kdo „čeká na Martina" (`lead-pipeline.md`).
5. Připrav drafty (check-iny, poptávky, nudge, retence, recenze) do Konceptů + oštítkuj.
   At-risk a win-back vyžadují citlivost — řiď se příslušným playbookem.
6. Vrať Martinovi **krátký souhrn** v tomto formátu:

```
☀️ Ranní briefing — {{datum}}
🗓️ Dnešní program:
   • {{čas}} {{call/konzultace}} — {{jméno}} → brief: {{1 věta kdo to je / co řešit}}
   • {{čas}} trénink — {{jméno}} ({{místo}})
• Check-iny: {{N}} (drafty hotové) — {{jména/zkratky}}
• 🔥 Horké leady (čekají na Tebe): {{N}} — {{jména}}
• Poptávky/leady: {{N}} ({{X}} draftů, {{Y}} jen funnel)
• Nudge na report: {{N}} klientů ({{jména}})
• 🟡 At-risk: {{N}} — {{jména}} (návrh: call / měkký check-in)
• 🟢 Recenze (milník): {{N}} — {{jména}} (ideální chvíle požádat)
• Retence (končí paušál ≤7 dní): {{N}}
• Win-back fronta: {{N}} ({{jména}})
• ⚠️ K ručnímu (eskalace): {{N}} — {{stručně proč}}
• Šum přeskočen: {{N}}
→ V Konceptech čeká {{N}} draftů ke schválení.
```

## Týdenní dashboard (pondělí navíc)
Jednou týdně přidej k briefingu krátký „stav byznysu" (z CRM + churn radaru), ať vidíš trend:

```
📊 Týden {{datum}}
• Aktivních klientů: {{N}}  →  🟢 {{x}} / 🟡 {{y}} / 🔴 {{z}}
• Reportů přišlo tento týden: {{N}} z {{aktivních}}
• Leady ve funnelu: {{N}} (vlna 1–4)
• Odesláno minulý týden: {{check-iny}} / {{retence}} / {{win-back}} / {{recenze}}
• Churn za měsíc: {{N}} ukončení  ·  Návratů (win-back): {{N}}
```
Účel: vidět, jestli trend jde nahoru (víc 🟢, míň churnů), ne jen řešit den po dni.

## Zásady
- Žádné drafty se neodesílají — jen čekají ke schválení.
- Stručnost: briefing = pár řádků, ne esej.
- Citlivé/nejasné → eskalace, ne draft.
