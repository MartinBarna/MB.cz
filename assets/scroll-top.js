/* Barna — sdílené plovoucí tlačítko "nahoru" (funguje na jakékoli stránce).
   Umístění: nad případnou spodní lištou (koupit) a POD WhatsApp tlačítkem,
   aby se nic nepřekrývalo. Pozice se počítá měřením, ne pevnými offsety. */
/* Okamžitá reakce dotyku na plovoucí/fixní tlačítka i během setrvačného scrollu.
   iOS jinak první ťuknutí „spotřebuje" jen na zastavení scrollu → reagujeme na touchend. */
(function () {
  var SEL = '.fab-wa, #baToTop, #toTop, .to-top, .cta-bar a, .vk-buybar a, .buybar a';
  var sx = 0, sy = 0, t0 = 0, moved = false, active = null;
  document.addEventListener('touchstart', function (e) {
    active = e.target.closest ? e.target.closest(SEL) : null;
    if (!active) return;
    var p = e.touches[0]; sx = p.clientX; sy = p.clientY; t0 = e.timeStamp; moved = false;
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (!active) return;
    var p = e.touches[0];
    if (Math.abs(p.clientX - sx) > 10 || Math.abs(p.clientY - sy) > 10) moved = true;
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    var t = active; active = null;
    if (!t || moved || (e.timeStamp - t0) > 700) return;
    if (e.cancelable) e.preventDefault(); // potlač synteticky klik, ať akce neproběhne dvakrát
    if (t.tagName === 'A') {
      var href = t.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#') { t.click(); return; }
      if (t.getAttribute('target') === '_blank') window.open(t.href, '_blank', 'noopener');
      else window.location.href = t.href;
    } else { t.click(); }
  }, { passive: false });
})();

