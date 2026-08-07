// Jednorazovy skript: v CTA slidu infografik opravi pocet videi (153 -> 182)
// a da nedelitelnou mezeru do ceny (800 Kc), aby se nelamala pres radek.
//
// PROC 182: overeno tremi zdroji, ktere se shoduji - akademie/videokurz/chain.json
// (182 polozek), akademie/_videokurz/manifest.json (182) a akademie/_videokurz/videos.tsv
// (182 radku; soubor NEMA hlavicku, prvni radek jsou uz data, takze to je 182 videi,
// ne 181). Web i maily uz 182 rikaji, decky byly jedine misto se starym cislem.
//
// ⛔ CHIRURGICKY: mereno pred zapisem, oba retezce se vyskytuji VYHRADNE ve slidech
// kind='cta' a v kazdem tematu prave jednou. Zadna jina "153" ve slidech (datova cisla)
// se proto dotknout nemuze - nahrazuje se cely retezec "153 videi", ne hole cislo.
import fs from 'node:fs';

const BASE = '_zdroje/infografiky';
const NAHRADY = [
  { z: '153 videí', na: '182 videí' },
  { z: '800 Kč', na: '800&nbsp;Kč' },
];

const suchy = process.argv.includes('--dry');
let chyb = 0;
const zmeneno = [];

for (const f of fs.readdirSync(BASE).filter((x) => x.endsWith('.json'))) {
  const cesta = `${BASE}/${f}`;
  const puvodni = fs.readFileSync(cesta, 'utf8');
  let novy = puvodni;
  const provedeno = [];

  for (const { z, na } of NAHRADY) {
    const pocet = puvodni.split(z).length - 1;
    if (pocet === 0) continue;
    if (pocet > 1) { console.log(`  CHYBA ${f}: "${z}" ${pocet}x, ocekavam nejvyse 1x`); chyb++; continue; }
    novy = novy.replace(z, na);
    provedeno.push(z);
  }
  if (!provedeno.length) continue;

  // DUKAZ 1: zpetna nahrada da BAJT PO BAJTU original
  let zpet = novy;
  for (const { z, na } of NAHRADY) if (provedeno.includes(z)) zpet = zpet.replace(na, z);
  if (zpet !== puvodni) { console.log(`  CHYBA ${f}: zpetny prevod nesedi`); chyb++; continue; }

  // DUKAZ 2: zadna JINA "153" se nezmenila (datova cisla ve slidech)
  const c153pred = (puvodni.match(/153/g) || []).length;
  const c153po = (novy.match(/153/g) || []).length;
  const ocekavanyUbytek = provedeno.includes('153 videí') ? 1 : 0;
  if (c153po !== c153pred - ocekavanyUbytek) {
    console.log(`  CHYBA ${f}: vyskytu "153" ${c153pred} -> ${c153po}, cekal jsem ubytek ${ocekavanyUbytek}`);
    chyb++; continue;
  }

  // DUKAZ 3: JSON se dal parsuje a ma stejny pocet slidu
  let jP, jN;
  try { jP = JSON.parse(puvodni); jN = JSON.parse(novy); }
  catch (e) { console.log(`  CHYBA ${f}: JSON se rozbil (${e.message.slice(0, 60)})`); chyb++; continue; }
  if ((jP.slides || []).length !== (jN.slides || []).length) { console.log(`  CHYBA ${f}: zmenil se pocet slidu`); chyb++; continue; }

  // DUKAZ 4: zmena je VYHRADNE ve slidu kind='cta'
  const mimoCta = (jP.slides || []).some((s, i) =>
    s.kind !== 'cta' && JSON.stringify(s) !== JSON.stringify((jN.slides || [])[i]));
  if (mimoCta) { console.log(`  CHYBA ${f}: zmena zasahla i mimo CTA slide`); chyb++; continue; }

  if (!suchy) fs.writeFileSync(cesta, novy);
  zmeneno.push({ tema: f.replace('.json', ''), co: provedeno });
}

console.log('');
console.log(suchy ? '=== SUCHY BEH (nic se nezapsalo) ===' : '=== ZAPSANO ===');
console.log(`  temat zmeneno: ${zmeneno.length}`);
console.log(`  z toho s opravou poctu videi: ${zmeneno.filter((x) => x.co.includes('153 videí')).length}`);
console.log(`  z toho s nedelitelnou mezerou: ${zmeneno.filter((x) => x.co.includes('800 Kč')).length}`);
const jenCena = zmeneno.filter((x) => !x.co.includes('153 videí')).map((x) => x.tema);
if (jenCena.length) console.log(`  jen cena (pocet videi tam nebyl): ${jenCena.join(', ')}`);
console.log(`  CHYB: ${chyb}`);
process.exit(chyb ? 1 : 0);
