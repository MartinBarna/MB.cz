# Assets — přílohy k mailům

Hodnotové PDF, které agent přikládá ve **studeném lead-magnet funnelu**. Jsou to Martinovy
materiály, ne klientská data. **Pozor:** tyhle PDF jsou pro **studené leady** (lidi, co tě
neznají). Na **win-back** se z nich hodí jen **kuchařka** jako bonus — 7-chyb/makro-plán ne (viz níže).

## `lead-magnety/`
| Soubor | Pro koho | Obsah |
|---|---|---|
| `7denni-makro-plan-ZENY.pdf` | ženy | 7denní makro plán (detailní) |
| `7denni-makro-plan-MUZI.pdf` | muži | 7denní makro plán (detailní) |
| `7-chyb-hubnuti-ZENY.pdf` | ženy | 7 chyb, proč nejde hubnutí |
| `7-chyb-forma-MUZI.pdf` | muži | 7 chyb, proč nejde forma |
| `kucharka-10jidel-ZENY.pdf` | ženy | 10 fit jídel do 15 minut |
| `kucharka-10rychlovek-MUZI.pdf` | muži | 10 rychlovek (víc bílkovin, větší porce) |

> **Kuchařky — opraveno (6/2026):** PDF jsou přegenerované **bez „48 hodin"** (trvalý kód
> START599, kód „platí pořád"). Editovatelný zdroj je vedle: `kucharka-10jidel-ZENY.html` /
> `kucharka-10rychlovek-MUZI.html`. V **Drive** (funnel) ještě nahraď staré PDF za tyhle
> přes „Spravovat verze" (zachová ID → engine jede dál), nebo aktualizuj `pdfVlna3` ID v `Lead-Engine.gs`.

## Kdy přikládat
- **Nurture série / studený funnel** (`../templates/nurture-series/`): vlna 1 = makro plán,
  vlna 2 = 7 chyb, vlna 3 = kuchařka. Jen pro **studené leady** z formuláře.
- **Win-back:** 7-chyb a makro-plán NE (začátečnické). **Kuchařku (recepty) ano** jako
  lehký bonus k hlavnímu dárku „restart na míru" (rozhodnutí Martina 6/2026) —
  viz `../playbooks/win-back.md`.

> **Doručení — příloha vs. odkaz:** `create_draft` má pole `attachments` (base64), ale
> v praxi konektor přílohu k draftu **spolehlivě nepřipne** — v draftu nech poznámku
> `>>> připni <soubor>.pdf` a přetáhni ji ručně při kontrole. Lepší cesta do budoucna =
> **sledovatelný odkaz** místo přílohy (řeší attachment i prokliky):
> `../integrations/lead-magnet-links.md`. Vždy vyber jazykově/pohlavně správnou variantu;
> nikdy nepřikládej cizí/klientská data.
