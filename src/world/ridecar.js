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
import { rideState, DESTINATIONS, fareTo, tooClose, ride, noShowRide, pullOffCruise } from '../systems/rides.js';
import { money, pick } from '../core/util.js';
import { buildVehicle } from './vehicles.js';
import { ROAD } from './plan.js';

const LANE_Z = ROAD.parkNearZ;
// the door is on the curb side of the car, not in the middle of it
const DOOR_Z = LANE_Z - 0.9;

/** What he has to say when somebody runs him down at the light. */
const CHASE_LINES = [
  '"You ran. I saw you run. Get in."',
  '"Nobody runs for a bus like that. Get in."',
  '"You chased me down the block. Get in before I change my mind."',
  '"I had a fare on Ashby, you know. Get in."',
  '"Wave your arms at me again and I keep driving."',
];

/** Out the window, at the running man, on the way off the block. */
const CHASE_MID = [
  '"HEY. HEY. I am DRIVING here."',
  '"You look insane. You know that? Insane."',
  '"I got a fare waiting. I do not got a you."',
  '"Go home, chief. Walk it off."',
];

/** Seconds into the pull-off at which he leans out and yells. */
const SHOUT_AT = [1.2, 3.2];

/** What Mo yells back, once, a beat after the first earful. */
const MO_REPLY = [
  '"I am coming! I am COMING!"',
  '"Wait! WAIT!"',
  '"You saw me! You SAW me standing there!"',
  '"Five more seconds! FIVE!"',
];

const REPLY_AT = 1.9;
/** ...and when the kerb takes his feet out from under him. */
const STUMBLE_AT = 2.5;

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
    this.shout = 0;
    this.replied = false;
    this.tripped = false;
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
      // reaching the door mid-pull-off is the same thing as catching it: the car stops first, so
      // the destination menu never opens on a car that is still driving away
      action: (gg) => { if (this.grace >= 0) this.caught(gg); rideMenu(gg); },
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
    this.shout = 0;
    this.replied = false;
    this.tripped = false;
    this.speed = 0;
    // it drives in from the east heading west, and keeps facing west at the curb
    this.heading = Math.PI;
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
    this.shout = 0;
    this.replied = false;
    this.tripped = false;
  }

  /** Caught mid-pull-off: it stops where he reached it, the door is open and the clock is fresh. */
  caught(g) {
    if (this.grace < 0 || !this.car) return;
    const late = this.grace <= CONFIG.rides.graceSeconds * 0.4;
    this.grace = -1;
    this.waitT = 0;
    this.lastCall = false;
    this.speed = 0;
    this.baseX = this.car.position.x;
    this.targetX = this.baseX;
    if (this.solid) this.solid.x = this.baseX;
    if (this.interact) { this.interact.z = 0.9; this.interact.radius = 1.8; }
    g?.toast?.(late ? `${pick(CHASE_LINES)} (${this.driver})` : 'You caught it. The door is open.', 'good');
  }

  update(dt, g) {
    if (!this.car) return;
    // a menu on screen holds the whole scene, the car's clock and its pull-off included: the wait,
    // the grace window and the chase all used to run on behind the destination menu
    if (g?.uiBusy) return;
    const p = this.car.position;
    const dx = this.targetX - p.x;
    // it pulls in and out under acceleration instead of hitting nine metres a second the frame it
    // spawns and then stopping dead, which read as a jump cut rather than a car
    const chasing = this.grace >= 0 && !this.leaving;
    if (chasing) {
      // rolling off: it starts under a walk and keeps adding speed through the window, so a catch
      // at three or four seconds is still there for a man who committed on the first frame, and
      // gone for one who stood at the kerb deciding
      const elapsed = CONFIG.rides.graceSeconds - this.grace;
      const cruise = pullOffCruise(elapsed);
      this.speed = Math.min(cruise, (this.speed || 0) + 6 * dt);
      // west, the way it leaves the block: rolling east and then turning round to leave was a
      // U-turn in the middle of Kestrel Street
      this.targetX = p.x - 3;
      if (p.x > this.baseX - 14) p.x -= Math.min(3, this.speed * dt);
    } else {
      const want = this.leaving ? 8.5 : Math.min(6, 1.2 + Math.abs(dx) * 0.5);
      this.speed = Math.min(want, (this.speed || 0) + (this.leaving ? 4 : 6) * dt);
      if (Math.abs(dx) > 0.05) p.x += Math.sign(dx) * Math.min(Math.abs(dx), this.speed * dt);
      else { p.x = this.targetX; this.speed = 0; }
    }
    // face the way it is moving; at rest it keeps the last heading (it used to snap round to east
    // the moment it parked, because a parked car has no dx)
    if (this.leaving || chasing) this.heading = Math.PI;
    else if (Math.abs(dx) > 0.05) this.heading = dx < 0 ? Math.PI : 0;
    this.car.rotation.y = this.heading;
    // the prompt follows the car while it is rolling off, and while it rolls it sits at the door
    // with the catch's own reach, so "Get in" is lit exactly when a catch would count
    if (this.interact) {
      this.interact.x = p.x;
      this.interact.z = chasing ? DOOR_Z : 0.9;
      this.interact.radius = chasing ? CONFIG.rides.doorReach : 1.8;
    }
    // the camera's wall goes where the car goes
    if (this.solid) this.solid.x = p.x;
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
      // while the car is here on screen its own real-time clock is the one that counts: the
      // game-time limit (rides.waitMinutes, 15 game minutes, about 7 real seconds at 1x) used to
      // cancel the ride long before the two-minute wait or the pull-off could happen. The game
      // clock still applies when Mo is somewhere else and the car is not drawn.
      const r = rideState(g.state);
      if (r.status === 'waiting') r.leaveAt = Math.max(r.leaveAt || 0, g.state.clock.m + 2);
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
          this.shout = 0;
          this.replied = false;
          this.tripped = false;
          this.targetX = this.baseX - 3;
          g?.audio?.sfx?.('honk');
          g?.toast?.(`${this.driver || 'Your driver'} is pulling off. Run.`, 'bad');
        } else {
          this.grace -= dt;
          const into = CONFIG.rides.graceSeconds - this.grace;
          // he leans out the window while Mo runs, with the brights
          if (this.shout < SHOUT_AT.length && into >= SHOUT_AT[this.shout]) {
            g?.toast?.(`${this.driver}: ${CHASE_MID[this.shout % CHASE_MID.length]}`, 'bad');
            this.shout++;
            this.flashT = 1.4;
            g?.audio?.sfx?.('honk');
          }
          // he gives the driver some of it back, and the kerb takes it out of him: one line in the
          // feed for both, so five seconds do not fill it with five messages
          if (!this.replied && into >= REPLY_AT) this.replied = true;
          if (!this.tripped && into >= STUMBLE_AT) {
            this.tripped = true;
            const v = this.world.vel;
            if (v) { v.x *= 0.6; v.z *= 0.6; }
            g?.toast?.(`You: ${pick(MO_REPLY)} Your boot catches the kerb and you stumble.`, 'bad');
          }
          // at the door, alongside it: standing behind the car or at the far kerb does not count
          const mo = this.world.mo?.root?.position;
          const near = mo && Math.hypot(mo.x - this.car.position.x, mo.z - DOOR_Z) < CONFIG.rides.doorReach;
          if (near) {
            this.caught(g);
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
