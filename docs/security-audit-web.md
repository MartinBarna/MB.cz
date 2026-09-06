# Statický security audit: martinbarna.cz + Academy

- **Datum:** 2026-08-27
- **Auditor:** statická revize kódu (žádný zásah do runtime, žádný exploit)
- **Základ:** `origin/main` @ `8ae11a56e` („Novy clanek: hubnuti po 40“)
- **Větev reportu:** `cloud-security-audit-web` (nic se nemerguje)
- **Rozsah:** tajemství v stromu i v posledních 50 commitech, edge funkce `akademie/_supabase/functions/*`, klientský JS `assets/*.js`, skryté cesty ve webrootu, security hlavičky pro Wedos
- **Co tohle NENÍ:** živý pentest, ověření nasazených Edge Function blobů proti gitu, ani `SELECT` do produkční DB. Kde závěr závisí na živém stavu, je to výslovně napsané.

**Škála:** Critical / High / Medium / Low / Info.

Každý nález: závažnost, `soubor:řádek`, popis, oprava jednou větou.

---

## TOP 5

### 1. High (Critical, pokud se doplní prázdný stub) — `poukaz-vydat` na větvi hardeningu importuje neexistující `_shared/signature.ts`

- **Kde:** `origin/cloud-poukaz-vydat-hardening` → `akademie/_supabase/functions/poukaz-vydat/index.ts:29` (`import { verifyStripeSignature } from '../_shared/signature.ts'`). Soubor `signature.ts` **neexistuje na žádné větvi** (`git log --all -- '*signature.ts'` je prázdný). Na `main` funkce `poukaz-vydat` vůbec není.
- **Popis:** Hardening správně chce ověřit Stripe HMAC před výdejem poukazu. Bez sdíleného modulu se ta větev **nedá nasadit** (Deno import spadne, fail-closed). Riziko je provozní zkratka: doplnit stub, který vrátí `{ ok: true }` „aby to prošlo“, a veřejný `--no-verify-jwt` endpoint začne brát podvržený `checkout.session.completed`. Prodejní stránka `/poukaz/` na `main` už má živé Stripe Payment Linky (800–8 900 Kč). Komentář v HTML („NENASAZENO“) je zastaralý.
- **Oprava:** Zkopíruj ověřenou HMAC rutinu z `academy-stripe-webhook/index.ts:408-459` do `akademie/_supabase/functions/_shared/signature.ts`, nasaď až po `deno check` a přečti nasazený zdroj (`get_edge_function`), nikoli hlášku „Deployed“.

### 2. High — refundovaný poukaz zůstane platný

- **Kde:** hardening `poukaz-vydat/core.ts:361-362` (vše kromě `checkout.session.completed` → `ignored`); `akademie/_supabase/functions/academy-stripe-webhook/index.ts:1666` (refund sahá na `entitlements`, tabulku `poukazy` nezná); `KATALOG` ve stejném souboru od `:151` poukazové klíče nemá.
- **Popis:** Automatika poukazu (komentáře webu: od 25. 8. 2026) vydá kód se `status: 'vydan'` a dál se o něj nestará. `charge.refunded` / spor v Academy webhooku odebírá přístup k produktům, ne dárkový kód. Kdo zaplatí, dostane PDF, strhne refund a kód uplatní (ručně u Martina nebo později automatem, který věří sloupci `status`), dostane zboží za 800–8 900 Kč zadarmo. Částečný refund v Academy webhooku přístup úmyslně nechává (`:1755-1761`); u poukazu chybí i tenhle stupeň.
- **Oprava:** V `poukaz-vydat` (nebo ve sdíleném Stripe handleru) zpracuj `charge.refunded` / `charge.dispute.created`, kód přepni na `zrusen` a zablokuj uplatnění, dokud Stripe nepotvrdí, že charge není vrácený.

### 3. High — `lead-capture` je veřejný zápis do `leads` a spouští drip, bez limitu, CORS `*`

- **Kde:** `akademie/_supabase/functions/lead-capture/index.ts:4-7` (CORS `*`), `:16-18` (honeypot), `:121-132` (insert přes service_role), `:149-163` (okamžitý POST na `drip-send` s `drip_invoke_secret` z DB); klient `assets/lead-form.js:8-9`.
- **Popis:** Anonym **nespustí** `drip-send` napřímo (viz níž). Spustí ho ale `lead-capture`: kdokoli POSTne `{email}` a honeypot nechá prázdný. Žádný rate-limit, žádná Origin allowlist, CORS povolí volání z libovolné stránky. Dopad: zaplevelení `leads`, pálení Resend kvóty, maily na cizí schránky (reputace + GDPR), zápis telefonu k existujícímu e-mailu (`:139-142`). Honeypot filtruje jen hloupé boty.
- **Oprava:** Stejný balík jako u `contact-send`: Origin allowlist, rate-limit per IP i per e-mail, fail-closed CAPTCHA nebo Turnstile na veřejném formuláři, CORS jen `martinbarna.cz`.

