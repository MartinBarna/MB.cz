/* Barna Academy — vyhledávání v databázi potravin. Čistě klientské, deterministické.
   Port z appky Tvůj Coach (src/data/foods.ts). Diakritika-insensitive + ranking.
   curated položka: {name, category, kcal_100g, protein_100g, carb_100g, fat_100g, fiber_100g, serving_g, note, ean?}.
   Pozn.: EAN se nese dál (klíč pro budoucí affiliate objednávku), i když curated potraviny jsou generické (bez EAN). */
(function (global) {
  'use strict';

  // „rohlik" i „rohlík" matchne stejně — pryč diakritika, lowercase
  function normName(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  // hledání v curated + RANKING: přesná shoda → od začátku s koncem slova → celé slovo
  //   → od začátku, ale slovo pokračuje → podřetězec → všechna slova (v libovolném pořadí)
  //
  // ⚠️ STUPNĚ 1 A 3 SE ROZDĚLILY 9. 8. 2026 a je to oprava skutečné vady:
  // dotaz „sýr" vracel na prvních jedenácti místech samé nesýry (čtyřikrát
  // syrovátkový protein v prášku), skutečná Feta byla až dvanáctá. „Začíná dotazem"
  // totiž vyhrávalo nad „je to celé slovo" a přitom hranici slova netestovalo, takže
  // po odstranění diakritiky sedělo „syr" na „SYRovátkový". Totéž dělalo
  // „rýže → Ryzec" a „Tvarohový štrúdl nad Tvarohem měkkým".
  // ⛔ Nedělat to tak, že stupeň 1 hranici slova jen VYŽADUJE: hledá se při psaní,
  // takže rozepsaný dotaz („kuř", „tvar") musí dál držet svou potravinu nahoře.
  // Na to je stupeň 3.
  // ⚠️ Změřená cena: u krátkých dotazů, kde je dotaz zároveň celým slovem v názvu
  // jiného jídla, se surovina propadne. „kuře" nově vrátí „Kuře kung-pao" místo
  // kuřecího masa; „kuřecí" funguje správně dál.
  //
  // ⚠️ POSLEDNÍ STUPEŇ PŘIBYL 4. 8. 2026 a je to oprava skutečné stížnosti:
  // tester hledal „nízkotučný tvaroh" a nenašel NIC, přestože v databázi je
  // „Tvaroh měkký nízkotučný". Hledalo se totiž jako jedna fráze, takže stačilo mít
  // slova v jiném pořadí než my v názvu. Kvůli tomu z appky odešel.
  // Teď se dotaz rozseká na slova a stačí, aby v názvu byla všechna.
  // ⛔ Táž logika je i v databázi appky (funkce `search_curated_foods`
  // a `search_cached_foods`, migrace 0085, 0086, 0101 a 0102) a v klientu appky
  // (`src/data/foods.ts` → `searchLocalRanked`). Když se mění tady, patří to i tam.
  // ⚠️ A po každé změně bumpni `food-search.js?v=` v akademie/nastroje/potraviny/,
  // jinak vracející se návštěvník dostane z cache starý soubor.
  //
  // ⛔⛔ KTEROU DATABÁZI TENHLE HLEDÁČ DOSTÁVÁ: `assets/curated-foods.json`
  // (2382 položek, klíč `category` s hodnotami „hotová jídla", „maso", „mléčné"…),
  // volá ho `akademie/nastroje/potraviny/index.html` kolem řádku 105.
  // ⚠️ NE `assets/food-db.json` (1192 položek, klíč `cat` = protein/carb/veg). Ten patří
  // GENERÁTORU jídelníčku. Kdo si je splete, měří něco jiného, než co uživatel vidí;
  // stalo se to 11. 8. 2026 a vedlo to k nepravdivému závěru „web to neumí".
  //
  // ⚠️ DVA ROZDÍLY PROTI APPCE, oba změřené (11. 8. 2026 nad curated-foods.json):
  // 1. Appka uvnitř přihrádky řadí ještě podle DÉLKY názvu, tenhle web ne (drží pořadí
  //    zdroje). Dorovnání je plošně NEROZHODNÉ: 1335 dotazů, 2374 sledovaných položek,
  //    485 nahoru proti 495 dolů, 85 nově do první pětky proti 85 ven z ní.
  // 2. ⏳ Appka od migrace 0105 řadí SUROVINU PŘED HOTOVÝM JÍDLEM (podle `category`),
  //    tenhle web zatím NE. **Tady to jde a pomohlo by to**: dnes „sýr" vrací
  //    „Burrito bean & cheese (fazole a sýr)", s tím pravidlem by vrátil „Feta sýr";
  //    „kuřecí" vrací „Kuřecí biryani", vrátilo by „Kuřecí prsa".
  //    ⛔ Čeká to na rozhodnutí, není to hotová věc, kterou by někdo zapomněl.
  //    ⚠️ A pozor: `curated-foods.json` je ZASTARALÝ ruční export bez generujícího
  //    skriptu (2382 položek proti 2369 v appce) a nemá opravu kategorií z migrace 0105,
  //    takže „kuře" by i s tím pravidlem vrátilo Tandoori kuře, ne kuřecí prsa.
  //    Kdo to bude dělat, začne obnovením exportu, ne řazením.
  function searchCurated(curated, query, limit) {
    limit = limit || 24;
    var qn = normName((query || '').trim());
    if (!qn) return [];
    var esc = qn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var wb, startWb;
    try {
      wb = new RegExp('(^|[^\\p{L}\\p{N}])' + esc + '([^\\p{L}\\p{N}]|$)', 'u');
      startWb = new RegExp('^' + esc + '([^\\p{L}\\p{N}]|$)', 'u');
    } catch (e) { // fallback bez unicode property
      wb = new RegExp('(^|[^a-z0-9])' + esc + '([^a-z0-9]|$)');
      startWb = new RegExp('^' + esc + '([^a-z0-9]|$)');
    }
    // Slova dotazu. Jednopísmenná zahazujeme, nemají rozlišovací sílu.
    var slova = qn.split(/[^a-z0-9]+/).filter(function (w) { return w.length > 1; });
    return curated
      .map(function (it) {
        var n = normName(it.name);
        // 0 přesná · 1 začátek + konec slova · 2 celé slovo kdekoli
        // · 3 začátek, ale slovo pokračuje · 4 jinde uvnitř · 9 netrefeno
        var rank = n === qn ? 0
          : startWb.test(n) ? 1
          : wb.test(n) ? 2
          : n.indexOf(qn) === 0 ? 3
          : (n.indexOf(qn) >= 0 ? 4 : 9);
        // Fráze se netrefila, ale můžou tam být všechna slova přeházeně.
        if (rank === 9 && slova.length > 1) {
          var vsechna = slova.every(function (w) { return n.indexOf(w) >= 0; });
          if (vsechna) rank = 5;
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
