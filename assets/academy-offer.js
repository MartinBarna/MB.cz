/* Dynamická sleva (#36): vracející se, zaujatý, ale nekupující návštěvník prodejky Academy
   dostane po pár návštěvách časově omezenou nabídku se slevovým kódem. 100% klientské,
   bez backendu — stav v localStorage. Nabídka se ukáže jen když je ENABLED a je nastaven kód.

   ┌─ MARTIN: jak to zapnout ──────────────────────────────────────────────┐
   │ 1) Vytvoř v SimpleShopu reálný slevový kód na Academy (např. -10 %).   │
   │ 2) Níže nastav CODE = 'TVUJ_KOD' a PCT = skutečné %.                   │
   │ 3) Přepni ENABLED na true. Hotovo — banner se začne ukazovat.         │
   │ Náhled bez zapnutí: /akademie/?offer=test (vynutí zobrazení).          │
   └────────────────────────────────────────────────────────────────────────┘ */
(function () {
  'use strict';
  var CFG = {
    ENABLED: false,                 // ← přepni na true, až bude reálný kód
    CODE: 'AKADEMIE10',             // ← nahraď reálným SimpleShop kódem
    PCT: 10,                        // ← skutečné % slevy
    VALID_HOURS: 48,                // jak dlouho nabídka platí (od prvního zobrazení)
    MIN_VISITS: 3,                  // od kolikáté návštěvy prodejky nabídnout
    MIN_DAYS: 1,                    // a zároveň aspoň N dní od první návštěvy
    BUY_URL: '/akademie/objednavka/'
  };
  var K = 'ba_aca_offer';
  var FORCE = /[?&]offer=test/.test(location.search);
  var HOUR = 3600 * 1000;

  function load() { try { return JSON.parse(localStorage.getItem(K) || 'null'); } catch (e) { return null; } }
  function save(s) { try { localStorage.setItem(K, JSON.stringify(s)); } catch (e) {} }

  var now = Date.now();
  var st = load();
  if (!st) { st = { first: now, last: now, n: 1, dismissed: false, offerStart: null }; }
  else {
    if (now - (st.last || 0) > 6 * HOUR) st.n = (st.n || 0) + 1;  // další návštěva max 1× za 6 h
    st.last = now;
  }
  save(st);

  function eligible() {
    if (FORCE) return true;
    if (!CFG.ENABLED || !CFG.CODE) return false;
    if (st.dismissed) return false;
    if ((st.n || 0) < CFG.MIN_VISITS) return false;
    if (now - (st.first || now) < CFG.MIN_DAYS * 24 * HOUR) return false;
    if (!st.offerStart) { st.offerStart = now; save(st); }
    return (now - st.offerStart) < CFG.VALID_HOURS * HOUR;
  }
  if (!eligible()) return;

  var deadline = FORCE ? now + CFG.VALID_HOURS * HOUR : st.offerStart + CFG.VALID_HOURS * HOUR;

  function el(tag, css, html) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; return e; }

  var bar = el('div', 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:linear-gradient(145deg,#1c1a17,#0c0c0c);border-top:1px solid rgba(255,122,0,.5);box-shadow:0 -12px 34px rgba(0,0,0,.55);font-family:Poppins,Arial,sans-serif;transform:translateY(110%);transition:transform .45s cubic-bezier(.2,.7,.2,1)');
  bar.setAttribute('role', 'dialog'); bar.setAttribute('aria-label', 'Časově omezená nabídka Academy');
  bar.innerHTML =
    '<div style="max-width:1000px;margin:0 auto;padding:14px 18px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">' +
      '<div style="flex:1;min-width:230px;color:#f1ece6;font-size:.95rem;line-height:1.45;">' +
        '<b style="color:#fff;display:block;font-size:1.02rem;margin-bottom:2px;">🎁 Vidím, že se vracíš — a Academy ti dává smysl.</b>' +
        'Tady máš <b style="color:#ff9d3c;">−' + CFG.PCT + ' %</b> jen pro tebe. Kód <b style="color:#ff9d3c;letter-spacing:.04em;">' + CFG.CODE + '</b> vlož v objednávce. Platí ještě <b id="baOfferCd" style="color:#fff;">…</b>.' +
      '</div>' +
      '<a href="' + CFG.BUY_URL + '" style="background:linear-gradient(145deg,#ffb066,#ff7a00);color:#160d04;font-weight:800;padding:12px 22px;border-radius:50px;text-decoration:none;white-space:nowrap;font-size:.95rem;">Využít slevu →</a>' +
      '<button type="button" id="baOfferX" aria-label="Zavřít" style="background:rgba(255,255,255,.08);border:none;color:#cabfb4;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:1.1rem;line-height:1;flex-shrink:0;">×</button>' +
    '</div>';

  function mount() {
    document.body.appendChild(bar);
    requestAnimationFrame(function () { bar.style.transform = 'translateY(0)'; });
    document.getElementById('baOfferX').addEventListener('click', function () {
      bar.style.transform = 'translateY(110%)';
      if (!FORCE) { st.dismissed = true; save(st); }
      setTimeout(function () { if (bar.parentNode) bar.parentNode.removeChild(bar); }, 450);
    });
    tick();
  }
  function tick() {
    var cd = document.getElementById('baOfferCd'); if (!cd) return;
    var ms = deadline - Date.now();
    if (ms <= 0) { bar.style.transform = 'translateY(110%)'; return; }
    var h = Math.floor(ms / HOUR), m = Math.floor((ms % HOUR) / 60000), s = Math.floor((ms % 60000) / 1000);
    cd.textContent = (h > 0 ? h + ' h ' : '') + m + ' min ' + (h > 0 ? '' : s + ' s');
    setTimeout(tick, 1000);
  }
  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
