#!/usr/bin/env python3
"""Nezavisla revize GEO podkladu v _cloud/geo-odpovedi/*.json (10. 10. 2026).

Pouziti:
  python3 -I _cloud/geo-odpovedi-revize.py                 kontrola vsech JSON
  python3 -I _cloud/geo-odpovedi-revize.py slug [slug...]  kontrola vybranych
  python3 -I _cloud/geo-odpovedi-revize.py --text slug     cely citelny text clanku (pro cteni)

Clanek = clanky/<slug>.html (bez index.html) + pilire jak-zhubnout/ a jak-nabrat-svaly/.

Kontroluje:
  1. ke kazdemu clanku prave jeden JSON, zadny osirely
  2. validni JSON, klice url, titulek, hlavni_otazka, kratka_odpoved, faq, opory, nejiste, kontrola
  3. url = canonical clanku, titulek = H1
  4. kontrola je "ok", "opraveno: ...", "smazano: ..." (pripadne "opraveno: ...; smazano: ...")
  5. kazda polozka (kratka_odpoved, faq[i]) ma oporu, zadna opora nemiri mimo
  6. KAZDA citace v "opory" je doslova v textu clanku. Overuje se dvema nezavislymi cestami:
     a) text uvnitr <article> (+ H1 a perex v hlavicce) z HTML parseru, bez CTA boxu
     b) cele HTML se smazanymi tagy (bez script/style)
     Normalizuji se jen bile znaky, nezlomitelne mezery a mekke deleni slov.
  7. kazde cislo v otazkach a odpovedich je v textu clanku
  8. 0 znaku U+2014 v celem souboru
  9. zadna AI fraze v textu, ktery pisi autori (otazky, odpovedi, nejiste, kontrola)
 10. kratka_odpoved nejvys 60 slov, faq 3 az 5 polozek, otazky konci otaznikem
"""
import glob
import html
import json
import os
import re
import sys
from html.parser import HTMLParser

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "_cloud", "geo-odpovedi")
KLICE = ["url", "titulek", "hlavni_otazka", "kratka_odpoved", "faq", "opory", "nejiste", "kontrola"]
PILIRE = {"jak-zhubnout": "jak-zhubnout/index.html", "jak-nabrat-svaly": "jak-nabrat-svaly/index.html"}
AI_FRAZE = [r"\bKlíčem je", r"\bklíčem je", r"\bVe světě", r"\bve světě\b", r"\bPojďme", r"\bpojďme",
            r"\bNení to jen\b", r"\bnení to jen\b", r"\bNejde jen o\b", r"\bnejde jen o\b",
            r"\bZávěrem\b", r"\bzávěrem\b", r"klíčovou roli", r"\bzásadn", r"\bZásadn",
            r"V dnešní době", r"v dnešní době", r"je důležité si uvědomit", r"Je důležité si uvědomit"]

SKIP_TAGS = {"script", "style", "noscript", "svg", "template", "form", "button", "nav"}
VOID = {"img", "br", "hr", "input", "meta", "link", "source", "wbr", "area", "col", "embed", "param", "track"}
BLOCK = {"p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "div", "tr", "td", "th", "blockquote",
         "figcaption", "section", "ul", "ol", "table", "dt", "dd", "summary", "details", "header",
         "article", "figure", "caption"}
INLINE = {"a", "strong", "em", "b", "i", "span", "sup", "sub", "abbr", "mark", "small", "u", "code", "time"}


def cesta(slug):
    return os.path.join(REPO, PILIRE[slug]) if slug in PILIRE else os.path.join(REPO, "clanky", slug + ".html")


def url(slug):
    return f"https://martinbarna.cz/{slug}/" if slug in PILIRE else f"https://martinbarna.cz/clanky/{slug}.html"


def vsechny_clanky():
    s = sorted(os.path.basename(p)[:-5] for p in glob.glob(os.path.join(REPO, "clanky", "*.html"))
               if os.path.basename(p) != "index.html")
    return s + sorted(PILIRE)


class Text(HTMLParser):
    """Citelny text <main>: bloky na radky, CTA boxy oznacene, nic z nich se nepocita do clanku."""

    def __init__(self, oznac_cta=False):
        super().__init__(convert_charrefs=True)
        self.stack, self.skip, self.out, self.oznac = [], 0, [], oznac_cta
        self.on = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get("class") or "").split()
        if tag == "main" or (tag == "header" and "hero" in cls):
            self.on = True
        if tag in VOID:
            if tag == "br":
                self.out.append("\n")
            return
        sk = tag in SKIP_TAGS or "cta-box" in cls or "author-box" in cls
        if self.oznac and "cta-box" in cls and not self.skip:
            self.out.append("\n[CTA BOX VYNECHAN]\n")
        self.stack.append((tag, sk))
        if sk:
            self.skip += 1
        if tag in BLOCK and not self.skip:
            self.out.append("\n")

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not any(t == tag for t, _ in self.stack):
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
        if self.on and not self.skip:
            self.out.append(d)


def flat(s):
    for ch in (" ", " ", " ", " "):
        s = s.replace(ch, " ")
    s = s.replace("­", "")
    return re.sub(r"\s+", " ", s).strip()


def obsah(raw):
    """Hlavicka (H1, perex) + <article>, bez footeru a navigace."""
    m = re.search(r"(?s)<header class=\"hero\".*?</header>", raw)
    hlav = m.group(0) if m else ""
    m = re.search(r"(?is)<article\b.*</article>", raw)
    art = m.group(0) if m else raw
    return hlav + art


