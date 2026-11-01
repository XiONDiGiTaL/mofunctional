/**
 * The body, on screen.
 *
 * Three beat animations that run after `animateMo()` has posed him, and only override the joints
 * they need — the same contract world/eating.js uses, so they can start mid-room without
 * touching the walk cycle's code:
 *
 *   SubstanceUse  taking one of the game's invented substances: a vial, two pills, a pipe, or a
 *                 dropper. The prop is a few boxes in his fist; the effect lands at the end.
 *   CollapseFall  balance going, knees buckling, the floor. Then whoever is running it fades
 *                 the screen and moves him somewhere safe.
 *   DanceBeat     a 1999 block-party shuffle: shoulders, hips, arms, feet, no dignity.
 *
 * None of them read the DOM, and none of them can fire twice: play() stops whatever was running
 * and the finish callback runs exactly once, from update()'s end condition.
 */
import * as THREE from '../../vendor/three.module.js';
import { box, retroMaterial } from '../render/retro.js';
import { CONFIG } from '../core/config.js';
import { clamp } from '../core/util.js';

const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const range = (t, a, b) => smooth((t - a) / Math.max(1e-4, b - a));
const mix = (a, b, t) => a + (b - a) * t;

/* --------------------------------------------------------------- substances */

/** How each style is staged. Durations come from CONFIG.substances.useDurationSeconds. */
const STYLE = {
  vial: { prop: ['vial', 0xdfe9ff, 0.05, 0.12, 0.05], lift: 1.0, tip: 1.25, headBack: 0.35, beats: [0.7] },
  pill: { prop: ['pills', 0xf2f2f2, 0.05, 0.02, 0.05], lift: 1.0, tip: 0, headBack: 0.12, beats: [0.75, 1.05] },
  pipe: { prop: ['pipe', 0x30251c, 0.05, 0.2, 0.05], lift: 1.0, tip: 0.15, headBack: 0.2, beats: [0.8, 1.9] },
  drop: { prop: ['dropper', 0xd8e8d0, 0.035, 0.11, 0.035], lift: 1.0, tip: 0.8, headBack: 0.42, beats: [0.6] },
};

export class SubstanceUse {
  constructor(world) {
    this.world = world;
    this.active = false;
    this.t = 0;
    this.onFinish = null;
    this.puffs = [];
  }

  play(itemId, style = 'pill', onFinish = null) {
    this.stop();
    this.itemId = itemId;
    this.style = STYLE[style] ? style : 'pill';
    this.conf = STYLE[this.style];
    this.dur = CONFIG.substances.useDurationSeconds?.[this.style] ?? 3.4;
    this.onFinish = onFinish;
    this.t = 0;
    this.fired = new Set();
    this.puffs = [];
    this.active = true;

    const mo = this.world.mo;
    // face three-quarters to the camera, like the eating animation, so it reads on screen
    this.faceYaw = (this.world.camYaw || 0) + Math.PI * 0.8;
    this.headBase = mo.head.rotation.x;
    this.torsoBase = mo.torso.rotation.y;

    const [name, color, w, h, d] = this.conf.prop;
    const mat = retroMaterial(`use_${name}_${itemId}`, { color, ambient: 0.8 });
    const g = new THREE.Group();
    g.add(box(w, h, d, mat, [0, 0, 0]));
    if (this.style === 'pill') {
      // two pills in the fist, rolled flat
      g.add(box(0.028, 0.01, 0.028, mat, [0.02, 0.008, 0]));
      g.add(box(0.028, 0.01, 0.028, mat, [-0.018, 0.004, 0.01]));
    }
    if (this.style === 'vial') {
      g.add(box(w * 0.6, 0.02, d * 0.6, retroMaterial(`use_cap_${itemId}`, { color: 0x8a8a90 }), [0, h / 2, 0]));
    }
    if (this.style === 'pipe') {
      // a short stem out of the fist and a bowl at the end
      g.add(box(0.028, 0.028, 0.16, mat, [0, h * 0.35, 0.06]));
      g.add(box(0.05, 0.05, 0.05, retroMaterial(`use_bowl_${itemId}`, { color: 0x4a3a2a }), [0, h * 0.42, 0.15]));
      g.add(box(0.03, 0.03, 0.012, retroMaterial('use_ember2', { color: 0xff7a3a, emissive: 1, unlit: true }), [0, h * 0.42, 0.18]));
    }
    if (this.style === 'drop') {
      g.add(box(0.02, 0.03, 0.02, retroMaterial(`use_tip_${itemId}`, { color: 0x9aa08a }), [0, -h / 2, 0.01]));
    }
    g.position.set(0, -0.31 * mo.k, 0.07 * mo.k);
    g.rotation.set(-0.5, 0, 0);
    mo.armR.elbow.add(g);
    this.prop = g;
    // the world does not own the audio; the Game does, and hands itself to World.update()
    this.sfx = this.world.game?.audio?.sfx?.bind(this.world.game.audio) || (() => {});
  }

