#!/usr/bin/env python3
"""Bake the NPC face reference bank into src/render/npc_faces_data.js.

For every NPC this writes two JPEG data URLs:
  portrait - a 180x240 (3:4) crop of the panel, shown in the phone / text threads
  frontal  - a 160x200 crop in the head frame used by render/heads.js (crown y 10, chin y 190,
             centre x 80), projected onto the low-poly skull as the 3D face texture
plus the frame half-width and a sampled skin colour.

Usage: python3 scripts/bake-npc-faces.py
Panel boxes and landmarks (eye line, chin, centre, temple half-width; panel pixels) are measured
from the 1024x1008 bank and listed below. The three women (Diana, Stephanie, Melanie) come from
their own sheet, assets/ref/partner_face_bank.png (1024x1024, three tall panels), with an explicit
portrait box because their panels are too tall to centre-crop. Mo is not in here: he keeps his
own sheet.
"""
import base64, io, json, sys
from PIL import Image, ImageFilter

BANK = Image.open('assets/ref/npc_face_bank.png').convert('RGB')
PARTNERS = Image.open('assets/ref/partner_face_bank.png').convert('RGB')
EYE_T = 0.515
# kind: (panel box), eyeY, chinY, cx, halfW
P = {
    'addison':  ((258, 53, 511, 340), 138, 228, 125, 66),
    'kev':      ((514, 53, 767, 340), 135, 235, 125, 62),
    'rae':      ((770, 53, 1020, 340), 125, 225, 122, 60),
    'dale':     ((5, 384, 255, 673), 128, 228, 122, 68),
    'dex':      ((258, 384, 511, 673), 125, 230, 125, 64),
    'nia':      ((514, 384, 767, 673), 128, 222, 120, 50),
    'miguel':   ((770, 384, 1020, 673), 128, 230, 122, 60),
    'habib':    ((337, 715, 511, 968), 128, 205, 85, 50),
    'homeless': ((514, 715, 688, 968), 128, 210, 85, 52),
    'junkie':   ((691, 715, 854, 968), 128, 205, 82, 50),
    'clerk':    ((857, 715, 1021, 968), 128, 200, 84, 48),
}
# the three women: same landmarks, plus a portrait box (sheet pixels)
P2 = {
    'diana':     ((0, 0, 338, 1024), 455, 620, 172, 92, (22, 290, 322, 690)),
    'stephanie': ((342, 0, 680, 1024), 450, 620, 170, 92, (362, 290, 662, 690)),
    'melanie':   ((686, 0, 1024, 1024), 460, 622, 170, 90, (706, 290, 1006, 690)),
}

def jpeg(img, q=86):
    b = io.BytesIO(); img.save(b, 'JPEG', quality=q)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()

out = {}
entries = [(BANK, k, v, None) for k, v in P.items()] + [(PARTNERS, k, v[:5], v[5]) for k, v in P2.items()]
for im, kind, (box, eye, chin, cx, hw), porbox in entries:
    x0, y0, x1, y1 = box
    panel = im.crop(box)
    # portrait: centre-crop the panel to 3:4 (or the explicit box)
    w, h = panel.size
    tw = int(h * 0.75)
    if porbox: por = im.crop(porbox)
    else: por = panel.crop(((w - tw) // 2, 0, (w - tw) // 2 + tw, h)) if tw < w else panel
    por = por.resize((180, 240), Image.LANCZOS)
    # frontal: crown is derived so the eye line lands on the skull's eye line
    crown = chin - (chin - eye) / EYE_T
    s = 180.0 / (chin - crown)
    fx0 = x0 + cx - 80 / s
    fy0 = y0 + crown - 10 / s
    fr = im.crop((round(fx0), round(fy0), round(fx0 + 160 / s), round(fy0 + 200 / s))).resize((160, 200), Image.LANCZOS)
    fr = fr.filter(ImageFilter.GaussianBlur(0.4))
    # skin: average of both cheeks just under the eyes
    px = panel.load()
    samples = [px[int(cx + dx), int(eye + (chin - eye) * 0.35)] for dx in (-hw * 0.55, -hw * 0.45, hw * 0.45, hw * 0.55)]
    skin = '#%02x%02x%02x' % tuple(int(sum(c[i] for c in samples) / len(samples)) for i in range(3))
    out[kind] = {'portrait': jpeg(por), 'frontal': jpeg(fr, 90), 'halfW': round(hw * s, 1), 'skin': skin}
    print(kind, skin, round(hw * s, 1))

js = ("/**\n * NPC faces from the owner's reference banks (assets/ref/npc_face_bank.png, partner_face_bank.png).\n"
      " * portrait: 180x240 HUD/phone portrait. frontal: 160x200 head-frame crop wrapped onto the 3D skull.\n"
      " * Regenerate with scripts/bake-npc-faces.py.\n */\n"
      "export const NPC_FACES = " + json.dumps(out, indent=1) + ";\n")
open('src/render/npc_faces_data.js', 'w').write(js)
