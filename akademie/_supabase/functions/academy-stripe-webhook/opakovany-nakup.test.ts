// Test opakovaneho nakupu jednorazoveho produktu (16. 9. 2026, nalez A/N2).
// Spusteni:
//   npx --yes deno@2 run --allow-read akademie/_supabase/functions/academy-stripe-webhook/opakovany-nakup.test.ts
//
// DVE VRSTVY, PROTOZE JEDNA NESTACI:
//   1. ciste funkce z `opakovany-nakup.ts` (primy import, zadne IO),
//   2. textova kontrola `index.ts`. Ten vola `Deno.serve()` hned pri importu,
//      takze ho naimportovat nejde (stejny duvod jako v `katalog-konzistence.test.ts`),
//      a prave v nem lezi to, co se opravovalo: podminka vetve opakovaneho nakupu
//      a podminka alertu "zvaz vraceni".
//
// ⛔ KONTRAST: kontroly OK1 az OK5 a NA1 az NA5 PADAJI na verzi pred touhle opravou.
//    Overeno takto (z korene repa, `ad74cf7df` je produkcni SHA ze 16. 9. 2026):
//      git show ad74cf7df:akademie/_supabase/functions/academy-stripe-webhook/index.ts \
//        > /tmp/index-stary.ts
//      ASW_INDEX=/tmp/index-stary.ts npx --yes deno@2 run --allow-read --allow-env \
//        akademie/_supabase/functions/academy-stripe-webhook/opakovany-nakup.test.ts
//    Namereno 16. 9. 2026: na stare verzi 10 kontrol FAIL (18/28), na nove 0 (28/28).

import {
  OPAKOVATELNE_KLICE,
  OPAKOVATELNE_PRODUKTY,
  jeOpakovatelnyKlic,
  jeOpakovatelnyProdukt,
  maHlasitZvazVraceni,
  stavOpakovanehoNakupu,
  typUdalostiZnovu,
} from './opakovany-nakup.ts';

