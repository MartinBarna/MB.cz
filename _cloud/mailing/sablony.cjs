// NAVRH MAILU (9. 10. 2026, vetev cloud/mailing-navrh-1009). JEDINY ZDROJ TEXTU.
// Z tohohle souboru `generuj.cjs` vyrobi HTML nahledy (nahledy/) a SQL navrh (01-*.sql, 03-*.sql).
// Texty jsou NAVRH. Sef je projede hlasem Martina, finalni znení schvaluje Martin.
//
// Pravidla, ktera tu plati (kontroluje je `generuj.cjs`, pri poruseni spadne):
//  - ⛔ zadna cena cislem: jen {{cena_vip_mesic}}, {{cena_vip_rok}}, {{cena_basic_mesic}}, {{course_price}}
//  - ⛔ zadna dlouha pomlcka (U+2014)
//  - ⛔ prave jedno tlacitko (btn) v kazdem mailu, s UTM
//  - promenne jen ty, ktere drip-send zna (seznam v generuj.cjs)
//  - gender tokeny drip-sendu: [a] = zenska koncovka, [[zena||muz]]
//
// Klic `subject` jde do DB. `subject_b` je druha varianta predmetu pro rucni A/B
// (engine A/B predmetu neumi, viz MAILING-NAVRH-1009.md, kap. 6).

const UTM = (track, content) =>
  `utm_source=email&utm_medium=drip&utm_campaign=${track}&utm_content=${content}`;

// VIP pokladna bez uctu (stejna jako na /tvuj-coach/ od 29. 9. 2026).
const KOUPIT_VIP = (track, content) => `https://tvujcoach.cz/koupit?plan=vip&${UTM(track, content)}`;
// Predplatne pro PRIHLASENEHO uzivatele appky. ⚠️ `plan=vip` na teto adrese je NEOVERENY
// (zive maily pouzivaji jen `plan=basic`). Pred spustenim overit v repu appky, jinak KOUPIT_VIP.
const PREDPLATNE_VIP = (track, content) => `https://tvujcoach.cz/client/subscription?plan=vip&${UTM(track, content)}`;

const p = (html) => ({ t: 'p', html });
const ps = (html) => ({ t: 'ps', html });
const ul = (...items) => ({ t: 'bullets', items });
const btn = (text, href) => ({ t: 'btn', text, href });
const AHOJ = p('Ahoj{{fn_space}},');
const PODPIS = p('<strong>Be Effective!</strong><br>Martin');
const DAREK_VIP = '🎁 K první platbě VIP ti přidám svůj videokurz výživy: 182 videí, hodnota {{course_price}} Kč. Zůstane ti, i když předplatné zrušíš.';
const ZARUKA = 'Zrušíš kdykoli v appce. Když ti to do 14 dnů nesedne, vrátím ti peníze.';

