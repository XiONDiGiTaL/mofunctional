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
  addison: {
    skin: '#d9b896', light: '#f0d6ba', shadow: '#a98666', deep: '#7a5c44',
    hair: '#bdbab2', hairLight: '#e2dfd8', hairDark: '#87847c', style: 'swept',
    brow: '#8b877e', eye: '#4b3f2c', lips: '#9a6455', lipsLight: '#bd8270',
    beard: 'full', beardColor: '#b6b3aa', age: 0.75, browTilt: -0.12, smile: 0.5,
  },
  kev: {
    skin: '#d2a77e', light: '#ecc8a2', shadow: '#a27652', deep: '#74513a',
    hair: '#c69a52', hairLight: '#e6c27c', hairDark: '#8e6832', style: 'crop',
    brow: '#8a6a36', eye: '#4a5a3a', lips: '#a06654', lipsLight: '#bf8068', age: 0.2, jaw: 1.06,
  },
  rae: {
    skin: '#e6c9ad', light: '#f7e2cc', shadow: '#b8957a', deep: '#8a6a52',
    hair: '#1f1a20', hairLight: '#3b3340', hairDark: '#0f0c10', style: 'bob',
    brow: '#2e2426', eye: '#3e3530', lips: '#a8545a', lipsLight: '#cf7a7e', age: 0.25, fem: true, jaw: 0.92,
  },
  dale: {
    skin: '#c4a386', light: '#dfc4a6', shadow: '#94765c', deep: '#6a5040',
    hair: '#a3a29c', hairLight: '#c8c7c0', hairDark: '#787771', style: 'receding',
    brow: '#86847c', eye: '#4a463a', lips: '#8e6456', lipsLight: '#a97c6a',
    beard: 'stubble', beardColor: '#8f8e88', age: 0.95, browTilt: 0.1,
  },
  dex: {
    skin: '#7d5538', light: '#9c7050', shadow: '#553520', deep: '#3a2312',
    hair: '#22170f', hairLight: '#3f2c1f', hairDark: '#120b06', style: 'dread',
    brow: '#1c120c', eye: '#2c2016', lips: '#6a3e30', lipsLight: '#8a5644',
    beard: 'full', beardColor: '#221710', age: 0.45, browTilt: -0.05,
  },
  nia: {
    skin: '#a97a52', light: '#c79870', shadow: '#7c5232', deep: '#56371f',
    hair: '#24170f', hairLight: '#44301f', hairDark: '#130c07', style: 'braids',
    brow: '#24170f', eye: '#2f2218', lips: '#7d4436', lipsLight: '#a6604e', age: 0.3, fem: true, jaw: 0.94,
  },
  miguel: {
    skin: '#b38158', light: '#cf9d72', shadow: '#845a38', deep: '#5c3d24',
    hair: '#2a2018', hairLight: '#463628', hairDark: '#16100b', style: 'short',
    brow: '#2a2018', eye: '#3a2a1c', lips: '#7f4d3c', lipsLight: '#a06450',
    beard: 'full', beardColor: '#2c2219', age: 0.55,
  },
  habib: {
    skin: '#a87c54', light: '#c49870', shadow: '#7c5634', deep: '#563a22',
    hair: '#231a12', hairLight: '#3c2e22', hairDark: '#120d09', style: 'short',
    brow: '#20160e', eye: '#33241a', lips: '#7a4a3a', lipsLight: '#9a6250',
    beard: 'full', beardColor: '#2a2018', age: 0.5, browTilt: -0.04,
  },
  homeless: {
    skin: '#8a6141', light: '#a67a58', shadow: '#5f3f28', deep: '#422a18',
    hair: '#4a4038', hairLight: '#6a5e54', hairDark: '#2c2620', style: 'receding',
    brow: '#3a302a', eye: '#3a2c20', lips: '#6e4434', lipsLight: '#8c5a46',
    beard: 'full', beardColor: '#5a5048', age: 0.85, browTilt: 0.12,
  },
  junkie: {
    skin: '#b0906e', light: '#c8a886', shadow: '#84684e', deep: '#5c4836',
    hair: '#33291f', hairLight: '#4e4032', hairDark: '#1c1610', style: 'crop',
    brow: '#30261c', eye: '#3a3226', lips: '#86605a', lipsLight: '#a07a70',
    beard: 'stubble', beardColor: '#3a3024', age: 0.5, gaunt: true, browTilt: 0.15,
  },
  clerk: {
    skin: '#c79e76', light: '#e1bb92', shadow: '#987252', deep: '#6c4e36',
    hair: '#362b20', hairLight: '#524234', hairDark: '#1e1711', style: 'crop',
    brow: '#30251a', eye: '#3a2c1e', lips: '#93604c', lipsLight: '#b07a62', age: 0.3, glasses: true,
  },
};

