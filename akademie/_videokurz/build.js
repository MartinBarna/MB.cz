// Videokurz builder — z videos.tsv vygeneruje nástěnku + stránku každého videa.
// Mechanické (žádné agenty): vloží YouTube embed do branded šablony.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'akademie/videokurz');

const rows = fs.readFileSync(path.join(__dirname, 'videos.tsv'), 'utf8')
  .split('\n').map(l => l.trim()).filter(Boolean)
  .map(l => { const p = l.split('\t'); return { ord: +p[0], id: p[1], title: p[2] }; });

// ---- normalizace názvu (z velkých písmen na hezčí) ----
function nice(t) {
  // sjednoť vícenásobné mezery
  t = t.replace(/\s+/g, ' ').trim();
  // názvy typu "1.13 MAKROŽIVINY SACHARIDY" → "Makroživiny sacharidy" (číslo dáme do crumbu)
  return t;
}
// vytáhni číslo modulu "1.13", "4.2.2" → {mod, sub[]}
function numinfo(t) {
  const m = t.match(/^(\d+)(?:[.\s](\d+))?(?:\.(\d+))?\s/);
  if (!m) return null;
  return { mod: +m[1], sub: [m[2] ? +m[2] : 0, m[3] ? +m[3] : 0], raw: m[0].trim() };
}
function stripNum(t) { return t.replace(/^(\d+)(?:[.\s]\d+)?(?:\.\d+)?\s+/, '').trim(); }
function titleCase(t) {
  // jen pokud je celé velkými písmeny → převeď na "Věta s velkým prvním písmenem"
  var letters = t.replace(/[^A-Za-zÁ-Žá-ž]/g, '');
  var upp = letters && letters === letters.toUpperCase();
  if (!upp) return t;
  var low = t.toLowerCase();
  return low.charAt(0).toUpperCase() + low.slice(1);
}

// ---- přiřazení sekce ----
const SECTIONS = [
  { key: 'm1', name: 'Modul 1 — Základy výživy' },
  { key: 'm2', name: 'Modul 2 — Výpočet jídelníčku' },
  { key: 'm3', name: 'Modul 3 — Trénink' },
  { key: 'm4', name: 'Modul 4 — Úpravy plánu a pokrok' },
  { key: 'm5', name: 'Modul 5 — Suplementy' },
  { key: 'm6', name: 'Modul 6 — Stravovací strategie' },
  { key: 'm7', name: 'Modul 7 — Kalorické tabulky' },
  { key: 'm8', name: 'Modul 8 — Udržení formy a mindset' },
  { key: 'techt', name: 'Cvičební technika' },
  { key: 'biceps', name: 'Cviky na biceps — videoukázky' },
  { key: 'doma', name: 'Domácí tréninky' },
  { key: 'bloncka', name: 'Bloncka se ptá Coache' },
  { key: 'rozhovory', name: 'Rozhovory a studie' },
  { key: 'nakupy', name: 'Nákupy chytře (Lidl, JIP, Tesco)' },
  { key: 'live', name: 'Livestreamy členské sekce' },
  { key: 'doplnkova', name: 'Doplňková videa a novinky' },
];
// Materiály ke stažení (hostované v Supabase Storage bucketu 'videokurz-materialy').
// 'link' = otevře web (kalkulačka), 'file' = stáhne přes podepsanou URL.
const BUCKET = 'videokurz-materialy';
const MATERIALS = [
  { ico: '🧮', t: 'Kalkulačka kalorií a makroživin', d: 'Online kalkulačka přímo v kurzu', link: '/akademie/videokurz/kalkulacka/' },
  { ico: '🍳', t: 'Kuchařka — 40+ receptů', d: 'Sbírka receptů (PDF)', file: 'Kucharka 40 + receptu.pdf' },
  { ico: '📘', t: 'E-book: Jak hubnout efektivně', d: 'E-book ke stažení (PDF)', file: 'Ebook jak hubnout efektivne.pdf' },
  { ico: '📗', t: 'E-book: Nejčastější otázky klientů', d: 'E-book ke stažení (PDF)', file: 'Otazky klientu EBook.pdf' },
  { ico: '📄', t: 'Výpočty hubnutí a nabírání', d: 'Tahák s výpočty (PDF)', file: 'Vypoctyhubnutianabirani.pdf' },
  { ico: '🥗', t: 'Doporučené potraviny a zdroje vlákniny', d: 'Bílkoviny, sacharidy & vláknina (PDF)', file: 'Doporucene potraviny a zdroje vlakniny.pdf' },
  { ico: '⚖️', t: 'Proč vážit jídlo', d: 'Infografika (PDF)', file: 'Proc vazit jidlo.pdf' },
  { ico: '🧺', t: 'Nákupní košík', d: 'Vzorový nákup (obrázek)', file: 'nakupni kosik.png' },
  { ico: '📊', t: 'Report pro coache', d: 'Šablona s grafem (Excel)', file: 'Report tabulka.xlsx' },
];

