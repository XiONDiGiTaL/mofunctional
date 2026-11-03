/**
 * The delivery at 1120's door, on the street: the courier waiting with the bag (pay at the door),
 * or the bag on the stoop (paid ahead). systems/delivery.js decides the state; this only puts the
 * right thing on the pavement and the prompt beside it.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box } from '../render/retro.js';
import { createNPC } from './characters.js';
import { b1120 } from './hall.js';
import { deliveryState, collect } from '../systems/delivery.js';
import { money } from '../core/util.js';

export class Courier {
  constructor(world) {
    this.world = world;
    this.shown = null; // 'waiting' | 'door' | null
    this.obj = null;
    this.it = null;
  }

  /** Outside Unit 3B, on the third-floor landing: the courier buzzes up and waits at the door. */
  spot() {
    return { x: -0.75, z: 3.0 };
  }

  sync(g) {
    const w = this.world;
    const d = deliveryState(g.state);
    const want = w.areaId === 'hall' && b1120(g.state).floor === 3 && (d.status === 'waiting' || d.status === 'door') ? d.status : null;
    if (want === this.shown) {
      if (this.it && d.status === 'waiting') this.it.sub = `${money(d.total)} · cash · he leaves after an hour`;
      return;
    }
    this.remove();
    if (!want) return;
    const p = this.spot();
    if (want === 'waiting') {
      const rig = createNPC('passer_m2');
      rig.root.position.set(p.x, 0, p.z);
      rig.root.rotation.y = -Math.PI / 2;
      // a paper bag in his hand, the receipt stapled to it
      rig.armR.pivot.add(box(0.2, 0.26, 0.14, retroMaterial('cr_bag', { color: 0xb08a5a }), [0, -0.62, 0.05]));
      w.root.add(rig.root);
      rig.root.userData.courier = true;
      this.obj = rig.root;
    } else {
      const bag = new THREE.Group();
      bag.add(box(0.3, 0.34, 0.22, retroMaterial('cr_bag', { color: 0xb08a5a }), [0, 0.17, 0]));
      bag.add(box(0.08, 0.06, 0.08, retroMaterial('cr_knot', { color: 0x8a6a3a }), [0, 0.37, 0]));
      bag.position.set(p.x - 0.6, 0, p.z - 0.4);
      w.root.add(bag);
      this.obj = bag;
    }
    this.it = {
      id: 'delivery',
      label: want === 'waiting' ? 'Your delivery' : 'Your delivery, outside your door',
      sub: want === 'waiting' ? `${money(d.total)} · cash · he leaves after an hour` : 'paid · pick it up',
      x: p.x - (want === 'door' ? 0.6 : 0), z: p.z - (want === 'door' ? 0.4 : 0), radius: 1.3,
      vec: new THREE.Vector2(p.x, p.z),
      action: (gg) => { if (collect(gg)) this.sync(gg); },
    };
    w.interactables.push(this.it);
    this.shown = want;
  }

  remove() {
    if (this.obj) this.obj.parent?.remove(this.obj);
    if (this.it) this.world.interactables = (this.world.interactables || []).filter((i) => i !== this.it);
    this.obj = null;
    this.it = null;
    this.shown = null;
  }
}
