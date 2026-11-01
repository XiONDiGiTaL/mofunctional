/** The 3D world: renderer, camera, areas, movement, interaction, ragdoll, menu scene. */
import * as THREE from '../../vendor/three.module.js';
import { createRenderer, setSize, retroMaterial, retroUniforms, box } from '../render/retro.js';
import { createMo, createAddison, createNPC, createCat, animateMo, animateAddison, animateNPC } from './characters.js';
import { buildApartment, buildStreet, buildChurch, buildBodega, buildHabibs, buildPark, buildClinic, buildQuikStop, buildMenuWorld, partnerMenu } from './areas.js';
import { Affection } from './affection.js';
import { buildWalkup, buildAvenue, buildRestaurant, buildPrecinct, buildLaundromat, buildLaundryBack } from './places.js';
import * as police from '../systems/police.js';
import * as fights from '../systems/fights.js';
import { FightMeter } from '../ui/fight.js';
import { RideCar } from './ridecar.js';
import { Traffic } from './traffic.js';
import { buildGrid, findPath, wanderSpot } from './pathing.js';
import { StreetLife, applyAct, dogState } from './streetlife.js';
import { TitleScene } from './title.js';
import { EatAnim } from './eating.js';
import { DealerWalker, HandoffBeat } from './handoff.js';
import { SubstanceUse, CollapseFall, DanceBeat } from './animations.js';
import { isPartnerId, partnerState, PARTNER_KEYS, homeChat } from '../systems/romance.js';
import { CONFIG } from '../core/config.js';
import { clamp, lerp, minuteOfDay, dayOf } from '../core/util.js';
import { scheduleTarget, partnerTarget, PARTNER_AREA_NAMES, PARTNER_HOME_SPOTS, strangerRunIns, strangerTarget } from './schedules.js';
import { ceilingFor, armLength, armMax, eyeHeight, liftFor } from './cameraLimits.js';
import { strangerMenu, strangerLabel, niaMenu } from './encounters.js';
import { sisterTarget } from '../systems/sister.js';
import { maybeStreetEvent } from '../systems/street.js';

