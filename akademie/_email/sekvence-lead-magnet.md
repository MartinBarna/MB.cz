# Lead-magnet e-mailová sekvence — copy (zdroj pro Resend/Supabase)

**Stav:** návrh copy k odsouhlasení. Tóny dle `akademie/_voice/martin-hlas.md` (Be Effective!, tykání, přímost, střídmě emoji, „není to sprint, ale maraton", „neprodávám ryby — učím rybařit").
**Odesílatel:** `news@martinbarna.cz` · **From name:** Martin Barna
**Merge fields:** `{{first_name}}` (fallback „ahoj"), `{{lead_magnet_url}}`, `{{unsubscribe_url}}` (POVINNÉ v patičce každého marketingového mailu).
**Větev podle pohlaví:** ŽENY = lead magnet „7denní makro plán" (`/makro-plan`), MUŽI = „forma zpět plán" (`/forma-zpet`). Texty níže jsou unisex; { } označuje variantu.

**Mapování na funnel (zadání: free content → course offer → discount → affiliate):**
| # | Den | Fáze | Cíl |
|---|-----|------|-----|
| 1 | 0 (ihned) | doručení | předat lead magnet, nastavit očekávání |
| 2 | +2 | hodnota | důvěra — nejčastější chyba |
| 3 | +4 | hodnota | důvěra — jak jíst flexibilně + soft zmínka kurzu |
| 4 | +6 | **course offer** | nabídka videokurzu 800 Kč |
| 5 | +9 | **discount** | sleva na kurz (jen kdo neklikl/nekoupil) |
| 6 | +14 | **affiliate** | doporučení + komunita |

**Větvení (logika, ne text):**
- Kdo koupí videokurz (Purchase z CAPI/Supabase) → STOP této větve, přesun do větve „majitel kurzu → upsell Academy" (#38).
- Mail 5 (sleva) pošli jen pokud lead NEklikl na nákup z mailu 4 (no `begin_checkout`/Purchase).
- Slevový kód = jednorázový z SimpleShopu (dodá Cowork/Martin). Hlídat marži (viz #36/#39).

---

## Mail 1 — Doručení (den 0, ihned po odeslání formuláře)
**Subject:** Tady máš svůj plán, {{first_name}} 💪
**Preheader:** Otevři, stáhni a rovnou se do toho dáme.

Ahoj {{first_name}}!

Tak jak jsem slíbil — přece sis nemyslel{a}, že Ti nepošlu aspoň přílohu :) Tady je tvůj **7denní {makro plán / plán „forma zpět"}**:

👉 **[Stáhnout plán]({{lead_magnet_url}})**

Co s tím:
- Otevři ho ještě dnes a mrkni na **den 1** — žádná věda, jasné porce, běžné potraviny.
- Nemusíš nic vážit ani počítat. Stačí jet podle plánu.
- Nejde o dokonalost. Jde o to **začít** a být v tom poctivý sám k sobě.

Příští dny Ti pošlu pár věcí, co dělají u mých klientů největší rozdíl — krátce a k věci, žádné romány.

Drž se, ozvi se klidně kdykoliv. **Be Effective!**
Martin

*P.S. Odpověz mi na tenhle mail jednou větou: co je teď tvoje největší překážka? Čtu si to.*

---

## Mail 2 — Nejčastější chyba (den +2)
**Subject:** Chyba č. 1, na které lidi shoří
**Preheader:** A není to „málo silné vůle".

Ahoj {{first_name}},

Za roky praxe a 600+ proměn vidím pořád dokola jednu věc: lidi to vzdají **po prvním malém úspěchu**. Zhubnou dvě kila, uchlácholí se — a vrátí se do starých kolejí.

Hubnutí není sprint, je to **maraton**. A váha bude kolísat i když děláš všechno správně (tohle musím klientům opakovat pořád :-D). Den nahoru neznamená, že nefunguješ.

Co s tím dneska:
- Neřeš jeden den. Řeš **týdenní průměr**.
- Někdy je **udržení místo přibrání taky výhra**.
- Buď k sobě poctivý{á} — když si „nemažeš med kolem huby" a vidíš, žes snědl{a} víc, jsi o krok dál než většina.

Zítra… ne, za dva dny Ti ukážu, jak jíst flexibilně, aby ses nemusel{a} vzdávat oblíbených jídel.

**Be Effective!**
Martin

---

## Mail 3 — Jak jíst flexibilně (den +4)
**Subject:** Jak jíst řízek a pizzu a stejně zhubnout
**Preheader:** Žádné zakázané jídlo. Vážně.

Ahoj {{first_name}},

Nejčastější mýtus: „abych zhubl{a}, musím vyřadit X". Nemusíš.

Funguje to jednoduše — **neprodávám ryby, učím rybařit**. Místo striktního jídelníčku Tě naučím, jak si jídlo poskládáš sám{a} z toho, co Ti chutná a na co máš „rozpočet" (kalorií a bílkovin). Pak si dáš i pizzu a pořád jedeš dolů.

3 věci, co fungují hned:
1. **Bílkovina v každém jídle** — zasytí a drží svaly.
2. **Nejdřív zelenina a bílkovina, pak zbytek** — automaticky sníš míň, bez hladu.
3. **Plánuj dopředu** — méně rozhodování = víc úspěchu.

Tohle všechno (a mnohem víc do hloubky) Tě krok za krokem provedu ve svém **videokurzu**. Ale o tom víc příště — dnes si vyzkoušej ten bod 1 ✅

**Be Effective!**
Martin

---

## Mail 4 — Nabídka videokurzu (den +6) · COURSE OFFER
**Subject:** Chceš to celé, krok za krokem?
**Preheader:** Videokurz výživy — všechno, co učím klienty, na jednom místě.

Ahoj {{first_name}},

Plán máš. Pár principů taky. Jestli chceš **celý systém** — ne jen ochutnávku — mám pro Tebe **Videokurz výživy**.

Je to všechno, co roky učím své klienty za tisíce korun měsíčně, sepsané a natočené tak, aby to pochopil úplný začátečník:
- jak si **sám{a} sestavíš jídelníček**, který Tě baví a funguje
- jak **nepřibrat zpátky** (konec jojo efektu)
- bílkoviny, kalorie, flexibilní stravování — prakticky, bez vědeckých keců
- doživotní přístup, koukáš kdy chceš

👉 **[Chci videokurz za 800 Kč]({{course_url}})**

Jeden řízek navíc týdně Tě stojí víc. Tohle Ti zůstane napořád.

**Be Effective!**
Martin

*P.S. Máš dotaz, jestli je to pro Tebe? Napiš mi na WhatsApp, však víš :) Řeknu Ti narovinu.*

---

## Mail 5 — Sleva (den +9) · DISCOUNT — JEN kdo neklikl/nekoupil
**Subject:** {{first_name}}, mám pro Tebe -{{discount_pct}} %
**Preheader:** Krátké okno, ať Tě to nakopne.

Ahoj {{first_name}},

Vím, jak to chodí — „udělám to později". A později nikdy nepřijde :)

Ať Tě nakopnu: na **Videokurz výživy** Ti dávám **slevu -{{discount_pct}} %** s kódem **`{{discount_code}}`**. Platí **do {{discount_deadline}}**.

👉 **[Odemknout kurz se slevou]({{course_url}})**

Nečekej na „ideální pondělí". Ideální je teď. Zvládneš to.

**Be Effective!**
Martin

---

## Mail 6 — Doporučení + komunita (den +14) · AFFILIATE
**Subject:** Znáš někoho, kdo to taky řeší?
**Preheader:** Pošli to dál — vyhrajete oba.

Ahoj {{first_name}},

Ať už ses do toho pustil{a} naplno, nebo zatím jedeš podle plánu — díky, že jsi tady.

Jednu prosbu i nabídku: **znáš někoho**, kdo se trápí se stravou a pořád to vzdává? Pošli mu tenhle odkaz na plán zdarma:

👉 **[martinbarna.cz/{makro-plan / forma-zpet}](…)**

A až spustíme **doporučovací program**, dostaneš za každého, koho přivedeš, **odměnu** (sleva pro kamaráda + bonus pro Tebe — cash, nebo ještě výhodnější kredit do našeho ekosystému). Dám Ti vědět jako prvním.

Drž se a jedeme bomby!
**Be Effective!**
Martin

---

### Patička (každý mail)
> Tento e-mail jsi dostal{a}, protože sis stáhl{a} plán zdarma na martinbarna.cz.
> Nechceš už e-maily? **[Odhlásit se]({{unsubscribe_url}})** — jedním klikem, bez urážky :)
> Martin Barna — online výživový Coach · martinbarna.cz

### Otevřené proměnné (dodá Cowork/Martin)
- `{{course_url}}` — SimpleShop odkaz na videokurz (znám 800 Kč produkt; potřebuju finální URL)
- `{{discount_code}}` + `{{discount_pct}}` + `{{discount_deadline}}` — SimpleShop slevový kód
- `{{lead_magnet_url}}` — hostované PDF plánu (ženy / muži) — kde leží?
- frekvence/časování dnů lze doladit (default výše)
