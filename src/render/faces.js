/**
 * Portrait painter.
 *
 * Every character face in the game is drawn here, at 128x208 (the aspect of the head's front
 * face), in one consistent style: flat painterly planes, light from the upper left, a warm
 * skin base with two shadow tones and one highlight, shaped hair masses, and a face built
 * from the same landmarks for everyone so the cast reads as one art direction.
 *
 * The portraits are baked into the front face of the skull, so they are painted as a head,
 * not as a bust on a background: no frame, and the hairline / jaw / temples are positioned to
 * land where the head geometry turns the corner.
 */
import * as THREE from '../../vendor/three.module.js';

const W = 128;
// The head's front face is 0.172 x 0.238, i.e. 0.72 — nearly square-ish, not the 0.615 of a
// 128x208 canvas. Painting at 128x178 and keeping the landmark maths in 208-space (below)
// means the portrait is never stretched sideways when it lands on the skull.
const H = 178;
const GH = 208;

const CX = W / 2;

const cache = new Map();

/* ------------------------------- primitives ------------------------------- */

function poly(ctx, pts, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}

function ell(ctx, x, y, rx, ry, color, rot = 0) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

function box(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Soft rectangle fade, used for cheek/jaw shading that must not band. */
function fade(ctx, x, y, w, h, color, topAlpha, bottomAlpha) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, withAlpha(color, topAlpha));
  g.addColorStop(1, withAlpha(color, bottomAlpha));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function withAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function grain(ctx) {
  for (let i = 0; i < 2200; i++) {
    const x = Math.floor(Math.random() * W);
    const y = Math.floor(Math.random() * GH);
    const v = Math.random() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${0.03 + Math.random() * 0.05})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

/* --------------------------------- specs ---------------------------------- */

/**
 * One entry per character. Colours follow the reference bank: warm mid-tone skin with a
 * distinctly cooler shadow tone, hair in two values plus a highlight, and a brow/lip colour
 * that belongs to the same family as the skin rather than being pure black.
 */
const SPECS = {
  // the antagonist priest — white suit, swept grey hair, full grey beard
  addison: {
    skin: '#d9bd9f', light: '#efd8bd', shadow: '#ab8a6b', deep: '#7d5f45',
    hair: '#b9b6ad', hairLight: '#dcd9d0', hairDark: '#8b877e', hairStyle: 'swept',
    brow: '#6e6a60', eye: '#4b3f2c', lips: '#8f5f52', lipsLight: '#b47a6a',
    beard: { color: '#b3b0a7', light: '#d2cfc6', dark: '#8a8679', style: 'full' },
    age: 0.75, jaw: 1.04,
  },
  // Mo — medium-dark skin, short black hair, goatee; the HUD portrait is painted from this
  mo: {
    skin: '#8f6446', light: '#ac8060', shadow: '#5f3f28', deep: '#3f2817',
    hair: '#201812', hairLight: '#3a2c22', hairDark: '#120c09', hairStyle: 'crop',
    brow: '#1d1410', eye: '#33241a', lips: '#6b4234', lipsLight: '#8d5744',
    beard: { color: '#241a12', light: '#3d2c20', dark: '#140d09', style: 'full' },
    age: 0.4, jaw: 1.02, exposure: 1.28,
  },
  // the neighbour — short blond crop, square jaw, clean shaven
  kev: {
    skin: '#c9a078', light: '#e3c39c', shadow: '#9c7350', deep: '#6f4e34',
    hair: '#c49a52', hairLight: '#e0bd76', hairDark: '#8f6a34', hairStyle: 'crop',
    brow: '#6b5027', eye: '#3f4a33', lips: '#8c5b48', lipsLight: '#ad7458',
    beard: null, age: 0.25, jaw: 1.1,
  },
  // the bartender — black bob with a fringe, pale, sharp
  rae: {
    skin: '#e2c4a7', light: '#f5dcc3', shadow: '#b3906f', deep: '#846246',
    hair: '#221d22', hairLight: '#3d3540', hairDark: '#121014', hairStyle: 'bob',
    brow: '#3a2a2a', eye: '#4a3b34', lips: '#a3615c', lipsLight: '#c4807a',
    beard: null, age: 0.3, jaw: 0.94,
  },
  // the old man — receding grey hair, hollow cheeks, deep lines
  dale: {
    skin: '#c1a184', light: '#dcc0a2', shadow: '#93745a', deep: '#6a5040',
    hair: '#9d9c96', hairLight: '#c2c1ba', hairDark: '#75746e', hairStyle: 'receding',
    brow: '#7c7a72', eye: '#4a4438', lips: '#8a6053', lipsLight: '#a87a68',
    beard: { color: '#9d9c96', light: '#c0bfb8', dark: '#74736d', style: 'stubble' },
    age: 0.95, jaw: 0.98,
  },
  // the dealer — dark skin, dreadlocks, heavy brow, full beard
  dex: {
    skin: '#8a6142', light: '#a87a58', shadow: '#5f3d26', deep: '#412a16',
    hair: '#241812', hairLight: '#443026', hairDark: '#150e0a', hairStyle: 'dread',
    brow: '#1f150f', eye: '#2f231a', lips: '#734636', lipsLight: '#945e46',
    beard: { color: '#2a1c14', light: '#453024', dark: '#170f0b', style: 'full' },
    age: 0.45, jaw: 1.06, exposure: 1.3,
  },
  // the night-shift nurse — warm brown skin, braided hair pulled back
  nia: {
    skin: '#ac805a', light: '#c99a70', shadow: '#805534', deep: '#583a21',
    hair: '#2a1a12', hairLight: '#4a3122', hairDark: '#160e09', hairStyle: 'braids',
    brow: '#2b1b12', eye: '#33251b', lips: '#7b4739', lipsLight: '#a0604c',
    beard: null, age: 0.3, jaw: 0.96,
  },
};

const FALLBACK = SPECS.kev;

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

/** A full palette from four values, for the walk-on characters. Keeps one art direction. */
function derived({ skin, hair, hairStyle = 'crop', beard = null, age = 0.35, jaw = 1 }) {
  return {
    skin, light: mix(skin, '#ffffff', 0.22), shadow: mix(skin, '#000000', 0.34),
    deep: mix(skin, '#000000', 0.55), hair, hairLight: mix(hair, '#ffffff', 0.26),
    hairDark: mix(hair, '#000000', 0.30), hairStyle,
    brow: mix(hair, '#000000', 0.20), eye: '#2f2318',
    lips: mix(skin, '#7a3a30', 0.5), lipsLight: mix(skin, '#a05a48', 0.4),
    beard: beard
      ? { color: mix(hair, skin, 0.25), light: mix(hair, skin, 0.45), dark: mix(hair, '#000000', 0.30), style: beard }
      : null,
    age, jaw,
  };
}

Object.assign(SPECS, {
  miguel: derived({ skin: '#b07f54', hair: '#2b2118', hairStyle: 'short', beard: 'full', age: 0.5 }),
  habib: derived({ skin: '#a87c52', hair: '#241a12', hairStyle: 'short', beard: 'full', age: 0.45 }),
  homeless: derived({ skin: '#87603f', hair: '#3a302a', hairStyle: 'receding', beard: 'full', age: 0.9 }),
  junkie: derived({ skin: '#a8835f', hair: '#2f2620', hairStyle: 'crop', beard: 'stubble', age: 0.6 }),
  clerk: derived({ skin: '#c49b74', hair: '#342a20', hairStyle: 'crop', age: 0.25 }),
});

function spec(kind, palette = {}) {
  const base = SPECS[kind] || FALLBACK;
  return {
    ...base,
    skin: palette.skin || base.skin,
    hair: palette.hair || base.hair,
    hairLight: palette.hairLight || base.hairLight,
    hairDark: palette.hairDark || base.hairDark,
  };
}

/* -------------------------------- painting -------------------------------- */

const EYE_Y = 92;
const EYE_DX = 27;
const NOSE_Y = 130;
const MOUTH_Y = 152;
const CHIN_Y = 184;
const HAIRLINE = 48;

function paintBase(ctx, S) {
  box(ctx, 0, 0, W, H, S.skin);
  // light from the upper left: the right third sits in shade, the left temple catches light
  box(ctx, Math.round(W * 0.72), 0, Math.round(W * 0.28), H, withAlpha(S.shadow, 0.34));
  box(ctx, Math.round(W * 0.86), 0, Math.round(W * 0.14), H, withAlpha(S.deep, 0.28));
  box(ctx, 0, 0, 10, H, withAlpha(S.deep, 0.18));
  box(ctx, 6, 0, 8, H, withAlpha(S.light, 0.14));
  // brow ridge and forehead
  fade(ctx, 0, HAIRLINE - 6, W, 34, S.shadow, 0.28, 0.02);
  // cheekbone light and hollow
  ell(ctx, 40, 122, 15, 22, withAlpha(S.light, 0.2));
  ell(ctx, 92, 126, 13, 26, withAlpha(S.shadow, 0.22));
  // jaw and chin shade, then the neck falls away into shadow
  fade(ctx, 0, 168, W, 32, S.deep, 0.24, 0.52);
  fade(ctx, 0, 196, W, 12, '#120b07', 0.52, 0.86);
}

function paintEyes(ctx, S) {
  for (const s of [-1, 1]) {
    const ex = CX + s * EYE_DX;
    // socket
    ell(ctx, ex, EYE_Y - 3, 18, 12, withAlpha(S.deep, 0.26));
    // sclera
    ell(ctx, ex, EYE_Y, 13, 6, '#ded3c0');
    ell(ctx, ex - s * 2, EYE_Y + 1, 12, 4.6, '#efe6d6');
    // iris + pupil
    ell(ctx, ex + s * 1, EYE_Y, 5.2, 5.2, S.eye);
    ell(ctx, ex + s * 1, EYE_Y + 0.5, 2.6, 2.8, '#100c09');
    ell(ctx, ex - 2, EYE_Y - 2, 1.6, 1.6, '#f3ecdd');
    // upper lid shadow and lash line
    poly(ctx, [[ex - 14, EYE_Y - 5], [ex + 14, EYE_Y - 6], [ex + 12, EYE_Y + 1], [ex - 13, EYE_Y + 1]],
      withAlpha(S.deep, 0.5));
    box(ctx, ex - 13, EYE_Y - 6, 26, 2, withAlpha(S.deep, 0.55));
    // lower lid
    box(ctx, ex - 11, EYE_Y + 6, 22, 1, withAlpha(S.shadow, 0.5));
    // brow: thicker at the inner end, angled up and out
    const by = EYE_Y - 18;
    poly(ctx, [
      [ex - s * 16, by + 4], [ex + s * 15, by - 2], [ex + s * 15, by + 3], [ex - s * 16, by + 9],
    ], S.brow);
  }
}

function paintNose(ctx, S) {
  // bridge highlight, then the shadow plane on the away side
  poly(ctx, [[CX - 7, EYE_Y - 4], [CX - 1, EYE_Y - 2], [CX - 2, NOSE_Y], [CX - 8, NOSE_Y - 2]],
    withAlpha(S.light, 0.24));
  poly(ctx, [[CX + 2, EYE_Y - 2], [CX + 8, EYE_Y], [CX + 10, NOSE_Y - 2], [CX + 2, NOSE_Y]],
    withAlpha(S.shadow, 0.42));
  // tip, nostrils, and the shadow the nose casts
  ell(ctx, CX, NOSE_Y - 4, 9, 7, withAlpha(S.shadow, 0.3));
  ell(ctx, CX - 6, NOSE_Y + 1, 3, 2.2, withAlpha(S.deep, 0.75));
  ell(ctx, CX + 6, NOSE_Y + 1, 3, 2.2, withAlpha(S.deep, 0.75));
  box(ctx, CX - 9, NOSE_Y + 4, 18, 2, withAlpha(S.deep, 0.35));
}

function paintMouth(ctx, S) {
  // upper lip in shade, lower lip catching light, plus the corner shadows
  poly(ctx, [[CX - 13, MOUTH_Y - 2], [CX, MOUTH_Y - 5], [CX + 13, MOUTH_Y - 2], [CX, MOUTH_Y + 1]],
    S.lips);
  poly(ctx, [[CX - 12, MOUTH_Y + 1], [CX, MOUTH_Y - 1], [CX + 12, MOUTH_Y + 1], [CX, MOUTH_Y + 8]],
    S.lipsLight);
  box(ctx, CX - 13, MOUTH_Y, 26, 1, withAlpha(S.deep, 0.6));
  ell(ctx, CX - 14, MOUTH_Y + 1, 2, 1.6, withAlpha(S.deep, 0.4));
  ell(ctx, CX + 14, MOUTH_Y + 1, 2, 1.6, withAlpha(S.deep, 0.4));
  // chin crease
  box(ctx, CX - 8, CHIN_Y - 6, 16, 1, withAlpha(S.shadow, 0.35));
}

function paintAge(ctx, S) {
  if (S.age < 0.4) return;
  const a = S.age;
  // nasolabial folds
  poly(ctx, [[CX - 20, NOSE_Y + 4], [CX - 14, NOSE_Y + 6], [CX - 12, MOUTH_Y + 6], [CX - 18, MOUTH_Y + 4]],
    withAlpha(S.shadow, 0.3 * a));
  poly(ctx, [[CX + 20, NOSE_Y + 4], [CX + 14, NOSE_Y + 6], [CX + 12, MOUTH_Y + 6], [CX + 18, MOUTH_Y + 4]],
    withAlpha(S.shadow, 0.3 * a));
  // forehead lines
  for (let i = 0; i < 2; i++) {
    box(ctx, CX - 22 + i * 3, HAIRLINE + 12 + i * 7, 44 - i * 6, 1, withAlpha(S.shadow, 0.24 * a));
  }
  // crow's feet
  for (const s of [-1, 1]) {
    const ex = CX + s * (EYE_DX + 13);
    for (let i = 0; i < 2; i++) {
      box(ctx, ex, EYE_Y - 2 + i * 4, s > 0 ? 6 : -6, 1, withAlpha(S.shadow, 0.3 * a));
    }
  }
  // hollow under the eyes
  for (const s of [-1, 1]) ell(ctx, CX + s * EYE_DX, EYE_Y + 12, 12, 4, withAlpha(S.deep, 0.22 * a));
}

function paintHair(ctx, S) {
  const style = S.hairStyle;
  const fringeBottom = style === 'bob' ? HAIRLINE + 14 : HAIRLINE;
  const sideBottom = style === 'bob' ? 138 : style === 'dread' ? 178 : style === 'receding' ? 110 : 104;

  // the mass sits over the skull; the sides wrap past the temples
  if (style === 'receding') {
    // crown hair with a widow's peak and bare temples
    poly(ctx, [[8, HAIRLINE - 8], [30, 22], [CX - 6, 8], [CX + 10, 10], [W - 24, 30], [W - 8, HAIRLINE + 4],
      [W - 26, HAIRLINE - 6], [CX + 4, 34], [26, HAIRLINE - 14]], S.hair);
    box(ctx, 0, HAIRLINE - 4, 12, 40, withAlpha(S.hair, 0.7));
    box(ctx, W - 12, HAIRLINE - 4, 12, 34, withAlpha(S.hair, 0.6));
  } else {
    poly(ctx, [[0, fringeBottom + 18], [0, 26], [18, 6], [W - 18, 6], [W, 26], [W, fringeBottom + 18],
      [W - 11, sideBottom], [W - 24, fringeBottom - 2], [24, fringeBottom - 2], [11, sideBottom]], S.hair);
    // sweep / bob fringe covering the top of the forehead
    poly(ctx, [[16, fringeBottom + 2], [26, 26], [W - 20, 30], [W - 10, fringeBottom - 2], [W - 30, fringeBottom - 10],
      [34, fringeBottom - 12]], S.hair);
  }

  // a few soft strand facets near the parting, not a comb across the whole scalp
  ctx.globalAlpha = 0.26;
  for (let i = 0; i < 4; i++) {
    const x = 30 + i * 18;
    poly(ctx, [[x, 8], [x + 5, 10], [x + 2, fringeBottom - 10], [x - 1, fringeBottom - 12]],
      i % 2 ? S.hairLight : S.hairDark);
  }
  ctx.globalAlpha = 1;

  if (style === 'dread') {
    // hanging locks on both sides
    for (let i = 0; i < 7; i++) {
      const x = 2 + i * 6;
      box(ctx, x, 60, 4, 110 + (i % 3) * 16, S.hairDark);
      box(ctx, x, 60, 2, 96 + (i % 3) * 12, S.hair);
    }
    for (let i = 0; i < 7; i++) {
      const x = W - 6 - i * 6;
      box(ctx, x, 60, 4, 118 + (i % 3) * 14, S.hairDark);
      box(ctx, x, 60, 2, 100 + (i % 3) * 10, S.hair);
    }
  } else if (style === 'braids') {
    // pulled back: braid ridges running up from the temples
    for (let i = 0; i < 5; i++) {
      const y = 14 + i * 9;
      box(ctx, 16 + i * 2, y, W - 32 - i * 4, 2, S.hairDark);
      box(ctx, 18 + i * 2, y + 2, W - 36 - i * 4, 1, S.hairLight);
    }
    box(ctx, 0, 34, 14, 78, S.hair);
    box(ctx, W - 14, 34, 14, 78, S.hair);
  } else if (style === 'swept') {
    // a wave at the temple, and the hair is thinning at the edges
    poly(ctx, [[8, 30], [40, 14], [W - 16, 20], [W - 6, 44], [W - 30, 34], [44, 34]], S.hairLight);
    box(ctx, 0, 40, 10, 44, withAlpha(S.hair, 0.8));
    box(ctx, W - 10, 40, 10, 40, withAlpha(S.hair, 0.8));
  }
  // hairline shadow so the hair sits on the skull instead of being a cap
  box(ctx, 0, fringeBottom - 2, W, 3, withAlpha(S.deep, 0.3));
}

function paintBeard(ctx, S) {
  const B = S.beard;
  if (!B) return;
  if (B.style === 'stubble') {
    ctx.globalAlpha = 0.3;
    ell(ctx, CX, 168, 34, 30, B.color);
    ell(ctx, CX, MOUTH_Y + 6, 22, 12, B.color);
    ctx.globalAlpha = 1;
    return;
  }
  // moustache
  poly(ctx, [[CX - 20, MOUTH_Y - 7], [CX, MOUTH_Y - 10], [CX + 20, MOUTH_Y - 7], [CX + 16, MOUTH_Y - 1],
    [CX, MOUTH_Y - 3], [CX - 16, MOUTH_Y - 1]], B.color);
  // full beard down the jaw and under the chin
  poly(ctx, [[18, 132], [CX - 26, 140], [CX - 30, 176], [CX - 16, 200], [CX + 16, 200], [CX + 30, 176],
    [CX + 26, 140], [W - 18, 132], [W - 26, 168], [W - 20, 196], [20, 196], [8, 168]], B.color);
  // carve the mouth out of the beard
  ell(ctx, CX, MOUTH_Y + 1, 13, 6, withAlpha(S.deep, 0.55));
  // beard shading to keep it from reading as a flat mask
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 9; i++) {
    const x = 20 + i * 10;
    box(ctx, x, 150, 3, 46 - (i % 3) * 8, i % 2 ? B.light : B.dark);
  }
  ctx.globalAlpha = 1;
  box(ctx, 0, 196, W, 12, withAlpha('#120b07', 0.5));
}

