/**
 * Low-poly character rigs: Mo, Addison Octavius, assorted NPCs.
 *
 * Proportions follow a ~7.5-head figure (head 0.235 m on a 1.78 m body): shoulders
 * ~2.2 heads wide, fingertips at mid-thigh, legs slightly more than half the height.
 * Every body part is a tapered box hanging from a joint pivot (shoulder, elbow,
 * wrist, hip, knee, ankle) so the silhouette reads as a person, not a stack of cubes.
 */
import * as THREE from '../../vendor/three.module.js';
import { ps1Material, box, plane, taper } from '../render/ps1.js';
import { tex, moFaceTexture } from '../render/textures.js';

const mat = {
  skin: ps1Material('skin', { map: tex('skin'), color: 0xfff2e6 }),
  shirt: ps1Material('shirt', { map: tex('shirt'), color: 0xffffff }),
  denim: ps1Material('denim', { map: tex('denim'), color: 0xbfc9d6 }),
  hair: ps1Material('hair', { color: 0x241c14 }),
  shoe: ps1Material('shoe', { color: 0x232326 }),
  belt: ps1Material('belt', { color: 0x2b2119 }),
  suit: ps1Material('suit', { map: tex('suitWhite'), color: 0xfffdf4 }),
  trouser: ps1Material('trouser', { color: 0xf1eee2 }),
  gold: ps1Material('gold', { map: tex('gold'), color: 0xffe9a3, emissive: 0.12 }),
  goldBand: ps1Material('goldband', { color: 0xffd24a, emissive: 0.25 }),
  dressShirt: ps1Material('dressShirt', { color: 0xfffdf6 }),
  faceMo: ps1Material('faceMo', { map: moFaceTexture(), unlit: true, transparent: true, alphaTest: 0.3 }),
  faceAddison: ps1Material('faceAddison', { map: tex('faceAddison'), unlit: true, transparent: true, alphaTest: 0.3 }),
  eye: ps1Material('eye', { color: 0x14120f }),
  stain: ps1Material('stain', { color: 0xb3a286 }),
};

function shadowBlob(r = 0.34) {
  const g = new THREE.CircleGeometry(r, 10);
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false });
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  return mesh;
}

