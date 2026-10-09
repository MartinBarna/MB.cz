#!/usr/bin/env node
// Generator NAVRHU mailu (9. 10. 2026). Spusteni: node _cloud/mailing/generuj.cjs
// Cte `sablony.cjs`, kontroluje pravidla a vyrabi:
//   nahledy/<track>-<step>-<key>.html   nahled ve stejnem obalu jako drip-send (wrapHtml 1:1)
//   nahledy/index.html                  rozcestnik nahledu
//   01-sablony-insert.sql               NAVRH insertu novych trati (nespoustet bez schvaleni)
//   03-oprava-basic249-na-vip.sql       NAVRH opravy 4 existujicich sablon (nespoustet bez schvaleni)
// ⛔ Nic neodesila a na zadnou sluzbu nesaha. Ceny v nahledech NEJSOU: misto nich je
//    videt nazev promenne, at nikde v repu nevznikne cena napsana cislem.

const fs = require('fs');
const path = require('path');
const { vipFree, vipKupci, vipLeady, opravaP0 } = require('./sablony.cjs');

const DIR = __dirname;
const NOVE = [...vipFree, ...vipKupci, ...vipLeady];
const VSE = [...NOVE, ...opravaP0];

// Promenne, ktere drip-send zna (index.ts buildVars + _shared/ceny.ts). Jina promenna = chyba.
const ZNAME = new Set([
  'first_name', 'fn_space', 'fn_suffix', 'fn_prefix', 'email', 'email_url', 'unsubscribe_url',
  'course_price', 'pocet_potravin', 'pocet_receptu',
  'cena_basic_mesic', 'cena_basic_rok', 'cena_vip_mesic', 'cena_vip_rok', 'cena_videokurz',
]);

// ---------------------------------------------------------------------------
// KONTROLY (spadne pri prvnim poruseni, nic se nevygeneruje)
// ---------------------------------------------------------------------------
const chyby = [];
const textVse = (m) => [m.subject, m.subject_b, m.preheader, JSON.stringify(m.blocks)].join(' ');
for (const m of VSE) {
  const id = m.track + '/' + m.step;
  const t = textVse(m);
  if (t.includes('\u2014')) chyby.push(id + ': dlouha pomlcka (U+2014)');
  if (/[0-9][0-9 ]*Kč/.test(t)) chyby.push(id + ': cena napsana cislem (… Kč)');
  const btns = m.blocks.filter((b) => b.t === 'btn');
  if (btns.length !== 1) chyby.push(id + ': ma ' + btns.length + ' tlacitek, ma byt prave 1');
  for (const b of btns) if (!/utm_source=email&utm_medium=drip&utm_campaign=[a-z0-9-]+&utm_content=[a-z0-9-]+/.test(b.href)) chyby.push(id + ': tlacitko bez UTM');
  for (const k of (t.match(/\{\{([^{}]+)\}\}/g) || []).map((x) => x.slice(2, -2))) if (!ZNAME.has(k)) chyby.push(id + ': neznama promenna {{' + k + '}}');
  for (const zakaz of ['Odemkni', 'Revoluční', 'Klíčem je', 'Pojďme', 'Cesta k', 'V dnešní době', 'Není to jen']) if (t.includes(zakaz)) chyby.push(id + ': zakazana fraze „' + zakaz + '“');
  if (m.subject.length > 70 || m.subject_b.length > 70) chyby.push(id + ': predmet delsi nez 70 znaku');
}
// Klice musi byt unikatni (email_events.detail.key, statistiky podle klice).
const klice = VSE.map((m) => m.key);
for (const k of klice) if (klice.indexOf(k) !== klice.lastIndexOf(k)) chyby.push('duplicitni key ' + k);
// Nova trat: kroky 0..n bez der a posledni krok wait_days null.
for (const tr of [vipFree, vipKupci, vipLeady]) {
  tr.forEach((m, i) => { if (m.step !== i) chyby.push(m.track + ': dira v krocich u ' + i); });
  if (tr[tr.length - 1].wait_days !== null) chyby.push(tr[0].track + ': posledni krok nema wait_days null');
  if (tr.length > 5) chyby.push(tr[0].track + ': vic nez 5 mailu');
}
if (chyby.length) { console.error('KONTROLA NEPROSLA:\n - ' + chyby.join('\n - ')); process.exit(1); }

