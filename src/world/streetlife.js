/**
 * Street life: the people (and the dog) that make Kestrel look lived in.
 *
 *   acts      body language layered over the normal NPC animation, by `npcDef.act`:
 *             'dice' (crouched over the crates, one of them shaking and throwing), 'watch'
 *             (bent over the game, arms crossed, the occasional cheer), 'argue' (two people
 *             taking turns being furious), 'smoke' (hand to mouth, a drag, a breath of smoke).
 *   smoke     a small pool of puffs that billboard to the camera and fade as they rise.
 *   the dog   Meatball: a stray who walks the block. Feed him and he likes Mo more (state.dog.like,
 *             0-100); past halfway he trots along beside Mo on the street; at 100 he comes when
 *             whistled for in a fight (fights.js + World.startMugging).
 *   events    now and then something happens where Mo can see it: a patrol car rolls by with
 *             its lights going, a kid flies past on a bike.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box } from '../render/retro.js';
import { createNPC } from './characters.js';
import { dayOf, pick } from '../core/util.js';
import { bump, removeItem, inventoryList } from '../core/state.js';
import { CONFIG } from '../core/config.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/* ------------------------------------------------------------------ acts */

/** Called every frame after animateNPC for a rig whose def has an `act`. */
export function applyAct(rig, dt, life) {
  const act = rig.npcDef?.act;
  if (!act) return;
  rig.actT = (rig.actT || Math.random() * 10) + dt;
  const t = rig.actT;
  if (act === 'dice' || act === 'watch') {
    // down on the haunches over the crates
    const crouch = act === 'dice' ? 1 : 0.35;
    rig.hips.position.y = rig.hipY - 0.36 * crouch;
    rig.legL.pivot.rotation.x = -1.25 * crouch;
    rig.legR.pivot.rotation.x = -1.1 * crouch;
    rig.legL.knee.rotation.x = 2.0 * crouch;
    rig.legR.knee.rotation.x = 1.9 * crouch;
    rig.torso.rotation.x = 0.35 * crouch + (act === 'watch' ? 0.18 : 0);
    rig.head.rotation.x = 0.25;
    if (act === 'dice') {
      // shake, shake, shake... throw
      const cyc = t % 3.4;
      const shake = cyc < 2.4 ? Math.sin(t * 22) * 0.18 : 0;
      const throwK = cyc >= 2.4 ? Math.sin(((cyc - 2.4) / 1.0) * Math.PI) : 0;
      rig.armR.pivot.rotation.x = -0.9 + shake - throwK * 0.7;
      rig.armR.elbow.rotation.x = -1.2 + throwK * 1.0;
      rig.armL.pivot.rotation.x = -0.5;
      rig.armL.elbow.rotation.x = -0.9;
      if (cyc >= 3.3 && !rig.thrown) { rig.thrown = true; life?.onThrow?.(); }
      if (cyc < 1) rig.thrown = false;
    } else {
      const cheer = life?.cheerUntil > life?.clock ? 1 : 0;
      if (cheer) {
        rig.armL.pivot.rotation.x = -2.8 + Math.sin(t * 12) * 0.2;
        rig.armR.pivot.rotation.x = -2.8 + Math.sin(t * 12 + 1) * 0.2;
        rig.armL.elbow.rotation.x = -0.3;
        rig.armR.elbow.rotation.x = -0.3;
        rig.torso.rotation.x = 0;
      } else {
        // arms folded, leaning in
        rig.armL.pivot.rotation.x = -0.75; rig.armL.pivot.rotation.z = 0.55; rig.armL.elbow.rotation.x = -1.5;
        rig.armR.pivot.rotation.x = -0.75; rig.armR.pivot.rotation.z = -0.55; rig.armR.elbow.rotation.x = -1.5;
      }
    }
    return;
  }
  if (act === 'argue') {
    // they take turns: 2.2 s each, the talker gestures and leans in, the other one stews
    const side = rig.npcDef.side || 0;
    // a shared clock, so one talks while the other stews (their own clocks drifted into unison)
    const talking = Math.floor((life?.clock ?? t) / 2.2) % 2 === side;
    if (talking) {
      rig.armR.pivot.rotation.x = -0.7 + Math.sin(t * 7) * 0.45;
      rig.armR.elbow.rotation.x = -0.9 + Math.sin(t * 9) * 0.3;
      rig.armL.pivot.rotation.x = -0.4 + Math.sin(t * 5 + 1) * 0.35;
      rig.armL.elbow.rotation.x = -0.6;
      rig.head.rotation.x = Math.sin(t * 9) * 0.1;
      rig.head.rotation.y = Math.sin(t * 3) * 0.15;
      rig.torso.rotation.x = 0.1;
    } else {
      // arms folded, a head shake now and then
      rig.armL.pivot.rotation.x = -0.75; rig.armL.pivot.rotation.z = 0.5; rig.armL.elbow.rotation.x = -1.5;
      rig.armR.pivot.rotation.x = -0.75; rig.armR.pivot.rotation.z = -0.5; rig.armR.elbow.rotation.x = -1.5;
      rig.head.rotation.y = Math.sin(t * 6) * 0.22 * (Math.sin(t * 0.9) > 0.3 ? 1 : 0);
      rig.torso.rotation.x = -0.05;
    }
    return;
  }
  if (act === 'pee') {
    // facing the alley wall, hands in front, a slow sway, and a thin stream to the ground
    rig.armL.pivot.rotation.x = -0.45; rig.armL.elbow.rotation.x = -0.7; rig.armL.pivot.rotation.z = 0.25;
    rig.armR.pivot.rotation.x = -0.45; rig.armR.elbow.rotation.x = -0.7; rig.armR.pivot.rotation.z = -0.25;
    rig.head.rotation.x = -0.25 + Math.sin(t * 0.7) * 0.06;
    rig.root.rotation.z = Math.sin(t * 0.9) * 0.025;
    if (!rig.prop) {
      const m = retroMaterial('pee', { color: 0xe8d04a, emissive: 0.4, unlit: true, opacity: 0.55, transparent: true });
      rig.prop = box(0.025, 0.86, 0.025, m, [0, 0.43, 0.32]);
      rig.prop.rotation.x = 0.35;
      rig.root.add(rig.prop);
      rig.puddle = box(0.4, 0.005, 0.3, retroMaterial('puddle', { color: 0x8a7a3a, opacity: 0.45, transparent: true }), [0, 0.006, 0.55]);
      rig.root.add(rig.puddle);
    }
    rig.prop.scale.x = 0.7 + Math.sin(t * 30) * 0.3;
    return;
  }
  if (act === 'lean') {
    // back to the wall, head back, hands flat on the wall behind him
    rig.head.rotation.x = -0.35 + Math.sin(t * 2.6) * 0.05;
    rig.armL.pivot.rotation.x = 0.35; rig.armL.pivot.rotation.z = -0.35; rig.armL.elbow.rotation.x = -0.2;
    rig.armR.pivot.rotation.x = 0.35; rig.armR.pivot.rotation.z = 0.35; rig.armR.elbow.rotation.x = -0.2;
    rig.torso.rotation.x = -0.08;
    return;
  }
  if (act === 'kneel') {
    // on her knees, bobbing; the mosaic in front of her does the rest of the work
    rig.hips.position.y = 0.48 + Math.sin(t * 5.2) * 0.02;
    rig.legL.pivot.rotation.x = 0.1; rig.legR.pivot.rotation.x = 0.1;
    rig.legL.knee.rotation.x = 1.55; rig.legR.knee.rotation.x = 1.55;
    rig.torso.rotation.x = 0.32 + Math.sin(t * 5.2) * 0.14;
    rig.head.rotation.x = -0.15 + Math.sin(t * 5.2 + 0.4) * 0.12;
    rig.armL.pivot.rotation.x = -0.9; rig.armL.elbow.rotation.x = -0.5;
    rig.armR.pivot.rotation.x = -0.9; rig.armR.elbow.rotation.x = -0.5;
    if (!rig.prop) {
      rig.prop = box(0.4, 0.42, 0.42, retroMaterial('mosaic', { map: mosaicTexture(), emissive: 0.35, unlit: true }), [0, 0.95, 0.42]);
      rig.root.add(rig.prop);
    }
    rig.prop.position.y = 0.95 + Math.sin(t * 5.2) * 0.02;
    return;
  }
  if (act === 'phone') {
    // a receiver to the ear, the other hand flat on the glass or the counter
    rig.armR.pivot.rotation.x = -1.25; rig.armR.pivot.rotation.z = -0.55; rig.armR.elbow.rotation.x = -2.1;
    rig.armL.pivot.rotation.x = -0.6; rig.armL.elbow.rotation.x = -0.6;
    rig.head.rotation.z = 0.12;
    rig.head.rotation.x = Math.sin(t * 2.2) * 0.07;
    return;
  }
  if (act === 'fold') {
    // at the folding table: shake it out, fold it in half, in half again, onto the pile
    const cyc = t % 3.2;
    const lift = Math.sin(Math.min(1, cyc / 1.6) * Math.PI);
    rig.armL.pivot.rotation.x = -0.75 - lift * 0.45; rig.armL.elbow.rotation.x = -0.55 + lift * 0.3; rig.armL.pivot.rotation.z = 0.15 + (cyc > 1.6 ? 0.35 : 0);
    rig.armR.pivot.rotation.x = -0.75 - lift * 0.45; rig.armR.elbow.rotation.x = -0.55 + lift * 0.3; rig.armR.pivot.rotation.z = -0.15 - (cyc > 1.6 ? 0.35 : 0);
    rig.torso.rotation.x = 0.18;
    rig.head.rotation.x = 0.3;
    return;
  }
  if (act === 'talk') {
    // a quieter argue: one hand going, nodding
    rig.armR.pivot.rotation.x = -0.5 + Math.sin(t * 4) * 0.25;
    rig.armR.elbow.rotation.x = -0.9;
    rig.head.rotation.x = Math.sin(t * 3.4) * 0.08;
    return;
  }
  if (act === 'smoke') {
    // a drag every few seconds: hand up, hold, hand down, a breath of smoke
    const cyc = t % 5.5;
    const up = clamp01(cyc / 0.6) * (1 - clamp01((cyc - 1.8) / 0.6));
    // upper arm forward and in, forearm folded right up: the hand stops at the mouth
    rig.armR.pivot.rotation.x = -0.2 - up * 0.95;
    rig.armR.pivot.rotation.z = -0.38 * up;
    rig.armR.elbow.rotation.x = -0.3 - up * 2.05;
    rig.armL.pivot.rotation.z = 0.15;
    if (cyc > 2.5 && cyc < 2.6 && !rig.puffed) { rig.puffed = true; life?.puff(rig, 1); }
    if (cyc < 1) rig.puffed = false;
    if (Math.random() < dt * 0.8) life?.puff(rig, 0.3, true); // the cigarette itself
  }
}

