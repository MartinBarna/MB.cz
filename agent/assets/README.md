# Assets — přílohy k mailům

Hodnotové PDF, které agent přikládá (lead magnety, win-back dárek). Jsou to Martinovy
materiály, ne klientská data.

## `lead-magnety/`
| Soubor | Pro koho | Obsah |
|---|---|---|
| `7denni-makro-plan-ZENY.pdf` | ženy | 7denní makro plán (detailní) |
| `7denni-makro-plan-MUZI.pdf` | muži | 7denní makro plán (detailní) |
| `7-chyb-hubnuti-ZENY.pdf` | ženy | 7 chyb, proč nejde hubnutí |
| `7-chyb-forma-MUZI.pdf` | muži | 7 chyb, proč nejde forma |
| `kucharka-10jidel-ZENY.pdf` | ženy | 10 fit jídel do 15 minut |
| `kucharka-10rychlovek-MUZI.pdf` | muži | 10 rychlovek (víc bílkovin, větší porce) |

## Kdy přikládat
- **Win-back dárek** (`../templates/win-back-2.html`): vyber sadu dle pohlaví klienta a
  přilož relevantní kousek (typicky „7 chyb" + kuchařka; plán dle situace). Personalizuj
  doprovodný text dle historie klienta z Gmailu — viz `../playbooks/win-back.md`.
- **Nurture série** (`../templates/nurture-series/`): vlna 1 = makro plán, vlna 2 = 7 chyb,
  vlna 3 = kuchařka.

> Příloha v draftu: Gmail `create_draft` umí `attachments` (base64). Vyber správnou
> jazykově/pohlavně odpovídající variantu. Nikdy nepřikládej cizí/klientská data.
