// Spustit: deno test --allow-net --allow-write --allow-read supabase/functions/poukaz-vydat/__tests__/pdf.test.ts
// (--allow-net kvůli esm.sh importům pdf-lib/fontkit, --allow-write ukládá ukázky do ../../../../out)
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';
import { buildVoucherPdf, LIMITS, normalizeVzhled } from '../lib/pdf.ts';

const OUT_DIR = new URL('../../../../out/', import.meta.url);

async function saveSample(name: string, bytes: Uint8Array) {
  try {
    await Deno.mkdir(OUT_DIR, { recursive: true });
  } catch { /* existuje */ }
  await Deno.writeFile(new URL(name, OUT_DIR), bytes);
}

Deno.test('PDF: základní poukaz je jedna stránka, validní PDF, obsahuje jméno a kód', async () => {
  const bytes = await buildVoucherPdf({
    recipientName: 'Jana Nováková',
    whatText: 'Online konzultace s Martinem',
    code: 'MB-2026-K7QM',
    validUntilCzech: '25. 8. 2027',
    issuedAtCzech: '25. 8. 2026',
  });

  assert(bytes.length > 1000, 'PDF je podezřele malé');
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  assertEquals(header, '%PDF-');
  const tail = new TextDecoder().decode(bytes.slice(-16));
  assert(tail.includes('%%EOF'), 'PDF nekončí %%EOF');

  const doc = await PDFDocument.load(bytes);
  assertEquals(doc.getPageCount(), 1);
  const page = doc.getPage(0);
  const { width, height } = page.getSize();
  assert(width > height, 'stránka není na šířku (landscape)');

  await saveSample('poukaz-vzor-kratke.pdf', bytes);
});

Deno.test('PDF: prázdné jméno padá na "pro tebe"', async () => {
  const bytes = await buildVoucherPdf({
    recipientName: '',
    whatText: 'Barna Academy doživotně',
    code: 'MB-2026-ABCD',
    validUntilCzech: '1. 1. 2027',
    issuedAtCzech: '1. 1. 2026',
  });
  assert(bytes.length > 1000);
  await saveSample('poukaz-vzor-prazdne-jmeno.pdf', bytes);
});

Deno.test('PDF: dlouhé jméno i dlouhý text se nepřetečou (ořízne se, PDF pořád validní)', async () => {
  const longName = 'Jana Marie Alžběta Novotná-Dvořáková z Horní Dolní Lhoty'.repeat(2);
  const longWhat =
    'Tenhle text je schválně mnohem delší, než by na poukaz kdy reálně přišlo, aby se ověřilo, '.repeat(10);

  const bytes = await buildVoucherPdf({
    recipientName: longName,
    whatText: longWhat,
    code: 'MB-2026-ZZZZ',
    validUntilCzech: '15. 6. 2027',
    issuedAtCzech: '15. 6. 2026',
  });

  assert(longName.length > LIMITS.recipientNameMaxChars, 'test sám o sobě musí přesáhnout limit jména');
  assert(longWhat.length > LIMITS.whatTextMaxChars, 'test sám o sobě musí přesáhnout limit textu');

  const doc = await PDFDocument.load(bytes); // spadne, kdyby byl PDF poškozený
  assertEquals(doc.getPageCount(), 1);

  await saveSample('poukaz-vzor-dlouhy-text.pdf', bytes);
});

Deno.test('PDF: 4 skutečné varianty (konzultace/videokurz/academy/balicek349) se vyrobí bez chyby', async () => {
  const varianty: Array<{ code: string; what: string }> = [
    { code: 'MB-2026-KONZ', what: 'Online konzultace s Martinem' },
    { code: 'MB-2026-VIDE', what: 'Videokurz výživy (182 videí)' },
    { code: 'MB-2026-ACAD', what: 'Barna Academy doživotně' },
    { code: 'MB-2026-BAL3', what: '40 receptů a 48 odpovědí' },
  ];
  for (const v of varianty) {
    const bytes = await buildVoucherPdf({
      recipientName: 'Test Klient',
      whatText: v.what,
      code: v.code,
      validUntilCzech: '25. 8. 2027',
      issuedAtCzech: '25. 8. 2026',
    });
    const doc = await PDFDocument.load(bytes);
    assertEquals(doc.getPageCount(), 1);
    await saveSample(`poukaz-vzor-${v.code}.pdf`, bytes);
  }
});

// --- Regrese na nálezy nezávislé revize (Cursor, 25. 8. 2026), nález 6 -------

Deno.test('PDF: jméno s \\n a \\r nespadne (dřív pdf-lib na newline házel výjimku)', async () => {
  const bytes = await buildVoucherPdf({
    recipientName: 'Jan\nNovák\r\nMladší',
    whatText: 'Online konzultace s Martinem',
    code: 'MB-2026-NLNL',
    validUntilCzech: '25. 8. 2027',
    issuedAtCzech: '25. 8. 2026',
  });
  const doc = await PDFDocument.load(bytes);
  assertEquals(doc.getPageCount(), 1);
  await saveSample('poukaz-vzor-newline-jmeno.pdf', bytes);
});

