/**
 * Kestrel Houses, up close.
 *
 *   buildCourt     the half-court in the courtyard: chain-link on four sides with a real gate,
 *                  a hoop with a backboard, a rim and a net, and four regulars running a game
 *   buildTower     inside the towers: a lobby and five floors of hallway, stairs only (the
 *                  elevator has been "out" since spring), neighbours, and the women on three
 *                  of the floors who will let Mo in for a price
 *   buildHerRoom   her apartment, after: she is on the bed with a cigarette, the money goes on
 *                  the dresser
 *
 * Nothing in the rooms is shown. The screen goes dark, the hour passes, and he is standing at the
 * foot of the bed. There is a chance of the clap, and no one to blame for it: these women are not
 * on any app, and there is nobody to text.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box, plane } from '../render/retro.js';
import { tex } from '../render/textures.js';
import { signTex } from '../render/signs.js';
import { CONFIG } from '../core/config.js';
import { money, pick, minuteOfDay, dayOf } from '../core/util.js';
import { bump, logLine } from '../core/state.js';
import { createNPC, animateNPC } from './characters.js';
import * as health from '../systems/health.js';

const solid = (x, z, w, d, h = 2.4) => ({ x, z, w, d, h });

/** The retro shader samples raw UVs, so a texture tiles by stretching the plane's UVs. */
function tiled(mesh, rx, ry) {
  const uv = mesh.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rx, uv.getY(i) * ry);
  uv.needsUpdate = true;
  return mesh;
}

/* ===================================================================== the court */

/** The court sits in the courtyard's east end; the hoop is at the east end of the court. */
export const COURT = { x0: 10.6, x1: 17.4, z0: -1.0, z1: 6.0, gateZ: 2.5, gateW: 1.5 };

/**
 * Build the court into `group` and push its fence into `solids`. Returns the game, whose
 * `update(dt)` the area's tick calls every frame.
 */
export function buildCourt(group, solids) {
  const C = COURT;
  const cx = (C.x0 + C.x1) / 2;
  const cz = (C.z0 + C.z1) / 2;
  const W = C.x1 - C.x0;
  const D = C.z1 - C.z0;
  group.add(plane(W, D, { name: 'pj_court', map: tex('court'), color: 0xd8d8d8 }, [cx, 0.012, cz], [-Math.PI / 2, 0, 0]));

  // the fence: steel posts, a top rail, chain-link you can see through, and a gate on the west
  // side that stands open (the latch broke years ago and nobody wants it fixed)
  const steel = retroMaterial('pj_post', { color: 0x7a7e84, ambient: 0.8 });
  const link = retroMaterial('pj_link', { map: tex('chainlink'), color: 0xc8ccd0, doubleSide: true, alphaTest: 0.5, ambient: 0.9 });
  const H = 2.6;
  const run = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.05) return;
    const ang = -Math.atan2(z1 - z0, x1 - x0);
    const g = new THREE.Group();
    g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    g.rotation.y = ang;
    g.add(tiled(plane(len, H, link, [0, H / 2, 0]), len * 3, H * 3));
    g.add(box(len, 0.05, 0.05, steel, [0, H, 0]));
    g.add(box(len, 0.04, 0.04, steel, [0, 0.08, 0]));
    const n = Math.max(1, Math.round(len / 2.2));
    for (let i = 0; i <= n; i++) g.add(box(0.07, H + 0.08, 0.07, steel, [-len / 2 + (i * len) / n, (H + 0.08) / 2, 0]));
    group.add(g);
    // a thin wall the same length: you walk round a fence, not through it
    const horiz = Math.abs(z1 - z0) < 0.01;
    // see-through: it stops Mo, not the camera
    solids.push({ ...(horiz ? solid((x0 + x1) / 2, z0, len, 0.16, H) : solid(x0, (z0 + z1) / 2, 0.16, len, H)), seeThrough: true });
  };
  const g0 = C.gateZ - C.gateW / 2;
  const g1 = C.gateZ + C.gateW / 2;
  run(C.x0, C.z0, C.x1, C.z0);
  run(C.x0, C.z1, C.x1, C.z1);
  run(C.x1, C.z0, C.x1, C.z1);
  run(C.x0, C.z0, C.x0, g0);
  run(C.x0, g1, C.x0, C.z1);
  // the gate: two heavier posts and a leaf swung open outward against the fence
  for (const z of [g0, g1]) group.add(box(0.11, H + 0.3, 0.11, steel, [C.x0, (H + 0.3) / 2, z]));
  const leaf = new THREE.Group();
  leaf.position.set(C.x0, 0, g1);
  leaf.rotation.y = 0.55 * Math.PI;
  leaf.add(tiled(plane(C.gateW - 0.1, H - 0.4, link, [-(C.gateW - 0.1) / 2, (H - 0.4) / 2 + 0.1, 0]), (C.gateW - 0.1) * 3, (H - 0.4) * 3));
  for (const y of [0.12, H - 0.3]) leaf.add(box(C.gateW - 0.1, 0.05, 0.05, steel, [-(C.gateW - 0.1) / 2, y, 0]));
  leaf.add(box(0.05, H - 0.4, 0.05, steel, [-(C.gateW - 0.1), (H - 0.4) / 2 + 0.1, 0]));
  group.add(leaf);
  group.add(plane(1.3, 0.34, { name: 'pj_courtsign', map: signTex('pjCourt', [{ text: 'NO DUNKING ON THE RIM', color: '#1a1a1a', size: 7 }], { w: 96, h: 20, bg: '#e8e2d0', border: '#1a1a1a' }), emissive: 0.3 }, [C.x0 - 0.03, 1.9, g0 - 0.9], [0, -Math.PI / 2, 0]));

  // the hoop: a pole outside the baseline, an arm, a backboard with its square, an orange rim,
  // a net of white cord
  const rimX = C.x1 - 1.0;
  const rimZ = cz;
  const rimY = 3.05;
  group.add(box(0.16, 3.5, 0.16, steel, [C.x1 + 0.35, 1.75, rimZ]));
  group.add(box(0.9, 0.1, 0.1, steel, [C.x1 - 0.05, 3.3, rimZ]));
  group.add(box(0.05, 1.05, 1.6, retroMaterial('pj_board', { color: 0xf2f0ea, ambient: 0.9 }), [C.x1 - 0.45, 3.35, rimZ]));
  const red = retroMaterial('pj_boardline', { color: 0xc8281e, unlit: true });
  for (const [w, d, y, z] of [[0.02, 0.5, 3.2, 0], [0.02, 0.5, 3.52, 0], [0.02, 0.04, 3.36, -0.25], [0.02, 0.04, 3.36, 0.25]]) group.add(box(w, d === 0.04 ? 0.36 : 0.04, d === 0.04 ? 0.04 : d, red, [C.x1 - 0.48, y, rimZ + z]));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.02, 4, 16), retroMaterial('pj_rim', { color: 0xe8642a, ambient: 1 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(rimX, rimY, rimZ);
  group.add(rim);
  group.add(box(0.25, 0.03, 0.06, steel, [rimX + 0.24, rimY, rimZ]));
  const net = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.13, 0.42, 10, 3, true), retroMaterial('pj_net', { color: 0xf2f2ee, opacity: 0.55, transparent: true, doubleSide: true }));
  net.position.set(rimX, rimY - 0.21, rimZ);
  group.add(net);
  solids.push(solid(C.x1 + 0.35, rimZ, 0.3, 0.3, 3.5));

  return new Hoops(group, { ...C, rimX, rimY, rimZ, cx, cz });
}

