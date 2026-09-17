// Testy hlidky Ranniho prehledu (3. 9. 2026).
// Spusteni: npx --yes deno@2 run akademie/_supabase/functions/daily-digest/hlidky.test.ts
// (bez jakychkoli --allow-*: test necte sit, disk ani promenne prostredi)
import { hlidkaCisla, hlidkaClientRemind } from './hlidky.ts';

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


// ===== Hlidka nedelni pripominky klientum (17. 9. 2026, nalez V3) ==========
const DEN = 24 * HOD;
const cas = (ms: number) => new Date(ms).toISOString();

zkontroluj('chybejici zaznam je anomalie (cron hlidky nenasazeny)',
  hlidkaClientRemind(undefined, NOW).alertText !== null, true);
zkontroluj('POPLACH je vzdy anomalie',
  hlidkaClientRemind('POPLACH ' + cas(NOW) + ' :: nedelni pripominka neprobehla', NOW).alertText !== null, true);
zkontroluj('POPLACH nese puvodni text do alertu',
  (hlidkaClientRemind('POPLACH ' + cas(NOW) + ' :: 3 maily v nejistote', NOW).alertText ?? '').includes('3 maily v nejistote'), true);
// KONTRAST: cerstve OK nesmi delat sum. Kdyby delalo, Martin prestane cist.
zkontroluj('cerstve OK NENI anomalie',
  hlidkaClientRemind('OK ' + cas(NOW - 2 * HOD) + ' :: odeslano 5 pripominek', NOW).alertText, null);
zkontroluj('OK po 7 dnech je jeste v poradku (tydenni kadence)',
  hlidkaClientRemind('OK ' + cas(NOW - 7 * DEN) + ' :: odeslano 5 pripominek', NOW).alertText, null);
zkontroluj('presne 8 dni je jeste OK (hranice)',
  hlidkaClientRemind('OK ' + cas(NOW - 8 * DEN) + ' :: odeslano 5', NOW).alertText, null);
zkontroluj('9 dni znamena, ze umrela sama hlidka',
  (hlidkaClientRemind('OK ' + cas(NOW - 9 * DEN) + ' :: odeslano 5', NOW).alertText ?? '').includes('client-remind-hlidka'), true);
zkontroluj('nectitelny format je anomalie',
  hlidkaClientRemind('neco uplne jineho', NOW).alertText !== null, true);
zkontroluj('nectitelny cas u OK je anomalie',
  hlidkaClientRemind('OK nedatum :: odeslano 5', NOW).alertText !== null, true);
zkontroluj('radek u OK nese cislo z verdiktu',
  hlidkaClientRemind('OK ' + cas(NOW - HOD) + ' :: odeslano 5 pripominek', NOW).radek.includes('odeslano 5 pripominek'), true);

console.log(selhalo === 0 ? `\nHOTOVO: ${kontrol} kontrol, vse proslo.` : `\nSELHALO: ${selhalo} z ${kontrol}`);
if (selhalo > 0) Deno.exit(1);
