// VETVENI MAILU PODLE TOHO, JESTLI CLOVEK UZ ZAPSAL JIDLO V APPCE (pripraveno 25. 8. 2026).
//
// PROC TO VZNIKLO: 16 z 29 skutecnych zkusebek nezapsalo ANI JEDEN den (mereno 20. 8. 2026,
// pamet `tvujcoach-hodnota-bez-checkinu`). Uzke hrdlo je AKTIVACE, ne cena. Aktivacni serie
// proto potrebuje vedet, jestli uz clovek zapsal, a podle toho mail bud poslat, nebo vynechat.
//
// ⛔⛔ NENI TO JEN „EXIT PO PRVNIM ZAPISU". Zadani znelo „utni serii, kdyz clovek zapise",
//    ale pri cteni ZIVYCH sablon (25. 8. 2026) vyslo najevo, ze podminka je OBOUSMERNA:
//      - `tc-zkusebka/0` (tcz-0-den1) rika „Dneska zapis, co jis" -> je to nutkani a tomu,
//        kdo uz zapsal, nema co delat;
//      - `tc-zkusebka/1` (tcz-1-den3) ZACINA vetou „par dni zapisu za tebou, to zvladne min
//        lidi, nez by sis myslel, tak dobra prace". To je TVRZENI O CLOVEKU, a u 16 z 29 lidi
//        je NEPRAVDIVE. Jednosmerny „exit" by tuhle vadu nechal na miste.
//    Proto se tu neresi „stop trate", ale „posli tenhle krok jen tomu, na koho sedi".
//
// ⛔ CO TENHLE SOUBOR ZAMERNE NEDELA: neutina celou trat. `tc-zkusebka` kroky 1 az 3 prodavaji
//    BASIC, tedy hlavni prodavany plan (CLAUDE.md). Utnout je prave tomu, kdo appku zacal
//    pouzivat, by zabilo prodej presne u nejnadejnejsi skupiny. Vynechava se JEDEN krok
//    a trat bezi dal, uplne stejne jako v `preskoc.ts` (a stejnym mechanismem `advance()`,
//    takze most na konci trate zustava funkcni).
//
// ⚠️ ZAMERNE NATVRDO V KODU, ne v `app_config`: stejne jako u `preskoc.ts` je to TVRZENI
//    O OBSAHU konkretni sablony, ne provozni nastaveni. Kdo prepise sablonu, musi prepsat
//    i tenhle radek, a v kodu to aspon vidi.
//
// Vlastni soubor kvuli testovatelnosti: `index.ts` vola `Deno.serve()` hned pri importu.
// Testy: `aktivace.test.ts` (bez site, bez disku, bez env).

/**
 * Co o cloveku vime. `nevime` je PLNOHODNOTNY stav, ne chyba: signal jde pres sit
 * do druheho Supabase projektu a ten vypadek nesmi nikoho pripravit o mail.
 */
export type StavZapisu = 'zapsal' | 'nezapsal' | 'nevime';

/**
 * Podminka kroku:
 *  - `jen_kdyz_nezapsal` = mail nutka k prvnimu zapisu -> komu uz zapsal, se PRESKOCI
 *  - `jen_kdyz_zapsal`   = mail TVRDI, ze clovek zapisuje -> kdo nezapsal, se PRESKOCI
 */
export type Podminka = 'jen_kdyz_nezapsal' | 'jen_kdyz_zapsal';

/**
 * Klic je `track/step`, hodnota je podminka toho konkretniho mailu.
 *
 * ⛔⛔ SCHVALNE PRAZDNA. Vyplnit ji znamena zmenit, co dostane ZIVY clovek, a to je
 *    obsahove rozhodnuti pod Martinovym jmenem, ne technicke. Dokud je mapa prazdna,
 *    cely mechanismus je vypnuty: `index.ts` nepusti ani jeden dotaz do appky
 *    a chova se presne jako dnes. Zapnuti = pridat radek + nasadit.
 *
 * KANDIDATI ZMERENI 25. 8. 2026 na zivych sablonach (`email_templates`), k rozhodnuti:
 *   'tc-zkusebka/0': 'jen_kdyz_nezapsal',
 *      tcz-0-den1 „Prvni den v appce: zacni jednim zapisem". Cely mail je nutkani.
 *      ⚠️ Chodi hned po registraci (`next_send_at = now()`), takze v praxi zabere jen
 *      u toho, kdo zapsal drive, nez ho vzal hodinovy cron. Zisk je maly.
 *   'tc-zkusebka/1': 'jen_kdyz_zapsal',
 *      tcz-1-den3 „par dni zapisu za tebou (...) dobra prace". ⛔ NEZAPINAT DRIV, nez
 *      pro nezapisujici vznikne NAHRADNI mail, jinak jim v serii vznikne dira (dostanou
 *      krok 0 a pak az krok 2). To uz je copy prace, ne mechanika.
 *   'tc-zkusebka/2': 'jen_kdyz_zapsal'?
 *      tcz-2-den7 „mas za sebou tyden a ceka te prvni tydenni check-in". Tvrzeni je
 *      mensi (o case, ne o vykonu) a mail je nositelem prodejniho argumentu pro Basic
 *      (prepocet cilu). Podle CLAUDE.md se NABIDKA nezahazuje -> spis PREPSAT nez vetvit.
 *   ⛔ `tc-zkusebka/3` (trenink) je neutralni, sedi na oba stavy. Nevetvit.
 *   ⛔ `tc-aktivace/0` sem NEPATRI: posila se vetvi `oneoff_email` z `app-onboarding-hook`
 *      v okamziku registrace, tedy driv, nez mohl kdokoli zapsat. Vetev `oneoff` navic
 *      touhle rozhodovaci smyckou vubec neprochazi.
 */
export const KROK_PODLE_ZAPISU: Record<string, Podminka> = {};

/**
 * Ktere trate maji aspon jeden vetveny krok. `index.ts` se podle toho pta appky JEN
 * na lidi, kterych se to tyka; nikoho jineho adresu ven neposila.
 * Prazdna mnozina = mechanismus vypnuty (zadne volani po siti).
 */
export function trateSeSignalem(mapa: Record<string, Podminka> = KROK_PODLE_ZAPISU): Set<string> {
  const out = new Set<string>();
  for (const klic of Object.keys(mapa)) {
    const i = klic.lastIndexOf('/');
    if (i > 0) out.add(klic.slice(0, i));
  }
  return out;
}

/**
 * Vraci podminku, kvuli ktere se ma krok PRESKOCIT, nebo null (= posli normalne).
 *
 * ⛔ FAIL-SAFE JE ODESLAT, stejne jako vsude jinde v teto funkci. `nevime` (vypadek site,
 *    chybejici secret, timeout) proto vraci VZDY null. Opacna volba by pri vypadku appky
 *    tise zadrzela maily celych trati a nikdo by si toho nevsiml, protoze zadrzeny mail
 *    nikde nekrici. Radsi jeden mail navic nez ticho.
 */
export function maPreskocitPodleZapisu(
  track: string,
  step: number,
  stav: StavZapisu,
  mapa: Record<string, Podminka> = KROK_PODLE_ZAPISU,
): Podminka | null {
  const podminka = mapa[String(track ?? '') + '/' + step];
  if (!podminka) return null;
  if (stav === 'nevime') return null;
  if (podminka === 'jen_kdyz_nezapsal') return stav === 'zapsal' ? podminka : null;
  return stav === 'nezapsal' ? podminka : null;
}
