// Test parseru kontrola:mail-tokeny (cteni vestavenych klicu z drip-send).
// Spusteni: npx --yes deno@2 test --node-modules-dir=none --allow-read scripts/kontrola-mail-tokeny.test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  kliceObjektu,
  nactiSablony,
  vestaveneZDripSend,
  vytahniObjekt,
  zkontrolujSablony,
} from "./kontrola-mail-tokeny.mjs";

const DRIP = new URL("../akademie/_supabase/functions/drip-send/index.ts", import.meta.url);

Deno.test("parser najde CISLA klice v drip-send buildVars", async () => {
  const zdroj = await Deno.readTextFile(DRIP);
  const v = vestaveneZDripSend(zdroj);
  assert(v.has("unsubscribe_url"), "unsubscribe_url musi byt vestaveny");
  assert(v.has("pocet_potravin"), "pocet_potravin musi byt vestaveny pres ...cisla");
  assert(v.has("pocet_receptu"), "pocet_receptu musi byt vestaveny pres ...cisla");
  assert(!v.has("cisla"), "...cisla neni klic");
  assert(!v.has("castka"), "castka je invoke-only, ne vestavena");
  // Realny nalez: komentar u `...cisla` konci slovem "vestavenymi:" a bez
  // strhnuti komentaru z nej parser udelal klic. Fantomovy klic tise
  // whitelistne preklep v sablone, takze kontrola prestane chytat chyby.
  assert(!v.has("vestavenymi"), "slovo z komentare nesmi byt klic");
});

Deno.test("komentar nesmi vyrobit klic ani utnout blok", () => {
  const zdroj = `
    const vestavene: Record<string, string> = {
      first_name: fn,                 // ZAMERNE mezi vestavenymi: nepodvrhnutelne
      /* pozor: neuzavrena { zavorka v komentari utne cely blok */
      odkaz: 'https://example.com/a', // https:// ve stringu nesmi nic sezrat
      unsubscribe_url: unsub,
    };
  `;
  const blok = vytahniObjekt(zdroj, "vestavene");
  assert(blok, "neuzavrena zavorka v komentari nesmi shodit vytahniObjekt");
  const k = kliceObjektu(blok);
  assertEquals(k.includes("first_name"), true);
  assertEquals(k.includes("odkaz"), true);
  assertEquals(k.includes("unsubscribe_url"), true, "klic za komentarem se nesmi ztratit");
  assertEquals(k.includes("vestavenymi"), false, "slovo z // komentare neni klic");
  assertEquals(k.includes("pozor"), false, "slovo z /* */ komentare neni klic");
});

Deno.test("neznamy token v sablone = nalez s trat/krok/klic", async () => {
  const zdroj = await Deno.readTextFile(DRIP);
  const { nalezy } = zkontrolujSablony(zdroj, [{
    track: "tc-free",
    step: 0,
    key: "tcf-0-start",
    subject: "Ahoj{{fn_space}}",
    preheader: "pres {{pocet_potravin}} potravin",
    blocks: [{ t: "p", html: "preklep {{pocet_potravn}}" }],
  }]);
  assertEquals(nalezy.length, 1);
  assertEquals(nalezy[0].token, "pocet_potravn");
  assertEquals(nalezy[0].track, "tc-free");
});

Deno.test("whitelist invoke tokenu neni chyba", async () => {
  const zdroj = await Deno.readTextFile(DRIP);
  const { nalezy } = zkontrolujSablony(zdroj, [{
    track: "refund",
    step: 0,
    key: "x",
    subject: "Vracime {{castka}} za {{produkt}}",
    blocks: [],
  }]);
  assertEquals(nalezy.length, 0);
});

Deno.test("nactiSablony bere pole i obal", () => {
  assertEquals(nactiSablony([{ track: "a" }]).length, 1);
  assertEquals(nactiSablony({ templates: [{ track: "a" }, { track: "b" }] }).length, 2);
});

Deno.test("kliceObjektu preskoci spread i ternar", () => {
  const blok = `{ first_name: fn, fn_space: fn ? '' : '', ...cisla, unsubscribe_url: unsub }`;
  const k = kliceObjektu(blok);
  assertEquals(k.includes("first_name"), true);
  assertEquals(k.includes("fn_space"), true);
  assertEquals(k.includes("unsubscribe_url"), true);
  assertEquals(k.includes("cisla"), false);
  assertEquals(k.includes("fn"), false);
});