/** A pixel mosaic, the way TV blurs what it cannot show: big squares of skin and shadow. */
let mosaicTex = null;
function mosaicTexture() {
  if (mosaicTex) return mosaicTex;
  const c = document.createElement('canvas');
  c.width = 8; c.height = 8;
  const x = c.getContext('2d');
  const tones = ['#c8906a', '#a8724e', '#8a5a3a', '#d8a888', '#6a4a3a', '#b88262', '#2a2c34', '#8a2a5a'];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = tones[Math.floor(Math.random() * tones.length)]; x.fillRect(i, j, 1, 1); }
  mosaicTex = new THREE.CanvasTexture(c);
  mosaicTex.magFilter = THREE.NearestFilter;
  mosaicTex.minFilter = THREE.NearestFilter;
  mosaicTex.colorSpace = THREE.SRGBColorSpace;
  return mosaicTex;
}

/* ------------------------------------------------------------------ the dog */

/**
 * Meatball: built from faceted solids like the people are, not from boxes. A barrel chest that
 * tapers to the hips, a neck, a domed skull with a tapered muzzle and floppy ears, legs in two
 * segments with paws, a whip of a tail, a white blaze down the chest and a frayed red collar
 * somebody once put on him. Same pivots as before (head, tail, four legs), so the animation and
 * the follow logic did not change.
 */
