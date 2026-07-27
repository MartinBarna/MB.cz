// Převede nové (dark-gold) infografiky ze `_zdroje/infografiky/<téma>/NN.png`
// do galerií u blogových článků `assets/clanky-img/<slug>/NN.webp`.
//
// PROČ: na webu visely pořád STARÉ ORANŽOVÉ verze, přestože blog má dark-gold kabát
// a oranžová je podle `mb-design-standard` vyřazená. Na tmavě zlaté stránce se
// otevřelo deset oranžových obrázků.
//
// ⛔ SLUG TÉMATU ≠ SLUG ČLÁNKU. Mapa níž je ruční a **spárovaná podle TEXTU**
// (titulek úvodního slidu proti nadpisu článku), ne podle podobnosti názvů souborů.
// Kdo sem přidává řádek, ať to udělá stejně: otevře JSON scénáře a HTML článku
// a přesvědčí se, že mluví o TÉMŽE. Špatný pár = obrázky odporují textu.
//
// ⚠️ POROVNÁVEJ STAROU INFOGRAFIKU S NOVOU, ne nadpis článku s titulkem infografiky.
// 27. 7. jsem takhle omylem vyřadil `protein-po-treninku`: nadpis článku je o načasování
// („musí to být hned po tréninku?"), ale jeho galerie byla odjakživa o DÁVCE. Nadpis
// článku tedy nemusí popisovat, co je v jeho galerii. Rozhodlo až otevření obou sad.
//
// Spuštění z kořene repa: node scripts/prevod-infografik-do-clanku.mjs [--zapsat]
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

// ⚠️ `sharp` v tomhle repu nainstalovaný NENÍ (web se nebuilduje, je to statické HTML).
// Bere se z repa appky. `NODE_PATH` u ESM importu nefunguje, proto createRequire.
// Kdyby se cesta změnila, doplň sem další kandidáty; skript má poradit, ne spadnout.
const require = createRequire(import.meta.url);
const KANDIDATI = [
  'sharp',
  'C:/Users/fitne/Desktop/AI Martin/node_modules/sharp',
  'C:/Users/fitne/Desktop/TC-academy-rok/node_modules/sharp',
];
let sharp = null;
for (const k of KANDIDATI) {
  try { sharp = require(k); break; } catch { /* zkus další */ }
}
if (!sharp) {
  console.error('⛔ Nenašel jsem `sharp` ani v jedné z cest:\n  ' + KANDIDATI.join('\n  '));
  process.exit(1);
}

const ZDROJ = '_zdroje/infografiky';
const CIL = 'assets/clanky-img';
const ZAPSAT = process.argv.includes('--zapsat');

