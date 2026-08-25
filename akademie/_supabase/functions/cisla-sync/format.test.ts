// Test formatovani verejnych cisel (to_char + replace carky mezerou).
// Spusteni: npx --yes deno@2 test --node-modules-dir=none akademie/_supabase/functions/cisla-sync/format.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import {
  formatPotravinyZobrazit,
  nahradOddelovacToChar,
  overSanitu,
  parseVerejneCislo,
  simulujToCharFm999G999,
  zaokrouhliPotraviny,
} from "./format.ts";

Deno.test("to_char FM999G999 v en-US da carku, ne mezeru", () => {
  const surovy = simulujToCharFm999G999(50000);
  assertEquals(surovy, "50,000");
});

Deno.test("replace carky mezerou da 50 000, ne 50,000", () => {
  const poReplace = nahradOddelovacToChar(simulujToCharFm999G999(50000));
  assertEquals(poReplace, "50 000");
  if (poReplace.includes(",")) throw new Error("vystup nesmi obsahovat carku");
});

Deno.test("kdyz to_char uz da mezeru, replace ji necha byt", () => {
  assertEquals(nahradOddelovacToChar("50 000"), "50 000");
});

Deno.test("NBSP z locale se nahradi obycejnou mezerou", () => {
  assertEquals(nahradOddelovacToChar("50\u00a0000"), "50 000");
});

Deno.test("59024 zaokrouhli dolu na 50 000, ne na 60 000", () => {
  assertEquals(zaokrouhliPotraviny(59024), 50000);
  assertEquals(formatPotravinyZobrazit(59024), "50 000");
});

Deno.test("59999 stale 50 000; 60000 uz 60 000", () => {
  assertEquals(formatPotravinyZobrazit(59999), "50 000");
  assertEquals(formatPotravinyZobrazit(60000), "60 000");
});

Deno.test("parseVerejneCislo sune mezeru i carku", () => {
  assertEquals(parseVerejneCislo("50 000"), 50000);
  assertEquals(parseVerejneCislo("50,000"), 50000);
});

Deno.test("sanity pusti platna cisla z 25. 8. 2026", () => {
  const r = overSanitu({
    potraviny_raw: 59024,
    recepty_raw: 148,
    potraviny_zobrazit: "50 000",
    mereno_v: "2026-08-25T00:00:00Z",
  }, 50000);
  assertEquals(r.ok, true);
  if (r.ok) {
    assertEquals(r.potraviny_zobrazit, "50 000");
    assertEquals(r.recepty_zobrazit, "148");
  }
});

Deno.test("sanity pusti i kdyz RPC vrati to_char s carkou", () => {
  const r = overSanitu({
    potraviny_raw: 59024,
    recepty_raw: 148,
    potraviny_zobrazit: "50,000",
  }, null);
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.potraviny_zobrazit, "50 000");
});

Deno.test("cizi locale v potraviny_zobrazit branu nezasekne", () => {
  // Server s tecko-oddelovacem vrati "50.000". Drive to branu shodilo natrvalo;
  // rozhoduje potraviny_raw a zobrazovany tvar si spocitame sami.
  const r = overSanitu({
    potraviny_raw: 59024,
    recepty_raw: 148,
    potraviny_zobrazit: "50.000",
  }, 59000);
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.potraviny_zobrazit, "50 000");
});

Deno.test("sanity odmítne skokovy pokles o vic nez 20 %", () => {
  const r = overSanitu({
    potraviny_raw: 30000,
    recepty_raw: 148,
    potraviny_zobrazit: "30 000",
  }, 50000);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.duvod, "potraviny_raw_kleslo_o_vic_nez_20pct");
});

Deno.test("brana meri RAW proti RAW, ne proti zaokrouhlenemu", () => {
  // Skutecny propad 59 024 -> 45 000 (o 24 %). Proti ulozenemu ZOBRAZENEMU
  // "50 000" by prosel (45 000 > 40 000); proti ulozenemu RAW 59 024 neprojde.
  const rpc = { potraviny_raw: 45000, recepty_raw: 148, potraviny_zobrazit: "40 000" };
  assertEquals(overSanitu(rpc, 50000).ok, true);
  const r = overSanitu(rpc, 59024);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.duvod, "potraviny_raw_kleslo_o_vic_nez_20pct");
});

Deno.test("sanity odmítne skokovy rust o vic nez 50 %", () => {
  const r = overSanitu({
    potraviny_raw: 120000,
    recepty_raw: 148,
    potraviny_zobrazit: "120 000",
  }, 59024);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.duvod, "potraviny_raw_vyskocilo_o_vic_nez_50pct");
});

Deno.test("prvni beh bez ulozeneho raw projde i pri velkem cisle", () => {
  const r = overSanitu({
    potraviny_raw: 120000,
    recepty_raw: 148,
    potraviny_zobrazit: "120 000",
  }, null);
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.potraviny_raw, 120000);
});

Deno.test("bezny rust pod stropem projde", () => {
  const r = overSanitu({
    potraviny_raw: 62000,
    recepty_raw: 148,
    potraviny_zobrazit: "60 000",
  }, 59024);
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.potraviny_zobrazit, "60 000");
});

Deno.test("sanity odmítne potraviny_raw pod 10 000", () => {
  const r = overSanitu({
    potraviny_raw: 9999,
    recepty_raw: 148,
    potraviny_zobrazit: "0",
  }, null);
  assertEquals(r.ok, false);
});