### 4. High — deploy na Wedos jede holým FTP (heslo po síti)

- **Kde:** `.github/workflows/deploy-wedos.yml:49-55` (`protocol: ftp`, `password: ${{ secrets.FTP_PASSWORD }}`).
- **Popis:** Secrets jsou v GitHubu, ne v gitu. Samotný přenos je nešifrovaný FTP. Kdokoli na cestě (sdílené CI egress, MITM) vidí FTP login i obsah webu. Wedos umí FTPS. `dangerous-clean-slate: false` (`:58`) navíc nechá na hostingu smazané soubory z předchozích deployů.
- **Oprava:** Přepni akci na `protocol: ftps` (nebo SFTP, pokud Wedos účet umí), ověř že secrets zůstanou v GitHubu, a jednorázově ukliď webroot od souborů, které už v repu nejsou.

### 5. High (ověřit živě) — `security-fixes-2026-07.sql` se podle vlastního komentáře nespustil; BLOK 3 je navíc zastaralý a nebezpečný

- **Kde:** `akademie/_supabase/security-fixes-2026-07.sql:4-9` („Tento skript NEBYL spuštěn“); BLOK 1 `:17-27` (`REVOKE EXECUTE` na `enroll_into_longtail`); BLOK 4 `:91-111` (storage `client_docs` `shared/%` čitelné anonem); BLOK 3 `:75-87` (`CREATE OR REPLACE has_entitlement` **bez** `expires_at`).
- **Popis:** K 16. 7. 2026 mohl kdokoli s veřejným anon klíčem volat SECURITY DEFINER `enroll_into_longtail` a posunout až 50 leadů do longtailu s `next_send_at=now()` (okamžité maily, rozbití funnelu, kvóta). `shared/` v bucketu `client-docs` bylo čitelné bez přihlášení. **Tohle je zápis k datu, ne živý stav.** Mezitím `academy-cenik-expirace.sql:53-67` nahradil `has_entitlement` verzí s `expires_at`. Kdyby někdo „doplnil“ nespúštěný security-fixes soubor dnes, BLOK 3 by **vymazal kontrolu expirace** a pustil měsíční členy po konci předplatného do lekcí. `CREATE OR REPLACE` granty neruší, proto BLOK 1 (REVOKE) je pořád potřeba ověřit zvlášť.
- **Oprava:** V SQL editoru ověř `has_privilege` / `pg_proc` granty na `enroll_into_longtail`, policy `client_docs_read` a `pg_get_functiondef` u `has_entitlement` (musí obsahovat `expires_at`); REVOKE a storage policy spusť samostatně, BLOK 3 z toho souboru **nespouštěj**.

---

## Kontext, bez kterého čísla lžou

1. **GitHub repo `MartinBarna/MB.cz` je veřejné** (`visibility: PUBLIC`). I to, co FTP na Wedos nepošle, čte kdokoli na GitHubu. Edge funkce, SQL s popisem děr, interní design v `akademie/_ai/*.md` a `_zdroje/` jsou tedy veřejné, i když je `deploy-wedos.yml:59-72` z uploadu vyřazuje (`.github`, `_import`, `_zaloha`, `_zdroje`, `scripts`, `akademie/_ai`, `akademie/_pdf`, `akademie/_supabase`, `akademie/_videokurz`, `**/*.md`).
2. **„Celé repo se nasazuje na Wedos“ neplatí doslova.** FTP exclude existuje. Platí ale silnější věc: co je v gitu, je veřejné na GitHubu. Webroot na Wedosu je podmnožina stromu plus případné zbytky ze starších deployů (`dangerous-clean-slate: false`).
3. **Nasazená edge funkce může být novější nebo starší než git.** Komentář v `app-onboarding-hook/index.ts:16-23` to už jednou dokumentuje: do 21. 8. 2026 žila logika jen jako blob, git měl mrtvou kopii. Kořenový `supabase/` je v `.gitignore:10`. Zdroj pravdy pro revizi kódu je `akademie/_supabase/functions/`; pro provoz `get_edge_function`.
4. **`poukaz-vydat` na `main` není.** Žije na `origin/cloud-poukaz-vydat-hardening` a `origin/hlidka-poukaz-vydat-zdrojak`. Web (`poukaz/index.html:300+`) už prodává. Audit poukazu je proto proti hardening větvi + proti tomu, co na `main` refund dělá (nic).