const BUILDERS = {
  apartment: buildApartment, street: buildStreet, church: buildChurch,
  bodega: buildBodega, habibs: buildHabibs, park: buildPark, clinic: buildClinic, quikstop: buildQuikStop,
  walkup: (g) => buildWalkup(g, { partnerMenu }), avenue: buildAvenue, restaurant: buildRestaurant, precinct: buildPrecinct, laundromat: buildLaundromat, laundry_back: buildLaundryBack,
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
    this.affection?.stop();
    this.fightMeter?.close();
    this.removeThug?.();
    this.substance?.stop();
    this.dance?.stop();
    this.collapse?.stop();
    this.dealerWalker?.remove();
    this.rideCar?.remove();
    this.traffic?.remove();
    this.traffic = null;
    this.streetLife?.remove();
    this.streetLife = null;
    this.crossing = null;
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
      const row = id === 'street' && !npc.debug ? scheduleTarget(npc.kind, minuteOfDay(g.state.clock.m)) : null;
      rig.root.position.set(row && !row.away ? row.x : npc.x, 0, row && !row.away ? row.z : npc.z);
      if (npc.scale) rig.root.scale.setScalar(npc.scale); // the kids
      rig.root.rotation.y = npc.rot || 0;
      rig.npcDef = npc;
      // the three women carry a heart until one of them is actually his girlfriend
      if (isPartnerId(npc.kind) && !partnerState(g.state, npc.kind).girlfriend) this.addHeart(rig, npc.kind);
    }
    // Nia, when she has come over: walks into Unit 3B with a bag of food (systems/sister.js)
    if (id === 'apartment') {
      const rig = createNPC('nia');
      rig.npcDef = { kind: 'nia', sister: true, talk: 'sister_nia', roam: 0.6 };
      rig.root.visible = false;
      this.root.add(rig.root);
      this.npcRigs.push(rig);
      this.interactables.push({ id: 'sister_nia', label: 'Talk to Nia', sub: '', x: 0, z: 0, radius: 1.5, hidden: true, action: (gg) => niaMenu(gg) });
      this.partnerPresence(rig, 0, g, true);
    }
    // Stephanie, Melanie and Diana go where their day takes them (schedules.js): each of them has
    // a rig in every area she ever visits, shown only while her schedule has her here
    if (PARTNER_AREA_NAMES[id]) {
      const already = new Set(this.area.npcs.map((n) => n.kind));
      for (const pid of PARTNER_KEYS) {
        if (already.has(pid)) continue;
        const rig = createNPC(pid);
        rig.npcDef = { kind: pid, partner: true, talk: `partner_${pid}`, roam: 0.5 };
        rig.root.visible = false;
        this.root.add(rig.root);
        this.npcRigs.push(rig);
        if (!partnerState(g.state, pid).girlfriend) this.addHeart(rig, pid);
        this.interactables.push({
          id: `partner_${pid}`, label: `Talk to ${CONFIG.partners[pid].name}`, sub: '', x: 0, z: 0, radius: 1.6, hidden: true,
          action: (gg) => partnerMenu(gg, pid),
        });
        this.partnerPresence(rig, 0, g, true);
      }
      // and whichever of the FeedLove women are out on the block here today
      const day = dayOf(g.state.clock.m);
      const seen = new Set();
      for (const run of strangerRunIns(day)) {
        if (run.area !== id || seen.has(run.id)) continue;
        seen.add(run.id);
        const rig = createNPC(run.id);
        rig.npcDef = { kind: run.id, stranger: true, talk: `stranger_${run.id}`, roam: 0.4 };
        rig.root.visible = false;
        this.root.add(rig.root);
        this.npcRigs.push(rig);
        this.interactables.push({
          id: `stranger_${run.id}`, label: strangerLabel(g.state, run.id), sub: '', x: 0, z: 0, radius: 1.4, hidden: true,
          action: (gg) => strangerMenu(gg, run.id),
        });
        this.partnerPresence(rig, 0, g, true);
      }
    }
    // a talk prompt belongs to a person, not to the spot they started on: tie each one to its rig
    for (const rig of this.npcRigs) {
      const talkId = rig.npcDef?.talk;
      if (!talkId) continue;
      rig.talkIt = this.interactables.find((it) => it.id === talkId || (talkId === 'homeless' && it.id === 'homelessMan')) || null;
    }
    this.collapse?.reset();
    this.audioLevel = 0;
    // a dealer who is already waiting is standing there when Mo steps out
    if (!this.dealerWalker) this.dealerWalker = new DealerWalker(this);
    this.dealerWalker.sync(g, true);
    // a HailMary car that is already waiting here is parked at the curb when he steps out
    if (!this.rideCar) this.rideCar = new RideCar(this);
    this.rideCar.sync(g, true);
    // indoors, a walkability grid so wanderers go round the furniture (world/pathing.js)
    this.navGrid = id !== 'street' && id !== 'avenue' && id !== 'park' ? buildGrid(this.area) : null;
    // cars up and down the road, where there is a road
    this.traffic = this.area.traffic ? new Traffic(this, this.area.traffic) : null;
    // smoke, the dog, the things that happen
    this.streetLife = new StreetLife(this, g);
  }

  /**
   * A heart over one of the three women, the first time Mo sees her: a PS1 heart, two squares and
   * a diamond, bobbing at head height. It says "you could try", not "she is interested".
   */
  addHeart(rig, kind) {
    const mat = retroMaterial(`heart_${kind}`, { color: 0xff4a7a, emissive: 0.5, unlit: true });
    const g = new THREE.Group();
    g.add(box(0.075, 0.075, 0.02, mat, [-0.033, 0.012, 0]));
    g.add(box(0.075, 0.075, 0.02, mat, [0.033, 0.012, 0]));
    const tip = box(0.105, 0.105, 0.02, mat, [0, -0.038, 0]);
    tip.rotation.z = Math.PI / 4;
    g.add(tip);
    g.position.set(0, 2.06, 0);
    rig.root.add(g);
    rig.heart = g;
  }

  /** One of the fictional substances, on screen, before any of its numbers move. */
  playSubstance(itemId, style, onDone) {
    if (this.mode !== 'play') { onDone?.(); return false; }
    if (!this.substance) this.substance = new SubstanceUse(this);
    this.walking = false;
    this.vel?.set(0, 0, 0);
    this.moveTarget = null;
    this.substance.play(itemId, style, onDone);
    return true;
  }

  /** The fall. The caller fades the screen and decides where he wakes up. */
  playCollapse(onDone) {
    if (!this.collapse) this.collapse = new CollapseFall(this);
    this.walking = false;
    this.vel?.set(0, 0, 0);
    this.moveTarget = null;
    this.collapse.play(onDone);
  }

  /** A dance on the spot for `seconds` of real time; game time is the caller's business. */
  playDance(seconds = 8) {
    if (this.mode !== 'play') return;
    if (!this.dance) this.dance = new DanceBeat(this);
    this.walking = false;
    this.vel?.set(0, 0, 0);
    this.moveTarget = null;
    this.dance.play();
    clearTimeout(this.danceTimer);
    this.danceTimer = setTimeout(() => this.dance?.stop(), Math.max(1, seconds) * 1000);
  }

  /**
   * Debug: put an NPC of `kind` a couple of metres in front of Mo, on a clear spot. It is a real rig
   * in the area's NPC list (it patrols, it is removed with the area), flagged so schedules ignore it.
   */
  debugSpawnNPC(kind) {
    if (this.mode !== 'play' || !this.area) return null;
    const mo = this.mo.root.position;
    const yaw = this.mo.root.rotation.y;
    let x = mo.x + Math.sin(yaw) * 1.6;
    let z = mo.z + Math.cos(yaw) * 1.6;
    const b = this.area.bounds;
    x = clamp(x, b.minX + 0.3, b.maxX - 0.3);
    z = clamp(z, b.minZ + 0.3, b.maxZ - 0.3);
    if (this.blocked(x, z)) { x = mo.x; z = mo.z; }
    const rig = createNPC(kind);
    rig.root.position.set(x, 0, z);
    rig.root.rotation.y = Math.atan2(mo.x - x, mo.z - z);
    rig.npcDef = { kind, x, z, debug: true };
    this.root.add(rig.root);
    this.npcRigs.push(rig);
    return rig;
  }

  /** Debug: remove the NPC of `kind` nearest to Mo in this area (the cat and Addison excluded). */
  debugDespawnNPC(kind) {
    const mo = this.mo.root.position;
    let best = null;
    let bestD = Infinity;
    for (const rig of this.npcRigs) {
      if (rig.type === 'cat' || (kind && rig.npcDef?.kind !== kind)) continue;
      const d = rig.root.position.distanceTo(mo);
      if (d < bestD) { best = rig; bestD = d; }
    }
    if (!best) return false;
    this.root.remove(best.root);
    this.npcRigs.splice(this.npcRigs.indexOf(best), 1);
    if (best.talkIt) {
      const i = this.interactables.indexOf(best.talkIt);
      if (i >= 0) this.interactables.splice(i, 1);
    }
    return true;
  }

  /**
   * Debug: snap every NPC to where they should be right now — scheduled ones to their schedule
   * row for this minute (street only), everyone else back to where the area placed them — and
   * forget their wander plans, so a run that has knotted them up in a corner starts clean.
   */
  resetNPCs(g) {
    for (const rig of this.npcRigs) {
      const def = rig.npcDef;
      if (!def) continue;
      const row = this.areaId === 'street' && !def.debug ? scheduleTarget(def.kind, minuteOfDay(g.state.clock.m)) : null;
      rig.root.position.set(row ? row.x : def.x, 0, row ? row.z : def.z);
      rig.wander = null;
      rig.walking = false;
    }
    return this.npcRigs.length;
  }

  /**
   * One of the three, in this area or not, by her schedule. Arriving while Mo is here she comes in
   * through the area's door and walks to her spot; leaving, she walks out through it. On a fresh
   * load she is simply where she should be.
   */
  partnerPresence(rig, dt, g, fresh = false) {
    const def = rig.npcDef;
    const mod = minuteOfDay(g.state.clock.m);
    // the live-in id is what tells her schedule that home is Unit 3B now; without it she is
    // still on the block's day and the apartment is somewhere she never is
    const liveIn = g.state?.romance?.liveIn || null;
    const row = def.sister ? sisterTarget(g.state) : def.stranger ? strangerTarget(def.kind, dayOf(g.state.clock.m), mod)
      : partnerTarget(def.kind, mod, liveIn);
    const here = !!row && !row.away && row.area === this.areaId;
    // the pose comes from the row she is standing at: asleep in the bed, folded onto the couch
    if (here) rig.pose = row.pose || null;
    const talk = rig.talkIt || this.interactables.find((it) => it.id === def.talk);
    if (talk) {
      talk.sub = here ? row.note : '';
      if (def.stranger) talk.label = strangerLabel(g.state, def.kind);
    }
    if (rig.holding && !here) {
      // her day moves on even when his hand is in hers
      this.affection.letGo();
      g.toast(`${CONFIG.partners[def.kind].name} has to go${row?.note ? ` (${row.note})` : ''}. She squeezes your hand first.`, 'info');
    }
    if (rig.holding || this.affection?.beat?.rig === rig) { rig.walking = rig.holding ? this.walking : false; return; }
    const door = this.area.spawn;
    if (here) {
      if (!rig.root.visible || rig.partnerRow !== row) {
        if (!rig.root.visible) {
          rig.root.visible = true;
          if (fresh) rig.root.position.set(row.x, 0, row.z);
          else rig.root.position.set(door.x, 0, door.z);
        }
        rig.partnerRow = row;
        rig.leaving = false;
        rig.wander = null;
        rig.partnerWalk = { x: row.x, z: row.z, t: 0 };
      }
    } else if (rig.root.visible) {
      if (fresh) { rig.root.visible = false; rig.partnerRow = null; }
      else if (!rig.leaving) { rig.leaving = true; rig.partnerRow = null; rig.partnerWalk = { x: door.x, z: door.z, t: 0 }; }
    }
    if (talk) talk.hidden = !here || !rig.root.visible;
    if (!rig.root.visible) { rig.walking = false; return; }
    const walk = rig.partnerWalk;
    if (walk) {
      walk.t += dt;
      const dx = walk.x - rig.root.position.x;
      const dz = walk.z - rig.root.position.z;
      const dist = Math.hypot(dx, dz);
      // shelves and counters can stand between the door and her spot: after a few seconds of
      // trying she is simply there (or gone), rather than pacing into a fridge
      if (dist < 0.2 || walk.t > 7) {
        if (walk.t > 7) rig.root.position.set(walk.x, 0, walk.z);
        rig.partnerWalk = null;
        rig.walking = false;
        if (rig.leaving) { rig.root.visible = false; rig.leaving = false; if (talk) talk.hidden = true; }
        return;
      }
      rig.walking = true;
      const step = Math.min(dist, 1.0 * dt);
      const nx = rig.root.position.x + (dx / dist) * step;
      const nz = rig.root.position.z + (dz / dist) * step;
      if (!this.blocked(nx, nz)) { rig.root.position.x = nx; rig.root.position.z = nz; }
      rig.root.rotation.y += angleDelta(rig.root.rotation.y, Math.atan2(dx, dz)) * Math.min(1, dt * 6);
      return;
    }
    // at home she does not stand still like a shop display: she drifts between the rooms
    this.partnerAtHome(rig, dt, g, def);
    // at her spot: the same small idle patch as everyone else
    this.patrolIdle(rig, dt);
  }

  /**
   * Living together is not a pose. When she is home she drifts between a handful of known-clear
   * spots — the couch, the counter, the window — sits where the spot is a seat, and says one line
   * when Mo comes close, at the volume of the rest of the apartment.
   *
   * The spots are checked against the room's solids each time, so a blocked one is simply not
   * chosen. There is no pathfinding here and a room this size does not need any.
   */
  partnerAtHome(rig, dt, g, def) {
    if (this.areaId !== 'apartment' || !def.partner || rig.holding) return;
    const row = rig.partnerRow;
    if (!row || row.pose === 'sleep') return;
    rig.homeTimer = (rig.homeTimer ?? (4 + Math.random() * 6)) - dt;
    if (rig.homeTimer > 0) return;
    rig.homeTimer = 9 + Math.random() * 10;
    const b = this.area.bounds;
    const mo = this.mo.root.position;
    const open = PARTNER_HOME_SPOTS.filter((sp) => sp.x > b.minX + 0.45 && sp.x < b.maxX - 0.45 &&
      sp.z > b.minZ + 0.45 && sp.z < b.maxZ - 0.45 && !this.blocked(sp.x, sp.z));
    if (!open.length) return;
    // she does not walk into him, and she does not take the spot he is standing on
    const clear = open.filter((sp) => Math.hypot(sp.x - mo.x, sp.z - mo.z) > 0.95);
    const list = clear.length ? clear : open;
    const spot = list[Math.floor(Math.random() * list.length)];
    rig.partnerWalk = { x: spot.x, z: spot.z, t: 0 };
    rig.pose = spot.pose || null;
    // one line, when he is near enough to hear it, and not on a loop
    if (Math.hypot(mo.x - rig.root.position.x, mo.z - rig.root.position.z) < 2.0 &&
        this.time - (rig.sayAt ?? -999) > 55) {
      rig.sayAt = this.time;
      g.broadcast?.({ from: String(def.kind).toUpperCase(), text: homeChat(def.kind) });
    }
  }

  /** Mo and one of the three: 'hug' or 'kiss' (she kisses his cheek). */
  playAffection(type, kind) {
    if (this.mode !== 'play') return false;
    const rig = this.npcRigs.find((r) => r.npcDef?.kind === kind && r.root.visible);
    if (!rig) return false;
    if (!this.affection) this.affection = new Affection(this);
    this.walking = false;
    this.vel?.set(0, 0, 0);
    this.moveTarget = null;
    return this.affection.play(type, rig);
  }

  /** Walk around with her, hand in hand; `false` lets go. */
  holdHands(kind, on = true) {
    if (!this.affection) this.affection = new Affection(this);
    if (!on) { this.affection.letGo(); return true; }
    const rig = this.npcRigs.find((r) => r.npcDef?.kind === kind && r.root.visible);
    if (!rig) return false;
    this.affection.letGo();
    this.affection.holdHands(rig);
    return true;
  }

  holdingHands(kind) { return !!this.affection?.isHolding(kind); }

  /** Is a cop within `range` metres of Mo? */
  copNear(range = 6) {
    const mo = this.mo.root.position;
    return this.npcRigs.some((r) => (r.npcDef?.kind === 'cop' || r.npcDef?.kind === 'cop2') && r.root.visible && Math.hypot(r.root.position.x - mo.x, r.root.position.z - mo.z) < range);
  }

  /**
   * "Turn around." High and holding, he gets an offer before he gets a search: $50 or $100 to be
   * somebody else's problem. It is a roll, and a refused bribe goes on the report.
   */
  copStop(g) {
    this.haltMo();
    const s = g.state;
    if (police.canBribe(s)) {
      const B = CONFIG.police.bribe;
      g.openModal({
        kicker: 'POLICE · A FLASHLIGHT IN YOUR FACE',
        title: 'A Conversation',
        body: `${police.copLine('offer')}\n\nYou are holding, and he knows it. He has not said what he wants. He does not have to.`,
        choices: [
          { label: `Offer him $${B.low}.`, sub: `${Math.round(B.lowChance * 100)}% · a maybe`, effect: () => this.bribeTry(g, B.low) },
          { label: `Offer him $${B.high}.`, sub: `${Math.round(B.highChance * 100)}% · a straighter face`, disabled: s.money < B.high, effect: () => this.bribeTry(g, B.high) },
          { label: 'Say nothing. Let him search.', sub: 'it is cheaper and it is worse', effect: () => this.copSearch(g) },
        ],
      });
      return;
    }
    this.copSearch(g);
  }

  bribeTry(g, amount) {
    const res = police.bribe(g, amount);
    if (res.outcome === 'bribe') {
      g.openModal({
        kicker: 'POLICE · NOT SEEN',
        title: `$${res.cost}`,
        body: `${res.line}\n\nThe money is gone. The pockets are not. He is already looking at somebody else.`,
        choices: [{ label: 'Walk. Do not run.', effect: () => {} }],
      });
      return;
    }
    if (res.outcome === 'short') return;
    const b = res.booked || { items: [], fine: 0 };
    g.openModal({
      kicker: 'POLICE · BOOKED', title: 'Attempted Bribery',
      body: `He looks at the money, then at you, and there it is: the small smile of a man having a better night than you.\n\nConfiscated: ${b.items.join(', ') || 'nothing they admit to'}.\nFine: $${b.fine.toFixed(2)}, with the bribery on top.`,
      choices: [{ label: 'Get in the car.', effect: () => this.toHolding(g, b) }],
    });
  }

  /** The ordinary stop: clean means a warning, holding anything means a night in a cell. */
  copSearch(g) {
    const res = police.search(g);
    if (!res.booked) {
      g.openModal({ kicker: 'POLICE · A FLASHLIGHT IN YOUR FACE', title: 'Stopped', body: police.copLine('clean'), choices: [{ label: 'Go home.', effect: () => {} }] });
      return;
    }
    g.openModal({
      kicker: 'POLICE · A FLASHLIGHT IN YOUR FACE', title: 'Booked',
      body: `${police.copLine('booked')}\n\nConfiscated: ${res.items.join(', ')}.\nFine: $${res.fine.toFixed(2)}.`,
      choices: [{ label: 'Get in the car.', effect: () => this.toHolding(g, res) }],
    });
  }

  /** One a night, and only at night: the cop who does not want to search Mo, he wants to sell him. */
  crookedCop(g) {
    const s = g.state;
    const off = police.crookedOffer(s);
    g.openModal({
      kicker: 'NIGHT · A COP AT YOUR SHOULDER',
      title: 'Evidence Room',
      body: `${off.line}\n\n${off.name}. $${off.price.toFixed(2)}. In a bag that has already been somewhere official.`,
      choices: [
        { label: `Take it. $${off.price.toFixed(2)}`, disabled: !off.affordable, effect: () => { const r = police.crookedDeal(g, off.product); if (r.ok) g.toast(`$${r.price.toFixed(2)} for ${r.item}. He does not count it. Somewhere, a form is missing.`, 'info'); } },
        { label: 'Walk away.', sub: '', effect: () => police.crookedDecline(g) },
      ],
    });
  }

  /** A night in holding at the 84th, then out the front door onto Ashby in the morning. */
  toHolding(g, res) {
    const s = g.state;
    const done = () => {
      const now = s.clock.m;
      const morning = (Math.floor(now / 1440) + (now % 1440 >= 7 * 60 ? 1 : 0)) * 1440 + 7 * 60;
      g.advance(Math.max(6 * 60, morning - now), { sleeping: true, noCollapse: true });
      g.goTo('avenue', 'precinct');
      g.fadeIn?.();
      g.openModal({
        kicker: '84TH PRECINCT · MORNING', title: 'Released',
        body: `A bench, a toilet with no seat, a man singing the same line of the same song until four. They give you back your shoelaces and a pink form.\n\nThe fine came out of what you had: $${res.fine.toFixed(2)}. What they took, they keep.`,
        choices: [{ label: 'Walk out into Ashby Avenue.', effect: () => {} }],
      });
    };
    if (g.fadeOut) g.fadeOut(done, 420); else done();
  }

  /** A man in a grey hood steps out in front of Mo and wants his wallet. */
  startMugging(g) {
    const s = g.state;
    const mo = this.mo.root;
    const yaw = mo.rotation.y;
    const rig = createNPC('unknown');
    rig.root.position.set(mo.position.x + Math.sin(yaw) * 1.4, 0, mo.position.z + Math.cos(yaw) * 1.4);
    rig.root.rotation.y = yaw + Math.PI;
    this.root.add(rig.root);
    this.thug = rig;
    this.walking = false;
    this.vel?.set(0, 0, 0);
    this.moveTarget = null;
    const fight = fights.startMugging(g);
    // with a cop in sight it ends before it starts, and then the cop looks at Mo
    if (this.copNear(14)) {
      this.thugLeaving = true;
      g.openModal({
        kicker: 'LATE · POLICE', title: 'Broken Up',
        body: police.copLine('breakup'),
        choices: [{ label: 'Stand very still.', effect: () => { if (police.isHigh(s) && !police.searchedTonight(s)) this.copStop(g); } }],
      });
      return;
    }
    const end = (result) => {
      if (result === 'won') {
        this.thugLeaving = true;
        g.toast('He backs off, then runs. Your hand hurts in a way you will remember.', 'good');
      } else if (result === 'lost') {
        const r = fights.robbed(g);
        this.removeThug();
        g.toast(`Everything goes sideways and then dark. They took ${r.cash ? `$${r.cash.toFixed(2)}` : 'nothing (you had nothing)'}${r.taken.length ? ` and ${r.taken.join(', ')}` : ''}.`, 'bad');
        g.collapseSequence?.('beaten');
      } else {
        this.thugLeaving = true;
      }
    };
    g.openModal({
      kicker: 'LATE · SOMEBODY IN A GREY HOOD',
      title: 'Wallet',
      body: `${fight.line}

He is close enough that you can smell the cold on his jacket. Nobody else is around. Of course nobody else is around.`,
      choices: [
        { label: 'Fight.', sub: `energy ${Math.round(s.stats.energy)} · every miss costs`, effect: () => {
          if (!this.fightMeter) this.fightMeter = new FightMeter(document.getElementById('ui') || document.body, g);
          setTimeout(() => this.fightMeter.open({ hp: fight.hp, onSwing: (landed) => fights.exchange(g, fight, landed), done: end }), 60);
        } },
        ...(dogState(s).like >= 100 && (this.areaId === 'street' || this.areaId === 'park') ? [{
          label: `Whistle for ${dogState(s).name}.`, sub: 'he comes', effect: () => {
            fights.dogSave(g, dogState(s).name);
            this.thugLeaving = true;
            g.toast(`${dogState(s).name} comes out of nowhere, all teeth and bad intentions. The guy in the hood is gone before the dog gets there. ${dogState(s).name} gets a hero's ear scratch.`, 'good');
          },
        }] : []),
        { label: 'Hand over some cash.', sub: 'about a quarter of it', effect: () => { const n = fights.payOff(g); g.toast(`$${n.toFixed(2)}. He counts it in front of you, which is the insulting part.`, 'bad'); end('paid'); } },
        { label: 'Run.', sub: 'if your legs are up to it', effect: () => {
          if (fights.tryRun(g)) { g.toast('You run. You run like 1993. He does not bother.', 'info'); end('ran'); }
          else {
            g.toast('He catches your jacket. Now you have to fight.', 'bad');
            if (!this.fightMeter) this.fightMeter = new FightMeter(document.getElementById('ui') || document.body, g);
            setTimeout(() => this.fightMeter.open({ hp: fight.hp, onSwing: (landed) => fights.exchange(g, fight, landed), done: end }), 60);
          }
        } },
      ],
    });
  }

  updateThug(dt) {
    const rig = this.thug;
    if (!rig) return;
    if (this.thugPunchT > 0) {
      this.thugPunchT = Math.max(0, this.thugPunchT - dt);
      const k = Math.sin((1 - this.thugPunchT / 0.35) * Math.PI);
      rig.armR.pivot.rotation.x = -1.5 * k;
    }
    if (this.thugLeaving) {
      rig.root.rotation.y += Math.PI * dt * 2;
      rig.root.position.x += Math.sin(rig.root.rotation.y) * 3 * dt;
      rig.root.position.z += Math.cos(rig.root.rotation.y) * 3 * dt;
      animateNPC(rig, dt, { walking: true });
      this.thugGone = (this.thugGone || 0) + dt;
      if (this.thugGone > 2.5) this.removeThug();
      return;
    }
    animateNPC(rig, dt, {});
  }

  removeThug() {
    if (this.thug?.root.parent) this.thug.root.parent.remove(this.thug.root);
    this.thug = null;
    this.thugLeaving = false;
    this.thugGone = 0;
  }

  /** A swing from the fight meter: Mo's arm, and on a miss, his. */
  playPunch(landed) {
    this.punchT = 0.35;
    if (!landed) { this.thugPunchT = 0.35; this.tilt = 1; }
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

  /** The next interactable in reach (X / the pad's X). */
  /** Swing the camera back behind Mo, the way it sits when he walks into a room. */
  resetCamera() {
    if (!this.mo) return;
    this.camYaw = this.mo.root.rotation.y;
    this.camSwing = 0;
    this.tilt = 0;
  }

  cycleTarget() {
    if (!this.nearList || this.nearList.length < 2) return;
    this.pickIndex = ((this.pickIndex || 0) + 1) % this.nearList.length;
    this.prompt = null; // redraw
  }

  tryInteract(g) {
    if (this.mode !== 'play' || !this.promptTarget) return false;
    const why = this.promptTarget.unavailable ? this.promptTarget.unavailable(g) : null;
    if (why) { g.audio.sfx('deny'); g.toast(why, 'info'); return false; }
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
    // the beat animations need the game (for sound); the world only has the stage
    this.game = g;
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
    // a lock flag with no animation behind it is an orphan (it can only come from an
    // interrupted path): release it rather than strand the player
    if (s.flags.consuming && !this.substance?.active) s.flags.consuming = false;
    const canMove = !g.modalOpen && !g.phoneOpen && g.mode === 'play'
      && !this.eating?.active && !this.handoff?.active && !this.substance?.active && !this.affection?.active
      && !this.collapse?.active && !this.dance?.active && !g.state.flags.consuming && !this.crossing;

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

    // crossing the road at a crosswalk: a short walk over the stripes, then the other side
    if (this.crossing) {
      const c = this.crossing;
      const p = this.mo.root.position;
      p.x += (c.x - p.x) * Math.min(1, dt * 6);
      p.z = Math.min(c.toZ, p.z + 1.7 * dt);
      this.mo.root.rotation.y += angleDelta(this.mo.root.rotation.y, 0) * Math.min(1, dt * 8);
      // the camera comes round behind him, so the crossing is a walk away from the lens, not
      // a shot back at him through whatever stands at the park edge
      this.camYaw += angleDelta(this.camYaw, 0) * Math.min(1, dt * 3);
      this.walking = true;
      if (!c.honked && p.z > (c.fromZ + c.toZ) / 2) { c.honked = true; if (Math.random() < 0.4) g.toast('A cab leans on its horn at you from a full block away. On principle.', 'info'); }
      if (p.z >= c.toZ - 0.01) { this.crossing = null; this.walking = false; c.onDone?.(); }
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
    this.substance?.update(dt);
    this.collapse?.update(dt);
    this.dance?.update(dt);
    this.dealerWalker?.sync(g);
    this.dealerWalker?.update(dt);
    this.rideCar?.sync(g);
    this.rideCar?.update(dt);
    this.traffic?.update(dt, g);
    this.streetLife?.update(dt, g);

    const mod = minuteOfDay(s.clock.m);
    for (const rig of this.npcRigs) {
      if (rig.type === 'cat') { animateNPC(rig, dt); continue; }
      this.patrolNPC(rig, dt, g);
      if (rig.talkIt) { rig.talkIt.x = rig.root.position.x; rig.talkIt.z = rig.root.position.z; }
      if (rig.heart) {
        rig.heart.position.y = 2.06 + Math.sin(this.time * 2.2 + rig.root.position.x) * 0.045;
        rig.heart.rotation.y += dt * 1.1;
      }
      // a pose comes from the schedule row he is standing at (Gus on his cardboard), or from a
      // seat the area gave him; never in mid-air on the walk between them
      const settled = !rig.walking && !!rig.npcDef?.sit;
      const pose = rig.walking ? null : rig.pose;
      animateNPC(rig, dt, {
        walking: !!rig.walking,
        sitting: pose === 'sit' || (settled && mod < 22 * 60 && mod >= 7 * 60),
        sleeping: pose === 'sleep' || (settled && (mod >= 22 * 60 || mod < 7 * 60)),
      });
      if (rig.npcDef?.act) applyAct(rig, dt, this.streetLife);
    }
    // anything else that takes Mo over (a meal, a hit, a fall) lets go of her hand first
    if (this.affection?.holding && (this.eating?.active || this.substance?.active || this.collapse?.active || this.dance?.active || this.handoff?.active)) this.affection.letGo();
    this.affection?.update(dt);
    this.area?.tick?.(g, dt, this);

    // trouble after dark: somebody steps out of the shadows in the park, the alley end or the lot
    this.muggerTimer = (this.muggerTimer ?? 20) - dt;
    if (this.muggerTimer <= 0) {
      this.muggerTimer = 40;
      if (canMove && !this.thug && fights.shouldMug(s, this.areaId, this.mo.root.position.x)) this.startMugging(g);
    }
    this.updateThug(dt);
    // a cop who can see Mo while he is high stops him (once a night)
    this.copTimer = (this.copTimer ?? 2) - dt;
    if (this.copTimer <= 0) {
      this.copTimer = 1.5;
      if (canMove && !this.thug && this.areaId !== 'precinct' && police.isHigh(s) && !police.searchedTonight(s) && this.copNear(CONFIG.police.seeRange)) this.copStop(g);
      // and the other kind of cop: high, near a patrol, at night, once
      else if (canMove && !this.thug && this.areaId !== 'precinct' && this.copNear(7) && police.crookedRoll(s, dt)) this.crookedCop(g);
    }
    // a swing: his right arm out and back
    if (this.punchT > 0) {
      this.punchT = Math.max(0, this.punchT - dt);
      const k = Math.sin((1 - this.punchT / 0.35) * Math.PI);
      this.mo.armR.pivot.rotation.x = -1.5 * k;
      this.mo.armR.elbow.rotation.x = -0.2 * k;
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
    // A room has a ceiling and walls a couple of metres away, so the camera settings cannot act
    // on it the way they act on the street. At 140% distance and 135% height the old formula put
    // the indoor eye at 3.7 m in a 2.7 m apartment — above the ceiling, looking down through it —
    // and the shortened arm lifted it further. Indoors the arm stops at what fits the room, the
    // eye stops under the ceiling, and extra distance is spent mostly on the arm, not the height.
    // The limits themselves live in cameraLimits.js, where `npm test` can try every zoom setting
    // against every ceiling. Indoors the arm stops at what the room can give and the eye stops
    // under its ceiling; outdoors both sliders keep the range they always had.
    const ceil = interior ? this.camCeiling() : 6.6;
    const roomArm = this.roomBoom(interior);
    const boomMax = armMax(interior, roomArm, distMul);
    // the eye rides up with the distance, so pulling the camera back still reads as a wider shot
    // in a room where the arm itself has nowhere longer to go
    const restHeight = eyeHeight(interior, heightMul, distMul, ceil);
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
    // Indoors the swing is off: between shelf ends and walls it kept finding a "better" angle a
    // few frames apart and the view hunted. A cramped room gets a shorter, higher arm instead.
    if (!interior && !orbiting && !holdSwing && room < 1.1 && this.swingRest <= 0) {
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
        // behind his head is still a shot; 10 cm from his eyes was the inside of his skull, and
        // five sliders' worth of "zoom out" then read as a close-up of the back of a neck
        const yaw = this.camYaw + this.camSwing;
        const clear50 = !this.camBlocked(this.camFocus.x - Math.sin(yaw) * 0.5, this.camFocus.z - Math.cos(yaw) * 0.5);
        room = clear50 ? 0.5 : 0.42;
      }
    }

    const armYaw = this.camYaw + this.camSwing;
    const backX = -Math.sin(armYaw);
    const backZ = -Math.cos(armYaw);
    const b = this.area.camBounds || this.area.bounds;
    // in fast, out slow: a wall shortening the arm is urgent, opening back up is not, and easing
    // both ways at one rate made the camera pump in and out as he clipped past a corner
    const boomRate = room < this.camBoom ? 10 : 3.5;
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
    const liftPerMetre = liftFor(interior, swinging);
    const targetHeight = Math.min(
      ceil,
      restHeight + impairment * 0.06 + (boomMax - this.camBoom) * liftPerMetre
    );
    this.boomHeight += (targetHeight - this.boomHeight) * (1 - Math.exp(-6 * dt));
    this.boomHeight = clamp(this.boomHeight, 0.92, ceil);

    // last resort: never let the arm place the eye outside the room, whatever the corner does
    this.camPos.set(
      clamp(this.camFocus.x + backX * this.camBoom, b.minX + 0.15, b.maxX - 0.15),
      clamp(this.boomHeight, 0.92, ceil),
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

    // interaction prompt: everything in reach, nearest first. X cycles through them, so two doors
    // a metre apart do not mean shuffling back and forth to pick one.
    const near = [];
    for (const it of this.interactables) {
      if (it.hidden) continue;
      const d = Math.hypot(it.x - this.mo.root.position.x, it.z - this.mo.root.position.z);
      if (d < (it.radius || 1.75)) near.push({ it, d });
    }
    near.sort((a, b) => a.d - b.d);
    const ids = near.map((n) => n.it.id).join(',');
    if (ids !== this.nearIds) { this.nearIds = ids; this.pickIndex = 0; }
    this.nearList = near.map((n) => n.it);
    const best = this.nearList[Math.min(this.pickIndex || 0, this.nearList.length - 1)] || null;
    this.promptTarget = best;
    // a target may say it cannot be used right now, and why (closed, wrong hour, not yours)
    const why = best?.unavailable ? best.unavailable(g) : null;
    const pad = g.input?.lastDevice === 'pad';
    const prompt = best ? `${best.label}|${best.sub || ''}|${why || ''}|${this.pickIndex}|${near.length}|${pad}` : null;
    if (prompt !== this.prompt) {
      this.prompt = prompt;
      g.hud?.setPrompt(best ? { label: best.label, sub: best.sub, unavailable: why, index: this.pickIndex || 0, count: near.length, pad } : null);
    }
    if (this.promptTarget && canMove) {
      // subtle highlight: face the interaction when close, no shader tricks needed
    }
  }

  /** Stop him where he stands: no momentum, no tap target, no walk cycle (menus, doors, meals). */
  /** Walk Mo over a crosswalk (x) from the curb to `toZ`, then call onDone (which loads the far side). */
  playCross(x, toZ, onDone) {
    if (this.mode !== 'play' || this.crossing) return false;
    this.haltMo();
    this.crossing = { x, fromZ: this.mo.root.position.z, toZ, onDone, honked: false };
    return true;
  }

  haltMo() {
    this.vel?.set(0, 0, 0);
    this.moveTarget = null;
    this.walking = false;
  }

  /**
   * The height the eye may not pass indoors: the room's ceiling less a hand's width. A room can
   * name its own with `camCeil`; otherwise 2.7 m is the height everything here was built to.
   */
  camCeiling() {
    return ceilingFor(this.area);
  }

  /** The arm length a place wants: the street's long lens, or most of a room's short side. */
  roomBoom(interior) {
    return armLength(interior, this.area?.bounds);
  }

  /** Longest arm, in metres, that fits along `yaw` without leaving the room or hitting something. */
  armRoom(yaw, boomMax, clearance) {
    if (!this.area) return boomMax;
    const b = this.area.camBounds || this.area.bounds;
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
    if (def.partner || def.stranger || def.sister) { this.partnerPresence(rig, dt, g); return; }
    // somebody who stays where they are (asleep by the stairs, mid-argument, selling from a coat)
    if (def.still) { rig.walking = false; rig.pose = def.pose || null; return; }
    // somebody walking the avenue end to end, on the way to somewhere that is not here
    if (def.walker) {
      if (rig.walkDir === undefined) rig.walkDir = Math.random() < 0.5 ? 1 : -1;
      const [x0, x1] = def.walker;
      const tx = rig.walkDir > 0 ? x1 : x0;
      const dx = tx - rig.root.position.x;
      if (Math.abs(dx) < 0.3) { rig.walkDir *= -1; return; }
      // somebody in the way (Mo): stop and wait, like people do
      const mo = this.mo.root.position;
      const ahead = (mo.x - rig.root.position.x) * Math.sign(dx);
      if (ahead > 0 && ahead < 1.2 && Math.abs(mo.z - rig.root.position.z) < 0.7) { rig.walking = false; return; }
      rig.walking = true;
      rig.root.position.x += Math.sign(dx) * 1.1 * dt;
      rig.root.rotation.y += angleDelta(rig.root.rotation.y, Math.sign(dx) > 0 ? Math.PI / 2 : -Math.PI / 2) * Math.min(1, dt * 6);
      return;
    }

    // A scheduled character walks to wherever they are supposed to be right now and stays
    // there until the window changes; unscheduled ones keep to a small patch near home.
    // The schedules are street coordinates. Kev in the park or Rae indoors used to be sent toward
    // their street spot, walk to the edge of the room and stand there pacing; off the street,
    // a scheduled character keeps to their own patch like everyone else.
    const target = g && this.areaId === 'street' && !def.debug ? scheduleTarget(def.kind, minuteOfDay(g.state.clock.m)) : null;
    // off the block (Dex by day): not drawn, not talkable; back exactly where he works when he returns
    const away = !!target?.away;
    if (rig.root.visible === away) {
      rig.root.visible = !away;
      if (rig.talkIt) rig.talkIt.hidden = away;
      if (!away && target) rig.root.position.set(target.x, 0, target.z);
    }
    if (away) { rig.walking = false; return; }
    rig.pose = target?.pose || null;
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

    this.patrolIdle(rig, dt);
  }

  /** Unscheduled (or settled) characters keep to a small patch near home: pick a spot, walk, stand. */
  patrolIdle(rig, dt) {
    const def = rig.npcDef || {};
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
    // indoors: pick a reachable spot and walk the grid path round the furniture to it
    if (this.navGrid) {
      if (w.timer <= 0) {
        w.timer = 3 + Math.random() * 5;
        const spot = wanderSpot(this.navGrid, w.homeX, w.homeZ, def.roam ?? 1.5);
        w.path = spot ? findPath(this.navGrid, rig.root.position.x, rig.root.position.z, spot[0], spot[1]) : null;
      }
      const next = w.path?.[0];
      if (!next) { rig.walking = false; return; }
      const dx = next[0] - rig.root.position.x;
      const dz = next[1] - rig.root.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.08) { w.path.shift(); if (!w.path.length) rig.walking = false; return; }
      rig.walking = true;
      const step = Math.min(dist, 0.8 * dt);
      rig.root.position.x += (dx / dist) * step;
      rig.root.position.z += (dz / dist) * step;
      rig.root.rotation.y += angleDelta(rig.root.rotation.y, Math.atan2(dx, dz)) * Math.min(1, dt * 6);
      return;
    }
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
      // a lamp post or a sign pole: the arm passing behind one for a frame is less jarring than
      // the arm snapping short and easing back out every time he walks past it
      if (Math.max(b.w, b.d) <= 0.5) continue;
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
