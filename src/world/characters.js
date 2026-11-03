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
import { STRANGERS } from '../core/strangers.js';

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
  // the three women: the shell is the cap; the length hangs below it as geometry (hangingHair)
  shoulder: { tMin: (a) => (Math.abs(a) < 0.9 ? 0.84 : Math.abs(a) < 1.25 ? 0.32 : 0.02), grow: 1.08 },
  shag: { tMin: (a) => (Math.abs(a) < 0.85 ? 0.8 : Math.abs(a) < 1.25 ? 0.3 : 0.02), grow: 1.11 },
  curls: { tMin: (a) => (Math.abs(a) < 0.85 ? 0.8 : Math.abs(a) < 1.2 ? 0.28 : 0.0), grow: 1.17 },
  // hair pulled back tight (a bun at the back), and bantu knots
  bun: { tMin: (a) => (Math.abs(a) < 1.0 ? 0.8 : 0.5), grow: 1.04 },
  knots: { tMin: (a) => (Math.abs(a) < 1.0 ? 0.8 : 0.48), grow: 1.03 },
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
  if (style === 'shoulder' || style === 'shag' || style === 'curls') hangingHair(g, hh, style, kind);
  if (style === 'bun') {
    const p = headPoint(Math.PI, 0.72);
    const bun = new THREE.Mesh(curlGeo(0.2 * hh), hairMat(hairColor));
    bun.position.set(0, 0.74 * hh, p[2] * 1.12 * hh);
    g.add(bun);
  }
  if (style === 'knots') {
    // six knots in two rows over the crown
    for (const [a, t] of [[-0.9, 0.9], [0, 0.98], [0.9, 0.9], [-2.0, 0.78], [Math.PI, 0.8], [2.0, 0.78]]) {
      const p = headPoint(a, t);
      const knot = new THREE.Mesh(curlGeo(0.12 * hh), hairMat(hairColor));
      knot.position.set(p[0] * 1.12 * hh, (t + 0.06) * hh, p[2] * 1.12 * hh);
      g.add(knot);
    }
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

/**
 * Hair that falls past the jaw, for the three women: a curtain down the back to the shoulders and
 * a lock on each side in front of them. Diana's is one clean straight sheet, Stephanie's is cut
 * into uneven strands, and Melanie's is a mass of faceted curls (icosahedra, the PS1 way to say
 * "round") over the cap and down her back. Positions are in head-heights from the neck joint.
 */
function hangingHair(g, hh, style, kind) {
  const S = faceSpec(kind);
  const hair = hairMat(parseInt(S.hair.slice(1), 16));
  const light = hairMat(parseInt(S.hairLight.slice(1), 16));
  const dark = hairMat(parseInt(S.hairDark.slice(1), 16));
  if (style === 'shoulder') {
    // hairLen: 1 is to the shoulders; the app women run from a short 0.9 to past the shoulder blades
    const n = S.hairLen || 1;
    g.add(prism(0.66 * hh, 0.8 * hh, 0.42 * hh, 0.26 * hh, 1.2 * n * hh, hair, [0, 0.78 * hh, -0.2 * hh], 8));
    for (const sx of [-1, 1]) {
      g.add(prism(0.13 * hh, 0.17 * hh, 0.3 * hh, 0.2 * hh, 1.0 * n * hh, sx < 0 ? hair : light, [sx * 0.31 * hh, 0.6 * hh, 0.02 * hh], 6, [0, 0, sx * 0.12]));
    }
    return;
  }
  if (style === 'shag') {
    g.add(prism(0.7 * hh, 0.82 * hh, 0.44 * hh, 0.3 * hh, 1.05 * (S.hairLen || 1) * hh, hair, [0, 0.8 * hh, -0.2 * hh], 8));
    // uneven strands around the sides and back, and two that fall over the face edges
    const strands = [[-1.35, 1.25], [-1.0, 1.05], [-2.0, 1.4], [-2.6, 1.3], [2.6, 1.35], [2.0, 1.2], [1.0, 1.1], [1.35, 1.3], [Math.PI, 1.45]];
    strands.forEach(([a, len], i) => {
      const p = headPoint(a, 0.62);
      const m = i % 3 === 0 ? dark : hair;
      g.add(prism(0.12 * hh, 0.05 * hh, 0.1 * hh, 0.04 * hh, len * hh, m, [p[0] * 1.08 * hh, 0.7 * hh, p[2] * 1.08 * hh], 5, [Math.cos(a) * -0.18, 0, Math.sin(a) * 0.2]));
    });
    for (const sx of [-1, 1]) g.add(prism(0.07 * hh, 0.03 * hh, 0.05 * hh, 0.03 * hh, 0.55 * hh, hair, [sx * 0.2 * hh, 0.9 * hh, 0.33 * hh], 4, [0.1, 0, sx * 0.25]));
    return;
  }
  // curls: a big faceted crown, then a column of curls down the back and over the shoulders
  const curl = (r, m, x, y, z) => {
    const mesh = new THREE.Mesh(curlGeo(r * hh), m);
    mesh.position.set(x * hh, y * hh, z * hh);
    mesh.rotation.set(x * 3.1, y * 2.3, z * 1.7);
    g.add(mesh);
  };
  let i = 0;
  for (let ring = 0; ring < 4; ring++) {
    const t = 0.95 - ring * 0.17;
    const n = 7 + ring * 2;
    for (let j = 0; j < n; j++) {
      const a = -Math.PI + ((j + 0.5 + ring * 0.37) / n) * Math.PI * 2;
      if (Math.abs(a) < (t < 0.9 ? 1.05 : 0.55)) continue; // keep the face clear
      const p = headPoint(a, t);
      const m = i++ % 4 === 0 ? light : i % 3 === 0 ? dark : hair;
      curl(0.16 + (i % 3) * 0.025, m, p[0] * 1.2, t * 1.0 + 0.04, p[2] * 1.2);
    }
  }
  for (let j = 0; j < 16; j++) {
    const a = Math.PI * (0.45 + (j / 15) * 1.1) * (j % 2 ? 1 : -1);
    const y = 0.48 - (j % 5) * 0.2;
    const p = headPoint(a, 0.5);
    const m = j % 4 === 0 ? light : j % 3 === 0 ? dark : hair;
    curl(0.17 + (j % 3) * 0.02, m, p[0] * 1.25, y, p[2] * 1.15 - 0.04);
  }
}

const curlCache = new Map();
function curlGeo(r) {
  const key = r.toFixed(3);
  if (!curlCache.has(key)) curlCache.set(key, new THREE.IcosahedronGeometry(r, 0));
  return curlCache.get(key);
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
  const hp = (fem ? 1.06 : 1) * (spec.hipScale || 1); // hip breadth
  const lg = spec.legScale || 1;       // thigh and calf thickness
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
    pivot.add(loft(R([[0.06, 0.19 * lg, 0.2 * lg], [-0.04, 0.205 * lg, 0.215 * lg], [-0.22, 0.185 * lg, 0.195 * lg, 0.005], [-0.42, 0.15 * lg, 0.158 * lg]], k, b), pantsMat, 8));
    const knee = joint(pivot, 0, -thighH, 0);
    // knee cap: a short faceted drum that fills the joint when the leg bends
    knee.add(loft(R([[0.05, 0.164, 0.17], [-0.05, 0.164, 0.172]], k, b), pantsMat, 8));
    knee.add(loft(R([[0.03, 0.165, 0.172], [-0.12, 0.172 * (spec.bareLegs ? 0.92 : 1), 0.178], [-0.3, (spec.bareLegs ? 0.12 : 0.168), (spec.bareLegs ? 0.13 : 0.176)], [-0.37, (spec.bareLegs ? 0.11 : 0.178), (spec.bareLegs ? 0.12 : 0.186)]], k, b), pantsMat, 8));
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
  if (!suit && !spec.tank) torso.add(loft(R([[0.425, 0.172, 0.165, -0.01], [0.452, 0.15, 0.142, -0.01]], k), shirtMat, 10));

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
  // the fiends: out after dark for ROX, thin, in whatever they slept in
  fiend: { height: 1.75, build: 0.8, shirt: 0x6a5a3e, pants: 0x34343a, longSleeves: true, hoodie: true },
  fiend_f: { height: 1.63, build: 0.78, shirt: 0x7a4a5a, pants: 0x2a2a34, longSleeves: true },
  clerk: { height: 1.75, shirt: 0xb8c6d4, pants: 0x2e3238, longSleeves: true },
  // Rolo, the phone dealer: navy hoodie, grey sweats, never in a hurry
  rolo: { height: 1.76, build: 0.96, shirt: 0x1f2c4a, pants: 0x4a4a50, longSleeves: true },
  // the three women on the block, and the clinic's nurse
  // dressed as in the owner's sheet: Stephanie's black zip hoodie, Melanie's black tank top,
  // Diana's grey tee
  stephanie: { height: 1.66, build: 0.98, shirt: 0x19191c, pants: 0x2a2c34, longSleeves: true, hoodie: true },
  melanie: { height: 1.68, build: 1.0, shirt: 0x141416, pants: 0x24252b, tank: true },
  diana: { height: 1.72, build: 1.0, shirt: 0x8c8e92, pants: 0x3a4a66 },
  // Nurse Okafor: the short white uniform with pink trim, bare legs, white heels (see createNPC)
  nurse: { height: 1.72, build: 1.0, shirt: 0xf4f2f0, shoes: 0xf2f2f2, bareLegs: true, hipScale: 1.16, legScale: 1.14, tank: true },
  // 1104 Kestrel: the arguing couple on two, Squeak in the hallway on four; Ashby Avenue
  tenant_m: { height: 1.76, build: 1.12, shirt: 0xe0dcd0, pants: 0x3a3a44 },
  tenant_f: { height: 1.64, build: 1.02, shirt: 0x7a3a6a, pants: 0x2a2c34, longSleeves: true },
  squeak: { height: 1.7, build: 0.86, shirt: 0x3a4a2a, pants: 0x2a2a30, longSleeves: true },
  waiter: { height: 1.78, build: 0.98, shirt: 0xf2efe6, pants: 0x141418, longSleeves: true },
  passer_m: { height: 1.8, build: 1.04, shirt: 0x2a4a7a, pants: 0x3a3a40, longSleeves: true },
  passer_m2: { height: 1.74, build: 0.98, shirt: 0x8a7a5a, pants: 0x4a4436, longSleeves: true },
  drifter: { height: 1.74, build: 0.92, shirt: 0x4a4436, pants: 0x3a362c, longSleeves: true },
  // Myrtle Row's vendors (world/row.js): aprons and caps are generic accessories, see createNPC
  sal: { height: 1.74, build: 1.14, shirt: 0xf2f2ec, pants: 0x2a2a30, apron: 0xf4f2ea, chefHat: true },
  piraguero: { height: 1.7, build: 1.02, shirt: 0xf2e8a0, pants: 0x3a4a6a, cap: 0xe8d8a0, capBrim: 0.16 },
  jerkman: { height: 1.8, build: 1.1, shirt: 0xc81e1e, pants: 0x2a2a30, apron: 0xf2e8ec, apronStripe: 0xc8323a, cap: 0x1a1a1e },
  pretzelman: { height: 1.76, build: 1.0, shirt: 0x2a3a5a, pants: 0x3a3a40, longSleeves: true, cap: 0xc81e1e },
  doner: { height: 1.74, build: 1.08, shirt: 0x2a6ab8, pants: 0x2a2a34, longSleeves: true, apron: 0x7ab0d8, cap: 0xf2f2ee },
  // the man with the "Rolex": a tan trenchcoat to the shins, collar up, the lining full of watches
  trench: { height: 1.78, build: 1.0, shirt: 0x9a7a4a, pants: 0x2a2a2e, shoes: 0x1a1210, longSleeves: true },
  hall_m: { height: 1.8, build: 1.0, shirt: 0x2a2c34, pants: 0x3a4a66, longSleeves: true },
  hall_f: { height: 1.66, build: 0.96, shirt: 0x8a2a5a, pants: 0x1a1a1e },
  cop: { height: 1.82, build: 1.1, shirt: 0x1e2a4a, pants: 0x141a2a, longSleeves: true },
  cop2: { height: 1.76, build: 1.04, shirt: 0x1e2a4a, pants: 0x141a2a, longSleeves: true },
  inmate: { height: 1.76, build: 1.0, shirt: 0xd86a1a, pants: 0xd86a1a },
  // the man in the newsstand: cardigan over a collared shirt, has worn the same cap since 1987
  newsman: { height: 1.72, build: 1.1, shirt: 0x6a5a3a, pants: 0x3a3630, longSleeves: true },
  // the Houses: the man on the bench, the courtyard's muscle (some of them armed), and the Tunnel's fighter
  benchman: { height: 1.78, build: 1.06, shirt: 0x2a2a2e, pants: 0x3a3a40, longSleeves: true, hoodie: true },
  thug: { height: 1.84, build: 1.18, shirt: 0x4a4a52, pants: 0x1e1e24, longSleeves: true, hoodie: true },
  thug_armed: { height: 1.82, build: 1.14, shirt: 0x7a1e1e, pants: 0x1a1a1e, tank: true },
  boxer: { height: 1.86, build: 1.22, shirt: 0x8a6448, pants: 0x1a2a4a, tank: true },
  // the kid who flies down the sidewalk on a red bike
  kid: { height: 1.32, build: 0.84, shirt: 0xe0c84a, pants: 0x2a4a8a },
  // the token booth clerk: transit navy, a badge, a long day
  transit: { height: 1.64, build: 1.08, shirt: 0x26355a, pants: 0x1e2230, longSleeves: true },
  // the sax player: big, older, slow; a gold-green shirt and a tam full of locks
  rasta: { height: 1.74, build: 1.32, shirt: 0x2e6a3a, pants: 0x3a3632 },
  // Ashby Pawn & Gold: the shirt is a texture, worn open over a white vest, grey sweats, sandals
  pawnbroker: { height: 1.72, build: 1.42, shirtMap: 'hawaiian', pants: 0x7a8494, shoes: 0xd8a888 },
  // the half-court: tanks and long shorts
  baller1: { height: 1.88, build: 1.02, shirt: 0xe8e4dc, pants: 0x1a2a6a, tank: true },
  baller2: { height: 1.8, build: 0.98, shirt: 0xc8281e, pants: 0x1a1a1e, tank: true },
  baller3: { height: 1.84, build: 1.08, shirt: 0x141416, pants: 0x5a5a60, tank: true },
  baller4: { height: 1.78, build: 1.0, shirt: 0x2a6aa8, pants: 0xe8e4dc, tank: true },
  // the women upstairs in the Houses
  wg1: { height: 1.68, build: 0.98, shirt: 0xc8286a, pants: 0x141416, tank: true },
  wg2: { height: 1.66, build: 1.0, shirt: 0x1a1a1e, pants: 0x6a2a8a, tank: true },
  wg3: { height: 1.7, build: 1.06, shirt: 0xe8c41e, pants: 0x24252b, tank: true },
  // the recertification window and the clothing store floor
  caseworker: { height: 1.66, build: 1.04, shirt: 0xb8a8c8, pants: 0x2a2c34, longSleeves: true },
  shopclerk: { height: 1.8, build: 1.0, shirt: 0x141416, pants: 0x3a3a40 },
  // an unsaved number: no face, just a grey hood and a question mark
  unknown: { height: 1.74, build: 1.0, shirt: 0x3a3d42, pants: 0x2a2c30, longSleeves: true },
  // Yusuf outside Habib's: a long pale kurta over dark trousers; the turban and beard below
  hookah: { height: 1.84, build: 1.16, shirt: 0xe4dece, pants: 0x2a2a30, shoes: 0x3a2a1e, longSleeves: true },
  // Papi: the white tank top, grey slacks, house slippers; Tito: a guayabera and a flat cap
  papi: { height: 1.7, build: 1.12, shirt: 0xf4f4ee, pants: 0x5a5a62, shoes: 0x3a2a24, tank: true },
  viejo: { height: 1.68, build: 1.02, shirt: 0xe0d0a0, pants: 0x4a4a52, shoes: 0x2a2018 },
  // Kestrel Park's chess table: a cardigan the colour of weak tea
  chessman: { height: 1.68, build: 0.94, shirt: 0x8a7a5a, pants: 0x4a4a52, longSleeves: true },
  // a long black coat over a white shirt, black trousers; the shtreimel is added below
  hasid: { height: 1.76, build: 0.96, shirt: 0x141416, pants: 0x141416, shoes: 0x0c0c0e, longSleeves: true },
  hasid2: { height: 1.8, build: 1.04, shirt: 0x141416, pants: 0x141416, shoes: 0x0c0c0e, longSleeves: true },
  // the Guardian Angles: red satin jacket, black cargo, a radio nobody answers
  angel_m: { height: 1.8, build: 1.1, shirt: 0xc01e1a, pants: 0x18181c, longSleeves: true },
  angel_f: { height: 1.66, build: 1.0, shirt: 0xc01e1a, pants: 0x18181c, longSleeves: true },
};
// the twenty dating-app women, dressed from their roster entry
STRANGERS.forEach((w, i) => {
  CAST[w.id] = { height: 1.62 + (i % 5) * 0.025, build: 0.96, shirt: w.look.shirt, pants: w.look.pants, longSleeves: !!w.look.longSleeves };
});

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
  rig.outfitMats = { shirt: mat.shirt, pants: mat.denim, shoes: mat.shoe };
  return rig;
}

