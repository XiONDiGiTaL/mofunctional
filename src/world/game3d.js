/** The 3D world: renderer, camera, areas, movement, interaction, ragdoll, menu scene. */
import * as THREE from '../../vendor/three.module.js';
import { createRenderer, setSize, retroMaterial, retroUniforms, box } from '../render/retro.js';
import { createMo, createAddison, createNPC, createCat, animateMo, animateAddison, animateNPC } from './characters.js';
import { buildApartment, buildStreet, buildChurch, buildBodega, buildHabibs, buildMenuWorld } from './areas.js';
import { TitleScene } from './title.js';
import { EatAnim } from './eating.js';
import { DealerWalker, HandoffBeat } from './handoff.js';
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
    this.camFocus = new THREE.Vector3(0, 0, 0);
    this.camBoom = 4.1;
    this.boomHeight = 2.62;
    this.camYaw = 0;
    this.camSwing = 0;
    this.tilt = 0;
    this.ragdollTimer = 0;
    this.ragdollParts = [];
    this.time = 0;
    this.audioLevel = 0;
    this.stepTimer = 0;
    this.menuGroup = null;
    this.menuTime = 0;
    this.titleScene = null;
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
    this.eating?.stop();
    this.handoff?.stop();
    this.dealerWalker?.remove();
    if (this.titleScene) {
      this.titleScene.dispose();
      this.titleScene = null;
    }
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
    this.titleScene = new TitleScene(this);
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

    // an area can say where each of its doors lets out; otherwise there is one spawn
    const spawn = (spawnId && this.area.spawnFor?.(spawnId)) || this.area.spawn;
    this.mo.root.visible = true;
    this.mo.root.position.set(spawn.x, 0, spawn.z);
    this.mo.root.rotation.set(0, spawn.rot, 0);
    this.camYaw = spawn.rot;
    this.camSwing = 0;
    this.tilt = 0;

    // camera snap
    const behind = new THREE.Vector3(Math.sin(spawn.rot), 0, Math.cos(spawn.rot)).multiplyScalar(4.2);
    this.camera.position.set(this.mo.root.position.x + behind.x, 2.9, this.mo.root.position.z + behind.z);
    this.camPos.copy(this.camera.position);
    this.camFocus.set(this.mo.root.position.x, 0, this.mo.root.position.z);
    this.camBoom = this.roomBoom(id !== 'street');
    this.boomHeight = id !== 'street' ? 1.98 : 2.62;
    this.swingGoal = 0;
    this.prevCamYaw = this.camYaw;
    this.walking = false;
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
    // a dealer who is already waiting is standing there when Mo steps out
    if (!this.dealerWalker) this.dealerWalker = new DealerWalker(this);
    this.dealerWalker.sync(g, true);
  }

  /** Mo's half of the exchange: hand out, hand back, a smile. */
  playHandoff() {
    if (!this.handoff) this.handoff = new HandoffBeat(this);
    const r = this.dealerWalker?.rig?.root.position;
    const mo = this.mo.root.position;
    this.walking = false;
    this.vel?.set(0, 0, 0);
    this.moveTarget = null;
    this.handoff.play(r ? r.x : mo.x, r ? r.z : mo.z + 1);
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
    this.moveTarget = { x: spot.x, z: spot.z, best: Infinity, stall: 0 };
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

  /** Mo eats (or drinks, or smokes) `itemId` on screen; bites call back into the game's sfx. */
  playEat(itemId, sfx) {
    if (this.mode !== 'play') return;
    if (!this.eating) this.eating = new EatAnim(this);
    this.walking = false;
    this.vel?.set(0, 0, 0);
    this.moveTarget = null;
    this.eating.play(itemId, sfx, (this.camYaw || 0) + Math.PI * 0.78);
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
    this.titleScene?.update(dt);
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
    const canMove = !g.modalOpen && !g.phoneOpen && g.mode === 'play' && !this.eating?.active && !this.handoff?.active;

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
      // A walk that stops getting closer is over. The old check only gave up when he could not
      // move at all, so a target behind a counter had him sliding along it, still walking,
      // until the player took over. Measure progress instead: 5 cm closer every 0.7 s or stop.
      else if (canMove) {
        if (rest < this.moveTarget.best - 0.05) { this.moveTarget.best = rest; this.moveTarget.stall = 0; }
        else if ((this.moveTarget.stall += dt) > 0.7) this.moveTarget = null;
      }
    }

    const impairment = Math.min(1, (s.stats.withdrawal / 140) + (s.high.level / 240));
    // Steer by the yaw the camera arm is on (the player's orbit plus any wall swing), not by the
    // rendered camera's matrix. In a tight room the arm shortens until the eye is almost over
    // his head, and the matrix's horizontal forward then swings wildly as he takes a step —
    // which turned W into whatever direction the last frame happened to point, and could leave
    // him walking off one way with no stable way back. The arm's yaw is what the view is
    // pointing along anyway, and it only moves when the player (or a swing) moves it.
    const basis = this.armBasis();
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
    } else if (this.moveTarget && canMove) {
      // a tap target only steers while he is free to move: a menu, a meal or a handoff holds him
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
      // What actually happened, not what was asked for. A wall (or the room's edge) takes the
      // blocked component out of the velocity, so he slides along it instead of building up
      // speed into it, and the walk cycle and footsteps follow the real motion: pressing
      // straight into a wall is standing still, not walking on the spot forever.
      const movedX = this.mo.root.position.x - beforeX;
      const movedZ = this.mo.root.position.z - beforeZ;
      if (Math.abs(movedX) < Math.abs(vx * dt) * 0.5) this.vel.x = 0;
      if (Math.abs(movedZ) < Math.abs(vz * dt) * 0.5) this.vel.z = 0;
      const realSpeed = Math.hypot(movedX, movedZ) / Math.max(dt, 1e-4);
      this.walking = realSpeed > 0.22;
      if (!this.walking && this.moveTarget) this.moveTarget = null;

      // face where he is trying to go (the stick or the target), so turning away from a wall
      // reads at once even while he is pressed against it
      const faceX = dirX || vx;
      const faceZ = dirZ || vz;
      const targetRot = Math.atan2(faceX, faceZ);
      this.mo.root.rotation.y += angleDelta(this.mo.root.rotation.y, targetRot) * Math.min(1, dt * 10);
      if (this.walking) {
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) {
          this.stepTimer = 0.40 * (2.45 / Math.max(1.2, realSpeed));
          g.audio?.sfx?.('step');
        }
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
    this.eating?.update(dt);
    this.handoff?.update(dt);
    this.dealerWalker?.sync(g);
    this.dealerWalker?.update(dt);

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

    // camera follow — a spring arm. The orbit is applied to the arm instantly, so turning the
    // view is crisp; only the boom length eases, sampled outward from Mo until something solid
    // stops it. That replaces the old clamp-then-shove-to-85% step, which snapped in corners.
    // Every room is an interior. Only the apartment and the church used to be, so the bodega and
    // Habib's (rooms under 7 m across) got the street's 4.1 m arm: longer than the room, it hit
    // a wall every frame, shortened, clamped and swung, which is the camera that thrashed about
    // in the shops. The arm is now sized to the room it is in.
    const interior = this.areaId !== 'street';
    const camSet = s.settings || {};
    const distMul = clamp(Number(camSet.camDist) || 1, 0.7, 1.4);
    const heightMul = clamp(Number(camSet.camHeight) || 1, 0.8, 1.35);
    const boomMax = this.roomBoom(interior) * distMul;
    // the eye rides up with the distance, so pulling the camera back still reads as a wider shot
    // in a room where the arm itself has nowhere longer to go
    const restHeight = (interior ? 1.98 : 2.62) * heightMul * distMul;
    const follow = 1 - Math.exp(-9 * dt);
    this.camFocus.x += (this.mo.root.position.x - this.camFocus.x) * follow;
    this.camFocus.z += (this.mo.root.position.z - this.camFocus.z) * follow;

    // What is there along the angle the arm is on right now (a comfortable clearance first, then
    // accept hugging the wall)?
    // A swing is a background correction, so it never argues with the player's own orbit: while
    // the view is being turned by hand the offset is held as it is (the picture then rotates
    // rigidly with the input) and only re-evaluated once the hand stops.
    const orbiting = Math.abs(angleDelta(this.prevCamYaw ?? this.camYaw, this.camYaw)) > 1e-4;
    this.prevCamYaw = this.camYaw;

    let room = this.armRoom(this.camYaw + this.camSwing, boomMax, 0.42);
    if (!room) room = this.armRoom(this.camYaw + this.camSwing, boomMax, 0.2);

    // A corner leaves the arm under a metre long at best: a close, steep shot. Swing it sideways
    // along the wall instead — 15° steps either way, stopping as soon as one gives a real side
    // view, so it leans out of the corner rather than going top-down or spinning off at random.
    // Hysteresis: a swing starts when the arm is cramped (< 1.1 m) and is only let go once the
    // straight view has real room again (> 1.6 m). One threshold both ways flipped the camera
    // back and forth every frame he stood near it.
    let swingTarget = orbiting ? this.camSwing : 0;
    const holdSwing = !orbiting && Math.abs(this.swingGoal || 0) > 0.001 && room < 1.6;
    if (holdSwing) swingTarget = this.swingGoal;
    // after a swing lets go it gets a moment to come home before another may start, or the
    // release and a fresh search hand the view back and forth around the zero line
    this.swingRest = Math.max(0, (this.swingRest || 0) - dt);
    if (!orbiting && !holdSwing && room < 1.1 && this.swingRest <= 0) {
      let bestRoom = 0;
      let bestOff = 0;
      for (let step = 1; step <= 9 && bestRoom < 1.2; step++) {
        for (const dir of [1, -1]) {
          const off = dir * step * (Math.PI / 12);
          const r = this.armRoom(this.camYaw + off, boomMax, 0.2);
          if (r > bestRoom) { bestRoom = r; bestOff = off; }
        }
      }
      // only turn the view if the side angle is clearly better than standing still
      if (bestRoom > room + 0.35) { room = bestRoom; swingTarget = bestOff; }
    }
    if (Math.abs(this.swingGoal || 0) > 0.001 && Math.abs(swingTarget) <= 0.001) this.swingRest = 0.8;
    this.swingGoal = swingTarget;
    if (holdSwing) room = Math.max(room, this.armRoom(this.camYaw + this.camSwing, boomMax, 0.2));
    // The swing is a slow scan along the wall, and it lets go at its own pace once the corner
    // opens up, so walking past a doorframe does not whip the view around.
    const swinging = Math.abs(swingTarget) > 0.001 || Math.abs(this.camSwing) > 0.001;
    const swingRate = Math.abs(swingTarget) > Math.abs(this.camSwing) ? 4.5 : 3;
    this.camSwing += (swingTarget - this.camSwing) * (1 - Math.exp(-swingRate * dt));
    // Mid-swing the arm still points at the blocked angle. Hold a workable length and let the
    // bounds clamp carry the eye along the wall, instead of collapsing to 0.3 m for half a second.
    // When even that finds nothing, shorten to an over-the-shoulder arm rather than holding a
    // length the room never agreed to: that held length is what put the eye inside shelves.
    if (!room) {
      room = this.armRoom(this.camYaw + this.camSwing, boomMax, 0);
      // pressed against something tall and looking into it: over his head is the one place left
      if (!room) {
        const yaw = this.camYaw + this.camSwing;
        const clear35 = !this.camBlocked(this.camFocus.x - Math.sin(yaw) * 0.35, this.camFocus.z - Math.cos(yaw) * 0.35);
        room = clear35 ? 0.35 : 0.1;
      }
    }

    const armYaw = this.camYaw + this.camSwing;
    const backX = -Math.sin(armYaw);
    const backZ = -Math.cos(armYaw);
    const b = this.area.bounds;
    // in fast, out slow: a wall shortening the arm is urgent, opening back up is not, and easing
    // both ways at one rate made the camera pump in and out as he clipped past a corner
    const boomRate = room < this.camBoom ? 16 : 4.5;
    this.camBoom += (room - this.camBoom) * (1 - Math.exp(-boomRate * dt));
    // the ease is for comfort, not for passing through things: if the eased length would put the
    // eye inside furniture this frame, take the clear length now (out stays eased)
    if (this.camBoom > room) {
      const ex = this.camFocus.x - Math.sin(this.camYaw + this.camSwing) * this.camBoom;
      const ez = this.camFocus.z - Math.cos(this.camYaw + this.camSwing) * this.camBoom;
      if (this.camBlocked(ex, ez)) this.camBoom = room;
    }
    // a shortened arm lifts a little to look over his shoulder; while swinging there is a side
    // view coming, so do not climb into a top-down in the meantime
    const liftPerMetre = swinging ? 0.1 : 0.28;
    const targetHeight = restHeight + impairment * 0.06 + (boomMax - this.camBoom) * liftPerMetre;
    this.boomHeight += (targetHeight - this.boomHeight) * (1 - Math.exp(-6 * dt));

    // last resort: never let the arm place the eye outside the room, whatever the corner does
    this.camPos.set(
      clamp(this.camFocus.x + backX * this.camBoom, b.minX + 0.15, b.maxX - 0.15),
      this.boomHeight,
      clamp(this.camFocus.z + backZ * this.camBoom, b.minZ + 0.15, b.maxZ - 0.15)
    );
    this.camera.position.copy(this.camPos);
    // the aim rides the same smoothed focus, so it can never lag the position and drift off Mo
    const aim = 1 - Math.exp(-12 * dt);
    this.camTarget.x += (this.camFocus.x - this.camTarget.x) * aim;
    this.camTarget.y += (1.16 - this.camTarget.y) * aim;
    this.camTarget.z += (this.camFocus.z - this.camTarget.z) * aim;
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

  /** Stop him where he stands: no momentum, no tap target, no walk cycle (menus, doors, meals). */
  haltMo() {
    this.vel?.set(0, 0, 0);
    this.moveTarget = null;
    this.walking = false;
  }

  /** The arm length a place wants: the street's long lens, or most of a room's short side. */
  roomBoom(interior) {
    if (!interior) return 4.1;
    const b = this.area?.bounds;
    if (!b) return 2.45;
    const short = Math.min(b.maxX - b.minX, b.maxZ - b.minZ);
    return clamp(short * 0.42, 1.8, 2.45);
  }

  /** Longest arm, in metres, that fits along `yaw` without leaving the room or hitting something. */
  armRoom(yaw, boomMax, clearance) {
    if (!this.area) return boomMax;
    const b = this.area.bounds;
    const bx = -Math.sin(yaw);
    const bz = -Math.cos(yaw);
    // March out from Mo and stop at the first thing in the way, like a ray. Searching inward from
    // the longest length instead accepted any clear endpoint, including the far side of a shelf,
    // and the camera then eased out through the shelf to look at the back of it.
    let clear = 0;
    for (let room = 0.3; room <= boomMax + 1e-6; room += 0.1) {
      const px = this.camFocus.x + bx * room;
      const pz = this.camFocus.z + bz * room;
      const inRoom = px > b.minX + clearance && px < b.maxX - clearance &&
        pz > b.minZ + clearance && pz < b.maxZ - clearance;
      if (!inRoom || this.camBlocked(px, pz)) break;
      clear = room;
    }
    return clear > 0.3 ? Math.min(clear, boomMax) : 0;
  }

  /** Screen-relative axes in world space from the camera arm's yaw: stable at any boom length. */
  armBasis() {
    const yaw = (this.camYaw || 0) + (this.camSwing || 0);
    const c = Math.cos(yaw);
    const sn = Math.sin(yaw);
    return { rx: -c, rz: sn, fx: sn, fz: c };
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

  /**
   * The camera's own collision test: outside the furniture itself (plus 8 cm), not outside
   * Mo's padded footprint. Using Mo's 22 cm body margin for the eye rejected perfectly good arm
   * lengths next to every counter and shelf, and pushed the arm into the fallbacks.
   */
  camBlocked(x, z) {
    if (!this.area?.solids) return false;
    for (const b of this.area.solids) {
      if ((b.h ?? 2.4) < 1.5) continue; // below the eye: the camera looks over it
      if (Math.abs(x - b.x) < b.w / 2 + 0.08 && Math.abs(z - b.z) < b.d / 2 + 0.08) return true;
    }
    return false;
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
