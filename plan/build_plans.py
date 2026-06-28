# -*- coding: utf-8 -*-
# Generátor prémiových lead-magnet plánů (ženy 30+ / muži 35+) → branded HTML (+ zdroj pro PDF).
# Obsah = Martinem potvrzené plány (-1 final). Upgrade = AAA grafika, makro-čipy, proklik na kalkulačku,
# ochutnávku videokurzu zdarma a WhatsApp. Absolutní URL (funguje i v PDF mimo web).
import os, html

SITE = "https://www.martinbarna.cz"
CALC = SITE + "/kalkulacka-kalorii-a-makrozivin/"
VK_FREE = SITE + "/videokurz#zdarma"
BUY = "https://form.simpleshop.cz/3Vbl/buy/"
WA = "https://wa.me/420603229831"

def esc(s): return html.escape(str(s), quote=True)

# ---- DATA ------------------------------------------------------------------
# meal = (ikona, název, popis, B, S, T, kcal)
ZENY = {
  "slug": "makro-plan-zeny",
  "kicker": "7DENNÍ MAKRO PLÁN · ŽENY 30+",
  "title": "7denní makro plán pro ženy 30+",
  "kcal": "~1 500 kcal/den",
  "lead": "Hotový týdenní jídelníček s přesnými porcemi a makry, nákupním seznamem a variantami. Jez chutně, do sytosti a hubni — bez hladovění a bez jojo efektu.",
  "intro_h": "Proč makra fungují (a diety ne)",
  "intro_p": "Většina žen po třicítce už vyzkoušela desítky diet — keto, 1200 kcal, detoxy, „jen zelenina\". Po každé se váha vrátila výš, protože restrikce ignoruje realitu: stres, hormony, děti, práci, spánek. Tělo se brání, metabolismus zpomalí a po návratu k „normálu\" jde váha nahoru. Řešení není další dieta, ale systém, který dodržíš i při stresu, dětech a občasné pizze. Místo počítání každého sousta hlídáš tři živiny.",
  "macros": [
    ("Bílkoviny", "1,6–2,2 g / kg váhy", "Sytost a udržení svalů (vyšší při hubnutí a tréninku)"),
    ("Tuky", "min. 0,8–1 g / kg", "Hormony — po 30. roce klíčové"),
    ("Sacharidy", "zbytek do kalorií", "Energie pro trénink, mozek a náladu"),
    ("Pravidlo 80/20", "80 % kvalitně, 20 % volně", "Udržitelnost — pizza i víno se vejdou"),
  ],
  "days": [
    ("Pondělí", "tréninkový den", "~1480 kcal · B 118 · S 146 · T 42", [
      ("🌅","Snídaně","Ovesná kaše: 50 g ovesných vloček + 25 g syrovátkový protein + 150 ml polotučné mléko + 100 g borůvek",32,50,8,400),
      ("☕","Svačina","150 g řecký jogurt (do 5 % tuku) + 15 g mandlí",17,9,11,200),
      ("🍽️","Oběd","Kuřecí stir-fry: 130 g kuřecí prsa + 60 g rýže + 200 g zeleniny + 5 g oleje",38,52,9,460),
      ("🌙","Večeře","120 g losos + 150 g batáty + 150 g brokolice",31,35,14,420),
    ]),
    ("Úterý", "", "~1460 kcal · B 118 · S 135 · T 51", [
      ("🌅","Snídaně","Omeleta ze 3 vajec + 50 g špenát + 20 g eidam + 1 krajíc (40 g) celozrnného chleba",28,22,22,400),
      ("☕","Svačina","Proteinový shake (30 g protein) + banán (120 g)",28,30,3,250),
      ("🍽️","Oběd","Quinoa salát: 60 g quinoa + 100 g tuňák ve vlastní šťávě + ½ avokáda (70 g) + zelenina",32,45,16,450),
      ("🌙","Večeře","120 g libové hovězí + 200 g brambor + zelenina",30,38,10,360),
    ]),
    ("Středa", "", "~1430 kcal · B 122 · S 137 · T 39", [
      ("🌅","Snídaně","200 g řecký jogurt + 30 g granola + 100 g ovoce",22,45,8,340),
      ("☕","Svačina","200 g cottage + 100 g ovoce",24,16,5,200),
      ("🍽️","Oběd","Kuřecí wrap: celozrnná tortilla (60 g) + 120 g kuřecí + 30 g hummus + zelenina",38,44,14,460),
      ("🌙","Večeře","150 g pečené kuře + 150 g batáty + velký salát",40,32,12,420),
    ]),
    ("Čtvrtek", "tréninkový den", "~1490 kcal · B 123 · S 148 · T 45", [
      ("🌅","Snídaně","Proteinové palačinky: 1 vejce + 30 g protein + 40 g ovesná mouka + 100 g ovoce",35,40,9,380),
      ("☕","Svačina","1 proteinová tyčinka + 15 g mandlí",20,20,12,270),
      ("🍽️","Oběd","Lososový salát: 120 g losos + 50 g quinoa + zelenina + 5 g olivový olej",30,38,18,440),
      ("🌙","Večeře","130 g krůtí maso + 60 g rýže + zelenina",38,50,6,410),
    ]),
    ("Pátek", "", "~1430 kcal · B 100 · S 130 · T 55", [
      ("🌅","Snídaně","Vaječná míchanice: 3 vejce + ½ avokáda (70 g) + 1 krajíc (40 g) celozrnného chleba",24,22,24,400),
      ("☕","Svačina","150 g bílý jogurt + 100 g ovoce",10,22,3,150),
      ("🍽️","Oběd","70 g celozrnné těstoviny + 120 g mleté hovězí (10 %) + rajčatová omáčka + zelenina",38,55,14,500),
      ("🌙","Večeře","120 g grilovaný losos + 150 g batáty",28,31,14,380),
    ]),
    ("Sobota", "flex den", "~1500 kcal · drž bílkoviny, zbytek volněji", [
      ("🌅","Snídaně","150 g tvaroh + 100 g ovoce + 10 g med",25,25,2,230),
      ("🍽️","Oběd","Velký kuřecí salát: 150 g kuřecí + zelenina + 50 g pečivo",40,30,10,360),
      ("🍕","Večeře (volnější)","2 kousky pizzy (~250 g) — vychutnej si to bez výčitek",24,60,24,540),
      ("☕","Svačina","Proteinový shake (25 g protein)",25,5,2,150),
    ]),
    ("Neděle", "", "~1450 kcal · B 130 · S 120 · T 48", [
      ("🌅","Snídaně","Omeleta ze 3 vajec + 30 g sýr + zelenina",28,6,24,350),
      ("☕","Svačina","Proteinový pudink: 200 ml mléko + 25 g protein",28,18,4,230),
      ("🍽️","Oběd","Kuřecí vývar + salát s tuňákem (100 g tuňák + zelenina + 40 g pečivo)",35,28,8,330),
      ("🌙","Večeře","150 g pečené kuře + 150 g batáty + 150 g brokolice",42,38,12,440),
    ]),
  ],
  "flex_note": "Flex den = ventil, ne polštář. Drž bílkoviny vysoko a dej si JEDNO volnější jídlo, ne celý volný den.",
  "shop": [
    ("Bílkoviny", ["Kuřecí prsa — 700 g","Krůtí maso — 150 g","Libové + mleté hovězí (10 %) — 250 g","Losos — 360 g","Tuňák ve vlastní šťávě — 2 plechovky","Vejce — 14 ks","Syrovátkový protein — balení","Proteinová tyčinka — 1 ks"]),
    ("Mléčné", ["Řecký jogurt — 550 g","Bílý jogurt — 150 g","Tvaroh — 150 g · Cottage — 200 g","Polotučné mléko — 1 l","Eidam / sýr — 70 g"]),
    ("Sacharidy", ["Ovesné vločky — 100 g + ovesná mouka 40 g","Rýže — 120 g · Quinoa — 110 g","Batáty — 600 g · Brambory — 200 g","Celozrnné těstoviny — 70 g","Celozrnný chléb / pečivo — ½ bochníku","Celozrnná tortilla — 1 ks · Granola — 30 g"]),
    ("Tuky · zelenina · ovoce", ["Mandle — 60 g · Avokádo — 2 ks","Olivový / řepkový olej · Hummus — 30 g","Brokolice, špenát + mix zeleniny na týden","Ovoce: borůvky, banány, jablka dle chuti","Rajčatová omáčka / passata — 1 ks · med"]),
  ],
  "variants": [
    ("Bílkovina (~130 g masa)","kuřecí prsa ↔ krůtí ↔ libové hovězí ↔ ryba (losos/treska/tuňák) ↔ tofu/tempeh ↔ 150 g tvarohu/cottage ↔ 3 vejce + 30 g sýr"),
    ("Sacharid (~50 g syrového)","rýže ↔ brambory ↔ batáty ↔ celozrnné těstoviny ↔ quinoa ↔ kuskus ↔ 2 krajíce celozrnného chleba ↔ velká tortilla"),
    ("Tuk","15 g mandlí ↔ 15 g jiných ořechů ↔ ½ avokáda ↔ 1 lžíce olivového oleje ↔ 1 lžíce arašídového másla"),
    ("Zelenina","libovolná: brokolice, špenát, papriky, cuketa, rajčata, salát, lilek — bez omezení"),
    ("Snídaně","ovesná kaše ↔ proteinové palačinky ↔ jogurt s granolou ↔ vaječná omeleta ↔ tvaroh s ovocem"),
    ("Svačina","jogurt + ořechy ↔ protein. shake + ovoce ↔ cottage ↔ tvaroh ↔ proteinová tyčinka"),
  ],
  "scale": [
    ("Potřebuješ víc (+200–300 kcal)","Přidej 1 porci sacharidu navíc (např. +40 g rýže/ovsa nebo +1 kus pečiva) a 1 ovoce."),
    ("Potřebuješ míň (−200–300 kcal)","Uber polovinu sacharidu u 1–2 jídel a vynech přidané tuky (olej, ořechy)."),
    ("Trénuješ?","Dej víc sacharidů kolem tréninku (před + po)."),
    ("Bílkoviny","Drž vždy nahoře — klíč k sytosti a udržení svalů."),
  ],
  "rules": ["Pij 2,5–3 l vody denně.","Spi 7–8 hodin — bez spánku makra nefungují tak dobře.","Trénuj 3–4× týdně (síla + případně cardio).","1× týdně flex den — pomáhá psychicky i metabolicky.","Nebuď perfektní, buď konzistentní 80 % času."],
  "mistakes": None,
}

