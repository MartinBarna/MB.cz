#!/usr/bin/env python3
"""Pilot GEO odpovedi (jen ve vetvi cloud/geo-odpovedi-1009, nenasazuje se).

Vlozi do clanku z _cloud/geo-odpovedi/<slug>.json:
  a) pod perex (<p class="lead">) ramecek .pull "Kratka odpoved: <hlavni_otazka>" a pod tim kratka_odpoved
  b) sekci "Caste otazky" (h2 + p.faq-q + p) PRED zadany kotevni retezec
  c) FAQPage JSON-LD hned za posledni <script type="application/ld+json"> v <head>
Viditelny text i JSON-LD vznikaji z tehoz retezce, takze se shoduji slovo od slova.
Chybejici CSS tridy .pull a .faq-q doplni do inline <style> clanku (stejne pravidlo jako jinde na webu).

Pouziti:
  python3 -I _cloud/geo-pilot.py vloz <slug> "<kotva pred FAQ>"   (typicky "<h2>Mohlo by tě zajímat</h2>";
                                                              CTA box tesne pred kotvou se preskoci)
  python3 -I _cloud/geo-pilot.py over <slug> [<slug>...]   kontrola shody viditelneho textu a JSON-LD
"""
import html
import json
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PULL_CSS = ("        .pull { background:var(--green-light); border-left:4px solid var(--green); border-radius:0 14px 14px 0;"
            " padding:1.1rem 1.4rem; margin:1.8rem 0; font-weight:600; color:var(--green-dark); }\n")
FAQ_CSS = "        .faq-q { font-weight:700; color:var(--green-dark); margin:1.6rem 0 .3rem; }\n"
I = "            "


def esc(s):
    return html.escape(s, quote=False)


def nacti(slug):
    d = json.load(open(os.path.join(REPO, "_cloud", "geo-odpovedi", slug + ".json"), encoding="utf-8"))
    return d, os.path.join(REPO, "clanky", slug + ".html")


def vloz(slug, kotva):
    d, p = nacti(slug)
    t = open(p, encoding="utf-8").read()
    if 'data-geo="kratka-odpoved"' in t or "FAQPage" in t or 'class="faq-q"' in t:
        sys.exit(f"{slug}: uz obsahuje kratkou odpoved nebo FAQ, nic nedelam")
    if t.count(kotva) != 1:
        sys.exit(f"{slug}: kotva neni v clanku prave jednou ({t.count(kotva)}x)")
    # CSS
    m = re.search(r"\n    </style>", t)
    css = ""
    if not re.search(r"\.pull\s*\{", t):
        css += PULL_CSS
    if not re.search(r"\.faq-q\s*\{", t):
        css += FAQ_CSS
    if css:
        t = t[:m.start()] + "\n" + css.rstrip("\n") + t[m.start():]
    # a) ramecek pod perex
    m = re.search(r'<p class="lead">.*?</p>\n', t, re.S)
    if not m:
        sys.exit(f"{slug}: perex <p class=\"lead\"> nenalezen")
    box = (f'{I}<div class="pull" data-geo="kratka-odpoved"><strong>Krátká odpověď: {esc(d["hlavni_otazka"])}</strong><br>'
           f'{esc(d["kratka_odpoved"])}</div>\n')
    t = t[:m.end()] + box + t[m.end():]
    # b) sekce Caste otazky
    faq = f'{I}<h2>Časté otázky</h2>\n'
    for f in d["faq"]:
        faq += f'{I}<p class="faq-q">{esc(f["otazka"])}</p>\n{I}<p>{esc(f["odpoved"])}</p>\n'
    i = t.index(kotva)
    # FAQ patri za obsah clanku: kdyz tesne pred kotvou stoji CTA box, vlozi se pred nej
    j = t.rfind('<div class="cta-box"', 0, i)
    if j != -1:
        seg = t[j:i]
        if seg.count("<div") == 1 and seg.rstrip().endswith("</div>"):
            i = j
    zac = t.rfind("\n", 0, i) + 1
    t = t[:zac] + faq + "\n" + t[zac:]
    # c) FAQPage JSON-LD
    ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": f["otazka"],
         "acceptedAnswer": {"@type": "Answer", "text": f["odpoved"]}} for f in d["faq"]]}
    blok = ('    <script type="application/ld+json">\n' + json.dumps(ld, ensure_ascii=False, indent=2)
            + '\n    </script>\n')
    hlava = t[:t.index("</head>")]
    k = hlava.rfind('<script type="application/ld+json">')
    k = t.index("</script>", k)
    k = t.index("\n", k) + 1
    t = t[:k] + blok + t[k:]
    open(p, "w", encoding="utf-8").write(t)
    print(f"{slug}: vlozeno (ramecek, {len(d['faq'])} FAQ, JSON-LD{', CSS' if css else ''})")


def text(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()


def over(slug):
    d, p = nacti(slug)
    t = open(p, encoding="utf-8").read()
    e = []
    m = re.search(r'<div class="pull" data-geo="kratka-odpoved">(.*?)</div>', t, re.S)
    if not m or text(m.group(1)) != f"Krátká odpověď: {d['hlavni_otazka']}" + d["kratka_odpoved"]:
        e.append("ramecek != kratka_odpoved")
    sekce = re.search(r"<h2>Časté otázky</h2>\n(.*?)\n\n", t, re.S)
    viditelne = re.findall(r'<p class="faq-q">(.*?)</p>\s*<p>(.*?)</p>', sekce.group(1), re.S) if sekce else []
    viditelne = [(text(q), text(a)) for q, a in viditelne]
    ld = None
    for b in re.findall(r'<script type="application/ld\+json">(.*?)</script>', t, re.S):
        j = json.loads(b)
        if j.get("@type") == "FAQPage":
            ld = [(x["name"], x["acceptedAnswer"]["text"]) for x in j["mainEntity"]]
    jsn = [(f["otazka"], f["odpoved"]) for f in d["faq"]]
    if viditelne != jsn:
        e.append("viditelne FAQ != JSON")
    if ld != viditelne:
        e.append("JSON-LD != viditelne FAQ")
    if t.count("FAQPage") != 1:
        e.append(f"FAQPage {t.count('FAQPage')}x")
    if "—" in t:
        e.append("U+2014 v HTML")
    print(f"{'OK ' if not e else 'ERR'}\t{slug}\tFAQ {len(viditelne)}\t" + " | ".join(e))
    return not e


if __name__ == "__main__":
    if sys.argv[1] == "vloz":
        vloz(sys.argv[2], sys.argv[3])
    else:
        ok = all([over(s) for s in sys.argv[2:]])
        sys.exit(0 if ok else 1)
