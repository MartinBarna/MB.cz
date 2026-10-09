#!/usr/bin/env python3
"""Kontrola GEO podkladu v _cloud/geo-odpovedi/*.json.

Pro kazdy JSON overi:
  - validni JSON a povinne klice se spravnymi typy
  - url = canonical clanku, titulek = <h1> clanku
  - kratka_odpoved nejvys 60 slov, faq 3 az 5 polozek
  - kazda polozka "pro" v opory ukazuje na existujici kratka_odpoved / faq[i]
  - kratka_odpoved i kazda faq[i] ma aspon jednu oporu
  - kazda citace se DOSLOVA vyskytuje v textu clanku (po odstraneni HTML,
    normalizuji se jen bile znaky); text bere extrahuj_text.py
  - nikde neni znak U+2014 (dlouha pomlcka)
  - upozorni na zakazane AI fraze

Pouziti: python3 zkontroluj.py [slug ...]   (bez argumentu = vsechny JSON ve slozce)
Navratovy kod 0 = vse v poradku.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
from extrahuj_text import extract, normalize  # noqa: E402

AI_FRAZE = [r"\bVe světě\b", r"\bKlíčem je\b", r"\bKlíčové je\b", r"Pojďme se podívat",
            r"Není to jen\b.*\bale\b", r"\bZávěrem\b", r"je důležité si uvědomit",
            r"v dnešní době", r"\bV neposlední řadě\b"]


def h1_and_canonical(path):
    raw = open(path, encoding="utf-8").read()
    m = re.search(r'<link rel="canonical" href="([^"]+)"', raw)
    canon = m.group(1) if m else None
    m = re.search(r"<h1[^>]*>(.*?)</h1>", raw, re.S)
    h1 = normalize(re.sub(r"<[^>]+>", "", m.group(1))) if m else None
    return canon, h1


def check(json_path):
    errs, warns = [], []
    slug = os.path.basename(json_path)[:-5]
    raw = open(json_path, encoding="utf-8").read()
    if "—" in raw:
        errs.append("obsahuje U+2014 (%d x)" % raw.count("—"))
    try:
        d = json.loads(raw)
    except Exception as e:  # noqa: BLE001
        return ["nevalidni JSON: %s" % e], warns, 0
    art = os.path.join(ROOT, "clanky", slug + ".html")
    if not os.path.exists(art):
        return errs + ["clanek clanky/%s.html neexistuje" % slug], warns, 0
    canon, h1 = h1_and_canonical(art)
    text = normalize(extract(art))

    for k, t in [("url", str), ("titulek", str), ("hlavni_otazka", str), ("kratka_odpoved", str),
                 ("faq", list), ("opory", list), ("nejiste", list)]:
        if not isinstance(d.get(k), t):
            errs.append("klic %s chybi nebo ma spatny typ" % k)
    if errs and any("klic" in e for e in errs):
        return errs, warns, 0
    extra = set(d) - {"url", "titulek", "hlavni_otazka", "kratka_odpoved", "faq", "opory", "nejiste"}
    if extra:
        errs.append("klice navic: %s" % sorted(extra))
    if d["url"] != canon:
        errs.append("url %r != canonical %r" % (d["url"], canon))
    if normalize(d["titulek"]) != h1:
        errs.append("titulek %r != h1 %r" % (d["titulek"], h1))
    if not d["hlavni_otazka"].strip().endswith("?"):
        warns.append("hlavni_otazka nekonci otaznikem")
    words = len(d["kratka_odpoved"].split())
    if words > 60:
        errs.append("kratka_odpoved ma %d slov (max 60)" % words)
    sentences = len([s for s in re.split(r"(?<=[.!?])\s+", d["kratka_odpoved"].strip()) if s])
    if not 2 <= sentences <= 3:
        warns.append("kratka_odpoved ma %d vet (ma 2 az 3)" % sentences)
    if not 3 <= len(d["faq"]) <= 5:
        errs.append("faq ma %d polozek (ma 3 az 5)" % len(d["faq"]))
    for i, f in enumerate(d["faq"]):
        if not isinstance(f, dict) or set(f) != {"otazka", "odpoved"}:
            errs.append("faq[%d] nema presne klice otazka/odpoved" % i)
            continue
        if not f["otazka"].strip().endswith("?"):
            warns.append("faq[%d].otazka nekonci otaznikem" % i)
        n = len([s for s in re.split(r"(?<=[.!?])\s+", f["odpoved"].strip()) if s])
        if n > 3:
            warns.append("faq[%d].odpoved ma %d vet (max 3)" % (i, n))
    valid_pro = {"kratka_odpoved"} | {"faq[%d]" % i for i in range(len(d["faq"]))}
    covered = set()
    ncit = 0
    for j, o in enumerate(d["opory"]):
        if not isinstance(o, dict) or set(o) != {"pro", "citace"}:
            errs.append("opory[%d] nema presne klice pro/citace" % j)
            continue
        if o["pro"] not in valid_pro:
            errs.append("opory[%d].pro = %r neodpovida zadne polozce" % (j, o["pro"]))
        covered.add(o["pro"])
        ncit += 1
        c = normalize(o["citace"])
        if len(c) < 15:
            warns.append("opory[%d] citace je velmi kratka" % j)
        if c not in text:
            errs.append("opory[%d] citace NENI doslovne v clanku: %r" % (j, o["citace"][:120]))
    for p in sorted(valid_pro - covered):
        errs.append("%s nema zadnou oporu" % p)
    for item in d["nejiste"]:
        if not isinstance(item, str):
            errs.append("nejiste obsahuje ne-retezec")
    vystup = " ".join([d["hlavni_otazka"], d["kratka_odpoved"]] +
                      [f.get("otazka", "") + " " + f.get("odpoved", "") for f in d["faq"] if isinstance(f, dict)])
    for fr in AI_FRAZE:
        if re.search(fr, vystup, re.I):
            warns.append("AI fraze: %s" % fr)
    return errs, warns, ncit


def main():
    if len(sys.argv) > 1:
        files = [os.path.join(HERE, s if s.endswith(".json") else s + ".json") for s in sys.argv[1:]]
    else:
        files = sorted(os.path.join(HERE, f) for f in os.listdir(HERE) if f.endswith(".json"))
    bad = 0
    total_cit = 0
    for fp in files:
        if not os.path.exists(fp):
            print("CHYBI  %s" % os.path.basename(fp))
            bad += 1
            continue
        errs, warns, ncit = check(fp)
        total_cit += ncit
        name = os.path.basename(fp)
        if errs:
            bad += 1
            print("CHYBA  %s" % name)
            for e in errs:
                print("       - " + e)
        else:
            print("OK     %s (%d citaci)" % (name, ncit))
        for w in warns:
            print("       ! " + w)
    print("\nSouboru: %d, s chybou: %d, citaci overeno: %d" % (len(files), bad, total_cit))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