/**
 * Four regulars running two-on-two at one basket. The ball goes from hand to floor and back
 * while the man with it looks for a pass or a shot; his man stays between him and the rim;
 * shots go up in an arc and sometimes go in; whoever comes down with the rebound checks it back
 * out past the top of the key and the other side defends.
 */
class Hoops {
  constructor(group, C) {
    this.C = C;
    this.players = ['baller1', 'baller2', 'baller3', 'baller4'].map((kind, i) => {
      const rig = createNPC(kind);
      rig.root.position.set(C.x0 + 1.5 + i * 1.2, 0, C.cz + (i % 2 ? 1.2 : -1.2));
      group.add(rig.root);
      return { rig, team: i % 2, tx: rig.root.position.x, tz: rig.root.position.z, moving: false };
    });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), retroMaterial('pj_ball', { color: 0xd8642a, ambient: 0.9 }));
    group.add(this.ball);
    this.offense = 0;
    this.holder = this.players[0];
    this.state = 'check';    // check (bring it out), play (dribble and look), flight (pass or shot), loose
    this.timer = 2;
    this.t = 0;
    this.flight = null;
    this.score = [0, 0];
  }

  rim() { return new THREE.Vector3(this.C.rimX, this.C.rimY, this.C.rimZ); }

  /** Where the offence stands: the wings, the corner, the top. */
  spots() {
    const { rimX, rimZ } = this.C;
    return [[rimX - 3.4, rimZ - 0.2], [rimX - 2.6, rimZ - 2.2], [rimX - 2.4, rimZ + 2.3], [rimX - 1.2, rimZ - 2.9], [rimX - 1.4, rimZ + 2.9]];
  }

  update(dt) {
    this.t += dt;
    const C = this.C;
    const off = this.players.filter((p) => p.team === this.offense);
    const def = this.players.filter((p) => p.team !== this.offense);
    // targets: the holder works his spot, his teammate the other wing, defenders shadow their man
    if (this.state === 'check') {
      if (this.holder) { this.holder.tx = C.rimX - 4.3; this.holder.tz = C.rimZ; }
      const mate = off.find((p) => p !== this.holder);
      if (mate) { mate.tx = C.rimX - 2.4; mate.tz = C.rimZ + 2.2; }
    } else if (this.state === 'play') {
      this.timer -= dt;
      if (this.holder && this.timer <= 0) this.decide(off);
    }
    def.forEach((d, i) => {
      const man = off[i] || off[0];
      const mx = man.rig.root.position.x;
      const mz = man.rig.root.position.z;
      d.tx = mx + (C.rimX - mx) * 0.28;
      d.tz = mz + (C.rimZ - mz) * 0.28;
    });
    if (this.state === 'loose' && this.loose) {
      // everybody goes for the ball where it bounced
      for (const p of this.players) { p.tx = this.loose.x + (p.team ? 0.3 : -0.3); p.tz = this.loose.z; }
    }

    for (const p of this.players) this.move(p, dt);

    // the ball
    if (this.state === 'flight' && this.flight) this.updateFlight(dt);
    else if (this.state === 'loose' && this.loose) this.updateLoose(dt);
    else if (this.holder) this.dribble(this.holder);

    if (this.state === 'check' && this.holder) {
      const hp = this.holder.rig.root.position;
      if (Math.hypot(hp.x - (C.rimX - 4.3), hp.z - C.rimZ) < 0.35) { this.state = 'play'; this.timer = 1.5 + Math.random() * 2; }
    }
  }

  move(p, dt) {
    const r = p.rig.root;
    const dx = p.tx - r.position.x;
    const dz = p.tz - r.position.z;
    const d = Math.hypot(dx, dz);
    const C = this.C;
    p.moving = d > 0.25;
    if (p.moving) {
      const sp = (this.state === 'loose' ? 3.2 : p === this.holder ? 1.6 : 2.4) * dt;
      r.position.x += (dx / d) * Math.min(d, sp);
      r.position.z += (dz / d) * Math.min(d, sp);
      r.position.x = Math.max(C.x0 + 0.35, Math.min(C.x1 - 0.35, r.position.x));
      r.position.z = Math.max(C.z0 + 0.35, Math.min(C.z1 - 0.35, r.position.z));
      r.rotation.y = Math.atan2(dx, dz);
    } else {
      // squared up: the holder to the rim, a defender to the ball
      const look = p === this.holder || p.team === this.offense ? new THREE.Vector3(C.rimX, 0, C.rimZ) : this.ball.position;
      r.rotation.y += (Math.atan2(look.x - r.position.x, look.z - r.position.z) - r.rotation.y) * Math.min(1, dt * 5);
    }
    animateNPC(p.rig, dt * (p.moving ? 1.25 : 1), { walking: p.moving });
    // arms: defenders up and wide, the holder's right hand working the ball
    if (p.team !== this.offense && this.state !== 'loose') {
      p.rig.armL.pivot.rotation.set(-0.5, 0, 1.0);
      p.rig.armR.pivot.rotation.set(-0.5, 0, -1.0);
      p.rig.hips.position.y = p.rig.hipY - 0.06;
    }
    if (p === this.holder && this.state !== 'flight') {
      p.rig.armR.pivot.rotation.set(-0.55, 0, -0.15);
      p.rig.armR.elbow.rotation.set(-0.5 - Math.abs(Math.sin(this.t * 8)) * 0.4, 0, 0);
    }
    if (p.shootT > 0) {
      p.shootT -= dt;
      p.rig.armL.pivot.rotation.set(-2.7, 0, 0.2);
      p.rig.armR.pivot.rotation.set(-2.8, 0, -0.2);
      p.rig.armL.elbow.rotation.set(-0.2, 0, 0);
      p.rig.armR.elbow.rotation.set(-0.2, 0, 0);
    }
  }

  dribble(p) {
    const r = p.rig.root;
    const fx = Math.sin(r.rotation.y);
    const fz = Math.cos(r.rotation.y);
    const bounce = Math.abs(Math.sin(this.t * 8));
    this.ball.position.set(r.position.x + fx * 0.32 - fz * 0.22, 0.12 + bounce * 0.78, r.position.z + fz * 0.32 + fx * 0.22);
  }

  decide(off) {
    const r = Math.random();
    const mate = off.find((p) => p !== this.holder);
    const hp = this.holder.rig.root.position;
    const dist = Math.hypot(hp.x - this.C.rimX, hp.z - this.C.rimZ);
    if (r < 0.35 && mate) this.pass(mate);
    else if (r < 0.55 || dist > 4.5) {
      // put it on the floor: a drive to a new spot
      const [sx, sz] = pick(this.spots());
      this.holder.tx = sx; this.holder.tz = sz;
      this.timer = 1.4 + Math.random() * 1.6;
    } else this.shoot();
    if (mate && this.state === 'play') {
      const [sx, sz] = pick(this.spots());
      mate.tx = sx; mate.tz = sz;
    }
  }

  pass(to) {
    const from = this.ball.position.clone();
    const tp = to.rig.root.position;
    this.flight = { kind: 'pass', from, to: new THREE.Vector3(tp.x, 1.0, tp.z), t: 0, dur: 0.45, target: to, peak: 0.4 };
    this.holder = null;
    this.state = 'flight';
  }

  shoot() {
    const shooter = this.holder;
    shooter.shootT = 0.6;
    const from = new THREE.Vector3(shooter.rig.root.position.x, 2.2, shooter.rig.root.position.z);
    const make = Math.random() < 0.45;
    const rim = this.rim();
    this.flight = { kind: 'shot', from, to: make ? rim.clone().setY(rim.y + 0.02) : rim.clone().add(new THREE.Vector3(-0.1, 0.05, (Math.random() - 0.5) * 0.3)), t: 0, dur: 1.0, make, peak: 1.5, team: shooter.team };
    this.holder = null;
    this.state = 'flight';
  }

  updateFlight(dt) {
    const f = this.flight;
    f.t += dt;
    const u = Math.min(1, f.t / f.dur);
    this.ball.position.lerpVectors(f.from, f.to, u);
    this.ball.position.y += Math.sin(u * Math.PI) * f.peak;
    if (u < 1) return;
    if (f.kind === 'pass') {
      this.holder = f.target;
      this.state = 'play';
      this.timer = 1 + Math.random() * 1.5;
    } else {
      if (f.make) this.score[f.team] += 1;
      // through the net and down, or off the iron and away
      const off = f.make ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(-1.2 - Math.random(), 0, (Math.random() - 0.5) * 3);
      this.loose = { x: this.C.rimX + off.x, z: this.C.rimZ + off.z, y: this.ball.position.y, vy: f.make ? -1 : 2.2, t: 0 };
      this.state = 'loose';
    }
    this.flight = null;
  }

  updateLoose(dt) {
    const l = this.loose;
    l.t += dt;
    l.vy -= 9.8 * dt;
    l.y += l.vy * dt;
    if (l.y < 0.12) { l.y = 0.12; l.vy = Math.abs(l.vy) * 0.55; }
    const b = this.ball.position;
    b.x += (l.x - b.x) * Math.min(1, dt * 3);
    b.z += (l.z - b.z) * Math.min(1, dt * 3);
    b.y = l.y;
    // first one there has it
    let best = null;
    let bd = 0.55;
    for (const p of this.players) {
      const d = Math.hypot(p.rig.root.position.x - b.x, p.rig.root.position.z - b.z);
      if (d < bd && l.t > 0.5) { best = p; bd = d; }
    }
    if (best) {
      this.holder = best;
      this.offense = best.team;
      this.state = 'check';
      this.loose = null;
    }
  }
}

