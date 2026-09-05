#!/usr/bin/env node
/* export-curated-foods.mjs — jediný zdroj pravdy pro `assets/curated-foods.json`.
 *
 * PROČ EXISTUJE: nástroj „Databáze potravin" (akademie/nastroje/potraviny/) hledá
 * v `assets/curated-foods.json`. Ten soubor byl do 11. 8. 2026 RUČNÍ export z tabulky
 * `curated_foods` v databázi appky Tvůj Coach a **nikdo nevěděl, kdy a z čeho vznikl**.
 * Rozešel se: web měl 2382 položek, databáze 2369, a chyběly v něm opravy kategorií
 * z migrace 0105 i přejmenování zkomolených názvů z 0101. Táž nemoc jako dvě verze
 * generátoru jídelníčku: dvě kopie téhož, které se tiše rozcházejí.
 * ⇒ Tenhle skript tu nemoc ruší jako TŘÍDU. Export se odteď generuje, nepíše.
 *
 * SPUSTIT:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/export-curated-foods.mjs
 *   (volitelně SUPABASE_URL=..., jinak se použije projekt Tvůj Coach)
 *   Přepínač --dry-run vypíše rozdíl a NIC nezapíše.
 *
 * ⛔ PROČ SERVICE ROLE A NE ANON: tabulka má RLS s podmínkou `auth.uid() IS NOT NULL`,
 * takže anonymní klíč vrátí PRÁZDNO (ne chybu!). Kdo to zkusí s anon klíčem, dostane
 * nula řádků a bude si myslet, že je tabulka prázdná.
 * ⛔ KLÍČ NEPATŘÍ DO REPA. Bere se z prostředí, nikdy se nikam nezapisuje ani netiskne.
 *
 * POJISTKY (schválně, ne paranoia):
 *  - export se NEZAPÍŠE, když by se počet položek propadl o víc než PRAH_UBYTKU procent;
 *    prázdná nebo useknutá odpověď je pravděpodobnější než skutečný úbytek poloviny
 *    databáze, a tichý zápis takového souboru by rozbil vyhledávač na webu
 *  - vždy se vypíše, co PŘIBYLO, co ZMIZELO a čemu se ZMĚNILA kategorie
 *  - řadí se podle názvu, ať diff v gitu ukazuje skutečné změny, ne přeházené pořadí
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KOREN = join(dirname(fileURLToPath(import.meta.url)), '..');
const CIL = join(KOREN, 'assets/curated-foods.json');
const URL_PROJEKTU = process.env.SUPABASE_URL || 'https://kfkmghvhqwqtsalqjmrp.supabase.co';
const KLIC = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Cesta bez service klíče: `npx supabase db query --linked --project-ref kfkmghvhqwqtsalqjmrp
//   -f dotaz.sql --output-format json > dump.json` (dotaz = select SLOUPCE from curated_foods order by name)
// a pak `CURATED_CLI_JSON=dump.json node scripts/export-curated-foods.mjs`. CLI vrací čísla jako
// řetězce ("3.30"), převádíme je; pojistky níž (úbytek, diff) platí stejně.
const CLI_JSON = process.env.CURATED_CLI_JSON;
const NASUCHO = process.argv.includes('--dry-run');
const PRAH_UBYTKU = 5; // procenta

// Přesně ty sloupce a v tom pořadí, jaké má dnešní soubor. Nástroj na webu je čte
// jménem, takže přidání sloupce nevadí, ale přejmenování nebo vypuštění ho rozbije.
const SLOUPCE = ['name', 'category', 'kcal_100g', 'protein_100g', 'carb_100g', 'fat_100g', 'fiber_100g', 'serving_g', 'note'];

if (!KLIC && !CLI_JSON) {
  console.error('\n🔴 Chybí SUPABASE_SERVICE_ROLE_KEY v prostředí.');
  console.error('   Spusť:  SUPABASE_SERVICE_ROLE_KEY=... node scripts/export-curated-foods.mjs');
  console.error('   ⛔ Anonymní klíč NESTAČÍ: RLS na `curated_foods` vrátí anonymovi prázdno,');
  console.error('      a to vypadá jako prázdná tabulka, ne jako chybějící oprávnění.\n');
  process.exit(1);
}

/** Stáhne celou tabulku po stránkách. PostgREST vrací max 1000 řádků na dotaz,
 *  takže bez stránkování by export tiše skončil na tisícovce. */
