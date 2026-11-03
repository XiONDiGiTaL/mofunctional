/**
 * Below the street, and the places the train goes.
 *
 *   subway      Kestrel St–Ashby Av station: one long platform with a stair up to Kestrel at the
 *               west end and a stair up to Ashby at the east end, so it is also the short way
 *               between the two. Steel columns, tiled walls, fluorescent tubes, benches with
 *               somebody asleep on them, rats on the track bed and roaches along the wall. The K
 *               local pulls in, stops, opens its doors and leaves; the express on the far track
 *               does not stop for anybody. A door marked AUTHORIZED PERSONNEL opens at night.
 *   fightclub   The Tunnel: an abandoned lower platform, a ring of pallets and rope, a crowd, a
 *               bookie. One fight a night, for money.
 *   parkslope   Brownstones, strollers, a café that hires dishwashers and a dog-walking board.
 *   downtown    The mall strip: Mr. Jay's for clothes, a day-labour office, a hot dog cart.
 *   projects    Kestrel Houses: towers around a courtyard. Stronger product, worse people,
 *               and some of them are armed.
 *
 * Every builder returns the same shape as the other areas (group, bounds, solids, npcs,
 * interactables, spawn/spawnFor, tick).
 */
import * as happen from '../systems/happenings.js';
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box, plane } from '../render/retro.js';
import { tex } from '../render/textures.js';
import { signTex } from '../render/signs.js';
import { CONFIG } from '../core/config.js';
import { money, pick, minuteOfDay, dayOf, randInt } from '../core/util.js';
import { bump, addItem, logLine } from '../core/state.js';
import * as fights from '../systems/fights.js';
import * as wardrobe from '../systems/wardrobe.js';
import { FightMeter } from '../ui/fight.js';
import { buildCourt, COURT, housesState, WOMEN, womanMenu } from './houses.js';

const meter = (g) => (g.world.fightMeter ||= new FightMeter(document.getElementById('ui') || document.body, g));

const solid = (x, z, w, d, h = 2.4) => ({ x, z, w, d, h });
const SUB = () => CONFIG.subway;

const M = {
  tile: retroMaterial('ug_tile', { map: tex('tile'), color: 0xd8dccb }),
  tileDark: retroMaterial('ug_tile2', { map: tex('tile'), color: 0x8a9a86 }),
  conc: retroMaterial('ug_conc', { map: tex('concrete'), color: 0x8a8a84 }),
  floor: retroMaterial('ug_floor', { map: tex('concrete'), color: 0x9a968a }),
  bed: retroMaterial('ug_bed', { map: tex('asphalt'), color: 0x4a4440 }),
  steel: retroMaterial('ug_steel', { color: 0x2a3a30 }),
  rail: retroMaterial('ug_rail', { color: 0x8a8a8e, ambient: 0.9 }),
  tie: retroMaterial('ug_tie', { color: 0x3a2a1e }),
  yellow: retroMaterial('ug_yellow', { color: 0xd8b52a }),
  tube: retroMaterial('ug_tube', { color: 0xf4fbff, emissive: 1.2, unlit: true }),
  bench: retroMaterial('ug_bench', { map: tex('wood'), color: 0x8a6a42 }),
  black: retroMaterial('ug_black', { color: 0x0e0e10 }),
  green: retroMaterial('ug_green', { color: 0x2a6a4a }),
  greenDark: retroMaterial('ug_green2', { color: 0x1c4a32 }),
  globe: retroMaterial('ug_globe', { color: 0xf8f4e0, emissive: 1.1, unlit: true }),
  silver: retroMaterial('ug_silver', { color: 0xb8bcc2, ambient: 0.75 }),
  silverDark: retroMaterial('ug_silver2', { color: 0x8a8e94, ambient: 0.75 }),
  glass: retroMaterial('ug_glass', { color: 0x1a2028, emissive: 0.15 }),
  lit: retroMaterial('ug_lit', { color: 0xfff2c4, emissive: 1.0, unlit: true }),
  red: retroMaterial('ug_red', { color: 0xc4202a, emissive: 0.6, unlit: true }),
  brick: retroMaterial('ug_brick', { map: tex('brick'), color: 0xa86a4a }),
  sidewalk: retroMaterial('ug_sw', { map: tex('sidewalk') }),
  wood: retroMaterial('ug_wood', { map: tex('wood') }),
};

/* ================================================================== the street entrance */

/**
 * A subway entrance on a sidewalk: a stair opening framed by green railings on three sides, two
 * tall green posts with white globes at the open end, and a sign along the back rail. The stairs
 * are painted onto a dark well, since the sidewalk is a plane and nothing can actually go below
 * it. `rot` turns it; the opening faces local +z. Returns the solid footprint.
 */
export function subwayEntrance(group, { x, z, rot = 0, name = 'KESTREL ST', sub = 'K · to Park Slope, Downtown, Kestrel Houses' }) {
  const e = new THREE.Group();
  e.position.set(x, 0, z);
  e.rotation.y = rot;
  const W = 1.5, D = 2.4;
  e.add(plane(W, D, { name: 'ug_well', color: 0x0a0a0c }, [0, 0.012, 0], [-Math.PI / 2, 0, 0]));
  for (let i = 0; i < 8; i++) {
    e.add(plane(W - 0.1, 0.08, { name: 'ug_step', color: 0x5a5a56 - i * 0x080808 }, [0, 0.014, D / 2 - 0.15 - i * 0.28], [-Math.PI / 2, 0, 0]));
  }
  // railings: posts, a top rail and pickets, green as the city paints them
  const railSide = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(z1 - z0, x1 - x0);
    const r = new THREE.Group();
    r.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    r.rotation.y = -ang;
    r.add(box(len, 0.06, 0.06, M.green, [0, 1.0, 0]));
    r.add(box(len, 0.04, 0.04, M.green, [0, 0.12, 0]));
    for (let i = 0; i <= Math.round(len / 0.18); i++) r.add(box(0.025, 0.9, 0.025, M.greenDark, [-len / 2 + i * (len / Math.round(len / 0.18)), 0.56, 0]));
    e.add(r);
  };
  railSide(-W / 2, -D / 2, -W / 2, D / 2);
  railSide(W / 2, -D / 2, W / 2, D / 2);
  railSide(-W / 2, -D / 2, W / 2, -D / 2);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) e.add(box(0.1, 1.1, 0.1, M.greenDark, [sx * W / 2, 0.55, sz * D / 2]));
    // the lamp posts at the open end, with their globes
    e.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 2.6, 6), M.green).translateX(sx * W / 2).translateY(1.3).translateZ(D / 2 + 0.05));
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), M.globe);
    globe.position.set(sx * W / 2, 2.75, D / 2 + 0.05);
    e.add(globe);
  }
  e.add(plane(W + 0.1, 0.5, { name: `ug_ent_${name}`, map: signTex(`subSign_${name}`, [{ text: `${name} STATION`, color: '#ffffff', size: 10 }, { text: sub, color: '#e0e0d8', size: 4.5 }], { w: 160, h: 40, bg: '#141414', border: '#3a3a3a' }), emissive: 0.9, unlit: true }, [0, 1.35, -D / 2 - 0.02], [0, 0, 0]));
  group.add(e);
  // footprint in world space (it is long along its own z)
  const sideways = Math.abs(Math.sin(rot)) > 0.5;
  return solid(x, z, sideways ? D : W, sideways ? W : D, 1.2);
}

/* ================================================================== trains */

/**
 * A short train of silver cars after the 1970s R-type: fluted stainless sides, a dark window band,
 * three pairs of sliding doors a side, a lit route sign on the front and red markers at the back.
 * `doors` are the platform-side door panels (they slide along x), each with its closed x.
 */
function buildTrain(cars = 4, { platformSide = -1 } = {}) {
  const g = new THREE.Group();
  const L = 8.4, W = 2.5, H = 2.8, gap = 0.35;
  const doors = [];
  for (let c = 0; c < cars; c++) {
    const car = new THREE.Group();
    car.position.x = c * (L + gap);
    car.add(box(L, H, W, M.silver, [0, H / 2, 0]));
    car.add(box(L, 0.18, W - 0.2, M.silverDark, [0, H + 0.08, 0]));                // roof
    car.add(box(L - 0.4, 0.5, W - 0.4, M.black, [0, -0.15, 0]));                    // underframe
    for (const bx of [-L / 2 + 1.3, L / 2 - 1.3]) car.add(box(1.6, 0.42, W - 0.6, M.steel, [bx, -0.45, 0]));
    // fluting along both sides
    for (const sz of [-1, 1]) {
      for (let i = 0; i < 4; i++) car.add(box(L - 0.1, 0.03, 0.02, M.silverDark, [0, 0.35 + i * 0.12, sz * (W / 2 + 0.01)]));
      car.add(box(L - 0.3, 0.75, 0.02, M.glass, [0, 1.75, sz * (W / 2 + 0.012)]));  // window band
      for (const dx of [-L / 3, 0, L / 3]) {
        const isPlat = sz === platformSide;
        for (const half of [-1, 1]) {
          const p = box(0.62, 1.95, 0.05, M.silverDark, [dx + half * 0.31, 1.0, sz * (W / 2 + 0.03)]);
          p.add(box(0.4, 0.55, 0.02, M.glass, [0, 0.45, sz * 0.03]));
          car.add(p);
          if (isPlat) doors.push({ mesh: p, x0: p.position.x, dir: half });
        }
      }
    }
    // the American flag decal by the first door, as every car had one
    car.add(box(0.5, 0.3, 0.02, retroMaterial('ug_flag', { color: 0xb8323a }), [-L / 2 + 0.7, 2.1, platformSide * (W / 2 + 0.02)]));
    g.add(car);
  }
  // front end (the leading car's +x face): cab window, the K in a lit circle, headlights
  const frontX = (cars - 1) * (L + gap) + L / 2 + 0.02;
  g.add(box(0.04, 0.7, 0.8, M.glass, [frontX, 1.8, -0.5]));
  g.add(box(0.04, 0.7, 0.8, M.glass, [frontX, 1.8, 0.5]));
  g.add(plane(0.5, 0.5, { name: 'ug_route', map: signTex('routeK', [{ text: 'K', color: '#1a1a1a', size: 22 }], { w: 32, h: 32, bg: '#e8822a', border: '#1a1a1a' }), emissive: 1, unlit: true }, [frontX + 0.01, 2.35, 0], [0, Math.PI / 2, 0]));
  for (const sz of [-0.8, 0.8]) g.add(box(0.05, 0.14, 0.14, M.lit, [frontX, 0.45, sz]));
  const backX = -L / 2 - 0.02;
  for (const sz of [-0.8, 0.8]) g.add(box(0.05, 0.12, 0.12, M.red, [backX, 0.45, sz]));
  g.userData = { length: cars * (L + gap) - gap, doors };
  return g;
}

