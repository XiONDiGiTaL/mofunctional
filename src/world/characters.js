/** Low-poly character rigs: Mo, Addison Octavius, assorted NPCs. */
import * as THREE from '../../vendor/three.module.js';
import { ps1Material, box, plane } from '../render/ps1.js';
import { tex } from '../render/textures.js';

const mat = {
  skin: ps1Material('skin', { map: tex('skin'), color: 0xf0d8c0 }),
  shirt: ps1Material('shirt', { map: tex('shirt'), color: 0xffffff }),
  denim: ps1Material('denim', { map: tex('denim'), color: 0xdfe6f0 }),
  hair: ps1Material('hair', { color: 0x241c14 }),
  shoe: ps1Material('shoe', { color: 0x2a2a2e }),
  suit: ps1Material('suit', { map: tex('suitWhite'), color: 0xfffdf4 }),
  gold: ps1Material('gold', { map: tex('gold'), color: 0xffe9a3, emissive: 0.12 }),
  goldBand: ps1Material('goldband', { color: 0xffd24a, emissive: 0.25 }),
  faceMo: ps1Material('faceMo', { map: tex('faceMo'), unlit: true, transparent: true, alphaTest: 0.3 }),
  faceAddison: ps1Material('faceAddison', { map: tex('faceAddison'), unlit: true, transparent: true, alphaTest: 0.3 }),
  eye: ps1Material('eye', { color: 0x14120f }),
};

function shadowBlob(r = 0.42) {
  const g = new THREE.CircleGeometry(r, 10);
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.36, depthWrite: false });
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  return mesh;
}

/** A box limb on a pivot so we can rotate it from the joint. */
function limb(w, h, d, material, x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const m = box(w, h, d, material, [0, -h / 2, 0]);
  pivot.add(m);
  return { pivot, mesh: m };
}

export function createMo() {
  const root = new THREE.Group();
  root.name = 'Mo';
  root.add(shadowBlob(0.4));

  const hips = new THREE.Group();
  hips.position.y = 0.74;
  root.add(hips);

  // legs
  const legL = limb(0.155, 0.72, 0.18, mat.denim, -0.115, 0, 0);
  const legR = limb(0.155, 0.72, 0.18, mat.denim, 0.115, 0, 0);
  hips.add(legL.pivot, legR.pivot);
  for (const l of [legL, legR]) {
    const shoe = box(0.17, 0.1, 0.26, mat.shoe, [0, -0.7, 0.03]);
    l.pivot.add(shoe);
  }

  // torso
  const torso = new THREE.Group();
  torso.position.y = 0.36;
  hips.add(torso);
  const chest = box(0.46, 0.6, 0.26, mat.shirt, [0, 0.2, 0]);
  torso.add(chest);
  // shirt wrinkles / stale stain
  const stain = box(0.1, 0.08, 0.02, ps1Material('stain', { color: 0xb9a888 }), [0.03, 0.1, 0.135]);
  torso.add(stain);

  // arms
  const armL = limb(0.13, 0.56, 0.15, mat.skin, -0.29, 0.44, 0);
  const armR = limb(0.13, 0.56, 0.15, mat.skin, 0.29, 0.44, 0);
  torso.add(armL.pivot, armR.pivot);
  // sleeves
  armL.pivot.add(box(0.16, 0.2, 0.17, mat.shirt, [0, -0.08, 0]));
  armR.pivot.add(box(0.16, 0.2, 0.17, mat.shirt, [0, -0.08, 0]));

  // head
  const head = new THREE.Group();
  head.position.y = 0.5;
  torso.add(head);
  const skull = box(0.28, 0.3, 0.27, mat.skin);
  head.add(skull);
  const face = plane(0.27, 0.29, mat.faceMo, [0, 0, 0.137]);
  head.add(face);
  // hair cap + sides
  head.add(box(0.295, 0.08, 0.285, mat.hair, [0, 0.135, 0]));
  head.add(box(0.035, 0.11, 0.26, mat.hair, [-0.135, 0.06, -0.01]));
  head.add(box(0.035, 0.11, 0.26, mat.hair, [0.135, 0.06, -0.01]));
  // ears
  head.add(box(0.03, 0.07, 0.05, mat.skin, [-0.15, -0.01, 0]));
  head.add(box(0.03, 0.07, 0.05, mat.skin, [0.15, -0.01, 0]));

  const rig = { root, hips, torso, head, legL, legR, armL, armR, t: 0, fall: 0 };
  return rig;
}