async function stahniVse() {
  const KROK = 1000;
  const vse = [];
  for (let od = 0; ; od += KROK) {
    const adresa = `${URL_PROJEKTU}/rest/v1/curated_foods?select=${SLOUPCE.join(',')}&order=name.asc`;
    const odpoved = await fetch(adresa, {
      headers: { apikey: KLIC, Authorization: `Bearer ${KLIC}`, Range: `${od}-${od + KROK - 1}` },
    });
    if (!odpoved.ok) throw new Error(`HTTP ${odpoved.status} ${odpoved.statusText} (offset ${od})`);
    const davka = await odpoved.json();
    vse.push(...davka);
    if (davka.length < KROK) break;
  }
  return vse;
}

const CISELNE = ['kcal_100g', 'protein_100g', 'carb_100g', 'fat_100g', 'fiber_100g', 'serving_g'];
const zCli = () => {
  const rows = JSON.parse(readFileSync(CLI_JSON, 'utf8')).rows;
  if (!Array.isArray(rows)) throw new Error('CLI JSON nemá pole rows');
  return rows.map((r) => {
    const o = { ...r };
    for (const k of CISELNE) o[k] = r[k] == null ? null : Number(r[k]);
    return o;
  });
};
const nove = CLI_JSON ? zCli() : await stahniVse();
if (nove.length === 0) throw new Error('databáze vrátila 0 řádků, to je vždycky chyba, ne prázdná tabulka');

// Normalizace: jen dohodnuté sloupce, v dohodnutém pořadí, seřazené podle názvu.
const uklid = (r) => Object.fromEntries(SLOUPCE.map((k) => [k, r[k] ?? null]));
const vysledek = nove.map(uklid).sort((a, b) => a.name.localeCompare(b.name, 'cs'));

const stare = existsSync(CIL) ? JSON.parse(readFileSync(CIL, 'utf8')) : [];
const mapaStare = new Map(stare.map((f) => [f.name, f]));
const mapaNove = new Map(vysledek.map((f) => [f.name, f]));
const pribylo = vysledek.filter((f) => !mapaStare.has(f.name)).map((f) => f.name);
const zmizelo = stare.filter((f) => !mapaNove.has(f.name)).map((f) => f.name);
const jinaKategorie = vysledek
  .filter((f) => mapaStare.has(f.name) && mapaStare.get(f.name).category !== f.category)
  .map((f) => `${f.name}: ${mapaStare.get(f.name).category} -> ${f.category}`);

console.log(`\ndatabáze: ${vysledek.length} položek   soubor dosud: ${stare.length}`);
console.log(`  přibylo: ${pribylo.length}   zmizelo: ${zmizelo.length}   jiná kategorie: ${jinaKategorie.length}`);
const vypis = (nadpis, pole) => {
  if (!pole.length) return;
  console.log(`\n  ${nadpis}:`);
  for (const x of pole.slice(0, 40)) console.log('    ' + x);
  if (pole.length > 40) console.log(`    … a dalších ${pole.length - 40}`);
};
vypis('PŘIBYLO', pribylo);
vypis('ZMIZELO', zmizelo);
vypis('ZMĚNA KATEGORIE', jinaKategorie);

const ubytek = stare.length ? ((stare.length - vysledek.length) / stare.length) * 100 : 0;
if (ubytek > PRAH_UBYTKU) {
  console.error(`\n🔴 NEZAPISUJI: počet položek by klesl o ${ubytek.toFixed(1)} % (práh ${PRAH_UBYTKU} %).`);
  console.error('   Useknutá odpověď je pravděpodobnější než skutečný úbytek. Ověř dotaz a databázi.');
  console.error('   Když je úbytek opravdu správný, smaž cílový soubor a spusť znovu.\n');
  process.exit(1);
}

if (NASUCHO) {
  console.log('\n(--dry-run: nic jsem nezapsal)\n');
} else {
  writeFileSync(CIL, JSON.stringify(vysledek, null, 0) + '\n', 'utf8');
  console.log(`\n✅ zapsáno: assets/curated-foods.json (${vysledek.length} položek)`);
  console.log('⚠️ Nezapomeň bumpnout `curated-foods.json?v=` v akademie/nastroje/potraviny/index.html,');
  console.log('   jinak vracející se návštěvník dostane z cache starý soubor.\n');
}
