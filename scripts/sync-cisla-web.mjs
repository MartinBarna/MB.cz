#!/usr/bin/env node
/**
 * sync:cisla-web  (kapitola 4b navrhu automatiky cisel)
 *
 * Prepis verejnych cisel do STATICKEHO HTML martinbarna.cz a do `llms.txt`.
 * Cislo zustava primo v souboru, takze ho vidi crawler i AI a nic se nemusi
 * dotahovat za behu. Zdroj pravdy je `app_config` v Academy DB, kterou plni
 * edge funkce `cisla-sync` z RPC `verejna_cisla()` v DB appky; sem se cte
 * anonymne pres RPC `cisla_pro_web()` (viz scripts/cisla-zdroj.mjs).
 *
 * ⭐ SPOUSTI SE SAM pri kazdem deployi: krok "Verejna cisla" ve workflow
 *    `.github/workflows/deploy-wedos.yml`, jeste PRED nahranim na FTP. Tam je
 *    zamerne NEFATALNI, protoze nasazeni webu je dulezitejsi nez cerstvost cisla.
 *
 * ZNACKY V HTML:
 *
 *     <p>Databaze <!-- cislo:potraviny -->50 000<!-- /cislo --> potravin.</p>
 *
 *   Mezi znackami smi byt VYHRADNE cislo (cislice a mezery). Slovo "pres",
 *   slovo "potravin" ani cokoli jineho tam nepatri: skript by je prepsal pryc.
 *   Kdyz mezi znackami najde neco jineho nez cislo, KONCI CHYBOU a nesaha na nic.
 *
 * TYPY ZNACEK (vic nez jeden, protoze cisla NEJSOU zamenitelna):
 *
 *   cislo:potraviny  z app_config.pocet_potravin ("50 000", uz zaokrouhleno
 *                    dolu na 10 000). Pise se VZDY za slovem "pres".
 *
 *   cislo:recepty    z app_config.pocet_receptu, ale ZAOKROUHLENE DOLU NA DESITKY
 *                    (148 -> 140). Staticky web se prepisuje jen pri deployi, takze
 *                    presne cislo by po odverejneni jednoho receptu lhalo nahoru.
 *                    Presne cislo (148) patri do mailu a do SPA, ktere se obnovuji
 *                    casto, ne sem. Proto se ve vete pise "pres 140", ne "140".
 *
 *   cislo:academy    ⛔⛔ NE Z DATABAZE. Nastroj "Databaze potravin" v Academy cte
 *                    STATICKY EXPORT `assets/curated-foods.min.json`, ne zivou
 *                    tabulku. Kdo tam napise cislo z DB, slibi hledacku pres
 *                    16 tisic polozek, ktere v nem nejsou. Skript proto pro tenhle
 *                    typ pocita delku exportu a zaokrouhli ji dolu na 10 000.
 *                    Zvednout se smi az PO
 *                    `SUPABASE_SERVICE_ROLE_KEY=... node scripts/export-curated-foods.mjs`.
 *
 * ⛔ CO SE SEM ZAMERNE NEDAVA: pocet cviku (120, kuratorsky seznam v repu appky)
 *    a cislo generatoru (1 192 z `src/engine/food-db.json`). Ani jedno neni pocet
 *    radku v DB a cislo generatoru do prodejniho textu nepatri vubec.
 *
 * Pouziti (klic uz neni potreba, cisla se ctou anonymne):
 *   node scripts/sync-cisla-web.mjs                            (zapise)
 *   node scripts/sync-cisla-web.mjs --dry                      (jen ukaze)
 *   node scripts/sync-cisla-web.mjs --json vzorek.json --dry   (bez site)
 *
 * Exit 0 = hotovo (se zmenou i bez ni).  Exit 1 = jakakoli nejednoznacnost:
 * neznamy typ znacky, neuzavrena znacka, neciselny obsah, nesedici vzor v
 * llms.txt, nesmyslna nebo chybejici zdrojova hodnota. Pri chybe se nezapise
 * NIC, ani do souboru, ktery byl v poradku. Radeji nezapsat nic nez nesmysl.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatujMezerou,
  mapaZRadku,
  nactiCisla,
  parseCislo,
  zaokrouhliDolu,
} from "./cisla-zdroj.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/** Export, ktery si opravdu stahuje nastroj Academy (viz akademie/nastroje/potraviny). */
export const EXPORT_ACADEMY = "assets/curated-foods.min.json";

/** Slozky, do kterych se nesaha: zalohy, importy a podklady nejsou zivy web. */
const PRESKOCIT = new Set([".git", "node_modules", "_zaloha", "_import", "_zdroje", "scripts"]);

