#!/usr/bin/env python3
"""Bake Mo's reference portrait into src/render/mo_face_data.js (raw RGB, base64).

Usage: python3 scripts/bake-mo-face.py path/to/reference.png
The crop box below assumes the 1024x1008 reference (crown y~244, chin y~822, centre x~517).
"""
import base64, sys
from PIL import Image, ImageFilter

src = sys.argv[1]
im = Image.open(src).convert('RGB')
c = im.crop((260, 212, 774, 855)).filter(ImageFilter.GaussianBlur(1.2)).resize((160, 200), Image.LANCZOS)
s = base64.b64encode(c.tobytes()).decode()
open('src/render/mo_face_data.js', 'w').write(
    "/**\n * Mo's face, from the supplied reference portrait: a 160x200 frontal crop stored as raw RGB so it\n"
    " * can be decoded synchronously (no image load, no CORS taint). Frame layout matches\n"
    " * render/heads.js: centre x 80, crown y 10, chin y 190.\n * Regenerate with: scripts/bake-mo-face.py\n */\n"
    "export const MO_FACE = { w: 160, h: 200, frame: { cx: 80, crownY: 10, chinY: 190, halfW: 48 }, rgb: '%s' };\n" % s)
