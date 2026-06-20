# Jak agenta provozovat (Claude Max — bez API)

Dva režimy, oba běží na tvém **Claude Max** předplatném (ne přes API).

## A) On-demand (hned, z mobilu i z webu)
- Otevři **Claude appku / chat** (nebo Cowork) s napojeným **Gmail + Drive konektorem**.
- Napiš: **„Projdi maily"** (nebo „sync").
- Agent projede schránku, vytřídí šum, připraví **drafty** do Konceptů a dá ti **briefing**.
- Ty otevřeš Koncepty, zkontroluješ, odešleš. Nic se neodešle samo.

## B) Ranní automatika (Routine v Coworku)
Běží v cloudu i se zavřeným mobilem, čerpá z Max předplatného.

**Nastavení (jednorázově):**
1. Jdi na **claude.ai/code/routines** (Cowork → Routines).
2. Vytvoř novou rutinu, připoj **toto repo** (martinbarna/mb.cz) + **Gmail/Drive konektory**.
3. Trigger = **Schedule** → např. **každý všední den 8:00** (klidně přidej i 12:00).
4. Do promptu vlož text níže. Ulož.

**Hotový prompt do rutiny (zkopíruj):**
```
Jsi asistent Martina Barny. Řiď se soubory v agent/ (AGENT_PROMPT, STYLE_GUIDE,
KNOWLEDGE_BASE, playbooks/). Proveď ranní sweep podle playbooks/sync.md a triage.md:
1) Projdi nezodpovězené maily, vytřiď šum, zařaď (check-in / poptávka / onboarding / eskalace).
2) Připrav DRAFTY odpovědí v Gmailu podle příslušných playbooků a šablon (templates/).
   Check-in z přesné kostry templates/check-in-template.html.
3) Zkontroluj spouštěče: nudge na chybějící report, retence (končí paušál), win-back
   (ukončení 2–7 měs zpět) — podle CRM Sheetu. U win-backu drž SOFT tón (STYLE_GUIDE
   § Prodejní filozofie) a dárek jako hodnotu na míru.
4) Aktualizuj CRM (poslední report, makra, stav) — navrhni změny ke schválení.
5) NIC NEODESÍLEJ. Na konci dej krátký briefing dle playbooks/briefing.md.
```

**Limity / poznámky:**
- Routines jsou research preview; je denní strop počtu spuštění (viz claude.ai/settings/usage).
- Konektory Gmail/Drive vyžadují Pro/Max (máš ✓).
- Vše zůstává **draft-only** — odesíláš ty (dokud sám nezapneš auto-send u jasných případů).

## C) 24/7 vč. WhatsappU
Potřebuje WhatsApp Business API + automatizační vrstvu — viz `integrations/whatsapp-setup.md`.
(To je jediná část, kterou Routines/Max samy nepokryjí, protože jde o cizí kanál.)

## Jak Claude pozná, že má být agentem (ne generický Claude)

Není to detekce klíčových slov. Claude se chová jako **tvůj** agent jen když má **načtené
instrukce z tohoto repa** (`CLAUDE.md` + soubory v `agent/`). Ty obsahují pravidla
(nikdy neodesílat, ceny jen z KNOWLEDGE_BASE, přesné šablony, soft sell, eskalace) a tvůj
tón. Bez nich by „obyčejný" Claude maily zvládl taky — ale **genericky a bez mantinelů**
(může vymyslet cenu, netrefit tón, nepoužít kostru). Proto je důležité, **odkud** ho pustíš:

| Odkud | Načte se agent automaticky? |
|---|---|
| **Cowork (claude.ai/code) na tomhle repu** | **ANO** — `CLAUDE.md` se načte sám. Stačí „projdi maily". |
| **Routine (B)** s připojeným repem | **ANO** — prompt navíc odkazuje na `agent/`. |
| **Obyčejná Claude appka / chat** (bez repa) | **NE** — je to generický Claude. Musíš mu agenta dodat (viz níže). |

**Doporučení:** dělej režim A i z **Coworku** (má i mobil) — tam se mozek načte sám.
Pokud chceš jet z běžné Claude appky, založ si v ní **Projekt** a vlož do „custom
instructions" obsah `AGENT_PROMPT.md` + klíčové z `KNOWLEDGE_BASE.md`/`STYLE_GUIDE.md`;
pak se každý chat v tom Projektu chová jako agent. (Cowork je ale jednodušší — vše je už tam.)

---

## Doporučení
Začni **A** (pár dní si osahej drafty), pak zapni **B** (ranní rutina). C až budeš chtít WhatsApp.