/**
 * Put something else on. The body is built from shared materials, so the swap is a per-mesh
 * clone: the shirt on Mo stops being the shirt on everybody else the moment he changes.
 */
export function applyOutfit(rig, outfit) {
  if (!rig || !outfit || !rig.outfitMats) return;
  const cache = rig.outfitCache || (rig.outfitCache = {});
  const current = rig.outfitCurrent || (rig.outfitCurrent = {});
  const slots = [['shirt', outfit.shirt], ['pants', outfit.pants], ['shoes', outfit.shoes]];
  for (const [slot, color] of slots) {
    const base = rig.outfitMats[slot];
    if (!base || typeof color !== 'number') continue;
    const key = `${slot}:${color}`;
    if (!cache[key]) {
      // the retro materials are shader materials: the colour lives in uColor, and `m.color` does
      // not exist, so setting it changed nothing and no outfit ever showed. A plain clone also
      // deep-copies the shared light, fog and time uniforms and freezes them, so the clone
      // shares every uniform with its base except its own colour.
      const m = base.clone();
      if (base.uniforms) {
        for (const k of Object.keys(base.uniforms)) if (k !== 'uColor') m.uniforms[k] = base.uniforms[k];
        m.uniforms.uColor = { value: new THREE.Color(color) };
      } else if (m.color) m.color.setHex(color);
      cache[key] = m;
    }
    const from = current[slot] || base;
    rig.root.traverse((o) => { if (o.isMesh && o.material === from) o.material = cache[key]; });
    current[slot] = cache[key];
  }
}

