/**
 * Cops with something to do.
 *
 * A patrol is one officer (two in the Houses) who walks into the area, works it for a couple of
 * minutes and leaves. They are ordinary NPCs to the rest of the world (kind 'cop'), so a cop who
 * sees Mo high still stops him, and a mugging with a cop in sight still ends before it starts.
 * On top of that a patrol officer:
 *
 *   - walks a beat between random points, never through the furniture
 *   - runs at a mugger who is on Mo and ends it, or breaks up a fight Mo is in
 *   - in the Houses, stops the dealers one at a time and pats them down; an armed one shoots,
 *     and the officer shoots back. Whoever is hit goes down and is gone two minutes later. A
 *     dealer who goes down today is not on the bench again until tomorrow.
 *   - sees Mo going through somebody's pockets and comes for him
 *
 * A patrol comes when Mo calls 911 (World.callCops); the Houses also get one now and then.
 */
import * as THREE from '../../vendor/three.module.js';
import { retroMaterial, box } from '../render/retro.js';
import { createNPC, animateNPC } from './characters.js';
import { dayOf, pick } from '../core/util.js';

const DUTY = 120;          // seconds an officer works the area
const SEARCH = 6;          // seconds a pat-down takes
const DEALERS = new Set(['benchman', 'thug', 'thug_armed', 'drifter']);

export class Patrol {
  constructor(world) {
    this.world = world;
    this.cops = [];
  }

  /** Put an officer (or two) into the current area. Returns false where no patrol would come. */
  call(g, { count = 1, quiet = false } = {}) {
    const w = this.world;
    const b = w.area?.bounds;
    if (!b || !OUTSIDE.has(w.areaId)) return false;
    const mo = w.mo.root.position;
    for (let i = 0; i < count; i++) {
      const rig = createNPC(i % 2 ? 'cop2' : 'cop');
      // in from the nearer end of the area, so he walks into frame instead of appearing in it
      const fromX = mo.x - b.minX < b.maxX - mo.x ? b.minX + 0.6 : b.maxX - 0.6;
      rig.root.position.set(fromX, 0, Math.max(b.minZ + 0.6, Math.min(b.maxZ - 0.6, mo.z + (i ? 1.2 : -0.6))));
      rig.npcDef = { kind: rig.root.name === 'cop2' ? 'cop2' : 'cop', label: 'the officer', patrol: true };
      w.root.add(rig.root);
      w.npcRigs.push(rig);
      const cop = { rig, until: (w.realT || 0) + DUTY, state: 'arrive', target: { x: mo.x + (i ? 1.5 : -1.5), z: mo.z }, t: 0, done: new Set(), fire: 0 };
      rig.patrol = cop;
      this.cops.push(cop);
    }
    if (!quiet) g.audio?.sfx?.('sting');
    return true;
  }

  clear() {
    for (const c of this.cops) this.removeRig(c.rig);
    this.cops = [];
  }

  removeRig(rig) {
    const w = this.world;
    rig.root.parent?.remove(rig.root);
    w.npcRigs = w.npcRigs.filter((r) => r !== rig);
    if (rig.bodyIt) w.interactables = w.interactables.filter((i) => i !== rig.bodyIt);
  }

