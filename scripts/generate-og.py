#!/usr/bin/env python3
"""Vygeneruje brandový OG sdílecí obrázek (1200x630) v barvách webu.
Spuštění:  python3 scripts/generate-og.py
Výstup:    assets/og-default.jpg
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
DARK = (22, 22, 22)        # #161616
ORANGE = (255, 122, 0)     # #ff7a00
WHITE = (255, 255, 255)
GREY = (180, 180, 180)

BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
REG  = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"

img = Image.new("RGB", (W, H), DARK)
d = ImageDraw.Draw(img)

# jemný oranžový "glow" v pravém dolním rohu pro hloubku
glow = Image.new("RGB", (W, H), DARK)
gd = ImageDraw.Draw(glow)
for r in range(700, 0, -4):
    a = int(40 * (r / 700))
    gd.ellipse([W-250-r, H-120-r, W-250+r, H-120+r],
               fill=(min(DARK[0]+a, 60), min(DARK[1]+int(a*0.45), 40), DARK[2]))
img = Image.blend(img, glow, 0.6)
d = ImageDraw.Draw(img)

# levý oranžový svislý pruh
d.rectangle([0, 0, 14, H], fill=ORANGE)

# MB badge (zaoblený čtverec) – jako favicon
bx, by, bs = 80, 80, 150
d.rounded_rectangle([bx, by, bx+bs, by+bs], radius=34, fill=ORANGE)
fmb = ImageFont.truetype(BOLD, 92)
tb = d.textbbox((0,0), "MB", font=fmb)
d.text((bx+(bs-(tb[2]-tb[0]))/2, by+(bs-(tb[3]-tb[1]))/2 - tb[1]), "MB",
       font=fmb, fill=DARK)

# Headline
f1 = ImageFont.truetype(BOLD, 96)
d.text((80, 290), "Martin Barna", font=f1, fill=WHITE)

# Podnadpis
f2 = ImageFont.truetype(REG, 44)
d.text((80, 405), "Online výživa & fitness koučink", font=f2, fill=ORANGE)

# Spodní řádek důvěry
f3 = ImageFont.truetype(REG, 32)
d.text((80, 500), "od 2013  ·  600+ klientů  ·  vědecky podloženo", font=f3, fill=GREY)

img.save("assets/og-default.jpg", "JPEG", quality=88, optimize=True)
print("OK -> assets/og-default.jpg", img.size)
