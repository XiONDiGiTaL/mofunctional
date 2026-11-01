/**
 * The HailMary car: a black town car that pulls up at the curb when the ride arrives, idles there
 * with its lights on, and pulls away when the ride is over (Mo got in, or gave up on).
 *
 * Like DealerWalker, it never pops in while Mo is watching the spot: on a fresh load it is simply
 * parked there; if it arrives while he is outside, it drives in from the east end of the road.
 * The interaction ("Get in the black car") sits on the sidewalk beside it.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box, plane } from '../render/retro.js';
import { signTex } from '../render/signs.js';
import { CONFIG } from '../core/config.js';
import { rideState, DESTINATIONS, fareTo, tooClose, ride, noShowRide } from '../systems/rides.js';
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
    this.marker = null;
    this.flash = null;
    this.parked = false;
    this.waitT = 0;
    this.flashT = 0;
    this.lastCall = false;
    this.baseX = 0;
    this.grace = -1;
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
    // a low-poly arrow over the roof: a black car among black cars is not a landmark
    const yellow = retroMaterial('rideArrow', { color: 0xffd85a, emissive: 1.2, unlit: true });
    const marker = new THREE.Group();
    marker.add(box(0.1, 0.4, 0.1, yellow, [0, 0.32, 0]));
    marker.add(box(0.28, 0.28, 0.1, yellow, [0, 0.05, 0], [0, 0, Math.PI / 4]));
    marker.add(plane(1.3, 0.34, {
      name: 'rideGetIn',
      map: signTex('rideGetIn', [{ text: 'GET IN', color: '#1a1208', size: 14 }], { w: 96, h: 26, bg: '#ffe066', border: '#1a1208' }),
      emissive: 1, unlit: true,
    }, [0, 0.82, 0]));
    marker.position.set(0, 2.3, 0);
    marker.visible = !!inPlace;
    this.car.add(marker);
    this.marker = marker;
    // its own headlights, so it can flash them: the shared car material is used by every sedan
    const flashMat = retroMaterial('car_flash', { color: 0xfff6d0, emissive: 1.8, unlit: true });
    const flash = new THREE.Group();
    flash.add(box(0.07, 0.15, 0.36, flashMat, [2.44, 0.56, 0.6]));
    flash.add(box(0.07, 0.15, 0.36, flashMat, [2.44, 0.56, -0.6]));
    flash.visible = false;
    this.car.add(flash);
    this.flash = flash;
    this.flashT = 0;
    this.lastCall = false;
    this.driver = r.driver;
    this.baseX = r.x;
    this.grace = -1;
    this.speed = 0;
    this.parked = !!inPlace;
    this.waitT = 0;
    this.bob = 0;
    // to the camera the parked car is a wall: the arm stops short of it instead of looking at
    // Mo through the roof
    this.solid = { x: r.x, z: LANE_Z, w: 4.2, d: 1.8, h: 1.6, camOnly: true };
    w.area.solids = w.area.solids || [];
    w.area.solids.push(this.solid);
  }

  leave() {
    this.leaving = true;
    this.parked = false;
    if (this.marker) this.marker.visible = false;
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
    this.marker = null;
    this.flash = null;
    this.leaving = false;
    this.parked = false;
    this.waitT = 0;
    this.flashT = 0;
    this.lastCall = false;
    this.grace = -1;
  }

  update(dt, g) {
    if (!this.car) return;
    const p = this.car.position;
    const dx = this.targetX - p.x;
    // it pulls in and out under acceleration instead of hitting nine metres a second the frame it
    // spawns and then stopping dead, which read as a jump cut rather than a car
    const want = this.leaving ? 8.5 : Math.min(6, 1.2 + Math.abs(dx) * 0.5);
    this.speed = Math.min(want, (this.speed || 0) + (this.leaving ? 4 : 6) * dt);
    if (Math.abs(dx) > 0.05) p.x += Math.sign(dx) * Math.min(Math.abs(dx), this.speed * dt);
    else { p.x = this.targetX; this.speed = 0; }
    this.car.rotation.y = this.leaving || dx < 0 ? Math.PI : 0;
    // the prompt follows the car while it is rolling off, since the curb point is now behind it
    if (this.interact) this.interact.x = p.x;
    // parked: a honk, an arrow, and the engine idling until he gets in or the clock runs out
    const arrived = !this.leaving && Math.abs(dx) < 0.12;
    if (arrived && !this.parked) {
      this.parked = true;
      this.waitT = 0;
      g?.audio?.sfx?.('honk2');
    }
    if (this.marker) {
      this.bob = (this.bob || 0) + dt;
      this.marker.visible = !!this.parked && !this.leaving;
      if (this.marker.visible) {
        this.marker.position.y = 2.3 + Math.sin(this.bob * 3.1) * 0.09;
        // the label turns to the camera; a sign edge-on is just a yellow line
        this.marker.rotation.y = (this.world.camYaw || 0) - this.car.rotation.y;
      }
    }
    if (this.flash) {
      if (this.flashT > 0) {
        this.flashT -= dt;
        this.flash.visible = Math.floor(this.flashT * 7) % 2 === 0;
        if (this.flashT <= 0) this.flash.visible = false;
      } else if (this.flash.visible) this.flash.visible = false;
    }
    if (this.parked && !this.leaving) {
      this.waitT = (this.waitT || 0) + dt;
      // thirty seconds out: a second honk and the headlights, so leaving is not a surprise
      if (!this.lastCall && CONFIG.rides.waitSeconds - this.waitT <= 30) {
        this.lastCall = true;
        this.flashT = 2.6;
        g?.audio?.sfx?.('honk2');
        g?.toast?.(`${this.driver || 'Your driver'} leans on the horn: thirty seconds, and then he is gone.`, 'bad');
      }
      if (this.waitT >= CONFIG.rides.waitSeconds) {
        if (this.grace < 0) {
          // out of time: the car starts off down the block, but a sprint can still catch it
          this.grace = CONFIG.rides.graceSeconds;
          this.targetX = this.baseX + 3;
          if (this.interact) this.interact.radius = 2.4;
          g?.audio?.sfx?.('honk');
          g?.toast?.(`${this.driver || 'Your driver'} is pulling off — run.`, 'bad');
        } else {
          this.grace -= dt;
          const mo = this.world.mo?.root?.position;
          const near = mo && Math.hypot(mo.x - this.car.position.x, mo.z - this.car.position.z) < 3.6;
          if (near) {
            // caught: it stops where it is and the door is open, with a fresh clock
            this.grace = -1;
            this.waitT = 0;
            this.lastCall = false;
            this.targetX = this.baseX;
            if (this.interact) this.interact.radius = 1.8;
            g?.toast?.('You caught it. The door is open.', 'good');
          } else if (this.grace <= 0) {
            const res = noShowRide(g);
            if (res) {
              g?.toast?.(res.refunded > 0
                ? `The car pulls away. ${money(res.refunded)} goes back on the card.`
                : 'The car pulls away. You were not charged. Check your messages.', 'bad');
            }
            this.leave();
          }
        }
      }
    }
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