// ============================================================================
// TRAŤ 1: vip-free  (Free uživatelé appky, kteří zapisují a neplatí)
// ============================================================================
const VF = 'vip-free';
const vipFree = [
  {
    track: VF, step: 0, key: 'vf-1-zapisujes', wait_days: 3,
    subject: 'Zapisuješ. Teď ať s tím appka něco udělá',
    subject_b: 'Tvoje zápisy umí víc, než ti teď ukazují',
    preheader: 'Co se ve VIP stane s daty, která v appce už máš.',
    blocks: [
      AHOJ,
      p('v appce už nějaký čas zapisuješ. To je ta těžší půlka a máš ji za sebou.'),
      p('Druhá půlka je vědět, co s čísly udělat. Check-in si ve Free vyplníš a rozbor uvidíš. Ve <strong>VIP</strong> podle něj appka přepočítá kalorie a makra na další týden, podle toho, co jsi opravdu snědl[a], a podle toho, jak se hnula váha.'),
      p('K tomu AI kouč, který tvoje zápisy vidí. Napíšeš mu „proč mi appka zvedla sacharidy?“ a odpoví nad tvými čísly. Čísla počítá engine, AI ti je vysvětlí.'),
      p(DAREK_VIP),
      btn('Přejít na VIP za {{cena_vip_mesic}} Kč', PREDPLATNE_VIP(VF, 'vf-1')),
      p('Zrušíš kdykoli v Profilu. Když ti to do 14 dnů nesedne, vrátím ti peníze.'),
      PODPIS,
      ps('P.S. Free ti zůstává napořád. Nic z toho, co teď v appce používáš, ti nevezmu.'),
    ],
  },
  {
    track: VF, step: 1, key: 'vf-2-foto-hlas', wait_days: 4,
    subject: 'Zapsat oběd za pět vteřin',
    subject_b: 'Vyfoť talíř. Makra spočítá appka',
    preheader: 'Foto a hlas ve VIP: zápis, který tě nezdrží.',
    blocks: [
      AHOJ,
      p('za třináct let s klienty vidím pořád totéž: kdo zápis vzdá, vzdá ho většinou proto, že ho zdržuje.'),
      p('Proto jsou ve VIP dvě zkratky:'),
      ul(
        '<strong>Foto jídla.</strong> Vyfotíš talíř, klidně domácí kuchyni bez obalu. AI pozná i víc jídel na jedné fotce a odhadne kalorie a makra. Odhad vidíš a opravíš, než se zapíše.',
        '<strong>Zápis hlasem.</strong> Řekneš „rohlík, tvaroh dvě stě gramů a tři deci vody“ a appka větu rozebere. Potvrdíš, nebo opravíš.',
      ),
      p('Snídani, kterou máš pětkrát týdně, zapíšeš i ve Free jedním ťuknutím ze šablony. Foto a hlas ti ušetří čas u všeho ostatního.'),
      btn('Vyzkoušet VIP', PREDPLATNE_VIP(VF, 'vf-2')),
      PODPIS,
      ps('P.S. K první platbě VIP dostaneš i videokurz výživy zdarma.'),
    ],
  },
  {
    track: VF, step: 2, key: 'vf-3-ai-kouc', wait_days: 4,
    subject: 'Zeptej se ve dvě ráno',
    subject_b: 'Kouč, který vidí tvoje čísla',
    preheader: 'AI kouč ve VIP odpovídá podle mojí metodiky a jídlo zapíše za tebe.',
    blocks: [
      AHOJ,
      p('otázky, které mi klienti léta posílají na WhatsApp, se opakují:'),
      ul(
        '„Váha se týden nehýbe. Mám ubrat?“',
        '„Po tréninku mi zbývá 300 kcal. Co si dám?“',
        '„Jsem na oslavě. Jak to zapsat, ať si nezkazím týden?“',
      ),
      p('Ve VIP na ně odpovídá AI kouč. Vidí tvoje zápisy i vývoj váhy a odpovídá podle metodiky, se kterou pracuju s klienty od roku 2013. Když mu napíšeš, co jsi snědl[a], rovnou to zapíše.'),
      p('Kalorie a makra počítá engine. AI ti je vysvětlí a pomůže s rozhodnutím na dnešek.'),
      btn('Napsat AI koučovi ve VIP', PREDPLATNE_VIP(VF, 'vf-3')),
      PODPIS,
      ps('P.S. Basic za {{cena_basic_mesic}} Kč umí přepočet cílů a generátory, AI kouče, foto ani hlas ale nemá. Proto ti doporučuju VIP.'),
    ],
  },
  {
    track: VF, step: 3, key: 'vf-4-shrnuti', wait_days: null,
    // ⛔ KONEC TRATI = otazka „a co potom?" (CLAUDE.md, 6. 8. 2026): po dojeti lead sebere
    //    `enroll_into_longtail` (7:50) a posle ho do longtail-consumer. Most neni potreba.
    subject: 'Free, Basic, nebo VIP? Shrnutí na jednu obrazovku',
    subject_b: 'Poslední mail o předplatném z téhle řady',
    preheader: 'Ať se rozhodneš v klidu. Free ti zůstává tak jako tak.',
    blocks: [
      AHOJ,
      p('tohle je poslední mail o předplatném z téhle řady. Shrnu ti to na jednu obrazovku:'),
      ul(
        '<strong>Free (zdarma, napořád):</strong> zápis jídla i tréninku, skener čárových kódů, přes {{pocet_potravin}} potravin, šablony a 14 dní historie.',
        '<strong>Basic ({{cena_basic_mesic}} Kč měsíčně):</strong> navíc týdenní přepočet kalorií a maker, generátor jídelníčku i tréninku a celá historie.',
        '<strong>VIP ({{cena_vip_mesic}} Kč měsíčně):</strong> všechno z Basicu, k tomu AI kouč, foto jídla a zápis hlasem. A k první platbě videokurz výživy zdarma.',
      ),
      p('Když víš, že do toho jdeš na delší dobu, roční VIP vyjde na {{cena_vip_rok}} Kč, tedy dva měsíce zdarma. K ročnímu VIP navíc přidávám měsíc Barna Academy na zkoušku.'),
      btn('Vybrat VIP', PREDPLATNE_VIP(VF, 'vf-4')),
      p('Zrušíš kdykoli v Profilu, zaplacené období doběhne a dál se nic nestrhne. Do 14 dnů od začátku ti vrátím celou částku, když ti to nesedne.'),
      p('A když zůstaneš ve Free, taky dobře. Zapisuj dál, to je půlka práce.'),
      PODPIS,
      ps('P.S. Jestli tě od předplatného něco drží, odpověz mi jednou větou na tenhle mail. Čtu to sám.'),
    ],
  },
];

