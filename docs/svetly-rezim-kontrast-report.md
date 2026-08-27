# Kontrast světlého režimu

Automatický běh `scripts/kontrola-kontrastu-temat.mjs`.

## Metodika

- Lokální statický server nad kořenem repa, headless Chrome, viewporty **390×844 (mobil)** a **1366×900 (desktop)**.
- Motiv: `localStorage.mb-theme` = `light` | `dark` (stejný klíč jako `theme-boot.js` / `ba-theme.js`).
- U každého viditelného textového uzlu: WCAG 2 kontrast *computed color* vs. efektivní pozadí (rodiče k prvnímu neprůhlednému; polotransparentní vrstvy a gradientové stopy se skládají, u gradientu se bere nejhorší stopa).
- Do reportu jde vše pod **4.5** (WCAG AA pro běžný text). Skript **selže** (kód 1) až při nálezu pod **3**; mezi 3 a 4.5 report jen informuje (zlatý akcent na krému má 1,3-1,9 a je vědomě ponechaný).
- Otisk tmavého motivu se pořád počítá jen z **mobilu a jen pod 2**, aby byl srovnatelný s baseline z doby před zvednutím prahu.
- Brána hlídá **regrese, ne stav**: nálezy pod blokujícím prahem, které už jsou v `docs/svetly-rezim-kontrast-svetly-povolene.json`, skript nezastaví. Ten seznam se má zmenšovat, a co z něj vyškrtneš, se už nesmí vrátit.
- Tmavý motiv se v CSS nesmí změnit: otisk nálezů tmavého před opravou a po opravě musí být totožný.
- Přesměrovací stuby `go/` se neměří (`location.replace` na produkci, není to obsah webu).
- SVG `<text>` se neměří (výplň kresby, ne sázecí text).

## Třída chyby (Martin: osnovové nadpisy na /videokurz)

Page-level kopie tmavého overlaye (`color:#fff` na `h5`/`h6`/`.module h6`/`.card h5`) **bez** brány `html:not([data-theme=light])`. Overlay `marketing-dark.css` ve světlém režimu vypne, page CSS dál maluje bíle na krém. Stejná třída: zlatý text (`#ebb12c` / `var(--brand)` / `var(--gold)`) na krému a leftover `--muted` z tmavého tokenu. Oprava je jen v `theme-light.css` / `ba-theme-light.css` pod `[data-theme=light]`. Tmavý motiv ta pravidla nevidí.

## Finální stav

| Motiv | Nálezů pod 4.5 | Z toho pod 3 (blokuje) | Poznámka |
|---|---:|---:|---|
| světlý | 604 | **198** | cíl: 0 blokujících |
| tmavý | 2580 | 1962 | otisk totožný s baseline před opravou |

### Důkaz: tmavý motiv beze změny

- SHA-256 před: `8733a68758626d0041369d99365743e73147c065a6f0522f6858233d154e8a9a`
- SHA-256 po: `8733a68758626d0041369d99365743e73147c065a6f0522f6858233d154e8a9a`
- Počet před / po: 868 / 868
- **TOTOŽNÉ**

Světlý režim před opravou: **2226** nálezů pod 2 (mobil). Po opravě: **51**.

Martinův případ `/videokurz.html` (osnova `.module h6`, bílé nadpisy na krému): **4** nálezů pod 2.
Zbývající nálezy už skoro nejsou „bílá na krému“, ale zlatý akcent (`#ebb12c` / `#f6cd63`) na krému (poměr cca 1,3–1,9) a pár tmavých ostrovů, kam spadl ink z globálního `h2`/`h5`. Tmavý motiv se nezměnil.

## Skupiny selektorů (světlý)

| Výskytů | Stránek | Selektor (zkrácený) | Příklad textu | Barvy | Pomer |
|---:|---:|---|---|---|---:|
| 112 | 2 | `div.pad > div.day > div.meal > div.mm > span.chip.s` | S | #ffffff na #2e8be6 | 3.53 |
| 112 | 2 | `div.day > div.meal > div.mm > span.chip.s > b` | 35 | #ffffff na #2e8be6 | 3.53 |
| 40 | 20 | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 na #6b4e08 | 2.36 |
| 38 | 19 | `div.sheet > div.pad > p.src` | [1] Stewart TM, Williamson DA, White MA. Rigid vs. flexible  | #9a9082 na #ffffff | 3.14 |
| 34 | 17 | `div.sheet > div.pad > p.src > b` | Zdroje: | #9a9082 na #ffffff | 3.14 |
| 12 | 2 | `div.wrap > div.grid3 > figure > figcaption > span.src` | Google | #7d8288 na #ffffff | 3.87 |
| 8 | 4 | `div.wrapc > article > div.inline-magnet > a` | Chci plán zdarma | #6b4e08 na #ebb12c | 3.99 |
| 8 | 1 | `#jak > div.container > div.steps > div.step.rv > div.num` | 1 | #ebb12c na #ebb12c | 1 |
| 8 | 1 | `div.container > div.bento > div.bcard.rv > div.links > a` | Plán pro ženy 30+ → | #ebb12c na #ffffff | 1.93 |
| 8 | 2 | `div.sheet > div.pad > p.disc` | B = bílkoviny (g) · S = sacharidy (g) · T = tuky (g). Porce  | #9b948b na #ffffff | 3 |
| 6 | 1 | `div.wrap > div.order > div.trust > span` | 🔒 Zabezpečená platba | #9b9080 na #ffffff | 3.14 |
| 6 | 1 | `div.grid > div.col > div.mock > div.chips > span.chip` | Bílkoviny ✓ | #c8901f na #fff4e8 | 2.59 |
| 6 | 1 | `div.wrap > ul > li > a` | zásady ochrany osobních údajů | #f6cd63 na #f7f3eb | 1.37 |
| 6 | 1 | `div.container > div.row.g-4.justify-content-center > div.col-md-6.col-lg-3 > div` | 1 190 Kč / lekce | #7a857d na #ffffff | 3.83 |
| 6 | 1 | `div.wrap > div.plans.plans-3 > div.incl-pair > div.incl > b` | Chceš VIP na celý rok? Zvaž Barnu Academy. | #f6cd63 na #f7f3eb | 1.37 |
| 4 | 1 | `div.top > div.in > div.topr > a` | Poznatky o firmě | #9d938a na #f7f3eb | 2.72 |
| 4 | 1 | `#zdarma > div.container > div.acards > a.acard > span.ai` | 🏋️ | #0d6efd na #fff4e8 | 4.15 |
| 4 | 1 | `#refMain > div.ref-deal > div.d > div.tit` | Videokurz výživy | #b7ab9b na #f6eede | 1.96 |
| 4 | 1 | `#refMain > div.ref-deal > div.d > div.big` | kamarád −10 % | #f6cd63 na #f6eede | 1.32 |
| 4 | 2 | `div.wrap > div.grid > a.card > div.ico` | 🏋️ | #6b4e08 na #e0a820 | 3.6 |
| 4 | 1 | `div.order > div > div > div > a.cta` | Začít za 990 Kč měsíčně → | #6b4e08 na #e0a820 | 3.6 |
| 4 | 1 | `#d4 > ul > li > span.hint` | (počítej poctivě 1–1,5 h) | #8a8276 na #ffffff | 3.79 |
| 4 | 2 | `#contBtn` | ▶ Začít: Proč lidé jedí, i když nemají hlad | #6b4e08 na #e0a820 | 3.6 |
| 4 | 2 | `div.wrap > div.grid > div.col > div.mock > div.mtag` | ZDARMA | #c8901f na #ffffff | 2.81 |
| 4 | 2 | `div.wrap > div.form-card > form.lead-form > label > span` | (nepovinné) | #8a8073 na #ffffff | 3.88 |
| 4 | 2 | `#formular > div.wrap > div.form-card > form.lead-form > p` | Odesláním souhlasíš se zasláním plánu a občasných tipů. Odhl | #8a8073 na #ffffff | 3.88 |
| 4 | 2 | `div.wrap > div.about > div > p > strong` | Be Effective! | #f6cd63 na #f7f3eb | 1.37 |
| 4 | 2 | `div.wrap > div.contact > div > div.btn-row > a.btn.btn-acc` | Objednat za 2 990 Kč → | #6b4e08 na #ebb12c | 3.99 |
| 4 | 1 | `#rozcestnik > div.container > div.bento > div.bcard.rv > span.tag` | Zdarma na start | #f6cd63 na #fcf5e4 | 1.4 |
| 4 | 1 | `div.sheet > div.pad > div.warn > b` | ⚠️ Pro trenéra: | #ff8f8f na #fdefef | 1.96 |
| 4 | 2 | `div.wrap > p.upd` | Účinné od 18. 7. 2026 | #a99e8f na #f7f3eb | 2.38 |
| 4 | 2 | `#dl` | ⬇ Stáhnout / Tisk do PDF | #1a1222 na #6b4e08 | 2.36 |
| 4 | 2 | `div.sheet > div.pad > div.cta-calc > a` | Otevřít kalkulačku → | #1a1222 na #6b4e08 | 2.36 |
| 4 | 2 | `div.sheet > div.pad > div.foot > div.disc` | Tento materiál je obecné vzdělávací vodítko, ne individuální | #9b948b na #ffffff | 3 |
| 4 | 1 | `#cards > div.card > div.thumb > span.ph` | 🏋️ | #5f574c na #191510 | 2.56 |
| 4 | 1 | `div.wrap > div.plans.plans-3 > div.plan > p.bonus > b` | Videokurz výživy zdarma k první platbě | #f6cd63 na #fdf7ea | 1.42 |
| 2 | 1 | `#logout` | Odhlásit | #9d938a na #f7f3eb | 2.72 |
| 2 | 1 | `#load` | Načítám admin… | #b7ab9b na #f7f3eb | 2.04 |
| 2 | 1 | `#ai-martin-sekce > div.container > p.text-center.mt-4` | Je to pomocník, ne náhrada za mě. Když si nebudeš jistý, poř | #9a948c na #f7f3eb | 2.72 |
| 2 | 1 | `#srovnani > div.container > div.sec-head > span.ac-tag` | SROVNÁNÍ | #ffffff na #ebb12c | 1.93 |
| 2 | 1 | `#loyPct` | 0 % | #6b4e08 na #23211e | 2.08 |
| 2 | 1 | `#app > div.ci-loyal > div.lt` | Tvoje věrnostní sleva | #161310 na #0c0c0c | 1.06 |
| 2 | 1 | `#loyStreak` | - | #161310 na #0c0c0c | 1.06 |
| 2 | 1 | `#refMain > div.ref-terms` | • | #9b8e7d na #f7f3eb | 2.89 |
| 2 | 1 | `#fmtSegs > button.seg` | Story / Reel 9:16 | #cfc6b8 na #ffffff | 1.69 |
| 2 | 1 | `#bgSegs > button.seg` | Světlé | #cfc6b8 na #ffffff | 1.69 |
| 2 | 1 | `#onboarding > div.lockbox > a.cta` | Získat přístup → | #6b4e08 na #e0a820 | 3.6 |
| 2 | 1 | `#checkin > div.lockbox > a.cta` | Získat přístup → | #6b4e08 na #e0a820 | 3.6 |
| 2 | 1 | `#strava > div.lockbox > a.cta` | Získat přístup → | #6b4e08 na #e0a820 | 3.6 |
| 2 | 1 | `#trenink > div.lockbox > a.cta` | Získat přístup → | #6b4e08 na #e0a820 | 3.6 |
| 2 | 1 | `#materialy > div.lockbox > a.cta` | Získat přístup → | #6b4e08 na #e0a820 | 3.6 |
| 2 | 1 | `#obsah > div.lockbox > a.cta` | Získat přístup → | #6b4e08 na #e0a820 | 3.6 |
| 2 | 1 | `#reklamy > div.lockbox > a.cta` | Získat přístup → | #6b4e08 na #e0a820 | 3.6 |
| 2 | 1 | `#veda > div.lockbox > a.cta` | Získat přístup → | #6b4e08 na #e0a820 | 3.6 |
| 2 | 1 | `div.wrap > div.ctaWrap > a.cta` | Otevřít přihlášení → | #6b4e08 na #e0a820 | 3.6 |
| 2 | 1 | `#demoNote > a` | ukázkové lekce | #ffffff na #f6eedc | 1.16 |
| 2 | 1 | `#d2 > ul > li > span.hint` | (1 = mimo, 5 = podle plánu) | #8a8276 na #ffffff | 3.79 |
| 2 | 1 | `#d3 > p > span.hint` | (stejné světlo, stejné místo, stejný čas) | #8a8276 na #ffffff | 3.79 |
| 2 | 1 | `div.wrap > div.crumb` | Nástroj · Materiály | #a89c8c na #f6f1ea | 2.4 |
| 2 | 1 | `div.wrap > p.tip > a` | modulech videokurzu | #c45e00 na #f6f1ea | 3.78 |
| 2 | 1 | `div.wrap > div.hero > span.kick` | Videokurz výživy | #f6cd63 na #f6eedc | 1.31 |
| 2 | 1 | `div.wrap > div.card > a.cta` | Vytvořit přístup do Academy → | #6b4e08 na #e0a820 | 3.6 |
| 2 | 1 | `div.wrapc > article > div.keybox > strong` | V kostce: | #ebb12c na #f6eede | 1.68 |
| 2 | 1 | `div.wrapc > article > div.vs-cols > div.vc.yes > h4` | Naplánovaný vyšší den | #f6cd63 na #f7f3ec | 1.38 |
| 2 | 1 | `div.wrapc > article > div.vs-cols > div.vc.no > h4` | Nekontrolovaný chaos | #e07a7a na #f7f3ec | 2.63 |
| 2 | 1 | `#freeplan-cta > div.fp-inner > div.fp-txt > span.fp-kick` | Zdarma · bez závazku | #b85600 na #fcebce | 4.09 |
| 2 | 1 | `section.sec > div.wrap > div.konz > b.t` | 🎁 Konzultace 2 990 Kč. A fakticky zdarma, když to myslíš vá | #f6cd63 na #ffffff | 1.52 |
| 2 | 1 | `div.grid.g2 > div.card.fit.no > ul > li > a` | koučink | #f6cd63 na #ffffff | 1.52 |
| 2 | 1 | `#objednavka > div.wrap > div.vip > div.vt > b` | V ceně konzultace máš navíc: | #f6cd63 na #f7f4ec | 1.38 |
| 2 | 1 | `#odecet > div.wrap > div.konz > b.t` | 🎁 A fakticky zdarma, když to myslíš vážně | #f6cd63 na #ffffff | 1.52 |
| 2 | 1 | `div.container > div.pgrid > div.pcard.cta-card.rv > div.in > b` | 600+ proměn | #ebb12c na #ffffff | 1.93 |
| 2 | 1 | `#jak > div.container > div.steps-cta.rv > span.or > a` | nezávazně napiš | #ebb12c na #f7f3eb | 1.75 |
| 2 | 1 | `div.container > div.bento > div.wide.rv > div > span.tag` | Videokurz | #f6cd63 na #fcf5e4 | 1.4 |
| 2 | 1 | `#reference > div.container > div.rev-sum.rv > span.big` | 5,0 ★ | #ebb12c na #ffffff | 1.93 |
| 2 | 1 | `div.sheet > div.pad > div.callout > p.src` | [1] Sawka MN, et al. American College of Sports Medicine pos | #9a9082 na #f3eee4 | 2.72 |
| 2 | 1 | `div.wrap > div.lay > div.prevwrap > div.bar > span` | Živý náhled | #5c564c na #0d0c0a | 2.7 |
| 2 | 1 | `#liveTag` | aktualizuje se při psaní | #5c564c na #0d0c0a | 2.7 |
| 2 | 1 | `div.wrapc > p.intro` | Kolem hubnutí a fitness koluje víc mýtů než kdekoliv jinde.  | #cabfb4 na #f7f3eb | 1.63 |
| 2 | 1 | `#wform > div.hint` | Najdeš ho v potvrzovacím e-mailu o platbě. Když ho nemůžeš n | #9a8f7d na #ffffff | 3.18 |
| 2 | 1 | `div.box > div.znacka` | Martin Barna | #ebb12c na #ffffff | 1.93 |

