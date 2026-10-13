/* /en/workout/ : stejné vstupy jako český generátor, texty z MBWorkoutEN. Engine se nemění. */
(function () {
  'use strict';
  var FN = 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/en-lead';
  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  var CONTACT = 'martin@martinbarna.cz';
  var MSG = {
    name: 'Please enter your first name.',
    email: "That email doesn't look right. Check it and try again.",
    consent: "Tick the box so I'm allowed to send you the kit.",
    need: 'Build a plan first.',
    server: 'Something went wrong on my side. Try again in a minute, or write to ' + CONTACT + '.',
    rate: 'Too many tries from your connection. Try again later, or write to ' + CONTACT + '.',
    db: 'The exercise list did not load. Refresh the page.',
    few: 'Not enough exercises for this place and equipment. Try different equipment.'
  };
  var STRUCT_TEXT = {
    min_cviku: 'Fewer exercises in the session, five to six sets each. For someone who wants to go deep on a few basic lifts.',
    standard: 'Four sets each. The middle option, and the default.',
    vic_cviku: 'More exercises, two to three sets each. Sometimes four on a weaker muscle so the weekly sets stay. For someone who wants more angles.'
  };
  var REPS_TEXT = {
    tezsi: 'Fewer reps and heavier weight. A bit more strength. Muscle still grows if the last set is close to your limit. For someone who likes lifting heavy.',
    standard: 'Reps and rests follow the goal you picked. The default.',
    lehci: 'More reps, a medium weight, shorter rests. Muscle and strength still grow if the last set gets close to your limit. For someone who likes longer sets.'
  };
  var TRIM_TEXT = {
    velke: 'Squats, deadlifts, bench presses and pull-ups stay whole. Extra exercises lose sets first. Fits most people.',
    pestrost: 'Keep as many different exercises as you can, even if a big lift loses a set or two. For someone who likes variety.',
    auto: 'The generator cuts whichever piece disturbs the plan the least.'
  };
  var $ = function (id) { return document.getElementById(id); };
  var DB = null, seed = 0, vymeny = {}, lastOpts = null, lastPlan = null;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; });
  }
  function opts() {
    return {
      location: $('location').value,
      equip: $('equip').value,
      level: $('level').value,
      goal: $('goal').value,
      days: +$('daysCount').value,
      seed: seed,
      orezStyl: $('orezStyl').value,
      struktura: $('struktura').value,
      opakovani: $('opakovani').value
    };
  }
  function bindExplain(selId, outId, map) {
    var sel = $(selId), out = $(outId);
    function go() { out.textContent = map[sel.value] || ''; }
    sel.addEventListener('change', go);
    go();
  }

  document.querySelectorAll('.navlinks a').forEach(function (a) {
    a.addEventListener('click', function () { var t = $('navtgl'); if (t) t.checked = false; });
  });
  bindExplain('struktura', 'strukturaVysvetleni', STRUCT_TEXT);
  bindExplain('opakovani', 'opakovaniVysvetleni', REPS_TEXT);
  bindExplain('orezStyl', 'orezVysvetleni', TRIM_TEXT);

  fetch('/assets/exercise-db.json?v=20260906b').then(function (r) { return r.json(); }).then(function (d) {
    window.MBWorkoutEN.assertComplete(d);
    DB = d;
    $('dbstate').textContent = d.length + ' exercises ready';
  }).catch(function () { $('dbstate').textContent = MSG.db; });

  function coZmeniTuknuti() {
    var cerstvy = window.WorkoutGen.buildPlan(DB, lastOpts || opts());
    var ted = window.WorkoutGen.pouzijVymeny(cerstvy, vymeny);
    var m = {};
    cerstvy.days.forEach(function (d, i) {
      d.exercises.forEach(function (pe, j) {
        if (pe.ex.pattern === 'kardio') return;
        var klic = i + ':' + pe.ex.id;
        var zkus = window.WorkoutGen.dalsiVymena(cerstvy, vymeny, klic);
        var po = window.WorkoutGen.pouzijVymeny(cerstvy, zkus);
        m[klic] = po.days[i].exercises[j].ex.id !== ted.days[i].exercises[j].ex.id;
      });
    });
    return m;
  }

  function render(plan) {
    lastPlan = plan;
    var view = window.MBWorkoutEN.present(plan, lastOpts || opts());
    var zmeni = coZmeniTuknuti();
    var html = '';
    plan.days.forEach(function (d, di) {
      var day = view.days[di];
      html += '<div class="day"><h3>' + esc(day.name) + ' <small>' + day.count + ' exercises</small></h3>';
      day.exercises.forEach(function (it, j) {
        var raw = d.exercises[j];
        var klic = di + ':' + (raw.puvodniId || raw.ex.id);
        var lze = raw.ex.pattern !== 'kardio' && zmeni[klic] === true;
        var btn = lze ? '<button type="button" class="swap" data-swap="' + esc(klic) + '">Swap this exercise</button>' : '';
        html += '<div class="row"><img src="/assets/cviky/' + esc(it.id) + '.jpg" alt="" width="62" height="46" loading="lazy" onerror="this.remove()"><div><b>' + esc(it.name) + '</b>' +
          (it.tip ? '<span class="tip">' + esc(it.tip) + '</span>' : '') + btn + '</div><div class="sr">' + esc(it.sets) + ' × ' + esc(it.reps) + '</div></div>';
      });
      html += '</div>';
    });
    $('days').innerHTML = html;
    $('restnote').textContent = 'Rest between sets about ' + view.rest + '. Goal: ' + view.goalLabel + '. Leave 1 to 3 reps in reserve. Do not go to failure on every set. When you hit the top of the rep range cleanly on every set, add a little weight or a rep. After 4 to 6 weeks, take an easier week. This plan is a starting point. Adjust it for your technique and how well you recover.';
    $('byline').textContent = view.goalLabel;
    $('result').hidden = false;
    $('lead-box').hidden = false;
  }

  function generate(newSeed) {
    if (!DB || !window.WorkoutGen || !window.MBWorkoutEN) { $('dbstate').textContent = MSG.db; return; }
    if (newSeed) seed++;
    vymeny = {};
    lastOpts = opts();
    var plan = window.WorkoutGen.buildPlan(DB, lastOpts);
    if (!plan.poolSize) { $('dbstate').textContent = MSG.few; return; }
    $('dbstate').textContent = DB.length + ' exercises ready';
    render(plan);
    if (window.matchMedia('(max-width: 800px)').matches) $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('days').addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-swap]') : null;
    if (!b || !lastPlan) return;
    var k = b.getAttribute('data-swap');
    var cerstvy = window.WorkoutGen.buildPlan(DB, lastOpts || opts());
    vymeny = window.WorkoutGen.dalsiVymena(cerstvy, vymeny, k);
    lastPlan = window.WorkoutGen.pouzijVymeny(cerstvy, vymeny);
    render(lastPlan);
  });
  $('gen').addEventListener('click', function () { generate(false); });
  $('regen').addEventListener('click', function () { generate(true); });

  function utmNow() {
    var out = {}, attr = {};
    try { attr = (window.MBAttr && window.MBAttr.get) ? window.MBAttr.get() : {}; } catch (e) { attr = {}; }
    var qs = new URLSearchParams(location.search);
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) {
      var v = String(attr[k] || qs.get(k) || '').trim().slice(0, 80);
      if (v) out[k] = v;
    });
    return out;
  }
  function fail(text, field) {
    var err = $('lead-err');
    err.textContent = text;
    err.hidden = false;
    if (field && field.focus) field.focus();
  }
  function send(payload) {
    var attempt = 0;
    function go() {
      attempt++;
      return fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function (r) {
          return r.json().catch(function () { return null; }).then(function (j) { return { status: r.status, ok: r.ok && !!(j && j.ok) }; });
        })
        .catch(function () { return { status: 0, ok: false }; })
        .then(function (res) {
          if (!res.ok && attempt < 2 && (res.status === 0 || res.status >= 500)) {
            return new Promise(function (ok) { setTimeout(ok, 1500); }).then(go);
          }
          return res;
        });
    }
    return go();
  }

  $('lead-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    $('lead-err').hidden = true;
    if (!lastPlan || !lastOpts) return fail(MSG.need, null);
    if (!f.first_name.value.trim()) return fail(MSG.name, f.first_name);
    if (!EMAIL_RE.test(f.email.value.trim())) return fail(MSG.email, f.email);
    if (!f.consent.checked) return fail(MSG.consent, f.consent);
    var payload = {
      kind: 'workout',
      first_name: f.first_name.value.trim(),
      email: f.email.value.trim(),
      consent: true,
      consent_text: ($('lead-consent-text').textContent || '').replace(/\s+/g, ' ').trim(),
      website: f.website.value,
      referrer: document.referrer || '',
      calc: null,
      plan_summary: window.MBWorkoutEN.summary(lastOpts, lastPlan)
    };
    var utm = utmNow();
    Object.keys(utm).forEach(function (k) { payload[k] = utm[k]; });
    var btn = f.querySelector('button[type="submit"]');
    btn.disabled = true;
    send(payload).then(function (res) {
      btn.disabled = false;
      if (!res.ok) return fail(res.status === 429 ? MSG.rate : MSG.server, null);
      $('lead-ok-name').textContent = payload.first_name;
      f.hidden = true;
      $('lead-ok').hidden = false;
      try { if (window.mbTrackLead) window.mbTrackLead('en_workout'); } catch (e2) {}
      try { if (window.MBAttr && window.MBAttr.smazZrcadlo) window.MBAttr.smazZrcadlo(); } catch (e3) {}
    });
  });
})();
