# Kontrast světlého režimu

Automatický běh `scripts/kontrola-kontrastu-temat.mjs`.

## Metodika

- Lokální statický server nad kořenem repa, headless Chrome, viewport **390×844** (mobil, tam Martin našel osnovu videokurzu).
- Motiv: `localStorage.mb-theme` = `light` | `dark` (stejný klíč jako `theme-boot.js` / `ba-theme.js`).
- U každého viditelného textového uzlu: WCAG 2 kontrast *computed color* vs. efektivní pozadí (rodiče k prvnímu neprůhlednému; polotransparentní vrstvy a gradientové stopy se skládají, u gradientu se bere nejhorší stopa).
- Práh **2,0**. Pod ním je text prakticky nečitelný (bílá na krému). Není to WCAG AA 4,5.
- Tmavý motiv se v CSS nesmí změnit: otisk nálezů tmavého před opravou a po opravě musí být totožný.
- Přesměrovací stuby `go/` se neměří (`location.replace` na produkci, není to obsah webu).
- SVG `<text>` se neměří (výplň kresby, ne sázecí text).

## Třída chyby (Martin: osnovové nadpisy na /videokurz)

Page-level kopie tmavého overlaye (`color:#fff` na `h5`/`h6`/`.module h6`/`.card h5`) **bez** brány `html:not([data-theme=light])`. Overlay `marketing-dark.css` ve světlém režimu vypne, page CSS dál maluje bíle na krém. Stejná třída: zlatý text (`#ebb12c` / `var(--brand)` / `var(--gold)`) na krému a leftover `--muted` z tmavého tokenu. Oprava je jen v `theme-light.css` / `ba-theme-light.css` pod `[data-theme=light]`. Tmavý motiv ta pravidla nevidí.

## Finální stav

| Motiv | Nálezů pod 2,0 | Poznámka |
|---|---:|---|
| světlý | **131** | cíl: 0 |
| tmavý | 868 | otisk totožný s baseline před opravou |

### Důkaz: tmavý motiv beze změny

- SHA-256 před: `8733a68758626d0041369d99365743e73147c065a6f0522f6858233d154e8a9a`
- SHA-256 po: `8733a68758626d0041369d99365743e73147c065a6f0522f6858233d154e8a9a`
- Počet před / po: 868 / 868
- **TOTOŽNÉ**

Světlý režim před opravou: **2226** nálezů pod 2,0. Po opravě: **131**.

Martinův případ `/videokurz.html` (osnova `.module h6`, bílé nadpisy na krému): **0** nálezů pod 2,0.
Zbývající nálezy už skoro nejsou „bílá na krému“, ale zlatý akcent (`#ebb12c` / `#f6cd63`) na krému (poměr cca 1,3–1,9) a pár tmavých ostrovů, kam spadl ink z globálního `h2`/`h5`. Tmavý motiv se nezměnil.

## Skupiny selektorů (světlý)