/**
 * One track's worth of service. A local runs: away → arriving (decelerating to the stop) →
 * stopped (doors open, then closed) → leaving → away. An express just runs through.
 */
class Line {
  constructor(group, { z, y, express = false, cars = 4, period = [26, 40] }) {
    this.train = buildTrain(cars, { platformSide: -1 });
    this.train.position.set(-200, y, z);
    group.add(this.train);
    this.express = express;
    this.period = period;
    this.len = this.train.userData.length;
    this.state = 'away';
    this.t = 6 + Math.random() * 8;
    this.x = -200;
    this.v = 0;
    this.doors = 0;
    this.stopX = -this.len / 2 + 4.2;  // the train's tail x when the front is at the east end of the platform
  }

  get stopped() { return this.state === 'stopped' && this.doors > 0.9; }

  update(dt) {
    const enterX = -60 - this.len;
    if (this.state === 'away') {
      this.t -= dt;
      if (this.t <= 0) { this.state = this.express ? 'through' : 'arriving'; this.x = enterX; this.v = this.express ? 22 : 15; }
    } else if (this.state === 'arriving') {
      const left = this.stopX - this.x;
      this.v = Math.max(1.2, Math.min(15, Math.sqrt(Math.max(0, left) * 2 * 2.4)));
      this.x += this.v * dt;
      if (left <= 0.05) { this.x = this.stopX; this.state = 'stopped'; this.t = SUB().dwell; this.v = 0; }
    } else if (this.state === 'stopped') {
      this.t -= dt;
      const open = this.t > 1.6 && this.t < SUB().dwell - 0.8;
      this.doors += ((open ? 1 : 0) - this.doors) * Math.min(1, dt * 4);
      if (this.t <= 0) { this.state = 'leaving'; this.doors = 0; }
    } else if (this.state === 'leaving' || this.state === 'through') {
      if (this.state === 'leaving') this.v = Math.min(18, this.v + 2.6 * dt);
      this.x += this.v * dt;
      if (this.x > 70) { this.state = 'away'; this.t = this.period[0] + Math.random() * (this.period[1] - this.period[0]); this.x = -200; }
    }
    this.train.position.x = this.x;
    // a little sway at speed
    this.train.rotation.x = this.v > 4 ? Math.sin(performance.now() / 90) * 0.004 : 0;
    for (const d of this.train.userData.doors) d.mesh.position.x = d.x0 + d.dir * 0.58 * this.doors;
  }
}

/* ================================================================== rats and roaches */

function buildRat() {
  const g = new THREE.Group();
  const fur = retroMaterial('rat_fur', { color: 0x4a4038 });
  const pink = retroMaterial('rat_pink', { color: 0xc8907a });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), fur);
  body.scale.set(1.7, 0.85, 1);
  body.position.y = 0.06;
  g.add(body);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.11, 5), fur);
  head.rotation.z = -Math.PI / 2;
  head.position.set(0.15, 0.06, 0);
  g.add(head);
  for (const z of [-0.025, 0.025]) g.add(box(0.02, 0.03, 0.02, pink, [0.11, 0.11, z]));
  const tail = box(0.2, 0.012, 0.012, pink, [-0.2, 0.04, 0]);
  tail.rotation.z = 0.15;
  g.add(tail);
  return { root: g, tail, x: 0, z: 0, tx: 0, tz: 0, wait: 0, t: Math.random() * 10 };
}

function buildRoach() {
  const g = new THREE.Group();
  const m = retroMaterial('roach', { color: 0x3a2214 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 4), m);
  b.scale.set(1.8, 0.5, 1);
  b.position.y = 0.01;
  g.add(b);
  g.add(box(0.03, 0.003, 0.002, m, [0.04, 0.012, 0.008]));
  g.add(box(0.03, 0.003, 0.002, m, [0.04, 0.012, -0.008]));
  return { root: g, tx: 0, tz: 0, wait: Math.random() * 3 };
}

/** Rats and roaches that live somewhere, scurry in bursts and freeze when they get there. */
class Vermin {
  constructor(group, { rats = [], roaches = [] }) {
    this.rats = rats.map((area) => { const r = buildRat(); r.area = area; this.place(r, area); group.add(r.root); return r; });
    this.roaches = roaches.map((area) => { const r = buildRoach(); r.area = area; this.place(r, area); group.add(r.root); return r; });
  }

  place(c, a) {
    c.root.position.set(a.x0 + Math.random() * (a.x1 - a.x0), a.y || 0, a.z0 + Math.random() * (a.z1 - a.z0));
    c.tx = c.root.position.x; c.tz = c.root.position.z;
  }

  move(c, dt, speed, mo) {
    const p = c.root.position;
    // anything with legs runs from Mo
    const md = mo ? Math.hypot(mo.x - p.x, mo.z - p.z) : 99;
    if (md < 1.4 && c.wait > 0) { c.wait = 0; c.tx = p.x + (p.x - mo.x) * 2; c.tz = p.z + (p.z - mo.z) * 2; }
    if (c.wait > 0) { c.wait -= dt; return false; }
    const dx = c.tx - p.x, dz = c.tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) {
      c.wait = 0.4 + Math.random() * 3;
      const a = c.area;
      c.tx = Math.max(a.x0, Math.min(a.x1, p.x + (Math.random() - 0.5) * (a.reach || 4)));
      c.tz = Math.max(a.z0, Math.min(a.z1, p.z + (Math.random() - 0.5) * (a.reach || 4) * 0.4));
      return false;
    }
    p.x += (dx / d) * Math.min(d, speed * dt);
    p.z += (dz / d) * Math.min(d, speed * dt);
    c.root.rotation.y = Math.atan2(-dz, dx);
    return true;
  }

  update(dt, mo) {
    for (const r of this.rats) {
      r.t += dt;
      const moving = this.move(r, dt, 2.2, r.area.y < 0 ? null : mo);
      r.tail.rotation.y = Math.sin(r.t * (moving ? 18 : 3)) * 0.5;
      r.root.position.y = (r.area.y || 0) + (moving ? Math.abs(Math.sin(r.t * 22)) * 0.012 : 0);
    }
    for (const c of this.roaches) this.move(c, dt, 0.9, mo);
  }
}

/* ================================================================== the station */

