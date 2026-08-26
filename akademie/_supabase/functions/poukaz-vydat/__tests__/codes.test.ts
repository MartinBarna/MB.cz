// Spustit: deno test --allow-none supabase/functions/poukaz-vydat/__tests__/codes.test.ts
import { assert, assertMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { CODE_ALPHABET, generateVoucherCode, isValidVoucherCode } from '../lib/codes.ts';

Deno.test('kód má formát MB-ROK-XXXX', () => {
  const code = generateVoucherCode(2026);
  assertMatch(code, /^MB-2026-[A-Z0-9]{4}$/);
  assert(isValidVoucherCode(code));
});

Deno.test('abeceda neobsahuje I, L, O, 0, 1', () => {
  for (const forbidden of ['I', 'L', 'O', '0', '1']) {
    assert(!CODE_ALPHABET.includes(forbidden), `abeceda obsahuje zakázaný znak ${forbidden}`);
  }
  assert(CODE_ALPHABET.length === 31, `abeceda má mít 31 znaků, má ${CODE_ALPHABET.length}`);
});

// ⛔ ZJIŠTĚNÍ PŘI STAVBĚ (25. 8. 2026): "1000 kódů bez kolize" NENÍ matematicky
// zaručitelné a nemělo by se to tak testovat. Prostor je jen 31^4 = 923 521
// kombinací (schválně malý, viz README generátoru, kód se nedomýšlí). Podle
// narozeninového paradoxu má 1000 náhodných tahů z 923 521 možností šanci přes
// 40 % na aspoň jednu kolizi (očekávaný počet kolizí je přibližně 1000 na
// druhou lomeno 2×923521, tedy asi 0,54). První běh týhle sady testů opravdu
// jednu kolizi reálně narazil (MB-2026-H3Y6). To NENÍ vada generátoru, je to
// čistá matematika malého prostoru. Skutečnou jistotu proti duplicitě dává až
// DB UNIQUE(code) a retry smyčka v core.ts (otestováno v core.test.ts: "kolize
// kódu: retry" a "vyčerpá všech 5 pokusů"). Tenhle test proto hlídá jen to,
// že kolizí není řádově víc, než matematika čeká (např. vadný RNG, co vrací
// jen podmnožinu hodnot).
Deno.test('1000 kódů: všechny validní formát; míra kolizí odpovídá matematice malého prostoru (31^4)', () => {
  const N = 1000;
  const space = Math.pow(CODE_ALPHABET.length, 4);
  const counts = new Map<string, number>();
  for (let i = 0; i < N; i++) {
    const code = generateVoucherCode(2026);
    assert(isValidVoucherCode(code), `neplatný formát: ${code}`);
    const suffix = code.slice(-4);
    counts.set(suffix, (counts.get(suffix) ?? 0) + 1);
  }
  let duplicates = 0;
  for (const count of counts.values()) if (count > 1) duplicates += count - 1;
  const expected = (N * N) / (2 * space); // narozeninová aproximace, cca 0.54
  const generousBound = expected * 8 + 5; // hodně tolerantní, ať test nekmitá
  assert(
    duplicates <= generousBound,
    `podezřele moc kolizí: ${duplicates} (matematicky čekáno ~${expected.toFixed(2)}), může značit vadný RNG`,
  );
});

Deno.test('isValidVoucherCode odmítne zakázané znaky a špatný tvar', () => {
  assert(!isValidVoucherCode('MB-2026-I0L1'));
  assert(!isValidVoucherCode('MB-26-ABCD'));
  assert(!isValidVoucherCode('XX-2026-ABCD'));
  assert(!isValidVoucherCode('MB-2026-ABC'));
});
