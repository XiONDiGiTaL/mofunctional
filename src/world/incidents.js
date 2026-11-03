/**
 * Things that happen on the street whether or not Mo is looking. One at a time, every couple of
 * minutes, somewhere he can see:
 *
 *   purse    somebody runs up behind a woman on the walk, takes her bag and runs. She yells, the
 *            people near her stop and stare, a couple back away, somebody shouts for the cops. Mo
 *            can put the thief down with one punch (and get thanked); if he gets away, now and then
 *            a cop on foot comes running after him.
 *   stop     a cruiser pulls over, lights going; two officers get out, walk up to a man by the curb
 *            and tell him to put his hands up. Most of the time he does: hands up, cuffs, a walk to
 *            the car, gone. Sometimes he runs, and one of them goes after him.
 *   graffiti at night, two writers at a wall: one paints, one watches the street. The piece fills in
 *            as they work, and if a cop comes they scatter and leave it half done. Either way it
 *            stays on the wall (state.graffiti), and the walls collect them over a run.
 *
 * Who the thief or the suspect is comes from the event, never from who is standing nearby: both are
 * people the event brings with it. Everything spawned here is removed when it ends or the area
 * changes; what happened goes in `state.worldLog` for Papi to talk about.
 */
import * as THREE from '../../vendor/three.module.js';
import { createNPC, animateNPC } from './characters.js';
import { retroMaterial, plane } from '../render/retro.js';
import { faceSpec } from '../render/heads.js';
import { bump, logLine } from '../core/state.js';
import { minuteOfDay, dayOf, pick, money } from '../core/util.js';
import { bark } from './crowd.js';
import { SPOTS, areaKey, wallList, wallArt } from './walls.js';

const WHERE = new Set(['street', 'row', 'avenue', 'parkslope']);
// walls with paint, where only the wall events happen (writers, the buff crew)
const WALL_ONLY = new Set(['subway', 'projects', 'roof']);
const AREA_NAME = { street: 'Kestrel', row: 'Myrtle Row', avenue: 'Ashby Avenue', parkslope: '7th Avenue', subway: 'the Kestrel platform', projects: 'the Houses', roof: 'the roof' };

export function log(s, what) {
  s.worldLog = (s.worldLog || []).slice(-19);
  s.worldLog.push({ day: dayOf(s.clock.m), ...what });
}

/* ------------------------------------------------------------------ the director */

export class Incidents {
  constructor(world) {
    this.world = world;
    this.cur = null;
    this.next = 50 + Math.random() * 60;
    this.pieces = [];
  }

  /** The area just loaded: put its walls' paint back up. */
  onLoad(g, areaId) {
    this.clear();
    const s = g.state;
    const key = areaKey(s, areaId);
    const spots = SPOTS[key];
    const list = wallList(s, key);
    if (!spots || !list) return;
    const day = dayOf(s.clock.m);
    for (const rec of list) {
      const sp = spots[rec.i];
      if (sp) this.pieces.push({ rec, art: wallArt(this.world.root, sp, rec, day) });
    }
  }

  /** Take one spot's art down and put its record back up (after a change). */
  redraw(g, item) {
    item.art.group.parent?.remove(item.art.group);
    const sp = SPOTS[areaKey(g.state, this.world.areaId)][item.rec.i];
    item.art = wallArt(this.world.root, sp, item.rec, dayOf(g.state.clock.m));
  }

  clear() {
    for (const r of this.cur?.rigs || []) { r.root.parent?.remove(r.root); this.world.npcRigs = this.world.npcRigs.filter((x) => x !== r); }
    if (this.cur?.car) this.cur.car.stopAt = null;
    this.cur = null;
    for (const p of this.pieces) p.art.group.parent?.remove(p.art.group);
    this.pieces = [];
  }