const OTEVIRACI = /<!--\s*cislo:([a-zA-Z_-]+)\s*-->/g;
const ZAVIRACI = /<!--\s*\/cislo\s*-->/g;
const PAR = /<!--\s*cislo:([a-zA-Z_-]+)\s*-->([\s\S]*?)<!--\s*\/cislo\s*-->/g;
// Mezi znackami smi byt jen cislice a mezery (vcetne nedelitelne, U+00A0).
const JEN_CISLO = /^[0-9][0-9 \u00a0]*$/;

/**
 * Spocita polozky ve statickem exportu pro Academy.
 * Podporuje oba tvary: pole objektu (`curated-foods.json`) i zhustene
 * `{cols:[...], rows:[[...]]}` (`curated-foods.min.json`).
 */
export function pocetVExportu(json) {
  if (Array.isArray(json)) return json.length;
  if (json && typeof json === "object" && Array.isArray(json.rows)) return json.rows.length;
  throw new Error("export potravin: cekam pole nebo {cols, rows}");
}

/**
 * Z app_config (+ delky exportu) spocita, co se smi zapsat do HTML.
 * Hazi vyjimku, kdyz je kterakoli hodnota chybejici nebo nesmyslna. Stara
 * hodnota v HTML je vzdy pravdiva, jen starsi, takze nezapsat nic je bezpecne.
 */
export function hodnotyProZnacky(mapa, pocetAcademy = null) {
  const out = {};

  const potravinyText = String(mapa?.pocet_potravin ?? "").trim();
  const potraviny = parseCislo(potravinyText);
  if (!Number.isFinite(potraviny) || potraviny < 10000) {
    throw new Error("app_config.pocet_potravin je mimo rozsah: \"" + potravinyText + "\"");
  }
  if (zaokrouhliDolu(potraviny, 10000) !== potraviny) {
    throw new Error(
      "app_config.pocet_potravin (\"" + potravinyText + "\") NENI zaokrouhleny dolu na " +
        "10 000. Do HTML se pise jen zaokrouhlena hodnota, jinak se nekde slibi vic, " +
        "nez kolik je.",
    );
  }
  // Krizova kontrola proti surovemu cislu. Chyti rozsypanou app_config drive,
  // nez se cislo objevi na verejne strance.
  const raw = parseCislo(mapa?.pocet_potravin_raw ?? "");
  if (Number.isFinite(raw) && zaokrouhliDolu(raw, 10000) !== potraviny) {
    throw new Error(
      "app_config: pocet_potravin (" + potraviny + ") nesedi na pocet_potravin_raw (" +
        raw + "). Zaokrouhleni dolu na 10 000 by dalo " + zaokrouhliDolu(raw, 10000) + ".",
    );
  }
  out.potraviny = formatujMezerou(potraviny);

  const receptyText = String(mapa?.pocet_receptu ?? "").trim();
  const recepty = parseCislo(receptyText);
  if (!Number.isFinite(recepty) || recepty < 50) {
    throw new Error("app_config.pocet_receptu je mimo rozsah: \"" + receptyText + "\"");
  }
  out.recepty = formatujMezerou(zaokrouhliDolu(recepty, 10));

  if (pocetAcademy != null) {
    if (!Number.isFinite(pocetAcademy) || pocetAcademy < 10000) {
      throw new Error("export " + EXPORT_ACADEMY + " ma jen " + pocetAcademy + " polozek");
    }
    out.academy = formatujMezerou(zaokrouhliDolu(pocetAcademy, 10000));
  }
  return out;
}

/**
 * Prepise oznacena mista v jednom HTML. Vraci { text, zmeny, chyby }.
 * Nezapisuje na disk, aby se to dalo testovat i pustit nasucho.
 */
export function prepisZnacky(html, hodnoty, kdeProHlasku = "") {
  const kde = kdeProHlasku ? kdeProHlasku + ": " : "";
  const chyby = [];
  const zmeny = [];

  const otevrenych = (html.match(OTEVIRACI) || []).length;
  const zavrenych = (html.match(ZAVIRACI) || []).length;
  const paru = (html.match(PAR) || []).length;
  if (otevrenych !== zavrenych || otevrenych !== paru) {
    chyby.push(
      kde + "znacky nesedi (otviracich " + otevrenych + ", zaviracich " + zavrenych +
        ", parovanych " + paru + "). Nekde chybi `<!-- /cislo -->` nebo jsou vnorene.",
    );
    return { text: html, zmeny, chyby };
  }

  const text = html.replace(PAR, (cely, typ, obsah) => {
    const nova = hodnoty[typ];
    if (nova === undefined) {
      chyby.push(
        kde + "neznamy typ znacky `cislo:" + typ + "`. Znam: " +
          Object.keys(hodnoty).join(", ") + ".",
      );
      return cely;
    }
    const stara = obsah.trim();
    if (!JEN_CISLO.test(stara)) {
      chyby.push(
        kde + "mezi `cislo:" + typ + "` a `/cislo` neni hole cislo, ale \"" +
          stara.slice(0, 60) + "\". Do znacek patri VYHRADNE cislo, slovo `pres` " +
          "a jednotka zustavaji venku.",
      );
      return cely;
    }
    if (stara === nova) return cely;
    zmeny.push({ typ, stara, nova });
    return "<!-- cislo:" + typ + " -->" + nova + "<!-- /cislo -->";
  });

  if (chyby.length) return { text: html, zmeny: [], chyby };
  return { text, zmeny, chyby };
}