/* ===================================================================== the towers */

/** The women upstairs. Three of them, three floors, two towers. Adults, all of them. */
export const WOMEN = {
  crystal: { kind: 'wg1', name: 'Crystal', tower: 'north', floor: 2, door: '3F', cheeks: 60, gerba: 30,
    line: '"You lost, or you shopping?" She looks you over the way a landlord looks at a deposit.' },
  desiree: { kind: 'wg2', name: 'Desiree', tower: 'north', floor: 4, door: '5B', cheeks: 80, gerba: 45,
    line: '"I know you. Well. I know the type, which is quicker." She blows smoke at the ceiling and waits.' },
  bunny: { kind: 'wg3', name: 'Bunny', tower: 'east', floor: 3, door: '4D', cheeks: 45, gerba: 25,
    line: '"Cash, baby. Not a promise, not a card, not a story about your cousin. Cash."' },
};

const FLOORS = ['Lobby', '2nd Floor', '3rd Floor', '4th Floor', '5th Floor', '6th Floor'];

export function housesState(s) {
  if (!s.houses) s.houses = { tower: 'north', floor: 0, knocked: {}, visits: {} };
  s.houses.knocked = s.houses.knocked || {};
  s.houses.visits = s.houses.visits || {};
  return s.houses;
}

const TOWER_KNOCKS = [
  'A chain, a crack, one eye. The door shuts again without a word.',
  'A woman in a bonnet says her grandson is not here, has never been here, and you should not be here either.',
  'Somebody yells "WHO" from very far inside the apartment. You decide not to answer that.',
  'The door opens on a TV turned up all the way and a man asleep in front of it. You close it for him.',
  'An old man in a cardigan gives you a peppermint and asks if you are with the housing authority. He looks relieved when you say no.',
  'Nobody answers. Through the door, a radio is playing gospel to an empty room.',
];

