// ŠABLONA TRÉNINKOVÉHO PLÁNU NA MÍRU (admin, karta klienta)
//
// Sourozenec `pruvodce-sablona.js`. Vyrábí hotový HTML dokument, který Martin buď
// vytiskne do PDF, nebo uloží klientovi do jeho sekce (bucket `client-docs`).
// Styl je záměrně TOTOŽNÝ s nutričním průvodcem: klient dostává dva dokumenty od
// stejného člověka, takže mají vypadat jako jedna sada, ne jako dva různé nástroje.
//
// ⛔ ČÍSLA SEM CHODÍ HOTOVÁ. Tenhle soubor nepočítá nic. Cviky, série, opakování, pauzy,
// RIR, tempo, náhrady, rozvrh týdne i čtyřtýdenní progresi počítá `WorkoutGen.assembleProgram`
// (assets/workout-gen.js), texty píše člověk nebo AI. „Engine počítá, AI mluví."
//
// ⛔ PEVNÉ TEXTY (jak číst tabulku, kdy přidat, když vynecháš) PSAL ČLOVĚK, ne AI.
// Kdo je bude měnit, ať projde `_Claude-dokumenty/HLAS-MARTINA.md`: žádná dlouhá pomlčka,
// žádné „není X, je Y", žádné paralelní trojky.
//
// Závislost: window.WorkoutGen (kvůli `assembleProgram`).
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
  function cz(n) {
    if (n === null || n === undefined || n === '') return 'neuvedeno';
    return String(Math.round(Number(n) || 0));
  }

  // ---- ⛔ POJISTKA NA DLOUHOU POMLČKU ----
  // Stejná jako v nutričním průvodci. Každý AI přepis ji vrací, i když ji prompt zakazuje,
  // a tenhle dokument jde ven pod Martinovým jménem.
  function bezPomlcky(s) { return String(s == null ? '' : s).split('—').join(' - '); }

  // ---- pevné texty (psal člověk, viz hlavička) ----
  // ⛔ Psané BEZRODĚ, stejně jako v nutričním průvodci po revizi 2. 9. 2026. Klientka nemá
  // dostat dokument v mužském rodě jen proto, že se to při psaní nezvážilo.
  var T_JAK_CIST = [
    ['Série × opakování.', 'První číslo je počet sérií, druhé rozsah opakování. Trefit se do rozsahu je cíl, ne povinnost. Když uděláš o jedno míň, není to zkažený trénink.'],
    ['Pauza.', 'Doba mezi sériemi. Kratší pauza nespálí víc kalorií, jenom ti sníží váhu, kterou v další sérii zvedneš.'],
    ['Záloha.', 'Kolik opakování bys ještě zvládl, kdybys musel. „2 v záloze" znamená, že po poslední sérii máš pocit, že dvě bys ještě dal. Podle toho vol váhu.'],
    ['Tempo.', 'Tři čísla: sekundy dolů, sekundy dole, sekundy nahoru. Spouštění dělá největší část práce a odbývá se nejčastěji.'],
    ['Náhrada.', 'Když je stroj obsazený nebo ti cvik nesedne, vezmi ten v posledním sloupci. Trénuje tutéž partii stejným pohybem.']
  ];
  var T_KDY_PRIDAT =
    'Zátěž se nepřidává podle kalendáře, ale podle toho, co jsi zvládl.\n\n' +
    'Pravidlo je jednoduché: když se u cviku dostaneš na HORNÍ hranici opakování ve všech sériích ' +
    'a v poslední sérii ti pořád zbývají dvě opakování v záloze, příště přidej nejmenší možnou váhu ' +
    'a vrať se na spodní hranici rozsahu. U jednoručky do 8 kg to je půl kila, u velké činky 2,5 kg.\n\n' +
    'U cviků s vlastní vahou (kliky, shyby, dipy) se přidávají opakování. Až se dostaneš nad horní ' +
    'hranici i v poslední sérii, ztíži si provedení: nohy na vyvýšení, pomalejší spouštění, pauza dole.\n\n' +
    'Když tři tréninky po sobě stojíš na stejném čísle, není to lenost. Ubereš asi 10 % váhy, ' +
    'týden jedeš lehčeji a pak se rozjedeš znovu. Appka Tvůj Coach ti tohle hlídá sama a řekne to ' +
    'u konkrétního cviku.';
  var T_VYNECHAS =
    'Vynechaný trénink se nenahání dvojitou dávkou. Dvě náročné jednotky za sebou ti seberou ' +
    'víc, než ten jeden vynechaný týden stál.\n\n' +
    'Co s tím: pokračuj tam, kde jsi skončil, jen si posuň dny. Blok má čtyři týdny, ne čtyři pevné termíny. ' +
    'Když vypadneš na víc než deset dní, začni znovu prvním týdnem a vem si o něco nižší váhy, ' +
    'ať máš kam růst.\n\n' +
    'Když ti pravidelně padá tentýž den v týdnu, nemá cenu to řešit vůlí. Napiš mi to a rozvrh přehodíme.';
  var T_BOLEST =
    '<strong>Kdy trénink zastavit:</strong> ostrá bolest v kloubu, bolest, která pokračuje i po rozehřátí, ' +
    'brnění nebo výpadek síly. Tohle se nepřechází a nedá se to procvičit. ' +
    'Svalová bolest den po tréninku je něco jiného a je v pořádku. ' +
    'Když si nejsi jistý, napiš mi to a než se ozvu, ten cvik vynech nebo použij náhradu.';
  var T_KNIHOVNA =
    '<strong>Nevíš, jak cvik vypadá?</strong> V Academy je databáze všech 125 cviků s popisem provedení ' +
    'a s nejčastějšími chybami: <a href="https://martinbarna.cz/akademie/cviky/">martinbarna.cz/akademie/cviky</a>. ' +
    'Vyhledej cvik podle názvu z tabulky, jsou psané stejně. Stejnou databázi máš i v appce Tvůj Coach, ' +
    'kde si rovnou zapíšeš série a appka ti pak řekne, kolik zkusit příště.';

  // ---- styl ----
  // ⛔ Prvních dvacet řádků je bajtově shodných s `pruvodce-sablona.js`. Je to záměr:
  // dva dokumenty od téhož člověka mají vypadat stejně. Kdo mění vzhled, mění OBA soubory.
  var STYL = [
    '@page { size: A4; margin: 18mm 16mm; }',
    // ⛔ Bez `color-scheme` a `background` vykreslí prohlížeč v tmavém režimu černé pozadí
    // pod černým textem a dokument je nečitelný. Na papíře se nic nemění.
    'html { color-scheme: light; }',
    'body { background: #fff; font-family: "Segoe UI", Arial, sans-serif; color: #1a1a1a; font-size: 11pt; line-height: 1.45; }',
    'h1 { font-size: 20pt; margin: 0 0 2px; }',
    '.kdo { color: #E07B39; font-weight: 700; font-size: 12pt; margin: 0 0 2px; }',
    '.pripravil { font-style: italic; font-size: 9.5pt; color: #555; margin: 0 0 6px; }',
    'hr.top { border: none; border-top: 2px solid #E07B39; margin: 0 0 14px; }',
    'h2 { font-size: 13.5pt; margin: 22px 0 4px; padding-bottom: 3px; border-bottom: 1.5px solid #E07B39; }',
    'h3 { font-size: 11.5pt; margin: 14px 0 2px; color: #E07B39; }',
    'table { border-collapse: collapse; width: 100%; margin: 8px 0; }',
    'th { background: #FBE3D4; text-align: left; padding: 6px 8px; border: 1px solid #E0C4B0; font-size: 10.5pt; }',
    'td { padding: 6px 8px; border: 1px solid #E0C4B0; font-size: 10.5pt; }',
    '.ram { background: #FDF3EC; border: 1px solid #E07B39; padding: 8px 10px; margin: 10px 0; font-size: 10pt; }',
    'ul.body { margin: 4px 0 0 0; padding-left: 18px; }',
    'ul.body li { margin-bottom: 5px; }',
    'ol.body { margin: 4px 0 0 0; padding-left: 20px; }',
    'ol.body li { margin-bottom: 5px; }',
    '.pata { border-top: 1.5px solid #E07B39; margin-top: 26px; padding-top: 6px; text-align: center; font-size: 8.5pt; color: #666; }',
    '.zlom { page-break-before: always; }',
    '.tip { font-style: italic; font-size: 9.5pt; color: #555; margin: 2px 0 8px; }',
    '.jen-martin { border: 2px dashed #999; background: #FAFAFA; padding: 10px 12px; margin-top: 14px; }',
    '.jen-martin h2 { border-color: #999; color: #444; }',
    // ⛔ Tisk: tlačítko se nesmí objevit na papíře ani v PDF.
    '@media print { .netisknout { display: none !important; } }',
    '.netisknout { margin: 0 0 14px; }',
    '.netisknout button { font: inherit; font-size: 10pt; padding: 6px 14px; border: 1px solid #E07B39; background: #FDF3EC; color: #1a1a1a; border-radius: 6px; cursor: pointer; }',
    // vlastní pro trénink: doplňkový cvik světleji, tabulka cviků snese menší písmo
    'table.cviky td, table.cviky th { font-size: 9.5pt; padding: 5px 6px; }',
    'table.cviky td.n { color: #555; font-size: 9pt; }',
    'tr.doplnek td:first-child { color: #444; }',
    '.rozehrati { background: #F3F3F3; padding: 6px 9px; margin: 6px 0; font-size: 9.5pt; }',
    '.rozehrati ul { margin: 3px 0 0; padding-left: 18px; }',
    // ⛔ TISK: bez tohohle zůstal nadpis tréninkového dne na patě strany a jeho tabulka
    // přešla na další. Stejná ochrana jako v nutričním průvodci (nález 8 revize 2. 9. 2026).
    '@media print {',
    '  h1, h2, h3 { break-after: avoid; page-break-after: avoid; }',
    '  .den-blok { break-inside: avoid; page-break-inside: avoid; }',
    '  .ram, table, .rozehrati { break-inside: avoid; page-break-inside: avoid; }',
    '}'
  ].join('\n  ');

  // Kontrolní strana psala do věty syrové kódy z enginu („místo fitko, úroveň zacatecnik").
  // Martin je čte jako češtinu, ne jako klíče, takže se překládají.
  var VSTUP_LABEL = {
    fitko: 'posilovna', doma: 'doma', hriste: 'hřiště nebo venku',
    vse: 'všechno vybavení', cinky: 'jednoručky a kettlebell', telo: 'jen vlastní váha',
    zacatecnik: 'začátečník', pokrocily: 'pokročilý', zkuseny: 'zkušený',
    hubnuti: 'hubnutí', svaly: 'svaly (hypertrofie)', sila: 'síla', kondice: 'vytrvalost a kondice'
  };
  function lbl(k) { return VSTUP_LABEL[String(k == null ? '' : k)] || String(k == null ? '' : k); }
  /** „1 den", „3 dny", „5 dní". Bez tohohle psala kontrolní strana „3 dní". */
  function dnyText(n) {
    var x = Math.round(Number(n) || 0);
    return x + ' ' + (x === 1 ? 'den' : (x >= 2 && x <= 4 ? 'dny' : 'dní'));
  }

  var PARTIE_LABEL = {
    nohy: 'nohy', prsa: 'prsa', zada: 'záda', ramena: 'ramena', biceps: 'biceps',
    triceps: 'triceps', bricho: 'břicho', hyzde: 'hýždě', lytka: 'lýtka', full: 'celé tělo'
  };

  // ---- jeden tréninkový den ----
  function denHtml(den, prvni) {
    var h = '<div class="den-blok"><h3>' + esc(bezPomlcky(den.den)) + ' &middot; ' + esc(bezPomlcky(den.nazev)) + '</h3>';
    h += '<div class="rozehrati"><strong>Rozehřátí:</strong><ul>'
      + den.rozehrati.map(function (r) { return '<li>' + esc(bezPomlcky(r)) + '</li>'; }).join('')
      + '</ul></div>';
    h += '<table class="cviky"><tr><th>Cvik</th><th>Série × opak.</th><th>Pauza</th><th>Záloha</th><th>Tempo</th><th>Náhrada</th></tr>';
    den.cviky.forEach(function (c) {
      // Kardio finisher nemá série ani zálohu jako silový cvik, tak se to do tabulky nepíše.
      var serie = c.kardio ? esc(c.opakovani) : (cz(c.serie) + ' × ' + esc(c.opakovani));
      h += '<tr' + (c.doplnkovy ? ' class="doplnek"' : '') + '>'
        + '<td>' + esc(bezPomlcky(c.nazev)) + '<br><span class="n">' + esc(PARTIE_LABEL[c.partie] || c.partie) + '</span></td>'
        + '<td>' + serie + '</td>'
        + '<td class="n">' + esc(c.pauza) + '</td>'
        + '<td class="n">' + esc(c.rir) + '</td>'
        + '<td class="n">' + esc(c.tempo) + '</td>'
        + '<td class="n">' + esc(bezPomlcky(c.nahrada || 'zeptej se mě')) + '</td>'
        + '</tr>';
    });
    h += '</table>';
    // Tipy k provedení: jen u hlavních cviků, jinak by pod každou tabulkou byl odstavec textu.
    var tipy = den.cviky.filter(function (c) { return !c.doplnkovy && !c.kardio && c.tip; });
    if (tipy.length) {
      h += '<ul class="body" style="font-size:9.5pt;">'
        + tipy.map(function (c) { return '<li><strong>' + esc(bezPomlcky(c.nazev)) + ':</strong> ' + esc(bezPomlcky(c.tip)) + '</li>'; }).join('')
        + '</ul>';
    }
    h += '</div>';
    return prvni ? h : h;
  }

  // ---- kontrolní strana (JEN PRO MARTINA) ----
  // Ukazuje, co engine dostal a jak vyšel objem po partiích. Tichá chyba v objemu je přesně
  // to, co v hotovém dokumentu nikdo nepozná: klient vidí seznam cviků, ne součet sérií.
  function kontrolaHtml(data) {
    var p = data.program || {};
    var v = data.vstup || {};
    var ZONA = { low: 'málo', building: 'optimum', high: 'strop', over: 'PŘEPAL' };
    var h = '<div class="jen-martin zlom"><h2>Kontrolní strana (jen pro Martina)</h2>'
      + '<p style="font-size:10pt;margin:0 0 6px;">Tahle strana se do souboru pro klienta neukládá. '
      + 'Je tu proto, aby šlo na jeden pohled poznat, že plán minul zadání.</p>'
      + '<table><tr><th>Partie</th><th>Série/týden</th><th>MEV</th><th>MAV</th><th>MRV</th><th>Zóna</th></tr>';
    (p.objem || []).forEach(function (r) {
      var barva = r.zone === 'over' ? '#b00' : (r.zone === 'low' ? '#a60' : '#1a1a1a');
      h += '<tr><td>' + esc(r.label) + '</td><td>' + String(r.sets).replace('.', ',') + '</td>'
        + '<td>' + r.lm.mev + '</td><td>' + r.lm.mav + '</td><td>' + r.lm.mrv + '</td>'
        + '<td style="color:' + barva + ';">' + (ZONA[r.zone] || r.zone) + '</td></tr>';
    });
    h += '</table>';
    h += '<p style="font-size:10pt;">Zadání do generátoru: <strong>' + esc(dnyText(v.dny_treninku)) + '</strong>, '
      + 'místo <strong>' + esc(lbl(v.kde_cvici)) + '</strong>, vybavení <strong>' + esc(lbl(v.vybaveni)) + '</strong>, '
      + 'úroveň <strong>' + esc(lbl(v.level)) + '</strong>, cíl <strong>' + esc(lbl(v.cil)) + '</strong>, '
      + 'seed <strong>' + esc(String(v.seed == null ? 0 : v.seed)) + '</strong> (se stejným zadáním a seedem vznikne totožný plán).</p>';
    h += '<p style="font-size:10pt;">Vyloučené partie: <strong>' + ((v.vyloucene_partie || []).length ? esc((v.vyloucene_partie || []).join(', ')) : 'žádné') + '</strong>.<br>'
      + 'Vyloučené cviky (' + ((v.vyloucene_cviky || []).length) + '): '
      + ((v.vyloucene_cviky || []).length ? esc((v.vyloucene_cviky || []).join(', ')) : 'žádné') + '.</p>';
    h += '<p style="font-size:10pt;">⛔ Zdravotní omezení z dotazníku je volný text a engine ho NEČTE. '
      + 'Do plánu se promítne jen to, co je ve výčtu výš, tedy to, co jsi odklikl.</p>';
    if ((p.poznamky || {}).sport) h += '<p style="font-size:10pt;">' + esc(bezPomlcky(p.poznamky.sport)) + '</p>';
    h += '</div>';
    return h;
  }

  /**
   * Vyrobí celý dokument.
   * @param {object} data  { jmeno, osloveni, datum, program (z WorkoutGen.assembleProgram),
   *                         vstup (co šlo do enginu), texty: { uvod, zaver, poznamka } }
   * @param {object} opts  { proMartina: true = přidá kontrolní stranu a tlačítko Tisk }
   */
  function render(data, opts) {
    opts = opts || {};
    data = data || {};
    var p = data.program || { rozvrh: [], progrese: [], poznamky: {}, omezeni: [] };
    var t = data.texty || {};
    var jmeno = bezPomlcky(data.jmeno || '');

    var h = '<!doctype html>\n<html lang="cs">\n<head>\n<meta charset="utf-8">\n'
      + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
      + '<title>' + esc('Tvůj tréninkový plán na míru' + (jmeno ? ' - ' + jmeno : '')) + '</title>\n'
      + '<style>\n  ' + STYL + '\n</style>\n</head>\n<body>\n';

    if (opts.proMartina) {
      h += '<div class="netisknout"><button onclick="window.print()">Vytisknout nebo uložit jako PDF</button> '
        + '<span style="font-size:9.5pt;color:#666;">V dialogu tisku vyber „Uložit jako PDF".</span></div>\n';
    }

    h += '<h1>Tvůj tréninkový plán na míru</h1>\n'
      + '<p class="kdo">' + esc(jmeno) + (jmeno ? ' &middot; ' : '') + 'trénink</p>\n'
      + '<p class="pripravil">Připravil Martin Barna, Online Výživa a Fitness'
      + (data.datum ? ' &middot; ' + esc(data.datum) : '') + '</p>\n'
      + '<hr class="top">\n';

    // Prázdné oslovení dávalo „Ahoj !". Bez jména se pozdraví obecně, stejně jako v průvodci.
    var osl = bezPomlcky(String(data.osloveni || '').trim());
    h += '<p>Ahoj' + (osl ? ' ' + esc(osl) : '') + '! 👋</p>\n' + odstavce(bezPomlcky(t.uvod));

    // 1. rozvrh týdne
    h += '<h2>1. Tvůj týden</h2>'
      + '<p>Takhle mají tréninky padnout do týdne. Dny si můžeš posunout, jen mezi dvěma tréninky '
      + 'nech aspoň jeden volný den, když trénuješ tutéž partii.</p>'
      + '<table><tr><th>Den</th><th>Trénink</th><th>Kolik cviků</th></tr>';
    p.rozvrh.forEach(function (d) {
      h += '<tr><td>' + esc(bezPomlcky(d.den)) + '</td><td>' + esc(bezPomlcky(d.nazev)) + '</td><td>'
        + d.cviky.length + '</td></tr>';
    });
    h += '</table>';
    h += '<p class="tip">Režim: ' + esc(bezPomlcky((p.cil || {}).label || '')) + '. Pauzy u hlavních cviků '
      + esc(bezPomlcky((p.cil || {}).rest || '')) + '.</p>';
    if ((p.omezeni || []).length) {
      h += '<div class="ram">' + p.omezeni.map(function (o) { return esc(bezPomlcky(o)); }).join('<br>') + '</div>';
    }
    if (t.poznamka) h += '<div class="ram">' + esc(bezPomlcky(t.poznamka)) + '</div>';

    // 2. jak číst tabulku
    h += '<h2>2. Jak číst tabulku</h2><ul class="body">'
      + T_JAK_CIST.map(function (x) { return '<li><strong>' + x[0] + '</strong> ' + x[1] + '</li>'; }).join('')
      + '</ul>';

    // 3. samotné tréninky
    h += '<h2 class="zlom">3. Tréninky</h2>';
    p.rozvrh.forEach(function (d, i) { h += denHtml(d, i === 0); });

    // 4. progrese na čtyři týdny
    h += '<h2 class="zlom">4. Čtyři týdny, jak jdou za sebou</h2>'
      + '<p>Plán se čtyři týdny nemění v cvicích, mění se v tom, jak blízko chodíš k hranici. '
      + 'Čtvrtý týden je lehčí schválně, tam se posun z předchozích tří týdnů dorovná.</p>'
      + '<table><tr><th>Týden</th><th>Co se mění</th><th>Záloha v poslední sérii</th></tr>';
    p.progrese.forEach(function (w) {
      h += '<tr><td><strong>' + w.tyden + '.</strong>' + (w.deload ? '<br><span class="n">lehčí týden</span>' : '') + '</td>'
        + '<td>' + esc(bezPomlcky(w.popis)) + '</td><td>' + esc(bezPomlcky(w.rir)) + '</td></tr>';
    });
    h += '</table>'
      + '<p>Po čtvrtém týdnu se ozvi. Podíváme se na čísla ze zápisů a buď plán posuneme, '
      + 'nebo vyměníme cviky, na kterých to přestalo růst.</p>';

    // 5. kdy přidat zátěž
    h += '<h2>5. Jak poznáš, že máš přidat</h2>' + odstavce(T_KDY_PRIDAT);

    // 6. když vynecháš
    h += '<h2>6. Když vynecháš trénink</h2>' + odstavce(T_VYNECHAS);

    // 7. bezpečnost a knihovna cviků
    h += '<h2>7. Bezpečnost a kde si cvik prohlédneš</h2>'
      + '<div class="ram">' + T_BOLEST + '</div>'
      + '<div class="ram">' + T_KNIHOVNA + '</div>'
      + '<p>' + esc(bezPomlcky((p.poznamky || {}).rozehrati || '')) + '</p>';

    // na závěr
    if (t.zaver) h += '<h2>Na závěr</h2>' + odstavce(bezPomlcky(t.zaver));
    h += '<p>Kdyby ti kterýkoli cvik nesedl, napiš mi a vyměníme ho. '
      + 'Plán se má přizpůsobit tobě.</p>'
      + '<p><strong>Be Effective!</strong><br>Martin</p>'
      + '<div class="pata">Martin Barna, Online Výživa a Fitness &middot; martinbarna.cz &middot; Be Effective!</div>';

    if (opts.proMartina) h += kontrolaHtml(data);

    return h + '\n</body>\n</html>';
  }

  global.TreninkSablona = { render: render, bezPomlcky: bezPomlcky };
})(window);
