// Mechanical PDF generator: extract content from each web lesson HTML, wrap in print template.
const fs = require('fs');
const path = require('path');

const ROOT = require("path").resolve(__dirname, "../..");
const STUDY = path.join(ROOT, 'akademie/studium');
const OUTDIR = process.argv[2] || require("path").join(ROOT, "akademie/_pdf/build");
fs.mkdirSync(OUTDIR, { recursive: true });

const HEAD = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<style>
  @font-face { font-family:'Poppins'; font-weight:400; src:url('file://${ROOT}/assets/vendor/fonts/poppins-latin-400.woff2') format('woff2'); unicode-range:U+0000-00FF,U+0152-0153,U+2000-206F,U+20AC,U+2122,U+2212; }
  @font-face { font-family:'Poppins'; font-weight:400; src:url('file://${ROOT}/assets/vendor/fonts/poppins-latin-ext-400.woff2') format('woff2'); unicode-range:U+0100-024F,U+1E00-1EFF,U+2C60-2C7F,U+A720-A7FF; }
  @font-face { font-family:'Poppins'; font-weight:600; src:url('file://${ROOT}/assets/vendor/fonts/poppins-latin-600.woff2') format('woff2'); unicode-range:U+0000-00FF,U+0152-0153,U+2000-206F,U+20AC,U+2122,U+2212; }
  @font-face { font-family:'Poppins'; font-weight:600; src:url('file://${ROOT}/assets/vendor/fonts/poppins-latin-ext-600.woff2') format('woff2'); unicode-range:U+0100-024F,U+1E00-1EFF,U+2C60-2C7F,U+A720-A7FF; }
  @font-face { font-family:'Poppins'; font-weight:800; src:url('file://${ROOT}/assets/vendor/fonts/poppins-latin-800.woff2') format('woff2'); unicode-range:U+0000-00FF,U+0152-0153,U+2000-206F,U+20AC,U+2122,U+2212; }
  @font-face { font-family:'Poppins'; font-weight:800; src:url('file://${ROOT}/assets/vendor/fonts/poppins-latin-ext-800.woff2') format('woff2'); unicode-range:U+0100-024F,U+1E00-1EFF,U+2C60-2C7F,U+A720-A7FF; }
  @page { size:A4; margin:18mm 16mm 20mm; }
  * { box-sizing:border-box; margin:0; padding:0; }
  html,body { font-family:'Poppins','Segoe UI',Arial,sans-serif; color:#1d1a16; line-height:1.6; font-size:11.2pt; }
  .cover { background:linear-gradient(135deg,#222,#0d0d0d); color:#fff; border-radius:16px; padding:30px 28px; margin-bottom:22px; }
  .cover .mark { width:46px; height:46px; border-radius:12px; background:#ff7a00; color:#161616; font-weight:800; font-size:1.1rem; display:flex; align-items:center; justify-content:center; }
  .cover .kick { display:inline-block; margin-top:16px; background:rgba(255,122,0,.18); color:#ffb066; font-weight:700; font-size:8.5pt; letter-spacing:1.5px; text-transform:uppercase; padding:5px 13px; border-radius:50px; }
  .cover h1 { font-size:21pt; line-height:1.15; margin:10px 0 4px; letter-spacing:-.3px; }
  .cover .mod { color:#cfcabf; font-size:10pt; }
  h1 { font-size:18pt; }
  h2 { font-size:13pt; color:#161616; margin:16px 0 5px; }
  p { margin:7px 0; }
  .lead { font-size:11.8pt; color:#3a352e; }
  .points { background:#faf6f0; border:1px solid #efe4d6; border-radius:11px; padding:12px 16px; margin:12px 0; }
  .points strong, .points b { display:block; margin-bottom:4px; }
  .points li { margin:3px 0 3px 16px; }
  .praxe { background:#fff8f0; border:1px solid #f3dcbd; border-left:4px solid #ff7a00; border-radius:10px; padding:11px 15px; margin:11px 0; }
  .praxe b { color:#c45e00; }
  .eq { text-align:center; font-weight:800; background:#161616; color:#fff; border-radius:9px; padding:11px; margin:11px 0; font-size:10.5pt; }
  .card { background:#fff; border:1px solid #ece3d8; border-radius:11px; padding:11px 15px; margin:11px 0; }
  blockquote { border-left:4px solid #ff7a00; padding:4px 0 4px 14px; color:#5a5045; font-style:italic; margin:11px 0; }
  .src { margin-top:18px; font-size:8.6pt; color:#7a7264; border-top:1px solid #eee2d4; padding-top:10px; }
  .src b { color:#5a5045; }
  .src ol { margin:5px 0 0 16px; } .src li { margin:1px 0; }
  .foot { margin-top:14px; text-align:center; font-size:8.4pt; color:#a89c8c; }
  .foot b { color:#c45e00; }
</style>
</head>
<body>`;

function textOnly(html) { return html.replace(/<[^>]+>/g, '').trim(); }

function build(dir) {
  const file = path.join(STUDY, dir, 'index.html');
  const s = fs.readFileSync(file, 'utf8');

  const crumb = (s.match(/<div class="crumb">([\s\S]*?)<\/div>/) || [])[1] || '';
  const title = (s.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1] || dir;

  // Region from after first </h1> up to the quiz block = lead + intro + points + body
  const afterH1 = s.split('</h1>')[1] || '';
  let body = afterH1.split(/<div class="quiz"/)[0] || '';
  body = body.trim();

  // Task: the card after quiz containing 📌
  let taskInner = '';
  const taskM = s.match(/<div class="card"[^>]*>\s*<strong>📌[^<]*<\/strong>([\s\S]*?)<\/div>/);
  if (taskM) taskInner = taskM[1].trim();

  // Sources: <ol> inside details.src or div.src
  let sources = '';
  const srcM = s.match(/class="src"[\s\S]*?<ol>([\s\S]*?)<\/ol>/);
  if (srcM) sources = srcM[1].trim();

  let out = HEAD;
  out += `\n  <div class="cover">\n    <div class="mark">MB</div>\n    <span class="kick">Barna Academy</span>\n    <h1>${title}</h1>\n    <div class="mod">${crumb}</div>\n  </div>\n`;
  out += '\n' + body + '\n';
  if (taskInner) out += `\n  <div class="points"><b>📌 Úkol do praxe:</b> ${taskInner}</div>\n`;
  if (sources) out += `\n  <div class="src">\n    <b>Vědecké zdroje (výběr):</b>\n    <ol>\n${sources}\n    </ol>\n  </div>\n`;
  out += `  <div class="foot"><b>© Barna Academy</b> — Martin Barna · martinbarna.cz · materiál pro studenty Akademie</div>\n</body>\n</html>`;

  // sanity
  const issues = [];
  if (!title || textOnly(title).length < 3) issues.push('no-title');
  if (textOnly(body).length < 200) issues.push('thin-body(' + textOnly(body).length + ')');
  if (!sources) issues.push('no-sources');
  if (/\{\{/.test(out)) issues.push('leftover');

  const htmlPath = path.join(OUTDIR, dir + '.html');
  fs.writeFileSync(htmlPath, out);
  return { dir, htmlPath, bodyLen: textOnly(body).length, issues };
}

const dirs = fs.readdirSync(STUDY).filter(d => /^m\d+-l\d+$/.test(d))
  .sort((a, b) => {
    const [am, al] = a.slice(1).split('-l').map(Number);
    const [bm, bl] = b.slice(1).split('-l').map(Number);
    return am - bm || al - bl;
  });

const only = process.argv[3]; // optional single dir
const targets = only ? dirs.filter(d => d === only) : dirs;
const results = targets.map(build);
results.forEach(r => { if (r.issues.length) console.log('⚠ ', r.dir, r.issues.join(',')); });
console.log('Built', results.length, 'HTML files. With issues:', results.filter(r => r.issues.length).length);
fs.writeFileSync(path.join(OUTDIR, '_manifest.json'), JSON.stringify(results, null, 2));
