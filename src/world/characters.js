/**
 * Low-poly character rigs: Mo, Addison Octavius, and everyone else in the neighbourhood.
 *
 * Proportions follow a ~7.5-head figure (head 0.238 m on a 1.78 m body): shoulders ~2.2 heads
 * wide, fingertips at mid-thigh, legs slightly more than half the height. Every body part is a
 * tapered box hanging from a joint pivot (shoulder, elbow, wrist, hip, knee, ankle).
 *
 * Heads are real geometry: a faceted skull built from stacked rings, with a nose wedge, brow
 * ridge, recessed eyes, ears, a beard patch and hair shells. Nothing is painted onto a flat
 * card — the face turns, catches light and reads from three-quarter angles like the rest of the
 * body. Faces for the HUD and phone are painted separately in render/faces.js.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box, taper } from '../render/retro.js';
import { tex } from '../render/textures.js';
import { HEAD, headGeometry, headPoint, shellGeometry, headTexture, faceSpec } from '../render/heads.js';

/* ------------------------------- materials ------------------------------- */

const mat = {
  skin: retroMaterial('skin', { color: 0x8c6043, ambient: 0.8 }),
  shirt: retroMaterial('tee', { color: 0xe9e8e3, ambient: 0.66 }),
  denim: retroMaterial('jeans', { color: 0x3a5682, ambient: 0.6 }),
  hair: retroMaterial('hair', { color: 0x241c14 }),
  shoe: retroMaterial('shoe', { color: 0x232326 }),
  belt: retroMaterial('belt', { color: 0x2b2119 }),
  suit: retroMaterial('suit', { color: 0xf6f3e8 }),
  trouser: retroMaterial('trouser', { color: 0xeae7dc }),
  dressShirt: retroMaterial('dressShirt', { color: 0xfffdf6 }),
  gold: retroMaterial('gold', { map: tex('gold'), color: 0xffe9a3, emissive: 0.12 }),
  goldBand: retroMaterial('goldband', { color: 0xffd24a, emissive: 0.25 }),
  eyeWhite: retroMaterial('eyeWhite', { color: 0xe8e2d4, ambient: 0.9 }),
  iris: retroMaterial('iris', { color: 0x2a2018, ambient: 0.6 }),
  lip: retroMaterial('lip', { color: 0x6f4238, ambient: 0.8 }),
  navy: retroMaterial('navy', { color: 0x1e2634 }),
};

/* --------------------------------- helpers -------------------------------- */

function shadowBlob(r = 0.34) {
  const g = new THREE.CircleGeometry(r, 10);
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false });
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  return mesh;
}

function joint(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/** Flat-shaded material for a character's skin tone (cached per colour). */
const toneCache = new Map();
function tone(hex, ambient = 0.7) {
  const key = `${hex}|${ambient}`;
  if (!toneCache.has(key)) toneCache.set(key, retroMaterial(`tone${key}`, { color: hex, ambient }));
  return toneCache.get(key);
}
const hairCache = new Map();
function hairMat(hex) {
  if (!hairCache.has(hex)) hairCache.set(hex, retroMaterial(`hairC${hex}`, { color: hex, ambient: 0.72 }));
  return hairCache.get(hex);
}

/* --------------------------- faceted limb geometry --------------------------- */

/**
 * A faceted prism (6-8 sides) hanging from its top centre down -Y: the 90s console limb.
 * Non-indexed so every side is its own flat plane with a hard normal break, like the
 * reference model's arms, legs and torso. wTop/wBot/dTop/dBot are full widths.
 */
const prismCache = new Map();
function prismGeo(wTop, wBot, dTop, dBot, h, sides = 8) {
  const key = [wTop, wBot, dTop, dBot, h, sides].map((v) => v.toFixed(4)).join('|');
  if (prismCache.has(key)) return prismCache.get(key);
  const pos = [], uv = [];
  const ring = (y, w, d) => {
    const pts = [];
    for (let i = 0; i < sides; i++) {
      // rotate half a step so a flat face points forward (+Z), slightly squared corners
      const a = ((i + 0.5) / sides) * Math.PI * 2;
      const sx = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.85);
      const cz = Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 0.85);
      pts.push([sx * w / 2, y, cz * d / 2]);
    }
    return pts;
  };
  const top = ring(0, wTop, dTop), bot = ring(-h, wBot, dBot);
  const push = (p, u, v) => { pos.push(p[0], p[1], p[2]); uv.push(u, v); };
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    const u0 = i / sides, u1 = (i + 1) / sides;
    push(top[i], u0, 1); push(bot[i], u0, 0); push(bot[j], u1, 0);
    push(top[i], u0, 1); push(bot[j], u1, 0); push(top[j], u1, 1);
  }
  for (let i = 1; i < sides - 1; i++) {
    push(top[0], 0.5, 0.5); push(top[i + 1], 0.5, 0.5); push(top[i], 0.5, 0.5);
    push(bot[0], 0.5, 0.5); push(bot[i], 0.5, 0.5); push(bot[i + 1], 0.5, 0.5);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals(); // non-indexed => flat facets
  prismCache.set(key, g);
  return g;
}

