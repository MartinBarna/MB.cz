# Barna Academy / martinbarna.cz — pracovní pravidla

Statický web (deploy na Wedos přes GitHub Actions `deploy-wedos.yml`) + Supabase backend
(přístupy, leady, zákazníci, e-maily). Vyvíjí se na větvi `claude/learn-claude-code-tay5rb`.

## ⚠️ STANDING RULE: počty na prodejních stránkách musí VŽDY sedět

Kdykoliv přidáš nebo odebereš **lekci/modul Academy**, **video videokurzu** nebo **přílohu**,
**automaticky (bez připomenutí) aktualizuj počty na landing/prodejních stránkách**, ať vždy
odpovídají realitě. Nečekej, až na to někdo upozorní.

Použij jeden příkaz — zná pravdivá čísla z filesystému a opraví je všude:

```
node scripts/sync-academy-counts.js
```

- Počítá: Academy lekce (`akademie/studium/m*-l*`), Academy moduly (distinct `m\d+`),
  videokurz videa (`akademie/videokurz/v*`).
- Přepíše počty v: `akademie/index.html`, `akademie/objednavka/`, `akademie/videokurz/`,
  `akademie/prihlaseni/`, `akademie/moje/`, `akademie/studium/`, `akademie/_videokurz/build.js`,
  `assets/academy-upsell.js`, `videokurz.html`.
- Bezpečné: nahrazuje přesně předchozí zaznamenané číslo (`scripts/.academy-counts.json`),
  takže nemíchá 212 lekcí Academy s 182 videi videokurzu.
- Po přidání lekce do studia ji **také zařaď do `CURRICULUM`** v `akademie/studium/index.html`
  (a nový modul tamtéž), pak spusť skript a deployni.
- Materiály (počet PDF) skript zatím neřeší — při změně počtu materiálů zkontroluj ručně
  i `materialy/index.html`, `materialy/rebrand/index.html` a zmínky „X PDF" v Academy copy.

## Deploy (každá hotová změna)

1. commit na `claude/learn-claude-code-tay5rb` → push
2. PR (draft) → ready → merge (squash)
3. spustit workflow `deploy-wedos.yml` na `ref: main`
4. re-sync větve: `git fetch origin main && git reset --hard origin/main && git push --force`

Před deployem ověř render lokálně (chromium + lokální server na :8099), 0 JS chyb.

## Bezpečnost / GDPR

- E-maily/jména klientů jen do Supabase, **nikdy seznam adres do chatu** — jen počty.
- Veřejné JS smí mít jen **anon** Supabase klíč; service_role / Resend klíč nikdy do repa.
- Patička marketingových mailů vždy s odhlášením (`unsubscribe` edge funkce).

## ⚠️ STANDING RULE: rozesílka e-mailů — VŽDY nejdřív TEST na Martina

Před **každým** ostrým/hromadným odesláním (i když Martin řekne „pošli to finálně"):
1. **Nejdřív pošli TEST verzi na `fitness.barna@gmail.com`** (obě varianty, pokud jich je víc).
2. Počkej, až Martin **výslovně potvrdí „pošli ostro"**.
3. Teprve pak odešli na seznam.

Nikdy neposílej na ostro bez předchozího test-mailu, který Martin viděl. (Je občas uspěchaný —
tohle ho donutí zkontrolovat a chrání to u stovek příjemců.) České znaky v edge funkcích piš
jako **reálné UTF-8**, ne `\u` kódy — překlep `ď`(ď)→`ğ`(ğ) udělal „teď" → „teğ".

## Supabase (projekt „Barna Academy", ref uhmrpfsdcujbhbtumqye)

- Přístup = `public.entitlements` (email, product `academy`|`videokurz`, active). RPC `has_entitlement`
  páruje přes e-mail z JWT (case-insensitive); academy ⇒ i videokurz.
- Marketingové kontakty = `public.customer_contacts` (oddělené od `leads`). Segmenty přes `tags`:
  `early-customer` (WordPress kupci), `manual-add`, `coaching-active`, `coaching-ex`.
  Pojistka proti duplicitám mailů: `onboarding_sent_at`.
- Edge funkce: `lead-capture`, `drip-send`, `unsubscribe`, `videokurz-onboarding`.
- Registrace je autoconfirm (bez potvrzování e-mailu). Auth SMTP je rozbité (reset hesla /
  magic-link nefungují, dokud se nenahradí SMTP creds) — neblokuje onboarding (signup heslem).
