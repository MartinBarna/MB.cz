# Long-term mailing plán H2 2026 — návrh (14. 7. 2026)

> Cíl: z existujícího listu a nových leadů vytěžit maximum tržeb do konce roku (videokurz 800 Kč,
> Academy 8 900 → 12 900 Kč, koučink 1:1), aniž by list vyhořel. Dnes VŠECHNY sekvence končí
> terminálem (den 12–54) a lead pak navždy mlčí — tenhle plán to mění na trvalý vztah.
> Stav listu 14. 7.: ~119 aktivních consumer leadů, 14 trenérů, 23 existing, 368 legacy kupců
> videokurzu (onboarding-videokurz), 32 coaching onboarding. Vše přes drip engine (email_templates
> + hodinový cron), Resend Pro, dark-gold šablona.

## 1) `longtail-consumer` — evergreen nurture po dojetí consumer sekvencí

**Pro koho:** leady s dojetou sekvencí `lead-magnet`, `existing-leadmagnet`, `lead-magnet-tool`
(status active, next_send_at IS NULL) + později dojetí `onboarding-videokurz` (368 kupců = nejcennější pool).
**Rytmus:** 2× měsíčně (wait_days 14), 12 mailů = ~6 měsíců obsahu, pak volitelně kolo 2.
**Vzorec:** hodnota → hodnota → prodej (H-H-P). Každý mail = jedno prakticky podané téma
(recyklace nejlepšího blog obsahu do mailové formy, ne odkazovník) + JEDEN jasný CTA.

| # | Den | Téma (pracovní) | CTA / poznámka |
|---|-----|------------------|----------------|
| 1 | 0   | Víkendové přejídání: týdenní průměr | 🎁 dárek: PDF „Jak zvládnout víkendové přejídání" + odkaz na článek |
| 2 | 14  | Proč se váha zasekne (a co s tím) | kalkulačka zdarma (engagement) |
| 3 | 28  | Cheat day vs. cheat meal | videokurz (soft) |
| 4 | 42  | Spánek: skrytá páka hubnutí | článek + appka zmínka |
| 5 | 56  | Bílkoviny prakticky (talíř, ne vzorce) | videokurz (soft) |
| 6 | 70  | **PRODEJ: videokurz akce** | ✅ jediná sleva v sekvenci, Omnibus-safe |
| 7 | 84  | Jojo efekt: proč se kila vrací | koučink (soft) |
| 8 | 98  | Jíst večer? Mýty o časování | kalkulačka / článek |
| 9 | 112 | 🎁 dárek #2 (mini-PDF checklist, vyrobíme nový) | budování reciprocity |
| 10| 126 | Restaurace, oslavy, dovolená | videokurz (soft) |
| 11| 140 | Co bych dělal já, kdybych začínal dnes | koučink (přímý, osobní mail) |
| 12| 154 | **PRODEJ: Academy / Tvůj Coach appka** | ✅ terminál kola 1 |

## 2) `longtail-trener` — trenéři po `trener-kit` (den 12+)

**Rytmus:** měsíčně, 6 mailů. Trenérská matematika a praxe, každý mail tlačí na Academy jinou pákou.

| # | Téma | Páka |
|---|------|------|
| 1 | Kolik si reálně vydělá trenér (počty z článku) | Academy jako zkratka |
| 2 | Case study: první klient z kitu | sociální důkaz |
| 3 | AI pro trenéry (M24 — nikdo jiný v ČR neučí) | diferenciátor Academy |
| 4 | Appka Tvůj Coach pro tvoje klienty | Academy = nástroje v ceně |
| 5 | Generátory jídelníčků/tréninků v praxi | ušetřený čas = peníze |
| 6 | **PRODEJ: zaváděcích 8 900 končí u 50. člena** | ✅ reálná urgence (pak 12 900) |

## 3) Promo kalendář H2 2026 (jednorázové kampaně na celý list)

| Měsíc | Akce | Poznámka |
|-------|------|----------|
| srpen | „Letní reset" — videokurz −20 % na 7 dní | Omnibus: 30 dní předtím žádná nižší cena |
| září  | Academy: „zbývá X míst za 8 900" | reálný stav k 50. prodeji; po 50. zdražit na 12 900 (připomínka z paměti!) |
| říjen | Koučink: otevírám Q4 kapacitu | high-ticket před Vánoci |
| listopad | Black Friday — JEDINÁ velká sleva roku | bundle videokurz + konzultace? rozhodne Martin |
| prosinec | Dárkový poukaz (Vánoce) → 29. 12.–15. 1. novoroční nábor | největší fitness okno roku — plná palba Academy + koučink |

## 4) Infra (po schválení)

- copy do `email_templates` (track `longtail-consumer` / `longtail-trener`), dark-gold šablona (fn-* styling),
  vokativ personalizace, gender bloky [[sama||sám]] kde segment jistý.
- enroll edge fn `longtail-enroll` + pg_cron denně (přesune dojeté active leady, vyloučí purchased/unsub/coaching).
- stop podmínka: nákup → přeřazení do onboarding tracku (už funguje přes simpleshop-webhook).
- měřit: open/click v resend-webhook (už sbíráme), prodeje přes entitlements.

## 5) Pravidla

- Omnibus u každé slevy (uvést nejnižší cenu za 30 dní / nesnižovat před akcí).
- Hlas: mb-email-voice-methodology (učíme vážit a zapisovat; plurál „bílkoviny"; žádný AI-slop).
- Frekvence stropu: nikdy víc než 1 mail/týden na osobu napříč tracky (longtail se pozastaví během promo kampaně).
- Nepsat nic, co slibuje výsledky bez práce; safety témata (PPP, léky) do mailů nepatří.
