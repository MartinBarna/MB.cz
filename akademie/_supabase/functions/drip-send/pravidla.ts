// CISTA ROZHODOVACI PRAVIDLA DRIP-SEND (vytazeno z index.ts 8. 8. 2026).
//
// PROC vlastni soubor: `index.ts` vola `Deno.serve()` hned pri importu, takze ho test
// nemuze nacist, aniz by nastartoval server. Tim padem se tahle pravidla nedala otestovat
// a pritom prave v nich vznikly dve draha selhani (mrtva ochrana kupujiciho u mostu
// 6. 8. a nabidka koucinku ex-klientce 8. 8.). Stejny vzor uz v repu je:
// `preskoc.ts` + `preskoc.test.ts`.
//
// ⛔ TENHLE PRESUN NEMENI CHOVANI. Je to 1:1 vytazeni vcetne komentaru; jedina zmena je,
// ze `owns` a `exCoaching` se predavaji parametrem misto uzaveru. Diky tomu funkce necte
// DB ani cas a je cela deterministicka.

/** Mapa vlastnictvi: klic je produkt, hodnota mnozina e-mailu malymi pismeny. */
export type Vlastnictvi = Record<string, Set<string>>;

/**
 * Vlastni clovek NEKTERY z produktu, ktere delaji ze cteneare zakaznika?
 *
 * ⛔ `balicek` sem SCHVALNE NEPATRI a nesmi se sem „opravit". `owns.balicek` slouzi
 * vyhradne brance v `preskoc.ts` (aby se nabidka balicku neposlala tomu, kdo ho uz ma).
 * Kdyby `balicek` pribyl sem, clovek, ktery koupil JEN balicek za 349, by se okamzite
 * stopnul na akvizicnich tratich i na `longtail-consumer` (status 'purchased') a prestal
 * by dostavat obsah. Balicek je nejlevnejsi schod pyramidy, tedy duvod pokracovat v peci.
 */
export function vlastniCokoli(owns: Vlastnictvi, em: string): boolean {
  return !!(owns?.videokurz?.has(em) || owns?.academy?.has(em) || owns?.coaching?.has(em));
}

/**
 * STOP-PO-NAKUPU (per track): prodejni track se stopne, kdyz prijemce UZ vlastni produkt,
 * ktery mu track prodava:
 *  - akvizicni (lead-magnet*, existing-leadmagnet, nurture-*) a longtail-consumer prodavaji
 *    vstup ne-majitelum -> stop pri JAKEMKOLI nakupu (videokurz/academy/coaching);
 *    u akvizicnich je krok 0 slibeny freebie (PDF plan) -> posli vzdy, stop az od kroku 1
 *  - longtail-trener, trener-kit a upsell-academy prodavaji Academy -> stop pri academy
 *    (trener-kit krok 0 = slibeny kit zdarma -> posli vzdy, stop az od kroku 1)
 *  - upsell-coaching prodava koucink -> stop pri coaching, vcetne EX-klientu
 *  - longtail-kupci = pece o kupce videokurzu + upgrade na Academy -> stop pri academy
 *  - academy-vk-serie = jednorazova serie pro majitele videokurzu bez Academy
 *    (C1, 1. 9. 2026) -> stop pri academy. Trat je docasna: lidi do ni prehazuje
 *    SQL a po dojeti je vraci zpet, takze bez tohohle radku by cloveku, ktery
 *    Academy uprostred serie koupi, odesly zbyle dva prodejni maily na to,
 *    co uz zaplatil.
 * Clenske tracky (onboarding, milestone, reactivation, rescue) cili na zakazniky,
 * ty se nestopuji nikdy.
 *
 * `exCoaching` = e-maily VSECH coaching entitlementu, i neaktivnich. Detail u volani nize.
 */
