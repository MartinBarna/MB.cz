/* Vlastní lead-magnet formulář → Supabase edge funkce 'lead-capture' (nahrazuje Tally).
   Anon klíč je veřejný (Supabase design). Po odeslání: uloží lead, odpálí Meta Lead + GA4
   generate_lead a ukáže poděkování s přímým stažením plánu. Drip e-maily řeší Resend.
   DŮLEŽITÉ: potvrzení + stažení PDF je oddělené od odeslání mailu — návštěvník vždy dostane
   plán na obrazovku, i kdyby drip/Resend zaváhal (lead se ukládá hned, mail řeší pozadí).
   Potvrzení ale přijde JEN po potvrzeném uložení leadu (viz poslatSOpakovanim níž). */
(function () {
  var SUPA = 'https://uhmrpfsdcujbhbtumqye.supabase.co';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVobXJwZnNkY3VqYmhidHVtcXllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MDA5ODgsImV4cCI6MjA5Nzk3Njk4OH0.6d7mDJtzPvdXxvFQEd6xL9n1ph6PYTrJiyDYOjlYYts';
  var FN = SUPA + '/functions/v1/lead-capture';

  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  // Oslovení v 5. pádu (vokativ) pro potvrzovací hlášku — stejná pravidla jako mailový drip.
  // Ženská jména na souhlásku (Dagmar, Ester…) mají vokativ = nominativ, ostatní skloňujeme mužsky.
  var VOK_EXC = { 'jan': 'Jane', 'pavel': 'Pavle', 'karel': 'Karle', 'zdenek': 'Zdenku', 'zdeněk': 'Zdeňku', 'josef': 'Josefe' };
  var VOK_FEM = ['dagmar', 'ester', 'miriam', 'mirjam', 'ingrid', 'karin', 'katrin', 'kristin', 'nikol', 'nicol', 'doris', 'iris', 'ines', 'agnes', 'ruth', 'elen', 'ellen', 'helen', 'karen', 'sharon', 'megan', 'vivien', 'evelin', 'marlen', 'carmen', 'dolores', 'mercedes', 'rachel'];
  var VOK_VW = 'aeiouyáéěíóúůý';
  function vokativ(name) {
    var t = String(name || '').trim().split(/\s+/)[0] || '';
    if (!t) return '';
    t = t.charAt(0).toUpperCase() + t.slice(1);
    var low = t.toLowerCase();
    if (VOK_EXC[low]) return VOK_EXC[low];
    var last = low.slice(-1);
    if (last === 'a') return t.slice(0, -1) + 'o';
    if (VOK_VW.indexOf(last) >= 0) return t;
    if (VOK_FEM.indexOf(low) >= 0) return t;
    if (low.slice(-2) === 'ek') return t.slice(0, -2) + 'ku';
    if (low.slice(-2) === 'ch' || 'kgh'.indexOf(last) >= 0) return t + 'u';
    if ('szxjšžč'.indexOf(last) >= 0) return t + 'i';
    if (low.slice(-2) === 'el') return t + 'i';
    if (last === 'r') return VOK_VW.indexOf(low.slice(-2, -1)) >= 0 ? t + 'e' : t.slice(0, -1) + 'ře';
    if ('bdflmnptvw'.indexOf(last) >= 0) return t + 'e';
    return t;
  }
  function escName(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // UTM z URL (z QR letáku přes /start passthrough) -> atribuce leadu ke konkrétnímu zdroji.
  // Navíc Google gclid/gbraid/wbraid (auto-tagging reklam): otagujeme lead jako google-ads,
  // ať poznáme leady z Google Ads i bez cookie-souhlasu (Consent Mode gclid nespadne do
  // konverzí Ads). gclid uložíme do utm_campaign (jen když vlastní utm_campaign chybí) —
  // drží se v leads.meta pro pozdější offline import konverzí do Google Ads.
  // POZOR: tenhle parser je zdvojený s analytics.js (window.MBAttr) schválně —
  // každý ze skriptů musí fungovat i sám o sobě. Když se mění pole tady, měň je
  // i tam a v edge funkci lead-capture, jinak se nové pole tiše zahodí.
  function utmFromUrl() {
    try {
      var p = new URLSearchParams(location.search), out = {};
      // utm_term = klíčové slovo z Google search ({keyword}), utm_id = id kampaně
      // z platformy — bez nich nejde spárovat lead s konkrétním dotazem ani s náklady.
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id'].forEach(function (k) {
        var v = (p.get(k) || '').trim().slice(0, 60);
        if (v) out[k] = v;
      });
      // CELY gclid do vlastniho pole (max 200 zn., realny gclid ma ~70-100). NEdorezavat na 54!
      var gcl = (p.get('gclid') || p.get('gbraid') || p.get('wbraid') || '').trim().slice(0, 200);
      if (gcl) {
        out.gclid = gcl;
        if (!out.utm_source) out.utm_source = 'google-ads';
        if (!out.utm_medium) out.utm_medium = 'cpc';
      }
      // Meta click id (fbclid) — at jde lead z FB reklam sparovat i bez cookie souhlasu
      var fbc = (p.get('fbclid') || '').trim().slice(0, 200);
      if (fbc) {
        out.fbclid = fbc;
        if (!out.utm_source) out.utm_source = 'facebook';
        if (!out.utm_medium) out.utm_medium = 'cpc';
      }
      return out;
    } catch (e) { return {}; }
  }

  // Atribuce k odeslani = parametry z TETO url + to, co si navstevnik prinesl
  // z predchozi stranky (analytics.js si reklamni parametry uklada do sessionStorage).
  // Bez toho prisel o atribuci kazdy, kdo z reklamy dorazil na clanek nebo na
  // homepage a formular vyplnil az o stranku dal — v DB pak vypadal jako organicky.
  // Aktualni URL ma prednost: novy proklik z reklamy prebije starsi zaznam.
  function utmParams() {
    var live = utmFromUrl();
    var stored = {};
    try { if (window.MBAttr) stored = window.MBAttr.get() || {}; } catch (e) {}
    for (var k in stored) {
      if (stored.hasOwnProperty(k) && !live.hasOwnProperty(k)) live[k] = stored[k];
    }
    return live;
  }

  // API pro stranky s vlastnim odesilanim (napr. /kviz/): window.MBLead.utm()
  window.MBLead = window.MBLead || {};
  window.MBLead.utm = utmParams;

  // [24. 9. 2026, příprava na ČT1 1. 10.] Odeslání má TŘI výsledky a chyba není úspěch:
  //   'ok'        = lead uložen, nebo e-mail už v seznamu byl (lead-capture vrací duplicate),
  //   'odmitnuto' = server odmítl e-mail (invalid_email), opakovat nemá smysl,
  //   'chyba'     = 5xx, 504 z brány Supabase (přijde za 5,0 až 5,8 s), výpadek sítě, timeout.
  // Chyba se JEDNOU zopakuje. Opakování je bezpečné: `leads` má unikátní lower(email),
  // druhý pokus po uloženém prvním vrátí duplicate a uvítací mail se podruhé nespustí
  // (lead-capture ho pouští jen u nového leadu). Dřív síťová chyba i 6s pojistka ukázaly
  // „Díky“ a stažení PDF, i když se nic neuložilo, takže lead zmizel bez stopy.
  var POKUS_MS = 8000, PAUZA_MS = 1500;
  function poslatJednou(data) {
    return new Promise(function (resolve) {
      var ctrl = window.AbortController ? new AbortController() : null;
      var hotovo = false, t = null;
      function konec(v) { if (hotovo) return; hotovo = true; clearTimeout(t); resolve(v); }
      t = setTimeout(function () { if (ctrl) ctrl.abort(); konec({ stav: 'chyba' }); }, POKUS_MS);
      fetch(FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ANON, 'apikey': ANON },
        body: JSON.stringify(data),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (r) {
        return r.json().catch(function () { return null; }).then(function (res) {
          if (r.ok && res && res.ok) konec({ stav: 'ok', dup: !!res.duplicate });
          else if (res && res.error === 'invalid_email') konec({ stav: 'odmitnuto' });
          else konec({ stav: 'chyba' });
        });
      }).catch(function () { konec({ stav: 'chyba' }); });
    });
  }
  function poslatSOpakovanim(data, priOpakovani) {
    return poslatJednou(data).then(function (v) {
      if (v.stav !== 'chyba') return v;
      if (priOpakovani) priOpakovani();
      return new Promise(function (r) { setTimeout(r, PAUZA_MS); })
        .then(function () { return poslatJednou(data); })
        .then(function (v2) { v2.poOpakovani = true; return v2; });
    });
  }

  ready(function () {
    var forms = document.querySelectorAll('form[data-lead-form]');
    Array.prototype.forEach.call(forms, function (form) {
      var seg = form.getAttribute('data-segment') || 'other';
      var src = form.getAttribute('data-source') || 'lead_magnet';
      var pdf = form.getAttribute('data-pdf') || '';
      var noun = form.getAttribute('data-noun') || 'Plán';
      var upsell = form.getAttribute('data-upsell') || 'Chceš se v tom naučit chodit sám/sama? Mrkni na <a href="/videokurz" style="color:#F6CD63;text-decoration:underline;">videokurz výživy</a>.';
      var msg = form.querySelector('[data-msg]');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var btn = form.querySelector('button[type=submit]');
        var email = (form.email && form.email.value || '').trim();
        if (!email) return;
        var data = {
          name: (form.name && form.name.value || '').trim(),
          email: email,
          phone: (form.phone && form.phone.value || '').trim(),
          age: (form.age && form.age.value || ''),
          goal: (form.goal && form.goal.value || ''),
          website: (form.website && form.website.value || ''),
          segment: seg, source: src
        };
        // Vse, co utmParams() nasbira (utm_source/medium/campaign/content, gclid, fbclid),
        // posli rovnou dal — vypis po polich se driv rozesel a zahazoval utm_content i fbclid.
        Object.assign(data, utmParams());
        var orig = btn.textContent; btn.disabled = true; btn.textContent = 'Odesílám…';
        if (msg) { msg.textContent = ''; }

        var done = false;
        function track() {
          try {
            if (window.mbTrackLead) window.mbTrackLead('lead_magnet', { segment: seg, lead_source: src });
            else { if (window.fbq) fbq('track', 'Lead', { content_name: 'Lead magnet' }); if (window.gtag) gtag('event', 'generate_lead', { method: 'lead_magnet' }); }
          } catch (e) {}
        }
        function showSuccess(dup, nejiste) {
          if (done) return; done = true; track();
          var dl = pdf ? '<a class="btn" href="' + pdf + '" target="_blank" rel="noopener" style="margin-top:12px;display:inline-block">Stáhnout (PDF) →</a>' : '';
          // dup = e-mail už v seznamu je → uvítací mail se znovu neposílá, tak to řekneme na rovinu.
          // nejiste = „už v seznamu“ přišlo až z DRUHÉHO pokusu: nejspíš ho uložil první pokus,
          // jehož odpověď se ztratila, a uvítací mail pak běží. Nevíme, tak nic neslibujeme ani nerušíme.
          if (nejiste) dup = false;
          var info = nejiste
            ? 'Máš to uložené. ' + (pdf ? noun + ' si stáhni rovnou tady:' : '')
            : dup
            ? 'Tenhle e-mail už v seznamu mám, mail ti znovu posílat nebudu. ' + (pdf ? noun + ' si stáhni rovnou tady:' : '')
            : noun + ' ti posíláme na e-mail. ' + (pdf ? 'Nebo si ho stáhni rovnou:' : '');
          form.innerHTML =
            '<div style="text-align:center;padding:14px 6px;">' +
              '<div style="font-size:2.4rem;line-height:1">✅</div>' +
              '<h3 style="color:#fff;margin:.5rem 0 .3rem;">' + (dup ? 'Vítej zpátky' : 'Díky') + (data.name ? ', ' + escName(vokativ(data.name)) : '') + '!</h3>' +
              '<p style="color:#cabfb4;margin:.2rem 0;">' + info + '</p>' +
              dl +
              '<p style="margin:18px 0 0;font-size:.84rem;color:#8a8073;">' + upsell + '</p>' +
            '</div>';
        }
        function showError(text) {
          if (done) return; done = true;
          btn.disabled = false; btn.textContent = orig;
          if (msg) { msg.style.color = '#F6CD63'; msg.textContent = text; }
        }

        // Nejdéle 8 s + 1,5 s + 8 s. Formulář zůstává vyplněný, takže „zkusit znovu“ je jeden klik.
        poslatSOpakovanim(data, function () { btn.textContent = 'Ještě chvilku…'; })
          .then(function (v) {
            if (v.stav === 'ok') showSuccess(v.dup, v.poOpakovani && v.dup);
            else if (v.stav === 'odmitnuto') showError('Zkontroluj prosím e-mail.');
            else showError('Teď se to nepovedlo odeslat. Zkus to prosím znovu, nebo napiš na martin@martinbarna.cz.');
          });
      });
    });
  });
})();