  update(dt, g) {
    const w = this.world;
    if (this.cur) { this.cur.step(dt, g); return; }
    if ((!WHERE.has(w.areaId) && !WALL_ONLY.has(w.areaId)) || g.uiBusy) return;
    this.next -= dt;
    if (this.next > 0 || w.duel?.active || w.chaseRig || w.cutscene) return;
    this.next = 90 + Math.random() * 120;
    const m = minuteOfDay(g.state.clock.m);
    const night = m >= 21 * 60 || m < 5 * 60;
    const options = [];
    const walls = !!SPOTS[areaKey(g.state, w.areaId)];
    if (WHERE.has(w.areaId)) {
      if (!night || Math.random() < 0.3) options.push('purse');
      options.push('stop');
    }
    if (night && walls) options.push('graffiti', 'graffiti');
    if (!night && walls && this.pieces.some((p) => !p.rec.buffed)) options.push('buff');
    const kind = pick(options);
    if (kind === 'purse') this.purse(g);
    else if (kind === 'stop') this.stop(g);
    else if (kind === 'buff') this.buff(g);
    else if (kind === 'graffiti') this.graffiti(g);
  }

  spawn(kind, x, z, extra = {}) {
    const rig = createNPC(kind);
    rig.root.position.set(x, 0, z);
    rig.npcDef = { kind, scripted: true, ...extra };
    rig.scripted = true;
    this.world.root.add(rig.root);
    this.world.npcRigs.push(rig);
    return rig;
  }

  /** Walkers near (x, z) stop and look; some back off, a couple say something. */
  react(x, z, radius, lines = []) {
    let said = 0;
    for (const r of this.world.npcRigs) {
      if (!r.npcDef?.walker || r.down || !r.root.visible) continue;
      const d = Math.hypot(r.root.position.x - x, r.root.position.z - z);
      if (d > radius) continue;
      r.reactT = 2.5 + Math.random() * 2.5;
      r.reactAt = { x, z };
      if (Math.random() < 0.3) r.walkDir = Math.sign(r.root.position.x - x) || 1;
      if (lines.length && said < 2 && Math.random() < 0.5) { said += 1; bark(r, pick(lines), 2.4); }
    }
  }

  /** Move a scripted rig toward (x, z); true when there. */
  walkTo(rig, x, z, speed, dt) {
    const p = rig.root.position;
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    rig.walking = d > 0.15;
    if (!rig.walking) return true;
    const st = Math.min(d, speed * dt);
    p.x += (dx / d) * st; p.z += (dz / d) * st;
    rig.root.rotation.y = Math.atan2(dx, dz);
    rig.runK = speed > 2 ? 1.7 : 1;
    return false;
  }

