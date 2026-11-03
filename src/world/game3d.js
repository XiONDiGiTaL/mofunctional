/** The 3D world: renderer, camera, areas, movement, interaction, ragdoll, menu scene. */
import { buildRoof } from './roof.js';
import { kevDoor } from '../systems/calls.js';
import { buildHall } from './hall.js';
import { addOwe } from '../systems/owes.js';
import * as THREE from '../../vendor/three.module.js';
import { createRenderer, setSize, retroMaterial, retroUniforms, box } from '../render/retro.js';
import { createMo, createAddison, createNPC, createCat, animateMo, animateAddison, animateNPC, applyOutfit as dressMo, addSaxophone, animateSax, punchPose, animateDown, guardPose, kickPose } from './characters.js';
import { buildApartment, buildStreet, buildChurch, buildBodega, buildHabibs, buildPark, buildClinic, buildQuikStop, buildMenuWorld, partnerMenu, talk } from './areas.js';
import { Affection } from './affection.js';
import { stephanieDoor } from './places.js';
import { buildWalkup, buildAvenue, buildRestaurant, buildPrecinct, buildLaundromat, buildLaundryBack } from './places.js';
import { buildSubway, buildParkSlope, buildDowntown, buildProjects, buildFightClub, clothingMenu } from './underground.js';
import { buildTower, buildHerRoom } from './houses.js';
import { buildBathroom, buildRestroom } from './rooms.js';
import { Courier } from './courier.js';
import { Assailants } from './assailant.js';
import { ROAD } from './plan.js';
import { Patrol, OUTSIDE } from './patrol.js';
import { buildPawnShop, buildJays, buildReliefOffice } from './storefronts.js';
import * as brawl from '../systems/brawl.js';
import { worn } from '../systems/wardrobe.js';
import { bump, addItem, logLine } from '../core/state.js';
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
import { isPartnerId, partnerState, PARTNER_KEYS, homeChat, breakUp } from '../systems/romance.js';
import { CONFIG } from '../core/config.js';
import { clamp, lerp, minuteOfDay, dayOf, money, hhmm, pick } from '../core/util.js';
import { faceSpec } from '../render/heads.js';
import { scheduleTarget, partnerTarget, PARTNER_AREA_NAMES, PARTNER_HOME_SPOTS, strangerRunIns, strangerTarget } from './schedules.js';
import { ceilingFor, armLength, armMax, eyeHeight, liftFor } from './cameraLimits.js';
import { strangerMenu, strangerLabel, niaMenu } from './encounters.js';
import { sisterTarget } from '../systems/sister.js';
import { maybeStreetEvent } from '../systems/street.js';

