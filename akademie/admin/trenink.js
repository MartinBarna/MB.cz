// 🏋️ TRÉNINKOVÝ PLÁN NA MÍRU: editor v kartě klienta (admin Barna Academy)
//
// Sourozenec `pruvodce.js`. Martin otevře kartu klienta, zkontroluje, co vyčetl dotazník
// (kolik dní, kde cvičí, s čím), odklikne případná omezení, nechá si napsat texty,
// prohlédne plán a uloží hotový dokument klientovi do jeho sekce.
//
// ROZDĚLENÍ ODPOVĚDNOSTI (nesmí se porušit, pravidlo 3 v CLAUDE.md appky):
//   • výběr cviků, série, opakování, pauzy, RIR, tempo, náhrady .... engine `WorkoutGen`, deterministicky
//   • rozvrh týdne a čtyřtýdenní progrese ......................... engine (`assembleProgram`)
//   • převod „bolí mě rameno" na vyloučené partie a cviky ......... Martin odklikne, AI ani nenavrhuje
//   • úvod, závěr, vlastní rámeček ................................ AI napíše, Martin přepíše
//   • odeslání klientovi .......................................... jen Martin, ručně
//
// ⛔⛔ ZDRAVOTNÍ OMEZENÍ NEČTE ENGINE. V dotazníku je volný text („po operaci ramene",
// „občas mě bolí koleno"). Engine z něj nikdy nevyvodí zákaz cviku: „bolí mě rameno" může
// znamenat vynechat tlaky nad hlavu, nebo taky nic z toho. Text se Martinovi ukáže a on
// odklikne konkrétní partie a cviky. Tatáž hranice jako u dietních filtrů v nutričním
// průvodci, jen se tady chybou platí zraněním.
// ⚠️ AI ho ale VIDÍ, a musí se to říkat nahlas. `admin-api` posílá do promptu zdravotní
// omezení, vzkaz z dotazníku a Martinův text z pole „Zranění a omezení"; léky ani alergie
// ne. Model běží u třetí strany (Anthropic nebo xAI). Systémový prompt mu k tomu zakazuje
// cokoli radit i o čemkoli rozhodovat, smí napsat jedinou větu, že se Martin ozve osobně.
// ⛔ Do 2. 9. 2026 tu editor tvrdil „nečte to ani engine, ani AI". Nebyla to pravda a Martin
// se podle toho rozhoduje, co do adminu vůbec napíše.
//
// Závislosti (načítá si je sám, líně, až když Martin sekci otevře):
//   /assets/workout-gen.js     window.WorkoutGen
//   /assets/exercise-db.json   128 cviků
//   ./trenink-sablona.js       window.TreninkSablona
(function (global) {
  'use strict';

  var DB = null;            // pole cviků, načte se jednou za život stránky
  var WG_URL = '/assets/workout-gen.js?v=20260906d';
  var DB_URL = '/assets/exercise-db.json?v=20260906b';

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
  // bez diakritiky a malými písmeny, na hledání v názvech cviků a v odpovědích dotazníku
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
      if (document.querySelector('script[data-tp="' + src + '"]')) return ok();
      var s = document.createElement('script');
      s.src = src; s.setAttribute('data-tp', src);
      s.onload = function () { ok(); }; s.onerror = function () { err(new Error('nenacteno: ' + src)); };
      document.head.appendChild(s);
    });
  }
  function pripravEngine() {
    var kroky = [];
    if (!global.WorkoutGen) kroky.push(nactiSkript(WG_URL));
    if (!global.TreninkSablona) kroky.push(nactiSkript('/akademie/admin/trenink-sablona.js?v=20260906d'));
    return Promise.all(kroky).then(function () {
      // ⛔ POJISTKA: bez `assembleProgram` je načtená stará verze enginu z cache a plán
      // by vyšel bez tempa, RIR a náhrad, tedy jako holý seznam cviků. Radši to řekneme.
      // [2026-09-02, po revizi] Kontrola musí být PŘED `if (DB) return DB;`. Dřív byla za ní,
      // takže při druhém otevření editoru v témže životě stránky se přeskočila a stará verze
      // enginu projela tiše.
      if (!global.WorkoutGen || !global.WorkoutGen.assembleProgram) {
        return Promise.reject(new Error('workout-gen.js je starší verze bez assembleProgram, zvedni ?v= v adrese'));
      }
      if (DB) return DB;
      return fetch(DB_URL).then(function (r) { return r.json(); }).then(function (d) {
        DB = Array.isArray(d) ? d : (d.items || []);
        return DB;
      });
    });
  }

  // ---- odhad vstupů z dotazníku ----
  // ⛔ Všechno je NÁVRH v editovatelných polích. Nic se odsud nikam neukládá a Martin to
  // vidí a přepíše. Dotazník je volný text, takže odhad se občas netrefí, a to je v pořádku,
  // dokud je vedle vidět, z čeho se odhadoval.
  function odhadDnu(t) {
    var n = num(String(t == null ? '' : t).replace(/[^0-9.,]/g, ' ').trim().split(/\s+/)[0]);
    if (n && n >= 1 && n <= 7) return Math.min(5, Math.max(2, Math.round(n)));
    return 3;
  }
  function odhadMista(t) {
    var s = bezDia(t);
    if (/fitko|posilov|gym|fitness/.test(s)) return 'fitko';
    if (/hrist|venku|park|workout/.test(s)) return 'hriste';
    if (/doma|byt|obyv/.test(s)) return 'doma';
    return 'fitko';
  }
  function odhadVybaveni(t, misto) {
    var s = bezDia(t);
    if (misto === 'fitko') return 'vse';
    if (/cink|kettleb|jednoruc|zavazi/.test(s)) return 'cinky';
    return 'telo';
  }
  /**
   * ⛔ [2026-09-02, po revizi] Dotazník NEMÁ otázku na zkušenosti s tréninkem.
   * Ověřeno dotazem do živé Academy DB (klíče v `client_intake.data`) i ve zdroji formuláře
   * `akademie/klient/index.html`: pole `zkusenosti` ani `zraneni` v datech neexistují.
   * Odhad proto smí sahat jen na to, co tam opravdu je: „Sport dřív a teď" (`sport`),
   * počet tréninků týdně (`dny_treninku`) a volný vzkaz. Je to NÁVRH, Martin ho v selectu
   * „Úroveň" přepíše, a vedle je vidět, z čeho se odhadovalo.
   */
  function odhadUrovne(t, dny) {
    var s = bezDia(t);
    if (/zacatecn|zacinam|nikdy|nezacvic|zadn[ae] zkusen|po pauze|nesportuj/.test(s)) return 'zacatecnik';
    if (/nekolik let|leta|roky|zavodn|kulturist|silovy trojboj|zkuseny/.test(s)) return 'zkuseny';
    // ⛔ [2026-09-05, revize] Samotné „posilovn" nebo „fitko" nestačí: „2x týdně posilovna,
    // občas běh" tím dřív vyšlo jako pokročilý. Slovo musí nést dobu nebo pravidelnost,
    // ne jen místo. Počet dní zůstává druhá cesta k pokročilému (4+ týdně).
    if (/pokrocil|dlouho|pravideln|roky|let[ y]|zkusen/.test(s)) return 'pokrocily';
    // Kdo reálně stíhá čtyři a víc tréninků týdně, začátečník obvykle není.
    if (Number(dny) >= 4) return 'pokrocily';
    return 'zacatecnik';
  }
  function odhadCile(t) {
    var s = bezDia(t);
    if (/zhub|hubn|zhod|tuk dol|shodit/.test(s)) return 'hubnuti';
    if (/sil|silov|zvedn|1rm|osobak/.test(s)) return 'sila';
    if (/kondic|vytrval|beh|maraton/.test(s)) return 'kondice';
    return 'svaly';
  }

  var PARTIE = [
    ['nohy', 'nohy'], ['hyzde', 'hýždě'], ['zada', 'záda'], ['prsa', 'prsa'],
    ['ramena', 'ramena'], ['biceps', 'biceps'], ['triceps', 'triceps'],
    ['bricho', 'břicho'], ['lytka', 'lýtka']
  ];
  var MISTA = [['fitko', 'posilovna'], ['doma', 'doma'], ['hriste', 'hřiště / venku']];
  var VYBAVENI = [['vse', 'všechno vybavení'], ['cinky', 'jednoručky a kettlebell'], ['telo', 'jen vlastní váha']];
  var UROVNE = [['zacatecnik', 'začátečník'], ['pokrocily', 'pokročilý'], ['zkuseny', 'zkušený']];
  var CILE = [['hubnuti', 'hubnutí'], ['svaly', 'svaly (hypertrofie)'], ['sila', 'síla'], ['kondice', 'vytrvalost / kondice']];
  // [2026-09-06, Martin „ano i pro klienty"] Obě volby, které má klient v appce i na webu,
  // má i tenhle adminní generátor. Bez nich by koučinkový klient dostal dokument postavený
  // na výchozích hodnotách, i když si v appce vybral něco jiného, a nikde by to nekřiklo.
  // ⛔ Objem po partiích ani jedna volba nemění, jen rozložení sérií a rozsah opakování.
  var STRUKTURY = [['min_cviku', 'míň cviků, víc sérií'], ['standard', 'standard (4 série na cvik)'], ['vic_cviku', 'víc cviků, míň sérií']];
  var OPAKOVANI = [['tezsi', 'těžší váhy, míň opakování'], ['standard', 'standard podle cíle'], ['lehci', 'střední váhy, víc opakování']];

  // =====================================================================
  //  MOUNT
  // =====================================================================
  // ctx: { email, name, vok, rod, intake (objekt `data` z dotazníku), api, toast }
  function mount(el, ctx) {
    var idata = ctx.intake || {};
    var S = {
      vstup: {
        dny_treninku: 3, kde_cvici: 'fitko', vybaveni: 'vse', level: 'zacatecnik',
        cil: 'svaly', struktura: 'standard', opakovani: 'standard',
        sport: '', seed: 0, vyloucene_partie: [], vyloucene_cviky: []
      },
      program: null,
      // Volný text „Zranění a omezení". Předvyplní se ze `zdravi` z dotazníku a Martin ho
      // upraví. ⛔ Engine ho NEČTE; jde jen do AI promptu jako citace a do ničeho jiného.
      omezeni: '',
      texty: { uvod: '', zaver: '', poznamka: '' }
    };

    el.innerHTML = '<p class="muted" style="font-size:.85rem;">Načítám generátor a databázi cviků…</p>';
    pripravEngine().then(function () {
      var misto = odhadMista([idata.kde_cvici, idata.vybaveni].join(' '));
      S.vstup.dny_treninku = odhadDnu(idata.dny_treninku);
      S.vstup.kde_cvici = misto;
      S.vstup.vybaveni = odhadVybaveni([idata.vybaveni, idata.kde_cvici].join(' '), misto);
      S.vstup.level = odhadUrovne([idata.sport, idata.poznamka, idata.proc, idata.prace, idata.aktivita].join(' '), S.vstup.dny_treninku);
      S.vstup.cil = odhadCile(String(idata.cil || ''));
      S.vstup.sport = String(idata.sport || '').trim();
      S.omezeni = String(idata.zdravi || '').trim();
      kostra();
      generuj();
    }).catch(function (e) {
      el.innerHTML = '<p style="font-size:.85rem;color:#ff9b9b;">⚠️ Tréninkový plán se nedá spustit: ' + esc(e.message || e) + '</p>';
    });

    function $(id) { return el.querySelector('#' + id); }
    function toast(m) { if (ctx.toast) ctx.toast(m); }

    // ---------- kostra ----------
    function kostra() {
      function sel(id, label, volby, aktualni) {
        return '<label style="font-size:.75rem;color:#8F8A99;">' + esc(label)
          + '<br><select id="' + id + '" style="margin-top:3px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px 9px;color:#fff;font-family:inherit;font-size:.88rem;">'
          + volby.map(function (v) {
            return '<option value="' + esc(v[0]) + '"' + (v[0] === aktualni ? ' selected' : '') + '>' + esc(v[1]) + '</option>';
          }).join('')
          + '</select></label>';
      }
      var h = '';

      // 1) zadání
      // ⛔ Jen klíče, které v `client_intake.data` doopravdy jsou (ověřeno v živé DB 2. 9. 2026).
      // `zkusenosti` ani `zraneni` dotazník nesbírá, popisek slibující je by lhal.
      var dotaznikText = [
        ['Tréninky týdně', idata.dny_treninku], ['Kde cvičí', idata.kde_cvici],
        ['Vybavení', idata.vybaveni], ['Sport dřív a teď', idata.sport],
        ['Práce a režim', idata.prace], ['Denní aktivita', idata.aktivita], ['Cíl', idata.cil]
      ].filter(function (x) { return x[1] && String(x[1]).trim(); })
        .map(function (x) { return '<b>' + esc(x[0]) + ':</b> ' + esc(x[1]); }).join('<br>');

      h += '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px;">'
        + '<div class="muted" style="font-size:.75rem;text-transform:uppercase;margin-bottom:6px;">1. Zadání do generátoru</div>'
        + (dotaznikText ? '<p style="margin:0 0 8px;font-size:.8rem;background:rgba(235,177,44,.08);border-radius:8px;padding:7px 9px;">' + dotaznikText + '</p>'
          : '<p class="muted" style="margin:0 0 8px;font-size:.8rem;">V dotazníku není nic o trénincích, vyplň to ručně.</p>')
        + '<p class="muted" style="margin:0 0 8px;font-size:.78rem;">Předvyplněno odhadem z dotazníku. Cokoli tu přepíšeš platí jen pro tenhle dokument. '
        + '⚠️ <b>Úroveň dotazník nezjišťuje</b>, odhaduje se z odpovědi „Sport dřív a teď" a z počtu tréninků, takže ji zkontroluj vždycky.</p>'
        + '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:end;">'
        + sel('tpDny', 'Dní týdně', [[2, '2'], [3, '3'], [4, '4'], [5, '5']].map(function (x) { return [String(x[0]), x[1]]; }), String(S.vstup.dny_treninku))
        + sel('tpMisto', 'Kde cvičí', MISTA, S.vstup.kde_cvici)
        + sel('tpVyb', 'Vybavení', VYBAVENI, S.vstup.vybaveni)
        + sel('tpLevel', 'Úroveň', UROVNE, S.vstup.level)
        + sel('tpCil', 'Cíl', CILE, S.vstup.cil)
        + sel('tpStruktura', 'Struktura tréninku', STRUKTURY, S.vstup.struktura)
        + sel('tpOpakovani', 'Opakování a váha', OPAKOVANI, S.vstup.opakovani)
        + '<label style="font-size:.75rem;color:#8F8A99;">Varianta<br><input type="number" id="tpSeed" min="0" max="99" value="' + S.vstup.seed + '" style="width:70px;margin-top:3px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px 9px;color:#fff;font-family:inherit;font-size:.88rem;"></label>'
        + '<label style="flex:1;min-width:180px;font-size:.75rem;color:#8F8A99;">Jméno do hlavičky<br><input type="text" id="tpJmeno" value="' + esc(ctx.name || '') + '" style="width:100%;box-sizing:border-box;margin-top:3px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px 9px;color:#fff;font-family:inherit;font-size:.88rem;"></label>'
        + '<label style="min-width:120px;font-size:.75rem;color:#8F8A99;">Oslovení (5. pád)<br><input type="text" id="tpVok" value="' + esc(ctx.vok || '') + '" style="width:100%;box-sizing:border-box;margin-top:3px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px 9px;color:#fff;font-family:inherit;font-size:.88rem;"></label>'
        + '</div>'
        + '<p class="muted" style="margin:8px 0 0;font-size:.75rem;">„Varianta" jen zamíchá výběrem cviků. Stejné zadání a stejná varianta dají vždycky totožný plán. '
        + '„Struktura" rozhodne, jestli bude v tréninku míň cviků po víc sériích, nebo naopak; „Opakování a váha" posune rozsah opakování a pauzy. '
        + 'Ani jedna z nich nemění týdenní objem po partiích, jen jeho rozložení.</p>'
        + '</div>';

      // 2) omezení
      // ⛔ `zraneni` v dotazníku NENÍ (ověřeno v živé DB 2. 9. 2026), popisek s ním sliboval
      // informaci, která nikdy nepřijde. Zdravotní sekce dotazníku sbírá `zdravi`, `leky`
      // a `alergie`; `poznamka` je volný vzkaz.
      var zdravi = [['Zdravotní omezení a diagnózy', idata.zdravi], ['Léky a doplňky', idata.leky],
        ['Alergie a intolerance', idata.alergie], ['Vzkaz v dotazníku', idata.poznamka]]
        .filter(function (x) { return x[1] && String(x[1]).trim(); })
        .map(function (x) { return '<b>' + esc(x[0]) + ':</b> ' + esc(x[1]); }).join('<br>');
      h += '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px;margin-top:10px;">'
        + '<div class="muted" style="font-size:.75rem;text-transform:uppercase;margin-bottom:6px;">2. Co z plánu vyřadit</div>'
        + (zdravi ? '<p style="margin:0 0 8px;font-size:.8rem;background:rgba(255,107,107,.1);border-radius:8px;padding:7px 9px;">' + zdravi + '</p>'
          : '<p class="muted" style="margin:0 0 8px;font-size:.8rem;">V dotazníku není nic o zdraví ani o zraněních.</p>')
        + '<p class="muted" style="margin:0 0 8px;font-size:.78rem;">⛔ <b>Engine tenhle text nečte a sám podle něj nikdy nic nevyřadí.</b> '
        + 'Co z plánu vypadne, rozhoduješ Ty zaškrtnutím níž.</p>'
        // ⛔ [2026-09-02, po revizi] Dřív tu stálo „nečte ani engine, ani AI". U AI to nebyla
        // pravda: `admin-api` posílá do promptu zdravotní omezení, vzkaz z dotazníku i text
        // z pole níž. Martin se podle téhle věty rozhoduje, co do adminu vůbec pustí, takže
        // musí být přesná. Model běží u třetí strany (Anthropic nebo xAI, podle nastavení).
        + '<p style="margin:0 0 8px;font-size:.78rem;background:rgba(255,180,110,.12);border:1px solid rgba(255,180,110,.35);border-radius:8px;padding:7px 9px;">'
        + '🤖 <b>Co z téhle sekce dostane AI:</b> zdravotní omezení, vzkaz z dotazníku a text, který napíšeš do pole „Zranění a omezení" níž. '
        + 'Léky ani alergie se do promptu neposílají. AI o tom smí napsat jedinou větu, že se ozveš osobně, a o cvicích nerozhoduje. '
        + '<b>Model běží u AI třetí strany</b> (Anthropic nebo xAI), takže co sem napíšeš, odejde ven. Co tam mít nemá, smaž.</p>'
        + '<label style="display:block;font-size:.75rem;color:#8F8A99;margin-bottom:8px;">Zranění a omezení (předvyplněno ze „Zdravotní omezení" v dotazníku, uprav na to, co je pro trénink podstatné)'
        + '<textarea id="tpOmezeni" rows="2" style="width:100%;box-sizing:border-box;margin-top:3px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:8px 10px;color:#fff;font-family:inherit;font-size:.88rem;line-height:1.45;">' + esc(S.omezeni) + '</textarea></label>'
        + '<div style="margin-bottom:8px;">' + PARTIE.map(function (p) {
          return '<label style="cursor:pointer;font-size:.85rem;color:#cbbfae;margin-right:14px;white-space:nowrap;">'
            + '<input type="checkbox" data-tppartie="' + p[0] + '" style="accent-color:#EBB12C;vertical-align:-2px;margin-right:5px;">' + esc(p[1]) + '</label>';
        }).join('') + '</div>'
        + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
        + '<input type="text" id="tpHledej" placeholder="hledej cvik k vyloučení (např. dřep)…" style="flex:1;min-width:200px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:7px 10px;color:#fff;font-family:inherit;font-size:.88rem;"></div>'
        + '<div id="tpHledejOut" style="margin-top:6px;"></div>'
        + '<div id="tpVyl" style="margin-top:8px;"></div>'
        + '</div>';

      // 3) texty
      h += '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px;margin-top:10px;">'
        + '<div class="muted" style="font-size:.75rem;text-transform:uppercase;margin-bottom:6px;">3. Texty</div>'
        + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px;">'
        + '<button class="mlogbtn" id="tpTextyBtn">Napsat texty (AI)</button>'
        + '<span class="muted" style="font-size:.78rem;">AI dostane plán jako hotová fakta a nesmí ho měnit. Přečti to a přepiš, jde to ven pod Tvým jménem.</span></div>'
        + '<div id="tpTextyStav"></div>'
        + ta('tpT_uvod', 'Úvod (pod „Ahoj …!")', 4)
        + ta('tpT_zaver', '„Na závěr"', 4)
        + ta('tpT_pozn', 'Vlastní rámeček pod rozvrhem (nepovinné)', 2)
        + '</div>';

      // 4) plán
      h += '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px;margin-top:10px;">'
        + '<div class="muted" style="font-size:.75rem;text-transform:uppercase;margin-bottom:6px;">4. Plán</div>'
        + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px;">'
        + '<button class="mlogbtn" id="tpGenBtn">Vygenerovat plán</button>'
        + '<span class="muted" style="font-size:.78rem;">Po každé změně zadání nebo vyloučení dej vygenerovat znovu.</span></div>'
        + '<div id="tpPlan"></div></div>';

      // 5) výstup
      h += '<div style="background:rgba(235,177,44,.06);border:1px solid rgba(235,177,44,.3);border-radius:10px;padding:12px;margin-top:10px;">'
        + '<div class="muted" style="font-size:.75rem;text-transform:uppercase;margin-bottom:6px;">5. Hotový dokument</div>'
        + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
        + '<button class="mlogbtn" id="tpNahled">Náhled a tisk</button>'
        + '<button class="mlogbtn" id="tpUloz">Uložit klientovi</button></div>'
        + '<p class="muted" style="margin:8px 0 0;font-size:.78rem;">Náhled má navíc kontrolní stranu s objemem po partiích, jen pro Tebe. '
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
    function nactiVstup() {
      S.vstup.dny_treninku = Number($('tpDny').value) || 3;
      S.vstup.kde_cvici = $('tpMisto').value;
      S.vstup.vybaveni = $('tpVyb').value;
      S.vstup.level = $('tpLevel').value;
      S.vstup.cil = $('tpCil').value;
      if ($('tpStruktura')) S.vstup.struktura = $('tpStruktura').value;
      if ($('tpOpakovani')) S.vstup.opakovani = $('tpOpakovani').value;
      S.vstup.seed = Math.max(0, Math.min(99, Number($('tpSeed').value) || 0));
      var om = $('tpOmezeni');
      if (om) S.omezeni = (om.value || '').trim();
      S.vstup.vyloucene_partie = [];
      el.querySelectorAll('[data-tppartie]').forEach(function (ch) {
        if (ch.checked) S.vstup.vyloucene_partie.push(ch.getAttribute('data-tppartie'));
      });
    }
    function nactiTexty() {
      S.texty.uvod = $('tpT_uvod').value;
      S.texty.zaver = $('tpT_zaver').value;
      S.texty.poznamka = ($('tpT_pozn').value || '').trim();
    }

    // ---------- vyloučené cviky ----------
    function hledej(q, limit) {
      var s = bezDia(q).trim();
      if (s.length < 2 || !DB) return [];
      return DB.filter(function (e) {
        return S.vstup.vyloucene_cviky.indexOf(e.id) === -1 && bezDia(e.name).indexOf(s) !== -1;
      }).slice(0, limit || 10);
    }
    function pridejVyl(id) {
      if (S.vstup.vyloucene_cviky.indexOf(id) === -1) S.vstup.vyloucene_cviky.push(id);
      prekresliVyl();
    }
    function prekresliVyl() {
      var box = $('tpVyl'); if (!box) return;
      if (!S.vstup.vyloucene_cviky.length) {
        box.innerHTML = '<p class="muted" style="font-size:.78rem;margin:0;">Zatím nic vyřazeného.</p>';
        return;
      }
      box.innerHTML = S.vstup.vyloucene_cviky.map(function (id) {
        var e = (DB || []).filter(function (x) { return x.id === id; })[0];
        return '<span style="display:inline-block;margin:0 6px 5px 0;font-size:.8rem;background:rgba(255,107,107,.12);border-radius:8px;padding:3px 8px;">'
          + esc(e ? e.name : id) + ' <a href="#" data-tpdel="' + esc(id) + '" style="color:#ff6b6b;text-decoration:none;">✕</a></span>';
      }).join('');
      box.querySelectorAll('[data-tpdel]').forEach(function (a) {
        a.addEventListener('click', function (ev) {
          ev.preventDefault();
          var id = a.getAttribute('data-tpdel');
          S.vstup.vyloucene_cviky = S.vstup.vyloucene_cviky.filter(function (x) { return x !== id; });
          prekresliVyl();
        });
      });
    }

    // ---------- generování ----------
    function generuj() {
      nactiVstup();
      try {
        S.program = global.WorkoutGen.assembleProgram(DB, S.vstup);
      } catch (e) {
        S.program = null;
        var b0 = $('tpPlan');
        if (b0) b0.innerHTML = '<p style="font-size:.85rem;color:#ff9b9b;">⚠️ Plán se nepodařilo sestavit: ' + esc(e.message || e) + '</p>';
        return;
      }
      prekresliPlan();
    }

    // Náhled v adminu. ⛔ Objem po partiích tu MUSÍ být vidět hned: plán, který nechá partii
    // pod minimem nebo přeteče strop, se v seznamu cviků nepozná a v hotovém dokumentu
    // už vůbec ne. Stejná role jako kontrolní pruh pod dnem v nutričním průvodci.
    function prekresliPlan() {
      var box = $('tpPlan'); if (!box || !S.program) return;
      var p = S.program;
      var h = '';
      p.rozvrh.forEach(function (d) {
        h += '<div style="margin-bottom:10px;">'
          + '<div style="font-size:.85rem;color:#F6CD63;margin-bottom:3px;">' + esc(d.den) + ' &middot; ' + esc(d.nazev) + '</div>'
          + '<div style="font-size:.8rem;line-height:1.5;">'
          + d.cviky.map(function (c) {
            var kolik = c.kardio ? c.opakovani : (c.serie + ' × ' + c.opakovani);
            return '<span class="muted">' + esc(kolik) + '</span> ' + esc(c.nazev);
          }).join('<br>')
          + '</div></div>';
      });
      var ZONA = { low: ['#ffb46b', 'málo'], building: ['#7BD88F', 'optimum'], high: ['#F6CD63', 'strop'], over: ['#ff8b8b', 'PŘEPAL'] };
      h += '<div style="display:flex;flex-wrap:wrap;gap:8px;font-size:.76rem;margin-top:6px;padding:6px 8px;background:rgba(255,255,255,.04);border-radius:8px;">'
        + p.objem.map(function (v) {
          var z = ZONA[v.zone] || ['#8F8A99', v.zone];
          return '<span style="color:' + z[0] + ';">' + esc(v.label) + ' ' + String(v.sets).replace('.', ',') + ' (' + z[1] + ')</span>';
        }).join('')
        + '</div>'
        + '<p class="muted" style="margin:6px 0 0;font-size:.75rem;">Série na partii za týden proti pásmům MEV / MAV / MRV. '
        + '„Málo" u vlastní váhy bývá díra v databázi cviků, ne chyba plánu.</p>';
      box.innerHTML = h;
    }

    // ---------- AI ----------
    // ⛔ Stejná ochrana nákladu jako u `pruvodce_text`: druhý klik do deseti minut AI nevolá,
    // pokud se nezměnilo zadání. Server si drží otisk, tady se posílá jen to, co ho tvoří.
    function volejAI(btn) {
      if (btn.disabled) return;
      nactiVstup();
      if (!S.program) { toast('Nejdřív vygeneruj plán, AI ho dostává jako fakta.'); return; }
      var t0 = btn.textContent; btn.disabled = true; btn.textContent = 'Píšu…';
      $('tpTextyStav').innerHTML = '<p class="muted" style="font-size:.82rem;">Píšu texty, může to trvat půl minuty…</p>';
      ctx.api({
        action: 'trenink_text', email: ctx.email,
        osloveni: ($('tpVok').value || '').trim(), rod: ctx.rod || '',
        dny: S.vstup.dny_treninku, kde: S.vstup.kde_cvici, vybaveni: S.vstup.vybaveni,
        level: S.vstup.level, cil: S.vstup.cil,
        rezim: (S.program.cil || {}).label || '',
        pauzy: (S.program.cil || {}).rest || '',
        // Jen NÁZVY dnů a hlavních cviků, ať model ví, o čem píše, a nevymýšlí si jiné.
        dny_popis: S.program.rozvrh.map(function (d) {
          return d.den + ': ' + d.nazev + ' (' + d.cviky.filter(function (c) { return !c.doplnkovy && !c.kardio; })
            .map(function (c) { return c.nazev; }).join(', ') + ')';
        }),
        vyloucene: S.vstup.vyloucene_partie.concat(S.vstup.vyloucene_cviky),
        // ⛔ Kurátorovaný text od Martina, ne surové pole z dotazníku (to v `client_intake`
        // neexistuje). Server ho vloží do promptu jako citaci a do ničeho jiného.
        zraneni: S.omezeni.slice(0, 600)
      }).then(function (o) {
        btn.disabled = false; btn.textContent = t0;
        var j = o.j || {};
        if (!j.ok) {
          var e = String(j.error || o.status);
          var why = e === 'ai_nedostupne' ? 'AI teď neodpovídá, zkus to za chvíli'
            : e === 'chybi_klic' ? 'v projektu chybí API klíč k AI'
              : e === 'ai_prazdno' ? 'AI vrátila prázdný text, zkus to znovu'
                : e === 'chybi_tabulka' ? 'chybí tabulka pruvodce_drafts, je potřeba nasadit migraci pruvodce-drafts.sql'
                  : e === 'no_email' ? 'chybí e-mail klienta'
                    : 'chyba (' + esc(e) + ')';
          $('tpTextyStav').innerHTML = '<p style="font-size:.82rem;color:#ff9b9b;">⚠️ Nepovedlo se: ' + why + '.</p>';
          return;
        }
        var t = j.texty || {};
        if (t.uvod) $('tpT_uvod').value = t.uvod;
        if (t.zaver) $('tpT_zaver').value = t.zaver;
        var st = '';
        if ((j.upozorneni || []).length) {
          st += '<p style="margin:0 0 6px;font-size:.82rem;color:#ffb4b4;">⚠️ V dotazníku je téma '
            + esc((j.upozorneni || []).join(', ')) + '. AI k němu schválně nic neradí, tohle patří Tobě.</p>';
        }
        st += '<p class="muted" style="margin:0 0 8px;font-size:.78rem;">🤖 Návrh od AI, přečti a přepiš.'
          + (j.znovu ? ' (Tenhle koncept už byl hotový, nový se dá zadat za pár minut.)' : '') + '</p>';
        $('tpTextyStav').innerHTML = st;
      }).catch(function () {
        btn.disabled = false; btn.textContent = t0;
        $('tpTextyStav').innerHTML = '<p style="font-size:.82rem;color:#ff9b9b;">⚠️ Chyba spojení.</p>';
      });
    }

    // ---------- výstup ----------
    function data() {
      nactiVstup(); nactiTexty();
      return {
        jmeno: ($('tpJmeno').value || '').trim(),
        osloveni: ($('tpVok').value || '').trim(),
        datum: dnesCz(),
        program: S.program,
        vstup: S.vstup,
        texty: S.texty
      };
    }
    function hotovoHtml(proMartina) {
      return global.TreninkSablona.render(data(), { proMartina: !!proMartina });
    }
    // UTF-8 do base64. ⛔ Holé `btoa` na češtině spadne, `unescape` je zrušené API.
    function b64(s) {
      var b = new TextEncoder().encode(s), out = '';
      for (var i = 0; i < b.length; i += 8192) out += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
      return btoa(out);
    }

    // ---------- naveseni ----------
    function naveseni() {
      $('tpGenBtn').addEventListener('click', generuj);
      $('tpTextyBtn').addEventListener('click', function () { volejAI($('tpTextyBtn')); });

      var hl = $('tpHledej');
      hl.addEventListener('input', function () {
        var out = $('tpHledejOut'), nal = hledej(hl.value, 12);
        if (!nal.length) { out.innerHTML = ''; return; }
        out.innerHTML = nal.map(function (e) {
          return '<a href="#" data-tpadd="' + esc(e.id) + '" style="display:inline-block;margin:0 8px 5px 0;font-size:.8rem;color:#F6CD63;text-decoration:none;">+ ' + esc(e.name) + '</a>';
        }).join('');
        out.querySelectorAll('[data-tpadd]').forEach(function (a) {
          a.addEventListener('click', function (ev) {
            ev.preventDefault(); pridejVyl(a.getAttribute('data-tpadd'));
            hl.value = ''; out.innerHTML = '';
          });
        });
      });

      $('tpNahled').addEventListener('click', function () {
        if (!S.program) { toast('Nejdřív vygeneruj plán.'); return; }
        var w = window.open('', '_blank');
        if (!w) { toast('Prohlížeč zablokoval nové okno.'); return; }
        w.document.write(hotovoHtml(true)); w.document.close();
      });

      $('tpUloz').addEventListener('click', function () {
        if (!S.program) { toast('Nejdřív vygeneruj plán.'); return; }
        var b = $('tpUloz'); if (b.disabled) return;
        var soubor = 'trenink-' + dnesIso() + '.html';
        if (!confirm('Uložit tréninkový plán klientovi ' + ctx.email + ' jako ' + soubor + '?\n\n'
          + 'Klient ho uvidí ve své sekci pod „Dokumenty od Martina". Odkaz mu pošli sám, admin nic neodesílá.\n'
          + 'Kontrolní strana s objemem po partiích se do souboru NEUKLÁDÁ.')) return;
        var t0 = b.textContent; b.disabled = true; b.textContent = 'Ukládám…';
        // ⛔ proMartina = false: klient nesmí dostat kontrolní stranu ani tlačítko Tisk v hlavičce.
        ctx.api({
          action: 'client_doc_upload', folder: ctx.email, filename: soubor,
          content_type: 'text/html; charset=utf-8', content_base64: b64(hotovoHtml(false))
        }).then(function (o) {
          b.disabled = false; b.textContent = t0;
          if (o.j && o.j.ok) {
            toast('✅ Uloženo klientovi: ' + soubor);
            // ⛔ Bod 3: stejná oprava jako v pruvodce.js, ať seznam dokumentů nezůstane
            // „Zatím nic" do reloadu stránky.
            if (ctx.poUlozeni) ctx.poUlozeni(ctx.email);
          }
          else toast('Chyba: ' + ((o.j && o.j.error) || o.status));
        }).catch(function () { b.disabled = false; b.textContent = t0; toast('Chyba spojení'); });
      });
    }
  }

  /**
   * Jednořádkové zavolání odjinud (například z připravované sekce Onboarding):
   * `window.TreninkPlan.render(klient)`. Sekci si najde sám podle `#trenink-plan`,
   * takže volající nemusí řešit, kam to pověsit. `mount(el, ctx)` zůstává pro případ,
   * kdy chce volající vlastní místo.
   * ⛔ Kontext (`api`, `toast`, `email`) se předává výslovně, modul do adminu sám nesahá.
   */
  function render(ctx) {
    var el = document.getElementById('trenink-plan');
    if (!el) return false;
    var host = el.querySelector('#tpWrap') || el;
    host.innerHTML = '';
    mount(host, ctx || {});
    return true;
  }

  global.TreninkPlan = { mount: mount, render: render, pripravEngine: pripravEngine, _stavDb: function () { return DB; } };
})(window);