MUZI = {
  "slug": "forma-zpet-muzi",
  "kicker": "7DENNÍ MAKRO PLÁN · MUŽI 35+",
  "title": "Muž 35+: ještě není pozdě dostat formu zpátky",
  "kcal": "~2 000 kcal/den",
  "lead": "7denní makro plán pro vytížené muže — s přesnými porcemi a makry, nákupním seznamem a variantami. Víc energie, síly a sebevědomí, bez extrémů a hodin v posilce.",
  "intro_h": "Proč chlapi po 35 ztrácí formu",
  "intro_p": "Není to věkem. Je to životem: sedavá práce, stres, málo spánku, pivo a víkendové nájezdy, žádný systém. Testosteron sice po třicítce pomalu klesá, ale 90 % ztráty formy jde za stravou, pohybem a spánkem — a to všechno se dá vrátit, rychleji než si myslíš. Řešení není hladovka ani dřina 5× týdně (na to stejně nemáš čas), ale systém, který zvládneš i s prací, rodinou a nabitým kalendářem. Hlídáš tři živiny.",
  "macros": [
    ("Bílkoviny", "1,6–2,2 g / kg váhy", "Udržení svalů a sytost (vyšší při hubnutí a tréninku)"),
    ("Tuky", "0,8–1 g / kg", "Hormony vč. testosteronu — po 35 nepodceňuj"),
    ("Sacharidy", "zbytek do kalorií", "Energie do práce, tréninku i hlavy"),
    ("Pravidlo 80/20", "80 % kvalitně, 20 % volně", "Udržitelnost — pivo i steak se vejdou"),
  ],
  "days": [
    ("Pondělí", "tréninkový den", "~2000 kcal · B 158 · S 185 · T 73", [
      ("🌅","Snídaně","Míchaná vejce (3) + 2 krajíce celozrnného chleba + ½ avokáda",30,35,25,490),
      ("☕","Svačina","200 g skyr + banán + 30 g ořechů",28,38,16,410),
      ("🍽️","Oběd","150 g kuřecí prsa + 80 g rýže + zelenina + 10 g oleje",46,62,14,580),
      ("🌙","Večeře","150 g losos + 250 g brambory + velký salát",38,50,18,520),
    ]),
    ("Úterý", "", "~1980 kcal · B 152 · S 196 · T 64", [
      ("🌅","Snídaně","Ovesná kaše: 70 g vloček + 30 g protein + 250 ml polotučné mléko + banán",42,78,12,560),
      ("☕","Svačina","200 g tvaroh + 100 g ovoce",28,18,5,230),
      ("🍽️","Oběd","150 g libové hovězí + 300 g brambory + zelenina",40,55,16,560),
      ("🌙","Večeře","150 g kuřecí + 70 g celozrnné těstoviny + zelenina",45,55,12,560),
    ]),
    ("Středa", "den s krabičkou", "~2010 kcal · B 160 · S 188 · T 70", [
      ("🌅","Snídaně","250 g řecký jogurt + 50 g granola + ovoce + 20 g ořechů",32,55,18,520),
      ("☕","Svačina","Proteinový shake (30 g) + 50 g pečivo",30,30,4,280),
      ("🍱","Oběd","Krabička z práce: maso + příloha — vyber rozumně (cca 150 g masa + 200 g přílohy)",45,60,20,630),
      ("🌙","Večeře","150 g krůtí + 250 g batáty + brokolice",42,43,12,480),
    ]),
    ("Čtvrtek", "tréninkový den", "~2020 kcal · B 165 · S 195 · T 66", [
      ("🌅","Snídaně","Omeleta ze 4 vajec + 50 g sýr + 2 krajíce chleba",38,35,26,540),
      ("☕","Svačina","200 g skyr + 60 g ovesných vloček + ovoce",30,50,6,370),
      ("🍽️","Oběd","180 g hovězí steak + 250 g brambory + zelenina",48,50,20,600),
      ("🌙","Večeře","150 g ryba (treska/losos) + 80 g rýže + salát",40,60,12,510),
    ]),
    ("Pátek", "", "~1990 kcal · B 150 · S 190 · T 70", [
      ("🌅","Snídaně","Toast (2) s vejci + ½ avokáda + rajče",28,38,24,480),
      ("☕","Svačina","200 g cottage + 100 g ovoce + 20 g ořechů",28,22,14,330),
      ("🍔","Oběd","„Fit burger\": 150 g mleté hovězí (10 %) + celozrnná houska + zelenina + 100 g hranolky z trouby",42,65,20,620),
      ("🌙","Večeře","150 g kuřecí + 200 g brambory + brokolice",45,40,10,440),
    ]),
    ("Sobota", "flex den", "~2050 kcal · drž bílkoviny, zbytek volněji", [
      ("🌅","Snídaně","200 g tvaroh + ovesné vločky 50 g + ovoce + med",32,55,6,390),
      ("🍽️","Oběd","Velký kuřecí/hovězí salát + pečivo",45,35,15,450),
      ("🍕","Večeře (volnější)","Steak/pizza + 2 piva — užij si to bez výčitek, drž bílkoviny",45,75,35,820),
      ("☕","Svačina","Proteinový shake (25 g)",25,5,2,150),
    ]),
    ("Neděle", "", "~1970 kcal · B 162 · S 175 · T 66", [
      ("🌅","Snídaně","Omeleta ze 4 vajec + zelenina + 2 krajíce chleba",34,32,24,480),
      ("☕","Svačina","Proteinový shake (30 g) + banán",30,30,3,270),
      ("🍽️","Oběd","Pečené kuře 180 g + 250 g brambory + zelenina",50,45,18,570),
      ("🌙","Večeře","150 g krůtí + 70 g rýže + velký salát",45,55,10,520),
    ]),
  ],
  "flex_note": "Flex den = ventil, ne výmluva na celý zničený víkend. Jedno volnější jídlo, bílkoviny nahoře, druhý den jedeš dál.",
  "shop": [
    ("Bílkoviny", ["Kuřecí prsa — 900 g","Krůtí maso — 300 g","Hovězí (steak + libové + mleté 10 %) — 600 g","Ryba (losos, treska) — 450 g","Vejce — 20 ks","Syrovátkový protein — balení"]),
    ("Mléčné", ["Skyr — 800 g · Tvaroh — 400 g","Řecký jogurt — 250 g · Cottage — 200 g","Polotučné mléko — 1 l · Sýr — 100 g"]),
    ("Sacharidy", ["Ovesné vločky — 250 g · Granola — 50 g","Rýže — 230 g","Brambory — 1,8 kg · Batáty — 250 g","Celozrnné těstoviny — 70 g","Celozrnný chléb / pečivo — 1 bochník + housky"]),
    ("Tuky · zelenina · ovoce", ["Ořechy — 100 g · Avokádo — 2 ks","Olivový / řepkový olej · med","Zelenina na celý týden (brokolice, salát, rajčata, mix)","Ovoce: banány, jablka, bobule dle chuti"]),
  ],
  "variants": [
    ("Bílkovina (~150 g masa)","kuřecí ↔ krůtí ↔ hovězí ↔ vepřová panenka ↔ ryba ↔ 4 vejce + sýr ↔ 200 g tvarohu/skyru"),
    ("Sacharid (~80 g syrového)","rýže ↔ brambory ↔ batáty ↔ těstoviny ↔ kuskus ↔ 3 krajíce chleba ↔ velká tortilla"),
    ("Tuk","30 g ořechů ↔ ½ avokáda ↔ 1,5 lžíce oleje ↔ arašídové máslo"),
    ("Jídlo venku","restaurace: maso + příloha (rýže/brambory) + zelenina, vynech smažené a omáčky navíc; fast food: grilované, ne smažené"),
  ],
  "scale": [
    ("Potřebuješ víc (+300 kcal)","Přidej porci sacharidu (rýže/brambory/pečivo) + kus ovoce."),
    ("Potřebuješ míň (−300 kcal)","Uber polovinu sacharidu u oběda i večeře a vynech přidané tuky."),
    ("Trénuješ?","Dej víc sacharidů kolem tréninku."),
    ("Bílkoviny","Drž vždy nahoře — to je tvoje pojistka na svaly i sytost."),
  ],
  "rules": ["Pij 3 l vody denně (a hlídej alkohol).","Spi 7–8 hodin — spánek řídí hlad i testosteron.","Hýbej se: 2–3× síla týdně + denně kroky. Stačí začít.","Bílkovinu do každého jídla — nejjednodušší pravidlo s největším dopadem.","Nebuď perfektní, buď konzistentní 80 % času."],
  "mistakes": ["Málo bílkovin → ztráta svalů, hlad, jojo.","Tekuté kalorie navíc — pivo, slazené, džusy — sčítají se rychleji, než čekáš.","Žádný systém = jedeš na motivaci. Motivace dojde, systém zůstane.","Víkendové nájezdy, co smažou celý týden.","Ignorování spánku a stresu — bez nich makra nefungují tak dobře."],
}

