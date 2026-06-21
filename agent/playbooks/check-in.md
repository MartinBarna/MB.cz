# Playbook: CHECK-IN (týdenní report klienta)

Cíl: připravit draft odpovědi na týdenní report — **povzbudit, okomentovat data a
navrhnout úpravu maker/kroků**. Finální čísla vždy schvaluje Martin.

> Klíčový princip: úprava stojí na DATECH klienta z reportu/Excelu. Konkrétní logika
> úprav (kdy zvednout/snížit kcal, jak reagovat na stagnaci/hlad/nepřesnost) je v
> `../training-data/check-in-examples.md` — před návrhem maker se do ní podívej.

## 1. Co z reportu vytáhnout (vstupy)

- **Váha** a její změna za týden (+ rámec: první týden padá víc, kolísá 1–3 kg vodou).
- **Míry** (pas, boky, břicho, zadek, ruce…) — důležitější než váha.
- **Průměr kcal** za týden a **přesnost zápisu** (porce, ingredience).
- **Bílkoviny, vláknina, kroky/pohyb.**
- **Subjektivní:** hlad, únava, síla, trénink minulý týden + plán na další.

## 2. Logika úpravy (rozhodovací tabulka — detaily v training-data)

Nejdřív urči, do které situace klient spadá, a navrhni odpovídající krok. **Default: když si
nejsi jistý nebo je to hraniční → DRŽ KURZ** (neměň). Méně zásahů = míň přepisování pro Martina.

| Situace (z reportu) | Návrh úpravy |
|---|---|
| Hubne v dobrém tempu (~0,5–1 % váhy nebo ~1 cm na hlavní míře/týden) | **Drž kurz**, neměň. „Jedeme náš základ co funguje, nekomplikujme to." |
| **Stagnace 2+ týdny** při poctivém zápisu | **−100 až −150 kcal** (ze sacharidů) **NEBO +1 000–2 000 kroků/den**. Raději pohyb než hladovění. Naráz měň jen JEDNU páku. |
| **Hlad / přejídání / víc snědeno** | Makra neškrtej; „díky datům to hladce dorovnáme". Zvaž **+ bílkoviny/vláknina** pro sytost. |
| **Nepřesný zápis** | Priorita = přesnost, makra neměň. „Čím přesnější zápis, tím vyšší cíl Ti můžu nechat a pořád to půjde dolů." |
| **Rychlý úbytek** (>1 %/týden dlouhodobě) | Neměň dolů; realisticky zarámuj (kolísání, nebude takhle pořád). |
| Váha nahoru, ale míry dolů / menstruace / sůl | **Drž kurz**, vysvětli (voda), neřeš jako přírůstek. |

**Mantinely čísel (bezpečnost):**
- **Nikdy pod ~1 100 kcal (ženy) / ~1 300 kcal (muži)** — pod tím neměň, eskaluj.
- Jeden krok úpravy ≤ ~150 kcal nebo ~2 000 kroků/týden (žádné velké skoky).
- **Bílkoviny ~1,8–2,2 g/kg.** Kroky jako týdenní průměr/den (např. „13 000/den").
- Sacharidy/tuky: „ignoruj kolečko, je nám jedno jak vyjde."
- Před uložením draftu projeď checklist v `../tests/safety-triggers.md` (sekce B).

## 3. Struktura draftu (Martinův vzorec)

1. „Přeju bomba den, [jméno]! Děkuji za report i Tvou trpělivost…"
2. Pochvala / nakopnutí („Já jsem na Tebe tak pyšný! Masakr — nejen váha, i míry.").
3. Komentář k datům + realistický rámec.
4. Princip jednoduchosti a návyku.
5. **Nové cíle do tabulek:** `kcal`, `bílkoviny g`, `sacharidy g`, `tuky g`, `vláknina g`,
   `kroky`. (Sacharidy/tuky: „ignoruj kolečko, je nám jedno jak vyjde.")
6. Krátké „proč" + pozvánka k feedbacku („pokud bys preferoval vyšší hranici, napiš").
7. Podpis (klientská varianta).

> **DŮLEŽITÉ — formát:** Check-in odpověď generuj z přesné kostry
> `../templates/check-in-template.html` (`htmlBody`). Zachovej VEŠKERÉ formátování
> a prokliky (databáze příloh, videa, podcast, sociální sítě) — měň pouze obsah
> (pozdrav, komentář k datům, nové cíle). Klient pozná agenta, když se kostra změní.
> Detaily v `../templates/README.md`.

> Všechna navržená čísla v draftu označ jako návrh: na konec přidej interní poznámku
> `>>> KE SCHVÁLENÍ: kcal/B/S/T/kroky` — ať je Martin vědomě potvrdí.

## 4. Hranice (eskalovat)

- Zdravotní potíže, těhotenství, léky, psychika, PPP → neměnit makra, eskalovat.
- Klient nespokojený / chce končit / vrátit peníze → eskalovat.
- Data nedávají smysl / chybí → nehádej, napiš poznámku Martinovi + případně klientovi
  slušně dožádej chybějící údaje.