export function shouldStop(
  track: string,
  step: number,
  em: string,
  owns: Vlastnictvi,
  exCoaching: Set<string>,
): boolean {
  const t = String(track || '');
  if (['lead-magnet', 'existing-leadmagnet', 'nurture-'].some((p) => t.indexOf(p) === 0)) {
    return step > 0 && vlastniCokoli(owns, em);
  }
  if (t === 'longtail-consumer') return vlastniCokoli(owns, em);
  if (
    t === 'longtail-trener' || t === 'upsell-academy' || t === 'longtail-kupci' ||
    t === 'academy-vk-serie'
  ) {
    return !!owns?.academy?.has(em);
  }
  if (t === 'trener-kit') return step > 0 && !!owns?.academy?.has(em);
  // ⛔ `exCoaching` je tu NAVIC k `owns.coaching` a ta redundance je zamerna: `owns.coaching`
  // kryje aktivni klienty i v pripade, ze by dotaz nad `exCoaching` selhal, a `exCoaching`
  // kryje ty po offboardu, ktere `owns.coaching` uz neobsahuje (offboard entitlement
  // deaktivuje). Co se stalo bez teto vrstvy: klientce po 13 tydnech koucinku odesel mail
  // "Videokurz mas. Chces pomoc i ode me osobne?". Pamet `mb-koucink-offboard-automat`.
  // ⛔ NEROZSIROVAT tim `vlastniCokoli` ani ostatni trate: ex-klient je legitimni cil
  // akvizice (obsah, appka, Academy). Zakazana mu je jen nabidka koucinku, ktery dokoncil.
  if (t === 'upsell-coaching') return !!owns?.coaching?.has(em) || !!exCoaching?.has(em);
  // [2026-08-06] TRATE APPKY (tc-free = registrace v appce, tc-magnet = jidelnickovy magnet).
  // Prodavaji predplatne Tvuj Coach. Kdo si koupi predplatne PRIMO v appce, prepne se pryc
  // sam (app-onboarding-hook ho hodi do onboarding-nakup-tvujcoach), takze na nej tohle
  // pravidlo neni. Diru maji ale dva pripady, ktere hook nikdy neuvidi:
  //   - kdo koupil ACADEMY, ma appku VIP na rok (pamet tvujcoach-academy-vip-na-rok),
  //   - kdo ma KOUCINK, plati Martinovi nejvyssi ticket, jaky prodavame.
  // Obema by od kroku 5 chodilo "zkusebka ti skonci, odemkni si appku za 249", coz je
  // u prvniho lez a u druheho trapne. Kroky 0 az 4 jsou obsahove (vazeni, prumery,
  // generatory, AI kouc) a davaji smysl i jim, proto se stopuje az od kroku 5.
  if (t === 'tc-free' || t === 'tc-magnet') {
    return step >= 5 && (!!owns?.academy?.has(em) || !!owns?.coaching?.has(em));
  }
  // [2026-09-06, 51. sef] evergreen-kupci = dozivotni udrzovaci pece o majitele videokurzu, ktery uz
  // dostal longtail-kupci i upsell-coaching. Pripomina, co si v kurzu koupil, a v P.S. nabizi appku.
  // Koucink NEPRODAVA (posledni mail upsell-coaching slibil, ze byl ke koucinku posledni), proto tu
  // `exCoaching` neni: ex-klient je legitimni cil obsahu i appky. Stopne se clen Academy (dostane
  // onboarding-nakup-academy) a aktivni klient koucinku (o toho se stara Martin osobne).
  // ⛔ Bez podminky na `step`: vola se i s KROK_PRO_MOST = 1 (viz `mostBlokujeVlastnictvi`); tvar
  //    `step > 0 && …` by z pojistky mostu udelal mrtvou paku (incident 6. 8. 2026).
  if (t === 'evergreen-kupci') return !!owns?.academy?.has(em) || !!owns?.coaching?.has(em);
  return false;
}