const KOREN = new URL('../../../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const WEBHOOK = Deno.env.get('ASW_INDEX')
  || KOREN + 'akademie/_supabase/functions/academy-stripe-webhook/index.ts';
const zdroj = await Deno.readTextFile(WEBHOOK);

type Kontrola = { name: string; pass: boolean; detail: string };
const cases: Kontrola[] = [];
const check = (name: string, pass: boolean, detail = '') => cases.push({ name, pass, detail });

// --- 1) CISTE FUNKCE --------------------------------------------------------
check('C1 balicek je opakovatelny', jeOpakovatelnyKlic('balicek'));
check('C2 obe varianty konzultace jsou opakovatelne',
  jeOpakovatelnyKlic('konzultace') && jeOpakovatelnyKlic('konzultace-vk'));
check('C3 Academy a videokurz opakovatelne NEJSOU (druhy nakup je tam omyl)',
  !jeOpakovatelnyKlic('academy-lifetime') && !jeOpakovatelnyKlic('videokurz')
  && !jeOpakovatelnyKlic('videokurz-upgrade'));
check('C4 koucinkove klice sem nepatri, maji vlastni vetev',
  !jeOpakovatelnyKlic('koucink-gold-1') && !jeOpakovatelnyKlic('koucink-diamond-6'));

check('C5 "zvaz vraceni" se u opakovatelnych produktu NEHLASI',
  !maHlasitZvazVraceni('balicek') && !maHlasitZvazVraceni('konzultace'));
check('C6 "zvaz vraceni" se u Academy a videokurzu hlasi dal',
  maHlasitZvazVraceni('academy') && maHlasitZvazVraceni('videokurz'));

check('C7 typ udalosti balicku se NESMI zmenit (historicke radky 7. a 11. 8. 2026)',
  typUdalostiZnovu('balicek') === 'balicek_znovu_doruceno', typUdalostiZnovu('balicek'));
check('C8 obe varianty konzultace sdili JEDEN typ udalosti (je to tyz produkt)',
  typUdalostiZnovu('konzultace') === 'konzultace_znovu_doruceno'
  && typUdalostiZnovu('konzultace-vk') === 'konzultace_znovu_doruceno');
check('C9 neopakovatelny klic nema typ udalosti', typUdalostiZnovu('videokurz') === '');

check('C10 stav je "neznamo" jen u opakovatelneho a NE-noveho nakupu',
  stavOpakovanehoNakupu('konzultace', false) === 'neznamo'
  && stavOpakovanehoNakupu('konzultace', true) === 'netyka-se'
  && stavOpakovanehoNakupu('videokurz', false) === 'netyka-se');

check('C11 kazdy opakovatelny KLIC ma protejsek v seznamu PRODUKTU',
  OPAKOVATELNE_KLICE.every((k) =>
    OPAKOVATELNE_PRODUKTY.some((p) => k === p || k.startsWith(p + '-'))),
  OPAKOVATELNE_KLICE.join(',') + ' vs ' + OPAKOVATELNE_PRODUKTY.join(','));
check('C12 jeOpakovatelnyProdukt sedi se seznamem',
  jeOpakovatelnyProdukt('konzultace') && jeOpakovatelnyProdukt('balicek')
  && !jeOpakovatelnyProdukt('academy'));

// --- 2) KATALOG V `index.ts` ODPOVIDA SEZNAMU -------------------------------
// Vytazeni `"klic": { ... produkt: "x" ... }` z KATALOGu textem, at se seznam
// v `opakovany-nakup.ts` nemuze tise rozejit s katalogem (tataz trida chyby,
// kterou hlida `katalog-konzistence.test.ts`).
for (const klic of OPAKOVATELNE_KLICE) {
  const m = new RegExp('"' + klic + '":\\s*\\{[\\s\\S]{0,400}?produkt:\\s*"([a-z-]+)"').exec(zdroj);
  check('K1 KATALOG zna klic ' + klic, !!m, m ? m[1] : 'nenalezen');
  if (m) {
    check('K2 produkt klice ' + klic + ' je v OPAKOVATELNE_PRODUKTY',
      jeOpakovatelnyProdukt(m[1]), m[1]);
  }
}

// --- 3) `index.ts` TU OPRAVU OPRAVDU MA (kontrastni cast) -------------------
check('OK1 vetev opakovaneho nakupu uz nestoji na `klic === "balicek"`',
  /if \(jeOpakovatelnyKlic\(klic\) && !novyDozivotni\) \{/.test(zdroj)
  && !/if \(klic === "balicek" && !novyDozivotni\) \{/.test(zdroj));
check('OK2 stav se pocita pres cistou funkci, ne inline',
  /let opakovanyNakup = stavOpakovanehoNakupu\(klic, novyDozivotni\);/.test(zdroj));
check('OK3 alert "zvaz vraceni" je podmineny produktem',
  /if \(bylDozivotni && maHlasitZvazVraceni\(def\.produkt\)\) \{/.test(zdroj));
check('OK4 typ udalosti pro dedup se bere z ciste funkce',
  /const typZnovu = typUdalostiZnovu\(klic\);/.test(zdroj)
  && /\.eq\("type", typZnovu\)/.test(zdroj));
check('OK5 odpoved webhooku hlasi `opakovany_nakup`',
  /opakovany_nakup: opakovanyNakup/.test(zdroj));

check('NA1 druha konzultace dostane doklad', (() => {
  const i = zdroj.indexOf('} else if (klic !== "balicek") {');
  const j = zdroj.indexOf('} else {', i);
  return i > 0 && j > i && /doklad = await posliDoklad\(emailL, obj, def\);/.test(zdroj.slice(i, j));
})());
check('NA2 druha konzultace dostane alert "domluv termin"', (() => {
  const i = zdroj.indexOf('} else if (klic !== "balicek") {');
  const j = zdroj.indexOf('} else {', i);
  return i > 0 && j > i && /def\.alertPoNakupu \+ " \(OPAKOVANÝ NÁKUP\)"/.test(zdroj.slice(i, j));
})());
check('NA3 druha konzultace se zapise do CRM tymz kodem jako prvni', (() => {
  const vyskyty = (zdroj.match(/await zapisKonzultaciDoCrm\(emailL, def\.source\)/g) ?? []).length;
  return vyskyty === 2;
})(), String((zdroj.match(/await zapisKonzultaciDoCrm\(/g) ?? []).length));

check('NA4 posliUvitani se ve vetvi opakovaneho nakupu NEVOLA (drip by mail preskocil)', (() => {
  const i = zdroj.indexOf('} else if (klic !== "balicek") {');
  const j = zdroj.indexOf('return json({', i);
  return i > 0 && j > i && !/await posliUvitani\(/.test(zdroj.slice(i, j));
})());
check('NA5 v mailu druhe konzultace neni dlouha pomlcka ani cena', (() => {
  const i = zdroj.indexOf('Konzultace je zaplacená, ozvu se ti s termínem');
  const j = zdroj.indexOf('</div>`,', i);
  // ⚠️ Dlouha pomlcka i cena jsou tu psane escapem, ne primo: soubor sam
  //    NESMI obsahovat znak, ktery hlida. Fallback je zamerne 'spatny', aby
  //    kontrola padla i tehdy, kdyz se predmet mailu v `index.ts` prejmenuje.
  const POMLCKA = String.fromCharCode(0x2014);
  const telo = i > 0 ? zdroj.slice(i, j) : 'x' + POMLCKA + 'x 2 990 Kč';
  return !telo.includes(POMLCKA) && !/\d[\d\s]*Kč/.test(telo);
})());

// --- 4) S-4 (revize R1): alert u OPAKOVANEHO nakupu nesmi slibovat branu, ktera nedrzi
// U prvniho nakupu je `consultation_calls.termin_at` NULL a brana drzi. U opakovaneho
// je tam termin z PREDCHOZIHO hovoru, tedy v minulosti, takze brana je OTEVRENA.
{
  const i = zdroj.indexOf('} else if (klic !== "balicek") {');
  const j = zdroj.indexOf('return json({', i);
  const vetev = i > 0 && j > i ? zdroj.slice(i, j) : '';
  check('S4a alert u opakovaneho nakupu uz NEtvrdi, ze se prodejni maily neposilaji',
    vetev !== '' && !vetev.includes('prodejní maily na koučink se mu neposílají'));
  check('S4b alert misto toho rika, ze brana je OTEVRENA a jak se zavre',
    /brána prodejních/.test(vetev) && /OTEVŘENÁ/.test(vetev)
    && /Zadáním nového termínu se zase zavře/.test(vetev));
  check('S4c termin se z webhooku NEPREPISUJE (jediny zapisovatel je admin-api)',
    !/consultation_calls/.test(vetev) || /ZÁMĚRNĚ NEVYNULOVÁVÁ/.test(zdroj));
}

const failures = cases.filter((c) => !c.pass).length;
for (const c of cases) console.log(`${c.pass ? '  ok' : 'FAIL'}  ${c.name}${c.pass ? '' : '  -> ' + c.detail}`);
console.log(`\n${cases.length - failures}/${cases.length} proslo  (index: ${WEBHOOK})`);
if (failures > 0) Deno.exit(1);