/** A saxophone, in his hands, because a man playing one without one is just a man standing. */
/**
 * Angles that put each fist on the horn, solved from the rig's own bone lengths (shoulder at
 * 0.385 k, upper arm 0.27 k, elbow to fist 0.30 k) so the hands land on the tube instead of
 * floating beside it. The elbows stay on their own side of the body.
 */
const SAX_ARMS = {
  L: { px: -0.69, pz: 0.38, ex: -1.16, ez: 0.91 },
  R: { px: -0.47, pz: 0.69, ex: -1.78, ez: -0.96 },
};

/** Hang the horn off his chest at the mouth end, bell down by his right hip. */
export function addSaxophone(rig) {
  if (!rig || rig.saxProp) return null;
  const k = rig.k || 1;
  const brass = retroMaterial('saxBrass', { color: 0xc8a03a, ambient: 0.9 });
  const dark = retroMaterial('saxDark', { color: 0x26262a });
  const sax = new THREE.Group();
  // body: straight off the mouthpiece, swelling into the bell
  sax.add(loft(R([
    [0.0, 0.05, 0.05], [-0.1, 0.056, 0.058], [-0.24, 0.074, 0.076],
    [-0.36, 0.098, 0.1], [-0.43, 0.135, 0.128, 0.012], [-0.47, 0.185, 0.165, 0.03],
  ], k), brass, 8));
  // mouthpiece, its ring, and the dark rim of the bell
  sax.add(box(0.04 * k, 0.075 * k, 0.04 * k, dark, [0, 0.02 * k, 0]));
  sax.add(box(0.052 * k, 0.018 * k, 0.052 * k, brass, [0, -0.028 * k, 0]));
  sax.add(box(0.17 * k, 0.016 * k, 0.15 * k, dark, [0, -0.478 * k, 0.03 * k]));
  // keys down the front of the tube
  for (let i = 0; i < 5; i++) sax.add(box(0.06 * k, 0.02 * k, 0.028 * k, dark, [0, (-0.13 - i * 0.055) * k, 0.042 * k]));
  sax.position.set(0.1 * k, 0.49 * k, 0.2 * k);
  sax.rotation.set(-0.295, 0, 0.185);
  rig.torso.add(sax);
  rig.saxProp = sax;
  rig.saxT = 0;
  poseSax(rig, 0);
  return sax;
}

