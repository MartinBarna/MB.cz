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
  return false;
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