/* ------------------------------------------------------------------ llms.txt */

export const LLMS_TXT = "llms.txt";

/**
 * llms.txt je HOLY TEXT PRO ROBOTY, ne HTML. Komentar `<!-- cislo:... -->` by se
 * v nem cetl jako obsah stranky, takze se cisla musi hledat jinak.
 *
 * PROC REGEX NA ZNAMOU VETU A NE PLACEHOLDER `{{pocet_potravin}}`:
 *   Placeholder by musel byt v souboru ulozenem v gitu. Tim by llms.txt byl mezi
 *   behy skriptu ROZBITY (robot by cetl "Databaze pres {{pocet_potravin}}
 *   potravin") a musela by vzniknout dvojice sablona + generovany soubor, tedy
 *   dalsi misto, kde se da zapomenout a kde se daji rozejit. Regex proti tomu
 *   nechava soubor po celou dobu spravny a cely: v gitu i na webu stoji skutecne
 *   cislo a skript prepisuje jen cislice mezi znamymi slovy.
 *   Cena: kdyz nekdo vetu preformuluje, kotva zmizi. Prave proto se vyzaduje
 *   PRESNE JEDNA shoda; pri nule i pri dvou skript KONCI CHYBOU a nesaha na nic
 *   (ani na HTML), aby nemohl prepsat neco jineho nez cislo.
 *
 * Zaokrouhluje se stejne jako v HTML (potraviny na 10 000, recepty na desitky):
 * llms.txt se nasazuje tymz deployem jako staticky web, takze presne cislo by
 * mezi deployi stejne stihlo zestarnout smerem nahoru.
 */
export const PRAVIDLA_LLMS = [
  {
    typ: "potraviny",
    popis: "Databáze přes <cislo> potravin",
    re: /(Databáze přes )([0-9][0-9 \u00a0]*)( potravin)/g,
  },
  {
    typ: "recepty",
    popis: "Knihovna přes <cislo> fit receptů",
    re: /(Knihovna přes )([0-9][0-9 \u00a0]*)( fit receptů)/g,
  },
];

/**
 * Prepise cisla v llms.txt. Vraci { text, zmeny, chyby } ve stejnem tvaru jako
 * `prepisZnacky`, aby se s obojim dalo v mainu zachazet jednotne.
 */
export function prepisLlms(text, hodnoty, kdeProHlasku = LLMS_TXT, pravidla = PRAVIDLA_LLMS) {
  const kde = kdeProHlasku ? kdeProHlasku + ": " : "";
  const chyby = [];
  const zmeny = [];
  let out = text;

  for (const { typ, popis, re } of pravidla) {
    const nova = hodnoty[typ];
    if (nova === undefined) {
      chyby.push(
        kde + "neznam hodnotu pro `" + typ + "`. Znam: " + Object.keys(hodnoty).join(", ") + ".",
      );
      continue;
    }
    const nalezy = [...out.matchAll(re)];
    if (nalezy.length !== 1) {
      chyby.push(
        kde + "vzor `" + popis + "` sedi " + nalezy.length + "x, cekam presne jednou. " +
          "Bud nekdo tu vetu preformuloval, nebo pribyla druha. Nesahl jsem na nic.",
      );
      continue;
    }
    const [cely, pred, stare, po] = nalezy[0];
    const stara = stare.trim();
    if (stara === nova) continue;
    out = out.replace(cely, () => pred + nova + po);
    zmeny.push({ typ, stara, nova });
  }

  if (chyby.length) return { text, zmeny: [], chyby };
  return { text: out, zmeny, chyby };
}

/** Projde repo a vrati relativni cesty HTML souboru, do kterych se smi sahat. */
export function najdiHtml(korenAbs, preskocit = PRESKOCIT) {
  const out = [];
  const chod = (dir) => {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (d.name.startsWith(".") || preskocit.has(d.name)) continue;
      const p = path.join(dir, d.name);
      if (d.isDirectory()) chod(p);
      else if (d.isFile() && /\.html?$/i.test(d.name)) out.push(path.relative(korenAbs, p));
    }
  };
  chod(korenAbs);
  return out.sort();
}