// ============================================================================
// TRAŤ 2: vip-kupci  (majitelé videokurzu bez appky, bez Academy, bez koučinku)
// ============================================================================
const VK = 'vip-kupci';
const vipKupci = [
  {
    track: VK, step: 0, key: 'vk-1-v-pondeli', wait_days: 4,
    subject: 'Kurz máš v hlavě. Kdo ti to spočítá v pondělí?',
    subject_b: 'Z videokurzu do praxe za minutu denně',
    preheader: 'Appka Tvůj Coach dělá s tvými čísly to, co učím ve videokurzu.',
    blocks: [
      AHOJ,
      p('ve videokurzu jsi viděl[a], jak počítám kalorie a makra a proč mě zajímá vývoj váhy za týdny víc než jedno ranní vážení.'),
      p('V praxi to znamená každý týden sečíst, co jsi snědl[a], porovnat to s váhou a rozhodnout, jestli ubrat, přidat, nebo vydržet. Tohle za tebe dělá appka <strong>Tvůj Coach</strong>.'),
      p('Ve <strong>VIP</strong> ti z tvých zápisů každý týden přepočítá kalorie a makra a poskládá jídelníček z běžných potravin i trénink podle toho, kde cvičíš. AI kouč ti odpoví na otázky podle stejné metodiky, jakou znáš z kurzu.'),
      btn('Chci VIP za {{cena_vip_mesic}} Kč měsíčně', KOUPIT_VIP(VK, 'vk-1')),
      p(ZARUKA),
      PODPIS,
      ps('P.S. Zápis jídla i tréninku máš v appce zdarma napořád. Registruj se ideálně stejným e-mailem, jaký máš u videokurzu.'),
    ],
  },
  {
    track: VK, step: 1, key: 'vk-2-zbyva', wait_days: 4,
    subject: 'Kolik ti dneska ještě zbývá{{fn_suffix}}?',
    subject_b: 'Vyfoť oběd. Zbytek spočítá appka',
    preheader: 'Tři situace, kde ti VIP ušetří nejvíc času.',
    blocks: [
      AHOJ,
      p('z praxe vím, že přesnost zápisu rozhoduje víc než dokonale vyladěná makra. Lidi svůj příjem běžně podceňují o 20 až 50 %. Ve VIP na to máš tři zkratky:'),
      ul(
        '<strong>Večer ti zbývá 400 kcal.</strong> Zeptáš se AI kouče, co si dát, a on ti to rovnou zapíše.',
        '<strong>Oběd venku bez obalu.</strong> Vyfotíš talíř, AI odhadne jídla i makra a ty odhad před zápisem zkontroluješ.',
        '<strong>Nechce se ti ťukat.</strong> Řekneš „rohlík, tvaroh dvě stě gramů“ a appka to rozebere sama.',
      ),
      btn('Vyzkoušet VIP', KOUPIT_VIP(VK, 'vk-2')),
      PODPIS,
      ps('P.S. Teorii z kurzu máš. Appka ti pomůže udělat z ní zvyk.'),
    ],
  },
  {
    track: VK, step: 2, key: 'vk-3-basic-nebo-vip', wait_days: 5,
    subject: 'Basic, nebo VIP? Napíšu ti to narovinu',
    subject_b: 'Proč ti doporučuju dražší plán',
    preheader: 'Rozdíl je v tom, kdo ti odpoví, když nevíš.',
    blocks: [
      AHOJ,
      p('v appce jsou dva placené plány a chci, abys věděl[a], proč ti doporučuju ten dražší.'),
      p('<strong>Basic</strong> za {{cena_basic_mesic}} Kč měsíčně ti každý týden přepočítá cíle a má generátor jídelníčku i tréninku. To je počítání.'),
      p('<strong>VIP</strong> za {{cena_vip_mesic}} Kč měsíčně umí totéž a k tomu AI kouče, foto jídla a zápis hlasem. Teorii znáš z kurzu, takže ti nejvíc pomůže mít po ruce někoho, kdo ti ve chvíli zaváhání řekne, co s dnešním číslem.'),
      p('Když víš, že u toho vydržíš, vezmi rovnou rok. Vyjde na {{cena_vip_rok}} Kč, tedy dva měsíce zdarma, a k ročnímu VIP přidávám měsíc Barna Academy na zkoušku.'),
      btn('Chci VIP', KOUPIT_VIP(VK, 'vk-3')),
      p('Zrušíš kdykoli. Do 14 dnů od začátku předplatného ti vrátím celou částku, když ti to nesedne.'),
      PODPIS,
    ],
  },
  {
    track: VK, step: 3, key: 'vk-4-posledni', wait_days: null,
    // ⛔ KONEC TRATI: po dojeti lead sebere `enroll_into_longtail` → longtail-kupci
    //    (nebo evergreen-kupci, kdo uz longtail-kupci mel). Most neni potreba.
    subject: 'Poslední mail o appce z téhle řady',
    subject_b: 'Jedno rozhodnutí na tenhle měsíc',
    preheader: 'Žádný odpočet. Jen shrnutí.',
    blocks: [
      AHOJ,
      p('tohle je poslední mail o appce z téhle řady. Cena zítra platí stejně, nikde neběží žádný odpočet.'),
      p('Shrnu to jednou větou: videokurz ti dal pravidla a VIP ti je každý týden přepočítá na tvoje čísla, s AI koučem po ruce.'),
      p('U klientů vidím, že teorie bez denní praxe vydrží pár týdnů. S týdenním přepočtem z ní je návyk.'),
      btn('Vzít VIP za {{cena_vip_mesic}} Kč', KOUPIT_VIP(VK, 'vk-4')),
      p('Když teď není ta chvíle, nic se neděje. Dál ti budu psát o výživě jako dosud.'),
      PODPIS,
      ps('P.S. Napiš mi jednou větou, co ti z kurzu v praxi nejde. Čtu to sám.'),
    ],
  },
];

