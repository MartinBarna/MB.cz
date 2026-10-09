#!/usr/bin/env python3
"""Kontrola GEO podkladu v _cloud/geo-odpovedi/*.json.

Pouziti:  python3 -I _cloud/geo-odpovedi-kontrola.py [od] [do]
          (poradi clanku = abecedne podle cesty clanky/*.html bez index.html, cislovano od 1;
           bez argumentu se kontroluji vsechny existujici JSON soubory)

Kontroluje:
  1. JSON je validni a ma presne klice url, titulek, hlavni_otazka, kratka_odpoved, faq, opory, nejiste
  2. url odpovida clanku, titulek = H1 clanku
  3. kratka_odpoved max 60 slov, faq 3 az 5 polozek, kazda polozka (kratka_odpoved, faq[i]) ma oporu
  4. kazda citace v "opory" se doslova vyskytuje v textu clanku (dve nezavisle extrakce:
     a) obsah <article> bez CTA boxu, autora a "Mohlo by te zajimat"
     b) cele HTML se smazanymi tagy, script a style)
  5. kazde cislo v odpovedich a otazkach se vyskytuje v textu clanku
  6. kratka_odpoved 2 az 3 vety, odpoved ve FAQ 1 az 3 vety (hruby odhad podle tecek)
  7. 0 znaku U+2014 (dlouha pomlcka) v souboru
  8. zadna z AI frazi ze zadani
"""
import sys, os, re, json, html, glob
from html.parser import HTMLParser

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "_cloud", "geo-odpovedi")
AI_FRAZE = ["Ve světě", "Klíčem je", "Pojďme se podívat", "Není to jen", "Závěrem"]
KLICE = {"url", "titulek", "hlavni_otazka", "kratka_odpoved", "faq", "opory", "nejiste"}

SKIP_TAGS = {"script", "style", "noscript", "svg", "template", "form", "button"}
SKIP_CLS = ("cta-box", "author-box", "info-gallery", "gallery-note")
VOID = {"img", "br", "hr", "input", "meta", "link", "source", "wbr", "area", "col", "embed", "param", "track"}
BLOCK = {"p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "div", "tr", "td", "th", "blockquote",
         "figcaption", "section", "ul", "ol", "table", "dt", "dd", "summary", "details"}
INLINE = {"a", "strong", "em", "b", "i", "span", "sup", "sub", "abbr", "mark", "small", "u", "code", "time"}