export function buildSubway(g) {
  const group = new THREE.Group();
  const L = 60, PZ0 = -3.6, PZ1 = 1.6, BED = -1.2, CEIL = 3.6, FAR = 9.0;
  // platform, edge strip, the drop to the track bed
  group.add(plane(L, PZ1 - PZ0, { name: 'ug_plat', map: tex('concrete'), color: 0x9a968a, repeat: [20, 2] }, [0, 0, (PZ0 + PZ1) / 2], [-Math.PI / 2, 0, 0]));
  group.add(box(L, 0.02, 0.24, M.yellow, [0, 0.011, PZ1 - 0.14]));
  group.add(box(L, 1.2, 0.2, M.conc, [0, BED / 2, PZ1 + 0.1]));
  // the track bed: two tracks (local nearest the platform, express beyond the columns)
  group.add(plane(L + 40, FAR - PZ1, { name: 'ug_bed', map: tex('asphalt'), color: 0x4a4440, repeat: [30, 3] }, [0, BED, (PZ1 + FAR) / 2], [-Math.PI / 2, 0, 0]));
  for (const tz of [3.4, 6.9]) {
    for (const off of [-0.72, 0.72]) group.add(box(L + 40, 0.1, 0.08, M.rail, [0, BED + 0.15, tz + off]));
    for (let x = -L / 2 - 20; x < L / 2 + 20; x += 0.9) group.add(box(0.22, 0.08, 2.2, M.tie, [x, BED + 0.04, tz]));
    group.add(box(L + 40, 0.12, 0.12, retroMaterial('ug_third', { color: 0x6a6a6e }), [0, BED + 0.2, tz + (tz < 5 ? -1.15 : 1.15)]));
  }
  // walls, the far wall, the ceiling and its lights
  group.add(box(L, CEIL, 0.3, M.tile, [0, CEIL / 2, PZ0 - 0.15]));
  group.add(box(L + 40, CEIL - BED, 0.3, M.tileDark, [0, (CEIL + BED) / 2, FAR + 0.15]));
  group.add(plane(L + 40, FAR - PZ0, { name: 'ug_ceil', color: 0x2a2c2a }, [0, CEIL, (PZ0 + FAR) / 2], [Math.PI / 2, 0, 0]));
  for (let x = -L / 2 + 3; x < L / 2; x += 6) {
    group.add(box(3.6, 0.06, 0.12, M.tube, [x, CEIL - 0.18, -1.0]));
    group.add(box(3.6, 0.06, 0.12, M.tube, [x, CEIL - 0.18, 5.2]));
  }
  // the name band in tile, repeated along the wall, and the line signs over the platform
  for (let x = -L / 2 + 6; x < L / 2 - 2; x += 12) {
    group.add(plane(3.2, 0.5, { name: 'ug_band', map: signTex('subBand', [{ text: 'KESTREL ST', color: '#f2efe2', size: 12 }], { w: 128, h: 20, bg: '#2a5a3a', border: '#d8b52a' }), unlit: true, emissive: 0.6 }, [x, 2.2, PZ0 + 0.01]));
  }
  for (const x of [-12, 12]) {
    group.add(box(4.4, 0.6, 0.08, M.black, [x, 2.85, 0.4]));
    group.add(plane(4.3, 0.5, { name: `ug_dir${x}`, map: signTex('subDir', [{ text: 'K  Park Slope · Downtown · Kestrel Houses', color: '#ffffff', size: 6 }, { text: 'all times · express trains do not stop here', color: '#c8c8c0', size: 4 }], { w: 192, h: 24, bg: '#141414', border: '#141414' }), unlit: true, emissive: 0.9 }, [x, 2.85, 0.45]));
  }
  // steel columns down the platform and between the tracks
  const solids = [];
  for (let x = -L / 2 + 5; x < L / 2 - 3; x += 6) {
    group.add(box(0.3, CEIL, 0.3, M.steel, [x, CEIL / 2, 0.6]));
    group.add(box(0.42, 0.12, 0.42, M.steel, [x, 0.06, 0.6]));
    solids.push(solid(x, 0.6, 0.4, 0.4));
    group.add(box(0.3, CEIL - BED, 0.3, M.steel, [x + 3, (CEIL + BED) / 2, 5.15]));
  }
  // benches against the wall, trash cans, a newspaper box, a token booth
  for (const x of [-15, -3, 9, 18]) {
    group.add(box(2.2, 0.08, 0.5, M.bench, [x, 0.46, PZ0 + 0.45]));
    group.add(box(2.2, 0.5, 0.06, M.bench, [x, 0.75, PZ0 + 0.22]));
    for (const lx of [-0.9, 0.9]) group.add(box(0.08, 0.44, 0.44, M.steel, [x + lx, 0.22, PZ0 + 0.45]));
    solids.push(solid(x, PZ0 + 0.4, 2.2, 0.6, 0.9));
  }
  for (const x of [-9, 4, 14]) {
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.8, 8), retroMaterial('ug_can', { color: 0x2a3a2e })).translateX(x).translateY(0.4).translateZ(PZ0 + 0.4));
    solids.push(solid(x, PZ0 + 0.4, 0.5, 0.5, 0.8));
  }
  // the booth is a room, not a block: three walls, a roof, a counter, a window, and a clerk
  {
    const bm = retroMaterial('ug_booth', { color: 0x6a5a3a });
    const bx = -21, bz = PZ0 + 0.7;
    group.add(box(1.6, 2.3, 0.1, bm, [bx, 1.15, bz - 0.55]));
    for (const sx of [-1, 1]) group.add(box(0.1, 2.3, 1.2, bm, [bx + sx * 0.75, 1.15, bz]));
    group.add(box(1.6, 0.12, 1.2, bm, [bx, 2.3, bz]));
    group.add(box(1.6, 0.95, 0.1, bm, [bx, 0.47, bz + 0.55]));
    group.add(box(1.5, 0.05, 0.36, retroMaterial('ug_counter', { color: 0x8a8278 }), [bx, 0.97, bz + 0.62]));
    // plexiglass you can actually see her through
    group.add(box(1.4, 1.05, 0.03, { name: 'ug_plexi', color: 0xb8d0d8, opacity: 0.22, transparent: true, unlit: true }, [bx, 1.55, bz + 0.57]));
    group.add(box(0.36, 0.05, 0.04, retroMaterial('ug_slot', { color: 0x1a1a1a }), [bx, 1.02, bz + 0.6]));
    group.add(box(0.4, 0.62, 0.4, M.steel, [bx, 0.31, bz - 0.1])); // a tall booth stool
    group.add(box(1.5, 0.06, 0.03, retroMaterial('ug_boothlight', { color: 0xfff2c4, emissive: 1, unlit: true }), [bx, 2.2, bz + 0.45]));
  }
  group.add(plane(1.2, 0.26, { name: 'ug_tokens', map: signTex('subTokens', [{ text: 'TOKENS · METROCARD', color: '#ffd24a', size: 7 }], { w: 96, h: 18, bg: '#141414', border: '#ffd24a' }), unlit: true, emissive: 1 }, [-21, 2.1, PZ0 + 1.32]));
  solids.push(solid(-21, PZ0 + 0.7, 1.7, 1.3));
  // the stairs up at both ends: steps rising into a lit gap in the ceiling
  for (const [sx, label] of [[-1, 'KESTREL ST ↑'], [1, 'ASHBY AV ↑']]) {
    const x0 = sx * (L / 2 - 2.4);
    for (let i = 0; i < 12; i++) group.add(box(0.3, 0.3 * (i + 1), 2.2, M.conc, [x0 + sx * i * 0.18, 0.15 * (i + 1), -2.0]));
    // a handrail beside the flight: posts and a sloped bar, not a panel standing in the way
    const rx = x0 - sx * 0.2;
    for (const dz of [-1.9, -0.95, 0]) group.add(box(0.05, 0.95, 0.05, M.rail, [rx, 0.48, dz - 0.05]));
    group.add(box(0.06, 0.06, 2.0, M.rail, [rx, 0.95, -0.98]));
    group.add(plane(1.8, 0.4, { name: `ug_up${sx}`, map: signTex(`subUp${sx}`, [{ text: label, color: '#ffffff', size: 9 }], { w: 96, h: 20, bg: '#141414', border: '#ffffff' }), unlit: true, emissive: 1 }, [x0 - sx * 0.6, 2.6, -0.9]));
  }
  // the maintenance door: the way down to the Tunnel, for people who know
  group.add(box(1.1, 2.2, 0.1, retroMaterial('ug_mdoor', { color: 0x4a4e4a }), [0, 1.1, PZ0 + 0.06]));
  group.add(plane(0.9, 0.3, { name: 'ug_auth', map: signTex('subAuth', [{ text: 'AUTHORIZED PERSONNEL ONLY', color: '#141414', size: 5 }], { w: 96, h: 16, bg: '#e8c83a', border: '#141414' }), unlit: true, emissive: 0.6 }, [0, 1.85, PZ0 + 0.12]));
  // gum, puddles, a dropped MetroCard
  for (let i = 0; i < 18; i++) group.add(plane(0.05 + Math.random() * 0.04, 0.05, { name: 'ug_gum', color: 0x3a3a38 }, [-L / 2 + Math.random() * L, 0.013, PZ0 + 0.6 + Math.random() * 4], [-Math.PI / 2, 0, 0]));

  // the trains
  const local = new Line(group, { z: 3.4, y: BED + 1.25, period: SUB().localPeriod });
  const express = new Line(group, { z: 6.9, y: BED + 1.25, express: true, cars: 6, period: SUB().expressPeriod });
  const vermin = new Vermin(group, {
    rats: [
      { x0: -26, x1: 26, z0: 2.0, z1: 2.4, y: BED + 0.01, reach: 10 },
      { x0: -26, x1: 26, z0: 4.6, z1: 5.0, y: BED + 0.01, reach: 10 },
      { x0: -26, x1: 26, z0: 8.2, z1: 8.6, y: BED + 0.01, reach: 12 },
      { x0: 20, x1: 26, z0: -3.3, z1: -2.8, reach: 4 },
      { x0: -26, x1: -18, z0: -3.3, z1: -2.8, reach: 4 },
    ],
    roaches: Array.from({ length: 14 }, (_, i) => {
      const x = -24 + i * 3.6;
      return { x0: x - 1.2, x1: x + 1.2, z0: -3.4, z1: -2.9, reach: 1.6 };
    }),
  });

  const npcs = [
    // asleep along the bench, not under it: lying the length of the seat at seat height
    { kind: 'homeless', x: -15.1, z: PZ0 + 0.45, y: 0.42, rot: Math.PI / 2, still: true, pose: 'sleep' },
    // the token booth clerk, on her stool behind the glass
    { kind: 'transit', x: -21, z: PZ0 + 0.6, y: 0.17, rot: 0, still: true, pose: 'sit' },
    { kind: 'drifter', x: 22.5, z: -2.9, rot: 0, still: true, pose: 'sit' },
    { kind: 'junkie', x: 11.5, z: -3.1, rot: 0, still: true, act: 'lean' },
    { kind: 'passer_m', x: -6, z: 0.8, rot: Math.PI, still: true },
    { kind: pick(['w2', 'w5', 'w11', 'w16']), x: 6, z: 0.9, rot: Math.PI, still: true },
    { kind: 'passer_m2', x: 2, z: -1.4, walker: [-25, 25] },
    { kind: pick(['w1', 'w7', 'w13']), x: -14, z: -1.9, walker: [-25, 25] },
    { kind: 'tenant_m', x: 15, z: 0.7, rot: Math.PI, still: true, act: 'smoke' },
  ];

  const s = g.state;
  const interactables = [
    { id: 'ug_up_kestrel', label: 'Stairs up to Kestrel St.', sub: 'the block, by the Quik-Stop', x: -L / 2 + 3.2, z: -1.6, radius: 1.8, action: (gg) => gg.goTo('street', 'subway') },
    { id: 'ug_up_ashby', label: 'Stairs up to Ashby Avenue', sub: 'the avenue, by the precinct', x: L / 2 - 3.2, z: -1.6, radius: 1.8, action: (gg) => gg.goTo('avenue', 'subway') },
    { id: 'ug_board', label: 'Board the K train', sub: `doors open · ${money(SUB().fare)}`, x: 0, z: 1.0, radius: 30,
      // the train is long: anywhere along the platform edge counts while the doors are open
      hidden: true, action: (gg) => boardMenu(gg, 'subway') },
    { id: 'ug_wait', label: 'Wait for the train', sub: 'the board says 4 MIN, which means nothing', x: 0, z: 0.9, radius: 30, hidden: false,
      unavailable: () => 'no train in the station yet', action: () => {} },
    { id: 'ug_pit', label: 'The door marked AUTHORIZED PERSONNEL', sub: 'there is music under it at night', x: 0, z: PZ0 + 0.9, radius: 1.2,
      unavailable: (gg) => (pitOpen(gg) ? null : 'locked · somebody says "come back after ten"'),
      action: (gg) => gg.goTo('fightclub', 'subway') },
    { id: 'ug_booth', label: 'The token booth', sub: 'a woman behind two inches of plexiglass', x: -21, z: PZ0 + 1.85, radius: 1.3, action: (gg) => gg.openModal({
      kicker: 'TOKEN BOOTH', title: 'Behind the Glass',
      body: '"Card or token. Exact change or a line behind you." She has seen everything this station has ever done and she is still here, which says something about one of you.',
      choices: [{ label: 'Ask where the trains go.', sub: '', effect: () => gg.toast('"Park Slope. Downtown. The Houses. Same train, same token. The express does not stop, so do not stand there waving at it."', 'info') }, { label: 'Never mind.', effect: () => {} }],
    }) },
  ];
  let ambT = 12;
  const tick = (gg, dt, world) => {
    local.update(dt);
    express.update(dt);
    vermin.update(dt, world?.mo?.root?.position);
    // the boarding prompt exists only while the doors are open and Mo is near the edge
    // the world keeps its own copies of the interactables: toggle those, not the originals
    const board = world?.interactables.find((i) => i.id === 'ug_board');
    const wait = world?.interactables.find((i) => i.id === 'ug_wait');
    if (!board || !wait) return;
    const mo = world.mo.root.position;
    const atEdge = mo.z > -0.6;
    board.hidden = !(local.stopped && atEdge);
    wait.hidden = !atEdge || local.stopped;
    board.x = mo.x; board.z = mo.z;
    wait.x = board.x; wait.z = board.z;
    if (express.state === 'through' && Math.abs(express.x + express.len / 2) < 6 && !express.warned) {
      express.warned = true;
      gg.audio?.sfx?.('door');
      if (Math.random() < 0.4) gg.toast(pick(['The express goes through like the station owes it money. Your jacket moves.', 'A wall of noise and silver and wind, and then the rats come back out.']), 'info');
    }
    if (express.state === 'away') express.warned = false;
    ambT -= dt;
    if (ambT <= 0 && !gg.modalOpen && !gg.phoneOpen) {
      ambT = 22 + Math.random() * 20;
      gg.toast(pick([
        'A rat the size of a shoe walks the edge of the platform like it pays a fare.',
        'The PA says something. It is either "Ashby" or "nasty". Possibly both.',
        'A man with a guitar case and no guitar asks if you have a dollar for the guitar.',
        'Somebody is eating sunflower seeds and spitting the shells onto the tracks with real precision.',
        'A roach crosses your path, stops, considers you, and continues.',
      ]), 'info');
    }
  };
  return {
    group,
    seats: [-3, 9, 18].flatMap((x) => [-0.5, 0.5].map((dx) => ({ x: x + dx, z: PZ0 + 0.55, rot: 0, label: 'Sit on the bench', sub: 'wait for the train' }))),
    title: 'Kestrel St · Ashby Av Station',
    trains: { local, express },
    bounds: { minX: -L / 2 + 1.6, maxX: L / 2 - 1.6, minZ: PZ0 + 0.3, maxZ: PZ1 - 0.25 },
    camBounds: { minX: -L / 2, maxX: L / 2, minZ: PZ0 + 0.2, maxZ: 8.6 },
    solids,
    spawn: { x: -L / 2 + 4, z: -1.6, rot: Math.PI / 2 },
    spawnFor: (from) => (from === 'avenue' ? { x: L / 2 - 4, z: -1.6, rot: -Math.PI / 2 }
      : from === 'fightclub' ? { x: 0, z: PZ0 + 1.4, rot: 0 }
        : from === 'train' ? { x: randInt(-10, 10), z: 0.8, rot: Math.PI } : { x: -L / 2 + 4, z: -1.6, rot: Math.PI / 2 }),
    npcs,
    interactables,
    tick,
    interior: true,
    ambient: 'street',
    enterToast: 'Kestrel St station. It smells like brakes, damp and somebody\'s lunch from 1987.',
  };
}