  stop() {
    if (this.active && this.headBase !== undefined) {
      this.world.mo.head.rotation.x = this.headBase;
      this.world.mo.torso.rotation.y = this.torsoBase ?? 0;
      this.world.mo.armR.elbow.rotation.z = 0;
      this.world.mo.armR.pivot.rotation.z = 0.05;
    }
    if (this.prop?.parent) this.prop.parent.remove(this.prop);
    for (const p of this.puffs) p.mesh.parent?.remove(p.mesh);
    this.puffs = [];
    this.prop = null;
    this.active = false;
    this.onFinish = null;
  }

  /** A puff of smoke off the pipe: three grey boxes that drift and fade. */
  puff() {
    const mo = this.world.mo;
    const start = new THREE.Vector3();
    this.prop?.getWorldPosition(start);
    for (let i = 0; i < 3; i++) {
      const mat = retroMaterial(`puff${i}`, { color: 0xc8d0c4, opacity: 0.5, transparent: true, unlit: true });
      const mesh = box(0.06 + i * 0.03, 0.06 + i * 0.03, 0.06 + i * 0.03, mat, [start.x, start.y, start.z]);
      this.world.root.add(mesh);
      this.puffs.push({ mesh, vy: 0.28 + i * 0.06, vx: (Math.random() - 0.5) * 0.14, life: 1.4 - i * 0.15 });
    }
    void mo;
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const t = this.t;
    const mo = this.world.mo;
    const c = this.conf;

    if (this.faceYaw != null) {
      let d = this.faceYaw - mo.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      mo.root.rotation.y += d * Math.min(1, dt * 5);
    }

    const last = c.beats[c.beats.length - 1] ?? 0.8;
    const up = range(t, 0, 0.55) * (1 - range(t, last + 0.7, last + 1.3));
    let beat = 0;
    for (const b of c.beats) beat = Math.max(beat, Math.exp(-((t - b) ** 2) / 0.02));

    // hand to the mouth, prop tipping, head going back for the drop
    mo.armR.pivot.rotation.x = mix(mo.armR.pivot.rotation.x, -0.82 - beat * 0.12, up);
    mo.armR.pivot.rotation.z = mix(mo.armR.pivot.rotation.z, -0.3, up);
    mo.armR.elbow.rotation.x = mix(mo.armR.elbow.rotation.x, -2.15 - beat * 0.1, up);
    mo.armR.elbow.rotation.z = mix(0, -0.45, up);
    if (this.prop) {
      this.prop.visible = t < last + 0.7;
      this.prop.rotation.x = -0.5 - range(t, 0.35, last) * c.tip;
    }
    mo.head.rotation.x = this.headBase + up * c.headBack + beat * (this.style === 'pill' ? 0.09 : 0.03);
    mo.torso.rotation.y = mix(this.torsoBase ?? 0, 0.12, up);

    for (const b of c.beats) {
      if (t >= b && !this.fired.has(b)) {
        this.fired.add(b);
        this.sfx(this.style === 'pill' ? 'gulp' : this.style === 'pipe' ? 'puff' : 'dose');
        if (this.style === 'pipe') this.puff();
      }
    }

    for (const p of this.puffs) {
      p.life -= dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.material.opacity = Math.max(0, p.life * 0.35);
      p.mesh.scale.multiplyScalar(1 + dt * 0.5);
      if (p.life <= 0) p.mesh.visible = false;
    }

    if (t >= this.dur) {
      const done = this.onFinish;
      // clear the pose first so the first frame after the animation is already back in idle
      const head = this.headBase;
      const torso = this.torsoBase;
      this.active = false;
      this.onFinish = null;
      mo.head.rotation.x = head;
      mo.torso.rotation.y = torso ?? 0;
      mo.armR.elbow.rotation.z = 0;
      mo.armR.pivot.rotation.z = 0.05;
      this.stop();
      if (done) done();
    }
  }
}

/* ----------------------------------------------------------------- collapse */

/**
 * The fall. 1.5 seconds: weight shifts, knees give, shoulder takes it, he settles on his side.
 * While it runs the world keeps his controls locked; when it ends `onDone` fires once and the
 * caller owns the fade, the lost hours and where he wakes up.
 */
export class CollapseFall {
  constructor(world) {
    this.world = world;
    this.active = false;
    this.t = 0;
    this.done = false;
    this.onDone = null;
    this.side = 1;
  }

