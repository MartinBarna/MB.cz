// Testy hlidek Ranniho prehledu (3. 9. 2026).
// Spusteni: npx --yes deno@2 run akademie/_supabase/functions/daily-digest/hlidky.test.ts
// (bez jakychkoli --allow-*: test necte sit, disk ani promenne prostredi)
import { hlidkaCisla, hlidkaPrihlaseni, zkratEmail, type AuditRadek } from './hlidky.ts';

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

// ---------- Hlidka 1: cisla ----------
zkontroluj('chybejici zaznam je anomalie', hlidkaCisla(undefined, NOW).alertText !== null, true);
zkontroluj('nepredstavitelne datum je anomalie', hlidkaCisla('neni-datum', NOW).alertText !== null, true);
zkontroluj('presne 26 h je jeste OK (hranice)', hlidkaCisla(new Date(NOW - 26 * HOD).toISOString(), NOW).alertText, null);
zkontroluj('27 h je anomalie', hlidkaCisla(new Date(NOW - 27 * HOD).toISOString(), NOW).alertText !== null, true);
zkontroluj('6 h stare je OK a v radku pise 6 h', hlidkaCisla(new Date(NOW - 6 * HOD).toISOString(), NOW).radek.includes('6 h'), true);
zkontroluj('0 h stare (prave zmereno) je OK', hlidkaCisla(new Date(NOW).toISOString(), NOW).alertText, null);

// ---------- Hlidka 2: prihlaseni ----------
const R = (action: string, error: string | null, email: string | null): AuditRadek =>
  ({ action, error, email, created_at: '2026-09-03T10:00:00Z' });

zkontroluj('prazdny log = OK radek bez alertu', hlidkaPrihlaseni([], null).alertText, null);
zkontroluj('prazdny log hlasi text o prazdnem auditnim logu', hlidkaPrihlaseni([], null).radek.includes('prázdný'), true);

const parExpirovanych = [
  R('login', null, 'a@x.cz'),
  R('login', 'otp_expired', 'b@x.cz'),
  R('login', 'otp_expired', 'c@x.cz'),
];
zkontroluj('par expirovanych OTP bez opakovani je norma (bez alertu)', hlidkaPrihlaseni(parExpirovanych, 5).alertText, null);

const opakovaneSelhani = Array.from({ length: 6 }, () => R('login', 'invalid_credentials', 'opakovany@x.cz'));
zkontroluj('5+ selhani jednoho uzivatele je anomalie', hlidkaPrihlaseni(opakovaneSelhani, 5).alertText !== null, true);
zkontroluj('anomalie s opakovanim zminuje zkraceny email, ne cely', hlidkaPrihlaseni(opakovaneSelhani, 5).alertText!.includes('opa…@x.cz'), true);
zkontroluj('anomalie s opakovanim NEobsahuje celou adresu', hlidkaPrihlaseni(opakovaneSelhani, 5).alertText!.includes('opakovany@x.cz'), false);

const novyTypChyby = [R('login', 'neznamy_typ_chyby', 'd@x.cz')];
zkontroluj('novy typ chyby je anomalie', hlidkaPrihlaseni(novyTypChyby, 5).alertText !== null, true);

const nadPrumerem = Array.from({ length: 20 }, (_, i) => R('login', 'otp_expired', 'u' + i + '@x.cz'));
zkontroluj('3x nad 7denim prumerem je anomalie', hlidkaPrihlaseni(nadPrumerem, 5).alertText !== null, true);
zkontroluj('pod 3x prumeru neni anomalie sama o sobe', hlidkaPrihlaseni(nadPrumerem.slice(0, 10), 5).alertText, null);
zkontroluj('chybejici historicky prumer (null) anomalii z poctu nevyrobi', hlidkaPrihlaseni(nadPrumerem, null).alertText, null);

// ---------- zkratEmail ----------
zkontroluj('zkrati prefix na 3 znaky', zkratEmail('martin.barna@example.com'), 'mar…@example.com');
zkontroluj('kratsi prefix nez 3 znaky se nedoplnuje', zkratEmail('ab@example.com'), 'ab…@example.com');
zkontroluj('bez zavinace vrati zkraceny vstup', zkratEmail('neplatny-email'), 'nep…');

console.log(selhalo === 0 ? `\nHOTOVO: ${kontrol} kontrol, vse proslo.` : `\nSELHALO: ${selhalo} z ${kontrol}`);
if (selhalo > 0) Deno.exit(1);
