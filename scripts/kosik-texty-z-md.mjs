#!/usr/bin/env node
// Generator textu opusteneho kosiku. Bez zavislosti.
// Vstup: akademie/_email/kosik-final-v2.md (bajtova kopie FINALu v2).
// Vystup: akademie/_supabase/functions/_shared/kosik-texty.json
//
// Povolene transformace jsou jen ty z PLAN sekce 5.2. Jinak se text nemeni.
// Spusteni: node scripts/kosik-texty-z-md.mjs
//           node scripts/kosik-texty-z-md.mjs --check   (exit 1, kdyz JSON nesedi)

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KOREN = join(dirname(fileURLToPath(import.meta.url)), "..");
const ZDROJ = join(KOREN, "akademie/_email/kosik-final-v2.md");
const VYSTUP = join(KOREN, "akademie/_supabase/functions/_shared/kosik-texty.json");

const GARANCE =
  "Když z hovoru neodejdeš se spočítanými kaloriemi, bílkovinami a prvními kroky na týden, vrátím ti celou částku.";

const MAPA = [
  { prefix: "K1:", klic: "kosik-konzultace", krok: 0, oznaceni: "K1", app: false },
  { prefix: "K2:", klic: "kosik-konzultace", krok: 1, oznaceni: "K2", app: false },
  { prefix: "KC1:", klic: "kosik-koucink", krok: 0, oznaceni: "KC1", app: false },
  { prefix: "KC2:", klic: "kosik-koucink", krok: 1, oznaceni: "KC2", app: false },
  { prefix: "D1:", klic: "kosik-videokurz", krok: 0, oznaceni: "D1", app: false },
  { prefix: "D2:", klic: "kosik-videokurz", krok: 1, oznaceni: "D2", app: false },
  { prefix: "D1 Academy", klic: "kosik-academy", krok: 0, oznaceni: "D1 Academy", app: false },
  { prefix: "D2 Academy", klic: "kosik-academy", krok: 1, oznaceni: "D2 Academy", app: false },
  { prefix: "A1:", klic: "kosik-appka", krok: 0, oznaceni: "A1", app: true },
  { prefix: "A2:", klic: "kosik-appka", krok: 1, oznaceni: "A2", app: true },
];

function patickaZeZdroje(md) {
  const radky = [];
  for (const line of md.split("\n")) {
    if (line.startsWith("> ")) radky.push(line.slice(2));
  }
  if (radky.length !== 2) {
    throw new Error("paticka: cekam presne 2 radky bloku >, mam " + radky.length);
  }
  return radky;
}

function patickaApp(radky) {
  const text = radky.join("\n");
  const kus = "na martinbarna.cz";
  const pocet = text.split(kus).length - 1;
  if (pocet !== 1) throw new Error("paticka app: cekam presne jeden vyskyt „" + kus + "“, mam " + pocet);
  return text.replace(kus, "v appce Tvůj Coach").split("\n");
}

function mapaNadpisu(nadpis) {
  const hit = MAPA.find((m) => nadpis.startsWith(m.prefix));
  if (!hit) throw new Error("neznamy nadpis mailu: " + nadpis);
  return hit;
}

function blokyZTela(telo) {
  const odstavce = telo.split(/\n\n+/).map((p) => p.replace(/^\n+|\n+$/g, "")).filter((p) => p.length > 0);
  const bloky = [];
  for (const p of odstavce) {
    if (p.startsWith("Poznámka k ")) continue;
    if (p === "Be Effective!\nMartin Barna") {
      bloky.push({ t: "podpis", radky: ["Be Effective!", "Martin Barna"] });
      continue;
    }
    const btn = p.match(/^\[([^\]]+)\] → (\S+)$/);
    if (btn) {
      bloky.push({ t: "btn", text: btn[1], href: btn[2] });
      continue;
    }
    const blok = { t: "p", text: p };
    if (p === GARANCE) blok.flag = "kosik_garance_k1";
    bloky.push(blok);
  }
  return bloky;
}

export function sestav(md) {
  const patickaWeb = patickaZeZdroje(md);
  const patickaA = patickaApp(patickaWeb);
  const casti = md.split(/\n(?=### )/).slice(1);
  if (casti.length !== 10) throw new Error("cekam 10 mailu, mam " + casti.length);
  const maily = casti.map((cast) => {
    const lines = cast.replace(/\n$/, "").split("\n");
    const nadpis = lines[0].replace(/^### /, "");
    const meta = mapaNadpisu(nadpis);
    let predmet = "";
    let preheader = "";
    const telo = [];
    for (const line of lines.slice(1)) {
      const pm = line.match(/^\*\*Předmět:\*\* (.*)$/);
      const ph = line.match(/^\*\*Preheader:\*\* (.*)$/);
      if (pm) {
        predmet = pm[1];
        continue;
      }
      if (ph) {
        preheader = ph[1];
        continue;
      }
      telo.push(line);
    }
    if (!predmet || !preheader) throw new Error("chybi predmet nebo preheader u " + nadpis);
    const bloky = blokyZTela(telo.join("\n").replace(/^\n+/, "").replace(/\n+$/, ""));
    return {
      klic: meta.klic,
      krok: meta.krok,
      oznaceni: meta.oznaceni,
      predmet,
      preheader,
      bloky,
      paticka: meta.app ? patickaA : patickaWeb,
    };
  });
  const k1 = maily.find((m) => m.oznaceni === "K1");
  const maGaranci = k1 && k1.bloky.some((b) => b.flag === "kosik_garance_k1");
  if (!maGaranci) throw new Error("K1: veta o garanci se nenasla, generator pada");
  return {
    zdroj: "akademie/_email/kosik-final-v2.md",
    paticka_web: patickaWeb,
    paticka_app: patickaA,
    maily,
  };
}

function main() {
  const md = readFileSync(ZDROJ, "utf8");
  const data = sestav(md);
  const json = JSON.stringify(data, null, 2) + "\n";
  if (process.argv.includes("--check")) {
    const ma = readFileSync(VYSTUP, "utf8");
    if (ma !== json) {
      console.error("kosik-texty.json nesedi se zdrojem, spust node scripts/kosik-texty-z-md.mjs");
      process.exit(1);
    }
    console.log("kosik-texty.json sedi, mailu " + data.maily.length);
    return;
  }
  if (process.argv.includes("--stdout")) {
    process.stdout.write(json);
    return;
  }
  writeFileSync(VYSTUP, json);
  console.log("zapsano " + VYSTUP + " (" + data.maily.length + " mailu)");
}

if (process.argv[1] && process.argv[1].endsWith("kosik-texty-z-md.mjs")) main();