/** Both arms up on the instrument: left hand on the upper keys, right around the lower body. */
function poseSax(rig, t) {
  // a slow beat (about 84 bpm): he rocks forward on the phrase and leans back on the long notes,
  // knees giving on the downbeat, the horn coming up with him, fingers walking the keys
  const beat = t * 1.4 * Math.PI;
  const phrase = Math.sin(t * 0.55);                // the long lean back on a held note
  const rock = Math.sin(beat) * 0.06;
  const dip = Math.max(0, Math.sin(beat)) * 0.045;
  const breath = Math.sin(t * 1.7) * 0.022;
  const keys = Math.sin(t * 9.5) * Math.sin(t * 2.3);
  const L = SAX_ARMS.L;
  const Rr = SAX_ARMS.R;
  const lift = Math.max(0, phrase) * 0.14;
  rig.armL.pivot.rotation.set(L.px + breath - lift, 0, L.pz);
  rig.armL.elbow.rotation.set(L.ex + keys * 0.06, 0, L.ez);
  rig.armR.pivot.rotation.set(Rr.px + breath - lift, 0, Rr.pz);
  rig.armR.elbow.rotation.set(Rr.ex + keys * 0.09, 0, Rr.ez);
  rig.torso.rotation.x = rock - Math.max(0, phrase) * 0.16;
  rig.torso.rotation.y = Math.sin(t * 0.7) * 0.12;
  rig.torso.rotation.z = Math.sin(beat * 0.5) * 0.05;
  rig.head.rotation.x = 0.06 + breath * 0.8 - Math.max(0, phrase) * 0.12;
  rig.head.rotation.z = Math.sin(beat * 0.5) * 0.06;
  if (rig.hips) rig.hips.position.y = rig.hipY - dip;
  if (rig.legL) { rig.legL.knee.rotation.x = 0.08 + dip * 4; rig.legR.knee.rotation.x = 0.08 + dip * 4; rig.legL.pivot.rotation.x = -dip * 2; rig.legR.pivot.rotation.x = -dip * 2; }
  if (rig.saxProp) rig.saxProp.rotation.x = -0.295 - Math.max(0, phrase) * 0.12;
}

/**
 * A punch with a body behind it: he winds the shoulder back, turns the hips and chest through
 * the swing, drives the elbow open, and pulls the other hand in as a counterweight. `u` runs
 * 0..1 across the swing. A straight arm held out at shoulder height was the whole animation
 * before this, and it read like a man pointing at something.
 */
