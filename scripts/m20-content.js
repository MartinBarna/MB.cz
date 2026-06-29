/* Obsah lekcí modulu 20 — z příručky MARTINUV_SYSTEM_V_PRAXI.md (Martinův hlas).
   Generuje se přes scripts/build-m20.js. l9–l13 z paralelního workflow. */
module.exports = [
  {
    "id": "m20-l3",
    "title": "Rozhodovací pravidla: pořadí pák je svaté",
    "prevHref": "/akademie/studium/m20-l2/",
    "prevLabel": "Pět priorit v praxi",
    "nextHref": "/akademie/studium/m20-l4/",
    "nextLabel": "Onboarding klienta",
    "body": "    <p class=\"lead\">Tohle je jádro celého systému a tvůj scénář pro každý hovor s klientem. Engine projde podmínky <strong>v pevném pořadí</strong> a první, která sedí, určí „páku\". To pořadí musíš znát nazpaměť — protože nejčastější chyba trenéra je sáhnout po špatné páce ve špatný čas.</p>\n\n    <div class=\"points\"><strong>Co si z lekce odneseš:</strong>\n      <ul>\n        <li>Rozhodovací strom: co dělat, když se výsledek zastaví.</li>\n        <li>Proč jsou <strong>kalorie až poslední páka</strong>, ne první.</li>\n        <li>Jak řešit víkendy, restaurace, nemoc a cesty designem, ne pravidlem.</li>\n      </ul>\n    </div>\n\n    <h2>Pořadí, ve kterém čteš situaci</h2>\n    <div class=\"steps\">\n      <div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Váha stojí + míra padá = rekompozice</b><span>DRŽ KURZ, deficit NEPŘIDÁVÁŠ. Flat = změna &lt; 0,2 %/týden, míra padá = ≥ 0,5 cm/týden. Tohle je úspěch, ne stagnace. Laik tu panikaří — ty ne.</span></div></div>\n      <div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Log vyšel nereálně nízko a tělo stojí</b><span>KOUČUJ PŘESNOST, kalorie NIKDY nesnižuješ. Když implikované TDEE vyjde pod BMR (fyzikálně nemožné), je to chyba zápisu, ne důvod jíst míň.</span></div></div>\n      <div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Únava / hlad / slabost při dietě (guardrail)</b><span>Deficit NEZVYŠUJEŠ. Stačí jeden signál (únava ≥ 4 NEBO hlad ≥ 4 NEBO síla ≤ 2 na škále 1–5). Drží-li to ≥ 2 týdny → diet break (zvedni příjem k udržovačce).</span></div></div>\n      <div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Aktivita spadla pod plán (pod 85 %)</b><span>VRAŤ AKTIVITU NA PLÁN, kalorie neřežeš. Spadl výdej, ne metabolismus.</span></div></div>\n      <div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Opravdová stagnace</b><span>Tělo fakt stojí, přesnost sedí, aktivita splněná. Teprve teď řešíš v pořadí: přesnost → aktivita (silové minuty) → až úplně nakonec mírně kcal (max ±10 %/týden).</span></div></div>\n      <div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Jde to / málo dat</b><span>Pokračuj stejně, neměň nic.</span></div></div>\n    </div>\n\n    <h2>Páky pro stagnaci do hloubky</h2>\n    <p><strong>Přesnost je vždy první.</strong> Vážit jídlo, počítat tekuté a skryté kalorie, krabička na cesty. <strong>Aktivita je druhá</strong> — hlavně silové minuty (+1 silová jednotka ≈ +45 intenzivních min/týden). Aerobku a NEAT nepřeháněj, podléhají adaptaci. Páka se zapne, i když je aktivita „splněná\", ale je pod stropem ~150 intenzivních min/týden — pořád je kam přidat dřív, než sáhneš na jídlo.</p>\n    <div class=\"eq\">KCAL JE POSLEDNÍ PÁKA, NE PRVNÍ</div>\n    <p><strong>Kalorie sahej až nakonec.</strong> Tempo úpravy 0,5–1 % hmotnosti/týden, absolutní strop 1 kg/týden, změna cíle max ±10 %/týden. Žádné skoky.</p>\n\n    <h2>Víkend, restaurace, nemoc, cesty</h2>\n    <p><strong>Řeší to design, ne pravidlo.</strong> Kalorie jsou týdenní průměr, takže pátek na svatbě se rozpustí v týdnu. Když klient mine denní cíl, <strong>NEKOMPENZUJE zítra.</strong> Krátký výpadek (nemoc, cesty) neřeší trend — posuzovací okno jsou 3 týdny. Klient loguje hrubě (rychlé přidání, jen kalorie) a jede dál. Prázdný den je jediná chyba.</p>\n\n    <div class=\"praxe\"><b>V praxi (Martin):</b> Klientka stagnuje na váze. Laik-trenér hned ubere 300 kcal. Já se podívám na faktory: zalogováno 60 % dní, TDEE vychází pod BMR. Diagnóza není „moc malý deficit\", ale „sní víc, než zapíše\". Řeknu: „Zápis vyšel hodně nízko a tělo se nehýbe. To skoro vždy znamená, že se do zápisu pár věcí nevešlo, ne že máš jíst míň. Pojďme na přesnost.\" Kalorie nesahám. Be Effective.</div>",
    "task": "Vezmi situaci „klient tři týdny nehubne\". Než cokoliv změníš, projdi nahlas pět pák v pořadí a urči, která sedí. Napiš si první větu, kterou klientovi řekneš — bez slov „appka řekla\".",
    "quiz": [
      {
        "q": "Jaké je pořadí pák při opravdové stagnaci?",
        "a": "Přesnost → aktivita (silové minuty) → a teprve úplně nakonec mírně kalorie (max ±10 %/týden). Kcal je poslední, ne první."
      },
      {
        "q": "Váha stojí, ale míry padají. Co uděláš?",
        "a": "Nic neměníš — držíš kurz. To je rekompozice (hubneš tuk, držíš sval), úspěch, ne stagnace. Deficit NEPŘIDÁVÁŠ."
      },
      {
        "q": "Log vyšel nereálně nízko (TDEE pod BMR) a tělo stojí. Snížíš kalorie?",
        "a": "Ne. Koučuješ přesnost zápisu. Číslo pod BMR je fyzikálně nemožné = chyba logu, ne důvod jíst míň."
      },
      {
        "q": "Klient hlásí únavu a hlad při dietě. Přidáš deficit?",
        "a": "Ne, deficit nezvyšuješ (guardrail). Stačí jeden signál (únava/hlad ≥ 4 nebo síla ≤ 2). Když to drží 2 týdny → diet break."
      },
      {
        "q": "Jak řešíš víkend/restauraci?",
        "a": "Designem, ne pravidlem. Kalorie jsou týdenní průměr, výkyv se rozpustí. Klient NEKOMPENZUJE druhý den."
      }
    ]
  },
  {
    "id": "m20-l4",
    "title": "Onboarding klienta: první týden",
    "prevHref": "/akademie/studium/m20-l3/",
    "prevLabel": "Rozhodovací pravidla",
    "nextHref": "/akademie/studium/m20-l1/",
    "nextLabel": "Veď klienta k samostatnosti",
    "body": "    <p class=\"lead\">Onboarding má tři kroky a jedinou úlohu: posbírat minimum dat a hned spočítat startovní čísla. První věta klientovi je <strong>„Pojďme nastavit start. Pár údajů, ať umíme spočítat tvoje startovací cíle.\"</strong></p>\n\n    <div class=\"points\"><strong>Co si z lekce odneseš:</strong>\n      <ul>\n        <li>Tři kroky onboardingu a co v nich měřit.</li>\n        <li>Proč nechat klienta vybrat aktivitu <strong>konzervativně</strong>.</li>\n        <li>Že tvoje práce v prvním týdnu je poctivost logu, ne ladění kalkulačky.</li>\n      </ul>\n    </div>\n\n    <h2>Tři kroky</h2>\n    <div class=\"steps\">\n      <div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Měříš</b><span>Jméno, pohlaví, výška, váha, věk, aktivita (5 stupňů: sedavý ×1,2 / lehká ×1,375 / střední ×1,55 / aktivní ×1,725 / velmi aktivní ×1,9).</span></div></div>\n      <div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Cíl a tempo</b><span>Hubnutí / udržení / nabírání / rekompozice. U hubnutí default „Střední\" (0,75 %/týden) — „Bez extrémů. Rozumné tempo je 0,5–1,0 % tělesné hmotnosti týdně.\" U nabírání default 0,25 kg/týden, strop 0,5.</span></div></div>\n      <div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Startovní čísla</b><span>Denní cíl (kcal + makra) a odhad výdeje. Spočítá se z Mifflin-St Jeor → TDEE → cíl podle tempa.</span></div></div>\n    </div>\n\n    <h2>Konzervativní start, realita doladí</h2>\n    <p><strong>Aktivitu nech vybrat konzervativně.</strong> Posun o stupeň je rozdíl stovek kalorií. Reálný log to za pár týdnů stejně dorovná. A hlavně: <strong>tvoje práce v prvním týdnu je dotáhnout poctivost logu, ne ladit kalkulačku.</strong> Mifflin je jen odhad — nehádej se s klientem o „správné\" číslo.</p>\n\n    <p>Větu na konci onboardingu musí umět každý trenér zopakovat vlastními slovy:</p>\n    <blockquote>„Tohle jsou startovní čísla, ne dogma. Až budeš pár týdnů logovat jídlo, vážit se a měřit obvody, cíle se samy doladí podle reality.\"</blockquote>\n\n    <div class=\"praxe\"><b>V praxi (Martin):</b> Klient u onboardingu váhá mezi „lehká\" a „střední\" aktivita. Řeknu mu: „Vyber radši nižší. Když podstřelíš, appka to za dva tři týdny dorovná podle toho, co reálně sníš a jak se hýbe váha. Když přestřelíš, budeš se ptát, proč to nejde.\" Konzervativní start, realita doladí.</div>",
    "task": "Naonboarduj (klidně na papíře) modelového klienta: posbírej 3 kroky, vyber konzervativně aktivitu a napiš tu závěrečnou větu „startovní čísla, ne dogma\" vlastními slovy tak, jak bys ji řekl naživo.",
    "quiz": [
      {
        "q": "Jaké tři kroky má onboarding?",
        "a": "1) Měříš (pohlaví, výška, váha, věk, aktivita), 2) cíl a tempo, 3) startovní čísla (kcal + makra + odhad výdeje z Mifflin-St Jeor)."
      },
      {
        "q": "Proč nechat klienta vybrat aktivitu spíš nižší?",
        "a": "Posun o stupeň = stovky kalorií. Když podstřelíš, reálný log to za pár týdnů dorovná. Když přestřelíš, klient se diví, proč to nejde."
      },
      {
        "q": "Co je tvoje hlavní práce v prvním týdnu?",
        "a": "Dotáhnout poctivost logu, ne ladit kalkulačku. Mifflin je jen odhad, realita ho doladí."
      },
      {
        "q": "Jaké je rozumné tempo hubnutí, které klientovi nastavíš?",
        "a": "0,5–1,0 % tělesné hmotnosti týdně. Bez extrémů — udržení je víc než rychlé shození."
      },
      {
        "q": "Jak klientovi vysvětlíš startovní čísla?",
        "a": "„Tohle jsou startovní čísla, ne dogma. Až budeš pár týdnů logovat a měřit se, cíle se samy doladí podle reality.\""
      }
    ]
  },
  {
    "id": "m20-l5",
    "title": "Check-iny: co sleduješ týdně a jak upravuješ",
    "prevHref": "/akademie/studium/m20-l1/",
    "prevLabel": "Veď klienta k samostatnosti",
    "nextHref": "/akademie/studium/m20-l6/",
    "nextLabel": "Časté chyby klientů",
    "body": "    <p class=\"lead\">Check-in jede <strong>každý týden</strong> (klient nečeká, optimalizujeme včas), ale <strong>rozhoduje se podle 2–3týdenního trendu</strong> (posuzovací okno = 21 dní). Jeden špatný víkend check-in nerozhodí.</p>\n\n    <div class=\"points\"><strong>Co si z lekce odneseš:</strong>\n      <ul>\n        <li>Co engine vytáhne sám z dat a co klient doplní ručně.</li>\n        <li>Co je <strong>adherence gate</strong> a proč při děravém logu neměníš cíle.</li>\n        <li>Jak komunikovat úpravu a pochvalu.</li>\n      </ul>\n    </div>\n\n    <h2>Co engine vytáhne sám vs. co doplní klient</h2>\n    <table>\n      <tr><th>Engine sám z dat</th><th>Klient doplní ručně</th></tr>\n      <tr><td>Trend váhy (regrese, jen při ≥ 4 váženích a rozpětí ≥ 10 dní)</td><td>Reálná aktivita (kroky/den, intenzivní minuty)</td></tr>\n      <tr><td>Průměrný zalogovaný příjem + adherence</td><td>Subjektivní škály 1–5 (únava / hlad / síla)</td></tr>\n      <tr><td>Trend měr (cm/týden) a přepočítané BMR</td><td>Plán na příští týden + volitelná poznámka</td></tr>\n    </table>\n\n    <h2>Adherence gate: děravý log = neměníš</h2>\n    <p>Pod ~70 % dní se zápisem (pod 5/7) engine cíle <strong>NEMĚNÍ</strong>. Děravý log = nedůvěryhodný odhad, a měnit cíle z něj je hádání, ne adaptace. Řekneš to klientovi v klidu: „Tenhle týden mám jen pár dní se zápisem, na spolehlivou úpravu to nestačí. Cíle nechávám a pojďme nejdřív na konzistenci.\"</p>\n\n    <h2>Jak komunikovat úpravu a pochvalu</h2>\n    <p><strong>Karta „Proč (faktory)\" je tvůj scénář.</strong> Neříkej „appka řekla\". Vezmi faktory a přelož je do lidské řeči: „Máš zalogováno jen 60 % dní a TDEE mi vychází pod BMR, takže nejdřív dotáhneme zápis, kalorie nesahám.\" Úprava je vždy mírná — jedna změna max ±10 % kcal/týden, a klient/ty ji potvrzuje, nic se neděje automaticky.</p>\n    <p><strong>Pochvala vždy na konkrétní fakt</strong> („pod 70 kg, paráda\", „tři týdny pravidelných úbytků, respekt\"). Žádné prázdné „skvělá práce\".</p>\n\n    <div class=\"praxe\"><b>V praxi (Martin):</b> Check-in ukáže pákový badge „Přidat aktivitu\" a faktory: přesnost OK, ale aktivita pod stropem. Komentář klientovi: „Zápis máš poctivý, to se počítá. Tělo zatím stojí, tak než budeme sahat na jídlo, přidáme zhruba jednu silovou jednotku týdně. Kalorie neřežeme. Be Effective.\"</div>",
    "task": "Připrav si „check-in scénář\": vyber jeden pákový stav (např. přidat aktivitu) a napiš komentář klientovi, který (1) pochválí konkrétní fakt, (2) přeloží faktory do lidské řeči, (3) dá jeden krok — bez věty „appka řekla\".",
    "quiz": [
      {
        "q": "Jak často jede check-in a podle čeho se rozhoduje?",
        "a": "Každý týden, ale rozhoduje se podle 2–3týdenního trendu (okno 21 dní). Jeden špatný víkend nerozhodí."
      },
      {
        "q": "Co je adherence gate?",
        "a": "Pod ~70 % dní se zápisem (5/7) engine cíle nemění. Děravý log = nedůvěryhodný odhad, měnit cíle by bylo hádání."
      },
      {
        "q": "Jak komunikuješ úpravu klientovi?",
        "a": "Nikdy „appka řekla\". Vezmeš faktory → přeložíš do lidské řeči → dáš jeden krok. Úprava max ±10 % kcal/týden."
      },
      {
        "q": "Jak má vypadat pochvala?",
        "a": "Vždy na konkrétní fakt: „pod 70 kg, paráda\", „tři týdny úbytků, respekt\". Ne prázdné „skvělá práce\"."
      },
      {
        "q": "Co engine vytáhne sám a co doplní klient?",
        "a": "Engine: trend váhy, příjem, adherence, trend měr, BMR. Klient: reálná aktivita, subjektivní škály (únava/hlad/síla), plán, poznámka."
      }
    ]
  },
  {
    "id": "m20-l6",
    "title": "Časté chyby klientů a jak je řešíš",
    "prevHref": "/akademie/studium/m20-l5/",
    "prevLabel": "Check-iny",
    "nextHref": "/akademie/studium/m20-l7/",
    "nextLabel": "Startovací cíle & makra",
    "body": "    <p class=\"lead\">Tyhle chyby uvidíš u většiny klientů. Nejsou to selhání — jsou to předvídatelné reakce laika. Tvoje práce není kárat, ale přerámovat. Když je čekáš, zvládneš je klidně a klient u tebe zůstane.</p>\n\n    <div class=\"points\"><strong>Šest nejčastějších a jak na ně:</strong>\n      <ul>\n        <li><strong>Panika z jednoho vážení.</strong> Klient vidí ráno +1,5 kg a chce zařezat. „Koukáme na klouzavý průměr, ne na jedno číslo. Voda, glykogen a sůl hýbou váhou o 1–3 kg ze dne na den. Ten průměr je o 0,4 kg dolů — to ráno byla voda.\"</li>\n        <li><strong>Podhodnocený log.</strong> Nejčastější „relaps\". Zapíše málo, tělo stojí, chce ubrat. NEsnižuješ cíl, koučuješ přesnost (olej na pánvi, doslazené kafe, ochutnávky při vaření).</li>\n        <li><strong>„Kosmeticky hezký\" log.</strong> Nezapisuje pivo a olej, aby vypadal dobře. „Engine počítá z reality. Co tam nedáš, to tě připraví o správnou úpravu — škodíš jen sobě.\"</li>\n        <li><strong>Hubnutí za každou cenu.</strong> Chce řezat víc a rychleji. Severka: udržení &gt; rychlé shození. Tempo je ohraničené na 0,5–1 %/týden záměrně.</li>\n        <li><strong>Honění váhy, ignorování měr a fotek.</strong> Při recompu nebo platu váha lže. Přepni pozornost na obvody a fotky.</li>\n        <li><strong>Strach z jídla / zakázané potraviny.</strong> Žádná démonizace. Flexibilní přístup, žádné „sacharidy večer tloustnou\".</li>\n      </ul>\n    </div>\n\n    <div class=\"praxe\"><b>V praxi (Martin):</b> Klientka v rekompozici panikaří, že tři týdny stojí na váze. Otevřu míry: pas −0,9 cm, váha flat. „Tohle je přesně to, co chceme. Hubneš tuk a držíš sval, váha to neukáže. Deficit nepřidáváme, držíme kurz.\"</div>",
    "task": "Vyber dvě chyby z výčtu, na které u klientů narazíš nejčastěji. Napiš si u každé jednu větu „přerámování\" tak, jak ji řekneš naživo — klidně, bez kárání.",
    "quiz": [
      {
        "q": "Klient vidí ráno +1,5 kg a chce zařezat. Co mu řekneš?",
        "a": "Hodnotíme klouzavý průměr, ne jedno číslo. Voda/glykogen/sůl hýbou váhou o 1–3 kg za den. Trend jde dolů, to ráno byla voda."
      },
      {
        "q": "Klient málo zapisuje, tělo stojí, chce ubrat kalorie. Tvůj krok?",
        "a": "Nesnižuješ cíl — koučuješ přesnost zápisu. Podhodnocený log je nejčastější „relaps\", ne důvod jíst míň."
      },
      {
        "q": "Při recompu/platu klient honí jen váhu. Co uděláš?",
        "a": "Přepneš jeho pozornost na obvody a fotky — váha tam lže (drží sval, hubne tuk)."
      },
      {
        "q": "Jaká je severka u klienta, co chce hubnout za každou cenu?",
        "a": "Udržení > rychlé shození. Tempo je záměrně ohraničené na 0,5–1 %/týden."
      },
      {
        "q": "Jak řešíš strach z „zakázaných\" potravin?",
        "a": "Žádná démonizace. Flexibilní přístup, žádné mýty typu „sacharidy večer tloustnou\"."
      }
    ]
  },
  {
    "id": "m20-l7",
    "title": "Startovací cíle a makra do hloubky",
    "prevHref": "/akademie/studium/m20-l6/",
    "prevLabel": "Časté chyby klientů",
    "nextHref": "/akademie/studium/m20-l8/",
    "nextLabel": "Měření pokroku",
    "body": "    <p class=\"lead\">Tohle je STARTOVACÍ odhad — výchozí čísla, ze kterých klient vyjede. Adaptivní úprava z reálné bilance je samostatná věc (check-iny). Tady je přesně, jak se startovní cíle počítají a v jakém pořadí se skládají makra.</p>\n\n    <h2>Od BMR k cíli</h2>\n    <div class=\"points\">\n      <ul>\n        <li><strong>BMR (Mifflin-St Jeor):</strong> 10 × váha(kg) + 6,25 × výška(cm) − 5 × věk; muž <strong>+5</strong>, žena <strong>−161</strong>.</li>\n        <li><strong>TDEE</strong> = BMR × násobič aktivity (1,2 / 1,375 / 1,55 / 1,725 / 1,9).</li>\n        <li><strong>Kalorický cíl z tempa:</strong> cut = TDEE − (tempo_kg × 7700)/7; bulk = TDEE + (tempo_kg × 7700)/7. 1 kg ≈ 7700 kcal.</li>\n        <li><strong>Tempo se ořezává tvrdě:</strong> hubnutí 0,5–1,0 %/týden, nabírání max 0,5 kg/týden — i kdyby UI poslalo víc.</li>\n        <li><strong>Kalorická podlaha startu:</strong> žena 1200, muž 1500 — níž startovní cíl nikdy.</li>\n      </ul>\n    </div>\n\n    <h2>Makra v pořadí priority</h2>\n    <div class=\"steps\">\n      <div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Bílkoviny</b><span>Default 1,8 g/kg (rozmezí 1,6–2,2). Mají přednost, nehýbou se.</span></div></div>\n      <div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Tuk</b><span>Cíl 0,8 g/kg (podlaha 0,6), ALE smí klesnout, aby se makra vešla do kcal — nikdy ne pod <strong>22 % kalorií</strong>. Warning pod 20 %.</span></div></div>\n      <div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Sacharidy</b><span>Zbytek do kalorií.</span></div></div>\n      <div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Vláknina</b><span>13 g / 1000 kcal, strop 60 g.</span></div></div>\n    </div>\n    <p><strong>Fat floor 22 % = hormony.</strong> Dlouhodobě moc nízký tuk sahá na tvorbu pohlavních hormonů a vstřebávání vitaminů rozpustných v tuku. Proto je to v kódu, ne na klientovi.</p>\n    <p><strong>Precizní režim</strong> přidává tvrdé cíle na sacharidy a tuky. Většině klientů ho NEZAPÍNEJ — jen je stresuje a tempo stejně diktují kalorie. Nech ho pro soutěžní přípravu nebo lidi, co fakt chtějí ladit.</p>\n\n    <div class=\"praxe\"><b>V praxi (Martin):</b> Muž 82 kg, 178 cm, 30 let, střední aktivita, hubnutí svižně (1 %). BMR = 1787,5, TDEE ≈ 2771 kcal, deficit ≈ 900 kcal/den → cíl ≈ 1869 kcal, bílkoviny ≈ 148 g, vláknina ≈ 24 g. Appka to spočítá za vteřinu — ty to klientovi jen vysvětlíš.</div>",
    "task": "Spočítej startovní cíle pro modelového klienta (vyber váhu, výšku, věk, aktivitu, tempo): BMR → TDEE → kalorický cíl → bílkoviny (1,8 g/kg) → vláknina. Ověř, že tuk nepadl pod 22 % kalorií.",
    "quiz": [
      {
        "q": "Jak spočítáš BMR podle Mifflin-St Jeor?",
        "a": "10 × váha(kg) + 6,25 × výška(cm) − 5 × věk; muž +5, žena −161. Pak TDEE = BMR × násobič aktivity."
      },
      {
        "q": "Jaká je default a rozmezí bílkovin?",
        "a": "Default 1,8 g/kg, rozmezí 1,6–2,2 g/kg. Mají přednost a nehýbou se."
      },
      {
        "q": "Proč nesmí tuk klesnout pod 22 % kalorií?",
        "a": "Hormony — dlouhodobě moc nízký tuk sahá na tvorbu pohlavních hormonů a vstřebávání vitaminů rozpustných v tuku. Proto je to v kódu."
      },
      {
        "q": "Komu (NE)zapínat Precizní režim?",
        "a": "Většině NE — jen stresuje a tempo stejně diktují kalorie. Jen soutěžní příprava nebo lidi, co fakt chtějí ladit."
      },
      {
        "q": "Kolik je kalorická podlaha startu?",
        "a": "Žena 1200, muž 1500 kcal — níž startovní cíl nikdy nejde."
      }
    ]
  },
  {
    "id": "m20-l8",
    "title": "Měření pokroku: čtyři okna, čtyři rychlosti",
    "prevHref": "/akademie/studium/m20-l7/",
    "prevLabel": "Startovací cíle & makra",
    "nextHref": "/akademie/studium/m20-l9/",
    "nextLabel": "Trénink a kalorie",
    "body": "    <p class=\"lead\">Jedna věta na všechno: <strong>hodnotíme trend, ne jedno číslo.</strong> Klientova práce je logovat hustě a poctivě, tvoje práce je číst směr. Každá metrika má svoje okno a svoji rychlost.</p>\n\n    <table>\n      <tr><th>Metrika</th><th>Okno trendu</th><th>Proč ne jedno číslo</th></tr>\n      <tr><td>Váha</td><td>klouzavý průměr 7 dní</td><td>voda/glykogen/sůl ±1–3 kg/den</td></tr>\n      <tr><td>Tělesné míry</td><td>~21 dní (3 týdny)</td><td>pomalá změna + nepřesnost metru</td></tr>\n      <tr><td>Síla (1RM)</td><td>trend z ≥ 2 tréninků na cvik</td><td>jeden špatný den ≠ ztráta síly</td></tr>\n      <tr><td>Fotky</td><td>1× za 2–4 týdny</td><td>vizuální změna je pozvolná</td></tr>\n    </table>\n\n    <h2>Váha: čteš čáru, ne ranní číslo</h2>\n    <p>Velké číslo na obrazovce NENÍ dnešní vážení — je to klouzavý průměr za 7 dní. Nauč klienta vážit se ráno, po záchodě, nalačno, vždy stejně, ideálně denně (min. 3–4×/týden — průměr je tak silný, jak hustý je log).</p>\n\n    <h2>Míry: když váha lže</h2>\n    <p>Obvody (hrudník, pas, boky, zadek, stehno) se mění pomaleji, okno 3 týdny. Na míry spoléháš, když <strong>váha lže</strong> — rekompozice (pas dolů, zadek/stehno nahoru), začátečnice v objemu, plató. Čtení podle pohlaví: muž primárně váha + pas, u ženy je pokles prsou/obvodů validní signál tuku. Kdo nechce na váhu vůbec, může jet čistě na obvodech.</p>\n\n    <h2>Fotky: pomalé, ale nejvíc vidět</h2>\n    <p>1× za 2–4 týdny, stejné světlo a póza (zepředu / z boku / zezadu). Soukromé úložiště, podepsané URL na 1 hodinu — vidí je jen klient a ty. Řekni to klientovi nahlas, buduje to důvěru.</p>\n\n    <div class=\"praxe\"><b>V praxi (Martin):</b> Klient přijde vyděšený, že za noc nabral 2 kg. Otevřu graf klouzavého průměru: „Vidíš tu přímku? Ta jde dolů. To, co tě vyděsilo ráno, je sůl z včerejší pizzy a voda. Hodnotíme tuhle čáru, ne ranní číslo.\"</div>",
    "task": "U jednoho klienta urči, která metrika je pro něj teď hlavní (váha vs. míry vs. fotky) a proč. Pokud je v recompu nebo platu, naplánuj, jak přesměruješ jeho pozornost z váhy na obvody.",
    "quiz": [
      {
        "q": "Jaké je okno trendu pro váhu a proč?",
        "a": "Klouzavý průměr 7 dní — voda, glykogen a sůl hýbou váhou o 1–3 kg ze dne na den, jedno vážení nic neřekne."
      },
      {
        "q": "Kdy se spoléháš na míry místo váhy?",
        "a": "Když váha lže — rekompozice, začátečnice v objemu, plató. Obvody ukážou změnu, kterou váha schová."
      },
      {
        "q": "Jak často a jak se dělají fotky pokroku?",
        "a": "1× za 2–4 týdny, stejné světlo a póza (zepředu/z boku/zezadu). Soukromé, podepsané URL — vidí je jen klient a ty."
      },
      {
        "q": "Jak silný je klouzavý průměr váhy?",
        "a": "Tak silný, jak hustý je log. Proto klient váží ráno, nalačno, stejně, ideálně denně (min. 3–4×/týden)."
      },
      {
        "q": "Jaké je čtení měr podle pohlaví?",
        "a": "Muž primárně váha + pas. U ženy je pokles prsou a obvodů validní signál úbytku tuku."
      }
    ]
  },
  {
    "id": "m20-l9",
    "title": "Proč trénink nepatří do kalorického enginu",
    "body": "<p class=\"lead\">Klient po tréninku chce „připsat\" 500 kcal navíc a najednou má díru v deficitu. V téhle lekci pochopíš, proč trénink logujeme jako sílu a progresi, ne jako vstup do kalorické matematiky.</p>\n\n<div class=\"points\"><strong>Co si z lekce odneseš:</strong><ul><li>Jak klient zapisuje sérii a jaký je rozdíl mezi Jednoduchým a Plným režimem.</li><li>Odhad 1RM přes Epleyho vzorec a proč měříme sílu bez rizika maximálky.</li><li>Co je objem za týden a proč je to kontext, ne cíl.</li><li>Proč trénink NEvstupuje do kalorického enginu a kde se výdej už skrytě počítá.</li></ul></div>\n\n<h2>Jak klient loguje trénink</h2>\n<p>Klient zapisuje na každou sérii tři čísla: série × opakování × váha (kg) + název cviku. Máš dva režimy. <strong>Jednoduchý</strong> ukazuje jen „jak na tom jsi proti minule\". <strong>Plný</strong> přidá objem, odhad síly a osobáky.</p>\n<p>Začátečníka drž v Jednoduchém režimu. Číslo „objem 12 400 kg\" laika spíš vyděsí. Plný režim a grafy nasaď, až klient sám chce vidět progres.</p>\n\n<h2>Odhad 1RM a progresivní přetížení</h2>\n<p>Sílu odhadujeme přes Epleyho vzorec, bez rizika maximálky:</p>\n<div class=\"eq\">1RM = VÁHA × (1 + OPAKOVÁNÍ / 30)</div>\n<table><tr><th>Série</th><th>Odhad 1RM</th></tr><tr><td>100 kg × 5</td><td>117 kg</td></tr><tr><td>60 kg × 8</td><td>76 kg</td></tr></table>\n<p>Celá filozofie progresivního přetížení je ve dvou slovech: „Minule {váha} kg × {opakování}. Zkus přidat.\" Cíl není odtrénovat, ale překonat minulé já. I o jedno opakování nebo 2,5 kg.</p>\n<p>Když dnešní nejlepší 1RM přebije nejlepší z historie, appka zavibruje a naskočí odznak „OSOBÁK\". To je dopaminová odměna. Pochval ho.</p>\n\n<h2>Objem za týden</h2>\n<p>Objem za týden = série × opakování × váha za 7 dní. Když roste, klient přidává podnět. Ale objem je kontext, ne cíl. Kvalita sérií a progrese ve váze je důležitější.</p>\n\n<h2>Proč trénink NEvstupuje do kalorického enginu</h2>\n<p>Kalorický výdej z tréninku je notoricky nepřesný odhad a podléhá adaptaci. Engine počítá TDEE z reálné energetické bilance (zalogovaný příjem vs. trend váhy), což už dopad tréninku automaticky obsahuje. Tělo ho promítne do váhy.</p>\n<div class=\"steps\"><div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Engine čte realitu</b><span>TDEE jde z příjmu vs. trendu váhy, dopad tréninku je tam už schovaný.</span></div></div><div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Připsat výdej zvlášť = počítat dvakrát</b><span>Když výdej z tréninku připíšeš ručně, započítáš ho podruhé.</span></div></div><div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Trénink je páka na svaly a sílu</b><span>A nepřímo na výdej. Ne vstup do kalorické matematiky.</span></div></div></div>\n\n<div class=\"praxe\"><b>V praxi (Martin):</b> Klient chce po tréninku „připsat\" 500 kcal navíc k jídlu. Vysvětli: „To nedělej. Výdej z tréninku už je schovaný v tom, jak se hýbe tvoje váha — engine ho čte z reality. Když si ho připíšeš, započítáš ho dvakrát a vyrobíš si díru v deficitu.\"</div>\n\n<blockquote>Trénink je páka na svaly a sílu, ne vstup do kalorické matematiky.</blockquote>",
    "quiz": [
      {
        "q": "Která tři čísla klient zapisuje na každou sérii a co k nim přidá?",
        "a": "Série × opakování × váha v kg, plus název cviku."
      },
      {
        "q": "Jak zní Epleyho vzorec pro odhad 1RM a kolik vyjde u 100 kg × 5?",
        "a": "1RM = váha × (1 + opakování/30). U 100 kg × 5 vyjde 117 kg."
      },
      {
        "q": "Proč trénink nevstupuje do kalorického enginu?",
        "a": "Výdej z tréninku je nepřesný a podléhá adaptaci. Engine počítá TDEE z reálné bilance (příjem vs. trend váhy), takže dopad tréninku už obsahuje. Připočítat ho zvlášť by znamenalo počítat ho dvakrát."
      },
      {
        "q": "Co odpovíš klientovi, který si chce po tréninku připsat 500 kcal navíc?",
        "a": "Ať to nedělá. Výdej je už schovaný v tom, jak se hýbe jeho váha, engine ho čte z reality. Připsáním by ho započítal dvakrát a vyrobil si díru v deficitu."
      },
      {
        "q": "Je objem za týden cíl, nebo kontext, a v jakém režimu drž začátečníka?",
        "a": "Objem je kontext, ne cíl. Důležitější je kvalita sérií a progrese ve váze. Začátečníka drž v Jednoduchém režimu, plný režim a grafy nasaď, až je sám chce."
      }
    ],
    "task": "U jednoho klienta tento týden zkontroluj, že si do enginu nepřipisuje žádný výdej z tréninku, a u dvou jeho sérií spočítej odhad 1RM přes Epleyho vzorec, abys viděl progresi proti minule.",
    "prevHref": "/akademie/studium/m20-l8/",
    "prevLabel": "Měření pokroku",
    "nextHref": "/akademie/studium/m20-l10/",
    "nextLabel": "Nástroje a logování"
  },
  {
    "id": "m20-l10",
    "title": "Logování bez výmluv: čtyři vrstvy a prázdný den jako jediná chyba",
    "body": "<p class=\"lead\">Klient nezůstane v appce kvůli funkcím, ale kvůli tomu, jestli pochopil, proč loguje. Tahle lekce ti dá pořadí: nejdřív filozofie, nástroje až potom.</p>\n\n<div class=\"points\"><strong>Co si z lekce odneseš:</strong><ul><li>Proč filozofii učíš dřív než tlačítka — jinak klient po týdnu skončí.</li><li>Čtyři vrstvy zápisu od nejpřesnější po nejhrubší a že každá je platná.</li><li>Tabulku situace → nástroj, kterou doporučíš na míru.</li><li>Jak klienta odnaučit „prázdný den\" pomocí rychlého přidání.</li></ul></div>\n\n<h2>Pořadí: filozofie, pak nástroje</h2>\n<p>Filozofii uč první, nástroje až potom. Když klient pochopí filozofii, loguje. Když nepochopí, po týdnu skončí. Tlačítka mu ukážeš, až bude vědět, proč je mačká.</p>\n\n<h2>Pět principů, co učíš nejdřív</h2>\n<div class=\"steps\">\n<div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Nikdy klienta nezablokuješ</b><span>Čtyři vrstvy od nejpřesnější po nejhrubší — najít potravinu, vlastní potravina, rychlé přidání (jen kalorie), EAN/skener. Každá je platný zápis. „Oběd v restauraci, 800 kcal\" a hotovo.</span></div></div>\n<div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Poctivost před přesností</b><span>Engine počítá z reality. Olej na pánvi, doslazené kafe, dvě piva v pátek — patří tam.</span></div></div>\n<div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Prázdný den je jediná chyba</b><span>Radši hrubý odhad zapsaný než přesné číslo, které nezapíšeš.</span></div></div>\n<div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Zápis je beztrestný</b><span>Mazání jídla jde vrátit. Klient se nesmí bát „pokazit\" data.</span></div></div>\n<div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Šablony a recepty jsou návrh, ne vězení</b><span>Klient si je upravuje, neslouží jako pevný předpis.</span></div></div>\n</div>\n\n<div class=\"eq\">PRÁZDNÝ DEN JE JEDINÁ CHYBA. VŠECHNO OSTATNÍ JE PLATNÝ ZÁPIS.</div>\n\n<h2>Který nástroj kdy doporučit</h2>\n<p>Když klient pochopí filozofii, vyber mu nástroj podle situace, ve které zrovna je.</p>\n<table>\n<tr><th>Situace</th><th>Nástroj</th></tr>\n<tr><td>Základní potravina, ví co jí</td><td>Hledání + tap</td></tr>\n<tr><td>Jí to samé pořád</td><td>Tlačítko „+\"/Nedávné</td></tr>\n<tr><td>Balený produkt s obalem</td><td>Skener EAN</td></tr>\n<tr><td>Produkt není v DB, zná hodnoty</td><td>Vlastní potravina</td></tr>\n<tr><td>Restaurace/babička/nemá nic</td><td>Rychlé přidání (jen kalorie)</td></tr>\n<tr><td>Vaří doma stejná jídla</td><td>Recept</td></tr>\n<tr><td>Typický opakovaný den</td><td>Šablona</td></tr>\n<tr><td>Skoro stejný den</td><td>Zkopírovat den</td></tr>\n</table>\n\n<h2>Detaily, co se vyplatí znát</h2>\n<p>Hledání je dvoufázové a bez diakritiky: Martinova kurátorská DB hned nahoře, Open Food Facts async. „rohlik\" najde „Rohlík\". EAN skenuj jako reflex — vteřina práce, nejpřesnější cesta. Uklidni klienta: „Nic se nenahrává, kamera jen čte kód.\" Recepty a šablony jsou hlavní páka na setrvání. Klient uloží 2–3 typické dny a pak jen načítá a dolaďuje.</p>\n\n<p>V onboardingu nauč klienta nejhrubší vrstvu (rychlé přidání), ne nejjemnější. Když umí zapsat odhad, neexistuje den, kdy by nelogoval.</p>\n\n<div class=\"praxe\"><b>V praxi (Martin):</b> Klient se omlouvá, že byl na svatbě a „nemohl nic zapsat\". Nauč ho rychlé přidání: „Příště to dáš jako ‚svatba, oběd, odhad 1200 kcal' a jedeš dál. Nepřesný odhad je pořád sto procent lepší než prázdný den.\"</div>\n\n<blockquote>Nepřesný odhad je pořád sto procent lepší než prázdný den.</blockquote>",
    "quiz": [
      {
        "q": "Co učíš dřív — filozofii, nebo nástroje? A proč?",
        "a": "Filozofii. Když ji klient pochopí, loguje. Když nepochopí, po týdnu skončí. Tlačítka mu ukážeš až potom."
      },
      {
        "q": "Vyjmenuj čtyři vrstvy zápisu od nejpřesnější po nejhrubší.",
        "a": "Najít potravinu, vlastní potravina, rychlé přidání (jen kalorie), EAN/skener. Každá je platný zápis."
      },
      {
        "q": "Proč mají do zápisu patřit i olej na pánvi, doslazené kafe nebo dvě piva v pátek?",
        "a": "Protože poctivost je nad přesností. Engine počítá z reality, takže tyhle věci tam patří."
      },
      {
        "q": "Kterou vrstvu nauč klienta v onboardingu jako první a proč?",
        "a": "Nejhrubší — rychlé přidání. Když umí zapsat odhad, neexistuje den, kdy by nelogoval."
      },
      {
        "q": "Jak klienta uklidníš u skeneru EAN?",
        "a": "Řekneš mu: „Nic se nenahrává, kamera jen čte kód.\" Je to vteřina práce a nejpřesnější cesta."
      }
    ],
    "task": "Vezmi jednoho klienta, který nedávno vynechal den, a nauč ho rychlé přidání jediným odhadem (např. „restaurace, oběd, 800 kcal\"), ať příště místo prázdného dne zapíše aspoň hrubý odhad.",
    "prevHref": "/akademie/studium/m20-l9/",
    "prevLabel": "Trénink a kalorie",
    "nextHref": "/akademie/studium/m20-l11/",
    "nextLabel": "Safety a hranice"
  },
  {
    "id": "m20-l11",
    "title": "Safety a hranice: kdy mlčíš a předáš dál",
    "body": "<p class=\"lead\">Jako trenér narazíš na zprávy, kde nemáš co počítat ani radit. Tady se naučíš poznat, kdy přestat dělat trenéra a začít chránit klienta.</p>\n\n<div class=\"points\"><strong>Co si z lekce odneseš:</strong><ul><li>Témata, u kterých nediagnostikuješ a nedáváš věcné rady (nemoc, porucha příjmu potravy, těhotenství, léky, psychika, nezletilí).</li><li>Jak na rizikovou zprávu zareagovat a kam ji předat.</li><li>Co je pre-flag fronta a proč opatrnost držíš, i když klient téma přerámuje.</li><li>Záchytnou větu, kterou si vybavíš pokaždé, když si nejsi jistý.</li></ul></div>\n\n<h2>Safety není doplněk</h2>\n<p>Tohle je nepřekročitelné. Platí pro AI Martina i pro tebe jako trenéra úplně stejně. Safety není něco navíc, co přidáš na konec. Je to součást metody.</p>\n\n<div class=\"eq\">KDYŽ SI NEJSI JISTÝ, RADĚJI ŘEKNI MÍŇ</div>\n\n<h2>Kde mlčíš a předáš dál</h2>\n<p>Tady jsou témata, u kterých nepokračuješ jako trenér. Pamatuj si je.</p>\n\n<div class=\"steps\">\n<div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Nediagnostikuješ</b><span>Neříkáš „máš X\". Příznaky nemoci (apnoe, štítná žláza, PCOS, inzulinová rezistence, deprese) → „neumím posoudit, patří to k lékaři / k Martinovi osobně.\"</span></div></div>\n<div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Porucha příjmu potravy</b><span>Obsese kolem kalorií, „kolik nejmíň můžu jíst\", hladovění, otázky na purging: NEDÁVÁŠ kalorické ani makro rady, NEodpovídáš věcně na „matematiku\" hladovění. Vyjádříš starost, odkážeš na Martina a odbornou pomoc.</span></div></div>\n<div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Těhotenství a kojení</b><span>Neradíš diety → gynekolog/lékař a Martin.</span></div></div>\n<div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Léky</b><span>Nikdy návod na vysazení nebo úpravu → „konzultuj s lékařem\".</span></div></div>\n<div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Psychická krize</b><span>Uveď Linku první psychické pomoci 116 123 (zdarma, 24/7, anonymně) a doporuč odborníka nebo blízkého.</span></div></div>\n<div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Nezletilí</b><span>Neřešíš hubnutí → pediatr.</span></div></div>\n</div>\n\n<h2>Pre-flag fronta a opatrnost</h2>\n<p>Riziková zpráva se označí a přepne do safe-response módu. A teď pozor: i když klient téma „přerámuje\" na neškodné, opatrnost se drží dál. Raději míň.</p>\n<p>Data jsou klienta. Vidí jen svoje, může si je kdykoli stáhnout do CSV a odejít.</p>\n\n<h2>Záchytná věta</h2>\n<p>Když si nejsi jistý nebo je téma mimo výživu/trénink, máš jednu větu, kterou se řídíš:</p>\n<blockquote>Když si nejsi jistý nebo je téma mimo výživu/trénink, raději řekni míň a doporuč klientovi napsat přímo Martinovi.</blockquote>\n\n<div class=\"praxe\"><b>V praxi (Martin):</b> Klientka napíše „jsem ve 3. měsíci, jak mám upravit kalorie na hubnutí?\". Tady NEPOČÍTÁŠ. „Gratuluju! Tohle ale neřeším — v těhotenství výživu nastavuje gynekolog. Napiš mi to do zprávy a domluvíme se, jak dál bezpečně.\" A téma jde do pre-flag fronty.</div>",
    "quiz": [
      {
        "q": "Klient napíše, že má pořád únavu a ptá se, jestli nemá štítnou žlázu. Co uděláš?",
        "a": "Nediagnostikuješ. Řekneš, že to neumíš posoudit a patří to k lékaři nebo k Martinovi osobně. Příznaky nemoci (apnoe, štítná žláza, PCOS, inzulinová rezistence, deprese) trenér neřeší."
      },
      {
        "q": "Klientka se ptá, kolik nejmíň kalorií může za den sníst, a píše o obsesi kolem počítání. Jak reaguješ?",
        "a": "Nedáváš kalorické ani makro rady a neodpovídáš věcně na matematiku hladovění. Vyjádříš starost a odkážeš na Martina a odbornou pomoc. Je to známka poruchy příjmu potravy."
      },
      {
        "q": "Jaké číslo uvedeš klientovi v psychické krizi a co k němu doplníš?",
        "a": "Linku první psychické pomoci 116 123 (zdarma, 24/7, anonymně) a doporučíš odborníka nebo blízkého."
      },
      {
        "q": "Klient nejdřív napsal rizikovou zprávu, pak ji ale přetočil na neškodné téma. Můžeš povolit opatrnost?",
        "a": "Ne. Riziková zpráva jde do pre-flag fronty a přepne do safe-response módu. I když klient téma přerámuje na neškodné, opatrnost se drží dál. Raději míň."
      },
      {
        "q": "Jak zní záchytná věta, kterou se řídíš, když si nejsi jistý?",
        "a": "Když si nejsi jistý nebo je téma mimo výživu/trénink, raději řekni míň a doporuč klientovi napsat přímo Martinovi."
      }
    ],
    "task": "Projdi si poslední zprávy od klientů a najdi jednu, kterou bys měl podle safety pravidel předat dál (lékaři, Martinovi, odborné pomoci), a napiš si, jak bys na ni odpověděl bez diagnostiky a bez čísel.",
    "prevHref": "/akademie/studium/m20-l10/",
    "prevLabel": "Nástroje a logování",
    "nextHref": "/akademie/studium/m20-l12/",
    "nextLabel": "Trenérský rámec"
  },
  {
    "id": "m20-l12",
    "title": "Trenérský rámec: jak systém učit, ne jen aplikovat",
    "body": "<p class=\"lead\">Tahle lekce není o klientovi, je o tobě jako trenérovi. O tom, kde sám děláš chyby při aplikaci systému a jak vést klienta tak, aby tě časem nepotřeboval.</p>\n\n<div class=\"points\"><strong>Co si z lekce odneseš:</strong><ul><li>Jak poznat red flags u klienta a kdy předat dál místo přidávat čísla.</li><li>Jak komunikovat úpravu, aby to nikdy neznělo „appka řekla“.</li><li>Sedm nejčastějších chyb trenérů při aplikaci systému.</li><li>Proč je samostatný klient cíl, ne hrozba pro byznys.</li></ul></div>\n\n<h2>Red flags u klienta</h2>\n<p>Když u klienta uvidíš obsese kolem kalorií, otázky typu „kolik nejmíň můžu jíst“, schovávání jídla, paniku z každého vážení nebo žádost o extrémní deficit, zpozorni. Při náznaku poruchy příjmu potravy nepřidáváš čísla. Předáváš dál.</p>\n\n<h2>Jak komunikovat úpravu</h2>\n<p>Nikdy „appka řekla“. Vždy jdeš přes faktory, pak lidská řeč, pak jeden krok. „Tělo stojí, log je poctivý, tak přidáme silovou jednotku, kalorie nesahám.“ Klient slyší logiku, ne příkaz ze stroje.</p>\n\n<div class=\"eq\">FAKTORY → LIDSKÁ ŘEČ → JEDEN KROK</div>\n\n<h2>Jak vést k samostatnosti</h2>\n<p>Vždy přidej PROČ. Klient, co rozumí logice, tě časem nepotřebuje. To je cíl, ne hrozba pro byznys.</p>\n\n<h2>Časté chyby trenérů při aplikaci systému</h2>\n<p>Tohle je sedm věcí, na kterých trenéři systém rozbíjejí. Projeď si je a najdi tu svoji.</p>\n\n<div class=\"steps\">\n<div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Řeže kalorie jako první páku</b><span>To engine schválně nedělá. Kalorie jsou poslední páka, ne první.</span></div></div>\n<div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Reaguje na jeden týden nebo jedno vážení</b><span>Místo na 3týdenní trend.</span></div></div>\n<div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Mění cíle při děravém logu</b><span>Pod adherence gate. To je hádání, ne řízení.</span></div></div>\n<div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Při stagnaci na váze v recompu „pomáhá“ deficitem</b><span>Tím ničí progres.</span></div></div>\n<div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Moralizuje o jídle a UPF</b><span>Tím odežene klienta.</span></div></div>\n<div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Kárá za podhodnocený log</b><span>Místo aby edukoval přesnost.</span></div></div>\n<div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Zapíná Precise režim každému</b><span>A připisuje výdej z tréninku k jídlu, tím má dvojí započítání.</span></div></div>\n</div>\n\n<blockquote>Než ubereš, ukaž mi faktory. V devíti z deseti případů je díra v zápisu nebo v aktivitě, ne v kaloriích.</blockquote>\n\n<div class=\"praxe\"><b>V praxi (Martin):</b> Nový trenér přijde, že jeho klient „tři týdny nehubne, tak mu uberu 400 kcal“. Zastav ho: „Než ubereš, ukaž mi faktory. Kolik dní zalogoval? Jaké vyšlo TDEE? Sedí aktivita? V devíti z deseti případů je díra v zápisu nebo v aktivitě, ne v kaloriích. Kalorie jsou poslední páka, ne první.“</div>\n\n<p>Tahle sekce je o tobě. Klient, co rozumí <strong>proč</strong>, tě časem nepotřebuje, a to je přesně to, co chceš.</p>",
    "quiz": [
      {
        "q": "Jaké red flags u klienta znamenají, že máš přestat přidávat čísla a předat dál?",
        "a": "Obsese kolem kalorií, otázky „kolik nejmíň můžu jíst“, schovávání jídla, panika z každého vážení a žádost o extrémní deficit. Při náznaku poruchy příjmu potravy nepřidáváš čísla, předáváš dál."
      },
      {
        "q": "Jak má vypadat komunikace úpravy s klientem?",
        "a": "Nikdy „appka řekla“. Vždy přes faktory, lidská řeč, jeden krok. Třeba: tělo stojí, log je poctivý, tak přidáme silovou jednotku a kalorie nesaháme."
      },
      {
        "q": "Proč k úpravě vždy přidat PROČ?",
        "a": "Protože klient, co rozumí logice, tě časem nepotřebuje. Samostatný klient je cíl, ne hrozba pro byznys."
      },
      {
        "q": "Proč nemáš řezat kalorie jako první páku při stagnaci?",
        "a": "Engine to schválně nedělá. V devíti z deseti případů je díra v zápisu nebo v aktivitě, ne v kaloriích. Kalorie jsou poslední páka, ne první."
      },
      {
        "q": "Co je špatně na reakci na jeden týden a na změně cílů při děravém logu?",
        "a": "Na jeden týden nebo jedno vážení nereaguješ, řídíš se 3týdenním trendem. Měnit cíle při děravém logu pod adherence gate je hádání, ne řízení."
      }
    ],
    "task": "U svého klienta, co podle tebe stagnuje, nejdřív projeď faktory (počet zalogovaných dní, TDEE, aktivitu) a teprve pak zvaž úpravu, ale kalorií se dotkni až jako poslední páky.",
    "prevHref": "/akademie/studium/m20-l11/",
    "prevLabel": "Safety a hranice",
    "nextHref": "/akademie/studium/m20-l13/",
    "nextLabel": "Zlaté hlášky a tahák"
  },
  {
    "id": "m20-l13",
    "title": "Zlaté hlášky a tahák-karta: jak to říkáš a podle čeho se rozhoduješ",
    "body": "<p class=\"lead\">Klient nechce vzorec, chce větu, která mu sedne do hlavy. Tady máš hlášky, co používám naživo, a na konci tahák-kartu, podle které se rozhodneš, když zákazník stagnuje a tlačí na tebe.</p>\n\n<div class=\"points\"><strong>Co si z lekce odneseš:</strong><ul>\n<li>Hotové věty na situace, které se opakují u každého klienta.</li>\n<li>Pořadí pák při stagnaci — kcal je poslední, ne první.</li>\n<li>Rozhodovací strom: co vidíš → co uděláš.</li>\n<li>Tahák-kartu s čísly, ze které vyčteš všechno na jednom místě.</li>\n</ul></div>\n\n<h2>Zlaté hlášky: jak to říkáš klientům</h2>\n<p>Engine počítá, ty mluvíš. Hlášky nejsou ozdoba, to je tvoje práce. Klient si zapamatuje větu, ne tabulku.</p>\n<ul>\n<li>„Udržení je víc než rychlé shození.\"</li>\n<li>„Tělo je pravda, log je zašuměný odhad. Když si protiřečí, věř tělu.\"</li>\n<li>„Tohle jsou startovní čísla, ne dogma.\"</li>\n<li>„Zápis vyšel hodně nízko a tělo se zatím nehýbe. To skoro vždy znamená, že se do zápisu pár věcí nevešlo, ne že máš jíst míň. Pojďme na přesnost.\"</li>\n<li>„Hodnotíme trend, ne jedno číslo. Váha kolísá o 1–3 kg ze dne na den.\"</li>\n<li>„Recomp jede, váha stojí, míry dolů. Drž kurz, deficit nepřidáváme.\"</li>\n<li>„Vidím únavu a hlad, deficit teď nezvyšujeme.\"</li>\n<li>„Minule {váha} × {opakování}. Zkus přidat.\"</li>\n<li>„Osobák! Nejlíp v historii.\"</li>\n<li>„Prázdný den je jediná chyba.\"</li>\n<li>„Sacharidy ti hubnutí neřídí, to dělají kalorie.\"</li>\n</ul>\n<p>Pochval konkrétně, ne obecně: „pod 70 kg, paráda\". Energie střídmě — občas moravsky „Tož\", na konci „Be Effective\".</p>\n\n<div class=\"eq\">ENGINE POČÍTÁ, TY MLUVÍŠ. TĚLO JE PRAVDA, LOG JE ŠUM.</div>\n\n<h2>Anti-AI-slop: co klientovi NIKDY</h2>\n<p>Žádné „Není X, je Y\". Žádné pomlčky uprostřed věty. Žádné paralelní trojky. Žádná vata „klíčové / skutečné\". Žádné „Tady je proč…\". Test u každé věty: řekl bys to naživo, nebo to zní jako landing page?</p>\n\n<h2>Tahák-karta: severka a tři páky</h2>\n<p>Severka: udržení > rychlé shození. Klient hrotí tři věci a nic víc: kalorie (týdenní průměr), bílkoviny (1,6–2,2 g/kg, default 1,8), vlákninu (13 g/1000 kcal, cap 60 g).</p>\n\n<h2>Pořadí pák při stagnaci</h2>\n<p>Když to stojí, neházíš hned dolů kalorie. Jdeš odshora dolů a kcal sáhneš až nakonec.</p>\n<div class=\"steps\">\n<div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Přesnost</b><span>Sedí vůbec zápis? Pár věcí se do logu nevešlo skoro vždycky.</span></div></div>\n<div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Aktivita (silové)</b><span>Vrať pohyb a tréninky na plán, než budeš řezat jídlo.</span></div></div>\n<div class=\"row\"><div class=\"num\"></div><div class=\"b\"><b>Kalorie</b><span>Až nakonec, mírně. Kcal je poslední páka, ne první.</span></div></div>\n</div>\n\n<h2>Rozhodovací strom: co vidíš → co uděláš</h2>\n<table>\n<tr><th>Situace</th><th>Co uděláš</th></tr>\n<tr><td>Recomp (váha stojí, míry dolů)</td><td>Drž kurz</td></tr>\n<tr><td>Nízký log</td><td>Přesnost</td></tr>\n<tr><td>Únava / hlad / padá síla</td><td>Nezvyšuj deficit (2 týdny → diet break)</td></tr>\n<tr><td>Aktivita pod plán</td><td>Vrať aktivitu</td></tr>\n<tr><td>Opravdová stagnace</td><td>Mírně kcal</td></tr>\n</table>\n\n<h2>Klíčová čísla na jednom místě</h2>\n<p>BMR Mifflin: 10×kg + 6,25×cm − 5×věk (muž +5, žena −161). Aktivita: 1,2 / 1,375 / 1,55 / 1,725 / 1,9. 1 kg = 7700 kcal. Tempo hubnutí 0,5–1 %/týden, nabírání max 0,5 kg/týden, změna cíle max ±10 %/týden. Podlaha startu: žena 1200, muž 1500. Bílkoviny 1,6–2,2 g/kg (default 1,8), tuk podlaha 22 % kcal, vláknina 13 g/1000 kcal cap 60. Guardrail: únava ≥4 / hlad ≥4 / síla ≤2 (2 týdny → diet break). Recomp: váha flat <0,2 %/týden + míra ≥0,5 cm/týden. Adherence gate pod ~70 % dní. Okno 3 týdny / 21 dní. 1RM Epley: váha × (1 + opak/30).</p>\n\n<blockquote>Kcal je poslední páka, ne první. Nejdřív přesnost, pak aktivita, a teprve když to fakt stojí, sáhneš na jídlo.</blockquote>\n\n<div class=\"praxe\"><b>V praxi (Martin):</b> Klientka mi napíše „jím skoro nic a nehubnu, mám jíst ještě míň?\". Otevřu si zápis — vyšel hodně nízko a tělo se zatím nehýbe. Říkám: „Tohle skoro vždycky znamená, že se do zápisu pár věcí nevešlo, ne že máš jíst míň. Pojďme na přesnost.\" Deficit nezvyšuju, jedu odshora pákama — nejdřív přesnost logu, pak aktivita, kcal až úplně nakonec.</div>",
    "quiz": [
      {
        "q": "Jaká je severka celého systému a co je čí práce mezi tebou a enginem?",
        "a": "Severka: udržení je víc než rychlé shození. Engine počítá, ty mluvíš. Tělo je pravda, log je šum."
      },
      {
        "q": "Jaké je pořadí pák při stagnaci?",
        "a": "Přesnost → aktivita (silové) → až nakonec kcal. Kalorie jsou poslední páka, ne první."
      },
      {
        "q": "Klient má únavu, hlad a padá mu síla. Co uděláš?",
        "a": "Nezvyšuju deficit. Když to drží 2 týdny (únava ≥4 / hlad ≥4 / síla ≤2), jde diet break."
      },
      {
        "q": "Klient hrotí spoustu věcí. Které tři ho necháš sledovat?",
        "a": "Kalorie (týdenní průměr), bílkoviny (1,6–2,2 g/kg, default 1,8) a vlákninu (13 g/1000 kcal, cap 60 g)."
      },
      {
        "q": "Co klientovi řekneš, když mu vyšel zápis hodně nízko a tělo se nehýbe?",
        "a": "Že se do zápisu skoro vždycky pár věcí nevešlo, ne že má jíst míň. Jdeme na přesnost — deficit nezvyšuju."
      }
    ],
    "task": "Vezmi jednoho stagnujícího klienta a projdi ho rozhodovacím stromem odshora — přesnost, aktivita, kcal — a napiš si, kterou páku reálně sáhneš jako první.",
    "prevHref": "/akademie/studium/m20-l12/",
    "prevLabel": "Trenérský rámec",
    "nextHref": "/akademie/studium/#m20",
    "nextLabel": "Zpět na Modul 20"
  }
];
