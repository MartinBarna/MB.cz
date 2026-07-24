# Měření reklam na Tvůj Coach: schéma UTM a kde se měření trhá

Podklad pro Blok 3 mise (reklamy). Není to marketingový text, je to technická
dohoda o značkování, aby se z dat dalo číst, **co přineslo PRODEJ**, ne jen klik.
Soubor leží v `_zdroje/`, což je z deploye vyloučené, na web se nedostane.

Severka zůstává **cena za prodej**, ne za lead a ne za klik. Lead za 17 Kč, který
kupuje dvakrát častěji, je levnější zákazník než lead za 8 Kč.

---

## 1. Schéma značek

| Parametr | Hodnota | K čemu je |
|---|---|---|
| `utm_source` | `facebook`, `google-ads`, `seznam` | platforma |
| `utm_medium` | `cpc` | typ nákupu (placený klik) |
| `utm_campaign` | `tc-<cíl>-<publikum>-<RRMM>` | kampaň, nese i cíl |
| `utm_content` | `<úhel>-<formát>-<varianta>` | konkrétní kreativa |
| `utm_term` | `{keyword}` (jen Google search) | který dotaz to přivedl |
| `utm_id` | `{{campaign.id}}` / `{campaignid}` | tvrdý join na náklady |

### Proč `facebook` a `google-ads`, i když je „meta" přesnější
Kód už dneska tyhle dvě hodnoty **sám dosazuje**, když reklama dorazí jen s klik ID
(`fbclid` → `facebook`, `gclid` → `google-ads`). Kdybychom ručně značkovali `meta`,
vzniknou v jednom sloupci dvě jména pro tutéž platformu a každý dotaz by musel mít
`in (...)`. Menší zlo je držet se toho, co kód píše sám.

⚠️ **V historických datech je i `fb`** (ručně otagovaná kvízová kampaň). Při čtení
starších dat normalizuj:
`case when utm_source in ('fb','facebook') then 'facebook' when utm_source in ('google','google-ads') then 'google-ads' else utm_source end`

Instagram od Facebooku **nerozlišuj v UTM**. Meta má rozpad podle umístění ve vlastním
reportu a `{{site_source_name}}` by do `utm_source` nasypalo třetí sadu hodnot (`fb`/`ig`/`an`).

### `utm_campaign`: cíl je součástí jména
- `<cíl>` = **`lead`** (sběr e-mailu na martinbarna.cz) nebo **`sale`** (přímý prodej, míří na tvujcoach.cz)
- `<publikum>` = `zeny`, `muzi`, `broad`, `retarget`, `brand`, `konkurence`
- `<RRMM>` = rok a měsíc startu, např. `2608` = srpen 2026. Umožní pustit tentýž nápad
  znovu za půl roku a nemíchat kohorty.

