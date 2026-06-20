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

## Zásady
- Žádná osobní data do repa — pipeline je v Sheetu/Notionu.
- Lead-magnet leady (formulář) řeší funnel; do pipeline dávej spíš teplé/koučink leady.
- Citlivé → eskalace.
