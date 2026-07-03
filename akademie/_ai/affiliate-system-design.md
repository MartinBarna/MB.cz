# Affiliate / Referral systém — Barna Academy & Videokurz výživy

> Návrh oboustranného doporučovacího programu (give-get). Cíl: max efekt na prodeje při
> minimu admin/účetní zátěže pro malého CZ OSVČ. Stack: statický web (Wedos) + Supabase
> (Postgres + Deno edge funkce, ref `uhmrpfsdcujbhbtumqye`) + platby SimpleShop + e-maily Resend.

---

## 1) Executive summary (s čísly)

**Mechanika:** každý zákazník (s entitlementem) má svůj unikátní kód (např. `BARNA-A7K2`).
Kamarád ho zadá při objednávce v SimpleShopu jako **slevový kupón** → dostane slevu. Po
zaplacení SimpleShop webhook přečte použitý kód → připíše **store kredit** referrerovi.

**Doporučená čísla (give-get):**

| Produkt | Cena | Sleva pro kamaráda | Odměna pro referrera | Pozn. |
|---|---|---|---|---|
| **Videokurz výživy** | 800 Kč | **–150 Kč** (kupón, ~19 %) | **150 Kč kredit** | Jednorázový, symetrie „give = get" je čitelná. |
| **Academy** (předplatné/kurz) | dle ceníku | **–20 %** (první platba) | **300 Kč kredit** (nebo 1 měsíc zdarma) | Vyšší LTV → vyšší odměna, ale strop fixní Kč. |

- **Store kredit, NE hotovost** — primární doporučení (důvody: daně, admin, retence — viz §2, §5).
- **Atribuce:** primárně přes SimpleShop kupón v webhook payloadu; **fallback** = self-report
  pole „kdo tě poslal" v děkovacím kroku + ruční schválení (viz §3).
- **Odměna se připíše až po nevratném období** (status `pending` → po 14 dnech `confirmed`),
  1× na kupujícího, self-referral blokován (viz §4).
- **MVP = minimální smyčka:** ručně vytvořené kupóny v SimpleShopu (1 kupón = 1 referrer),
  webhook připisuje kredit, stránka `/akademie/moje/doporuc/` ukáže kód + stav. Plná
  automatizace (auto-generace kupónů přes SimpleShop API) až později (viz §9).

---

## 2) Mechanika & ekonomika

### 2.1 Výše slevy a odměny — zdůvodnění

**Videokurz (800 Kč, jednorázový):**
- Sleva kamarádovi **150 Kč (fixní)**, ne %. Fixní Kč je u levného jednorázového produktu
  psychologicky silnější („sleva 150 Kč" > „sleva 19 %") a líp se nastaví jako pevný kupón.
- Odměna referrerovi **150 Kč kredit**. **Symetrie give = get** je férová a snadno
  komunikovatelná: „Dej kamarádovi 150 Kč slevu, dostaneš 150 Kč na svůj další nákup."
- Marže: produkt je digitální (nulové variabilní náklady). Náklad akce = 150 sleva + 150 kredit
  = 300 Kč na konverzi, ale **kredit se realizuje až při dalším nákupu** (část propadne / posune
  retenci). Reálný cashový dopad nižší než 300 Kč.

**Academy (předplatné/kurz, vyšší cena a LTV):**
- Sleva kamarádovi **–20 % z první platby** (% dává smysl, protože cena vyšší a může se měnit).
  Strop: jen první platba, ne celé předplatné.
- Odměna referrerovi **300 Kč kredit** *nebo* **1 měsíc Academy zdarma** (prodloužení
  entitlementu). „Měsíc zdarma" je pro předplatné nejlevnější a nejvíc proretenční — referrer
  zůstává v produktu déle. Doporučuji nabídnout **kredit jako default a „měsíc zdarma" jako
  bonusovou volbu**, pokud má referrer aktivní Academy.

### 2.2 % vs fixní Kč — pravidlo
- **Levný jednorázový produkt (videokurz) → fixní Kč.** Čitelnější, jednodušší kupón.
- **Dražší / variabilní produkt (Academy) → %.** Škáluje s cenou, nemusíš měnit při změně ceníku.

### 2.3 Store kredit vs hotovostní výplata — DOPORUČENÍ: **store kredit**

