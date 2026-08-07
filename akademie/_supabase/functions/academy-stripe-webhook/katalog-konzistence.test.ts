// Test konzistence katalogu jednorazovych produktu (7. 8. 2026).
// Spusteni:
//   npx --yes deno@2 run --allow-read akademie/_supabase/functions/academy-stripe-webhook/katalog-konzistence.test.ts
//
// PROC CTE ZDROJAK JAKO TEXT A NEIMPORTUJE HO:
// `academy-stripe-webhook/index.ts` vola `Deno.serve()` hned pri importu, takze by test
// nastartoval server. Vytahnout KATALOG do vlastniho modulu by znamenalo refaktor
// nejcitlivejsiho souboru v systemu (penize), a pamet `tvujcoach-balicek-349` na nej
// vyslovne zakazuje sahat bez prubehu testovacim rezimem Stripu. Textova kontrola je
// slabsi, ale chyta presne tu tridu chyby, o kterou tady jde: ROZEJITI TRI MIST,
// ktera o sobe navzajem nevi (KATALOG, ODKAZ_NA_PRODUKT, seznam zdroju v daily-digest).

const KOREN = new URL('../../../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const WEBHOOK = KOREN + 'akademie/_supabase/functions/academy-stripe-webhook/index.ts';
const DIGEST = KOREN + 'akademie/_supabase/functions/daily-digest/index.ts';

const zdrojWebhook = await Deno.readTextFile(WEBHOOK);
const zdrojDigest = await Deno.readTextFile(DIGEST);

type Kontrola = { name: string; pass: boolean; detail: string };
const cases: Kontrola[] = [];
const check = (name: string, pass: boolean, detail = '') => cases.push({ name, pass, detail });

// --- 1) Klice katalogu a jejich `source` ---
const blokKatalog = zdrojWebhook.slice(
  zdrojWebhook.indexOf('const KATALOG'),
  zdrojWebhook.indexOf('// Ktery odkaz vede na ktery klic katalogu') >= 0
    ? zdrojWebhook.indexOf('// Ktery odkaz vede na ktery klic katalogu')
    : zdrojWebhook.indexOf('function parsujOdkazy'),
);
const klice = [...blokKatalog.matchAll(/^\s{2}"([a-z0-9-]+)":\s*\{/gm)].map((m) => m[1]);
const zdroje = [...blokKatalog.matchAll(/source:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);

check('K1 katalog se naparsoval', klice.length >= 5, `klice=${JSON.stringify(klice)}`);
check('K2 novy klic videokurz-upgrade je v katalogu', klice.includes('videokurz-upgrade'), JSON.stringify(klice));
check('K3 novy zdroj stripe-videokurz-upgrade je v katalogu', zdroje.includes('stripe-videokurz-upgrade'), JSON.stringify(zdroje));

// --- 2) Upgrade nesmi rozdat nic navic ---
const blokUpgrade = blokKatalog.slice(blokKatalog.indexOf('"videokurz-upgrade"'));
const telUpgrade = blokUpgrade.slice(0, blokUpgrade.indexOf('},') + 1);
check('K4 upgrade dava produkt videokurz', /produkt:\s*"videokurz"/.test(telUpgrade), telUpgrade);
check('K5 upgrade NEDAVA appku (tcGrant false)', /tcGrant:\s*false/.test(telUpgrade), telUpgrade);
check('K6 upgrade nema videokurzBonus (ten je jen u konzultace 2990)',
  !/videokurzBonus/.test(telUpgrade), telUpgrade);
check('K7 upgrade jede na tutez uvitaci trat jako plny videokurz',
  /welcome:\s*"onboarding-nakup-videokurz"/.test(telUpgrade), telUpgrade);

// --- 3) Kazdy odkaz musi vest na existujici klic katalogu ---
// (parsujOdkazy takovy radek jen zaloguje a IGNORUJE, takze by platba tise propadla)
const blokOdkazy = zdrojWebhook.slice(
  zdrojWebhook.indexOf('const ODKAZ_NA_PRODUKT'),
  zdrojWebhook.indexOf('const ALLOWED_PLINKS'),
);
const mapovani = [...blokOdkazy.matchAll(/"(plink_[A-Za-z0-9_]+)=([a-z0-9-]+)/g)].map((m) => ({ odkaz: m[1], klic: m[2] }));
const sirotci = mapovani.filter((m) => !klice.includes(m.klic));
check('K8 zadny odkaz nevede na neexistujici klic katalogu', sirotci.length === 0, JSON.stringify(sirotci));
check('K9 odkaz na upgrade je namapovany',
  mapovani.some((m) => m.klic === 'videokurz-upgrade'), JSON.stringify(mapovani.map((m) => m.klic)));

// --- 4) POJISTKA PROTI NASAZENI PLACEHOLDERU ---
// Nesmi spadnout ted (ID jeste neexistuje), ale musi KRICET, az se bude nasazovat.
const maPlaceholder = /plink_DOPLNIT_UPGRADE_450/.test(zdrojWebhook);
if (maPlaceholder) {
  console.warn('\n⚠️  UPOZORNENI: v ODKAZ_NA_PRODUKT je porad PLACEHOLDER `plink_DOPLNIT_UPGRADE_450`.');
  console.warn('   Nez tohle pujde na produkci, musi ho nahradit skutecne ID odkazu ze Stripu.\n');
}
check('K10 placeholder je oznaceny tak, aby sel najit', !maPlaceholder || /DOPLNIT/.test(zdrojWebhook), '');

// --- 5) NEJDULEZITEJSI: kazdy zdroj z katalogu musi znat i daily-digest ---
// Seznam v digestu je natvrdo. Kdyz se rozejde, penize prijdou a prehled mlci
// (presne to se stalo 6. 8. 2026 u tri ze ctyr produktu).
const radekDigest = (zdrojDigest.match(/\.in\("source",\s*\[[^\]]+\]\)\.gte\("granted_at"/) ?? [''])[0];
const zdrojeDigest = [...radekDigest.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]).filter((s) => s !== 'source');
const chybiVDigestu = [...new Set(zdroje)].filter((s) => !zdrojeDigest.includes(s));
check('K11 daily-digest zna VSECHNY zdroje z katalogu (jinak se prodej nezapocita)',
  chybiVDigestu.length === 0, `chybi=${JSON.stringify(chybiVDigestu)} digest=${JSON.stringify(zdrojeDigest)}`);

// --- 6) DOKLAD O ZAPLACENI PATRI KAZDEMU JEDNORAZOVEMU PRODUKTU (7. 8. 2026) ---
// Do teto opravy byl `posliDoklad` natvrdo balickovy: nazev produktu, odkaz na
// odstoupeni i veta o souborech. Kupec videokurzu (800), upgradu i konzultace
// (2 990) zaplatil a doklad nedostal. Tyhle kontroly hlidaji, aby se to nevratilo.
const blokDoklad = zdrojWebhook.slice(
  zdrojWebhook.indexOf('async function posliDoklad'),
  zdrojWebhook.indexOf('Deno.serve('),
);

check('D1 posliDoklad dostava radek katalogu (`def`), ne jen e-mail a session',
  /async function posliDoklad\([^)]*def:\s*JednorazovyProdukt/.test(zdrojWebhook), '');

// Nejdulezitejsi kontrola cele sady: kdyby se pred volani vratila podminka na produkt,
// doklad by zase chodil jen nekomu a nikde by to nekriklo.
check('D2 volani posliDoklad NENI podmineno konkretnim produktem',
  !/if\s*\(\s*klic\s*===\s*"[a-z0-9-]+"\s*\)\s*doklad\s*=\s*await\s+posliDoklad/.test(zdrojWebhook),
  'nekdo vratil podminku typu `if (klic === "balicek") doklad = await posliDoklad(...)`');

check('D3 vsechna volani posliDoklad predavaji `def`',
  [...zdrojWebhook.matchAll(/posliDoklad\(([^)]*)\)/g)]
    .filter((m) => !m[1].includes('email: string'))   // vynech definici funkce
    .every((m) => /,\s*def\s*$/.test(m[1])),
  JSON.stringify([...zdrojWebhook.matchAll(/posliDoklad\(([^)]*)\)/g)].map((m) => m[1])));

check('D4 nazev produktu v dokladu jde z katalogu, ne natvrdo',
  blokDoklad.includes('${def.nazev}'), '');

check('D5 odkaz na odstoupeni v dokladu jde z katalogu, ne natvrdo `balicek`',
  blokDoklad.includes('${encodeURIComponent(def.produkt)}') && !/product=balicek/.test(blokDoklad), '');

// Zadny nazev produktu z katalogu nesmi zustat natvrdo v tele dokladu.
const nazvy = [...blokKatalog.matchAll(/nazev:\s*"([^"]+)"/g)].map((m) => m[1]);
const natvrdoVDokladu = nazvy.filter((n) => blokDoklad.includes(n));
check('D6 v dokladu nezustal natvrdo napsany zadny nazev produktu',
  natvrdoVDokladu.length === 0, JSON.stringify(natvrdoVDokladu));

// Slevove kody meni castku, takze se NIKDY nesmi brat z ceniku.
check('D7 castka se dal bere z amount_total session (kvuli slevovym kodum)',
  /amount_total/.test(blokDoklad), '');

// Stav dokladu uz se nesmi inicializovat jako "netyka-se" podle produktu.
check('D8 stav dokladu se neinicializuje podminkou na produkt',
  !/let\s+doklad\s*=\s*klic\s*===/.test(zdrojWebhook), '');

// --- 7) AFFILIATE ATRIBUCE: promo kod jako treti zdroj (7. 8. 2026) ---
// Affiliate partnerky dostavaji provizi z realne zaplacene castky, takze spatne
// prirazeny kod nebo spatna castka = spatne vyplacene penize.
const blokRef = zdrojWebhook.slice(
  zdrojWebhook.indexOf('async function zjistiPromoKod'),
  zdrojWebhook.indexOf('// --- Uvitaci e-mail') >= 0
    ? zdrojWebhook.indexOf('// --- Uvitaci e-mail')
    : zdrojWebhook.indexOf('async function posliUvitani'),
);

check('A1 promo kod se cte ze session.discounts',
  /discounts/.test(blokRef) && /promotion_code/.test(blokRef), '');

// PRIORITA je jadro veci: promo kod musi prebit oba stare zdroje.
const iPromo = blokRef.indexOf('zdrojKodu = "promo"');
const iClient = blokRef.indexOf('zdrojKodu = "client_reference_id"');
const iClick = blokRef.indexOf('zdrojKodu = "referral_click"');
check('A2 priorita promo > client_reference_id > referral_click',
  iPromo >= 0 && iClient > iPromo && iClick > iClient,
  `promo=${iPromo} client=${iClient} click=${iClick}`);

// Lookup kodu v referral_codes musi byt JEDEN pro vsechny zdroje, jinak by se
// „co je platny kod" mohlo mezi zdroji rozejit.
check('A3 kod se hleda v referral_codes jen na JEDNOM miste',
  (blokRef.match(/from\("referral_codes"\)/g) ?? []).length === 1,
  JSON.stringify((blokRef.match(/from\("referral_codes"\)/g) ?? []).length));

check('A4 lookup kodu NENI podmineny produktem',
  !/if\s*\([^)]*produkt[^)]*\)[^;]*from\("referral_codes"\)/.test(blokRef), '');

