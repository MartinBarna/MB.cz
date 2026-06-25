# Barna Academy + Videokurz — členská sekce (Supabase) — návod k nasazení

Tento návod je pro Martina. Frontend i schéma jsou připravené; stačí založit
Supabase projekt, spustit SQL a vložit klíče. Dokud klíče nevložíš, web jede
v „demo" režimu (postup v localStorage, vše odemčeno) a nic se nerozbije.

## 0) Co už je hotové v repu
- `akademie/_supabase/schema.sql` — tabulky, RLS, funkce (academy + videokurz).
- `assets/ba-academy.js` — klient: přihlášení, per-produkt přístup, postup.
- `akademie/_supabase/config.example.js` — vzor konfigurace.
- Frontend (přihlášení, gating lekcí, nástěnka) se napojuje na `window.BA`.

## 1) Založ Supabase projekt
1. supabase.com → New project (region EU, ideálně Frankfurt).
2. Zvol silné DB heslo (ulož si ho).
3. Pro start stačí **Free**; před placeným spuštěním přepni na **Pro** (~25 USD/měs)
   kvůli no-pause + denním zálohám.

## 2) Spusť schéma
Dashboard → SQL Editor → New query → vlož obsah `schema.sql` → **Run**.
Vytvoří: `profiles`, `entitlements` (academy/videokurz), `progress`,
`certificates` + RLS politiky a funkce `has_entitlement`, `verify_certificate`.

## 3) Zapni Auth
Authentication → Providers → **Email** zapnuto. (Volitelně Google OAuth.)
Authentication → URL Configuration → Site URL = `https://martinbarna.cz`,
přidej redirect URL `https://martinbarna.cz/akademie/prihlaseni/`.

## 4) Vlož klíče do webu
Project Settings → API → zkopíruj **Project URL** a **anon public** klíč.
Zkopíruj `config.example.js` → `assets/ba-config.js` a doplň je:
```js
window.BA_CONFIG = { url: "https://xxxx.supabase.co", anonKey: "eyJ..." };
```
A na stránky členské sekce přidej před `ba-academy.js`:
```html
<script src="/assets/ba-config.js"></script>
<script src="/assets/ba-academy.js" defer></script>
```
> ⚠️ Do frontendu patří JEN **anon** klíč. **service_role** / secret klíč NIKDY
> nedávej na web — používá se jen server-side (krok 5).

## 5) SimpleShop webhook → přístup (server-side)
Hotová Edge Function je v repu: `akademie/_supabase/functions/simpleshop-webhook/index.ts`.
Po zaplacení zapíše přístup do `entitlements` podle **e-mailu** (přístup funguje hned,
jak se zákazník přihlásí stejným e-mailem — i když si účet založí až po platbě).

Nasazení (Supabase CLI):
```bash
# jednorázově
npm i -g supabase
supabase login
supabase link --project-ref <PROJECT_REF>

# tajemství (Functions → Secrets)
supabase secrets set SIMPLESHOP_WEBHOOK_SECRET="<silný-náhodný-řetězec>"
# volitelně mapování produktů SimpleShopu → 'academy'/'videokurz':
supabase secrets set PRODUCT_MAP='{"barna-academy":"academy","videokurz":"videokurz"}'
# (SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY jsou ve funkcích dostupné automaticky)

# nasazení funkce
supabase functions deploy simpleshop-webhook --no-verify-jwt
```
Funkce poběží na URL:
`https://<PROJECT_REF>.functions.supabase.co/simpleshop-webhook?secret=<TAJEMSTVÍ>`

V **SimpleShopu** nastav notifikaci/webhook po zaplacení na tuto URL (s `?secret=`).
Pak v `index.ts` zkontroluj/uprav názvy polí (`email`, `product`, `status`) podle
skutečného payloadu SimpleShopu — funkce už defenzivně zkouší běžné názvy.

> Funkci nasazuješ ty (vyžaduje tvůj Supabase účet). service_role klíč zůstává
> jen na serveru, NIKDY ve frontendu.

## 6) Videokurz v členské sekci
- Videa zůstávají na **YouTube (unlisted)** a vkládají se (embed) do naší stránky
  přehrávače — Supabase řeší jen, kdo má přístup (`entitlement 'videokurz'`).
- K videím půjdou i textové materiály (stejná šablona jako u lekcí Academy).
- Postup videí se ukládá stejně jako u lekcí (`product='videokurz'`, např. `vk-01`).

## 7) Spuštění
- Před spuštěním smaž demo certifikát `BA-2026-0001` z `akademie/certifikaty.json`
  (ostré certifikáty se vydávají do DB tabulky `certificates`).
- Přepni Supabase na **Pro**.
- Otestuj: registrace → (webhook udělí přístup) → lekce/videa se odemknou →
  postup se ukládá → certifikát po zkoušce → ověření na `/akademie/overit`.

---
Pozn.: `assets/ba-config.js` je jediné místo s klíči — drž ho mimo veřejné sdílení
jen u service_role; anon klíč je z principu veřejný (chrání ho RLS).