function buildDog() {
  const g = new THREE.Group();
  const fur = retroMaterial('dog_fur', { color: 0x9a7448 });
  const dark = retroMaterial('dog_dark', { color: 0x4f3a24 });
  const pale = retroMaterial('dog_pale', { color: 0xe8dcc4 });
  const nose = retroMaterial('dog_nose', { color: 0x141110 });
  const collar = retroMaterial('dog_collar', { color: 0xa8241e });
  const eyeMat = retroMaterial('dog_eye', { color: 0x1a120a, ambient: 1 });
  const mesh = (geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...p); m.rotation.set(...r); m.scale.set(...s);
    return m;
  };
  // a tapered cylinder lying along x
  const along = (r1, r2, len, mat, p, sides = 7) => mesh(new THREE.CylinderGeometry(r2, r1, len, sides), mat, p, [0, 0, -Math.PI / 2]);

  // body: chest, belly, hips, with a darker saddle over the back
  g.add(mesh(new THREE.IcosahedronGeometry(0.17, 1), fur, [0.17, 0.46, 0], [0, 0, 0], [1.15, 1.05, 0.95]));   // chest
  g.add(along(0.15, 0.125, 0.42, fur, [-0.02, 0.45, 0]));                                                     // barrel
  g.add(mesh(new THREE.IcosahedronGeometry(0.135, 1), fur, [-0.22, 0.46, 0], [0, 0, 0], [1.1, 1, 1]));       // hips
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.4, 7, 1, false, Math.PI * 0.6, Math.PI * 0.8), dark, [-0.02, 0.47, 0], [0, 0, -Math.PI / 2], [1, 1.12, 1.12])); // saddle
  g.add(mesh(new THREE.IcosahedronGeometry(0.1, 0), pale, [0.27, 0.4, 0], [0, 0, 0], [0.7, 1.2, 0.85]));     // white blaze
  // neck and collar
  g.add(mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.2, 7), fur, [0.3, 0.6, 0], [0, 0, -0.75]));
  g.add(mesh(new THREE.TorusGeometry(0.085, 0.018, 4, 9), collar, [0.32, 0.6, 0], [0, Math.PI / 2, 0.8]));
  g.add(mesh(new THREE.OctahedronGeometry(0.022, 0), retroMaterial('dog_tag', { color: 0xd8b04a, ambient: 1 }), [0.38, 0.54, 0]));

  const head = new THREE.Group();
  head.position.set(0.38, 0.68, 0);
  head.add(mesh(new THREE.IcosahedronGeometry(0.105, 1), fur, [0, 0.02, 0], [0, 0, 0], [1.05, 0.95, 0.95]));  // skull
  head.add(along(0.07, 0.045, 0.14, fur, [0.13, -0.02, 0], 6));                                               // muzzle
  head.add(along(0.05, 0.035, 0.1, pale, [0.15, -0.045, 0], 6));                                              // pale chin
  head.add(mesh(new THREE.IcosahedronGeometry(0.026, 0), nose, [0.205, -0.005, 0]));
  for (const z of [-0.045, 0.045]) {
    head.add(mesh(new THREE.IcosahedronGeometry(0.016, 0), eyeMat, [0.075, 0.045, z]));
    // ears: soft flaps that fold over and hang
    const ear = mesh(new THREE.ConeGeometry(0.045, 0.13, 4), dark, [-0.015, 0.02, z * 2.15], [Math.PI - Math.sign(z) * 0.45, 0, 0.15], [1, 1, 0.45]);
    head.add(ear);
  }
  g.add(head);

  const tail = new THREE.Group();
  tail.position.set(-0.33, 0.52, 0);
  // a cone with its base at the rump, tipped up and back, and a pale tip on the end of it
  const tailGeo = new THREE.ConeGeometry(0.035, 0.26, 5).translate(0, 0.13, 0);
  const tipGeo = new THREE.ConeGeometry(0.016, 0.07, 5).translate(0, 0.225, 0);
  tail.add(mesh(tailGeo, fur, [0, 0, 0], [0, 0, Math.PI * 0.3]));
  tail.add(mesh(tipGeo, pale, [0, 0, 0], [0, 0, Math.PI * 0.3]));
  g.add(tail);

  const legs = [];
  for (const [x, z] of [[0.2, 0.085], [0.2, -0.085], [-0.22, 0.085], [-0.22, -0.085]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.4, z);
    const front = x > 0;
    // upper leg (shoulder or haunch), lower leg, and a paw that sits flat
    pivot.add(mesh(new THREE.CylinderGeometry(0.045, front ? 0.06 : 0.075, 0.2, 6), fur, [front ? 0 : -0.02, -0.08, 0], [0, 0, front ? 0 : -0.25]));
    pivot.add(mesh(new THREE.CylinderGeometry(0.03, 0.038, 0.2, 6), front ? fur : dark, [0, -0.25, 0]));
    pivot.add(mesh(new THREE.IcosahedronGeometry(0.04, 0), front ? pale : dark, [0.025, -0.36, 0], [0, 0, 0], [1.4, 0.6, 1]));
    g.add(pivot);
    legs.push(pivot);
  }
  return { root: g, head, tail, legs, t: 0 };
}

