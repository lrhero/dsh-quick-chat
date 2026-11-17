# -*- coding: utf-8 -*-
"""Redraw the four figure labels on docs/hero-drawer.png (README hero image).

  python tools/relabel-figure.py

Left row labels: 正经版/整活版 -> A 版/B 版.
Right toggle buttons: 整活/正经 -> 切换 (blue in the B row, black in the A row).

Each label is erased with the flat colour behind it and redrawn with the same
font family, weight, size and colour, centred on the old ink box, so nothing
else in the screenshot changes. Safe to run twice: the erase boxes cover the
replacement text.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "docs" / "hero-drawer.png"
FONT_CANDIDATES = [
    Path(r"C:\Windows\Fonts\msyhbd.ttc"),  # Microsoft YaHei Bold — the screenshot's face
    Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"),
    Path("/System/Library/Fonts/PingFang.ttc"),
]
SIZE = 24

# (erase box x0,x1,y0,y1), erase colour, new text, ink-box centre, ink colour
EDITS = [
    ((136, 207, 126, 149), (20, 22, 28), "B版", (171.5, 137.5), (201, 209, 226)),
    ((136, 207, 248, 271), (20, 22, 28), "A版", (171.5, 259.0), (201, 209, 226)),
    ((1355, 1403, 123, 147), (27, 27, 31), "切换", (1379.0, 135.0), (110, 168, 255)),
    ((1355, 1403, 245, 268), (27, 27, 31), "切换", (1379.0, 256.5), (8, 8, 9)),
]

font_path = next((path for path in FONT_CANDIDATES if path.exists()), None)
if font_path is None:
    raise SystemExit("no CJK bold font found; add one to FONT_CANDIDATES")
font = ImageFont.truetype(str(font_path), SIZE)

img = Image.open(TARGET).convert("RGB")


def paste_text(text, centre, colour):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((0, 0), text, font=font, fill=colour + (255,))
    alpha = np.asarray(layer)[:, :, 3]
    ys, xs = np.where(alpha > 8)
    dx = int(round(centre[0] - (xs.min() + xs.max()) / 2))
    dy = int(round(centre[1] - (ys.min() + ys.max()) / 2))
    img.paste(layer, (dx, dy), layer)
    return (xs.min() + dx, xs.max() + dx, ys.min() + dy, ys.max() + dy)


canvas = ImageDraw.Draw(img)
for (x0, x1, y0, y1), bg, _text, _centre, _colour in EDITS:
    canvas.rectangle([x0, y0, x1, y1], fill=bg)

for _box, _bg, text, centre, colour in EDITS:
    ink = paste_text(text, centre, colour)
    print(f"drew {text} ink box x{ink[0]}..{ink[1]} y{ink[2]}..{ink[3]}")

img.save(TARGET)
print(f"saved {TARGET.relative_to(ROOT)} {img.size[0]}x{img.size[1]} using {font_path.name}")
