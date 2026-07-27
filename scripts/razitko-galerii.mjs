// Přidá cache buster k obrázkům infografických galerií v článcích.
// Bez něj by lidem s uloženou stránkou zůstaly v prohlížeči STARÉ ORANŽOVÉ obrázky,
// přestože na serveru už jsou nové zlaté (soubory mají stejné jméno).
// Razítko se dává jen článkům, kterých se výměna opravdu týkala; ostatním by
// vynutilo zbytečné stažení.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const RAZITKO = '?v=zlate';
const SLUGY = [
  'alkohol-a-hubnuti', 'cviceni-pro-mozek-po-sedesatce', 'dna-testy-na-hubnuti',
  'hubnuti-a-zdravi-mozku', 'kardio-spaluje-mene', 'kdy-ma-mozek-vrchol',
  'kofein-pred-treninkem', 'kolagen-vs-bilkoviny', 'kolik-let-pridava-zdravy-zivot',
  'kroky-vs-presnost-jidla', 'makroziviny-a-hubnuti', 'malo-spanku-a-hubnuti',
  'melatonin-na-spanek', 'namitky-proti-kalorickemu-deficitu', 'objem-treninku-v-diete',
  'omega-3-oxidace', 'omlazeni-hubnutim', 'pohyb-a-nalada', 'probiotika-co-funguje',
  'sacharidy-pred-treninkem', 'sladidla-a-mikrobiom', 'spankova-apnoe-a-hubnuti',
  'svaly-v-kalorickem-deficitu', 'testosteron-4-paky', 'trenujes-tak-tvrde',
  'ultra-zpracovana-jidla', 'umela-sladidla-mytus', 'vo2max-a-delsi-zivot',
];

let souboru = 0, nahrad = 0;
const chybi = [], bezZmeny = [];

for (const slug of SLUGY) {
  const cesta = 'clanky/' + slug + '.html';
  if (!existsSync(cesta)) { chybi.push(slug); continue; }
  const puvodni = readFileSync(cesta, 'utf8');
  let n = 0;
  // Jen .webp v galerii TOHOTO článku a jen tam, kde razítko ještě není.
  const vzor = new RegExp('(/assets/clanky-img/' + slug + '/\\d{2}\\.webp)(?![?\\w])', 'g');
  const novy = puvodni.replace(vzor, (_, cesta1) => { n++; return cesta1 + RAZITKO; });
  if (novy !== puvodni) { writeFileSync(cesta, novy, 'utf8'); souboru++; nahrad += n; }
  else bezZmeny.push(slug);
}

console.log('Souborů upraveno: ' + souboru + ' / ' + SLUGY.length);
console.log('Odkazů orazítkováno: ' + nahrad + '  (očekáváno 280)');
if (chybi.length) console.log('⛔ CHYBÍ HTML: ' + chybi.join(', '));
if (bezZmeny.length) console.log('⚠️ beze změny (už orazítkované?): ' + bezZmeny.join(', '));