const pitOpen = (g) => { const m = minuteOfDay(g.state.clock.m); return m >= 22 * 60 || m < 4 * 60; };

/** On the train: pick a stop. The fare, the ride, a line about the ride, and the doors open somewhere else. */
export function boardMenu(g, here) {
  const s = g.state;
  if (happen.isActive(s, 'transit')) {
    g.openModal({
      kicker: 'THE K TRAIN · SUSPENDED', title: 'No Trains',
      body: 'A laminated sign, a man in an orange vest, and the words SHUTTLE BUS in a tone of voice. The shuttle comes "every few minutes."',
      choices: [
        { label: 'Wait for the shuttle bus.', sub: '+40 min · same fare', effect: () => { g.advance(40); bump(s, 'stress', 6); g.toast('Forty minutes, one bus, standing room only, and a man with a bicycle. You are on your way.', 'info'); setTimeout(() => boardMenuReal(g, here), 60); } },
        { label: 'Never mind.', effect: () => {} },
      ],
    });
    return;
  }
  boardMenuReal(g, here);
}

function boardMenuReal(g, here) {
  const s = g.state;
  const stops = SUB().stops.filter((st) => st.area !== here);
  g.openModal({
    kicker: 'THE K TRAIN · DOORS OPEN',
    title: 'Where To',
    body: `Orange seats, a map with three of the stops scratched out, and an ad for a lawyer who will fight for you. Fare ${money(SUB().fare)}.`,
    choices: [
      ...stops.map((st) => ({
        label: `Ride to ${st.name}.`, sub: `${money(SUB().fare)} · ${st.mins} min`,
        disabled: s.money < SUB().fare,
        effect: () => rideTo(g, st),
      })),
      { label: 'Step back off.', sub: '', effect: () => {} },
    ],
  });
}

function rideTo(g, st) {
  const s = g.state;
  if (!g.spendMoney(SUB().fare, 'subway fare')) return;
  const go = () => {
    g.advance(st.mins);
    bump(s, 'stress', Math.random() < 0.3 ? 3 : -1);
    g.goTo(st.area, st.area === 'subway' ? 'train' : 'subway');
    g.fadeIn?.();
    g.toast(pick([
      'A man walks the car selling batteries, then candy, then a speech. You buy nothing and listen to all of it.',
      'Showtime. Two kids swing on the poles for three stops. You give them a dollar in your heart.',
      'The lights go out for a whole tunnel. Nobody reacts. That is New York.',
      'Somebody falls asleep on your shoulder at the second stop and wakes up at yours, embarrassed for both of you.',
    ]), 'info');
  };
  if (g.fadeOut) g.fadeOut(go, 380); else go();
}

/** A "take the train back" interaction for the far stations. */
function homeTrain(x, z) {
  return {
    id: 'far_train', label: 'Take the K train', sub: `back to Kestrel St, or onward · ${money(SUB().fare)}`, x, z, radius: 1.8,
    action: (gg) => boardMenu(gg, gg.world.areaId),
  };
}

/* ================================================================== a street block, for the far stops */

/** Sidewalk, road, curb, lamps and a row of facades. Returns { group, door(x, label, color) }. */
function block(name, facades, { L = 34, sidewalkTex = 'sidewalk' } = {}) {
  const group = new THREE.Group();
  group.add(plane(L, 9, { name: `${name}_sw`, map: tex(sidewalkTex), repeat: [10, 3] }, [0, 0, -2.0], [-Math.PI / 2, 0, 0]));
  group.add(plane(L, 9, { name: `${name}_road`, map: tex('asphalt'), repeat: [12, 3] }, [0, -0.01, 6.0], [-Math.PI / 2, 0, 0]));
  group.add(box(L, 0.18, 0.4, M.conc, [0, 0.09, 1.5]));
  for (const f of facades) {
    group.add(box(f.w, f.h, 1.2, retroMaterial(`${name}_fac${f.x}`, { map: tex(f.tex || 'brick'), color: f.color }), [f.x, f.h / 2, -7.0]));
    for (let r = 1; r < Math.floor(f.h / 1.7); r++) for (let c = 0; c < Math.floor(f.w / 2.2); c++) {
      group.add(plane(0.9, 1.0, { name: `${name}_win`, map: tex('window'), emissive: Math.random() < 0.4 ? 0.45 : 0.08, unlit: true }, [f.x - f.w / 2 + 1.1 + c * 2.2, 1.4 + r * 1.7, -6.38]));
    }
  }
  for (const x of [-14, -5, 4, 13]) {
    group.add(box(0.12, 4.0, 0.12, retroMaterial('ug_pole', { color: 0x3a3e42 }), [x, 2.0, 1.1]));
    group.add(box(0.6, 0.1, 0.3, M.lit, [x, 4.0, 0.9]));
  }
  const door = (x, label, sub, color, signColor = '#ffffff', bg = '#141414') => {
    group.add(box(1.2, 2.3, 0.12, retroMaterial(`${name}_door${x}`, { color }), [x, 1.15, -6.32]));
    group.add(plane(3.2, 0.6, { name: `${name}_sign${x}`, map: signTex(`${name}Sign${x}`, [{ text: label, color: signColor, size: 10 }, { text: sub, color: '#e8e0c8', size: 5 }], { w: 160, h: 28, bg, border: signColor }), emissive: 1, unlit: true }, [x, 3.0, -6.3]));
  };
  return { group, door };
}

const farBounds = { minX: -15.5, maxX: 15.5, minZ: -5.6, maxZ: 1.3 };
const farCam = { minX: -17, maxX: 17, minZ: -5.6, maxZ: 9 };
const farTraffic = { lanes: [{ z: 4.4, dir: 1 }, { z: 6.8, dir: -1 }], x0: -19, x1: 19, rate: [3, 8], bus: 0.06 };