// ---------------------------------------------------------------------------
// RENDER: 1:1 kopie z akademie/_supabase/functions/drip-send/index.ts (gender, renderHtml, wrapHtml)
// ---------------------------------------------------------------------------
const NL = '\n';
const esc = (s) => s.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;');
const attr = (s) => esc(s).split("'").join('&#39;');
function gender(s, fem) {
  let out = '', i = 0;
  while (true) {
    const a = s.indexOf('[[', i);
    if (a < 0) { out += s.slice(i); break; }
    out += s.slice(i, a);
    const sep = s.indexOf('||', a + 2); const end = s.indexOf(']]', sep + 2);
    out += fem ? s.slice(a + 2, sep) : s.slice(sep + 2, end);
    i = end + 2;
  }
  return out.split('[a]').join(fem ? 'a' : '').split('[á]').join(fem ? 'á' : 'ý');
}
// Nahled: promenne se NEDOSAZUJI cislem, ukazou se jako zvyraznene jmeno promenne.
const UKAZKA = { fn_space: ' Petro', fn_suffix: ', Petro', first_name: 'Petro', unsubscribe_url: '#odhlaseni' };
const merge = (s) => s.replace(/\{\{([^{}]+)\}\}/g, (_, k) => (k in UKAZKA ? UKAZKA[k] : `<span style='background:#3a2f12;color:#F6CD63;border-radius:3px;padding:0 3px;font-family:monospace;font-size:13px'>{{${k}}}</span>`));
const mergeTxt = (s) => s.replace(/\{\{([^{}]+)\}\}/g, (_, k) => (k in UKAZKA ? UKAZKA[k] : '{{' + k + '}}'));
const fill = (s, fem) => merge(gender(s, fem));
function renderHtml(blocks, fem) {
  return blocks.map((b) => {
    if (b.t === 'p') return `<p style='margin:0 0 15px'>${fill(b.html, fem)}</p>`;
    if (b.t === 'ps') return `<p class='mb-ps' style='margin:18px 0 0;color:#A09AAD;font-style:italic'>${fill(b.html, fem)}</p>`;
    if (b.t === 'bullets') return `<ul style='margin:0 0 15px;padding-left:20px'>` + b.items.map((li) => `<li style='margin:0 0 8px'>${fill(li, fem)}</li>`).join('') + `</ul>`;
    if (b.t === 'btn') return `<table role='presentation' cellpadding='0' cellspacing='0' border='0' style='margin:6px 0 20px'><tr>` +
      `<td class='mb-btn' bgcolor='#EBB12C' style='background-color:#EBB12C;border-radius:50px'>` +
      `<a class='mb-btna' href='${attr(b.href)}' style='display:inline-block;padding:14px 30px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;font-weight:700;line-height:1.25;color:#1A1222;text-decoration:none'>${fill(esc(b.text), fem)}</a>` +
      `</td></tr></table>`;
    throw new Error('neznamy blok ' + b.t);
  }).join(NL);
}
function wrapHtml(preheader, body, footerHtml, title) {
  return `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='color-scheme' content='dark light'><title>${esc(title)}</title>` +
    `<style>body,table,td,p,li,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}.mb-body a{color:#F6CD63}.mb-body a.mb-btna{color:#1A1222}` +
    `@media only screen and (max-width:620px){.mb-pad{padding:26px 20px 22px!important}.mb-fpad{padding:16px 20px 20px!important}}</style></head>` +
    `<body class='mb-bg' style='margin:0;padding:0;background-color:#0C0B10;background-image:linear-gradient(180deg,#17131F 0%,#0C0B10 46%,#0A0910 100%)'>` +
    `<span style='display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden'>${esc(preheader)}</span>` +
    `<table role='presentation' class='mb-bg' width='100%' cellpadding='0' cellspacing='0' border='0' bgcolor='#0C0B10' style='background-color:#0C0B10'><tr><td align='center' style='padding:24px 12px 30px'>` +
    `<table role='presentation' class='mb-card' width='600' cellpadding='0' cellspacing='0' border='0' bgcolor='#16131D' style='width:100%;max-width:600px;background-color:#16131D;border-radius:2px;border:1px solid #262231'>` +
    `<tr><td class='mb-rule' bgcolor='#EBB12C' height='3' style='height:3px;line-height:3px;font-size:2px;background-color:#EBB12C'>&nbsp;</td></tr>` +
    `<tr><td class='mb-body mb-pad' style='padding:30px 32px 26px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.6;color:#F0EADF'>` +
    `<div class='mb-brand' style='border-left:3px solid #EBB12C;padding-left:12px;font-weight:800;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#F6CD63;margin:0 0 22px'>Martin Barna</div>` +
    body + `</td></tr>` +
    `<tr><td class='mb-foot mb-fpad' bgcolor='#100E16' style='padding:18px 32px 22px;background-color:#100E16;border-top:1px solid #262231'>` +
    `<div class='mb-mut' style='font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:12px;line-height:1.55;color:#A09AAD'>${footerHtml}</div>` +
    `</td></tr></table></td></tr></table></body></html>`;
}
// ⚠️ Ziva paticka je v `app_config.footer_html` a drip-send ji pridava ke KAZDEMU mailu
//    (odhlaseni jednim klikem + hlavicka List-Unsubscribe). Tady je jen jeji zastupce pro nahled.
const PATICKA = `Tenhle e-mail ti posílám, protože jsi u mě na martinbarna.cz nechal[a] svůj e-mail.<br>Nechceš už e-maily? <a href='{{unsubscribe_url}}' style='color:#A09AAD'>Odhlásit se</a> můžeš kdykoli jedním klikem.<br>Martin Barna, online výživový kouč · martinbarna.cz<br><em>(Náhled: živá patička se bere z app_config.footer_html.)</em>`;

