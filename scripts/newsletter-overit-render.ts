// Ověření newsletterových bloků RENDEREM Z PRODUKČNÍHO ZDROJE, ne čtením.
//
// ⭐ Proč: 21. 8. 2026 nenašlo pět agentů, kteří přečetli všech 154 šablon, ani grep,
// že blok `img` shodí render a mail nikdy neodejde. Našel to až pokus mail vykreslit.
// Text šablony může být bezvadný a mail přesto neodejde.
//
// Skript si vyřízne renderer PŘÍMO z akademie/_supabase/functions/drip-send/index.ts
// (podle značek v kódu, ne podle čísel řádků) a pustí přes něj vygenerované bloky
// ve všech třech segmentech. Nic neposílá, nic nezapisuje.
//
// Použití:
//   npx deno@2 run --allow-read --allow-write --node-modules-dir=none \
//     scripts/newsletter-overit-render.ts <soubor.blocks.json> [dalsi.blocks.json ...]

const SCRIPT_DIR = new URL('.', import.meta.url);
const DRIP = new URL('../akademie/_supabase/functions/drip-send/index.ts', SCRIPT_DIR);

const ZACATEK = 'const NL = String.fromCharCode(10);';
const KONEC = '// `extra` = volitelné proměnné z těla invoku';

async function vyrizniRenderer(): Promise<string> {
  const src = await Deno.readTextFile(DRIP);
  const a = src.indexOf(ZACATEK);
  const b = src.indexOf(KONEC);
  if (a < 0 || b < 0 || b <= a) {
    throw new Error('nenasel jsem renderer v drip-send/index.ts (znacky se posunuly, oprav ZACATEK/KONEC)');
  }
  let kus = src.slice(a, b);
  // Konstanty z prostředí edge funkce sem netahám, render je nepotřebuje.
  kus = kus.split('\n').filter((r) => !r.includes('Deno.env.get(')).join('\n');
  return kus + '\nexport { renderHtml, renderText, wrapHtml };\n';
}

function kontrola(text: string, jmeno: string): string[] {
  const vady: string[] = [];
  if (text.includes('undefined')) vady.push('undefined v ' + jmeno);
  for (const t of ['{{', '[[', ']]', '[a]', '[\u00e1]']) if (text.includes(t)) vady.push('nerozresen token ' + t + ' v ' + jmeno);
  if (text.includes('\u2014')) vady.push('dlouha pomlcka v ' + jmeno);
  return vady;
}

if (import.meta.main) {
  const cesty = Deno.args;
  if (!cesty.length) {
    console.error('pouziti: newsletter-overit-render.ts <soubor.blocks.json> ...');
    Deno.exit(2);
  }
  const tmp = await Deno.makeTempFile({ suffix: '.ts' });
  await Deno.writeTextFile(tmp, await vyrizniRenderer());
  const mod = await import('file://' + tmp.split('\\').join('/'));

  let vadnych = 0;
  for (const c of cesty) {
    const z = JSON.parse(await Deno.readTextFile(c));
    for (const seg of ['zeny', 'muzi', 'other']) {
      const v = { jmeno: 'Jana', unsubscribe_url: 'https://example.invalid/u', email: 'nikdo@example.invalid' };
      let html: string, text: string, cely: string;
      try {
        html = mod.renderHtml(z.blocks, seg, v);
        text = mod.renderText(z.blocks, seg, v);
        cely = mod.wrapHtml(z.preheader, html, 'paticka');
      } catch (e) {
        vadnych++;
        console.log(`${z.slug}/${seg}: ⛔ RENDER SPADL: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
      const vady = [...kontrola(cely, 'HTML'), ...kontrola(text, 'textu')];
      if (vady.length) vadnych++;
      console.log(`${z.slug}/${seg}: html ${html.length} B, text ${text.length} B` + (vady.length ? '  ⛔ ' + vady.join(', ') : '  OK'));
    }
  }
  await Deno.remove(tmp);
  if (vadnych) { console.log('\n⛔ vadnych kombinaci: ' + vadnych); Deno.exit(1); }
  console.log('\n✅ vsechny kombinace prosly produkcnim rendererem');
}
