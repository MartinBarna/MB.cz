// Test atribuce v `client_reference_id` (1. 9. 2026).
// Spusteni:
//   npx --yes deno@2 run --allow-read akademie/_supabase/functions/academy-stripe-webhook/atribuce-client-ref.test.ts
//
// CO HLIDA:
// Stripe Payment Link propise do Checkout Session z adresy JEN `client_reference_id`.
// Do jednoho pole proto pisou TRI mista, ktera o sobe navzajem nevi:
//   1) `assets/analytics.js`  slozi atribuci reklamy (`src-meta_med-cpc_…`)
//   2) `assets/referral.js`   ji pri kliknuti PREPISE kodem doporucitele (penize maji prednost)
//   3) `academy-stripe-webhook` to zase rozebere (`rozdelClientRef`)
// ⛔ Kdyby se rozesly, atribuce by se vydavala za kod doporucitele: lookup vrati
//    „neznamy-kod", fallback na `referral_click` se NIKDY nespusti a partner tise
//    prijde o provizi. Nic nespadne, jen se prestanou pripisovat penize.
//
// PROC SE ZDROJAK CTE JAKO TEXT: stejny duvod jako u `katalog-konzistence.test.ts`,
// `index.ts` vola `Deno.serve()` hned pri importu. Buildovaci funkce z `analytics.js`
// jsou ale ciste, takze se vyriznou a spusti doopravdy (ne jen porovnaji textem).