  update(dt, g) {
    const w = this.world;
    // now and then the Houses get a car anyway, in the evening
    if (w.areaId === 'projects') {
      this.idleT = (this.idleT ?? 40) - dt;
      if (this.idleT <= 0) {
        this.idleT = 140 + Math.random() * 80;
        if (!this.cops.length && Math.random() < 0.45) this.call(g, { count: 2, quiet: true });
      }
    }
    if (!this.cops.length) return;
    const now = w.realT || 0;
    const mo = w.mo.root.position;
    for (const c of this.cops) {
      const r = c.rig;
      if (r.down) continue; // the world's npcDown handles a downed officer
      if (c.shootT > 0) { this.shootout(c, dt, g); continue; }
      // off shift: walk out the way he came
      if (now > c.until && c.state !== 'leave') { c.state = 'leave'; c.target = { x: r.root.position.x < mo.x ? w.area.bounds.minX + 0.3 : w.area.bounds.maxX - 0.3, z: r.root.position.z }; }
      // a mugger on Mo: drop everything
      if (w.thug && !w.thugLeaving && c.state !== 'leave') {
        const t = w.thug.root.position;
        c.state = 'mugger';
        c.target = { x: t.x, z: t.z };
        if (dist(r.root.position, t) < 1.6) {
          w.fightMeter?.close?.();
          w.thugLeaving = true;
          g.toast(pick(['"HEY. Hands where I can see them." The man in the hood remembers somewhere else he has to be, at speed.', 'The officer gets between you and him without saying a word. The mugger leaves. The officer looks at you for a long second.']), 'info');
          c.state = 'beat';
        }
      }
      // a fight Mo is in (someone squared up on him): break it up
      const fighter = w.npcRigs.find((x) => !x.down && x !== r && (x.guardT > 0 || x.swingT > 0) && dist(x.root.position, mo) < 4);
      if (fighter && c.state !== 'leave' && c.state !== 'mugger') {
        c.state = 'breakup';
        c.target = { x: (fighter.root.position.x + mo.x) / 2, z: (fighter.root.position.z + mo.z) / 2 };
        if (dist(r.root.position, c.target) < 1.4) {
          fighter.guardT = 0;
          fighter.swingT = 0;
          fighter.swingDelay = 0;
          w.startFlee?.(fighter);
          g.toast('"BREAK IT UP." The officer puts a hand on each of you. The other man takes the hint and walks, fast.', 'info');
          c.state = 'beat';
        }
      }
      // the Houses: the dealers get stopped, one at a time
      if (w.areaId === 'projects' && c.state === 'beat' && !c.searching) {
        const dealer = w.npcRigs.find((x) => !x.down && x.root.visible && DEALERS.has(x.npcDef?.kind) && !c.done.has(x) && !x.searchedBy);
        if (dealer && Math.random() < dt * 0.25) { c.state = 'search'; c.subject = dealer; dealer.searchedBy = c; }
      }
      if (c.state === 'search' && c.subject) {
        const d = c.subject;
        if (d.down || !d.root.visible) { c.state = 'beat'; c.subject = null; }
        else {
          c.target = { x: d.root.position.x + 0.8, z: d.root.position.z };
          if (dist(r.root.position, c.target) < 0.5) {
            c.searching = (c.searching || 0) + dt;
            face(r, d.root.position);
            face(d, r.root.position);
            // hands on the wall, then the pat-down
            d.armL.pivot.rotation.set(-2.6, 0, 0.3);
            d.armR.pivot.rotation.set(-2.6, 0, -0.3);
            r.armL.pivot.rotation.set(-0.8 + Math.sin(c.searching * 6) * 0.3, 0, 0.2);
            r.armR.pivot.rotation.set(-0.8 - Math.sin(c.searching * 6) * 0.3, 0, -0.2);
            // an armed one does not wait to be found
            if (d.npcDef?.kind === 'thug_armed' && c.searching > 1.2) { this.startShootout(c, d, g); continue; }
            if (c.searching > SEARCH) {
              c.done.add(d);
              d.searchedBy = null;
              c.searching = 0;
              c.subject = null;
              c.state = 'beat';
              if (dist(mo, r.root.position) < 14) g.toast(pick(['The officer finds a bag, looks at it, looks at the dealer, and puts it in his own pocket. Everybody goes back to what they were doing.', 'The pat-down turns up a lighter and a lot of attitude. The officer moves on.', '"Have a good night." Neither of them means it.']), 'info');
            }
            continue;
          }
        }
      }
      // the beat: wander between clear spots in the area
      if (c.state === 'arrive' && dist(r.root.position, c.target) < 0.6) c.state = 'beat';
      if (c.state === 'beat' && (!c.target || dist(r.root.position, c.target) < 0.5)) c.target = this.spot(w);
      if (c.state === 'leave' && dist(r.root.position, c.target) < 0.5) { c.gone = true; continue; }
      walkTo(r, c.target, dt, c.state === 'mugger' || c.state === 'breakup' ? 3.2 : 1.4, w);
    }
    for (const c of this.cops.filter((x) => x.gone)) this.removeRig(c.rig);
    this.cops = this.cops.filter((x) => !x.gone && !x.rig.gone);
  }

