// ============================================================
// KANÁREK pro detektor mrtvé pokladny v edge funkci `link-check`.
//
// ⛔ PROČ EXISTUJE. Hlídač odkazů měl v hlavičce napsáno, že „mrtvá pokladna je
// ta nejdražší porucha ze všech". Neuměl ji ale poznat: zrušený produkt vrací
// HTTP 200 a normální stránku, jen s textem „Produkt se již neprodává.".
// Změřeno 22. 8. 2026 v tabulce `link_check`: adresa `form.simpleshop.cz/Xgl8g/buy/`
// se deset dní po sobě zapsala jako `ok=true, poznamka=null`.
//
// ⛔ A PROČ SE TEN TEST MUSÍ PROHÁNĚT NAŽIVO. Komentář v souboru `link-check`
// říká: nula chyb může znamenat „vše v pořádku" i „detektor je slepý", a rozdíl
// pozná jen kanárek. Proto se tu tahají SKUTEČNÉ stránky, ne uložené kopie.
//
// Regex se ze zdrojáku VYTAHUJE, neopisuje. Kdyby se opsal, test by mohl projít
// nad jiným vzorem, než jaký se nasadí.
//
// Spuštění:  node scripts/kanarek-mrtva-pokladna.mjs
// Vrací 0, když všechny případy sedí, jinak 1.
// ============================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KOREN = join(dirname(fileURLToPath(import.meta.url)), '..');
const ZDROJ = join(KOREN, 'akademie', '_supabase', 'functions', 'link-check', 'index.ts');
const src = readFileSync(ZDROJ, 'utf8');

const m = src.match(/function jeMrtvyProdukt\(telo: string\): boolean \{\s*return (\/.+?\/i)\s*\.test\(telo\);/s);
if (!m) {
  console.error('NELZE VYTÁHNOUT REGEX ZE ZDROJÁKU. Buď se funkce `jeMrtvyProdukt` přejmenovala,');
  console.error('nebo změnila tvar. Oprav tenhle test, NEVYPÍNEJ ho.');
  process.exit(1);
}
const jeMrtvyProdukt = (telo) => new RegExp(m[1].slice(1, -2), 'i').test(telo);

// Původní soft-404 detektor. Je tu schválně, aby výpis pokaždé ukázal, že tenhle
// druh poruchy NECHYTAL, a nikoho nenapadlo nový detektor vyhodit jako zbytečný.
const soft404 = (t) => /stránka nenalezena|nenalezeno|page not found|404 not found|<title>404/.test(t.toLowerCase());

const HLAVICKY = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 LinkCheck-MartinBarna',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'cs-CZ,cs;q=0.9',
};

// ⚠️ GET na Payment Link je jen načtení stránky, žádnou platbu nezaloží.
const PRIPADY = [
  { url: 'https://form.simpleshop.cz/3Vbl/buy/', ceka: true, popis: 'zrušená pokladna, na kterou vede {{course_url}} (konstanta COURSE_URL v drip-send v62)' },
  { url: 'https://form.simpleshop.cz/Xgl8g/buy/', ceka: true, popis: 'odstavená Academy 8 900 (je v ODSTAVENE_POKLADNY, takže alert poslat NEMÁ)' },
  { url: 'https://buy.stripe.com/dRmeVcbnpaZs5VedBZ3ks06?locale=cs', ceka: false, popis: 'živá pokladna videokurzu' },
  { url: 'https://buy.stripe.com/4gM00ibnpgjMerK7dB3ks04', ceka: false, popis: 'živá pokladna Academy 8 900' },
  { url: 'https://tvujcoach.cz/', ceka: false, popis: 'běžná živá stránka (kontrola proti planému poplachu)' },
];

let chyb = 0;
for (const p of PRIPADY) {
  let telo = '';
  let status = null;
  try {
    const r = await fetch(p.url, { headers: HLAVICKY, redirect: 'follow' });
    status = r.status;
    telo = (await r.text()).slice(0, 4000);
  } catch (e) {
    console.log(`SÍŤ | ${p.url}: ${e}`);
    chyb++;
    continue;
  }
  const mrtvy = jeMrtvyProdukt(telo);
  const sedi = mrtvy === p.ceka;
  if (!sedi) chyb++;
  console.log(`${sedi ? 'OK  ' : 'CHYBA'} | HTTP ${status} | mrtvý=${mrtvy} (čekáno ${p.ceka}) | starý soft-404=${soft404(telo)} | ${p.popis}`);
}

console.log(chyb === 0 ? '\nVšech ' + PRIPADY.length + ' případů sedí.' : `\n${chyb} případů NESEDÍ.`);
process.exit(chyb === 0 ? 0 : 1);
