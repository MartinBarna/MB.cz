# HANDOFF: Fable 5 → Opus 4.8 (mise MB.cz)

Datum předání: průběžně aktualizováno, stav k 3. 7. 2026 odpoledne.
Předchůdce: Claude Fable 5 (session „Barna Academy system review and ads setup").
**Kanonický průběžný log mise je v auto-paměti projektu** (soubor `mb-fable5-mise.md`
+ index `MEMORY.md`) — načte se ti automaticky, VĚŘ MU, je udržovaný po každém milníku.
Tento dokument je runbook: jak se tu pracuje, co běží samo a co zbývá.

## Mise
Kompletní revize+upgrade martinbarna.cz (web, Barna Academy, videokurz, lead magnety,
e-mail engine) + Meta a Google reklamy. Hierarchie cílů: (1) pomoct lidem,
(2) maximalizovat konverze, (3) zisk. Martin je laik — vysvětluj česky, tykej,
rozhodnutí zdůvodňuj srozumitelně. Autonomie: stavěj a nasazuj sám (Martin to
výslovně povolil vč. deployů a živé DB pro TENTO projekt), ale odchozí/nevratné
akce (ostré maily, platby, mazání dat) potvrzuj.

## Nepřekročitelná pravidla (Martin je vyžaduje)
1. **E-maily: VŽDY nejdřív [TEST] na fitness.barna@gmail.com** a čekat na výslovné
   „pošli ostro". Bez výjimky.
2. **Secrets nikdy do repa ani chatu** (service_role, RESEND_API_KEY, SimpleShop
   klíč, GA service account…). V SQL je tahej z `app_config` uvnitř dotazu.
3. **Žádné splátky nikde** — jen jednorázové ceny + automatické slevové akce
   v mailech (ZACNI15/JESTE20). Splátky byly 3. 7. všude smazány.
4. **Poctivost copy**: žádná komunita (neexistuje), „tým Barna" jen výhledově,
   certifikát „po složení závěrečného testu" (ne „po dokončení"), žádná
   přeškrtnutá fiktivní cena (12 900 = budoucí cena, ne sleva), praxe
   „od roku 2013" (ne „15 let"), recenze vždy s kontextem „mého koučinku".
5. Platební údaje/hesla nikdy nezadávej ty; identitu inzerenta ověřuje Martin.

## Jak se nasazuje web (ověřený cyklus)
Repo: `C:\Users\fitne\Desktop\MB.cz`, větev `claude/learn-claude-code-tay5rb`.
1. Edity → ověř v render harness (`.claude/launch.json` config `mb-static`,
   port 8099; POZOR: programový scroll v harness nefunguje, screenshoty po
   resize chtějí reload; měř DOM evalem).
2. Commit VŽDY přes `git commit -F soubor.txt` (PowerShell rozbíjí diakritiku
   a uvozovky v -m). Zpráva bez diakritiky.
3. Push → PR přes GitHub API (PowerShell Invoke-RestMethod; token:
   `git credential fill` v BASH → scratchpad `gh_token.txt`; Bash sandbox NEMÁ
   síť, HTTP jen PowerShell) → squash merge → dispatch workflow **300548181**
   → poll na completed → ověř ŽIVĚ (Invoke-WebRequest; na diakritiku čti
   RawContentStream přes UTF8) → `git fetch origin main && git reset --hard
   origin/main && git push --force` (NIKDY neřetěz reset za commit bez kontroly!).
`_zdroje/` a `_supabase/` se na web NEnahrávají (404 živě) — bezpečné pro dokumenty.

## Supabase (Barna Academy backend, ref uhmrpfsdcujbhbtumqye)
- Funkce nasazuj přes MCP `deploy_edge_function` s **verify_jwt: false** u všech,
  které volá cron/webhook přes x-drip-secret (drip-send, daily-digest, milestones,
  order-rescue, simpleshop-webhook, withdrawal…) — **default je true a ROZBIJE
  bránu** (401 Missing authorization header). Po deployi vždy curl bez auth:
  musí vrátit 401/403 od funkce, ne od brány. Funkce volané z browseru
  supabase-js (lead-capture, referral-code) můžou mít true.
- Repo `akademie/_supabase/functions/*` = zrcadla. Nasazená verze může být
  novější — před úpravou vždy `get_edge_function`. Po deployi zrcadlo synchronizuj.
- pg_net: VŽDY pojmenované argumenty (`url :=`, `headers :=`, `body :=`).
  Odpovědi v net._http_response filtruj podle id > poslední známé.
