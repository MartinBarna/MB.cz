# QA: poukazy (vzhled web + vydat hardening) a X Articles drafty

Nezávislá kontrola, 26. 8. 2026. Kontrolované větve jsem neměnil ani nemergoval. Základ porovnání: `origin/main` (`1dd9f589e`).

| Větev | HEAD | Verdikt merge |
| --- | --- | --- |
| `cloud-poukaz-vzhled-web` | `2625a3668` | **ANO** |
| `cloud-poukaz-vydat-hardening` | `e1e42dffd` | **ANO** (do gitu). SQL nespouštět. Před dalším deployem funkce viz rizika. |
| `cloud-x-articles-drafty` | `ab9e20950` | **ANO** (jsou to drafty, ne publikace) |

---

## 1) `cloud-poukaz-vzhled-web`

Diff proti main: 1 soubor, `poukaz/index.html` (+18 / −3). Celý diff je přepis dvou vět v kroku 1 a popisku ukázky plus nová sekce `#vzhled`.

### Věcná správnost

Tři vzhledy na stránce sedí s tím, co zapisuje `poukaz-vydat` a co už leží v DB (`tmava` / `svetla` / `slavnostni`). Výběr není dropdown na `poukaz/index.html`. Je to Stripe custom field `vzhledpoukazu` na payment lince, copy to říká správně: „Při platbě si zvolíš“.

Živá tabulka `public.poukazy` (Barna Academy, jen počty, žádné e-maily): `tmava` 3, `svetla` 3, `slavnostni` 1, prázdný řetězec 1. Tři volby se tedy naostro používají. Prázdný řádek sedí s tím, že pole na starším checkoutu chybělo, nebo že dropdown není povinný.

PDF ukázka `/assets/poukaz/poukaz-ukazka.png` je tmavý vzhled (černý podklad, zlaté popisky, bílý text). Soubor větev neměnila.

### Obsah nezmizel

Porovnání viditelného textu main vs. větev: zmizely jen dvě přepsané věty (krok 1 bez zmínky o vzhledu, popisek „Přesně takhle vypadá PDF poukaz…“). Sekce Komu se dává / Vyber poukaz / Co potom / Reference / FAQ / závěrečné CTA / patička zůstaly. Nová sekce je vsunutá mezi „Jak to funguje“ a „Co když bude chtít pokračovat“.

### Dlouhá pomlčka

V `poukaz/index.html` na větvi: 0 výskytů `—`.

### Nálezy (neblokující)

1. **Popisek ukázky neříká, že jde o tmavý vzhled.** Alt i figcaption mluví o „jednom ze tří“, ne o tmavé zlaté. Fakticky je to tmavá. Čtenář to z textu nepozná.

```385:386:poukaz/index.html
            <img src="/assets/poukaz/poukaz-ukazka.png" alt="Ukázka jednoho ze tří vzhledů dárkového poukazu" width="1200" height="849" loading="lazy" decoding="async">
            <figcaption>Jeden ze tří vzhledů, vybereš si ho při platbě.</figcaption>
```

(řádky na kontrolované větvi)

2. **Názvy vs. Stripe labely.** Stránka: „Tmavý zlatý“ / „Světlý na tisk“ / „Slavnostní“. Komentář ve funkci (měřeno v API 26. 8. 2026): „Tmavá zlatá“ / „Světlá na tisk“ / „Slavnostní“. Rod u prvních dvou nesedí. Na checkoutu uvidí kupující jiné znění než na webu.

3. **H2 „Vyber vzhled poukazu“ bez ovládacího prvku.** Výběr je až ve Stripe. Podtitulek to zachraňuje, nadpis svádí klikat na karty. Karty dalších vzhledů jsou schválně bez obrázků (komentář ve zdroji).

4. **FAQ vzhled neřeší.** Stávající otázky o tisku a PDF zůstaly, nová volba tam není. Není to ztráta obsahu, jen mezera.

### Verdikt

**MERGE ANO.** Copy je aditivní, nic podstatného nesmazala, pomlčka `—` v textu není, tři vzhledy i fakt, že ukázka je tmavá, sedí. Nálezy 1–3 jsou úpravy copy, ne důvod vracet větev.

