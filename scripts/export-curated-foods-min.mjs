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
 * u 43 130 položek. Sloupec `note` se vynechává, nástroj (index.html + food-search.js)
 * ho nikde nečte (ověřeno gitgrepem 25. 8. 2026).
 *
 * ZDROJ: čte HOTOVÝ `assets/curated-foods.json`, NESAHÁ na databázi. Kdo přegeneruje
 * ten soubor skriptem `export-curated-foods.mjs`, ať pak spustí i tenhle:
 *   node scripts/export-curated-foods-min.mjs
 * a bumpne `curated-foods.min.json?v=` v akademie/nastroje/potraviny/index.html.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KOREN = join(dirname(fileURLToPath(import.meta.url)), '..');
const ZDROJ = join(KOREN, 'assets/curated-foods.json');
const CIL = join(KOREN, 'assets/curated-foods.min.json');

// Přesně sloupce, které nástroj skutečně čte (index.html + food-search.js).
// `note` se schválně vynechává, nikde se nezobrazuje ani nepoužívá k hledání.
const SLOUPCE = ['name', 'category', 'kcal_100g', 'protein_100g', 'carb_100g', 'fat_100g', 'fiber_100g', 'serving_g'];

const zdroj = JSON.parse(readFileSync(ZDROJ, 'utf8'));
if (!Array.isArray(zdroj) || zdroj.length === 0) {
  throw new Error('assets/curated-foods.json je prázdný nebo má neočekávaný tvar');
}

const rows = zdroj.map((it) => SLOUPCE.map((k) => it[k] ?? null));
const vysledek = { cols: SLOUPCE, rows };

writeFileSync(CIL, JSON.stringify(vysledek) + '\n', 'utf8');
console.log(`✅ zapsáno: assets/curated-foods.min.json (${rows.length} položek, sloupce: ${SLOUPCE.join(', ')})`);
