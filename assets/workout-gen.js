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
    UPPER: [P('tlak-horizontalni'), P('tah-horizontalni'), P('tlak-vertikalni'), P('tah-vertikalni'), M('ramena', true), M('biceps', true), M('triceps', true)],
    LOWER: [P('drep'), P('hinge'), P('vypad'), M('hyzde'), M('lytka', true), M('bricho', true)],
    PUSH: [P('tlak-horizontalni'), P('tlak-vertikalni'), M('ramena', true), M('triceps', true), M('prsa', true)],
    PULL: [P('tah-vertikalni'), P('tah-horizontalni'), M('biceps', true), M('zada', true)],
    LEGS: [P('drep'), P('hinge'), P('vypad'), M('hyzde'), M('lytka', true)]
  };

  // mapa pattern → cílová svalová partie (fallback + doplňování dne + pořadí cviků)
  var musMap = { drep:'nohy', hinge:'hyzde', vypad:'nohy', 'tlak-horizontalni':'prsa', 'tlak-vertikalni':'ramena', 'tah-horizontalni':'zada', 'tah-vertikalni':'zada', izolace:'bricho', core:'bricho' };

  // pořadí cviků v tréninku: velké spoje → izolace → core → kardio (finisher)
  function orderRank(p) { return p === 'izolace' ? 1 : p === 'core' ? 2 : p === 'kardio' ? 3 : 0; }

  // Plně vybavené místo → plán má vypadat jako plán do posilovny, ne jako mix všeho.
  // Činky, stroje, kladky a hrazda mají přednost; guma a vlastní tělo se použijí jen tehdy,
  // když pro daný slot nic zatíženého není (typicky břicho / core), ne jako běžný prvek plánu.
  var LOADED = ['velka-cinka', 'cinky', 'kettlebell', 'stroj', 'kladka', 'hrazda'];
  function isLoaded(e) { return e.equip.some(function (x) { return LOADED.indexOf(x) !== -1; }); }
  function preferLoaded(cand, equipMode) {
    if (equipMode !== 'vse') return cand;   // u „jen činky" / „jen tělo" je guma i tělo legitimní volba
    var top = cand.filter(isLoaded);
    return top.length ? top : cand;
  }

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
        // Režim „jednoručky/doma" — jen náčiní, které reálně máš. 'lavka'/'hrazda' jsou jen
        // doplňky (bench, hrazda), ne signál „jde to lehce" → NEsmí propustit cvik na velkou činku/stroj.
        return e.equip.some(function (x) { return ['telo', 'cinky', 'kettlebell', 'guma', 'trx'].indexOf(x) !== -1; });
      }
      return true; // vse
    });
  }

  // ===== Objem per sval: 14 detailních svalů + fractional counting + zóny MEV/MAV/MRV =====
  // Port z appky Tvůj Coach (src/engine/muscle.ts). Deterministické; landmarky = publikované
  // defaulty z tréninkové literatury (editovatelné), NE Martinova metoda vydávaná za fakt.
  var MUS_LABEL = { chest:'Prsa', front_delts:'Přední delty', side_delts:'Boční delty', rear_delts:'Zadní delty', back:'Záda', traps:'Trapézy', biceps:'Biceps', triceps:'Triceps', forearms:'Předloktí', quads:'Kvadricepsy', hamstrings:'Hamstringy', glutes:'Hýždě', calves:'Lýtka', abs:'Břicho' };
  var MUS_ORDER = ['chest','back','side_delts','front_delts','rear_delts','traps','biceps','triceps','forearms','quads','hamstrings','glutes','calves','abs'];
  var LANDMARKS = { chest:{mev:8,mav:16,mrv:22}, front_delts:{mev:0,mav:8,mrv:12}, side_delts:{mev:8,mav:16,mrv:26}, rear_delts:{mev:6,mav:12,mrv:20}, back:{mev:10,mav:18,mrv:25}, traps:{mev:0,mav:12,mrv:20}, biceps:{mev:8,mav:14,mrv:20}, triceps:{mev:6,mav:12,mrv:18}, forearms:{mev:2,mav:8,mrv:15}, quads:{mev:8,mav:14,mrv:20}, hamstrings:{mev:6,mav:12,mrv:16}, glutes:{mev:0,mav:8,mrv:16}, calves:{mev:8,mav:14,mrv:20}, abs:{mev:0,mav:16,mrv:25} };
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
  // Pořadí ROZHODUJE — specifičtější vzory dřív (rumunský před mrtvým tahem, reverse fly před fly). První shoda vyhrává.
  var RULES = [
    { re:/rumunsk|rdl|romanian/, primary:['hamstrings','glutes'], secondary:[] },
    { re:/mrtv[yý] tah|deadlift|mrtvol/, primary:['back','hamstrings','glutes'], secondary:[] },
    { re:/predkop|leg extension|extenze kolen/, primary:['quads'], secondary:[] },
    { re:/zakop|leg curl|flexe kolen|hamstring curl/, primary:['hamstrings'], secondary:[] },
    { re:/hip thrust|hyzd|glute bridge|mostik/, primary:['glutes'], secondary:['hamstrings'] },
    { re:/vypad|lunge|bulhar|split squat/, primary:['quads','glutes'], secondary:[] },
    { re:/leg press|leg-press/, primary:['quads'], secondary:['glutes'] },
    { re:/drep|squat|hack/, primary:['quads','glutes'], secondary:['hamstrings'] },
    { re:/lytk|calf|vypony/, primary:['calves'], secondary:[] },
    { re:/reverse fly|rozpaz.*predklon|zadni delt|rear delt/, primary:['rear_delts'], secondary:[] },
    { re:/rozpaz|fly|pec.?deck|peck|rozpazov/, primary:['chest'], secondary:[] },
    { re:/sikm|incline|horni prsa/, primary:['chest'], secondary:['front_delts','triceps'] },
    { re:/bench|tlak na (rovn|lavici)|bench press|klik|push.?up|prsa/, primary:['chest'], secondary:['front_delts','triceps'] },
    { re:/upaz|lateral raise|bocni zdvih|side raise/, primary:['side_delts'], secondary:[] },
    { re:/face.?pull|face pull/, primary:['rear_delts'], secondary:['traps'] },
    { re:/tlak nad hlavu|nad hlavu|overhead|ohp|military|arnold|tlak.*rameno|rameno.*tlak/, primary:['front_delts'], secondary:['side_delts','triceps'] },
    { re:/krceni ramen|shrug|trapez/, primary:['traps'], secondary:[] },
    { re:/shyb|pull.?up|chin.?up|pritahovan/, primary:['back'], secondary:['biceps'] },
    { re:/stahovani (kladky|hor)|lat pulldown|pulldown|prit.*kladk/, primary:['back'], secondary:['biceps'] },
    { re:/vesl|row|pritah|prit[aá]h/, primary:['back'], secondary:['biceps','rear_delts'] },
    { re:/kladka na triceps|triceps|stahovani.*triceps|francouz|dip|klik na trojhlav/, primary:['triceps'], secondary:[] },
    { re:/kladka na biceps|biceps|zdvih.*(cink|jednoruc|obouruc)|curl|dvojhlav/, primary:['biceps'], secondary:[] },
    { re:/predlokt|forearm|wrist|zapesti/, primary:['forearms'], secondary:[] },
    { re:/tlak s jednoruc|db press|jednoruc.*tlak/, primary:['chest'], secondary:['front_delts','triceps'] },
    { re:/brich|abs|plank|prkno|zkracov|crunch|leg raise|nudle|core/, primary:['abs'], secondary:[] }
  ];
  function matchMuscles(exercise) {
    var n = norm(exercise); if (!n) return null;
    for (var i = 0; i < RULES.length; i++) { if (RULES[i].re.test(n)) return { primary: RULES[i].primary, secondary: RULES[i].secondary }; }
    return null;
  }
  // autoritativní mapa z DB (skupina + pohyb + název) na 14 detailních svalů
  function musclesFromDb(m, pattern, name) {
    var n = norm(name);
    var isRear = /zadni|reverse|face|predklon/.test(n);
    var isFront = /predni|predpaz|front/.test(n);
    var isShrug = /shrug|krceni ramen|trapez/.test(n);
    switch (m) {
      case 'biceps': return { primary:['biceps'], secondary:[] };
      case 'triceps': return { primary:['triceps'], secondary:[] };
      case 'lytka': return { primary:['calves'], secondary:[] };
      case 'bricho': return { primary:['abs'], secondary:[] };
      case 'prsa': return { primary:['chest'], secondary: pattern.indexOf('tlak') === 0 ? ['front_delts','triceps'] : [] };
      case 'zada':
        if (pattern === 'hinge') {
          return /rumunsk|rdl|romanian/.test(n)
            ? { primary:['hamstrings','glutes'], secondary:['back'] }
            : { primary:['back','hamstrings','glutes'], secondary:[] };
        }
        return { primary:['back'], secondary: pattern === 'tah-horizontalni' ? ['biceps','rear_delts'] : ['biceps'] };
      case 'ramena':
        if (isShrug) return { primary:['traps'], secondary:[] };
        if (isRear) return { primary:['rear_delts'], secondary:[] };
        if (isFront) return { primary:['front_delts'], secondary:[] };
        if (pattern === 'tlak-vertikalni') return { primary:['front_delts'], secondary:['side_delts','triceps'] };
        return { primary:['side_delts'], secondary:[] };
      case 'nohy':
        if (pattern === 'hinge') return { primary:['hamstrings','glutes'], secondary:[] };
        if (/zakop|leg curl|flexe kolen|hamstring/.test(n)) return { primary:['hamstrings'], secondary:[] };
        return { primary:['quads'], secondary:['glutes'] };
      case 'hyzde': return { primary:['glutes'], secondary: pattern === 'hinge' ? ['hamstrings'] : [] };
      case 'full':
        if (pattern === 'kardio') return { primary:[], secondary:[] };
        if (pattern === 'hinge') return { primary:['back','hamstrings','glutes'], secondary:[] };
        if (pattern === 'drep' || pattern === 'vypad') return { primary:['quads','glutes'], secondary:[] };
        return { primary:[], secondary:[] };
      default: return { primary:[], secondary:[] };
    }
  }
  var DB_BY_NAME = null;
  function setMuscleDb(db) { DB_BY_NAME = {}; db.forEach(function (e) { DB_BY_NAME[norm(e.name)] = { muscle: e.muscle, pattern: e.pattern, name: e.name }; }); }
  function resolveMuscles(exercise) {
    if (DB_BY_NAME) { var hit = DB_BY_NAME[norm(exercise)]; if (hit) return musclesFromDb(hit.muscle, hit.pattern, hit.name); }
    return matchMuscles(exercise);
  }
  function zoneFor(sets, lm) { if (sets < lm.mev) return 'low'; if (sets <= lm.mav) return 'building'; if (sets <= lm.mrv) return 'high'; return 'over'; }
  // parita s appkou (pro testy): týdenní série na sval z logu tréninků (fractional counting)
  function weeklySetsByMuscle(rows, sinceDateIncl) {
    var acc = {}, unmatched = 0;
    rows.forEach(function (r) {
      if (r.logged_date < sinceDateIncl) return;
      var sets = r.sets || 0; if (sets <= 0) return;
      var mm = resolveMuscles(r.exercise);
      if (!mm || (!mm.primary.length && !mm.secondary.length)) { unmatched += sets; return; }
      mm.primary.forEach(function (p) { acc[p] = (acc[p] || 0) + sets; });
      mm.secondary.forEach(function (s) { acc[s] = (acc[s] || 0) + sets * 0.5; });
    });
    var byMuscle = MUS_ORDER.filter(function (mu) { return acc[mu] != null; }).map(function (mu) { return { muscle: mu, sets: Math.round(acc[mu] * 2) / 2 }; });
    return { byMuscle: byMuscle, unmatchedSets: unmatched };
  }
  // objem z VYGENEROVANÉHO plánu: každý cvik autoritativně přes musclesFromDb (má muscle+pattern+name z DB)
  function planVolume(plan) {
    var acc = {};
    plan.days.forEach(function (d) {
      d.exercises.forEach(function (pe) {
        if (pe.ex.pattern === 'kardio') return;
        var sets = pe.sets || 0; if (sets <= 0) return;
        var mm = musclesFromDb(pe.ex.muscle, pe.ex.pattern, pe.ex.name);
        if (!mm || (!mm.primary.length && !mm.secondary.length)) return;
        mm.primary.forEach(function (p) { acc[p] = (acc[p] || 0) + sets; });
        mm.secondary.forEach(function (s) { acc[s] = (acc[s] || 0) + sets * 0.5; });
      });
    });
    return MUS_ORDER.filter(function (mu) { return acc[mu] != null; }).map(function (mu) {
      var sets = Math.round(acc[mu] * 2) / 2, lm = LANDMARKS[mu];
      return { muscle: mu, label: MUS_LABEL[mu], sets: sets, lm: lm, zone: zoneFor(sets, lm) };
    });
  }

  // objemové pokrytí týdne: kolik pracovních sérií padne na každou svalovou skupinu (kardio se nepočítá)
  function planCoverage(plan) {
    var byGroup = {};
    plan.days.forEach(function (d) {
      d.exercises.forEach(function (pe) {
        if (pe.ex.pattern === 'kardio') return;          // kardio není objem svalu
        byGroup[pe.ex.muscle] = (byGroup[pe.ex.muscle] || 0) + pe.sets;
      });
    });
    return byGroup; // { prsa: 12, zada: 14, nohy: 16, biceps: 6, ... }
  }

  // ===== Auto-balance objemu =====
  // Tabulka objemu hlásila „nad MRV" u plánu, který vyrobil sám generátor — opravit to má tedy
  // generátor, ne uživatel. Dokud je partie nad MRV, ubíráme série u nejméně prioritních cviků
  // té partie, a to přednostně tak, aby to jiný sval neshodilo pod MEV.
  var MIN_SETS = 2;

  function entryMuscles(pe) { return musclesFromDb(pe.ex.muscle, pe.ex.pattern, pe.ex.name); }

  // všechny cviky plánu, které daný sval trénují; seřazené „nejméně prioritní první"
  function contributorsFor(days, muscle) {
    var out = [];
    days.forEach(function (d, di) {
      d.exercises.forEach(function (pe, ei) {
        if (pe.ex.pattern === 'kardio') return;
        var mm = entryMuscles(pe); if (!mm) return;
        var isP = mm.primary.indexOf(muscle) !== -1;
        if (!isP && mm.secondary.indexOf(muscle) === -1) return;
        out.push({ pe: pe, primary: isP, di: di, ei: ei, breadth: mm.primary.length + mm.secondary.length });
      });
    });
    out.sort(function (a, b) {
      if (a.primary !== b.primary) return a.primary ? -1 : 1;              // primární = ubraná série se projeví celá
      if (!!a.pe.access !== !!b.pe.access) return a.pe.access ? -1 : 1;    // doplňkový cvik dřív než hlavní
      if (a.breadth !== b.breadth) return a.breadth - b.breadth;           // úzký cvik = míň vedlejších škod
      return (b.di - a.di) || (b.ei - a.ei);                               // pozdější v týdnu dřív
    });
    return out;
  }

  function countBelowMev(days) {
    var n = 0;
    planVolume({ days: days }).forEach(function (v) { if (v.sets < v.lm.mev) n++; });
    return n;
  }

  // krajní pojistka: když už nejde ubrat série (všechno na minimu), vyhoď nejméně prioritní cvik
  function dropWeakest(days, muscle) {
    var cands = contributorsFor(days, muscle).sort(function (a, b) {
      if (!!a.pe.access !== !!b.pe.access) return a.pe.access ? -1 : 1;
      return (b.di - a.di) || (b.ei - a.ei);
    });
    for (var i = 0; i < cands.length; i++) {
      var d = days[cands[i].di], ix = d.exercises.indexOf(cands[i].pe);
      if (ix === -1 || d.exercises.length <= 3) continue;
      d.exercises.splice(ix, 1);
      return true;
    }
    return false;
  }

  function autoBalance(days) {
    for (var guard = 0; guard < 400; guard++) {
      var over = planVolume({ days: days }).filter(function (v) { return v.sets > v.lm.mrv; });
      if (!over.length) return;
      over.sort(function (a, b) { return (b.sets - b.lm.mrv) - (a.sets - a.lm.mrv); });
      var cands = contributorsFor(days, over[0].muscle).filter(function (c) { return c.pe.sets > MIN_SETS; });
      if (!cands.length) { if (!dropWeakest(days, over[0].muscle)) return; continue; }
      var base = countBelowMev(days), done = false;
      for (var i = 0; i < cands.length; i++) {
        cands[i].pe.sets--;
        if (countBelowMev(days) <= base) { done = true; break; }
        cands[i].pe.sets++;
      }
      // radši sval pod MEV (to jde doplnit jedním klikem) než přepal nad MRV
      if (!done) cands[0].pe.sets--;
    }
  }

  // kam nový cvik zařadit: do dne, kde se ten sval už trénuje, a při shodě tam, kde je míň cviků
  function bestDayFor(days, muscle) {
    var best = null, bestScore = -Infinity;
    days.forEach(function (d) {
      var s = 0;
      d.exercises.forEach(function (pe) {
        var mm = entryMuscles(pe); if (!mm) return;
        if (mm.primary.indexOf(muscle) !== -1) s += pe.sets;
        else if (mm.secondary.indexOf(muscle) !== -1) s += pe.sets * 0.5;
      });
      var score = s * 10 - d.exercises.length;
      if (score > bestScore) { bestScore = score; best = d; }
    });
    return best || days[0];
  }

  // „Doplnit objem" u partie pod MEV (typicky boční delty, lýtka): nejdřív zkusí přidat cvik,
  // který sval trénuje primárně, teprve pak přidává série. Nikdy nepřetáhne jiný sval nad MRV.
  function addVolume(plan, muscle) {
    var lm = LANDMARKS[muscle]; if (!lm || !plan || !plan.days) return false;
    var g = plan.goal || GOALS.svaly, pool = plan.pool || [], changed = false;
    function cur() {
      var hit = planVolume(plan).filter(function (v) { return v.muscle === muscle; });
      return hit.length ? hit[0].sets : 0;
    }
    function anyOver() { return planVolume(plan).some(function (v) { return v.sets > v.lm.mrv; }); }

    var used = {};
    plan.days.forEach(function (d) { d.exercises.forEach(function (pe) { used[pe.ex.id] = 1; }); });

    // nový cvik na daný sval; loadedOnly = drž prioritu vybavení stejně jako při stavbě plánu
    function tryAddExercise(loadedOnly) {
      var cand = pool.filter(function (e) {
        if (used[e.id] || e.pattern === 'kardio') return false;
        var mm = musclesFromDb(e.muscle, e.pattern, e.name);
        return !!mm && mm.primary.indexOf(muscle) !== -1;
      });
      if (loadedOnly) cand = cand.filter(isLoaded);
      if (!cand.length) return false;
      cand.sort(function (a, b) { return orderRank(b.pattern) - orderRank(a.pattern); });   // izolace/core dřív
      var pick = cand[0], need = Math.ceil(lm.mev - cur());
      var day = bestDayFor(plan.days, muscle);
      day.exercises.push({ ex: pick, sets: Math.max(MIN_SETS, Math.min(g.sets, need)), reps: g.accessReps, access: true });
      if (anyOver()) { day.exercises.pop(); return false; }
      day.exercises.sort(function (a, b) { return orderRank(a.ex.pattern) - orderRank(b.ex.pattern); });
      used[pick.id] = 1; changed = true;
      return true;
    }

    // série navíc u cviku, který sval trénuje primárně
    function tryAddSet() {
      var c = contributorsFor(plan.days, muscle).filter(function (x) { return x.primary && x.pe.sets < g.sets; });
      for (var i = 0; i < c.length; i++) {
        c[i].pe.sets++;
        if (anyOver()) { c[i].pe.sets--; continue; }
        changed = true; return true;
      }
      return false;
    }

    // Pořadí záměrně: nejdřív plnohodnotný cvik, pak série u stávajících, a teprve nakonec
    // cvik na gumu/tělo. Jinak by ve vybaveném fitku přibyla guma i tam, kde stačí přidat sérii.
    var loadedOnly = plan.equip === 'vse';
    for (var guard = 0; guard < 40 && cur() < lm.mev; guard++) {
      if (tryAddExercise(loadedOnly)) continue;
      if (tryAddSet()) continue;
      if (loadedOnly && tryAddExercise(false)) continue;
      break;
    }

    plan.volume = planVolume(plan);
    plan.coverage = planCoverage(plan);
    return changed;
  }

  function buildPlan(db, opts) {
    opts = opts || {};
    var seed = opts.seed || 0;
    var pool = filterDb(db, opts);
    setMuscleDb(db);
    var g = GOALS[opts.goal] || GOALS.svaly;
    var split = splitFor(opts.days);
    var days = [];
    var usedWeek = {};   // pestrost napříč celým týdnem: preferuj cviky tento týden nepoužité

    // preferuj kandidáty, kteří se tento týden ještě neobjevili; teprve když dojdou, opakuj
    function pickVaried(cand, idx) {
      var fresh = cand.filter(function (e) { return !usedWeek[e.id]; });
      var list = fresh.length ? fresh : cand;
      return list[((idx % list.length) + list.length) % list.length];
    }

    split.forEach(function (entry, di) {
      var dayName = entry[0], slots = entry[1];
      var used = {}, exercises = [];
      slots.forEach(function (slot, si) {
        var cand = pool.filter(function (e) { return (slot.by === 'pattern' ? e.pattern === slot.val : e.muscle === slot.val) && !used[e.id]; });
        // fallback: když na vzor nic není (např. doma/telo), zkus podle partie blízké vzoru
        if (!cand.length && slot.by === 'pattern') {
          var mm = musMap[slot.val];
          cand = pool.filter(function (e) { return e.muscle === mm && !used[e.id]; });
        }
        // access (doplňkový) svalový slot preferuj jako IZOLACI — ať M('ramena',true) dá boční/zadní
        // delty (ne druhý tlak nad hlavu) a M('prsa',true) rozpažku (ne další bench). Když izolace
        // není, spadne zpět na cokoli pro daný sval.
        if (slot.by === 'muscle' && slot.access) {
          var iso = cand.filter(function (e) { return e.pattern === 'izolace' || e.pattern === 'core'; });
          if (iso.length) cand = iso;
        }
        if (!cand.length) return;
        cand = preferLoaded(cand, opts.equip);
        var pick = pickVaried(cand, seed + di * 3 + si);
        used[pick.id] = 1; usedWeek[pick.id] = 1;
        exercises.push({
          ex: pick,
          sets: slot.access ? Math.max(2, g.sets - 1) : g.sets,
          reps: slot.access ? g.accessReps : g.reps
        });
      });

      // cílové svaly dne (pro doplnění „hubených" dnů z blízkých svalů)
      var dayMuscles = {};
      slots.forEach(function (slot) {
        if (slot.by === 'muscle') dayMuscles[slot.val] = 1;
        else if (musMap[slot.val]) dayMuscles[musMap[slot.val]] = 1;
      });

      // kardio finisher u cílů hubnutí/kondice + vytrvalost
      if (opts.goal === 'kondice' || opts.goal === 'vydrz') {
        var cardio = pool.filter(function (e) { return e.pattern === 'kardio' && !used[e.id]; });
        if (cardio.length) {
          var cpick = pickVaried(cardio, seed + di);
          used[cpick.id] = 1; usedWeek[cpick.id] = 1;
          exercises.push({ ex: cpick, sets: 1, reps: '10–20 min' });
        }
      }

      // backfill proti „hubeným" dnům (min ~4 cviky z cílových svalů dne)
      var bpool = preferLoaded(pool.filter(function (e) { return dayMuscles[e.muscle] && !used[e.id]; }), opts.equip);
      var bi = 0;
      while (exercises.length < 4 && bi < bpool.length) {
        var be = bpool[(seed + di + bi) % bpool.length];
        bi++;
        if (used[be.id]) continue;
        used[be.id] = 1; usedWeek[be.id] = 1;
        exercises.push({ ex: be, sets: Math.max(2, g.sets - 1), reps: g.accessReps });
      }

      // pořadí cviků: velké spoje → izolace → core → kardio (stabilní řazení)
      exercises.sort(function (a, b) { return orderRank(a.ex.pattern) - orderRank(b.ex.pattern); });

      days.push({ name: dayName, day: di + 1, exercises: exercises });
    });

    // objem srovnej PŘED vrácením plánu — uživatel nemá dostat plán, o kterém mu tabulka rovnou řekne „uber"
    autoBalance(days);

    return { days: days, goal: g, rest: g.rest, pool: pool, equip: opts.equip, poolSize: pool.length, coverage: planCoverage({ days: days }), volume: planVolume({ days: days }) };
  }

  global.WorkoutGen = { buildPlan: buildPlan, planCoverage: planCoverage, planVolume: planVolume, addVolume: addVolume, GOALS: GOALS,
    muscles: { musclesFromDb: musclesFromDb, matchMuscles: matchMuscles, resolveMuscles: resolveMuscles, weeklySetsByMuscle: weeklySetsByMuscle, setDb: setMuscleDb, LANDMARKS: LANDMARKS, zoneFor: zoneFor, LABELS: MUS_LABEL, ORDER: MUS_ORDER } };
})(window);
