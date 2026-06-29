/* Barna Academy — engine generátoru tréninkových plánů.
   Čistě klientský, deterministický. Žádný backend.
   Vstupy: místo (fitko/doma/hriste), vybavení, úroveň, cíl, dny/týden.
   → vybere split → z exercise-db.json poskládá plán se sériemi/opakováními.
   DB: pole {id,name,muscle,pattern,equip[],location[],level,unit,tip}. */
(function (global) {
  'use strict';

  var LEVELS = { zacatecnik: 1, pokrocily: 2, zkuseny: 3 };
  // série/opakování dle cíle
  var GOALS = {
    sila:    { label:'Síla',                 sets:5, reps:'3–5',   rest:'2–3 min', accessReps:'6–8' },
    svaly:   { label:'Svaly (hypertrofie)',  sets:4, reps:'8–12',  rest:'60–90 s', accessReps:'10–15' },
    kondice: { label:'Hubnutí / kondice',    sets:3, reps:'12–15', rest:'45–60 s', accessReps:'12–20' },
    vydrz:   { label:'Vytrvalost / tonus',   sets:3, reps:'15–20', rest:'30–45 s', accessReps:'15–25' }
  };

  // sloty: {by:'pattern'|'muscle', val, access?:true} — access = doplňkový (méně sérií, víc opakování)
  var P = function (v) { return { by:'pattern', val:v }; };
  var M = function (v, a) { return { by:'muscle', val:v, access:a }; };
  var T = {
    FBA: [P('drep'), P('tlak-horizontalni'), P('tah-horizontalni'), P('tlak-vertikalni'), M('bricho', true)],
    FBB: [P('hinge'), P('tlak-vertikalni'), P('tah-vertikalni'), M('nohy'), M('bricho', true)],
    FBC: [P('vypad'), P('tlak-horizontalni'), P('tah-horizontalni'), M('hyzde'), M('bricho', true)],
    UPPER: [P('tlak-horizontalni'), P('tah-horizontalni'), P('tlak-vertikalni'), P('tah-vertikalni'), M('biceps', true), M('triceps', true)],
    LOWER: [P('drep'), P('hinge'), P('vypad'), M('hyzde'), M('lytka', true), M('bricho', true)],
    PUSH: [P('tlak-horizontalni'), P('tlak-vertikalni'), M('triceps', true), M('prsa', true)],
    PULL: [P('tah-vertikalni'), P('tah-horizontalni'), M('biceps', true), M('zada', true)],
    LEGS: [P('drep'), P('hinge'), P('vypad'), M('hyzde'), M('lytka', true)]
  };

  function splitFor(days) {
    days = Math.min(5, Math.max(2, days));
    if (days === 2) return [['Trénink A — celé tělo', T.FBA], ['Trénink B — celé tělo', T.FBB]];
    if (days === 3) return [['Trénink A — celé tělo', T.FBA], ['Trénink B — celé tělo', T.FBB], ['Trénink C — celé tělo', T.FBC]];
    if (days === 4) return [['Horní partie A', T.UPPER], ['Dolní partie A', T.LOWER], ['Horní partie B', T.UPPER], ['Dolní partie B', T.LOWER]];
    return [['Push (tlaky)', T.PUSH], ['Pull (tahy)', T.PULL], ['Nohy', T.LEGS], ['Horní partie', T.UPPER], ['Dolní partie', T.LOWER]];
  }

  function filterDb(db, opts) {
    var maxLvl = LEVELS[opts.level] || 1;
    var loc = opts.location;             // 'fitko'|'doma'|'hriste'
    var equipMode = opts.equip;          // 'telo'|'cinky'|'vse'
    return db.filter(function (e) {
      if (e.location.indexOf(loc) === -1) return false;
      if ((LEVELS[e.level] || 1) > maxLvl) return false;
      if (equipMode === 'telo') return e.equip.indexOf('telo') !== -1;
      if (equipMode === 'cinky') {
        return e.equip.some(function (x) { return ['telo', 'cinky', 'kettlebell', 'guma', 'lavka', 'hrazda', 'trx'].indexOf(x) !== -1; });
      }
      return true; // vse
    });
  }

  function buildPlan(db, opts) {
    opts = opts || {};
    var seed = opts.seed || 0;
    var pool = filterDb(db, opts);
    var g = GOALS[opts.goal] || GOALS.svaly;
    var split = splitFor(opts.days);
    var days = [];

    split.forEach(function (entry, di) {
      var dayName = entry[0], slots = entry[1];
      var used = {}, exercises = [];
      slots.forEach(function (slot, si) {
        var cand = pool.filter(function (e) { return (slot.by === 'pattern' ? e.pattern === slot.val : e.muscle === slot.val) && !used[e.id]; });
        // fallback: když na vzor nic není (např. doma/telo), zkus podle partie blízké vzoru
        if (!cand.length && slot.by === 'pattern') {
          var musMap = { drep:'nohy', hinge:'hyzde', vypad:'nohy', 'tlak-horizontalni':'prsa', 'tlak-vertikalni':'ramena', 'tah-horizontalni':'zada', 'tah-vertikalni':'zada', izolace:'bricho', core:'bricho' };
          var mm = musMap[slot.val];
          cand = pool.filter(function (e) { return e.muscle === mm && !used[e.id]; });
        }
        if (!cand.length) return;
        var pick = cand[(seed + di * 3 + si) % cand.length];
        used[pick.id] = 1;
        exercises.push({
          ex: pick,
          sets: slot.access ? Math.max(2, g.sets - 1) : g.sets,
          reps: slot.access ? g.accessReps : g.reps
        });
      });
      days.push({ name: dayName, day: di + 1, exercises: exercises });
    });

    return { days: days, goal: g, rest: g.rest, poolSize: pool.length };
  }

  global.WorkoutGen = { buildPlan: buildPlan, GOALS: GOALS };
})(window);
