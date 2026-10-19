// NAVRH MAILU (9. 10. 2026, vetev cloud/mailing-navrh-1009 → kolo hlasu cloud/mailing-hlas-1009). JEDINY ZDROJ TEXTU.
// Z tohohle souboru `generuj.cjs` vyrobi HTML nahledy (nahledy/) a SQL navrh (01-*.sql, 03-*.sql).
// Texty jsou NAVRH. Kolo hlasu 9. 10. (co a proc se menilo: ../MAILING-HLAS-1009.md). Finalni zneni schvaluje Martin.
//
// Pravidla, ktera tu plati (kontroluje je `generuj.cjs`, pri poruseni spadne):
//  - ⛔ zadna cena cislem: jen {{cena_vip_mesic}}, {{cena_vip_rok}}, {{cena_basic_mesic}}, {{course_price}}
//  - ⛔ zadna dlouha pomlcka (U+2014)
//  - ⛔ prave jedno tlacitko (btn) v kazdem mailu, s UTM
//  - ⛔ jedna prosba na mail: tlacitko. P.S. „odpovez mi jednou vetou" je druha prosba, misto nej veta
//       „na tenhle mail jde odepsat, ctu to sam" (nabidka, ne vyzva)
//  - ⛔ zadny vykricnik krome podpisu „Be Effective!", zadna absolutna (musi/vzdy/nikdy/zarucene),
//       zadne AI obraty (Tady je proc, Pojdme, V dnesni dobe, klicove/skutecne/opravdove, tise hlida…)
//  - promenne jen ty, ktere drip-send zna (seznam v generuj.cjs)
//  - gender tokeny drip-sendu: [a] = zenska koncovka, [á] = á/ý, [[zena||muz]]
//
// Predmety: `subject` (A, klasika) je VYCHOZI hodnota do DB, `subject_b` (B, klasika) a `subject_c`
// (C, z hloubky: stejne sdeleni podane jinak nez u vsech) jsou k vyberu. Vybira Martin, ne my.
// Engine A/B predmetu neumi (MAILING-NAVRH-1009.md, kap. 6).

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

// Revize R1 (9. 10. 2026, nezavisly revizor): opraveno
//  - fotka NENI lek na podhodnoceny prijem (web /tvuj-coach/: „Fotka podcenuje olej a omacku")
//  - „co si dat, kdyz zbyva 400 kcal" je funkce BASICU, ne VIP; VIP se prodava AI koucem, fotkou a hlasem
//  - tlacitko „Vyzkouset VIP" slibovalo zkusebku, ktera od 20. 8. neexistuje
//  - prepocet cilu a generatory ma uz Basic: VIP = „vsechno z Basicu a k tomu…"
//  - mesic Academy k rocnimu VIP jen „pokud v ni jeste nejsi" (podminka z webu)
//  - gramatika (stala cisla), neoverene pravidlo „malo dnu = cil se nehne" z P0 vypusteno,
//    hovorove tvary (min, dneska), protikladove slogany, AI nevystupuje jako clovek
// Kolo hlasu (9. 10. 2026, ../MAILING-HLAS-1009.md): fakta, cisla, podminky, UTM a promenne beze zmeny.
//  - kazda trat ctena jako serie: zadny stejny uvod ani rytmus dvakrat za sebou
//  - „ve dve rano" vynechano (Free uzivatel ho dostal uz v tc-free/6), „engine" nahrazen „appka"
//  - P.S. s druhou prosbou prepsano na nabidku, u vk-2 P.S. vypusteno (Free pripomina vk-1 a vk-4)
//  - treti predmet „z hloubky" u kazdeho mailu

