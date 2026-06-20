# Playbook: WHATSAPP (dotazy klientů)

> Stav: WhatsApp **zatím není napojený** (nemáme k němu nástroj). Tento playbook
> definuje, jak agent WhatsApp dotazy zpracuje, až bude kanál připojený, a jak
> mezitím funguje „ruční režim".

## Ruční režim (dnes)

Když Martinovi přijde WhatsApp dotaz, může ho zkopírovat sem (nebo nadiktovat) a agent
připraví návrh odpovědi podle stejných pravidel jako u e-mailu. Martin ho pak vloží do
WhatsApp a odešle.

## Styl pro WhatsApp

- **Kratší a neformálnější než e-mail.** Tykání, „Nazdar [jméno]!", emoji `:)`.
- Bez plného podpisu — stačí „Martin" / „Be Effective!".
- Jedna myšlenka, rychlá a konkrétní odpověď. Když je téma velké, odkázat na materiál
  (videokurz, příloha, e-book) nebo nabídnout, že to rozeberou u check-inu.
- Fakta (ceny, odkazy) jen z `KNOWLEDGE_BASE.md`.

## Typické dotazy a jak na ně

- „Můžu si dát [jídlo/alkohol]?" → ano v rámci kalorií, zapsat; krátké vysvětlení.
- „Nehubnu, co s tím?" → klid + zkontrolovat přesnost zápisu/kroky; detail necháme na check-in.
- „Jak na bílkoviny/vlákninu?" → konkrétní tip + odkaz na kuchařku/aplikaci.
- Objednávka/změna balíčku/platba → **eskalovat na Martina**.
- Zdravotní téma → **eskalovat**, neradit.

## Roadmapa napojení (Fáze 4)

Pro autonomní WhatsApp je potřeba:
1. **WhatsApp Business API** — přes Metu napřímo nebo poskytovatele (Twilio, 360dialog,
   Infobip). Běžné číslo z WhatsApp aplikace na automatizaci nestačí.
2. **Propojovací vrstva** (n8n / Make / vlastní webhook), která: přijme zprávu → zavolá
   agenta → uloží návrh odpovědi ke schválení (např. do Gmailu/Slacku/tabulky).
3. **Schvalovací krok** (stejně jako u mailů: nejdřív drafty, auto-odesílání až po ověření).

Náklady: WhatsApp Business API se účtuje za konverzace + poplatek poskytovateli; přesně
upřesníme podle zvoleného poskytovatele, až se do toho pustíme.