export function punchPose(rig, u) {
  const swing = u < 0.32 ? u / 0.32 : u < 0.52 ? 1 : 1 - Math.min(1, (u - 0.52) / 0.48);
  const wind = Math.max(0, 1 - u / 0.32);
  const s = swing * (1 + 0.12 * wind);
  // right arm: guard at the chin, elbow opens into the punch
  rig.armR.pivot.rotation.set(-0.5 - 1.0 * s + 0.18 * wind, 0, 0.16 - 0.3 * s);
  rig.armR.elbow.rotation.set(-1.5 + 1.38 * s, 0, 0);
  // left arm comes back to the ribs, which is what makes it look like weight
  rig.armL.pivot.rotation.set(0.3 * s, 0, -0.14 - 0.22 * s);
  rig.armL.elbow.rotation.set(-1.15 - 0.45 * s, 0, 0);
  // hips and chest turn into it; the head stays on the person he hit
  rig.hips.rotation.y = -0.3 * s;
  rig.torso.rotation.set(0.07 * s, -0.45 * s, 0.05 * s);
  rig.head.rotation.set(0.04, 0.32 * s, 0);
  rig.legL.pivot.rotation.x = -0.2 * s;
  rig.legR.pivot.rotation.x = 0.24 * s;
  rig.legL.knee.rotation.x = 0.12 * s;
  rig.legR.knee.rotation.x = 0.06 * s;
}

/**
 * A kick with the right foot, `u` 0..1: the knee comes up, the leg snaps out, and it comes back
 * down; the arms swing the other way for balance.
 */
export function kickPose(rig, u) {
  const up = u < 0.3 ? u / 0.3 : u < 0.55 ? 1 : 1 - Math.min(1, (u - 0.55) / 0.45);
  const snap = u < 0.3 ? 0 : u < 0.55 ? (u - 0.3) / 0.25 : 1 - Math.min(1, (u - 0.55) / 0.45);
  rig.legR.pivot.rotation.x = 1.35 * up;
  rig.legR.knee.rotation.x = 1.3 * up * (1 - snap) + 0.08;
  rig.legL.pivot.rotation.x = -0.12 * up;
  rig.legL.knee.rotation.x = 0.18 * up;
  rig.torso.rotation.set(-0.18 * up, 0, 0);
  rig.armL.pivot.rotation.set(-0.6 * up, 0, -0.5 * up);
  rig.armR.pivot.rotation.set(0.5 * up, 0, 0.45 * up);
  rig.hips.rotation.y = 0.15 * up;
}

/**
 * Hands up, chin down, weight on the back foot, bouncing a little: the half second before
 * somebody decides to swing back. `t` is a running clock, for the bounce.
 */
export function guardPose(rig, t = 0) {
  const bob = Math.sin(t * 3.4);
  rig.armR.pivot.rotation.set(-0.98 + bob * 0.05, 0, -0.2);
  rig.armR.elbow.rotation.set(-1.78, 0, 0);
  rig.armL.pivot.rotation.set(-0.86 - bob * 0.04, 0, 0.22);
  rig.armL.elbow.rotation.set(-1.92, 0, 0);
  rig.torso.rotation.set(0.07, Math.sin(t * 1.7) * 0.09, 0);
  rig.hips.rotation.y = 0;
  rig.head.rotation.set(0.03, 0, 0);
  rig.legL.pivot.rotation.x = -0.13;
  rig.legR.pivot.rotation.x = 0.17;
  rig.legL.knee.rotation.x = 0.15;
  rig.legR.knee.rotation.x = 0.1;
}

/**
 * Out cold on the pavement: limbs loose where they fell, chest still moving. The world lays the
 * root down once; this keeps the body from getting back into the idle cycle and walking off
 * while it lies there.
 */
export function animateDown(rig) {
  rig.hips.position.y = rig.hipY - 0.02;
  rig.hips.rotation.set(0, 0, 0);
  rig.torso.rotation.set(0, 0, 0);
  rig.legL.pivot.rotation.set(-0.3, 0, -0.18);
  rig.legL.knee.rotation.set(0.55, 0, 0);
  rig.legR.pivot.rotation.set(0.14, 0, 0.22);
  rig.legR.knee.rotation.set(0.2, 0, 0);
  rig.armL.pivot.rotation.set(0.18, 0, -1.1);
  rig.armL.elbow.rotation.set(-0.4, 0, 0);
  rig.armR.pivot.rotation.set(0.26, 0, 0.95);
  rig.armR.elbow.rotation.set(-0.3, 0, 0);
  rig.head.rotation.set(-0.14, 0.4, 0.12);
}