/* ================================================================== Park Slope */

export function buildParkSlope(g) {
  const { group, door } = block('ps', [
    { x: -11, w: 7, h: 8, color: 0x8a5a3a, tex: 'brick' },
    { x: -3.5, w: 7, h: 8, color: 0x7a4a32 },
    { x: 4.0, w: 7, h: 8, color: 0x8e6044 },
    { x: 11.5, w: 7, h: 8, color: 0x6e4430 },
  ]);
  // stoops: the brownstone signature, steps up to a door with a railing
  for (const x of [-11, -3.5, 11.5]) {
    for (let i = 0; i < 5; i++) group.add(box(1.6, 0.18 * (i + 1), 0.4, retroMaterial('ps_stoop', { color: 0x7a5a44 }), [x, 0.09 * (i + 1), -5.4 + i * 0.4 - 1.6]));
    group.add(box(1.2, 2.2, 0.1, retroMaterial('ps_bdoor', { color: 0x3a2014 }), [x, 2.0, -6.32]));
  }
  // trees in iron guards, and a bench
  for (const x of [-7.5, 0, 7.5]) {
    group.add(box(0.2, 2.4, 0.2, M.wood, [x, 1.2, 0.2]));
    group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), retroMaterial('ps_leaf', { color: 0x4a7a3a })).translateX(x).translateY(3.0).translateZ(0.2));
    group.add(box(1.0, 0.3, 1.0, retroMaterial('ps_guard', { color: 0x1a1a1a }), [x, 0.15, 0.2]));
  }
  door(4.0, 'GROUNDS FOR HOPE', 'COFFEE · PASTRY · OAT MILK SURCHARGE', 0x2a4a3a, '#f2e6c8', '#2a3a2e');
  group.add(box(2.8, 1.6, 0.06, retroMaterial('ps_cafewin', { color: 0xffe0a8, emissive: 0.5, unlit: true }), [6.2, 1.4, -6.33]));
  // the dog-walker board on a lamp post
  group.add(box(0.6, 0.8, 0.04, retroMaterial('ps_board', { color: 0xe8e2c8 }), [-5, 1.6, 1.0]));
  const solids = [solid(-7.5, 0.2, 1.0, 1.0), solid(0, 0.2, 1.0, 1.0), solid(7.5, 0.2, 1.0, 1.0)];
  const entrance = subwayEntrance(group, { x: -1.5, z: -2.6, rot: Math.PI / 2, name: '7 AV · PARK SLOPE' });
  solids.push(entrance);
  const s = g.state;
  const J = CONFIG.jobsExtra;
  const interactables = [
    homeTrain(0.4, -2.6),
    { id: 'ps_cafe', label: 'Grounds for Hope', sub: 'a café · they need a dishwasher', x: 4.0, z: -5.2, radius: 1.5,
      unavailable: (gg) => { const m = minuteOfDay(gg.state.clock.m); return m < 7 * 60 || m > 20 * 60 ? 'closed · opens 07:00' : null; },
      action: (gg) => gg.openModal({
        kicker: 'PARK SLOPE · GROUNDS FOR HOPE', title: 'The Café',
        body: 'Exposed brick, a chalkboard with a quote on it, and a man with a beard who calls everyone "friend" without irony. A sign by the register: DISHWASHER WANTED, CASH, SAME DAY.',
        choices: [
          { label: `A coffee. ${money(3.5)}`, sub: '+energy · it has a leaf drawn in it', disabled: gg.state.money < 3.5, effect: () => { if (!gg.spendMoney(3.5, 'café coffee')) return; bump(gg.state, 'energy', 12); bump(gg.state, 'morale', 2); gg.advance(10); } },
          job(gg, 'dishwasher', 'Wash dishes for a shift.', `${J.dishwasher.hours} h · ${money(J.dishwasher.pay)} cash`),
          { label: 'Leave.', effect: () => {} },
        ],
      }) },
    { id: 'ps_dogs', label: 'The dog-walker board', sub: 'tear-off tabs · cash for walks', x: -5, z: 0.4, radius: 1.3,
      action: (gg) => gg.openModal({
        kicker: 'PARK SLOPE', title: 'WALKERS NEEDED',
        body: 'Handwritten, laminated, the tabs half torn off. "Responsible adult to walk three very good boys. Cash. References optional if you are nice to them."',
        choices: [job(gg, 'dogwalk', 'Walk the dogs.', `${J.dogwalk.hours} h · ${money(J.dogwalk.pay)} cash · +morale`), { label: 'Not today.', effect: () => {} }],
      }) },
  ];
  const npcs = [
    { kind: 'tenant_f', x: -8, z: -1.2, walker: [-15, 15] },
    { kind: pick(['w4', 'w9', 'w15']), x: 2, z: -2.4, walker: [-15, 15] },
    { kind: 'passer_m2', x: 9, z: -0.8, walker: [-15, 15] },
    // Brooklyn foot traffic: men from Williamsburg on the way somewhere, and, some days, a pair of
    // Guardian Angles walking a patrol nobody asked for
    ...((minuteOfDay(g.state.clock.m) >= 420 && minuteOfDay(g.state.clock.m) < 1200) && Math.random() < 0.55 ? [{ kind: pick(['hasid', 'hasid2']), x: -5, z: -1.6, walker: [-15, 15] }] : []),
    ...(Math.random() < 0.35 ? [{ kind: 'angel_m', x: 3, z: -2.4, walker: [-15, 15] }, { kind: 'angel_f', x: 4.1, z: -2.4, walker: [-15, 15] }] : []),
    { kind: pick(['w6', 'w10']), x: 12.4, z: -4.6, rot: 0, still: true, act: 'talk' },
    { kind: 'waiter', x: 5.6, z: -5.6, rot: 0, still: true, act: 'smoke' },
  ];
  return {
    group, title: '7th Avenue · Park Slope',
    bounds: farBounds, camBounds: farCam, traffic: farTraffic, solids,
    spawn: { x: 0.8, z: -2.6, rot: Math.PI / 2 }, spawnFor: () => ({ x: 0.8, z: -2.6, rot: Math.PI / 2 }),
    npcs, interactables, ambient: 'street',
    enterToast: 'Park Slope. Brownstones, strollers that cost more than your rent, and a lot of people being very calm.',
  };
}

/** A one-shift job choice: once a day, takes the hours, pays cash, costs energy. */
function job(g, id, label, sub) {
  const J = CONFIG.jobsExtra[id];
  const s = g.state;
  s.gigs = s.gigs || {};
  const day = dayOf(s.clock.m);
  const done = s.gigs[id] === day;
  const m = minuteOfDay(s.clock.m);
  const inHours = m >= J.from * 60 && m <= J.to * 60;
  return {
    label, sub: done ? 'done for today' : !inHours ? `hiring ${String(J.from).padStart(2, '0')}:00 to ${String(J.to).padStart(2, '0')}:00` : sub,
    disabled: done || !inHours || s.stats.energy < 15,
    effect: () => {
      s.gigs[id] = day;
      g.advance(J.hours * 60);
      bump(s, 'energy', -J.energy);
      bump(s, 'hunger', -J.hours * 4);
      if (J.morale) bump(s, 'morale', J.morale);
      g.earnMoney(J.pay, J.name);
      logLine(g, `${J.name}: ${money(J.pay)}.`, 'good');
      g.toast(J.line, 'good');
    },
  };
}

/* ================================================================== Downtown */