# ---- TEMPLATE --------------------------------------------------------------
def chip(label, val, cls): return f'<span class="chip {cls}">{label}<b>{val}</b></span>'

def meal_row(m):
    ico, name, desc, B, S, T, kcal = m
    chips = chip("B",B,"b")+chip("S",S,"s")+chip("T",T,"t")+f'<span class="chip kcal">{kcal}<b>kcal</b></span>'
    return f'''<div class="meal"><div class="mi">{ico}</div><div class="mc"><div class="mn">{esc(name)}</div><div class="md">{esc(desc)}</div></div><div class="mm">{chips}</div></div>'''

def day_card(d):
    name, tag, summ, meals = d
    tagcls = "t-train" if "tréninkový" in tag else ("t-flex" if "flex" in tag else "t-box" if tag else "")
    taghtml = f'<span class="dtag {tagcls}">{esc(tag)}</span>' if tag else ''
    rows = "".join(meal_row(m) for m in meals)
    return f'''<div class="day">
      <div class="dhead"><div class="dl"><span class="dname">{esc(name)}</span>{taghtml}</div><div class="dsum">Σ {esc(summ)}</div></div>
      {rows}
    </div>'''

def build(P):
    days = "".join(day_card(d) for d in P["days"])
    macros = "".join(f'<div class="mrow"><div class="ml">{esc(n)}</div><div class="mv">{esc(v)}</div><div class="mp">{esc(p)}</div></div>' for n,v,p in P["macros"])
    shop = "".join(f'<div class="scol"><h4>{esc(t)}</h4><ul>'+"".join(f"<li>{esc(i)}</li>" for i in items)+'</ul></div>' for t,items in P["shop"])
    variants = "".join(f'<tr><td class="vk">{esc(k)}</td><td>{esc(v)}</td></tr>' for k,v in P["variants"])
    scale = "".join(f'<li><b>{esc(k)}</b> — {esc(v)}</li>' for k,v in P["scale"])
    rules = "".join(f'<li>{esc(r)}</li>' for r in P["rules"])
    mistakes = ""
    if P["mistakes"]:
        mistakes = '<h2>Nejčastější chyby</h2><ul class="check warn">'+"".join(f"<li>{esc(m)}</li>" for m in P["mistakes"])+'</ul>'
    return TEMPLATE.format(
        slug=P["slug"], kicker=esc(P["kicker"]), title=esc(P["title"]), kcal=esc(P["kcal"]),
        lead=esc(P["lead"]), intro_h=esc(P["intro_h"]), intro_p=esc(P["intro_p"]),
        macros=macros, days=days, flex_note=esc(P["flex_note"]), shop=shop,
        variants=variants, scale=scale, rules=rules, mistakes=mistakes,
        CALC=CALC, VK_FREE=VK_FREE, BUY=BUY, WA=WA,
    )

