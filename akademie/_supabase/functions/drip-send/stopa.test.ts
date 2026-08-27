// Testy mereni mailu (`stopa.ts`). Spousteni: deno test --allow-read stopa.test.ts
// Zadna sit ani DB: vsechno je cista funkce nad HTML retezcem.
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { ostopkuj, podpis, smiSeMerit, type StopaIdent } from './stopa.ts';

const SECRET = 'testovaci-secret-nikdy-v-produkci';
const BASE = 'https://uhmrpfsdcujbhbtumqye.supabase.co';
const ID: StopaIdent = { track: 'lead-magnet', step: 3, key: 'lm-3-prvni-nabidka', lead_id: '11111111-2222-3333-4444-555555555555' };

const obal = (telo: string) => '<!doctype html><html><body>' + telo + '</body></html>';

// Vytahne hodnoty p a s z prvniho odkazu na danou funkci.
function rozeber(html: string, fn: string): { p: string; s: string } | null {
  const idx = html.indexOf('/functions/v1/' + fn + '?p=');
  if (idx < 0) return null;
  const od = html.indexOf('?p=', idx) + 3;
  const doKonce = html.slice(od);
  const konec = Math.min(
    ...[String.fromCharCode(39), String.fromCharCode(34)]
      .map((q) => doKonce.indexOf(q))
      .filter((n) => n >= 0),
  );
  const cely = doKonce.slice(0, konec);
  const del = cely.indexOf('&amp;s=');
  return { p: cely.slice(0, del), s: cely.slice(del + 7) };
}
function telo(p: string): Record<string, unknown> {
  const b64 = p.split('-').join('+').split('_').join('/');
  const pad = b64 + '==='.slice((b64.length + 3) % 4);
  const bin = atob(pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}

Deno.test('bez secretu se HTML nemeni (fail-safe smerem k odeslani)', async () => {
  const h = obal("<a href='https://martinbarna.cz/videokurz'>koupit</a>");
  assertEquals(await ostopkuj(h, ID, '', BASE), h);
});

Deno.test('pixel se prilepi tesne pred </body>', async () => {
  const out = await ostopkuj(obal('<p>ahoj</p>'), ID, SECRET, BASE);
  assertStringIncludes(out, '/functions/v1/mail-pixel?p=');
  assert(out.indexOf('mail-pixel') < out.indexOf('</body>'), 'pixel musi byt uvnitr body');
});

Deno.test('odkaz na nas web se prepise a podpis sedi', async () => {
  const out = await ostopkuj(obal("<a href='https://martinbarna.cz/videokurz'>koupit</a>"), ID, SECRET, BASE);
  const r = rozeber(out, 'mail-klik');
  assert(r, 'odkaz se nemel prepsat na mail-klik');
  assertEquals(await podpis(r!.p, SECRET), r!.s);
  const t = telo(r!.p);
  assertEquals(t.url, 'https://martinbarna.cz/videokurz');
  assertEquals(t.tr, 'lead-magnet');
  assertEquals(t.st, 3);
  assertEquals(t.ld, ID.lead_id);
});

Deno.test('podpis nesedi, kdyz se navesti zmeni (ochrana proti podvrzeni cile)', async () => {
  const p1 = await podpis('AAA', SECRET);
  const p2 = await podpis('AAB', SECRET);
  assert(p1 !== p2);
  assertEquals(p1.length, 27);
});

Deno.test('⛔ odhlasovaci odkaz se NEPREPISUJE', async () => {
  const unsub = BASE + '/functions/v1/unsubscribe?token=abc123';
  const out = await ostopkuj(obal("<a href='" + unsub + "'>odhlasit</a>"), ID, SECRET, BASE);
  assertStringIncludes(out, unsub);
  assertEquals(out.indexOf('mail-klik'), -1);
});

Deno.test('⛔ auth odkaz se NEPREPISUJE', () => {
  assertEquals(smiSeMerit('https://uhmrpfsdcujbhbtumqye.supabase.co/auth/v1/verify?token=xyz'), false);
});

Deno.test('cizi hostitel, mailto, kotva a http se nemeri', () => {
  assertEquals(smiSeMerit('https://example.com/'), false);
  assertEquals(smiSeMerit('mailto:martin@martinbarna.cz'), false);
  assertEquals(smiSeMerit('#dolu'), false);
  assertEquals(smiSeMerit('http://martinbarna.cz/'), false);
  assertEquals(smiSeMerit('https://buy.stripe.com/xyz'), true);
  assertEquals(smiSeMerit('https://tvujcoach.cz/'), true);
});

Deno.test('obrazek (img src) se neprepisuje, prepisuji se jen odkazy', async () => {
  const img = BASE + '/storage/v1/object/public/mail-obrazky/tc-desktop-1.png';
  const out = await ostopkuj(obal("<img src='" + img + "' alt='x'>"), ID, SECRET, BASE);
  assertStringIncludes(out, img);
});

Deno.test('&amp; v href se dekoduje, do podpisu jde skutecna adresa', async () => {
  const out = await ostopkuj(
    obal("<a href='https://martinbarna.cz/videokurz?a=1&amp;b=2'>x</a>"),
    ID,
    SECRET,
    BASE,
  );
  const r = rozeber(out, 'mail-klik')!;
  assertEquals(telo(r.p).url, 'https://martinbarna.cz/videokurz?a=1&b=2');
});

Deno.test('druhy pruchod uz odkaz neobali podruhe', async () => {
  const jednou = await ostopkuj(obal("<a href='https://martinbarna.cz/x'>x</a>"), ID, SECRET, BASE);
  const dvakrat = await ostopkuj(jednou, ID, SECRET, BASE);
  const pocet = dvakrat.split('/functions/v1/mail-klik').length - 1;
  assertEquals(pocet, 1);
});

Deno.test('vice odkazu v jednom mailu se prepise vsechny', async () => {
  const out = await ostopkuj(
    obal("<a href='https://martinbarna.cz/a'>a</a><p>text</p><a href='https://buy.stripe.com/b'>b</a>"),
    ID,
    SECRET,
    BASE,
  );
  assertEquals(out.split('/functions/v1/mail-klik').length - 1, 2);
});

Deno.test('tri kopie stopa.ts jsou bajt na bajt shodne', async () => {
  const zde = new URL('./stopa.ts', import.meta.url);
  const original = await Deno.readTextFile(zde);
  for (const kam of ['../milestones/stopa.ts', '../order-rescue/stopa.ts']) {
    const kopie = await Deno.readTextFile(new URL(kam, import.meta.url));
    assertEquals(kopie, original, 'rozesla se kopie: ' + kam);
  }
});