// ---------------------------------------------------------------------------
// NAHLEDY
// ---------------------------------------------------------------------------
const NAHLEDY = path.join(DIR, 'nahledy');
fs.mkdirSync(NAHLEDY, { recursive: true });
for (const f of fs.readdirSync(NAHLEDY)) if (f.endsWith('.html')) fs.unlinkSync(path.join(NAHLEDY, f));
const soubor = (m) => `${m.track}-${m.step}-${m.key}.html`;
const meta = (m) => `<div style='font-family:monospace;font-size:12px;color:#A09AAD;margin:0 0 16px;line-height:1.5'>` +
  `NÁVRH · trať <b>${m.track}</b> · krok ${m.step} · key ${m.key} · wait_days ${m.wait_days === null ? 'null (konec)' : m.wait_days}<br>` +
  `Předmět A: <b style='color:#F0EADF'>${esc(mergeTxt(gender(m.subject, false)))}</b><br>Předmět B: ${esc(mergeTxt(gender(m.subject_b, false)))}<br>Náhledový text: ${esc(mergeTxt(gender(m.preheader, false)))}</div>`;
for (const m of VSE) {
  const html = wrapHtml(mergeTxt(gender(m.preheader, false)), meta(m) + renderHtml(m.blocks, false), fill(PATICKA, false), m.subject);
  fs.writeFileSync(path.join(NAHLEDY, soubor(m)), html);
}
const radek = (m) => `<tr><td>${m.track}</td><td>${m.step}</td><td>${m.wait_days === null ? 'konec' : m.wait_days}</td><td><a href='${soubor(m)}'>${esc(mergeTxt(gender(m.subject, false)))}</a></td></tr>`;
fs.writeFileSync(path.join(NAHLEDY, 'index.html'), `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Náhledy mailů</title>` +
  `<style>body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#0C0B10;color:#F0EADF;margin:0;padding:24px 16px}a{color:#F6CD63}table{border-collapse:collapse;width:100%;max-width:900px}td,th{border-bottom:1px solid #262231;padding:8px;text-align:left;font-size:14px}h1{font-size:20px}h2{font-size:16px;margin-top:28px}</style></head><body>` +
  `<h1>Náhledy mailů: návrh 9. 10. 2026 (nic se neodesílá)</h1><p>Ceny jsou schválně jen jako proměnné. Text je návrh, finální znění schvaluje Martin.</p>` +
  [['Trať 1: vip-free', vipFree], ['Trať 2: vip-kupci', vipKupci], ['Trať 3: vip-leady', vipLeady], ['Oprava P0: Basic → VIP (4 existující kroky)', opravaP0]]
    .map(([nadpis, tr]) => `<h2>${nadpis}</h2><table><tr><th>Trať</th><th>Krok</th><th>Čeká dní</th><th>Předmět A</th></tr>${tr.map(radek).join('')}</table>`).join('') +
  `</body></html>`);