---

## 2) `cloud-poukaz-vydat-hardening`

Dva commity proti main:

1. `53635954d` záchrana celého zdrojáku `poukaz-vydat` do gitu (na mainu v `akademie/_supabase/functions/` není).
2. `e1e42dffd` vlastní hardening: `core.ts` + `docs/poukaz-vzhled-check-migrace.sql` (+26 / −4).

Celý diff větve je 12 souborů, +2343 řádků. Hardening samotný je 14 řádků v `core.ts` a 16 řádků SQL návrhu.

### `console.error` loguje surovou hodnotu i session id

Ano, jen ve větvi fallbacku (neznámá / chybějící / nemapovatelná hodnota). Kanonické i syrové Stripe tvary (`tmavzlat` / `svtlnatisk` / `slavnostn`) se zalogují tiše, to je správně.

```246:254:akademie/_supabase/functions/poukaz-vydat/core.ts
function normalizeVzhledForStorage(raw: string, sessionId?: string): string {
  if (raw === 'tmava' || raw === 'svetla' || raw === 'slavnostni') return raw;
  const mapped = STRIPE_RAW_VZHLED_TO_CANONICAL[raw];
  if (mapped) return mapped;
  console.error(
    `[poukaz-vydat] neznámý/chybějící vzhled poukazu, padám na tmava; raw=${JSON.stringify(raw)} sessionId=${JSON.stringify(sessionId ?? null)}`,
  );
  return 'tmava';
}
```

Volání: `normalizeVzhledForStorage(extractVzhled(session.custom_fields), session.id)`. `JSON.stringify` u `raw` i `sessionId` unese prázdný řetězec i `null`.

Živá nasazená funkce `poukaz-vydat` v7 (Barna Academy) **tenhle log ještě nemá**. Pořád padá tiše: `STRIPE_RAW_VZHLED_TO_CANONICAL[raw] ?? 'tmava'` bez `console.error` a bez `session.id`. Merge do gitu ≠ deploy.

Testy pokrývají mapování syrové hodnoty a default `tmava` při prázdném poli. **Neassertují**, že `console.error` dostane `raw` a `sessionId`. Mezera v testu, chování v kódu sedí.

### Default zůstal tmavý

Ano. Fallback vrací `'tmava'`. V `lib/pdf.ts` je `DEFAULT_VZHLED: VoucherVzhled = 'tmava'`. Sloupec v DB: `text NOT NULL DEFAULT 'tmava'`.

### SQL je návrh, nespouštělo se

Soubor začíná „NÁVRH. Nespouštět. Žádnou migraci neaplikovat.“ Leží v `docs/`, ne v migracích.

Ověřeno proti živé DB (jen čtení):

- Migrace `poukazy_vzhled` (`20260825213835`) už existuje. Přidala sloupec, ne CHECK.
- Na `public.poukazy` je CHECK jen u `status`. Constraint `poukazy_vzhled_check` **není**.
- Navržený `ALTER TABLE … ADD CONSTRAINT poukazy_vzhled_check` tedy v produkci neběžel.

V komentáři SQL je dlouhá pomlčka (`—` na řádku 6). Je to docs, ne uživatelský text. Na funkci to nic nemění.

### Rizika nasazení

1. **Navržený CHECK by dnes spadl.** V `poukazy.vzhled` je 1 řádek s `''`. `CHECK (vzhled = ANY (ARRAY['tmava','svetla','slavnostni']))` prázdný řetězec odmítne. Komentář v SQL to předvídá (`SELECT vzhled, count(*) …`). Než by se CHECK spouštěl, ten řádek se musí opravit (nejspíš na `tmava`) a ověřit, že nikde není syrový Stripe tvar.

2. **Stejná past jako u `entitlements.product`.** CHECK v DB kódová revize nevidí. Kdyby ho někdo spustil bez toho `SELECT`, `ALTER` spadne na starých řádcích. Nové inserty by defaultem `tmava` prošly. Nespouštět z merge.

