# HANDOFF PRO FABLE 5 — kompletní revize, upgrade & reklamy (Martin Barna / Barna Academy)

> Zkopíruj celé jako zadání pro Fable 5. Fable má stejný přístup k repu, Supabase MCP,
> GitHub MCP a k reklamním konektorům jako předchozí agent. Cíl: sám projet, vylepšit
> a **nasadit** celý systém + nastavit FB a Google reklamy na míru.

## 0) MISE
Proveď kompletní revizi, vylepšení a upgrade celého ekosystému Martina Barny:
**web martinbarna.cz + Barna Academy + videokurz + coaching + lead-magnet systém + e-maily**,
a k tomu nastav **Facebook/Meta a Google reklamy** přesně na míru všem produktům a trychtýřům.
Vše, co změníš, **rovnou nasaď** podle deploy postupu (§7). Pracuj chirurgicky a aditivně,
nic funkčního nemaž (formuláře, patičky, gating). Před nasazením renderuj lokálně (0 JS chyb).

## 1) BYZNYS V KOSTCE
Martin Barna — český online výživový a fitness kouč (od 2013, 600+ klientů). Produkty (ceny):
- **Lead magnety zdarma** (vrchol trychtýře): generátor jídelníčku, generátor tréninku,
  databáze 120 cviků, 7denní plán „forma zpět". Sbírají e-maily → drip funnel.
- **Videokurz výživy** — 182 videí + přílohy, jednorázově ~**800 Kč** (SimpleShop form `3Vbl`).
- **Barna Academy** — škola pro trenéry, 20 modulů / 224 lekcí + nástroje + certifikace,
  doživotně **8 900 Kč** (SimpleShop form `Xgl8g`). Academy ⇒ videokurz v ceně.
- **Coaching / konzultace** — VIP (SimpleShop form `qG2yO`).
- **Doporučovací (affiliate) program** — kód `DOPORUC10` (−10 % kamarádovi), kredit referrerovi.

## 2) PROSTŘEDÍ / KDE BĚŽÍ CO
- **Repo:** `martinbarna/mb.cz` (GitHub). Statický web. Vývojová větev: **`claude/learn-claude-code-tay5rb`**.
- **Hosting/deploy:** statika → **Wedos přes FTP**, spouští **GitHub Actions** workflow
  `.github/workflows/deploy-wedos.yml` (workflow_dispatch, `ref: main`). Živý web = **martinbarna.cz**.
- **Backend:** **Supabase** projekt „Barna Academy", ref **`uhmrpfsdcujbhbtumqye`**
  (url `https://uhmrpfsdcujbhbtumqye.supabase.co`, veřejný anon klíč
  `sb_publishable_JLQ6JzSORraAnjl-R319KQ_X2BSqiCI` — v `assets/ba-config.js`).
- **E-maily:** **Resend** (FROM `news@martinbarna.cz`), free plán = 100 mailů/den (hlídej!).
  Auth maily (reset/magic-link) jdou přes Resend SMTP (`smtp.resend.com:465`).
- **Platby:** **SimpleShop** (form ID viz §1). SimpleShop NEMÁ API na kupóny (jen ruční).
- **Analytika:** **GA4** `G-C3JC8G3FS0` + **Meta Pixel** `277526073774099` — obé v
  `assets/analytics.js` (Consent Mode v2 + cookie lišta; měření se zapne až po souhlasu).

## 3) MAPA REPA (klíčové cesty)
- `index.html` — homepage. `videokurz.html` — landing videokurzu. `akademie/index.html` — landing Academy.
- `akademie/objednavka/` — objednávka Academy. `dekuji-academy/`, `dekuji-videokurz/` — děkovačky.
- `akademie/moje/` — členský rozcestník (dashboard). `akademie/moje/doporuc/` — affiliate stránka.
- `akademie/studium/` — Academy nástěnka; **224 lekcí** v `akademie/studium/m{modul}-l{lekce}/`.
  Kurikulum je v `akademie/studium/index.html` (konstanta `CURRICULUM`).
- `akademie/videokurz/` — videokurz nástěnka; **182 videí** v `akademie/videokurz/v###/`.
  Generuje se z `akademie/_videokurz/build.js`.
