/* Barna Academy — vyhledávání v databázi potravin. Čistě klientské, deterministické.
   Port z appky Tvůj Coach (src/data/foods.ts + src/lib/food-query.ts). Diakritika-
   insensitive + ranking. curated položka: {name, category, kcal_100g, protein_100g,
   carb_100g, fat_100g, fiber_100g, serving_g, hledaci?, note?}.
   Pozn.: plný text `note` (volný text, občas s EAN) se do nástroje na webu od
   25. 8. 2026 NENESE, nikde se nezobrazuje; curated_foods nemají strukturovaný EAN
   sloupec (jsou generické), viz CLAUDE.md appky. Plný `assets/curated-foods.json`
   (zdroj pro appku i DB export) `note` pořád má, zmenšená webová kopie
   (`curated-foods.min.json`) místo něj nese jen compact `hledaci` (0/1, viz
   export-curated-foods-min.mjs) — ať searchCurated pozná „Tvar hledání"/„Alias
   hledání" bez tahání celého textu. */
(function (global) {
  'use strict';

  // „rohlik" i „rohlík" matchne stejně - pryč diakritika, lowercase
  function normName(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  // 6. pád značky řetězce → kanonický tvar. Stížnost 17. 8. 2026: „chléb šumavský
  // z lidlu" nenašlo nic, protože filtr chtěl slovo „lidlu" a to v žádném názvu není.
  // Značky se z filtru rovnou VYNECHÁVAJÍ: tahle databáze jsou generika bez značek,
  // takže „chléb z lidlu" má hledat chléb, ne nic.
  // ⛔ TÁŽ MAPA žije v appce (migrace 0113 + src/lib/food-query.ts). Kdo mění, mění obě.
  // ⛔ NEPŘIDÁVAT slova, která jsou i potravina: „rohlik" (pečivo!), „hruska" (ovoce!).
  var ALIAS_ZNACKY = { lidlu: 'lidl', tesca: 'tesco', tesku: 'tesco', albertu: 'albert',
    pennyho: 'penny', kauflandu: 'kaufland', billu: 'billa', bille: 'billa',
    globusu: 'globus', pilosu: 'pilos', boniho: 'boni', clevera: 'clever' };
  var ZNACKY = { lidl: 1, tesco: 1, albert: 1, penny: 1, kaufland: 1, billa: 1,
    globus: 1, pilos: 1, boni: 1, clever: 1 };

  // Kategorie, které znamenají HOTOVÉ JÍDLO, ne surovinu. Musí souhlasit s migrací 0105
  // v appce (`search_curated_foods`) a s `KATEGORIE_HOTOVYCH_JIDEL` v `src/data/foods.ts`,
  // jinak se web a appka rozejdou v pořadí výsledků.
  // ⚠️ Položka bez kategorie se schválně bere jako SUROVINA (nepropadne za jídla),
  // stejně jako `coalesce(f.category, '')` v té migraci.
  var JE_HOTOVE_JIDLO = { 'hotová jídla': 1, 'polévky': 1, 'dezerty': 1, 'saláty': 1 };

  // Hledací tvar / alias z importu, ne kanonický název (appka: `jeHledaciTvar`
  // v src/lib/food-query.ts). Zmenšený export nese jen compact `hledaci` (0/1),
  // ale funkce umí i fallback na plný `note`, kdyby ho položka měla.
  function jeHledaciTvar(it) {
    if (it.hledaci) return true;
    var nn = normName(it.note || '');
    return nn.indexOf('tvar hledani') >= 0 || nn.indexOf('alias hledani') >= 0;
  }

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
  // ⛔⛔ KTEROU DATABÁZI TENHLE HLEDÁČ DOSTÁVÁ: obsahově `assets/curated-foods.json`
  // (generovaný export `curated_foods`, klíč `category` s hodnotami „hotová jídla",
  // „maso", „mléčné"…), ale nástroj od 25. 8. 2026 stahuje ZMENŠENOU variantu
  // `assets/curated-foods.min.json` (fromMin() níž ji převede zpátky na stejný tvar
  // objektů) a až při prvním použití vyhledávání, ne při načtení stránky
  // (`akademie/nastroje/potraviny/index.html`, viz export-curated-foods-min.mjs).
  // ⚠️ NE `assets/food-db.json` (1192 položek, klíč `cat` = protein/carb/veg). Ten patří
  // GENERÁTORU jídelníčku. Kdo si je splete, měří něco jiného, než co uživatel vidí;
  // stalo se to 11. 8. 2026 a vedlo to k nepravdivému závěru „web to neumí".
  //
  // ⚠️ DVA ROZDÍLY PROTI APPCE, oba změřené (11. 8. 2026 nad curated-foods.json):
  // 1. Appka uvnitř přihrádky řadí ještě podle DÉLKY názvu, tenhle web ne (drží pořadí
  //    zdroje). Dorovnání je plošně NEROZHODNÉ: 1335 dotazů, 2374 sledovaných položek,
  //    485 nahoru proti 495 dolů, 85 nově do první pětky proti 85 ven z ní.
  // 2. ✅ Od 11. 8. 2026 řadí i web SUROVINU PŘED HOTOVÝM JÍDLEM (JE_HOTOVE_JIDLO níž),
  //    stejně jako appka od migrace 0105. Příklady po nasazení: „sýr" → Feta sýr
  //    (dřív Burrito bean & cheese), „kuřecí" → Kuřecí prsa (dřív Kuřecí biryani).
  //    ⚠️ `curated-foods.json` se od 11. 8. GENERUJE skriptem
  //    scripts/export-curated-foods.mjs z živé tabulky `curated_foods` (service klíč,
  //    anon dostane přes RLS prázdno). Ruční úpravy JSON se přepíšou dalším exportem;
  //    obsahové změny patří do DB. Po každém exportu bumpni `curated-foods.json?v=`
  //    v akademie/nastroje/potraviny/index.html.
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
    // Značky řetězců se přemapují z 6. pádu a vyhodí (viz ALIAS_ZNACKY nahoře).
    var slova = qn.split(/[^a-z0-9]+/)
      .filter(function (w) { return w.length > 1; })
      .map(function (w) { return ALIAS_ZNACKY[w] || w; })
      .filter(function (w) { return !ZNACKY[w]; });
    // Vypínací slova pro demotici tuku/kůže: kdo je sám hledá, nemá se odsouvat.
    // Stejný regex jako appka (`jeDemotovanyTukNeboKuze`), žádné „škvarky" navíc.
    var chceTuk = /(tuk|olej|sadlo|maslo|ghi)/.test(qn);
    var chceKuze = qn.indexOf('kuze') >= 0;
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
        // ⚠️ `>= 1`, ne `> 1`: po vyhození značky („chléb z lidlu" → [chleb]) je
        // slovo JINÉ než celá fráze, takže i jedno slovo si zaslouží vlastní test.
        if (rank === 9 && slova.length >= 1) {
          var vsechna = slova.every(function (w) { return n.indexOf(w) >= 0; });
          if (vsechna) rank = 5;
        }
        // UVNITŘ PŘIHRÁDKY (rank 1-5), nejsilnější demotice první, zrcadlí appku
        // (`rankCuratedHit` v src/lib/food-query.ts, koeficienty 16/8/4/2):
        //   1. hledací tvar / alias z importu (nejsilnější)
        //   2. čistý tuk (kcal ≥ 700 a bílkoviny < 3), NEodsouvá se, když dotaz
        //      sám tuk hledá
        //   3. „kůže" v názvu, NEodsouvá se, když dotaz kůži sám hledá
        //   4. hotové jídlo (nejslabší, PŮVODNÍ demotice z 11. 8. 2026)
        // Váhy (100/20/10) jsou schválně tak daleko od sebe, že součet slabších
        // stupňů nikdy nepřebije ten silnější (20+10=30 < 100; 10 < 20) a přesná
        // shoda (0) i netrefeno (9) zůstávají mimo tenhle blok.
        if (rank > 0 && rank < 9) {
          var kcal = Number(it.kcal_100g);
          var protein = Number(it.protein_100g);
          if (!isFinite(protein)) protein = 0;
          var cistyTuk = isFinite(kcal) && kcal >= 700 && protein < 3 && !chceTuk;
          var kuze = n.indexOf('kuze') >= 0 && !chceKuze;
          var alias = jeHledaciTvar(it);
          var jidlo = !!JE_HOTOVE_JIDLO[it.category];
          rank += (alias ? 100 : 0) + ((cistyTuk || kuze) ? 20 : 0) + (jidlo ? 10 : 0);
        }
        return { it: it, rank: rank };
      })
      // ⛔ POZOR NA 9: je to značka „netrefeno", ne stupeň. Nesmí se filtrovat
      // porovnáním `rank < 9`, protože demotice (alias/tuk/kůže/jídlo výš) posouvá
      // rank klidně na 135 a vypadla by VŠECHNA.
      .filter(function (x) { return x.rank !== 9; })
      .sort(function (a, b) {
        // Uvnitř stupně kratší název napřed („Feta sýr" před „Ayib (etiopský…)"),
        // pak drží stabilní sort pořadí zdroje, a to je abecední (export je řazený
        // podle názvu stejně jako `order by name` v databázi appky).
        return (a.rank - b.rank) || (a.it.name.length - b.it.name.length);
      })
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

  // Zmenšený export (assets/curated-foods.min.json, viz export-curated-foods-min.mjs):
  // {cols:[...], rows:[[...],...]} místo pole objektů — kvůli 43 130 položkám na
  // mobilu. Převede se zpátky na pole objektů se STEJNÝM tvarem jako plný export,
  // aby searchCurated/macrosFor/render v index.html zůstaly beze změny.
  function fromMin(min) {
    if (!min || !min.cols || !min.rows) return [];
    var cols = min.cols;
    return min.rows.map(function (row) {
      var o = {};
      for (var i = 0; i < cols.length; i++) o[cols[i]] = row[i];
      return o;
    });
  }

  global.FoodSearch = { normName: normName, search: searchCurated, macrosFor: macrosFor, fromMin: fromMin };
})(window);
