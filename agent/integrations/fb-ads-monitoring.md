# Sledování FB/IG reklam

Cíl: agent hlídá výkon kampaní na lead magnet a videokurz a hlásí, kdy škálovat / stopnout
/ přetočit kreativu. Navazuje na tvůj plán (Drive: „FB Ads na podporu lead magnetu").

## Co je potřeba
- Napojené FB/Meta Ads nástroje (insights, kampaně) — k dispozici.
- Pixel „Natty Rules" měří Purchase; ideálně přidat Lead event na vyplnění formuláře.

## Co agent reportuje (např. týdně)
- **CPL** (cena za lead), počet leadů, útrata.
- **Lead → videokurz** a hlavně **lead → poptávka na koučing** (to dělá zisk).
- Trend vs. minulý týden, nejlepší/nejhorší ad set a kreativa.

## Rozhodovací pravidlo (z tvého plánu)
- Když *(tržba kurzu + hodnota koučink poptávek) > náklad na ads* → **škáluj** rozpočet
  po ~30–50 % dávkách.
- Když ne → **stop nebo přetoč kreativu/cílení**, netop do toho dál.
- Cílení: MSK kraj + Morava; ženy 30–50 (/makro-plan/), muži 35–55 (/forma-zpet/).

## Účty (živé, ověřeno 6/2026)
- **235296588168325** — „Martin Barna" / business „Effective Fitness Training" (hlavní, CZK).
- **292844305** — druhý účet (CZK). Oba ACTIVE + dotazovatelné přes Meta Ads nástroje.
- Měna CZK, min. denní rozpočet ~21 Kč. Pixel „Natty Rules" `277526073774099`.

## Týdenní report (formát ke schválení)
```
📣 FB/IG reklamy — týden {{datum}}
• Útrata: {{Kč}} (Δ vs. minulý týden)
• Leady: {{N}} · CPL: {{Kč}} ({{Δ}})
• Lead → poptávka koučing: {{N}}  ·  Lead → videokurz: {{N}}
• Nejlepší ad set / kreativa: {{název}} (CPL {{Kč}})
• Nejhorší (kandidát na stop/přetočení): {{název}} (CPL {{Kč}})
→ Návrh: {{škálovat +30–50 % / stop / přetočit kreativu}} — čeká na Tvé OK.
```
Data tahej přes `ads_insights_*` / `ads_get_ad_entities` (read-only). Srovnávej 7d vs. předchozích 7d.

## Zásady
- Agent **nespouští ani nemění rozpočty bez tvého OK** — jen reportuje a navrhuje.
- „Neutratím ani korunu bez tvého potvrzení."
