# WhatsApp napojení (fáze 4)

Cíl: agent připravuje **návrhy odpovědí** na WhatsApp dotazy klientů stejně jako u mailu.
Zatím ruční režim (kopíruješ dotaz Claudovi). Tady je plán na automatizaci 24/7.

## Co je potřeba (jednorázově)

WhatsApp **nelze** automatizovat přes běžnou aplikaci. Potřebuješ **WhatsApp Business
Platform (Cloud API)** od Mety:

1. **Meta Business účet** + ověřená firma.
2. **Telefonní číslo** vyhrazené pro API (nesmí být aktivní v běžné WhatsApp appce).
   Tip: vezmi nové číslo, ať si necháš stávající 603229831 na ruční komunikaci.
3. **WhatsApp Business Account (WABA)** + přístupový token.
4. Volitelně **poskytovatel (BSP)** pro snadnější napojení: **360dialog**, **Twilio**
   nebo **Infobip** (méno kódu než Meta API napřímo).

## Důležité pravidlo: 24h okno

- Když ti klient napíše, máš **24 h na volnou odpověď** (tzv. service window) — to je
  náš případ (reagujeme na dotazy) → **žádné schvalované šablony, levné/zdarma**.
- Zpráva **mimo** 24h okno (proaktivní oslovení) vyžaduje předem schválenou šablonu a
  účtuje se dle Meta ceníku. Pro reply-bota to většinou neřešíš.

## Architektura (doporučená, no-code)

```
Klient na WhatsApp
      │ (zpráva)
      ▼
WhatsApp Cloud API ──webhook──▶ n8n / Make
                                   │  1) načte kontext (kdo píše, historie)
                                   │  2) zavolá Claude (Anthropic API) s pravidly agenta
                                   │     (AGENT_PROMPT + STYLE_GUIDE + KNOWLEDGE_BASE + playbooks/whatsapp.md)
                                   │  3) vytvoří NÁVRH odpovědi
                                   ▼
                         Schvalovací fronta (Telegram/Slack/e-mail/Notion)
                                   │  ty kliknеš Schválit / Upravit
                                   ▼
                         n8n/Make pošle odpověď přes WhatsApp API
```

## Fázování (drž bezpečí)

- **4a — Draft only:** agent navrhne odpověď, přistane ti do schvalovací fronty
  (např. Telegram bot „Schválit/Upravit/Zahodit"). Ty odešleš. Stejná filozofie jako maily.
- **4b — Auto-send u jasných FAQ:** po ověření necháš agenta sám odpovídat na jednoznačné
  rutinní dotazy (např. „můžu si dát X", odkaz na materiál). Citlivé → vždy k tobě.

## Styl na WhatsApp

Viz `../playbooks/whatsapp.md`: kratší, neformální, tykání, emoji, bez plného podpisu,
fakta z KNOWLEDGE_BASE, zdravotní/objednávkové → eskalace.

## Náklady (orientačně)

- BSP měsíční poplatek (jednotky € až nízké desítky € dle poskytovatele).
- Zprávy v 24h service okně jsou pro reply-bota minimální/nulové; mimo okno se platí
  za konverzaci/šablonu dle Meta ceníku.
- Claude API: pár haléřů za odpověď.
Přesná čísla doladíme podle zvoleného BSP, až se pustíme do realizace.

## Co potřebuju od tebe, abych to rozjel

1. Rozhodnutí o čísle (nové vs. stávající).
2. Volba BSP (doporučuju 360dialog nebo Twilio) — nebo Meta Cloud API napřímo.
3. Kde chceš schvalovací frontu (Telegram je nejrychlejší na mobil).
Pak připravím konkrétní n8n/Make workflow a napojení na pravidla agenta.
