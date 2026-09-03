// Testy hlidky Ranniho prehledu (3. 9. 2026).
// Spusteni: npx --yes deno@2 run akademie/_supabase/functions/daily-digest/hlidky.test.ts
// (bez jakychkoli --allow-*: test necte sit, disk ani promenne prostredi)
import { hlidkaCisla } from './hlidky.ts';

let selhalo = 0;
let kontrol = 0;
function zkontroluj(popis: string, dostal: unknown, cekal: unknown) {
  kontrol++;
  const ok = JSON.stringify(dostal) === JSON.stringify(cekal);
  if (ok) {
    console.log(`✓ ${popis}`);
  } else {
    selhalo++;
    console.error(`✗ ${popis}: cekal ${JSON.stringify(cekal)}, dostal ${JSON.stringify(dostal)}`);
  }
}

const HOD = 3600000;
const NOW = Date.parse("2026-09-03T12:00:00Z");

zkontroluj('chybejici zaznam je anomalie', hlidkaCisla(undefined, NOW).alertText !== null, true);
zkontroluj('nepredstavitelne datum je anomalie', hlidkaCisla('neni-datum', NOW).alertText !== null, true);
zkontroluj('presne 26 h je jeste OK (hranice)', hlidkaCisla(new Date(NOW - 26 * HOD).toISOString(), NOW).alertText, null);
zkontroluj('27 h je anomalie', hlidkaCisla(new Date(NOW - 27 * HOD).toISOString(), NOW).alertText !== null, true);
zkontroluj('6 h stare je OK a v radku pise 6 h', hlidkaCisla(new Date(NOW - 6 * HOD).toISOString(), NOW).radek.includes('6 h'), true);
zkontroluj('0 h stare (prave zmereno) je OK', hlidkaCisla(new Date(NOW).toISOString(), NOW).alertText, null);

console.log(selhalo === 0 ? `\nHOTOVO: ${kontrol} kontrol, vse proslo.` : `\nSELHALO: ${selhalo} z ${kontrol}`);
if (selhalo > 0) Deno.exit(1);
