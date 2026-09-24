// Jídelníček ženského lead magnetu „7denní makro plán pro ženy 30+" (download/makro-plan-zeny.pdf).
//
// ⛔ ČÍSLA SEM NEPIŠ RUKOU. Tady jsou jen potraviny (id z assets/food-db.json) a výchozí gramáže.
// Kcal a makra počítá build-makro-plan-zeny.js funkcí MealGen.macrosFor (tatáž, kterou počítá
// generátor jídelníčků na webu), gramáže rolí P, C a T dorovná na denní cíl deterministicky.
//
// Původ:
// - Jídla (co se jí který den) = Martinův obsah z Drive „7denni_Makro_Plan_Detailni", tedy to,
//   co bylo v PDF od 9. 7. 2026 (commit 1336dfd70), jen bez porcí.
// - Výchozí gramáže = Martinem potvrzený plán z června 2026 (plan/build_plans.py, commit 8320551e0).
//   Kde tam gramáž chyběla („+ zelenina", „velký salát"), bere se výchozí porce potraviny z food-db.
// - Odchylky od Martinova menu a od června (25. 9. 2026, agent 78. šéfa):
//   čtvrteční „proteinová tyčinka" → skyr (tyčinka v DB není, liší se značkou); sobotní flex den má
//   volnější večeři jako zbytek kalorií (pizza v DB není), snídani jako pánský flex den (tvaroh + vločky)
//   a ke shaku banán; páteční jogurt → proteinový a mleté hovězí 10 % → 5 % (den měl moc tuku a málo
//   bílkovin); olej na pánev/na pečení (Út, St, Ne) a mandle do středeční snídaně (bez nich den
//   nedosáhl tuku z enginu); řecký jogurt 0 % místo „do 5 %" (DB má pro 5 % dvě rozporné položky).
//
// role: 'P' = hlavní bílkovina, 'C' = hlavní příloha, 'T' = přidaný tuk (olej, ořechy, avokádo, hummus);
//       tyhle tři se dorovnávají. 'F' = pevná položka (nemění se).
// txt: 2. pád za gramáží („50 g ovesných vloček"). kus: [gramů na kus, '1 …', '2-4 …', '5+ …'] pro výpis v kusech.