export function buildDowntown(g) {
  const { group, door } = block('dt', [
    { x: -11, w: 7, h: 12, color: 0xb8b0a0, tex: 'concrete' },
    { x: -3.5, w: 7, h: 10, color: 0xc8c0b0, tex: 'concrete' },
    { x: 4.0, w: 7, h: 14, color: 0x9a9488 },
    { x: 11.5, w: 7, h: 9, color: 0xa8a090 },
  ], { sidewalkTex: 'sidewalk' });
  door(-11, "MR. JAY'S", 'URBAN WEAR · SNEAKERS · HATS · WE GOT YOUR SIZE', 0x2a2a30, '#ffd23a', '#1a1a1e');
  group.add(box(2.8, 1.8, 0.06, retroMaterial('dt_jaywin', { color: 0xfff0c8, emissive: 0.55, unlit: true }), [-8.6, 1.4, -6.33]));
  door(-3.5, 'CIVIC RELIEF PROGRAM', 'FOOD CREDIT · RECERTIFICATION · TAKE A NUMBER', 0x4a5a6a, '#ffffff', '#2a3a5a');
  door(4.0, 'READY HANDS', 'DAY LABOR · SIGN IN BY 10 · CASH SAME DAY', 0x3a4a5a, '#9ad0ff', '#14202a');
  // a hot dog cart under a striped umbrella
  group.add(box(1.4, 0.9, 0.7, M.silver, [10, 0.6, -2.0]));
  for (const wx of [-0.5, 0.5]) group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 8), M.black).translateX(10 + wx).translateY(0.18).translateZ(-1.6).rotateX(Math.PI / 2));
  group.add(box(0.06, 1.4, 0.06, M.silver, [10, 1.6, -2.0]));
  const umb = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.4, 8), retroMaterial('dt_umb', { color: 0xd8b52a }));
  umb.position.set(10, 2.4, -2.0);
  group.add(umb);
  // a boombox store blasting out of its door, rendered as a speaker stack
  group.add(box(0.6, 1.2, 0.5, M.black, [12.8, 0.6, -5.6]));
  for (const y of [0.35, 0.85]) group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 10), retroMaterial('dt_cone', { color: 0x4a4a4e })).translateX(12.8).translateY(y).translateZ(-5.34).rotateX(Math.PI / 2));
  const solids = [solid(10, -2.0, 1.5, 0.8, 1.0), solid(12.8, -5.6, 0.7, 0.6)];
  solids.push(subwayEntrance(group, { x: -1.5, z: -2.4, rot: Math.PI / 2, name: 'FULTON ST' }));
  const J = CONFIG.jobsExtra;
  const interactables = [
    homeTrain(0.4, -2.4),
    { id: 'dt_jays', label: "Mr. Jay's", sub: 'clothes, sneakers, hats', x: -11, z: -5.2, radius: 1.5,
      unavailable: (gg) => { const m = minuteOfDay(gg.state.clock.m); return m < 10 * 60 || m > 21 * 60 ? 'closed · opens 10:00' : null; },
      action: (gg) => gg.goTo('jays', 'downtown') },
    { id: 'dt_relief', label: 'Civic Relief Program', sub: 'food credit · recertify in person · take a number', x: -3.5, z: -5.2, radius: 1.5,
      unavailable: (gg) => { const m = minuteOfDay(gg.state.clock.m); return m < 8 * 60 || m > 17 * 60 ? 'closed · 08:00 to 17:00' : null; },
      action: (gg) => gg.goTo('relief', 'downtown') },
    { id: 'dt_labor', label: 'Ready Hands day labor', sub: 'sign in, get sent somewhere, get paid', x: 4.0, z: -5.2, radius: 1.5,
      action: (gg) => gg.openModal({
        kicker: 'DOWNTOWN · READY HANDS', title: 'Day Labor',
        body: 'Plastic chairs, a TV playing a soap, and a dispatcher who calls names off a clipboard like a bingo caller who has given up on joy. "Moving job in Flatbush. Six hours. Lift with your knees."',
        choices: [job(gg, 'daylabor', 'Sign in and take the job.', `${J.daylabor.hours} h · ${money(J.daylabor.pay)} cash · hard on the back`), { label: 'Leave.', effect: () => {} }],
      }) },
    { id: 'dt_dogs', label: 'The hot dog cart', sub: `${money(2)} · with everything`, x: 10, z: -1.0, radius: 1.4,
      action: (gg) => { if (!gg.spendMoney(2, 'hot dog')) return; bump(gg.state, 'hunger', 24); bump(gg.state, 'morale', 3); gg.advance(10); gg.world?.playEat?.('hero', (n) => gg.audio?.sfx?.(n)); gg.toast('Onions, kraut, mustard, a little bit of the cart itself. Perfect.', 'good'); } },
  ];
  const npcs = [
    { kind: 'passer_m', x: -9, z: -1.4, walker: [-15, 15] },
    { kind: pick(['w2', 'w3', 'w17']), x: -2, z: -2.6, walker: [-15, 15] },
    { kind: 'passer_m2', x: 6, z: -0.6, walker: [-15, 15] },
    // Brooklyn foot traffic: men from Williamsburg on the way somewhere, and, some days, a pair of
    // Guardian Angles walking a patrol nobody asked for
    ...((minuteOfDay(g.state.clock.m) >= 420 && minuteOfDay(g.state.clock.m) < 1200) && Math.random() < 0.55 ? [{ kind: pick(['hasid', 'hasid2']), x: -5, z: -1.6, walker: [-15, 15] }] : []),
    ...(Math.random() < 0.35 ? [{ kind: 'angel_m', x: 3, z: -2.4, walker: [-15, 15] }, { kind: 'angel_f', x: 4.1, z: -2.4, walker: [-15, 15] }] : []),
    { kind: pick(['w5', 'w12', 'w18']), x: 0, z: -3.0, walker: [-15, 15] },
    { kind: 'clerk', x: 9.2, z: -2.6, rot: 0.3, still: true, act: 'talk' },
    { kind: 'tenant_m', x: 13.4, z: -4.8, rot: -0.4, still: true },
  ];
  return {
    group, title: 'Fulton St · Downtown',
    // the curb is not a wall on Fulton: Mo can step into the road, and the road has opinions
    bounds: { ...farBounds, maxZ: 7.9 }, camBounds: farCam, traffic: { ...farTraffic, speeders: 0.2, chases: 0.5 }, solids,
    spawn: { x: 0.8, z: -2.4, rot: Math.PI / 2 },
    spawnFor: (from) => (from === 'jays' ? { x: -11, z: -4.4, rot: Math.PI } : from === 'relief' ? { x: -3.5, z: -4.4, rot: Math.PI } : { x: 0.8, z: -2.4, rot: Math.PI / 2 }),
    npcs, interactables, ambient: 'street',
    enterToast: 'Downtown. Every store is playing a different song at the same volume, and all of them are winning.',
  };
}

/** Mr. Jay's: whole outfits off the rack; what he buys waits in the closet at home. */
export function clothingMenu(g) {
  const s = g.state;
  const w = wardrobe.wardrobeState(s);
  const forSale = (CONFIG.outfits || []).filter((o) => o.price > 0);
  g.openModal({
    kicker: "DOWNTOWN · MR. JAY'S", title: 'The Racks',
    body: '"You look like a medium. You look like a medium that has had a week." Jay himself, gold chain, measuring tape round his neck like a stethoscope. Whatever you buy goes in the closet at home; you change there.',
    choices: [
      ...forSale.map((o) => ({
        label: `${o.name} · ${money(o.price)}`,
        sub: w.owned.includes(o.id) ? 'yours already · in the closet' : (o.note || 'off the rack'),
        disabled: w.owned.includes(o.id) || s.money < o.price,
        effect: () => { const r = wardrobe.buy(g, o.id); if (r.ok) { g.toast(`The ${o.name}, bagged. "Wear it out of here, you'll walk different."`, 'good'); clothingMenu(g); } },
      })),
      { label: 'Just looking.', sub: '', effect: () => {} },
    ],
  });
}

/* ================================================================== Kestrel Houses */