---

## 1) Tajemství v repu a v posledních 50 commitech

Prohledáno: aktuální strom i `git log -50` (od `ba6472dae` 21. 8. 2026 do `8ae11a56e` 26. 8. 2026) na `sk_live`, `sk_test_`, `whsec_`, `sb_secret_`, `service_role` JWT, `re_` (Resend), `AKIA`, SMTP hesla.

### Co v gitu NENÍ (dobře)

Žádný `sk_live` / `whsec_` / service_role JWT / Resend klíč / SMTP heslo v souborech ani v patchech posledních 50 commitů. `SUPABASE_SERVICE_ROLE_KEY` se v edge funkcích bere výhradně z `Deno.env.get(...)`. Workflows berou `FTP_*`, `ACADEMY_SERVICE_ROLE_KEY`, `AFFILIATE_REPORT_SECRET` z GitHub Secrets (`.github/workflows/deploy-wedos.yml:44-54`, `affiliate-report.yml:35`).

`whsec_` se v kódu objevuje jen jako **komentář / prefix parser** (`academy-stripe-webhook/index.ts:33`, `resend-webhook/index.ts:5,36,43`), ne jako hodnota.

### Nález 1.1 — Info — veřejné anon / publishable klíče (by design, ale rozházené)

- **Kde:** `assets/lead-form.js:8` (legacy JWT anon, ref `uhmrpfsdcujbhbtumqye`); totéž vložené v `index.html`, `koucing/index.html`, `kviz/index.html`, `prednasky/index.html`, `videokurz.html`; `assets/ba-config.js:6` (nový `sb_publishable_…`); `tvuj-coach/index.html:531` (anon JWT **jiného** projektu, ref `kfkmghvhqwqtsalqjmrp`).
- **Popis:** Anon klíč má v JS ležet. Není to service_role. Riziko je provozní: rotace musí opravit **všechny kopie**, jinak stará JWT varianta zůstane platná. Dva tvary klíče téhož projektu (JWT vs `sb_publishable_`) znamenají, že část stránek po rotaci publishable klíče poletí na starém JWT.
- **Oprava:** Sjednoť web na `ba-config.js`, smaž natvrdo vložené JWT z HTML a z `lead-form.js`, rotaci dokumentuj checklistem souborů.

### Nález 1.2 — Info — Stripe Price / Product / Payment Link ID v gitu

- **Kde:** `akademie/_supabase/functions/academy-stripe-webhook/index.ts:151-218` (`prod_…`, `price_…`, `plink_…`); `poukaz/index.html:300,315,334,364` (`buy.stripe.com/…`).
- **Popis:** Nejsou to tajemství (checkout je veřejný). Dávají útočníkovi mapu katalogu a umožní poslat lidi na cizí Payment Link, pokud by webhook špatně filtroval `ALLOWED_PLINKS` (ten filtr v Academy webhooku je, poukazový handler filtruje přes tabulku `poukaz_varianty`).
- **Oprava:** Nic rotovat; drž `ALLOWED_PLINKS` / `poukaz_varianty` jako jediný allowlist a nenech webhook grantovat cizí session.

### Nález 1.3 — Low — osobní jméno obdarované v public gitu

- **Kde:** `_zdroje/dokumenty/poukaz-tereza.html` (titulek „Dárkový poukaz — Tereza“); vedle leží `.pdf` a `.png`. FTP exclude `_zdroje/**`, na GitHubu to je.
- **Popis:** Křestní jméno + fakt, že šel dárkový poukaz. Není to API klíč, je to zbytečné PII ve veřejném repu.
- **Oprava:** Soubory pryč z gitu (ne jen z FTP exclude) a git history purge, nebo aspoň anonymizovat jméno.

---

## 2) Edge funkce Academy

Všech 36 funkcí v `akademie/_supabase/functions/*/index.ts` je navržených na `--no-verify-jwt`. Auth je vlastní (secret, Stripe HMAC, JWT ověřený uvnitř). Service_role je všude jen z env, nikde v klientovi.

### 2.1 Drip a mail: může anonym spustit odeslání?

**Ne, pokud je `app_config.drip_invoke_secret` nastavený.** Fail-closed: prázdný expected → 401.