  spot(w) {
    const b = w.area.bounds;
    for (let i = 0; i < 12; i++) {
      const x = b.minX + 1 + Math.random() * (b.maxX - b.minX - 2);
      const z = b.minZ + 1 + Math.random() * (b.maxZ - b.minZ - 2);
      if (!w.blocked(x, z)) return { x, z };
    }
    return { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 };
  }

  /* -------------------------------------------------------------- guns */

  startShootout(c, dealer, g) {
    c.shootT = 9;
    c.subject = dealer;
    c.fire = 0;
    dealer.shooting = true;
    const w = this.world;
    // the two step apart before the first shot
    const away = new THREE.Vector3().subVectors(dealer.root.position, c.rig.root.position).setY(0).normalize();
    dealer.root.position.addScaledVector(away, 1.6);
    if (dist(w.mo.root.position, dealer.root.position) < 22) g.toast('"GUN!" Everybody in the courtyard is on the ground at once, like they rehearsed it. They have.', 'bad');
  }

  shootout(c, dt, g) {
    const w = this.world;
    const d = c.subject;
    const r = c.rig;
    c.shootT -= dt;
    if (!d || d.down) { this.endShootout(c); return; }
    face(r, d.root.position);
    face(d, r.root.position);
    for (const x of [r, d]) { x.armR.pivot.rotation.set(-1.5, 0, 0); x.armR.elbow.rotation.set(0, 0, 0); }
    c.fire -= dt;
    if (c.fire <= 0) {
      c.fire = 0.7 + Math.random() * 0.5;
      const copShoots = Math.random() < 0.5;
      const shooter = copShoots ? r : d;
      const target = copShoots ? d : r;
      flash(shooter, w);
      g.audio?.sfx?.('punch');
      if (Math.random() < (copShoots ? 0.32 : 0.24)) {
        w.knockDown(target, g);
        target.dead = true;
        target.downUntil = (w.realT || 0) + DUTY;
        if (target === d && w.areaId === 'projects') { g.state.flags = g.state.flags || {}; g.state.flags.pjDealerDown = dayOf(g.state.clock.m); }
        if (dist(w.mo.root.position, target.root.position) < 24) g.toast(target === d ? 'The dealer goes down hard and does not move. The officer keeps his gun on him longer than he needs to.' : 'The officer goes down. The dealer is already running, and nobody in the courtyard saw anything.', 'bad');
        if (target === d) this.endShootout(c);
        else { d.shooting = false; w.startFlee?.(d); }
      }
    }
    if (c.shootT <= 0) { d.shooting = false; w.startFlee?.(d); this.endShootout(c); }
  }

  endShootout(c) {
    c.shootT = 0;
    if (c.subject) c.subject.shooting = false;
    c.subject = null;
    c.searching = 0;
    c.state = 'beat';
  }
}

/** The areas a patrol car can actually reach. */
export const OUTSIDE = new Set(['street', 'avenue', 'park', 'projects', 'parkslope', 'downtown', 'subway']);

function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function face(rig, p) { rig.root.rotation.y = Math.atan2(p.x - rig.root.position.x, p.z - rig.root.position.z); }

function walkTo(rig, t, dt, speed, w) {
  if (!t) return;
  const p = rig.root.position;
  const dx = t.x - p.x;
  const dz = t.z - p.z;
  const d = Math.hypot(dx, dz);
  const moving = d > 0.3;
  if (moving) {
    const nx = p.x + (dx / d) * Math.min(d, speed * dt);
    const nz = p.z + (dz / d) * Math.min(d, speed * dt);
    // slide round furniture rather than through it
    if (!w.blocked(nx, p.z)) p.x = nx;
    if (!w.blocked(p.x, nz)) p.z = nz;
    rig.root.rotation.y = Math.atan2(dx, dz);
  }
  animateNPC(rig, dt * (speed > 2 ? 1.6 : 1), { walking: moving });
}

const flashMat = () => retroMaterial('muzzle', { color: 0xffe28a, emissive: 1.4, unlit: true });
function flash(rig, w) {
  const f = box(0.12, 0.12, 0.12, flashMat(), [0, -0.62, 0.12]);
  rig.armR.pivot.add(f);
  setTimeout(() => f.parent?.remove(f), 70);
  void w;
}
