#!/usr/bin/env node
/**
 * kontrola:mail-tokeny
 *
 * Staticka kontrola tokenu v mailovych sablonach proti vestavenym klicum
 * v drip-send/index.ts. Nic neodesila, na DB sahat nesmi.
 *
 * Pouziti:
 *   node scripts/kontrola-mail-tokeny.mjs cesta/k/email_templates.json
 *
 * JSON export (predava sef, cesta je argument):
 *   - pole objektu {track, step, key, subject, preheader, blocks}
 *   - nebo { templates: [...] } / { email_templates: [...] }
 *
 * Vestavene klice se PARSUJI z `buildVars()` (a z `CISLA`, ktere se do vestavenych
 * rozbaluje pres ...cisla). NIKDY se neopisuji rucne.
 *
 * Zname vyjimky (dosazuji se z tela invoku, ne z buildVars), kdo je plni:
 *   castka, produkt     – refund / order-rescue
 *   znovu_odkaz         – order-rescue (odkaz na nedokoncenu objednavku)
 *   varianta            – A/B blast
 *   otazky_url          – onboarding koucing
 *   kucharka_url        – onboarding / materialy
 *   pristup_do          – casove omezeny pristup
 *
 * Exit 1 = neznamy token (trat/krok/klic). Exit 0 = vsechny tokeny jsou vestavene
 * nebo na whitelistu.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DRIP_SEND = path.join(ROOT, "akademie/_supabase/functions/drip-send/index.ts");

const INVOKE_WHITELIST = new Set([
  "castka",
  "produkt",
  "znovu_odkaz",
  "varianta",
  "otazky_url",
  "kucharka_url",
  "pristup_do",
]);

/**
 * Strhne `//...` a `/*...*\/` komentare PRED parsovanim klicu. Dva duvody:
 *   1) komentar se slozenou zavorkou rozhodi pocitani hloubky ve vytahniObjekt
 *      a blok se utne driv, takze se ztrati klice za nim;
 *   2) obycejna veta v komentari, ktera konci dvojteckou ("mezi vestavenymi:"),
 *      vyrobi fantomovy klic a ten pak tise whitelistne preklep v sablone.
 * Musi umet stringy a template literaly, jinak by `https://...` v URL sezralo
 * zbytek radku.
 */
