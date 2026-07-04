/* Barna Academy — engine generátoru infografik pro sociální sítě.
   Čistě klientský: každá šablona vykreslí SVG (1080×1080 nebo 1080×1920).
   Export do PNG přes canvas. Žádné externí knihovny, funguje offline.
   Značka trenéra (logo/barva/jméno) se sdílí s generátorem jídelníčků
   přes localStorage 'ba_trainer_brand'. */
(function (global) {
  'use strict';

  var FONT = "Poppins, system-ui, 'Segoe UI', Arial, sans-serif";
  var FORMATS = {
    post:  { w: 1080, h: 1080, label: 'Instagram příspěvek (1:1)' },
    story: { w: 1080, h: 1920, label: 'Story / Reel (9:16)' }
  };

  // ---- pomůcky ----
  var _cv = (typeof document !== 'undefined') ? document.createElement('canvas').getContext('2d') : null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]; }); }
  function wrap(text, weight, size, maxW) {
    text = String(text == null ? '' : text).trim();
    if (!text) return [];
    if (_cv) _cv.font = weight + ' ' + size + 'px ' + FONT;
    var words = text.split(/\s+/), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var t = cur ? cur + ' ' + words[i] : words[i];
      var w = _cv ? _cv.measureText(t).width : t.length * size * 0.52;
      if (w > maxW && cur) { lines.push(cur); cur = words[i]; }
      else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  // víceřádkový text; vrátí {svg, height}
  function block(text, x, y, weight, size, lh, fill, maxW, anchor) {
    var lines = wrap(text, weight, size, maxW);
    var svg = '';
    for (var i = 0; i < lines.length; i++) {
      svg += '<text x="' + x + '" y="' + (y + i * lh) + '" font-family="' + FONT + '" font-weight="' + weight +
             '" font-size="' + size + '" fill="' + fill + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + esc(lines[i]) + '</text>';
    }
    return { svg: svg, height: lines.length * lh, lines: lines.length };
  }
  // předdané pole řádků (list) s číslem/odrážkou
  function palette(style, accent) {
    accent = /^#[0-9a-fA-F]{6}$/.test(accent || '') ? accent : '#ff7a00';
    if (style === 'light') return { bg:'#faf7f2', bg2:'#efe9df', ink:'#161310', sub:'#5f574c', accent:accent, onAccent:'#160d04', line:'rgba(0,0,0,.10)' };
    return { bg:'#0f0e0c', bg2:'#1a1712', ink:'#f6f2ec', sub:'#b7ac9e', accent:accent, onAccent:'#160d04', line:'rgba(255,255,255,.12)' };
  }

  function bgLayer(fmt, p) {
    // jemný gradient + accent tvar v rohu
    return '<defs><linearGradient id="bgg" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + p.bg2 + '"/><stop offset="1" stop-color="' + p.bg + '"/></linearGradient>' +
      '<linearGradient id="acc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + p.accent + '"/><stop offset="1" stop-color="' + p.accent + '" stop-opacity="0.55"/></linearGradient></defs>' +
      '<rect width="' + fmt.w + '" height="' + fmt.h + '" fill="url(#bgg)"/>' +
      '<circle cx="' + fmt.w + '" cy="0" r="' + Math.round(fmt.w * 0.42) + '" fill="' + p.accent + '" opacity="0.08"/>' +
      '<rect x="0" y="0" width="14" height="' + fmt.h + '" fill="url(#acc)"/>';
  }
  function brandHeader(fmt, p, brand, pad) {
    var y = pad, svg = '', hasLogo = brand.logo && /^https?:\/\//.test(brand.logo);
    if (hasLogo) {
      svg += '<image href="' + esc(brand.logo) + '" x="' + pad + '" y="' + y + '" height="70" width="220" preserveAspectRatio="xMinYMid meet"/>';
    } else if (brand.name) {
      svg += '<circle cx="' + (pad + 22) + '" cy="' + (y + 24) + '" r="22" fill="' + p.accent + '"/>' +
             '<text x="' + (pad + 22) + '" y="' + (y + 33) + '" text-anchor="middle" font-family="' + FONT + '" font-weight="800" font-size="24" fill="' + p.onAccent + '">' + esc((brand.name[0] || 'M').toUpperCase()) + '</text>' +
             '<text x="' + (pad + 58) + '" y="' + (y + 33) + '" font-family="' + FONT + '" font-weight="700" font-size="30" fill="' + p.ink + '">' + esc(brand.name) + '</text>';
    }
    return svg;
  }
  function footer(fmt, p, brand, pad) {
    var y = fmt.h - pad + 6, txt = brand.contact || brand.name || '';
    if (!txt) return '';
    return '<line x1="' + pad + '" y1="' + (y - 34) + '" x2="' + (fmt.w - pad) + '" y2="' + (y - 34) + '" stroke="' + p.line + '" stroke-width="2"/>' +
           '<text x="' + pad + '" y="' + y + '" font-family="' + FONT + '" font-weight="600" font-size="26" fill="' + p.sub + '">' + esc(txt) + '</text>';
  }
  function kicker(text, x, y, p) {
    return '<text x="' + x + '" y="' + y + '" font-family="' + FONT + '" font-weight="800" font-size="26" letter-spacing="4" fill="' + p.accent + '">' + esc(String(text).toUpperCase()) + '</text>';
  }

  // ---- šablony ----
  // každá: { id, name, desc, fields:[{key,label,type,placeholder,def,max}], render(d, fmt, p, brand, pad) }
  var T = [];

  T.push({
    id: 'tipy', name: 'Tipy / číslovaný seznam', desc: 'Nadpis + až 5 bodů. Klasika, co dobře funguje.',
    fields: [
      { key:'title', label:'Nadpis', type:'text', def:'5 chyb, proč ti nejde hubnutí' },
      { key:'items', label:'Body (jeden na řádek, max 5)', type:'list', max:5, def:[
        'Jíš „zdravě", ale nepočítáš porce — kalorie pořád rozhodují.',
        'Málo bílkovin. Cíl je zhruba 1,6–2,2 g na kilo.',
        'Spíš pět hodin a divíš se večerním chutím.',
        'Každý týden nová dieta. Vyber jednu a vydrž.',
        'Řešíš doplňky a ignoruješ základ: spánek, kroky, bílkoviny.'] }
    ],
    render: function (d, fmt, p, brand, pad) {
      var W = fmt.w - 2 * pad, top = pad + 110;
      var s = kicker('Tipy', pad, top, p);
      var tb = block(d.title, pad, top + 60, 800, fmt.w >= fmt.h ? 62 : 66, fmt.w >= fmt.h ? 70 : 74, p.ink, W);
      s += tb.svg;
      var y = top + 60 + tb.height + 40;
      var items = (d.items || []).filter(function (x) { return String(x).trim(); }).slice(0, 5);
      var gap = fmt.h > fmt.w ? 44 : 26;
      items.forEach(function (it, i) {
        s += '<circle cx="' + (pad + 30) + '" cy="' + (y - 12) + '" r="30" fill="' + p.accent + '"/>' +
             '<text x="' + (pad + 30) + '" y="' + (y - 2) + '" text-anchor="middle" font-family="' + FONT + '" font-weight="800" font-size="32" fill="' + p.onAccent + '">' + (i + 1) + '</text>';
        var ib = block(it, pad + 82, y, 500, 38, 46, p.ink, W - 82);
        s += ib.svg; y += Math.max(72, ib.height) + gap;
      });
      return s;
    }
  });

  T.push({
    id: 'mytus', name: 'Mýtus vs. Fakt', desc: 'Vyvrať omyl. Skvělé na dosah i sdílení.',
    fields: [
      { key:'myth', label:'Mýtus', type:'textarea', def:'Sacharidy večer se ukládají do tuku.' },
      { key:'fact', label:'Fakt', type:'textarea', def:'Rozhoduje celkový denní příjem, ne hodiny na budíku. Večerní sacharidy klidně zlepší spánek i regeneraci.' }
    ],
    render: function (d, fmt, p, brand, pad) {
      var W = fmt.w - 2 * pad, y = pad + 130;
      var s = '';
      // MÝTUS blok
      s += '<rect x="' + pad + '" y="' + y + '" width="150" height="52" rx="26" fill="#d64545"/>' +
           '<text x="' + (pad + 75) + '" y="' + (y + 37) + '" text-anchor="middle" font-family="' + FONT + '" font-weight="800" font-size="28" fill="#fff">MÝTUS</text>';
      var mb = block(d.myth, pad, y + 120, 700, 54, 62, p.ink, W);
      s += mb.svg;
      // oddělovač šipka
      var midY = y + 120 + mb.height + 60;
      s += '<line x1="' + pad + '" y1="' + midY + '" x2="' + (fmt.w - pad) + '" y2="' + midY + '" stroke="' + p.line + '" stroke-width="2"/>';
      var y2 = midY + 60;
      s += '<rect x="' + pad + '" y="' + y2 + '" width="120" height="52" rx="26" fill="' + p.accent + '"/>' +
           '<text x="' + (pad + 60) + '" y="' + (y2 + 37) + '" text-anchor="middle" font-family="' + FONT + '" font-weight="800" font-size="28" fill="' + p.onAccent + '">FAKT</text>';
      var fb = block(d.fact, pad, y2 + 110, 500, 44, 54, p.sub, W);
      s += fb.svg;
      return s;
    }
  });

  T.push({
    id: 'citat', name: 'Citát / motivace', desc: 'Velký citát tvým hlasem. Buduje značku.',
    fields: [
      { key:'quote', label:'Citát', type:'textarea', def:'Nejlepší dieta je ta, kterou zvládneš dělat i za rok.' },
      { key:'author', label:'Podpis (jméno)', type:'text', def:'' }
    ],
    render: function (d, fmt, p, brand, pad) {
      var W = fmt.w - 2 * pad, cy = fmt.h * 0.34;
      var s = '<text x="' + pad + '" y="' + (cy - 40) + '" font-family="Georgia, serif" font-weight="700" font-size="200" fill="' + p.accent + '" opacity="0.55">“</text>';
      var qb = block(d.quote, pad, cy + 90, 800, fmt.w >= fmt.h ? 64 : 72, fmt.w >= fmt.h ? 78 : 88, p.ink, W);
      s += qb.svg;
      var author = (d.author && d.author.trim()) || brand.name || '';
      if (author) {
        var ay = cy + 90 + qb.height + 40;
        s += '<rect x="' + pad + '" y="' + (ay - 26) + '" width="54" height="6" rx="3" fill="' + p.accent + '"/>' +
             '<text x="' + (pad + 74) + '" y="' + (ay - 8) + '" font-family="' + FONT + '" font-weight="700" font-size="34" fill="' + p.sub + '">' + esc(author) + '</text>';
      }
      return s;
    }
  });

  T.push({
    id: 'makra', name: 'Jídlo v číslech (makra)', desc: 'Název jídla + kalorie a makra včetně vlákniny.',
    fields: [
      { key:'meal', label:'Název jídla', type:'text', def:'Kuřecí bowl s rýží a zeleninou' },
      { key:'kcal', label:'Kalorie (kcal)', type:'text', def:'620' },
      { key:'protein', label:'Bílkoviny (g)', type:'text', def:'48' },
      { key:'carbs', label:'Sacharidy (g)', type:'text', def:'70' },
      { key:'fat', label:'Tuky (g)', type:'text', def:'14' },
      { key:'fiber', label:'Vláknina (g)', type:'text', def:'9' }
    ],
    render: function (d, fmt, p, brand, pad) {
      var W = fmt.w - 2 * pad, top = pad + 120;
      var s = kicker('Jídlo v číslech', pad, top, p);
      var mb = block(d.meal, pad, top + 66, 800, fmt.w >= fmt.h ? 60 : 66, fmt.w >= fmt.h ? 70 : 76, p.ink, W);
      s += mb.svg;
      var y = top + 66 + mb.height + 40;
      // velké kcal
      s += '<text x="' + pad + '" y="' + (y + 90) + '" font-family="' + FONT + '" font-weight="800" font-size="130" fill="' + p.accent + '">' + esc(d.kcal) + '</text>' +
           '<text x="' + pad + '" y="' + (y + 140) + '" font-family="' + FONT + '" font-weight="700" font-size="34" fill="' + p.sub + '">kcal</text>';
      var by = y + 220;
      var macros = [['Bílkoviny', d.protein], ['Sacharidy', d.carbs], ['Tuky', d.fat], ['Vláknina', d.fiber]];
      var cols = 2, cw = W / cols, rh = 150;
      macros.forEach(function (m, i) {
        var cx = pad + (i % cols) * cw, ry = by + Math.floor(i / cols) * rh;
        s += '<rect x="' + cx + '" y="' + ry + '" width="' + (cw - 24) + '" height="' + (rh - 24) + '" rx="20" fill="' + p.bg2 + '" stroke="' + p.line + '" stroke-width="2"/>' +
             '<text x="' + (cx + 30) + '" y="' + (ry + 78) + '" font-family="' + FONT + '" font-weight="800" font-size="60" fill="' + p.ink + '">' + esc(m[1]) + ' g</text>' +
             '<text x="' + (cx + 30) + '" y="' + (ry + 116) + '" font-family="' + FONT + '" font-weight="600" font-size="30" fill="' + p.sub + '">' + esc(m[0]) + '</text>';
      });
      return s;
    }
  });

  T.push({
    id: 'zamena', name: 'Chytré záměny', desc: '„Místo tohohle → dej si tohle." Praktické a užitečné.',
    fields: [
      { key:'title', label:'Nadpis', type:'text', def:'3 chytré záměny bez hladovění' },
      { key:'items', label:'Záměny ve tvaru „staré => nové" (řádek, max 4)', type:'list', max:4, def:[
        'Slazená limonáda => voda s citronem a mátou',
        'Chipsy k seriálu => řecký jogurt s ovocem',
        'Bílé pečivo => celozrnné + vejce'] }
    ],
    render: function (d, fmt, p, brand, pad) {
      var W = fmt.w - 2 * pad, top = pad + 110;
      var s = kicker('Chytrá záměna', pad, top, p);
      var tb = block(d.title, pad, top + 60, 800, fmt.w >= fmt.h ? 58 : 64, fmt.w >= fmt.h ? 66 : 72, p.ink, W);
      s += tb.svg;
      var y = top + 60 + tb.height + 50;
      var items = (d.items || []).filter(function (x) { return String(x).trim(); }).slice(0, 4);
      items.forEach(function (it, i) {
        var parts = String(it).split(/=>|→/);
        var a = (parts[0] || '').trim(), b = (parts[1] || '').trim();
        var ab = block(a, pad, y, 600, 40, 46, p.sub, W);
        s += ab.svg;
        var y2 = y + ab.height + 6;
        s += '<text x="' + pad + '" y="' + (y2 + 30) + '" font-family="' + FONT + '" font-weight="800" font-size="40" fill="' + p.accent + '">↓</text>';
        var bb = block(b, pad + 60, y2 + 30, 700, 44, 52, p.ink, W - 60);
        s += bb.svg;
        y = y2 + 30 + bb.height + 48;
      });
      return s;
    }
  });

  T.push({
    id: 'cvik', name: 'Cvik dne', desc: 'Název cviku, cílová partie a 3 klíčové pokyny.',
    fields: [
      { key:'name', label:'Název cviku', type:'text', def:'Dřep s velkou činkou' },
      { key:'muscle', label:'Cílová partie', type:'text', def:'Nohy a hýždě' },
      { key:'cues', label:'Klíčové pokyny (řádek, max 3)', type:'list', max:3, def:[
        'Chodidla na šíři ramen, špičky mírně ven.',
        'Kolena kopírují špičky, nepadají dovnitř.',
        'Klesej do plné hloubky, hrudník vzhůru, záda rovná.'] }
    ],
    render: function (d, fmt, p, brand, pad) {
      var W = fmt.w - 2 * pad, top = pad + 110;
      var s = kicker('Cvik dne', pad, top, p);
      var nb = block(d.name, pad, top + 66, 800, fmt.w >= fmt.h ? 66 : 72, fmt.w >= fmt.h ? 76 : 82, p.ink, W);
      s += nb.svg;
      var y = top + 66 + nb.height + 10;
      s += '<rect x="' + pad + '" y="' + y + '" width="' + Math.min(W, 60 + (String(d.muscle).length) * 20) + '" height="54" rx="27" fill="' + p.accent + '" opacity="0.16"/>' +
           '<text x="' + (pad + 26) + '" y="' + (y + 37) + '" font-family="' + FONT + '" font-weight="700" font-size="30" fill="' + p.accent + '">🎯 ' + esc(d.muscle) + '</text>';
      y += 54 + 56;
      var cues = (d.cues || []).filter(function (x) { return String(x).trim(); }).slice(0, 3);
      cues.forEach(function (c, i) {
        s += '<text x="' + pad + '" y="' + (y + 6) + '" font-family="' + FONT + '" font-weight="800" font-size="40" fill="' + p.accent + '">✓</text>';
        var cb = block(c, pad + 66, y, 500, 42, 50, p.ink, W - 66);
        s += cb.svg; y += Math.max(70, cb.height) + 40;
      });
      return s;
    }
  });

  T.push({
    id: 'otazka', name: 'Otázka & odpověď', desc: 'Častý dotaz klienta + tvoje krátká odpověď.',
    fields: [
      { key:'question', label:'Otázka', type:'textarea', def:'Musím jíst 5× denně, aby se „nastartoval" metabolismus?' },
      { key:'answer', label:'Odpověď', type:'textarea', def:'Ne. Počet jídel metabolismus neřeší. Vyber si 3–5 jídel podle toho, co ti sedí a dlouhodobě udržíš. Rozhoduje celkový příjem a bílkoviny.' }
    ],
    render: function (d, fmt, p, brand, pad) {
      var W = fmt.w - 2 * pad, top = pad + 130;
      var s = '<text x="' + pad + '" y="' + top + '" font-family="' + FONT + '" font-weight="800" font-size="150" fill="' + p.accent + '" opacity="0.20">?</text>';
      s += kicker('Ptáš se', pad, top + 40, p);
      var qb = block(d.question, pad, top + 110, 800, fmt.w >= fmt.h ? 58 : 64, fmt.w >= fmt.h ? 68 : 74, p.ink, W);
      s += qb.svg;
      var y = top + 110 + qb.height + 56;
      s += '<line x1="' + pad + '" y1="' + (y - 30) + '" x2="' + (fmt.w - pad) + '" y2="' + (y - 30) + '" stroke="' + p.line + '" stroke-width="2"/>';
      s += kicker('Odpověď', pad, y + 20, p);
      var ab = block(d.answer, pad, y + 84, 500, 44, 54, p.sub, W);
      s += ab.svg;
      return s;
    }
  });

  T.push({
    id: 'vyzva', name: 'Týdenní výzva / CTA', desc: 'Zapojí publikum a vyvolá reakce (komenty, DM).',
    fields: [
      { key:'title', label:'Název výzvy', type:'text', def:'7denní výzva: bílkovina v každém jídle' },
      { key:'steps', label:'Kroky (řádek, max 3)', type:'list', max:3, def:[
        'Ke každému jídlu dej dlaň bílkovin.',
        'Zapiš si to — appka nebo papír.',
        'V neděli mi napiš, jak to šlo.'] },
      { key:'cta', label:'Výzva k akci (CTA)', type:'text', def:'Napiš mi do DM „VÝZVA" a pošlu ti tabulku zdarma.' }
    ],
    render: function (d, fmt, p, brand, pad) {
      var W = fmt.w - 2 * pad, top = pad + 110;
      var s = kicker('Týdenní výzva', pad, top, p);
      var tb = block(d.title, pad, top + 62, 800, fmt.w >= fmt.h ? 62 : 68, fmt.w >= fmt.h ? 72 : 78, p.ink, W);
      s += tb.svg;
      var y = top + 62 + tb.height + 46;
      var steps = (d.steps || []).filter(function (x) { return String(x).trim(); }).slice(0, 3);
      steps.forEach(function (st, i) {
        s += '<circle cx="' + (pad + 28) + '" cy="' + (y - 10) + '" r="28" fill="none" stroke="' + p.accent + '" stroke-width="4"/>' +
             '<text x="' + (pad + 28) + '" y="' + (y - 1) + '" text-anchor="middle" font-family="' + FONT + '" font-weight="800" font-size="30" fill="' + p.accent + '">' + (i + 1) + '</text>';
        var sb = block(st, pad + 78, y, 500, 40, 48, p.ink, W - 78);
        s += sb.svg; y += Math.max(70, sb.height) + 34;
      });
      y += 10;
      var ctaLines = wrap(d.cta, 700, 40, W - 56);
      var boxH = 44 + ctaLines.length * 48;
      s += '<rect x="' + pad + '" y="' + y + '" width="' + W + '" height="' + boxH + '" rx="22" fill="' + p.accent + '"/>';
      var cb = block(d.cta, pad + 28, y + 62, 700, 40, 48, p.onAccent, W - 56);
      s += cb.svg;
      return s;
    }
  });

  // ---- sestavení SVG ----
  function svgFor(templateId, data, formatId, brand, bgStyle) {
    var fmt = FORMATS[formatId] || FORMATS.post;
    var tpl = null; for (var i = 0; i < T.length; i++) if (T[i].id === templateId) tpl = T[i];
    if (!tpl) tpl = T[0];
    var p = palette(bgStyle, brand && brand.accent);
    var pad = 80;
    var body = tpl.render(data || {}, fmt, p, brand || {}, pad);
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + fmt.w + '" height="' + fmt.h + '" viewBox="0 0 ' + fmt.w + ' ' + fmt.h + '">' +
      bgLayer(fmt, p) + brandHeader(fmt, p, brand || {}, pad) + body + footer(fmt, p, brand || {}, pad) + '</svg>';
  }

  // ---- export do PNG ----
  function toPNG(svgString, w, h) {
    return new Promise(function (resolve, reject) {
      var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('toBlob selhalo')); }, 'image/png');
      };
      img.onerror = function () { reject(new Error('SVG se nepodařilo vykreslit')); };
      img.src = url;
    });
  }

  function defaultsFor(templateId) {
    var tpl = null; for (var i = 0; i < T.length; i++) if (T[i].id === templateId) tpl = T[i];
    if (!tpl) return {};
    var d = {}; tpl.fields.forEach(function (f) { d[f.key] = Array.isArray(f.def) ? f.def.slice() : f.def; });
    return d;
  }

  global.Infographic = { FORMATS: FORMATS, TEMPLATES: T, svgFor: svgFor, toPNG: toPNG, defaultsFor: defaultsFor };
})(typeof window !== 'undefined' ? window : this);
