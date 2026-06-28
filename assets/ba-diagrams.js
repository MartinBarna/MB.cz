/* Barna Academy — knihovna brandovaných SVG diagramů.
   Použití v lekci:  <figure class="ba-fig" data-fig="KLIC"><figcaption>Popisek</figcaption></figure>
   + na konci stránky:  <script src="/assets/ba-diagrams.js?v=20260628a"></script>
   Vylepšení diagramu = úprava TADY → projeví se ve všech lekcích.
   Paleta: gold #ff7a00 / #ffa450, bílá #fff, muted #a89e94, zelená #2fae57, modrá #5aa9e6. */
(function () {
  var G = '#ff7a00', GS = '#ffa450', W = '#ffffff', M = '#a89e94', GR = '#2fae57', BL = '#5aa9e6', LN = 'rgba(255,255,255,.14)';
  var F = 'font-family:Poppins,system-ui,sans-serif';

  var FIGS = {

  // ENERGETICKÁ BILANCE — váha příjem vs výdej + tři stavy
  'energy-balance':
    '<svg viewBox="0 0 600 250" role="img" aria-label="Energetická bilance">' +
      '<text x="300" y="26" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:17px">ENERGETICKÁ BILANCE</text>' +
      // beam
      '<line x1="120" y1="80" x2="480" y2="80" stroke="'+G+'" stroke-width="5" stroke-linecap="round"/>' +
      '<polygon points="300,80 288,118 312,118" fill="'+G+'"/>' +
      '<rect x="294" y="118" width="12" height="40" fill="'+G+'"/>' +
      // left pan IN
      '<line x1="120" y1="80" x2="120" y2="120" stroke="'+M+'" stroke-width="2"/>' +
      '<path d="M70 120 h100 a50 30 0 0 1 -100 0 z" fill="rgba(255,122,0,.18)" stroke="'+G+'" stroke-width="2"/>' +
      '<text x="120" y="150" text-anchor="middle" fill="'+GS+'" style="'+F+';font-weight:800;font-size:14px">PŘÍJEM</text>' +
      '<text x="120" y="168" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">jídlo &amp; pití</text>' +
      // right pan OUT
      '<line x1="480" y1="80" x2="480" y2="120" stroke="'+M+'" stroke-width="2"/>' +
      '<path d="M430 120 h100 a50 30 0 0 1 -100 0 z" fill="rgba(90,169,230,.16)" stroke="'+BL+'" stroke-width="2"/>' +
      '<text x="480" y="150" text-anchor="middle" fill="'+BL+'" style="'+F+';font-weight:800;font-size:14px">VÝDEJ</text>' +
      '<text x="480" y="168" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">BMR + pohyb + trávení</text>' +
      // three states
      '<g transform="translate(0,196)">' +
      '<text x="120" y="0" text-anchor="middle" fill="'+GR+'" style="'+F+';font-weight:700;font-size:12px">PŘÍJEM &lt; VÝDEJ</text>' +
      '<text x="120" y="16" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">→ hubnutí</text>' +
      '<text x="300" y="0" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:700;font-size:12px">PŘÍJEM = VÝDEJ</text>' +
      '<text x="300" y="16" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">→ udržení</text>' +
      '<text x="480" y="0" text-anchor="middle" fill="'+GS+'" style="'+F+';font-weight:700;font-size:12px">PŘÍJEM &gt; VÝDEJ</text>' +
      '<text x="480" y="16" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">→ nabírání</text>' +
      '</g>' +
    '</svg>',

  // TDEE — donut: z čeho se skládá denní výdej
  'tdee-pie':
    '<svg viewBox="0 0 600 260" role="img" aria-label="Z čeho se skládá denní výdej energie (TDEE)">' +
      '<text x="300" y="26" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:17px">Z ČEHO SE SKLÁDÁ TVŮJ VÝDEJ (TDEE)</text>' +
      // donut segments via stroke-dasharray, circumference ~ 2*pi*70=440
      '<g transform="translate(170,140)">' +
      '<circle r="70" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="34"/>' +
      '<circle r="70" fill="none" stroke="'+G+'"  stroke-width="34" stroke-dasharray="286 154" transform="rotate(-90)"/>' +      // BMR 65%
      '<circle r="70" fill="none" stroke="'+BL+'" stroke-width="34" stroke-dasharray="66 374" stroke-dashoffset="-286" transform="rotate(-90)"/>' + // NEAT 15%
      '<circle r="70" fill="none" stroke="'+GR+'" stroke-width="34" stroke-dasharray="44 396" stroke-dashoffset="-352" transform="rotate(-90)"/>' + // EAT 10%
      '<circle r="70" fill="none" stroke="'+GS+'" stroke-width="34" stroke-dasharray="44 396" stroke-dashoffset="-396" transform="rotate(-90)"/>' + // TEF 10%
      '<text x="0" y="-2" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:15px">TDEE</text>' +
      '<text x="0" y="16" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:10px">100 %</text>' +
      '</g>' +
      // legend
      '<g transform="translate(310,80)" style="'+F+'">' +
      '<rect x="0" y="0" width="14" height="14" rx="3" fill="'+G+'"/><text x="22" y="12" fill="'+W+'" font-size="13" font-weight="700">BMR ~65 %</text><text x="22" y="28" fill="'+M+'" font-size="10.5">základní chod těla</text>' +
      '<rect x="0" y="42" width="14" height="14" rx="3" fill="'+BL+'"/><text x="22" y="54" fill="'+W+'" font-size="13" font-weight="700">NEAT ~15 %</text><text x="22" y="70" fill="'+M+'" font-size="10.5">běžný pohyb, kroky</text>' +
      '<rect x="0" y="84" width="14" height="14" rx="3" fill="'+GR+'"/><text x="22" y="96" fill="'+W+'" font-size="13" font-weight="700">Trénink ~10 %</text><text x="22" y="112" fill="'+M+'" font-size="10.5">cílené cvičení</text>' +
      '<rect x="0" y="126" width="14" height="14" rx="3" fill="'+GS+'"/><text x="22" y="138" fill="'+W+'" font-size="13" font-weight="700">Trávení ~10 %</text><text x="22" y="154" fill="'+M+'" font-size="10.5">termický efekt jídla</text>' +
      '</g>' +
    '</svg>',

  // MAKRA — kolik kcal na gram
  'macros':
    '<svg viewBox="0 0 600 230" role="img" aria-label="Kalorická hodnota makroživin">' +
      '<text x="300" y="26" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:17px">KOLIK ENERGIE MÁ 1 GRAM</text>' +
      barG(70,'Bílkoviny','4 kcal',4,GR) +
      barG(200,'Sacharidy','4 kcal',4,GS) +
      barG(330,'Tuky','9 kcal',9,G) +
      barG(460,'Alkohol','7 kcal',7,BL) +
      '<text x="300" y="222" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">Tuk má 2× víc energie než bílkovina či sacharid — proto „hutná“ jídla nabíjejí rychle.</text>' +
    '</svg>',

  // TALÍŘ — metoda skládání jídla
  'plate-method':
    '<svg viewBox="0 0 600 270" role="img" aria-label="Metoda talíře">' +
      '<text x="300" y="26" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:17px">METODA TALÍŘE — bez vážení</text>' +
      '<g transform="translate(170,150)">' +
      '<circle r="92" fill="#0c0c0c" stroke="'+M+'" stroke-width="3"/>' +
      // half veg
      '<path d="M0 0 L0 -92 A92 92 0 0 0 0 92 Z" fill="rgba(47,174,87,.30)" stroke="'+GR+'" stroke-width="2"/>' +
      // quarter protein
      '<path d="M0 0 L0 -92 A92 92 0 0 1 92 0 Z" fill="rgba(255,122,0,.30)" stroke="'+G+'" stroke-width="2"/>' +
      // quarter carbs
      '<path d="M0 0 L92 0 A92 92 0 0 1 0 92 Z" fill="rgba(255,164,80,.28)" stroke="'+GS+'" stroke-width="2"/>' +
      '<text x="-46" y="-4" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:12px">½</text>' +
      '<text x="40" y="-40" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:12px">¼</text>' +
      '<text x="40" y="48" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:12px">¼</text>' +
      '</g>' +
      '<g transform="translate(300,90)" style="'+F+'">' +
      '<rect x="0" y="0" width="14" height="14" rx="3" fill="'+GR+'"/><text x="22" y="12" fill="'+W+'" font-size="13" font-weight="700">½ talíře — zelenina</text><text x="22" y="28" fill="'+M+'" font-size="10.5">objem, vláknina, sytost</text>' +
      '<rect x="0" y="46" width="14" height="14" rx="3" fill="'+G+'"/><text x="22" y="58" fill="'+W+'" font-size="13" font-weight="700">¼ — bílkovina</text><text x="22" y="74" fill="'+M+'" font-size="10.5">dlaň: maso, ryba, tvaroh</text>' +
      '<rect x="0" y="92" width="14" height="14" rx="3" fill="'+GS+'"/><text x="22" y="104" fill="'+W+'" font-size="13" font-weight="700">¼ — sacharidy</text><text x="22" y="120" fill="'+M+'" font-size="10.5">rýže, brambory, těstoviny</text>' +
      '<text x="0" y="150" fill="'+M+'" font-size="10.5">+ palec tuku (olej, ořechy)</text>' +
      '</g>' +
    '</svg>',

  // KOSTRA — zjednodušený přehled hlavních kostí
  'skeleton':
    '<svg viewBox="0 0 600 320" role="img" aria-label="Kosterní systém — hlavní kosti">' +
      '<text x="300" y="24" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:17px">KOSTERNÍ SYSTÉM — opora pohybu</text>' +
      '<g transform="translate(300,0)" stroke="'+GS+'" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="0" cy="58" r="22" fill="rgba(255,255,255,.05)"/>' +              // lebka
      '<line x1="0" y1="80" x2="0" y2="200"/>' +                                     // páteř
      '<path d="M-30 110 H30 M-34 126 H34 M-32 142 H32 M-26 158 H26"/>' +           // žebra
      '<line x1="-52" y1="100" x2="52" y2="100"/>' +                                 // klíční/ramena
      '<line x1="-52" y1="100" x2="-66" y2="170"/><line x1="-66" y1="170" x2="-60" y2="232"/>' + // L paže
      '<line x1="52" y1="100" x2="66" y2="170"/><line x1="66" y1="170" x2="60" y2="232"/>' +     // P paže
      '<path d="M-30 200 H30 L26 222 H-26 Z" fill="rgba(255,255,255,.05)"/>' +       // pánev
      '<line x1="-16" y1="222" x2="-22" y2="300"/><line x1="16" y1="222" x2="22" y2="300"/>' +   // nohy
      '</g>' +
      '<g style="'+F+'" fill="'+M+'" font-size="11.5">' +
      label(196,62,'Lebka',1)+ label(196,118,'Žebra (hrudník)',1)+ label(196,180,'Páteř',1)+ label(196,214,'Pánev',1)+
      label(404,104,'Ramenní pletenec',0)+ label(404,176,'Kosti paže',0)+ label(404,290,'Stehenní kost',0)+
      '</g>' +
    '</svg>',

  // SVALY ZEPŘEDU
  'muscles-front':
    '<svg viewBox="0 0 600 330" role="img" aria-label="Hlavní svalové skupiny zepředu">' +
      '<text x="300" y="24" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:17px">SVALY — pohled zepředu</text>' +
      bodySilhouette() +
      '<g style="'+F+'" fill="'+M+'" font-size="11.5">' +
      label(196,96,'Ramena (deltové)',1)+ label(196,132,'Prsní svaly',1)+ label(196,176,'Břišní svaly',1)+ label(196,230,'Čtyřhlavý stehna',1)+
      label(404,150,'Biceps',0)+ label(404,196,'Předloktí',0)+ label(404,290,'Holenní sval',0)+
      '</g>' +
    '</svg>',

  // SVALY ZEZADU
  'muscles-back':
    '<svg viewBox="0 0 600 330" role="img" aria-label="Hlavní svalové skupiny zezadu">' +
      '<text x="300" y="24" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:17px">SVALY — pohled zezadu</text>' +
      bodySilhouette() +
      '<g style="'+F+'" fill="'+M+'" font-size="11.5">' +
      label(196,96,'Trapéz',1)+ label(196,140,'Široký sval zádový',1)+ label(196,210,'Hýžďové svaly',1)+ label(196,250,'Hamstringy',1)+
      label(404,150,'Triceps',0)+ label(404,292,'Lýtka',0)+
      '</g>' +
    '</svg>',

  // SVALOVÁ VLÁKNA — typ I vs typ II
  'muscle-fibers':
    '<svg viewBox="0 0 600 220" role="img" aria-label="Typy svalových vláken">' +
      '<text x="300" y="26" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:17px">TYPY SVALOVÝCH VLÁKEN</text>' +
      '<g transform="translate(40,50)">' +
      '<rect width="240" height="140" rx="14" fill="rgba(90,169,230,.10)" stroke="'+BL+'" stroke-width="1.5"/>' +
      '<text x="120" y="30" text-anchor="middle" fill="'+BL+'" style="'+F+';font-weight:800;font-size:14px">TYP I — pomalá</text>' +
      '<text x="120" y="58" text-anchor="middle" fill="'+W+'" style="'+F+';font-size:12px">vytrvalost, výdrž</text>' +
      '<text x="120" y="80" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">pomalá únava · málo síly</text>' +
      '<text x="120" y="106" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">chůze, držení postury,</text>' +
      '<text x="120" y="122" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">dlouhé série</text>' +
      '</g>' +
      '<g transform="translate(320,50)">' +
      '<rect width="240" height="140" rx="14" fill="rgba(255,122,0,.10)" stroke="'+G+'" stroke-width="1.5"/>' +
      '<text x="120" y="30" text-anchor="middle" fill="'+GS+'" style="'+F+';font-weight:800;font-size:14px">TYP II — rychlá</text>' +
      '<text x="120" y="58" text-anchor="middle" fill="'+W+'" style="'+F+';font-size:12px">síla a výkon</text>' +
      '<text x="120" y="80" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">rychlá únava · hodně síly</text>' +
      '<text x="120" y="106" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">sprint, skok, těžké</text>' +
      '<text x="120" y="122" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">zvedání, výbuch</text>' +
      '</g>' +
    '</svg>',

  // ENERGETICKÉ SYSTÉMY — časová osa
  'energy-systems':
    '<svg viewBox="0 0 600 220" role="img" aria-label="Energetické systémy podle času">' +
      '<text x="300" y="26" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:17px">ENERGETICKÉ SYSTÉMY — podle délky zátěže</text>' +
      sysBar(60,'ATP-CP','0–10 s','výbuch, max síla',G,150) +
      sysBar(110,'Glykolytický','10 s – 2 min','intenzivní série',GS,300) +
      sysBar(160,'Aerobní','2 min a víc','vytrvalost',BL,470) +
      '<line x1="60" y1="195" x2="540" y2="195" stroke="'+LN+'" stroke-width="1"/>' +
      '<text x="60" y="210" fill="'+M+'" style="'+F+';font-size:10px">0 s</text>' +
      '<text x="300" y="210" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:10px">délka úsilí →</text>' +
      '<text x="540" y="210" text-anchor="end" fill="'+M+'" style="'+F+';font-size:10px">minuty+</text>' +
    '</svg>',

  // PROGRESIVNÍ PŘETÍŽENÍ — rostoucí zátěž
  'progressive-overload':
    '<svg viewBox="0 0 600 220" role="img" aria-label="Progresivní přetížení">' +
      '<text x="300" y="26" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:17px">PROGRESIVNÍ PŘETÍŽENÍ</text>' +
      '<line x1="60" y1="180" x2="560" y2="180" stroke="'+LN+'" stroke-width="1.5"/>' +
      growBar(90,60)+growBar(170,82)+growBar(250,100)+growBar(330,118)+growBar(410,138)+growBar(490,158)+
      '<path d="M70 168 L540 60" stroke="'+G+'" stroke-width="2.5" stroke-dasharray="5 5" fill="none"/>' +
      '<polygon points="540,60 528,62 534,74" fill="'+G+'"/>' +
      '<text x="60" y="200" fill="'+M+'" style="'+F+';font-size:11px">týden 1</text>' +
      '<text x="300" y="200" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">postupně přidávej zátěž / opakování / série</text>' +
      '<text x="540" y="200" text-anchor="end" fill="'+M+'" style="'+F+';font-size:11px">→ čas</text>' +
    '</svg>',

  // DEFICIT / UDRŽENÍ / PŘEBYTEK
  'deficit-surplus':
    '<svg viewBox="0 0 600 200" role="img" aria-label="Deficit, udržení, přebytek">' +
      '<text x="300" y="26" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:17px">TŘI REŽIMY ENERGIE</text>' +
      stateCol(110,'DEFICIT','jíš míň, než vydáš','→ hubneš',GR,80) +
      stateCol(300,'UDRŽENÍ','příjem = výdej','→ držíš váhu',W,110) +
      stateCol(490,'PŘEBYTEK','jíš víc, než vydáš','→ nabíráš',GS,140) +
    '</svg>',

  // SYTOST MAKER
  'protein-satiety':
    '<svg viewBox="0 0 600 210" role="img" aria-label="Sytost podle makroživiny">' +
      '<text x="300" y="26" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:17px">CO TĚ NEJVÍC ZASYTÍ</text>' +
      satBar(70,'Bílkovina',150,GR,'nejvíc') +
      satBar(240,'Vláknina + zelenina',120,GS,'hodně') +
      satBar(410,'Sacharidy / tuky',62,G,'míň') +
      '<text x="300" y="200" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">Bílkovina + objem zeleniny = najíš se a přitom sníš míň kalorií.</text>' +
    '</svg>',

  // SPÁNEK A HORMONY HLADU
  'sleep-hormones':
    '<svg viewBox="0 0 600 220" role="img" aria-label="Spánek a hormony hladu">' +
      '<text x="300" y="26" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:17px">MÁLO SPÁNKU → VĚTŠÍ HLAD</text>' +
      '<g transform="translate(80,70)">' +
      '<rect width="150" height="100" rx="14" fill="rgba(90,169,230,.10)" stroke="'+BL+'" stroke-width="1.5"/>' +
      '<text x="75" y="34" text-anchor="middle" fill="'+BL+'" style="'+F+';font-weight:800;font-size:14px">🌙 málo spánku</text>' +
      '<text x="75" y="62" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">&lt; 6–7 hodin</text>' +
      '<text x="75" y="82" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">nepravidelný režim</text>' +
      '</g>' +
      '<g transform="translate(370,52)" style="'+F+'">' +
      '<text x="0" y="6" fill="'+GS+'" font-size="13" font-weight="800">↑ Ghrelin</text><text x="92" y="6" fill="'+M+'" font-size="11">hormon hladu</text>' +
      '<text x="0" y="46" fill="'+BL+'" font-size="13" font-weight="800">↓ Leptin</text><text x="92" y="46" fill="'+M+'" font-size="11">hormon sytosti</text>' +
      '<text x="0" y="86" fill="'+GS+'" font-size="13" font-weight="800">↑ Chuť</text><text x="92" y="86" fill="'+M+'" font-size="11">hlavně na sladké</text>' +
      '<text x="0" y="120" fill="'+W+'" font-size="12" font-weight="700">= těžší držet deficit</text>' +
      '</g>' +
      '<path d="M232 120 H360" stroke="'+G+'" stroke-width="2.5" fill="none"/><polygon points="360,120 348,114 348,126" fill="'+G+'"/>' +
    '</svg>',

  // PERIODIZACE — bloky v roce
  'periodization':
    '<svg viewBox="0 0 600 200" role="img" aria-label="Periodizace tréninku">' +
      '<text x="300" y="26" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:17px">PERIODIZACE — stavba v čase</text>' +
      blockBar(50,'AKUMULACE','objem',GR,130) +
      blockBar(190,'INTENZIFIKACE','zátěž',GS,130) +
      blockBar(330,'REALIZACE','výkon',G,130) +
      blockBar(470,'DELOAD','regenerace',BL,80) +
      '<text x="300" y="190" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">Místo „pořád stejně“ stavíš ve vlnách → větší pokrok, menší riziko přetížení.</text>' +
    '</svg>',

  // MAKRO ROZLOŽENÍ — kolik z čeho
  'macro-split':
    '<svg viewBox="0 0 600 210" role="img" aria-label="Doporučené rozložení makroživin">' +
      '<text x="300" y="26" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:17px">JAK NASTAVIT MAKRA (vodítko)</text>' +
      '<g transform="translate(60,46)">' +
      '<rect width="480" height="34" rx="8" fill="rgba(255,255,255,.06)"/>' +
      '<rect width="144" height="34" rx="8" fill="'+GR+'" opacity="0.85"/>' +
      '<rect x="144" width="216" height="34" fill="'+GS+'" opacity="0.85"/>' +
      '<rect x="360" width="120" height="34" rx="8" fill="'+G+'" opacity="0.85"/>' +
      '<text x="72" y="22" text-anchor="middle" fill="#160d04" style="'+F+';font-weight:800;font-size:12px">30 %</text>' +
      '<text x="252" y="22" text-anchor="middle" fill="#160d04" style="'+F+';font-weight:800;font-size:12px">45 %</text>' +
      '<text x="420" y="22" text-anchor="middle" fill="#160d04" style="'+F+';font-weight:800;font-size:12px">25 %</text>' +
      '</g>' +
      '<g transform="translate(60,104)" style="'+F+'">' +
      '<rect x="0" y="0" width="14" height="14" rx="3" fill="'+GR+'"/><text x="22" y="12" fill="'+W+'" font-size="12.5" font-weight="700">Bílkoviny</text><text x="22" y="28" fill="'+M+'" font-size="10.5">~1,6–2,2 g/kg — drž napevno</text>' +
      '<rect x="190" y="0" width="14" height="14" rx="3" fill="'+GS+'"/><text x="212" y="12" fill="'+W+'" font-size="12.5" font-weight="700">Sacharidy</text><text x="212" y="28" fill="'+M+'" font-size="10.5">palivo pro výkon, flexibilní</text>' +
      '<rect x="380" y="0" width="14" height="14" rx="3" fill="'+G+'"/><text x="402" y="12" fill="'+W+'" font-size="12.5" font-weight="700">Tuky</text><text x="402" y="28" fill="'+M+'" font-size="10.5">min. ~0,8 g/kg</text>' +
      '</g>' +
      '<text x="300" y="170" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">Nejdřív kalorie, pak bílkovina. Zbytek (sacharidy/tuky) podle chuti a typu tréninku.</text>' +
      '<text x="300" y="190" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:10px">Orientační rozmezí — vždy uprav podle cíle a jednotlivce.</text>' +
    '</svg>',

  // ČASOVÁNÍ ŽIVIN KOLEM TRÉNINKU
  'nutrient-timing':
    '<svg viewBox="0 0 600 210" role="img" aria-label="Výživa kolem tréninku">' +
      '<text x="300" y="26" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:17px">VÝŽIVA KOLEM TRÉNINKU</text>' +
      '<line x1="60" y1="120" x2="540" y2="120" stroke="'+LN+'" stroke-width="2"/>' +
      '<circle cx="300" cy="120" r="8" fill="'+G+'"/>' +
      '<text x="300" y="146" text-anchor="middle" fill="'+G+'" style="'+F+';font-weight:800;font-size:12px">TRÉNINK</text>' +
      '<g transform="translate(150,80)"><rect x="-70" y="0" width="140" height="30" rx="8" fill="rgba(90,169,230,.18)" stroke="'+BL+'" stroke-width="1.5"/><text x="0" y="20" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:700;font-size:11px">PŘED</text></g>' +
      '<text x="150" y="160" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:10.5px">sacharidy + bílkovina,</text>' +
      '<text x="150" y="174" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:10.5px">1–3 h předem = energie</text>' +
      '<g transform="translate(450,80)"><rect x="-70" y="0" width="140" height="30" rx="8" fill="rgba(47,174,87,.18)" stroke="'+GR+'" stroke-width="1.5"/><text x="0" y="20" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:700;font-size:11px">PO</text></g>' +
      '<text x="450" y="160" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:10.5px">bílkovina + sacharidy,</text>' +
      '<text x="450" y="174" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:10.5px">obnova a růst</text>' +
      '<text x="300" y="196" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">„Anabolické okno“ je široké — důležitější je celkový denní příjem a bílkoviny.</text>' +
    '</svg>',

  // RPE / RIR škála
  'rpe-rir':
    '<svg viewBox="0 0 600 210" role="img" aria-label="RPE a RIR škála úsilí">' +
      '<text x="300" y="26" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:17px">JAK TĚŽKÉ TO BYLO? (RPE / RIR)</text>' +
      rpeRow(56,'10','0','selhání — nezvládneš další opakování',G) +
      rpeRow(86,'9','1','zbýval 1 opakování v záloze',GS) +
      rpeRow(116,'8','2','zbývaly 2 — ideál pro růst svalu',GR) +
      rpeRow(146,'6–7','3–4','technika, rozcvičení, objem',BL) +
      '<text x="300" y="196" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">RIR = kolik opakování ti zbývá „v záloze“. Většinu práce dělej v RPE 7–9.</text>' +
    '</svg>',

  // HYPERTROFIE — co spouští růst svalu
  'hypertrophy':
    '<svg viewBox="0 0 600 200" role="img" aria-label="Co spouští růst svalu">' +
      '<text x="300" y="26" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:17px">CO SPOUŠTÍ RŮST SVALU</text>' +
      driver(110,'Mechanické napětí','dostatečná zátěž blízko selhání','NEJDŮLEŽITĚJŠÍ',G) +
      driver(300,'Objem v čase','dost sérií týdně, progrese',' ',GS) +
      driver(490,'Regenerace','spánek, bílkovina, jídlo',' ',BL) +
      '<text x="300" y="186" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">Bez progrese a regenerace sval neporoste, ať trénuješ jakkoliv tvrdě.</text>' +
    '</svg>',

  // TEPOVÉ ZÓNY
  'hr-zones':
    '<svg viewBox="0 0 600 210" role="img" aria-label="Tepové zóny">' +
      '<text x="300" y="26" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:17px">TEPOVÉ ZÓNY (% max. tepu)</text>' +
      hrZone(54,'Zóna 1–2','50–70 %','regenerace, „lehko“',GR,210) +
      hrZone(92,'Zóna 3','70–80 %','vytrvalost, „svižně“',GS,210) +
      hrZone(130,'Zóna 4–5','80–100 %','intervaly, výkon',G,210) +
      '<text x="300" y="196" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">Většina objemu nízko (Z1–2), malá část tvrdě (Z4–5). Pásmo 3 nepřeceňuj.</text>' +
    '</svg>',

  // VLÁKNINA A STŘEVO
  'fiber-gut':
    '<svg viewBox="0 0 600 195" role="img" aria-label="Vláknina a střevní zdraví">' +
      '<text x="300" y="26" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:17px">VLÁKNINA — proč na ní záleží</text>' +
      benefit(95,'🥦','Sytost','zaplní, zasytí na míň kalorií') +
      benefit(245,'📉','Stabilní energie','zpomalí vstřebávání cukru') +
      benefit(395,'🦠','Zdravé střevo','krmí prospěšné bakterie') +
      '<rect x="60" y="150" width="480" height="30" rx="8" fill="rgba(47,174,87,.12)" stroke="'+GR+'" stroke-width="1"/>' +
      '<text x="300" y="170" text-anchor="middle" fill="'+W+'" style="'+F+';font-size:11.5px">Cíl: ~25–35 g denně — zelenina, ovoce, luštěniny, celozrnné.</text>' +
    '</svg>',

  // MARKETINGOVÝ TRYCHTÝŘ
  'funnel':
    '<svg viewBox="0 0 600 230" role="img" aria-label="Marketingový trychtýř klienta">' +
      '<text x="300" y="26" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:17px">CESTA KLIENTA — TRYCHTÝŘ</text>' +
      funnelRow(50,520,'POVĚDOMÍ','někdo tě poprvé uvidí (obsah, reklama)',GR) +
      funnelRow(94,400,'ZÁJEM','sleduje tě, čte, věří ti',GS) +
      funnelRow(138,280,'ROZHODNUTÍ','koupí službu / produkt',G) +
      funnelRow(182,160,'VĚRNOST','zůstává, doporučuje dál',BL) +
    '</svg>'

  };

  // ---- helpery generující opakované prvky ----
  function barG(x, name, kcal, units, col){
    var maxH = 90, h = units/9*maxH, y = 175 - h;
    return '<g transform="translate('+x+',0)">' +
      '<rect x="0" y="'+y+'" width="70" height="'+h+'" rx="6" fill="'+col+'" opacity="0.85"/>' +
      '<text x="35" y="'+(y-8)+'" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:13px">'+kcal+'</text>' +
      '<text x="35" y="193" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11.5px">'+name+'</text></g>';
  }
  function label(x,y,txt,right){
    var anchor = right ? 'end' : 'start';
    var tx = right ? x : x;
    return '<text x="'+tx+'" y="'+y+'" text-anchor="'+anchor+'">'+txt+'</text>';
  }
  function bodySilhouette(){
    return '<g transform="translate(300,40)" fill="rgba(255,122,0,.13)" stroke="'+G+'" stroke-width="2">' +
      '<circle cx="0" cy="22" r="18"/>' +
      '<path d="M-30 48 Q0 40 30 48 L40 120 Q42 150 34 185 L24 250 L8 250 L4 150 L-4 150 L-8 250 L-24 250 L-34 185 Q-42 150 -40 120 Z"/>' +
      '<path d="M-30 52 L-58 130 L-50 150 Z"/><path d="M30 52 L58 130 L50 150 Z"/>' +
      '</g>';
  }
  function sysBar(y,name,time,desc,col,w){
    return '<g transform="translate(0,'+y+')">' +
      '<rect x="60" y="0" width="'+w+'" height="30" rx="8" fill="'+col+'" opacity="0.8"/>' +
      '<text x="72" y="20" fill="#160d04" style="'+F+';font-weight:800;font-size:12px">'+name+'</text>' +
      '<text x="'+(70+w)+'" y="13" fill="'+W+'" style="'+F+';font-weight:700;font-size:11px">'+time+'</text>' +
      '<text x="'+(70+w)+'" y="27" fill="'+M+'" style="'+F+';font-size:10px">'+desc+'</text></g>';
  }
  function growBar(x,h){
    var y = 180 - h;
    return '<rect x="'+x+'" y="'+y+'" width="44" height="'+h+'" rx="5" fill="'+G+'" opacity="0.78"/>';
  }
  function stateCol(x,title,sub,res,col,h){
    var y = 175 - h/2;
    return '<g transform="translate('+x+',0)">' +
      '<rect x="-60" y="'+(170-h)+'" width="120" height="'+h+'" rx="10" fill="'+col+'" opacity="0.16" stroke="'+col+'" stroke-width="1.5"/>' +
      '<text x="0" y="60" text-anchor="middle" fill="'+col+'" style="'+F+';font-weight:800;font-size:14px">'+title+'</text>' +
      '<text x="0" y="84" text-anchor="middle" fill="'+W+'" style="'+F+';font-size:11px">'+sub+'</text>' +
      '<text x="0" y="158" text-anchor="middle" fill="'+M+'" style="'+F+';font-weight:700;font-size:11.5px">'+res+'</text></g>';
  }
  function satBar(x,name,h,col,tag){
    var y = 170 - h;
    return '<g transform="translate('+x+',0)">' +
      '<rect x="0" y="'+y+'" width="120" height="'+h+'" rx="8" fill="'+col+'" opacity="0.8"/>' +
      '<text x="60" y="'+(y-8)+'" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:12px">'+tag+'</text>' +
      '<text x="60" y="186" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:11px">'+name+'</text></g>';
  }
  function blockBar(x,title,sub,col,h){
    var y = 150 - h;
    return '<g transform="translate('+x+',0)">' +
      '<rect x="0" y="'+y+'" width="120" height="'+h+'" rx="8" fill="'+col+'" opacity="0.8"/>' +
      '<text x="60" y="'+(y+h/2)+'" text-anchor="middle" fill="#160d04" style="'+F+';font-weight:800;font-size:11.5px">'+title+'</text>' +
      '<text x="60" y="166" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:10.5px">'+sub+'</text></g>';
  }
  function rpeRow(y,rpe,rir,desc,col){
    return '<g transform="translate(0,'+y+')">' +
      '<rect x="60" y="-14" width="58" height="26" rx="6" fill="'+col+'" opacity="0.85"/>' +
      '<text x="89" y="4" text-anchor="middle" fill="#160d04" style="'+F+';font-weight:800;font-size:12px">'+rpe+'</text>' +
      '<text x="134" y="-2" fill="'+M+'" style="'+F+';font-size:10px">RIR '+rir+'</text>' +
      '<text x="134" y="11" fill="'+W+'" style="'+F+';font-size:11.5px">'+desc+'</text></g>';
  }
  function driver(x,title,sub,tag,col){
    return '<g transform="translate('+x+',0)">' +
      '<rect x="-82" y="46" width="164" height="86" rx="12" fill="'+col+'" opacity="0.13" stroke="'+col+'" stroke-width="1.5"/>' +
      (tag.trim()? '<text x="0" y="42" text-anchor="middle" fill="'+col+'" style="'+F+';font-weight:800;font-size:9.5px">'+tag+'</text>':'') +
      '<text x="0" y="80" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:800;font-size:12.5px">'+title+'</text>' +
      '<text x="0" y="104" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:10px">'+sub.split(',')[0]+'</text>' +
      '<text x="0" y="118" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:10px">'+(sub.split(',')[1]||'')+'</text></g>';
  }
  function hrZone(y,name,pct,desc,col,w){
    return '<g transform="translate(0,'+y+')">' +
      '<rect x="60" y="0" width="'+w+'" height="28" rx="7" fill="'+col+'" opacity="0.8"/>' +
      '<text x="72" y="19" fill="#160d04" style="'+F+';font-weight:800;font-size:11.5px">'+name+' · '+pct+'</text>' +
      '<text x="'+(70+w)+'" y="19" fill="'+M+'" style="'+F+';font-size:10.5px">'+desc+'</text></g>';
  }
  function benefit(x,ico,title,desc){
    return '<g transform="translate('+x+',0)">' +
      '<text x="0" y="64" text-anchor="middle" style="font-size:26px">'+ico+'</text>' +
      '<text x="0" y="94" text-anchor="middle" fill="'+W+'" style="'+F+';font-weight:700;font-size:12px">'+title+'</text>' +
      '<text x="0" y="116" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:10px">'+desc.split(' ').slice(0,3).join(' ')+'</text>' +
      '<text x="0" y="130" text-anchor="middle" fill="'+M+'" style="'+F+';font-size:10px">'+desc.split(' ').slice(3).join(' ')+'</text></g>';
  }
  function funnelRow(y,w,title,desc,col){
    var x = 300 - w/2;
    return '<g transform="translate(0,'+y+')">' +
      '<rect x="'+x+'" y="0" width="'+w+'" height="34" rx="6" fill="'+col+'" opacity="0.82"/>' +
      '<text x="300" y="16" text-anchor="middle" fill="#160d04" style="'+F+';font-weight:800;font-size:12px">'+title+'</text>' +
      '<text x="300" y="29" text-anchor="middle" fill="#160d04" style="'+F+';font-size:9.5px">'+desc+'</text></g>';
  }

  function ensureStyle(){
    if (document.getElementById('ba-fig-style')) return;
    var s = document.createElement('style'); s.id = 'ba-fig-style';
    s.textContent = '.ba-fig{background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:1.15rem 1.2rem .9rem;margin:1.5rem 0}'
      + '.ba-fig svg{display:block;width:100%;height:auto}'
      + '.ba-fig figcaption{margin-top:.7rem;font-size:.82rem;color:#8a8073;text-align:center;line-height:1.45}';
    document.head.appendChild(s);
  }

  function render(){
    ensureStyle();
    var nodes = document.querySelectorAll('figure.ba-fig[data-fig]');
    for (var i=0;i<nodes.length;i++){
      var f = nodes[i], key = f.getAttribute('data-fig');
      if (FIGS[key] && f.getAttribute('data-rendered')!=='1'){
        f.insertAdjacentHTML('afterbegin', FIGS[key]);
        f.setAttribute('data-rendered','1');
      }
    }
  }
  if (document.readyState !== 'loading') render();
  else document.addEventListener('DOMContentLoaded', render);
})();