/**
 * PAUZA PRED KONZULTACNIM HOVOREM (15. 9. 2026).
 *
 * Kdo ma zaplacenou konzultaci a jeste si s Martinem nepromluvil, nesmi dostat mail
 * z PRODEJNI trate: ta mu prodava presne to, o cem si s Martinem bude povidat.
 *
 * ⛔ NEPATRI do `shouldStop`. Ta je TRVALA: nastavi leadovi `status='purchased'`
 * a `next_send_at=null`, cimz clovek vypadne i z blog-newsletteru a tydeniku (obe
 * rozesilky berou jen `status='active'`). Tohle je DOCASNE cekani, resi se ODKLADEM
 * o 24 h (`ODLOZ_MS` z `aktivace.ts`), stejnym vzorem jako `odklad_neaktivita`.
 * Druhy den se to zkusi znovu a po hovoru mail proste odejde.
 *
 * ⚠️ Mnozina `konzultaceCekaNaHovor` se stavi v `index.ts`: aktivni a nevyprsely narok
 * `konzultace` MINUS ti, kdo maji `consultation_calls.termin_at` v minulosti. Diky tomu
 * tahle funkce necte DB ani cas a jde testovat bez site.
 *
 * ⚠️ FAIL-OPEN: kdyz nektery z tech dvou dotazu selze, mnozina je PRAZDNA a maily jdou
 * dal. Opacna volba by pri vypadku jednoho dotazu ticho zadrzela maily vsem, a to je
 * horsi nez jeden mail navic. Vedomy kompromis, stejny jako u `maPreskocitKrok`.
 *
 * ⛔ Obsahove trate (`blog-newsletter`, `tydenik`) se NEODKLADAJI: ticho pred hovorem
 * vypada hur nez jeden clanek. A `onboarding-nakup-konzultace` uz vubec ne, to je
 * doruceni zaplaceneho.
 */
export const TRATE_PAUZA_KONZULTACE: readonly string[] = ['upsell-coaching', 'upsell-academy'];

export function konzultaceVBehu(
  track: string,
  em: string,
  konzultaceCekaNaHovor: Set<string>,
): boolean {
  if (!TRATE_PAUZA_KONZULTACE.includes(String(track || ''))) return false;
  return !!konzultaceCekaNaHovor?.has(String(em ?? '').toLowerCase());
}

/**
 * ZNACKA V `leads.vars`, PODLE KTERE NEWSLETTER POZNA, ZE TENHLE ODKLAD NENI MAIL
 * (pridano 15. 9. 2026 po revizi R1, nalez S1).
 *
 * ⛔ PROC VUBEC: `newsletter_prijemci` bere jen leady, kde `next_send_at is null`
 * nebo `next_send_at > now() + 24 hodin` (pravidlo z 2. 9. 2026 „kdo ma naplanovany
 * mail do 24 h, se nepujcuje"). Odklad o 24 h vznika DRIV, nez bezi rozesilka, takze
 * ta podminka je pro nej VZDY nepravdiva a kupec konzultace by po celou dobu cekani
 * na termin vypadl i z blog-newsletteru, tedy z OBSAHOVE trate. Pri zapomenutem
 * terminu napořád. Ziva `newsletter_prijemci` proto dostava treti vetev na tuhle znacku.
 *
 * ⛔ PROC NE `next_send_at = NULL` (parkovani): retezec `next_send_at is null` cte
 * DEVET zivych SQL funkci (blasty, mosty, enrolly, vraceni z rozesilek) a znamena
 * v nich „tenhle clovek nema naplanovano, je volny". Zaparkovany lead by se stal
 * koristi blastu i mostu, tedy presne ta ticha ztrata trate, pred kterou varuje
 * komentar z 13. 8. 2026. Znacka nemeni vyznam zadneho existujiciho pole.
 *
 * ⚠️ Znacka se MUSI mazat, jakmile clovek uz neceka, jinak by newsletter ignoroval
 * jeho `next_send_at` napořád. Maze ji tentyz beh drip-sendu (viz `index.ts`).
 * ⚠️ Ostatni klice ve `vars` zustavaji nedotcene (jsou tam promenne trati i `_cadence`).
 */
