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
// Uvnitr JEDNORAZOVE atribuce smi byt lookup jen jednou, at se tri zdroje kodu
// nerozejdou v tom, co je platny kod. (Recurring vetev ma vlastni, to je v poradku.)
const blokJednoraz = zdrojWebhook.slice(
  zdrojWebhook.indexOf('async function atribuujReferral'),
  zdrojWebhook.indexOf('async function posliUvitani'),
);
check('A3 v jednorazove atribuci se kod hleda jen na JEDNOM miste',
  (blokJednoraz.match(/from\("referral_codes"\)/g) ?? []).length === 1,
  JSON.stringify((blokJednoraz.match(/from\("referral_codes"\)/g) ?? []).length));

check('A4 lookup kodu NENI podmineny produktem',
  !/if\s*\([^)]*produkt[^)]*\)[^;]*from\("referral_codes"\)/.test(blokRef), '');

check('A5 castka jde z amount_total session, ne z ceniku',
  /session\.amount_total/.test(blokRef) && /\/\s*100/.test(blokRef), '');

check('A6 affiliate dostava reward_type "cash", member "credit"',
  /partnerType === "affiliate" \? "cash" : "credit"/.test(blokRef), '');

check('A7 do referrals se zapisuje amount (STAVAJICI sloupec) i partner_type',
  /amount: castkaKc/.test(blokRef) && /partner_type:/.test(blokRef), '');
// Dva sloupce na totez je budouci past: `amount` uz existuje a admin-api ho cte.
check('A7b nezavadi se novy sloupec amount_czk',
  !/amount_czks*:/.test(zdrojWebhook), '');

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
for (const sloupec of ['partner_type', 'rate_monthly', 'rate_oneoff']) {
  check(`M2 migrace pridava ${sloupec}`, new RegExp(`add column if not exists ${sloupec}`).test(sqlMigrace), '');
}
// Bez rozsireni CHECKu by atribuce u balicku a konzultace spadla.
check('M3 migrace rozsiruje CHECK na product o balicek a konzultace',
  /check \(product in \([^)]*'balicek'[^)]*'konzultace'[^)]*\)\)/.test(sqlMigrace), '');
// Bez zahozeni tohohle unique indexu by druha mesicni provize spadla.
check('M4 migrace zahazuje unique index (buyer_email, product), ktery blokuje recurring',
  /drop index if exists public\.referrals_buyer_product_uidx/.test(sqlMigrace), '');
check('M5 migrace NEPRIDAVA sloupec amount_czk',
  !/add column[^;]*amount_czk/.test(sqlMigrace), '');

// --- 9) RECURRING PROVIZE Z FAKTUR ---
const blokRec = zdrojWebhook.slice(
  zdrojWebhook.indexOf('async function zapisRecurringProvizi'),
  zdrojWebhook.indexOf('async function atribuujReferral'),
);
check('R1 funkce pro recurring provizi existuje', blokRec.length > 0, '');
// Nejdulezitejsi pravidlo cele vetve: kredit clena se za obnovy NEDAVA.
check('R2 recurring je JEN pro affiliate, member kredit se neopakuje',
  /partner_type !== "affiliate"/.test(blokRec) && /member-bez-recurring/.test(blokRec), '');
check('R3 idempotence stoji na ID faktury (order_id)',
  /eq\("order_id", fakturaId\)/.test(blokRec) && /duplicita-faktura/.test(blokRec), '');
check('R4 castka jde z amount_paid faktury, ne z total',
  /amount_paid/.test(blokRec), '');
check('R5 sazba se cte ZIVE z referral_codes (rate_monthly), ne z puvodniho radku',
  /rate_monthly/.test(blokRec) && /from\("referral_codes"\)/.test(blokRec), '');
check('R6 chybejici sazba provizi NEZAPISE (nula by byla horsi nez nic)',
  /bez-sazby/.test(blokRec), '');
check('R7 recurring zapisuje reward_type cash a partner_type affiliate',
  /reward_type: "cash"/.test(blokRec) && /partner_type: "affiliate"/.test(blokRec), '');
check('R8 self-referral se u obnov taky odchyti',
  /self-referral/.test(blokRec), '');
check('R9 recurring je zavolany z vetve invoice.paid',
  /zapisRecurringProvizi\(email, obj\)/.test(zdrojWebhook), '');
