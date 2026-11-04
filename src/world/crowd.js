/**
 * The crowd: what the people walking past are doing with their hands, and with each other.
 *
 * Every walker (an npc def with `walker: [x0, x1]`) can carry something, and the thing changes how
 * they walk: a slice or a coffee comes up to the mouth every few steps, a phone is held to the ear,
 * grocery bags hang from both fists, a stroller rolls ahead of a woman with both hands on the bar,
 * an older man leans on a cane and takes his time, a courier hugs a box, somebody reads the paper
 * on the move, somebody nods to their headphones. Walkers with no `carry` get one from a seeded
 * roll, so every existing street and avenue fills in without editing them.
 *
 * Two walkers coming toward each other sometimes stop, turn to face, and talk for a few seconds
 * (a short line over each head), then carry on where they were going. A sprite bark is cheap: one
 * canvas, one sprite, gone in a few seconds.
 *
 * All the props are children of the rig, so they move, turn and disappear with it, and nothing
 * here keeps per-frame garbage: the poses only write joint rotations.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box } from '../render/retro.js';
import { faceSpec } from '../render/heads.js';
import { pick } from '../core/util.js';

const MAT = (name, color, extra = {}) => retroMaterial(`crowd_${name}`, { color, ambient: 0.75, ...extra });

/** How fast each kind of walker goes (metres a second) and how fast their legs cycle. */
const PACE = { pcart: 0.45, stroller: 0.8, cane: 0.55, phone: 0.95, paper: 0.8, bags: 0.95, package: 1.25, jog: 2.6, food: 1.0, coffee: 1.05, headphones: 1.2 };

