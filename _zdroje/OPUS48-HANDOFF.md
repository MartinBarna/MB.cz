# HANDOFF: Fable 5 → Opus 4.8 (mise MB.cz)

Datum předání: stav k **7. 7. 2026 večer** (poslední den Fable 5 mise, limit vyčerpán).
Předchůdce: Claude Fable 5 (mise 1.–7. 7.: web, Academy, admin, maily, reklamy).
**Kanonický průběžný log mise je v auto-paměti projektu** (start: `mb-stav-po-misi-2026-07-07.md`,
technické vzory: `mb-fable5-mise.md`, index `MEMORY.md`) — načte se ti automaticky, VĚŘ MU.
Tento dokument je runbook: jak se tu pracuje, co běží samo a co zbývá.

## Hlavní cíl (Martin, 3. 7.): dotáhnout **Barna Academy na 10/10** a **web na 10/10**
ve všem, co jde. To je důvod, proč tu jsme. Vše ostatní (reklamy, maily) už běží
samo — viz Provoz bez Clauda níže.

## Martinova záměrná rozhodnutí (NEMĚNIT bez jeho pokynu)
- **Free ochutnávka Academy i videokurzu je BEZ registrace, schválně** — registrace
  by lidi odradila; účet si tvoří až při koupi. Neopravovat „zpět" na registrační zeď.
- **Academy cena 8 900 Kč = zaváděcí „pro prvních 50 zakládajících členů"** (VEŘEJNÝ
  SLIB — při 50. prodeji zdražit na 12 900 na objednávce + akademie 4 místa + JSON-LD;
  ranní digest to hlídá a od 45 posílá alert; počítadlo = SimpleShop prodeje +
  `app_config.academy_founders_offset`, který se ručně zvedá při grantech reálných
  prodejů mimo SimpleShop — testovací účty NE).
- **Splátky OFICIÁLNĚ EXISTUJÍ (od 7. 7.)**: SimpleShop produkt **151622** „Barna
  Academy — na splátky (3× 3 000 Kč)" = opakovaná platba (1. platba 3 000 při
  objednávce + 2 měsíční doklady po 3 000, celkem 9 000). Formulář
  https://form.simpleshop.cz/n0xgJ/buy/ je nalinkovaný z objednávky i /akademie/
  (cena + FAQ). Webhooky (paid+ordered, product=academy) zkopírované z hl. produktu
  — přístup se odemyká hned po 1. splátce. POZOR: neuhrazené další splátky zatím
  nikdo nehlídá — případný vymáhací mail je otevřený bod.
- **Upgrade videokurz→Academy**: kupón **UPGRADE800** (−800 Kč jen na Academy),
  komunikuje se JEN mailem majitelům videokurzu (upsell-academy sekvence, trigger
  ≥40 % dokončení videokurzu, cron 7:10).
- Resend zůstává na free plánu (100/den) — strop fronty řeší autotune cron.

## Provoz bez Clauda (vše běží samo na Supabase, Claude je potřeba jen na změny)
Sběr leadů → instantní uvítačka s magnetem; hodinový cron rozesílá frontu;
autotune cron hlídá denní strop; ranní digest Martinovi 7:30; milníky 8:15;
záchrana objednávek co 2 h; SimpleShop webhook sám odemyká přístupy po nákupu
a řeší affiliate. Nic z toho nezávisí na běžící session.

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
3. **Ceny neměň bez Martinova vědomí.** Kanonická fakta: 241 lekcí / 23 modulů /
   8 900 → 12 900 po 50. členovi / splátky 3× 3 000 (produkt 151622) / 182 videí
   videokurzu / UPGRADE800 / ZACNI15. Když přidáš obsah nebo funkci, promítni
   počty a featury i na prodejní stránky (Martin to nehlídá — ty ano).
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
**.htaccess má záchrannou síť 301** (7. 7.): case varianty 11 podstránek (RewriteRule
[NC] + RewriteCond proti smyčce), /coaching+/koucink+/konzultace → /koucing/,
/academy → /akademie/, /clenskasekce → /akademie/prihlaseni/ (odkaz žije na
Linktree!). Když přidáš novou veřejnou podstránku, přidej i case-variant pravidlo.
Linktree (linktr.ee/martinbarna) odkazuje: /koucing/, /clenskasekce/, /videokurz/.

## Supabase (Barna Academy backend, ref uhmrpfsdcujbhbtumqye)
- **MCP `deploy_edge_function` je ROZBITÝ (ZodError) — nasazuj přes Dashboard
  Monaco editor**: Set-Clipboard obsah → naviguj
  `supabase.com/dashboard/project/uhmrpfsdcujbhbtumqye/functions/<fn>/code`
  → čekej na monaco (i 30–60 s, sonduj `window.monaco.editor.getModels()[0]
  .getValue().length`) → klikni DO kódu (ověř `document.activeElement` =
  TEXTAREA.inputarea!) → ctrl+a a ctrl+v jako SAMOSTATNÁ volání → ověř délku
  a markery přes JS → tlačítko „Deploy updates" → potvrdit dialog → ověř
  timestamp/verzi (get_edge_function). Před úpravou funkce si stáhni NASAZENOU
  verzi (get_edge_function funguje) — zrcadlo v repu může být starší.
