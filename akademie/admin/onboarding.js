// 🚀 ONBOARDING KLIENTA: sekce v kartě klienta (admin Barna Academy).
//
// Martin otevře nového klienta, uvidí tři varianty cílů spočítané z dotazníku, jednu vybere
// a systém mu z ní připraví zadání pro klienta, cíle v appce a dva koncepty mailů do Gmailu.
// ⛔ Odeslání dělá vždy Martin sám ze své schránky, tenhle modul nikdy nic neodesílá.
//
// ROZDĚLENÍ ODPOVĚDNOSTI:
//   • kalorie, makra, vláknina, tempo ......... engine `assets/onboarding-cile.js`, deterministicky
//   • text mailů ............................. sloty v témže enginu (Martinův vzor z 1. 9. 2026)
//   • uložení zadání ......................... existující akce `client_targets_save`
//   • propsání cílů do appky Tvůj Coach ...... akce `tc_goals_push` (most přes academy-grant)
//   • odeslání mailu ......................... Martin, ručně
// ⛔ Žádná AI. V téhle sekci nevzniká ani jedna věta, kterou by psal model.
(function (global) {
  'use strict';

  var OC_URL = '/assets/onboarding-cile.js?v=20260905a';
  // Strop délky těla mailu v adrese Gmailu.
  // ⭐ ZMĚŘENO 2. 9. 2026 v Martinově přihlášeném Chromu, ne odhadnuto: uvítací mail
  // (2148 znaků, po zakódování adresa 4007 znaků) se v okně Napsat zprávu předvyplnil
  // celý, včetně diakritiky, apostrofu v předmětu a odřádkování. Zadání počítalo
  // s ~1800 znaky; při tom čísle by KAŽDÝ uvítací mail spadl do náhradní cesty
  // (zkopírovat a vložit), takže hlavní funkce by se nikdy nepoužila.
  // ⚠️ SNÍŽENO NA 4000 PO REVIZI: změřený je jen bod 2171 znaků těla (4007 v adrese).
  // Poměr je zhruba 1,85x, takže 6000 znaků těla dá adresu kolem 11 000 znaků, a mezi
  // 4 000 a 11 000 je pás, kde může Gmail tělo utnout TIŠE (prohlížeč unese 32 kB, Gmail
  // svůj limit nikde nepíše). 4000 je nejbližší kulaté číslo nad změřeným bodem, u kterého
  // se pořád vejde celý uvítací mail. Zvedat se smí, ale až po měření dlouhým konceptem.
  // ⚠️ Náhradní cesta zůstává: když text přeteče, Gmail se otevře jen s příjemcem
  // a předmětem a text se zkopíruje do schránky.
  var GMAIL_BODY_MAX = 4000;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nactiSkript(src) {
    return new Promise(function (ok, err) {
      if (global.OnboardingCile) return ok();
      if (document.querySelector('script[data-ob="' + src + '"]')) {
        var t = setInterval(function () { if (global.OnboardingCile) { clearInterval(t); ok(); } }, 60);
        setTimeout(function () { clearInterval(t); global.OnboardingCile ? ok() : err(new Error('nenacteno: ' + src)); }, 8000);
        return;
      }
      var s = document.createElement('script');
      s.src = src; s.setAttribute('data-ob', src);
      s.onload = function () { ok(); }; s.onerror = function () { err(new Error('nenacteno: ' + src)); };
      document.head.appendChild(s);
    });
  }
  function dnesCz() {
    var d = new Date();
    return d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear();
  }
  function kopiruj(text, toast) {
    function hotovo() { if (toast) toast('📋 Zkopírováno'); }
    if (global.navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(hotovo, function () { if (toast) toast('Zkopíruj prosím ručně'); });
    } else if (toast) toast('Zkopíruj prosím ručně');
  }
  // Kopírování naformátovaného mailu (text/html + text/plain najednou) žije JEDNOU
  // v `report-reakce-sablona.js` (`ReportReakce.kopirujFormatovane`), tady se jen volá.
  function gmailUrl(to, predmet, telo) {
    var zaklad = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(to)
      + '&su=' + encodeURIComponent(predmet);
    if (telo && telo.length <= GMAIL_BODY_MAX) return zaklad + '&body=' + encodeURIComponent(telo);
    return zaklad;
  }

  // ctx: { email, name, vok, rod, intake, targets, api, toast, poVyberu }
  function mount(el, ctx) {
    var idata = ctx.intake || {};
    var S = {
      pohlavi: ctx.rod === 'z' ? 'z' : 'm',
      trenink_minut: '',
      bilkoviny_g_kg: '',
      nasobic: '',              // prázdné = odhad z dotazníku
      met: '',                  // prázdné = odhad ze sportu
      cil_rezim: '',            // prázdné = odhad z textu cíle
      vysledek: null,
      vybrana: null,
      zdravi_odkliknuto: false,
      appka: 'nevim',           // 'propsano' | 'neni' | 'nevim'
      appka_uid: '',
      // ⛔ VÝCHOZÍ VYPNUTO (revize 2. 9. 2026). Dřív tu bylo `true`, takže jedno kliknutí
      // na „Vybrat" zapsalo cíle do appky platícího klienta bez jediného potvrzení, a
      // překliknutí na sousední kartu vyrobilo další řádek v `goals`. Zpět se `goals_mode`
      // vrací jen ručně v DB nebo klientem v appce, takže to nebyla vratná akce.
      auto_propsat: false
    };

    el.innerHTML = '<p class="muted" style="font-size:.85rem;">Načítám engine cílů…</p>';
    nactiSkript(OC_URL).then(function () { prepocti(); }).catch(function (e) {
      el.innerHTML = '<p style="font-size:.85rem;color:#ff9b9b;">⚠️ Onboarding se nedá spustit: ' + esc(e.message || e) + '</p>';
    });

    function $(id) { return el.querySelector('#' + id); }
    function toast(m) { if (ctx.toast) ctx.toast(m); }

    function prepocti() {
      S.vysledek = global.OnboardingCile.varianty({
        pohlavi: S.pohlavi,
        vek: idata.vek, vyska: idata.vyska, vaha: idata.vaha,
        kroky: idata.kroky, dny_treninku: idata.dny_treninku,
        trenink_minut: S.trenink_minut, bilkoviny_g_kg: S.bilkoviny_g_kg,
        nasobic: S.nasobic, met: S.met, cil_rezim: S.cil_rezim,
        aktivita: idata.aktivita, prace: idata.prace, sport: idata.sport,
        spanek: idata.spanek, cil: idata.cil, proc: idata.proc, termin: idata.termin,
        // ⛔ Zdravotní brána čte VŠECHNA textová pole, ne tři vybraná. Kdo tenhle výčet
        // zkrátí, vypne bránu u polí, ve kterých se kojení a diagnózy reálně našly.
        zdravi: idata.zdravi, leky: idata.leky, diety: idata.diety,
        alergie: idata.alergie, neji: idata.neji, poznamka: idata.poznamka
      });
      kresli();
    }

    // ---------------- vykreslení ----------------
    function kresli() {
      var r = S.vysledek;
      var h = '';

      if (!r.ok) {
        h += '<div style="background:rgba(255,107,107,.08);border:1px solid rgba(255,107,107,.35);border-radius:10px;padding:12px;font-size:.87rem;">'
          + '⛔ Z dotazníku se cíle spočítat nedají, chybí: <b>' + esc(r.chybi.join(', ')) + '</b>. '
          + 'Doplň to s klientem a otevři kartu znovu, nebo zadání vyplň ručně výš.</div>';
        el.innerHTML = h;
        return;
      }

      // zdravotní brána
      if (r.citliva.length) {
        h += '<div style="background:rgba(255,107,107,.1);border:1px solid rgba(255,107,107,.5);border-radius:10px;padding:12px;margin-bottom:10px;">'
          + '<p style="margin:0 0 6px;font-size:.9rem;color:#ff9b9b;"><b>⛔ Nejdřív zkontroluj zdraví a léky.</b> '
          + 'V dotazníku je: ' + esc(r.citliva.join(', ')) + '.</p>'
          + '<p class="muted" style="margin:0 0 8px;font-size:.82rem;">Engine na tohle nebere ohled, počítá jen z čísel. '
          + 'Než variantu vybereš, přečti si pole Zdraví, Léky a Diety a rozhodni sám, jestli je vůbec na místě dávat cíle bez lékaře.</p>'
          + '<label style="font-size:.87rem;color:#cbbfae;cursor:pointer;"><input type="checkbox" id="obZdravi"'
          + (S.zdravi_odkliknuto ? ' checked' : '') + ' style="accent-color:#EBB12C;vertical-align:-2px;margin-right:6px;">Zkontroloval jsem</label>'
          + '</div>';
      }

      // vstupy
      var v = r.vstup, vy = r.vydej;
      h += '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:12px;margin-bottom:10px;">'
        + '<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;">'
        + '<div><span style="display:block;font-size:.76rem;color:#8F8A99;margin-bottom:4px;">Pohlaví <span style="color:#6d6879;">(dotazník ho nemá, odhad podle jména)</span></span>'
        + '<button type="button" class="kdrod' + (S.pohlavi === 'z' ? ' on' : '') + '" data-obrod="z">žena</button>'
        + '<button type="button" class="kdrod' + (S.pohlavi === 'm' ? ' on' : '') + '" data-obrod="m">muž</button></div>'
        + '<label style="font-size:.76rem;color:#8F8A99;">Délka tréninku <span style="color:#6d6879;">(min)</span><br>'
        + '<input type="text" inputmode="decimal" id="obMin" value="' + esc(S.trenink_minut) + '" placeholder="60" style="width:80px;margin-top:3px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px 9px;color:#fff;font-family:inherit;font-size:.88rem;"></label>'
        + '<label style="font-size:.76rem;color:#8F8A99;">Bílkoviny <span style="color:#6d6879;">(g/kg, 1,8 až 2,2)</span><br>'
        + '<input type="text" inputmode="decimal" id="obBil" value="' + esc(S.bilkoviny_g_kg) + '" placeholder="podle cíle" style="width:110px;margin-top:3px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px 9px;color:#fff;font-family:inherit;font-size:.88rem;"></label>'
        + '<button class="mlogbtn" id="obPrepocet">Přepočítat</button>'
        + '</div>'
        // ⛔ CÍL SE NEHÁDÁ. Revize našla dva skutečné dotazníky, kde text („Cílová váha 92 kg")
        // žádnému regexu nesedl a engine nabídl sadu pro udržení člověku, který chce hubnout.
        // Předvyplněno odhadem, rozhoduje Martin.
        + '<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08);">'
        + '<span style="display:block;font-size:.76rem;color:#8F8A99;margin-bottom:4px;">Cíl '
        + '<span style="color:#6d6879;">(' + (r.cil_potvrzen ? 'potvrdil jsi Ty' : 'odhad z textu „' + esc(String(v.cil || '').slice(0, 40)) + '", zkontroluj') + ')</span></span>'
        + [['hubnuti', 'hubnutí'], ['udrzeni', 'udržení'], ['postava', 'postava a rekompozice'], ['nabirani', 'nabírání']]
            .map(function (x) {
              return '<button type="button" class="kdrod' + (r.cil === x[0] ? ' on' : '') + '" data-obcil="' + x[0] + '">' + x[1] + '</button>';
            }).join('')
        + '</div>'
        // Násobič aktivity: škála z appky. Předvýběr z dotazníku, Martin přepne.
        + '<div style="margin-top:10px;">'
        + '<span style="display:block;font-size:.76rem;color:#8F8A99;margin-bottom:4px;">Násobič běžného dne '
        + '<span style="color:#6d6879;">(dotazník říká „' + esc(String(v.aktivita || 'nic').slice(0, 30)) + '")</span></span>'
        + [[1.2, 'sedavý 1,2'], [1.375, 'lehce aktivní 1,375'], [1.55, 'aktivní 1,55'], [1.725, 'velmi aktivní 1,725']]
            .map(function (x) {
              return '<button type="button" class="kdrod' + (vy.nasobic === x[0] ? ' on' : '') + '" data-obnas="' + x[0] + '">' + x[1] + '</button>';
            }).join('')
        + '</div>'
        // Intenzita sportu (MET). Pole `sport` je vyprávění, ne výčet, takže odhad umí minout.
        + '<div style="margin-top:10px;">'
        + '<span style="display:block;font-size:.76rem;color:#8F8A99;margin-bottom:4px;">Intenzita tréninku '
        + '<span style="color:#6d6879;">(teď: „' + esc((vy.sport_ted || 'nic').slice(0, 40)) + '")</span></span>'
        + [[3.5, 'chůze a jóga'], [6, 'posilovna'], [8, 'míčové hry'], [9, 'běh a plavání'], [10, 'MMA a HIIT']]
            .map(function (x) {
              return '<button type="button" class="kdrod' + (vy.met === x[0] ? ' on' : '') + '" data-obmet="' + x[0] + '">' + x[1] + '</button>';
            }).join('')
        + '</div>'
        + '<p class="muted" style="margin:8px 0 0;font-size:.8rem;">Výdej ' + Math.round(vy.tdee) + ' kcal = klid '
        + Math.round(vy.bmr) + ' × ' + String(vy.nasobic).replace('.', ',') + ' běžný den + ' + Math.round(vy.kroky_kcal) + ' kcal kroky ('
        + (v.kroky == null ? 'neuvedeny' : v.kroky) + ') + ' + Math.round(vy.trenink_kcal) + ' kcal trénink ('
        + vy.trenink_dni + '× ' + vy.trenink_minut + ' min, MET ' + String(vy.met).replace('.', ',') + ').'
        + (r.bmi != null ? ' BMI ' + String(r.bmi).replace('.', ',') + '.' : '')
        + '</p>';
      if (r.varovani.length) {
        h += '<ul style="margin:6px 0 0;padding-left:18px;font-size:.8rem;color:#F6CD63;">'
          + r.varovani.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
      }
      h += '</div>';

      // karty
      // ⛔ Zámek nezakrývá jen tlačítko, ale i ČÍSLA. Revize: „brána skrývá jen tlačítko,
      // čísla ukazuje pořád", takže si je Martin mohl přečíst a opsat do mailu, aniž by
      // se podíval na zdraví. Zašedlé karty ho donutí odkliknout kontrolu dřív.
      var zamek = r.citliva.length && !S.zdravi_odkliknuto;
      h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;'
        + (zamek ? 'opacity:.35;filter:blur(2px);pointer-events:none;user-select:none;' : '') + '">';
      r.karty.forEach(function (k) {
        var vybrana = S.vybrana && S.vybrana.klic === k.klic;
        h += '<div style="background:rgba(255,255,255,' + (vybrana ? '.08' : '.04') + ');border:1px solid '
          + (vybrana ? '#EBB12C' : 'rgba(255,255,255,.12)') + ';border-radius:10px;padding:12px;">'
          + '<p style="margin:0 0 2px;font-size:.95rem;font-weight:700;color:#F6CD63;">' + esc(k.nazev) + '</p>'
          + '<p class="muted" style="margin:0 0 8px;font-size:.76rem;">' + (k.posun_pct === 0 ? 'kolem výdeje' : (k.posun_pct > 0 ? '+' : '') + k.posun_pct + ' % proti výdeji') + '</p>'
          + '<p style="margin:0 0 6px;font-size:1.25rem;font-weight:800;color:#fff;">' + k.kcal + ' <span style="font-size:.8rem;font-weight:400;color:#8F8A99;">kcal</span></p>'
          + '<p style="margin:0 0 6px;font-size:.85rem;line-height:1.6;">'
          + k.protein + ' g bílkoviny (' + k.protein_kcal + ' kcal)<br>'
          + k.carbs + ' g sachry (' + k.carbs_kcal + ' kcal)<br>'
          + k.fat + ' g tuky (' + k.fat_kcal + ' kcal)<br>'
          + 'Vláknina ' + k.fiber + ' g a více</p>'
          + '<p class="muted" style="margin:0 0 6px;font-size:.8rem;">' + esc(k.tempo_veta) + '</p>'
          + '<p style="margin:0 0 8px;font-size:.8rem;color:#cbbfae;">' + esc(k.proc) + '</p>'
          + (k.varovani.length ? '<ul style="margin:0 0 8px;padding-left:16px;font-size:.76rem;color:#F6CD63;">'
            + k.varovani.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '')
          + '<button class="mlogbtn" data-obvyber="' + esc(k.klic) + '"' + (zamek ? ' disabled title="Nejdřív odklikni kontrolu zdraví"' : '') + '>'
          + (vybrana ? '✅ Vybráno' : 'Vybrat') + '</button>'
          + '</div>';
      });
      h += '</div>';

      h += '<div id="obPoVyberu" style="margin-top:12px;"></div>';
      el.innerHTML = h;
      handlery();
      if (S.vybrana) kresliPoVyberu();
    }

    function handlery() {
      var z = $('obZdravi');
      if (z) z.addEventListener('change', function () { S.zdravi_odkliknuto = z.checked; kresli(); });
      Array.prototype.forEach.call(el.querySelectorAll('[data-obrod]'), function (b) {
        b.addEventListener('click', function () { S.pohlavi = b.getAttribute('data-obrod'); S.vybrana = null; prepocti(); });
      });
      [['data-obcil', 'cil_rezim'], ['data-obnas', 'nasobic'], ['data-obmet', 'met']].forEach(function (par) {
        Array.prototype.forEach.call(el.querySelectorAll('[' + par[0] + ']'), function (b) {
          b.addEventListener('click', function () {
            S[par[1]] = b.getAttribute(par[0]);
            // Změna vstupu ruší výběr: karty se přepočítají a Martin musí vybrat znovu.
            S.vybrana = null; prepocti();
          });
        });
      });
      var pp = $('obPrepocet');
      if (pp) pp.addEventListener('click', function () {
        S.trenink_minut = ($('obMin').value || '').trim();
        S.bilkoviny_g_kg = ($('obBil').value || '').trim();
        S.vybrana = null; prepocti();
      });
      Array.prototype.forEach.call(el.querySelectorAll('[data-obvyber]'), function (b) {
        b.addEventListener('click', function () { vyber(b.getAttribute('data-obvyber')); });
      });
    }

    // ---------------- výběr varianty ----------------
    function vyber(klic) {
      var k = S.vysledek.karty.filter(function (x) { return x.klic === klic; })[0];
      if (!k) return;
      S.vybrana = k;
      kresli();

      // 1) uložit do zadání pro klienta (existující akce, jediné místo, kde cíl vzniká)
      var p = {
        action: 'client_targets_save', email: ctx.email,
        kcal: k.kcal, protein: k.protein, carbs: k.carbs, fat: k.fat, fiber: k.fiber,
        kroky: S.vysledek.vstup.kroky == null ? '' : Math.round(S.vysledek.vstup.kroky),
        sport_min: S.vysledek.vydej.trenink_dni * S.vysledek.vydej.trenink_minut || '',
        treninky: S.vysledek.vydej.trenink_dni || '',
        note: 'varianta ' + k.nazev + ', ' + dnesCz() + ', engine v1'
      };
      ctx.api(p).then(function (o) {
        if (o.j && o.j.ok) {
          toast('🎯 Zadání uloženo z varianty „' + k.nazev + '"');
          if (ctx.poVyberu) ctx.poVyberu({ kcal: k.kcal, protein: k.protein, carbs: k.carbs, fat: k.fat, fiber: k.fiber });
        } else toast('Zadání se neuložilo: ' + ((o.j && o.j.error) || o.status));
      }).catch(function () { toast('Zadání se neuložilo, chyba spojení'); });

      // 2) propsání do appky JEN když si to Martin výslovně zapnul (výchozí je vypnuto).
      // ⛔ Zápis do cizí databáze platícímu klientovi nesmí být vedlejší účinek výběru karty.
      if (S.auto_propsat) propsatDoAppky();
    }

    function propsatDoAppky() {
      if (!S.vybrana) return;
      var k = S.vybrana;
      var stav = $('obAppStav');
      if (stav) stav.innerHTML = '<span class="muted">Propisuju do appky…</span>';
      return ctx.api({
        action: 'tc_goals_push', email: ctx.email,
        kcal: k.kcal, protein: k.protein, carbs: k.carbs, fat: k.fat, fiber: k.fiber,
        note: 'varianta ' + k.nazev + ', ' + dnesCz() + ', engine v1'
      }).then(function (o) {
        var j = o.j || {};
        if (j.ok && j.prepsano) { S.appka = 'propsano'; S.appka_uid = String(j.user_id_8 || ''); }
        else if (j.duvod === 'ucet_neexistuje') { S.appka = 'neni'; }
        else { S.appka = 'nevim'; S.appka_chyba = String(j.duvod || j.error || o.status); }
        kresliPoVyberu();
      }).catch(function () { S.appka = 'nevim'; S.appka_chyba = 'spojeni'; kresliPoVyberu(); });
    }

    // ---------------- blok po výběru ----------------
    function kresliPoVyberu() {
      var host = $('obPoVyberu');
      if (!host || !S.vybrana) return;
      var k = S.vybrana, r = S.vysledek;
      var OC = global.OnboardingCile;
      var jmeno = String(ctx.name || '').trim().split(/\s+/)[0] || '';
      var m1 = OC.mailUvitaci({
        jmeno: jmeno, osloveni: ctx.vok || jmeno, karta: k, vstup: r.vstup,
        cil: r.cil, priority: OC.priority(r.vstup), appka: S.appka
      });
      var m2 = OC.mailPruvodce({ jmeno: jmeno, osloveni: ctx.vok || jmeno });

      var appStav = S.appka === 'propsano'
        ? '<span style="color:#7BD88F;">✅ Propsáno do appky (uid ' + esc(S.appka_uid) + ')</span>'
        : (S.appka === 'neni'
          ? '<span style="color:#F6CD63;">⚠️ Klient nemá účet v appce: pošli mu registraci, cíle propíšeš potom.</span>'
          : '<span class="muted">Zatím nepropsáno' + (S.appka_chyba ? ' (' + esc(S.appka_chyba) + ')' : '') + '.</span>');

      var h = '<div style="background:rgba(235,177,44,.06);border:1px solid rgba(235,177,44,.3);border-radius:10px;padding:12px;">'
        + '<p style="margin:0 0 8px;font-size:.9rem;"><b>Vybráno: ' + esc(k.nazev) + '</b> · ' + k.kcal + ' kcal · B ' + k.protein
        + ' g · S ' + k.carbs + ' g · T ' + k.fat + ' g · vláknina ' + k.fiber + ' g. Zadání pro klienta je uložené.</p>'
        + '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">'
        + '<button class="mlogbtn" id="obPush">Propsat cíle do appky</button>'
        + '<label style="font-size:.82rem;color:#cbbfae;cursor:pointer;"><input type="checkbox" id="obAuto"' + (S.auto_propsat ? ' checked' : '')
        + ' style="accent-color:#EBB12C;vertical-align:-2px;margin-right:5px;">propsat automaticky při výběru</label>'
        + '<span id="obAppStav" style="font-size:.82rem;">' + appStav + '</span>'
        + '</div>'
        + '<div style="margin-top:10px;"><button class="mlogbtn" id="obPruvodce">Vygenerovat průvodce</button> '
        + '<span class="muted" style="font-size:.8rem;">Otevře editor jídelníčku níž s čísly z téhle varianty.</span></div>'
        + '</div>';

      h += mailBlok('ob1', '✉️ Koncept uvítacího mailu', m1, 'Martinův vzor z 1. 9. 2026, sloty vyplněné z dotazníku a z vybrané varianty. Přečti a přepiš, než pošleš.');
      h += mailBlok('ob2', '✉️ Koncept mailu „průvodce hotový"', m2, 'Krátký mail, který posíláš, až uložíš průvodce do klientské sekce.');

      host.innerHTML = h;

      $('obAuto').addEventListener('change', function () { S.auto_propsat = $('obAuto').checked; });
      $('obPush').addEventListener('click', function () {
        // Potvrzení, protože zpátky to jde jen ručně: `goals_mode` zůstane 'manual',
        // dokud ho někdo nepřepne v DB nebo klient sám v appce.
        var k = S.vybrana;
        if (!global.confirm('Propsat do appky Tvůj Coach klientovi ' + ctx.email + '?\n\n'
          + k.kcal + ' kcal · B ' + k.protein + ' g · S ' + k.carbs + ' g · T ' + k.fat + ' g · vláknina ' + k.fiber + ' g\n\n'
          + 'Vznikne mu nový cíl a týdenní check-in mu ho přestane přepisovat (režim „ruční cíle"). '
          + 'Zpátky to jde jen ručně v databázi nebo přepínačem v appce.')) return;
        propsatDoAppky();
      });
      $('obPruvodce').addEventListener('click', function () {
        var b = document.getElementById('kdPgOpen');
        if (b) b.click();
        else toast('Editor průvodce už je otevřený níž.');
      });
      [['ob1', m1], ['ob2', m2]].forEach(function (par) {
        var id = par[0], m = par[1];
        var ta = $(id + 'Text');
        var preview = $(id + 'Preview');
        function prekresliNahled() {
          if (preview && global.ReportReakce) preview.srcdoc = global.ReportReakce.mailHtml(ta.value);
        }
        prekresliNahled();
        ta.addEventListener('input', prekresliNahled);
        $(id + 'Gmail').addEventListener('click', function (e) {
          e.preventDefault();
          var telo = ta.value;
          var url = gmailUrl(ctx.email, ($(id + 'Predmet').value || m.predmet), telo);
          if (telo.length > GMAIL_BODY_MAX) {
            kopiruj(telo, toast);
            toast('Text je delší, než co Gmail unese v odkazu. Zkopíroval jsem ho, vlož ho do okna.');
          }
          window.open(url, '_blank');
        });
        $(id + 'Copy').addEventListener('click', function () { kopiruj(ta.value, toast); });
        $(id + 'CopyHtml').addEventListener('click', function () {
          if (!global.ReportReakce) { toast('Šablona reakce se nenačetla, obnov stránku.'); return; }
          global.ReportReakce.kopirujFormatovane(global.ReportReakce.mailHtml(ta.value), ta.value, toast);
        });
      });
    }

    function mailBlok(id, nadpis, m, popis) {
      var dlouhy = m.telo.length > GMAIL_BODY_MAX;
      return '<div style="margin-top:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:12px;">'
        + '<p style="margin:0 0 4px;font-size:.85rem;color:#cbbfae;"><b>' + nadpis + '</b></p>'
        + '<p class="muted" style="margin:0 0 8px;font-size:.78rem;">' + esc(popis) + ' Odesíláš Ty ze své schránky, admin neposílá nic.</p>'
        + '<label style="display:block;font-size:.76rem;color:#8F8A99;">Předmět<br>'
        + '<input type="text" id="' + id + 'Predmet" value="' + esc(m.predmet) + '" style="width:100%;box-sizing:border-box;margin-top:3px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:7px 10px;color:#fff;font-family:inherit;font-size:.9rem;"></label>'
        + '<textarea id="' + id + 'Text" rows="' + (id === 'ob1' ? 16 : 8) + '" style="width:100%;box-sizing:border-box;margin-top:6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:9px 11px;color:#fff;font-family:inherit;font-size:.88rem;line-height:1.5;">'
        + esc(m.telo) + '</textarea>'
        + '<div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap;">'
        + '<button class="mlogbtn" id="' + id + 'Gmail">Otevřít v Gmailu</button>'
        + '<button class="mlogbtn" id="' + id + 'Copy">Kopírovat text</button>'
        + '<button class="mlogbtn" id="' + id + 'CopyHtml">Zkopírovat formátovaný mail</button>'
        + (dlouhy ? '<span style="font-size:.78rem;color:#F6CD63;">Text je delší než ' + GMAIL_BODY_MAX
          + ' znaků, do adresy se nevejde. Gmail se otevře s příjemcem a předmětem, text zkopíruju a vložíš ho sám.</span>' : '')
        + '</div>'
        + '<p class="muted" style="margin:4px 0 0;font-size:.76rem;">Gmail: otevři koncept, vlož zkopírovaný formátovaný text (Ctrl+V).</p>'
        // Náhled ve stejném stylu jako klientské maily (černé pozadí, zlaté nadpisy),
        // vykreslený funkcí `ReportReakce.mailHtml` v report-reakce-sablona.js. Izolovaný
        // v iframu, ať se stránkové CSS admina nemíchá s tím, co uvidí klient v mailu.
        + '<div style="margin-top:8px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,.14);">'
        + '<iframe id="' + id + 'Preview" title="Náhled mailu" style="width:100%;height:' + (id === 'ob1' ? 360 : 200) + 'px;border:0;display:block;background:#0C0B10;"></iframe>'
        + '</div></div>';
    }
  }

  global.Onboarding = { mount: mount, _gmailUrl: gmailUrl };
})(window);