/** Joint pivot: an empty group we rotate to animate the part below it. */
function joint(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/**
 * Build a complete jointed body. Returns the pivots the animator drives plus the
 * measurements it needs (hip height, shoulder height) so nothing is hard-coded twice.
 */
function buildBody({
  height = 1.78,
  build = 1,
  skin, shirt, pants, shoe, hair,
  armMat, sleeveMat, handMat, headMat,
}) {
  const k = height / 1.78;
  const b = build;

  // vertical proportions (metres, scaled)
  const footH = 0.075 * k;
  const calfH = 0.415 * k;
  const thighH = 0.425 * k;
  const pelvisH = 0.14 * k;
  const abdomenH = 0.15 * k;
  const chestH = 0.24 * k;
  const neckH = 0.048 * k;
  const headH = 0.245 * k;
  const hipY = footH + calfH + thighH;
  // torso-local: 0 = top of pelvis, so the pelvis height is NOT included here
  const shoulderY = abdomenH + chestH;

  const hipW = 0.285 * b * k;
  const waistW = 0.245 * b * k;
  const chestW = 0.345 * b * k;
  const shoulderX = chestW / 2 + 0.018 * k;

  const root = new THREE.Group();
  root.add(shadowBlob(0.26 + 0.06 * k));

  const hips = joint(root, 0, hipY, 0);

  // pelvis — a short taper so the waist narrows into the hips
  hips.add(taper(waistW, hipW, 0.20 * k, 0.205 * k, pelvisH, pants, [0, pelvisH, 0]));

  // ---- legs: hip -> thigh -> knee -> calf -> ankle -> shoe
  const upperLegH = thighH;
  const lowerLegH = calfH;
  function makeLeg(sx) {
    const pivot = joint(hips, sx * 0.082 * b * k, 0, 0);
    pivot.add(taper(0.148 * b * k, 0.113 * b * k, 0.168 * k, 0.132 * k, upperLegH, pants));
    const knee = joint(pivot, 0, -upperLegH, 0);
    knee.add(taper(0.113 * b * k, 0.076 * b * k, 0.132 * k, 0.09 * k, lowerLegH, pants));
    const ankle = joint(knee, 0, -lowerLegH, 0);
    ankle.add(taper(0.098 * k, 0.104 * k, 0.115 * k, 0.195 * k, footH, shoe, [0, 0, 0.028 * k]));
    ankle.add(box(0.102 * k, 0.022 * k, 0.205 * k, shoe, [0, -footH, 0.05 * k]));
    return { pivot, knee, ankle };
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  // ---- torso: pelvis -> waist -> ribcage -> shoulders
  const torso = joint(hips, 0, pelvisH, 0);
  torso.add(taper(waistW * 1.08, waistW, 0.205 * k, 0.19 * k, abdomenH, shirt, [0, abdomenH, 0]));
  torso.add(taper(chestW, waistW * 1.08, 0.235 * k, 0.205 * k, chestH, shirt, [0, abdomenH + chestH, 0]));

  // ---- neck + head
  torso.add(taper(0.082 * k, 0.098 * k, 0.082 * k, 0.094 * k, neckH, headMat || skin, [0, shoulderY + neckH, 0]));
  const head = joint(torso, 0, shoulderY + neckH, 0);
  head.add(taper(0.182 * k, 0.156 * k, 0.205 * k, 0.188 * k, headH, headMat || skin, [0, headH, 0]));
  head.add(box(0.017 * k, 0.05 * k, 0.035 * k, headMat || skin, [-0.094 * k, headH * 0.5, 0]));
  head.add(box(0.017 * k, 0.05 * k, 0.035 * k, headMat || skin, [0.094 * k, headH * 0.5, 0]));

  const faceW = headH * 0.96 * 0.615; // supplied face art is 64x104, keep its aspect
  const faceH = headH * 0.96;
  head.add(plane(faceW, faceH, mat.faceMo, [0, headH * 0.5, 0.116 * k]));

  // short cropped hair: cap over the crown, block at the back of the skull
  head.add(box(0.186 * k, 0.05 * k, 0.209 * k, hair, [0, headH - 0.018 * k, -0.004 * k]));
  head.add(box(0.176 * k, 0.12 * k, 0.042 * k, hair, [0, headH - 0.11 * k, -0.086 * k]));

  // ---- arms: shoulder -> upper arm -> elbow -> forearm -> hand
  const upperH = 0.285 * k;
  const foreH = 0.245 * k;
  const handH = 0.09 * k;
  function makeArm(sx) {
    const pivot = joint(torso, sx * shoulderX, shoulderY - 0.028 * k, 0);
    // deltoid cap rounds off the shoulder line
    pivot.add(taper(0.092 * b * k, 0.106 * b * k, 0.106 * k, 0.122 * k, 0.09 * k, sleeveMat, [0, 0.022 * k, 0]));
    pivot.add(taper(0.092 * b * k, 0.076 * b * k, 0.106 * k, 0.088 * k, upperH, armMat));
    if (sleeveMat && armMat !== sleeveMat) {
      // short sleeve hem over the top of the upper arm
      pivot.add(taper(0.112 * b * k, 0.10 * b * k, 0.126 * k, 0.112 * k, upperH * 0.58, sleeveMat));
    }
    const elbow = joint(pivot, 0, -upperH, 0);
    elbow.add(taper(0.077 * b * k, 0.064 * b * k, 0.089 * k, 0.074 * k, foreH, armMat === sleeveMat ? sleeveMat : armMat));
    const hand = box(0.066 * k, handH, 0.047 * k, handMat || skin, [0, -foreH - handH * 0.45, 0.004 * k]);
    elbow.add(hand);
    return { pivot, elbow, hand };
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  return { root, hips, torso, head, legL, legR, armL, armR, hipY, shoulderY, headH, k, t: 0 };
}

export function createMo() {
  const rig = buildBody({
    height: 1.78,
    build: 1,
    skin: mat.skin,
    shirt: mat.shirt,
    pants: mat.denim,
    shoe: mat.shoe,
    hair: mat.hair,
    armMat: mat.skin,       // bare forearms
    sleeveMat: mat.shirt,   // white tee sleeves
    headMat: mat.skin,
  });
  rig.root.name = 'Mo';

  const { k } = rig;
  // belt
  rig.hips.add(box(0.29 * k, 0.032 * k, 0.205 * k, mat.belt, [0, 0.012 * k, 0]));
  // tee collar
  rig.torso.add(taper(0.10 * k, 0.115 * k, 0.10 * k, 0.115 * k, 0.045 * k, mat.shirt, [0, rig.shoulderY + 0.012 * k, 0]));
  // a stain he has stopped noticing
  rig.torso.add(box(0.075 * k, 0.06 * k, 0.012 * k, mat.stain, [0.03 * k, rig.shoulderY - 0.16 * k, 0.122 * k]));

  return rig;
}

export function createAddison() {
  const rig = buildBody({
    height: 1.86,
    build: 1.03,
    skin: ps1Material('skinA', { map: tex('skin'), color: 0xf1dcc2 }),
    shirt: mat.suit,
    pants: mat.trouser,
    shoe: ps1Material('shoeBlack', { color: 0x1c1a17 }),
    hair: ps1Material('grey', { color: 0xb7b4ab }),
    armMat: mat.suit,
    sleeveMat: mat.suit,
    headMat: ps1Material('skinA', { map: tex('skin'), color: 0xf1dcc2 }),
  });
  rig.root.name = 'Addison';
  const { k } = rig;
  const chestTop = rig.shoulderY;

  // shirt V + gold tie down the centre of the jacket
  rig.torso.add(box(0.14 * k, 0.20 * k, 0.012 * k, mat.dressShirt, [0, chestTop - 0.13 * k, 0.122 * k]));
  rig.torso.add(box(0.072 * k, 0.30 * k, 0.014 * k, mat.gold, [0, chestTop - 0.20 * k, 0.128 * k]));
  rig.torso.add(box(0.048 * k, 0.05 * k, 0.016 * k, mat.goldBand, [0, chestTop - 0.055 * k, 0.13 * k]));
  rig.torso.add(box(0.08 * k, 0.014 * k, 0.016 * k, ps1Material('clip', { color: 0xffe08a, emissive: 0.3 }), [0, chestTop - 0.27 * k, 0.13 * k]));

  // double-breasted buttons
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      rig.torso.add(box(0.026 * k, 0.026 * k, 0.012 * k, ps1Material('btn', { color: 0x2b2b2b }),
        [(-0.075 + i * 0.15) * k, chestTop - 0.14 * k - j * 0.16 * k, 0.124 * k]));
    }
  }

  // lapels
  rig.torso.add(box(0.105 * k, 0.22 * k, 0.014 * k, mat.suit, [-0.10 * k, chestTop - 0.11 * k, 0.124 * k], [0, 0, 0.16]));
  rig.torso.add(box(0.105 * k, 0.22 * k, 0.014 * k, mat.suit, [0.10 * k, chestTop - 0.11 * k, 0.124 * k], [0, 0, -0.16]));
  // pocket square
  rig.torso.add(box(0.06 * k, 0.05 * k, 0.014 * k, mat.gold, [0.13 * k, chestTop - 0.30 * k, 0.122 * k], [0, 0, 0.3]));

  // gold cuffs
  for (const a of [rig.armL, rig.armR]) {
    a.elbow.add(box(0.088 * k, 0.035 * k, 0.10 * k, mat.gold, [0, -0.235 * k, 0]));
  }

  // grey hair, receding
  rig.head.add(box(0.178 * k, 0.055 * k, 0.20 * k, ps1Material('grey', { color: 0xb7b4ab }), [0, rig.headH - 0.022 * k, -0.006 * k]));
  // beard mass shadowing the jaw (the face art already has the moustache/goatee)
  rig.head.add(box(0.10 * k, 0.03 * k, 0.012 * k, ps1Material('beard', { color: 0x6a6258 }), [0, rig.headH * 0.16, 0.098 * k]));

  return rig;
}

const PALETTES = {
  rae: { shirt: 0x6d5a74, pants: 0x3a3442, skin: 0xc9a184, hair: 0x9a9a96, height: 1.66 },
  dale: { shirt: 0x2f6b4a, pants: 0x26302a, skin: 0xc9a37c, hair: 0x4f4132, height: 1.72 },
  dex: { shirt: 0x2a2f3a, pants: 0x20242c, skin: 0x7d5638, hair: 0x141414, height: 1.69 },
  kev: { shirt: 0xa05a3a, pants: 0x33405a, skin: 0xd2a67c, hair: 0xc9a05a, height: 1.75 },
  nia: { shirt: 0x4a6a8a, pants: 0x2f3a46, skin: 0xa87e58, hair: 0x2a1a14, height: 1.63 },
};

export function createNPC(kind = 'kev') {
  const p = PALETTES[kind] || PALETTES.kev;
  const matShirt = ps1Material(`npcShirt${kind}`, { color: p.shirt });
  const matPants = ps1Material(`npcPants${kind}`, { color: p.pants });
  const matSkin = ps1Material(`npcSkin${kind}`, { color: p.skin });
  const matHair = ps1Material(`npcHair${kind}`, { color: p.hair });

  const rig = buildBody({
    height: p.height,
    build: kind === 'dex' ? 1.06 : 1,
    skin: matSkin,
    shirt: matShirt,
    pants: matPants,
    shoe: ps1Material(`npcShoe${kind}`, { color: 0x22221f }),
    hair: matHair,
    armMat: matShirt,
    sleeveMat: matShirt,
    handMat: matSkin,
    headMat: matSkin,
  });
  rig.root.name = kind;
  const { k, headH } = rig;

  // a face made of nothing but two eye slabs, PS1-style
  rig.head.add(box(0.032 * k, 0.026 * k, 0.008 * k, mat.eye, [-0.038 * k, headH * 0.55, 0.095 * k]));
  rig.head.add(box(0.032 * k, 0.026 * k, 0.008 * k, mat.eye, [0.038 * k, headH * 0.55, 0.095 * k]));

  if (kind === 'dex') {
    rig.head.add(box(0.196 * k, 0.09 * k, 0.21 * k, ps1Material('hood', { color: 0x2a2f3a }), [0, headH * 0.92, -0.02 * k]));
  }
  if (kind === 'dale') {
    rig.head.add(box(0.182 * k, 0.05 * k, 0.205 * k, ps1Material('cap', { color: 0x1f4a34 }), [0, headH * 0.98, 0]));
    rig.head.add(box(0.16 * k, 0.016 * k, 0.09 * k, ps1Material('brim', { color: 0x183a28 }), [0, headH * 0.94, 0.115 * k]));
  }
  return rig;
}

export function createCat() {
  const root = new THREE.Group();
  const fur = ps1Material('fur', { color: 0x3a3630 });
  const body = box(0.22, 0.16, 0.38, fur, [0, 0.13, 0]);
  root.add(body);
  root.add(box(0.15, 0.13, 0.14, fur, [0, 0.2, 0.24]));
  root.add(box(0.04, 0.07, 0.03, fur, [-0.05, 0.28, 0.24]));
  root.add(box(0.04, 0.07, 0.03, fur, [0.05, 0.28, 0.24]));
  root.add(box(0.03, 0.02, 0.02, mat.eye, [-0.04, 0.22, 0.315]));
  root.add(box(0.03, 0.02, 0.02, mat.eye, [0.04, 0.22, 0.315]));
  const tail = box(0.04, 0.04, 0.28, fur, [0, 0.18, -0.26]);
  root.add(tail);
  const rig = { root, tail, t: 0, type: 'cat' };
  root.add(shadowBlob(0.18));
  return rig;
}

/* ------------------------------ animation ------------------------------ */

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
  // knees only bend one way, and mostly during the swing phase
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

  // stumble: a brief whole-body lurch
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
  // Exaggerated, theatrical, deeply embarrassing dance
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

export function animateNPC(rig, dt) {
  rig.t += dt;
  const t = rig.t;
  if (rig.type === 'cat') {
    rig.tail.rotation.y = Math.sin(t * 2.2) * 0.5;
    rig.root.position.y = Math.abs(Math.sin(t * 0.7)) * 0.01;
    return;
  }
  rig.hips.position.y = rig.hipY + Math.sin(t * 0.9) * 0.006;
  rig.torso.rotation.y = Math.sin(t * 0.5) * 0.07;
  rig.head.rotation.y = Math.sin(t * 0.37) * 0.2;
  rig.head.rotation.z = Math.sin(t * 0.53) * 0.04;
  rig.armL.pivot.rotation.x = Math.sin(t * 0.8) * 0.07;
  rig.armR.pivot.rotation.x = Math.sin(t * 0.8 + 1.6) * 0.07;
  rig.armL.elbow.rotation.x = -0.14 + Math.sin(t * 0.8) * 0.05;
  rig.armR.elbow.rotation.x = -0.14 + Math.sin(t * 0.8 + 1.6) * 0.05;
  rig.armL.pivot.rotation.z = -0.06;
  rig.armR.pivot.rotation.z = 0.06;
}

export { mat as characterMaterials };
