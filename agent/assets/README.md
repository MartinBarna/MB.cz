# Assets — přílohy k mailům

Hodnotové PDF, které agent přikládá ve **studeném lead-magnet funnelu**. Jsou to Martinovy
materiály, ne klientská data. **Pozor:** tyhle PDF jsou pro **studené leady** (lidi, co tě
neznají). **NEpoužívají se na win-back** — ex-klienti je mají za sebou (viz níže).

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
- **NE na win-back.** Bývalí klienti videokurz i materiály **mají** (jsou v balíčku).
  Win-back dárek = **restart na míru** (personalizované nastavení), ne tyhle PDF —
  viz `../playbooks/win-back.md`.

> Příloha v draftu: Gmail `create_draft` umí `attachments` (base64). Vyber správnou
> jazykově/pohlavně odpovídající variantu. Nikdy nepřikládej cizí/klientská data.