| Funkce | Auth | Řádek |
|---|---|---|
| `drip-send` | hlavička `x-drip-secret` == `drip_invoke_secret`; **ne** `?secret=` | `drip-send/index.ts:321-324` |
| `daily-digest` | totéž | `daily-digest/index.ts:22` |
| `videokurz-onboarding` | totéž | `videokurz-onboarding/index.ts:172` |
| `study-reminder`, `client-remind`, `order-rescue`, `milestones`, `splatky-guard` | stejný vzor secretu | jednotlivé `index.ts` |
| `lead-capture` | **žádný secret**; po insertu **sám** zavolá drip se secretem ze DB | `lead-capture/index.ts:149-163` |
| `affiliate-mesicni-report` | `x-report-secret`, fail-closed | workflow `affiliate-report.yml:8-11` |
| `ingest-lessons` | `x-ingest-secret` | komentář v `ingest-lessons/index.ts:6` |
| `link-check` | `x-linkcheck-secret` | `link-check/index.ts:29` |

README u drip-send (`drip-send/README.md:51`) pořád píše „nebo `?secret=`“. Kód query **nebere**. Dokumentace lže ve prospěch bezpečnosti (query by končil v access logu). Neopravovat kód směrem k README.

`unsubscribe` odhlašuje podle neuhodnutelného `unsubscribe_token` (UUID), GET **nemá side-effect** (`unsubscribe/index.ts:62-67`), POST maže / odhlašuje. To je správně proti mailovým skenerům. Kdo token z mailu má, smí daný lead smazat (`action=erase`). To je záměr GDPR, ne IDOR napříč účty.

### Nález 2.1 — Low — porovnání secretu není konstantní v čase

- **Kde:** `drip-send/index.ts:324`, `daily-digest/index.ts:22`, `simpleshop-webhook/index.ts:236`, `gads-conversions-feed/index.ts:34`, `app-onboarding-hook/index.ts:87`, `videokurz-onboarding/index.ts:172`. Proti tomu `grant-videokurz-z-appky/index.ts:54` a `app-purchase-bridge/index.ts:44` mají `safeEqual`.
- **Popis:** `provided !== expected` umí téct časem. U dlouhého náhodného secretu z cronu je praktické riziko malé. Stripe webhook tohle už řeší (`podpisSedi`, konstantní čas, okno 300 s).
- **Oprava:** Jedna `safeEqual` v `_shared/` a použít ji u všech header secretů.

### 2.2 Autorizace podle třídy

**Admin (JWT + allowlist `app_config.admin_emails`):** `admin-api/index.ts:326-332`, stejně `admin-crm`, `admin-pulse`. Fallback allowlistu je `fitness.barna@gmail.com`. CORS u admin-api je `*` (`:8-9`): u Bearer tokenu (ne cookie) to samo o sobě CSRF z cizího originu neotevře, útočník bez JWT nic neudělá.

**Člen (JWT ověřený `auth.getUser` / RPC `has_entitlement`):** `client-report/index.ts:272-280` (e-mail z JWT, ne z body), `checkin-capture/index.ts:129-134` (komentář výslovně: `body.email` se nevěří), `lesson-peek/index.ts:42-71` (JWT + HMAC `lesson_id|email|exp` + coaching entitlement), `referral-code/index.ts:29-40` (ověření přes `/auth/v1/user`, ne dekódování payloadu).

**Webhooky s podpisem:** `academy-stripe-webhook/index.ts:402-459` (HMAC, constant-time, replay 5 min, ostrý i test secret); `resend-webhook` (Svix HMAC).

**Webhooky se shared secret:** `simpleshop-webhook/index.ts:233-237` (`?secret=` **nebo** `x-webhook-secret`); `referral-webhook` fail-closed na `x-ref-secret`; `app-onboarding-hook/index.ts:85-87` (`x-app-secret`); `app-purchase-bridge` (`safeEqual`); `grant-videokurz-z-appky` (`x-academy-secret` + `safeEqual`).

**Veřejné zápisy:** `lead-capture`, `contact-send`, `withdrawal`, `intake-capture`, `referral-click`, `page-view`.

### Nález 2.2 — Medium — secret v query stringu

- **Kde:** `simpleshop-webhook/index.ts:233-237`; `gads-conversions-feed/index.ts:12,34` (`GET ?token=`).
- **Popis:** Query končí v CDN/proxy/access logu, v historii prohlížeče a v `Referer`, pokud by na feed někdo odkázal. `drip-send` se z toho poučil a bere jen hlavičku. Google Ads offline import umí header, SimpleShop podle komentáře query pořád posílá.
- **Oprava:** GAds token přestat brát z query (nebo aspoň logovat jen hash); SimpleShop nechat query jen dokud to jejich UI umí, paralelní hlavička už je, až půjde query vypnout.

