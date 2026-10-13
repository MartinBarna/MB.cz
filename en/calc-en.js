/* martinbarna.cz/en/ : anglická kalkulačka kalorií a bílkovin (13. 10. 2026).
   ⛔⛔ VÝPOČET TADY NENÍ. Počítá výhradně sdílený engine assets/meal-gen.js
   (MealGen.kontrolaVstupu + MealGen.computeTargets), tentýž jako česká kalkulačka
   /kalkulacka-kalorii-a-makrozivin/, Academy, videokurz i appka Tvůj Coach.
   Tenhle soubor jen:
     1) převádí jednotky (lb -> kg, ft + in -> cm, přesné definice libry a palce),
     2) mapuje anglické volby na klíče enginu (male -> muz, ...),
     3) překládá hlášky enginu do angličtiny podle jejich kódu (kod), ne podle textu.
   Kdo sem dopíše vlastní vzorec, rozejde EN a CZ čísla. Hlídá to en/test-kalkulacka.mjs
   (porovnává s inline skriptem české stránky, tolerance 1 kcal a 1 g).
   Načítá se na /en/ spolu s /assets/meal-gen.js; window.MBCalcEN. */
(function (global) {
  'use strict';

  var LB_TO_KG = 0.45359237; // mezinárodní libra, přesně
  var IN_TO_CM = 2.54;       // palec, přesně
  var SEX = { male: 'muz', female: 'zena' };
  var ACTIVITY = ['sedavy', 'lehka', 'stredni', 'vysoka', 'extremni'];
  var GOAL = ['hubnuti', 'mirne_hubnuti', 'udrzeni', 'mirny_narust', 'narust'];

  // Kódy hlášek = kódy z MealGen.kontrolaVstupu (+ tři vlastní: palce, engine, poznámky k výsledku).
  var MSG = {
    chybi: 'Fill in your age, height and weight as numbers.',
    vek_mimo: 'Enter your age in years, max 100.',
    nezletily: 'This calculator is for adults 18 and over. A body that is still growing needs different numbers, and a doctor should set them.',
    vyska_mimo: {
      metric: 'Enter your height in cm, between 100 and 250.',
      imperial: 'Enter your height between 3 ft 4 in and 8 ft 2 in.'
    },
    vaha_mimo: {
      metric: 'Enter your weight in kg, between 30 and 400.',
      imperial: 'Enter your weight in lb, between 67 and 880.'
    },
    palce: 'Inches go from 0 to 11.',
    podvaha_hubnuti: 'Your BMI is under 18.5. That is underweight, so I will not calculate fat loss for you. Choose maintain or build muscle, and talk to your doctor about the next steps.',
    podvaha: 'Your BMI is under 18.5. That is underweight. Here are your numbers, but please show them to your doctor too.',
    engine: 'The calculator did not load completely. Please refresh the page.',
    floorAboveTdee: 'The safety floor of {floor} kcal is higher than your daily burn ({tdee} kcal). So this is not a deficit. Eating less than this floor makes no sense. Move more instead.',
    floorHeld: 'Your target sits on the safety floor of {floor} kcal. The calculated number was lower, and we never go below this floor.',
    tempo: 'We adjusted your pace to {kg} kg ({lb} lb) a week, so it stays sustainable.'
  };

  /** Stejná sémantika jako cisloZVstupu v enginu: číslo beze změny, text s tečkou i čárkou, prázdné = NaN. */
  function cislo(x) {
    if (typeof x === 'number') return x;
    if (typeof x !== 'string') return NaN;
    var t = x.trim().replace(',', '.');
    return t === '' ? NaN : Number(t);
  }

  function fmt(s, vars) {
    return s.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ''; });
  }

  function num(n) {
    try { return Number(n).toLocaleString('en-US'); } catch (e) { return String(n); }
  }

  /** Anglický vstup -> metrické hodnoty pro engine. Nic nezaokrouhluje (zaokrouhlí až engine). */
  function toMetric(inp) {
    inp = inp || {};
    var heightCm, weightKg;
    if (inp.units === 'imperial') {
      var ft = cislo(inp.heightFt);
      var inch = cislo(inp.heightIn);
      // Prázdné palce = 0 (člověk 6 stop napíše jen 6).
      if (isFinite(ft) && (inp.heightIn == null || String(inp.heightIn).trim() === '')) inch = 0;
      heightCm = (isFinite(ft) && isFinite(inch)) ? (ft * 12 + inch) * IN_TO_CM : NaN;
      var lb = cislo(inp.weightLb);
      weightKg = isFinite(lb) ? lb * LB_TO_KG : NaN;
    } else {
      heightCm = cislo(inp.heightCm);
      weightKg = cislo(inp.weightKg);
    }
    return { heightCm: heightCm, weightKg: weightKg };
  }

  function message(code, units) {
    var m = MSG[code] || MSG.chybi;
    if (typeof m === 'object') m = m[units] || m.metric;
    return m;
  }

  /**
   * Hlavní funkce. MealGen = window.MealGen ze sdíleného enginu.
   * inp = { units:'metric'|'imperial', sex:'male'|'female', age, heightCm, heightFt, heightIn,
   *         weightKg, weightLb, activity:<klíč enginu>, goal:<klíč enginu> }
   * Vrací { ok:false, code, message } nebo { ok:true, kcal, protein, fat, carbs, fiber,
   * tempoKgTyden, tdee, bmr, notes[], calc{} }.
   * fat, carbs, fiber a tempo jsou totéž, co vrátil computeTargets. calc (do en_leads) dál
   * nese jen kcal, protein_g a tdee, stejně jako kit na /en/.
   */
  function calculate(MealGen, inp) {
    inp = inp || {};
    var units = inp.units === 'imperial' ? 'imperial' : 'metric';
    function fail(code) { return { ok: false, code: code, message: message(code, units) }; }
    if (!MealGen || typeof MealGen.computeTargets !== 'function' || typeof MealGen.kontrolaVstupu !== 'function') return fail('engine');
    if (!SEX[inp.sex] || ACTIVITY.indexOf(inp.activity) < 0 || GOAL.indexOf(inp.goal) < 0) return fail('chybi');
    if (units === 'imperial' && inp.heightIn != null && String(inp.heightIn).trim() !== '') {
      var inch = cislo(inp.heightIn);
      if (!(inch >= 0 && inch < 12)) return fail('palce');
    }

    var m = toMetric(inp);
    var age = cislo(inp.age);
    // ⛔ Kontrola vstupů je JEDNA sdílená funkce enginu (věk 18+, rozsahy, podváha u hubnutí).
    var k = MealGen.kontrolaVstupu({ age: age, height: m.heightCm, weight: m.weightKg, goal: inp.goal });
    if (!k.ok) return fail(k.kod);

    var t = MealGen.computeTargets({
      sex: SEX[inp.sex], age: age, height: m.heightCm, weight: m.weightKg,
      activity: inp.activity, goal: inp.goal
    });

    // Poznámky ve stejném pořadí a za stejných podmínek jako česká stránka (floorNote, varování, tempoNote).
    var notes = [];
    if (t.floorAboveTdee) notes.push(fmt(MSG.floorAboveTdee, { floor: num(t.kcalFloor), tdee: num(t.tdee) }));
    else if (t.rateCapped) notes.push(fmt(MSG.floorHeld, { floor: num(t.kcalFloor) }));
    (k.varovani || []).forEach(function (v) { if (MSG[v.kod]) notes.push(message(v.kod, units)); });
    if (t.tempoNote) {
      notes.push(fmt(MSG.tempo, {
        kg: Number(t.tempoKgTyden).toFixed(2),
        lb: (Number(t.tempoKgTyden) / LB_TO_KG).toFixed(1)
      }));
    }

    return {
      ok: true,
      kcal: t.kcal,
      protein: t.protein,
      fat: t.fat,
      carbs: t.carbs,
      fiber: t.fiber,
      tempoKgTyden: t.tempoKgTyden,
      tdee: t.tdee,
      bmr: t.bmr,
      notes: notes,
      // Co se smí uložit k leadu kitu (en_leads.calc): jen VÝSLEDEK a volby. ⛔ Záměrně bez věku,
      // pohlaví, výšky a váhy (minimalizace dat; tělesné údaje můžou být zdravotní data a text
      // u formuláře ani /en/privacy/ jejich uložení neslibuje). Mail 1 potřebuje jen kcal a bílkoviny.
      calc: {
        v: 1, units: units, activity: inp.activity, goal: inp.goal,
        kcal: t.kcal, protein_g: t.protein, tdee: t.tdee
      }
    };
  }

  global.MBCalcEN = {
    calculate: calculate,
    toMetric: toMetric,
    formatNumber: num,
    LB_TO_KG: LB_TO_KG,
    IN_TO_CM: IN_TO_CM,
    ACTIVITY: ACTIVITY.slice(),
    GOAL: GOAL.slice()
  };
})(typeof window !== 'undefined' ? window : globalThis);
