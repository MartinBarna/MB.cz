# Dávka G článků (19. 10. 2026): co je co

Stav: NÁVRH. Nic není publikováno ani naplánováno ven. Merge PR = Martinovo schválení termínů.

## CZ články (clanky-fronta, vydá je GitHub Action v 08:05 UTC)
| Datum | Draft | Téma |
|---|---|---|
| 14. 1. 2027 | brambory-a-hubnuti.md | Brambory jako nejsytější příloha (Holt 1995, Randolph 2014, Rebello 2022) |
| 28. 1. 2027 | chleba-a-pecivo-pri-hubnuti.md | Pečivo při hubnutí (Loria Kohen 2011, Holt 1995, Reynolds 2019) |
| 4. 2. 2027 | rychlost-jidla-jist-pomalu.md | Rychlost jídla (Robinson 2014, Ohkuma 2015) |
| 11. 2. 2027 | orechy-a-hubnuti.md | Ořechy a porce (Nishi 2021, Novotny 2012) |

Termíny navazují na dávku F (PR #581) a stávající frontu (poslední 21. 1. 2027 cvičení). Záznamy v manifestu jsou na konci pole, aby se PR nepraly s #581.
Pečivo odkazuje na brambory (vyjde dřív), ořechy na článek o vážení z dávky F (vyjde 26. 11. 2026).

## EN verze (_cloud/clanky-g-1019/en/)
potatoes-and-fat-loss, bread-and-fat-loss, eat-slowly-fat-loss, nuts-and-fat-loss. CTA koučink.
Publikovat až po vydání CZ článku a po merge PR #579 (jinak konflikt v en/blog/index.html a hreflang na neexistující CZ stránku):
`node scripts/blog-publikuj-en.mjs --drafty _cloud/clanky-g-1019/en --x-articles x-articles`

## Posty (_cloud/clanky-g-1019/posty/)
Každý soubor: X Article (EN), LinkedIn (CZ), Facebook (CZ). Kopie v /mnt/project-files/posty-1019/davka-g/.

## Kontroly (prošly 19. 10.)
- `node scripts/blog-publikuj.mjs clanky-fronta/<draft> --dry`: 0 dlouhých pomlček, title i meta v limitu, 3 validní JSON-LD.
- `node scripts/blog-fronta-vydej.mjs --dnes 2027-02-11 --dry`: všechny 4 ve frontě.
- EN dry run: 4 články, 0 pomlček, meta 152 až 156 znaků.
- Čísla ze studií ověřena proti abstraktům v PubMed. Kalorie potravin jsou orientační z tabulek.

## K revizi
- „15 až 20 minut na jídlo" je výslovně praktický cíl z praxe, ne číslo ze studie.
- Kalorie pečiva a brambor jsou orientační, bez značek.
