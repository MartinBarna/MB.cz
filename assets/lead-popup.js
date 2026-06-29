/* Lead-magnet pop-up — nenásilný modal s nabídkou 7denního plánu zdarma.
   Objeví se 1× za návštěvníka (localStorage), po čase / scrollu / exit-intentu.
   Výběr Ženy → /makro-plan/, Muži → /forma-zpet/.
   Self-exclusion: nezobrazí se na lead landing, checkoutu ani v členské sekci. */
(function () {
  try {
    var path = location.pathname.toLowerCase();
    // Kde NEukazovat (lead stránky, nákup, přihlášení, členská sekce, materiály)
    var BLOCK = ['/makro-plan', '/forma-zpet', '/akademie', '/materialy', '/videokurz-studium', '/prihlaseni', '/objednavka', '/dekuji', '/download'];
    for (var i = 0; i < BLOCK.length; i++) { if (path.indexOf(BLOCK[i]) === 0 || path.indexOf(BLOCK[i] + '/') !== -1) return; }

    var KEY = 'ba_leadpop_v1';
    function seen() { try { var v = +localStorage.getItem(KEY) || 0; return v && (Date.now() - v) < 14 * 864e5; } catch (e) { return false; } }
    function mark(days) { try { localStorage.setItem(KEY, String(Date.now() - (14 - (days || 14)) * 864e5)); } catch (e) {} }
    if (seen()) return;

    var shown = false;
    function ensureStyle() {
      if (document.getElementById('ba-lp-style')) return;
      var s = document.createElement('style'); s.id = 'ba-lp-style';
      s.textContent = [
        '.ba-lp-ov{position:fixed;inset:0;z-index:99999;background:rgba(8,6,4,.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px;opacity:0;transition:opacity .25s;font-family:"Poppins",Arial,sans-serif;}',
        '.ba-lp-ov.on{opacity:1;}',
        '.ba-lp{position:relative;width:100%;max-width:440px;background:linear-gradient(180deg,#1a130c,#100b07);border:1px solid #3a2c1c;border-radius:22px;padding:30px 26px 26px;box-shadow:0 30px 80px rgba(0,0,0,.6);transform:translateY(14px) scale(.98);transition:transform .28s;text-align:center;}',
        '.ba-lp-ov.on .ba-lp{transform:none;}',
        '.ba-lp::before{content:"";position:absolute;right:-40px;top:-50px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(255,122,0,.22),transparent 65%);pointer-events:none;}',
        '.ba-lp .x{position:absolute;top:12px;right:14px;background:none;border:none;color:#9b8e7d;font-size:1.5rem;line-height:1;cursor:pointer;padding:4px 8px;border-radius:8px;transition:.2s;}',
        '.ba-lp .x:hover{color:#fff;background:rgba(255,255,255,.06);}',
        '.ba-lp .kick{display:inline-block;background:rgba(255,122,0,.14);border:1px solid rgba(255,122,0,.4);color:#ffb066;font-weight:700;font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;padding:5px 13px;border-radius:50px;}',
        '.ba-lp h3{color:#fff;font-size:1.5rem;line-height:1.18;margin:14px 0 6px;letter-spacing:-.02em;}',
        '.ba-lp h3 b{color:#ff9d3c;}',
        '.ba-lp p{color:#cbbfae;font-size:.96rem;margin:0 0 18px;line-height:1.5;}',
        '.ba-lp .q{color:#fff;font-weight:700;font-size:.92rem;margin:0 0 12px;}',
        '.ba-lp-btns{display:grid;grid-template-columns:1fr 1fr;gap:12px;}',
        '.ba-lp-btns a{display:flex;flex-direction:column;align-items:center;gap:4px;text-decoration:none;padding:16px 10px;border-radius:15px;font-weight:800;font-size:1rem;border:1px solid #3a2c1c;background:rgba(255,255,255,.04);color:#fff;transition:transform .18s,border-color .18s,background .18s;}',
        '.ba-lp-btns a .ic{font-size:1.7rem;}',
        '.ba-lp-btns a small{font-weight:600;font-size:.74rem;color:#ffb066;}',
        '.ba-lp-btns a:hover{transform:translateY(-3px);border-color:rgba(255,122,0,.6);background:rgba(255,122,0,.1);}',
        '.ba-lp .later{margin-top:14px;background:none;border:none;color:#8a7e6d;font-size:.82rem;cursor:pointer;text-decoration:underline;font-family:inherit;}',
        '.ba-lp .later:hover{color:#cbbfae;}',
        '.ba-lp .trust{margin-top:12px;color:#857a69;font-size:.72rem;}',
        '@media(max-width:380px){.ba-lp-btns{grid-template-columns:1fr;}.ba-lp h3{font-size:1.3rem;}}'
      ].join('');
      document.head.appendChild(s);
    }

    function close(days) {
      mark(days);
      var ov = document.querySelector('.ba-lp-ov'); if (!ov) return;
      ov.classList.remove('on'); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 260);
    }

    function show() {
      if (shown || seen()) return; shown = true;
      ensureStyle();
      var ov = document.createElement('div'); ov.className = 'ba-lp-ov';
      ov.innerHTML =
        '<div class="ba-lp" role="dialog" aria-label="Jídelníček zdarma">' +
        '<button class="x" aria-label="Zavřít">×</button>' +
        '<span class="kick">Zdarma · bez závazku</span>' +
        '<h3>Stáhni si <b>7denní jídelníček</b> zdarma</h3>' +
        '<p>Jasné porce, běžné potraviny, žádné vážení. Pošlu ti ho na e-mail a pár tipů, co u klientů fungují nejvíc.</p>' +
        '<div class="q">Vyber si svoji verzi:</div>' +
        '<div class="ba-lp-btns">' +
        '<a href="/makro-plan/" data-seg="zeny"><span class="ic">🌸</span>Pro ženy<small>plán 30+ →</small></a>' +
        '<a href="/forma-zpet/" data-seg="muzi"><span class="ic">💪</span>Pro muže<small>forma zpět →</small></a>' +
        '</div>' +
        '<button class="later" type="button">Teď ne, díky</button>' +
        '<div class="trust">🔒 Žádný spam. Odhlásíš se kdykoliv.</div>' +
        '</div>';
      document.body.appendChild(ov);
      requestAnimationFrame(function () { ov.classList.add('on'); });
      ov.querySelector('.x').addEventListener('click', function () { close(7); });
      ov.querySelector('.later').addEventListener('click', function () { close(7); });
      ov.addEventListener('click', function (e) { if (e.target === ov) close(3); });
      // klik na výběr = konverze (delší pauza), pak nech proklik proběhnout
      Array.prototype.forEach.call(ov.querySelectorAll('.ba-lp-btns a'), function (a) {
        a.addEventListener('click', function () { mark(14); });
      });
      document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(7); document.removeEventListener('keydown', esc); } });
    }

    // Triggery: čas (18 s), scroll 45 %, exit-intent (desktop). Co dřív.
    var timer;
    function onScroll() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      if (h > 0 && window.scrollY / h > 0.45) { show(); cleanup(); }
    }
    function onExit(e) { if (e.clientY <= 0) { show(); cleanup(); } }
    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mouseout', onExit);
    }
    function armTriggers() {
      timer = setTimeout(show, 18000);
      window.addEventListener('scroll', onScroll, { passive: true });
      if (!('ontouchstart' in window)) document.addEventListener('mouseout', onExit);
    }

    // GDPR: cookie lišta (mb_consent_v1) má přednost. Lead pop-up (celoobrazovkový
    // overlay) nesmí zakrýt souhlas s cookies — počkáme, až ho návštěvník vyřeší.
    // Fail-safe: kdyby se analytics.js nenačetl, po 60 s pop-up nasadíme tak jako tak.
    function consentDecided() {
      try { var v = localStorage.getItem('mb_consent_v1'); return v === 'granted' || v === 'denied'; }
      catch (e) { return true; }
    }
    if (consentDecided()) {
      armTriggers();
    } else {
      var waited = 0;
      var iv = setInterval(function () {
        waited += 600;
        if (consentDecided() || waited >= 60000) { clearInterval(iv); armTriggers(); }
      }, 600);
    }
  } catch (e) { /* fail-safe: pop-up nikdy nesmí shodit stránku */ }
})();
