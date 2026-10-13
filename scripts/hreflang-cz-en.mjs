#!/usr/bin/env node
/**
 * Do českých článků, které mají EN verzi (pole CZ URL v EN draftech),
 * vloží do <head> alternate hreflang en + cs. Idempotentní, nic jiného nemění.
 *
 * NA ŽIVÉM REPU NESPOLÉHEJ NA TENTO SKRIPT bez kontroly. Výchozí běh čte
 * drafty z clanky-en/ a české HTML z --root.
 *
 * Použití:
 *   node scripts/hreflang-cz-en.mjs [--drafty <slozka>] [--root <repo>] [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  DEFAULT_DRAFTY,
  czFileFromUrl,
  listDraftFiles,
  parseEnDraft,
} from './blog-publikuj-en.mjs';
import { escapeHtml } from './blog-publikuj.mjs';

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..');

const HREFLANG_EN_RE = /\n?[ \t]*<link rel="alternate" hreflang="en" href="[^"]*"\s*\/?>/g;
const HREFLANG_CS_RE = /\n?[ \t]*<link rel="alternate" hreflang="cs" href="[^"]*"\s*\/?>/g;

export function applyHreflang(html, { enUrl, csUrl }) {
  if (!html.includes('</head>')) throw new Error('Soubor nemá </head>.');
  const enTag = `    <link rel="alternate" hreflang="en" href="${escapeHtml(enUrl)}">`;
  const csTag = `    <link rel="alternate" hreflang="cs" href="${escapeHtml(csUrl)}">`;
  let out = html.replace(HREFLANG_EN_RE, '').replace(HREFLANG_CS_RE, '');
  out = out.replace(/<\/head>/i, `${enTag}\n${csTag}\n</head>`);
  return out;
}

export function bodyAfterHead(html) {
  const i = html.search(/<\/head>/i);
  if (i < 0) return html;
  const end = html.indexOf('>', i);
  return html.slice(end + 1);
}

export function runHreflang(opts = {}) {
  const root = opts.root || DEFAULT_ROOT;
  const draftDir = opts.drafty || DEFAULT_DRAFTY;
  const dry = !!opts.dry;
  const files = listDraftFiles(draftDir);
  const results = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(draftDir, file), 'utf8');
    const draft = parseEnDraft(raw);
    if (!draft.czUrl) {
      results.push({ file, slug: draft.slug, skipped: 'chybí CZ URL' });
      continue;
    }
    const rel = czFileFromUrl(draft.czUrl);
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) {
      results.push({ file, slug: draft.slug, skipped: `český soubor není v root: ${rel}` });
      continue;
    }
    const before = fs.readFileSync(abs, 'utf8');
    const after = applyHreflang(before, { enUrl: draft.canonical, csUrl: draft.czUrl });
    const bodySame = bodyAfterHead(before) === bodyAfterHead(after);
    if (!bodySame) {
      throw new Error(`${rel}: změna by sahala mimo <head>. Zastaveno.`);
    }
    if (!dry && after !== before) fs.writeFileSync(abs, after);
    results.push({
      file,
      slug: draft.slug,
      rel,
      changed: after !== before,
      dry,
    });
  }
  return results;
}

function parseArgs(argv) {
  const args = { dry: false, root: DEFAULT_ROOT, drafty: DEFAULT_DRAFTY };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') args.dry = true;
    else if (a === '--drafty') args.drafty = path.resolve(argv[++i]);
    else if (a === '--root') args.root = path.resolve(argv[++i]);
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a.startsWith('-')) throw new Error(`Neznámý přepínač: ${a}`);
  }
  return args;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Použití: node scripts/hreflang-cz-en.mjs [--drafty <slozka>] [--root <repo>] [--dry]');
    process.exit(0);
  }
  try {
    const results = runHreflang(args);
    console.log('=== hreflang-cz-en ===');
    for (const r of results) {
      if (r.skipped) console.log(`  skip ${r.slug}: ${r.skipped}`);
      else console.log(`  ${r.rel}  ${r.changed ? (r.dry ? 'by se změnil (--dry)' : 'upraven') : 'beze změny'}`);
    }
  } catch (e) {
    console.error(`⛔ ${e.message}`);
    process.exit(1);
  }
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) main();
