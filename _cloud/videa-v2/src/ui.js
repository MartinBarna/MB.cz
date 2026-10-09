/* UI appky Tvůj Coach a Barna Academy postavené znovu v HTML/CSS (v rozlišení videa, ne ze zvětšených screenshotů).
   Obsah a čísla jsou DOSLOVA ze screenshotů v assets/app/ a assets/screeny/academy/.
   Vynecháno: oslovení „ahoj, Petra“ (demo jméno) a zrušený odznak „Ověřeno Martinem“.
   Každá obrazovka: { el, state(t), taps:[{at,sel}], events:[{t,type}] }, t = čas od začátku sekvence (s). */
(function () {
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  const h = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
  const ICO = {
    home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
    food: '<path d="M8 3v8M5.5 3v5a2.5 2.5 0 0 0 5 0V3M8 11v10"/><path d="M16.5 3c-2 2-2 6 0 8v10"/>',
    gym: '<path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5h4"/>',
    star: '<path d="M12 3.5l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.8l6-.7z"/>'
  };
  const svg = (k, cls) => `<svg viewBox="0 0 24 24" ${cls ? `class="${cls}"` : ''}>${ICO[k]}</svg>`;
  const nav = (on) => `<div class="nav">${[['home', 'Dnes'], ['food', 'Jídlo'], ['gym', 'Trénink'], ['spark', 'AI Coach'], ['user', 'Profil']]
    .map(([k, l]) => `<div class="${l === on ? 'on' : ''}">${svg(k)}<span>${l}</span></div>`).join('')}</div>`;
  // rozdělí HTML text na slova (spany .w), zachová <b>
  function words(html) {
    return html.replace(/(<b>.*?<\/b>)|([^\s<]+)/g, (m, b, w) => b ? `<span class="w">${b}</span>` : `<span class="w">${w}</span>`);
  }
  function typeEvents(at, text, cps) { const ev = []; for (let i = 0; i < text.length; i++) if (text[i] !== ' ') ev.push({ t: at + i / cps, type: 'key' }); return ev; }

  const S = {};

  /* ── AI Coach chat (assets/app/ai-kouc.png) ── */
  S.chat = (o) => {
    const q = o.text || 'Kolik mi dnes zbývá?';
    const ans = 'Dnes máš zapsáno 1118 kcal, takže ti zbývá <b>82 kcal.</b> Bílkoviny: 114 g z 126 g (zbývá cca 12 g), vláknina: 9 g z 17 g (zbývá cca 8 g).';
    const ans2 = 'Jsi skoro na stropu, spíš něco lehkého s bílkovinou a vlákninou, třeba zelenina + trocha tvarohu. Be Effective';
    const el = h(`<div class="app"><div class="chat">
      <div class="a-h1" style="font-size:26px">AI Coach</div>
      <div class="hint">Napiš mi normálně: „zaloguj rohlík a tvaroh“, „vážím 84,2“, „kolik mi zbývá?“</div>
      <div class="cmsgs"><div class="bub-u">${q}</div>
      <div class="bub-a"><div>${words(ans)}</div><div style="margin-top:14px">${words(ans2)}</div></div></div>
    </div>
    ${nav('AI Coach')}
    <div class="kb">${['qwertzuiop', 'asdfghjkl', 'yxcvbnm'].map((r, i) => `<div class="kr">${i === 2 ? '<span class="k w15">⇧</span>' : ''}${[...r].map(c => `<span class="k" data-k="${c}">${c}</span>`).join('')}${i === 2 ? '<span class="k w15">⌫</span>' : ''}</div>`).join('')}
      <div class="kr"><span class="k w2">123</span><span class="k sp" data-k=" ">mezera</span><span class="k w2">↵</span></div></div>
    <div class="cbar"><div class="cbtn">${svg('cam')}</div><div class="cbtn">${svg('mic')}</div>
      <div class="cin"><span class="tx">Napiš Coachovi…</span><span class="caret"></span></div><div class="csend">${svg('send')}</div></div></div>`);
    const tx = el.querySelector('.cin .tx'), cin = el.querySelector('.cin'), caret = el.querySelector('.caret');
    const ub = el.querySelector('.bub-u'), ab = el.querySelector('.bub-a'), ws = [...el.querySelectorAll('.bub-a .w')];
    const kb = el.querySelector('.kb'), bar = el.querySelector('.cbar'), msgs = el.querySelector('.cmsgs'), keys = {}; el.querySelectorAll('.kb .k[data-k]').forEach(k => keys[k.dataset.k] = k);
    const plain = c => c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const typeAt = o.typeAt ?? .3, cps = o.cps ?? 16, sendAt = o.sendAt ?? (typeAt + q.length / cps + .25);
    const ansAt = o.ansAt ?? (sendAt + .45), wps = o.wps ?? 16;
    return {
      el,
      taps: [{ at: sendAt, sel: '.csend' }],
      events: [...typeEvents(typeAt, q, cps), { t: sendAt + .08, type: 'pop' }, { t: ansAt, type: 'pop' }],
      anchors: { input: '.cin', q: '.bub-u', ans: '.bub-a', bold: '.bub-a b', hint: '.hint' },
      state(t) {
        const n = Math.floor(clamp((t - typeAt) * cps, 0, q.length));
        const sent = t >= sendAt + .08;
        // klávesnice otevřená během psaní, po odeslání sjede dolů (0,2 s)
        const kbOpen = 1 - easeOut(clamp((t - sendAt - .1) / .2));
        kb.style.transform = `translateY(${(1 - kbOpen) * 100}%)`;
        const barB = 84 + (380 + 8 - 84) * kbOpen; bar.style.bottom = barB + 'px';
        // zprávy jsou přilepené nad vstupním polem jako v appce (žádná prázdná spodní polovina)
        msgs.style.bottom = (barB + 66 + 16) + 'px';
        Object.values(keys).forEach(k => k.classList.remove('on'));
        const ti = (t - typeAt) * cps; if (ti >= 0 && ti < q.length && ti - Math.floor(ti) < .55) { const c = plain(q[Math.floor(ti)]); if (keys[c]) keys[c].classList.add('on'); }
        if (t < typeAt || sent) { tx.textContent = 'Napiš Coachovi…'; cin.classList.remove('typed'); caret.style.display = 'none'; }
        else { tx.textContent = q.slice(0, n); cin.classList.add('typed'); caret.style.display = (Math.floor(t * 2.4) % 2 && n >= q.length) ? 'none' : 'inline-block'; }
        const pu = clamp((t - sendAt - .08) / .18);
        ub.style.opacity = pu; ub.style.transform = `translateY(${(1 - easeOut(pu)) * 16}px) scale(${.92 + .08 * easeOut(pu)})`;
        const pa = clamp((t - ansAt) / .18);
        ab.style.opacity = pa; ab.style.transform = `translateY(${(1 - easeOut(pa)) * 16}px)`; ab.style.display = t >= ansAt ? '' : 'none';
        ub.style.display = sent ? '' : 'none';
        const k = (t - ansAt) * wps;
        ws.forEach((w, i) => { const p = clamp(k - i); w.style.opacity = p; w.style.display = p > 0 ? '' : 'none'; });
      }
    };
  };

  /* ── Dnes (assets/app/dnes.webp), bez demo jména ── */
  S.dnes = (o) => {
    const el = h(`<div class="app"><div class="dnes">
      <div class="a-h1">Dnes</div><div class="sub a-mut">pátek 31. 7.</div>
      <div class="badges"><div class="badge">⭐ 10 b</div><div class="badge">🔥 1 den v řadě</div></div>
      <div class="a-card coach"><div class="ava"><span>😊</span></div><div><b>Jedeš dobře. Drž se plánu.</b><small>💎 Chat s Coachem je součást VIP</small></div></div>
      <div class="checkin">${svg('clock')}<div>Check-in za 7 dní. Do té doby zapisuj, ať mám z čeho počítat.</div></div>
      <div class="actrow"><div class="gbtn">+ Zapsat jídlo</div><div class="sq">🎤</div><div class="sq">📷</div></div>
      <div class="a-card kal"><div class="t"><b>Kalorie</b><div class="tog"><span class="on">Den</span><span>Týden</span></div></div>
        <div class="ring"><svg viewBox="0 0 230 230"><circle cx="115" cy="115" r="96" fill="none" stroke="#3b3020" stroke-width="22"/>
          <circle cx="115" cy="115" r="96" fill="none" stroke="#2a2433" stroke-width="16"/>
          <circle class="arc" cx="115" cy="115" r="96" fill="none" stroke="#F0BB3E" stroke-width="16" stroke-linecap="round" transform="rotate(-90 115 115)"/></svg>
          <div class="in"><div class="zb">ZBÝVÁ</div><div class="num">173</div><div class="of">1450 / 1623 kcal</div></div></div>
      </div></div>
      <div class="aipill">AI Coach</div>${nav('Dnes')}</div>`);
    const arc = el.querySelector('.arc'), num = el.querySelector('.num'), of = el.querySelector('.of');
    const C = 2 * Math.PI * 96, at = o.ringAt ?? .2, dur = o.ringDur ?? .9;
    arc.style.strokeDasharray = C;
    return {
      el, taps: o.taps || [], events: [], anchors: { ring: '.ring', head: '.a-h1', checkin: '.checkin', act: '.actrow' },
      state(t) {
        const p = easeOut(clamp((t - at) / dur));
        const eaten = Math.round(1450 * p);
        arc.style.strokeDashoffset = C * (1 - (1450 / 1623) * p);
        num.textContent = String(1623 - eaten);
        of.textContent = `${eaten} / 1623 kcal`;
      }
    };
  };

  /* ── Logování (assets/app/zapis-jidla.webp, verze bez odznaku) ── */
  S.log = (o) => {
    const q = o.query || 'kuřecí prsa';
    const rows = [['Kuřecí prsa', '120 kcal/100 g · + zapíše 100 g'], ['Kuřecí prsa grilovaná', '165 kcal/100 g · + zapíše 100 g'],
      ['Kuřecí prsa syrové', '106 kcal/100 g · + zapíše 100 g'], ['Apetisimo – Kuřecí prsa tikka', '452 kcal/100 g · + zapíše 100 g']];
    const el = h(`<div class="app"><div class="log">
      <div class="a-h1">Logování</div>
      <div class="a-card datec"><i>‹</i><span>Dnes</span><i>›</i></div>
      <div class="a-card srch"><h3>Najít potravinu</h3><label>Název</label><div class="inp"><span class="tx"></span><span class="caret"></span></div>
        <div class="gbtn hledat">Hledat</div>
        <div class="res">${rows.map(r => `<div class="rrow"><div class="tx"><b>${r[0]}</b><small>${r[1]}</small></div>
          <svg class="star" viewBox="0 0 24 24" fill="none" stroke="#EBB12C" stroke-width="1.6" stroke-linejoin="round">${ICO.star}</svg><div class="plus">+</div></div>`).join('')}</div>
      </div></div><div class="aipill">AI Coach</div>${nav('Jídlo')}</div>`);
    const tx = el.querySelector('.inp .tx'), caret = el.querySelector('.inp .caret'), rr = [...el.querySelectorAll('.rrow')];
    const typeAt = o.typeAt ?? .2, cps = o.cps ?? 14, tapAt = o.tapAt ?? (typeAt + q.length / cps + .2), resAt = o.resAt ?? (tapAt + .25), st = o.stagger ?? .09;
    const taps = [{ at: tapAt, sel: '.hledat' }]; if (o.plusAt) taps.push({ at: o.plusAt, sel: '.rrow .plus' });
    return {
      el, taps, events: [...typeEvents(typeAt, q, cps), ...rr.map((_, i) => ({ t: resAt + i * st, type: 'tick' }))],
      anchors: { input: '.inp', btn: '.hledat', res: '.res', first: '.rrow' },
      state(t) {
        const n = Math.floor(clamp((t - typeAt) * cps, 0, q.length));
        tx.textContent = q.slice(0, n);
        caret.style.display = (t < tapAt && Math.floor(t * 2.4) % 2 === 0) ? 'inline-block' : 'none';
        rr.forEach((r, i) => { const p = clamp((t - resAt - i * st) / .16); r.style.opacity = p; r.style.transform = `translateY(${(1 - easeOut(p)) * 18}px)`; });
      }
    };
  };

  /* ── Generátor jídelníčku (assets/app/generator-jidelnicku.png) ── */
  S.gen = (o) => {
    const rows = [['Šunka od kosti (nejvyšší jakost)', '70 g · 77 kcal · 14,0 g B'], ['Skyr bílý', '155 g · 98 kcal · 17,1 g B'],
      ['Chléb pšenično-žitný', '40 g · 100 kcal · 3,2 g B'], ['Rajče', '90 g · 16 kcal · 0,8 g B'], ['Banán', '70 g · 62 kcal · 0,8 g B'], ['Řepkový olej', '11 g · 97 kcal · 0,0 g B']];
    const el = h(`<div class="app"><div class="ghead"><i>‹ Zpět</i><span>Generátor jídelníčku</span></div>
      <div class="a-card gcard"><div class="t"><b>Snídaně</b><span>450 kcal</span></div>
      ${rows.map(r => `<div class="grow"><div class="tx"><b>${r[0]}</b><small>${r[1]}</small></div><div class="jine">⇄ Jiné</div><div class="nejim">nejím</div></div>`).join('')}
      </div><div class="aipill">AI Coach</div>${nav('')}</div>`);
    const gr = [...el.querySelectorAll('.grow')], at = o.rowsAt ?? .1, st = o.stagger ?? .1;
    const taps = o.tapAt ? [{ at: o.tapAt, sel: '.grow .jine' }] : [];
    return {
      el, taps, events: gr.map((_, i) => ({ t: at + i * st, type: 'tick' })), anchors: { card: '.gcard', first: '.grow', last: '.grow:last-child' },
      state(t) { gr.forEach((r, i) => { const p = clamp((t - at - i * st) / .16); r.style.opacity = p; r.style.transform = `translateX(${(1 - easeOut(p)) * 30}px)`; }); }
    };
  };

  /* ── Generátor tréninků (assets/app/generator-treninku.png, fotky cviků z assets/cviky) ── */
  S.workout = (o) => {
    const rows = [['Tlaky s jednoručkami na lavici', '4 série × 8–12 opak.', 'bench-press-jednorucky'], ['Tlak na ramena na stroji', '4 série × 8–12 opak.', 'tlak-na-stroji-ramena'],
      ['Krčení ramen s jednoručkami (shrugy)', '3 série × 10–15 opak.', 'shrugy-cinky'], ['Stahování kladky na triceps', '3 série × 10–15 opak.', 'triceps-stahovani-kladka'],
      ['Stahování na peck-deck stroji', '3 série × 10–15 opak.', 'peck-deck']];
    const el = h(`<div class="app"><div class="ghead"><i>‹ Zpět</i><span>Generátor tréninků</span></div>
      <div class="a-card gcard" style="padding-top:14px"><div style="font-size:19px;font-weight:700;padding-bottom:10px;border-bottom:1px solid var(--a-line)">Push (tlaky)</div>
      ${rows.map(r => `<div class="wrow"><img src="/assets/cviky/${r[2]}.jpg"><div class="tx"><b>${r[0]}</b><small>${r[1]}</small></div><i>Zapsat ›</i></div>`).join('')}
      </div>${nav('Trénink')}</div>`);
    const wr = [...el.querySelectorAll('.wrow')], at = o.rowsAt ?? .1, st = o.stagger ?? .1;
    const taps = o.tapAt ? [{ at: o.tapAt, sel: '.wrow i' }] : [];
    return {
      el, taps, events: wr.map((_, i) => ({ t: at + i * st, type: 'tick' })), anchors: { card: '.gcard', first: '.wrow' },
      state(t) { wr.forEach((r, i) => { const p = clamp((t - at - i * st) / .16); r.style.opacity = p; r.style.transform = `translateX(${(1 - easeOut(p)) * 30}px)`; }); }
    };
  };

  /* ── Sken čárového kódu: ilustrace hledáčku (screenshot skeneru není, UI appky nenapodobuje) ── */
  S.scan = (o) => {
    let bars = ''; let x = 0; const wds = [3, 1, 2, 1, 3, 1, 1, 2, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 1, 1, 3, 2, 1];
    wds.forEach((w, i) => { if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${w * 2}" height="80" fill="#111"/>`; x += w * 2 + 1.2; });
    const el = h(`<div class="app"><div class="scan"></div>
      <div class="pack"><div class="lbl"><svg class="bars" viewBox="0 0 ${x} 80" preserveAspectRatio="none">${bars}</svg></div></div>
      <div class="bracket"><i></i><i></i><i></i><i></i><div class="sline"></div></div></div>`);
    const br = el.querySelector('.bracket'), sl = el.querySelector('.sline'), at = o.at ?? 0, lockAt = o.lockAt ?? 1.0;
    return {
      el, taps: [], events: [{ t: lockAt, type: 'pop' }], anchors: { frame: '.bracket' },
      state(t) {
        const y = 10 + 196 * (0.5 + 0.5 * Math.sin((t - at) * 5.5 - 1.5));
        sl.style.top = y + 'px';
        const p = easeOut(clamp((t - lockAt) / .18));
        br.style.transform = `scale(${1.12 - .12 * p})`;
        br.querySelectorAll('i').forEach(i => i.style.borderColor = p > .5 ? '#7bd88f' : '#EBB12C');
        sl.style.opacity = 1 - p;
      }
    };
  };

  /* ── Academy: generátor jídelníčku (assets/screeny/academy/03-generator-cz-mobil.webp) ── */
  S.akgen = (o) => {
    const el = h(`<div class="app ak"><div class="akh"><div class="l"><div class="mb">MB</div><div><b>Barna<br>Academy</b><div class="mono">GENERÁTOR<br>JÍDELNÍČKŮ</div></div></div>
      <div class="r">← Seznam nástrojů<br>Moje sekce</div></div>
      <div class="akcard"><h4>Denní jídelníček</h4><div class="c">· cíl: Mírné hubnutí</div>
      <div class="tiles"><div class="tile"><b>2143</b><span>KCAL / DEN</span></div><div class="tile"><b>152 g</b><span>BÍLKOVINY</span></div>
      <div class="tile"><b>233 g</b><span>SACHARIDY</span></div><div class="tile"><b>67 g</b><span>TUKY</span></div><div class="tile w"><b>30 g</b><span>VLÁKNINA</span></div></div>
      <div class="meal"><div class="h">Snídaně<span>655 kcal</span></div><div class="r"><span>Dušená šunka výběrová</span><em>60 g</em><em>75 kcal</em></div></div>
      </div></div>`);
    const tl = [...el.querySelectorAll('.tile')], meal = el.querySelector('.meal'), at = o.tilesAt ?? .1, st = o.stagger ?? .1;
    return {
      el, taps: [], events: [...tl.map((_, i) => ({ t: at + i * st, type: 'tick' })), { t: at + 5 * st + .1, type: 'pop' }], anchors: { tiles: '.tiles', meal: '.meal', card: '.akcard' },
      state(t) {
        tl.forEach((x, i) => { const p = clamp((t - at - i * st) / .16); x.style.opacity = p; x.style.transform = `scale(${.86 + .14 * easeOut(p)})`; });
        const p = clamp((t - at - 5 * st - .1) / .18); meal.style.opacity = p; meal.style.transform = `translateY(${(1 - easeOut(p)) * 16}px)`;
      }
    };
  };

  /* ── Academy: lekce (02-lekce-mobil.webp, text z akademie/studium/m1-l1) ── */
  const lessonHead = `<div class="akk"><div class="mono">MODUL 1 · LEKCE 1: PSYCHOLOGIE A CHOVÁNÍ KOLEM<br>JÍDLA</div>
    <h2>Proč lidé jedí, i když nemají hlad</h2><div class="listen">🔊 Poslechnout lekci</div>`;
  S.aklesson = (o) => {
    const el = h(`<div class="app ak">${lessonHead}
      <p class="lead">Než se vrhneme na makra a jídelníčky, chci ti říct jednu věc, kterou většina trenérů přeskočí. A pak kroutí hlavou, proč jim klienti „nedrží dietu“. Přitom je to jednoduché: <b>výživa není problém znalostí. Je to problém chování.</b></p>
      <div class="take"><b>Co si z lekce odneseš:</b><ul><li>Proč lidé jedí, i když fyzický hlad nemají (tzv. hédonický hlad).</li><li>Jak klientovi vysvětlit energetickou bilanci tak, aby ji fakt pochopil.</li></ul></div></div></div>`);
    const take = el.querySelector('.take'), at = o.takeAt ?? .6;
    return {
      el, taps: o.tapAt ? [{ at: o.tapAt, sel: '.listen' }] : [], events: [{ t: at, type: 'pop' }], anchors: { head: '.akk h2', take: '.take', lead: '.lead' },
      state(t) { const p = clamp((t - at) / .18); take.style.opacity = p; take.style.transform = `translateY(${(1 - easeOut(p)) * 18}px)`; }
    };
  };

  /* ── Academy: AI Martin u lekce (04-ai-martin-mobil.webp) ── */
  S.akchat = (o) => {
    const ans = 'svalovou hmotu a víc sytí, takže se ti líp drží plán. Horní hranice (blíž 2,2) dává smysl při větším deficitu nebo když chceš maximalizovat retenci svalu.';
    const ans2 = 'Napiš mi svoji váhu a spočítáme konkrétní rozmezí v gramech. Detail včetně rozložení do jídel najdeš v Modulu 12, lekci Kolik proteinu reálně potřebuješ. Be Effective! 💪';
    const el = h(`<div class="app ak">${lessonHead}</div>
      <div class="akchat"><div class="hd"><div class="mb">MB</div><div><b>AI Martin</b><small>AI chatbot · automatické odpovědi</small></div><div class="x">✕</div></div>
      <div class="akmsgs"><div class="ans"><div>${words(ans)}</div><div style="margin-top:12px">${words(ans2)}</div></div>
      <div class="src">Kde to najdeš<br><a>Kolik proteinu reálně potřebuješ: proč RDA 0,8 g/kg je jen minimum</a> · Proteinová věda do detailu</div></div>
      <div class="in"><div class="f">Napiš dotaz… např. „kolik bíl</div><div class="s">↑</div></div></div></div>`);
    const ws = [...el.querySelectorAll('.ans .w')], src = el.querySelector('.src'), chat = el.querySelector('.akchat');
    const openAt = o.openAt ?? 0, at = o.ansAt ?? .25, wps = o.wps ?? 18, srcAt = o.srcAt ?? (at + ws.length / wps + .1);
    return {
      el, taps: [], events: [{ t: openAt, type: 'pop' }, { t: srcAt, type: 'tick' }], anchors: { chat: '.akchat', ans: '.ans', src: '.src' },
      state(t) {
        const pc = clamp((t - openAt) / .18); chat.style.opacity = pc; chat.style.transform = `translateY(${(1 - easeOut(pc)) * 40}px)`;
        const k = (t - at) * wps; ws.forEach((w, i) => { const p = clamp(k - i); w.style.opacity = p; w.style.display = p > 0 ? '' : 'none'; });
        src.style.opacity = clamp((t - srcAt) / .15);
      }
    };
  };

  /* ── Videokurz: členská sekce kurzu (akademie/videokurz/, texty a počty doslova ze stránky) ── */
  const VKMOD = [['📎', 'Přílohy ke stažení', '26 materiálů', 1], [1, 'Modul 1: Základy výživy', '13 videí'], [2, 'Modul 2: Výpočet jídelníčku', '6 videí'], [3, 'Modul 3: Trénink', '6 videí'],
    [4, 'Modul 4: Úpravy plánu a pokrok', '7 videí'], [5, 'Modul 5: Suplementy', '3 videí'], [6, 'Modul 6: Stravovací strategie', '3 videí'], [7, 'Modul 7: Kalorické tabulky', '3 videí'],
    [8, 'Modul 8: Udržení formy a mindset', '4 videí'], [9, 'Cvičební technika', '14 videí'], [10, 'Cviky na biceps: videoukázky', '17 videí'], [11, 'Domácí tréninky', '12 videí']];
  const vkHead = `<div class="vkh"><div class="mb2">MB</div><div><b>Videokurz</b><div class="mono">BARNA ACADEMY</div></div><div class="r">← Zpět na Academy</div></div>`;
  S.vkhome = (o) => {
    const el = h(`<div class="app vk">${vkHead}<div class="vkscroll">
      <div class="vkhero"><div class="kick2"><i></i>VIDEOKURZ VÝŽIVY</div><h1>VIDEOKURZ O HUBNUTÍ, NABÍRÁNÍ A FITNESS</h1>
      <p>182 video lekcí: od základů výživy přes tréninky až po livestreamy a bonusy.</p><div class="bigbar"><span></span></div>
      <div class="prog">Tvůj postup: 0 / 182 zhlédnuto (0 %)</div><div class="vkcta">▶ ZAČÍT: CO JSOU TO KALORIE</div></div>
      ${VKMOD.map(([ix, t, c, mat]) => `<div class="modcard2"><div class="top"><span class="ix2${mat ? ' m' : ''}">${ix}</span><h3>${t}</h3></div>${mat ? '' : '<div class="mbar2"></div>'}<div class="mfoot"><span class="cnt2">${c}</span><span class="pct2">${mat ? 'Otevřít →' : '0 %'}</span></div></div>`).join('')}
    </div></div>`);
    const sc = el.querySelector('.vkscroll'), cards = [...el.querySelectorAll('.modcard2')];
    const scrollAt = o.scrollAt ?? 99, scrollDur = o.scrollDur ?? 1.6, scrollTo = o.scrollTo ?? 900, cardsAt = o.cardsAt ?? 0;
    return {
      el, taps: o.tapAt != null ? [{ at: o.tapAt, sel: '.vkcta' }] : [], events: cards.slice(0, 4).map((_, i) => ({ t: cardsAt + .1 + i * .07, type: 'tick' })),
      anchors: { hero: '.vkhero h1', cta: '.vkcta', cards: '.modcard2', m1: '.modcard2:nth-of-type(2)', mat: '.modcard2' },
      state(t) {
        const p = clamp((t - scrollAt) / scrollDur); const e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        sc.style.transform = `translateY(${-scrollTo * e}px)`;
        cards.forEach((c, i) => { const q = clamp((t - cardsAt - .1 - Math.min(i, 5) * .07) / .2); c.style.opacity = q; c.style.transform = `translateY(${(1 - easeOut(q)) * 18}px)`; });
      }
    };
  };
  const VKL = ['Co jsou to kalorie', 'Co jsou to bílkoviny', 'Co jsou to tuky', 'Co jsou to sacharidy', 'Co je to vláknina', 'Přijem a výdej', 'JoJo EFEKT', 'Priority'];
  S.vklesson = (o) => {
    const el = h(`<div class="app vk">${vkHead}<div class="vkscroll">
      <div class="crumb2">MODUL 1: ZÁKLADY VÝŽIVY · VIDEO 1 / 182</div><h2 class="vkt">Co jsou to kalorie</h2>
      <div class="player"><div class="pp">▶</div><div class="pbar"><span></span></div></div>
      <div class="mark">OZNAČIT JAKO ZHLÉDNUTÉ ✓</div>
      <div class="module2"><div class="mhead2"><b>Modul 1: Základy výživy</b><span>13 videí · <em class="pc">0 %</em></span></div>
      ${VKL.map((x, i) => `<div class="les${i === 0 ? ' cur' : ''}"><span class="chk2"></span><span class="lt2">${x}${i < 4 ? '<span class="free2">ZDARMA</span>' : ''}</span></div>`).join('')}</div>
    </div></div>`);
    const pp = el.querySelector('.pp'), bar = el.querySelector('.pbar span'), mark = el.querySelector('.mark'), first = el.querySelector('.les'), pc = el.querySelector('.pc');
    const playAt = o.playAt ?? .35, markAt = o.markAt ?? 99, sc = el.querySelector('.vkscroll'), scrollAt = o.scrollAt ?? 99, scrollTo = o.scrollTo ?? 300;
    return {
      el, taps: [{ at: playAt, sel: '.player' }, ...(markAt < 99 ? [{ at: markAt, sel: '.mark' }] : [])], events: markAt < 99 ? [{ t: markAt + .12, type: 'pop' }] : [],
      anchors: { title: '.vkt', player: '.player', mark: '.mark', list: '.module2', les: '.les' },
      state(t) {
        const pl = clamp((t - playAt) / .15); pp.style.opacity = 1 - pl; pp.style.transform = `translate(-50%,-50%) scale(${1 + pl * .3})`;
        bar.style.width = (t > playAt ? Math.min(100, (t - playAt) * 7) : 0) + '%';
        const m = t >= markAt + .12; first.classList.toggle('done', m); mark.classList.toggle('ok', m); pc.textContent = m ? '8 %' : '0 %';
        const p = clamp((t - scrollAt) / .6); sc.style.transform = `translateY(${-scrollTo * (1 - Math.pow(1 - p, 3))}px)`;
      }
    };
  };
  const VKMAT = [['🧮', 'Kalkulačka kalorií a makroživin', 'Online kalkulačka přímo v kurzu'], ['🥘', 'Generátor receptů', 'NOVÉ: recepty s makry přímo v kurzu'], ['🍳', 'Kuchařka: 40+ receptů', 'Sbírka receptů (PDF)'],
    ['📘', 'E-book: Jak hubnout efektivně', 'E-book ke stažení (PDF)'], ['📗', 'E-book: Nejčastější otázky klientů', 'E-book ke stažení (PDF)'], ['📄', 'Výpočty hubnutí a nabírání', 'Tahák s výpočty (PDF)'],
    ['🥗', 'Doporučené potraviny a zdroje vlákniny', 'Bílkoviny, sacharidy & vláknina (PDF)'], ['⚖️', 'Proč vážit jídlo', 'Infografika (PDF)'], ['🧺', 'Nákupní košík', 'Vzorový nákup (obrázek)'],
    ['📊', 'Report pro coache', 'Šablona s grafem (Excel)'], ['😴', 'Spánek & regenerace', 'NOVÉ: průvodce pro klienty (PDF)'], ['✋', 'Porce bez vážení', 'NOVÉ: porcování rukou (PDF)'],
    ['🏋️', 'Tréninkový plán (full-body)', 'NOVÉ: 3denní plán pro začátečníky (PDF)']];
  S.vkmats = (o) => {
    const el = h(`<div class="app vk">${vkHead}<div class="vkscroll"><div class="back2">← Všechny sekce</div>
      <div class="module2"><div class="mhead2"><b>📎 Přílohy ke stažení</b><span>26 materiálů</span></div>
      ${VKMAT.map(([i, t, d], k) => `<div class="mat2" data-k="${k}"><span class="mi">${i}</span><div><b>${t}</b><small>${d}</small></div><span class="ot">Otevřít →</span></div>`).join('')}</div></div></div>`);
    const rows = [...el.querySelectorAll('.mat2')], sc = el.querySelector('.vkscroll');
    const at = o.rowsAt ?? 0, st = o.stagger ?? .06, scrollAt = o.scrollAt ?? 99, scrollDur = o.scrollDur ?? 2, scrollTo = o.scrollTo ?? 520;
    const hl = o.hl || [];   // [{at, k}] zvýraznění řádku (ťuk)
    return {
      el, taps: hl.map(x => ({ at: x.at, sel: `.mat2[data-k="${x.k}"]` })), events: rows.slice(0, 6).map((_, i) => ({ t: at + i * st, type: 'tick' })),
      anchors: { list: '.module2', r0: '.mat2[data-k="0"]', r2: '.mat2[data-k="2"]', r3: '.mat2[data-k="3"]', r6: '.mat2[data-k="6"]', head: '.mhead2' },
      state(t) {
        rows.forEach((r, i) => { const q = clamp((t - at - Math.min(i, 8) * st) / .18); r.style.opacity = q; r.style.transform = `translateX(${(1 - easeOut(q)) * 24}px)`;
          const on = hl.some(x => t >= x.at && t < x.at + .9 && x.k === i); r.classList.toggle('on', on); });
        const p = clamp((t - scrollAt) / scrollDur); const e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        sc.style.transform = `translateY(${-scrollTo * e}px)`;
      }
    };
  };

  /* ── Academy: Nástroje pro trenéry (akademie/nastroje/, texty a štítky doslova ze stránky) ── */
  const AKT = [['🧮', 'Kalkulačka kalorií a maker', 'Zadáš údaje klienta a spočítá jeho denní kalorie a makra (vč. vlákniny) podle cíle. Rychlá čísla bez skládání jídelníčku.', ['kcal + makra', 'BMR / TDEE', 'Vláknina']],
    ['🥗', 'Generátor jídelníčků', 'Spočítá kalorie a makra z údajů klienta a poskládá hotový denní jídelníček z běžných potravin.', ['Makra na míru', 'Rebrand', 'Export PDF']],
    ['🍳', 'Generátor receptů', 'Vybere praktický recept podle typu jídla a zaměření: se surovinami, postupem i makry na porci (z reálných hodnot). Dáš klientovi pod svým jménem.', ['25 receptů', 'Rebrand', 'Export PDF']],
    ['🏋️', 'Generátor tréninků', 'Poskládá týdenní plán podle místa (fitko/doma/hřiště), vybavení, úrovně a cíle: se sériemi i opakováními.', ['Fitko / doma / venku', 'Rebrand', 'Export PDF']],
    ['📚', 'Databáze cviků', 'Knihovna cviků s provedením krok za krokem a nejčastějšími chybami. Hledej a filtruj podle partie, vybavení i úrovně.', ['128 cviků', 'Technika a chyby', 'Filtry + hledání']]];
  S.aktools = (o) => {
    const el = h(`<div class="app ak"><div class="akh"><div class="l"><div class="mb">MB</div><div><b>Barna Academy</b><div class="mono">NÁSTROJE PRO TRENÉRY</div></div></div>
      <div class="r">← Seznam nástrojů<br>Moje sekce</div></div><div class="aksc">
      <div class="kick2" style="margin-top:26px"><i></i>PRACOVNÍ NÁSTROJE</div><h1 class="akt-h">Nástroje pro trenéry</h1>
      <p class="akt-l">Generátory, které ti ušetří hodiny práce: zadáš údaje klienta a dostaneš hotový plán. Pak ho dáš klientovi pod svým jménem (rebrandovatelné).</p>
      ${AKT.map(([i, t, d, ch], k) => `<div class="aktc" data-k="${k}"><div class="ti">${i}</div><h2>${t}</h2><p>${d}</p><div class="chips">${ch.map(c => `<span>${c}</span>`).join('')}</div><div class="go2">OTEVŘÍT →</div></div>`).join('')}
    </div></div>`);
    const sc = el.querySelector('.aksc'), cards = [...el.querySelectorAll('.aktc')];
    const from = o.scrollFrom ?? (o.scroll || 0), to = o.scroll || 0, sAt = o.scrollAt ?? 0, sDur = o.scrollDur ?? .45, cardsAt = o.cardsAt ?? 0;
    return {
      el, taps: (o.taps || []).map(x => ({ at: x.at, sel: `.aktc[data-k="${x.k}"] .go2` })), events: cards.slice(0, 3).map((_, i) => ({ t: cardsAt + .1 + i * .08, type: 'tick' })),
      anchors: { head: '.akt-h', lead: '.akt-l', c0: '.aktc[data-k="0"]', c1: '.aktc[data-k="1"]', c3: '.aktc[data-k="3"]', c4: '.aktc[data-k="4"]', ch4: '.aktc[data-k="4"] .chips' },
      state(t) {
        const p = clamp((t - sAt) / sDur), e = 1 - Math.pow(1 - p, 3); sc.style.transform = `translateY(${-(from + (to - from) * e)}px)`;
        cards.forEach((c, i) => { const q = clamp((t - cardsAt - .1 - Math.min(i, 3) * .08) / .2); c.style.opacity = q; c.style.transform = `translateY(${(1 - easeOut(q)) * 20}px)`; });
      }
    };
  };

  window.UI = S;
})();
