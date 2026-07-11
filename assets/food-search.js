/* Barna Academy — vyhledávání v databázi potravin. Čistě klientské, deterministické.
   Port z appky Tvůj Coach (src/data/foods.ts). Diakritika-insensitive + ranking.
   curated položka: {name, category, kcal_100g, protein_100g, carb_100g, fat_100g, fiber_100g, serving_g, note, ean?}.
   Pozn.: EAN se nese dál (klíč pro budoucí affiliate objednávku), i když curated potraviny jsou generické (bez EAN). */
(function (global) {
  'use strict';

  // „rohlik" i „rohlík" matchne stejně — pryč diakritika, lowercase
  function normName(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  // hledání v curated + RANKING: přesná shoda → od začátku → celé slovo → podřetězec
  function searchCurated(curated, query, limit) {
    limit = limit || 24;
    var qn = normName((query || '').trim());
    if (!qn) return [];
    var esc = qn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var wb;
    try { wb = new RegExp('(^|[^\\p{L}\\p{N}])' + esc + '([^\\p{L}\\p{N}]|$)', 'u'); }
    catch (e) { wb = new RegExp('(^|[^a-z0-9])' + esc + '([^a-z0-9]|$)'); } // fallback bez unicode property
    return curated
      .map(function (it) {
        var n = normName(it.name);
        var rank = n === qn ? 0 : n.indexOf(qn) === 0 ? 1 : wb.test(n) ? 2 : (n.indexOf(qn) >= 0 ? 3 : 9);
        return { it: it, rank: rank };
      })
      .filter(function (x) { return x.rank < 9; })
      .sort(function (a, b) { return a.rank - b.rank; }) // JS sort stabilní → drží pořadí zdroje
      .slice(0, limit)
      .map(function (x) { return x.it; });
  }

  // makra porce: gramáž × (hodnota/100 g)
  function macrosFor(item, grams) {
    var f = grams / 100;
    return {
      kcal: (item.kcal_100g || 0) * f, protein: (item.protein_100g || 0) * f,
      carb: (item.carb_100g || 0) * f, fat: (item.fat_100g || 0) * f, fiber: (item.fiber_100g || 0) * f,
    };
  }

  global.FoodSearch = { normName: normName, search: searchCurated, macrosFor: macrosFor };
})(window);