- `akademie/nastroje/` — nástroje pro trenéry (jídelníček, trénink). `akademie/cviky/` — databáze cviků (členská).
- `akademie/admin/` — admin panel (CRM, přístupy, statistiky GA, log e-mailů). `akademie/prihlaseni/`.
- `nastroje-zdarma/` — veřejné lead-magnety: `jidelnicek/`, `trenink/`, `cviky/` (+ hub `index.html`).
- `forma-zpet/`, `makro-plan/` — lead-magnet landingy (7denní plán). `clanky/` — **125 článků** (blog + index.html).
- `materialy/` — rebrandovatelné PDF pro trenéry. `reference/`, `prednasky/`, `koucing/`, `konzultace/`.
- `obchodni-podminky/`, `zasady-ochrany-osobnich-udaju/` — právní.
- **Assety** (`assets/`): `ba-ui.css` + `highend.css` (styly), `marketing-dark.css` (tmavá vrstva
  pro veřejné stránky — **při změně VŽDY bumpni `?v=` napříč stránkami, jinak cache**),
  `analytics.js` (GA+Pixel), `referral.js` (affiliate capture), `lead-form.js`/`lead-popup.js`
  (lead sběr), `meal-gen.js`/`workout-gen.js` (generátory), `academy-upsell.js`, `lesson-audio.js`,
  `ba-config.js` (Supabase config — jen anon klíč!), `exercise-db.json` (120 cviků).
- **Skripty** (`scripts/`): `sync-academy-counts.js` (sjednotí počty lekcí/videí/cviků napříč
  prodejními stránkami — **spusť po každé změně obsahu**), `generate-og.py`, `generate-articles.py`.

## 4) SUPABASE BACKEND
- **Edge funkce** (repo `akademie/_supabase/functions/`, nasazené přes Supabase MCP `deploy_edge_function`):
  - `lead-capture` (verify_jwt true) — příjem leadu z formulářů → uloží + spustí uvítací mail.
  - `drip-send` (verify_jwt false) — e-mailový funnel (cron hodinově), DAILY_CAP 50 pro bulk,
    `only_email` = transakční uvítačka (obchází strop). Šablony v tabulce `email_templates`.
  - `simpleshop-webhook` — platba → udělení přístupu (entitlement) + affiliate atribuce (párování
    přes `referral_click` podle e-mailu, kredit referrerovi, idempotence, anti-self, refund→void).
  - `referral-code` (verify_jwt true) — osobní kód `BARNA-XXXX` + stav kreditu pro přihlášeného.
  - `referral-click` (verify_jwt false) — zápis {ref,email,website(honeypot)} před checkoutem.
  - `admin-api` (verify_jwt false, manuální JWT + `admin_emails` allowlist z `app_config`) —
    akce: `stats`, `overview`, `contact`, `set_access`, `set_tag`, `unsubscribe`, `ga_stats`,
    `email_log`, `email_preview`.
  - `unsubscribe`, `ai-martin`.
- **Klíčové tabulky:** `entitlements` (email, product academy|videokurz, active — přístup),
  `leads` (funnel: track, step, next_send_at, status), `email_templates` (track+step → subject/blocks),
  `email_events` (log odeslaných), `customer_contacts` (marketing kontakty + tags), `referral_codes`,
  `referrals`, `referral_click`, `app_config` (footer, admin_emails, secrets keys), pg_cron joby.
- **RPC** `has_entitlement` (párování přes e-mail z JWT, academy ⇒ i videokurz).

## 5) STANDING RULES (KRITICKÉ — dodržet)
1. **Počty musí vždy sedět.** Po přidání/odebrání lekce Academy / videa videokurzu / cviku spusť
   `node scripts/sync-academy-counts.js` (opraví počty na všech prodejních stránkách). Materiály (PDF) ručně.
2. **Obsah Academy → aktualizuj zmínky VŠUDE** (landing, homepage karta, objednávka, upsell texty,
   `assets/academy-upsell.js`) — aditivně, nikdy nemaž formulář/patičku/strukturu.
3. **Affiliate/doporučení = pro Academy I videokurz klienty** (videokurz klientů je víc).
4. **E-maily: VŽDY nejdřív TEST na `fitness.barna@gmail.com`**, počkej na výslovné „pošli ostro",
   teprve pak na seznam. České znaky v edge funkcích jako reálné UTF-8 (ne `\u`).
5. **Sdílené CSS/JS: při každé změně bumpni `?v=`** (jinak cache servíruje starou verzi — reálný bug).
6. **Landing `/akademie/` edituj chirurgicky/aditivně** — nikdy nemaž nabídku/formulář/patičku.

