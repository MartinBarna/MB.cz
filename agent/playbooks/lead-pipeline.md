# Playbook: LEAD PIPELINE (přehled prodeje)

Cíl: vidět, kde lidi v prodeji jsou a kde padají. Jednoduchý přehled, který agent
aktualizuje. Žije v Sheetu/Notionu (ne v repu).

## Fáze (stavy)
`lead` → `kontakt/hovor domluven` → `po konzultaci` → `prodáno` → `onboardován` →
`aktivní` → `prodloužení` (nebo `ztracený` / `pauza` / `ukončeno`).

## Schéma (sloupce)
| jmeno | kanál (web/FB/doporučení) | datum_leadu | fáze | balíček | další_krok | datum_dalšího_kroku | poznámka |

## Jak agent pracuje
1. **Nový lead/poptávka** → přidá řádek (`fáze = lead`), připraví draft odpovědi (`poptavka.md`).
2. **Posun** (domluven hovor, prodáno, onboardován) → aktualizuje fázi + další krok.
3. **Follow-up:** leady ve fázi `po konzultaci` bez posunu 3–7 dní → re-engagement
   (`../templates/reengagement-poptavka.html`), max 1–2×.
4. **Napojení na CRM:** jakmile je `prodáno → onboardován`, založ klienta v `../crm/`.

## Skórování leadů (priorita)
- 🔥 **HORKÝ** — ptá se na cenu / „jak začít" / chce konzultaci / silný záměr, **nebo čeká
  na odpověď**. Řeš dnes: draft odpovědi + nabídni termín callu (`../integrations/calendar-booking.md`).
- 🟡 **VLAŽNÝ** — obecný zájem, stáhl lead magnet, ptal se na info bez jasného „chci".
  Hodnotový follow-up + jemné CTA, zařaď do nurture.
- 🔵 **STUDENÝ** — starý/nejasný/jednorázový dotaz bez reakce. Jeden poslední dotek, pak archiv.

## Follow-up radar (SLA)
- **Lead napsal a nemá odpověď** → to je horké, ztracená příležitost, řeš hned.
- **Martin odepsal, lead mlčí > 5 dní** → jemný nudge draft (max 2×), pak studený.
- **Po stažení lead magnetu** den 2 / 5 / 12 → hodnotová série (napojení na content/maily).
- Gmail štítky pro vizuální frontu: `Lead/Hot`, `Lead/Warm`, `Lead/Cold`, `Lead/Follow-up`.

## Routina (týdně, po)
Projeď příchozí ~7–14 dní → aktualizuj snapshot, vypíchni 🔥 a „čeká na Martina".
Snapshot = tabulka `Jméno | Email | Skóre | Posl. zpráva | Kdo na tahu | Akce` (v odpovědi/Sheetu).

## Zásady
- Žádná osobní data do repa — pipeline je v Sheetu/Notionu.
- Lead-magnet leady (formulář) řeší funnel; do pipeline dávej spíš teplé/koučink leady.
- Citlivé → eskalace.
