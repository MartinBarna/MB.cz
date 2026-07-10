#!/usr/bin/env node
// Vygeneruje shelly lekcí modulu 24 (AI pro trenéry) + zaregistruje modul do CURRICULUM.
// Obsah lekcí žije v DB (lesson_content), nahrává se zvlášť. Tady jen statické shelly + kurikulum.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const STUDY = path.join(ROOT, 'akademie/studium');

const MOD = 24;
const MOD_TITLE = 'AI pro trenéry a výživáře';
const MOD_DESC = 'Nejdůležitější dovednost letoška: jak s AI (na příkladu Clauda) zvládnout celý byznys rychleji a líp. Od pozicování přes onboarding, check-iny, jídelníčky a tréninky po obsah, reklamy a etické hranice. Vše směřuje na tvoje nástroje a tvou odbornost, ne od nich.';

const LESSONS = [
  ['m24-l1', 'Proč AI a proč právě teď'],
  ['m24-l2', 'Jak AI správně zadávat úkoly'],
  ['m24-l3', 'AI jako druhý mozek tvého byznysu'],
  ['m24-l4', 'Onboarding klienta s pomocí AI'],
  ['m24-l5', 'Check-iny: vyhodnocení a zpětná vazba s AI'],
  ['m24-l6', 'Jídelníčky a makra: AI jako pomocník, ne kalkulačka'],
  ['m24-l7', 'Tréninkové plány s pomocí AI'],
  ['m24-l8', 'Materiály pro klienty za zlomek času'],
  ['m24-l9', 'AI a věda: PubMed, studie a past halucinací'],
  ['m24-l10', 'Obsah na sociální sítě s AI'],
  ['m24-l11', 'Reklamy: texty, cílení a čtení metrik s AI'],
  ['m24-l12', 'AI systém den za dnem a etické hranice'],
  ['m24-l13', 'AI agenti a automatizace (pokročilé)'],
];

// ---- shelly z template (m1-l4) ----
const tpl = fs.readFileSync(path.join(STUDY, 'm1-l4', 'index.html'), 'utf8');
LESSONS.forEach(([id, title], i) => {
  const crumb = `Modul ${MOD} · Lekce ${i + 1} — ${MOD_TITLE}`;
  let html = tpl
    .replace('<title>Mindset, přesvědčení a dietní restrikce — Barna Academy</title>', `<title>${title} — Barna Academy</title>`)
    .replace('<div class="crumb">Modul 1 · Lekce 4 — Psychologie a chování kolem jídla</div>', `<div class="crumb">${crumb}</div>`)
    .replace('<h1>Mindset, přesvědčení a dietní restrikce</h1>', `<h1>${title}</h1>`)
    .replace("var LID='m1-l4'", `var LID='${id}'`);
  const dir = path.join(STUDY, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
});

// ---- registrace modulu do CURRICULUM v studium/index.html ----
const idxPath = path.join(STUDY, 'index.html');
let idx = fs.readFileSync(idxPath, 'utf8');
if (idx.includes('id:"m24-l1"')) {
  console.log('Modul 24 uz v CURRICULUM je, preskakuji registraci.');
} else {
  const lessonLines = LESSONS.map(([id, t]) =>
    `        { id:"${id}", t:${JSON.stringify(t)}, available:true, href:"/akademie/studium/${id}/" }`).join(',\n');
  const block = `      { t:${JSON.stringify(MOD_TITLE)}, d:${JSON.stringify(MOD_DESC)}, lessons:[\n${lessonLines}\n      ]}`;
  // vlozit pred uzavreni pole "    ];" (posledni vyskyt), za posledni "]}" (tolerantni k CRLF)
  const anchor = /( {6}\]\})(\r?\n)( {4}\];)/;
  if (!anchor.test(idx)) { console.error('KOTVA nenalezena, kurikulum needitovano!'); process.exit(1); }
  const nl = idx.includes('\r\n') ? '\r\n' : '\n';
  idx = idx.replace(anchor, `      ]},${nl}${block.replace(/\n/g, nl)}${nl}    ];`);
  fs.writeFileSync(idxPath, idx);
  console.log('Modul 24 zaregistrovan.');
}
console.log(`Hotovo: ${LESSONS.length} shellu + kurikulum. Moduly nyni: ` +
  new Set(fs.readdirSync(STUDY).filter(n => /^m\d+-l\d+$/.test(n)).map(n => n.match(/^m\d+/)[0])).size);
