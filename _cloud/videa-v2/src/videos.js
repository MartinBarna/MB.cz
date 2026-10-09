/* Scénáře promo videí v2.
   Titulky = schválené znění z _cloud/videa/TEXTY.md (po kole hlasu Martina), rozdělené po frázích (max 6 slov na obrazovce).
   Každá změna znění je v poli `zmena` (a vypíše se do TEXTY-V2.md). [[...]] = zlatě, \n = zalomení.
   Záběry mají délku `d` (s), časy se dopočítají. Sekvence obrazovky začíná u záběru `at` (+ `off` s).
   Zdroj tvrzení `src`: TC = tvuj-coach/, VK = videokurz.html, AK = akademie/, KO = koucing/ (viditelný text stránek). */
const CENY = { vip: '499 Kč', basic: '249 Kč', basicRok: '2 490 Kč', videokurz: '1 490 Kč', academyMesic: '990 Kč', academy: '8 900 Kč', gold: '6 450 Kč', konzultace: '2 990 Kč' };
const FOTO = '/assets/foto/martin/';
const HERO = { kind: 'photo', img: FOTO + 'hero-2048.jpg', pos: '66% 0%', origin: '62% 22%' };
const KOUC = { kind: 'pcard', img: FOTO + 'koucink.jpg', top: 640, h: 820, pos: '32% 40%' };
const PRED = { kind: 'pcard', img: FOTO + 'prednaska.jpg', top: 640, h: 820, pos: '45% 45%' };

function V(dur, seqs, shots, cover) {
  let t = 0; const out = shots.map(s => { const o = Object.assign({}, s, { t: [+t.toFixed(3), +(t + s.d).toFixed(3)] }); t += s.d; return o; });
  if (Math.abs(t - dur) > 1e-6) throw new Error('délka záběrů ' + t + ' ≠ ' + dur);
  const sq = {}; Object.entries(seqs).forEach(([k, s]) => { sq[k] = Object.assign({}, s, { t0: +(out[s.at].t[0] + (s.off || 0)).toFixed(3) }); });
  return { dur, seqs: sq, shots: out, cover };
}
const END = {
  vip: { kind: 'end', d: 2, prod: 'Appka Tvůj Coach VIP', price: CENY.vip, unit: '/ měsíc', note: '+ [[videokurz zdarma]] k první platbě', btn: 'Vzít si VIP', url: 'tvujcoach.cz',
    zmena: '„+ videokurz výživy zdarma k první platbě“ → „+ videokurz zdarma k první platbě“ (max 6 slov)',
    src: 'TC: „VIP · 499 Kč / měsíc“, „K první platbě VIP dostaneš videokurz výživy za 1 490 Kč zdarma“, tlačítko „VZÍT SI VIP“' },
  basic: (note) => ({ kind: 'end', d: 2, prod: 'Appka Tvůj Coach Basic', price: CENY.basic, unit: '/ měsíc', note, btn: 'Vybrat Basic', url: 'tvujcoach.cz',
    src: 'TC: „Basic · 249 Kč / měsíc“, „nebo 2 490 Kč na rok“, „Všechno tohle počítá engine appky sám, bez AI“, tlačítko „VYBRAT BASIC MĚSÍČNĚ“' }),
  vk: { kind: 'end', d: 2, prod: 'Videokurz výživy', price: CENY.videokurz, unit: 'jednorázově, doživotně', note: 'Nebo [[zdarma]] k první platbě VIP', btn: 'Koupit videokurz', url: 'martinbarna.cz/videokurz',
    zmena: '„Nebo zdarma k první platbě appky Tvůj Coach VIP“ → „Nebo zdarma k první platbě VIP“ (max 6 slov na kartě)',
    src: 'VK: „Jednorázově 1 490 Kč, doživotní přístup“, „Nebo ho dostaneš zdarma k první platbě appky Tvůj Coach VIP“, tlačítko „KOUPIT VIDEOKURZ“' },
  ak: { kind: 'end', d: 2, prod: 'Barna Academy', price: CENY.academyMesic, unit: '/ měsíc', note: 'nebo [[8 900 Kč]] doživotně', btn: 'Chci do Academy', url: 'martinbarna.cz/akademie',
    src: 'AK: „Měsíční členství 990 Kč / měsíc“, „Doživotní přístup 8 900 Kč jednorázově“, tlačítko „CHCI DO ACADEMY“' },
  ko: (note) => ({ kind: 'end', d: 2, prod: 'Online koučink Gold', price: CENY.gold, unit: '/ měsíc', note, btn: 'Vybrat balíček', url: 'martinbarna.cz/koucing',
    src: 'KO: „Gold · 6 450 Kč / měsíc“, tlačítko „VYBRAT BALÍČEK“' })
};