const HALL_LINES = [
  'The fluorescent tube over the stairs has been dying for a year. It is in no hurry.',
  'Somebody has written a phone number on the wall and, under it, "DO NOT CALL".',
  'Through a door: a baby, a game show, and a grandmother winning an argument.',
  'A smell of weed and fried plantain, which is a good smell, actually.',
  'Footsteps on the stairs above you, fast, then a door, then nothing.',
];

function stairs(g, dir) {
  const h = housesState(g.state);
  const next = Math.max(0, Math.min(FLOORS.length - 1, h.floor + dir));
  if (next === h.floor) return;
  const slow = g.state.stats.withdrawal > 55 || g.state.stats.energy < 20 ? 2 : 1;
  g.advance(dir > 0 ? 2 * slow : 1);
  if (dir > 0) bump(g.state, 'energy', -1 * slow);
  h.floor = next;
  g.world?.loadArea('pjtower', g, dir > 0 ? 'up' : 'down');
  g.hud?.setPrompt?.(null);
}

function knock(g, label) {
  const h = housesState(g.state);
  const day = dayOf(g.state.clock.m);
  const key = `${h.tower}${label}`;
  if (h.knocked[key] === day) { g.toast(`Nobody comes to ${label} again. Once a day is plenty.`, 'info'); return; }
  h.knocked[key] = day;
  g.advance(2);
  g.toast(TOWER_KNOCKS[(day * 7 + label.charCodeAt(0) + label.charCodeAt(1)) % TOWER_KNOCKS.length], 'info');
}

