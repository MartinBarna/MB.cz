# Playbook: CHURN RADAR (včasné varování u aktivních klientů)

Cíl: podchytit klienta **dřív, než odejde**. Udržet aktivního klienta je levnější a
snazší než ho pak lákat zpět (`win-back.md`). Tohle doplňuje:
- `nudge-reporty.md` (řeší jen *chybějící* report),
- `retence-doprodej.md` (řeší jen *konec paušálu*),
- `win-back.md` (řeší až *po* odchodu).

Churn radar řeší to mezi tím: **klient pořád jede, ale vyhasíná.** Princip jako všude:
**agent připraví podnět/koncept, Martin rozhodne.** Agent NIKDY nepíše „mám pocit, že
chceš skončit" — to by churn urychlilo. Výstup je **interní flag pro Martina**, ne mail klientovi.

## Signály rizika (čti z check-in vláken + CRM)

Ohodnoť každého aktivního klienta. Riziko roste, když se sejde víc signálů:

**Zapojení (chování):**
- Reporty chodí **později a později** (prodlužuje se rozestup oproti jeho normálu).
- Report je **čím dál kratší / odbytý** („nestihl jsem", „tento týden nic moc", bez tabulek).
- **Vynechané cally** nebo opakované přesouvání.
- Přestal reagovat na WhatsApp / hlasovky (pokud to víš).

**Tón / obsah (sentiment):**
- Únava, frustrace, rezignace: „nejde mi to", „nemá to cenu", „pořád stejný", „jsem línej",
  „nemám čas", „možná to není pro mě".
- **Stagnace** výsledků 3+ týdny + klesající motivace v textu.
- Náznak konce: „uvidíme, jak to půjde dál", „možná si dám pauzu", „zatím nevím, jestli budu pokračovat".
- Životní zásah (práce, stěhování, nemoc v rodině) → ne nespokojenost, ale riziko vypadnutí.

**CRM/časování:**
- `konec_pausalu` < ~3 týdny a zapojení slabé → spojený risk (předej i do `retence-doprodej.md`).
- Dlouhodobě aktivní klient, u kterého poprvé naskočí výše uvedené → ber vážně (kontrast s normálem).

> **Zdraví ≠ churn.** Únava/rezignace spojená se zdravím, psychikou, PPP, těhotenstvím →
> **NENÍ churn radar, je to ESKALACE** (`AGENT_PROMPT.md`, `tests/safety-triggers.md`).
> Needituj makra, jen krátký flag „k ručnímu vyřízení".

## Skóre a co s tím

| Riziko | Kdy | Akce agenta |
|---|---|---|
| 🟢 OK | žádný/jeden slabý signál | nic, jen běžný check-in |
| 🟡 Sleduj | 1–2 signály | do briefingu: „🟡 {{jméno}} — {{signál}}". Štítek `MB-Agent/At-risk`. CRM `poznamka`. |
| 🔴 Akce | 3+ signálů / jasný náznak konce | **flag nahoru** + návrh kroku (viz níže). Štítek `MB-Agent/At-risk`. |

**U 🔴 agent NEPÍŠE prodejní/„nezdrhej" mail.** Navrhne Martinovi 1 z:
1. **Osobní call / hlasovka** od Martina (nejsilnější retenční nástroj) — agent připraví jen
   poznámku „zavolej, poslední 2 reporty vlažné, motivace dole".
2. **Měkký, povzbudivý check-in draft** navázaný na to, co klientovi DŘÍV šlo (vrátit pocit
   pokroku, ulevit od tlaku: „pojďme to teď zjednodušit na 2 věci"). Žádná výčitka, žádná urgence.
3. **Úprava očekávání** — když je problém stagnace, navrhni Martinovi revizi cíle/přístupu
   (čísla vždy `>>> KE SCHVÁLENÍ`, nikdy od oka).

## Po akci
Zapiš do CRM `poznamka` (datum + signál + co navrženo). Když se klient zvedne → smaž flag.
Když i přes to směřuje ke konci → po ukončení přejde do `win-back.md` (s odstupem).

## Zásady
- Výstup churn radaru je **interní** (briefing / CRM / štítek), ne mail klientovi.
- Tón případného draftu: vřelý, odlehčující tlak, value-first (`STYLE_GUIDE.md` § Prodejní filozofie).
- Při pochybnosti (zdraví, citlivé) → `MB-Agent/Eskalace`, ne draft.
