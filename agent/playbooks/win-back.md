# Playbook: WIN-BACK (oslovení bývalých klientů)

Cíl: vrátit klienty, co skončili před pár měsíci. Levný zdroj příjmů — už Tě znají,
mají důvěru. Navazuje na „speciální dárek pro stálé klienty při návratu" z procesu.
Princip jako všude: **agent připraví, Martin schválí.**

## Koho oslovit (a koho NE)

**Ano (kandidát na win-back):**
- V CRM `stav = ukončeno`, konec spolupráce zhruba **2–6 měsíců** zpět.
- Odešel v dobrém / „jen pauza" / život zasáhl (práce, děti) — ne kvůli nespokojenosti.
- Měl výsledky nebo potenciál (z poznámek/reportů).

**Ne (→ eskalace / vynechat):**
- Kdo odešel nespokojený, řešil reklamaci/vrácení peněz, nebo výslovně nechtěl pokračovat.
- Zdravotní důvody ukončení → citlivé, jen ručně.

> Bez CRM: v Gmailu najdi dřívější aktivní klienty (`in:sent "Přeju bomba den"`), u kterých
> poslední report/komunikace je 2–6 měsíců zpět a vlákno nekončí stížností.

## Sekvence (3 maily, ~12 dní)

| # | Kdy | Cíl | Šablona |
|---|---|---|---|
| 1 | den 0 | **Znovunavázání** — lidsky, bez nabídky („jak se máš?") | `../templates/win-back-1.html` |
| 2 | den ~5 | **Měkká nabídka návratu** + dárek (jako velkorysost, ne tlak) | `../templates/win-back-2.html` |
| 3 | den ~11 | **Hodnota + otevřené dveře** (bez deadlinu, bez tlaku) | `../templates/win-back-3.html` |

- Zastav sekvenci, jakmile klient odpoví (přejdi na osobní domluvu / onboarding).
- Max tahle jedna sekvence; když nereaguje, nech být (dveře zůstávají otevřené).
- **Tón = Martinova filozofie:** vždy spíš dávat než brát, zvát ne tlačit, žádná umělá
  urgence. Chráníme jeho image (viz `../STYLE_GUIDE.md` § Prodejní filozofie). Když máš
  pochybnost, jdi měkčí cestou — radši méně prodejní.

## Dárek = RESTART NA MÍRU (ne lead-magnet PDF, ne videokurz, ne sleva)

**KRITICKÉ — kdo je adresát:** win-back cílí na **bývalé KLIENTY**. Už prošli koučinkem,
**videokurz i materiály MAJÍ** (jsou v balíčku). Z toho plyne:
- **NEPŘIKLÁDEJ lead-magnet PDF** (7denní plán / 7 chyb / kuchařka) — to je pro studené
  leady; pro ex-klienta je to začátečnické a podceňující.
- **Neprodávej videokurz** — už ho vlastní.
- **Cíl win-backu = návrat na COACHING.**

Dárek = personalizovaný **restart na míru** (filozofie „dávat víc, než beru"):

1. **Vytáhni z Gmailu historii** klienta: jeho **cíl**, **kde se sekl / co mu šlo**,
   poslední makra. (Z check-in vláken „Přeju bomba den".)
2. Do mailu napiš **1–2 věty na míru** (`{{NA_MIRU}}`), co ukážou, že si pamatuješ jeho
   konkrétní situaci — ne generika.
3. Nabídni **čerstvé nastavení na míru** (aktuální makra/kroky/priority navázané na to, co
   mu fungovalo) — Martin připraví po krátkém zjištění, kde klient teď je. **Konkrétní
   čísla NEVYMÝŠLEJ** — vždy jako návrh ke schválení Martinem.
4. Rámuj jako **dárek bez háčku** + měkká pozvánka zpět ke spolupráci. Žádný deadline, tlak
   (viz `../STYLE_GUIDE.md` § Prodejní filozofie).

## Po akci
Zapiš do CRM `win-back: odesláno {{datum}}` / `vrátil se`. Při návratu → onboarding
(`../templates/onboarding-template.html`) + založ/aktualizuj klienta.

## Zásady
- Tón: vřelý, osobní, BEZ tlaku a výčitek. „Život se děje, dveře máš otevřené."
- Ceny/fakta z `../KNOWLEDGE_BASE.md`. Žádné sliby konkrétních kg/termínů.
