/* Plošné ověření deploye: každý FTP-nasazovaný soubor daného commitu porovná s živým webem.
   Kritérium: git blob SHA1 == sha1("blob <len>\0" + stažené bajty). Detekuje WEDOS challenge.
   Spuštění: node scripts/verify-deploy.js [ref]   (default origin/main; v CI: HEAD)
   Exit code 1 při jakémkoli rozdílu → v deploy workflow shodí run, žádné tiché přeskočení. */
'use strict';
const { execSync } = require('child_process');
const crypto = require('crypto');
const https = require('https');
const path = require('path');

const REPO = path.join(__dirname, '..');
const REF = process.argv[2] || 'origin/main';
const BASE = 'https://martinbarna.cz/';
const NC = Date.now();

const EXCL = [
  /^\.git/, /\/\.git/, /^\.github\//, /^_import\//, /^_zaloha\//, /^_zdroje\//,
  /^Logo-rebrand\//, /^scripts\//, /^akademie\/_ai\//, /^akademie\/_pdf\//,
  /^akademie\/_supabase\//, /^akademie\/_videokurz\//, /\.md$/, /^CNAME$/, /^\.nojekyll$/,
  /^\.htaccess$/, // Apache ho přes HTTP záměrně nevydává (401) — zvenku neověřitelný
];

const lsRaw = execSync('git -c core.quotepath=false ls-tree -r ' + REF, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const files = lsRaw.split('\n').filter(Boolean).map((l) => {
  const m = l.match(/^\d+ blob ([0-9a-f]{40})\t(.+)$/);
  return m ? { sha: m[1], path: m[2] } : null;
}).filter(Boolean).filter((f) => !EXCL.some((re) => re.test(f.path)));

console.log('souboru k overeni: ' + files.length);

function fetchBytes(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'MB-deploy-verify', 'Cache-Control': 'no-cache' }, timeout: 30000 }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && redirects < 2 && res.headers.location) {
        res.resume();
        const next = new URL(res.headers.location, url).href;
        return resolve(fetchBytes(next, redirects + 1));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks), headers: res.headers }));
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}

function gitSha(buf) {
  return crypto.createHash('sha1').update('blob ' + buf.length + '\0').update(buf).digest('hex');
}

const results = { ok: 0, mismatch: [], missing: [], challenge: [], error: [] };

// ⛔⛔ POZOR NA `?nc=`: ten parametr je NUTNÝ (bez něj by CDN mohla vrátit starou verzi
// souboru a ověření by svítilo zeleně nad nenasazeným obsahem), ALE má tvrdý vedlejší
// účinek. Změřeno 21. 8. 2026: WEDOS Global CDN **necachuje nic s query stringem**, takže
// každý z 1415 požadavků je zaručený cache MISS a jde na origin. A právě cesta při MISS
// je ta nestabilní: origin přímo odpovídá do 0,3 s, přes CDN při MISS až 18 s, občas
// spojení spadne úplně. ⇒ Tenhle skript si sám vyrábí přesně ten provoz, na kterém pak umírá.
// Detail a čísla: paměť `mb-wedos-pomaly-origin-a-utm-cache`.
const POKUSU_NA_SPOJENI = 4; // chyba spojení není nález, je to hosting: zkoušej víc a s pauzou

/** Chyba přenosu (spadlé spojení), ne odpověď serveru. Tyhle se nesmí počítat jako nález. */
const jeChybaSpojeni = (e) =>
  /socket hang up|ECONNRESET|ETIMEDOUT|EPIPE|ECONNREFUSED|EAI_AGAIN|timeout|aborted/i.test(String(e && e.message));

