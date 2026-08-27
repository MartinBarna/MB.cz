#!/usr/bin/env node
/**
 * Fronta blogových článků: vydá to, co je na dnešek nebo dřív.
 *
 * ⭐ Sám nic negeneruje. Článek, kartu ve výpisu i záznam v sitemapě staví
 * `scripts/blog-publikuj.mjs` (otestovaný, `node --test scripts/blog-publikuj.test.mjs`).
 * Tenhle skript je JEN dispečer fronty: vybere, co je splatné, zavolá publikaci,
 * odškrtne položku z manifestu a draft odsune do `clanky-fronta/vydano/`.
 * ⛔ Nikdy sem nekopíruj logiku stavby HTML, karty ani sitemapy: byla by to
 *    druhá verze generátoru a rozešla by se s tou první.
 *
 * Fronta: clanky-fronta/manifest.json
 *   { "clanky": [ { "date": "2026-09-24", "draft": "muj-clanek.md", "poznamka": "…" } ] }
 *   `date`  = den vydání (YYYY-MM-DD), vydá se v ten den nebo kterýkoli pozdější běh.
 *   `draft` = jméno souboru v clanky-fronta/ (markdown ve formátu blog-publikuj).
 *   Slug, titulek a text se BEROU Z DRAFTU, v manifestu nejsou schválně:
 *   dvě místa pravdy by se rozešla.
 *
 * Použití:
 *   node scripts/blog-fronta-vydej.mjs               # ostře
 *   node scripts/blog-fronta-vydej.mjs --dry         # jen zkontrolovat, nic nezapsat
 *   node scripts/blog-fronta-vydej.mjs --dnes 2026-09-24 --root /tmp/kopie   # test
 *
 * Exit kódy: 0 = vydáno nebo nebylo co vydat, 1 = chyba (nevydá se NIC).
 * Nejdřív se všechny splatné drafty zkontrolují nanečisto; teprve když projdou
 * všechny, zapíše se cokoli. Jeden vadný draft tedy nevydá půlku fronty.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { publishDraft } from './blog-publikuj.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..');
const FRONTA_DIR = 'clanky-fronta';
const MANIFEST = 'manifest.json';
const VYDANO_DIR = 'vydano';
const ORIGIN = 'https://martinbarna.cz';

/** Dnešek v Praze, ne v UTC: cron běží v UTC a kolem půlnoci by se datum lišilo. */
export function dnesPraha(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function nactiManifest(raw, kdeProChybu = 'manifest.json') {
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`${kdeProChybu}: nevalidní JSON (${e.message})`);
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.clanky)) {
    throw new Error(`${kdeProChybu}: čekám objekt s polem "clanky".`);
  }
  const videnyDraft = new Set();
  data.clanky.forEach((polozka, i) => {
    const kde = `${kdeProChybu}, položka ${i + 1}`;
    if (!polozka || typeof polozka !== 'object') throw new Error(`${kde}: není objekt.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(polozka.date || ''))) {
      throw new Error(`${kde}: "date" musí být YYYY-MM-DD, je: ${JSON.stringify(polozka.date)}`);
    }
    const draft = String(polozka.draft || '');
    if (!/^[A-Za-z0-9._-]+\.md$/.test(draft)) {
      throw new Error(`${kde}: "draft" musí být jméno .md souboru bez cesty, je: ${JSON.stringify(polozka.draft)}`);
    }
    if (videnyDraft.has(draft)) throw new Error(`${kde}: draft ${draft} je v manifestu dvakrát.`);
    videnyDraft.add(draft);
  });
  return data;
}

export function splatne(data, dnes) {
  return data.clanky
    .filter((p) => p.date <= dnes)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function parseArgs(argv) {
  const args = { dry: false, root: DEFAULT_ROOT, dnes: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') args.dry = true;
    else if (a === '--root') args.root = path.resolve(argv[++i]);
    else if (a.startsWith('--root=')) args.root = path.resolve(a.slice('--root='.length));
    else if (a === '--dnes') args.dnes = argv[++i];
    else if (a.startsWith('--dnes=')) args.dnes = a.slice('--dnes='.length);
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`Neznámý přepínač: ${a}`);
  }
  if (args.dnes && !/^\d{4}-\d{2}-\d{2}$/.test(args.dnes)) {
    throw new Error(`--dnes musí být YYYY-MM-DD, je: ${args.dnes}`);
  }
  return args;
}

export function vydejFrontu(opts = {}) {
  const root = opts.root || DEFAULT_ROOT;
  const dry = !!opts.dry;
  const dnes = opts.dnes || dnesPraha();
  const frontaDir = path.join(root, FRONTA_DIR);
  const manifestPath = path.join(frontaDir, MANIFEST);

  if (!fs.existsSync(manifestPath)) {
    // Prázdná fronta není chyba: automat má běžet každý den i bez práce.
    return { dnes, manifestChybi: true, splatne: 0, vydane: [], zbyva: 0, dry };
  }

  const data = nactiManifest(fs.readFileSync(manifestPath, 'utf8'), `${FRONTA_DIR}/${MANIFEST}`);
  const kVydani = splatne(data, dnes);
  if (!kVydani.length) {
    return { dnes, manifestChybi: false, splatne: 0, vydane: [], zbyva: data.clanky.length, dry };
  }

  // 1) Nanečisto VŠECHNY splatné. Když jeden neprojde, nevydá se ani jeden.
  const draftCesty = new Map();
  for (const polozka of kVydani) {
    const draftPath = path.join(frontaDir, polozka.draft);
    if (!fs.existsSync(draftPath)) {
      throw new Error(`Manifest slibuje draft, který v ${FRONTA_DIR}/ není: ${polozka.draft}`);
    }
    draftCesty.set(polozka.draft, draftPath);
    // ⛔ TICHÁ PAST: datum článku bere blog-publikuj z pole `Datum` v draftu, ne odsud.
    // Draft napsaný v srpnu a naplánovaný na září by vyšel s datem v srpnu (hero,
    // JSON-LD datePublished). Buď se pole vypustí (doplní se den vydání), nebo musí
    // sedět s manifestem.
    const datumDraftu = datumZDraftu(fs.readFileSync(draftPath, 'utf8'));
    if (datumDraftu && datumDraftu !== polozka.date) {
      throw new Error(
        `Draft ${polozka.draft} má v hlavičce "Datum: ${datumDraftu}", ale ve frontě je na ${polozka.date}.\n`
        + '  Článek by vyšel se špatným datem. Buď pole Datum z draftu smaž (doplní se den vydání),\n'
        + '  nebo ho srovnej s datem v manifestu.',
      );
    }
    try {
      publishDraft({ draftPath, root, dry: true });
    } catch (e) {
      if (e.code === 'EXISTS') continue; // vyřeší se v ostrém průchodu jako "už publikováno"
      throw new Error(`Draft ${polozka.draft} neprošel kontrolou:\n${e.message}`);
    }
  }
  if (dry) {
    return {
      dnes,
      manifestChybi: false,
      splatne: kVydani.length,
      vydane: kVydani.map((p) => ({ draft: p.draft, date: p.date, kontrolaOk: true })),
      zbyva: data.clanky.length - kVydani.length,
      dry: true,
    };
  }

  // 2) Ostře.
  const vydano = [];
  const vydanoDir = path.join(frontaDir, VYDANO_DIR);
  for (const polozka of kVydani) {
    const draftPath = draftCesty.get(polozka.draft);
    let vysledek = null;
    let jenPresun = false;
    try {
      vysledek = publishDraft({ draftPath, root });
    } catch (e) {
      if (e.code !== 'EXISTS') throw e;
      // Článek už na webu je (někdo ho vydal ručně). Odškrtnout, ne padat.
      jenPresun = true;
    }
    const slug = vysledek
      ? vysledek.slug
      : String(e_slugZChyby(draftPath));
    fs.mkdirSync(vydanoDir, { recursive: true });
    fs.renameSync(draftPath, path.join(vydanoDir, polozka.draft));
    vydano.push({
      draft: polozka.draft,
      date: polozka.date,
      slug,
      title: vysledek ? vysledek.title : '',
      url: `${ORIGIN}/clanky/${slug}.html`,
      jizExistoval: jenPresun,
    });
  }

  const zbytek = data.clanky.filter((p) => !vydano.some((v) => v.draft === p.draft));
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify({ ...data, clanky: zbytek }, null, 2)}\n`,
    'utf8',
  );

  return {
    dnes,
    manifestChybi: false,
    splatne: kVydani.length,
    vydane: vydano,
    zbyva: zbytek.length,
    dry: false,
  };
}

/** Pole `Datum:` z hlavičky draftu, nebo null. Hlavička končí prvním `## `. */
export function datumZDraftu(raw) {
  const hlavicka = raw.replace(/\r\n/g, '\n').split(/\n##\s+/)[0];
  const m = hlavicka.match(/^\s*(?:\*\*)?(?:Datum|Date)(?:\*\*)?\s*:\s*(\S+)\s*$/im);
  return m ? m[1] : null;
}

/** Slug z draftu, když publikace skončila na EXISTS (článek už na webu je). */
function e_slugZChyby(draftPath) {
  const raw = fs.readFileSync(draftPath, 'utf8');
  const m = raw.match(/^\s*(?:\*\*)?(?:Navržená URL|Navrzena URL|URL|Slug)(?:\*\*)?\s*:\s*(.+)$/im);
  if (!m) throw new Error(`Nešlo přečíst slug z draftu ${draftPath}`);
  return m[1]
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?martinbarna\.cz/i, '')
    .replace(/^\/+/, '')
    .replace(/^clanky\//, '')
    .replace(/\.html$/i, '')
    .replace(/\/+$/, '');
}

function zapisVystupyProActions(vysledek) {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  const slugy = vysledek.vydane.map((v) => v.slug).filter(Boolean).join(',');
  const urls = vysledek.vydane.map((v) => v.url).filter(Boolean).join(' ');
  fs.appendFileSync(
    out,
    `pocet=${vysledek.vydane.length}\nslugy=${slugy}\nurls=${urls}\n`,
    'utf8',
  );
}

function usage() {
  return `Použití: node scripts/blog-fronta-vydej.mjs [--dry] [--dnes YYYY-MM-DD] [--root cesta]

Vydá z clanky-fronta/manifest.json všechno s date <= dnes:
  clanky/<slug>.html, karta v clanky/index.html, záznam v sitemap.xml,
  draft se přesune do clanky-fronta/vydano/ a zmizí z manifestu.

  --dry    Zkontrolovat splatné drafty, nic nezapsat.
  --dnes   Přepsat "dnešek" (jen pro testy).
  --root   Kořen webu (default kořen tohohle repa).`;
}

function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    console.error(`⛔ ${e.message}`);
    process.exit(1);
  }
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }
  let v;
  try {
    v = vydejFrontu({ root: args.root, dry: args.dry, dnes: args.dnes });
  } catch (e) {
    console.error(`⛔ Fronta se nevydala, NEZAPSALO SE NIC: ${e.message}`);
    process.exit(1);
  }
  console.log('=== blog-fronta-vydej ===');
  console.log(`dnes:      ${v.dnes}`);
  if (v.manifestChybi) {
    console.log(`manifest:  ${FRONTA_DIR}/${MANIFEST} neexistuje, fronta je prázdná`);
  }
  console.log(`splatne:   ${v.splatne}`);
  console.log(v.dry ? 'zapsano:   NIC (--dry)' : `vydano:    ${v.vydane.length}`);
  for (const x of v.vydane) {
    const pozn = x.jizExistoval ? '  ⚠️ clanky/*.html už existoval, jen odškrtnuto z fronty' : '';
    console.log(`  ${x.date}  ${x.draft}${x.slug ? `  →  ${x.url}` : ''}${pozn}`);
  }
  console.log(`ve fronte zbyva: ${v.zbyva}`);
  if (!v.dry) zapisVystupyProActions(v);
}

const invoked = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) main();
