// Test affiliate kodu v assets/referral.js a assets/analytics.js.
//
// Proc existuje: do 2. 9. 2026 zachytaval referral.js jen clenske kody `BARNA-XXXX`.
// Odkaz partnerky `martinbarna.cz/?ref=KRISTINA10` se nikam neulozil, klik se
// nezalogoval, do Stripe odkazu se neposlal a partnerka o provizi tise prisla.
// Tise = nikde to nekriklo, proto na to je test.
//
// Spusteni:  node scripts/test-affiliate-ref.mjs

import fs from 'node:fs';
import vm from 'node:vm';

let spadlo = 0;
function overit(nazev, podminka, detail = '') {
  if (podminka) console.log(`  OK  ${nazev}`);
  else { console.log(`  CHYBA  ${nazev}${detail ? ' -- ' + detail : ''}`); spadlo++; }
}

/** Uloziste, ktere se chova jako Storage v prohlizeci. */
function uloziste(pocatecni = {}) {
  const d = { ...pocatecni };
  return {
    getItem: (k) => (k in d ? d[k] : null),
    setItem: (k, v) => { d[k] = String(v); },
    removeItem: (k) => { delete d[k]; },
    _data: d,
  };
}

/** Minimalni DOM: staci na modal (styl, overlay, getElementById) a na click listener. */
function stubDom() {
  const prvky = {};
  function prvek(id) {
    if (!prvky[id]) {
      prvky[id] = { id, value: '', textContent: '', innerHTML: '', style: {}, focus() {}, onclick: null, onkeydown: null };
    }
    return prvky[id];
  }
  const posluchaci = [];
  const document = {
    readyState: 'complete',
    head: { appendChild() {} },
    body: { appendChild() {} },
    createElement: () => ({ style: {}, textContent: '', innerHTML: '', appendChild() {}, setAttribute() {} }),
    getElementById: (id) => prvek(id),
    querySelectorAll: () => [],
    addEventListener: (typ, fn, capture) => posluchaci.push({ typ, fn, capture }),
  };
  return { document, prvky, posluchaci };
}

/** Nacte celou referral.js nad danou adresou a ulozistem. */
function nactiReferral({ query = '', local = {} } = {}) {
  const { document, prvky, posluchaci } = stubDom();
  const localStorage = uloziste(local);
  const window = {};
  const location = { search: query, href: 'https://martinbarna.cz/' + query };
  const ctx = vm.createContext({
    window, document, localStorage, location,
    URLSearchParams, URL, JSON, Date, console, setTimeout,
    fetch: () => ({ catch() {} }),
  });
  vm.runInContext(fs.readFileSync('assets/referral.js', 'utf8'), ctx);
  return { window, localStorage, location, prvky, posluchaci, ctx };
}

/** Simuluje kliknuti na buy odkaz a vraci adresu, na kterou modal odesle "bez e-mailu". */
function klikniAPreskoc(prostredi, href) {
  const posluchac = prostredi.posluchaci.find((p) => p.typ === 'click');
  if (!posluchac) throw new Error('referral.js nezaregistroval click listener');
  const anchor = { getAttribute: () => href, href };
  let zabraneno = false;
  posluchac.fn({
    target: { closest: () => anchor },
    preventDefault() { zabraneno = true; },
    stopPropagation() {},
  });
  if (!zabraneno) return null;            // modal se neotevrel, odkaz jde beze zmeny
  prostredi.prvky['ba-ref-skip'].onclick();
  return prostredi.location.href;
}

