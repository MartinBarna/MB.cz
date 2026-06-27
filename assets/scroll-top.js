/* Barna — sdílené plovoucí tlačítko "nahoru" (funguje na jakékoli stránce) */
(function () {
  if (document.getElementById('toTop') || document.getElementById('baToTop')) return; // stránka už nějaké má
  function ready(fn) { document.readyState !== 'loading' ? fn() : document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    var css = '#baToTop{position:fixed;right:20px;bottom:24px;width:48px;height:48px;border-radius:50%;'
      + 'background:linear-gradient(145deg,#ff9d3c,#ff7a00);color:#160d04;border:none;cursor:pointer;'
      + 'display:flex;align-items:center;justify-content:center;font-size:1.45rem;font-weight:800;line-height:1;z-index:1100;'
      + 'box-shadow:0 10px 26px -6px rgba(255,122,0,.6);opacity:0;visibility:hidden;transform:translateY(10px);'
      + 'transition:opacity .25s,transform .25s,visibility .25s;-webkit-tap-highlight-color:transparent;}'
      + '#baToTop.show{opacity:1;visibility:visible;transform:translateY(0);}'
      + '#baToTop:hover{transform:translateY(-3px);box-shadow:0 16px 32px -6px rgba(255,122,0,.7);}'
      + '#baToTop.wa{bottom:96px;}'
      + '@media(max-width:600px){#baToTop{right:14px;bottom:16px;width:44px;height:44px;font-size:1.3rem;}#baToTop.wa{bottom:84px;}}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    var b = document.createElement('button');
    b.id = 'baToTop'; b.type = 'button'; b.setAttribute('aria-label', 'Nahoru'); b.innerHTML = '&#8593;';
    document.body.appendChild(b);
    if (document.querySelector('.fab-wa')) b.classList.add('wa'); // nad WhatsApp tlačítkem, ať se nepřekrývají

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
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  });
})();
