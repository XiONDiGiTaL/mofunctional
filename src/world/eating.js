/**
 * Mo eating, on screen: the item appears in his right fist, comes up to his mouth, and goes in
 * over three bites (or a long pull, for a drink) with the head working on each one. Then the
 * hand drops, he holds still for a beat, and lets out a breath before the walk takes him back.
 *
 * It runs on real seconds, after `animateMo` has posed him, and only overrides the right arm and
 * the head, so he can stand mid-room or at the fridge door and it reads the same.
 */
import * as THREE from '../../vendor/three.module.js';
import { box, retroMaterial } from '../render/retro.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const range = (t, a, b) => smooth((t - a) / (b - a));
const mix = (a, b, t) => a + (b - a) * t;

/** How each item looks in the hand: [style, colour, w, h, d] in metres. */
const LOOK = {
  ramen: ['cup', 0xe8463a, 0.09, 0.1, 0.09],
  beans: ['can', 0xd9502e, 0.07, 0.1, 0.07],
  eggs: ['bite', 0xfff2dc, 0.05, 0.065, 0.05],
  sandwich: ['bite', 0xe7c48b, 0.14, 0.06, 0.09],
  bar: ['bite', 0x2f6fb5, 0.12, 0.03, 0.045],
  cereal: ['cup', 0xf2b632, 0.08, 0.1, 0.08],
  bec: ['bite', 0xe2a85c, 0.12, 0.07, 0.11],
  chopped: ['bite', 0xe2a85c, 0.2, 0.07, 0.08],
  hero: ['bite', 0xe7c48b, 0.22, 0.06, 0.07],
  falafel: ['bite', 0xefe1bb, 0.16, 0.06, 0.06],
  halal_plate: ['cup', 0xf4f1ea, 0.17, 0.05, 0.13],
  chicken_rice: ['cup', 0xd7dde3, 0.15, 0.06, 0.12],
  lentil: ['cup', 0xd9822b, 0.11, 0.07, 0.11],
  baklava: ['bite', 0xe0a547, 0.07, 0.035, 0.07],
  tallboy: ['drink', 0x3c7bd6, 0.07, 0.17, 0.07],
  mint_tea: ['drink', 0xc9862c, 0.075, 0.09, 0.075],
  loosies: ['smoke', 0xfbfbf6, 0.012, 0.012, 0.085],
};
const DUR = { bite: 4.4, cup: 4.4, can: 4.4, drink: 3.8, smoke: 3.6 };

export class EatAnim {
  constructor(world) {
    this.world = world;
    this.active = false;
    this.t = 0;
    this.item = null;
    this.crumbs = [];
    this.tmp = new THREE.Vector3();
  }

  /** Start eating `itemId`; sfx(name) is called on each bite so the sound lands with the motion. */
  play(itemId, sfx = () => {}, faceYaw = null) {
    this.stop();
    // the follow camera sits behind him; he turns three-quarters to it so the bite is on screen
    this.faceYaw = faceYaw;
    const [style, color, w, h, d] = LOOK[itemId] || ['bite', 0xd8c49a, 0.1, 0.06, 0.08];
    const mo = this.world.mo;
    const k = mo.k;
    const g = new THREE.Group();
    const mat = retroMaterial(`eat_${itemId}`, { color, ambient: 0.75 });
    g.add(box(w, h, d, mat, [0, 0, 0]));
    if (style === 'cup') g.add(box(w * 0.86, 0.012, d * 0.86, retroMaterial(`eat_${itemId}_top`, { color: 0xf2d27a, ambient: 0.8 }), [0, h / 2, 0]));
    if (style === 'smoke') g.add(box(0.013, 0.013, 0.012, retroMaterial('eat_ember', { color: 0xff8a3a, emissive: 1, unlit: true }), [0, 0, -d / 2]));
    // held in the fist, the business end toward the mouth
    g.position.set(0, -0.31 * k, 0.07 * k);
    g.rotation.set(style === 'drink' || style === 'can' ? 0 : -0.5, 0, 0);
    mo.armR.elbow.add(g);
    this.item = g;
    this.style = style;
    this.dur = DUR[style] || 4.4;
    this.sfx = sfx;
    this.beats = style === 'drink' ? [1.3, 2.0] : style === 'smoke' ? [1.2] : [1.1, 1.75, 2.4];
    this.fired = new Set();
    // the idle pose never writes head pitch, so work from where it was and put it back after
    this.headBase = mo.head.rotation.x;
    this.t = 0;
    this.active = true;
  }

