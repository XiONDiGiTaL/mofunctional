/**
 * Heads, the late-90s console way: a low-poly skull with one wrap-around face texture.
 *
 * Every character's face starts as a FRONTAL portrait in a shared 160x200 frame
 * (centre x 80, crown y 10, chin y 190). Mo's frontal is his reference portrait
 * (render/mo_face_data.js); everyone else's is painted here from a spec using the same
 * landmarks. The frontal is then projected onto the skull through the same head shape the
 * geometry uses, producing a 256x256 cylindrical wrap: face in the middle, sides and ears
 * around it, hair and nape at the back. The 3D head, the HUD portrait and the phone
 * avatars all come from that one texture, so the cast reads as a single art direction.
 */
import * as THREE from '../../vendor/three.module.js';
import { MO_FACE } from './mo_face_data.js';
import { NPC_FACES } from './npc_faces_data.js';

/* --------------------------------- shape --------------------------------- */

/** Proportions in units of head height H (chin bottom to crown). */
export const HEAD = {
  halfW: 0.30,  // widest half-width (temples)
  halfD: 0.40,  // half-depth front-to-back
  SEG: 16,
  // [t, width, depth, z-offset (in halfD units, + = forward)]; t 0 = chin bottom, 1 = crown.
  // Width follows Mo's reference silhouette: narrow chin, cheeks, widest at the temples,
  // dome tapering hard into the crown.
  RINGS: [
    [0.00, 0.30, 0.34, 0.46],
    [0.07, 0.56, 0.58, 0.30],
    [0.17, 0.72, 0.78, 0.16],
    [0.28, 0.86, 0.90, 0.06],
    [0.40, 0.94, 0.97, 0.00],
    [0.51, 0.97, 1.00, -0.02],
    [0.61, 1.00, 1.00, -0.03],
    [0.73, 0.98, 0.98, -0.05],
    [0.85, 0.84, 0.88, -0.08],
    [0.94, 0.56, 0.62, -0.10],
    [1.00, 0.10, 0.12, -0.11],
  ],
  // facial landmarks (t), shared by the painter and the sculpt
  eyeT: 0.515, browT: 0.575, noseT: 0.315, mouthT: 0.24, hairT: 0.80,
};

const sq = (v) => Math.sign(v) * Math.pow(Math.abs(v), 0.8);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const gauss = (x, s) => Math.exp(-(x * x) / (s * s));

export function ringAt(t) {
  const R = HEAD.RINGS;
  if (t <= R[0][0]) return { w: R[0][1], d: R[0][2], z: R[0][3] };
  for (let i = 0; i < R.length - 1; i++) {
    const a = R[i], b = R[i + 1];
    if (t <= b[0]) {
      const k = (t - a[0]) / (b[0] - a[0]);
      return { w: a[1] + (b[1] - a[1]) * k, d: a[2] + (b[2] - a[2]) * k, z: a[3] + (b[3] - a[3]) * k };
    }
  }
  const l = R[R.length - 1];
  return { w: l[1], d: l[2], z: l[3] };
}

/** Sculpt: forward displacement (in H) of the face surface at angle a, height t. */
function sculpt(a, t) {
  const front = Math.max(0, Math.cos(a));
  let dz = 0;
  dz += 0.062 * gauss(t - 0.36, 0.075) * gauss(a, 0.17);            // nose
  dz += 0.022 * gauss(t - 0.46, 0.06) * gauss(a, 0.14);             // bridge
  dz += 0.016 * gauss(t - HEAD.browT, 0.035) * gauss(a, 0.75);      // brow shelf
  dz -= 0.016 * gauss(t - HEAD.eyeT, 0.04) * gauss(Math.abs(a) - 0.36, 0.16); // eye sockets
  dz += 0.014 * gauss(t - 0.42, 0.06) * gauss(Math.abs(a) - 0.78, 0.2);      // cheekbones
  dz += 0.010 * gauss(t - 0.235, 0.04) * gauss(a, 0.3);             // lips
  dz += 0.012 * gauss(t - 0.06, 0.05) * gauss(a, 0.35);             // chin pad
  return dz * front;
}

/** A point on the head surface, in units of H. */
export function headPoint(a, t) {
  const r = ringAt(t);
  const sx = sq(Math.sin(a));
  const cz = sq(Math.cos(a));
  const back = cz < 0 ? 0.94 : 1;
  return [
    sx * HEAD.halfW * r.w,
    t,
    cz * HEAD.halfD * r.d * back + r.z * HEAD.halfD + sculpt(a, t),
  ];
}

/** Cylindrical UV that spends most of the texture on the face. */
const UPOW = 0.62;
export function uFromAngle(a) { const s = a / Math.PI; return 0.5 + 0.5 * Math.sign(s) * Math.pow(Math.abs(s), UPOW); }
export function angleFromU(u) { const k = (u - 0.5) * 2; return Math.sign(k) * Math.pow(Math.abs(k), 1 / UPOW) * Math.PI; }

/**
 * Skull geometry at real size (hh metres tall). Indexed so normals are smoothed across the
 * face (the painted texture carries the detail); the seam sits at the back of the head.
 */
