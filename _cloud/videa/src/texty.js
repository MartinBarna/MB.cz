/* Vygeneruje _cloud/videa/TEXTY.md a ZDROJE.md ze scénářů (videos.js), ať texty a videa nemůžou rozjet.
   node _cloud/videa/src/texty.js */
const fs = require('fs'); const path = require('path');
const window = {}; eval(fs.readFileSync(path.join(__dirname, 'videos.js'), 'utf8').replace('window.VIDEOS', 'window.VIDEOS'));
const V = window.VIDEOS;
const clean = s => String(s).replace(/\[\[(.+?)\]\]/g, '$1').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
const fmtT = t => t.toFixed(1).replace('.', ',');
const TYPE = { hook: 'háček', text: 'titulek', card: 'záběr', rows: 'výčet', stats: 'čísla', quote: 'citace', bars: 'grafika', photo: 'foto', cta: 'výzva k akci' };
function texts(s) {
  const out = [];
  for (const k of ['kicker', 'h', 'cap', 'bubble', 'q', 'sub', 'label']) if (s[k] && typeof s[k] === 'string') out.push(k === 'bubble' ? `[bublina] ${clean(s[k])}` : clean(s[k]));
  if (s.rows) s.rows.forEach(r => out.push('• ' + clean(r.lab) + (r.desc ? ` (${clean(r.desc)})` : '')));
  if (s.stats) s.stats.forEach(r => out.push('• ' + (r.num != null ? r.num + (r.suf || '') : clean(r.txt)) + ' ' + clean(r.lab)));
  if (s.bars) s.bars.forEach(r => out.push('• ' + clean(r.n) + ': ' + clean(r.tag)));
  if (s.price) out.push(clean(s.price) + (s.unit ? ' ' + clean(s.unit) : ''));
  for (const k of ['alt', 'box', 'url', 'small']) if (s[k]) out.push(clean(s[k]));
  return out;
}
let md = `# Texty promo videí (návrh k projetí hlasem Martina)\n\nVygenerováno z \`src/videos.js\` (\`node _cloud/videa/src/texty.js\`). Co se změní ve scénáři, změní se i tady.\nČas = od–do v sekundách. Texty jsou jen titulky na obrazovce, mluvené slovo videa nemají.\n`;
let zd = `# Zdroje tvrzení ve videích\n\nKe každé scéně: odkud je tvrzení. TC = \`tvuj-coach/index.html\`, VK = \`videokurz.html\`, AK = \`akademie/index.html\`, KO = \`koucing/index.html\` (viditelný text stránky, staženo z lokálního serveru 9. 10. 2026).\n`;
for (const [id, v] of Object.entries(V)) {
  md += `\n## ${id}.mp4 (${v.dur} s)\n\n| Čas | Typ | Text na obrazovce |\n|---|---|---|\n`;
  zd += `\n## ${id}\n\n`;
  v.scenes.forEach(s => {
    md += `| ${fmtT(s.t[0])}–${fmtT(s.t[1])} | ${TYPE[s.type] || s.type} | ${texts(s).join('<br>')} |\n`;
    zd += `- **${fmtT(s.t[0])}–${fmtT(s.t[1])} s** (${TYPE[s.type] || s.type}): ${(s.src || ['bez tvrzení']).join(' · ')}\n`;
  });
  md += `| cover | obrázek | ${texts(v.cover).join('<br>')} |\n`;
}
fs.writeFileSync(path.join(__dirname, '..', 'TEXTY.md'), md);
fs.writeFileSync(path.join(__dirname, '..', 'ZDROJE.md'), zd);
// kontrola zakázaných znaků a frází
const all = md;
const bad = [/—/, /Odemkni/i, /Revoluční/i, /Klíčem je/i, /Pojďme/i, /Cesta k/i, /Transformac/i, /Není to jen/i, /!/];
bad.forEach(r => { const m = all.match(r); if (m) console.log('POZOR:', r, '→', all.slice(Math.max(0, m.index - 40), m.index + 40)); });
console.log('TEXTY.md + ZDROJE.md hotovo');
