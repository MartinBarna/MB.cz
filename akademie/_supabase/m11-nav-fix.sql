-- ============================================================
-- m11-nav-fix.sql — oprava řetězu „Další lekce →" v lesson_content
-- ------------------------------------------------------------
-- POZOR: Tento skript NEBYL spuštěn — jen připraven (audit 2026-07-16,
-- revize byla read-only). Spustit ručně v Supabase SQL editoru
-- (projekt uhmrpfsdcujbhbtumqye) nebo přes psql. Je idempotentní:
-- druhé spuštění nic nezmění (starý snippet už v html nebude).
--
-- Co opravuje (nálezy auditu academy-zóny):
--
-- ČÁST 1 — Modul 11 byl rozšířen z 10 na 12 lekcí, ale prev/next
-- navigace v DB se nepřešila. Student jedoucí přes „Další lekce"
-- nikdy nepotká m11-l11 (Přerušovaný půst) ani m11-l12 (GLP-1):
--   m11-l10: next m12-l1  → m11-l11   (přeskakoval l11+l12)
--   m11-l11: next přehled → m11-l12   (prev na l10 už je správně)
--   m11-l12: next přehled → m12-l1    (prev na l11 už je správně)
--   m12-l1 : prev m11-l10 → m11-l12
--
-- ČÁST 2 — Konce novějších modulů utínaly řetěz (vedly na přehled
-- modulů místo na první lekci dalšího modulu; m1–m17 cross-link mají):
--   m18-l8 → m19-l1, m19-l9 → m20-l2 (první ZOBRAZOVANÁ lekce m20 —
--   pořadí m20 v CURRICULUM je záměrně l2,l3,l4,l1,l5…), m20-l13 → m21-l1,
--   m21-l5 → m22-l1, m22-l4 → m23-l1, m23-l4 → m24-l1.
--   (m24-l13 je konec kurikula — návrat na modul je tam správně.)
--
-- Všechny staré snippety byly 2026-07-16 ověřeny SELECTem proti živé DB
-- a každý se v html své lekce vyskytuje PRÁVĚ JEDNOU (replace je bezpečný).
-- ============================================================

-- ---------- ČÁST 1: řetěz uvnitř modulu 11 ----------

-- m11-l10: „Další lekce" vedla rovnou na m12-l1, správně na m11-l11
UPDATE lesson_content SET html = replace(html,
  '<a class="lnav-next" href="/akademie/studium/m12-l1/">Další lekce →</a>',
  '<a class="lnav-next" href="/akademie/studium/m11-l11/">Další lekce →</a>')
WHERE lesson_id = 'm11-l10';

-- m11-l11: končila na přehledu modulů, správně pokračuje na m11-l12
UPDATE lesson_content SET html = replace(html,
  '<a class="lnav-next" href="/akademie/studium/">Přehled modulů →</a>',
  '<a class="lnav-next" href="/akademie/studium/m11-l12/">Další lekce →</a>')
WHERE lesson_id = 'm11-l11';

-- m11-l12: končila na přehledu modulů, správně pokračuje na m12-l1
UPDATE lesson_content SET html = replace(html,
  '<a class="lnav-next" href="/akademie/studium/">Přehled modulů →</a>',
  '<a class="lnav-next" href="/akademie/studium/m12-l1/">Další lekce →</a>')
WHERE lesson_id = 'm11-l12';

-- m12-l1: „Předchozí lekce" vedla na m11-l10, správně na m11-l12
UPDATE lesson_content SET html = replace(html,
  '<a class="lnav-prev" href="/akademie/studium/m11-l10/">← Předchozí lekce</a>',
  '<a class="lnav-prev" href="/akademie/studium/m11-l12/">← Předchozí lekce</a>')
WHERE lesson_id = 'm12-l1';

-- ---------- ČÁST 2: cross-linky na konci novějších modulů ----------

-- m18-l8 (konec m18 Ženské zdraví) → m19-l1
UPDATE lesson_content SET html = replace(html,
  '<a class="lnav-next" href="/akademie/studium/">Přehled modulů →</a>',
  '<a class="lnav-next" href="/akademie/studium/m19-l1/">Další lekce →</a>')
WHERE lesson_id = 'm18-l8';

-- m19-l9 (konec m19 Praxe a pokročilá aplikace): nemá vůbec lnav-next,
-- doplníme ho před </nav>. E'' literál kvůli \n (bezpečné vůči CRLF).
UPDATE lesson_content SET html = replace(html,
  E'⬑ Zpět na Modul 19<span class="s"></span></a>\n    </nav>',
  E'⬑ Zpět na Modul 19<span class="s"></span></a>\n      <a class="lnav-next" href="/akademie/studium/m20-l2/">Další lekce →</a>\n    </nav>')
WHERE lesson_id = 'm19-l9';

-- m20-l13 (konec m20 Martinův systém v praxi) → m21-l1
UPDATE lesson_content SET html = replace(html,
  '<a class="lnav-next" href="/akademie/studium/#m20">Zpět na Modul 20 →</a>',
  '<a class="lnav-next" href="/akademie/studium/m21-l1/">Další lekce →</a>')
WHERE lesson_id = 'm20-l13';

-- m21-l5 (konec m21 Sociální sítě pro trenéry) → m22-l1
UPDATE lesson_content SET html = replace(html,
  '<a class="lnav-next" href="/akademie/studium/">Přehled modulů →</a>',
  '<a class="lnav-next" href="/akademie/studium/m22-l1/">Další lekce →</a>')
WHERE lesson_id = 'm21-l5';

-- m22-l4 (konec m22 Trénování a vedení žen) → m23-l1
UPDATE lesson_content SET html = replace(html,
  '<a class="lnav-next" href="/akademie/studium/">Přehled modulů →</a>',
  '<a class="lnav-next" href="/akademie/studium/m23-l1/">Další lekce →</a>')
WHERE lesson_id = 'm22-l4';

-- m23-l4 (konec m23 Zdravotní specifika a stárnutí) → m24-l1
UPDATE lesson_content SET html = replace(html,
  '<a class="lnav-next" href="/akademie/studium/">Přehled modulů →</a>',
  '<a class="lnav-next" href="/akademie/studium/m24-l1/">Další lekce →</a>')
WHERE lesson_id = 'm23-l4';

-- ---------- OVĚŘENÍ (spusť po UPDATE, jen čte) ----------
-- Očekávané next_href:
--   m11-l10→m11-l11, m11-l11→m11-l12, m11-l12→m12-l1, m12-l1→m12-l2 (beze změny),
--   m18-l8→m19-l1, m19-l9→m20-l2, m20-l13→m21-l1, m21-l5→m22-l1,
--   m22-l4→m23-l1, m23-l4→m24-l1
-- a prev_href: m12-l1→m11-l12 (ostatní beze změny).
SELECT lesson_id,
       substring(html from '<a class="lnav-prev" href="([^"]+)"') AS prev_href,
       substring(html from '<a class="lnav-next" href="([^"]+)"') AS next_href
FROM lesson_content
WHERE lesson_id IN ('m11-l10','m11-l11','m11-l12','m12-l1',
                    'm18-l8','m19-l9','m20-l13','m21-l5','m22-l4','m23-l4')
ORDER BY lesson_id;
