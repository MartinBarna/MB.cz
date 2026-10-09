/* Vygeneruje _cloud/videa-v2/TEXTY-V2.md (texty na obrazovce s časy, změny proti schválenému znění, zdroje).
   node _cloud/videa-v2/src/texty.js */
const fs = require('fs'); const path = require('path');
global.window = {}; eval(fs.readFileSync(path.join(__dirname, 'videos.js'), 'utf8'));
const VID = window.VIDEOS;
const clean = s => String(s).replace(/\[\[(.+?)\]\]/g, '$1').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
const f = t => t.toFixed(1).replace('.', ',');
const TYP = { phone: 'appka', type: 'titulek', icon: 'ikona', stat: 'číslo', step: 'krok', list: 'výčet', quote: 'citace', bars: 'graf', photo: 'foto', pcard: 'foto', end: 'závěrečná karta' };
function texts(s) {
  const o = [];
  if (s.kick) o.push(`[nad titulkem] ${clean(s.kick)}`);
  if (s.cap) o.push(clean(s.cap));
  if (s.sub) o.push(clean(s.sub));
  if (s.num) o.push(`${s.num} ${s.lab || ''}`.trim());
  if (s.items) o.push(s.items.map(clean).join(' → '));
  if (s.bars) o.push(s.bars.map(b => `${b.n} ${b.tag}`).join(' · '));
  if (s.kind === 'end') o.push([s.prod, `${s.price} ${s.unit || ''}`.trim(), s.note ? clean(s.note) : null, `[tlačítko] ${s.btn}`, s.url].filter(Boolean).join(' · '));
  return o.join('<br>');
}
let md = `# Texty promo videí v2\n\nVygenerováno z \`src/videos.js\` (\`node _cloud/videa-v2/src/texty.js\`).\n` +
  `Základ: schválené titulky z \`_cloud/videa/TEXTY.md\` (po kole hlasu Martina). Věty delší než 6 slov jsou rozdělené do po sobě jdoucích záběrů (znění se tím nemění).\n` +
  `Kde se znění muselo změnit, je to ve sloupci „Změna“ a souhrnně dole. Bez zvuku čitelné, mluvené slovo videa nemají.\n`;
const changes = [];
for (const [id, v] of Object.entries(VID)) {
  md += `\n## ${id}.mp4 (${v.dur} s, ${v.shots.length} záběrů)\n\n`;
  if (v.cover) md += `**Cover (${id}-cover.png):** ${v.cover.kick ? clean(v.cover.kick) + ' / ' : ''}${clean(v.cover.cap)} · štítek: ${clean(v.cover.chip)} (schválený titulek coveru z TEXTY.md, vizuál ze záběru ${v.cover.shot || 0})\n\n`;
  md += `| Čas | Záběr | Text na obrazovce | Změna proti schválenému | Zdroj |\n|---|---|---|---|---|\n`;
  v.shots.forEach(s => {
    md += `| ${f(s.t[0])}–${f(s.t[1])} | ${TYP[s.kind] || s.kind} | ${texts(s)} | ${s.zmena || ''} | ${(s.src || '').replace(/\|/g, '/')} |\n`;
    if (s.zmena) changes.push(`- **${id}** (${f(s.t[0])} s): ${s.zmena}`);
  });
}
md += `\n## Všechny změny znění proti schválenému\n\n${[...new Set(changes)].join('\n')}\n`;
fs.writeFileSync(path.join(__dirname, '..', 'TEXTY-V2.md'), md);
const coverTxt = Object.values(VID).map(v => v.cover ? clean(v.cover.cap) + ' ' + clean(v.cover.chip) + ' ' + (v.cover.kick || '') : '').join('\n');
const bad = [/—/, /Odemkni/i, /Revoluční/i, /Klíčem je/i, /Pojďme/i, /Cesta k/i, /Transformac/i, /Není to jen/i, /!/, /24\/7/];
bad.forEach(r => { const body = md.replace(/\| [^|]*\|\n/g, m => m); const m = Object.values(VID).flatMap(v => v.shots.map(texts)).concat(coverTxt).join('\n').match(r); if (m) console.log('POZOR v textech:', r, m[0]); });
console.log('TEXTY-V2.md hotovo,', changes.length, 'změn');