class Clanek(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.skip, self.out = [], 0, []

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            if tag == "br":
                self.out.append("\n")
            return
        cls = (dict(attrs).get("class") or "").split()
        sk = tag in SKIP_TAGS or any(c in cls for c in SKIP_CLS)
        self.stack.append((tag, sk))
        if sk:
            self.skip += 1
        if tag in BLOCK and not self.skip:
            self.out.append("\n")

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        while self.stack:
            t, sk = self.stack.pop()
            if sk:
                self.skip -= 1
            if t == tag:
                break
        if tag in BLOCK and not self.skip:
            self.out.append("\n")

    def handle_data(self, d):
        if not self.skip:
            self.out.append(d)


def flat(s):
    for ch in (" ", " ", " "):
        s = s.replace(ch, " ")
    s = s.replace("­", "")
    return re.sub(r"\s+", " ", s).strip()


def text_clanku(raw):
    m = re.search(r"<article\b[^>]*>(.*)</article>", raw, re.S | re.I)
    art = m.group(1) if m else raw
    art = re.sub(r"<h2[^>]*>\s*Mohlo by tě zajímat\s*</h2>\s*<ul>.*?</ul>", "", art, flags=re.S)
    p = Clanek()
    p.feed(art)
    p.close()
    return flat("".join(p.out))


def text_celeho_html(raw):
    s = re.sub(r"(?is)<(script|style)\b[^>]*>.*?</\1>", " ", raw)
    s = re.sub(r"(?s)<!--.*?-->", " ", s)
    s = re.sub(r"</?(?:%s)\b[^>]*>" % "|".join(INLINE), "", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    return flat(html.unescape(s))


def vety(s):
    return len([x for x in re.split(r"(?<=[.!?])\s+(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ„])", s.strip()) if x])


def h1(raw):
    m = re.search(r"<h1[^>]*>(.*?)</h1>", raw, re.S)
    return flat(html.unescape(re.sub(r"<[^>]+>", "", m.group(1)))) if m else ""


def main():
    clanky = sorted(p for p in glob.glob(os.path.join(REPO, "clanky", "*.html"))
                    if os.path.basename(p) != "index.html")
    if len(sys.argv) >= 3:
        od, do = int(sys.argv[1]), int(sys.argv[2])
        vyber = clanky[od - 1:do]
    else:
        vyber = [c for c in clanky
                 if os.path.exists(os.path.join(OUT, os.path.basename(c)[:-5] + ".json"))]
    chyb, citaci, ok_citaci, emdash = 0, 0, 0, 0
    for c in vyber:
        slug = os.path.basename(c)[:-5]
        p = os.path.join(OUT, slug + ".json")
        e = []
        if not os.path.exists(p):
            print(f"{slug}\tCHYBI JSON")
            chyb += 1
            continue
        surovy = open(p, encoding="utf-8").read()
        n = surovy.count("\u2014")
        emdash += n
        if n:
            e.append(f"U+2014: {n}x")
        try:
            d = json.loads(surovy)
        except Exception as ex:
            print(f"{slug}\tNEVALIDNI JSON: {ex}")
            chyb += 1
            continue
        if set(d) != KLICE:
            e.append(f"klice: {sorted(set(d) ^ KLICE)}")
        raw = open(c, encoding="utf-8").read()
        if d.get("url") != f"https://martinbarna.cz/clanky/{slug}.html":
            e.append("url")
        if flat(d.get("titulek", "")) != h1(raw):
            e.append("titulek != H1")
        t1, t2 = text_clanku(raw), text_celeho_html(raw)
        if len(d["kratka_odpoved"].split()) > 60:
            e.append(f"kratka_odpoved {len(d['kratka_odpoved'].split())} slov")
        if not 2 <= vety(d["kratka_odpoved"]) <= 3:
            e.append(f"kratka_odpoved {vety(d['kratka_odpoved'])} vet")
        for i, f in enumerate(d["faq"]):
            if not 1 <= vety(f["odpoved"]) <= 3:
                e.append(f"faq[{i}] {vety(f['odpoved'])} vet")
        if not 3 <= len(d["faq"]) <= 5:
            e.append(f"faq {len(d['faq'])} polozek")
        potreba = {"kratka_odpoved"} | {f"faq[{i}]" for i in range(len(d["faq"]))}
        pro = {o["pro"] for o in d["opory"]}
        if potreba - pro:
            e.append(f"bez opory: {sorted(potreba - pro)}")
        if pro - potreba:
            e.append(f"neznamy cil opory: {sorted(pro - potreba)}")
        for o in d["opory"]:
            citaci += 1
            cit = flat(o["citace"])
            a, b = cit in t1, cit in t2
            if a and b:
                ok_citaci += 1
            else:
                e.append(f"citace nenalezena ({'clanek' if not a else ''}{'+' if not a and not b else ''}{'html' if not b else ''}): {cit[:70]}")
        cisla_clanku = set(re.findall(r"\d+(?:[,.]\d+)?", t1))
        vystup = [d["hlavni_otazka"], d["kratka_odpoved"]] + [f["otazka"] for f in d["faq"]] + [f["odpoved"] for f in d["faq"]]
        for v in vystup:
            for num in re.findall(r"\d+(?:[,.]\d+)?", v):
                if num not in cisla_clanku:
                    e.append(f"cislo {num} neni v clanku")
        bez_citaci = " ".join(vystup + d["nejiste"])
        for f in AI_FRAZE:
            if f in bez_citaci:
                e.append(f"AI fraze: {f}")
        chyb += len(e)
        print(f"{slug}\tcitace {sum(1 for o in d['opory'] if flat(o['citace']) in t1 and flat(o['citace']) in t2)}/{len(d['opory'])}\t{'OK' if not e else '; '.join(e)}")
    print(f"\nSouboru: {len(vyber)} | citaci: {ok_citaci}/{citaci} nalezeno | U+2014: {emdash} | chyb celkem: {chyb}")
    sys.exit(1 if chyb else 0)


if __name__ == "__main__":
    main()