console.log('\n1) Zachyceni kodu z adresy');
{
  const a = nactiReferral({ query: '?ref=KRISTINA10' });
  overit('affiliate kod se ulozi', a.localStorage.getItem('ba_ref') === 'KRISTINA10');
  overit('MBRef.get() ho vrati', a.window.MBRef.get() === 'KRISTINA10');
  overit('affiliate NENI clensky', a.window.MBRef.jeClensky('KRISTINA10') === false);

  const b = nactiReferral({ query: '?ref=barna-ab12' });
  overit('clensky kod stale funguje (a velka pismena)', b.localStorage.getItem('ba_ref') === 'BARNA-AB12');
  overit('MBRef.jeClensky u BARNA- je true', b.window.MBRef.jeClensky('BARNA-AB12') === true);

  const c = nactiReferral({ query: '?ref=AB' });
  overit('prilis kratky kod se neuklada', c.localStorage.getItem('ba_ref') === null);

  const d = nactiReferral({ query: '?ref=' + 'A'.repeat(40) });
  overit('kod nad 32 znaku se neuklada', d.localStorage.getItem('ba_ref') === null);

  const e = nactiReferral({ query: '?ref=SRC-META' });
  overit('kod v tvaru atribuce (SRC-) se neuklada', e.localStorage.getItem('ba_ref') === null,
    'jinak by ho rozdelClientRef ve webhooku snedl jako utm_source');

  const f = nactiReferral({ query: '', local: { ba_ref: 'LUCIE10', ba_ref_t: String(Date.now()) } });
  overit('kod prezije prechod na dalsi stranku', f.window.MBRef.get() === 'LUCIE10');

  const g = nactiReferral({ query: '', local: { ba_ref: 'LUCIE10', ba_ref_t: String(Date.now() - 61 * 864e5) } });
  overit('po 60 dnech kod vyprsi', g.window.MBRef.get() === '');
}

console.log('\n2) Stripe odkaz nese kod partnera i jeho vlastni kupon');
{
  const STRIPE = 'https://buy.stripe.com/4gM00ibnpgjMerK7dB3ks04?client_reference_id=src-meta_med-cpc';

  const a = nactiReferral({ query: '?ref=KRISTINA10' });
  const url = new URL(klikniAPreskoc(a, STRIPE));
  overit('client_reference_id = kod partnera', url.searchParams.get('client_reference_id') === 'KRISTINA10');
  overit('atribuce reklamy z odkazu je pryc (jedna hodnota, penize partnera prednost)',
    url.searchParams.getAll('client_reference_id').length === 1);
  overit('prefilled_promo_code = kod partnera', url.searchParams.get('prefilled_promo_code') === 'KRISTINA10');

  const b = nactiReferral({ query: '?ref=BARNA-AB12' });
  const url2 = new URL(klikniAPreskoc(b, STRIPE));
  overit('clensky kod ma dal DOPORUC10', url2.searchParams.get('prefilled_promo_code') === 'DOPORUC10');
  overit('clensky client_reference_id = BARNA-AB12', url2.searchParams.get('client_reference_id') === 'BARNA-AB12');

  const c = nactiReferral({ query: '' });
  overit('bez kodu se modal neotevre a odkaz jde beze zmeny', klikniAPreskoc(c, STRIPE) === null);
}

console.log('\n3) rozdelClientRef ve webhooku vezme kod jako kod, ne jako atribuci');
{
  // Zrcadlo parseru z akademie/_supabase/functions/academy-stripe-webhook/index.ts.
  // Kdyby se rozesel, partner tise prijde o provizi (lookup vrati "neznamy-kod").
  const ATTR = { src: 'utm_source', med: 'utm_medium', cmp: 'utm_campaign', cnt: 'utm_content' };
  function rozdelClientRef(raw) {
    const s = (raw ?? '').trim();
    if (!s) return { kod: '', atribuce: null };
    const out = {}; const zbytek = [];
    for (const cast of s.split('_')) {
      if (!cast) continue;
      const p = cast.indexOf('-');
      const klic = p > 0 ? ATTR[cast.slice(0, p).toLowerCase()] : undefined;
      if (klic && !out[klic]) out[klic] = cast.slice(p + 1).slice(0, 60);
      else zbytek.push(cast);
    }
    return { kod: zbytek.join('_'), atribuce: Object.keys(out).length ? out : null };
  }
  for (const kod of ['KRISTINA10', 'LUCIE10', 'JIRKA10', 'MAREK10', 'BARNA-AB12']) {
    overit(`"${kod}" projde jako kod`, rozdelClientRef(kod).kod === kod);
  }
}