export function buildProjects(g) {
  const group = new THREE.Group();
  const L = 40;
  group.add(plane(L, 22, { name: 'pj_ground', map: tex('concrete'), color: 0x8a8880, repeat: [12, 7] }, [0, 0, -2], [-Math.PI / 2, 0, 0]));
  // the towers: tall brick slabs with a grid of windows and a lit lobby each
  const tower = (x, z, w, h, rot = 0) => {
    const t = new THREE.Group();
    t.position.set(x, 0, z);
    t.rotation.y = rot;
    t.add(box(w, h, 6, retroMaterial('pj_tower', { map: tex('brick'), color: 0x9a5a44 }), [0, h / 2, 0]));
    for (let r = 0; r < Math.floor(h / 2.2); r++) for (let c = 0; c < Math.floor(w / 1.8); c++) {
      t.add(plane(0.7, 0.9, { name: 'pj_win', map: tex('window'), emissive: Math.random() < 0.45 ? 0.5 : 0.06, unlit: true }, [-w / 2 + 0.9 + c * 1.8, 1.6 + r * 2.2, 3.02]));
    }
    t.add(box(2.6, 2.9, 0.1, retroMaterial('pj_lobbyframe', { color: 0x2a2a2e }), [0, 1.45, 3.03]));
    t.add(box(2.0, 2.4, 0.12, retroMaterial('pj_lobby', { color: 0xc8b878, emissive: 0.3, unlit: true }), [0, 1.2, 3.05]));
    t.add(box(0.06, 2.4, 0.14, retroMaterial('pj_lobbybar', { color: 0x2a2a2e }), [0, 1.2, 3.06]));
    group.add(t);
  };
  tower(-12, -12, 12, 30);
  tower(10, -12, 12, 26);
  tower(-20, 1, 10, 22, Math.PI / 2);
  // the courtyard: benches in a square, chain-link round a cracked court, a playground, a lamp
  const benchM = retroMaterial('pj_bench', { color: 0x3a6a4a });
  const solids = [];
  for (const [x, z, r] of [[-4, -3, 0], [4, -3, 0], [-4, 2.5, Math.PI], [4, 2.5, Math.PI]]) {
    const b = new THREE.Group();
    b.position.set(x, 0, z);
    b.rotation.y = r;
    b.add(box(2.4, 0.08, 0.45, benchM, [0, 0.45, 0]));
    b.add(box(2.4, 0.45, 0.06, benchM, [0, 0.72, -0.22]));
    group.add(b);
    solids.push(solid(x, z, 2.4, 0.6, 0.9));
  }
  // the half-court: chain-link all round with the gate on the west side, a real hoop, and a game
  const hoops = buildCourt(group, solids);
  for (const x of [-8, 0, 8]) { group.add(box(0.14, 4.4, 0.14, M.steel, [x, 2.2, 6])); group.add(box(0.5, 0.1, 0.3, M.lit, [x, 4.4, 5.8])); }
  // graffiti on the low wall, a burnt mattress, a shopping cart
  group.add(box(14, 1.2, 0.3, M.conc, [0, 0.6, 8.6]));
  group.add(plane(4, 0.9, { name: 'pj_graf', map: signTex('pjGraf', [{ text: 'KESTREL HOUSES 4 LIFE', color: '#e8462a', size: 9 }], { w: 128, h: 28, bg: '#7a7a74', border: '#7a7a74' }), unlit: true, emissive: 0.4 }, [-2, 0.7, 8.44], [0, Math.PI, 0]));
  group.add(box(1.8, 0.2, 1.0, retroMaterial('pj_mat', { color: 0x3a3028 }), [-14, 0.1, 5]));
  solids.push(solid(0, 8.6, 14, 0.4, 1.2));
  solids.push(subwayEntrance(group, { x: 14, z: -4.5, rot: 0, name: 'KESTREL HOUSES' }));

  const armedHere = Math.random() < 0.6;
  const npcs = [
    { kind: 'benchman', x: 4, z: -2.5, rot: Math.PI, still: true, act: 'talk' },
    { kind: 'thug', x: -4, z: -2.6, rot: Math.PI, still: true },
    { kind: armedHere ? 'thug_armed' : 'thug', x: 7, z: 0.5, rot: -Math.PI / 2, still: true, act: 'smoke' },
    ...(g.state.flags?.pjDealerDown === dayOf(g.state.clock.m) ? [] : [{ kind: 'thug_armed', x: -10, z: 4, rot: Math.PI / 2, still: true }]),
    { kind: 'junkie', x: -14.5, z: 4.6, rot: 0.3, still: true, pose: 'sit' },
    { kind: 'tenant_f', x: -2, z: 5, walker: [-15, 10] },
    { kind: 'drifter', x: 2, z: 4.6, rot: 0, still: true, act: 'dice' },
    { kind: 'squeak', x: 3.2, z: 4.0, rot: -0.6, still: true, act: 'watch' },
  ];
  const interactables = [
    { id: 'pj_train', label: 'Take the K train', sub: `out of here · ${money(SUB().fare)}`, x: 14, z: -2.9, radius: 1.8, action: (gg) => boardMenu(gg, 'projects') },
    { id: 'pj_bench', label: 'The man on the bench', sub: 'he sells what Dex sells, and it is not cut', x: 4, z: -1.6, radius: 1.5, action: (gg) => benchDealer(gg) },
    { id: 'pj_court', label: 'The half-court', sub: 'two-on-two · winners stay on', x: COURT.x0 - 0.9, z: COURT.gateZ, radius: 1.4, action: (gg) => courtMenu(gg) },
    { id: 'pj_north', label: 'Into the North Tower', sub: 'six floors · stairs only', x: -12, z: -7.6, radius: 1.5, action: (gg) => { const h = housesState(gg.state); h.tower = 'north'; h.floor = 0; gg.goTo('pjtower', 'projects'); } },
    { id: 'pj_east', label: 'Into the East Tower', sub: 'six floors · stairs only', x: 10, z: -7.6, radius: 1.5, action: (gg) => { const h = housesState(gg.state); h.tower = 'east'; h.floor = 0; gg.goTo('pjtower', 'projects'); } },
    { id: 'pj_post', label: 'Post up on the bench', sub: 'an hour · high risk, high reward', x: -4, z: -2.0, radius: 1.5, seat: { x: -4, z: -2.95, rot: 0 }, action: (gg) => postUp(gg) },
  ];
  // after dark one of the women from upstairs is out front of her tower, smoking, which is how
  // most men find out the towers have them at all; the tower doors say whose light is on
  const pm = minuteOfDay(g.state.clock.m);
  if (pm >= 17 * 60 || pm < 5 * 60) {
    const ids = Object.keys(WOMEN);
    const id = ids[dayOf(g.state.clock.m) % ids.length];
    const w = WOMEN[id];
    const tx = w.tower === 'east' ? 10 : -12;
    npcs.push({ kind: w.kind, x: tx + 1.7, z: -6.4, rot: Math.PI * 0.85, still: true, act: 'smoke', talk: `pj_woman_${id}` });
    interactables.push({ id: `pj_woman_${id}`, label: `Talk to ${w.name}`, sub: `smoking out front · lives in ${w.door}`, x: tx + 1.7, z: -6.0, radius: 1.3, action: (gg) => womanMenu(gg, id) });
    for (const it of interactables) {
      const tower = it.id === 'pj_north' ? 'north' : it.id === 'pj_east' ? 'east' : null;
      if (!tower) continue;
      const doors = Object.values(WOMEN).filter((x) => x.tower === tower).map((x) => x.door);
      if (doors.length) it.sub = `six floors · a light on in ${doors.join(' and ')}`;
    }
  }
  let trouble = 30 + Math.random() * 30;
  const tick = (gg, dt, world) => {
    hoops.update(dt);
    trouble -= dt;
    if (trouble > 0 || gg.uiBusy) return;
    trouble = 50 + Math.random() * 40;
    const m = minuteOfDay(gg.state.clock.m);
    if ((m >= 20 * 60 || m < 5 * 60) && Math.random() < 0.5) confrontation(gg, world);
    else gg.toast(pick([
      'Somebody yells a name from the ninth floor. Three different people answer.',
      'A kid on a scooter does a full lap of the courtyard staring at you the whole time.',
      'The elevator in the far tower has been "out" since spring. The stairs smell like a decision.',
      'An old lady on a lawn chair by the lobby nods at you. That nod means more here than you know.',
    ]), 'info');
  };
  return {
    group, title: 'Kestrel Houses',
    seats: [{ x: -4, z: 2.45, rot: Math.PI, label: 'Sit on the bench' }, { x: 4, z: 2.45, rot: Math.PI, label: 'Sit on the bench' }],
    bounds: { minX: -16, maxX: 18, minZ: -8, maxZ: 7.6 },
    camBounds: { minX: -18, maxX: 20, minZ: -8.5, maxZ: 9 },
    solids,
    spawn: { x: 14, z: -2.4, rot: Math.PI },
    spawnFor: (from) => (from === 'pjtower' ? (housesState(g.state).tower === 'east' ? { x: 10, z: -6.9, rot: 0 } : { x: -12, z: -6.9, rot: 0 }) : { x: 14, z: -2.4, rot: Math.PI }),
    npcs, interactables, tick, ambient: 'street',
    enterToast: 'Kestrel Houses. Everybody here already knows you are not from here.',
  };
}

/** The half-court: watch, or ask for next and get run off it. */
function courtMenu(g) {
  const s = g.state;
  const m = minuteOfDay(s.clock.m);
  g.openModal({
    kicker: 'KESTREL HOUSES · THE HALF-COURT',
    title: 'Winners Stay On',
    body: 'Two-on-two, one basket, no refs, and a rim that has been bent since the Clinton administration. The man in the white tank calls his own fouls and wins every argument about them.',
    choices: [
      { label: 'Watch a few possessions.', sub: '15 min · +morale · -stress', effect: () => { g.advance(15); bump(s, 'morale', 3); bump(s, 'stress', -4); g.toast(pick(['A crossover so mean the defender apologises to the fence.', 'Somebody banks one in off the backboard and calls it. Nobody believes him.', 'The ball goes over the fence. A kid on the other side throws it back without being asked.']), 'info'); } },
      { label: 'Ask for next.', sub: s.stats.energy < 25 ? 'too tired' : '45 min · -energy · +morale · $5 a game', disabled: s.stats.energy < 25 || s.money < 5 || m < 7 * 60,
        effect: () => {
          g.spendMoney(5, 'pickup game');
          g.advance(45);
          bump(s, 'energy', -14);
          bump(s, 'stress', -8);
          const won = Math.random() < 0.35;
          if (won) { g.earnMoney(10, 'won at the half-court'); bump(s, 'morale', 10); g.toast('You hit two in a row from the elbow and the court goes quiet. Winners stay on. You have to leave anyway, your knees have voted.', 'good'); }
          else { bump(s, 'morale', 3); g.toast('Seven to two. They were nice about it, which is worse. "Come back when you have legs."', 'info'); }
        } },
      { label: 'Keep walking.', sub: '', effect: () => {} },
    ],
  });
}

/** Uncut, the strong stuff, cheaper than Dex because the bench does not pay rent. */
function benchDealer(g) {
  const s = g.state;
  const P = SUB().benchPrices;
  g.openModal({
    kicker: 'KESTREL HOUSES · THE BENCH', title: 'The Man on the Bench',
    body: '"You lost? No? Then you know what this is." He does not stand up. Standing up is for people with something to prove.\n\nThis is a fictional substance that exists only in this game. Uncut product carries far more risk.',
    choices: [
      ...Object.entries(P).map(([id, price]) => ({
        label: `${CONFIG.items[id].name} · ${money(price)}`, sub: 'uncut · much more risk',
        disabled: s.money < price,
        effect: () => { if (!g.spendMoney(price, 'the bench')) return; addItem(s, id, 1); bump(s, 'risk', 2); g.toast('It goes from his hand to yours without either of you looking at it.', 'info'); },
      })),
      { label: 'Walk away.', sub: '', effect: () => {} },
    ],
  });
}

/**
 * Posting up: an hour on the bench, and the courtyard decides. Sometimes somebody needs a
 * lookout and pays well; sometimes somebody decides he is the problem.
 */
function postUp(g) {
  const s = g.state;
  g.advance(60);
  bump(s, 'stress', 4);
  const r = Math.random();
  if (r < 0.35) {
    const pay = randInt(60, 140);
    g.openModal({
      kicker: 'KESTREL HOUSES', title: 'A Job',
      body: `A kid with a pager sits down next to you without looking at you. "Watch the corner for an hour. Whistle if a car you don't know slows down. ${money(pay)}."`,
      choices: [
        { label: 'Watch the corner.', sub: `1 h · ${money(pay)} · risky`, effect: () => {
          g.advance(60);
          if (Math.random() < 0.2) { g.toast('A car you don\'t know slows down. You whistle. Everybody vanishes, including the kid with your money.', 'bad'); bump(s, 'stress', 10); return; }
          g.earnMoney(pay, 'lookout'); bump(s, 'risk', 4); g.toast('Nothing happens, which is the job. He pays you in small bills and leaves.', 'good');
        } },
        { label: 'Say no.', sub: '', effect: () => {} },
      ],
    });
  } else if (r < 0.65) {
    confrontation(g, g.world);
  } else {
    bump(s, 'morale', 2);
    g.toast(pick(['An hour of nobody bothering you. The pigeons have a whole society going.', 'You learn the names of four people and the business of none of them.']), 'info');
  }
}

/**
 * Somebody walks up. Some of them have a gun. Paying is the safe thing; walking off is a roll;
 * fighting an armed man is how this game ends, sometimes.
 */