const KOREN = new URL('../../../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const WEBHOOK = KOREN + 'akademie/_supabase/functions/academy-stripe-webhook/index.ts';
const ANALYTICS = KOREN + 'assets/analytics.js';
const REFERRAL = KOREN + 'assets/referral.js';

const zdrojWebhook = await Deno.readTextFile(WEBHOOK);
const zdrojAnalytics = await Deno.readTextFile(ANALYTICS);
const zdrojReferral = await Deno.readTextFile(REFERRAL);

type Kontrola = { name: string; pass: boolean; detail: string };
const cases: Kontrola[] = [];
const check = (name: string, pass: boolean, detail = '') => cases.push({ name, pass, detail });

// --- 1) Skladacka z analytics.js: vyrizni a SPUSTI ---
// ⚠️ Konce radku jsou v repu CRLF, takze se nesmi hledat '\n\n'. Rezeme podle
// prvniho radku, ktery zacina dvema mezerami a uzaviraci slozenou zavorkou.
function vyrizni(zdroj: string, zacatek: string): string {
  const i = zdroj.indexOf(zacatek);
  if (i < 0) throw new Error('nenasel jsem blok: ' + zacatek);
  const j = zdroj.indexOf('\n  }', i);
  if (j < 0) throw new Error('nenasel jsem konec bloku: ' + zacatek);
  return zdroj.slice(i, j + 4);
}
function vyrizniRadek(zdroj: string, zacatek: string): string {
  const i = zdroj.indexOf(zacatek);
  if (i < 0) throw new Error('nenasel jsem radek: ' + zacatek);
  const j = zdroj.indexOf('];', i);
  return zdroj.slice(i, j + 2);
}
const skladacka = new Function(
  vyrizni(zdrojAnalytics, 'function ocistiHodnotu(') + '\n' +
  vyrizniRadek(zdrojAnalytics, 'var CREF_POLE =') + '\n' +
  vyrizni(zdrojAnalytics, 'function clientRefAtribuce(') + '\n' +
  'return { ocisti: ocistiHodnotu, cref: clientRefAtribuce };',
)() as { ocisti: (v: unknown) => string; cref: (a: Record<string, string>) => string };

const POVOLENE = /^[A-Za-z0-9_-]{1,200}$/;   // co Stripe u `client_reference_id` snese

const plnaAtribuce = {
  utm_source: 'meta', utm_medium: 'cpc',
  utm_campaign: 'koucink-warm', utm_content: 'koucink-warm-portret',
};
const hotovo = skladacka.cref(plnaAtribuce);
check('A1 plna atribuce ma ocekavany tvar', hotovo === 'src-meta_med-cpc_cmp-koucink-warm_cnt-koucink-warm-portret', hotovo);
check('A2 bez atribuce se posila src-direct', skladacka.cref({}) === 'src-direct', skladacka.cref({}));
check('A3 vysledek projde pres Stripe pravidla', POVOLENE.test(hotovo), hotovo);

// Podtrzitko oddeluje pole, takze se uvnitr hodnoty nesmi objevit ANI JEDNOU,
// jinak by webhook rozdelil hodnotu na dva kusy.
const sPodtrzitkem = skladacka.cref({ utm_campaign: 'letni_akce 2026', utm_source: 'meta' });
check('A4 podtrzitko a mezera v hodnote se meni na pomlcku', sPodtrzitkem.split('_').length === 2, sPodtrzitkem);
check('A5 vysledek s balastem projde pres Stripe pravidla', POVOLENE.test(sPodtrzitkem), sPodtrzitkem);

const dlouhe = skladacka.cref({
  utm_source: 'x'.repeat(300), utm_medium: 'y'.repeat(300),
  utm_campaign: 'z'.repeat(300), utm_content: 'q'.repeat(300),
});
check('A6 ani nesmyslne dlouha hodnota nepresahne 200 znaku', dlouhe.length <= 200, String(dlouhe.length));
check('A7 diakritika a lomitka nezustanou', skladacka.ocisti('Kouč/ink 2026!') === 'kou-ink-2026', skladacka.ocisti('Kouč/ink 2026!'));
check('A8 hodnota nikdy nekonci pomlckou', !skladacka.ocisti('a'.repeat(39) + '-b').endsWith('-'), skladacka.ocisti('a'.repeat(39) + '-b'));

// --- 2) Predpony musi sedet na obou stranach ---
const predponyWeb = [...zdrojAnalytics.slice(zdrojAnalytics.indexOf('var CREF_POLE ='))
  .slice(0, 260).matchAll(/\['([a-z]{3})',\s*'(utm_[a-z]+)'\]/g)].map((m) => m[1] + '=' + m[2]);
const blokPrefix = zdrojWebhook.slice(zdrojWebhook.indexOf('const ATTR_PREFIX'), zdrojWebhook.indexOf('function rozdelClientRef'));
const predponyWebhook = [...blokPrefix.matchAll(/([a-z]{3}):\s*"(utm_[a-z]+)"/g)].map((m) => m[1] + '=' + m[2]);
check('B1 web zna vsechny ctyri predpony', predponyWeb.length === 4, JSON.stringify(predponyWeb));
check('B2 webhook zna presne tytez predpony',
  predponyWeb.length > 0 && predponyWeb.join(',') === predponyWebhook.join(','),
  `web=${JSON.stringify(predponyWeb)} webhook=${JSON.stringify(predponyWebhook)}`);

// --- 3) Webhook musi kod od atribuce oddelovat na VSECH mistech ---
// ⛔ Kdyby nekde zustalo puvodni `obj.client_reference_id` predavane primo do
//    `atribuujReferral`, prisel by partner o provizi prave u nakupu z reklamy.
const syroveDoReferral = [...zdrojWebhook.matchAll(/atribuujReferral\([\s\S]{0,220}?\)/g)]
  .filter((m) => m[0].includes('obj.client_reference_id'));
check('C1 zadne volani atribuujReferral nedostava syrove client_reference_id',
  syroveDoReferral.length === 0, syroveDoReferral.map((m) => m[0].slice(0, 80)).join(' | '));
check('C2 webhook rozdeluje pole funkci rozdelClientRef',
  /function rozdelClientRef\(/.test(zdrojWebhook) && zdrojWebhook.includes('rozdelClientRef('), '');
check('C3 atribuce se nikdy neprepisuje (zapis jen do prazdne hodnoty)',
  /is\("attribution", null\)/.test(zdrojWebhook), '');

// --- 4) referral.js: kod doporucitele nesmi skoncit jako DRUHY parametr ---
check('D1 referral.js pred pripojenim kodu smaze stavajici client_reference_id',
  /searchParams\.delete\('client_reference_id'\)/.test(zdrojReferral), '');
check('D2 referral.js kod dal pripojuje', /pridej\('client_reference_id', ref\)/.test(zdrojReferral), '');

// --- vysledek ---
let spadlo = 0;
for (const c of cases) {
  if (!c.pass) spadlo++;
  console.log(`${c.pass ? 'OK  ' : 'FAIL'} ${c.name}${c.detail ? '  ' + c.detail : ''}`);
}
console.log(`\n${cases.length - spadlo}/${cases.length} proslo`);
if (spadlo) Deno.exit(1);