### Nález 2.3 — Medium — Origin allowlist není autentizace

- **Kde:** `contact-send/index.ts:12,67-70`; `withdrawal/index.ts:70`; `intake-capture/index.ts` (stejný vzor); `referral-click/index.ts:11,25-30`; `page-view/index.ts:25-30`.
- **Popis:** Prohlížeč Origin nepodvrhne. `curl -H 'Origin: https://martinbarna.cz'` ano. U `contact-send` to pořád drží honeypot + časovou past + validaci polí a off-site bez Origin se neloguje. U `lead-capture` Origin není vůbec. `page-view` bere i Referer (`:28-30`), ten se taky podvrhne.
- **Oprava:** Ber Origin jako CSRF pojistku prohlížeče, ne jako auth; u zápisů doplň rate-limit (už je ve `withdrawal` / `intake-capture` / `referral-click`).

### Nález 2.4 — IDOR třída

Zákaznické funkce, které něco čtou nebo mění podle identity, berou e-mail z ověřeného JWT. Cizí e-mail v body u `client-report` / `checkin-capture` / `lesson-peek` / `referral-code` nestačí.

Výjimky (záměr, ne klasický IDOR, ale abuse):

- `lead-capture` přijme libovolný e-mail (veřejný lead form).
- `admin-api` přijme e-mail v body **po** allowlistu admina (to je účel CRM).
- S2S (`app-onboarding-hook`, `grant-videokurz-z-appky`) přijme e-mail po shared secretu: kompromitovaný secret = zápis cizího leadu / grant. Secret je v `app_config` / env, ne v gitu.
- `ai-martin/index.ts:405-411` dekóduje `sub` a `email` z JWT payloadu **bez podpisu**. Členská brána předtím volá `has_entitlement` s Bearer tokenem (`:156-171`), podvržený token tam spadne. Peek odkazy se tedy podepisují e-mailem z payloadu tokenu, který už RPC pustila. Komentář u `:408-409` tohle říká. Zbytkové riziko: kdyby se brána někdy „zjednodušila“ na dekódování, vznikne IDOR peek odkazů.
- **Oprava u AI Martina:** e-mail i `sub` brát z `auth.getUser` / `/auth/v1/user` jako u `referral-code`, nenechávat druhou, neověřenou cestu.

### Nález 2.5 — High — `enroll_into_longtail` EXECUTE pro anon (pokud REVOKE neběžel)

Viz TOP 5 bod 5. Funkce je SECURITY DEFINER. Sourozenci upsell/nurture REVOKE už měly, tahle podle security-fixes ne.

### Nález 2.6 — High — `client_docs` `shared/` čitelné anonem (pokud policy neběžela)

Viz TOP 5 bod 5. BLOK 4 má správný tvar: `TO authenticated` + `has_entitlement('coaching')` na `shared/%`.

### Nález 2.7 — Medium — `poznatky-api` volá admin HTML, v repu funkce není

- **Kde:** `akademie/admin/poznatky/index.html:124`. V `akademie/_supabase/functions/` složka `poznatky-api` chybí.
- **Popis:** Buď žije jen jako nasazený blob (stejná past jako `app-onboarding-hook` do 21. 8.), nebo stránka bije do 404. V prvním případě nejde z gitu zkontrolovat auth. Stránka se na Wedos **nasazuje** (není v FTP exclude).
- **Oprava:** Stáhni nasazený zdroj, commitni ho vedle ostatních funkcí, ověř stejný gate (JWT + `admin_emails`).

### Nález 2.8 — Info — `sef-probe-ua` vrací 410

- **Kde:** `akademie/_supabase/functions/sef-probe-ua/index.ts:22-31`.
- **Popis:** Mrtvá sonda, žádná auth, žádný zápis. Nechat kvůli kontrole nasazení je v pořádku.
- **Oprava:** Žádná, dokud kontrola nasazení vyžaduje přítomnost jména.

### Nález 2.9 — poukaz-vydat (hardening, mimo `main`)

Kromě TOP 5:

