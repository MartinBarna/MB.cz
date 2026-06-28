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
      + 'background:linear-gradient(145deg,#ff9d3c,#ff7a00);color:#160d04;border:none;cursor:pointer;'
      + 'display:flex;align-items:center;justify-content:center;font-size:1.45rem;font-weight:800;line-height:1;z-index:1090;'
      + 'box-shadow:0 10px 26px -6px rgba(255,122,0,.6);opacity:0;visibility:hidden;transform:translateY(10px);'
      + 'transition:opacity .25s,transform .25s,visibility .25s,bottom .25s;-webkit-tap-highlight-color:transparent;}'
      + '#baToTop.show{opacity:1;visibility:visible;transform:translateY(0);}'
      + '#baToTop:hover{transform:translateY(-3px);box-shadow:0 16px 32px -6px rgba(255,122,0,.7);}'
      + '@media(max-width:600px){#baToTop{right:14px;bottom:16px;width:44px;height:44px;font-size:1.3rem;}}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    var b = document.createElement('button');
    b.id = 'baToTop'; b.type = 'button'; b.setAttribute('aria-label', 'Nahoru'); b.innerHTML = '&#8593;';
    document.body.appendChild(b);

    var wa = document.querySelector('.fab-wa, a[class*="fab-wa"], a[aria-label="WhatsApp"]');

    // spodní lišta "koupit" (jen na některých stránkách) — měříme její výšku, když je vidět
    function buyBarBottom() {
      var bar = document.querySelector('.vk-buybar.show, .cta-bar.show');
      if (!bar) return 0;
      var h = bar.offsetHeight;
      return (h > 0 && h < window.innerHeight) ? h : 0;
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
