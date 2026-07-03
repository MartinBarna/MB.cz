# drip-send — e-mailový DRIP / nurture engine

Supabase Edge Function (Deno), která rozesílá e-mailovou nurture sekvenci leadům
přes **Resend HTTP API**. Engine počítá a rozhoduje; copy mailů žije v DB.

## Architektura
- **`leads`** — kdo, na jakém `track`, jaký `step`, kdy další (`next_send_at`), `status`.
- **`email_templates(track, step, key, subject, preheader, blocks, wait_days)`** —
  copy mailů v DB → texty se mění **bez redeploye** funkce.
- **`email_events`** — log (`sent` / `error` / `test` / `skip_purchased`), `provider_id` z Resendu.
- **`app_config`** — `drip_invoke_secret` (auth funkce) + `footer_html` / `footer_text`.
- **`unsubscribe`** funkce — one-click odhlášení (token `leads.unsubscribe_token`).

## Jak to běží
1. **pg_cron** (`drip-send-hourly`, `0 * * * *`) hodinově volá `drip-send` přes `pg_net`.
2. Funkce vybere „due" leady (`status='active'`, `next_send_at <= now()`),
   pro každého načte šablonu `(track, step)`, vyplní tokeny, pošle, zaloguje,
   posune `step+1` a nastaví `next_send_at = now() + wait_days`.
3. Konec sekvence = `wait_days IS NULL` → `next_send_at = NULL` (žádné další maily).

## Tokeny v copy
- **Gender:** `[[ženská varianta||mužská varianta]]` a `[a]` (přidá „a" pro ženy).
- **Merge:** `{{first_name}}`, `{{fn_space}}`, `{{fn_suffix}}`, `{{fn_prefix}}`,
  `{{lead_magnet_url}}`, `{{plan_page_url}}`, `{{course_url}}`, `{{free_lessons_url}}`,
  `{{course_price}}`, `{{discount_pct}}`, `{{discount_price}}`, `{{discount_code}}`,
  `{{unsubscribe_url}}`.
- Pojistka: mail s nevyplněným tokenem se **neodešle** (funkce hodí chybu).

## Sekvence (track / step → key, rozestup PO kroku)
**existing-leadmagnet** (leady, co už PDF mají — NEposílá se jim magnet znovu):
`0 videokurz-ochutnavka (+3d) → 1 kurz-nabidka (+3d) → 2 sleva ZACNI15 15% (+5d) → 3 sleva2 JESTE20 20% (+5d) → 4 affiliate (konec)`

**lead-magnet** (nový lead z webu, default):
`0 doruceni PDF (+2d) → 1 chyba (+2d) → 2 flexibilne+ochutnávka (+2d) → 3 kurz-nabidka (+3d) → 4 sleva ZACNI15 (+5d) → 5 sleva2 JESTE20 (+5d) → 6 affiliate (konec)`

## Větvení (engine, ne LLM)
- **Koupil videokurz** (`entitlements` product=videokurz active) → funnel STOP
  (`status='purchased'`, `next_send_at=NULL`). JESTE20 tak dostane jen kdo nekoupil.
- **Odhlášení / bounce** → `status` mimo `active` → vypadne z výběru.

## Idempotence
Unikátní index `email_events(lead_id, step) WHERE type='sent'` + pre-check ve funkci
→ stejný krok nikdy neodejde 2×, i kdyby cron běhy přesahovaly.

## Režimy (POST JSON)
- `{ "dry": true }` — jen spočítá (nic nepošle/nezapíše).
- `{ "test_email":"x@y.cz", "track":"existing-leadmagnet", "step":0, "segment":"zeny", "name":"..." }` — pošle 1 testovací mail.
- `{}` — ostrý běh nad due leady.

## Bezpečnost
- **Auth:** hlavička `x-drip-secret` (nebo `?secret=`) == `app_config.drip_invoke_secret`.
- Klíče **jen z env** (Functions → Secrets): `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_URL`. V kódu/repu nikdy nejsou.
- Funkce nasazené `--no-verify-jwt` (veřejné endpointy jištěné secretem / tokenem).

## Setup / re-deploy
- Schema + cron: `akademie/_supabase/drip-engine.sql`
- Copy mailů: `akademie/_supabase/drip-templates.sql`
- Deploy funkcí: `supabase functions deploy drip-send unsubscribe lead-capture --no-verify-jwt`
- Secret: `supabase secrets set RESEND_API_KEY=...`
