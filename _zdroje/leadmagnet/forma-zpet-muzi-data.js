// Jídelníček pánského lead magnetu „Muž 35+: dostat formu zpátky" (download/forma-zpet-muzi.pdf).
//
// ⛔ ČÍSLA SEM NEPIŠ RUKOU. Tady jsou jen potraviny (id z assets/food-db.json nebo
// z makro-plan-extra-potraviny.js) a výchozí gramáže. Kcal a makra počítá makro-plan-core.js
// (MealGen.macrosFor, tatáž funkce jako webový generátor jídelníčků), gramáže rolí P, C a T
// dorovná na denní cíl. Spuštění: node _zdroje/leadmagnet/build-forma-zpet-muzi.js
//
// Původ:
// - Jídla a výchozí gramáže = Martinův obsah z Drive „MUZI_DETAILNI.pdf", tedy to, co bylo v PDF
//   od 9. 7. 2026 (commit 1336dfd70). Makra tam byla psaná ručně a s databází nesouhlasila.
// - Přepočet 25. 9. 2026 (agent 79. šéfa, Martin: „pánský plán přepočítat stejně"):
//   obecná slova nahrazena konkrétní potravinou, aby šla spočítat: „ořechy" = vlašské ořechy,
//   „ovoce" = jahody nebo borůvky, „zelenina" = mražená zeleninová směs nebo brokolice,
//   „velký salát" = ledový salát + okurka + rajče, „sýr" = eidam 30 %, „pečivo" = grahamový rohlík,
//   „ryba (treska/losos)" = treska, „krabička" = kuřecí prsa + vařená rýže + olej z vaření,
//   „řecký jogurt" = 0 % (DB má pro 5 % dvě rozporné položky), „tvaroh" = nízkotučný,
//   „toast" = bílý toastový chléb, „hranolky z trouby" = mražené hranolky pečené v troubě.
//   Přidaný tuk tam, kde den bez něj nedosáhl tuku z cíle: úterý olej na hovězí a ořechy ke svačině,
//   čtvrtek a neděle olej na pánev, středa olej v krabičce.
//   Sobotní volnější večeře je konkrétní (pizza a pivo), ať jde spočítat.
//
// role: 'P' = hlavní bílkovina, 'C' = hlavní příloha, 'T' = přidaný tuk; tyhle tři se dorovnávají.
//       'F' = pevná položka (nemění se).
// txt: 2. pád za gramáží. kus: [gramů na kus, '1 …', '2-4 …', '5+ …', ukázat gramy?].
// og: krátký název jídla pro náhled týdne na stránce a pro OG obrázek.

const VEJCE = [60, 'vejce', 'vejce', 'vajec', false];
const BANAN = [120, 'banán', 'banány', 'banánů'];
const SALAT = [
  ['ledovy-salat', 100, 'F', 'ledového salátu'],
  ['okurka', 100, 'F', 'okurky'],
  ['rajce', 100, 'F', 'rajčat'],
];

