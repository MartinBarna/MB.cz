# 🚀 Nasazení nového webu na Wedos (pro coworka)

Nový web je **čisté statické HTML** — na Wedos běží přímo, bez GitHubu, bez problémů s www.

---

## ⚡ KROK 0 (NEJDŘÍV, ať doména hned žije)
Pokud martinbarna.cz nejde: na **Wedos DNS** vrať záznamy na Wedos hosting, naskočí starý web:
- apex `@` A → `185.8.237.5`
- `www` A → `185.8.237.5` (a smaž `www` CNAME na github)
- smaž GitHub A i AAAA záznamy
- MX / poštu nech být

---

## 📦 KROK 1 — Stáhni web z GitHubu
- GitHub → repo `MartinBarna/MB.cz` → tlačítko **Code → Download ZIP**
- Rozbal. Web je v kořeni rozbalené složky.

## 📂 KROK 2 — Nahraj přes FTP do webrootu Wedosu (`/www`)
**Nahraj VŠE KROMĚ těchto (nejsou potřeba):**
- `.git/`, `_import/`, `scripts/`
- `*.md` soubory (POZNAMKY, PRED-NAHOZENIM, WEDOS-DEPLOY, zaloha-revert-playbook)
- `CNAME` (jen pro GitHub; neškodí, ale netřeba)

**MUSÍ se nahrát (důležité):**
- `index.html` a `.htaccess` přímo do kořene `/www`
- složky `assets/`, `clanky/`, `koucing/`, `konzultace/`, `prednasky/`,
  `kalkulacka-kalorii-a-makrozivin/`, `forma-zpet/`, `makro-plan/`,
  `videokurz/`, `treninky/`, `reference/` + soubory `videokurz.html`,
  `treninky.html`, `404.html`, `sitemap.xml`, `robots.txt`, `llms.txt`,
  `site.webmanifest`
- ⚠️ `.htaccess` je skrytý soubor — v FTP klientu zapni **zobrazení skrytých souborů**.

**Pozor:** nejdřív si zazálohuj/odklid staré WordPress soubory z `/www`
(`wp-admin`, `wp-content`, `wp-includes`, `index.php`, `.htaccess` od WP),
ať se nemíchají s novým webem. (Zálohu už máš.)

## 🔐 KROK 3 — SSL ve Wedos adminu
- Zapni **Let's Encrypt** certifikát pro `martinbarna.cz` i `www.martinbarna.cz`.

## 🌐 KROK 4 — DNS na Wedos
- apex `@` A → `185.8.237.5` (Wedos hosting)
- `www` A → `185.8.237.5`
- (žádné GitHub A/AAAA, žádný www CNAME na github)

## ✅ KROK 5 — Test
- `https://martinbarna.cz` i `https://www.martinbarna.cz` → web se načte přes HTTPS
- www se má 301 přesměrovat na ne-www (řeší `.htaccess`)
- klikni pár podstránek (/koucing/, /clanky/, /prednasky/, /kalkulacka-kalorii-a-makrozivin/)
- otevři `martinbarna.cz/objednavka-konzultace/` → musí přesměrovat na SimpleShop

---

### Co `.htaccess` řeší automaticky
- vynucení HTTPS, sjednocení na ne-www (vyřeší i starou cache na www)
- vlastní 404 stránku
- **přesměrování starých WP URL** (objednávky → SimpleShop, /rubrika/* → /clanky/, /martin/ → /#omne …)
- kompresi + cache (rychlost)

Tím odpadají všechny GitHub DNS/www komplikace — web jede z Wedosu, kde doména spolehlivě běží. 💪
