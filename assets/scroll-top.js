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
    var css = '#baToTop{position:fixed;right:20px;bottom:20px;width:48px;height:48px;border-radius:50%;'
      + 'background:linear-gradient(145deg,#F6CD63,#EBB12C);color:#1A1222;border:none;cursor:pointer;'
      + 'display:flex;align-items:center;justify-content:center;font-size:1.45rem;font-weight:800;line-height:1;z-index:1090;'
      + 'box-shadow:0 10px 26px -6px rgba(235,177,44,.6);opacity:0;visibility:hidden;transform:translateY(10px);'
      + 'transition:opacity .25s,transform .25s,visibility .25s,bottom .25s;-webkit-tap-highlight-color:transparent;}'
      + '#baToTop.show{opacity:1;visibility:visible;transform:translateY(0);}'
      + '#baToTop:hover{transform:translateY(-3px);box-shadow:0 16px 32px -6px rgba(235,177,44,.7);}'
      + '@media(max-width:600px){#baToTop{right:14px;bottom:16px;width:44px;height:44px;font-size:1.3rem;}}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    var b = document.createElement('button');
    b.id = 'baToTop'; b.type = 'button'; b.setAttribute('aria-label', 'Nahoru'); b.innerHTML = '&#8593;';
    document.body.appendChild(b);

    var wa = document.querySelector('.fab-wa, a[class*="fab-wa"], a[aria-label="WhatsApp"]');

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

    function place() {
      var small = window.innerWidth <= 600;
      var base = small ? 16 : 20;
      var gap = 12;
      var bh = buyBarBottom();
      var floor = bh ? bh + 14 : base;       // tlačítko vždy nad spodní lištou
      var shown = b.classList.contains('show');

      // Obě vpravo dole: WhatsApp dole, šipka „nahoru" NAD ním (stack), ať se nepřekrývají.
      // Oba držíme nad případnou spodní lištou.
      var waH = (wa && wa.offsetHeight) ? wa.offsetHeight : 56;
      if (wa) wa.style.bottom = floor + 'px';
      b.style.bottom = (wa ? floor + waH + gap : floor) + 'px';
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
      return { t:(a.textContent||'').trim(), h:a.getAttribute('href')||'#', cta:a.classList.contains('cta') };
    }).filter(function (l) { return l.t; });
    if (!links.length) return;
    var css = ''
      + '.nav .mb-burger{display:inline-flex;flex-direction:column;background:none;border:none;cursor:pointer;padding:9px;margin-left:auto;line-height:0;-webkit-tap-highlight-color:transparent;}'
      + '.nav .mb-burger span{display:block;width:25px;height:2px;background:#EBB12C;margin:5px 0;border-radius:2px;transition:transform .25s,opacity .2s;}'
      + '.nav.mbopen .mb-burger span:nth-child(1){transform:translateY(7px) rotate(45deg);}'
      + '.nav.mbopen .mb-burger span:nth-child(2){opacity:0;}'
      + '.nav.mbopen .mb-burger span:nth-child(3){transform:translateY(-7px) rotate(-45deg);}'
      + '.nav .mb-drawer{display:none;position:absolute;top:100%;left:0;right:0;background:#181520;border-top:1px solid #262232;box-shadow:0 26px 54px -14px rgba(0,0,0,.65);z-index:1200;padding:6px 0 10px;}'
      + '.nav.mbopen .mb-drawer{display:block;}'
      + '.nav .mb-drawer a{display:block;padding:13px 22px;color:#F0EADF;text-decoration:none;font-weight:600;font-size:1.03rem;border-bottom:1px solid rgba(255,255,255,.05);}'
      + '.nav .mb-drawer a:hover{background:rgba(235,177,44,.08);color:#EBB12C;}'
      + '.nav .mb-drawer a.cta{color:#1A1222;background:#EBB12C;margin:10px 16px 4px;border-radius:50px;text-align:center;border-bottom:none;font-weight:700;}'
      + '@media (max-width:1259px){ .nav .navlinks{display:none!important;} .nav .nav-burger{display:none!important;} }'
      + '@media (min-width:1260px){ .nav .mb-drawer,.nav .mb-burger{display:none!important;} }';
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
