/* Academy upsell — nenásilný pop-up v členské sekci videokurzu.
   Ukáže se JEN přihlášenému majiteli videokurzu, který NEMÁ Academy.
   Frequency cap: max 1× za 6 dní (localStorage). Spustí se po chvíli studia.
   Cíl: posunout klienta videokurzu → Barna Academy (premium). */
(function () {
  try {
    if (location.pathname.toLowerCase().indexOf('/akademie/videokurz') !== 0) return;

    var KEY = 'ba_acaups_v1';
    function recently() { try { var v = +localStorage.getItem(KEY) || 0; return v && (Date.now() - v) < 7 * 864e5; } catch (e) { return false; } }
    function mark() { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} }
    if (recently()) return;

    // Způsobilost: přihlášený videokurz člen BEZ academy. (Kdo má Academy → nic.)
    function eligible(cb) {
      if (!window.BA || !window.BA.ready) { cb(false); return; }
      window.BA.ready.then(function () {
        if (window.BA.mode !== 'live') { cb(true); return; } // demo → ukázat pro náhled
        window.BA.getUser().then(function (u) {
          if (!u) { cb(false); return; }
          window.BA.hasEntitlement('academy').then(function (has) { cb(!has); }).catch(function () { cb(false); });
        }).catch(function () { cb(false); });
      }).catch(function () { cb(false); });
    }

    function ensureStyle() {
      if (document.getElementById('ba-au-style')) return;
      var s = document.createElement('style'); s.id = 'ba-au-style';
      s.textContent = [
        '.ba-au-ov{position:fixed;inset:0;z-index:99998;background:rgba(8,6,4,.74);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px;opacity:0;transition:opacity .25s;font-family:"Poppins",Arial,sans-serif;}',
        '.ba-au-ov.on{opacity:1;}',
        '.ba-au{position:relative;width:100%;max-width:460px;background:linear-gradient(180deg,#1a130c,#100b07);border:1px solid #3a2c1c;border-radius:22px;padding:30px 26px 24px;box-shadow:0 30px 80px rgba(0,0,0,.62);transform:translateY(14px) scale(.98);transition:transform .28s;}',
        '.ba-au-ov.on .ba-au{transform:none;}',
        '.ba-au::before{content:"";position:absolute;left:-50px;top:-50px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(255,122,0,.2),transparent 65%);pointer-events:none;}',
        '.ba-au .x{position:absolute;top:12px;right:14px;background:none;border:none;color:#9b8e7d;font-size:1.5rem;line-height:1;cursor:pointer;padding:4px 8px;border-radius:8px;transition:.2s;}',
        '.ba-au .x:hover{color:#fff;background:rgba(255,255,255,.06);}',
        '.ba-au .kick{display:inline-block;background:rgba(255,122,0,.14);border:1px solid rgba(255,122,0,.4);color:#ffb066;font-weight:700;font-size:.68rem;letter-spacing:.13em;text-transform:uppercase;padding:5px 13px;border-radius:50px;}',
        '.ba-au h3{color:#fff;font-size:1.5rem;line-height:1.18;margin:14px 0 8px;letter-spacing:-.02em;}',
        '.ba-au h3 b{color:#ff9d3c;}',
        '.ba-au p{color:#cbbfae;font-size:.96rem;margin:0 0 14px;line-height:1.55;}',
        '.ba-au ul{list-style:none;padding:0;margin:0 0 16px;}',
        '.ba-au li{position:relative;padding:5px 0 5px 26px;color:#e7ddcd;font-size:.92rem;}',
        '.ba-au li::before{content:"✓";position:absolute;left:0;color:#ff9d3c;font-weight:800;}',
        '.ba-au .price{color:#cbbfae;font-size:.9rem;margin:0 0 16px;}',
        '.ba-au .price s{opacity:.55;}.ba-au .price b{color:#fff;font-size:1.05rem;}',
        '.ba-au .cta{display:block;text-align:center;text-decoration:none;background:linear-gradient(145deg,#ff9d3c,#ff7a00);color:#160d04;font-weight:800;font-size:1.02rem;padding:15px 22px;border-radius:50px;box-shadow:0 12px 30px rgba(255,122,0,.32);transition:transform .18s;}',
        '.ba-au .cta:hover{transform:translateY(-2px);}',
        '.ba-au .later{display:block;width:100%;margin-top:12px;background:none;border:none;color:#8a7e6d;font-size:.82rem;cursor:pointer;text-decoration:underline;font-family:inherit;}',
        '.ba-au .later:hover{color:#cbbfae;}',
        '@media(max-width:380px){.ba-au h3{font-size:1.28rem;}}'
      ].join('');
      document.head.appendChild(s);
    }

    function close() {
      mark();
      var ov = document.querySelector('.ba-au-ov'); if (!ov) return;
      ov.classList.remove('on'); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 260);
    }

    var shown = false;
    function show() {
      if (shown || recently()) return; shown = true;
      ensureStyle();
      var ov = document.createElement('div'); ov.className = 'ba-au-ov';
      ov.innerHTML =
        '<div class="ba-au" role="dialog" aria-label="Barna Academy">' +
        '<button class="x" aria-label="Zavřít">×</button>' +
        '<span class="kick">🎓 Pro majitele videokurzu</span>' +
        '<h3>Videokurz tě naučil <b>jak</b>. Academy ti ukáže <b>proč</b>.</h3>' +
        '<p>Posuň se z „umím si poradit" na „umím to vést u klientů". Barna Academy je celá věda za výživou, tréninkem i chováním — a certifikace.</p>' +
        '<ul><li>19 modulů a 211 lekcí + diagramy a kvízy</li><li>Certifikát Barna Academy</li><li>Doživotní přístup, i budoucí obsah</li></ul>' +
        '<p class="price">Zaváděcí cena <s>12 900 Kč</s> → <b>8 900 Kč</b> (nebo 3× 2 990).</p>' +
        '<a class="cta" href="/akademie/#cena">Prohlédnout Academy →</a>' +
        '<button class="later" type="button">Teď ne, díky</button>' +
        '</div>';
      document.body.appendChild(ov);
      requestAnimationFrame(function () { ov.classList.add('on'); });
      ov.querySelector('.x').addEventListener('click', close);
      ov.querySelector('.later').addEventListener('click', close);
      ov.querySelector('.cta').addEventListener('click', mark);
      ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
      document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
    }

    // Spustí se po ~24 s studia (ne hned po příchodu), jen pokud způsobilý.
    setTimeout(function () { eligible(function (ok) { if (ok) show(); }); }, 24000);
  } catch (e) { /* fail-safe */ }
})();
