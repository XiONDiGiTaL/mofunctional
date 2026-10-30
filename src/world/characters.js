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
  shirt: retroMaterial('tee', { color: 0xe6e5e0, ambient: 0.62 }),
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
  if (!headMatCache.has(kind)) headMatCache.set(kind, retroMaterial(`head_${kind}`, { map: headTexture(kind), ambient: 1.0, dither: 0.35 }));
  return headMatCache.get(kind);
}

/** Hair volume per style, as shells over the skull (short styles live in the texture). */
const HAIR_SHELLS = {
  swept: { tMin: (a) => (Math.abs(a) < 1.1 ? 0.84 : 0.6 - 0.18 * Math.min(1, (Math.abs(a) - 1.1) / 2)), grow: 1.07 },
  bob: { tMin: (a) => (Math.abs(a) < 0.95 ? 0.7 : 0.18), grow: 1.09 },
  dread: { tMin: (a) => (Math.abs(a) < 1.05 ? 0.8 : 0.45), grow: 1.08 },
  braids: { tMin: (a) => (Math.abs(a) < 1.1 ? 0.82 : 0.4), grow: 1.04 },
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
  if (style === 'swept') {
    // the Reverend's pompadour
    const q = prism(0.5 * hh, 0.62 * hh, 0.28 * hh, 0.36 * hh, 0.14 * hh, hair, [0, 1.07 * hh, 0.12 * hh], 8, [-0.35, 0, 0]);
    g.add(q);
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
 * Build a jointed body. `spec` carries every appearance value so Mo and the NPCs run through
 * exactly the same rig: same proportions, same joint chain, same head construction.
 *
 * Volumes follow assets/ref/mo_body_reference.png: sloped shoulders that grow out of the neck,
 * one sleeve volume per arm ending at mid-bicep, the forearm a touch thinner than the upper arm,
 * hips wider than the waist, thighs that taper into the knee, and a belt where the tee meets the
 * jeans. The head is deliberately smaller than the torso's width so the painted face reads as a
 * face on a person rather than a mask on a slab.
 */
function buildBody(spec) {
  const {
    kind = 'kev', height = 1.78, build = 1,
    shirtMat, pantsMat, shoeMat,
    armMat, sleeveMat, handMat,
    suit = false,
  } = spec;
  // skin / hair come from the face spec so the body matches the painted head exactly
  const fs = faceSpec(kind);
  const skinColor = parseInt(fs.skin.slice(1), 16);
  const hairColor = parseInt(fs.hair.slice(1), 16);
  const hairStyle = fs.style || spec.style || 'short';

  const k = height / 1.78;
  const b = build;
  const skin = tone(skinColor);

  // vertical stack of a 1.78 m figure: crotch at 0.53, shoulder line at 0.83, crown at 1.78
  const footH = 0.072 * k;
  const calfH = 0.440 * k;
  const thighH = 0.440 * k;
  const pelvisH = 0.120 * k;
  const abdomenH = 0.150 * k;
  const chestH = 0.260 * k;
  const neckH = 0.060 * k;
  const headH = 0.215 * k;
  const hipY = footH + calfH + thighH;
  const shoulderY = abdomenH + chestH;

  const hipW = 0.330 * b * k;       // pelvis, wider than the waist
  const waistW = 0.296 * b * k;
  const chestW = 0.392 * b * k;
  const shoulderW = 0.436 * b * k;  // deltoid to deltoid
  const shoulderX = shoulderW / 2 - 0.085 * k;  // the arm hangs inside the deltoid

  const root = new THREE.Group();
  root.add(shadowBlob(0.26 + 0.06 * k));

  const hips = joint(root, 0, hipY, 0);
  hips.add(prism(waistW, hipW, 0.205 * k, 0.222 * k, pelvisH, pantsMat, [0, pelvisH, 0], 8));

  function makeLeg(sx) {
    const pivot = joint(hips, sx * hipW * 0.27, -0.01 * k, 0);
    pivot.add(prism(0.176 * b * k, 0.128 * b * k, 0.186 * k, 0.146 * k, thighH, pantsMat, [0, 0.012 * k, 0], 7));
    const knee = joint(pivot, 0, -thighH, 0);
    knee.add(prism(0.128 * b * k, 0.094 * b * k, 0.146 * k, 0.106 * k, calfH, pantsMat, [0, 0.006 * k, 0], 7));
    const ankle = joint(knee, 0, -calfH, 0);
    ankle.add(prism(0.104 * k, 0.112 * k, 0.125 * k, 0.255 * k, footH, shoeMat, [0, 0, 0.045 * k], 6));
    return { pivot, knee, ankle };
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  const torso = joint(hips, 0, pelvisH, 0);
  // abdomen narrows into the waist ...
  torso.add(prism(waistW * 1.16, waistW, 0.196 * k, 0.206 * k, abdomenH, shirtMat, [0, abdomenH, 0], 8));
  // ... the chest widens and deepens above it ...
  // ... and the chest runs all the way to the shoulder line, so its own top edge is the shoulder
  torso.add(prism(chestW, waistW * 1.16, 0.245 * k, 0.200 * k, chestH, shirtMat, [0, shoulderY, 0], 8));

  // neck: visible above the collar, running up inside the skull so there is no step
  torso.add(prism(0.104 * k, 0.120 * k, 0.098 * k, 0.114 * k, neckH + 0.05 * k, skin, [0, shoulderY + neckH + 0.035 * k, -0.006 * k], 8));
  const head = joint(torso, 0, shoulderY + neckH + 0.012 * k, 0);
  const headGroup = buildHead({ hh: headH, kind, style: hairStyle, skinMat: tone(skinColor, 0.95), hairColor });
  headGroup.position.set(0, -0.02 * k, 0.0);
  head.add(headGroup);

  const upperH = 0.288 * k;
  const foreH = 0.248 * k;
  const handH = 0.090 * k;

  function makeArm(sx) {
    const pivot = joint(torso, sx * shoulderX, shoulderY - 0.020 * k, 0);
    // deltoid and sleeve are one volume: full over the shoulder, ending at mid-bicep
    pivot.add(prism(0.112 * b * k, 0.106 * b * k, 0.134 * k, 0.124 * k, upperH * 0.52, sleeveMat, [0, -0.050 * k, 0.004 * k], 8));
    pivot.add(prism(0.094 * b * k, 0.080 * b * k, 0.104 * k, 0.092 * k, upperH, armMat, [0, 0, 0.004 * k], 8));
    const elbow = joint(pivot, 0, -upperH, 0);
    elbow.add(prism(0.086 * b * k, 0.062 * b * k, 0.094 * k, 0.072 * k, foreH, armMat === sleeveMat ? sleeveMat : armMat, [0, 0.006 * k, 0.004 * k], 8));
    // fist: a small faceted block with a thumb, no wrist ball
    const hand = prism(0.070 * k, 0.064 * k, 0.052 * k, 0.048 * k, handH, handMat || skin, [0, -foreH - 0.004 * k, 0.012 * k], 6);
    elbow.add(hand);
    elbow.add(prism(0.026 * k, 0.022 * k, 0.030 * k, 0.026 * k, handH * 0.52, handMat || skin, [sx * -0.028 * k, -foreH + 0.006 * k, 0.026 * k], 5));
    return { pivot, elbow, hand };
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  return { root, hips, torso, head, legL, legR, armL, armR, hipY, shoulderY, headH, k, t: 0, suit };
}

/* ---------------------------------- cast ---------------------------------- */

const CAST = {
  mo: { height: 1.78, skin: 0x8f6446, hair: 0x201812, style: 'short', beard: 'goatee' },
  addison: { height: 1.86, build: 1.03, skin: 0xdcbb95, hair: 0xb9b6ad, style: 'swept', beard: 'full' },
  rae: { height: 1.66, skin: 0xe0c0a2, hair: 0x201a20, style: 'bob', shirt: 0x6d5a74, pants: 0x3a3442 },
  dale: { height: 1.72, skin: 0xbf9d80, hair: 0x9d9c96, style: 'receding', beard: 'stubble', shirt: 0x2f6b4a, pants: 0x26302a },
  dex: { height: 1.69, build: 1.05, skin: 0x784f34, hair: 0x241812, style: 'dread', beard: 'full', shirt: 0x2a2f3a, pants: 0x20242c },
  kev: { height: 1.75, skin: 0xc79e74, hair: 0xc49a52, style: 'crop', shirt: 0xa05a3a, pants: 0x33405a },
  nia: { height: 1.63, skin: 0xa97a52, hair: 0x2a1a12, style: 'braids', shirt: 0x4a6a8a, pants: 0x2f3a46 },
  miguel: { height: 1.70, skin: 0xb07f54, hair: 0x2b2118, style: 'short', beard: 'full', shirt: 0x7d5a3a, pants: 0x333230 },
  habib: { height: 1.74, skin: 0xa87c52, hair: 0x241a12, style: 'short', beard: 'full', shirt: 0xd6d0c2, pants: 0x2a2a30 },
  homeless: { height: 1.71, skin: 0x87603f, hair: 0x3a302a, style: 'receding', beard: 'full', shirt: 0x4a463e, pants: 0x35322c },
  junkie: { height: 1.68, skin: 0xa8835f, hair: 0x2f2620, style: 'crop', beard: 'stubble', shirt: 0x3c3a34, pants: 0x2c2a26 },
  clerk: { height: 1.73, skin: 0xc49b74, hair: 0x342a20, style: 'crop', shirt: 0x3b5a44, pants: 0x2e3238 },
};

export function createMo() {
  const rig = buildBody({
    ...CAST.mo,
    kind: 'mo',
    // plain white tee, plain blue jeans: no patches, no stains, nothing stuck to the shirt
    shirtMat: mat.shirt,
    pantsMat: mat.denim,
    shoeMat: mat.shoe,
    armMat: mat.skin,
    sleeveMat: mat.shirt,
    handMat: mat.skin,
  });
  rig.root.name = 'Mo';
  const { k } = rig;

  // tee collar: a thin ring of fabric at the base of the neck
  rig.torso.add(prism(0.118 * k, 0.134 * k, 0.112 * k, 0.132 * k, 0.03 * k, mat.shirt, [0, rig.shoulderY + 0.014 * k, -0.004 * k], 8));
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
  const chestTop = rig.shoulderY;

  rig.torso.add(box(0.14 * k, 0.20 * k, 0.012 * k, mat.dressShirt, [0, chestTop - 0.13 * k, 0.122 * k]));
  rig.torso.add(box(0.072 * k, 0.30 * k, 0.014 * k, mat.gold, [0, chestTop - 0.20 * k, 0.128 * k]));
  rig.torso.add(box(0.048 * k, 0.05 * k, 0.016 * k, mat.goldBand, [0, chestTop - 0.055 * k, 0.13 * k]));
  rig.torso.add(box(0.08 * k, 0.014 * k, 0.016 * k, mat.goldBand, [0, chestTop - 0.27 * k, 0.13 * k]));

  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      rig.torso.add(box(0.026 * k, 0.026 * k, 0.012 * k, mat.navy,
        [(-0.075 + i * 0.15) * k, chestTop - 0.14 * k - j * 0.16 * k, 0.124 * k]));
    }
  }
  rig.torso.add(box(0.105 * k, 0.22 * k, 0.014 * k, mat.suit, [-0.10 * k, chestTop - 0.11 * k, 0.124 * k], [0, 0, 0.16]));
  rig.torso.add(box(0.105 * k, 0.22 * k, 0.014 * k, mat.suit, [0.10 * k, chestTop - 0.11 * k, 0.124 * k], [0, 0, -0.16]));
  rig.torso.add(box(0.06 * k, 0.05 * k, 0.014 * k, mat.gold, [0.13 * k, chestTop - 0.30 * k, 0.122 * k], [0, 0, 0.3]));

  for (const a of [rig.armL, rig.armR]) {
    a.elbow.add(box(0.088 * k, 0.035 * k, 0.10 * k, mat.gold, [0, -0.235 * k, 0]));
  }
  return rig;
}

export const NPC_KINDS = Object.keys(CAST).filter((k) => k !== 'mo' && k !== 'addison');

export function createNPC(kind = 'kev') {
  const spec = CAST[kind] || CAST.kev;
  const rig = buildBody({
    ...spec,
    kind: CAST[kind] ? kind : 'kev',
    shirtMat: retroMaterial(`npcShirt${kind}`, { color: spec.shirt ?? 0x555a52 }),
    pantsMat: retroMaterial(`npcPants${kind}`, { color: spec.pants ?? 0x2c3038 }),
    shoeMat: retroMaterial(`npcShoe${kind}`, { color: 0x22221f }),
    armMat: retroMaterial(`npcArm${kind}`, { color: spec.shirt ?? 0x555a52 }),
    sleeveMat: retroMaterial(`npcShirtS${kind}`, { color: spec.shirt ?? 0x555a52 }),
    handMat: tone(parseInt(faceSpec(CAST[kind] ? kind : 'kev').skin.slice(1), 16)),
  });
  rig.root.name = kind;
  if (kind === 'miguel' || kind === 'habib' || kind === 'clerk') {
    // shop apron
    const { k } = rig;
    rig.torso.add(box(0.30 * k, 0.34 * k, 0.02 * k, retroMaterial(`apron${kind}`, { color: kind === 'habib' ? 0x4a5a44 : 0x5a4a38 }), [0, rig.shoulderY - 0.20 * k, 0.120 * k]));
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
