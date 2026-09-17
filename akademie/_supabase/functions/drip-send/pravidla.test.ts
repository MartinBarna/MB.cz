// Testy rozhodovacich pravidel drip-send (8. 8. 2026).
// Spusteni: npx --yes deno@2 run akademie/_supabase/functions/drip-send/pravidla.test.ts
// (bez jakychkoli --allow-*: test necte sit, disk ani promenne prostredi)
import {
  konzultaceVBehu,
  KROK_PRO_MOST,
  maZnackuKonzultace,
  mostBlokujeVlastnictvi,
  odstupDnu,
  shouldStop,
  smiSeOdznackovat,
  TRATE_PAUZA_KONZULTACE,
  varsBezZnackyKonzultace,
  varsSeZnackouKonzultace,
  VARS_KLIC_KONZULTACE,
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

// ---------- ACADEMY-VK-SERIE: docasna serie pro majitele videokurzu bez Academy (C1, 1. 9. 2026) ----------
// Trat prodava Academy, takze se stopuje na Academy a NE na videokurzu: videokurz ma
// z definice kazdy, komu tahle serie chodi (je to duvod, proc ma cenu 7 410 misto 8 900).
zkontroluj('academy-vk-serie stopne clena Academy uz na kroku 0 (zadny freebie tam neni)', shouldStop('academy-vk-serie', 0, JA, MA_ACADEMY, BEZ_EX), true);
zkontroluj('academy-vk-serie stopne clena Academy i na poslednim kroku', shouldStop('academy-vk-serie', 2, JA, MA_ACADEMY, BEZ_EX), true);
zkontroluj('academy-vk-serie majitele videokurzu NEstopne (to je cele jeji publikum)', shouldStop('academy-vk-serie', 1, JA, MA_VK, BEZ_EX), false);
zkontroluj('academy-vk-serie cizi adresu neresi', shouldStop('academy-vk-serie', 1, NIKDO, MA_ACADEMY, BEZ_EX), false);
zkontroluj('academy-vk-serie ex-klienta koucinku pusti (Academy je pro nej legitimni nabidka)', shouldStop('academy-vk-serie', 1, JA, MA_VK, JE_EX), false);
zkontroluj('most do academy-vk-serie se clenu Academy zablokuje', mostBlokujeVlastnictvi('academy-vk-serie', JA, MA_ACADEMY, BEZ_EX), true);
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

// ---------- EVERGREEN-KUPCI (6. 9. 2026): koncova pece o majitele videokurzu ----------
zkontroluj('evergreen-kupci: majitel videokurzu projde', shouldStop('evergreen-kupci', 0, JA, MA_VK, BEZ_EX), false);
zkontroluj('evergreen-kupci: clen Academy se stopne', shouldStop('evergreen-kupci', 0, JA, MA_ACADEMY, BEZ_EX), true);
zkontroluj('evergreen-kupci: aktivni klient koucinku se stopne', shouldStop('evergreen-kupci', 0, JA, MA_COACHING, BEZ_EX), true);
zkontroluj('evergreen-kupci: EX-klient koucinku projde (trat koucink neprodava)', shouldStop('evergreen-kupci', 2, JA, MA_VK, JE_EX), false);
zkontroluj('most do evergreen-kupci se clenovi Academy zablokuje', mostBlokujeVlastnictvi('evergreen-kupci', JA, MA_ACADEMY, BEZ_EX), true);
zkontroluj('most do evergreen-kupci majitele videokurzu pusti', mostBlokujeVlastnictvi('evergreen-kupci', JA, MA_VK, BEZ_EX), false);
zkontroluj('evergreen-consumer se nestopuje nikdy (obsah pro vsechny, kroky resi preskoc.ts)', shouldStop('evergreen-consumer', 1, JA, MA_ACADEMY, JE_EX), false);

// ---------- PAUZA PRED KONZULTACNIM HOVOREM (15. 9. 2026) ----------
// Mnozina = lide se zaplacenou konzultaci, kterym hovor JESTE NEBYL (termin chybi
// nebo je v budoucnu). Stavi ji `index.ts`, tady je jen dosazena.
const CEKA_NA_HOVOR = s(JA);
const NIKDO_NECEKA = s();
zkontroluj('upsell-coaching se pred hovorem ODLOZI', konzultaceVBehu('upsell-coaching', JA, CEKA_NA_HOVOR), true);
zkontroluj('upsell-academy se pred hovorem ODLOZI (vede ji tyz clovek)', konzultaceVBehu('upsell-academy', JA, CEKA_NA_HOVOR), true);
zkontroluj('blog-newsletter se NEODKLADA (obsah, ne nabidka)', konzultaceVBehu('blog-newsletter', JA, CEKA_NA_HOVOR), false);
zkontroluj('tydenik se NEODKLADA', konzultaceVBehu('tydenik', JA, CEKA_NA_HOVOR), false);
zkontroluj('onboarding-nakup-konzultace se NEODKLADA (doruceni zaplaceneho)', konzultaceVBehu('onboarding-nakup-konzultace', JA, CEKA_NA_HOVOR), false);
zkontroluj('longtail-consumer se NEODKLADA', konzultaceVBehu('longtail-consumer', JA, CEKA_NA_HOVOR), false);
zkontroluj('kdo konzultaci nema, projde i na prodejni trati', konzultaceVBehu('upsell-coaching', NIKDO, CEKA_NA_HOVOR), false);
zkontroluj('PRAZDNA MNOZINA = POSILEJ (fail-open pri vypadku dotazu)', konzultaceVBehu('upsell-coaching', JA, NIKDO_NECEKA), false);
zkontroluj('velka pismena v adrese nerozbiji shodu', konzultaceVBehu('upsell-coaching', 'Klient@Example.com', CEKA_NA_HOVOR), true);
zkontroluj('prazdny track nespadne a neodklada', konzultaceVBehu('', JA, CEKA_NA_HOVOR), false);
zkontroluj('pauzuji se prave dve prodejni trate', TRATE_PAUZA_KONZULTACE.join(','), 'upsell-coaching,upsell-academy');
// ⛔ KONTRAST PROTI `shouldStop`: tatáž situace se v ni NESMI projevit, jinak by se
// z docasneho cekani stal trvaly `status='purchased'` a clovek by prisel i o newsletter.
zkontroluj('shouldStop o konzultaci NIC NEVI (musi zustat na odkladu)', shouldStop('upsell-coaching', 0, JA, MA_VK, BEZ_EX), false);

// ---------- ZNACKA CEKANI VE `vars` (15. 9. 2026, po revizi R1, nalez S1) ----------
// Bez znacky vypadne kupec konzultace i z blog-newsletteru: `newsletter_prijemci`
// bere jen leady s `next_send_at is null` nebo `> now() + 24 h`, a odklad o 24 h
// tou podminkou nikdy neprojde. Znacku cte ziva SQL funkce, takze jeji jmeno je smlouva.
zkontroluj('klic znacky se nesmi zmenit (cte ho newsletter_prijemci)', VARS_KLIC_KONZULTACE, '_konzultace_ceka');
const VARS_PRAZDNE = varsSeZnackouKonzultace(null, '2026-09-15T08:00:00Z');
zkontroluj('znacka se zapise i do prazdnych vars', String(VARS_PRAZDNE['_konzultace_ceka']), '2026-09-15T08:00:00Z');
zkontroluj('zapsanou znacku funkce pozna', maZnackuKonzultace(VARS_PRAZDNE), true);
zkontroluj('prazdne vars znacku nemaji', maZnackuKonzultace(null), false);
zkontroluj('cizi klic neni znacka', maZnackuKonzultace({ _cadence: { od: 'x' } }), false);
zkontroluj('prazdny retezec se za znacku nepovazuje', maZnackuKonzultace({ _konzultace_ceka: '' }), false);
// ⛔ Ostatni klice ve `vars` jsou promenne trati a `_cadence`. Kdyby je znackovani
// prepsalo, clovek by dostal mail s prazdnymi promennymi nebo by se rozjela kadence.
const VARS_PLNE = { 'upsell-coaching': { jmeno: 'Mirek' }, _cadence: { od: '2026-09-01T00:00:00Z' } };
const VARS_SE_ZNACKOU = varsSeZnackouKonzultace(VARS_PLNE, '2026-09-15T08:00:00Z');
zkontroluj('znackovani nesmaze promenne trati', JSON.stringify(VARS_SE_ZNACKOU['upsell-coaching']), JSON.stringify({ jmeno: 'Mirek' }));
zkontroluj('znackovani nesmaze _cadence', JSON.stringify(VARS_SE_ZNACKOU._cadence), JSON.stringify({ od: '2026-09-01T00:00:00Z' }));
zkontroluj('puvodni objekt se nemeni (zadna mutace vstupu)', maZnackuKonzultace(VARS_PLNE), false);
// Druhy odklad si drzi PRVNI datum, at je videt, jak dlouho clovek ceka.
const VARS_DRUHY_ODKLAD = varsSeZnackouKonzultace(VARS_SE_ZNACKOU, '2026-09-20T08:00:00Z');
zkontroluj('opakovany odklad datum neprepise', String(VARS_DRUHY_ODKLAD['_konzultace_ceka']), '2026-09-15T08:00:00Z');
// Mazani znacky: bez nej by newsletter ignoroval next_send_at napořád.
const VARS_PO_HOVORU = varsBezZnackyKonzultace(VARS_SE_ZNACKOU);
zkontroluj('po smazani uz znacka neni', maZnackuKonzultace(VARS_PO_HOVORU), false);
zkontroluj('mazani nesmaze promenne trati', JSON.stringify(VARS_PO_HOVORU['upsell-coaching']), JSON.stringify({ jmeno: 'Mirek' }));
zkontroluj('mazani nesmaze _cadence', JSON.stringify(VARS_PO_HOVORU._cadence), JSON.stringify({ od: '2026-09-01T00:00:00Z' }));
zkontroluj('mazani nad prazdnymi vars nespadne', JSON.stringify(varsBezZnackyKonzultace(null)), '{}');
zkontroluj('pole misto objektu nespadne', JSON.stringify(varsBezZnackyKonzultace([1, 2])), '{}');

// ---------- MAZANI ZNACKY: PODLE MNOZINY, NE PODLE TRATE (po revizi R2, R2-S1) ----------
// ⛔ Stara verze mazala znacku pokazde, kdyz `konzultaceVBehu` vratilo `false`. To ma ale
// DVA duvody a jen jeden znamena „uz neceka". Druhy je „lead prave neni na prodejni trati",
// coz nastava bezne: rozesilka si leada PUJCI a prepise mu `track` na `blog-newsletter`
// nebo `tydenik`. Pak se znacka smazala nekomu, kdo dal cekal, a zapsala se o tom
// nepravdiva udalost „hovor probehl".
const ZNACKA = { _konzultace_ceka: '2026-09-15T08:00:00Z' };
const BEZ_ZNACKY = { _cadence: { od: '2026-09-01T00:00:00Z' } };
const BRANA_OK = true, BRANA_CHYBA = false;
zkontroluj('kdo uz neceka, o znacku prijde', smiSeOdznackovat(ZNACKA, JA, s(), BRANA_OK), true);
zkontroluj('kdo POŘÁD ČEKÁ, znacku SI NECHA', smiSeOdznackovat(ZNACKA, JA, s(JA), BRANA_OK), false);
// Kontrast k puvodni vade: lead pujceny do rozesilky uz neni na upsell trati, ale ceka dal.
// Funkce se na trat vubec nepta, takze na tomhle scenari zalezi jen mnozina.
zkontroluj('pujceny do rozesilky a porad ceka: NEMAZAT', smiSeOdznackovat(ZNACKA, JA, s(JA, NIKDO), BRANA_OK), false);
zkontroluj('pujceny do rozesilky a uz neceka: smazat', smiSeOdznackovat(ZNACKA, JA, s(NIKDO), BRANA_OK), true);
// ⛔ Druha polovina vady: pri chybe dotazu je mnozina prazdna (fail-open) a `has()` vrati
// false VSEM. Bez teto podminky by jedina chyba dotazu smazala znacky vsem, kdo je maji,
// tedy z fail-open „posli o mail navic" by se stal zapis do dat.
zkontroluj('CHYBA BRANY: prazdna mnozina NESMI mazat', smiSeOdznackovat(ZNACKA, JA, s(), BRANA_CHYBA), false);
zkontroluj('chyba brany nemaze ani kdyz je nekdo v mnozine', smiSeOdznackovat(ZNACKA, JA, s(NIKDO), BRANA_CHYBA), false);
zkontroluj('kdo znacku nema, nema se co mazat', smiSeOdznackovat(BEZ_ZNACKY, JA, s(), BRANA_OK), false);
zkontroluj('prazdne vars nespadnou', smiSeOdznackovat(null, JA, s(), BRANA_OK), false);
zkontroluj('velka pismena v adrese nerozbiji shodu ani tady', smiSeOdznackovat(ZNACKA, 'Klient@Example.com', s(JA), BRANA_OK), false);

console.log(selhalo === 0 ? `\nHOTOVO: ${kontrol} kontrol, vse proslo.` : `\nSELHALO: ${selhalo} z ${kontrol}`);
if (selhalo > 0) Deno.exit(1);
