// Jídelníček ženského lead magnetu „7denní makro plán pro ženy 30+" (download/makro-plan-zeny.pdf).
//
// ⛔ ČÍSLA SEM NEPIŠ RUKOU. Tady jsou jen potraviny (id z assets/food-db.json nebo
// z makro-plan-extra-potraviny.js) a výchozí gramáže. Kcal a makra počítá makro-plan-core.js funkcí
// MealGen.macrosFor (tatáž, kterou počítá generátor jídelníčků na webu), gramáže rolí P, C a T
// dorovná na denní cíl deterministicky. Spuštění: node _zdroje/leadmagnet/build-makro-plan-zeny.js
//
// Původ:
// - Jídla (co se jí který den) = Martinův obsah z Drive „7denni_Makro_Plan_Detailni", tedy to,
//   co bylo v PDF od 9. 7. 2026 (commit 1336dfd70), jen bez porcí.
// - Výchozí gramáže = Martinem potvrzený plán z června 2026 (plan/build_plans.py, commit 8320551e0).
//   Kde tam gramáž chyběla („+ zelenina", „velký salát"), bere se výchozí porce potraviny z food-db.
// - 25. 9. 2026 večer: tuk v % kcal (TUK_PCT_KCAL), pozice 25 až 35 % v každém dni každé varianty;
//   sobotní olej na salát 10 → 20 g (sobota měla 22,6 % tuku) a varianta „víc" se na flex sobotu
//   nevztahuje (text PDF). Předtím:
// - Martin 25. 9. 2026: tuk 0,6 g/kg (kolo 3; kolo 2 mělo 0,7, kolo 1 0,8), ať jsou větší přílohy; čtvrteční proteinová tyčinka
//   a sobotní pizza zpět (obě jsou v databázi appky, hodnoty a jejich ověření v extra souboru).
// - Odchylky od Martinova menu a od června (25. 9. 2026, agent 78. šéfa): sobotní flex den má
//   konkrétní snídani a oběd jako pánský flex den (tvaroh + vločky, kuřecí salát);
//   páteční jogurt → proteinový (200 g) a mleté hovězí 10 % → 5 % (den měl moc tuku a málo bílkovin);
//   kolo 3: v pátek 2 vejce, losos pevně 120 g a bílkoviny dorovná i proteinový jogurt (tuk dne);
//   losos v pondělí a čtvrtek pevně 120 g (tučná ryba; bílkoviny dorovná libové maso, zbyde víc na přílohu);
//   olej na pánev/na pečení (Út, St, Ne) a mandle do středeční snídaně (bez nich den nedosáhl
//   tuku z cíle); řecký jogurt 0 % místo „do 5 %" (DB má pro 5 % dvě rozporné položky).
//
// role: 'P' = hlavní bílkovina, 'C' = hlavní příloha, 'T' = přidaný tuk (olej, ořechy, avokádo, hummus);
//       tyhle tři se dorovnávají. 'F' = pevná položka (nemění se).
// txt: 2. pád za gramáží („50 g ovesných vloček"). kus: [gramů na kus, '1 …', '2-4 …', '5+ …', ukázat gramy?].
// og: krátký název jídla pro náhled týdne na stránce a pro OG obrázek.

