/* Martin Barna — drobné UI (collapse / accordion) bez Bootstrap JS.
   Nahrazuje 79 KB bootstrap.bundle.min.js — používáme jen komponentu "collapse"
   (mobilní menu + FAQ akordeon). Bootstrap CSS zůstává pro vzhled. */
(function () {
  function targets(btn) {
    var sel = btn.getAttribute('data-bs-target') || btn.getAttribute('href');
    if (!sel || sel === '#') return [];
    try { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
    catch (e) { return []; }
  }
  function setTriggers(id, collapsed) {
    document.querySelectorAll('[data-bs-target="#' + id + '"],[href="#' + id + '"]').forEach(function (b) {
      b.classList.toggle('collapsed', collapsed);
      b.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    });
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-bs-toggle="collapse"]');
    if (!btn) return;
    e.preventDefault();
    targets(btn).forEach(function (t) {
      var willShow = !t.classList.contains('show');
      var parentSel = t.getAttribute('data-bs-parent');
      if (willShow && parentSel) {
        var parent = document.querySelector(parentSel);
        if (parent) {
          parent.querySelectorAll('.collapse.show').forEach(function (o) {
            if (o !== t) { o.classList.remove('show'); if (o.id) setTriggers(o.id, true); }
          });
        }
      }
      t.classList.toggle('show', willShow);
      if (t.id) setTriggers(t.id, !willShow);
    });
  });
})();

/* High-end vrstva: frosted navbar při scrollu + jemný 3D tilt karet + magnetická CTA.
   Idempotentní (běží jen jednou), aby se to nesrazilo s případným inline kódem. */
(function () {
  if (window.__mbHighEnd) return;
  window.__mbHighEnd = true;

  // Frosted navbar — funguje na všech stránkách se sticky navbarem
  var navbar = document.querySelector('.navbar.sticky-top');
  if (navbar) {
    var onScroll = function () {
      var st = window.scrollY || document.documentElement.scrollTop;
      navbar.classList.toggle('scrolled', st > 24);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Tilt + magnet jen pro myš na PC a když uživatel nepožaduje omezení pohybu
  if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;

  var cap = function (v) { return Math.max(-9, Math.min(9, v)); };
  document.querySelectorAll('.btn-grn, .btn-white, .btn-gold').forEach(function (btn) {
    btn.addEventListener('mousemove', function (e) {
      var r = btn.getBoundingClientRect();
      var mx = e.clientX - (r.left + r.width / 2), my = e.clientY - (r.top + r.height / 2);
      btn.style.transform = 'translate(' + cap(mx * 0.16).toFixed(1) + 'px,' + cap(my * 0.26).toFixed(1) + 'px)';
    });
    btn.addEventListener('mouseleave', function () { btn.style.transform = ''; });
  });

  var raf;
  document.querySelectorAll('.plan, .card').forEach(function (card) {
    card.addEventListener('mousemove', function (e) {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transition = 'transform .08s linear';
        card.style.transform = 'perspective(900px) rotateX(' + (-py * 4.5).toFixed(2) + 'deg) rotateY(' + (px * 4.5).toFixed(2) + 'deg) translateY(-6px)';
      });
    });
    card.addEventListener('mouseleave', function () { card.style.transition = 'transform .35s ease, box-shadow .35s ease'; card.style.transform = ''; });
  });
})();

/* Lightbox pro galerie (proměny, recenze) — klik/Enter → fotka přes celou obrazovku,
   šipky/swipe pro listování, Esc zavře. Funguje na každé stránce s galerijními fotkami. */
(function () {
  var imgs = Array.prototype.slice.call(document.querySelectorAll('.promeny-grid img, .story-duo img, img.js-zoom'));
  if (!imgs.length) return;
  var lb, lbImg, lbCap, btnPrev, btnNext, idx = 0, lastFocus = null;

  function build() {
    lb = document.createElement('div');
    lb.className = 'mb-lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Náhled fotky');
    lb.innerHTML =
      '<button type="button" class="mb-lb-btn mb-lb-close" aria-label="Zavřít náhled">×</button>' +
      '<button type="button" class="mb-lb-btn mb-lb-prev" aria-label="Předchozí fotka">‹</button>' +
      '<figure><img alt=""><figcaption></figcaption></figure>' +
      '<button type="button" class="mb-lb-btn mb-lb-next" aria-label="Další fotka">›</button>';
    document.body.appendChild(lb);
    lbImg = lb.querySelector('img');
    lbCap = lb.querySelector('figcaption');
    btnPrev = lb.querySelector('.mb-lb-prev');
    btnNext = lb.querySelector('.mb-lb-next');
    lb.querySelector('.mb-lb-close').addEventListener('click', close);
    btnPrev.addEventListener('click', function (e) { e.stopPropagation(); go(-1); });
    btnNext.addEventListener('click', function (e) { e.stopPropagation(); go(1); });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.tagName === 'FIGURE') close(); });
    var sx = 0;
    lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) { var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); });
  }

  function show(i) {
    idx = (i + imgs.length) % imgs.length;
    var src = imgs[idx].currentSrc || imgs[idx].src;
    lbImg.src = src;
    lbImg.alt = imgs[idx].alt || '';
    lbCap.textContent = imgs[idx].alt || '';
    var multi = imgs.length > 1;
    btnPrev.style.display = multi ? '' : 'none';
    btnNext.style.display = multi ? '' : 'none';
  }
  function onKey(e) { if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1); }
  function open(i) {
    if (!lb) build();
    lastFocus = document.activeElement;
    show(i);
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
    lb.querySelector('.mb-lb-close').focus();
    document.addEventListener('keydown', onKey);
    if (window.gtag) gtag('event', 'galerie_zvetseni');
  }
  function close() {
    if (!lb) return;
    lb.classList.remove('open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function go(d) { show(idx + d); }

  imgs.forEach(function (im, i) {
    im.setAttribute('tabindex', '0');
    im.setAttribute('role', 'button');
    im.addEventListener('click', function () { open(i); });
    im.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); } });
  });
})();
