# WhatsApp — konkrétní build v n8n (ready k zapnutí)

Návod, jak workflow reálně postavit, jakmile vybereš BSP a číslo (viz `whatsapp-setup.md`).
Příklad s **n8n** + **360dialog/Twilio**. Princip: příchozí WA → Claude návrh → schválení → odeslání.

## Předpoklady
- WABA + číslo + API klíč (360dialog) nebo Twilio Account SID/Token + WA číslo.
- Anthropic API klíč (model `claude-opus-4-8`).
- Schvalovací kanál: Telegram bot (token + tvoje chat_id) — nejrychlejší na mobil.
- Obsah agenta (AGENT_PROMPT, STYLE_GUIDE, KNOWLEDGE_BASE, playbooks/whatsapp.md) —
  buď zkopíruj do jednoho system promptu, nebo n8n stáhne z tohoto repa (raw GitHub).

## Workflow A — příchozí zpráva → návrh → schválení

1. **Webhook (Trigger)** — `POST /whatsapp-in`. U 360dialog/Twilio nastav webhook na tuhle URL.
2. **Function: parsuj** — vytáhni `from` (číslo klienta), `text`, časové razítko.
3. **(volitelně) Lookup kontaktu** — dohledej jméno/historii (Google Sheet/Notion DB).
4. **HTTP Request → Anthropic** `POST https://api.anthropic.com/v1/messages`
   - header `x-api-key`, `anthropic-version: 2023-06-01`
   - body: `model: claude-opus-4-8`, `max_tokens: 1024`,
     `system`: pravidla agenta (viz výše) + „Píšeš návrh WhatsApp odpovědi, kratší/neformální,
     fakta jen z KNOWLEDGE_BASE, zdravotní/objednávkové → označ [ESKALACE].",
     `messages`: `[{role:"user", content: <text klienta + kontext>}]`.
5. **Function: priprav návrh** — vezmi `content[0].text`. Když obsahuje `[ESKALACE]`,
   označ jako k ruční reakci.
6. **Telegram → Martin** — pošli: jméno + dotaz + **navržená odpověď** + tlačítka
   **Schválit / Upravit / Zahodit** (inline keyboard; callback nese `from` + návrh).

## Workflow B — schválení → odeslání
7. **Telegram Trigger (callback)** — zachyť stisk tlačítka.
8. **Switch:**
   - *Schválit* → **HTTP Request → WhatsApp API** (360dialog `/messages` nebo Twilio) pošli návrh na `from`.
   - *Upravit* → vyžádej si od tebe nový text (reply), pak odešli.
   - *Zahodit* → konec.
9. **Log** — zapiš do Sheetu/Notionu (kdo, dotaz, odpověď, čas) pro přehled a „doučování".

## Fáze 4b (auto-send) — až po ověření
- Přidej za krok 5 **klasifikaci jistoty**: když je dotaz jednoznačné FAQ (Claude vrátí
  `confidence: high` a žádná eskalace), pošli rovnou (krok 8 Schválit) a Martinovi jen
  pošli kopii. Citlivé/nejisté vždy přes schválení.

## Pozn. k 24h oknu
Odpovídáš na příchozí zprávu → jsi v 24h service okně → volný text, žádné šablony.
Mimo okno (proaktivně) by byla potřeba schválená šablona — pro reply-bota neřešíš.

## Co dodat, až to stavíme
- BSP přístupy, Telegram token + chat_id, Anthropic klíč → vložíme do n8n credentials.
- Rozhodnout, kde držet kontext klientů (Sheet/Notion) pro personalizaci.
