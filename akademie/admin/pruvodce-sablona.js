// ŠABLONA NUTRIČNÍHO PRŮVODCE NA MÍRU (admin, karta klienta)
//
// Vyrábí hotový HTML dokument, který Martin buď vytiskne do PDF, nebo uloží klientovi
// do jeho sekce (bucket `client-docs`). Styl a kostra jsou 1:1 s dokumenty, které Martin
// posílal klientům ručně (tři ukázky v `_Claude-dokumenty/*_jidelnicek.html`, `<style>`
// blok je v nich bajtově shodný, takže je to opravdu šablona a ne jedna verze).
//
// ⛔ ČÍSLA SEM CHODÍ HOTOVÁ. Tenhle soubor nic nepočítá kromě součtů a přepočtu záměn
// na stejné kalorie. Kalorie, makra a gramáže počítá `MealGen` (assets/meal-gen.js),
// texty píše člověk nebo AI. Pravidlo „engine počítá, AI mluví" platí i tady.
//
// ⛔ PEVNÉ TEXTY (pravidla, přejedení, etiketa, syrové gramáže) PSAL ČLOVĚK, ne AI.
// Kdo je bude měnit, ať projde `_Claude-dokumenty/HLAS-MARTINA.md`: žádná dlouhá pomlčka,
// žádné „není X, je Y", žádné paralelní trojky.
//
// Závislost: window.MealGen (kvůli `shoppingListFromDays` a `macrosFor`).
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  // Odstavce z volného textu: prázdný řádek dělí odstavce, jednoduchý řádek zůstává v odstavci.
  function odstavce(t) {
    var bloky = String(t == null ? '' : t).replace(/\r/g, '').split(/\n{2,}/);
    return bloky.map(function (b) {
      var v = b.trim(); if (!v) return '';
      return '<p>' + esc(v).split('\n').join('<br>') + '</p>';
    }).join('');
  }
  function r0(n) { return Math.round(Number(n) || 0); }
  // Desetinná ČÁRKA, jak se píše česky (HLAS-MARTINA.md).
  // ⛔ Chybějící hodnota NENÍ nula. `cz(null)` psalo do tabulky „Vláknina 0 g a více",
  // což je číslo, které klientovi nikdo nezadal. Prázdná hodnota se musí přiznat.
  function cz(n, des) {
    if (n === null || n === undefined || n === '') return 'neuvedeno';
    var x = Number(n) || 0;
    var s = des ? (Math.round(x * 10) / 10).toFixed(1) : String(Math.round(x));
    return s.replace('.', ',');
  }

  // ---- ⛔ POJISTKA NA DLOUHOU POMLČKU ----
  // Každý AI přepis ji vrací, i když ji prompt zakazuje, a tenhle dokument jde ven pod
  // Martinovým jménem. Zachytává se tedy ještě jednou tady, na poslední chvíli před
  // vykreslením, a to i u textů, které Martin sám přepsal v adminu.
  function bezPomlcky(s) { return String(s == null ? '' : s).split('—').join(' - '); }

  // ---- pevné texty (psal člověk, viz hlavička) ----
  // ⛔ Po revizi 2. 9. 2026 jsou psané BEZRODĚ. Klientka nemá dostat dokument v mužském
  // rodě jen proto, že se to při psaní nezvážilo. Rod se předává jen do AI textů, kde ho
  // model potřebuje na minulý čas.
  // ⛔ A bez negační kadence „X, ne Y" a bez sloganů (HLAS-MARTINA.md, body 1 a 2).

  // Bílkovina na jídlo se NESLIBUJE natvrdo. Rozpětí se počítá z těch dvou dnů, které klient
  // v dokumentu opravdu má. Fixní věta „25 až 35 g na jídlo" tam byla, přestože engine sype
  // zbytek dne do večeře a ta v měření vyšla 68 a 70 g. (Nález 6 revize 2. 9. 2026.)
  function triVeci(rozsah) {
    return [
      ['Bílkovina v každém jídle.', 'Rozděl ji do dne. ' + rozsah +
        ' Zasytí a je to surovina, ze které se sval opravuje. Trénink ho jen nastartuje.'],
      ['Vláknina a objem.', 'Celozrnné pečivo, vločky, luštěniny, zelenina a ovoce. Drží zažívání v klidu a ubere hlad, který jinak přijde večer.'],
      ['Pití.', 'Vody potřebuješ víc, než to vypadá, hlavně při vyšší vláknině a trénincích.']
    ];
  }
  var T_PRAVIDLA = [
    ['Zapisuj všechno.', 'I tu svačinu mezi jídly. Přesnost zápisu rozhoduje o tom, jak rychle se dá s čísly pracovat. Lidi si příjem podceňují o 20 až 50 %, a pak nesedí, co se děje s váhou.'],
    ['Bílkovinu neošiď.', 'Když nestíháš vařit, dej tvaroh, skyr nebo protein. Denní číslo si nasbírej tak jako tak.'],
    ['Važ se jednou týdně.', 'Ráno po probuzení, nalačno, po záchodě. Rozhoduje týdenní průměr. Jednotlivé dny kolísají vodou a je to normální.'],
    ['Sacharidy a tuky flexibilně.', 'Hlídej kalorie, bílkoviny a vlákninu. Poměr zbytku si uprav podle chuti a podle toho, co máš doma.'],
    ['Spánek.', 'Nejlevnější věc, co s výsledkem uděláš. Bez něj jde chuť k jídlu mimo kontrolu a výkon v tréninku dolů.']
  ];
  var T_SLOZ_SI = [
    ['Začni bílkovinou.', 'Denní číslo vyděl počtem jídel a k tomu skládej zbytek.'],
    ['Doplň přílohu podle energie.', 'Rýže, brambory, těstoviny, pečivo, vločky, luštěniny.'],
    ['Přidej zeleninu a ovoce.', 'Ke každému jídlu, co to jde. Objem a vláknina.'],
    ['Dorovnej tuk.', 'Olivový olej, avokádo, semínka, ořechy. Tukem se den doladí na kalorie.']
  ];
  var T_VYPADEK =
    'Jeden den mimo plán s výsledkem nic neudělá. Vidím to u klientů pořád, problém dělá až ten týden, ' +
    'který po jednom výkyvu přijde ve stylu „stejně už je to rozbité".\n\n' +
    'Co s tím: druhý den se vrať k normálnímu jídlu. Hladovka ani dvě hodiny kardia navíc to nespraví. ' +
    'Zapiš i ten den, ať víme, co se stalo. Ve váze uvidíš skok nahoru, za dva až tři dny bude zpátky, ' +
    'protože je to voda a obsah střev.\n\n' +
    'Když se ti to opakuje každý víkend, nemá cenu to řešit vůlí. Napiš mi to v reportu a najdeme, čím to je.';
  // Tři situace, na které se klienti ptají nejčastěji a v původním dokumentu chyběly
  // (revize klientských materiálů 5. 9. 2026). Text psal člověk, průchod HLAS-MARTINA.
  // Čísla u alkoholu jsou běžné tabulkové hodnoty (půllitr piva, dvě deci vína, panák),
  // úpravu kalorií při stagnaci rozhoduje Martin z reportu, ne klient sám.
  var T_COKDYZ = [
    ['Váha stojí dva tři týdny.', 'Jeden týden bez pohybu je normální, voda a cyklus umí schovat i půl kila tuku dolů. ' +
      'Když stojí třetí týden a zápis sedí, je čas hnout čísly: o 100 až 150 kcal dolů, nebo 2 000 kroků denně navíc. ' +
      'Rozhodnu to z reportu, ty jen zapisuj dál a jídlo si na vlastní pěst neřež.'],
    ['Alkohol.', 'Půllitr piva má kolem 200 kcal, dvě deci vína 150, panák 100. Zapiš ho jako všechno ostatní ' +
      'a ten den uber na tuku nebo příloze, bílkovinu nech. Jeden večer za týden s výsledkem nic neudělá, ' +
      'každý druhý den už ano. Druhý den ráno bude váha nahoře kvůli vodě, za dva dny je zpátky.'],
    ['Restaurace.', 'Vyber jídlo, kde poznáš maso a přílohu, gramáž odhadni podle talíře a zapiš s rezervou nahoru. ' +
      'Omáčky a smažené věci mají tuk, který na talíři nevidíš, počítej s ním. K jídlu si přidej zeleninu ' +
      'a bílkovinu dožeň v dalším jídle. Jedno jídlo v restauraci týdně se v číslech ztratí, kvůli němu kamarády neodmítej.']
  ];
  var T_ETIKETA = [
    'Podívej se do záhlaví tabulky, jestli jsou hodnoty „na 100 g" nebo „na porci". Porce bývá 30 g a kdo si toho nevšimne, zapíše si třetinu skutečné porce.',
    'U rýže, těstovin a vloček platí údaj na syrový stav, pokud výrobce nenapíše jinak. Vařením se mění hmotnost, hodnoty na obalu zůstávají.',
    'Sacharidy na české etiketě jsou bez vlákniny, ta má svůj řádek. U dovozových výrobků z USA bývají sacharidy včetně vlákniny, proto tam číslo vychází vyšší.',
    'Kus váží pokaždé jinak. Rohlík má na obalu 43 g a v obchodě jich koupíš pět různých, takže u pečiva se vyplatí váha.'
  ];
  // ⛔ VĚTA MUSÍ ODPOVÍDAT DATŮM, NE PŘÁNÍ. Databáze má u části položek stav přímo v názvu
  // („Rýže natural (vařená)", „Hovězí kližka (syrová)") a generátor je do dne pouští obojí.
  // Původní znění „množství vážíš v syrovém stavu" tedy u vařené rýže lhalo trojnásobně:
  // 125 g suché rýže je kolem 450 kcal místo 150 a nikdo si toho nevšimne.
  // (Nález 5 revize 2. 9. 2026.)
  var T_SYROVE =
    '<strong>Jak vážit:</strong> u každé položky platí přesně ten stav, který je za ní napsaný. ' +
    '„vážíš vařené" znamená po uvaření, „vážíš syrové" před tepelnou úpravou, „vážíš suché" ' +
    'sypké před vodou. Kde není napsáno nic, váž potravinu tak, jak ji kupuješ. ' +
    'Zeleninu a ovoce počítat tak přesně nemusíš, těch si klidně přidej. ' +
    'Porce se dají posouvat o pár gramů nahoru dolů, hlavně ať den jako celek sedí.';
  var T_LEPEK =
    '<strong>Bez lepku.</strong> Do plánu jsem pustil jen potraviny, u kterých je bezlepkovost jistá, ' +
    'a všechno ostatní generátor odmítl. U zpracovaných věcí (salámy, koření, hotové omáčky, vločky) ale ' +
    'rozhoduje výrobce a konkrétní šarže. Etiketu si přečti i tam, kde bys to nečekal.';

  // ---- styl (bajtově shodný se třemi ručními ukázkami, plus tři nové třídy) ----
  var STYL = [
    '@page { size: A4; margin: 18mm 16mm; }',
    // ⛔ PROTI RUČNÍM UKÁZKÁM PŘIDÁNO `background` a `color-scheme`. Bez nich vykreslí
    // prohlížeč v tmavém režimu černé pozadí pod černým textem a dokument je nečitelný.
    // Na papíře se nic nemění, tam je bílá vždycky.
    'html { color-scheme: light; }',
    'body { background: #fff; font-family: "Segoe UI", Arial, sans-serif; color: #1a1a1a; font-size: 11pt; line-height: 1.45; }',
    'h1 { font-size: 20pt; margin: 0 0 2px; }',
    '.kdo { color: #E07B39; font-weight: 700; font-size: 12pt; margin: 0 0 2px; }',
    '.pripravil { font-style: italic; font-size: 9.5pt; color: #555; margin: 0 0 6px; }',
    'hr.top { border: none; border-top: 2px solid #E07B39; margin: 0 0 14px; }',
    'h2 { font-size: 13.5pt; margin: 22px 0 4px; padding-bottom: 3px; border-bottom: 1.5px solid #E07B39; }',
    'table { border-collapse: collapse; width: 100%; margin: 8px 0; }',
    'th { background: #FBE3D4; text-align: left; padding: 6px 8px; border: 1px solid #E0C4B0; font-size: 10.5pt; }',
    'td { padding: 6px 8px; border: 1px solid #E0C4B0; font-size: 10.5pt; }',
    '.ram { background: #FDF3EC; border: 1px solid #E07B39; padding: 8px 10px; margin: 10px 0; font-size: 10pt; }',
    '.jidlo { color: #E07B39; font-weight: 700; margin: 10px 0 2px; }',
    '.jidlo span { color: #444; font-weight: 400; font-size: 9.5pt; }',
    'ul.pol { margin: 2px 0 0 6px; padding-left: 14px; list-style: none; }',
    'ul.pol li:before { content: "\\2013\\00a0"; color: #888; }',
    'ul.pol li { font-size: 10.5pt; }',
    '.soucet { background: #F3F3F3; padding: 5px 8px; margin-top: 8px; font-weight: 700; font-size: 10pt; }',
    'ul.body { margin: 4px 0 0 0; padding-left: 18px; }',
    'ul.body li { margin-bottom: 5px; }',
    'ol.body { margin: 4px 0 0 0; padding-left: 20px; }',
    'ol.body li { margin-bottom: 5px; }',
    '.pata { border-top: 1.5px solid #E07B39; margin-top: 26px; padding-top: 6px; text-align: center; font-size: 8.5pt; color: #666; }',
    '.zlom { page-break-before: always; }',
    '.tip { font-style: italic; font-size: 9.5pt; color: #555; margin: 2px 0 8px; }',
    // nové: nákupní seznam ve dvou sloupcích a kontrolní strana jen pro Martina
    '.nakup { column-count: 2; column-gap: 22px; margin: 6px 0 0; padding-left: 18px; font-size: 10.5pt; }',
    '.nakup li { margin-bottom: 3px; break-inside: avoid; }',
    '.jen-martin { border: 2px dashed #999; background: #FAFAFA; padding: 10px 12px; margin-top: 14px; }',
    '.jen-martin h2 { border-color: #999; color: #444; }',
    // ⛔ Tisk: tlačítko se nesmí objevit na papíře ani v PDF.
    '@media print { .netisknout { display: none !important; } }',
    '.netisknout { margin: 0 0 14px; }',
    '.netisknout button { font: inherit; font-size: 10pt; padding: 6px 14px; border: 1px solid #E07B39; background: #FDF3EC; color: #1a1a1a; border-radius: 6px; cursor: pointer; }',
    // ⛔ TISK: bez tohohle zůstal nadpis jídla na patě strany a jeho položky přešly na další,
    // a dvousloupcový nákupní seznam se lámal přes hranici stránky (nejkřehčí kombinace,
    // jakou v Chromu v tisku můžeš mít). Nález 8 revize 2. 9. 2026.
    '@media print {',
    '  h1, h2 { break-after: avoid; page-break-after: avoid; }',
    '  .jidlo { break-after: avoid; page-break-after: avoid; }',
    '  .blok-jidla, ul.pol { break-inside: avoid; page-break-inside: avoid; }',
    '  .ram, .soucet, table { break-inside: avoid; page-break-inside: avoid; }',
    '  ul.nakup { column-count: 1; }',
    '}'
  ].join('\n  ');

  // ⛔ Stav potraviny, jak ho nese NÁZEV v databázi. Samostatné pole na syrové versus vařené
  // databáze nemá (syrová a vařená verze jsou dvě položky s vlastním id), takže se čte z názvu
  // a NIC SE NEDOMÝŠLÍ. Kde název stav neuvádí, dokument mlčí a platí obecná věta v rámečku.
  // Domyslet „(syrové)" u kuřecího by se trefilo, u knäckebrotu by to byla tichá chyba,
  // a rozlišit ty dva případy nemáme čím. (Nález 5 revize 2. 9. 2026.)
  function stavPolozky(name) {
    var n = String(name || '').toLowerCase();
    if (/\([^)]*(vařen|uvařen|pečen|dušen|grilovan)/.test(n)) return 'vážíš vařené';
    if (/\([^)]*syrov/.test(n)) return 'vážíš syrové';
    if (/\([^)]*(such|sušen)/.test(n)) return 'vážíš suché';
    return '';
  }

  // Skutečné rozpětí bílkovin na jídlo v těch dvou dnech, které klient opravdu dostane.
  // ⛔ Nesmí to být fixní slib. Věta „25 až 35 g na jídlo" tam byla, přestože engine sype
  // zbytek dne do posledního jídla a večeře v měření vyšly 68 a 70 g, tedy dvojnásobek
  // toho, co dokument o dvě sekce výš doporučoval. (Nález 6 revize 2. 9. 2026.)
  function rozsahBilkovin(dny) {
    var hlavni = [], svaciny = [];
    dny.forEach(function (b) {
      var denKcal = ((b.den || {}).totals || {}).kcal || 1;
      ((b.den || {}).meals || []).forEach(function (m) {
        var t = m.totals || {};
        (((t.kcal || 0) / denKcal) >= 0.18 ? hlavni : svaciny).push(Math.round(t.p || 0));
      });
    });
    function pasmo(a) {
      if (!a.length) return '';
      var lo = Math.min.apply(null, a), hi = Math.max.apply(null, a);
      return lo === hi ? (lo + ' g') : (lo + ' až ' + hi + ' g');
    }
    var h = pasmo(hlavni), sv = pasmo(svaciny);
    if (!h && !sv) return 'Kolik jí padne na které jídlo, vidíš u každého jídla v obou dnech.';
    if (!sv) return 'V tomhle plánu vychází na jídlo ' + h + '.';
    return 'V tomhle plánu vychází na hlavní jídla ' + h + ' a na svačiny ' + sv + '.';
  }

  // ---- jeden vzorový den ----
  function denHtml(blok, poradi) {
    var den = blok.den || {}, meals = den.meals || [];
    var nazvy = blok.nazvy || [];
    var h = '<h2' + (poradi > 1 ? ' class="zlom"' : '') + '>' + esc(blok.cislo + '. ' + blok.nadpis) + '</h2>';
    meals.forEach(function (m, i) {
      var nazev = (nazvy[i] && String(nazvy[i]).trim()) || m.name || ('Jídlo ' + (i + 1));
      var t = m.totals || { kcal: 0, p: 0 };
      h += '<div class="blok-jidla"><p class="jidlo">' + esc(bezPomlcky(nazev))
        + ' <span>&asymp; ' + r0(t.kcal) + ' kcal &middot; ' + r0(t.p) + ' g B</span></p><ul class="pol">';
      (m.items || []).forEach(function (it) {
        var stav = stavPolozky(it.food.name);
        h += '<li>' + esc(it.food.name) + ' ' + r0(it.grams) + ' g'
          + (stav ? ' <span style="color:#666;">(' + stav + ')</span>' : '') + '</li>';
      });
      h += '</ul></div>';
    });
    var dt = den.totals || { kcal: 0, p: 0, fib: 0 };
    h += '<div class="soucet">Celkem za den: ' + r0(dt.kcal) + ' kcal &middot; ' + r0(dt.p)
      + ' g bílkovin &middot; vláknina ' + r0(dt.fib) + ' g</div>';
    return h;
  }

  // ---- nákupní seznam na týden ----
  // Dva vzorové dny rozložené na sedm: den 1 čtyřikrát, den 2 třikrát. Sčítání, oddělení
  // obchodu i přepočet na kusy a balení dělá `MealGen.shoppingListFromDays`, tady se jen
  // vypisuje. ⛔ Nic se tu nepřepočítává znovu, jinak by vznikla druhá verze čísel.
  function nakupTyden(dny) {
    if (!global.MealGen || !global.MealGen.shoppingListFromDays) return [];
    var opak = [];
    if (dny[0] && dny[0].den) { opak.push(dny[0].den, dny[0].den, dny[0].den, dny[0].den); }
    if (dny[1] && dny[1].den) { opak.push(dny[1].den, dny[1].den, dny[1].den); }
    if (!opak.length) return [];
    return global.MealGen.shoppingListFromDays(opak);
  }

  // ---- záměny s gramážemi ----
  // ⛔⛔ BÍLKOVINNÉ ZDROJE SE ROVNAJÍ NA BÍLKOVINU, NE NA KALORIE. Když se rovnaly na
  // kalorie, vypadla z toho rovnice „tuňák v oleji 115 g = tuňák ve vlastní šťávě 190 g",
  // kde krajní členy dělí 25 g bílkovin na jednu porci, tedy dvojnásobek. Klient, který
  // se drží pokynu z dokumentu, tak mine denní cíl o desítky gramů, a přitom mu tentýž
  // dokument o dvě sekce výš říká, že bílkovina je první ze tří věcí, na kterých to stojí.
  // Přílohy, tuky a ovoce se dál rovnají na kalorie, tam je energie ta správná osa.
  // U každé položky se proto píše OBOJÍ číslo, ať je rozdíl vidět. (Nález 4 revize 2. 9. 2026.)
  //
  // ⛔ Kandidáti se berou VÝHRADNĚ z potravin, které v obou dnech reálně jsou. Ty prošly
  // dietním filtrem generátoru, takže se do záměn nemůže dostat nic vyloučeného. Sahat sem
  // pro „hezčí" nabídku do celé databáze by tuhle jistotu zrušilo (filtr `filterDb` není
  // z MealGenu veřejně dostupný a druhá kopie filtru by se tiše rozešla s tou první).
  function zamenySkupiny(dny) {
    var pouzite = {}, poradi = [];
    dny.forEach(function (b) {
      ((b.den || {}).meals || []).forEach(function (m) {
        (m.items || []).forEach(function (it) {
          var f = it.food;
          if (!pouzite[f.id]) { pouzite[f.id] = { food: f, gramy: 0 }; poradi.push(f.id); }
          pouzite[f.id].gramy = Math.max(pouzite[f.id].gramy, it.grams);
        });
      });
    });
    var skupiny = [
      { cat: 'protein', label: 'Bílkovina', osa: 'protein' },
      { cat: 'carb', label: 'Příloha a pečivo', osa: 'kcal' },
      { cat: 'fat', label: 'Tuk', osa: 'kcal' }
    ];
    var mf = (global.MealGen && global.MealGen.macrosFor) || null;
    function makra(f, g) {
      if (mf) return mf(f, g);
      var k = g / 100;
      return { kcal: (f.per100.kcal || 0) * k, p: (f.per100.p || 0) * k };
    }
    var out = [];
    skupiny.forEach(function (sk) {
      var cleny = poradi.map(function (id) { return pouzite[id]; })
        .filter(function (x) {
          if (x.food.cat !== sk.cat) return false;
          // bez energie (nebo u bílkovinné osy bez bílkoviny) není z čeho přepočítávat
          return sk.osa === 'protein' ? (x.food.per100.p || 0) > 0 : (x.food.per100.kcal || 0) > 0;
        });
      if (cleny.length < 2) return;
      // kotva = největší porce na dané ose, od ní se počítají ostatní
      cleny.sort(function (a, b) {
        var ma = makra(a.food, a.gramy), mb = makra(b.food, b.gramy);
        return (sk.osa === 'protein' ? (mb.p - ma.p) : (mb.kcal - ma.kcal));
      });
      var kotva = cleny[0];
      var mKotva = makra(kotva.food, kotva.gramy);
      var cil = sk.osa === 'protein' ? mKotva.p : mKotva.kcal;
      var radek = cleny.slice(0, 5).map(function (x, idx) {
        var g;
        if (idx === 0) g = kotva.gramy;
        else {
          var na100 = sk.osa === 'protein' ? x.food.per100.p : x.food.per100.kcal;
          g = Math.max(5, Math.round((cil / (na100 / 100)) / 5) * 5);
        }
        var m = makra(x.food, g);
        return { name: x.food.name, gramy: Math.round(g / 5) * 5, kcal: Math.round(m.kcal), prot: Math.round(m.p) };
      });
      out.push({
        label: sk.label,
        osa: sk.osa,
        popis: sk.osa === 'protein'
          ? ('stejně bílkovin, kolem ' + Math.round(cil) + ' g')
          : ('stejně kalorií, kolem ' + Math.round(cil) + ' kcal'),
        radek: radek
      });
    });
    return out;
  }

  // ---- kontrolní výpočet (JEN PRO MARTINA) ----
  // Nahrazuje ruční `*_jidelnicek_vypocet.md`. Ukazuje, jak daleko je engine od zadání,
  // protože tichá chyba v číslech je přesně to, co v hotovém dokumentu nikdo nepozná.
  function kontrolaHtml(data) {
    var c = data.cile || {};
    function odchylka(skut, cil) {
      if (!cil) return '<td>' + cz(skut) + '</td><td>cíl nenastaven</td>';
      var p = (skut - cil) / cil * 100;
      return '<td>' + cz(skut) + '</td><td>' + (p >= 0 ? '+' : '') + cz(p, true) + ' %</td>';
    }
    // `zlom` patří na obálku, ne na nadpis: jinak začne rámeček ještě na předchozí straně.
    var h = '<div class="jen-martin zlom"><h2>Kontrolní výpočet (jen pro Martina)</h2>'
      + '<p style="font-size:10pt;margin:0 0 6px;">Tahle strana se do souboru pro klienta neukládá. '
      + 'Je tu proto, aby šlo na jeden pohled poznat, že engine minul zadání.</p>'
      + '<table><tr><th>Veličina</th><th>Cíl</th><th>Den 1</th><th>Rozdíl</th><th>Den 2</th><th>Rozdíl</th></tr>';
    var radky = [
      ['Energie (kcal)', c.kcal, 'kcal'], ['Bílkoviny (g)', c.protein, 'p'],
      ['Sacharidy (g)', c.carbs, 'c'], ['Tuky (g)', c.fat, 'f'], ['Vláknina (g)', c.fiber, 'fib']
    ];
    radky.forEach(function (rd) {
      var t1 = ((data.dny[0] || {}).den || {}).totals || {}, t2 = ((data.dny[1] || {}).den || {}).totals || {};
      h += '<tr><td>' + esc(rd[0]) + '</td><td>' + (rd[1] ? cz(rd[1]) : 'neuveden') + '</td>'
        + odchylka(t1[rd[2]] || 0, rd[1]) + odchylka(t2[rd[2]] || 0, rd[1]) + '</tr>';
    });
    h += '</table>';
    var p = data.prefs || {};
    var dietni = [];
    if (p.bezLepku) dietni.push('bez lepku');
    if (p.bezLaktozy) dietni.push('bez laktózy a mléčných');
    if (p.vegetarian) dietni.push('vegetarián');
    if (p.vegan) dietni.push('vegan');
    h += '<p style="font-size:10pt;">Dietní filtr: <strong>' + (dietni.length ? esc(dietni.join(', ')) : 'žádný') + '</strong>.<br>'
      + 'Vyloučené potraviny (' + ((p.excludeId || []).length) + '): '
      + ((p.excludeId || []).length ? esc((p.excludeId || []).join(', ')) : 'žádné') + '.<br>'
      + 'Počet jídel: ' + esc(String(data.pocetJidel || '')) + ' &middot; seedy: '
      + esc((data.seedy || []).join(' a ')) + ' (se stejnými seedy a stejným filtrem vznikne totožný den).</p>'
      + '<p style="font-size:10pt;">⛔ Bezlepkovost drží tvrdá brána generátoru: projde jen potravina, u které lepek '
      + 'není ani v <code>obsahuje</code>, ani v <code>nejiste</code>. Neprotříděná položka neprojde nikdy.</p>'
      + '</div>';
    return h;
  }

  /**
   * Vyrobí celý dokument.
   * @param {object} data  jméno, oslovení, cíle, texty, dny (z MealGen), prefs, seedy
   * @param {object} opts  { proMartina: true = přidá kontrolní stranu a tlačítko Tisk }
   */
  function render(data, opts) {
    opts = opts || {};
    data = data || {};
    var t = data.texty || {};
    var dny = data.dny || [];
    var c = data.cile || {};
    var jmeno = bezPomlcky(data.jmeno || '');
    var h = '<!doctype html>\n<html lang="cs">\n<head>\n<meta charset="utf-8">\n'
      + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
      + '<title>' + esc('Tvůj jídelníček na míru' + (jmeno ? ' - ' + jmeno : '')) + '</title>\n'
      + '<style>\n  ' + STYL + '\n</style>\n</head>\n<body>\n';

    if (opts.proMartina) {
      h += '<div class="netisknout"><button onclick="window.print()">Vytisknout nebo uložit jako PDF</button> '
        + '<span style="font-size:9.5pt;color:#666;">V dialogu tisku vyber „Uložit jako PDF".</span></div>\n';
    }

    h += '<h1>Tvůj jídelníček na míru</h1>\n'
      + '<p class="kdo">' + esc(jmeno) + (jmeno ? ' &middot; ' : '') + 'výživa</p>\n'
      + '<p class="pripravil">Připravil Martin Barna, Online Výživa a Fitness'
      + (data.datum ? ' &middot; ' + esc(data.datum) : '') + '</p>\n'
      + '<hr class="top">\n';

    // Prázdné oslovení dávalo „Ahoj !". Bez jména se pozdraví obecně, jako to dělá drip-send.
    var osl = bezPomlcky(String(data.osloveni || '').trim());
    h += '<p>Ahoj' + (osl ? ' ' + esc(osl) : '') + '! 👋</p>\n' + odstavce(bezPomlcky(t.uvod));

    // 1. čísla
    h += '<h2>1. Tvoje čísla</h2>'
      + '<p>Tohle je tvůj denní cíl. Drž se hlavně těchhle tří hodnot, o zbytek se nestresuj:</p>'
      + '<table><tr><th>Denní cíl</th><th>Hodnota</th></tr>'
      + '<tr><td>Energie</td><td>' + cz(c.kcal) + ' kcal</td></tr>'
      + '<tr><td>Bílkoviny</td><td>' + cz(c.protein) + ' g'
      + (data.proteinPozn ? ' (' + esc(bezPomlcky(data.proteinPozn)) + ')' : '') + '</td></tr>'
      + '<tr><td>Vláknina</td><td>' + cz(c.fiber) + ' g a více</td></tr>'
      + '</table>';
    if (t.proc_tyhle_tri) h += '<div class="ram"><strong>Proč zrovna tyhle tři?</strong> ' + esc(bezPomlcky(t.proc_tyhle_tri)) + '</div>';
    if (t.zadani_navic) h += '<div class="ram"><strong>Tvoje zadání navíc:</strong> ' + esc(bezPomlcky(t.zadani_navic)) + '</div>';

    // 2. tři věci. ⛔ Rozpětí bílkovin se počítá z DNŮ TOHOHLE KLIENTA, nikdy se neslibuje.
    h += '<h2>2. Tři věci, na kterých to stojí</h2><ul class="body">'
      + triVeci(rozsahBilkovin(dny)).map(function (x) { return '<li><strong>' + x[0] + '</strong> ' + x[1] + '</li>'; }).join('')
      + '</ul>';

    // ⛔ Čísla sekcí se počítají, nepíšou se natvrdo. Nákupní seznam se vykreslí jen když
    // něco obsahuje, a s pevnými čísly by klient uviděl posloupnost 3, 4, 6, 7.
    var cis = 2;
    var dalsi = function () { cis += 1; return cis; };

    // vzorové dny
    dny.forEach(function (b, i) {
      h += denHtml({ den: b.den, nazvy: b.nazvy, cislo: dalsi(), nadpis: 'Vzorový den ' + (i + 1) }, i + 1);
    });
    h += '<div class="ram">' + T_SYROVE + '</div>';
    if ((data.prefs || {}).bezLepku) h += '<div class="ram">' + T_LEPEK + '</div>';
    if (data.poznamka_pod_dny) h += '<div class="ram">' + esc(bezPomlcky(data.poznamka_pod_dny)) + '</div>';

    // 5. nákupní seznam
    var nakup = nakupTyden(dny);
    if (nakup.length) {
      h += '<h2>' + dalsi() + '. Nákupní seznam na týden</h2>'
        + '<p>Sedm dní podle těhle dvou vzorů: den 1 čtyřikrát, den 2 třikrát. Zeleninu a ovoce ber s rezervou, '
        + 'těch si klidně přidáš. Seřazeno zhruba podle oddělení v obchodě.</p><ul class="nakup">';
      nakup.forEach(function (s) {
        var mn = s.pieces ? (s.pieces + ' ' + s.pieceLabel + ' (' + cz(s.grams) + ' g)') : (cz(s.grams) + ' g');
        h += '<li>' + esc(s.name) + ' &middot; ' + esc(mn) + '</li>';
      });
      h += '</ul>';
    }

    // 6. záměny s gramážemi
    var zam = zamenySkupiny(dny);
    h += '<h2>' + dalsi() + '. Záměny, když něco nemáš doma</h2>'
      + '<p>Vyměňuj v rámci skupiny. U každé skupiny je napsáno, na co je gramáž dorovnaná: '
      + 'u bílkovin na stejné množství bílkovin, u příloh a tuků na stejné kalorie. '
      + 'Druhé číslo v závorce ti ukáže, co se tou výměnou posune.</p>';
    if (zam.length) {
      h += '<ul class="body">';
      zam.forEach(function (z) {
        h += '<li><strong>' + esc(z.label) + '</strong> <span style="color:#666;">(' + esc(z.popis) + ')</span><br>'
          + z.radek.map(function (x) {
            return esc(x.name) + ' ' + cz(x.gramy) + ' g <span style="color:#666;">('
              + cz(x.kcal) + ' kcal, ' + cz(x.prot) + ' g B)</span>';
          }).join(' = ')
          + '</li>';
      });
      h += '</ul>';
    }
    h += '<p><strong>Ovoce a zelenina:</strong> cokoli za cokoli, jen u sušeného ovoce hlídej kalorie, '
      + 'těch je v malém objemu hodně.</p>';

    // 7. pravidla a vlastní den (sloučené sekce 6 a 7 z ručních ukázek)
    h += '<h2>' + dalsi() + '. Co to drží pohromadě a jak si den složíš sám</h2><ol class="body">'
      + T_PRAVIDLA.map(function (x) { return '<li><strong>' + x[0] + '</strong> ' + x[1] + '</li>'; }).join('')
      + '</ol>'
      + '<p style="margin-top:10px;">Až budeš chtít den poskládat po svém, postup je pořád stejný:</p><ol class="body">'
      + T_SLOZ_SI.map(function (x) { return '<li><strong>' + x[0] + '</strong> ' + x[1] + '</li>'; }).join('')
      + '</ol>';

    // 8. výpadek z plánu
    h += '<h2>' + dalsi() + '. Když se přejím nebo vypadnu z plánu</h2>' + odstavce(T_VYPADEK);

    // 8b. co když: stagnace, alkohol, restaurace (doplněno 5. 9. 2026)
    h += '<h2>' + dalsi() + '. Co když: váha stojí, alkohol, restaurace</h2><ul class="body">'
      + T_COKDYZ.map(function (x) { return '<li><strong>' + x[0] + '</strong> ' + x[1] + '</li>'; }).join('')
      + '</ul>';

    // 9. etiketa
    h += '<h2>' + dalsi() + '. Jak číst etiketu</h2><ul class="body">'
      + T_ETIKETA.map(function (x) { return '<li>' + x + '</li>'; }).join('')
      + '</ul>';

    // na závěr
    if (t.na_zaver) h += '<h2>Na závěr</h2>' + odstavce(bezPomlcky(t.na_zaver));
    h += '<p>Kdyby ti cokoli nesedlo, nebo něco z plánu prostě nejíš, napiš mi a vyměníme to. '
      + 'Plán se má přizpůsobit tobě.</p>'
      + '<p><strong>Be Effective!</strong><br>Martin</p>'
      + '<div class="pata">Martin Barna, Online Výživa a Fitness &middot; martinbarna.cz &middot; Be Effective!</div>';

    if (opts.proMartina) h += kontrolaHtml(data);

    return h + '\n</body>\n</html>';
  }

  global.PruvodceSablona = {
    render: render,
    nakupTyden: nakupTyden,
    zamenySkupiny: zamenySkupiny,
    bezPomlcky: bezPomlcky
  };
})(window);