console.log('\n4) analytics.js dotaguje ref do odkazu na appku');
{
  const cely = fs.readFileSync('assets/analytics.js', 'utf8');
  const od = cely.indexOf('/* ===== Atribuce reklam napříč stránkami i doménou');
  const doo = cely.indexOf('})();', od);
  const blok = cely.slice(od, doo + 5);

  function dekoruj({ ref = '', href = 'https://tvujcoach.cz/', query = '' } = {}) {
    const odkaz = {
      _href: href,
      getAttribute: () => odkaz._href,
      setAttribute: (_k, v) => { odkaz._href = v; },
    };
    const window = { MBRef: ref ? { get: () => ref } : undefined };
    const posluchaci = [];
    const document = {
      readyState: 'complete',
      querySelectorAll: (sel) => (sel.indexOf('tvujcoach.cz') >= 0 ? [odkaz] : []),
      addEventListener: (t, fn) => posluchaci.push({ t, fn }),
    };
    const ctx = vm.createContext({
      window, document, sessionStorage: uloziste(), localStorage: uloziste(),
      location: { search: query, href: 'https://martinbarna.cz/' + query },
      URLSearchParams, URL, JSON, console, Date,
    });
    vm.runInContext(blok, ctx);
    return odkaz._href;
  }

  overit('bez atribuce i bez refu odkaz zustane cisty',
    dekoruj() === 'https://tvujcoach.cz/');
  overit('samotny ref se doplni i bez utm parametru',
    new URL(dekoruj({ ref: 'KRISTINA10' })).searchParams.get('ref') === 'KRISTINA10');
  const sUtm = new URL(dekoruj({ ref: 'LUCIE10', query: '?utm_source=fb&utm_medium=cpc' }));
  overit('ref jde vedle atribuce reklamy',
    sUtm.searchParams.get('ref') === 'LUCIE10' && sUtm.searchParams.get('utm_source') === 'fb');
  overit('rucni ?ref= v odkazu (zkratky /go/*) se neprepise',
    new URL(dekoruj({ ref: 'LUCIE10', href: 'https://tvujcoach.cz/?ref=MAREK10' })).searchParams.get('ref') === 'MAREK10');
  overit('odkaz s ?plan=vip si parametr necha',
    new URL(dekoruj({ ref: 'LUCIE10', href: 'https://tvujcoach.cz/?plan=vip' })).searchParams.get('plan') === 'vip');
}

