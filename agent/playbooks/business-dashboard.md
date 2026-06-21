# Playbook: BYZNYS DASHBOARD (týdenní + měsíční přehled)

Cíl: dát Martinovi čísla byznysu na jednom místě — ať vidí **trend**, ne jen den po dni.
Rozšiřuje týdenní snippet z `briefing.md` o pipeline, reklamy a obsah. Jen reportuje.

## Zdroje
CRM (`../crm/`), lead pipeline (`lead-pipeline.md`), FB ads (`../integrations/fb-ads-monitoring.md`),
content kalendář (`../content/content-calendar.md`), Gmail (odeslané/odpovědi).

## Týdenní (pondělí)
```
📊 Týden {{datum}}
• Aktivní klienti: {{N}} → 🟢{{x}} / 🟡{{y}} / 🔴{{z}}
• Reportů přišlo: {{N}} z {{aktivních}}
• Pipeline: {{N}} leadů (vlna 1–4) · 🔥 horké: {{N}}
• Nové poptávky / nástupy: {{N}} / {{N}}
• Churn: {{N}} ukončení · Win-back návraty: {{N}}
• Ads: útrata {{Kč}} · leady {{N}} · CPL {{Kč}} (Δ)
• Obsah: vyšlo {{N}} / naplánováno {{N}}
```

## Měsíční (1. v měsíci — širší)
```
📈 Měsíc {{měsíc}}
• Aktivních na konci: {{N}} (Δ vs. minulý měsíc)
• Nových klientů / churn / net růst: {{N}} / {{N}} / {{±N}}
• Konverze: lead→poptávka {{%}} · poptávka→nástup {{%}} · videokurz→koučing {{N}}
• Ads: útrata {{Kč}} · CPL {{Kč}} · odhad lead→koučing hodnota
• Retence: prům. délka spolupráce {{měs}} · referral nástupy {{N}}
• Obsah: nejlepší post/reel ({{dosah}}) · podcast epizody {{N}}
→ 1 doporučení na příští měsíc: {{co zopakovat / co zlepšit}}
```

## Zásady
- Jen agregát, **žádná osobní data klientů do repa** (do dashboardu v chatu jména OK, do repa ne).
- Čísla ber z reálných zdrojů, nehádej. Chybí-li, napiš „n/a", nevymýšlej.
- Cíl = vidět trend a 1 akci, ne tabulka pro tabulku.
