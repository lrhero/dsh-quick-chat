# -*- coding: utf-8 -*-
"""Redraw the right-hand control cluster and the footer caption of docs/hero-drawer.png.

The figure used to draw a text button called 切换, which the plugin never had:
the real drawer toolbar carries a coin (icon-set switch), then either the colour
swatch (A row) or the speaker (B row), a separator, and the ↗ / ⟳ / × actions.
This script erases the old button and URL text and draws that cluster, then
rewrites the footer caption so it points at the coin.

  python tools/redraw-toolbar.py

Geometry is in the figure's own pixels; icons are drawn at 4x and downsampled so
they get anti-aliased edges like the rest of the artwork.
"""
from pathlib import Path
import sys

from PIL import Image, ImageDraw, ImageFont
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
TARGET = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs" / "hero-drawer.png"
FONT_PATH = Path(r"C:\Windows\Fonts\msyhbd.ttc")
FALLBACK_FONTS = [
    Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"),
    Path("/System/Library/Fonts/PingFang.ttc"),
]

BAR_FILL = (27, 27, 31)
PAGE_BG = (20, 22, 28)
INK = (168, 176, 190)
CAPTION_INK = (127, 138, 163)
RING = (255, 176, 46)
SEP = (52, 52, 55)

SS = 4  # supersampling factor for the drawn icons


def font_file():
    for path in [FONT_PATH, *FALLBACK_FONTS]:
        if path.exists():
            return path
    raise SystemExit("no CJK bold font found")


def rounded(size, radius, colour, alpha=255):
    tile = Image.new("RGBA", (size[0] * SS, size[1] * SS), (0, 0, 0, 0))
    ImageDraw.Draw(tile).rounded_rectangle(
        [0, 0, size[0] * SS - 1, size[1] * SS - 1], radius=radius * SS, fill=colour + (alpha,)
    )
    return tile.resize(size, Image.LANCZOS)


def gradient_swatch(size, radius):
    w, h = size
    tile = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
    px = tile.load()
    for y in range(h * SS):
        for x in range(w * SS):
            t = (x / (w * SS - 1) * 0.55 + (1 - y / (h * SS - 1)) * 0.45)
            px[x, y] = (
                int(96 + (34 - 96) * t),
                int(110 + (211 - 110) * t),
                int(255 + (238 - 255) * t),
                255,
            )
    mask = Image.new("L", (w * SS, h * SS), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, w * SS - 1, h * SS - 1], radius=radius * SS, fill=255
    )
    tile.putalpha(mask)
    return tile.resize(size, Image.LANCZOS)


def speaker(size, colour):
    w, h = size
    tile = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    box = [(0.10, 0.38), (0.34, 0.38), (0.58, 0.14), (0.58, 0.86), (0.34, 0.62), (0.10, 0.62)]
    d.polygon([(int(x * w * SS), int(y * h * SS)) for x, y in box], fill=colour + (255,))
    d.arc([int(0.44 * w * SS), int(0.24 * h * SS), int(0.92 * w * SS), int(0.76 * h * SS)],
          start=-52, end=52, fill=colour + (255,), width=int(0.055 * w * SS))
    d.arc([int(0.62 * w * SS), int(0.34 * h * SS), int(1.02 * w * SS), int(0.66 * h * SS)],
          start=-52, end=52, fill=colour + (255,), width=int(0.055 * w * SS))
    return tile.resize(size, Image.LANCZOS)


def external_icon(size, colour):
    w, h = size
    tile = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    stroke = max(2, int(0.075 * w)) * SS
    # box open at the top-right corner
    d.line([(int(0.30 * w * SS), int(0.22 * h * SS)), (int(0.16 * w * SS), int(0.22 * h * SS)),
            (int(0.16 * w * SS), int(0.84 * h * SS)), (int(0.78 * w * SS), int(0.84 * h * SS)),
            (int(0.78 * w * SS), int(0.70 * h * SS))], fill=colour + (255,), width=stroke, joint="curve")
    d.line([(int(0.52 * w * SS), int(0.50 * h * SS)), (int(0.92 * w * SS), int(0.10 * h * SS))],
           fill=colour + (255,), width=stroke)
    d.line([(int(0.62 * w * SS), int(0.10 * h * SS)), (int(0.92 * w * SS), int(0.10 * h * SS)),
            (int(0.92 * w * SS), int(0.40 * h * SS))], fill=colour + (255,), width=stroke, joint="curve")
    return tile.resize(size, Image.LANCZOS)