| Výskytů | Stránek | Selektor (zkrácený) | Příklad textu | Barvy | Pomer |
|---:|---:|---|---|---|---:|
| 6 | 2 | `footer > a` | Hlavní web | #f6cd63 na #f7f3eb | 1.37 |
| 6 | 1 | `#nastroje > div.wrap > div.tools > div.tool > a.tcta` | Vyzkoušet zdarma → | #f6cd63 na #ffffff | 1.52 |
| 4 | 1 | `#jak > div.container > div.steps > div.step.rv > div.num` | 1 | #ebb12c na #ebb12c | 1 |
| 4 | 1 | `div.container > div.bento > div.bcard.rv > div.links > a` | Plán pro ženy 30+ → | #ebb12c na #ffffff | 1.93 |
| 4 | 1 | `div.container > div.contact-grid > div > div.socials > a` | IG | #6b4e08 na #713564 | 1.13 |
| 4 | 1 | `section.acad > div.wrap > div.nums > div.num > b` | 24 | #ebb12c na #ffffff | 1.93 |
| 4 | 1 | `#cena > div.wrap > div.nums > div.num > b` | 6 | #ebb12c na #ffffff | 1.93 |
| 4 | 1 | `div.wrap > div.card > div.step > div > b` | Vyzkoušíš zdarma. | #ffffff na #ffffff | 1 |
| 3 | 1 | `div.wrap > div.grid > div.col > ul.ticks > li` | 13+ let praxe | #161310 na #15171a | 1.03 |
| 3 | 1 | `div.wrap > ul > li > a` | zásady ochrany osobních údajů | #f6cd63 na #f7f3eb | 1.37 |
| 3 | 1 | `#nabidka > div.wrap > div.offers.offers-more > div.offer.sm > span.tag` | Celá knihovna | #f6cd63 na #f5e9cd | 1.26 |
| 3 | 1 | `#nastroje > div.wrap > div.tools > div.tool > span.inacad` | V Academy | #f6cd63 na #ffffff | 1.52 |
| 3 | 1 | `div.wrap > div.plans.plans-3 > div.incl-pair > div.incl > b` | Chceš VIP na celý rok? Zvaž Barnu Academy. | #f6cd63 na #f7f3eb | 1.37 |
| 2 | 1 | `#refMain > div.ref-deal > div.d > div.tit` | Videokurz výživy | #b7ab9b na #f6eede | 1.96 |
| 2 | 1 | `#refMain > div.ref-deal > div.d > div.big` | kamarád −10 % | #f6cd63 na #f6eede | 1.32 |
| 2 | 1 | `#rozcestnik > div.container > div.bento > div.bcard.rv > span.tag` | Zdarma na start | #f6cd63 na #fcf5e4 | 1.4 |
| 2 | 1 | `div.contact-grid > div > ul.clist > li > a` | +420 603 229 831 | #6b4e08 na #5e1a4f | 1.57 |
| 2 | 2 | `div.wrap > div.about > div > p > strong` | Be Effective! | #f6cd63 na #f7f3eb | 1.37 |
| 2 | 1 | `div.sheet > div.pad > div.warn > b` | ⚠️ Pro trenéra: | #ff8f8f na #fdefef | 1.96 |
| 2 | 2 | `#obsah > div.wrap > div.grid > div.col > span.ar-kick` | Pro trenéry a výživové poradce | #ebb12c na #f7f3eb | 1.75 |
| 2 | 2 | `div.wrap > div.grid > div.col > div.kitbox > div.khead` | Co je v kitu | #f6cd63 na #ffffff | 1.52 |
| 2 | 1 | `#cena > div.wrap > div > blockquote > span` | ★★★★★ | #ebb12c na #ffffff | 1.93 |
| 2 | 1 | `div.wrap > div.plans.plans-3 > div.plan > p.bonus > b` | Videokurz výživy zdarma k první platbě | #f6cd63 na #fdf7ea | 1.42 |
| 1 | 1 | `#ukazky > div.container > p.uk-note > a` | Otevřít Academy → | #6b4e08 na #5e1a4f | 1.57 |
| 1 | 1 | `#srovnani > div.container > div.sec-head > span.ac-tag` | SROVNÁNÍ | #ffffff na #ebb12c | 1.93 |
| 1 | 1 | `#cena > div.container > p > strong` | zakládajícího člena | #e8d8c8 na #f7f3eb | 1.26 |
| 1 | 1 | `#zajem > div.container > div.pricebox > div.vk-guarantee > span` | Academy je krytá | #1a4a2a na #1f2c1e | 1.43 |
| 1 | 1 | `#app > div.ci-loyal > div.lt` | Tvoje věrnostní sleva | #161310 na #0c0c0c | 1.06 |
| 1 | 1 | `#loyStreak` | - | #161310 na #0c0c0c | 1.06 |
| 1 | 1 | `#fmtSegs > button.seg` | Story / Reel 9:16 | #cfc6b8 na #ffffff | 1.69 |
| 1 | 1 | `#bgSegs > button.seg` | Světlé | #cfc6b8 na #ffffff | 1.69 |
| 1 | 1 | `div.wrap > div.rules` | 1) Nikdy do AI nedávej jméno, kontakt ani fotku klienta. Piš | #e9e2d8 na #f6eede | 1.12 |
| 1 | 1 | `#byznys > h2 > span.badge-free` | 🔓 Ochutnávka zdarma | #8fdca4 na #dbe9d6 | 1.29 |
| 1 | 1 | `#onboarding > div.lockbox > span` | 🔒 Další 2 prompty této kategorie odemkneš členstvím v Barna | #e9e2d8 na #f6eede | 1.12 |
| 1 | 1 | `#checkin > div.lockbox > span` | 🔒 Další 2 prompty této kategorie odemkneš členstvím v Barna | #e9e2d8 na #f6eede | 1.12 |
| 1 | 1 | `#strava > div.lockbox > span` | 🔒 Další 2 prompty této kategorie odemkneš členstvím v Barna | #e9e2d8 na #f6eede | 1.12 |
| 1 | 1 | `#trenink > div.lockbox > span` | 🔒 Další 2 prompty této kategorie odemkneš členstvím v Barna | #e9e2d8 na #f6eede | 1.12 |
| 1 | 1 | `#materialy > div.lockbox > span` | 🔒 Další 1 prompt této kategorie odemkneš členstvím v Barna  | #e9e2d8 na #f6eede | 1.12 |
| 1 | 1 | `#obsah > div.lockbox > span` | 🔒 Další 2 prompty této kategorie odemkneš členstvím v Barna | #e9e2d8 na #f6eede | 1.12 |
| 1 | 1 | `#reklamy > div.lockbox > span` | 🔒 Další 1 prompt této kategorie odemkneš členstvím v Barna  | #e9e2d8 na #f6eede | 1.12 |
| 1 | 1 | `#veda > div.lockbox > span` | 🔒 Další 2 prompty této kategorie odemkneš členstvím v Barna | #e9e2d8 na #f6eede | 1.12 |
| 1 | 1 | `#demoNote > a` | ukázkové lekce | #ffffff na #f6eedc | 1.16 |
| 1 | 1 | `div.wrapc > article > div.keybox > strong` | V kostce: | #ebb12c na #f6eede | 1.68 |
| 1 | 1 | `div.wrapc > article > div.vs-cols > div.vc.yes > h4` | Naplánovaný vyšší den | #f6cd63 na #f7f3ec | 1.38 |
| 1 | 1 | `#obsah > div.container > div.hero-grid > div > span.kick` | Online výživa a fitness · od roku 2013 | #ebb12c na #f7f3eb | 1.75 |
| 1 | 1 | `div.container > div.hero-grid > div > h1 > span.gold` | Zdravě a natrvalo. | #ebb12c na #f7f3eb | 1.75 |
| 1 | 1 | `div.container > div.pgrid > div.pcard.cta-card.rv > div.in > b` | 600+ proměn | #ebb12c na #ffffff | 1.93 |
| 1 | 1 | `#jak > div.container > div.steps-cta.rv > span.or > a` | nezávazně napiš | #ebb12c na #f7f3eb | 1.75 |
| 1 | 1 | `div.container > div.bento > div.wide.rv > div > span.tag` | Videokurz | #f6cd63 na #fcf5e4 | 1.4 |
| 1 | 1 | `#reference > div.container > div.rev-sum.rv > span.big` | 5,0 ★ | #ebb12c na #ffffff | 1.93 |
| 1 | 1 | `#kontakt > div.container > div.contact-grid > div > span.kick` | První krok je zpráva | #6b4e08 na #5e1a4f | 1.57 |
| 1 | 1 | `#kontakt > div.container > div.contact-grid > div > p.sub` | Napiš mi a domluvíme si | #5c564c na #5e1a4f | 1.66 |
| 1 | 1 | `section.hero > div.wrap > div > div.price-tag > span.now` | 2 990 Kč | #161310 na #121014 | 1.02 |
| 1 | 1 | `div.grid.g2 > div.card.fit.no > ul > li > a` | koučink | #f6cd63 na #ffffff | 1.52 |
| 1 | 1 | `#objednavka > div.wrap > div.vip > div.vt > b` | V ceně konzultace máš navíc: | #f6cd63 na #f7f4ec | 1.38 |
| 1 | 1 | `#odecet > div.wrap > div.konz > b.t` | 🎁 A fakticky zdarma, když to myslíš vážně | #f6cd63 na #ffffff | 1.52 |
| 1 | 1 | `section.sec > div.wrap > div.konz > b.t` | 🎁 Konzultace 2 990 Kč. A fakticky zdarma, když to myslíš vá | #f6cd63 na #ffffff | 1.52 |
| 1 | 1 | `#balicky > div.wrap > div > p > strong` | videokurzem za 800 Kč | #ffffff na #f7f3ec | 1.1 |
| 1 | 1 | `#obsah > div.wrap > div.grid > div.col > h1` | Jez chutně, do sytosti. | #ffffff na #f7f3eb | 1.11 |
| 1 | 1 | `div.wrap > div.grid > div.col > h1 > span.hl` | začni hubnout. | #ebb12c na #f3eee4 | 1.67 |
| 1 | 1 | `#obsah > div.wrap > div.grid > div.col > p.sub` | Stáhni si zdarma 7denní makro plán pro ženy 30+. Konkrétní j | #ffffff na #f7f3eb | 1.11 |
| 1 | 1 | `div.wrap > div.grid > div.col > p > span` | ★★★★★ | #f6cd63 na #f3eee4 | 1.31 |
| 1 | 1 | `#obsah > div.wrap > div.grid > div.col > p` | 5,0 · 100+ recenzí na Googlu a Facebooku · plán ti přijde na | #ffffff na #f7f3eb | 1.11 |
| 1 | 1 | `#obsah > div.wrap > div.grid > div.col > p.micro` | Pošlu ti ho na e-mail a pár dní nato i bonusy (7 chyb + rych | #ffffff na #f7f3eb | 1.11 |
| 1 | 1 | `section.ref-proof > div > h2` | Co píšou klientky | #161310 na #0c0b10 | 1.06 |
| 1 | 1 | `div.wrapc > p.intro` | Kolem hubnutí a fitness koluje víc mýtů než kdekoliv jinde.  | #cabfb4 na #f7f3eb | 1.63 |
| 1 | 1 | `div.box > div.znacka` | Martin Barna | #ebb12c na #ffffff | 1.93 |
| 1 | 1 | `#nabidka > div.wrap > div.offers.offers-top > div.offer.best > span.tag` | Nejčastější volba | #f6cd63 na #f5e9cd | 1.26 |
| 1 | 1 | `#nabidka > div.wrap > div.offers.offers-top > div.offer > span.tag` | Dárek pod tisícovku | #f6cd63 na #f5e9cd | 1.26 |
| 1 | 1 | `div.offers.offers-more > div.offer.sm > ul > li > a` | běžného ceníku | #f6cd63 na #f7f4ec | 1.38 |
| 1 | 1 | `#kit > div.wrap > p > a` | část lekcí Barna Academy je otevřená zdarma | #f6cd63 na #f3eee4 | 1.31 |
| 1 | 1 | `section.acad > div.wrap > span.ar-kick` | Až budeš chtít celý systém | #ebb12c na #f3eee4 | 1.67 |
| 1 | 1 | `#cena > div.wrap > span.ar-kick` | Celý balík na jednom místě | #ebb12c na #f7f3eb | 1.75 |
| 1 | 1 | `#cena > div.wrap > p > span` | ★★★★★ | #ebb12c na #f7f3eb | 1.75 |
| 1 | 1 | `#cena > div.wrap > p > a` | Část lekcí i nástrojů je otevřená zdarma | #f6cd63 na #f7f3eb | 1.37 |
| 1 | 1 | `section > div.wrap > span.ar-kick` | Ještě nechceš platit? | #ebb12c na #f3eee4 | 1.67 |
| 1 | 1 | `div.wrap > div.hl` | Příklad: 20 lidí na appce VIP = přes | #f0eadf na #f6eedc | 1.03 |
| 1 | 1 | `div.wrap > div.hl > strong` | 2 500 Kč měsíčně | #f0eadf na #f6eedc | 1.03 |
| 1 | 1 | `div.wrap > main > p.sub > strong` | zdarma | #f6cd63 na #f7f3eb | 1.37 |
| 1 | 1 | `div.wrap > main > p.beff` | Be Effective! | #ebb12c na #f7f3eb | 1.75 |

## Nálezy po prvcích (světlý, poměr < 2,0)

| Stránka | Selektor | Text | Popředí | Pozadí | Pomer | Motiv |
|---|---|---|---|---|---:|---|
| akademie/index.html | `#ukazky > div.container > p.uk-note > a` | Otevřít Academy → | #6b4e08 | #5e1a4f | 1.57 | light |
| akademie/index.html | `#srovnani > div.container > div.sec-head:nth-of-type(1) > span.ac-tag` | SROVNÁNÍ | #ffffff | #ebb12c | 1.93 | light |
| akademie/index.html | `#cena > div.container > p:nth-of-type(2) > strong` | zakládajícího člena | #e8d8c8 | #f7f3eb | 1.26 | light |
| akademie/index.html | `#zajem > div.container > div.pricebox:nth-of-type(2) > div.vk-guarantee:nth-of-type(2) > s` | Academy je krytá | #1a4a2a | #1f2c1e | 1.43 | light |
| akademie/moje/check-in/index.html | `#app > div.ci-loyal:nth-of-type(1) > div.lt:nth-of-type(2)` | Tvoje věrnostní sleva | #161310 | #0c0c0c | 1.06 | light |
| akademie/moje/check-in/index.html | `#loyStreak` | - | #161310 | #0c0c0c | 1.06 | light |
| akademie/moje/doporuc/index.html | `#refMain > div.ref-deal:nth-of-type(5) > div.d:nth-of-type(1) > div.tit:nth-of-type(1)` | Videokurz výživy | #b7ab9b | #f6eede | 1.96 | light |
| akademie/moje/doporuc/index.html | `#refMain > div.ref-deal:nth-of-type(5) > div.d:nth-of-type(1) > div.big:nth-of-type(2)` | kamarád −10 % | #f6cd63 | #f6eede | 1.32 | light |
| akademie/moje/doporuc/index.html | `#refMain > div.ref-deal:nth-of-type(5) > div.d:nth-of-type(2) > div.tit:nth-of-type(1)` | Academy pro trenéry | #b7ab9b | #f6eede | 1.96 | light |
| akademie/moje/doporuc/index.html | `#refMain > div.ref-deal:nth-of-type(5) > div.d:nth-of-type(2) > div.big:nth-of-type(2)` | kamarád −10 % | #f6cd63 | #f6eede | 1.32 | light |
| akademie/nastroje/infografika/index.html | `#fmtSegs > button.seg:nth-of-type(2)` | Story / Reel 9:16 | #cfc6b8 | #ffffff | 1.69 | light |
| akademie/nastroje/infografika/index.html | `#bgSegs > button.seg:nth-of-type(2)` | Světlé | #cfc6b8 | #ffffff | 1.69 | light |
| akademie/nastroje/prompty/index.html | `div.wrap:nth-of-type(2) > div.rules:nth-of-type(1)` | 1) Nikdy do AI nedávej jméno, kontakt ani fotku klienta. Piš | #e9e2d8 | #f6eede | 1.12 | light |
| akademie/nastroje/prompty/index.html | `#byznys > h2 > span.badge-free` | 🔓 Ochutnávka zdarma | #8fdca4 | #dbe9d6 | 1.29 | light |
| akademie/nastroje/prompty/index.html | `#onboarding > div.lockbox:nth-of-type(2) > span` | 🔒 Další 2 prompty této kategorie odemkneš členstvím v Barna | #e9e2d8 | #f6eede | 1.12 | light |
| akademie/nastroje/prompty/index.html | `#checkin > div.lockbox:nth-of-type(2) > span` | 🔒 Další 2 prompty této kategorie odemkneš členstvím v Barna | #e9e2d8 | #f6eede | 1.12 | light |
| akademie/nastroje/prompty/index.html | `#strava > div.lockbox:nth-of-type(2) > span` | 🔒 Další 2 prompty této kategorie odemkneš členstvím v Barna | #e9e2d8 | #f6eede | 1.12 | light |
| akademie/nastroje/prompty/index.html | `#trenink > div.lockbox:nth-of-type(2) > span` | 🔒 Další 2 prompty této kategorie odemkneš členstvím v Barna | #e9e2d8 | #f6eede | 1.12 | light |
| akademie/nastroje/prompty/index.html | `#materialy > div.lockbox:nth-of-type(2) > span` | 🔒 Další 1 prompt této kategorie odemkneš členstvím v Barna  | #e9e2d8 | #f6eede | 1.12 | light |
| akademie/nastroje/prompty/index.html | `#obsah > div.lockbox:nth-of-type(2) > span` | 🔒 Další 2 prompty této kategorie odemkneš členstvím v Barna | #e9e2d8 | #f6eede | 1.12 | light |
| akademie/nastroje/prompty/index.html | `#reklamy > div.lockbox:nth-of-type(2) > span` | 🔒 Další 1 prompt této kategorie odemkneš členstvím v Barna  | #e9e2d8 | #f6eede | 1.12 | light |
| akademie/nastroje/prompty/index.html | `#veda > div.lockbox:nth-of-type(2) > span` | 🔒 Další 2 prompty této kategorie odemkneš členstvím v Barna | #e9e2d8 | #f6eede | 1.12 | light |
| akademie/prihlaseni/index.html | `#demoNote > a` | ukázkové lekce | #ffffff | #f6eedc | 1.16 | light |
| clanky/hubnuti-a-vek-mozku.html | `div.wrapc:nth-of-type(2) > article > div.keybox:nth-of-type(1) > strong` | V kostce: | #ebb12c | #f6eede | 1.68 | light |
| clanky/vikendove-prejidani.html | `div.wrapc:nth-of-type(2) > article > div.vs-cols:nth-of-type(3) > div.vc.yes:nth-of-type(1` | Naplánovaný vyšší den | #f6cd63 | #f7f3ec | 1.38 | light |
| forma-zpet/index.html | `div.wrap > div.grid > div.col:nth-of-type(1) > ul.ticks > li:nth-of-type(1)` | 13+ let praxe | #161310 | #15171a | 1.03 | light |
| forma-zpet/index.html | `div.wrap > div.grid > div.col:nth-of-type(1) > ul.ticks > li:nth-of-type(2)` | stovky klientů | #161310 | #15171a | 1.03 | light |
| forma-zpet/index.html | `div.wrap > div.grid > div.col:nth-of-type(1) > ul.ticks > li:nth-of-type(3)` | žádné zázraky, jen systém | #161310 | #15171a | 1.03 | light |
| index.html | `#obsah > div.container > div.hero-grid > div:nth-of-type(1) > span.kick` | Online výživa a fitness · od roku 2013 | #ebb12c | #f7f3eb | 1.75 | light |
| index.html | `div.container > div.hero-grid > div:nth-of-type(1) > h1 > span.gold` | Zdravě a natrvalo. | #ebb12c | #f7f3eb | 1.75 | light |
| index.html | `div.container > div.pgrid:nth-of-type(3) > div.pcard.cta-card.rv:nth-of-type(6) > div.in >` | 600+ proměn | #ebb12c | #ffffff | 1.93 | light |
| index.html | `#jak > div.container > div.steps:nth-of-type(2) > div.step.rv:nth-of-type(1) > div.num` | 1 | #ebb12c | #ebb12c | 1 | light |
| index.html | `#jak > div.container > div.steps:nth-of-type(2) > div.step.rv:nth-of-type(2) > div.num` | 2 | #ebb12c | #ebb12c | 1 | light |
| index.html | `#jak > div.container > div.steps:nth-of-type(2) > div.step.rv:nth-of-type(3) > div.num` | 3 | #ebb12c | #ebb12c | 1 | light |
| index.html | `#jak > div.container > div.steps:nth-of-type(2) > div.step.rv:nth-of-type(4) > div.num` | 4 | #ebb12c | #ebb12c | 1 | light |
| index.html | `#jak > div.container > div.steps-cta.rv:nth-of-type(3) > span.or > a` | nezávazně napiš | #ebb12c | #f7f3eb | 1.75 | light |
| index.html | `div.container > div.bento:nth-of-type(2) > div.wide.rv:nth-of-type(1) > div:nth-of-type(1)` | Videokurz | #f6cd63 | #fcf5e4 | 1.4 | light |
| index.html | `#rozcestnik > div.container > div.bento:nth-of-type(2) > div.bcard.rv:nth-of-type(2) > spa` | Zdarma na start | #f6cd63 | #fcf5e4 | 1.4 | light |
| index.html | `div.container > div.bento:nth-of-type(2) > div.bcard.rv:nth-of-type(2) > div.links > a:nth` | Plán pro ženy 30+ → | #ebb12c | #ffffff | 1.93 | light |
| index.html | `div.container > div.bento:nth-of-type(2) > div.bcard.rv:nth-of-type(2) > div.links > a:nth` | Plán pro muže 35+ → | #ebb12c | #ffffff | 1.93 | light |
| index.html | `div.container > div.bento:nth-of-type(2) > div.bcard.rv:nth-of-type(2) > div.links > a:nth` | Kalkulačka a generátory zdarma → | #ebb12c | #ffffff | 1.93 | light |
| index.html | `#rozcestnik > div.container > div.bento:nth-of-type(2) > div.bcard.rv:nth-of-type(4) > spa` | Appka | #f6cd63 | #fcf5e4 | 1.4 | light |
| index.html | `div.container > div.bento:nth-of-type(2) > div.bcard.rv:nth-of-type(4) > div.links > a` | Víc o appce → | #ebb12c | #ffffff | 1.93 | light |
| index.html | `#reference > div.container > div.rev-sum.rv:nth-of-type(3) > span.big:nth-of-type(1)` | 5,0 ★ | #ebb12c | #ffffff | 1.93 | light |
| index.html | `#kontakt > div.container > div.contact-grid > div:nth-of-type(1) > span.kick` | První krok je zpráva | #6b4e08 | #5e1a4f | 1.57 | light |
| index.html | `#kontakt > div.container > div.contact-grid > div:nth-of-type(1) > p.sub` | Napiš mi a domluvíme si | #5c564c | #5e1a4f | 1.66 | light |
| index.html | `div.contact-grid > div:nth-of-type(1) > ul.clist > li:nth-of-type(1) > a` | +420 603 229 831 | #6b4e08 | #5e1a4f | 1.57 | light |
| index.html | `div.contact-grid > div:nth-of-type(1) > ul.clist > li:nth-of-type(2) > a` | martin@martinbarna.cz | #6b4e08 | #5e1a4f | 1.57 | light |
| index.html | `div.container > div.contact-grid > div:nth-of-type(1) > div.socials > a:nth-of-type(1)` | IG | #6b4e08 | #713564 | 1.13 | light |
| index.html | `div.container > div.contact-grid > div:nth-of-type(1) > div.socials > a:nth-of-type(2)` | TT | #6b4e08 | #713564 | 1.13 | light |
| index.html | `div.container > div.contact-grid > div:nth-of-type(1) > div.socials > a:nth-of-type(3)` | YT | #6b4e08 | #713564 | 1.13 | light |
| index.html | `div.container > div.contact-grid > div:nth-of-type(1) > div.socials > a:nth-of-type(4)` | FB | #6b4e08 | #713564 | 1.13 | light |
| konzultace/index.html | `section.hero:nth-of-type(1) > div.wrap > div:nth-of-type(1) > div.price-tag:nth-of-type(1)` | 2 990 Kč | #161310 | #121014 | 1.02 | light |
| konzultace/index.html | `div.grid.g2 > div.card.fit.no:nth-of-type(2) > ul > li:nth-of-type(3) > a` | koučink | #f6cd63 | #ffffff | 1.52 | light |
| konzultace/index.html | `#objednavka > div.wrap > div.vip:nth-of-type(2) > div.vt > b` | V ceně konzultace máš navíc: | #f6cd63 | #f7f4ec | 1.38 | light |
| konzultace/index.html | `#odecet > div.wrap > div.konz > b.t` | 🎁 A fakticky zdarma, když to myslíš vážně | #f6cd63 | #ffffff | 1.52 | light |
| konzultace/index.html | `div.wrap > div.about > div > p:nth-of-type(3) > strong` | Be Effective! | #f6cd63 | #f7f3eb | 1.37 | light |
| koucing/index.html | `section.sec:nth-of-type(5) > div.wrap > div.konz > b.t` | 🎁 Konzultace 2 990 Kč. A fakticky zdarma, když to myslíš vá | #f6cd63 | #ffffff | 1.52 | light |
| koucing/index.html | `#balicky > div.wrap > div:nth-of-type(2) > p > strong` | videokurzem za 800 Kč | #ffffff | #f7f3ec | 1.1 | light |
| koucing/index.html | `div.wrap > div.about > div > p:nth-of-type(3) > strong` | Be Effective! | #f6cd63 | #f7f3eb | 1.37 | light |
| makro-plan/index.html | `#obsah > div.wrap > div.grid > div.col:nth-of-type(1) > h1` | Jez chutně, do sytosti. | #ffffff | #f7f3eb | 1.11 | light |
| makro-plan/index.html | `div.wrap > div.grid > div.col:nth-of-type(1) > h1 > span.hl` | začni hubnout. | #ebb12c | #f3eee4 | 1.67 | light |
| makro-plan/index.html | `#obsah > div.wrap > div.grid > div.col:nth-of-type(1) > p.sub:nth-of-type(1)` | Stáhni si zdarma 7denní makro plán pro ženy 30+. Konkrétní j | #ffffff | #f7f3eb | 1.11 | light |
| makro-plan/index.html | `div.wrap > div.grid > div.col:nth-of-type(1) > p:nth-of-type(2) > span` | ★★★★★ | #f6cd63 | #f3eee4 | 1.31 | light |
| makro-plan/index.html | `#obsah > div.wrap > div.grid > div.col:nth-of-type(1) > p:nth-of-type(2)` | 5,0 · 100+ recenzí na Googlu a Facebooku · plán ti přijde na | #ffffff | #f7f3eb | 1.11 | light |
| makro-plan/index.html | `#obsah > div.wrap > div.grid > div.col:nth-of-type(1) > p.micro:nth-of-type(3)` | Pošlu ti ho na e-mail a pár dní nato i bonusy (7 chyb + rych | #ffffff | #f7f3eb | 1.11 | light |
| makro-plan/index.html | `section.ref-proof:nth-of-type(9) > div > h2` | Co píšou klientky | #161310 | #0c0b10 | 1.06 | light |
| materialy/vstupni-dotaznik/index.html | `div.sheet:nth-of-type(2) > div.pad > div.warn:nth-of-type(10) > b:nth-of-type(1)` | ⚠️ Pro trenéra: | #ff8f8f | #fdefef | 1.96 | light |
| materialy/vstupni-dotaznik/index.html | `div.sheet:nth-of-type(2) > div.pad > div.warn:nth-of-type(10) > b:nth-of-type(2)` | před nastavením deficitu ho pošli za lékařem | #ff8f8f | #fdefef | 1.96 | light |
| myty/index.html | `div.wrapc:nth-of-type(2) > p.intro` | Kolem hubnutí a fitness koluje víc mýtů než kdekoliv jinde.  | #cabfb4 | #f7f3eb | 1.63 | light |
| obchodni-podminky/index.html | `div.wrap:nth-of-type(2) > ul:nth-of-type(1) > li:nth-of-type(4) > a` | zásady ochrany osobních údajů | #f6cd63 | #f7f3eb | 1.37 | light |
| obchodni-podminky/index.html | `div.wrap:nth-of-type(2) > ul:nth-of-type(2) > li:nth-of-type(1) > a` | martin@martinbarna.cz | #f6cd63 | #f7f3eb | 1.37 | light |
| obchodni-podminky/index.html | `div.wrap:nth-of-type(2) > ul:nth-of-type(2) > li:nth-of-type(2) > a` | martinbarna.cz/akademie/prihlaseni/ | #f6cd63 | #f7f3eb | 1.37 | light |
| pripominky-vypnuto/index.html | `div.box > div.znacka` | Martin Barna | #ebb12c | #ffffff | 1.93 | light |
| poukaz/index.html | `#nabidka > div.wrap > div.offers.offers-top:nth-of-type(1) > div.offer.best:nth-of-type(1)` | Nejčastější volba | #f6cd63 | #f5e9cd | 1.26 | light |
| poukaz/index.html | `#nabidka > div.wrap > div.offers.offers-top:nth-of-type(1) > div.offer:nth-of-type(2) > sp` | Dárek pod tisícovku | #f6cd63 | #f5e9cd | 1.26 | light |
| poukaz/index.html | `#nabidka > div.wrap > div.offers.offers-more:nth-of-type(2) > div.offer.sm:nth-of-type(1) ` | Celá knihovna | #f6cd63 | #f5e9cd | 1.26 | light |
| poukaz/index.html | `#nabidka > div.wrap > div.offers.offers-more:nth-of-type(2) > div.offer.sm:nth-of-type(2) ` | Na míru | #f6cd63 | #f5e9cd | 1.26 | light |
| poukaz/index.html | `div.offers.offers-more:nth-of-type(2) > div.offer.sm:nth-of-type(2) > ul > li:nth-of-type(` | běžného ceníku | #f6cd63 | #f7f4ec | 1.38 | light |
| poukaz/index.html | `#nabidka > div.wrap > div.offers.offers-more:nth-of-type(2) > div.offer.sm:nth-of-type(3) ` | Drobnost | #f6cd63 | #f5e9cd | 1.26 | light |
| pro-trenery/index.html | `#obsah > div.wrap > div.grid > div.col:nth-of-type(1) > span.ar-kick` | Pro trenéry a výživové poradce | #ebb12c | #f7f3eb | 1.75 | light |
| pro-trenery/index.html | `div.wrap > div.grid > div.col:nth-of-type(2) > div.kitbox > div.khead:nth-of-type(1)` | Co je v kitu | #f6cd63 | #ffffff | 1.52 | light |
| pro-trenery/index.html | `#kit > div.wrap > p > a` | část lekcí Barna Academy je otevřená zdarma | #f6cd63 | #f3eee4 | 1.31 | light |
| pro-trenery/index.html | `section.acad:nth-of-type(3) > div.wrap > span.ar-kick` | Až budeš chtít celý systém | #ebb12c | #f3eee4 | 1.67 | light |
| pro-trenery/index.html | `section.acad:nth-of-type(3) > div.wrap > div.nums > div.num:nth-of-type(1) > b` | 24 | #ebb12c | #ffffff | 1.93 | light |
| pro-trenery/index.html | `section.acad:nth-of-type(3) > div.wrap > div.nums > div.num:nth-of-type(2) > b` | 256 | #ebb12c | #ffffff | 1.93 | light |
| pro-trenery/index.html | `section.acad:nth-of-type(3) > div.wrap > div.nums > div.num:nth-of-type(3) > b` | 182 | #ebb12c | #ffffff | 1.93 | light |
| pro-trenery/index.html | `section.acad:nth-of-type(3) > div.wrap > div.nums > div.num:nth-of-type(4) > b` | ∞ | #ebb12c | #ffffff | 1.93 | light |
| pro-trenery/index.html | `footer > a:nth-of-type(1)` | Hlavní web | #f6cd63 | #f7f3eb | 1.37 | light |
| pro-trenery/index.html | `footer > a:nth-of-type(2)` | Barna Academy | #f6cd63 | #f7f3eb | 1.37 | light |
| pro-trenery/index.html | `footer > a:nth-of-type(3)` | Členská komunita | #f6cd63 | #f7f3eb | 1.37 | light |
| pro-vas/index.html | `#obsah > div.wrap > div.grid > div.col:nth-of-type(1) > span.ar-kick` | Nemusíš na to být trenér | #ebb12c | #f7f3eb | 1.75 | light |
| pro-vas/index.html | `div.wrap > div.grid > div.col:nth-of-type(2) > div.kitbox > div.khead:nth-of-type(1)` | Co si uděláš sám | #f6cd63 | #ffffff | 1.52 | light |
| pro-vas/index.html | `#nastroje > div.wrap > div.tools:nth-of-type(2) > div.tool:nth-of-type(1) > a.tcta` | Vyzkoušet zdarma → | #f6cd63 | #ffffff | 1.52 | light |
| pro-vas/index.html | `#nastroje > div.wrap > div.tools:nth-of-type(2) > div.tool:nth-of-type(2) > a.tcta` | Vyzkoušet zdarma → | #f6cd63 | #ffffff | 1.52 | light |
| pro-vas/index.html | `#nastroje > div.wrap > div.tools:nth-of-type(2) > div.tool:nth-of-type(3) > a.tcta` | Prohlédnout zdarma → | #f6cd63 | #ffffff | 1.52 | light |
| pro-vas/index.html | `#nastroje > div.wrap > div.tools:nth-of-type(2) > div.tool:nth-of-type(4) > span.inacad` | V Academy | #f6cd63 | #ffffff | 1.52 | light |
| pro-vas/index.html | `#nastroje > div.wrap > div.tools:nth-of-type(2) > div.tool:nth-of-type(4) > a.tcta` | Součást Academy → | #f6cd63 | #ffffff | 1.52 | light |
| pro-vas/index.html | `#nastroje > div.wrap > div.tools:nth-of-type(2) > div.tool:nth-of-type(5) > span.inacad` | V Academy | #f6cd63 | #ffffff | 1.52 | light |
| pro-vas/index.html | `#nastroje > div.wrap > div.tools:nth-of-type(2) > div.tool:nth-of-type(5) > a.tcta` | Součást Academy → | #f6cd63 | #ffffff | 1.52 | light |
| pro-vas/index.html | `#nastroje > div.wrap > div.tools:nth-of-type(2) > div.tool:nth-of-type(6) > span.inacad` | V Academy | #f6cd63 | #ffffff | 1.52 | light |
| pro-vas/index.html | `#nastroje > div.wrap > div.tools:nth-of-type(2) > div.tool:nth-of-type(6) > a.tcta` | Součást Academy → | #f6cd63 | #ffffff | 1.52 | light |
| pro-vas/index.html | `#cena > div.wrap > span.ar-kick` | Celý balík na jednom místě | #ebb12c | #f7f3eb | 1.75 | light |
| pro-vas/index.html | `#cena > div.wrap > div.nums:nth-of-type(1) > div.num:nth-of-type(1) > b` | 6 | #ebb12c | #ffffff | 1.93 | light |
| pro-vas/index.html | `#cena > div.wrap > div.nums:nth-of-type(1) > div.num:nth-of-type(2) > b` | 120 | #ebb12c | #ffffff | 1.93 | light |
| pro-vas/index.html | `#cena > div.wrap > div.nums:nth-of-type(1) > div.num:nth-of-type(3) > b` | Video | #ebb12c | #ffffff | 1.93 | light |
| pro-vas/index.html | `#cena > div.wrap > div.nums:nth-of-type(1) > div.num:nth-of-type(4) > b` | ∞ | #ebb12c | #ffffff | 1.93 | light |
| pro-vas/index.html | `#cena > div.wrap > p:nth-of-type(5) > span` | ★★★★★ | #ebb12c | #f7f3eb | 1.75 | light |
| pro-vas/index.html | `#cena > div.wrap > div:nth-of-type(2) > blockquote:nth-of-type(1) > span:nth-of-type(1)` | ★★★★★ | #ebb12c | #ffffff | 1.93 | light |
| pro-vas/index.html | `#cena > div.wrap > div:nth-of-type(2) > blockquote:nth-of-type(2) > span:nth-of-type(1)` | ★★★★★ | #ebb12c | #ffffff | 1.93 | light |
| pro-vas/index.html | `#cena > div.wrap > p:nth-of-type(7) > a` | Část lekcí i nástrojů je otevřená zdarma | #f6cd63 | #f7f3eb | 1.37 | light |
| pro-vas/index.html | `section:nth-of-type(4) > div.wrap > span.ar-kick` | Ještě nechceš platit? | #ebb12c | #f3eee4 | 1.67 | light |
| pro-vas/index.html | `footer > a:nth-of-type(1)` | Hlavní web | #f6cd63 | #f7f3eb | 1.37 | light |
| pro-vas/index.html | `footer > a:nth-of-type(2)` | Barna Academy | #f6cd63 | #f7f3eb | 1.37 | light |
| pro-vas/index.html | `footer > a:nth-of-type(3)` | Členská komunita | #f6cd63 | #f7f3eb | 1.37 | light |
| spoluprace/index.html | `div.wrap:nth-of-type(2) > div.card:nth-of-type(1) > div.step:nth-of-type(1) > div:nth-of-t` | Vyzkoušíš zdarma. | #ffffff | #ffffff | 1 | light |
| spoluprace/index.html | `div.wrap:nth-of-type(2) > div.card:nth-of-type(1) > div.step:nth-of-type(2) > div:nth-of-t` | Dostaneš vlastní kód a odkaz. | #ffffff | #ffffff | 1 | light |
| spoluprace/index.html | `div.wrap:nth-of-type(2) > div.card:nth-of-type(1) > div.step:nth-of-type(3) > div:nth-of-t` | Bereš provizi z každé platby. | #ffffff | #ffffff | 1 | light |
| spoluprace/index.html | `div.wrap:nth-of-type(2) > div.card:nth-of-type(1) > div.step:nth-of-type(4) > div:nth-of-t` | Dokud aktivně spolupracuješ, máš vše zdarma. | #ffffff | #ffffff | 1 | light |
| spoluprace/index.html | `div.wrap:nth-of-type(2) > div.hl:nth-of-type(2)` | Příklad: 20 lidí na appce VIP = přes | #f0eadf | #f6eedc | 1.03 | light |
| spoluprace/index.html | `div.wrap:nth-of-type(2) > div.hl:nth-of-type(2) > strong` | 2 500 Kč měsíčně | #f0eadf | #f6eedc | 1.03 | light |
| start/index.html | `div.wrap:nth-of-type(1) > main > p.sub:nth-of-type(1) > strong` | zdarma | #f6cd63 | #f7f3eb | 1.37 | light |
| start/index.html | `div.wrap:nth-of-type(1) > main > p.beff:nth-of-type(3)` | Be Effective! | #ebb12c | #f7f3eb | 1.75 | light |
| treninky.html | `section.text-center:nth-of-type(4) > div.container > h2.mb-3` | Pojďme začít trénovat | #161310 | #161616 | 1.02 | light |
| tvuj-coach/index.html | `div.wrap > div.plans.plans-3 > div.plan.featured:nth-of-type(1) > p.bonus:nth-of-type(2) >` | Videokurz výživy zdarma k první platbě. | #f6cd63 | #fdf7ea | 1.42 | light |
| tvuj-coach/index.html | `#cenik > div.wrap > div.plans.plans-3 > div.plan:nth-of-type(2) > span.ribbon` | S AI KOUČEM | #f0eadf | #ffffff | 1.2 | light |
| tvuj-coach/index.html | `div.wrap > div.plans.plans-3 > div.plan:nth-of-type(2) > p.bonus:nth-of-type(2) > b:nth-of` | Videokurz výživy zdarma k první platbě | #f6cd63 | #fdf7ea | 1.42 | light |
| tvuj-coach/index.html | `div.wrap > div.plans.plans-3 > div.plan:nth-of-type(2) > p.bonus:nth-of-type(2) > b:nth-of` | K ročnímu navíc měsíc Barna Academy na zkoušku | #f6cd63 | #fdf7ea | 1.42 | light |
| tvuj-coach/index.html | `div.wrap > div.plans.plans-3 > div.incl-pair:nth-of-type(5) > div.incl:nth-of-type(1) > b:` | Chceš VIP na celý rok? Zvaž Barnu Academy. | #f6cd63 | #f7f3eb | 1.37 | light |
| tvuj-coach/index.html | `div.wrap > div.plans.plans-3 > div.incl-pair:nth-of-type(5) > div.incl:nth-of-type(1) > b:` | rok VIP verze appky v hodnotě 4 990 Kč | #f6cd63 | #f7f3eb | 1.37 | light |
| tvuj-coach/index.html | `div.wrap > div.plans.plans-3 > div.incl-pair:nth-of-type(5) > div.incl:nth-of-type(2) > b` | Máš to v ceně? | #f6cd63 | #f6eede | 1.32 | light |

## Nálezy tmavý motiv (shrnutí)

Celkem 868 prvků pod 2,0. Tento seznam se opravou světlého režimu **nesmí** změnit.

| Výskytů | Stránek | Selektor (zkrácený) | Příklad | Pomer |
|---:|---:|---|---|---:|
| 421 | 150 | `div.wrapc > article > div.cta-box > a.btn.gold` | Pro muže 35+ | 1.62 |
| 151 | 151 | `div.wrapc > article > div.author-box > div > a.btn.gold` | Chci koučink na míru | 1.62 |
| 121 | 121 | `div.wrapc > article > div.cta-box > a.btn` | Plán zdarma | 1.62 |
| 56 | 2 | `div.pad > div.day > div.meal > div.mm > span.chip.b` | B | 1.93 |
| 56 | 2 | `div.day > div.meal > div.mm > span.chip.b > b` | 30 | 1.93 |
| 13 | 1 | `#d5 > ul > li > span.cb` | ☐ | 1.93 |
| 7 | 1 | `#d1 > ul > li > span.cb` | ☐ | 1.93 |
| 7 | 1 | `#d4 > ul > li > span.cb` | ☐ | 1.93 |
| 4 | 1 | `#d3 > ul > li > span.cb` | ✓ | 1.93 |
| 4 | 2 | `div.pad > div.day > div.dhead > div.dl > span.dtag.t-train` | tréninkový den | 1.28 |
| 3 | 1 | `#d3 > p > span.cb` | ☐ | 1.93 |
| 3 | 2 | `main.card > div > a.btn` | Chci videokurz za 800 Kč → | 1.62 |
| 2 | 1 | `#obsah > div.container > div.mt-4.d-flex.flex-wrap > a.btn-gold` | Chci Academy: 8 900 Kč → | 1.93 |
| 2 | 1 | `div.container > div > div > div > a.btn-gold.w-100` | Začít za 990 Kč měsíčně → | 1.62 |
| 2 | 2 | `div.wrap > div.grid > a.card > div.ico` | 🏋️ | 1.36 |
| 2 | 2 | `main.card > a.btn` | Vytvořit přístup do Academy → | 1.62 |
| 2 | 2 | `section.final > div.wrap > h2` | Začni dostávat formu zpátky ještě tento týden | 1.93 |
| 2 | 2 | `section.final > div.wrap > p.fine` | Zdarma · Bez závazků · Tvůj e-mail nikam nedáme ·  | 1.52 |
| 2 | 1 | `main.wrap-main > p.shot-src > a` | Google · 46 recenzí | 1.2 |
| 1 | 1 | `#co-dostanes > div.container > div.text-center.mt-4 > a.btn-gold` | Chci to celé → | 1.62 |
| 1 | 1 | `#ai-martin-sekce > div.container > div.text-center.mt-3 > a.btn-gold` | Chci do Academy → | 1.62 |
| 1 | 1 | `#zajem > div.container > div.pricebox > div.mt-3.d-flex.flex-column > a.btn-gold` | Koupit Academy: 8 900 Kč → | 1.93 |
| 1 | 1 | `div.wrap > div.ctaWrap > a.cta` | Otevřít přihlášení → | 1.36 |
| 1 | 1 | `div.wrapc > article > div.academy-box > a.btn` | Prozkoumat Barna Academy → | 1.93 |
| 1 | 1 | `div.wrapc > article > div.academy-box > a.btn.gold` | Prozkoumat Barna Academy → | 1.93 |
| 1 | 1 | `section.promeny > div.promeny-cta > a.btn` | Chci stejnou změnu | 1.93 |
| 1 | 1 | `main.wrap-main > div.cta-strip > a.btn` | Objednat konzultaci → | 1.93 |

## Statická analýza (doplněk)

Selektor v `<style>` stránky nastavuje světlou barvu textu (`#fff`, `#f0eadf`, …) **bez** brány `html:not([data-theme=light])` a `theme-light.css` ho podle hrubé shody tříd nepřebíjí. Není to důkaz nečitelnosti, je to mapa, kam sáhnout.

| Stránek | Selektor | Příklad stránky |
|---:|---|---|
| 257 | `.eq` | akademie/studium/m1-l1/index.html |
| 160 | `::selection` | clanky/alkohol-a-hubnuti.html |
| 160 | `.fab-wa` | akademie/index.html |
| 22 | `.toolbar` | materialy/denik-navyku/index.html |
| 4 | `.brandhead .bn` | akademie/nastroje/jidelnicek/index.html |
| 4 | `.btn-grn:hover` | akademie/videokurz/kalkulacka/index.html |
| 3 | `.fab-wa:hover` | index.html |
| 2 | `.backlink:hover` | akademie/studium/index.html |
| 2 | `.cta-calc` | plan/forma-zpet-muzi/index.html |
| 2 | `.result` | akademie/videokurz/kalkulacka/index.html |
| 1 | `.att .em` | akademie/moje/testy/index.html |
| 1 | `.b-ghost` | akademie/moje/doporuc/index.html |
| 1 | `.badge-kg.dark` | index.html |
| 1 | `.blog-nores` | clanky/index.html |
| 1 | `.btn-dark` | akademie/index.html |
| 1 | `.btn-wa-open:hover` | index.html |
| 1 | `.c-name` | akademie/certifikat/index.html |
| 1 | `.copy.done` | akademie/nastroje/prompty/index.html |
| 1 | `.cta-bar .cb-quiz` | index.html |
| 1 | `.dv-caption` | tvuj-coach/index.html |
| 1 | `.dv-card` | tvuj-coach/index.html |
| 1 | `.form-ok` | index.html |
| 1 | `.habit .hpill .ht` | akademie/studium/index.html |
| 1 | `.hello` | akademie/studium/index.html |
| 1 | `.hero-cta .quiet` | index.html |
| 1 | `.hl` | spoluprace/index.html |
| 1 | `.intro` | myty/index.html |
| 1 | `.kdt-v` | akademie/admin/index.html |
| 1 | `.kv dd` | akademie/admin/crm/index.html |
| 1 | `.paths-h` | akademie/studium/index.html |
| 1 | `.photo-cap` | index.html |
| 1 | `.pill.media` | prednasky/index.html |
| 1 | `.price-tag .now` | konzultace/index.html |
| 1 | `.pricecard .big` | konzultace/index.html |
| 1 | `.q` | kviz/index.html |
| 1 | `.q .qt` | akademie/test/index.html |
| 1 | `.qa .q` | akademie/moje/testy/index.html |
| 1 | `.ranktier .rt-name` | akademie/studium/index.html |
| 1 | `.result .big` | akademie/test/index.html |
| 1 | `.rt-share:hover` | akademie/studium/index.html |
| 1 | `.story-body` | index.html |
| 1 | `.story-body .pod` | index.html |
| 1 | `.story-body .role` | index.html |
| 1 | `.tbar` | akademie/admin/index.html |
| 1 | `.tools-head` | akademie/studium/index.html |
| 1 | `.vk-bb-price` | videokurz.html |
| 1 | `.vk-bb-text` | videokurz.html |
| 1 | `.vkb.on` | akademie/videokurz/index.html |
