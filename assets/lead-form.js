/* Vlastní lead-magnet formulář → Supabase edge funkce 'lead-capture' (nahrazuje Tally).
   Anon klíč je veřejný (Supabase design). Po odeslání: uloží lead, odpálí Meta Lead + GA4
   generate_lead a ukáže poděkování s přímým stažením plánu. Drip e-maily řeší Resend.
   DŮLEŽITÉ: potvrzení + stažení PDF je oddělené od odeslání mailu — návštěvník vždy dostane
   plán na obrazovku, i kdyby drip/Resend zaváhal (lead se ukládá hned, mail řeší pozadí). */
(function () {
  var SUPA = 'https://uhmrpfsdcujbhbtumqye.supabase.co';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVobXJwZnNkY3VqYmhidHVtcXllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MDA5ODgsImV4cCI6MjA5Nzk3Njk4OH0.6d7mDJtzPvdXxvFQEd6xL9n1ph6PYTrJiyDYOjlYYts';
  var FN = SUPA + '/functions/v1/lead-capture';

  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  // UTM z URL (z QR letáku přes /start passthrough) -> atribuce leadu ke konkrétnímu zdroji.
  // Navíc Google gclid/gbraid/wbraid (auto-tagging reklam): otagujeme lead jako google-ads,
  // ať poznáme leady z Google Ads i bez cookie-souhlasu (Consent Mode gclid nespadne do
  // konverzí Ads). gclid uložíme do utm_campaign (jen když vlastní utm_campaign chybí) —
  // drží se v leads.meta pro pozdější offline import konverzí do Google Ads.
  function utmParams() {
    try {
      var p = new URLSearchParams(location.search), out = {};
      ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) {
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
      return out;
    } catch (e) { return {}; }
  }

  ready(function () {
    var forms = document.querySelectorAll('form[data-lead-form]');
    Array.prototype.forEach.call(forms, function (form) {
      var seg = form.getAttribute('data-segment') || 'other';
      var src = form.getAttribute('data-source') || 'lead_magnet';
      var pdf = form.getAttribute('data-pdf') || '';
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
        var utm = utmParams();
        if (utm.utm_source) data.utm_source = utm.utm_source;
        if (utm.utm_medium) data.utm_medium = utm.utm_medium;
        if (utm.utm_campaign) data.utm_campaign = utm.utm_campaign;
        if (utm.gclid) data.gclid = utm.gclid;
        var orig = btn.textContent; btn.disabled = true; btn.textContent = 'Odesílám…';
        if (msg) { msg.textContent = ''; }

        var done = false, timer = null;
        function track() {
          try {
            if (window.mbTrackLead) window.mbTrackLead('lead_magnet', { segment: seg, lead_source: src });
            else { if (window.fbq) fbq('track', 'Lead', { content_name: 'Lead magnet' }); if (window.gtag) gtag('event', 'generate_lead', { method: 'lead_magnet' }); }
          } catch (e) {}
        }
        function showSuccess(dup) {
          if (done) return; done = true; if (timer) clearTimeout(timer); track();
          var dl = pdf ? '<a class="btn" href="' + pdf + '" target="_blank" rel="noopener" style="margin-top:12px;display:inline-block">Stáhnout plán (PDF) →</a>' : '';
          // dup = e-mail už v seznamu je → uvítací mail se znovu neposílá, tak to řekneme na rovinu
          var info = dup
            ? 'Tenhle e-mail už v seznamu mám — mail ti znovu posílat nebudu. ' + (pdf ? 'Plán si stáhni rovnou tady:' : '')
            : 'Plán ti posíláme na e-mail. ' + (pdf ? 'Nebo si ho stáhni rovnou:' : '');
          form.innerHTML =
            '<div style="text-align:center;padding:14px 6px;">' +
              '<div style="font-size:2.4rem;line-height:1">✅</div>' +
              '<h3 style="color:#fff;margin:.5rem 0 .3rem;">' + (dup ? 'Vítej zpátky' : 'Díky') + (data.name ? ', ' + data.name : '') + '!</h3>' +
              '<p style="color:#cabfb4;margin:.2rem 0;">' + info + '</p>' +
              dl +
              '<p style="margin:18px 0 0;font-size:.84rem;color:#8a8073;">Chceš se v tom naučit chodit sám/sama? Mrkni na <a href="/videokurz" style="color:#F6CD63;text-decoration:underline;">videokurz výživy</a>.</p>' +
            '</div>';
        }
        function showError(text) {
          if (done) return; done = true; if (timer) clearTimeout(timer);
          btn.disabled = false; btn.textContent = orig;
          if (msg) { msg.style.color = '#F6CD63'; msg.textContent = text; }
        }

        // Bezpečnostní síť: lead se ukládá hned a uvítací mail řeší pozadí, takže pokud
        // by odpověď nedorazila do 6 s (pomalá funkce apod.), ukážeme plán i tak —
        // ať návštěvník nikdy nezůstane u prázdného formuláře.
        timer = setTimeout(showSuccess, 6000);

        fetch(FN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ANON, 'apikey': ANON },
          body: JSON.stringify(data)
        }).then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
          .then(function (res) {
            if (res && res.ok) showSuccess(!!res.duplicate);
            else if (res && res.error === 'invalid_email') showError('Zkontroluj prosím e-mail.');
            else showError('Něco se nepovedlo, zkus to prosím znovu nebo napiš na martin@martinbarna.cz.');
          })
          .catch(function () {
            // tvrdé selhání sítě — radši dej plán než mrtvý formulář (lead se mohl uložit)
            showSuccess();
          });
      });
    });
  });
})();