function prism(wTop, wBot, dTop, dBot, h, material, p = [0, 0, 0], sides = 8, rot = [0, 0, 0]) {
  const m = new THREE.Mesh(prismGeo(wTop, wBot, dTop, dBot, h, sides), material);
  m.position.set(p[0], p[1], p[2]);
  m.rotation.set(rot[0], rot[1], rot[2]);
  return m;
}

/* ------------------------------- head assembly ------------------------------ */

/** Head material: the character's wrap texture, lit brighter than the body so faces read. */
const headMatCache = new Map();
function headMat(kind) {
  if (!headMatCache.has(kind)) headMatCache.set(kind, retroMaterial(`head_${kind}`, { map: headTexture(kind), ambient: 0.85, dither: 0.3 }));
  return headMatCache.get(kind);
}

/** Hair volume per style, as shells over the skull (short styles live in the texture). */
const HAIR_SHELLS = {
  swept: { tMin: (a) => (Math.abs(a) < 1.1 ? 0.84 : 0.6 - 0.18 * Math.min(1, (Math.abs(a) - 1.1) / 2)), grow: 1.07 },
  side: { tMin: (a) => (Math.abs(a) < 1.1 ? 0.84 : 0.6 - 0.18 * Math.min(1, (Math.abs(a) - 1.1) / 2)), grow: 1.05 },
  quiff: { tMin: (a) => (Math.abs(a) < 1.1 ? 0.86 : 0.62 - 0.2 * Math.min(1, (Math.abs(a) - 1.1) / 2)), grow: 1.06 },
  bob: { tMin: (a) => (Math.abs(a) < 0.95 ? 0.7 : 0.18), grow: 1.09 },
  long: { tMin: (a) => (Math.abs(a) < 0.9 ? 0.82 : Math.abs(a) < 1.3 ? 0.3 : 0.02), grow: 1.08 },
  dread: { tMin: (a) => (Math.abs(a) < 1.05 ? 0.8 : 0.45), grow: 1.08 },
  braids: { tMin: (a) => (Math.abs(a) < 1.1 ? 0.82 : 0.4), grow: 1.04 },
  durag: { tMin: (a) => (Math.abs(a) < 1.0 ? 0.8 : 0.5), grow: 1.04 },
  kufi: { tMin: () => 0.78, grow: 1.06 },
  beanie: { tMin: (a) => (Math.abs(a) < 1.0 ? 0.76 : 0.56), grow: 1.11 },
};

/**
 * A complete head for a CAST kind: one textured skull (face, sides, nape and short hair are
 * all in the wrap texture), ears, and an optional hair shell. Origin at the neck joint.
 */
