# Lead funnel + e-mail coaching — master plán (ke schválení)

Tenhle dokument shrnuje celý e-mailový ekosystém pro leady a free-tier
registrované. **Texty jsou hotové v `*.sql` souborech** (Cowork je jen spustí
v Supabase). Ty si přečti tenhle přehled, schval / uprav, a pak to jde živě.

Bezpečnost: žádný Resend/service-role klíč není v repu. Slevové kódy musí
existovat v SimpleShopu (NEPOUŽÍVAT testovací `hackerman`).

---

## 1) Hlavní sekvence „lead-magnet" (stáhl plán zdarma)

Začátek je **prodejní náběh** (už existoval), nově navazuje **hodnotový
long-tail** (`drip-longtail.sql`) — ať lidi neodpadnou a zůstanou v teple měsíce.

| Krok | Den | Předmět | Cíl |
|---|---|---|---|
| 0 | 0 | Tady máš svůj plán 💪 | doručení PDF |
| 1 | 2 | Chyba č. 1, na které lidi shoří | edukace + důvěra |
| 2 | 4 | Jak jíst řízek a pizzu a stejně zhubnout | hodnota + 1. free lekce |
| 3 | 6 | Chceš to celé, krok za krokem? | 1. nabídka videokurzu |
| 4 | 9 | mám pro Tebe −15 % | sleva (kód) |
| 5 | 14 | poslední šance −20 % | sleva 2 |
| **6** | **19** | **Tajná zbraň hubnutí (spánek)** | **long-tail: hodnota** |
| **7** | **31** | **Nemusíš běhat (kroky/NEAT)** | hodnota |
| **8** | **45** | **Kdybys měl[a] řešit jen jednu věc (bílkoviny)** | hodnota |
| **9** | **59** | **Co je uvnitř videokurzu (bez keců)** | měkká re-nabídka |
| **10** | **73** | **Proč většina diet selže** | hodnota |
| **11** | **87** | **Chceš to vzít se mnou? (konzultace/koučink)** | 1:1 nabídka |
| **12** | **101** | **Svatba, oslava, pátek… (alkohol)** | hodnota |
| **13** | **115** | **Když se nechce. Co s tím. (mindset)** | hodnota |
| **14** | **129** | **Díky, že tu jsi 🙏 (+ affiliate)** | wrap + doporučení |

→ ~4 měsíce kontaktu, mix přesně jak jsi chtěl: pár dní náběh, pak hodnota
1× za ~2 týdny. Každý mail = 1 užitečná věc + měkká výzva. Odkazy vedou na
reálné články na webu (ověřeno, žádné 404).

`existing-leadmagnet` track (kdo už PDF má) zůstává jak byl — kratší bridge.

---

## 2) Dynamické slevy — „aktivní, ale nekupuje" (#36)

Soubor: `dynamic-discount.sql`. Nový track **`active-no-buy`** (3 maily).

**Kdo se kvalifikuje (automaticky, denní cron):**
- má účet (registrace do free tieru) starší **14 dní**
- **přihlásil se** za posledních 30 dní (= pořád ho to zajímá)
- **nemá** zaplacený přístup (videokurz ani Academy)
- ještě není v `leads` (neklobrcujeme běžící sekvenci)

| Krok | Den | Předmět | Cíl |
|---|---|---|---|
| 0 | 0 | Vidím, že to bereš vážně 👀 | uznání + měkká nabídka |
| 1 | 5 | za tu snahu máš −X % | personalizovaná sleva |
| 2 | 12 | poslední šance na tu slevu | dotlačení |

Pointa: kdo se aktivně hrabe ve free obsahu, dostane „odměnu za snahu" →
psychologicky mnohem silnější než plošná sleva.

**Cowork:** ověřit názvy sloupců proti DB, poprvé spustit `enroll_active_no_buy()`
ručně a zkontrolovat, koho to nabralo.

---

## 3) 🆕 Automatizovaný e-mail COACHING (check-in systém) — tvůj nápad

