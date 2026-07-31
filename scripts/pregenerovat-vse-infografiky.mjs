#!/usr/bin/env node
// Přegeneruje VŠECHNA témata infografik (38 × 10 = 380 PNG).
//
// ⛔ NEJDŘÍV `node scripts/kontrola-preteceni-infografik.mjs`. Text, který se nevejde,
// se tiše ořízne a na hotovém PNG to nepoznáš. Tenhle skript proto kontrolu spustí sám
// a když najde přetečení, negeneruje nic.
//
// Spuštění: node scripts/pregenerovat-vse-infografiky.mjs
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.slice(1)), '..');
const SCENARE = path.join(ROOT, '_zdroje/infografiky');
process.env.OG_SHARP_DIR ||= 'C:/Users/fitne/Desktop/AI Martin';

console.log('1) Kontrola přetečení…');
try {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/kontrola-preteceni-infografik.mjs')],
    { stdio: ['ignore', 'ignore', 'inherit'], cwd: ROOT });
} catch {
  console.error('⛔ Kontrola přetečení NEPROŠLA. Negeneruju nic, oprav to nejdřív.');
  process.exit(1);
}
console.log('   ✅ nic nepřetéká\n2) Generuju…');

const temata = readdirSync(SCENARE).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
let hotovo = 0;
const chyby = [];
for (const t of temata) {
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts/generate-carousel.js'), t],
      { stdio: 'ignore', cwd: ROOT });
    hotovo++;
    process.stdout.write('   ' + String(hotovo).padStart(2) + '/' + temata.length + '  ' + t + '\n');
  } catch (e) {
    chyby.push(t);
    console.error('   🔴 ' + t + ' SELHALO');
  }
}
console.log('');
console.log('Hotovo: ' + hotovo + ' / ' + temata.length + ' témat (' + hotovo * 10 + ' obrázků)');
if (chyby.length) { console.error('⛔ Selhala: ' + chyby.join(', ')); process.exit(1); }