3. **Záchranný commit nedotáhl deployovatelný strom.** `index.ts` importuje `../_shared/signature.ts`. Ten soubor **není v gitu** (ani main, ani tahle větev). Nasazený bundle ho má. `akademie/_supabase/functions/` je zdroj pravdy pro CLI deploy, staging `supabase/` je gitignore. Deploy z tohoto stromu by na importu umřel, živou funkci by to mohlo přepsat rozbitou verzí. Před deployem: `get_edge_function` vs. repo, a `_shared/signature.ts` buď přidat, nebo deployovat ze staging kopie, která ten soubor má.

4. **Duplicitní mapa Stripe hodnot** v `core.ts` a `lib/pdf.ts`. Komentář to přiznává. Když se labely na lince změní, musí se hnout obě místa, jinak se do DB uloží kanonická hodnota a PDF může spadnout na tmavou (nebo naopak).

5. **`console.error` místo `deps.logError`.** Do Deno logů to dojde. Testy `logError` nechytí. Není to blokace.

6. Merge samotný edge funkci nenasadí. Až se bude nasazovat, neřetězit push a deploy. Nejdřív push, ověřit SHA na origin, teprve potom funkce, pak přečíst nasazený zdroj.

### Verdikt

**MERGE ANO** do gitu: log i default jsou správně, SQL je opravdu jen návrh a v DB neběží.

**NE spouštět** `docs/poukaz-vzhled-check-migrace.sql`, dokud v `poukazy.vzhled` není nula prázdných a nula syrových Stripe tvarů.

**Nenasazovat** `poukaz-vydat` z tohoto stromu naslepo kvůli chybějícímu `_shared/signature.ts`.

---

## 3) `cloud-x-articles-drafty`

11 nových souborů v `docs/x-articles/`. Nic se na X samo neposílá. Náhodný vzorek (seed `20260826`): **01, 08, 09**.

Grep celého adresáře: 0× `—`. Žádné `Kč` jako cena produktu. Titulky všech 10 draftů jsou 1:1 s tabulkou v `KALENDAR-navrh.md`. Žádný titulek nemá číslici.

### Draft 01 `01-jak-zacit-hubnout.md` vs `clanky/jak-zacit-hubnout.html`

| Kontrola | Výsledek |
| --- | --- |
| Věcná shoda | Sedí. Lichtman 47 % / 51 %, Raber, deficit 15–20 %, 0,3–0,7 kg/týden, 7 700 kcal, Leidy 1,5 vs 2,8 kg, Lopez 1,6 / 0,8 kg, bílkoviny 1,6–2,2 g/kg. Čtyři týdny a FAQ opsané ze zdroje. |
| Ceny | Nejsou. |
| CTA | Prodejní boxy ze zdroje (makro plán / forma zpět, „Mohlo by tě zajímat“, author box s koučinkem) v draftu nejsou. Povolená věta na `https://martinbarna.cz/` na konci je. V těle zůstaly 4 odkazy na jiné články webu (deficit, bílkoviny, talíř, kroky), stejně jako ve zdroji. Kalendář říká „žádné další CTA“; pokud CTA = prodej, je to v pořádku. Pokud CTA = jakýkoli odkaz mimo homepage, 01 to porušuje. |
| Dlouhá pomlčka | Ne. |
| Titulek | `Jak začít hubnout bez drastické diety`. Zdrojové H1 má „první 4 týdny“. Číslo z titulku zmizelo, to je správně. „Bez drastické diety“ je metoda, ne slib výsledku. Kalendář to sám označuje jako titulek bez slibů a bez čísel. |

### Draft 08 `08-pomaly-metabolismus.md` vs `clanky/pomaly-metabolismus-mytus.html`