// ---------------------------------------------------------------------------
// SQL NAVRHY
// ---------------------------------------------------------------------------
const dq = (s) => { if (s.includes('$q$')) throw new Error('text obsahuje $q$'); return '$q$' + s + '$q$'; };
const HLAVICKA = (nazev, popis) => `-- ============================================================================
-- ${nazev}
-- ⛔⛔ NÁVRH, NESPOUŠTĚT. Vygenerováno z _cloud/mailing/sablony.cjs (generuj.cjs), 9. 10. 2026.
-- ${popis}
-- ⛔ Texty schvaluje Martin. Před ostrým během TEST na fitness.barna@gmail.com
--    (drip-send {test_email, track, step}) a výslovné „pošli ostro".
-- ============================================================================
`;

const ins = HLAVICKA('NOVÉ TRATĚ vip-free, vip-kupci, vip-leady: šablony (13 řádků)',
  'Vložení šablon je INERTNÍ: do nových tratí nikdo nevede, dokud se nespustí 02-*.sql.') + `
begin;
do $mig$
declare n int;
begin
  -- Pojistka: tratě ještě nesmí existovat (jinak by insert spadl na PK uprostřed).
  select count(*) into n from public.email_templates where track in ('vip-free','vip-kupci','vip-leady');
  if n > 0 then raise exception 'Tratě vip-* už v email_templates jsou (% řádků). Nic jsem nevložil.', n; end if;

  insert into public.email_templates (track, step, key, subject, preheader, blocks, wait_days) values
${NOVE.map((m) => `  (${dq(m.track)}, ${m.step}, ${dq(m.key)},\n   ${dq(m.subject)},\n   ${dq(m.preheader)},\n   ${dq(JSON.stringify(m.blocks))}::jsonb,\n   ${m.wait_days === null ? 'null' : m.wait_days})`).join(',\n')};

  get diagnostics n = row_count;
  if n <> ${NOVE.length} then raise exception 'Čekal jsem ${NOVE.length} řádků, vloženo %', n; end if;
end
$mig$;
commit;

-- Kontrola po vložení (jen čtení):
-- select track, step, key, wait_days, subject from public.email_templates
--  where track like 'vip-%' order by track, step;
`;
fs.writeFileSync(path.join(DIR, '01-sablony-insert.sql'), ins);

const opr = HLAVICKA('OPRAVA P0: 4 existující kroky „basic249" → VIP 499 (videokurz jen k VIP)',
  'Od 30. 9. 2026 dostává videokurz jen VIP (app-purchase-bridge, PRAVIDLO_BONUSU vip-2026-09-30),\n-- ale tyhle 4 šablony (snímek živé DB 23. 9.) prodávají Basic a slibují k němu videokurz.\n-- ⛔ UPDATE ŠABLONY JE ROZESLÁNÍ (CLAUDE.md 25. 7.): drip běží každou hodinu. Spouštět až po schválení textu.\n-- ⛔ ZÁMEK: řádek se změní JEN když má pořád původní key (= nikdo ho mezitím nepřepsal přes MCP).\n--    Když počet nesedí, celé se to vrátí. wait_days se NEMĚNÍ.') + `
begin;
do $mig$
declare n int;
begin
  create table public.zaloha_email_templates_vip_20261009 as
    select * from public.email_templates
     where (track, step) in (${opravaP0.map((m) => `(${dq(m.track)}, ${m.step})`).join(', ')});
  alter table public.zaloha_email_templates_vip_20261009 enable row level security;
  revoke all on public.zaloha_email_templates_vip_20261009 from anon, authenticated;

  update public.email_templates t
     set key = z.novy_key, subject = z.subject, preheader = z.preheader, blocks = z.blocks, updated_at = now()
    from (values
${opravaP0.map((m) => `    (${dq(m.track)}, ${m.step}, ${dq(m.puvodni_key)}, ${dq(m.key)},\n     ${dq(m.subject)},\n     ${dq(m.preheader)},\n     ${dq(JSON.stringify(m.blocks))}::jsonb)`).join(',\n')}
    ) as z(track, step, puvodni_key, novy_key, subject, preheader, blocks)
   where t.track = z.track and t.step = z.step and t.key = z.puvodni_key;

  get diagnostics n = row_count;
  if n <> ${opravaP0.length} then raise exception 'Čekal jsem ${opravaP0.length} řádky, změněno %. Někdo šablonu mezitím upravil, nic se neměnilo.', n; end if;
end
$mig$;
commit;

-- Návrat: update public.email_templates t set key=z.key, subject=z.subject, preheader=z.preheader,
--   blocks=z.blocks, updated_at=now() from public.zaloha_email_templates_vip_20261009 z
--   where t.track=z.track and t.step=z.step;
`;
fs.writeFileSync(path.join(DIR, '03-oprava-basic249-na-vip.sql'), opr);

