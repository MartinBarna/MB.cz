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

## 2. Logika úpravy (rámec — detaily v training-data)

- Hubne v dobrém tempu (~0,5–1 % váhy nebo ~1 cm na hlavní míře/týden) → **drž kurz**,
  neměň zbytečně. „Jedeme náš základ co funguje, nekomplikujme to."
- **Stagnace** při poctivém zápisu → mírně sniž kcal nebo přidej kroky (raději pohyb než
  hladovění; cíl je hubnout na co nejvyšším příjmu).
- **Hlad/přejídání nebo více snědeno** → dorovnat v reportu, nekárat; „díky datům to
  hladce dorovnáme". Zvážit vyšší bílkoviny/vlákninu pro sytost.
- **Nepřesný zápis** → priorita je přesnost; „čím přesnější zápis, tím vyšší cíl Ti můžu
  nechat a pořád to půjde dolů".
- **Rychlý úbytek** → realisticky zarámovat (nebude takhle pokračovat, neděs se výkyvů).
- Bílkoviny typicky ~1,8–2,2 g/kg; kroky nastavit jako týdenní průměr (např. „13 000/den").

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