TEMPLATE = r'''<!DOCTYPE html>
<html lang="cs"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} — Martin Barna</title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="/assets/vendor/fonts/poppins.css">
<style>
:root{{--brand:#ff7a00;--brand2:#ff9d3c;--ink:#1a1714;--muted:#5d564d;--soft:#fff6ec;--line:#efe5d8;--paper:#fff;--b:#ff7a00;--s:#2e8be6;--t:#e0a020;}}
*{{box-sizing:border-box;}}html,body{{margin:0;}}
body{{font-family:'Poppins',Arial,sans-serif;color:var(--ink);background:#e9e7e4;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
.sheet{{max-width:840px;margin:24px auto;background:var(--paper);box-shadow:0 18px 50px rgba(0,0,0,.13);}}
.pad{{padding:46px 52px;}}
.toolbar{{position:sticky;top:0;z-index:10;background:#15110e;color:#fff;display:flex;gap:12px;align-items:center;justify-content:center;padding:10px;font-size:.9rem;}}
.toolbar button{{background:linear-gradient(145deg,var(--brand2),var(--brand));color:#160d04;border:none;font-weight:700;padding:9px 20px;border-radius:50px;cursor:pointer;font-family:inherit;}}
.toolbar a{{color:#cfc6bb;text-decoration:none;}}
/* hero */
.head{{display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:3px solid var(--brand);padding-bottom:16px;}}
.brand{{display:flex;align-items:center;gap:11px;}}
.brand .mk{{width:46px;height:46px;border-radius:12px;background:var(--brand);color:#fff;font-weight:800;font-size:1.15rem;display:flex;align-items:center;justify-content:center;}}
.brand .who{{font-weight:800;font-size:1.05rem;line-height:1.15;}}
.brand .who small{{display:block;font-weight:600;font-size:.72rem;color:var(--muted);letter-spacing:.03em;}}
.kick{{text-align:right;font-size:.7rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--brand);}}
h1{{font-size:2.05rem;line-height:1.12;margin:22px 0 8px;letter-spacing:-.02em;}}
.lead{{font-size:1.04rem;color:var(--muted);margin:0;}}
.kcalbadge{{display:inline-block;margin-top:14px;background:var(--soft);border:1px solid var(--line);border-radius:50px;padding:7px 16px;font-weight:700;font-size:.92rem;}}
.kcalbadge b{{color:var(--brand);}}
h2{{font-size:1.28rem;margin:30px 0 12px;position:relative;padding-left:16px;}}
h2::before{{content:"";position:absolute;left:0;top:.16em;bottom:.16em;width:5px;border-radius:3px;background:var(--brand);}}
p{{margin:.5rem 0;}}
/* CTA banner (kalkulačka) */
.cta-calc{{display:flex;align-items:center;gap:18px;flex-wrap:wrap;background:linear-gradient(135deg,#1a1714,#332b22);color:#fff;border-radius:18px;padding:20px 24px;margin:20px 0;}}
.cta-calc .ct{{flex:1;min-width:220px;}}
.cta-calc .ct b{{font-size:1.08rem;display:block;}}
.cta-calc .ct span{{color:#d9cfc2;font-size:.9rem;}}
.cta-calc a{{background:linear-gradient(145deg,var(--brand2),var(--brand));color:#160d04;font-weight:800;padding:13px 24px;border-radius:50px;text-decoration:none;white-space:nowrap;}}
/* makra */
.macros{{border:1px solid var(--line);border-radius:14px;overflow:hidden;margin:12px 0;}}
.mrow{{display:grid;grid-template-columns:1.1fr 1.2fr 2fr;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line);font-size:.92rem;align-items:center;}}
.mrow:last-child{{border-bottom:none;}}
.mrow:nth-child(odd){{background:var(--soft);}}
.mrow .ml{{font-weight:700;}}.mrow .mv{{color:var(--brand);font-weight:700;}}.mrow .mp{{color:var(--muted);font-size:.86rem;}}
/* day card */
.day{{border:1px solid var(--line);border-radius:16px;margin:14px 0;overflow:hidden;break-inside:avoid;page-break-inside:avoid;}}
.dhead{{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--soft);padding:12px 18px;border-bottom:1px solid var(--line);}}
.dl{{display:flex;align-items:center;gap:10px;}}
.dname{{font-weight:800;font-size:1.08rem;}}
.dtag{{font-size:.66rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em;padding:3px 10px;border-radius:50px;}}
.t-train{{background:#ffe8d2;color:#bb5a00;}}.t-flex{{background:#dcf3e4;color:#1f7a44;}}.t-box{{background:#e3edfb;color:#1f5fa6;}}
.dsum{{font-size:.82rem;font-weight:700;color:var(--muted);text-align:right;}}
.meal{{display:flex;align-items:flex-start;gap:13px;padding:12px 18px;border-bottom:1px solid var(--line);}}
.meal:last-child{{border-bottom:none;}}
.meal .mi{{font-size:1.2rem;width:26px;text-align:center;flex-shrink:0;}}
.meal .mc{{flex:1;min-width:0;}}
.meal .mn{{font-weight:700;font-size:.93rem;}}
.meal .md{{color:var(--muted);font-size:.86rem;}}
.meal .mm{{display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0;}}
.chip{{display:inline-flex;align-items:center;gap:4px;font-size:.68rem;font-weight:600;color:#fff;padding:2px 8px;border-radius:50px;white-space:nowrap;}}
.chip b{{font-weight:800;}}
.chip.b{{background:var(--b);}}.chip.s{{background:var(--s);}}.chip.t{{background:var(--t);}}
.chip.kcal{{background:#3a322a;}}
.mm .chip{{min-width:54px;justify-content:center;}}
.note{{background:var(--soft);border:1px solid var(--line);border-left:5px solid var(--brand);border-radius:12px;padding:12px 16px;margin:14px 0;font-size:.9rem;}}
.note b{{color:var(--brand);}}
/* shopping */
.shop{{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:12px 0;}}
.scol{{background:var(--soft);border:1px solid var(--line);border-radius:14px;padding:14px 16px;}}
.scol h4{{margin:0 0 8px;font-size:.92rem;color:var(--brand);}}
.scol ul{{list-style:none;padding:0;margin:0;}}
.scol li{{padding:3px 0 3px 20px;position:relative;font-size:.86rem;}}
.scol li::before{{content:"☐";position:absolute;left:0;color:var(--brand);}}
/* variants table */
table.var{{width:100%;border-collapse:collapse;margin:10px 0;font-size:.87rem;}}
table.var td{{border:1px solid var(--line);padding:9px 12px;vertical-align:top;}}
table.var .vk{{font-weight:700;width:34%;background:var(--soft);}}
/* lists */
ul.check{{list-style:none;padding:0;margin:.4rem 0;}}
ul.check li{{padding:5px 0 5px 26px;position:relative;font-size:.92rem;}}
ul.check li::before{{content:"✓";position:absolute;left:0;color:var(--brand);font-weight:800;}}
ul.check.warn li::before{{content:"⚠";color:#d98300;}}
ol.scale{{margin:.4rem 0;padding-left:20px;}}ol.scale li{{padding:4px 0;font-size:.92rem;}}
/* next steps */
.steps{{display:grid;gap:10px;margin:12px 0;}}
.step{{display:flex;align-items:center;gap:14px;background:var(--soft);border:1px solid var(--line);border-radius:14px;padding:14px 16px;text-decoration:none;color:inherit;transition:border-color .2s;}}
.step:hover{{border-color:var(--brand);}}
.step .si{{width:42px;height:42px;border-radius:11px;background:var(--brand);color:#fff;font-size:1.25rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;}}
.step .st{{flex:1;}}.step .st b{{display:block;font-size:.97rem;}}.step .st span{{color:var(--muted);font-size:.85rem;}}
.step .sgo{{color:var(--brand);font-weight:800;white-space:nowrap;font-size:.9rem;}}
.step.hot{{background:linear-gradient(135deg,#fff1e2,#ffe3c7);border-color:var(--brand);}}
.foot{{border-top:1px solid var(--line);margin-top:30px;padding-top:16px;font-size:.82rem;color:var(--muted);}}
.foot a{{color:var(--brand);text-decoration:none;font-weight:600;}}
.disc{{font-size:.72rem;color:#9b948b;margin-top:8px;}}
@media print{{body{{background:#fff;}}.toolbar{{display:none;}}.sheet{{box-shadow:none;margin:0;max-width:none;}}.pad{{padding:24px 28px;}}@page{{size:A4;margin:11mm;}}h2{{page-break-after:avoid;}}}}
@media(max-width:680px){{.pad{{padding:28px 22px;}}.shop{{grid-template-columns:1fr;}}.mrow{{grid-template-columns:1fr;gap:2px;}}.meal{{flex-wrap:wrap;}}.meal .mm{{flex-direction:row;align-items:center;width:100%;}}h1{{font-size:1.55rem;}}}}
</style></head>
<body>
<div class="toolbar"><button id="dl">⬇ Stáhnout / Tisk do PDF</button><a href="{CALC}" target="_blank">🧮 Spočítat svá makra</a></div>
<div class="sheet"><div class="pad">
  <div class="head">
    <div class="brand"><span class="mk">MB</span><span class="who">Martin Barna<small>Online výživa &amp; fitness</small></span></div>
    <div class="kick">{kicker}</div>
  </div>
  <h1>{title}</h1>
  <p class="lead">{lead}</p>
  <span class="kcalbadge">Start: <b>{kcal}</b> · doškáluj podle kalkulačky</span>

  <div class="note"><b>Jak plán používat (přečti jako první):</b> Plán je rozumný start. Není to dogma — svá přesná čísla si spočítáš za minutu v kalkulačce a podle nich plán jen doškáluješ (návod „jak zvětšit/zmenšit\" je níž). Hodnoty maker jsou zaokrouhlené a orientační — důležitý je směr, ne desetiny gramu.</div>

  <h2>{intro_h}</h2>
  <p>{intro_p}</p>

  <div class="cta-calc"><div class="ct"><b>🧮 Nejdřív si spočítej svá čísla</b><span>Plán doladíš za minutu — kalorie a makra přímo na tebe.</span></div><a href="{CALC}" target="_blank">Otevřít kalkulačku →</a></div>

  <h2>Tvoje makra — základní vodítka</h2>
  <div class="macros">{macros}</div>

  <h2>7denní jídelníček s porcemi a makry</h2>
  <p class="disc">B = bílkoviny (g) · S = sacharidy (g) · T = tuky (g). Porce v syrovém stavu, není-li uvedeno jinak. Denní souhrn je orientační.</p>
  {days}
  <div class="note">{flex_note}</div>

  <h2>Nákupní seznam na týden</h2>
  <div class="shop">{shop}</div>

  <h2>Varianty — zaměň, co ti nechutná</h2>
  <p class="disc">Nemusíš jíst přesně tohle. Drž porci dané kategorie a vyměň potravinu kus za kus (makra zůstanou ±stejná).</p>
  <table class="var">{variants}</table>

  <h2>Jak si plán zvětšit nebo zmenšit</h2>
  <ol class="scale">{scale}</ol>

  <h2>5 pravidel, bez kterých to nepojede</h2>
  <ul class="check">{rules}</ul>
  {mistakes}

  <h2>Tvůj další krok</h2>
  <div class="steps">
    <a class="step" href="{CALC}" target="_blank"><span class="si">🧮</span><span class="st"><b>Spočítej si přesná makra</b><span>Čísla přímo na tebe — minuta práce.</span></span><span class="sgo">Kalkulačka →</span></a>
    <a class="step hot" href="{VK_FREE}" target="_blank"><span class="si">🎬</span><span class="st"><b>Vyzkoušej videokurz ZDARMA</b><span>Zaregistruj se a prvních pár lekcí máš zdarma — jak jíst, počítat makra a hubnout bez jojo. Bez karty.</span></span><span class="sgo">Spustit zdarma →</span></a>
    <a class="step" href="{BUY}" target="_blank"><span class="si">💪</span><span class="st"><b>Chceš celý systém?</b><span>Videokurz výživy — 182 videí + bonusy, doživotně. Vše, co učím klienty.</span></span><span class="sgo">Videokurz →</span></a>
    <a class="step" href="{WA}" target="_blank"><span class="si">📞</span><span class="st"><b>Chceš to na míru?</b><span>Napiš mi „CALL\" na WhatsApp a domluvíme krátký hovor zdarma.</span></span><span class="sgo">WhatsApp →</span></a>
  </div>

  <div class="foot">
    <b>Martin Barna</b> · <a href="https://www.martinbarna.cz">martinbarna.cz</a> · @martinbarnaonlinevyzivafitness · Be Effective!
    <div class="disc">Tento materiál je obecné vzdělávací vodítko, ne individuální lékařská či dietní rada.</div>
  </div>
</div></div>
<script>document.getElementById('dl').addEventListener('click',function(){{window.print();}});</script>
</body></html>'''

# ---- WRITE -----------------------------------------------------------------
import os
ROOT = os.path.dirname(os.path.abspath(__file__))
for P in (ZENY, MUZI):
    outdir = os.path.join(ROOT, "plan", P["slug"])
    os.makedirs(outdir, exist_ok=True)
    open(os.path.join(outdir, "index.html"), "w", encoding="utf-8").write(build(P))
    print("wrote", outdir+"/index.html")
print("done")
