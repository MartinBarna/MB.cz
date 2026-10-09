#!/usr/bin/env python3
"""Vytahne cisty text clanku z clanky/<slug>.html (titulek + perex + <article>).

Vynechava: <script>, <style>, komentare, CTA boxy (div.cta-box), autorsky box,
sekci "Mohlo by te zajimat" (vcetne seznamu pod ni) a disclaimer.
Stejny text pouziva kontrola citaci (zkontroluj.py), aby citace mirily jen
na obsah clanku, ne na reklamni bloky.

Pouziti: python3 extrahuj_text.py clanky/slug.html   -> vypise text na stdout
"""
import html
import re
import sys
from html.parser import HTMLParser

BLOCK = {"p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "div", "tr", "td", "th",
         "blockquote", "section", "article", "ul", "ol", "table", "figcaption",
         "header", "br", "dt", "dd", "summary", "details", "figure", "caption"}
VOID = {"br", "img", "hr", "input", "meta", "link", "source", "wbr", "col", "area", "embed", "track"}


class Ext(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.skip_depth = 0      # hloubka uvnitr vynechaneho bloku
        self.stack = []          # (tag, skip_start)
        self.in_article = False
        self.in_hero = False
        self.stop_related = False  # po "Mohlo by te zajimat" az do konce clanku nic
        self.cur_h2 = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get("class") or "").split()
        if tag in VOID:
            if tag == "br":
                self.out.append("\n")
            return
        start_skip = False
        if tag in ("script", "style", "noscript", "svg", "nav", "form", "button"):
            start_skip = True
        if tag == "div" and ("cta-box" in cls or "author-box" in cls or "toc" in cls):
            start_skip = True
        if tag == "p" and "disclaimer" in cls:
            start_skip = True
        if tag == "article":
            self.in_article = True
        if tag == "header" and "hero" in cls:
            self.in_hero = True
        if tag == "p" and "hero-meta" in cls:
            start_skip = True
        if tag == "span" and "tag" in cls and self.in_hero:
            start_skip = True
        if start_skip:
            self.skip_depth += 1
        self.stack.append((tag, start_skip))
        if tag in BLOCK:
            self.out.append("\n")
        if tag == "h2":
            self.cur_h2 = []

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        # najdi odpovidajici otevreny tag (tolerance k neuzavrenym <p>, <li>)
        idx = None
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                idx = i
                break
        if idx is None:
            return
        while len(self.stack) > idx:
            t, sk = self.stack.pop()
            if sk:
                self.skip_depth -= 1
        if tag in BLOCK:
            self.out.append("\n")
        if tag == "article":
            self.in_article = False
        if tag == "header":
            self.in_hero = False
        if tag == "h2" and self.cur_h2 is not None:
            title = "".join(self.cur_h2).strip()
            if re.match(r"(Mohlo by t[eě] zaj[ií]mat|Souvisej[ií]c[ií] [čc]l[aá]nky|Čti d[aá]l|Dal[sš][ií] [čc]l[aá]nky)", title, re.I):
                self.stop_related = True
                # odstran nadpis z vystupu
                joined = "".join(self.out)
                pos = joined.rfind(title)
                if pos >= 0:
                    self.out = [joined[:pos]]
            self.cur_h2 = None

    def handle_data(self, data):
        if self.skip_depth or self.stop_related:
            return
        if not (self.in_article or self.in_hero):
            return
        self.out.append(data)
        if self.cur_h2 is not None:
            self.cur_h2.append(data)


def extract(path):
    raw = open(path, encoding="utf-8").read()
    raw = re.sub(r"<!--.*?-->", " ", raw, flags=re.S)
    p = Ext()
    p.feed(raw)
    txt = "".join(p.out)
    txt = html.unescape(txt).replace(" ", " ").replace(" ", " ")
    lines = [re.sub(r"[ \t\r\f\v]+", " ", l).strip() for l in txt.split("\n")]
    lines = [l for l in lines if l]
    return "\n".join(lines)


def normalize(s):
    """Normalizace pro porovnani citaci: jen bile znaky a nezlomitelne mezery."""
    s = html.unescape(s).replace(" ", " ").replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()


if __name__ == "__main__":
    print(extract(sys.argv[1]))
