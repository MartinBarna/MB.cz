/* Martin Barna — GA4 (G-C3JC8G3FS0) s Google Consent Mode v2 + jednoduchá cookie lišta.
   Měření je defaultně VYPNuté (analytics_storage: denied) a zapne se až po souhlasu.
   Sdílený soubor — odkazuje se z každé stránky jedním <script defer src="/assets/analytics.js">. */
(function () {
  var GA_ID = 'G-C3JC8G3FS0';
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
    // Lišta žádá souhlas se statistikou I měřením reklam najednou — po „Přijmout"
    // povolujeme i ad_* signály (Google Ads konverze + remarketing), jinak zůstává vše denied.
    var v = granted ? 'granted' : 'denied';
    gtag('consent', 'update', {
      analytics_storage: v,
      ad_storage: v,
      ad_user_data: v,
      ad_personalization: v
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
  // Která konverze patří k aktuální stránce.
  // DŮLEŽITÉ: Purchase se měří VÝHRADNĚ SERVEROVĚ přes Meta CAPI + GA4 MP
  // (SimpleShop produkt 42679 → webhook → Cloudflare Worker „ss-capi", dedup přes
  // event_id = číslo objednávky). Klientský Purchase tady ZÁMĚRNĚ NEEXISTUJE — jinak
  // by se nákup dubloval a rozbil dedup s CAPI. Děkovací stránky (/dekuji-*) neměří nic.
  // Kdyby kdy přibyl client-side Purchase, MUSÍ mít eventID = pouze order_number.
  function pageConv() {
    var p = location.pathname;
    if (/dekuji/.test(p))    return null; // Purchase řeší výhradně server-side CAPI
    if (/^\/videokurz/.test(p)) return { kind: 'view', name: 'Videokurz výživy', id: 'videokurz', value: 800 };
    if (/^\/akademie\/(objednavka\/?)?(index\.html)?$/.test(p)) return { kind: 'view', name: 'Barna Academy', id: 'academy', value: 8900 };
    return null;
  }
  function fireConvFB() {
    var c = pageConv(); if (!c || !window.fbq) return;
    // Pouze ViewContent (horní trychtýř) — žádný client-side Purchase.
    fbq('track', 'ViewContent', { content_name: c.name, content_type: 'product', content_ids: [c.id], value: c.value, currency: 'CZK' }, { eventID: evId('view') });
  }
  function fireConvGA() {
    var c = pageConv(); if (!c || !window.gtag) return;
    // Pouze view_item — purchase posílá do GA4 server-side (Measurement Protocol).
    gtag('event', 'view_item', { value: c.value, currency: 'CZK', items: [{ item_id: c.id, item_name: c.name, price: c.value }] });
  }
  function loadMetaPixelAndConvert() { loadMetaPixel(); fireConvFB(); }
  // Veřejný helper, ať i appka (registrace magic-link, čekací listina Academy) hlásí Lead
  // konzistentně do Meta i GA4. Když návštěvník odmítl cookies, fbq neexistuje → do Meta nic,
  // GA4 v consent mode pošle cookieless ping. To je správné GDPR chování.
  function trackLead(method, extra) {
    var props = extra || {};
    var fbProps = { content_name: method || 'lead' };
    var gaProps = { method: method || 'lead' };
    for (var k in props) { if (props.hasOwnProperty(k)) { fbProps[k] = props[k]; gaProps[k] = props[k]; } }
    if (window.fbq)  fbq('track', 'Lead', fbProps, { eventID: evId('lead') });
    if (window.gtag) gtag('event', 'generate_lead', gaProps);
  }
  window.mbTrackLead = trackLead;
  function wireConversions() {
    // Klik na nákup (SimpleShop) → InitiateCheckout / begin_checkout
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href*="simpleshop.cz"]') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      var c = href.indexOf('3Vbl') !== -1  ? { id: 'videokurz',  name: 'Videokurz výživy', val: 800 }
            : href.indexOf('Xgl8g') !== -1 ? { id: 'academy',    name: 'Barna Academy',    val: 8900 }
            : href.indexOf('qG2yO') !== -1 ? { id: 'konzultace', name: 'Konzultace',       val: 1990 }
            :                                { id: 'simpleshop-other', name: 'SimpleShop', val: 0 };
      if (window.fbq) fbq('track', 'InitiateCheckout', { content_name: c.name, content_type: 'product', content_ids: [c.id], value: c.val, currency: 'CZK' }, { eventID: evId('checkout') });
      if (window.gtag) gtag('event', 'begin_checkout', { value: c.val, currency: 'CZK', items: [{ item_id: c.id, item_name: c.name, price: c.val }] });
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
      'background:linear-gradient(180deg,#16130f,#100d0a);color:#ece4d9;border:1px solid rgba(255,255,255,.1);border-radius:16px;' +
      '-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);' +
      'box-shadow:0 18px 50px rgba(0,0,0,.55);padding:18px 18px 16px;font-family:Poppins,Arial,sans-serif;' +
      'font-size:.92rem;line-height:1.5;';
    box.innerHTML =
      '<div style="font-weight:700;margin-bottom:.3rem;color:#fff">🍪 Cookies</div>' +
      '<div style="color:#f3ece2">Používáme cookies pro statistiku návštěvnosti (Google Analytics) a měření reklam (Meta Pixel), abychom web i reklamy vylepšovali. Spustí se až s tvým souhlasem.</div>' +
      '<div style="display:flex;gap:8px;margin-top:12px">' +
        '<button id="mb-c-ok" style="flex:1;border:none;cursor:pointer;background:linear-gradient(145deg,#ff9d3c,#ff7a00);color:#160d04;font-weight:700;padding:10px 12px;border-radius:50px">Přijmout</button>' +
        '<button id="mb-c-no" style="flex:1;border:1.5px solid rgba(255,255,255,.22);cursor:pointer;background:transparent;color:#ece4d9;font-weight:700;padding:10px 12px;border-radius:50px">Odmítnout</button>' +
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

/* ===== WhatsApp na počítači → QR popup =====================================
   Problém: klik na wa.me na PC je k ničemu (otevře přihlášení do WhatsApp Webu).
   Řešení: na desktopu klik na jakýkoli WhatsApp odkaz NEnaviguje, ale ukáže QR
   (naskenuješ mobilem → otevře se chat s předvyplněnou zprávou). Na mobilu se
   odkaz chová normálně (otevře appku se zprávou) — tam QR netřeba. */
(function () {
  var PHONE = '420603229831';
  function isDesktop() {
    var coarse = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
    var mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent || '');
    return !coarse && !mobileUA;
  }
  function textOf(href) { try { return new URL(href, location.href).searchParams.get('text') || ''; } catch (e) { return ''; } }
  function qrFileFor(href) {
    var t = textOf(href);
    if (/Academy/i.test(t)) return '/assets/qr/wa-academy.svg';
    if (/osobn|tr[ée]nink/i.test(t)) return '/assets/qr/wa-trenink.svg';
    if (/kou[cč]ink/i.test(t)) return '/assets/qr/wa-koucink.svg';
    return '/assets/qr/wa-chat.svg';
  }
  function webHref(href) {
    var t = textOf(href);
    return 'https://web.whatsapp.com/send?phone=' + PHONE + (t ? '&text=' + encodeURIComponent(t) : '');
  }
  var openEl = null;
  function onKey(e) { if (e.key === 'Escape' || e.keyCode === 27) closeQR(); }
  function closeQR() { if (openEl) { openEl.remove(); openEl = null; document.removeEventListener('keydown', onKey); } }
  function openQR(href) {
    closeQR();
    var wrap = document.createElement('div');
    wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'WhatsApp QR kód');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:4000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px;font-family:Poppins,Arial,sans-serif;';
    wrap.innerHTML =
      '<div style="background:#fff;color:#161616;border-radius:18px;max-width:340px;width:100%;padding:24px 22px 20px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.35);position:relative;">' +
        '<button type="button" aria-label="Zavřít" data-x style="position:absolute;top:8px;right:12px;border:none;background:transparent;font-size:1.6rem;line-height:1;cursor:pointer;color:#9a948c;">×</button>' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:9px;font-weight:800;font-size:1.08rem;margin-bottom:.3rem;"><span style="width:13px;height:13px;border-radius:50%;background:#ff7a00;display:inline-block;"></span>WhatsApp</div>' +
        '<p style="margin:.2rem 0 1rem;color:#5a5045;font-size:.9rem;line-height:1.45;">Naskenuj QR kód mobilem — otevře se ti chat se mnou i s předvyplněnou zprávou. Nebo napiš na <b>+420&nbsp;603&nbsp;229&nbsp;831</b>.</p>' +
        '<img src="' + qrFileFor(href) + '" alt="WhatsApp QR kód" width="210" height="210" style="width:210px;height:210px;display:block;margin:0 auto;border:1px solid #eee;border-radius:10px;padding:8px;background:#fff;">' +
        '<a href="' + webHref(href) + '" target="_blank" rel="noopener" style="display:inline-block;margin-top:14px;background:#ff7a00;color:#fff;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:50px;font-size:.92rem;">Otevřít WhatsApp Web</a>' +
        '<div style="margin-top:10px;"><a href="' + href + '" target="_blank" rel="noopener" style="color:#9a948c;font-size:.82rem;">Mám appku v počítači → otevřít rovnou</a></div>' +
      '</div>';
    wrap.addEventListener('click', function (e) { if (e.target === wrap) closeQR(); });
    wrap.querySelector('[data-x]').addEventListener('click', closeQR);
    document.body.appendChild(wrap);
    document.addEventListener('keydown', onKey);
    openEl = wrap;
  }
  document.addEventListener('click', function (e) {
    if (!isDesktop()) return;
    if (document.getElementById('waModal')) return; // stránka má vlastní WhatsApp okénko (homepage)
    var a = e.target.closest ? e.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]') : null;
    if (!a) return;
    e.preventDefault();
    openQR(a.getAttribute('href') || ('https://wa.me/' + PHONE));
  }, false);
})();
