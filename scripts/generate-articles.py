#!/usr/bin/env python3
"""Vygeneruje nové blogové články ze sdílené šablony (styl webu).
Spuštění:  python3 scripts/generate-articles.py
Vytvoří soubory v clanky/ podle seznamu ARTICLES.
"""
import json, os

SITE = "https://web.martinbarna.cz"
OG = f"{SITE}/assets/og-default.jpg"
WA_SVG = ('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" '
          'fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 '
          '5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 '
          '11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 '
          '5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 '
          '4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.748-.747zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 '
          '1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 '
          '0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 '
          '4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 '
          '2.006-1.413.248-.694.248-1.289.173-1.413z"/></svg>')

STYLE = """    <style>
        .skip-link{position:absolute;left:-999px;top:0;background:#ff7a00;color:#161616;font-weight:700;padding:10px 18px;border-radius:0 0 10px 0;z-index:2000;text-decoration:none}
        .skip-link:focus{left:0}

        :root { --green:#ff7a00; --green-dark:#161616; --green-light:#fff4e8; --gold:#ff7a00; --ink:#161616; }
        * { box-sizing:border-box; scroll-behavior:smooth; }
        a:focus-visible, button:focus-visible { outline:3px solid #ff7a00; outline-offset:2px; border-radius:4px; }
        body { font-family:'Poppins',Arial,sans-serif; color:var(--ink); margin:0; line-height:1.75; }
        a { color:var(--green-dark); }
        .nav { background:#fff; box-shadow:0 2px 14px rgba(0,0,0,.06); position:sticky; top:0; z-index:10; }
        .nav .wrap { max-width:880px; margin:0 auto; padding:14px 20px; display:flex; justify-content:space-between; align-items:center; }
        .brand { font-weight:800; color:var(--green-dark); text-decoration:none; font-size:1.25rem; }
        .nav a.back { text-decoration:none; font-weight:600; color:var(--ink); }
        .hero { background:linear-gradient(135deg,var(--green) 0%,var(--green-dark) 100%); color:#fff; padding:80px 20px 64px; text-align:center; }
        .hero .tag { background:rgba(255,255,255,.2); padding:5px 14px; border-radius:50px; font-size:.8rem; font-weight:600; }
        .hero h1 { max-width:780px; margin:1rem auto 0; font-size:2.5rem; font-weight:800; line-height:1.2; }
        .wrapc { max-width:760px; margin:0 auto; padding:0 20px; }
        article { padding:60px 0; font-size:1.08rem; }
        article h2 { color:var(--green-dark); font-weight:800; margin-top:2.4rem; }
        article ul { padding-left:1.2rem; }
        article li { margin:.4rem 0; }
        .lead { font-size:1.2rem; color:#3a463f; }
        .cta-box { background:var(--green-light); border-radius:20px; padding:2.2rem; margin:3rem 0 0; text-align:center; }
        .cta-box h3 { color:var(--green-dark); font-weight:800; margin-top:0; }
        .btn { display:inline-block; background:var(--green); color:#fff; font-weight:700; padding:13px 32px; border-radius:50px; text-decoration:none; transition:.2s; margin:6px; }
        .btn:hover { background:var(--green-dark); color:#fff; }
        .btn.gold { background:var(--gold); } .btn.gold:hover { background:#e0941a; }
        .disclaimer { font-size:.9rem; color:#7a857d; border-top:1px solid #e6ece6; margin-top:2.5rem; padding-top:1.2rem; }
        footer { background:var(--ink); color:#cfd8d2; text-align:center; padding:26px 20px; }
        footer a { color:#ffb066; text-decoration:none; }
        .fab-wa { position:fixed; right:20px; bottom:20px; width:58px; height:58px; border-radius:50%; background:#25D366; display:flex; align-items:center; justify-content:center; box-shadow:0 6px 20px rgba(0,0,0,.25); color:#fff; text-decoration:none; }
    </style>"""

LEAD_BOX = """            <div class="cta-box" style="background:#161616;color:#fff;">
                <h3 style="color:#fff;">🎁 7denní plán na míru — zdarma</h3>
                <p style="color:#e8e8e8;">Pošlu ti na e-mail hotový 7denní plán s makry a tipy na jídla. Vyber si svou verzi:</p>
                <a class="btn gold" href="/forma-zpet/">Pro muže 35+</a>
                <a class="btn" href="/makro-plan/" style="background:#fff;color:#161616;">Pro ženy 30+</a>
            </div>"""

