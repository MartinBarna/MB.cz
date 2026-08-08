// Hromadně zvedne cache-buster u sdíleného assetu ve VŠECH HTML stránkách.
//
// PROČ EXISTUJE: stránky si skripty tahají s verzí v adrese (`analytics.js?v=g9`).
// Když se soubor upraví a verze se nezvedne, prohlížeč si nechá starou kopii
// z cache a změna se k lidem NIKDY nedostane. Deploy přitom proběhne úspěšně
// a na serveru nový soubor leží, takže to nikde nekřikne. Tiché selhání.
//
// Použití:  node scripts/bump-verze-assetu.mjs analytics.js g9 g10
//           node scripts/bump-verze-assetu.mjs analytics.js g9 g10 --nasucho

import fs from 'node:fs';
import path from 'node:path';

const [, , soubor, ze, na, prepinac] = process.argv;
const nasucho = prepinac === '--nasucho';

if (!soubor || !ze || !na) {
  console.error('Použití: node scripts/bump-verze-assetu.mjs <soubor.js> <stará> <nová> [--nasucho]');
  process.exit(1);
}

// POJISTKA 1: verze musí mít očekávaný tvar, ať se překlepem nezapíše nesmysl.
if (!/^[a-z]?\d+$/.test(ze) || !/^[a-z]?\d+$/.test(na)) {
  console.error(`STOP: verze musí být ve tvaru g9 nebo 12. Dostal jsem "${ze}" a "${na}".`);
  process.exit(1);
}
if (ze === na) {
  console.error('STOP: stará a nová verze jsou stejné, nemám co dělat.');
  process.exit(1);
}

const KOREN = process.cwd();
const HLEDAT = `${soubor}?v=${ze}`;
const NAHRADIT = `${soubor}?v=${na}`;

// POJISTKA 2: nesahat do node_modules ani do .git.
const PRESKOCIT = new Set(['node_modules', '.git', '.github']);

function projdi(dir, out = []) {
  for (const polozka of fs.readdirSync(dir, { withFileTypes: true })) {
    if (PRESKOCIT.has(polozka.name)) continue;
    const p = path.join(dir, polozka.name);
    if (polozka.isDirectory()) projdi(p, out);
    else if (polozka.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const vsechny = projdi(KOREN);
let zmenenoSouboru = 0;
let zmenenoVyskytu = 0;
const dotcene = [];

for (const p of vsechny) {
  const puvodni = fs.readFileSync(p, 'utf8');
  if (!puvodni.includes(HLEDAT)) continue;

  const vyskytu = puvodni.split(HLEDAT).length - 1;
  const novy = puvodni.split(HLEDAT).join(NAHRADIT);

  // POJISTKA 3: soubor se smí lišit JEN o délku verze krát počet výskytů.
  // Kdyby se změnilo cokoli dalšího, je chyba v nahrazování a nezapisuje se nic.
  const ocekavanyRozdil = (NAHRADIT.length - HLEDAT.length) * vyskytu;
  if (novy.length - puvodni.length !== ocekavanyRozdil) {
    console.error(`STOP u ${p}: neočekávaná změna délky. Nic jsem nezapsal.`);
    process.exit(1);
  }

  if (!nasucho) fs.writeFileSync(p, novy);
  zmenenoSouboru++;
  zmenenoVyskytu += vyskytu;
  dotcene.push(path.relative(KOREN, p));
}

// POJISTKA 4: nulový zásah je skoro jistě špatně zadaná verze, ne hotovo.
if (zmenenoSouboru === 0) {
  console.error(`STOP: "${HLEDAT}" jsem nenašel v žádné stránce. Sedí stará verze?`);
  process.exit(1);
}

// POJISTKA 5: po zápisu nesmí ve stromu zůstat ANI JEDEN starý výskyt.
if (!nasucho) {
  const zbyle = projdi(KOREN).filter((p) => fs.readFileSync(p, 'utf8').includes(HLEDAT));
  if (zbyle.length) {
    console.error(`STOP: po přepisu zbylo ${zbyle.length} stránek se starou verzí, např. ${zbyle[0]}`);
    process.exit(1);
  }
}

console.log(`${nasucho ? '[NASUCHO] ' : ''}${HLEDAT} → ${NAHRADIT}`);
console.log(`stránek: ${zmenenoSouboru}, výskytů: ${zmenenoVyskytu}`);
console.log(`ukázka: ${dotcene.slice(0, 3).join(', ')}${dotcene.length > 3 ? ` … a ${dotcene.length - 3} dalších` : ''}`);