// ============================================================================
// TRAŤ 3: vip-leady  (leady bez nákupu, kterým dojela akviziční trať)
// ============================================================================
const VL = 'vip-leady';
const vipLeady = [
  {
    track: VL, step: 0, key: 'vl-1-kdo-upravi', wait_days: 3,
    subject: 'Plán máš. Kdo ti ho bude upravovat?',
    subject_b: 'Co dělat, když se váha tři týdny nehne{{fn_suffix}}',
    preheader: 'Appka, která z tvých zápisů každý týden přepočítá cíl. K první platbě VIP videokurz zdarma.',
    blocks: [
      AHOJ,
      p('pár týdnů ti posílám tipy. Jestli sis podle nich spočítal[a] kalorie, máš za sebou první krok.'),
      p('Pak přijde týden, kdy se váha nehne, a nikdo vedle tebe neřekne, jestli ubrat, přidat, nebo vydržet. U klientů vidím, že tady to lidi vzdávají nejčastěji.'),
      p('Na tohle jsem postavil appku <strong>Tvůj Coach</strong>. Ve <strong>VIP</strong> ti každý týden z tvých zápisů a vážení přepočítá kalorie i makra, sestaví jídelníček z běžných potravin a trénink podle toho, kde cvičíš. K tomu AI kouč, který tvoje čísla vidí. Čísla počítá engine, AI ti je vysvětlí.'),
      p(DAREK_VIP),
      btn('Chci VIP za {{cena_vip_mesic}} Kč měsíčně', KOUPIT_VIP(VL, 'vl-1')),
      p(ZARUKA),
      PODPIS,
      ps('P.S. Zapisovat jídlo i trénink můžeš v appce zdarma napořád a bez karty. VIP platíš za to, že s těmi čísly appka pracuje za tebe.'),
    ],
  },
  {
    track: VL, step: 1, key: 'vl-2-zbyva-400', wait_days: 3,
    subject: 'Zbývá ti 400 kcal. Co si dáš?',
    subject_b: 'Oběd venku a appka, která ví, kolik ti zbývá',
    preheader: 'Dvě funkce z VIP, kvůli kterým lidi u zápisu vydrží.',
    blocks: [
      AHOJ,
      p('dvě situace, které znám od klientů nazpaměť.'),
      p('<strong>Večer.</strong> Zbývá ti 400 kcal a 30 g bílkovin a v lednici je toho moc i málo zároveň. Ve VIP se zeptáš AI kouče, co si dát, a on ti to rovnou zapíše.'),
      p('<strong>Oběd venku.</strong> Žádný obal, žádný čárový kód. Vyfotíš talíř, AI odhadne jídla i makra a ty odhad před zápisem zkontroluješ.'),
      p('Proč na tom trvám: lidi svůj příjem běžně podceňují o 20 až 50 %. Čím míň tě zápis zdržuje, tím déle u něj vydržíš a tím víc ti čísla řeknou.'),
      btn('Vyzkoušet VIP', KOUPIT_VIP(VL, 'vl-2')),
      PODPIS,
      ps('P.S. K první platbě VIP pořád platí videokurz výživy zdarma.'),
    ],
  },
  {
    track: VL, step: 2, key: 'vl-3-videokurz', wait_days: 4,
    subject: 'Proč k VIP přidávám celý videokurz',
    subject_b: '182 videí k tomu, co v appce zapisuješ',
    preheader: 'Appka počítá. Videokurz vysvětluje, proč počítá zrovna takhle.',
    blocks: [
      AHOJ,
      p('appka ti každý den řekne, kolik jíst. Kdo ale neví, proč zrovna tolik, při první oslavě nebo dovolené to pustí.'),
      p('Proto k první platbě VIP přidávám videokurz výživy. 182 videí o tom, jak funguje kalorický deficit, kolik bílkovin, sacharidů a tuků jíst a jak jíst flexibilně bez zakázaných jídel.'),
      p('Samostatně stojí {{course_price}} Kč. K VIP ho máš zdarma a zůstane ti, i když předplatné po měsíci zrušíš.'),
      btn('Chci VIP i s videokurzem', KOUPIT_VIP(VL, 'vl-3')),
      PODPIS,
      ps('P.S. Cíl je, abys za pár měsíců věděl[a], co dělat, i bez appky a beze mě. Na to je ten kurz.'),
    ],
  },
  {
    track: VL, step: 3, key: 'vl-4-namitky', wait_days: 4,
    subject: 'Tři důvody, proč appku nechceš, a co na ně říkám',
    subject_b: 'Nechce se ti platit za appku? Rozumím',
    preheader: 'Zapisování, cena a co když to nevydržím.',
    blocks: [
      AHOJ,
      p('když lidem nabídnu appku, slyším nejčastěji tři věci. Odpovím ti rovnou.'),
      p('<strong>„Nebaví mě zapisovat.“</strong> Proto je ve VIP zápis z fotky a hlasem. Řekneš „rohlík, tvaroh dvě stě gramů“ a appka to rozebere. Snídani, kterou máš pětkrát týdně, zapíšeš jedním ťuknutím.'),
      p('<strong>„Nechci další předplatné.“</strong> Zápis jídla i tréninku, skener a databáze potravin jsou zdarma napořád. Za VIP platíš týdenní přepočet cílů, generátory a AI kouče. Když AI nepotřebuješ, v appce je i Basic za {{cena_basic_mesic}} Kč, jen bez kouče a bez videokurzu.'),
      p('<strong>„Co když to nevydržím?“</strong> Zrušíš kdykoli v appce a zaplacené období doběhne. Když ti to do 14 dnů od začátku nesedne, napiš mi na martin@martinbarna.cz a vrátím ti celou částku. Videokurz při vrácení peněz odchází s nimi.'),
      btn('Vzít VIP za {{cena_vip_mesic}} Kč', KOUPIT_VIP(VL, 'vl-4')),
      PODPIS,
    ],
  },
  {
    track: VL, step: 4, key: 'vl-5-posledni', wait_days: null,
    // ⛔ KONEC TRATI: po dojeti lead sebere `enroll_into_longtail` → longtail-consumer.
    subject: 'Poslední mail o appce z téhle řady',
    subject_b: 'Rok VIP za cenu deseti měsíců',
    preheader: 'Žádný odpočet. Jen shrnutí, ať se rozhodneš v klidu.',
    blocks: [
      AHOJ,
      p('tohle je poslední mail o appce z téhle řady. Cena zítra platí stejně, takže se rozhoduj v klidu.'),
      p('Shrnu to do jednoho odstavce. VIP je celá appka: týdenní přepočet kalorií a maker podle tvých zápisů, jídelníček i trénink, AI kouč, foto a hlas. K první platbě videokurz výživy zdarma.'),
      p('Když víš, že to chceš dělat dlouhodobě, vezmi rovnou rok. Vyjde na {{cena_vip_rok}} Kč, tedy dva měsíce zdarma, a k ročnímu VIP přidávám měsíc Barna Academy na zkoušku. Měsíční i roční variantu máš v pokladně vedle sebe.'),
      btn('Vybrat VIP', KOUPIT_VIP(VL, 'vl-5')),
      p('Když teď není ta chvíle, nic se neděje. Dál ti budu posílat tipy jako dosud.'),
      PODPIS,
      ps('P.S. Zapisovat můžeš zdarma i bez předplatného. Kdo zapisuje, má půlku práce za sebou.'),
    ],
  },
];