Příklady: `tc-lead-zeny-2608`, `tc-sale-broad-2608`, `tc-sale-brand-2608` (brandový Google
na „tvůj coach"), `tc-sale-konkurence-2608`.

Cíl je schválně **v `utm_campaign`**, ne ve zvláštním parametru: `utm_campaign` je pole,
které se ukládá nejspolehlivěji ze všech a je to dnes nejlepší atribuční klíč napříč webem.
Prefix `tc-` odděluje appku od kampaní na Academy a videokurz ve stejné tabulce `leads`.

### `utm_content`: kreativa
`<úhel>-<formát>-<varianta>`, například `u3-screen15-a`.

- úhel `u1` až `u5` podle pěti odlišovacích úhlů z rešerše:
  u1 za appkou je reálný kouč · u2 AI mluví metodikou kouče · u3 čísla počítá engine, AI je
  jen vysvětluje · u4 adaptivní cíle z reálných dat · u5 česky, české potraviny, jídlo i trénink
- formát: `th15` (talking head 15 s), `ugc15`, `screen15`, `static`
- varianta: `a`, `b`, `c`

Díky tomu jde z dat říct nejen „která reklama", ale i „který ÚHEL prodává", což je to,
co se přenáší do dalších vln.

### Limity, které je potřeba znát
- Každá `utm_*` se **ořezává na 60 znaků**. Schéma výš se do toho vejde s rezervou,
  ale nepoužívej Meta dynamické `{{campaign.name}}`, to limit přeteče.
- `gclid` a `fbclid` se naopak ukládají celé (200 znaků). Zkrácený `gclid` je
  pro offline import konverzí do Google Ads nepoužitelný.
- **Leady a registrace žijí ve dvou různých databázích** (leads = projekt Academy,
  profiles = projekt appky). Jedním dotazem je nespojíš, vyhodnocuj každou větev zvlášť
  a spojuj až v tabulce nad tím.

---

## 2. Kam co značkovat

**Větev (a) leadgen, cíl je e-mail:**
`https://martinbarna.cz/makro-plan/?utm_source=facebook&utm_medium=cpc&utm_campaign=tc-lead-zeny-2608&utm_content=u4-ugc15-a`

**Větev (b) přímý prodej, cíl je registrace v appce:**
`https://tvujcoach.cz/?plan=vip&utm_source=facebook&utm_medium=cpc&utm_campaign=tc-sale-broad-2608&utm_content=u2-th15-a`

Google search (šablona sledování, ne ruční URL u každé reklamy):
`?utm_source=google-ads&utm_medium=cpc&utm_campaign=tc-sale-brand-2608&utm_term={keyword}&utm_id={campaignid}`

`?plan=basic|vip` na tvujcoach.cz předvybere plán v ceníku appky a uloží se k registraci,
takže jde změřit, jestli lidi ze „VIP" reklamy VIP opravdu kupují.

---

## 3. Kde se měření trhalo (stav před touhle várkou)

| # | Kde | Co se dělo | Stav |
|---|---|---|---|
| 1 | `assets/lead-form.js` | `utm_term` a `utm_id` se nesbíraly vůbec. U Google search nešlo říct, který dotaz lead přivedl. | opraveno |
| 2 | celý web | UTM se četla až při odeslání formuláře z aktuální URL. Kdo přišel z reklamy na článek nebo homepage a formulář vyplnil o stránku dál, **spadl v DB mezi organické**. Týkalo se to i cesty přes lead-popup. | opraveno (sessionStorage v `analytics.js`) |
| 3 | `tvuj-coach/index.html` | Všech 8 odkazů na tvujcoach.cz vedlo holých. Na hranici domény stopa **končila úplně**. | opraveno (odkazy se dotagují) |
| 4 | appka tvujcoach.cz | **Žádné měření, žádná UTM, žádný pixel.** Registraci nešlo spárovat s kampaní ničím. | opraveno v repu appky, čeká na nasazení |
| 5 | ceník na MB.cz | Free, Basic i VIP vedly na stejnou holou adresu, plán se nedal předvybrat. | opraveno (`?plan=`) |
| 6 | historie | Leady před 17. 7. nemají `utm_content` ani `fbclid`, `utm_term`/`utm_id` nemá nikdo před touhle změnou. | nelze dopočítat, počítej s tím u srovnání |

---

## 4. Vyhodnocovací dotazy

**Leady z reklam (projekt Academy).** Počítej LIDI, ne události.

```sql
select
  coalesce(meta->>'utm_campaign', '(neznámá)') as kampan,
  meta->>'utm_content'                         as kreativa,
  count(distinct email)                        as leadu
from leads
where created_at >= now() - interval '30 days'
  and meta->>'utm_campaign' like 'tc-%'
group by 1, 2
order by leadu desc;
```

**Registrace a platící z reklam (projekt appky).** Tohle je severka větve (b):

```sql
select
  coalesce(p.signup_attribution->>'utm_campaign', '(organicky)') as kampan,
  p.signup_attribution->>'utm_content'                           as kreativa,
  p.signup_attribution->>'plan'                                  as slibovany_plan,
  count(*)                                                       as registraci,
  count(*) filter (
    where s.status in ('active','trialing') and s.stripe_subscription_id is not null
  )                                                              as platicich
from profiles p
left join subscriptions s on s.user_id = p.id
where p.created_at >= now() - interval '30 days'
group by 1, 2, 3
order by platicich desc, registraci desc;
```

**Kolik lidí přišlo přes most z martinbarna.cz:**

```sql
select signup_attribution->>'referrer_host' as odkud, count(*)
from profiles
where signup_attribution is not null
group by 1 order by 2 desc;
```

⚠️ U všech metrik z mailů platí, že **open rate je mrtvá metrika** (skenery ho nafukují
na 95 až 100 %) a i klik může být stroj. Rozhoduj podle kliků unikátních lidí a podle prodejů.