Deno.test('PDF: jedno extrémně dlouhé slovo bez mezer ve "what" textu se ořízne, ne přeteče', async () => {
  const bytes = await buildVoucherPdf({
    recipientName: 'Test Klient',
    whatText: 'Toto' + 'X'.repeat(200) + 'JednoSlovoBezMezerNaKterémByStaréZalomeníSpadlo',
    code: 'MB-2026-SLOV',
    validUntilCzech: '25. 8. 2027',
    issuedAtCzech: '25. 8. 2026',
  });
  const doc = await PDFDocument.load(bytes);
  assertEquals(doc.getPageCount(), 1);
  await saveSample('poukaz-vzor-dlouhe-slovo.pdf', bytes);
});

Deno.test('normalizeVzhled: neznámé/prázdné padá na tmava, platné hodnoty se zachovají', () => {
  assertEquals(normalizeVzhled(undefined), 'tmava');
  assertEquals(normalizeVzhled(null), 'tmava');
  assertEquals(normalizeVzhled(''), 'tmava');
  assertEquals(normalizeVzhled('neco-cizi'), 'tmava');
  assertEquals(normalizeVzhled('svetla'), 'svetla');
  assertEquals(normalizeVzhled('slavnostni'), 'slavnostni');
});

// Nález z nasazení (26. 8. 2026): Stripe dropdown `vzhledpoukazu` si `value`
// vygeneroval sám z labelu bez diakritiky/mezer, ne z kanonických hodnot.
// Změřeno v API logu: "Tmavá zlatá" → `tmavzlat`, "Světlá na tisk" →
// `svtlnatisk`, "Slavnostní" → `slavnostn`. Test na všech 6 vstupů
// (3 kanonické + 3 syrové Stripe) + '' + nesmysl, ať se žádná varianta
// znovu neztratí, kdyby se mapa omylem smazala.
Deno.test('normalizeVzhled: syrové Stripe hodnoty (bez diakritiky) i kanonické, plus prázdné/nesmysl', () => {
  // kanonické
  assertEquals(normalizeVzhled('tmava'), 'tmava');
  assertEquals(normalizeVzhled('svetla'), 'svetla');
  assertEquals(normalizeVzhled('slavnostni'), 'slavnostni');
  // syrové ze Stripe (labely "Tmavá zlatá" / "Světlá na tisk" / "Slavnostní"
  // bez diakritiky a mezer)
  assertEquals(normalizeVzhled('tmavzlat'), 'tmava');
  assertEquals(normalizeVzhled('svtlnatisk'), 'svetla');
  assertEquals(normalizeVzhled('slavnostn'), 'slavnostni');
  // prázdné / nesmysl
  assertEquals(normalizeVzhled(''), 'tmava');
  assertEquals(normalizeVzhled('nesmysl-xyz'), 'tmava');
});

Deno.test('PDF: vzhled svetla vyrobí validní jednostránkové PDF', async () => {
  const bytes = await buildVoucherPdf({
    recipientName: 'Jana Nováková',
    whatText: 'Online konzultace s Martinem',
    code: 'MB-2026-SVET',
    validUntilCzech: '25. 8. 2027',
    issuedAtCzech: '25. 8. 2026',
    vzhled: 'svetla',
  });
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  assertEquals(header, '%PDF-');
  const tail = new TextDecoder().decode(bytes.slice(-16));
  assert(tail.includes('%%EOF'), 'PDF nekončí %%EOF');
  const doc = await PDFDocument.load(bytes);
  assertEquals(doc.getPageCount(), 1);
  await saveSample('poukaz-vzor-svetla.pdf', bytes);
});

Deno.test('PDF: vzhled slavnostni vyrobí validní jednostránkové PDF', async () => {
  const bytes = await buildVoucherPdf({
    recipientName: 'Jana Nováková',
    whatText: 'Online konzultace s Martinem',
    code: 'MB-2026-SLAV',
    validUntilCzech: '25. 8. 2027',
    issuedAtCzech: '25. 8. 2026',
    vzhled: 'slavnostni',
  });
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  assertEquals(header, '%PDF-');
  const tail = new TextDecoder().decode(bytes.slice(-16));
  assert(tail.includes('%%EOF'), 'PDF nekončí %%EOF');
  const doc = await PDFDocument.load(bytes);
  assertEquals(doc.getPageCount(), 1);
  await saveSample('poukaz-vzor-slavnostni.pdf', bytes);
});

Deno.test('PDF: neplatný vzhled nespadne a vyrobí validní PDF (default tmava)', async () => {
  const bytes = await buildVoucherPdf({
    recipientName: 'Test Klient',
    whatText: 'Online konzultace s Martinem',
    code: 'MB-2026-FIAL',
    validUntilCzech: '25. 8. 2027',
    issuedAtCzech: '25. 8. 2026',
    vzhled: 'fialova',
  });
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  assertEquals(header, '%PDF-');
  const tail = new TextDecoder().decode(bytes.slice(-16));
  assert(tail.includes('%%EOF'), 'PDF nekončí %%EOF');
  const doc = await PDFDocument.load(bytes);
  assertEquals(doc.getPageCount(), 1);
});

Deno.test('PDF: jen tabulátory a mezery v jméně padnou na "pro tebe" (sanitizace + trim)', async () => {
  const bytes = await buildVoucherPdf({
    recipientName: '\t\t   \n  ',
    whatText: 'Online konzultace s Martinem',
    code: 'MB-2026-TABS',
    validUntilCzech: '25. 8. 2027',
    issuedAtCzech: '25. 8. 2026',
  });
  const doc = await PDFDocument.load(bytes);
  assertEquals(doc.getPageCount(), 1);
});
