# -*- coding: utf-8 -*-
import json, re, html
from bs4 import BeautifulSoup
SRC="homie.json"; KEEP_CATS={"E-Book 2.0 - Nejčastější dotazy klientů","Strava"}
d=json.load(open(SRC,encoding="utf-8"))
def first_cat(p):
    for grp in p.get("_embedded",{}).get("wp:term",[]):
        for t in grp:
            if t.get("taxonomy")=="category": return t.get("name")
    return ""
MAP={'á':'a','č':'c','ď':'d','é':'e','ě':'e','í':'i','ň':'n','ó':'o','ř':'r','š':'s','ť':'t','ú':'u','ů':'u','ý':'y','ž':'z'}
def slugify(t):
    t=html.unescape(t).lower(); t=''.join(MAP.get(ch,ch) for ch in t)
    t=re.sub(r'[^a-z0-9]+','-',t).strip('-'); return t[:70].strip('-') or "clanek"
def clean_title(t): return re.sub(r'\s+',' ',html.unescape(t)).strip()
def clean_body(content):
    i=content.find("Online koučing s Martinem")
    if i!=-1:
        pre=content.rfind("<h3",0,i); content=content[:pre if pre!=-1 else i]
    soup=BeautifulSoup(content,"html.parser")
    for tag in soup(["script","style"]): tag.decompose()
    for tag in soup.find_all(True):
        if tag.name in ("div","span"): tag.unwrap()
        else: tag.attrs={k:v for k,v in tag.attrs.items() if k in ("href","src","alt")}
    soup=BeautifulSoup(str(soup),"html.parser")
    for p in soup.find_all("p"):
        if not p.get_text(strip=True) and not p.find("img"): p.decompose()
    for img in soup.find_all("img"):
        img["loading"]="lazy"; img["decoding"]="async"
        if img.get("src","").startswith("/"): img["src"]="https://www.martinbarna.cz"+img["src"]
    return str(soup).strip()
posts=[]
for p in d:
    if first_cat(p) not in KEEP_CATS: continue
    title=clean_title(p["title"]["rendered"])
    if not title: continue
    posts.append({"title":title,"slug":slugify(title),"date":p.get("date","")[:10],"cat":first_cat(p),
        "excerpt":re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>','',p.get("excerpt",{}).get("rendered","")))).strip(),
        "body":clean_body(p["content"]["rendered"]),"oldlink":re.sub(r'#.*$','',p.get("link",""))})
seen={}
for a in posts:
    s=a["slug"]
    if s in seen: seen[s]+=1; a["slug"]=f"{s}-{seen[s]}"
    else: seen[s]=1
posts.sort(key=lambda a:a["date"],reverse=True)
json.dump(posts,open("/tmp/posts_clean.json","w",encoding="utf-8"),ensure_ascii=False)
print("připraveno článků:",len(posts))
print("\n=== UKÁZKA:",posts[1]["slug"],"===")
print("titulek:",posts[1]["title"])
print("excerpt:",posts[1]["excerpt"][:140])
print("body (600z):",posts[1]["body"][:600])