function assign(v) {
  const ni = numinfo(v.title);
  if (ni && ni.mod >= 1 && ni.mod <= 8) return 'm' + ni.mod;
  const t = v.title;
  if (/Bloncka se ptá Coache/i.test(t)) return 'bloncka';
  if (/procvičit biceps|Procvičit Biceps/i.test(t)) return 'biceps';
  if (/Domácí|Kruhový trénink na doma/i.test(t)) return 'doma';
  if (/livestream/i.test(t)) return 'live';
  if (/^Studie:/i.test(t)) return 'rozhovory';
  if (/Rozhovor|Institut Moderní Výživy|Skalská|Vágnerová|Misař/i.test(t)) return 'rozhovory';
  if (/nakoupit|LIDL|JIP|Tesco/i.test(t)) return 'nakupy';
  if (/Nováčci|držení těla|Jak začít cvičit|série, opakování|Rozbor Těla|Sezení v autě|Rozdělení tréninku|Opakování v rezervě|Progresivní přetížení|Reps In Reserve|S tímhle TRENÉREM|Greatest legs|TOM PLATZ/i.test(t)) return 'techt';
  return 'doplnkova';
}

rows.forEach(v => { v.sec = assign(v); v.ni = numinfo(v.title); v.disp = titleCase(stripNum(v.title)); });

// seřaď: uvnitř modulů 1-8 podle čísla; ostatní podle pořadí v playlistu
const ordered = [];
SECTIONS.forEach(s => {
  let list = rows.filter(v => v.sec === s.key);
  if (/^m[1-8]$/.test(s.key)) {
    list.sort((a, b) => (a.ni.sub[0] - b.ni.sub[0]) || (a.ni.sub[1] - b.ni.sub[1]) || (a.ord - b.ord));
  } else {
    list.sort((a, b) => a.ord - b.ord);
  }
  s.list = list;
  list.forEach(v => ordered.push(v));
});
// přiřaď výsledné pořadové číslo + slug složky
ordered.forEach((v, i) => { v.n = i + 1; v.slug = 'v' + String(i + 1).padStart(3, '0'); v.lid = 'vk-' + v.id; });

function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// ---- stránka videa ----
function videoPage(v) {
  const prev = ordered[v.n - 2], next = ordered[v.n];
  const secName = SECTIONS.find(s => s.key === v.sec).name;
  const navPrev = prev ? '<a class="btn ghost" href="/akademie/videokurz/' + prev.slug + '/">← Předchozí</a>' : '';
  const navNext = next ? '<a class="btn ghost" href="/akademie/videokurz/' + next.slug + '/">Další →</a>' : '';
  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(v.disp)} — Videokurz · Martin Barna</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
