/* Vlastní lead-magnet formulář → Supabase edge funkce 'lead-capture' (nahrazuje Tally).
   Anon klíč je veřejný (Supabase design). Po odeslání: uloží lead, odpálí Meta Lead + GA4
   generate_lead a ukáže poděkování s přímým stažením plánu. Drip e-maily řeší Resend (až bude klíč). */
(function () {
  var SUPA = 'https://uhmrpfsdcujbhbtumqye.supabase.co';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVobXJwZnNkY3VqYmhidHVtcXllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MDA5ODgsImV4cCI6MjA5Nzk3Njk4OH0.6d7mDJtzPvdXxvFQEd6xL9n1ph6PYTrJiyDYOjlYYts';
  var FN = SUPA + '/functions/v1/lead-capture';

  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

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
          segment: seg, source: src
        };
        var orig = btn.textContent; btn.disabled = true; btn.textContent = 'Odesílám…';
        if (msg) { msg.textContent = ''; }
        fetch(FN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ANON, 'apikey': ANON },
          body: JSON.stringify(data)
        }).then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
          .then(function (res) {
            if (res && res.ok) {
              try {
                if (window.mbTrackLead) window.mbTrackLead('lead_magnet', { segment: seg, lead_source: src });
                else { if (window.fbq) fbq('track', 'Lead', { content_name: 'Lead magnet' }); if (window.gtag) gtag('event', 'generate_lead', { method: 'lead_magnet' }); }
              } catch (e) {}
              var dl = pdf ? '<a class="btn" href="' + pdf + '" target="_blank" rel="noopener" style="margin-top:12px;display:inline-block">Stáhnout plán (PDF) →</a>' : '';
              form.innerHTML =
                '<div style="text-align:center;padding:14px 6px;">' +
                  '<div style="font-size:2.4rem;line-height:1">✅</div>' +
                  '<h3 style="color:#fff;margin:.5rem 0 .3rem;">Díky' + (data.name ? ', ' + data.name : '') + '!</h3>' +
                  '<p style="color:#cabfb4;margin:.2rem 0;">Plán ti posíláme na e-mail. ' + (pdf ? 'Nebo si ho stáhni rovnou:' : '') + '</p>' +
                  dl +
                '</div>';
            } else {
              btn.disabled = false; btn.textContent = orig;
              if (msg) { msg.style.color = '#ff9d3c'; msg.textContent = (res && res.error === 'invalid_email') ? 'Zkontroluj prosím e-mail.' : 'Něco se nepovedlo, zkus to prosím znovu nebo napiš na martin@martinbarna.cz.'; }
            }
          }).catch(function () {
            btn.disabled = false; btn.textContent = orig;
            if (msg) { msg.style.color = '#ff9d3c'; msg.textContent = 'Spojení selhalo, zkus to prosím znovu.'; }
          });
      });
    });
  });
})();
