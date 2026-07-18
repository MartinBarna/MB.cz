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
    GREETING: 'Ahoj! Jsem AI Martin — umělá inteligence (chatbot) natrénovaná na tom, jak Martin reálně koučuje. Nemluvíš se skutečným Martinem. Zeptej se na výživu, trénink nebo jak začít — nebo 📷 vyfoť jídlo a odhadnu ti kalorie a makra. (Nejsem lékař, u zdravotních věcí běž za odborníkem.)',
    LOCKED_INTRO: 'Ahoj! Jsem AI Martin — umělá inteligence (chatbot) natrénovaná na Martinově stylu a celém obsahu Academy. Nemluvíš se skutečným Martinem, ale poradím ti s výživou, tréninkem i konkrétními otázkami, kdykoliv potřebuješ. 💪\n\nJsem součást Barna Academy pro členy. Odemkni si plný přístup a začneme spolu makat.',
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
        // Academy člen NEBO klient koučinku (AI má v ceně koučinku)
        window.BA.hasEntitlement('academy').then(function (has) {
          if (has) { cb(true); return; }
          window.BA.hasEntitlement('coaching').then(function (h2) { cb(!!h2); }).catch(function () { cb(false); });
        }).catch(function () { cb(false); });
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
      '<div style="flex:1;"><div style="color:#fff;font-weight:700;font-size:.98rem;">AI Martin</div><div id="amStatus" style="color:#cabfae;font-size:.74rem;font-weight:600;">AI chatbot · automatické odpovědi</div></div>' +
      '<button id="amX" aria-label="Zavřít" style="background:rgba(255,255,255,.08);border:none;color:#cabfb4;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1.05rem;line-height:1;">×</button>' +
    '</div>' +
    '<div id="amBody" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#0e0d0b;"></div>' +
    '<div id="amFoot" style="border-top:1px solid rgba(255,255,255,.08);background:#141210;"></div>';

  var FORM_HTML =
    '<form id="amForm" style="padding:12px;display:flex;gap:8px;align-items:center;">' +
      '<input id="amFile" type="file" accept="image/*" style="display:none;">' +
      '<button type="button" id="amCam" aria-label="Vyfotit jídlo" title="Vyfoť jídlo a odhadnu kalorie" style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:50%;width:42px;height:42px;cursor:pointer;color:#EBB12C;font-size:1.15rem;flex-shrink:0;line-height:1;">📷</button>' +
      '<input id="amIn" autocomplete="off" placeholder="' + esc(CFG.PLACEHOLDER) + '" style="flex:1;min-width:0;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.14);border-radius:50px;color:#fff;padding:11px 16px;font-family:inherit;font-size:.92rem;outline:none;">' +
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

  // ---- klikací zdroje pod odpovědí ("Kde to najdeš") ----
  // URL chodí ze serveru, kde ji skládá edge funkce z lesson_id v DB. Nikdy nepochází z textu
  // modelu, takže halucinovaný odkaz sem nemá jak proniknout. Prefix kontrolujeme i tady.
  var SRC_PREFIX = 'https://martinbarna.cz/akademie/studium/';
  function sourcesBlock(sources) {
    var wrap = E('div', 'align-self:flex-start;max-width:84%;margin:-2px 0 2px 4px;font-size:.74rem;line-height:1.5;color:#9a8f84;');
    var head = E('div', 'margin-bottom:2px;');
    head.textContent = 'Kde to najdeš';
    wrap.appendChild(head);
    var n = 0;
    for (var i = 0; i < sources.length && n < 3; i++) {
      var s = sources[i];
      if (!s || typeof s.url !== 'string' || s.url.indexOf(SRC_PREFIX) !== 0) continue;
      var row = E('div', 'margin-top:1px;');
      var a = document.createElement('a');
      a.href = s.url;
      a.textContent = String(s.title || 'Lekce');
      a.style.cssText = 'color:#EBB12C;text-decoration:none;border-bottom:1px solid rgba(235,177,44,.3);';
      row.appendChild(a);
      if (s.module) {
        var m = E('span', 'color:#7d7369;');
        m.textContent = ' · ' + String(s.module);
        row.appendChild(m);
      }
      wrap.appendChild(row);
      n++;
    }
    return n ? wrap : null;
  }

  function add(role, text, sources) {
    msgs.push({ role: role, text: text });
    var bd = panel.querySelector('#amBody');
    bd.appendChild(bubble(role, text));
    // bez zdrojů (starý backend, foto, chybová hláška) se prostě nic nevykreslí
    if (sources && sources.length) { var sb = sourcesBlock(sources); if (sb) bd.appendChild(sb); }
    scrollDown();
  }
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
    setStatus(PREVIEW ? 'AI chatbot · ukázka' : 'AI chatbot · automatické odpovědi', '#cabfae');
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

  // Umí prohlížeč číst tělo odpovědi po částech? Když ne, o stream si vůbec neřekneme
  // a server pošle celou odpověď najednou jako doteď. Radši funkční chat bez streamu.
  var CAN_STREAM = (function () {
    try { return typeof ReadableStream === 'function' && !!(new Response('')).body; }
    catch (e) { return false; }
  })();

  // Klasická (nestreamovaná) odpověď: členská brána, safety hard-stop, denní strop i foto.
  function handleJson(d) {
    typing(false);
    if (d && d.locked) { add('assistant', d.reply || CFG.LOCKED_INTRO); lockUI(); }
    else add('assistant', (d && d.reply) || 'Promiň, teď se mi nepodařilo odpovědět. Zkus to za chvíli.',
      (d && Array.isArray(d.sources)) ? d.sources : null);
  }

  // Čte SSE ze serveru a dopisuje text do jedné bubliny, jak přitéká.
  // Události: {type:'delta',text}, {type:'sources',sources}, {type:'error',reply}, pak "[DONE]".
  function readStream(res) {
    var reader = res.body.getReader(), dec = new TextDecoder();
    var buf = '', text = '', sources = null, bub = null, ended = false;
    function paint() {
      if (!bub) { typing(false); bub = bubble('assistant', text); panel.querySelector('#amBody').appendChild(bub); }
      else bub.textContent = text;
      scrollDown();
    }
    function frame(payload) {
      if (!payload || payload === '[DONE]') return;
      var j; try { j = JSON.parse(payload); } catch (e) { return; }
      if (j.type === 'delta' && j.text) { text += j.text; paint(); }
      else if (j.type === 'sources') sources = j.sources;
      else if (j.type === 'error' && !text) { text = j.reply || 'Spojení selhalo. Zkus to prosím znovu.'; paint(); }
    }
    function finish() {
      if (ended) return; ended = true;
      typing(false);
      if (!text) { text = 'Promiň, teď se mi nepodařilo odpovědět. Zkus to za chvíli.'; paint(); }
      // Do historie zapisujeme až tady: bublinu kreslíme průběžně sami, add() by ji zdvojil.
      msgs.push({ role: 'assistant', text: text });
      if (sources && sources.length) {
        var sb = sourcesBlock(sources);
        if (sb) { panel.querySelector('#amBody').appendChild(sb); scrollDown(); }
      }
      scrollDown();
    }
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) { finish(); return; }
        buf += dec.decode(r.value, { stream: true });
        var parts = buf.split('\n\n'); buf = parts.pop();   // poslední kus může být utnutý
        for (var i = 0; i < parts.length; i++) {
          var lines = parts[i].split('\n');
          for (var k = 0; k < lines.length; k++) {
            if (lines[k].indexOf('data:') === 0) frame(lines[k].slice(5).trim());
          }
        }
        return pump();
      });
    }
    // Spadlé spojení uprostřed streamu: co doteklo, si necháme, ale musí být poznat, že
    // odpověď je useknutá (jinak by člen četl půlku věty jako hotovou radu).
    return pump().catch(function () {
      text = text ? text + '\n\n(Spojení se přerušilo, odpověď je neúplná. Zkus to prosím znovu.)'
                  : 'Spojení selhalo. Zkus to prosím znovu.';
      paint(); finish();
    });
  }

  function sendToServer(userText) {
    busy = true; typing(true);
    getToken().then(function (token) {
      var headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      return fetch(CFG.ENDPOINT, { method: 'POST', headers: headers,
        body: JSON.stringify({ messages: msgs.slice(-12), stream: CAN_STREAM }) });
    }).then(function (r) {
      // Server streamuje jen běžný chat. Brána, safety stop i strop chodí dál jako JSON,
      // proto se řídíme hlavičkou, ne tím, co jsme si vyžádali.
      var ct = r.headers.get('content-type') || '';
      if (CAN_STREAM && r.body && ct.indexOf('text/event-stream') >= 0) return readStream(r);
      return r.json().then(handleJson);
    })
      .catch(function () { typing(false); add('assistant', 'Spojení selhalo. Zkus to prosím znovu.'); })
      .finally(function () { busy = false; });
  }

  // ---- VISION: vyfoť jídlo → odhad kalorií/maker ----
  function imgBubble(src) {
    var b = E('div', 'align-self:flex-end;max-width:72%;');
    var im = E('img'); im.src = src; im.alt = 'fotka jídla';
    im.style.cssText = 'max-width:180px;width:100%;border-radius:14px;border-bottom-right-radius:4px;display:block;';
    b.appendChild(im); return b;
  }
  function addImage(src) {
    msgs.push({ role: 'user', text: '[fotka jídla]' });   // historie bez base64 (šetří payload)
    panel.querySelector('#amBody').appendChild(imgBubble(src)); scrollDown();
  }
  function compressImage(f, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 1024, w = img.width, h = img.height;
        if (w > max || h > max) { if (w > h) { h = Math.round(h * max / w); w = max; } else { w = Math.round(w * max / h); h = max; } }
        try { var c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); cb(c.toDataURL('image/jpeg', 0.82)); }
        catch (e) { cb(null); }
      };
      img.onerror = function () { cb(null); };
      img.src = reader.result;
    };
    reader.onerror = function () { cb(null); };
    reader.readAsDataURL(f);
  }
  function sendImage(dataUri) {
    if (PREVIEW) { busy = true; typing(true); setTimeout(function () { typing(false); add('assistant', 'V ukázce fotku nezpracuju 🙂 U členů z ní odhadnu kalorie a makra. Be Effective! 💪'); busy = false; }, 650); return; }
    busy = true; typing(true);
    getToken().then(function (token) {
      var headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      return fetch(CFG.ENDPOINT, { method: 'POST', headers: headers, body: JSON.stringify({ messages: [{ role: 'user', text: '', image: dataUri }] }) });
    }).then(function (r) { return r.json(); })
      .then(function (d) {
        typing(false);
        if (d && d.locked) { add('assistant', d.reply || CFG.LOCKED_INTRO); lockUI(); }
        else add('assistant', (d && d.reply) || 'Fotku se mi teď nepodařilo zpracovat, zkus to prosím znovu.');
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
    var cam = panel.querySelector('#amCam'), file = panel.querySelector('#amFile');
    if (cam && file) {
      cam.addEventListener('click', function () { if (!busy) file.click(); });
      file.addEventListener('change', function () {
        var f = file.files && file.files[0]; file.value = '';
        if (!f || busy) return;
        compressImage(f, function (dataUri) {
          if (!dataUri) { add('assistant', 'Tuhle fotku se mi nepodařilo načíst, zkus jinou (JPEG/PNG).'); return; }
          addImage(dataUri); sendImage(dataUri);
        });
      });
    }
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
