// Testy rozhodovacich pravidel drip-send (8. 8. 2026).
// Spusteni: npx --yes deno@2 run akademie/_supabase/functions/drip-send/pravidla.test.ts
// (bez jakychkoli --allow-*: test necte sit, disk ani promenne prostredi)
import {
  KROK_PRO_MOST,
  mostBlokujeVlastnictvi,
  odstupDnu,
  shouldStop,
  vlastniCokoli,
  vyberMost,
} from './pravidla.ts';

const s = (...emaily: string[]) => new Set(emaily);
const JA = 'klient@example.com';
const NIKDO = 'cizi@example.com';

const NIC = { videokurz: s(), academy: s(), coaching: s(), balicek: s() };
const MA_VK = { videokurz: s(JA), academy: s(), coaching: s(), balicek: s() };
const MA_ACADEMY = { videokurz: s(), academy: s(JA), coaching: s(), balicek: s() };
const MA_COACHING = { videokurz: s(), academy: s(), coaching: s(JA), balicek: s() };
const MA_JEN_BALICEK = { videokurz: s(), academy: s(), coaching: s(), balicek: s(JA) };
const BEZ_EX = s();
const JE_EX = s(JA);

let selhalo = 0;
let kontrol = 0;
function zkontroluj(popis: string, dostal: unknown, cekal: unknown) {
  kontrol++;
  if (dostal === cekal) {
    console.log(`✓ ${popis}`);
  } else {
    selhalo++;
    console.error(`✗ ${popis}: cekal ${cekal}, dostal ${dostal}`);
  }
}

// ---------- AKVIZICNI TRATE: krok 0 je slibeny freebie, stopuje se az od kroku 1 ----------
zkontroluj('lead-magnet krok 0 se posle i kupci (je to slibene PDF)', shouldStop('lead-magnet', 0, JA, MA_VK, BEZ_EX), false);
zkontroluj('lead-magnet krok 1 se kupci uz nepusti', shouldStop('lead-magnet', 1, JA, MA_VK, BEZ_EX), true);
zkontroluj('existing-leadmagnet krok 1 stopne majitele Academy', shouldStop('existing-leadmagnet', 1, JA, MA_ACADEMY, BEZ_EX), true);
zkontroluj('nurture-videokurz krok 1 stopne klienta koucinku', shouldStop('nurture-videokurz', 1, JA, MA_COACHING, BEZ_EX), true);
zkontroluj('nurture-videokurz krok 0 projde i klientovi koucinku', shouldStop('nurture-videokurz', 0, JA, MA_COACHING, BEZ_EX), false);
zkontroluj('lead-magnet krok 1 nekupci projde', shouldStop('lead-magnet', 1, NIKDO, MA_VK, BEZ_EX), false);

// ---------- LONGTAIL A UPSELL ----------
zkontroluj('longtail-consumer stopne kupce uz na kroku 0 (freebie tam neni)', shouldStop('longtail-consumer', 0, JA, MA_VK, BEZ_EX), true);
zkontroluj('longtail-consumer nekupci projde', shouldStop('longtail-consumer', 0, NIKDO, MA_VK, BEZ_EX), false);
zkontroluj('longtail-trener stopne jen na Academy', shouldStop('longtail-trener', 3, JA, MA_ACADEMY, BEZ_EX), true);
zkontroluj('longtail-trener majitele videokurzu NEstopne', shouldStop('longtail-trener', 3, JA, MA_VK, BEZ_EX), false);
zkontroluj('upsell-academy stopne na Academy', shouldStop('upsell-academy', 1, JA, MA_ACADEMY, BEZ_EX), true);
zkontroluj('longtail-kupci stopne na Academy', shouldStop('longtail-kupci', 2, JA, MA_ACADEMY, BEZ_EX), true);
zkontroluj('longtail-kupci majitele videokurzu NEstopne (to je jeho publikum)', shouldStop('longtail-kupci', 2, JA, MA_VK, BEZ_EX), false);
zkontroluj('trener-kit krok 0 je slibeny kit, projde i clenovi Academy', shouldStop('trener-kit', 0, JA, MA_ACADEMY, BEZ_EX), false);
zkontroluj('trener-kit krok 1 clena Academy stopne', shouldStop('trener-kit', 1, JA, MA_ACADEMY, BEZ_EX), true);

// ---------- UPSELL-COACHING VCETNE EX-KLIENTU (oprava 8. 8. 2026) ----------
zkontroluj('upsell-coaching stopne aktivniho klienta koucinku', shouldStop('upsell-coaching', 0, JA, MA_COACHING, BEZ_EX), true);
zkontroluj('upsell-coaching stopne EX-klienta, i kdyz uz entitlement neni aktivni', shouldStop('upsell-coaching', 0, JA, NIC, JE_EX), true);
zkontroluj('upsell-coaching stopne i kdyz plati obe cesty najednou', shouldStop('upsell-coaching', 1, JA, MA_COACHING, JE_EX), true);
zkontroluj('upsell-coaching cloveka bez koucinku pusti (to je smysl te trate)', shouldStop('upsell-coaching', 0, JA, MA_VK, BEZ_EX), false);
zkontroluj('ex-klient NENI stopnuty na akvizicni trati (legitimni cil)', shouldStop('lead-magnet', 1, JA, NIC, JE_EX), false);
zkontroluj('ex-klient NENI stopnuty na longtail-consumer', shouldStop('longtail-consumer', 3, JA, NIC, JE_EX), false);
zkontroluj('ex-klient NENI stopnuty na tc-free', shouldStop('tc-free', 7, JA, NIC, JE_EX), false);