Tohle je podle mě **nejsilnější věc z celého funnelu** — dává leadovi *pocit
kontroly a pokroku*, a tím ho dovede ke koupi přirozeně. Opt-in (přihlásí se
sám z úvodního mailu), ne automaticky.

> **Zároveň je to TRAILER na placený Coaching s Martinem.** Automatický check-in
> je ochutnávka toho, jaké to je mít kontroly a vedení. V mailech to říkáme
> narovinu: tohle umí robot — *„a teď si představ, že tě takhle hlídám [[sama||sám]],
> dostupný na WhatsAppu a mailu, plán na míru jen pro tebe."* → upsell na koučink.

### Jak to funguje (smyčka 1× týdně)
1. **Mail s check-inem** → klikne na tlačítko „Vyplnit check-in" (30 vteřin).
2. **Formulář** (naklikání, ne psaní): váha, pás, boky, průměr kroků/den,
   počet tréninků, dodržení plánu (1–5), spánek (1–5), jak se cítí (1–5).
3. **Příští mail je na míru** podle toho, co vyplnil — pochvala za pokrok +
   1 konkrétní věc na příští týden (pravidla níž). Cítí, že ho někdo vede.
4. **Odměna „po troškách":** za každý vyplněný check-in se načítá **kredit na
   slevu** (např. +30 Kč), za milníky výsledků bonus (např. −2 cm pás = +100 Kč).
   Kredit se sčítá až do stropu (např. 50 % ceny). Dřív nebo později koupí —
   a navíc má výsledky, takže koupí rád.

### Pravidla doporučení (rule-based, Cowork implementuje decision tree)
| Vstup | Doporučení do dalšího mailu |
|---|---|
| váha ↓ + dodržení vysoké | pochvala, „jedeš skvěle, drž to" + 1 tip navíc |
| váha stojí + kroky nízké | „přidej 1500 kroků denně", odkaz na článek o NEAT |
| váha stojí + dodržení nízké | bez kázání: „vyber 1 jídlo denně, kde přidáš bílkovinu" |
| váha ↑ + dodržení vysoké | „nepanikař, voda kolísá — řešíme týdenní průměr" |
| spánek ≤ 2 | tip na spánek (odkaz na článek), je to brzda hubnutí |
| pocit ≤ 2 | empatie + zmenši krok, „stačí dnešek" + pohyb na náladu |
| 4 check-iny v řadě | milník: pochvala + připomenutí nasbírané slevy |

### Co postavím já (statický web — moje doména)
- **Stránka check-in formuláře** `/akademie/check-in/` — naklikávací, brandovaná,
  mobilní. Posílá data do Supabase funkce.
- E-mailové šablony pro track `coaching` (pozvánka + týdenní check-in + na míru).

### Co musí postavit Cowork (backend)
- tabulka `checkins` (user/email, datum, váha, pás, boky, kroky, tréninky, skóre)
- tabulka `discount_credits` (e-mail, nasbíraný kredit, strop)
- funkce `checkin-capture` (uloží + spočítá kredit + naplánuje další mail)
- decision tree z tabulky výše (vybere blok doporučení do dalšího mailu)

→ Tohle je větší věc. Navrhuju: **schval mechaniku** (kredity, stropy, pravidla),
já mezitím postavím formulář + šablony, Cowork dopojí backend.

---

## Co potřebuju od tebe (rozhodnutí)
1. **Slevy:** % a kódy pro `lead-magnet` krok 4/5 a `active-no-buy` (musí být v SimpleShopu).
2. **Check-in odměny:** kolik Kč za check-in, jaké milníky, jaký strop slevy.
3. Schválení textů (klidně „ok, jeď" — DB je zdroj pravdy, doladit jde kdykoliv).

## Co předat Coworkovi (až schválíš)
1. Spustit `drip-longtail.sql` + `dynamic-discount.sql` v Supabase SQL editoru.
2. Backend check-in systému (tabulky + funkce výše).
3. `leads.phone` + redeploy `unsubscribe` + SimpleShop PRODUCT_MAP (z dřívějška).
