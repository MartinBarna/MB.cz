# Šablony e-mailů (zachování přesné kostry)

> **Proč to existuje:** Martinovy odpovědi na check-iny mají konkrétní formát —
> grafickou hlavičku/patičku, formátování a **prokliky** (databáze příloh, videa pro
> klienty, podcast, sociální sítě). Když se kostra nezachová, klient pozná, že
> odpovídal agent. **Pravidlo: kostru NIKDY neměň — vyměň jen obsah.**

## `check-in-template.html`

Doslovná HTML kostra reálného check-in mailu, vytažená z Gmailu (odeslaná zpráva).
Obsahuje:
- formátování (tučné/kurzíva, odstavce) přesně jako Martin píše,
- patičku „MARTIN BARNA — online výživa a fitness",
- **prokliky** na: databázi příloh (Google Drive), videa/videokurz pro klienty,
  podcast (Apple + Spotify), YouTube playlist, FB / IG / TikTok / LinkedIn.

### Jak ji agent používá

1. Vezmi `check-in-template.html` jako základ (`htmlBody` v `create_draft`).
2. **Nahraď jen personalizovaný obsah** — text mezi pozdravem a patičkou:
   - oslovení („Přeju super den, [jméno]!"),
   - komentář k datům + pochvala,
   - nové cíle do tabulek (kcal / B / S / T / vláknina / kroky).
3. **Nech beze změny:** veškeré formátování, patičku a všechny `href` odkazy.
4. Případnou citovanou původní zprávu klienta (pod podpisem) smaž.

> Když si u HTML nejsi jistý, radši zachovej celou kostru a uprav pouze textové uzly
> s obsahem; nepřepisuj `<a href=…>`, styly ani tabulky patičky.

## Další šablony

- `onboarding-template.html` — uvítací mail nového klienta („informace na první týden").
- `poptavka-template.html` — odpověď na poptávku (Gold/Diamond + CTA na hovor/WhatsApp).
- `retence-prodlouzeni.html` — prodloužení spolupráce (retence).
- `reengagement-poptavka.html` — jemný follow-up zájemce, co se neozval.
- `doprodej-videokurz.html` — doprodej videokurzu (599 Kč, trvalý kód START599) po lead magnetu.

(Posledních pět = čisté verze. Použití retence/doprodej viz `../playbooks/retence-doprodej.md`.)

**Retence/provoz:** `nudge-report.html` (popostrčení na chybějící report),
`recenze-prubeh.html` a `recenze-konec.html` (sběr recenzí) — viz `../playbooks/`.

**Nurture série** (`nurture-series/`): 4 vlny lead-magnet funnelu — `vlna-1.html` (doručení
plánu), `vlna-2.html` (7 chyb + soft videokurz), `vlna-3.html` (kuchařka + videokurz 599 Kč,
trvalý kód START599), `vlna-4.html` (pozvánka na koučing). Placeholder `{{JMENO}}`.

> Obě jsou zatím **čisté verze** (vlastní HTML, ne vytažené z Gmailu). Pro byte-přesnou
> shodu s Martinovým formátem a jeho trackovanými prokliky nech Martina označit reálný
> onboarding/poptávkový mail v Gmailu a vytáhni z něj kostru stejně jako u `check-in-template.html`.
> Placeholdery `{{...}}` agent nahradí obsahem; ceny ber z `../KNOWLEDGE_BASE.md`.