export function createAddison() {
  const root = new THREE.Group();
  root.name = 'Addison';
  root.add(shadowBlob(0.44));

  const hips = new THREE.Group();
  hips.position.y = 0.88;
  root.add(hips);

  const legL = limb(0.18, 0.84, 0.2, ps1Material('trouser', { color: 0xf4f1e6 }), -0.13, 0, 0);
  const legR = limb(0.18, 0.84, 0.2, ps1Material('trouser', { color: 0xf4f1e6 }), 0.13, 0, 0);
  hips.add(legL.pivot, legR.pivot);
  for (const l of [legL, legR]) l.pivot.add(box(0.2, 0.09, 0.3, ps1Material('shoeBlack', { color: 0x1c1a17 }), [0, -0.8, 0.03]));

  const torso = new THREE.Group();
  torso.position.y = 0.4;
  hips.add(torso);
  const jacket = box(0.56, 0.72, 0.3, mat.suit, [0, 0.26, 0]);
  torso.add(jacket);
  // double-breasted buttons
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      torso.add(box(0.03, 0.03, 0.02, ps1Material('btn', { color: 0x2b2b2b }), [-0.09 + i * 0.18, 0.34 - j * 0.2, 0.152]));
    }
  }
  // lapels
  torso.add(box(0.14, 0.3, 0.03, ps1Material('lapel', { map: tex('suitWhite'), color: 0xfffdf4 }), [-0.14, 0.44, 0.152], [0, 0, 0.2]));
  torso.add(box(0.14, 0.3, 0.03, ps1Material('lapel2', { map: tex('suitWhite'), color: 0xfffdf4 }), [0.14, 0.44, 0.152], [0, 0, -0.2]));
  // gold tie
  torso.add(box(0.075, 0.38, 0.02, mat.gold, [0, 0.32, 0.157]));
  torso.add(box(0.05, 0.05, 0.021, mat.goldBand, [0, 0.42, 0.159]));
  // shirt V
  torso.add(box(0.16, 0.3, 0.01, ps1Material('dressShirt', { color: 0xfffdf6 }), [0, 0.42, 0.153]));
  // pocket square
  torso.add(box(0.07, 0.06, 0.02, mat.gold, [0.17, 0.3, 0.156], [0, 0, 0.3]));
  // gold tie clip
  torso.add(box(0.09, 0.015, 0.022, ps1Material('clip', { color: 0xffe08a, emissive: 0.3 }), [0, 0.24, 0.159]));

  const armL = limb(0.15, 0.64, 0.17, mat.suit, -0.36, 0.5, 0);
  const armR = limb(0.15, 0.64, 0.17, mat.suit, 0.36, 0.5, 0);
  torso.add(armL.pivot, armR.pivot);
  // gold cuffs + hands
  for (const a of [armL, armR]) {
    a.pivot.add(box(0.16, 0.05, 0.18, mat.gold, [0, -0.56, 0]));
    a.pivot.add(box(0.12, 0.1, 0.12, mat.skin, [0, -0.64, 0]));
  }

  const head = new THREE.Group();
  head.position.y = 0.72;
  torso.add(head);
  head.add(box(0.3, 0.32, 0.29, ps1Material('skinA', { map: tex('skin'), color: 0xf2dfc6 })));
  head.add(plane(0.29, 0.31, mat.faceAddison, [0, 0, 0.147]));
  // grey hair
  const grey = ps1Material('grey', { color: 0xb9b6ad });
  head.add(box(0.32, 0.09, 0.3, grey, [0, 0.15, -0.01]));
  head.add(box(0.05, 0.13, 0.26, grey, [-0.15, 0.06, -0.02]));
  head.add(box(0.05, 0.13, 0.26, grey, [0.15, 0.06, -0.02]));

  const rig = { root, hips, torso, head, legL, legR, armL, armR, t: 0 };
  return rig;
}

