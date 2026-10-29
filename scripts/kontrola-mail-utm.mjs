#!/usr/bin/env node
/**
 * Viditelný odkaz v mailu a v článcích z PR #615–#619 nesmí obsahovat `utm_`.
 *
 * Výjimka v SQL: starý odkaz mezi značkami $o$ … $o$ (to, co UPDATE nahrazuje).
 * Nový odkaz mezi $n$ … $n$ projde stejnou kontrolou a značku mít nesmí.
 * Přesměrování /go/ hlídá scripts/kontrola-go-utm.mjs. Sem se nepíše.
 *
 * Spuštění: node scripts/kontrola-mail-utm.mjs
 * Exit 1, jakmile se značka objeví.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ZNACKA = 'u' + 'tm_';

const SOUBORY = [
  'akademie/_supabase/kratke-odkazy-2026-10-29.sql',
  'akademie/_supabase/functions/drip-send/index.ts',
  'akademie/_supabase/functions/en-mailing/logic.ts',
  'akademie/_supabase/functions/_shared/offboard-mail.ts',
  'akademie/_supabase/functions/mail-klik/cil.ts',
  'akademie/_supabase/functions/order-rescue/index.ts',
  'akademie/_supabase/functions/checkin-capture/index.ts',
  'akademie/_supabase/functions/referral-code/index.ts',
  'akademie/_supabase/functions/referral-webhook/index.ts',
  'akademie/_supabase/functions/referral-click/index.ts',
  'scripts/clanek-do-mailu.mjs',
  'clanky/vzorovy-jidelnicek-na-hubnuti.html',
  'clanky/kaloricky-deficit-kolik-jist.html',
  'clanky/elonga-hrv-veda-nebo-marketing.html',
  'clanky/kaloricky-deficit.html',
  'clanky/bilkoviny.html',
];

const nalezy = [];

function textKKontrole(rel, raw) {
  if (rel.endsWith('.sql')) return raw.replace(/\$o\$[\s\S]*?\$o\$/g, '');
  return raw;
}

for (const rel of SOUBORY) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) {
    nalezy.push(`${rel}: soubor chybi`);
    continue;
  }
  const radky = textKKontrole(rel, fs.readFileSync(p, 'utf8')).split(/\r?\n/);
  radky.forEach((line, i) => {
    if (line.includes(ZNACKA)) nalezy.push(`${rel}:${i + 1}: ${line.trim().slice(0, 180)}`);
  });
}

if (nalezy.length) {
  console.log(`SPADLO: ${nalezy.length}`);
  for (const n of nalezy) console.log(n);
  process.exit(1);
}
console.log(`VYSLEDEK: OK (${SOUBORY.length} souboru, zadny viditelny odkaz nema ${ZNACKA})`);