<link rel="stylesheet" href="/assets/vendor/fonts/poppins.css">
<style>
  :root { --gold:#ff7a00; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Poppins',Arial,sans-serif; color:#1d1a16; background:#f6f1ea; line-height:1.65; }
  .top { position:sticky; top:0; z-index:50; background:#161616; color:#fff; }
  .top .in { max-width:900px; margin:0 auto; padding:11px 18px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
  .brand { display:flex; align-items:center; gap:9px; text-decoration:none; color:#fff; font-weight:800; font-size:.95rem; }
  .brand .mark { width:28px; height:28px; border-radius:7px; background:var(--gold); color:#161616; font-weight:800; display:flex; align-items:center; justify-content:center; font-size:.82rem; }
  .top a.back { color:#bbb; text-decoration:none; font-size:.86rem; }
  .wrap { max-width:880px; margin:0 auto; padding:26px 18px 80px; }
  .crumb { color:#a89c8c; font-size:.82rem; font-weight:600; letter-spacing:.3px; text-transform:uppercase; }
  h1 { font-size:1.55rem; line-height:1.25; margin:.4rem 0 1rem; letter-spacing:-.01em; }
  .video { position:relative; padding-top:56.25%; background:#000; border-radius:14px; overflow:hidden; border:1px solid #e7ddcf; }
  .video iframe { position:absolute; inset:0; width:100%; height:100%; border:0; }
  .done-row { margin-top:1.6rem; display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
  .btn { background:var(--gold); color:#161616; font-weight:700; padding:12px 24px; border-radius:50px; border:none; cursor:pointer; text-decoration:none; display:inline-block; font-family:inherit; font-size:.95rem; }
  .btn:hover { background:#161616; color:#fff; }
  .btn.ghost { background:transparent; border:1.5px solid #cdbfad; color:#5a5045; }
  .btn.is-done { background:#34a853; color:#fff; }
  .nav { margin-top:1.4rem; display:flex; justify-content:space-between; gap:10px; }
  .foot { margin-top:2rem; font-size:.8rem; color:#9a8f7e; }
</style>
</head>
<body>
  <div class="top"><div class="in">
    <a class="brand" href="/akademie/videokurz/"><span class="mark">MB</span> Videokurz</a>
    <a class="back" href="/akademie/videokurz/">← Přehled videokurzu</a>
  </div></div>

  <div class="wrap">
    <div class="crumb">${esc(secName)} · Video ${v.n} / ${ordered.length}</div>
    <h1>${esc(v.disp)}</h1>

    <div class="video">
      <iframe src="https://www.youtube-nocookie.com/embed/${v.id}?rel=0&modestbranding=1" title="${esc(v.disp)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
    </div>

    <div class="done-row">
      <button class="btn" id="doneBtn">Označit jako zhlédnuté ✓</button>
      <a class="btn ghost" href="/akademie/videokurz/">Zpět na přehled</a>
    </div>

    <div class="nav">${navPrev || '<span></span>'}${navNext || '<span></span>'}</div>

    <p class="foot">© Videokurz Martin Barna — členská sekce. Video je dostupné jen přihlášeným s aktivním přístupem.</p>
  </div>

  <script src="/assets/ba-config.js"></script>
  <script src="/assets/ba-academy.js"></script>
  <script>
    var LID='${v.lid}', PRODUCT='videokurz', state={done:false};
    var btn=document.getElementById('doneBtn');
    function paint(){ if(state.done){ btn.classList.add('is-done'); btn.textContent='Zhlédnuto ✓ (klikni pro zrušení)'; } else { btn.classList.remove('is-done'); btn.textContent='Označit jako zhlédnuté ✓'; } }
    function load(){
      if (window.BA){
        window.BA.ready.then(function(){
          if (window.BA.mode==='live'){ window.BA.requireAccess(PRODUCT).then(function(ok){ if(!ok) return; window.BA.getProgress().then(function(d){ state.done=!!d[LID]; paint(); }); }); }
          else { window.BA.getProgress().then(function(d){ state.done=!!d[LID]; paint(); }); }
        });
      } else { try{ state.done=!!JSON.parse(localStorage.getItem('ba_progress_v1')||'{}')[LID]; }catch(e){} paint(); }
    }
    btn.addEventListener('click', function(){ state.done=!state.done; paint(); if(window.BA){ window.BA.setDone(PRODUCT, LID, state.done); } });
    load();
  </script>
</body>
</html>`;
}

// ---- nástěnka ----
function dashboard() {
  let modulesHtml = SECTIONS.filter(s => s.list.length).map(s => {
    const items = s.list.map(v =>
      `        <li class="lesson" data-lid="${v.lid}"><a href="/akademie/videokurz/${v.slug}/"><span class="chk"></span><span class="lt">${esc(v.disp)}</span><span class="go">Otevřít →</span></a></li>`
    ).join('\n');
    return `    <div class="module">
      <div class="mhead"><h2>${esc(s.name)}</h2><span class="cnt">${s.list.length} videí · <b class="pct">0 %</b></span></div>
      <ul class="lessons">
${items}
      </ul>
    </div>`;
  }).join('\n');

  const materialsHtml = MATERIALS.map(m => {
    const action = m.link
      ? `<a class="mbtn" href="${m.link}">Otevřít →</a>`
      : `<button class="mbtn" type="button" data-file="${m.file}">Stáhnout ↓</button>`;
    return `        <li class="mat"><span class="mico">${m.ico}</span><span class="minfo"><b>${esc(m.t)}</b><small>${esc(m.d)}</small></span>${action}</li>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Videokurz — Martin Barna</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
<link rel="stylesheet" href="/assets/vendor/fonts/poppins.css">
<link rel="stylesheet" href="/assets/ba-ui.css">
<style>
  .wrap { max-width:900px; }
  .hero .kick { margin-bottom:14px; }
  .hero h1 { font-size:clamp(1.7rem,4vw,2.4rem); color:#fff; letter-spacing:-.02em; margin-bottom:8px; }
  .hero p { color:var(--muted); max-width:620px; }
  .bigbar { height:10px; background:rgba(255,255,255,.07); border:1px solid var(--line); border-radius:10px; margin:20px 0 8px; overflow:hidden; }
  .bigbar span { display:block; height:100%; width:0; background:linear-gradient(90deg,var(--gold),var(--gold-soft)); transition:width .5s; }
  .bigpct { font-size:.85rem; color:var(--muted-2); font-weight:600; margin-bottom:8px; }

  .matcard, .module { background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.02)); border:1px solid var(--line); border-radius:20px; padding:8px 22px 16px; margin:18px 0; box-shadow:0 24px 50px -34px rgba(0,0,0,.9); }
  .mhead { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 0 12px; border-bottom:1px solid var(--line); }
  .mhead h2, .matcard h2 { color:#fff; font-size:1.12rem; letter-spacing:-.01em; }
  .matcard h2 { padding:16px 0 12px; border-bottom:1px solid var(--line); margin-bottom:6px; }
  .mhead .cnt { color:var(--gold-soft); font-size:.76rem; font-weight:700; white-space:nowrap; background:rgba(255,122,0,.1); border:1px solid rgba(255,122,0,.22); padding:4px 11px; border-radius:50px; }
  .lessons { list-style:none; }
  .lesson a { display:flex; align-items:center; gap:13px; padding:13px 8px; text-decoration:none; color:var(--ink); border-bottom:1px solid rgba(255,255,255,.05); border-radius:11px; transition:background .2s, padding .2s; }
  .lesson:last-child a { border-bottom:none; }
  .lesson a:hover { background:rgba(255,122,0,.07); padding-left:14px; }
  .lesson .chk { width:21px; height:21px; border-radius:50%; border:2px solid rgba(255,255,255,.22); flex-shrink:0; transition:.2s; }
  .lesson.done .chk { background:linear-gradient(145deg,var(--gold-2),var(--gold)); border-color:var(--gold); position:relative; }
  .lesson.done .chk::after { content:"✓"; color:#160d04; font-weight:800; font-size:.72rem; position:absolute; inset:0; display:flex; align-items:center; justify-content:center; }
  .lesson .lt { flex:1; font-size:.96rem; }
  .lesson.done .lt { color:var(--muted); }
  .ba .lesson .go { color:var(--gold-soft); background:none; border:none; box-shadow:none; padding:0; transform:none; font-weight:700; font-size:.82rem; white-space:nowrap; }
  .ba .lesson a:hover .go { transform:none; text-decoration:underline; }
  .note { text-align:center; color:var(--muted); font-size:.8rem; margin-top:24px; }

  .mats { list-style:none; display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:6px; }
  @media(max-width:680px){ .mats { grid-template-columns:1fr; } }
  .mat { display:flex; align-items:center; gap:12px; padding:13px 14px; border-radius:14px; background:rgba(255,255,255,.03); border:1px solid var(--line); transition:border-color .2s, transform .2s; }
  .mat:hover { border-color:rgba(255,122,0,.3); transform:translateY(-2px); }
  .mico { font-size:1.35rem; width:30px; text-align:center; flex-shrink:0; }
  .minfo { flex:1; display:flex; flex-direction:column; min-width:0; }
  .minfo b { color:#fff; font-size:.92rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .minfo small { color:var(--muted); font-size:.78rem; }
  .mbtn { background:linear-gradient(145deg,var(--gold-2),var(--gold)); color:#160d04; font-weight:700; padding:9px 15px; border-radius:50px; border:none; cursor:pointer; text-decoration:none; font-family:inherit; font-size:.82rem; white-space:nowrap; box-shadow:0 8px 18px -8px rgba(255,122,0,.6); transition:transform .2s; }
  .mbtn:hover { transform:translateY(-1px); }
  .mbtn[disabled] { opacity:.5; cursor:default; transform:none; }
</style>
</head>
<body class="ba">
  <div class="top"><div class="in">
    <a class="brand" href="/akademie/videokurz/"><span class="mark">MB</span><span><b>Videokurz</b><span class="tag">Barna Academy</span></span></a>
    <span class="topr">
      <a class="back" href="/akademie/moje/">← Barna Academy</a>
      <a class="out" id="logout">Odhlásit</a>
    </span>
  </div></div>

  <div class="wrap">
    <div class="hero">
      <span class="kick"><span class="dot"></span> Videokurz výživy</span>
      <h1>Videokurz o hubnutí, nabírání a fitness</h1>
      <p>${ordered.length} video lekcí — od základů výživy přes tréninky až po livestreamy a bonusy.</p>
      <div class="bigbar"><span id="bigbar"></span></div>
      <div class="bigpct" id="bigpct">Tvůj postup: 0 / ${ordered.length} zhlédnuto</div>
    </div>

    <div class="matcard">
      <h2>📎 Materiály ke stažení</h2>
      <ul class="mats">
${materialsHtml}
      </ul>
    </div>

${modulesHtml}

    <p class="note" id="modeNote">Ukázka prostředí. Přihlášení a uložení postupu se aktivuje po koupi (Supabase).</p>
  </div>

  <script src="/assets/ba-config.js"></script>
  <script src="/assets/ba-academy.js"></script>
  <script>
    (function(){ var lo=document.getElementById('logout'); if(lo) lo.addEventListener('click', function(e){ e.preventDefault(); if(window.BA && window.BA.signOut){ window.BA.signOut().then(function(){ location.href='/akademie/prihlaseni/'; }); } else { location.href='/akademie/prihlaseni/'; } }); })();
    var TOTAL=${ordered.length};
    function render(done){
      done=done||{};
      var cnt=0;
      document.querySelectorAll('.lesson').forEach(function(li){
        var d=!!done[li.getAttribute('data-lid')];
        li.classList.toggle('done', d); if(d) cnt++;
      });
      document.querySelectorAll('.module').forEach(function(mod){
        var ls=mod.querySelectorAll('.lesson'), dn=mod.querySelectorAll('.lesson.done').length;
        var p=ls.length?Math.round(dn/ls.length*100):0;
        var el=mod.querySelector('.pct'); if(el) el.textContent=p+' %';
      });
      var pct=TOTAL?Math.round(cnt/TOTAL*100):0;
      document.getElementById('bigbar').style.width=pct+'%';
      document.getElementById('bigpct').textContent='Tvůj postup: '+cnt+' / '+TOTAL+' zhlédnuto ('+pct+' %)';
    }
    function boot(){
      if (window.BA){
        window.BA.ready.then(function(){
          if (window.BA.mode==='live'){
            window.BA.requireAccess('videokurz').then(function(ok){
              if(!ok) return;
              var n=document.getElementById('modeNote'); if(n) n.textContent='Tvůj postup se ukládá k účtu a synchronizuje se napříč zařízeními.';
              window.BA.getProgress().then(render);
            });
          } else { window.BA.getProgress().then(render); }
        });
      } else { try{ render(JSON.parse(localStorage.getItem('ba_progress_v1')||'{}')); }catch(e){ render({}); } }
    }
    var BUCKET='${BUCKET}';
    function wireMaterials(){
      document.querySelectorAll('.mbtn[data-file]').forEach(function(btn){
        btn.addEventListener('click', function(){
          var file=btn.getAttribute('data-file');
          if(!window.BA || typeof window.BA.materialUrl!=='function'){ alert('Obnov prosím stránku (Ctrl+F5) a zkus to znovu.'); return; }
          var w = window.open('', '_blank');           // otevři kartu HNED (kvůli popup blokeru)
          var orig=btn.textContent; btn.textContent='Připravuji…'; btn.disabled=true;
          window.BA.ready.then(function(){ return window.BA.materialUrl(BUCKET, file); }).then(function(url){
            btn.textContent=orig; btn.disabled=false;
            if(url){ if(w){ w.location.href=url; } else { location.href=url; } }
            else { if(w){ w.close(); } alert('Soubor „'+file+'" se nepodařilo otevřít. Zkontroluj, že je v Supabase Storage nahraný přesně pod tímhle názvem a že máš aktivní přístup k videokurzu.'); }
          }).catch(function(e){
            btn.textContent=orig; btn.disabled=false; if(w){ w.close(); }
            alert('Stažení selhalo: '+((e&&e.message)||e)+'. Zkus obnovit stránku (Ctrl+F5).');
          });
        });
      });
    }
    wireMaterials();
    boot();
  </script>
</body>
</html>`;
}

// ---- zápis ----
fs.mkdirSync(OUT, { recursive: true });
ordered.forEach(v => {
  const dir = path.join(OUT, v.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), videoPage(v));
});
fs.writeFileSync(path.join(OUT, 'index.html'), dashboard());

// přehled do konzole
const counts = SECTIONS.filter(s => s.list.length).map(s => '  ' + s.name + ': ' + s.list.length);
console.log('Vygenerováno ' + ordered.length + ' videí + nástěnka.');
console.log(counts.join('\n'));
fs.writeFileSync(path.join(__dirname, 'manifest.json'), JSON.stringify(ordered.map(v => ({ n: v.n, slug: v.slug, id: v.id, sec: v.sec, title: v.disp })), null, 2));