def refresh_icon(size, colour):
    w, h = size
    tile = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    stroke = max(2, int(0.075 * w)) * SS
    inset = 0.14
    d.arc([int(inset * w * SS), int(inset * h * SS), int((1 - inset) * w * SS), int((1 - inset) * h * SS)],
          start=-60, end=250, fill=colour + (255,), width=stroke)
    tip = (0.90 * w * SS, 0.30 * h * SS)
    d.polygon([(int(tip[0] - 0.14 * w * SS), int(tip[1])), (int(tip[0]), int(tip[1] - 0.02 * h * SS)),
               (int(tip[0] - 0.02 * w * SS), int(tip[1] + 0.16 * h * SS))], fill=colour + (255,))
    return tile.resize(size, Image.LANCZOS)


def cross_icon(size, colour):
    w, h = size
    tile = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    stroke = max(2, int(0.09 * w)) * SS
    d.line([(0, 0), (w * SS, h * SS)], fill=colour + (255,), width=stroke)
    d.line([(0, h * SS), (w * SS, 0)], fill=colour + (255,), width=stroke)
    return tile.resize(size, Image.LANCZOS)


def coin(side, diameter):
    art = Image.open(ROOT / "assets" / "coin" / f"coin-{side}.png").convert("RGBA")
    return art.resize((diameter, diameter), Image.LANCZOS)


def ring(diameter, width, colour):
    tile = Image.new("RGBA", (diameter * SS, diameter * SS), (0, 0, 0, 0))
    ImageDraw.Draw(tile).ellipse(
        [width * SS // 2, width * SS // 2, diameter * SS - width * SS // 2 - 1, diameter * SS - width * SS // 2 - 1],
        outline=colour + (255,), width=width * SS,
    )
    return tile.resize((diameter, diameter), Image.LANCZOS)


def paste(img, tile, centre):
    x = int(round(centre[0] - tile.width / 2))
    y = int(round(centre[1] - tile.height / 2))
    img.paste(tile, (x, y), tile)


def draw_cluster(img, centre, style):
    y = centre
    right = 1679.0
    cross = cross_icon((18, 18), INK)
    cross_centre = right - cross.width / 2
    paste(img, cross, (cross_centre, y))

    refresh = refresh_icon((26, 26), INK)
    refresh_centre = cross_centre - cross.width / 2 - 22 - refresh.width / 2
    paste(img, refresh, (refresh_centre, y))

    ext = external_icon((26, 26), INK)
    ext_centre = refresh_centre - refresh.width / 2 - 18 - ext.width / 2
    paste(img, ext, (ext_centre, y))

    sep_x = ext_centre - ext.width / 2 - 19
    ImageDraw.Draw(img).rectangle([sep_x, y - 13, sep_x + 1, y + 13], fill=SEP)

    if style == "fun":
        second = speaker((34, 30), INK)
        coin_side = "back"
    else:
        second = gradient_swatch((36, 36), 10)
        coin_side = "front"

    second_centre = sep_x - 1 - 19 - second.width / 2
    paste(img, second, (second_centre, y))

    coin_centre = second_centre - second.width / 2 - 18 - 22
    paste(img, coin(coin_side, 44), (coin_centre, y))
    paste(img, ring(60, 2, RING), (coin_centre, y))


def relabel_caption(img, text):
    d = ImageDraw.Draw(img)
    d.rectangle([228, 332, 1110, 370], fill=PAGE_BG)
    font = ImageFont.truetype(str(font_file()), 24)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((0, 0), text, font=font, fill=CAPTION_INK + (255,))
    alpha = np.asarray(layer)[:, :, 3]
    ys, xs = np.where(alpha > 8)
    # left-align at 232 and put the ink top back on the original baseline (338)
    layer = layer.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    img.paste(layer, (232, 338), layer)
    print(f"caption ink now at x232..{232 + layer.width - 1} y338..{338 + layer.height - 1}")


img = Image.open(TARGET).convert("RGB")

# 1. wipe the old text button + the invented URL text inside both bars
draw = ImageDraw.Draw(img)
for (top, bottom) in [(90, 183), (212, 305)]:
    draw.rectangle([1300, top + 4, 1692, bottom - 4], fill=BAR_FILL)

# 2. draw the real control cluster, right-aligned like the app
draw_cluster(img, 136.5, "fun")     # B 版：硬币（带电面）+ 喇叭
draw_cluster(img, 258.5, "proper")  # A 版：硬币（皇冠面）+ 配色点

# 3. the caption now points at the coin, not at a button
relabel_caption(img, "橙圈 = 硬币开关。点一下：头部三个图标 + 抽屉里的图标同时换，选择会记住。")

img.save(TARGET)
print(f"saved {TARGET}")
