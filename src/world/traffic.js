/**
 * Traffic: cars that come down the street, keep their distance, and go.
 *
 * Two lanes, eastbound near the curb and westbound beyond it. Every few seconds a car (a random
 * model and colour, now and then the B44) enters at one end and drives to the other. A car keeps a
 * gap to the one in front of it, and stops for Mo when he is standing in its lane ahead of it —
 * a beat, then the horn, then the horn again, then it goes on its way when he gets out of the road.
 * Every car is solid: it carries a moving collision box in the area's solids, so Mo cannot walk
 * through traffic, and the camera (which ignores low solids) does not jerk around passing cars.
 */
import { randomCar, buildVehicle } from './vehicles.js';

export class Traffic {
  /** cfg: { lanes: [{ z, dir }], x0, x1, rate: [min, max] seconds, bus: chance } */
  constructor(world, cfg) {
    this.world = world;
    this.cfg = cfg;
    this.cars = [];
    this.timer = 0.5;
    this.honkCool = 0;
    // a couple already on the road when he arrives, so the street does not start empty
    for (let i = 0; i < 2; i++) this.spawn(cfg.x0 + (cfg.x1 - cfg.x0) * (0.25 + i * 0.45));
  }

  /** A particular vehicle (the patrol car) instead of a random one. */
  spawnSpecial(type) {
    this.special = type;
    this.spawn();
    this.special = null;
  }

  spawn(atX = null) {
    const { lanes, x0, x1 } = this.cfg;
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    const startX = atX ?? (lane.dir > 0 ? x0 - 6 : x1 + 6);
    // do not drop a car on top of another in its lane
    if (!this.chase && this.cars.some((c) => c.lane === lane && Math.abs(c.x - startX) < 9)) return null;
    const bus = !this.special && Math.random() < (this.cfg.bus ?? 0.06);
    // somebody late for something: a fast car, flat out, that brakes for nothing it has not seen
    // for a second already
    const fast = !this.special && !bus && (this.forceFast || Math.random() < (this.cfg.speeders ?? 0));
    const mesh = this.special ? buildVehicle(this.special) : bus ? buildVehicle('bus') : fast ? buildVehicle(Math.random() < 0.5 ? 'gt' : 'coupe', [0xc8121a, 0xf2f2f0, 0x141416, 0xe8c41e][Math.floor(Math.random() * 4)]) : randomCar();
    mesh.rotation.y = lane.dir > 0 ? 0 : Math.PI;
    mesh.position.set(startX, 0, lane.z);
    this.world.root.add(mesh);
    const len = mesh.userData.len, width = mesh.userData.width;
    const solid = { x: startX, z: lane.z, w: len, d: width, h: 1.4, moving: true };
    this.world.area.solids = this.world.area.solids || [];
    this.world.area.solids.push(solid);
    const cruise = this.chase ? 17 : fast ? 14 + Math.random() * 5 : bus ? 5.2 : this.special === 'police' ? 3.2 : 6.5 + Math.random() * 3.5;
    const car = { mesh, lane, x: startX, speed: cruise, cruise, len, solid, stopped: 0, honked: 0, bus, fast: fast || !!this.chase, chase: !!this.chase };
    this.cars.push(car);
    return car;
  }

  /** A car doing sixty down the block with a cruiser on its bumper, siren and all. */
  spawnChase(g) {
    const { lanes, x0, x1 } = this.cfg;
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    if (this.cars.some((c) => c.lane === lane && Math.abs(c.x - (lane.dir > 0 ? x0 : x1)) < 25)) return false;
    this.forceFast = true;
    this.chase = true;
    const runner = this.spawnInLane(lane, lane.dir > 0 ? x0 - 6 : x1 + 6, null);
    this.forceFast = false;
    const cop = this.spawnInLane(lane, lane.dir > 0 ? x0 - 16 : x1 + 16, 'police');
    this.chase = false;
    if (!runner || !cop) return false;
    let n = 0;
    const siren = setInterval(() => { g.audio?.sfx?.('alarm'); if (++n > 5) clearInterval(siren); }, 380);
    g.toast(['A car comes down the block doing sixty with a cruiser on its bumper, siren going, everybody on the sidewalk stepping back at once.', 'Tyres, a siren, and two cars through the intersection like the light is a suggestion. Somebody on the corner starts betting on the first one.'][Math.floor(Math.random() * 2)], 'info');
    return true;
  }