  /* ---------------------------------------------- the purse */
  purse(g) {
    const w = this.world;
    const mo = w.mo.root.position;
    const victims = w.npcRigs.filter((r) => r.npcDef?.walker && r.root.visible && !r.down && faceSpec(r.npcDef.kind)?.fem && r.carry !== 'stroller' && Math.abs(r.root.position.x - mo.x) < 16);
    const v = pick(victims);
    if (!v) return;
    const b = w.area.bounds;
    const dir = v.walkDir || 1;
    const thief = this.spawn('unknown', Math.max(b.minX + 0.5, Math.min(b.maxX - 0.5, v.root.position.x - dir * 7)), v.root.position.z + 0.3, { thief: true });
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.08), retroMaterial('inc_purse', { color: 0x8a1e3a }));
    bag.position.set(0, -0.5, 0.05);
    v.armL.elbow.add(bag);
    const ev = { kind: 'purse', rigs: [thief], phase: 'creep', t: 0 };
    const exitX = mo.x > v.root.position.x ? b.minX + 0.3 : b.maxX - 0.3;
    ev.step = (dt, gg) => {
      ev.t += dt;
      if (thief.down) {
        if (ev.phase !== 'caught') {
          ev.phase = 'caught'; ev.t = 0;
          bark(v, pick(['Thank you! Oh my God, thank you!', 'My bag! You got my bag!']), 3);
          const cash = 15 + Math.round(Math.random() * 25);
          gg.earnMoney(cash, 'a reward, from the woman with the bag');
          bump(gg.state, 'morale', 10);
          logLine(gg, 'Stopped a purse snatcher.', 'good');
          gg.toast(`She gets her bag back off the pavement and presses ${money(cash)} into your hand and will not take it back. Two people on the block clap, slowly, like it is a movie.`, 'good');
          log(gg.state, { what: 'purse', where: w.areaId, helped: true });
          v.reactT = 0;
        }
        if (ev.t > 25) this.end();
        return;
      }
      if (ev.phase === 'creep') {
        if (this.walkTo(thief, v.root.position.x, v.root.position.z, 3.4, dt) || Math.hypot(thief.root.position.x - v.root.position.x, thief.root.position.z - v.root.position.z) < 0.7) {
          ev.phase = 'run'; ev.t = 0;
          v.armL.elbow.remove(bag);
          thief.armR.elbow.add(bag);
          v.reactT = 6; v.reactAt = { x: thief.root.position.x, z: thief.root.position.z };
          bark(v, pick(['HEY! MY BAG!', 'THIEF! STOP HIM!', 'SOMEBODY! MY PURSE!']), 3);
          this.react(v.root.position.x, v.root.position.z, 10, ['Yo, he just took her bag!', 'Somebody call the cops!', 'Oh, hell no.', 'Did you see that?']);
          gg.audio?.sfx?.('deny');
        }
        if (ev.t > 12) this.end();
        return;
      }
      if (ev.phase === 'run') {
        if (this.walkTo(thief, exitX, thief.root.position.z, 3.6, dt)) {
          thief.root.visible = false;
          log(gg.state, { what: 'purse', where: w.areaId, helped: false });
          // now and then, a cop on foot after him, the long way round
          if (Math.random() < 0.45) {
            const cop = this.spawn('cop', exitX > 0 ? b.minX + 0.5 : b.maxX - 0.5, -1.0);
            ev.rigs.push(cop);
            bark(cop, 'STOP! POLICE!', 2.4);
            ev.phase = 'cop'; ev.t = 0; ev.cop = cop;
          } else this.end();
        }
        return;
      }
      if (ev.phase === 'cop') {
        if (this.walkTo(ev.cop, exitX, -1.0, 3.2, dt) || ev.t > 30) this.end();
      }
    };
    this.cur = ev;
  }

  /* ---------------------------------------------- a stop, and maybe an arrest */
  stop(g) {
    const w = this.world;
    const mo = w.mo.root.position;
    const b = w.area.bounds;
    const sx = Math.max(b.minX + 3, Math.min(b.maxX - 3, mo.x + (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 5)));
    const suspect = this.spawn(pick(['passer_m', 'tenant_m', 'drifter', 'hall_m']), sx, 0.4);
    suspect.root.rotation.y = Math.PI;
    const ev = { kind: 'stop', rigs: [suspect], phase: 'wait', t: 0 };
    // the cruiser, if the area has a road: it pulls up level with him and stops, lights going
    const traffic = w.traffic;
    if (traffic && w.area.traffic) {
      const car = traffic.spawnSpecial('police');
      if (car) { car.stopAt = sx; ev.car = car; }
    }
    ev.step = (dt, gg) => {
      ev.t += dt;
      const p = suspect.root.position;
      if (ev.phase === 'wait') {
        const ready = !ev.car || (Math.abs(ev.car.x - sx) < 1.2 && ev.car.speed < 0.2) || ev.t > 14;
        if (!ready) return;
        const fromX = ev.car ? ev.car.x : (sx > 0 ? b.maxX - 0.5 : b.minX + 0.5);
        const fromZ = ev.car ? ev.car.lane.z - 1.2 : -1.0;
        ev.c1 = this.spawn('cop', fromX - 0.6, fromZ);
        ev.c2 = this.spawn('cop2', fromX + 0.6, fromZ);
        ev.rigs.push(ev.c1, ev.c2);
        bark(ev.c1, pick(['Hands where I can see them!', 'Hey! Over here. Now.', 'Stop right there, sir.']), 2.6);
        this.react(sx, 0.4, 12, ['Uh oh.', 'Here we go.', 'What did he do?', 'Not my business.']);
        ev.phase = 'approach'; ev.t = 0;
        ev.runs = Math.random() < 0.25;
        return;
      }
      if (ev.phase === 'approach') {
        const a = this.walkTo(ev.c1, p.x - 0.7, p.z + 0.9, 1.4, dt);
        this.walkTo(ev.c2, p.x + 0.7, p.z + 0.9, 1.4, dt);
        suspect.root.rotation.y = Math.atan2(ev.c1.root.position.x - p.x, ev.c1.root.position.z - p.z);
        if (ev.runs && ev.t > 1.6) {
          ev.phase = 'chase'; ev.t = 0;
          bark(suspect, pick(['Nah. NAH.', 'Not today!']), 2);
          ev.exitX = sx > 0 ? b.maxX - 0.3 : b.minX + 0.3;
          return;
        }
        if (a || ev.t > 6) { ev.phase = 'hands'; ev.t = 0; bark(suspect, pick(['Okay, okay! I did not do nothing!', 'Whatever this is, it was not me.', 'Officer, I am just standing here.']), 2.6); }
        return;
      }
      if (ev.phase === 'chase') {
        const gone = this.walkTo(suspect, ev.exitX, p.z, 3.4, dt);
        this.walkTo(ev.c2, ev.exitX, p.z, 3.1, dt);
        this.walkTo(ev.c1, ev.car ? ev.car.x : sx, ev.car ? ev.car.lane.z - 1.2 : -1, 1.2, dt);
        if (gone) { suspect.root.visible = false; ev.c2.root.visible = false; log(gg.state, { what: 'chase', where: w.areaId }); ev.phase = 'leave'; ev.t = 0; }
        return;
      }
      if (ev.phase === 'hands') {
        // hands up, then behind the back while one of them puts the cuffs on
        const up = ev.t < 2.5;
        suspect.armL.pivot.rotation.x = up ? -2.9 : 0.5; suspect.armR.pivot.rotation.x = up ? -2.9 : 0.5;
        suspect.armL.elbow.rotation.x = up ? -0.3 : -0.4; suspect.armR.elbow.rotation.x = up ? -0.3 : -0.4;
        suspect.armL.pivot.rotation.z = up ? 0.3 : -0.2; suspect.armR.pivot.rotation.z = up ? -0.3 : 0.2;
        this.walkTo(ev.c1, p.x, p.z - 0.55 + (up ? 1.4 : 0), 0.9, dt);
        ev.c1.armR.pivot.rotation.x = -0.9; ev.c1.armL.pivot.rotation.x = -0.9;
        if (ev.t > 2.6 && ev.t < 2.8) gg.audio?.sfx?.('clang');
        if (ev.t > 5) { ev.phase = 'escort'; ev.t = 0; log(gg.state, { what: 'arrest', where: w.areaId }); }
        return;
      }
      if (ev.phase === 'escort') {
        const tx = ev.car ? ev.car.x : (sx > 0 ? b.maxX - 0.3 : b.minX + 0.3);
        const tz = ev.car ? ev.car.lane.z - 1.0 : p.z;
        const there = this.walkTo(suspect, tx, tz, 0.9, dt);
        this.walkTo(ev.c1, suspect.root.position.x - 0.4, suspect.root.position.z - 0.5, 0.95, dt);
        this.walkTo(ev.c2, suspect.root.position.x + 0.5, suspect.root.position.z - 0.3, 0.95, dt);
        suspect.armL.pivot.rotation.x = 0.5; suspect.armR.pivot.rotation.x = 0.5;
        if (there || ev.t > 12) { for (const r of [suspect, ev.c1, ev.c2]) r.root.visible = false; ev.phase = 'leave'; ev.t = 0; gg.audio?.sfx?.('clang'); }
        return;
      }
      if (ev.phase === 'leave') {
        if (ev.car) ev.car.stopAt = null;
        if (ev.t > 3) this.end();
      }
    };
    this.cur = ev;
  }

  /* ---------------------------------------------- writers at a wall, at night */
  graffiti(g) {
    const w = this.world;
    const s = g.state;
    const key = areaKey(s, w.areaId);
    const spots = SPOTS[key];
    const list = wallList(s, key);
    if (!spots || !list) return;
    // a big wall, preferably a grey patch the city left (that is an invitation)
    const big = spots.map((sp, i) => [sp, i]).filter(([sp]) => sp[6] !== 'small');
    const patches = big.filter(([, i]) => list.find((r) => r.i === i)?.buffed);
    const [sp, i] = pick(patches.length ? patches : big);
    const day = dayOf(s.clock.m);
    const oldIdx = list.findIndex((x) => x.i === i);
    const rec = { i, seed: Math.floor(Math.random() * 1e9), p: 0, day, age0: 0, patch: oldIdx >= 0 && !!(list[oldIdx].buffed || list[oldIdx].patch) };
    if (oldIdx >= 0) list.splice(oldIdx, 1, rec); else list.push(rec);
    const old = this.pieces.findIndex((x) => x.rec.i === i);
    if (old >= 0) { this.pieces[old].art.group.parent?.remove(this.pieces[old].art.group); this.pieces.splice(old, 1); }
    const item = { rec, art: wallArt(w.root, sp, rec, day) };
    this.pieces.push(item);
    const nx = Math.sin(sp[3] || 0), nz = Math.cos(sp[3] || 0);
    const writer = this.spawn(pick(['passer_m2', 'w11', 'hall_m']), sp[0] + nx * 0.75, sp[1] + nz * 0.75);
    const look = this.spawn(pick(['passer_m', 'w3', 'tenant_m']), sp[0] + nx * 1.9 + nz * 1.6, sp[1] + nz * 1.9 - nx * 1.6);
    writer.root.rotation.y = (sp[3] || 0) + Math.PI;
    writer.armR.elbow.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.06), retroMaterial('inc_can', { color: 0xc8c8cc })).translateY(-0.33));
    const ev = { kind: 'graffiti', rigs: [writer, look], phase: 'paint', t: 0 };
    const along = (v) => { const off = (v - 0.5) * (sp[4] || 2.4) * 0.8; writer.root.position.set(sp[0] + nx * 0.75 + Math.cos(sp[3] || 0) * off, 0, sp[1] + nz * 0.75 - Math.sin(sp[3] || 0) * off); };
    ev.step = (dt, gg) => {
      ev.t += dt;
      if (ev.phase === 'paint') {
        // the arm sweeps across the wall; the piece fills in behind it
        rec.p = Math.min(1, rec.p + dt / 26);
        item.art.set(rec.p);
        along(rec.p);
        writer.armR.pivot.rotation.x = -1.7 + Math.sin(ev.t * 5) * 0.25;
        writer.armR.pivot.rotation.z = Math.sin(ev.t * 3) * 0.3;
        look.root.rotation.y = Math.sin(ev.t * 0.7) * 1.4;
        if (Math.random() < dt * 0.6) gg.audio?.sfx?.('puff');
        if (w.copSees?.(18) || (w.patrol?.cops || []).length) {
          bark(look, pick(['Five-oh! Go go go!', 'Cops! Move!']), 2);
          ev.phase = 'run'; ev.t = 0;
        } else if (rec.p >= 1) {
          bark(look, pick(['Clean. Let\'s bounce.', 'That\'s a burner. Go.']), 2);
          ev.phase = 'run'; ev.t = 0;
        }
        return;
      }
      if (ev.phase === 'run') {
        const b = w.area.bounds;
        const ex = writer.root.position.x > (b.minX + b.maxX) / 2 ? b.maxX - 0.3 : b.minX + 0.3;
        const ez = Math.max(b.minZ + 0.4, Math.min(b.maxZ - 0.4, writer.root.position.z));
        const a1 = this.walkTo(writer, ex, ez, 3.0, dt);
        const c1 = this.walkTo(look, ex, ez + 0.6, 3.0, dt);
        if ((a1 && c1) || ev.t > 15) {
          log(gg.state, { what: 'graffiti', where: w.areaId, done: rec.p >= 1, name: item.art.name });
          this.end();
        }
      }
    };
    this.cur = ev;
  }

  /* ---------------------------------------------- the buff crew, by day */
  buff(g) {
    const w = this.world;
    const s = g.state;
    const key = areaKey(s, w.areaId);
    const spots = SPOTS[key];
    const item = pick(this.pieces.filter((p) => !p.rec.buffed && spots[p.rec.i]));
    if (!item) return;
    const sp = spots[item.rec.i];
    const nx = Math.sin(sp[3] || 0), nz = Math.cos(sp[3] || 0);
    const b = w.area.bounds;
    const startX = sp[0] > (b.minX + b.maxX) / 2 ? b.maxX - 0.4 : b.minX + 0.4;
    const worker = this.spawn('buffer', startX, Math.max(b.minZ + 0.4, Math.min(b.maxZ - 0.4, sp[1] + nz * 0.9)));
    // the roller on a pole, and a tray of grey at his feet
    const pole = new THREE.Group();
    pole.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.9, 0.03), retroMaterial('inc_pole', { color: 0xc8a050 })).translateY(-0.6));
    pole.add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.07), retroMaterial('inc_roller', { color: 0x8a8a84 })).translateY(-1.05));
    worker.armR.elbow.add(pole);
    const ev = { kind: 'buff', rigs: [worker], phase: 'walk', t: 0 };
    const at = { x: sp[0] + nx * 0.8, z: sp[1] + nz * 0.8 };
    ev.step = (dt, gg) => {
      ev.t += dt;
      if (ev.phase === 'walk') {
        if (this.walkTo(worker, at.x, at.z, 1.2, dt) || ev.t > 30) {
          ev.phase = 'roll'; ev.t = 0;
          worker.root.rotation.y = (sp[3] || 0) + Math.PI;
          bark(worker, pick(['City says it goes, it goes.', 'Third time this month. Third.', 'I got a whole truck of this grey.', 'Nice letters. Shame.']), 2.8);
        }
        return;
      }
      if (ev.phase === 'roll') {
        const v = Math.min(1, ev.t / 14);
        item.art.buff(v);
        worker.armR.pivot.rotation.x = -2.2 + Math.sin(ev.t * 4) * 0.5;
        worker.armR.elbow.rotation.x = -0.3;
        if (v >= 1) {
          const name = item.art.name;
          Object.assign(item.rec, { buffed: true, day: dayOf(gg.state.clock.m) });
          this.redraw(gg, item);
          log(gg.state, { what: 'buff', where: w.areaId, name });
          ev.phase = 'leave'; ev.t = 0;
        }
        return;
      }
      if (ev.phase === 'leave' && (this.walkTo(worker, startX, worker.root.position.z, 1.2, dt) || ev.t > 25)) this.end();
    };
    this.cur = ev;
  }

  end() {
    if (!this.cur) return;
    for (const r of this.cur.rigs) { r.root.parent?.remove(r.root); this.world.npcRigs = this.world.npcRigs.filter((x) => x !== r); }
    if (this.cur.car) this.cur.car.stopAt = null;
    this.cur = null;
  }
}

/** For Papi: the last thing worth mentioning from the last couple of days. */
export function recentIncident(s) {
  const now = dayOf(s.clock.m);
  const e = [...(s.worldLog || [])].reverse().find((x) => now - x.day <= 2);
  if (!e) return null;
  const where = AREA_NAME[e.where] || 'the block';
  return {
    purse: e.helped ? `I hear somebody stopped a purse snatcher on ${where}. One punch. People are saying it was you. I am saying nothing, I am proud.` : `A lady lost her purse on ${where}. The boy ran like the wind. The police came like the weather: eventually.`,
    arrest: `The police took a man off ${where}. Hands up, cuffs, the car. Everybody watched, nobody saw anything.`,
    chase: `The police chased a man down ${where}. He was faster. Today.`,
    graffiti: `Somebody painted ${e.name || 'their name'} on a wall on ${where} in the night.${e.done ? ' It is good, honestly.' : ' They did not finish. The cops came.'}`,
    buff: `The city sent a man with a roller to ${where}. ${e.name || 'A piece'} is grey now. Give it three days, something new will be on it.`,
  }[e.what] || null;
}