- verify_jwt: funkce volané cronem/webhookem přes x-drip-secret musí mít
  **verify_jwt: false** (drip-send, daily-digest, milestones, order-rescue,
  simpleshop-webhook, withdrawal, checkin-capture, resend-webhook…) — default
  true ROZBIJE bránu (401 Missing authorization header). Po deployi vždy request
  bez auth: musí vrátit odpověď od funkce, ne od brány. Funkce volané z browseru
  supabase-js (lead-capture, referral-code) můžou mít true.
- **Obsah 241 lekcí Academy žije v DB** (`lesson_content` za RLS +
  has_entitlement) — úpravy lekcí dělej v DB, HTML v repu jsou jen shelly!
  Řádek 'zaverecny-test' = otázky testu (JSON). Nahrávání většího obsahu:
  temp SECURITY DEFINER RPC s náhodným hex guardem (vzor v `mb-fable5-mise`).
- **checkin-capture v3**: identita VÝHRADNĚ z JWT (ne z body), kredit max 1× за
  6 dní. **resend-webhook**: fail-closed Svix ověření (secret v app_config).
- **Admin v2** (/akademie/admin/): fronta mailů s akcemi, mapa sekvencí + editor
  šablon (validuje tokeny), referraly + výplaty, check-iny. Admin-api actions viz
  paměť. GA4 karta čeká na secrets GA_SA_JSON + GA_PROPERTY_ID.
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

