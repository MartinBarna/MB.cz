# 📌 Poznámky na později (po spuštění webu)

> Věci, které NEJSOU urgentní pro spuštění, ale Martin je chce dodělat časem.

## 1) Loga partnerů na stránce Přednášky
- Na `/prednasky/` jsou zatím **textové štítky** s názvy firem (GE Money, Moneta, Česká spořitelna, Innogy, Krajský úřad MSK, Impact Hub) a médií (ČT, Prima, Radio Čas, podcasty).
- **Cíl:** nahradit je **reálnými logy** firem v čisté mřížce.
- **Postup:** Martin nahraje loga (PNG/SVG) na GitHub do `assets/foto/partneri/`, Claude je pak vysází místo textových štítků.
- Status: **odloženo na čas po vydání** (Martin: „časem to tam chci").

## 2) Pravidelné nové články na blog (přes Martinova agenta)
- Martin má vlastního AI agenta, který má **pravidelně psát nové články** na web.
- Nové články se přidávají do `clanky/` podle zavedené šablony, vždy s:
  - hero (tag, h1), drobečky, datum + doba čtení
  - horní „🎁 7denní plán zdarma" box (odkazy `/forma-zpet/`, `/makro-plan/`)
  - spodní CTA žebříček: Kalkulačka → Videokurz 800 Kč → Koučink
  - autorský box, sekce „Mohlo by tě zajímat" (propojení podle tématu)
  - BlogPosting + Breadcrumb schema, vlastní OG obrázek (`assets/og/clanky/<slug>.jpg`)
  - přidat do `clanky/index.html` (karta + filtr rubrika) a do `sitemap.xml`
- Claude umí nový článek z dodaného textu vygenerovat celý v tomto formátu — stačí poslat text.
- Status: **zavést jako pravidelný proces po spuštění.**