/** The same song, every day, a little better than it needs to be. */
export function animateSax(rig, dt) {
  rig.saxT = (rig.saxT || 0) + dt;
  poseSax(rig, rig.saxT);
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
  const shirt = spec.shirtMap
    ? retroMaterial(`npcShirt${kind}`, { color: 0xffffff, map: tex(spec.shirtMap), ambient: 0.7 })
    : retroMaterial(`npcShirt${kind}`, { color: spec.shirt ?? 0x555a52, ambient: 0.6 });
  const rig = buildBody({
    ...spec,
    kind: known ? kind : 'kev',
    shirtMat: shirt,
    pantsMat: retroMaterial(`npcPants${kind}`, { color: spec.pants ?? 0x2c3038, ambient: 0.6 }),
    shoeMat: retroMaterial(`npcShoe${kind}`, { color: spec.shoes ?? 0x2a2622 }),
    armMat: spec.longSleeves ? shirt : skinTone,
    // a tank top has no sleeves: the shoulder caps are skin
    sleeveMat: spec.tank ? skinTone : shirt,
    handMat: skinTone,
    // bare legs: the pelvis and the legs are skin, and a skirt goes over them below
    ...(spec.bareLegs ? { pantsMat: skinTone } : {}),
  });
  rig.root.name = kind;
  const { k } = rig;
  if (spec.hoodie) {
    // zip line, two drawstrings, and the hood bunched at the back of the neck
    const zip = retroMaterial('hoodiezip', { color: 0x8a8a8e, ambient: 0.8 });
    rig.torso.add(box(0.012 * k, 0.5 * k, 0.012 * k, zip, [0, 0.17 * k, 0.128 * k]));
    for (const sx of [-1, 1]) rig.torso.add(box(0.012 * k, 0.16 * k, 0.012 * k, zip, [sx * 0.045 * k, 0.33 * k, 0.13 * k]));
    rig.torso.add(loft(R([[0.47, 0.3, 0.12, -0.11], [0.4, 0.34, 0.14, -0.12], [0.33, 0.24, 0.1, -0.12]], k), shirt, 8));
  }
  if (spec.tank) {
    // the scoop: chest and shoulders show above the neckline, two straps over them
    rig.torso.add(loft(R([[0.452, 0.19, 0.13, -0.015], [0.43, 0.3, 0.17, -0.004], [0.39, 0.32, 0.2, 0.012]], k, 0.9), skinTone, 10));
    for (const sx of [-1, 1]) rig.torso.add(box(0.045 * k, 0.06 * k, 0.2 * k, shirt, [sx * 0.11 * k, 0.43 * k, 0]));
  }
  if (kind === 'nurse') {
    // the dress: the bodice is the shirt; a flared white skirt from the waist to mid-thigh with a
    // pink hem, a pink belt and a pink cross on the front, puffed cap sleeves, a fuller chest, and
    // the little cap with the cross pinned on top of her hair
    const white = shirt;
    const pink = retroMaterial('nursePink', { color: 0xe86aa0, ambient: 0.75 });
    rig.hips.add(loft(R([[0.12, 0.36, 0.24], [0.0, 0.47, 0.3], [-0.11, 0.52, 0.33], [-0.16, 0.53, 0.34]], k), white, 10));
    rig.hips.add(loft(R([[-0.155, 0.535, 0.345], [-0.18, 0.54, 0.35]], k), pink, 10));
    rig.torso.add(loft(R([[-0.02, 0.37, 0.225], [0.03, 0.37, 0.225]], k), pink, 10));
    rig.torso.add(loft(R([[0.22, 0.25, 0.1, 0.07], [0.29, 0.32, 0.14, 0.085], [0.36, 0.3, 0.12, 0.07]], k), white, 10));
    rig.torso.add(box(0.07 * k, 0.022 * k, 0.012 * k, pink, [0, 0.12 * k, 0.122 * k]));
    rig.torso.add(box(0.022 * k, 0.07 * k, 0.012 * k, pink, [0, 0.12 * k, 0.122 * k]));
    for (const arm of [rig.armL, rig.armR]) arm.pivot.add(loft(R([[0.04, 0.12, 0.13], [-0.02, 0.16, 0.16], [-0.09, 0.15, 0.15]], k), white, 8));
    const cap = new THREE.Group();
    cap.add(box(0.19 * k, 0.08 * k, 0.12 * k, white, [0, 0, 0]));
    cap.add(box(0.05 * k, 0.014 * k, 0.006 * k, pink, [0, 0.005 * k, 0.062 * k]));
    cap.add(box(0.014 * k, 0.05 * k, 0.006 * k, pink, [0, 0.005 * k, 0.062 * k]));
    cap.position.set(0, 0.2 * k, 0.03 * k);
    cap.rotation.x = -0.25;
    rig.head.add(cap);
    rig.hat = cap;
    // a wristband in pink on the left
    rig.armL.elbow.add(box(0.1 * k, 0.04 * k, 0.1 * k, pink, [0, -0.2 * k, 0]));
  }
  if (kind === 'thug_armed') {
    // a handgun tucked into the waistband, grip out, where everybody can see it
    const gm = retroMaterial('gun', { color: 0x141416 });
    const gun = new THREE.Group();
    gun.add(box(0.035 * k, 0.12 * k, 0.03 * k, gm, [0, 0, 0]));
    gun.add(box(0.035 * k, 0.035 * k, 0.13 * k, gm, [0, 0.055 * k, -0.05 * k]));
    gun.position.set(0.1 * k, -0.02 * k, 0.15 * k);
    gun.rotation.x = 0.2;
    rig.torso.add(gun);
  }
  if (kind === 'rasta') {
    // the tam: a knitted crown that sits high and bulges at the back with the locks inside it,
    // and a few locks out the back past the shoulders
    const knit = retroMaterial('rastaKnit', { color: 0xffffff, map: tex('rastaKnit'), ambient: 0.75 });
    const tam = new THREE.Mesh(new THREE.SphereGeometry(0.15 * k, 10, 8), knit);
    tam.scale.set(1.12, 0.82, 1.32);
    tam.position.set(0, 0.2 * k, -0.04 * k);
    rig.head.add(tam);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.128 * k, 0.13 * k, 0.05 * k, 12), knit);
    band.position.set(0, 0.14 * k, -0.005 * k);
    rig.head.add(band);
    const lock = retroMaterial('rastaLock', { color: 0x2a1e14 });
    for (let i = 0; i < 6; i++) {
      const a = (i - 2.5) * 0.18;
      rig.head.add(box(0.03 * k, 0.26 * k, 0.03 * k, lock, [Math.sin(a) * 0.1 * k, -0.02 * k, -0.11 * k - Math.abs(a) * 0.02 * k], [0.15, 0, a * 0.6]));
    }
  }
  if (kind === 'pawnbroker') {
    // a white vest showing down the middle of the open shirt, and a lot of gold
    const vest = retroMaterial('pawnVest', { color: 0xeeeae2, ambient: 0.75 });
    rig.torso.add(box(0.12 * k, 0.42 * k, 0.02 * k, vest, [0, 0.2 * k, 0.142 * k]));
    const gold = retroMaterial('pawnGold', { color: 0xe0b23a, ambient: 1, emissive: 0.15 });
    for (const [r, y] of [[0.1, 0.39], [0.12, 0.35]]) {
      const chain = new THREE.Mesh(new THREE.TorusGeometry(r * k, 0.012 * k, 4, 14, Math.PI), gold);
      chain.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI);
      chain.position.set(0, y * k, 0.06 * k);
      rig.torso.add(chain);
    }
  }
  if (kind === 'transit') {
    // a brass badge on the chest and the authority's patch on the shoulder
    rig.torso.add(box(0.05 * k, 0.06 * k, 0.012 * k, retroMaterial('transitBadge', { color: 0xd8b04a, emissive: 0.2 }), [0.07 * k, 0.32 * k, 0.14 * k]));
    rig.torso.add(box(0.06 * k, 0.06 * k, 0.012 * k, retroMaterial('transitPatch', { color: 0x2a6ab8 }), [-0.07 * k, 0.32 * k, 0.14 * k]));
  }
  if (kind === 'hookah') {
    // a wound turban, dark navy, wrapped in layers; a beard that reaches the chest; the kurta
    // falling past the hips
    const cloth = retroMaterial('turbanCloth', { color: 0x23264a, ambient: 0.75 });
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.15 * k, 12, 8), cloth);
    crown.scale.set(1.12, 0.78, 1.18);
    crown.position.set(0, 0.17 * k, -0.01 * k);
    rig.head.add(crown);
    for (let i = 0; i < 3; i++) {
      const wrap = new THREE.Mesh(new THREE.TorusGeometry((0.128 + i * 0.006) * k, 0.022 * k, 5, 14), cloth);
      wrap.rotation.set(Math.PI / 2 + (i - 1) * 0.18, 0, (i - 1) * 0.12);
      wrap.position.set(0, (0.12 + i * 0.04) * k, -0.005 * k);
      rig.head.add(wrap);
    }
    rig.hat = crown;
    const hair = retroMaterial('yusufBeard', { color: 0x141010 });
    rig.head.add(loft(R([[-0.06, 0.2, 0.12, 0.06], [-0.16, 0.18, 0.1, 0.07], [-0.26, 0.12, 0.07, 0.06], [-0.32, 0.05, 0.04, 0.05]], k), hair, 8));
    rig.torso.add(loft(R([[0.02, 0.36, 0.22, 0], [-0.36, 0.4, 0.24, 0]], k), retroMaterial('kurtaHem', { color: 0xe4dece, ambient: 0.65 }), 8));
  }
  if (kind === 'viejo') {
    // a flat cap, grey tweed
    const tweed = retroMaterial('titoCap', { color: 0x6a6a62, ambient: 0.7 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * k, 0.135 * k, 0.07 * k, 12), tweed);
    cap.position.set(0, 0.15 * k, -0.01 * k);
    rig.head.add(cap);
    rig.head.add(box(0.2 * k, 0.015 * k, 0.08 * k, tweed, [0, 0.125 * k, 0.12 * k], [0.25, 0, 0]));
    rig.hat = cap;
  }
  if (kind === 'papi') {
    // a thin gold chain with a medal on it, on the tank top
    const gold = retroMaterial('papiGold', { color: 0xe0b23a, ambient: 1, emissive: 0.15 });
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.095 * k, 0.008 * k, 4, 14, Math.PI), gold);
    chain.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI);
    chain.position.set(0, 0.38 * k, 0.06 * k);
    rig.torso.add(chain);
    rig.torso.add(box(0.03 * k, 0.035 * k, 0.01 * k, gold, [0, 0.29 * k, 0.15 * k]));
  }
  if (kind === 'chessman') {
    // a flat cap, brown tweed, brim pulled down to the glasses
    const tweed = retroMaterial('chessCap', { color: 0x5a4a38, ambient: 0.7 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * k, 0.135 * k, 0.07 * k, 12), tweed);
    cap.position.set(0, 0.15 * k, -0.01 * k);
    cap.scale.set(1, 1, 1.1);
    rig.head.add(cap);
    rig.head.add(box(0.2 * k, 0.015 * k, 0.08 * k, tweed, [0, 0.125 * k, 0.12 * k], [0.25, 0, 0]));
    rig.hat = cap;
  }
  // generic workwear: an apron (optionally striped), a baseball cap, a chef's toque
  if (spec.apron) {
    const am = retroMaterial(`apron${spec.apron}`, { color: spec.apron, ambient: 0.75 });
    rig.torso.add(box(0.3 * k, 0.4 * k, 0.012 * k, am, [0, 0.12 * k, 0.128 * k]));
    rig.hips.add(box(0.34 * k, 0.42 * k, 0.012 * k, am, [0, -0.14 * k, 0.135 * k]));
    if (spec.apronStripe) for (let i = -2; i <= 2; i++) rig.hips.add(box(0.018 * k, 0.42 * k, 0.014 * k, retroMaterial(`apronStripe${spec.apronStripe}`, { color: spec.apronStripe }), [i * 0.06 * k, -0.14 * k, 0.137 * k]));
  }
  if (spec.cap) {
    const cm = retroMaterial(`cap${spec.cap}`, { color: spec.cap, ambient: 0.7 });
    const cap = new THREE.Group();
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.145 * k, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), cm);
    crown.scale.set(1.05, 0.7, 1.12);
    cap.add(crown);
    cap.add(box(0.2 * k, 0.012 * k, (spec.capBrim || 0.13) * k, cm, [0, 0.005 * k, 0.15 * k]));
    cap.position.set(0, 0.12 * k, -0.005 * k);
    rig.head.add(cap);
    rig.hat = cap;
  }
  if (spec.chefHat) {
    const wm = retroMaterial('chefHat', { color: 0xf8f8f4, ambient: 0.85 });
    const hat = new THREE.Group();
    hat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.135 * k, 0.13 * k, 0.12 * k, 12), wm));
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.15 * k, 10, 6), wm);
    puff.scale.set(1, 0.6, 1);
    puff.position.y = 0.08 * k;
    hat.add(puff);
    hat.position.set(0, 0.2 * k, -0.005 * k);
    rig.head.add(hat);
    rig.hat = hat;
  }
  if (kind === 'trench') {
    // the trenchcoat: a long tan loft from the shoulders to the shins over the shirt, a darker belt,
    // the collar turned up round the neck
    const coat = retroMaterial('trenchCoat', { color: 0xa8875a, ambient: 0.65 });
    rig.torso.add(loft(R([[0.0, 0.3, 0.2, 0], [-0.3, 0.33, 0.22, 0]], k), coat, 8));
    rig.hips.add(loft(R([[0.02, 0.31, 0.21, 0], [-0.7, 0.38, 0.25, 0]], k), coat, 8));
    rig.hips.add(box(0.6 * k, 0.045 * k, 0.43 * k, retroMaterial('trenchBelt', { color: 0x6a4e2e }), [0, 0, 0]));
    for (const sx of [-1, 1]) rig.torso.add(box(0.06 * k, 0.09 * k, 0.16 * k, coat, [sx * 0.085 * k, 0.4 * k, 0.02 * k], [0, 0, sx * 0.35]));
  }
  if (kind === 'hasid' || kind === 'hasid2') {
    // a black wide-brimmed hat on a black skullcap; the long coat hangs past the hips; sidelocks
    // curl down in front of the ears; a white collar shows
    const felt = retroMaterial('hasidHat', { color: 0x0c0c0e, ambient: 0.55 });
    const hat = new THREE.Group();
    hat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15 * k, 0.165 * k, 0.17 * k, 16), felt));
    hat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.27 * k, 0.27 * k, 0.018 * k, 20), felt).translateY(-0.075 * k));
    hat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.168 * k, 0.168 * k, 0.03 * k, 16), retroMaterial('hasidBand', { color: 0x1c1c20 })).translateY(-0.052 * k));
    hat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.125 * k, 0.125 * k, 0.04 * k, 12), retroMaterial('kippah', { color: 0x0c0c0e })).translateY(-0.09 * k));
    hat.position.set(0, 0.2 * k, -0.01 * k);
    rig.head.add(hat);
    rig.hat = hat;
    // the sidelocks: long curls hanging in front of the ears to the jaw
    const curl = retroMaterial(`peyos${kind}`, { color: kind === 'hasid' ? 0x3a2414 : 0x141010 });
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 6; i++) rig.head.add(box(0.035 * k, 0.045 * k, 0.035 * k, curl, [sx * (0.128 + (i % 2) * 0.014) * k, (0.03 - i * 0.042) * k, 0.045 * k], [0, 0, sx * (i % 2 ? 0.45 : -0.45)]));
    }
    const coat = retroMaterial('hasidCoat', { color: 0x0e0e10, ambient: 0.6 });
    rig.torso.add(loft(R([[0.02, 0.33, 0.2, 0], [-0.32, 0.37, 0.22, 0]], k), coat, 8));
    rig.torso.add(box(0.1 * k, 0.05 * k, 0.02 * k, retroMaterial('hasidCollar', { color: 0xf2f2ec, ambient: 0.9 }), [0, 0.44 * k, 0.12 * k]));
  }
  if (kind === 'angel_m' || kind === 'angel_f') {
    // the red beret, tilted; and the patch on the back with the wings and the name
    const red = retroMaterial('angelBeret', { color: 0xb01a18, ambient: 0.75 });
    const beret = new THREE.Mesh(new THREE.SphereGeometry(0.13 * k, 10, 6), red);
    beret.scale.set(1.15, 0.38, 1.15);
    beret.position.set(0.03 * k, 0.15 * k, -0.01 * k);
    beret.rotation.z = -0.22;
    rig.head.add(beret);
    rig.hat = beret;
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.26 * k, 0.14 * k), retroMaterial('angelPatch', { color: 0xffffff, map: tex('angelPatch'), ambient: 0.9 }));
    patch.position.set(0, 0.3 * k, -0.135 * k);
    patch.rotation.y = Math.PI;
    rig.torso.add(patch);
    rig.torso.add(box(0.035 * k, 0.09 * k, 0.025 * k, retroMaterial('angelRadio', { color: 0x141416 }), [0.12 * k, 0.32 * k, 0.13 * k]));
  }
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
  const { walking = false, sitting = false, sleeping = false, ground = false } = opts;
  rig.t += dt * (walking ? 6.4 : 1);
  const t = rig.t;
  if (rig.type === 'cat') {
    rig.tail.rotation.y = Math.sin(t * 2.2) * 0.5;
    rig.root.position.y = (rig.baseY || 0) + Math.abs(Math.sin(t * 0.7)) * 0.01;
    return;
  }
  if (sleeping) {
    // on his back on the pavement, not hovering over it: the hips drop to the thickness of the
    // body and the legs lie along the ground instead of sticking up in the air
    rig.hips.position.y = 0.1;
    rig.hips.rotation.x = -1.5;
    rig.legL.pivot.rotation.x = 0.12;
    rig.legR.pivot.rotation.x = 0.2;
    rig.legL.knee.rotation.x = 0.22;
    rig.legR.knee.rotation.x = 0.32;
    rig.armL.pivot.rotation.z = -0.5;
    rig.armR.pivot.rotation.z = 0.55;
    rig.armL.pivot.rotation.x = -0.35;
    rig.armR.pivot.rotation.x = -0.2;
    rig.head.rotation.x = 0.3;
    return;
  }
  if (ground) {
    // sitting on the pavement with his back against nothing: knees up, elbows on them, and the
    // slowest nod in the world. Butt on the ground, not in the air above it.
    rig.hips.position.y = rig.hipY - 0.64;
    rig.hips.rotation.set(0, 0, 0);
    rig.torso.rotation.set(0.1, Math.sin(t * 0.4) * 0.06, 0);
    rig.legL.pivot.rotation.set(-1.25, 0, -0.16);
    rig.legR.pivot.rotation.set(-1.05, 0, 0.2);
    rig.legL.knee.rotation.set(0.75, 0, 0);
    rig.legR.knee.rotation.set(0.5, 0, 0);
    rig.armL.pivot.rotation.set(-0.62, 0, 0.24);
    rig.armL.elbow.rotation.set(-1.15, 0, 0);
    rig.armR.pivot.rotation.set(-0.78, 0, -0.22);
    rig.armR.elbow.rotation.set(-1.3, 0, 0);
    rig.head.rotation.set(0.26 + Math.sin(t * 0.55) * 0.05, Math.sin(t * 0.31) * 0.12, 0);
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
