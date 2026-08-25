#!/usr/bin/env node
/**
 * kontrola:cisla-stari  (kapitola 5a navrhu automatiky cisel)
 *
 * HLIDKA STARI. Vsechny ostatni pojistky v automatice cisel selhavaji TISE a
 * bezpecnym smerem: kdyz `cisla-sync` prestane bezet, v `app_config` zustane
 * stara (porad pravdiva, jen starnouci) hodnota a maily i web dal jedou.
 * Nikdo si toho nevsimne. Tahle hlidka je jedine misto, kde zamrzla automatika
 * zacne KRICET.
 *
 * Pouziti (klic uz neni potreba, cte se anonymne pres RPC `cisla_pro_web`):
 *   node scripts/kontrola-cisla-stari.mjs
 *   node scripts/kontrola-cisla-stari.mjs --json vzorek.json     (offline, bez site)
 *   node scripts/kontrola-cisla-stari.mjs --limit-hodin 12
 *
 * Exit 0 = cisla jsou cerstva.  Exit 1 = automatika stoji nebo klic chybi.
 * Exit 2 = spatne pouziti (chybny argument, nectitelny soubor).
 *
 * PROC 26 HODIN (a ne 6 nebo 48):
 *   `pocet_cisel_mereno_v` NENI cas posledniho syncu. Je to `mereno_v` z RPC
 *   `verejna_cisla()` v appce, tedy okamzik, kdy se naposledy PREPOCITALA cache
 *   v DB appky. Do stari se scitaji DVE zpozdeni:
 *     - cache RPC v appce ma platnost 6 h,
 *     - cron `cisla-sync-6h` v Academy jede 4x denne, tedy dalsich az 6 h.
 *   Zdravy nejhorsi pripad je tedy kolem 12 h. 26 h znamena, ze VYPADLY nejmene
 *   dva po sobe jdouci behy, a to uz neni nahoda ani zdrzeni site.
 *   Navrh mel v kapitole 5a 48 h; sef zvolil 26 h, tedy prisneji. Zvednout limit
 *   smi jen clovek a jen s duvodem, protoze tim se hlidka oslepuje.
 *
 * ⛔ CTE SE RPC `cisla_pro_web()`, NE TABULKA `app_config`. Ta ma RLS bez policy
 *    a lezi v ni `cisla_sync_secret`; anonymni GET na ni vraci HTTP 200 a prazdne
 *    pole a policy pro anon se tam pridavat NESMI. Detail: scripts/cisla-zdroj.mjs.
 *    Service-role klic v prostredi je uz jen zaloha, kdyby RPC vypadla.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mapaZRadku, nactiCisla, parseCislo } from "./cisla-zdroj.mjs";

export const LIMIT_HODIN_VYCHOZI = 26;

/** Klice, bez kterych automatika nefunguje. `*_raw` jsou vstup sanity brany, ne text. */
const POVINNE = ["pocet_potravin", "pocet_receptu", "pocet_cisel_mereno_v"];

/**
 * Vyhodnoceni bez site, aby se dalo testovat.
 * Vraci { ok, chyby: [], varovani: [], stariH, merenoV, hodnoty }.
 *
 * Chyba (exit 1) je jen to, co znamena "automatika stoji" nebo "hodnota chybi".
 * Podezrele, ale funkcni stavy jsou varovani, aby hlidka neshodila deploy kvuli
 * necemu, co se samo srovna pri pristim behu cronu.
 */