export function dogState(s) {
  if (!s.dog) s.dog = { like: 0, fedDay: 0, fedToday: 0, name: 'Meatball', fights: 0 };
  return s.dog;
}

/** The dog's food: the cheapest thing in his pockets that a dog would eat. */
function dogFood(s) {
  return inventoryList(s).filter((it) => it.def?.kind === 'food' && it.id !== 'nia_meal').sort((a, b) => (a.def.price || 0) - (b.def.price || 0))[0];
}

/* ------------------------------------------------------------------ the whole street */

export class StreetLife {
  constructor(world, g) {
    this.world = world;
    this.clock = 0;
    this.cheerUntil = 0;
    this.puffs = [];
    for (let i = 0; i < 28; i++) {
      const mat = retroMaterial(`streetSmoke${i}`, { color: 0xd8e2dc, unlit: true, opacity: 0, transparent: true });
      const mesh = box(0.16, 0.16, 0.001, mat, [0, -10, 0]);
      mesh.visible = false;
      mesh.renderOrder = 3;
      world.root.add(mesh);
      this.puffs.push({ mesh, mat, alive: false, age: 0, life: 1, vx: 0, vy: 0, vz: 0, size: 0.1 });
    }
    this.eventTimer = 20 + Math.random() * 25;
    this.dog = null;
    if (world.areaId === 'street' || (world.areaId === 'park' && dogState(g.state).withMo)) this.spawnDog(g);
  }

