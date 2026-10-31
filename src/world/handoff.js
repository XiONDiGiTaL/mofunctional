/**
 * The dealer on Kestrel Street and the handoff beat.
 *
 * DealerWalker keeps the street in step with the order: while an order is `waiting`, Rolo is
 * standing at the meet spot (walking in along the curb if Mo is there to see it, already in
 * place if Mo arrives later), with an interaction on him. When the order closes for any reason
 * he turns and walks off the east end of the block and is removed. He is never a collider, and
 * the meet spot sits clear of every door, so he can't block a way in or out.
 *
 * HandoffBeat is Mo's side of the exchange: his right hand goes out and comes back, then he
 * smiles (the painted smile expression on his head texture, faded in and out) with a small nod.
 */
import { createNPC, animateNPC } from './characters.js';
import * as heads from '../render/heads.js';
import { activeOrder } from '../systems/dealer.js';
import { MEET_SPOT, STREET } from './plan.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const range = (t, a, b) => smooth((t - a) / (b - a));
const angleTo = (from, to) => { let d = (to - from) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

export class DealerWalker {
  constructor(world) {
    this.world = world;
    this.rig = null;
    this.target = null;
    this.leaving = false;
    this.orderId = null;
    this.interact = null;
  }

  /** Called on area load and every frame on the street. `fresh` = the street just loaded. */
  sync(g, fresh = false) {
    const w = this.world;
    if (w.areaId !== 'street') { this.remove(); return; }
    const o = activeOrder(g.state);
    const waiting = o && o.status === 'waiting';
    if (waiting && !this.rig) this.spawn(o, fresh);
    if (this.rig && !this.leaving && (!waiting || o.id !== this.orderId)) this.leave();
  }

  spawn(o, inPlace) {
    const w = this.world;
    const rig = createNPC('rolo');
    // arrive along the curb from the east, unless Mo is only now stepping out to find him there
    const start = inPlace ? { x: MEET_SPOT.x, z: MEET_SPOT.z } : { x: MEET_SPOT.x + 7.5, z: STREET.curbZ - 0.4 };
    rig.root.position.set(start.x, 0, start.z);
    w.root.add(rig.root);
    this.rig = rig;
    this.orderId = o.id;
    this.leaving = false;
    this.target = { x: MEET_SPOT.x, z: MEET_SPOT.z };
    this.interact = {
      id: 'dealer', label: 'Meet Rolo', sub: `${o.qty}x ${o.name} · $${o.total.toFixed(2)} cash`,
      x: start.x, z: start.z, radius: 1.7,
      action: (gg) => gg.dealerHandoff?.(),
    };
    w.interactables.push(this.interact);
  }

  leave() {
    if (!this.rig) return;
    this.leaving = true;
    this.target = { x: STREET.bounds.maxX + 3, z: STREET.curbZ - 0.4 };
    this.dropInteract();
  }

  dropInteract() {
    if (!this.interact) return;
    const list = this.world.interactables;
    const i = list.indexOf(this.interact);
    if (i >= 0) list.splice(i, 1);
    this.interact = null;
  }

  remove() {
    this.dropInteract();
    if (this.rig?.root.parent) this.rig.root.parent.remove(this.rig.root);
    this.rig = null;
    this.leaving = false;
    this.orderId = null;
  }

  update(dt) {
    const rig = this.rig;
    if (!rig) return;
    const p = rig.root.position;
    const dx = this.target.x - p.x;
    const dz = this.target.z - p.z;
    const dist = Math.hypot(dx, dz);
    const walking = dist > 0.08;
    if (walking) {
      const step = Math.min(dist, (this.leaving ? 1.35 : 1.15) * dt);
      p.x += (dx / dist) * step;
      p.z += (dz / dist) * step;
      rig.root.rotation.y += angleTo(rig.root.rotation.y, Math.atan2(dx, dz)) * Math.min(1, dt * 7);
    } else if (!this.leaving) {
      // at the spot: square up to Mo, hands in the hoodie
      const mo = this.world.mo.root.position;
      rig.root.rotation.y += angleTo(rig.root.rotation.y, Math.atan2(mo.x - p.x, mo.z - p.z)) * Math.min(1, dt * 3);
    }
    animateNPC(rig, dt, { walking });
    if (this.interact) { this.interact.x = p.x; this.interact.z = p.z; }
    if (this.leaving && !walking) this.remove();
  }
}

export class HandoffBeat {
  constructor(world) {
    this.world = world;
    this.t = 0;
    this.active = false;
  }

  play(towardX, towardZ) {
    const mo = this.world.mo;
    this.t = 0;
    this.active = true;
    this.headBase = mo.head.rotation.x;
    this.face = Math.atan2(towardX - mo.root.position.x, towardZ - mo.root.position.z);
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const t = this.t;
    const mo = this.world.mo;
    mo.root.rotation.y += angleTo(mo.root.rotation.y, this.face) * Math.min(1, dt * 6);
    // the hand goes out with the cash and comes back with the bag
    const reach = range(t, 0, 0.45) * (1 - range(t, 0.95, 1.4));
    mo.armR.pivot.rotation.x = mo.armR.pivot.rotation.x * (1 - reach) + -0.95 * reach;
    mo.armR.elbow.rotation.x = mo.armR.elbow.rotation.x * (1 - reach) + -0.35 * reach;
    // then the smile, and a small nod into it
    const smile = range(t, 1.2, 1.8) * (1 - range(t, 3.6, 4.4));
    heads.setFaceExpression?.('mo', 'smile', smile);
    mo.head.rotation.x = this.headBase + Math.sin(range(t, 1.5, 2.3) * Math.PI) * 0.12 - smile * 0.04;
    if (t >= 4.5) this.stop();
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    heads.setFaceExpression?.('mo', 'smile', 0);
    this.world.mo.head.rotation.x = this.headBase;
  }
}
