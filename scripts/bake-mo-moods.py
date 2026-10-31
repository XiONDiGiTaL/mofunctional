#!/usr/bin/env python3
"""Cut Mo's six HUD portraits out of the mood sheet into src/render/mo_moods_data.js.

Usage: python3 scripts/bake-mo-moods.py [assets/ref/mo_mood_sheet.png]
The sheet is a 3x2 grid (content, tired, stressed / high, sick, angry) with labels under each row.
Panel boxes below match the 1012x997 sheet; adjust them if the sheet changes.
"""
import base64, io, sys
from PIL import Image

src = sys.argv[1] if len(sys.argv) > 1 else 'assets/ref/mo_mood_sheet.png'
im = Image.open(src).convert('RGB')
xs = [(5, 318), (346, 669), (695, 1008)]
ys = [(4, 430), (509, 934)]
names = [['content', 'tired', 'stressed'], ['high', 'sick', 'angry']]
W, H = 180, 240
out = ("/**\n * Mo's HUD portraits, cut from the owner's mood sheet (assets/ref/mo_mood_sheet.png) and stored\n"
       " * as PNG data URLs so they need no network fetch. Regenerate with scripts/bake-mo-moods.py.\n */\nexport const MO_MOODS = {\n")
for r, row in enumerate(names):
    for c, n in enumerate(row):
        (x0, x1), (y0, y1) = xs[c], ys[r]
        cr = im.crop((x0, y0, x1, y1))
        w, h = cr.size
        tw = int(h * 0.75)
        cr = cr.crop(((w - tw) // 2, 0, (w - tw) // 2 + tw, h)) if tw < w else cr.crop((0, 0, w, int(w / 0.75)))
        cr = cr.resize((W, H), Image.LANCZOS)
        b = io.BytesIO(); cr.save(b, "JPEG", quality=90)
        out += "  %s: 'data:image/jpeg;base64,%s',\n" % (n, base64.b64encode(b.getvalue()).decode())
out += "};\n"
open('src/render/mo_moods_data.js', 'w').write(out)
