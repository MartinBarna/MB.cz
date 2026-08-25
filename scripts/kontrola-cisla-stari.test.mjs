// Test hlidky stari verejnych cisel.
// Spusteni:  node --test scripts/kontrola-cisla-stari.test.mjs
//
// Vsechno bezi bez site: `vyhodnot()` je schvalne cista funkce nad mapou z
// app_config, aby se dal otestovat i stav "automatika stoji", ktery se v zive
// DB vyrobit neda.
import test from "node:test";
import assert from "node:assert/strict";
import {
  LIMIT_HODIN_VYCHOZI,
  parsujArgumenty,
  vyhodnot,
} from "./kontrola-cisla-stari.mjs";

const TED = new Date("2026-08-25T12:00:00Z");

function mapa(zmeny = {}) {
  return {
    pocet_potravin: "50 000",
    pocet_receptu: "148",
    pocet_cisel_mereno_v: "2026-08-25T10:41:19.002+00:00",
    pocet_potravin_raw: "59024",
    ...zmeny,
  };
}

test("cerstva cisla projdou", () => {
  const v = vyhodnot(mapa(), { ted: TED });
  assert.equal(v.ok, true);
  assert.deepEqual(v.chyby, []);
  assert.deepEqual(v.varovani, []);
  assert.ok(v.stariH < 2);
});

test("zdrave zpozdeni 12 h jeste neni chyba", () => {
  // 6 h cache RPC v appce + 6 h mezi behy cronu je normalni nejhorsi pripad.
  const v = vyhodnot(mapa({ pocet_cisel_mereno_v: "2026-08-25T00:00:00Z" }), { ted: TED });
  assert.equal(v.ok, true);
});

test("stari nad limit je chyba a hlaska rekne kde hledat", () => {
  const v = vyhodnot(mapa({ pocet_cisel_mereno_v: "2026-08-24T05:00:00Z" }), { ted: TED });
  assert.equal(v.ok, false);
  assert.equal(v.chyby.length, 1);
  assert.match(v.chyby[0], /CISLA JSOU STARA 31\.0 h/);
  assert.match(v.chyby[0], /cisla-sync/);
});

test("vlastni limit se respektuje", () => {
  const m = mapa({ pocet_cisel_mereno_v: "2026-08-24T23:00:00Z" }); // 13 h
  assert.equal(vyhodnot(m, { ted: TED }).ok, true);
  assert.equal(vyhodnot(m, { ted: TED, limitHodin: 12 }).ok, false);
});

test("chybejici klic je chyba, ne ticho", () => {
  const m = mapa();
  delete m.pocet_receptu;
  const v = vyhodnot(m, { ted: TED });
  assert.equal(v.ok, false);
  assert.match(v.chyby.join(" "), /pocet_receptu/);
  assert.match(v.chyby.join(" "), /fallback/);
});

test("prazdna app_config = tri chyby, ne jedna", () => {
  const v = vyhodnot({}, { ted: TED });
  assert.equal(v.ok, false);
  assert.equal(v.chyby.length, 3);
});

test("nectitelne datum je porucha, ne nula", () => {
  const v = vyhodnot(mapa({ pocet_cisel_mereno_v: "vcera odpoledne" }), { ted: TED });
  assert.equal(v.ok, false);
  assert.match(v.chyby[0], /neni datum/);
  assert.equal(v.stariH, null);
});

test("datum v budoucnosti je chyba, ne 'super cerstve'", () => {
  const v = vyhodnot(mapa({ pocet_cisel_mereno_v: "2026-09-01T00:00:00Z" }), { ted: TED });
  assert.equal(v.ok, false);
  assert.match(v.chyby[0], /BUDOUCNOSTI/);
});

test("carka jako oddelovac tisicu je varovani, ne pad", () => {
  // Postgres to_char bere oddelovac z locale; kdyby prosla carka, do ceskeho
  // textu by se dostalo "50,000". Hlidka stari kvuli tomu ale padat nema.
  const v = vyhodnot(mapa({ pocet_potravin: "50,000" }), { ted: TED });
  assert.equal(v.ok, true);
  assert.match(v.varovani.join(" "), /CARKU/);
});

test("nesmyslne male hodnoty jsou varovani", () => {
  const v = vyhodnot(mapa({ pocet_potravin: "900", pocet_receptu: "3" }), { ted: TED });
  assert.equal(v.ok, true);
  assert.equal(v.varovani.length, 2);
});

test("vychozi limit je 26 h", () => {
  assert.equal(LIMIT_HODIN_VYCHOZI, 26);
  assert.equal(parsujArgumenty(["node", "x"]).limitHodin, 26);
});

test("parsujArgumenty odmitne nesmysly", () => {
  assert.equal(parsujArgumenty(["node", "x", "--limit-hodin", "12"]).limitHodin, 12);
  assert.equal(parsujArgumenty(["node", "x", "--json", "a.json"]).json, "a.json");
  assert.throws(() => parsujArgumenty(["node", "x", "--limit-hodin", "0"]));
  assert.throws(() => parsujArgumenty(["node", "x", "--limit-dni", "2"]));
});