- Auth: Stripe podpis, `--no-verify-jwt`, strop těla 256 KB (`index.ts:46-58`). To je správný směr.
- `POUKAZ_OSTRY` musí být přesně `'1'`, jinak mail padá na `fitness.barna@gmail.com` (komentář v `index.ts:13-16`). Dobrá pojistka, pokud env na produkci opravdu je `'1'` až po testu.
- Idempotence přes `stripe_event_id`. Dobře.
- Refund: viz TOP 5 bod 2. Žádná větev `charge.refunded`.
- Uplatnění kódu v tomhle repu **není**. Platnost po refundu je dnes na ručním procesu (Martin honí kód vs. Stripe). Až vznikne automatické uplatnění, díra se z ruční stane systémovou.

### Nález 2.10 — Low — `withdrawal` IP rate-limit závisí na nespúštěném SQL

- **Kde:** `withdrawal/index.ts:9-10,98-103`; `security-fixes-2026-07.sql:271-281` (`ALTER TABLE withdrawals ADD COLUMN ip`).
- **Popis:** Když sloupec není, check se tiše přeskočí. Zůstane strop 3 podání na e-mail / 24 h. Zákonné odstoupení musí zůstat snadné, flood je omezený aspoň e-mailem.
- **Oprava:** Spusť jen BLOK 7 (sloupec `ip`), ne celý security-fixes soubor.

---

## 3) Klientský JS (`assets/*.js`) a formuláře

Žádný `assets/*.js` neobsahuje service_role, Resend, Stripe secret ani SMTP. Veřejné endpointy se zápisem jdou přes edge funkce, ne přímo na PostgREST insert (kromě toho, co pustí RLS).

| Skript | Kam posílá | Auth | Poznámka |
|---|---|---|---|
| `lead-form.js` | `…/functions/v1/lead-capture` | anon JWT v hlavičce | honeypot `website`; viz TOP 5 bod 3 |
| `lead-popup.js` | **nikam** | — | modal, odkazy na `/makro-plan/` a `/forma-zpet/` |
| `referral.js` | `…/referral-click` | Origin + honeypot | server rate-limit 20 zápisů / IP / 10 min (`referral-click/index.ts:60-68`) |
| `analytics.js` | GA4, Meta Pixel, `…/page-view` | Origin/Referer | cookieless ping cesty, bez e-mailu |
| `ba-config.js` | — | publishable klíč | jediný kanonický webový klíč |
| `ba-academy.js` | Supabase JS (RLS) + `lesson-peek` | user JWT | čtení `lesson_content` / `progress` |
| `ai-martin.js` | `…/ai-martin` | Bearer JWT | chat-only, žádný tool-calling |
| `food-search.js` | REST přes RLS | anon/user | komentář: anon bez entitlementu dostane prázdno |

Další POST z HTML (ne `assets/`): `contact-send` (homepage, koučink, přednášky), `withdrawal` (`/odstoupeni/`), `intake-capture` (`/konzultace/dotaznik/`), `client-report`, `checkin-capture`, `unsubscribe`, `admin-api` / `admin-crm`.

### Nález 3.1 — Medium — `requireAccess` v demo režimu je no-op

- **Kde:** `assets/ba-academy.js:313-315` (komentář: „V demo režimu nedělá nic (vše dostupné).“); demo se zapne, když chybí `BA_CONFIG.url` / `anonKey` (`:19,57-58`).
- **Popis:** Na produkci `ba-config.js` existuje, LIVE jede. Placený HTML je v DB za RLS, statický shell lekce bez session obsah nevydá. Demo je past jen když se `ba-config.js` nenačte (404, adblock, špatná cesta) a někdo by omylem nechal obsah v HTML. Free lekce jsou ochutnávka záměrně.
- **Oprava:** Demo no-op nechat pro localhost; na `martinbarna.cz` při `!LIVE` radši redirect na přihlášení než „vše dostupné“.

### Nález 3.2 — Info — `lead-popup.js` nespamuje API

- **Kde:** `assets/lead-popup.js:1-10,74-76`.
- **Popis:** Jen UI. Zneužití je klikací, ne POST. Spam/abuse je na cílových stránkách s `lead-form.js`.
- **Oprava:** Žádná.

### Nález 3.3 — Low — `contact-send` / `withdrawal` / `intake-capture` mají slušnou anti-spam vrstvu

Honeypot + časová past (u withdrawal zatím tolerantní, pole `t` formulář nemusí posílat: `withdrawal/index.ts:77-79`) + Origin + (u withdrawal/intake) rate-limit. To je správný vzor. `lead-capture` ho nemá.

---

## 4) Admin, test, backup, webroot

FTP na Wedos **posílá** mimo jiné: `/akademie/admin/`, `/akademie/admin/crm/`, `/akademie/admin/poznatky/`, `/akademie/test/`, celé `akademie/studium/`, `assets/`, kořenové HTML. **Neposílá** `_supabase`, `_zdroje`, `_zaloha`, `scripts`, `*.md`.