END_CTA = """            <div class="cta-box">
                <h3>Nechce se ti řešit všechno sám?</h3>
                <p>V koučinku ti nastavím jídlo, trénink i návyky na míru — a hlavně u toho nezůstaneš sám. Ozvi se na nezávaznou konzultaci zdarma.</p>
                <a class="btn" href="../index.html#kontakt">Konzultace zdarma</a>
                <a class="btn gold" href="../index.html#balicky">Koučink na míru</a>
            </div>"""


def render(a):
    canonical = f"{SITE}/clanky/{a['slug']}"
    blogposting = {
        "@context": "https://schema.org", "@type": "BlogPosting",
        "headline": a["title"], "description": a["desc"], "image": OG,
        "datePublished": a["date"], "dateModified": "2026-06-21",
        "author": {"@type": "Person", "name": "Martin Barna", "url": SITE + "/"},
        "publisher": {"@type": "Person", "name": "Martin Barna", "url": SITE + "/"},
        "mainEntityOfPage": {"@type": "WebPage", "@id": canonical},
        "articleSection": a["section"], "inLanguage": "cs-CZ",
    }
    crumbs = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Domů", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": "Blog", "item": SITE + "/clanky/"},
            {"@type": "ListItem", "position": 3, "name": a["title"], "item": canonical},
        ]}
    related = "\n".join(
        f'                <li><a href="{u}">{t}</a></li>' for u, t in a["related"])
    favicon = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>"
               "<rect width='100' height='100' rx='22' fill='%23161616'/>"
               "<text x='50' y='70' font-size='54' font-family='Arial' font-weight='bold' "
               "fill='%23ff7a00' text-anchor='middle'>MB</text></svg>")
    font = ("https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800"
            "&display=swap")
    return f"""<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{a['title']} — Martin Barna</title>
    <meta name="description" content="{a['desc']}">
    <meta name="theme-color" content="#ff7a00">
    <link rel="canonical" href="{canonical}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="{canonical}">
    <meta property="og:title" content="{a['title']}">
    <meta property="og:description" content="{a['ogdesc']}">
    <meta property="og:image" content="{OG}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Martin Barna — online výživa a fitness koučink">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="{OG}">
    <link rel="icon" href="data:image/svg+xml,{favicon}">
    <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
    <link rel="manifest" href="/site.webmanifest">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="{font}" rel="stylesheet" media="print" onload="this.media='all'">
    <noscript><link href="{font}" rel="stylesheet"></noscript>
{STYLE}
    <script type="application/ld+json">
{json.dumps(blogposting, ensure_ascii=False, indent=2)}
    </script>
    <script type="application/ld+json">
{json.dumps(crumbs, ensure_ascii=False, indent=2)}
    </script>
</head>
<body>
    <a class="skip-link" href="#obsah">Přeskočit na obsah</a>
    <div class="nav"><div class="wrap"><a class="brand" href="../index.html">Martin Barna</a><a class="back" href="index.html">← Zpět na blog</a></div></div>

    <header class="hero" id="obsah">
        <span class="tag">{a['tag']}</span>
        <h1>{a['title']}</h1>
    </header>

    <div class="wrapc">
        <article>
            <p class="lead">{a['lead']}</p>

{LEAD_BOX}

{a['body']}

            <p>{a['closing']}</p>

{END_CTA}

            <h2>Mohlo by tě zajímat</h2>
            <ul>
{related}
            </ul>

            <p class="disclaimer">Článek má informativní charakter a není lékařským doporučením. Při zdravotních potížích se poraď s lékařem.</p>
        </article>
    </div>

    <footer>
        <p>&copy; 2026 Martin Barna — Online výživa a fitness · <a href="../index.html">Hlavní web</a></p>
    </footer>
    <a class="fab-wa" href="https://wa.me/420603229831" target="_blank" rel="noopener" aria-label="WhatsApp">
        {WA_SVG}
    </a>
</body>
</html>
"""