  stop() {
    if (this.active && this.headBase !== undefined) this.world.mo.head.rotation.x = this.headBase;
    if (this.item?.parent) this.item.parent.remove(this.item);
    this.item = null;
    for (const c of this.crumbs) c.mesh.parent?.remove(c.mesh);
    this.crumbs = [];
    this.active = false;
  }

  /** Crumbs off a bite: a few flecks of the item's colour that fall to the floor. */
  crumb() {
    if (!this.item || this.style === 'drink' || this.style === 'smoke') return;
    this.item.children[0].getWorldPosition(this.tmp);
    const mat = this.item.children[0].material;
    for (let i = 0; i < 4; i++) {
      const mesh = box(0.014, 0.014, 0.014, mat, [0, 0, 0]);
      mesh.position.copy(this.tmp);
      this.world.root.add(mesh);
      this.crumbs.push({ mesh, vx: (Math.random() - 0.5) * 0.5, vy: Math.random() * 0.6, vz: 0.2 + Math.random() * 0.4, life: 1.2 });
    }
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const t = this.t;
    const mo = this.world.mo;
    if (this.faceYaw !== null) {
      let d = this.faceYaw - mo.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      mo.root.rotation.y += d * Math.min(1, dt * 5);
    }

    // up to the mouth, hold through the bites, down, then the pause
    const lastBite = this.beats[this.beats.length - 1];
    const up = range(t, 0, 0.7) * (1 - range(t, lastBite + 0.45, lastBite + 1.1));
    const drink = this.style === 'drink';
    // each bite: the hand pushes in and the head comes down to meet it
    let bite = 0;
    for (const b of this.beats) bite = Math.max(bite, Math.exp(-((t - b) ** 2) / 0.018));
    for (const b of this.beats) {
      if (t >= b && !this.fired.has(b)) {
        this.fired.add(b);
        this.sfx(drink ? 'gulp' : this.style === 'smoke' ? 'puff' : 'munch');
        if (this.item && !drink && this.style !== 'smoke') {
          const left = 1 - this.fired.size / this.beats.length;
          this.item.scale.set(1, 1, Math.max(0.15, 0.25 + left * 0.75));
        }
        this.crumb();
      }
    }

    mo.armR.pivot.rotation.x = mix(mo.armR.pivot.rotation.x, -0.86 - bite * 0.08, up);
    mo.armR.pivot.rotation.z = mix(mo.armR.pivot.rotation.z, -0.17, up);
    mo.armR.elbow.rotation.x = mix(mo.armR.elbow.rotation.x, (drink ? -2.2 : -2.02) - bite * 0.12, up);
    mo.armR.elbow.rotation.z = mix(0, -0.5, up);
    if (this.item) {
      this.item.visible = t < lastBite + 0.9;
      // a drink tips up as it is drained
      if (drink) this.item.rotation.x = -range(t, 0.6, lastBite) * 1.3;
    }

    // chewing: a small fast nod between bites; a drink tips the head back instead
    const chewing = t > this.beats[0] && t < lastBite + 1.4;
    const chew = chewing && !drink ? Math.sin(t * 17) * 0.035 : 0;
    const satisfied = range(t, lastBite + 1.2, lastBite + 1.6) * (1 - range(t, this.dur - 0.5, this.dur));
    mo.head.rotation.x = this.headBase + 0.16 * up + bite * 0.12 - (drink ? up * 0.32 : 0) + chew - satisfied * 0.12;

    for (const c of this.crumbs) {
      c.life -= dt;
      c.vy -= 2.6 * dt;
      c.mesh.position.x += c.vx * dt;
      c.mesh.position.y = Math.max(0.01, c.mesh.position.y + c.vy * dt);
      c.mesh.position.z += c.vz * dt;
      if (c.life <= 0) c.mesh.visible = false;
    }

    if (t >= this.dur) {
      mo.head.rotation.x = this.headBase;
      mo.armR.elbow.rotation.z = 0;
      mo.armR.pivot.rotation.z = 0.05;
      this.stop();
    }
  }
}