function buildHead({ hh, kind, style = 'short', skinMat, hairColor }) {
  const g = new THREE.Group();
  const hm = headMat(kind);
  g.add(new THREE.Mesh(headGeometry(hh), hm));

  // ears: small faceted wedges at the sides, top at the brow line, bottom at the nose base
  const eT = (HEAD.browT + HEAD.noseT) / 2;
  const ep = headPoint(Math.PI / 2, eT);
  for (const sx of [-1, 1]) {
    const ear = prism(0.045 * hh, 0.035 * hh, 0.12 * hh, 0.09 * hh, (HEAD.browT - HEAD.noseT) * hh, skinMat,
      [sx * (ep[0] * hh - 0.004 * hh), HEAD.browT * hh, ep[2] * hh - 0.05 * hh], 6, [0, sx * 0.3, sx * 0.08]);
    g.add(ear);
  }

  const shell = HAIR_SHELLS[style];
  if (shell) g.add(new THREE.Mesh(shellGeometry(hh, shell.tMin, shell.grow), hm));
  const hair = hairMat(hairColor);
  if (style === 'swept' && kind === 'addison') {
    // the Reverend's pompadour
    const q = prism(0.5 * hh, 0.62 * hh, 0.28 * hh, 0.36 * hh, 0.14 * hh, hair, [0, 1.07 * hh, 0.12 * hh], 8, [-0.35, 0, 0]);
    g.add(q);
  }
  if (style === 'quiff') {
    // a low forelock swept up off the brow, sitting on the shell rather than floating above it
    g.add(prism(0.42 * hh, 0.5 * hh, 0.2 * hh, 0.26 * hh, 0.09 * hh, hair, [0, 1.0 * hh, 0.17 * hh], 8, [-0.2, 0, 0]));
  }
  if (style === 'durag') {
    // the tails hanging down the back
    for (const sx of [-1, 1]) {
      const p = headPoint(Math.PI - sx * 0.35, 0.55);
      g.add(prism(0.12 * hh, 0.1 * hh, 0.03 * hh, 0.03 * hh, 0.75 * hh, hair, [p[0] * 1.05 * hh, 0.6 * hh, p[2] * 1.05 * hh], 4, [0.15, 0, sx * 0.08]));
    }
  }
  if (style === 'beanie') {
    g.add(prism(0.63 * hh, 0.65 * hh, 0.82 * hh, 0.84 * hh, 0.09 * hh, hair, [0, 0.83 * hh, -0.03 * hh], 10));
  }
  if (style === 'dread' || style === 'braids') {
    const count = style === 'dread' ? 9 : 2;
    for (let i = 0; i < count; i++) {
      const a = style === 'dread' ? Math.PI - 1.3 + (i / (count - 1)) * 2.6 : Math.PI + (i ? 0.25 : -0.25);
      const p = headPoint(a, 0.62);
      const len = (style === 'dread' ? 0.62 + (i % 3) * 0.1 : 0.9) * hh;
      const strand = prism(0.085 * hh, 0.06 * hh, 0.085 * hh, 0.06 * hh, len, hair, [p[0] * 1.05 * hh, 0.66 * hh, p[2] * 1.05 * hh], 5, [Math.cos(a) * -0.2, 0, Math.sin(a) * 0.15]);
      g.add(strand);
    }
  }
  return g;
}

/* --------------------------------- bodies --------------------------------- */

/**
 * Lofted limb: a faceted tube through a list of rings [y, width, depth, zOffset?] (metres,
 * relative to the joint, +Y up). Non-indexed, so every quad keeps a hard normal — the flat,
 * chunky planes of the reference model — but with as many rings as the shape needs (calf,
 * bicep, chest, the hang of a tee) instead of one straight taper per bone.
 */