export const VARS_KLIC_KONZULTACE = '_konzultace_ceka';

function jenObjekt(vars: unknown): Record<string, unknown> {
  return (vars && typeof vars === 'object' && !Array.isArray(vars))
    ? { ...(vars as Record<string, unknown>) }
    : {};
}

export function maZnackuKonzultace(vars: unknown): boolean {
  const v = jenObjekt(vars)[VARS_KLIC_KONZULTACE];
  return typeof v === 'string' && v !== '';
}

export function varsSeZnackouKonzultace(vars: unknown, odIso: string): Record<string, unknown> {
  const out = jenObjekt(vars);
  // Prvni odklad si drzi svoje datum: je z nej videt, jak dlouho uz clovek ceka.
  if (!maZnackuKonzultace(out)) out[VARS_KLIC_KONZULTACE] = odIso;
  return out;
}

export function varsBezZnackyKonzultace(vars: unknown): Record<string, unknown> {
  const out = jenObjekt(vars);
  delete out[VARS_KLIC_KONZULTACE];
  return out;
}

/**
 * ⛔ ZAMERNE KROK 1, NE 0. `shouldStop` ma pro akvizicni trate (lead-magnet*,
 * existing-leadmagnet, nurture-*) tvar `step > 0 && vlastniCokoli`, protoze KROK 0 je
 * slibeny freebie a ten se posila i tomu, kdo uz koupil. Pri volani s nulou by ochrana
 * kupujiciho pro tyhle trate NIKDY nesepnula (mrtva paka) a most by platiciho zakaznika
 * prehodil do akvizicni trate s nabidkou na to, co uz ma. Toho, koho prehazujeme mostem,
 * se freebie netyka: on si o nej neposlal.
 * Nasel to druhy chat pri revizi 6. 8. 2026, pamet `feedback-nova-cesta-stare-pravidlo`.
 */
export const KROK_PRO_MOST = 1;

/** Pojistka 2 mostu: vlastni uz clovek to, co cilova trat prodava? */
export function mostBlokujeVlastnictvi(
  cilTrack: string,
  em: string,
  owns: Vlastnictvi,
  exCoaching: Set<string>,
): boolean {
  return shouldStop(cilTrack, KROK_PRO_MOST, em, owns, exCoaching);
}

export interface Most {
  track: string;
  po_dnech?: unknown;
}

/**
 * Pojistka 1 mostu: je pro tuhle trat definovany platny cil?
 * Vraci cil, nebo null. Cil na sebe samu se zahazuje (jinak by se clovek tocil dokola).
 */
export function vyberMost(mosty: Record<string, Most>, track: string): Most | null {
  const zdroj = String(track || '');
  const cil = mosty?.[zdroj];
  if (!cil || typeof cil.track !== 'string' || !cil.track || cil.track === zdroj) return null;
  return cil;
}

/**
 * Odstup ve dnech po poslednim mailu puvodni trate, at cloveku neprijdou dva maily po sobe.
 * ⛔ FAIL-SAFE SMEREM K CEKANI, NE K ODESLANI. `?? 7` kryje jen CHYBEJICI klic; preklep
 * (`"sedm"` misto 7) dava NaN a driv z nej `|| 0` udelalo nulu, tedy mail z nove trate
 * HNED a dva po sobe, presne to, cemu ma tenhle parametr branit. Proto se nevalidni
 * hodnota chova stejne jako chybejici: 7 dni. Zaporna cisla taky.
 */
export const ODSTUP_VYCHOZI = 7;
export function odstupDnu(raw: unknown): number {
  const n = Number(raw ?? ODSTUP_VYCHOZI);
  return Number.isFinite(n) && n >= 0 ? n : ODSTUP_VYCHOZI;
}
