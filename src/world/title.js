/**
 * The title screen: a corridor with people in it, and Mo's performance.
 *
 * Mo scans the corridor slowly, left then right, reaches into his jacket, brings out a small
 * glass pipe (a straight stem with a ball on the end) and puts the stem to his lips. The ball
 * clouds over on the draw, he tips his head back, lets the smoke out, and settles into it: eyes
 * gone red and heavy, one corner of the mouth up. The crowd walks past behind him and the fog
 * eats them one at a time. Everything runs on one 26 second clock and overrides the poses
 * `animateMo` just wrote, so the menu can never drift out of sync with it.
 *
 * The pipe and the smoke are invented props for a fictional substance; the game itself carries
 * the content note that nothing here is a real-world instruction.
 */
import * as THREE from '../../vendor/three.module.js';
import { box, retroMaterial } from '../render/retro.js';
// a namespace import, so a cached heads.js from before setFaceHigh existed can't stop the game booting
import * as heads from '../render/heads.js';
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
    this.mouthPos = new THREE.Vector3();
    this.lips = new THREE.Vector3();
    this.aim = new THREE.Vector3();
    this.up = new THREE.Vector3();
    this.side = new THREE.Vector3();
    this.lift = new THREE.Vector3();
    this.inv = new THREE.Matrix4();
    this.high = 0;
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

  /**
   * The pipe at real size: a 15 cm glass stem with a 3.4 cm ball on the far end, held in the
   * right fist with the stem running up to the lips. Built along +Z (toward the mouth) with the
   * origin at the grip; perform() aims it at the lips every frame, so it lands on the mouth
   * whatever the arm and head are doing.
   */
  buildPipe() {
    const glass = retroMaterial('titlePipe', { color: 0xe4ece6, emissive: 0.3, unlit: true, opacity: 0.6, transparent: true });
    const ballMat = retroMaterial('titlePipeBall', { color: 0xc9d2cf, emissive: 0.34, unlit: true, opacity: 0.62, transparent: true });
    const pipe = new THREE.Group();
    pipe.add(box(0.011, 0.011, 0.18, glass, [0, 0, 0.03]));
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.017, 1), ballMat);
    ball.position.set(0, 0.002, -0.074);
    pipe.add(ball);
    // smoke clouding the ball from the inside, and a warm glint where the heat is
    this.fogMat = retroMaterial('titlePipeFog', { color: 0xf2f4f0, emissive: 0.5, unlit: true, opacity: 0, transparent: true });
    const fog = new THREE.Mesh(new THREE.IcosahedronGeometry(0.014, 1), this.fogMat);
    fog.position.copy(ball.position);
    pipe.add(fog);
    this.glintMat = retroMaterial('titlePipeGlint', { color: 0xffa257, emissive: 1.1, unlit: true, opacity: 0, transparent: true });
    pipe.add(box(0.016, 0.006, 0.016, this.glintMat, [0, -0.011, -0.074]));
    // the hole on top of the ball
    pipe.add(box(0.006, 0.003, 0.006, retroMaterial('titlePipeHole', { color: 0x3a3430, unlit: true }), [0, 0.0185, -0.076]));
    pipe.visible = false;
    pipe.matrixAutoUpdate = false;
    this.pipe = pipe;
    this.bowl = new THREE.Object3D();
    this.bowl.position.set(0, 0.022, -0.076);
    pipe.add(this.bowl);
    this.grip = new THREE.Vector3(0, -0.30 * this.world.mo.k, 0.02 * this.world.mo.k);
    this.world.mo.armR.elbow.add(pipe);
  }

  /** Aim the pipe from the fist to the lips; the fingers slide on the stem to take up slack. */
  aimPipe() {
    const mo = this.world.mo;
    const elbow = mo.armR.elbow;
    const hh = mo.headH;
    const head = mo.head.children.find((c) => c.isGroup) || mo.head;
    head.updateWorldMatrix(true, false);
    elbow.updateWorldMatrix(true, false);
    this.mouthPos.set(0, 0.24 * hh, 0.43 * hh);
    head.localToWorld(this.mouthPos);
    this.lips.copy(this.mouthPos);
    elbow.worldToLocal(this.lips);
    const z = this.aim.copy(this.lips).sub(this.grip);
    const reach = z.length();
    z.normalize();
    // keep the ball's hole facing the ceiling: world up, carried into forearm space
    this.up.set(0, 1, 0).transformDirection(this.inv.copy(elbow.matrixWorld).invert());
    const x = this.side.crossVectors(this.up, z).normalize();
    const y = this.lift.crossVectors(z, x);
    const slide = Math.max(-0.035, Math.min(0.035, reach - 0.12));
    this.pipe.matrix.makeBasis(x, y, z).setPosition(this.grip.x + z.x * slide, this.grip.y + z.y * slide, this.grip.z + z.z * slide);
    this.pipe.matrixWorldNeedsUpdate = true;
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

  /** A wisp off the ball, or (exhale) a plume out of the mouth, forward and up. */
  spawnPuff(strength = 1, exhale = false) {
    const puff = this.puffs.find((p) => !p.alive);
    if (!puff) return;
    if (exhale) this.bowlPos.copy(this.mouthPos);
    else this.bowl.getWorldPosition(this.bowlPos);
    puff.alive = true;
    puff.age = 0;
    puff.life = (exhale ? 2.8 : 1.8) + Math.random() * 1.2;
    puff.vx = (Math.random() - 0.5) * 0.14;
    puff.vy = exhale ? 0.1 + Math.random() * 0.06 : 0.16 + Math.random() * 0.06;
    puff.vz = exhale ? 0.22 + Math.random() * 0.1 : 0.04 + Math.random() * 0.04;
    puff.spin = (Math.random() - 0.5) * 1.4;
    puff.size = exhale ? 0.12 + strength * 0.07 : 0.05 + strength * 0.04;
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
    const down = range(t, 19.6, 21.4);
    const raised = clamp01(pocket * 0.45 + lift) * (1 - down);

    // the raised pose puts the fist a hand's width beside the mouth and a touch above it
    // and the forearm upright, so the stem crosses the fist to the lips with the ball out past it
    mo.armR.pivot.rotation.x = mix(-0.02, -1.07, raised);
    mo.armR.pivot.rotation.y = mix(0, 0.3, raised);
    mo.armR.pivot.rotation.z = mix(0.05, -0.09, raised);
    mo.armR.elbow.rotation.x = mix(-0.16, -2.3, raised);
    mo.armR.elbow.rotation.y = mix(0, -0.13, raised);
    mo.armR.elbow.rotation.z = mix(0, -0.52, raised);
    // the left arm answers the smoke with a slow shift of weight
    mo.armL.pivot.rotation.x = mix(-0.02, -0.16, raised) + Math.sin(t * 0.8) * 0.02;

    // the draw: the ball clouds over, then he holds it with his head back and lets it go
    const draw = range(t, 10.2, 12.6) * (1 - range(t, 13.0, 13.6));
    const inhale = range(t, 12.4, 13.8) * (1 - range(t, 15.0, 16.4));
    const exhaling = t > 15.0 && t < 17.6;
    // the high: red eyes and the smirk come up after the exhale and hold until the loop wraps
    this.high = range(t, 15.4, 18.4) * (1 - range(t, 24.6, 25.9));
    heads.setFaceHigh?.('mo', this.high);

    mo.head.rotation.x = mix(0, 0.12, raised) - inhale * 0.24 + this.high * 0.05;
    mo.head.rotation.z = this.high * 0.05;
    mo.root.rotation.z = Math.sin(t * 0.5) * (0.008 + this.high * 0.008) + inhale * 0.012;

    if (this.pipe) {
      this.pipe.visible = raised > 0.55;
      if (this.pipe.visible) this.aimPipe();
      this.fogMat.uniforms.uOpacity.value = draw * 0.85;
      this.glintMat.uniforms.uOpacity.value = draw * (0.7 + Math.sin(t * 23) * 0.2);
    }

    // smoke: thin wisps off the ball while it is hot, a long plume out of the mouth after
    this.puffClock += dt;
    if (exhaling && this.puffClock > 0.22) {
      this.puffClock = 0;
      this.spawnPuff(1.4 - (t - 15.0) * 0.35, true);
    } else if (raised > 0.9 && draw > 0.2 && this.puffClock > 0.9) {
      this.puffClock = 0;
      this.spawnPuff(0.6);
    }

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
    heads.setFaceHigh?.('mo', 0);
    // animateMo never writes these, so hand the arm back square
    const arm = this.world.mo.armR;
    arm.pivot.rotation.y = 0;
    arm.elbow.rotation.set(arm.elbow.rotation.x, 0, 0);
    this.crowd = [];
    this.puffs = [];
    this.pipe = null;
  }
}
