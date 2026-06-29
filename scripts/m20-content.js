/* Obsah lekcí modulu 20 — z příručky MARTINUV_SYSTEM_V_PRAXI.md (Martinův hlas).
   Generuje se přes scripts/build-m20.js. */
module.exports = [

// ── §2 ─────────────────────────────────────────────────────────────────────
{
  id: 'm20-l3',
  title: 'Rozhodovací pravidla: pořadí pák je svaté',
  prevHref: '/akademie/studium/m20-l2/', prevLabel: 'Pět priorit v praxi',
  nextHref: '/akademie/studium/m20-l4/', nextLabel: 'Onboarding klienta',
  body: `    <p class="lead">Tohle je jádro celého systému a tvůj scénář pro každý hovor s klientem. Engine projde podmínky <strong>v pevném pořadí</strong> a první, která sedí, určí „páku". To pořadí musíš znát nazpaměť — protože nejčastější chyba trenéra je sáhnout po špatné páce ve špatný čas.</p>

    <div class="points"><strong>Co si z lekce odneseš:</strong>
      <ul>
        <li>Rozhodovací strom: co dělat, když se výsledek zastaví.</li>
        <li>Proč jsou <strong>kalorie až poslední páka</strong>, ne první.</li>
        <li>Jak řešit víkendy, restaurace, nemoc a cesty designem, ne pravidlem.</li>
      </ul>
    </div>

    <h2>Pořadí, ve kterém čteš situaci</h2>
    <div class="steps">
      <div class="row"><div class="num"></div><div class="b"><b>Váha stojí + míra padá = rekompozice</b><span>DRŽ KURZ, deficit NEPŘIDÁVÁŠ. Flat = změna &lt; 0,2 %/týden, míra padá = ≥ 0,5 cm/týden. Tohle je úspěch, ne stagnace. Laik tu panikaří — ty ne.</span></div></div>
      <div class="row"><div class="num"></div><div class="b"><b>Log vyšel nereálně nízko a tělo stojí</b><span>KOUČUJ PŘESNOST, kalorie NIKDY nesnižuješ. Když implikované TDEE vyjde pod BMR (fyzikálně nemožné), je to chyba zápisu, ne důvod jíst míň.</span></div></div>
      <div class="row"><div class="num"></div><div class="b"><b>Únava / hlad / slabost při dietě (guardrail)</b><span>Deficit NEZVYŠUJEŠ. Stačí jeden signál (únava ≥ 4 NEBO hlad ≥ 4 NEBO síla ≤ 2 na škále 1–5). Drží-li to ≥ 2 týdny → diet break (zvedni příjem k udržovačce).</span></div></div>
      <div class="row"><div class="num"></div><div class="b"><b>Aktivita spadla pod plán (pod 85 %)</b><span>VRAŤ AKTIVITU NA PLÁN, kalorie neřežeš. Spadl výdej, ne metabolismus.</span></div></div>
      <div class="row"><div class="num"></div><div class="b"><b>Opravdová stagnace</b><span>Tělo fakt stojí, přesnost sedí, aktivita splněná. Teprve teď řešíš v pořadí: přesnost → aktivita (silové minuty) → až úplně nakonec mírně kcal (max ±10 %/týden).</span></div></div>
      <div class="row"><div class="num"></div><div class="b"><b>Jde to / málo dat</b><span>Pokračuj stejně, neměň nic.</span></div></div>
    </div>

    <h2>Páky pro stagnaci do hloubky</h2>
    <p><strong>Přesnost je vždy první.</strong> Vážit jídlo, počítat tekuté a skryté kalorie, krabička na cesty. <strong>Aktivita je druhá</strong> — hlavně silové minuty (+1 silová jednotka ≈ +45 intenzivních min/týden). Aerobku a NEAT nepřeháněj, podléhají adaptaci. Páka se zapne, i když je aktivita „splněná", ale je pod stropem ~150 intenzivních min/týden — pořád je kam přidat dřív, než sáhneš na jídlo.</p>
    <div class="eq">KCAL JE POSLEDNÍ PÁKA, NE PRVNÍ</div>
    <p><strong>Kalorie sahej až nakonec.</strong> Tempo úpravy 0,5–1 % hmotnosti/týden, absolutní strop 1 kg/týden, změna cíle max ±10 %/týden. Žádné skoky.</p>

    <h2>Víkend, restaurace, nemoc, cesty</h2>
    <p><strong>Řeší to design, ne pravidlo.</strong> Kalorie jsou týdenní průměr, takže pátek na svatbě se rozpustí v týdnu. Když klient mine denní cíl, <strong>NEKOMPENZUJE zítra.</strong> Krátký výpadek (nemoc, cesty) neřeší trend — posuzovací okno jsou 3 týdny. Klient loguje hrubě (rychlé přidání, jen kalorie) a jede dál. Prázdný den je jediná chyba.</p>

    <div class="praxe"><b>V praxi (Martin):</b> Klientka stagnuje na váze. Laik-trenér hned ubere 300 kcal. Já se podívám na faktory: zalogováno 60 % dní, TDEE vychází pod BMR. Diagnóza není „moc malý deficit", ale „sní víc, než zapíše". Řeknu: „Zápis vyšel hodně nízko a tělo se nehýbe. To skoro vždy znamená, že se do zápisu pár věcí nevešlo, ne že máš jíst míň. Pojďme na přesnost." Kalorie nesahám. Be Effective.</div>`,
  task: 'Vezmi situaci „klient tři týdny nehubne". Než cokoliv změníš, projdi nahlas pět pák v pořadí a urči, která sedí. Napiš si první větu, kterou klientovi řekneš — bez slov „appka řekla".',
  quiz: [
    { q: 'Jaké je pořadí pák při opravdové stagnaci?', a: 'Přesnost → aktivita (silové minuty) → a teprve úplně nakonec mírně kalorie (max ±10 %/týden). Kcal je poslední, ne první.' },
    { q: 'Váha stojí, ale míry padají. Co uděláš?', a: 'Nic neměníš — držíš kurz. To je rekompozice (hubneš tuk, držíš sval), úspěch, ne stagnace. Deficit NEPŘIDÁVÁŠ.' },
    { q: 'Log vyšel nereálně nízko (TDEE pod BMR) a tělo stojí. Snížíš kalorie?', a: 'Ne. Koučuješ přesnost zápisu. Číslo pod BMR je fyzikálně nemožné = chyba logu, ne důvod jíst míň.' },
    { q: 'Klient hlásí únavu a hlad při dietě. Přidáš deficit?', a: 'Ne, deficit nezvyšuješ (guardrail). Stačí jeden signál (únava/hlad ≥ 4 nebo síla ≤ 2). Když to drží 2 týdny → diet break.' },
    { q: 'Jak řešíš víkend/restauraci?', a: 'Designem, ne pravidlem. Kalorie jsou týdenní průměr, výkyv se rozpustí. Klient NEKOMPENZUJE druhý den.' },
  ],
},

// ── §3 ─────────────────────────────────────────────────────────────────────
{
  id: 'm20-l4',
  title: 'Onboarding klienta: první týden',
  prevHref: '/akademie/studium/m20-l3/', prevLabel: 'Rozhodovací pravidla',
  nextHref: '/akademie/studium/m20-l1/', nextLabel: 'Veď klienta k samostatnosti',
  body: `    <p class="lead">Onboarding má tři kroky a jedinou úlohu: posbírat minimum dat a hned spočítat startovní čísla. První věta klientovi je <strong>„Pojďme nastavit start. Pár údajů, ať umíme spočítat tvoje startovací cíle."</strong></p>

    <div class="points"><strong>Co si z lekce odneseš:</strong>
      <ul>
        <li>Tři kroky onboardingu a co v nich měřit.</li>
        <li>Proč nechat klienta vybrat aktivitu <strong>konzervativně</strong>.</li>
        <li>Že tvoje práce v prvním týdnu je poctivost logu, ne ladění kalkulačky.</li>
      </ul>
    </div>

    <h2>Tři kroky</h2>
    <div class="steps">
      <div class="row"><div class="num"></div><div class="b"><b>Měříš</b><span>Jméno, pohlaví, výška, váha, věk, aktivita (5 stupňů: sedavý ×1,2 / lehká ×1,375 / střední ×1,55 / aktivní ×1,725 / velmi aktivní ×1,9).</span></div></div>
      <div class="row"><div class="num"></div><div class="b"><b>Cíl a tempo</b><span>Hubnutí / udržení / nabírání / rekompozice. U hubnutí default „Střední" (0,75 %/týden) — „Bez extrémů. Rozumné tempo je 0,5–1,0 % tělesné hmotnosti týdně." U nabírání default 0,25 kg/týden, strop 0,5.</span></div></div>
      <div class="row"><div class="num"></div><div class="b"><b>Startovní čísla</b><span>Denní cíl (kcal + makra) a odhad výdeje. Spočítá se z Mifflin-St Jeor → TDEE → cíl podle tempa.</span></div></div>
    </div>

    <h2>Konzervativní start, realita doladí</h2>
    <p><strong>Aktivitu nech vybrat konzervativně.</strong> Posun o stupeň je rozdíl stovek kalorií. Reálný log to za pár týdnů stejně dorovná. A hlavně: <strong>tvoje práce v prvním týdnu je dotáhnout poctivost logu, ne ladit kalkulačku.</strong> Mifflin je jen odhad — nehádej se s klientem o „správné" číslo.</p>

    <p>Větu na konci onboardingu musí umět každý trenér zopakovat vlastními slovy:</p>
    <blockquote>„Tohle jsou startovní čísla, ne dogma. Až budeš pár týdnů logovat jídlo, vážit se a měřit obvody, cíle se samy doladí podle reality."</blockquote>

    <div class="praxe"><b>V praxi (Martin):</b> Klient u onboardingu váhá mezi „lehká" a „střední" aktivita. Řeknu mu: „Vyber radši nižší. Když podstřelíš, appka to za dva tři týdny dorovná podle toho, co reálně sníš a jak se hýbe váha. Když přestřelíš, budeš se ptát, proč to nejde." Konzervativní start, realita doladí.</div>`,
  task: 'Naonboarduj (klidně na papíře) modelového klienta: posbírej 3 kroky, vyber konzervativně aktivitu a napiš tu závěrečnou větu „startovní čísla, ne dogma" vlastními slovy tak, jak bys ji řekl naživo.',
  quiz: [
    { q: 'Jaké tři kroky má onboarding?', a: '1) Měříš (pohlaví, výška, váha, věk, aktivita), 2) cíl a tempo, 3) startovní čísla (kcal + makra + odhad výdeje z Mifflin-St Jeor).' },
    { q: 'Proč nechat klienta vybrat aktivitu spíš nižší?', a: 'Posun o stupeň = stovky kalorií. Když podstřelíš, reálný log to za pár týdnů dorovná. Když přestřelíš, klient se diví, proč to nejde.' },
    { q: 'Co je tvoje hlavní práce v prvním týdnu?', a: 'Dotáhnout poctivost logu, ne ladit kalkulačku. Mifflin je jen odhad, realita ho doladí.' },
    { q: 'Jaké je rozumné tempo hubnutí, které klientovi nastavíš?', a: '0,5–1,0 % tělesné hmotnosti týdně. Bez extrémů — udržení je víc než rychlé shození.' },
    { q: 'Jak klientovi vysvětlíš startovní čísla?', a: '„Tohle jsou startovní čísla, ne dogma. Až budeš pár týdnů logovat a měřit se, cíle se samy doladí podle reality."' },
  ],
},

// ── §5 ─────────────────────────────────────────────────────────────────────
{
  id: 'm20-l5',
  title: 'Check-iny: co sleduješ týdně a jak upravuješ',
  prevHref: '/akademie/studium/m20-l1/', prevLabel: 'Veď klienta k samostatnosti',
  nextHref: '/akademie/studium/m20-l6/', nextLabel: 'Časté chyby klientů',
  body: `    <p class="lead">Check-in jede <strong>každý týden</strong> (klient nečeká, optimalizujeme včas), ale <strong>rozhoduje se podle 2–3týdenního trendu</strong> (posuzovací okno = 21 dní). Jeden špatný víkend check-in nerozhodí.</p>

    <div class="points"><strong>Co si z lekce odneseš:</strong>
      <ul>
        <li>Co engine vytáhne sám z dat a co klient doplní ručně.</li>
        <li>Co je <strong>adherence gate</strong> a proč při děravém logu neměníš cíle.</li>
        <li>Jak komunikovat úpravu a pochvalu.</li>
      </ul>
    </div>

    <h2>Co engine vytáhne sám vs. co doplní klient</h2>
    <table>
      <tr><th>Engine sám z dat</th><th>Klient doplní ručně</th></tr>
      <tr><td>Trend váhy (regrese, jen při ≥ 4 váženích a rozpětí ≥ 10 dní)</td><td>Reálná aktivita (kroky/den, intenzivní minuty)</td></tr>
      <tr><td>Průměrný zalogovaný příjem + adherence</td><td>Subjektivní škály 1–5 (únava / hlad / síla)</td></tr>
      <tr><td>Trend měr (cm/týden) a přepočítané BMR</td><td>Plán na příští týden + volitelná poznámka</td></tr>
    </table>

    <h2>Adherence gate: děravý log = neměníš</h2>
    <p>Pod ~70 % dní se zápisem (pod 5/7) engine cíle <strong>NEMĚNÍ</strong>. Děravý log = nedůvěryhodný odhad, a měnit cíle z něj je hádání, ne adaptace. Řekneš to klientovi v klidu: „Tenhle týden mám jen pár dní se zápisem, na spolehlivou úpravu to nestačí. Cíle nechávám a pojďme nejdřív na konzistenci."</p>

    <h2>Jak komunikovat úpravu a pochvalu</h2>
    <p><strong>Karta „Proč (faktory)" je tvůj scénář.</strong> Neříkej „appka řekla". Vezmi faktory a přelož je do lidské řeči: „Máš zalogováno jen 60 % dní a TDEE mi vychází pod BMR, takže nejdřív dotáhneme zápis, kalorie nesahám." Úprava je vždy mírná — jedna změna max ±10 % kcal/týden, a klient/ty ji potvrzuje, nic se neděje automaticky.</p>
    <p><strong>Pochvala vždy na konkrétní fakt</strong> („pod 70 kg, paráda", „tři týdny pravidelných úbytků, respekt"). Žádné prázdné „skvělá práce".</p>

    <div class="praxe"><b>V praxi (Martin):</b> Check-in ukáže pákový badge „Přidat aktivitu" a faktory: přesnost OK, ale aktivita pod stropem. Komentář klientovi: „Zápis máš poctivý, to se počítá. Tělo zatím stojí, tak než budeme sahat na jídlo, přidáme zhruba jednu silovou jednotku týdně. Kalorie neřežeme. Be Effective."</div>`,
  task: 'Připrav si „check-in scénář": vyber jeden pákový stav (např. přidat aktivitu) a napiš komentář klientovi, který (1) pochválí konkrétní fakt, (2) přeloží faktory do lidské řeči, (3) dá jeden krok — bez věty „appka řekla".',
  quiz: [
    { q: 'Jak často jede check-in a podle čeho se rozhoduje?', a: 'Každý týden, ale rozhoduje se podle 2–3týdenního trendu (okno 21 dní). Jeden špatný víkend nerozhodí.' },
    { q: 'Co je adherence gate?', a: 'Pod ~70 % dní se zápisem (5/7) engine cíle nemění. Děravý log = nedůvěryhodný odhad, měnit cíle by bylo hádání.' },
    { q: 'Jak komunikuješ úpravu klientovi?', a: 'Nikdy „appka řekla". Vezmeš faktory → přeložíš do lidské řeči → dáš jeden krok. Úprava max ±10 % kcal/týden.' },
    { q: 'Jak má vypadat pochvala?', a: 'Vždy na konkrétní fakt: „pod 70 kg, paráda", „tři týdny úbytků, respekt". Ne prázdné „skvělá práce".' },
    { q: 'Co engine vytáhne sám a co doplní klient?', a: 'Engine: trend váhy, příjem, adherence, trend měr, BMR. Klient: reálná aktivita, subjektivní škály (únava/hlad/síla), plán, poznámka.' },
  ],
},

// ── §6 ─────────────────────────────────────────────────────────────────────
{
  id: 'm20-l6',
  title: 'Časté chyby klientů a jak je řešíš',
  prevHref: '/akademie/studium/m20-l5/', prevLabel: 'Check-iny',
  nextHref: '/akademie/studium/m20-l7/', nextLabel: 'Startovací cíle & makra',
  body: `    <p class="lead">Tyhle chyby uvidíš u většiny klientů. Nejsou to selhání — jsou to předvídatelné reakce laika. Tvoje práce není kárat, ale přerámovat. Když je čekáš, zvládneš je klidně a klient u tebe zůstane.</p>

    <div class="points"><strong>Šest nejčastějších a jak na ně:</strong>
      <ul>
        <li><strong>Panika z jednoho vážení.</strong> Klient vidí ráno +1,5 kg a chce zařezat. „Koukáme na klouzavý průměr, ne na jedno číslo. Voda, glykogen a sůl hýbou váhou o 1–3 kg ze dne na den. Ten průměr je o 0,4 kg dolů — to ráno byla voda."</li>
        <li><strong>Podhodnocený log.</strong> Nejčastější „relaps". Zapíše málo, tělo stojí, chce ubrat. NEsnižuješ cíl, koučuješ přesnost (olej na pánvi, doslazené kafe, ochutnávky při vaření).</li>
        <li><strong>„Kosmeticky hezký" log.</strong> Nezapisuje pivo a olej, aby vypadal dobře. „Engine počítá z reality. Co tam nedáš, to tě připraví o správnou úpravu — škodíš jen sobě."</li>
        <li><strong>Hubnutí za každou cenu.</strong> Chce řezat víc a rychleji. Severka: udržení &gt; rychlé shození. Tempo je ohraničené na 0,5–1 %/týden záměrně.</li>
        <li><strong>Honění váhy, ignorování měr a fotek.</strong> Při recompu nebo platu váha lže. Přepni pozornost na obvody a fotky.</li>
        <li><strong>Strach z jídla / zakázané potraviny.</strong> Žádná démonizace. Flexibilní přístup, žádné „sacharidy večer tloustnou".</li>
      </ul>
    </div>

    <div class="praxe"><b>V praxi (Martin):</b> Klientka v rekompozici panikaří, že tři týdny stojí na váze. Otevřu míry: pas −0,9 cm, váha flat. „Tohle je přesně to, co chceme. Hubneš tuk a držíš sval, váha to neukáže. Deficit nepřidáváme, držíme kurz."</div>`,
  task: 'Vyber dvě chyby z výčtu, na které u klientů narazíš nejčastěji. Napiš si u každé jednu větu „přerámování" tak, jak ji řekneš naživo — klidně, bez kárání.',
  quiz: [
    { q: 'Klient vidí ráno +1,5 kg a chce zařezat. Co mu řekneš?', a: 'Hodnotíme klouzavý průměr, ne jedno číslo. Voda/glykogen/sůl hýbou váhou o 1–3 kg za den. Trend jde dolů, to ráno byla voda.' },
    { q: 'Klient málo zapisuje, tělo stojí, chce ubrat kalorie. Tvůj krok?', a: 'Nesnižuješ cíl — koučuješ přesnost zápisu. Podhodnocený log je nejčastější „relaps", ne důvod jíst míň.' },
    { q: 'Při recompu/platu klient honí jen váhu. Co uděláš?', a: 'Přepneš jeho pozornost na obvody a fotky — váha tam lže (drží sval, hubne tuk).' },
    { q: 'Jaká je severka u klienta, co chce hubnout za každou cenu?', a: 'Udržení > rychlé shození. Tempo je záměrně ohraničené na 0,5–1 %/týden.' },
    { q: 'Jak řešíš strach z „zakázaných" potravin?', a: 'Žádná démonizace. Flexibilní přístup, žádné mýty typu „sacharidy večer tloustnou".' },
  ],
},

// ── §7 ─────────────────────────────────────────────────────────────────────
{
  id: 'm20-l7',
  title: 'Startovací cíle a makra do hloubky',
  prevHref: '/akademie/studium/m20-l6/', prevLabel: 'Časté chyby klientů',
  nextHref: '/akademie/studium/m20-l8/', nextLabel: 'Měření pokroku',
  body: `    <p class="lead">Tohle je STARTOVACÍ odhad — výchozí čísla, ze kterých klient vyjede. Adaptivní úprava z reálné bilance je samostatná věc (check-iny). Tady je přesně, jak se startovní cíle počítají a v jakém pořadí se skládají makra.</p>

    <h2>Od BMR k cíli</h2>
    <div class="points">
      <ul>
        <li><strong>BMR (Mifflin-St Jeor):</strong> 10 × váha(kg) + 6,25 × výška(cm) − 5 × věk; muž <strong>+5</strong>, žena <strong>−161</strong>.</li>
        <li><strong>TDEE</strong> = BMR × násobič aktivity (1,2 / 1,375 / 1,55 / 1,725 / 1,9).</li>
        <li><strong>Kalorický cíl z tempa:</strong> cut = TDEE − (tempo_kg × 7700)/7; bulk = TDEE + (tempo_kg × 7700)/7. 1 kg ≈ 7700 kcal.</li>
        <li><strong>Tempo se ořezává tvrdě:</strong> hubnutí 0,5–1,0 %/týden, nabírání max 0,5 kg/týden — i kdyby UI poslalo víc.</li>
        <li><strong>Kalorická podlaha startu:</strong> žena 1200, muž 1500 — níž startovní cíl nikdy.</li>
      </ul>
    </div>

    <h2>Makra v pořadí priority</h2>
    <div class="steps">
      <div class="row"><div class="num"></div><div class="b"><b>Bílkoviny</b><span>Default 1,8 g/kg (rozmezí 1,6–2,2). Mají přednost, nehýbou se.</span></div></div>
      <div class="row"><div class="num"></div><div class="b"><b>Tuk</b><span>Cíl 0,8 g/kg (podlaha 0,6), ALE smí klesnout, aby se makra vešla do kcal — nikdy ne pod <strong>22 % kalorií</strong>. Warning pod 20 %.</span></div></div>
      <div class="row"><div class="num"></div><div class="b"><b>Sacharidy</b><span>Zbytek do kalorií.</span></div></div>
      <div class="row"><div class="num"></div><div class="b"><b>Vláknina</b><span>13 g / 1000 kcal, strop 60 g.</span></div></div>
    </div>
    <p><strong>Fat floor 22 % = hormony.</strong> Dlouhodobě moc nízký tuk sahá na tvorbu pohlavních hormonů a vstřebávání vitaminů rozpustných v tuku. Proto je to v kódu, ne na klientovi.</p>
    <p><strong>Precizní režim</strong> přidává tvrdé cíle na sacharidy a tuky. Většině klientů ho NEZAPÍNEJ — jen je stresuje a tempo stejně diktují kalorie. Nech ho pro soutěžní přípravu nebo lidi, co fakt chtějí ladit.</p>

    <div class="praxe"><b>V praxi (Martin):</b> Muž 82 kg, 178 cm, 30 let, střední aktivita, hubnutí svižně (1 %). BMR = 1787,5, TDEE ≈ 2771 kcal, deficit ≈ 900 kcal/den → cíl ≈ 1869 kcal, bílkoviny ≈ 148 g, vláknina ≈ 24 g. Appka to spočítá za vteřinu — ty to klientovi jen vysvětlíš.</div>`,
  task: 'Spočítej startovní cíle pro modelového klienta (vyber váhu, výšku, věk, aktivitu, tempo): BMR → TDEE → kalorický cíl → bílkoviny (1,8 g/kg) → vláknina. Ověř, že tuk nepadl pod 22 % kalorií.',
  quiz: [
    { q: 'Jak spočítáš BMR podle Mifflin-St Jeor?', a: '10 × váha(kg) + 6,25 × výška(cm) − 5 × věk; muž +5, žena −161. Pak TDEE = BMR × násobič aktivity.' },
    { q: 'Jaká je default a rozmezí bílkovin?', a: 'Default 1,8 g/kg, rozmezí 1,6–2,2 g/kg. Mají přednost a nehýbou se.' },
    { q: 'Proč nesmí tuk klesnout pod 22 % kalorií?', a: 'Hormony — dlouhodobě moc nízký tuk sahá na tvorbu pohlavních hormonů a vstřebávání vitaminů rozpustných v tuku. Proto je to v kódu.' },
    { q: 'Komu (NE)zapínat Precizní režim?', a: 'Většině NE — jen stresuje a tempo stejně diktují kalorie. Jen soutěžní příprava nebo lidi, co fakt chtějí ladit.' },
    { q: 'Kolik je kalorická podlaha startu?', a: 'Žena 1200, muž 1500 kcal — níž startovní cíl nikdy nejde.' },
  ],
},

// ── §8 ─────────────────────────────────────────────────────────────────────
{
  id: 'm20-l8',
  title: 'Měření pokroku: čtyři okna, čtyři rychlosti',
  prevHref: '/akademie/studium/m20-l7/', prevLabel: 'Startovací cíle & makra',
  nextHref: '/akademie/studium/#m20', nextLabel: 'Zpět na Modul 20',
  body: `    <p class="lead">Jedna věta na všechno: <strong>hodnotíme trend, ne jedno číslo.</strong> Klientova práce je logovat hustě a poctivě, tvoje práce je číst směr. Každá metrika má svoje okno a svoji rychlost.</p>

    <table>
      <tr><th>Metrika</th><th>Okno trendu</th><th>Proč ne jedno číslo</th></tr>
      <tr><td>Váha</td><td>klouzavý průměr 7 dní</td><td>voda/glykogen/sůl ±1–3 kg/den</td></tr>
      <tr><td>Tělesné míry</td><td>~21 dní (3 týdny)</td><td>pomalá změna + nepřesnost metru</td></tr>
      <tr><td>Síla (1RM)</td><td>trend z ≥ 2 tréninků na cvik</td><td>jeden špatný den ≠ ztráta síly</td></tr>
      <tr><td>Fotky</td><td>1× za 2–4 týdny</td><td>vizuální změna je pozvolná</td></tr>
    </table>

    <h2>Váha: čteš čáru, ne ranní číslo</h2>
    <p>Velké číslo na obrazovce NENÍ dnešní vážení — je to klouzavý průměr za 7 dní. Nauč klienta vážit se ráno, po záchodě, nalačno, vždy stejně, ideálně denně (min. 3–4×/týden — průměr je tak silný, jak hustý je log).</p>

    <h2>Míry: když váha lže</h2>
    <p>Obvody (hrudník, pas, boky, zadek, stehno) se mění pomaleji, okno 3 týdny. Na míry spoléháš, když <strong>váha lže</strong> — rekompozice (pas dolů, zadek/stehno nahoru), začátečnice v objemu, plató. Čtení podle pohlaví: muž primárně váha + pas, u ženy je pokles prsou/obvodů validní signál tuku. Kdo nechce na váhu vůbec, může jet čistě na obvodech.</p>

    <h2>Fotky: pomalé, ale nejvíc vidět</h2>
    <p>1× za 2–4 týdny, stejné světlo a póza (zepředu / z boku / zezadu). Soukromé úložiště, podepsané URL na 1 hodinu — vidí je jen klient a ty. Řekni to klientovi nahlas, buduje to důvěru.</p>

    <div class="praxe"><b>V praxi (Martin):</b> Klient přijde vyděšený, že za noc nabral 2 kg. Otevřu graf klouzavého průměru: „Vidíš tu přímku? Ta jde dolů. To, co tě vyděsilo ráno, je sůl z včerejší pizzy a voda. Hodnotíme tuhle čáru, ne ranní číslo."</div>`,
  task: 'U jednoho klienta urči, která metrika je pro něj teď hlavní (váha vs. míry vs. fotky) a proč. Pokud je v recompu nebo platu, naplánuj, jak přesměruješ jeho pozornost z váhy na obvody.',
  quiz: [
    { q: 'Jaké je okno trendu pro váhu a proč?', a: 'Klouzavý průměr 7 dní — voda, glykogen a sůl hýbou váhou o 1–3 kg ze dne na den, jedno vážení nic neřekne.' },
    { q: 'Kdy se spoléháš na míry místo váhy?', a: 'Když váha lže — rekompozice, začátečnice v objemu, plató. Obvody ukážou změnu, kterou váha schová.' },
    { q: 'Jak často a jak se dělají fotky pokroku?', a: '1× za 2–4 týdny, stejné světlo a póza (zepředu/z boku/zezadu). Soukromé, podepsané URL — vidí je jen klient a ty.' },
    { q: 'Jak silný je klouzavý průměr váhy?', a: 'Tak silný, jak hustý je log. Proto klient váží ráno, nalačno, stejně, ideálně denně (min. 3–4×/týden).' },
    { q: 'Jaké je čtení měr podle pohlaví?', a: 'Muž primárně váha + pas. U ženy je pokles prsou a obvodů validní signál úbytku tuku.' },
  ],
},

];