## Nálezy po prvcích (světlý, poměr < 4.5)

| Stránka | Selektor | Text | Popředí | Pozadí | Pomer | Viewport |
|---|---|---|---|---|---:|---|
| index.html | `#jak > div.container > div.steps:nth-of-type(2) > div.step.rv:nth-of-type(1) > div.num` | 1 | #ebb12c | #ebb12c | 1 | mobil |
| index.html | `#jak > div.container > div.steps:nth-of-type(2) > div.step.rv:nth-of-type(2) > div.num` | 2 | #ebb12c | #ebb12c | 1 | mobil |
| index.html | `#jak > div.container > div.steps:nth-of-type(2) > div.step.rv:nth-of-type(3) > div.num` | 3 | #ebb12c | #ebb12c | 1 | mobil |
| index.html | `#jak > div.container > div.steps:nth-of-type(2) > div.step.rv:nth-of-type(4) > div.num` | 4 | #ebb12c | #ebb12c | 1 | mobil |
| index.html | `#jak > div.container > div.steps:nth-of-type(2) > div.step.rv:nth-of-type(1) > div.num` | 1 | #ebb12c | #ebb12c | 1 | desktop |
| index.html | `#jak > div.container > div.steps:nth-of-type(2) > div.step.rv:nth-of-type(2) > div.num` | 2 | #ebb12c | #ebb12c | 1 | desktop |
| index.html | `#jak > div.container > div.steps:nth-of-type(2) > div.step.rv:nth-of-type(3) > div.num` | 3 | #ebb12c | #ebb12c | 1 | desktop |
| index.html | `#jak > div.container > div.steps:nth-of-type(2) > div.step.rv:nth-of-type(4) > div.num` | 4 | #ebb12c | #ebb12c | 1 | desktop |
| treninky.html | `section.text-center:nth-of-type(4) > div.container > h2.mb-3` | Pojďme začít trénovat | #161310 | #161616 | 1.02 | mobil |
| treninky.html | `section.text-center:nth-of-type(4) > div.container > h2.mb-3` | Pojďme začít trénovat | #161310 | #161616 | 1.02 | desktop |
| akademie/moje/check-in/index.html | `#app > div.ci-loyal:nth-of-type(1) > div.lt:nth-of-type(2)` | Tvoje věrnostní sleva | #161310 | #0c0c0c | 1.06 | mobil |
| akademie/moje/check-in/index.html | `#loyStreak` | - | #161310 | #0c0c0c | 1.06 | mobil |
| akademie/moje/check-in/index.html | `#app > div.ci-loyal:nth-of-type(1) > div.lt:nth-of-type(2)` | Tvoje věrnostní sleva | #161310 | #0c0c0c | 1.06 | desktop |
| akademie/moje/check-in/index.html | `#loyStreak` | - | #161310 | #0c0c0c | 1.06 | desktop |
| akademie/prihlaseni/index.html | `#demoNote > a` | ukázkové lekce | #ffffff | #f6eedc | 1.16 | mobil |
| akademie/prihlaseni/index.html | `#demoNote > a` | ukázkové lekce | #ffffff | #f6eedc | 1.16 | desktop |
| akademie/videokurz/index.html | `#contBtn` | ▶ Začít: Co jsou to kalorie | #f6cd63 | #ebb12c | 1.27 | mobil |
| akademie/videokurz/index.html | `#contBtn` | ▶ Začít: Co jsou to kalorie | #f6cd63 | #ebb12c | 1.27 | desktop |
| akademie/videokurz/index.html | `div.wrap:nth-of-type(2) > div.hero:nth-of-type(1) > span.kick` | Videokurz výživy | #f6cd63 | #f6eedc | 1.31 | mobil |
| akademie/videokurz/index.html | `div.wrap:nth-of-type(2) > div.hero:nth-of-type(1) > span.kick` | Videokurz výživy | #f6cd63 | #f6eedc | 1.31 | desktop |
| akademie/moje/doporuc/index.html | `#refMain > div.ref-deal:nth-of-type(5) > div.d:nth-of-type(1) > div.big:nth-of-type(2)` | kamarád −10 % | #f6cd63 | #f6eede | 1.32 | mobil |
| akademie/moje/doporuc/index.html | `#refMain > div.ref-deal:nth-of-type(5) > div.d:nth-of-type(2) > div.big:nth-of-type(2)` | kamarád −10 % | #f6cd63 | #f6eede | 1.32 | mobil |
| tvuj-coach/index.html | `div.wrap > div.plans.plans-3 > div.incl-pair:nth-of-type(5) > div.incl:nth-of-type(2) > b` | Máš to v ceně? | #f6cd63 | #f6eede | 1.32 | mobil |
| akademie/moje/doporuc/index.html | `#refMain > div.ref-deal:nth-of-type(5) > div.d:nth-of-type(1) > div.big:nth-of-type(2)` | kamarád −10 % | #f6cd63 | #f6eede | 1.32 | desktop |
| akademie/moje/doporuc/index.html | `#refMain > div.ref-deal:nth-of-type(5) > div.d:nth-of-type(2) > div.big:nth-of-type(2)` | kamarád −10 % | #f6cd63 | #f6eede | 1.32 | desktop |
| tvuj-coach/index.html | `div.wrap > div.plans.plans-3 > div.incl-pair:nth-of-type(5) > div.incl:nth-of-type(2) > b` | Máš to v ceně? | #f6cd63 | #f6eede | 1.32 | desktop |
| koucing/index.html | `div.wrap > div.about > div > p:nth-of-type(3) > strong` | Be Effective! | #f6cd63 | #f7f3eb | 1.37 | mobil |
| konzultace/index.html | `div.wrap > div.about > div > p:nth-of-type(3) > strong` | Be Effective! | #f6cd63 | #f7f3eb | 1.37 | mobil |
| obchodni-podminky/index.html | `div.wrap:nth-of-type(2) > ul:nth-of-type(1) > li:nth-of-type(4) > a` | zásady ochrany osobních údajů | #f6cd63 | #f7f3eb | 1.37 | mobil |
| obchodni-podminky/index.html | `div.wrap:nth-of-type(2) > ul:nth-of-type(2) > li:nth-of-type(1) > a` | martin@martinbarna.cz | #f6cd63 | #f7f3eb | 1.37 | mobil |
| obchodni-podminky/index.html | `div.wrap:nth-of-type(2) > ul:nth-of-type(2) > li:nth-of-type(2) > a` | martinbarna.cz/akademie/prihlaseni/ | #f6cd63 | #f7f3eb | 1.37 | mobil |
| start/index.html | `div.wrap:nth-of-type(1) > main > p.sub:nth-of-type(1) > strong` | zdarma | #f6cd63 | #f7f3eb | 1.37 | mobil |
| tvuj-coach/index.html | `div.wrap > div.plans.plans-3 > div.incl-pair:nth-of-type(5) > div.incl:nth-of-type(1) > b:` | Chceš VIP na celý rok? Zvaž Barnu Academy. | #f6cd63 | #f7f3eb | 1.37 | mobil |
| tvuj-coach/index.html | `div.wrap > div.plans.plans-3 > div.incl-pair:nth-of-type(5) > div.incl:nth-of-type(1) > b:` | rok VIP verze appky v hodnotě 4 990 Kč | #f6cd63 | #f7f3eb | 1.37 | mobil |
| konzultace/index.html | `div.wrap > div.about > div > p:nth-of-type(3) > strong` | Be Effective! | #f6cd63 | #f7f3eb | 1.37 | desktop |
| koucing/index.html | `div.wrap > div.about > div > p:nth-of-type(3) > strong` | Be Effective! | #f6cd63 | #f7f3eb | 1.37 | desktop |
| obchodni-podminky/index.html | `div.wrap:nth-of-type(2) > ul:nth-of-type(1) > li:nth-of-type(4) > a` | zásady ochrany osobních údajů | #f6cd63 | #f7f3eb | 1.37 | desktop |
| obchodni-podminky/index.html | `div.wrap:nth-of-type(2) > ul:nth-of-type(2) > li:nth-of-type(1) > a` | martin@martinbarna.cz | #f6cd63 | #f7f3eb | 1.37 | desktop |
| obchodni-podminky/index.html | `div.wrap:nth-of-type(2) > ul:nth-of-type(2) > li:nth-of-type(2) > a` | martinbarna.cz/akademie/prihlaseni/ | #f6cd63 | #f7f3eb | 1.37 | desktop |
| start/index.html | `div.wrap:nth-of-type(1) > main > p.sub:nth-of-type(1) > strong` | zdarma | #f6cd63 | #f7f3eb | 1.37 | desktop |
| tvuj-coach/index.html | `div.wrap > div.plans.plans-3 > div.incl-pair:nth-of-type(5) > div.incl:nth-of-type(1) > b:` | Chceš VIP na celý rok? Zvaž Barnu Academy. | #f6cd63 | #f7f3eb | 1.37 | desktop |
| tvuj-coach/index.html | `div.wrap > div.plans.plans-3 > div.incl-pair:nth-of-type(5) > div.incl:nth-of-type(1) > b:` | rok VIP verze appky v hodnotě 4 990 Kč | #f6cd63 | #f7f3eb | 1.37 | desktop |
| clanky/vikendove-prejidani.html | `div.wrapc:nth-of-type(2) > article > div.vs-cols:nth-of-type(3) > div.vc.yes:nth-of-type(1` | Naplánovaný vyšší den | #f6cd63 | #f7f3ec | 1.38 | mobil |
| konzultace/index.html | `#objednavka > div.wrap > div.vip:nth-of-type(2) > div.vt > b` | V ceně konzultace máš navíc: | #f6cd63 | #f7f4ec | 1.38 | mobil |
| poukaz/index.html | `div.offers.offers-more:nth-of-type(2) > div.offer.sm:nth-of-type(2) > ul > li:nth-of-type(` | běžného ceníku | #f6cd63 | #f7f4ec | 1.38 | mobil |
| clanky/vikendove-prejidani.html | `div.wrapc:nth-of-type(2) > article > div.vs-cols:nth-of-type(3) > div.vc.yes:nth-of-type(1` | Naplánovaný vyšší den | #f6cd63 | #f7f3ec | 1.38 | desktop |
| konzultace/index.html | `#objednavka > div.wrap > div.vip:nth-of-type(2) > div.vt > b` | V ceně konzultace máš navíc: | #f6cd63 | #f7f4ec | 1.38 | desktop |
| poukaz/index.html | `div.offers.offers-more:nth-of-type(2) > div.offer.sm:nth-of-type(2) > ul > li:nth-of-type(` | běžného ceníku | #f6cd63 | #f7f4ec | 1.38 | desktop |
| index.html | `div.container > div.bento:nth-of-type(2) > div.wide.rv:nth-of-type(1) > div:nth-of-type(1)` | Videokurz | #f6cd63 | #fcf5e4 | 1.4 | mobil |
| index.html | `#rozcestnik > div.container > div.bento:nth-of-type(2) > div.bcard.rv:nth-of-type(2) > spa` | Zdarma na start | #f6cd63 | #fcf5e4 | 1.4 | mobil |
| index.html | `#rozcestnik > div.container > div.bento:nth-of-type(2) > div.bcard.rv:nth-of-type(4) > spa` | Appka | #f6cd63 | #fcf5e4 | 1.4 | mobil |
| index.html | `div.container > div.bento:nth-of-type(2) > div.wide.rv:nth-of-type(1) > div:nth-of-type(1)` | Videokurz | #f6cd63 | #fcf5e4 | 1.4 | desktop |
| index.html | `#rozcestnik > div.container > div.bento:nth-of-type(2) > div.bcard.rv:nth-of-type(2) > spa` | Zdarma na start | #f6cd63 | #fcf5e4 | 1.4 | desktop |
| index.html | `#rozcestnik > div.container > div.bento:nth-of-type(2) > div.bcard.rv:nth-of-type(4) > spa` | Appka | #f6cd63 | #fcf5e4 | 1.4 | desktop |
| tvuj-coach/index.html | `div.wrap > div.plans.plans-3 > div.plan.featured:nth-of-type(1) > p.bonus:nth-of-type(2) >` | Videokurz výživy zdarma k první platbě. | #f6cd63 | #fdf7ea | 1.42 | mobil |
| tvuj-coach/index.html | `div.wrap > div.plans.plans-3 > div.plan:nth-of-type(2) > p.bonus:nth-of-type(2) > b:nth-of` | Videokurz výživy zdarma k první platbě | #f6cd63 | #fdf7ea | 1.42 | mobil |
| tvuj-coach/index.html | `div.wrap > div.plans.plans-3 > div.plan:nth-of-type(2) > p.bonus:nth-of-type(2) > b:nth-of` | K ročnímu navíc měsíc Barna Academy na zkoušku | #f6cd63 | #fdf7ea | 1.42 | mobil |
| tvuj-coach/index.html | `div.wrap > div.plans.plans-3 > div.plan.featured:nth-of-type(1) > p.bonus:nth-of-type(2) >` | Videokurz výživy zdarma k první platbě. | #f6cd63 | #fdf7ea | 1.42 | desktop |
| tvuj-coach/index.html | `div.wrap > div.plans.plans-3 > div.plan:nth-of-type(2) > p.bonus:nth-of-type(2) > b:nth-of` | Videokurz výživy zdarma k první platbě | #f6cd63 | #fdf7ea | 1.42 | desktop |
| tvuj-coach/index.html | `div.wrap > div.plans.plans-3 > div.plan:nth-of-type(2) > p.bonus:nth-of-type(2) > b:nth-of` | K ročnímu navíc měsíc Barna Academy na zkoušku | #f6cd63 | #fdf7ea | 1.42 | desktop |
| koucing/index.html | `section.sec:nth-of-type(5) > div.wrap > div.konz > b.t` | 🎁 Konzultace 2 990 Kč. A fakticky zdarma, když to myslíš vá | #f6cd63 | #ffffff | 1.52 | mobil |
| konzultace/index.html | `div.grid.g2 > div.card.fit.no:nth-of-type(2) > ul > li:nth-of-type(3) > a` | koučink | #f6cd63 | #ffffff | 1.52 | mobil |
| konzultace/index.html | `#odecet > div.wrap > div.konz > b.t` | 🎁 A fakticky zdarma, když to myslíš vážně | #f6cd63 | #ffffff | 1.52 | mobil |
| konzultace/index.html | `div.grid.g2 > div.card.fit.no:nth-of-type(2) > ul > li:nth-of-type(3) > a` | koučink | #f6cd63 | #ffffff | 1.52 | desktop |
| konzultace/index.html | `#odecet > div.wrap > div.konz > b.t` | 🎁 A fakticky zdarma, když to myslíš vážně | #f6cd63 | #ffffff | 1.52 | desktop |
| koucing/index.html | `section.sec:nth-of-type(5) > div.wrap > div.konz > b.t` | 🎁 Konzultace 2 990 Kč. A fakticky zdarma, když to myslíš vá | #f6cd63 | #ffffff | 1.52 | desktop |
| myty/index.html | `div.wrapc:nth-of-type(2) > p.intro` | Kolem hubnutí a fitness koluje víc mýtů než kdekoliv jinde.  | #cabfb4 | #f7f3eb | 1.63 | mobil |
| myty/index.html | `div.wrapc:nth-of-type(2) > p.intro` | Kolem hubnutí a fitness koluje víc mýtů než kdekoliv jinde.  | #cabfb4 | #f7f3eb | 1.63 | desktop |
| clanky/hubnuti-a-vek-mozku.html | `div.wrapc:nth-of-type(2) > article > div.keybox:nth-of-type(1) > strong` | V kostce: | #ebb12c | #f6eede | 1.68 | mobil |
| clanky/hubnuti-a-vek-mozku.html | `div.wrapc:nth-of-type(2) > article > div.keybox:nth-of-type(1) > strong` | V kostce: | #ebb12c | #f6eede | 1.68 | desktop |
| akademie/nastroje/infografika/index.html | `#fmtSegs > button.seg:nth-of-type(2)` | Story / Reel 9:16 | #cfc6b8 | #ffffff | 1.69 | mobil |
| akademie/nastroje/infografika/index.html | `#bgSegs > button.seg:nth-of-type(2)` | Světlé | #cfc6b8 | #ffffff | 1.69 | mobil |
| akademie/nastroje/infografika/index.html | `#fmtSegs > button.seg:nth-of-type(2)` | Story / Reel 9:16 | #cfc6b8 | #ffffff | 1.69 | desktop |
| akademie/nastroje/infografika/index.html | `#bgSegs > button.seg:nth-of-type(2)` | Světlé | #cfc6b8 | #ffffff | 1.69 | desktop |
| index.html | `#jak > div.container > div.steps-cta.rv:nth-of-type(3) > span.or > a` | nezávazně napiš | #ebb12c | #f7f3eb | 1.75 | mobil |
| start/index.html | `div.wrap:nth-of-type(1) > main > p.beff:nth-of-type(3)` | Be Effective! | #ebb12c | #f7f3eb | 1.75 | mobil |
| index.html | `#jak > div.container > div.steps-cta.rv:nth-of-type(3) > span.or > a` | nezávazně napiš | #ebb12c | #f7f3eb | 1.75 | desktop |
| start/index.html | `div.wrap:nth-of-type(1) > main > p.beff:nth-of-type(3)` | Be Effective! | #ebb12c | #f7f3eb | 1.75 | desktop |
| akademie/index.html | `#srovnani > div.container > div.sec-head:nth-of-type(1) > span.ac-tag` | SROVNÁNÍ | #ffffff | #ebb12c | 1.93 | mobil |
| index.html | `div.container > div.pgrid:nth-of-type(3) > div.pcard.cta-card.rv:nth-of-type(6) > div.in >` | 600+ proměn | #ebb12c | #ffffff | 1.93 | mobil |
| index.html | `div.container > div.bento:nth-of-type(2) > div.bcard.rv:nth-of-type(2) > div.links > a:nth` | Plán pro ženy 30+ → | #ebb12c | #ffffff | 1.93 | mobil |
| index.html | `div.container > div.bento:nth-of-type(2) > div.bcard.rv:nth-of-type(2) > div.links > a:nth` | Plán pro muže 35+ → | #ebb12c | #ffffff | 1.93 | mobil |
| index.html | `div.container > div.bento:nth-of-type(2) > div.bcard.rv:nth-of-type(2) > div.links > a:nth` | Kalkulačka a generátory zdarma → | #ebb12c | #ffffff | 1.93 | mobil |
| index.html | `div.container > div.bento:nth-of-type(2) > div.bcard.rv:nth-of-type(4) > div.links > a` | Víc o appce → | #ebb12c | #ffffff | 1.93 | mobil |
| index.html | `#reference > div.container > div.rev-sum.rv:nth-of-type(3) > span.big:nth-of-type(1)` | 5,0 ★ | #ebb12c | #ffffff | 1.93 | mobil |
| pripominky-vypnuto/index.html | `div.box > div.znacka` | Martin Barna | #ebb12c | #ffffff | 1.93 | mobil |
| akademie/index.html | `#srovnani > div.container > div.sec-head:nth-of-type(1) > span.ac-tag` | SROVNÁNÍ | #ffffff | #ebb12c | 1.93 | desktop |
| index.html | `div.container > div.pgrid:nth-of-type(3) > div.pcard.cta-card.rv:nth-of-type(6) > div.in >` | 600+ proměn | #ebb12c | #ffffff | 1.93 | desktop |
| index.html | `div.container > div.bento:nth-of-type(2) > div.bcard.rv:nth-of-type(2) > div.links > a:nth` | Plán pro ženy 30+ → | #ebb12c | #ffffff | 1.93 | desktop |
| index.html | `div.container > div.bento:nth-of-type(2) > div.bcard.rv:nth-of-type(2) > div.links > a:nth` | Plán pro muže 35+ → | #ebb12c | #ffffff | 1.93 | desktop |
| index.html | `div.container > div.bento:nth-of-type(2) > div.bcard.rv:nth-of-type(2) > div.links > a:nth` | Kalkulačka a generátory zdarma → | #ebb12c | #ffffff | 1.93 | desktop |
| index.html | `div.container > div.bento:nth-of-type(2) > div.bcard.rv:nth-of-type(4) > div.links > a` | Víc o appce → | #ebb12c | #ffffff | 1.93 | desktop |
| index.html | `#reference > div.container > div.rev-sum.rv:nth-of-type(3) > span.big:nth-of-type(1)` | 5,0 ★ | #ebb12c | #ffffff | 1.93 | desktop |
| pripominky-vypnuto/index.html | `div.box > div.znacka` | Martin Barna | #ebb12c | #ffffff | 1.93 | desktop |
| akademie/moje/doporuc/index.html | `#refMain > div.ref-deal:nth-of-type(5) > div.d:nth-of-type(1) > div.tit:nth-of-type(1)` | Videokurz výživy | #b7ab9b | #f6eede | 1.96 | mobil |
| akademie/moje/doporuc/index.html | `#refMain > div.ref-deal:nth-of-type(5) > div.d:nth-of-type(2) > div.tit:nth-of-type(1)` | Academy pro trenéry | #b7ab9b | #f6eede | 1.96 | mobil |
| materialy/vstupni-dotaznik/index.html | `div.sheet:nth-of-type(2) > div.pad > div.warn:nth-of-type(10) > b:nth-of-type(1)` | ⚠️ Pro trenéra: | #ff8f8f | #fdefef | 1.96 | mobil |
| materialy/vstupni-dotaznik/index.html | `div.sheet:nth-of-type(2) > div.pad > div.warn:nth-of-type(10) > b:nth-of-type(2)` | před nastavením deficitu ho pošli za lékařem | #ff8f8f | #fdefef | 1.96 | mobil |
| akademie/moje/doporuc/index.html | `#refMain > div.ref-deal:nth-of-type(5) > div.d:nth-of-type(1) > div.tit:nth-of-type(1)` | Videokurz výživy | #b7ab9b | #f6eede | 1.96 | desktop |
| akademie/moje/doporuc/index.html | `#refMain > div.ref-deal:nth-of-type(5) > div.d:nth-of-type(2) > div.tit:nth-of-type(1)` | Academy pro trenéry | #b7ab9b | #f6eede | 1.96 | desktop |
| materialy/vstupni-dotaznik/index.html | `div.sheet:nth-of-type(2) > div.pad > div.warn:nth-of-type(10) > b:nth-of-type(1)` | ⚠️ Pro trenéra: | #ff8f8f | #fdefef | 1.96 | desktop |
| materialy/vstupni-dotaznik/index.html | `div.sheet:nth-of-type(2) > div.pad > div.warn:nth-of-type(10) > b:nth-of-type(2)` | před nastavením deficitu ho pošli za lékařem | #ff8f8f | #fdefef | 1.96 | desktop |
| akademie/admin/index.html | `#load` | Načítám admin… | #b7ab9b | #f7f3eb | 2.04 | mobil |
| akademie/admin/index.html | `#load` | Načítám admin… | #b7ab9b | #f7f3eb | 2.04 | desktop |
| akademie/moje/check-in/index.html | `#loyPct` | 0 % | #6b4e08 | #23211e | 2.08 | mobil |
| akademie/moje/check-in/index.html | `#loyPct` | 0 % | #6b4e08 | #23211e | 2.08 | desktop |
| materialy/flexibilni-strava/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| materialy/high-protein-recepty/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| materialy/denik-navyku/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| materialy/hydratace-pitny-rezim/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| materialy/jak-cist-studie/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| materialy/jidlo-v-restauraci/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| materialy/lead-system-trener/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| materialy/kroky-a-cardio/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| materialy/kucharka/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| materialy/plato-zastavena-vaha/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| materialy/porce-bez-vazeni/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| materialy/prvni-konzultace/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| materialy/spanek-a-regenerace/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| materialy/zacni-cvicit/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| materialy/suplementy-co-funguje/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| materialy/stres-a-kortizol/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| materialy/treninkovy-plan/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| materialy/vstupni-dotaznik/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| materialy/tydenni-checkin/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| materialy/uvitaci-balicek/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| plan/forma-zpet-muzi/index.html | `#dl` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| plan/forma-zpet-muzi/index.html | `div.sheet:nth-of-type(2) > div.pad > div.cta-calc:nth-of-type(3) > a` | Otevřít kalkulačku → | #1a1222 | #6b4e08 | 2.36 | mobil |
| plan/makro-plan-zeny/index.html | `#dl` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | mobil |
| plan/makro-plan-zeny/index.html | `div.sheet:nth-of-type(2) > div.pad > div.cta-calc:nth-of-type(3) > a` | Otevřít kalkulačku → | #1a1222 | #6b4e08 | 2.36 | mobil |
| materialy/denik-navyku/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| materialy/flexibilni-strava/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| materialy/high-protein-recepty/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| materialy/hydratace-pitny-rezim/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| materialy/jak-cist-studie/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| materialy/jidlo-v-restauraci/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| materialy/kucharka/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| materialy/kroky-a-cardio/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| materialy/porce-bez-vazeni/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| materialy/plato-zastavena-vaha/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| materialy/lead-system-trener/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| materialy/prvni-konzultace/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| materialy/stres-a-kortizol/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| materialy/suplementy-co-funguje/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| materialy/spanek-a-regenerace/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| materialy/tydenni-checkin/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| materialy/treninkovy-plan/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| materialy/uvitaci-balicek/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| materialy/vstupni-dotaznik/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| materialy/zacni-cvicit/index.html | `#printBtn` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| plan/forma-zpet-muzi/index.html | `#dl` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| plan/forma-zpet-muzi/index.html | `div.sheet:nth-of-type(2) > div.pad > div.cta-calc:nth-of-type(3) > a` | Otevřít kalkulačku → | #1a1222 | #6b4e08 | 2.36 | desktop |
| plan/makro-plan-zeny/index.html | `#dl` | ⬇ Stáhnout / Tisk do PDF | #1a1222 | #6b4e08 | 2.36 | desktop |
| plan/makro-plan-zeny/index.html | `div.sheet:nth-of-type(2) > div.pad > div.cta-calc:nth-of-type(3) > a` | Otevřít kalkulačku → | #1a1222 | #6b4e08 | 2.36 | desktop |
| obchodni-podminky/index.html | `div.wrap:nth-of-type(2) > p.upd:nth-of-type(1)` | Účinné od 18. 7. 2026 | #a99e8f | #f7f3eb | 2.38 | mobil |
| zasady-ochrany-osobnich-udaju/index.html | `div.wrap:nth-of-type(2) > p.upd:nth-of-type(1)` | Účinné od 25. 6. 2026 | #a99e8f | #f7f3eb | 2.38 | mobil |
| obchodni-podminky/index.html | `div.wrap:nth-of-type(2) > p.upd:nth-of-type(1)` | Účinné od 18. 7. 2026 | #a99e8f | #f7f3eb | 2.38 | desktop |
| zasady-ochrany-osobnich-udaju/index.html | `div.wrap:nth-of-type(2) > p.upd:nth-of-type(1)` | Účinné od 25. 6. 2026 | #a99e8f | #f7f3eb | 2.38 | desktop |
| akademie/videokurz/kalkulacka/index.html | `div.wrap:nth-of-type(2) > div.crumb:nth-of-type(1)` | Nástroj · Materiály | #a89c8c | #f6f1ea | 2.4 | mobil |
| recepty-a-odpovedi/index.html | `div.wrap.sec:nth-of-type(5) > div.price-box > a.btn` | Chci to stáhnout → | #161310 | #6b4e08 | 2.4 | mobil |
| recepty-a-odpovedi/index.html | `div.wrap.sec:nth-of-type(8) > a.btn` | Koupit za 349 Kč → | #161310 | #6b4e08 | 2.4 | mobil |
| akademie/videokurz/kalkulacka/index.html | `div.wrap:nth-of-type(2) > div.crumb:nth-of-type(1)` | Nástroj · Materiály | #a89c8c | #f6f1ea | 2.4 | desktop |
| recepty-a-odpovedi/index.html | `div.wrap.sec:nth-of-type(5) > div.price-box > a.btn` | Chci to stáhnout → | #161310 | #6b4e08 | 2.4 | desktop |
| recepty-a-odpovedi/index.html | `div.wrap.sec:nth-of-type(8) > a.btn` | Koupit za 349 Kč → | #161310 | #6b4e08 | 2.4 | desktop |
| nastroje-zdarma/cviky/index.html | `#cards > div.card:nth-of-type(1) > div.thumb:nth-of-type(1) > span.ph:nth-of-type(1)` | 🏋️ | #5f574c | #191510 | 2.56 | mobil |
| nastroje-zdarma/cviky/index.html | `#cards > div.card:nth-of-type(2) > div.thumb:nth-of-type(1) > span.ph:nth-of-type(1)` | 🏋️ | #5f574c | #191510 | 2.56 | mobil |
| nastroje-zdarma/cviky/index.html | `#cards > div.card:nth-of-type(3) > div.thumb:nth-of-type(1) > span.ph:nth-of-type(1)` | 🏋️ | #5f574c | #191510 | 2.56 | mobil |
| nastroje-zdarma/cviky/index.html | `#cards > div.card:nth-of-type(4) > div.thumb:nth-of-type(1) > span.ph:nth-of-type(1)` | 🏋️ | #5f574c | #191510 | 2.56 | mobil |
| forma-zpet/index.html | `div.grid > div.col:nth-of-type(2) > div.mock > div.chips:nth-of-type(4) > span.chip:nth-of` | Bílkoviny ✓ | #c8901f | #fff4e8 | 2.59 | mobil |
| forma-zpet/index.html | `div.grid > div.col:nth-of-type(2) > div.mock > div.chips:nth-of-type(4) > span.chip:nth-of` | Nákupní seznam ✓ | #c8901f | #fff4e8 | 2.59 | mobil |
| forma-zpet/index.html | `div.grid > div.col:nth-of-type(2) > div.mock > div.chips:nth-of-type(4) > span.chip:nth-of` | Varianty ✓ | #c8901f | #fff4e8 | 2.59 | mobil |
| forma-zpet/index.html | `div.grid > div.col:nth-of-type(2) > div.mock > div.chips:nth-of-type(4) > span.chip:nth-of` | Bílkoviny ✓ | #c8901f | #fff4e8 | 2.59 | desktop |
| forma-zpet/index.html | `div.grid > div.col:nth-of-type(2) > div.mock > div.chips:nth-of-type(4) > span.chip:nth-of` | Nákupní seznam ✓ | #c8901f | #fff4e8 | 2.59 | desktop |
| forma-zpet/index.html | `div.grid > div.col:nth-of-type(2) > div.mock > div.chips:nth-of-type(4) > span.chip:nth-of` | Varianty ✓ | #c8901f | #fff4e8 | 2.59 | desktop |
| clanky/vikendove-prejidani.html | `div.wrapc:nth-of-type(2) > article > div.vs-cols:nth-of-type(3) > div.vc.no:nth-of-type(2)` | Nekontrolovaný chaos | #e07a7a | #f7f3ec | 2.63 | mobil |
| clanky/vikendove-prejidani.html | `div.wrapc:nth-of-type(2) > article > div.vs-cols:nth-of-type(3) > div.vc.no:nth-of-type(2)` | Nekontrolovaný chaos | #e07a7a | #f7f3ec | 2.63 | desktop |
| materialy/rebrand/index.html | `div.wrap:nth-of-type(2) > div.lay:nth-of-type(2) > div.prevwrap:nth-of-type(2) > div.bar >` | Živý náhled | #5c564c | #0d0c0a | 2.7 | mobil |
| materialy/rebrand/index.html | `#liveTag` | aktualizuje se při psaní | #5c564c | #0d0c0a | 2.7 | mobil |
| materialy/rebrand/index.html | `div.wrap:nth-of-type(2) > div.lay:nth-of-type(2) > div.prevwrap:nth-of-type(2) > div.bar >` | Živý náhled | #5c564c | #0d0c0a | 2.7 | desktop |
| materialy/rebrand/index.html | `#liveTag` | aktualizuje se při psaní | #5c564c | #0d0c0a | 2.7 | desktop |
| akademie/admin/index.html | `div.top:nth-of-type(1) > div.in > div.topr > a:nth-of-type(1)` | Poznatky o firmě | #9d938a | #f7f3eb | 2.72 | mobil |
| akademie/admin/index.html | `div.top:nth-of-type(1) > div.in > div.topr > a:nth-of-type(2)` | Zpět na Academy | #9d938a | #f7f3eb | 2.72 | mobil |
| akademie/admin/index.html | `#logout` | Odhlásit | #9d938a | #f7f3eb | 2.72 | mobil |
| akademie/index.html | `#ai-martin-sekce > div.container > p.text-center.mt-4` | Je to pomocník, ne náhrada za mě. Když si nebudeš jistý, poř | #9a948c | #f7f3eb | 2.72 | mobil |
| materialy/hydratace-pitny-rezim/index.html | `div.sheet:nth-of-type(2) > div.pad > div.callout:nth-of-type(6) > p.src` | [1] Sawka MN, et al. American College of Sports Medicine pos | #9a9082 | #f3eee4 | 2.72 | mobil |
| akademie/admin/index.html | `div.top:nth-of-type(1) > div.in > div.topr > a:nth-of-type(1)` | Poznatky o firmě | #9d938a | #f7f3eb | 2.72 | desktop |
| akademie/admin/index.html | `div.top:nth-of-type(1) > div.in > div.topr > a:nth-of-type(2)` | Zpět na Academy | #9d938a | #f7f3eb | 2.72 | desktop |
| akademie/admin/index.html | `#logout` | Odhlásit | #9d938a | #f7f3eb | 2.72 | desktop |
| akademie/index.html | `#ai-martin-sekce > div.container > p.text-center.mt-4` | Je to pomocník, ne náhrada za mě. Když si nebudeš jistý, poř | #9a948c | #f7f3eb | 2.72 | desktop |
| materialy/hydratace-pitny-rezim/index.html | `div.sheet:nth-of-type(2) > div.pad > div.callout:nth-of-type(6) > p.src` | [1] Sawka MN, et al. American College of Sports Medicine pos | #9a9082 | #f3eee4 | 2.72 | desktop |
| forma-zpet/index.html | `div.wrap > div.grid > div.col:nth-of-type(2) > div.mock > div.mtag:nth-of-type(2)` | ZDARMA | #c8901f | #ffffff | 2.81 | mobil |
| makro-plan/index.html | `div.wrap > div.grid > div.col:nth-of-type(2) > div.mock > div.mtag:nth-of-type(2)` | ZDARMA | #c8901f | #ffffff | 2.81 | mobil |
| forma-zpet/index.html | `div.wrap > div.grid > div.col:nth-of-type(2) > div.mock > div.mtag:nth-of-type(2)` | ZDARMA | #c8901f | #ffffff | 2.81 | desktop |
| makro-plan/index.html | `div.wrap > div.grid > div.col:nth-of-type(2) > div.mock > div.mtag:nth-of-type(2)` | ZDARMA | #c8901f | #ffffff | 2.81 | desktop |
| akademie/moje/doporuc/index.html | `#refMain > div.ref-terms:nth-of-type(7)` | • | #9b8e7d | #f7f3eb | 2.89 | mobil |
| akademie/moje/doporuc/index.html | `#refMain > div.ref-terms:nth-of-type(7)` | • | #9b8e7d | #f7f3eb | 2.89 | desktop |
| reference/index.html | `section.promeny > p.promeny-note:nth-of-type(2)` | Reálné proměny mých klientů, zveřejněné s jejich svolením. | #8a8f93 | #f7f3eb | 2.95 | mobil |
| reference/index.html | `section.promeny > p.promeny-note:nth-of-type(2)` | Reálné proměny mých klientů, zveřejněné s jejich svolením. | #8a8f93 | #f7f3eb | 2.95 | desktop |
| plan/forma-zpet-muzi/index.html | `div.sheet:nth-of-type(2) > div.pad > p.disc:nth-of-type(3)` | B = bílkoviny (g) · S = sacharidy (g) · T = tuky (g). Porce  | #9b948b | #ffffff | 3 | mobil |
| plan/forma-zpet-muzi/index.html | `div.sheet:nth-of-type(2) > div.pad > p.disc:nth-of-type(4)` | Nemusíš jíst přesně tohle. Drž porci dané kategorie a vyměň  | #9b948b | #ffffff | 3 | mobil |
| plan/forma-zpet-muzi/index.html | `div.sheet:nth-of-type(2) > div.pad > div.foot:nth-of-type(15) > div.disc` | Tento materiál je obecné vzdělávací vodítko, ne individuální | #9b948b | #ffffff | 3 | mobil |
| plan/makro-plan-zeny/index.html | `div.sheet:nth-of-type(2) > div.pad > p.disc:nth-of-type(3)` | B = bílkoviny (g) · S = sacharidy (g) · T = tuky (g). Porce  | #9b948b | #ffffff | 3 | mobil |
| plan/makro-plan-zeny/index.html | `div.sheet:nth-of-type(2) > div.pad > p.disc:nth-of-type(4)` | Nemusíš jíst přesně tohle. Drž porci dané kategorie a vyměň  | #9b948b | #ffffff | 3 | mobil |
| plan/makro-plan-zeny/index.html | `div.sheet:nth-of-type(2) > div.pad > div.foot:nth-of-type(15) > div.disc` | Tento materiál je obecné vzdělávací vodítko, ne individuální | #9b948b | #ffffff | 3 | mobil |
| plan/forma-zpet-muzi/index.html | `div.sheet:nth-of-type(2) > div.pad > p.disc:nth-of-type(3)` | B = bílkoviny (g) · S = sacharidy (g) · T = tuky (g). Porce  | #9b948b | #ffffff | 3 | desktop |
| plan/forma-zpet-muzi/index.html | `div.sheet:nth-of-type(2) > div.pad > p.disc:nth-of-type(4)` | Nemusíš jíst přesně tohle. Drž porci dané kategorie a vyměň  | #9b948b | #ffffff | 3 | desktop |
| plan/forma-zpet-muzi/index.html | `div.sheet:nth-of-type(2) > div.pad > div.foot:nth-of-type(15) > div.disc` | Tento materiál je obecné vzdělávací vodítko, ne individuální | #9b948b | #ffffff | 3 | desktop |
| plan/makro-plan-zeny/index.html | `div.sheet:nth-of-type(2) > div.pad > p.disc:nth-of-type(3)` | B = bílkoviny (g) · S = sacharidy (g) · T = tuky (g). Porce  | #9b948b | #ffffff | 3 | desktop |
| plan/makro-plan-zeny/index.html | `div.sheet:nth-of-type(2) > div.pad > p.disc:nth-of-type(4)` | Nemusíš jíst přesně tohle. Drž porci dané kategorie a vyměň  | #9b948b | #ffffff | 3 | desktop |
| plan/makro-plan-zeny/index.html | `div.sheet:nth-of-type(2) > div.pad > div.foot:nth-of-type(15) > div.disc` | Tento materiál je obecné vzdělávací vodítko, ne individuální | #9b948b | #ffffff | 3 | desktop |
| spoluprace/index.html | `div.wrap:nth-of-type(2) > div.cta:nth-of-type(5) > p` | Nebo na | #8f8a99 | #f7f3eb | 3.03 | mobil |
| spoluprace/index.html | `div.wrap:nth-of-type(2) > div.cta:nth-of-type(5) > p` | Nebo na | #8f8a99 | #f7f3eb | 3.03 | desktop |
| akademie/objednavka/index.html | `div.wrap:nth-of-type(2) > div.order:nth-of-type(2) > div.trust:nth-of-type(5) > span:nth-o` | 🔒 Zabezpečená platba | #9b9080 | #ffffff | 3.14 | mobil |
| akademie/objednavka/index.html | `div.wrap:nth-of-type(2) > div.order:nth-of-type(2) > div.trust:nth-of-type(5) > span:nth-o` | 💳 Karta · Apple Pay · Google Pay | #9b9080 | #ffffff | 3.14 | mobil |
| akademie/objednavka/index.html | `div.wrap:nth-of-type(2) > div.order:nth-of-type(2) > div.trust:nth-of-type(5) > span:nth-o` | 🧾 Stripe | #9b9080 | #ffffff | 3.14 | mobil |
| materialy/flexibilni-strava/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(11) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/flexibilni-strava/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(11)` | [1] Stewart TM, Williamson DA, White MA. Rigid vs. flexible  | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/high-protein-recepty/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(9) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/high-protein-recepty/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(9)` | [1] Morton RW, et al. A systematic review, meta-analysis and | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/denik-navyku/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(12) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/denik-navyku/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(12)` | [1] Lally P, van Jaarsveld CHM, Potts HWW, Wardle J. How are | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/jak-cist-studie/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(15) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/jak-cist-studie/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(15)` | [1] OCEBM Levels of Evidence Working Group. The Oxford 2011  | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/jidlo-v-restauraci/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(10) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/jidlo-v-restauraci/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(10)` | [1] Hall KD, et al. Energy balance and its components: impli | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/lead-system-trener/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(11) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/lead-system-trener/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(11)` | [1] Litmus. The ROI of Email Marketing. 2019 (návratnost e-m | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/kroky-a-cardio/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(9) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/kroky-a-cardio/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(9)` | [1] Levine JA. Non-exercise activity thermogenesis (NEAT). B | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/kucharka/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(2)` | Pozn.: Makra a kalorie jsou orientační, počítané z běžných h | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/plato-zastavena-vaha/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(11) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/plato-zastavena-vaha/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(11)` | [1] Hall KD, Heymsfield SB, Kemnitz JW, Klein S, Schoeller D | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/porce-bez-vazeni/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(10) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/porce-bez-vazeni/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(10)` | [1] Hall KD, et al. Energy balance and its components: impli | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/prvni-konzultace/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(2) > b` | Vychází z: | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/prvni-konzultace/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(2)` | modul 1 Barna Academy. Role kouče: nelámat lidi, ale stavět  | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/spanek-a-regenerace/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(5) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/spanek-a-regenerace/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(5)` | [1] Spiegel K et al. Ann Intern Med. 2004;141(11):846–50. [2 | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/zacni-cvicit/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(13) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/zacni-cvicit/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(13)` | [1] Garber CE, et al. American College of Sports Medicine po | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/suplementy-co-funguje/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(8) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/suplementy-co-funguje/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(8)` | [1] Kerksick CM, et al. ISSN exercise & sports nutrition rev | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/stres-a-kortizol/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(12) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/stres-a-kortizol/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(12)` | [1] Epel ES, et al. Stress and body shape: stress-induced co | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/treninkovy-plan/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(14) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/treninkovy-plan/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(14)` | [1] Schoenfeld BJ. The mechanisms of muscle hypertrophy and  | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/vstupni-dotaznik/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(2) > b` | Vychází z: | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/vstupni-dotaznik/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(2)` | modul 1 Barna Academy (Psychologie a chování kolem jídla). B | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/tydenni-checkin/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(3) > b` | Vychází z: | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/tydenni-checkin/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(3)` | moduly 2 a 4 Barna Academy (Výpočet jídelníčku; Úpravy plánu | #9a9082 | #ffffff | 3.14 | mobil |
| materialy/uvitaci-balicek/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(10)` | Zdroje (výběr): WHO – Healthy diet, fact sheet (2020). U.S.  | #9a9082 | #ffffff | 3.14 | mobil |
| akademie/objednavka/index.html | `div.wrap:nth-of-type(2) > div.order:nth-of-type(2) > div.trust:nth-of-type(5) > span:nth-o` | 🔒 Zabezpečená platba | #9b9080 | #ffffff | 3.14 | desktop |
| akademie/objednavka/index.html | `div.wrap:nth-of-type(2) > div.order:nth-of-type(2) > div.trust:nth-of-type(5) > span:nth-o` | 💳 Karta · Apple Pay · Google Pay | #9b9080 | #ffffff | 3.14 | desktop |
| akademie/objednavka/index.html | `div.wrap:nth-of-type(2) > div.order:nth-of-type(2) > div.trust:nth-of-type(5) > span:nth-o` | 🧾 Stripe | #9b9080 | #ffffff | 3.14 | desktop |
| materialy/denik-navyku/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(12) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/denik-navyku/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(12)` | [1] Lally P, van Jaarsveld CHM, Potts HWW, Wardle J. How are | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/flexibilni-strava/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(11) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/flexibilni-strava/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(11)` | [1] Stewart TM, Williamson DA, White MA. Rigid vs. flexible  | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/high-protein-recepty/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(9) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/high-protein-recepty/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(9)` | [1] Morton RW, et al. A systematic review, meta-analysis and | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/jak-cist-studie/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(15) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/jak-cist-studie/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(15)` | [1] OCEBM Levels of Evidence Working Group. The Oxford 2011  | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/jidlo-v-restauraci/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(10) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/jidlo-v-restauraci/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(10)` | [1] Hall KD, et al. Energy balance and its components: impli | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/kucharka/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(2)` | Pozn.: Makra a kalorie jsou orientační, počítané z běžných h | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/kroky-a-cardio/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(9) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/kroky-a-cardio/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(9)` | [1] Levine JA. Non-exercise activity thermogenesis (NEAT). B | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/porce-bez-vazeni/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(10) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/porce-bez-vazeni/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(10)` | [1] Hall KD, et al. Energy balance and its components: impli | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/plato-zastavena-vaha/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(11) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/plato-zastavena-vaha/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(11)` | [1] Hall KD, Heymsfield SB, Kemnitz JW, Klein S, Schoeller D | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/lead-system-trener/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(11) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/lead-system-trener/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(11)` | [1] Litmus. The ROI of Email Marketing. 2019 (návratnost e-m | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/prvni-konzultace/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(2) > b` | Vychází z: | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/prvni-konzultace/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(2)` | modul 1 Barna Academy. Role kouče: nelámat lidi, ale stavět  | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/stres-a-kortizol/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(12) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/stres-a-kortizol/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(12)` | [1] Epel ES, et al. Stress and body shape: stress-induced co | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/suplementy-co-funguje/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(8) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/suplementy-co-funguje/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(8)` | [1] Kerksick CM, et al. ISSN exercise & sports nutrition rev | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/spanek-a-regenerace/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(5) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/spanek-a-regenerace/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(5)` | [1] Spiegel K et al. Ann Intern Med. 2004;141(11):846–50. [2 | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/tydenni-checkin/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(3) > b` | Vychází z: | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/tydenni-checkin/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(3)` | moduly 2 a 4 Barna Academy (Výpočet jídelníčku; Úpravy plánu | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/treninkovy-plan/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(14) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/treninkovy-plan/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(14)` | [1] Schoenfeld BJ. The mechanisms of muscle hypertrophy and  | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/uvitaci-balicek/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(10)` | Zdroje (výběr): WHO – Healthy diet, fact sheet (2020). U.S.  | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/vstupni-dotaznik/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(2) > b` | Vychází z: | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/vstupni-dotaznik/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(2)` | modul 1 Barna Academy (Psychologie a chování kolem jídla). B | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/zacni-cvicit/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(13) > b` | Zdroje: | #9a9082 | #ffffff | 3.14 | desktop |
| materialy/zacni-cvicit/index.html | `div.sheet:nth-of-type(2) > div.pad > p.src:nth-of-type(13)` | [1] Garber CE, et al. American College of Sports Medicine po | #9a9082 | #ffffff | 3.14 | desktop |
| odstoupeni/index.html | `#wform > div.hint:nth-of-type(1)` | Najdeš ho v potvrzovacím e-mailu o platbě. Když ho nemůžeš n | #9a8f7d | #ffffff | 3.18 | mobil |
| odstoupeni/index.html | `#wform > div.hint:nth-of-type(1)` | Najdeš ho v potvrzovacím e-mailu o platbě. Když ho nemůžeš n | #9a8f7d | #ffffff | 3.18 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(5) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(5) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nth` | 35 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(5) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(5) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nth` | 38 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(5) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(5) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nth` | 62 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(5) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(5) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nth` | 50 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(6) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(6) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nth` | 78 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(6) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(6) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nth` | 18 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(6) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(6) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nth` | 55 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(6) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(6) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nth` | 55 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(7) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(7) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nth` | 55 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(7) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(7) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nth` | 30 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(7) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(7) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nth` | 60 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(7) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(7) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nth` | 43 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(8) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(8) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nth` | 35 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(8) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(8) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nth` | 50 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(8) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(8) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nth` | 50 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(8) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(8) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nth` | 60 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(9) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(9) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nth` | 38 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(9) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(9) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nth` | 22 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(9) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(9) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nth` | 65 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(9) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(9) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nth` | 40 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(10) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(10) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nt` | 55 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(10) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(10) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nt` | 35 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(10) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(10) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nt` | 75 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(10) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(10) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nt` | 5 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(11) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(11) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nt` | 32 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(11) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(11) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nt` | 30 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(11) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(11) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nt` | 45 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(11) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(11) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nt` | 55 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(5) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(5) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nth` | 50 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(5) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(5) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nth` | 9 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(5) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(5) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nth` | 52 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(5) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(5) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nth` | 35 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(6) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(6) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nth` | 22 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(6) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(6) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nth` | 30 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(6) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(6) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nth` | 45 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(6) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(6) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nth` | 38 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(7) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(7) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nth` | 45 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(7) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(7) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nth` | 16 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(7) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(7) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nth` | 44 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(7) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(7) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nth` | 32 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(8) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(8) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nth` | 40 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(8) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(8) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nth` | 20 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(8) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(8) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nth` | 38 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(8) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(8) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nth` | 50 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(9) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(9) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nth` | 22 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(9) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(9) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nth` | 22 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(9) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(9) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nth` | 55 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(9) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(9) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nth` | 31 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(10) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(10) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nt` | 25 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(10) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(10) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nt` | 30 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(10) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(10) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nt` | 60 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(10) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(10) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nt` | 5 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(11) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(11) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nt` | 6 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(11) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(11) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nt` | 18 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(11) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(11) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nt` | 28 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(11) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(11) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nt` | 38 | #ffffff | #2e8be6 | 3.53 | mobil |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(5) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(5) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nth` | 35 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(5) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(5) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nth` | 38 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(5) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(5) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nth` | 62 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(5) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(5) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nth` | 50 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(6) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(6) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nth` | 78 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(6) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(6) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nth` | 18 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(6) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(6) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nth` | 55 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(6) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(6) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nth` | 55 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(7) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(7) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nth` | 55 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(7) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(7) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nth` | 30 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(7) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(7) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nth` | 60 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(7) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(7) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nth` | 43 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(8) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(8) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nth` | 35 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(8) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(8) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nth` | 50 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(8) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(8) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nth` | 50 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(8) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(8) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nth` | 60 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(9) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(9) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nth` | 38 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(9) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(9) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nth` | 22 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(9) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(9) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nth` | 65 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(9) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(9) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nth` | 40 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(10) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(10) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nt` | 55 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(10) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(10) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nt` | 35 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(10) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(10) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nt` | 75 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(10) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(10) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nt` | 5 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(11) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(11) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nt` | 32 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(11) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(11) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nt` | 30 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(11) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(11) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nt` | 45 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.pad > div.day:nth-of-type(11) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/forma-zpet-muzi/index.html | `div.day:nth-of-type(11) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nt` | 55 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(5) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(5) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nth` | 50 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(5) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(5) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nth` | 9 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(5) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(5) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nth` | 52 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(5) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(5) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nth` | 35 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(6) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(6) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nth` | 22 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(6) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(6) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nth` | 30 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(6) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(6) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nth` | 45 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(6) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(6) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nth` | 38 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(7) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(7) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nth` | 45 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(7) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(7) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nth` | 16 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(7) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(7) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nth` | 44 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(7) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(7) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nth` | 32 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(8) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(8) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nth` | 40 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(8) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(8) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nth` | 20 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(8) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(8) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nth` | 38 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(8) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(8) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nth` | 50 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(9) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(9) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nth` | 22 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(9) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(9) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nth` | 22 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(9) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(9) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nth` | 55 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(9) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(9) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nth` | 31 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(10) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(10) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nt` | 25 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(10) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(10) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nt` | 30 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(10) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(10) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nt` | 60 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(10) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(10) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nt` | 5 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(11) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(11) > div.meal:nth-of-type(2) > div.mm:nth-of-type(3) > span.chip.s:nt` | 6 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(11) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(11) > div.meal:nth-of-type(3) > div.mm:nth-of-type(3) > span.chip.s:nt` | 18 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(11) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(11) > div.meal:nth-of-type(4) > div.mm:nth-of-type(3) > span.chip.s:nt` | 28 | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.pad > div.day:nth-of-type(11) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span` | S | #ffffff | #2e8be6 | 3.53 | desktop |
| plan/makro-plan-zeny/index.html | `div.day:nth-of-type(11) > div.meal:nth-of-type(5) > div.mm:nth-of-type(3) > span.chip.s:nt` | 38 | #ffffff | #2e8be6 | 3.53 | desktop |
| akademie/nastroje/index.html | `div.wrap:nth-of-type(2) > div.grid > a.card:nth-of-type(4) > div.ico:nth-of-type(1)` | 🏋️ | #6b4e08 | #e0a820 | 3.6 | mobil |
| akademie/nastroje/prompty/index.html | `#onboarding > div.lockbox:nth-of-type(2) > a.cta` | Získat přístup → | #6b4e08 | #e0a820 | 3.6 | mobil |
| akademie/nastroje/prompty/index.html | `#checkin > div.lockbox:nth-of-type(2) > a.cta` | Získat přístup → | #6b4e08 | #e0a820 | 3.6 | mobil |
| akademie/nastroje/prompty/index.html | `#strava > div.lockbox:nth-of-type(2) > a.cta` | Získat přístup → | #6b4e08 | #e0a820 | 3.6 | mobil |
| akademie/nastroje/prompty/index.html | `#trenink > div.lockbox:nth-of-type(2) > a.cta` | Získat přístup → | #6b4e08 | #e0a820 | 3.6 | mobil |
| akademie/nastroje/prompty/index.html | `#materialy > div.lockbox:nth-of-type(2) > a.cta` | Získat přístup → | #6b4e08 | #e0a820 | 3.6 | mobil |
| akademie/nastroje/prompty/index.html | `#obsah > div.lockbox:nth-of-type(2) > a.cta` | Získat přístup → | #6b4e08 | #e0a820 | 3.6 | mobil |
| akademie/nastroje/prompty/index.html | `#reklamy > div.lockbox:nth-of-type(2) > a.cta` | Získat přístup → | #6b4e08 | #e0a820 | 3.6 | mobil |
| akademie/nastroje/prompty/index.html | `#veda > div.lockbox:nth-of-type(2) > a.cta` | Získat přístup → | #6b4e08 | #e0a820 | 3.6 | mobil |
| akademie/navod/index.html | `div.wrap:nth-of-type(2) > div.ctaWrap:nth-of-type(7) > a.cta` | Otevřít přihlášení → | #6b4e08 | #e0a820 | 3.6 | mobil |
| akademie/objednavka/index.html | `div.order:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(2) > ` | Začít za 990 Kč měsíčně → | #6b4e08 | #e0a820 | 3.6 | mobil |
| akademie/objednavka/index.html | `div.order:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(3) > ` | Chci doživotní přístup za 8 900 Kč → | #6b4e08 | #e0a820 | 3.6 | mobil |
| akademie/studium/index.html | `#contBtn` | ▶ Začít: Proč lidé jedí, i když nemají hlad | #6b4e08 | #e0a820 | 3.6 | mobil |
| akademie/vitejte/index.html | `div.wrap:nth-of-type(2) > div.card:nth-of-type(2) > a.cta` | Vytvořit přístup do Academy → | #6b4e08 | #e0a820 | 3.6 | mobil |
| nastroje-zdarma/index.html | `div.wrap:nth-of-type(2) > div.grid > a.card:nth-of-type(2) > div.ico:nth-of-type(1)` | 🏋️ | #6b4e08 | #e0a820 | 3.6 | mobil |
| akademie/nastroje/index.html | `div.wrap:nth-of-type(2) > div.grid > a.card:nth-of-type(4) > div.ico:nth-of-type(1)` | 🏋️ | #6b4e08 | #e0a820 | 3.6 | desktop |
| akademie/navod/index.html | `div.wrap:nth-of-type(2) > div.ctaWrap:nth-of-type(7) > a.cta` | Otevřít přihlášení → | #6b4e08 | #e0a820 | 3.6 | desktop |
| akademie/nastroje/prompty/index.html | `#onboarding > div.lockbox:nth-of-type(2) > a.cta` | Získat přístup → | #6b4e08 | #e0a820 | 3.6 | desktop |
| akademie/nastroje/prompty/index.html | `#checkin > div.lockbox:nth-of-type(2) > a.cta` | Získat přístup → | #6b4e08 | #e0a820 | 3.6 | desktop |
| akademie/nastroje/prompty/index.html | `#strava > div.lockbox:nth-of-type(2) > a.cta` | Získat přístup → | #6b4e08 | #e0a820 | 3.6 | desktop |
| akademie/nastroje/prompty/index.html | `#trenink > div.lockbox:nth-of-type(2) > a.cta` | Získat přístup → | #6b4e08 | #e0a820 | 3.6 | desktop |
| akademie/nastroje/prompty/index.html | `#materialy > div.lockbox:nth-of-type(2) > a.cta` | Získat přístup → | #6b4e08 | #e0a820 | 3.6 | desktop |
| akademie/nastroje/prompty/index.html | `#obsah > div.lockbox:nth-of-type(2) > a.cta` | Získat přístup → | #6b4e08 | #e0a820 | 3.6 | desktop |
| akademie/nastroje/prompty/index.html | `#reklamy > div.lockbox:nth-of-type(2) > a.cta` | Získat přístup → | #6b4e08 | #e0a820 | 3.6 | desktop |
| akademie/nastroje/prompty/index.html | `#veda > div.lockbox:nth-of-type(2) > a.cta` | Získat přístup → | #6b4e08 | #e0a820 | 3.6 | desktop |
| akademie/objednavka/index.html | `div.order:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(2) > ` | Začít za 990 Kč měsíčně → | #6b4e08 | #e0a820 | 3.6 | desktop |
| akademie/objednavka/index.html | `div.order:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(3) > ` | Chci doživotní přístup za 8 900 Kč → | #6b4e08 | #e0a820 | 3.6 | desktop |
| akademie/studium/index.html | `#contBtn` | ▶ Začít: Proč lidé jedí, i když nemají hlad | #6b4e08 | #e0a820 | 3.6 | desktop |
| akademie/vitejte/index.html | `div.wrap:nth-of-type(2) > div.card:nth-of-type(2) > a.cta` | Vytvořit přístup do Academy → | #6b4e08 | #e0a820 | 3.6 | desktop |
| nastroje-zdarma/index.html | `div.wrap:nth-of-type(2) > div.grid > a.card:nth-of-type(2) > div.ico:nth-of-type(1)` | 🏋️ | #6b4e08 | #e0a820 | 3.6 | desktop |
| akademie/videokurz/kalkulacka/index.html | `div.wrap:nth-of-type(2) > p.tip:nth-of-type(2) > a` | modulech videokurzu | #c45e00 | #f6f1ea | 3.78 | mobil |
| akademie/videokurz/kalkulacka/index.html | `div.wrap:nth-of-type(2) > p.tip:nth-of-type(2) > a` | modulech videokurzu | #c45e00 | #f6f1ea | 3.78 | desktop |
| akademie/praxe/index.html | `#d2 > ul:nth-of-type(1) > li:nth-of-type(1) > span.hint:nth-of-type(2)` | (1 = mimo, 5 = podle plánu) | #8a8276 | #ffffff | 3.79 | mobil |
| akademie/praxe/index.html | `#d3 > p:nth-of-type(2) > span.hint:nth-of-type(4)` | (stejné světlo, stejné místo, stejný čas) | #8a8276 | #ffffff | 3.79 | mobil |
| akademie/praxe/index.html | `#d4 > ul:nth-of-type(2) > li:nth-of-type(2) > span.hint:nth-of-type(2)` | (počítej poctivě 1–1,5 h) | #8a8276 | #ffffff | 3.79 | mobil |
| akademie/praxe/index.html | `#d4 > ul:nth-of-type(2) > li:nth-of-type(3) > span.hint:nth-of-type(2)` | (hodiny ÷ čas na klienta; nech si 20 % rezervu) | #8a8276 | #ffffff | 3.79 | mobil |
| akademie/praxe/index.html | `#d2 > ul:nth-of-type(1) > li:nth-of-type(1) > span.hint:nth-of-type(2)` | (1 = mimo, 5 = podle plánu) | #8a8276 | #ffffff | 3.79 | desktop |
| akademie/praxe/index.html | `#d3 > p:nth-of-type(2) > span.hint:nth-of-type(4)` | (stejné světlo, stejné místo, stejný čas) | #8a8276 | #ffffff | 3.79 | desktop |
| akademie/praxe/index.html | `#d4 > ul:nth-of-type(2) > li:nth-of-type(2) > span.hint:nth-of-type(2)` | (počítej poctivě 1–1,5 h) | #8a8276 | #ffffff | 3.79 | desktop |
| akademie/praxe/index.html | `#d4 > ul:nth-of-type(2) > li:nth-of-type(3) > span.hint:nth-of-type(2)` | (hodiny ÷ čas na klienta; nech si 20 % rezervu) | #8a8276 | #ffffff | 3.79 | desktop |
| makro-plan/index.html | `div.wrap > div.grid3:nth-of-type(2) > figure:nth-of-type(1) > figcaption > span.src` | Google | #8a8178 | #ffffff | 3.82 | mobil |
| makro-plan/index.html | `div.wrap > div.grid3:nth-of-type(2) > figure:nth-of-type(2) > figcaption > span.src` | Google | #8a8178 | #ffffff | 3.82 | mobil |
| makro-plan/index.html | `div.wrap > div.grid3:nth-of-type(2) > figure:nth-of-type(3) > figcaption > span.src` | Google | #8a8178 | #ffffff | 3.82 | mobil |
| makro-plan/index.html | `div.wrap > div.grid3:nth-of-type(2) > figure:nth-of-type(1) > figcaption > span.src` | Google | #8a8178 | #ffffff | 3.82 | desktop |
| makro-plan/index.html | `div.wrap > div.grid3:nth-of-type(2) > figure:nth-of-type(2) > figcaption > span.src` | Google | #8a8178 | #ffffff | 3.82 | desktop |
| makro-plan/index.html | `div.wrap > div.grid3:nth-of-type(2) > figure:nth-of-type(3) > figcaption > span.src` | Google | #8a8178 | #ffffff | 3.82 | desktop |
| treninky.html | `div.container > div.row.g-4.justify-content-center:nth-of-type(2) > div.col-md-6.col-lg-3:` | 1 190 Kč / lekce | #7a857d | #ffffff | 3.83 | mobil |
| treninky.html | `div.container > div.row.g-4.justify-content-center:nth-of-type(2) > div.col-md-6.col-lg-3:` | 990 Kč / lekce | #7a857d | #ffffff | 3.83 | mobil |
| treninky.html | `div.container > div.row.g-4.justify-content-center:nth-of-type(2) > div.col-md-6.col-lg-3:` | 900 Kč / lekce | #7a857d | #ffffff | 3.83 | mobil |
| treninky.html | `div.container > div.row.g-4.justify-content-center:nth-of-type(2) > div.col-md-6.col-lg-3:` | 850 Kč / lekce | #7a857d | #ffffff | 3.83 | mobil |
| treninky.html | `div.container > div.row.g-4.justify-content-center:nth-of-type(2) > div.col-md-6.col-lg-3:` | 1 190 Kč / lekce | #7a857d | #ffffff | 3.83 | desktop |
| treninky.html | `div.container > div.row.g-4.justify-content-center:nth-of-type(2) > div.col-md-6.col-lg-3:` | 990 Kč / lekce | #7a857d | #ffffff | 3.83 | desktop |
| treninky.html | `div.container > div.row.g-4.justify-content-center:nth-of-type(2) > div.col-md-6.col-lg-3:` | 900 Kč / lekce | #7a857d | #ffffff | 3.83 | desktop |
| treninky.html | `div.container > div.row.g-4.justify-content-center:nth-of-type(2) > div.col-md-6.col-lg-3:` | 850 Kč / lekce | #7a857d | #ffffff | 3.83 | desktop |
| forma-zpet/index.html | `div.wrap > div.grid3:nth-of-type(2) > figure:nth-of-type(1) > figcaption > span.src` | Google | #7d8288 | #ffffff | 3.87 | mobil |
| forma-zpet/index.html | `div.wrap > div.grid3:nth-of-type(2) > figure:nth-of-type(2) > figcaption > span.src` | Facebook | #7d8288 | #ffffff | 3.87 | mobil |
| forma-zpet/index.html | `div.wrap > div.grid3:nth-of-type(2) > figure:nth-of-type(3) > figcaption > span.src` | Facebook | #7d8288 | #ffffff | 3.87 | mobil |
| forma-zpet/index.html | `div.wrap > div.grid3:nth-of-type(2) > figure:nth-of-type(1) > figcaption > span.src` | Google | #7d8288 | #ffffff | 3.87 | desktop |
| forma-zpet/index.html | `div.wrap > div.grid3:nth-of-type(2) > figure:nth-of-type(2) > figcaption > span.src` | Facebook | #7d8288 | #ffffff | 3.87 | desktop |
| forma-zpet/index.html | `div.wrap > div.grid3:nth-of-type(2) > figure:nth-of-type(3) > figcaption > span.src` | Facebook | #7d8288 | #ffffff | 3.87 | desktop |
| forma-zpet/index.html | `div.wrap > div.form-card > form.lead-form > label:nth-of-type(3) > span` | (nepovinné) | #8a8073 | #ffffff | 3.88 | mobil |
| forma-zpet/index.html | `#formular > div.wrap > div.form-card > form.lead-form > p:nth-of-type(2)` | Odesláním souhlasíš se zasláním plánu a občasných tipů. Odhl | #8a8073 | #ffffff | 3.88 | mobil |
| makro-plan/index.html | `div.wrap > div.form-card > form.lead-form > label:nth-of-type(3) > span` | (nepovinné) | #8a8073 | #ffffff | 3.88 | mobil |
| makro-plan/index.html | `#formular > div.wrap > div.form-card > form.lead-form > p:nth-of-type(2)` | Odesláním souhlasíš se zasláním plánu a občasných tipů. Odhl | #8a8073 | #ffffff | 3.88 | mobil |
| forma-zpet/index.html | `div.wrap > div.form-card > form.lead-form > label:nth-of-type(3) > span` | (nepovinné) | #8a8073 | #ffffff | 3.88 | desktop |
| forma-zpet/index.html | `#formular > div.wrap > div.form-card > form.lead-form > p:nth-of-type(2)` | Odesláním souhlasíš se zasláním plánu a občasných tipů. Odhl | #8a8073 | #ffffff | 3.88 | desktop |
| makro-plan/index.html | `div.wrap > div.form-card > form.lead-form > label:nth-of-type(3) > span` | (nepovinné) | #8a8073 | #ffffff | 3.88 | desktop |
| makro-plan/index.html | `#formular > div.wrap > div.form-card > form.lead-form > p:nth-of-type(2)` | Odesláním souhlasíš se zasláním plánu a občasných tipů. Odhl | #8a8073 | #ffffff | 3.88 | desktop |
| clanky/doporuceni-bisglycinatu-horciku-pro-vas-aktivni-zivotni-styl.html | `div.wrapc:nth-of-type(2) > article > div.inline-magnet:nth-of-type(2) > a` | Chci plán zdarma | #6b4e08 | #ebb12c | 3.99 | mobil |
| clanky/funguje-wobenzym.html | `div.wrapc:nth-of-type(2) > article > div.inline-magnet:nth-of-type(2) > a` | Chci plán zdarma | #6b4e08 | #ebb12c | 3.99 | mobil |
| clanky/kofein-a-jeho-bezpecna-konzumace.html | `div.wrapc:nth-of-type(2) > article > div.inline-magnet:nth-of-type(2) > a` | Chci plán zdarma | #6b4e08 | #ebb12c | 3.99 | mobil |
| clanky/kreatin-nejen-pro-svaly-ale-i-pro-mozek.html | `div.wrapc:nth-of-type(2) > article > div.inline-magnet:nth-of-type(3) > a` | Chci plán zdarma | #6b4e08 | #ebb12c | 3.99 | mobil |
| konzultace/index.html | `div.wrap > div.contact > div:nth-of-type(1) > div.btn-row > a.btn.btn-acc` | Objednat za 2 990 Kč → | #6b4e08 | #ebb12c | 3.99 | mobil |
| pro-vas/index.html | `#cena > div.wrap > p:nth-of-type(2) > span` | Nejlepší hodnota · Prvních 50 zakládajících | #6b4e08 | #ebb12c | 3.99 | mobil |
| poukaz/index.html | `div.wrap > div.contact > div:nth-of-type(1) > div.btn-row > a.btn.btn-acc` | Poradit s výběrem → | #6b4e08 | #ebb12c | 3.99 | mobil |
| clanky/doporuceni-bisglycinatu-horciku-pro-vas-aktivni-zivotni-styl.html | `div.wrapc:nth-of-type(2) > article > div.inline-magnet:nth-of-type(2) > a` | Chci plán zdarma | #6b4e08 | #ebb12c | 3.99 | desktop |
| clanky/funguje-wobenzym.html | `div.wrapc:nth-of-type(2) > article > div.inline-magnet:nth-of-type(2) > a` | Chci plán zdarma | #6b4e08 | #ebb12c | 3.99 | desktop |
| clanky/kofein-a-jeho-bezpecna-konzumace.html | `div.wrapc:nth-of-type(2) > article > div.inline-magnet:nth-of-type(2) > a` | Chci plán zdarma | #6b4e08 | #ebb12c | 3.99 | desktop |
| clanky/kreatin-nejen-pro-svaly-ale-i-pro-mozek.html | `div.wrapc:nth-of-type(2) > article > div.inline-magnet:nth-of-type(3) > a` | Chci plán zdarma | #6b4e08 | #ebb12c | 3.99 | desktop |
| konzultace/index.html | `div.wrap > div.contact > div:nth-of-type(1) > div.btn-row > a.btn.btn-acc` | Objednat za 2 990 Kč → | #6b4e08 | #ebb12c | 3.99 | desktop |
| poukaz/index.html | `div.wrap > div.contact > div:nth-of-type(1) > div.btn-row > a.btn.btn-acc` | Poradit s výběrem → | #6b4e08 | #ebb12c | 3.99 | desktop |
| pro-vas/index.html | `#cena > div.wrap > p:nth-of-type(2) > span` | Nejlepší hodnota · Prvních 50 zakládajících | #6b4e08 | #ebb12c | 3.99 | desktop |
| kalkulacka-kalorii-a-makrozivin/index.html | `#freeplan-cta > div.fp-inner > div.fp-txt > span.fp-kick` | Zdarma · bez závazku | #b85600 | #fcebce | 4.09 | mobil |
| kalkulacka-kalorii-a-makrozivin/index.html | `#freeplan-cta > div.fp-inner > div.fp-txt > span.fp-kick` | Zdarma · bez závazku | #b85600 | #fcebce | 4.09 | desktop |
| akademie/index.html | `#zdarma > div.container > div.acards:nth-of-type(2) > a.acard:nth-of-type(3) > span.ai:nth` | 🏋️ | #0d6efd | #fff4e8 | 4.15 | mobil |
| akademie/index.html | `#zdarma > div.container > div.acards:nth-of-type(2) > a.acard:nth-of-type(7) > span.ai:nth` | 🖼️ | #0d6efd | #fff4e8 | 4.15 | mobil |
| akademie/index.html | `#zdarma > div.container > div.acards:nth-of-type(2) > a.acard:nth-of-type(3) > span.ai:nth` | 🏋️ | #0d6efd | #fff4e8 | 4.15 | desktop |
| akademie/index.html | `#zdarma > div.container > div.acards:nth-of-type(2) > a.acard:nth-of-type(7) > span.ai:nth` | 🖼️ | #0d6efd | #fff4e8 | 4.15 | desktop |

## Nálezy tmavý motiv (shrnutí)

Celkem 2580 prvků pod 4.5. Otisk (mobil, pod 2) se opravou světlého režimu **nesmí** změnit.

| Výskytů | Stránek | Selektor (zkrácený) | Příklad | Pomer |
|---:|---:|---|---|---:|
| 842 | 150 | `div.wrapc > article > div.cta-box > a.btn.gold` | Pro muže 35+ | 1.62 |
| 376 | 188 | `div.wrap > p.foot` | Databáze cviků je součást | 3.5 |
| 302 | 151 | `div.wrapc > article > div.author-box > div > a.btn.gold` | Chci koučink na míru | 1.62 |
| 242 | 121 | `div.wrapc > article > div.cta-box > a.btn` | Plán zdarma | 1.62 |
| 112 | 2 | `div.pad > div.day > div.meal > div.mm > span.chip.b` | B | 1.93 |
| 112 | 2 | `div.day > div.meal > div.mm > span.chip.b > b` | 30 | 1.93 |
| 112 | 2 | `div.pad > div.day > div.meal > div.mm > span.chip.s` | S | 3.53 |
| 112 | 2 | `div.day > div.meal > div.mm > span.chip.s > b` | 35 | 3.53 |
| 112 | 2 | `div.pad > div.day > div.meal > div.mm > span.chip.t` | T | 2.28 |
| 112 | 2 | `div.day > div.meal > div.mm > span.chip.t > b` | 25 | 2.28 |
| 26 | 1 | `#d5 > ul > li > span.cb` | ☐ | 1.93 |
| 14 | 1 | `#d1 > ul > li > span.cb` | ☐ | 1.93 |
| 14 | 1 | `#d4 > ul > li > span.cb` | ☐ | 1.93 |
| 8 | 1 | `#d3 > ul > li > span.cb` | ✓ | 1.93 |
| 8 | 2 | `div.pad > div.day > div.dhead > div.dl > span.dtag.t-train` | tréninkový den | 1.28 |
| 6 | 1 | `#d3 > p > span.cb` | ☐ | 1.93 |
| 6 | 2 | `main.card > div > a.btn` | Chci videokurz za 800 Kč → | 1.62 |
| 4 | 1 | `#obsah > div.container > div.mt-4.d-flex.flex-wrap > a.btn-gold` | Chci Academy: 8 900 Kč → | 1.93 |
| 4 | 1 | `div.container > div > div > div > a.btn-gold.w-100` | Začít za 990 Kč měsíčně → | 1.62 |
| 4 | 2 | `div.wrap > div.grid > a.card > div.ico` | 🏋️ | 1.36 |
| 4 | 1 | `#d2 > p.hint` | Važte se každé ráno nalačno po toaletě a zapište s | 3.79 |
| 4 | 1 | `#d4 > ul > li > span.hint` | (počítej poctivě 1–1,5 h) | 3.79 |
| 4 | 2 | `main.card > a.btn` | Vytvořit přístup do Academy → | 1.62 |
| 4 | 2 | `section.final > div.wrap > h2` | Začni dostávat formu zpátky ještě tento týden | 1.93 |
| 4 | 2 | `section.final > div.wrap > p.fine` | Zdarma · Bez závazků · Tvůj e-mail nikam nedáme ·  | 1.52 |
| 4 | 1 | `main.wrap-main > p.shot-src > a` | Google · 46 recenzí | 1.2 |
| 2 | 1 | `#co-dostanes > div.container > div.text-center.mt-4 > a.btn-gold` | Chci to celé → | 1.62 |
| 2 | 1 | `#ai-martin-sekce > div.container > div.text-center.mt-3 > a.btn-gold` | Chci do Academy → | 1.62 |
| 2 | 1 | `#zajem > div.container > div.pricebox > div.mt-3.d-flex.flex-column > a.btn-gold` | Koupit Academy: 8 900 Kč → | 1.93 |
| 2 | 1 | `#foot` | Barna Academy · Martin Barna · online výživa a fit | 3.5 |
| 2 | 1 | `div.wrap > div.ctaWrap > a.cta` | Otevřít přihlášení → | 1.36 |
| 2 | 1 | `#d1 > p.hint` | Měříme ráno nalačno, vždy na stejném místě. Fotky  | 3.79 |
| 2 | 1 | `#d2 > ul > li > span.hint` | (1 = mimo, 5 = podle plánu) | 3.79 |
| 2 | 1 | `#d3 > p > span.hint` | (stejné světlo, stejné místo, stejný čas) | 3.79 |
| 2 | 1 | `div.wrap > div.crumb` | Nástroj · Materiály | 2.4 |
| 2 | 1 | `div.wrap > p.tip > a` | modulech videokurzu | 3.78 |
| 2 | 1 | `div.wrapc > article > div.academy-box > a.btn` | Prozkoumat Barna Academy → | 1.93 |
| 2 | 1 | `div.wrapc > article > div.academy-box > a.btn.gold` | Prozkoumat Barna Academy → | 1.93 |
| 2 | 1 | `section.promeny > div.promeny-cta > a.btn` | Chci stejnou změnu | 1.93 |
| 2 | 1 | `main.wrap-main > div.cta-strip > a.btn` | Objednat konzultaci → | 1.93 |

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
