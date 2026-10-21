"""Odstraní odznak „Ověřeno Martinem“ z assets/app/zapis-jidla.webp (zrušen v appce 22. 8. 2026).
Použití: python3 oprava-odznaku.py assets/app/zapis-jidla.webp vystup.png; pak uložit jako webp q90.
Řádek se skládá z pixelů originálu (stejné písmo, barva, vyhlazení), nic se nepíše fontem."""
import sys
from PIL import Image; import numpy as np
src, out = sys.argv[1], sys.argv[2]
im = np.array(Image.open(src).convert('RGB'))
H, W, _ = im.shape
BG = np.array([25, 21, 31], dtype=np.uint8)
LINE = 40          # rozteč řádků meta textu
TXT = (90, 520)    # sloupec s texty
ICO = (525, 705)   # hvězdička + tlačítko +

def row(a, b, title, m1, m2, num_x, k_x, icons, divider):
    """a..b = rozsah řádku v originále (bez horního oddělovače). Vrátí nový řádek o LINE nižší."""
    h = (b - a) - LINE
    canvas = np.repeat(im[1060:1061], h, axis=0).copy()       # čistý řádek karty (okraje karty, pozadí)
    def paste(y0, y1, x0, x1, dy=0, dx=0):
        canvas[y0 - a + dy:y1 - a + dy, x0 + dx:x1 + dx] = im[y0:y1, x0:x1]
    paste(*title, *TXT)                                         # název potraviny beze změny
    # číslo kcal z 1. řádku meta, posunuté doleva na začátek řádku (x 98 jako u „106 kcal“)
    canvas[m1[0] - a:m1[1] - a, TXT[0]:TXT[1]] = BG
    paste(m1[0], m1[1], num_x[0], num_x[1], dx=98 - num_x[2])
    # „kcal/100 g · + zapíše 100 g“ z 2. řádku, o řádek výš, za číslo s mezerou jako v originále
    paste(m2[0], m2[1], 95, 470, dy=-LINE, dx=k_x)
    # ikony o polovinu řádku výš, ať jsou zase svisle na středu
    paste(icons[0], icons[1], *ICO, dy=-LINE // 2)
    # spodní oddělovač
    paste(divider[0], divider[1], 50, 735, dy=-LINE)
    return canvas

# řádek 1: Kuřecí prsa (originál 708..885), číslo „120“ = sloupce 358..401, ink „1“ začíná na 360
r1 = row(708, 885, title=(712, 760), m1=(760, 802), m2=(802, 846),
         num_x=(356, 402, 360), k_x=48, icons=(730, 818), divider=(880, 885))
# řádek 2: Kuřecí prsa grilovaná (originál 885..1083), „165“ = 358..401, ink „1“ na 360
r2 = row(885, 1083, title=(905, 955), m1=(955, 997), m2=(997, 1041),
         num_x=(356, 401, 360), k_x=47, icons=(925, 1013), divider=(1077, 1083))

top = np.empty((2 * LINE, W, 3), np.uint8); top[:] = (21, 17, 28)   # prázdné pozadí nad nadpisem (průměr 1. řádku)
new = np.concatenate([top, im[0:708], r1, r2, im[1083:]], axis=0)
assert new.shape == im.shape, new.shape
img = Image.fromarray(new)
if out.endswith('.webp'):
    img.save(out, 'WEBP', lossless=True, method=6)
else:
    img.save(out)
print('ok', new.shape)
