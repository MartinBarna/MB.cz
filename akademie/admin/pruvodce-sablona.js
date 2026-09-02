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
  function cz(n, des) {
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
  var T_TRI_VECI = [
    ['Bílkovina v každém jídle.', 'Rozděl ji do dne, zhruba 25 až 35 g na jídlo. Zasytí a je to surovina, ze které se sval opravuje. Trénink ho jen nastartuje.'],
    ['Vláknina a objem.', 'Celozrnné pečivo, vločky, luštěniny, zelenina a ovoce. Drží zažívání v klidu a ubere hlad, který jinak přijde večer.'],
    ['Pití.', 'Vody potřebuješ víc, než by sis řekl, hlavně při vyšší vláknině a trénincích. Voda je základ, zbytek je bonus.']
  ];
  var T_PRAVIDLA = [
    ['Zapisuj všechno.', 'I tu svačinu mezi jídly. Přesnost zápisu rozhoduje o tom, jak rychle se dá s čísly pracovat. Lidi si příjem podceňují o 20 až 50 %, a pak nesedí, co se děje s váhou.'],
    ['Bílkovinu neošiď.', 'Když nestíháš vařit, dej tvaroh, skyr nebo protein. Denní číslo si nasbírej tak jako tak.'],
    ['Važ se jednou týdně.', 'Ráno po probuzení, nalačno, po záchodě. Sleduj týdenní průměr, ne jednotlivé dny. Váha kolísá vodou a je to normální.'],
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
    'Co s tím: druhý den se vrať k normálnímu jídlu. Bez hladovky, bez trestu v podobě dvou hodin kardia. ' +
    'Zapiš i ten den, ať víme, co se stalo. Ve váze uvidíš skok nahoru, za dva až tři dny bude zpátky, ' +
    'protože je to voda a obsah střev.\n\n' +
    'Když se ti to opakuje každý víkend, nemá cenu to řešit vůlí. Napiš mi to v reportu a najdeme, čím to je.';
  var T_ETIKETA = [
    'Podívej se do záhlaví tabulky, jestli jsou hodnoty „na 100 g" nebo „na porci". Porce bývá 30 g a kdo si toho nevšimne, zapíše si třetinu toho, co snědl.',
    'U rýže, těstovin a vloček platí údaj na syrový stav, pokud výrobce nenapíše jinak. Vařením se mění hmotnost, hodnoty na obalu ne.',
    'Sacharidy na české etiketě jsou bez vlákniny, ta má svůj řádek. U dovozových výrobků z USA bývají sacharidy včetně vlákniny, proto tam číslo vychází vyšší.',
    'Kus váží pokaždé jinak. Rohlík má na obalu 43 g a v obchodě jich koupíš pět různých, takže u pečiva se vyplatí váha.'
  ];
  var T_SYROVE =
    '<strong>Množství vážíš v syrovém stavu</strong> (maso, ryby, rýže, těstoviny, vločky, luštěniny, brambory), ' +
    'není-li u položky napsáno jinak. Zeleninu a ovoce počítat tak přesně nemusíš, těch si klidně přidej. ' +
    'Porce se dají posouvat o pár gramů nahoru dolů, hlavně ať den jako celek sedí.';
  var T_LEPEK =
    '<strong>Bez lepku.</strong> Do plánu jsem pustil jen potraviny, u kterých je bezlepkovost jistá, ' +
    'a všechno ostatní generátor odmítl. U zpracovaných věcí (salámy, koření, hotové omáčky, vločky) ale ' +
    'rozhoduje výrobce a konkrétní šarže, ne druh potraviny. Etiketu si přečti i tam, kde bys to nečekal.';

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
    '.netisknout button { font: inherit; font-size: 10pt; padding: 6px 14px; border: 1px solid #E07B39; background: #FDF3EC; color: #1a1a1a; border-radius: 6px; cursor: pointer; }'
  ].join('\n  ');

  // ---- jeden vzorový den ----
  function denHtml(blok, poradi) {
    var den = blok.den || {}, meals = den.meals || [];
    var nazvy = blok.nazvy || [];
    var h = '<h2' + (poradi > 1 ? ' class="zlom"' : '') + '>' + esc(blok.cislo + '. ' + blok.nadpis) + '</h2>';
    meals.forEach(function (m, i) {
      var nazev = (nazvy[i] && String(nazvy[i]).trim()) || m.name || ('Jídlo ' + (i + 1));
      var t = m.totals || { kcal: 0, p: 0 };
      h += '<p class="jidlo">' + esc(bezPomlcky(nazev))
        + ' <span>&asymp; ' + r0(t.kcal) + ' kcal &middot; ' + r0(t.p) + ' g B</span></p><ul class="pol">';
      (m.items || []).forEach(function (it) {
        h += '<li>' + esc(it.food.name) + ' ' + r0(it.grams) + ' g</li>';
      });
      h += '</ul>';
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

  // ---- záměny s gramážemi na stejné kalorie ----
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
      { cat: 'protein', label: 'Bílkovina' },
      { cat: 'carb', label: 'Příloha a pečivo' },
      { cat: 'fat', label: 'Tuk' }
    ];
    var out = [];
    skupiny.forEach(function (s) {
      var cleny = poradi.map(function (id) { return pouzite[id]; })
        .filter(function (x) { return x.food.cat === s.cat && (x.food.per100.kcal || 0) > 0; });
      if (cleny.length < 2) return;
      // kotva = položka s největší porcí v kaloriích, od ní se počítají ostatní
      cleny.sort(function (a, b) {
        return (b.food.per100.kcal * b.gramy) - (a.food.per100.kcal * a.gramy);
      });
      var kotva = cleny[0];
      var kotvaKcal = kotva.food.per100.kcal / 100 * kotva.gramy;
      var radek = [{ name: kotva.food.name, gramy: Math.round(kotva.gramy / 5) * 5 }];
      cleny.slice(1, 5).forEach(function (x) {
        var g = kotvaKcal / (x.food.per100.kcal / 100);
        radek.push({ name: x.food.name, gramy: Math.max(5, Math.round(g / 5) * 5) });
      });
      out.push({ label: s.label, kcal: Math.round(kotvaKcal), radek: radek });
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

    h += '<p>Ahoj ' + esc(bezPomlcky(data.osloveni || '')) + '! 👋</p>\n' + odstavce(bezPomlcky(t.uvod));

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

    // 2. tři věci
    h += '<h2>2. Tři věci, na kterých to stojí</h2><ul class="body">'
      + T_TRI_VECI.map(function (x) { return '<li><strong>' + x[0] + '</strong> ' + x[1] + '</li>'; }).join('')
      + '</ul>';

    // 3. a 4. vzorové dny
    dny.forEach(function (b, i) {
      h += denHtml({ den: b.den, nazvy: b.nazvy, cislo: 3 + i, nadpis: 'Vzorový den ' + (i + 1) }, i + 1);
    });
    h += '<div class="ram">' + T_SYROVE + '</div>';
    if ((data.prefs || {}).bezLepku) h += '<div class="ram">' + T_LEPEK + '</div>';
    if (data.poznamka_pod_dny) h += '<div class="ram">' + esc(bezPomlcky(data.poznamka_pod_dny)) + '</div>';

    // 5. nákupní seznam
    var nakup = nakupTyden(dny);
    if (nakup.length) {
      h += '<h2>5. Nákupní seznam na týden</h2>'
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
    h += '<h2>6. Záměny, když něco nemáš doma</h2>'
      + '<p>Vyměňuj v rámci skupiny. Gramáže jsou přepočítané na stejné kalorie, takže se nemusíš nic domýšlet.</p>';
    if (zam.length) {
      h += '<ul class="body">';
      zam.forEach(function (z) {
        h += '<li><strong>' + esc(z.label) + ':</strong> '
          + z.radek.map(function (x) { return esc(x.name) + ' ' + cz(x.gramy) + ' g'; }).join(' = ')
          + ' <span style="color:#666;">(' + cz(z.kcal) + ' kcal)</span></li>';
      });
      h += '</ul>';
    }
    h += '<p><strong>Ovoce a zelenina:</strong> cokoli za cokoli, jen u sušeného ovoce hlídej kalorie, '
      + 'těch je v malém objemu hodně.</p>';

    // 7. pravidla a vlastní den (sloučené sekce 6 a 7 z ručních ukázek)
    h += '<h2>7. Co to drží pohromadě a jak si den složíš sám</h2><ol class="body">'
      + T_PRAVIDLA.map(function (x) { return '<li><strong>' + x[0] + '</strong> ' + x[1] + '</li>'; }).join('')
      + '</ol>'
      + '<p style="margin-top:10px;">Až budeš chtít den poskládat po svém, postup je pořád stejný:</p><ol class="body">'
      + T_SLOZ_SI.map(function (x) { return '<li><strong>' + x[0] + '</strong> ' + x[1] + '</li>'; }).join('')
      + '</ol>';

    // 8. výpadek z plánu
    h += '<h2>8. Když se přejím nebo vypadnu z plánu</h2>' + odstavce(T_VYPADEK);

    // 9. etiketa
    h += '<h2>9. Jak číst etiketu</h2><ul class="body">'
      + T_ETIKETA.map(function (x) { return '<li>' + x + '</li>'; }).join('')
      + '</ul>';

    // na závěr
    if (t.na_zaver) h += '<h2>Na závěr</h2>' + odstavce(bezPomlcky(t.na_zaver));
    h += '<p>Kdyby ti cokoli nesedlo, nebo něco z plánu prostě nejíš, napiš mi a vyměníme to. '
      + 'Plán se má přizpůsobit tobě, ne naopak.</p>'
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
