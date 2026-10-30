/**
 * Low-poly character rigs: Mo, Addison Octavius, assorted NPCs.
 *
 * Proportions follow a ~7.5-head figure (head 0.235 m on a 1.78 m body): shoulders
 * ~2.2 heads wide, fingertips at mid-thigh, legs slightly more than half the height.
 * Every body part is a tapered box hanging from a joint pivot (shoulder, elbow,
 * wrist, hip, knee, ankle) so the silhouette reads as a person, not a stack of cubes.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box, plane, taper, taperMulti } from '../render/retro.js';
import { tex, moFaceTexture } from '../render/textures.js';
import { npcFaceTexture, faceSkin } from '../render/faces.js';

const skinHex = (kind) => parseInt(faceSkin(kind).slice(1), 16);

const mat = {
  skin: retroMaterial('skin', { map: tex('skin'), color: 0xfff2e6 }),
  // the head gets its own, flatter lighting so the cheek planes never read as black bars
  skinHead: retroMaterial('skinHead', { map: tex('skin'), color: 0xfff2e6, ambient: 0.82 }),
  shirt: retroMaterial('shirt', { map: tex('shirt'), color: 0xffffff }),
  denim: retroMaterial('denim', { map: tex('denim'), color: 0xbfc9d6 }),
  hair: retroMaterial('hair', { color: 0x241c14 }),
  shoe: retroMaterial('shoe', { color: 0x232326 }),
  belt: retroMaterial('belt', { color: 0x2b2119 }),
  suit: retroMaterial('suit', { map: tex('suitWhite'), color: 0xfffdf4 }),
  trouser: retroMaterial('trouser', { color: 0xf1eee2 }),
  gold: retroMaterial('gold', { map: tex('gold'), color: 0xffe9a3, emissive: 0.12 }),
  goldBand: retroMaterial('goldband', { color: 0xffd24a, emissive: 0.25 }),
  dressShirt: retroMaterial('dressShirt', { color: 0xfffdf6 }),
  // Faces are the front face of the skull, so they are lit like everything else —
  // a little emissive keeps them from sinking into shadow at night.
  // Baked portraits carry their own shading, so a stronger emissive keeps them legible in
  // the game's deliberately dark rooms without washing the painted planes out.
  faceMo: retroMaterial('faceMo', { map: moFaceTexture(), emissive: 0.3 }),
  faceAddison: retroMaterial('faceAddison', { map: npcFaceTexture('addison'), emissive: 0.34 }),
  eye: retroMaterial('eye', { color: 0x14120f }),
  stain: retroMaterial('stain', { color: 0xb3a286 }),
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
  armMat, sleeveMat, handMat, headMat, faceMat,
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
  const neckH = 0.056 * k;
  const headH = 0.238 * k;
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

  // ---- torso: pelvis -> waist -> ribcage -> shoulders, three segments so the
  // silhouette curves in at the waist instead of being one slab
  const torso = joint(hips, 0, pelvisH, 0);
  const ribW = (chestW + waistW) / 2;
  torso.add(taper(waistW * 1.06, waistW, 0.202 * k, 0.188 * k, abdomenH, shirt, [0, abdomenH, 0]));
  torso.add(taper(ribW, waistW * 1.06, 0.222 * k, 0.202 * k, chestH * 0.55, shirt, [0, abdomenH + chestH * 0.55, 0]));
  torso.add(taper(chestW, ribW, 0.238 * k, 0.222 * k, chestH * 0.45, shirt, [0, abdomenH + chestH, 0]));


  // ---- neck + head
  const skinMat = headMat || skin;
  torso.add(taper(0.092 * k, 0.106 * k, 0.09 * k, 0.102 * k, neckH, skinMat, [0, shoulderY + neckH, 0]));
  const head = joint(torso, 0, shoulderY + neckH, 0);

  // The head is a real volume whose FRONT FACE carries the portrait texture, so the art
  // wraps the skull instead of hovering in front of it: no pasted-on rectangle, and the
  // jaw and cheek planes still take the light.
  const headW = 0.172 * k;
  const headD = 0.205 * k;
  const jawW = headW * 0.88;
  const jawD = headD * 0.95;
  if (faceMat) {
    head.add(taperMulti(headW, jawW, headD, jawD, headH,
      [faceMat, skinMat, skinMat, skinMat, skinMat, skinMat], [0, headH, 0]));
  } else {
    head.add(taper(headW, jawW, headD, jawD, headH, skinMat, [0, headH, 0]));
  }
  // ears sit on the cheek planes, just behind the face
  head.add(box(0.013 * k, 0.04 * k, 0.028 * k, skinMat, [-headW * 0.5, headH * 0.48, -0.022 * k]));
  head.add(box(0.013 * k, 0.04 * k, 0.028 * k, skinMat, [headW * 0.5, headH * 0.48, -0.022 * k]));
  // crown and nape, offset back so they never cover the portrait
  head.add(box(headW * 0.99, 0.034 * k, headD * 0.9, hair, [0, headH - 0.014 * k, -0.022 * k]));
  head.add(box(headW * 0.98, headH * 0.6, 0.05 * k, hair, [0, headH * 0.46, -headD * 0.47]));

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
      // a tee sleeve that actually covers the shoulder and half the bicep, with a hem
      pivot.add(taper(0.118 * b * k, 0.106 * b * k, 0.134 * k, 0.118 * k, upperH * 0.62, sleeveMat));
      pivot.add(taper(0.113 * b * k, 0.11 * b * k, 0.126 * k, 0.122 * k, 0.014 * k, sleeveMat, [0, -upperH * 0.62 + 0.014 * k, 0]));
    }
    const elbow = joint(pivot, 0, -upperH, 0);
    elbow.add(taper(0.077 * b * k, 0.064 * b * k, 0.089 * k, 0.074 * k, foreH, armMat === sleeveMat ? sleeveMat : armMat));
    const hand = box(0.068 * k, handH, 0.05 * k, handMat || skin, [0, -foreH - handH * 0.45, 0.006 * k]);
    elbow.add(hand);
    elbow.add(box(0.026 * k, handH * 0.55, 0.03 * k, handMat || skin, [-sx * 0.036 * k, -foreH - handH * 0.4, 0.02 * k]));
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
    headMat: mat.skinHead,
    faceMat: mat.faceMo,
  });
  rig.root.name = 'Mo';

  const { k } = rig;
  // belt
  rig.hips.add(box(0.29 * k, 0.032 * k, 0.205 * k, mat.belt, [0, 0.012 * k, 0]));
  // tee collar
  rig.torso.add(taper(0.092 * k, 0.105 * k, 0.092 * k, 0.105 * k, 0.026 * k, mat.shirt, [0, rig.shoulderY + 0.004 * k, 0]));
  // a stain he has stopped noticing
  rig.torso.add(box(0.075 * k, 0.06 * k, 0.012 * k, mat.stain, [0.03 * k, rig.shoulderY - 0.16 * k, 0.122 * k]));

  return rig;
}

export function createAddison() {
  const rig = buildBody({
    height: 1.86,
    build: 1.03,
    skin: retroMaterial('skinA', { map: tex('skin'), color: 0xf1dcc2 }),
    shirt: mat.suit,
    pants: mat.trouser,
    shoe: retroMaterial('shoeBlack', { color: 0x1c1a17 }),
    hair: retroMaterial('grey', { color: 0xb7b4ab }),
    armMat: mat.suit,
    sleeveMat: mat.suit,
    headMat: retroMaterial('skinAhead', { color: skinHex('addison'), ambient: 0.86 }),
    faceMat: mat.faceAddison,
  });
  rig.root.name = 'Addison';
  const { k } = rig;
  const chestTop = rig.shoulderY;

  // shirt V + gold tie down the centre of the jacket
  rig.torso.add(box(0.14 * k, 0.20 * k, 0.012 * k, mat.dressShirt, [0, chestTop - 0.13 * k, 0.122 * k]));
  rig.torso.add(box(0.072 * k, 0.30 * k, 0.014 * k, mat.gold, [0, chestTop - 0.20 * k, 0.128 * k]));
  rig.torso.add(box(0.048 * k, 0.05 * k, 0.016 * k, mat.goldBand, [0, chestTop - 0.055 * k, 0.13 * k]));
  rig.torso.add(box(0.08 * k, 0.014 * k, 0.016 * k, retroMaterial('clip', { color: 0xffe08a, emissive: 0.3 }), [0, chestTop - 0.27 * k, 0.13 * k]));

  // double-breasted buttons
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      rig.torso.add(box(0.026 * k, 0.026 * k, 0.012 * k, retroMaterial('btn', { color: 0x2b2b2b }),
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
  const matShirt = retroMaterial(`npcShirt${kind}`, { color: p.shirt });
  const matPants = retroMaterial(`npcPants${kind}`, { color: p.pants });
  const matSkin = retroMaterial(`npcSkin${kind}`, { color: p.skin });
  const matHair = retroMaterial(`npcHair${kind}`, { color: p.hair });

  const rig = buildBody({
    height: p.height,
    build: kind === 'dex' ? 1.06 : 1,
    skin: matSkin,
    shirt: matShirt,
    pants: matPants,
    shoe: retroMaterial(`npcShoe${kind}`, { color: 0x22221f }),
    hair: matHair,
    armMat: matShirt,
    sleeveMat: matShirt,
    handMat: matSkin,
    headMat: retroMaterial(`npcHead${kind}`, { color: skinHex(kind), ambient: 0.86 }),
    // built exactly like Mo: a generated portrait on the front face of the skull
    faceMat: retroMaterial(`npcFace${kind}`, { map: npcFaceTexture(kind), emissive: 0.34 }),
  });
  rig.root.name = kind;
  const { k, headH } = rig;

  // hair, dreadlocks, beards and age lines are painted into the portrait, so a hat or hood
  // would only cover the face texture; the only extra geometry is the crown/nape volume.
  return rig;
}

export function createCat() {
  const root = new THREE.Group();
  const fur = retroMaterial('fur', { color: 0x3a3630 });
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

export function animateNPC(rig, dt, opts = {}) {
  const { walking = false } = opts;
  rig.t += dt * (walking ? 6.4 : 1);
  const t = rig.t;
  if (rig.type === 'cat') {
    rig.tail.rotation.y = Math.sin(t * 2.2) * 0.5;
    rig.root.position.y = Math.abs(Math.sin(t * 0.7)) * 0.01;
    return;
  }

  // same joint chain, same gait as Mo — NPCs are the same kind of body, not props
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