// ---------------------------------------------------------------------------
// TEXTY DO ../MAILING-NAVRH-1009.md (mezi znacky TEXTY:START a TEXTY:END)
// ---------------------------------------------------------------------------
const md = (s) => gender(s, false).replace(/<strong>(.*?)<\/strong>/g, '**$1**').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '');
function mailMd(m, den) {
  const b = m.blocks.find((x) => x.t === 'btn');
  const telo = m.blocks.map((x) => {
    if (x.t === 'btn') return `> **[ ${md(x.text)} ]**`;
    if (x.t === 'bullets') return x.items.map((i) => `> - ${md(i)}`).join('\n');
    return '> ' + md(x.html);
  }).join('\n>\n');
  return `#### ${m.track} · krok ${m.step}${den === null ? '' : ' · den ' + den} · \`${m.key}\`\n\n` +
    `- **Předmět A:** ${md(m.subject)}\n- **Předmět B:** ${md(m.subject_b)}\n- **Náhledový text:** ${md(m.preheader)}\n` +
    `- **CTA:** „${md(b.text)}" → \`${b.href}\`\n- **Čeká po odeslání:** ${m.wait_days === null ? 'nic, konec trati' : m.wait_days === 'BEZE ZMENY' ? 'beze změny (jako dnes)' : m.wait_days + (m.wait_days >= 5 ? ' dní' : ' dny')}\n\n${telo}\n`;
}
function tratMd(nadpis, tr) {
  let den = 0;
  return `### ${nadpis}\n\n` + tr.map((m) => { const out = mailMd(m, den); den += m.wait_days || 0; return out; }).join('\n');
}
const textyMd = '\n' + [
  tratMd('6.1 vip-free', vipFree),
  tratMd('6.2 vip-kupci', vipKupci),
  tratMd('6.3 vip-leady', vipLeady),
  `### 6.4 Oprava P0: jednotné znění pro lead-magnet/9, longtail-consumer/5, nurture-videokurz/8, tc-start/2\n\nStejné tělo, liší se jen \`utm_campaign\` (= trať) a klíč (\`lm-9-vip499\`, \`lc-11-vip499\`, \`nv-8-vip499\`, \`tcs-2-vip499\`). Ženské tvary dosadí engine přes \`[a]\`.\n\n` + mailMd(opravaP0[0], null),
].join('\n') + '\n';
const NAVRH = path.join(DIR, '..', 'MAILING-NAVRH-1009.md');
if (fs.existsSync(NAVRH)) {
  const doc = fs.readFileSync(NAVRH, 'utf8');
  const a = doc.indexOf('<!-- TEXTY:START'); const z = doc.indexOf('<!-- TEXTY:END -->');
  if (a < 0 || z < 0) throw new Error('MAILING-NAVRH-1009.md: chybi znacky TEXTY:START / TEXTY:END');
  const zacatek = doc.indexOf('-->', a) + 3;
  fs.writeFileSync(NAVRH, doc.slice(0, zacatek) + textyMd + doc.slice(z));
}

console.log('OK: ' + NOVE.length + ' novych sablon, ' + opravaP0.length + ' opravy, nahledy v ' + NAHLEDY);
