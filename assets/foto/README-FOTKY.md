# 📸 Kam nahrát fotky (návod pro Martina)

Fotky z chatu se k asistentovi nepropisují jako soubory + síť je blokovaná,
takže je potřeba nahrát je **přímo do repa**. Nejjednodušší cesta:

GitHub web → repo `martinbarna/mb.cz` → složka `assets/foto/…`
→ tlačítko **Add file → Upload files** → přetáhni fotky → **Commit**
(commitni do větve `claude/learn-claude-code-tay5rb`).

Pak napiš „fotky nahrané" a já je optimalizuju (zmenším, WebP/JPG),
vložím na web s `alt` texty, lazy-loadingem a správnými rozměry.

---

## 1) `assets/foto/martin/` — TY (hero + „O mně")
| soubor | kam | co |
|---|---|---|
| `hero.jpg` | Hero (úvod) | **balkon, tmavá košile** — tvůj favorit ✅ |
| `portret.jpg` | „O mně / Kdo jsem" | headshot v bílé košili, úsměv |
| `koucink.jpg` *(volitelně)* | sekce koučink | u monitoru / přednáška |

## 2) `assets/foto/promeny/` — PROMĚNY KLIENTŮ (sekce „Výsledky")
Ideálně už hotová „před/po" koláž = 1 soubor na klienta. Navržený výběr
(reální klienti se jménem + příběhem — pojďme jen ověřené MB klienty):

| soubor | jméno + příběh (alt text) |
|---|---|
| `kristyna-27kg.jpg` | Kristýna — −27 kg za 2 roky spolupráce |
| `anicka.jpg` | Anička — proměna za 8 měsíců |
| `libor.jpg` | Libor — proměna za 7 měsíců |
| `klientka-64.jpg` | Klientka 64 let — −20 kg za 12 týdnů (jen chůze + strava) |
| `andrea.jpg` | Andrea — maminka 2 dětí, nejlepší forma v 36 |
| `tomas.jpg` | Tomáš — crossfit, životní forma bez jojo efektu |
| `katka.jpg` | Katka — drží formu i 2 roky po spolupráci |
| `plonka.jpg` | Martin Plonka — proměna za 2,5 roku |

> Nemusíš dodržet názvy — klidně to tam naházej s jakýmikoli jmény
> a pošli mi seznam „soubor = jméno + příběh", zbytek dořeším.

⚠️ **Jen reálné MB klienty** (se souhlasem). Pár koláží, co kolovaly,
vypadá jako cizí/stock fotky z internetu — ty vynecháme, ať jsou Výsledky
100% autentické (stejný důvod, proč nechceme vymyšlené recenze).
