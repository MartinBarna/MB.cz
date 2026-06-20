# Playbook: SYNC — aktivní přehled (Gmail + Drive)

Agent si **sám udržuje aktuální obraz** o všem novém a promítá ho do všech funkcí.
Má přístup k celé Gmail schránce i celému Google Drive — využívá to ke čtení/orientaci,
zápisy (drafty, CRM, znalosti) jsou vždy ke schválení.

## Co a jak často kontrolovat

### Každý běh („projdi maily" / ranní briefing)
- **Gmail příchozí:** nové check-iny, poptávky/leady, churn signály, odpovědi ve vláknech.
  → triage (`triage.md`), připrav drafty, oštítkuj.
- **CRM update:** u dotčených klientů zapiš poslední report, aktuální makra, stav.
- **Spouštěče dle dat:** nudge na chybějící report, retence (končí paušál), win-back
  (ukončení 2–7 měs zpět) — viz příslušné playbooky.

### Týdně (hlubší sweep Drive)
- **Ověř fakta:** ceny na martinbarna.cz/koucing vs. `../KNOWLEDGE_BASE.md` §2; produkty, odkazy.
- **Nové materiály v Drive:** nové PDF/e-booky/lead magnety, nové šablony mailů, změny v
  Team Barna procesech → aktualizuj `KNOWLEDGE_BASE`, `assets/`, `training-data/`, `templates/`.
- **Content:** nová témata/nápady z praxe → do `../content/`.

## Když se změní fakt (cena, odkaz, balíček, produkt)
1. Uprav **`KNOWLEDGE_BASE.md`** (jediný zdroj pravdy).
2. Promítni do **webu** (`index.html`, články) a dotčených **šablon**.
3. Zmiň změnu Martinovi v souhrnu.

## Jak se přehled promítá do funkcí
- **Check-in** → aktuální makra/cíle klienta z CRM (navazuje, neopakuje se).
- **Poptávka / retence / win-back / doprodej** → aktuální ceny, dárky, akce.
- **Content / FB ads / vidIQ** → aktuální témata a nabídka.
- **Triage** → nové vzory šumu i práce.

## Režim provozu
- **On-demand (teď):** Martin řekne „projdi maily" / „sync" → agent provede sweep a vrátí briefing.
- **Kontinuální 24/7:** vyžaduje scheduler (n8n/cron/Make), který agenta spustí např. ráno
  a v poledne — viz `../integrations/`. Princip zůstává: agent připraví, Martin schválí.

## Bezpečnost
- Agent **jen čte** Gmail/Drive pro orientaci; nic neodesílá.
- **Osobní data klientů** jen do CRM (Sheet/Notion), **ne do repa**.
- Drafty, CRM zápisy i změny faktů = vždy ke schválení Martinem.
