/* Barna Academy — vyhledávání v databázi potravin. Čistě klientské, deterministické.
   Port z appky Tvůj Coach (src/data/foods.ts). Diakritika-insensitive + ranking.
   curated položka: {name, category, kcal_100g, protein_100g, carb_100g, fat_100g, fiber_100g, serving_g, note, ean?}.
   Pozn.: EAN se nese dál (klíč pro budoucí affiliate objednávku), i když curated potraviny jsou generické (bez EAN). */
(function (global) {
  'use strict';

  // „rohlik" i „rohlík" matchne stejně — pryč diakritika, lowercase
  function normName(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  // hledání v curated + RANKING: přesná shoda → od začátku → celé slovo → podřetězec
  //   → všechna slova dotazu (v libovolném pořadí)
  //
  // ⚠️ POSLEDNÍ STUPEŇ PŘIBYL 4. 8. 2026 a je to oprava skutečné stížnosti:
  // tester hledal „nízkotučný tvaroh" a nenašel NIC, přestože v databázi je
  // „Tvaroh měkký nízkotučný". Hledalo se totiž jako jedna fráze, takže stačilo mít
  // slova v jiném pořadí než my v názvu. Kvůli tomu z appky odešel.
  // Teď se dotaz rozseká na slova a stačí, aby v názvu byla všechna.
  // ⛔ Táž logika je i v databázi appky (funkce `search_curated_foods`
  // a `search_cached_foods`, migrace 0085 a 0086). Když se mění tady, patří to i tam.
  function searchCurated(curated, query, limit) {
    limit = limit || 24;
    var qn = normName((query || '').trim());
    if (!qn) return [];
    var esc = qn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var wb;
    try { wb = new RegExp('(^|[^\\p{L}\\p{N}])' + esc + '([^\\p{L}\\p{N}]|$)', 'u'); }
    catch (e) { wb = new RegExp('(^|[^a-z0-9])' + esc + '([^a-z0-9]|$)'); } // fallback bez unicode property
    // Slova dotazu. Jednopísmenná zahazujeme, nemají rozlišovací sílu.
    var slova = qn.split(/[^a-z0-9]+/).filter(function (w) { return w.length > 1; });
    return curated
      .map(function (it) {
        var n = normName(it.name);
        var rank = n === qn ? 0 : n.indexOf(qn) === 0 ? 1 : wb.test(n) ? 2 : (n.indexOf(qn) >= 0 ? 3 : 9);
        // Fráze se netrefila, ale můžou tam být všechna slova přeházeně.
        if (rank === 9 && slova.length > 1) {
          var vsechna = slova.every(function (w) { return n.indexOf(w) >= 0; });
          if (vsechna) rank = 4;
        }
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
