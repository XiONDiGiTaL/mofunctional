/** The 3D world: renderer, camera, areas, movement, interaction, ragdoll, menu scene. */
import * as THREE from '../../vendor/three.module.js';
import { createRenderer, setSize, retroMaterial, retroUniforms, box } from '../render/retro.js';
import { createMo, createAddison, createNPC, createCat, animateMo, animateAddison, animateNPC } from './characters.js';
import { buildApartment, buildStreet, buildChurch, buildBodega, buildHabibs, buildMenuWorld } from './areas.js';
import { CONFIG } from '../core/config.js';
import { clamp, lerp, minuteOfDay } from '../core/util.js';
import { scheduleTarget } from './schedules.js';
import { maybeStreetEvent } from '../systems/street.js';

const BUILDERS = {
  apartment: buildApartment, street: buildStreet, church: buildChurch,
  bodega: buildBodega, habibs: buildHabibs,
};

export class World {
  constructor(container) {
    this.container = container;
    this.renderer = createRenderer(container);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.render.colors.sky);
    this.camera = new THREE.PerspectiveCamera(68, 1, 0.08, 90);
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.mode = 'menu';
    this.areaId = null;
    this.area = null;
    this.areaGroup = null;
    this.interactables = [];
    this.prompt = null;
    this.promptTarget = null;

    this.mo = createMo();
    this.root.add(this.mo.root);
    this.addison = createAddison();
    this.root.add(this.addison.root);
    this.addison.root.visible = false;