// ============================================================================
// TRAŤ 1: vip-free  (Free uživatelé appky, kteří zapisují a neplatí)
// ============================================================================
const VF = 'vip-free';
const vipFree = [
  {
    track: VF, step: 0, key: 'vf-1-zapisujes', wait_days: 3,
    subject: 'Zapisuješ. Teď ať s tím appka něco udělá',
    subject_b: 'Co appka udělá s tím, co už zapisuješ',
    subject_c: 'Co VIP udělá v pondělí s tvým zapsaným týdnem',
    preheader: 'Co se ve VIP stane s daty, která v appce už máš.',
    blocks: [
      AHOJ,
      p('v appce už nějaký čas zapisuješ. Máš tím data o tom, co doopravdy jíš a jak se hýbe váha. S nimi se dá počítat.'),
      p('Ve Free si vyplníš check-in a uvidíš rozbor týdne. Od Basicu výš s ním appka dál pracuje: podle toho, co jsi snědl[a] a jak se hnula váha, ti přepočítá kalorie a makra na další týden a poskládá k nim jídelníček i trénink.'),
      p('Ve <strong>VIP</strong> máš k tomu AI kouče, který tvoje zápisy vidí. Napíšeš mu „proč mi appka zvedla sacharidy?“ a odpoví podle tvých čísel. Kalorie a makra počítá pořád appka, kouč ti jen vysvětlí, proč vyšly takhle.'),
      p(DAREK_VIP),
      btn('Přejít na VIP za {{cena_vip_mesic}} Kč', PREDPLATNE_VIP(VF, 'vf-1')),
      p('Zrušíš kdykoli v Profilu. Když ti to do 14 dnů nesedne, vrátím ti peníze.'),
      PODPIS,
      ps('P.S. Free ti zůstává napořád. Nic z toho, co teď v appce používáš, ti nevezmu.'),
    ],
  },
  {
    track: VF, step: 1, key: 'vf-2-foto-hlas', wait_days: 4,
    subject: 'Zapsat oběd za pár vteřin',
    subject_b: 'Vyfoť talíř, appka odhadne makra',
    subject_c: 'Řekni to appce nahlas: rohlík, tvaroh, tři deci vody',
    preheader: 'Dvě zkratky ve VIP pro dny, kdy se nechce nic ťukat.',
    blocks: [
      AHOJ,
      p('u klientů vidím jeden důvod, proč zápis skončí, častěji než všechny ostatní dohromady: zdržuje. Hledání v databázi, gramáže, deset ťuknutí na jeden oběd.'),
      p('Proto jsou ve VIP dvě zkratky:'),
      ul(
        '<strong>Foto jídla.</strong> Vyfotíš talíř, klidně domácí kuchyni bez obalu. AI pozná i víc jídel na jedné fotce a odhadne kalorie a makra. Odhad vidíš a před zápisem opravíš. Olej a omáčku na fotce nepozná, ty doplň.',
        '<strong>Zápis hlasem.</strong> Řekneš „rohlík, tvaroh dvě stě gramů a tři deci vody“ a appka větu rozebere. Potvrdíš, nebo opravíš.',
      ),
      p('Snídani, kterou máš pětkrát týdně, zapíšeš i ve Free jedním ťuknutím ze šablony. Foto a hlas ti ušetří čas u všeho ostatního.'),
      btn('Chci VIP', PREDPLATNE_VIP(VF, 'vf-2')),
      PODPIS,
      ps('P.S. K první platbě VIP dostaneš i videokurz výživy zdarma.'),
    ],
  },
  {
    track: VF, step: 2, key: 'vf-3-ai-kouc', wait_days: 4,
    // Puvodni predmet „Zeptej se ve dve rano" vynechan: tc-free/6 ma „Kouc, ktery ti odpovi ve dve rano"
    // a Free uzivatel ho uz mohl dostat. Stejny hak dvakrat temuz cloveku = prepsat.
    subject: 'Váha se týden nehýbe. Mám ubrat?',
    subject_b: 'AI kouč, který vidí tvoje čísla',
    subject_c: 'Co by ti na „mám ubrat?“ řekl kouč, který vidí tvůj týden',
    preheader: 'AI kouč ve VIP odpovídá podle mojí metodiky a jídlo zapíše za tebe.',
    blocks: [
      AHOJ,
      p('tyhle tři otázky dostávám nejčastěji:'),
      ul(
        '„Váha se týden nehýbe. Mám ubrat?“',
        '„Proč mi appka zvedla sacharidy?“',
        '„Jsem na oslavě. Jak to zapsat, ať si nezkazím týden?“',
      ),
      p('Ve VIP je zodpoví AI kouč. Vidí tvoje zápisy i vývoj váhy a drží se metodiky, se kterou pracuju s klienty od roku 2013. Když mu napíšeš, co jsi snědl[a], rovnou to zapíše.'),
      btn('Napsat AI koučovi ve VIP', PREDPLATNE_VIP(VF, 'vf-3')),
      PODPIS,
      ps('P.S. Basic za {{cena_basic_mesic}} Kč umí přepočet cílů a generátory. AI kouče, foto ani hlas nemá, proto ti doporučuju VIP.'),
    ],
  },
  {
    track: VF, step: 3, key: 'vf-4-shrnuti', wait_days: null,
    // ⛔ KONEC TRATI = otazka „a co potom?" (CLAUDE.md, 6. 8. 2026): po dojeti lead sebere
    //    `enroll_into_longtail` (7:50) a posle ho do longtail-consumer. Most neni potreba.
    subject: 'Free, Basic, nebo VIP? Shrnutí na jednu obrazovku',
    subject_b: 'Poslední mail o předplatném z téhle řady',
    subject_c: 'Kdy ti stačí Free a kdy dává smysl VIP',
    preheader: 'Ať se rozhodneš v klidu. Free ti zůstává tak jako tak.',
    blocks: [
      AHOJ,
      p('tohle je poslední mail o předplatném z téhle řady. Shrnu ti to na jednu obrazovku:'),
      ul(
        '<strong>Free (zdarma, napořád):</strong> zápis jídla i tréninku, skener čárových kódů, přes {{pocet_potravin}} potravin, šablony a 14 dní historie.',
        '<strong>Basic ({{cena_basic_mesic}} Kč měsíčně):</strong> navíc týdenní přepočet kalorií a maker, generátor jídelníčku i tréninku, „Co si můžu ještě dnes dát“ a celá historie.',
        '<strong>VIP ({{cena_vip_mesic}} Kč měsíčně):</strong> všechno z Basicu, k tomu AI kouč, foto jídla a zápis hlasem. A k první platbě videokurz výživy zdarma.',
      ),
      p('Když víš, že do toho jdeš na delší dobu, roční VIP vyjde na {{cena_vip_rok}} Kč, tedy dva měsíce zdarma. K ročnímu VIP navíc přidávám měsíc Barna Academy na zkoušku.'),
      btn('Vybrat VIP', PREDPLATNE_VIP(VF, 'vf-4')),
      p('Zrušíš kdykoli v Profilu, zaplacené období doběhne a dál se nic nestrhne. Do 14 dnů od začátku ti vrátím celou částku, když ti to nesedne.'),
      p('A když zůstaneš ve Free, taky dobře. Zapisuj dál. Z dat, která máš, se dá navázat kdykoli později.'),
      PODPIS,
      ps('P.S. Na tenhle mail jde odepsat, čtu to sám.'),
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
    subject_b: 'Co z videokurzu dělá appka za tebe každý týden',
    subject_c: 'Kurz ti dal proč. Appka ti každé pondělí dá kolik',
    preheader: 'Appka Tvůj Coach dělá s tvými čísly to, co učím ve videokurzu.',
    blocks: [
      AHOJ,
      p('ve videokurzu jsi viděl[a], jak funguje kalorický deficit a kolik bílkovin, sacharidů a tuků jíst.'),
      p('V praxi to znamená každý týden sečíst, co jsi snědl[a], porovnat to s váhou a rozhodnout, jestli ubrat, přidat, nebo vydržet. Tohle za tebe dělá appka <strong>Tvůj Coach</strong>.'),
      p('Ve <strong>VIP</strong> ti každý týden z tvých zápisů přepočítá kalorie a makra, poskládá jídelníček z běžných potravin a trénink podle toho, kde cvičíš. A na otázky ti odpoví AI kouč, podle stejné metodiky, jakou znáš z kurzu.'),
      btn('Chci VIP za {{cena_vip_mesic}} Kč měsíčně', KOUPIT_VIP(VK, 'vk-1')),
      p(ZARUKA),
      PODPIS,
      ps('P.S. Zápis jídla i tréninku máš v appce zdarma napořád. Účet si zakládej na stejný e-mail, jaký máš u videokurzu.'),
    ],
  },
  {
    track: VK, step: 1, key: 'vk-2-oslava', wait_days: 4,
    subject: 'Oslava, oběd venku a den, kdy se nechce ťukat',
    subject_b: 'Tři situace, kde ti VIP ušetří nejvíc času',
    subject_c: 'Dort zapíše AI kouč, ty si ho v klidu sněz',
    preheader: 'AI kouč, foto a hlas: co VIP přidá k tomu, co znáš z kurzu.',
    blocks: [
      AHOJ,
      p('podle studií lidi svůj příjem podhodnotí o 20 až 50 %. U klientů vidím, kde ta díra vzniká nejčastěji: ve dnech, kdy se zápis vynechá celý. Oslava, oběd venku, večer bez chuti cokoli ťukat.'),
      p('Ve VIP máš přesně na tyhle dny tři zkratky:'),
      ul(
        '<strong>Oslava.</strong> Napíšeš AI koučovi, co jsi snědl[a], a on to za tebe zapíše. Když nevíš, jak s tím naložit zbytek týdne, zeptáš se rovnou jeho.',
        '<strong>Oběd venku bez obalu.</strong> Vyfotíš talíř, AI odhadne jídla i makra. Odhad před zápisem zkontroluješ a olej s omáčkou doplníš, ty fotka nepozná.',
        '<strong>Nechce se ti ťukat.</strong> Řekneš „dvě vejce, krajíc chleba a jablko“ a appka to rozebere sama.',
      ),
      btn('Chci VIP', KOUPIT_VIP(VK, 'vk-2')),
      PODPIS,
    ],
  },
  {
    track: VK, step: 2, key: 'vk-3-basic-nebo-vip', wait_days: 5,
    subject: 'Basic, nebo VIP? Napíšu ti to narovinu',
    subject_b: 'Proč ti doporučuju dražší plán',
    subject_c: 'Dva plány. Rozdíl je v tom, kdo ti v neděli večer odpoví',
    preheader: 'Rozdíl je v AI koučovi, fotce a hlasu.',
    blocks: [
      AHOJ,
      p('v appce jsou dva placené plány a chci, abys věděl[a], proč ti doporučuju ten dražší.'),
      p('<strong>Basic</strong> za {{cena_basic_mesic}} Kč měsíčně ti každý týden přepočítá cíle a má generátor jídelníčku i tréninku.'),
      p('<strong>VIP</strong> za {{cena_vip_mesic}} Kč měsíčně umí všechno z Basicu a k tomu AI kouče, foto jídla a zápis hlasem. Teorii znáš z kurzu. Horší je neděle večer, kdy váha po týdnu stojí a ty nevíš, jestli ubrat. Tam ti AI kouč odpoví hned, podle tvých zápisů.'),
      p('Když víš, že u toho vydržíš, vezmi rovnou rok. Vyjde na {{cena_vip_rok}} Kč, tedy dva měsíce zdarma, a k ročnímu VIP přidávám měsíc Barna Academy na zkoušku, pokud v ní ještě nejsi.'),
      btn('Chci VIP', KOUPIT_VIP(VK, 'vk-3')),
      p('Zrušit jde kdykoli. A když ti to do 14 dnů od začátku nesedne, vrátím celou částku.'),
      PODPIS,
    ],
  },
  {
    track: VK, step: 3, key: 'vk-4-posledni', wait_days: null,
    // ⛔ KONEC TRATI: po dojeti lead sebere `enroll_into_longtail` → longtail-kupci
    //    (nebo evergreen-kupci, kdo uz longtail-kupci mel). Most neni potreba.
    subject: 'Poslední mail o appce z téhle řady',
    subject_b: 'Cena zítra platí stejně, tak v klidu',
    subject_c: 'Kurz ti dal pravidla. Naposledy k tomu, kdo je bude počítat',
    preheader: 'Nikde neběží odpočet. Krátké shrnutí a konec téhle řady.',
    blocks: [
      AHOJ,
      p('tohle je poslední mail o appce z téhle řady. Cena zítra platí stejně, nikde neběží žádný odpočet.'),
      p('Videokurz ti dal pravidla. Ve VIP podle nich appka každý týden přepočítá tvoje kalorie a makra a AI kouč ti je vysvětlí, kdykoli se zeptáš.'),
      btn('Vzít VIP za {{cena_vip_mesic}} Kč', KOUPIT_VIP(VK, 'vk-4')),
      p('Když teď není ta chvíle, nic se neděje. Zápis máš v appce zdarma dál a já ti budu psát o výživě jako dosud.'),
      PODPIS,
      ps('P.S. Odpovědi na tenhle mail chodí přímo mně. Čtu je sám.'),
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
    subject: 'Plán máš. Kdo ti ho upraví, až se váha zastaví?',
    subject_b: 'Co dělat, když se váha tři týdny nehne{{fn_suffix}}',
    subject_c: 'Co u klientů dělám každé pondělí, umí appka i pro tebe',
    preheader: 'Appka, která z tvých zápisů každý týden přepočítá cíl. K první platbě VIP videokurz zdarma.',
    blocks: [
      AHOJ,
      p('jednou přijde týden, kdy se váha nehne. A vedle tebe nikdo, kdo by řekl, jestli ubrat, nebo ještě počkat. U klientů vidím, že přesně tady to lidi vzdávají nejčastěji.'),
      p('Na tohle jsem postavil appku <strong>Tvůj Coach</strong>. Ve <strong>VIP</strong> ti každý týden z tvých zápisů a vážení přepočítá kalorie i makra, k nim sestaví jídelníček z běžných potravin a trénink podle toho, kde cvičíš. A k tomu AI kouč, který tvoje čísla vidí a odpoví ti k nim, i v neděli večer.'),
      p(DAREK_VIP),
      btn('Chci VIP za {{cena_vip_mesic}} Kč měsíčně', KOUPIT_VIP(VL, 'vl-1')),
      p(ZARUKA),
      PODPIS,
      ps('P.S. Zapisovat jídlo i trénink můžeš v appce zdarma napořád a bez karty. Ve VIP platíš za to, že s těmi čísly appka pracuje za tebe.'),
    ],
  },
  {
    track: VL, step: 1, key: 'vl-2-oslava', wait_days: 3,
    subject: 'Oslava v sobotu. Jak ji zapsat?',
    subject_b: 'Oběd bez obalu a čárového kódu. Jak ho zapsat',
    subject_c: 'Dort, chlebíčky, víno. A pak „to už nemá cenu zapisovat“',
    preheader: 'Dvě funkce z VIP, kvůli kterým lidi u zápisu vydrží.',
    blocks: [
      AHOJ,
      p('dvě situace, kde se zápis utrhne nejsnáz.'),
      p('<strong>Oslava.</strong> Dort, chlebíčky, víno, a v hlavě „to už nemá cenu zapisovat“. Ve VIP napíšeš AI koučovi, co jsi snědl[a], on to zapíše a řekne ti, jak s tím naložit zbytek týdne.'),
      p('<strong>Oběd venku.</strong> Žádný obal, žádný čárový kód. Vyfotíš talíř, AI odhadne jídla i makra. Odhad před zápisem zkontroluješ a olej s omáčkou doplníš, ty fotka nepozná.'),
      p('Podle studií lidi svůj příjem podhodnotí o 20 až 50 %. Velký kus z toho jsou právě dny, kdy se zápis vynechá celý. Proto chci, aby ti zápis zabral co nejméně času i v sobotu večer.'),
      btn('Chci VIP', KOUPIT_VIP(VL, 'vl-2')),
      PODPIS,
      ps('P.S. K první platbě VIP pořád platí videokurz výživy zdarma.'),
    ],
  },
  {
    track: VL, step: 2, key: 'vl-3-videokurz', wait_days: 4,
    subject: 'Proč k VIP přidávám celý videokurz',
    subject_b: '182 videí, která k VIP dostaneš zdarma',
    subject_c: 'Číslo bez vysvětlení vydrží do první oslavy',
    preheader: 'Ať víš, proč appka počítá zrovna takhle.',
    blocks: [
      AHOJ,
      p('appka ti každý den řekne, kolik jíst. Jenže číslo bez vysvětlení drží jen do první oslavy nebo dovolené. Pak přijde „a proč vlastně zrovna tolik?“ a bez odpovědi se to pustí.'),
      p('Proto k první platbě VIP přidávám videokurz výživy. 182 videí o tom, jak funguje kalorický deficit, kolik bílkovin, sacharidů a tuků jíst a jak jíst flexibilně bez zakázaných jídel.'),
      p('Samostatně stojí {{course_price}} Kč. K VIP ho máš zdarma a zůstane ti, i když předplatné po měsíci zrušíš.'),
      btn('Chci VIP i s videokurzem', KOUPIT_VIP(VL, 'vl-3')),
      PODPIS,
      ps('P.S. Cíl je, abys za pár měsíců věděl[a], co dělat, i bez appky a beze mě. Na to je ten kurz.'),
    ],
  },
  {
    track: VL, step: 3, key: 'vl-4-namitky', wait_days: 4,
    subject: 'Tři věci, které mi lidi k appce říkají nejčastěji',
    subject_b: 'Nechce se ti platit za appku? Rozumím',
    subject_c: 'Co odpovídám na „nebaví mě zapisovat“',
    preheader: 'Zapisování, cena a co když to nevydržím.',
    blocks: [
      AHOJ,
      p('když lidem nabídnu appku, vrací se mi pořád tři věty. Odpovím na ně rovnou.'),
      p('<strong>„Nebaví mě zapisovat.“</strong> Proto je ve VIP zápis hlasem a z fotky. Řekneš „kuřecí prsa dvě stě gramů, rýže a okurka“ a appka to rozebere. Talíř v restauraci vyfotíš. A snídani, kterou máš pětkrát týdně, zapíšeš jedním ťuknutím ze šablony.'),
      p('<strong>„Nechci další předplatné.“</strong> Zápis jídla i tréninku, skener a databáze potravin jsou zdarma napořád. VIP má navíc týdenní přepočet cílů, generátory a AI kouče. Když AI nepotřebuješ, v appce je i Basic za {{cena_basic_mesic}} Kč s přepočtem a generátory, jen bez kouče a bez videokurzu.'),
      p('<strong>„Co když to nevydržím?“</strong> Zrušíš kdykoli v appce a zaplacené období doběhne. Když ti to do 14 dnů od začátku nesedne, napiš mi na martin@martinbarna.cz a vrátím ti celou částku. Videokurz při vrácení peněz odchází s nimi.'),
      btn('Vzít VIP za {{cena_vip_mesic}} Kč', KOUPIT_VIP(VL, 'vl-4')),
      PODPIS,
    ],
  },
  {
    track: VL, step: 4, key: 'vl-5-posledni', wait_days: null,
    // ⛔ KONEC TRATI: po dojeti lead sebere `enroll_into_longtail` → longtail-consumer.
    subject: 'Poslední mail k appce. Cena zítra platí stejně',
    subject_b: 'Rok VIP za cenu deseti měsíců',
    subject_c: 'Dál už jen tipy. Tohle je naposledy o VIP',
    preheader: 'Shrnutí na jednu obrazovku a roční VIP. Nikde neběží odpočet.',
    blocks: [
      AHOJ,
      p('tohle je poslední mail o appce z téhle řady. Cena zítra platí stejně, takže se rozhoduj v klidu.'),
      p('VIP je celá appka: týdenní přepočet kalorií a maker podle tvých zápisů, jídelníček i trénink, AI kouč, foto a hlas. K první platbě videokurz výživy zdarma.'),
      p('Když víš, že to chceš dělat dlouhodobě, vezmi rovnou rok. Vyjde na {{cena_vip_rok}} Kč, tedy dva měsíce zdarma, a k ročnímu VIP přidávám měsíc Barna Academy na zkoušku. Roční variantu najdeš v ceníku appky.'),
      btn('Vybrat VIP', KOUPIT_VIP(VL, 'vl-5')),
      p('A když to teď nedává smysl, nic se neděje. Tipy ti budu posílat dál.'),
      PODPIS,
      ps('P.S. Na tenhle mail jde odepsat. Čtu to sám.'),
    ],
  },
];

// ============================================================================
// OPRAVA P0: rodina „basic249“ (4 existující kroky, dnes CTA na Basic + slib
// videokurzu k Basicu, ktery od 30. 9. 2026 neplati). Track/step zustavaji, meni se key
// (puvodni klic slouzi jako zamek v SQL). Telo vychazi z ZIVEHO zneni lm-9 (23. 9.),
// prepsane jsou jen veci tykajici se planu + gramatika (revize R1) + hlas (9. 10.).
// tc-start/2 ma vlastni uvod: prijde par dni po dotazniku, ne po „par tydnech tipu".
// ============================================================================
const UVOD_TIPY = 'pár týdnů ti posílám tipy. Dnes ti ukážu, kam s nimi jít, aby se z nich stala čísla na váze.';
const UVOD_START = 'svoje čísla z dotazníku už máš. Dnes ti ukážu, kdo ti je bude každý týden upravovat.';
const vip499 = (track, step, puvodniKey, novyKey, uvod) => ({
  track, step, key: novyKey, puvodni_key: puvodniKey, wait_days: 'BEZE ZMENY',
  subject: 'Cíle, jídelníček, trénink a AI kouč za {{cena_vip_mesic}} Kč měsíčně',
  subject_b: 'Appka, která za tebe přepočítá cíle. Videokurz dostaneš k ní',
  subject_c: 'Kdo ti bude každý týden upravovat kalorie a makra',
  preheader: 'Co jsem s klienty dělal ručně v tabulkách, dělá appka sama. K VIP videokurz zdarma.',
  blocks: [
    AHOJ,
    p(uvod),
    p('Postavil jsem appku <strong>Tvůj Coach</strong>. Dělá to, co jsem s klienty roky dělal ručně v tabulkách: spočítá ti kalorie a makra, každý týden je upraví podle toho, co jsi jedl[a] a jak se hnula váha, a sestaví ti jídelníček z běžných potravin i trénink podle toho, kde cvičíš.'),
    p('Ve <strong>VIP za {{cena_vip_mesic}} Kč měsíčně</strong> máš:'),
    ul(
      'týdenní check-in a automatickou úpravu cílů',
      'generátor jídelníčku z běžných potravin a generátor tréninku',
      'AI kouče, který vidí tvoje čísla a odpovídá podle mojí metodiky, a zápis jídla z fotky i hlasem',
      '🎁 k první platbě můj videokurz výživy zdarma (182 videí, hodnota {{course_price}} Kč). Zůstane ti, i když předplatné zrušíš. Při vrácení peněz odchází s nimi.',
    ),
    p('Zápis jídla i tréninku, hledání v databázi přes {{pocet_potravin}} potravin i skener čárových kódů zůstávají zdarma napořád. Platíš za tu část, kde appka s tvými čísly počítá a každý týden ti řekne, co dál.'),
    btn('Chci VIP za {{cena_vip_mesic}} Kč', KOUPIT_VIP(track, 'vip-499')),
    p('Platíš kartou a zrušíš kdykoli přímo v appce. Když ti to do 14 dnů nesedne, vrátím peníze.'),
    PODPIS,
    ps('P.S. Když AI kouče nepotřebuješ, je v appce i Basic za {{cena_basic_mesic}} Kč. Umí přepočet cílů a generátory, jen bez kouče a bez videokurzu.'),
  ],
});
const opravaP0 = [
  vip499('lead-magnet', 9, 'lm-9-basic249', 'lm-9-vip499', UVOD_TIPY),
  vip499('longtail-consumer', 5, 'lc-11-basic249', 'lc-11-vip499', UVOD_TIPY),
  vip499('nurture-videokurz', 8, 'nv-8-basic249', 'nv-8-vip499', UVOD_TIPY),
  vip499('tc-start', 2, 'tcs-2-basic249', 'tcs-2-vip499', UVOD_START),
];

module.exports = { vipFree, vipKupci, vipLeady, opravaP0 };