  remove() {
    for (const p of this.puffs) p.mesh.parent?.remove(p.mesh);
    this.puffs = [];
    if (this.dog) { this.dog.root.parent?.remove(this.dog.root); this.dog = null; }
    this.dropDogInteract();
    this.bike?.root.parent?.remove(this.bike.root);
    this.bike = null;
  }

  onThrow() {
    if (Math.random() < 0.35) this.cheerUntil = this.clock + 1.2;
  }

  /** A breath of smoke from a rig's mouth (or a thin wisp off the cigarette). */
  puff(rig, strength = 1, wisp = false) {
    const p = this.puffs.find((x) => !x.alive);
    if (!p) return;
    const head = new THREE.Vector3();
    rig.head.getWorldPosition(head);
    const yaw = rig.root.rotation.y;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    if (wisp) p.mesh.position.set(head.x + fx * 0.2 + Math.cos(yaw) * 0.15, head.y - 0.25, head.z + fz * 0.2 - Math.sin(yaw) * 0.15);
    else p.mesh.position.set(head.x + fx * 0.22, head.y - 0.04, head.z + fz * 0.22);
    p.alive = true;
    p.age = 0;
    p.life = wisp ? 1.4 : 2.6;
    p.vx = fx * (wisp ? 0.02 : 0.18) + (Math.random() - 0.5) * 0.05;
    p.vz = fz * (wisp ? 0.02 : 0.18) + (Math.random() - 0.5) * 0.05;
    p.vy = wisp ? 0.2 : 0.12;
    p.size = wisp ? 0.05 : 0.13 * strength + 0.06;
    p.mesh.visible = true;
  }

  /* ---- the dog ---- */

  spawnDog(g) {
    this.dog = buildDog();
    const mo = this.world.mo?.root.position;
    if (this.world.areaId === 'park' && mo) this.dog.root.position.set(mo.x - 1, 0, mo.z + 0.8);
    else this.dog.root.position.set(-6 + Math.random() * 12, 0, -1.2);
    this.dog.target = this.pickDogSpot();
    this.world.root.add(this.dog.root);
    const d = dogState(g.state);
    this.dogInteract = { id: 'dog', label: `${d.like > 0 ? d.name : 'A stray dog'}`, sub: '', x: 0, z: 0, radius: 1.3, action: (gg) => this.dogMenu(gg) };
    this.world.interactables.push(this.dogInteract);
  }

  dropDogInteract() {
    if (!this.dogInteract) return;
    const list = this.world.interactables;
    const i = list.indexOf(this.dogInteract);
    if (i >= 0) list.splice(i, 1);
    this.dogInteract = null;
  }

  pickDogSpot() {
    if (this.world.areaId === 'park') return { x: -6 + Math.random() * 12, z: -6 + Math.random() * 12, wait: 1 + Math.random() * 4 };
    return { x: -22 + Math.random() * 50, z: -0.4 - Math.random() * 3.6, wait: 1 + Math.random() * 4 };
  }

  dogMenu(g) {
    const s = g.state;
    const d = dogState(s);
    const food = dogFood(s);
    const today = dayOf(s.clock.m);
    if (d.fedDay !== today) { d.fedDay = today; d.fedToday = 0; }
    const meter = '♥'.repeat(Math.round(d.like / 20)) + '·'.repeat(5 - Math.round(d.like / 20));
    g.openModal({
      kicker: 'KESTREL ST. · THE STRAY', title: d.like > 0 ? d.name : 'A Stray Dog',
      body: `${d.like >= 100 ? `${d.name} leans his whole weight against your leg. He is yours now, or you are his. Whistle in a tight spot and he comes.` : d.like >= 60 ? `${d.name} trots over the second he sees you, tail going.` : d.like > 0 ? `${d.name} remembers you. He keeps a careful distance and a hopeful face.` : 'A brown dog with one ear up and one ear somewhere else. No collar. He has the look of a dog who has been told "no" by the whole block.'}\n\nHow much he likes you: ${meter}`,
      choices: [
        { label: food ? `Give him your ${food.def.name}.` : 'Give him something to eat.', sub: food ? 'he will remember' : 'you have nothing on you', disabled: !food || d.fedToday >= 2,
          effect: () => {
            removeItem(s, food.id, 1);
            d.fedToday += 1;
            const was = d.like;
            d.like = Math.min(100, d.like + CONFIG.dog.likePerMeal);
            bump(s, 'morale', 4);
            g.advance(3);
            if (was === 0) d.name = 'Meatball';
            g.toast(d.like >= 100 && was < 100 ? `${d.name} eats it in two bites and then sits on your foot. That is a contract.` : `${d.name} eats it like somebody might take it away, then looks at you like you might do it again.`, 'good');
          } },
        { label: 'Kick him.', sub: 'he will remember', effect: () => this.world.kickDog?.(g) },
        { label: 'Scratch behind his ears.', sub: '+morale', effect: () => { bump(s, 'morale', 3); bump(s, 'stress', -3); g.advance(2); if (d.like === 0) d.name = 'Meatball'; g.toast(`${d.like > 0 ? d.name : 'The dog'} closes his eyes. Your whole week gets a little smaller.`, 'good'); } },
        { label: 'Leave him be.', sub: '', effect: () => {} },
      ],
    });
  }