console.log('\n5) Academy: ?ref=KRISTINA10 da Stripe odkazum na akademii vlastni kupon');
{
  const stranka = fs.readFileSync('akademie/index.html', 'utf8');

  // Bez OBOU skriptu by na akademii nebyl ani `window.MBRef`, ani modal: partnerka
  // by prisla o provizi prave na strance, kam ji posila jeji vlastni grafika.
  const poziceAnalytics = stranka.indexOf('/assets/analytics.js?v=');
  const poziceReferral = stranka.indexOf('/assets/referral.js?v=');
  overit('akademie/index.html nacita analytics.js', poziceAnalytics > -1);
  overit('akademie/index.html nacita referral.js', poziceReferral > -1);
  overit('poradi je analytics.js pred referral.js',
    poziceAnalytics > -1 && poziceReferral > poziceAnalytics,
    'referral.js musi bezet az po analytics.js, jinak decorate() nevidi MBRef');

  // Platebni odkazy, ktere na strance Academy opravdu jsou.
  const odkazy = [...new Set(stranka.match(/https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+/g) || [])];
  overit('na akademii je aspon jeden Stripe odkaz', odkazy.length > 0, `nasel jsem ${odkazy.length}`);

  const ACADEMY_DOZIVOTNE = 'https://buy.stripe.com/4gM00ibnpgjMerK7dB3ks04';
  overit('dozivotni Academy je mezi odkazy na strance', odkazy.indexOf(ACADEMY_DOZIVOTNE) > -1);

  const a = nactiReferral({ query: '?ref=KRISTINA10' });
  const cil = klikniAPreskoc(a, ACADEMY_DOZIVOTNE + '?locale=cs');
  overit('modal se otevrel', cil !== null);
  const url = new URL(cil);
  overit('prefilled_promo_code = KRISTINA10', url.searchParams.get('prefilled_promo_code') === 'KRISTINA10');
  overit('client_reference_id = KRISTINA10', url.searchParams.get('client_reference_id') === 'KRISTINA10');
  overit('vlastni parametry odkazu zustavaji', url.searchParams.get('locale') === 'cs');

  // Odkaz Academy s odectem videokurzu je tatáz cesta, jen levnejsi produkt.
  const b = nactiReferral({ query: '?ref=KRISTINA10' });
  const cil2 = new URL(klikniAPreskoc(b, 'https://buy.stripe.com/9B6aEW6356Jc4Ra55t3ks05'));
  overit('Academy s odectem taky nese kupon partnera',
    cil2.searchParams.get('prefilled_promo_code') === 'KRISTINA10');

  // Mesicni clenstvi je v `buyInfo` VEDOME vynechane (obchodni rozhodnuti, jestli se
  // za predplatne vyplaci odmena). Test to drzi zapsane, at se to nezmeni omylem.
  const c = nactiReferral({ query: '?ref=KRISTINA10' });
  overit('mesicni clenstvi Academy referral nechyta',
    klikniAPreskoc(c, 'https://buy.stripe.com/bJe9AS3UXgjMcjC8hF3ks00?locale=cs') === null);
}

console.log('\n6) Zkratky /go/* miri, kam maji');
{
  const ocekavane = [
    ['go/lucie/index.html', 'https://tvujcoach.cz/?ref=LUCIE10&utm_source=lucik.en&utm_medium=affiliate'],
    ['go/kristina/index.html', 'https://tvujcoach.cz/?ref=KRISTINA10&utm_source=kristinadittrich&utm_medium=affiliate'],
    ['go/jirka/index.html', 'https://tvujcoach.cz/?ref=JIRKA10&utm_source=jirka-langmajer&utm_medium=affiliate'],
    ['go/marek/index.html', 'https://tvujcoach.cz/?ref=MAREK10&utm_source=marek-barna&utm_medium=affiliate'],
    ['go/lucie-academy/index.html', 'https://martinbarna.cz/akademie/?ref=LUCIE10&utm_source=lucik.en&utm_medium=affiliate'],
    ['go/kristina-academy/index.html', 'https://martinbarna.cz/akademie/?ref=KRISTINA10&utm_source=kristinadittrich&utm_medium=affiliate'],
    ['go/jirka-academy/index.html', 'https://martinbarna.cz/akademie/?ref=JIRKA10&utm_source=jirka-langmajer&utm_medium=affiliate'],
    ['go/marek-academy/index.html', 'https://martinbarna.cz/akademie/?ref=MAREK10&utm_source=marek-barna&utm_medium=affiliate'],
  ];
  for (const [soubor, cil] of ocekavane) {
    const s = fs.readFileSync(soubor, 'utf8');
    // location.replace, <noscript> refresh i klikaci zaloha musi mirit na TOTEZ.
    const holy = s.split(cil).length - 1;
    const escapovany = s.split(cil.replace(/&/g, '&amp;')).length - 1;
    overit(`${soubor} miri 3x na spravny cil`, holy + escapovany === 3,
      `holy ${holy}, s &amp; ${escapovany}`);
    overit(`${soubor} ma noindex`, s.indexOf('<meta name="robots" content="noindex, nofollow">') > -1);
  }
}

console.log(spadlo ? `\nSPADLO: ${spadlo}` : '\nVSE PROSLO');
process.exit(spadlo ? 1 : 0);