    this.npcRigs = [];
    this.camTarget = new THREE.Vector3(0, 1.2, 0);
    this.camPos = new THREE.Vector3(0, 3.2, 5);
    this.camYaw = 0;
    this.tilt = 0;
    this.ragdollTimer = 0;
    this.ragdollParts = [];
    this.time = 0;
    this.audioLevel = 0;
    this.stepTimer = 0;
    this.menuGroup = null;
    this.menuTime = 0;
    this.walking = false;
    this.vel = new THREE.Vector3();
    this.moveTarget = null;
    this.marker = null;
    this.markerFade = 0;
    this.ray = new THREE.Raycaster();
    this.hurt = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    setSize(this.renderer, this.camera, this.container);
    if (this.container.clientWidth / this.container.clientHeight > 1.2) {
      this.camera.fov = 68;
    } else {
      this.camera.fov = 78;
    }
    this.camera.updateProjectionMatrix();
  }

  clearArea() {
    if (this.areaGroup) {
      this.root.remove(this.areaGroup);
      this.areaGroup.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      this.areaGroup = null;
    }
    for (const rig of this.npcRigs) this.root.remove(rig.root);
    this.npcRigs = [];
    this.interactables = [];
    this.prompt = null;
  }

  showMenu() {
    this.clearArea();
    this.mode = 'menu';
    this.areaId = 'menu';
    this.area = buildMenuWorld();
    this.areaGroup = this.area.group;
    this.root.add(this.areaGroup);
    this.menuGroup = this.areaGroup;
    this.menuTime = 0;
    this.mo.root.visible = true;
    this.mo.root.position.set(0.1, 0, -0.4);
    this.mo.root.rotation.set(0, 0.06, 0);
    this.mo.hips.position.y = 0.74;

    this.addison.root.visible = true;
    this.addison.root.position.set(-0.6, 0, -9.5);
    this.addison.root.rotation.set(0, 0.3, 0);
    this.camera.position.set(0.05, 1.52, 2.15);
    this.camera.lookAt(0, 1.32, 0);
  }

  loadArea(id, g, spawnId = null) {
    this.clearArea();
    this.moveTarget = null;
    this.vel.set(0, 0, 0);
    this.mode = 'play';
    this.areaId = id;
    const builder = BUILDERS[id] || buildApartment;
    this.area = builder(g);
    this.areaGroup = this.area.group;
    this.root.add(this.areaGroup);
    this.addison.root.visible = false;

    const spawn = this.area.spawn;
    this.mo.root.visible = true;
    this.mo.root.position.set(spawnId === 'street' ? spawn.x + 0.6 : spawn.x, 0, spawn.z);
    this.mo.root.rotation.set(0, spawn.rot, 0);
    this.camYaw = spawn.rot;
    this.tilt = 0;

    // camera snap
    const behind = new THREE.Vector3(Math.sin(spawn.rot), 0, Math.cos(spawn.rot)).multiplyScalar(4.2);
    this.camera.position.set(this.mo.root.position.x + behind.x, 2.9, this.mo.root.position.z + behind.z);
    this.camPos.copy(this.camera.position);
    this.camTarget.set(this.mo.root.position.x, 1.15, this.mo.root.position.z);
    this.camera.lookAt(this.camTarget);

    this.interactables = this.area.interactables.map((it) => ({ ...it, vec: new THREE.Vector2(it.x, it.z) }));

    for (const npc of this.area.npcs) {
      let rig;
      if (npc.kind === 'addison') {
        rig = this.addison;
        this.addison.root.visible = true;
      } else if (npc.kind === 'cat') {
        rig = createCat();
        this.root.add(rig.root);
        this.npcRigs.push(rig);
      } else {
        rig = createNPC(npc.kind);
        this.root.add(rig.root);
        this.npcRigs.push(rig);
      }
      rig.root.position.set(npc.x, 0, npc.z);
      rig.root.rotation.y = npc.rot || 0;
      rig.npcDef = npc;
    }
    this.audioLevel = 0;
  }

  setPromptTarget(it) {
    this.promptTarget = it;
  }

  tryInteract(g) {
    if (this.mode !== 'play' || !this.promptTarget) return false;
    g.audio.sfx('ui');
    const target = this.promptTarget;
    this.mo.root.rotation.y = Math.atan2(target.x - this.mo.root.position.x, target.z - this.mo.root.position.z);
    const res = target.action(g);
    return res !== false;
  }

  startRagdoll(ms = 2200) {
    if (this.ragdollTimer > 0) return;
    this.ragdollTimer = ms / 1000;
    this.mo.root.visible = false;
    this.ragdollParts = [];
    const colors = [0xa97c56, 0xe4e2d8, 0x3d4a5c, 0x241c14];
    for (let i = 0; i < 9; i++) {
      const part = box(0.18 + Math.random() * 0.12, 0.16, 0.2, retroMaterial(`rag${i % 4}`, { color: colors[i % 4] }), [
        this.mo.root.position.x + (Math.random() - 0.5) * 0.5,
        0.9 + Math.random() * 0.5,
        this.mo.root.position.z + (Math.random() - 0.5) * 0.5,
      ]);
      part.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 3.4, Math.random() * 2.6, (Math.random() - 0.5) * 3.4);
      this.root.add(part);
      this.ragdollParts.push(part);
    }
    this.tilt = 0.4;
  }

  /** Where a screen point lands on the floor of the current area (null if it misses). */
  groundAt(clientX, clientY) {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.ray.setFromCamera(ndc, this.camera);
    const dir = this.ray.ray.direction;
    if (Math.abs(dir.y) < 1e-4) return null;
    const t = -this.ray.ray.origin.y / dir.y;
    if (t <= 0 || t > 40) return null;
    const hit = this.ray.ray.origin.clone().addScaledVector(dir, t);
    const b = this.area?.bounds;
    if (b) {
      hit.x = clamp(hit.x, b.minX, b.maxX);
      hit.z = clamp(hit.z, b.minZ, b.maxZ);
    }
    return hit;
  }

  setMoveTarget(spot) {
    this.moveTarget = { x: spot.x, z: spot.z };
    if (!this.marker) {
      const ring = new THREE.RingGeometry(0.17, 0.235, 20);
      const m = new THREE.MeshBasicMaterial({ color: 0xf4e7b0, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
      this.marker = new THREE.Mesh(ring, m);
      this.marker.rotation.x = -Math.PI / 2;
      this.marker.renderOrder = 2;
      this.root.add(this.marker);
    }
    this.marker.position.set(spot.x, 0.02, spot.z);
    this.marker.visible = true;
    this.markerFade = 1;
  }

  update(dt, g) {
    this.time += dt;
    retroUniforms.time.value = this.time * 1.0;

    if (this.mode === 'menu') {
      this.updateMenu(dt, g);
      return;
    }
    this.updatePlay(dt, g);
  }

  updateMenu(dt, g) {
    this.menuTime += dt;
    const level = g.audio?.level?.() ?? 0;
    this.audioLevel += (level - this.audioLevel) * 0.15;
    animateMo(this.mo, dt, { walking: false, high: 0 });
    // A slow, dreadful sway, as though the corridor is breathing
    this.mo.root.position.x = 0.1 + Math.sin(this.menuTime * 0.34) * 0.06;
    this.mo.head.rotation.y = Math.sin(this.menuTime * 0.22) * 0.16;
    if (this.addison.root.visible) animateAddison(this.addison, dt * 0.6);

    const shake = this.audioLevel * 0.02;
    this.camera.position.set(
      Math.sin(this.menuTime * 0.19) * 0.12 + (Math.random() - 0.5) * shake,
      1.52 + Math.sin(this.menuTime * 0.27) * 0.035,
      2.15 - Math.sin(this.menuTime * 0.11) * 0.14
    );
    this.camera.lookAt(0.02, 1.31 + Math.sin(this.menuTime * 0.4) * 0.01, 0);
    this.camera.rotation.z = Math.sin(this.menuTime * 0.31) * 0.006 + this.audioLevel * 0.01;

    // audio-reactive fog: the corridor closes in on the loud parts
    const f = retroUniforms.fogFar;
    f.value = CONFIG.render.fogFar * (0.82 + this.audioLevel * 0.4);
    retroUniforms.fogNear.value = CONFIG.render.fogNear * (0.8 + this.audioLevel * 1.2);
  }

  updatePlay(dt, g) {
    const s = g.state;
    const canMove = !g.modalOpen && !g.phoneOpen && g.mode === 'play';

    // Camera orbit: Q/E, the shoulder buttons, the right stick, or a mouse drag.
    // A positive orbit means "turn the view to the right". Since forward is (sin yaw, cos yaw),
    // whose screen-right is (-cos yaw, sin yaw), turning right means *decreasing* the yaw —
    // adding it swung the camera the wrong way and made every left/right control feel mirrored.
    const orbit = g.input?.orbitDelta || 0;
    if (orbit) this.camYaw -= orbit;

    // Movement is camera-relative, so W is always into the screen. A tap on the floor feeds the
    // same model as a target, and both run through one eased velocity — that is what stops the
    // start/stop snap that made the walk feel janky.
    const mx = canMove ? (g.input?.move?.x || 0) : 0;
    const my = canMove ? (g.input?.move?.y || 0) : 0;
    const len = Math.hypot(mx, my);
    const keyed = len > 0.08;
    if (keyed) this.moveTarget = null;

    if (canMove && g.input?.clicks?.length) {
      const click = g.input.clicks.shift();
      const spot = this.groundAt(click.x, click.y);
      if (spot) this.setMoveTarget(spot);
    } else if (g.input?.clicks) {
      g.input.clicks.length = 0;
    }
    if (this.moveTarget) {
      const rest = Math.hypot(this.moveTarget.x - this.mo.root.position.x, this.moveTarget.z - this.mo.root.position.z);
      if (rest < 0.16) this.moveTarget = null;
    }

    const impairment = Math.min(1, (s.stats.withdrawal / 140) + (s.high.level / 240));
    // Take the basis from the camera that is actually on screen rather than from camYaw: walls
    // clamp the follow camera and it lags behind Mo, so the two can disagree by a few degrees,
    // and steering by camYaw then fights the picture.
    const basis = this.cameraBasis();
    const fwdX = basis.fx;
    const fwdZ = basis.fz;
    const rightX = basis.rx;
    const rightZ = basis.rz;
    let dirX = 0;
    let dirZ = 0;
    if (keyed) {
      const nxm = mx / len;
      const nym = my / len;
      dirX = fwdX * nym + rightX * nxm;
      dirZ = fwdZ * nym + rightZ * nxm;
    } else if (this.moveTarget) {
      const tx = this.moveTarget.x - this.mo.root.position.x;
      const tz = this.moveTarget.z - this.mo.root.position.z;
      const tl = Math.hypot(tx, tz) || 1;
      dirX = tx / tl;
      dirZ = tz / tl;
    }

    let speed = 2.45;
    if (g.input?.lastDevice === 'pad') speed *= 1.05;
    if (impairment > 0.5) speed *= 0.78;
    if (s.stats.energy < 15) speed *= 0.72;

    const ease = Math.min(1, dt * (dirX || dirZ ? 11 : 15));
    this.vel.x += (dirX * speed - this.vel.x) * ease;
    this.vel.z += (dirZ * speed - this.vel.z) * ease;
    if (!dirX && !dirZ && Math.hypot(this.vel.x, this.vel.z) < 0.06) { this.vel.x = 0; this.vel.z = 0; }
    const speedNow = Math.hypot(this.vel.x, this.vel.z);
    this.walking = speedNow > 0.22;

    if (this.walking) {
      let vx = this.vel.x;
      let vz = this.vel.z;
      // wander when impaired
      if (impairment > 0.35) {
        vx += Math.sin(this.time * 3.1) * impairment * 0.55;
        vz += Math.cos(this.time * 2.7) * impairment * 0.55;
      }
      const beforeX = this.mo.root.position.x;
      const beforeZ = this.mo.root.position.z;
      const b = this.area.bounds;
      const nx = clamp(beforeX + vx * dt, b.minX, b.maxX);
      const nz = clamp(beforeZ + vz * dt, b.minZ, b.maxZ);
      if (!this.blocked(nx, beforeZ)) this.mo.root.position.x = nx;
      if (!this.blocked(this.mo.root.position.x, nz)) this.mo.root.position.z = nz;
      // a target behind a wall is dropped instead of shoving him against it forever
      const stuck = Math.abs(this.mo.root.position.x - beforeX) < 1e-5 && Math.abs(this.mo.root.position.z - beforeZ) < 1e-5;
      if (stuck && this.moveTarget) this.moveTarget = null;

      const targetRot = Math.atan2(vx, vz);
      this.mo.root.rotation.y += angleDelta(this.mo.root.rotation.y, targetRot) * Math.min(1, dt * 10);
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.40 * (2.45 / Math.max(1.2, speedNow));
        g.audio?.sfx?.('step');
      }
    }

    // the tap marker: a small ring on the floor that turns and fades as he arrives
    if (this.marker) {
      if (this.moveTarget) this.markerFade = 1;
      this.markerFade = Math.max(0, this.markerFade - dt * (this.moveTarget ? 0 : 0.9));
      this.marker.visible = this.markerFade > 0.01;
      this.marker.material.opacity = this.markerFade * 0.8;
      this.marker.rotation.z += dt * 1.1;
    }

    // animation
    animateMo(this.mo, dt, {
      walking: this.walking,
      high: s.high.level,
      withdrawal: s.stats.withdrawal,
      speed: 1,
    });

    const mod = minuteOfDay(s.clock.m);
    for (const rig of this.npcRigs) {
      if (rig.type === 'cat') { animateNPC(rig, dt); continue; }
      this.patrolNPC(rig, dt, g);
      const settled = !rig.walking && !!rig.npcDef?.sit;
      animateNPC(rig, dt, {
        walking: !!rig.walking,
        sitting: settled && mod < 22 * 60 && mod >= 7 * 60,
        sleeping: settled && (mod >= 22 * 60 || mod < 7 * 60),
      });
    }

    // street encounters, on a slow clock so they are events rather than background noise
    this.streetTimer = (this.streetTimer ?? 10) - dt;
    if (this.streetTimer <= 0) {
      this.streetTimer = 16;
      if (canMove && this.areaId === 'street') maybeStreetEvent(g);
    }
    if (this.addison.root.visible) animateAddison(this.addison, dt);

    // camera follow — pulled in and clamped so it never leaves the room or clips a wall
    const interior = this.areaId === 'apartment' || this.areaId === 'church';
    const followDist = interior ? 2.45 : 4.1;
    const camHeight = interior ? 1.98 : 2.62;
    const b = this.area.bounds;
    const margin = 0.42;
    const desiredPos = new THREE.Vector3(
      this.mo.root.position.x - Math.sin(this.camYaw) * followDist,
      camHeight + (impairment * 0.06),
      this.mo.root.position.z - Math.cos(this.camYaw) * followDist
    );
    desiredPos.x = clamp(desiredPos.x, b.minX + margin, b.maxX - margin);
    desiredPos.z = clamp(desiredPos.z, b.minZ + margin, b.maxZ - margin);
    if (this.blocked(desiredPos.x, desiredPos.z)) {
      for (let t = 0.85; t >= 0.12; t -= 0.12) {
        const cx = lerp(this.mo.root.position.x, desiredPos.x, t);
        const cz = lerp(this.mo.root.position.z, desiredPos.z, t);
        if (!this.blocked(cx, cz)) {
          desiredPos.x = cx;
          desiredPos.z = cz;
          break;
        }
      }
    }
    this.camPos.lerp(desiredPos, Math.min(1, dt * 5.2));
    this.camera.position.copy(this.camPos);
    const look = new THREE.Vector3(this.mo.root.position.x, 1.16, this.mo.root.position.z);
    this.camTarget.lerp(look, Math.min(1, dt * 6));
    this.camera.lookAt(this.camTarget);
    const sway = Math.sin(this.time * 1.3) * (s.high.level / 100) * 0.05 + Math.sin(this.time * 2.1) * (s.stats.withdrawal / 200) * 0.04;
    this.camera.rotation.z += sway;
    this.tilt = Math.max(0, this.tilt - dt * 1.4);
    this.camera.rotation.z += this.tilt * 0.4;

    // ragdoll physics
    if (this.ragdollTimer > 0) {
      this.ragdollTimer -= dt;
      for (const p of this.ragdollParts) {
        const v = p.userData.vel;
        v.y -= 9.8 * dt;
        p.position.addScaledVector(v, dt);
        p.rotation.x += v.x * dt * 1.4;
        p.rotation.z += v.z * dt * 1.4;
        if (p.position.y < 0.09) {
          p.position.y = 0.09;
          v.y = Math.abs(v.y) * 0.32;
          v.x *= 0.72;
          v.z *= 0.72;
        }
      }
      if (this.ragdollTimer <= 0) {
        for (const p of this.ragdollParts) this.root.remove(p);
        this.ragdollParts = [];
        this.mo.root.visible = true;
      }
    }

    // interaction prompt
    let best = null;
    let bestDist = Infinity;
    for (const it of this.interactables) {
      const d = Math.hypot(it.x - this.mo.root.position.x, it.z - this.mo.root.position.z);
      if (d < (it.radius || 1.75) && d < bestDist) {
        best = it;
        bestDist = d;
      }
    }
    this.promptTarget = best;
    const prompt = best ? `${best.label}${best.sub ? `|${best.sub}` : ''}` : null;
    if (prompt !== this.prompt) {
      this.prompt = prompt;
      g.hud?.setPrompt(best ? { label: best.label, sub: best.sub } : null);
    }
    if (this.promptTarget && canMove) {
      // subtle highlight: face the interaction when close, no shader tricks needed
    }
  }

  /** Screen-relative axes in world space, straight off the live camera. */
  cameraBasis() {
    const cam = this.camera;
    cam.updateMatrixWorld();
    const e = cam.matrixWorld.elements;
    let rx = e[0];
    let rz = e[2];       // camera local +X is screen-right
    let fx = -e[8];
    let fz = -e[10];     // camera local -Z is into the screen
    const rl = Math.hypot(rx, rz);
    const fl = Math.hypot(fx, fz);
    if (rl > 1e-4 && fl > 1e-4) {
      rx /= rl; rz /= rl; fx /= fl; fz /= fl;
      return { rx, rz, fx, fz };
    }
    // camera pointing straight down (or a degenerate matrix): fall back to the orbit angle
    const c = Math.cos(this.camYaw);
    const s = Math.sin(this.camYaw);
    return { rx: -c, rz: s, fx: s, fz: c };
  }

  /** NPCs keep to their own patch: pick a spot near home, walk there, stand, repeat. */
  patrolNPC(rig, dt, g) {
    const def = rig.npcDef;
    if (!def) return;

    // A scheduled character walks to wherever they are supposed to be right now and stays
    // there until the window changes; unscheduled ones keep to a small patch near home.
    const target = g ? scheduleTarget(def.kind, minuteOfDay(g.state.clock.m)) : null;
    if (target) {
      const dx = target.x - rig.root.position.x;
      const dz = target.z - rig.root.position.z;
      const dist = Math.hypot(dx, dz);
      rig.walking = dist > 0.22;
      if (!rig.walking) return;
      const speed = 0.95;
      const nx = rig.root.position.x + (dx / dist) * speed * dt;
      const nz = rig.root.position.z + (dz / dist) * speed * dt;
      const b = this.area.bounds;
      if (nx > b.minX && nx < b.maxX && nz > b.minZ && nz < b.maxZ && !this.blocked(nx, nz)) {
        rig.root.position.x = nx;
        rig.root.position.z = nz;
      }
      rig.root.rotation.y += angleDelta(rig.root.rotation.y, Math.atan2(dx, dz)) * Math.min(1, dt * 5);
      return;
    }

    if (!rig.wander) {
      rig.wander = {
        homeX: rig.root.position.x,
        homeZ: rig.root.position.z,
        tx: rig.root.position.x,
        tz: rig.root.position.z,
        timer: 1 + Math.random() * 3,
      };
    }
    const w = rig.wander;
    w.timer -= dt;
    if (w.timer <= 0) {
      w.timer = 2.5 + Math.random() * 4.5;
      const a = Math.random() * Math.PI * 2;
      const r = 0.5 + Math.random() * (def.roam ?? 1.5);
      w.tx = w.homeX + Math.cos(a) * r;
      w.tz = w.homeZ + Math.sin(a) * r;
    }
    const dx = w.tx - rig.root.position.x;
    const dz = w.tz - rig.root.position.z;
    const dist = Math.hypot(dx, dz);
    rig.walking = dist > 0.14;
    if (!rig.walking) return;
    const speed = 0.8;
    const nx = rig.root.position.x + (dx / dist) * speed * dt;
    const nz = rig.root.position.z + (dz / dist) * speed * dt;
    const b = this.area.bounds;
    if (nx > b.minX && nx < b.maxX && nz > b.minZ && nz < b.maxZ && !this.blocked(nx, nz)) {
      rig.root.position.x = nx;
      rig.root.position.z = nz;
    } else {
      w.timer = 0; // something is in the way; choose another spot
    }
    rig.root.rotation.y += angleDelta(rig.root.rotation.y, Math.atan2(dx, dz)) * Math.min(1, dt * 6);
  }

  blocked(x, z) {
    if (!this.area?.solids) return false;
    for (const b of this.area.solids) {
      if (Math.abs(x - b.x) < b.w / 2 + 0.22 && Math.abs(z - b.z) < b.d / 2 + 0.22) return true;
    }
    return false;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