`robots.txt:6` je `Allow: /`. Admin stránky mají `noindex` v meta (`akademie/admin/index.html:7`, `akademie/test/index.html:7`). To skryje Google, ne člověka s URL.

`.htaccess:4` má `Options -Indexes`. Žádný `.env`, žádný `.zip` v gitu. `.sql` jen pod `akademie/_supabase/` (GitHub public, FTP exclude).

### Nález 4.1 — Medium — admin UI je veřejné HTML, brána je jen JS + 403 API

- **Kde:** `akademie/admin/index.html` (nasazené); gate `#gate` v HTML, API `admin-api` `:326-332`. Žádný HTTP auth v `.htaccess`.
- **Popis:** URL `/akademie/admin/` si otevře kdokoli. Uvidí login/gate, ne data. Zdroj stránky ukáže strukturu CRM, názvy akcí a endpoint. Stejné pro `/akademie/admin/crm/` a `/poznatky/`. Bez JWT a mimo `admin_emails` API vrací 403. To je OK proti čtení dat, špatné proti enumeraci a XSS-na-admin-stránce (XSS by jela v originu `martinbarna.cz` a mohla číst token z `localStorage`).
- **Oprava:** HTTP Basic nebo IP allowlist na `/akademie/admin/` v `.htaccess` (Wedos to umí), plus CSP (sekce 5) kvůli XSS.

### Nález 4.2 — Low — `/akademie/test/` je závěrečná zkouška, ne dump

- **Kde:** `akademie/test/index.html`. Otázky tahá z `lesson_content` (členská DB), nejsou v HTML.
- **Popis:** `noindex`, ale indexovatelná URL. Bez přihlášení by RLS neměla vydat otázky. Název `test` svádí k dojmu, že je to debug stránka.
- **Oprava:** Přejmenovat cestu na něco jako `/akademie/zaverecna-zkouska/` a v `.htaccess` nenechávat nic, co vypadá jako staging.

### Nález 4.3 — Medium — veřejný git = veřejné SQL s návodem na díru

- **Kde:** `akademie/_supabase/security-fixes-2026-07.sql` (celý soubor, zvlášť BLOK 1 a 4); `akademie/_ai/checkin-system-design.md`, `affiliate-system-design.md` (v gitu, FTP exclude).
- **Popis:** Útočník nemusí hádat RPC jména. Soubor říká „volej `/rest/v1/rpc/enroll_into_longtail` anon klíčem“. I po REVOKE je to mapa systému.
- **Oprava:** Po ověření živého stavu zvaž private fork pro `_supabase` / `_zdroje`, nebo aspoň nespojovat v jednom souboru „díra + přesné RPC“. Repo private by stáhlo nejvíc rizika najednou.

### Nález 4.4 — Low — `dangerous-clean-slate: false` nechá na Wedosu mrtvé soubory

- **Kde:** `.github/workflows/deploy-wedos.yml:58`.
- **Popis:** Smazaný HTML v gitu může na hostingu zůstat věčně (stará admin cesta, starý test, zapomenutý `.sql` z doby, kdy exclude ještě nebyl). Audit webrootu na FTP tenhle statický grep nevidí.
- **Oprava:** Jednou za čas sladit listing `/www/` s `git ls-files` minus exclude a mrtvé cesty smazat ručně.

### Nález 4.5 — Info — žádný `.env` / `.zip` / backup v gitu

Hledání `*.env`, `*.zip`, `*backup*` v `git ls-files` je prázdné. `_zaloha/` je v exclude, v aktuálním stromu prázdná. To je v pořádku.

---

## 5) Security hlavičky (Wedos / Apache)

Už nastaveno v `.htaccess:152-168`:

