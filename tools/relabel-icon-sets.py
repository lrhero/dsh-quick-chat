# -*- coding: utf-8 -*-
"""Rename the two section labels in docs/icon-sets.png.

  A · 正经版  ->  A · 矢量图标
  B · 整活版  ->  B · 插画头像

Same face (Microsoft YaHei Bold), size and colour as the original ink, erased
against the flat page background, so the rest of the sheet is untouched.

  python tools/relabel-icon-sets.py
"""
from pathlib import Path
import sys

from PIL import Image, ImageDraw, ImageFont
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
TARGET = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs" / "icon-sets.png"
FONTS = [
    Path(r"C:\Windows\Fonts\msyhbd.ttc"),
    Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"),
    Path("/System/Library/Fonts/PingFang.ttc"),
]
BG = (20, 22, 28)
INK = (223, 230, 255)
SIZE = 28

# (erase box x0,x1,y0,y1), new text, ink-box centre, left edge of the new ink
EDITS = [
    ((48, 222, 99, 133), "A · 矢量图标", (53, 115.5)),
    ((48, 222, 729, 763), "B · 插画头像", (55, 746.0)),
]

font_path = next((p for p in FONTS if p.exists()), None)
if font_path is None:
    raise SystemExit("no CJK bold font found")
font = ImageFont.truetype(str(font_path), SIZE)

img = Image.open(TARGET).convert("RGB")
canvas = ImageDraw.Draw(img)
for (x0, x1, y0, y1), _text, _anchor in EDITS:
    canvas.rectangle([x0, y0, x1, y1], fill=BG)

for _box, text, (left, mid) in EDITS:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((0, 0), text, font=font, fill=INK + (255,))
    alpha = np.asarray(layer)[:, :, 3]
    ys, xs = np.where(alpha > 8)
    layer = layer.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    y = int(round(mid - layer.height / 2))
    img.paste(layer, (int(left), y), layer)
    print(f"drew {text} at x{int(left)}..{int(left) + layer.width - 1} y{y}..{y + layer.height - 1}")

img.save(TARGET)
print(f"saved {TARGET}")
