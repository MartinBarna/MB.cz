# AI Martin — architektura (#53/#68) — KOSTRA, zbytek později (jako audio)

Cíl: chat na webu, který odpovídá ve stylu Martina a na základě jeho znalostí. Frontend kostra hotová (`assets/ai-martin.js`), backend (RAG + LLM) se dodělá, až bude korpus + API klíč.

## Stav
- ✅ **Frontend widget** (`assets/ai-martin.js`) — bublina + chat panel, dark-luxe. Vypnutý (`ENABLED=false`), náhled `?aimartin=test` (ukázková odpověď bez backendu).
- ⏳ **Backend** — edge funkce `ai-martin` (RAG nad korpusem + volání LLM). Čeká na: (1) export korpusu, (2) LLM API klíč.

## Jak to zapnout (později)
1. Nasaď edge funkci `ai-martin` (návrh toku níže).
2. V `assets/ai-martin.js` nastav `CFG.ENDPOINT` = URL funkce a `CFG.ENABLED=true`.
3. Widget je už vložený na stránkách (zatím inertní) → naběhne.

## Tok backendu (návrh)
1. **Korpus** (od Martina): export e-mailů klientům (Gmail) + WhatsApp konverzace + texty lekcí Academy/videokurzu. Očistit od osobních údajů klientů (GDPR — nikdy jména/maily do modelu ani do chatu).
2. **Ingest**: rozsekat na chunky → embeddings → uložit do `pgvector` v Supabase (tabulka `ai_chunks(id, source, text, embedding)`).
3. **Edge funkce `ai-martin`** (POST `{messages}`):
   - vezme poslední user dotaz → embedding → vector search top-k chunků,
   - sestaví system prompt: „Jsi Martin Barna, mluvíš jeho stylem (Be Effective!, tykání, přímost, věda lidsky). Odpovídej jen z poskytnutého kontextu; co nevíš, přiznej a odkaž na videokurz/Academy. Nejsi lékař.",
   - zavolá LLM (Claude — nejnovější model) s kontextem + historií, vrátí `{reply}`.
4. **Bezpečnost/náklady**: rate-limit na IP, max délka, denní strop volání (hlídat účet za API). Klíč jen v env edge funkce, nikdy ve veřejném JS.

## Co potřebuju od Martina
- **Export korpusu** (Gmail + WhatsApp + případně texty lekcí) — čím víc autentického Martina, tím lepší.
- **LLM API klíč** (do Supabase secrets).
- Pak dodělám ingest + edge funkci + zapnu widget. Test napřed.