ARTICLES = [
{
 "slug":"jojo-efekt.html","tag":"VÝŽIVA","section":"Výživa","date":"2026-06-21",
 "title":"Jojo efekt: proč se váha vrací a jak ho porazit",
 "desc":"Proč se po dietě váha vrací a jak jíst tak, aby výsledky vydržely. Bez extrémů a hladovění — prakticky od kouče Martina Barny.",
 "ogdesc":"Proč se po dietě váha vrací a jak tomu jednou provždy zabránit.",
 "lead":"Zhubl jsi, oslavil — a za pár měsíců jsou kila zpátky, někdy i s úroky. Tomu se říká jojo efekt a věř, že v tom nejsi sám. Dobrá zpráva: není to o tvojí slabé vůli, ale o špatně nastaveném procesu. A ten se dá změnit.",
 "closing":"Hubnutí není sprint na měsíc, ale změna, se kterou se dá normálně žít. Když to nastavíš s rozumem, jojo efekt nemá kudy zaútočit.",
 "body":"""            <h2>Proč jojo efekt vůbec vzniká</h2>
            <p>Většina jojo příběhů má stejný scénář: tvrdá dieta, rychlý úbytek, návrat ke starým návykům — a kila zpátky. Za vším stojí pár věcí najednou: <strong>příliš velký deficit</strong>, <strong>ztráta svalů</strong> a dieta, která má jasný „konec", místo aby měnila návyky natrvalo.</p>

            <h2>Ztráta svalů = pomalejší metabolismus</h2>
            <p>Když hubneš agresivně a bez bílkovin a silového tréninku, tělo nebere jen tuk, ale i sval. A sval je přitom tkáň, která ti pálí energii i v klidu. Méně svalu = nižší denní výdej = o to snadněji se tuk vrátí, jakmile se vrátíš k normálnímu jídlu.</p>

            <h2>Hlava a návyky rozhodují</h2>
            <p>„Měsíc budu držet dietu a pak zase normálně." Tady je ten háček — co je to „normálně"? Pokud se vrátíš přesně k tomu, co tě k nadváze přivedlo, výsledek bude stejný. Dieta s datem konce nefunguje. Funguje postupná změna návyků, kterou zvládneš dělat i za rok.</p>

            <h2>Jak hubnout, aby to vydrželo</h2>
            <ul>
                <li><strong>Mírný deficit</strong> (15–20 % pod výdejem), ne hladovka.</li>
                <li><strong>Dost bílkovin</strong> (1,6–2 g na kilo) — chrání svaly i sytost.</li>
                <li><strong>Silový trénink</strong> — dává tělu důvod sval si nechat.</li>
                <li><strong>Postupné změny</strong> místo revoluce přes noc.</li>
                <li><strong>Sleduj trend</strong> za týdny, ne výkyvy na váze ze dne na den.</li>
            </ul>

            <h2>Po dietě: nejdůležitější a nejvíc opomíjená část</h2>
            <p>Když dohubneš, nevracej se k jídlu skokem. Postupně přidej kalorie zpět na <strong>udržovací příjem</strong> a chvíli si na téhle hladině pobuď. Naučíš tělo i hlavu žít s váhou, kterou jsi vydřel — a přesně to dělá ten rozdíl mezi „zase zpátky" a „drží to".</p>""",
 "related":[("kaloricky-deficit.html","Kalorický deficit v kostce"),
            ("bilkoviny.html","Bílkoviny: kolik jich jíst a proč"),
            ("flexibilni-stravovani.html","Flexibilní stravování")],
},
{
 "slug":"cheat-day.html","tag":"VÝŽIVA","section":"Výživa","date":"2026-06-21",
 "title":"Cheat day, nebo cheat meal? Jak na volnost bez sabotáže",
 "desc":"Ničí cheat day tvoje hubnutí? Jak si dopřát oblíbená jídla chytře, aniž bys smazal celý týden snažení. Prakticky od kouče Martina Barny.",
 "ogdesc":"Jak si dát volnost v jídle, aniž bys smazal celý týden snažení.",
 "lead":"Po týdnu poctivého snažení přijde víkend a s ním otázka: dát si volno? Cheat day zní jako zasloužená odměna — jenže umí smazat celý týden v deficitu. Pojďme si říct, jak na volnost tak, aby ti pomáhala, ne škodila.",
 "closing":"Volnost v jídle není hřích. Když ji umíš zařadit s rozumem, vydržíš u zdravého jídelníčku roky — a nebudeš mít pocit, že si pořád něco zakazuješ.",
 "body":"""            <h2>Kde je s cheat day problém</h2>
            <p>Počítejme: celý týden držíš deficit 500 kcal denně, to je 3 500 kcal „k dobru". Pak přijde cheat day, kdy je snadné sníst i 2 000–3 000 kcal nad rámec. A je to — týden snažení v háji během jednoho odpoledne. Jeden den dokáže vymazat pět dní práce.</p>

            <h2>Cheat meal vs. cheat day</h2>
            <p>V tom je celý rozdíl. <strong>Cheat meal</strong> je jedno uvolněné jídlo — pizza, dezert, cokoliv máš rád. <strong>Cheat day</strong> je celý den bez brzd. Jedno jídlo navíc deficit nerozbije, klidně se vejde do týdne. Celý den ano. Když už, vsaď na jedno jídlo, ne na celodenní maraton.</p>

            <h2>Nejlepší cheat je žádný cheat</h2>
            <p>Zní to divně, ale platí: když si oblíbená jídla zařadíš <strong>průběžně</strong> do běžného jídelníčku, žádné „podvádění" vlastně nepotřebuješ. Tomu se říká flexibilní stravování a je to nejudržitelnější způsob, jak jíst chutně a přitom mít výsledky.</p>

            <h2>Jak si dopřát chytře</h2>
            <ul>
                <li><strong>Plánuj dopředu</strong> — vědomá volnost chutná líp než výčitky.</li>
                <li><strong>Jedno jídlo, ne celý den.</strong></li>
                <li><strong>Hned další jídlo se vrať</strong> k normálu — žádné „už je stejně po všem".</li>
                <li><strong>Nehladověj „na splátku"</strong> celý den předem, skončí to přejedením.</li>
                <li><strong>Nedělej z toho vinu.</strong> Jedno jídlo z tebe neudělá zpátky toho, kým jsi byl.</li>
            </ul>""",
 "related":[("flexibilni-stravovani.html","Flexibilní stravování"),
            ("kaloricky-deficit.html","Kalorický deficit v kostce"),
            ("spanek-a-hubnuti.html","Spánek a hubnutí")],
},
{
 "slug":"pitny-rezim.html","tag":"ZDRAVÍ","section":"Zdraví","date":"2026-06-21",
 "title":"Pitný režim a hubnutí: kolik pít a proč na tom záleží",
 "desc":"Kolik vody pít při hubnutí, jak pití ovlivňuje hlad a výkon a proč tekuté kalorie škodí. Praktický průvodce od kouče Martina Barny.",
 "ogdesc":"Kolik pít při hubnutí a proč na pitném režimu záleží víc, než čekáš.",
 "lead":"O vodě se moc nemluví, a přitom je to jeden z nejjednodušších tahů, jak si hubnutí usnadnit. Nemusíš do sebe lít litry navíc — stačí pár věcí dělat správně a hodně si tím pomůžeš.",
 "closing":"Pitný režim sám o sobě nikoho nezhubne. Ale dělá celý proces výrazně snazší — a jednodušší návyk s takovým efektem těžko najdeš.",
 "body":"""            <h2>Proč na vodě záleží</h2>
            <p>Voda je v každém procesu v těle — od trávení po výkon ve fitku. Při nedostatku přichází únava, slabší soustředění a horší trénink. A pozor na jeden trik mozku: <strong>žízeň si často pleteme s hladem</strong>. Než sáhneš po svačině, dej si sklenici vody a chvíli počkej.</p>

            <h2>Kolik vlastně pít</h2>
            <p>Hrubé vodítko je <strong>30–35 ml na kilogram váhy</strong> denně — u 80 kg člověka tedy zhruba 2,5–3 litry. Víc, když sportuješ nebo je horko. Nejjednodušší kontrola? <strong>Barva moči</strong>: světle žlutá je v pořádku, tmavá znamená „přidej".</p>

            <h2>Tekuté kalorie: tichý zabiják deficitu</h2>
            <p>Tady se hubnutí láme nejčastěji. Slazené nápoje, džusy, slazená káva a alkohol dokážou nasypat stovky kalorií, které tě <strong>vůbec nezasytí</strong>. Sklenice limonády a malého piva k tomu — a máš snědený celý dnešní deficit, aniž bys cokoliv „snědl".</p>

            <h2>Pomáhá voda opravdu hubnout?</h2>
            <p>Zázrak nečekej, ale pomáhá nepřímo a spolehlivě: sklenice před jídlem zvýší sytost a snadno sníš o něco méně. A když slazené nápoje nahradíš vodou, ušetříš kalorie, aniž bys cokoliv obětoval na talíři.</p>

            <h2>Praktické tipy</h2>
            <ul>
                <li><strong>Lahev na očích</strong> — co vidíš, to piješ.</li>
                <li><strong>Sklenice vody před každým jídlem.</strong></li>
                <li><strong>Slazené nápoje vyměň za vodu</strong> nebo neslazený čaj.</li>
                <li><strong>Hlídej kávu a alkohol</strong> — i ty mají do pitného režimu co mluvit.</li>
            </ul>""",
 "related":[("kaloricky-deficit.html","Kalorický deficit v kostce"),
            ("vlaknina.html","Vláknina: zdraví v každém soustu"),
            ("spanek-a-hubnuti.html","Spánek a hubnutí")],
},
]

os.makedirs("clanky", exist_ok=True)
for a in ARTICLES:
    path = os.path.join("clanky", a["slug"])
    open(path, "w", encoding="utf-8").write(render(a))
    print("vytvořeno:", path)