- Drip engine (drip-send v13): copy v DB (email_templates), strop fronty
  `app_config.drip_daily_cap` (teď 60), fronta: follow-upy → čerstvě splatné
  onboarding (48 h) → starý backlog. Instantní uvítačky (only_email) jedou MIMO
  strop. Resend free = tvrdých 100/den (sdílené s Auth SMTP!).
- Cron joby: drip-send-hourly (0 * * * *), daily-digest-morning (30 5),
  milestones-daily (15 6), order-rescue-2h (45 */2), **drip-cap-autotune (50 4)**
  — po dojetí backlogu (<20 splatných starších 2 dnů) sám zvedne cap na 80,
  při novém velkém backlogu vrátí na 60. Ranní digest chodí Martinovi 7:30.
- SimpleShop: produktové webhooky „po zaplacení" + „po objednání" nastavené
  (42679 videokurz, 151185 academy + 95705, 90877). {mail} funguje JEN na
  produktové úrovni. **Hlídej první reálný nákup v edge lozích** (payload
  netestován proti ostrému tvaru). UI SimpleShopu: hodnoty psát SKUTEČNÝMI
  klávesami (klik→ověř activeElement→ctrl+a→psát→uložit→reload-verify);
  form_input se u části polí nepropíše.

## Reklamy
- **Meta** (účet 235296588168325, pixel „Natty Rules"): TOFU (Leads, ženy+muži
  150 Kč/den) + MOFU (Sales CBO 100 Kč/den) AKTIVNÍ. Denní kontrola výkonu
  (skill martin-reklamy; změny po jedné a logovat do
  Martin-Automation/logs/ad-changes.md). CPL cíl ~50 Kč, den 2 to plnilo.
- **Google Ads** (113-748-5640, ovládá se přes Claude-in-Chrome — MCP API není):
  kampaň **23999618797** „Search – Lead magnety + Videokurz | Fable 07/2026",
  120 Kč/den, Max. kliknutí + strop CPC 8 Kč, jen vyhledávání, CZ/čeština,
  3 sestavy (makro-plan / forma-zpet / videokurz), každá 7 frázových KW +
  RSA 8+4. Fakturace vyřešena, kampaň „Splňuje podmínky".
  LEKCE UI: zaseknutý celoobrazovkový ipl-progress-indicator → JS
  `el.style.pointerEvents='none'`; souřadnice vždy čerstvě přes
  getBoundingClientRect × (1568/innerWidth); Google při nové RSA předvyplní
  texty z předchozí sestavy — VŠE přepsat a JS-ověřit; publish dialog
  „kampaň nemůže zobrazovat reklamy" → Publikovat.
  **TODO: importovat GA4 klíčovou událost `generate_lead` jako konverzi**
  (označena 3. 7., Ads sync ~24 h; Cíle→Konverze; purchase už importovaná).
  Po ~30 konverzích/měs. zvážit přepnutí na Maximalizovat konverze.
  **Martin do 16. 7. musí projít ověření totožnosti inzerenta.**
- GA4: property Effective Fitness Training – GA4 (374139958) — s Ads propojená.
  Webové eventy: generate_lead (klient), purchase (server-side, prověřit se
  ss-capi až přijde reálný nákup).

## Co zbývá z mise (stav 3. 7.)
1. GA4 generate_lead → Ads konverze (task #15, čeká na sync).
2. Schválené návrhy: #3 reaktivace spících členů (postavit + [TEST] + čekat
   na „pošli ostro"), #4 sběr recenzí na web.
3. Web/UX vlna průběžně (homepage/videokurz polish; Academy prodejní cesta
   po auditu 3. 7. čistá).
4. Denní dohled Meta + Google kampaní; hlídat Resend (digest to hlásí).
5. Hlídat 1. reálný SimpleShop nákup v lozích.
6. GA4 stats v adminu — čeká na GA_SA_JSON + GA_PROPERTY_ID secrets (s Martinem).
7. Post-launch (z projektové paměti): komunitní sdílení receptů otevřít
   až po stabilizaci.

## Práce s Martinem
Píše krátce, s překlepy, z mobilu. Chce průběžná stručná hlášení („co je a co
potřebuješ"), miluje viditelný pokrok. Když něco vytkne (např. rozpor čísel
50 vs 100), oprav VŠUDE a vysvětli příčinu. Ptej se jen když je to fakt jeho
rozhodnutí. Tokeny šetři: velké orchestrace jen na audity, řemeslo sólo.
