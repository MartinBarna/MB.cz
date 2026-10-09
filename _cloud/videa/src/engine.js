/* Renderovací engine promo videí. Všechno je čistá funkce času t (s):
   render.js volá window.__render(t) a snímá obrazovku. Žádné CSS animace,
   takže každý snímek je deterministický. */
(function () {
  const params = new URLSearchParams(location.search);
  const V = window.VIDEOS[params.get('v')];
  const stage = document.getElementById('stage');
  if (!V) { document.body.innerHTML = 'Neznámé video'; return; }

  const ICONS = {
    barcode: '<path d="M3 7V4h3M18 4h3v3M21 17v3h-3M6 20H3v-3"/><path d="M7 8v8M10 8v8M12.5 8v8M15 8v8M17 8v8"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>',
    pot: '<path d="M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M2 10h20M9 6.5c0-1.2 1.2-1.2 1.2-2.5M14 6.5c0-1.2 1.2-1.2 1.2-2.5"/>',
    dumbbell: '<path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
    chart: '<path d="M4 20V4M4 20h16M8 16v-3M12 16V8M16 16v-6"/>',
    play: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10 9l5 3-5 3z"/>',
    cert: '<circle cx="12" cy="9" r="5"/><path d="M9 13l-2 8 5-3 5 3-2-8"/>',
    doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    plate: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6 6 0 0 1 3.5 5.8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 21v-5h-5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
  };

  // [[text]] = zlatý zvýraznění
  const fmt = s => String(s).replace(/\[\[(.+?)\]\]/g, '<span class="acc">$1</span>').replace(/\n/g, '<br>');
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  const easeInOut = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  const scenes = [];

  function make(def, isCover) {
    const root = el('div', 'scene');
    const S = { def, root, anims: [], hooks: [], t0: def.t ? def.t[0] : 0, t1: def.t ? def.t[1] : 1, cover: !!isCover };
    const reg = (e, d, k) => { e.classList.add('a'); S.anims.push({ e, d: d || 0, k: k || 'up' }); return e; };
    const col = el('div', 'col' + (def.align ? ' ' + def.align : ''));
    root.appendChild(col);
    let d = 0;
    const cap = (txt, cls, dd) => { const e = el('div', (cls || 'h2') + ' chk' + (def.center ? ' center' : ''), fmt(txt)); col.appendChild(reg(e, dd != null ? dd : d)); d += .12; return e; };

    const T = def.type;
    if (T === 'hook' || T === 'text') {
      if (def.center !== false) { def.center = true; col.style.alignItems = 'center'; }
      if (def.logo) { const lg = el('img', 'logo'); lg.src = '/assets/brand/mb-mark-gold.png'; col.appendChild(reg(lg, 0, 'fade')); d += .1; }
      if (def.kicker) cap(def.kicker, 'kicker');
      cap(def.h, 'h1');
      if (def.bubble) {
        const b = el('div', 'bubble chk'); const span = el('span'); const caret = el('span', 'caret');
        b.appendChild(span); b.appendChild(caret); col.appendChild(reg(b, def.bubbleAt || .5, 'pop'));
        const full = def.bubble, at = def.bubbleAt || .5, dur = def.typeDur || 1.0;
        S.hooks.push((lt) => {
          const n = S.cover ? full.length : Math.round(full.length * clamp((lt - at - .15) / dur));
          span.textContent = full.slice(0, n);
          caret.style.opacity = (S.cover || n >= full.length) ? (Math.floor(lt * 2.2) % 2 ? 0 : 1) * (S.cover ? 0 : 1) : 1;
        });
        // rezervuj místo pro plný text (žádné skákání layoutu)
        b.style.minWidth = '1px';
        S.measureBubble = () => { span.textContent = full; const w = b.getBoundingClientRect().width; b.style.width = w + 'px'; span.textContent = ''; };
      }
      if (def.sub) cap(def.sub, 'sub', def.subAt);
    }

    if (T === 'card') {
      col.classList.add('top');
      if (def.cap) cap(def.cap, 'h2');
      if (def.sub) cap(def.sub, 'sub');
      const card = el('div', 'card'); const img = el('img'); img.src = def.img; card.appendChild(img);
      card.appendChild(el('div', 'fade-b'));
      card.style.width = (def.w || 680) + 'px';
      if (def.h) { card.style.height = def.h + 'px'; card.style.flex = '0 0 auto'; col.classList.remove('top'); }
      col.appendChild(reg(card, d + .05, 'rise'));
      const pan = def.pan || [0, 0], zoom = def.zoom || [1, 1], crop = def.cropTop || 0;
      S.hooks.push((lt) => {
        const dur = S.t1 - S.t0;
        const p = S.cover ? (def.coverPan != null ? def.coverPan : 0) : easeInOut(clamp((lt - .3) / Math.max(.5, dur - .5)));
        const ch = card.clientHeight, cw = card.clientWidth;
        const ih = img.naturalHeight * cw / img.naturalWidth;
        const z = zoom[0] + (zoom[1] - zoom[0]) * p;
        const over = Math.max(0, ih * z - ch - crop * cw / img.naturalWidth * z);
        const fr = pan[0] + (pan[1] - pan[0]) * p;
        const y = -(crop * cw / img.naturalWidth * z) - over * fr;
        const ox = def.zoomX != null ? def.zoomX : 50;
        img.style.transformOrigin = ox + '% 0';
        img.style.transform = `translateY(${y}px) scale(${z})`;
      });
    }

    if (T === 'rows') {
      if (def.cap) cap(def.cap, 'h2');
      if (def.sub) cap(def.sub, 'sub');
      const wrap = el('div', 'rows'); col.appendChild(wrap);
      def.rows.forEach((r, i) => {
        const row = el('div', 'row');
        row.innerHTML = `<div class="ico"><svg viewBox="0 0 24 24">${ICONS[r.ico] || ''}</svg></div><div class="chk" style="flex:1;min-width:0"><div class="lab">${fmt(r.lab)}</div>${r.desc ? `<div class="desc">${fmt(r.desc)}</div>` : ''}</div>`;
        wrap.appendChild(reg(row, d + .15 + i * (def.stagger || .35), 'left'));
      });
    }

    if (T === 'stats') {
      if (def.cap) cap(def.cap, 'h2');
      const wrap = el('div', 'stats'); col.appendChild(wrap);
      def.stats.forEach((s, i) => {
        const st = el('div', 'stat');
        const num = el('div', 'num chk', s.txt != null ? fmt(s.txt) : '0');
        const lab = el('div', 'lab chk', fmt(s.lab));
        st.appendChild(num); st.appendChild(lab);
        const dd = d + .1 + i * (def.stagger || .3);
        wrap.appendChild(reg(st, dd, 'pop'));
        if (s.num != null) S.hooks.push((lt) => {
          const p = S.cover ? 1 : easeOut(clamp((lt - dd) / .9));
          num.textContent = Math.round(s.num * p).toLocaleString('cs-CZ').replace(/ /g, ' ') + (s.suf || '');
        });
      });
    }

    if (T === 'quote') {
      if (def.cap) cap(def.cap, 'h2');
      const q = el('div', 'quote');
      if (def.deco === 'wave') {
        const w = el('div', 'wave'); const bars = [];
        for (let i = 0; i < 24; i++) { const b = el('i'); w.appendChild(b); bars.push(b); }
        q.appendChild(w);
        S.hooks.push((lt) => bars.forEach((b, i) => {
          const env = S.cover ? .8 : clamp((lt - .4) / .4) * clamp((2.6 - lt) / .5 + .25);
          b.style.height = (14 + 100 * env * Math.abs(Math.sin(lt * 7 + i * .62) * Math.sin(lt * 2.3 + i * .21))) + 'px';
        }));
      }
      if (def.deco === 'camera') {
        const svgNS = 'http://www.w3.org/2000/svg';
        const wrapS = el('div'); wrapS.style.cssText = 'display:flex;justify-content:center;margin-bottom:34px';
        wrapS.innerHTML = `<svg viewBox="0 0 200 200" width="330" height="330" fill="none" stroke-linecap="round">
          <circle cx="100" cy="100" r="62" stroke="#3a3d43" stroke-width="10"/>
          <circle cx="100" cy="100" r="36" stroke="#2b2e33" stroke-width="6"/>
          <circle cx="86" cy="92" r="13" fill="#7a5a2a"/><circle cx="114" cy="96" r="10" fill="#4f7a3a"/><circle cx="100" cy="116" r="11" fill="#c9a14a"/>
          <path d="M20 50V20h30M150 20h30v30M180 150v30h-30M50 180H20v-30" stroke="#EBB12C" stroke-width="7"/>
          <line class="scan" x1="28" x2="172" y1="40" y2="40" stroke="#F6CD63" stroke-width="4" opacity=".9"/>
        </svg>`;
        q.appendChild(wrapS);
        const scan = wrapS.querySelector('.scan');
        S.hooks.push((lt) => { const y = 40 + 120 * (0.5 + 0.5 * Math.sin(lt * 2.6)); scan.setAttribute('y1', y); scan.setAttribute('y2', y); });
      }
      if (def.q) q.appendChild(el('div', 'q chk', fmt(def.q)));
      col.appendChild(reg(q, d + .1, 'pop')); d += .25;
      if (def.sub) cap(def.sub, 'sub', d + .2);
    }

    if (T === 'bars') {
      if (def.cap) cap(def.cap, 'h2');
      if (def.sub) cap(def.sub, 'sub');
      const w = el('div', 'bars'); col.appendChild(w);
      def.bars.forEach((b, i) => {
        const r = el('div', 'b');
        r.innerHTML = `<div class="bn chk">${fmt(b.n)}</div><div class="track"><div class="fill" style="background:${b.c}"></div></div><div class="tag chk" style="color:${b.c}">${fmt(b.tag)}</div>`;
        w.appendChild(reg(r, d + .2 + i * .3, 'left'));
        const fill = r.querySelector('.fill'); const dd = d + .3 + i * .3;
        S.hooks.push((lt) => { fill.style.width = (100 * b.p * (S.cover ? 1 : easeOut(clamp((lt - dd) / .8)))) + '%'; });
      });
    }

    if (T === 'photo') {
      col.classList.add('bottom');
      const ph = el('div', 'photo'); const img = el('img'); img.src = def.img;
      img.style.objectPosition = def.pos || '50% 30%';
      ph.appendChild(img); ph.appendChild(el('div', 'shade'));
      root.insertBefore(ph, col);
      S.hooks.push((lt) => { const p = S.cover ? 0 : clamp(lt / (S.t1 - S.t0)); img.style.transform = `scale(${1.1 - .08 * p})`; });
      if (def.cap) cap(def.cap, 'h2');
      if (def.sub) cap(def.sub, 'sub');
    }

    if (T === 'cover') {
      col.style.gap = '26px';
      if (def.bg) {
        const ph = el('div', 'photo'); const img = el('img'); img.src = def.bg; img.style.objectPosition = def.bgPos || '50% 30%';
        ph.appendChild(img); const sh = el('div', 'shade'); sh.style.background = 'linear-gradient(180deg,rgba(15,17,19,.35) 0%,rgba(15,17,19,.1) 25%,rgba(15,17,19,.55) 45%,rgba(15,17,19,.94) 62%,rgba(15,17,19,.98) 100%)';
        col.classList.add('bottom');
        ph.appendChild(sh); root.insertBefore(ph, col);
      }
      if (def.shot) def.logo = false;
    }
    if (T === 'cta' || T === 'cover') {
      if (def.kicker && T === 'cover') cap(def.kicker, 'kicker center');
      if (def.logo !== false) { const lg = el('img', 'logo'); lg.src = '/assets/brand/mb-mark-gold.png'; col.appendChild(reg(lg, 0, 'fade')); }
      if (def.h) cap(def.h, 'h1 center');
      if (def.label) cap(def.label, 'kicker center');
      if (def.shot) {
        const card = el('div', 'card'); const img = el('img'); img.src = def.shot; card.appendChild(img);
        card.style.cssText = `width:${def.shotW || 560}px;height:${def.shotH || 520}px;flex:0 0 auto;align-self:center`;
        img.style.transform = `translateY(${-(def.shotTop || 0) * (def.shotW || 560) / (def.shotNat || 780)}px)`;
        col.appendChild(card);
      }
      if (def.price && T === 'cover') {
        const p = el('div', 'price chk', `<span class="big" style="font-size:170px">${fmt(def.price)}</span> <span class="unit" style="margin-left:14px">${fmt(def.unit || '')}</span>`);
        col.appendChild(reg(p, 0, 'pop'));
      } else if (def.price) {
        const p = el('div', 'price chk', `<div class="big">${fmt(def.price)}</div>${def.unit ? `<div class="unit">${fmt(def.unit)}</div>` : ''}`);
        col.appendChild(reg(p, d + .05, 'pop')); d += .2;
      }
      if (def.alt) cap(def.alt, 'sub center');
      if (def.box) { const b = el('div', 'box chk', fmt(def.box)); col.appendChild(reg(b, d + .1, 'up')); d += .2; }
      if (def.url) {
        const pl = el('div', 'pill chk', fmt(def.url)); col.appendChild(reg(pl, d + .15, 'pop')); d += .2;
        if (T === 'cta') S.hooks.push((lt) => { pl._pulse = 1 + .035 * Math.max(0, Math.sin((lt - 1.4) * 4.2)) * (lt > 1.4 ? 1 : 0); });
        S.pill = pl;
      }
      if (def.small) { const s = el('div', 'small chk', fmt(def.small)); col.appendChild(reg(s, d + .2, 'fade')); }
    }

    stage.appendChild(root);
    return S;
  }

  V.scenes.forEach(def => scenes.push(make(def)));
  const coverScene = V.cover ? make(Object.assign({ type: 'cover', t: [0, 1] }, V.cover), true) : null;

  const g1 = stage.querySelector('.glow.g1'), g2 = stage.querySelector('.glow.g2');

  function applyAnims(S, lt) {
    S.anims.forEach(a => {
      const p = S.cover ? 1 : easeOut(clamp((lt - a.d) / .5));
      let tf = '';
      if (a.k === 'up') tf = `translateY(${(1 - p) * 60}px)`;
      if (a.k === 'rise') tf = `translateY(${(1 - p) * 140}px) scale(${.94 + .06 * p})`;
      if (a.k === 'left') tf = `translateX(${(1 - p) * -90}px)`;
      if (a.k === 'pop') { const s = .82 + .18 * (S.cover ? 1 : easeOutBack(clamp((lt - a.d) / .5))); tf = `scale(${s})`; }
      if (a.e._pulse) tf += ` scale(${a.e._pulse})`;
      a.e.style.transform = tf;
      a.e.style.opacity = a.k === 'pop' ? clamp(p * 1.6) : p;
    });
  }
  function easeOutBack(x) { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }

  function bg(t) {
    g1.style.transform = `translate(${-420 + 160 * Math.sin(t * .35)}px, ${-260 + 120 * Math.cos(t * .27)}px)`;
    g2.style.transform = `translate(${260 + 120 * Math.cos(t * .31)}px, ${1000 + 140 * Math.sin(t * .23)}px)`;
  }

  window.__render = function (t) {
    bg(t);
    if (coverScene) coverScene.root.style.opacity = 0;
    scenes.forEach((S, i) => {
      const last = i === scenes.length - 1;
      const first = i === 0;
      const vin = first ? 1 : clamp((t - (S.t0 - .2)) / .3);
      const vout = last ? 1 : clamp((S.t1 - t) / .2);
      const vis = t >= S.t0 - .2 && (last || t < S.t1);
      const op = vis ? Math.min(vin, vout) : 0;
      S.root.style.opacity = op;
      S.root.style.visibility = op > 0 ? 'visible' : 'hidden';
      if (op > 0) {
        const lt = t - S.t0 + .15;
        S.hooks.forEach(h => h(lt));
        applyAnims(S, lt);
      }
    });
  };

  window.__cover = function () {
    bg(2);
    scenes.forEach(S => { S.root.style.opacity = 0; S.root.style.visibility = 'hidden'; });
    const S = coverScene; if (!S) return;
    S.root.style.opacity = 1; S.root.style.visibility = 'visible';
    S.hooks.forEach(h => h(5)); applyAnims(S, 5);
  };

  // Kontrola: text uvnitř bezpečné zóny (y 250-1570, x 60-1020) a nic nepřetéká.
  window.__check = function (label) {
    const out = [];
    document.querySelectorAll('.scene').forEach(sc => {
      if (sc.style.visibility === 'hidden' || +sc.style.opacity < .999) return;
      sc.querySelectorAll('.chk').forEach(e => {
        const r = e.getBoundingClientRect();
        if (r.width === 0) return;
        const txt = (e.textContent || '').trim().slice(0, 40);
        if (r.top < 250 - .5 || r.bottom > 1570 + .5) out.push(`${label}: Y mimo zónu (${Math.round(r.top)}-${Math.round(r.bottom)}) "${txt}"`);
        if (r.left < 60 - .5 || r.right > 1020 + .5) out.push(`${label}: X mimo (${Math.round(r.left)}-${Math.round(r.right)}) "${txt}"`);
        if (e.scrollWidth > e.clientWidth + 2) out.push(`${label}: přetéká vodorovně "${txt}"`);
      });
    });
    return out;
  };

  window.__ready = (async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(i => i.decode ? i.decode().catch(() => {}) : null));
    scenes.concat(coverScene ? [coverScene] : []).forEach(S => S.measureBubble && S.measureBubble());
    // nadpis se nesmí zalomit do víc řádků, než kolik má explicitních (\n): jinak zmenšit písmo
    document.querySelectorAll('.h1, .h2').forEach(h => {
      const lines = (h.innerHTML.match(/<br>/g) || []).length + 1;
      let fs = parseFloat(getComputedStyle(h).fontSize); const min = h.classList.contains('h1') ? 78 : 68;
      const lh = () => parseFloat(getComputedStyle(h).lineHeight);
      while (h.getBoundingClientRect().height > lh() * lines + 4 && fs > min) { fs -= 3; h.style.fontSize = fs + 'px'; }
    });
    // karta nesmí být vyšší než obrázek
    scenes.forEach(S => {
      const card = S.root.querySelector('.card'); if (!card || S.def.h) return;
      const img = card.querySelector('img');
      const ih = img.naturalHeight * card.clientWidth / img.naturalWidth - (S.def.cropTop || 0) * card.clientWidth / img.naturalWidth;
      if (ih < card.clientHeight) { card.style.height = ih + 'px'; card.style.flex = '0 0 auto'; S.root.querySelector('.col').classList.remove('top'); }
    });
    document.querySelectorAll('.pill').forEach(p => {
      let fs = 62; p.style.fontSize = fs + 'px';
      while (p.getBoundingClientRect().width > 860 && fs > 30) { fs -= 2; p.style.fontSize = fs + 'px'; p.style.padding = '30px 48px'; }
    });
    window.__render(0);
    return { dur: V.dur, title: V.title };
  })();
})();