// ---------- TRATE APPKY: kroky 0 az 4 jsou obsahove ----------
zkontroluj('tc-free krok 4 projde i clenovi Academy (obsahovy mail)', shouldStop('tc-free', 4, JA, MA_ACADEMY, BEZ_EX), false);
zkontroluj('tc-free krok 5 clena Academy stopne (appku ma v cene)', shouldStop('tc-free', 5, JA, MA_ACADEMY, BEZ_EX), true);
zkontroluj('tc-free krok 5 klienta koucinku stopne', shouldStop('tc-free', 5, JA, MA_COACHING, BEZ_EX), true);
zkontroluj('tc-free krok 5 majitele videokurzu NEstopne', shouldStop('tc-free', 5, JA, MA_VK, BEZ_EX), false);
zkontroluj('tc-magnet krok 5 clena Academy stopne', shouldStop('tc-magnet', 5, JA, MA_ACADEMY, BEZ_EX), true);

// ---------- tc-zkusebka (20. 8. 2026): 4 maily, kroky 0 az 3, most na longtail ----------
// Bod 2: dve serie naraz se tady neresi. `leads.track` je JEDEN sloupec, hook drzi
// "jeden clovek = jeden beh". shouldStop na jedne trati tu druhou nespousti.
// Most tc-zkusebka -> longtail-consumer je SEKVENCE, ne soubeh; kupci se most zablokuje.
zkontroluj('most z tc-zkusebka do longtail-consumer je definovatelny', vyberMost({ 'tc-zkusebka': { track: 'longtail-consumer', po_dnech: 21 } }, 'tc-zkusebka')?.track, 'longtail-consumer');
zkontroluj('most z tc-zkusebka do longtail-consumer se kupci ZABLOKUJE (ne druha serie)', mostBlokujeVlastnictvi('longtail-consumer', JA, MA_VK, BEZ_EX), true);
zkontroluj('most z tc-zkusebka do longtail-consumer nekupci projde', mostBlokujeVlastnictvi('longtail-consumer', NIKDO, MA_VK, BEZ_EX), false);
// Bod 3: nakup APPKY shouldStop nevidi (Academy entitlements appku nezna).
// Zastaveni dela hook product=tvujcoach -> onboarding-nakup-tvujcoach, ne tahle funkce.
// Ziva serie ma kroky 0-3, stop od 5 na ni nesehne i u clena Academy.
zkontroluj('tc-zkusebka krok 0 bez entitlements se NEstopne (nakup appky tady neni)', shouldStop('tc-zkusebka', 0, JA, NIC, BEZ_EX), false);
zkontroluj('tc-zkusebka krok 3 (posledni zivy mail) se NEstopne ani clenovi Academy', shouldStop('tc-zkusebka', 3, JA, MA_ACADEMY, BEZ_EX), false);
zkontroluj('tc-zkusebka krok 3 klienta koucinku NEstopne', shouldStop('tc-zkusebka', 3, JA, MA_COACHING, BEZ_EX), false);
zkontroluj('tc-zkusebka krok 5 clena Academy stopne (pojistka kdyby pribyly maily)', shouldStop('tc-zkusebka', 5, JA, MA_ACADEMY, BEZ_EX), true);
zkontroluj('tc-zkusebka krok 5 klienta koucinku stopne', shouldStop('tc-zkusebka', 5, JA, MA_COACHING, BEZ_EX), true);
zkontroluj('tc-zkusebka krok 5 majitele videokurzu NEstopne', shouldStop('tc-zkusebka', 5, JA, MA_VK, BEZ_EX), false);
// Bod 4: smazani uctu shouldStop taky nevidi. Bez entitlements trat bezi dal.
zkontroluj('tc-zkusebka po smazani uctu (zadny entitlement) se NEstopne', shouldStop('tc-zkusebka', 1, JA, NIC, BEZ_EX), false);
zkontroluj('ex-klient NENI stopnuty na tc-zkusebka', shouldStop('tc-zkusebka', 5, JA, NIC, JE_EX), false);