async function check(f, attempt = 0) {
  const url = BASE + f.path.split('/').map(encodeURIComponent).join('/') + '?nc=' + NC + '-' + attempt;
  try {
    const r = await fetchBytes(url);
    const bodyStr = r.body.slice(0, 3000).toString('utf8');
    const isChallenge = (r.headers['x-protected-by'] && r.status !== 200) ||
      /altcha|security verification|wedos.?protection/i.test(bodyStr) && !f.path.includes('odhlasit') && gitSha(r.body) !== f.sha;
    if (r.status === 404) { results.missing.push(f.path); return; }
    if (r.status !== 200) {
      // 502/503 od CDN je totéž jako spadlé spojení: server se nedostal k obsahu.
      if (attempt < POKUSU_NA_SPOJENI) {
        await new Promise((s) => setTimeout(s, 400 * (attempt + 1)));
        return check(f, attempt + 1);
      }
      results.error.push(f.path + ' HTTP ' + r.status); return;
    }
    if (gitSha(r.body) === f.sha) { results.ok++; return; }
    if (isChallenge) {
      if (attempt < 2) { await new Promise((s) => setTimeout(s, 800)); return check(f, attempt + 1); }
      results.challenge.push(f.path); return;
    }
    if (attempt < 1) return check(f, attempt + 1); // jednorazovy retry (cache/propagace)
    results.mismatch.push(f.path);
  } catch (e) {
    // ⚠️ Rozlišuj: spadlé spojení zkoušej znovu s narůstající pauzou, jiná chyba jen jednou.
    const limit = jeChybaSpojeni(e) ? POKUSU_NA_SPOJENI : 1;
    if (attempt < limit) {
      if (attempt > 0) await new Promise((s) => setTimeout(s, 400 * attempt));
      return check(f, attempt + 1);
    }
    results.error.push(f.path + ' ' + e.message);
  }
}

(async () => {
  const CONC = 12;
  let i = 0, done = 0;
  async function worker() {
    while (i < files.length) {
      const f = files[i++];
      await check(f);
      done++;
      if (done % 200 === 0) console.log('  ...' + done + '/' + files.length);
    }
  }
  const t0 = Date.now();
  await Promise.all(Array.from({ length: CONC }, worker));
  console.log('hotovo za ' + Math.round((Date.now() - t0) / 1000) + ' s (ref ' + REF + ')');
  console.log('OK: ' + results.ok + ' / ' + files.length);
  console.log('MISMATCH (' + results.mismatch.length + '):'); results.mismatch.slice(0, 40).forEach((p) => console.log('  ' + p));
  console.log('MISSING/404 (' + results.missing.length + '):'); results.missing.slice(0, 20).forEach((p) => console.log('  ' + p));
  console.log('CHALLENGE (' + results.challenge.length + '):'); results.challenge.slice(0, 10).forEach((p) => console.log('  ' + p));
  console.log('ERROR (' + results.error.length + '):'); results.error.slice(0, 10).forEach((p) => console.log('  ' + p));

  // ⛔⛔ ROZDĚL NÁLEZ OD HOSTINGU, JINAK POJISTCE NIKDO NEVĚŘÍ.
  // Do 21. 8. 2026 shodila běh i chyba spojení. Běh #629 (20. 8.) tak hlásil „failure"
  // při MISMATCH 0, MISSING 0, CHALLENGE 0 a jen 16 spadlých spojení na obrázcích, ačkoli
  // se nasadilo správně. Takové maily „Run failed" naučí člověka poplach ignorovat, a pak
  // přehlédne i ten pravý. ⇒ Padá se JEN na důkazu o špatném obsahu.
  const nalezy = results.mismatch.length + results.missing.length + results.challenge.length;
  const strop = Math.max(20, Math.ceil(files.length * 0.05)); // 5 % je už výpadek, ne škytnutí

  if (nalezy > 0) {
    console.error('DEPLOY NENÍ KONZISTENTNÍ: ' + nalezy + ' souborů neodpovídá ' + REF + '.');
    process.exitCode = 1;
  } else if (results.error.length > strop) {
    // Když spadne půlka požadavků, nevíme nic. Tichá zelená by tady lhala.
    console.error('NEOVĚŘENO: ' + results.error.length + ' spojení spadlo (strop ' + strop + ').');
    console.error('Obsah se nepodařilo zkontrolovat, ber to jako neúspěch, ne jako čistý deploy.');
    process.exitCode = 1;
  } else if (results.error.length > 0) {
    console.log('');
    console.log('⚠️ HOSTING, NE DEPLOY: ' + results.error.length + ' spojení spadlo i po ' +
      POKUSU_NA_SPOJENI + ' pokusech.');
    console.log('   Obsah, který se stáhnout podařilo, sedí na ' + REF + ' (0 neshod, 0 chybějících).');
    console.log('   Je to známá nestabilita WEDOS CDN při cache MISS, ne chyba nasazení.');
    console.log('   Běh proto NEshazuji. Kdyby se to množilo, je to podklad pro podporu.');
  }
})();
