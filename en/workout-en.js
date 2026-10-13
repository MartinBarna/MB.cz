/* martinbarna.cz/en/workout/ : anglická vrstva NAD assets/workout-gen.js (13. 10. 2026).
   Engine se nemění. Tahle vrstva jen přeloží názvy dnů, cviků a tipy a složí krátký
   plan_summary (co si člověk vybral, bez jména, e-mailu a tělesných údajů).
   Chybějící překlad cviku nebo tipu = výjimka, ať test spadne, ne ať na stránce
   zůstane čeština. Výpočet (které cviky, série, opakování) je bajtově z enginu. */
(function (global) {
  'use strict';

  var DAYS = {
    'Trénink A (celé tělo)': 'Workout A (full body)',
    'Trénink B (celé tělo)': 'Workout B (full body)',
    'Trénink C (celé tělo)': 'Workout C (full body)',
    'Horní partie A': 'Upper body A',
    'Dolní partie A': 'Lower body A',
    'Horní partie B': 'Upper body B',
    'Dolní partie B': 'Lower body B',
    'Push (tlaky)': 'Push',
    'Pull (tahy)': 'Pull',
    'Nohy': 'Legs',
    'Horní partie': 'Upper body',
    'Dolní partie': 'Lower body'
  };

  var GOALS = {
    sila: 'Strength',
    svaly: 'Muscle (hypertrophy)',
    kondice: 'Fat loss and conditioning',
    vydrz: 'Endurance and tone'
  };

  var PLACE = { fitko: 'Gym', doma: 'Home', hriste: 'Outdoor' };
  var EQUIP = { vse: 'full equipment', cinky: 'dumbbells or kettlebell', telo: 'bodyweight only' };
  var LEVEL = { zacatecnik: 'beginner', pokrocily: 'intermediate', zkuseny: 'advanced' };
  var STRUCT = {
    min_cviku: 'fewer exercises, more sets',
    standard: 'standard structure',
    vic_cviku: 'more exercises, fewer sets'
  };
  var REPS = {
    tezsi: 'heavier, fewer reps',
    standard: 'standard reps',
    lehci: 'medium weight, more reps'
  };
  var TRIM = {
    velke: 'keep the big lifts',
    pestrost: 'keep variety',
    auto: 'generator decides what to cut'
  };

  // id z exercise-db.json -> [anglický název, anglický tip]. Tip je 1:1 smysl českého tipu.
  var EX = {
    'drep-velka-cinka': ['Barbell back squat', 'Push your knees out, keep the weight on your heels and your chest up.'],
    'drep-vlastni-vaha': ['Bodyweight squat', 'Sit back as if onto a chair. Do not let your knees cave in.'],
    'goblet-drep': ['Goblet squat with a kettlebell', 'Keep your elbows between your knees and your back straight the whole way.'],
    'drep-cinky-pred-telem': ['Barbell front squat', 'Keep your elbows high, rest the bar on the front of your shoulders and stay upright.'],
    'leg-press': ['Leg press', 'Do not lock your knees at the top. Push through your heels.'],
    'hack-drep': ['Hack squat', 'Keep your back against the pad and track your knees over your toes.'],
    'bulharsky-drep': ['Bulgarian split squat', 'Front knee over the ankle. Drop straight down, not forward.'],
    'vypad-vpred': ['Forward lunge', 'Lower the back knee toward the floor and keep your torso upright.'],
    'vypad-vzad': ['Reverse lunge', 'Keep the step back stable. Leave the weight on the front heel.'],
    'chodici-vypady': ['Walking lunges', 'Drop straight down on each step, not forward over the front toes.'],
    'bocni-vypad': ['Lateral lunge', 'Sit sideways into the bent leg. Keep the other leg straight.'],
    'leg-extension': ['Leg extension', 'Pause at the top and squeeze the thigh, then lower under control.'],
    'leg-curl-lezici': ['Lying leg curl', 'Keep your hips on the bench and pull the pad to your glutes with your heels.'],
    'step-up': ['Step-up', 'Push all the force through the heel of the top foot.'],
    'wall-sit': ['Wall sit', 'Thighs parallel to the floor, your whole back pressed to the wall.'],
    'vyskok-z-drepu': ['Jump squat', 'Land softly on the balls of your feet and bend your knees to absorb it.'],
    'pistol-drep': ['Pistol squat', 'Keep the heel down and push the knee toward the toes.'],
    'sumo-drep': ['Sumo squat with a kettlebell', 'Toes out, push the knees out to the sides and squeeze the glutes at the top.'],
    'vyskoky-na-bednu': ['Box jump', 'Land in a slight squat. Do not land on locked legs.'],
    'drep-s-gumou': ['Band squat', 'Push your knees out against the band so the glutes work too.'],
    'bench-press': ['Barbell bench press', 'Pinch your shoulder blades together and lower the bar to the lower chest.'],
    'bench-press-jednorucky': ['Dumbbell bench press', 'Keep your elbows at about 45 degrees. You should feel a stretch in the chest at the bottom.'],
    'bench-sikma-cinky': ['Incline dumbbell press', 'Set the bench to about 30 degrees and aim at the upper chest.'],
    'bench-sikma-cinka': ['Incline barbell bench press', 'Lower the bar to the upper chest with your shoulder blades pinched.'],
    'kliky': ['Push-up', 'Keep your body in one straight line. Elbows slightly back, not flared out.'],
    'kliky-na-kolenou': ['Knee push-up', 'Keep a straight line from your knees to your head. Do not sag at the lower back.'],
    'diamantove-kliky': ['Diamond push-up', 'Hands together under the chest, elbows close to your body.'],
    'kliky-sikme-nohy-nahore': ['Feet-elevated push-up', 'Feet higher loads the upper chest. Keep your body tight.'],
    'kliky-o-lavku': ['Incline push-up', 'Hands on a bench. An easier version while you learn the form.'],
    'rozpazovani-cinky': ['Dumbbell fly', 'Keep a slight bend in the elbows and move in an arc, not a press.'],
    'peck-deck': ['Pec deck fly', 'Squeeze the chest briefly in front, then return slowly.'],
    'kladka-stahovani-prsa': ['Cable chest fly', 'Bring your hands together in front of your body. Keep a slight bend in the elbows.'],
    'tlak-na-stroji-prsa': ['Chest press machine', 'Back against the pad. Press fully, but do not lock the elbows.'],
    'kliky-s-gumou': ['Banded push-up', 'The band adds resistance at the top. Keep your body tight like a plank.'],
    'mrtvy-tah': ['Barbell deadlift', 'Keep your back flat, drag the bar close to your shins and push the hips back.'],
    'rumunsky-mrtvy-tah': ['Romanian deadlift', 'Push the hips back, bend the knees only a little, and feel the hamstrings.'],
    'rumunsky-tah-jednorucky': ['Dumbbell Romanian deadlift', 'Run the dumbbells along your thighs, keep the back flat and the chest forward.'],
    'veslovani-cinka': ['Barbell bent-over row', 'Tip the torso forward, pull the bar to your navel and pinch the shoulder blades.'],
    'veslovani-jednorucka': ['One-arm dumbbell row', 'Drive the elbow back along your body and pinch the shoulder blade at the end.'],
    'veslovani-kladka': ['Seated cable row', 'Keep the back flat. Pull with the elbows, not the hands, and pinch the shoulder blades.'],
    'lat-pulldown': ['Lat pulldown', 'Pull the elbows down toward your sides and bring the chest toward the bar.'],
    'shyby-nadhmat': ['Pull-up', 'Start by pulling the shoulder blades down. Chin over the bar, lower under control.'],
    'shyby-podhmat': ['Chin-up', 'The underhand grip uses more biceps. Pull the elbows down along your body.'],
    'shyby-s-gumou': ['Band-assisted pull-up', 'The band helps at the bottom. Focus on pulling the shoulder blades down.'],
    'australske-shyby': ['Inverted row', 'Keep your body in a straight line and pull your chest to the bar.'],
    'veslo-trx': ['TRX row', 'Brace like a plank, elbows along your sides, and pinch the shoulder blades.'],
    'pritahy-gumy': ['Seated band row', 'Pull the elbows back and pinch the shoulder blades together at the end.'],
    'stahovani-gumy-shora': ['Band lat pulldown', 'Anchor the band overhead and pull the elbows down toward your sides.'],
    'tah-na-stroji-zada': ['Chest-supported row', 'Chest on the pad. Pull the elbows as far back as you can.'],
    'superman': ['Superman', 'Lift your arms and legs together and pause briefly at the top.'],
    'tlak-nad-hlavu-cinka': ['Barbell overhead press', 'Brace your abs, press the bar overhead in a straight line, and do not flare the ribs.'],
    'tlak-nad-hlavu-jednorucky': ['Dumbbell overhead press', 'Elbows under the wrists. Do not lock out hard at the top.'],
    'arnold-tlak': ['Arnold press', 'Start with the palms facing you and rotate the wrists out as you press.'],
    'tlak-na-stroji-ramena': ['Shoulder press machine', 'Back against the pad. Press smoothly and do not lock the elbows.'],
    'upazovani-cinky': ['Dumbbell lateral raise', 'Lead with the elbows, not the hands, and do not go above shoulder height.'],
    'predpazovani-cinky': ['Dumbbell front raise', 'Lift to shoulder height. Do not swing your body or help with the lower back.'],
    'upazovani-v-predklonu': ['Bent-over reverse fly', 'Tip the torso forward, lead the elbows out to the sides and pinch the shoulder blades.'],
    'upazovani-guma': ['Band lateral raise', 'Lead through the elbows out to the side and control the way back.'],
    'tlak-nad-hlavu-guma': ['Band overhead press', 'Stand on the band, press overhead in a straight line and brace your abs.'],
    'pike-push-up': ['Pike push-up', 'Hips high, and lower the top of your head toward the floor.'],
    'handstand-push-up': ['Wall handstand push-up', 'Stay tight against the wall and lower under control with the top of your head.'],
    'shrugy-cinky': ['Dumbbell shrug', 'Shrug straight up toward your ears. Do not roll the shoulders back.'],
    'biceps-zdvih-cinky': ['Dumbbell biceps curl', 'Elbows at your sides. Do not swing the torso. Only the forearms move.'],
    'biceps-zdvih-velka-cinka': ['Barbell biceps curl', 'Elbows fixed at your sides. Lower the bar slowly.'],
    'kladivove-zdvihy': ['Hammer curl', 'Palms face each other the whole time. Elbows stay at your sides.'],
    'koncentrovany-zdvih': ['Concentration curl', 'Brace the elbow on the inner thigh and squeeze the biceps at the top.'],
    'biceps-kladka': ['Cable biceps curl', 'Elbows at your sides. Keep tension even at the bottom.'],
    'biceps-guma': ['Band biceps curl', 'Stand on the band, elbows at your sides, and lift only the forearms.'],
    'biceps-kettlebell': ['Kettlebell biceps curl', 'Wrist firm, elbows at your sides, move under control.'],
    'shyby-uzky-podhmat': ['Close-grip chin-up', 'Narrow underhand grip. Pull the elbows down and focus on the biceps.'],
    'triceps-stahovani-kladka': ['Triceps pushdown', 'Elbows fixed at your sides. Only the forearms move down.'],
    'triceps-francouzsky-tlak': ['Overhead dumbbell triceps extension', 'Elbows by your head and still. Lower the dumbbell behind your head.'],
    'triceps-kickback': ['Dumbbell triceps kickback', 'Elbow high by your side and straighten the arm fully at the back.'],
    'dipy-na-lavicce': ['Bench dip', 'Elbows back, not out, and drop straight down.'],
    'dipy-na-bradlech': ['Bar dip', 'Torso upright, elbows close to the body, lower to about a right angle.'],
    'triceps-kliky-uzke': ['Close-grip push-up', 'Hands about shoulder width, elbows tight along the torso.'],
    'triceps-cinka-za-hlavu': ['Seated overhead dumbbell extension', 'Elbows by your ears, pointing up. Lower the dumbbell behind your head.'],
    'triceps-guma': ['Band triceps pushdown', 'Elbows fixed at your sides. Straighten the arms fully against the band.'],
    'triceps-kladka-nad-hlavu': ['Overhead cable triceps extension', 'Elbows high and still. Straighten the arms forward.'],
    'triceps-velka-cinka-vleze': ['Lying barbell skull crusher', 'Lower the bar toward the forehead. Elbows stay stable and point up.'],
    'plank': ['Plank', 'Body in a straight line. Brace the abs and glutes. Do not tuck the pelvis hard.'],
    'plank-bocni': ['Side plank', 'Lift the hip and keep the body in one line. Do not let the hip drop.'],
    'sklapovacky': ['Sit-up', 'Press the lower back into the floor and lift the shoulder blades, not the whole torso with a swing.'],
    'zkracovacky': ['Crunch', 'Lift only the shoulder blades and breathe out. Do not pull the neck with your hands.'],
    'leg-raises': ['Lying leg raise', 'Keep the lower back pressed to the floor and lower the legs slowly.'],
    'hanging-leg-raises': ['Hanging leg raise', 'Do not swing. Lift the knees to the chest with the abs.'],
    'mountain-climbers': ['Mountain climber', 'Hips low, in line with the back. Drive the knees toward the chest.'],
    'rusky-twist': ['Russian twist', 'Lean the torso back, rotate from the waist and keep the abs braced.'],
    'dead-bug': ['Dead bug', 'Lower back pressed down. Reach the opposite arm and leg out slowly.'],
    'hollow-hold': ['Hollow hold', 'Press the lower back to the floor. Shoulders and legs stay low off the floor.'],
    'kolo-na-bricho': ['Bicycle crunch', 'Elbow toward the opposite knee. Rotate from the torso, not the neck.'],
    'kolibka': ['Plank knee tuck', 'From a plank, pull the knees toward the chest and keep the hips low.'],
    'ab-rollout': ['Ab wheel rollout', 'Tuck the pelvis a little and roll only as far as you can keep the back flat.'],
    'v-sklapovacky': ['V-up', 'Lift the torso and the legs together into a V, then lower slowly.'],
    'plank-na-dlanich': ['Plank shoulder tap', 'Keep the hips still. Tap one hand to the opposite shoulder.'],
    'leg-raises-lavka': ['Seated bench knee raise', 'Hold the edge of the bench, lean back and pull the knees to the chest.'],
    'hip-thrust': ['Barbell hip thrust', 'Squeeze the glutes hard at the top, chin tucked, ribs down.'],
    'hip-thrust-jednonoz': ['Single-leg hip thrust', 'Shoulder blades on a bench. Squeeze the working glute at the top.'],
    'glute-bridge': ['Glute bridge', 'Push through the heels and squeeze the glutes at the top. Do not overarch the lower back.'],
    'glute-bridge-jednonoz': ['Single-leg glute bridge', 'Keep the pelvis level. Push through the heel and squeeze the glute at the top.'],
    'kickback-guma': ['Band donkey kick', 'Push the heel toward the ceiling and squeeze the glute. Do not arch the lower back.'],
    'unozovani-guma': ['Standing band hip abduction', 'Move the leg out to the side from the glute. Keep the torso upright and stable.'],
    'kickback-kladka': ['Cable glute kickback', 'Pull the leg back from the glute and pause briefly at the end.'],
    'kettlebell-swing': ['Kettlebell swing', 'The drive comes from the glutes, not the shoulders. The kettlebell floats to chest height.'],
    'abdukce-stroj': ['Hip abduction machine', 'Lean the torso slightly forward and press the knees out slowly.'],
    'frog-pumps': ['Frog pump', 'Soles of the feet together, knees out, squeeze the glutes hard at the top.'],
    'vypony-stoje': ['Standing calf raise', 'Rise as high as you can onto the toes and lower slowly into a stretch.'],
    'vypony-stroj': ['Standing calf raise machine', 'Use the full range: lower the heel below the step.'],
    'vypony-vsede': ['Seated calf raise', 'Aim at the lower part of the calf. Pause briefly at the top.'],
    'vypony-jednonoz': ['Single-leg calf raise', 'Hold something for balance and rise as high as you can.'],
    'burpees': ['Burpee', 'Keep the back flat in the push-up and finish the jump with the body fully straight.'],
    'svihadlo': ['Jump rope', 'Bounce from the ankles. Turn the rope with the wrists, not the arms.'],
    'jumping-jacks': ['Jumping jack', 'Keep a rhythm, land softly on the balls of the feet and take the arms overhead.'],
    'high-knees': ['High knees', 'Lift the knees to about hip height and stay on the balls of the feet.'],
    'veslo-trenazer': ['Rowing machine', 'Drive with the legs, then the torso, then the arms, in that order.'],
    'kettlebell-clean-press': ['Kettlebell clean and press', 'Drive from the glutes, catch the kettlebell at the shoulder, then press it overhead.'],
    'thruster': ['Thruster', 'From the bottom of the squat, flow straight into the overhead press in one move.'],
    'bear-crawl': ['Bear crawl', 'Knees just off the floor. Move the opposite hand and foot together.'],
    'sprint': ['Sprint', 'Start from a slight forward lean and drive the knees forward.'],
    'beh': ['Easy run', 'Land under your body, breathe steadily and keep the shoulders relaxed.'],
    'rumunsky-tah-jednonoz': ['Single-leg Romanian deadlift', 'The back leg reaches back as a counterbalance. Keep the hips level, like a tray of water.'],
    'hip-thrust-jednorucka': ['Dumbbell hip thrust', 'Squeeze the glutes at the top and pause. Ribs down. Do not arch the lower back.'],
    'zakopavani-slider': ['Slider leg curl', 'Keep the hips up the whole time. If they drop, the lower back took the work from the hamstrings.'],
    'dobre-rano-guma': ['Band good morning', 'Hips back, not knees down. This is not a squat. It is a hip hinge, like closing a door with your hips.'],
    'upazovani-kladka': ['One-arm cable lateral raise', 'Lead with the elbow, not the hand. Shoulder height is enough. Higher than that and the traps take over.'],
    'face-pull-guma': ['Band face pull', 'Pull the elbows high and out. Hands finish by the ears. Shoulders stay down, not up by the ears.'],
    'rozpazovani-trx': ['TRX reverse fly', 'Body in a straight line from head to heels, arms long, the pull comes from the rear shoulders. Where you put your feet changes how hard it is.'],
    'zvedani-pazi-t-vleze': ['Prone T raise', 'Thumbs point to the ceiling, forehead stays down. The range is small. Hold for a second at the top.']
  };

  function need(map, key, what) {
    if (!Object.prototype.hasOwnProperty.call(map, key) || !map[key]) {
      throw new Error('missing ' + what + ' translation: ' + key);
    }
    return map[key];
  }

  /** Každý cvik v databázi musí mít název i tip. Jinak test spadne dřív, než plán vyjde česky. */
  function assertComplete(db) {
    var missing = [];
    (db || []).forEach(function (e) {
      var row = EX[e.id];
      if (!row || !row[0]) missing.push(e.id + ' name');
      else if (e.tip && !row[1]) missing.push(e.id + ' tip');
    });
    if (missing.length) throw new Error('missing translation: ' + missing.join(', '));
  }

  /**
   * Anglický pohled na plán z WorkoutGen.buildPlan. id, série a opakování beze změny.
   * opts.goal je klíč enginu (sila, svaly, kondice, vydrz).
   */
  function present(plan, opts) {
    if (!plan || !plan.days) throw new Error('missing plan');
    var goalKey = opts && opts.goal;
    var days = plan.days.map(function (d) {
      var name = need(DAYS, d.name, 'day');
      var exercises = (d.exercises || []).map(function (it) {
        var id = it.ex && it.ex.id;
        var row = EX[id];
        if (!row || !row[0]) throw new Error('missing exercise translation: ' + id);
        if (it.ex.tip && !row[1]) throw new Error('missing tip translation: ' + id);
        return { id: id, name: row[0], tip: it.ex.tip ? row[1] : '', sets: it.sets, reps: it.reps };
      });
      return { day: d.day, name: name, count: exercises.length, exercises: exercises };
    });
    return {
      days: days,
      goalLabel: need(GOALS, goalKey, 'goal'),
      rest: plan.rest,
      poolSize: plan.poolSize
    };
  }

  function pick(map, key) {
    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : '';
  }

  /** Krátký text do en_leads.message. Jen volby, žádné jméno, e-mail ani tělesné údaje. Max 500. */
  function summary(opts, plan) {
    opts = opts || {};
    var n = 0;
    if (plan && plan.days) plan.days.forEach(function (d) { n += (d.exercises || []).length; });
    var bits = [
      pick(PLACE, opts.location),
      pick(EQUIP, opts.equip),
      pick(LEVEL, opts.level),
      pick(GOALS, opts.goal),
      (opts.days ? String(opts.days) + ' days a week' : ''),
      pick(STRUCT, opts.struktura || 'standard'),
      pick(REPS, opts.opakovani || 'standard'),
      pick(TRIM, opts.orezStyl || 'velke')
    ].filter(Boolean);
    var text = bits.join(', ') + '. ' + n + ' exercises.';
    return text.length > 500 ? text.slice(0, 500) : text;
  }

  global.MBWorkoutEN = {
    present: present,
    summary: summary,
    assertComplete: assertComplete,
    DAYS: DAYS,
    GOALS: GOALS,
    EX: EX
  };
})(typeof window !== 'undefined' ? window : globalThis);
