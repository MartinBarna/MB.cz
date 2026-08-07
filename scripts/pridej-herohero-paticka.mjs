// Jednorazovy skript: prida do standardni paticky odkaz na clenskou komunitu HeroHero.
// Kotva = odkaz "Nastaveni cookies", posledni polozka radku odkazu ve standardni paticce.
// DUKAZ: po vlozeni se z noveho obsahu odstrani PRESNE vlozeny retezec a vysledek
// se porovna znak po znaku s originalem. Kdyz se nerovna, soubor se nezapise.
import fs from 'node:fs';
import path from 'node:path';

const KOTVA = '<a href="#" data-cookie-settings>Nastavení cookies</a>';
const VLOZIT = ' · <a href="https://herohero.co/martinbarna">Členská komunita</a>';

// Pravni a objednavkove stranky: marketingovy odkaz do nich nepatri.
// akademie/index.html ma vlastni design patičky (jiny system), proto taky ne.
const VYNECHAT = new Set([
  'obchodni-podminky/index.html',
  'zasady-ochrany-osobnich-udaju/index.html',
  'odstoupeni/index.html',
  'konzultace/dotaznik/index.html',
  'akademie/objednavka/index.html',
  'akademie/index.html',
]);

function walk(d, a = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules' || e.name === '_zdroje' || e.name === '_zaloha') continue;
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p, a) : (e.name.endsWith('.html') && a.push(p));
  }
  return a;
}

const suchy = process.argv.includes('--dry');
const zmeneno = [];
const preskoceno = { vynechano: [], bezKotvy: 0, jizMa: [] };
let chyb = 0;

for (const f of walk('.')) {
  const rel = f.split(path.sep).join('/').replace(/^\.\//, '');
  const puvodni = fs.readFileSync(f, 'utf8');

  if (!puvodni.includes(KOTVA)) { preskoceno.bezKotvy++; continue; }
  if (VYNECHAT.has(rel)) { preskoceno.vynechano.push(rel); continue; }
  if (puvodni.includes('herohero.co/martinbarna')) { preskoceno.jizMa.push(rel); continue; }

  const pocetKotev = puvodni.split(KOTVA).length - 1;
  if (pocetKotev !== 1) { console.log(`  CHYBA ${rel}: kotva ${pocetKotev}x, ocekavam 1x`); chyb++; continue; }

  const novy = puvodni.replace(KOTVA, KOTVA + VLOZIT);

  // DUKAZ 1: odebrani vlozeneho retezce vrati BAJT PO BAJTU original
  if (novy.replace(VLOZIT, '') !== puvodni) { console.log(`  CHYBA ${rel}: zpetny prevod nesedi`); chyb++; continue; }
  // DUKAZ 2: delka narostla presne o delku vlozeneho retezce
  if (novy.length !== puvodni.length + VLOZIT.length) { console.log(`  CHYBA ${rel}: delka nesedi`); chyb++; continue; }
  // DUKAZ 3: pocet vsech ostatnich odkazu se nezmenil
  const a1 = (puvodni.match(/<a /g) || []).length, a2 = (novy.match(/<a /g) || []).length;
  if (a2 !== a1 + 1) { console.log(`  CHYBA ${rel}: pribylo ${a2 - a1} odkazu misto 1`); chyb++; continue; }
  // DUKAZ 4: zadna dlouha pomlcka
  if (VLOZIT.includes('—')) { console.log('  CHYBA: dlouha pomlcka ve vkladanem retezci'); chyb++; break; }

  if (!suchy) fs.writeFileSync(f, novy);
  zmeneno.push(rel);
}

console.log('');
console.log(suchy ? '=== SUCHY BEH (nic se nezapsalo) ===' : '=== ZAPSANO ===');
console.log('  zmeneno souboru: ' + zmeneno.length);
console.log('  z toho clanky/:  ' + zmeneno.filter((x) => x.startsWith('clanky/')).length);
console.log('  mimo clanky/:    ' + zmeneno.filter((x) => !x.startsWith('clanky/')).join(', '));
console.log('  vynechano zamerne (' + preskoceno.vynechano.length + '): ' + preskoceno.vynechano.join(', '));
console.log('  bez kotvy (netyka se): ' + preskoceno.bezKotvy);
if (preskoceno.jizMa.length) console.log('  uz melo odkaz: ' + preskoceno.jizMa.length);
console.log('  CHYB: ' + chyb);
process.exit(chyb ? 1 : 0);