| Kritérium | Store kredit | Hotovostní výplata |
|---|---|---|
| **Daně OSVČ** | Sleva na vlastní budoucí nákup = **snižuje tržbu**, není to výplata třetí straně. Jednoduché. | Vyplácíš peníze → **náklad / provize**, řešíš doklady, případně daň u příjemce. Admin navíc. |
| **Cashflow** | Žádný odliv hotovosti; kredit se uplatní jen při dalším nákupu. | Reálný odliv peněz, i když referrer už nikdy nenakoupí. |
| **Retence** | **Nutí k dalšímu nákupu** (kredit má hodnotu jen v ekosystému). | Nulový proretenční efekt. |
| **Motivace získat referral** | Vysoká, pokud zákazník chce kupovat dál (Academy upsell). | Vyšší u lidí, co už nakoupili vše a dál nechtějí. |

**Závěr:** Pro malého CZ OSVČ je store kredit jednoznačně lepší — méně účetní zátěže, žádný
cashflow odliv, a buduje to retenci (kredit ⇒ další nákup ⇒ vyšší LTV). Hotovost zvaž jen jako
výjimku pro top-referrery („ambassador") mimo automatický systém.

### 2.4 Jak se kredit uplatní
- Kredit = saldo v Kč na účtu zákazníka (`referral_credit` view / agregace).
- Při dalším nákupu Martin vystaví **jednorázový kupón na výši kreditu** (MVP, ručně), nebo
  později automaticky přes SimpleShop API. Po uplatnění se kredit označí jako `redeemed`.
- Doporučená **expirace kreditu 12 měsíců** (motivace + čistota účetnictví).

---

## 3) Atribuce přes SimpleShop

### 3.1 Hlavní model (kupón → webhook)
1. Referrer má kód `BARNA-XXXX`. V SimpleShopu existuje **slevový kupón se stejným kódem**
   (MVP: vytvořený ručně; plná verze: přes SimpleShop API při generaci kódu).
2. Kamarád zadá kód v checkoutu jako kupón → dostane slevu.
3. Po zaplacení **SimpleShop pošle webhook** na edge funkci `referral-webhook`.
4. Funkce přečte z payloadu **použitý kupón/slevový kód + e-mail kupujícího + produkt + částku**
   → zapíše řádek do `referrals` (status `pending`).

### 3.2 Co SimpleShop webhook typicky posílá
SimpleShop notifikace o objednávce obvykle obsahuje: **e-mail a jméno zákazníka, název/ID
produktu, cenu, číslo objednávky, stav platby** a (pokud byl použit) **kód slevového kupónu**.
Pole se jmenuje různě dle verze (`coupon`, `voucher`, `discount_code`, `sleva`). Funkce proto:
- zkusí přečíst kupón z více možných klíčů (whitelist názvů polí),
- normalizuje (uppercase, trim) a porovná s `referral_codes.code`.

### 3.3 Fallback, když kód v payloadu NENÍ
SimpleShop nemusí kupón v payloadu vždy vrátit, nebo kamarád kód zapomene zadat. Proto:

1. **Self-report po nákupu:** na děkovací stránce (a v onboarding mailu) otázka
   *„Doporučil ti nás někdo? Zadej jeho kód."* → uloží se do `referrals` jako
   `source = 'self_report'`, status `pending`, vyžaduje **ruční schválení** Martina
   (anti-abuse).
2. **Párování přes částku:** pokud webhook obsahuje slevu, ale ne kód, a self-report dorazí
   později, spáruje se podle e-mailu kupujícího + okna ±7 dní.
3. **Manuální dopsání:** Martin může referral zadat ručně (admin SQL / jednoduchý formulář).

> Realisticky: počítej s tím, že **ne 100 % kupónů přijde v payloadu**. Self-report + ruční
> schválení je nutná pojistka, ne nice-to-have.

---

## 4) Anti-abuse

- **Self-referral:** blokovat, když `buyer_email == owner_email` daného kódu (case-insensitive).
  Validovat v webhooku i v RPC.
- **1× na kupujícího:** unique constraint na `referrals(buyer_email, product)` — jeden e-mail
  může být „doporučený" na daný produkt jen jednou (zamezí opakovanému zneužití).
- **Odměna až po nevratném období:** status `pending` → `confirmed` automaticky po **14 dnech**
  (cron edge funkce nebo `pg_cron`), pokud nepřišel refund. Při refundu webhook nastaví `void`.
- **Fake účty:** odměna se počítá jen z **reálně zaplacené objednávky** (webhook, ne jen
  registrace). Self-report vyžaduje ruční schválení. Limit X potvrzených referralů / 30 dní na
  referrera (měkký flag k revizi, default např. 20).
- **Vyloučit interní e-maily:** `fitness.barna@gmail.com` a test-adresy na blocklistu.
- **Idempotence webhooku:** dedup přes `order_id` (unique) → stejná objednávka nepřipíše kredit
  dvakrát (SimpleShop může retryovat).

---

## 5) Legal / CZ (stručně)

- **Store kredit (sleva na vlastní budoucí nákup):** účetně je to **sleva z tržby**, ne výplata
  provize třetí osobě → pro OSVČ nejjednodušší, žádné srážky/doklady navíc. Doporučeno.
- **Hotovostní výplata:** je to **odměna/provize** — vzniká náklad, u větších objemů řeš
  doklady; příjemce může mít daňovou povinnost. Proto v automatu nepoužívat.
- **GDPR:** v `referrals` se zpracovává e-mail kupujícího (osobní údaj). Právní základ = plnění
  programu / oprávněný zájem. **Do chatu nikdy seznam e-mailů — jen počty** (CLAUDE.md pravidlo).
  RLS zajistí, že referrer vidí jen agregát (počty), ne cizí e-maily.
- **Podmínky programu (publikovat na `/akademie/moje/doporuc/`):**
  - kdo má nárok (jen platící zákazník s entitlementem),
  - výše slevy/odměny a forma (store kredit),
  - kdy se odměna připíše (po 14denním nevratném období, po zaplacení),
  - vyloučení self-referral, 1× na kupujícího, expirace kreditu 12 měsíců,
  - právo program kdykoliv změnit/ukončit, zákaz spamu/zneužití.

---

## 6) DB schéma (SQL DDL)

```sql
-- =========================================================
-- Referral / Affiliate schéma  (Supabase, schema public)
-- =========================================================

-- 6.1 Kódy referrerů ------------------------------------------------
create table if not exists public.referral_codes (
  code         text primary key,                  -- np. 'BARNA-A7K2'
  owner_email  text not null,                      -- vlastník kódu (lowercase)
  created_at   timestamptz not null default now(),
  active       boolean not null default true
);
create unique index if not exists referral_codes_owner_uidx
  on public.referral_codes (lower(owner_email));   -- 1 kód na osobu

-- 6.2 Jednotlivé doporučené nákupy ----------------------------------
create table if not exists public.referrals (
  id            bigint generated always as identity primary key,
  code          text not null references public.referral_codes(code),
  buyer_email   text not null,                     -- lowercase
  product       text not null check (product in ('academy','videokurz')),
  amount        numeric(10,2),                     -- zaplacená částka
  order_id      text,                              -- SimpleShop číslo objednávky (dedup)
  source        text not null default 'coupon'     -- 'coupon' | 'self_report' | 'manual'
                  check (source in ('coupon','self_report','manual')),
  status        text not null default 'pending'    -- 'pending' | 'confirmed' | 'void'
                  check (status in ('pending','confirmed','void')),
  reward_type   text not null default 'credit'     -- 'credit' | 'free_month' | 'cash'
                  check (reward_type in ('credit','free_month','cash')),
  reward_amount numeric(10,2) not null default 0,  -- výše odměny v Kč
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz
);

-- idempotence webhooku: jedna objednávka jen jednou
create unique index if not exists referrals_order_uidx
  on public.referrals (order_id) where order_id is not null;

-- 1× doporučený na kupujícího a produkt
create unique index if not exists referrals_buyer_product_uidx
  on public.referrals (lower(buyer_email), product);

create index if not exists referrals_code_idx on public.referrals (code);

-- 6.3 Saldo kreditu (agregace) -- view, ať není co synchronizovat ----
create or replace view public.referral_credit as
select
  rc.owner_email,
  coalesce(sum(r.reward_amount) filter (where r.status = 'confirmed'
           and r.reward_type = 'credit'), 0)        as credit_confirmed,
  coalesce(sum(r.reward_amount) filter (where r.status = 'pending'
           and r.reward_type = 'credit'), 0)        as credit_pending,
  count(*) filter (where r.status = 'confirmed')    as referrals_confirmed,
  count(*) filter (where r.status = 'pending')      as referrals_pending
from public.referral_codes rc
left join public.referrals r on r.code = rc.code
group by rc.owner_email;

-- (uplatněný kredit: buď samostatná tabulka redemptions, nebo reward_type='void'
--  po uplatnění; pro MVP stačí ručně + sloupec redeemed_at doplnit později.)

-- =========================================================
-- 6.4 RLS — referrer vidí jen SVOJE přes e-mail z JWT
-- =========================================================
alter table public.referral_codes enable row level security;
alter table public.referrals      enable row level security;

-- e-mail z JWT (case-insensitive)
-- jwt claim 'email' = auth.jwt() ->> 'email'

create policy referral_codes_owner_select on public.referral_codes
  for select using (lower(owner_email) = lower(auth.jwt() ->> 'email'));

create policy referrals_owner_select on public.referrals
  for select using (
    code in (select code from public.referral_codes
             where lower(owner_email) = lower(auth.jwt() ->> 'email'))
  );

-- ZÁPIS jen přes service_role (edge funkce). Žádná INSERT/UPDATE policy pro anon/authenticated
-- → web čte jen agregace; změny dělá výhradně webhook/RPC se service klíčem.

-- view dědí RLS z podkladových tabulek (security_invoker), případně:
-- alter view public.referral_credit set (security_invoker = on);
```

> Pozn.: `referral_credit` jako **view** = žádná denormalizovaná tabulka k synchronizaci,
> kredit je vždy konzistentní s `referrals`.

---

## 7) Edge funkce / logika

### (a) `referral-code` — get-or-create kód pro přihlášeného uživatele
- **Vstup:** Authorization: Bearer (Supabase JWT přihlášeného uživatele).
- **Logika:** ověř JWT → vezmi `email` z claims → ověř, že má entitlement (RPC `has_entitlement`,
  jinak 403) → `select` kód z `referral_codes` podle `owner_email`; pokud není, **vygeneruj**
  (`BARNA-` + 4–6 znaků base32 bez matoucích znaků), `insert`, vrať.
- **Výstup:** `{ code, share_url, status: { confirmed, pending, credit_confirmed, credit_pending } }`.
- **Pozn. (plná verze):** zde navíc volá SimpleShop API a založí odpovídající kupón.

### (b) `referral-webhook` — zpracování SimpleShop platby
- **Vstup:** POST z SimpleShopu (JSON o objednávce). Ověř sdílený **secret/HMAC** (z `app_config`).
- **Logika:**
  1. Idempotence: pokud `order_id` už v `referrals`, vrať 200 (no-op).
  2. Vytáhni `buyer_email`, `product`, `amount`, `order_id`, a **kupón** (zkus klíče
     `coupon|voucher|discount_code|sleva|code`).
  3. Pokud kupón odpovídá `referral_codes.code` a **není self-referral** (`buyer != owner`):
     `insert` do `referrals` (source `coupon`, status `pending`, reward dle produktu).
  4. Pokud kupón chybí → **nezapisuj referral** (čekej na self-report), ale entitlement nastav
     normálně (to dělá existující SimpleShop webhook — referral je oddělená funkce / větev).
  5. **Refund event** (pokud SimpleShop pošle) → najdi podle `order_id`, nastav `status='void'`.
- **Výstup:** 200 OK (vždy idempotentně), log do `webhook_log`.
- **Confirm po nevratném období:** samostatný cron (`pg_cron` nebo naplánovaná edge funkce
  `referral-confirm`): `update referrals set status='confirmed', confirmed_at=now()
  where status='pending' and created_at < now() - interval '14 days'`.

### (c) `referral-self-report` — kamarád nahlásí, kdo ho poslal
- **Vstup:** `{ buyer_email, code }` z děkovací stránky / onboarding mailu.
- **Logika:** validace kódu, anti-self, vloží `referrals` se `source='self_report'`,
  status `pending`, **flag k ručnímu schválení** (Martin potvrdí → `confirmed`).
- **Výstup:** `{ ok: true }`.

> Čtení „moje doporučení" **nepotřebuje vlastní funkci** — frontend čte `referral_credit` view
> a `referrals` přímo přes Supabase JS (anon klíč + JWT, RLS filtruje na vlastníka).

---

## 8) Frontend / UX

### 8.1 Nová stránka `/akademie/moje/doporuc/`
- Gating přes `assets/ba-academy.js` (`window.BA.ready`, `getUser`) — jen přihlášený zákazník
  s entitlementem.
- Po loadu zavolá edge funkci **`referral-code`** (get-or-create) → zobrazí:
  - **Unikátní kód** `BARNA-XXXX` (velké, tlačítko „Kopírovat").
  - **Share link** `https://martinbarna.cz/?ref=BARNA-XXXX` + tlačítka:
    - **WhatsApp** `https://wa.me/?text=...` s předvyplněnou zprávou,
    - **Messenger** / FB share,
    - **Kopírovat link**.
  - **Stav programu:** „Přivedl jsi **X** kamarádů · čeká **Y** · **Z Kč** kreditu k dispozici"
    (z `referral_credit` view přes Supabase JS).
  - Krátké **podmínky** (give-get čísla, kdy se kredit připíše, expirace).

### 8.2 Jak kamarád kód uplatní
- Přijde přes `?ref=KOD` → JS uloží kód do `localStorage` (`ba_ref`) a předvyplní ho na
  objednávkové stránce (`/akademie/objednavka/`, `videokurz.html`).
- V checkoutu SimpleShop kamarád zadá kód jako **slevový kupón** → vidí sníženou cenu.
- Po zaplacení: webhook připíše referral; na děkovací stránce navíc **self-report fallback**
  („Poslal tě někdo? Zadej kód") pro případ, že kupón nepoužil.

### 8.3 Jak se odměna projeví referrerovi
- Na `/akademie/moje/doporuc/` se po potvrzení (14 dní) zvýší **kredit confirmed**.
- (Volitelně) e-mail přes Resend `drip-send`: „Tvůj kamarád nakoupil — máš +150 Kč kredit."
- Uplatnění kreditu: při dalším nákupu (MVP ručně přes kupón na výši kreditu; plná verze
  automaticky).

### 8.4 Čtení dat z webu (vzor)
```js
// po BA.ready() a přihlášení (JWT v supabase clientu)
const { data: credit } = await supabase
  .from('referral_credit')
  .select('credit_confirmed, credit_pending, referrals_confirmed, referrals_pending')
  .single();                       // RLS vrátí jen řádek přihlášeného

const { data: code } = await fetch(`${FN}/referral-code`, {
  headers: { Authorization: `Bearer ${jwt}` }
}).then(r => r.json());
```
> Web má jen **anon** klíč. Zápisy a SimpleShop secret jen v edge funkcích (service_role).

---

## 9) MVP scope + checklist pro Martina

### 9.1 MVP (minimální funkční smyčka — postavit teď)
1. DB schéma z §6 (migrace přes Supabase).
2. Edge funkce **`referral-code`** (get-or-create + read stavu).
3. Edge funkce **`referral-webhook`** (čte kupón, zapisuje `pending`, idempotence, anti-self).
4. Cron/`pg_cron` **`referral-confirm`** (pending → confirmed po 14 dnech).
5. Stránka **`/akademie/moje/doporuc/`** (kód + share + stav).
6. `?ref=KOD` → localStorage → předvyplnění na objednávce.
7. **Kupóny v SimpleShopu ručně** — pro každého aktivního referrera 1 kupón = jeho kód.
   (Začni s okruhem nejaktivnějších zákazníků, ne plošně.)
8. Self-report pole na děkovací stránce + ruční schválení (jednoduché, i přes SQL).

### 9.2 Plná verze (později)
- **Auto-generace SimpleShop kupónu** přes SimpleShop API při vytvoření kódu (odpadne ruční krok).
- **Auto-redeem kreditu** (kupón na výši kreditu generovaný automaticky při dalším nákupu).
- E-mailové notifikace (Resend) o připsání odměny + reminder na nevyužitý kredit.
- Admin přehled (leaderboard referrerů), „ambassador" tier s vyšší odměnou.
- A/B test výše odměny (150 vs 200 Kč u videokurzu).

### 9.3 Checklist — co musí doplnit Martin (rozhodnutí/data)
- [ ] **Potvrdit čísla:** videokurz 150/150 Kč? Academy –20 % / 300 Kč (nebo měsíc zdarma)?
- [ ] **Forma odměny:** potvrdit **store kredit** jako default (doporučeno).
- [ ] **SimpleShop:** ověřit, že webhook payload obsahuje pole s kupónem; zjistit přesný název
      pole (poslat 1 testovací objednávku s kupónem a zalogovat payload do `webhook_log`).
- [ ] **SimpleShop kupóny:** založit fixní slevový kupón pro videokurz (–150 Kč) a –20 % pro
      Academy; pro MVP vytvořit kupóny = kódy aktivních referrerů.
- [ ] **Secret/HMAC** pro webhook do `app_config` (ne do repa).
- [ ] **Podmínky programu** (text na `/akademie/moje/doporuc/`) — odsouhlasit znění (§5).
- [ ] **Nevratné období** (14 dní) a **expirace kreditu** (12 měsíců) — potvrdit.
- [ ] **Blocklist** interních/test e-mailů.

---

### Příloha — tok jednou větou
Zákazník dostane kód → kamarád ho zadá jako kupón v SimpleShopu (sleva) → webhook po platbě
zapíše referral (`pending`) → po 14 dnech `confirmed` → referrerovi naskočí store kredit na
`/akademie/moje/doporuc/` → kredit uplatní při dalším nákupu. Fallback bez kupónu = self-report
+ ruční schválení.
