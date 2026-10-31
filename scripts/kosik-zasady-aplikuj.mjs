// Vlozi 4b a polozku SES do zasad. Samo od sebe nic nezapise.
// Bez --az-pri-zapnuti-kosik-web konci kodem 2.
// Kdyz je data-kosik-zapnuto stale false, konci kodem 3 a soubor zasad necha byt.
// Flag kosiku tenhle skript nemeni. Deploy ho nevola.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

if (!args.includes("--az-pri-zapnuti-kosik-web")) {
  console.error("Odmitnuto. 4b a cl. 3 se zapisi jen s --az-pri-zapnuti-kosik-web, ve stejnem kroku jako zapnuti kosiku.");
  process.exit(2);
}

const stranky = ["konzultace/index.html", "koucing/index.html"];
const zapnuto = stranky.some((p) => readFileSync(join(root, p), "utf8").includes('data-kosik-zapnuto="true"'));
if (!zapnuto) {
  console.error("Odmitnuto. data-kosik-zapnuto je stale false. Nejdřív ho v tom samem diffu zapni. Skript flag nemeni a na vypnuty kosik 4b nezapise.");
  process.exit(3);
}

function blok(md, jmeno) {
  const re = new RegExp(`<!-- BLOK:${jmeno} -->\\n([\\s\\S]*?)\\n<!-- /BLOK:${jmeno} -->`);
  const m = md.match(re);
  if (!m) throw new Error("chybi blok " + jmeno);
  return m[1];
}

const md = readFileSync(join(root, "docs/kosik/zasady-4b-a-cl3.md"), "utf8");
const cl3 = blok(md, "cl3");
const sekce = blok(md, "4b");
const cil = join(root, "zasady-ochrany-osobnich-udaju/index.html");
let html = readFileSync(cil, "utf8");
if (html.includes("4b. Připomínka nedokončené objednávky") && html.includes("Amazon Web Services EMEA SARL")) {
  console.log("Uz je vlozene, nic nemenim.");
  process.exit(0);
}

const resend = "<li><b>Resend</b> (Plus Five Five, Inc.): odesílání transakčních a informačních e-mailů (potvrzení objednávky, doručení digitálního obsahu, upozornění).</li>";
if (!html.includes(resend)) {
  console.error("Nenasel jsem polozku Resend, stranka se nezmenila.");
  process.exit(4);
}
const h5 = "    <h2>5. Doba uchování</h2>";
if (!html.includes(h5) || html.split(h5).length !== 2) {
  console.error("Nadpis 5 neni jednoznacny, stranka se nezmenila.");
  process.exit(4);
}

html = html.replace(resend, resend + "\n" + cl3);
html = html.replace(h5, sekce + "\n\n" + h5);
writeFileSync(cil, html);
console.log("Vlozeno. Commitni to ve stejnem deployi jako data-kosik-zapnuto=true. Samo od sebe se to nenasadi.");
