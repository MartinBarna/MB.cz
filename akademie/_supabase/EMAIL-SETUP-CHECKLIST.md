# Proč nechodí lead-magnet e-maily — diagnóza + aktivace (pro Cowork)

## Co se děje (test: vyplněn formulář muž+žena, nepřišel mail)

Tok je dvoufázový:
1. **Formulář** (`lead-form.js`) → edge funkce **`lead-capture`** → uloží řádek do `leads`.
   `lead-capture` **NEPOSÍLÁ e-mail** — jen uloží lead. ✅ tahle část funguje
   (po odeslání se ukázalo „✅ Díky, plán ti posíláme na e-mail" + tlačítko PDF).
2. **E-maily** posílá edge funkce **`drip-send`** přes **Resend**, spouštěná
   **hodinovým cronem**. ⛔ tahle část NENÍ aktivní → proto nic nepřišlo.

Příčina je tedy v e-mailové pipeline (Resend + drip-send + cron), ne ve webu.
Web lead uložil a PDF dal ke stažení rovnou na stránce — žádný lead se neztrácí.

## Aktivace (udělej v tomto pořadí)

**1) Nasaď edge funkce**
```
supabase functions deploy lead-capture --no-verify-jwt
supabase functions deploy drip-send    --no-verify-jwt
supabase functions deploy unsubscribe  --no-verify-jwt
```

**2) Nastav secrets** (Resend klíč NIKDY do gitu — repo je veřejné)
```
supabase secrets set RESEND_API_KEY=re_xxxxxxxx
```

**3) Ověř doménu v Resend** (NEJČASTĚJŠÍ příčina „nic nechodí")
- `drip-send` posílá z **`news@martinbarna.cz`** (konstanta FROM).
- V Resend dashboardu → Domains → přidej `martinbarna.cz` a vlož vygenerované
  **SPF + DKIM (+ DMARC)** záznamy do **DNS u Wedosu**. Bez ověřené domény
  Resend odmítne odeslání (nebo spadne do spamu).

**4) Spusť SQL** (Supabase → SQL Editor), v pořadí:
```
schema.sql · drip-engine.sql · drip-templates.sql
drip-longtail.sql · dynamic-discount.sql · checkin-coaching.sql
```
(drip-engine.sql vytvoří hodinový cron `drip-send-hourly` a tabulky.)

**5) Ověř cron**
```sql
select jobname, schedule, active from cron.job;   -- musí být 'drip-send-hourly'
```

## Test (ověř, že to teď chodí)

**A) Je Martinův testovací lead uložený?**
```sql
select email, segment, source, track, step, next_send_at
from public.leads order by created_at desc limit 5;
```
→ měl by tam být fitness.barna@gmail.com (2× — muž z forma-zpet, žena z makro-plan;
   2. vložení je „duplicate" = OK, e-mail je unikátní klíč, takže se uloží jen 1×).
   POZN.: protože je to stejný e-mail, druhý pokus se NEuloží zvlášť — pro reálný
   test dvou segmentů použij dva různé e-maily.

**B) Pošli si test e-mail HNED (obejde cron):**
```
curl -X POST 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/drip-send' \
  -H 'Content-Type: application/json' \
  -H 'apikey: <ANON_KEY>' \
  -d '{"test_email":"fitness.barna@gmail.com","track":"lead-magnet","step":0,"segment":"muzi","name":"Martin"}'
```
→ když dorazí, Resend + funkce jedou. Když ne, přečti chybu z odpovědi
   (`missing_RESEND_API_KEY` = chybí klíč; `resend_403/422` = neověřená doména).

**C) Ostrý běh (rozešle všem due leadům teď):**
```
curl -X POST '.../functions/v1/drip-send' -H 'apikey: <ANON_KEY>' \
  -H 'x-drip-secret: <z app_config drip_invoke_secret>' -d '{}'
```

**D) Zkontroluj spam** složku (první maily z nové domény tam občas padají,
   než se reputace usadí).

## Shrnutí pro Martina
Web a uložení leadů funguje. Maily nepoteknou, dokud Cowork neudělá kroky 1–4,
hlavně **ověření domény `martinbarna.cz` v Resend** (to je 90 % případů „nic nechodí").
Po aktivaci pošle test (B) a uvidí mail do pár vteřin.