def citelny_text(raw, oznac_cta=True):
    p = Text(oznac_cta)
    p.feed("<main>" + obsah(raw) + "</main>")
    p.close()
    t = "".join(p.out)
    t = re.sub(r"[ \t ]+", " ", t)
    return re.sub(r"\n\s*\n+", "\n", t).strip()


def text_html(raw):
    s = re.sub(r"(?is)<(script|style)\b[^>]*>.*?</\1>", " ", raw)
    s = re.sub(r"(?s)<!--.*?-->", " ", s)
    s = re.sub(r"</?(?:%s)\b[^>]*>" % "|".join(INLINE), "", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    return flat(html.unescape(s))


def h1(raw):
    m = re.search(r"<h1[^>]*>(.*?)</h1>", raw, re.S)
    return flat(html.unescape(re.sub(r"<[^>]+>", "", m.group(1)))) if m else ""


def canonical(raw):
    m = re.search(r'<link rel="canonical" href="([^"]+)"', raw)
    return m.group(1) if m else ""


def kontroluj(slug):
    e = []
    p = os.path.join(OUT, slug + ".json")
    if not os.path.exists(p):
        return ["CHYBI JSON"], 0
    surovy = open(p, encoding="utf-8").read()
    if "—" in surovy:
        e.append(f"U+2014: {surovy.count(chr(0x2014))}x")
    try:
        d = json.loads(surovy)
    except Exception as ex:
        return [f"NEVALIDNI JSON: {ex}"], 0
    if list(d) != KLICE:
        e.append(f"klice/poradi: {list(d)}")
    raw = open(cesta(slug), encoding="utf-8").read()
    if d.get("url") != url(slug):
        e.append(f"url {d.get('url')}")
    if canonical(raw) and canonical(raw) != url(slug):
        e.append(f"canonical clanku je {canonical(raw)}")
    if flat(d.get("titulek", "")) != h1(raw):
        e.append("titulek != H1")
    k = d.get("kontrola", "")
    if not (k == "ok" or re.match(r"^(opraveno|smazano): \S", k)):
        e.append(f"kontrola ma spatny tvar: {k[:40]!r}")
    t1, t2 = flat(citelny_text(raw, oznac_cta=False)), text_html(raw)
    ko = d.get("kratka_odpoved", "")
    if len(ko.split()) > 60:
        e.append(f"kratka_odpoved {len(ko.split())} slov")
    if not 3 <= len(d.get("faq", [])) <= 5:
        e.append(f"faq {len(d.get('faq', []))} polozek")
    otazky = [d.get("hlavni_otazka", "")] + [f["otazka"] for f in d.get("faq", [])]
    for o in otazky:
        if not o.strip().endswith("?"):
            e.append(f"otazka bez otazniku: {o[:50]}")
    potreba = {"kratka_odpoved"} | {f"faq[{i}]" for i in range(len(d.get("faq", [])))}
    pro = {o["pro"] for o in d.get("opory", [])}
    if potreba - pro:
        e.append(f"bez opory: {sorted(potreba - pro)}")
    if pro - potreba:
        e.append(f"opora mimo: {sorted(pro - potreba)}")
    n = 0
    for o in d.get("opory", []):
        n += 1
        cit = flat(o["citace"])
        a, b = cit in t1, cit in t2
        if not (a and b):
            e.append(f"citace nenalezena ({'' if a else 'clanek'}{'' if b else ' html'}): {cit[:80]}")
    cisla = set(re.findall(r"\d+(?:[,.]\d+)?", t1))
    vystup = otazky + [ko] + [f["odpoved"] for f in d.get("faq", [])]
    for v in vystup:
        for num in re.findall(r"\d+(?:[,.]\d+)?", v):
            if num not in cisla and num.replace(",", ".") not in cisla and num.replace(".", ",") not in cisla:
                e.append(f"cislo {num} neni v clanku")
    autorsky = " ".join(vystup + d.get("nejiste", []) + [k])
    for f in AI_FRAZE:
        if re.search(f, autorsky):
            e.append(f"AI fraze: {f}")
    return e, n


def main():
    arg = sys.argv[1:]
    if arg[:1] == ["--text"]:
        for s in arg[1:]:
            raw = open(cesta(s), encoding="utf-8").read()
            print(f"===== {s} ({url(s)}) =====")
            print(citelny_text(raw))
        return
    clanky = vsechny_clanky()
    chyb = 0
    if not arg:
        jsony = {os.path.basename(p)[:-5] for p in glob.glob(os.path.join(OUT, "*.json"))}
        for s in sorted(jsony - set(clanky)):
            print(f"{s}\tOSIRELY JSON (clanek neexistuje)")
            chyb += 1
    vyber = arg or clanky
    stav = {"ok": 0, "opraveno": 0, "smazano": 0}
    citaci = 0
    for s in vyber:
        e, n = kontroluj(s)
        citaci += n
        if os.path.exists(os.path.join(OUT, s + ".json")):
            try:
                k = json.load(open(os.path.join(OUT, s + ".json"), encoding="utf-8")).get("kontrola", "")
                for klic in stav:
                    if k.startswith(klic) or f"; {klic}:" in k:
                        stav[klic] += 1
            except Exception:
                pass
        chyb += len(e)
        print(f"{'OK ' if not e else 'ERR'}\t{s}" + ("" if not e else "\t" + " | ".join(e)))
    print(f"\nClanku: {len(vyber)} | citaci overeno: {citaci} | kontrola: {stav} | chyb: {chyb}")
    sys.exit(1 if chyb else 0)


if __name__ == "__main__":
    main()
