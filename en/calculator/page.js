/* /en/calculator/ : formulář a zobrazení. Počítá jen MealGen přes MBCalcEN. */
(function () {
  'use strict';
  var FN = 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/en-lead';
  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  var CONTACT = 'martin@martinbarna.cz';
  var MSG = {
    name: 'Please enter your first name.',
    email: "That email doesn't look right. Check it and try again.",
    consent: "Tick the box so I'm allowed to send you the kit.",
    need: 'Calculate your numbers first, then I can email them.',
    server: 'Something went wrong on my side. Try again in a minute, or write to ' + CONTACT + '.',
    rate: 'Too many tries from your connection. Try again later, or write to ' + CONTACT + '.',
    engine: 'The calculator did not load completely. Please refresh the page.'
  };
  var $ = function (id) { return document.getElementById(id); };
  var last = null;

  function num(v) {
    var t = String(v || '').trim().replace(',', '.');
    return t === '' ? NaN : Number(t);
  }
  function fmt(n) {
    try { return Number(n).toLocaleString('en-US'); } catch (e) { return String(n); }
  }
  function units() {
    var r = document.querySelector('#calc-form input[name="units"]:checked');
    return r ? r.value : 'imperial';
  }
  function showUnits() {
    var imp = units() === 'imperial';
    document.querySelectorAll('#calc-form [data-units]').forEach(function (el) {
      el.hidden = (el.getAttribute('data-units') === 'imperial') !== imp;
    });
  }
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
  function selectedText(id) {
    var el = $(id);
    return el && el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '';
  }
  function paceLine(r) {
    var kg = Number(r.tempoKgTyden);
    if (!isFinite(kg)) return '';
    var lb = kg / window.MBCalcEN.LB_TO_KG;
    if (Math.abs(kg) < 0.005) return 'Pace: holding your weight, about 0 kg a week.';
    var dir = /narust|surplus|gain/i.test(selectedText('c-goal')) ? 'gain' : 'loss';
    if (r.calc && r.calc.goal === 'udrzeni') return 'Pace: holding your weight, about 0 kg a week.';
    return 'Pace: about ' + kg.toFixed(2) + ' kg (' + lb.toFixed(1) + ' lb) a week of ' + dir + '.';
  }

  document.querySelectorAll('.navlinks a').forEach(function (a) {
    a.addEventListener('click', function () { var t = $('navtgl'); if (t) t.checked = false; });
  });

  var form = $('calc-form');
  form.querySelectorAll('input[name="units"]').forEach(function (r) {
    r.addEventListener('change', function () {
      var LB = window.MBCalcEN.LB_TO_KG, IN = window.MBCalcEN.IN_TO_CM;
      if (units() === 'imperial') {
        var kg = num($('c-wkg').value), cm = num($('c-hcm').value);
        if (isFinite(kg)) $('c-wlb').value = String(Math.round(kg / LB));
        if (isFinite(cm)) {
          var tin = cm / IN, ft = Math.floor(tin / 12), inch = Math.round(tin - ft * 12);
          if (inch === 12) { ft += 1; inch = 0; }
          $('c-hft').value = String(ft);
          $('c-hin').value = String(inch);
        }
      } else {
        var lb = num($('c-wlb').value), f = num($('c-hft').value), i = num($('c-hin').value);
        if (isFinite(lb)) $('c-wkg').value = String(Math.round(lb * LB * 10) / 10);
        if (isFinite(f)) $('c-hcm').value = String(Math.round((f * 12 + (isFinite(i) ? i : 0)) * IN));
      }
      showUnits();
    });
  });
  showUnits();

  function readInputs() {
    return {
      units: units(), sex: $('c-sex').value, age: $('c-age').value,
      heightCm: $('c-hcm').value, heightFt: $('c-hft').value, heightIn: $('c-hin').value,
      weightKg: $('c-wkg').value, weightLb: $('c-wlb').value,
      activity: $('c-act').value, goal: $('c-goal').value
    };
  }

  function clearResult(message) {
    last = null;
    ['r-kcal', 'r-protein', 'r-fat', 'r-carbs', 'r-fiber'].forEach(function (id) { $(id).textContent = '-'; });
    $('r-meta').textContent = '';
    $('r-pace').textContent = '';
    $('r-notes').textContent = '';
    $('r-notes').hidden = true;
    $('calc-err').textContent = message || '';
    $('calc-err').hidden = !message;
    $('lead-box').hidden = true;
  }

  function render(r) {
    if (!r || !r.ok) { clearResult(r ? r.message : MSG.engine); return; }
    last = r;
    $('calc-err').hidden = true;
    $('r-kcal').textContent = fmt(r.kcal);
    $('r-protein').textContent = fmt(r.protein);
    $('r-fat').textContent = fmt(r.fat);
    $('r-carbs').textContent = fmt(r.carbs);
    $('r-fiber').textContent = fmt(r.fiber);
    $('r-meta').textContent = 'Basal metabolism ' + fmt(r.bmr) + ' kcal. Daily burn with activity ' + fmt(r.tdee) + ' kcal. Activity: ' + selectedText('c-act') + '. Goal: ' + selectedText('c-goal') + '.';
    $('r-pace').textContent = paceLine(r);
    var ul = $('r-notes');
    ul.textContent = '';
    (r.notes || []).forEach(function (n) {
      var li = document.createElement('li');
      li.textContent = n;
      ul.appendChild(li);
    });
    ul.hidden = !(r.notes && r.notes.length);
    $('lead-box').hidden = false;
    if (window.matchMedia('(max-width: 800px)').matches) $('calc-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!window.MealGen || !window.MBCalcEN) { clearResult(MSG.engine); return; }
    render(window.MBCalcEN.calculate(window.MealGen, readInputs()));
  });

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
    if (!last || !last.calc) return fail(MSG.need, null);
    if (!f.first_name.value.trim()) return fail(MSG.name, f.first_name);
    if (!EMAIL_RE.test(f.email.value.trim())) return fail(MSG.email, f.email);
    if (!f.consent.checked) return fail(MSG.consent, f.consent);
    var payload = {
      kind: 'calculator',
      first_name: f.first_name.value.trim(),
      email: f.email.value.trim(),
      consent: true,
      consent_text: ($('lead-consent-text').textContent || '').replace(/\s+/g, ' ').trim(),
      website: f.website.value,
      referrer: document.referrer || '',
      calc: last.calc
    };
    var utm = utmNow();
    Object.keys(utm).forEach(function (k) { payload[k] = utm[k]; });
    var btn = f.querySelector('button[type="submit"]');
    btn.disabled = true;
    send(payload).then(function (res) {
      btn.disabled = false;
      if (!res.ok) return fail(res.status === 429 ? MSG.rate : MSG.server, null);
      $('lead-ok-name').textContent = payload.first_name;
      $('lead-ok-kcal').textContent = fmt(last.kcal);
      $('lead-ok-protein').textContent = fmt(last.protein);
      $('lead-ok-fat').textContent = fmt(last.fat);
      $('lead-ok-carbs').textContent = fmt(last.carbs);
      f.hidden = true;
      $('lead-ok').hidden = false;
      try { if (window.mbTrackLead) window.mbTrackLead('en_calculator'); } catch (e2) {}
      try { if (window.MBAttr && window.MBAttr.smazZrcadlo) window.MBAttr.smazZrcadlo(); } catch (e3) {}
    });
  });
})();