// ---------- BALICEK NESMI NIKOHO UMLCET (pojistka k `vlastniCokoli`) ----------
zkontroluj('kdo ma JEN balicek, neni pro `vlastniCokoli` zakaznik', vlastniCokoli(MA_JEN_BALICEK, JA), false);
zkontroluj('kdo ma JEN balicek, NENI stopnuty na lead-magnetu', shouldStop('lead-magnet', 1, JA, MA_JEN_BALICEK, BEZ_EX), false);
zkontroluj('kdo ma JEN balicek, NENI stopnuty na longtail-consumer', shouldStop('longtail-consumer', 0, JA, MA_JEN_BALICEK, BEZ_EX), false);
zkontroluj('videokurz uz zakaznika dela', vlastniCokoli(MA_VK, JA), true);
zkontroluj('Academy uz zakaznika dela', vlastniCokoli(MA_ACADEMY, JA), true);
zkontroluj('koucink uz zakaznika dela', vlastniCokoli(MA_COACHING, JA), true);

// ---------- CLENSKE A NEZNAME TRATE SE NESTOPUJI NIKDY ----------
zkontroluj('onboarding-nakup-videokurz se nestopuje', shouldStop('onboarding-nakup-videokurz', 2, JA, MA_ACADEMY, JE_EX), false);
zkontroluj('milestone-videokurz se nestopuje', shouldStop('milestone-videokurz', 50, JA, MA_ACADEMY, JE_EX), false);
zkontroluj('tydenik se nestopuje nikdy (obsah pro vsechny vcetne kupcu)', shouldStop('tydenik', 3, JA, MA_ACADEMY, JE_EX), false);
zkontroluj('prazdny track nespadne a nestopne', shouldStop('', 1, JA, MA_ACADEMY, JE_EX), false);

// ---------- POJISTKA 2 MOSTU: MUSI SE PTAT NA KROK 1, NE 0 ----------
// Kdyby se ptala na krok 0, u akvizicnich trati by NIKDY nesepnula (mrtva paka)
// a most by platiciho zakaznika prehodil do trate s nabidkou na to, co uz ma.
zkontroluj('KROK_PRO_MOST je 1', KROK_PRO_MOST, 1);
zkontroluj('most do lead-magnetu se kupci ZABLOKUJE', mostBlokujeVlastnictvi('lead-magnet', JA, MA_VK, BEZ_EX), true);
zkontroluj('most do lead-magnetu nekupci projde', mostBlokujeVlastnictvi('lead-magnet', NIKDO, MA_VK, BEZ_EX), false);
zkontroluj('most do longtail-consumer se kupci zablokuje', mostBlokujeVlastnictvi('longtail-consumer', JA, MA_VK, BEZ_EX), true);
zkontroluj('most do tydeniku projde i kupci (tydenik nikoho nestopuje)', mostBlokujeVlastnictvi('tydenik', JA, MA_ACADEMY, JE_EX), false);
zkontroluj('most do upsell-coaching se ex-klientovi zablokuje', mostBlokujeVlastnictvi('upsell-coaching', JA, NIC, JE_EX), true);
// Kontrola te „mrtve paky" primo: se krokem 0 by tataz situace NEsepnula.
zkontroluj('dukaz, ze na kroku 0 by ochrana nesepnula', shouldStop('lead-magnet', 0, JA, MA_VK, BEZ_EX), false);

// ---------- POJISTKA 1 MOSTU: vyber cile ----------
const MOSTY = {
  'lead-magnet': { track: 'longtail-consumer', po_dnech: 7 },
  'sam-na-sebe': { track: 'sam-na-sebe', po_dnech: 3 },
  'prazdny-cil': { track: '', po_dnech: 3 },
  'necislo': { track: 'tydenik', po_dnech: 'sedm' },
};
zkontroluj('definovany most vrati cilovou trat', vyberMost(MOSTY, 'lead-magnet')?.track, 'longtail-consumer');
zkontroluj('nedefinovany most vrati null', vyberMost(MOSTY, 'tc-free'), null);
zkontroluj('most sam na sebe se zahodi', vyberMost(MOSTY, 'sam-na-sebe'), null);
zkontroluj('most s prazdnym cilem se zahodi', vyberMost(MOSTY, 'prazdny-cil'), null);
zkontroluj('prazdny nazev trate nespadne', vyberMost(MOSTY, ''), null);

// ---------- ODSTUP: fail-safe smerem k CEKANI ----------
zkontroluj('platna hodnota projde', odstupDnu(10), 10);
zkontroluj('nula je platna (most hned druhy den)', odstupDnu(0), 0);
zkontroluj('chybejici hodnota da vychozich 7', odstupDnu(undefined), 7);
zkontroluj('null da vychozich 7', odstupDnu(null), 7);
zkontroluj('preklep "sedm" da 7, NE nulu (to byla ta vada)', odstupDnu('sedm'), 7);
zkontroluj('zaporne cislo da 7', odstupDnu(-3), 7);
zkontroluj('cislo v retezci se prevede', odstupDnu('14'), 14);
zkontroluj('odstup z mostu s preklepem da 7', odstupDnu(vyberMost(MOSTY, 'necislo')?.po_dnech), 7);

console.log(selhalo === 0 ? `\nHOTOVO: ${kontrol} kontrol, vse proslo.` : `\nSELHALO: ${selhalo} z ${kontrol}`);
if (selhalo > 0) Deno.exit(1);