const awake = (m) => m >= 17 * 60 || m < 5 * 60;

/** Her door, or her in the hallway: the offer, the price, and the way out of it. */
export function womanMenu(g, id) {
  const w = WOMEN[id];
  const s = g.state;
  const m = minuteOfDay(s.clock.m);
  const h = housesState(s);
  const kicker = `KESTREL HOUSES · ${FLOORS[w.floor].toUpperCase()} · ${w.door}`;
  if (!awake(m)) {
    g.openModal({ kicker, title: w.name, body: '"It is daytime, baby. I am asleep, I am at my mother\'s, or I am at the clinic. Come back when the lights are on."', choices: [{ label: 'Nod and leave.', effect: () => {} }] });
    return;
  }
  if (h.visits[id] === dayOf(s.clock.m)) {
    g.openModal({ kicker, title: w.name, body: '"Once a night, sweetheart. I have a schedule too."', choices: [{ label: 'Nod and leave.', effect: () => {} }] });
    return;
  }
  const offer = (label, word, price, minutes, fx) => ({
    label: `"${word}" · ${money(price)}`, sub: label,
    disabled: s.money < price,
    effect: () => afterDark(g, id, price, minutes, fx),
  });
  g.openModal({
    kicker, title: w.name,
    body: `${w.line}\n\nShe says the prices like a menu she wrote herself.`,
    choices: [
      offer('an hour · the whole thing', 'Cheeks', w.cheeks, 60, { stress: -22, morale: 8, energy: -10, hygiene: -14 }),
      offer('half an hour · quick', 'Gerba', w.gerba, 30, { stress: -14, morale: 4, energy: -4, hygiene: -6 }),
      { label: 'Just talk for a minute.', sub: 'free · she charges for everything else', effect: () => { g.advance(10); bump(s, 'morale', 2); g.toast(pick([`${w.name} tells you which of her neighbours is a cop. Two of them are. One is her cousin.`, `${w.name} asks you for a lighter and keeps it.`, `${w.name} says you have kind eyes, then says that is not a compliment around here.`]), 'info'); } },
      { label: 'Not tonight.', sub: '', effect: () => {} },
    ],
  });
}

/** The fade, the hour, and her room. Nothing on screen; everything on the clock. */
function afterDark(g, id, price, minutes, fx) {
  const s = g.state;
  const w = WOMEN[id];
  const h = housesState(s);
  h.visits[id] = dayOf(s.clock.m);
  h.room = { id, price };
  g.fadeOut(() => {
    g.advance(minutes);
    for (const [k, v] of Object.entries(fx)) bump(s, k, v);
    bump(s, 'risk', 3);
    // the clap, sometimes, and nobody to text about it: she is not on any app and never will be
    if (Math.random() < CONFIG.health.clapChance * 1.3 && health.infect(g, `houses_${id}`)) {
      const c = health.healthState(s).clap;
      c.accused = true;
      c.posted = true;
    }
    logLine(g, `${money(price)} on the dresser in ${w.door}.`, 'info');
    g.goTo('pjroom', 'pjtower');
    g.fadeIn();
  }, 600);
}

const LEAVE_LINES = [
  'Leave the money on the dresser. Come again soon.',
  'Money on the dresser, baby. Shut the door behind you, the hallway is nosy.',
  'Dresser. All of it. And do not tell your friends, tell your friends\' wallets.',
];

export function herRoomMenu(g) {
  const s = g.state;
  const h = housesState(s);
  const r = h.room;
  if (!r) return;
  const w = WOMEN[r.id];
  g.openModal({
    kicker: `KESTREL HOUSES · ${w.door}`,
    title: w.name,
    body: `She is on the bed with a cigarette, looking at the ceiling like it owes her money.\n\n"${pick(LEAVE_LINES)}"`,
    choices: [{
      label: `Leave ${money(r.price)} on the dresser.`, sub: '',
      effect: () => {
        g.spendMoney(Math.min(r.price, s.money), `${w.name}, ${w.door}`);
        h.room = null;
        g.goTo('pjtower', 'room');
      },
    }],
  });
}

