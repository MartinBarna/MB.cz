# Ranní report — noční práce (29.→30. 6. 2026)

Vše níže je **nasazené a ověřené** (0 JS chyb v renderu, deploy pipeline proběhl, větev re-syncnutá).
Co čeká na Tebe, je vždy označené **→ TY**.

---

## 1) Affiliate / doporučovací systém (#39) — HLAVNÍ věc noci, MVP hotové a test-ready

Oboustranný „give-get" pro **Academy i videokurz**: kamarád dostane slevu, Ty (referrer) store kredit.

**Nasazený backend (Supabase):**
- Tabulky `referral_codes`, `referrals`, view `referral_credit`, RLS (každý vidí jen svoje).
- `pg_cron` „referral_confirm_daily" — pending → confirmed po 14denní vratné lhůtě (self-report zůstává na ruční schválení).
- Edge funkce `referral-code` (vygeneruje/vrátí kód `BARNA-XXXX` + stav kreditu) a `referral-webhook` (SimpleShop platba → zápis referralu; idempotence přes order_id, anti-self-referral, čte kupón z víc možných polí).
- `referral_webhook_log` — surový payload každého webhooku (tady najdeš přesný název pole s kupónem).
- Datovou vrstvu jsem ověřil SQL simulací (constraints, view, odměna, cron) a testovací data smazal.

**Nasazený frontend (web):**
- **`/akademie/moje/doporuc/`** — kód, sdílení (WhatsApp / kopírovat), stav (přivedení / čeká / kredit).
- Dlaždice „Doporuč a získej kredit" v `/akademie/moje/`.
- `assets/ref-capture.js` — `?ref=KOD` z odkazu se uloží a na objednávce/videokurzu vyskočí připomínka „zadej kód jako kupón". Nasazeno na homepage + objednávka + videokurz.

**Doporučená čísla (z hloubkového návrhu, jen potvrdit):**
- Videokurz: kamarád **−150 Kč**, referrer **150 Kč kredit** (symetrie give=get).
- Academy: kamarád **−20 %** z první platby, referrer **300 Kč kredit**.
- **Store kredit, ne hotovost** — pro OSVČ jednodušší (sleva z tržby, ne provize), buduje retenci.

**→ TY (abychom to spustili ostře):** plný návod je `akademie/_ai/affiliate-system-design.md` §9.3. Krátce:
1. Potvrdit čísla (150/150, −20 %/300) a formu (store kredit).
2. V SimpleShopu udělat 1 testovací objednávku s nějakým kupónem → mrkneme do `referral_webhook_log`, jak se přesně jmenuje pole s kupónem (jediná neznámá), a webhook doladím.
3. Nastavit URL webhooku v SimpleShopu na `…/functions/v1/referral-webhook` + secret do `app_config` (`referral_webhook_secret`).
4. Pro první vlnu udělat v SimpleShopu kupóny = kódy aktivních zákazníků (ručně; plná auto-generace přes SimpleShop API je „verze 2").
5. Odsouhlasit podmínky programu (text už je na stránce).

---

## 2) AI Martin — backend nasazený, čeká na klíč

- Edge funkce `ai-martin` je **nasazená a živá** (persona v1, tykání, hranice „nejsem lékař", směruje na produkty). Bez API klíče zatím vrací zdvořilou hlášku „zatím nezapnuto".
- Widget `assets/ai-martin.js` má předvyplněný endpoint, ale je **vypnutý** (`ENABLED:false`).
- **→ TY:** vlož `ANTHROPIC_API_KEY` do Supabase secrets (`supabase secrets set ANTHROPIC_API_KEY=…`), pak řekni a já přepnu widget na zapnuto + otestujeme. (Můžu i sám, jen ten klíč je Tvůj.)

---

## 3) Obsah — 13 nových vědeckých „mýtus" článků (nasazeno)

Kardio nalačno · Kolik vajec a cholesterol · Frekvence jídel (5–6× denně) · Tuky a „light" ·
Pocení a spalování tuku · Bolavé svaly (DOMS) · Protahování před tréninkem · Glykemický index ·
Clean eating · Tuk vs sval (přeměna) · Kardio a svaly (interference) · Hnědý cukr a med · Fat burning zone.

Všechny v Tvém stylu, s kartami a JSON-LD schématem na `/clanky/`, 0 broken linků, OG obrázky sedí.

---

## 4) Cookie lišta vs lead pop-up (Tvůj bug) — opraveno

Lead pop-up už nepřebíjí cookie lištu. Pořadí: cookie souhlas → teprve pak pop-up. Oboje se ukáže, nic se nepřekrývá. Nasazeno na 111 stránek.

---

## 5) Lead-magnet maily — zkontrolováno, zatím beze změny live

Šablony v DB (`lead-magnet` 7 kroků + `existing-leadmagnet` 5) jsou po dřívějším de-slopu v dobré kondici, subjecty OK. **Live copy jsem ZÁMĚRNĚ neměnil** — ranní automatické odeslání jde reálným lidem a nechci tam pustit nereviewnutou změnu. Pár drobných námětů (k Tvému schválení, pak upravím + pošlu test na Tebe):
- step „affiliate" v drip mailu teď můžeme napojit na reálný referral program (`/akademie/moje/doporuc/`) — ale ten je pro zákazníky, takže lead verzi necháme jako obecné „pošli dál".
- `„Posílám lepší cenu, než zavřu krám :)"` — emotikon `:)` zvážit (jinak ok, je to Tvůj tón).

---

## 6) Onboarding maily (videokurz + coaching) — připraveno, čeká na ranní TEST

Nic jsem v noci neposílal (správně dle pravidla a Tvého „ráno ~8:30, ne v noci"). Supabase je teď připojené i ke mně, takže **ráno na Tvé slovo udělám TEST na fitness.barna@gmail.com sám** (vložím šablony z `akademie/_email/onboarding-videokurz-coaching.md`, zapnu archive_bcc), Ty obě verze schválíš → teprve pak ostro na seznam.

---

## Čeká na Tebe (shrnuto)
1. Affiliate: potvrdit čísla + 1 testovací SimpleShop objednávka (kvůli názvu pole kupónu) + webhook URL/secret.
2. AI Martin: `ANTHROPIC_API_KEY` do Supabase → pak zapnu widget.
3. Onboarding: říct „jeď", pošlu Ti test, schválíš → ostro.
4. (Volitelně) lead-mail náměty výše.

Be Effective! ⚡