const BUILDERS = {
  apartment: buildApartment, street: buildStreet, church: buildChurch, roof: buildRoof,
  hall: (g) => buildHall(g, { partnerMenu, stephanieDoor, raeTalk: (gg) => talk(gg, 'rae'), kevDoor }),
  bodega: buildBodega, habibs: buildHabibs, park: buildPark, clinic: buildClinic, quikstop: buildQuikStop,
  walkup: (g) => buildWalkup(g, { partnerMenu }), avenue: buildAvenue, restaurant: buildRestaurant, precinct: buildPrecinct, laundromat: buildLaundromat, laundry_back: buildLaundryBack,
  subway: buildSubway, parkslope: buildParkSlope, downtown: buildDowntown, projects: buildProjects, fightclub: buildFightClub,
  pjtower: buildTower, pjroom: buildHerRoom, bathroom: buildBathroom, restroom: buildRestroom,
  pawn: buildPawnShop, jays: (g) => buildJays(g, clothingMenu), relief: buildReliefOffice,
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
    this.flyingHats = [];
    this.assailants = new Assailants(this);
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
    this.punchCool = 0;
    this.punchT = 0;
    this.chaseRig = null;

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
    this.cutHidden = null;
    this.patrol?.clear();
    this.assailants?.clear();
    for (const h of this.flyingHats || []) h.mesh.parent?.remove(h.mesh);
    this.flyingHats = [];
    for (const c of this.floorCans || []) c.mesh.parent?.remove(c.mesh);
    this.floorCans = [];
    this.flung = null;
    this.cutscene = null;
    this.kickT = 0;
    if (this.addison) { this.addison.down = false; this.addison.danceT = 0; this.addison.root.rotation.set(0, this.addison.root.rotation.y, 0); this.addison.root.position.y = 0; }
    this.courier?.remove();
    if (this.hang) { this.hang.rig.root.parent?.remove(this.hang.rig.root); this.hang = null; }
    this.clearEncounter?.();
    // a chase does not follow him through a door: the old rig used to keep walking at his new
    // coordinates and could arrest him in a room the cop was never in
    if (this.chaseRig) { this.chaseRig.root.parent?.remove(this.chaseRig.root); this.chaseRig = null; }
    this.chaseLost = 0;
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
    // Meatball goes as far as the park with him, if he is at Mo's heel when Mo goes; he does not
    // do doors, stations or shops, and waits on Kestrel Street for him instead
    if (g?.state) {
      const d = dogState(g.state);
      const dog = this.streetLife?.dog;
      const p = this.mo?.root.position;
      const atHeel = dog && p && !(dog.scared > 0) && d.like >= CONFIG.dog.followAt && Math.hypot(dog.root.position.x - p.x, dog.root.position.z - p.z) < 7;
      const from = this.areaId;
      d.withMo = !!(atHeel && ((from === 'street' && id === 'park') || (from === 'park' && id === 'street')));
      if (atHeel && !d.withMo && id !== from) g.toast?.(`${d.name} sits down at the door and watches you go. He does not do indoors. He will be on Kestrel Street.`, 'info');
    }
    // a new place lets go of anything that had hold of Mo in the old one (the phone can move him
    // mid-anything); an in-flight lock surviving the move is a man who can never walk again
    if (this.affection?.holding) this.affection.letGo?.();
    if (g?.state?.flags) g.state.flags.consuming = false;
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
    dressMo(this.mo, worn(g.state));
    this.camYaw = spawn.rot;
    this.camSwing = 0;
    this.tilt = 0;

    // camera snap
    const behind = new THREE.Vector3(Math.sin(spawn.rot), 0, Math.cos(spawn.rot)).multiplyScalar(4.2);
    this.camera.position.set(this.mo.root.position.x + behind.x, 2.9, this.mo.root.position.z + behind.z);
    this.camPos.copy(this.camera.position);
    this.camFocus.set(this.mo.root.position.x, 0, this.mo.root.position.z);
    this.camBoom = this.roomBoom(id !== 'street' && id !== 'roof');
    this.boomHeight = id !== 'street' && id !== 'roof' ? 1.98 : 2.62;
    this.swingGoal = 0;
    this.prevCamYaw = this.camYaw;
    this.walking = false;
    this.camTarget.set(this.mo.root.position.x, 1.15, this.mo.root.position.z);
    this.camera.lookAt(this.camTarget);

    this.interactables = this.area.interactables.map((it) => ({ ...it, vec: new THREE.Vector2(it.x, it.z) }));
    this.seated = null;
    this.addSeats(this.area.seats || []);
    // a prompt belongs to the room that drew it: the station's "wait for the train" followed him
    // into the Basement and the projects because nothing cleared it on the way out
    this.prompt = null;
    this.nearIds = null;
    this.pickIndex = 0;
    this.promptTarget = null;
    g.hud?.setPrompt?.(null);

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
      const row = id === 'street' && !npc.debug && !npc.still ? scheduleTarget(npc.kind, minuteOfDay(g.state.clock.m)) : null;
      rig.root.position.set(row && !row.away ? row.x : npc.x, npc.y || 0, row && !row.away ? row.z : npc.z);
      rig.baseY = npc.y || 0; // on a bench, a bed, a lottery machine
      // somebody sitting sits on what is actually there: the seat's real top, measured, so the
      // hips rest on it instead of sinking through a bench that is taller than the guess was
      if (npc.pose === 'sit' && !npc.y && rig.hipY) {
        const top = this.seatTop(rig.root.position.x, rig.root.position.z);
        if (top != null) { rig.baseY = top + 0.07 - (rig.hipY - 0.42); rig.root.position.y = rig.baseY; }
      }
      if (npc.scale) rig.root.scale.setScalar(npc.scale); // the kids
      rig.root.rotation.y = npc.rot || 0;
      rig.npcDef = npc;
      if (npc.sax) { addSaxophone(rig); rig.sax = true; }
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
    // anybody asleep where Mo can reach them has pockets, and might not stay asleep
    for (const rig of this.npcRigs) {
      if (rig.npcDef?.pose !== 'sleep' || rig.type === 'cat' || rig.npcDef?.partner) continue;
      const it = { id: `sleeper_${rig.npcId || this.interactables.length}`, label: 'Go through his pockets', sub: 'he is asleep · probably', x: rig.root.position.x, z: rig.root.position.z, radius: 1.2, action: (gg) => this.sleeperLoot(gg, rig, it) };
      rig.sleepIt = it;
      this.interactables.push(it);
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

  /**
   * Can a cop see Mo right now: a cop on foot within `range` with nothing solid in between (a
   * patrol, the precinct desk, a beat cop), or a cruiser passing within a few metres.
   */
  copSees(range = 14) {
    const mo = this.mo.root.position;
    const b0 = this.area?.bounds;
    const clear = (a) => {
      // a cop has to be out where Mo is, not behind a facade
      if (b0 && (a.x < b0.minX - 1 || a.x > b0.maxX + 1 || a.z < b0.minZ - 1 || a.z > b0.maxZ + 1)) return false;
      const steps = Math.ceil(Math.hypot(a.x - mo.x, a.z - mo.z) / 0.5);
      for (let i = 1; i < steps; i++) {
        const x = mo.x + (a.x - mo.x) * (i / steps), z = mo.z + (a.z - mo.z) * (i / steps);
        for (const b of this.area?.solids || []) if (!b.moving && !b.seeThrough && (b.h ?? 2.4) >= 1.4 && Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) return false;
      }
      return true;
    };
    const onFoot = this.npcRigs.some((r) => (r.npcDef?.kind === 'cop' || r.npcDef?.kind === 'cop2' || r.npcDef?.cop) && r.root.visible && !r.down && Math.hypot(r.root.position.x - mo.x, r.root.position.z - mo.z) < range && clear(r.root.position));
    if (onFoot) return true;
    return (this.traffic?.cars || []).some((c) => c.mesh.userData.flash && Math.hypot(c.x - mo.x, c.lane.z - mo.z) < 9);
  }

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
    const dog = this.streetLife?.dog;
    if (dog && dogState(s).like >= CONFIG.dog.followAt && Math.hypot(dog.root.position.x - mo.position.x, dog.root.position.z - mo.position.z) < 9) {
      dog.charge = 2.2;
      fights.dogSave(g, dogState(s).name);
      this.thugLeaving = true;
      g.audio?.sfx?.('deny');
      g.toast(`"Ay. Wallet—" ${dogState(s).name} is already moving, low and fast and loud. The guy in the hood is over the fence before the sentence ends. ${dogState(s).name} comes back looking like he would like that ear scratch now.`, 'good');
      return;
    }
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


  /* ------------------------------ hands, cuffs, the Basement ------------------------------ */

  /** Wardrobe asked for a change of clothes. */
  applyOutfit(state) {
    dressMo(this.mo, worn(state));
  }

  /** The closest person to Mo's fists, if any. */
  punchTarget() {
    const p = this.mo.root.position;
    let best = null;
    let bestD = CONFIG.brawl.range;
    for (const rig of this.npcRigs) {
      if (!rig.root.visible || rig.down) continue;
      const d = Math.hypot(rig.root.position.x - p.x, rig.root.position.z - p.z);
      if (d < bestD) { bestD = d; best = rig; }
    }
    if (this.thug && !this.thug.down) {
      const d = Math.hypot(this.thug.root.position.x - p.x, this.thug.root.position.z - p.z);
      if (d < bestD) { bestD = d; best = this.thug; }
    }
    return best;
  }

  /** One punch. The world answers for whoever it lands on. */
  throwPunch(g) {
    if ((this.punchCool || 0) > 0) return;
    this.punchCool = 0.34;
    this.punchT = 0.34;
    // the dog and the kid on the bike are not in the NPC list, so they used to be unreachable:
    // the kid's refusal never fired and the dog could not be kicked at all
    const pos = this.mo.root.position;
    const near = (o) => o && Math.hypot(o.root.position.x - pos.x, o.root.position.z - pos.z) < CONFIG.brawl.range;
    const bike = this.streetLife?.bike;
    const dog = this.streetLife?.dog;
    const rig = this.punchTarget();
    const rigD = rig ? Math.hypot(rig.root.position.x - pos.x, rig.root.position.z - pos.z) : Infinity;
    if (near(bike) && Math.hypot(bike.root.position.x - pos.x, bike.root.position.z - pos.z) < rigD) {
      const res = brawl.strike(g, { kind: 'kid' });
      this.punchT = 0;
      g.toast(res.line, 'bad');
      return;
    }
    if (near(dog) && Math.hypot(dog.root.position.x - pos.x, dog.root.position.z - pos.z) < rigD) {
      const res = brawl.strike(g, { kind: 'dog' });
      dog.scared = 6;
      g.audio?.sfx?.('deny');
      g.toast(res.line, 'bad');
      return;
    }
    // Addison is not in the NPC list (he is the church's own rig), so he is checked here
    const ad = this.addison;
    if (ad?.root.visible && !ad.down && Math.hypot(ad.root.position.x - pos.x, ad.root.position.z - pos.z) < Math.min(CONFIG.brawl.range, rigD)) {
      this.punchAddison(g);
      return;
    }
    // things that are not people: a vending machine, a car
    const thing = this.punchableAt(pos);
    if (thing && thing.d < rigD) {
      if (thing.kind === 'vending') this.punchVending(g, thing);
      else this.punchCar(g, thing);
      return;
    }
    if (!rig) {
      bump(g.state, 'energy', -1);
      g.toast('You swing at the air. The air takes it personally and does nothing.', 'info');
      return;
    }
    // a cat (Chairman, the bodega's) has no arms to put up and no fight to give: it bolts, and it
    // remembers. A cat used to go through the human path, whose guard pose reached for limbs a
    // cat does not have and threw every frame, which stopped the game dead.
    if (rig.type === 'cat') {
      this.punchT = 0;
      bump(g.state, 'morale', -8);
      bump(g.state, 'stress', 4);
      g.audio?.sfx?.('deny');
      g.toast(pick(['The cat is gone before your hand gets there, and it gives you a look from under the fridge that will be with you for a while.', 'A hiss, a blur, and the cat is on top of the tallest thing in the room, judging you. Correctly.', 'You miss. The cat does not. Three red lines across your wrist and a lesson.']), 'bad');
      rig.scaredT = 4;
      return;
    }
    // Papi and Yusuf: two men on this block you do not punch, and a scene each to say why
    if (rig.npcDef?.kind === 'papi') { this.papiSmack(g, rig); return; }
    if (rig.npcDef?.kind === 'hookah') { this.yusufWarning(g, rig); return; }
    const def = rig.npcDef || (rig === this.thug ? { kind: 'thug', tough: true, label: 'the man' } : { kind: 'civilian' });
    // health is per body: two different civilians used to share one pool, so the second one
    // dropped to the first one's leftovers and went down in a single punch
    if (!rig.npcId) rig.npcId = `${def.kind || 'passer'}-${(this.npcSerial = (this.npcSerial || 0) + 1)}`;
    const key = rig.npcId;
    const maxHp = rig.brawlHpMax || brawl.hpFor(def);
    // most women on the block run at the first punch; somebody he is seeing does not stay that
    const fem = !!faceSpec(def.kind || '')?.fem;
    if (fem || brawl.runsAtOnce(def)) {
      brawl.beginSwing(g.state);
      if (def.partner && CONFIG.partners?.[def.kind]) {
        const p = partnerState(g.state, def.kind);
        p.affection = Math.max(0, p.affection - 60);
        if (p.girlfriend || p.liveIn) breakUp(g, def.kind);
      }
      bump(g.state, 'morale', -6);
      g.audio?.sfx?.('deny');
      g.toast(pick(['She screams and runs, and every window on the block is looking at you now.', 'She is gone before your arm comes back. The whole block heard her.', '"CRAZY!" she yells over her shoulder, to everybody, not to you.']), 'bad');
      this.startFlee(rig);
      if (this.copSees(14)) this.startChase(g, 'cop');
      return;
    }
    const res = brawl.strike(g, { ...def, key, hp: rig.brawlHp, maxHp, label: def.label || def.name || def.kind });
    if (['kev', 'miguel', 'habib', 'dale', 'hector'].includes(def.kind) && !(g.state.owes || []).some((o) => !o.settled && o.who === def.kind && o.kind === 'apology')) addOwe(g, { who: def.kind, kind: 'apology', note: 'for the punch' });
    if (typeof res.hp === 'number') { rig.brawlHp = res.hp; rig.brawlHpMax = maxHp; }
    // somebody with a counter to lose does the one thing that actually costs him: they call it in
    if (brawl.isImportant(def.kind, def)) {
      const heat = brawl.assault(g, key);
      if (heat.called) g.toast('They do not swing back. They pick up the phone, and they keep looking at you while they dial.', 'bad');
    }
    g.audio?.sfx?.(res.result === 'refused' ? 'deny' : 'hit');
    // a cop who can actually see it happen comes for him; one who cannot, does not
    if (res.result !== 'cop' && res.result !== 'refused' && !def.cop && this.copSees(14)) { g.toast(res.line, 'info'); this.startChase(g, 'cop'); return; }
    g.toast(res.line, res.result === 'refused' || res.result === 'dog' ? 'bad' : 'info');
    if (res.result === 'cop') { this.startChase(g, 'cop'); return; }
    // a man with a gun in his waistband does not trade punches for long
    if (def.kind === 'thug_armed' && res.result !== 'ko' && Math.random() < CONFIG.projects.gunDeathChance * 0.5) {
      g.deathSequence?.('shot');
      return;
    }
    // they square up: hands up for a moment, then their swing, then hands up again
    if (res.result === 'fight') {
      rig.guardT = CONFIG.brawl.guardSeconds;
      rig.swingDelay = CONFIG.brawl.swingDelay;
      return;
    }
    if (res.result === 'fled') { this.startFlee(rig); return; }
    if (res.result === 'ko') {
      this.knockDown(rig, g);
      this.noteKO(g, def);
      g.openModal({
        kicker: 'THE STREET · SOMEBODY IS DOWN',
        title: 'Out Cold',
        body: 'He is breathing. That is the whole report. Across the street somebody has decided, in real time, not to see this.',
        choices: [
          { label: 'Go through his pockets.', sub: 'cash · whatever he had', effect: () => {
            const loot = brawl.loot(g, { ...def, key });
            if (!loot.ok) { g.toast(loot.reason === 'searched' ? 'You already did that. Once is once.' : 'No.', 'info'); return; }
            g.toast(`${loot.cash ? `${money(loot.cash)}. ` : ''}${loot.items.length ? `And ${loot.items.join(', ')}.` : 'Otherwise, lint and a bus transfer.'}`, 'info');
          } },
          { label: 'Leave him breathing.', effect: () => {} },
        ],
      });
    }
  }

  knockDown(rig, g) {
    this.flyHat(rig);
    rig.down = true;
    rig.downT = 0;
    rig.downUntil = (this.realT || 0) + CONFIG.brawl.downSeconds;
    rig.flee = 0;
    rig.root.rotation.set(0, rig.root.rotation.y, 0);
    rig.root.rotation.z = Math.PI / 2;
    rig.root.position.y = 0.16;
    animateDown(rig);
  }

  /** Somebody who is out does not walk, talk, patrol or animate: they lie there and come round. */
  npcDown(rig, dt) {
    // two minutes of real time, not an in-game day: long enough to matter, short enough that
    // walking off the block and coming back is not a reset button
    if (this.realT >= (rig.downUntil ?? 0)) {
      // the shot do not get up: two minutes and they are gone (the area brings them back tomorrow)
      if (rig.dead) { this.dropBody(rig); return; }
      this.getUp(rig);
      return;
    }
    if (!rig.talkIt && !rig.bodyIt) {
      const it = { id: `body_${rig.npcId || Math.random().toString(36).slice(2, 7)}`, label: 'Somebody is out cold', sub: 'check their pockets · or leave them', x: 0, z: 0, radius: 1.3, action: (gg) => this.downBodyMenu(gg, rig) };
      rig.bodyIt = it;
      this.interactables.push(it);
    }
    if (rig.bodyIt) { rig.bodyIt.x = rig.root.position.x; rig.bodyIt.z = rig.root.position.z; }
    rig.downT = (rig.downT || 0) + dt;
    animateDown(rig);
  }

  /**
   * A prompt has to say what is true right now. Somebody's talk prompt becomes the two things you
   * can do about a person on the ground, and goes back to what it was when they come round.
   */
  syncTalkIt(rig) {
    const it = rig.talkIt;
    if (!it) return;
    it.x = rig.root.position.x;
    it.z = rig.root.position.z;
    if (!it.base) it.base = { label: it.label, sub: it.sub, action: it.action };
    if (rig.down && !rig.talkDown) {
      it.label = 'Somebody is out cold';
      it.sub = 'check their pockets · or leave them';
      it.action = (gg) => this.downBodyMenu(gg, rig);
      rig.talkDown = true;
    } else if (!rig.down && rig.talkDown) {
      it.label = it.base.label;
      it.sub = it.base.sub;
      it.action = it.base.action;
      rig.talkDown = false;
    }
  }

  /** The two things there are to do about a person on the ground. */
  downBodyMenu(g, rig) {
    const def = rig.npcDef || { kind: 'civilian' };
    const key = rig.npcId || def.talk || def.kind || 'somebody';
    const who = def.label || def.name || (def.kind === 'nurse' ? 'the nurse' : 'this one');
    g.openModal({
      kicker: 'SOMEBODY IS OUT COLD',
      title: 'On The Ground',
      body: `${who[0].toUpperCase()}${who.slice(1)} is out. Breathing, which is the part that matters legally. Nobody on the block is looking, or nobody is admitting to it.\n\nYou can wait for them to come round. It takes a couple of minutes.`,
      choices: [
        { label: 'Go through their pockets.', sub: 'cash · whatever they had', effect: () => {
          if (this.lootWitnessed(g)) return;
          const loot = brawl.loot(g, { ...def, key, label: def.kind });
          if (!loot.ok) { g.toast(loot.reason === 'searched' ? 'You already did that. Once is once.' : 'No.', 'info'); return; }
          g.toast(`${loot.cash ? `${money(loot.cash)}. ` : ''}${loot.items.length ? `And ${loot.items.join(', ')}.` : 'Otherwise, lint and a bus transfer.'}`, 'info');
        } },
        { label: 'Leave them alone.', sub: 'they will be up in a minute or two', effect: () => {} },
      ],
    });
  }

  /** Hands up, then their swing, then hands up again. */
  brawlPose(rig, dt) {
    if (!rig.armL) return; // cats and other limbless rigs have no pose to take
    if (rig.swingDelay > 0) {
      rig.swingDelay = Math.max(0, rig.swingDelay - dt);
      if (rig.swingDelay === 0) rig.swingT = 0.34;
    }
    if (rig.guardT > 0) rig.guardT = Math.max(0, rig.guardT - dt);
    if (rig.swingT > 0) {
      rig.swingT = Math.max(0, rig.swingT - dt);
      punchPose(rig, 1 - rig.swingT / 0.34);
    } else if (rig.guardT > 0) {
      guardPose(rig, this.time || 0);
    } else if (rig.swingDelay > 0) {
      guardPose(rig, this.time || 0);
    }
    if ((rig.guardT > 0 || rig.swingT > 0 || rig.swingDelay > 0) && !rig.down) {
      const p = this.mo.root.position;
      rig.root.rotation.y = Math.atan2(p.x - rig.root.position.x, p.z - rig.root.position.z);
    }
  }

  /** A body that is not getting up: off the board, prompts and all. */
  dropBody(rig) {
    rig.down = false;
    rig.gone = true;
    rig.root.visible = false;
    if (rig.talkIt) rig.talkIt.hidden = true;
    if (rig.bodyIt) { this.interactables = this.interactables.filter((i) => i !== rig.bodyIt); rig.bodyIt = null; }
    if (rig.patrol) this.patrol?.removeRig(rig);
  }

  /**
   * The pockets of somebody asleep. Usually he sleeps through it; sometimes he does not, and a
   * man woken up with a hand in his coat is not a man who wants to talk about it.
   */
  sleeperLoot(g, rig, it) {
    if (this.lootWitnessed(g)) return;
    const def = rig.npcDef || {};
    if (Math.random() < 0.35) {
      it.hidden = true;
      rig.pose = null;
      def.pose = null;
      rig.baseY = 0;
      rig.root.position.y = 0;
      rig.root.rotation.set(0, Math.atan2(this.mo.root.position.x - rig.root.position.x, this.mo.root.position.z - rig.root.position.z), 0);
      rig.guardT = CONFIG.brawl.guardSeconds * 2;
      rig.swingDelay = 0.35;
      def.tough = true;
      bump(g.state, 'energy', -6);
      bump(g.state, 'stress', 8);
      this.tilt = 1;
      g.audio?.sfx?.('punch');
      g.toast(pick(['His eyes open while your hand is still in his coat. He is up and swinging before you are back on your feet. Fight or run.', 'He was not asleep. He was waiting. The first one catches you on the ear.', '"THAT IS MINE." He comes off the bench like a spring. Fight him or get gone.']), 'bad');
      return;
    }
    const loot = brawl.loot(g, { ...def, key: rig.npcId || `sleeper_${def.kind}`, label: def.kind });
    if (!loot.ok) { g.toast(loot.reason === 'searched' ? 'You already went through those pockets. He does not have new ones.' : 'No.', 'info'); return; }
    it.hidden = true;
    bump(g.state, 'morale', -3);
    g.toast(`He does not wake up. ${loot.cash ? `${money(loot.cash)}. ` : ''}${loot.items.length ? `And ${loot.items.join(', ')}.` : 'Otherwise, a lighter and a photo of somebody you do not know.'} You feel exactly as good about it as you should.`, 'info');
  }

  /** 911: a patrol for wherever Mo is standing, if a car can get there. */
  callCops(g) {
    if (!OUTSIDE.has(this.areaId)) return false;
    if (!this.patrol) this.patrol = new Patrol(this);
    return this.patrol.call(g, { count: this.areaId === 'projects' ? 2 : 1 });
  }

  /** Going through somebody's pockets with a cop watching is a crime in progress. */
  lootWitnessed(g) {
    if (!this.copSees(12)) return false;
    g.toast('"HEY. HEY! Step away from him." The officer is already running.', 'bad');
    this.startChase(g, 'cop');
    return true;
  }

  getUp(rig) {
    if (rig.bodyIt) { this.interactables = this.interactables.filter((i) => i !== rig.bodyIt); rig.bodyIt = null; }
    rig.down = false;
    rig.downT = 0;
    rig.downDay = undefined;
    rig.brawlHp = undefined;
    rig.brawlHpMax = undefined;
    rig.root.rotation.set(0, rig.root.rotation.y, 0);
    rig.root.position.y = 0;
    if (rig.talkIt) rig.talkIt.hidden = false;
  }

  /** Send somebody running: not away from him, but to the end of the street. */
  startFlee(rig) {
    const b = this.area?.bounds;
    const p = rig.root.position;
    const away = p.x - this.mo.root.position.x;
    const edge = b ? (away >= 0 ? b.maxX - 0.7 : b.minX + 0.7) : p.x + Math.sign(away || 1) * 9;
    rig.flee = 7;
    rig.fleeX = edge;
    rig.gone = false;
    // the prompt list reads `hidden`; `visible` left a talk prompt standing where she used to be
    if (rig.talkIt) rig.talkIt.hidden = true;
  }

  /** A cop has decided the conversation is over. */
  startChase(g, reason = 'cop') {
    if (this.chaseRig) return;
    const rig = createNPC('cop');
    rig.npcDef = { kind: 'cop', cop: true };
    const p = this.mo.root.position;
    rig.root.position.set(p.x + 2.4, 0, p.z + 2.4);
    this.root.add(rig.root);
    this.npcRigs.push(rig);
    this.chaseRig = rig;
    this.chaseReason = reason;
    g.audio?.sfx?.('deny');
    g.toast(reason === 'report'
      ? 'A cruiser pulls to the curb without its lights on. Two of them get out, and one of them is already looking at you.'
      : reason === 'drugs'
        ? '"HEY. HEY! What is that? Do not move." Every head in the precinct turns at once.'
        : '"THAT IS IT." He is already moving, and so is the other one.', 'bad');
  }

  /** Mo did something illegal where the law can see it. Only the precinct cares. */
  witnessed(g) {
    if (this.areaId === 'precinct') this.startChase(g, 'drugs');
  }

  updateChase(dt, g) {
    this.punchCool = Math.max(0, (this.punchCool || 0) - dt);
    this.punchT = Math.max(0, (this.punchT || 0) - dt);
    this.realT = (this.realT || 0) + dt;
    // somebody phoned it in a few minutes ago, and the call has worked its way down to a cruiser
    // a phoned-in report sends nobody running at him: a cruiser rolls through, and only what a
    // cop sees with his own eyes gets him chased
    if (!this.chaseRig && brawl.alertDue(g.state)) {
      brawl.clearAlert(g.state);
      if (OUTSIDE.has(this.areaId)) { this.traffic?.spawnSpecial?.('police'); g.toast('A cruiser rolls down the block slowly, looking at faces. It does not stop. Nobody saw anything, out loud.', 'info'); }
    }
    // the ones who ran head for the end of the block, along the pavement. Running straight away
    // from Mo meant running straight through the facades, so they have a place to get to and the
    // floor of the area to do it on; at the end of it they are gone.
    for (const rig of this.npcRigs) {
      if (!(rig.flee > 0)) continue;
      rig.flee -= dt;
      const b = this.area?.bounds;
      const tx = rig.fleeX ?? rig.root.position.x;
      const dx = tx - rig.root.position.x;
      const step = Math.min(Math.abs(dx), 3.1 * dt) * Math.sign(dx || 1);
      rig.root.position.x += step;
      if (b) rig.root.position.z = clamp(rig.root.position.z, b.minZ + 0.5, b.maxZ - 0.5);
      rig.root.rotation.y = Math.atan2(Math.sign(dx || 1), 0);
      if (Math.abs(dx) < 0.25) { rig.gone = true; rig.flee = 0; rig.root.visible = false; }
    }
    const rig = this.chaseRig;
    if (!rig) return;
    const p = this.mo.root.position;
    const dx = p.x - rig.root.position.x;
    const dz = p.z - rig.root.position.z;
    const d = Math.hypot(dx, dz);
    rig.root.rotation.y = Math.atan2(dx, dz);
    // a touch slower than a sober, rested Mo (2.45): running works if he has the legs for it,
    // and a tired or high Mo (who walks slower) gets caught
    const step = Math.min(d, CONFIG.brawl.copSpeed * dt);
    if (d > 0.0001) { rig.root.position.x += (dx / d) * step; rig.root.position.z += (dz / d) * step; }
    animateNPC(rig, dt * 1.4, { walking: true });
    if (g.uiBusy) return;
    if (d < 1.15) { this.caught(g); return; }
    // far enough for long enough, and they give it up
    this.chaseLost = d > CONFIG.brawl.loseDistance ? (this.chaseLost || 0) + dt : 0;
    if (this.chaseLost > CONFIG.brawl.loseSeconds) {
      rig.root.parent?.remove(rig.root);
      this.npcRigs = this.npcRigs.filter((r) => r !== rig);
      this.chaseRig = null;
      this.chaseLost = 0;
      g.toast('You lose him. Your heart does not get the message for a while.', 'good');
    }
  }

  caught(g) {
    const rig = this.chaseRig;
    this.chaseRig = null;
    if (rig) {
      rig.root.parent?.remove(rig.root);
      this.npcRigs = this.npcRigs.filter((r) => r !== rig);
    }
    const res = police.book(g);
    g.openModal({
      kicker: 'POLICE · APPREHENDED',
      title: 'Cuffs',
      body: `Your arm goes behind your back before you decide to let it. The cuffs are colder than they are on television, and they are not on television.\n\nConfiscated: ${res.items.join(', ') || 'nothing they admit to'}.\nFine: ${money(res.fine)}.`,
      choices: [{ label: 'Get in the car.', effect: () => this.toHolding(g, res) }],
    });
  }

  /** The Basement: one fight a night, cash if he wins, the clinic and the next day if he does not. */
  clubFightMenu(g) {
    const s = g.state;
    if (!s.club) s.club = { lastNight: -1, wins: 0, losses: 0 };
    const night = dayOf(s.clock.m - 6 * 60);
    if (s.club.lastNight === night) {
      g.openModal({ kicker: 'THE BASEMENT · THE BOOK', title: 'Tomorrow', body: 'The booker does not look up from the cash box. "One a night. You had yours. Come back when the sun has been round."', choices: [{ label: 'All right.', effect: () => {} }] });
      return;
    }
    g.openModal({
      kicker: 'THE BASEMENT · THE BOOK', title: 'Put Your Name Down',
      body: `A man with a cash box and no expression. "Four rounds. You go down, you go out. You put him down, you get paid. No weapons, no friends, no crying."\n\nPurse: ${money(CONFIG.club.payout[0])}–${money(CONFIG.club.payout[1])}.`,
      choices: [
        { label: 'Put me in.', sub: 'one fight · once a night', effect: () => this.startClubFight(g) },
        { label: 'Not tonight.', effect: () => {} },
      ],
    });
  }

  startClubFight(g) {
    const s = g.state;
    s.club.lastNight = dayOf(s.clock.m - 6 * 60);
    if (!this.fightMeter) this.fightMeter = new FightMeter(document.getElementById('ui') || document.body, g);
    const fight = { hp: CONFIG.club.hp, over: null };
    g.toast('The crowd closes in. Somebody takes your jacket. Somebody else takes a bet on you.', 'info');
    setTimeout(() => this.fightMeter.open({
      hp: fight.hp,
      onSwing: (landed) => {
        if (landed) { fight.hp -= 1; bump(s, 'stress', -1); }
        else { bump(s, 'energy', -9); bump(s, 'stress', 4); }
        if (fight.hp <= 0) fight.over = 'won';
        else if (s.stats.energy <= 0) fight.over = 'lost';
        return fight;
      },
      done: (result) => this.endClubFight(g, result),
    }), 60);
  }

  endClubFight(g, result) {
    const s = g.state;
    if (result === 'won') {
      const pay = CONFIG.club.payout[0] + Math.floor(Math.random() * (CONFIG.club.payout[1] - CONFIG.club.payout[0]));
      s.club.wins += 1;
      g.earnMoney(pay, 'The Basement');
      bump(s, 'morale', 12);
      bump(s, 'risk', 2);
      g.toast(`He stays down. The booker counts ${money(pay)} into your hand like he is doing you a favour, which he is.`, 'good');
      return;
    }
    s.club.losses += 1;
    const now = s.clock.m;
    const morning = (Math.floor(now / 1440) + 1) * 1440 + 9 * 60;
    g.advance(Math.max(6 * 60, morning - now), { sleeping: true, noCollapse: true });
    s.stats.energy = Math.max(s.stats.energy, 38);
    s.stats.stress = Math.min(100, s.stats.stress + 18);
    s.high.level = 0;
    bump(s, 'morale', -10);
    g.goTo('clinic', null);
    g.fadeIn?.();
    g.openModal({
      kicker: `D${dayOf(s.clock.m)} · ${hhmm(s.clock.m)}`,
      title: 'You Wake Up In The Clinic',
      body: 'The ceiling is the colour of a hospital ceiling. Somebody has put your shoes in a bag. The nurse says two men brought you in and did not leave a name, and that the fight was, in her words, "a draw with extra steps".\n\nThe next day is already happening. It started without you.',
      choices: [{ label: 'Sit up.', effect: () => {} }],
    });
    g.toast('You lost the night and the purse. The Basement will have you back. That is not a compliment.', 'bad');
  }

  /** The man in the courtyard with the gun. */
  gunThug(g) {
    const s = g.state;
    g.openModal({
      kicker: 'MARCY HOUSES · THE COURTYARD', title: 'The One With The Gun',
      body: 'He sees you see it. That is the whole conversation, and it takes about a second.\n\n"You need something?" He does not put his hand on it. He does not have to.',
      choices: [
        { label: 'Walk away.', sub: 'live', effect: () => bump(s, 'stress', 4) },
        { label: 'Swing first.', sub: 'he is armed · this can end the run', effect: () => {
          if (Math.random() < CONFIG.projects.gunDeathChance) { g.deathSequence?.('shot'); return; }
          this.startBrawl(g, { hp: CONFIG.brawl.toughHp, name: 'the man with the gun', armed: true });
        } },
      ],
    });
  }

  streetFight(g, target = {}) {
    this.startBrawl(g, { hp: CONFIG.brawl.toughHp, name: target.name || 'him', armed: false });
  }

  startBrawl(g, { hp = 3, name = 'him', armed = false } = {}) {
    const s = g.state;
    if (!this.fightMeter) this.fightMeter = new FightMeter(document.getElementById('ui') || document.body, g);
    const fight = { hp, over: null };
    g.toast(`${name[0]?.toUpperCase() || ''}${name.slice(1)} does not step back.`, 'info');
    setTimeout(() => this.fightMeter.open({
      hp,
      onSwing: (landed) => {
        if (landed) fight.hp -= 1;
        else { bump(s, 'energy', -8); bump(s, 'stress', 4); }
        if (fight.hp <= 0) fight.over = 'won';
        else if (s.stats.energy <= 0) fight.over = 'lost';
        return fight;
      },
      done: (result) => {
        if (result === 'won') {
          const loot = brawl.loot(g, { kind: armed ? 'tough' : 'dealer', key: armed ? 'armed_thug' : 'street_thug' });
          bump(s, 'morale', 8);
          g.toast(`He goes down. ${loot.cash ? `${money(loot.cash)} in his pockets. ` : ''}${loot.items.length ? `${loot.items.join(', ')}. ` : ''}${armed ? brawl.GUN_REFUSAL : 'Nobody on the block says anything, which is a kind of respect.'}`, 'good');
        } else {
          g.toast('You go down. The pavement is the last thing with an opinion about you.', 'bad');
          g.collapseSequence?.('beaten');
        }
      },
    }), 60);
  }

  updateThug(dt) {
    const rig = this.thug;
    if (!rig) return;
    if (rig.down) { animateDown(rig); return; }
    if (this.thugPunchT > 0) {
      this.thugPunchT = Math.max(0, this.thugPunchT - dt);
      punchPose(rig, 1 - this.thugPunchT / 0.34);
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
    this.punchT = 0.34;
    if (!landed) { this.thugPunchT = 0.34; this.tilt = 1; }
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
  /* ------------------------------ somebody comes up to him ------------------------------ */

  /**
   * A street encounter as a person rather than a pop-up: they come up the sidewalk from whichever
   * end is further from Mo, stop a step away facing him, and wait with a prompt over them. Talking
   * runs the conversation; ignoring them for long enough, or walking off, and they give up and go.
   */
  spawnEncounter({ kind, label, sub, id }, talk) {
    if (this.encounter || this.areaId !== 'street') return false;
    const mo = this.mo.root.position;
    const b = this.area.bounds;
    const fromX = mo.x - b.minX > b.maxX - mo.x ? Math.max(b.minX + 1, mo.x - 11) : Math.min(b.maxX - 1, mo.x + 11);
    const rig = createNPC(kind);
    rig.root.position.set(fromX, 0, -2.6); // inside the station railing's line, not through it
    this.root.add(rig.root);
    const it = {
      id: `encounter_${id}`, label, sub, x: fromX, z: -2.6, radius: 1.7,
      action: () => { this.encounter.talked = true; it.hidden = true; talk(); },
    };
    this.interactables.push(it);
    this.encounter = { rig, it, phase: 'approach', t: 0, talked: false, leaveX: fromX };
    return true;
  }

  updateEncounter(dt, g) {
    const e = this.encounter;
    if (!e) return;
    const p = e.rig.root.position;
    const mo = this.mo.root.position;
    e.t += dt;
    let walking = false;
    if (e.talked && e.phase !== 'leave' && !g.uiBusy) e.phase = 'leave';
    if (e.phase === 'approach' || e.phase === 'wait') {
      // a step short of him, on his side of the sidewalk
      const tx = mo.x + Math.sign(p.x - mo.x || 1) * 1.3;
      let tz = Math.max(-4, Math.min(0.6, mo.z));
      if (this.blocked(tx, tz)) tz = -2.6; // he is by the stair: stand on the building side of it
      const dx = tx - p.x, dz = tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.25 && Math.hypot(mo.x - p.x, mo.z - p.z) < 18) {
        walking = true;
        p.x += (dx / d) * Math.min(d, 1.5 * dt);
        p.z += (dz / d) * Math.min(d, 1.5 * dt);
        e.rig.root.rotation.y = Math.atan2(dx, dz);
      } else {
        e.phase = 'wait';
        e.rig.root.rotation.y = Math.atan2(mo.x - p.x, mo.z - p.z);
      }
      // ignored for most of a minute, or he walked off down the block: they go
      if (!g.uiBusy && (e.t > 50 || Math.hypot(mo.x - p.x, mo.z - p.z) > 18)) {
        if (e.phase === 'wait' && Math.random() < 0.5) g.toast('They give up on you and go back the way they came.', 'info');
        e.phase = 'leave';
      }
    }
    if (e.phase === 'leave') {
      e.it.hidden = true;
      const dx = e.leaveX - p.x;
      walking = Math.abs(dx) > 0.2;
      if (walking) { p.x += Math.sign(dx) * Math.min(Math.abs(dx), 1.4 * dt); e.rig.root.rotation.y = Math.sign(dx) > 0 ? Math.PI / 2 : -Math.PI / 2; }
      else { this.clearEncounter(); return; }
    }
    e.it.x = p.x;
    e.it.z = p.z;
    animateNPC(e.rig, dt, { walking });
  }

  clearEncounter() {
    const e = this.encounter;
    if (!e) return;
    e.rig.root.parent?.remove(e.rig.root);
    const i = this.interactables.indexOf(e.it);
    if (i >= 0) this.interactables.splice(i, 1);
    this.encounter = null;
  }

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
    if (target.seat && this.seated?.seat !== target.seat) this.sit(target.seat);
    const res = target.action(g);
    return res !== false;
  }

  /* ------------------------------ chairs and benches ------------------------------ */

  /**
   * Every bench and chair an area lists in `seats` ({ x, z, rot, y, label, sub, action }) gets a
   * prompt in front of it. Taking it puts him on the seat, really seated, until he moves: any step
   * or tap stands him back up where he came from. `x, z` is where he sits, `rot` the way he faces.
   * An area's own sit actions (the park bench, the waiting chairs) can carry `seat` too.
   */
  addSeats(seats) {
    seats.forEach((seat, i) => {
      const fx = seat.x + Math.sin(seat.rot || 0) * 0.72;
      const fz = seat.z + Math.cos(seat.rot || 0) * 0.72;
      this.interactables.push({
        id: `seat_${i}`, label: seat.label || 'Sit down', sub: seat.sub || 'stand up by walking off', x: fx, z: fz,
        radius: seat.radius || 0.95, seatPrompt: true, vec: new THREE.Vector2(fx, fz),
        action: (gg) => { this.sit(seat); seat.action?.(gg); },
      });
    });
  }

  sit(seat) {
    const p = this.mo.root.position;
    this.seated = { seat, back: { x: p.x, z: p.z }, t: 0 };
    this.haltMo();
    // the hips go on the seat's real surface (measured under the seat point), not a fixed guess
    const top = this.seatTop(seat.x, seat.z);
    p.set(seat.x, top != null ? top + 0.07 - (this.mo.hipY - 0.44) : (seat.y ?? 0.46) - 0.46, seat.z);
    this.mo.root.rotation.y = seat.rot || 0;
    for (const it of this.interactables) if (it.seatPrompt) it.hidden = true;
    this.prompt = 'redraw'; // not null: null is also "nothing to show", and the old prompt would stay up
  }

  /** The top of whatever is under (x, z) at sitting height: a bench, a chair, a stool, a pew. */
  seatTop(x, z) {
    if (!this.areaGroup) return null;
    this.areaGroup.updateMatrixWorld(true);
    this.seatRay = this.seatRay || new THREE.Raycaster();
    this.seatRay.set(new THREE.Vector3(x, 1.0, z), new THREE.Vector3(0, -1, 0));
    this.seatRay.far = 0.85;
    for (const h of this.seatRay.intersectObject(this.areaGroup, true)) {
      const m = h.object.material;
      if (m?.transparent || h.object.type !== 'Mesh') continue;
      if (h.point.y > 0.28 && h.point.y < 0.85) return h.point.y;
    }
    return null;
  }

  standUp() {
    if (!this.seated) return;
    const { back } = this.seated;
    this.seated = null;
    const p = this.mo.root.position;
    p.set(back.x, 0, back.z);
    this.mo.hips.position.y = this.mo.hipY;
    for (const it of this.interactables) if (it.seatPrompt) it.hidden = false;
    this.prompt = 'redraw';
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
    // an area can see further than the street (a roof: the whole skyline)
    f.value = (this.area?.fogFar ?? CONFIG.render.fogFar) * (0.82 + this.audioLevel * 0.4);
    retroUniforms.fogNear.value = (this.area?.fogNear ?? CONFIG.render.fogNear) * (0.8 + this.audioLevel * 1.2);
  }

  updatePlay(dt, g) {
    const s = g.state;
    // a lock flag with no animation behind it is an orphan (it can only come from an
    // interrupted path): release it rather than strand the player
    if (s.flags.consuming && !this.substance?.active) s.flags.consuming = false;
    const canMove = !g.uiBusy && !this.flung && !this.cutscene
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
    if (this.seated) {
      const pushing = Math.hypot(g.input?.move?.x || 0, g.input?.move?.y || 0) > 0.3 || (g.input?.clicks?.length > 0);
      if (canMove && pushing) {
        this.standUp();
        if (g.input?.clicks) g.input.clicks.length = 0;
      } else {
        // a sit is a small rest: the stress comes down and a little energy comes back
        this.seated.t += canMove ? dt : 0;
        if (this.seated.t > 5) {
          this.seated.t = 0;
          bump(s, 'stress', -1);
          bump(s, 'energy', 0.4);
        }
      }
    }
    if (canMove && !this.seated && g.input?.take?.('punch')) this.throwPunch(g);

    const free = canMove && !this.seated;
    const mx = free ? (g.input?.move?.x || 0) : 0;
    const my = free ? (g.input?.move?.y || 0) : 0;
    const len = Math.hypot(mx, my);
    const keyed = len > 0.08;
    if (keyed) this.moveTarget = null;

    if (free && g.input?.clicks?.length) {
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
    // a held direction keeps the basis it started with while the view turns round (below)
    if (this.basisLock && (!keyed || Math.abs(mx - this.basisLock.mx) > 0.35 || Math.abs(my - this.basisLock.my) > 0.35)) this.basisLock = null;
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
      // somebody who wakes up (or is put down) overlapping the furniture is free to walk out of
      // it: with both axes blocked he could not move at all, and the run was stuck on the floor
      const stuck = this.blocked(beforeX, beforeZ);
      if (stuck || !this.blocked(nx, beforeZ)) this.mo.root.position.x = nx;
      if (stuck || !this.blocked(this.mo.root.position.x, nz)) this.mo.root.position.z = nz;
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

    // Indoors, walking at the camera: the exit is usually behind the lens, the arm is pressed to
    // that wall, and the door never comes into view. After half a second of it the view turns
    // round to look where he is going. The held direction keeps the basis it started with until
    // the player lets go or changes it, so the turn does not bend his path into a circle.
    const b0 = this.area?.bounds;
    const inRoom = b0 && !this.area?.traffic && (b0.maxX - b0.minX) * (b0.maxZ - b0.minZ) < 140;
    if (inRoom && keyed && this.walking && !orbit) {
      const off = Math.abs(angleDelta(this.camYaw, this.mo.root.rotation.y));
      this.backT = off > 2.2 ? (this.backT || 0) + dt : 0;
      if (this.backT > 0.45 && this.camTurn == null) {
        this.camTurn = this.mo.root.rotation.y;
        this.basisLock = { yaw: this.camYaw + (this.camSwing || 0), mx, my };
      }
    } else this.backT = 0;
    if (this.camTurn != null) {
      const d = angleDelta(this.camYaw, this.camTurn);
      this.camYaw += d * (1 - Math.exp(-4 * dt));
      if (Math.abs(d) < 0.04 || orbit) this.camTurn = null;
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
      walking: this.walking || !!this.cutscene?.run,
      sitting: !!this.seated,
      high: s.high.level,
      withdrawal: s.stats.withdrawal,
      speed: 1,
    });
    // the swing is his whole body: wind up, drive through, recover
    if (this.punchT > 0) punchPose(this.mo, 1 - this.punchT / 0.34);
    if (this.kickT > 0) { this.kickT = Math.max(0, this.kickT - dt); kickPose(this.mo, 1 - this.kickT / 0.5); }
    if (this.flung) this.updateFlung(dt, g);
    this.eating?.update(dt);
    this.handoff?.update(dt);
    this.substance?.update(dt);
    this.collapse?.update(dt);
    this.dance?.update(dt);
    this.dealerWalker?.sync(g);
    this.dealerWalker?.update(dt);
    if (!this.courier) this.courier = new Courier(this);
    this.courier.sync(g);
    this.updateHang(dt, g);
    this.rideCar?.sync(g);
    this.rideCar?.update(dt, g);
    this.updateEncounter(dt, g);
    this.traffic?.update(dt, g);
    this.streetLife?.update(dt, g);
    this.updateChase(dt, g);

    const mod = minuteOfDay(s.clock.m);
    for (const rig of this.npcRigs) {
      if (rig.gone) continue;
      this.syncTalkIt(rig);
      if (rig.type === 'cat') { if (rig.fly || (rig.koUntil || 0) > this.realT) this.updateCatKO(rig, dt); else animateNPC(rig, dt); continue; }
      if (rig.down) { this.npcDown(rig, dt); continue; }
      if (rig.patrol) continue; // driven by Patrol, below
      this.patrolNPC(rig, dt, g);
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
        ground: pose === 'ground',
        sitting: pose === 'sit' || (settled && mod < 22 * 60 && mod >= 7 * 60),
        sleeping: pose === 'sleep' || (settled && (mod >= 22 * 60 || mod < 7 * 60)),
      });
      if (rig.npcDef?.act) applyAct(rig, dt, this.streetLife);
      // after the idle cycle, or it takes the arms back down to his sides
      if (rig.sax) animateSax(rig, dt);
      this.brawlPose(rig, dt);
    }
    // anything else that takes Mo over (a meal, a hit, a fall) lets go of her hand first
    if (this.affection?.holding && (this.eating?.active || this.substance?.active || this.collapse?.active || this.dance?.active || this.handoff?.active)) this.affection.letGo();
    this.affection?.update(dt);
    if (!this.patrol) this.patrol = new Patrol(this);
    this.patrol.update(dt, g);
    this.assailants.update(dt, g);
    this.updateFlyingHats(dt);
    if (this.cutscene) this.updateScene(dt, g);
    // standing in the road: the clock a speeding driver reads before deciding not to brake
    const lanes = this.area?.traffic?.lanes;
    const mp = this.mo.root.position;
    this.roadT = lanes && lanes.some((l) => Math.abs(mp.z - l.z) < 1.4) ? (this.roadT || 0) + dt : 0;
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
    // a swing: timed here, posed with the rest of him where the animation is applied
    if (this.punchT > 0) this.punchT = Math.max(0, this.punchT - dt);

    // street encounters, on a slow clock so they are events rather than background noise
    this.streetTimer = (this.streetTimer ?? 10) - dt;
    if (this.streetTimer <= 0) {
      this.streetTimer = 16;
      if (canMove && this.areaId === 'street') maybeStreetEvent(g);
    }
    if (this.addison.root.visible) {
      if (this.addison.down) {
        if (this.realT >= (this.addison.downUntil || 0)) this.getUp(this.addison);
        else animateDown(this.addison);
      } else {
        animateAddison(this.addison, dt);
        if (this.addison.danceT > 0) this.addisonMoves(dt);
      }
    }

    // camera follow — a spring arm. The orbit is applied to the arm instantly, so turning the
    // view is crisp; only the boom length eases, sampled outward from Mo until something solid
    // stops it. That replaces the old clamp-then-shove-to-85% step, which snapped in corners.
    // Every room is an interior. Only the apartment and the church used to be, so the bodega and
    // Habib's (rooms under 7 m across) got the street's 4.1 m arm: longer than the room, it hit
    // a wall every frame, shortened, clamped and swung, which is the camera that thrashed about
    // in the shops. The arm is now sized to the room it is in.
    const interior = this.areaId !== 'street' && this.areaId !== 'roof'; // a roof is shot like the street: the long lens, the skyline
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
    const b = this.camLimits();
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

  /**
   * After a wake-up: whatever had hold of him before he went down lets go, he is upright, and
   * nothing left over from the fall can keep him from walking.
   */
  freeMo() {
    this.eating?.stop();
    this.handoff?.stop();
    this.substance?.stop();
    this.dance?.stop();
    this.affection?.stop();
    this.collapse?.reset();
    this.crossing = null;
    this.seated = null;
    if (this.game?.state?.flags) this.game.state.flags.consuming = false;
    const mo = this.mo;
    mo.root.rotation.set(0, mo.root.rotation.y, 0);
    mo.root.position.y = 0;
    mo.hips.position.y = mo.hipY;
    this.haltMo();
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
  /**
   * Kev and Mo on a park bench passing a joint: both seated, Mo takes his drags, Kev holds his
   * between turns, and after a while `done` takes over (the fade, the hours, the walk home).
   */
  kevHang(g, done) {
    if (this.areaId !== 'park') { done?.(); return; }
    const seat = { x: -4.4, z: 1.8, rot: 0.2 };
    this.sit(seat);
    const rig = createNPC('kev');
    rig.root.position.set(seat.x + Math.cos(0.2) * 0.75, 0, seat.z - Math.sin(0.2) * 0.75);
    rig.root.rotation.y = 0.2;
    rig.npcDef = { kind: 'kev', act: 'smoke' };
    const top = this.seatTop(rig.root.position.x, rig.root.position.z);
    if (top != null) { rig.baseY = top + 0.07 - (rig.hipY - 0.42); rig.root.position.y = rig.baseY; }
    this.root.add(rig.root);
    // the park's own Kev, at the chess table, is this Kev: one of him at a time
    for (const r of this.npcRigs) if (r.npcDef?.kind === 'kev') r.root.visible = false;
    this.hang = { rig, t: 0, drags: 0, done };
  }

  updateHang(dt, g) {
    const h = this.hang;
    if (!h) return;
    h.t += dt;
    animateNPC(h.rig, dt, { sitting: true });
    if (h.drags % 2 === 1) applyAct(h.rig, dt, this.streetLife);
    // Mo's turn, then Kev's, three times round
    if (!this.eating?.active && h.t > 1 + h.drags * 4.5 && h.drags < 6) {
      if (h.drags % 2 === 0) this.playEat('loosies', (n) => g.audio?.sfx?.(n));
      h.drags += 1;
    }
    if (h.drags >= 6 && !this.eating?.active && h.t > 28) {
      const done = h.done;
      h.rig.root.parent?.remove(h.rig.root);
      this.hang = null;
      this.standUp();
      done?.();
    }
  }

  /** A small room (no traffic, under 140 m²) is shot cutaway: see `camLimits` and `cutaway`. */
  isRoom() {
    const b = this.area?.bounds;
    return !!b && !this.area.traffic && !this.area.camBounds && (b.maxX - b.minX) * (b.maxZ - b.minZ) < 140;
  }

  /**
   * Where the eye may go. In a small room the arm used to stop at the wall behind him, and every
   * doorway turned into a shot straight down onto his head. A room now lets the eye out past its
   * own walls, a metre and a half, and `cutaway` hides whatever wall is then between it and him.
   */
  camLimits() {
    const b = this.area.camBounds || this.area.bounds;
    if (!this.isRoom()) return b;
    const m = 1.5;
    return { minX: b.minX - m, maxX: b.maxX + m, minZ: b.minZ - m, maxZ: b.maxZ + m };
  }

  /** Hide the walls (and anything else that big) standing between the lens and Mo this frame. */
  cutaway() {
    const was = this.cutHidden || new Set();
    const now = new Set();
    if (this.mode === 'play' && this.areaGroup && this.isRoom()) {
      const head = this.cutHead || (this.cutHead = new THREE.Vector3());
      head.set(this.mo.root.position.x, 1.15, this.mo.root.position.z);
      const dir = (this.cutDir || (this.cutDir = new THREE.Vector3())).subVectors(head, this.camera.position);
      const dist = dir.length();
      if (dist > 0.5) {
        dir.normalize();
        const ray = this.cutRay || (this.cutRay = new THREE.Raycaster());
        ray.set(this.camera.position, dir);
        ray.far = dist - 0.3;
        const size = this.cutSize || (this.cutSize = new THREE.Vector3());
        for (const hit of ray.intersectObject(this.areaGroup, true)) {
          const o = hit.object;
          if (!o.isMesh) continue;
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          o.geometry.boundingBox.getSize(size);
          if (Math.max(size.x, size.y, size.z) >= 1.4) now.add(o);
        }
      }
    }
    for (const o of was) if (!now.has(o)) o.visible = true;
    for (const o of now) o.visible = false;
    this.cutHidden = now;
  }

  roomBoom(interior) {
    return armLength(interior, this.area?.bounds);
  }

  /** Longest arm, in metres, that fits along `yaw` without leaving the room or hitting something. */
  armRoom(yaw, boomMax, clearance) {
    if (!this.area) return boomMax;
    const b = this.camLimits();
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
    const yaw = this.basisLock ? this.basisLock.yaw : (this.camYaw || 0) + (this.camSwing || 0);
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
    // somebody with their hands up is not going for a walk
    if (rig.guardT > 0 || rig.swingT > 0 || rig.swingDelay > 0) { rig.walking = false; return; }
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
      if (b.seeThrough) continue; // chain-link: the camera looks through it
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

  /* ------------------------------ kicks, hats, things that are not people ------------------------------ */

  /** Mo's kick: turn to face the target, then the leg. `then` runs as the foot lands. */
  kick(at, then) {
    const p = this.mo.root.position;
    if (at) this.mo.root.rotation.y = Math.atan2(at.x - p.x, at.z - p.z);
    this.kickT = 0.5;
    setTimeout(() => then?.(), 190);
  }

  /** Meatball: a yelp, and a dog running for the end of the block. He remembers. */
  kickDog(g) {
    const dog = this.streetLife?.dog;
    if (!dog) return;
    const s = g.state;
    const d = dogState(s);
    this.kick(dog.root.position, () => {
      g.audio?.sfx?.('yelp');
      dog.scared = 9;
      dog.hop = 0.35;
      d.like = Math.max(0, d.like - 45);
      d.kicked = (d.kicked || 0) + 1;
      d.withMo = false;
      bump(s, 'morale', -8);
      bump(s, 'stress', 3);
      logLine(g, `Kicked ${d.like > 0 ? d.name : 'the stray'}.`, 'bad');
      g.toast(pick([`A yelp you will hear tonight when you try to sleep. ${d.name} is gone up the block with his tail under him.`, `${d.name} yelps and runs, and keeps looking back to see if you are still the same person. You are.`, 'The dog yelps and bolts. Across the street an old lady says "shame" without looking up from her cart.']), 'bad');
    });
  }

  /** Chairman, through the air, and out on the rug for a while. An angry cat is not a quiet cat. */
  kickCat(g) {
    const cat = this.npcRigs.find((r) => r.type === 'cat' && r.root.visible);
    if (!cat || cat.fly || (cat.koUntil || 0) > this.realT) return;
    const s = g.state;
    this.kick(cat.root.position, () => {
      g.audio?.sfx?.('yowl');
      const yaw = this.mo.root.rotation.y;
      cat.fly = { vx: Math.sin(yaw) * 2.6, vy: 3.4, vz: Math.cos(yaw) * 2.6, spin: 9 };
      cat.koUntil = this.realT + 45;
      s.flags.catKicked = (s.flags.catKicked || 0) + 1;
      bump(s, 'morale', -10);
      bump(s, 'stress', 4);
      logLine(g, 'Kicked Chairman across the apartment.', 'bad');
      g.toast(pick(['Chairman makes a noise like a car alarm being strangled, goes end over end, hits the radiator and lies there. Breathing. Plotting.', 'A yowl, a short flight, and a soft landing on nothing soft. Chairman is out, and when he wakes up, he will remember everything.']), 'bad');
    });
  }

  updateCatKO(rig, dt) {
    const f = rig.fly;
    const p = rig.root.position;
    if (f) {
      f.vy -= 14 * dt;
      p.x += f.vx * dt; p.y += f.vy * dt; p.z += f.vz * dt;
      rig.root.rotation.x += f.spin * dt;
      const b = this.area?.bounds;
      if (b) { p.x = clamp(p.x, b.minX + 0.3, b.maxX - 0.3); p.z = clamp(p.z, b.minZ + 0.3, b.maxZ - 0.3); }
      if (p.y <= 0 && f.vy < 0) { p.y = 0; rig.fly = null; rig.root.rotation.set(0, rig.root.rotation.y, Math.PI / 2); p.y = 0.12; }
      return;
    }
    if (this.realT >= (rig.koUntil || 0) - 0.05) { rig.root.rotation.set(0, rig.root.rotation.y, 0); p.y = 0; rig.koUntil = 0; }
  }

  /** Somebody's hat leaves their head when they go down: up, over, and onto the ground beside them. */
  flyHat(rig) {
    const hat = rig.hat;
    if (!hat || rig.hatGone || !hat.parent) return;
    rig.hatGone = true;
    this.root.attach(hat);
    const yaw = this.mo.root.rotation.y;
    this.flyingHats.push({ mesh: hat, vx: Math.sin(yaw) * 2.2 + (Math.random() - 0.5), vy: 3.8, vz: Math.cos(yaw) * 2.2 + (Math.random() - 0.5), spin: 8 + Math.random() * 6, landed: false });
  }

  updateFlyingHats(dt) {
    for (const h of this.flyingHats) {
      if (h.landed) continue;
      h.vy -= 13 * dt;
      h.mesh.position.x += h.vx * dt;
      h.mesh.position.y += h.vy * dt;
      h.mesh.position.z += h.vz * dt;
      h.mesh.rotation.x += h.spin * dt;
      h.mesh.rotation.z += h.spin * 0.4 * dt;
      if (h.mesh.position.y <= 0.08 && h.vy < 0) { h.landed = true; h.mesh.position.y = 0.08; h.mesh.rotation.set(Math.PI * (Math.random() < 0.5 ? 0 : 1), Math.random() * 6, 0); }
    }
  }

  /** The nearest thing within reach that is not a person: an area's machines, then the cars. */
  punchableAt(pos) {
    const reach = CONFIG.brawl.range + 0.3;
    let best = null;
    for (const m of this.area?.punchables || []) {
      const d = Math.hypot(m.x - pos.x, m.z - pos.z) - (m.r || 0.5);
      if (d < reach && (!best || d < best.d)) best = { ...m, d };
    }
    // traffic: a car's box, measured from its edge
    for (const c of this.traffic?.cars || []) {
      const w = c.mesh.userData.width || 1.8;
      const dx = Math.max(0, Math.abs(pos.x - c.x) - c.len / 2), dz = Math.max(0, Math.abs(pos.z - c.lane.z) - w / 2);
      const d = Math.hypot(dx, dz);
      if (d < reach && (!best || d < best.d)) best = { kind: 'car', car: c, d };
    }
    // and the cars parked along Kestrel Street
    if (this.areaId === 'street') {
      for (const c of ROAD.parkedNear) {
        const dx = Math.max(0, Math.abs(pos.x - c.x) - 2.1), dz = Math.max(0, Math.abs(pos.z - ROAD.parkNearZ) - 0.9);
        const d = Math.hypot(dx, dz);
        if (d < reach && (!best || d < best.d)) best = { kind: 'parked', x: c.x, z: ROAD.parkNearZ, d };
      }
    }
    return best;
  }

  /** A vending machine takes a punch the way they all do: a clang, a hum, and sometimes a can. */
  punchVending(g, m) {
    const s = g.state;
    this.punchT = 0.34;
    g.audio?.sfx?.('clang');
    bump(s, 'energy', -1);
    this.vendHits = (this.vendHits || 0) + 1;
    if (Math.random() < 0.35) {
      const can = box(0.07, 0.12, 0.07, retroMaterial('floorCan', { color: pick([0xc8121a, 0x1a6ac8, 0x2a9a3a]) }), [m.x + (Math.random() - 0.5) * 0.5, 0.06, m.z + (m.out || 0.75)]);
      can.rotation.z = Math.PI / 2;
      this.root.add(can);
      const it = { id: `can_${Math.random().toString(36).slice(2, 6)}`, label: 'A can of soda on the floor', sub: 'free, technically', x: can.position.x, z: can.position.z, radius: 0.9, action: (gg) => {
        addItem(gg.state, 'soda', 1);
        can.parent?.remove(can);
        this.interactables = this.interactables.filter((i) => i !== it);
        this.floorCans = (this.floorCans || []).filter((c) => c.mesh !== can);
        gg.toast('A can of soda, dented, warm, yours. It is in your pocket.', 'good');
      } };
      this.interactables.push(it);
      (this.floorCans = this.floorCans || []).push({ mesh: can, it });
      g.toast(pick(['CLANG. The machine thinks about it, and drops a can on the floor like it is apologising.', 'A metal BONG, a shudder, and a can rolls out of the flap. The machine hums a little higher now.']), 'good');
    } else {
      g.toast(pick(['CLANG. Nothing. Your knuckles and the machine both remember this.', 'A hollow BONG. The machine keeps your money and its dignity.', 'CLANG. Somewhere inside, a can moves an inch and decides against it.']), 'info');
    }
    if (this.vendHits >= 3 && this.areaId === 'laundromat') { this.vendHits = 0; g.toast('"HEY." Dee does not look up from her magazine. "You break it, it is yours. It is not worth having."', 'bad'); }
  }

  /** A car. A parked one screams; a running one has a driver in it, and he gets out. */
  punchCar(g, thing) {
    const s = g.state;
    this.punchT = 0.34;
    g.audio?.sfx?.('clang');
    bump(s, 'energy', -2);
    if (thing.kind === 'parked') {
      g.audio?.sfx?.('alarm');
      setTimeout(() => g.audio?.sfx?.('alarm'), 420);
      setTimeout(() => g.audio?.sfx?.('alarm'), 840);
      if (Math.random() < 0.3 && !this.assailants.active) {
        const p = this.mo.root.position;
        this.assailants.spawn(g, { kind: 'tenant_m', x: p.x + 5, z: -4.6, hp: 3, speed: 3.6, name: 'the owner', onWin: (gg, rig) => this.assailantLoot(gg, rig, 'the owner') });
        g.toast('A car alarm, then a window, then a man in a tank top coming down the stoop three steps at a time: "THAT IS MY CAR."', 'bad');
      } else g.toast('The car alarm goes off. Nobody on Kestrel Street so much as looks up. Car alarms are weather here.', 'info');
      return;
    }
    const c = thing.car;
    c.speed = 0;
    c.cruise = 0;
    c.angry = true;
    if (c.mesh.userData.flash) { this.startChase(g, 'cop'); return; }
    if (c.driverOut || this.assailants.active || Math.random() > 0.6) {
      g.toast(pick(['BONG. The driver leans on the horn and says a word that rhymes with the whole situation.', 'The hood takes a dent the shape of your hand. The driver looks at you like a man doing math about his insurance.']), 'info');
      setTimeout(() => { c.cruise = 6; }, 2500);
      return;
    }
    c.driverOut = true;
    const w = c.mesh.userData.width || 1.8;
    const line = pick(['"YOU HIT MY CAR? YOU HIT MY CAR?"', '"Oh, you want to do this? We are doing this."', '"That is a LEASE, my man!"']);
    this.assailants.spawn(g, { kind: pick(['passer_m', 'tenant_m', 'drifter']), x: c.x, z: c.lane.z - w / 2 - 0.4, hp: 3, speed: 3.8, name: 'the driver', onWin: (gg, rig) => {
      this.assailantLoot(gg, rig, 'the driver');
      setTimeout(() => { c.cruise = 9; }, 4000);
    } });
    g.toast(`The door flies open. ${line}`, 'bad');
  }

  /** Down and breathing: the two things there are to do about it, as a prompt by the body. */
  assailantLoot(g, rig, who, extra = null) {
    const a = this.assailants.list.find((x) => x.rig === rig);
    const it = { id: `alt_${Math.random().toString(36).slice(2, 6)}`, label: 'Somebody is out cold', sub: `${who} · check their pockets`, x: rig.root.position.x, z: rig.root.position.z, radius: 1.3, action: (gg) => {
      if (this.lootWitnessed(gg)) return;
      const loot = brawl.loot(gg, { kind: 'civilian', key: rig.npcId || it.id, label: who });
      if (extra) extra(gg);
      this.interactables = this.interactables.filter((i) => i !== it);
      if (!loot.ok) { gg.toast('Nothing on him but a bad attitude.', 'info'); return; }
      gg.toast(`${loot.cash ? `${money(loot.cash)}. ` : ''}${loot.items.length ? `And ${loot.items.join(', ')}.` : 'Otherwise, keys and a receipt.'}`, 'info');
    } };
    if (a) a.it = it;
    this.interactables.push(it);
  }

  /**
   * Knockouts, counted: three people on the ground within a couple of hours and the Guardian
   * Angles hear about it. One of them comes, red beret first.
   */
  noteKO(g, def = {}) {
    // dealers, muggers, the armed, the men who came at him and the Angles themselves are not
    // innocent; five innocent people on the ground inside five real minutes is a spree
    const GUILTY = new Set(['thug', 'thug_armed', 'benchman', 'drifter', 'unknown', 'mugger', 'boxer', 'angel_m', 'angel_f', 'cop', 'cop2']);
    if (GUILTY.has(def.kind) || def.assailant || def.cop || def.tough) return;
    const now = this.realT || 0;
    this.koLog = (this.koLog || []).filter((t) => now - t < 300);
    this.koLog.push(now);
    if (this.koLog.length >= 5 && OUTSIDE.has(this.areaId) && !this.assailants.active) {
      this.koLog = [];
      this.spawnAngle(g);
    }
  }

  spawnAngle(g) {
    const p = this.mo.root.position;
    const b = this.area?.bounds || { minX: p.x - 10, maxX: p.x + 10 };
    const fromLeft = p.x - b.minX > b.maxX - p.x;
    const kind = Math.random() < 0.7 ? 'angel_m' : 'angel_f';
    this.assailants.spawn(g, {
      kind, x: fromLeft ? b.minX + 1 : b.maxX - 1, z: p.z, hp: 4, speed: 4.2, name: 'the Guardian Angle',
      onWin: (gg, rig) => this.assailantLoot(gg, rig, 'a Guardian Angle', (g2) => {
        addItem(g2.state, 'angle_pamphlet', 1);
        g2.toast('Folded in the jacket: a pamphlet. "BE VIGILANT IN THESE TROUBLED TIMES." There is a picture of a man who looks a lot like you on the back.', 'info');
      }),
      onLose: (gg) => {
        gg.toast('"CITIZEN\'S ARREST!" is the last thing you hear, followed by a lot of very sincere knee. Then nothing. Then a ceiling.', 'bad');
        gg.collapseSequence?.('beaten');
      },
    });
    g.audio?.sfx?.('alarm');
    g.toast(pick(['A red beret at the end of the block, then a whistle, then a woman yelling "GUARDIAN ANGLES! STAY WHERE YOU ARE, CITIZEN!" She is running at you. They mean well. At an angle.', '"THIS NEIGHBOURHOOD IS PROTECTED!" A man in a red satin jacket is jogging at you with the confidence of a man who has never once been asked to. Fight or run.']), 'bad');
  }

  /** Shepherd Addison takes a punch like a sermon: twice, then he is down, and the robes have pockets. */
  punchAddison(g) {
    const s = g.state;
    const ad = this.addison;
    this.punchT = 0.34;
    g.audio?.sfx?.('hit');
    ad.hits = (ad.hits || 0) + 1;
    if (ad.hits < 2) {
      bump(s, 'stress', 4);
      g.toast(pick(['"I forgive you," Addison says, holding his jaw. "That will be reflected in your standing."', 'Addison staggers, and smiles with blood on his teeth. "The Lord tests. The Lord also keeps a ledger."']), 'bad');
      return;
    }
    ad.hits = 0;
    ad.down = true;
    ad.downUntil = this.realT + CONFIG.brawl.downSeconds;
    ad.danceT = 0;
    ad.root.rotation.set(0, ad.root.rotation.y, Math.PI / 2);
    ad.root.position.y = 0.16;
    this.flyHat(ad);
    animateDown(ad);
    this.noteKO(g, { kind: 'addison' });
    const f = s.fellowship;
    g.openModal({
      kicker: 'THE GOLDEN FELLOWSHIP', title: 'The Shepherd Is Down',
      body: 'Addison Octavius is on the carpet of his own church, breathing, the white suit not white any more. The collection plate is on the table behind him. His robes have deep pockets. They would.',
      choices: [
        { label: 'Go through his robes.', sub: 'the Fellowship will know · standing drops', disabled: s.flags.addisonRobbed === dayOf(s.clock.m), effect: () => {
          const cash = Math.round((40 + Math.random() * 110) * 100) / 100;
          g.earnMoney(cash, 'Addison\'s robes');
          s.flags.addisonRobbed = dayOf(s.clock.m);
          f.stage = Math.max(1, (f.stage || 1) - 1);
          f.donated = Math.max(0, (f.donated || 0) - 60);
          s.npc = s.npc || {};
          s.npc.addison = Math.max(0, (s.npc.addison || 0) - 10);
          bump(s, 'risk', 10);
          bump(s, 'morale', -4);
          logLine(g, `Robbed Shepherd Addison of ${money(cash)}. The Fellowship will remember.`, 'bad');
          g.toast(`${money(cash)} in small bills, a gold pen and a list of names with yours on it, underlined. You keep the money. The ledger keeps you.`, 'bad');
        } },
        { label: 'Leave him there.', sub: 'he will be up in a minute', effect: () => {} },
      ],
    });
  }

  /** Follow his guidance: Addison's dance, which is not a dance, and Mo doing it with him. */
  addisonDance(g) {
    const ad = this.addison;
    if (!ad?.root.visible) return;
    ad.danceT = 9;
    this.dance?.play();
    setTimeout(() => this.dance?.stop(), 9000);
  }

  addisonMoves(dt) {
    const ad = this.addison;
    ad.danceT = Math.max(0, ad.danceT - dt);
    const t = (this.time || 0) * 1.6;
    // arms up and rippling, a slow spin, and a dip of the knees on every fourth beat
    if (ad.armL) {
      ad.armL.pivot.rotation.set(-2.6 + Math.sin(t * 3) * 0.4, 0, -0.5 + Math.sin(t * 2) * 0.5);
      ad.armR.pivot.rotation.set(-2.6 + Math.sin(t * 3 + 1.5) * 0.4, 0, 0.5 - Math.sin(t * 2 + 1) * 0.5);
    }
    if (ad.hips) ad.hips.rotation.y = Math.sin(t * 1.2) * 0.6;
    ad.root.rotation.y += dt * 0.9;
    if (ad.danceT === 0) ad.root.rotation.y = 0;
  }

  /**
   * Papi: the old man puts his bones down, stands up very slowly, and slaps Mo so hard he goes
   * over and stays over. Nobody at the table looks surprised.
   */
  papiSmack(g, rig) {
    if (this.cutscene) return;
    this.punchT = 0.34;
    this.haltMo?.();
    rig.sceneBaseY = rig.baseY;
    this.cutscene = { kind: 'papi', rig, t: 0 };
    g.toast('Papi puts his dominoes down, face down, in order. Then he stands up. Slowly.', 'bad');
  }

  /**
   * Yusuf: the hookah goes down, a rifle comes up out of the bag by his chair, one shot at the
   * sky, and Mo is running before the echo is back. Yusuf puts it away and sits.
   */
  yusufWarning(g, rig) {
    if (this.cutscene) return;
    this.punchT = 0.34;
    this.haltMo?.();
    rig.sceneBaseY = rig.baseY;
    const gun = new THREE.Group();
    const steel = retroMaterial('akSteel', { color: 0x1a1a1c });
    const wood = retroMaterial('akWood', { color: 0x7a4a22 });
    gun.add(box(0.05, 0.05, 0.62, steel, [0, 0, 0.18]));
    gun.add(box(0.06, 0.09, 0.26, wood, [0, -0.02, -0.18]));
    gun.add(box(0.05, 0.16, 0.06, steel, [0, -0.1, 0.18], [0.35, 0, 0]));
    gun.add(box(0.045, 0.05, 0.2, wood, [0, -0.02, 0.36]));
    gun.position.set(0, -0.55, 0.1);
    gun.rotation.x = -Math.PI / 2;
    rig.armR.pivot.add(gun);
    this.cutscene = { kind: 'yusuf', rig, t: 0, gun };
    g.toast('Yusuf sets the hose down. He reaches into the bag by his chair without looking.', 'bad');
  }

  updateScene(dt, g) {
    const sc = this.cutscene;
    const rig = sc.rig;
    const p = rig.root.position;
    const mo = this.mo.root;
    sc.t += dt;
    const face = () => { rig.root.rotation.y = Math.atan2(mo.position.x - p.x, mo.position.z - p.z); };
    const stand = (u) => { rig.npcDef.pose = null; p.y = (rig.sceneBaseY || 0) * (1 - u); rig.baseY = p.y; };
    const sit = () => { rig.npcDef.pose = 'sit'; rig.baseY = rig.sceneBaseY || 0; p.y = rig.baseY; };
    if (sc.kind === 'papi') {
      if (sc.t < 1.2) { stand(Math.min(1, sc.t / 1.2)); face(); }
      else if (sc.t < 1.55) {
        punchPose(rig, (sc.t - 1.2) / 0.35);
        if (!sc.hit && sc.t > 1.38) {
          sc.hit = true;
          g.audio?.sfx?.('smack');
          const yaw = Math.atan2(mo.position.x - p.x, mo.position.z - p.z);
          this.flung = { vx: Math.sin(yaw) * 3.4, vy: 2.6, vz: Math.cos(yaw) * 3.4, t: 0, lie: 0 };
          g.toast('CRACK. An open hand like a door slamming. The sidewalk comes up to meet you and you let it.', 'bad');
        }
      } else if (sc.t < 3.0) { punchPose(rig, 1); }
      else if (!sc.done) {
        sc.done = true;
        sit();
        g.toast('"Siéntate, mijo," somebody says. Papi sits back down and turns his dominoes over, in order. Tito says "capicúa" to nobody.', 'bad');
        this.cutscene = null;
        this.flung = null;
        g.collapseSequence?.('beaten');
      }
      return;
    }
    if (sc.kind === 'yusuf') {
      if (sc.t < 0.6) { stand(Math.min(1, sc.t / 0.6)); face(); }
      else if (sc.t < 1.4) {
        // the rifle up, straight at the sky
        rig.armR.pivot.rotation.set(-2.9, 0, 0.1);
        rig.armR.elbow.rotation.x = -0.1;
        rig.armL.pivot.rotation.set(-2.6, 0, -0.3);
        if (!sc.shot && sc.t > 0.95) {
          sc.shot = true;
          g.audio?.sfx?.('gunshot');
          const flash = box(0.16, 0.16, 0.16, retroMaterial('muzzle', { color: 0xffe28a, emissive: 1.4, unlit: true }), [0, 0, 0.55]);
          sc.gun.add(flash);
          setTimeout(() => flash.parent?.remove(flash), 90);
          g.toast('BLAM. One shot at the clouds. Every pigeon on Kestrel Street leaves at once, and so do you.', 'bad');
        }
      } else if (sc.t < 3.6) {
        // Mo runs: away from the chair, along the sidewalk, as fast as he has ever moved
        rig.armR.pivot.rotation.set(-1.2, 0, 0.1);
        if (!sc.dir) { const away = mo.position.x >= p.x ? 1 : -1; sc.dir = away; }
        sc.run = true;
        mo.rotation.y = sc.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        mo.position.x += sc.dir * 5.2 * dt;
        mo.position.z += (-2.0 - mo.position.z) * Math.min(1, dt * 2);
        const b = this.area?.bounds;
        if (b) mo.position.x = clamp(mo.position.x, b.minX + 0.5, b.maxX - 0.5);
        if (!sc.away && sc.t > 2.2) { sc.away = true; sc.gun.parent?.remove(sc.gun); sit(); }
      } else {
        sc.gun.parent?.remove(sc.gun);
        sit();
        bump(g.state, 'stress', 16);
        bump(g.state, 'morale', -4);
        logLine(g, 'Swung at Yusuf outside Habib\'s. Never again.', 'bad');
        g.toast('Half a block later you look back. Yusuf is sitting again, the hose in his hand, the bag zipped, like nothing happened. Habib is in the doorway shaking his head at you.', 'info');
        this.cutscene = null;
      }
    }
  }

  /** A speeding car does not stop: Mo goes over the hood and lands somewhere else. */
  hitByCar(g, car) {
    if (this.flung) return;
    const s = g.state;
    const dir = car.lane.dir;
    this.flung = { vx: dir * Math.min(9, car.speed * 0.55), vy: 5.2, vz: (Math.random() - 0.5) * 2, t: 0, lie: 0 };
    this.seated = null;
    this.walking = false;
    g.audio?.sfx?.('hit');
    g.audio?.sfx?.('honk');
    bump(s, 'energy', -30);
    bump(s, 'stress', 18);
    bump(s, 'morale', -6);
    logLine(g, 'Hit by a car on Fulton. Kept the change.', 'bad');
    g.toast(pick(['THUMP. The world goes hood, sky, hood, pavement. The car does not stop. The car was never going to stop.', 'A horn, a bang, and you are airborne for longer than a person should be. You land. The driver yells "WATCH WHERE YOU\'RE STANDING" and is gone.']), 'bad');
  }

  updateFlung(dt, g) {
    const f = this.flung;
    const mo = this.mo.root;
    f.t += dt;
    if (f.lie > 0) {
      f.lie -= dt;
      if (f.lie <= 0) {
        mo.rotation.set(0, mo.rotation.y, 0);
        mo.position.y = 0;
        this.flung = null;
        if (g.state.stats.energy <= 0) g.collapseSequence?.('beaten');
      }
      return;
    }
    f.vy -= 14 * dt;
    mo.position.x += f.vx * dt;
    mo.position.y += f.vy * dt;
    mo.position.z += f.vz * dt;
    mo.rotation.x += 7 * dt;
    const b = this.area?.bounds;
    if (b) { mo.position.x = clamp(mo.position.x, b.minX, b.maxX); mo.position.z = clamp(mo.position.z, b.minZ, b.maxZ); }
    if (mo.position.y <= 0 && f.vy < 0) {
      mo.position.y = 0.16;
      mo.rotation.set(0, mo.rotation.y, Math.PI / 2);
      f.lie = 1.6;
      this.tilt = 1;
    }
  }

  render() {
    this.cutaway();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Snapz: the frame as it is, cropped to a phone (3:4 from the middle), as a small JPEG. A selfie
   * turns Mo round to the lens for the one frame it takes. Rendered and read in the same task, so
   * the drawing buffer is still there to read.
   */
  snapshot(selfie = false) {
    try {
      const mo = this.mo.root;
      const yaw = mo.rotation.y;
      if (selfie) mo.rotation.y = (this.camYaw || 0) + (this.camSwing || 0) + Math.PI;
      this.render();
      const src = this.renderer.domElement;
      const c = document.createElement('canvas');
      c.width = 180; c.height = 240;
      const tw = Math.min(src.width, src.height * 0.75);
      c.getContext('2d').drawImage(src, (src.width - tw) / 2, 0, tw, src.height, 0, 0, 180, 240);
      mo.rotation.y = yaw;
      return c.toDataURL('image/jpeg', 0.72);
    } catch (e) {
      console.warn('[snapz]', e);
      return null;
    }
  }
}

function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