module.exports = {
  // Referenční žena pro kalkulačku (stejná logika jako pánský plán: průměrná postava,
  // lehká aktivita, mírné hubnutí). Pánský plán ~2 000 kcal odpovídá tomu, co engine dá muži
  // 40 let, 180 cm, 90 kg, lehká aktivita, mírné hubnutí (2 021 kcal, B 162, S 181, T 72).
  REF: { sex: 'zena', age: 38, height: 166, weight: 72, activity: 'lehka', goal: 'mirne_hubnuti' },
  // Stránka makro-plan i OG obrázek slibují 1 500 kcal. Engine dá referenční ženě 1 538 kcal.
  KCAL_CIL: 1500,

  DAYS: [
    { name: 'Pondělí', tag: 'tréninkový den', meals: [
      { lbl: 'Snídaně', title: 'Ovesná kaše s proteinem a borůvkami', items: [
        ['ovesne-vlocky', 50, 'C', 'ovesných vloček'],
        ['syrovatkovy-protein', 25, 'F', 'syrovátkového proteinu'],
        ['mleko-polotucne', 150, 'F', 'polotučného mléka', 'ml'],
        ['boruvky', 100, 'F', 'borůvek'],
      ]},
      { lbl: 'Svačina', title: 'Řecký jogurt s mandlemi', items: [
        ['recky-jogurt-0', 150, 'F', 'řeckého jogurtu 0 %'],
        ['mandle', 15, 'T', 'mandlí'],
      ]},
      { lbl: 'Oběd', title: 'Kuřecí stir-fry s rýží a zeleninou', items: [
        ['kureci-prsa', 130, 'P', 'kuřecích prsou'],
        ['ryze-bila', 60, 'C', 'rýže'],
        ['mrazena-zeleninova-smes', 200, 'F', 'zeleninové směsi'],
        ['repkovy-olej', 5, 'T', 'oleje'],
      ]},
      { lbl: 'Večeře', title: 'Losos s batáty a brokolicí', items: [
        ['losos', 120, 'P', 'lososa'],
        ['bataty', 150, 'C', 'batátů'],
        ['brokolice', 150, 'F', 'brokolice'],
      ]},
    ]},
    { name: 'Úterý', tag: '', meals: [
      { lbl: 'Snídaně', title: 'Omeleta se špenátem a sýrem, k tomu chléb', items: [
        ['vejce', 180, 'F', 'vajec', null, [60, 'vejce', 'vejce', 'vajec']],
        ['spenat', 50, 'F', 'špenátu'],
        ['eidam-30', 20, 'F', 'eidamu 30 %'],
        ['repkovy-olej', 5, 'T', 'oleje na pánev'],
        ['chleb-celozrnny', 40, 'C', 'celozrnného chleba'],
      ]},
      { lbl: 'Svačina', title: 'Proteinový shake a banán', items: [
        ['syrovatkovy-protein', 30, 'F', 'proteinu (s vodou)'],
        ['banan', 120, 'F', 'banánu', null, [120, 'banán', 'banány', 'banánů']],
      ]},
      { lbl: 'Oběd', title: 'Quinoa salát s tuňákem a avokádem', items: [
        ['tunak-vlastni-stava', 100, 'P', 'tuňáka ve vlastní šťávě'],
        ['quinoa', 60, 'C', 'quinoy'],
        ['avokado', 70, 'T', 'avokáda'],
        ['ledovy-salat', 80, 'F', 'ledového salátu'],
        ['okurka', 100, 'F', 'okurky'],
      ]},
      { lbl: 'Večeře', title: 'Hovězí na zelenině s brambory', items: [
        ['hovezi-steak-libovy', 120, 'P', 'libového hovězího'],
        ['brambory', 200, 'C', 'brambor'],
        ['mrazena-zeleninova-smes', 150, 'F', 'zeleninové směsi'],
      ]},
    ]},
    { name: 'Středa', tag: '', meals: [
      { lbl: 'Snídaně', title: 'Řecký jogurt s granolou, jahodami a mandlemi', items: [
        ['recky-jogurt-0', 200, 'F', 'řeckého jogurtu 0 %'],
        ['granola-bez-pridaneho-cukru', 30, 'C', 'granoly bez přidaného cukru'],
        ['jahody', 100, 'F', 'jahod'],
        ['mandle', 10, 'T', 'mandlí'],
      ]},
      { lbl: 'Svačina', title: 'Cottage s jablkem', items: [
        ['cottage-syr', 150, 'F', 'cottage'],
        ['jablko', 150, 'F', 'jablka', null, [150, 'jablko', 'jablka', 'jablek']],
      ]},
      { lbl: 'Oběd', title: 'Kuřecí wrap s hummusem a zeleninou', items: [
        ['kureci-prsa', 120, 'P', 'kuřecích prsou'],
        ['tortilla-psenicna', 60, 'F', 'tortilly', null, [60, 'tortilla', 'tortilly', 'tortill']],
        ['hummus', 30, 'T', 'hummusu'],
        ['ledovy-salat', 80, 'F', 'ledového salátu'],
      ]},
      { lbl: 'Večeře', title: 'Pečené kuře s batáty a salátem', items: [
        ['kureci-prsa', 150, 'P', 'kuřecích prsou'],
        ['bataty', 150, 'C', 'batátů'],
        ['repkovy-olej', 5, 'T', 'oleje na pečení'],
        ['ledovy-salat', 80, 'F', 'ledového salátu'],
        ['okurka', 100, 'F', 'okurky'],
      ]},
    ]},
    { name: 'Čtvrtek', tag: 'tréninkový den', meals: [
      { lbl: 'Snídaně', title: 'Proteinové palačinky s malinami', items: [
        ['vejce', 60, 'F', 'vajec', null, [60, 'vejce', 'vejce', 'vajec']],
        ['syrovatkovy-protein', 30, 'F', 'syrovátkového proteinu'],
        ['ovesna-mouka', 40, 'C', 'ovesné mouky'],
        ['maliny', 100, 'F', 'malin'],
      ]},
      { lbl: 'Svačina', title: 'Skyr s mandlemi', items: [
        ['skyr', 150, 'F', 'skyru'],
        ['mandle', 15, 'T', 'mandlí'],
      ]},
      { lbl: 'Oběd', title: 'Lososový salát s quinoou', items: [
        ['losos', 120, 'P', 'lososa'],
        ['quinoa', 50, 'C', 'quinoy'],
        ['ledovy-salat', 80, 'F', 'ledového salátu'],
        ['cherry-rajcata', 100, 'F', 'cherry rajčat'],
        ['olivovy-olej', 5, 'T', 'olivového oleje'],
      ]},
      { lbl: 'Večeře', title: 'Krůtí maso s rýží a zeleninou', items: [
        ['kruti-prsa', 130, 'P', 'krůtích prsou'],
        ['ryze-bila', 60, 'C', 'rýže'],
        ['mrazena-zeleninova-smes', 150, 'F', 'zeleninové směsi'],
      ]},
    ]},
    { name: 'Pátek', tag: '', meals: [
      { lbl: 'Snídaně', title: 'Vaječná míchanice s avokádem a chlebem', items: [
        ['vejce', 180, 'F', 'vajec', null, [60, 'vejce', 'vejce', 'vajec']],
        ['avokado', 70, 'T', 'avokáda'],
        ['chleb-celozrnny', 40, 'C', 'celozrnného chleba'],
      ]},
      { lbl: 'Svačina', title: 'Proteinový jogurt s jablkem', items: [
        ['proteinovy-jogurt', 150, 'F', 'proteinového jogurtu'],
        ['jablko', 150, 'F', 'jablka', null, [150, 'jablko', 'jablka', 'jablek']],
      ]},
      { lbl: 'Oběd', title: 'Celozrnné těstoviny s mletým masem a rajčatovou omáčkou', items: [
        ['hovezi-mlete-5', 120, 'P', 'libového mletého hovězího (5 % tuku)'],
        ['testoviny-celozrnne', 70, 'C', 'celozrnných těstovin'],
        ['passata', 100, 'F', 'passaty'],
        ['paprika-cervena', 100, 'F', 'papriky'],
      ]},
      { lbl: 'Večeře', title: 'Grilovaný losos s batáty a salátem', items: [
        ['losos', 120, 'P', 'lososa'],
        ['bataty', 150, 'C', 'batátů'],
        ['ledovy-salat', 80, 'F', 'ledového salátu'],
        ['okurka', 100, 'F', 'okurky'],
      ]},
    ]},
    { name: 'Sobota', tag: 'flex den', flex: true, meals: [
      { lbl: 'Snídaně', title: 'Tvaroh s ovesnými vločkami, jahodami a medem', items: [
        ['tvaroh-mekky-nizkotucny', 200, 'F', 'nízkotučného tvarohu'],
        ['ovesne-vlocky', 40, 'C', 'ovesných vloček'],
        ['jahody', 100, 'F', 'jahod'],
        ['med', 10, 'F', 'medu'],
      ]},
      { lbl: 'Oběd', title: 'Velký kuřecí salát s rohlíkem', items: [
        ['kureci-prsa', 150, 'P', 'kuřecích prsou'],
        ['grahamovy-rohlik', 60, 'F', 'grahamového rohlíku', null, [60, 'grahamový rohlík', 'grahamové rohlíky', 'grahamových rohlíků']],
        ['ledovy-salat', 80, 'F', 'ledového salátu'],
        ['cherry-rajcata', 100, 'F', 'cherry rajčat'],
        ['okurka', 100, 'F', 'okurky'],
        ['olivovy-olej', 5, 'F', 'olivového oleje'],
      ]},
      { lbl: 'Svačina', title: 'Proteinový shake a banán', items: [
        ['syrovatkovy-protein', 25, 'F', 'proteinu (s vodou)'],
        ['banan', 120, 'F', 'banánu', null, [120, 'banán', 'banány', 'banánů']],
      ]},
      // Volnější večeře: kcal = KCAL_CIL minus součet ostatních jídel dne (počítá build).
      { lbl: 'Večeře', title: 'Volnější večeře podle chuti', volna: true, items: [] },
    ]},
    { name: 'Neděle', tag: '', meals: [
      { lbl: 'Snídaně', title: 'Omeleta se zeleninou a sýrem', items: [
        ['vejce', 180, 'F', 'vajec', null, [60, 'vejce', 'vejce', 'vajec']],
        ['eidam-30', 30, 'F', 'eidamu 30 %'],
        ['paprika-cervena', 100, 'F', 'papriky'],
        ['repkovy-olej', 5, 'T', 'oleje na pánev'],
      ]},
      { lbl: 'Svačina', title: 'Proteinový pudink', items: [
        ['proteinovy-pudink', 200, 'F', 'proteinového pudinku'],
      ]},
      { lbl: 'Oběd', title: 'Kuřecí polévka a salát s tuňákem', items: [
        ['kureci-prsa', 80, 'P', 'kuřecích prsou do polévky'],
        ['mrkev', 100, 'F', 'mrkve'],
        ['testoviny', 20, 'F', 'nudlí'],
        ['tunak-vlastni-stava', 80, 'P', 'tuňáka ve vlastní šťávě'],
        ['ledovy-salat', 80, 'F', 'ledového salátu'],
        ['chleb-celozrnny', 40, 'C', 'celozrnného chleba'],
      ]},
      { lbl: 'Večeře', title: 'Pečené kuře s batáty a brokolicí', items: [
        ['kureci-prsa', 150, 'P', 'kuřecích prsou'],
        ['bataty', 150, 'C', 'batátů'],
        ['repkovy-olej', 5, 'T', 'oleje na pečení'],
        ['brokolice', 150, 'F', 'brokolice'],
      ]},
    ]},
  ],
};
