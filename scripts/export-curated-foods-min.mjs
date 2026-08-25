#!/usr/bin/env node
/* export-curated-foods-min.mjs — zmenšená varianta assets/curated-foods.json pro
 * rychlé načtení nástroje „Databáze potravin" (akademie/nastroje/potraviny/).
 *
 * PROČ EXISTUJE: 25. 8. 2026 stránka stahovala 10,6 MB (43 130 položek) hned při
 * načtení, na mobilu to bylo znát. Řešení má dvě části: (1) stahovat JSON až při
 * prvním použití vyhledávání (viz index.html), (2) zmenšit samotný soubor.
 *
 * FORMÁT: pole polí místo pole objektů (hlavička `cols` nese pořadí sloupců, každý
 * řádek v `rows` je pole hodnot v tom pořadí) → ušetří opakování jmen klíčů
 * u 43 130 položek. Plný text `note` se vynechává (velikost); místo něj nese
 * soubor compact sloupec `hledaci` (0/1).
 *
 * ZDROJ: čte HOTOVÝ `assets/curated-foods.json`, NESAHÁ na databázi. Kdo přegeneruje
 * ten soubor skriptem `export-curated-foods.mjs`, ať pak spustí i tenhle:
 *   node scripts/export-curated-foods-min.mjs
 * a bumpne `curated-foods.min.json?v=` v akademie/nastroje/potraviny/index.html.
 *
 * SLOUPEC `hledaci` (0/1, přidán 25. 8. 2026): odvozený z `note` (obsahuje-li
 * „Tvar hledání" nebo „Alias hledání", bez diakritiky/case), NE celý text note.
 * Řídí demotici hledacích tvarů v searchCurated (assets/food-search.js), zrcadlí
 * `jeHledaciTvar` z appky (src/lib/food-query.ts). Starý min.json bez tohoto
 * sloupce = fromMin() ho nenačte a searchCurated bere `it.hledaci` jako 0
 * (zpětně kompatibilní, food-search.js si navíc umí flag dopočítat z `note`,
 * kdyby ho někdy dostal na vstupu i s plným textem).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KOREN = join(dirname(fileURLToPath(import.meta.url)), '..');
const ZDROJ = join(KOREN, 'assets/curated-foods.json');
const CIL = join(KOREN, 'assets/curated-foods.min.json');

function normName(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function jeHledaciTvar(note) {
  const n = normName(note ?? '');
  return n.includes('tvar hledani') || n.includes('alias hledani') ? 1 : 0;
}

// Sloupce, které nástroj skutečně čte (index.html + food-search.js). Plný `note`
// se schválně vynechává (nikde se nezobrazuje), jen se z něj napřed odvodí `hledaci`.
const SLOUPCE = ['name', 'category', 'kcal_100g', 'protein_100g', 'carb_100g', 'fat_100g', 'fiber_100g', 'serving_g', 'hledaci'];

const zdroj = JSON.parse(readFileSync(ZDROJ, 'utf8'));
if (!Array.isArray(zdroj) || zdroj.length === 0) {
  throw new Error('assets/curated-foods.json je prázdný nebo má neočekávaný tvar');
}

const rows = zdroj.map((it) => SLOUPCE.map((k) => (k === 'hledaci' ? jeHledaciTvar(it.note) : it[k] ?? null)));
const vysledek = { cols: SLOUPCE, rows };

writeFileSync(CIL, JSON.stringify(vysledek) + '\n', 'utf8');
console.log(`✅ zapsáno: assets/curated-foods.min.json (${rows.length} položek, sloupce: ${SLOUPCE.join(', ')})`);
