#!/usr/bin/env node
// Ženský lead magnet „7denní makro plán pro ženy 30+": výpočet porcí a maker + HTML pro PDF.
//
// Spuštění (z kořene repa):
//   node _zdroje/leadmagnet/build-makro-plan-zeny.js
//   → přepíše _zdroje/leadmagnet/makro-plan-zeny.html, makro-plan-zeny-vypocet.json
//     a bloky mezi značkami PLAN-ZENY v makro-plan/index.html (ukázkový den a náhled týdne).
// PDF (Chrome headless, A4 bez okrajů):
//   chrome --headless=new --no-pdf-header-footer --print-to-pdf=download/makro-plan-zeny.pdf
//          file:///<repo>/_zdroje/leadmagnet/makro-plan-zeny.html
// OG obrázek: node scripts/generate-og.js og-makro-plan (čte makro-plan-zeny-vypocet.json).
//
// Výpočet je v makro-plan-core.js (společný s pánským plánem), jídla v makro-plan-zeny-data.js.
'use strict';
require('./makro-plan-core.js').build(require('./makro-plan-zeny-data.js'));