## Academy lekce — stav revize (3. 7.; od té doby +17 lekcí → 241 ve 23 modulech,
obsah přesunut do DB za RLS — viz Supabase sekce!)
Proběhla obsahová revize všech tehdejších 224 lekcí (20 agentů/modul). Struktura 100 %
zdravá (kvíz/V praxi/zdroje všude, 0 rozbitých odkazů), 483 uvozovek uzavřeno,
**38 obsahových oprav nasazeno** (fakta: teres major, kost=fosfor, hamstringy
tonické, sodík; atribuce studií MATADOR 2018 / Lopez 2021 / Campbell RCT;
číselné rozpory protein/série/kofein/deficit/vláknina; sporné modely změkčeny;
p-hodnota dle ASA; rozbité HTML m9-l3; překlepy). **LEKCE: strukturální nálezy
typu „chybí výčet za dvojtečkou" měly VYSOKOU míru falešných poplachů** (modul 6:
5 nálezů = 5× obsah tam ve skutečnosti byl kompletní) — u obsahových nálezů VŽDY
ověř v souboru před opravou; faktické nálezy (anatomie/čísla/citace) byly správné.
HOTOVO 3.7. večer (PR #351): m12-l10 protein seniorů sladěn s per-meal matematikou
(1,2–1,6 g/kg trénující, 1,0–1,2 minimum netrénující); m17-l2 position stands
vyndány z číslované pyramidy (byly nad RCT) → zvláštní kategorie, přečíslováno.
HOTOVO 3.7. (PR #356, živě ověřeno): dávka sody sjednocena na 0,2–0,4 g/kg
(m14-l7 2×, m14-l8); m5-l12 perex přerámován jako prohloubení lekce 8;
m5-l8 citace sebe sama odstraněna ze Zdrojů.
Dále HOTOVO 3.7.: FAQPage JSON-LD na /videokurz + /akademie/ a WebApplication
JSON-LD na /nastroje-zdarma/ (PR #355); SEO trim title/desc 8 stránek (PR #353–354);
celoplošný linkcheck 0 rozbitých; proaktivní audit (zakázané fráze, sitemap 147 URL
vše existuje, robots+404+favicon+og:image OK) — nálezy jen legitimní kontexty.
Zbylý JEMNÝ bod (nízké riziko): m20 pořadí lekcí v navigaci (l2 mluví o „minulé lekci", ale
v řetězci je l1 až čtvrtá — text změkčen na „v modulu", pořadí chainu by chtělo
srovnat). m6-l3: Martinův příběh měl „před 15 lety / £/hod" (britský zbytek) →
přepsáno obecně; ideálně ať Martin doplní svou reálnou historku.

## Co zbývá z mise (stav 7. 7. večer)
1. **Meta reklamy**: MCP server byl 7. 7. celý den nedostupný. Čeká: Reels
   z Drive (task #27, Martin řekl „dořeším doma"), nové TOFU/MOFU kampaně,
   škálování vítězné sady (blokuje EU/lokalita bug). Denní dohled kampaní.
2. **První reálný nákup Academy/splátek hlídej v edge lozích** simpleshop-webhook
   (payload proti ostrému tvaru netestován; splátky = 1. reálný test opakované
   platby). Neuhrazené 2./3. splátky zatím nikdo nehlídá — návrh: rescue mail.
3. GA4 stats v adminu — čeká na secrets GA_SA_JSON + GA_PROPERTY_ID (s Martinem).
   AI Martin chat (RAG nad lekcemi) čeká na ANTHROPIC_API_KEY.
4. Legacy videokurz produkty v SimpleShopu („Celý videokurz + 16 příloh",
   „VIDEOKURZ + výpočty") — webhooky neauditované.
5. Hlídat Resend 100/den (digest to hlásí) a 50. člena Academy (digest alert).
6. Post-launch (z projektové paměti): komunitní sdílení receptů otevřít
   až po stabilizaci; sběr recenzí na web.
7. Web: nav odkazy vedou na /konzultace/ (teď 301 → /koucing/) — funguje, ale
   při nejbližší textové vlně můžeš hrefy přepsat rovnou na /koucing/.

## Práce s Martinem
Píše krátce, s překlepy, z mobilu. Chce průběžná stručná hlášení („co je a co
potřebuješ"), miluje viditelný pokrok. Když něco vytkne (např. rozpor čísel
50 vs 100), oprav VŠUDE a vysvětli příčinu. Ptej se jen když je to fakt jeho
rozhodnutí. Tokeny šetři: velké orchestrace jen na audity, řemeslo sólo.
Hlas/copy: tykání, plurál „bílkoviny", gender-neutrálně kde segment nejistý
([[žena||muž]] tokeny, ženská varianta VLEVO), „Be Effective!" s vykřičníkem,
strava je 80 %, „važ/nevaž" krátce. Detail v paměti `mb-email-voice-methodology`.

## Principy, které tu vedly k dobrým výsledkům (převezmi je)
Tohle je destilát toho, co za 7 dní mise fungovalo — drž se toho a výsledky budou:
1. **Nejdřív ověř, pak stavěj.** Před každou opravou si přečti skutečný stav
   (soubor, nasazenou verzi funkce, živou stránku, DB) — paměť i tenhle dokument
   můžou být o krok pozadu. Půlka „bugů" z auditů byly falešné poplachy.
2. **Vlny, ne velký třesk.** Změny dávkuj: uprav → commit → PR → deploy → ověř
   ŽIVĚ markery → pak další vlna. Nikdy neoznač hotovo bez důkazu z produkce.
3. **Adversariální sebe-review před deployem.** U větších celků (admin, webhooky)
   projdi vlastní kód očima útočníka/skeptika — našlo to fail-open webhook,
   XSS i nekonečnou smyčku dřív, než šly ven.
4. **E-maily: [TEST] na fitness.barna@gmail.com první, VŽDY.** Čekej na „pošli ostro".
5. **Odchozí/nevratné akce potvrzuj** (ostré maily na klienty, mazání, peníze);
   stavba, deploy webu/funkcí a živá DB jsou pro TENTO projekt povolené autonomně.
6. **Po každém milníku aktualizuj auto-paměť** (krátce, s „Why/How to apply") —
   další session naváže bez re-objevování. Když tě Martin opraví, zapiš si pravidlo.
7. **Když se zadání láme nebo odborně nejasné → STOP a zeptej se.** Martin je
   laik, ale rozhodnutí o cenách, slibech a odborné pozici jsou jeho.
8. **Jeden zdroj pravdy pro čísla.** Kanonická fakta (počty lekcí, ceny, sliby)
   drž konzistentní napříč webem, maily i JSON-LD — při změně přepočítej všude.

## Pro Martina: jak z Opuse 4.8 dostat maximum
- **Začni session větou:** „Přečti si _zdroje/OPUS48-HANDOFF.md a řiď se jím."
  (Auto-paměť se načte sama, ale tenhle pokyn zafixuje pravidla mise.)
- **Zadávej cíl, ne postup:** „Chci, aby X fungovalo pro klienty" funguje líp než
  technický mikro-postup. Přidej vždy: „Ověř to živě a ukaž mi důkaz."
- **Jedna větší věc na session.** Opus je špičkový na řemeslo a opravy; velmi
  dlouhé mise dávkuj po tématech (web / maily / reklamy), ať neztrácí nit.
- **Když něco vypadá špatně, pošli foto** — screenshot z mobilu byl v misi
  opakovaně nejrychlejší cesta k přesné opravě (praxe kit, usage limity).
- **Chtěj na konci session 2 věci:** (a) krátké shrnutí co je živé + co zbývá,
  (b) aktualizaci paměti. Pak další session naváže bez ztráty.
- **Neboj se říct „nelíbí se mi to, udělej to jinak"** — konkrétní výtka
  („tabulka přetéká na mobilu") vede k opravě na první pokus.
