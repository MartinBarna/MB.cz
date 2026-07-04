/* Barna Academy — sdílitelná achievement karta (SVG → PNG, bez závislostí).
   Pohání gamifikaci A (rank karta) i B (mini-certifikát modulu).
   Použití:  BAShare.open({ type:'rank', rankName:'Zkušený trenér', pct:40, done:96, total:240, name:'Jan Novák' })
             BAShare.open({ type:'module', moduleTitle:'Zdravotní specifika a stárnutí', moduleNum:23, name:'Jan Novák' })
             BAShare.open({ type:'master', name:'Jan Novák' })
   Centerpiece je vektorový (kruhový progress + procenta / pečeť s fajfkou) — nezávisí na emoji fontu. */
(function (global) {
  'use strict';
  var FONT = "'Poppins','Segoe UI',system-ui,sans-serif";
  var W = 1080, H = 1080, PAD = 90;
  var GOLD = '#ff7a00', GOLD2 = '#ffb64d', INK = '#e9e2d8', MUT = '#a89e94';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  var _mctx = (typeof document !== 'undefined') ? document.createElement('canvas').getContext('2d') : null;
  function textW(t, weight, size) { if (!_mctx) return String(t).length * size * 0.55; _mctx.font = weight + ' ' + size + "px 'Poppins','Segoe UI',sans-serif"; return _mctx.measureText(t).width; }
  function wrap(text, weight, size, maxW) {
    var words = String(text).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (textW(t, weight, size) > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur); return lines;
  }
  function block(text, x, y, weight, size, lh, fill, maxW, anchor) {
    var lines = wrap(text, weight, size, maxW), s = '';
    for (var i = 0; i < lines.length; i++) {
      s += '<text x="' + x + '" y="' + (y + i * lh) + '" font-family="' + FONT + '" font-weight="' + weight + '" font-size="' + size + '" fill="' + fill + '" text-anchor="' + (anchor || 'start') + '">' + esc(lines[i]) + '</text>';
    }
    return { svg: s, h: lines.length * lh, lines: lines.length };
  }
  function arc(cx, cy, r, pct) {
    var frac = Math.max(0, Math.min(1, pct / 100));
    if (frac <= 0) return '';
    if (frac >= 1) return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="url(#g1)" stroke-width="16"/>';
    var a0 = -Math.PI / 2, a1 = a0 + frac * 2 * Math.PI;
    var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    var large = frac > 0.5 ? 1 : 0;
    return '<path d="M ' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + '" fill="none" stroke="url(#g1)" stroke-width="16" stroke-linecap="round"/>';
  }
  function checkMark(cx, cy, s) {
    // fajfka jako path, vycentrovaná kolem (cx,cy)
    return '<path d="M ' + (cx - s) + ' ' + cy + ' l ' + (s * 0.7) + ' ' + (s * 0.75) + ' l ' + (s * 1.35) + ' ' + (-s * 1.5) + '" fill="none" stroke="url(#g1)" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>';
  }

  function buildSVG(o) {
    o = o || {};
    var type = o.type || 'rank';
    var kicker, title, sub, centerKind, big = '', pct = null;
    if (type === 'module') {
      kicker = 'DOKONČENÝ MODUL'; title = o.moduleTitle || 'Modul'; sub = 'Modul ' + (o.moduleNum || '') + ' · Barna Academy'; centerKind = 'seal';
    } else if (type === 'master') {
      kicker = 'CERTIFIKOVANÝ TRENÉR'; title = 'Mistr Barna Academy'; sub = 'Všech ' + (o.total || 240) + ' lekcí dokončeno'; centerKind = 'seal'; pct = 100;
    } else {
      kicker = 'TVÁ ÚROVEŇ'; title = o.rankName || 'Trenér'; sub = (o.done || 0) + ' z ' + (o.total || 240) + ' lekcí dokončeno'; centerKind = 'ring'; pct = (typeof o.pct === 'number' ? o.pct : 0); big = Math.round(pct) + '%';
    }
    var name = o.name || '';
    var cx = W / 2, cy = 452, r = 188;
    var s = '';
    s += '<defs>' +
      '<linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + GOLD2 + '"/><stop offset="1" stop-color="' + GOLD + '"/></linearGradient>' +
      '<radialGradient id="bg" cx="50%" cy="32%" r="82%"><stop offset="0" stop-color="#241a0f"/><stop offset="55%" stop-color="#120d08"/><stop offset="100%" stop-color="#0a0a0a"/></radialGradient>' +
      '</defs>';
    s += '<rect width="' + W + '" height="' + H + '" fill="url(#bg)"/>';
    s += '<rect x="24" y="24" width="' + (W - 48) + '" height="' + (H - 48) + '" rx="40" fill="none" stroke="rgba(255,255,255,.07)"/>';
    // hlavička
    var hy = PAD + 12;
    s += '<circle cx="' + (PAD + 32) + '" cy="' + hy + '" r="32" fill="url(#g1)"/>';
    s += '<text x="' + (PAD + 32) + '" y="' + (hy + 11) + '" font-family="' + FONT + '" font-weight="800" font-size="30" fill="#160d04" text-anchor="middle">MB</text>';
    s += '<text x="' + (PAD + 84) + '" y="' + (hy - 3) + '" font-family="' + FONT + '" font-weight="800" font-size="32" fill="#fff">Barna Academy</text>';
    s += '<text x="' + (PAD + 84) + '" y="' + (hy + 28) + '" font-family="' + FONT + '" font-weight="600" font-size="18" fill="' + MUT + '" letter-spacing="3">AKADEMIE PRO TRENÉRY</text>';
    // centerpiece
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="16"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 30) + '" fill="rgba(255,122,0,.08)"/>';
    if (centerKind === 'ring') {
      s += arc(cx, cy, r, pct);
      s += '<text x="' + cx + '" y="' + (cy + 44) + '" font-family="' + FONT + '" font-weight="800" font-size="128" fill="#fff" text-anchor="middle">' + esc(big) + '</text>';
    } else {
      s += arc(cx, cy, r, 100);
      s += checkMark(cx, cy - 6, 58);
    }
    // kicker
    s += '<text x="' + cx + '" y="726" font-family="' + FONT + '" font-weight="700" font-size="26" fill="' + GOLD2 + '" text-anchor="middle" letter-spacing="6">' + esc(kicker) + '</text>';
    // titulek
    var tb = block(title, cx, 792, 800, 62, 70, '#fff', W - 2 * PAD, 'middle');
    s += tb.svg;
    var y = 792 + tb.h;
    // podtitulek
    var sbk = block(sub, cx, y + 20, 500, 30, 40, INK, W - 2 * PAD - 40, 'middle');
    s += sbk.svg;
    // jméno
    if (name) s += '<text x="' + cx + '" y="' + (H - 148) + '" font-family="' + FONT + '" font-weight="700" font-size="32" fill="' + INK + '" text-anchor="middle">' + esc(name) + '</text>';
    // patička
    s += '<text x="' + cx + '" y="' + (H - PAD + 4) + '" font-family="' + FONT + '" font-weight="600" font-size="24" fill="' + MUT + '" text-anchor="middle">martinbarna.cz/akademie · Staň se lepším trenérem</text>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + s + '</svg>';
  }

  function toPNG(svg) {
    return new Promise(function (res, rej) {
      var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      var img = new Image();
      img.onload = function () { var c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(img, 0, 0, W, H); c.toBlob(function (b) { b ? res(b) : rej(new Error('toBlob')); }, 'image/png'); };
      img.onerror = function () { rej(new Error('SVG render selhal')); };
      img.src = url;
    });
  }

  function fname(o) {
    if (o.type === 'module') return 'barna-academy-modul-' + (o.moduleNum || 'x') + '.png';
    if (o.type === 'master') return 'barna-academy-certifikat.png';
    return 'barna-academy-uroven.png';
  }

  function ensureModal() {
    var m = document.getElementById('baShareModal');
    if (m) return m;
    var css = '#baShareModal{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.72);backdrop-filter:blur(4px);padding:20px;}' +
      '#baShareModal .bx{background:#141210;border:1px solid rgba(255,255,255,.12);border-radius:20px;max-width:460px;width:100%;padding:20px;text-align:center;box-shadow:0 30px 80px -20px rgba(0,0,0,.8);}' +
      '#baShareModal h3{color:#fff;font-size:1.15rem;margin:0 0 4px;font-family:' + FONT + ';}' +
      '#baShareModal p{color:#a89e94;font-size:.9rem;margin:0 0 14px;font-family:' + FONT + ';}' +
      '#baShareModal img{width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.1);display:block;margin-bottom:16px;background:#0a0a0a;aspect-ratio:1;}' +
      '#baShareModal .row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}' +
      '#baShareModal button{font-family:' + FONT + ';font-weight:700;border-radius:50px;border:none;cursor:pointer;padding:13px 24px;font-size:.95rem;}' +
      '#baShareModal .dl{background:linear-gradient(145deg,' + GOLD2 + ',' + GOLD + ');color:#160d04;box-shadow:0 12px 26px -8px rgba(255,122,0,.55);}' +
      '#baShareModal .sh{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);color:#e9e2d8;}' +
      '#baShareModal .cl{background:transparent;color:#8a8073;padding:13px 16px;}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    m = document.createElement('div'); m.id = 'baShareModal';
    m.innerHTML = '<div class="bx"><h3>Tvůj postup 🎉</h3><p>Stáhni si kartu a pochlub se na sítích — inspiruj další trenéry.</p>' +
      '<img id="baShareImg" alt="Achievement karta"><div class="row">' +
      '<button class="dl" id="baShareDl">⬇ Stáhnout PNG</button>' +
      '<button class="sh" id="baShareShare" style="display:none">📤 Sdílet</button>' +
      '<button class="cl" id="baShareClose">Zavřít</button></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m) m.style.display = 'none'; });
    document.getElementById('baShareClose').addEventListener('click', function () { m.style.display = 'none'; });
    return m;
  }

  function open(o) {
    o = o || {};
    var m = ensureModal();
    var svg = buildSVG(o);
    var name = fname(o);
    m.style.display = 'flex';
    var imgEl = document.getElementById('baShareImg');
    imgEl.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    toPNG(svg).then(function (blob) {
      var dl = document.getElementById('baShareDl'), sh = document.getElementById('baShareShare');
      dl.onclick = function () { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); };
      // Web Share s obrázkem (hlavně mobil)
      try {
        var file = new File([blob], name, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          sh.style.display = 'inline-block';
          sh.onclick = function () { navigator.share({ files: [file], title: 'Barna Academy', text: 'Můj postup na Barna Academy 💪' }).catch(function () {}); };
        } else { sh.style.display = 'none'; }
      } catch (e) { sh.style.display = 'none'; }
    }).catch(function () {});
  }

  global.BAShare = { open: open, buildSVG: buildSVG };
})(typeof window !== 'undefined' ? window : this);
