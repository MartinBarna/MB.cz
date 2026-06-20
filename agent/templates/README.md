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

## Doplnit (volitelně)

- `poptavka-template.html` — pokud Martin používá grafickou šablonu i na poptávky.
- `onboarding-template.html` — uvítací mail „informace na první týden".

Až mi takový mail označíš v Gmailu, vytáhnu z něj kostru stejným způsobem.