// Zapis provize nesmi shodit obnovu predplatneho.
check('R10 selhani zapisu provize je best-effort (alert, ne 500)',
  /catch \(e\)/.test(blokRec) && /alertAdmin\("Stripe: recurring provize/.test(blokRec), '');

// --- 10) ADMIN VIDI, CO SE ZAPSALO ---
const ADMIN = KOREN + 'akademie/_supabase/functions/admin-api/index.ts';
let zdrojAdmin = '';
try { zdrojAdmin = await Deno.readTextFile(ADMIN); } catch { /* nevadi */ }
const vycetAdmin = (zdrojAdmin.match(/from\("referrals"\)\.select\("([^"]+)"\)/) ?? ['', ''])[1];
check('AD1 admin-api vybira partner_type (jinak Martin neodlisi kredit od provize)',
  vycetAdmin.includes('partner_type'), vycetAdmin);
check('AD2 admin-api vybira amount (zaklad provize)',
  vycetAdmin.includes('amount'), vycetAdmin);

// --- 11) PREHLED PRO VYPLATY PARTNEREK ---
check('V1 migrace vytvari view affiliate_prehled',
  /create or replace view public\.affiliate_prehled/.test(sqlMigrace), '');

// JADRO CELE VECI: provize se SCITA z ulozeneho reward_amount, NEPOCITA se
// z amount * dnesni sazba. Jinak by zmena sazby prepsala historii vyplat.
const blokView = sqlMigrace.slice(
  sqlMigrace.indexOf('create or replace view public.affiliate_prehled'),
  sqlMigrace.indexOf('comment on view public.affiliate_prehled'),
);
check('V2 provize se scita z reward_amount (zmrazena v case zapisu)',
  /sum\(r\.reward_amount\)/.test(blokView), '');
check('V3 view NEPOCITA provizi z amount * sazba',
  !/amount\s*\*\s*(rate|r\.rate|rc\.rate)/.test(blokView), '');

// Zadny novy sloupec `commission`: reward_amount uz presne tohle je.
check('V4 nezavadi se sloupec commission (reward_amount uz existuje)',
  !/add column[^;]*commission/.test(sqlMigrace) && !/commission:/.test(zdrojWebhook), '');

// Kdyby kod byl driv member a prepnul se na affiliate, stare kreditni radky
// se do vyplat pocitat NESMI.
check('V5 view bere jen reward_type cash, ne clenske kredity',
  /r\.reward_type = 'cash'/.test(blokView), '');

// Pending je 14denni lhuta na odstoupeni, penize jeste nejsou jiste.
// Vyraz pro k_vyplate: od posledni carky pred nim az po jeho nazev.
const iKV = blokView.indexOf('as k_vyplate');
const vyrazKV = iKV > 0 ? blokView.slice(Math.max(0, iKV - 220), iKV) : '';
check('V6 k_vyplate = CONFIRMED provize minus vyplacene, pending se nepocita',
  vyrazKV.includes("'confirmed'") && vyrazKV.includes('- coalesce(v.vyplaceno') && !vyrazKV.includes("'pending'"),
  vyrazKV.replace(/\s+/g, ' ').slice(0, 160));

// referral_payouts je vedena podle owner_email, ne podle kodu.
check('V7 vyplacene se paruje pres owner_email',
  /referral_payouts/.test(blokView) && /lower\(rc\.owner_email\)/.test(blokView), '');

check('V8 view bere jen affiliate kody',
  /where rc\.partner_type = 'affiliate'/.test(blokView), '');

// --- 12) ADMIN AKCE PRO PREHLED ---
const iGate = zdrojAdmin.indexOf('"forbidden"');
const iAkce = zdrojAdmin.indexOf('action === "affiliate_prehled"');
check('AD3 admin-api ma akci affiliate_prehled', iAkce > 0, '');
// Autorizace je jedna globalni brana; akce za ni je admin-only.
check('AD4 akce je AZ ZA admin branou (403 forbidden)',
  iGate > 0 && iAkce > iGate, `gate=${iGate} akce=${iAkce}`);
check('AD5 akce cte view, ne tabulku referrals naprimo',
  /from\("affiliate_prehled"\)/.test(zdrojAdmin), '');

// --- 13) PROVIZE U OPAKOVANEHO NAKUPU (nalez z testu penezi 11. 8. 2026) ---
// Duplicitni kontrola buyer+product smi blokovat jen MEMBER kredit; affiliate bere
// provizi z kazde platby a idempotenci mu drzi order_id (payment_intent).
const iDupOrder = zdrojWebhook.indexOf('return "duplicita-order"');
const iDupProd = zdrojWebhook.indexOf('return "duplicita-produkt"');
const blokDup = iDupProd > 0 ? zdrojWebhook.slice(Math.max(0, iDupProd - 400), iDupProd) : '';
check('R1 dup-product check je podmineny (member, nebo affiliate bez orderId)',
  /if \(partnerType !== "affiliate" \|\| !orderId\) \{/.test(blokDup),
  blokDup.replace(/\s+/g, ' ').slice(-160));
check('R2 duplicita-order zustava PRED dup-product (idempotence prehrani plati vzdy)',
  iDupOrder > 0 && iDupProd > 0 && iDupOrder < iDupProd, `order=${iDupOrder} produkt=${iDupProd}`);

// Opakovana vetev balicku musi atribuci VOLAT (druha platba = druha provize)...
const iZnovu = zdrojWebhook.indexOf('BALÍČEK koupen PODRUHÉ, odkazy odeslány znovu');
const blokZnovu = iZnovu > 0
  ? zdrojWebhook.slice(iZnovu, zdrojWebhook.indexOf('return json({', iZnovu))
  : '';
check('R3 opakovany nakup balicku vola atribuujReferral', /await atribuujReferral\(/.test(blokZnovu),
  'vetev nalezena=' + String(iZnovu > 0));
// ...a az ZA dokladem, mimo try s odkazy (penize prisly i pri selhani odkazu).
check('R4 atribuce v opakovane vetvi je za posliDoklad (mimo try s odkazy)',
  blokZnovu.indexOf('posliDoklad') > 0
    && blokZnovu.indexOf('await atribuujReferral(') > blokZnovu.indexOf('posliDoklad'),
  '');
// Aspon dve volani atribuce (novy nakup + opakovany balicek). Presny pocet schvalne
// nehlidat: legitimni treti volaci misto by z toho udelalo trvaly falesny poplach
// (nalez revize P28 11. 8. 2026).
const volaniAtribuce = (zdrojWebhook.match(/await atribuujReferral\(/g) ?? []).length;
check('R5 atribuujReferral se vola aspon 2x', volaniAtribuce >= 2, `volani=${volaniAtribuce}`);

// --- 14) INSERT PROVIZE CTE `error` (supabase-js vyjimku nevyhazuje) ---
// Bez kontroly by selhany zapis (soubeh na referrals_order_uidx) vratil "zapsano".
const insertyProvizi = [...zdrojWebhook.matchAll(/const ins\w* = await admin\.from\("referrals"\)\.insert\(/g)].length;
check('R6 oba inserty provize ukladaji vysledek do promenne', insertyProvizi === 2, `nalezeno=${insertyProvizi}`);
const kontrolyChyby = [...zdrojWebhook.matchAll(/if \(ins\w*\.error\)/g)].length;
check('R7 oba inserty kontroluji error a 23505 prevadi na duplicitni navrat', kontrolyChyby === 2
  && zdrojWebhook.includes('"23505"'), `kontrol=${kontrolyChyby}`);

// --- 15) KOUČINK PŘES STRIPE (2. 9. 2026) ---
// Šest klíčů (Gold i Diamond × 1/3/6 měsíců). Chyba v kterémkoli z nich znamená,
// že člověk zaplatí až 59 500 Kč a nedostane přístup, nebo dostane špatně dlouhý.
const koucKlice = klice.filter((k) => k.startsWith('coaching-'));
check('KO1 katalog zna vsech sest koucinkovych klicu', koucKlice.length === 6, JSON.stringify(koucKlice));
for (const k of ['coaching-gold-1', 'coaching-gold-3', 'coaching-gold-6',
                 'coaching-diamond-1', 'coaching-diamond-3', 'coaching-diamond-6']) {
  check(`KO2 klic ${k} je v katalogu`, klice.includes(k), JSON.stringify(klice));
}
// ⛔ `product='coaching'` je pristupovy klic klientske sekce, AI Martina, adminu
// a offboardnich pojistek. Vlastni hodnota by klienta odriznula, aniz by co spadlo.
const koucBloky = koucKlice.map((k) => {
  const i = blokKatalog.indexOf('"' + k + '"');
  return blokKatalog.slice(i, blokKatalog.indexOf('},', i) + 1);
});
check('KO3 vsechny koucinkove klice davaji produkt "coaching"',
  koucBloky.every((t) => /produkt:\s*"coaching"/.test(t)), '');
// Appku i uvitaci mail dodava `onboardKoucink`, ne obecna vetev. Kdyby tu byl
// `tcGrant: true` nebo neprazdna trat, klient by dostal grant nebo mail dvakrat.
check('KO4 koucink nedava appku obecnou vetvi (tcGrant false)',
  koucBloky.every((t) => /tcGrant:\s*false/.test(t)), '');
check('KO5 koucink nema obecnou uvitaci trat (welcome je prazdny)',
  koucBloky.every((t) => /welcome:\s*""/.test(t)), '');
check('KO6 kazdy koucinkovy klic ma namapovany odkaz',
  koucKlice.every((k) => mapovani.some((m) => m.klic === k)),
  JSON.stringify(mapovani.filter((m) => m.klic.startsWith('coaching-'))));
// Vetev se musi volat DRIV nez `udelDozivotni`, jinak by koucink dostal expiraci null
// (tedy koucink navzdy) a nikde by to nekriklo.
const iKouc = zdrojWebhook.indexOf('if (def.koucink) return await zpracujKoucink');
const iDoz = zdrojWebhook.indexOf('const { novyDozivotni, zruseneMesicni, predchoziPi } = await udelDozivotni');
check('KO7 koucinkova vetev je pred udelDozivotni', iKouc > 0 && iDoz > iKouc, `kouc=${iKouc} doz=${iDoz}`);
// Idempotence stoji na payment_intent PRECTENEM PRED zapisem (past ze 7. 8. 2026).
const blokKouc = zdrojWebhook.slice(
  zdrojWebhook.indexOf('async function zpracujKoucink'),
  zdrojWebhook.indexOf('Deno.serve('),
);
check('KO8 idempotence koucinku stoji na payment_intent',
  /stavajici\?\.stripe_payment_intent === pi/.test(blokKouc), '');
check('KO9 prodlouzeni se pocita od konce stavajiciho obdobi, ne ode dneska',
  /stareDo\.getTime\(\) > Date\.now\(\)/.test(blokKouc), '');
check('KO10 koucink zapisuje expiraci (jinak by platil navzdy)',
  /expiresAt/.test(blokKouc) && /koucinkExpirace\(/.test(blokKouc), '');
// Bez teto polozky by clen doporucil klienta za desetitisice a dostal tise nulu.
check('KO11 ODMENA zna produkt coaching', /coaching:\s*\d+/.test(zdrojWebhook), '');
// Placeholdery odkazu musi jit najit, dokud je nekdo nenahradi ID ze Stripu.
const koucPlaceholdery = (zdrojWebhook.match(/plink_DOPLNIT_KOUCINK_[A-Z0-9_]+/g) ?? []);
if (koucPlaceholdery.length) {
  console.warn('\n⚠️  UPOZORNENI: koucinkove odkazy jsou porad PLACEHOLDERY: '
    + koucPlaceholdery.join(', '));
  console.warn('   Dokud tam nebudou skutecna ID ze Stripu, zaplaceny koucink NEDODA pristup.\n');
}
check('KO12 koucinkove odkazy jsou bud skutecne, nebo viditelne oznacene DOPLNIT',
  koucPlaceholdery.length === 0 || koucPlaceholdery.length === 6,
  JSON.stringify(koucPlaceholdery));

// --- 16) MIGRACE KOUCINKU ---
const MIG_KOUC = KOREN + 'akademie/_supabase/koucink-stripe.sql';
let sqlKouc = '';
try { sqlKouc = await Deno.readTextFile(MIG_KOUC); } catch { /* chybi */ }
check('KM1 migrace koucink-stripe.sql existuje', sqlKouc.length > 0, MIG_KOUC);
for (const sloupec of ['plan', 'months', 'academy_po_3m']) {
  check(`KM2 migrace pridava ${sloupec}`,
    new RegExp(`add column if not exists ${sloupec}`).test(sqlKouc), '');
}
check('KM3 migrace zaklada RPC kapacity a pousti ji anonymne',
  /create or replace function public\.koucink_kapacita/.test(sqlKouc)
  && /grant execute on function public\.koucink_kapacita\(\) to anon/.test(sqlKouc), '');
// RPC se cte z verejne stranky, takze nesmi vracet nic osobniho.
check('KM4 RPC kapacity nevraci e-maily', !/select\s+email/i.test(sqlKouc), '');

// --- 17) ONBOARDING JE JEN NA JEDNOM MISTE ---
// Uvitaci mail koucinku zil do 2. 9. 2026 v admin-api. Kdyby si ho webhook zkopiroval,
// obe verze by se rozesly a rucne pozvany klient by dostal jiny mail nez ten placeny.
const SHARED = KOREN + 'akademie/_supabase/functions/_shared/koucink-onboarding.ts';
let zdrojShared = '';
try { zdrojShared = await Deno.readTextFile(SHARED); } catch { /* chybi */ }
check('KS1 sdileny modul onboardingu existuje', zdrojShared.length > 0, SHARED);
check('KS2 admin-api onboarding importuje, nema vlastni kopii',
  /from "\.\.\/_shared\/koucink-onboarding\.ts"/.test(zdrojAdmin)
  && !zdrojAdmin.includes('Vítej v týmu'), '');
check('KS3 webhook onboarding importuje, nema vlastni kopii',
  /from "\.\.\/_shared\/koucink-onboarding\.ts"/.test(zdrojWebhook)
  && !zdrojWebhook.includes('Vítej v týmu'), '');
check('KS4 uvitaci mail koucinku je jen ve sdilenem modulu',
  zdrojShared.includes('Vítej v týmu'), '');

const failures = cases.filter((c) => !c.pass).length;
for (const c of cases) console.log(`${c.pass ? '  ok' : 'FAIL'}  ${c.name}${c.pass ? '' : '  -> ' + c.detail}`);
console.log(`\n${cases.length - failures}/${cases.length} proslo`);
if (failures > 0) Deno.exit(1);
