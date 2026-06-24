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

  // Meta (Facebook) Pixel — načte se a odpálí AŽ po souhlasu (kvůli GDPR).
  var PIXEL_ID = '277526073774099';
  function loadMetaPixel() {
    if (window.fbq) return;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  // ===== Konverzní eventy (Meta Pixel + GA4) — aby se reklamy učily a retargetovaly =====
  function onReady(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  // Unikátní eventID pro deduplikaci s budoucím serverovým CAPI.
  function rnd() { return new Date().getTime().toString(36) + Math.random().toString(36).slice(2, 10); }
  function evId(prefix) { return prefix + '-' + rnd(); }
  // Purchase: spočítej JEN JEDNOU (ochrana proti dvojímu započtení při obnovení/návratu
  // na děkovací stránku). Klíč = ID objednávky z URL (pokud ho SimpleShop přidá), jinak
  // jednou za relaci prohlížeče. Memoizováno na window, ať FB i GA dostanou stejný výsledek.
  function purchaseInfo() {
    if (window.__mbPurchase) return window.__mbPurchase;
    var qs; try { qs = new URLSearchParams(location.search); } catch (e) { qs = null; }
    var oid = qs && (qs.get('order') || qs.get('orderId') || qs.get('id'));
    var fired = false;
    try {
      if (oid) { fired = !!localStorage.getItem('mb_p_' + oid); if (!fired) localStorage.setItem('mb_p_' + oid, '1'); }
      else { fired = !!sessionStorage.getItem('mb_p'); if (!fired) sessionStorage.setItem('mb_p', '1'); }
    } catch (e) {}
    var info = { ok: !fired, id: 'purchase-' + (oid || rnd()) };
    window.__mbPurchase = info;
    window.__mbPurchaseEventId = info.id; // ať si ho server pro CAPI může vyzvednout
    return info;
  }
  // Která konverze patří k aktuální stránce
  function pageConv() {
    var p = location.pathname;
    if (/dekuji-videokurz/.test(p)) return { kind: 'purchase', name: 'Videokurz výživy', id: 'videokurz', value: 800 };
    if (/videokurz/.test(p))        return { kind: 'view',     name: 'Videokurz výživy', id: 'videokurz', value: 800 };
    return null;
  }
  function fireConvFB() {
    var c = pageConv(); if (!c || !window.fbq) return;
    var params = { content_name: c.name, content_type: 'product', content_ids: [c.id], value: c.value, currency: 'CZK' };
    if (c.kind === 'purchase') { var pi = purchaseInfo(); if (!pi.ok) return; params.num_items = 1; fbq('track', 'Purchase', params, { eventID: pi.id }); }
    else fbq('track', 'ViewContent', params, { eventID: evId('view') });
  }
  function fireConvGA() {
    var c = pageConv(); if (!c || !window.gtag) return;
    if (c.kind === 'purchase') { var pi = purchaseInfo(); if (!pi.ok) return; gtag('event', 'purchase', { transaction_id: pi.id, value: c.value, currency: 'CZK', items: [{ item_id: c.id, item_name: c.name, price: c.value }] }); }
    else gtag('event', 'view_item', { value: c.value, currency: 'CZK', items: [{ item_id: c.id, item_name: c.name, price: c.value }] });
  }
  function loadMetaPixelAndConvert() { loadMetaPixel(); fireConvFB(); }
  function wireConversions() {
    // Klik na nákup (SimpleShop) → InitiateCheckout / begin_checkout
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href*="simpleshop.cz"]') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      var isKurz = href.indexOf('3Vbl') !== -1;
      var val = isKurz ? 800 : (href.indexOf('qG2yO') !== -1 ? 1990 : 0);
      var id = isKurz ? 'videokurz' : 'konzultace';
      var name = isKurz ? 'Videokurz výživy' : 'Konzultace';
      if (window.fbq) fbq('track', 'InitiateCheckout', { content_name: name, content_type: 'product', content_ids: [id], value: val, currency: 'CZK' }, { eventID: evId('checkout') });
      if (window.gtag) gtag('event', 'begin_checkout', { value: val, currency: 'CZK', items: [{ item_id: id, item_name: name, price: val }] });
    }, true);
    // Odeslání kontaktního formuláře → Lead
    var kf = document.getElementById('kontaktForm');
    if (kf) kf.addEventListener('submit', function () { if (window.fbq) fbq('track', 'Lead', {}, { eventID: evId('lead') }); if (window.gtag) gtag('event', 'generate_lead'); });
  }
  onReady(function () { wireConversions(); fireConvGA(); });

  var saved;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved === 'granted') { applyConsent(true); loadMetaPixelAndConvert(); return; }
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
      '<div style="color:#444">Používáme cookies pro statistiku návštěvnosti (Google Analytics) a měření reklam (Meta Pixel), abychom web i reklamy vylepšovali. Spustí se až s tvým souhlasem.</div>' +
      '<div style="display:flex;gap:8px;margin-top:12px">' +
        '<button id="mb-c-ok" style="flex:1;border:none;cursor:pointer;background:#ff7a00;color:#161616;font-weight:700;padding:10px 12px;border-radius:50px">Přijmout</button>' +
        '<button id="mb-c-no" style="flex:1;border:1.5px solid #ddd;cursor:pointer;background:#fff;color:#161616;font-weight:700;padding:10px 12px;border-radius:50px">Odmítnout</button>' +
      '</div>';
    document.body.appendChild(box);
    document.getElementById('mb-c-ok').onclick = function () {
      try { localStorage.setItem(KEY, 'granted'); } catch (e) {}
      applyConsent(true); loadMetaPixelAndConvert(); box.remove();
    };
    document.getElementById('mb-c-no').onclick = function () {
      try { localStorage.setItem(KEY, 'denied'); } catch (e) {}
      applyConsent(false); box.remove();
    };
  }
  if (document.body) showBanner();
  else document.addEventListener('DOMContentLoaded', showBanner);
})();