| Kontrola | Výsledek |
| --- | --- |
| Věcná shoda | Sedí. Podhodnocený příjem, slepá místa (porce, dojídání, víkend, tekutiny, vaření), páky sval / NEAT / bílkoviny / spánek, adaptivní termogeneze jako malý a vratný efekt, hypotyreóza k lékaři, Be Effective. Závěrečná věta je mírně parafrázovaná, význam stejný. |
| Ceny | Nejsou. |
| CTA | V těle žádný odkaz. Jen povolená homepage věta. Prodej ze zdroje pryč. |
| Dlouhá pomlčka | Ne. |
| Titulek | `Pomalý metabolismus a hubnutí`. Bez číslic, bez slibu. Zdrojové H1 je otázka („Za to může pomalý metabolismus?“), draft je popisný. V pořádku. |

### Draft 09 `09-spanek.md` vs `clanky/kolik-spanku-delka-pravidelnost.html`

| Kontrola | Výsledek |
| --- | --- |
| Věcná shoda | Sedí. Yin 2017 (7 h, +6 % / +13 %, ~12 % u pěti hodin, ~28 % u devíti), basketbal +9 %, 8-10 h u aktivních, ghrelin +28 %, leptin −18 %, chuť +33 až +45 %, 300–680 kcal, 60 000 lidí, 20-48 % nižší riziko, hierarchie délka vs. pravidelnost. SVG graf ze webu v draftu není, čísla z něj v textu zůstala. |
| Ceny | Nejsou. |
| CTA | Ze zdroje zmizela zmínka Academy v perexu, box Academy i koučinkový CTA. Zůstaly 2 odkazy na spánkové články webu + homepage věta. Stejné čtení CTA jako u 01. |
| Dlouhá pomlčka | Ne. Zdroj má rozsah `8–10` (krátká pomlčka), draft `8-10` (spojovník). |
| Titulek | `Kolik hodin spát a jak pravidelně`. Bez číslic. „Kolik hodin“ je otázka na množství, ne číslo v titulku. Slib výsledku není. |

### `KALENDAR-navrh.md`: kolize dat

Kalendář **nedává žádná kalendářní data**. Jen týdny 1–10, jeden článek týdně, navržený slot úterý dopoledne (záloha středa ráno).

- Dva soubory ve stejném týdnu: ne. 10 týdnů, 10 souborů, titulky 1:1 s H1.
- Kolize dvou publikací na tentýž den: z návrhu neplyne. Bez startovního data se datum nedá spočítat.
- Vnitřní nesoulad slotu, ne kolize: globálně „úterý dopoledne“ a „drž jeden slot“, u týdne 5 ale „Pátek v týdnu 5 sedí k tématu“. Kdyby se týden 5 posunul na pátek, rozbije to rytmus. Kdyby zůstal úterý, páteční zdůvodnění neplatí. Není to srážka dvou článků.

Mimo vzorek, grep celého adresáře: drafty 03 a 05 mají v těle odkaz na kalkulačku kalorií. Kalendář povoluje jednu homepage větu. Stejná šedá zóna CTA jako u 01.

### Verdikt

**MERGE ANO.** Jsou to drafty pod `docs/`, ne publikace. Vzorek 01 / 08 / 09 drží zdroj, ceny a prodejní CTA ze landingu jsou pryč, `—` není, titulky bez číslic. Kalendář nemá kolizi dat. Nález u týdne 5 (úterý vs. pátek) a případné zúžení „žádné další CTA“ na odkazy v těle stačí do revize před „pošli ostro“, merge to neblokuje.

---

## Shrnutí verdiktů

| Větev | Merge | Co neudělat |
| --- | --- | --- |
| `cloud-poukaz-vzhled-web` | **ANO** | Nic blokujícího. Volitelně doplnit, že ukázka je tmavá, a sjednotit „Tmavý zlatý“ se Stripe „Tmavá zlatá“. |
| `cloud-poukaz-vydat-hardening` | **ANO** | Nespouštět SQL. Nenasazovat funkci, dokud v deploy balíku není `_shared/signature.ts` a dokud se neshoduje s `get_edge_function`. |
| `cloud-x-articles-drafty` | **ANO** | Nesahat na X bez Martinova „pošli ostro“. U týdne 5 rozhodnout úterý vs. pátek. |

Kontrolované větve beze změny. Tento soubor je jediný výstup kontroly.