const loftCache = new Map();
function loftGeo(rings, sides = 8, caps = true) {
  const key = sides + '|' + rings.map((r) => r.map((v) => (+v).toFixed(4)).join(',')).join(';');
  if (loftCache.has(key)) return loftCache.get(key);
  const pos = [], uv = [];
  const ringPts = rings.map(([y, w, d, z = 0]) => {
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const a = ((i + 0.5) / sides) * Math.PI * 2;
      const sx = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.82);
      const cz = Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 0.82);
      pts.push([sx * w / 2, y, cz * d / 2 + z]);
    }
    return pts;
  });
  const push = (p, u, v) => { pos.push(p[0], p[1], p[2]); uv.push(u, v); };
  for (let r = 0; r < ringPts.length - 1; r++) {
    const A = ringPts[r], B = ringPts[r + 1];
    // rings may be listed top-down or bottom-up; keep the winding facing outward
    const down = rings[r + 1][0] < rings[r][0];
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const [T, Bt] = down ? [A, B] : [B, A];
      const u0 = i / sides, u1 = (i + 1) / sides;
      push(T[i], u0, 1); push(Bt[i], u0, 0); push(Bt[j], u1, 0);
      push(T[i], u0, 1); push(Bt[j], u1, 0); push(T[j], u1, 1);
    }
  }
  if (caps) {
    const first = ringPts[0], last = ringPts[ringPts.length - 1];
    const firstIsTop = rings[0][0] > rings[rings.length - 1][0];
    const [top, bot] = firstIsTop ? [first, last] : [last, first];
    for (let i = 1; i < sides - 1; i++) {
      push(top[0], 0.5, 0.5); push(top[i + 1], 0.5, 0.5); push(top[i], 0.5, 0.5);
      push(bot[0], 0.5, 0.5); push(bot[i], 0.5, 0.5); push(bot[i + 1], 0.5, 0.5);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  loftCache.set(key, g);
  return g;
}

function loft(rings, material, sides = 8, p = [0, 0, 0]) {
  const m = new THREE.Mesh(loftGeo(rings, sides), material);
  m.position.set(p[0], p[1], p[2]);
  return m;
}

/** Scale a ring list (y, w, d, z) by k and widths by b. */
const R = (rings, k, b = 1) => rings.map(([y, w, d, z = 0]) => [y * k, w * b * k, d * k, z * k]);

/**
 * Build a jointed body. Proportions are measured off the Mo reference model (a ~6.4-head,
 * broad-shouldered late-90s console figure): short thick neck, sloped traps into the sleeves,
 * a tee that hangs over the waistband, straight-leg jeans with a slight flare, chunky fists.
 * Every joint has a cap so knees and elbows never open a gap when they bend.
 */
function buildBody(spec) {
  const {
    kind = 'kev', height = 1.78, build = 1,
    shirtMat, pantsMat, shoeMat,
    armMat, sleeveMat, handMat,
    suit = false, longSleeves = false,
  } = spec;
  const fs = faceSpec(kind);
  const skinColor = parseInt(fs.skin.slice(1), 16);
  const hairColor = parseInt(fs.hair.slice(1), 16);
  const hairStyle = fs.style || spec.style || 'short';
  const fem = !!fs.fem;

  const k = height / 1.78;
  const b = build * (fem ? 0.9 : 1);
  const sh = fem ? 0.86 : 1;           // shoulder breadth
  const hp = fem ? 1.06 : 1;           // hip breadth
  const skin = tone(skinColor);
  const hand = handMat || skin;

  // vertical layout of a 1.78 m figure (metres): ankle 0.08, knee 0.46, hip joint 0.86,
  // waist 0.98, shoulder 1.40, neck base 1.43, chin ~1.50, crown 1.78
  const footH = 0.08 * k;
  const calfH = 0.38 * k;
  const thighH = 0.40 * k;
  const pelvisH = 0.12 * k;
  const headH = 0.272 * k;
  const hipY = footH + calfH + thighH;
  const shoulderY = 0.42 * k;          // relative to the torso joint (waist)

  const root = new THREE.Group();
  root.add(shadowBlob(0.28 + 0.06 * k));

  /* ---- hips / pelvis (jeans) ---- */
  const hips = joint(root, 0, hipY, 0);
  hips.add(loft(R([[0.1, 0.32 * hp, 0.19], [0.02, 0.385 * hp, 0.225], [-0.07, 0.385 * hp, 0.225], [-0.13, 0.30 * hp, 0.19]], k, b), pantsMat, 8));

  function makeLeg(sx) {
    const pivot = joint(hips, sx * 0.098 * hp * b * k, -0.02 * k, 0);
    pivot.add(loft(R([[0.06, 0.19, 0.2], [-0.04, 0.205, 0.215], [-0.22, 0.185, 0.195, 0.005], [-0.42, 0.165, 0.172]], k, b), pantsMat, 8));
    const knee = joint(pivot, 0, -thighH, 0);
    // knee cap: a short faceted drum that fills the joint when the leg bends
    knee.add(loft(R([[0.05, 0.164, 0.17], [-0.05, 0.164, 0.172]], k, b), pantsMat, 8));
    knee.add(loft(R([[0.03, 0.165, 0.172], [-0.12, 0.172, 0.178], [-0.3, 0.168, 0.176], [-0.37, 0.178, 0.186]], k, b), pantsMat, 8));
    const ankle = joint(knee, 0, -calfH, 0);
    // shoe: heel to toe, flat sole
    ankle.add(loft(R([[0.03, 0.10, 0.12, -0.005], [-0.035, 0.118, 0.25, 0.05], [-0.08, 0.122, 0.28, 0.055]], k), shoeMat, 8));
    return { pivot, knee, ankle };
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  /* ---- torso: tee hem over the waistband, chest, sloped traps ---- */
  const torso = joint(hips, 0, pelvisH, 0);
  const hem = suit ? -0.2 : -0.085;
  torso.add(loft(R([
    [hem, 0.395 * hp, 0.235], [0.0, 0.37, 0.218], [0.12, 0.36, 0.222, 0.005],
    [0.25, 0.40 * sh, 0.25, 0.012], [0.34, 0.44 * sh, 0.25, 0.004], [0.395, 0.45 * sh, 0.22, -0.006], [0.43, 0.34 * sh, 0.17, -0.012], [0.452, 0.19, 0.13, -0.015],
  ], k, b), shirtMat, 10));
  // neck: short and thick, running up inside the skull
  torso.add(loft(R([[0.40, 0.135, 0.135, -0.012], [0.47, 0.128, 0.128, -0.006], [0.53, 0.12, 0.12, 0]], k), skin, 8));
  // collar band
  if (!suit) torso.add(loft(R([[0.425, 0.172, 0.165, -0.01], [0.452, 0.15, 0.142, -0.01]], k), shirtMat, 10));

  const head = joint(torso, 0, 0.50 * k, 0);
  const headGroup = buildHead({ hh: headH, kind, style: hairStyle, skinMat: tone(skinColor, 0.95), hairColor });
  headGroup.position.set(0, -0.03 * k, 0.004 * k);
  headGroup.scale.set(1.12, 1, 1.04);
  head.add(headGroup);

  /* ---- arms ---- */
  function makeArm(sx) {
    const pivot = joint(torso, sx * 0.205 * sh * b * k, 0.385 * k, 0);
    const upper = longSleeves ? sleeveMat : armMat;
    // sleeve: bell-shaped, from the shoulder seam to mid-bicep
    pivot.add(loft(R([[0.035, 0.1, 0.11, -0.005], [-0.01, 0.148, 0.15], [-0.12, 0.158, 0.152], [-0.165, 0.154, 0.148]], k, b), sleeveMat, 8));
    pivot.add(loft(R([[-0.08, 0.108, 0.108], [-0.16, 0.112, 0.112, 0.004], [-0.27, 0.088, 0.092]], k, b), upper, 7));
    const elbow = joint(pivot, 0, -0.27 * k, 0);
    elbow.add(loft(R([[0.035, 0.088, 0.092], [-0.035, 0.088, 0.09]], k, b), upper, 7));
    const fore = longSleeves ? sleeveMat : armMat;
    elbow.add(loft(R([[0.02, 0.088, 0.092], [-0.07, 0.098, 0.1, 0.004], [-0.24, 0.072, 0.074]], k, b), fore, 7));
    if (longSleeves) elbow.add(loft(R([[-0.2, 0.084, 0.086], [-0.245, 0.084, 0.086]], k, b), sleeveMat, 7));
    // fist: knuckles forward, thumb wrapped over the front
    const handMesh = loft(R([[-0.225, 0.07, 0.072], [-0.255, 0.092, 0.1, 0.008], [-0.33, 0.094, 0.104, 0.012], [-0.36, 0.074, 0.084, 0.008]], k), hand, 7);
    elbow.add(handMesh);
    elbow.add(loft(R([[-0.25, 0.034, 0.034, 0.045], [-0.3, 0.03, 0.03, 0.052]], k), hand, 5, [-sx * 0.022 * k, 0, 0]));
    return { pivot, elbow, hand: handMesh };
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  return { root, hips, torso, head, legL, legR, armL, armR, hipY, shoulderY, headH, k, t: 0, suit };
}

/* ---------------------------------- cast ---------------------------------- */

const CAST = {
  mo: { height: 1.78, build: 1.04 },
  addison: { height: 1.86, build: 1.05, longSleeves: true },
  kev: { height: 1.78, build: 1.02, shirt: 0x4a4e44, pants: 0x34405a },
  rae: { height: 1.72, build: 0.98, shirt: 0x5a4a78, pants: 0x2c2c34 },
  dale: { height: 1.70, build: 0.95, shirt: 0x4a5040, pants: 0x4a4436, longSleeves: true },
  dex: { height: 1.80, build: 1.1, shirt: 0x4a3a2e, pants: 0x22252c },
  nia: { height: 1.65, shirt: 0x26252a, pants: 0x30343e, longSleeves: true },
  miguel: { height: 1.74, build: 1.04, shirt: 0x5a6048, pants: 0x2e2e30 },
  habib: { height: 1.74, build: 1.02, shirt: 0xc8bc9e, pants: 0x3a3630, longSleeves: true },
  homeless: { height: 1.72, build: 1.0, shirt: 0x4e5038, pants: 0x3a362c, longSleeves: true },
  junkie: { height: 1.71, build: 0.88, shirt: 0x5a5a56, pants: 0x2c2a26, longSleeves: true },
  clerk: { height: 1.75, shirt: 0xb8c6d4, pants: 0x2e3238, longSleeves: true },
  // Rolo, the phone dealer: navy hoodie, grey sweats, never in a hurry
  rolo: { height: 1.76, build: 0.96, shirt: 0x1f2c4a, pants: 0x4a4a50, longSleeves: true },
};

export function createMo() {
  const rig = buildBody({
    ...CAST.mo,
    kind: 'mo',
    // plain white tee, plain blue jeans: no patches, no stains, nothing stuck to the shirt
    shirtMat: mat.shirt,
    pantsMat: mat.denim,
    shoeMat: mat.shoe,
    armMat: tone(parseInt(faceSpec('mo').skin.slice(1), 16)),
    sleeveMat: mat.shirt,
    handMat: tone(parseInt(faceSpec('mo').skin.slice(1), 16)),
  });
  rig.root.name = 'Mo';
  return rig;
}

export function createAddison() {
  const rig = buildBody({
    ...CAST.addison,
    kind: 'addison',
    shirtMat: mat.suit,
    pantsMat: mat.trouser,
    shoeMat: mat.navy,
    armMat: mat.suit,
    sleeveMat: mat.suit,
    handMat: tone(parseInt(faceSpec('addison').skin.slice(1), 16)),
    suit: true,
  });
  rig.root.name = 'Addison';
  const { k } = rig;
  const z = 0.128 * k; // front of the chest
  // shirt V, gold tie, tie bar, lapels, buttons, pocket square
  const front = (w, h, d, m, x, y, rz = 0) => rig.torso.add(box(w * k, h * k, d * k, m, [x * k, y * k, z + (d * k) / 2], [0, 0, rz]));
  front(0.13, 0.17, 0.008, mat.dressShirt, 0, 0.34);
  front(0.06, 0.30, 0.012, mat.gold, 0, 0.24);
  front(0.05, 0.045, 0.014, mat.goldBand, 0, 0.405);
  front(0.075, 0.012, 0.016, mat.goldBand, 0, 0.22);
  front(0.095, 0.24, 0.01, mat.suit, -0.09, 0.32, 0.22);
  front(0.095, 0.24, 0.01, mat.suit, 0.09, 0.32, -0.22);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) front(0.024, 0.024, 0.012, mat.navy, -0.07 + i * 0.14, 0.12 - j * 0.12);
  front(0.055, 0.04, 0.012, mat.gold, 0.13, 0.31, 0.3);
  for (const a of [rig.armL, rig.armR]) a.elbow.add(box(0.09 * k, 0.03 * k, 0.095 * k, mat.gold, [0, -0.215 * k, 0]));
  return rig;
}

/** Shirt colour of a cast member as a CSS hex string (for painted portraits). */
export function castShirt(kind) {
  if (kind === 'mo') return '#e9e8e3';
  if (kind === 'addison') return '#f2efe4';
  const s = (CAST[kind] || CAST.kev).shirt ?? 0x555a52;
  return '#' + s.toString(16).padStart(6, '0');
}

export const NPC_KINDS = Object.keys(CAST).filter((k) => k !== 'mo' && k !== 'addison');

export function createNPC(kind = 'kev') {
  const known = !!CAST[kind];
  const spec = CAST[kind] || CAST.kev;
  const skinTone = tone(parseInt(faceSpec(known ? kind : 'kev').skin.slice(1), 16));
  const shirt = retroMaterial(`npcShirt${kind}`, { color: spec.shirt ?? 0x555a52, ambient: 0.6 });
  const rig = buildBody({
    ...spec,
    kind: known ? kind : 'kev',
    shirtMat: shirt,
    pantsMat: retroMaterial(`npcPants${kind}`, { color: spec.pants ?? 0x2c3038, ambient: 0.6 }),
    shoeMat: retroMaterial(`npcShoe${kind}`, { color: 0x2a2622 }),
    armMat: spec.longSleeves ? shirt : skinTone,
    sleeveMat: shirt,
    handMat: skinTone,
  });
  rig.root.name = kind;
  if (kind === 'miguel' || kind === 'habib' || kind === 'clerk') {
    // shop apron, hanging from the chest
    const { k } = rig;
    rig.torso.add(loft(R([[0.34, 0.3, 0.02, 0.13], [-0.16, 0.36, 0.02, 0.14]], k), retroMaterial(`apron${kind}`, { color: kind === 'habib' ? 0x4a5a44 : 0x5a4a38 }), 4));
  }
  return rig;
}

export function createCat() {
  const root = new THREE.Group();
  const fur = retroMaterial('fur', { color: 0x3a3630 });
  root.add(box(0.22, 0.16, 0.38, fur, [0, 0.13, 0]));
  root.add(box(0.15, 0.13, 0.14, fur, [0, 0.2, 0.24]));
  root.add(box(0.04, 0.07, 0.03, fur, [-0.05, 0.28, 0.24]));
  root.add(box(0.04, 0.07, 0.03, fur, [0.05, 0.28, 0.24]));
  root.add(box(0.03, 0.02, 0.02, mat.iris, [-0.04, 0.22, 0.315]));
  root.add(box(0.03, 0.02, 0.02, mat.iris, [0.04, 0.22, 0.315]));
  root.add(box(0.04, 0.04, 0.28, fur, [0, 0.18, -0.26]));
  const rig = { root, tail: root.children[root.children.length - 1], t: 0, type: 'cat' };
  root.add(shadowBlob(0.18));
  return rig;
}

/* ------------------------------- animation ------------------------------- */

export function animateMo(rig, dt, opts = {}) {
  const { walking = false, high = 0, withdrawal = 0, sitting = false, sleeping = false } = opts;
  rig.t += dt * (walking ? 7.2 : 1.4);
  const t = rig.t;
  const drunk = Math.min(1, (high / 100) * 1.1 + (withdrawal / 380));
  const sway = Math.sin(t * 0.9) * drunk * 0.22;
  const { hipY } = rig;

  if (sleeping) {
    rig.root.rotation.z = 0;
    rig.root.rotation.x = 0;
    rig.hips.rotation.x = 0;
    rig.legL.pivot.rotation.x = -0.1;
    rig.legR.pivot.rotation.x = -0.1;
    rig.legL.knee.rotation.x = 0.12;
    rig.legR.knee.rotation.x = 0.12;
    rig.armL.pivot.rotation.x = Math.sin(t * 0.6) * 0.04;
    rig.armR.pivot.rotation.x = Math.sin(t * 0.6 + 1) * 0.04;
    rig.head.rotation.x = 0.16;
    return;
  }

  if (sitting) {
    rig.hips.position.y = hipY - 0.44;
    rig.legL.pivot.rotation.x = -1.35;
    rig.legR.pivot.rotation.x = -1.35;
    rig.legL.knee.rotation.x = 1.35;
    rig.legR.knee.rotation.x = 1.35;
    rig.armL.pivot.rotation.x = -0.5;
    rig.armR.pivot.rotation.x = -0.5;
    rig.armL.elbow.rotation.x = -0.5;
    rig.armR.elbow.rotation.x = -0.5;
    rig.head.rotation.x = 0.1;
    rig.root.rotation.z = sway * 0.3;
    return;
  }

  const stride = walking ? 0.62 : 0.04;
  const bob = walking ? Math.abs(Math.sin(t)) * 0.035 : Math.sin(t * 0.8) * 0.01;
  const swingL = Math.sin(t);
  const swingR = Math.sin(t + Math.PI);

  rig.hips.position.y = hipY + bob;
  rig.legL.pivot.rotation.x = swingL * stride;
  rig.legR.pivot.rotation.x = swingR * stride;
  rig.legL.knee.rotation.x = Math.max(0, -swingL) * 0.75 + 0.04;
  rig.legR.knee.rotation.x = Math.max(0, -swingR) * 0.75 + 0.04;
  rig.legL.ankle.rotation.x = swingL * 0.12;
  rig.legR.ankle.rotation.x = swingR * 0.12;

  rig.armL.pivot.rotation.x = swingR * stride * 1.1;
  rig.armR.pivot.rotation.x = swingL * stride * 1.1;
  rig.armL.elbow.rotation.x = -0.12 - Math.max(0, swingR) * 0.45;
  rig.armR.elbow.rotation.x = -0.12 - Math.max(0, swingL) * 0.45;
  rig.armL.pivot.rotation.z = -0.05 - Math.sin(t * 0.7) * 0.035;
  rig.armR.pivot.rotation.z = 0.05 + Math.sin(t * 0.7) * 0.035;

  rig.torso.rotation.y = Math.sin(t) * (walking ? 0.05 : 0.02) + sway * 0.5;
  rig.torso.rotation.z = sway * 0.7;
  rig.head.rotation.y = Math.sin(t * 0.5) * 0.07 * (1 + drunk * 2) - sway * 0.7;
  rig.head.rotation.z = sway * 0.8;
  rig.root.rotation.z = sway * 0.34;
  rig.root.position.y = Math.sin(t * 0.6) * drunk * 0.02;

  if (walking && drunk > 0.55) {
    const st = Math.sin(t * 0.41);
    if (st > 0.985) {
      rig.root.rotation.z += 0.22;
      rig.root.position.y -= 0.04;
    }
  }
}

export function animateAddison(rig, dt) {
  rig.t += dt;
  const t = rig.t;
  const beat = Math.sin(t * 3.1);
  const beat2 = Math.sin(t * 3.1 + Math.PI);
  rig.hips.position.y = rig.hipY + Math.abs(beat) * 0.05;
  rig.hips.rotation.z = beat * 0.12;
  rig.hips.rotation.y = Math.sin(t * 1.55) * 0.26;
  rig.torso.rotation.z = beat2 * 0.1;
  rig.torso.rotation.y = Math.sin(t * 3.1) * 0.2;
  rig.armL.pivot.rotation.z = 1.5 + beat * 1.0;
  rig.armL.pivot.rotation.x = -0.5 + Math.sin(t * 6.2) * 0.5;
  rig.armL.elbow.rotation.x = -0.8 - beat * 0.5;
  rig.armR.pivot.rotation.z = -1.5 - beat2 * 1.0;
  rig.armR.pivot.rotation.x = -0.5 + Math.sin(t * 6.2 + 1) * 0.5;
  rig.armR.elbow.rotation.x = -0.8 - beat2 * 0.5;
  rig.legL.pivot.rotation.x = Math.max(0, beat) * 0.35;
  rig.legR.pivot.rotation.x = Math.max(0, beat2) * 0.35;
  rig.legL.knee.rotation.x = Math.max(0, beat) * 0.5;
  rig.legR.knee.rotation.x = Math.max(0, beat2) * 0.5;
  rig.head.rotation.z = beat * 0.22;
  rig.head.rotation.y = Math.sin(t * 3.1 + 0.7) * 0.28;
  rig.head.rotation.x = -0.1 + beat * 0.1;
}

export function animateNPC(rig, dt, opts = {}) {
  const { walking = false, sitting = false, sleeping = false } = opts;
  rig.t += dt * (walking ? 6.4 : 1);
  const t = rig.t;
  if (rig.type === 'cat') {
    rig.tail.rotation.y = Math.sin(t * 2.2) * 0.5;
    rig.root.position.y = Math.abs(Math.sin(t * 0.7)) * 0.01;
    return;
  }
  if (sleeping) {
    rig.hips.position.y = 0.16;
    rig.hips.rotation.x = -1.45;
    rig.legL.pivot.rotation.x = -0.3;
    rig.legR.pivot.rotation.x = -0.2;
    rig.legL.knee.rotation.x = 0.9;
    rig.legR.knee.rotation.x = 0.7;
    rig.armL.pivot.rotation.x = -0.5;
    rig.armR.pivot.rotation.x = -0.4;
    rig.head.rotation.x = 0.2;
    return;
  }
  if (sitting) {
    rig.hips.position.y = rig.hipY - 0.42;
    rig.legL.pivot.rotation.x = -1.3;
    rig.legR.pivot.rotation.x = -1.3;
    rig.legL.knee.rotation.x = 1.3;
    rig.legR.knee.rotation.x = 1.3;
    rig.armL.pivot.rotation.x = -0.45;
    rig.armR.pivot.rotation.x = -0.45;
    rig.armL.elbow.rotation.x = -0.55;
    rig.armR.elbow.rotation.x = -0.55;
    rig.head.rotation.x = 0.12;
    rig.head.rotation.z = 0.05;
    return;
  }

  const stride = walking ? 0.5 : 0.03;
  const swingL = Math.sin(t);
  const swingR = Math.sin(t + Math.PI);
  const bob = walking ? Math.abs(Math.sin(t)) * 0.025 : Math.sin(t * 0.9) * 0.006;

  rig.hips.position.y = rig.hipY + bob;
  rig.legL.pivot.rotation.x = swingL * stride;
  rig.legR.pivot.rotation.x = swingR * stride;
  rig.legL.knee.rotation.x = Math.max(0, -swingL) * (walking ? 0.62 : 0.05) + 0.03;
  rig.legR.knee.rotation.x = Math.max(0, -swingR) * (walking ? 0.62 : 0.05) + 0.03;
  rig.legL.ankle.rotation.x = swingL * 0.09;
  rig.legR.ankle.rotation.x = swingR * 0.09;
  rig.armL.pivot.rotation.x = -swingL * stride * 0.9;
  rig.armR.pivot.rotation.x = -swingR * stride * 0.9;
  rig.armL.elbow.rotation.x = -0.16 + Math.max(0, swingL) * 0.28;
  rig.armR.elbow.rotation.x = -0.16 + Math.max(0, swingR) * 0.28;
  rig.armL.pivot.rotation.z = -0.06;
  rig.armR.pivot.rotation.z = 0.06;
  rig.torso.rotation.y = Math.sin(t) * (walking ? 0.04 : 0.07);
  rig.head.rotation.y = Math.sin(t * 0.37) * (walking ? 0.04 : 0.2);
  rig.head.rotation.z = walking ? 0 : Math.sin(t * 0.53) * 0.04;
}

export { mat as characterMaterials };
