/* Scénáře promo videí. Texty jsou NÁVRH k projetí hlasem Martina.
   [[...]] = zlaté zvýraznění. `src` u scény = odkud je tvrzení (viditelný text stránky v repu):
   TC = tvuj-coach/index.html, VK = videokurz.html, AK = akademie/index.html,
   KO = koucing/index.html, PT = pro-trenery/index.html.
   Ceny jsou na jednom místě (CENY), při změně ceníku stačí upravit a přerenderovat. */
const CENY = {
  vip: '499 Kč', vipRok: '4 990 Kč',
  basic: '249 Kč', basicRok: '2 490 Kč',
  videokurz: '1 490 Kč',
  academyMesic: '990 Kč', academy: '8 900 Kč',
  gold: '6 450 Kč', konzultace: '2 990 Kč'
};

const A = '/assets/app/';
const AK_IMG = '/assets/screeny/academy/';
const FOTO = '/assets/foto/martin/';
const IMG = 'img/';

window.VIDEOS = {

  /* ───────────── 1) Tvůj Coach VIP ───────────── */
  'tvuj-coach-vip-15': {
    title: 'Tvůj Coach VIP, 15 s', dur: 15, music: 'vip',
    scenes: [
      { type: 'hook', t: [0, 3], logo: true, h: 'Otázka k jídlu\n[[ve dvě ráno]]?', bubble: 'Kolik mi dnes zbývá?', bubbleAt: .7, typeDur: .9,
        src: ['TC: „Zeptáš se ve dvě ráno a dostaneš odpověď.“', 'Bublina = dotaz ze screenshotu assets/app/ai-kouc.png'] },
      { type: 'card', t: [3, 6.5], cap: 'AI kouč odpoví\n[[podle tvých čísel]].', img: A + 'ai-kouc.png', w: 800, h: 880, cropTop: 0, pan: [0, 0], zoom: [1, 1.05],
        src: ['TC: „AI kouč odpovídá podle tvých čísel v appce.“', 'Screenshot assets/app/ai-kouc.png (z /tvuj-coach/)'] },
      { type: 'rows', t: [6.5, 10], cap: 'Jídlo zapíšeš\n[[za pár vteřin]].', stagger: .3,
        rows: [{ ico: 'barcode', lab: 'Čárovým kódem' }, { ico: 'mic', lab: 'Hlasem' }, { ico: 'camera', lab: 'Fotkou talíře' }],
        src: ['TC: „Zapíšeš jídlo i trénink za pár vteřin“', 'TC: „Namíříš na čárový kód“, „Nebo to řekneš nahlas“, „Vyfotíš talíř“'] },
      { type: 'card', t: [10, 12.5], cap: 'Každý týden ti pohne\n[[kaloriemi a makry]].', img: A + 'dnes.webp', cropTop: 250, w: 680, pan: [0, .25],
        src: ['TC: „každý týden se podívá na tvoji váhu a na tvoje zápisy a podle toho ti pohne kaloriemi a makry“', 'Screenshot assets/app/dnes.webp (oříznutá hlavička s demo jménem)'] },
      { type: 'cta', t: [12.5, 15], label: 'Appka Tvůj Coach VIP', price: CENY.vip, unit: '/ měsíc',
        box: '+ [[videokurz výživy zdarma]]\nk první platbě', url: 'tvujcoach.cz',
        src: ['TC: „VIP · 499 Kč / měsíc“', 'TC: „K první platbě VIP dostaneš videokurz výživy za 1 490 Kč zdarma“', 'URL: tvujcoach.cz (patička TC + odkazy v mailech „Vyzkoušet appku zdarma“)'] }
    ],
    cover: { h: 'AI kouč,\n[[který vidí tvoje čísla]]', shot: A + 'ai-kouc.png', shotNat: 390, shotTop: 0, label: 'Appka Tvůj Coach VIP', price: CENY.vip, unit: '/ měsíc', url: 'tvujcoach.cz' }
  },

  'tvuj-coach-vip-30': {
    title: 'Tvůj Coach VIP, 30 s', dur: 30, music: 'vip',
    scenes: [
      { type: 'hook', t: [0, 3], logo: true, h: 'Otázka k jídlu\n[[ve dvě ráno]]?', bubble: 'Kolik mi dnes zbývá?', bubbleAt: .7, typeDur: .9,
        src: ['TC: „Zeptáš se ve dvě ráno a dostaneš odpověď.“'] },
      { type: 'card', t: [3, 7], cap: 'AI kouč vidí tvoje čísla\na [[odpoví hned]].', sub: 'Jídlo za tebe rovnou zapíše.', img: A + 'ai-kouc.png', w: 800, h: 880, cropTop: 0, pan: [0, 0], zoom: [1, 1.05],
        src: ['TC: „AI kouč mým hlasem … umí appku ovládat za tebe: zapíše jídlo, upraví ho“', 'TC (demo video): „kouč odpoví a jídlo za tebe rovnou zapíše“'] },
      { type: 'quote', t: [7, 11], cap: 'Řekneš to [[nahlas]].', deco: 'wave', q: '„Rohlík, tvaroh dvě stě gramů a tři deci vody.“', sub: 'Appka ukáže, co chce zapsat.\nPotvrdíš, nebo opravíš.',
        src: ['TC: „Nebo to řekneš nahlas VIP: „Rohlík, tvaroh dvě stě gramů a tři deci vody.“ … ukáže ti, co chce zapsat. Potvrdíš, nebo opravíš.“'] },
      { type: 'quote', t: [11, 14.5], cap: 'Nebo [[vyfotíš talíř]].', deco: 'camera', q: 'AI odhadne, co na něm leží, a spočítá makra.', sub: 'Odhad upravíš, než se zapíše.',
        src: ['TC: „Vyfotíš talíř VIP … AI odhadne, co na talíři leží, a spočítá makra … Odhad vidíš a upravíš, než se zapíše.“'] },
      { type: 'card', t: [14.5, 18], cap: 'Přes [[50 000 potravin]],\ni z českých obchodů.', img: IMG + 'zapis-jidla-v2.webp', w: 680, pan: [0, .3],
        src: ['TC: „Přes 50 000 potravin včetně zboží z Lidlu, Tesca, Alberta či Globusu.“', 'Screenshot assets/app/zapis-jidla.webp, opravený bez odznaku „Ověřeno Martinem“ (src/img/zapis-jidla-v2.webp)'] },
      { type: 'card', t: [18, 21.5], cap: 'Cíle se ti každý týden\n[[přepočítají]].', sub: 'Podle tvé váhy a zápisů z celého týdne.', img: A + 'dnes.webp', cropTop: 250, w: 640, pan: [0, .2],
        src: ['TC: „appka přepočítá kalorie a makra na další týden, podle tvé váhy a tvých zápisů z celého týdne“'] },
      { type: 'card', t: [21.5, 25], cap: 'Napíše ti [[trénink]]\ni jídelníček.', sub: 'Podle toho, kde cvičíš a kolik dní máš.', img: A + 'generator-treninku.png', w: 560, pan: [0, .3],
        src: ['TC: „Plán ti appka napíše podle toho, kde cvičíš a kolik dní v týdnu máš.“', 'TC: „K tomu ti poskládá jídelníček i trénink na míru.“'] },
      { type: 'cta', t: [25, 30], label: 'Appka Tvůj Coach VIP', price: CENY.vip, unit: '/ měsíc',
        box: '+ [[videokurz výživy zdarma]]\nk první platbě (182 videí)', url: 'tvujcoach.cz', small: 'Zrušíš kdykoliv. Do 14 dnů vrácení peněz.',
        src: ['TC: „499 Kč / měsíc“', 'TC: „Videokurz výživy zdarma k první platbě (182 videí …)“', 'TC: „Zrušíš kdykoliv, do 14 dnů vrácení peněz“'] }
    ],
    cover: { h: 'Kouč v kapse.\n[[Odpoví ve dvě ráno.]]', shot: A + 'dnes.webp', shotTop: 250, label: 'Appka Tvůj Coach VIP', price: CENY.vip, unit: '/ měsíc', url: 'tvujcoach.cz' }
  },

  /* ───────────── 2) Tvůj Coach Basic ───────────── */
  'tvuj-coach-basic-15': {
    title: 'Tvůj Coach Basic, 15 s', dur: 15, music: 'basic',
    scenes: [
      { type: 'hook', t: [0, 3.5], logo: true, h: 'Zbývá ti [[400 kcal]]\na [[30 g bílkovin]].', sub: 'Co si ještě dnes dát?', subAt: 1.0,
        src: ['TC: „„Co si můžu ještě dnes dát?“ BASIC · Zbývá ti 400 kcal a 30 g bílkovin.“'] },
      { type: 'text', t: [3.5, 6], h: 'Appka ti nabídne,\n[[čím to dorovnáš]].', sub: 'Projde databázi, ať den nepřestřelíš.',
        src: ['TC: „Appka projde databázi a nabídne, čím to dorovnáš, aniž den přestřelíš.“'] },
      { type: 'card', t: [6, 9.5], cap: 'Poskládá ti [[celý den]]\ni s gramážemi.', sub: 'A přidá nákupní seznam.', img: A + 'generator-jidelnicku.png', w: 640, pan: [0, .5],
        src: ['TC: „Generátor ti poskládá celý den z běžných potravin i s gramážemi a přidá nákupní seznam“'] },
      { type: 'card', t: [9.5, 12.5], cap: 'Trénink podle toho,\n[[kde cvičíš]].', img: A + 'generator-treninku.png', w: 580, pan: [0, .35],
        src: ['TC: „Plán podle toho, kde cvičíš BASIC“'] },
      { type: 'cta', t: [12.5, 15], label: 'Appka Tvůj Coach Basic', price: CENY.basic, unit: '/ měsíc',
        box: 'Levnější volba [[bez AI]].\nČísla počítá engine appky.', url: 'tvujcoach.cz',
        src: ['TC: „Basic · Levnější volba bez AI · 249 Kč / měsíc“', 'TC: „Všechno tohle počítá engine appky sám, bez AI“'] }
    ],
    cover: { h: 'Zbývá 400 kcal.\n[[Co si ještě dát?]]', shot: A + 'generator-jidelnicku.png', shotTop: 0, label: 'Appka Tvůj Coach Basic', price: CENY.basic, unit: '/ měsíc', url: 'tvujcoach.cz' }
  },

  'tvuj-coach-basic-30': {
    title: 'Tvůj Coach Basic, 30 s', dur: 30, music: 'basic',
    scenes: [
      { type: 'hook', t: [0, 3], logo: true, h: 'Kolik sérií týdně\npadlo na [[záda]]?', sub: 'Appka to spočítá za tebe.', subAt: 1.0,
        src: ['TC: „Objem po svalových partiích BASIC · Kolik sérií týdně padlo na záda a kolik na nohy.“'] },
      { type: 'bars', t: [3, 7], cap: 'Objem po [[svalových partiích]].', sub: 'Barevně uvidíš, jestli je to málo, akorát, nebo už moc.',
        bars: [{ n: 'Záda', p: .62, tag: 'akorát', c: '#5fbf6b' }, { n: 'Nohy', p: .3, tag: 'málo', c: '#EBB12C' }, { n: 'Hrudník', p: .92, tag: 'moc', c: '#e0664f' }],
        src: ['TC: „Barevně uvidíš, jestli je to málo, akorát, nebo už moc.“', 'Grafika je ilustrační (bez konkrétních čísel), ne screenshot appky'] },
      { type: 'quote', t: [7, 11], cap: 'Pamatuje si, [[kolik zvedáš]].', q: '„Zkus 60 kg × 10, minule ti zbývala rezerva.“', sub: 'Poradí ti u příští série.',
        src: ['TC: „Pamatuje si, kolik zvedáš BASIC … S Basicem ti navíc u příští série poradí: „Zkus 60 kg × 10, minule ti zbývala rezerva.““'] },
      { type: 'card', t: [11, 15], cap: 'Plán podle toho,\n[[kde cvičíš]].', sub: 'Fitko, doma i na hřišti.', img: A + 'generator-treninku.png', w: 560, pan: [0, .4],
        src: ['TC: „Cvičíš ve fitku, doma nebo na hřišti … Zadáš cíl a kolik dní v týdnu máš, a plán je hotový.“'] },
      { type: 'card', t: [15, 19], cap: 'Jídelníček na [[celý den]]\ni s gramážemi.', sub: 'Z běžných potravin, s nákupním seznamem.', img: A + 'generator-jidelnicku.png', w: 620, pan: [0, .55],
        src: ['TC: „Generátor ti poskládá celý den z běžných potravin i s gramážemi a přidá nákupní seznam, i na celý týden.“'] },
      { type: 'hook', t: [19, 22.5], h: 'Zbývá [[400 kcal]]\na [[30 g bílkovin]]?', sub: 'Appka nabídne, čím to dorovnáš, aniž den přestřelíš.', subAt: .5,
        src: ['TC: „Zbývá ti 400 kcal a 30 g bílkovin. Appka projde databázi a nabídne, čím to dorovnáš, aniž den přestřelíš.“'] },
      { type: 'card', t: [22.5, 26], cap: 'Tohle všechno je\nv [[Basicu]].', img: IMG + 'tc-basic-karta.png', w: 720, pan: [0, .45],
        src: ['Výřez ceníkové karty Basic z /tvuj-coach/ (mobil, lokální server)'] },
      { type: 'cta', t: [26, 30], label: 'Appka Tvůj Coach Basic', price: CENY.basic, unit: '/ měsíc', alt: 'nebo ' + CENY.basicRok + ' na rok',
        url: 'tvujcoach.cz', small: 'Bez AI kouče. Zrušíš kdykoliv.',
        src: ['TC: „249 Kč / měsíc nebo 2 490 Kč na rok“', 'TC: „Basic je totéž bez AI“, „Zrušíš kdykoliv“'] }
    ],
    cover: { h: 'Trénink, jídelníček\na [[cíle každý týden]]', shot: A + 'generator-treninku.png', shotNat: 390, shotTop: 0, label: 'Appka Tvůj Coach Basic', price: CENY.basic, unit: '/ měsíc', url: 'tvujcoach.cz' }
  },

  /* ───────────── 3) Videokurz výživy ───────────── */
  'videokurz-15': {
    title: 'Videokurz výživy, 15 s', dur: 15, music: 'vk',
    scenes: [
      { type: 'hook', t: [0, 3], logo: true, h: 'Dá se jíst [[pizza]]\na pořád mít výsledky?',
        src: ['VK (bonus Flexibilní stravování): „Jak si dát i pizzu a pořád mít výsledky.“'] },
      { type: 'text', t: [3, 6], h: 'Ve videokurzu ti ukážu,\n[[jak na to]].', sub: 'Kalorie, makra a flexibilní stravování. Krok za krokem.',
        src: ['VK: „Kompletní videokurz, ve kterém ti krok za krokem ukážu, jak jíst“', 'VK moduly: Základy výživy a energie, Makroživiny, Flexibilní stravování'] },
      { type: 'stats', t: [6, 10], stagger: .35,
        stats: [{ num: 182, lab: 'videí' }, { num: 20, suf: '+', lab: 'hodin obsahu' }, { txt: '∞', lab: 'doživotní přístup' }],
        src: ['VK: „182 VIDEÍ · 20+ HODIN OBSAHU · ∞ DOŽIVOTNÍ PŘÍSTUP“'] },
      { type: 'rows', t: [10, 12.5], cap: 'A k tomu [[bonusy]].', stagger: .2,
        rows: [{ ico: 'calc', lab: 'Kalkulačka maker' }, { ico: 'pot', lab: 'Kuchařka 40+ receptů' }, { ico: 'spark', lab: 'Generátor receptů' }],
        src: ['VK: „Kalkulačka makroživin“, „Kuchařka 40+ receptů“, „Generátor receptů“'] },
      { type: 'cta', t: [12.5, 15], label: 'Videokurz výživy', price: CENY.videokurz, unit: 'jednorázově, doživotně',
        box: 'Nebo [[zdarma]] k první platbě\nappky Tvůj Coach VIP', url: 'martinbarna.cz/videokurz',
        src: ['VK: „Jednorázově 1 490 Kč, doživotní přístup“', 'VK: „Nebo ho dostaneš zdarma k první platbě appky Tvůj Coach VIP.“', 'URL: canonical videokurz.html = https://martinbarna.cz/videokurz'] }
    ],
    cover: { h: 'Pizza a výsledky?\n[[Ukážu ti jak.]]', bg: FOTO + 'hero-2048.jpg', bgPos: '50% 20%', label: 'Videokurz výživy · 182 videí', price: CENY.videokurz, unit: 'jednorázově', url: 'martinbarna.cz/videokurz' }
  },

  'videokurz-30': {
    title: 'Videokurz výživy, 30 s', dur: 30, music: 'vk',
    scenes: [
      { type: 'hook', t: [0, 3], logo: true, h: 'Kalorie, bílkoviny,\nsacharidy, tuky.', sub: '[[Kde začít?]]', subAt: 1.1,
        src: ['VK: „první 4 základy (kalorie, bílkoviny, tuky, sacharidy)“'] },
      { type: 'card', t: [3, 8], cap: '[[Šest modulů]], od základů\npo pokročilé strategie.', img: IMG + 'vk-moduly.png', w: 720, pan: [.08, .62],
        src: ['VK: „Šest modulů, od základů po pokročilé strategie.“', 'Výřez sekce „Co se naučíš“ z videokurz.html (mobil)'] },
      { type: 'stats', t: [8, 12], stagger: .35,
        stats: [{ num: 182, lab: 'videí' }, { num: 20, suf: '+', lab: 'hodin obsahu' }, { txt: '∞', lab: 'doživotní přístup' }],
        src: ['VK: „182 VIDEÍ · 20+ HODIN OBSAHU · ∞ DOŽIVOTNÍ PŘÍSTUP“'] },
      { type: 'card', t: [12, 16.5], cap: '[[26 bonusových materiálů]]\nv ceně.', sub: 'Kalkulačka, kuchařka, e-booky, tréninkový plán.', img: IMG + 'vk-bonusy.png', w: 720, pan: [.05, .55],
        src: ['VK: „Ke kurzu dostaneš 26 bonusových materiálů“', 'VK: „Kalkulačka, generátor receptů, kuchařka 40+, e-booky, výpočty, tréninkový plán a další.“'] },
      { type: 'photo', t: [16.5, 20.5], img: FOTO + 'hero-2048.jpg', pos: '50% 20%', cap: 'Stejný systém, který učím\nklienty v [[koučinku]].', sub: 'Vlastním tempem, na mobilu i počítači.',
        src: ['VK: „stejný systém, který učím klienty v osobním koučinku, jen vlastním tempem“', 'VK: „Na mobilu, tabletu i počítači.“'] },
      { type: 'text', t: [20.5, 24], h: 'Nejdřív [[ochutnej]].', sub: '11 lekcí zdarma.\nStačí nechat e-mail.',
        src: ['VK: „Pusť si 11 lekcí zdarma … stačí nechat e-mail.“'] },
      { type: 'cta', t: [24, 30], label: 'Videokurz výživy', price: CENY.videokurz, unit: 'jednorázově, doživotně',
        box: 'Nebo [[zdarma]] k první platbě\nappky Tvůj Coach VIP', url: 'martinbarna.cz/videokurz', small: '14denní záruka vrácení peněz.',
        src: ['VK: „1 490 Kč · Doživotní přístup, bez měsíčních poplatků“', 'VK: „Nebo ho dostaneš zdarma k první platbě appky Tvůj Coach VIP.“', 'VK: „14denní záruka vrácení peněz.“'] }
    ],
    cover: { h: 'Výživa od základů.\n[[182 videí.]]', shot: IMG + 'vk-moduly.png', shotNat: 975, shotTop: 330, shotW: 640, label: 'Videokurz výživy', price: CENY.videokurz, unit: 'jednorázově', url: 'martinbarna.cz/videokurz' }
  },

  /* ───────────── 4) Barna Academy pro trenéry ───────────── */
  'academy-15': {
    title: 'Barna Academy, 15 s', dur: 15, music: 'academy',
    scenes: [
      { type: 'hook', t: [0, 3], logo: true, kicker: 'Pro trenéry a výživové poradce', h: 'Klient chce jídelníček.\n[[Máš ho za pár vteřin?]]',
        src: ['AK: „Jídelníček na míru za pár vteřin.“', 'AK: „VZDĚLÁVACÍ PROGRAM PRO TRENÉRY“'] },
      { type: 'card', t: [3, 6.5], cap: 'Generátor spočítá makra\na poskládá [[celý den]].', sub: 'Dáš ho klientovi pod svým jménem.', img: AK_IMG + '03-generator-cz-mobil.webp', w: 620, pan: [0, .5],
        src: ['AK: „Zadáš údaje klienta a systém spočítá makra i poskládá hotový denní jídelníček z běžných potravin. Dáš ho klientovi pod svým jménem.“'] },
      { type: 'card', t: [6.5, 10], cap: 'AI Martin zná\n[[všech 256 lekcí]].', sub: 'Odpoví a ukáže, kde to najdeš.', img: AK_IMG + '04-ai-martin-mobil.webp', w: 620, pan: [0, .45],
        src: ['AK: „AI Martina. Zná všech 256 lekcí, mluví jako já a odpoví ti hned.“', 'AK: „Odpoví a rovnou ukáže, kde to je“'] },
      { type: 'stats', t: [10, 12.5], stagger: .25,
        stats: [{ num: 24, lab: 'modulů' }, { num: 256, lab: 'lekcí' }],
        src: ['AK: „24 modulů · 256 lekcí“'] },
      { type: 'cta', t: [12.5, 15], label: 'Barna Academy', price: CENY.academyMesic, unit: '/ měsíc',
        alt: 'nebo ' + CENY.academy + ' doživotně', url: 'martinbarna.cz/akademie',
        src: ['AK: „Měsíční členství 990 Kč / měsíc“', 'AK: „Doživotní přístup 8 900 Kč jednorázově“', 'URL: canonical akademie/index.html = https://martinbarna.cz/akademie/'] }
    ],
    cover: { kicker: 'Pro trenéry a výživové poradce', h: 'Jídelníček klientovi\n[[za pár vteřin]]', shot: AK_IMG + '03-generator-cz-mobil.webp', shotTop: 160, label: 'Barna Academy', price: CENY.academyMesic, unit: '/ měsíc', url: 'martinbarna.cz/akademie' }
  },

  'academy-30': {
    title: 'Barna Academy, 30 s', dur: 30, music: 'academy',
    scenes: [
      { type: 'hook', t: [0, 3], logo: true, kicker: 'Barna Academy pro trenéry', h: 'Studuješ v deset večer\na [[nemáš se koho zeptat]]?',
        src: ['AK: „Studuješ v deset večer, narazíš na něco, čemu nerozumíš, a nemáš se koho zeptat.“'] },
      { type: 'card', t: [3, 7], cap: 'AI Martin zná všech\n[[256 lekcí]] a odpoví hned.', sub: 'Je u každé lekce, ve dne v noci.', img: AK_IMG + '04-ai-martin-mobil.webp', w: 600, pan: [0, .5],
        src: ['AK: „Zná všech 256 lekcí, mluví jako já a odpoví ti hned. Je u každé lekce, ve dne v noci“'] },
      { type: 'card', t: [7, 11], cap: 'Každá lekce [[prakticky]].', sub: 'Co uděláš s klientem v pondělí.', img: AK_IMG + '02-lekce-mobil.webp', w: 640, pan: [0, .4],
        src: ['AK: „Každá lekce prakticky: co uděláš s klientem v pondělí.“'] },
      { type: 'card', t: [11, 15], cap: 'Jídelníček na míru\n[[za pár vteřin]].', sub: 'Pod tvým jménem.', img: AK_IMG + '03-generator-cz-mobil.webp', w: 640, pan: [0, .5],
        src: ['AK: „Jídelníček na míru za pár vteřin.“', 'AK: „Dáš ho klientovi pod svým jménem.“'] },
      { type: 'rows', t: [15, 19], cap: 'Hotové nástroje\n[[pro praxi]].', stagger: .3,
        rows: [{ ico: 'dumbbell', lab: 'Generátor tréninků', desc: 'fitko, doma i venku' }, { ico: 'list', lab: 'Databáze 128 cviků', desc: 's provedením a chybami' }, { ico: 'doc', lab: 'Materiály pod tvým jménem', desc: 'přílohy, kuchařky, plány' }],
        src: ['AK: „Generátor tréninků … Fitko, doma i venku“', 'AK: „Databáze cviků · 128 cviků s provedením krok za krokem a nejčastějšími chybami“', 'AK: „Rebrandovatelné science-based materiály · Profi přílohy, kuchařky, plány a průvodce, přebrandované na tvoje jméno“'] },
      { type: 'photo', t: [19, 22.5], img: FOTO + 'prednaska.jpg', pos: '40% 40%', cap: 'Certifikát po testu\na [[případovce]].', sub: 'Tu čtu osobně.',
        src: ['AK: „Certifikát Barna Academy po testu a případovce, kterou čtu osobně.“'] },
      { type: 'stats', t: [22.5, 25.5], stagger: .25,
        stats: [{ num: 256, lab: 'lekcí ve 24 modulech' }, { num: 182, lab: 'videí videokurzu v ceně' }],
        src: ['AK: „256 lekcí ve 24 modulech“', 'AK: „Videokurz výživy (182 videí) v ceně“'] },
      { type: 'cta', t: [25.5, 30], label: 'Barna Academy', price: CENY.academyMesic, unit: '/ měsíc', alt: 'nebo ' + CENY.academy + ' doživotně',
        box: 'Appka Tvůj Coach VIP\n[[v ceně obou variant]]', url: 'martinbarna.cz/akademie', small: '14denní záruka vrácení peněz.',
        src: ['AK: „990 Kč / měsíc“, „8 900 Kč jednorázově“', 'AK: „Appka Tvůj Coach je v ceně u obou variant.“', 'AK: „14denní záruka vrácení peněz“'] }
    ],
    cover: { kicker: 'Pro trenéry a výživové poradce', h: '256 lekcí, generátory\na [[AI Martin]]', bg: FOTO + 'prednaska.jpg', bgPos: '40% 40%', label: 'Barna Academy', price: CENY.academyMesic, unit: '/ měsíc', url: 'martinbarna.cz/akademie' }
  },

  /* ───────────── 5) Individuální koučink ───────────── */
  'koucing-15': {
    title: 'Online koučink, 15 s', dur: 15, music: 'koucing',
    scenes: [
      { type: 'hook', t: [0, 3], logo: true, h: 'Kdo ti každý týden\n[[projde čísla]]?',
        src: ['KO: „každý týden projdu tvoje čísla a upravím plán“'] },
      { type: 'photo', t: [3, 6.5], img: FOTO + 'koucink.jpg', pos: '18% 30%', cap: '[[Já.]] Projdu váhu, míry\na to, jak šel týden.', sub: 'A upravím cíle i aktivity.',
        src: ['KO: „Každý týden projdu tvoji váhu, míry a to, jak šel týden, a upravím cíle i aktivity.“'] },
      { type: 'rows', t: [6.5, 10], cap: 'Co v koučinku [[máš]].', stagger: .3,
        rows: [{ ico: 'plate', lab: 'Jídlo, které tě baví', desc: 'vejde se i pizza' }, { ico: 'chat', lab: 'Podpora po ruce', desc: 'e-mail a WhatsApp, po–pá' }, { ico: 'phone', lab: 'Appka Tvůj Coach v ceně', desc: 'po celou dobu koučinku' }],
        src: ['KO: „Jídlo, které tě baví … Vejde se i pizza.“', 'KO: „Podpora po ruce · E-mail a WhatsApp (po–pá).“', 'KO (Gold): „Appka Tvůj Coach v ceně po celou dobu koučinku“'] },
      { type: 'text', t: [10, 12.5], h: 'Koučink beru jen\nv [[omezeném počtu]].',
        src: ['KO: „Koučink beru jen v omezeném počtu, aby měl každý klient mou plnou pozornost“'] },
      { type: 'cta', t: [12.5, 15], label: 'Online koučink Gold', price: CENY.gold, unit: '/ měsíc', url: 'martinbarna.cz/koucing', small: 'Nebo mi nejdřív nezávazně napiš.',
        src: ['KO: „Gold · 6 450 Kč / měsíc“', 'KO: „NEZÁVAZNĚ MI NAPSAT“', 'URL: canonical koucing/index.html = https://martinbarna.cz/koucing/'] }
    ],
    cover: { h: 'Každý týden\n[[nový plán od kouče]]', bg: FOTO + 'koucink.jpg', bgPos: '18% 30%', label: 'Online koučink · Martin Barna', price: CENY.gold, unit: '/ měsíc', url: 'martinbarna.cz/koucing' }
  },

  'koucing-30': {
    title: 'Online koučink, 30 s', dur: 30, music: 'koucing',
    scenes: [
      { type: 'hook', t: [0, 3], logo: true, h: 'Týdenní report\n[[za 3 minuty]]\nz mobilu.', sub: 'A já ti upravím plán.', subAt: 1.0,
        src: ['KO: „Týdenní report naklikáš za 3 minuty z mobilu.“', 'KO: „Pošleš report … já ho projdu, napíšu ti analýzu a upravím čísla.“'] },
      { type: 'card', t: [3, 7.5], cap: 'Jak spolupráce [[probíhá]].', img: IMG + 'ko-kroky.png', w: 760, pan: [0, .2],
        src: ['KO: „Jak spolupráce probíhá · 1 Napíšeš mi · 2 Dostaneš plán na míru · 3 Týdenní kontroly“', 'Výřez sekce z koucing/index.html (mobil)'] },
      { type: 'text', t: [7.5, 11], h: 'Do [[48 hodin]] od dotazníku\nmáš kalorie, makra,\njídelníček i trénink.',
        src: ['KO: „Do 48 hodin od tebe máš spočítané kalorie a makra, jídelníček a trénink.“ (po vyplnění vstupního dotazníku)'] },
      { type: 'photo', t: [11, 15], img: FOTO + 'koucink.jpg', pos: '18% 30%', cap: 'Každý týden projdu\n[[tvoje čísla]].', sub: 'Napíšu ti analýzu a upravím plán.',
        src: ['KO: „každý týden projdu tvoje čísla a upravím plán“', 'KO: „Já ho vyhodnotím, napíšu ti analýzu a upravím čísla.“'] },
      { type: 'rows', t: [15, 19.5], cap: 'V ceně [[každého balíčku]].', stagger: .28,
        rows: [{ ico: 'phone', lab: 'Appka Tvůj Coach' }, { ico: 'spark', lab: 'AI Martin, kouč 24/7' }, { ico: 'chart', lab: 'Klientská sekce s grafy' }, { ico: 'play', lab: 'Videokurz (182 videí)' }],
        src: ['KO: „Ke koučinku dostaneš vlastní digitální zázemí, v ceně každého balíčku.“', 'KO: „Moderní klientská sekce … Grafy váhy, měr a pokroku“, „Appka Tvůj Coach“, „AI Martin: kouč 24/7“, „Videokurz v ceně · 182 videí“'] },
      { type: 'card', t: [19.5, 23], cap: '[[Gold]] si vybírá většina.', img: IMG + 'ko-gold.png', w: 720, pan: [0, .3],
        src: ['KO: „Gold · Vedení na dálku, tohle si vybírá většina“', 'Výřez karty Gold z koucing/index.html (mobil)'] },
      { type: 'text', t: [23, 26], h: 'Koučink beru jen\nv [[omezeném počtu]].', sub: 'Aby měl každý klient moji plnou pozornost.',
        src: ['KO: „Koučink beru jen v omezeném počtu, aby měl každý klient mou plnou pozornost a výsledky.“'] },
      { type: 'cta', t: [26, 30], label: 'Online koučink Gold', price: CENY.gold, unit: '/ měsíc',
        box: 'Konzultace ' + CENY.konzultace + ' ti při objednávce\nkoučinku do 14 dní [[odečtu]]', url: 'martinbarna.cz/koucing',
        src: ['KO: „Gold · 6 450 Kč / měsíc“', 'KO: „Když si do 14 dní po konzultaci objednáš online koučink, cenu konzultace (2 990 Kč) ti odečtu z ceny balíčku.“'] }
    ],
    cover: { h: 'Report za 3 minuty.\n[[Plán upravím já.]]', bg: FOTO + 'hero-2048.jpg', bgPos: '50% 20%', label: 'Online koučink · Martin Barna', price: CENY.gold, unit: '/ měsíc', url: 'martinbarna.cz/koucing' }
  }
};
