// Test prepisovace cisel do statickeho HTML.
// Spusteni:  node --test scripts/sync-cisla-web.test.mjs
//
// Bez site a bez zapisu do repa: `hodnotyProZnacky()` i `prepisZnacky()` jsou
// ciste funkce, `najdiHtml()` se pousti nad docasnou slozkou.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  hodnotyProZnacky,
  najdiHtml,
  pocetVExportu,
  prepisLlms,
  prepisZnacky,
} from "./sync-cisla-web.mjs";

const APP_CONFIG = {
  pocet_potravin: "50 000",
  pocet_receptu: "148",
  pocet_potravin_raw: "59024",
  pocet_receptu_raw: "148",
};

test("hodnoty: potraviny se berou zaokrouhlene, recepty se srazi na desitky", () => {
  const h = hodnotyProZnacky(APP_CONFIG, 43130);
  assert.equal(h.potraviny, "50 000");
  // 148 -> 140: staticke HTML se prepisuje tydne, presne cislo by po odverejneni
  // jednoho receptu tyden slibovalo vic, nez kolik jich je.
  assert.equal(h.recepty, "140");
  assert.equal(h.academy, "40 000");
});

test("academy cislo je z EXPORTU, ne z DB", () => {
  // Nejdulezitejsi past cele automatiky: nastroj Academy cte staticky soubor.
  const h = hodnotyProZnacky(APP_CONFIG, 43130);
  assert.notEqual(h.academy, h.potraviny);
  assert.equal(h.academy, "40 000");
});

test("bez exportu se znacka academy vubec nenabizi", () => {
  const h = hodnotyProZnacky(APP_CONFIG, null);
  assert.equal("academy" in h, false);
});

test("nezaokrouhlena hodnota v app_config se odmitne", () => {
  assert.throws(
    () => hodnotyProZnacky({ ...APP_CONFIG, pocet_potravin: "59 024" }),
    /NENI zaokrouhleny dolu/,
  );
});

test("rozpor mezi pocet_potravin a _raw se odmitne", () => {
  assert.throws(
    () => hodnotyProZnacky({ ...APP_CONFIG, pocet_potravin_raw: "31000" }),
    /nesedi na pocet_potravin_raw/,
  );
});

test("chybejici nebo nesmyslna hodnota se odmitne", () => {
  assert.throws(() => hodnotyProZnacky({ pocet_receptu: "148" }), /pocet_potravin/);
  assert.throws(() => hodnotyProZnacky({ ...APP_CONFIG, pocet_receptu: "3" }), /pocet_receptu/);
  assert.throws(() => hodnotyProZnacky(APP_CONFIG, 900), /polozek/);
});

const H = { potraviny: "60 000", recepty: "140", academy: "40 000" };

test("prepis mysli jen obsah znacky, veta zustane", () => {
  const html = '<p>Databaze <!-- cislo:potraviny -->50 000<!-- /cislo --> potravin.</p>';
  const v = prepisZnacky(html, H);
  assert.deepEqual(v.chyby, []);
  assert.equal(v.zmeny.length, 1);
  assert.equal(
    v.text,
    '<p>Databaze <!-- cislo:potraviny -->60 000<!-- /cislo --> potravin.</p>',
  );
});

test("stejna hodnota = zadna zmena", () => {
  const html = '<p><!-- cislo:recepty -->140<!-- /cislo --> receptu</p>';
  const v = prepisZnacky(html, H);
  assert.deepEqual(v.zmeny, []);
  assert.equal(v.text, html);
});

test("vic znacek v jednom souboru vcetne ruznych typu", () => {
  const html = '<!-- cislo:potraviny -->50 000<!-- /cislo -->' +
    'x<!-- cislo:academy -->30 000<!-- /cislo -->' +
    'y<!-- cislo:potraviny -->50 000<!-- /cislo -->';
  const v = prepisZnacky(html, H);
  assert.deepEqual(v.chyby, []);
  assert.equal(v.zmeny.length, 3);
  assert.equal(v.text.includes("30 000"), false);
});

test("neznamy typ znacky = chyba a nic se neprepise", () => {
  const html = '<!-- cislo:cviky -->120<!-- /cislo -->' +
    '<!-- cislo:potraviny -->50 000<!-- /cislo -->';
  const v = prepisZnacky(html, H, "tvuj-coach/index.html");
  assert.equal(v.chyby.length, 1);
  assert.match(v.chyby[0], /neznamy typ znacky `cislo:cviky`/);
  assert.match(v.chyby[0], /tvuj-coach\/index\.html/);
  assert.equal(v.text, html, "pri chybe se nesmi prepsat ani sousedni spravna znacka");
  assert.deepEqual(v.zmeny, []);
});

test("text mezi znackami = chyba, ne prepis vety pryc", () => {
  // Presne tenhle pripad je duvod, proc se obsah kontroluje: kdyby to skript
  // prepsal, zmizelo by ze stranky slovo "pres" i "potravin".
  const html = '<!-- cislo:potraviny -->pres 50 000 potravin<!-- /cislo -->';
  const v = prepisZnacky(html, H);
  assert.equal(v.chyby.length, 1);
  assert.match(v.chyby[0], /neni hole cislo/);
  assert.equal(v.text, html);
});

