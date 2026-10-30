/**
 * Low-poly character rigs: Mo, Addison Octavius, and everyone else in the neighbourhood.
 *
 * Proportions follow a ~7.5-head figure (head 0.238 m on a 1.78 m body): shoulders ~2.2 heads
 * wide, fingertips at mid-thigh, legs slightly more than half the height. Every body part is a
 * tapered box hanging from a joint pivot (shoulder, elbow, wrist, hip, knee, ankle).
 *
 * Heads are 90s-era volumes: a tapered skull whose front plane carries the painted portrait
 * from render/faces.js, wrapped in hair and ears, so the face has a painted expression and still
 * turns as geometry. The same portrait painter feeds the HUD and the phone.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box, taper, taperMulti } from '../render/retro.js';
import { npcFaceTexture, faceSkin } from '../render/faces.js';
import { tex } from '../render/textures.js';

/* ------------------------------- materials ------------------------------- */

const mat = {
  skin: retroMaterial('skin', { map: tex('skin'), color: 0xfff2e6 }),
  shirt: retroMaterial('tee', { color: 0xdedbd0 }),
  denim: retroMaterial('jeans', { color: 0x2f4568 }),
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

/** Painted portrait for the front plane of a head, one material per character. */
const faceCache = new Map();
function faceMaterial(kind) {
  if (!faceCache.has(kind)) {
    faceCache.set(kind, retroMaterial(`face${kind}`, { map: npcFaceTexture(kind), color: 0xffffff, ambient: 0.74 }));
  }
  return faceCache.get(kind);
}

/** Side planes use the portrait's own skin value, so the painted cheek meets real cheek. */
function headSideMaterial(kind) {
  const key = `headside${kind}`;
  if (!hairCache.has(key)) hairCache.set(key, retroMaterial(key, { color: faceSkin(kind), ambient: 0.78 }));
  return hairCache.get(key);
}

/* ------------------------------- head geometry ------------------------------ */

/**
 * Skull profile. Each ring is [t (0 = chin bottom, 1 = crown), width, depth, z offset],
 * all normalised so the caller supplies real half-width / half-depth / height in metres.
 * The chin is narrow and pushed forward; the brow and temples carry the widest ring; the
 * back of the skull is flattened slightly so it does not read as a billiard ball.
 */
const SKULL_RINGS = [
  [0.00, 0.32, 0.34, 0.034],
  [0.07, 0.57, 0.63, 0.026],
  [0.18, 0.75, 0.84, 0.010],
  [0.31, 0.87, 0.93, -0.004],
  [0.44, 0.94, 0.98, -0.012],
  [0.57, 0.98, 1.00, -0.018],
  [0.69, 1.00, 1.01, -0.026],
  [0.80, 0.98, 0.99, -0.038],
  [0.90, 0.87, 0.90, -0.050],
  [1.00, 0.44, 0.48, -0.058],
];
const SEG = 12;
const sq = (v) => Math.sign(v) * Math.pow(Math.abs(v), 0.78);

function ringPoint(t, ws, ds, zOff, a, hw, hd, hh) {
  const sx = sq(Math.sin(a));
  const cz = sq(Math.cos(a));
  const back = cz < 0 ? 0.93 : 1;
  return [sx * hw * ws, t * hh, cz * hd * ds * back + zOff * hd];
}

/** Build a flat-shaded shell between a slice of the skull rings (used for skull and hair). */
function shellGeo({ hw, hd, hh, from = 0, to = 1, grow = 1, capTop = true, capBottom = false }) {
  const rings = SKULL_RINGS.filter((r) => r[0] >= from - 0.0001 && r[0] <= to + 0.0001);
  const pos = [];
  const push = (p) => pos.push(p[0], p[1], p[2]);
  const tri = (a, b, c) => { push(a); push(b); push(c); };

  for (let r = 0; r < rings.length - 1; r++) {
    const [t0, w0, d0, z0] = rings[r];
    const [t1, w1, d1, z1] = rings[r + 1];
    for (let s = 0; s < SEG; s++) {
      const a0 = (s / SEG) * Math.PI * 2 - Math.PI;
      const a1 = ((s + 1) / SEG) * Math.PI * 2 - Math.PI;
      const p00 = ringPoint(t0, w0 * grow, d0 * grow, z0, a0, hw, hd, hh);
      const p01 = ringPoint(t0, w0 * grow, d0 * grow, z0, a1, hw, hd, hh);
      const p10 = ringPoint(t1, w1 * grow, d1 * grow, z1, a0, hw, hd, hh);
      const p11 = ringPoint(t1, w1 * grow, d1 * grow, z1, a1, hw, hd, hh);
      tri(p00, p10, p11);
      tri(p00, p11, p01);
    }
  }
  if (capTop) {
    const [t, w, d, z] = rings[rings.length - 1];
    const centre = [0, t * hh + 0.004 * hh, z * hd];
    for (let s = 0; s < SEG; s++) {
      const a0 = (s / SEG) * Math.PI * 2 - Math.PI;
      const a1 = ((s + 1) / SEG) * Math.PI * 2 - Math.PI;
      tri(centre, ringPoint(t, w * grow, d * grow, z, a0, hw, hd, hh), ringPoint(t, w * grow, d * grow, z, a1, hw, hd, hh));
    }
  }
  if (capBottom) {
    const [t, w, d, z] = rings[0];
    const centre = [0, t * hh, z * hd];
    for (let s = 0; s < SEG; s++) {
      const a0 = (s / SEG) * Math.PI * 2 - Math.PI;
      const a1 = ((s + 1) / SEG) * Math.PI * 2 - Math.PI;
      tri(centre, ringPoint(t, w * grow, d * grow, z, a1, hw, hd, hh), ringPoint(t, w * grow, d * grow, z, a0, hw, hd, hh));
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const uv = [];
  for (let i = 0; i < pos.length; i += 3) {
    uv.push(pos[i] / (hw * 2) + 0.5, pos[i + 1] / hh);
  }
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * A complete head, scaled to a given skull size, with hair and optional beard.
 * Everything is parented to a group whose origin sits at the neck joint.
 */
function buildHead({ hw, hd, hh, skinMat, hairColor, style = 'short', kind = 'kev' }) {
  const g = new THREE.Group();
  const hair = hairMat(hairColor);
  const face = faceMaterial(kind);

  // The skull is a tapered box whose front plane carries the painted portrait (128x178, the
  // same 0.72 aspect as the face). The other five planes carry the matching skin value, so the
  // head turns as a volume and the painted cheek meets a real cheek plane at the corner.
  const wTop = hw * 1.96;
  const wBot = hw * 1.88;
  const dTop = hd * 1.90;
  const dBot = hd * 1.82;
  g.add(taperMulti(wTop, wBot, dTop, dBot, hh, [face, skinMat, skinMat, skinMat, skinMat, skinMat], [0, hh, 0]));

  // ears, tucked behind the cheek plane at the level of the eyes
  for (const sx of [-1, 1]) {
    g.add(taper(hw * 0.14, hw * 0.11, hd * 0.17, hd * 0.13, hh * 0.17, skinMat, [sx * hw * 0.87, hh * 0.60, -hd * 0.03]));
  }

  // Hair: crown cap plus back mass. The painted hairline sits about 23% down the portrait, so
  // the geometry stops just above it and the two never fight over the same edge.
  const capW = wTop * 1.05;
  const capD = dTop * 1.03;
  const capH = hh * (style === 'buzz' ? 0.13 : 0.21);
  g.add(box(capW, capH, capD, hair, [0, hh * 0.90, -hd * 0.03]));
  g.add(box(capW * 0.96, hh * 0.64, hd * 0.34, hair, [0, hh * 0.60, -hd * 0.90]));

  if (style === 'crop' || style === 'short' || style === 'buzz' || style === 'receding') {
    for (const sx of [-1, 1]) {
      g.add(box(wTop * 0.10, hh * 0.40, capD * 0.70, hair, [sx * wTop * 0.47, hh * 0.71, -hd * 0.12]));
    }
  }
  if (style === 'swept') {
    const quiff = box(wTop * 1.02, hh * 0.16, hd * 0.52, hair, [0, hh * 0.99, hd * 0.52]);
    quiff.rotation.x = -0.24;
    g.add(quiff);
    for (const sx of [-1, 1]) g.add(box(wTop * 0.09, hh * 0.44, capD * 0.50, hair, [sx * wTop * 0.50, hh * 0.66, -hd * 0.20]));
  }
  if (style === 'bob') {
    for (const sx of [-1, 1]) {
      g.add(box(wTop * 0.20, hh * 0.92, capD * 1.02, hair, [sx * wTop * 0.54, hh * 0.55, -hd * 0.02]));
    }
    g.add(box(capW * 1.04, hh * 0.20, hd * 0.72, hair, [0, hh * 0.92, hd * 0.42]));
  }
  if (style === 'receding') {
    g.add(box(wTop * 0.34, hh * 0.10, hd * 0.16, hair, [0, hh * 0.88, hd * 0.80]));
  }
  if (style === 'dread' || style === 'braids') {
    const count = style === 'dread' ? 7 : 4;
    for (let i = 0; i < count; i++) {
      const a = -0.85 + (i / (count - 1)) * 1.70;
      g.add(box(wTop * 0.13, hh * (0.95 + (i % 3) * 0.10), hd * 0.18, hair,
        [Math.sin(a) * wTop * 0.45, hh * 0.55, -hd * 0.82 + Math.cos(a) * hd * 0.10]));
    }
  }

  return g;
}

/* --------------------------------- bodies --------------------------------- */

/**
 * Build a jointed body. `spec` carries every appearance value so Mo and the NPCs run through
 * exactly the same rig: same proportions, same joint chain, same head construction.
 */
function buildBody(spec) {
  const {
    height = 1.78, build = 1,
    skinColor = 0x8f6446, hairColor = 0x231a14,
    shirtMat, pantsMat, shoeMat,
    armMat, sleeveMat, handMat,
    suit = false,
    hairStyle = 'short', beard = null, beardColor = null, kind = 'kev',
  } = spec;

  const k = height / 1.78;
  const b = build;
  const skin = tone(skinColor);

  const footH = 0.075 * k;
  const calfH = 0.415 * k;
  const thighH = 0.425 * k;
  const pelvisH = 0.14 * k;
  const abdomenH = 0.15 * k;
  const chestH = 0.24 * k;
  const neckH = 0.074 * k;
  const headH = 0.230 * k;
  const hipY = footH + calfH + thighH;
  const shoulderY = abdomenH + chestH;

  const hipW = 0.292 * b * k;
  const waistW = 0.236 * b * k;
  const chestW = 0.322 * b * k;
  const shoulderX = chestW / 2 + 0.018 * k;

  const root = new THREE.Group();
  root.add(shadowBlob(0.26 + 0.06 * k));

  const hips = joint(root, 0, hipY, 0);
  hips.add(taper(waistW, hipW, 0.20 * k, 0.205 * k, pelvisH, pantsMat, [0, pelvisH, 0]));

  function makeLeg(sx) {
    const pivot = joint(hips, sx * 0.082 * b * k, 0, 0);
    pivot.add(taper(0.148 * b * k, 0.113 * b * k, 0.168 * k, 0.132 * k, thighH, pantsMat));
    const knee = joint(pivot, 0, -thighH, 0);
    knee.add(taper(0.113 * b * k, 0.076 * b * k, 0.132 * k, 0.09 * k, calfH, pantsMat));
    const ankle = joint(knee, 0, -calfH, 0);
    ankle.add(taper(0.104 * k, 0.106 * k, 0.126 * k, 0.132 * k, 0.045 * k, pantsMat, [0, 0.042 * k, 0]));
    ankle.add(taper(0.104 * k, 0.110 * k, 0.120 * k, 0.205 * k, footH, shoeMat, [0, 0, 0.030 * k]));
    ankle.add(box(0.102 * k, 0.022 * k, 0.205 * k, shoeMat, [0, -footH, 0.05 * k]));
    return { pivot, knee, ankle };
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  const torso = joint(hips, 0, pelvisH, 0);
  torso.add(taper(waistW * 1.06, waistW, 0.202 * k, 0.188 * k, abdomenH, shirtMat, [0, abdomenH, 0]));
  torso.add(taper((chestW + waistW) / 2, waistW * 1.06, 0.222 * k, 0.202 * k, chestH * 0.55, shirtMat, [0, abdomenH + chestH * 0.55, 0]));
  torso.add(taper(chestW, (chestW + waistW) / 2, 0.238 * k, 0.222 * k, chestH * 0.45, shirtMat, [0, abdomenH + chestH, 0]));

  // neck + head
  const headSide = headSideMaterial(kind);
  torso.add(taper(0.088 * k, 0.100 * k, 0.086 * k, 0.098 * k, neckH, headSide, [0, shoulderY + neckH, 0]));
  const head = joint(torso, 0, shoulderY + neckH, 0);
  head.add(buildHead({
    hw: 0.086 * k, hd: 0.1025 * k, hh: headH,
    skinMat: headSide, hairColor, style: hairStyle, kind,
  }));


  const upperH = 0.285 * k;
  const foreH = 0.245 * k;
  const handH = 0.10 * k;
  function makeArm(sx) {
    const pivot = joint(torso, sx * shoulderX, shoulderY - 0.052 * k, 0);
    pivot.add(taper(0.086 * b * k, 0.072 * b * k, 0.098 * k, 0.080 * k, upperH, armMat));
    if (sleeveMat && armMat !== sleeveMat) {
      pivot.add(taper(0.098 * b * k, 0.094 * b * k, 0.114 * k, 0.104 * k, upperH * 0.74, sleeveMat));
      pivot.add(taper(0.096 * b * k, 0.094 * b * k, 0.108 * k, 0.105 * k, 0.012 * k, sleeveMat, [0, -upperH * 0.74 + 0.012 * k, 0]));
    }
    const elbow = joint(pivot, 0, -upperH, 0);
    elbow.add(taper(0.076 * b * k, 0.060 * b * k, 0.085 * k, 0.070 * k, foreH, armMat === sleeveMat ? sleeveMat : armMat));
    const hand = box(0.078 * k, handH, 0.056 * k, handMat || skin, [0, -foreH - handH * 0.45, 0.006 * k]);
    elbow.add(hand);
    // thumb, then the finger block, so a hand reads as a hand even at 240p
    elbow.add(box(0.028 * k, handH * 0.62, 0.032 * k, handMat || skin, [-sx * 0.040 * k, -foreH - handH * 0.42, 0.022 * k]));
    elbow.add(box(0.058 * k, handH * 0.42, 0.030 * k, handMat || skin, [0, -foreH - handH * 0.82, 0.020 * k]));
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

  rig.hips.add(box(0.285 * k, 0.03 * k, 0.2 * k, mat.belt, [0, 0.012 * k, 0]));
  rig.torso.add(box(0.03 * k, 0.03 * k, 0.03 * k, mat.belt, [0, 0.012 * k, 0.1 * k]));
  // tee collar: a thin ring of fabric at the base of the neck
  rig.torso.add(taper(0.098 * k, 0.108 * k, 0.098 * k, 0.108 * k, 0.024 * k, mat.shirt, [0, rig.shoulderY + 0.012 * k, 0]));
  return rig;
}

export function createAddison() {
  const rig = buildBody({
    ...CAST.addison,
    shirtMat: mat.suit,
    pantsMat: mat.trouser,
    shoeMat: mat.navy,
    armMat: mat.suit,
    sleeveMat: mat.suit,
    handMat: tone(0xdcbb95),
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
    kind,
    shirtMat: retroMaterial(`npcShirt${kind}`, { color: spec.shirt ?? 0x555a52 }),
    pantsMat: retroMaterial(`npcPants${kind}`, { color: spec.pants ?? 0x2c3038 }),
    shoeMat: retroMaterial(`npcShoe${kind}`, { color: 0x22221f }),
    armMat: retroMaterial(`npcArm${kind}`, { color: spec.shirt ?? 0x555a52 }),
    sleeveMat: retroMaterial(`npcShirtS${kind}`, { color: spec.shirt ?? 0x555a52 }),
    handMat: tone(spec.skin ?? 0xc9a078),
    beardColor: spec.hair,
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