function parsujArgumenty(argv) {
  const out = { dry: false, json: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry") out.dry = true;
    else if (a === "--json") out.json = argv[++i] ?? null;
    else if (a === "--help" || a === "-h") out.help = true;
    else throw new Error("neznamy argument: " + a);
  }
  return out;
}

async function main(argv) {
  let arg;
  try {
    arg = parsujArgumenty(argv);
  } catch (e) {
    console.error(String(e.message ?? e));
    process.exit(1);
  }
  if (arg.help) {
    console.log(
      "Pouziti: ACADEMY_SERVICE_ROLE_KEY=... node scripts/sync-cisla-web.mjs [--dry] " +
        "[--json vzorek.json]",
    );
    process.exit(0);
  }

  let mapa;
  try {
    if (arg.json) {
      const raw = JSON.parse(fs.readFileSync(path.resolve(arg.json), "utf8"));
      mapa = Array.isArray(raw) ? mapaZRadku(raw) : raw;
    } else {
      mapa = await nactiCisla();
    }
  } catch (e) {
    console.error("Cteni cisel selhalo: " + String(e.message ?? e));
    process.exit(1);
  }

  let pocetAcademy = null;
  const exportAbs = path.join(ROOT, EXPORT_ACADEMY);
  if (fs.existsSync(exportAbs)) {
    try {
      pocetAcademy = pocetVExportu(JSON.parse(fs.readFileSync(exportAbs, "utf8")));
    } catch (e) {
      console.error("Cteni " + EXPORT_ACADEMY + " selhalo: " + String(e.message ?? e));
      process.exit(1);
    }
  }

  let hodnoty;
  try {
    hodnoty = hodnotyProZnacky(mapa, pocetAcademy);
  } catch (e) {
    console.error("Zdrojova cisla nedavaji smysl, nic jsem neprepsal: " + String(e.message ?? e));
    process.exit(1);
  }

  console.log("Hodnoty k zapisu:");
  for (const [k, v] of Object.entries(hodnoty)) console.log("  cislo:" + k + " -> " + v);
  if (pocetAcademy != null) {
    console.log("  (export " + EXPORT_ACADEMY + " ma " + pocetAcademy + " polozek)");
  }

  // DVA PRUCHODY ZAMERNE: nejdriv se spocita vsechno, teprve pak se zapisuje.
  // Kdyby se zapisovalo prubezne, chyba v poslednim souboru by uz nechala prepsane
  // ty predchozi a hlaska "nezapsal jsem nic" by lhala.
  const chyby = [];
  const kZapisu = [];
  let zmenCelkem = 0;
  const pridej = (abs, rel, v) => {
    if (v.chyby.length) {
      chyby.push(...v.chyby);
      return;
    }
    if (!v.zmeny.length) return;
    zmenCelkem += v.zmeny.length;
    kZapisu.push({ abs, rel, text: v.text, zmeny: v.zmeny });
  };

  for (const rel of najdiHtml(ROOT)) {
    const abs = path.join(ROOT, rel);
    const puvodni = fs.readFileSync(abs, "utf8");
    if (!/<!--\s*cislo:/.test(puvodni)) continue;
    pridej(abs, rel, prepisZnacky(puvodni, hodnoty, rel));
  }

  // llms.txt jde touz branou jako HTML, jen jinou konvenci (viz PRAVIDLA_LLMS).
  const llmsAbs = path.join(ROOT, LLMS_TXT);
  if (fs.existsSync(llmsAbs)) {
    pridej(llmsAbs, LLMS_TXT, prepisLlms(fs.readFileSync(llmsAbs, "utf8"), hodnoty, LLMS_TXT));
  }

  if (chyby.length) {
    for (const c of chyby) console.error("CHYBA: " + c);
    console.error("Nezapsal jsem NIC (ani do souboru bez chyby), dokud se tohle nespravi.");
    process.exit(1);
  }

  for (const s of kZapisu) {
    for (const z of s.zmeny) {
      console.log("  " + s.rel + "  cislo:" + z.typ + "  " + z.stara + " -> " + z.nova);
    }
    if (!arg.dry) fs.writeFileSync(s.abs, s.text);
  }
  console.log(
    (arg.dry ? "NASUCHO: " : "") + "zmenenych vyskytu: " + zmenCelkem +
      " v " + kZapisu.length + " souborech.",
  );
  process.exit(0);
}

const jeHlavni = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (jeHlavni) await main(process.argv);
