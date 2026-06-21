# Napojení Shopify (videokurz / produkty)

Cíl: propojit prodej **videokurzu** (a dalších produktů) s agentem — aby nákup spustil
onboarding e-maily, doprodej a měření, ne aby to leželo ladem. Stav: **plán** (viz níže).

## Stav přístupu
Obchod existuje, ale teď **není dostupný přes API** (billing/plán Shopify). Pro aktivaci je
potřeba vyřešit fakturaci / upgradnout plán a povolit API. Do té doby běží ručně.

## Co agent bude umět (po aktivaci API)
1. **Nové objednávky videokurzu** → spustit **post-purchase sérii** (díky za nákup, jak začít,
   tip, jemný upsell na koučing) — drafty dle STYLE_GUIDE, nic se neodešle samo.
2. **Doprodej / opuštěný košík** → navázat na `../templates/doprodej-videokurz.html`.
3. **Upsell videokurz → koučing** — kdo koupil kurz a je aktivní, je teplý lead na Gold/Diamond
   (napoj na `lead-engine.md` a `../playbooks/` poptávku). Soft tón, hodnota napřed.
4. **Měření:** kolik nákupů, z jakého zdroje (FB ads → `fb-ads-monitoring.md`), konverze kurz→koučing.
5. **Sklad/ceny:** ceny produktů musí sedět s `../KNOWLEDGE_BASE.md` (kontroluje `monthly-audit.md`).

## Zásady
- Ceny/nabídky jen z `KNOWLEDGE_BASE.md`. Agent **needituje obchod ani neodesílá maily bez OK.**
- Osobní/platební data zákazníků **do repa nedávat** — jen agregát.

## Další krok
Až bude obchod API-ready, ověř přes `get-shop-info` a doplň sem reálné ID produktů videokurzu.
