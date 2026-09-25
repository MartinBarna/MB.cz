#!/usr/bin/env node
// Pánský lead magnet „Muž 35+: dostat formu zpátky": výpočet porcí a maker + HTML pro PDF.
//
// Spuštění (z kořene repa):
//   node _zdroje/leadmagnet/build-forma-zpet-muzi.js
//   → přepíše _zdroje/leadmagnet/forma-zpet-muzi.html, forma-zpet-muzi-vypocet.json
//     a bloky mezi značkami PLAN-MUZI ve forma-zpet/index.html (ukázkový den a náhled týdne).
// PDF (Chrome headless, A4 bez okrajů):
//   chrome --headless=new --no-pdf-header-footer --print-to-pdf=download/forma-zpet-muzi.pdf
//          file:///<repo>/_zdroje/leadmagnet/forma-zpet-muzi.html
// OG obrázek: node scripts/generate-og.js og-forma-zpet (čte forma-zpet-muzi-vypocet.json).
//
// Výpočet je v makro-plan-core.js (společný se ženským plánem), jídla ve forma-zpet-muzi-data.js.
'use strict';
require('./makro-plan-core.js').build(require('./forma-zpet-muzi-data.js'));
