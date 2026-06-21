#!/usr/bin/env python3
"""Vygeneruje PWA/mobil ikony z MB monogramu (v barvách webu).
Výstup: assets/apple-touch-icon.png (180), icon-192.png, icon-512.png, favicon-32.png
"""
from PIL import Image, ImageDraw, ImageFont
DARK=(22,22,22); ORANGE=(255,122,0)
BOLD="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

def make(size, pad_ratio=0.0, radius_ratio=0.22, fname=""):
    img=Image.new("RGB",(size,size),DARK)
    d=ImageDraw.Draw(img)
    # zaoblený oranžový podklad (s paddingem pro maskable bezpečnou zónu)
    pad=int(size*pad_ratio)
    d.rounded_rectangle([pad,pad,size-pad,size-pad],
                        radius=int(size*radius_ratio), fill=ORANGE)
    # MB text
    fs=int((size-2*pad)*0.5)
    f=ImageFont.truetype(BOLD,fs)
    tb=d.textbbox((0,0),"MB",font=f)
    d.text(((size-(tb[2]-tb[0]))/2 - tb[0], (size-(tb[3]-tb[1]))/2 - tb[1]),
           "MB",font=f,fill=DARK)
    img.save(fname); print("->",fname,img.size)

make(180, pad_ratio=0.10, fname="assets/apple-touch-icon.png")
make(192, pad_ratio=0.12, fname="assets/icon-192.png")   # maskable-safe padding
make(512, pad_ratio=0.12, fname="assets/icon-512.png")
make(32,  pad_ratio=0.0, radius_ratio=0.22, fname="assets/favicon-32.png")
