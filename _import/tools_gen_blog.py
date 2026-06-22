# -*- coding: utf-8 -*-
import json, re, html, os

posts=json.load(open("/tmp/posts_clean.json",encoding="utf-8"))
# STYLE z existujícího článku (identický vzhled)
kd=open("clanky/kaloricky-deficit.html",encoding="utf-8").read()
STYLE=re.search(r'<style>.*?</style>',kd,re.S).group(0)
BASE="https://web.martinbarna.cz/clanky/"

def esc(s): return html.escape(s, quote=True)
def first_p_is_title(body,title):
    m=re.match(r'\s*<p>(.*?)</p>',body,re.S)
    if not m: return body
    txt=re.sub('<[^>]+>','',m.group(1))
    if re.sub(r'\W+','',txt.lower())[:40]==re.sub(r'\W+','',title.lower())[:40] and len(txt)<160:
        return body[m.end():].lstrip()
    return body

ICON_MAP=[("trénink","💪"),("trenink","💪"),("posil","💪"),("sval","💪"),("suplement","💊"),("kreatin","💊"),
("kolagen","💊"),("protein","🥩"),("bílkovin","🥩"),("spánek","😴"),("spanek","😴"),("mozek","🧠"),
("sladidl","🥤"),("cola","🥤"),("lepek","🌾"),("toxin","⚗️"),("jed","⚗️"),("elektrolyt","⚡"),
("motivac","🔥"),("recept","🍽️"),("kalori","🔢"),("hubnut","⚖️"),("máslo","🧈")]
def icon(t):
    tl=t.lower()
    for k,e in ICON_MAP:
        if k in tl: return e
    return "🔬"

def cta_free():
    return ('<div class="cta-box" style="background:#161616;color:#fff;">\n'
    '<h3 style="color:#fff;">🎁 7denní plán na míru — zdarma</h3>\n'
    '<p style="color:#e8e8e8;">Pošlu ti na e-mail hotový 7denní plán s makry a tipy na jídla. Vyber si svou verzi:</p>\n'
    '<a class="btn gold" href="/forma-zpet/">Pro muže 35+</a>\n'
    '<a class="btn" href="/makro-plan/" style="background:#fff;color:#161616;">Pro ženy 30+</a>\n</div>')
def cta_coach():
    return ('<div class="cta-box">\n<h3>Chceš to mít nastavené na míru?</h3>\n'
    '<p>Spočítej si orientační příjem v kalkulačce zdarma, nebo ti rovnou sestavím jídelníček a plán na míru v rámci koučinku.</p>\n'
    '<a class="btn" href="../index.html#kalkulacka">Kalkulačka kalorií</a>\n'
    '<a class="btn gold" href="../index.html#balicky">Chci koučink na míru</a>\n</div>')