module.exports = {
  // Referenční muž: 40 let, 180 cm, 90 kg, lehká aktivita, mírné hubnutí (engine 2 021 kcal).
  REF: { sex: 'muz', age: 40, height: 180, weight: 90, activity: 'lehka', goal: 'mirne_hubnuti' },
  // Stránka forma-zpet i OG obrázek slibují 2 000 kcal.
  KCAL_CIL: 2000,
  // Tuk na kg referenční váhy (Martin 25. 9. 2026: 0,7, stejně jako ženský plán).
  TUK_G_NA_KG: 0.7,

  DAYS: [
    { name: 'Pondělí', tag: 'tréninkový den', meals: [
      { lbl: 'Snídaně', title: 'Míchaná vejce s chlebem a avokádem', og: 'Vejce s avokádem', items: [
        ['vejce', 180, 'F', 'vajec', null, VEJCE],
        ['chleb-celozrnny', 80, 'C', 'celozrnného chleba'],
        ['avokado', 70, 'T', 'avokáda'],
      ]},
      { lbl: 'Svačina', title: 'Skyr, banán a ořechy', items: [
        ['skyr', 250, 'F', 'skyru'],
        ['banan', 120, 'F', 'banánu', null, BANAN],
        ['vlasske-orechy', 30, 'T', 'vlašských ořechů'],
      ]},
      { lbl: 'Oběd', title: 'Kuřecí s rýží a zeleninou', og: 'Kuřecí s rýží', items: [
        ['kureci-prsa', 150, 'P', 'kuřecích prsou'],
        ['ryze-bila', 80, 'C', 'rýže'],
        ['mrazena-zeleninova-smes', 200, 'F', 'zeleninové směsi'],
        ['repkovy-olej', 10, 'T', 'oleje'],
      ]},
      { lbl: 'Večeře', title: 'Losos s bramborem a velkým salátem', og: 'Losos s bramborem', items: [
        ['losos', 150, 'F', 'lososa'],
        ['brambory', 250, 'C', 'brambor'],
        ...SALAT,
      ]},
    ]},
    { name: 'Úterý', tag: '', meals: [
      { lbl: 'Snídaně', title: 'Ovesná kaše s proteinem a banánem', og: 'Ovesná kaše', items: [
        ['ovesne-vlocky', 70, 'C', 'ovesných vloček'],
        ['syrovatkovy-protein', 30, 'F', 'syrovátkového proteinu'],
        ['mleko-polotucne', 250, 'F', 'polotučného mléka', 'ml'],
        ['banan', 120, 'F', 'banánu', null, BANAN],
      ]},
      { lbl: 'Svačina', title: 'Tvaroh s ovocem a ořechy', items: [
        ['tvaroh-mekky-nizkotucny', 200, 'F', 'nízkotučného tvarohu'],
        ['jahody', 100, 'F', 'jahod'],
        ['vlasske-orechy', 15, 'T', 'vlašských ořechů'],
      ]},
      { lbl: 'Oběd', title: 'Libové hovězí s bramborem a zeleninou', og: 'Hovězí', items: [
        ['hovezi-steak-libovy', 150, 'P', 'libového hovězího'],
        ['brambory', 300, 'C', 'brambor'],
        ['mrazena-zeleninova-smes', 200, 'F', 'zeleninové směsi'],
        ['repkovy-olej', 10, 'T', 'oleje na pánev'],
      ]},
      { lbl: 'Večeře', title: 'Kuřecí s celozrnnými těstovinami a zeleninou', og: 'Kuřecí s těstovinami', items: [
        ['kureci-prsa', 150, 'P', 'kuřecích prsou'],
        ['testoviny-celozrnne', 70, 'C', 'celozrnných těstovin'],
        ['brokolice', 200, 'F', 'brokolice'],
        ['olivovy-olej', 5, 'T', 'olivového oleje'],
      ]},
    ]},
    { name: 'Středa', tag: 'den s krabičkou', meals: [
      { lbl: 'Snídaně', title: 'Řecký jogurt s granolou, ovocem a ořechy', og: 'Jogurt s granolou', items: [
        ['recky-jogurt-0', 250, 'F', 'řeckého jogurtu 0 %'],
        ['granola-bez-pridaneho-cukru', 50, 'C', 'granoly bez přidaného cukru'],
        ['boruvky', 100, 'F', 'borůvek'],
        ['vlasske-orechy', 20, 'T', 'vlašských ořechů'],
      ]},
      { lbl: 'Svačina', title: 'Proteinový shake a pečivo', items: [
        ['syrovatkovy-protein', 30, 'F', 'proteinu'],
        ['grahamovy-rohlik', 60, 'F', 'grahamového rohlíku', null, [60, 'grahamový rohlík', 'grahamové rohlíky', 'grahamových rohlíků']],
      ]},
      { lbl: 'Oběd', title: 'Krabička z práce', og: 'Krabička z práce', pozn: 'Když vybíráš v jídelně: maso + příloha + zelenina, vyber rozumně.', items: [
        ['kureci-prsa', 150, 'P', 'kuřecích prsou'],
        ['ryze-bila-varena', 200, 'C', 'vařené rýže'],
        ['mrazena-zeleninova-smes', 150, 'F', 'zeleniny'],
        ['repkovy-olej', 10, 'T', 'oleje z vaření'],
      ]},
      { lbl: 'Večeře', title: 'Krůtí s batáty a brokolicí', og: 'Krůtí s batáty', items: [
        ['kruti-prsa', 150, 'P', 'krůtích prsou'],
        ['bataty', 250, 'C', 'batátů'],
        ['brokolice', 200, 'F', 'brokolice'],
      ]},
    ]},
    { name: 'Čtvrtek', tag: 'tréninkový den', meals: [
      { lbl: 'Snídaně', title: 'Omeleta ze 4 vajec se sýrem a chlebem', og: 'Omeleta', items: [
        ['vejce', 240, 'F', 'vajec', null, VEJCE],
        ['eidam-30', 50, 'F', 'eidamu 30 %'],
        ['repkovy-olej', 5, 'T', 'oleje na pánev'],
        ['chleb-celozrnny', 80, 'C', 'celozrnného chleba'],
      ]},
      { lbl: 'Svačina', title: 'Skyr s ovesnými vločkami a ovocem', items: [
        ['skyr', 200, 'F', 'skyru'],
        ['ovesne-vlocky', 60, 'C', 'ovesných vloček'],
        ['jahody', 100, 'F', 'jahod'],
      ]},
      { lbl: 'Oběd', title: 'Hovězí steak s bramborem a zeleninou', og: 'Hovězí steak', items: [
        ['hovezi-steak-libovy', 180, 'P', 'libového hovězího steaku'],
        ['brambory', 250, 'C', 'brambor'],
        ['mrazena-zeleninova-smes', 200, 'F', 'zeleninové směsi'],
      ]},
      { lbl: 'Večeře', title: 'Ryba s rýží a salátem', og: 'Ryba s rýží', items: [
        ['treska', 150, 'P', 'tresky'],
        ['ryze-bila', 80, 'C', 'rýže'],
        ['repkovy-olej', 10, 'T', 'oleje'],
        ['ledovy-salat', 100, 'F', 'ledového salátu'],
        ['okurka', 100, 'F', 'okurky'],
      ]},
    ]},
    { name: 'Pátek', tag: '', meals: [
      { lbl: 'Snídaně', title: 'Toasty s vejci, avokádem a rajčetem', og: 'Toasty s vejci', items: [
        ['toastovy-chleb-bily', 50, 'F', 'toastového chleba', null, [25, 'toast', 'toasty', 'toastů']],
        ['vejce', 180, 'F', 'vajec', null, VEJCE],
        ['avokado', 70, 'T', 'avokáda'],
        ['rajce', 100, 'F', 'rajčete'],
      ]},
      { lbl: 'Svačina', title: 'Cottage s ovocem a ořechy', items: [
        ['cottage-syr', 250, 'F', 'cottage'],
        ['boruvky', 100, 'F', 'borůvek'],
        ['vlasske-orechy', 20, 'T', 'vlašských ořechů'],
      ]},
      { lbl: 'Oběd', title: '„Fit burger" s hranolky z trouby', og: 'Fit burger', items: [
        ['hovezi-mlete-10-tuku', 150, 'F', 'mletého hovězího (10 % tuku)'],
        ['houska-celozrnna', 60, 'F', 'celozrnné housky', null, [60, 'celozrnná houska', 'celozrnné housky', 'celozrnných housek']],
        ['ledovy-salat', 50, 'F', 'ledového salátu'],
        ['rajce', 50, 'F', 'rajčete'],
        ['mrazene-hranolky', 100, 'C', 'hranolek z trouby'],
      ]},
      { lbl: 'Večeře', title: 'Kuřecí s bramborem a brokolicí', og: 'Kuřecí s bramborem', items: [
        ['kureci-prsa', 150, 'P', 'kuřecích prsou'],
        ['brambory', 200, 'C', 'brambor'],
        ['brokolice', 200, 'F', 'brokolice'],
      ]},
    ]},
    // Flex den: pizza a pivo jsou pevné, dorovnávají se jen kcal přes vločky (bílkoviny drží
    // tvaroh, kuřecí a shake, tuk je ten den volný).
    { name: 'Sobota', tag: 'flex den', flex: true, volnyTuk: true, jenKcal: 'C', meals: [
      { lbl: 'Snídaně', title: 'Tvaroh s ovesnými vločkami, ovocem a medem', og: 'Tvaroh s vločkami', items: [
        ['tvaroh-mekky-nizkotucny', 250, 'F', 'nízkotučného tvarohu'],
        ['ovesne-vlocky', 50, 'C', 'ovesných vloček'],
        ['jahody', 100, 'F', 'jahod'],
        ['med', 10, 'F', 'medu'],
      ]},
      { lbl: 'Oběd', title: 'Velký kuřecí salát s pečivem', og: 'Kuřecí salát', items: [
        ['kureci-prsa', 200, 'F', 'kuřecích prsou'],
        ...SALAT,
        ['olivovy-olej', 10, 'F', 'olivového oleje'],
        ['grahamovy-rohlik', 60, 'F', 'grahamového rohlíku', null, [60, 'grahamový rohlík', 'grahamové rohlíky', 'grahamových rohlíků']],
      ]},
      { lbl: 'Večeře', title: 'Volnější večeře, pizza a pivo', og: 'Pizza a pivo', pozn: 'Užij si to bez výčitek a drž bílkoviny.', items: [
        ['pizza-margherita', 300, 'F', 'pizzy margherita'],
        ['pivo-12', 500, 'F', 'piva 12°', 'ml', [500, 'velké pivo', 'velká piva', 'velkých piv']],
      ]},
      { lbl: 'Svačina', title: 'Proteinový shake', items: [
        ['syrovatkovy-protein', 30, 'F', 'proteinu (s vodou)'],
      ]},
    ]},
    { name: 'Neděle', tag: '', meals: [
      { lbl: 'Snídaně', title: 'Omeleta ze 4 vajec se zeleninou a chlebem', og: 'Omeleta', items: [
        ['vejce', 240, 'F', 'vajec', null, VEJCE],
        ['paprika-cervena', 100, 'F', 'papriky'],
        ['repkovy-olej', 5, 'T', 'oleje na pánev'],
        ['chleb-celozrnny', 80, 'C', 'celozrnného chleba'],
      ]},
      { lbl: 'Svačina', title: 'Proteinový shake a banán', items: [
        ['syrovatkovy-protein', 30, 'F', 'proteinu (s vodou)'],
        ['banan', 120, 'F', 'banánu', null, BANAN],
      ]},
      { lbl: 'Oběd', title: 'Pečené kuře s bramborem a zeleninou', og: 'Pečené kuře', items: [
        ['kureci-prsa', 180, 'P', 'kuřecích prsou'],
        ['brambory', 250, 'C', 'brambor'],
        ['repkovy-olej', 10, 'T', 'oleje na pečení'],
        ['mrazena-zeleninova-smes', 200, 'F', 'zeleninové směsi'],
      ]},
      { lbl: 'Večeře', title: 'Krůtí s rýží a velkým salátem', og: 'Krůtí s rýží', items: [
        ['kruti-prsa', 150, 'P', 'krůtích prsou'],
        ['ryze-bila', 70, 'C', 'rýže'],
        ...SALAT,
      ]},
    ]},
  ],

  // ---- výstup ---------------------------------------------------------------------------------
  SKRIPT: 'build-forma-zpet-muzi.js',
  SABLONA: 'forma-zpet-muzi.sablona.html',
  VYSTUP: 'forma-zpet-muzi', // → forma-zpet-muzi.html (pro PDF) a forma-zpet-muzi-vypocet.json
  STRANKA: 'forma-zpet/index.html',
  ZNACKA: 'PLAN-MUZI',
  DNY_BLOKY: (plan, dayHtml) => ({
    '{{DNY_1_3}}': plan.slice(0, 3).map((d, i) => dayHtml(d, i)).join('\n'),
    '{{DNY_4_6}}': plan.slice(3, 6).map((d, i) => dayHtml(d, i + 3)).join('\n'),
    '{{DEN_7}}': dayHtml(plan[6], 6),
  }),
  // „Potřebuješ míň": vynech přidané tuky (olej, ořechy, avokádo).
  MINUS_TUK: /olej|orech|avokado/,
  NAHRADY: ({ mac, ekv, median, porceC }) => {
    const RYZE_TYP = median(porceC['ryze-bila']);
    // „Potřebuješ víc": 50 g rýže, 200 g brambor nebo 2 krajíce chleba (80 g) a jablko.
    const pr = [mac('ryze-bila', 50).kcal, mac('brambory', 200).kcal, mac('chleb-celozrnny', 80).kcal];
    const PJ = mac('jablko', 150).kcal;
    return {
      '{{RYZE_TYP}}': String(RYZE_TYP),
      '{{PLUS_MIN}}': String(Math.round((Math.min(...pr) + PJ) / 10) * 10),
      '{{PLUS_MAX}}': String(Math.round((Math.max(...pr) + PJ) / 10) * 10),
      '{{EKV_BRAMBORY}}': String(ekv('ryze-bila', RYZE_TYP, 'brambory', 10)), '{{EKV_BATATY}}': String(ekv('ryze-bila', RYZE_TYP, 'bataty', 10)),
      '{{EKV_TESTOVINY}}': String(ekv('ryze-bila', RYZE_TYP, 'testoviny-celozrnne', 5)), '{{EKV_KUSKUS}}': String(ekv('ryze-bila', RYZE_TYP, 'kuskus', 5)),
      '{{EKV_CHLEB}}': String(ekv('ryze-bila', RYZE_TYP, 'chleb-celozrnny', 10)),
      '{{EKV_AVOKADO}}': String(ekv('vlasske-orechy', 30, 'avokado', 10)), '{{EKV_OLEJ}}': String(ekv('vlasske-orechy', 30, 'olivovy-olej', 5)),
      '{{EKV_ARASID}}': String(ekv('vlasske-orechy', 30, 'araside-maslo', 5)),
    };
  },
  // Poznámka pod ukázkovým dnem na stránce forma-zpet.
  ZNACKA_POZNAMKA: ({ plan, cz, r0 }) => '        <p class="note">Ukázka jednoho dne (~' + cz(r0(plan[0].tot.kcal / 10) * 10)
    + ' kcal). Přesná čísla na sebe si spočítáš v kalkulačce, odkaz dostaneš v e-mailu.</p>',

  // ---- nákupní seznam ---------------------------------------------------------------------------
  NAKUP_SKUPINY: [
    ['Bílkoviny', ['kureci-prsa', 'kruti-prsa', 'hovezi-steak-libovy', 'hovezi-mlete-10-tuku', 'losos', 'treska', 'vejce', 'syrovatkovy-protein']],
    ['Mléčné', ['skyr', 'tvaroh-mekky-nizkotucny', 'recky-jogurt-0', 'cottage-syr', 'mleko-polotucne', 'eidam-30']],
    ['Sacharidy', ['ovesne-vlocky', 'granola-bez-pridaneho-cukru', 'ryze-bila', 'ryze-bila-varena', 'brambory', 'bataty', 'testoviny-celozrnne', 'chleb-celozrnny', 'toastovy-chleb-bily', 'grahamovy-rohlik', 'houska-celozrnna', 'mrazene-hranolky', 'pizza-margherita']],
    ['Tuky · zelenina · ovoce · pití', ['vlasske-orechy', 'avokado', 'repkovy-olej', 'olivovy-olej', 'med', 'mrazena-zeleninova-smes', 'brokolice', 'ledovy-salat', 'okurka', 'rajce', 'paprika-cervena', 'boruvky', 'jahody', 'banan', 'pivo-12']],
  ],
  NAKUP_NAZEV: {
    'kureci-prsa': 'Kuřecí prsa', 'kruti-prsa': 'Krůtí prsa', 'hovezi-steak-libovy': 'Libové hovězí / steak', 'hovezi-mlete-10-tuku': 'Mleté hovězí (10 % tuku)',
    losos: 'Losos', treska: 'Treska', vejce: 'Vejce', 'syrovatkovy-protein': 'Syrovátkový protein',
    skyr: 'Skyr bílý', 'tvaroh-mekky-nizkotucny': 'Tvaroh nízkotučný', 'recky-jogurt-0': 'Řecký jogurt 0 %', 'cottage-syr': 'Cottage',
    'mleko-polotucne': 'Polotučné mléko', 'eidam-30': 'Eidam 30 %',
    'ovesne-vlocky': 'Ovesné vločky', 'granola-bez-pridaneho-cukru': 'Granola bez přidaného cukru', 'ryze-bila': 'Rýže',
    'ryze-bila-varena': 'Rýže do krabičky (vařená)', brambory: 'Brambory', bataty: 'Batáty', 'testoviny-celozrnne': 'Celozrnné těstoviny',
    'chleb-celozrnny': 'Celozrnný chléb', 'toastovy-chleb-bily': 'Toastový chléb', 'grahamovy-rohlik': 'Grahamový rohlík',
    'houska-celozrnna': 'Celozrnná houska', 'mrazene-hranolky': 'Mražené hranolky do trouby', 'pizza-margherita': 'Pizza margherita',
    'vlasske-orechy': 'Vlašské ořechy', avokado: 'Avokádo', 'repkovy-olej': 'Řepkový olej', 'olivovy-olej': 'Olivový olej', med: 'Med',
    'mrazena-zeleninova-smes': 'Mražená zeleninová směs', brokolice: 'Brokolice', 'ledovy-salat': 'Ledový salát', okurka: 'Okurka',
    rajce: 'Rajčata', 'paprika-cervena': 'Paprika červená', boruvky: 'Borůvky', jahody: 'Jahody', banan: 'Banán', 'pivo-12': 'Pivo 12°',
  },
  NAKUP_KUS: { vejce: [60, 'ks'], banan: [120, 'ks'], 'grahamovy-rohlik': [60, 'ks'], 'houska-celozrnna': [60, 'ks'], avokado: [140, 'ks'], 'pizza-margherita': [300, 'ks'] },
  NAKUP_ML: ['mleko-polotucne', 'pivo-12'],
};
