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
- ✅ **23. 6. 2026:** První autonomně napsaný článek přidán — `clanky/kolik-kroku-denne-chuze-na-hubnuti.html` (téma: chůze / NEAT / mýtus 10 000 kroků). Martin ho má **zkontrolovat** a případně doladit/stáhnout.

---

# ✅ ČEKÁ NA MARTINA (jeho úkoly — stav k 23. 6. 2026)

> Tohle si pamatuj pro příště. Jakmile Martin dodá výstup, Claude dodělá zbytek.

## A) Google Search Console — ověření + sitemapa  ⭐ priorita
- Martin má zatím založenou property `http://martinbarna.cz/` (URL prefix), ale web jede na **https**.
- **Martin udělá:** v Search Console „+ Přidat zdroj" → „Předpona adresy URL" → `https://martinbarna.cz/` → ověření „Značka HTML" → pošle Claudovi řádek `<meta name="google-site-verification" …>`.
- **Claude pak:** vloží meta do `<head>` (homepage stačí), nasadí, Martin klikne Ověřit; pak v Search Console **Soubory Sitemap → `sitemap.xml` → Odeslat**.

## B) Reálné recenze z Googlu
- Na webu jsou v sekci Reference **3 ukázkové (seed) recenze označené k výměně**.
- **Martin pošle** 2–4 reálné texty recenzí + křestní jména. **Claude vymění** seed za pravé.

## C) Statistiky návštěvnosti — rozhodnutí visí
- Na webu je už vložený **Plausible** skript (`plausible.io/js/script.js`) = **placené ~9 $/měs**. Pokud Martin neplatí, skript jen nic nedělá.
- **Volba:** `GA4` (zdarma — Martin pošle `G-XXXX`, Claude nasadí + cookie lišta) / nechat **Plausible** (platit) / **odebrat** Plausible a nedávat nic.

## D) E-mail marketing na lead magnet  (🥇 největší byznys páka)
- Lead magnet sbírá e-maily do **Tally** (databáze hotová, free, neomezené). Kontakty si tahá i Martinův agent z mailu.
- **Další krok:** napojit Tally na e-mailový nástroj (CZ **Ecomail** / **MailerLite** free do 1000) → automatické doručení magnetu + možnost psát/prodávat. Potřebuje Martinův účet.

## E) Meta Pixel (Facebook) — Martin jede FB Ads
- Přidat Pixel pro retargeting návštěvníků + měření konverzí. Potřebuje **Pixel ID** + doladit cookie souhlas.

## F) Loga partnerů — viz bod 1 výše (Martin nahraje do `assets/foto/partneri/`).

## G) Úklid starého WordPressu z Wedosu (nepovinné, NEHOŘÍ)
- Staré WP soubory web nezpomalují. Až bude Martin chtít: 2-fázový prompt pro Cowork
  (1. čerstvá ZIP záloha `/www` + stáhnout + STOP → 2. vyprázdnit `/www` → ručně spustit deploy workflow → ověřit).

---

# 🔑 PROVOZNÍ FAKTA (ať to nemusíme znovu zjišťovat)
- **Hosting:** Wedos (Apache), deploy přes GitHub Actions „Deploy na Wedos (FTP)" — ruční spuštění (workflow_dispatch), branch `main`. Secrets FTP_SERVER/USERNAME/PASSWORD nastavené.
- **Doména:** kanonická `https://martinbarna.cz` (non-www). `.htaccess` řeší HTTPS, www→non-www, čisté URL (`/treninky`, `/videokurz`), 301 staré WP URL, 404 router, bezpečnostní hlavičky.
- **Formuláře:** kontakt + Přednášky = FormSubmit → mail `martin@martinbarna.cz` (jen mail, bez DB). Lead magnet = Tally (s DB).
- **Platby:** SimpleShop (ověřeno funkční). Odkazy: Konzultace qG2yO, Videokurz 3Vbl, eBook eVJ6, Recepty mMB7, Audiobook xl6e, Členská sekce lQoO.
- **OG generátor článků:** merged Poppins TTF v `/tmp/ttf/poppins-800.ttf` + `poppins-600.ttf` (mají i diakritiku). Výstup 1200×630 do `assets/og/clanky/<slug>.jpg`.