| Hlavička | Hodnota | Stav |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | OK |
| `X-Frame-Options` | `SAMEORIGIN` | OK (clickjacking) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | OK |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` | OK |
| `Strict-Transport-Security` | `max-age=31536000` jen když HTTPS | OK, bez `includeSubDomains` / `preload` |
| `X-Robots-Tag` na `*.pdf` | `noindex, nofollow` | OK |
| **CSP** | — | **chybí i report-only** |

HTTPS enforce + www→apex je v `.htaccess:7-16`.

### Nález 5.1 — Medium — chybí Content-Security-Policy

- **Kde:** `.htaccess:152-168` (blok hlaviček končí Permissions-Policy a HSTS).
- **Popis:** Web má desítky inline `<script>`, GA4, Meta Pixel, Stripe, YouTube, supabase-js z jsDelivr, vlastní `assets/*.js`. Enforce CSP by teď rozbil stránky. Report-only na Wedosu přes `mod_headers` je reálné a dá měsíc dat, než se šlápne na enforce.
- **Oprava:** Přidej do `.htaccess` (uvnitř `mod_headers`) nejdřív report-only, enforce až když reporty přestanou křičet false positive.

Návrh pro Wedos (report-only, bez report kolektoru na začátku; až bude endpoint, doplň `report-uri`):

```
Header always set Content-Security-Policy-Report-Only "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self' https://buy.stripe.com https://www.facebook.com; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://js.stripe.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://uhmrpfsdcujbhbtumqye.supabase.co https://kfkmghvhqwqtsalqjmrp.supabase.co https://www.google-analytics.com https://www.googletagmanager.com https://region1.google-analytics.com https://graph.facebook.com https://www.facebook.com; frame-src https://js.stripe.com https://hooks.stripe.com https://www.youtube.com https://www.youtube-nocookie.com https://www.google.com;"
```

`'unsafe-inline'` u script je teď nutné (inline ostrovy). Dlouhodobě: nonce z SSI/Apache umí Wedos málokdy, spíš postupně stěhovat inline do `assets/*.js`. `'unsafe-eval'` do návrhu nedávám, supabase UMD ho typicky nechce.

### Nález 5.2 — Low — HSTS bez `includeSubDomains`

- **Kde:** `.htaccess:163`.
- **Popis:** `max-age=31536000` na apexu je v pořádku. `includeSubDomains` zapínej jen když **všechny** subdomény jedou HTTPS (mail, www už 301). `preload` až po jistotě, jinak se špatný subdoménový HTTP zasekne v prohlížečích na měsíce.
- **Oprava:** Nech jak je, nebo po inventuře subdomén přidej `includeSubDomains`.

### Nález 5.3 — Info — volitelné hlavičky, které Wedos zvládne

Do stejného `mod_headers` bloku, až bude čas:

- `Cross-Origin-Opener-Policy "same-origin-allow-popups"` (Stripe checkout popup nesmí spadnout).
- `Cross-Origin-Resource-Policy "same-origin"` jen pokud nic nenačítá assety z jiné vlastní domény.
- `X-Permitted-Cross-Domain-Policies "none"`.

`X-Content-Type-Options` a `Referrer-Policy` už jsou. Nic dalšího na ně vymýšlet nemusíš.

---

## Co je v pořádku (ať se to při opravách nerozbije)

- Service_role / Resend / Stripe webhook secret **nejsou v gitu** (strom ani posledních 50 commitů).
- `drip-send` a sourozenci **fail-closed** bez secretu; anonym cron nespustí. `lead-capture` je jediná veřejná cesta k jednomu mailu pro zadaný e-mail.
- Zákaznické zápisy berou identitu z JWT (`client-report`, `checkin-capture`, `lesson-peek`, `referral-code`).
- Stripe Academy webhook ověřuje HMAC konstantním časem a má replay okno.
- `unsubscribe` GET nikoho neodhlásí (ochrana před skenery).
- Peek odkaz je vázaný na lekci + e-mail + expiraci; přeposlaný cizímu JWT neprojde.
- Klientský JS nemá zapisovací klíč. RLS má držet `lesson_content`.
- `.htaccess` už má nosniff, frame, referrer, permissions-policy, HSTS, zákaz directory listing.
- FTP exclude drží SQL a edge funkce mimo webroot (ne mimo GitHub).

---

## Doporučené pořadí oprav (bez změny kódu v tomto auditu)

1. Živě ověřit granty `enroll_into_longtail` a policy `client_docs_read`. Když díra žije, REVOKE / DROP POLICY hned, **ne** celý `security-fixes-2026-07.sql`.
2. Doplnit `_shared/signature.ts` na větvi poukazu, teprve pak mergovat hardening. Zároveň větev `charge.refunded` → `status='zrusen'`.
3. Rate-limit + Origin na `lead-capture` (stejný vzor jako `contact-send` / `referral-click`).
4. FTP → FTPS.
5. CSP report-only v `.htaccess`.
6. HTTP auth na `/akademie/admin/`.
7. Sjednotit anon klíče do `ba-config.js`.
8. `poznatky-api` stáhnout z nasazení do gitu.

Živý stav DB a nasazených funkcí tenhle dokument neprohlašuje za ověřený. Kdo z TOP 5 bude dělat bod 5, ať začne `SELECT`, ne komentářem v SQL.