module.exports = {
  // Referenční žena pro kalkulačku (stejná logika jako pánský plán: průměrná postava,
  // lehká aktivita, mírné hubnutí). Pánský plán ~2 000 kcal odpovídá tomu, co engine dá muži
  // 40 let, 180 cm, 90 kg, lehká aktivita, mírné hubnutí (2 021 kcal, B 162, S 181, T 72).
  REF: { sex: 'zena', age: 38, height: 166, weight: 72, activity: 'lehka', goal: 'mirne_hubnuti' },
  // Stránka makro-plan i OG obrázek slibují 1 500 kcal. Engine dá referenční ženě 1 538 kcal.
  KCAL_CIL: 1500,
  // Tuk dne v % kcal cíle. ⭐ [25. 9. 2026 večer] Martinova pozice: tuk 25 až 35 % kcal v KAŽDÉM
  // dni KAŽDÉ varianty (základ, „míň", „víc"), nikdy pod 20 %. Dřív 0,6 g/kg (≈ 43 g, 25,8 %, Martin
  // 25. 9. ráno, „ať jsou větší přílohy"): základ stál na spodní hraně a „víc" (+ rýže/vločky
  // a jablko) spadlo pod 25 %, sobota na 19,95 %. Změřeno 25. 9.: všemi variantami projde 29 i 30,
  // 28 ne („víc" pod 25 %), 31 ne (neděle „míň" 35,3 %). 30 = totéž jako engine appky i webu
  // a víc rezervy pro „víc" (nejnižší 26,1 % proti 25,1 % při 29). Build hlídá a jinak spadne.
  TUK_PCT_KCAL: 30,
  // „Potřebuješ víc" (text PDF): +40 g rýže nebo ovesných vloček a jedno jablko.
  // Build z těchhle kombinací počítá tuk v % kcal každého dne i text {{PLUS_MIN}}.
  PLUS_VARIANTY: [
    ['40 g rýže + jablko', [{ id: 'ryze-bila', g: 40 }, { id: 'jablko', g: 150 }]],
    ['40 g vloček + jablko', [{ id: 'ovesne-vlocky', g: 40 }, { id: 'jablko', g: 150 }]],
  ],

  DAYS: [
    { name: 'Pondělí', tag: 'tréninkový den', meals: [
      { lbl: 'Snídaně', title: 'Ovesná kaše s proteinem a borůvkami', og: 'Ovesná kaše', items: [
        ['ovesne-vlocky', 50, 'C', 'ovesných vloček'],
        ['syrovatkovy-protein', 25, 'F', 'syrovátkového proteinu'],
        ['mleko-polotucne', 150, 'F', 'polotučného mléka', 'ml'],
        ['boruvky', 100, 'F', 'borůvek'],
      ]},
      { lbl: 'Svačina', title: 'Řecký jogurt s mandlemi', items: [
        ['recky-jogurt-0', 150, 'F', 'řeckého jogurtu 0 %'],
        ['mandle', 15, 'T', 'mandlí'],
      ]},
      { lbl: 'Oběd', title: 'Kuřecí stir-fry s rýží a zeleninou', og: 'Kuřecí stir-fry', items: [
        ['kureci-prsa', 130, 'P', 'kuřecích prsou'],
        ['ryze-bila', 60, 'C', 'rýže'],
        ['mrazena-zeleninova-smes', 200, 'F', 'zeleninové směsi'],
        ['repkovy-olej', 5, 'T', 'oleje'],
      ]},
      { lbl: 'Večeře', title: 'Losos s batáty a brokolicí', og: 'Losos s batáty', items: [
        ['losos', 120, 'F', 'lososa'],
        ['bataty', 150, 'C', 'batátů'],
        ['brokolice', 150, 'F', 'brokolice'],
      ]},
    ]},
    { name: 'Úterý', tag: '', meals: [
      { lbl: 'Snídaně', title: 'Omeleta se špenátem a sýrem, k tomu chléb', og: 'Omeleta', items: [
        ['vejce', 180, 'F', 'vajec', null, [60, 'vejce', 'vejce', 'vajec', false]],
        ['spenat', 50, 'F', 'špenátu'],
        ['eidam-30', 20, 'F', 'eidamu 30 %'],
        ['repkovy-olej', 5, 'T', 'oleje na pánev'],
        ['chleb-celozrnny', 40, 'C', 'celozrnného chleba'],
      ]},
      { lbl: 'Svačina', title: 'Proteinový shake a banán', items: [
        ['syrovatkovy-protein', 30, 'F', 'proteinu (s vodou)'],
        ['banan', 120, 'F', 'banánu', null, [120, 'banán', 'banány', 'banánů']],
      ]},
      { lbl: 'Oběd', title: 'Quinoa salát s tuňákem a avokádem', og: 'Quinoa s tuňákem', items: [
        ['tunak-vlastni-stava', 100, 'P', 'tuňáka ve vlastní šťávě'],
        ['quinoa', 60, 'C', 'quinoy'],
        ['avokado', 70, 'T', 'avokáda'],
        ['ledovy-salat', 80, 'F', 'ledového salátu'],
        ['okurka', 100, 'F', 'okurky'],
      ]},
      { lbl: 'Večeře', title: 'Hovězí na zelenině s brambory', og: 'Hovězí s bramborem', items: [
        ['hovezi-steak-libovy', 120, 'P', 'libového hovězího'],
        ['brambory', 200, 'C', 'brambor'],
        ['mrazena-zeleninova-smes', 150, 'F', 'zeleninové směsi'],
      ]},
    ]},
    { name: 'Středa', tag: '', meals: [
      { lbl: 'Snídaně', title: 'Řecký jogurt s granolou, jahodami a mandlemi', og: 'Jogurt s granolou', items: [
        ['recky-jogurt-0', 200, 'F', 'řeckého jogurtu 0 %'],
        ['granola-bez-pridaneho-cukru', 30, 'C', 'granoly bez přidaného cukru'],
        ['jahody', 100, 'F', 'jahod'],
        ['mandle', 10, 'T', 'mandlí'],
      ]},
      { lbl: 'Svačina', title: 'Cottage s jablkem', items: [
        ['cottage-syr', 150, 'F', 'cottage'],
        ['jablko', 150, 'F', 'jablka', null, [150, 'jablko', 'jablka', 'jablek']],
      ]},
      { lbl: 'Oběd', title: 'Kuřecí wrap s hummusem a zeleninou', og: 'Kuřecí wrap', items: [
        ['kureci-prsa', 120, 'P', 'kuřecích prsou'],
        ['tortilla-psenicna', 60, 'F', 'tortilly', null, [60, 'tortilla', 'tortilly', 'tortill']],
        ['hummus', 30, 'T', 'hummusu'],
        ['ledovy-salat', 80, 'F', 'ledového salátu'],
      ]},
      { lbl: 'Večeře', title: 'Pečené kuře s batáty a salátem', og: 'Pečené kuře', items: [
        ['kureci-prsa', 150, 'P', 'kuřecích prsou'],
        ['bataty', 150, 'C', 'batátů'],
        ['repkovy-olej', 5, 'T', 'oleje na pečení'],
        ['ledovy-salat', 80, 'F', 'ledového salátu'],
        ['okurka', 100, 'F', 'okurky'],
      ]},
    ]},
    { name: 'Čtvrtek', tag: 'tréninkový den', meals: [
      { lbl: 'Snídaně', title: 'Proteinové palačinky s malinami', og: 'Proteinové palačinky', items: [
        ['vejce', 60, 'F', 'vajec', null, [60, 'vejce', 'vejce', 'vajec', false]],
        ['syrovatkovy-protein', 30, 'F', 'syrovátkového proteinu'],
        ['ovesna-mouka', 40, 'C', 'ovesné mouky'],
        ['maliny', 100, 'F', 'malin'],
      ]},
      { lbl: 'Svačina', title: 'Proteinová tyčinka a mandle', items: [
        ['proteinova-tycinka', 50, 'F', 'proteinové tyčinky', null, [50, 'proteinová tyčinka', 'proteinové tyčinky', 'proteinových tyčinek']],
        ['mandle', 15, 'T', 'mandlí'],
      ]},
      { lbl: 'Oběd', title: 'Lososový salát s quinoou', og: 'Lososový salát', items: [
        ['losos', 120, 'F', 'lososa'],
        ['quinoa', 50, 'C', 'quinoy'],
        ['ledovy-salat', 80, 'F', 'ledového salátu'],
        ['cherry-rajcata', 100, 'F', 'cherry rajčat'],
        ['olivovy-olej', 5, 'T', 'olivového oleje'],
      ]},
      { lbl: 'Večeře', title: 'Krůtí maso s rýží a zeleninou', og: 'Krůtí s rýží', items: [
        ['kruti-prsa', 130, 'P', 'krůtích prsou'],
        ['ryze-bila', 60, 'C', 'rýže'],
        ['mrazena-zeleninova-smes', 150, 'F', 'zeleninové směsi'],
      ]},
    ]},
    { name: 'Pátek', tag: '', meals: [
      { lbl: 'Snídaně', title: 'Vaječná míchanice s avokádem a chlebem', og: 'Míchaná vejce', items: [
        ['vejce', 120, 'F', 'vajec', null, [60, 'vejce', 'vejce', 'vajec', false]],
        ['avokado', 70, 'T', 'avokáda'],
        ['chleb-celozrnny', 40, 'C', 'celozrnného chleba'],
      ]},
      { lbl: 'Svačina', title: 'Proteinový jogurt s jablkem', items: [
        ['proteinovy-jogurt', 200, 'P', 'proteinového jogurtu'],
        ['jablko', 150, 'F', 'jablka', null, [150, 'jablko', 'jablka', 'jablek']],
      ]},
      { lbl: 'Oběd', title: 'Celozrnné těstoviny s mletým masem a rajčatovou omáčkou', og: 'Těstoviny s masem', items: [
        ['hovezi-mlete-5', 120, 'P', 'libového mletého hovězího (5 % tuku)'],
        ['testoviny-celozrnne', 70, 'C', 'celozrnných těstovin'],
        ['passata', 100, 'F', 'passaty'],
        ['paprika-cervena', 100, 'F', 'papriky'],
      ]},
      { lbl: 'Večeře', title: 'Grilovaný losos s batáty a salátem', og: 'Grilovaný losos', items: [
        ['losos', 120, 'F', 'lososa'],
        ['bataty', 150, 'C', 'batátů'],
        ['ledovy-salat', 80, 'F', 'ledového salátu'],
        ['okurka', 100, 'F', 'okurky'],
      ]},
    ]},
    // Flex den: pizza je pevná, kcal dorovnávají vločky (tuk je ten den volný, build hlídá 25 až 35 % kcal).
    // ⭐ [25. 9. 2026 večer] Olej na salát 10 → 20 g: sobota měla 22,6 % tuku, pod pozicí 25 až 35 %.
    // Varianta „víc" se na flex sobotu nevztahuje (text PDF: „Flex sobotu nech, jak je.").
    { name: 'Sobota', tag: 'flex den', flex: true, volnyTuk: true, jenKcal: 'C', meals: [
      { lbl: 'Snídaně', title: 'Tvaroh s ovesnými vločkami a jahodami', og: 'Tvaroh s vločkami', items: [
        ['tvaroh-mekky-nizkotucny', 250, 'F', 'nízkotučného tvarohu'],
        ['ovesne-vlocky', 30, 'C', 'ovesných vloček'],
        ['jahody', 100, 'F', 'jahod'],
      ]},
      { lbl: 'Oběd', title: 'Velký kuřecí salát s rohlíkem', og: 'Kuřecí salát', items: [
        ['kureci-prsa', 160, 'F', 'kuřecích prsou'],
        ['grahamovy-rohlik', 60, 'F', 'grahamového rohlíku', null, [60, 'grahamový rohlík', 'grahamové rohlíky', 'grahamových rohlíků']],
        ['ledovy-salat', 80, 'F', 'ledového salátu'],
        ['cherry-rajcata', 100, 'F', 'cherry rajčat'],
        ['okurka', 100, 'F', 'okurky'],
        ['olivovy-olej', 20, 'F', 'olivového oleje'],
      ]},
      { lbl: 'Svačina', title: 'Proteinový shake', items: [
        ['syrovatkovy-protein', 30, 'F', 'proteinu (s vodou)'],
      ]},
      { lbl: 'Večeře', title: 'Pizza margherita a salát', og: 'Pizza', pozn: 'To je zhruba půlka pizzy z pizzerie. Užij si ji bez výčitek.', items: [
        ['pizza-margherita', 250, 'F', 'pizzy'],
        ['ledovy-salat', 80, 'F', 'ledového salátu'],
        ['cherry-rajcata', 100, 'F', 'cherry rajčat'],
      ]},
    ]},
    { name: 'Neděle', tag: '', meals: [
      { lbl: 'Snídaně', title: 'Omeleta se zeleninou a sýrem', og: 'Omeleta', items: [
        ['vejce', 180, 'F', 'vajec', null, [60, 'vejce', 'vejce', 'vajec', false]],
        ['eidam-30', 30, 'F', 'eidamu 30 %'],
        ['paprika-cervena', 100, 'F', 'papriky'],
        ['repkovy-olej', 5, 'T', 'oleje na pánev'],
      ]},
      { lbl: 'Svačina', title: 'Proteinový pudink', items: [
        ['proteinovy-pudink', 200, 'F', 'proteinového pudinku'],
      ]},
      { lbl: 'Oběd', title: 'Kuřecí polévka a salát s tuňákem', og: 'Polévka a tuňák', items: [
        ['kureci-prsa', 80, 'P', 'kuřecích prsou do polévky'],
        ['mrkev', 100, 'F', 'mrkve'],
        ['testoviny', 20, 'F', 'nudlí'],
        ['tunak-vlastni-stava', 80, 'P', 'tuňáka ve vlastní šťávě'],
        ['ledovy-salat', 80, 'F', 'ledového salátu'],
        ['chleb-celozrnny', 40, 'C', 'celozrnného chleba'],
      ]},
      { lbl: 'Večeře', title: 'Pečené kuře s batáty a brokolicí', og: 'Pečené kuře', items: [
        ['kureci-prsa', 150, 'P', 'kuřecích prsou'],
        ['bataty', 150, 'C', 'batátů'],
        ['repkovy-olej', 5, 'T', 'oleje na pečení'],
        ['brokolice', 150, 'F', 'brokolice'],
      ]},
    ]},
  ],

  // ---- výstup ---------------------------------------------------------------------------------
  SKRIPT: 'build-makro-plan-zeny.js',
  SABLONA: 'makro-plan-zeny.sablona.html',
  VYSTUP: 'makro-plan-zeny', // → makro-plan-zeny.html (pro PDF) a makro-plan-zeny-vypocet.json
  STRANKA: 'makro-plan/index.html',
  ZNACKA: 'PLAN-ZENY',
  DNY_BLOKY: (plan, dayHtml) => ({
    '{{DNY_1_2}}': plan.slice(0, 2).map((d, i) => dayHtml(d, i)).join('\n'),
    '{{DNY_3_5}}': plan.slice(2, 5).map((d, i) => dayHtml(d, i + 2)).join('\n'),
    '{{DEN_6}}': dayHtml(plan[5], 5),
    '{{DEN_7}}': dayHtml(plan[6], 6),
  }),
  // „Potřebuješ míň": vynech mandle (olej zůstává, ať tuk nespadne pod 20 % kcal).
  MINUS_TUK: /mandle/,
  NAHRADY: ({ mac, kcal100, ekv, median, porceC, porceP }) => {
    const RYZE_TYP = median(porceC['ryze-bila']);
    // Tofu má na 100 g asi polovinu bílkovin kuřecích prsou: gramy tofu pro stejné bílkoviny jako typická porce masa.
    const P_TYP = median(porceP);
    const TOFU = Math.round((mac('kureci-prsa', P_TYP).p / mac('tofu', 100).p * 100) / 10) * 10;
    // „Potřebuješ víc": kombinace z PLUS_VARIANTY (+40 g rýže nebo vloček a 1 jablko). Kolik to je, spočítá DB.
    const plus = module.exports.PLUS_VARIANTY.map(([, pr]) => pr.reduce((s, x) => s + mac(x.id, x.g).kcal, 0));
    return {
      '{{RYZE_TYP}}': String(RYZE_TYP),
      '{{PLUS_MIN}}': String(Math.round(Math.min(...plus) / 10) * 10),
      '{{PLUS_MAX}}': String(Math.round(Math.max(...plus) / 10) * 10),
      '{{EKV_BRAMBORY}}': String(ekv('ryze-bila', RYZE_TYP, 'brambory', 10)), '{{EKV_BATATY}}': String(ekv('ryze-bila', RYZE_TYP, 'bataty', 10)),
      '{{EKV_CHLEB}}': String(ekv('ryze-bila', RYZE_TYP, 'chleb-celozrnny', 10)), '{{EKV_KUSKUS}}': String(ekv('ryze-bila', RYZE_TYP, 'kuskus', 5)),
      '{{EKV_OLEJ}}': String(ekv('mandle', 15, 'olivovy-olej', 5)), '{{EKV_AVOKADO}}': String(ekv('mandle', 15, 'avokado', 10)),
      '{{EKV_ARASID}}': String(ekv('mandle', 15, 'araside-maslo', 5)),
      '{{PIZZA_KCAL}}': String(Math.round(kcal100('pizza-margherita'))),
      '{{EKV_TOFU}}': String(TOFU),
      '{{TOFU_NAVIC}}': String(Math.round((mac('tofu', TOFU).kcal - mac('kureci-prsa', P_TYP).kcal) / 10) * 10),
    };
  },

  // ---- nákupní seznam ---------------------------------------------------------------------------
  NAKUP_SKUPINY: [
    ['Bílkoviny', ['kureci-prsa', 'kruti-prsa', 'hovezi-steak-libovy', 'hovezi-mlete-5', 'losos', 'tunak-vlastni-stava', 'vejce', 'syrovatkovy-protein', 'proteinova-tycinka']],
    ['Mléčné', ['recky-jogurt-0', 'proteinovy-jogurt', 'cottage-syr', 'tvaroh-mekky-nizkotucny', 'mleko-polotucne', 'eidam-30', 'proteinovy-pudink']],
    ['Sacharidy', ['ovesne-vlocky', 'ovesna-mouka', 'granola-bez-pridaneho-cukru', 'ryze-bila', 'quinoa', 'testoviny-celozrnne', 'testoviny', 'brambory', 'bataty', 'chleb-celozrnny', 'grahamovy-rohlik', 'tortilla-psenicna', 'pizza-margherita']],
    ['Tuky · zelenina · ovoce', ['mandle', 'avokado', 'hummus', 'repkovy-olej', 'olivovy-olej', 'med', 'mrazena-zeleninova-smes', 'brokolice', 'spenat', 'ledovy-salat', 'okurka', 'cherry-rajcata', 'paprika-cervena', 'mrkev', 'passata', 'boruvky', 'maliny', 'jahody', 'banan', 'jablko']],
  ],
  NAKUP_NAZEV: {
    'kureci-prsa': 'Kuřecí prsa', 'kruti-prsa': 'Krůtí prsa', 'hovezi-steak-libovy': 'Libové hovězí', 'hovezi-mlete-5': 'Mleté hovězí (5 % tuku)',
    losos: 'Losos', 'tunak-vlastni-stava': 'Tuňák ve vlastní šťávě', vejce: 'Vejce', 'syrovatkovy-protein': 'Syrovátkový protein',
    'proteinova-tycinka': 'Proteinová tyčinka',
    'recky-jogurt-0': 'Řecký jogurt 0 %', 'proteinovy-jogurt': 'Proteinový jogurt', 'cottage-syr': 'Cottage',
    'tvaroh-mekky-nizkotucny': 'Tvaroh nízkotučný', 'mleko-polotucne': 'Polotučné mléko', 'eidam-30': 'Eidam 30 %', 'proteinovy-pudink': 'Proteinový pudink',
    'ovesne-vlocky': 'Ovesné vločky', 'ovesna-mouka': 'Ovesná mouka', 'granola-bez-pridaneho-cukru': 'Granola bez přidaného cukru', 'ryze-bila': 'Rýže',
    quinoa: 'Quinoa', 'testoviny-celozrnne': 'Celozrnné těstoviny', testoviny: 'Polévkové nudle', brambory: 'Brambory', bataty: 'Batáty',
    'chleb-celozrnny': 'Celozrnný chléb', 'grahamovy-rohlik': 'Grahamový rohlík', 'tortilla-psenicna': 'Tortilla', 'pizza-margherita': 'Pizza margherita',
    mandle: 'Mandle', avokado: 'Avokádo', hummus: 'Hummus', 'repkovy-olej': 'Řepkový olej', 'olivovy-olej': 'Olivový olej', med: 'Med',
    'mrazena-zeleninova-smes': 'Mražená zeleninová směs', brokolice: 'Brokolice', spenat: 'Špenát', 'ledovy-salat': 'Ledový salát',
    okurka: 'Okurka', 'cherry-rajcata': 'Cherry rajčata', 'paprika-cervena': 'Paprika červená', mrkev: 'Mrkev', passata: 'Passata',
    boruvky: 'Borůvky', maliny: 'Maliny', jahody: 'Jahody', banan: 'Banán', jablko: 'Jablko',
  },
  NAKUP_KUS: { vejce: [60, 'ks'], banan: [120, 'ks'], jablko: [150, 'ks'], 'grahamovy-rohlik': [60, 'ks'], 'tortilla-psenicna': [60, 'ks'], avokado: [140, 'ks'], 'proteinova-tycinka': [50, 'ks'], 'pizza-margherita': [300, 'ks'] },
  NAKUP_ML: ['mleko-polotucne'],
};
