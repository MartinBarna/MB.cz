// Test zrcadla atribuce v assets/analytics.js.
//
// Ověřuje to, kvůli čemu zrcadlo vzniklo: že atribuce PŘEŽIJE zavření panelu.
// Do 8. 8. 2026 žila jen v sessionStorage a u příchodů z vestavěných prohlížečů
// (reklamy, maily, komentáře na sítích) se ztrácela. V appce to znamenalo
// utm_campaign na 0 z 27 profilů.
//
// Spuštění:  node scripts/test-atribuce-zrcadlo.mjs

import fs from 'node:fs';
import vm from 'node:vm';

const ZDROJ = 'assets/analytics.js';
const ZACATEK = '/* ===== Atribuce reklam napříč stránkami i doménou';
const KONEC = '})();';

// Vyřízne blok atribuce, ať se nemusí stubovat cookie lišta ani WhatsApp popup.
function blokAtribuce() {
  const cely = fs.readFileSync(ZDROJ, 'utf8');
  const od = cely.indexOf(ZACATEK);
  if (od === -1) throw new Error(`V ${ZDROJ} nenacházím začátek bloku atribuce.`);
  const do_ = cely.indexOf(KONEC, od);
  if (do_ === -1) throw new Error('Nenacházím konec bloku atribuce.');
  return cely.slice(od, do_ + KONEC.length);
}

/** Jednoduché úložiště, které se chová jako Storage v prohlížeči. */
function uloziste(pocatecni = {}) {
  const d = { ...pocatecni };
  return {
    getItem: (k) => (k in d ? d[k] : null),
    setItem: (k, v) => { d[k] = String(v); },
    removeItem: (k) => { delete d[k]; },
    _data: d,
  };
}

/**
 * Načte stránku: spustí blok atribuce nad daným query stringem a úložišti.
 * Vrací kontext, ať se dá sáhnout na window.MBAttr i na obsah úložišť.
 */
function nactiStranku({ query = '', session = {}, local = {}, ted = Date.now() } = {}) {
  const sessionStorage = uloziste(session);
  const localStorage = uloziste(local);
  const window = {};
  const document = {
    readyState: 'complete',
    querySelectorAll: () => [],
    addEventListener: () => {},
  };
  const ctx = vm.createContext({
    window, document, sessionStorage, localStorage,
    location: { search: query, href: 'https://martinbarna.cz/' + query },
    URLSearchParams, URL, JSON, console,
    Date: { ...Date, now: () => ted },
  });
  vm.runInContext(blokAtribuce(), ctx);
  return { window, sessionStorage, localStorage };
}

const UTM = '?utm_source=youtube&utm_medium=comment&utm_campaign=pin-balicek';
const ZRCADLO = 'mb_attr_v1_zrcadlo';
const DEN = 24 * 60 * 60 * 1000;

let spadlo = 0;
function overit(nazev, podminka, detail = '') {
  if (podminka) { console.log(`  ✅ ${nazev}`); }
  else { console.log(`  ❌ ${nazev}${detail ? ' — ' + detail : ''}`); spadlo++; }
}

console.log('\n1) Příchod z reklamy uloží atribuci do OBOU úložišť');
{
  const s = nactiStranku({ query: UTM });
  overit('sessionStorage nese utm_campaign',
    JSON.parse(s.sessionStorage.getItem('mb_attr_v1') || '{}').utm_campaign === 'pin-balicek');
  overit('localStorage má zrcadlo s razítkem',
    !!s.localStorage.getItem(ZRCADLO) && !!JSON.parse(s.localStorage.getItem(ZRCADLO)).ulozeno);
}

console.log('\n2) ⭐ JÁDRO OPRAVY: zavření panelu atribuci NEZAHODÍ');
{
  const prvni = nactiStranku({ query: UTM });
  const zrcadloPoPrvni = { [ZRCADLO]: prvni.localStorage.getItem(ZRCADLO) };
  // Nový panel: sessionStorage je prázdná, v URL už žádné parametry nejsou.
  const druha = nactiStranku({ query: '', session: {}, local: zrcadloPoPrvni });
  const a = druha.window.MBAttr.get();
  overit('MBAttr.get() vrátí utm_campaign i bez session a bez URL',
    a.utm_campaign === 'pin-balicek', `dostal jsem ${JSON.stringify(a)}`);
  overit('vrátí i utm_source', a.utm_source === 'youtube');
}

console.log('\n3) Zrcadlo starší než 7 dní se zahodí');
{
  const stare = { [ZRCADLO]: JSON.stringify({ ulozeno: 1000, data: { utm_campaign: 'davno' } }) };
  const s = nactiStranku({ query: '', local: stare, ted: 1000 + 8 * DEN });
  overit('prošlé zrcadlo se nepoužije', Object.keys(s.window.MBAttr.get()).length === 0);
  overit('a rovnou se uklidí', s.localStorage.getItem(ZRCADLO) === null);
}

console.log('\n4) Šest dní staré zrcadlo ještě platí');
{
  const skoroStare = { [ZRCADLO]: JSON.stringify({ ulozeno: 1000, data: { utm_campaign: 'jeste-plati' } }) };
  const s = nactiStranku({ query: '', local: skoroStare, ted: 1000 + 6 * DEN });
  overit('šestidenní zrcadlo se použije', s.window.MBAttr.get().utm_campaign === 'jeste-plati');
}

console.log('\n5) Po odeslání formuláře se zrcadlo smaže');
{
  const s = nactiStranku({ query: UTM });
  overit('zrcadlo před smazáním existuje', !!s.localStorage.getItem(ZRCADLO));
  s.window.MBAttr.smazZrcadlo();
  overit('po smazání je pryč', s.localStorage.getItem(ZRCADLO) === null);
}

console.log('\n6) Čerstvý klik přebije starý zdroj');
{
  const stareZrcadlo = { [ZRCADLO]: JSON.stringify({ ulozeno: Date.now(), data: { utm_campaign: 'stara-kampan' } }) };
  const s = nactiStranku({ query: '?utm_campaign=nova-kampan', local: stareZrcadlo });
  overit('aktuální URL má přednost', s.window.MBAttr.get().utm_campaign === 'nova-kampan');
}

console.log(spadlo === 0 ? '\n✅ Vše prošlo.\n' : `\n❌ Neprošlo: ${spadlo}\n`);
process.exit(spadlo === 0 ? 0 : 1);