window.VIDEOS = {

  /* ═════════ 1) Tvůj Coach VIP ═════════ */
  'tvuj-coach-vip-15': V(15, {
    chat: { type: 'chat', at: 0, typeAt: .35, cps: 17, sendAt: 1.75, ansAt: 2.2, wps: 15 },
    log: { type: 'log', at: 3, typeAt: .15, cps: 14, tapAt: 1.1, resAt: 1.55, stagger: .09, plusAt: 2.35 },
    scan: { type: 'scan', at: 5, lockAt: .72 },
    dnes: { type: 'dnes', at: 6, ringAt: 2.05, ringDur: .9, taps: [{ at: .35, sel: '.sq:nth-of-type(2)' }, { at: 1.15, sel: '.sq:nth-of-type(3)' }] }
  }, [
    { d: 1.7, kind: 'phone', seq: 'chat', cam: { fy: 50, sy: 610, s: .97 }, cap: 'Otázka k jídlu\n[[ve dvě ráno?]]', src: 'TC: „Zeptáš se ve dvě ráno a dostaneš odpověď.“' },
    { d: .9, kind: 'phone', seq: 'chat', cam: { a: 'ans', sy: 1110, s: 1.12 }, cap: '[[AI kouč]] odpoví', src: 'TC: „AI kouč odpovídá podle tvých čísel v appce.“' },
    { d: 1.8, kind: 'phone', seq: 'chat', cam: { a: 'ans', sy: 1090, s: 1.16, d: { s: .03 } }, cap: 'podle [[tvých čísel.]]', src: 'tamtéž' },
    { d: 1.5, kind: 'phone', seq: 'log', cam: { a: 'input', sy: 1060, s: 1.16 }, cap: 'Jídlo [[zapíšeš]]', src: 'TC: „Zapíšeš jídlo i trénink za pár vteřin“' },
    { d: 1.3, kind: 'phone', seq: 'log', cam: { a: 'res', at: 'top', sy: 760, s: 1.16 }, cap: 'za [[pár vteřin.]]', src: 'tamtéž' },
    { d: 1.0, kind: 'phone', seq: 'scan', cam: { a: 'frame', sy: 1060, s: 1.05 }, cap: '[[Čárovým]] kódem', src: 'TC: „Namíříš na čárový kód“' },
    { d: .8, kind: 'phone', seq: 'dnes', cam: { a: 'act', sy: 1080, s: 1.2 }, cap: '[[Hlasem]]', src: 'TC: „Nebo to řekneš nahlas VIP“ (ťuknutí na tlačítko mikrofonu na obrazovce Dnes)' },
    { d: .8, kind: 'phone', seq: 'dnes', cam: { a: 'act', sy: 1080, s: 1.2 }, cap: 'Fotkou [[talíře]]', src: 'TC: „Vyfotíš talíř VIP“ (ťuknutí na tlačítko fotoaparátu)' },
    { d: 1.6, kind: 'phone', seq: 'dnes', cam: { a: 'checkin', sy: 1010, s: 1.12 }, cap: 'Každý týden ti [[pohne]]', src: 'TC: „každý týden se podívá na tvoji váhu a na tvoje zápisy a podle toho ti pohne kaloriemi a makry“' },
    { d: 1.6, kind: 'phone', seq: 'dnes', cam: { a: 'ring', sy: 1080, s: 1.2, d: { s: .04 } }, cap: '[[kaloriemi a makry.]]', src: 'tamtéž' },
    END.vip
  ], { shot: 2, at: 1.75, cap: 'AI kouč, který\n[[vidí tvoje čísla]]', chip: 'Appka Tvůj Coach VIP · [[499 Kč / měsíc]]' }),

  'tvuj-coach-vip-30': V(30, {
    chat: { type: 'chat', at: 0, typeAt: .35, cps: 17, sendAt: 1.75, ansAt: 2.25, wps: 15 },
    log: { type: 'log', at: 13, typeAt: .15, cps: 14, tapAt: 1.1, resAt: 1.5, stagger: .09, plusAt: 2.4 },
    dnes: { type: 'dnes', at: 15, ringAt: .3, ringDur: 1.0 },
    work: { type: 'workout', at: 19, rowsAt: .1, stagger: .1, tapAt: 1.6 },
    gen: { type: 'gen', at: 21, rowsAt: .05, stagger: .09 },
    dnes2: { type: 'dnes', at: 4, ringAt: -5, taps: [{ at: .45, sel: '.sq:nth-of-type(2)' }, { at: 5.6, sel: '.sq:nth-of-type(3)' }] }
  }, [
    { d: 1.6, kind: 'phone', seq: 'chat', cam: { fy: 50, sy: 610, s: .97 }, cap: 'Otázka k jídlu\n[[ve dvě ráno?]]', src: 'TC: „Zeptáš se ve dvě ráno a dostaneš odpověď.“' },
    { d: 1.0, kind: 'phone', seq: 'chat', cam: { a: 'ans', sy: 1110, s: 1.12 }, cap: '[[AI kouč]] vidí\ntvoje čísla', src: 'TC: „AI kouč odpovídá podle tvých čísel v appce.“' },
    { d: 1.3, kind: 'phone', seq: 'chat', cam: { a: 'ans', sy: 1090, s: 1.16, d: { s: .03 } }, cap: 'a [[odpoví hned.]]', src: 'TC: „Zeptáš se ve dvě ráno a dostaneš odpověď.“' },
    { d: 1.3, kind: 'phone', seq: 'chat', cam: { a: 'bold', sy: 1050, s: 1.2 }, cap: 'Jídlo za tebe\n[[rovnou zapíše.]]', src: 'TC: „umí appku ovládat za tebe: zapíše jídlo, upraví ho“, demo video: „jídlo za tebe rovnou zapíše“' },
    { d: .9, kind: 'phone', seq: 'dnes2', cam: { a: 'act', sy: 1080, s: 1.2 }, cap: 'Řekneš to [[nahlas.]]', src: 'TC: „Nebo to řekneš nahlas VIP“ (ťuknutí na mikrofon na obrazovce Dnes)' },
    { d: 1.2, kind: 'quote', cap: '„Rohlík, tvaroh\n[[dvě stě gramů]]', src: 'TC: „„Rohlík, tvaroh dvě stě gramů a tři deci vody.““' },
    { d: 1.0, kind: 'quote', cap: 'a [[tři deci vody.“]]', src: 'tamtéž' },
    { d: 1.3, kind: 'type', cap: 'Appka ukáže,\n[[co chce zapsat.]]', src: 'TC: „ukáže ti, co chce zapsat. Potvrdíš, nebo opravíš.“' },
    { d: .8, kind: 'icon', ico: 'check', cap: 'Potvrdíš,\n[[nebo opravíš.]]', src: 'tamtéž' },
    { d: .9, kind: 'phone', seq: 'dnes2', cam: { a: 'act', sy: 1080, s: 1.2 }, cap: 'Nebo [[vyfotíš talíř.]]', src: 'TC: „Vyfotíš talíř VIP“ (ťuknutí na fotoaparát)' },
    { d: 1.2, kind: 'icon', ico: 'camera', fx: 'flash', flashAt: .15, cap: 'AI odhadne,\nco na něm leží,', src: 'TC: „AI odhadne, co na talíři leží, a spočítá makra“' },
    { d: .9, kind: 'type', cap: 'a [[spočítá makra.]]', src: 'tamtéž' },
    { d: 1.0, kind: 'icon', ico: 'edit', cap: 'Odhad upravíš,\n[[než se zapíše.]]', src: 'TC: „Odhad vidíš a upravíš, než se zapíše.“' },
    { d: 1.5, kind: 'phone', seq: 'log', cam: { a: 'input', sy: 1060, s: 1.16 }, cap: 'Přes [[50 000 potravin,]]', src: 'TC: „Přes 50 000 potravin včetně zboží z Lidlu, Tesca, Alberta či Globusu.“' },
    { d: 1.5, kind: 'phone', seq: 'log', cam: { a: 'res', at: 'top', sy: 760, s: 1.16 }, cap: 'i z [[českých obchodů.]]', src: 'tamtéž' },
    { d: 1.5, kind: 'phone', seq: 'dnes', cam: { a: 'checkin', sy: 1010, s: 1.12 }, cap: 'Cíle se ti\nkaždý týden', src: 'TC: „appka přepočítá kalorie a makra na další týden, podle tvé váhy a tvých zápisů z celého týdne“' },
    { d: 1.2, kind: 'phone', seq: 'dnes', cam: { a: 'ring', sy: 1080, s: 1.12 }, cap: '[[přepočítají.]]', src: 'tamtéž' },
    { d: 1.0, kind: 'phone', seq: 'dnes', cam: { a: 'ring', sy: 1080, s: 1.2 }, cap: 'Podle tvé\n[[váhy a zápisů]]', src: 'tamtéž' },
    { d: .9, kind: 'phone', seq: 'dnes', cam: { a: 'ring', sy: 1060, s: 1.2, d: { s: .03 } }, cap: 'z celého týdne.', src: 'tamtéž' },
    { d: 1.3, kind: 'phone', seq: 'work', cam: { a: 'card', at: 'top', sy: 680, s: 1.1 }, cap: 'Napíše ti [[trénink]]', src: 'TC: „Plán ti appka napíše podle toho, kde cvičíš a kolik dní v týdnu máš.“' },
    { d: 1.1, kind: 'phone', seq: 'work', cam: { a: 'first', sy: 900, s: 1.15 }, cap: 'podle toho, [[kde cvičíš,]]',
      zmena: 'z „Podle toho, kde cvičíš a kolik dní máš.“ vypadlo „a kolik dní máš“ (čas)', src: 'tamtéž' },
    { d: 1.2, kind: 'phone', seq: 'gen', cam: { a: 'card', at: 'top', sy: 680, s: 1.1 }, cap: 'i [[jídelníček.]]', src: 'TC: „K tomu ti poskládá jídelníček i trénink na míru.“' },
    { d: 1.2, kind: 'type', cap: 'Zrušíš [[kdykoliv.]]', src: 'TC: „Zrušíš kdykoliv, do 14 dnů vrácení peněz“' },
    { d: 1.2, kind: 'icon', ico: 'shield', cap: 'Do 14 dnů\n[[vrácení peněz.]]', src: 'tamtéž' },
    END.vip
  ], { shot: 3, at: 1.25, cap: 'AI kouč odpoví\n[[i ve dvě ráno.]]', chip: 'Appka Tvůj Coach VIP · [[499 Kč / měsíc]]' }),

  /* ═════════ 2) Tvůj Coach Basic ═════════ */
  'tvuj-coach-basic-15': V(15, {
    log: { type: 'log', at: 3, typeAt: .1, cps: 16, tapAt: .85, resAt: 1.05, stagger: .08 },
    gen: { type: 'gen', at: 5, rowsAt: .1, stagger: .1 },
    work: { type: 'workout', at: 8, rowsAt: .1, stagger: .1, tapAt: 1.9 }
  }, [
    { d: 1.2, kind: 'stat', kick: 'Zbývá ti', num: '400', lab: 'kcal', src: 'TC: „„Co si můžu ještě dnes dát?“ BASIC · Zbývá ti 400 kcal a 30 g bílkovin.“' },
    { d: 1.0, kind: 'type', cap: 'a [[30 g bílkovin.]]', src: 'tamtéž' },
    { d: 1.1, kind: 'type', cap: 'Co si ještě\n[[dnes dát?]]', src: 'tamtéž' },
    { d: 1.2, kind: 'phone', seq: 'log', cam: { a: 'input', sy: 1060, s: 1.16 }, cap: 'Appka ti nabídne,\n[[čím to dorovnáš.]]', src: 'TC: „Appka projde databázi a nabídne, čím to dorovnáš, aniž den přestřelíš.“' },
    { d: 1.4, kind: 'phone', seq: 'log', cam: { a: 'res', at: 'top', sy: 760, s: 1.16 }, cap: 'Projde databázi,\nať den nepřestřelíš.', src: 'tamtéž' },
    { d: 1.3, kind: 'phone', seq: 'gen', cam: { a: 'card', at: 'top', sy: 680, s: 1.1 }, cap: 'Poskládá ti\n[[celý den]]', src: 'TC: „Generátor ti poskládá celý den z běžných potravin i s gramážemi a přidá nákupní seznam“' },
    { d: 1.3, kind: 'phone', seq: 'gen', cam: { a: 'first', sy: 820, s: 1.2, d: { sy: -40 } }, cap: 'i [[s gramážemi.]]', src: 'tamtéž' },
    { d: .9, kind: 'icon', ico: 'list', cap: 'A přidá\n[[nákupní seznam.]]', src: 'tamtéž' },
    { d: 1.3, kind: 'phone', seq: 'work', cam: { a: 'card', at: 'top', sy: 680, s: 1.1 }, cap: 'Trénink podle toho,', src: 'TC: „Plán podle toho, kde cvičíš BASIC“' },
    { d: 1.2, kind: 'phone', seq: 'work', cam: { a: 'first', sy: 900, s: 1.18 }, cap: '[[kde cvičíš.]]', src: 'tamtéž' },
    { d: 1.1, kind: 'type', cap: 'Levnější volba\n[[bez AI.]]', src: 'TC: „Basic · Levnější volba bez AI“' },
    END.basic('Všechno počítá [[appka sama.]]')
  ], { shot: 4, cap: 'Zbývá 400 kcal.\n[[Co si ještě dát?]]', chip: 'Appka Tvůj Coach Basic · [[249 Kč / měsíc]]' }),

  'tvuj-coach-basic-30': V(30, {
    work: { type: 'workout', at: 0, rowsAt: .25, stagger: .1, tapAt: 10.3 },
    gen: { type: 'gen', at: 11, rowsAt: .1, stagger: .1 },
    log: { type: 'log', at: 17, typeAt: .1, cps: 16, tapAt: .85, resAt: 1.05, stagger: .08 },
    dnes: { type: 'dnes', at: 19, ringAt: .2, ringDur: .9 }
  }, [
    { d: 1.6, kind: 'phone', seq: 'work', cam: { a: 'card', at: 'top', sy: 680, s: 1.1 }, cap: 'Kolik sérií týdně\npadlo na [[záda?]]', src: 'TC: „Objem po svalových partiích BASIC · Kolik sérií týdně padlo na záda a kolik na nohy.“' },
    { d: 1.2, kind: 'phone', seq: 'work', cam: { a: 'first', sy: 900, s: 1.18 }, cap: 'Appka to\n[[spočítá za tebe.]]', src: 'tamtéž' },
    { d: 1.1, kind: 'phone', seq: 'work', cam: { a: 'card', at: 'top', sy: 660, s: 1.06, d: { s: .03 } }, cap: 'Objem po\n[[svalových partiích.]]', src: 'TC: „Objem po svalových partiích“' },
    { d: 1.0, kind: 'type', cap: '[[Barevně]] uvidíš,', src: 'TC: „Barevně uvidíš, jestli je to málo, akorát, nebo už moc.“' },
    { d: 1.5, kind: 'bars', bars: [{ n: 'Záda', p: .62, tag: 'akorát', c: '#5fbf6b' }, { n: 'Nohy', p: .3, tag: 'málo', c: '#EBB12C' }, { n: 'Hrudník', p: .92, tag: 'moc', c: '#e0664f' }],
      zmena: 'zbytek věty („jestli je to málo, akorát, nebo už moc“) nahrazen grafem se štítky málo / akorát / moc', src: 'tamtéž; graf je ilustrační, bez konkrétních čísel' },
    { d: 1.1, kind: 'type', cap: 'Pamatuje si,\n[[kolik zvedáš.]]', src: 'TC: „Pamatuje si, kolik zvedáš BASIC“' },
    { d: 1.2, kind: 'quote', wave: false, cap: '„Zkus\n[[60 kg × 10,]]', src: 'TC: „S Basicem ti navíc u příští série poradí: „Zkus 60 kg × 10, minule ti zbývala rezerva.““' },
    { d: 1.2, kind: 'quote', wave: false, cap: 'minule ti zbývala\n[[rezerva.“]]', src: 'tamtéž' },
    { d: 1.0, kind: 'phone', seq: 'work', cam: { a: 'first', sy: 900, s: 1.18 }, cap: 'Poradí ti\n[[u příští série.]]', src: 'tamtéž' },
    { d: 1.5, kind: 'phone', seq: 'work', cam: { a: 'first', sy: 820, s: 1.12, d: { sy: -60 } }, cap: 'Plán podle toho,\n[[kde cvičíš.]]', src: 'TC: „Cvičíš ve fitku, doma nebo na hřišti … Zadáš cíl a kolik dní v týdnu máš, a plán je hotový.“' },
    { d: 1.1, kind: 'icon', ico: 'dumbbell', cap: 'Fitko, doma\n[[i na hřišti.]]', src: 'tamtéž' },
    { d: 1.5, kind: 'phone', seq: 'gen', cam: { a: 'card', at: 'top', sy: 680, s: 1.1 }, cap: 'Jídelníček na\n[[celý den]]', src: 'TC: „Generátor ti poskládá celý den z běžných potravin i s gramážemi a přidá nákupní seznam, i na celý týden.“' },
    { d: 1.3, kind: 'phone', seq: 'gen', cam: { a: 'first', sy: 820, s: 1.2 }, cap: 'i [[s gramážemi.]]', src: 'tamtéž' },
    { d: 1.1, kind: 'phone', seq: 'gen', cam: { a: 'first', sy: 760, s: 1.1, d: { sy: -50 } }, cap: 'Z běžných potravin,', src: 'tamtéž' },
    { d: 1.0, kind: 'icon', ico: 'list', cap: 's [[nákupním seznamem.]]', src: 'tamtéž' },
    { d: 1.1, kind: 'stat', kick: 'Zbývá', num: '400', lab: 'kcal', src: 'TC: „Zbývá ti 400 kcal a 30 g bílkovin.“' },
    { d: 1.0, kind: 'type', cap: 'a [[30 g bílkovin?]]', src: 'tamtéž' },
    { d: 1.3, kind: 'phone', seq: 'log', cam: { a: 'input', sy: 1060, s: 1.16 }, cap: 'Appka nabídne,\n[[čím to dorovnáš,]]', src: 'TC: „Appka projde databázi a nabídne, čím to dorovnáš, aniž den přestřelíš.“' },
    { d: 1.0, kind: 'phone', seq: 'log', cam: { a: 'res', at: 'top', sy: 760, s: 1.16 }, cap: 'aniž den\n[[přestřelíš.]]', src: 'tamtéž' },
    { d: 1.5, kind: 'phone', seq: 'dnes', cam: { a: 'ring', sy: 1080, s: 1.12 }, cap: 'Tohle všechno\n[[je v Basicu.]]', src: 'výčet funkcí Basic na TC' },
    { d: 1.3, kind: 'type', cap: 'Bez [[AI kouče.]]', src: 'TC: „Basic je totéž bez AI“' },
    { d: 1.2, kind: 'icon', ico: 'check', cap: 'Zrušíš [[kdykoliv.]]', src: 'TC: „Zrušíš kdykoliv“' },
    { d: 1.2, kind: 'phone', seq: 'work', cam: { a: 'card', at: 'top', sy: 700, s: 1.05 }, cap: 'Trénink, jídelníček\na [[cíle každý týden]]', src: 'schválený text coveru v1' },
    END.basic('nebo [[2 490 Kč]] na rok')
  ], { shot: 0, cap: 'Trénink, jídelníček\na [[cíle každý týden]]', chip: 'Appka Tvůj Coach Basic · [[249 Kč / měsíc]]' }),

  /* ═════════ 3) Videokurz výživy ═════════ */
  'videokurz-15': V(15, {
    home: { type: 'vkhome', at: 2, cardsAt: .05, tapAt: 1.55 },
    les: { type: 'vklesson', at: 4, playAt: .3, markAt: 1.85 },
    mats: { type: 'vkmats', at: 9, rowsAt: .05, stagger: .05, hl: [{ at: 1.05, k: 0 }, { at: 1.85, k: 2 }, { at: 2.75, k: 1 }] }
  }, [
    Object.assign({ d: 1.1, cap: 'Dá se jíst\n[[pizza]]', src: 'VK: „Jak si dát i pizzu a pořád mít výsledky.“' }, HERO),
    Object.assign({ d: 1.0, cap: 'a pořád mít\n[[výsledky?]]', zoom: 1.06, src: 'tamtéž' }, HERO),
    { d: 1.2, kind: 'phone', seq: 'home', cam: { a: 'hero', at: 'top', sy: 640, s: 1.12 }, cap: 'Ve videokurzu\n[[ti ukážu,]]', src: 'VK: „Kompletní videokurz, ve kterém ti krok za krokem ukážu, jak jíst“; obrazovka = členská sekce akademie/videokurz/' },
    { d: .9, kind: 'phone', seq: 'home', cam: { a: 'cta', sy: 1130, s: 1.16 }, cap: '[[jak na to.]]', src: 'tamtéž (ťuknutí na „ZAČÍT: CO JSOU TO KALORIE“)' },
    { d: 1.5, kind: 'phone', seq: 'les', cam: { a: 'title', at: 'top', sy: 720, s: 1.12 }, cap: 'Kalorie, makra\na [[flexibilní stravování.]]', src: 'VK moduly 1, 2 a 5; lekce „Co jsou to kalorie“ (video 1 / 182)' },
    { d: .9, kind: 'phone', seq: 'les', cam: { a: 'mark', sy: 1000, s: 1.16 }, cap: 'Krok [[za krokem.]]', src: 'VK: „krok za krokem“ (ťuknutí na „OZNAČIT JAKO ZHLÉDNUTÉ“)' },
    { d: 1.0, kind: 'stat', num: '182', lab: 'videí', src: 'VK: „182 VIDEÍ“' },
    { d: 1.0, kind: 'stat', num: '20+', lab: 'hodin obsahu', src: 'VK: „20+ HODIN OBSAHU“' },
    { d: 1.0, kind: 'stat', num: '∞', lab: 'doživotní přístup', src: 'VK: „∞ DOŽIVOTNÍ PŘÍSTUP“' },
    { d: .8, kind: 'phone', seq: 'mats', cam: { a: 'head', at: 'top', sy: 640, s: 1.12 }, cap: 'A k tomu [[bonusy.]]', src: 'VK: „Bonusy v ceně kurzu“; obrazovka = Přílohy ke stažení v kurzu' },
    { d: .8, kind: 'phone', seq: 'mats', cam: { a: 'r0', sy: 1000, s: 1.18 }, cap: 'Kalkulačka [[maker]]', src: 'VK: „Kalkulačka makroživin“' },
    { d: .9, kind: 'phone', seq: 'mats', cam: { a: 'r2', sy: 1000, s: 1.18 }, cap: 'Kuchařka\n[[40+ receptů]]', src: 'VK: „Kuchařka 40+ receptů“' },
    { d: .9, kind: 'phone', seq: 'mats', cam: { a: 'r0', sy: 1060, s: 1.18 }, cap: 'Generátor [[receptů]]', src: 'VK: „Generátor receptů“' },
    END.vk
  ], { shot: 0, cap: 'Pizza se do\n[[jídelníčku vejde.]]', chip: 'Videokurz výživy · 182 videí · [[1 490 Kč]]' }),

  'videokurz-30': V(30, {
    les: { type: 'vklesson', at: 0, playAt: 99 },
    home: { type: 'vkhome', at: 1, cardsAt: -1, tapAt: .5 },
    mats: { type: 'vkmats', at: 8, rowsAt: .05, stagger: .05, hl: [{ at: 1.35, k: 0 }, { at: 2.05, k: 2 }, { at: 2.75, k: 3 }] },
    les2: { type: 'vklesson', at: 17, playAt: 99 }
  }, [
    { d: 1.5, kind: 'phone', seq: 'les', cam: { a: 'list', at: 'top', sy: 600, s: 1.16 }, cap: 'Kalorie, bílkoviny,\n[[sacharidy, tuky.]]', src: 'VK: „první 4 základy (kalorie, bílkoviny, tuky, sacharidy)“; seznam lekcí modulu 1 v kurzu' },
    { d: 1.0, kind: 'phone', seq: 'home', cam: { a: 'cta', sy: 1130, s: 1.16 }, cap: '[[Kde začít?]]', src: 'ťuknutí na „ZAČÍT: CO JSOU TO KALORIE“ v kurzu' },
    { d: 1.0, kind: 'type', cap: '[[Šest modulů,]]', src: 'VK: „Šest modulů, od základů po pokročilé strategie.“' },
    { d: 1.2, kind: 'type', cap: 'od základů po\n[[pokročilé strategie.]]', src: 'tamtéž' },
    { d: 3.6, kind: 'list', each: .6, items: ['Základy výživy\n[[a energie]]', 'Makroživiny\n[[do hloubky]]', 'Hubnutí bez\n[[jojo efektu]]', '[[Nabírání svalů]]', '[[Flexibilní stravování]]', 'Praxe a udržení\n[[návyků]]'],
      zmena: 'modul „Praxe & udržení návyků“ psán „Praxe a udržení návyků“', src: 'VK: šest modulů v sekci „Co se naučíš“' },
    { d: 1.2, kind: 'stat', num: '182', lab: 'videí', src: 'VK: „182 VIDEÍ“' },
    { d: 1.2, kind: 'stat', num: '20+', lab: 'hodin obsahu', src: 'VK: „20+ HODIN OBSAHU“' },
    { d: 1.2, kind: 'stat', num: '∞', lab: 'doživotní přístup', src: 'VK: „∞ DOŽIVOTNÍ PŘÍSTUP“' },
    { d: 1.3, kind: 'phone', seq: 'mats', cam: { a: 'head', at: 'top', sy: 640, s: 1.12 }, cap: '[[26 bonusových materiálů]]\nv ceně.', src: 'VK: „Ke kurzu dostaneš 26 bonusových materiálů“; v kurzu „Přílohy ke stažení · 26 materiálů“' },
    { d: .7, kind: 'phone', seq: 'mats', cam: { a: 'r0', sy: 1000, s: 1.18 }, cap: '[[Kalkulačka]]', src: 'VK: „Kalkulačka, … kuchařka 40+, e-booky, … tréninkový plán“' },
    { d: .7, kind: 'phone', seq: 'mats', cam: { a: 'r2', sy: 1000, s: 1.18 }, cap: '[[Kuchařka]]', src: 'tamtéž' },
    { d: .7, kind: 'phone', seq: 'mats', cam: { a: 'r3', sy: 1000, s: 1.18 }, cap: '[[E-booky]]', src: 'tamtéž' },
    { d: .8, kind: 'icon', ico: 'dumbbell', cap: 'Tréninkový [[plán]]', src: 'tamtéž' },
    Object.assign({ d: 1.5, cap: 'Stejný systém,\nkterý učím', src: 'VK: „stejný systém, který učím klienty v osobním koučinku, jen vlastním tempem“' }, HERO),
    Object.assign({ d: 1.3, cap: 'klienty\nv [[koučinku.]]', zoom: 1.07, src: 'tamtéž' }, HERO),
    Object.assign({ d: 1.3, cap: '[[Vlastním tempem,]]', src: 'tamtéž' }, KOUC),
    Object.assign({ d: 1.3, cap: 'na mobilu\n[[i počítači.]]', src: 'VK: „Na mobilu, tabletu i počítači.“' }, KOUC),
    { d: 1.6, kind: 'phone', seq: 'les2', cam: { a: 'list', at: 'top', sy: 600, s: 1.16, d: { sy: -40 } }, cap: 'Pusť si\n[[11 lekcí zdarma.]]', src: 'VK: „Pusť si 11 lekcí zdarma … stačí nechat e-mail.“; v kurzu lekce se štítkem ZDARMA' },
    { d: 1.1, kind: 'type', cap: 'Stačí nechat\n[[e-mail.]]', src: 'tamtéž' },
    { d: 1.5, kind: 'icon', ico: 'shield', cap: '[[14denní záruka]]\nvrácení peněz.', src: 'VK: „14denní záruka vrácení peněz.“' },
    { d: 1.2, kind: 'type', cap: 'Nebo [[zdarma]]\nk první platbě', src: 'VK: „Nebo ho dostaneš zdarma k první platbě appky Tvůj Coach VIP.“' },
    { d: 1.1, kind: 'type', cap: 'appky\n[[Tvůj Coach VIP.]]', src: 'tamtéž' },
    Object.assign({}, END.vk, { note: null, zmena: null })
  ], { shot: 0, cap: 'Výživa od základů.\n[[182 videí.]]', chip: 'Videokurz výživy · [[1 490 Kč jednorázově]]' }),

  /* ═════════ 4) Barna Academy ═════════ */
  'academy-15': V(15, {
    akgen: { type: 'akgen', at: 0, tilesAt: -.2, stagger: .1 },
    tools: { type: 'aktools', at: 4, cardsAt: .05 },
    akchat: { type: 'akchat', at: 5, openAt: 0, ansAt: -1.1, wps: 20 },
    les: { type: 'aklesson', at: 9, tapAt: .5, takeAt: 9 }
  }, [
    { d: 1.4, kind: 'phone', seq: 'akgen', cam: { a: 'card', at: 'top', sy: 660, s: 1.08 }, kick: 'Pro trenéry', cap: 'Klient chce\n[[jídelníček.]]',
      zmena: 'kicker „Pro trenéry a výživové poradce“ → „Pro trenéry“ (max 6 slov s háčkem)', src: 'AK: „VZDĚLÁVACÍ PROGRAM PRO TRENÉRY“' },
    { d: 1.2, kind: 'phone', seq: 'akgen', cam: { a: 'tiles', sy: 1060, s: 1.15 }, cap: 'Máš ho\n[[za pár vteřin?]]', src: 'AK: „Jídelníček na míru za pár vteřin.“' },
    { d: 1.2, kind: 'phone', seq: 'akgen', cam: { a: 'tiles', sy: 1000, s: 1.15, d: { s: .03 } }, cap: 'Generátor\nspočítá [[makra]]', src: 'AK: „systém spočítá makra i poskládá hotový denní jídelníček z běžných potravin“' },
    { d: 1.2, kind: 'phone', seq: 'akgen', cam: { a: 'card', at: 'top', sy: 600, s: 1.12, d: { s: .03 } }, cap: 'a poskládá\n[[celý den.]]', src: 'tamtéž' },
    { d: 1.2, kind: 'phone', seq: 'tools', cam: { a: 'lead', sy: 1000, s: 1.16 }, cap: 'Dáš ho klientovi\n[[pod svým jménem.]]', src: 'AK: „Dáš ho klientovi pod svým jménem.“; obrazovka Nástroje pro trenéry (akademie/nastroje/)' },
    { d: 1.4, kind: 'phone', seq: 'akchat', cam: { a: 'chat', at: 'top', sy: 600, s: 1.08 }, cap: '[[AI Martin]] zná\nvšech 256 lekcí.', src: 'AK: „AI Martina. Zná všech 256 lekcí“; v Academy se chatbot jmenuje AI Martin (UI i stránka)' },
    { d: 1.4, kind: 'phone', seq: 'akchat', cam: { a: 'src', sy: 1150, s: 1.12 }, cap: 'Odpoví a ukáže,\n[[kde to najdeš.]]', src: 'AK: „Odpoví a rovnou ukáže, kde to je“' },
    { d: 1.2, kind: 'stat', num: '24', lab: 'modulů', src: 'AK: „24 modulů · 256 lekcí“' },
    { d: 1.2, kind: 'stat', num: '256', lab: 'lekcí', src: 'tamtéž' },
    { d: 1.6, kind: 'phone', seq: 'les', cam: { a: 'head', at: 'top', sy: 700, s: 1.08, d: { s: .03 } }, cap: 'Pro trenéry\na [[výživové poradce]]', src: 'AK: „Pro trenéry a výživové poradce“ (schválený kicker)' },
    END.ak
  ], { shot: 2, kick: 'Pro trenéry a výživové poradce', cap: 'Jídelníček klientovi\n[[za pár vteřin]]', chip: 'Barna Academy · [[990 Kč / měsíc]]' }),

  'academy-30': V(30, {
    les: { type: 'aklesson', at: 0, tapAt: .7, takeAt: 8.3 },
    akchat: { type: 'akchat', at: 2, openAt: 0, ansAt: -1.1, wps: 18 },
    akgen: { type: 'akgen', at: 8, tilesAt: .1, stagger: .1 },
    tools: { type: 'aktools', at: 10, cardsAt: .05 },
    tools2: { type: 'aktools', at: 12, scrollFrom: 0, scroll: 980, scrollAt: 0, scrollDur: .5, cardsAt: -1, taps: [{ at: .65, k: 3 }] },
    tools3: { type: 'aktools', at: 13, scrollFrom: 980, scroll: 1290, scrollAt: 0, cardsAt: -1 },
    dnes: { type: 'dnes', at: 21, ringAt: .2, ringDur: .9 }
  }, [
    { d: 1.5, kind: 'phone', seq: 'les', cam: { a: 'head', at: 'top', sy: 700, s: 1.08 }, kick: 'Barna Academy', cap: 'Studuješ\n[[v deset večer]]',
      zmena: 'kicker „Barna Academy pro trenéry“ → „Barna Academy“ (max 6 slov s háčkem)', src: 'AK: „Studuješ v deset večer, narazíš na něco, čemu nerozumíš, a nemáš se koho zeptat.“' },
    { d: 1.2, kind: 'phone', seq: 'les', cam: { a: 'lead', sy: 1100, s: 1.1 }, cap: 'a nemáš se\n[[koho zeptat?]]', src: 'tamtéž' },
    { d: 1.5, kind: 'phone', seq: 'akchat', cam: { a: 'chat', at: 'top', sy: 600, s: 1.08 }, cap: '[[AI Martin]] zná\nvšech 256 lekcí', src: 'AK: „Zná všech 256 lekcí, mluví jako já a odpoví ti hned.“' },
    { d: 1.2, kind: 'phone', seq: 'akchat', cam: { a: 'ans', sy: 1050, s: 1.08 }, cap: 'a [[odpoví hned.]]', src: 'tamtéž' },
    { d: 1.2, kind: 'phone', seq: 'akchat', cam: { a: 'src', sy: 1150, s: 1.12 }, cap: 'Je u každé lekce,', src: 'AK: „Je u každé lekce, ve dne v noci“' },
    { d: 1.0, kind: 'type', cap: '[[ve dne v noci.]]', src: 'tamtéž' },
    { d: 1.4, kind: 'phone', seq: 'les', cam: { a: 'take', sy: 1080, s: 1.1 }, cap: 'Každá lekce\n[[prakticky.]]', src: 'AK: „Každá lekce prakticky: co uděláš s klientem v pondělí.“' },
    { d: 1.3, kind: 'phone', seq: 'les', cam: { a: 'take', sy: 1040, s: 1.16, d: { s: .03 } }, cap: 'Co uděláš s klientem\n[[v pondělí.]]', src: 'tamtéž' },
    { d: 1.4, kind: 'phone', seq: 'akgen', cam: { a: 'tiles', sy: 1060, s: 1.15 }, cap: 'Jídelníček\n[[na míru]]', src: 'AK: „Jídelníček na míru za pár vteřin.“' },
    { d: 1.2, kind: 'phone', seq: 'akgen', cam: { a: 'meal', sy: 1040, s: 1.15 }, cap: '[[za pár vteřin.]]', src: 'tamtéž' },
    { d: 1.0, kind: 'phone', seq: 'tools', cam: { a: 'lead', sy: 1000, s: 1.16 }, cap: '[[Pod tvým jménem.]]', src: 'AK: „Dáš ho klientovi pod svým jménem.“; obrazovka Nástroje pro trenéry' },
    { d: 1.0, kind: 'phone', seq: 'tools', cam: { a: 'head', at: 'top', sy: 620, s: 1.08 }, cap: 'Hotové nástroje\n[[pro praxi.]]', src: 'AK: výčet nástrojů; akademie/nastroje/' },
    { d: 1.1, kind: 'phone', seq: 'tools2', cam: { a: 'c3', sy: 1080, s: 1.1 }, cap: 'Generátor [[tréninků]]',
      zmena: 'podtitulek „fitko, doma i venku“ nahrazen štítkem „Fitko / doma / venku“ přímo na kartě nástroje', src: 'AK: „Generátor tréninků … Fitko, doma i venku“' },
    { d: .9, kind: 'phone', seq: 'tools3', cam: { a: 'c4', sy: 1080, s: 1.1 }, cap: 'Databáze\n[[128 cviků]]', src: 'AK: „Databáze cviků · 128 cviků s provedením krok za krokem a nejčastějšími chybami“' },
    { d: .8, kind: 'phone', seq: 'tools3', cam: { a: 'ch4', sy: 1100, s: 1.2 }, cap: 'provedení\na [[časté chyby]]', src: 'tamtéž' },
    { d: 1.0, kind: 'icon', ico: 'doc', cap: 'Materiály\n[[pod tvým jménem]]', zmena: 'vypadl dovětek „(přílohy, kuchařky, plány)“ (max 6 slov)', src: 'AK: „Rebrandovatelné science-based materiály … přebrandované na tvoje jméno“' },
    Object.assign({ d: 1.3, cap: 'Certifikát\n[[po testu]]', src: 'AK: „Certifikát Barna Academy po testu a případovce, kterou čtu osobně.“' }, PRED),
    Object.assign({ d: 1.1, cap: 'a [[případovce.]]', src: 'tamtéž' }, PRED),
    Object.assign({ d: 1.0, cap: 'Tu čtu [[osobně.]]', src: 'tamtéž' }, PRED),
    { d: 1.2, kind: 'stat', num: '256', lab: 'lekcí ve 24 modulech', src: 'AK: „256 lekcí ve 24 modulech“' },
    { d: 1.2, kind: 'stat', num: '182', lab: 'videí videokurzu v ceně', src: 'AK: „Videokurz výživy (182 videí) v ceně“' },
    { d: 1.3, kind: 'phone', seq: 'dnes', cam: { a: 'checkin', sy: 1010, s: 1.12 }, cap: 'Appka\n[[Tvůj Coach VIP]]', src: 'AK: „Appka Tvůj Coach je v ceně u obou variant.“' },
    { d: 1.1, kind: 'phone', seq: 'dnes', cam: { a: 'ring', sy: 1080, s: 1.18 }, cap: '[[v ceně obou variant.]]', src: 'tamtéž' },
    { d: 1.1, kind: 'icon', ico: 'shield', cap: '[[14denní záruka]]\nvrácení peněz.', src: 'AK: „14denní záruka vrácení peněz“' },
    END.ak
  ], { shot: 3, kick: 'Pro trenéry a výživové poradce', cap: '256 lekcí, generátory\na [[AI Martin]]', chip: 'Barna Academy · [[990 Kč / měsíc]]' }),

  /* ═════════ 5) Online koučink ═════════ */
  'koucing-15': V(15, {
    dnes: { type: 'dnes', at: 3, ringAt: .2, ringDur: .9 }
  }, [
    Object.assign({ d: 1.4, cap: 'Kdo ti každý týden\n[[projde čísla?]]', src: 'KO: „každý týden projdu tvoje čísla a upravím plán“' }, HERO),
    Object.assign({ d: 1.1, cap: '[[Já.]] Projdu\nváhu, míry', src: 'KO: „Každý týden projdu tvoji váhu, míry a to, jak šel týden, a upravím cíle i aktivity.“' }, KOUC),
    Object.assign({ d: 1.1, cap: 'a to,\n[[jak šel týden.]]', src: 'tamtéž' }, KOUC),
    { d: 1.3, kind: 'phone', seq: 'dnes', cam: { a: 'ring', sy: 1080, s: 1.12 }, cap: 'A upravím\n[[cíle i aktivity.]]', src: 'tamtéž (obrazovka appky Tvůj Coach, kterou klient koučinku má v ceně)' },
    { d: .9, kind: 'type', cap: 'Co v koučinku [[máš.]]', src: 'KO: „Co v koučinku dostaneš“' },
    { d: .9, kind: 'icon', ico: 'plate', cap: 'Jídlo, které\n[[tě baví.]]', src: 'KO: „Jídlo, které tě baví … Vejde se i pizza.“' },
    { d: .8, kind: 'icon', ico: 'plate', cap: 'Vejde se\n[[i pizza.]]', src: 'tamtéž' },
    { d: .8, kind: 'icon', ico: 'chat', cap: 'Podpora\n[[po ruce]]', src: 'KO: „Podpora po ruce · E-mail a WhatsApp (po–pá).“' },
    { d: .9, kind: 'icon', ico: 'chat', cap: 'e-mail a WhatsApp,\n[[po–pá]]', src: 'tamtéž' },
    { d: 1.4, kind: 'phone', seq: 'dnes', cam: { a: 'checkin', sy: 1010, s: 1.12, d: { s: .03 } }, cap: 'Appka Tvůj Coach\n[[v ceně]]', src: 'KO (Gold): „Appka Tvůj Coach v ceně po celou dobu koučinku“' },
    { d: 1.4, kind: 'type', cap: 'Koučink beru jen\nv [[omezeném počtu.]]', src: 'KO: „Koučink beru jen v omezeném počtu“' },
    Object.assign({ d: 1.0, cap: 'Plán ti každý týden\n[[upravím já.]]', zoom: 1.06, src: 'schválený text coveru v1' }, HERO),
    END.ko('Nebo mi nejdřív\n[[nezávazně napiš.]]')
  ], { shot: 0, cap: 'Plán ti každý týden\n[[upravím já.]]', chip: 'Online koučink · Martin Barna · [[6 450 Kč / měsíc]]' }),

  'koucing-30': V(30, {
    dnes: { type: 'dnes', at: 11, ringAt: .2, ringDur: .9 },
    chat: { type: 'chat', at: 14, off: -2.4, typeAt: .1, cps: 30, sendAt: .8, ansAt: 1.2, wps: 18 }
  }, [
    Object.assign({ d: 1.6, cap: 'Týdenní report\n[[za 3 minuty]]', src: 'KO: „Týdenní report naklikáš za 3 minuty z mobilu.“' }, HERO),
    Object.assign({ d: .9, cap: 'z [[mobilu.]]', zoom: 1.06, src: 'tamtéž' }, HERO),
    Object.assign({ d: 1.2, cap: 'A já ti\n[[upravím plán.]]', src: 'KO: „Pošleš report … já ho projdu, napíšu ti analýzu a upravím čísla.“' }, KOUC),
    { d: 1.0, kind: 'type', cap: 'Jak spolupráce\n[[probíhá.]]', src: 'KO: „Jak spolupráce probíhá“' },
    { d: 1.2, kind: 'step', n: '1', cap: '[[Napíšeš mi]]', src: 'KO: „1 Napíšeš mi“' },
    { d: 1.2, kind: 'step', n: '2', cap: 'Dostaneš\n[[plán na míru]]', src: 'KO: „2 Dostaneš plán na míru“' },
    { d: 1.2, kind: 'step', n: '3', cap: 'Týdenní\n[[kontroly]]', src: 'KO: „3 Týdenní kontroly“' },
    { d: 1.3, kind: 'type', cap: 'Do [[48 hodin]]\nod dotazníku', src: 'KO: „Do 48 hodin od tebe máš spočítané kalorie a makra, jídelníček a trénink.“' },
    { d: 1.3, kind: 'type', cap: 'kalorie, makra,\n[[jídelníček i trénink.]]', src: 'tamtéž' },
    Object.assign({ d: 1.3, cap: 'Každý týden projdu\n[[tvoje čísla.]]', src: 'KO: „každý týden projdu tvoje čísla a upravím plán“' }, KOUC),
    Object.assign({ d: 1.2, cap: 'Napíšu ti\n[[analýzu]]', src: 'KO: „Já ho vyhodnotím, napíšu ti analýzu a upravím čísla.“' }, KOUC),
    { d: 1.2, kind: 'phone', seq: 'dnes', cam: { a: 'ring', sy: 1080, s: 1.12 }, cap: 'a [[upravím plán.]]', src: 'tamtéž' },
    { d: 1.0, kind: 'type', cap: 'V ceně\n[[každého balíčku.]]', src: 'KO: „v ceně každého balíčku“' },
    { d: 1.1, kind: 'phone', seq: 'dnes', cam: { a: 'checkin', sy: 1010, s: 1.12 }, cap: 'Appka [[Tvůj Coach]]', src: 'KO: „Appka Tvůj Coach“' },
    { d: 1.2, kind: 'phone', seq: 'chat', cam: { a: 'ans', sy: 1090, s: 1.16 }, cap: '[[AI Coach]] v appce',
      zmena: '„AI Martin, kouč 24/7“ → „AI Coach v appce“ (pokyn majitele: avatar v appce se jmenuje AI Coach, „24/7“ nepřidávat)', src: 'TC: „Klienti koučinku mají plnou appku po celou dobu spolupráce.“ + obrazovka AI Coach (assets/app/ai-kouc.png)' },
    { d: 1.0, kind: 'icon', ico: 'chart', cap: 'Klientská sekce\n[[s grafy]]', src: 'KO: „Moderní klientská sekce … Grafy váhy, měr a pokroku“' },
    { d: 1.0, kind: 'icon', ico: 'play', cap: 'Videokurz\n[[182 videí]]', src: 'KO: „Videokurz v ceně · 182 videí“' },
    { d: 1.4, kind: 'type', cap: '[[Gold]] si vybírá\nvětšina.', src: 'KO: „Gold · Vedení na dálku, tohle si vybírá většina“' },
    Object.assign({ d: 1.3, cap: 'Koučink beru jen\nv [[omezeném počtu.]]', src: 'KO: „Koučink beru jen v omezeném počtu“' }, HERO),
    Object.assign({ d: 1.1, cap: 'Aby měl\nkaždý klient', src: 'KO: „aby měl každý klient mou plnou pozornost“' }, KOUC),
    Object.assign({ d: 1.0, cap: 'moji [[plnou pozornost.]]', src: 'tamtéž' }, KOUC),
    { d: 1.3, kind: 'type', cap: 'Začni [[konzultací]]\nza 2 990 Kč,', src: 'KO: „Konzultace 2 990 Kč“; konzultace/: „2 990 Kč“' },
    { d: 1.0, kind: 'type', cap: 'do 14 dní\nti ji', src: 'KO: „Když si do 14 dní po konzultaci objednáš online koučink, cenu konzultace (2 990 Kč) ti odečtu z ceny balíčku.“' },
    { d: 1.0, kind: 'type', cap: 'z koučinku\n[[odečtu.]]', src: 'tamtéž' },
    END.ko(null)
  ], { shot: 0, cap: 'Report za 3 minuty.\n[[Plán upravím já.]]', chip: 'Online koučink · Martin Barna · [[6 450 Kč / měsíc]]' }),
};