/**
 * The skin tone a portrait is built on. The head's side planes use this as their material
 * colour, so the point where the painted face meets the cheek geometry reads as one head.
 */
export function faceSkin(kind) {
  return (SPECS[kind] || FALLBACK).skin;
}

/* -------------------------------- export ---------------------------------- */

/**
 * A portrait for a head's front face. Cached per kind so repeated rigs share one texture.
 */
export function npcFaceTexture(kind = 'kev', palette = {}) {
  const key = `npcface_${kind}`;
  if (cache.has(key)) return cache.get(key);

  const S = spec(kind, palette);

  // Paint at the 208-space aspect on a scratch canvas, then blit it once at the head's real
  // aspect. The blit is also where exposure is applied, so a darker complexion still reads in
  // the game's unlit rooms instead of turning into a silhouette.
  const tmp = document.createElement('canvas');
  tmp.width = W;
  tmp.height = GH;
  const p = tmp.getContext('2d');
  p.imageSmoothingEnabled = false;

  paintBase(p, S);
  paintAge(p, S);
  paintEyes(p, S);
  paintNose(p, S);
  paintMouth(p, S);
  paintHair(p, S);
  paintBeard(p, S);
  grain(p);

  // Pale complexions blow out under the game's head light, so exposure is normalised by the
  // skin's own luminance: dark faces are lifted, light faces are pulled back.
  const n = parseInt(S.skin.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  const exposure = (S.exposure || 1.04) * (lum > 0.62 ? 0.84 : 1);

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.filter = `brightness(${exposure}) contrast(1.04)`;
  ctx.drawImage(tmp, 0, 0, W, GH, 0, 0, W, H);
  ctx.filter = 'none';

  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/* ----------------------------- HUD portraits ----------------------------- */

const urlCache = new Map();

/**
 * How Mo looks, drawn over the neutral portrait. The HUD, the phone and text threads all read
 * from this, so the face in the corner is the same face that answers the phone.
 */
const MOOD_DRAW = {
  content() {},
  tired(ctx, w, h) {
    ctx.fillStyle = 'rgba(30,20,14,.34)';
    ctx.fillRect(w * 0.22, h * 0.395, w * 0.56, h * 0.035);
    ctx.fillStyle = 'rgba(40,26,18,.22)';
    ctx.fillRect(w * 0.24, h * 0.47, w * 0.2, h * 0.02);
    ctx.fillRect(w * 0.56, h * 0.47, w * 0.2, h * 0.02);
    ctx.fillStyle = 'rgba(30,18,12,.5)';
    ctx.fillRect(w * 0.42, h * 0.705, w * 0.18, h * 0.012);
  },
  stressed(ctx, w, h) {
    ctx.strokeStyle = 'rgba(28,18,12,.75)';
    ctx.lineWidth = Math.max(1.5, w * 0.016);
    ctx.beginPath();
    ctx.moveTo(w * 0.26, h * 0.385); ctx.lineTo(w * 0.46, h * 0.415);
    ctx.moveTo(w * 0.74, h * 0.385); ctx.lineTo(w * 0.54, h * 0.415);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40,26,18,.85)';
    ctx.beginPath();
    ctx.moveTo(w * 0.38, h * 0.715); ctx.lineTo(w * 0.62, h * 0.715);
    ctx.stroke();
    ctx.fillStyle = 'rgba(120,200,255,.5)';
    ctx.fillRect(w * 0.755, h * 0.44, w * 0.035, h * 0.06);
  },
  high(ctx, w, h) {
    // bloodshot: red wash over the eye band, veins, small pupils
    ctx.fillStyle = 'rgba(190,40,30,.4)';
    ctx.fillRect(w * 0.22, h * 0.425, w * 0.24, h * 0.045);
    ctx.fillRect(w * 0.54, h * 0.425, w * 0.24, h * 0.045);
    ctx.strokeStyle = 'rgba(150,20,20,.85)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const x = w * (0.23 + i * 0.078);
      const y = h * (0.43 + (i % 3) * 0.012);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * 0.03, y + h * 0.018); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    for (const cx of [0.32, 0.68]) ctx.fillRect(w * (cx - 0.012), h * 0.437, w * 0.024, h * 0.022);
    ctx.fillStyle = 'rgba(16,10,8,.95)';
    for (const cx of [0.32, 0.68]) ctx.fillRect(w * (cx - 0.006), h * 0.441, w * 0.012, h * 0.014);
    // smirk: one corner up, the other flat
    ctx.strokeStyle = 'rgba(48,28,20,.9)';
    ctx.lineWidth = Math.max(1.5, w * 0.015);
    ctx.beginPath();
    ctx.moveTo(w * 0.38, h * 0.715);
    ctx.quadraticCurveTo(w * 0.5, h * 0.70, w * 0.63, h * 0.695);
    ctx.stroke();
  },
  sick(ctx, w, h) {
    ctx.fillStyle = 'rgba(150,170,160,.20)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(24,16,12,.4)';
    ctx.fillRect(w * 0.2, h * 0.4, w * 0.22, h * 0.05);
    ctx.fillRect(w * 0.58, h * 0.4, w * 0.22, h * 0.05);
    ctx.fillStyle = 'rgba(26,18,14,.28)';
    ctx.beginPath(); ctx.ellipse(w * 0.28, h * 0.63, w * 0.08, h * 0.075, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w * 0.72, h * 0.63, w * 0.08, h * 0.075, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(50,30,22,.8)';
    ctx.lineWidth = Math.max(1.5, w * 0.015);
    ctx.beginPath();
    ctx.moveTo(w * 0.38, h * 0.72);
    ctx.quadraticCurveTo(w * 0.5, h * 0.735, w * 0.62, h * 0.72);
    ctx.stroke();
    ctx.fillStyle = 'rgba(120,200,255,.45)';
    ctx.fillRect(w * 0.24, h * 0.45, w * 0.03, h * 0.075);
    ctx.fillRect(w * 0.72, h * 0.42, w * 0.03, h * 0.06);
  },
  angry(ctx, w, h) {
    ctx.strokeStyle = 'rgba(24,14,10,.9)';
    ctx.lineWidth = Math.max(2, w * 0.02);
    ctx.beginPath();
    ctx.moveTo(w * 0.24, h * 0.37); ctx.lineTo(w * 0.46, h * 0.425);
    ctx.moveTo(w * 0.76, h * 0.37); ctx.lineTo(w * 0.54, h * 0.425);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(48,26,18,.9)';
    ctx.lineWidth = Math.max(1.5, w * 0.016);
    ctx.beginPath();
    ctx.moveTo(w * 0.36, h * 0.725); ctx.lineTo(w * 0.64, h * 0.72);
    ctx.stroke();
  },
};

/** A portrait canvas (128x178) with a mood painted over the neutral face. */
export function portraitCanvas(kind = 'mo', mood = 'content') {
  const base = npcFaceTexture(kind).image;
  const c = document.createElement('canvas');
  c.width = base.width;
  c.height = base.height;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0);
  (MOOD_DRAW[mood] || MOOD_DRAW.content)(ctx, c.width, c.height);
  return c;
}

/** Cached data URL, safe to drop straight into an <img> or a CSS background. */
export function portraitURL(kind = 'mo', mood = 'content') {
  const key = `${kind}|${mood}`;
  if (!urlCache.has(key)) urlCache.set(key, portraitCanvas(kind, mood).toDataURL());
  return urlCache.get(key);
}

export const MOODS = Object.keys(MOOD_DRAW);
