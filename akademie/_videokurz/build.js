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
  // --- NOVÉ bonusové materiály (token-driven, hostované staticky na /materialy/pdf/) ---
  { ico: '😴', t: 'Spánek & regenerace', d: 'NOVÉ — průvodce pro klienty (PDF)', link: '/materialy/pdf/spanek-a-regenerace.pdf?v=20260629' },
  { ico: '✋', t: 'Porce bez vážení', d: 'NOVÉ — porcování rukou (PDF)', link: '/materialy/pdf/porce-bez-vazeni.pdf?v=20260629' },
  { ico: '✅', t: 'Deník návyků', d: 'NOVÉ — týdenní tracker (PDF)', link: '/materialy/pdf/denik-navyku.pdf?v=20260629' },
  { ico: '📦', t: 'Uvítací balíček', d: 'NOVÉ — onboarding klienta (PDF)', link: '/materialy/pdf/uvitaci-balicek.pdf?v=20260629' },
  { ico: '🍕', t: 'Flexibilní stravování', d: 'NOVÉ — průvodce pro klienty (PDF)', link: '/materialy/pdf/flexibilni-strava.pdf?v=20260629' },
  { ico: '🍳', t: 'High-protein receptář', d: 'NOVÉ — 12 receptů s makry (PDF)', link: '/materialy/pdf/high-protein-recepty.pdf?v=20260629' },
  { ico: '🏋️', t: 'Tréninkový plán (full-body)', d: 'NOVÉ — 3denní plán pro začátečníky (PDF)', link: '/materialy/pdf/treninkovy-plan.pdf?v=20260629' },
  { ico: '💊', t: 'Suplementy — co funguje', d: 'NOVÉ — evidence-based průvodce (PDF)', link: '/materialy/pdf/suplementy-co-funguje.pdf?v=20260629' },
  { ico: '💧', t: 'Hydratace a pitný režim', d: 'NOVÉ — kolik pít a proč (PDF)', link: '/materialy/pdf/hydratace-pitny-rezim.pdf?v=20260629' },
  { ico: '🍽️', t: 'Jídlo v restauraci a na cestách', d: 'NOVÉ — forma i venku (PDF)', link: '/materialy/pdf/jidlo-v-restauraci.pdf?v=20260629' },
  { ico: '🚶', t: 'Kroky, NEAT a cardio', d: 'NOVÉ — kolik a kdy (PDF)', link: '/materialy/pdf/kroky-a-cardio.pdf?v=20260629' },
  { ico: '🧘', t: 'Stres, kortizol a hubnutí', d: 'NOVÉ — mýtus vs realita (PDF)', link: '/materialy/pdf/stres-a-kortizol.pdf?v=20260629' },
  { ico: '🔬', t: 'Jak číst vědecké studie', d: 'NOVÉ — hierarchie důkazů (PDF)', link: '/materialy/pdf/jak-cist-studie.pdf?v=20260629' },
  { ico: '🔰', t: 'Jak začít cvičit', d: 'NOVÉ — průvodce pro začátečníky (PDF)', link: '/materialy/pdf/zacni-cvicit.pdf?v=20260629' },
  { ico: '📉', t: 'Plató — když se váha zastaví', d: 'NOVÉ — co dělat (PDF)', link: '/materialy/pdf/plato-zastavena-vaha.pdf?v=20260629' },
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
// Free tier (#35/#37): ochutnávka napříč kurzem — Modul 1 první 4 lekce + první lekce
// z každého dalšího modulu (m2–m8), ať návštěvník vidí šíři kurzu → silnější upsell na koupi.
const BUY_URL = 'https://form.simpleshop.cz/3Vbl/buy/';
const _secSeen = {};
ordered.forEach((v) => {
  const k = v.sec; _secSeen[k] = (_secSeen[k] || 0) + 1; const idx = _secSeen[k];
  if (k === 'm1') v.free = idx <= 4;
  else if (/^m[2-8]$/.test(k)) v.free = idx <= 1;
  else v.free = false;
});
const FREE_COUNT = ordered.filter((v) => v.free).length;

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
<link rel="stylesheet" href="/assets/ba-ui.css">
<style>
  .wrap { max-width:880px; margin:0 auto; padding:30px 18px 80px; }
  .crumb { color:var(--gold-soft); font-size:.74rem; font-weight:700; letter-spacing:.18em; text-transform:uppercase; }
  h1 { font-size:clamp(1.5rem,3.5vw,2rem); line-height:1.2; color:#fff; margin:.5rem 0 1.3rem; letter-spacing:-.02em; }
  .video { position:relative; padding-top:56.25%; background:#000; border-radius:18px; overflow:hidden; border:1px solid var(--line); box-shadow:0 30px 60px -30px rgba(0,0,0,.9); }
  .video iframe { position:absolute; inset:0; width:100%; height:100%; border:0; }
  .done-row { margin-top:1.7rem; display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
  .btn { background:linear-gradient(145deg,var(--gold-2),var(--gold)); color:#160d04; font-weight:700; padding:13px 24px; border-radius:50px; border:none; cursor:pointer; text-decoration:none; display:inline-block; font-family:inherit; font-size:.95rem; box-shadow:0 12px 26px -8px rgba(255,122,0,.55); transition:transform .2s; }
  .btn:hover { transform:translateY(-2px); }
  .btn.ghost { background:rgba(255,255,255,.05); border:1px solid var(--line-2); color:var(--muted-2); box-shadow:none; }
  .btn.ghost:hover { border-color:rgba(255,122,0,.4); color:#fff; transform:none; }
  .btn.is-done { background:linear-gradient(145deg,#2fae57,#1f9647); color:#fff; box-shadow:0 12px 26px -8px rgba(47,174,87,.5); }
  .nav { margin-top:1.5rem; display:flex; justify-content:space-between; gap:10px; }
  .foot { margin-top:2rem; font-size:.8rem; color:var(--muted); }
  .upsell { display:block; margin-top:1.6rem; text-decoration:none; background:linear-gradient(135deg,rgba(255,122,0,.18),rgba(255,122,0,.05)); border:1px solid rgba(255,122,0,.4); border-radius:16px; padding:16px 20px; color:var(--muted-2); font-size:.95rem; line-height:1.55; transition:transform .2s,border-color .2s; }
  .upsell:hover { transform:translateY(-2px); border-color:rgba(255,122,0,.7); }
  .upsell b { color:#fff; }
  .upsell .go2 { display:block; margin-top:8px; color:var(--gold-soft); font-weight:700; }
</style>
</head>
<body class="ba">
  <div class="top"><div class="in">
    <a class="brand" href="/akademie/videokurz/"><span class="mark">MB</span><span><b>Videokurz</b><span class="tag">Barna Academy</span></span></a>
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

    ${v.free ? `<a class="upsell" href="${BUY_URL}"><b>🎁 Tohle je ochutnávka zdarma.</b> Celý videokurz — 182 videí + všechny bonusy (kuchařka, e-booky, 7 PDF průvodců) — odemkneš jednorázově za 800 Kč, s kódem <b>ZACNI15</b> jen 680 Kč. Doživotně.<span class="go2">Odemknout celý kurz — 680 Kč s ZACNI15 →</span></a>` : ''}

    <p class="foot">© Videokurz Martin Barna.${v.free ? ' Tato lekce je dostupná zdarma jako ochutnávka.' : ' Video je dostupné jen přihlášeným s aktivním přístupem.'}</p>
  </div>

  <script src="/assets/ba-config.js"></script>
  <script src="/assets/ba-academy.js"></script>
  <script src="/assets/academy-upsell.js" defer></script>
  <script src="/assets/scroll-top.js" defer></script>
  <script>
    var LID='${v.lid}', PRODUCT='videokurz', FREE=${v.free ? 'true' : 'false'}, GUEST=false, state={done:false};
    var btn=document.getElementById('doneBtn');
    function paint(){ if(state.done){ btn.classList.add('is-done'); btn.textContent='Zhlédnuto ✓ (klikni pro zrušení)'; } else { btn.classList.remove('is-done'); btn.textContent='Označit jako zhlédnuté ✓'; } }
    function lsDone(){ try{ return !!JSON.parse(localStorage.getItem('ba_progress_v1')||'{}')[LID]; }catch(e){ return false; } }
    function lsSet(d){ try{ var o=JSON.parse(localStorage.getItem('ba_progress_v1')||'{}'); if(d) o[LID]=true; else delete o[LID]; localStorage.setItem('ba_progress_v1', JSON.stringify(o)); }catch(e){} }
    function load(){
      if (window.BA){
        window.BA.ready.then(function(){
          if (window.BA.mode==='live'){
            if (FREE) {
              // Ochutnávka zdarma: lekce je veřejná, hrá i bez přihlášení (žádný redirect-loop).
              window.BA.getUser().then(function(u){
                if(!u){ GUEST=true; state.done=lsDone(); paint(); return; }
                window.BA.getProgress().then(function(d){ state.done=!!d[LID]; paint(); });
              });
            }
            else { window.BA.requireAccess(PRODUCT).then(function(ok){ if(!ok) return; window.BA.getProgress().then(function(d){ state.done=!!d[LID]; paint(); }); }); }
          }
          else { window.BA.getProgress().then(function(d){ state.done=!!d[LID]; paint(); }); }
        });
      } else { state.done=lsDone(); paint(); }
    }
    btn.addEventListener('click', function(){ state.done=!state.done; paint(); if(GUEST){ lsSet(state.done); } else if(window.BA){ window.BA.setDone(PRODUCT, LID, state.done); } else { lsSet(state.done); } });
    load();
  </script>
</body>
</html>`;
}

// ---- nástěnka ----
function dashboard() {
  // Data sekcí pro klientský sekční router (přehled ↔ fokus na sekci).
  const secsData = SECTIONS.filter(s => s.list.length).map(s => ({
    name: s.name,
    videos: s.list.map(v => ({ lid: v.lid, disp: v.disp, slug: v.slug, free: !!v.free }))
  }));
  const secsJson = JSON.stringify(secsData);
  const matsJson = JSON.stringify(MATERIALS.map(m => ({ ico: m.ico, t: m.t, d: m.d, link: m.link || '', file: m.file || '' })));

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
  .mat { display:flex; align-items:center; gap:12px; padding:13px 14px; border-radius:14px; background:rgba(255,255,255,.03); border:1px solid var(--line); transition:border-color .2s, transform .2s; min-width:0; }
  .mat:hover { border-color:rgba(255,122,0,.3); transform:translateY(-2px); }
  .mico { font-size:1.35rem; width:30px; text-align:center; flex-shrink:0; }
  .minfo { flex:1; display:flex; flex-direction:column; min-width:0; }
  .minfo b { color:#fff; font-size:.92rem; line-height:1.25; overflow-wrap:break-word; }
  .minfo small { color:var(--muted); font-size:.78rem; }
  .mbtn { background:linear-gradient(145deg,var(--gold-2),var(--gold)); color:#160d04; font-weight:700; padding:9px 15px; border-radius:50px; border:none; cursor:pointer; text-decoration:none; font-family:inherit; font-size:.82rem; white-space:nowrap; box-shadow:0 8px 18px -8px rgba(255,122,0,.6); transition:transform .2s; }
  .mbtn:hover { transform:translateY(-1px); }
  .mbtn[disabled] { opacity:.5; cursor:default; transform:none; }

  /* ---- sekční navigace (#33): přehled sekcí → fokus na sekci ---- */
  .modgrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:14px; margin-top:8px; }
  .modcard { text-align:left; cursor:pointer; background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.02)); border:1px solid var(--line); border-radius:18px; padding:20px; display:flex; flex-direction:column; gap:11px; transition:transform .2s,border-color .2s,box-shadow .2s; color:inherit; text-decoration:none; }
  .modcard:hover { transform:translateY(-4px); border-color:rgba(255,122,0,.35); box-shadow:0 24px 46px -28px rgba(255,122,0,.28); }
  .modcard .top { display:flex; align-items:center; gap:12px; }
  .modcard .ix { width:36px; height:36px; border-radius:11px; background:linear-gradient(145deg,var(--gold-2),var(--gold)); color:#160d04; font-weight:800; font-size:.92rem; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .modcard h3 { font-size:1rem; color:#fff; line-height:1.25; }
  .modcard .mbar { height:6px; background:rgba(255,255,255,.08); border-radius:50px; overflow:hidden; }
  .modcard .mbar span { display:block; height:100%; background:linear-gradient(90deg,var(--gold),var(--gold-soft)); border-radius:50px; }
  .modcard .mfoot { display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .modcard .cnt { font-size:.8rem; color:var(--muted-2); font-weight:600; }
  .modcard .pct { font-size:.74rem; color:var(--gold-soft); font-weight:700; background:rgba(255,122,0,.1); border:1px solid rgba(255,122,0,.22); padding:3px 10px; border-radius:50px; }
  .modcard.done-all { border-color:rgba(47,174,87,.45); }
  .modcard.done-all .pct { color:#86e29a; background:rgba(47,174,87,.12); border-color:rgba(47,174,87,.3); }
  .backlink { display:inline-flex; align-items:center; gap:7px; color:var(--muted-2); text-decoration:none; font-weight:600; font-size:.9rem; margin-bottom:16px; background:rgba(255,255,255,.05); border:1px solid var(--line); padding:9px 16px; border-radius:50px; transition:.2s; }
  .backlink:hover { border-color:rgba(255,122,0,.4); color:#fff; }
  .secnav { display:flex; align-items:stretch; gap:12px; margin-top:24px; flex-wrap:wrap; }
  .secnav a { flex:1; min-width:210px; text-decoration:none; border-radius:16px; padding:16px 20px; display:flex; flex-direction:column; gap:3px; border:1px solid var(--line); transition:transform .2s,border-color .2s,box-shadow .2s; }
  .secnav .lbl { font-size:.72rem; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); font-weight:700; }
  .secnav .nm { font-weight:700; color:#fff; font-size:.96rem; }
  .secnav .prev { background:rgba(255,255,255,.03); }
  .secnav .next { background:linear-gradient(145deg,rgba(255,122,0,.16),rgba(255,122,0,.05)); border-color:rgba(255,122,0,.35); text-align:right; align-items:flex-end; }
  .secnav .next .nm { color:var(--gold-soft); }
  .secnav a:hover { transform:translateY(-3px); box-shadow:0 22px 40px -26px rgba(255,122,0,.35); border-color:rgba(255,122,0,.5); }
  .contbtn { display:inline-flex; align-items:center; gap:8px; margin-top:1.2rem; background:linear-gradient(145deg,var(--gold-2),var(--gold)); color:#160d04; font-weight:700; padding:12px 24px; border-radius:50px; border:none; cursor:pointer; font-family:inherit; font-size:.95rem; box-shadow:0 12px 26px -8px rgba(255,122,0,.55); transition:transform .2s; text-decoration:none; }
  .contbtn:hover { transform:translateY(-2px); }
  /* free tier (ochutnávka) */
  .freebanner { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; text-decoration:none; background:linear-gradient(135deg,rgba(255,122,0,.2),rgba(255,122,0,.05)); border:1px solid rgba(255,122,0,.45); border-radius:18px; padding:18px 22px; margin:8px 0 4px; transition:transform .2s,border-color .2s; }
  .freebanner:hover { transform:translateY(-2px); border-color:rgba(255,122,0,.75); }
  .freebanner .fb-txt { display:flex; flex-direction:column; gap:3px; min-width:240px; flex:1; }
  .freebanner .fb-txt b { color:#fff; font-size:1.06rem; }
  .freebanner .fb-txt span { color:var(--muted-2); font-size:.9rem; }
  .freebanner .fb-cta { background:linear-gradient(145deg,var(--gold-2),var(--gold)); color:#160d04; font-weight:700; padding:12px 22px; border-radius:50px; white-space:nowrap; }
  .lesson .lockrow { display:flex; align-items:center; gap:13px; padding:13px 8px; text-decoration:none; border-bottom:1px solid rgba(255,255,255,.05); border-radius:11px; transition:background .2s; }
  .lesson:last-child .lockrow { border-bottom:none; }
  .lesson .lockrow:hover { background:rgba(255,122,0,.07); }
  .lesson.locked .chk.lock { width:21px; height:21px; border:none; background:none; font-size:1rem; display:flex; align-items:center; justify-content:center; flex-shrink:0; opacity:.7; }
  .lesson.locked .lt { flex:1; font-size:.96rem; color:var(--muted); }
  .lesson.locked .go.buy { color:var(--gold-soft); font-weight:700; font-size:.82rem; white-space:nowrap; }
  .freetag { display:inline-block; font-size:.64rem; font-weight:800; letter-spacing:.04em; color:#160d04; background:var(--gold-soft); padding:1px 8px; border-radius:50px; margin-left:7px; vertical-align:middle; text-transform:uppercase; }
  body.freemode .matcard { display:none; }
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

    <a id="freeBanner" class="freebanner" href="${BUY_URL}" style="display:none;">
      <span class="fb-txt"><b>🎁 Máš ochutnávku zdarma</b><span>Odemčené máš ukázky napříč všemi moduly — vidíš, co tě v kurzu čeká. Celý kurz — 182 videí + všechny bonusy — odemkneš jednorázově za 800 Kč, s kódem ZACNI15 jen 680 Kč. Doživotně, bez měsíčních poplatků.</span></span>
      <span class="fb-cta">Odemknout — 680 Kč s ZACNI15 →</span>
    </a>

    <a href="/akademie/?from=videokurz" style="display:block;text-decoration:none;background:linear-gradient(135deg,rgba(255,122,0,.16),rgba(255,122,0,.05));border:1px solid rgba(255,122,0,.32);border-radius:18px;padding:20px 24px;margin:22px 0;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;">
      <span style="min-width:240px;flex:1;"><span style="display:inline-block;background:rgba(255,122,0,.18);color:var(--gold-soft);font-weight:700;font-size:.7rem;letter-spacing:.04em;padding:3px 10px;border-radius:50px;margin-bottom:7px;">PRO MAJITELE VIDEOKURZU</span><b style="color:#fff;font-size:1.08rem;display:block;">🎓 Další krok: Barna Academy</b><span style="color:var(--muted-2);font-size:.92rem;">Videokurz tě naučil <b style="color:#fff;">jak</b> jíst. Academy ti ukáže <b style="color:#fff;">proč</b> to funguje — celá věda za výživou a tréninkem (20 modulů, 219 lekcí) + certifikace, ať to umíš vysvětlit i klientům.</span></span>
      <span style="background:linear-gradient(145deg,var(--gold-2),var(--gold));color:#160d04;font-weight:700;padding:11px 22px;border-radius:50px;white-space:nowrap;">Prohlédnout Academy →</span>
    </a>

    <div id="modules"></div>

    <p class="note" id="modeNote">Ukázka prostředí. Přihlášení a uložení postupu se aktivuje po koupi (Supabase).</p>
  </div>

  <script src="/assets/ba-config.js"></script>
  <script src="/assets/ba-academy.js"></script>
  <script src="/assets/academy-upsell.js" defer></script>
  <script src="/assets/scroll-top.js" defer></script>
  <script>
    (function(){ var lo=document.getElementById('logout'); if(lo) lo.addEventListener('click', function(e){ e.preventDefault(); if(window.BA && window.BA.signOut){ window.BA.signOut().then(function(){ location.href='/akademie/prihlaseni/'; }); } else { location.href='/akademie/prihlaseni/'; } }); })();
    var TOTAL=${ordered.length};
    var SECS=${secsJson};
    var MATS=${matsJson};
    var DONE={};
    var BUY_URL='${BUY_URL}';
    var FREEMODE = /[?&]preview=free/.test(location.search);  // živě: zapne se i pro přihlášené bez nákupu
    function applyFreeMode(){ if(FREEMODE){ document.body.classList.add('freemode'); var b=document.getElementById('freeBanner'); if(b) b.style.display='flex'; } }
    function secDone(s){ var d=0; s.videos.forEach(function(v){ if(DONE[v.lid]) d++; }); return d; }
    function lessonLi(v){
      var dn=!!DONE[v.lid];
      if (FREEMODE && !v.free) {
        return '<li class="lesson locked"><a class="lockrow" href="'+BUY_URL+'"><span class="chk lock">🔒</span><span class="lt">'+v.disp+'</span><span class="go buy">Odemknout →</span></a></li>';
      }
      return '<li class="lesson'+(dn?' done':'')+'" data-lid="'+v.lid+'"><a href="/akademie/videokurz/'+v.slug+'/"><span class="chk"></span><span class="lt">'+v.disp+(v.free?'<span class="freetag">zdarma</span>':'')+'</span><span class="go">'+(v.free?'Přehrát zdarma →':'Otevřít →')+'</span></a></li>';
    }
    function renderOverview(){
      var h='<div class="modgrid">';
      // Přílohy jako PRVNÍ dlaždice — před Modulem 1.
      h+='<a class="modcard matcard-tile" href="#materialy"><div class="top"><span class="ix">📎</span><h3>Přílohy ke stažení</h3></div><div class="mfoot"><span class="cnt">'+MATS.length+' materiálů</span><span class="pct">'+(FREEMODE?'🔒 v ceně kurzu':'Otevřít →')+'</span></div></a>';
      SECS.forEach(function(s,i){ var d=secDone(s), t=s.videos.length, p=t?Math.round(d/t*100):0;
        h+='<a class="modcard'+(t&&d===t?' done-all':'')+'" href="#s'+(i+1)+'"><div class="top"><span class="ix">'+(i+1)+'</span><h3>'+s.name+'</h3></div><div class="mbar"><span style="width:'+p+'%"></span></div><div class="mfoot"><span class="cnt">'+t+' videí</span><span class="pct">'+p+' %</span></div></a>';
      });
      h+='</div>'; document.getElementById('modules').innerHTML=h;
    }
    function renderMaterials(){
      var li='';
      MATS.forEach(function(m){
        var label='<span class="lt">'+m.ico+'&nbsp; '+m.t+'<br><small style="color:var(--muted);font-weight:400">'+m.d+'</small></span>';
        if(FREEMODE){
          li+='<li class="lesson locked"><a class="lockrow" href="'+BUY_URL+'"><span class="chk lock">🔒</span>'+label+'<span class="go buy">V ceně kurzu →</span></a></li>';
        } else if(m.link){
          li+='<li class="lesson"><a href="'+m.link+'"><span class="chk" style="visibility:hidden"></span>'+label+'<span class="go">Otevřít →</span></a></li>';
        } else {
          li+='<li class="lesson"><div class="lockrow" style="cursor:default"><span class="chk" style="visibility:hidden"></span>'+label+'<button class="mbtn" type="button" data-file="'+m.file+'">Stáhnout ↓</button></div></li>';
        }
      });
      document.getElementById('modules').innerHTML='<a class="backlink" href="#prehled">← Všechny sekce</a><div class="module"><div class="mhead"><h2>📎 Přílohy ke stažení</h2><span class="cnt">'+MATS.length+' materiálů'+(FREEMODE?' · <b>v ceně kurzu</b>':'')+'</span></div><ul class="lessons">'+li+'</ul></div>';
      if(!FREEMODE) wireMaterials();
      try{ window.scrollTo(0,0); }catch(e){}
    }
    function renderSection(i){
      var s=SECS[i]; if(!s){ location.hash=''; return; }
      var d=secDone(s), t=s.videos.length, p=t?Math.round(d/t*100):0;
      var li=''; s.videos.forEach(function(v){ li+=lessonLi(v); });
      var nav='<div class="secnav">';
      if(i>0) nav+='<a class="prev" href="#s'+i+'"><span class="lbl">← Předchozí sekce</span><span class="nm">'+SECS[i-1].name+'</span></a>';
      if(i<SECS.length-1) nav+='<a class="next" href="#s'+(i+2)+'"><span class="lbl">Další sekce →</span><span class="nm">'+SECS[i+1].name+'</span></a>';
      nav+='</div>';
      document.getElementById('modules').innerHTML='<a class="backlink" href="#prehled">← Všechny sekce</a><div class="module"><div class="mhead"><h2>'+s.name+'</h2><span class="cnt">'+t+' videí · <b>'+p+' %</b></span></div><ul class="lessons">'+li+'</ul></div>'+nav;
      try{ window.scrollTo(0,0); }catch(e){}
    }
    function firstUnfinished(){ for(var i=0;i<SECS.length;i++){ if(secDone(SECS[i])<SECS[i].videos.length) return i; } return -1; }
    // #34 „Pokračovat, kde jsi skončil" — první nedokončené a přístupné video (deep-link do lekce).
    function nextVideo(){
      for(var i=0;i<SECS.length;i++){ var vs=SECS[i].videos;
        for(var j=0;j<vs.length;j++){ var v=vs[j]; if(!DONE[v.lid] && (!FREEMODE || v.free)) return v; } }
      return null;
    }
    function startedAny(){ for(var k in DONE){ if(DONE.hasOwnProperty(k) && DONE[k]) return true; } return false; }
    function route(){ var hsh=(location.hash||'').replace('#',''); if(hsh==='materialy'){ renderMaterials(); return; } var m=hsh.match(/^s(\\d+)$/); if(m) renderSection(parseInt(m[1],10)-1); else renderOverview(); }
    function render(done){
      DONE=done||{};
      var cnt=0; SECS.forEach(function(s){ cnt+=secDone(s); });
      var pct=TOTAL?Math.round(cnt/TOTAL*100):0;
      document.getElementById('bigbar').style.width=pct+'%';
      document.getElementById('bigpct').textContent='Tvůj postup: '+cnt+' / '+TOTAL+' zhlédnuto ('+pct+' %)';
      var hero=document.querySelector('.hero'), cb=document.getElementById('contBtn'), nv=nextVideo();
      if(!cb&&hero){ cb=document.createElement('a'); cb.id='contBtn'; cb.className='contbtn'; hero.appendChild(cb); }
      if(cb){ if(nv){ cb.style.display='inline-flex'; cb.textContent=(startedAny()?'▶ Pokračovat: ':'▶ Začít: ')+nv.disp; cb.href='/akademie/videokurz/'+nv.slug+'/'; } else { cb.style.display='none'; } }
      route();
    }
    window.addEventListener('hashchange', route);
    function boot(){
      if (window.BA){
        window.BA.ready.then(function(){
          if (window.BA.mode==='live'){
            window.BA.getUser().then(function(u){
              if(!u){
                // Nepřihlášený návštěvník → ochutnávka zdarma (žádný redirect na přihlášení).
                FREEMODE = true; applyFreeMode();
                var n0=document.getElementById('modeNote');
                if(n0) n0.textContent='Máš ochutnávku zdarma — odemčené máš ukázky napříč všemi moduly. Zbytek kurzu odemkneš jednorázovou koupí.';
                try{ render(JSON.parse(localStorage.getItem('ba_progress_v1')||'{}')); }catch(e){ render({}); }
                return;
              }
              window.BA.hasEntitlement('videokurz').then(function(has){
                if(!has) FREEMODE = true;          // přihlášený bez nákupu → ochutnávka + upsell
                applyFreeMode();
                var n=document.getElementById('modeNote');
                if(n) n.textContent = has
                  ? 'Tvůj postup se ukládá k účtu a synchronizuje se napříč zařízeními.'
                  : 'Máš ochutnávku zdarma — odemčené máš ukázky napříč všemi moduly. Zbytek kurzu odemkneš jednorázovou koupí.';
                window.BA.getProgress().then(render);
              });
            });
          } else { applyFreeMode(); window.BA.getProgress().then(render); }
        });
      } else { applyFreeMode(); try{ render(JSON.parse(localStorage.getItem('ba_progress_v1')||'{}')); }catch(e){ render({}); } }
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