check('A5 castka jde z amount_total session, ne z ceniku',
  /session\.amount_total/.test(blokRef) && /\/\s*100/.test(blokRef), '');

check('A6 affiliate dostava reward_type "cash", member "credit"',
  /partnerType === "affiliate" \? "cash" : "credit"/.test(blokRef), '');

check('A7 do referrals se zapisuje amount_czk i partner_type',
  /amount_czk:/.test(blokRef) && /partner_type:/.test(blokRef), '');

// Kdyz sazba chybi, partner NESMI dostat nulu (tise by prodal zadarmo).
check('A8 chybejici sazba spadne na ODMENU, ne na nulu',
  /sazbaJednoraz > 0/.test(blokRef) && /ODMENA\[produkt\]/.test(blokRef), '');

// Restricted klic na predplatna NESMI byt pouzity na promo kody (nema prava).
check('A9 promo lookup nepouziva klic urceny na predplatna',
  !/STRIPE_SUBS_KEY/.test(blokRef), '');

check('A10 nerozpoznana sleva se loguje, at se tvar zjisti z prvniho realneho pripadu',
  /referral_webhook_log/.test(blokRef), '');

// --- 8) MIGRACE MUSI SEDET NA TO, CO KOD ZAPISUJE ---
const MIGRACE = KOREN + 'akademie/_supabase/referral-affiliate-partner-type.sql';
let sqlMigrace = '';
try { sqlMigrace = await Deno.readTextFile(MIGRACE); } catch { /* soubor chybi */ }
check('M1 migracni soubor existuje', sqlMigrace.length > 0, MIGRACE);
for (const sloupec of ['partner_type', 'rate_monthly', 'rate_oneoff', 'amount_czk']) {
  check(`M2 migrace pridava ${sloupec}`, new RegExp(`add column if not exists ${sloupec}`).test(sqlMigrace), '');
}
// Bez rozsireni CHECKu by atribuce u balicku a konzultace spadla.
check('M3 migrace rozsiruje CHECK na product o balicek a konzultace',
  /check \(product in \([^)]*'balicek'[^)]*'konzultace'[^)]*\)\)/.test(sqlMigrace), '');

const failures = cases.filter((c) => !c.pass).length;
for (const c of cases) console.log(`${c.pass ? '  ok' : 'FAIL'}  ${c.name}${c.pass ? '' : '  -> ' + c.detail}`);
console.log(`\n${cases.length - failures}/${cases.length} proslo`);
if (failures > 0) Deno.exit(1);