/** One tower, one floor at a time, like 1104 but harder: cinderblock, buzzing tubes, stairs only. */
export function buildTower(g) {
  const s = g.state;
  const h = housesState(s);
  const f = h.floor;
  const towerName = h.tower === 'east' ? 'East Tower' : 'North Tower';
  const group = new THREE.Group();
  const W = 3.6, D = 15;
  const tint = [0xb8b8a0, 0x9ab0a0, 0xa8a8b8, 0x9ab0a0, 0xb0a890, 0xa0a8b0][f];
  group.add(plane(W, D, { name: `pt_floor${f}`, map: tex('linoleum'), color: 0xa8a8a0, repeat: [2, 8] }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(plane(W, D, { name: 'pt_ceil', map: tex('ceiling'), repeat: [2, 7] }, [0, 2.7, 0], [Math.PI / 2, 0, 0]));
  const wallMat = retroMaterial(`pt_wall${f}`, { map: tex('wall'), color: tint });
  group.add(box(0.16, 2.7, D, wallMat, [-W / 2, 1.35, 0]));
  group.add(box(0.16, 2.7, D, wallMat, [W / 2, 1.35, 0]));
  group.add(box(W, 2.7, 0.16, wallMat, [0, 1.35, D / 2]));
  group.add(box(W, 2.7, 0.16, wallMat, [0, 1.35, -D / 2]));
  // the bottom half of the walls painted the colour the authority buys by the tanker
  for (const sx of [-1, 1]) group.add(box(0.03, 1.1, D, retroMaterial('pt_dado', { color: 0x4a6a5a }), [sx * (W / 2 - 0.09), 0.55, 0]));
  for (const z of [5, 1, -3]) group.add(box(1.0, 0.05, 0.16, z === 1 && f % 2 ? M_DIM() : M_TUBE(), [0, 2.66, z]));
  // tags on the walls
  for (const [x, z, t, c] of [[-W / 2 + 0.1, 3.2, 'KH4L', '#e8462a'], [W / 2 - 0.1, -1.8, `${pick(['DRE', 'NEESY', 'TOMB', 'K-LO'])} ${f + 1}`, '#3a8aff']]) {
    group.add(plane(1.2, 0.5, { name: `pt_tag${f}${x}`, map: signTex(`ptTag${f}${t}`, [{ text: t, color: c, size: 11 }], { w: 64, h: 24, bg: '#00000000', border: null }), alphaTest: 0.4 }, [x, 1.6, z], [0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]));
  }

  // stairs at the north end, east side up, west side down, and the elevator nobody uses
  const stairX = 0.85;
  if (f < FLOORS.length - 1) for (let i = 0; i < 8; i++) group.add(box(1.5, 0.18 + i * 0.18, 0.3, retroMaterial('pt_step', { map: tex('concrete') }), [stairX, (0.18 + i * 0.18) / 2, -4.6 - i * 0.28]));
  if (f > 0) group.add(plane(1.1, 1.6, { name: 'pt_well', color: 0x0a0a0c }, [-1.05, 0.006, -4.4], [-Math.PI / 2, 0, 0]));
  group.add(box(1.0, 2.2, 0.1, retroMaterial('pt_elev', { color: 0x6a6e72 }), [-0.95, 1.1, -D / 2 + 0.12]));
  group.add(plane(0.9, 0.3, { name: 'pt_ooo', map: signTex('ptOOO', [{ text: 'OUT OF ORDER', color: '#c8281e', size: 9 }], { w: 64, h: 18, bg: '#f2f0e8', border: '#c8281e' }), emissive: 0.3 }, [-0.95, 1.5, -D / 2 + 0.18]));
  group.add(plane(1.0, 0.4, { name: `pt_floornum${f}`, map: signTex(`ptFloor${f}`, [{ text: f === 0 ? 'LOBBY' : `FLOOR ${f + 1}`, color: '#f2f2e8', size: 10 }], { w: 64, h: 24, bg: '#2a3a32', border: '#8a9a8a' }), emissive: 0.6, unlit: true }, [-W / 2 + 0.1, 1.9, -3.2], [0, Math.PI / 2, 0]));

  const interactables = [];
  const npcs = [];
  const solids = [solid(-0.95, -D / 2 + 0.3, 1.1, 0.4)];
  if (f < FLOORS.length - 1) solids.push(solid(stairX, -5.7, 1.6, 2.6));
  if (f > 0) solids.push(solid(-1.05, -4.6, 1.1, 1.2, 0.9));
  const door = (side, z, label, action, sub = '') => {
    const x = side * (W / 2 - 0.07);
    group.add(box(0.1, 2.2, 1.0, retroMaterial('pt_door', { color: 0x5a3a2a }), [x, 1.1, z]));
    group.add(plane(0.3, 0.16, { name: `pt_num${label}`, map: signTex(`ptNum${label}`, [{ text: label, color: '#e8e8e0', size: 9 }], { w: 32, h: 16, bg: '#2a2a2a', border: '#8a8a8a' }), emissive: 0.4, unlit: true }, [x - side * 0.07, 1.85, z], [0, -side * Math.PI / 2, 0]));
    interactables.push({ id: `pt_door_${label}`, label: `Knock on ${label}`, sub, x: side * (W / 2 - 0.55), z, radius: 1.0, action });
  };
  const fl = f + 1;
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const doorSpots = [[-1, 4.2], [1, 4.2], [-1, 1.4], [1, 1.4], [-1, -1.4], [1, -1.4]];
  const here = Object.entries(WOMEN).filter(([, w]) => w.tower === h.tower && w.floor === f);
  const m = minuteOfDay(s.clock.m);

  if (f === 0) {
    group.add(box(1.4, 2.3, 0.12, retroMaterial('pt_front', { color: 0x3a3a3e }), [0, 1.15, D / 2 - 0.1]));
    group.add(box(0.5, 0.6, 0.04, retroMaterial('pt_frontglass', { color: 0xc8b878, emissive: 0.5, unlit: true }), [0, 1.6, D / 2 - 0.17]));
    // the mailboxes, half of them pried open
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) group.add(box(0.06, 0.2, 0.26, retroMaterial(((r + c) % 4 === 0) ? 'pt_mailopen' : 'pt_mail', { color: ((r + c) % 4 === 0) ? 0x3a3a3a : 0x8a8e92 }), [-W / 2 + 0.1, 1.0 + r * 0.24, 1.6 + c * 0.28]));
    interactables.push({ id: 'pt_exit', label: 'Out to the courtyard', sub: '', x: 0, z: D / 2 - 0.9, radius: 1.0, action: (gg) => gg.goTo('projects', 'pjtower') });
    npcs.push({ kind: 'tenant_f', x: 1.2, z: 5.6, y: 0, rot: -Math.PI / 2, still: true, pose: 'sit' });
    group.add(box(0.5, 0.45, 0.5, retroMaterial('pt_lawnchair', { color: 0x3a8a6a }), [1.2, 0.22, 5.6]));
    npcs.push({ kind: 'thug', x: -0.6, z: -1.0, rot: 0.4, still: true, act: 'lean' });
    npcs.push({ kind: 'drifter', x: 0.4, z: 2.4, rot: Math.PI, still: true, act: 'dice' });
    npcs.push({ kind: 'junkie', x: -0.8, z: 2.6, rot: 0.6, still: true, act: 'watch' });
    door(1, -1.4, '1A', (gg) => knock(gg, '1A'));
  } else {
    doorSpots.forEach(([side, z], i) => {
      const label = `${fl}${letters[i]}`;
      const woman = here.find(([, w]) => w.door === label);
      if (woman) door(side, z, label, (gg) => womanMenu(gg, woman[0]), awake(m) ? 'the light is on' : 'quiet');
      else door(side, z, label, (gg) => knock(gg, label));
    });
    // the women stand at their doors after dark, smoking
    for (const [id, w] of here) {
      if (!awake(m)) continue;
      const i = letters.indexOf(w.door.slice(-1));
      const [side, z] = doorSpots[i];
      const x = side * (W / 2 - 0.55);
      npcs.push({ kind: w.kind, x, z: z + 0.7, rot: side > 0 ? -Math.PI / 2 : Math.PI / 2, still: true, act: 'smoke', talk: `pt_woman_${id}` });
      interactables.push({ id: `pt_woman_${id}`, label: `Talk to ${w.name}`, sub: 'she is leaning on the door frame', x, z: z + 0.7, radius: 1.1, action: (gg) => womanMenu(gg, id) });
    }
    // somebody in the hall on most floors
    const extras = [
      { kind: 'hall_m', act: 'phone' }, { kind: 'squeak', act: 'smoke' }, { kind: 'tenant_m', act: 'lean' },
      { kind: 'hall_f', act: 'talk' }, { kind: 'junkie', pose: 'ground' },
    ];
    const pickN = (f * 3 + (h.tower === 'east' ? 1 : 0)) % extras.length;
    const e = extras[pickN];
    npcs.push({ kind: e.kind, x: f % 2 ? -0.7 : 0.7, z: f % 2 ? 2.8 : -0.2, rot: f % 2 ? 1.2 : -1.8, still: true, act: e.act, pose: e.pose });
  }
  if (f < FLOORS.length - 1) interactables.push({ id: 'pt_up', label: `Up to the ${FLOORS[f + 1]}`, sub: '2 min · the stairs · the elevator is a rumour', x: stairX - 0.2, z: -4.1, radius: 0.9, action: (gg) => stairs(gg, 1) });
  if (f > 0) interactables.push({ id: 'pt_down', label: `Stairs down to the ${FLOORS[f - 1]}`, sub: 'the west stairwell', x: -1.05, z: -3.5, radius: 1.0, action: (gg) => stairs(gg, -1) });
  interactables.push({ id: 'pt_elev', label: 'Press the elevator button', sub: 'out of order', x: -0.95, z: -D / 2 + 0.9, radius: 1.0, action: (gg) => gg.toast('The button lights up, thinks about it, and goes dark. Somewhere above you, a cable laughs.', 'info') });

  let timer = 8 + Math.random() * 6;
  const tick = (gg, dt) => {
    timer -= dt;
    if (timer > 0 || gg.uiBusy) return;
    timer = 18 + Math.random() * 12;
    gg.toast(pick(HALL_LINES), 'info');
  };

  return {
    group,
    bounds: { minX: -W / 2 + 0.25, maxX: W / 2 - 0.25, minZ: -D / 2 + 0.3, maxZ: D / 2 - 0.3 },
    solids,
    spawn: { x: 0, z: D / 2 - 1.6, rot: Math.PI },
    spawnFor: (from) => (from === 'up' ? { x: stairX - 0.2, z: -3.3, rot: 0 } : from === 'down' ? { x: -1.0, z: -2.7, rot: 0 }
      : from === 'room' ? { x: 0, z: 0, rot: Math.PI } : { x: 0, z: D / 2 - 1.6, rot: Math.PI }),
    npcs,
    interactables,
    tick,
    ambient: 'street',
    title: `Kestrel Houses · ${towerName} · ${FLOORS[f]}`,
    enterToast: f === 0 ? `The ${towerName} lobby. It smells like bleach losing an argument.` : null,
  };
}

let tube = null;
let dim = null;
function M_TUBE() { return tube || (tube = retroMaterial('pt_tube', { color: 0xf2f8ff, emissive: 1.1, unlit: true })); }
function M_DIM() { return dim || (dim = retroMaterial('pt_tubedim', { color: 0x8a9098, emissive: 0.3, unlit: true })); }

/** Her room: a bed, a dresser, a lamp with a scarf over it, the window, and her. */
export function buildHerRoom(g) {
  const s = g.state;
  const h = housesState(s);
  const w = WOMEN[h.room?.id] || WOMEN.crystal;
  const group = new THREE.Group();
  const W = 3.6, D = 5.2;
  group.add(plane(W, D, { name: 'hr_floor', map: tex('carpet'), color: 0x8a5a6a }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(plane(W, D, { name: 'hr_ceil', map: tex('ceiling') }, [0, 2.6, 0], [Math.PI / 2, 0, 0]));
  const wall = retroMaterial('hr_wall', { map: tex('wallpaper'), color: 0xa86a8a });
  group.add(box(0.14, 2.6, D, wall, [-W / 2, 1.3, 0]));
  group.add(box(0.14, 2.6, D, wall, [W / 2, 1.3, 0]));
  group.add(box(W, 2.6, 0.14, wall, [0, 1.3, -D / 2]));
  group.add(box(W, 2.6, 0.14, wall, [0, 1.3, D / 2]));
  // the bed against the back wall, sheets the colour of a bad decision
  group.add(box(1.6, 0.45, 2.0, retroMaterial('hr_bed', { color: 0x3a2a2a }), [0, 0.22, -1.5]));
  group.add(box(1.56, 0.12, 1.96, retroMaterial('hr_sheet', { color: 0xc83a6a }), [0, 0.5, -1.5]));
  group.add(box(1.5, 0.14, 0.4, retroMaterial('hr_pillow', { color: 0xf2e8e8 }), [0, 0.6, -2.3]));
  group.add(box(1.7, 1.0, 0.1, retroMaterial('hr_head', { color: 0x2a1a1a }), [0, 0.8, -2.52]));
  // the dresser, with a mirror and a lamp under a red scarf
  group.add(box(1.1, 0.85, 0.5, retroMaterial('hr_dresser', { map: tex('wood'), color: 0x6a4a3a }), [1.25, 0.42, 0.2], [0, -Math.PI / 2, 0]));
  group.add(box(0.04, 0.8, 0.7, retroMaterial('hr_mirror', { color: 0xb8c8d0, emissive: 0.2 }), [1.73, 1.4, 0.2]));
  group.add(box(0.3, 0.32, 0.3, retroMaterial('hr_lamp', { color: 0xff5a5a, emissive: 1.0, unlit: true }), [1.25, 1.02, 0.6]));
  group.add(plane(1.2, 1.1, { name: 'hr_window', map: tex('window'), emissive: 0.7, unlit: true }, [-W / 2 + 0.08, 1.5, -1.0], [0, Math.PI / 2, 0]));
  group.add(box(1.0, 2.1, 0.08, retroMaterial('hr_door', { color: 0x5a3a2a }), [-1.0, 1.05, D / 2 - 0.07]));

  // her on the bed, along it, smoking
  const npcs = [{ kind: w.kind, x: 0.05, z: -1.35, y: 0.45, rot: Math.PI, still: true, pose: 'sleep', talk: 'hr_her' }];
  const interactables = [
    { id: 'hr_her', label: w.name, sub: 'money on the dresser', x: 0, z: -0.2, radius: 1.3, action: (gg) => herRoomMenu(gg) },
    { id: 'hr_dresser', label: 'The dresser', sub: 'where the money goes', x: 0.75, z: 0.2, radius: 0.9, action: (gg) => herRoomMenu(gg) },
  ];
  // a cigarette between her fingers, smoke curling off it
  const ember = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.08), retroMaterial('hr_cig', { color: 0xf2f2ea }));
  ember.position.set(0.42, 0.72, -0.95);
  group.add(ember);
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), retroMaterial('hr_smoke', { color: 0xd8d8d8, opacity: 0.35, transparent: true, unlit: true }));
  group.add(puff);
  let t = 0;
  let asked = false;
  const tick = (gg, dt) => {
    t += dt;
    const u = (t * 0.4) % 1;
    puff.position.set(0.42 + Math.sin(t) * 0.05, 0.75 + u * 0.8, -0.95);
    puff.scale.setScalar(0.6 + u * 1.6);
    puff.material.uniforms.uOpacity.value = 0.35 * (1 - u);
    // the line comes once he has stood there a second
    if (!asked && t > 1.2 && !gg.uiBusy) { asked = true; herRoomMenu(gg); }
  };

  return {
    group,
    bounds: { minX: -W / 2 + 0.25, maxX: W / 2 - 0.25, minZ: -0.3, maxZ: D / 2 - 0.3 },
    solids: [solid(1.25, 0.2, 0.5, 1.1, 0.9)],
    spawn: { x: -0.2, z: 0.1, rot: Math.PI },
    spawnFor: () => ({ x: -0.2, z: 0.1, rot: Math.PI }),
    npcs,
    interactables,
    tick,
    ambient: 'apartment',
    title: `Kestrel Houses · ${w.door}`,
  };
}
