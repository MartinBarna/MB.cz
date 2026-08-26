#!/usr/bin/env node
/* wrap-dark-overlays.js — obalí pravidla tmavých overlay souborů
   selektorem html:not([data-theme="light"]), ať se ve světlém režimu
   neaplikují (místo další záplaty s !important).
   :root a html přepíše na html:not([data-theme="light"]).
   @media/@supports obalí i vnitřek. @keyframes nechá být.
   Pusť: node scripts/wrap-dark-overlays.js
   Dry:  node scripts/wrap-dark-overlays.js --dry
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry');
const PREFIX = 'html:not([data-theme="light"])';
const MARKER = 'html:not([data-theme="light"])';

const FILES = [
  'assets/marketing-dark.css',
  'assets/app-brand-override.css',
  'assets/arena.css',
];

function skipComment(css, i) {
  if (css[i] === '/' && css[i + 1] === '*') {
    const end = css.indexOf('*/', i + 2);
    return end === -1 ? css.length : end + 2;
  }
  return i;
}

function skipString(css, i) {
  const q = css[i];
  if (q !== '"' && q !== "'") return i;
  i++;
  while (i < css.length) {
    if (css[i] === '\\') { i += 2; continue; }
    if (css[i] === q) return i + 1;
    i++;
  }
  return i;
}

function matchBlock(css, openBrace) {
  let depth = 0;
  let i = openBrace;
  while (i < css.length) {
    i = skipComment(css, i);
    if (i >= css.length) break;
    const c = css[i];
    if (c === '"' || c === "'") { i = skipString(css, i); continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

function prefixSelector(sel) {
  return sel.split(',').map(function (raw) {
    const s = raw.trim();
    if (!s) return raw;
    if (s.indexOf(PREFIX) === 0) return s;
    if (/^(:root|html)$/.test(s)) return PREFIX;
    if (/^html(?=$|[\s.#[:{>+~])/.test(s)) return s.replace(/^html/, PREFIX);
    if (/^:root(?=$|[\s.#[:{>+~])/.test(s)) return s.replace(/^:root/, PREFIX);
    return PREFIX + ' ' + s;
  }).join(', ');
}

const KEEP_AT = /@(keyframes|-[\w]+-keyframes|font-face|import|charset|namespace|counter-style|property|page)\b/i;

function transformChunk(css) {
  let out = '';
  let i = 0;
  const n = css.length;
  while (i < n) {
    const startComment = i;
    i = skipComment(css, i);
    if (i !== startComment) {
      out += css.slice(startComment, i);
      continue;
    }
    if (/\s/.test(css[i])) { out += css[i]; i++; continue; }

    if (css[i] === '@') {
      const preludeStart = i;
      while (i < n && css[i] !== '{' && css[i] !== ';') {
        i = skipComment(css, i);
        if (css[i] === '"' || css[i] === "'") { i = skipString(css, i); continue; }
        i++;
      }
      const prelude = css.slice(preludeStart, i);
      if (css[i] === ';') {
        out += prelude + ';';
        i++;
        continue;
      }
      if (css[i] !== '{') { out += prelude; continue; }
      const close = matchBlock(css, i);
      if (close === -1) { out += css.slice(preludeStart); break; }
      const inner = css.slice(i + 1, close);
      if (KEEP_AT.test(prelude)) {
        out += prelude + '{' + inner + '}';
      } else {
        out += prelude + '{' + transformChunk(inner) + '}';
      }
      i = close + 1;
      continue;
    }

    const selStart = i;
    while (i < n && css[i] !== '{') {
      i = skipComment(css, i);
      if (i >= n) break;
      if (css[i] === '"' || css[i] === "'") { i = skipString(css, i); continue; }
      if (css[i] === '@') break;
      i++;
    }
    if (css[i] !== '{') {
      out += css.slice(selStart, i);
      continue;
    }
    const sel = css.slice(selStart, i).trim();
    const close = matchBlock(css, i);
    if (close === -1) { out += css.slice(selStart); break; }
    const body = css.slice(i + 1, close);
    const ws = css.slice(selStart, i).match(/^\s*/);
    out += (ws ? ws[0] : '') + prefixSelector(sel) + '{' + body + '}';
    i = close + 1;
  }
  return out;
}

function wrapFile(rel) {
  const abs = path.join(ROOT, rel);
  let src = fs.readFileSync(abs, 'utf8');
  if (src.indexOf(MARKER) !== -1) {
    return { rel, skipped: true, reason: 'už obalené' };
  }
  const next = transformChunk(src);
  if (!DRY) fs.writeFileSync(abs, next, 'utf8');
  return {
    rel,
    skipped: false,
    before: src.length,
    after: next.length,
    prefixed: (next.match(/html:not\(\[data-theme="light"\]\)/g) || []).length,
  };
}

const results = FILES.map(wrapFile);
results.forEach(function (r) {
  if (r.skipped) console.log(r.rel, 'SKIP', r.reason);
  else console.log(r.rel, DRY ? 'DRY' : 'OK', 'prefixed=' + r.prefixed, r.before + '→' + r.after);
});
