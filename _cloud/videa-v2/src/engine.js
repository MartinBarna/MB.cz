/* Engine promo videí v2. Video = řada krátkých záběrů (1–2 s), střih s přechodem max 0,2 s.
   Všechno je čistá funkce času t: render.js volá window.__render(t) a snímá obrazovku. */
(function () {
  const id = new URLSearchParams(location.search).get('v');
  const V = window.VIDEOS[id];
  const stage = document.getElementById('stage');
  if (!V) { document.body.textContent = 'Neznámé video ' + id; return; }
  const Z = 870 / 390;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  const lerp = (a, b, p) => a + (b - a) * p;
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const ICONS = {
    barcode: '<path d="M3 7V4h3M18 4h3v3M21 17v3h-3M6 20H3v-3"/><path d="M7 8v8M10 8v8M12.5 8v8M15 8v8M17 8v8"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
    pot: '<path d="M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M2 10h20M9 6.5c0-1.2 1.2-1.2 1.2-2.5M14 6.5c0-1.2 1.2-1.2 1.2-2.5"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    dumbbell: '<path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
    doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/>',
    cert: '<circle cx="12" cy="9" r="5"/><path d="M9 13l-2 8 5-3 5 3-2-8"/>',
    plate: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
    chart: '<path d="M4 20V4M4 20h16M8 16v-3M12 16V8M16 16v-6"/>',
    play: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10 9l5 3-5 3z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6 6 0 0 1 3.5 5.8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 21v-5h-5"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    scale: '<path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>'
  };
  // titulek: [[zlatě]] , \n = zalomení; každé slovo samostatný span (animace slovo po slově)
  function capHTML(s) {
    let out = '', acc = false;
    String(s).split(/(\[\[|\]\]|\n)/).forEach(tok => {
      if (tok === '[[') { acc = true; return; } if (tok === ']]') { acc = false; return; } if (tok === '\n') { out += '<br>'; return; }
      tok.split(/(\s+)/).forEach(w => { if (!w) return; if (/^\s+$/.test(w)) out += ' '; else out += `<span class="wd${acc ? ' acc' : ''}">${w}</span>`; });
    });
    return out;
  }

  /* ── telefon a sekvence obrazovek ── */
  const phoneLayer = el('div', 'layer'); const pwrap = el('div', 'phonewrap'); const phone = el('div', 'phone'); const screen = el('div', 'screen');
  phone.appendChild(screen); pwrap.appendChild(phone); phoneLayer.appendChild(pwrap); stage.appendChild(phoneLayer);
  const seqs = {};
  Object.entries(V.seqs || {}).forEach(([k, s]) => {
    const ui = window.UI[s.type](s); ui.t0 = s.t0; ui.key = k; screen.appendChild(ui.el); ui.el.style.visibility = 'hidden';
    ui.tapEls = ui.taps.map(tp => { const r = el('div', 'tap'); ui.el.appendChild(r); return r; });
    seqs[k] = ui;
  });

  /* ── záběry ── */
  const shots = V.shots.map((s, i) => {
    const root = el('div', 'layer'); root.style.visibility = 'hidden'; stage.appendChild(root);
    const S = { def: s, root, i, a: s.t[0], b: s.t[1], kind: s.kind, anims: [] };
    const add = (e) => { root.appendChild(e); return e; };
    if (s.kind === 'phone') add(el('div', 'scrim'));
    if (s.kind === 'photo') {
      const ph = add(el('div', 'photo')); const im = el('img'); im.src = s.img; im.style.objectPosition = s.pos || '50% 20%';
      ph.appendChild(im); ph.appendChild(el('div', 'sh')); S.photoImg = im;
    }
    if (s.kind === 'pcard') {
      const c = add(el('div', 'pcard')); const im = el('img'); im.src = s.img; c.appendChild(im); c.style.top = (s.top || 760) + 'px'; S.pcard = c;
      if (s.h) { c.style.height = s.h + 'px'; im.style.height = '100%'; im.style.objectFit = 'cover'; im.style.objectPosition = s.pos || '50% 40%'; }
    }
    const big = (s.kind !== 'phone' && s.kind !== 'photo' && s.kind !== 'pcard' && s.kind !== 'end') ? add(el('div', 'big')) : null;
    if (big) {
      big.style.top = '250px'; big.style.bottom = '350px'; big.style.display = 'flex'; big.style.flexDirection = 'column'; big.style.justifyContent = 'center';
      if (s.kind === 'icon') { S.tile = el('div', 'icotile', `<svg viewBox="0 0 24 24">${ICONS[s.ico]}</svg>`); big.appendChild(S.tile);
        if (s.fx === 'wave') { S.wave = el('div', 'wave', Array.from({ length: 15 }, () => '<i></i>').join('')); big.insertBefore(S.wave, S.tile.nextSibling); }
        if (s.fx === 'flash') { S.flash = el('div', 'flash'); root.appendChild(S.flash); } }
      if (s.kind === 'type') { S.tbar = el('div', 'tbar'); big.appendChild(S.tbar); }
      if (s.kind === 'stat' && s.kick) { S.pre = el('div', 'cap chk cnt', capHTML(s.kick)); S.pre.style.position = 'static'; S.pre.style.marginBottom = '36px'; big.appendChild(S.pre); }
      if (s.kind === 'stat') { S.num = el('div', 'statn', s.num); big.appendChild(S.num); if (s.lab) { S.lab = el('div', 'statl chk cnt', s.lab); big.appendChild(S.lab); } }
      if (s.kind === 'step') { S.stepn = el('div', 'stepn', s.n); big.appendChild(S.stepn); }
      if (s.kind === 'quote') { S.qcard = el('div', 'qcard'); if (s.wave !== false) { S.wave = el('div', 'wave', Array.from({ length: 15 }, () => '<i></i>').join('')); S.qcard.appendChild(S.wave); } big.appendChild(S.qcard); }
      if (s.kind === 'bars') {
        S.bars = el('div', 'bars2'); s.bars.forEach(b => { const r = el('div', 'b2', `<div class="bn cnt chk">${b.n}</div><div class="track"><div class="fill" style="background:${b.c}"></div></div><div class="tag cnt chk" style="color:${b.c}">${b.tag}</div>`); S.bars.appendChild(r); });
        big.appendChild(S.bars); S.fills = [...S.bars.querySelectorAll('.fill')]; }
      if (s.kind === 'list') {
        S.items = s.items.map(txt => { const d = el('div', 'cap chk cnt', capHTML(txt)); d.style.position = 'absolute'; d.style.left = '0'; d.style.right = '0'; return d; });
        const box = el('div'); box.style.position = 'relative'; box.style.height = '260px'; S.items.forEach(d => box.appendChild(d)); big.appendChild(box);
        if (s.dots !== false) { S.dots = el('div', 'dots', s.items.map(() => '<i></i>').join('')); big.appendChild(S.dots); }
      }
    }
    if (s.kick && s.kind !== 'stat') { S.kick = add(el('div', 'kick chk cnt', s.kick)); }
    if (s.cap) {
      S.cap = el('div', 'cap chk cnt', capHTML(s.cap));
      if (S.qcard) { S.cap.style.position = 'static'; S.cap.style.fontSize = '96px'; S.qcard.appendChild(S.cap); }
      else if (big && s.kind !== 'list') { S.cap.style.position = 'static'; big.appendChild(S.cap); if (s.kind === 'icon' || s.kind === 'step') S.cap.style.marginTop = '0'; if (s.kind === 'type') S.cap.style.fontSize = '158px'; }
      else if (big && s.kind === 'list') { S.cap.style.position = 'static'; S.cap.style.fontSize = '84px'; S.cap.style.color = 'var(--acc)'; S.cap.style.marginBottom = '50px'; big.insertBefore(S.cap, big.firstChild); }
      else add(S.cap);
      S.words = [...S.cap.querySelectorAll('.wd')];
    }
    if (s.sub) { S.sub = el('div', 'kick chk cnt', capHTML(s.sub)); S.sub.style.color = 'var(--warm)'; S.sub.style.fontSize = '50px'; S.sub.style.fontWeight = '600';
      if (big) { S.sub.style.position = 'static'; S.sub.style.marginTop = '34px'; big.appendChild(S.sub); } else add(S.sub); }
    if (s.kind === 'end') {
      const e = add(el('div', 'end'));
      e.innerHTML = `<img class="logo" src="/assets/brand/mb-mark-gold.png"><div class="prod chk">${s.prod}</div><div class="price chk">${s.price}</div>`
        + (s.unit ? `<div class="unit chk">${s.unit}</div>` : '') + (s.note ? `<div class="note chk">${capHTML(s.note).replace(/<span class="wd( acc)?">/g, (m, a) => a ? '<span class="acc">' : '<span>')}</div>` : '')
        + `<div class="btn chk">${s.btn}</div><div class="url chk">${s.url}</div>`;
      S.endEls = [...e.children]; S.btn = e.querySelector('.btn');
      S.ripple = el('div', 'tap'); S.ripple.style.position = 'absolute'; S.btn.style.position = 'relative'; S.btn.style.overflow = 'hidden'; S.btn.appendChild(S.ripple);
    }
    return S;
  });

  const g1 = stage.querySelector('.glow.g1'), g2 = stage.querySelector('.glow.g2');
  function bg(t) {
    g1.style.transform = `translate(${-460 + 160 * Math.sin(t * .5)}px, ${-300 + 120 * Math.cos(t * .37)}px)`;
    g2.style.transform = `translate(${240 + 120 * Math.cos(t * .41)}px, ${1000 + 140 * Math.sin(t * .33)}px)`;
  }

  // kamera: fy = bod obrazovky appky (app px), který má být na y = sy (px videa); s = měřítko telefonu (1 = 900 px široký)
  function camOf(c, seq) {
    let fy = c.fy, fx = c.fx;
    if (c.a && seq && seq.anch[c.a]) { const A = seq.anch[c.a]; fy = (fy ?? 0) + A.y + (c.at === 'top' ? 0 : c.at === 'bottom' ? A.h : A.h / 2); }
    return { fy: fy ?? 300, fx: fx ?? 195, sy: c.sy ?? 1100, s: c.s ?? 1 };
  }
  function drift(c, d, p) { if (!d) return c; return { fy: c.fy, fx: c.fx, sy: c.sy + (d.sy || 0) * p, s: c.s + (d.s || 0) * p }; }
  function applyCam(c) {
    const left = 540 - (15 + c.fx * Z) * c.s, top = c.sy - (15 + c.fy * Z) * c.s;
    phone.style.transform = `translate(${left}px, ${top}px) scale(${c.s})`;
  }

  function showSeq(seq, x, tSeq) {
    seq.el.style.visibility = 'visible'; seq.el.style.transform = `translateX(${x}px)`;
    seq.state(tSeq);
    seq.taps.forEach((tp, k) => {
      const r = seq.tapEls[k], A = seq.anch['__tap' + k]; const p = (tSeq - tp.at) / .38;
      if (!A || p < 0 || p > 1) { r.style.opacity = 0; if (A && A.node) A.node.style.transform = ''; return; }
      const R = 10 + 46 * easeOut(p); r.style.width = r.style.height = 2 * R + 'px';
      r.style.left = (A.x + A.w / 2 - R) + 'px'; r.style.top = (A.y + A.h / 2 - R) + 'px'; r.style.opacity = (1 - p) * .9;
      if (A.node) A.node.style.transform = p < .3 ? 'scale(.95)' : '';
    });
  }

  let lastShot = -1;
  window.__render = function (t) {
    bg(t);
    let i = shots.findIndex(S => t >= S.a && t < S.b); if (i < 0) i = shots.length - 1;
    const S = shots[i], P = shots[i - 1], lt = t - S.a;
    shots.forEach(x => { x.root.style.visibility = x === S ? 'visible' : 'hidden'; });
    // přechod záběru: zoom 0,15 s (nový druh záběru), u telefonu kamera 0,2 s
    const kindChange = i > 0 && (!P || P.kind !== S.kind || S.kind !== 'phone');
    const pz = i === 0 ? 1 : easeOut(clamp(lt / .15));
    S.root.style.opacity = (i === 0 || S.kind === 'end') ? 1 : (kindChange ? clamp(.45 + lt / .1) : 1);
    S.root.style.transform = (i === 0 || !kindChange) ? '' : `scale(${1.06 - .06 * pz})`;
    S.root.style.transformOrigin = '50% 45%';
    // telefon
    Object.values(seqs).forEach(q => q.el.style.visibility = 'hidden');
    if (S.kind === 'phone') {
      phoneLayer.style.visibility = 'visible';
      const seq = seqs[S.def.seq]; const dp = clamp(lt / (S.b - S.a)); let cam = drift(camOf(S.def.cam || {}, seq), (S.def.cam || {}).d, dp);
      if (P && P.kind === 'phone') {
        const pc = drift(camOf(P.def.cam || {}, seqs[P.def.seq]), (P.def.cam || {}).d, 1); const p = easeOut(clamp(lt / .2));
        cam = { fy: lerp(pc.fy, cam.fy, p), fx: lerp(pc.fx, cam.fx, p), sy: lerp(pc.sy, cam.sy, p), s: lerp(pc.s, cam.s, p) };
        phoneLayer.style.opacity = 1; phoneLayer.style.transform = '';
        if (P.def.seq !== S.def.seq && (V.seqs[P.def.seq] || {}).type !== (V.seqs[S.def.seq] || {}).type) { const pp = easeOut(clamp(lt / .18)); showSeq(seqs[P.def.seq], -390 * pp, t - seqs[P.def.seq].t0); showSeq(seq, 390 * (1 - pp), t - seq.t0); }
        else showSeq(seq, 0, t - seq.t0);
      } else {
        phoneLayer.style.opacity = i === 0 ? 1 : clamp(.45 + lt / .1);
        phoneLayer.style.transform = i === 0 ? '' : `translateY(${(1 - pz) * 120}px)`;
        showSeq(seq, 0, t - seq.t0);
      }
      applyCam(cam);
    } else phoneLayer.style.visibility = 'hidden';
    // titulky slovo po slově (háček v 0 s je celý vidět hned: funguje jako náhled)
    const inst = S.def.instant || i === 0;
    if (S.words) S.words.forEach((w, k) => { const p = inst ? 1 : clamp(.25 + (lt - k * .06) / .14); w.style.opacity = p; w.style.transform = `translateY(${(1 - easeOut(p)) * 24}px)`; });
    if (S.kick) S.kick.style.opacity = inst ? 1 : clamp(lt / .12);
    if (S.sub) { const p = inst ? 1 : clamp((lt - .25) / .15); S.sub.style.opacity = p; }
    // obsah záběru
    if (S.tbar) { const p = easeOut(clamp(lt / .22)); S.tbar.style.width = (40 + 120 * p) + 'px'; }
    if (S.tile) { const p = easeOut(clamp(lt / .2)); S.tile.style.transform = `scale(${.7 + .3 * p}) rotate(${(1 - p) * -8}deg)`; }
    if (S.wave) [...S.wave.children].forEach((b, j) => { b.style.height = (16 + 90 * clamp((lt - .1) / .2) * Math.abs(Math.sin(lt * 9 + j * .7) * Math.sin(lt * 3.1 + j * .33))) + 'px'; });
    if (S.flash) { const p = clamp((lt - (S.def.flashAt ?? .35)) / .22); S.flash.style.opacity = p > 0 && p < 1 ? (1 - p) * .55 : 0; }
    if (S.num) { const p = inst ? 1 : easeOut(clamp(lt / .2)); S.num.style.transform = `scale(${1.25 - .25 * p})`; S.num.style.opacity = inst ? 1 : clamp(.55 + lt / .1); }
    if (S.lab) S.lab.style.opacity = inst ? 1 : clamp(.3 + (lt - .1) / .12);
    if (S.qcard) { const p = inst ? 1 : easeOut(clamp(lt / .18)); S.qcard.style.transform = `scale(${.9 + .1 * p})`; }
    if (S.fills) S.fills.forEach((f, j) => { f.style.width = (100 * S.def.bars[j].p * easeOut(clamp((lt - .1 - j * .15) / .5))) + '%'; });
    if (S.stepn) { const p = easeOut(clamp(lt / .18)); S.stepn.style.transform = `scale(${.6 + .4 * p})`; }
    if (S.items) {
      const each = S.def.each || .5; const k = Math.min(S.items.length - 1, Math.floor(lt / each));
      S.items.forEach((d, j) => { const pl = j === k ? easeOut(clamp((lt - j * each) / .14)) : 0; d.style.opacity = j === k ? clamp(.4 + (lt - j * each) / .08) : 0; d.style.transform = `translateX(${(1 - pl) * 80}px)`; d.style.display = j === k ? '' : 'none'; });
      if (S.dots) [...S.dots.children].forEach((d, j) => d.className = j <= k ? 'on' : '');
    }
    if (S.photoImg) { const z = S.def.zoom || 1; S.photoImg.style.transformOrigin = S.def.origin || '60% 25%'; S.photoImg.style.transform = `scale(${z * (1.08 - .06 * clamp(lt / (S.b - S.a)))})`; }
    if (S.pcard) S.pcard.style.transform = `scale(${1.04 - .04 * clamp(lt / (S.b - S.a))})`;
    if (S.endEls) {
      S.endEls.forEach((e, k) => { const p = easeOut(clamp((lt - k * .05) / .16)); e.style.opacity = clamp(.7 + lt / .1); e.style.transform = `translateY(${(1 - p) * 30}px)`; });
      const tp = S.def.tapAt ?? .9, p = (lt - tp) / .4;
      if (p >= 0 && p <= 1) { const R = 30 + 260 * easeOut(p); Object.assign(S.ripple.style, { width: 2 * R + 'px', height: 2 * R + 'px', left: `calc(50% - ${R}px)`, top: `calc(50% - ${R}px)`, opacity: (1 - p) * .6 }); S.btn.style.transform = p < .25 ? 'scale(.96)' : ''; }
      else S.ripple.style.opacity = 0;
    }
    lastShot = i;
  };

  // události pro zvuk: jen ty, které padnou do záběru, kde je jejich obrazovka vidět
  function events() {
    const out = [];
    Object.values(seqs).forEach(q => {
      const evs = q.events.concat(q.taps.map(tp => ({ t: tp.at, type: 'tap' })));
      evs.forEach(e => { const T = q.t0 + e.t; const S = shots.find(x => T >= x.a && T < x.b); if (S && S.kind === 'phone' && S.def.seq === q.key) out.push({ t: +T.toFixed(3), type: e.type }); });
    });
    shots.forEach(S => {
      if (S.kind === 'end') out.push({ t: +(S.a + (S.def.tapAt ?? .9)).toFixed(3), type: 'tap' });
      if (['stat', 'icon', 'step', 'quote', 'bars'].includes(S.kind)) out.push({ t: S.a, type: 'tick' });
      if (S.def.fx === 'flash') out.push({ t: +(S.a + (S.def.flashAt ?? .35)).toFixed(3), type: 'shutter' });
      if (S.kind === 'list') S.def.items.forEach((_, j) => out.push({ t: +(S.a + j * (S.def.each || .5)).toFixed(3), type: 'tick' }));
    });
    return out.sort((a, b) => a.t - b.t);
  }

  // kontrola: text v bezpečné zóně, nic nepřetéká, max 6 slov titulků na obrazovce (mimo závěrečnou kartu)
  window.__check = function (label) {
    const out = []; const S = shots.find(x => x.root.style.visibility === 'visible'); if (!S) return out;
    if (S.root.style.transform && S.root.style.transform !== 'scale(1)') return out;   // měří se až po doběhnutí přechodu
    S.root.querySelectorAll('.chk').forEach(e => {
      if (getComputedStyle(e).visibility === 'hidden' || +getComputedStyle(e).opacity < .99) return;
      const r = e.getBoundingClientRect(); if (r.width === 0) return;
      const txt = (e.textContent || '').trim().slice(0, 40);
      if (!e.querySelector('.wd') && (r.top < 249.5 || r.bottom > 1570.5)) out.push(`${label}: Y mimo zónu (${Math.round(r.top)}-${Math.round(r.bottom)}) "${txt}"`);
      if (!e.querySelector('.wd') && (r.left < 59.5 || r.right > 1020.5)) out.push(`${label}: X mimo (${Math.round(r.left)}-${Math.round(r.right)}) "${txt}"`);
      e.querySelectorAll('.wd').forEach(w => { const q = w.getBoundingClientRect(); if (q.top < 249.5 || q.bottom > 1570.5) out.push(`${label}: slovo mimo Y "${w.textContent}"`); });
      if (!e.querySelector(".tap") && e.scrollWidth > e.clientWidth + 2) out.push(`${label}: přetéká "${txt}"`);
      e.querySelectorAll('.wd').forEach(w => { const q = w.getBoundingClientRect(); if (q.right > 1020.5 || q.left < 59.5) out.push(`${label}: slovo mimo "${w.textContent}"`); });
    });
    if (S.kind !== 'end') {
      let n = 0; S.root.querySelectorAll('.cnt').forEach(e => { if (getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > .5) n += (e.textContent.trim().match(/\S+/g) || []).length; });
      if (n > 6) out.push(`${label}: ${n} slov na obrazovce`);
    }
    return out;
  };

  window.__ready = (async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(i => i.decode ? i.decode().catch(() => {}) : null));
    // kotvy kamery a ťuknutí v souřadnicích appky (měřeno s telefonem v klidu)
    phone.style.transform = 'translate(0px,0px) scale(1)';
    Object.values(seqs).forEach(q => {
      q.el.style.visibility = 'visible'; q.state(99);
      const base = q.el.getBoundingClientRect(); const k = base.width / 390;
      const m = (node) => { const r = node.getBoundingClientRect(); return { x: (r.left - base.left) / k, y: (r.top - base.top) / k, w: r.width / k, h: r.height / k, node }; };
      q.anch = {};
      Object.entries(q.anchors || {}).forEach(([n, sel]) => { const node = q.el.querySelector(sel); if (node) q.anch[n] = m(node); });
      q.taps.forEach((tp, j) => { const node = q.el.querySelector(tp.sel); if (node) q.anch['__tap' + j] = m(node); });
      q.el.style.visibility = 'hidden';
    });
    // titulky: max 2 řádky u telefonu (jinak menší písmo), umístění do horního pásu 270-560
    shots.forEach(S => layoutShot(S));
    function layoutShot(S) {
      S.root.style.visibility = 'visible';
      const fit = (e, maxLines, min) => { if (!e) return; let fs = parseFloat(getComputedStyle(e).fontSize);
        while (e.getBoundingClientRect().height > fs * 1.0 * maxLines + 4 && fs > min) { fs -= 4; e.style.fontSize = fs + 'px'; } };
      if (S.kind === 'phone') { fit(S.cap, 2, 72); const hgt = S.cap ? S.cap.getBoundingClientRect().height : 0; const kh = S.kick ? 60 : 0;
        const top = Math.max(270 + kh, 410 - hgt / 2 + kh / 2); if (S.cap) S.cap.style.top = top + 'px'; if (S.kick) S.kick.style.top = (top - 62) + 'px'; }
      if (S.kind === 'photo' || S.kind === 'pcard') { fit(S.cap, 3, 72); const hgt = S.cap ? S.cap.getBoundingClientRect().height : 0;
        if (S.kind === 'photo') { if (S.cap) S.cap.style.top = (1540 - hgt - (S.sub ? 80 : 0)) + 'px'; if (S.sub) S.sub.style.top = (1550 - 66) + 'px'; }
        else { if (S.cap) S.cap.style.top = Math.max(270, 410 - hgt / 2) + 'px'; if (S.sub) S.sub.style.top = '1420px'; } }
      if (['type', 'icon', 'stat', 'step', 'list', 'quote', 'bars'].includes(S.kind)) { fit(S.cap, 3, S.kind === 'type' ? 104 : 72); (S.items || []).forEach(d => fit(d, 2, 72)); }
      if (S.kick && S.kind !== 'phone') S.kick.style.top = '270px';
      S.root.style.visibility = 'hidden';
    }
    // samostatný cover: vizuál úvodního záběru + schválený titulek coveru + štítek produktu a ceny
    window.__cover = function () {
      const c = V.cover; if (!c) return false; const S = shots[c.shot || 0];
      if (S.kick) { S.kick.remove(); S.kick = null; }
      if (c.kick) { S.kick = el('div', 'kick chk cnt', c.kick); S.root.appendChild(S.kick); }
      if (!S.cap) { S.cap = el('div', 'cap chk cnt'); S.root.appendChild(S.cap); }
      S.cap.innerHTML = capHTML(c.cap); if (S.kind !== 'type') S.cap.style.fontSize = ''; S.words = [...S.cap.querySelectorAll('.wd')];
      layoutShot(S);
      const chip = el('div', 'coverchip', capHTML(c.chip)); S.root.appendChild(chip);
      S.root.style.visibility = 'visible';
      const r = S.cap.getBoundingClientRect(), k = stage.getBoundingClientRect().width / 1080;
      chip.style.top = ((r.bottom - stage.getBoundingClientRect().top) / k + 34) + 'px';
      const t = S.a + Math.min(c.at ?? .95, (S.b - S.a) - .05); window.__render(t);
      S.words.forEach(w => { w.style.opacity = 1; w.style.transform = ''; }); return true;
    };
    window.__events = events();
    window.__render(0);
    return { dur: V.dur, shots: shots.length };
  })();
})();