## 6) BEZPEČNOST / GDPR
- **Nikdy do repa ani do chatu:** `service_role`, `RESEND_API_KEY`, SimpleShop API klíč,
  Supabase PAT, GA service-account JSON. Ty patří jen do **Supabase secrets** / **GitHub secrets**.
  Veřejné JS smí mít **jen anon** Supabase klíč.
- E-maily/jména klientů jen do Supabase, **nikdy seznam adres do chatu** — jen počty.
- Marketingové maily mají v patičce odhlášení (edge funkce `unsubscribe`).

## 7) DEPLOY POSTUP (každá hotová změna)
1. commit na `claude/learn-claude-code-tay5rb` → push (`git push -u origin <branch>`).
2. PR (draft) → ready → **merge (squash)** do `main`.
3. spusť GitHub Actions workflow **`deploy-wedos.yml`** na `ref: main`.
4. re-sync větve: `git fetch origin main && git reset --hard origin/main && git push --force`.
- Před deployem: lokální render (chromium + `python3 -m http.server`), **0 JS chyb**.
- Edge funkce se nasazují přes Supabase MCP (`deploy_edge_function`), ne přes web deploy.

## 8) CO KONKRÉTNĚ ZREVIDOVAT / VYLEPŠIT (návrh rozsahu — dolaď s Martinem)
- **Prodejní stránky** (homepage, `/videokurz`, `/akademie/`, `/akademie/objednavka/`): copy, nabídka,
  sociální důkaz, cenová logika, CTA, mobilní UX, rychlost, konzistence počtů a obsahu (§5.1–2).
- **Lead-magnet trychtýř**: `nastroje-zdarma/*`, `forma-zpet/`, `makro-plan/` — konverzní formuláře,
  navázání na drip funnel (`email_templates`), konzistence „co dostaneš".
- **E-maily** (`email_templates` v Supabase): revize sekvencí lead-magnet / existing-leadmagnet /
  onboarding — copy, načasování, upsell, affiliate. **Změny testuj (§5.4) před ostrým během.**
- **Academy & videokurz členská sekce**: UX, přehlednost, audio lekcí, databáze cviků (popisy jsou hotové).
- **Coaching/konzultace**: nabídka, check-in systém (návrh v úkolech).
- **Rychlost & přístupnost**: kontrast (tmavá vrstva `marketing-dark.css`), Lighthouse, lazy-load.

## 9) REKLAMY — FB/META + GOOGLE (na míru všemu)
Cíl: výkonnostní kampaně napojené na existující měření a trychtýře.
- **Měření už běží:** Meta Pixel `277526073774099` + GA4 `G-C3JC8G3FS0` (Consent Mode v2).
  Nastav/ověř **konverzní eventy** (lead z formulářů, purchase přes SimpleShop děkovačky
  `dekuji-videokurz/` a `dekuji-academy/`), případně doplň event snippet na děkovačky.
- **Trychtýř pro kampaně:**
  - TOFU (studené publikum) → lead-magnety zdarma (`nastroje-zdarma/`, `forma-zpet/`, `makro-plan/`)
    → sběr e-mailů → drip funnel prodá videokurz/Academy.
  - MOFU/retargeting (návštěvníci landingů, leadi) → **videokurz 800 Kč** (nízká bariéra).
  - BOFU (majitelé videokurzu, high-intent) → **Academy 8 900 Kč** + coaching.
- **Publika:** custom audiences z Pixelu (návštěvy landingů, video views), lookalike z kupujících,
  retargeting leadů. Vylučuj stávající kupující (mají entitlement).
- **Kreativa:** čerpej z webu/článků (věda vs mýty), reference, generátory zdarma jako hook.
- **Rozpočet/účty:** dodá Martin (reklamní účty FB/Google, platební metoda). Začni malým denním
  rozpočtem, A/B testuj hooky, škáluj podle CPA/ROAS.

## 10) CO POTŘEBUJEŠ OD MARTINA (dodá on)
- Přístup k reklamním účtům (Meta Business / Google Ads) + rozpočet.
- Pokud budeš sahat na Supabase Auth/secrets nebo SimpleShop API: příslušné credentialy
  (Martin je vloží do secrets, ne do chatu).
- Odsouhlasení copy/nabídky/cen a **„pošli ostro"** u jakéhokoli hromadného mailu (§5.4).
- Fotky pro before/after posuvník; ElevenLabs klíč (pokud audio klon hlasu).

---
**Zlaté pravidlo:** chirurgicky, aditivně, testuj před nasazením, počty a obsah drž konzistentní
napříč webem, e-maily nikdy ostře bez test-firstu, secrets nikdy do repa. Pak nasazuj přes §7.