(function () {
  if (document.getElementById('toTop') || document.getElementById('baToTop')) return; // stránka už nějaké má
  function ready(fn) { document.readyState !== 'loading' ? fn() : document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    var WA_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.748-.747zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/></svg>';
    function skipWa() {
      var p = (location.pathname || '/').replace(/\/+$/, '') || '/';
      return /^\/akademie\/(admin|studium|videokurz|moje|klient|nastroje|praxe|materialy)(\/|$)/.test(p);
    }
    function ensureWa() {
      var existing = document.querySelector('.fab-wa');
      if (existing) return existing;
      if (skipWa()) return null;
      var a = document.createElement('a');
      a.className = 'fab-wa mb-wa-js';
      a.href = 'https://wa.me/420603229831';
      a.target = '_blank';
      a.rel = 'noopener';
      a.setAttribute('aria-label', 'Napiš na WhatsApp');
      a.innerHTML = WA_SVG;
      document.body.appendChild(a);
      return a;
    }

    var css = '#baToTop{position:fixed;right:20px;bottom:20px;width:48px;height:48px;border-radius:50%;'
      + 'background:linear-gradient(145deg,#F6CD63,#EBB12C);color:#1A1222;border:none;cursor:pointer;'
      + 'display:flex;align-items:center;justify-content:center;font-size:1.45rem;font-weight:800;line-height:1;z-index:1090;'
      + 'box-shadow:0 10px 26px -6px rgba(235,177,44,.6);opacity:0;visibility:hidden;transform:translateY(10px);'
      + 'transition:opacity .25s,transform .25s,visibility .25s,bottom .25s,right .25s;-webkit-tap-highlight-color:transparent;}'
      + '#baToTop.show{opacity:1;visibility:visible;transform:translateY(0);}'
      + '@media(max-width:640px){#baToTop{display:none!important;}}' /* mobil: WhatsApp + AI Martin + lišta CTA už dole jsou, čtvrté tlačítko překrývalo text */
      + '#baToTop:hover{transform:translateY(-3px);box-shadow:0 16px 32px -6px rgba(235,177,44,.7);}'
      + '.fab-wa{position:fixed;right:20px;bottom:20px;border-radius:50%;background:#25D366;'
      + 'display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,.28);z-index:1050;'
      + 'color:#fff;text-decoration:none;transition:transform .2s,bottom .25s,right .25s;-webkit-tap-highlight-color:transparent;}'
      + '.fab-wa:hover{transform:scale(1.08);color:#fff;}'
      + '.fab-wa svg{display:block;}'
      + '.fab-wa.mb-wa-js{width:56px;height:56px;}'
      + '@media(max-width:600px){#baToTop{right:14px;bottom:16px;width:44px;height:44px;font-size:1.3rem;}'
      + '.fab-wa.mb-wa-js{width:52px;height:52px;}}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    var wa = ensureWa();
    var b = document.createElement('button');
    b.id = 'baToTop'; b.type = 'button'; b.setAttribute('aria-label', 'Nahoru'); b.innerHTML = '&#8593;';
    document.body.appendChild(b);

    // spodní lišta "koupit/konzultace" (jen na některých stránkách) — měříme její výšku, když je vidět.
    // Pozor: .mbar (koucing/materiály) se zobrazuje media query (display:flex), ne .show třídou,
    // tak měříme podle SKUTEČNÉ viditelnosti (computed style), ne podle přítomnosti třídy.
    function buyBarBottom() {
      var bars = document.querySelectorAll('.vk-buybar, .cta-bar, .mbar, .buybar');
      var max = 0;
      for (var i = 0; i < bars.length; i++) {
        var bar = bars[i], cs = window.getComputedStyle(bar);
        if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') === 0) continue;
        var h = bar.offsetHeight;
        if (h > 0 && h < window.innerHeight && h > max) max = h;
      }
      return max;
    }

    function pin(el, right, bottom) {
      if (!el) return;
      el.style.setProperty('right', right + 'px', 'important');
      el.style.setProperty('bottom', bottom + 'px', 'important');
    }

    function place() {
      var small = window.innerWidth <= 600;
      var side = small ? 14 : 20;
      var base = small ? 16 : 20;
      var gap = 12;
      var bh = buyBarBottom();
      var floor = bh ? bh + 14 : base;       // tlačítko vždy nad spodní lištou
      wa = document.querySelector('.fab-wa');

      // Obě vpravo dole, stejný right: WhatsApp dole, šipka NAD ním. Inline !important
      // přebije stránkové `.cta-bar ~ .fab-wa` / `.vk-buybar ~ .fab-wa`, které jinak
      // šipku a bublinu posadí na stejné místo.
      var waH = 56;
      if (wa) {
        var rect = wa.getBoundingClientRect();
        waH = (rect.height || wa.offsetHeight || 56);
        pin(wa, side, floor);
      }
      pin(b, side, wa ? floor + waH + gap : floor);
    }

    function smooth() {
      var de = document.documentElement, prev = de.style.scrollBehavior;
      de.style.scrollBehavior = 'auto';
      var start = window.pageYOffset || de.scrollTop, t0 = null, dur = 360;
      function step(ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min((ts - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
        window.scrollTo(0, Math.round(start * (1 - e)));
        if (p < 1) requestAnimationFrame(step); else de.style.scrollBehavior = prev;
      }
      requestAnimationFrame(step);
    }
    b.addEventListener('click', smooth);

    function onScroll() {
      var s = window.scrollY || document.documentElement.scrollTop;
      b.classList.toggle('show', s > 500);
      place();
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', place);
    place();
    onScroll();
  });
})();

/* Mobilni hamburger menu pro sdileny .nav/.navlinks (marketing stranky).
   Postavi vlastni dropdown z existujicich odkazu -> jednotne na vsech strankach,
   nezavisle na inline CSS. Na akademii / bootstrap navbaru se NEaktivuje (.navlinks chybi). */
(function () {
  function ready(fn){ document.readyState!=='loading'?fn():document.addEventListener('DOMContentLoaded',fn); }
  ready(function () {
    var nav = document.querySelector('.nav .navlinks');
    if (!nav) return;
    var bar = nav.closest('.nav'); if (!bar) return;
    if (bar.querySelector('.mb-burger')) return;
    var links = Array.prototype.slice.call(nav.querySelectorAll('a')).map(function (a) {
      return { t:(a.textContent||'').trim(), h:a.getAttribute('href')||'#', cta:a.classList.contains('cta') || a.classList.contains('nav-koupit') };
    }).filter(function (l) { return l.t; });
    if (!links.length) return;
    var css = ''
      + '.nav .mb-burger{display:inline-flex;flex-direction:column;background:none;border:none;cursor:pointer;padding:9px;margin-left:8px;line-height:0;-webkit-tap-highlight-color:transparent;}'
      + '.nav .mb-burger span{display:block;width:25px;height:2px;background:#EBB12C;margin:5px 0;border-radius:2px;transition:transform .25s,opacity .2s;}'
      + '.nav.mbopen .mb-burger span:nth-child(1){transform:translateY(12px) rotate(45deg);}'
      + '.nav.mbopen .mb-burger span:nth-child(2){opacity:0;}'
      + '.nav.mbopen .mb-burger span:nth-child(3){transform:translateY(-12px) rotate(-45deg);}'
      + '.nav .mb-drawer{display:none;position:absolute;top:100%;left:0;right:0;background:#181520;border-top:1px solid #262232;box-shadow:0 26px 54px -14px rgba(0,0,0,.65);z-index:1200;padding:6px 0 10px;}'
      + '.nav.mbopen .mb-drawer{display:block;}'
      + '.nav .mb-drawer a{display:block;padding:13px 22px;color:#F0EADF;text-decoration:none;font-weight:600;font-size:1.03rem;border-bottom:1px solid rgba(255,255,255,.05);}'
      + '.nav .mb-drawer a:hover{background:rgba(235,177,44,.08);color:#EBB12C;}'
      + '.nav .mb-drawer a.cta{color:#1A1222;background:#EBB12C;margin:10px 16px 4px;border-radius:50px;text-align:center;border-bottom:none;font-weight:700;}'
      + '@media (max-width:1319px){ .nav .navlinks{display:none!important;} .nav .nav-burger{display:none!important;} }'
      + '@media (min-width:1320px){ .nav .mb-drawer,.nav .mb-burger{display:none!important;} }'
      + '.nav .mb-theme-toggle{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;margin-left:auto;flex-shrink:0;border:1px solid rgba(240,234,223,.22);border-radius:10px;background:rgba(255,255,255,.08);color:#F0EADF;cursor:pointer;font:inherit;line-height:0;}'
      + '.nav .mb-theme-toggle:hover{border-color:rgba(235,177,44,.45);}'
      + '.nav .mb-theme-toggle svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}'
      + '.nav .mb-theme-toggle .mb-ico-sun{display:none;}'
      + '[data-theme="light"] .nav .mb-theme-toggle .mb-ico-sun{display:block;}'
      + '[data-theme="light"] .nav .mb-theme-toggle .mb-ico-moon{display:none;}'
      + '[data-theme="light"] .nav .mb-theme-toggle{border-color:rgba(22,19,16,.18);background:#fff;color:#161310;}'
      + '[data-theme="light"] .nav .mb-drawer{background:#F7F3EB;color:#161310;border-top-color:rgba(22,19,16,.12);box-shadow:0 26px 54px -14px rgba(22,19,16,.18);}'
      + '[data-theme="light"] .nav .mb-drawer a{color:#161310;border-bottom-color:rgba(22,19,16,.12);}'
      + '[data-theme="light"] .nav .mb-drawer a:hover{background:rgba(235,177,44,.10);color:#EBB12C;}'
      + '[data-theme="light"] .nav .mb-drawer a.cta{color:#1A1222;background:#EBB12C;}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    if (getComputedStyle(bar).position === 'static') bar.style.position = 'relative';
    var b = document.createElement('button');
    b.className='mb-burger'; b.type='button'; b.setAttribute('aria-label','Menu'); b.setAttribute('aria-expanded','false');
    b.innerHTML='<span></span><span></span><span></span>';
    var d = document.createElement('div'); d.className='mb-drawer';
    links.forEach(function (l) { var a=document.createElement('a'); a.href=l.h; a.textContent=l.t; if(l.cta)a.className='cta'; d.appendChild(a); });
    var wrap = bar.querySelector('.wrap') || bar;
    wrap.appendChild(b); bar.appendChild(d);
    b.addEventListener('click', function (e) { e.stopPropagation(); var open=bar.classList.toggle('mbopen'); b.setAttribute('aria-expanded', open?'true':'false'); });
    d.addEventListener('click', function (e) { if (e.target.tagName==='A') bar.classList.remove('mbopen'); });
    document.addEventListener('click', function (e) { if (!bar.contains(e.target)) bar.classList.remove('mbopen'); });
  });
})();

/* Světlý / tmavý režim. Klíč localStorage: mb-theme (stejný jako Academy).
   Tlačítko do .nav .wrap, .mainmenu hosta, .top .in, nebo fixed fallback.
   FOUC řeší assets/theme-boot.js v <head>. theme-color se přepíná tady. */
(function () {
  var KEY = 'mb-theme';
  var SVG =
    '<svg class="mb-ico-moon" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M21 14.3A8.5 8.5 0 0 1 9.7 3 7 7 0 1 0 21 14.3z"/>' +
    '</svg>' +
    '<svg class="mb-ico-sun" viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="4"/>' +
      '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>' +
    '</svg>';

  if (!document.getElementById('mb-theme-toggle-css')) {
    var st = document.createElement('style');
    st.id = 'mb-theme-toggle-css';
    st.textContent =
      '.mb-theme-toggle{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;margin-left:auto;flex-shrink:0;border:1px solid rgba(240,234,223,.22);border-radius:10px;background:rgba(255,255,255,.08);color:inherit;cursor:pointer;font:inherit;line-height:0;}' +
      '.mb-theme-toggle:hover{border-color:rgba(235,177,44,.45);}' +
      '.mb-theme-toggle svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}' +
      '.mb-theme-toggle .mb-ico-sun{display:none;}' +
      '[data-theme="light"] .mb-theme-toggle .mb-ico-sun{display:block;}' +
      '[data-theme="light"] .mb-theme-toggle .mb-ico-moon{display:none;}' +
      '[data-theme="light"] .mb-theme-toggle{border-color:rgba(22,19,16,.18);background:var(--mb-surface,#fff);color:var(--mb-text,#161310);}' +
      '@media print{.mb-theme-toggle{display:none!important;}}';
    document.head.appendChild(st);
  }

  function read() {
    try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; }
    catch (e) { return 'dark'; }
  }
  function save(theme) {
    try { localStorage.setItem(KEY, theme); } catch (e) {}
  }
  function applyChrome(theme) {
    try { document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark'; } catch (e) {}
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      if (!meta.getAttribute('data-theme-color-dark')) {
        meta.setAttribute('data-theme-color-dark', meta.getAttribute('content') || '#0C0B10');
      }
      meta.setAttribute('content', theme === 'light' ? '#F7F3EB' : meta.getAttribute('data-theme-color-dark'));
    }
    var cs = document.querySelector('meta[name="color-scheme"]');
    if (cs) cs.setAttribute('content', theme === 'light' ? 'light' : 'dark');
  }
  function apply(theme) {
    var root = document.documentElement;
    if (theme === 'light') root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');
    applyChrome(theme);
    var btns = document.querySelectorAll('.mb-theme-toggle');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
      btns[i].setAttribute('aria-label', theme === 'light' ? 'Zapnout tmavý režim' : 'Zapnout světlý režim');
      btns[i].title = theme === 'light' ? 'Tmavý režim' : 'Světlý režim';
    }
  }
  function makeBtn() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mb-theme-toggle';
    btn.innerHTML = SVG;
    btn.addEventListener('click', function () {
      var next = read() === 'light' ? 'dark' : 'light';
      save(next);
      apply(next);
    });
    return btn;
  }

  window.mountThemeToggle = function (wrap, burger) {
    if (document.querySelector('.mb-theme-toggle')) { apply(read()); return; }
    if (!wrap) wrap = document.querySelector('.nav .wrap');
    if (!wrap) return;
    var btn = makeBtn();
    if (burger && burger.parentNode === wrap) wrap.insertBefore(btn, burger);
    else wrap.appendChild(btn);
    apply(read());
  };

  function ready(fn){ document.readyState!=='loading'?fn():document.addEventListener('DOMContentLoaded',fn); }
  ready(function () {
    apply(read());
    if (document.querySelector('.mb-theme-toggle')) return;
    if (document.querySelector('.nav .navlinks')) {
      var wrap = document.querySelector('.nav .wrap');
      var burger = wrap && wrap.querySelector('.mb-burger');
      window.mountThemeToggle(wrap, burger);
      return;
    }
    var mm = document.querySelector('.mainmenu');
    if (mm) {
      var host = mm.closest('.nav, .top, header, .in') || mm.parentNode;
      var inn = (host && host.querySelector && host.querySelector('.in')) || host || mm.parentNode;
      var mmBurger = document.querySelector('.mb-mmburger');
      window.mountThemeToggle(inn, mmBurger);
      return;
    }
    var topIn = document.querySelector('.ba > .top .in, .top .in, .nav .wrap, .nav .row');
    if (topIn) {
      window.mountThemeToggle(topIn, topIn.querySelector('.mb-burger, .mb-mmburger'));
      return;
    }
    var btn = makeBtn();
    btn.style.position = 'fixed';
    btn.style.top = '12px';
    btn.style.right = '12px';
    btn.style.zIndex = '2100';
    document.body.appendChild(btn);
    apply(read());
  });
})();

