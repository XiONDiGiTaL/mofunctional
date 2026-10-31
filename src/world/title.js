/**
 * The title screen: a corridor with people in it, and Mo's performance.
 *
 * Mo scans the corridor slowly, left then right, reaches into his jacket, brings out a small
 * glass pipe, and smokes — head tipped down, then back on the draw — while the crowd walks past
 * behind him and the fog eats them one at a time. Everything runs on one 26 second clock and
 * overrides the poses `animateMo` just wrote, so the menu can never drift out of sync with it.
 *
 * The pipe and the smoke are invented props for a fictional substance; the game itself carries
 * the content note that nothing here is a real-world instruction.
 */
import * as THREE from '../../vendor/three.module.js';
import { box, retroMaterial } from '../render/retro.js';
import { createNPC, animateNPC } from './characters.js';

const CYCLE = 26;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const range = (t, a, b) => smooth((t - a) / (b - a));
const mix = (a, b, t) => a + (b - a) * t;

/** Where Mo is looking: [second, head yaw]. Holds are deliberate — he is thinking, not scanning. */
const LOOK = [
  [0.0, 0.0], [1.6, -0.52], [3.8, -0.52], [5.6, 0.6], [7.4, 0.6], [8.9, 0.05], [CYCLE, 0.05],
];

function lookYaw(t) {
  for (let i = 0; i < LOOK.length - 1; i++) {
    const [t0, y0] = LOOK[i];
    const [t1, y1] = LOOK[i + 1];
    if (t >= t0 && t <= t1) return mix(y0, y1, smooth((t - t0) / (t1 - t0)));
  }
  return LOOK[LOOK.length - 1][1];
}

/** People going about their evening: four walking the corridor, two standing and talking. */
const CROWD = [
  { kind: 'kev', lane: -1.45, z: -4.6, speed: 0.62, dir: -1 },
  { kind: 'rae', lane: 1.35, z: -8.2, speed: 0.5, dir: 1 },
  { kind: 'dex', lane: -1.05, z: -12.4, speed: 0.72, dir: -1 },
  { kind: 'nia', lane: 1.6, z: -17.0, speed: 0.56, dir: -1 },
  { kind: 'clerk', lane: -1.8, z: -20.6, speed: 0.48, dir: 1 },
  { kind: 'dale', lane: 1.9, z: -2.9, speed: 0, dir: 1, stand: true, face: -0.9 },
  { kind: 'miguel', lane: 2.15, z: -3.5, speed: 0, dir: 1, stand: true, face: -2.2 },
];

export class TitleScene {
  constructor(world) {
    this.world = world;
    this.time = 0;
    this.crowd = [];
    this.puffs = [];
    this.puffClock = 0;
    this.bowlPos = new THREE.Vector3();
    this.buildCrowd();
    this.buildPipe();
    this.buildSmoke();
  }

  buildCrowd() {
    for (const spec of CROWD) {
      const rig = createNPC(spec.kind);
      rig.root.position.set(spec.lane, 0, spec.z);
      rig.root.rotation.y = spec.stand ? spec.face : (spec.dir < 0 ? Math.PI : 0);
      this.world.root.add(rig.root);
      this.crowd.push({ ...spec, rig, zMin: -23.5, zMax: -2.6 });
    }
  }

  buildPipe() {
    const glass = retroMaterial('titlePipe', { color: 0xe4ece6, emissive: 0.2, unlit: true, opacity: 0.55, transparent: true });
    const bowlMat = retroMaterial('titlePipeBowl', { color: 0xdfe7e2, emissive: 0.32, unlit: true, opacity: 0.72, transparent: true });
    const pipe = new THREE.Group();
    pipe.add(box(0.036, 0.036, 0.30, glass, [0, 0, 0.1], [0.2, 0, 0]));
    pipe.add(box(0.075, 0.062, 0.09, bowlMat, [0, 0.045, 0.26], [0.2, 0, 0]));
    pipe.add(box(0.064, 0.024, 0.07, retroMaterial('titlePipeAsh', { color: 0x6d5c4a }), [0, 0.068, 0.265], [0.2, 0, 0]));
    // the ember: a hot dot and a halo, because a glass pipe in a dark corridor needs a light source
    pipe.add(box(0.036, 0.02, 0.036, retroMaterial('titleEmber', { color: 0xffa257, emissive: 1.1, unlit: true }), [0, 0.082, 0.268], [0.2, 0, 0]));
    pipe.add(box(0.14, 0.14, 0.001, retroMaterial('titleEmberHalo', { color: 0xff9a4a, emissive: 1, unlit: true, opacity: 0.3, transparent: true }), [0, 0.09, 0.27], [0.2, 0, 0]));
    pipe.visible = false;
    pipe.position.set(0, -0.255, 0.055);
    pipe.rotation.set(0.55, 0, 0);
    this.pipe = pipe;
    this.bowl = new THREE.Object3D();
    this.bowl.position.set(0, 0.045, 0.235);
    pipe.add(this.bowl);
    this.world.mo.armR.elbow.add(pipe);
  }

