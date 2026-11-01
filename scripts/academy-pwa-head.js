#!/usr/bin/env node
/* academy-pwa-head.js
 * Doplní do <head> všech index.html pod akademie/ (kromě akademie/admin/):
 *   manifest, apple-mobile-web-app-title, apple-mobile-web-app-capable
 *   a apple-touch-icon tam, kde žádný není.
 * Mění jen bajty uvnitř <head>. Druhý běh soubory nepřepíše.
 * Spuštění z kořene repa: node scripts/academy-pwa-head.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AKA = path.join(ROOT, 'akademie');

const MANIFEST = '<link rel="manifest" href="/akademie/site.webmanifest">';
const TITLE = '<meta name="apple-mobile-web-app-title" content="Barna Academy">';
const CAPABLE = '<meta name="apple-mobile-web-app-capable" content="yes">';
const TOUCH = '<link rel="apple-touch-icon" href="/assets/apple-touch-g3.png">';

function readTagEnd(html, start) {
  let i = start + 1;
  let quote = null;
  while (i < html.length) {
    const c = html[i];
    if (quote) {
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; i++; continue; }
    if (c === '>') return i + 1;
    i++;
  }
  return html.length;
}

function skipComment(html, i) {
  if (!html.startsWith('<!--', i)) return i;
  const end = html.indexOf('-->', i + 4);
  return end === -1 ? html.length : end + 3;
}

function skipRawElement(html, i) {
  const rest = html.slice(i + 1);
  let name = null;
  if (/^script\b/i.test(rest)) name = 'script';
  else if (/^style\b/i.test(rest)) name = 'style';
  else return i;
  const openEnd = readTagEnd(html, i);
  const m = new RegExp('<\\/' + name + '\\s*>', 'i').exec(html.slice(openEnd));
  if (!m) return html.length;
  return openEnd + m.index + m[0].length;
}

function advance(html, i) {
  const comment = skipComment(html, i);
  if (comment !== i) return comment;
  return skipRawElement(html, i);
}

function findHead(html) {
  let i = 0;
  while (i < html.length) {
    const jumped = advance(html, i);
    if (jumped !== i) { i = jumped; continue; }
    if (html[i] === '<' && /^head\b/i.test(html.slice(i + 1))) {
      const openEnd = readTagEnd(html, i);
      const closeStart = findCloseHead(html, openEnd);
      if (closeStart < 0) return null;
      return { openEnd: openEnd, closeStart: closeStart };
    }
    i++;
  }
  return null;
}

function findCloseHead(html, from) {
  let i = from;
  while (i < html.length) {
    const jumped = advance(html, i);
    if (jumped !== i) { i = jumped; continue; }
    if (/^<\/head\s*>/i.test(html.slice(i))) return i;
    i++;
  }
  return -1;
}

function scanTags(html) {
  const out = [];
  let i = 0;
  while (i < html.length) {
    const jumped = advance(html, i);
    if (jumped !== i) { i = jumped; continue; }
    if (html[i] === '<') {
      const rest = html.slice(i + 1);
      let name = null;
      if (/^link\b/i.test(rest)) name = 'link';
      else if (/^meta\b/i.test(rest)) name = 'meta';
      if (name) {
        const end = readTagEnd(html, i);
        out.push({ name: name, start: i, end: end, text: html.slice(i, end) });
        i = end;
        continue;
      }
    }
    i++;
  }
  return out;
}

function attr(tag, key) {
  const re = new RegExp('\\b' + key + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i');
  const m = tag.match(re);
  if (!m) return '';
  return m[2] !== undefined ? m[2] : m[3];
}

function relList(tag) {
  return attr(tag, 'rel').toLowerCase().split(/\s+/).filter(Boolean);
}

function newlineOf(text) {
  const crlf = (text.match(/\r\n/g) || []).length;
  const lf = (text.match(/\n/g) || []).length;
  if (crlf > 0 && crlf === lf) return '\r\n';
  return '\n';
}

function indentOf(text) {
  const lines = text.split(/\r\n|\n/);
  const counts = new Map();
  for (let n = 0; n < lines.length; n++) {
    const m = lines[n].match(/^([ \t]*)<(?:meta|link|title)\b/i);
    if (!m) continue;
    const ind = m[1];
    counts.set(ind, (counts.get(ind) || 0) + 1);
  }
  let best = '';
  let bestN = -1;
  counts.forEach(function (count, ind) {
    if (count > bestN) { best = ind; bestN = count; }
  });
  return best;
}

function processInner(inner) {
  const tags = scanTags(inner);
  const replacements = [];
  let manifestOk = false;
  let titleOk = false;
  let capableOk = false;
  let touchExists = false;

  for (let n = 0; n < tags.length; n++) {
    const t = tags[n];
    if (t.name === 'link') {
      const rels = relList(t.text);
      if (rels.indexOf('manifest') !== -1) {
        manifestOk = true;
        if (t.text !== MANIFEST) replacements.push({ start: t.start, end: t.end, text: MANIFEST });
      }
      if (rels.indexOf('apple-touch-icon') !== -1 || rels.indexOf('apple-touch-icon-precomposed') !== -1) {
        touchExists = true;
      }
    } else if (t.name === 'meta') {
      const name = attr(t.text, 'name').toLowerCase();
      if (name === 'apple-mobile-web-app-title') {
        titleOk = true;
        if (t.text !== TITLE) replacements.push({ start: t.start, end: t.end, text: TITLE });
      } else if (name === 'apple-mobile-web-app-capable') {
        capableOk = true;
        if (t.text !== CAPABLE) replacements.push({ start: t.start, end: t.end, text: CAPABLE });
      }
    }
  }

  let next = inner;
  replacements.sort(function (a, b) { return b.start - a.start; });
  for (let n = 0; n < replacements.length; n++) {
    const r = replacements[n];
    next = next.slice(0, r.start) + r.text + next.slice(r.end);
  }

  const missing = [];
  if (!manifestOk) missing.push(MANIFEST);
  if (!titleOk) missing.push(TITLE);
  if (!capableOk) missing.push(CAPABLE);
  if (!touchExists) missing.push(TOUCH);
  if (!missing.length) return next;

  const nl = newlineOf(next);
  const ind = indentOf(next);
  if (!next.endsWith('\n')) next += nl;
  for (let n = 0; n < missing.length; n++) next += ind + missing[n] + nl;
  return next;
}

function transform(html) {
  const head = findHead(html);
  if (!head) return { html: html, status: 'no-head' };
  const closeTag = /^<\/head\s*>/i.exec(html.slice(head.closeStart));
  if (!closeTag) return { html: html, status: 'no-head' };
  const after = html.slice(head.closeStart + closeTag[0].length).replace(/^\s+/, '');
  if (!/^<body\b/i.test(after)) return { html: html, status: 'no-body' };
  const inner = html.slice(head.openEnd, head.closeStart);
  const nextInner = processInner(inner);
  if (nextInner === inner) return { html: html, status: 'same' };
  return {
    html: html.slice(0, head.openEnd) + nextInner + html.slice(head.closeStart),
    status: 'changed'
  };
}

function walkIndex(dir, out) {
  const names = fs.readdirSync(dir, { withFileTypes: true });
  for (let n = 0; n < names.length; n++) {
    const ent = names[n];
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (path.relative(AKA, p) === 'admin') continue;
      walkIndex(p, out);
    } else if (ent.name === 'index.html') {
      out.push(p);
    }
  }
  return out;
}

function selfTest() {
  function eq(actual, expected, msg) {
    if (actual !== expected) {
      console.error('SELF-TEST FAIL: ' + msg);
      console.error('--- actual ---');
      console.error(actual);
      console.error('--- expected ---');
      console.error(expected);
      process.exit(1);
    }
  }

  const svg = '<link rel="icon" href="data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'><rect width=\'1\'></rect></svg>">';
  const lesson = '<!DOCTYPE html>\n<html lang="cs">\n<head>\n<meta charset="UTF-8">\n' + svg + '\n<title>Lekce</title>\n</head>\n<body class="ba">TELO-1</body>\n</html>\n';
  const once = transform(lesson);
  eq(once.status, 'changed', 'lekce se ma zmenit');
  eq(once.html.indexOf('TELO-1'), lesson.indexOf('TELO-1') + (MANIFEST.length + TITLE.length + CAPABLE.length + TOUCH.length + 4), 'telo zustava, jen head narostl o 4 radky');
  if (once.html.slice(once.html.indexOf('</head>')) !== lesson.slice(lesson.indexOf('</head>'))) {
    console.error('SELF-TEST FAIL: za </head> se nesmi nic zmenit');
    process.exit(1);
  }
  if (!once.html.includes(svg)) {
    console.error('SELF-TEST FAIL: svg ikona v head se nesmi rozbit');
    process.exit(1);
  }
  const twice = transform(once.html);
  eq(twice.status, 'same', 'druhy beh lekce');
  eq(twice.html, once.html, 'druhy beh stejne bajty');

  const landing = '<head>\r\n    <meta charset="UTF-8">\r\n    <link rel="apple-touch-icon" href="/assets/apple-touch-g3.png">\r\n    <link rel="manifest" href="/site.webmanifest">\r\n</head>\r\n<body>X</body>\r\n';
  const land1 = transform(landing);
  eq(land1.status, 'changed', 'landing se ma zmenit');
  if (land1.html.indexOf(TOUCH) !== landing.indexOf('<link rel="apple-touch-icon" href="/assets/apple-touch-g3.png">')) {
    console.error('SELF-TEST FAIL: existujici apple-touch-icon se nesmi posunout');
    process.exit(1);
  }
  const touchCount = land1.html.split('apple-touch-icon').length - 1;
  eq(touchCount, 1, 'druhy apple-touch-icon se nesmi pridat');
  if (land1.html.indexOf('href="/site.webmanifest"') !== -1) {
    console.error('SELF-TEST FAIL: stary manifest ma zmizet');
    process.exit(1);
  }
  if (land1.html.replace(/\r\n/g, '').indexOf('\n') !== -1) {
    console.error('SELF-TEST FAIL: CRLF se nesmi rozpadnout na LF');
    process.exit(1);
  }
  const land2 = transform(land1.html);
  eq(land2.status, 'same', 'druhy beh landingu');
  eq(land2.html, land1.html, 'landing bajty');

  const custom = '<head>\n<link rel="apple-touch-icon" sizes="180x180" href="/assets/custom.png">\n</head>\n<body></body>\n';
  const custom1 = transform(custom);
  if (custom1.html.indexOf('<link rel="apple-touch-icon" sizes="180x180" href="/assets/custom.png">') === -1) {
    console.error('SELF-TEST FAIL: vlastni apple-touch-icon ma zustat');
    process.exit(1);
  }
  eq((custom1.html.match(/apple-touch-icon/g) || []).length, 1, 'vlastni ikonu nezdvojovat');
  eq(transform(custom1.html).status, 'same', 'vlastni ikona druhy beh');

  const cssQuote = '<head>\n<style>\n  /* Strava " nezavrena */\n</style>\n</head>\n<body>Q</body>\n';
  const cq1 = transform(cssQuote);
  eq(cq1.status, 'changed', 'css s uvozovkou v komentari');
  eq(transform(cq1.html).status, 'same', 'css uvozovka druhy beh');
  eq(transform(cq1.html).html, cq1.html, 'css uvozovka bajty');
  if (cq1.html.slice(cq1.html.indexOf('</head>')) !== cssQuote.slice(cssQuote.indexOf('</head>'))) {
    console.error('SELF-TEST FAIL: css uvozovka zmenila telo');
    process.exit(1);
  }

  const fake = '<head>\n<meta charset="UTF-8">\n</head>\n<body><script>w.document.write("<head></head><body>");</script>TELO</body>\n';
  const fake1 = transform(fake);
  if (fake1.html.slice(fake1.html.indexOf('</head>')) !== fake.slice(fake.indexOf('</head>'))) {
    console.error('SELF-TEST FAIL: </head> ve skriptu v body se nesmi stat cilem');
    process.exit(1);
  }
}

function main() {
  selfTest();
  const files = walkIndex(AKA, []);
  let changed = 0;
  let same = 0;
  const problems = [];
  for (let n = 0; n < files.length; n++) {
    const file = files[n];
    const html = fs.readFileSync(file, 'utf8');
    const result = transform(html);
    if (result.status === 'changed') {
      fs.writeFileSync(file, result.html, 'utf8');
      changed++;
    } else if (result.status === 'same') {
      same++;
    } else {
      problems.push(path.relative(ROOT, file) + ' (' + result.status + ')');
    }
  }
  console.log('souboru index.html (bez akademie/admin): ' + files.length);
  console.log('zmeneno: ' + changed);
  console.log('beze zmeny: ' + same);
  console.log('preskoceno: ' + problems.length);
  for (let n = 0; n < problems.length; n++) console.log('  ' + problems[n]);
}

main();
