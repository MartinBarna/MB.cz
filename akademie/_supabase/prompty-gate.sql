-- ============================================================
-- Barna Academy - PROMPT KNIHOVNA za RLS (2026-07-16)
-- !!! NESPOUSTET AUTOMATICKY - rucni krok (service-role / SQL editor) !!!
--
-- Plne zneni promptu se presouva z /akademie/nastroje/prompty/index.html
-- do DB: radek 'tool-prompty' v public.lesson_content (product 'academy').
-- Cte se pres RLS policy lesson_content_member_read
-- (for select to authenticated using has_entitlement(product)),
-- tj. plny obsah dostane jen prihlaseny clen s aktivnim pristupem
-- 'academy'. Nezalogovany curl/scraper dostane 0 radku.
--
-- Ve statickem HTML zustava jako ochutnavka jen sekce #byznys
-- (3 prompty) + zkracene teasery ostatnich 8 sekci. Stranka po
-- overeni clenstvi fetchne tento radek pres
-- BA.getLessonHtml('tool-prompty') a nahradi obsah #sections.
--
-- lesson_id 'tool-prompty' nekoliduje s konvencemi:
--   - lekce Academy maji tvar 'm<modul>-l<lekce>' (admin-api pocita
--     lekce pres LIKE 'm%', tenhle radek se do poctu nezapocita),
--   - videokurz ma 'vk-*', zaverecny test 'zaverecny-test'.
-- ============================================================

