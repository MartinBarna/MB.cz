/* Referral capture (#39) — zachytí ?ref=KOD do localStorage a na objednávkových
   stránkách připomene kamarádovi, ať kód zadá jako slevový kupón v SimpleShopu.
   Žádný backend; jen UX most mezi sdíleným odkazem a checkoutem. */
(function () {
  try {
    var KEY = 'ba_ref';
    var m = location.search.match(/[?&]ref=([A-Za-z0-9\-]{4,20})/);
    if (m) { try { localStorage.setItem(KEY, m[1].toUpperCase()); } catch (e) {} }

    var code = '';
    try { code = localStorage.getItem(KEY) || ''; } catch (e) {}
    if (!code) return;

    // Banner jen na objednávkových / prodejních stránkách
    var p = location.pathname.toLowerCase();
    var ORDER = ['/akademie/objednavka', '/videokurz', '/objednavka'];
    var onOrder = false;
    for (var i = 0; i < ORDER.length; i++) { if (p.indexOf(ORDER[i]) === 0 || p.indexOf(ORDER[i]) !== -1) { onOrder = true; break; } }
    if (!onOrder) return;
    if (sessionStorage.getItem('ba_ref_seen') === '1') return;

    function show() {
      if (document.getElementById('ba-ref-bar')) return;
      var bar = document.createElement('div');
      bar.id = 'ba-ref-bar';
      bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9998;max-width:520px;margin:0 auto;' +
        'background:linear-gradient(180deg,#1a130c,#100b07);border:1px solid #3a2c1c;border-radius:16px;' +
        'box-shadow:0 18px 50px rgba(0,0,0,.5);padding:14px 16px;color:#ece4d9;font-family:Poppins,Arial,sans-serif;' +
        'font-size:.92rem;line-height:1.5;display:flex;align-items:center;gap:12px;';
      bar.innerHTML =
        '<div style="flex:1;">🎁 Máš doporučující kód <b style="color:#ff9d3c;letter-spacing:.04em;">' + code +
        '</b> — zadej ho v objednávce jako <b>slevový kupón</b> a máš slevu.</div>' +
        '<button id="ba-ref-x" aria-label="Zavřít" style="background:none;border:none;color:#9b8e7d;font-size:1.3rem;cursor:pointer;line-height:1;padding:2px 6px;">×</button>';
      document.body.appendChild(bar);
      document.getElementById('ba-ref-x').onclick = function () {
        bar.remove();
        try { sessionStorage.setItem('ba_ref_seen', '1'); } catch (e) {}
      };
    }
    if (document.body) show();
    else document.addEventListener('DOMContentLoaded', show);
  } catch (e) { /* fail-safe: nikdy neshazuj stránku */ }
})();