export function headGeometry(hh) {
  const { SEG } = HEAD;
  const ts = [];
  // rings plus a couple of in-betweens where the face needs resolution
  HEAD.RINGS.forEach((r) => ts.push(r[0]));
  [0.035, 0.235, 0.345, 0.455, 0.56].forEach((t) => ts.push(t));
  ts.sort((x, y) => x - y);
  const pos = [], uv = [], idx = [];
  const cols = SEG + 1;
  ts.forEach((t) => {
    for (let s = 0; s <= SEG; s++) {
      const a = (s / SEG) * Math.PI * 2 - Math.PI;
      const p = headPoint(a, t);
      pos.push(p[0] * hh, p[1] * hh, p[2] * hh);
      uv.push(uFromAngle(a), t);
    }
  });
  for (let r = 0; r < ts.length - 1; r++) {
    for (let s = 0; s < SEG; s++) {
      const i0 = r * cols + s, i1 = i0 + 1, j0 = i0 + cols, j1 = j0 + 1;
      idx.push(i0, j1, j0, i0, i1, j1);
    }
  }
  // crown cap and chin cap
  const top = ts.length - 1;
  const cTop = pos.length / 3;
  pos.push(0, hh * 1.004, ringAt(1).z * HEAD.halfD * hh); uv.push(0.5, 1);
  for (let s = 0; s < SEG; s++) idx.push(top * cols + s, top * cols + s + 1, cTop);
  const cBot = pos.length / 3;
  pos.push(0, -0.004 * hh, ringAt(0).z * HEAD.halfD * hh); uv.push(0.5, 0);
  for (let s = 0; s < SEG; s++) idx.push(s + 1, s, cBot);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A shell over the skull (hair volume). tMin(a) gives the lowest t covered at each angle, so a
 * bob can drop to the jaw at the sides while staying above the brow at the front. It samples
 * the same wrap texture, whose back/side region is hair.
 */
export function shellGeometry(hh, tMin, grow = 1.06, rows = 6) {
  const { SEG } = HEAD;
  const pos = [], uv = [], idx = [];
  const cols = SEG + 1;
  for (let k = 0; k <= rows; k++) {
    for (let s = 0; s <= SEG; s++) {
      const a = (s / SEG) * Math.PI * 2 - Math.PI;
      const t0 = tMin(a);
      const t = t0 + (1 - t0) * (k / rows);
      const p = headPoint(a, t);
      const gx = grow, gz = grow + (Math.cos(a) < 0 ? 0.02 : 0);
      pos.push(p[0] * gx * hh, (p[1] + (grow - 1) * 0.6 * (k / rows)) * hh, p[2] * gz * hh);
      uv.push(uFromAngle(a), Math.min(0.999, Math.max(t, 0.97)));
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let s = 0; s < SEG; s++) {
      const i0 = r * cols + s, i1 = i0 + 1, j0 = i0 + cols, j1 = j0 + 1;
      idx.push(i0, j1, j0, i0, i1, j1);
    }
  }
  const cTop = pos.length / 3;
  pos.push(0, hh * (1 + (grow - 1) * 0.6 + 0.004), ringAt(1).z * HEAD.halfD * hh); uv.push(0.5, 0.999);
  for (let s = 0; s < SEG; s++) idx.push(rows * cols + s, rows * cols + s + 1, cTop);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* --------------------------------- specs ---------------------------------- */

/**
 * Appearance specs. Colours: skin base / light / shadow / deep, hair base / light / dark,
 * plus brows, eyes and lips in the same family as the skin.
 */
export const FACE_SPECS = {
  mo: {
    source: 'reference', skin: '#8c5f40', shadow: '#5e3c26', hair: '#1c140e', hairLight: '#33261c', hairDark: '#0f0a07',
    style: 'short', sideT: 0.60, backT: 0.40,
  },
  // NPCs follow the owner's face bank (assets/ref/npc_face_bank.png); skins sampled from it.
  addison: {
    skin: '#bd8a6e', hair: '#bdbab2', hairLight: '#e2dfd8', hairDark: '#87847c', style: 'swept',
    brow: '#8b877e', eye: '#4b3f2c', lips: '#9a6455', lipsLight: '#bd8270',
    beard: 'full', beardColor: '#b6b3aa', age: 0.75, browTilt: -0.12,
  },
  kev: {
    skin: '#b98a6c', hair: '#c49a52', hairLight: '#e6c27c', hairDark: '#8e6832', style: 'quiff',
    brow: '#8a6a36', eye: '#4a5a3a', lips: '#a06654', lipsLight: '#bf8068', age: 0.3, jaw: 1.06,
  },
  rae: {
    skin: '#c09276', hair: '#4b2a86', hairLight: '#7a55b8', hairDark: '#2a1650', style: 'durag',
    brow: '#2a2020', eye: '#3e3530', lips: '#9c6458', lipsLight: '#b8806e', age: 0.2,
  },
  dale: {
    skin: '#c4927e', hair: '#c9c8c2', hairLight: '#ecebe6', hairDark: '#8f8e88', style: 'swept',
    brow: '#9a988f', eye: '#4a463a', lips: '#8e6456', lipsLight: '#a97c6a', age: 1.0, browTilt: 0.1,
  },
  dex: {
    skin: '#8f5a3a', hair: '#1a120c', hairLight: '#33261c', hairDark: '#0c0805', style: 'short',
    brow: '#1c120c', eye: '#2c2016', lips: '#6a3e30', lipsLight: '#8a5644',
    beard: 'full', beardColor: '#1a120c', age: 0.4,
  },
  nia: {
    skin: '#bb8f74', hair: '#3a281c', hairLight: '#5c4230', hairDark: '#1e140d', style: 'long',
    brow: '#2e2018', eye: '#3a2a1e', lips: '#9a5a50', lipsLight: '#bf7a6c', age: 0.25, fem: true, jaw: 0.94,
  },
  miguel: {
    skin: '#ad7a5a', hair: '#1a1410', hairLight: '#352a20', hairDark: '#0c0906', style: 'short',
    brow: '#1a1410', eye: '#3a2a1c', lips: '#7f4d3c', lipsLight: '#a06450', beard: 'goatee', beardColor: '#1a1410', age: 0.35,
  },
  habib: {
    skin: '#946646', hair: '#b8a27e', hairLight: '#d6c4a0', hairDark: '#8a7656', style: 'kufi',
    brow: '#20160e', eye: '#33241a', lips: '#7a4a3a', lipsLight: '#9a6250',
    beard: 'full', beardColor: '#1c140e', age: 0.5,
  },
  homeless: {
    skin: '#835a48', hair: '#55585a', hairLight: '#76797a', hairDark: '#36383a', style: 'beanie',
    brow: '#3a302a', eye: '#3a2c20', lips: '#6e4434', lipsLight: '#8c5a46',
    beard: 'stubble', beardColor: '#4a4038', age: 0.85, browTilt: 0.12,
  },
  junkie: {
    skin: '#af806c', hair: '#3a2a1e', hairLight: '#56402e', hairDark: '#1e150e', style: 'crop',
    brow: '#30261c', eye: '#3a3226', lips: '#86605a', lipsLight: '#a07a70', beard: 'stubble', beardColor: '#3a3024', age: 0.5, gaunt: true,
  },
  clerk: {
    skin: '#ae7f6e', hair: '#3a281c', hairLight: '#5a4230', hairDark: '#1e150e', style: 'side',
    brow: '#30251a', eye: '#3a2c1e', lips: '#93604c', lipsLight: '#b07a62', age: 0.3, glasses: true,
  },
};

const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export function faceSpec(kind) {
  const S = FACE_SPECS[kind] || FACE_SPECS.kev;
  if (!S.shadow) {
    const c = hex(S.skin);
    S.shadow = toHex(c.map((v) => v * 0.68));
    S.deep = toHex(c.map((v) => v * 0.45));
    S.light = toHex(c.map((v) => v + (255 - v) * 0.18));
  }
  return S;
}

/** Where hair starts (t) at a given angle, for the back/side fill. */
function hairStartT(a, S) {
  const side = S.sideT ?? { bob: 0.2, long: 0.2, dread: 0.5, braids: 0.56, receding: 0.6, swept: 0.6, durag: 0.62, kufi: 0.62, beanie: 0.56, quiff: 0.6 }[S.style] ?? 0.6;
  const back = S.backT ?? { bob: 0.16, long: 0.06, dread: 0.26, braids: 0.34, receding: 0.4, swept: 0.38, durag: 0.4, kufi: 0.45, beanie: 0.46, quiff: 0.38 }[S.style] ?? 0.4;
  const k = smooth(Math.PI / 2, Math.PI, Math.abs(a));
  return side + (back - side) * k;
}

/* --------------------------------- color ---------------------------------- */

const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
const mix = (c1, c2, k) => [c1[0] + (c2[0] - c1[0]) * k, c1[1] + (c2[1] - c1[1]) * k, c1[2] + (c2[2] - c1[2]) * k];
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }

/* ------------------------------ frontal sources ------------------------------ */

const FW = 160, FH = 200;
const FRAME = { cx: 80, crownY: 10, chinY: 190, halfW: 52 };
const ty = (t) => FRAME.chinY - t * (FRAME.chinY - FRAME.crownY);
const halfAt = (t) => FRAME.halfW * ringAt(t).w;

let moFrontal = null;
function referenceFrontal() {
  if (moFrontal) return moFrontal;
  const bin = atob(MO_FACE.rgb);
  const data = new Uint8ClampedArray(MO_FACE.w * MO_FACE.h * 4);
  for (let i = 0, j = 0; i < bin.length; i += 3, j += 4) {
    data[j] = bin.charCodeAt(i); data[j + 1] = bin.charCodeAt(i + 1); data[j + 2] = bin.charCodeAt(i + 2); data[j + 3] = 255;
  }
  moFrontal = { w: MO_FACE.w, h: MO_FACE.h, data, frame: MO_FACE.frame };
  return moFrontal;
}

/** Derive a 5-step skin ramp (deep, shadow, mid, light, hot) from one base colour. */
function skinRamp(base) {
  const c = hex(base);
  const f = (k, warm = 0) => `rgb(${Math.min(255, c[0] * k + warm) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k * (1 - warm / 400)) | 0})`;
  const toward = (k, to) => `rgb(${(c[0] + (to[0] - c[0]) * k) | 0},${(c[1] + (to[1] - c[1]) * k) | 0},${(c[2] + (to[2] - c[2]) * k) | 0})`;
  return { deep: f(0.45, 4), shadow: f(0.7, 6), mid: f(1.0), light: toward(0.16, [255, 236, 214]), hot: toward(0.3, [255, 240, 224]) };
}

/**
 * Paint a frontal portrait in the style of Mo's mood sheet: flat painted PLANES with hard edges
 * (forehead, temples, brow ridge, sockets, cheekbones, cheek hollows, nose bridge and side, upper
 * lip, chin pad, jaw), key light from the upper left, deep sockets and a strong nose shadow.
 */
export function paintFrontal(S, portrait = false) {
  const c = document.createElement('canvas');
  c.width = FW; c.height = FH;
  const x = c.getContext('2d');
  const cx = FRAME.cx;
  const jaw = S.jaw ?? 1;
  const K = skinRamp(S.skin);
  const eyeY = ty(HEAD.eyeT), browY = ty(HEAD.browT), noseY = ty(HEAD.noseT) + 2, mouthY = ty(HEAD.mouthT);
  const eyeDX = 19.5, eyeW = 8.8;
  const P = (pts, fill, alpha = 1) => {
    x.globalAlpha = alpha; x.fillStyle = fill; x.beginPath();
    pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
    x.closePath(); x.fill(); x.globalAlpha = 1;
  };
  const both = (fn) => { fn(-1); fn(1); };
  const W = (t) => halfAt(t) * (t < 0.35 ? jaw : 1);

  // ---- silhouette
  if (!portrait) { x.fillStyle = K.shadow; x.fillRect(0, 0, FW, FH); }
  const outline = [];
  for (let t = 0; t <= 1.0001; t += 0.02) outline.push([cx + W(t), ty(t)]);
  x.beginPath();
  outline.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
  for (let i = outline.length - 1; i >= 0; i--) x.lineTo(2 * cx - outline[i][0], outline[i][1]);
  x.closePath(); x.fillStyle = K.mid; x.fill();
  x.save(); x.clip();

  // ---- big planes: temples / outer cheeks / jaw sides turn away from the light
  both((sd) => P([
    [cx + sd * W(0.82), ty(0.82)], [cx + sd * 38, ty(0.72)], [cx + sd * 40, ty(0.5)], [cx + sd * 35, ty(0.3)],
    [cx + sd * 21, ty(0.1)], [cx + sd * 8, ty(-0.02)], [cx + sd * 70, ty(-0.02)], [cx + sd * 70, ty(0.82)],
  ], K.shadow, sd > 0 ? 0.95 : 0.55));
  // forehead plane + hot spot
  P([[cx - 33, ty(0.64)], [cx + 29, ty(0.64)], [cx + 22, ty(0.9)], [cx - 26, ty(0.9)]], K.light, 0.7);
  P([[cx - 14, ty(0.7)], [cx + 6, ty(0.7)], [cx + 4, ty(0.84)], [cx - 12, ty(0.84)]], K.hot, 0.45);
  // brow ridge catches light, sockets fall into shadow under it
  both((sd) => P([[cx + sd * 4, browY - 2], [cx + sd * 34, browY - 1], [cx + sd * 35, browY + 3], [cx + sd * 4, browY + 4]], sd < 0 ? K.light : K.mid, 0.7));
  both((sd) => {
    const ex = cx + sd * eyeDX;
    P([[ex - 13, browY + 3], [ex + 12, browY + 3], [ex + 13, eyeY + 5], [ex + sd * 2, eyeY + 8], [ex - 12, eyeY + 5]], K.deep, sd > 0 ? 0.8 : 0.62);
  });
  // cheekbones: lit triangles under the outer eye; cheek hollows below them
  both((sd) => {
    const ex = cx + sd * eyeDX;
    P([[ex - sd * 8, eyeY + 7], [ex + sd * 14, eyeY + 4], [ex + sd * 10, ty(0.38)], [ex - sd * 2, ty(0.36)]], sd < 0 ? K.light : K.mid, sd < 0 ? 0.8 : 0.45);
    P([[cx + sd * 37, ty(0.4)], [cx + sd * 21, ty(0.33)], [cx + sd * 20, ty(0.22)], [cx + sd * 30, ty(0.15)], [cx + sd * 37, ty(0.26)]], K.shadow, S.gaunt ? 0.95 : sd > 0 ? 0.7 : 0.45);
  });
  // ---- nose: lit bridge, shadow side, hot tip, deep underside
  P([[cx - 4, browY + 2], [cx + 1, browY + 2], [cx + 2, noseY - 6], [cx - 5, noseY - 6]], K.light, 0.85);
  P([[cx + 1, eyeY - 2], [cx + 9, noseY - 3], [cx + 10, noseY + 1], [cx + 2, noseY - 3]], K.shadow, 0.9);
  P([[cx - 2, eyeY], [cx - 9, noseY - 3], [cx - 9, noseY + 1], [cx - 4, noseY - 3]], K.mid, 0.6);
  P([[cx - 5, noseY - 6], [cx + 3, noseY - 6], [cx + 4, noseY - 1], [cx - 6, noseY - 1]], K.hot, 0.55);
  both((sd) => P([[cx + sd * 4, noseY - 4], [cx + sd * 10, noseY - 2], [cx + sd * 9, noseY + 2], [cx + sd * 4, noseY + 1]], K.shadow, 0.75));
  P([[cx - 10, noseY + 1], [cx + 11, noseY + 1], [cx + 6, noseY + 5], [cx - 6, noseY + 5]], K.deep, 0.7);
  both((sd) => { x.fillStyle = '#140b07'; x.beginPath(); x.ellipse(cx + sd * 4.5, noseY + 1.5, 2.4, 1.2, sd * 0.3, 0, Math.PI * 2); x.fill(); });
  // nasolabial folds
  x.strokeStyle = K.deep; x.lineWidth = 1.6; x.globalAlpha = 0.55 + (S.age || 0) * 0.3;
  both((sd) => { x.beginPath(); x.moveTo(cx + sd * 11, noseY + 1); x.lineTo(cx + sd * 17, mouthY + 1); x.lineTo(cx + sd * 16, mouthY + 9); x.stroke(); });
  x.globalAlpha = 1;
  // upper lip plane, philtrum, chin pad, jaw underside
  P([[cx - 13, noseY + 5], [cx + 13, noseY + 5], [cx + 14, mouthY - 1], [cx - 14, mouthY - 1]], K.shadow, 0.35);
  P([[cx - 2, noseY + 5], [cx + 2, noseY + 5], [cx + 1.5, mouthY - 2], [cx - 1.5, mouthY - 2]], K.deep, 0.3);
  P([[cx - 10, mouthY + 10], [cx + 6, mouthY + 10], [cx + 8, ty(0.04)], [cx - 9, ty(0.04)]], K.light, 0.55);
  P([[cx - 30, ty(0.06)], [cx + 30, ty(0.06)], [cx + 30, ty(-0.05)], [cx - 30, ty(-0.05)]], K.deep, 0.5);

  // ---- mouth
  const mw = S.fem ? 11 : 13;
  const sm = S.smile || 0;
  x.fillStyle = S.lips;
  x.beginPath();
  x.moveTo(cx - mw, mouthY + 0.5 - sm); x.lineTo(cx - 4, mouthY - 3); x.lineTo(cx, mouthY - 2); x.lineTo(cx + 4, mouthY - 3);
  x.lineTo(cx + mw, mouthY + 0.5 - sm); x.lineTo(cx, mouthY + 1); x.closePath(); x.fill();
  x.fillStyle = S.lipsLight;
  x.beginPath();
  x.moveTo(cx - mw + 1, mouthY + 1 - sm); x.lineTo(cx, mouthY + 1.5); x.lineTo(cx + mw - 1, mouthY + 1 - sm);
  x.lineTo(cx + 6, mouthY + (S.fem ? 6.5 : 5)); x.lineTo(cx - 6, mouthY + (S.fem ? 6.5 : 5)); x.closePath(); x.fill();
  x.strokeStyle = '#1c0f0a'; x.lineWidth = 1.3;
  x.beginPath(); x.moveTo(cx - mw, mouthY + 0.6 - sm); x.lineTo(cx, mouthY + 1.6); x.lineTo(cx + mw, mouthY + 0.6 - sm); x.stroke();
  P([[cx - 5, mouthY + 3], [cx + 3, mouthY + 3], [cx + 2, mouthY + 4.5], [cx - 4, mouthY + 4.5]], K.hot, 0.35);
  P([[cx - 8, mouthY + 6], [cx + 8, mouthY + 6], [cx + 5, mouthY + 9], [cx - 5, mouthY + 9]], K.deep, 0.45);

  // ---- eyes
  both((sd) => {
    const ex = cx + sd * eyeDX;
    x.fillStyle = '#bdb1a3';
    x.beginPath(); x.moveTo(ex - eyeW, eyeY + 0.5); x.lineTo(ex - 3, eyeY - 3.6); x.lineTo(ex + 3, eyeY - 3.8); x.lineTo(ex + eyeW, eyeY);
    x.lineTo(ex + 3, eyeY + 2.6); x.lineTo(ex - 3, eyeY + 2.8); x.closePath(); x.fill();
    x.save(); x.clip();
    x.fillStyle = S.eye; x.beginPath(); x.arc(ex - sd * 0.6, eyeY - 0.3, 4.1, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#0a0604'; x.beginPath(); x.arc(ex - sd * 0.6, eyeY - 0.3, 2, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(20,10,6,.55)'; x.fillRect(ex - eyeW, eyeY - 4.5, eyeW * 2, 2.4); // lid shadow on the eyeball
    x.restore();
    x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(ex - sd * 0.6 - 2, eyeY - 2, 1.2, 1.2);
    // heavy upper lid line, crease, lower lid
    x.strokeStyle = '#140a06'; x.lineWidth = S.fem ? 2.4 : 2;
    x.beginPath(); x.moveTo(ex - eyeW - 1, eyeY + 0.8); x.lineTo(ex - 3, eyeY - 4); x.lineTo(ex + 3, eyeY - 4.2); x.lineTo(ex + eyeW + 1, eyeY + 0.4); x.stroke();
    x.strokeStyle = K.deep; x.lineWidth = 1.1;
    x.beginPath(); x.moveTo(ex - eyeW + 1, eyeY - 4.5); x.lineTo(ex, eyeY - 7.5); x.lineTo(ex + eyeW, eyeY - 4); x.stroke();
    x.beginPath(); x.moveTo(ex - eyeW + 2, eyeY + 2.6); x.lineTo(ex, eyeY + 4); x.lineTo(ex + eyeW - 1, eyeY + 2.2); x.stroke();
    if ((S.age || 0) > 0.55) {
      x.globalAlpha = 0.6;
      x.beginPath(); x.moveTo(ex - 6, eyeY + 6); x.lineTo(ex + 5, eyeY + 6.5); x.stroke();
      x.beginPath(); x.moveTo(ex + sd * (eyeW + 1), eyeY - 1); x.lineTo(ex + sd * (eyeW + 6), eyeY - 3); x.moveTo(ex + sd * (eyeW + 1), eyeY + 1.5); x.lineTo(ex + sd * (eyeW + 6), eyeY + 3); x.stroke();
      x.globalAlpha = 1;
    }
    // brow: a thick tapered wedge, darker core
    const tilt = (S.browTilt || 0) * sd;
    const bw = S.fem ? 2.6 : 4;
    P([[ex - sd * 10, browY + 3 + tilt * 10], [ex - sd * 2, browY - 2.5], [ex + sd * 11, browY + 1 - tilt * 6], [ex + sd * 11, browY + 2.5 - tilt * 6], [ex - sd * 2, browY - 2.5 + bw], [ex - sd * 10, browY + 3 + bw + tilt * 10]], S.brow);
  });
  if ((S.age || 0) > 0.5) {
    x.strokeStyle = K.deep; x.lineWidth = 1; x.globalAlpha = 0.4;
    for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(cx - 20, ty(0.67 + i * 0.04)); x.lineTo(cx, ty(0.675 + i * 0.04)); x.lineTo(cx + 20, ty(0.67 + i * 0.04)); x.stroke(); }
    x.globalAlpha = 1;
  }
  if (S.glasses) {
    x.strokeStyle = '#151311'; x.lineWidth = 1.8;
    both((sd) => x.strokeRect(cx + sd * eyeDX - 11, eyeY - 6, 22, 12));
    x.beginPath(); x.moveTo(cx - 7, eyeY - 2); x.lineTo(cx + 7, eyeY - 2); x.stroke();
    x.fillStyle = 'rgba(210,230,240,.14)';
    both((sd) => x.fillRect(cx + sd * eyeDX - 10, eyeY - 5, 20, 10));
  }

  if (S.beard) paintBeard(x, S, cx, noseY, mouthY, jaw);
  x.restore();
  if (portrait) {
    // hair may only spill a little past the skull (more for long styles)
    x.save();
    x.beginPath();
    const long = S.style === 'bob' || S.style === 'dread' || S.style === 'braids';
    for (let t = 0; t <= 1.0001; t += 0.02) { const px = cx + W(t) + 3 + (t > 0.5 ? 2 : 0), py = ty(t) - (t > 0.97 ? 3 : 0); t ? x.lineTo(px, py) : x.moveTo(px, py); }
    for (let t = 1; t >= -0.0001; t -= 0.02) x.lineTo(cx - W(t) - 3 - (t > 0.5 ? 2 : 0), ty(t) - (t > 0.97 ? 3 : 0));
    x.closePath();
    if (long) {
      const bot = ty(S.style === 'bob' ? 0.14 : 0.25);
      x.moveTo(cx - W(0.75) - 4, ty(0.75)); x.lineTo(cx + W(0.75) + 4, ty(0.75));
      x.lineTo(cx + W(0.5) + 10, bot); x.lineTo(cx - W(0.5) - 10, bot); x.closePath();
    }
    x.clip();
    paintHair(x, S, cx);
    x.restore();
  } else paintHair(x, S, cx);

  // soften the plane edges a touch, then posterize lightly so it reads as painted, not airbrushed
  const out = document.createElement('canvas');
  out.width = FW; out.height = FH;
  const o = out.getContext('2d');
  o.filter = 'blur(0.45px)';
  o.drawImage(c, 0, 0);
  o.filter = 'none';
  const img = o.getImageData(0, 0, FW, FH);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (hash(i, 7.3) - 0.5) * 5;
    for (let ch = 0; ch < 3; ch++) img.data[i + ch] = Math.round((img.data[i + ch] + n) / 9) * 9;
  }
  if (portrait) { o.putImageData(img, 0, 0); return out; }
  return { w: FW, h: FH, data: img.data, frame: FRAME };
}