insert into public.lesson_content (lesson_id, product, html)
values ('tool-prompty', 'academy', $html$
    <section id="byznys">
      <h2>💼 Byznys, pozicování, nabídka</h2>
      <p class="sub">Vybrousi to, na co při klientech nezbývá čas.</p>
      <div class="p"><div class="h"><span class="t">Vybroušení pozicování</span><button class="copy">Kopírovat</button></div><div class="txt">Jsem trenér a moje pozicovací věta zní: „<span class="ph">[tvoje věta]</span>". Polož mi 5 otázek, které mi ji pomůžou zúžit a zkonkrétnit. Pak navrhni 3 varianty a u každé řekni, koho přitáhne a koho odradí.</div></div>
      <div class="p"><div class="h"><span class="t">Struktura balíčků</span><button class="copy">Kopírovat</button></div><div class="txt">Navrhni mi 3 úrovně mé služby (basic, standard, premium) tak, aby se lišily servisem, ne kvalitou výsledku. Tady je, co dělám: <span class="ph">[popis služby]</span>. U každé úrovně uveď, pro koho je a co obsahuje.</div></div>
      <div class="p"><div class="h"><span class="t">Argument hodnoty (na námitku ceny)</span><button class="copy">Kopírovat</button></div><div class="txt">Klient říká, že <span class="ph">[cena]</span> měsíčně je moc. Napiš mi 3 způsoby, jak ukázat hodnotu bez slevy: srovnání s náklady, rozpad na den, a co všechno dostává. Můj hlas: přátelský, na rovinu, tykám.</div></div>
    </section>

    <section id="onboarding">
      <h2>📋 Onboarding nového klienta</h2>
      <p class="sub">Z dotazníku profil, plán a uvítací zprávu.</p>
      <div class="p"><div class="h"><span class="t">Profil z dotazníku</span><button class="copy">Kopírovat</button></div><div class="txt">Jsi zkušený výživový kouč. Tady jsou odpovědi nového klienta ze vstupního dotazníku (anonymní): <span class="ph">[odpovědi]</span>. Udělej strukturovaný profil: 1) základní data a cíl, 2) historie diet a co nefungovalo, 3) režim dne a omezení, 4) rizikové body pro udržitelnost (co ho nejspíš zlomí), 5) silné stránky, na kterých stavět.</div></div>
      <div class="p"><div class="h"><span class="t">Plán prvního měsíce</span><button class="copy">Kopírovat</button></div><div class="txt">Na základě tohoto profilu navrhni plán prvního měsíce: co řešit v týdnu 1 (jedna hlavní změna), co přidat v týdnech 2 až 4, a čeho se vyvarovat, aby klient nevyhořel. Ber v úvahu jeho historii diet. (Makra nepočítej, ta dodám sám.)</div></div>
      <div class="p"><div class="h"><span class="t">Uvítací zpráva</span><button class="copy">Kopírovat</button></div><div class="txt">Napiš uvítací zprávu novému klientovi. Kontext: cíl <span class="ph">[cíl]</span>, hlavní obava <span class="ph">[obava]</span>. Struktura: přivítání, co se bude dít první týden (konkrétně), co od něj potřebuji do pátku, jedna věta na jeho obavu. Můj hlas: přátelský, tykám, bez patosu. Max 8 vět.</div></div>
    </section>

    <section id="checkin">
      <h2>✅ Check-iny</h2>
      <p class="sub">Vyhodnocení, vzorce a zpětná vazba.</p>
      <div class="p"><div class="h"><span class="t">Vyhodnocení týdne</span><button class="copy">Kopírovat</button></div><div class="txt">Profil klientky (anonymní): <span class="ph">[profil]</span>. Její check-in za tento týden (váha, míry, kroky, spánek, dodržení plánu, poznámky): <span class="ph">[data]</span>. Vyhodnoť: 1) co jde dobře, 2) co skřípe a PROČ (hledej příčinu, ne symptom), 3) jaký JEDEN krok navrhnout na příští týden.</div></div>
      <div class="p"><div class="h"><span class="t">Vzorce přes týdny</span><button class="copy">Kopírovat</button></div><div class="txt">Tady jsou check-iny za posledních 5 týdnů: <span class="ph">[data]</span>. Najdi vzorce: kdy se daří a co tomu předchází, kdy se nedaří a co předchází, je vývoj váhy v souladu s deficitem? Čeho bych si měl všimnout, co mi mohlo uniknout?</div></div>
      <div class="p"><div class="h"><span class="t">Zpětná vazba klientovi</span><button class="copy">Kopírovat</button></div><div class="txt">Z tohoto vyhodnocení napiš zprávu klientce. Struktura: konkrétní pochvala (ne obecné „dobrá práce"), jedna věc k řešení s vysvětlením proč, jeden krok na příští týden. Max 8 vět, tykám, povzbudivě ale na rovinu.</div></div>
    </section>

    <section id="strava">
      <h2>🥗 Jídelníčky a makra</h2>
      <p class="sub">AI dělá strukturu a variace. Čísla dodáš a zkontroluješ ty.</p>
      <div class="p"><div class="h"><span class="t">Struktura dne (čísla dodáš ty)</span><button class="copy">Kopírovat</button></div><div class="txt">Sestav strukturu jídelníčku na den: cíl <span class="ph">[kcal]</span> kcal, <span class="ph">[g]</span> g bílkovin, 3 jídla + 1 svačina. Klientka: <span class="ph">[co nejí, kolik času vaří, kde obědvá, kdy má hlad]</span>. U každého jídla uveď suroviny s gramáží jako NÁVRH k ověření, ne jako fakt. Česká kuchyně, běžné suroviny.</div></div>
      <div class="p"><div class="h"><span class="t">Nápady na jídla s mantinely</span><button class="copy">Kopírovat</button></div><div class="txt">Navrhni 10 <span class="ph">[večeří / snídaní]</span> do 20 minut, každá aspoň <span class="ph">[g]</span> g bílkovin, do <span class="ph">[kcal]</span> kcal, bez <span class="ph">[co klient nejí]</span>. Jen běžné české suroviny.</div></div>
      <div class="p"><div class="h"><span class="t">Výměna potraviny (výsledek ověř!)</span><button class="copy">Kopírovat</button></div><div class="txt">V jídelníčku je <span class="ph">[potravina + gramáž]</span>. Klient chce nahradit <span class="ph">[náhrada]</span>. Kolik gramů, aby seděly bílkoviny, a jak se změní kalorie? Co upravit ve zbytku dne, aby celek zůstal v cíli? (Čísla si ověřím v tabulkách.)</div></div>
    </section>

    <section id="trenink">
      <h2>🏋️ Tréninkové plány</h2>
      <p class="sub">Strukturu a variace ano, techniku a bezpečnost hlídáš ty.</p>
      <div class="p"><div class="h"><span class="t">Sestavení plánu</span><button class="copy">Kopírovat</button></div><div class="txt">Jsi zkušený silový trenér. Postav <span class="ph">[počet]</span>denní plán pro klienta: <span class="ph">[věk, úroveň, historie, omezení/bolesti]</span>. Vybavení: <span class="ph">[co má]</span>. Cíl: <span class="ph">[cíl]</span>. <span class="ph">[minuty]</span> min na trénink vč. rozcvičení. U každého cviku série, opakování a RIR.</div></div>
      <div class="p"><div class="h"><span class="t">Přestavba (dovolená, jiné vybavení)</span><button class="copy">Kopírovat</button></div><div class="txt">Klient jede tenhle plán: <span class="ph">[plán]</span>, ale <span class="ph">[důvod: bude na služebce / má jen…]</span>. K dispozici: <span class="ph">[vybavení]</span>. Přestav plán se zachováním svalových skupin a přibližného objemu.</div></div>
      <div class="p"><div class="h"><span class="t">Progrese na 8 týdnů</span><button class="copy">Kopírovat</button></div><div class="txt">Naplánuj progresi tohoto plánu na 8 týdnů: jak zvedat zátěž a opakování (double progression), kdy zařadit deload a jak poznám, že je čas. Klient je <span class="ph">[úroveň]</span>, priorita <span class="ph">[technika / síla]</span>.</div></div>
    </section>

    <section id="materialy">
      <h2>📄 Materiály pro klienty</h2>
      <p class="sub">Fakta z tebe, formu učeše AI.</p>
      <div class="p"><div class="h"><span class="t">Přizpůsobení materiálu</span><button class="copy">Kopírovat</button></div><div class="txt">Tady je odborný podklad: <span class="ph">[text]</span>. Přepiš ho pro moji klientelu: <span class="ph">[komu, jaká specifika]</span>. Zachovej všechna fakta a čísla přesně. Změň oslovení, příklady ze života a tón. Můj hlas: <span class="ph">[ukázka]</span>.</div></div>
      <div class="p"><div class="h"><span class="t">Nový tahák (osnova)</span><button class="copy">Kopírovat</button></div><div class="txt">Chci pro klienty jednostránkový tahák na téma <span class="ph">[téma]</span>. Navrhni osnovu: co tam nesmí chybět, co vynechat, aby to byla jedna strana. Pak počkej, doplním k bodům svoje know-how.</div></div>
    </section>

    <section id="obsah">
      <h2>📱 Obsah na sociální sítě</h2>
      <p class="sub">Nápady a formu ano, zkušenost je z tebe.</p>
      <div class="p"><div class="h"><span class="t">Nápady pro tvou niku</span><button class="copy">Kopírovat</button></div><div class="txt">Jsem trenér pro <span class="ph">[nika]</span>. Vygeneruj 20 nápadů na obsah, které řeší reálné bolesti a otázky téhle skupiny. Ke každému formát (příspěvek/reels/stories) a jednou větou úhel. Žádné obecné výživové fráze, chci konkrétní situace.</div></div>
      <div class="p"><div class="h"><span class="t">Z myšlenky příspěvek + reels</span><button class="copy">Kopírovat</button></div><div class="txt">Moje zkušenost: <span class="ph">[reálná situace/postřeh]</span>. Udělej z toho příspěvek na Instagram (silný hook, můj příběh, praktický závěr) a scénář na 30s reels (první 3 vteřiny hook, 3 body, výzva k akci). Můj hlas: <span class="ph">[ukázka]</span>. Bez frází a bez „Věděli jste, že".</div></div>
      <div class="p"><div class="h"><span class="t">Obsahový plán na měsíc</span><button class="copy">Kopírovat</button></div><div class="txt">Sestav mi obsahový plán na měsíc: 3 příspěvky týdně, střídej vzdělávací, osobní a prodejní, k tématům z mé niky <span class="ph">[nika]</span>.</div></div>
    </section>

    <section id="reklamy">
      <h2>📣 Reklamy</h2>
      <p class="sub">Copywriter a analytik. Rozhoduješ a platíš ty.</p>
      <div class="p"><div class="h"><span class="t">5 verzí reklamního textu</span><button class="copy">Kopírovat</button></div><div class="txt">Jsem trenér pro <span class="ph">[nika]</span>. Napiš 5 verzí reklamního textu na Facebook na moji službu <span class="ph">[co nabízíš]</span>. Každá jiný úhel: bolest, výsledek, příběh, konkrétní číslo, otázka. Ke každé krátký nadpis a návrh obrázku. Můj hlas: <span class="ph">[ukázka]</span>. Bez přehnaných a garantovaných slibů.</div></div>
      <div class="p"><div class="h"><span class="t">Metriky lidsky</span><button class="copy">Kopírovat</button></div><div class="txt">Mám reklamu: utraceno <span class="ph">[Kč]</span>, <span class="ph">[X]</span> zobrazení, <span class="ph">[X]</span> kliků, <span class="ph">[X]</span> vyplněných formulářů. Vysvětli lidsky, jestli je to dobré, špatné, a co zlepšit jako první.</div></div>
    </section>

    <section id="veda">
      <h2>🔬 Věda a studie</h2>
      <p class="sub">Souhrny a překlad ano. Existenci studie vždy ověř u zdroje.</p>
      <div class="p"><div class="h"><span class="t">Souhrn studie</span><button class="copy">Kopírovat</button></div><div class="txt">Tady je abstrakt studie: <span class="ph">[abstrakt]</span>. Shrň lidsky: co zkoumali, na kom, co zjistili a jak silný je ten důkaz. Pak řekni, jaké má studie slabiny.</div></div>
      <div class="p"><div class="h"><span class="t">Překlad statistiky</span><button class="copy">Kopírovat</button></div><div class="txt">Co v praxi znamená, že efekt byl <span class="ph">[hodnota, např. d = 0,3, p = 0,04]</span>? Vysvětli tak, abych to uměl říct klientovi.</div></div>
      <div class="p"><div class="h"><span class="t">Hledání důkazů (a pak OVĚŘ v PubMed!)</span><button class="copy">Kopírovat</button></div><div class="txt">Co říká výzkum o <span class="ph">[téma]</span>? Jmenuj konkrétní studie (autor, rok, časopis). A rovnou dodej i studie, které dané tvrzení zpochybňují. <span style="color:var(--muted)">(Každou studii pak najdi v PubMed. Co nenajdeš, neexistuje.)</span></div></div>
    </section>
$html$)
on conflict (lesson_id) do update
  set html = excluded.html,
      product = excluded.product,
      updated_at = now();