  play(onDone) {
    this.stop();
    this.active = true;
    this.t = 0;
    this.done = false;
    this.onDone = onDone;
    this.side = Math.random() < 0.5 ? -1 : 1;
    this.startRot = this.world.mo.root.rotation.z || 0;
    this.world.mo.root.rotation.x = 0;
    this.world.mo.hips.position.y = this.world.mo.hipY;
    this.world.game?.audio?.sfx?.('sting');
  }

  stop() {
    const mo = this.world.mo;
    mo.root.rotation.x = 0;
    mo.root.rotation.z = 0;
    mo.root.position.y = 0;
    mo.hips.position.y = mo.hipY;
    this.active = false;
    this.onDone = null;
  }

  /** Reset the rig so the next area load starts upright. */
  reset() {
    const mo = this.world.mo;
    mo.root.rotation.set(0, mo.root.rotation.y, 0);
    mo.root.position.y = 0;
    mo.hips.position.y = mo.hipY;
    this.active = false;
    this.t = 0;
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const t = this.t;
    const mo = this.world.mo;
    const fall = range(t, 0.0, 0.95);
    const settle = range(t, 0.95, 1.5);

    // the knees go first, then the whole body tips past the point of return
    mo.legL.knee.rotation.x = mix(0.1, 1.5, fall);
    mo.legR.knee.rotation.x = mix(0.1, 1.2, fall);
    mo.legL.pivot.rotation.x = mix(0, -0.5, fall);
    mo.legR.pivot.rotation.x = mix(0, -0.3, fall);
    mo.hips.position.y = mo.hipY * (1 - fall * 0.85);
    mo.armL.pivot.rotation.z = mix(-0.05, -1.15, fall);
    mo.armR.pivot.rotation.z = mix(0.05, 0.9, fall);
    mo.armL.pivot.rotation.x = mix(0, -1.1, fall);
    mo.armR.pivot.rotation.x = mix(0, -0.7, fall);
    mo.head.rotation.x = mix(0, 0.34, fall);
    mo.torso.rotation.z = mix(0, this.side * 0.2, fall);
    mo.root.rotation.z = this.startRot + this.side * (Math.PI * 0.46) * fall;
    mo.root.position.y = -0.02 * fall;

    if (t >= 0.95 && !this.done) {
      this.done = true;
      this.world.game?.audio?.sfx?.('bad');
    }
    if (t >= 1.5) {
      const cb = this.onDone;
      this.active = false;
      this.onDone = null;
      if (cb) cb();
    }
    void settle;
  }
}

/* -------------------------------------------------------------------- dance */

/**
 * The shuffle. Shoulders first, then hips, then the arms and feet catch up. It loops until
 * `stop()`; the caller decides how long a dance is worth in game minutes.
 */
export class DanceBeat {
  constructor(world) {
    this.world = world;
    this.active = false;
    this.t = 0;
  }

  play() {
    this.t = 0;
    this.active = true;
    this.faceYaw = (this.world.camYaw || 0) + Math.PI * 1.6;
  }

  stop() {
    if (!this.active) return;
    const mo = this.world.mo;
    mo.hips.rotation.y = 0;
    mo.torso.rotation.z = 0;
    mo.armL.pivot.rotation.z = -0.05;
    mo.armR.pivot.rotation.z = 0.05;
    mo.hips.position.y = mo.hipY;
    this.active = false;
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const t = this.t;
    const mo = this.world.mo;
    const beat = Math.sin(t * 4.4);
    const off = Math.sin(t * 4.4 + Math.PI);

    if (this.faceYaw != null) {
      let d = this.faceYaw - mo.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      mo.root.rotation.y += d * Math.min(1, dt * 4);
    }

    mo.hips.rotation.y = beat * 0.28;
    mo.hips.position.y = mo.hipY + Math.abs(beat) * 0.035;
    mo.torso.rotation.y = off * 0.16;
    mo.torso.rotation.z = beat * 0.08;
    mo.armL.pivot.rotation.z = -0.9 - off * 0.5;
    mo.armR.pivot.rotation.z = 0.9 + beat * 0.5;
    mo.armL.pivot.rotation.x = -0.5 + Math.sin(t * 8.8) * 0.35;
    mo.armR.pivot.rotation.x = -0.5 + Math.sin(t * 8.8 + 1.2) * 0.35;
    mo.armL.elbow.rotation.x = -0.9 - off * 0.3;
    mo.armR.elbow.rotation.x = -0.9 - beat * 0.3;
    mo.legL.pivot.rotation.x = Math.max(0, beat) * 0.32;
    mo.legR.pivot.rotation.x = Math.max(0, off) * 0.32;
    mo.legL.knee.rotation.x = Math.max(0, beat) * 0.45;
    mo.legR.knee.rotation.x = Math.max(0, off) * 0.45;
    mo.head.rotation.z = beat * 0.16;
    mo.head.rotation.y = off * 0.2;
    mo.head.rotation.x = -0.06 + beat * 0.06;
  }
}