function stipple(x, color, alpha, density, region) {
  const [r, g, b] = hex(color);
  for (let i = 0; i < density; i++) {
    const px = region.x + hash(i, 1.7) * region.w, py = region.y + hash(i, 9.1) * region.h;
    if (!region.test(px, py)) continue;
    x.fillStyle = `rgba(${r},${g},${b},${alpha * (0.5 + hash(i, 3.3) * 0.5)})`;
    x.fillRect(px | 0, py | 0, 1, 1 + (hash(i, 5.5) > 0.6 ? 1 : 0));
  }
}

function paintBeard(x, S, cx, noseY, mouthY, jaw) {
  const col = S.beardColor || S.hair;
  if (S.beard === 'stubble') {
    stipple(x, col, 0.55, 2600, { x: cx - 50, y: noseY + 2, w: 100, h: 60, test: (px, py) => py > noseY + 4 && !(Math.abs(px - cx) < 13 && Math.abs(py - (mouthY + 1)) < 4) });
    return;
  }
  // full beard / goatee: a solid mass with a ragged edge, moustache joined to the chin
  x.fillStyle = col;
  x.beginPath();
  if (S.beard === 'full') {
    const top = ty(0.43);
    x.moveTo(cx - halfAt(0.45) - 2, top);
    x.lineTo(cx - halfAt(0.3) * jaw * 0.98, ty(0.3));
    x.quadraticCurveTo(cx - 30, ty(-0.02), cx, ty(-0.05));
    x.quadraticCurveTo(cx + 30, ty(-0.02), cx + halfAt(0.3) * jaw * 0.98, ty(0.3));
    x.lineTo(cx + halfAt(0.45) + 2, top);
    x.lineTo(cx + halfAt(0.4) - 8, top + 2);
    x.quadraticCurveTo(cx + 24, ty(0.3), cx + 15, mouthY - 3);
    x.quadraticCurveTo(cx, noseY + 2, cx - 15, mouthY - 3);
    x.quadraticCurveTo(cx - 24, ty(0.3), cx - halfAt(0.4) + 8, top + 2);
  } else {
    // goatee
    x.moveTo(cx - 15, mouthY + 1);
    x.quadraticCurveTo(cx - 16, mouthY - 4, cx - 8, noseY + 5);
    x.quadraticCurveTo(cx, noseY + 3, cx + 8, noseY + 5);
    x.quadraticCurveTo(cx + 16, mouthY - 4, cx + 15, mouthY + 1);
    x.quadraticCurveTo(cx + 12, ty(0.0), cx, ty(-0.02));
    x.quadraticCurveTo(cx - 12, ty(0.0), cx - 15, mouthY + 1);
  }
  x.closePath(); x.fill();
  // cut the mouth back out, re-draw lips over the beard
  x.fillStyle = S.lips;
  x.beginPath(); x.ellipse(cx, mouthY + 1.4, 11, 3.2, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = S.lipsLight;
  x.beginPath(); x.ellipse(cx, mouthY + 2.6, 9, 2, 0, 0, Math.PI); x.fill();
  x.strokeStyle = rgba('#1a0f0a', 0.85); x.lineWidth = 1;
  x.beginPath(); x.moveTo(cx - 10, mouthY + 1); x.quadraticCurveTo(cx, mouthY + 2, cx + 10, mouthY + 1); x.stroke();
  // texture
  stipple(x, S.hairLight || '#888', 0.35, 1600, { x: cx - 50, y: noseY, w: 100, h: 80, test: () => true });
  stipple(x, S.hairDark || '#111', 0.35, 1600, { x: cx - 50, y: noseY, w: 100, h: 80, test: () => true });
}

function paintHair(x, S, cx) {
  const style = S.style;
  const hl = ty(style === 'receding' ? 0.9 : style === 'swept' ? 0.83 : style === 'bob' ? 0.68 : 0.8);
  x.fillStyle = S.hair;
  x.beginPath();
  if (style === 'bob') {
    // fringe + long sides framing the face
    x.moveTo(cx - 70, ty(0.12)); x.lineTo(cx - halfAt(0.4) - 2, ty(0.14));
    x.quadraticCurveTo(cx - halfAt(0.6) + 4, ty(0.5), cx - 30, hl);
    x.lineTo(cx + 30, hl + 2);
    x.quadraticCurveTo(cx + halfAt(0.6) - 4, ty(0.5), cx + halfAt(0.4) + 2, ty(0.14));
    x.lineTo(cx + 70, ty(0.12)); x.lineTo(cx + 70, 0); x.lineTo(cx - 70, 0);
  } else {
    // hairline: higher at the centre, dipping at the temples, down into sideburns
    const temple = style === 'receding' ? ty(0.74) : ty(0.74);
    x.moveTo(cx - 70, 0); x.lineTo(cx - 70, ty(0.5));
    x.lineTo(cx - halfAt(0.5) + 1, ty(0.47));
    x.lineTo(cx - halfAt(0.62) + 3, ty(0.62));
    x.quadraticCurveTo(cx - 32, temple + 6, cx - 26, temple);
    if (style === 'receding') { x.quadraticCurveTo(cx - 20, ty(0.9), cx - 8, hl); x.quadraticCurveTo(cx, hl - 6, cx + 8, hl); x.quadraticCurveTo(cx + 20, ty(0.9), cx + 26, temple); }
    else { x.quadraticCurveTo(cx, hl - 6, cx + 26, temple); }
    x.quadraticCurveTo(cx + 32, temple + 6, cx + halfAt(0.62) - 3, ty(0.62));
    x.lineTo(cx + halfAt(0.5) - 1, ty(0.47));
    x.lineTo(cx + 70, ty(0.5)); x.lineTo(cx + 70, 0);
  }
  x.closePath(); x.fill();
  // shading: light on top-left, dark toward the edges
  x.save(); x.clip();
  const g = x.createRadialGradient(cx - 12, ty(0.93), 2, cx, ty(0.85), 60);
  g.addColorStop(0, rgba(S.hairLight, 0.7)); g.addColorStop(1, rgba(S.hairDark, 0.6));
  x.fillStyle = g; x.fillRect(0, 0, FW, FH);
  // strands
  for (let i = 0; i < 900; i++) {
    const px = hash(i, 2.2) * FW, py = hash(i, 8.8) * FH;
    x.fillStyle = rgba(hash(i, 4.4) > 0.5 ? S.hairLight : S.hairDark, 0.35);
    if (style === 'braids' || style === 'dread') x.fillRect(px | 0, py | 0, 1, 3);
    else if (style === 'swept' || style === 'bob') x.fillRect(px | 0, py | 0, 3, 1);
    else x.fillRect(px | 0, py | 0, 1, 1);
  }
  if (style === 'braids') {
    x.strokeStyle = rgba(S.hairDark, 0.9); x.lineWidth = 1;
    for (let i = -4; i <= 4; i++) { x.beginPath(); x.moveTo(cx + i * 8, hl); x.quadraticCurveTo(cx + i * 7, ty(0.92), cx + i * 4, 0); x.stroke(); }
  }
  x.restore();
  // soft shadow the hair casts on the forehead
  x.fillStyle = rgba(S.deep || S.shadow, 0.25);
  if (style !== 'bob') { x.beginPath(); x.ellipse(cx, hl + 3, 26, 3, 0, 0, Math.PI * 2); x.fill(); }
}

/* --------------------------------- wrap ---------------------------------- */

function sample(src, fx, fy) {
  const xx = Math.max(0, Math.min(src.w - 1.001, fx)), yy = Math.max(0, Math.min(src.h - 1.001, fy));
  const x0 = Math.floor(xx), y0 = Math.floor(yy), kx = xx - x0, ky = yy - y0;
  const i = (yy0, xx0) => (yy0 * src.w + xx0) * 4;
  const out = [0, 0, 0];
  for (let ch = 0; ch < 3; ch++) {
    const a = src.data[i(y0, x0) + ch], b = src.data[i(y0, x0 + 1) + ch];
    const cc = src.data[i(y0 + 1, x0) + ch], d = src.data[i(y0 + 1, x0 + 1) + ch];
    out[ch] = (a * (1 - kx) + b * kx) * (1 - ky) + (cc * (1 - kx) + d * kx) * ky;
  }
  return out;
}

const WRAP = 256;
const wrapCache = new Map();

/** Wrap-around head texture for a character kind (256x256 canvas). */
/** Project a frontal source through the skull into the wrap canvas c. */
function fillWrap(c, S, src) {
  const fr = src.frame;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(WRAP, WRAP);
  // side/back skin is sampled from the face itself so the wrap has no colour seam
  const sk1 = sample(src, fr.cx - fr.halfW * 0.5, fr.chinY - 0.38 * (fr.chinY - fr.crownY));
  const sk2 = sample(src, fr.cx + fr.halfW * 0.5, fr.chinY - 0.38 * (fr.chinY - fr.crownY));
  const skin = mix(mix(sk1, sk2, 0.5), hex(S.skin), 0.35);
  const skinDark = mix(skin, hex(S.shadow), 0.55);
  const hairC = hex(S.hair), hairL = hex(S.hairLight), hairD = hex(S.hairDark);
  for (let py = 0; py < WRAP; py++) {
    const t = 1 - (py + 0.5) / WRAP;
    for (let px = 0; px < WRAP; px++) {
      const a = angleFromU((px + 0.5) / WRAP);
      const p = headPoint(a, t);
      const fx = fr.cx + (p[0] / HEAD.halfW) * fr.halfW;
      const fy = fr.chinY - t * (fr.chinY - fr.crownY);
      const sampled = sample(src, fx, fy);
      // back / sides: hair above the per-angle hairline, skin below it
      const hs = hairStartT(a, S);
      const n = hash(px, py);
      const strand = hash(px, Math.floor(py / 3));
      let fill;
      if (t > hs) fill = S.style === 'short' || S.style === 'crop' || S.style === 'receding'
        ? mix(mix(hairC, skinDark, 0.18), strand > 0.6 ? hairL : hairD, 0.2 + n * 0.12) // close crop: skin reads through
        : mix(hairC, strand > 0.6 ? hairL : hairD, 0.35 + n * 0.2);
      else fill = mix(skin, skinDark, smooth(0.9, 2.2, Math.abs(a)) * 0.7 + n * 0.08);
      // blend the frontal into the fill as the surface turns away from the camera
      let k = smooth(1.0, 1.42, Math.abs(a));
      k = Math.max(k, smooth(0.95, 1.0, t) * (t > hs ? 1 : 0.5));
      const col = mix(sampled, fill, k);
      const o = (py * WRAP + px) * 4;
      img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Decode a JPEG data URL into a frontal source (async). */
function loadFrontal(url, halfW, done) {
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas');
    cv.width = FW; cv.height = FH;
    const cx = cv.getContext('2d');
    cx.drawImage(img, 0, 0, FW, FH);
    done({ w: FW, h: FH, data: cx.getImageData(0, 0, FW, FH).data, frame: { cx: 80, crownY: 10, chinY: 190, halfW } });
  };
  img.src = url;
}

/**
 * Wrap-around head texture for a character kind (256x256 canvas). Mo uses his sheet face (raw,
 * synchronous); NPCs use their face-bank crop, which decodes asynchronously — until it arrives the
 * painted fallback is shown, then the canvas and its texture are refreshed in place.
 */
export function headCanvas(kind) {
  if (wrapCache.has(kind)) return wrapCache.get(kind);
  const S = faceSpec(kind);
  const c = document.createElement('canvas');
  c.width = WRAP; c.height = WRAP;
  wrapCache.set(kind, c);
  if (S.source === 'reference') { fillWrap(c, S, referenceFrontal()); return c; }
  fillWrap(c, S, paintFrontal(S));
  const bank = NPC_FACES[kind];
  if (bank && typeof Image !== 'undefined') {
    loadFrontal(bank.frontal, bank.halfW, (src) => {
      fillWrap(c, S, src);
      const tx = texCache.get(kind);
      if (tx) tx.needsUpdate = true;
    });
  }
  return c;
}

const texCache = new Map();
export function headTexture(kind) {
  if (texCache.has(kind)) return texCache.get(kind);
  const t = new THREE.CanvasTexture(headCanvas(kind));
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(kind, t);
  return t;
}

/** Average skin / hair colours for matching body parts (ears, neck, hands). */
export function skinColor(kind) {
  const S = faceSpec(kind);
  return S.skin;
}
export function hairColors(kind) { const S = faceSpec(kind); return { hair: S.hair, light: S.hairLight, dark: S.hairDark }; }

/** Head-local (H units) position of a facial landmark, for portrait mood overlays. */
export function landmark(name) {
  const t = { eyeL: HEAD.eyeT, eyeR: HEAD.eyeT, mouth: HEAD.mouthT, brow: HEAD.browT, nose: HEAD.noseT }[name] ?? 0.5;
  let a = 0;
  if (name === 'eyeL' || name === 'eyeR') {
    const r = Math.min(1, (19.5 / FRAME.halfW) / ringAt(t).w); // frame px -> fraction of ring width
    a = Math.asin(Math.pow(r, 1 / 0.8)) * (name === 'eyeL' ? -1 : 1);
  }
  return headPoint(a, t);
}

/**
 * A painted HUD/phone portrait for an NPC, in the same style and framing as Mo's mood sheet:
 * dark backdrop, neck and shoulders in the character's shirt colour, the painted head on top.
 * Returns {canvas, eyes:[{x,y},{x,y}], scale} for mood overlays.
 */
const portraitCache = new Map();
export function paintPortrait(kind, shirt = '#5a5a52') {
  const key = kind + shirt;
  if (portraitCache.has(key)) return portraitCache.get(key);
  const S = faceSpec(kind);
  const K = skinRamp(S.skin);
  const PW = 180, PH = 240, ox = 10, oy = 14;
  const c = document.createElement('canvas');
  c.width = PW; c.height = PH;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, PW * 0.6, PH);
  g.addColorStop(0, '#3b3d39'); g.addColorStop(1, '#181917');
  x.fillStyle = g; x.fillRect(0, 0, PW, PH);
  for (let y = 0; y < PH; y += 3) { x.fillStyle = 'rgba(255,255,255,0.025)'; x.fillRect(0, y, PW, 1); }
  const chin = oy + FRAME.chinY;
  // shoulders: lit left plane, shaded right plane, collar
  const [sr, sg, sb] = hex(shirt);
  const sh = (k) => `rgb(${Math.min(255, sr * k) | 0},${Math.min(255, sg * k) | 0},${Math.min(255, sb * k) | 0})`;
  x.fillStyle = sh(1.05);
  x.beginPath(); x.moveTo(-10, PH); x.lineTo(4, chin + 22); x.lineTo(60, chin + 8); x.lineTo(90, chin + 14); x.lineTo(90, PH); x.fill();
  x.fillStyle = sh(0.72);
  x.beginPath(); x.moveTo(90, PH); x.lineTo(90, chin + 14); x.lineTo(120, chin + 8); x.lineTo(176, chin + 22); x.lineTo(190, PH); x.fill();
  // neck
  x.fillStyle = K.shadow;
  x.beginPath(); x.moveTo(62, chin - 30); x.lineTo(118, chin - 30); x.lineTo(122, chin + 14); x.lineTo(58, chin + 14); x.fill();
  x.fillStyle = K.mid; x.globalAlpha = 0.6;
  x.beginPath(); x.moveTo(64, chin - 20); x.lineTo(86, chin - 6); x.lineTo(84, chin + 12); x.lineTo(60, chin + 12); x.fill();
  x.globalAlpha = 1;
  x.fillStyle = sh(0.55);
  x.beginPath(); x.moveTo(56, chin + 10); x.lineTo(90, chin + 22); x.lineTo(124, chin + 10); x.lineTo(126, chin + 16); x.lineTo(90, chin + 28); x.lineTo(54, chin + 16); x.fill();
  // ears
  const eT = (HEAD.browT + HEAD.noseT) / 2;
  for (const sd of [-1, 1]) {
    x.fillStyle = sd < 0 ? K.mid : K.shadow;
    x.beginPath(); x.ellipse(ox + FRAME.cx + sd * (halfAt(eT) + 1), oy + ty(eT), 5, 12, sd * 0.15, 0, Math.PI * 2); x.fill();
    x.fillStyle = K.deep; x.beginPath(); x.ellipse(ox + FRAME.cx + sd * (halfAt(eT) + 1.5), oy + ty(eT), 2, 6, 0, 0, Math.PI * 2); x.fill();
  }
  x.drawImage(paintFrontal(S, true), ox, oy);
  const eyeY = oy + ty(HEAD.eyeT);
  const res = { canvas: c, eyes: [{ x: ox + FRAME.cx - 19.5, y: eyeY }, { x: ox + FRAME.cx + 19.5, y: eyeY }], scale: 9.5 };
  portraitCache.set(key, res);
  return res;
}