test("neuzavrena znacka = chyba, soubor se nechava byt", () => {
  const html = '<!-- cislo:potraviny -->50 000<p>zapomenuty konec</p>';
  const v = prepisZnacky(html, H);
  assert.equal(v.chyby.length, 1);
  assert.match(v.chyby[0], /znacky nesedi/);
  assert.equal(v.text, html);
});

test("prebyvajici zaviraci znacka = chyba", () => {
  const html = '<!-- cislo:potraviny -->50 000<!-- /cislo --><!-- /cislo -->';
  const v = prepisZnacky(html, H);
  assert.equal(v.chyby.length, 1);
  assert.match(v.chyby[0], /znacky nesedi/);
});

test("mezery kolem znacky se toleruji", () => {
  const html = '<!--cislo:recepty-->148<!--/cislo-->';
  const v = prepisZnacky(html, H);
  assert.deepEqual(v.chyby, []);
  assert.equal(v.text, "<!-- cislo:recepty -->140<!-- /cislo -->");
});

/* ---------------------------------------------------------------- llms.txt */

const LLMS = [
  "# Martin Barna",
  "- **Databáze přes 50 000 potravin** včetně značkového zboží z českých obchodů.",
  "- **Knihovna přes 140 fit receptů** přímo v appce, s makry na porci.",
  "- databáze 120 cviků s fotkou a technikou.",
].join("\n");

test("llms.txt: prepise jen cislice, veta i tucne hvezdicky zustanou", () => {
  const v = prepisLlms(LLMS, H);
  assert.deepEqual(v.chyby, []);
  assert.equal(v.zmeny.length, 1); // recepty uz sedi (140), meni se jen potraviny
  assert.ok(v.text.includes("**Databáze přes 60 000 potravin** včetně"));
  assert.ok(v.text.includes("**Knihovna přes 140 fit receptů** přímo"));
});

test("llms.txt: cislo cviku se nesmi hnout", () => {
  // 120 cviku je kuratorsky seznam v repu appky, do teto automatiky nepatri.
  const v = prepisLlms(LLMS, H);
  assert.ok(v.text.includes("databáze 120 cviků"));
});

test("llms.txt: preformulovana veta = chyba a nic se neprepise", () => {
  const rozbite = LLMS.replace("Databáze přes 50 000 potravin", "Máme 50 000 potravin");
  const v = prepisLlms(rozbite, H);
  assert.equal(v.chyby.length, 1);
  assert.match(v.chyby[0], /sedi 0x/);
  assert.equal(v.text, rozbite);
  assert.deepEqual(v.zmeny, []);
});

test("llms.txt: dva vyskyty stejneho vzoru = chyba, ne prepis jednoho z nich", () => {
  const v = prepisLlms(LLMS + "\n- **Databáze přes 50 000 potravin** podruhe.", H);
  assert.equal(v.chyby.length, 1);
  assert.match(v.chyby[0], /sedi 2x/);
  assert.deepEqual(v.zmeny, []);
});

test("llms.txt: stejna hodnota = zadna zmena", () => {
  const v = prepisLlms(LLMS, { potraviny: "50 000", recepty: "140" });
  assert.deepEqual(v.chyby, []);
  assert.deepEqual(v.zmeny, []);
  assert.equal(v.text, LLMS);
});

test("llms.txt: nedelitelna mezera v cisle se pozna a prepise", () => {
  const nbsp = LLMS.replace("50 000", "50\u00a0000");
  const v = prepisLlms(nbsp, H);
  assert.deepEqual(v.chyby, []);
  assert.equal(v.zmeny[0].nova, "60 000");
  assert.ok(v.text.includes("Databáze přes 60 000 potravin"));
});

test("pocetVExportu zvlada oba tvary exportu", () => {
  assert.equal(pocetVExportu([{ name: "a" }, { name: "b" }]), 2);
  assert.equal(pocetVExportu({ cols: ["name"], rows: [["a"], ["b"], ["c"]] }), 3);
  assert.throws(() => pocetVExportu({ items: [] }), /cekam pole/);
});

test("najdiHtml preskoci zalohy a nabere podslozky", () => {
  const koren = fs.mkdtempSync(path.join(os.tmpdir(), "cisla-web-"));
  try {
    fs.writeFileSync(path.join(koren, "index.html"), "x");
    fs.mkdirSync(path.join(koren, "tvuj-coach"));
    fs.writeFileSync(path.join(koren, "tvuj-coach", "index.html"), "x");
    fs.mkdirSync(path.join(koren, "_zaloha"));
    fs.writeFileSync(path.join(koren, "_zaloha", "stara.html"), "x");
    fs.writeFileSync(path.join(koren, "poznamka.md"), "x");
    const nalezene = najdiHtml(koren).map((p) => p.split(path.sep).join("/"));
    assert.deepEqual(nalezene, ["index.html", "tvuj-coach/index.html"]);
  } finally {
    fs.rmSync(koren, { recursive: true, force: true });
  }
});