export function faceSpec(kind) { return FACE_SPECS[kind] || FACE_SPECS.kev; }

/** Where hair starts (t) at a given angle, for the back/side fill. */
function hairStartT(a, S) {
  const side = S.sideT ?? { bob: 0.2, dread: 0.5, braids: 0.56, receding: 0.6, swept: 0.6 }[S.style] ?? 0.6;
  const back = S.backT ?? { bob: 0.16, dread: 0.26, braids: 0.34, receding: 0.4, swept: 0.38 }[S.style] ?? 0.4;
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
const FRAME = { cx: 80, crownY: 10, chinY: 190, halfW: 48 };
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

/**
 * Paint a frontal portrait in the reference's style: soft painted planes, key light from the
 * upper left, recessed eyes under a brow shadow, a nose that casts a shadow, real lips.
 */
function paintFrontal(S) {
  const c = document.createElement('canvas');
  c.width = FW; c.height = FH;
  const x = c.getContext('2d');
  const cx = FRAME.cx;
  const jaw = S.jaw ?? 1;
  const eyeY = ty(HEAD.eyeT), browY = ty(HEAD.browT), noseY = ty(HEAD.noseT), mouthY = ty(HEAD.mouthT);
  const eyeDX = 17, eyeW = 7.5;

  // ---- base: the whole frame in shadow skin, then the face silhouette
  x.fillStyle = S.shadow; x.fillRect(0, 0, FW, FH);
  const outline = [];
  for (let t = 0; t <= 1.0001; t += 0.02) outline.push([cx + halfAt(t) * (t < 0.35 ? jaw : 1), ty(t)]);
  x.beginPath();
  outline.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
  for (let i = outline.length - 1; i >= 0; i--) x.lineTo(2 * cx - outline[i][0], outline[i][1]);
  x.closePath();
  x.fillStyle = S.skin; x.fill();
  x.save(); x.clip();

  // key light upper-left, falloff to the right and under the jaw
  let g = x.createRadialGradient(cx - 14, ty(0.62), 4, cx - 6, ty(0.5), 80);
  g.addColorStop(0, rgba(S.light, 0.75)); g.addColorStop(0.55, rgba(S.light, 0.12)); g.addColorStop(1, rgba(S.shadow, 0.5));
  x.fillStyle = g; x.fillRect(0, 0, FW, FH);
  g = x.createLinearGradient(cx + 10, 0, cx + 50, 0);
  g.addColorStop(0, rgba(S.shadow, 0)); g.addColorStop(1, rgba(S.deep || S.shadow, 0.7));
  x.fillStyle = g; x.fillRect(0, 0, FW, FH);
  g = x.createLinearGradient(cx - 50, 0, cx - 30, 0);
  g.addColorStop(0, rgba(S.shadow, 0.55)); g.addColorStop(1, rgba(S.shadow, 0));
  x.fillStyle = g; x.fillRect(0, 0, FW, FH);

  // cheekbone planes and hollows
  for (const sd of [-1, 1]) {
    x.fillStyle = rgba(S.shadow, S.gaunt ? 0.5 : 0.28);
    x.beginPath(); x.ellipse(cx + sd * 30, ty(0.33), 9, 15, sd * 0.25, 0, Math.PI * 2); x.fill();
    x.fillStyle = rgba(S.light, 0.25);
    x.beginPath(); x.ellipse(cx + sd * 27, ty(0.45), 9, 5, sd * -0.3, 0, Math.PI * 2); x.fill();
  }
  // jaw shadow + under-chin
  g = x.createLinearGradient(0, ty(0.16), 0, ty(0));
  g.addColorStop(0, rgba(S.shadow, 0)); g.addColorStop(1, rgba(S.deep || S.shadow, 0.55));
  x.fillStyle = g; x.fillRect(0, ty(0.16), FW, FH);
  // chin pad highlight
  x.fillStyle = rgba(S.light, 0.3);
  x.beginPath(); x.ellipse(cx - 2, ty(0.08), 8, 5, 0, 0, Math.PI * 2); x.fill();
  // forehead highlight
  x.fillStyle = rgba(S.light, 0.35);
  x.beginPath(); x.ellipse(cx - 6, ty(0.7), 18, 9, 0, 0, Math.PI * 2); x.fill();

  // ---- brow shelf shadow + eye sockets
  for (const sd of [-1, 1]) {
    const ex = cx + sd * eyeDX;
    g = x.createRadialGradient(ex, eyeY, 1, ex, eyeY, 14);
    g.addColorStop(0, rgba(S.deep || S.shadow, 0.9)); g.addColorStop(1, rgba(S.shadow, 0));
    x.fillStyle = g; x.beginPath(); x.ellipse(ex, eyeY - 1.5, 14, 9, 0, 0, Math.PI * 2); x.fill();
  }
  // nose: bridge light, side shadow, wings, tip, cast shadow
  x.fillStyle = rgba(S.light, 0.55);
  x.fillRect(cx - 2.5, eyeY - 2, 3, noseY - eyeY - 4);
  x.fillStyle = rgba(S.deep || S.shadow, 0.6);
  x.beginPath(); x.moveTo(cx + 1, eyeY); x.lineTo(cx + 6, noseY - 4); x.lineTo(cx + 9, noseY + 1); x.lineTo(cx + 2, noseY - 2); x.closePath(); x.fill();
  for (const sd of [-1, 1]) {
    x.fillStyle = rgba(S.shadow, 0.6);
    x.beginPath(); x.ellipse(cx + sd * 6.5, noseY - 1.5, 4, 3.4, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = rgba(S.deep || '#2a1a10', 0.85);
    x.beginPath(); x.ellipse(cx + sd * 4, noseY + 0.5, 2.2, 1.2, sd * 0.3, 0, Math.PI * 2); x.fill();
  }
  x.fillStyle = rgba(S.light, 0.6);
  x.beginPath(); x.ellipse(cx - 0.5, noseY - 3, 3.4, 2.6, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = rgba(S.deep || S.shadow, 0.35);
  x.beginPath(); x.ellipse(cx + 1, noseY + 4, 7, 2.2, 0, 0, Math.PI * 2); x.fill();
  // nasolabial folds
  x.strokeStyle = rgba(S.deep || S.shadow, 0.25 + (S.age || 0) * 0.3); x.lineWidth = 1.2;
  for (const sd of [-1, 1]) {
    x.beginPath(); x.moveTo(cx + sd * 9, noseY); x.quadraticCurveTo(cx + sd * 15, mouthY - 2, cx + sd * 15, mouthY + 6); x.stroke();
  }

  // ---- mouth
  const mw = S.fem ? 11 : 12.5;
  const smile = S.smile || 0;
  x.fillStyle = S.lips;
  x.beginPath();
  x.moveTo(cx - mw, mouthY + 0.5 - smile); x.quadraticCurveTo(cx - 4, mouthY - 3.2, cx, mouthY - 1.8);
  x.quadraticCurveTo(cx + 4, mouthY - 3.2, cx + mw, mouthY + 0.5 - smile); x.quadraticCurveTo(cx, mouthY + 1.2, cx - mw, mouthY + 0.5 - smile);
  x.fill();
  x.fillStyle = S.lipsLight;
  x.beginPath();
  x.moveTo(cx - mw + 1.5, mouthY + 0.8 - smile); x.quadraticCurveTo(cx, mouthY + (S.fem ? 6.5 : 5.2), cx + mw - 1.5, mouthY + 0.8 - smile);
  x.quadraticCurveTo(cx, mouthY + 1.4, cx - mw + 1.5, mouthY + 0.8 - smile); x.fill();
  x.strokeStyle = rgba(S.deep || '#301a12', 0.9); x.lineWidth = 1;
  x.beginPath(); x.moveTo(cx - mw, mouthY + 0.6 - smile); x.quadraticCurveTo(cx, mouthY + 1.6, cx + mw, mouthY + 0.6 - smile); x.stroke();
  x.fillStyle = rgba(S.light, 0.45);
  x.beginPath(); x.ellipse(cx - 1, mouthY + 3.6, 4, 1, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = rgba(S.deep || S.shadow, 0.35);
  x.beginPath(); x.ellipse(cx, mouthY + 8, 6, 2, 0, 0, Math.PI * 2); x.fill();
  // philtrum
  x.fillStyle = rgba(S.shadow, 0.35); x.fillRect(cx - 1.5, noseY + 4, 3, mouthY - noseY - 6);

  // ---- eyes
  for (const sd of [-1, 1]) {
    const ex = cx + sd * eyeDX;
    // sclera (almond, tinted, small)
    x.fillStyle = '#c4b8aa';
    x.beginPath();
    x.moveTo(ex - eyeW, eyeY); x.quadraticCurveTo(ex, eyeY - 4.4, ex + eyeW, eyeY);
    x.quadraticCurveTo(ex, eyeY + 3.4, ex - eyeW, eyeY); x.fill();
    // iris + pupil, looking slightly forward
    x.save(); x.clip();
    x.fillStyle = S.eye; x.beginPath(); x.arc(ex - sd * 0.5, eyeY - 0.2, 3.9, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#0c0806'; x.beginPath(); x.arc(ex - sd * 0.5, eyeY - 0.2, 1.8, 0, Math.PI * 2); x.fill();
    x.fillStyle = rgba(S.deep || '#2a1a10', 0.45); x.fillRect(ex - eyeW, eyeY - 4.5, eyeW * 2, 2.2);
    x.restore();
    x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(ex - sd * 0.5 - 1.5, eyeY - 1.6, 1, 1);
    // upper lid line + crease, lower lid
    x.strokeStyle = rgba(S.deep || '#1a100a', 0.95); x.lineWidth = S.fem ? 2.2 : 1.9;
    x.beginPath(); x.moveTo(ex - eyeW - 0.5, eyeY + 0.3); x.quadraticCurveTo(ex, eyeY - 4.8, ex + eyeW + 0.5, eyeY + 0.3); x.stroke();
    x.strokeStyle = rgba(S.deep || S.shadow, 0.45); x.lineWidth = 1;
    x.beginPath(); x.moveTo(ex - eyeW + 1, eyeY - 4); x.quadraticCurveTo(ex, eyeY - 7.5, ex + eyeW, eyeY - 3.5); x.stroke();
    x.strokeStyle = rgba(S.shadow, 0.6);
    x.beginPath(); x.moveTo(ex - eyeW + 1.5, eyeY + 1.8); x.quadraticCurveTo(ex, eyeY + 4, ex + eyeW - 1, eyeY + 1.6); x.stroke();
    if (S.age > 0.6) {
      x.strokeStyle = rgba(S.deep || S.shadow, 0.35);
      x.beginPath(); x.moveTo(ex - 5, eyeY + 5); x.quadraticCurveTo(ex, eyeY + 7, ex + 5, eyeY + 5); x.stroke();
      x.beginPath(); x.moveTo(ex + sd * (eyeW + 1), eyeY - 1); x.lineTo(ex + sd * (eyeW + 5), eyeY - 3); x.moveTo(ex + sd * (eyeW + 1), eyeY + 1); x.lineTo(ex + sd * (eyeW + 5), eyeY + 2); x.stroke();
    }
    // brow: tapered wedge
    const tilt = (S.browTilt || 0) * sd;
    x.fillStyle = S.brow;
    x.beginPath();
    x.moveTo(ex - sd * 9, browY + 2 + tilt * 10);
    x.quadraticCurveTo(ex, browY - 4.5, ex + sd * 10, browY + 1.5 - tilt * 6);
    x.lineTo(ex + sd * 10, browY + 3.5 - tilt * 6);
    x.quadraticCurveTo(ex, browY + 0.3, ex - sd * 9, browY + 6.5 + tilt * 10);
    x.closePath(); x.fill();
  }
  if (S.age > 0.5) {
    x.strokeStyle = rgba(S.deep || S.shadow, 0.22); x.lineWidth = 1;
    for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(cx - 18, ty(0.66 + i * 0.035)); x.quadraticCurveTo(cx, ty(0.675 + i * 0.035), cx + 18, ty(0.66 + i * 0.035)); x.stroke(); }
  }
  if (S.glasses) {
    x.strokeStyle = '#1c1a18'; x.lineWidth = 1.6;
    for (const sd of [-1, 1]) { x.strokeRect(cx + sd * eyeDX - 10, eyeY - 6, 20, 11); }
    x.beginPath(); x.moveTo(cx - 7, eyeY - 2); x.lineTo(cx + 7, eyeY - 2); x.stroke();
    x.fillStyle = 'rgba(200,220,230,.12)';
    for (const sd of [-1, 1]) x.fillRect(cx + sd * eyeDX - 9, eyeY - 5, 18, 9);
  }

  // ---- beard
  if (S.beard) paintBeard(x, S, cx, noseY, mouthY, jaw);
  x.restore();

  // ---- hair (may extend past the face outline)
  paintHair(x, S, cx);

  // painterly soften + grain
  const out = document.createElement('canvas');
  out.width = FW; out.height = FH;
  const o = out.getContext('2d');
  o.filter = 'blur(0.55px)';
  o.drawImage(c, 0, 0);
  o.filter = 'none';
  const img = o.getImageData(0, 0, FW, FH);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (hash(i, 7.3) - 0.5) * 9;
    // contrast lift so painted faces sit next to Mo's photographic one
    for (let ch = 0; ch < 3; ch++) img.data[i + ch] = (img.data[i + ch] - 118) * 1.18 + 112 + n;
  }
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
export function headCanvas(kind) {
  if (wrapCache.has(kind)) return wrapCache.get(kind);
  const S = faceSpec(kind);
  const src = S.source === 'reference' ? referenceFrontal() : paintFrontal(S);
  const fr = src.frame;
  const c = document.createElement('canvas');
  c.width = WRAP; c.height = WRAP;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(WRAP, WRAP);
  const skin = S.source === 'reference' ? sample(src, fr.cx - 30, fr.chinY - 0.42 * (fr.chinY - fr.crownY)) : hex(S.skin);
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
      if (t > hs) fill = mix(hairC, strand > 0.6 ? hairL : hairD, 0.35 + n * 0.2);
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
  wrapCache.set(kind, c);
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
    const r = Math.min(1, (17 / FRAME.halfW) / ringAt(t).w); // frame px -> fraction of ring width
    a = Math.asin(Math.pow(r, 1 / 0.8)) * (name === 'eyeL' ? -1 : 1);
  }
  return headPoint(a, t);
}
