/* AI Martin (#53/#68) — chat widget. KOSTRA / skeleton.
   Zapne se až bude hotový backend (RAG nad Martinovým korpusem + LLM API).

   ┌─ MARTIN: jak zapnout (později, jako audio) ───────────────────────────┐
   │ 1) Nasaď edge funkci `ai-martin` (RAG + LLM) — viz                     │
   │    akademie/_ai/ai-martin-architektura.md.                            │
   │ 2) Níže nastav CFG.ENDPOINT na URL té funkce.                         │
   │ 3) Přepni CFG.ENABLED na true. Widget se začne ukazovat.             │
   │ Náhled teď (s ukázkovou odpovědí, bez backendu): přidej ?aimartin=test │
   │ k libovolné stránce, kam je skript vložený.                          │
   └────────────────────────────────────────────────────────────────────────┘ */
(function () {
  'use strict';
  var CFG = {
    ENABLED: false,                 // ← true, až bude backend
    ENDPOINT: '',                   // ← URL edge funkce ai-martin
    GREETING: 'Ahoj! Jsem AI Martin — natrénovaný na tom, jak reálně koučuju. Zeptej se na výživu, trénink nebo jak začít. (Nejsem lékař, u zdravotních věcí běž za odborníkem.)',
    PLACEHOLDER: 'Napiš dotaz… např. „kolik bílkovin denně?"'
  };
  var PREVIEW = /[?&]aimartin=test/.test(location.search);
  if (!CFG.ENABLED && !PREVIEW) return;

  var OPEN = false, busy = false, msgs = [];
  function E(tag, css, html) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }

  // ---- bublina ----
  var btn = E('button', 'position:fixed;right:22px;bottom:22px;z-index:99998;width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;background:linear-gradient(145deg,#ffb066,#ff7a00);box-shadow:0 12px 30px -8px rgba(255,122,0,.6);display:flex;align-items:center;justify-content:center;transition:transform .2s');
  btn.setAttribute('aria-label', 'Zeptej se AI Martina');
  btn.innerHTML = '<span style="font-family:Poppins,Arial,sans-serif;font-weight:800;color:#160d04;font-size:1.05rem;letter-spacing:-.02em;">MB</span>';
  btn.onmouseenter = function () { btn.style.transform = 'scale(1.06)'; };
  btn.onmouseleave = function () { btn.style.transform = 'scale(1)'; };

  // ---- panel ----
  var panel = E('div', 'position:fixed;right:22px;bottom:92px;z-index:99999;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 130px);background:#141210;border:1px solid rgba(255,122,0,.32);border-radius:18px;box-shadow:0 28px 70px -20px rgba(0,0,0,.7);display:none;flex-direction:column;overflow:hidden;font-family:Poppins,Arial,sans-serif');
  panel.innerHTML =
    '<div style="padding:14px 16px;background:linear-gradient(145deg,#23211e,#0c0c0c);border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:11px;">' +
      '<span style="width:38px;height:38px;border-radius:50%;background:linear-gradient(145deg,#ffb066,#ff7a00);display:flex;align-items:center;justify-content:center;font-weight:800;color:#160d04;flex-shrink:0;">MB</span>' +
      '<div style="flex:1;"><div style="color:#fff;font-weight:700;font-size:.98rem;">AI Martin</div><div style="color:#7bd88f;font-size:.74rem;font-weight:600;">' + (CFG.ENABLED ? '● online' : '● ukázka (připravujeme)') + '</div></div>' +
      '<button id="amX" aria-label="Zavřít" style="background:rgba(255,255,255,.08);border:none;color:#cabfb4;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1.05rem;line-height:1;">×</button>' +
    '</div>' +
    '<div id="amBody" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#0e0d0b;"></div>' +
    '<form id="amForm" style="padding:12px;border-top:1px solid rgba(255,255,255,.08);display:flex;gap:8px;background:#141210;">' +
      '<input id="amIn" autocomplete="off" placeholder="' + esc(CFG.PLACEHOLDER) + '" style="flex:1;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.14);border-radius:50px;color:#fff;padding:11px 16px;font-family:inherit;font-size:.92rem;outline:none;">' +
      '<button type="submit" aria-label="Odeslat" style="background:linear-gradient(145deg,#ffb066,#ff7a00);border:none;border-radius:50%;width:42px;height:42px;cursor:pointer;color:#160d04;font-size:1.1rem;flex-shrink:0;">↑</button>' +
    '</form>';

  function bubble(role, text) {
    var me = role === 'user';
    var b = E('div', 'max-width:84%;padding:10px 14px;border-radius:14px;font-size:.92rem;line-height:1.5;white-space:pre-wrap;' +
      (me ? 'align-self:flex-end;background:linear-gradient(145deg,#ff7a00,#e36f00);color:#160d04;font-weight:600;border-bottom-right-radius:4px;'
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

  function reply(userText) {
    busy = true; typing(true);
    if (CFG.ENABLED && CFG.ENDPOINT) {
      fetch(CFG.ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs.slice(-12) }) })
        .then(function (r) { return r.json(); })
        .then(function (d) { typing(false); add('assistant', (d && d.reply) || 'Promiň, teď se mi nepodařilo odpovědět. Zkus to za chvíli.'); })
        .catch(function () { typing(false); add('assistant', 'Spojení selhalo. Zkus to prosím znovu.'); })
        .finally(function () { busy = false; });
    } else {
      // PREVIEW / kostra — ukázková odpověď, žádný backend
      setTimeout(function () {
        typing(false);
        add('assistant', 'Tohle je zatím ukázka rozhraní 🙂 Až mě Martin „napojí" (natrénuje na svém stylu a zapojí AI), budu odpovídat reálně na tvoje dotazy ohledně výživy a tréninku. Zatím mrkni na videokurz nebo Academy — tam to Martin vysvětluje do hloubky.');
        busy = false;
      }, 650);
    }
  }

  function openPanel() {
    OPEN = true; panel.style.display = 'flex'; btn.style.display = 'none';
    if (!msgs.length) add('assistant', CFG.GREETING);
    setTimeout(function () { var i = panel.querySelector('#amIn'); if (i) i.focus(); }, 80);
  }
  function closePanel() { OPEN = false; panel.style.display = 'none'; btn.style.display = 'flex'; }

  function mount() {
    document.body.appendChild(btn); document.body.appendChild(panel);
    btn.addEventListener('click', openPanel);
    panel.querySelector('#amX').addEventListener('click', closePanel);
    panel.querySelector('#amForm').addEventListener('submit', function (e) {
      e.preventDefault(); if (busy) return;
      var inp = panel.querySelector('#amIn'); var t = (inp.value || '').trim(); if (!t) return;
      inp.value = ''; add('user', t); reply(t);
    });
  }
  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
