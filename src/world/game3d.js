/** The 3D world: renderer, camera, areas, movement, interaction, ragdoll, menu scene. */
import * as THREE from '../../vendor/three.module.js';
import { createRenderer, setSize, retroMaterial, retroUniforms, box } from '../render/retro.js';
import { createMo, createAddison, createNPC, createCat, animateMo, animateAddison, animateNPC } from './characters.js';
import { buildApartment, buildStreet, buildChurch, buildMenuWorld } from './areas.js';
import { CONFIG } from '../core/config.js';
import { clamp, lerp } from '../core/util.js';

const BUILDERS = { apartment: buildApartment, street: buildStreet, church: buildChurch };

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
    const keys = g.input?.keys || new Set();
    const canMove = !g.modalOpen && !g.phoneOpen && g.mode === 'play';

    let dx = 0, dz = 0;
    if (canMove) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) dz -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) dz += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
    }
    const len = Math.hypot(dx, dz);
    this.walking = len > 0;
    const impairment = Math.min(1, (s.stats.withdrawal / 140) + (s.high.level / 240));
    if (this.walking) {
      dx /= len; dz /= len;
      // camera-relative movement: camera looks along -z from behind the player
      const cYaw = this.camYaw;
      const wx = dx * Math.cos(cYaw) + dz * Math.sin(cYaw);
      const wz = -dx * Math.sin(cYaw) + dz * Math.cos(cYaw);
      let speed = 2.45;
      if (impairment > 0.5) speed *= 0.78;
      if (s.stats.energy < 15) speed *= 0.72;
      let nx = this.mo.root.position.x + wx * speed * dt;
      let nz = this.mo.root.position.z + wz * speed * dt;
      // wander when impaired
      if (impairment > 0.35) {
        nx += Math.sin(this.time * 3.1) * impairment * 0.22 * dt * 6;
        nz += Math.cos(this.time * 2.7) * impairment * 0.22 * dt * 6;
      }
      const b = this.area.bounds;
      nx = clamp(nx, b.minX, b.maxX);
      nz = clamp(nz, b.minZ, b.maxZ);
      if (!this.blocked(nx, this.mo.root.position.z)) this.mo.root.position.x = nx;
      if (!this.blocked(this.mo.root.position.x, nz)) this.mo.root.position.z = nz;

      const targetRot = Math.atan2(wx, wz);
      this.mo.root.rotation.y += angleDelta(this.mo.root.rotation.y, targetRot) * Math.min(1, dt * 12);
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.42;
        g.audio?.sfx?.('step');
      }
    }

    // animation
    animateMo(this.mo, dt, {
      walking: this.walking,
      high: s.high.level,
      withdrawal: s.stats.withdrawal,
      speed: 1,
    });

    for (const rig of this.npcRigs) {
      if (rig.type === 'cat') { animateNPC(rig, dt); continue; }
      this.patrolNPC(rig, dt);
      animateNPC(rig, dt, { walking: !!rig.walking });
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

  /** NPCs keep to their own patch: pick a spot near home, walk there, stand, repeat. */
  patrolNPC(rig, dt) {
    const def = rig.npcDef;
    if (!def) return;
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