  buildSmoke() {
    for (let i = 0; i < 18; i++) {
      const mat = retroMaterial(`titleSmoke${i}`, { color: 0xd8e2dc, unlit: true, opacity: 0, transparent: true });
      const mesh = box(0.16, 0.16, 0.001, mat, [0, -10, 0]);
      mesh.visible = false;
      mesh.renderOrder = 3;
      this.world.root.add(mesh);
      this.puffs.push({ mesh, mat, alive: false, age: 0, life: 1, vx: 0, vy: 0, vz: 0, spin: 0, size: 0.1 });
    }
  }

  spawnPuff(strength = 1) {
    const puff = this.puffs.find((p) => !p.alive);
    if (!puff) return;
    this.bowl.getWorldPosition(this.bowlPos);
    puff.alive = true;
    puff.age = 0;
    puff.life = 2.4 + Math.random() * 1.4;
    puff.vx = (Math.random() - 0.5) * 0.14;
    puff.vy = 0.18 + Math.random() * 0.08;
    puff.vz = 0.06 + Math.random() * 0.05;
    puff.spin = (Math.random() - 0.5) * 1.4;
    puff.size = 0.15 + strength * 0.08;
    puff.mesh.position.copy(this.bowlPos);
    puff.mesh.rotation.z = Math.random() * Math.PI;
    puff.mesh.scale.setScalar(puff.size);
    puff.mesh.visible = true;
  }

  perform(dt) {
    const mo = this.world.mo;
    const t = this.time % CYCLE;

    const yaw = lookYaw(t);
    mo.head.rotation.y = yaw + Math.sin(t * 0.7) * 0.025;
    mo.torso.rotation.y = yaw * 0.24;
    mo.hips.rotation.y = yaw * 0.08;

    // reach: hand to the jacket, then up to the mouth; lower at the end of the loop
    const pocket = range(t, 6.4, 7.6);
    const lift = range(t, 7.6, 9.1);
    const down = range(t, 20.6, 22.6);
    const raised = clamp01(pocket * 0.45 + lift) * (1 - down);

    mo.armR.pivot.rotation.x = mix(-0.02, -1.0, raised);
    mo.armR.pivot.rotation.z = mix(0.05, 0.74, raised);
    mo.armR.elbow.rotation.x = mix(-0.16, -2.08, raised);
    mo.armR.elbow.rotation.z = mix(0, -0.22, raised);
    // the left arm answers the smoke with a slow shift of weight
    mo.armL.pivot.rotation.x = mix(-0.02, -0.16, raised) + Math.sin(t * 0.8) * 0.02;

    const inhale = range(t, 12.4, 13.8) * (1 - range(t, 14.4, 15.6));
    mo.head.rotation.x = mix(0, 0.2, raised) - inhale * 0.2;
    mo.root.rotation.z = Math.sin(t * 0.5) * 0.008 + inhale * 0.012;

    if (this.pipe) this.pipe.visible = raised > 0.55;

    // smoke: a puff every couple of seconds once he is actually smoking
    this.puffClock += dt;
    const smoking = raised > 0.9;
    if (smoking && this.puffClock > (inhale > 0.35 ? 1.3 : 2.1)) {
      this.puffClock = 0;
      this.spawnPuff(inhale > 0.35 ? 1.5 : 0.9);
    }
    if (!smoking) this.puffClock = 0;

    for (const p of this.puffs) {
      if (!p.alive) continue;
      p.age += dt;
      const a = p.age / p.life;
      if (a >= 1) {
        p.alive = false;
        p.mesh.visible = false;
        p.mat.uniforms.uOpacity.value = 0;
        continue;
      }
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.x += (p.vx + Math.sin(p.age * 1.7) * 0.05) * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.z += p.spin * dt;
      p.mesh.scale.setScalar(p.size * (0.6 + a * 2.8));
      p.mat.uniforms.uOpacity.value = (1 - a) * (1 - a) * 0.34;
    }
  }

  updateCrowd(dt) {
    for (const c of this.crowd) {
      if (c.stand) {
        animateNPC(c.rig, dt, {});
        continue;
      }
      c.z += c.dir * c.speed * dt;
      if (c.z < c.zMin) { c.z = c.zMin; c.dir = 1; }
      else if (c.z > c.zMax) { c.z = c.zMax; c.dir = -1; }
      const targetYaw = c.dir < 0 ? Math.PI : 0;
      c.rig.root.rotation.y += (targetYaw - c.rig.root.rotation.y) * Math.min(1, dt * 5);
      c.rig.root.position.set(c.lane, 0, c.z);
      animateNPC(c.rig, dt, { walking: true });
    }
  }

  update(dt) {
    this.time += dt;
    this.updateCrowd(dt);
    this.perform(dt);
  }

  dispose() {
    for (const c of this.crowd) this.world.root.remove(c.rig.root);
    for (const p of this.puffs) this.world.root.remove(p.mesh);
    if (this.pipe && this.pipe.parent) this.pipe.parent.remove(this.pipe);
    this.crowd = [];
    this.puffs = [];
    this.pipe = null;
  }
}
