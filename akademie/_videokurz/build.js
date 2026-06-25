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
  { ico: '🍳', t: 'Kuchařka — 40+ receptů', d: 'Sbírka receptů (PDF)', file: 'kucharka-recepty.pdf' },
  { ico: '🧮', t: 'Kalkulačka kalorií a makroživin', d: 'Online kalkulačka přímo v kurzu', link: '/akademie/videokurz/kalkulacka/' },
  { ico: '📄', t: 'Výpočty hubnutí a nabírání', d: 'Tahák s výpočty (PDF)', file: 'vypocty.pdf' },
  { ico: '📄', t: 'Videokurz — výpočty a přílohy', d: 'Doprovodné PDF', file: 'videokurz-prilohy.pdf' },
  { ico: '📊', t: 'Report pro coache', d: 'Šablona s grafem (Excel)', file: 'report-coache.xlsx' },
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
<style>
  :root { --gold:#ff7a00; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Poppins',Arial,sans-serif; color:#1d1a16; background:#f6f1ea; line-height:1.6; }
  .top { position:sticky; top:0; z-index:50; background:#161616; color:#fff; }
  .top .in { max-width:900px; margin:0 auto; padding:11px 18px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
  .brand { display:flex; align-items:center; gap:9px; text-decoration:none; color:#fff; font-weight:800; font-size:.95rem; }
  .brand .mark { width:28px; height:28px; border-radius:7px; background:var(--gold); color:#161616; font-weight:800; display:flex; align-items:center; justify-content:center; font-size:.82rem; }
  .top a.back { color:#bbb; text-decoration:none; font-size:.86rem; }
  .wrap { max-width:880px; margin:0 auto; padding:28px 18px 80px; }
  .hero h1 { font-size:1.7rem; letter-spacing:-.01em; }
  .hero p { color:#6f655a; margin-top:.3rem; }
  .bigbar { height:9px; background:#e7ddcf; border-radius:9px; margin:16px 0 6px; overflow:hidden; }
  .bigbar span { display:block; height:100%; width:0; background:var(--gold); transition:width .3s; }
  .bigpct { font-size:.85rem; color:#6f655a; margin-bottom:8px; }
  .module { background:#fff; border:1px solid #ece3d8; border-radius:16px; padding:6px 18px 10px; margin:16px 0; }
  .mhead { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 0 8px; border-bottom:1px solid #f1eadf; }
  .mhead h2 { font-size:1.08rem; }
  .mhead .cnt { color:#a89c8c; font-size:.82rem; white-space:nowrap; }
  .lessons { list-style:none; }
  .lesson a { display:flex; align-items:center; gap:12px; padding:12px 4px; text-decoration:none; color:#1d1a16; border-bottom:1px solid #f6f1ea; }
  .lesson:last-child a { border-bottom:none; }
  .lesson .chk { width:20px; height:20px; border-radius:50%; border:2px solid #d8cab6; flex-shrink:0; }
  .lesson.done .chk { background:#34a853; border-color:#34a853; position:relative; }
  .lesson.done .chk::after { content:"✓"; color:#fff; font-size:.72rem; position:absolute; inset:0; display:flex; align-items:center; justify-content:center; }
  .lesson .lt { flex:1; }
  .lesson.done .lt { color:#8a8073; }
  .lesson .go { color:var(--gold); font-weight:700; font-size:.85rem; white-space:nowrap; }
  .note { text-align:center; color:#a89c8c; font-size:.8rem; margin-top:22px; }
  .matcard { background:#fff; border:1px solid #ece3d8; border-radius:16px; padding:6px 18px 12px; margin:16px 0; }
  .matcard h2 { font-size:1.08rem; padding:12px 0 8px; border-bottom:1px solid #f1eadf; }
  .mats { list-style:none; }
  .mat { display:flex; align-items:center; gap:12px; padding:12px 4px; border-bottom:1px solid #f6f1ea; }
  .mat:last-child { border-bottom:none; }
  .mico { font-size:1.3rem; width:30px; text-align:center; flex-shrink:0; }
  .minfo { flex:1; display:flex; flex-direction:column; }
  .minfo small { color:#8a8073; font-size:.8rem; }
  .mbtn { background:var(--gold); color:#161616; font-weight:700; padding:9px 16px; border-radius:50px; border:none; cursor:pointer; text-decoration:none; font-family:inherit; font-size:.85rem; white-space:nowrap; }
  .mbtn:hover { background:#161616; color:#fff; }
  .mbtn[disabled] { opacity:.5; cursor:default; }
</style>
</head>
<body>
  <div class="top"><div class="in">
    <a class="brand" href="/akademie/videokurz/"><span class="mark">MB</span> Videokurz</a>
    <a class="back" href="/akademie/">← Členská sekce</a>
  </div></div>

  <div class="wrap">
    <div class="hero">
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
          if(!window.BA){ alert('Materiály jsou dostupné po přihlášení.'); return; }
          var orig=btn.textContent; btn.textContent='Připravuji…'; btn.disabled=true;
          window.BA.ready.then(function(){
            window.BA.materialUrl(BUCKET, file).then(function(url){
              btn.textContent=orig; btn.disabled=false;
              if(url){ window.open(url, '_blank'); }
              else { alert('Soubor zatím není dostupný nebo nemáš aktivní přístup. Pokud jsi právě zaplatil, zkus to za chvíli.'); }
            });
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
