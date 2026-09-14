// Testy parsování seznamu e-mailů z app_config. Spuštění:
//   npx --yes deno@2 test akademie/_supabase/functions/_shared/mail-seznam.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { emailySeznam } from "./mail-seznam.ts";

const pole = (v: unknown) => [...emailySeznam(v)].sort();

Deno.test("prostý seznam oddělený čárkou", () => {
  assertEquals(pole("a@x.cz, b@y.cz"), ["a@x.cz", "b@y.cz"]);
});

Deno.test("uvozovky rovné i české (to hlásil revizor)", () => {
  assertEquals(pole('"hana.nagy@seznam.cz"'), ["hana.nagy@seznam.cz"]);
  assertEquals(pole("„hana.nagy@seznam.cz“"), ["hana.nagy@seznam.cz"]);
  assertEquals(pole("'a@x.cz', \"b@y.cz\""), ["a@x.cz", "b@y.cz"]);
});

Deno.test("tvar Jméno Příjmení <adresa>", () => {
  assertEquals(pole("Hana Nagy <hana.nagy@seznam.cz>"), ["hana.nagy@seznam.cz"]);
  assertEquals(pole("Hana Nagy <a@x.cz>; Petr Novák <b@y.cz>"), ["a@x.cz", "b@y.cz"]);
});

Deno.test("velká písmena, mezery navíc, nové řádky, středníky", () => {
  assertEquals(pole("  A@X.CZ ;\n\t b@Y.cz  \n"), ["a@x.cz", "b@y.cz"]);
});

Deno.test("koncová tečka a čárka se do adresy nepočítají", () => {
  assertEquals(pole("a@x.cz., b@y.cz,"), ["a@x.cz", "b@y.cz"]);
});

Deno.test("prázdno a nesmysly = prázdná množina, ne pád", () => {
  assertEquals(pole(""), []);
  assertEquals(pole(null), []);
  assertEquals(pole(undefined), []);
  assertEquals(pole("   ,  ; "), []);
  assertEquals(pole("tohle není adresa"), []);
  assertEquals(pole("zavináč chybí: x.cz"), []);
  assertEquals(pole("a@bezdomeny"), []); // doména bez tečky není adresa
});

Deno.test("duplicita v seznamu se objeví jednou", () => {
  assertEquals(pole("a@x.cz, A@X.cz, \"a@x.cz\""), ["a@x.cz"]);
});

Deno.test("⛔ adresa napsaná JINAK se neshodne a nemá: text se normalizuje, neuhaduje", () => {
  // Diakritika v adrese je jiná adresa, ne překlep k opravě.
  assertEquals(pole("hána.nagy@seznam.cz"), ["hána.nagy@seznam.cz"]);
});