/* Totez pro stranky s vlastni hlavickou a menu .mainmenu (forma-zpet, makro-plan,
   nastroje-zdarma, start, kviz). Ty maji .mainmenu{display:none} pod 1150px a zadny
   vlastni burger, takze bez tohohle bloku pod 1150px zmizi navigace uplne.
   Spousti se jen kdyz na strance NENI .nav .navlinks -> chovani 165 beznych stranek
   se nemeni. */
(function () {
  function ready(fn){ document.readyState!=='loading'?fn():document.addEventListener('DOMContentLoaded',fn); }
  ready(function () {
    if (document.querySelector('.nav .navlinks')) return; // resi blok vyse
    var mm = document.querySelector('.mainmenu');
    if (!mm) return;
    var host = mm.closest('.nav, .top, header') || mm.parentNode;
    if (!host || host.querySelector('.mb-mmburger')) return;
    var links = Array.prototype.slice.call(mm.querySelectorAll('a')).map(function (a) {
      return { t:(a.textContent||'').trim(), h:a.getAttribute('href')||'#', cta:a.classList.contains('cta') };
    }).filter(function (l) { return l.t; });
    if (!links.length) return;
    var css = ''
      + '.mb-mmburger{display:none;flex-direction:column;background:none;border:none;cursor:pointer;padding:9px;margin-left:auto;line-height:0;-webkit-tap-highlight-color:transparent;}'
      + '.mb-mmburger span{display:block;width:25px;height:2px;background:#EBB12C;margin:5px 0;border-radius:2px;transition:transform .25s,opacity .2s;}'
      + '.mb-mmhost.mbopen .mb-mmburger span:nth-child(1){transform:translateY(12px) rotate(45deg);}'
      + '.mb-mmhost.mbopen .mb-mmburger span:nth-child(2){opacity:0;}'
      + '.mb-mmhost.mbopen .mb-mmburger span:nth-child(3){transform:translateY(-12px) rotate(-45deg);}'
      + '.mb-mmhost .mb-drawer{display:none;position:absolute;top:100%;left:0;right:0;background:#181520;border-top:1px solid #262232;box-shadow:0 26px 54px -14px rgba(0,0,0,.65);z-index:1200;padding:6px 0 10px;text-align:left;}'
      + '.mb-mmhost.mbopen .mb-drawer{display:block;}'
      + '.mb-mmhost .mb-drawer a{display:block;padding:13px 22px;color:#F0EADF;text-decoration:none;font-weight:600;font-size:1.03rem;opacity:1;border-bottom:1px solid rgba(255,255,255,.05);}'
      + '.mb-mmhost .mb-drawer a:hover{background:rgba(235,177,44,.08);color:#EBB12C;}'
      + '@media (max-width:1150px){ .mb-mmburger{display:inline-flex;} }'
      + '@media (min-width:1151px){ .mb-mmhost .mb-drawer{display:none!important;} }'
      + '[data-theme="light"] .mb-mmhost .mb-drawer{background:var(--mb-bg,#F7F3EB);color:var(--mb-text,#161310);border-top-color:var(--bd-line,rgba(22,19,16,.12));box-shadow:0 26px 54px -14px rgba(22,19,16,.18);}'
      + '[data-theme="light"] .mb-mmhost .mb-drawer a{color:var(--mb-text,#161310);border-bottom-color:var(--bd-line,rgba(22,19,16,.12));}'
      + '[data-theme="light"] .mb-mmhost .mb-drawer a:hover{background:rgba(235,177,44,.10);color:var(--mb-gold,#EBB12C);}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    host.classList.add('mb-mmhost');
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    var b = document.createElement('button');
    b.className='mb-mmburger'; b.type='button'; b.setAttribute('aria-label','Menu'); b.setAttribute('aria-expanded','false');
    b.innerHTML='<span></span><span></span><span></span>';
    var d = document.createElement('div'); d.className='mb-drawer';
    links.forEach(function (l) { var a=document.createElement('a'); a.href=l.h; a.textContent=l.t; if(l.cta)a.className='cta'; d.appendChild(a); });
    mm.parentNode.insertBefore(b, mm.nextSibling);
    host.appendChild(d);
    b.addEventListener('click', function (e) { e.stopPropagation(); var open=host.classList.toggle('mbopen'); b.setAttribute('aria-expanded', open?'true':'false'); });
    d.addEventListener('click', function (e) { if (e.target.tagName==='A') host.classList.remove('mbopen'); });
    document.addEventListener('click', function (e) { if (!host.contains(e.target)) host.classList.remove('mbopen'); });
  });
})();
