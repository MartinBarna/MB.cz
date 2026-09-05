// 🍽️ PRŮVODCE NA MÍRU: editor v kartě klienta (admin Barna Academy)
//
// Nahrazuje ruční psaní jídelníčku pro nového klienta. Martin otevře kartu klienta,
// zkontroluje cíle, odklikne vyloučení, nechá si napsat texty, prohlédne dva vzorové dny
// a uloží hotový dokument klientovi do jeho sekce.
//
// ROZDĚLENÍ ODPOVĚDNOSTI (nesmí se porušit, pravidlo 3 v CLAUDE.md appky):
//   • kalorie, makra, gramáže, součty, nákupní seznam ...... engine `MealGen`, deterministicky
//   • výběr potravin a skládání dnů ......................... engine
//   • převod „nemám rád ořechy" na seznam potravin .......... AI NAVRHNE, Martin odklikne
//   • úvod, rámečky, závěr .................................. AI napíše, Martin přepíše
//   • odeslání klientovi .................................... jen Martin, ručně
// ⛔ AI nikdy nesahá na čísla ani na dietní filtr. Do enginu jde jen to, co Martin zaškrtl.
//
// Závislosti (načítá si je sám, líně, až když Martin sekci otevře):
//   /assets/meal-gen.js   window.MealGen
//   /assets/food-db.json  1192 potravin s dietními tagy
//   ./pruvodce-sablona.js window.PruvodceSablona
(function (global) {
  'use strict';

  var FOOD = null;          // pole potravin, načte se jednou za život stránky
  var MG_URL = '/assets/meal-gen.js?v=20260905d';
  var DB_URL = '/assets/food-db.json?v=20260902c';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function num(v) {
    if (v == null) return null;
    var s = String(v).trim(); if (s === '') return null;
    var n = Number(s.replace(',', '.')); return isFinite(n) ? n : null;
  }
  function r0(n) { return Math.round(Number(n) || 0); }
  // bez diakritiky a malými písmeny, na hledání v názvech potravin
  function bezDia(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function dnesCz() {
    var d = new Date();
    return d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear();
  }
  function dnesIso() { return new Date().toISOString().slice(0, 10); }

  // ---- líné načtení enginu a databáze ----
  function nactiSkript(src) {
    return new Promise(function (ok, err) {
      if (document.querySelector('script[data-pg="' + src + '"]')) return ok();
      var s = document.createElement('script');
      s.src = src; s.setAttribute('data-pg', src);
      s.onload = function () { ok(); }; s.onerror = function () { err(new Error('nenacteno: ' + src)); };
      document.head.appendChild(s);
    });
  }
  function pripravEngine() {
    var kroky = [];
    if (!global.MealGen) kroky.push(nactiSkript(MG_URL));
    if (!global.PruvodceSablona) kroky.push(nactiSkript('/akademie/admin/pruvodce-sablona.js?v=20260905b'));
    return Promise.all(kroky).then(function () {
      if (FOOD) return FOOD;
      return fetch(DB_URL).then(function (r) { return r.json(); }).then(function (d) {
        FOOD = Array.isArray(d) ? d : (d.items || []);
        // ⛔ POJISTKA: bez dietních tagů umí generátor se zapnutým filtrem vrátit TICHO
        // (den s nulou položek, žádná chyba). Radši to řekneme rovnou. Táž past je
        // ošetřená i uvnitř meal-gen.js ve `filterDb`, tohle je jen dřívější a srozumitelnější.
        if (!FOOD.some(function (f) { return Array.isArray(f.obsahuje); })) {
          throw new Error('food-db.json nemá dietní tagy (pole `obsahuje`). Dietní filtr by tiše nefungoval.');
        }
        return FOOD;
      });
    });
  }

  // ---- odhad vstupů z dotazníku ----
  var AKTIVITA_MAP = [
    [/sedav/, 'sedavy'], [/lehce|lehk/, 'lehka'], [/stredn|aktivn/, 'stredni'],
    [/vysok|velmi/, 'vysoka'], [/extrem/, 'extremni']
  ];
  function odhadAktivity(t) {
    var s = bezDia(t);
    for (var i = 0; i < AKTIVITA_MAP.length; i++) if (AKTIVITA_MAP[i][0].test(s)) return AKTIVITA_MAP[i][1];
    return 'lehka';
  }
  function odhadCile(t) {
    var s = bezDia(t);
    if (/nabr|nabir|sval|prib|hmot/.test(s)) return 'narust';
    if (/zhub|hubn|zhod|tuk dol|shodit/.test(s)) return 'hubnuti';
    return 'udrzeni';
  }

  // Cíle: primárně `client_targets` (Martinovo zadání), jinak dopočet z dotazníku.
  // ⛔ Dopočet je NÁVRH v editovatelných polích, ne uložené zadání. Do `client_targets`
  // se odsud nic nezapisuje, ta tabulka má vlastní formulář výš v kartě a vlastní pravidla.
  function vychoziCile(targets, idata, rod) {
    var t = targets || {};
    var c = { kcal: num(t.kcal), protein: num(t.protein), carbs: num(t.carbs), fat: num(t.fat), fiber: num(t.fiber) };
    var zdroj = 'zadání klienta (client_targets)';
    if (c.kcal == null || c.protein == null) {
      var vaha = num(idata.vaha), vyska = num(idata.vyska), vek = num(idata.vek);
      if (global.MealGen && vaha && vyska && vek) {
        var v = global.MealGen.computeTargets({
          weight: vaha, height: vyska, age: vek, sex: rod === 'z' ? 'zena' : 'muz',
          activity: odhadAktivity(idata.aktivita), goal: odhadCile(idata.cil)
        });
        c = { kcal: v.kcal, protein: v.protein, carbs: v.carbs, fat: v.fat, fiber: v.fiber };
        zdroj = 'dopočet z dotazníku (zadání zatím není uložené), zkontroluj čísla';
      } else {
        zdroj = 'zadání chybí a z dotazníku se dopočítat nedá, vyplň čísla ručně';
      }
    }
    // Sacharidy a tuky jsou v `client_targets` nepovinné, generátor je ale potřebuje.
    // Dopočet drží stejnou logiku jako `computeTargets`: tuk 28 % kalorií, zbytek sacharidy.
    if (c.kcal && c.protein) {
      if (c.fat == null) c.fat = Math.round(c.kcal * 0.28 / 9);
      if (c.carbs == null) c.carbs = Math.max(40, Math.round((c.kcal - c.protein * 4 - c.fat * 9) / 4));
      // ⛔ [2026-09-02] Podlaha vlákniny se sem UŽ NEPÍŠE číslem. Do té doby tu stálo 25,
      // zatímco appka i onboarding počítaly s 20, takže admin viděl u téhož klienta jiné
      // číslo než klient. Martin rozhodl JEDNO ČÍSLO VŠUDE, a jediné místo, kde na webu
      // žije, je `FIBER_FLOOR_G` v `assets/meal-gen.js`.
      // ⛔⛔ POJISTKA PROTI `NaN`, a je tam schválně (nález revize 2. 9. 2026):
      // když si prohlížeč přinese z cache STAROU `meal-gen.js` pod stejnou adresou,
      // `FIBER_FLOOR_G` je `undefined` a `Math.max(undefined, 18)` je `NaN`, takže by
      // Martin dostal v průvodci klienta cíl vlákniny „NaN". `Number(...) || 20` z toho
      // udělá 20. To dvacet tady je JEDINÁ povolená druhá kopie čísla: uplatní se
      // výhradně ve chvíli, kdy je ta pravá konstanta nedosažitelná.
      if (c.fiber == null) {
        var podlahaVlakniny = Number(global.MealGen && global.MealGen.FIBER_FLOOR_G) || 20;
        c.fiber = Math.max(podlahaVlakniny, Math.round(c.kcal / 1000 * 14));
      }
    }
    return { cile: c, zdroj: zdroj };
  }

  // ---- přepočet součtů po ruční změně gramáže ----
  // ⛔ Musí se počítat přes `MealGen.macrosFor`, ne vlastním vzorcem: ten řeší konvenci
  // sacharidů (`carbBasis`) i chybějící makro jako nulu místo NaN.
  function prepocti(den) {
    var mf = global.MealGen.macrosFor;
    den.meals.forEach(function (m) {
      m.totals = m.items.reduce(function (s, it) {
        var mm = mf(it.food, it.grams);
        s.kcal += mm.kcal; s.p += mm.p; s.c += mm.c; s.f += mm.f; s.fib += mm.fib; return s;
      }, { kcal: 0, p: 0, c: 0, f: 0, fib: 0 });
    });
    den.totals = den.meals.reduce(function (s, m) {
      s.kcal += m.totals.kcal; s.p += m.totals.p; s.c += m.totals.c; s.f += m.totals.f; s.fib += m.totals.fib; return s;
    }, { kcal: 0, p: 0, c: 0, f: 0, fib: 0 });
    return den;
  }

  // ---- kontrolní pruh pod dnem ----
  // Zelená / oranžová / červená. Nahrazuje ruční kontrolní výpočet, který Martin dřív
  // dostával v samostatném souboru. Pásma: kcal ±3 %, bílkovina je PODLAHA (nad cíl je
  // v pořádku), vláknina taky podlaha.
  function pruh(den, c) {
    var t = den.totals || {};
    function bod(label, skut, cil, rezim) {
      if (!cil) return '<span style="color:#8F8A99;">' + label + ' ' + r0(skut) + ' (cíl nenastaven)</span>';
      var p = (skut - cil) / cil * 100;
      var stav;
      if (rezim === 'podlaha') stav = p >= -5 ? 'ok' : (p >= -15 ? 'skoro' : 'mimo');
      else stav = Math.abs(p) <= 3 ? 'ok' : (Math.abs(p) <= 7 ? 'skoro' : 'mimo');
      var barva = stav === 'ok' ? '#7BD88F' : (stav === 'skoro' ? '#F6CD63' : '#ff8b8b');
      var znak = stav === 'ok' ? '✅' : (stav === 'skoro' ? '⚠️' : '⛔');
      return '<span style="color:' + barva + ';">' + znak + ' ' + label + ' ' + r0(skut)
        + ' / ' + r0(cil) + ' (' + (p >= 0 ? '+' : '') + (Math.round(p * 10) / 10).toString().replace('.', ',') + ' %)</span>';
    }
    return '<div style="display:flex;flex-wrap:wrap;gap:10px;font-size:.78rem;margin-top:6px;padding:6px 8px;background:rgba(255,255,255,.04);border-radius:8px;">'
      + bod('kcal', t.kcal, c.kcal, 'pasmo') + bod('B', t.p, c.protein, 'podlaha')
      + bod('vláknina', t.fib, c.fiber, 'podlaha')
      + '<span class="muted">S ' + r0(t.c) + ' g · T ' + r0(t.f) + ' g</span></div>';
  }

  // =====================================================================
  //  MOUNT
  // =====================================================================
  // ctx: { email, name, vok, rod, intake (objekt `data` z dotazníku), targets, api, toast }
  function mount(el, ctx) {
    var idata = ctx.intake || {};
    var S = {
      cile: {}, pocetJidel: 5, dny: [], seedy: [1, 2], nazvy: [[], []],
      prefs: { bezLepku: false, bezLaktozy: false, vegetarian: false, vegan: false, excludeId: [] },
      texty: { uvod: '', proc_tyhle_tri: '', zadani_navic: '', na_zaver: '' },
      swapSeed: {}, navrh: []
    };
    var jidelDotaznik = num(idata.jidel_denne);
    S.pocetJidel = jidelDotaznik ? Math.min(5, Math.max(3, jidelDotaznik)) : 5;

    el.innerHTML = '<p class="muted" style="font-size:.85rem;">Načítám generátor a databázi potravin…</p>';
    pripravEngine().then(function () {
      var v = vychoziCile(ctx.targets, idata, ctx.rod);
      S.cile = v.cile;
      kostra(v.zdroj);
    }).catch(function (e) {
      el.innerHTML = '<p style="font-size:.85rem;color:#ff9b9b;">⚠️ Průvodce se nedá spustit: ' + esc(e.message || e) + '</p>';
    });

    function $(id) { return el.querySelector('#' + id); }
    function toast(m) { if (ctx.toast) ctx.toast(m); }

    // ---------- kostra ----------
    function kostra(zdrojCilu) {
      function pole(id, label, jed) {
        return '<label style="display:block;font-size:.75rem;color:#8F8A99;">' + esc(label)
          + (jed ? ' <span style="color:#6d6879;">(' + esc(jed) + ')</span>' : '')
          + '<input type="text" inputmode="decimal" id="' + id + '" value="' + esc(S.cile[id.replace('pgC_', '')] == null ? '' : S.cile[id.replace('pgC_', '')])
          + '" style="width:100%;box-sizing:border-box;margin-top:3px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px 9px;color:#fff;font-family:inherit;font-size:.88rem;"></label>';
      }
      function check(id, label) {
        return '<label style="cursor:pointer;font-size:.85rem;color:#cbbfae;margin-right:14px;white-space:nowrap;">'
          + '<input type="checkbox" id="' + id + '" style="accent-color:#EBB12C;vertical-align:-2px;margin-right:5px;">' + esc(label) + '</label>';
      }
      var h = '';

      // 1) cíle a rozsah
      h += '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px;">'
        + '<div class="muted" style="font-size:.75rem;text-transform:uppercase;margin-bottom:6px;">1. Čísla do generátoru</div>'
        + '<p class="muted" style="margin:0 0 8px;font-size:.78rem;">Zdroj: ' + esc(zdrojCilu)
        + '. Cokoli tu přepíšeš platí jen pro tenhle dokument, do zadání pro klienta se to neukládá.</p>'
        + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px;">'
        + pole('pgC_kcal', 'Energie', 'kcal') + pole('pgC_protein', 'Bílkoviny', 'g')
        + pole('pgC_fiber', 'Vláknina', 'g') + pole('pgC_carbs', 'Sacharidy', 'g') + pole('pgC_fat', 'Tuky', 'g')
        + '</div>'
        + '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin-top:10px;">'
        + '<label style="font-size:.75rem;color:#8F8A99;">Jídel denně<br><select id="pgJidel" style="margin-top:3px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px 9px;color:#fff;font-family:inherit;font-size:.88rem;">'
        + [3, 4, 5].map(function (n) { return '<option value="' + n + '"' + (n === S.pocetJidel ? ' selected' : '') + '>' + n + '</option>'; }).join('')
        + '</select></label>'
        + '<label style="flex:1;min-width:160px;font-size:.75rem;color:#8F8A99;">Jméno do hlavičky<br><input type="text" id="pgJmeno" value="' + esc(ctx.name || '') + '" style="width:100%;box-sizing:border-box;margin-top:3px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px 9px;color:#fff;font-family:inherit;font-size:.88rem;"></label>'
        + '<label style="min-width:120px;font-size:.75rem;color:#8F8A99;">Oslovení (5. pád)<br><input type="text" id="pgVok" value="' + esc(ctx.vok || '') + '" style="width:100%;box-sizing:border-box;margin-top:3px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px 9px;color:#fff;font-family:inherit;font-size:.88rem;"></label>'
        + '<label style="flex:1;min-width:200px;font-size:.75rem;color:#8F8A99;">Poznámka u bílkovin<br><input type="text" id="pgProtPozn" placeholder="např. víc rozhodně nevadí" style="width:100%;box-sizing:border-box;margin-top:3px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px 9px;color:#fff;font-family:inherit;font-size:.88rem;"></label>'
        + '</div>';
      if (jidelDotaznik === 6) {
        h += '<p style="margin:8px 0 0;font-size:.8rem;color:#F6CD63;">⚠️ V dotazníku je 6 jídel denně, generátor dnes umí nejvýš 5. '
          + 'Nastaveno 5, poslední jídlo si klient klidně rozdělí. Šesté jídlo je otevřený úkol v enginu (obě strany naráz).</p>';
      }
      h += '</div>';

      // 2) vyloučení
      var dotaznikText = [['Alergie', idata.alergie], ['Nejí', idata.neji], ['Zdraví', idata.zdravi], ['Diety', idata.diety]]
        .filter(function (x) { return x[1] && String(x[1]).trim(); })
        .map(function (x) { return '<b>' + esc(x[0]) + ':</b> ' + esc(x[1]); }).join('<br>');
      h += '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px;margin-top:10px;">'
        + '<div class="muted" style="font-size:.75rem;text-transform:uppercase;margin-bottom:6px;">2. Vyloučení</div>'
        + (dotaznikText ? '<p style="margin:0 0 8px;font-size:.8rem;background:rgba(235,177,44,.08);border-radius:8px;padding:7px 9px;">' + dotaznikText + '</p>'
          : '<p class="muted" style="margin:0 0 8px;font-size:.8rem;">V dotazníku není nic o alergiích ani o tom, co klient nejí.</p>')
        + '<div style="margin-bottom:8px;">' + check('pgBezLepku', 'bez lepku') + check('pgBezLaktozy', 'bez laktózy a mléčných')
        + check('pgVegetarian', 'vegetarián') + check('pgVegan', 'vegan') + '</div>'
        + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
        + '<input type="text" id="pgHledej" placeholder="hledej potravinu k vyloučení (např. ořech)…" style="flex:1;min-width:200px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:7px 10px;color:#fff;font-family:inherit;font-size:.88rem;">'
        + '<button class="mlogbtn" id="pgNavrhBtn">Navrhni z dotazníku</button></div>'
        + '<div id="pgHledejOut" style="margin-top:6px;"></div>'
        + '<div id="pgNavrhOut" style="margin-top:8px;"></div>'
        + '<div id="pgVyl" style="margin-top:8px;"></div>'
        + '<p class="muted" style="margin:8px 0 0;font-size:.75rem;">⛔ Do generátoru jde jen to, co je tady v seznamu. Návrh od AI se sám nezapíná. '
        + '⚠️ „Navrhni z dotazníku" je volání AI, takže odešle tytéž věty z dotazníku jako tlačítko v sekci 3, včetně zdravotních omezení. Podrobnosti u něj.</p>'
        + '</div>';

      // 3) texty
      h += '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px;margin-top:10px;">'
        + '<div class="muted" style="font-size:.75rem;text-transform:uppercase;margin-bottom:6px;">3. Texty</div>'
        + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px;">'
        + '<button class="mlogbtn" id="pgTextyBtn">Napsat texty (AI)</button>'
        + '<span class="muted" style="font-size:.78rem;">AI dostane čísla jako hotová fakta a nesmí je měnit. Přečti je a přepiš, jdou ven pod Tvým jménem.</span></div>'
        // ⛔ [2026-09-02] Editor mlčel o tom, že do promptu jdou i věty z dotazníku o zdraví.
        // Martin se podle toho rozhoduje, co do adminu vůbec pustí, takže se to musí říct
        // nahlas a přesně. Táž oprava jako u tréninkového plánu (`trenink.js`).
        + '<p style="margin:0 0 8px;font-size:.78rem;background:rgba(255,180,110,.12);border:1px solid rgba(255,180,110,.35);border-radius:8px;padding:7px 9px;">'
        + '🤖 <b>Co z dotazníku dostane AI:</b> cíl, proč to chce, termín, věk, výšku a váhu, aktivitu, kroky, práci, spánek, tréninky, sport, kde cvičí, jak vaří, dřívější diety, '
        + 'alergie a intolerance, co nejí, zdravotní omezení (zkrácené, jen jako kontext ke stravě) a vzkaz z dotazníku. '
        + '<b>Léky se do promptu neposílají.</b> AI o zdraví nic neradí, smí napsat jedinou větu, že se ozveš osobně. '
        + '<b>Model běží u AI třetí strany</b> (Anthropic nebo xAI), takže tyhle věty odejdou ven.</p>'
        + '<div id="pgTextyStav"></div>'
        + ta('pgT_uvod', 'Úvod (pod „Ahoj …!")', 4)
        + ta('pgT_proc', 'Rámeček „Proč zrovna tyhle tři"', 4)
        + ta('pgT_zadani', 'Rámeček „Tvoje zadání navíc"', 4)
        + ta('pgT_zaver', '„Na závěr" (odpověď na jeho otázku z dotazníku)', 4)
        + ta('pgT_pozn', 'Vlastní rámeček pod dny (nepovinné, např. vysoká vláknina)', 2)
        + '</div>';

      // 4) dny
      h += '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px;margin-top:10px;">'
        + '<div class="muted" style="font-size:.75rem;text-transform:uppercase;margin-bottom:6px;">4. Dva vzorové dny</div>'
        + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px;">'
        + '<button class="mlogbtn" id="pgGenBtn">Vygenerovat oba dny</button>'
        + '<span class="muted" style="font-size:.78rem;">Po každé změně čísel nebo vyloučení dej vygenerovat znovu.</span></div>'
        + '<div id="pgDny"></div></div>';

      // 5) výstup
      h += '<div style="background:rgba(235,177,44,.06);border:1px solid rgba(235,177,44,.3);border-radius:10px;padding:12px;margin-top:10px;">'
        + '<div class="muted" style="font-size:.75rem;text-transform:uppercase;margin-bottom:6px;">5. Hotový dokument</div>'
        + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
        + '<button class="mlogbtn" id="pgNahled">Náhled a tisk</button>'
        + '<button class="mlogbtn" id="pgUloz">Uložit klientovi</button></div>'
        + '<p class="muted" style="margin:8px 0 0;font-size:.78rem;">Náhled má navíc kontrolní stranu jen pro Tebe. '
        + 'Do souboru pro klienta se neukládá. Odkaz klientovi posíláš Ty, admin sám neposílá nic.</p></div>';

      el.innerHTML = h;
      naveseni();
      prekresliVyl();
    }

    function ta(id, label, rows) {
      return '<label style="display:block;font-size:.75rem;color:#8F8A99;margin-bottom:8px;">' + esc(label)
        + '<textarea id="' + id + '" rows="' + rows + '" style="width:100%;box-sizing:border-box;margin-top:3px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:8px 10px;color:#fff;font-family:inherit;font-size:.88rem;line-height:1.45;"></textarea></label>';
    }

    // ---------- čtení stavu z formuláře ----------
    function nactiCile() {
      ['kcal', 'protein', 'carbs', 'fat', 'fiber'].forEach(function (k) {
        var e = $('pgC_' + k); if (e) S.cile[k] = num(e.value);
      });
      S.pocetJidel = Number($('pgJidel').value) || 5;
      S.prefs.bezLepku = $('pgBezLepku').checked;
      S.prefs.bezLaktozy = $('pgBezLaktozy').checked;
      S.prefs.vegetarian = $('pgVegetarian').checked;
      S.prefs.vegan = $('pgVegan').checked;
    }
    function nactiTexty() {
      S.texty.uvod = $('pgT_uvod').value;
      S.texty.proc_tyhle_tri = $('pgT_proc').value;
      S.texty.zadani_navic = $('pgT_zadani').value;
      S.texty.na_zaver = $('pgT_zaver').value;
    }

    // ---------- seznam vyloučených ----------
    function prekresliVyl() {
      var box = $('pgVyl'); if (!box) return;
      if (!S.prefs.excludeId.length) {
        box.innerHTML = '<span class="muted" style="font-size:.8rem;">Zatím nic vyloučeného.</span>'; return;
      }
      box.innerHTML = S.prefs.excludeId.map(function (id) {
        var f = najdi(id);
        return '<span style="display:inline-block;background:rgba(255,107,107,.12);border:1px solid rgba(255,107,107,.35);border-radius:20px;padding:3px 10px;margin:0 6px 6px 0;font-size:.8rem;">'
          + esc(f ? f.name : id) + ' <a href="#" data-pgdel="' + esc(id) + '" style="color:#ff9b9b;text-decoration:none;">✕</a></span>';
      }).join('');
      box.querySelectorAll('[data-pgdel]').forEach(function (a) {
        a.addEventListener('click', function (ev) {
          ev.preventDefault();
          var id = a.getAttribute('data-pgdel');
          S.prefs.excludeId = S.prefs.excludeId.filter(function (x) { return x !== id; });
          prekresliVyl();
        });
      });
    }
    function najdi(id) { for (var i = 0; i < FOOD.length; i++) if (FOOD[i].id === id) return FOOD[i]; return null; }
    function pridejVyl(id) {
      if (S.prefs.excludeId.indexOf(id) === -1) S.prefs.excludeId.push(id);
      prekresliVyl();
    }
    // Hledání v názvu i v id, bez diakritiky. Běžné potraviny první, ať Martin nemusí
    // rolovat přes exotiku, kterou generátor stejně nepoužívá.
    function hledejPresne(s, limit) {
      var out = FOOD.filter(function (f) { return bezDia(f.name).indexOf(s) !== -1 || f.id.indexOf(s) !== -1; });
      out.sort(function (a, b) { return (b.bezny ? 1 : 0) - (a.bezny ? 1 : 0); });
      return out.slice(0, limit || 12);
    }
    // Celý výraz od AI („vnitřnosti, ryba s kostmi") často nic nenajde. Zkusí se proto
    // ještě první slovo výrazu a jeho kořen (prvních 5, pak 4 znaky bez diakritiky):
    // oliva → oliv → najde Olivy. Kořen krátkého slova jako „ryba" → „ryb" Kapra
    // nenajde, to je v pořádku, přesné hledání ručně dál funguje beze změny.
    function hledej(q, limit) {
      var s = bezDia(q).trim(); if (s.length < 2) return [];
      var out = hledejPresne(s, limit);
      if (out.length) return out;
      var prvni = s.split(/\s+/)[0] || '';
      if (prvni && prvni !== s && prvni.length >= 2) {
        out = hledejPresne(prvni, limit);
        if (out.length) return out;
      }
      for (var len = 5; len >= 4; len--) {
        if (prvni.length > len) {
          out = hledejPresne(prvni.slice(0, len), limit);
          if (out.length) return out;
        }
      }
      return [];
    }

    // ---------- dny ----------
    // Skóre dne: primárně vláknina ≥ cíl A |kcal odchylka| ≤ 5 % (bucket -1000, takže
    // takový pokus vždycky vyhraje nad pokusem, co tuhle podmínku nesplní), sekundárně
    // nejmenší |kcal odchylka| + |bílkoviny odchylka|. Nižší skóre je lepší.
    function skoreDne(den, cile) {
      var t = den.totals || {};
      var kcalPct = cile.kcal ? Math.abs(t.kcal - cile.kcal) / cile.kcal : 0;
      var protPct = cile.protein ? Math.abs(t.p - cile.protein) / cile.protein : 0;
      var fibOk = cile.fiber == null || t.fib >= cile.fiber;
      var sekundarni = kcalPct + protPct;
      return (fibOk && kcalPct <= 0.05) ? sekundarni : (sekundarni + 1000);
    }
    // ⛔ Generátor umí vrátit den pod podlahou vlákniny nebo mimo kcal pásmo (nález
    // revize: den 1 vláknina −28 %, den 2 kcal −3,7 %), a Martin by pak musel klikat
    // „Vygenerovat jiný den" naslepo. Místo jednoho pokusu se jich zkusí až 8 s různým
    // seedem a vybere se nejlepší podle skóre. Krok seedu je 2 a báze dnů (1 / 2) má
    // vždy jinou paritu, takže dny 0 a 1 nikdy nesáhnou na stejný seed; navíc se
    // seed druhého dne výslovně přeskočí, kdyby se báze parity někdy sešly (po
    // „Vygenerovat jiný den", které bázi posouvá o 7).
    function generujNejlepsi(index, seedBase) {
      var cile = { kcal: S.cile.kcal, protein: S.cile.protein, carbs: S.cile.carbs, fat: S.cile.fat };
      var jinySeed = S.seedy[1 - index];
      var nejlepsiDen = null, nejlepsiSeed = seedBase, nejlepsiSkore = Infinity, posledniChyba = null;
      for (var i = 0; i < 8; i++) {
        var seed = seedBase + i * 2;
        if (seed === jinySeed) continue;
        var den;
        try { den = global.MealGen.assembleDay(cile, { meals: S.pocetJidel, prefs: S.prefs, db: FOOD, seed: seed }); }
        catch (e) { posledniChyba = e; continue; }
        var skore = skoreDne(den, S.cile);
        if (skore < nejlepsiSkore) { nejlepsiSkore = skore; nejlepsiDen = den; nejlepsiSeed = seed; }
      }
      if (!nejlepsiDen) throw (posledniChyba || new Error('Generátor nevrátil žádný den.'));
      S.seedy[index] = nejlepsiSeed;
      S.dny[index] = nejlepsiDen;
      var nazvy = S.nazvy[index] || [];
      S.nazvy[index] = nejlepsiDen.meals.map(function (m, i) { return nazvy[i] || m.name; });
    }
    function generujOba() {
      nactiCile();
      if (!S.cile.kcal || !S.cile.protein) { toast('Vyplň aspoň kalorie a bílkoviny.'); return; }
      if (!S.cile.carbs || !S.cile.fat) { toast('Doplň sacharidy a tuky, generátor je potřebuje.'); return; }
      S.swapSeed = {};
      try {
        generujNejlepsi(0, S.seedy[0] || 1);
        generujNejlepsi(1, S.seedy[1] || 2);
      } catch (e) {
        $('pgDny').innerHTML = '<p style="font-size:.85rem;color:#ff9b9b;">⚠️ ' + esc(e.message || e) + '</p>';
        return;
      }
      prekresliDny();
    }
    function prekresliDny() {
      var box = $('pgDny'); if (!box) return;
      if (!S.dny[0]) { box.innerHTML = '<p class="muted" style="font-size:.8rem;">Dny zatím vygenerované nejsou.</p>'; return; }
      var h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;">';
      S.dny.forEach(function (den, di) {
        if (!den) return;
        h += '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px;">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">'
          + '<b style="color:#F6CD63;font-size:.9rem;">Vzorový den ' + (di + 1) + '</b>'
          + '<button class="mlogbtn" data-pgnew="' + di + '" style="font-size:.75rem;padding:4px 9px;">Vygenerovat jiný den</button></div>';
        den.meals.forEach(function (m, mi) {
          h += '<div style="margin-top:8px;">'
            + '<input type="text" data-pgname="' + di + '-' + mi + '" value="' + esc(S.nazvy[di][mi] || m.name) + '" '
            + 'style="width:100%;box-sizing:border-box;background:rgba(235,177,44,.08);border:1px solid rgba(235,177,44,.25);border-radius:7px;padding:4px 8px;color:#F6CD63;font-family:inherit;font-weight:700;font-size:.83rem;">'
            + '<div class="muted" style="font-size:.72rem;margin:2px 0 3px;">&asymp; ' + r0(m.totals.kcal) + ' kcal · ' + r0(m.totals.p) + ' g B</div>';
          m.items.forEach(function (it, ii) {
            h += '<div style="display:flex;gap:5px;align-items:center;margin-bottom:3px;font-size:.8rem;">'
              + '<span style="flex:1;">' + esc(it.food.name) + '</span>'
              + '<input type="text" inputmode="numeric" data-pgg="' + di + '-' + mi + '-' + ii + '" value="' + r0(it.grams) + '" '
              + 'style="width:52px;text-align:right;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:6px;padding:3px 5px;color:#fff;font-family:inherit;font-size:.8rem;">'
              + '<span class="muted" style="font-size:.72rem;">g</span>'
              + '<a href="#" data-pgswap="' + di + '-' + mi + '-' + ii + '" title="Zaměnit za jinou potravinu ze stejné skupiny" style="color:#F6CD63;text-decoration:none;">⇄</a></div>';
          });
          h += '</div>';
        });
        h += pruh(den, S.cile) + '</div>';
      });
      h += '</div>';
      box.innerHTML = h;

      box.querySelectorAll('[data-pgnew]').forEach(function (b) {
        b.addEventListener('click', function () {
          var di = Number(b.getAttribute('data-pgnew'));
          nactiCile();
          S.nazvy[di] = [];                    // jiný den = jiná jídla, staré popisky by lhaly
          try { generujNejlepsi(di, (S.seedy[di] || 1) + 7); } catch (e) { toast(String(e.message || e)); return; }
          prekresliDny();
        });
      });
      box.querySelectorAll('[data-pgname]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          var p = inp.getAttribute('data-pgname').split('-');
          S.nazvy[+p[0]][+p[1]] = inp.value;
        });
      });
      box.querySelectorAll('[data-pgg]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          var p = inp.getAttribute('data-pgg').split('-');
          var g = num(inp.value);
          if (!g || g <= 0) { toast('Gramáž musí být kladné číslo.'); prekresliDny(); return; }
          S.dny[+p[0]].meals[+p[1]].items[+p[2]].grams = Math.round(g);
          prepocti(S.dny[+p[0]]);
          prekresliDny();
        });
      });
      box.querySelectorAll('[data-pgswap]').forEach(function (a) {
        a.addEventListener('click', function (ev) {
          ev.preventDefault();
          var k = a.getAttribute('data-pgswap'), p = k.split('-');
          S.swapSeed[k] = (S.swapSeed[k] || 0) + 1;
          global.MealGen.swapItem(S.dny[+p[0]], +p[1], +p[2], {
            db: FOOD, prefs: S.prefs, seed: S.swapSeed[k]
          });
          prekresliDny();
        });
      });
    }

    // ---------- AI ----------
    // ⛔ Jedna akce `pruvodce_text` vrací texty I návrh vyloučení. Druhé kliknutí do
    // deseti minut AI nevolá, vrátí uložený koncept (stejná ochrana nákladu jako u
    // konceptu odpovědi na report). Obě tlačítka proto vedou sem.
    function volejAI(btn, jenNavrh) {
      if (btn.disabled) return;
      nactiCile();
      if (!S.cile.kcal || !S.cile.protein) { toast('Nejdřív vyplň kalorie a bílkoviny, AI je dostává jako fakta.'); return; }
      // ⛔ Obě tlačítka volají STEJNOU placenou akci `pruvodce_text`. Dřív se zamklo jen
      // to kliknuté, takže klik na „Navrhni z dotazníku" a hned na „Napsat texty (AI)"
      // udělal dvě volání AI pár sekund po sobě (ověřeno v pruvodce_drafts). Zamyká se
      // proto vždy obojí, i to druhé jen kosmeticky (nemá vlastní requst k zablokování).
      var druhe = btn === $('pgNavrhBtn') ? $('pgTextyBtn') : $('pgNavrhBtn');
      var t0 = btn.textContent, t0d = druhe.textContent;
      btn.disabled = true; btn.textContent = 'Píšu…';
      druhe.disabled = true;
      $('pgTextyStav').innerHTML = '<p class="muted" style="font-size:.82rem;">Píšu texty, může to trvat půl minuty…</p>';
      // ⛔ `vylouceni` se posílá JEN kvůli otisku zadání na serveru (aby odstup 10 minut
      // nevrátil starý text ke změněným číslům nebo k jinému filtru). Generátor běží tady
      // v prohlížeči, server do něj nesahá. `rod` potřebuje model na minulý čas.
      ctx.api({
        action: 'pruvodce_text', email: ctx.email,
        osloveni: ($('pgVok').value || '').trim(), rod: ctx.rod || '',
        kcal: S.cile.kcal, protein: S.cile.protein, fiber: S.cile.fiber,
        carbs: S.cile.carbs, fat: S.cile.fat, jidel: S.pocetJidel,
        vylouceni: S.prefs.excludeId.concat(
          S.prefs.bezLepku ? ['dieta:bezLepku'] : [],
          S.prefs.bezLaktozy ? ['dieta:bezLaktozy'] : [],
          S.prefs.vegetarian ? ['dieta:vegetarian'] : [],
          S.prefs.vegan ? ['dieta:vegan'] : []
        )
      }).then(function (o) {
        btn.disabled = false; btn.textContent = t0; druhe.disabled = false; druhe.textContent = t0d;
        var j = o.j || {};
        if (!j.ok) {
          var e = String(j.error || o.status);
          var why = e === 'ai_nedostupne' ? 'AI teď neodpovídá, zkus to za chvíli'
            : e === 'chybi_klic' ? 'v projektu chybí API klíč k AI'
              : e === 'ai_prazdno' ? 'AI vrátila prázdný text, zkus to znovu'
                : e === 'chybi_tabulka' ? 'chybí tabulka pruvodce_drafts, je potřeba nasadit migraci pruvodce-drafts.sql'
                  : e === 'no_email' ? 'chybí e-mail klienta'
                    : 'chyba (' + esc(e) + ')';
          $('pgTextyStav').innerHTML = '<p style="font-size:.82rem;color:#ff9b9b;">⚠️ Nepovedlo se: ' + why + '.</p>';
          return;
        }
        var t = j.texty || {};
        if (!jenNavrh) {
          if (t.uvod) $('pgT_uvod').value = t.uvod;
          if (t.proc_tyhle_tri) $('pgT_proc').value = t.proc_tyhle_tri;
          if (t.zadani_navic) $('pgT_zadani').value = t.zadani_navic;
          if (t.na_zaver) $('pgT_zaver').value = t.na_zaver;
        }
        var st = '';
        if ((j.upozorneni || []).length) {
          st += '<p style="margin:0 0 6px;font-size:.82rem;color:#ffb4b4;">⚠️ V dotazníku je téma '
            + esc((j.upozorneni || []).join(', ')) + '. AI k němu schválně nic neradí, tohle patří Tobě.</p>';
        }
        st += '<p class="muted" style="margin:0 0 8px;font-size:.78rem;">🤖 Návrh od AI, přečti a přepiš.'
          + (j.znovu ? ' (Tenhle koncept už byl hotový, nový se dá zadat za pár minut.)' : '') + '</p>';
        // Bod 10: ať je vidět, který model texty psal (odpověď ho posílá jen když ho má).
        if (j.model) st += '<p class="muted" style="margin:0 0 8px;font-size:.74rem;">Model: ' + esc(j.model) + '</p>';
        $('pgTextyStav').innerHTML = st;
        zobrazNavrh(j.vylouceni_navrh || []);
      }).catch(function () {
        btn.disabled = false; btn.textContent = t0; druhe.disabled = false; druhe.textContent = t0d;
        $('pgTextyStav').innerHTML = '<p style="font-size:.82rem;color:#ff9b9b;">⚠️ Chyba spojení.</p>';
      });
    }

    // Návrh vyloučení: AI vrací VÝRAZY („ořech", „jogurt"), ne id z databáze. Slugy 1192
    // položek model neuhodne a vymyšlené id by tiše nevyloučilo nic. Výrazy se tady
    // rozbalí na konkrétní potraviny a Martin je odklikne. ⛔ Nic se nezapíná samo.
    function zobrazNavrh(vyrazy) {
      var box = $('pgNavrhOut'); if (!box) return;
      if (!vyrazy.length) { box.innerHTML = ''; return; }
      var h = '<div style="background:rgba(235,177,44,.07);border:1px solid rgba(235,177,44,.25);border-radius:8px;padding:8px 10px;">'
        + '<p style="margin:0 0 6px;font-size:.8rem;">AI z dotazníku vyčetla: <b>' + esc(vyrazy.join(', ')) + '</b>. '
        + 'Zaškrtni, co se má opravdu vyloučit.</p>';
      var vid = 0;
      vyrazy.forEach(function (v) {
        var nal = hledej(v, 10);
        if (!nal.length) { h += '<p class="muted" style="margin:2px 0;font-size:.78rem;">„' + esc(v) + '" v databázi nic nenašlo, přidej ručně přes hledání.</p>'; return; }
        h += '<p style="margin:6px 0 2px;font-size:.78rem;color:#F6CD63;">„' + esc(v) + '"</p>';
        nal.forEach(function (f) {
          vid++;
          h += '<label style="display:inline-block;margin:0 10px 4px 0;font-size:.8rem;cursor:pointer;">'
            + '<input type="checkbox" data-pgnav="' + esc(f.id) + '" style="accent-color:#EBB12C;vertical-align:-2px;margin-right:4px;">'
            + esc(f.name) + '</label>';
        });
      });
      // ⛔ Dřív box.innerHTML = vid ? h : '': když AI něco vyčetla, ale hledání nic
      // nenašlo (vid===0), zůstal box prázdný a Martin nepoznal, že AI vůbec něco
      // vrátila. Hlavička s vyčtenými výrazy se teď ukazuje VŽDY, tlačítko jen když
      // je co přidat.
      if (vid) h += '<div style="margin-top:6px;"><button class="mlogbtn" id="pgNavrhPridej" style="font-size:.78rem;padding:4px 10px;">Přidat zaškrtnuté do vyloučení</button></div>';
      h += '</div>';
      box.innerHTML = h;
      var pb = $('pgNavrhPridej');
      if (pb) pb.addEventListener('click', function () {
        var n = 0;
        box.querySelectorAll('[data-pgnav]').forEach(function (ch) {
          if (ch.checked) { pridejVyl(ch.getAttribute('data-pgnav')); n++; }
        });
        toast(n ? ('Vyloučeno ' + n + ' položek, vygeneruj dny znovu.') : 'Nic nebylo zaškrtnuté.');
      });
    }

    // ---------- výstup ----------
    function data() {
      nactiCile(); nactiTexty();
      return {
        jmeno: ($('pgJmeno').value || '').trim(),
        osloveni: ($('pgVok').value || '').trim(),
        rod: ctx.rod || '',
        datum: dnesCz(),
        cile: S.cile,
        proteinPozn: ($('pgProtPozn').value || '').trim(),
        texty: S.texty,
        poznamka_pod_dny: ($('pgT_pozn').value || '').trim(),
        dny: [{ den: S.dny[0], nazvy: S.nazvy[0] }, { den: S.dny[1], nazvy: S.nazvy[1] }],
        prefs: S.prefs, seedy: S.seedy, pocetJidel: S.pocetJidel
      };
    }
    function hotovoHtml(proMartina) {
      return global.PruvodceSablona.render(data(), { proMartina: !!proMartina });
    }
    // UTF-8 do base64. ⛔ Holé `btoa` na češtině spadne, `unescape` je zrušené API.
    function b64(s) {
      var b = new TextEncoder().encode(s), out = '';
      for (var i = 0; i < b.length; i += 8192) out += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
      return btoa(out);
    }

    // ---------- naveseni ----------
    function naveseni() {
      $('pgGenBtn').addEventListener('click', generujOba);
      $('pgTextyBtn').addEventListener('click', function () { volejAI($('pgTextyBtn'), false); });
      $('pgNavrhBtn').addEventListener('click', function () { volejAI($('pgNavrhBtn'), true); });

      var hl = $('pgHledej');
      hl.addEventListener('input', function () {
        var out = $('pgHledejOut'), nal = hledej(hl.value, 12);
        if (!nal.length) { out.innerHTML = ''; return; }
        out.innerHTML = nal.map(function (f) {
          return '<a href="#" data-pgadd="' + esc(f.id) + '" style="display:inline-block;margin:0 8px 5px 0;font-size:.8rem;color:#F6CD63;text-decoration:none;">+ ' + esc(f.name) + '</a>';
        }).join('');
        out.querySelectorAll('[data-pgadd]').forEach(function (a) {
          a.addEventListener('click', function (ev) {
            ev.preventDefault(); pridejVyl(a.getAttribute('data-pgadd'));
            hl.value = ''; out.innerHTML = '';
          });
        });
      });

      $('pgNahled').addEventListener('click', function () {
        if (!S.dny[0]) { toast('Nejdřív vygeneruj dny.'); return; }
        var w = window.open('', '_blank');
        if (!w) { toast('Prohlížeč zablokoval nové okno.'); return; }
        w.document.write(hotovoHtml(true)); w.document.close();
      });

      $('pgUloz').addEventListener('click', function () {
        if (!S.dny[0]) { toast('Nejdřív vygeneruj dny.'); return; }
        var b = $('pgUloz'); if (b.disabled) return;
        var soubor = 'pruvodce-' + dnesIso() + '.html';
        if (!confirm('Uložit průvodce klientovi ' + ctx.email + ' jako ' + soubor + '?\n\n'
          + 'Klient ho uvidí ve své sekci pod „Dokumenty od Martina". Odkaz mu pošli sám, admin nic neodesílá.\n'
          + 'Kontrolní strana s výpočtem se do souboru NEUKLÁDÁ.')) return;
        var t0 = b.textContent; b.disabled = true; b.textContent = 'Ukládám…';
        // ⛔ proMartina = false: klient nesmí dostat kontrolní stranu ani tlačítko Tisk v hlavičce.
        ctx.api({
          action: 'client_doc_upload', folder: ctx.email, filename: soubor,
          content_type: 'text/html; charset=utf-8', content_base64: b64(hotovoHtml(false))
        }).then(function (o) {
          b.disabled = false; b.textContent = t0;
          if (o.j && o.j.ok) {
            toast('✅ Uloženo klientovi: ' + soubor);
            // ⛔ Bod 3: seznam dokumentů v kartě klienta zůstával „Zatím nic" do reloadu.
            // ctx.poUlozeni přepíše jen ten seznam a stavový pruh, ne celou kartu.
            if (ctx.poUlozeni) ctx.poUlozeni(ctx.email);
          }
          else toast('Chyba: ' + ((o.j && o.j.error) || o.status));
        }).catch(function () { b.disabled = false; b.textContent = t0; toast('Chyba spojení'); });
      });
    }
  }

  global.Pruvodce = { mount: mount, pripravEngine: pripravEngine, _stavDb: function () { return FOOD; } };
})(window);
