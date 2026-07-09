/* AI Martin (#53/#68) — chat widget.
   PLACENÁ funkce Academy: členové píší, ne-členové vidí rozhraní zamčené + výzvu ke koupi.
   Přístup ověřuje i server (edge funkce ai-martin) — klient jen řídí UX.

   Náhled designu bez backendu: přidej ?aimartin=test k URL (ukázková odpověď).
   Zapnutí chatu: Martin doplní ANTHROPIC_API_KEY do edge funkce — pak členům naskočí. */
(function () {
  'use strict';
  var CFG = {
    ENABLED: true,
    ENDPOINT: 'https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/ai-martin',
    CHECKOUT: '/akademie/objednavka/',
    GREETING: 'Ahoj! Jsem AI Martin — natrénovaný na tom, jak reálně koučuju. Zeptej se na výživu, trénink nebo jak začít. (Nejsem lékař, u zdravotních věcí běž za odborníkem.)',
    LOCKED_INTRO: 'Ahoj! Jsem AI Martin — tvůj osobní kouč natrénovaný na mém stylu a celém obsahu Academy. Radím ti s výživou, tréninkem i konkrétními otázkami, kdykoliv potřebuješ. 💪\n\nJsem součást Barna Academy pro členy. Odemkni si plný přístup a začneme spolu makat.',
    PLACEHOLDER: 'Napiš dotaz… např. „kolik bílkovin denně?"'
  };
  var PREVIEW = /[?&]aimartin=test/.test(location.search);
  if (!CFG.ENABLED && !PREVIEW) return;

  var OPEN = false, busy = false, msgs = [];
  var access = PREVIEW ? true : null;   // null = zjišťuje se, true = člen, false = ne-člen
  function E(tag, css, html) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }

  // ---- zjištění přístupu (člen Academy?) — přes window.BA; když chybí, ber jako ne-člena ----
  function resolveAccess(cb) {
    if (PREVIEW) { cb(true); return; }
    if (!window.BA || !window.BA.ready) { cb(false); return; }
    window.BA.ready.then(function () {
      window.BA.getUser().then(function (u) {
        if (!u) { cb(false); return; }
        window.BA.hasEntitlement('academy').then(function (has) { cb(!!has); }).catch(function () { cb(false); });
      }).catch(function () { cb(false); });
    }).catch(function () { cb(false); });
  }

  // ---- bublina (plovoucí tlačítko) ----
  var btn = E('button', 'position:fixed;right:22px;bottom:22px;z-index:99998;width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;background:linear-gradient(145deg,#F6CD63,#EBB12C);box-shadow:0 12px 30px -8px rgba(235,177,44,.6);display:flex;align-items:center;justify-content:center;transition:transform .2s');
  btn.setAttribute('aria-label', 'Zeptej se AI Martina');
  btn.innerHTML = '<span style="font-family:Poppins,Arial,sans-serif;font-weight:800;color:#1A1222;font-size:1.05rem;letter-spacing:-.02em;">MB</span>';
  btn.onmouseenter = function () { btn.style.transform = 'scale(1.06)'; };
  btn.onmouseleave = function () { btn.style.transform = 'scale(1)'; };

  // ---- panel ----
  var panel = E('div', 'position:fixed;right:22px;bottom:92px;z-index:99999;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 130px);background:#141210;border:1px solid rgba(235,177,44,.32);border-radius:18px;box-shadow:0 28px 70px -20px rgba(0,0,0,.7);display:none;flex-direction:column;overflow:hidden;font-family:Poppins,Arial,sans-serif');
  panel.innerHTML =
    '<div style="padding:14px 16px;background:linear-gradient(145deg,#23211e,#0c0c0c);border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:11px;">' +
      '<span style="width:38px;height:38px;border-radius:50%;background:linear-gradient(145deg,#F6CD63,#EBB12C);display:flex;align-items:center;justify-content:center;font-weight:800;color:#1A1222;flex-shrink:0;">MB</span>' +
      '<div style="flex:1;"><div style="color:#fff;font-weight:700;font-size:.98rem;">AI Martin</div><div id="amStatus" style="color:#7bd88f;font-size:.74rem;font-weight:600;">● online</div></div>' +
      '<button id="amX" aria-label="Zavřít" style="background:rgba(255,255,255,.08);border:none;color:#cabfb4;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1.05rem;line-height:1;">×</button>' +
    '</div>' +
    '<div id="amBody" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#0e0d0b;"></div>' +
    '<div id="amFoot" style="border-top:1px solid rgba(255,255,255,.08);background:#141210;"></div>';

  var FORM_HTML =
    '<form id="amForm" style="padding:12px;display:flex;gap:8px;">' +
      '<input id="amIn" autocomplete="off" placeholder="' + esc(CFG.PLACEHOLDER) + '" style="flex:1;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.14);border-radius:50px;color:#fff;padding:11px 16px;font-family:inherit;font-size:.92rem;outline:none;">' +
      '<button type="submit" aria-label="Odeslat" style="background:linear-gradient(145deg,#F6CD63,#EBB12C);border:none;border-radius:50%;width:42px;height:42px;cursor:pointer;color:#1A1222;font-size:1.1rem;flex-shrink:0;">↑</button>' +
    '</form>';

  var LOCKED_HTML =
    '<div style="padding:14px 16px;text-align:center;">' +
      '<a href="' + CFG.CHECKOUT + '" style="display:block;background:linear-gradient(145deg,#F6CD63,#EBB12C);color:#1A1222;font-weight:800;text-decoration:none;padding:12px 16px;border-radius:50px;font-size:.95rem;">🔓 Získat plný přístup</a>' +
      '<div style="color:#9a8f84;font-size:.72rem;margin-top:8px;">AI Martin je součást členství v Barna Academy</div>' +
    '</div>';

  function bubble(role, text) {
    var me = role === 'user';
    var b = E('div', 'max-width:84%;padding:10px 14px;border-radius:14px;font-size:.92rem;line-height:1.5;white-space:pre-wrap;' +
      (me ? 'align-self:flex-end;background:linear-gradient(145deg,#EBB12C,#C8901F);color:#1A1222;font-weight:600;border-bottom-right-radius:4px;'
          : 'align-self:flex-start;background:rgba(255,255,255,.06);color:#ece3d8;border:1px solid rgba(255,255,255,.08);border-bottom-left-radius:4px;'));
    b.textContent = text;
    return b;
  }
  function scrollDown() { var bd = panel.querySelector('#amBody'); bd.scrollTop = bd.scrollHeight; }
  function add(role, text) { msgs.push({ role: role, text: text }); panel.querySelector('#amBody').appendChild(bubble(role, text)); scrollDown(); }
  function typing(on) {
    var bd = panel.querySelector('#amBody'); var ex = bd.querySelector('#amTyping');
    if (on && !ex) { var t = bubble('assistant', '…'); t.id = 'amTyping'; t.style.opacity = '.6'; bd.appendChild(t); scrollDown(); }
    else if (!on && ex) ex.remove();
  }
  function setStatus(txt, color) { var s = panel.querySelector('#amStatus'); if (s) { s.textContent = txt; s.style.color = color; } }

  // přepne patičku na zamčenou (výzva ke koupi) a doplní hlášku
  function lockUI() {
    access = false;
    panel.querySelector('#amFoot').innerHTML = LOCKED_HTML;
    setStatus('● jen pro členy', '#F6CD63');
  }
  function unlockUI() {
    panel.querySelector('#amFoot').innerHTML = FORM_HTML;
    setStatus(PREVIEW ? '● ukázka' : '● online', '#7bd88f');
    bindForm();
  }

  // token z BA (pokud je čerstvá verze), jinak fallback přímo z úložiště supabase-js
  function getToken() {
    if (window.BA && typeof window.BA.getToken === 'function') return window.BA.getToken();
    try {
      var raw = localStorage.getItem('sb-uhmrpfsdcujbhbtumqye-auth-token');
      if (raw) { var o = JSON.parse(raw); return Promise.resolve((o && (o.access_token || (o.currentSession && o.currentSession.access_token))) || null); }
    } catch (e) {}
    return Promise.resolve(null);
  }

  function sendToServer(userText) {
    busy = true; typing(true);
    getToken().then(function (token) {
      var headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      return fetch(CFG.ENDPOINT, { method: 'POST', headers: headers, body: JSON.stringify({ messages: msgs.slice(-12) }) });
    }).then(function (r) { return r.json(); })
      .then(function (d) {
        typing(false);
        if (d && d.locked) { add('assistant', d.reply || CFG.LOCKED_INTRO); lockUI(); }
        else add('assistant', (d && d.reply) || 'Promiň, teď se mi nepodařilo odpovědět. Zkus to za chvíli.');
      })
      .catch(function () { typing(false); add('assistant', 'Spojení selhalo. Zkus to prosím znovu.'); })
      .finally(function () { busy = false; });
  }

  function replyPreview() {
    busy = true; typing(true);
    setTimeout(function () {
      typing(false);
      add('assistant', 'Tohle je ukázka rozhraní 🙂 Až Martin zapojí AI (dodá klíč), budu tady členům reálně odpovídat na výživu a trénink — natrénovaný na jeho stylu a obsahu Academy. Be Effective! 💪');
      busy = false;
    }, 650);
  }

  function reply(userText) {
    if (PREVIEW) return replyPreview();
    sendToServer(userText);
  }

  function bindForm() {
    var form = panel.querySelector('#amForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault(); if (busy) return;
      var inp = panel.querySelector('#amIn'); var t = (inp.value || '').trim(); if (!t) return;
      inp.value = ''; add('user', t); reply(t);
    });
  }

  function openPanel() {
    OPEN = true; panel.style.display = 'flex'; btn.style.display = 'none';
    if (!msgs.length) {
      if (access === false) { add('assistant', CFG.LOCKED_INTRO); }
      else { add('assistant', CFG.GREETING); }
    }
    setTimeout(function () { var i = panel.querySelector('#amIn'); if (i) i.focus(); }, 80);
  }
  function closePanel() { OPEN = false; panel.style.display = 'none'; btn.style.display = 'flex'; }

  // Posadí bublinu (i panel) NAD plovoucí WhatsApp + šipku „nahoru", ať se nic nepřekrývá.
  // Pozici počítá měřením (reaguje na scroll, spodní lištu i skrytou šipku), ne pevným offsetem.
  function placeBtn() {
    var base = window.innerWidth <= 600 ? 16 : 22, gap = 12, b = base;
    function consider(el) {
      if (!el) return;
      var cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return;
      var r = el.getBoundingClientRect(); if (!r.height) return;
      var cand = (window.innerHeight - r.bottom) + r.height + gap;   // sedni si nad tenhle prvek
      if (cand > b) b = cand;
    }
    consider(document.querySelector('.fab-wa, a[aria-label="WhatsApp"]'));
    consider(document.getElementById('baToTop') || document.getElementById('toTop'));
    var px = Math.round(b) + 'px';
    btn.style.bottom = px; panel.style.bottom = px;
  }

  function mount() {
    document.body.appendChild(btn); document.body.appendChild(panel);
    btn.addEventListener('click', openPanel);
    panel.querySelector('#amX').addEventListener('click', closePanel);
    // výchozí patička = form; přepne se podle přístupu
    unlockUI();
    resolveAccess(function (isMember) {
      if (isMember) { access = true; unlockUI(); }
      else { lockUI(); }
    });
    placeBtn();
    window.addEventListener('scroll', placeBtn, { passive: true });
    window.addEventListener('resize', placeBtn);
    setTimeout(placeBtn, 400); setTimeout(placeBtn, 1200);   // dozbírej později vytvořené prvky (WhatsApp/šipka)
  }
  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