const PALETTES = {
  rae: { shirt: 0x6d5a74, pants: 0x3a3442, skin: 0xd6b291, hair: 0x9a9a96 },
  dale: { shirt: 0x2f6b4a, pants: 0x26302a, skin: 0xd8b48f, hair: 0x5a4a3a },
  dex: { shirt: 0x2a2f3a, pants: 0x20242c, skin: 0x8a6244, hair: 0x171717 },
  kev: { shirt: 0xa05a3a, pants: 0x33405a, skin: 0xe0b48a, hair: 0xc9a05a },
  nia: { shirt: 0x4a6a8a, pants: 0x2f3a46, skin: 0xb98a63, hair: 0x2a1a14 },
};

export function createNPC(kind = 'kev') {
  const p = PALETTES[kind] || PALETTES.kev;
  const root = new THREE.Group();
  root.add(shadowBlob(0.34));
  const matShirt = ps1Material(`npcShirt${kind}`, { color: p.shirt });
  const matPants = ps1Material(`npcPants${kind}`, { color: p.pants });
  const matSkin = ps1Material(`npcSkin${kind}`, { color: p.skin });
  const matHair = ps1Material(`npcHair${kind}`, { color: p.hair });

  const hips = new THREE.Group();
  hips.position.y = 0.7;
  root.add(hips);
  const legL = limb(0.15, 0.68, 0.17, matPants, -0.11, 0, 0);
  const legR = limb(0.15, 0.68, 0.17, matPants, 0.11, 0, 0);
  hips.add(legL.pivot, legR.pivot);

  const torso = new THREE.Group();
  torso.position.y = 0.34;
  hips.add(torso);
  torso.add(box(0.43, 0.56, 0.24, matShirt, [0, 0.19, 0]));
  const armL = limb(0.115, 0.5, 0.13, matShirt, -0.27, 0.4, 0);
  const armR = limb(0.115, 0.5, 0.13, matShirt, 0.27, 0.4, 0);
  torso.add(armL.pivot, armR.pivot);
  for (const a of [armL, armR]) a.pivot.add(box(0.11, 0.1, 0.11, matSkin, [0, -0.5, 0]));

  const head = new THREE.Group();
  head.position.y = 0.46;
  torso.add(head);
  head.add(box(0.25, 0.27, 0.24, matSkin));
  head.add(box(0.265, 0.07, 0.255, matHair, [0, 0.12, 0]));
  // eyes
  head.add(box(0.04, 0.035, 0.01, mat.eye, [-0.06, 0.02, 0.122]));
  head.add(box(0.04, 0.035, 0.01, mat.eye, [0.06, 0.02, 0.122]));
  if (kind === 'dex') {
    head.add(box(0.3, 0.13, 0.3, ps1Material('hood', { color: 0x2a2f3a }), [0, 0.06, -0.02]));
  }
  if (kind === 'dale') {
    head.add(box(0.29, 0.06, 0.28, ps1Material('cap', { color: 0x1f4a34 }), [0, 0.16, 0]));
    head.add(box(0.24, 0.02, 0.12, ps1Material('brim', { color: 0x183a28 }), [0, 0.14, 0.16]));
  }
  return { root, hips, torso, head, legL, legR, armL, armR, t: Math.random() * 10 };
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
  const { walking = false, high = 0, withdrawal = 0, sitting = false, sleeping = false, speed = 1 } = opts;
  rig.t += dt * (walking ? 7.2 : 1.4);
  const t = rig.t;
  const drunk = Math.min(1, (high / 100) * 1.1 + (withdrawal / 380));
  const sway = Math.sin(t * 0.9) * drunk * 0.22;

  if (sleeping) {
    rig.root.rotation.z = 0;
    rig.root.rotation.x = 0;
    rig.hips.rotation.x = 0;
    rig.legL.pivot.rotation.x = -0.1;
    rig.legR.pivot.rotation.x = -0.1;
    rig.armL.pivot.rotation.x = Math.sin(t * 0.6) * 0.04;
    rig.armR.pivot.rotation.x = Math.sin(t * 0.6 + 1) * 0.04;
    rig.head.rotation.x = 0.16;
    return;
  }

  if (sitting) {
    rig.hips.position.y = 0.48;
    rig.legL.pivot.rotation.x = -1.35;
    rig.legR.pivot.rotation.x = -1.35;
    rig.armL.pivot.rotation.x = -0.5;
    rig.armR.pivot.rotation.x = -0.5;
    rig.head.rotation.x = 0.1;
    rig.root.rotation.z = sway * 0.3;
    return;
  }
  rig.hips.position.y = 0.74;

  const stride = walking ? 0.85 : 0.05;
  const bob = walking ? Math.abs(Math.sin(t)) * 0.05 : Math.sin(t * 0.8) * 0.012;
  rig.hips.position.y = 0.74 + bob;
  rig.legL.pivot.rotation.x = Math.sin(t) * stride;
  rig.legR.pivot.rotation.x = Math.sin(t + Math.PI) * stride;
  rig.armL.pivot.rotation.x = Math.sin(t + Math.PI) * stride * 0.8;
  rig.armR.pivot.rotation.x = Math.sin(t) * stride * 0.8;
  rig.armL.pivot.rotation.z = 0.05 + Math.sin(t * 0.7) * 0.05;
  rig.armR.pivot.rotation.z = -0.05 - Math.sin(t * 0.7) * 0.05;
  rig.torso.rotation.y = Math.sin(t) * (walking ? 0.06 : 0.02) + sway * 0.5;
  rig.torso.rotation.z = sway * 0.7;
  rig.head.rotation.y = Math.sin(t * 0.5) * 0.08 * (1 + drunk * 2) - sway * 0.8;
  rig.head.rotation.z = sway * 0.9;
  rig.root.rotation.z = sway * 0.34;
  rig.root.position.y = Math.sin(t * 0.6) * drunk * 0.02;

  // stumble: brief whole-body lurch
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
  rig.hips.position.y = 0.88 + Math.abs(beat) * 0.06;
  rig.hips.rotation.z = beat * 0.14;
  rig.hips.rotation.y = Math.sin(t * 1.55) * 0.3;
  rig.torso.rotation.z = beat2 * 0.1;
  rig.torso.rotation.y = Math.sin(t * 3.1) * 0.22;
  rig.armL.pivot.rotation.z = 1.4 + beat * 1.0;
  rig.armL.pivot.rotation.x = -0.5 + Math.sin(t * 6.2) * 0.5;
  rig.armR.pivot.rotation.z = -1.4 - beat2 * 1.0;
  rig.armR.pivot.rotation.x = -0.5 + Math.sin(t * 6.2 + 1) * 0.5;
  rig.legL.pivot.rotation.x = Math.max(0, beat) * 0.4;
  rig.legR.pivot.rotation.x = Math.max(0, beat2) * 0.4;
  rig.head.rotation.z = beat * 0.24;
  rig.head.rotation.y = Math.sin(t * 3.1 + 0.7) * 0.3;
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
  rig.hips.position.y = 0.7 + Math.sin(t * 0.9) * 0.008;
  rig.torso.rotation.y = Math.sin(t * 0.5) * 0.08;
  rig.head.rotation.y = Math.sin(t * 0.37) * 0.22;
  rig.head.rotation.z = Math.sin(t * 0.53) * 0.05;
  rig.armL.pivot.rotation.x = Math.sin(t * 0.8) * 0.08;
  rig.armR.pivot.rotation.x = Math.sin(t * 0.8 + 1.6) * 0.08;
  rig.armL.pivot.rotation.z = 0.08;
  rig.armR.pivot.rotation.z = -0.08;
}

export { mat as characterMaterials };
