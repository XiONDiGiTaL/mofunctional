/**
 * Mo and one of the three women, in the world: a hug, a kiss on his cheek, and walking around
 * holding hands.
 *
 * Hug and kiss are short beats (a few seconds, Mo held in place, like the dealer handoff): she
 * steps in to face him, both rigs are posed over their normal animation, Mo smiles, it eases out.
 * Holding hands is a state, not a beat: she walks at his side, matching his pace, his hand in
 * hers, until he lets go, leaves the area, starts something else, or her day takes her somewhere.
 *
 * Poses are written after animateMo / animateNPC each frame, so they override only the joints
 * they name. Nothing here touches game state; romance.gesture() does the numbers.
 */
import * as heads from '../render/heads.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const angleTo = (from, to) => { let d = (to - from) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

const BEATS = {
  hug: { length: 4.4, gap: 0.34 },
  kiss: { length: 3.8, gap: 0.42 },
};

export class Affection {
  constructor(world) {
    this.world = world;
    this.beat = null;      // { type, rig, t }
    this.holding = null;   // the rig whose hand he is holding
  }

  get active() { return !!this.beat; }

  /** A hug or a cheek kiss with `rig`. */
  play(type, rig) {
    const spec = BEATS[type];
    if (!spec || !rig) return false;
    const mo = this.world.mo.root;
    const p = rig.root.position;
    // she comes to him: face to face, `gap` apart, along the line between them
    let dx = p.x - mo.position.x, dz = p.z - mo.position.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    this.beat = {
      type, rig, t: 0, spec,
      from: { x: p.x, z: p.z },
      to: { x: mo.position.x + dx * spec.gap, z: mo.position.z + dz * spec.gap },
      moYaw: Math.atan2(dx, dz),
      herYaw: Math.atan2(-dx, -dz),
    };
    rig.walking = false;
    return true;
  }

  holdHands(rig) {
    this.holding = rig;
    rig.holding = true;
  }

  letGo() {
    if (!this.holding) return;
    this.holding.holding = false;
    // she stays where she is: her normal routine picks her up from here
    const r = this.holding;
    if (r.wander) { r.wander.homeX = r.root.position.x; r.wander.homeZ = r.root.position.z; }
    this.holding = null;
  }

  isHolding(kind) { return this.holding?.npcDef?.kind === kind; }

  stop() {
    if (this.beat) this.finishBeat();
    this.letGo();
  }

  finishBeat() {
    heads.setFaceExpression?.('mo', 'smile', 0);
    this.beat = null;
  }

  /** Called every frame after the rigs have been animated. */
  update(dt) {
    const w = this.world;
    const mo = w.mo;
    if (this.beat) {
      const b = this.beat;
      b.t += dt;
      const t = b.t;
      const L = b.spec.length;
      const inn = smooth(t / 0.7);
      const e = inn * (1 - smooth((t - (L - 0.8)) / 0.8));
      const her = b.rig;
      // she closes the distance, then both square up
      her.root.position.x = b.from.x + (b.to.x - b.from.x) * inn;
      her.root.position.z = b.from.z + (b.to.z - b.from.z) * inn;
      her.root.rotation.y += angleTo(her.root.rotation.y, b.herYaw) * Math.min(1, dt * 8);
      mo.root.rotation.y += angleTo(mo.root.rotation.y, b.moYaw) * Math.min(1, dt * 8);
      if (b.type === 'hug') {
        // his arms round her back, hers up round his neck, heads to one side
        for (const [arm, sx] of [[mo.armL, 1], [mo.armR, -1]]) {
          arm.pivot.rotation.x = -0.85 * e;
          arm.pivot.rotation.z = sx * 0.5 * e;
          arm.elbow.rotation.x = -0.8 * e;
        }
        for (const [arm, sx] of [[her.armL, 1], [her.armR, -1]]) {
          arm.pivot.rotation.x = -1.95 * e;
          arm.pivot.rotation.z = sx * 0.5 * e;
          arm.elbow.rotation.x = -1.15 * e;
        }
        mo.head.rotation.y = 0.32 * e;
        her.head.rotation.y = 0.38 * e;
        her.head.rotation.x = 0.12 * e;
        her.torso.rotation.x = 0.06 * e;
        heads.setFaceExpression?.('mo', 'smile', smooth((t - 1.0) / 0.8) * e);
      } else {
        // she puts a hand on his chest, leans up and in, and kisses his cheek; he turns it to her
        const lean = smooth((t - 0.6) / 0.7) * (1 - smooth((t - 2.3) / 0.6));
        her.armR.pivot.rotation.x = -1.0 * e;
        her.armR.pivot.rotation.z = -0.28 * e;
        her.armR.elbow.rotation.x = -0.95 * e;
        her.armL.pivot.rotation.x = -0.55 * e;
        her.armL.elbow.rotation.x = -0.7 * e;
        her.torso.rotation.x = 0.16 * lean;
        her.head.rotation.y = -0.55 * lean;
        her.head.rotation.x = -0.12 * lean;
        her.root.position.y = 0.035 * lean; // on her toes
        // in to his left cheek: a step closer and a little to her right, which is his left
        const hy = her.root.rotation.y, lx = -0.1 * lean, lz = 0.1 * lean;
        her.root.position.x += Math.cos(hy) * lx + Math.sin(hy) * lz;
        her.root.position.z += -Math.sin(hy) * lx + Math.cos(hy) * lz;
        mo.head.rotation.y = -0.3 * lean;
        mo.head.rotation.x = 0.06 * lean;
        heads.setFaceExpression?.('mo', 'smile', smooth((t - 1.6) / 0.6) * e);
      }
      if (t >= L) {
        her.root.position.y = 0;
        this.finishBeat();
      }
      return;
    }

    const her = this.holding;
    if (!her) return;
    if (!her.root.visible || !her.root.parent) { this.letGo(); return; }
    // at his side, a step to the left of him, facing where he faces, walking when he walks
    const yaw = mo.root.rotation.y;
    const lx = -0.56, lz = -0.04;
    const tx = mo.root.position.x + Math.cos(yaw) * lx + Math.sin(yaw) * lz;
    const tz = mo.root.position.z - Math.sin(yaw) * lx + Math.cos(yaw) * lz;
    const k = Math.min(1, dt * 10);
    her.root.position.x += (tx - her.root.position.x) * k;
    her.root.position.z += (tz - her.root.position.z) * k;
    her.root.rotation.y += angleTo(her.root.rotation.y, yaw) * Math.min(1, dt * 9);
    // the joined hands: his arm out a little toward her, hers toward him, both held low
    mo.armL.pivot.rotation.x = mo.armL.pivot.rotation.x * 0.35 - 0.12;
    mo.armL.pivot.rotation.z = -0.16;
    mo.armL.elbow.rotation.x = -0.18;
    her.armR.pivot.rotation.x = her.armR.pivot.rotation.x * 0.35 - 0.12;
    her.armR.pivot.rotation.z = 0.16;
    her.armR.elbow.rotation.x = -0.18;
  }
}