  spawnInLane(lane, startX, special) {
    const keep = this.cfg.lanes;
    this.cfg = { ...this.cfg, lanes: [lane] };
    this.special = special;
    const car = this.spawn(startX);
    this.special = null;
    this.cfg = { ...this.cfg, lanes: keep };
    return car;
  }

  remove() {
    for (const c of this.cars) this.drop(c);
    this.cars = [];
  }

  drop(c) {
    c.mesh.parent?.remove(c.mesh);
    const list = this.world.area?.solids || [];
    const i = list.indexOf(c.solid);
    if (i >= 0) list.splice(i, 1);
  }

  update(dt, g) {
    const { x0, x1, rate } = this.cfg;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = rate[0] + Math.random() * (rate[1] - rate[0]);
      this.spawn();
    }
    this.honkCool = Math.max(0, this.honkCool - dt);
    // now and then, a chase
    if (this.cfg.chases) {
      this.chaseTimer = (this.chaseTimer ?? 40 + Math.random() * 60) - dt;
      if (this.chaseTimer <= 0) { this.chaseTimer = 70 + Math.random() * 90; if (Math.random() < this.cfg.chases) this.spawnChase(g); }
    }
    const mo = this.world.mo.root.position;
    const gone = [];
    for (const c of this.cars) {
      const d = c.lane.dir;
      // what is ahead: the nearest car in this lane, and Mo if he is standing in it
      let gap = Infinity;
      for (const o of this.cars) {
        if (o === c || o.lane !== c.lane) continue;
        const ahead = (o.x - c.x) * d;
        if (ahead > 0) gap = Math.min(gap, ahead - (o.len + c.len) / 2);
      }
      let moAhead = Infinity;
      if (Math.abs(mo.z - c.lane.z) < 1.5) {
        const ahead = (mo.x - c.x) * d - c.len / 2;
        if (ahead > -0.5) moAhead = ahead;
      }
      // a fast car brakes for Mo only if he stepped out just now; a man who has been standing in
      // the road for a while is, to a man doing sixty, part of the road
      const ignoresMo = c.fast && (this.world.roadT || 0) > 1.2;
      const blockAt = Math.min(gap - 2.0, ignoresMo ? Infinity : moAhead - 1.6);
      // ease toward cruise, brake hard for whatever is in front
      const want = blockAt <= 0 ? 0 : blockAt < 8 ? c.cruise * (blockAt / 8) : c.cruise;
      c.speed += (want - c.speed) * Math.min(1, dt * (want < c.speed ? 6 : 1.5));
      if (c.speed < 0.05) c.speed = 0;
      c.x += d * c.speed * dt;
      c.mesh.position.x = c.x;
      if (c.speed > 4 && !this.world.flung) {
        const w = c.mesh.userData.width || 1.8;
        if (Math.abs(mo.z - c.lane.z) < w / 2 + 0.25 && Math.abs(mo.x - c.x) < c.len / 2 + 0.25) this.world.hitByCar?.(g, c);
      }
      c.solid.x = c.x;
      // the light bar: red, blue, red, blue
      const flash = c.mesh.userData.flash;
      if (flash) { const on = Math.floor(performance.now() / 260) % 2; flash[0].visible = !!on; flash[1].visible = !on; }
      // stopped for Mo: wait a beat, then lean on the horn
      if (moAhead < 6 && c.speed < 0.3) {
        c.stopped += dt;
        if (c.stopped > 0.9 && c.honked < 3 && this.honkCool <= 0) {
          c.honked += 1;
          this.honkCool = 1.6;
          g.audio?.sfx?.(c.honked === 1 ? 'honk2' : 'honk');
          if (c.honked === 2) g.toast(pickLine(c), 'info');
        }
      } else if (moAhead >= 6) {
        c.stopped = 0;
        c.honked = 0;
      }
      if ((d > 0 && c.x > x1 + 8) || (d < 0 && c.x < x0 - 8)) gone.push(c);
    }
    for (const c of gone) { this.drop(c); this.cars.splice(this.cars.indexOf(c), 1); }
  }
}

const YELLS = [
  '"GET OUTTA THE ROAD!"',
  '"HEY! I\'M WALKIN\' HERE— no wait, I\'M DRIVIN\' HERE!"',
  '"You want to die on KESTREL? Pick a nicer street!"',
  '"MOVE IT, PAL!"',
  'The cab driver says something in three languages. You understand all of it.',
];
function pickLine(c) {
  return c.bus ? 'The B44 sighs at you with its whole body.' : YELLS[Math.floor(Math.random() * YELLS.length)];
}
