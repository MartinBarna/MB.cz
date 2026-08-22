// Regresni test rendereru bloku v `drip-send`.
//
// PROC EXISTUJE: 21. 8. 2026 pribyl do sablon typ bloku `img`, ktery zadny z rendereru
// neznal. Propadl do posledniho `return`, ten sahl na `b.href`, a mail spadl na hlasce
// "Cannot read properties of undefined (reading 'indexOf')". Nez se prisla na pricinu,
// neodeslo se 69 mailu 35 lidem a z hlasky nikdo nepoznal, ze jde o typ bloku.
//
// PROC TAKHLE: `renderHtml` a `renderText` nejsou z `index.ts` exportovane (je to edge
// funkce, ne knihovna), a exportovat je jen kvuli testu by menilo nasazovany soubor.
// Test si proto vyrobi docasnou kopii `index.ts`, ve ktere jedinou zmenou neutralizuje
// `Deno.serve` a doplni export. Testuje se tedy DOSLOVNY produkcni text funkci.
//
// Spusteni: npx deno run --node-modules-dir=none -A render-bloky.test.ts

const zde = new URL('.', import.meta.url);
const zdroj = await Deno.readTextFile(new URL('index.ts', zde));

const SERVE = 'Deno.serve(async (req: Request) => {';
if (!zdroj.includes(SERVE)) {
  throw new Error('render-bloky.test: v index.ts uz nesedi kotva na Deno.serve, oprav test');
}
const docasny = new URL('_render-bloky.harness.ts', zde);
await Deno.writeTextFile(
  docasny,
  zdroj.replace(SERVE, 'const _neposlouchej = (async (req: Request) => {') +
    '\nexport { renderHtml, renderText, _neposlouchej };\n',
);

let ok = 0, fail = 0;
function check(jmeno: string, podminka: boolean, detail = '') {
  if (podminka) { ok++; console.log('  ok   ' + jmeno); }
  else { fail++; console.log('  FAIL ' + jmeno + (detail ? '  ' + detail : '')); }
}

try {
  const { renderHtml, renderText } = await import(docasny.href + '?t=' + Math.random());
  const seg = {} as never;
  const v: Record<string, string> = {};

  // --- 1. Neznamy typ bloku: hlasita chyba, ktera typ jmenuje -----------------
  for (const [kde, render] of [['HTML', renderHtml], ['TEXT', renderText]] as const) {
    try {
      render([{ t: 'video', src: 'x' } as never], seg, v);
      check(kde + ': neznamy blok hodi chybu', false, '(nic se nestalo)');
    } catch (e) {
      const m = String((e as Error).message);
      check(kde + ': neznamy blok hodi chybu', true);
      check(kde + ': zprava jmenuje typ bloku', m.includes('"video"'), m);
      // Tohle je presne ta hlaska z incidentu 21. 8., uz se nesmi vratit.
      check(kde + ': zprava neni ta stara krypticka', !m.includes('indexOf'), m);
    }
  }

  // --- 2. Regrese: vsech pet znamych typu se vykresluje dal stejne ------------
  const bloky = [
    { t: 'p', html: 'Ahoj' },
    { t: 'ps', html: 'PS text' },
    { t: 'bullets', items: ['jedna', 'dva'] },
    { t: 'img', src: 'https://x/y.png', alt: 'popis' },
    { t: 'btn', text: 'Koupit', href: 'https://buy.stripe.com/x' },
  ] as never[];

  const h: string = renderHtml(bloky, seg, v);
  check('HTML p', h.includes("<p style='margin:0 0 14px'>Ahoj</p>"));
  check('HTML ps', h.includes('mb-ps') && h.includes('PS text'));
  check('HTML bullets', h.includes("<li style='margin:0 0 7px'>jedna</li>"));
  check('HTML img', h.includes("<img src='https://x/y.png'") && h.includes("alt='popis'"));
  check('HTML btn', h.includes("class='mb-btn' href='https://buy.stripe.com/x'") && h.includes('Koupit'));

  const t: string = renderText(bloky, seg, v);
  check('TEXT p', t.includes('Ahoj'));
  check('TEXT ps', t.includes('PS text'));
  check('TEXT bullets', t.includes('- jedna'));
  check('TEXT img', t.includes('[obrázek: popis]'), t);
  check('TEXT btn', t.includes('Koupit: https://buy.stripe.com/x'));
} finally {
  await Deno.remove(docasny).catch(() => {});
}

console.log(fail === 0 ? `HOTOVO: ${ok} kontrol, vse proslo` : `SELHALO: ${fail} z ${ok + fail}`);
if (fail > 0) Deno.exit(1);