/** Give a walker their thing, if they do not have one; build the prop on the rig. */
export function dressWalker(rig, def) {
  if (!def?.walker || rig.carry !== undefined) return;
  let carry = def.carry;
  if (carry === undefined) {
    const fs = faceSpec(def.kind) || {};
    const r = Math.random();
    const pool = ['food', 'coffee', 'phone', 'bags', 'paper', 'package', 'headphones', null, null, null];
    if (fs.fem && r < 0.07) carry = 'stroller';
    else if ((fs.age || 0) >= 0.75 && r < 0.4) carry = 'cane';
    else if (r > 0.94) carry = 'jog';
    else carry = pick(pool);
  }
  rig.carry = carry || null;
  rig.pace = def.speed || PACE[carry] || 1.1;
  if (!carry) return;
  const k = rig.k || 1;
  const hand = rig.armR?.elbow;
  if (carry === 'food') {
    const kind = pick(['slice', 'dog', 'sandwich']);
    const g = new THREE.Group();
    if (kind === 'slice') { g.add(box(0.1, 0.012, 0.18, MAT('slice', 0xf2c84a), [0, 0, 0])); g.add(box(0.11, 0.025, 0.025, MAT('crust', 0xc8823a), [0, 0, -0.09])); }
    else if (kind === 'dog') { g.add(box(0.16, 0.04, 0.045, MAT('bun', 0xe8c890), [0, 0, 0])); g.add(box(0.18, 0.022, 0.022, MAT('frank', 0xb84a2a), [0, 0.016, 0])); }
    else g.add(box(0.14, 0.06, 0.09, MAT('hero', 0xe7c48b), [0, 0, 0]));
    g.position.set(0, -0.31 * k, 0.06 * k);
    hand.add(g);
  }
  if (carry === 'coffee') hand.add(box(0.07, 0.11, 0.07, MAT(pick(['cupblue', 'cupwhite']), pick([0x2f5fb3, 0xf2efe6])), [0, -0.3 * k, 0.05 * k]));
  if (carry === 'phone') hand.add(box(0.05, 0.11, 0.02, MAT('phone', 0x1a1a1e), [0, -0.33 * k, 0.03 * k]));
  if (carry === 'bags') for (const a of [rig.armL, rig.armR]) {
    a.elbow.add(box(0.24, 0.3, 0.12, MAT('bag', pick([0xf2f2ec, 0xd8c8a0, 0xc83a2a])), [0, -0.46 * k, 0]));
  }
  if (carry === 'paper') {
    rig.armL.elbow.add(box(0.34, 0.26, 0.01, MAT('paper', 0xe8e4d4), [0.12 * k, -0.33 * k, 0.12 * k]));
  }
  if (carry === 'package') rig.torso.add(box(0.34, 0.26, 0.28, MAT('package', 0xb08a5a), [0, 0.15 * k, 0.26 * k]));
  if (carry === 'headphones') {
    const hp = MAT('headphones', 0x1a1a1e);
    rig.head.add(box(0.3 * k, 0.03 * k, 0.04 * k, hp, [0, 0.19 * k, 0]));
    for (const sx of [-1, 1]) rig.head.add(box(0.04 * k, 0.08 * k, 0.07 * k, hp, [sx * 0.14 * k, 0.04 * k, 0]));
  }
  if (carry === 'cane') hand.add(box(0.025, 0.85, 0.025, MAT('cane', 0x5a3a24), [0, -0.68 * k, 0.04 * k]));
  if (carry === 'pcart') {
    // Don Cheo's cart: green box, a red and yellow sign, syrup bottles in a row on top
    const c = new THREE.Group();
    c.add(box(0.9, 0.7, 0.6, MAT('pcart', 0x5a9a5a), [0, 0.6, 0]));
    c.add(box(0.02, 0.5, 0.5, MAT('pcartsign', 0xd82a2a), [0.46, 0.6, 0]));
    c.add(box(0.025, 0.36, 0.38, MAT('pcartsign2', 0xf2d82a), [0.47, 0.6, 0]));
    c.add(box(0.02, 0.5, 0.5, MAT('pcartsign', 0xd82a2a), [-0.46, 0.6, 0]));
    c.add(box(0.025, 0.36, 0.38, MAT('pcartsign2', 0xf2d82a), [-0.47, 0.6, 0]));
    [0xf2f2ea, 0xc81e3a, 0x8a4a1a, 0xc8323a, 0xd8e83a].forEach((col, i) => c.add(box(0.07, 0.2, 0.07, MAT(`syrup${i}`, col), [-0.28 + i * 0.14, 1.06, -0.12])));
    c.add(box(0.5, 0.04, 0.3, MAT('ice', 0xd8eef2), [0, 0.97, 0.12]));
    c.add(box(0.6, 0.04, 0.04, MAT('pcarthandle', 0x3a7a3a), [0, 0.95, -0.42]));
    for (const sx of [-0.35, 0.35]) c.add(box(0.06, 0.16, 0.16, MAT('wheel', 0x1a1a1a), [sx, 0.08, 0.2]));
    c.position.set(0, 0, 0.75);
    rig.root.add(c);
  }
  if (carry === 'stroller') {
    // a stroller: frame, a canvas body with a hood, four little wheels, the push bar at her hands
    const s = new THREE.Group();
    const frame = MAT('strollerframe', 0x2a2a2e);
    const cloth = MAT('strollerbody', pick([0x2a5a9a, 0x8a2a4a, 0x3a6a3a]));
    s.add(box(0.42, 0.32, 0.6, cloth, [0, 0.55, 0.15]));
    s.add(box(0.44, 0.28, 0.24, cloth, [0, 0.8, 0.0], [-0.5, 0, 0]));
    s.add(box(0.46, 0.03, 0.03, frame, [0, 0.95, -0.3]));
    for (const sx of [-0.2, 0.2]) {
      s.add(box(0.025, 0.55, 0.025, frame, [sx, 0.7, -0.2], [0.5, 0, 0]));
      for (const z of [-0.05, 0.38]) s.add(box(0.03, 0.12, 0.12, frame, [sx, 0.06, z]));
    }
    s.position.set(0, 0, 0.62);
    rig.root.add(s);
  }
}

/** After the walk cycle: what carrying the thing does to the arms. */
export function carryPose(rig, walking) {
  const c = rig.carry;
  if (!c || rig.chatT > 0) return;
  const t = rig.t || 0;
  const A = rig.armR, L = rig.armL;
  if (c === 'stroller' || c === 'pcart') {
    for (const a of [A, L]) { a.pivot.rotation.x = -0.85; a.elbow.rotation.x = -0.45; }
    A.pivot.rotation.z = -0.05; L.pivot.rotation.z = 0.05;
  } else if (c === 'phone') {
    A.pivot.rotation.x = -0.4; A.pivot.rotation.z = -0.45; A.elbow.rotation.x = -2.35;
    rig.head.rotation.z = 0.12;
  } else if (c === 'food' || c === 'coffee') {
    // carried at the chest, and every few seconds up to the mouth for a bite or a sip
    const cyc = (t * (walking ? 0.16 : 1)) % 5;
    const up = cyc > 4 ? Math.sin((cyc - 4) * Math.PI) : 0;
    A.pivot.rotation.x = -0.45 - up * 0.6;
    A.elbow.rotation.x = -1.25 - up * 1.0;
  } else if (c === 'bags') {
    A.pivot.rotation.z = -0.14; L.pivot.rotation.z = 0.14;
    A.pivot.rotation.x *= 0.4; L.pivot.rotation.x *= 0.4;
    A.elbow.rotation.x = -0.1; L.elbow.rotation.x = -0.1;
  } else if (c === 'paper') {
    for (const a of [A, L]) { a.pivot.rotation.x = -0.7; a.elbow.rotation.x = -1.0; }
    A.pivot.rotation.z = -0.25; L.pivot.rotation.z = 0.25;
    rig.head.rotation.x = 0.3;
  } else if (c === 'package') {
    for (const a of [A, L]) { a.pivot.rotation.x = -0.65; a.elbow.rotation.x = -0.9; }
    A.pivot.rotation.z = -0.2; L.pivot.rotation.z = 0.2;
  } else if (c === 'headphones') {
    rig.head.rotation.x = Math.sin(t * 1.6) * 0.06;
  } else if (c === 'cane') {
    // the cane goes forward with the opposite foot and comes down with it
    A.pivot.rotation.x = -0.25 + Math.sin(t) * 0.22;
    A.elbow.rotation.x = -0.25;
    rig.torso.rotation.x = 0.1;
  }
}

