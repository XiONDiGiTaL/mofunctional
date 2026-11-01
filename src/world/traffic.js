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
    if (this.cars.some((c) => c.lane === lane && Math.abs(c.x - startX) < 9)) return;
    const bus = !this.special && Math.random() < (this.cfg.bus ?? 0.06);
    const mesh = this.special ? buildVehicle(this.special) : bus ? buildVehicle('bus') : randomCar();
    mesh.rotation.y = lane.dir > 0 ? 0 : Math.PI;
    mesh.position.set(startX, 0, lane.z);
    this.world.root.add(mesh);
    const len = mesh.userData.len, width = mesh.userData.width;
    const solid = { x: startX, z: lane.z, w: len, d: width, h: 1.4, moving: true };
    this.world.area.solids = this.world.area.solids || [];
    this.world.area.solids.push(solid);
    const cruise = bus ? 5.2 : this.special === 'police' ? 3.2 : 6.5 + Math.random() * 3.5;
    this.cars.push({ mesh, lane, x: startX, speed: cruise, cruise, len, solid, stopped: 0, honked: 0, bus });
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
      const blockAt = Math.min(gap - 2.0, moAhead - 1.6);
      // ease toward cruise, brake hard for whatever is in front
      const want = blockAt <= 0 ? 0 : blockAt < 8 ? c.cruise * (blockAt / 8) : c.cruise;
      c.speed += (want - c.speed) * Math.min(1, dt * (want < c.speed ? 6 : 1.5));
      if (c.speed < 0.05) c.speed = 0;
      c.x += d * c.speed * dt;
      c.mesh.position.x = c.x;
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
