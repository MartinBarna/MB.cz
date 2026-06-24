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