/** téma (složka scénáře) -> slug článku */
const MAPA = {
  'alkohol-a-hubnuti': 'alkohol-a-hubnuti',
  'kardio-a-mozek': 'cviceni-pro-mozek-po-sedesatce',
  'krevni-testy': 'dna-testy-na-hubnuti',
  'hubnuti-a-zdravi-mozku': 'hubnuti-a-zdravi-mozku',
  'kardio-spaluje-mene-nez-si-myslime': 'kardio-spaluje-mene',
  'mozek-a-vek': 'kdy-ma-mozek-vrchol',
  kofein: 'kofein-pred-treninkem',
  'kloubni-vyziva-vs-bilkoviny': 'kolagen-vs-bilkoviny',
  'kolik-let-prida-zdravy-zivot': 'kolik-let-pridava-zdravy-zivot',
  'kroky-vs-presnost-jidla': 'kroky-vs-presnost-jidla',
  'makroziviny-a-hubnuti': 'makroziviny-a-hubnuti',
  spanek: 'malo-spanku-a-hubnuti',            // „Ubývá tuk, nebo sval?" = málo spánku
  melatonin: 'melatonin-na-spanek',
  'kaloricky-deficit': 'namitky-proti-kalorickemu-deficitu',
  'dieta-vs-nabirani-svalu': 'objem-treninku-v-diete',
  'omega-3': 'omega-3-oxidace',
  'omlazeni-hubnutim': 'omlazeni-hubnutim',
  'deprese-a-fitness': 'pohyb-a-nalada',
  probiotika: 'probiotika-co-funguje',
  'sacharidy-pred-treninkem': 'sacharidy-pred-treninkem',
  'umela-sladidla-a-mikrobiom': 'sladidla-a-mikrobiom',
  'apnoe-spanek': 'spankova-apnoe-a-hubnuti',
  'nabirani-svalu-v-kalorickem-deficitu': 'svaly-v-kalorickem-deficitu',
  testosteron: 'testosteron-4-paky',
  'trenujes-tak-tvrde-jak-si-myslis': 'trenujes-tak-tvrde',
  'ultra-zpracovana-jidla': 'ultra-zpracovana-jidla',
  'umela-sladidla': 'umela-sladidla-mytus',
  'vysoky-vo2max': 'vo2max-a-delsi-zivot',
  // ⚠️ DOPLNĚNO 27. 7. po opravě vlastního omylu. Nejdřív jsem tenhle pár ZAMÍTL,
  // protože nadpis článku zní „Protein hned po tréninku: musí to být?" (načasování),
  // kdežto infografika `protein-post` je o dávce (1,6 g/kg). Jenže **ta galerie nikdy
  // neseděla s nadpisem článku**: staré oranžové slidy mluví o 1,3 a 1,5 g/kg,
  // Tagawovi 2021 a 2022, o +0,39 vs +0,12 kg a o tom, že lean mass nejsou svaly.
  // To je přesně obsah `protein-post`, jen v novém kabátu a s upřesněným číslem
  // u DXA (35 až 65 % → 45 až 50 %).
  // ⇒ Poučení: u výměny obrázků porovnávej STAROU infografiku s NOVOU, ne nadpis
  //   článku s titulkem infografiky. Nadpis článku nemusí popisovat jeho galerii.
  'protein-post': 'protein-po-treninku',
};

// Kvalita webp: stará galerie měla kolem 37 kB na obrázek. Držíme se podobně,
// ať se stránka nezpomalí. `effort:6` = pomalejší převod, menší soubor.
const WEBP = { quality: 82, effort: 6 };

let chyby = 0;
for (const [tema, slug] of Object.entries(MAPA)) {
  if (!existsSync(join(ZDROJ, tema))) { console.error('⛔ chybí zdroj: ' + tema); chyby++; }
  if (!existsSync(join(CIL, slug))) { console.error('⛔ chybí cíl: ' + slug); chyby++; }
}
if (chyby) { console.error('\nKončím, ' + chyby + ' nesrovnalostí v mapě.'); process.exit(1); }

let hotovo = 0, preskoceno = 0;
let bytPred = 0, bytPo = 0;

for (const [tema, slug] of Object.entries(MAPA)) {
  const pngs = readdirSync(join(ZDROJ, tema)).filter((f) => /^\d{2}\.png$/.test(f)).sort();
  if (pngs.length !== 10) {
    console.error('⛔ ' + tema + ': ' + pngs.length + ' PNG místo 10, přeskakuju');
    preskoceno++;
    continue;
  }
  for (const png of pngs) {
    const zdroj = join(ZDROJ, tema, png);
    const cil = join(CIL, slug, png.replace('.png', '.webp'));
    if (existsSync(cil)) bytPred += statSync(cil).size;
    if (ZAPSAT) {
      const info = await sharp(zdroj).webp(WEBP).toFile(cil);
      bytPo += info.size;
    }
  }
  hotovo++;
  console.log('✅ ' + tema.padEnd(36) + ' -> ' + slug);
}

console.log('');
console.log('Témat převedeno: ' + hotovo + (preskoceno ? ', přeskočeno: ' + preskoceno : ''));
console.log('Obrázků: ' + hotovo * 10);
if (ZAPSAT) {
  console.log('Velikost galerií: ' + Math.round(bytPred / 1024) + ' kB -> ' + Math.round(bytPo / 1024) + ' kB');
} else {
  console.log('\nNÁHLED. Nic se nezapsalo. Spusť s --zapsat.');
}
