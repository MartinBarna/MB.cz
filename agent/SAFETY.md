# SAFETY.md — ochrana dat (Gmail & Google Drive)

> Cíl: **aby agent nikdy — ani omylem — nic nesmazal ani nepřepsal** v Gmailu ani
> na Google Drive. Tenhle soubor je závazný; má přednost před pohodlím i rychlostí.

Pojistka je na **třech vrstvách** (defense-in-depth):

---

## Vrstva 1 — Co vůbec jde (technický strop)

Napojené integrace agentovi **nedávají žádný nástroj na smazání e-mailu ani souboru.**
To není pravidlo, to je fakt o sadě nástrojů:

- **Gmail** — dostupné akce: `create_draft`, `create_label`, `delete_label`,
  `label_message` / `label_thread`, `unlabel_message` / `unlabel_thread`,
  `update_label`, `list_*`, `search_threads`, `get_thread`.
  → **Žádný nástroj typu „smazat e-mail / vyhodit do koše / vyprázdnit spam" neexistuje.**
  Agent fyzicky nemůže smazat ani jeden e-mail.
- **Drive** — dostupné akce: `read_file_content`, `download_file_content`,
  `get_file_metadata`, `get_file_permissions`, `list_recent_files`, `search_files`,
  `create_file`, `copy_file`.
  → Vše je **buď čtení, nebo přidání nového** souboru. **Žádné mazání ani přepis
  existujícího souboru** k dispozici není.

Jediné akce, které vůbec něco mění, jsou: založení **draftu**, práce se **štítky**
a založení **nového** souboru. Všechno ostatní je jen čtení.

## Vrstva 2 — Pravidlo (co agent nesmí, i kdyby mohl)

Platí jako **Zlaté pravidlo č. 0** (viz `AGENT_PROMPT.md`):

**Agent je v režimu „jen čti + připrav draft". Smí jen přidávající a vratné operace.**

✅ **Povoleno:**
- `create_draft` (Martin pak odesílá ručně)
- přidat/odebrat štítek e-mailu (organizace, vratné)
- založit **nový** soubor na Drive (např. zápis do `training-data/`)

⛔ **Zakázáno (i kdyby se objevil nástroj):**
- mazat e-maily, vyhazovat do koše, vyprazdňovat koš nebo spam
- mazat štítky (`delete_label`) nebo je hromadně přejmenovávat
- přepisovat, přejmenovávat nebo mazat **existující** soubory na Drive
- jakákoli nevratná operace

> **Spam:** agent ho jen **označí štítkem / nechá být** — nikdy nemaže.
> Když si nejsi jistý, jestli je akce vratná → **nedělej ji a flagni Martinovi.**

## Vrstva 3 — Tvrdá pojistka v harnessu (`.claude/settings.json`)

V kořeni repa je `.claude/settings.json` s blokem `permissions.deny`, který na úrovni
nástroje **zakazuje** destruktivní akce dřív, než se vůbec spustí — nezávisle na promptu:
- `mcp__Gmail__delete_label` — mazání štítků,
- `mcp__Google_Calendar__delete_event` / `update_event` — mazání a přepis událostí
  (Kalendář je nově napojený; číst/navrhovat časy smí, mazat a přepisovat ne).

> ⚠️ **Názvy serverů se můžou změnit při reconnectu integrace.** Reálně se to už stalo:
> Gmail server byl původně UUID (`cba3bb2f-…`), teď je `Gmail`. Formát je
> `mcp__<server>__<nástroj>`. Když se něco odpojí a znovu napojí, **ověř, že `deny`
> v `settings.json` sedí na aktuální názvy** (jinak je pravidlo neúčinné). Vrstvy 1 a 2
> platí vždy.

## Pozor — širší prostředí má i odchozí a placené nástroje

Kromě Gmailu/Drive bývají v prostředí napojené i nástroje, které **nemažou data, ale
konají navenek** (a některé stojí peníze). Pro e-mailového asistenta jsou **mimo rozsah**
— nepoužívá je při draftování odpovědí:

- **Blotato** — `create_post` může **veřejně publikovat** na sociální sítě (svým dopadem
  jako odeslání mailu). Používá se jen vědomě v rámci `content/` workflow, ne při e-mailech.
- **Facebook reklamy** — `create/update/delete` kampaní, audiencí, pixelů (mění živé
  reklamy a utrácí rozpočet).
- **Shopify** — `update-product`, `bulk-update-product-status`, `create-discount`,
  `set-inventory` (mění živý e-shop).

Pravidlo: e-mailový asistent dělá **jen draft + štítky + čtení**. Žádný odchozí post,
změnu reklam ani e-shopu „od oka" — to vždy iniciuje a potvrzuje Martin. Pokud má být
některý z těchto nástrojů tvrdě zamčený i v harnessu, přidá se do `deny` v `settings.json`.

---

## Když Martin chce něco opravdu smazat

Agent to **neudělá za něj.** Místo toho:
1. připraví **interní poznámku** „⚠️ K ručnímu smazání: …" s přesným odkazem na
   e-mail/soubor a důvodem,
2. nechá akci na Martinovi (klik v Gmailu/Drive je vratný přes koš).

Tím zůstává mazání vždy v lidských rukou.
