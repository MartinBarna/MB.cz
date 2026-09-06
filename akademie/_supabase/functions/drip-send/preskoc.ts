// PRESKOCENI JEDNOHO KROKU TRATE, KTERY PRODAVA UZ VLASTNENY PRODUKT (7. 8. 2026).
//
// PROC TO NEJDE PRES shouldStop v index.ts: `onboarding-nakup-*` jsou CLENSKE trate
// a ty se schvalne nikdy nestopuji cele, protoze jejich krok 0 je DORUCENI zaplaceneho
// zbozi. Zastavit celou trat kvuli jedinemu upsell mailu by znamenalo nedorucit,
// co si clovek koupil. Proto se vynechava JEN ten jeden krok a zbytek trate bezi dal.
//
// ⚠️ ZAMERNE NATVRDO V KODU, ne v `app_config` (na rozdil od MOSTY): tohle neni provozni
// nastaveni, ale tvrzeni o OBSAHU konkretni sablony ("balicek-2-videokurz prodava
// videokurz"). Kdo prepise sablonu, musi prepsat i tohle, a v kodu to aspon vidi.
// V DB by z toho byla dalsi mrtva paka, kterou nikdo nevyplni.
//
// Vlastni soubor (ne uvnitr index.ts) kvuli testovatelnosti: `index.ts` vola `serve()`
// hned pri importu, takze by ho test nemohl nacist, aniz by nastartoval server.
// Stejny vzor uz v repu je: `ai-martin/preflag.ts` + `preflag.test.ts`.

export type Produkt = 'videokurz' | 'academy' | 'coaching' | 'balicek';

/** Klic je `track/step`, hodnota je produkt, ktery ten konkretni mail prodava. */
export const PRESKOC_KROK_KDYZ_VLASTNI: Record<string, Produkt> = {
  // krok 2 trate balicku = sablona `balicek-2-videokurz`,
  // subject "Recepty ti reknou co. Kurz ti rekne proc"
  'onboarding-nakup-balicek/2': 'videokurz',
  // krok 12 longtailu = sablona `lt-balicek`, nabidka balicku "40 receptu a 48 odpovedi".
  // ⚠️ `shouldStop` tenhle pripad NEPOKRYVA: pro `longtail-consumer` stopuje na `ownsAny`
  // a v tom `balicek` zamerne neni (duvod je u `ownsAny` v index.ts). Bez teto branky
  // by nabidka balicku chodila i tomu, kdo si balicek uz koupil.
  'longtail-consumer/12': 'balicek',
  // [2026-09-06, 51. sef] krok 1 evergreen-consumer = sablona `ev-1-kalkulacka`, P.S. prodava videokurz.
  // Od 6. 9. sem mostem prichazi i majitel videokurzu z konce `evergreen-kupci`; tomu se ten jeden
  // krok vynecha a trat bezi dal (shouldStop pro evergreen-consumer zamerne neni: obsah je pro vsechny).
  'evergreen-consumer/1': 'videokurz',
  // krok 4 evergreen-consumer = sablona `ev-4-checkin`, P.S. prodava koucink -> klientovi koucinku preskocit.
  'evergreen-consumer/4': 'coaching',
};

/**
 * Vraci produkt, kvuli kteremu se ma krok preskocit, nebo null (= posli normalne).
 *
 * `owns` je tataz mapa, kterou si index.ts stavi z `entitlements` (jen aktivni
 * a neexpirovane). Predava se parametrem schvalne: funkce necte DB ani cas,
 * takze je cela deterministicka a da se otestovat bez site.
 */
export function maPreskocitKrok(
  track: string,
  step: number,
  email: string,
  owns: Record<string, Set<string>>,
): Produkt | null {
  const produkt = PRESKOC_KROK_KDYZ_VLASTNI[String(track ?? '') + '/' + step];
  if (!produkt) return null;
  // ⛔ Fail-safe je ODESLAT. Kdyz mapa `owns` chybi nebo je prazdna (napr. dotaz do
  // entitlements selhal), chova se to jako driv a mail odejde. Opacna volba by
  // pri vypadku dotazu tise zadrzela maily vsem.
  return owns?.[produkt]?.has(String(email ?? '').toLowerCase()) ? produkt : null;
}