export function vyhodnot(mapa, { ted = new Date(), limitHodin = LIMIT_HODIN_VYCHOZI } = {}) {
  const chyby = [];
  const varovani = [];

  for (const k of POVINNE) {
    const v = (mapa?.[k] ?? "").trim();
    if (!v) {
      chyby.push(
        "V app_config chybi klic `" + k + "`. Bez nej drip-send saha po natvrdo " +
          "zapsanem fallbacku a `cisla-sync` zjevne nikdy neprosel.",
      );
    }
  }

  const merenoVText = (mapa?.pocet_cisel_mereno_v ?? "").trim();
  let stariH = null;
  if (merenoVText) {
    const t = Date.parse(merenoVText);
    if (!Number.isFinite(t)) {
      chyby.push(
        "`pocet_cisel_mereno_v` neni datum: \"" + merenoVText + "\". " +
          "Hlidka nedokaze rict, jak jsou cisla stara, takze to bere jako poruchu.",
      );
    } else {
      stariH = (ted.getTime() - t) / 3600000;
      if (stariH < -1) {
        chyby.push(
          "`pocet_cisel_mereno_v` je v BUDOUCNOSTI (" + merenoVText + "). " +
            "Bud je rozhozeny cas, nebo tam nekdo zapsal hodnotu rucne.",
        );
      } else if (stariH > limitHodin) {
        chyby.push(
          "CISLA JSOU STARA " + stariH.toFixed(1) + " h (limit " + limitHodin + " h). " +
            "Mereno " + merenoVText + ".\n" +
            "  Znamena to, ze `cisla-sync` neprosel nejmene dvakrat po sobe.\n" +
            "  Kde hledat: cron `cisla-sync-6h` v Academy DB, edge funkce `cisla-sync`\n" +
            "  (vraci duvod v tele odpovedi), RPC `verejna_cisla()` v DB appky.\n" +
            "  Maily a web zatim jedou dal se starou, porad pravdivou hodnotou.",
        );
      }
    }
  }

  // Sanity hodnot je jen varovani: kdyby byla chybou, hlidka stari by padala
  // z jineho duvodu, nez ktery ma hlidat, a nikdo by pak nevedel, co je spatne.
  const potraviny = parseCislo(mapa?.pocet_potravin ?? "");
  if (Number.isFinite(potraviny) && potraviny < 10000) {
    varovani.push("`pocet_potravin` = " + potraviny + ", cekal bych aspon 10 000.");
  }
  if ((mapa?.pocet_potravin ?? "").includes(",")) {
    varovani.push(
      "`pocet_potravin` ma jako oddelovac tisicu CARKU (\"" + mapa.pocet_potravin +
        "\"). Do ceskeho textu patri mezera; podezreni na locale serveru u to_char.",
    );
  }
  const recepty = parseCislo(mapa?.pocet_receptu ?? "");
  if (Number.isFinite(recepty) && recepty < 50) {
    varovani.push("`pocet_receptu` = " + recepty + ", cekal bych aspon 50.");
  }

  return {
    ok: chyby.length === 0,
    chyby,
    varovani,
    stariH,
    merenoV: merenoVText || null,
    hodnoty: {
      pocet_potravin: mapa?.pocet_potravin ?? null,
      pocet_receptu: mapa?.pocet_receptu ?? null,
      pocet_potravin_raw: mapa?.pocet_potravin_raw ?? null,
    },
  };
}

export function parsujArgumenty(argv) {
  const out = { json: null, limitHodin: LIMIT_HODIN_VYCHOZI };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = argv[++i] ?? null;
    else if (a === "--limit-hodin") out.limitHodin = Number(argv[++i]);
    else if (a === "--help" || a === "-h") out.help = true;
    else throw new Error("neznamy argument: " + a);
  }
  if (out.json === null && argv.includes("--json")) throw new Error("--json chce cestu k souboru");
  if (!Number.isFinite(out.limitHodin) || out.limitHodin <= 0) {
    throw new Error("--limit-hodin chce kladne cislo");
  }
  return out;
}

async function main(argv) {
  let arg;
  try {
    arg = parsujArgumenty(argv);
  } catch (e) {
    console.error(String(e.message ?? e));
    process.exit(2);
  }
  if (arg.help) {
    console.log(
      "Pouziti: node scripts/kontrola-cisla-stari.mjs [--limit-hodin 26] [--json vzorek.json]",
    );
    process.exit(0);
  }

  let mapa;
  if (arg.json) {
    const abs = path.resolve(arg.json);
    if (!fs.existsSync(abs)) {
      console.error("Soubor neexistuje: " + abs);
      process.exit(2);
    }
    const raw = JSON.parse(fs.readFileSync(abs, "utf8"));
    mapa = Array.isArray(raw) ? mapaZRadku(raw) : raw;
  } else {
    // ⚠️ Po sitovem fetch() se NESMI volat process.exit() natvrdo: na Windows/Node
    // to umi spadnout na "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)"
    // (fetch/undici jeste zavira socket), a to i PO uspesnem vypisu "OK". Misto
    // toho se nastavi process.exitCode a funkce se vrati, Node ukonci sam.
    try {
      mapa = await nactiCisla();
    } catch (e) {
      console.error("Cteni verejnych cisel selhalo: " + String(e.message ?? e));
      process.exitCode = 1;
      return;
    }
  }

  const v = vyhodnot(mapa, { limitHodin: arg.limitHodin });
  console.log("pocet_potravin: " + (v.hodnoty.pocet_potravin ?? "(chybi)"));
  console.log("pocet_receptu:  " + (v.hodnoty.pocet_receptu ?? "(chybi)"));
  console.log(
    "mereno_v:       " + (v.merenoV ?? "(chybi)") +
      (v.stariH == null ? "" : "  (stari " + v.stariH.toFixed(1) + " h, limit " +
        arg.limitHodin + " h)"),
  );
  for (const w of v.varovani) console.log("VAROVANI: " + w);
  if (v.ok) {
    console.log("OK: cisla jsou cerstva.");
    process.exitCode = 0;
    return;
  }
  for (const c of v.chyby) console.error("CHYBA: " + c);
  process.exitCode = 1;
}

const jeHlavni = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (jeHlavni) await main(process.argv);
