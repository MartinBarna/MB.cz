# Klientská sekce pro online coaching — návrh (14. 7. 2026, ke schválení)

> Cíl: klienti 1:1 koučinku dostanou na webu vlastní sekci (obdoba členské Academy),
> Martin dostane admin přehled všech klientských dat dlouhodobě. Nahrazuje Excel
> posílaný mailem. Vzor UX = krokový onboarding z appky Tvůj Coach („airbnb styl").

## Co už máme (stavíme na tom, nic nevymýšlíme znovu)
- **Entitlement `coaching`** už v DB existuje (admin ho umí udělit) → gate sekce zdarma.
- **Přihlášení** = stejný Supabase login jako Academy/videokurz (magic link / heslo).
- **Admin panel** `akademie/admin/` + `admin-api` edge fn → přidáme záložku Klienti.
- **Supabase Storage** + RLS → dokumenty klientů.
- **Resend** → maily s reportem (dark-gold šablona jako drip).
- **Wizard UX vzor**: `src/app/onboarding/index.tsx` v appce (kroky, fade, validace, souhrn).

## A) Sekce `/akademie/klient/` (gate: entitlement coaching)
Dashboard klienta:
1. **Pokrok** — grafy z reportů: váha (týdenní trend), pas+boky, kroky Ø, kcal Ø vs cíl, škály.
2. **Můj report** — CTA „Vyplnit týdenní report" (wizard) + historie odeslaných reportů.
3. **Dokumenty od Martina** — soubory z úložiště (individuální složka + sdílené pro všechny klienty).
4. **Rychlé odkazy** — videokurz (mají v ceně), free Academy sekce, AI Martin.
5. **Academy banner se slevou 20 %** — vidí jen klienti (kupón v SimpleShopu, viz otázka 5).

## B) Úložiště dokumentů
- Storage bucket `client-docs`: `shared/…` (všem klientům) + `<user_id>/…` (individuální).
- RLS: klient čte svoje + shared; zápis jen admin (přes admin sekci — upload rovnou z prohlížeče).
- Admin: upload/smazání + přehled kdo co má.

## C) Týdenní report — krokový wizard (podle Excelu, vylepšeno)
Kroky (1 otázka/obrazovka, velká tlačítka, jde vyplnit palcem na mobilu):
1. **Váha** (kg, desetinná čárka) — s nápovědou „týdenní průměr ranních vážení".
2. **Míry** (volitelný krok „Tento týden jsem se neměřil/a → přeskočit"): pupík + pas + boky
   povinně-doporučené; rozbalovací „všechny míry" = krk, prsa, zadek, P/L paže, P/L stehno,
   P/L lýtko (12 polí jako v Excelu, ale nikoho nenutí).
3. **Strava** — týdenní průměr: kcal, bílkoviny, sacharidy, tuky, vláknina + „kolik dní jsem zapisoval/a (0–7)".
   (Denní rozpis po dnech jako v Excelu = volitelné rozbalení pro pečlivé.)
4. **Aktivity** — kroky Ø/den, fitko (počet tréninků), kardio (počet/минuty), jiné sporty (text).
5. **Škály 1–5** (přesně tvoje formulace z Excelu): ÚNAVA, HLAD, SÍLA + NAVRHUJI PŘIDAT:
   SPÁNEK (hodin Ø + kvalita 1–5) a DODRŽENÍ PLÁNU (1–5) — obě jsou páky, podle kterých stejně rozhoduješ.
6. **Slovní zhodnocení** — „Co se povedlo?", „Co drhlo?", „Otázky na Martina?" (3 textová pole).
7. **Fotky pokroku** (volitelně, 1× za 4 týdny výzva) — do klientova úložiště.
8. **Souhrn** → Odeslat.
Po odeslání: uloží se do DB, **mail tobě + kopie klientovi** (přehledný dark-gold HTML
se všemi hodnotami a šipkami vs minulý týden), v sekci hned naskočí do grafů.

## D) Vstupní dotazník (nový klient) — stejný wizard engine, jiné kroky
Osobní údaje a kontakt → cíl a motivace („proč") → historie diet a sportu → zdravotní
omezení a léky (⚠️ jen sběr, žádné rady — safety) → preference jídla (co nejí, alergie,
kolik jídel denně, kdo vaří) → možnosti tréninku (fitko/doma, dny, vybavení) → práce
a režim dne (směny!) → výchozí míry + váha + fotky → souhrn → odeslat (mail tobě + kopie).

## E) Admin — záložka „Klienti"
- Seznam klientů (jméno, e-mail, poslední report, ⚠️ kdo nedodal report > 8 dní).
- Detail klienta: grafy za celou dobu, tabulka všech reportů (týden po týdnu jako tvůj
  Excel souhrn), vstupní dotazník, dokumenty (upload), poznámky kouče (jen pro tebe).
- Export klienta do XLSX/CSV (stejné sloupce jako tvůj Excel — zpětně kompatibilní).

## F) Technika (stručně)
- Tabulky: `client_reports` (user, datum, váha, míry jsonb, strava jsonb, aktivity jsonb,
  škály jsonb, texty, fotky[]), `client_intake` (jsonb sekce), `client_notes` (admin-only). RLS.
- Edge fn `client-report-send`: uloží + pošle oba maily (Resend). Připomínka v pondělí ráno
  klientům, kteří report nevyplnili (cron, opt-out).
- Grafy: lehká klientská knihovna bez závislostí (SVG jako u grafů v appce) — dark-gold.

## Otázky na Martina (doladění)
1. **Mail formát:** stačí přehledný HTML mail (vypadá skvěle v Gmailu, jde vytisknout do PDF
   jedním klikem) + export XLSX v adminu? Generovat PDF/Excel přílohu ke každému mailu je
   křehčí a nepřidá hodnotu — ale když na příloze trváš, udělám XLSX přílohu.
2. **Strava denně, nebo průměr?** Doporučuji průměr + volitelný denní rozpis (viz C3).
   Klienti s appkou Tvůj Coach budou mít jednou makra automaticky — web to nedubluje.
3. **Škály navíc** (spánek, dodržení plánu) — souhlasíš? Něco dalšího/vyhodit?
4. **Připomínka reportu** v pondělí ráno mailem — ano?
5. **Sleva 20 % na Academy pro klienty:** vytvoříš v SimpleShopu kupón (např. `KLIENT20`,
   20 %, bez expirace)? Web ho ukáže jen v klientské sekci. (SimpleShop nemá API na kupóny,
   je to 2 min ručně.)
6. **Staré reporty:** mám importovat historii z Excelů stávajících klientů? (pošleš soubory,
   naimportuju — grafy pak ukážou celou cestu, silný wow efekt pro klienty)
7. **Frekvence měr:** míry týdně jako v Excelu, nebo stačí 1× za 2 týdny (méně otravné)?
8. Kolik má dnes aktivních klientů koučink? (kvůli dimenzování a případnému importu)

## Pořadí stavby (po schválení)
1. DB tabulky + RLS + storage bucket (migrace)
2. Wizard engine (sdílený pro report i dotazník) + stránka /akademie/klient/
3. Edge fn maily + cron připomínka
4. Admin záložka Klienti + export
5. Grafy + Academy sleva banner
6. Test s tebou jako „klientem" → import historie → pustit klientům
