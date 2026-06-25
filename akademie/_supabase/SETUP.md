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
Po zaplacení musí server nastavit přístup k zakoupenému produktu. Možnosti:
- **Supabase Edge Function** (doporučeno) nebo Cloudflare Worker.
- Webhook ze SimpleShopu volá funkci s tajným podpisem; funkce se **service_role**
  klíčem najde/uloží uživatele dle e-mailu a vloží řádek do `entitlements`
  (`product = 'academy'` nebo `'videokurz'`).
- Tělo (pseudokód):
  ```
  user = auth.admin.getUserByEmail(email) || auth.admin.createUser(email)
  insert into entitlements (user_id, product, source) values (user.id, product, 'simpleshop')
  ```
- Mapování: produkt SimpleShopu → `'academy'` / `'videokurz'`.
> Tuto funkci nasazuješ ty (vyžaduje tvůj Supabase účet a service_role klíč).
> Návrh kódu funkce doplníme, až bude projekt založený.

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
