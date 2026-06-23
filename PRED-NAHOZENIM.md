# ✅ Checklist před nahozením na ostro (martinbarna.cz)

> Tenhle soubor je naše „pojistka". Než přepneme doménu, projdeme všechny body.
> Až Martin řekne **„jdeme na ostro"**, Claude tenhle seznam připomene a odbavíme ho shora dolů.

## 🛟 Zálohy (na Martinově / coworkově straně — Claude k WordPressu nemá přístup)
- [ ] **Plný export WordPressu** (plugin *UpdraftPlus* nebo *All-in-One WP Migration*, případně přes hosting) a soubor si **schovat mimo web** (Disk/PC). Tohle je hlavní pojistka.
- [ ] **Starý web nechat žít na podadrese** `stary.martinbarna.cz` — pak je případný návrat otázkou pár minut (jen DNS).
- [ ] Ověřit, že **SimplShop zůstává funkční i na starém webu** (kdybychom se dočasně vrátili).

## 💳 SimplShop platby (KLÍČOVÉ — testujeme PŘED přepnutím)
> Důležité: doručení produktů (e-booky, přístup do videokurzu, e-maily) řeší **SimplShop na svých serverech**, ne WordPress. Přesun marketingového webu se fulfillmentu nedotkne.
- [x] Od coworka `simplshop-odkazy.csv` = přímé platební odkazy. ✅
- [x] Claude napojil objednávková tlačítka na přímé SimplShop odkazy: ✅
  - Konzultace (vč. VIP upsell ve formuláři) → `form.simpleshop.cz/qG2yO/buy/`
  - Videokurz 800 Kč → `form.simpleshop.cz/3Vbl/buy/`
  - **Koučink Gold/Diamond NENÍ v SimplShopu** — platí se převodem (Moneta), vede přes kontaktní/objednávkový formulář (beze změny).
- [ ] **TESTOVACÍ NÁKUP** přes nový odkaz (test režim SimplShopu nebo produkt za 1 Kč) — ověřit, že:
  - [ ] platba proběhne,
  - [ ] **produkt se reálně doručí** (přijde e-mail / přístup) stejně jako z WordPressu.
- [ ] Teprve když test projde → můžeme přepnout doménu.

## 🔀 Přesměrování a doména
- [ ] Od coworka `stare-url.csv` = seznam všech starých WP adres.
- [ ] Claude připraví přesměrování starých URL na nové (ať nic nespadne z Googlu).
- [ ] Claude přidá soubor `CNAME` pro `martinbarna.cz`.
- [ ] Claude přepíše kanonické adresy a OG odkazy `martinbarna.cz` → `martinbarna.cz`.

## 🧪 Funkční testy (na ostré doméně)
- [ ] **Google recenze** — tlačítko otevře recenze (čtecí odkaz, Place ID `ChIJQ-8yTbnlE0cRJj3EiDujXRY`).
- [ ] **Facebook recenze** — odkaz funguje.
- [ ] **Kontaktní formulář** (FormSubmit) — přijde e-mail (pozor: jednorázová aktivace kliknutím v e-mailu od FormSubmit).
- [ ] **Lead magnety** (Tally — plán pro ženy / muže) — formulář v češtině, plán dorazí.
- [ ] **WhatsApp** — na mobilu otevře chat, na PC ukáže QR.
- [ ] Odkazy na **IG / TikTok / YouTube / FB** fungují.

## ↩️ Plán návratu (kdyby cokoliv)
1. Přepnout DNS `martinbarna.cz` zpět na WordPress hosting → starý web je hned živý.
2. Claude umí vrátit i jakoukoli předchozí verzi nového webu (vše je v historii Gitu + zálohové větve).

---
*Stav podkladů: Place ID ✅ · simplshop-odkazy.csv ✅ (napojeno) · kompletní stare-url.csv ⬜ (spustit `export-stare-url.ps1`)*