// ============================================================================
// OPRAVA P0: rodina „basic249“ (4 existující kroky, dnes CTA na Basic + slib
// videokurzu k Basicu, ktery od 30. 9. 2026 neplati). Stejne telo, jina UTM.
// Track/step zustavaji, meni se key (puvodni klic slouzi jako zamek v SQL).
// ============================================================================
const vip499 = (track, step, puvodniKey, novyKey) => ({
  track, step, key: novyKey, puvodni_key: puvodniKey, wait_days: 'BEZE ZMENY',
  subject: 'Cíle, jídelníček, trénink a AI kouč za {{cena_vip_mesic}} Kč měsíčně',
  subject_b: 'Appka, která za tebe přepočítá cíle. Videokurz dostaneš k ní',
  preheader: 'Co jsem s klienty dělal ručně v tabulkách, dělá appka sama. K VIP videokurz zdarma.',
  blocks: [
    AHOJ,
    p('pár týdnů ti posílám tipy. Dnes ti ukážu, kam s nimi jít, aby se z nich staly čísla na váze.'),
    p('Postavil jsem appku <strong>Tvůj Coach</strong>. Dělá to, co jsem s klienty roky dělal ručně v tabulkách: spočítá ti kalorie a makra, každý týden je upraví podle toho, co jsi skutečně jedl[a] a jak se hnula váha, a sestaví ti jídelníček z běžných potravin i trénink podle toho, kde cvičíš.'),
    p('Ve <strong>VIP za {{cena_vip_mesic}} Kč měsíčně</strong> máš:'),
    ul(
      'týdenní check-in a automatickou úpravu cílů (když zapíšeš málo dnů, appka cíli nehne, radši než hádat)',
      'generátor jídelníčku z běžných potravin a generátor tréninku',
      'AI kouče, který vidí tvoje čísla a odpoví mým stylem, a zápis jídla z fotky i hlasem',
      '🎁 k první platbě můj videokurz výživy zdarma (182 videí, hodnota {{course_price}} Kč). Zůstane ti, i když předplatné zrušíš. Při vrácení peněz odchází s ním.',
    ),
    p('Zápis jídla i tréninku, hledání v databázi přes {{pocet_potravin}} potravin i skener čárových kódů zůstávají zdarma napořád. Platíš za to, že appka z tvých čísel dělá rozhodnutí za tebe.'),
    btn('Chci VIP za {{cena_vip_mesic}} Kč', KOUPIT_VIP(track, 'vip-499')),
    p('Platíš kartou a zrušíš kdykoli přímo v appce. Když ti to do 14 dnů nesedne, vrátím peníze.'),
    PODPIS,
    ps('P.S. Když AI kouče nepotřebuješ, je v appce i Basic za {{cena_basic_mesic}} Kč. Umí přepočet cílů a generátory, jen bez kouče a bez videokurzu.'),
  ],
});
const opravaP0 = [
  vip499('lead-magnet', 9, 'lm-9-basic249', 'lm-9-vip499'),
  vip499('longtail-consumer', 5, 'lc-11-basic249', 'lc-11-vip499'),
  vip499('nurture-videokurz', 8, 'nv-8-basic249', 'nv-8-vip499'),
  vip499('tc-start', 2, 'tcs-2-basic249', 'tcs-2-vip499'),
];

module.exports = { vipFree, vipKupci, vipLeady, opravaP0 };