export function confrontation(g, world) {
  const s = g.state;
  const armed = Math.random() < SUB().armedChance;
  g.openModal({
    kicker: 'KESTREL HOUSES · NIGHT', title: armed ? 'He Lifts His Shirt' : 'You Lost?',
    body: armed
      ? '"You keep coming round here." He lifts the front of his shirt just enough. The handle of a gun. He does not touch it. He does not have to.'
      : '"You lost, or you looking to get lost?" Two of them, and the second one is cracking his knuckles like it is a hobby.',
    choices: [
      { label: 'Hand over some cash.', sub: 'about a quarter of it', effect: () => { const n = fights.payOff(g); g.toast(`$${n.toFixed(2)}. "Now go home."`, 'bad'); } },
      { label: 'Walk away, slowly.', sub: armed ? 'a roll' : 'probably fine', effect: () => {
        if (Math.random() < (armed ? 0.6 : 0.85)) { g.toast('You walk. Nobody follows. Your back does not believe it until the stairs.', 'info'); return; }
        startStreetFight(g, world, armed);
      } },
      { label: 'Fight.', sub: armed ? 'against a man with a gun' : 'two of them', effect: () => startStreetFight(g, world, armed) },
    ],
  });
}

/** A fight in the Houses: the meter, a tough opponent, and if he is armed and Mo loses, the end. */
function startStreetFight(g, world, armed) {
  const kind = armed ? 'thug_armed' : 'thug';
  const tough = fights.toughness(kind);
  const fight = { hp: tough.hp };
  meter(g).open({
    hp: fight.hp, zone: tough.zone, title: armed ? 'HE HAS A GUN' : 'FIGHT',
    onSwing: (landed) => fights.exchange(g, fight, landed, { quietWin: true }),
    done: (result) => {
      if (result === 'won') {
        fights.knockout(g, kind);
        const loot = fights.lootFor(kind);
        if (loot.cash) g.earnMoney(loot.cash, 'his pockets');
        for (const it of loot.items) addItem(g.state, it, 1);
        const names = loot.items.map((i) => CONFIG.items[i]?.name).filter(Boolean);
        g.openModal({
          kicker: 'KESTREL HOUSES', title: 'He Is Down',
          body: `${money(loot.cash)}${names.length ? `, ${names.join(', ')}` : ''}, out of his pockets.${armed ? '\n\nThe gun is on the ground next to him. You look at it for a long second.\n\n"Live by the gun, die by the gun. And I like living. This isn\'t for me."\n\nYou leave it where it is.' : ''}`,
          choices: [{ label: 'Get out of the courtyard.', effect: () => {} }],
        });
        return;
      }
      if (armed && Math.random() < SUB().shotChance) { g.deathSequence?.('shot'); return; }
      const r = fights.robbed(g);
      g.toast(`You go down hard. ${r.cash ? `They took $${r.cash.toFixed(2)}.` : 'They took nothing because there was nothing.'}`, 'bad');
      g.collapseSequence?.('beaten');
    },
  });
}

/* ================================================================== the Tunnel */

export function buildFightClub(g) {
  const group = new THREE.Group();
  const W = 16, D = 11, H = 3.4;
  group.add(plane(W, D, { name: 'fc_floor', map: tex('concrete'), color: 0x6a665e, repeat: [6, 4] }, [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(plane(W, D, { name: 'fc_ceil', color: 0x1a1a1a }, [0, H, 0], [Math.PI / 2, 0, 0]));
  for (const [x, z, w, d] of [[0, -D / 2, W, 0.3], [0, D / 2, W, 0.3], [-W / 2, 0, 0.3, D], [W / 2, 0, 0.3, D]]) group.add(box(w, H, d, M.tileDark, [x, H / 2, z]));
  // the old platform edge along the back, with dead tracks beyond a chain
  group.add(plane(3.6, 0.5, { name: 'fc_band', map: signTex('fcBand', [{ text: 'KESTREL ST · LOWER LEVEL', color: '#c8c0a8', size: 9 }], { w: 128, h: 20, bg: '#2a3a2e', border: '#8a8a6a' }), unlit: true, emissive: 0.3 }, [-4, 2.4, -D / 2 + 0.17]));
  // the ring: pallets for a floor, posts and rope
  const ring = new THREE.Group();
  ring.position.set(0, 0, -0.8);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) ring.add(box(1.15, 0.14, 1.15, M.wood, [-1.75 + i * 1.17, 0.07, -1.75 + j * 1.17]));
  for (const [x, z] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) ring.add(box(0.12, 1.4, 0.12, retroMaterial('fc_post', { color: 0xa82a26 }), [x, 0.7, z]));
  const rope = retroMaterial('fc_rope', { color: 0xe8e2d0 });
  for (const y of [0.7, 1.15]) {
    ring.add(box(4.8, 0.03, 0.03, rope, [0, y, -2.4])); ring.add(box(4.8, 0.03, 0.03, rope, [0, y, 2.4]));
    ring.add(box(0.03, 0.03, 4.8, rope, [-2.4, y, 0])); ring.add(box(0.03, 0.03, 4.8, rope, [2.4, y, 0]));
  }
  group.add(ring);
  // bare bulbs on wires, a card table with the cashbox
  for (const [x, z] of [[-1.2, -1.2], [1.2, -0.4], [0, 0.6], [-5, 3], [5, 3]]) {
    group.add(box(0.01, 0.9, 0.01, M.black, [x, H - 0.45, z]));
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), M.lit).translateX(x).translateY(H - 0.95).translateZ(z));
  }
  group.add(box(1.4, 0.75, 0.8, M.wood, [5.5, 0.375, 3.2]));
  group.add(box(0.4, 0.2, 0.3, M.steel, [5.5, 0.85, 3.2]));
  const solids = [solid(5.5, 3.2, 1.4, 0.8, 0.8)];
  const npcs = [
    { kind: 'tenant_m', x: -3.6, z: -0.8, rot: Math.PI / 2, still: true, act: 'watch' },
    { kind: 'passer_m', x: 3.6, z: -1.6, rot: -Math.PI / 2, still: true, act: 'watch' },
    { kind: 'drifter', x: -3.4, z: 1.4, rot: Math.PI / 2 + 0.4, still: true, act: 'watch' },
    { kind: 'squeak', x: 3.4, z: 0.8, rot: -Math.PI / 2 - 0.3, still: true, act: 'watch' },
    { kind: 'junkie', x: 0.4, z: 2.6, rot: Math.PI, still: true, act: 'watch' },
    { kind: 'rolo', x: 5.5, z: 3.9, rot: Math.PI, still: true, act: 'talk' },
    { kind: 'boxer', x: 0, z: -1.6, rot: 0, still: true },
  ];
  const interactables = [
    { id: 'fc_ring', label: 'Step into the ring', sub: 'one fight a night · knock him out, get paid', x: 0, z: 0.9, radius: 1.6,
      unavailable: (gg) => pitReason(gg), action: (gg) => pitFight(gg) },
    { id: 'fc_bookie', label: 'The bookie', sub: 'how the purse works', x: 5.5, z: 2.4, radius: 1.4, action: (gg) => gg.openModal({
      kicker: 'THE TUNNEL', title: 'The Bookie',
      body: `"One fight a night. You knock him out, you get the purse, ${money(SUB().pit.purse)} and it goes up every time you win. He knocks you out, you get a ride to the clinic and a story nobody believes. No gloves, no biting, no weapons, no crying."`,
      choices: [{ label: 'Got it.', effect: () => {} }],
    }) },
    { id: 'fc_exit', label: 'Back up to the platform', sub: '', x: -W / 2 + 1.4, z: D / 2 - 1.4, radius: 1.3, action: (gg) => gg.goTo('subway', 'fightclub') },
  ];
  return {
    group, title: 'The Tunnel',
    bounds: { minX: -W / 2 + 0.4, maxX: W / 2 - 0.4, minZ: -D / 2 + 0.4, maxZ: D / 2 - 0.4 },
    solids, spawn: { x: -W / 2 + 1.8, z: D / 2 - 1.8, rot: Math.PI * 0.75 },
    npcs, interactables, interior: true, ambient: 'street',
    enterToast: 'The Tunnel. A dead platform, a ring of pallets, a crowd that smells like a decision, and somebody already bleeding.',
  };
}

function pitState(s) {
  if (!s.pit) s.pit = { wins: 0, losses: 0, lastNight: -1 };
  return s.pit;
}
const nightOf = (s) => { const m = s.clock.m; return Math.floor((m - 6 * 60) / 1440); };

function pitReason(g) {
  const s = g.state;
  if (pitState(s).lastNight === nightOf(s)) return 'you already fought tonight';
  if (s.stats.energy < 25) return 'too tired · they will not let you in like that';
  return null;
}

export function pitPurse(s) {
  const P = SUB().pit;
  return Math.min(P.maxPurse, P.purse + pitState(s).wins * P.raise);
}

function pitFight(g) {
  const s = g.state;
  const p = pitState(s);
  const w = g.world;
  const hp = Math.min(7, 4 + Math.floor(p.wins / 2));
  const zone = Math.max(0.1, 0.17 - p.wins * 0.01);
  const fight = { hp };
  const purse = pitPurse(s);
  g.toast(`The crowd closes in. The bookie holds up ${money(purse)} so everybody can see it.`, 'info');
  meter(g).open({
    hp, zone, title: `THE TUNNEL · ${money(purse)}`,
    onSwing: (landed) => fights.exchange(g, fight, landed, { quietWin: true }),
    done: (result) => {
      p.lastNight = nightOf(s);
      if (result === 'won') {
        p.wins += 1;
        g.earnMoney(purse, 'the Tunnel');
        bump(s, 'morale', 10);
        bump(s, 'stress', -6);
        bump(s, 'energy', -10);
        logLine(g, `Won in the Tunnel: ${money(purse)}.`, 'good');
        g.openModal({ kicker: 'THE TUNNEL', title: 'Knockout', body: `He goes down and the room goes up. Somebody presses ${money(purse)} into your hand, wet, and slaps your back like they had money on you. They did.\n\nRecord: ${p.wins}-${p.losses}.`, choices: [{ label: 'Take the money.', effect: () => {} }] });
        return;
      }
      p.losses += 1;
      logLine(g, 'Knocked out in the Tunnel.', 'bad');
      g.collapseSequence?.('beaten');
    },
  });
}
