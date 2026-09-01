// Regresní test na chybu, kterou odhalila vizuální kontrola vzorového PDF:
// wrapAndClamp u přetečeného textu NEPŘIDÁVAL „…" (truncateToWidth na už
// vyhovující řádek byl no-op). Testuje se přímo přes reálně embedovaný font,
// ne jen "funkce doběhla bez chyby", právě tenhle rozdíl bug odhalil pozdě.
// Spustit: deno test --allow-net supabase/functions/poukaz-vydat/__tests__/pdf-wrap.test.ts
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { PDFDocument, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';
import { truncateToWidth, wrapAndClamp } from '../lib/pdf.ts';

async function helvetica() {
  const doc = await PDFDocument.create();
  return doc.embedFont(StandardFonts.Helvetica);
}

Deno.test('truncateToWidth: krátký text se nemění', async () => {
  const font = await helvetica();
  const out = truncateToWidth(font, 'Short name', 22, 500);
  assertEquals(out, 'Short name');
});

Deno.test('truncateToWidth: dlouhý text dostane "…" a vejde se do šířky', async () => {
  const font = await helvetica();
  const long = 'This is a really quite long name that will not fit anywhere at all'.repeat(3);
  const maxWidth = 200;
  const out = truncateToWidth(font, long, 22, maxWidth);
  assert(out.endsWith('…'), `chybí ellipsis: "${out}"`);
  assert(font.widthOfTextAtSize(out, 22) <= maxWidth, 'ořezaný text pořád přesahuje šířku');
});

// Standardní WinAnsi font (Helvetica) neumí českou diakritiku, testy níž
// proto záměrně používají ASCII text. Testuje se algoritmus zalamování/ořezu,
// pokrytí diakritiky embedovaným Poppins fontem už ověřuje pdf.test.ts.
Deno.test('wrapAndClamp: text kratší než limit řádků se nezkracuje a NEMÁ "…"', async () => {
  const font = await helvetica();
  const lines = wrapAndClamp(font, 'Short sentence on one line.', 11, 500, 5);
  assertEquals(lines.length, 1);
  assert(!lines[0].endsWith('…'));
});

Deno.test('wrapAndClamp: text přesahující maxLines KONČÍ "…" na posledním řádku (regrese)', async () => {
  const font = await helvetica();
  const long = 'This text is deliberately much longer than would ever fit anywhere, it repeats itself '.repeat(10);
  const lines = wrapAndClamp(font, long, 11, 300, 4);
  assertEquals(lines.length, 4);
  const last = lines[3];
  assert(last.endsWith('…'), `poslední řádek nekončí ellipsis: "${last}"`);
  assert(font.widthOfTextAtSize(last, 11) <= 300, 'poslední řádek přesahuje šířku i s ellipsis');
});

Deno.test('wrapAndClamp: regrese s reálným textem/šířkou z pdf.ts (poslední řádek u hranice šířky)', async () => {
  // Přesně tenhle vstup (opakovaný český text, šířka blízká hranici) v prvním
  // pokusu o opravu ellipsis stále vynechal, poslední řádek se do maxWidth
  // vešel BEZ '…' a s '…' navíc přesáhl, takže fallback na truncateToWidth
  // byl no-op. Tenhle test hlídá přesně tenhle případ (viz forceEllipsis).
  const font = await helvetica();
  const long =
    'This text is deliberately much longer than would ever realistically appear on a voucher, so we can verify '
      .repeat(10);
  const lines = wrapAndClamp(font, long, 11, 520, 5);
  assertEquals(lines.length, 5);
  assert(lines[4].endsWith('…'), `poslední řádek nekončí ellipsis: "${lines[4]}"`);
  assert(font.widthOfTextAtSize(lines[4], 11) <= 520, 'poslední řádek přesahuje šířku i s ellipsis');
});

Deno.test('wrapAndClamp: alreadyCut=true vynutí "…", i když se ořezaný text do maxLines vejde celý', async () => {
  // Přesně tenhle případ (viz pdf.ts): vstup se napřed tvrdě ořízne na
  // LIMITS.whatTextMaxChars znaků a TEPRVE PAK se zalamuje. Ořezaný text se
  // do maxLines běžně vejde celý beze zbytku -> bez alreadyCut by wrapAndClamp
  // nepoznalo, že něco chybí, a ellipsis by na konci nebyla (reálně odhalený bug).
  const font = await helvetica();
  const shortEnoughAfterCut = 'One two three four five six seven eight'; // vejde se do 1 řádku
  const withoutFlag = wrapAndClamp(font, shortEnoughAfterCut, 11, 500, 5, false);
  const withFlag = wrapAndClamp(font, shortEnoughAfterCut, 11, 500, 5, true);
  assert(!withoutFlag[withoutFlag.length - 1].endsWith('…'), 'bez alreadyCut nemá být ellipsis');
  assert(withFlag[withFlag.length - 1].endsWith('…'), 's alreadyCut MUSÍ být ellipsis, i když se text vešel');
});

Deno.test('wrapAndClamp: text přesně vyplňující maxLines nedostane zbytečnou "…"', async () => {
  const font = await helvetica();
  // krátká věta, co se vejde přesně na 2 krátké řádky a nic nezbyde
  const lines = wrapAndClamp(font, 'One two three four five six', 11, 90, 5);
  assert(lines.length <= 5);
  assert(!lines[lines.length - 1].endsWith('…'), 'text, který celý vyšel, nemá dostat ellipsis');
});
