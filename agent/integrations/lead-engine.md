# Lead Engine — živá automatika v Google Drive (Apps Script)

> **Tohle agent MUSÍ znát**, aby NEDUPLIKOVAL práci, kterou už dělá automat.
> Reálný případ 6/2026: agent nadraftoval uvítací mail 20 leadům, které už
> obsloužila tahle mašina → duplikát. Než agent řeší leady, počítá s tímhle.

## Co to je a kde

Google Apps Script **`Lead-Engine.gs`** běží na Google serverech (nezávisle na PC).
Umístění: Drive → **`Klienti platby/Email follow-up série (lead magnet)/`**
(nahrazuje starší `Followup-Auto.gs`). Odesílá z `fitness.barna@gmail.com` (limit 500/den).

## Co dělá (celý řetěz)

1. **Import** — čte Tally notifikace (`notifications@tally.so`) a zapisuje nové leady
   do Sheetu (ženy/muži), bez duplicit.
2. **Vlna 1** (hned) — uvítací mail + makro plán PDF, v Martinově stylu (Nazdar [jméno],
   kalkulačka, WhatsApp). Jen těm, kdo vlnu 1 ještě neměli.
3. **Vlna 2** (den 3) — „7 chyb" PDF + soft videokurz.
4. **Vlna 3** (den 7) — kuchařka PDF + videokurz START599.
5. **Vlna 4** (den 12) — pozvánka + koučing.
6. **Detekce odpovědí** — před každou vlnou ověří, jestli lead odepsal. Když ANO →
   **vynechá ho** a do Sheetu napíše „ozvi se osobně". Nikoho, kdo už píše, neotravuje.

Sheety: `Leads_Tally_2026` (ženy), `Leads_Muzi_35_2026` (muži). Skript si značí
sloupce Vlna 2/3/4/Odpověď → nikdy nepošle 2×.

## Režimy a funkce (pro orientaci)

- **`nahled`** — vypíše do logu, kdo je dnes na řadě (nic neodešle). Bezpečný test.
- **`nactiNoveLeady`** — jen import do Sheetu.
- **`jedem`** — import + vytvoří **koncepty** (DRAFT) / nebo odešle (AUTO).
- **`rezimDRAFT`** (výchozí) / **`rezimAUTO`** / **`zjistitRezim`** — přepínání režimu.
- **`vytvoritDenniSpoustec`** — denní spuštění v 9:00 / `zrusitDenniSpoustec`.
- **`rannisouhrn`** — pošle Martinovi přehled „kdo je dnes na řadě".

**Výchozí = DRAFT** (nic se neodešle samo) — stejná filozofie jako agent.

## Detekce pohlaví
Podle **předmětu** Tally mailu: ženy = „pro ženy" (✅ potvrzeno), muži = „pro muže"
(ověřit u prvního mužského leadu). Když nesedí → skript mail přeskočí („Neznámá forma").

## Sleva START599 = TRVALÁ (vyřešeno 21. 6. 2026)

Martin rozhodl: sleva **599 / kód `START599` platí NAPOŘÁD, bez 48h deadlinu** (žádná
falešná urgence — chrání důvěru). Zdroj pravdy = `KNOWLEDGE_BASE.md`.

- Repo šablony (`templates/nurture-series/`) — ✅ srovnané (bez deadlinu).
- Drive `Lead-Engine.gs` (vlna 3 ženy+muži) — ⚠️ úprava je popsaná v Drive souboru
  **„OPRAVA — sleva START599 je TRVALÁ (čti).md"** (složka „Email follow-up série").
  Skript běží v **script.google.com** (ne v Drive) — 3 textové úpravy vkládá Martin tam.
- Drive `follow-up-emaily-a-strategie.md` — věty o „48 h / poslední šance" jsou superseded.

## Související v Drive (kontext, ne klientská data)
- `fb-ads-plan-ekonomika.md` — plán FB testu (200 Kč/den × 14 dní; koučing = skutečný
  zisk; pixel „Natty Rules" `277526073774099`; geo Morava/MSK; 2 kampaně Ž/M).
- Lead-magnet PDF (ženy/muži), Tally formuláře, prompt soubory pro generování PDF/formů.

## Co z toho plyne pro agenta
- **Leady z formuláře řeší Lead Engine, ne agent.** Agent je do funnelu nedraftuje
  (viz `playbooks/triage.md`). Pokud Martin výslovně chce ruční zásah, agent nejdřív
  ověří Sheet/Odeslané (dedup).
- Fakta o slevě/ceně vždy z `KNOWLEDGE_BASE.md` (trvalý START599), ne ze starší Drive strategie.
