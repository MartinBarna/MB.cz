# Shopify → automatický onboarding/dodání

Cíl: nová objednávka (videokurz, VIP balíček, konzultace) → agent rovnou připraví
dodací/onboarding mail, ať zákazník nečeká.

## Co je potřeba
- Napojený Shopify (nástroje `list-orders`, `get-order` jsou k dispozici).
- Mapování produkt → akce (viz níže).

## Workflow
1. Agent najde **nové zaplacené objednávky** (`list-orders`, filtr na nové/zaplacené).
2. Podle produktu připraví draft:
   - **Videokurz** → mail s přístupem/odkazem + uvítání (krátké, „jak začít").
   - **VIP balíček** (videokurz + e-booky + recepty) → mail se všemi přístupy.
   - **Online konzultace / koučing** → onboarding (`../templates/onboarding-template.html`)
     + návrh termínu (`../playbooks/kalendar.md`).
3. Draft do Gmailu ke schválení; po odeslání zapiš do CRM/pipeline.

## Mapování produkt → akce (doplň reálné odkazy/přístupy)
| Produkt | Akce | `>>> DOPLNIT` |
|---|---|---|
| Videokurz flexibilního stravování | přístup do kurzu | odkaz + jak se přihlásit |
| VIP balíček | přístupy (kurz, e-booky, recepty) | seznam odkazů |
| Online konzultace 1990 / koučing | onboarding + termín | — |

## Zásady
- Vrácení peněz / reklamace / problém s platbou → **eskalace**, ne automatika.
- Fakta a ceny z `../KNOWLEDGE_BASE.md`. Přístupové odkazy drž bezpečně (ne do repa).
