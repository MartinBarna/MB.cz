/* Martin Barna — referral capture (doporučovací program, Cesta A).
   1) Zachytí ?ref=BARNA-XXXX z odkazu doporučitele → localStorage (60 dní).
   2) Když kamarád klikne na buy odkaz videokurzu (3Vbl) nebo Academy (Xgl8g)
      A MÁ uložený ref → sebere e-mail (kvůli spárování odměny), pošle {ref,email}
      do referral-click a předvyplní ?email= do SimpleShop odkazu.
   Bez uloženého refu je skript neaktivní — běžný nakupující nic nepozná.
   Sdílený soubor, načítá se z každé stránky za analytics.js. */
(function () {
  var CLICK_FN = 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/referral-click';
  var LS = 'ba_ref', LS_T = 'ba_ref_t', MAX_DAYS = 60;

  // ---- 1) zachyť ?ref= ----
  try {
    var qs = new URLSearchParams(location.search);
    var ref = (qs.get('ref') || '').trim().toUpperCase();
    if (/^BARNA-[A-Z0-9]{4,10}$/.test(ref)) {
      localStorage.setItem(LS, ref);
      localStorage.setItem(LS_T, String(Date.now()));
    }
  } catch (e) {}

  function getRef() {
    try {
      var t = parseInt(localStorage.getItem(LS_T) || '0', 10);
      if (t && (Date.now() - t) > MAX_DAYS * 864e5) {
        localStorage.removeItem(LS); localStorage.removeItem(LS_T); return '';
      }
      return localStorage.getItem(LS) || '';
    } catch (e) { return ''; }
  }

  // ---- 2) je to buy odkaz produktu v referralu? ----
  function buyInfo(href) {
    if (!href) return null;
    if (href.indexOf('simpleshop.cz/3Vbl') >= 0) return { url: href, prod: 'videokurz' };
    if (href.indexOf('simpleshop.cz/Xgl8g') >= 0) return { url: href, prod: 'academy' };
    return null;
  }
  function withEmail(url, email) {
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return url + sep + 'email=' + encodeURIComponent(email);
  }
  function validEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); }

  // ---- modal ----
  var modal = null;
  function ensureModal() {
    if (modal) return modal;
    var css = '#ba-ref-ov{position:fixed;inset:0;z-index:99997;background:rgba(8,6,4,.72);display:flex;align-items:center;justify-content:center;padding:18px;font-family:"Poppins",Arial,sans-serif}'
      + '#ba-ref-ov .bx{background:#161310;border:1px solid rgba(255,122,0,.4);border-radius:18px;max-width:400px;width:100%;padding:22px 22px 20px;color:#ece4d9;box-shadow:0 20px 60px rgba(0,0,0,.6)}'
      + '#ba-ref-ov h3{margin:.1rem 0 .3rem;color:#fff;font-size:1.18rem}'
      + '#ba-ref-ov p{margin:.2rem 0 .9rem;color:#b7ab9b;font-size:.9rem;line-height:1.5}'
      + '#ba-ref-ov input[type=email]{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:11px;padding:12px 13px;color:#fff;font-family:inherit;font-size:.98rem;box-sizing:border-box}'
      + '#ba-ref-ov .hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}'
      + '#ba-ref-ov .go{width:100%;margin-top:12px;cursor:pointer;border:none;font-family:inherit;font-weight:800;font-size:1rem;padding:13px;border-radius:50px;background:linear-gradient(145deg,#ffb066,#ff7a00);color:#160d04}'
      + '#ba-ref-ov .skip{display:block;width:100%;margin-top:10px;cursor:pointer;background:none;border:none;color:#8a7e6d;font-family:inherit;font-size:.82rem;text-decoration:underline}'
      + '#ba-ref-ov .err{color:#ff8b6b;font-size:.82rem;margin-top:6px;min-height:1em}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var ov = document.createElement('div'); ov.id = 'ba-ref-ov'; ov.style.display = 'none';
    ov.innerHTML = '<div class="bx" role="dialog" aria-modal="true">'
      + '<h3>Máš slevu −10 % 🎉</h3>'
      + '<p>Kamarád ti poslal doporučení. Zadej svůj e-mail, ať ti slevu spárujeme — pak tě pošleme k platbě, kde stačí zadat kód <b>DOPORUC10</b>.</p>'
      + '<input type="email" id="ba-ref-em" placeholder="tvuj@email.cz" autocomplete="email">'
      + '<input type="text" id="ba-ref-hp" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">'
      + '<div class="err" id="ba-ref-err"></div>'
      + '<button class="go" id="ba-ref-go">Pokračovat k platbě →</button>'
      + '<button class="skip" id="ba-ref-skip">Pokračovat bez slevy</button>'
      + '</div>';
    document.body.appendChild(ov);
    modal = ov;
    return ov;
  }

  function openModal(info, ref) {
    var ov = ensureModal();
    ov.style.display = 'flex';
    var em = document.getElementById('ba-ref-em');
    var hp = document.getElementById('ba-ref-hp');
    var err = document.getElementById('ba-ref-err');
    var go = document.getElementById('ba-ref-go');
    var skip = document.getElementById('ba-ref-skip');
    err.textContent = ''; em.value = ''; setTimeout(function () { em.focus(); }, 50);

    function close() { ov.style.display = 'none'; }
    function proceed(url) { close(); location.href = url; }

    go.onclick = function () {
      var email = (em.value || '').trim().toLowerCase();
      if (!validEmail(email)) { err.textContent = 'Zadej prosím platný e-mail.'; return; }
      // fire-and-forget zápis do referral-click (návratovku ignorujeme)
      try {
        fetch(CLICK_FN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref: ref, email: email, website: (hp.value || '') })
        }).catch(function () {});
      } catch (e) {}
      proceed(withEmail(info.url, email));
    };
    em.onkeydown = function (e) { if (e.key === 'Enter') go.onclick(); };
    skip.onclick = function () { proceed(info.url); };
    ov.onclick = function (e) { if (e.target === ov) close(); };
  }

  // ---- 3) zachyť kliknutí na buy odkazy (capture fáze, aby to chytlo dřív než navigace) ----
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    var a = (t && t.closest) ? t.closest('a[href]') : null;
    if (!a) return;
    var info = buyInfo(a.getAttribute('href') || a.href || '');
    if (!info) return;
    var ref = getRef();
    if (!ref) return; // žádný referral → normální chování
    ev.preventDefault();
    ev.stopPropagation();
    openModal(info, ref);
  }, true);
})();