export function strhniKomentare(zdroj) {
  const s = String(zdroj ?? "");
  let out = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    const dalsi = s[i + 1];
    if (ch === "/" && dalsi === "/") {
      while (i < s.length && s[i] !== "\n") i++;
      continue;                                   // "\n" nechavame projit dal
    }
    if (ch === "/" && dalsi === "*") {
      i += 2;
      while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) i++;
      i += 2;
      out += " ";
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      out += ch;
      i++;
      while (i < s.length) {
        if (s[i] === "\\") { out += s.slice(i, i + 2); i += 2; continue; }
        out += s[i];
        i++;
        if (s[i - 1] === ch) break;
      }
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

export function vytahniObjekt(zdrojSKomentari, nazev) {
  const zdroj = strhniKomentare(zdrojSKomentari);
  const jehly = [
    `const ${nazev}: Record<string, string> = {`,
    `const ${nazev} = {`,
  ];
  let start = -1;
  for (const j of jehly) {
    const i = zdroj.indexOf(j);
    if (i >= 0) {
      start = zdroj.indexOf("{", i);
      break;
    }
  }
  if (start < 0) return null;
  let hloubka = 0;
  for (let i = start; i < zdroj.length; i++) {
    const ch = zdroj[i];
    if (ch === "{") hloubka++;
    else if (ch === "}") {
      hloubka--;
      if (hloubka === 0) return zdroj.slice(start, i + 1);
    }
  }
  return null;
}

export function kliceObjektu(blok) {
  if (!blok) return [];
  // Komentare pryc (viz strhniKomentare), pak stringy pryc, jinak ternar
  // `fn ? 'x' : ''` vyrobi falesny klic `fn`.
  const cisty = strhniKomentare(blok).replace(/'[^']*'|"[^"]*"/g, "''");
  const klice = [];
  let hloubka = 0;
  let cekamKlic = false;
  const re = /[{},]|([A-Za-z_][A-Za-z0-9_]*)\s*:/g;
  let m;
  while ((m = re.exec(cisty))) {
    if (m[0] === "{") { hloubka++; cekamKlic = hloubka === 1; continue; }
    if (m[0] === "}") { hloubka--; cekamKlic = false; continue; }
    if (m[0] === ",") { cekamKlic = hloubka === 1; continue; }
    if (cekamKlic && m[1]) {
      klice.push(m[1]);
      cekamKlic = false;
    }
  }
  return klice;
}

export function vestaveneZDripSend(zdroj) {
  const vestaveneBlok = vytahniObjekt(zdroj, "vestavene");
  if (!vestaveneBlok) throw new Error("nenasel jsem const vestavene v drip-send/index.ts");
  const klice = new Set(kliceObjektu(vestaveneBlok));
  if (vestaveneBlok.includes("...cisla")) {
    const cislaBlok = vytahniObjekt(zdroj, "CISLA");
    if (!cislaBlok) throw new Error("vestavene rozbaluje ...cisla, ale const CISLA chybi");
    for (const k of kliceObjektu(cislaBlok)) klice.add(k);
  }
  return klice;
}

export function tokenyVTextu(s) {
  const out = [];
  const re = /\{\{([^{}]+)\}\}/g;
  let m;
  const text = typeof s === "string" ? s : JSON.stringify(s ?? "");
  while ((m = re.exec(text))) out.push(m[1].trim());
  return out;
}

export function nactiSablony(json) {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    if (Array.isArray(json.templates)) return json.templates;
    if (Array.isArray(json.email_templates)) return json.email_templates;
    if (Array.isArray(json.data)) return json.data;
  }
  throw new Error("JSON export: cekam pole sablon nebo {templates|email_templates|data: [...]}");
}

export function zkontrolujSablony(zdrojDripSend, sablony) {
  const vestavene = vestaveneZDripSend(zdrojDripSend);
  const nalezy = [];
  for (const s of sablony) {
    const kousky = [s.subject, s.preheader, s.blocks, s.html, s.text, s.footer_html, s.footer_text];
    const tokeny = new Set();
    for (const k of kousky) for (const t of tokenyVTextu(k)) tokeny.add(t);
    for (const t of tokeny) {
      if (vestavene.has(t) || INVOKE_WHITELIST.has(t)) continue;
      nalezy.push({
        track: s.track ?? "?",
        step: s.step ?? "?",
        key: s.key ?? "?",
        token: t,
      });
    }
  }
  return { vestavene: [...vestavene].sort(), nalezy };
}

function main(argv) {
  const cesta = argv[2];
  if (!cesta || cesta === "--help" || cesta === "-h") {
    console.log("Pouziti: node scripts/kontrola-mail-tokeny.mjs <cesta-k-email_templates.json>");
    process.exit(cesta ? 0 : 2);
  }
  const abs = path.resolve(cesta);
  if (!fs.existsSync(abs)) {
    console.error("Soubor neexistuje: " + abs);
    process.exit(2);
  }
  const zdroj = fs.readFileSync(DRIP_SEND, "utf8");
  const json = JSON.parse(fs.readFileSync(abs, "utf8"));
  const sablony = nactiSablony(json);
  const { vestavene, nalezy } = zkontrolujSablony(zdroj, sablony);
  console.log("Vestavene klice (" + vestavene.length + "): " + vestavene.join(", "));
  console.log("Sablon v exportu: " + sablony.length);
  if (nalezy.length === 0) {
    console.log("OK: zadny neznamy token.");
    process.exit(0);
  }
  console.error("NEZNAMY TOKEN (mail by spadl na unresolved_token):");
  for (const n of nalezy) {
    console.error("  " + n.track + "/" + n.step + "  key=" + n.key + "  {{" + n.token + "}}");
  }
  process.exit(1);
}

const jeHlavni = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (jeHlavni) main(process.argv);