def article_html(a, related):
    title=a["title"]; slug=a["slug"]; url=BASE+slug+".html"
    desc=(a["excerpt"] or title)[:300]
    body=first_p_is_title(a["body"], title)
    # vlož free CTA po prvním odstavci
    m=re.search(r'</p>',body)
    if m: body=body[:m.end()]+"\n\n"+cta_free()+"\n\n"+body[m.end():]
    else: body=cta_free()+"\n"+body
    blog={"@context":"https://schema.org","@type":"BlogPosting","headline":title,"description":desc,
        "image":"https://web.martinbarna.cz/assets/og-default.jpg","datePublished":a["date"],"dateModified":a["date"],
        "author":{"@type":"Person","name":"Martin Barna","url":"https://web.martinbarna.cz/"},
        "publisher":{"@type":"Person","name":"Martin Barna","url":"https://web.martinbarna.cz/"},
        "mainEntityOfPage":{"@type":"WebPage","@id":url},"articleSection":"Výživa a věda","inLanguage":"cs-CZ"}
    crumb={"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
        {"@type":"ListItem","position":1,"name":"Domů","item":"https://web.martinbarna.cz/"},
        {"@type":"ListItem","position":2,"name":"Blog","item":"https://web.martinbarna.cz/clanky/"},
        {"@type":"ListItem","position":3,"name":title,"item":url}]}
    rel="\n".join(f'                <li><a href="{r["slug"]}.html">{esc(r["title"])}</a></li>' for r in related)
    H=[]
    H.append('<!DOCTYPE html>\n<html lang="cs">\n<head>')
    H.append('<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">')
    H.append(f'<title>{esc(title)} — Martin Barna</title>')
    H.append(f'<meta name="description" content="{esc(desc)}">')
    H.append('<meta name="theme-color" content="#ff7a00">')
    H.append(f'<link rel="canonical" href="{url}">')
    H.append('<meta property="og:type" content="article">')
    H.append(f'<meta property="og:url" content="{url}">')
    H.append(f'<meta property="og:title" content="{esc(title)}">')
    H.append(f'<meta property="og:description" content="{esc(desc)}">')
    H.append('<meta property="og:image" content="https://web.martinbarna.cz/assets/og-default.jpg">')
    H.append('<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">')
    H.append('<meta property="og:image:alt" content="Martin Barna — online výživa a fitness koučink">')
    H.append('<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="https://web.martinbarna.cz/assets/og-default.jpg">')
    H.append('<link rel="icon" href="data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><rect width=\'100\' height=\'100\' rx=\'22\' fill=\'%23161616\'/><text x=\'50\' y=\'70\' font-size=\'54\' font-family=\'Arial\' font-weight=\'bold\' fill=\'%23ff7a00\' text-anchor=\'middle\'>MB</text></svg>">')
    H.append('<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">')
    H.append('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>')
    H.append('<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet" media="print" onload="this.media=\'all\'">')
    H.append('<noscript><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet"></noscript>')
    H.append(STYLE)
    H.append('<script type="application/ld+json">\n'+json.dumps(blog,ensure_ascii=False,indent=2)+'\n</script>')
    H.append('<script type="application/ld+json">\n'+json.dumps(crumb,ensure_ascii=False,indent=2)+'\n</script>')
    H.append('</head>\n<body>')
    H.append('<a class="skip-link" href="#obsah">Přeskočit na obsah</a>')
    H.append('<div class="nav"><div class="wrap"><a class="brand" href="../index.html">Martin Barna</a><a class="back" href="index.html">← Zpět na blog</a></div></div>')
    H.append(f'<header class="hero" id="obsah">\n<span class="tag">VĚDA &amp; VÝŽIVA</span>\n<h1>{esc(title)}</h1>\n</header>')
    H.append('<div class="wrapc"><article>')
    H.append(body)
    H.append(cta_coach())
    H.append(f'<h2>Mohlo by tě zajímat</h2>\n<ul>\n{rel}\n</ul>')
    H.append('<p class="disclaimer">Článek má informativní charakter a není lékařským doporučením. Při zdravotních potížích se poraď s lékařem.</p>')
    H.append('</article></div>')
    H.append('<footer><p>&copy; 2026 Martin Barna — Online výživa a fitness · <a href="../index.html">Hlavní web</a></p></footer>')
    fab=re.search(r'<a class="fab-wa".*?</a>',kd,re.S).group(0)
    H.append(fab)
    H.append('</body>\n</html>')
    return "\n".join(H)

# generuj články
n=len(posts)
for idx,a in enumerate(posts):
    related=[posts[(idx+k)%n] for k in (1,2,3)]
    open(f"clanky/{a['slug']}.html","w",encoding="utf-8").write(article_html(a,related))
print("vygenerováno článků:",n)

# redirect mapa
with open("_import_redirect-map.csv","w",encoding="utf-8") as f:
    f.write("old_url,new_url\n")
    for a in posts:
        f.write(f'{a["oldlink"]},{BASE}{a["slug"]}.html\n')
print("redirect mapa: _import_redirect-map.csv")

# ulož seznam pro index
json.dump([{"slug":a["slug"],"title":a["title"],"date":a["date"],"excerpt":a["excerpt"][:120],"icon":icon(a["title"])} for a in posts],
          open("/tmp/idx.json","w",encoding="utf-8"),ensure_ascii=False)
