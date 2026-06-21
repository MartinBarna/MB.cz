# Playbook: SBĚR RECENZÍ / REFERENCÍ

Recenze = nejlevnější marketing. Spokojený klient → hodnocení/reference → víc nových klientů.
Agent připraví žádost ve správný moment; Martin schválí a odešle.

## Kdy žádat

1. **V průběhu — po skvělém výsledku.** Když klient nahlásí super report/milník (výrazný
   úbytek, rekordní váha, „konečně mi sedí kalhoty"), je ideální chvíle. Šablona `../templates/recenze-prubeh.html`.
2. **Na konci spolupráce.** Poděkování + žádost o referenci + nasměrování kam ji dát.
   Šablona `../templates/recenze-konec.html`.

## Review radar (automatický spouštěč)
Při ranní rutině / churn radaru (`churn-radar.md`) agent všímá **🟢 klientů, co právě hlásí
milník** (rekord váhy, větší úbytek měr, nadšený tón) → navrhne do briefingu „ideální chvíle
požádat o recenzi" + připraví draft `recenze-prubeh.html`. Pravidlo proti přehlcení:
**max 1 žádost za ~2 měsíce na klienta** (sleduj `recenze` v CRM). Nikdy 2× po sobě.

## Kam recenzi nasměrovat (doplň reálné odkazy)
- Google profil firmy, Facebook, Instagram (story/označení), případně web/testimonials.
- `>>> DOPLNIT:` konkrétní odkaz na Google recenze / formulář.

## Zásady
- Žádej, jen když je klient **prokazatelně spokojený** (z reportů/komunikace). Nikdy po stížnosti.
- Usnadni to: 1 jasný krok + odkaz. Krátké.
- S dovolením lze (anonymně nebo s jeho svolením) výsledek použít v obsahu — viz `../content/README.md`.
- Nikdy nezveřejňuj data/jména klienta bez výslovného souhlasu.

## Po akci
Zapiš do CRM `recenze: požádáno {{datum}}` / `recenze: hotovo`.