  updateDog(dt, g) {
    const dog = this.dog;
    if (!dog) return;
    const s = g.state;
    const d = dogState(s);
    const mo = this.world.mo.root.position;
    const p = dog.root.position;
    const park = this.world.areaId === 'park';
    // kicked: he runs from Mo for a few seconds and does not come back to heel for a while
    if (dog.scared > 0) {
      dog.scared -= dt;
      const ang = Math.atan2(p.x - mo.x, p.z - mo.z);
      p.x += Math.sin(ang) * 4 * dt;
      p.z = park ? Math.max(-7.5, Math.min(7.5, p.z + Math.cos(ang) * 4 * dt)) : Math.max(-4.2, Math.min(0.9, p.z + Math.cos(ang) * 4 * dt));
      // the yelp: a hop off the ground, then the run
      if (dog.hop > 0) { dog.hop = Math.max(0, dog.hop - dt); p.y = Math.sin((1 - dog.hop / 0.35) * Math.PI) * 0.35; } else p.y = 0;
      dog.root.rotation.y = Math.atan2(-Math.cos(ang), Math.sin(ang));
      dog.t += dt * 14;
      dog.legs.forEach((leg, i) => { leg.rotation.z = Math.sin(dog.t + (i % 2 ? Math.PI : 0)) * 0.6; });
      dog.target = null;
      return;
    }
    let tx, tz;
    const moDist = Math.hypot(mo.x - p.x, mo.z - p.z);
    if (d.like >= CONFIG.dog.followAt && moDist < 14 && (park || mo.z < 1.4)) {
      // trot along a step behind and to the side
      tx = mo.x - 1.0; tz = park ? mo.z + 0.8 : Math.min(1.0, mo.z + 0.8);
    } else {
      if (!dog.target) dog.target = this.pickDogSpot();
      tx = dog.target.x; tz = dog.target.z;
    }
    const dx = tx - p.x, dz = tz - p.z;
    const dist = Math.hypot(dx, dz);
    const walking = dist > 0.3;
    if (walking) {
      const speed = d.like >= CONFIG.dog.followAt && moDist < 14 ? Math.min(3.2, 0.8 + dist * 1.4) : 1.0;
      p.x += (dx / dist) * Math.min(dist, speed * dt);
      p.z += (dz / dist) * Math.min(dist, speed * dt);
      dog.root.rotation.y = Math.atan2(-dz, dx);
    } else if (dog.target && !(d.like >= CONFIG.dog.followAt && moDist < 14)) {
      dog.target.wait -= dt;
      if (dog.target.wait <= 0) dog.target = this.pickDogSpot();
    }
    dog.t += dt * (walking ? 9 : 2);
    dog.legs.forEach((leg, i) => { leg.rotation.z = walking ? Math.sin(dog.t + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.5 : 0; });
    dog.tail.rotation.y = Math.sin(dog.t * (d.like > 0 ? 3 : 1)) * (d.like > 0 ? 0.6 : 0.2);
    dog.head.rotation.z = walking ? 0 : Math.sin(dog.t * 0.7) * 0.1;
    if (this.dogInteract) {
      this.dogInteract.x = p.x;
      this.dogInteract.z = p.z;
      this.dogInteract.label = d.like > 0 ? `${d.name} (the dog)` : 'A stray dog';
      this.dogInteract.sub = d.like >= 100 ? 'your dog, basically' : d.like > 0 ? 'he remembers you' : 'no collar, one ear up';
    }
  }

  /* ---- things that happen ---- */

  update(dt, g) {
    this.clock += dt;
    for (const p of this.puffs) {
      if (!p.alive) continue;
      p.age += dt;
      const a = p.age / p.life;
      if (a >= 1) { p.alive = false; p.mesh.visible = false; p.mat.uniforms.uOpacity.value = 0; continue; }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.quaternion.copy(this.world.camera.quaternion);
      p.mesh.scale.setScalar(p.size * (0.6 + a * 2.8) / 0.16);
      p.mat.uniforms.uOpacity.value = (1 - a) * (1 - a) * 0.6;
    }
    this.updateDog(dt, g);
    this.updateBike(dt);
    if (this.world.areaId !== 'street') return;
    this.eventTimer -= dt;
    if (this.eventTimer <= 0 && !g.modalOpen) {
      this.eventTimer = 35 + Math.random() * 50;
      const r = Math.random();
      if (r < 0.45) {
        this.world.traffic?.spawnSpecial?.('police');
        g.toast(pick(['A patrol car rolls down Kestrel with its lights going and no siren, which is somehow worse.', 'Cops, slow, looking at everybody. Everybody looks at the sky.']), 'info');
      } else if (r < 0.75) {
        this.startBike();
        g.toast('A kid on a bike flies down the sidewalk yelling "ON YOUR LEFT" to nobody in particular.', 'info');
      } else {
        g.toast(pick([
          'Somebody\'s grocery bag splits outside the bodega. Three oranges make a run for the gutter. Two make it.',
          'Upstairs, a window opens and somebody yells a name down the block. Nobody answers. They yell it again.',
          'A pigeon lands on the bus stop sign, looks at you, and decides you are not worth it.',
          'Two guys carry a mattress down the block, arguing about whose idea this was.',
        ]), 'info');
      }
    }
  }

  /**
   * The kid on the bike, built like the rest of the cast instead of like a placeholder.
   *
   * The prop used to be a bar, two boxes for wheels and a head floating between them, which read
   * as a bug whenever it went past Mo. This one is a bicycle: a frame with an actual triangle in
   * it, spoked wheels, fork, handlebars with grips, a saddle on a post, a chainring and pedals —
   * and a child sitting on it who pedals in time with the crank, leans into the bars and looks
   * where he is going. Same event, same spawn side, same speed, same cleanup.
   */
  startBike() {
    if (this.bike) return;
    const root = new THREE.Group();
    const m = {
      frame: retroMaterial('bike_frame', { color: 0xc8121a }),
      frameDark: retroMaterial('bike_frame2', { color: 0x7a0a12 }),
      tyre: retroMaterial('bike_tyre', { color: 0x141414 }),
      rim: retroMaterial('bike_rim', { color: 0xb8bcc0, ambient: 0.95 }),
      metal: retroMaterial('bike_metal', { color: 0x9aa0a6, ambient: 0.95 }),
      seat: retroMaterial('bike_seat', { color: 0x1a1a1e }),
      shirt: retroMaterial('bike_shirt', { color: 0xe0c84a }),
      shorts: retroMaterial('bike_shorts', { color: 0x2a4a8a }),
      skin: retroMaterial('bike_skin', { color: 0x8a5a3a, ambient: 0.85 }),
      cap: retroMaterial('bike_cap', { color: 0xc8322a }),
      shoe: retroMaterial('bike_shoe', { color: 0xe8e6da }),
      sock: retroMaterial('bike_sock', { color: 0xf0eee4 }),
    };

    // a tube between two points in the bike's own side plane (x,y), sticking out in z
    const tube = (x1, y1, x2, y2, w, mat, z = 0) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const part = box(Math.hypot(dx, dy), w, w, mat, [(x1 + x2) / 2, (y1 + y2) / 2, z]);
      part.rotation.z = Math.atan2(dy, dx);
      root.add(part);
      return part;
    };

    // wheels: a chunky tyre, a thin rim, four spokes and a hub, all in the side plane so they
    // roll the way the bike is pointing
    const wheel = (x) => {
      const w = new THREE.Group();
      w.position.set(x, 0.34, 0);
      w.add(new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.033, 4, 14), m.tyre));
      w.add(new THREE.Mesh(new THREE.TorusGeometry(0.265, 0.011, 3, 14), m.rim));
      for (let i = 0; i < 4; i++) {
        const spoke = box(0.53, 0.011, 0.011, m.rim, [0, 0, 0]);
        spoke.rotation.z = (i * Math.PI) / 4;
        w.add(spoke);
      }
      w.add(box(0.055, 0.055, 0.05, m.metal, [0, 0, 0]));
      root.add(w);
      return w;
    };
    const rear = wheel(-0.42);
    const front = wheel(0.42);

    // the frame: seat tube, down tube, top tube, chainstay, seatstay and a raked fork
    tube(-0.06, 0.36, -0.16, 0.74, 0.045, m.frame);       // seat tube
    tube(-0.06, 0.36, 0.30, 0.78, 0.05, m.frame);         // down tube
    tube(-0.16, 0.74, 0.30, 0.78, 0.042, m.frame);        // top tube
    tube(-0.06, 0.36, -0.42, 0.34, 0.032, m.frameDark);   // chainstay
    tube(-0.16, 0.74, -0.42, 0.34, 0.03, m.frameDark);    // seatstay
    tube(0.30, 0.78, 0.42, 0.34, 0.034, m.metal);         // fork
    tube(0.30, 0.78, 0.34, 1.00, 0.042, m.metal);         // head tube to the bars

    // bars, grips, saddle on a post, and a bell he rings at nobody
    root.add(box(0.05, 0.05, 0.42, m.metal, [0.34, 1.00, 0]));
    for (const z of [-0.19, 0.19]) root.add(box(0.06, 0.06, 0.11, m.seat, [0.34, 1.00, z]));
    root.add(box(0.05, 0.05, 0.18, m.metal, [0.30, 0.985, 0.06]));
    root.add(box(0.05, 0.02, 0.05, m.cap, [0.27, 0.995, -0.02]));
    tube(-0.16, 0.74, -0.16, 0.80, 0.034, m.metal);        // seat post
    root.add(box(0.24, 0.045, 0.13, m.seat, [-0.19, 0.815, 0]));

    // crank and pedals, which is what makes the child a rider rather than a passenger
    const crank = new THREE.Group();
    crank.position.set(-0.06, 0.36, 0);
    crank.add(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 3, 10), m.metal));
    crank.add(box(0.30, 0.026, 0.026, m.metal, [0, 0, 0]));
    for (const z of [-0.09, 0.09]) crank.add(box(0.06, 0.022, 0.10, m.seat, [0.15, 0, z]));
    root.add(crank);

    // ---- the child: the same body, head and face as everybody else on the block, child-sized,
    // sat on the saddle with his hands on the grips and his feet on the pedals
    const kid = createNPC('kid');
    kid.root.children[0].visible = false;               // his shadow is the bike's
    kid.root.position.set(-0.19, 0.2, 0);
    kid.root.rotation.y = Math.PI / 2;                  // the rig faces +z, the bike rides +x
    root.add(kid.root);
    // a cap: the crown is the beanie hair style in red, this is the brim
    kid.head.add(box(0.15, 0.018, 0.12, m.cap, [0, 0.235 * kid.k, 0.12 * kid.k]));
    kid.torso.rotation.x = 0.36;                        // leaning into the bars
    kid.head.rotation.x = -0.3;                         // eyes up the road
    for (const arm of [kid.armL, kid.armR]) {
      arm.pivot.rotation.x = -1.05;
      arm.pivot.rotation.z = arm === kid.armL ? 0.18 : -0.18;
      arm.elbow.rotation.x = -0.25;
    }
    const legs = [kid.legL, kid.legR];
    const torso = kid.torso;
    const head = kid.head;

    const dir = Math.random() < 0.5 ? 1 : -1;
    root.position.set(dir > 0 ? -28 : 34, 0, -1.6);
    root.rotation.y = dir > 0 ? 0 : Math.PI;
    this.world.root.add(root);
    this.bike = { root, dir, wheels: [front, rear], crank, legs, torso, head, t: 0 };
  }

  updateBike(dt) {
    const b = this.bike;
    if (!b) return;
    b.t += dt;
    const speed = 6.5;
    b.root.position.x += b.dir * speed * dt;
    // the pedals turn the wheels: the wheels roll at the bike's speed, the crank at its gear
    const roll = (speed / 0.31) * dt * b.dir;
    for (const w of b.wheels) w.rotation.z -= roll;
    b.crank.rotation.z -= roll * 0.42;
    const a = b.crank.rotation.z;
    // knees follow the pedals, one leg out of phase with the other
    b.legs.forEach((leg, i) => {
      const p = a + i * Math.PI;
      leg.pivot.rotation.x = -1.0 + Math.sin(p) * 0.34;
      leg.knee.rotation.x = 1.25 + Math.cos(p) * 0.42;
      leg.ankle.rotation.x = -0.25;
    });
    // weight shifting over the pedals, and a look at whatever he is passing
    b.torso.rotation.x = 0.36 + Math.sin(a * 2) * 0.022;
    b.head.rotation.y = Math.sin(b.t * 0.8) * 0.14;
    b.root.position.y = Math.abs(Math.sin(a)) * 0.012;
    if (Math.abs(b.root.position.x) > 36) {
      b.root.parent?.remove(b.root);
      b.root.traverse((o) => o.geometry?.dispose?.());
      this.bike = null;
    }
  }
}
