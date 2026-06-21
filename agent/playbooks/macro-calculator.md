# Playbook: MAKRO KALKULAČKA (startovací makra pro nového klienta)

Cíl: z onboarding dotazníku spočítat **startovací makra** (kcal + B/S/T + vláknina + kroky)
deterministicky a konzistentně — ať Martin neřeší výpočet u každého klienta ručně. Stejné
mantinely jako check-in (`check-in.md`). **Výstup je vždy NÁVRH ke schválení**, ne dogma.

> Důležité: tohle je startovací odhad, ne lékařská/dietní preskripce. Tělo rozhodne — kalibruje
> se podle reálných reportů (`report-parsing.md` → `check-in.md`). Logiku úprav drž jednotnou.

## Vstupy (z dotazníku)
Pohlaví · věk · výška (cm) · váha (kg) · cíl (hubnutí / udržení / nabírání) · aktivita
(sedavá / lehká / střední / vysoká) · zdravotní omezení · zkušenost se zápisem jídla.

## Postup výpočtu
1. **BMR (Mifflin–St Jeor):**
   - Muži: `10·kg + 6,25·cm − 5·věk + 5`
   - Ženy: `10·kg + 6,25·cm − 5·věk − 161`
2. **TDEE = BMR × faktor aktivity:** sedavá 1,3 · lehká 1,45 · střední 1,6 · vysoká 1,75.
3. **Cílové kcal:**
   - Hubnutí: **TDEE − 15 %** (mírný deficit; raději pomaleji + kroky než tvrdý řez).
   - Udržení: TDEE.
   - Nabírání: **TDEE + 10 %**.
4. **Bílkoviny:** **1,8–2,2 g/kg** (default 2,0 g/kg; u vyšší váhy/nadváhy spíš dle cílové váhy).
5. **Tuky:** **0,8–1,0 g/kg** (default 0,9 g/kg).
6. **Sacharidy:** dopočítej ze zbytku kcal (1 g B/S = 4 kcal, 1 g T = 9 kcal).
7. **Vláknina:** ~**14 g na 1000 kcal** (cca 25–38 g/den).
8. **Kroky:** start dle aktivity — sedavá **8 000**, lehká **10 000**, střední+ **12 000/den**.

## Mantinely (bezpečnost — shodné s check-in.md)
- **Nikdy pod ~1 100 kcal (ženy) / ~1 300 kcal (muži).** Když výpočet padne pod → zvedni na floor a **eskaluj** k Martinovi.
- Deficit nikdy > ~20 % na startu. Začínej konzervativně — dolů se jde vždycky líp než nahoru.
- Sacharidy/tuky jsou orientační („ignoruj kolečko, hlídáme hlavně kcal + bílkoviny").

## Výstup (interní, ke schválení)
```
>>> STARTOVACÍ MAKRA (návrh ke schválení) — {{jméno}}
TDEE ~{{x}} kcal → cíl {{y}} kcal ({{deficit/udržení/surplus}})
B {{}} g · S {{}} g · T {{}} g · vláknina {{}} g · kroky {{}}/den
Pozn.: {{floor/aktivita/zdraví}}
```
Po schválení vlož do onboarding mailu (`../templates/onboarding-template.html`) a do CRM (`aktuální makra`).

## Hranice (eskalovat, NEpočítat)
- Těhotenství/kojení, ED/PPP v anamnéze, cukrovka/štítná žláza/léky ovlivňující váhu,
  výrazná nadváha/podváha, nezletilí → **nepočítej automaticky, eskaluj.** Martin nastaví ručně.
