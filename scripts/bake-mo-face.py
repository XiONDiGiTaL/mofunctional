#!/usr/bin/env python3
"""Bake Mo's 3D-head face into src/render/mo_face_data.js (raw RGB, base64).

Source: the CONTENT portrait of the mood sheet (assets/ref/mo_mood_sheet.png), so the head in the
world and the face on the HUD are the same painting. Frame: 160x200, crown y 10, chin y 190.

Usage: python3 scripts/bake-mo-face.py [assets/ref/mo_mood_sheet.png]
"""
import base64, sys
from PIL import Image

src = sys.argv[1] if len(sys.argv) > 1 else 'assets/ref/mo_mood_sheet.png'
im = Image.open(src).convert('RGB')
# content panel (5,4)-(318,430); crown y 32, chin y 370, temples 62..258 inside the panel
c = im.crop((15, 17, 315, 393)).resize((160, 200), Image.LANCZOS)
s = base64.b64encode(c.tobytes()).decode()
open('src/render/mo_face_data.js', 'w').write(
    "/**\n * Mo's face for the 3D head: the CONTENT portrait from the mood sheet, a 160x200 frontal crop\n"
    " * stored as raw RGB so it decodes synchronously. Frame matches render/heads.js (centre x 80,\n"
    " * crown y 10, chin y 190). Regenerate with scripts/bake-mo-face.py.\n */\n"
    "export const MO_FACE = { w: 160, h: 200, frame: { cx: 80, crownY: 10, chinY: 190, halfW: 52 }, rgb: '%s' };\n" % s)
