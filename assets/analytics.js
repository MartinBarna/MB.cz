/* Martin Barna — GA4 (G-P0GTB23JP9) s Google Consent Mode v2 + jednoduchá cookie lišta.
   Měření je defaultně VYPNuté (analytics_storage: denied) a zapne se až po souhlasu.
   Sdílený soubor — odkazuje se z každé stránky jedním <script defer src="/assets/analytics.js">. */
(function () {
  var GA_ID = 'G-P0GTB23JP9';
  var KEY = 'mb_consent_v1';

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());

  // Consent Mode v2 — vše defaultně zamítnuté, dokud návštěvník nesouhlasí
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500
  });
  gtag('config', GA_ID, { anonymize_ip: true });

  // načti gtag knihovnu (v consent mode posílá data bez cookies, dokud není souhlas)
  var g = document.createElement('script');
  g.async = true;
  g.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(g);

  function applyConsent(granted) {
    gtag('consent', 'update', {
      analytics_storage: granted ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
  }

  var saved;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved === 'granted') { applyConsent(true); return; }
  if (saved === 'denied') { applyConsent(false); return; }

  // --- cookie lišta (karta vlevo dole, ať nekoliduje s CTA lištou) ---
  function showBanner() {
    if (document.getElementById('mb-cookie')) return;
    var st = document.createElement('style');
    st.textContent = '@media(max-width:991px){#mb-cookie{left:12px!important;right:12px!important;bottom:92px!important;max-width:none!important}}';
    document.head.appendChild(st);
    var box = document.createElement('div');
    box.id = 'mb-cookie';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Souhlas s cookies');
    box.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:3000;max-width:360px;' +
      'background:#fff;color:#161616;border:1px solid #eee;border-radius:16px;' +
      'box-shadow:0 18px 50px rgba(0,0,0,.22);padding:18px 18px 16px;font-family:Poppins,Arial,sans-serif;' +
      'font-size:.92rem;line-height:1.5;';
    box.innerHTML =
      '<div style="font-weight:700;margin-bottom:.3rem">🍪 Cookies</div>' +
      '<div style="color:#444">Používáme anonymní statistiku návštěvnosti (Google Analytics), abychom web vylepšovali. Žádné reklamní sledování.</div>' +
      '<div style="display:flex;gap:8px;margin-top:12px">' +
        '<button id="mb-c-ok" style="flex:1;border:none;cursor:pointer;background:#ff7a00;color:#161616;font-weight:700;padding:10px 12px;border-radius:50px">Přijmout</button>' +
        '<button id="mb-c-no" style="flex:1;border:1.5px solid #ddd;cursor:pointer;background:#fff;color:#161616;font-weight:700;padding:10px 12px;border-radius:50px">Odmítnout</button>' +
      '</div>';
    document.body.appendChild(box);
    document.getElementById('mb-c-ok').onclick = function () {
      try { localStorage.setItem(KEY, 'granted'); } catch (e) {}
      applyConsent(true); box.remove();
    };
    document.getElementById('mb-c-no').onclick = function () {
      try { localStorage.setItem(KEY, 'denied'); } catch (e) {}
      applyConsent(false); box.remove();
    };
  }
  if (document.body) showBanner();
  else document.addEventListener('DOMContentLoaded', showBanner);
})();