/* ------------------------------------------------------------------ talking on the sidewalk */

const HELLO = [
  ['Ayy, look who it is!', 'Long time! How is your mother?'],
  ['You see the game last night?', 'Do not talk to me about the game.'],
  ['Hey! You still owe me five dollars.', 'I owe everybody five dollars.'],
  ['Is that a new jacket?', 'Since Tuesday. You noticed. Finally.'],
  ['You going to the block party?', 'If Lou is cooking, yes.'],
  ['Where you been?', 'Around. Working. Same as you.'],
  ['Did you hear about Rae?', 'Everybody heard about Rae.'],
  ['That pizza place raised the slice again.', 'Three dollars. For a triangle.'],
  ['Your cousin still at the post office?', 'Retired. Now he watches the post office.'],
  ['Hot enough for you?', 'Do not start.'],
];

/** Walkers on a collision course sometimes stop to talk. Called each frame by the world. */
export function crowdTick(world, dt) {
  world.crowdT = (world.crowdT || 0) - dt;
  const walkers = world.npcRigs.filter((r) => r.npcDef?.walker && !r.down && !r.gone && r.root.visible);
  // Nobody walks through anybody. Two people who meet on the sidewalk come out of it beside each
  // other; a pair that is talking is left alone (they are meant to be close), and neither is pushed
  // into a wall or out of the street to make room.
  const bounds = world.area?.bounds;
  for (let i = 0; i < walkers.length; i++) {
    for (let j = i + 1; j < walkers.length; j++) {
      const a = walkers[i], b = walkers[j];
      if (a.chatWith === b && a.chatT > 0) continue;
      const dx = b.root.position.x - a.root.position.x;
      const dz = b.root.position.z - a.root.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 0.36 || d2 < 1e-6) continue; // 60 cm apart or further: not touching
      const d = Math.sqrt(d2);
      const push = (0.6 - d) * Math.min(1, dt * 6) * 0.5;
      const ux = dx / d, uz = dz / d;
      const step = (rig, sx, sz) => {
        const nx = rig.root.position.x + sx, nz = rig.root.position.z + sz;
        if (bounds && (nx < bounds.minX + 0.3 || nx > bounds.maxX - 0.3 || nz < bounds.minZ + 0.3 || nz > bounds.maxZ - 0.3)) return;
        if (world.blocked?.(nx, nz)) return;
        rig.root.position.x = nx;
        rig.root.position.z = nz;
      };
      step(a, -ux * push, -uz * push);
      step(b, ux * push, uz * push);
    }
  }
  for (const r of walkers) {
    // something happened: stop, turn, look
    if (r.reactT > 0) {
      r.reactT -= dt;
      if (r.reactAt) r.root.rotation.y = Math.atan2(r.reactAt.x - r.root.position.x, r.reactAt.z - r.root.position.z);
      continue;
    }
    if (r.chatT > 0) {
      r.chatT -= dt;
      const o = r.chatWith;
      if (o) r.root.rotation.y = Math.atan2(o.root.position.x - r.root.position.x, o.root.position.z - r.root.position.z);
      // hands while talking
      const t = (r.t || 0) + r.chatT;
      r.armR.pivot.rotation.x = -0.5 + Math.sin(t * 3) * 0.25;
      r.armR.elbow.rotation.x = -1.2;
      if (r.chatT <= 0) { r.chatCool = 30 + Math.random() * 30; r.chatWith = null; }
    } else if (r.chatCool > 0) r.chatCool -= dt;
  }
  if (world.crowdT > 0) return;
  world.crowdT = 0.6;
  for (let i = 0; i < walkers.length; i++) {
    const a = walkers[i];
    if (a.chatT > 0 || a.chatCool > 0 || a.carry === 'jog' || a.carry === 'stroller' || a.carry === 'pcart') continue;
    for (let j = i + 1; j < walkers.length; j++) {
      const b = walkers[j];
      if (b.chatT > 0 || b.chatCool > 0 || b.carry === 'jog' || b.carry === 'pcart') continue;
      const dx = b.root.position.x - a.root.position.x;
      const dz = b.root.position.z - a.root.position.z;
      if (Math.abs(dx) > 1.8 || Math.abs(dx) < 0.7 || Math.abs(dz) > 1.4) continue;
      // coming toward each other
      if (Math.sign(dx) !== a.walkDir || Math.sign(-dx) !== b.walkDir) continue;
      a.chatCool = b.chatCool = 12;
      if (Math.random() > 0.4) continue;
      const len = 4 + Math.random() * 3;
      a.chatT = b.chatT = len;
      a.chatWith = b; b.chatWith = a;
      const [l1, l2] = pick(HELLO);
      bark(a, l1, 2.6);
      setTimeout(() => { if (b.chatT > 0) bark(b, l2, 2.8); }, 1700);
      break;
    }
  }
}

