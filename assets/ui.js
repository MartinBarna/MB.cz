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
