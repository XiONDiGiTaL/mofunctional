/**
 * The HailMary car: a black town car that pulls up at the curb when the ride arrives, idles there
 * with its lights on, and pulls away when the ride is over (Mo got in, or gave up on).
 *
 * Like DealerWalker, it never pops in while Mo is watching the spot: on a fresh load it is simply
 * parked there; if it arrives while he is outside, it drives in from the east end of the road.
 * The interaction ("Get in the black car") sits on the sidewalk beside it.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box } from '../render/retro.js';
import { rideState, DESTINATIONS, fareTo, tooClose, ride } from '../systems/rides.js';
import { money } from '../core/util.js';
import { buildVehicle } from './vehicles.js';
import { ROAD } from './plan.js';

const LANE_Z = ROAD.parkNearZ;

/** The HailMary car: a black sedan with a pink light-up placard in the windshield. */
function buildCar() {
  const g = buildVehicle('sedan', 0x0e0f12);
  g.add(box(0.04, 0.16, 0.5, retroMaterial('car_placard', { color: 0xff6ab0, emissive: 1.2, unlit: true }), [0.95, 1.05, 0.25]));
  return g;
}

export class RideCar {
  constructor(world) {
    this.world = world;
    this.car = null;
    this.interact = null;
    this.leaving = false;
    this.targetX = 0;
  }

  /** Called on area load (fresh) and every frame. */
  sync(g, fresh = false) {
    const w = this.world;
    const r = rideState(g.state);
    const here = r.area === w.areaId;
    const waiting = r.status === 'waiting' && here;
    if (waiting && !this.car) this.spawn(g, r, fresh);
    if (this.car && !this.leaving && !waiting) this.leave();
  }

  spawn(g, r, inPlace) {
    const w = this.world;
    this.car = buildCar();
    const b = w.area.camBounds || w.area.bounds;
    this.targetX = r.x;
    this.car.position.set(inPlace ? r.x : b.maxX + 4, 0, LANE_Z);
    w.root.add(this.car);
    this.leaving = false;
    this.interact = {
      id: 'ridecar', label: 'Get in the black car', sub: `HailMary · ${r.driver}`, x: r.x, z: 0.9, radius: 1.8,
      action: (gg) => rideMenu(gg),
    };
    w.interactables.push(this.interact);
    // to the camera the parked car is a wall: the arm stops short of it instead of looking at
    // Mo through the roof
    this.solid = { x: r.x, z: LANE_Z, w: 4.2, d: 1.8, h: 1.6, camOnly: true };
    w.area.solids = w.area.solids || [];
    w.area.solids.push(this.solid);
  }

  leave() {
    this.leaving = true;
    if (this.solid) {
      const list = this.world.area?.solids || [];
      const i = list.indexOf(this.solid);
      if (i >= 0) list.splice(i, 1);
      this.solid = null;
    }
    const b = this.world.area.camBounds || this.world.area.bounds;
    this.targetX = b.minX - 6;
    if (this.interact) {
      const list = this.world.interactables;
      const i = list.indexOf(this.interact);
      if (i >= 0) list.splice(i, 1);
      this.interact = null;
    }
  }

  remove() {
    if (this.interact) this.leave();
    if (this.car?.parent) this.car.parent.remove(this.car);
    this.car = null;
    this.leaving = false;
  }

  update(dt) {
    if (!this.car) return;
    const p = this.car.position;
    const dx = this.targetX - p.x;
    const speed = this.leaving ? 9 : Math.min(9, 1.2 + Math.abs(dx) * 1.4); // brakes as it pulls in
    if (Math.abs(dx) > 0.05) p.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
    this.car.rotation.y = this.leaving || dx < 0 ? Math.PI : 0;
    if (this.leaving && Math.abs(dx) < 0.1) this.remove();
  }
}

/** Inside the car: where to. */
export function rideMenu(g) {
  const r = rideState(g.state);
  g.openModal({
    kicker: `HAILMARY · ${String(r.driver || '').toUpperCase()}`,
    title: 'Where To?',
    body: `${r.driver} does not turn around. The car smells like a pine tree that has given up and a radio is playing a ballgame very quietly.\n\n"Where to, chief."`,
    choices: [
      ...DESTINATIONS.map((d) => {
        const close = tooClose(g, d);
        const fare = fareTo(g, d);
        return {
          label: d.name, sub: close ? 'right around here' : `${money(fare)}`,
          disabled: !close && g.state.money < fare,
          effect: () => {
            const res = ride(g, d.id);
            if (!res) return;
            if (res.refused) {
              g.openModal({ kicker: 'HAILMARY', title: 'He Does Not Start the Car', body: `${res.line}\n\nHe keeps the stop fee anyway. He is still at the curb if you want to go somewhere real.`, choices: [{ label: 'Fine.', effect: () => {} }] });
            } else if (res.broke) {
              g.toast('"That\'s more than you got, chief."', 'bad');
            } else {
              g.toast(res.line, 'info');
            }
          },
        };
      }),
      { label: 'Step back out.', sub: 'he waits a little longer', effect: () => {} },
    ],
  });
}