/** A short line over somebody's head for a few seconds. */
export function bark(rig, text, secs = 2.5) {
  if (!rig?.root) return;
  if (rig.barkSprite) { rig.root.remove(rig.barkSprite); rig.barkSprite.material.map.dispose(); rig.barkSprite.material.dispose(); }
  const cv = document.createElement('canvas');
  const c = cv.getContext('2d');
  c.font = 'bold 22px monospace';
  const w = Math.min(512, Math.ceil(c.measureText(text).width) + 28);
  cv.width = w; cv.height = 40;
  c.font = 'bold 22px monospace';
  c.fillStyle = 'rgba(14,12,12,0.86)';
  c.fillRect(0, 0, w, 40);
  c.strokeStyle = '#e8c83a';
  c.lineWidth = 3;
  c.strokeRect(1.5, 1.5, w - 3, 37);
  c.fillStyle = '#f4f0e4';
  c.textBaseline = 'middle';
  c.fillText(text, 14, 21);
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(w / 210, 40 / 210, 1);
  sp.position.set(0, 2.15, 0);
  sp.renderOrder = 10;
  rig.root.add(sp);
  rig.barkSprite = sp;
  const mine = sp;
  setTimeout(() => {
    if (rig.barkSprite !== mine) return;
    rig.root.remove(mine);
    mine.material.map.dispose();
    mine.material.dispose();
    rig.barkSprite = null;
  }, secs * 1000);
}

/* ------------------------------------------------------------------ errands */

/**
 * Now and then a walker passing a shop door turns in: walks up to the door, goes inside (out of
 * sight for half a minute or so), and comes back out with a bag, then carries on. `area.doors` is
 * a list of [x, z] door spots. Returns true while the errand is driving the walker.
 */
export function errand(world, rig, dt) {
  const doors = world.area?.doors;
  const e = rig.errand;
  if (!e) {
    if (!doors?.length || rig.carry === 'stroller' || rig.carry === 'pcart' || rig.carry === 'jog' || (rig.errandCool = (rig.errandCool ?? 8 + Math.random() * 20) - dt) > 0) return false;
    const x = rig.root.position.x;
    const near = doors.find(([dx]) => Math.abs(dx - x) < 0.6);
    rig.errandCool = 6;
    if (!near || Math.random() > 0.18) return false;
    rig.errand = { phase: 'in', x: near[0], z: near[1], back: rig.root.position.z, t: 0 };
    return true;
  }
  const p = rig.root.position;
  if (e.phase === 'in' || e.phase === 'out') {
    const tz = e.phase === 'in' ? e.z : e.back;
    const dz = tz - p.z;
    rig.walking = true;
    rig.root.rotation.y = dz < 0 ? Math.PI : 0;
    p.x += (e.x - p.x) * Math.min(1, dt * 3);
    if (Math.abs(dz) < 0.08) {
      if (e.phase === 'in') { e.phase = 'inside'; e.t = 20 + Math.random() * 35; rig.root.visible = false; }
      else { rig.errand = null; rig.errandCool = 60 + Math.random() * 60; }
    } else p.z += Math.sign(dz) * Math.min(Math.abs(dz), 1.0 * dt);
    return true;
  }
  if (e.phase === 'inside') {
    rig.walking = false;
    e.t -= dt;
    if (e.t <= 0) {
      rig.root.visible = true;
      e.phase = 'out';
      // out with a bag, if their hands were free
      if (!rig.carry) {
        rig.carry = 'bags';
        const k = rig.k || 1;
        rig.armR.elbow.add(box(0.24, 0.3, 0.12, MAT('bag', 0xf2f2ec), [0, -0.46 * k, 0]));
      }
    }
    return true;
  }
  return false;
}
